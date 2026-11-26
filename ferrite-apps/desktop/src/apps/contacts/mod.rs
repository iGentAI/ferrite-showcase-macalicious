//! Contacts' server half: a person's address book.
//!
//! The Contacts demo keeps its cards in the window; when the desktop is
//! served by this app it loads them from here when it opens and saves the
//! whole list after every change. Everything below is kept in the signed-in
//! person's own space (`Storage::user`): nobody else's request reaches it,
//! and Messages and Mail read this person's address book through `people`.
//!
//! * `GET /api/contacts/cards`: `{"cards": [...], "rev": n}`, in the order
//!   saved, or `{"cards": null, "rev": n}` before the person has saved any
//!   (the demo then starts with My Card, or with its own cards before anyone
//!   signs in).
//! * `PUT /api/contacts/cards` with `{"cards": [...], "rev": n}`, `n` the
//!   revision the page last had: replaces the list and answers it with its
//!   new revision, or, when `n` is not the stored revision, changes nothing
//!   and answers 409 with the current list and revision (`document.rs`).
//! * `DELETE /api/contacts/cards`: forgets the list and every picture; the
//!   next GET answers `null`, under a new revision.
//! * `GET`, `PUT` and `DELETE /api/contacts/smart-groups`: the person's smart
//!   groups, `{"smart_groups": [...] | null, "rev": n}`, a document of its
//!   own kept like the cards. A smart group is a rule, not a list of cards,
//!   so the two documents never have to change together.
//! * `GET`, `PUT` and `DELETE /api/contacts/groups`: the person's own groups,
//!   `{"groups": [...] | null, "rev": n}`, each `{"id", "name", "members"}`,
//!   a document of its own kept like the cards. `members` are the ids of its
//!   cards; an id whose card is gone holds nothing, so this document and the
//!   cards never have to change together.
//! * `PUT /api/contacts/pictures/<card id>` with `{"version", "image"}`:
//!   the card's picture, a `data:image/jpeg;base64,` or
//!   `data:image/png;base64,` URL of at most [`MAX_IMAGE_CHARS`]
//!   characters; the card names `version` in its `image`. `DELETE` removes
//!   it (`?version=<v>` removes only that version: a picture chosen since
//!   stays). `GET /api/contacts/pictures?ids=<id>,<id>` answers up to
//!   [`PICTURES_PER_REQUEST`] of them as `{"pictures": {id: {"version",
//!   "image"}}}`, leaving out the ids that have none.
//! * `GET /api/contacts/people`: `{"people": [{"user", "full_name"}]}`, one
//!   entry per saved card that names a desktop user, other than the person's
//!   own, sorted by full name: the address book of Messages and Mail.
//! * `GET /api/contacts/me`: `{"name", "full_name", "guest"}` for the
//!   signed-in account, or `{"name": null}` before anyone signs in.
//! * `GET /api/contacts/users/<account name>`: `{"name", "full_name"}` of
//!   that account (`accounts::lookup`); 404 when no account has the name (a
//!   Guest User never has one), 400 for a name that cannot be an account's,
//!   401 before anyone signs in.
//!
//! A card has the fields of the demo's `Contact` type
//! (`demos/contacts/contacts-data.ts`), checked and bounded here. The cards
//! are one document under the key `cards` (`document.rs`), a list of cards
//! as before, which Spotlight and Automator also read. Pictures are not in
//! it: the whole list is sent with every change, under the gateway's
//! 256 KiB request limit, which a few pictures would fill. Each picture is a
//! key of its own, named by its card and an object name made when it was
//! uploaded and never used again (`pictures/<card id>/<version>.<random>`),
//! and `picture-index` maps each card that has one to that object, which bounds them to [`MAX_PICTURES`] and lets
//! them be forgotten whole.
//!
//! **Pictures change only through the index.** A new picture is written
//! under its own name first and becomes the card's only when a
//! compare-and-set of the index names it; the request whose compare-and-set
//! replaced or removed an entry is the only one that deletes that
//! entry's picture, and a request whose picture did not get into the index
//! deletes its own. So every picture a card shows is in the index, and none
//! that the index names is ever deleted. (A request that stops between
//! writing its picture and the index leaves that one picture unnamed.)

use std::collections::{BTreeMap, BTreeSet};
use std::io;

use ferrite_app::{serde, serde_json};

use super::document;
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture, Space};
use crate::session::{Account, Session};

pub const MODULE: AppModule = AppModule {
    name: "contacts",
    title: "Contacts",
    handle,
};

/// The most cards a person keeps.
pub const MAX_CARDS: usize = 1000;
/// The most fields of one kind (phones, emails, URLs, IM names) on a card.
const MAX_FIELDS: usize = 50;
/// The longest name, label, value or tone.
const MAX_TEXT_CHARS: usize = 300;
/// The longest note.
const MAX_NOTE_CHARS: usize = 5000;
/// The most smart groups a person keeps.
pub const MAX_SMART_GROUPS: usize = 50;
/// The most groups of the person's own.
pub const MAX_GROUPS: usize = 100;
/// The largest list of groups, as JSON, so that it stays under the stored value's limit.
const MAX_GROUPS_BYTES: usize = 150 * 1024;
/// The longest name of a smart group.
pub const MAX_GROUP_NAME_CHARS: usize = 100;
/// The longest picture, as its `data:` URL. The page sends a JPEG of at
/// most 256 by 256 pixels, lowering its quality until it fits.
pub const MAX_IMAGE_CHARS: usize = 65_536;
/// The most conditions a smart group holds.
const MAX_SMART_CONDITIONS: usize = 20;
/// What a smart group's text conditions can look at.
const SMART_CONDITION_FIELDS: &[&str] = &[
    "any", "name", "first", "last", "nickname", "company", "jobTitle", "email", "phone", "address",
    "url", "birthday", "note",
];
/// The most pictures a person keeps: one per card.
pub const MAX_PICTURES: usize = MAX_CARDS;
/// The most pictures one `GET /pictures` answers.
pub const PICTURES_PER_REQUEST: usize = 16;
/// The longest picture version (the page makes them from a UUID). With the
/// object name around it and the longest card id, a full index stays under
/// one stored value (the page's versions are `p-` and a UUID: 38).
pub const MAX_VERSION_CHARS: usize = 38;
const KEY: &str = "cards";
const GROUPS_KEY: &str = "smart-groups";
const OWN_GROUPS_KEY: &str = "groups";
const PICTURE_INDEX: &str = "picture-index";
/// Compare-and-set attempts on the picture index.
const ATTEMPTS: usize = 8;

const JPEG: &str = "data:image/jpeg;base64,";
const PNG: &str = "data:image/png;base64,";

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Field {
    pub label: String,
    pub value: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub service: Option<String>,
    /// On My Card: kept out of a vCard with the private me card on.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub private: Option<bool>,
}

/// A postal address of a card.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Address {
    pub label: String,
    pub street: String,
    pub city: String,
    pub state: String,
    pub zip: String,
    pub country: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(
    crate = "ferrite_app::serde",
    rename_all = "camelCase",
    deny_unknown_fields
)]
pub struct Card {
    pub id: String,
    /// `"icloud"` or `"mac"`.
    pub account: String,
    pub first: String,
    pub last: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub company: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_company: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub me: Option<bool>,
    /// `"monogram"` or `"silhouette"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub picture: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phones: Option<Vec<Field>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub emails: Option<Vec<Field>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub urls: Option<Vec<Field>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ims: Option<Vec<Field>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub related_names: Option<Vec<Field>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dates: Option<Vec<Field>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub socials: Option<Vec<Field>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub addresses: Option<Vec<Address>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phonetic_first: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phonetic_last: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub nickname: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub job_title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub department: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ringtone: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_tone: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub birthday: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    /// The account name of the desktop user the card is for (`martin`):
    /// Messages and Mail reach that person by it (`GET /people`). On My
    /// Card it is the signed-in person's own.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user: Option<String>,
    /// The version of the card's picture, which is kept beside the cards
    /// (`PUT /pictures/<card id>`); absent when the card has none.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image: Option<String>,
}

/// A group of cards chosen by a rule, shown in the sidebar.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct SmartGroup {
    pub id: String,
    pub name: String,
    /// `"desktop-user"`: the cards for a desktop user; `"contains"`: the
    /// cards with `text` in a name, the company, the note or a field;
    /// `"rules"`: the cards that meet `conditions`, all of them unless `any`.
    pub rule: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub conditions: Option<Vec<SmartCondition>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub any: Option<bool>,
}

/// One condition of a smart group's rule builder.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct SmartCondition {
    pub field: String,
    pub test: String,
    pub value: String,
}

/// A group of the person's own: the cards they put in it, by id.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Group {
    pub id: String,
    pub name: String,
    pub members: Vec<String>,
}

/// A card's picture, as stored under `pictures/<card id>/<object>`.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Picture {
    pub version: String,
    pub image: String,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Body {
    cards: Vec<Card>,
    /// The revision the page based this list on, and the session it loaded
    /// it under (`document.rs`).
    rev: u64,
    #[serde(default)]
    session: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct GroupsBody {
    smart_groups: Vec<SmartGroup>,
    rev: u64,
    #[serde(default)]
    session: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct OwnGroupsBody {
    groups: Vec<Group>,
    rev: u64,
    #[serde(default)]
    session: Option<String>,
}

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    let (method, path) = (cx.request.method, cx.request.path);
    let outcome = match path {
        "/cards" => cards(&mut cx).await,
        "/smart-groups" => smart_groups(&mut cx).await,
        "/groups" => own_groups(&mut cx).await,
        "/pictures" if method == "GET" => read_pictures(&mut cx).await,
        "/people" if method == "GET" => people(&mut cx).await,
        "/me" if method == "GET" => Ok(me(cx.session)),
        "/pictures" | "/people" | "/me" => Ok(Response::method_not_allowed()),
        _ => {
            if let Some(id) = path.strip_prefix("/pictures/") {
                picture(&mut cx, id).await
            } else if let Some(name) = path.strip_prefix("/users/") {
                match method {
                    "GET" => user(&mut cx, name).await,
                    _ => Ok(Response::method_not_allowed()),
                }
            } else {
                Ok(Response::not_found())
            }
        }
    };
    outcome.unwrap_or_else(|error| Response::error(503, &format!("storage failed: {error}")))
}

/// The cards document.
async fn cards(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let session = cx.session;
    match cx.request.method {
        "GET" => {
            let current = document::read::<Vec<Card>>(&mut cx.storage.user(), KEY).await?;
            Ok(document::for_session(
                reply(current.doc.as_ref(), current.rev),
                session,
            ))
        }
        "PUT" => {
            let body = match cx.request.json::<Body>() {
                Ok(body) => body,
                Err(response) => return Ok(response),
            };
            let cards = match validate(body.cards, session.account.as_ref()) {
                Ok(cards) => cards,
                Err(message) => return Ok(Response::error(400, &message)),
            };
            if let Some(refused) = document::other_session(body.session.as_deref(), session) {
                return Ok(refused);
            }
            let saved =
                document::write(&mut cx.storage.user(), KEY, Some(body.rev), Some(&cards)).await?;
            Ok(document::answer(saved, Some(&cards), reply))
        }
        "DELETE" => {
            // The cards go first, then only the pictures the index named
            // before: a failed write leaves every picture, and a picture
            // uploaded meanwhile (under a name never used before) stays.
            let mut space = cx.storage.user();
            let (before, _) = read_index(&mut space).await?;
            let saved = document::write::<Vec<Card>>(&mut space, KEY, None, None).await?;
            forget_pictures(&mut space, &before).await?;
            Ok(document::answer(saved, None, reply))
        }
        _ => Ok(Response::method_not_allowed()),
    }
}

/// What a `GET` of the cards answers.
fn reply(cards: Option<&Vec<Card>>, rev: u64) -> serde_json::Value {
    serde_json::json!({ "cards": cards, "rev": rev })
}

/// The smart groups document.
async fn smart_groups(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let session = cx.session;
    match cx.request.method {
        "GET" => {
            let current =
                document::read::<Vec<SmartGroup>>(&mut cx.storage.user(), GROUPS_KEY).await?;
            Ok(document::for_session(
                groups_reply(current.doc.as_ref(), current.rev),
                session,
            ))
        }
        "PUT" => {
            let body = match cx.request.json::<GroupsBody>() {
                Ok(body) => body,
                Err(response) => return Ok(response),
            };
            let groups = match validate_groups(body.smart_groups) {
                Ok(groups) => groups,
                Err(message) => return Ok(Response::error(400, &message)),
            };
            if let Some(refused) = document::other_session(body.session.as_deref(), session) {
                return Ok(refused);
            }
            let saved = document::write(
                &mut cx.storage.user(),
                GROUPS_KEY,
                Some(body.rev),
                Some(&groups),
            )
            .await?;
            Ok(document::answer(saved, Some(&groups), groups_reply))
        }
        "DELETE" => {
            let saved =
                document::write::<Vec<SmartGroup>>(&mut cx.storage.user(), GROUPS_KEY, None, None)
                    .await?;
            Ok(document::answer(saved, None, groups_reply))
        }
        _ => Ok(Response::method_not_allowed()),
    }
}

/// What a `GET` of the smart groups answers.
fn groups_reply(groups: Option<&Vec<SmartGroup>>, rev: u64) -> serde_json::Value {
    serde_json::json!({ "smart_groups": groups, "rev": rev })
}

/// The document of the person's own groups.
async fn own_groups(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let session = cx.session;
    match cx.request.method {
        "GET" => {
            let current =
                document::read::<Vec<Group>>(&mut cx.storage.user(), OWN_GROUPS_KEY).await?;
            Ok(document::for_session(
                own_groups_reply(current.doc.as_ref(), current.rev),
                session,
            ))
        }
        "PUT" => {
            let body = match cx.request.json::<OwnGroupsBody>() {
                Ok(body) => body,
                Err(response) => return Ok(response),
            };
            let groups = match validate_own_groups(body.groups) {
                Ok(groups) => groups,
                Err(message) => return Ok(Response::error(400, &message)),
            };
            if let Some(refused) = document::other_session(body.session.as_deref(), session) {
                return Ok(refused);
            }
            let saved = document::write(
                &mut cx.storage.user(),
                OWN_GROUPS_KEY,
                Some(body.rev),
                Some(&groups),
            )
            .await?;
            Ok(document::answer(saved, Some(&groups), own_groups_reply))
        }
        "DELETE" => {
            let saved =
                document::write::<Vec<Group>>(&mut cx.storage.user(), OWN_GROUPS_KEY, None, None)
                    .await?;
            Ok(document::answer(saved, None, own_groups_reply))
        }
        _ => Ok(Response::method_not_allowed()),
    }
}

/// What a `GET` of the person's own groups answers.
fn own_groups_reply(groups: Option<&Vec<Group>>, rev: u64) -> serde_json::Value {
    serde_json::json!({ "groups": groups, "rev": rev })
}

fn picture_key(card: &str, version: &str) -> String {
    format!("pictures/{card}/{version}")
}

/// `PUT` or `DELETE` the picture of card `id`.
async fn picture(cx: &mut ApiCtx<'_>, id: &str) -> io::Result<Response> {
    if !document::valid_key(id) {
        return Ok(Response::error(
            400,
            "a card id is 1 to 128 letters, digits, -, _ or .",
        ));
    }
    match cx.request.method {
        "PUT" => {
            let picture = match cx.request.json::<Picture>() {
                Ok(picture) => picture,
                Err(response) => return Ok(response),
            };
            if !document::valid_key(&picture.version) || picture.version.len() > MAX_VERSION_CHARS {
                return Ok(Response::error(
                    400,
                    "a picture's version is 1 to 38 letters, digits, -, _ or .",
                ));
            }
            if !valid_image(&picture.image) {
                return Ok(Response::error(
                    400,
                    &format!(
                        "a picture is a JPEG or PNG as a data:image/jpeg;base64, or \
                         data:image/png;base64, URL of at most {MAX_IMAGE_CHARS} characters"
                    ),
                ));
            }
            let mut space = cx.storage.user();
            // Written under a name of its own, made here and never used again
            // (so a picture once named never changes); nobody shows it until
            // the index names it.
            let object = object_name(&picture.version)?;
            let key = picture_key(id, &object);
            let bytes = serde_json::to_vec(&picture)?;
            if !space.put_if_version(&key, &bytes, None).await? {
                return Ok(Response::error(503, "the picture could not be kept; retry"));
            }
            match index_set(&mut space, id, &object).await {
                Ok(true) => Ok(Response::json(
                    200,
                    &serde_json::json!({ "card": id, "version": picture.version }),
                )),
                Ok(false) => {
                    forget_key(&mut space, &key).await;
                    Ok(Response::error(
                        507,
                        &format!("An address book keeps at most {MAX_PICTURES} pictures."),
                    ))
                }
                // The index may have been written: the picture stays only if
                // the index names it.
                Err(error) => {
                    if let Ok((index, _)) = read_index(&mut space).await {
                        if index.get(id) != Some(&object) {
                            forget_key(&mut space, &key).await;
                        }
                    }
                    Err(error)
                }
            }
        }
        "DELETE" => {
            let only = cx.request.query_param("version").map(str::to_string);
            let mut space = cx.storage.user();
            index_remove(&mut space, id, only.as_deref()).await?;
            Ok(Response::json(200, &serde_json::json!({ "card": id })))
        }
        _ => Ok(Response::method_not_allowed()),
    }
}

/// `GET /pictures?ids=a,b`: the pictures of those cards that have one.
async fn read_pictures(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let raw = cx
        .request
        .query_param("ids")
        .unwrap_or("")
        .replace("%2C", ",")
        .replace("%2c", ",");
    let ids: Vec<&str> = raw.split(',').filter(|id| !id.is_empty()).collect();
    if ids.len() > PICTURES_PER_REQUEST {
        return Ok(Response::error(
            400,
            &format!("ask for at most {PICTURES_PER_REQUEST} pictures at a time"),
        ));
    }
    if let Some(bad) = ids.iter().find(|id| !document::valid_key(id)) {
        return Ok(Response::error(400, &format!("{bad:?} is not a card id")));
    }
    let mut space = cx.storage.user();
    let (index, _) = read_index(&mut space).await?;
    let mut found = serde_json::Map::new();
    for id in ids {
        let Some(version) = index.get(id) else {
            continue;
        };
        if let Some(picture) = space.get_json::<Picture>(&picture_key(id, version)).await? {
            found.insert(id.to_string(), serde_json::to_value(picture)?);
        }
    }
    Ok(Response::json(
        200,
        &serde_json::json!({ "pictures": found }),
    ))
}

/// The pictures kept: card id to the version stored.
type Index = BTreeMap<String, String>;

/// The picture index and its version.
async fn read_index(space: &mut Space<'_>) -> io::Result<(Index, Option<u64>)> {
    match space.get_versioned(PICTURE_INDEX).await? {
        None => Ok((Index::new(), None)),
        Some((bytes, version)) => Ok((
            serde_json::from_slice(&bytes).map_err(io::Error::other)?,
            Some(version),
        )),
    }
}

/// Delete a picture this request owns (no index names it). A failure leaves
/// it unnamed.
async fn forget_key(space: &mut Space<'_>, key: &str) {
    if let Err(error) = space.delete(key).await {
        ferrite_app::tracing::warn!(%error, "a picture no card names was left");
    }
}

/// Change the index by compare-and-set with `change`, which answers what
/// the change gives the caller and the pictures it took out of the index;
/// only once the change is written are those pictures deleted, by this
/// request alone.
async fn change_index<T, F>(space: &mut Space<'_>, mut change: F) -> io::Result<T>
where
    F: FnMut(&mut Index) -> IndexChange<T>,
{
    for _ in 0..ATTEMPTS {
        let (mut index, version) = read_index(space).await?;
        let (answer, dropped) = match change(&mut index) {
            IndexChange::Keep(answer) => return Ok(answer),
            IndexChange::Write(answer, dropped) => (answer, dropped),
        };
        let bytes = serde_json::to_vec(&index).map_err(io::Error::other)?;
        if space.put_if_version(PICTURE_INDEX, &bytes, version).await? {
            for (card, version) in dropped {
                if Some(version.as_str()) != index.get(&card).map(String::as_str) {
                    forget_key(space, &picture_key(&card, &version)).await;
                }
            }
            return Ok(answer);
        }
    }
    Err(io::Error::other("the pictures kept changing"))
}

/// What a change of the index does.
enum IndexChange<T> {
    /// Nothing to write.
    Keep(T),
    /// Write the index; then delete these pictures (card, version).
    Write(T, Vec<(String, String)>),
}

/// Make object `object` card `id`'s picture: `Ok(false)` when the index is
/// full. Nothing is pruned to make room: Contacts has no way to delete a
/// card, so a person has at most one picture per card ([`MAX_PICTURES`] is
/// [`MAX_CARDS`]); a list saved with fewer cards leaves their pictures
/// counted until the address book is forgotten (`DELETE /cards`).
async fn index_set(space: &mut Space<'_>, id: &str, object: &str) -> io::Result<bool> {
    change_index(space, |index| {
        if !index.contains_key(id) && index.len() >= MAX_PICTURES {
            return IndexChange::Keep(false);
        }
        let dropped = index
            .insert(id.to_string(), object.to_string())
            .map(|old| vec![(id.to_string(), old)])
            .unwrap_or_default();
        IndexChange::Write(true, dropped)
    })
    .await
}

/// A fresh object name for a picture of version `version`: the version, a
/// dot and 24 random hex digits (never made twice; the object is also
/// created only if absent).
fn object_name(version: &str) -> io::Result<String> {
    Ok(format!("{version}.{}", crate::crypto::random_token(12)?))
}

/// The version an object name holds.
fn object_version(object: &str) -> &str {
    object
        .rsplit_once('.')
        .map_or(object, |(version, _)| version)
}

/// Take card `id`'s picture out of the index (only version `only`, when
/// given) and delete it.
async fn index_remove(space: &mut Space<'_>, id: &str, only: Option<&str>) -> io::Result<()> {
    change_index(space, |index| match index.get(id) {
        Some(object) if only.is_none_or(|only| only == object_version(object)) => {
            let object = index.remove(id).unwrap_or_default();
            IndexChange::Write((), vec![(id.to_string(), object)])
        }
        _ => IndexChange::Keep(()),
    })
    .await
}

/// Take out of the index, and delete, the pictures it named in `before` and
/// still names.
async fn forget_pictures(space: &mut Space<'_>, before: &Index) -> io::Result<()> {
    change_index(space, |index| {
        let dropped: Vec<(String, String)> = before
            .iter()
            .filter(|(card, object)| index.get(*card) == Some(*object))
            .map(|(card, object)| (card.clone(), object.clone()))
            .collect();
        if dropped.is_empty() {
            return IndexChange::Keep(());
        }
        for (card, _) in &dropped {
            index.remove(card);
        }
        IndexChange::Write((), dropped)
    })
    .await
}

/// The people of the person's address book: Messages and Mail ask this.
async fn people(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let own = cx
        .session
        .account
        .as_ref()
        .map(|account| account.name.as_str());
    let current = document::read::<Vec<Card>>(&mut cx.storage.user(), KEY).await?;
    let cards = current.doc.unwrap_or_default();
    Ok(Response::json(
        200,
        &serde_json::json!({ "people": people_of(&cards, own) }),
    ))
}

/// One `{user, full_name}` per card that names a desktop user, other than
/// My Card and a card naming `own` (the person's own account), by full name.
pub fn people_of(cards: &[Card], own: Option<&str>) -> Vec<serde_json::Value> {
    let mut people: Vec<(String, &str)> = cards
        .iter()
        .filter(|card| card.me != Some(true))
        .filter_map(|card| {
            let user = card.user.as_deref()?;
            (Some(user) != own).then(|| (full_name_of(card, user), user))
        })
        .collect();
    people.sort_by(|(a, a_user), (b, b_user)| {
        a.to_lowercase()
            .cmp(&b.to_lowercase())
            .then_with(|| a.cmp(b))
            .then_with(|| a_user.cmp(b_user))
    });
    people
        .into_iter()
        .map(|(full_name, user)| serde_json::json!({ "user": user, "full_name": full_name }))
        .collect()
}

/// A card's full name: first and last, else the company, else the account.
fn full_name_of(card: &Card, user: &str) -> String {
    let person = format!("{} {}", card.first.trim(), card.last.trim())
        .trim()
        .to_string();
    if !person.is_empty() {
        return person;
    }
    match card.company.as_deref().map(str::trim) {
        Some(company) if !company.is_empty() => company.to_string(),
        _ => user.to_string(),
    }
}

/// `GET /me`: the signed-in account, which My Card is made from.
fn me(session: &Session) -> Response {
    match &session.account {
        Some(account) => Response::json(
            200,
            &serde_json::json!({
                "name": account.name,
                "full_name": account.full_name,
                "guest": account.guest,
            }),
        ),
        None => Response::json(200, &serde_json::json!({ "name": null })),
    }
}

/// `GET /users/<name>`: the account a card can be made for.
async fn user(cx: &mut ApiCtx<'_>, raw: &str) -> io::Result<Response> {
    if cx.session.account.is_none() {
        return Ok(Response::error(
            401,
            "Sign in to look up the people of this desktop.",
        ));
    }
    let Some(name) = crate::accounts::account_name(raw) else {
        return Ok(Response::error(
            400,
            "An account name is 1 to 32 lower-case letters, digits, “.”, “_” or “-”, \
             starting with a letter.",
        ));
    };
    match crate::accounts::lookup(cx.storage.store(), &name).await? {
        Some(found) => Ok(Response::json(
            200,
            &serde_json::json!({ "name": found.name, "full_name": found.full_name }),
        )),
        None => Ok(Response::error(
            404,
            &format!("No one on this desktop has the account name \u{201c}{name}\u{201d}."),
        )),
    }
}

/// Whether `url` is a picture this module keeps: a `data:` URL of a JPEG or
/// a PNG in standard base64, whose bytes start as that kind of file does,
/// of at most [`MAX_IMAGE_CHARS`] characters.
pub fn valid_image(url: &str) -> bool {
    if url.len() > MAX_IMAGE_CHARS {
        return false;
    }
    // The base64 of a JPEG's FF D8 FF and of a PNG's eight-byte signature.
    let (data, magic) = if let Some(data) = url.strip_prefix(JPEG) {
        (data, "/9j/")
    } else if let Some(data) = url.strip_prefix(PNG) {
        (data, "iVBORw0KGgo")
    } else {
        return false;
    };
    let body = data.trim_end_matches('=');
    data.len() % 4 == 0
        && data.len() - body.len() <= 2
        && data.starts_with(magic)
        && body
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'+' || b == b'/')
}

fn text(name: &str, value: &str, max: usize) -> Result<(), String> {
    if value.chars().count() > max {
        return Err(format!("{name} has at most {max} characters"));
    }
    Ok(())
}

fn optional(name: &str, value: &Option<String>, max: usize) -> Result<(), String> {
    value
        .as_deref()
        .map_or(Ok(()), |value| text(name, value, max))
}

fn fields(name: &str, list: &Option<Vec<Field>>) -> Result<(), String> {
    let Some(list) = list else { return Ok(()) };
    if list.len() > MAX_FIELDS {
        return Err(format!("a card has at most {MAX_FIELDS} {name}"));
    }
    for field in list {
        text("a field label", &field.label, MAX_TEXT_CHARS)?;
        text("a field value", &field.value, MAX_TEXT_CHARS)?;
        optional("a service", &field.service, MAX_TEXT_CHARS)?;
    }
    Ok(())
}

fn addresses(list: &Option<Vec<Address>>) -> Result<(), String> {
    let Some(list) = list else { return Ok(()) };
    if list.len() > MAX_FIELDS {
        return Err(format!("a card has at most {MAX_FIELDS} addresses"));
    }
    for address in list {
        text("a field label", &address.label, MAX_TEXT_CHARS)?;
        for part in [
            &address.street,
            &address.city,
            &address.state,
            &address.zip,
            &address.country,
        ] {
            text("an address", part, MAX_TEXT_CHARS)?;
        }
    }
    Ok(())
}

/// Check a submitted list. `account` is the signed-in account, whose name
/// is the only one My Card can carry.
fn validate(cards: Vec<Card>, account: Option<&Account>) -> Result<Vec<Card>, String> {
    if cards.len() > MAX_CARDS {
        return Err(format!("at most {MAX_CARDS} cards"));
    }
    let mut ids = BTreeSet::new();
    let mut users = BTreeSet::new();
    let mut mine = 0;
    for card in &cards {
        if !document::valid_key(&card.id) {
            return Err(format!(
                "card id {:?} is not a plain id of 1 to 128 characters",
                card.id
            ));
        }
        if !ids.insert(card.id.as_str()) {
            return Err(format!("card id {:?} is listed twice", card.id));
        }
        if !matches!(card.account.as_str(), "icloud" | "mac") {
            return Err(format!("{:?} is not an account", card.account));
        }
        if card
            .picture
            .as_deref()
            .is_some_and(|p| !matches!(p, "monogram" | "silhouette"))
        {
            return Err("a picture is \"monogram\" or \"silhouette\"".into());
        }
        text("a first name", &card.first, MAX_TEXT_CHARS)?;
        text("a last name", &card.last, MAX_TEXT_CHARS)?;
        optional("a company", &card.company, MAX_TEXT_CHARS)?;
        optional("a ringtone", &card.ringtone, MAX_TEXT_CHARS)?;
        optional("a text tone", &card.text_tone, MAX_TEXT_CHARS)?;
        optional("a birthday", &card.birthday, MAX_TEXT_CHARS)?;
        optional("a note", &card.note, MAX_NOTE_CHARS)?;
        optional("a phonetic name", &card.phonetic_first, MAX_TEXT_CHARS)?;
        optional("a phonetic name", &card.phonetic_last, MAX_TEXT_CHARS)?;
        optional("a nickname", &card.nickname, MAX_TEXT_CHARS)?;
        optional("a job title", &card.job_title, MAX_TEXT_CHARS)?;
        optional("a department", &card.department, MAX_TEXT_CHARS)?;
        fields("phones", &card.phones)?;
        fields("emails", &card.emails)?;
        fields("URLs", &card.urls)?;
        fields("IM names", &card.ims)?;
        fields("related names", &card.related_names)?;
        fields("dates", &card.dates)?;
        fields("social profiles", &card.socials)?;
        addresses(&card.addresses)?;
        if let Some(user) = &card.user {
            if crate::accounts::account_name(user).as_deref() != Some(user.as_str()) {
                return Err(format!(
                    "{user:?} is not an account name: 1 to 32 lower-case letters, digits, \
                     ., _ or -, starting with a letter"
                ));
            }
            if !users.insert(user.as_str()) {
                return Err(format!("the account {user:?} is on two cards"));
            }
            if card.me == Some(true) && account.map(|a| a.name.as_str()) != Some(user.as_str()) {
                return Err("My Card can name only the signed-in account".into());
            }
        }
        if card.image.as_deref().is_some_and(|version| {
            !document::valid_key(version) || version.len() > MAX_VERSION_CHARS
        }) {
            return Err("a card's image is the version of its picture, a plain id".into());
        }
        if card.me == Some(true) {
            mine += 1;
        }
    }
    if mine > 1 {
        return Err("only one card can be the user's own".into());
    }
    Ok(cards)
}

/// Check a submitted list of smart groups.
fn validate_groups(groups: Vec<SmartGroup>) -> Result<Vec<SmartGroup>, String> {
    if groups.len() > MAX_SMART_GROUPS {
        return Err(format!("at most {MAX_SMART_GROUPS} smart groups"));
    }
    let mut ids = BTreeSet::new();
    for group in &groups {
        if !document::valid_key(&group.id) {
            return Err(format!("{:?} is not a plain id", group.id));
        }
        if !ids.insert(group.id.as_str()) {
            return Err(format!("smart group id {:?} is listed twice", group.id));
        }
        if group.name.trim().is_empty() {
            return Err("a smart group has a name".into());
        }
        text("a smart group's name", &group.name, MAX_GROUP_NAME_CHARS)?;
        let words = group.text.as_deref().map(str::trim);
        if group.rule != "rules" && (group.conditions.is_some() || group.any.is_some()) {
            return Err("only the rules rule takes conditions".into());
        }
        match (group.rule.as_str(), words) {
            ("desktop-user", None) => {}
            ("desktop-user", Some(_)) => {
                return Err("the desktop-user rule takes no text".into());
            }
            ("contains", Some(words)) if !words.is_empty() => {
                optional("a smart group's text", &group.text, MAX_TEXT_CHARS)?;
            }
            ("contains", _) => return Err("the contains rule needs its text".into()),
            ("rules", None) => validate_conditions(group.conditions.as_deref().unwrap_or(&[]))?,
            ("rules", Some(_)) => return Err("the rules rule takes no text".into()),
            (rule, _) => {
                return Err(format!(
                    "{rule:?} is not a rule: \"desktop-user\", \"contains\" or \"rules\""
                ));
            }
        }
    }
    Ok(groups)
}

/// Check the conditions of a smart group's rule builder.
fn validate_conditions(conditions: &[SmartCondition]) -> Result<(), String> {
    if conditions.is_empty() || conditions.len() > MAX_SMART_CONDITIONS {
        return Err(format!(
            "a smart group has 1 to {MAX_SMART_CONDITIONS} conditions"
        ));
    }
    for condition in conditions {
        if condition.field == "user" {
            if !matches!(condition.test.as_str(), "yes" | "no") || !condition.value.is_empty() {
                return Err("the desktop user condition is yes or no, with no text".into());
            }
            continue;
        }
        if !SMART_CONDITION_FIELDS.contains(&condition.field.as_str()) {
            return Err(format!("{:?} is not a condition's field", condition.field));
        }
        if !matches!(
            condition.test.as_str(),
            "contains" | "lacks" | "is" | "begins" | "ends"
        ) {
            return Err(format!("{:?} is not a condition's test", condition.test));
        }
        if condition.value.trim().is_empty() {
            return Err("a condition needs its text".into());
        }
        text("a condition's text", &condition.value, MAX_TEXT_CHARS)?;
    }
    Ok(())
}

/// Check a submitted list of the person's own groups.
fn validate_own_groups(groups: Vec<Group>) -> Result<Vec<Group>, String> {
    if groups.len() > MAX_GROUPS {
        return Err(format!("at most {MAX_GROUPS} groups"));
    }
    let mut ids = BTreeSet::new();
    for group in &groups {
        if !document::valid_key(&group.id) {
            return Err(format!("{:?} is not a plain id", group.id));
        }
        if !ids.insert(group.id.as_str()) {
            return Err(format!("group id {:?} is listed twice", group.id));
        }
        if group.name.trim().is_empty() {
            return Err("a group has a name".into());
        }
        text("a group's name", &group.name, MAX_GROUP_NAME_CHARS)?;
        if group.members.len() > MAX_CARDS {
            return Err(format!("a group has at most {MAX_CARDS} cards"));
        }
        let mut members = BTreeSet::new();
        for member in &group.members {
            if !document::valid_key(member) {
                return Err(format!("{member:?} is not a card's id"));
            }
            if !members.insert(member.as_str()) {
                return Err(format!("card {member:?} is in the group twice"));
            }
        }
    }
    let size = serde_json::to_vec(&groups).map_or(usize::MAX, |bytes| bytes.len());
    if size > MAX_GROUPS_BYTES {
        return Err("The groups hold too many cards to keep. Take some out of them.".into());
    }
    Ok(groups)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn card(id: &str) -> Card {
        serde_json::from_value(serde_json::json!({
            "id": id, "account": "icloud", "first": "Ada", "last": "Lovelace",
            "emails": [{ "label": "work", "value": "ada@example.com" }],
        }))
        .unwrap()
    }

    fn chris() -> Account {
        Account {
            id: "u-1".into(),
            name: "chris".into(),
            full_name: "Chris Carter".into(),
            guest: false,
            generation: 0,
        }
    }

    fn group(id: &str, rule: &str, text: Option<&str>) -> SmartGroup {
        SmartGroup {
            id: id.into(),
            name: "Friends".into(),
            rule: rule.into(),
            text: text.map(str::to_string),
            conditions: None,
            any: None,
        }
    }

    #[test]
    fn a_smart_group_of_rules_holds_real_conditions_only() {
        let condition = |field: &str, test: &str, value: &str| SmartCondition {
            field: field.into(),
            test: test.into(),
            value: value.into(),
        };
        let rules = |conditions: Vec<SmartCondition>| SmartGroup {
            conditions: Some(conditions),
            ..group("a", "rules", None)
        };
        assert!(validate_groups(vec![rules(vec![
            condition("company", "contains", "Apple"),
            condition("user", "no", ""),
        ])])
        .is_ok());
        for bad in [
            rules(vec![]),
            rules(vec![condition("size", "contains", "x")]),
            rules(vec![condition("company", "matches", "x")]),
            rules(vec![condition("company", "contains", "  ")]),
            rules(vec![condition("user", "contains", "x")]),
            rules(vec![condition("user", "yes", "x")]),
            rules(vec![condition("note", "is", "x"); MAX_SMART_CONDITIONS + 1]),
            group("a", "rules", None),
            SmartGroup {
                any: Some(true),
                ..group("a", "desktop-user", None)
            },
        ] {
            assert!(validate_groups(vec![bad.clone()]).is_err(), "{bad:?}");
        }
    }

    #[test]
    fn a_card_round_trips_in_the_demo_s_shape() {
        let text = r#"{"id":"stephen-hackett","account":"icloud","first":"Stephen","last":"Hackett","me":true,"picture":"monogram","phones":[{"label":"mobile","value":"(555) 010-0000"}],"ims":[{"label":"home","value":"stephen","service":"AIM"}],"textTone":"Note","isCompany":false,"user":"stephen","image":"p-1"}"#;
        let parsed: Card = serde_json::from_str(text).unwrap();
        assert_eq!(parsed.text_tone.as_deref(), Some("Note"));
        assert_eq!(parsed.user.as_deref(), Some("stephen"));
        let again: serde_json::Value = serde_json::to_value(&parsed).unwrap();
        assert_eq!(
            again,
            serde_json::from_str::<serde_json::Value>(text).unwrap()
        );
    }

    #[test]
    fn bad_cards_are_refused() {
        assert!(validate(vec![card("a"), card("b")], None).is_ok());
        assert!(
            validate(vec![card("a"), card("a")], None).is_err(),
            "duplicate id"
        );
        let mut other = card("a");
        other.account = "exchange".into();
        assert!(validate(vec![other], None).is_err(), "unknown account");
        let mut long = card("a");
        long.first = "x".repeat(MAX_TEXT_CHARS + 1);
        assert!(validate(vec![long], None).is_err(), "long name");
        let mut crowded = card("a");
        crowded.phones = Some(vec![
            Field {
                label: "home".into(),
                value: "1".into(),
                service: None,
                private: None,
            };
            MAX_FIELDS + 1
        ]);
        assert!(validate(vec![crowded], None).is_err(), "too many phones");
        let (mut one, mut two) = (card("a"), card("b"));
        one.me = Some(true);
        two.me = Some(true);
        assert!(
            validate(vec![one, two], None).is_err(),
            "two cards of the user's own"
        );
        assert!(
            serde_json::from_str::<Card>(
                r#"{"id":"a","account":"mac","first":"","last":"","photo":"x"}"#
            )
            .is_err(),
            "unknown fields are refused"
        );
    }

    #[test]
    fn a_card_names_a_desktop_user_once_and_my_card_only_its_own() {
        let mut martin = card("m");
        martin.user = Some("martin".into());
        let mut mine = card("me");
        mine.me = Some(true);
        mine.user = Some("chris".into());
        assert!(validate(vec![martin.clone(), mine.clone()], Some(&chris())).is_ok());

        for bad in ["Martin", "", "9lives", "mar tin", &"m".repeat(33)] {
            let mut named = card("x");
            named.user = Some(bad.into());
            assert!(validate(vec![named], Some(&chris())).is_err(), "{bad:?}");
        }
        let mut again = card("m2");
        again.user = Some("martin".into());
        assert!(
            validate(vec![martin, again], Some(&chris())).is_err(),
            "one card per desktop user"
        );
        assert!(
            validate(vec![mine.clone()], None).is_err(),
            "My Card names no account before anyone signs in"
        );
        mine.user = Some("martin".into());
        assert!(
            validate(vec![mine], Some(&chris())).is_err(),
            "My Card names only the signed-in account"
        );
        let mut pictured = card("p");
        pictured.image = Some("v1".into());
        assert!(validate(vec![pictured.clone()], None).is_ok());
        pictured.image = Some("data:image/png;base64,AAAA".into());
        assert!(
            validate(vec![pictured], None).is_err(),
            "the picture itself is not in the card"
        );
    }

    #[test]
    fn picture_objects_are_never_named_twice() {
        let a = object_name("p-1.2").unwrap();
        let b = object_name("p-1.2").unwrap();
        assert_eq!(object_version(&a), "p-1.2");
        assert_ne!(a, b, "96 random bits each");
        let longest = format!(
            "{}{}",
            "v".repeat(MAX_VERSION_CHARS),
            object_name("").unwrap()
        );
        // A full index of the longest names stays within one stored value.
        assert!(MAX_PICTURES * (128 + longest.len() + 6) < 200 * 1024);
    }

    #[test]
    fn a_picture_is_a_small_jpeg_or_png_data_url() {
        assert!(valid_image("data:image/jpeg;base64,/9j/4AAQSkZJRg=="));
        assert!(valid_image(
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE="
        ));
        for bad in [
            "",
            "data:image/gif;base64,R0lGODlh",
            "data:image/jpeg,/9j/4AAQ",
            "data:image/jpeg;base64,iVBORw0KGgoAAAAN",
            "data:image/png;base64,/9j/4AAQ",
            "data:image/jpeg;base64,/9j/4AA",
            "data:image/jpeg;base64,/9j/4A==A===",
            "data:image/jpeg;base64,/9j/4A A=",
            "https://example.com/a.jpg",
        ] {
            assert!(!valid_image(bad), "{bad:?}");
        }
        // The longest base64 that fits: its length a multiple of four.
        let room = (MAX_IMAGE_CHARS - JPEG.len()) / 4 * 4;
        let fits = format!("{JPEG}/9j/{}", "A".repeat(room - 4));
        assert!(fits.len() <= MAX_IMAGE_CHARS && fits.len() + 4 > MAX_IMAGE_CHARS);
        assert!(valid_image(&fits), "the longest picture that fits");
        let over = format!("{fits}AAAA");
        assert!(!valid_image(&over), "over the cap");
    }

    #[test]
    fn smart_groups_are_checked() {
        assert!(validate_groups(vec![
            group("a", "desktop-user", None),
            group("b", "contains", Some("ferry")),
        ])
        .is_ok());
        for bad in [
            vec![group("a", "contains", None)],
            vec![group("a", "contains", Some("  "))],
            vec![group("a", "desktop-user", Some("x"))],
            vec![group("a", "everyone", None)],
            vec![group("a/b", "desktop-user", None)],
            vec![
                group("a", "desktop-user", None),
                group("a", "desktop-user", None),
            ],
            vec![group(
                "a",
                "contains",
                Some(&"x".repeat(MAX_TEXT_CHARS + 1)),
            )],
        ] {
            assert!(validate_groups(bad.clone()).is_err(), "{bad:?}");
        }
        let mut nameless = group("a", "desktop-user", None);
        nameless.name = " ".into();
        assert!(validate_groups(vec![nameless]).is_err());
        let many: Vec<SmartGroup> = (0..=MAX_SMART_GROUPS)
            .map(|n| group(&format!("g{n}"), "desktop-user", None))
            .collect();
        assert!(validate_groups(many).is_err());
    }

    #[test]
    fn own_groups_are_checked() {
        let group = |id: &str, name: &str, members: &[&str]| Group {
            id: id.into(),
            name: name.into(),
            members: members.iter().map(|each| each.to_string()).collect(),
        };
        assert!(validate_own_groups(vec![
            group("a", "Ferry", &["c-1", "c-2"]),
            group("b", "Empty", &[]),
        ])
        .is_ok());
        for bad in [
            vec![group("a/b", "Ferry", &[])],
            vec![group("a", "Ferry", &[]), group("a", "Other", &[])],
            vec![group("a", " ", &[])],
            vec![group("a", &"x".repeat(MAX_GROUP_NAME_CHARS + 1), &[])],
            vec![group("a", "Ferry", &["c/1"])],
            vec![group("a", "Ferry", &["c-1", "c-1"])],
        ] {
            assert!(validate_own_groups(bad.clone()).is_err(), "{bad:?}");
        }
        let many: Vec<Group> = (0..=MAX_GROUPS)
            .map(|n| group(&format!("g{n}"), "Ferry", &[]))
            .collect();
        assert!(validate_own_groups(many).is_err());
        let id = "c".repeat(100);
        let full: Vec<String> = (0..MAX_CARDS).map(|n| format!("{id}{n}")).collect();
        let huge = Group {
            id: "big".into(),
            name: "Big".into(),
            members: full,
        };
        let two = Group {
            id: "big2".into(),
            ..huge.clone()
        };
        assert!(
            validate_own_groups(vec![huge, two]).is_err(),
            "over the size"
        );
    }

    #[test]
    fn a_card_keeps_its_added_fields_and_bounds_them() {
        let text = r#"{"id":"a","account":"icloud","first":"A","last":"B","nickname":"Bee","jobTitle":"Skipper","department":"Ferries","phoneticFirst":"Ay","phoneticLast":"Bee","relatedNames":[{"label":"mother","value":"C"}],"dates":[{"label":"anniversary","value":"1/2/2020"}],"socials":[{"label":"Twitter","value":"ab"}],"addresses":[{"label":"home","street":"1 Quay","city":"Port","state":"ME","zip":"04101","country":"USA"}]}"#;
        let parsed: Card = serde_json::from_str(text).unwrap();
        assert_eq!(
            serde_json::to_value(&parsed).unwrap(),
            serde_json::from_str::<serde_json::Value>(text).unwrap()
        );
        assert!(validate(vec![parsed.clone()], None).is_ok());
        let mut long = parsed.clone();
        long.nickname = Some("x".repeat(MAX_TEXT_CHARS + 1));
        assert!(validate(vec![long], None).is_err());
        let mut far = parsed;
        far.addresses.as_mut().unwrap()[0].city = "x".repeat(MAX_TEXT_CHARS + 1);
        assert!(validate(vec![far], None).is_err());
    }

    #[test]
    fn people_are_the_desktop_users_of_the_cards_by_full_name() {
        let named = |id: &str, first: &str, last: &str, user: Option<&str>| {
            let mut card = card(id);
            card.first = first.into();
            card.last = last.into();
            card.user = user.map(str::to_string);
            card
        };
        let mut mine = named("me", "Chris", "Carter", Some("chris"));
        mine.me = Some(true);
        let mut company = named("c", "", "", Some("desk"));
        company.company = Some("Island Post".into());
        let cards = vec![
            named("z", "martin", "Klein", Some("martin")),
            mine,
            named("a", "Ana", "Other", Some("ana")),
            named("x", "Not", "A User", None),
            company,
            named("n", "", "", Some("nameless")),
            named("self", "Chris", "Again", Some("chris")),
        ];
        let people = people_of(&cards, Some("chris"));
        assert_eq!(
            serde_json::Value::Array(people),
            serde_json::json!([
                { "user": "ana", "full_name": "Ana Other" },
                { "user": "desk", "full_name": "Island Post" },
                { "user": "martin", "full_name": "martin Klein" },
                { "user": "nameless", "full_name": "nameless" },
            ])
        );
        assert!(people_of(&[], Some("chris")).is_empty());
    }
}

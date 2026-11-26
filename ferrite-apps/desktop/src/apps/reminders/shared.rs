//! Lists shared between accounts.
//!
//! A signed-in account (not a Guest User) shares one of its own lists with
//! other accounts by exact account name. The list leaves the owner's own
//! document and becomes a document of its own in the module's shared space,
//! with its own revision, which everyone on it reads and writes; each person
//! keeps an index entry for each shared list they are on.
//!
//! * `lists/<id>`: the [`SharedDoc`]: the owner, the other people on it, the
//!   list and its reminders, and the revision;
//! * `members/<account>/<id>`: one per person on the list, the owner among
//!   them, so a person's lists are found without reading anyone else's. It
//!   holds when it was written (epoch ms): it is written before the change that
//!   puts the person on the list, so for a moment it may name a list that does
//!   not (yet) name them; an add or share that does not go through takes it
//!   back, and a read deletes one whose list does not name its person once it
//!   is [`STRAY_AFTER_MS`] old.
//!
//! Routes, all `/api/reminders/shared...`:
//!
//! * `GET /shared`: `{"lists": [...], "can_share": bool, "me": name}`, each
//!   list `{id, rev, name, color, owner, members, owned, reminders}` with
//!   people as `{name, full_name}`; account ids never reach a browser.
//! * `POST /shared` with `{"list", "people": [names]}`: shares one of the
//!   person's own lists; `{"id", "rev"}` (the new revision of the person's
//!   own document, which no longer holds the list).
//! * `PUT /shared/<id>` with `{"base", "data": {"lists": [list], "reminders"}}`:
//!   as the person's own document, on the list's revision: 409 with `{"rev"}`
//!   when `base` is not it.
//! * `POST /shared/<id>/people` with `{"name"}` (the owner adds someone),
//!   `DELETE /shared/<id>/people/<name>` (the owner takes someone off),
//!   `POST /shared/<id>/leave` (anyone on it leaves; when the owner leaves,
//!   the next person on it owns it, and a list nobody else is on goes back to
//!   the owner's own lists), and `POST /shared/<id>/stop` (the owner stops
//!   sharing: the list goes back to the owner's own lists and leaves everyone
//!   else's).
//!
//! Every route answers 404 to someone who is not on the list, and every
//! change is a compare-and-set on the list's document that checks, in the
//! same write, that the person is still on it. Reminders of a shared list
//! raise no alerts. At most [`MAX_PEOPLE`] people besides the owner are on a
//! list, a person is on at most [`MAX_LISTS_PER_PERSON`] shared lists, and a
//! shared list holds at most [`MAX_SHARED_REMINDERS`] reminders.

use std::collections::{BTreeMap, BTreeSet};
use std::io;

use ferrite_app::{serde, serde_json};

use super::{is_id, validate, Data, List, Reminder, CAS_ATTEMPTS, DATA_KEY};
use crate::apps::document;
use crate::apps::notification_center::{self, Notification};
use crate::http::Response;
use crate::module::ApiCtx;
use crate::session::Account;

const APP: &str = "reminders";
/// The most people on a shared list besides its owner.
pub const MAX_PEOPLE: usize = 20;
/// The most shared lists one person is on.
pub const MAX_LISTS_PER_PERSON: usize = 20;
/// The most reminders of one shared list.
pub const MAX_SHARED_REMINDERS: usize = 500;
/// The largest own document a list taken back may leave: under the 256 KiB a
/// request body may hold, so the person's browser can still save it.
const MAX_OWN_BYTES: usize = 240 * 1024;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Person {
    pub id: String,
    pub name: String,
    pub full_name: String,
}

/// One shared list.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct SharedDoc {
    pub rev: u64,
    pub owner: Person,
    /// Everyone on it but its owner, in the order they were added.
    pub members: Vec<Person>,
    pub list: List,
    pub reminders: Vec<Reminder>,
    /// Sharing stopped: the list is back in its owner's own document, and
    /// this one stands for nothing until it is deleted.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub stopped: bool,
}

impl SharedDoc {
    fn has(&self, id: &str) -> bool {
        self.owner.id == id || self.members.iter().any(|person| person.id == id)
    }

    fn everyone(&self) -> impl Iterator<Item = &Person> {
        std::iter::once(&self.owner).chain(&self.members)
    }
}

/// The person's own document as it is stored (`mod.rs`): read and written whole.
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Own {
    rev: u64,
    data: Data,
    alerts: BTreeMap<String, u64>,
    /// The writes that named themselves (`document.rs`), kept through every write here.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    writes: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    writes_from: Option<u64>,
}

fn doc_key(id: &str) -> String {
    format!("lists/{id}")
}

fn index_key(person: &str, id: &str) -> String {
    format!("members/{person}/{id}")
}

fn data_error(e: serde_json::Error) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, e.to_string())
}

fn person(account: &Account) -> Person {
    Person {
        id: account.id.clone(),
        name: account.name.clone(),
        full_name: account.full_name.clone(),
    }
}

/// The account that may share and be shared with: signed in, not a Guest User.
fn sharer(cx: &ApiCtx<'_>) -> Option<Account> {
    cx.session.account.clone().filter(|account| !account.guest)
}

fn missing() -> Response {
    Response::error(404, "There is no such shared list.")
}

fn view(doc: &SharedDoc, me: &str) -> serde_json::Value {
    let people = |list: &mut dyn Iterator<Item = &Person>| -> Vec<serde_json::Value> {
        list.map(|person| serde_json::json!({ "name": person.name, "full_name": person.full_name }))
            .collect()
    };
    serde_json::json!({
        "id": doc.list.id,
        "rev": doc.rev,
        "name": doc.list.name,
        "color": doc.list.color,
        "owner": { "name": doc.owner.name, "full_name": doc.owner.full_name },
        "members": people(&mut doc.members.iter()),
        "owned": doc.owner.id == me,
        "reminders": doc.reminders,
    })
}

/// The shared list `id` and its store version, or `None` when there is none
/// (or sharing it stopped).
async fn read(cx: &mut ApiCtx<'_>, id: &str) -> io::Result<Option<(SharedDoc, u64)>> {
    match cx.storage.shared().get_versioned(&doc_key(id)).await? {
        None => Ok(None),
        Some((bytes, version)) => {
            let doc: SharedDoc = serde_json::from_slice(&bytes).map_err(data_error)?;
            Ok((!doc.stopped).then_some((doc, version)))
        }
    }
}

/// Write `doc` over store version `version`; `false` when another write got in first.
async fn write(cx: &mut ApiCtx<'_>, doc: &SharedDoc, version: u64) -> io::Result<bool> {
    let bytes = serde_json::to_vec(doc).map_err(data_error)?;
    cx.storage
        .shared()
        .put_if_version(&doc_key(&doc.list.id), &bytes, Some(version))
        .await
}

/// The most index entries a read of a person's lists looks at: those of
/// lists they are on, and any left by a change cut short.
const MAX_INDEX: usize = 64;

/// How long an index entry whose list does not name its person may belong to
/// an add still under way (an add writes the entry before the change that
/// names them). Older, it is one an add that did not go through left behind,
/// and a read deletes it.
pub const STRAY_AFTER_MS: u64 = 60_000;

/// What an index entry holds: when it was written (epoch ms).
fn index_value(now_ms: u64) -> Vec<u8> {
    now_ms.to_string().into_bytes()
}

/// Whether an index entry holding `value` is past belonging to an add under
/// way at `now_ms`. An earlier build wrote `1`, which reads as long ago.
fn stale(value: &[u8], now_ms: u64) -> bool {
    std::str::from_utf8(value)
        .ok()
        .and_then(|text| text.trim().parse::<u64>().ok())
        .map_or(true, |at| now_ms.saturating_sub(at) >= STRAY_AFTER_MS)
}

/// The shared lists `person` is on, read in one call. An index entry is
/// written before the change that puts the person on a list, so an entry
/// whose list does not (yet) name them is passed over, not counted, and is
/// deleted once it is too old to belong to an add under way; one whose list is
/// gone, or was stopped, is deleted on the way.
async fn lists_of(cx: &mut ApiCtx<'_>, person: &str) -> io::Result<Vec<SharedDoc>> {
    let prefix = format!("members/{person}/");
    let entries: Vec<(String, Vec<u8>)> = cx
        .storage
        .shared()
        .list(&prefix, MAX_INDEX)
        .await?
        .into_iter()
        .filter_map(|(key, value)| key.strip_prefix(&prefix).map(|id| (id.to_string(), value)))
        .collect();
    let keys: Vec<String> = entries.iter().map(|(id, _)| doc_key(id)).collect();
    let read = cx.storage.shared().get_many(&keys).await?;
    let now = cx.now_ms;
    let mut out = Vec::new();
    for ((id, written), bytes) in entries.iter().zip(read) {
        match bytes.map(|bytes| serde_json::from_slice::<SharedDoc>(&bytes)) {
            None | Some(Ok(SharedDoc { stopped: true, .. })) => {
                cx.storage.shared().delete(&index_key(person, id)).await?;
            }
            Some(Ok(doc)) if doc.has(person) => out.push(doc),
            // Not on it, and too old for an add under way: left behind by one that did not
            // go through.
            Some(Ok(_)) if stale(written, now) => {
                forget_unless_on(cx, id, person).await?;
            }
            // Not (yet) on it, or a list this build cannot read: left alone.
            Some(_) => {}
        }
    }
    Ok(out)
}

/// Delete `person`'s index entry for the list `id` unless the list names them:
/// what an add that did not go through takes back, and what a read clears of
/// one left behind.
///
/// The store has no delete that holds only while the entry is unchanged, so
/// the list is read again after the delete, and the entry put back if the list
/// names the person by then. With a successful add writing its entry again
/// once its change has landed, no order of the two loses a member's entry:
/// should this delete come before that write, the write puts it back; should
/// it come after, the add's change landed before it, the second read sees the
/// person on the list, and the entry is put back here. At worst an entry
/// stays for someone taken off meanwhile, which a later read clears.
async fn forget_unless_on(cx: &mut ApiCtx<'_>, id: &str, person: &str) -> io::Result<()> {
    if on_list(cx, id, person).await? {
        return Ok(());
    }
    cx.storage.shared().delete(&index_key(person, id)).await?;
    if on_list(cx, id, person).await? {
        cx.storage
            .shared()
            .put(&index_key(person, id), &index_value(cx.now_ms))
            .await?;
    }
    Ok(())
}

/// Whether the shared list `id` names `person`.
async fn on_list(cx: &mut ApiCtx<'_>, id: &str, person: &str) -> io::Result<bool> {
    Ok(read(cx, id).await?.is_some_and(|(doc, _)| doc.has(person)))
}

/// Tell the people's open Reminders windows to read again. A failure only
/// delays that to their next read.
async fn touch<'p>(cx: &mut ApiCtx<'_>, people: impl IntoIterator<Item = &'p Person>) {
    let by = cx.session.id.clone();
    for person in people {
        if let Err(error) =
            notification_center::touched(cx.storage.store(), &person.id, APP, &by, cx.now_ms).await
        {
            ferrite_app::tracing::warn!(%error, "a person's change count not moved");
        }
    }
}

async fn tell(cx: &mut ApiCtx<'_>, to: &Person, id: String, title: String, body: &str) {
    let note = Notification {
        app: APP.into(),
        id,
        title,
        subtitle: None,
        body: Some(body.to_string()),
        alert: false,
        dismiss: None,
        actions: Vec::new(),
    };
    if let Err(error) =
        notification_center::notify(cx.storage.store(), &to.id, cx.now_ms, &note).await
    {
        ferrite_app::tracing::warn!(%error, "a shared list's notification not delivered");
    }
}

/// The account a person names to share with, or the response refusing it:
/// one that exists, is not `me`, is not already on `doc`, and has room for
/// another shared list.
async fn invitee(
    cx: &mut ApiCtx<'_>,
    raw: &str,
    me: &Account,
    doc: Option<&SharedDoc>,
) -> io::Result<Result<Person, Response>> {
    let Some(name) = crate::accounts::account_name(raw) else {
        return Ok(Err(Response::error(
            400,
            &format!("{raw:?} is not an account name."),
        )));
    };
    if name == me.name {
        return Ok(Err(Response::error(400, "You are on the list already.")));
    }
    let Some(found) = crate::accounts::lookup(cx.storage.store(), &name).await? else {
        return Ok(Err(Response::error(
            400,
            &format!("No one on this desktop has the account name \u{201c}{name}\u{201d}."),
        )));
    };
    if doc.is_some_and(|doc| doc.has(&found.id)) {
        return Ok(Err(Response::error(
            409,
            &format!("\u{201c}{name}\u{201d} is on the list already."),
        )));
    }
    if lists_of(cx, &found.id).await?.len() >= MAX_LISTS_PER_PERSON {
        return Ok(Err(Response::error(
            409,
            &format!("\u{201c}{name}\u{201d} is on too many shared lists to join another."),
        )));
    }
    Ok(Ok(person(&found)))
}

/// `GET /shared`.
pub async fn lists(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let Some(me) = sharer(cx) else {
        return Ok(Response::json(
            200,
            &serde_json::json!({ "lists": [], "can_share": false, "me": null }),
        ));
    };
    let out: Vec<serde_json::Value> = lists_of(cx, &me.id)
        .await?
        .iter()
        .take(MAX_LISTS_PER_PERSON)
        .map(|doc| view(doc, &me.id))
        .collect();
    Ok(Response::json(
        200,
        &serde_json::json!({ "lists": out, "can_share": true, "me": me.name }),
    ))
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Share {
    list: String,
    people: Vec<String>,
}

/// `POST /shared`: share one of the person's own lists.
pub async fn share(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let body: Share = match cx.request.json() {
        Ok(body) => body,
        Err(response) => return Ok(response),
    };
    let Some(me) = sharer(cx) else {
        return Ok(Response::error(
            403,
            "Sign in to an account to share a list.",
        ));
    };
    let names: BTreeSet<String> = body
        .people
        .iter()
        .filter_map(|raw| crate::accounts::account_name(raw))
        .collect();
    if names.is_empty() || names.len() != body.people.len() || names.len() > MAX_PEOPLE {
        return Ok(Response::error(
            400,
            &format!("Share a list with 1 to {MAX_PEOPLE} account names, each once."),
        ));
    }
    if lists_of(cx, &me.id).await?.len() >= MAX_LISTS_PER_PERSON {
        return Ok(Response::error(
            409,
            &format!("You are on {MAX_LISTS_PER_PERSON} shared lists already."),
        ));
    }
    let mut members = Vec::new();
    for name in &names {
        match invitee(cx, name, &me, None).await? {
            Ok(found) => members.push(found),
            Err(refused) => return Ok(refused),
        }
    }
    let id = format!("sh-{}", crate::crypto::random::random_token(12)?);
    let owner = person(&me);
    let everyone: Vec<Person> = std::iter::once(owner.clone())
        .chain(members.iter().cloned())
        .collect();
    // A move stopped short of the owner's document takes back what it wrote of the shared
    // list: on a refusal or lists that kept changing at once; after a failure whose outcome
    // is not known, only while the owner's own lists still hold the list (never in neither).
    let (doc, rev) = match move_to_shared(cx, &body.list, &id, &owner, &members).await {
        Ok(Ok(moved)) => moved,
        Ok(Err(refused)) => {
            forget_share(cx, &id, &everyone).await?;
            return Ok(refused);
        }
        Err(error) => {
            let held = cx
                .storage
                .user()
                .get_json::<Own>(DATA_KEY)
                .await
                .ok()
                .flatten()
                .is_some_and(|own| own.data.lists.iter().any(|list| list.id == body.list));
            if held {
                if let Err(also) = forget_share(cx, &id, &everyone).await {
                    ferrite_app::tracing::warn!(%also, "a share cut short left its copy");
                }
            }
            return Err(error);
        }
    };
    for member in doc.members.clone() {
        tell(
            cx,
            &member,
            format!("share-{id}"),
            format!("{} shared a list with you", owner.full_name),
            &doc.list.name,
        )
        .await;
    }
    touch(cx, &doc.members.clone()).await;
    Ok(Response::json(
        201,
        &serde_json::json!({ "id": id, "rev": rev, "list": view(&doc, &me.id) }),
    ))
}

/// Move the person's own list `list_id` into the new shared list `id`: the
/// shared document and everyone's index entries first, then the owner's own
/// document without the list, under its compare-and-set. The shared document
/// and the owner's new revision, or the response refusing the move (no such
/// list, too many reminders, or lists that kept changing). What it wrote is
/// the caller's to take back when the move did not go through.
async fn move_to_shared(
    cx: &mut ApiCtx<'_>,
    list_id: &str,
    id: &str,
    owner: &Person,
    members: &[Person],
) -> io::Result<Result<(SharedDoc, u64), Response>> {
    for _ in 0..CAS_ATTEMPTS {
        let Some((bytes, version)) = cx.storage.user().get_versioned(DATA_KEY).await? else {
            return Ok(Err(Response::error(404, "There is no such list.")));
        };
        let mut own: Own = serde_json::from_slice(&bytes).map_err(data_error)?;
        let Some(at) = own.data.lists.iter().position(|list| list.id == list_id) else {
            return Ok(Err(Response::error(404, "There is no such list.")));
        };
        let mut list = own.data.lists.remove(at);
        let (moving, staying): (Vec<Reminder>, Vec<Reminder>) = own
            .data
            .reminders
            .into_iter()
            .partition(|reminder| reminder.list_id == list_id);
        if moving.len() > MAX_SHARED_REMINDERS {
            return Ok(Err(Response::error(
                409,
                &format!("A shared list holds at most {MAX_SHARED_REMINDERS} reminders."),
            )));
        }
        for reminder in &moving {
            own.alerts.remove(&reminder.id);
        }
        own.data.reminders = staying;
        (own.writes, own.writes_from) = document::with_write(
            std::mem::take(&mut own.writes),
            own.writes_from,
            own.rev,
            cx.storage.user().write_ids().this(),
        );
        own.rev += 1;
        list.id = id.to_string();
        list.group_id = None;
        let doc = SharedDoc {
            stopped: false,
            rev: 1,
            owner: owner.clone(),
            members: members.to_vec(),
            list,
            reminders: moving
                .into_iter()
                .map(|reminder| Reminder {
                    list_id: id.to_string(),
                    ..reminder
                })
                .collect(),
        };
        // The shared list and the owner's entry first: should the move stop
        // after them, the list is in both places, never in neither.
        let written = serde_json::to_vec(&doc).map_err(data_error)?;
        cx.storage.shared().put(&doc_key(id), &written).await?;
        // Every index entry before the move, so nobody on the list can miss it.
        let stamp = index_value(cx.now_ms);
        for person in doc.everyone() {
            cx.storage
                .shared()
                .put(&index_key(&person.id, id), &stamp)
                .await?;
        }
        let own_bytes = serde_json::to_vec(&own).map_err(data_error)?;
        if cx
            .storage
            .user()
            .put_if_version(DATA_KEY, &own_bytes, Some(version))
            .await?
        {
            return Ok(Ok((doc, own.rev)));
        }
    }
    Ok(Err(Response::error(
        503,
        "Your lists kept changing. Try again.",
    )))
}

/// Take back what a share that did not go through wrote: the shared list and
/// its index entries.
async fn forget_share(cx: &mut ApiCtx<'_>, id: &str, people: &[Person]) -> io::Result<()> {
    cx.storage.shared().delete(&doc_key(id)).await?;
    for person in people {
        cx.storage
            .shared()
            .delete(&index_key(&person.id, id))
            .await?;
    }
    Ok(())
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Put {
    base: u64,
    data: Data,
}

/// `PUT /shared/<id>`: the list's name, colour and reminders, on its revision.
pub async fn put(cx: &mut ApiCtx<'_>, id: &str) -> io::Result<Response> {
    let body: Put = match cx.request.json() {
        Ok(body) => body,
        Err(response) => return Ok(response),
    };
    let Some(me) = sharer(cx) else {
        return Ok(missing());
    };
    if body.data.lists.len() != 1 || body.data.lists[0].id != id {
        return Ok(Response::error(
            400,
            "A shared list's document holds that one list.",
        ));
    }
    if body.data.reminders.len() > MAX_SHARED_REMINDERS {
        return Ok(Response::error(
            400,
            &format!("A shared list holds at most {MAX_SHARED_REMINDERS} reminders."),
        ));
    }
    if let Err(message) = validate(&body.data) {
        return Ok(Response::error(400, &message));
    }
    for _ in 0..CAS_ATTEMPTS {
        let Some((mut doc, version)) = read(cx, id).await? else {
            return Ok(missing());
        };
        if !doc.has(&me.id) {
            return Ok(missing());
        }
        if doc.rev != body.base {
            return Ok(Response::json(
                409,
                &serde_json::json!({ "error": "the list has changed since that revision", "rev": doc.rev }),
            ));
        }
        let mut data = body.data.clone();
        doc.list = data.lists.remove(0);
        doc.reminders = data.reminders;
        doc.rev += 1;
        if write(cx, &doc, version).await? {
            let others: Vec<Person> = doc.everyone().filter(|p| p.id != me.id).cloned().collect();
            touch(cx, &others).await;
            return Ok(Response::json(200, &serde_json::json!({ "rev": doc.rev })));
        }
    }
    Ok(Response::error(503, "The list kept changing. Try again."))
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct AddPerson {
    name: String,
}

/// Apply `change` to the shared list `id` for `me`, under its compare-and-set:
/// `change` answers `Err(response)` to refuse, and `Ok(())` when it changed
/// the document. Answers the written document.
async fn change(
    cx: &mut ApiCtx<'_>,
    id: &str,
    me: &Account,
    mut change: impl FnMut(&mut SharedDoc) -> Result<(), Response>,
) -> io::Result<Result<(SharedDoc, SharedDoc), Response>> {
    for _ in 0..CAS_ATTEMPTS {
        let Some((doc, version)) = read(cx, id).await? else {
            return Ok(Err(missing()));
        };
        if !doc.has(&me.id) {
            return Ok(Err(missing()));
        }
        let mut next = doc.clone();
        if let Err(refused) = change(&mut next) {
            return Ok(Err(refused));
        }
        next.rev += 1;
        if write(cx, &next, version).await? {
            return Ok(Ok((doc, next)));
        }
    }
    Ok(Err(Response::error(
        503,
        "The list kept changing. Try again.",
    )))
}

fn owner_only(doc: &SharedDoc, me: &Account) -> Result<(), Response> {
    if doc.owner.id == me.id {
        Ok(())
    } else {
        Err(Response::error(403, "Only the list's owner can do that."))
    }
}

/// `POST /shared/<id>/people`: the owner adds someone.
pub async fn add_person(cx: &mut ApiCtx<'_>, id: &str) -> io::Result<Response> {
    let body: AddPerson = match cx.request.json() {
        Ok(body) => body,
        Err(response) => return Ok(response),
    };
    let Some(me) = sharer(cx) else {
        return Ok(missing());
    };
    let Some((doc, _)) = read(cx, id).await? else {
        return Ok(missing());
    };
    if !doc.has(&me.id) {
        return Ok(missing());
    }
    if let Err(refused) = owner_only(&doc, &me) {
        return Ok(refused);
    }
    if doc.members.len() >= MAX_PEOPLE {
        return Ok(Response::error(
            409,
            &format!("A list is shared with at most {MAX_PEOPLE} people."),
        ));
    }
    let added = match invitee(cx, &body.name, &me, Some(&doc)).await? {
        Ok(found) => found,
        Err(refused) => return Ok(refused),
    };
    // The index entry first, so that once the list names them they find it.
    cx.storage
        .shared()
        .put(&index_key(&added.id, id), &index_value(cx.now_ms))
        .await?;
    let joining = added.clone();
    let outcome = change(cx, id, &me, |doc| {
        owner_only(doc, &me)?;
        if doc.has(&joining.id) {
            return Err(Response::error(409, "They are on the list already."));
        }
        if doc.members.len() >= MAX_PEOPLE {
            return Err(Response::error(
                409,
                "The list is shared with as many people as it can be.",
            ));
        }
        doc.members.push(joining.clone());
        Ok(())
    })
    .await;
    // An add that did not go through takes its entry back, unless the list names them after
    // all (another add of theirs got in first, or a write whose answer was lost landed).
    let (_, next) = match outcome {
        Ok(Ok(done)) => done,
        Ok(Err(refused)) => {
            forget_unless_on(cx, id, &added.id).await?;
            return Ok(refused);
        }
        Err(error) => {
            if let Err(also) = forget_unless_on(cx, id, &added.id).await {
                ferrite_app::tracing::warn!(%also, "an add cut short left its index entry");
            }
            return Err(error);
        }
    };
    // Written again now that the list names them: a cleanup of theirs (a refused add, or a
    // read clearing an old entry) that read the list before this add landed may have deleted
    // it (`forget_unless_on`).
    if let Err(error) = cx
        .storage
        .shared()
        .put(&index_key(&added.id, id), &index_value(cx.now_ms))
        .await
    {
        ferrite_app::tracing::warn!(%error, "an added person's index entry not written again");
    }
    tell(
        cx,
        &added,
        format!("share-{id}-{}", next.rev),
        format!("{} shared a list with you", next.owner.full_name),
        &next.list.name,
    )
    .await;
    let others: Vec<Person> = next.everyone().filter(|p| p.id != me.id).cloned().collect();
    touch(cx, &others).await;
    Ok(Response::json(200, &view(&next, &me.id)))
}

/// `DELETE /shared/<id>/people/<name>`: the owner takes someone off.
pub async fn remove_person(cx: &mut ApiCtx<'_>, id: &str, raw: &str) -> io::Result<Response> {
    let Some(me) = sharer(cx) else {
        return Ok(missing());
    };
    let name = crate::accounts::account_name(raw).unwrap_or_default();
    let outcome = change(cx, id, &me, |doc| {
        owner_only(doc, &me)?;
        let before = doc.members.len();
        doc.members.retain(|person| person.name != name);
        if doc.members.len() == before {
            return Err(Response::error(404, "They are not on the list."));
        }
        Ok(())
    })
    .await?;
    let (before, next) = match outcome {
        Ok(done) => done,
        Err(refused) => return Ok(refused),
    };
    let gone: Vec<Person> = before
        .members
        .iter()
        .filter(|person| !next.has(&person.id))
        .cloned()
        .collect();
    for person in &gone {
        cx.storage
            .shared()
            .delete(&index_key(&person.id, id))
            .await?;
        tell(
            cx,
            person,
            format!("unshare-{id}-{}", next.rev),
            format!("{} stopped sharing a list with you", next.owner.full_name),
            &next.list.name,
        )
        .await;
    }
    let told: Vec<Person> = before
        .everyone()
        .filter(|p| p.id != me.id)
        .cloned()
        .collect();
    touch(cx, &told).await;
    Ok(Response::json(200, &view(&next, &me.id)))
}

/// `POST /shared/<id>/leave`.
pub async fn leave(cx: &mut ApiCtx<'_>, id: &str) -> io::Result<Response> {
    let Some(me) = sharer(cx) else {
        return Ok(missing());
    };
    let Some((doc, _)) = read(cx, id).await? else {
        return Ok(missing());
    };
    if !doc.has(&me.id) {
        return Ok(missing());
    }
    // The owner of a list nobody else is on takes it back.
    if doc.owner.id == me.id && doc.members.is_empty() {
        return stop(cx, id).await;
    }
    let outcome = change(cx, id, &me, |doc| {
        if doc.owner.id == me.id {
            if doc.members.is_empty() {
                return Err(Response::error(409, "Stop sharing the list instead."));
            }
            // The next person on it owns it.
            doc.owner = doc.members.remove(0);
        } else {
            doc.members.retain(|person| person.id != me.id);
        }
        Ok(())
    })
    .await?;
    let (_, next) = match outcome {
        Ok(done) => done,
        Err(refused) => return Ok(refused),
    };
    cx.storage.shared().delete(&index_key(&me.id, id)).await?;
    let others: Vec<Person> = next.everyone().cloned().collect();
    let passed = next.owner.id != doc.owner.id;
    for person in &others {
        let title = if passed && person.id == next.owner.id {
            format!("{} left a shared list, which is yours now", me.full_name)
        } else {
            format!("{} left a shared list", me.full_name)
        };
        tell(
            cx,
            person,
            format!("left-{id}-{}", next.rev),
            title,
            &next.list.name,
        )
        .await;
    }
    touch(cx, &others).await;
    Ok(Response::json(200, &serde_json::json!({ "left": true })))
}

/// `POST /shared/<id>/stop`: the owner takes the list back into their own
/// lists, and everyone else leaves it. The list is added to the owner's own
/// document before the shared one is taken away, so a stop cut short leaves
/// it in both places, never in neither.
pub async fn stop(cx: &mut ApiCtx<'_>, id: &str) -> io::Result<Response> {
    let Some(me) = sharer(cx) else {
        return Ok(missing());
    };
    for _ in 0..CAS_ATTEMPTS {
        let Some((doc, version)) = read(cx, id).await? else {
            return Ok(missing());
        };
        if !doc.has(&me.id) {
            return Ok(missing());
        }
        if doc.owner.id != me.id {
            return Ok(Response::error(
                403,
                "Only the list's owner can stop sharing it.",
            ));
        }
        // Into the owner's own document: the list in place of any copy of it there.
        let rev = match loop_own(cx, &doc).await? {
            Ok(Some(rev)) => rev,
            Ok(None) => return Ok(Response::error(503, "Your lists kept changing. Try again.")),
            Err(message) => {
                return Ok(Response::error(
                    409,
                    &format!("The list cannot go back into your own lists: {message}"),
                ))
            }
        };
        // Then the shared document goes, on the version that was copied: a change
        // written meanwhile makes this pass copy it again.
        let gone = serde_json::to_vec(&SharedDoc {
            stopped: true,
            rev: doc.rev + 1,
            ..doc.clone()
        })
        .map_err(data_error)?;
        if !cx
            .storage
            .shared()
            .put_if_version(&doc_key(id), &gone, Some(version))
            .await?
        {
            continue;
        }
        for person in doc.everyone() {
            cx.storage
                .shared()
                .delete(&index_key(&person.id, id))
                .await?;
        }
        cx.storage.shared().delete(&doc_key(id)).await?;
        for member in doc.members.clone() {
            tell(
                cx,
                &member,
                format!("unshare-{id}-{}", doc.rev),
                format!("{} stopped sharing a list with you", doc.owner.full_name),
                &doc.list.name,
            )
            .await;
        }
        touch(cx, &doc.members.clone()).await;
        return Ok(Response::json(
            200,
            &serde_json::json!({ "rev": rev, "list": id }),
        ));
    }
    Ok(Response::error(503, "The list kept changing. Try again."))
}

/// Put `doc`'s list and reminders into the owner's own document, replacing a
/// copy an earlier pass put there. The new revision, `None` when the
/// document kept changing, or why the document cannot take the list.
async fn loop_own(cx: &mut ApiCtx<'_>, doc: &SharedDoc) -> io::Result<Result<Option<u64>, String>> {
    let id = &doc.list.id;
    for _ in 0..CAS_ATTEMPTS {
        let stored = cx.storage.user().get_versioned(DATA_KEY).await?;
        let (mut own, version) = match stored {
            Some((bytes, version)) => (
                serde_json::from_slice::<Own>(&bytes).map_err(data_error)?,
                Some(version),
            ),
            None => (
                Own {
                    rev: 0,
                    data: Data::default(),
                    alerts: BTreeMap::new(),
                    writes: Vec::new(),
                    writes_from: None,
                },
                None,
            ),
        };
        own.data.lists.retain(|list| &list.id != id);
        // A copy an earlier pass put there goes, its alerts with it.
        let earlier: Vec<String> = own
            .data
            .reminders
            .iter()
            .filter(|reminder| &reminder.list_id == id)
            .map(|reminder| reminder.id.clone())
            .collect();
        for gone in &earlier {
            own.alerts.remove(gone);
        }
        own.data
            .reminders
            .retain(|reminder| &reminder.list_id != id);
        own.data.lists.push(doc.list.clone());
        // A reminder whose id one of the person's own already has (the list
        // came from someone else) is given one of its own.
        let mut taken: BTreeSet<String> = own.data.reminders.iter().map(|r| r.id.clone()).collect();
        let mut renamed: BTreeMap<&str, String> = BTreeMap::new();
        for reminder in &doc.reminders {
            let mut id = reminder.id.clone();
            let mut n = 2;
            while taken.contains(&id) {
                // Cut short so that the id stays within an id's 64 characters.
                let suffix = format!("-{n}");
                let base: String = reminder.id.chars().take(64 - suffix.len()).collect();
                id = format!("{base}{suffix}");
                n += 1;
            }
            taken.insert(id.clone());
            renamed.insert(reminder.id.as_str(), id);
        }
        for reminder in &doc.reminders {
            own.data.reminders.push(Reminder {
                id: renamed[reminder.id.as_str()].clone(),
                parent_id: reminder
                    .parent_id
                    .as_deref()
                    .and_then(|parent| renamed.get(parent).cloned()),
                ..reminder.clone()
            });
        }
        if let Err(message) = validate(&own.data) {
            return Ok(Err(message));
        }
        // A document a browser can still send whole (the request body limit is 256 KiB).
        let size = serde_json::to_vec(&own.data).map_err(data_error)?.len();
        if size > MAX_OWN_BYTES {
            return Ok(Err(format!(
                "your reminders would be {} KB, more than the {} KB a save can carry",
                size / 1024,
                MAX_OWN_BYTES / 1024
            )));
        }
        (own.writes, own.writes_from) = document::with_write(
            std::mem::take(&mut own.writes),
            own.writes_from,
            own.rev,
            cx.storage.user().write_ids().this(),
        );
        own.rev += 1;
        let bytes = serde_json::to_vec(&own).map_err(data_error)?;
        if cx
            .storage
            .user()
            .put_if_version(DATA_KEY, &bytes, version)
            .await?
        {
            return Ok(Ok(Some(own.rev)));
        }
    }
    Ok(Ok(None))
}

/// Whether `id` names a shared list: `sh-` and 24 hex digits.
pub fn is_shared_id(id: &str) -> bool {
    id.len() == 27
        && id.starts_with("sh-")
        && is_id(id)
        && id[3..].bytes().all(|b| b.is_ascii_hexdigit())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn someone(id: &str) -> Person {
        Person {
            id: id.into(),
            name: id.trim_start_matches("u-").into(),
            full_name: id.to_uppercase(),
        }
    }

    fn doc() -> SharedDoc {
        SharedDoc {
            rev: 3,
            owner: someone("u-chris"),
            members: vec![someone("u-anna")],
            list: List {
                id: "sh-0123456789abcdef01234567".into(),
                name: "Groceries".into(),
                color: super::super::Color::Green,
                group_id: None,
            },
            reminders: Vec::new(),
            stopped: false,
        }
    }

    #[test]
    fn everyone_on_a_list_is_its_owner_and_members() {
        let doc = doc();
        assert!(doc.has("u-chris") && doc.has("u-anna") && !doc.has("u-ben"));
        assert_eq!(doc.everyone().count(), 2);
    }

    #[test]
    fn a_list_shows_names_and_never_account_ids() {
        let shown = view(&doc(), "u-anna").to_string();
        assert!(!shown.contains("u-"), "{shown}");
        assert!(shown.contains(r#""owned":false"#), "{shown}");
        assert!(view(&doc(), "u-chris")
            .to_string()
            .contains(r#""owned":true"#));
    }

    #[test]
    fn shared_ids_are_the_ones_made_here() {
        assert!(is_shared_id("sh-0123456789abcdef01234567"));
        assert!(!is_shared_id("sh-0123"));
        assert!(!is_shared_id("reminders"));
        assert!(!is_shared_id("sh-0123456789abcdef0123456z"));
    }

    #[test]
    fn an_index_entry_is_stale_once_no_add_can_be_using_it() {
        let now = 1_791_792_000_000;
        let written = index_value(now);
        assert!(!stale(&written, now), "just written");
        assert!(!stale(&written, now + STRAY_AFTER_MS - 1));
        assert!(stale(&written, now + STRAY_AFTER_MS));
        assert!(stale(b"1", now), "an earlier build's entry");
        assert!(stale(b"not a time", now));
        assert!(!stale(&index_value(now + 5_000), now), "a clock ahead");
    }
}

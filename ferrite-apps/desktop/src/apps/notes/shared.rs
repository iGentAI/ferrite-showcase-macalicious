//! Notes shared between accounts (Add People).
//!
//! A signed-in account (not a Guest User) shares one of its own notes with
//! other accounts by exact account name. The note leaves the owner's own
//! document and becomes a document of its own in the module's shared space,
//! with its own revision, which everyone on it reads and writes; each person
//! keeps an index entry for each shared note they are on. This is the shape of
//! Reminders' shared lists (`../reminders/shared.rs`).
//!
//! * `notes/<id>`: the [`SharedDoc`]: the owner, the other people on it, the
//!   note, who last edited it and the revision;
//! * `members/<account>/<id>`: one per person on the note, the owner among them.
//!   It holds when it was written (epoch ms): it is written before the change
//!   that puts the person on the note, so for a moment it may name a note that
//!   does not (yet) name them; an add that does not go through takes it back,
//!   and a read deletes one whose note does not name its person once it is
//!   [`STRAY_AFTER_MS`] old.
//!
//! Routes, all `/api/notes/shared...`:
//!
//! * `GET /shared`: `{"notes": [...], "can_share": bool, "me": name}`, each
//!   `{id, rev, owner, members, owned, edited_by, note}` with people as
//!   `{name, full_name}`; account ids never reach a browser.
//! * `POST /shared` with `{"note", "people": [names]}`: shares one of the
//!   person's own notes; `{"id", "rev"}` (the new revision of the person's own
//!   document, which no longer holds the note). A locked note cannot be shared.
//! * `PUT /shared/<id>` with `{"base", "note"}`: on the note's revision: 409
//!   with `{"rev"}` when `base` is not it. The note keeps its id and the folder
//!   it came from, whatever the page sends.
//! * `POST /shared/<id>/people` with `{"name"}` (the owner adds someone),
//!   `DELETE /shared/<id>/people/<name>` (the owner takes someone off),
//!   `POST /shared/<id>/leave` (someone else on it leaves), and
//!   `POST /shared/<id>/stop` with `{"deleted"?}` (the owner stops sharing: the
//!   note goes back to the owner's own notes, in Recently Deleted when `deleted`
//!   gives the date, and leaves everyone else's).
//!
//! Every route answers 404 to someone who is not on the note, and every change
//! is a compare-and-set on the note's document that checks, in the same write,
//! that the person is still on it.

use std::collections::BTreeSet;
use std::io;

use ferrite_app::{serde, serde_json};

use super::attachments;
use super::{
    document, is_id, validate, Data, Folder, Note, Stored, CAS_ATTEMPTS, DEFAULT_FOLDER, KEY,
};
use crate::apps::notification_center::{self, Notification};
use crate::http::Response;
use crate::module::ApiCtx;
use crate::session::Account;

const APP: &str = "notes";
/// The most people on a shared note besides its owner.
pub const MAX_PEOPLE: usize = 20;
/// The most shared notes one person is on.
pub const MAX_NOTES_PER_PERSON: usize = 50;
/// The largest own document a note taken back may leave: under the 256 KiB a
/// request body may hold, so the person's browser can still save it.
const MAX_OWN_BYTES: usize = 240 * 1024;
/// The most index entries a read of a person's notes looks at: those of notes
/// they are on, and any left by a change cut short.
const MAX_INDEX: usize = 80;
/// How long an index entry whose note does not name its person may belong to
/// an add still under way.
pub const STRAY_AFTER_MS: u64 = 60_000;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Person {
    pub id: String,
    pub name: String,
    pub full_name: String,
}

/// One shared note.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct SharedDoc {
    pub rev: u64,
    pub owner: Person,
    /// Everyone on it but its owner, in the order they were added.
    pub members: Vec<Person>,
    pub note: Note,
    /// The full name of whoever saved it last; absent until someone does.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub edited_by: Option<String>,
    /// Sharing stopped: the note is back in its owner's own document, and this
    /// one stands for nothing until it is deleted.
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

    fn title(&self) -> String {
        self.note
            .lines
            .iter()
            .find(|line| !line.trim().is_empty())
            .map_or_else(|| "New Note".to_string(), |line| line.trim().to_string())
    }
}

fn doc_key(id: &str) -> String {
    format!("notes/{id}")
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
    Response::error(404, "There is no such shared note.")
}

fn view(doc: &SharedDoc, me: &str) -> serde_json::Value {
    let shown =
        |person: &Person| serde_json::json!({ "name": person.name, "full_name": person.full_name });
    serde_json::json!({
        "id": doc.note.id,
        "rev": doc.rev,
        "owner": shown(&doc.owner),
        "members": doc.members.iter().map(shown).collect::<Vec<_>>(),
        "owned": doc.owner.id == me,
        "edited_by": doc.edited_by,
        "note": doc.note,
    })
}

/// The shared note `id` and its store version, or `None` when there is none
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

async fn write(cx: &mut ApiCtx<'_>, doc: &SharedDoc, version: u64) -> io::Result<bool> {
    let bytes = serde_json::to_vec(doc).map_err(data_error)?;
    cx.storage
        .shared()
        .put_if_version(&doc_key(&doc.note.id), &bytes, Some(version))
        .await
}

/// What an index entry holds: when it was written (epoch ms).
fn index_value(now_ms: u64) -> Vec<u8> {
    now_ms.to_string().into_bytes()
}

/// Whether an index entry holding `value` is past belonging to an add under
/// way at `now_ms`.
fn stale(value: &[u8], now_ms: u64) -> bool {
    std::str::from_utf8(value)
        .ok()
        .and_then(|text| text.trim().parse::<u64>().ok())
        .map_or(true, |at| now_ms.saturating_sub(at) >= STRAY_AFTER_MS)
}

/// The shared notes `person` is on, read in one call. An entry whose note does
/// not (yet) name them is passed over and deleted once too old to belong to an
/// add under way; one whose note is gone, or was stopped, is deleted on the way.
pub(super) async fn notes_of(cx: &mut ApiCtx<'_>, person: &str) -> io::Result<Vec<SharedDoc>> {
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
            Some(Ok(_)) if stale(written, now) => {
                forget_unless_on(cx, id, person).await?;
            }
            Some(_) => {}
        }
    }
    Ok(out)
}

/// Delete `person`'s index entry for the note `id` unless the note names them.
/// The store has no delete that holds only while the entry is unchanged, so the
/// note is read again after the delete and the entry put back if it names the
/// person by then, which is how Reminders' shared lists keep a member's entry
/// through an add and a cleanup that cross.
async fn forget_unless_on(cx: &mut ApiCtx<'_>, id: &str, person: &str) -> io::Result<()> {
    if on_note(cx, id, person).await? {
        return Ok(());
    }
    cx.storage.shared().delete(&index_key(person, id)).await?;
    if on_note(cx, id, person).await? {
        cx.storage
            .shared()
            .put(&index_key(person, id), &index_value(cx.now_ms))
            .await?;
    }
    Ok(())
}

async fn on_note(cx: &mut ApiCtx<'_>, id: &str, person: &str) -> io::Result<bool> {
    Ok(read(cx, id).await?.is_some_and(|(doc, _)| doc.has(person)))
}

/// Tell the people's open Notes windows to read again. A failure only delays
/// that to their next read.
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
        ferrite_app::tracing::warn!(%error, "a shared note's notification not delivered");
    }
}

/// The account a person names to share with, or the response refusing it.
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
        return Ok(Err(Response::error(400, "You are on the note already.")));
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
            &format!("\u{201c}{name}\u{201d} is on the note already."),
        )));
    }
    if notes_of(cx, &found.id).await?.len() >= MAX_NOTES_PER_PERSON {
        return Ok(Err(Response::error(
            409,
            &format!("\u{201c}{name}\u{201d} is on too many shared notes to join another."),
        )));
    }
    Ok(Ok(person(&found)))
}

/// `GET /shared`.
pub async fn notes(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let Some(me) = sharer(cx) else {
        return Ok(Response::json(
            200,
            &serde_json::json!({ "notes": [], "can_share": false, "me": null }),
        ));
    };
    let out: Vec<serde_json::Value> = notes_of(cx, &me.id)
        .await?
        .iter()
        .take(MAX_NOTES_PER_PERSON)
        .map(|doc| view(doc, &me.id))
        .collect();
    Ok(Response::json(
        200,
        &serde_json::json!({ "notes": out, "can_share": true, "me": me.name }),
    ))
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Share {
    note: String,
    people: Vec<String>,
}

/// `POST /shared`: share one of the person's own notes.
pub async fn share(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let body: Share = match cx.request.json() {
        Ok(body) => body,
        Err(response) => return Ok(response),
    };
    let Some(me) = sharer(cx) else {
        return Ok(Response::error(
            403,
            "Sign in to an account to share a note.",
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
            &format!("Share a note with 1 to {MAX_PEOPLE} account names, each once."),
        ));
    }
    if notes_of(cx, &me.id).await?.len() >= MAX_NOTES_PER_PERSON {
        return Ok(Response::error(
            409,
            &format!("You are on {MAX_NOTES_PER_PERSON} shared notes already."),
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
    // A move stopped short of the owner's document takes back what it wrote: on a refusal or
    // notes that kept changing at once; after a failure whose outcome is not known, only while
    // the owner's own notes still hold the note (never in neither).
    let (doc, rev) = match move_to_shared(cx, &body.note, &id, &owner, &members).await {
        Ok(Ok(moved)) => moved,
        Ok(Err(refused)) => {
            forget_share(cx, &id, &everyone).await?;
            return Ok(refused);
        }
        Err(error) => {
            let held = cx
                .storage
                .user()
                .get_json::<Stored>(KEY)
                .await
                .ok()
                .flatten()
                .is_some_and(|own| own.data.notes.iter().any(|note| note.id == body.note));
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
            format!("{} shared a note with you", owner.full_name),
            &doc.title(),
        )
        .await;
    }
    touch(cx, &doc.members.clone()).await;
    Ok(Response::json(
        201,
        &serde_json::json!({ "id": id, "rev": rev, "note": view(&doc, &me.id) }),
    ))
}

/// Move the person's own note `note_id` into the new shared note `id`: the
/// shared document and everyone's index entries first, then the owner's own
/// document without the note, under its compare-and-set. What it wrote is the
/// caller's to take back when the move did not go through.
async fn move_to_shared(
    cx: &mut ApiCtx<'_>,
    note_id: &str,
    id: &str,
    owner: &Person,
    members: &[Person],
) -> io::Result<Result<(SharedDoc, u64), Response>> {
    for _ in 0..CAS_ATTEMPTS {
        let Some((bytes, version)) = cx.storage.user().get_versioned(KEY).await? else {
            return Ok(Err(Response::error(404, "There is no such note.")));
        };
        let mut own: Stored = serde_json::from_slice(&bytes).map_err(data_error)?;
        let Some(at) = own.data.notes.iter().position(|note| note.id == note_id) else {
            return Ok(Err(Response::error(404, "There is no such note.")));
        };
        let mut note = own.data.notes.remove(at);
        if note.sealed.is_some() {
            return Ok(Err(Response::error(
                409,
                "A locked note can\u{2019}t be shared.",
            )));
        }
        if note.deleted.is_some() {
            return Ok(Err(Response::error(
                409,
                "Recover the note before you share it.",
            )));
        }
        (own.writes, own.writes_from) = document::with_write(
            std::mem::take(&mut own.writes),
            own.writes_from,
            own.rev,
            cx.storage.user().write_ids().this(),
        );
        own.rev += 1;
        note.id = id.to_string();
        let doc = SharedDoc {
            rev: 1,
            owner: owner.clone(),
            members: members.to_vec(),
            note,
            edited_by: None,
            stopped: false,
        };
        // The shared note and the owner's entry first: should the move stop after them, the note
        // is in both places, never in neither.
        let written = serde_json::to_vec(&doc).map_err(data_error)?;
        cx.storage.shared().put(&doc_key(id), &written).await?;
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
            .put_if_version(KEY, &own_bytes, Some(version))
            .await?
        {
            return Ok(Ok((doc, own.rev)));
        }
    }
    Ok(Err(Response::error(
        503,
        "Your notes kept changing. Try again.",
    )))
}

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
    note: Note,
}

/// The note as the shared document keeps it: `sent` with the id and the folder
/// `doc` already holds, checked as a note of a person's own document is.
fn settled_note(doc: &SharedDoc, sent: Note) -> Result<Note, String> {
    if sent.id != doc.note.id {
        return Err("A shared note's document holds that one note.".to_string());
    }
    if sent.locked == Some(true) || sent.sealed.is_some() || sent.deleted.is_some() {
        return Err("A shared note can\u{2019}t be locked or deleted.".to_string());
    }
    let note = Note {
        folder: DEFAULT_FOLDER.to_string(),
        ..sent
    };
    validate(&Data {
        folders: vec![default_folder()],
        notes: vec![note.clone()],
    })?;
    Ok(Note {
        folder: doc.note.folder.clone(),
        ..note
    })
}

fn default_folder() -> Folder {
    Folder {
        id: DEFAULT_FOLDER.to_string(),
        name: "Notes".to_string(),
        parent: None,
        local: None,
    }
}

/// `PUT /shared/<id>`: the note's content, on its revision. A file the page
/// names is the stored record of it, or one of the writer's own uploads, which
/// this save holds; bytes are kept under the file's id, so everyone on the note
/// can read them.
pub async fn put(cx: &mut ApiCtx<'_>, id: &str) -> io::Result<Response> {
    let body: Put = match cx.request.json() {
        Ok(body) => body,
        Err(response) => return Ok(response),
    };
    let Some(me) = sharer(cx) else {
        return Ok(missing());
    };
    let now_ms = cx.now_ms;
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
                &serde_json::json!({ "error": "the note has changed since that revision", "rev": doc.rev }),
            ));
        }
        let mut note = match settled_note(&doc, body.note.clone()) {
            Ok(note) => note,
            Err(message) => return Ok(Response::error(400, &message)),
        };
        let known: Vec<attachments::Attachment> = doc.note.files.clone();
        let new: Vec<String> = note
            .files
            .iter()
            .filter(|file| !known.iter().any(|each| each.id == file.id))
            .map(|file| file.id.clone())
            .collect();
        let mut records = known;
        if !new.is_empty() {
            match attachments::hold(&mut cx.storage.user(), &new, now_ms).await {
                Ok(held) => records.extend(held),
                Err(refusal) => return Ok(refusal.reply()),
            }
        }
        for file in &mut note.files {
            if let Some(record) = records.iter().find(|each| each.id == file.id) {
                *file = record.clone();
            }
        }
        doc.note = note;
        doc.edited_by = Some(me.full_name.clone());
        doc.rev += 1;
        if write(cx, &doc, version).await? {
            let others: Vec<Person> = doc.everyone().filter(|p| p.id != me.id).cloned().collect();
            touch(cx, &others).await;
            return Ok(Response::json(200, &serde_json::json!({ "rev": doc.rev })));
        }
    }
    Ok(Response::error(503, "The note kept changing. Try again."))
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct AddPerson {
    name: String,
}

/// Apply `edit` to the shared note `id` for `me`, under its compare-and-set.
/// Answers the document before and the one written.
async fn change(
    cx: &mut ApiCtx<'_>,
    id: &str,
    me: &Account,
    mut edit: impl FnMut(&mut SharedDoc) -> Result<(), Response>,
) -> io::Result<Result<(SharedDoc, SharedDoc), Response>> {
    for _ in 0..CAS_ATTEMPTS {
        let Some((doc, version)) = read(cx, id).await? else {
            return Ok(Err(missing()));
        };
        if !doc.has(&me.id) {
            return Ok(Err(missing()));
        }
        let mut next = doc.clone();
        if let Err(refused) = edit(&mut next) {
            return Ok(Err(refused));
        }
        next.rev += 1;
        if write(cx, &next, version).await? {
            return Ok(Ok((doc, next)));
        }
    }
    Ok(Err(Response::error(
        503,
        "The note kept changing. Try again.",
    )))
}

fn owner_only(doc: &SharedDoc, me: &Account) -> Result<(), Response> {
    if doc.owner.id == me.id {
        Ok(())
    } else {
        Err(Response::error(403, "Only the note's owner can do that."))
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
            &format!("A note is shared with at most {MAX_PEOPLE} people."),
        ));
    }
    let added = match invitee(cx, &body.name, &me, Some(&doc)).await? {
        Ok(found) => found,
        Err(refused) => return Ok(refused),
    };
    // The index entry first, so that once the note names them they find it.
    cx.storage
        .shared()
        .put(&index_key(&added.id, id), &index_value(cx.now_ms))
        .await?;
    let joining = added.clone();
    let outcome = change(cx, id, &me, |doc| {
        owner_only(doc, &me)?;
        if doc.has(&joining.id) {
            return Err(Response::error(409, "They are on the note already."));
        }
        if doc.members.len() >= MAX_PEOPLE {
            return Err(Response::error(
                409,
                "The note is shared with as many people as it can be.",
            ));
        }
        doc.members.push(joining.clone());
        Ok(())
    })
    .await;
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
    // Written again now that the note names them: a cleanup of theirs that read the note before
    // this add landed may have deleted it (`forget_unless_on`).
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
        format!("{} shared a note with you", next.owner.full_name),
        &next.title(),
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
            return Err(Response::error(404, "They are not on the note."));
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
            format!("{} stopped sharing a note with you", next.owner.full_name),
            &next.title(),
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

/// `POST /shared/<id>/leave`: someone other than the owner leaves.
pub async fn leave(cx: &mut ApiCtx<'_>, id: &str) -> io::Result<Response> {
    let Some(me) = sharer(cx) else {
        return Ok(missing());
    };
    let outcome = change(cx, id, &me, |doc| {
        if doc.owner.id == me.id {
            return Err(Response::error(
                409,
                "Stop sharing the note instead: you own it.",
            ));
        }
        doc.members.retain(|person| person.id != me.id);
        Ok(())
    })
    .await?;
    let (_, next) = match outcome {
        Ok(done) => done,
        Err(refused) => return Ok(refused),
    };
    cx.storage.shared().delete(&index_key(&me.id, id)).await?;
    tell(
        cx,
        &next.owner.clone(),
        format!("left-{id}-{}", next.rev),
        format!("{} left a shared note", me.full_name),
        &next.title(),
    )
    .await;
    let others: Vec<Person> = next.everyone().cloned().collect();
    touch(cx, &others).await;
    Ok(Response::json(200, &serde_json::json!({ "left": true })))
}

#[derive(serde::Deserialize, Default)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Stop {
    /// An ISO date: the note goes back to Recently Deleted rather than its folder.
    #[serde(default)]
    deleted: Option<String>,
}

/// `POST /shared/<id>/stop`: the owner takes the note back into their own
/// notes, and everyone else leaves it. The note is added to the owner's own
/// document before the shared one is taken away, so a stop cut short leaves it
/// in both places, never in neither.
pub async fn stop(cx: &mut ApiCtx<'_>, id: &str) -> io::Result<Response> {
    let body: Stop = match cx.request.json() {
        Ok(body) => body,
        Err(response) => return Ok(response),
    };
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
        if let Err(refused) = owner_only(&doc, &me) {
            return Ok(refused);
        }
        let rev = match back_to_own(cx, &doc, body.deleted.as_deref()).await? {
            Ok(Some(rev)) => rev,
            Ok(None) => return Ok(Response::error(503, "Your notes kept changing. Try again.")),
            Err(message) => {
                return Ok(Response::error(
                    409,
                    &format!("The note cannot go back into your own notes: {message}"),
                ))
            }
        };
        // Then the shared document goes, on the version that was copied: a change written
        // meanwhile makes this pass copy it again.
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
                format!("{} stopped sharing a note with you", doc.owner.full_name),
                &doc.title(),
            )
            .await;
        }
        touch(cx, &doc.members.clone()).await;
        return Ok(Response::json(
            200,
            &serde_json::json!({ "rev": rev, "note": id }),
        ));
    }
    Ok(Response::error(503, "The note kept changing. Try again."))
}

/// Put `doc`'s note into the owner's own document, in its folder when that
/// folder is still there, replacing a copy an earlier pass put there. The new
/// revision, `None` when the document kept changing, or why it cannot take the
/// note.
async fn back_to_own(
    cx: &mut ApiCtx<'_>,
    doc: &SharedDoc,
    deleted: Option<&str>,
) -> io::Result<Result<Option<u64>, String>> {
    let id = &doc.note.id;
    for _ in 0..CAS_ATTEMPTS {
        let stored = cx.storage.user().get_versioned(KEY).await?;
        let (mut own, version) = match stored {
            Some((bytes, version)) => (
                serde_json::from_slice::<Stored>(&bytes).map_err(data_error)?,
                Some(version),
            ),
            None => (
                Stored {
                    rev: 0,
                    data: Data {
                        folders: vec![default_folder()],
                        notes: Vec::new(),
                    },
                    writes: Vec::new(),
                    writes_from: None,
                },
                None,
            ),
        };
        own.data.notes.retain(|note| &note.id != id);
        let mut note = doc.note.clone();
        if !own.data.folders.iter().any(|f| f.id == note.folder) {
            note.folder = DEFAULT_FOLDER.to_string();
        }
        if let Some(when) = deleted {
            note.deleted = Some(when.to_string());
            note.pinned = None;
        }
        own.data.notes.insert(0, note);
        if let Err(message) = validate(&own.data) {
            return Ok(Err(message));
        }
        let size = serde_json::to_vec(&own.data).map_err(data_error)?.len();
        if size > MAX_OWN_BYTES {
            return Ok(Err(format!(
                "your notes would be {} KB, more than the {} KB a save can carry",
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
            .put_if_version(KEY, &bytes, version)
            .await?
        {
            return Ok(Ok(Some(own.rev)));
        }
    }
    Ok(Ok(None))
}

/// Whether `id` names a shared note: `sh-` and 24 hex digits.
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

    fn note(id: &str) -> Note {
        Note {
            id: id.into(),
            folder: "trips".into(),
            lines: vec!["Packing".into(), "boots".into()],
            html: None,
            date: "Today".into(),
            edited: "Today".into(),
            attachment: None,
            picture: None,
            files: Vec::new(),
            locked: None,
            sealed: None,
            pinned: None,
            created: None,
            deleted: None,
        }
    }

    fn doc() -> SharedDoc {
        SharedDoc {
            rev: 3,
            owner: someone("u-chris"),
            members: vec![someone("u-anna")],
            note: note("sh-0123456789abcdef01234567"),
            edited_by: Some("ANNA".into()),
            stopped: false,
        }
    }

    #[test]
    fn everyone_on_a_note_is_its_owner_and_members() {
        let doc = doc();
        assert!(doc.has("u-chris") && doc.has("u-anna") && !doc.has("u-ben"));
        assert_eq!(doc.everyone().count(), 2);
        assert_eq!(doc.title(), "Packing");
    }

    #[test]
    fn a_note_shows_names_and_never_account_ids() {
        let shown = view(&doc(), "u-anna").to_string();
        assert!(!shown.contains("u-"), "{shown}");
        assert!(shown.contains(r#""owned":false"#), "{shown}");
        assert!(shown.contains(r#""edited_by":"ANNA""#), "{shown}");
    }

    #[test]
    fn a_save_keeps_the_notes_id_and_folder_and_refuses_what_a_shared_note_cannot_be() {
        let doc = doc();
        let mut sent = note("sh-0123456789abcdef01234567");
        sent.folder = "elsewhere".into();
        sent.lines = vec!["Edited".into()];
        let kept = settled_note(&doc, sent.clone()).unwrap();
        assert_eq!(kept.folder, "trips");
        assert_eq!(kept.lines, vec!["Edited".to_string()]);

        let other = note("sh-ffffffffffffffffffffffff");
        assert!(settled_note(&doc, other).is_err());
        let locked = Note {
            locked: Some(true),
            ..sent.clone()
        };
        assert!(settled_note(&doc, locked).is_err());
        let deleted = Note {
            deleted: Some("2026-11-06".into()),
            ..sent.clone()
        };
        assert!(settled_note(&doc, deleted).is_err());
        let unsafe_html = Note {
            html: Some("<script>x</script>".into()),
            ..sent
        };
        assert!(settled_note(&doc, unsafe_html).is_err());
    }

    #[test]
    fn shared_ids_are_the_ones_made_here() {
        assert!(is_shared_id("sh-0123456789abcdef01234567"));
        assert!(!is_shared_id("sh-0123"));
        assert!(!is_shared_id("notes"));
        assert!(!is_shared_id("sh-0123456789abcdef0123456z"));
    }

    #[test]
    fn an_index_entry_is_stale_once_no_add_can_be_using_it() {
        let now = 1_791_792_000_000;
        let written = index_value(now);
        assert!(!stale(&written, now));
        assert!(stale(&written, now + STRAY_AFTER_MS));
        assert!(stale(b"not a time", now));
    }
}

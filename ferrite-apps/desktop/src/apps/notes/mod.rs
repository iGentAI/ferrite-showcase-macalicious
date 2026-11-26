//! Notes' server half: a session's folders and notes.
//!
//! The Notes demo edits in the browser. When the desktop is served by this
//! application it saves its folders and notes here and starts from them when
//! the window opens, so they survive a reload.
//!
//! * `GET /api/notes/data`: `{"data": {"folders": [...], "notes": [...]}, "rev": n}`,
//!   or `{"data": null, "rev": 0}` when the session never saved any (the demo then
//!   starts from the notes of the reference screenshots).
//! * `PUT /api/notes/data` with `{"base": n, "data": {"folders": [...], "notes": [...]}}`:
//!   replaces them and answers `200` with `{"rev"}`, the new revision. The shapes are
//!   `NotesFolder` and `NotesNote` of `demos/notes/notes-data.ts`. A body that
//!   is not such a document is refused with `400` and nothing changes.
//!
//! What is kept of a note is what the note list knows: its lines of text, its
//! dates, which stand-in picture it shows and the
//! thumbnail of a picture the user added (a `data:image/` URL of at most
//! [`MAX_PICTURE_CHARS`]), and, when its text has formats, `html`: the
//! editor's content without its pictures (bold, fonts, colours, alignment,
//! headings, tables), at most [`MAX_HTML_CHARS`]. A note saved before formats
//! were kept has no `html` and is shown from its lines.
//!
//! A note's `files` are what the person attached, as Calendar keeps an event's
//! (`../attachments.rs`):
//!
//! * `POST /attachments`, `PUT /attachments/<id>/<n>`, `POST
//!   /attachments/<id>/complete`, `DELETE /attachments/<id>`: a file uploaded
//!   in pieces before a save names it. A Guest User may attach files, as it may
//!   keep them on its drive, within the same daily allowance as anyone.
//! * `GET /attachments/<id>?piece=<n>&count=<k>`: the bytes of a file a note of
//!   the person's own document names.
//!
//! A save holds the uploads it names, and what the page says of a file is not
//! used: each file is the stored record of it. Dropping a file from a note does
//! not delete its bytes, so Undo can bring it back.
//!
//! A note also keeps `pinned`, `created` (when it was made, an ISO date) and
//! `deleted` (an ISO date while it is in Recently Deleted, where it stays for
//! 30 days; its `folder` is still where Recover puts it). A folder may name its
//! `parent` folder.
//!
//! `html` is stored as text and never served as a page. It is checked
//! against what the demo writes (`noteHtml` in `demos/notes/notes-editor.tsx`,
//! which rebuilds the editor's content with `richTextFromHtml`): the elements
//! formatting and tables make, the attributes `style`, `class`, `color`,
//! `face`, `size` and `align`, `data-paragraph` (a first line made body
//! text, whose one value is `body`), `dir` (`ltr` or `rtl`) and a link's
//! `href` (an http or https address, `allowed_link`), each value checked once
//! its character references are decoded: one class, one mark, and for the rest
//! the style properties and attribute values Stickies allows
//! (`allowed_attribute` in `../stickies/mod.rs`), so nothing else that names an
//! address, runs or escapes (no comment, no `url(`, no other function but
//! `rgb()`). The demo rebuilds it the same way before it shows it.
//!
//! The server owns the revision: 0 before the first save, one more with each.
//! `base` is the revision the writer last had. The write is stored only when
//! `base` is still the stored revision; any other base is refused with `409`
//! and `{"rev"}` of the stored one, and nothing changes, so a write made from
//! a stale copy never replaces what it did not see. The page then reads the
//! stored notes and merges its changes into them
//! (`demos/desktop/synced-document.ts`). Storage: one key, `library`, in the
//! session's own space, holding `{rev, data}` and written by compare-and-set.
//!
//! A note shared with another account leaves this document and is a document of
//! its own: `shared.rs`. A locked note is a sealed envelope: `locked.rs`.

mod locked;
mod shared;

use std::io;

use ferrite_app::serde;
use ferrite_app::serde_json;

use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture, Space};

use super::attachments::{self, NewAttachment};
use super::document;

pub const MODULE: AppModule = AppModule {
    name: "notes",
    title: "Notes",
    handle,
};

/// The folder every account has; it cannot be deleted.
pub const DEFAULT_FOLDER: &str = "notes";
pub const MAX_FOLDERS: usize = 100;
pub const MAX_NOTES: usize = 500;
pub const MAX_LINES: usize = 2_000;
pub const MAX_LINE_CHARS: usize = 10_000;
/// The most text one note may hold, all lines together.
pub const MAX_NOTE_CHARS: usize = 50_000;
pub const MAX_NAME_CHARS: usize = 100;
/// The longest date text (`"September 20, 2018 at 10:12 AM"`).
const MAX_DATE_CHARS: usize = 64;
/// The largest thumbnail kept, as a `data:image/` URL.
pub const MAX_PICTURE_CHARS: usize = 96_000;
/// The longest text with formats (`html`) one note may carry.
pub const MAX_HTML_CHARS: usize = 100_000;
/// The most files one note names.
pub const MAX_NOTE_FILES: usize = 50;
const KEY: &str = "library";

/// The elements a note's `html` may hold: those formatting writes
/// (`richTextFromHtml` in `src/lib/rich-text.ts`) and the tables of Notes.
const HTML_ELEMENTS: &[&str] = &[
    "div",
    "p",
    "br",
    "span",
    "font",
    "b",
    "i",
    "u",
    "s",
    "strike",
    "strong",
    "em",
    "sub",
    "sup",
    "ul",
    "ol",
    "li",
    "blockquote",
    "pre",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "table",
    "tbody",
    "tr",
    "td",
    "a",
];
/// The attributes those elements may carry.
const HTML_ATTRIBUTES: &[&str] = &[
    "style",
    "class",
    "color",
    "face",
    "size",
    "align",
    BODY_ATTRIBUTE,
    CHECKED_ATTRIBUTE,
    "dir",
    "href",
];
/// The classes the demo gives its elements: a table Add Table made, and the
/// two kinds of list that are `ul` elements with a look of their own.
const CLASSES: &[&str] = &["mac-notes-table", "mac-notes-checklist", "mac-notes-dashed"];
/// The mark of a ticked item of a checklist, whose one value is `true`.
const CHECKED_ATTRIBUTE: &str = "data-checked";
/// The mark of a first line made body text (`BODY_ATTRIBUTE` in
/// `demos/notes/notes-editor.tsx`): without it the first line is the title.
const BODY_ATTRIBUTE: &str = "data-paragraph";
/// The one value of [`BODY_ATTRIBUTE`].
const BODY_VALUE: &str = "body";

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Folder {
    pub id: String,
    pub name: String,
    /// The folder that holds this one; absent at the top of the sidebar.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent: Option<String>,
    /// The folder belongs to the On My Mac account, which the sidebar lists on its own.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub local: Option<bool>,
}

/// The stand-in picture a note shows.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum Attachment {
    Screenshot,
    Photo,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Note {
    pub id: String,
    pub folder: String,
    pub lines: Vec<String>,
    /// The text with its formats, as the editor holds it without its
    /// pictures; absent for plain lines and for a note saved before formats
    /// were kept.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub html: Option<String>,
    pub date: String,
    pub edited: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub attachment: Option<Attachment>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub picture: Option<String>,
    /// The files attached to the note.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub files: Vec<attachments::Attachment>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub locked: Option<bool>,
    /// A locked note's text, encrypted in the page (`locked.rs`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sealed: Option<locked::Sealed>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pinned: Option<bool>,
    /// When the note was made, as an ISO date; absent for an older note.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created: Option<String>,
    /// When the note went to Recently Deleted, as an ISO date.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub deleted: Option<String>,
}

/// What a session stores.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Data {
    pub folders: Vec<Folder>,
    pub notes: Vec<Note>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Put {
    /// The revision the writer last had; the write is stored only on it.
    base: u64,
    data: Data,
}

/// What the session's key holds: the document and the revision that wrote it.
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Stored {
    rev: u64,
    data: Data,
    /// The writes that named themselves (`document.rs`).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    writes: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    writes_from: Option<u64>,
}

/// How many times a write tries its compare-and-set while others get in.
const CAS_ATTEMPTS: usize = 8;

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

/// A file of a note: uploaded in pieces as Mail's are (`attachments.rs`), held
/// by the save that names it, and read only by its owner and the people on a
/// shared note that names it.
async fn attachment_route(cx: &mut ApiCtx<'_>, method: &str, path: &str) -> io::Result<Response> {
    if cx.session.account.is_none() {
        return Ok(Response::error(401, "sign in to use Notes"));
    }
    let segments: Vec<&str> = path.trim_start_matches('/').split('/').collect();
    let (ctx, now_ms) = (cx.ctx, cx.now_ms);
    Ok(match (method, segments.as_slice()) {
        ("POST", ["attachments"]) => match cx.request.json::<NewAttachment>() {
            Ok(new) => {
                attachments::sweep(&mut cx.storage.user(), ctx, MODULE.name, now_ms).await;
                attachments::stage(&mut cx.storage.user(), &new, now_ms).await
            }
            Err(response) => response,
        },
        ("PUT", ["attachments", id, n]) => {
            let Ok(n) = n.parse::<u32>() else {
                return Ok(Response::error(400, "the piece is a number"));
            };
            let body = cx.request.body;
            attachments::put_piece(
                &mut cx.storage.user(),
                ctx,
                MODULE.name,
                id,
                n,
                body,
                now_ms,
            )
            .await
        }
        ("POST", ["attachments", id, "complete"]) => {
            attachments::seal(&mut cx.storage.user(), id, now_ms).await
        }
        ("DELETE", ["attachments", id]) => {
            attachments::cancel(&mut cx.storage.user(), ctx, MODULE.name, id, now_ms).await
        }
        ("GET", ["attachments", id]) => {
            let (first, count) = match attachments::read_range(
                cx.request.query_param("piece"),
                cx.request.query_param("count"),
            ) {
                Ok(range) => range,
                Err(response) => return Ok(response),
            };
            let stored = cx.storage.user().get_json::<Stored>(KEY).await?;
            let mut found = stored.as_ref().and_then(|stored| {
                stored
                    .data
                    .notes
                    .iter()
                    .flat_map(|note| &note.files)
                    .find(|file| file.id == *id)
                    .cloned()
            });
            if found.is_none() {
                if let Some(me) = cx.session.account.clone().filter(|account| !account.guest) {
                    found = shared::notes_of(cx, &me.id)
                        .await?
                        .iter()
                        .flat_map(|doc| &doc.note.files)
                        .find(|file| file.id == *id)
                        .cloned();
                }
            }
            match found {
                Some(file) => attachments::read(ctx, MODULE.name, &file, first, count).await,
                None => Response::error(404, "no note holds this attachment"),
            }
        }
        (_, ["attachments", ..]) => Response::method_not_allowed(),
        _ => Response::not_found(),
    })
}

/// A file the page names is the stored record of it, or one of the person's
/// own uploads, which this save holds. `Err` is the reply that refuses the save.
async fn settle_files(
    user: &mut Space<'_>,
    data: &mut Data,
    now_ms: u64,
) -> io::Result<Result<(), Response>> {
    if data.notes.iter().all(|note| note.files.is_empty()) {
        return Ok(Ok(()));
    }
    let stored = user.get_json::<Stored>(KEY).await?;
    let mut files: std::collections::BTreeMap<String, attachments::Attachment> = stored
        .iter()
        .flat_map(|stored| &stored.data.notes)
        .flat_map(|note| &note.files)
        .map(|file| (file.id.clone(), file.clone()))
        .collect();
    let new: std::collections::BTreeSet<String> = data
        .notes
        .iter()
        .flat_map(|note| &note.files)
        .filter(|file| !files.contains_key(&file.id))
        .map(|file| file.id.clone())
        .collect();
    if !new.is_empty() {
        let ids: Vec<String> = new.into_iter().collect();
        match attachments::hold(user, &ids, now_ms).await {
            Ok(held) => files.extend(held.into_iter().map(|file| (file.id.clone(), file))),
            Err(refusal) => return Ok(Err(refusal.reply())),
        }
    }
    for file in data.notes.iter_mut().flat_map(|note| &mut note.files) {
        if let Some(record) = files.get(&file.id) {
            *file = record.clone();
        }
    }
    Ok(Ok(()))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    let (method, path) = (cx.request.method, cx.request.path);
    if path == "/attachments" || path.starts_with("/attachments/") {
        return attachment_route(&mut cx, method, path)
            .await
            .unwrap_or_else(|error| Response::error(503, &format!("storage failed: {error}")));
    }
    let outcome = match (cx.request.method, cx.request.path) {
        ("GET", "/data") => {
            let mut user = cx.storage.user();
            let stored = user.get_json::<Stored>(KEY).await;
            stored.map(|stored| {
                match &stored {
                    Some(s) => user
                        .write_ids()
                        .heard(&s.writes, s.writes_from.unwrap_or(s.rev)),
                    None => user.write_ids().heard(&[], 0),
                }
                let rev = stored.as_ref().map_or(0, |s| s.rev);
                let data = stored.map(|s| {
                    let mut data = s.data;
                    locked::without_empty_flags(&mut data);
                    data
                });
                Response::json(200, &serde_json::json!({ "data": data, "rev": rev }))
            })
        }
        ("PUT", "/data") => {
            let mut put = match cx.request.json::<Put>() {
                Ok(put) => put,
                Err(response) => return response,
            };
            locked::without_empty_flags(&mut put.data);
            if let Err(message) = validate(&put.data) {
                return Response::error(400, &message);
            }
            let now_ms = cx.now_ms;
            match settle_files(&mut cx.storage.user(), &mut put.data, now_ms).await {
                Ok(Ok(())) => {}
                Ok(Err(refused)) => return refused,
                Err(error) => {
                    return Response::error(503, &format!("storage failed: {error}"));
                }
            }
            let Some(rev) = put.base.checked_add(1) else {
                return Response::error(400, "base is past the last revision");
            };
            let body = serde_json::json!({ "rev": rev, "data": put.data });
            put_revised(&mut cx.storage.user(), put.base, &put.data, &body)
                .await
                .map(|written| match written {
                    Ok(()) => Response::json(200, &serde_json::json!({ "rev": rev })),
                    Err(Refused::Stale(stored)) => Response::json(
                        409,
                        &serde_json::json!({ "error": "the notes have changed since that revision", "rev": stored }),
                    ),
                    Err(Refused::Lock(why)) => Response::error(400, &why),
                })
        }
        (_, "/data") => Ok(Response::method_not_allowed()),
        ("PUT", "/locked") => locked::put(&mut cx).await,
        (_, "/locked") => Ok(Response::method_not_allowed()),
        ("GET", "/shared") => shared::notes(&mut cx).await,
        ("POST", "/shared") => shared::share(&mut cx).await,
        (_, "/shared") => Ok(Response::method_not_allowed()),
        (method, path) if path.starts_with("/shared/") => {
            shared_route(&mut cx, method, &path["/shared/".len()..]).await
        }
        _ => Ok(Response::not_found()),
    };
    outcome.unwrap_or_else(|error| Response::error(503, &format!("storage failed: {error}")))
}

/// The routes of one shared note (`shared.rs`): `<id>`, `<id>/people[/<name>]`,
/// `<id>/leave` and `<id>/stop`.
async fn shared_route(cx: &mut ApiCtx<'_>, method: &str, rest: &str) -> io::Result<Response> {
    let (id, tail) = rest.split_once('/').unwrap_or((rest, ""));
    if !shared::is_shared_id(id) {
        return Ok(Response::not_found());
    }
    match (method, tail) {
        ("PUT", "") => shared::put(cx, id).await,
        ("POST", "people") => shared::add_person(cx, id).await,
        ("POST", "leave") => shared::leave(cx, id).await,
        ("POST", "stop") => shared::stop(cx, id).await,
        (_, "" | "people" | "leave" | "stop") => Ok(Response::method_not_allowed()),
        _ => match tail.strip_prefix("people/") {
            Some(name) if method == "DELETE" => shared::remove_person(cx, id, name).await,
            Some(_) => Ok(Response::method_not_allowed()),
            None => Ok(Response::not_found()),
        },
    }
}

/// Why a whole-document save was not written.
enum Refused {
    /// The stored revision is another: this one.
    Stale(u64),
    /// It would change a lock (`locked::seals_kept`).
    Lock(String),
}

/// Write `body`, which holds `data`, if the stored revision is still `base`
/// and the save leaves every lock as it is: a compare-and-set, tried again
/// while other writers get in between.
async fn put_revised(
    user: &mut Space<'_>,
    base: u64,
    data: &Data,
    body: &serde_json::Value,
) -> io::Result<Result<(), Refused>> {
    for _ in 0..CAS_ATTEMPTS {
        let current = user.get_versioned(KEY).await?;
        // Only an absent document is revision 0: one that cannot be read is never overwritten.
        let (stored, writes, from, seals) = match &current {
            None => (0, Vec::new(), None, locked::seals_kept(None, data)),
            Some((value, _)) => {
                // The whole stored value is read: a revision beside a document that cannot be
                // read does not make the document replaceable.
                let stored = serde_json::from_slice::<Stored>(value).map_err(|e| {
                    io::Error::new(
                        io::ErrorKind::InvalidData,
                        format!("the stored notes are unreadable: {e}"),
                    )
                })?;
                let seals = locked::seals_kept(Some(&stored.data), data);
                (stored.rev, stored.writes, stored.writes_from, seals)
            }
        };
        if stored != base {
            return Ok(Err(Refused::Stale(stored)));
        }
        if let Err(why) = seals {
            return Ok(Err(Refused::Lock(why)));
        }
        let (writes, from) = document::with_write(writes, from, stored, user.write_ids().this());
        let mut next = body.clone();
        document::stamp_writes(&mut next, &writes, from);
        let bytes = serde_json::to_vec(&next)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;
        let expected = current.map(|(_, version)| version);
        if user.put_if_version(KEY, &bytes, expected).await? {
            return Ok(Ok(()));
        }
    }
    Err(io::Error::other("the notes kept changing under this write"))
}

fn chars(text: &str) -> usize {
    text.chars().count()
}

/// An id the demo makes: 1 to 64 letters, digits, `-` and `_`.
fn is_id(id: &str) -> bool {
    (1..=64).contains(&id.len())
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

/// Bound a submitted document and check that it hangs together.
pub fn validate(data: &Data) -> Result<(), String> {
    if data.folders.len() > MAX_FOLDERS {
        return Err(format!("at most {MAX_FOLDERS} folders"));
    }
    if data.notes.len() > MAX_NOTES {
        return Err(format!("at most {MAX_NOTES} notes"));
    }
    let mut folders = std::collections::BTreeSet::new();
    for folder in &data.folders {
        if !is_id(&folder.id) {
            return Err(format!(
                "folder id {:?} must be 1 to 64 letters, digits, '-' or '_'",
                folder.id
            ));
        }
        if !folders.insert(folder.id.as_str()) {
            return Err(format!("folder id {:?} is used twice", folder.id));
        }
        let name = chars(folder.name.trim());
        if name == 0 || chars(&folder.name) > MAX_NAME_CHARS {
            return Err(format!(
                "folder {:?} needs a name of 1 to {MAX_NAME_CHARS} characters",
                folder.id
            ));
        }
    }
    if !folders.contains(DEFAULT_FOLDER) {
        return Err(format!("the {DEFAULT_FOLDER:?} folder cannot be removed"));
    }
    let parents: std::collections::BTreeMap<&str, &str> = data
        .folders
        .iter()
        .filter_map(|folder| Some((folder.id.as_str(), folder.parent.as_deref()?)))
        .collect();
    for folder in &data.folders {
        let mut at = folder.id.as_str();
        let mut steps = 0;
        while let Some(&parent) = parents.get(at) {
            if !folders.contains(parent) {
                return Err(format!(
                    "folder {:?} is in a folder that does not exist",
                    folder.id
                ));
            }
            steps += 1;
            if parent == folder.id || steps > data.folders.len() {
                return Err(format!("folder {:?} is inside itself", folder.id));
            }
            at = parent;
        }
    }
    let mut notes = std::collections::BTreeSet::new();
    for note in &data.notes {
        if !is_id(&note.id) {
            return Err(format!(
                "note id {:?} must be 1 to 64 letters, digits, '-' or '_'",
                note.id
            ));
        }
        if !notes.insert(note.id.as_str()) {
            return Err(format!("note id {:?} is used twice", note.id));
        }
        if !folders.contains(note.folder.as_str()) {
            return Err(format!(
                "note {:?} is in a folder that does not exist",
                note.id
            ));
        }
        if note.lines.len() > MAX_LINES
            || note.lines.iter().any(|line| chars(line) > MAX_LINE_CHARS)
            || note.lines.iter().map(|line| chars(line)).sum::<usize>() > MAX_NOTE_CHARS
        {
            return Err(format!(
                "note {:?} is too long: at most {MAX_LINES} lines of {MAX_LINE_CHARS} characters, {MAX_NOTE_CHARS} in all",
                note.id
            ));
        }
        if chars(&note.date) > MAX_DATE_CHARS
            || chars(&note.edited) > MAX_DATE_CHARS
            || note
                .created
                .as_deref()
                .is_some_and(|date| chars(date) > MAX_DATE_CHARS)
            || note
                .deleted
                .as_deref()
                .is_some_and(|date| chars(date) > MAX_DATE_CHARS)
        {
            return Err(format!("note {:?} has an overlong date", note.id));
        }
        if note.files.len() > MAX_NOTE_FILES {
            return Err(format!(
                "note {:?}: at most {MAX_NOTE_FILES} files",
                note.id
            ));
        }
        if let Some(picture) = &note.picture {
            if !picture.starts_with("data:image/") || picture.len() > MAX_PICTURE_CHARS {
                return Err(format!(
                    "note {:?}: a picture is a data:image/ URL of at most {MAX_PICTURE_CHARS} characters",
                    note.id
                ));
            }
        }
        if let Some(html) = &note.html {
            if chars(html) > MAX_HTML_CHARS {
                return Err(format!(
                    "note {:?}: its formats are at most {MAX_HTML_CHARS} characters",
                    note.id
                ));
            }
            validate_html(html).map_err(|why| format!("note {:?}: {why}", note.id))?;
        }
        locked::check(note)?;
    }
    Ok(())
}

/// Whether `value` of attribute `name` is one formatting writes, once its
/// character references are decoded as a browser decodes them: the classes
/// Notes gives its tables and lists, the one value of the mark of a first line
/// made body text and of a ticked item, and for the other attributes the values
/// Stickies allows, which
/// `richTextFromHtml` keeps for both (style properties and values from an
/// allow-list, so no address, script, escape or comment).
fn allowed_value(name: &str, value: &str) -> bool {
    let Ok(value) = super::stickies::decode_references(value) else {
        return false;
    };
    match name {
        "class" => CLASSES.contains(&value.as_str()),
        BODY_ATTRIBUTE => value == BODY_VALUE,
        CHECKED_ATTRIBUTE => value == "true",
        "dir" => matches!(value.as_str(), "ltr" | "rtl"),
        "href" => allowed_link(&value),
        _ => super::stickies::allowed_attribute(name, &value).is_ok(),
    }
}

/// Whether `value` is a link the demo keeps (`NOTES_HTML` in
/// `demos/notes/notes-editor.tsx`): an http or https address, with nothing
/// that could leave the attribute.
fn allowed_link(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    let rest = lower
        .strip_prefix("https://")
        .or_else(|| lower.strip_prefix("http://"));
    rest.is_some_and(|rest| {
        (1..=4096).contains(&rest.chars().count())
            && !rest
                .chars()
                .any(|c| c.is_whitespace() || matches!(c, '"' | '\'' | '<' | '>' | '\\'))
    })
}

/// Check a note's `html` as the editor's content is serialized (attribute
/// values quoted, `<` in text written `&lt;`): every tag is one of
/// [`HTML_ELEMENTS`] with only [`HTML_ATTRIBUTES`], and there is nothing else
/// that markup could be (a comment, a declaration, an instruction).
pub fn validate_html(html: &str) -> Result<(), String> {
    let bytes = html.as_bytes();
    let mut at = 0;
    while let Some(offset) = html[at..].find('<') {
        at += offset + 1;
        let closing = bytes.get(at) == Some(&b'/');
        if closing {
            at += 1;
        }
        let start = at;
        while bytes.get(at).is_some_and(u8::is_ascii_alphanumeric) {
            at += 1;
        }
        let tag = html[start..at].to_ascii_lowercase();
        if !HTML_ELEMENTS.contains(&tag.as_str()) {
            return Err(if tag.is_empty() {
                "its formats hold markup that is not an element".into()
            } else {
                format!("its formats hold a <{tag}> element, which formatting does not write")
            });
        }
        // The attributes, up to the end of the tag.
        loop {
            while bytes.get(at).is_some_and(u8::is_ascii_whitespace) {
                at += 1;
            }
            match bytes.get(at) {
                None => return Err(format!("its formats end inside a <{tag}> tag")),
                Some(b'>') => {
                    at += 1;
                    break;
                }
                Some(b'/') if !closing && bytes.get(at + 1) == Some(&b'>') => {
                    at += 2;
                    break;
                }
                Some(_) if closing => {
                    return Err(format!("its formats hold a malformed </{tag}> tag"))
                }
                Some(_) => {}
            }
            let name_start = at;
            while bytes
                .get(at)
                .is_some_and(|b| b.is_ascii_alphanumeric() || *b == b'-')
            {
                at += 1;
            }
            let name = html[name_start..at].to_ascii_lowercase();
            if !HTML_ATTRIBUTES.contains(&name.as_str()) {
                return Err(if name.is_empty() {
                    format!("its formats hold a malformed <{tag}> tag")
                } else {
                    format!("its formats give <{tag}> a {name:?} attribute, which formatting does not write")
                });
            }
            if bytes.get(at) != Some(&b'=') {
                // An attribute without a value: its value is empty.
                if !allowed_value(&name, "") {
                    return Err(format!(
                        "its formats give <{tag}> a {name:?} that formatting does not write"
                    ));
                }
                continue;
            }
            at += 1;
            let quote = match bytes.get(at) {
                Some(&quote @ (b'"' | b'\'')) => quote,
                _ => return Err(format!("its formats give <{tag}> an unquoted {name:?}")),
            };
            at += 1;
            let Some(length) = html[at..].find(quote as char) else {
                return Err(format!(
                    "its formats end inside the {name:?} of a <{tag}> tag"
                ));
            };
            let value = &html[at..at + length];
            at += length + 1;
            if !allowed_value(&name, value) {
                return Err(format!(
                    "its formats give <{tag}> a {name:?} that formatting does not write"
                ));
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn note(id: &str, folder: &str) -> Note {
        Note {
            id: id.into(),
            folder: folder.into(),
            lines: vec!["Groceries".into(), "Milk".into()],
            html: None,
            date: "3:55 PM".into(),
            edited: "October 3, 2019 at 3:55 PM".into(),
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

    fn folder(id: &str, parent: Option<&str>) -> Folder {
        Folder {
            local: None,
            id: id.into(),
            name: id.into(),
            parent: parent.map(Into::into),
        }
    }

    #[test]
    fn a_folder_sits_in_a_folder_that_exists_and_never_inside_itself() {
        let mut with = data(vec![]);
        with.folders.push(folder("a", Some("b")));
        assert!(validate(&with).unwrap_err().contains("does not exist"));
        with.folders.push(folder("b", Some("a")));
        assert!(validate(&with).unwrap_err().contains("inside itself"));
        with.folders[2].parent = None;
        assert!(validate(&with).is_ok());
    }

    #[test]
    fn a_checklist_keeps_its_class_and_its_ticks_only() {
        assert!(validate_html(
            r#"<ul class="mac-notes-checklist"><li data-checked="true">Milk</li><li>Eggs</li></ul>"#
        )
        .is_ok());
        assert!(validate_html(r#"<ul class="mac-notes-dashed"><li>Milk</li></ul>"#).is_ok());
        assert!(validate_html(r#"<li data-checked="maybe">Milk</li>"#).is_err());
        assert!(validate_html(r#"<ul class="other"><li>Milk</li></ul>"#).is_err());
    }

    #[test]
    fn pins_and_dates_round_trip_and_are_bounded() {
        let json = r#"{"folders":[{"id":"notes","name":"Notes"}],"notes":[{"id":"n","folder":"notes","lines":["A"],
            "date":"d","edited":"e","pinned":true,"created":"2026-11-02T10:00:00.000Z","deleted":"2026-11-02T11:00:00.000Z"}]}"#;
        let read: Data = serde_json::from_str(json).unwrap();
        assert!(validate(&read).is_ok());
        assert_eq!(read.notes[0].pinned, Some(true));
        assert_eq!(
            read.notes[0].deleted.as_deref(),
            Some("2026-11-02T11:00:00.000Z")
        );
        let mut long = read.clone();
        long.notes[0].deleted = Some("x".repeat(MAX_DATE_CHARS + 1));
        assert!(validate(&long).is_err());
    }

    fn data(notes: Vec<Note>) -> Data {
        Data {
            folders: vec![folder(DEFAULT_FOLDER, None)],
            notes,
        }
    }

    #[test]
    fn the_demo_shape_round_trips() {
        let json = r#"{"base":0,"data":{"folders":[{"id":"notes","name":"Notes"},{"id":"new-folder-1","name":"New Folder"}],
            "notes":[{"id":"catalina","folder":"notes","lines":["Catalina",""],"date":"3:55 PM",
            "edited":"October 3, 2019 at 3:55 PM","attachment":"screenshot","locked":true}]}}"#;
        let put: Put = serde_json::from_str(json).unwrap();
        validate(&put.data).unwrap();
        assert_eq!(put.data.notes[0].attachment, Some(Attachment::Screenshot));
        let stored = serde_json::to_value(&put.data).unwrap();
        assert!(
            stored["notes"][0].get("picture").is_none(),
            "absent stays absent"
        );
        assert_eq!(serde_json::from_value::<Data>(stored).unwrap(), put.data);
    }

    #[test]
    fn the_default_folder_and_each_note_folder_must_exist() {
        assert!(validate(&data(vec![note("a", "notes")])).is_ok());
        assert!(validate(&data(vec![note("a", "gone")])).is_err());
        let mut without = data(vec![]);
        without.folders[0].id = "other".into();
        assert!(validate(&without).is_err(), "the Notes folder stays");
        assert!(validate(&data(vec![note("a", "notes"), note("a", "notes")])).is_err());
    }

    #[test]
    fn a_note_names_its_files_up_to_the_limit() {
        let stored = r#"{"folders":[{"id":"notes","name":"Notes"}],
            "notes":[{"id":"a","folder":"notes","lines":["x"],"date":"","edited":"",
            "files":[{"id":"f1","name":"report.pdf","type":"application/pdf","size":2500}]}]}"#;
        let data: Data = serde_json::from_str(stored).unwrap();
        assert_eq!(data.notes[0].files[0].name, "report.pdf");
        assert!(validate(&data).is_ok());
        let mut many = data.clone();
        many.notes[0].files = vec![data.notes[0].files[0].clone(); MAX_NOTE_FILES + 1];
        assert_eq!(
            validate(&many),
            Err(format!("note \"a\": at most {MAX_NOTE_FILES} files"))
        );
    }

    #[test]
    fn pictures_must_be_small_data_urls() {
        let mut with = note("a", "notes");
        with.picture = Some("blob:http://localhost/1234".into());
        assert!(
            validate(&data(vec![with.clone()])).is_err(),
            "an object URL dies with the page"
        );
        with.picture = Some(format!(
            "data:image/png;base64,{}",
            "A".repeat(MAX_PICTURE_CHARS)
        ));
        assert!(validate(&data(vec![with.clone()])).is_err());
        with.picture = Some("data:image/png;base64,AAAA".into());
        assert!(validate(&data(vec![with])).is_ok());
    }

    #[test]
    fn overlong_notes_are_refused() {
        let mut long = note("a", "notes");
        long.lines = vec!["x".repeat(MAX_LINE_CHARS + 1)];
        assert!(validate(&data(vec![long.clone()])).is_err());
        long.lines = vec!["x".repeat(MAX_LINE_CHARS); MAX_NOTE_CHARS / MAX_LINE_CHARS + 1];
        assert!(
            validate(&data(vec![long])).is_err(),
            "the whole note is bounded too"
        );
    }

    /// What the demo sends for a note with formats, as Chromium, Firefox and
    /// WebKit serialize what their editing commands write.
    const FORMATTED: &str = concat!(
        r#"<div><span style="font-weight: bold;">Groceries</span></div>"#,
        r#"<div style="text-align: center;"><i>Milk</i> &amp; <u>eggs</u> &lt;3</div>"#,
        r#"<h1>Title</h1><h2>Heading</h2><div>○ Bread</div>"#,
        r#"<div><span style="font-family: &quot;Helvetica Neue&quot;, Helvetica, Arial, sans-serif; font-size: 24px;">Big</span>"#,
        r##"<font color="#ff0000" face="Georgia">red</font><strike>gone</strike><br></div>"##,
        r#"<table class="mac-notes-table"><tbody><tr><td>a</td><td><br></td></tr></tbody></table>"#,
    );

    #[test]
    fn formats_are_kept_with_the_note_and_old_notes_still_load() {
        let mut formatted = note("a", "notes");
        formatted.html = Some(FORMATTED.into());
        let stored = data(vec![formatted, note("b", "notes")]);
        validate(&stored).unwrap();
        let json = serde_json::to_value(&stored).unwrap();
        assert_eq!(json["notes"][0]["html"], FORMATTED);
        assert!(
            json["notes"][1].get("html").is_none(),
            "plain lines carry no html"
        );
        assert_eq!(serde_json::from_value::<Data>(json).unwrap(), stored);

        // A document stored before formats were kept reads as it was.
        let old = r#"{"rev":3,"data":{"folders":[{"id":"notes","name":"Notes"}],
            "notes":[{"id":"a","folder":"notes","lines":["Old"],"date":"","edited":""}]}}"#;
        let read: Stored = serde_json::from_str(old).unwrap();
        assert_eq!(read.rev, 3);
        assert_eq!(read.data.notes[0].html, None);
        validate(&read.data).unwrap();
    }

    #[test]
    fn formats_hold_only_what_formatting_writes() {
        let refused = [
            "<script>alert(1)</script>",
            r#"<img src="x" onerror="alert(1)">"#,
            r#"<div onclick="alert(1)">x</div>"#,
            r#"<a href="javascript:alert(1)">x</a>"#,
            r#"<a href="jav&#97;script:alert(1)">x</a>"#,
            r#"<a href="data:text/html,x">x</a>"#,
            r#"<a href="https://">x</a>"#,
            r#"<div dir="up">x</div>"#,
            r#"<div style="background-image: url(https://example.com/x)">x</div>"#,
            r#"<span style="width: expression(alert(1))">x</span>"#,
            r#"<span style="font-family: \61 bc">x</span>"#,
            r#"<table class="other"><tbody><tr><td>x</td></tr></tbody></table>"#,
            r#"<div class="mac-notes-attachment" data-attachment="">x</div>"#,
            "<!-- a comment --><div>x</div>",
            "<!DOCTYPE html><div>x</div>",
            "<?xml version=\"1.0\"?>",
            "<svg><script>alert(1)</script></svg>",
            "<div style=red>x</div>",
            r#"<div style="color: red"#,
            "<div",
            "</div x>",
            "< div>x</div>",
        ];
        for html in refused {
            assert!(validate_html(html).is_err(), "{html} is refused");
            let mut with = note("a", "notes");
            with.html = Some(html.into());
            assert!(validate(&data(vec![with])).is_err(), "{html} is refused");
        }
        assert!(validate_html(FORMATTED).is_ok());
        assert!(validate_html(r#"<a href="https://example.com/x">x</a>"#).is_ok());
        assert!(validate_html(r#"<div dir="rtl">x</div>"#).is_ok());
        assert!(validate_html("").is_ok());
        assert!(
            validate_html("Bare first line<DIV ALIGN='center'>x</DIV><br/>").is_ok(),
            "case and the other quote"
        );
    }

    #[test]
    fn encoded_payloads_are_decoded_before_they_are_checked() {
        let refused = [
            r#"<div style="background-image: u&#114;l(https://example.com/x)">x</div>"#,
            r#"<div style="color: u&#x72;l(https://example.com/x)">x</div>"#,
            r#"<div style="color: &#92;75 rl(https://example.com/x)">x</div>"#,
            r#"<div style="color: &#x5C;75 rl(https://example.com/x)">x</div>"#,
            r#"<div style="&#98;ackground: red">x</div>"#,
            r#"<div style="color: e&#120;pression(alert(1))">x</div>"#,
            r#"<div style="color: red&#47;&#42;x&#42;&#47;">x</div>"#,
            r#"<div style="color: u&#114l(https://example.com/x)">x</div>"#,
            r#"<div style="color: &lpar;">x</div>"#,
            r#"<table class="mac-notes-table&#32;x"><tbody><tr><td>x</td></tr></tbody></table>"#,
            r#"<div data-paragraph="body&#59;">x</div>"#,
            r#"<font face="Georgia&#59; x">x</font>"#,
            r#"<font size="&#56;">x</font>"#,
        ];
        for html in refused {
            assert!(validate_html(html).is_err(), "{html} is refused");
        }
        for html in [
            r#"<div data-paragraph="b&#111;dy">x</div>"#,
            r#"<table class="mac-notes-&#116;able"><tbody><tr><td>x</td></tr></tbody></table>"#,
            r#"<span style="color: rgb(255, 0, 0); text-decoration-line: line-through">x</span>"#,
            r##"<font color="&#35;f00" size="&#55;">x</font>"##,
        ] {
            assert!(validate_html(html).is_ok(), "{html} is kept");
        }
    }

    #[test]
    fn formats_are_bounded() {
        let mut big = note("a", "notes");
        big.html = Some(format!("<b>{}</b>", "x".repeat(MAX_HTML_CHARS)));
        assert!(validate(&data(vec![big.clone()])).is_err());
        big.html = Some(format!("<b>{}</b>", "x".repeat(MAX_HTML_CHARS - 7)));
        assert!(validate(&data(vec![big])).is_ok());
    }

    #[test]
    fn a_first_line_made_body_text_keeps_its_mark() {
        let marked = r#"<div data-paragraph="body">Groceries</div><div>Milk</div>"#;
        assert!(validate_html(marked).is_ok());
        let mut with = note("a", "notes");
        with.html = Some(marked.into());
        let stored = data(vec![with]);
        validate(&stored).unwrap();
        let json = serde_json::to_value(&stored).unwrap();
        assert_eq!(json["notes"][0]["html"], marked);
        assert!(
            validate_html("<DIV DATA-PARAGRAPH='body'>x</DIV>").is_ok(),
            "case and the other quote"
        );
    }

    #[test]
    fn the_body_mark_has_one_value() {
        let refused = [
            r#"<div data-paragraph="title">x</div>"#,
            r#"<div data-paragraph="Body">x</div>"#,
            r#"<div data-paragraph="body ">x</div>"#,
            r#"<div data-paragraph="">x</div>"#,
            "<div data-paragraph>x</div>",
            r#"<div data-paragraph="javascript:alert(1)">x</div>"#,
            r#"<div data-paragraph=body>x</div>"#,
            r#"<div data-paragraphs="body">x</div>"#,
            r#"<div data-other="body">x</div>"#,
        ];
        for html in refused {
            assert!(validate_html(html).is_err(), "{html} is refused");
            let mut with = note("a", "notes");
            with.html = Some(html.into());
            assert!(validate(&data(vec![with])).is_err(), "{html} is refused");
        }
    }
}

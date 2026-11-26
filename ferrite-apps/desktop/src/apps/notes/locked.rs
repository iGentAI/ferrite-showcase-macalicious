//! Notes' password lock, on the server: only ciphertext.
//!
//! The page derives a key from the person's notes password (PBKDF2, in the
//! browser) and seals a note's text with AES-GCM; neither password nor key is
//! ever sent. A locked note in the document is an envelope ([`Sealed`]) and
//! carries no lines, formats, picture or files, which [`check`] enforces.
//!
//! * `PUT /api/notes/locked` with `{"base"?, "changes": [...], "add": [...]}`
//!   changes locked notes, all of them or none, in one compare-and-set of the
//!   document. Each change names its note's revision (`rev`, kept on the
//!   envelope, one more with each change). A lock starts at the document's next
//!   revision, so a note whose lock was removed and made again never repeats a
//!   revision a late save may still name:
//!   * `{"id", "rev": 0, "sealed"}` locks a plain note; with `rev` 0 `base`
//!     must still be the document's revision, since a plain note has no
//!     revision of its own to name;
//!   * `{"id", "rev": n, "sealed", "date"?, "edited"?}` replaces the
//!     ciphertext: a save (with dates, moving the note to the top of the
//!     list) or a new password (without);
//!   * `{"id", "rev": n, "plain", "date"?, "edited"?}` removes the lock.
//!
//!   `add` makes new locked notes (`Keep as Copy` of a refused save). `200`
//!   answers `{"rev", "notes": {id: rev}}`. A revision that is not the note's,
//!   or a note that is gone, is `409` with `{"error", "rev", "refused": [ids]}`
//!   and nothing changes: a late save never replaces a note changed elsewhere.
//!
//! `PUT /data` cannot do any of this: [`seals_kept`] refuses a whole-document
//! save that changes an envelope or that makes a note locked or plain.

use std::collections::BTreeMap;
use std::io;

use ferrite_app::serde;
use ferrite_app::serde_json;

use crate::http::Response;
use crate::module::ApiCtx;

use super::document;
use super::{validate, Attachment, Data, Note, Stored, CAS_ATTEMPTS, KEY};

/// The key derivation's name (`VAULT_KDF` of the page's keychain, whose
/// derivation Notes shares).
const KDF_NAME: &str = "PBKDF2-SHA-256";
const MIN_ITERATIONS: u32 = 100_000;
const MAX_ITERATIONS: u32 = 10_000_000;
/// The longest ciphertext of one note, in base64 characters: every line, format
/// and thumbnail a plain note may hold, as JSON.
pub const MAX_SEALED_CHARS: usize = 800_000;
const MAX_HINT_CHARS: usize = 200;
/// The longest salt or IV, in base64 characters.
const MAX_NONCE_CHARS: usize = 64;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Kdf {
    pub name: String,
    pub iterations: u32,
    pub salt: String,
}

/// A locked note's text as the server keeps it.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Sealed {
    /// The note's revision, which this route alone sets.
    #[serde(default)]
    pub rev: u64,
    pub kdf: Kdf,
    pub iv: String,
    pub ciphertext: String,
    /// What the person wrote to remind them of the password, shown after a
    /// wrong one: not the note's, and in the clear as on a Mac.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hint: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Plain {
    lines: Vec<String>,
    #[serde(default)]
    html: Option<String>,
    #[serde(default)]
    attachment: Option<Attachment>,
    #[serde(default)]
    picture: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Change {
    id: String,
    rev: u64,
    #[serde(default)]
    sealed: Option<Sealed>,
    #[serde(default)]
    plain: Option<Plain>,
    #[serde(default)]
    date: Option<String>,
    #[serde(default)]
    edited: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Added {
    id: String,
    folder: String,
    date: String,
    edited: String,
    #[serde(default)]
    created: Option<String>,
    sealed: Sealed,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Request {
    #[serde(default)]
    base: Option<u64>,
    #[serde(default)]
    changes: Vec<Change>,
    #[serde(default)]
    add: Vec<Added>,
}

fn is_base64(text: &str) -> bool {
    !text.is_empty()
        && text.len() % 4 == 0
        && text
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'+' | b'/' | b'='))
}

/// Whether `sealed` is an envelope the page could have made.
fn check_envelope(sealed: &Sealed) -> Result<(), String> {
    let Kdf {
        name,
        iterations,
        salt,
    } = &sealed.kdf;
    if name != KDF_NAME || !(MIN_ITERATIONS..=MAX_ITERATIONS).contains(iterations) {
        return Err("a locked note names a key derivation Notes doesn't use".to_string());
    }
    for nonce in [salt, &sealed.iv] {
        if nonce.len() > MAX_NONCE_CHARS || !is_base64(nonce) {
            return Err("a locked note's salt or IV isn't base64".to_string());
        }
    }
    if sealed.ciphertext.len() > MAX_SEALED_CHARS {
        return Err(format!(
            "a locked note is at most {MAX_SEALED_CHARS} characters of ciphertext"
        ));
    }
    if !is_base64(&sealed.ciphertext) {
        return Err("a locked note's ciphertext isn't base64".to_string());
    }
    if sealed
        .hint
        .as_deref()
        .is_some_and(|hint| hint.chars().count() > MAX_HINT_CHARS)
    {
        return Err(format!(
            "a password hint is at most {MAX_HINT_CHARS} characters"
        ));
    }
    Ok(())
}

/// A note with an envelope is locked and keeps nothing else of its content.
pub(super) fn check(note: &Note) -> Result<(), String> {
    let Some(sealed) = &note.sealed else {
        return Ok(());
    };
    check_envelope(sealed).map_err(|why| format!("note {:?}: {why}", note.id))?;
    if note.locked != Some(true)
        || !note.lines.is_empty()
        || note.html.is_some()
        || note.attachment.is_some()
        || note.picture.is_some()
        || !note.files.is_empty()
    {
        return Err(format!(
            "note {:?} is locked, so the server keeps only its ciphertext",
            note.id
        ));
    }
    Ok(())
}

/// A flag no password ever stood behind (from before notes could be locked)
/// locks nothing: such a note is plain.
pub(super) fn without_empty_flags(data: &mut Data) {
    for note in &mut data.notes {
        if note.sealed.is_none() {
            note.locked = None;
        }
    }
}

/// Whether a whole-document save leaves every envelope as `stored` has it.
pub(super) fn seals_kept(stored: Option<&Data>, sent: &Data) -> Result<(), String> {
    let before: BTreeMap<&str, Option<&Sealed>> = stored
        .into_iter()
        .flat_map(|data| &data.notes)
        .map(|note| (note.id.as_str(), note.sealed.as_ref()))
        .collect();
    for note in &sent.notes {
        let was = before.get(note.id.as_str()).copied().flatten();
        if was != note.sealed.as_ref() {
            return Err(format!(
                "note {:?}: a lock changes only through /api/notes/locked",
                note.id
            ));
        }
    }
    Ok(())
}

/// Why a request changed nothing.
enum Refusal {
    /// Someone else got there first: the notes named.
    Stale(Vec<String>),
    /// What is asked can't be done to this note.
    Unfit(String),
}

fn apply(data: &mut Data, rev: u64, request: Request) -> Result<BTreeMap<String, u64>, Refusal> {
    let mut revisions = BTreeMap::new();
    let mut stale = Vec::new();
    for change in &request.changes {
        let current = data
            .notes
            .iter()
            .find(|note| note.id == change.id)
            .map_or(u64::MAX, |note| note.sealed.as_ref().map_or(0, |s| s.rev));
        let plain_moved = change.rev == 0 && request.base != Some(rev);
        if current != change.rev || plain_moved {
            stale.push(change.id.clone());
        }
    }
    if !stale.is_empty() {
        return Err(Refusal::Stale(stale));
    }
    for change in request.changes {
        let at = data
            .notes
            .iter()
            .position(|note| note.id == change.id)
            .ok_or_else(|| Refusal::Stale(vec![change.id.clone()]))?;
        let note = &mut data.notes[at];
        if change.rev == 0 {
            if !note.files.is_empty() {
                return Err(Refusal::Unfit(
                    "A note with attachments can\u{2019}t be locked.".to_string(),
                ));
            }
            if note.deleted.is_some() {
                return Err(Refusal::Unfit(
                    "Recover the note before you lock it.".to_string(),
                ));
            }
        }
        let next = if change.rev == 0 {
            rev + 1
        } else {
            change.rev + 1
        };
        match (change.sealed, change.plain) {
            (Some(mut sealed), None) => {
                sealed.rev = next;
                note.sealed = Some(sealed);
                note.locked = Some(true);
                note.lines = Vec::new();
                note.html = None;
                note.attachment = None;
                note.picture = None;
                revisions.insert(note.id.clone(), next);
            }
            (None, Some(plain)) if change.rev > 0 => {
                note.sealed = None;
                note.locked = None;
                note.lines = plain.lines;
                note.html = plain.html;
                note.attachment = plain.attachment;
                note.picture = plain.picture;
                revisions.insert(note.id.clone(), 0);
            }
            _ => {
                return Err(Refusal::Unfit(format!(
                    "note {:?}: a change is a new envelope, or the text of a lock taken off",
                    change.id
                )))
            }
        }
        if let Some(date) = change.date {
            note.date = date;
        }
        if let Some(edited) = change.edited {
            note.edited = edited;
            let moved = data.notes.remove(at);
            data.notes.insert(0, moved);
        }
    }
    for added in request.add {
        let mut sealed = added.sealed;
        sealed.rev = rev + 1;
        revisions.insert(added.id.clone(), rev + 1);
        data.notes.insert(
            0,
            Note {
                id: added.id,
                folder: added.folder,
                lines: Vec::new(),
                html: None,
                date: added.date,
                edited: added.edited,
                attachment: None,
                picture: None,
                files: Vec::new(),
                locked: Some(true),
                sealed: Some(sealed),
                pinned: None,
                created: added.created,
                deleted: None,
            },
        );
    }
    Ok(revisions)
}

fn data_error(error: impl std::fmt::Display) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, error.to_string())
}

/// `PUT /locked`.
pub(super) async fn put(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let body = cx.request.body;
    for _ in 0..CAS_ATTEMPTS {
        let request: Request = match serde_json::from_slice(body) {
            Ok(request) => request,
            Err(error) => {
                return Ok(Response::error(400, &format!("not a lock change: {error}")));
            }
        };
        if request.changes.is_empty() && request.add.is_empty() {
            return Ok(Response::error(400, "nothing to change"));
        }
        let this = cx.storage.user().write_ids().this().map(str::to_string);
        let mut user = cx.storage.user();
        let Some((bytes, version)) = user.get_versioned(KEY).await? else {
            return Ok(Response::json(
                409,
                &serde_json::json!({
                    "error": "There are no notes to change.",
                    "rev": 0,
                    "refused": request.changes.iter().map(|c| c.id.clone()).collect::<Vec<_>>(),
                }),
            ));
        };
        let mut stored: Stored = serde_json::from_slice(&bytes).map_err(data_error)?;
        let revisions = match apply(&mut stored.data, stored.rev, request) {
            Ok(revisions) => revisions,
            Err(Refusal::Stale(ids)) => {
                return Ok(Response::json(
                    409,
                    &serde_json::json!({
                        "error": "The note changed elsewhere since that revision.",
                        "rev": stored.rev,
                        "refused": ids,
                    }),
                ));
            }
            Err(Refusal::Unfit(why)) => return Ok(Response::error(400, &why)),
        };
        if let Err(why) = validate(&stored.data) {
            return Ok(Response::error(400, &why));
        }
        (stored.writes, stored.writes_from) = document::with_write(
            std::mem::take(&mut stored.writes),
            stored.writes_from,
            stored.rev,
            this.as_deref(),
        );
        stored.rev += 1;
        let next = serde_json::to_vec(&stored).map_err(data_error)?;
        if user.put_if_version(KEY, &next, Some(version)).await? {
            return Ok(Response::json(
                200,
                &serde_json::json!({ "rev": stored.rev, "notes": revisions }),
            ));
        }
    }
    Err(io::Error::other("the notes kept changing under this write"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sealed(rev: u64) -> Sealed {
        Sealed {
            rev,
            kdf: Kdf {
                name: KDF_NAME.to_string(),
                iterations: 100_000,
                salt: "c2FsdHNhbHRzYWx0c2FsdA==".to_string(),
            },
            iv: "aXZpdml2aXZpdml2".to_string(),
            ciphertext: "Y2lwaGVy".to_string(),
            hint: None,
        }
    }

    fn locked(id: &str, rev: u64) -> Note {
        Note {
            id: id.to_string(),
            folder: "notes".to_string(),
            lines: Vec::new(),
            html: None,
            date: "today".to_string(),
            edited: "today".to_string(),
            attachment: None,
            picture: None,
            files: Vec::new(),
            locked: Some(true),
            sealed: Some(sealed(rev)),
            pinned: None,
            created: None,
            deleted: None,
        }
    }

    #[test]
    fn a_locked_note_keeps_nothing_but_its_envelope() {
        assert_eq!(check(&locked("a", 1)), Ok(()));
        let with_text = Note {
            lines: vec!["secret".to_string()],
            ..locked("a", 1)
        };
        assert_eq!(
            check(&with_text),
            Err("note \"a\" is locked, so the server keeps only its ciphertext".to_string())
        );
        let unflagged = Note {
            locked: None,
            ..locked("a", 1)
        };
        assert!(check(&unflagged).is_err());
    }

    #[test]
    fn an_envelope_must_be_one_the_page_makes() {
        let mut weak = sealed(1);
        weak.kdf.iterations = 10;
        assert!(check_envelope(&weak).is_err());
        let mut text = sealed(1);
        text.ciphertext = "plain text!".to_string();
        assert!(check_envelope(&text).is_err());
        assert_eq!(check_envelope(&sealed(1)), Ok(()));
    }

    #[test]
    fn a_note_in_recently_deleted_stays_plain() {
        let plain = Note {
            locked: None,
            sealed: None,
            lines: vec!["Report".to_string()],
            ..locked("a", 0)
        };
        let request = || Request {
            base: Some(3),
            changes: vec![Change {
                id: "a".to_string(),
                rev: 0,
                sealed: Some(sealed(0)),
                plain: None,
                date: None,
                edited: None,
            }],
            add: Vec::new(),
        };
        let deleted = Note {
            deleted: Some("2026-11-06".to_string()),
            ..plain.clone()
        };
        let mut data = Data {
            folders: Vec::new(),
            notes: vec![deleted],
        };
        assert!(matches!(
            apply(&mut data, 3, request()),
            Err(Refusal::Unfit(why)) if why == "Recover the note before you lock it."
        ));
        data.notes = vec![plain];
        let revisions = apply(&mut data, 3, request()).ok().unwrap();
        assert_eq!(revisions.get("a"), Some(&4));
        assert_eq!(data.notes[0].lines, Vec::<String>::new());
    }

    #[test]
    fn a_whole_document_save_changes_no_lock() {
        let data = |notes: Vec<Note>| Data {
            folders: Vec::new(),
            notes,
        };
        let stored = data(vec![locked("a", 2)]);
        assert_eq!(
            seals_kept(Some(&stored), &data(vec![locked("a", 2)])),
            Ok(())
        );
        assert_eq!(seals_kept(Some(&stored), &data(vec![])), Ok(()));
        assert!(seals_kept(Some(&stored), &data(vec![locked("a", 3)])).is_err());
        let plain = Note {
            locked: None,
            sealed: None,
            ..locked("a", 2)
        };
        assert!(seals_kept(Some(&stored), &data(vec![plain.clone()])).is_err());
        assert!(seals_kept(Some(&data(vec![plain])), &data(vec![locked("a", 1)])).is_err());
        assert!(seals_kept(None, &data(vec![locked("a", 1)])).is_err());
    }
}

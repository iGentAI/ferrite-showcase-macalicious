//! Storage Management's server half: what this browser's session keeps on
//! the server, app by app, and which of it the person can forget.
//!
//! A Ferrite application has no disk to report: no capacity, no free space,
//! no files of the machine. What it can report is its own `data` store, so
//! Storage Management shows, for each app module, the bytes and keys this
//! session keeps in that module's space (`../system.rs`), and lists as
//! "files" the whole documents that the module itself can forget through its
//! own `DELETE` route ([`DOCUMENTS`]). The window forgets one by calling that
//! route, so each module keeps its own rules (`document.rs` stores `null`
//! under the next revision rather than removing the key). The rest of a
//! module's data (Calculator's tape entries, Notes' library, Messages' rooms,
//! idempotency markers) counts in its size but is not listed: no route
//! forgets it as one document.
//!
//! * `GET /api/storage-management/usage`: `{"apps": [...], "bytes", "keys",
//!   "truncated", "now_ms"}`. Each app is `{"name", "title", "bytes",
//!   "keys", "truncated", "documents": [...]}` and each document `{"key",
//!   "name", "bytes", "rev", "forget"}`, `forget` the path of the module's
//!   route that forgets it. A document is listed only while it holds
//!   something (not before the first save and not after it was forgotten).
//!   Each module's count stops at 10,000 keys and is then `truncated`.
//!   `drive` is the person's Ferrite drive against its quota
//!   ([`drive::report`]): used and available bytes, each kind of file, the
//!   Trash, and the largest files, read from the files module's `drive`
//!   document (`../files/`) as the scan of that module's space finds it.

pub mod drive;

/// The files module's document of the drive.
const DRIVE_KEY: &str = "drive";

use ferrite_app::serde_json;

use super::MODULES;
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};

pub const MODULE: AppModule = AppModule {
    name: "storage-management",
    title: "Storage Management",
    handle,
};

/// A document a module keeps under one key of the session's space and
/// forgets on `DELETE /api/<app>/<key>`.
pub struct Forgettable {
    pub app: &'static str,
    pub key: &'static str,
    /// What Storage Management calls it.
    pub name: &'static str,
}

const fn doc(app: &'static str, key: &'static str, name: &'static str) -> Forgettable {
    Forgettable { app, key, name }
}

/// Every document Storage Management offers to forget. The test
/// `tests/storage_management.rs` sends each `DELETE` and checks that the
/// module answers it.
pub const DOCUMENTS: &[Forgettable] = &[
    doc("app-store", "library", "Apps Got from the App Store"),
    doc("books", "library", "Books Collections, Pages and Bookmarks"),
    doc("calendar", "events", "Calendar Events"),
    doc("contacts", "cards", "Contact Cards"),
    doc("font-book", "library", "Collections and Fonts Turned Off"),
    doc("help-viewer", "place", "Last Help Page Read"),
    doc("home", "homes", "Homes, Rooms and Accessories"),
    doc("keychain-access", "vault", "Encrypted Keychain"),
    doc("keychain-access", "keychains", "Other Encrypted Keychains"),
    doc("launchpad", "layout", "Launchpad Order and Page"),
    doc("network-utility", "history", "Network Utility Lookups"),
    doc(
        "podcasts",
        "library",
        "Podcasts Followed, Played and Preferences",
    ),
    doc(
        "system-preferences",
        "settings",
        "System Preferences Settings",
    ),
    doc("textedit", "draft", "Open TextEdit Document"),
    doc("textedit", "files", "Saved TextEdit Documents"),
];

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    match (cx.request.method, cx.request.path) {
        ("GET", "/usage") => match usage(&mut cx).await {
            Ok(body) => Response::json(200, &body),
            Err(error) => Response::error(503, &format!("storage failed: {error}")),
        },
        (_, "/usage") => Response::method_not_allowed(),
        _ => Response::not_found(),
    }
}

/// The revision of a document stored by `document.rs`, `{"rev", "doc"}`,
/// when it holds a document; `None` when it holds `null` or is not in that
/// form.
fn held_revision(bytes: &[u8]) -> Option<u64> {
    let stored: serde_json::Value = serde_json::from_slice(bytes).ok()?;
    let rev = stored.get("rev")?.as_u64()?;
    match stored.get("doc") {
        None | Some(serde_json::Value::Null) => None,
        Some(_) => Some(rev),
    }
}

/// The drive document as stored. One that cannot be read fails the report:
/// showing it as an empty drive would say the whole quota is free.
fn stored_drive(bytes: &[u8]) -> std::io::Result<serde_json::Value> {
    serde_json::from_slice(bytes)
        .ok()
        .filter(drive::readable)
        .ok_or_else(|| std::io::Error::other("the stored drive cannot be read"))
}

async fn usage(cx: &mut ApiCtx<'_>) -> std::io::Result<serde_json::Value> {
    let session = cx.session.principal.clone();
    let now_ms = cx.now_ms;
    let (mut bytes, mut keys, mut truncated) = (0u64, 0u64, false);
    let mut apps = Vec::new();
    // The person's drive, as the files module stores it (`{rev, doc}`), kept from the scan of
    // the files module's space, which reads it anyway.
    let mut drive_document = None;
    for module in MODULES {
        let wanted: Vec<&Forgettable> = DOCUMENTS.iter().filter(|d| d.app == module.name).collect();
        let mut track: Vec<&str> = wanted.iter().map(|d| d.key).collect();
        let files = module.name == super::files::MODULE.name;
        if files {
            track.push(DRIVE_KEY);
        }
        let used = super::system::usage(cx.storage.store(), module.name, &session, &track).await?;
        if files {
            drive_document = used
                .tracked
                .iter()
                .find(|(key, _)| key == DRIVE_KEY)
                .map(|(_, value)| stored_drive(value))
                .transpose()?;
        }
        bytes += used.bytes;
        keys += used.keys;
        truncated |= used.truncated;
        let documents: Vec<_> = used
            .tracked
            .iter()
            .filter_map(|(key, value)| {
                let document = wanted.iter().find(|d| d.key == key)?;
                let rev = held_revision(value)?;
                Some(serde_json::json!({
                    "key": key,
                    "name": document.name,
                    "bytes": key.len() + value.len(),
                    "rev": rev,
                    "forget": format!("/api/{}/{}", module.name, key),
                }))
            })
            .collect();
        apps.push(serde_json::json!({
            "name": module.name,
            "title": module.title,
            "bytes": used.bytes,
            "keys": used.keys,
            "truncated": used.truncated,
            "documents": documents,
        }));
    }
    Ok(serde_json::json!({
        "apps": apps,
        "bytes": bytes,
        "keys": keys,
        "truncated": truncated,
        "now_ms": now_ms,
        "drive": drive::report(drive_document.as_ref()),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_unreadable_drive_fails_rather_than_reading_as_empty() {
        assert!(stored_drive(b"{not json").is_err());
        assert!(stored_drive(br#"{"rev":1,"doc":{"entries":"x"}}"#).is_err());
        assert!(stored_drive(br#"{"rev":1,"doc":{"entries":[]}}"#).is_ok());
        assert!(stored_drive(br#"{"rev":1,"doc":null}"#).is_ok());
    }

    #[test]
    fn every_document_belongs_to_a_registered_module_and_is_listed_once() {
        let mut seen = std::collections::BTreeSet::new();
        for document in DOCUMENTS {
            assert!(
                super::super::find(document.app).is_some(),
                "{} is not a module",
                document.app
            );
            assert!(
                seen.insert((document.app, document.key)),
                "{}/{} twice",
                document.app,
                document.key
            );
        }
    }

    #[test]
    fn only_a_document_that_holds_something_is_listed() {
        assert_eq!(held_revision(br#"{"rev":3,"doc":{"a":1}}"#), Some(3));
        assert_eq!(held_revision(br#"{"rev":4,"doc":null}"#), None);
        assert_eq!(held_revision(br#"{"rev":4}"#), None);
        assert_eq!(held_revision(b"[1,2]"), None);
    }
}

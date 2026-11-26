//! How the Calendar, Contacts and System Preferences modules keep a session's
//! document: the whole document as one JSON value under one key of the
//! session's own space, `{"rev": <n>, "doc": <document or null>}`.
//!
//! One key per document makes every replace atomic: a `GET` sees the previous
//! document or the new one, never a mixture, and a `PUT` that fails leaves
//! the previous document whole. This file enforces no byte limit of its own.
//! The gateway refuses a request body over 262,144 bytes (256 KiB) with 413,
//! and each module checks the
//! counts and lengths of what it parses before it stores it. The stored form
//! is the parsed document written again beside its revision, so it can be a
//! little larger or smaller than the body that sent it; no size is checked
//! when it is read back.
//!
//! The server owns the revision. Every `GET` answers the document with its
//! `rev` (0 before the session has saved), and every `PUT` sends back the
//! `rev` it was based on. [`write`] stores the body only if that is still the
//! stored revision, checked and written with the store's compare-and-set,
//! and the stored revision then goes up by one and is answered. A `PUT` based
//! on any other revision changes nothing and is answered 409 with the current
//! document and its revision ([`conflict`]), so the page can take that
//! revision and decide what to send. `DELETE` stores `null` under the next
//! revision rather than removing the key, so a page still holding an old
//! revision cannot have it accepted again.
//!
//! A stored document that no longer parses is reported as a storage failure
//! (503), like a read that failed: the demo then keeps what it shows and does
//! not save over a document it could not read.

use std::io;

use ferrite_app::serde::de::DeserializeOwned;
use ferrite_app::serde::Serialize;
use ferrite_app::{serde, serde_json};

use crate::http::Response;
use crate::module::Space;

/// Compare-and-set attempts before an unconditional write gives up on a
/// document that keeps changing under it.
const ATTEMPTS: usize = 8;

/// A document as stored: `doc` is `None` before the first save and after a
/// delete; `rev` is 0 before the first save.
#[derive(Debug, PartialEq)]
pub struct Current<T> {
    pub doc: Option<T>,
    pub rev: u64,
}

/// How many write ids a document keeps beside it, newest last. The page counts
/// on the same number (`WRITES_KEPT` in `demos/desktop/desktop-server.ts`).
const WRITES_KEPT: usize = 16;

/// What a [`write`] did.
#[derive(Debug, PartialEq)]
pub enum Saved<T> {
    /// Stored under this new revision.
    Stored(u64),
    /// Not stored: the base revision was not the stored one, which is this.
    Conflict(Current<T>),
}

#[derive(serde::Serialize)]
#[serde(crate = "ferrite_app::serde")]
struct StoredRef<'a, D> {
    rev: u64,
    doc: Option<&'a D>,
    #[serde(skip_serializing_if = "no_writes")]
    writes: &'a [String],
    #[serde(skip_serializing_if = "Option::is_none")]
    writes_from: Option<u64>,
}

/// Whether a document holds no named write. A named function: the hosted code
/// gate cannot parse a qualified path in a serde callback (CODE_MACRO_OPAQUE).
fn no_writes(writes: &&[String]) -> bool {
    writes.is_empty()
}

/// The list of write ids after the write `this` to a document at revision `rev`,
/// the newest last, the oldest let go past [`WRITES_KEPT`], and the revision after
/// which the list is complete: the first named write starts it, since what wrote
/// before it named nothing. A write that names nothing may be a page's whose header
/// was lost on the way, so the list says nothing of it: it is complete only after
/// that write's revision. Every stored form that [`read`] reads keeps both, or a
/// page would be told its stored save never came.
pub fn with_write(
    mut writes: Vec<String>,
    from: Option<u64>,
    rev: u64,
    this: Option<&str>,
) -> (Vec<String>, Option<u64>) {
    let Some(this) = this else {
        return (writes, Some(rev.saturating_add(1)));
    };
    writes.push(this.to_owned());
    let over = writes.len().saturating_sub(WRITES_KEPT);
    writes.drain(..over);
    (writes, Some(from.unwrap_or(rev)))
}

/// The stored form. Fields it does not name (a `by` written by an earlier
/// build) are ignored. `writes` names the last writes that said who they were,
/// in the one value the document is replaced with, so that a page whose reply
/// was lost can ask whether its write was stored: absent on a document no such
/// write has stored. `writes_from` is the revision after which that list is
/// complete: absent, nothing can be said of any write before the stored revision,
/// which an earlier build or an unnamed save may have made.
#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Stored<D> {
    rev: u64,
    doc: Option<D>,
    #[serde(default)]
    writes: Vec<String>,
    #[serde(default)]
    writes_from: Option<u64>,
}

fn parse<T: DeserializeOwned>(bytes: &[u8]) -> io::Result<(Current<T>, Vec<String>, Option<u64>)> {
    let stored: Stored<T> = serde_json::from_slice(bytes).map_err(io::Error::other)?;
    Ok((
        Current {
            doc: stored.doc,
            rev: stored.rev,
        },
        stored.writes,
        stored.writes_from,
    ))
}

/// The revision after `rev`, or an error at the top of the range rather than
/// an overflow that would wrap back to a revision already answered.
fn next_revision(rev: u64) -> io::Result<u64> {
    rev.checked_add(1)
        .ok_or_else(|| io::Error::other("the document's revision is at its limit"))
}

/// Put the list of writes in a stored form that is written as JSON of its own
/// (Notes, Stickies), beside the fields it reads back.
pub fn stamp_writes(body: &mut serde_json::Value, writes: &[String], from: Option<u64>) {
    let Some(object) = body.as_object_mut() else {
        return;
    };
    if !writes.is_empty() {
        object.insert("writes".into(), writes.into());
    }
    if let Some(from) = from {
        object.insert("writes_from".into(), from.into());
    }
}

/// The stored document and its revision. The request's reply names the writes
/// the document keeps ([`crate::module::WriteIds`]).
pub async fn read<T: DeserializeOwned>(space: &mut Space<'_>, key: &str) -> io::Result<Current<T>> {
    match space.get_versioned(key).await? {
        None => {
            space.write_ids().heard(&[], 0);
            Ok(Current { doc: None, rev: 0 })
        }
        Some((bytes, _)) => {
            let (current, writes, from) = parse(&bytes)?;
            space
                .write_ids()
                .heard(&writes, from.unwrap_or(current.rev));
            Ok(current)
        }
    }
}

/// Store `doc` (`None` forgets the document) under the next revision, if
/// `base` is the stored revision. `base: None` writes whatever is stored. A
/// request that named its write ([`crate::module::WriteIds`]) is kept among the
/// document's writes in the same value; a refused one's reply names them.
pub async fn write<T: Serialize + DeserializeOwned>(
    space: &mut Space<'_>,
    key: &str,
    base: Option<u64>,
    doc: Option<&T>,
) -> io::Result<Saved<T>> {
    for _ in 0..ATTEMPTS {
        let (version, current, writes, from) = match space.get_versioned(key).await? {
            None => (None, Current { doc: None, rev: 0 }, Vec::new(), None),
            Some((bytes, version)) => {
                let (current, writes, from) = parse::<T>(&bytes)?;
                (Some(version), current, writes, from)
            }
        };
        if base.is_some_and(|base| base != current.rev) {
            space
                .write_ids()
                .heard(&writes, from.unwrap_or(current.rev));
            return Ok(Saved::Conflict(current));
        }
        let rev = next_revision(current.rev)?;
        let (writes, writes_from) = with_write(writes, from, current.rev, space.write_ids().this());
        let stored = StoredRef {
            rev,
            doc,
            writes: &writes,
            writes_from,
        };
        let bytes = serde_json::to_vec(&stored).map_err(io::Error::other)?;
        // A lost race with a write based on the same revision shows up as a
        // changed revision on the next pass, and so as a conflict.
        if space.put_if_version(key, &bytes, version).await? {
            return Ok(Saved::Stored(rev));
        }
    }
    Err(io::Error::other(
        "the document kept changing during the save",
    ))
}

/// A `GET` reply with the session's id beside the document: the page notices
/// from it that its session was replaced (the cookie changed) and loads
/// again, so it never shows or saves one session's document in another
/// (`demos/desktop/desktop-server.ts`). The id is the hash of the cookie, safe
/// to show ([`crate::session::Session`]).
pub fn for_session(mut body: serde_json::Value, session: &crate::session::Session) -> Response {
    if let Some(object) = body.as_object_mut() {
        object.insert("session".into(), session.id.clone().into());
    }
    Response::json(200, &body)
}

/// The 409 reply to a `PUT` that names a session other than the request's
/// (the page loaded under a cookie that has since been replaced), or `None`
/// when it names this one or none. The reply names the request's session and
/// holds no document, so the page learns its session ended and shows nothing
/// of the new one; nothing is stored, whatever revision the body carries.
pub fn other_session(named: Option<&str>, session: &crate::session::Session) -> Option<Response> {
    let named = named?;
    if named == session.id {
        return None;
    }
    Some(Response::json(
        409,
        &serde_json::json!({
            "error": "this save belongs to another session",
            "session": session.id,
        }),
    ))
}

/// The 409 reply to a `PUT` based on a revision that is not the stored one:
/// `body` is what a `GET` would answer now (the document and its `rev`), with
/// an `error` added.
pub fn conflict(mut body: serde_json::Value) -> Response {
    if let Some(object) = body.as_object_mut() {
        object.insert(
            "error".into(),
            "the document has changed since that revision".into(),
        );
    }
    Response::json(409, &body)
}

/// The reply to a write: 200 with the stored document under its new
/// revision, or the 409 of [`conflict`]. `reply` builds what a `GET` answers
/// from a document and its revision; `stored` is what was written.
pub fn answer<T>(
    saved: Saved<T>,
    stored: Option<&T>,
    reply: impl Fn(Option<&T>, u64) -> serde_json::Value,
) -> Response {
    match saved {
        Saved::Stored(rev) => Response::json(200, &reply(stored, rev)),
        Saved::Conflict(current) => conflict(reply(current.doc.as_ref(), current.rev)),
    }
}

/// The longest item id, in bytes.
pub const MAX_KEY_BYTES: usize = 128;

/// Whether `key` may name an item of a document (an event, a card, a
/// setting): 1 to [`MAX_KEY_BYTES`] letters, digits, `-`, `_` or `.`.
pub fn valid_key(key: &str) -> bool {
    (1..=MAX_KEY_BYTES).contains(&key.len())
        && key
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.'))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn item_keys_are_short_and_plain() {
        assert!(valid_key("new-1"));
        assert!(valid_key("general.appearance"));
        assert!(valid_key(&"a".repeat(MAX_KEY_BYTES)));
        assert!(!valid_key(""));
        assert!(!valid_key(&"a".repeat(MAX_KEY_BYTES + 1)));
        assert!(!valid_key("a/b"));
        assert!(!valid_key("a b"));
    }

    #[test]
    fn the_stored_form_keeps_the_revision_beside_the_document() {
        let bytes = serde_json::to_vec(&StoredRef {
            rev: 3,
            doc: Some(&vec![1, 2]),
            writes: &[],
            writes_from: None,
        })
        .unwrap();
        assert_eq!(String::from_utf8_lossy(&bytes), r#"{"rev":3,"doc":[1,2]}"#);
        assert_eq!(
            parse::<Vec<u8>>(&bytes).unwrap().0,
            Current {
                doc: Some(vec![1, 2]),
                rev: 3
            }
        );
        let (_, writes, from) =
            parse::<Vec<u8>>(br#"{"rev":3,"doc":[1,2],"writes":["a-1"],"writes_from":2}"#).unwrap();
        assert_eq!(
            (writes.as_slice(), from),
            (&["a-1".to_owned()][..], Some(2)),
            "a stored write's id is read back"
        );
        assert_eq!(
            with_write(Vec::new(), None, 7, Some("a")),
            (vec!["a".to_owned()], Some(7)),
            "the first named write starts the list at the revision it replaced"
        );
        assert_eq!(
            with_write(vec!["a".to_owned()], Some(7), 9, None),
            (vec!["a".to_owned()], Some(10)),
            "an unnamed write moves the point the list is complete from past itself"
        );
        assert_eq!(
            parse::<Vec<u8>>(br#"{"rev":4,"doc":null,"by":"s1"}"#)
                .unwrap()
                .0
                .doc,
            None,
            "a field of an earlier build is ignored"
        );
        assert!(
            parse::<Vec<u8>>(b"[1,2]").is_err(),
            "an unreadable document is an error"
        );
    }

    #[test]
    fn the_revision_goes_up_by_one_and_never_wraps() {
        assert_eq!(next_revision(0).unwrap(), 1);
        assert_eq!(next_revision(41).unwrap(), 42);
        assert!(
            next_revision(u64::MAX).is_err(),
            "the last revision has no next one"
        );
    }

    #[test]
    fn a_conflict_answers_the_current_document_and_its_revision() {
        let reply = conflict(serde_json::json!({ "cards": [], "rev": 7 }));
        assert_eq!(reply.status, 409);
        let body: serde_json::Value = serde_json::from_slice(&reply.body).unwrap();
        assert_eq!(body["rev"], 7);
        assert_eq!(body["cards"], serde_json::json!([]));
        assert!(body["error"].is_string());
    }
}

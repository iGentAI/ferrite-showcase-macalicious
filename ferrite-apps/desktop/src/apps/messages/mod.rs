//! Messages' server half: shared rooms that every browser session can write
//! to and that update live.
//!
//! * `GET /api/messages/me`: `{"author": "<id>"}`, the public id this
//!   session's messages carry (the first 16 characters of the session id), so
//!   a page can tell its own messages from the others'.
//! * `GET /api/messages/rooms/<room>`: `{"version": n, "state": <room>}`,
//!   the same body the live feed sends, or `409` when the stored room cannot
//!   be read (the feed then sends `{"unreadable": true}`, with no messages).
//! * `POST /api/messages/rooms/<room>` with `{"text": "…", "name": "…"}`:
//!   appends one message and answers `201` with `{"message": …}`. With the
//!   browser's own `idempotency-key` header, a resend of the same name and
//!   text with the same key from the same session, within
//!   [`KEY_RETENTION_MS`], answers `200` with the message stored the first
//!   time and appends nothing; the same key with another name or text
//!   answers `422`.
//! * `GET /live/messages/<room>` (the stream route, `src/live.rs`): a `state`
//!   event with the room, then one per change.
//!
//! A room is one document in the shared space, `rooms/<room>`, holding its
//! newest [`ROOM_LIMIT`] messages and, apart from them, a receipt for each
//! keyed message of the last [`KEY_RETENTION_MS`]: the stored message and the
//! SHA-256 of its name and text. Receipts are kept longer than a page resends
//! on its own (ten minutes from the message's creation,
//! `demos/messages/messages-live.tsx`). An append reads the room, checks the
//! key against the receipts ([`admit`]), adds the message and its receipt
//! and writes the room back by compare-and-set, so the check and the append
//! are one atomic write: two deliveries of one request, even when they race
//! or one of them died halfway, append the message once.
//!
//! A Try Again in the page (a message marked Not Delivered, sent again by
//! hand, with its first key) reads the room first and sends only when none
//! of the room's messages carries the key. Together the two checks stop a
//! duplicate as long as either still knows the message: it is among the
//! newest [`ROOM_LIMIT`] messages, or its receipt is kept (younger than
//! [`KEY_RETENTION_MS`] and among the newest [`RECEIPT_LIMIT`] receipts).
//! **Known limit:** a Try Again pressed after both have forgotten it (more
//! than 15 minutes after a message that was in fact stored, in a room where
//! more than [`ROOM_LIMIT`] messages have been written since) appends it a
//! second time. Nothing in the room says any longer that it was stored, so
//! keeping every key for ever is the only cure, and the room is bounded on
//! purpose.
//!
//! Rooms are public to every session, like a group chat on one desktop:
//! anyone who names a room can read it and write to it.
//!
//! **Conversations between accounts** (one to one and groups, with read
//! receipts, typing, tapbacks, replies and full history) are in
//! [`conversations`], under `/api/messages/conversations`. They are never on
//! this public feed (a stream open carries no session): `feed_key` refuses a
//! conversation's id, and each member hears changes through their own
//! personal stream.
//!
//! **Notifications.** A room remembers the [`MEMBER_LIMIT`] people who read
//! or wrote in it most recently (`members/<room>`, in the shared space, by
//! principal; no route shows it). When someone writes, each of the others
//! who was there within [`MEMBER_TTL_MS`] is sent a notification
//! (`notification_center::notify`), which reaches only that person's
//! browsers. A failure to notify never fails the message.
//!
//! **Do Not Disturb** is kept per person and per conversation, room or
//! account conversation alike, in [`muted`] (`/api/messages/muted`): a muted
//! conversation's messages notify nobody who muted it.
//!
//! **Blocking** an account is kept per person in [`blocked`]
//! (`/api/messages/blocked`): what that account writes in a conversation with
//! them does not reach them, and it does not know.

pub(crate) mod blocked;
mod conversations;
mod muted;

use ferrite_app::serde;
use ferrite_app::serde_json;

use super::notification_center::{self, Notification};
use crate::http::Response;
use crate::live::LiveFeed;
use crate::module::{ApiCtx, AppModule, HandlerFuture, Space};

pub const MODULE: AppModule = AppModule {
    name: "messages",
    title: "Messages",
    handle,
};

pub const FEED: LiveFeed = LiveFeed {
    app: "messages",
    key: feed_key,
    view,
};

/// The most messages a room keeps; the oldest go first.
pub const ROOM_LIMIT: usize = 200;
/// How long a receipt of a keyed message is kept: 15 minutes, longer than a
/// page resends on its own (10 minutes).
pub const KEY_RETENTION_MS: u64 = 15 * 60 * 1_000;
/// The most receipts a room keeps, however recent; the oldest go first.
pub const RECEIPT_LIMIT: usize = 1_000;
/// The longest message, in characters.
pub const MAX_TEXT_CHARS: usize = 1_000;
/// The longest display name, in characters.
pub const MAX_NAME_CHARS: usize = 40;
/// The longest room id: lowercase letters, digits and `-`.
pub const MAX_ROOM_CHARS: usize = 40;
/// The most people a room remembers, and so notifies.
pub const MEMBER_LIMIT: usize = 10;
/// How long after their last visit a member is still notified: a week.
pub const MEMBER_TTL_MS: u64 = 7 * 24 * 60 * 60 * 1000;
/// A member's visit is written again only when the last is this old, so
/// reading a room does not write it every time.
const MEMBER_REFRESH_MS: u64 = 60 * 60 * 1000;
const CAS_ATTEMPTS: usize = 16;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Message {
    /// The message's number in its room: 1, 2, 3…, never reused.
    pub seq: u64,
    /// The writer's public id ([`author_of`]).
    pub author: String,
    /// The writer's display name, as the page gave it.
    pub name: String,
    pub text: String,
    pub at_ms: u64,
    /// The browser's `idempotency-key` for this message, when it sent one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub key: Option<String>,
}

/// That a keyed message was stored: what a resend with its key is answered
/// with, whether or not the message is still among the newest.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
struct Receipt {
    /// The message as it was stored, its author and key included.
    message: Message,
    /// [`payload_hash`] of its name and text.
    payload: String,
}

/// The SHA-256, in hex, of a message's display name and text, written as the
/// JSON array `[name, text]` so that no two pairs are written alike.
fn payload_hash(name: &str, text: &str) -> String {
    let pair = serde_json::json!([name, text]).to_string();
    ferrite_app::crypto::hex(&ferrite_app::crypto::sha256(pair.as_bytes()))
}

#[derive(serde::Serialize, serde::Deserialize, Default, Debug)]
#[serde(crate = "ferrite_app::serde")]
struct Room {
    /// The last `seq` handed out.
    last: u64,
    messages: Vec<Message>,
    #[serde(default)]
    receipts: Vec<Receipt>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct NewMessage {
    text: String,
    #[serde(default)]
    name: String,
}

/// What a room makes of one append.
#[derive(Debug, PartialEq, Eq)]
enum Admission {
    /// Stored now: the room changed and must be written.
    Added(Message),
    /// A resend of a message stored before: the room is unchanged.
    Replayed(Message),
    /// The key came before with another name or text.
    KeyReused,
    /// No message number is left.
    Exhausted,
}

/// Admit one message to `room`: the decision an append writes back.
fn admit(
    room: &mut Room,
    author: &str,
    key: Option<&str>,
    name: &str,
    text: &str,
    now_ms: u64,
) -> Admission {
    let payload = payload_hash(name, text);
    prune_receipts(&mut room.receipts, now_ms);
    if let Some(key) = key {
        if let Some(receipt) = room
            .receipts
            .iter()
            .find(|r| r.message.author == author && r.message.key.as_deref() == Some(key))
        {
            return if receipt.payload == payload {
                Admission::Replayed(receipt.message.clone())
            } else {
                Admission::KeyReused
            };
        }
    }
    let Some(seq) = room.last.checked_add(1) else {
        return Admission::Exhausted;
    };
    room.last = seq;
    let message = Message {
        seq,
        author: author.to_string(),
        name: name.to_string(),
        text: text.to_string(),
        at_ms: now_ms,
        key: key.map(str::to_string),
    };
    room.messages.push(message.clone());
    let excess = room.messages.len().saturating_sub(ROOM_LIMIT);
    room.messages.drain(..excess);
    if key.is_some() {
        room.receipts.push(Receipt {
            message: message.clone(),
            payload,
        });
        let excess = room.receipts.len().saturating_sub(RECEIPT_LIMIT);
        room.receipts.drain(..excess);
    }
    Admission::Added(message)
}

/// Drop the receipts older than [`KEY_RETENTION_MS`].
fn prune_receipts(receipts: &mut Vec<Receipt>, now_ms: u64) {
    receipts.retain(|r| now_ms.saturating_sub(r.message.at_ms) < KEY_RETENTION_MS);
}

/// The public id a session writes under: the first 16 hex characters of its
/// session id (itself a hash of the cookie, never the cookie).
pub fn author_of(session_id: &str) -> String {
    session_id.chars().take(16).collect()
}

/// Whether `room` is a room id.
pub fn is_room(room: &str) -> bool {
    (1..=MAX_ROOM_CHARS).contains(&room.len())
        && room
            .bytes()
            .all(|b| matches!(b, b'a'..=b'z' | b'0'..=b'9' | b'-'))
}

fn room_key(room: &str) -> String {
    format!("rooms/{room}")
}

fn members_key(room: &str) -> String {
    format!("members/{room}")
}

/// One of the people who were in a room lately.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
struct Member {
    principal: String,
    at_ms: u64,
}

/// `members` with `principal` there at `now_ms`, the most recent first and
/// at most [`MEMBER_LIMIT`]; `None` when its visit is recent enough already.
fn visit(members: &[Member], principal: &str, now_ms: u64) -> Option<Vec<Member>> {
    let fresh = members
        .iter()
        .any(|m| m.principal == principal && now_ms.saturating_sub(m.at_ms) < MEMBER_REFRESH_MS);
    if fresh {
        return None;
    }
    let mut next = vec![Member {
        principal: principal.to_string(),
        at_ms: now_ms,
    }];
    next.extend(members.iter().filter(|m| m.principal != principal).cloned());
    next.truncate(MEMBER_LIMIT);
    Some(next)
}

/// Who is told of a message `author` wrote at `now_ms`: every recent member
/// but the author.
fn recipients<'m>(members: &'m [Member], author: &str, now_ms: u64) -> Vec<&'m str> {
    members
        .iter()
        .filter(|m| m.principal != author && now_ms.saturating_sub(m.at_ms) < MEMBER_TTL_MS)
        .map(|m| m.principal.as_str())
        .collect()
}

async fn read_members(
    shared: &mut Space<'_>,
    room: &str,
) -> std::io::Result<(Option<u64>, Vec<Member>)> {
    let stored = shared.get_versioned(&members_key(room)).await?;
    let version = stored.as_ref().map(|(_, v)| *v);
    // A list that cannot be read starts again: it only decides who is told.
    let members = stored
        .and_then(|(bytes, _)| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default();
    Ok((version, members))
}

/// Note that `principal` is in `room` now, and return who was there.
async fn join(
    shared: &mut Space<'_>,
    room: &str,
    principal: &str,
    now_ms: u64,
) -> std::io::Result<Vec<Member>> {
    for _ in 0..CAS_ATTEMPTS {
        let (version, members) = read_members(shared, room).await?;
        let Some(next) = visit(&members, principal, now_ms) else {
            return Ok(members);
        };
        let bytes = serde_json::to_vec(&next)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e.to_string()))?;
        if shared
            .put_if_version(&members_key(room), &bytes, version)
            .await?
        {
            return Ok(members);
        }
    }
    Err(std::io::Error::other("the room's members kept changing"))
}

/// Join the room and tell its other recent members of `message`. Nothing
/// here fails the message, which is stored already.
async fn tell_members(cx: &mut ApiCtx<'_>, room: &str, message: &Message) {
    let principal = cx.session.principal.clone();
    let now_ms = cx.now_ms;
    let members = match join(&mut cx.storage.shared(), room, &principal, now_ms).await {
        Ok(members) => members,
        Err(error) => {
            ferrite_app::tracing::warn!(%error, "room members not read");
            return;
        }
    };
    let note = Notification {
        app: MODULE.name.into(),
        id: format!("{room}#{}", message.seq),
        title: message.name.clone(),
        subtitle: (room != "desktop").then(|| format!("in {room}")),
        body: Some(message.text.clone()),
        ..Notification::default()
    };
    for recipient in recipients(&members, &principal, now_ms) {
        // Do Not Disturb, set by the recipient for this room alone.
        if muted::is_muted(cx, recipient, &muted::room_conversation(room)).await {
            continue;
        }
        if let Err(error) =
            notification_center::notify(cx.storage.store(), recipient, now_ms, &note).await
        {
            ferrite_app::tracing::warn!(%error, "a room member was not notified");
        }
    }
}

fn feed_key(rest: &str) -> Option<String> {
    // A conversation between accounts is never on this public feed: a stream
    // open carries no session, and its id is derived from account ids. Its
    // members hear it through their personal streams (`conversations`).
    if conversations::is_id(rest) {
        return None;
    }
    is_room(rest).then(|| room_key(rest))
}

/// A room as a page sees it: `{"messages": [...]}`, oldest first, or
/// `{"unreadable": true}`, with no messages, when the stored bytes are not a
/// room.
fn view(bytes: Option<&[u8]>) -> serde_json::Value {
    match decode(bytes) {
        Ok(room) => serde_json::json!({ "messages": room.messages }),
        Err(_) => serde_json::json!({ "unreadable": true }),
    }
}

const UNREADABLE: &str = "the stored room cannot be read, so it is left unchanged";

/// The stored room: empty while absent, an error when the stored bytes are
/// not a room (which an append must not replace).
fn decode(bytes: Option<&[u8]>) -> Result<Room, serde_json::Error> {
    bytes.map_or(Ok(Room::default()), serde_json::from_slice)
}

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    if let Some(response) = conversations::route(&mut cx).await {
        return response;
    }
    if let Some(response) = muted::route(&mut cx).await {
        return response;
    }
    if let Some(response) = blocked::route(&mut cx).await {
        return response;
    }
    let path = cx.request.path;
    if path == "/me" {
        return match cx.request.method {
            "GET" => Response::json(
                200,
                &serde_json::json!({
                    "author": author_of(&cx.session.id),
                    "name": cx.session.account.as_ref().map(|a| a.name.clone()),
                    "full_name": cx.session.account.as_ref().map(|a| a.full_name.clone()),
                }),
            ),
            _ => Response::method_not_allowed(),
        };
    }
    let Some(room) = path.strip_prefix("/rooms/") else {
        return Response::not_found();
    };
    if !is_room(room) {
        return Response::error(400, "a room id is 1 to 40 lowercase letters, digits or '-'");
    }
    match cx.request.method {
        "GET" => {
            // A reader is a member: told of what others write next.
            let (principal, now_ms) = (cx.session.principal.clone(), cx.now_ms);
            if let Err(error) = join(&mut cx.storage.shared(), room, &principal, now_ms).await {
                ferrite_app::tracing::warn!(%error, "room visit not noted");
            }
            match cx.storage.shared().get_versioned(&room_key(room)).await {
                Ok(stored) => {
                    let (version, bytes) = match &stored {
                        Some((bytes, version)) => (*version, Some(bytes.as_slice())),
                        None => (0, None),
                    };
                    // An unreadable room is not shown as an empty one.
                    if decode(bytes).is_err() {
                        return Response::error(409, UNREADABLE);
                    }
                    Response::json(
                        200,
                        &serde_json::json!({ "version": version, "state": view(bytes) }),
                    )
                }
                Err(e) => Response::error(503, &e.to_string()),
            }
        }
        "POST" => append(&mut cx, room).await,
        _ => Response::method_not_allowed(),
    }
}

async fn append(cx: &mut ApiCtx<'_>, room: &str) -> Response {
    let new: NewMessage = match cx.request.json() {
        Ok(new) => new,
        Err(response) => return response,
    };
    let text = new.text.trim();
    if text.is_empty() || text.chars().count() > MAX_TEXT_CHARS {
        return Response::error(400, "a message is 1 to 1000 characters");
    }
    let name = new.name.trim();
    if name.chars().count() > MAX_NAME_CHARS {
        return Response::error(400, "a name is at most 40 characters");
    }
    let name = if name.is_empty() { "Guest" } else { name };
    let author = author_of(&cx.session.id);
    let key = cx.request.idempotency_key.map(str::to_string);
    let now_ms = cx.now_ms;
    for _ in 0..CAS_ATTEMPTS {
        let mut shared = cx.storage.shared();
        let stored = match shared.get_versioned(&room_key(room)).await {
            Ok(stored) => stored,
            Err(e) => return Response::error(503, &e.to_string()),
        };
        let version = stored.as_ref().map(|(_, version)| *version);
        // An unreadable room is left as it is: 409, so the page does not
        // resend, and shows the message as not delivered.
        let Ok(mut doc) = decode(stored.as_ref().map(|(bytes, _)| bytes.as_slice())) else {
            return Response::error(409, UNREADABLE);
        };
        let message = match admit(&mut doc, &author, key.as_deref(), name, text, now_ms) {
            Admission::Added(message) => message,
            Admission::Replayed(message) => {
                return Response::json(200, &serde_json::json!({ "message": message }));
            }
            Admission::KeyReused => {
                return Response::error(
                    422,
                    "this idempotency key was sent with a different message",
                );
            }
            Admission::Exhausted => {
                return Response::error(409, "the room has run out of message numbers");
            }
        };
        let bytes = match serde_json::to_vec(&doc) {
            Ok(bytes) => bytes,
            Err(e) => return Response::error(500, &e.to_string()),
        };
        match shared
            .put_if_version(&room_key(room), &bytes, version)
            .await
        {
            Ok(true) => {
                tell_members(cx, room, &message).await;
                return Response::json(201, &serde_json::json!({ "message": message }));
            }
            Ok(false) => continue, // another writer got there first: read again
            Err(e) => return Response::error(503, &e.to_string()),
        }
    }
    Response::error(503, "the room is busy; retry")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn room_ids_are_short_lowercase_words() {
        assert!(is_room("desktop"));
        assert!(is_room("room-2"));
        for bad in ["", "Room", "a/b", "a b", "..", &"x".repeat(41)] {
            assert!(!is_room(bad), "{bad:?}");
        }
        assert_eq!(feed_key("desktop").as_deref(), Some("rooms/desktop"));
        assert_eq!(feed_key("a/b"), None);
        // A conversation's id names no feed, though it is shaped like a room.
        let conversation = conversations::direct_id("u-ann", "u-bob");
        assert!(is_room(&conversation));
        assert_eq!(feed_key(&conversation), None);
    }

    #[test]
    fn an_absent_room_is_empty_and_an_unreadable_one_has_no_messages() {
        assert_eq!(view(None), serde_json::json!({ "messages": [] }));
        assert_eq!(
            view(Some(b"not json")),
            serde_json::json!({ "unreadable": true })
        );
        assert!(decode(Some(b"not json")).is_err());
    }

    const MINUTE: u64 = 60_000;

    /// A room whose first message, sent with key `k`, has been pushed out of
    /// the newest [`ROOM_LIMIT`] by unkeyed messages.
    fn room_past_the_window() -> (Room, Message) {
        let mut room = Room::default();
        let Admission::Added(first) = admit(&mut room, "ann", Some("k"), "Ann", "hello", 0) else {
            panic!("the first message is stored");
        };
        for i in 0..ROOM_LIMIT {
            admit(&mut room, "bob", None, "Bob", &format!("m{i}"), MINUTE);
        }
        assert!(room.messages.iter().all(|m| m.seq != first.seq));
        (room, first)
    }

    #[test]
    fn a_known_key_with_the_same_payload_returns_the_original_message() {
        let (mut room, first) = room_past_the_window();
        let last = room.last;
        assert_eq!(
            admit(&mut room, "ann", Some("k"), "Ann", "hello", 9 * MINUTE),
            Admission::Replayed(first)
        );
        assert_eq!(room.last, last, "nothing is appended");
    }

    #[test]
    fn a_known_key_with_another_payload_is_refused() {
        let (mut room, _) = room_past_the_window();
        let last = room.last;
        assert_eq!(
            admit(&mut room, "ann", Some("k"), "Ann", "goodbye", 9 * MINUTE),
            Admission::KeyReused
        );
        assert_eq!(
            admit(&mut room, "ann", Some("k"), "Anne", "hello", 9 * MINUTE),
            Admission::KeyReused
        );
        assert_eq!(room.last, last, "nothing is appended");
    }

    #[test]
    fn an_unknown_key_is_stored_as_new() {
        let (mut room, first) = room_past_the_window();
        // Another key, the same key from another session, and the same key
        // after its receipt has expired are all new messages.
        for (author, key, at) in [
            ("ann", "k2", MINUTE),
            ("bob", "k", MINUTE),
            ("ann", "k", KEY_RETENTION_MS),
        ] {
            let last = room.last;
            match admit(&mut room, author, Some(key), "Ann", "hello", at) {
                Admission::Added(message) => {
                    assert_eq!(message.seq, last + 1);
                    assert_ne!(message.seq, first.seq);
                }
                other => panic!("{author}/{key}: {other:?}"),
            }
        }
    }

    #[test]
    fn the_payload_hash_tells_name_and_text_apart() {
        assert_eq!(payload_hash("Ann", "hi"), payload_hash("Ann", "hi"));
        assert_ne!(
            payload_hash("Ann\u{0}X", "hi"),
            payload_hash("Ann", "X\u{0}hi")
        );
        assert_ne!(payload_hash("ab", "c"), payload_hash("a", "bc"));
    }

    #[test]
    fn a_room_remembers_its_latest_members_and_tells_the_others() {
        let hour = 60 * MINUTE;
        let ann = visit(&[], "ann", 0).unwrap();
        // Seen again within the hour: nothing to write.
        assert_eq!(visit(&ann, "ann", hour - 1), None);
        let both = visit(&ann, "bob", 10).unwrap();
        assert_eq!(both[0].principal, "bob", "the most recent first");
        let again = visit(&both, "ann", hour).unwrap();
        assert_eq!(
            again
                .iter()
                .map(|m| m.principal.as_str())
                .collect::<Vec<_>>(),
            ["ann", "bob"],
            "a member is listed once"
        );
        let mut many = again.clone();
        for n in 0..MEMBER_LIMIT + 3 {
            many = visit(&many, &format!("p{n}"), hour + n as u64).unwrap();
        }
        assert_eq!(many.len(), MEMBER_LIMIT);
        assert!(
            many.iter().all(|m| m.principal != "ann"),
            "the oldest go first"
        );

        assert_eq!(recipients(&again, "ann", hour), ["bob"], "never the author");
        assert!(
            recipients(&again, "carol", 10 + MEMBER_TTL_MS).len() == 1,
            "a member gone longer than a week is not told"
        );
    }

    #[test]
    fn receipts_are_bounded() {
        let mut room = Room::default();
        for i in 0..RECEIPT_LIMIT + 3 {
            admit(&mut room, "ann", Some(&format!("k{i}")), "Ann", "x", 0);
        }
        assert_eq!(room.receipts.len(), RECEIPT_LIMIT);
        assert_eq!(room.receipts[0].message.key.as_deref(), Some("k3"));
        // A room stored before receipts existed still reads.
        let old: Room = serde_json::from_str(r#"{"last":1,"messages":[]}"#).unwrap();
        assert!(old.receipts.is_empty());
    }
}

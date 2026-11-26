//! Conversations between the desktop's accounts: one to one and groups, with
//! read receipts, typing, tapbacks, replies and full history.
//!
//! A conversation is one document in the module's shared space,
//! `convs/<id>` ([`Conversation`]): its members (account ids, that is each
//! person's [`crate::session::Session::principal`], with names and full
//! names), an optional group name, its newest messages, a small receipt of
//! each keyed message for up to [`super::KEY_RETENTION_MS`] (author, hashed key,
//! number and a hash of what was sent: a resend is stored once, and the same
//! key with another message is refused), each member's read position and
//! when each member last typed.
//! Every change is one compare-and-set of it. The id is 128 bits: a
//! one-to-one conversation's is derived from the two account ids (never
//! shown), so writing to the same person again finds the same conversation; a
//! group's is random, or derived from the creator and the browser's
//! idempotency key so a resend makes one. An id is not a secret (anyone who
//! knows two account ids can derive one), so nothing is served by id alone:
//! every route checks that the session's person is a member.
//!
//! **Delivery reaches members only.** A conversation is never on the public
//! live feed (`/live/messages/<room>` serves rooms and refuses a
//! conversation's id, `super::feed_key`), because a stream open carries no
//! session. Instead every change (a message, a read receipt, typing, a
//! tapback, a name) bumps each member's Messages change count
//! ([`notification_center::touched`]), which only that person's ticketed
//! personal stream (`/live/me`) carries; their open windows then read the
//! conversation again through `GET /conversations/<id>`, as members.
//!
//! **History.** The document stays within [`KEEP`] messages and
//! [`DOC_BUDGET`] bytes (the store holds 200 KB a value): the oldest messages
//! move to pages of at most [`PAGE`] messages and [`PAGE_BUDGET`] bytes. A
//! page is written once, under a fresh name (`convs/<id>/p/<n>-<random>`),
//! before the compare-and-set of the document that drops its messages and
//! names it as `newest_page`; each page names the one before it. So a page
//! is never overwritten, a writer that loses its compare-and-set deletes only
//! its own unpublished pages, and nothing is ever lost. A window scrolls back
//! through `GET .../history?page=<name>`, starting from the conversation's
//! `older`.
//!
//! Every member has `convs/<id>` in their own space, holding when the
//! conversation was last written to, and an activity entry
//! `recent/<inverted time>/<id>` for that time, kept in step with it
//! ([`bump_index`]). Key order of the activity entries is most recent first,
//! so a list reads only the newest few, however many conversations the person
//! has ever been in ([`recent_ids`]); accounts made before the activity index
//! have their older entries copied in on their first lists ([`build_recent`]).
//! A message also tells every other member through Notification Center.
//!
//! **Leaving.** A member of a group (three or more) can leave it
//! (`POST .../leave`): they stop being a member, it leaves their list, and the
//! others are told. A conversation of two cannot be left.
//!
//! **Joining.** A member can add someone to a group (`POST .../members`). The
//! new member sees what is said from then on: what came before is cleared for
//! them, as Clear Chat Transcript does. A conversation of two takes nobody in,
//! since its id is derived from its two people.
//!
//! **One person's own view.** Delete Conversation and Clear Chat Transcript
//! (`POST .../clear`) hide what is numbered up to a point, and Delete on a
//! bubble (`POST .../messages/<seq>/hide`) hides one message, from that person
//! alone ([`Unseen`]), with what they blocked ([`super::blocked`]). Everyone
//! else keeps everything, and nothing is taken out of the document.
//!
//! Unread counts: writing a message reads everything up to it, so a member's
//! unread count is the messages after their read position, wherever those
//! messages now are.
//!
//! Read receipts: a member's read position is always kept (it counts their
//! unread messages), and shown to the others only when their window sends
//! `receipt: true` (Messages > Preferences > iMessage, Send read receipts).
//!
//! **Bounds.** A person starts at most [`STARTS_PER_DAY`] conversations and
//! writes at most [`MESSAGES_PER_DAY`] messages a day (`429` past them; a
//! resend that replays a stored message takes nothing). A Guest User, whose
//! data ends with the guest's time and whom nobody can address, starts none
//! (`403`).
//!
//! **Attachments.** `POST /attachments`, `PUT /attachments/<id>/<n>`, `POST
//! /attachments/<id>/complete` and `DELETE /attachments/<id>` upload a file in
//! pieces (`../attachments.rs`; a Guest User uploads none: `403`). A message
//! names what it carries, under an idempotency key, and takes it for good;
//! `GET /conversations/<id>/attachments/<attachment>?piece=<n>&count=<k>` reads
//! the bytes, for the conversation's members alone.

use std::collections::BTreeMap;

use ferrite_app::{serde, serde_json};

use super::super::allowance;
use super::super::attachments::{self, Attachment};
use super::super::notification_center::{self, Notification};
use super::blocked::{self, Blocks};
use super::{KEY_RETENTION_MS, MODULE};
use crate::http::Response;
use crate::module::{ApiCtx, Space, Storage};
use crate::session::Account;

/// The most messages the conversation document keeps before the oldest move
/// to a page of history.
pub const KEEP: usize = 100;
/// The most files of one message.
pub const MAX_ATTACHMENTS: usize = 10;
/// The most messages of one page of history.
pub const PAGE: usize = 50;
/// The most bytes the stored document may take (the store takes 200 KB): the
/// oldest messages move to pages before it would pass this. The document's
/// other parts are bounded (members, receipts, reads, typing), and so is one
/// message, so the newest message always fits.
pub const DOC_BUDGET: usize = 150 * 1024;
/// The most bytes of one page of history.
pub const PAGE_BUDGET: usize = 120 * 1024;
/// The most receipts of keyed messages a conversation keeps, shared out
/// equally among its members: a member whose share is full drops their own
/// oldest receipt for a new one.
pub const RECEIPTS: usize = 200;
/// The longest idempotency key, in bytes.
pub const MAX_KEY_BYTES: usize = 128;
/// How many entries of a person's activity index one read of the list asks
/// for, as a multiple of [`LIST_LIMIT`]: room for stale entries it clears.
const RECENT_READ: usize = 2;
/// How many times one list reads the activity index again after clearing
/// stale entries, before it answers with what it has.
const RECENT_ROUNDS: usize = 4;
/// The most entries of the older per-conversation index one request copies
/// into the activity index (always at least one chunk): far more than any
/// account holds in practice (the older list read 5,000 on every request), so
/// an upgraded account's first list is complete; a larger index is copied
/// over the next lists.
const RECENT_BUILD_BUDGET: usize = 20_000;
/// The user-space key recording how much of the older index has been copied
/// into the activity index: the number of id chunks done, of 16.
const RECENT_BUILT: &str = "recent-built";
/// How long an activity entry newer than its conversation's `convs/<id>` time
/// (or with none held) is left alone as a write still being published
/// ([`bump_index`] writes the entry before its compare-and-set). Past this a
/// list finishes that write itself ([`recent_ids`]).
const PENDING_GRACE_MS: u64 = 60_000;
/// The longest message, in characters.
pub const MAX_TEXT_CHARS: usize = 4_000;
/// The most people in a conversation, its creator included.
pub const MAX_MEMBERS: usize = 10;
/// The longest group name, in characters.
pub const MAX_TITLE_CHARS: usize = 60;
/// The most conversations a person's list shows.
pub const LIST_LIMIT: usize = 100;
/// How long a member counts as typing after saying so.
pub const TYPING_MS: u64 = 6_000;
/// The most messages one person deletes one at a time from a conversation.
pub const HIDDEN_LIMIT: usize = 2_000;
/// The most attachments Details lists, the newest first.
pub const FILES_LIMIT: usize = 200;
/// The most pages of history one list of a conversation's files reads.
const FILES_PAGES: usize = 40;
/// A tapback: Catalina's six.
pub const TAPBACKS: [&str; 6] = ["love", "like", "dislike", "laugh", "emphasize", "question"];
const CAS_ATTEMPTS: usize = 16;
/// The most conversations one person may start in a day (UTC), and the most
/// messages they may write in one: every conversation and message is kept in
/// the shared space and in each member's list, so these bound what one
/// account can make the others keep.
pub const STARTS_PER_DAY: u32 = 100;
pub const MESSAGES_PER_DAY: u32 = 2_000;

/// A member: the account id stays on the server; the page sees the name.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Member {
    pub id: String,
    pub name: String,
    pub full_name: String,
}

/// One message of a conversation.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct ConvMessage {
    /// Its number in the conversation: 1, 2, 3…, never reused.
    pub seq: u64,
    /// The writer's account name.
    pub author: String,
    /// The writer's full name.
    pub name: String,
    pub text: String,
    pub at_ms: u64,
    /// The browser's `idempotency-key` for it, when it sent one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub key: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Attachment>,
    /// The message it answers.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reply_to: Option<u64>,
    /// Each member's tapback on it, by account name.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub tapbacks: BTreeMap<String, String>,
}

/// What a keyed message's sender gets back when it sends the same message
/// again within [`KEY_RETENTION_MS`]: small, so it never crowds out
/// messages. The message itself is found by its number.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
struct Receipt {
    author: String,
    /// The SHA-256 of the idempotency key.
    key: String,
    seq: u64,
    /// The SHA-256 of what was sent: the same key with another message is
    /// refused.
    payload: String,
    at_ms: u64,
    /// The page of history the message moved to, once it has.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    page: Option<String>,
}

/// A page of history as stored: written once under a unique name, never
/// changed, naming the page before it.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Page {
    pub messages: Vec<ConvMessage>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub prev: Option<String>,
}

/// A member's read position.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(crate = "ferrite_app::serde")]
pub struct Read {
    pub seq: u64,
    /// Whether the others may see it (a read receipt).
    #[serde(default)]
    pub shown: bool,
}

/// A conversation as stored.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, Default, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Conversation {
    pub members: Vec<Member>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    /// The last `seq` handed out.
    #[serde(default)]
    pub last: u64,
    /// The newest messages, oldest first.
    #[serde(default)]
    pub messages: Vec<ConvMessage>,
    #[serde(default)]
    receipts: Vec<Receipt>,
    /// By account name.
    #[serde(default)]
    pub reads: BTreeMap<String, Read>,
    /// When each member stops counting as typing, by account name.
    #[serde(default)]
    pub typing: BTreeMap<String, u64>,
    /// Pages of history written so far.
    #[serde(default)]
    pub pages: u64,
    /// The name of the newest page of history, which names the one before.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub newest_page: Option<String>,
    #[serde(default)]
    pub created_ms: u64,
}

impl Conversation {
    pub fn is_member(&self, principal: &str) -> bool {
        self.members.iter().any(|m| m.id == principal)
    }

    fn member(&self, principal: &str) -> Option<&Member> {
        self.members.iter().find(|m| m.id == principal)
    }

    /// The messages after the member's read position. Writing a message
    /// reads everything up to it, so every message after the position is
    /// someone else's, whether it is still in the document or on a page.
    #[cfg(test)]
    pub fn unread_for(&self, member: &Member) -> u64 {
        self.unread_seeing(member, &Unseen::default())
    }

    /// The messages after the member's read position, leaving out what they do not see in the
    /// document: that is not waiting to be read. [`unseen_on_pages`] takes out the rest.
    fn unread_seeing(&self, member: &Member, unseen: &Unseen) -> u64 {
        let from = self.unread_from(member, unseen);
        let hidden = self
            .messages
            .iter()
            .filter(|m| m.seq > from && !unseen.shows(m))
            .count() as u64;
        self.last.saturating_sub(from).saturating_sub(hidden)
    }

    /// The number after which a message can be waiting for the member.
    fn unread_from(&self, member: &Member, unseen: &Unseen) -> u64 {
        let read = self.reads.get(&member.name).map_or(0, |r| r.seq);
        read.max(unseen.through())
    }
}

/// How many messages on the pages of conversation `id`, numbered after `from`, this person does
/// not see. Pages are read only when the document does not reach back to `from` and the person
/// has someone blocked or deleted a message after it, and only as far back as `from`, so the cost
/// follows what is unread.
async fn unseen_on_pages(
    shared: &mut Space<'_>,
    id: &str,
    conversation: &Conversation,
    from: u64,
    unseen: &Unseen,
) -> std::io::Result<u64> {
    let in_document = conversation
        .messages
        .first()
        .is_some_and(|first| first.seq <= from + 1);
    if in_document || (unseen.blocks.is_empty() && !unseen.hidden.iter().any(|seq| *seq > from)) {
        return Ok(0);
    }
    let mut count = 0;
    let mut next = conversation.newest_page.clone();
    while let Some(name) = next.take() {
        let Some(bytes) = shared.get(&page_key(id, &name)).await? else {
            break;
        };
        let Ok(page) = serde_json::from_slice::<Page>(&bytes) else {
            break;
        };
        count += page
            .messages
            .iter()
            .filter(|m| m.seq > from && !unseen.shows(m))
            .count() as u64;
        if page.messages.first().is_some_and(|m| m.seq <= from + 1) {
            break;
        }
        next = page.prev;
    }
    Ok(count)
}

/// What one person cleared.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Cleared {
    /// Nothing numbered up to here shows to them.
    through: u64,
    /// Clear Chat Transcript: it stays in their list with nothing in it. Otherwise it leaves
    /// their list until something new is said.
    listed: bool,
}

/// What one person does not see of one conversation.
#[derive(Debug, Default)]
struct Unseen {
    cleared: Option<Cleared>,
    /// The messages they deleted one at a time.
    hidden: Vec<u64>,
    blocks: Blocks,
}

impl Unseen {
    fn through(&self) -> u64 {
        self.cleared.map_or(0, |cleared| cleared.through)
    }

    fn hides(&self, seq: u64, author: &str, at_ms: u64) -> bool {
        seq <= self.through() || self.hidden.contains(&seq) || self.blocks.hides(author, at_ms)
    }

    fn shows(&self, message: &ConvMessage) -> bool {
        !self.hides(message.seq, &message.author, message.at_ms)
    }

    /// Takes what this person does not see out of a [`view`]: the messages, whoever they blocked
    /// typing, and the history when the document holds what they cleared, since every page is
    /// older.
    fn apply(&self, state: &mut serde_json::Value) {
        let through = self.through();
        let mut past_clear = false;
        if let Some(messages) = state["messages"].as_array_mut() {
            past_clear = messages
                .iter()
                .any(|message| message["seq"].as_u64().is_some_and(|seq| seq <= through));
            messages.retain(|message| {
                !self.hides(
                    message["seq"].as_u64().unwrap_or(0),
                    message["author"].as_str().unwrap_or(""),
                    message["at_ms"].as_u64().unwrap_or(0),
                )
            });
        }
        if past_clear {
            state["older"] = serde_json::Value::Null;
        }
        if let Some(typing) = state["typing"].as_object_mut() {
            typing.retain(|name, _| !self.blocks.now(name));
        }
    }
}

/// The conversation as every member's page sees it: no account ids, the read
/// positions members chose to show, and who is typing until when. The routes
/// add the conversation's `id`.
pub fn view(conversation: &Conversation) -> serde_json::Value {
    let members: Vec<_> = conversation
        .members
        .iter()
        .map(|m| serde_json::json!({ "name": m.name, "full_name": m.full_name }))
        .collect();
    let read: BTreeMap<&str, u64> = conversation
        .reads
        .iter()
        .filter(|(_, r)| r.shown)
        .map(|(name, r)| (name.as_str(), r.seq))
        .collect();
    serde_json::json!({
        "title": conversation.title,
        "members": members,
        "messages": conversation.messages,
        "read": read,
        "typing": conversation.typing,
        "pages": conversation.pages,
        "older": conversation.newest_page,
        "last": conversation.last,
    })
}

/// [`view`] with the conversation's id, as the routes answer it.
fn view_with_id(id: &str, conversation: &Conversation) -> serde_json::Value {
    let mut value = view(conversation);
    value["id"] = serde_json::Value::String(id.to_string());
    value
}

/// Whether `id` is a conversation's id: `c-` and 32 hex digits.
pub fn is_id(id: &str) -> bool {
    id.len() == 34
        && id.starts_with("c-")
        && id[2..]
            .bytes()
            .all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
}

pub fn doc_key(id: &str) -> String {
    format!("convs/{id}")
}

fn page_key(id: &str, page: &str) -> String {
    format!("convs/{id}/p/{page}")
}

/// What conversation `id` says of an attachment it carries: a member reads
/// the bytes by it, wherever the message has moved to.
fn attachment_key(id: &str, attachment: &str) -> String {
    format!("convs/{id}/att/{attachment}")
}

/// Whether `name` can be a page's name: its number and 16 hex digits.
fn is_page_name(name: &str) -> bool {
    name.split_once('-').is_some_and(|(n, rand)| {
        n.len() == 6
            && n.bytes().all(|b| b.is_ascii_digit())
            && rand.len() == 16
            && rand.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
    })
}

fn index_key(id: &str) -> String {
    format!("convs/{id}")
}

/// A person's activity-index entry for conversation `id` last written at
/// `at_ms`: the time is stored inverted, so key order is newest first and a
/// list reads only the most recent entries, never the whole index.
fn recent_key(id: &str, at_ms: u64) -> String {
    format!("recent/{:016x}/{id}", u64::MAX - at_ms)
}

/// `(at_ms, id)` of an activity-index key (relative to the person's space).
fn parse_recent(key: &str) -> Option<(u64, &str)> {
    let (inverted, id) = key.strip_prefix("recent/")?.split_once('/')?;
    if inverted.len() != 16 || !is_id(id) {
        return None;
    }
    Some((u64::MAX - u64::from_str_radix(inverted, 16).ok()?, id))
}

/// The time an index entry (`{"at_ms"}`) holds.
fn entry_ms(bytes: &[u8]) -> Option<u64> {
    serde_json::from_slice::<serde_json::Value>(bytes).ok()?["at_ms"].as_u64()
}

/// An activity entry's value: when it was written (`{"w"}`), so a list can
/// tell an entry still being published from one a request abandoned.
fn recent_value(now_ms: u64) -> Vec<u8> {
    serde_json::json!({ "w": now_ms }).to_string().into_bytes()
}

/// When an activity entry was written (0 when it does not say).
fn written_ms(bytes: &[u8]) -> u64 {
    serde_json::from_slice::<serde_json::Value>(bytes)
        .ok()
        .and_then(|value| value["w"].as_u64())
        .unwrap_or(0)
}

fn hex_sha256(bytes: &[u8]) -> String {
    ferrite_app::crypto::hex(&ferrite_app::crypto::sha256(bytes))
}

/// The id of the one-to-one conversation of two accounts, whichever starts it.
pub fn direct_id(a: &str, b: &str) -> String {
    let (first, second) = if a <= b { (a, b) } else { (b, a) };
    format!(
        "c-{}",
        &hex_sha256(format!("macalicious/messages/direct\n{first}\n{second}").as_bytes())[..32]
    )
}

/// The id of a group its creator makes with the browser's idempotency key.
pub fn group_id(creator: &str, key: &str) -> String {
    format!(
        "c-{}",
        &hex_sha256(format!("macalicious/messages/group\n{creator}\n{key}").as_bytes())[..32]
    )
}

/// The text kept: trimmed at the end, at most [`MAX_TEXT_CHARS`].
pub fn clean_text(text: &str) -> Result<String, &'static str> {
    let text = text.trim_end();
    let text = text.trim_start_matches(['\n', '\r']);
    if text.chars().count() > MAX_TEXT_CHARS {
        return Err("a message is at most 4,000 characters");
    }
    Ok(text.to_string())
}

/// The group name kept: trimmed, without control characters, or `None`.
pub fn clean_title(title: &str) -> Result<Option<String>, &'static str> {
    let title: String = title.trim().chars().filter(|c| !c.is_control()).collect();
    if title.chars().count() > MAX_TITLE_CHARS {
        return Err("a conversation's name is at most 60 characters");
    }
    Ok((!title.is_empty()).then_some(title))
}

/// What one append to a conversation makes.
#[derive(Debug, PartialEq, Eq)]
pub enum Admission {
    Added(ConvMessage),
    /// A resend of the message stored before with this number (and the page
    /// of history it moved to, if it has).
    Replayed(u64, Option<String>),
    KeyReused,
    Exhausted,
    /// The message it replies to is not in the conversation.
    NoSuchReply,
}

/// A message to append.
pub struct Outgoing<'a> {
    pub author: &'a Member,
    pub key: Option<&'a str>,
    pub text: &'a str,
    pub attachments: &'a [Attachment],
    pub reply_to: Option<u64>,
}

fn payload_of(out: &Outgoing<'_>) -> String {
    // A message without files reads as it did before there were any, so a
    // resend of one sent then is still the same message.
    let payload = if out.attachments.is_empty() {
        serde_json::json!([out.text, out.reply_to])
    } else {
        let ids: Vec<&str> = out.attachments.iter().map(|a| a.id.as_str()).collect();
        serde_json::json!([out.text, ids, out.reply_to])
    };
    hex_sha256(payload.to_string().as_bytes())
}

/// Append one message: the decision the request writes back, with the
/// oldest messages to move to pages (oldest first) so that the document
/// stays within [`KEEP`] messages and [`DOC_BUDGET`] bytes.
pub fn admit(
    conversation: &mut Conversation,
    out: &Outgoing<'_>,
    now_ms: u64,
) -> (Admission, Vec<Vec<ConvMessage>>) {
    let payload = payload_of(out);
    conversation
        .receipts
        .retain(|r| now_ms.saturating_sub(r.at_ms) < KEY_RETENTION_MS);
    let key_hash = out.key.map(|key| hex_sha256(key.as_bytes()));
    if let Some(key_hash) = &key_hash {
        if let Some(receipt) = conversation
            .receipts
            .iter()
            .find(|r| r.author == out.author.name && &r.key == key_hash)
        {
            return if receipt.payload == payload {
                (
                    Admission::Replayed(receipt.seq, receipt.page.clone()),
                    Vec::new(),
                )
            } else {
                (Admission::KeyReused, Vec::new())
            };
        }
        // The receipts are shared out equally among the members. A writer
        // whose share is full drops their own oldest receipt: nobody waits,
        // the document stays bounded, and only that writer's oldest messages
        // of the last minutes lose their protection against a resend, long
        // after any automatic resend of them has ended.
        let share = (RECEIPTS / conversation.members.len().max(1)).max(1);
        let own = conversation
            .receipts
            .iter()
            .filter(|r| r.author == out.author.name)
            .count();
        if own >= share {
            if let Some(oldest) = conversation
                .receipts
                .iter()
                .position(|r| r.author == out.author.name)
            {
                conversation.receipts.remove(oldest);
            }
        }
    }
    if let Some(reply) = out.reply_to {
        if reply == 0 || reply > conversation.last {
            return (Admission::NoSuchReply, Vec::new());
        }
    }
    let Some(seq) = conversation.last.checked_add(1) else {
        return (Admission::Exhausted, Vec::new());
    };
    conversation.last = seq;
    let message = ConvMessage {
        seq,
        author: out.author.name.clone(),
        name: out.author.full_name.clone(),
        text: out.text.to_string(),
        at_ms: now_ms,
        key: out.key.map(str::to_string),
        attachments: out.attachments.to_vec(),
        reply_to: out.reply_to,
        tapbacks: BTreeMap::new(),
    };
    conversation.messages.push(message.clone());
    // Writing reads everything before it, and ends the writer's typing.
    let read = conversation
        .reads
        .entry(out.author.name.clone())
        .or_default();
    read.seq = seq;
    conversation.typing.remove(&out.author.name);
    if let Some(key) = key_hash {
        conversation.receipts.push(Receipt {
            author: out.author.name.clone(),
            key,
            seq,
            payload,
            at_ms: now_ms,
            page: None,
        });
    }
    let pages = page_out(conversation);
    (Admission::Added(message), pages)
}

fn json_len<T: serde::Serialize>(value: &T) -> usize {
    serde_json::to_vec(value).map_or(usize::MAX, |bytes| bytes.len())
}

/// Move the oldest messages out of the document while it holds more than
/// [`KEEP`] messages or more than [`DOC_BUDGET`] bytes, in pages of at most
/// [`PAGE`] messages and [`PAGE_BUDGET`] bytes, oldest first. The newest
/// message always stays.
pub fn page_out(conversation: &mut Conversation) -> Vec<Vec<ConvMessage>> {
    let mut pages = Vec::new();
    while conversation.messages.len() > 1
        && (conversation.messages.len() > KEEP || json_len(conversation) > DOC_BUDGET)
    {
        let mut page = Vec::new();
        let mut size = 2;
        while conversation.messages.len() > 1 && page.len() < PAGE {
            let next = json_len(&conversation.messages[0]) + 1;
            if !page.is_empty() && size + next > PAGE_BUDGET {
                break;
            }
            size += next;
            page.push(conversation.messages.remove(0));
        }
        pages.push(page);
    }
    pages
}

/// Set `member`'s tapback on message `seq` (`None` takes it away): whether
/// the message is still in the document.
pub fn tapback(
    conversation: &mut Conversation,
    member: &str,
    seq: u64,
    kind: Option<&str>,
) -> bool {
    let Some(message) = conversation.messages.iter_mut().find(|m| m.seq == seq) else {
        return false;
    };
    match kind {
        Some(kind) => {
            message
                .tapbacks
                .insert(member.to_string(), kind.to_string());
        }
        None => {
            message.tapbacks.remove(member);
        }
    }
    true
}

fn storage_error(error: std::io::Error) -> Response {
    Response::error(503, &error.to_string())
}

/// The conversation and its store version, or the reply refusing a request
/// by someone who is not a member (404: its existence is not confirmed).
async fn load(
    shared: &mut Space<'_>,
    id: &str,
    principal: &str,
) -> Result<(Conversation, u64), Response> {
    if !is_id(id) {
        return Err(Response::error(404, "no such conversation"));
    }
    match shared.get_versioned(&doc_key(id)).await {
        Ok(Some((bytes, version))) => {
            let conversation: Conversation = serde_json::from_slice(&bytes)
                .map_err(|_| Response::error(409, "the stored conversation cannot be read"))?;
            if conversation.is_member(principal) {
                Ok((conversation, version))
            } else {
                Err(Response::error(404, "no such conversation"))
            }
        }
        Ok(None) => Err(Response::error(404, "no such conversation")),
        Err(error) => Err(storage_error(error)),
    }
}

/// Read, change and write back a conversation by compare-and-set. `change`
/// answers the reply to give, and whether the document changed.
async fn update<F>(cx: &mut ApiCtx<'_>, id: &str, mut change: F) -> Response
where
    F: FnMut(&mut Conversation, &Member) -> (Response, bool),
{
    let principal = cx.session.principal.clone();
    for _ in 0..CAS_ATTEMPTS {
        let mut shared = cx.storage.shared();
        let (mut conversation, version) = match load(&mut shared, id, &principal).await {
            Ok(found) => found,
            Err(response) => return response,
        };
        let Some(me) = conversation.member(&principal).cloned() else {
            return Response::error(404, "no such conversation");
        };
        let (reply, changed) = change(&mut conversation, &me);
        if !changed {
            return reply;
        }
        let bytes = match serde_json::to_vec(&conversation) {
            Ok(bytes) => bytes,
            Err(error) => return Response::error(500, &error.to_string()),
        };
        match shared
            .put_if_version(&doc_key(id), &bytes, Some(version))
            .await
        {
            Ok(true) => {
                reload_others(cx, &conversation).await;
                return reply;
            }
            Ok(false) => continue,
            Err(error) => return storage_error(error),
        }
    }
    Response::error(503, "the conversation is busy; retry")
}

/// Make the open Messages windows of every other member read the
/// conversation again: their change count moves, and only their own personal
/// stream carries it (the router counts the writer's own change, tagged with
/// the writing browser). Nothing here fails the request.
async fn reload_others(cx: &mut ApiCtx<'_>, conversation: &Conversation) {
    let me = cx.session.principal.clone();
    let by = cx.session.id.clone();
    let now_ms = cx.now_ms;
    for member in conversation.members.iter().filter(|m| m.id != me) {
        if let Err(error) =
            notification_center::touched(cx.storage.store(), &member.id, MODULE.name, &by, now_ms)
                .await
        {
            ferrite_app::tracing::warn!(%error, "a member's Messages was not told to reload");
        }
    }
}

fn account_of(cx: &ApiCtx<'_>) -> Result<Account, Response> {
    cx.session
        .account
        .clone()
        .ok_or_else(|| Response::error(401, "sign in to message other people"))
}

/// Route a request under `/api/messages/conversations`; `None` when the path
/// is elsewhere.
pub async fn route(cx: &mut ApiCtx<'_>) -> Option<Response> {
    let path = cx.request.path.trim_end_matches('/').to_string();
    let segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
    if segments.first() != Some(&"conversations") && segments.first() != Some(&"attachments") {
        return None;
    }
    let account = match account_of(cx) {
        Ok(account) => account,
        // Before anyone signs in there are no conversations: an empty list,
        // not an error, so the desktop reads every app the same way.
        Err(_) if cx.request.method == "GET" && segments == ["conversations"] => {
            return Some(Response::json(
                200,
                &serde_json::json!({ "conversations": [] }),
            ))
        }
        Err(response) => return Some(response),
    };
    let method = cx.request.method;
    Some(match (method, segments.as_slice()) {
        ("GET", ["conversations"]) => list(cx).await,
        ("POST", ["conversations"]) => start(cx, &account).await,
        ("GET", ["conversations", id]) => read(cx, id).await,
        ("POST", ["conversations", id, "messages"]) => send(cx, id).await,
        ("POST", ["conversations", id, "read"]) => mark_read(cx, id).await,
        ("POST", ["conversations", id, "typing"]) => typing(cx, id).await,
        ("PUT", ["conversations", id, "title"]) => rename(cx, id).await,
        ("POST", ["conversations", id, "leave"]) => leave(cx, id).await,
        ("POST", ["conversations", id, "clear"]) => clear(cx, id).await,
        ("POST", ["conversations", id, "members"]) => add_member(cx, id).await,
        ("GET", ["conversations", id, "files"]) => files(cx, id).await,
        ("POST", ["conversations", id, "messages", seq, "hide"]) => hide(cx, id, seq).await,
        ("POST", ["conversations", id, "messages", seq, "tapback"]) => {
            set_tapback(cx, id, seq).await
        }
        ("GET", ["conversations", id, "history"]) => history(cx, id).await,
        ("GET", ["conversations", id, "attachments", attachment]) => {
            read_attachment(cx, id, attachment).await
        }
        ("POST" | "PUT" | "DELETE", ["attachments", ..]) if account.guest => {
            Response::error(403, "a Guest User cannot send attachments")
        }
        ("POST", ["attachments"]) => match cx.request.json::<attachments::NewAttachment>() {
            Ok(new) => {
                let (ctx, now_ms) = (cx.ctx, cx.now_ms);
                attachments::sweep(&mut cx.storage.user(), ctx, MODULE.name, now_ms).await;
                attachments::stage(&mut cx.storage.user(), &new, now_ms).await
            }
            Err(response) => response,
        },
        ("PUT", ["attachments", id, n]) => match n.parse::<u32>() {
            Ok(n) => {
                let (ctx, body, now_ms) = (cx.ctx, cx.request.body, cx.now_ms);
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
            Err(_) => Response::error(400, "the piece is a number"),
        },
        ("POST", ["attachments", id, "complete"]) => {
            let now_ms = cx.now_ms;
            attachments::seal(&mut cx.storage.user(), id, now_ms).await
        }
        ("DELETE", ["attachments", id]) => {
            let (ctx, now_ms) = (cx.ctx, cx.now_ms);
            attachments::cancel(&mut cx.storage.user(), ctx, MODULE.name, id, now_ms).await
        }
        (_, ["conversations"] | ["conversations", _]) => Response::method_not_allowed(),
        _ => Response::not_found(),
    })
}

/// `GET /conversations`: the person's [`LIST_LIMIT`] most recently active
/// conversations, the most recent first, each with its members, name, last
/// message and unread count. They are read from the person's activity index
/// ([`recent_ids`]), which is ordered by when each conversation was last
/// written to, so however many conversations a person has been in, the most
/// recent are the ones shown. An entry whose conversation the person is no
/// longer in (left, or gone) is taken out of their index.
async fn list(cx: &mut ApiCtx<'_>) -> Response {
    let (ctx, now_ms) = (cx.ctx, cx.now_ms);
    attachments::sweep(&mut cx.storage.user(), ctx, MODULE.name, now_ms).await;
    let principal = cx.session.principal.clone();
    let recent = match recent_ids(&mut cx.storage.user(), LIST_LIMIT, cx.now_ms).await {
        Ok(recent) => recent,
        Err(error) => return storage_error(error),
    };
    let mut out = Vec::new();
    let mut gone = Vec::new();
    let mut unseen = BTreeMap::new();
    let blocks = match blocked::load(&mut cx.storage.user()).await {
        Ok(blocks) => blocks,
        Err(error) => return storage_error(error),
    };
    for id in &recent {
        let mut space = cx.storage.user();
        let cleared = match cleared_record(&mut space, id).await {
            Ok(cleared) => cleared.map(|(cleared, _)| cleared),
            Err(error) => return storage_error(error),
        };
        let hidden = match hidden_record(&mut space, id).await {
            Ok((hidden, _)) => hidden,
            Err(error) => return storage_error(error),
        };
        unseen.insert(
            id.clone(),
            Unseen {
                cleared,
                hidden,
                blocks: blocks.clone(),
            },
        );
    }
    let mut shared = cx.storage.shared();
    for id in recent {
        let conversation = match load(&mut shared, &id, &principal).await {
            Ok((conversation, _)) => conversation,
            Err(response) => {
                if response.status == 404 {
                    gone.push(id);
                }
                continue;
            }
        };
        let Some(me) = conversation.member(&principal) else {
            continue;
        };
        let mine = unseen.remove(&id).unwrap_or_default();
        let last = conversation.messages.iter().rev().find(|m| mine.shows(m));
        // Deleted by this person, with nothing said since; or with one other person, blocked,
        // who has said nothing that shows. A page after what they cleared may hold what does.
        let listed = mine.cleared.is_some_and(|cleared| cleared.listed);
        let deleted = mine.cleared.is_some() && !listed;
        let only_blocked = !listed
            && conversation.members.len() == 2
            && conversation
                .members
                .iter()
                .any(|m| m.id != principal && blocks.now(&m.name));
        let older_kept = conversation.newest_page.is_some()
            && conversation
                .messages
                .first()
                .is_some_and(|first| first.seq > mine.through() + 1);
        if last.is_none() && !older_kept && (deleted || only_blocked) {
            continue;
        }
        let unread = conversation.unread_seeing(me, &mine);
        let from = conversation.unread_from(me, &mine);
        let unread = match unseen_on_pages(&mut shared, &id, &conversation, from, &mine).await {
            Ok(on_pages) => unread.saturating_sub(on_pages),
            Err(error) => return storage_error(error),
        };
        let group = !is_direct(&id, &conversation);
        let members: Vec<_> = conversation
            .members
            .iter()
            .map(|m| serde_json::json!({ "name": m.name, "full_name": m.full_name }))
            .collect();
        let at_ms = last.map_or(conversation.created_ms, |m| m.at_ms);
        out.push((
            at_ms,
            serde_json::json!({
                "id": id,
                "title": conversation.title,
                "members": members,
                "group": group,
                "last": last,
                "unread": unread,
                "at_ms": at_ms,
            }),
        ));
    }
    out.sort_by(|a, b| b.0.cmp(&a.0));
    for id in gone {
        if let Err(error) = forget_index(&mut cx.storage.user(), &id).await {
            ferrite_app::tracing::warn!(%error, "a gone conversation stayed in the index");
        }
    }
    let conversations: Vec<_> = out.into_iter().map(|(_, c)| c).collect();
    Response::json(200, &serde_json::json!({ "conversations": conversations }))
}

/// The ids of up to `limit` of the person's conversations, the most recently
/// active first, from the activity index (`recent/<inverted time>/<id>`).
///
/// An entry counts when its time is the one the conversation's `convs/<id>`
/// entry holds. That time only moves forward ([`bump_index`]), so an entry
/// older than it can never count again: it is deleted when met, and stale
/// entries never pile up in front of live ones. Nothing else is ever deleted
/// here. An entry newer than it, or for a conversation with no `convs/<id>`
/// entry, is a write being published (the entry is written before the
/// compare-and-set that makes it current); while it is in flight the entry
/// for the old time still counts, so the conversation is listed throughout.
/// Its time is always a real moment the conversation was written to, so once
/// it is older than [`PENDING_GRACE_MS`] (the request that wrote it stopped)
/// the list finishes the write itself with the same compare-and-set
/// ([`bump_index`]), and the entry counts. A conversation the person has left
/// is then not theirs to load, and [`list`] forgets it. Each read asks for
/// more by the entries it skipped, and reads again at most [`RECENT_ROUNDS`]
/// times. The first lists of an account made before this index copy its older
/// entries in ([`build_recent`]).
async fn recent_ids(
    space: &mut Space<'_>,
    limit: usize,
    now_ms: u64,
) -> std::io::Result<Vec<String>> {
    build_recent(space, now_ms).await?;
    let mut ids: Vec<String> = Vec::new();
    // Activity keys already counted, and the conversations already listed: a
    // write rolled forward below makes the batch's older entry for the same
    // conversation look current in what was read before it.
    let mut taken = std::collections::BTreeSet::new();
    let mut listed = std::collections::BTreeSet::new();
    let mut ask = limit.saturating_mul(RECENT_READ).max(1);
    for _ in 0..RECENT_ROUNDS {
        let entries = space.list("recent/", ask).await?;
        let read = entries.len();
        let mut cleared = 0;
        let mut skipped = 0;
        let mut parsed = Vec::new();
        for (key, value) in entries {
            match parse_recent(&key) {
                Some((at_ms, id)) => {
                    let id = id.to_string();
                    parsed.push((key, at_ms, id, written_ms(&value)));
                }
                None => {
                    space.delete(&key).await?;
                    cleared += 1;
                }
            }
        }
        let keys: Vec<String> = parsed.iter().map(|(_, _, id, _)| index_key(id)).collect();
        let held = space.get_many(&keys).await?;
        for ((key, at_ms, id, written), held) in parsed.into_iter().zip(held) {
            if taken.contains(&key) {
                continue;
            }
            // An entry without a time counts as written at 0, as the older list did.
            let counts = match held.as_deref().map(|bytes| entry_ms(bytes).unwrap_or(0)) {
                Some(held) if held == at_ms => true,
                Some(held) if at_ms < held => {
                    space.delete(&key).await?;
                    cleared += 1;
                    false
                }
                _ if now_ms.saturating_sub(written) >= PENDING_GRACE_MS => {
                    bump_index(space, &id, at_ms, now_ms).await?;
                    true
                }
                _ => {
                    skipped += 1;
                    false
                }
            };
            if counts {
                taken.insert(key);
                if ids.len() < limit && listed.insert(id.clone()) {
                    ids.push(id);
                }
            }
        }
        if ids.len() >= limit || read < ask || cleared + skipped == 0 {
            break;
        }
        ask = ask.saturating_add(skipped);
    }
    Ok(ids)
}

/// Copy the older per-conversation index (`convs/<id>`, all that accounts had
/// before the activity index) into the activity index, a chunk of ids at a
/// time (by the first hex digit of the id), recording in [`RECENT_BUILT`] how
/// many chunks are done. One request copies at least one chunk and stops after
/// [`RECENT_BUILD_BUDGET`] entries, so a very long index is copied over
/// several lists. Conversations written to since are in the activity index
/// already ([`bump_index`] writes both); a copy that races one only adds an
/// obsolete entry, which lists clear. An account with no older entries has
/// nothing to copy, and a list of it writes nothing: a read of an empty
/// account leaves no key behind (Storage Management counts none).
async fn build_recent(space: &mut Space<'_>, now_ms: u64) -> std::io::Result<()> {
    let done = match space.get(RECENT_BUILT).await? {
        Some(bytes) => std::str::from_utf8(&bytes)
            .ok()
            .and_then(|text| text.parse::<usize>().ok())
            .unwrap_or(0),
        None => {
            if space.list("convs/", 1).await?.is_empty() {
                return Ok(());
            }
            0
        }
    };
    let mut chunk = done;
    let mut copied = 0;
    while chunk < 16 && (chunk == done || copied < RECENT_BUILD_BUDGET) {
        for (key, value) in space
            .list(&format!("convs/c-{chunk:x}"), usize::MAX)
            .await?
        {
            let Some(id) = key.strip_prefix("convs/").filter(|id| is_id(id)) else {
                continue;
            };
            let at_ms = entry_ms(&value).unwrap_or(0);
            space
                .put(&recent_key(id, at_ms), &recent_value(now_ms))
                .await?;
            copied += 1;
        }
        chunk += 1;
        space
            .put(RECENT_BUILT, chunk.to_string().as_bytes())
            .await?;
    }
    Ok(())
}

/// Take conversation `id` out of a person's index: its activity entry and its
/// `convs/<id>` entry.
async fn forget_index(space: &mut Space<'_>, id: &str) -> std::io::Result<()> {
    if let Some(bytes) = space.get(&index_key(id)).await? {
        space
            .delete(&recent_key(id, entry_ms(&bytes).unwrap_or(0)))
            .await?;
    }
    space.delete(&index_key(id)).await
}

/// Record in every member's index that conversation `id` was written to at
/// `at_ms`, so their lists choose it among the most recent. A failure only
/// leaves an older time (the list still finds it).
async fn note_activity(cx: &mut ApiCtx<'_>, id: &str, members: &[Member], at_ms: u64) {
    if let Err(error) = index_members(cx, id, members, at_ms).await {
        ferrite_app::tracing::warn!(%error, "a member's conversation index was not updated");
    }
}

/// Make every member's index entry of conversation `id` hold at least
/// `at_ms`: a time only moves forward (compare-and-set keeps the latest), so
/// a late request never makes an active conversation look older.
async fn index_members(
    cx: &mut ApiCtx<'_>,
    id: &str,
    members: &[Member],
    at_ms: u64,
) -> std::io::Result<()> {
    let now_ms = cx.now_ms;
    for member in members {
        if member.id == cx.session.principal {
            bump_index(&mut cx.storage.user(), id, at_ms, now_ms).await?;
        } else {
            let mut storage = Storage::new(cx.storage.store(), MODULE.name, &member.id);
            bump_index(&mut storage.user(), id, at_ms, now_ms).await?;
        }
    }
    Ok(())
}

/// Raise the person's entry for conversation `id` to `at_ms` (never lower):
/// the activity entry for the new time is written first (saying when, for
/// [`PENDING_GRACE_MS`]), so the conversation is never missing from the
/// activity index whatever happens next; then the `convs/<id>` entry moves by
/// compare-and-set; then the entry for the old time goes. A list in between
/// counts the old entry and leaves the new one alone ([`recent_ids`]), which
/// only ever deletes an entry older than the time held. A bump for the time
/// already held writes the entry again, so a lost entry heals.
async fn bump_index(
    space: &mut Space<'_>,
    id: &str,
    at_ms: u64,
    now_ms: u64,
) -> std::io::Result<()> {
    let key = index_key(id);
    let recent = recent_key(id, at_ms);
    for _ in 0..CAS_ATTEMPTS {
        let stored = space.get_versioned(&key).await?;
        let held = stored.as_ref().and_then(|(bytes, _)| entry_ms(bytes));
        if let Some(held) = held.filter(|held| *held >= at_ms) {
            if held == at_ms {
                space.put(&recent, &recent_value(now_ms)).await?;
            }
            return Ok(());
        }
        space.put(&recent, &recent_value(now_ms)).await?;
        let entry = serde_json::json!({ "at_ms": at_ms }).to_string();
        if space
            .put_if_version(&key, entry.as_bytes(), stored.as_ref().map(|(_, v)| *v))
            .await?
        {
            if stored.is_some() {
                space.delete(&recent_key(id, held.unwrap_or(0))).await?;
            }
            return Ok(());
        }
    }
    Err(std::io::Error::other(
        "the conversation index kept changing",
    ))
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Start {
    to: Vec<String>,
    #[serde(default)]
    title: Option<String>,
}

/// The account name in what was typed: `Martin Klein (martin)`, `martin@macalicious` or `martin`.
fn account_token(raw: &str) -> &str {
    let token = raw.trim();
    let token = token
        .rsplit_once('(')
        .and_then(|(_, rest)| rest.strip_suffix(')'))
        .unwrap_or(token);
    let token = token
        .rsplit_once('<')
        .and_then(|(_, rest)| rest.strip_suffix('>'))
        .unwrap_or(token);
    token.strip_suffix("@macalicious").unwrap_or(token)
}

/// `POST /conversations` with `{"to": [names], "title"?}`: the conversation
/// with those people, made if it does not exist (`201`) or found (`200`).
async fn start(cx: &mut ApiCtx<'_>, account: &Account) -> Response {
    // A Guest User's data goes when the guest's time ends, and nobody can
    // address a guest: a conversation would outlive one of its members.
    if account.guest {
        return Response::error(403, "a Guest User cannot start conversations");
    }
    let request: Start = match cx.request.json() {
        Ok(request) => request,
        Err(response) => return response,
    };
    let title = match clean_title(request.title.as_deref().unwrap_or("")) {
        Ok(title) => title,
        Err(message) => return Response::error(400, message),
    };
    let me = Member {
        id: cx.session.principal.clone(),
        name: account.name.clone(),
        full_name: account.full_name.clone(),
    };
    // At most the members a conversation can have are looked up: every name
    // costs a read or two of the accounts.
    if request.to.len() > MAX_MEMBERS {
        return Response::error(400, "a conversation has at most 10 people");
    }
    let mut members = vec![me.clone()];
    let mut unknown = Vec::new();
    // Writing to oneself (a note to self, as Messages allows) is a conversation of one.
    let mut named_self = false;
    for raw in &request.to {
        match crate::accounts::lookup(cx.storage.store(), account_token(raw)).await {
            Ok(Some(found)) => {
                if found.id == me.id {
                    named_self = true;
                } else if !members.iter().any(|m| m.id == found.id) {
                    members.push(Member {
                        id: found.id,
                        name: found.name,
                        full_name: found.full_name,
                    });
                }
            }
            Ok(None) => unknown.push(raw.trim().to_string()),
            Err(error) => return storage_error(error),
        }
    }
    if !unknown.is_empty() {
        return Response::json(
            422,
            &serde_json::json!({
                "error": "no account of this desktop has that name",
                "unknown": unknown,
            }),
        );
    }
    if members.len() < 2 && !named_self {
        return Response::error(400, "a conversation needs someone to write to");
    }
    if members.len() > MAX_MEMBERS {
        return Response::error(400, "a conversation has at most 10 people");
    }
    if members.len() == 2 && title.is_some() {
        return Response::error(400, "a conversation of two has no name");
    }
    let key = cx.request.idempotency_key;
    if key.is_some_and(|k| k.is_empty() || k.len() > MAX_KEY_BYTES) {
        return Response::error(400, "an idempotency key is 1 to 128 bytes");
    }
    let id = if members.len() == 1 {
        direct_id(&me.id, &me.id)
    } else if members.len() == 2 {
        direct_id(&members[0].id, &members[1].id)
    } else if let Some(key) = key {
        // The key names the group asked for with its name: the same key with
        // another name is another group.
        group_id(
            &me.id,
            &format!("{key}\n{}", title.as_deref().unwrap_or("")),
        )
    } else {
        match crate::crypto::random_token(16) {
            Ok(random) => format!("c-{random}"),
            Err(error) => return storage_error(error),
        }
    };
    let keyed_group = members.len() > 2;
    let now_ms = cx.now_ms;
    // Finding a conversation that exists takes nothing; only making one does,
    // so the allowance is taken before the create that may make it.
    if !conversation_exists(cx, &id).await {
        match allowance::take(&mut cx.storage.user(), "start", STARTS_PER_DAY, now_ms).await {
            Ok(true) => {}
            Ok(false) => return spent("you have started the most conversations one day allows"),
            Err(error) => return storage_error(error),
        }
    }
    let conversation = Conversation {
        members: members.clone(),
        title,
        created_ms: now_ms,
        ..Conversation::default()
    };
    let bytes = match serde_json::to_vec(&conversation) {
        Ok(bytes) => bytes,
        Err(error) => return Response::error(500, &error.to_string()),
    };
    let made = match cx
        .storage
        .shared()
        .put_if_version(&doc_key(&id), &bytes, None)
        .await
    {
        Ok(made) => made,
        Err(error) => return storage_error(error),
    };
    // Found, not made: it must be one the person belongs to.
    let (stored, version) = match load(&mut cx.storage.shared(), &id, &me.id).await {
        Ok(found) => found,
        Err(response) => return response,
    };
    // A group found by the creator's key must be the group asked for: the
    // same key with other people is a different request, not a resend.
    if !made && keyed_group {
        let mut asked: Vec<&str> = members.iter().map(|m| m.id.as_str()).collect();
        let mut found: Vec<&str> = stored.members.iter().map(|m| m.id.as_str()).collect();
        asked.sort_unstable();
        found.sort_unstable();
        if asked != found {
            return Response::error(
                422,
                "this idempotency key was sent with another conversation",
            );
        }
    }
    // Every member's list finds it (again, harmlessly, when it existed).
    let at_ms = stored
        .messages
        .last()
        .map_or(stored.created_ms, |m| m.at_ms);
    if let Err(error) = index_members(cx, &id, &stored.members, at_ms).await {
        return storage_error(error);
    }
    if made {
        reload_others(cx, &stored).await;
    }
    let unseen = match unseen_by(&mut cx.storage.user(), &id).await {
        Ok(unseen) => unseen,
        Err(error) => return storage_error(error),
    };
    let mut state = view_with_id(&id, &stored);
    unseen.apply(&mut state);
    Response::json(
        if made { 201 } else { 200 },
        &serde_json::json!({ "version": version, "state": state }),
    )
}

/// Whether conversation `id` is stored (whoever its members are). A storage
/// error reads as absent: the allowance is then taken, and nothing is made
/// that was not asked for.
async fn conversation_exists(cx: &mut ApiCtx<'_>, id: &str) -> bool {
    matches!(cx.storage.shared().get(&doc_key(id)).await, Ok(Some(_)))
}

/// The reply when a daily allowance is spent.
fn spent(message: &str) -> Response {
    Response::error(429, message).add_header("retry-after", "3600")
}

/// `GET /conversations/<id>`: `{"version", "state"}`, as the feed sends it.
async fn read(cx: &mut ApiCtx<'_>, id: &str) -> Response {
    let principal = cx.session.principal.clone();
    let unseen = match unseen_by(&mut cx.storage.user(), id).await {
        Ok(unseen) => unseen,
        Err(error) => return storage_error(error),
    };
    match load(&mut cx.storage.shared(), id, &principal).await {
        Ok((conversation, version)) => {
            let mut state = view_with_id(id, &conversation);
            unseen.apply(&mut state);
            Response::json(
                200,
                &serde_json::json!({ "version": version, "state": state }),
            )
        }
        Err(response) => response,
    }
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct NewMessage {
    #[serde(default)]
    text: String,
    #[serde(default)]
    attachments: Vec<String>,
    #[serde(default)]
    reply_to: Option<u64>,
}

/// `POST /conversations/<id>/messages`: appends one message (`201
/// {"message"}`); a resend with the same `idempotency-key` within
/// [`KEY_RETENTION_MS`] answers `200` with the message stored the first time,
/// and the same key with a different message is refused (`422`).
async fn send(cx: &mut ApiCtx<'_>, id: &str) -> Response {
    let new: NewMessage = match cx.request.json() {
        Ok(new) => new,
        Err(response) => return response,
    };
    let text = match clean_text(&new.text) {
        Ok(text) => text,
        Err(message) => return Response::error(400, message),
    };
    if new.attachments.len() > MAX_ATTACHMENTS {
        return Response::error(400, "a message has at most 10 attachments");
    }
    if text.trim().is_empty() && new.attachments.is_empty() {
        return Response::error(400, "a message has text");
    }
    let key = cx.request.idempotency_key.map(str::to_string);
    if key
        .as_deref()
        .is_some_and(|k| k.is_empty() || k.len() > MAX_KEY_BYTES)
    {
        return Response::error(400, "an idempotency key is 1 to 128 bytes");
    }
    // Taken for good: a resend after a lost answer takes them again under the
    // same key, so a message with files needs one.
    let mut taken = Vec::new();
    if !new.attachments.is_empty() {
        let Some(key) = &key else {
            return Response::error(400, "a message with attachments needs an idempotency key");
        };
        // Membership first: nothing is taken for a conversation one is not in.
        let principal = cx.session.principal.clone();
        if let Err(response) = load(&mut cx.storage.shared(), id, &principal).await {
            return response;
        }
        let token = format!("conv:{id}:{}", hex_sha256(key.as_bytes()));
        let now_ms = cx.now_ms;
        taken = match attachments::take(&mut cx.storage.user(), &new.attachments, now_ms, &token)
            .await
        {
            Ok(taken) => taken,
            Err(refusal) => return refusal.reply(),
        };
    }
    match append(cx, id, key.as_deref(), &text, &taken, new.reply_to).await {
        Appended::Stored(message, conversation) => {
            if let Err(error) = record_attachments(cx, id, &message.attachments).await {
                // Stored, but its files cannot be read yet: a resend with the
                // key records them, and tells the members.
                return storage_error(error);
            }
            tell_members(cx, id, &conversation, &message).await;
            Response::json(201, &serde_json::json!({ "message": message }))
        }
        Appended::Replayed(seq) => {
            let (message, conversation) = match find_message(cx, id, seq).await {
                Ok(found) => found,
                Err(response) => return response,
            };
            // The first send may have stopped before recording its files or
            // telling the members: doing either again changes nothing twice.
            if let Err(error) = record_attachments(cx, id, &message.attachments).await {
                return storage_error(error);
            }
            tell_members(cx, id, &conversation, &message).await;
            Response::json(200, &serde_json::json!({ "message": message, "seq": seq }))
        }
        Appended::Refused(response) => response,
    }
}

/// Record that conversation `id` carries `attachments`, so its members may
/// read them.
async fn record_attachments(
    cx: &mut ApiCtx<'_>,
    id: &str,
    attachments: &[Attachment],
) -> std::io::Result<()> {
    let mut shared = cx.storage.shared();
    for attachment in attachments {
        let bytes = serde_json::to_vec(attachment).map_err(std::io::Error::other)?;
        shared
            .put(&attachment_key(id, &attachment.id), &bytes)
            .await?;
    }
    Ok(())
}

/// The bytes of an attachment of a conversation, for its members alone.
async fn read_attachment(cx: &mut ApiCtx<'_>, id: &str, attachment: &str) -> Response {
    let (first, count) = match attachments::read_range(
        cx.request.query_param("piece"),
        cx.request.query_param("count"),
    ) {
        Ok(range) => range,
        Err(response) => return response,
    };
    if !attachments::is_id(attachment) {
        return Response::error(404, "no such attachment");
    }
    let principal = cx.session.principal.clone();
    let mut shared = cx.storage.shared();
    if let Err(response) = load(&mut shared, id, &principal).await {
        return response;
    }
    let found = match shared
        .get_json::<Attachment>(&attachment_key(id, attachment))
        .await
    {
        Ok(found) => found,
        Err(error) => return storage_error(error),
    };
    match found {
        Some(found) => attachments::read(cx.ctx, MODULE.name, &found, first, count).await,
        None => Response::error(404, "the conversation has no such attachment"),
    }
}

/// What an append made of a message.
enum Appended {
    Stored(ConvMessage, Conversation),
    Replayed(u64),
    /// Not stored, or (storage failed mid-way) perhaps stored: a resend with
    /// the same key finds out.
    Refused(Response),
}

/// Append one message by compare-and-set, writing its pages of history
/// first under fresh names (a page another writer wrote is never touched;
/// the pages of a write that lost its compare-and-set are deleted).
async fn append(
    cx: &mut ApiCtx<'_>,
    id: &str,
    key: Option<&str>,
    text: &str,
    taken: &[Attachment],
    reply_to: Option<u64>,
) -> Appended {
    let principal = cx.session.principal.clone();
    let now_ms = cx.now_ms;
    // Taken once, by the first attempt that would store the message: a
    // resend that replays it takes nothing.
    let mut allowed = false;
    for _ in 0..CAS_ATTEMPTS {
        let (mut conversation, version) = match load(&mut cx.storage.shared(), id, &principal).await
        {
            Ok(found) => found,
            Err(response) => return Appended::Refused(response),
        };
        let Some(me) = conversation.member(&principal).cloned() else {
            return Appended::Refused(Response::error(404, "no such conversation"));
        };
        let out = Outgoing {
            author: &me,
            key,
            text,
            attachments: taken,
            reply_to,
        };
        let (admission, pages) = admit(&mut conversation, &out, now_ms);
        let message = match admission {
            Admission::Added(message) => message,
            Admission::Replayed(seq, _) => {
                // Taken by an attempt that lost to the first send of this
                // message: a resend takes nothing.
                if allowed {
                    give_back(cx, now_ms).await;
                }
                return Appended::Replayed(seq);
            }
            Admission::KeyReused => {
                return Appended::Refused(Response::error(
                    422,
                    "this idempotency key was sent with a different message",
                ))
            }
            Admission::Exhausted => {
                return Appended::Refused(Response::error(
                    409,
                    "the conversation has run out of message numbers",
                ))
            }
            Admission::NoSuchReply => {
                return Appended::Refused(Response::error(
                    400,
                    "the message replied to is not in the conversation",
                ))
            }
        };
        if !allowed {
            match allowance::take(&mut cx.storage.user(), "message", MESSAGES_PER_DAY, now_ms).await
            {
                Ok(true) => allowed = true,
                Ok(false) => {
                    return Appended::Refused(spent(
                        "you have written the most messages one day allows",
                    ))
                }
                Err(error) => return Appended::Refused(storage_error(error)),
            }
        }
        let mut shared = cx.storage.shared();
        let mut written = Vec::new();
        for messages in pages {
            let name = match crate::crypto::random_token(8) {
                Ok(random) => format!("{:06}-{random}", conversation.pages % 1_000_000),
                Err(error) => return Appended::Refused(storage_error(error)),
            };
            // A resend of a message on this page finds it through its receipt.
            for receipt in conversation.receipts.iter_mut() {
                if messages.iter().any(|m| m.seq == receipt.seq) {
                    receipt.page = Some(name.clone());
                }
            }
            let page = Page {
                messages,
                prev: conversation.newest_page.take(),
            };
            let bytes = match serde_json::to_vec(&page) {
                Ok(bytes) => bytes,
                Err(error) => return Appended::Refused(Response::error(500, &error.to_string())),
            };
            // Created only if absent: a fresh name, so nothing is replaced.
            match shared
                .put_if_version(&page_key(id, &name), &bytes, None)
                .await
            {
                Ok(true) => {}
                Ok(false) => {
                    return Appended::Refused(Response::error(
                        503,
                        "the conversation is busy; retry",
                    ))
                }
                Err(error) => return Appended::Refused(storage_error(error)),
            }
            written.push(name.clone());
            conversation.newest_page = Some(name);
            conversation.pages += 1;
        }
        let bytes = match serde_json::to_vec(&conversation) {
            Ok(bytes) => bytes,
            Err(error) => return Appended::Refused(Response::error(500, &error.to_string())),
        };
        match shared
            .put_if_version(&doc_key(id), &bytes, Some(version))
            .await
        {
            Ok(true) => return Appended::Stored(message, conversation),
            Ok(false) => {
                // Another write came first: these pages are nobody's.
                for name in written {
                    if let Err(error) = shared.delete(&page_key(id, &name)).await {
                        ferrite_app::tracing::warn!(%error, "an unused page was left");
                    }
                }
            }
            Err(error) => return Appended::Refused(storage_error(error)),
        }
    }
    Appended::Refused(Response::error(503, "the conversation is busy; retry"))
}

/// Give back the day's use of the message allowance that an attempt took.
/// Nothing here fails the request.
async fn give_back(cx: &mut ApiCtx<'_>, now_ms: u64) {
    if let Err(error) = allowance::give_back(&mut cx.storage.user(), "message", now_ms).await {
        ferrite_app::tracing::warn!(%error, "a message's allowance was not given back");
    }
}

/// Message `seq` of conversation `id`, with the conversation, read now: in
/// the document, or on the page its receipt in this reading names (another
/// append may have paged it since the receipt was first read). A message
/// that cannot be found or read is an error, never an empty success.
async fn find_message(
    cx: &mut ApiCtx<'_>,
    id: &str,
    seq: u64,
) -> Result<(ConvMessage, Conversation), Response> {
    let principal = cx.session.principal.clone();
    let mut shared = cx.storage.shared();
    let (conversation, _) = load(&mut shared, id, &principal).await?;
    if let Some(found) = conversation.messages.iter().find(|m| m.seq == seq) {
        return Ok((found.clone(), conversation));
    }
    let missing = || Response::error(503, "the message stored before cannot be read; retry");
    let page = conversation
        .receipts
        .iter()
        .find(|r| r.seq == seq)
        .and_then(|r| r.page.clone())
        .ok_or_else(missing)?;
    let bytes = match shared.get(&page_key(id, &page)).await {
        Ok(Some(bytes)) => bytes,
        Ok(None) => return Err(missing()),
        Err(error) => return Err(storage_error(error)),
    };
    let page: Page = serde_json::from_slice(&bytes).map_err(|_| missing())?;
    let found = page
        .messages
        .into_iter()
        .find(|m| m.seq == seq)
        .ok_or_else(missing)?;
    Ok((found, conversation))
}

/// Tell every other member of `message`: a notification (unless they have
/// turned on Do Not Disturb for it, [`super::muted`]), and their open Messages
/// windows reload, muted or not. Nothing here fails the message.
async fn tell_members(
    cx: &mut ApiCtx<'_>,
    id: &str,
    conversation: &Conversation,
    message: &ConvMessage,
) {
    let body = if message.text.trim().is_empty() {
        message
            .attachments
            .first()
            .map(|attachment| format!("Attachment: {}", attachment.name))
    } else {
        Some(message.text.chars().take(200).collect())
    };
    let note = Notification {
        app: MODULE.name.into(),
        id: format!("{id}#{}", message.seq),
        title: message.name.clone(),
        subtitle: conversation.title.clone(),
        body,
        ..Notification::default()
    };
    let now_ms = cx.now_ms;
    let me = cx.session.principal.clone();
    for member in conversation.members.iter().filter(|m| m.id != me) {
        if super::muted::is_muted(cx, &member.id, id).await {
            continue;
        }
        match blocked::hides_from(cx, &member.id, &message.author, message.at_ms).await {
            Ok(false) => {}
            Ok(true) => continue,
            // Nobody is told of what may be blocked; the message waits in their list if it is not.
            Err(error) => {
                ferrite_app::tracing::warn!(%error, "a member's blocks could not be read");
                continue;
            }
        }
        if let Err(error) =
            notification_center::notify(cx.storage.store(), &member.id, now_ms, &note).await
        {
            ferrite_app::tracing::warn!(%error, "a member was not notified of a message");
        }
    }
    note_activity(cx, id, &conversation.members, message.at_ms).await;
    reload_others(cx, conversation).await;
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct MarkRead {
    seq: u64,
    #[serde(default)]
    receipt: bool,
}

/// `POST /conversations/<id>/read` with `{"seq", "receipt"}`: the person has
/// read up to `seq`; with `receipt` the others see it.
async fn mark_read(cx: &mut ApiCtx<'_>, id: &str) -> Response {
    let request: MarkRead = match cx.request.json() {
        Ok(request) => request,
        Err(response) => return response,
    };
    update(cx, id, |conversation, me| {
        let seq = request.seq.min(conversation.last);
        let read = conversation.reads.entry(me.name.clone()).or_default();
        let next = Read {
            seq: read.seq.max(seq),
            shown: request.receipt,
        };
        let changed = *read != next;
        *read = next;
        (
            Response::json(200, &serde_json::json!({ "read": next.seq })),
            changed,
        )
    })
    .await
}

/// `POST /conversations/<id>/typing`: the person is typing, for
/// [`TYPING_MS`]. Written at most every few seconds by the page.
async fn typing(cx: &mut ApiCtx<'_>, id: &str) -> Response {
    let until = cx.now_ms + TYPING_MS;
    update(cx, id, |conversation, me| {
        conversation
            .typing
            .retain(|_, until_ms| *until_ms > until - TYPING_MS);
        conversation.typing.insert(me.name.clone(), until);
        (
            Response::json(200, &serde_json::json!({ "until_ms": until })),
            true,
        )
    })
    .await
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Rename {
    title: String,
}

/// `PUT /conversations/<id>/title` with `{"title"}`: names a group (an
/// empty name takes it away). A one-to-one conversation keeps no name.
async fn rename(cx: &mut ApiCtx<'_>, id: &str) -> Response {
    let request: Rename = match cx.request.json() {
        Ok(request) => request,
        Err(response) => return response,
    };
    let title = match clean_title(&request.title) {
        Ok(title) => title,
        Err(message) => return Response::error(400, message),
    };
    update(cx, id, |conversation, _| {
        if is_direct(id, conversation) {
            return (
                Response::error(409, "a conversation of two has no name"),
                false,
            );
        }
        let changed = conversation.title != title;
        conversation.title = title.clone();
        (
            Response::json(200, &serde_json::json!({ "title": conversation.title })),
            changed,
        )
    })
    .await
}

/// `POST /conversations/<id>/leave`: the person leaves a group (three or more
/// members). They stop being a member, so the conversation leaves their list
/// and reading or writing it answers `404` as for any conversation they are
/// not in; their read and typing marks go; the others see one member fewer
/// and are told with a notification. A conversation of two cannot be left
/// (`409`): it would be one person's. Leaving again answers `404`.
async fn leave(cx: &mut ApiCtx<'_>, id: &str) -> Response {
    let mut kept: Option<(Conversation, Member)> = None;
    let reply = update(cx, id, |conversation, me| {
        if conversation.members.len() <= 2 {
            return (
                Response::error(409, "a conversation of two cannot be left"),
                false,
            );
        }
        conversation.members.retain(|member| member.id != me.id);
        conversation.reads.remove(&me.name);
        conversation.typing.remove(&me.name);
        kept = Some((conversation.clone(), me.clone()));
        (
            Response::json(200, &serde_json::json!({ "left": true })),
            true,
        )
    })
    .await;
    let Some((conversation, me)) = kept.filter(|_| reply.status == 200) else {
        return reply;
    };
    if let Err(error) = forget_index(&mut cx.storage.user(), id).await {
        // The list clears it: the person is no longer a member.
        ferrite_app::tracing::warn!(%error, "a left conversation stayed in the index");
    }
    let note = Notification {
        app: MODULE.name.into(),
        id: format!("{id}#left-{}", me.name),
        title: me.full_name.clone(),
        subtitle: conversation.title.clone(),
        body: Some("left the conversation".into()),
        ..Notification::default()
    };
    let now_ms = cx.now_ms;
    for member in &conversation.members {
        if let Err(error) =
            notification_center::notify(cx.storage.store(), &member.id, now_ms, &note).await
        {
            ferrite_app::tracing::warn!(%error, "a member was not told someone left");
        }
    }
    reply
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Clearing {
    seq: u64,
    /// Clear Chat Transcript rather than Delete Conversation ([`Cleared::listed`]).
    #[serde(default)]
    listed: bool,
}

/// The key of the number through which this person has cleared conversation `id`.
fn cleared_key(id: &str) -> String {
    format!("cleared/{id}")
}

/// The key of the messages of conversation `id` this person deleted one at a time.
fn hidden_key(id: &str) -> String {
    format!("hidden/{id}")
}

/// What the person cleared of conversation `id`, stored as `<number>` or `<number> listed`, with
/// the record's store version; `None` when they have not. A record that cannot be read is an
/// error, so that nothing deleted is shown or written over on a guess.
async fn cleared_record(
    space: &mut Space<'_>,
    id: &str,
) -> std::io::Result<Option<(Cleared, u64)>> {
    let Some((bytes, version)) = space.get_versioned(&cleared_key(id)).await? else {
        return Ok(None);
    };
    let text = std::str::from_utf8(&bytes).unwrap_or("");
    let (number, listed) = match text.strip_suffix(" listed") {
        Some(number) => (number, true),
        None => (text, false),
    };
    let through = number
        .parse()
        .map_err(|_| std::io::Error::new(std::io::ErrorKind::InvalidData, "a cleared record"))?;
    Ok(Some((Cleared { through, listed }, version)))
}

/// The messages of conversation `id` the person deleted one at a time, with the record's store
/// version. A record that cannot be read is an error, as for [`cleared_record`].
async fn hidden_record(
    space: &mut Space<'_>,
    id: &str,
) -> std::io::Result<(Vec<u64>, Option<u64>)> {
    let Some((bytes, version)) = space.get_versioned(&hidden_key(id)).await? else {
        return Ok((Vec::new(), None));
    };
    let hidden = serde_json::from_slice(&bytes)
        .map_err(|_| std::io::Error::new(std::io::ErrorKind::InvalidData, "a hidden record"))?;
    Ok((hidden, Some(version)))
}

/// What the person whose `space` this is does not see of conversation `id`.
async fn unseen_by(space: &mut Space<'_>, id: &str) -> std::io::Result<Unseen> {
    let blocks = blocked::load(space).await?;
    let cleared = cleared_record(space, id).await?.map(|(cleared, _)| cleared);
    let (hidden, _) = hidden_record(space, id).await?;
    Ok(Unseen {
        cleared,
        hidden,
        blocks,
    })
}

/// Clears conversation `id` for one person through `wanted` at least: a lower number already
/// kept stays the higher one. `listed` says what it is now; `None`, for someone being added, leaves
/// what the person chose, and a first record is listed. What the number now is.
async fn raise_cleared(
    space: &mut Space<'_>,
    id: &str,
    wanted: u64,
    listed: Option<bool>,
) -> std::io::Result<u64> {
    for _ in 0..CAS_ATTEMPTS {
        let kept = cleared_record(space, id).await?;
        let through = kept.map_or(wanted, |(held, _)| held.through.max(wanted));
        let listed = listed.unwrap_or_else(|| kept.is_none_or(|(held, _)| held.listed));
        let text = if listed {
            format!("{through} listed")
        } else {
            through.to_string()
        };
        if space
            .put_if_version(
                &cleared_key(id),
                text.as_bytes(),
                kept.map(|(_, version)| version),
            )
            .await?
        {
            return Ok(through);
        }
    }
    Err(std::io::Error::other("the conversation is busy; retry"))
}

/// This person's other browsers read their Messages again. Nothing here fails the request.
async fn tell_own_browsers(cx: &mut ApiCtx<'_>) {
    let by = cx.session.id.clone();
    let principal = cx.session.principal.clone();
    let now_ms = cx.now_ms;
    if let Err(error) =
        notification_center::touched(cx.storage.store(), &principal, MODULE.name, &by, now_ms).await
    {
        ferrite_app::tracing::warn!(%error, "other browsers were not told to reload");
    }
}

/// `POST /conversations/<id>/clear` with `{"seq", "listed"}`: for this person alone, what is
/// numbered up to `seq` no longer shows. Without `listed` (Delete Conversation) the conversation
/// leaves their list until someone says something new; with it (Clear Chat Transcript) it stays,
/// empty. The other members keep everything. Sending it again changes nothing; a number lower than
/// one already kept keeps the higher.
async fn clear(cx: &mut ApiCtx<'_>, id: &str) -> Response {
    let Clearing { seq, listed } = match cx.request.json::<Clearing>() {
        Ok(body) => body,
        Err(response) => return response,
    };
    let principal = cx.session.principal.clone();
    let last = match load(&mut cx.storage.shared(), id, &principal).await {
        Ok((conversation, _)) => conversation.last,
        Err(response) => return response,
    };
    match raise_cleared(&mut cx.storage.user(), id, seq.min(last), Some(listed)).await {
        Ok(through) => {
            tell_own_browsers(cx).await;
            Response::json(200, &serde_json::json!({ "cleared": through }))
        }
        Err(error) => storage_error(error),
    }
}

/// `POST /conversations/<id>/messages/<seq>/hide`: Delete on a bubble, for this person alone. The
/// others keep the message. Sending it again changes nothing.
async fn hide(cx: &mut ApiCtx<'_>, id: &str, seq: &str) -> Response {
    let Ok(seq) = seq.parse::<u64>() else {
        return Response::error(400, "the message is a number");
    };
    let principal = cx.session.principal.clone();
    let last = match load(&mut cx.storage.shared(), id, &principal).await {
        Ok((conversation, _)) => conversation.last,
        Err(response) => return response,
    };
    if seq == 0 || seq > last {
        return Response::error(404, "no such message");
    }
    let key = hidden_key(id);
    for _ in 0..CAS_ATTEMPTS {
        let mut space = cx.storage.user();
        let (mut hidden, version) = match hidden_record(&mut space, id).await {
            Ok(found) => found,
            Err(error) => return storage_error(error),
        };
        let through = match cleared_record(&mut space, id).await {
            Ok(cleared) => cleared.map_or(0, |(cleared, _)| cleared.through),
            Err(error) => return storage_error(error),
        };
        if seq <= through || hidden.contains(&seq) {
            return Response::json(200, &serde_json::json!({ "hidden": seq }));
        }
        // A clear covers these from now on, which makes room for what is deleted after it.
        hidden.retain(|each| *each > through);
        if hidden.len() >= HIDDEN_LIMIT {
            return Response::error(409, "clear this transcript to delete more of its messages");
        }
        hidden.push(seq);
        let bytes = match serde_json::to_vec(&hidden) {
            Ok(bytes) => bytes,
            Err(error) => return Response::error(500, &error.to_string()),
        };
        match space.put_if_version(&key, &bytes, version).await {
            Ok(true) => {
                tell_own_browsers(cx).await;
                return Response::json(200, &serde_json::json!({ "hidden": seq }));
            }
            Ok(false) => continue,
            Err(error) => return storage_error(error),
        }
    }
    Response::error(503, "the conversation is busy; retry")
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct NewMember {
    to: String,
}

/// `POST /conversations/<id>/members` with `{"to"}`: a member adds someone to a group, however few
/// it has come down to. The new member sees what is said from now on, and is told. Adding someone
/// already in it changes nothing but finds it in their list again. A conversation between two
/// people takes nobody in (`409`): its id is theirs ([`is_direct`]).
async fn add_member(cx: &mut ApiCtx<'_>, id: &str) -> Response {
    let NewMember { to } = match cx.request.json::<NewMember>() {
        Ok(body) => body,
        Err(response) => return response,
    };
    let found = match crate::accounts::lookup(cx.storage.store(), account_token(&to)).await {
        Ok(Some(found)) => found,
        Ok(None) => {
            return Response::json(
                422,
                &serde_json::json!({
                    "error": "no account of this desktop has that name",
                    "unknown": [to.trim()],
                }),
            )
        }
        Err(error) => return storage_error(error),
    };
    let principal = cx.session.principal.clone();
    let now_ms = cx.now_ms;
    for _ in 0..CAS_ATTEMPTS {
        let (mut conversation, version) = match load(&mut cx.storage.shared(), id, &principal).await
        {
            Ok(found) => found,
            Err(response) => return response,
        };
        if is_direct(id, &conversation) {
            return Response::error(
                409,
                "a conversation of two stays between two: start a group instead",
            );
        }
        let at_ms = conversation
            .messages
            .last()
            .map_or(conversation.created_ms, |m| m.at_ms);
        let member = Member {
            id: found.id.clone(),
            name: found.name.clone(),
            full_name: found.full_name.clone(),
        };
        if conversation.is_member(&member.id) {
            note_activity(cx, id, std::slice::from_ref(&member), at_ms).await;
            return members_reply(200, &conversation);
        }
        if conversation.members.len() >= MAX_MEMBERS {
            return Response::error(409, "a conversation has at most 10 people");
        }
        // Before they are a member, so nothing older ever shows to them.
        let mut storage = Storage::new(cx.storage.store(), MODULE.name, &member.id);
        if let Err(error) = raise_cleared(&mut storage.user(), id, conversation.last, None).await {
            return storage_error(error);
        }
        conversation.members.push(member.clone());
        let bytes = match serde_json::to_vec(&conversation) {
            Ok(bytes) => bytes,
            Err(error) => return Response::error(500, &error.to_string()),
        };
        match cx
            .storage
            .shared()
            .put_if_version(&doc_key(id), &bytes, Some(version))
            .await
        {
            Ok(true) => {
                note_activity(cx, id, std::slice::from_ref(&member), at_ms).await;
                let adder = conversation
                    .member(&principal)
                    .map(|me| me.full_name.clone())
                    .unwrap_or_default();
                let note = Notification {
                    app: MODULE.name.into(),
                    id: format!("{id}#added-{}", member.name),
                    title: adder,
                    subtitle: conversation.title.clone(),
                    body: Some("added you to the conversation".into()),
                    ..Notification::default()
                };
                let adder_name = conversation
                    .member(&principal)
                    .map(|me| me.name.clone())
                    .unwrap_or_default();
                // Someone blocked tells nothing, and nor does one whose blocks cannot be read.
                let hidden = blocked::hides_from(cx, &member.id, &adder_name, now_ms).await;
                if matches!(hidden, Ok(false)) {
                    if let Err(error) =
                        notification_center::notify(cx.storage.store(), &member.id, now_ms, &note)
                            .await
                    {
                        ferrite_app::tracing::warn!(%error, "a new member was not told");
                    }
                }
                reload_others(cx, &conversation).await;
                return members_reply(201, &conversation);
            }
            Ok(false) => continue,
            Err(error) => return storage_error(error),
        }
    }
    Response::error(503, "the conversation is busy; retry")
}

/// Whether conversation `id` is the one its id says is between its members, rather than a group
/// that people have left until two are in it.
fn is_direct(id: &str, conversation: &Conversation) -> bool {
    match conversation.members.as_slice() {
        [only] => id == direct_id(&only.id, &only.id),
        [one, other] => id == direct_id(&one.id, &other.id),
        _ => false,
    }
}

fn members_reply(status: u16, conversation: &Conversation) -> Response {
    let members: Vec<_> = conversation
        .members
        .iter()
        .map(|m| serde_json::json!({ "name": m.name, "full_name": m.full_name }))
        .collect();
    Response::json(status, &serde_json::json!({ "members": members }))
}

/// `GET /conversations/<id>/files`: the attachments of the conversation this person can see, the
/// newest first, each with its message's number, writer and time, as far back as [`FILES_LIMIT`]
/// of them or [`FILES_PAGES`] pages of history reach; `more` says when there are older ones.
async fn files(cx: &mut ApiCtx<'_>, id: &str) -> Response {
    let principal = cx.session.principal.clone();
    let unseen = match unseen_by(&mut cx.storage.user(), id).await {
        Ok(unseen) => unseen,
        Err(error) => return storage_error(error),
    };
    let mut shared = cx.storage.shared();
    let conversation = match load(&mut shared, id, &principal).await {
        Ok((conversation, _)) => conversation,
        Err(response) => return response,
    };
    let through = unseen.through();
    let mut found = Vec::new();
    let mut take = |messages: &[ConvMessage]| {
        for message in messages.iter().rev().filter(|m| unseen.shows(m)) {
            for attachment in message.attachments.iter().rev() {
                if found.len() == FILES_LIMIT {
                    return false;
                }
                found.push(serde_json::json!({
                    "seq": message.seq,
                    "author": message.author,
                    "at_ms": message.at_ms,
                    "attachment": attachment,
                }));
            }
        }
        true
    };
    let mut more = !take(&conversation.messages);
    let mut older = conversation
        .messages
        .first()
        .is_none_or(|m| m.seq > through);
    let mut next = conversation.newest_page.clone();
    let mut read = 0;
    while let (Some(name), true, false) = (next.take(), older, more) {
        if read == FILES_PAGES {
            more = true;
            break;
        }
        read += 1;
        let page = match shared.get(&page_key(id, &name)).await {
            Ok(Some(bytes)) => serde_json::from_slice::<Page>(&bytes).ok(),
            Ok(None) => None,
            Err(error) => return storage_error(error),
        };
        let Some(page) = page else {
            more = true;
            break;
        };
        more = !take(&page.messages);
        older = page.messages.first().is_none_or(|m| m.seq > through);
        next = page.prev;
    }
    Response::json(200, &serde_json::json!({ "files": found, "more": more }))
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Tapback {
    kind: Option<String>,
}

/// `POST /conversations/<id>/messages/<seq>/tapback` with `{"kind"}` (one of
/// [`TAPBACKS`], or `null` to take it away).
async fn set_tapback(cx: &mut ApiCtx<'_>, id: &str, seq: &str) -> Response {
    let Ok(seq) = seq.parse::<u64>() else {
        return Response::error(400, "the message is a number");
    };
    let request: Tapback = match cx.request.json() {
        Ok(request) => request,
        Err(response) => return response,
    };
    if request
        .kind
        .as_deref()
        .is_some_and(|k| !TAPBACKS.contains(&k))
    {
        return Response::error(
            400,
            "a tapback is love, like, dislike, laugh, emphasize or question",
        );
    }
    update(cx, id, |conversation, me| {
        let before = conversation.clone();
        if !tapback(conversation, &me.name, seq, request.kind.as_deref()) {
            return (
                Response::error(404, "the message is not among the newest"),
                false,
            );
        }
        let changed = *conversation != before;
        (
            Response::json(200, &serde_json::json!({ "kind": request.kind })),
            changed,
        )
    })
    .await
}

/// `GET /conversations/<id>/history?page=<name>`: `{"page", "messages",
/// "prev"}`, the page of older messages named (the conversation's `older`
/// names the newest; each page's `prev` the one before it, `null` at the
/// oldest).
async fn history(cx: &mut ApiCtx<'_>, id: &str) -> Response {
    let principal = cx.session.principal.clone();
    let unseen = match unseen_by(&mut cx.storage.user(), id).await {
        Ok(unseen) => unseen,
        Err(error) => return storage_error(error),
    };
    let through = unseen.through();
    let mut shared = cx.storage.shared();
    // Membership first: someone outside learns nothing, not even what a page is.
    if let Err(response) = load(&mut shared, id, &principal).await {
        return response;
    }
    let Some(name) = cx.request.query_param("page").filter(|p| is_page_name(p)) else {
        return Response::error(400, "page names a page of history");
    };
    match shared.get(&page_key(id, name)).await {
        Ok(Some(bytes)) => match serde_json::from_slice::<Page>(&bytes) {
            Ok(page) => {
                // Nothing older than a page the person cleared part of is theirs to read.
                let prev = if page.messages.iter().any(|m| m.seq <= through) {
                    None
                } else {
                    page.prev
                };
                let messages: Vec<_> = page
                    .messages
                    .into_iter()
                    .filter(|message| unseen.shows(message))
                    .collect();
                Response::json(
                    200,
                    &serde_json::json!({ "page": name, "messages": messages, "prev": prev }),
                )
            }
            Err(_) => Response::error(409, "the page cannot be read"),
        },
        Ok(None) => Response::error(404, "no such page"),
        Err(error) => storage_error(error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn member(name: &str) -> Member {
        Member {
            id: format!("u-{name}"),
            name: name.into(),
            full_name: name.to_uppercase(),
        }
    }

    fn out<'a>(author: &'a Member, key: Option<&'a str>, text: &'a str) -> Outgoing<'a> {
        Outgoing {
            author,
            key,
            text,
            attachments: &[],
            reply_to: None,
        }
    }

    #[test]
    fn ids_are_private_and_a_pair_always_finds_its_conversation() {
        let (a, b) = ("u-0001", "u-0002");
        assert_eq!(direct_id(a, b), direct_id(b, a));
        assert_ne!(direct_id(a, b), direct_id(a, "u-0003"));
        assert!(is_id(&direct_id(a, b)));
        assert_ne!(group_id(a, "k1"), group_id(a, "k2"));
        assert!(is_id(&group_id(a, "k1")));
        for bad in [
            "",
            "c-",
            "desktop",
            &format!("c-{}", "A".repeat(32)),
            "c-../x",
        ] {
            assert!(!is_id(bad), "{bad}");
        }
    }

    #[test]
    fn a_message_is_stored_once_reads_what_came_before_and_ends_typing() {
        let (ann, bob) = (member("ann"), member("bob"));
        let mut c = Conversation {
            members: vec![ann.clone(), bob.clone()],
            ..Conversation::default()
        };
        c.typing.insert("ann".into(), 99);
        let (first, _) = admit(&mut c, &out(&ann, Some("k"), "hi"), 10);
        let Admission::Added(first) = first else {
            panic!("stored")
        };
        assert_eq!(first.seq, 1);
        assert!(c.typing.is_empty());
        assert_eq!(c.reads["ann"].seq, 1);
        assert_eq!(c.unread_for(&bob), 1);
        assert_eq!(c.unread_for(&ann), 0);
        assert_eq!(
            admit(&mut c, &out(&ann, Some("k"), "hi"), 20).0,
            Admission::Replayed(first.seq, None)
        );
        assert_eq!(
            admit(&mut c, &out(&ann, Some("k"), "other"), 20).0,
            Admission::KeyReused
        );
        // Past the key's retention it is a new message.
        assert!(matches!(
            admit(&mut c, &out(&ann, Some("k"), "hi"), 20 + KEY_RETENTION_MS).0,
            Admission::Added(_)
        ));
        // The same key from another member is a message of its own.
        assert!(matches!(
            admit(&mut c, &out(&bob, Some("k"), "hi"), 30).0,
            Admission::Added(_)
        ));
        let mut reply = out(&bob, None, "re");
        reply.reply_to = Some(9);
        assert_eq!(admit(&mut c, &reply, 40).0, Admission::NoSuchReply);
        reply.reply_to = Some(1);
        let (Admission::Added(answer), _) = admit(&mut c, &reply, 40) else {
            panic!()
        };
        assert_eq!(answer.reply_to, Some(1));
    }

    #[test]
    fn receipts_are_shared_among_members_and_followed_to_their_page() {
        let ann = member("ann");
        let mut c = Conversation {
            members: vec![ann.clone(), member("bob")],
            ..Conversation::default()
        };
        // Ann's share of the receipts is half: the conversation has two members.
        for n in 0..RECEIPTS / 2 {
            let key = format!("k{n}");
            assert!(matches!(
                admit(&mut c, &out(&ann, Some(&key), "x"), 1).0,
                Admission::Added(_)
            ));
        }
        // Her share full: a new keyed message of hers goes in, and drops her
        // oldest receipt, never anyone else's; her newer keys still replay.
        assert!(matches!(
            admit(&mut c, &out(&member("bob"), Some("bob-1"), "x"), 1).0,
            Admission::Added(_)
        ));
        assert!(matches!(
            admit(&mut c, &out(&ann, Some("late"), "x"), 2).0,
            Admission::Added(_)
        ));
        assert_eq!(
            c.receipts.iter().filter(|r| r.author == "ann").count(),
            RECEIPTS / 2
        );
        assert!(c.receipts.iter().any(|r| r.author == "bob"));
        assert!(matches!(
            admit(&mut c, &out(&ann, Some("k1"), "x"), 2).0,
            Admission::Replayed(2, _)
        ));
        // Her oldest key was dropped for "late": the same message under it is stored anew.
        assert!(matches!(
            admit(&mut c, &out(&ann, Some("k0"), "x"), 2).0,
            Admission::Added(_)
        ));
        assert!(matches!(
            admit(&mut c, &out(&ann, None, "x"), 2).0,
            Admission::Added(_)
        ));
        // Once their time has passed they go, and keyed messages go in again.
        assert!(matches!(
            admit(&mut c, &out(&ann, Some("late"), "x"), 2 + KEY_RETENTION_MS).0,
            Admission::Added(_)
        ));
        // Bob's receipt has passed its time too: only Ann's new one is kept.
        assert_eq!(c.receipts.len(), 1);
    }

    #[test]
    fn old_messages_move_to_pages_and_none_is_lost() {
        let ann = member("ann");
        let bob = member("bob");
        let mut c = Conversation {
            members: vec![ann.clone(), bob.clone()],
            ..Conversation::default()
        };
        let mut paged = Vec::new();
        for n in 0..(KEEP + PAGE + 1) {
            let text = format!("m{n}");
            let (_, pages) = admit(&mut c, &out(&ann, None, &text), n as u64);
            for page in pages {
                assert_eq!(page.len(), PAGE);
                paged.extend(page);
            }
        }
        let all: Vec<u64> = paged.iter().chain(&c.messages).map(|m| m.seq).collect();
        assert_eq!(all, (1..=(KEEP + PAGE + 1) as u64).collect::<Vec<_>>());
        assert!(c.messages.len() <= KEEP);
        // Unread counts every message Bob has not read, paged or not.
        assert_eq!(c.unread_for(&bob), (KEEP + PAGE + 1) as u64);
        c.reads.insert(
            "bob".into(),
            Read {
                seq: 10,
                shown: false,
            },
        );
        assert_eq!(c.unread_for(&bob), (KEEP + PAGE + 1 - 10) as u64);
    }

    #[test]
    fn the_document_and_its_pages_stay_within_the_store_limit() {
        let ann = member("ann");
        let mut c = Conversation {
            members: vec![ann.clone(), member("bob")],
            ..Conversation::default()
        };
        // The largest messages there are: 4,000 characters that each take
        // six bytes in JSON, with keys (so receipts too).
        let text = "\u{1}".repeat(MAX_TEXT_CHARS);
        let mut seen = 0;
        for n in 0..60u64 {
            let key = format!("{n:0>128}");
            let (admission, pages) = admit(&mut c, &out(&ann, Some(&key), &text), n);
            assert!(matches!(admission, Admission::Added(_)));
            for page in pages {
                assert!(
                    json_len(&page) <= PAGE_BUDGET,
                    "page of {} bytes",
                    json_len(&page)
                );
                seen += page.len();
            }
            assert!(
                json_len(&c) <= DOC_BUDGET,
                "document of {} bytes",
                json_len(&c)
            );
        }
        assert_eq!(seen + c.messages.len(), 60);
        assert!(c.messages.len() < KEEP, "paged by size, not count");
        assert!(c.receipts.len() <= RECEIPTS);
    }

    #[test]
    fn activity_keys_sort_newest_first_and_parse_back() {
        let id = direct_id("u-1", "u-2");
        let older = recent_key(&id, 1_000);
        let newer = recent_key(&id, 2_000);
        assert!(newer < older, "newer sorts first");
        assert_eq!(parse_recent(&older), Some((1_000, id.as_str())));
        assert_eq!(parse_recent(&recent_key(&id, 0)), Some((0, id.as_str())));
        for bad in [
            "recent/",
            "recent/zz/c-1",
            "recent/0000000000000000/../x",
            "convs/c-1",
        ] {
            assert_eq!(parse_recent(bad), None, "{bad}");
        }
        assert_eq!(entry_ms(br#"{"at_ms":7}"#), Some(7));
        assert_eq!(entry_ms(b"{}"), None);
        assert_eq!(written_ms(&recent_value(42)), 42);
        assert_eq!(written_ms(b""), 0);
    }

    #[test]
    fn page_names_are_checked() {
        assert!(is_page_name("000003-0123456789abcdef"));
        for bad in ["", "3", "000003", "000003-../x", "00003-0123456789abcdef"] {
            assert!(!is_page_name(bad), "{bad}");
        }
    }

    #[test]
    fn the_view_hides_account_ids_and_unshown_reads() {
        let mut c = Conversation {
            members: vec![member("ann"), member("bob")],
            ..Conversation::default()
        };
        c.reads.insert(
            "ann".into(),
            Read {
                seq: 3,
                shown: true,
            },
        );
        c.reads.insert(
            "bob".into(),
            Read {
                seq: 2,
                shown: false,
            },
        );
        let seen = view(&c).to_string();
        assert!(!seen.contains("u-ann"), "{seen}");
        assert_eq!(view(&c)["read"], serde_json::json!({ "ann": 3 }));
        assert!(
            tapback(&mut c, "ann", 1, Some("love")) == false,
            "no message 1 yet"
        );
    }

    #[test]
    fn texts_and_names_have_limits() {
        assert!(clean_text(&"x".repeat(4_001)).is_err());
        assert_eq!(clean_text("\nhi \n").unwrap(), "hi");
        assert_eq!(clean_title("  ").unwrap(), None);
        assert_eq!(
            clean_title("Ferry\u{7}crew").unwrap().as_deref(),
            Some("Ferrycrew")
        );
        assert!(clean_title(&"x".repeat(61)).is_err());
    }
}

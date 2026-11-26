//! Notification Center's server half: each person's notifications, and what
//! the personal live stream (`/live/me`, `src/live.rs`) brings to every
//! browser that person has open.
//!
//! **Raising a notification.** Any module, or a background loop such as a
//! timer consumer, calls [`notify`] with the store, the person's principal
//! and a [`Notification`]. It is added to that person's inbox, and the
//! personal stream pushes it within a poll to all of that person's open
//! browsers, which show it as a banner (or, with [`Notification::alert`], as
//! an alert that stays until it is acted on) unless Do Not Disturb is on, and
//! list it in the panel. Nobody else's stream reads that inbox. A
//! notification is identified by its app and `id`: delivering the same one
//! again (a redelivered queue message, a retried request) changes nothing,
//! even after it was cleared, so a retry never brings back what the person
//! dismissed. [`withdraw_at`] takes one back, for instance when the app itself
//! dismissed the alert.
//!
//! Messages calls [`notify`] for the recent members of a room when someone
//! else writes in it, and Chess for the opponent when a move is played.
//!
//! **Routes** (`/api/notification-center/...`), all on the person's own data:
//!
//! * `GET /inbox`: `{"items": [Item], "dnd": bool}`, newest first, the
//!   same `state` the personal stream sends (without `changes`).
//! * `DELETE /inbox/<seq>`: clears one; `DELETE /inbox?app=<app>` clears an
//!   app's group; `DELETE /inbox` clears them all. `{"removed": n}`.
//! * `PUT /dnd` with `{"on": bool}`: Do Not Disturb, kept with the inbox so
//!   that every open browser hears the change. `{"dnd": bool}`.
//! * `POST /notify` with `{"app", "title", "subtitle"?, "body"?}`: a
//!   notification a page raises for its own person (a finished download, a
//!   timer of a page's own), banner style, with no server actions. With the
//!   browser's `idempotency-key` header a resend is delivered once. `201`
//!   with `{"delivered": bool}`.
//!
//! **The personal stream.** A stream open carries no headers (upstream Core),
//! so a page first asks the router for a ticket (`POST /api/session/ticket`,
//! [`issue_ticket`]): 32 random bytes, good once, for [`TICKET_TTL_MS`], kept
//! only as its SHA-256 beside the principal and the session that asked. The
//! page opens `/live/me?ticket=…`; the live loop redeems it
//! ([`redeem_ticket`]) for that stream open alone (a redelivery of the same
//! open, after a failure before its first frame, redeems it again) and from
//! then on sends [`personal_state`] whenever it
//! changes, checking every few seconds that the session is still signed in to
//! the same person.
//!
//! **Changes.** When a person changes a document in any module from one
//! browser, the router records it ([`touched`]) as that module's change
//! count and the browser that made it ([`browser_tag`]). The personal stream
//! carries those counts, so every other browser of the same person reloads
//! that module's documents at once. They are kept outside the person's own
//! space (`shared/changes/<principal>`, expiring after
//! [`CHANGES_TTL_MS`]), so they never count as data the person stores.
//!
//! Storage, in the person's own space: `inbox`, one document of the newest
//! [`INBOX_LIMIT`] notifications, the ids of the last [`SEEN_LIMIT`]
//! delivered (for the deduplication above) and Do Not Disturb, written by
//! compare-and-set.

use std::collections::BTreeMap;
use std::io;

use ferrite_app::client::StoreClusterClient;
use ferrite_app::crypto::{hex, sha256};
use ferrite_app::{serde, serde_json};

use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture, Space, Storage};
use crate::session::Session;
use crate::store::IntoStore;

pub const MODULE: AppModule = AppModule {
    name: APP,
    title: "Notification Center",
    handle,
};

/// The module's name and storage namespace.
pub const APP: &str = "notification-center";
/// The most notifications an inbox keeps; the oldest go first.
pub const INBOX_LIMIT: usize = 50;
/// The most delivered ids an inbox remembers, so a retry is not shown again.
pub const SEEN_LIMIT: usize = 500;
/// The most bytes a stored inbox takes, well under the store's 200 KB value limit: the oldest
/// notifications, then the oldest remembered ids, go first when the counts alone allow more.
pub const INBOX_MAX_BYTES: usize = 150_000;
/// How long a stream ticket can be redeemed.
pub const TICKET_TTL_MS: u64 = 60_000;
/// How long a person's change counts are kept after the last change.
pub const CHANGES_TTL_MS: u64 = 30 * 24 * 60 * 60 * 1000;
/// The reply header that names the number a write was given in its module's
/// change count, so the page that made it knows that change for its own and
/// loads nothing again when the stream counts it.
pub const CHANGE_HEADER: &str = "x-macalicious-change";
/// The longest title or subtitle, in characters; longer ones are cut.
pub const MAX_TITLE_CHARS: usize = 200;
/// The longest message, in characters; a longer one is cut.
pub const MAX_BODY_CHARS: usize = 1_000;
/// The most action buttons a notification carries besides Close: one shows
/// as a button of the alert, two as the items of its Options pull-down.
pub const MAX_ACTIONS: usize = 2;
const MAX_LABEL_CHARS: usize = 40;
const MAX_PATH_CHARS: usize = 200;
const MAX_ID_CHARS: usize = 200;
const MAX_APP_CHARS: usize = 40;
const CAS_ATTEMPTS: usize = 16;
const INBOX: &str = "inbox";
const TICKETS: &str = "apps/notification-center/shared/tickets/";
const CHANGES: &str = "apps/notification-center/shared/changes/";

/// A button of an alert, besides Close.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, Default, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Action {
    /// The button's title: "Snooze", "Reply".
    pub label: String,
    /// A path under `/api/<app>` the page POSTs `{}` to when it is pressed,
    /// or `None` for a button that opens the app.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub post: Option<String>,
}

/// One notification, as an app raises it.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, Default, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Notification {
    /// The module or desktop app that raises it (`calendar`): its name and
    /// icon, and the app a click opens.
    pub app: String,
    /// Stable within the app: the same notification delivered again is one.
    pub id: String,
    /// The bold first line.
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subtitle: Option<String>,
    /// The message.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
    /// An alert, which stays on screen until it is acted on, rather than a
    /// banner, which slides away by itself.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub alert: bool,
    /// A path under `/api/<app>` the page POSTs `{}` to when the person
    /// closes or clears it, so the app hears it was dismissed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dismiss: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub actions: Vec<Action>,
}

/// A delivered notification: its number in the inbox and when it came.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Item {
    pub seq: u64,
    pub at_ms: u64,
    #[serde(flatten)]
    pub note: Notification,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, Default, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
struct Inbox {
    /// The last `seq` handed out.
    #[serde(default)]
    last: u64,
    /// Oldest first.
    #[serde(default)]
    items: Vec<Item>,
    /// [`seen_key`] of the last delivered notifications, oldest first.
    #[serde(default)]
    seen: Vec<String>,
    #[serde(default)]
    dnd: bool,
}

/// One module's changes by one person.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
struct Change {
    /// How many changes, ever (within the record's life).
    n: u64,
    /// [`browser_tag`] of the browser that made the last one.
    by: String,
    /// When this count began (the platform clock at its first change), so a
    /// page can tell a count that started again from one that went on: the
    /// numbers of the two are different changes. 0 for a count kept before
    /// this was recorded.
    #[serde(default)]
    since: u64,
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Ticket {
    principal: String,
    session: String,
    expires_ms: u64,
    #[serde(default)]
    used: bool,
    /// The stream open (its correlation id) that spent the ticket: that same
    /// open, redelivered after a failure before it was answered, may redeem
    /// it again; no other open may.
    #[serde(default)]
    claimed_by: Option<String>,
}

/// What redeeming a ticket for one stream open does.
#[derive(Debug, PartialEq, Eq)]
enum Claim {
    /// Unused and unexpired: spend it for this open.
    New,
    /// Already spent by this very open, now redelivered: good again.
    Again,
    /// Expired, or spent by another open.
    Refused,
}

fn claim(record: &Ticket, claimant: &str, now_ms: u64) -> Claim {
    if record.expires_ms <= now_ms {
        Claim::Refused
    } else if !record.used {
        Claim::New
    } else if record.claimed_by.as_deref() == Some(claimant) {
        Claim::Again
    } else {
        Claim::Refused
    }
}

fn invalid(message: impl Into<String>) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidInput, message.into())
}

fn data_error(e: serde_json::Error) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, e.to_string())
}

fn is_name(name: &str) -> bool {
    (1..=MAX_APP_CHARS).contains(&name.len())
        && name
            .bytes()
            .all(|b| matches!(b, b'a'..=b'z' | b'0'..=b'9' | b'-'))
}

/// A path under `/api/<app>`: `/` and URL-safe characters, never `..` and no
/// percent-escapes, so no spelling of it can leave the app's routes.
fn is_path(path: &str) -> bool {
    path.starts_with('/')
        && path.len() <= MAX_PATH_CHARS
        && !path.contains("..")
        && path.bytes().all(|b| {
            b.is_ascii_alphanumeric() || matches!(b, b'/' | b'-' | b'_' | b'.' | b'~' | b'@')
        })
}

/// `text` cut to `max` characters, the last of them an ellipsis.
fn cut(text: &str, max: usize) -> String {
    let text = text.trim();
    if text.chars().count() <= max {
        return text.to_string();
    }
    let mut out: String = text.chars().take(max - 1).collect();
    out.push('\u{2026}');
    out
}

/// The notification as it is kept: texts trimmed and cut to their limits,
/// empty optional texts dropped; an error when it cannot be shown or acted
/// on (a bad app name or id, no title, a path that is not one).
pub fn normalize(note: &Notification) -> Result<Notification, String> {
    if !is_name(&note.app) {
        return Err("an app is 1 to 40 lowercase letters, digits or '-'".into());
    }
    if note.id.is_empty()
        || note.id.chars().count() > MAX_ID_CHARS
        || note.id.chars().any(char::is_control)
    {
        return Err("an id is 1 to 200 characters without control characters".into());
    }
    let title = cut(&note.title, MAX_TITLE_CHARS);
    if title.is_empty() {
        return Err("a notification has a title".into());
    }
    let optional = |text: &Option<String>, max| {
        text.as_deref()
            .map(|t| cut(t, max))
            .filter(|t| !t.is_empty())
    };
    if note.dismiss.as_deref().is_some_and(|p| !is_path(p)) {
        return Err("a dismiss path is a path under the app, such as /alerts/1/dismiss".into());
    }
    if note.actions.len() > MAX_ACTIONS {
        return Err(format!("a notification has at most {MAX_ACTIONS} actions"));
    }
    let mut actions = Vec::with_capacity(note.actions.len());
    for action in &note.actions {
        let label = cut(&action.label, MAX_LABEL_CHARS);
        if label.is_empty() || action.post.as_deref().is_some_and(|p| !is_path(p)) {
            return Err("an action has a label and, if it posts, a path under the app".into());
        }
        actions.push(Action {
            label,
            post: action.post.clone(),
        });
    }
    Ok(Notification {
        app: note.app.clone(),
        id: note.id.clone(),
        title,
        subtitle: optional(&note.subtitle, MAX_TITLE_CHARS),
        body: optional(&note.body, MAX_BODY_CHARS),
        alert: note.alert,
        dismiss: note.dismiss.clone(),
        actions,
    })
}

fn seen_key(app: &str, id: &str) -> String {
    format!("{app}\n{id}")
}

/// Add `note` to the inbox unless it was delivered before: whether it was
/// added.
fn deliver(inbox: &mut Inbox, note: Notification, now_ms: u64) -> bool {
    let key = seen_key(&note.app, &note.id);
    if inbox.seen.contains(&key) {
        return false;
    }
    inbox.last += 1;
    inbox.items.push(Item {
        seq: inbox.last,
        at_ms: now_ms,
        note,
    });
    let excess = inbox.items.len().saturating_sub(INBOX_LIMIT);
    inbox.items.drain(..excess);
    inbox.seen.push(key);
    let excess = inbox.seen.len().saturating_sub(SEEN_LIMIT);
    inbox.seen.drain(..excess);
    true
}

/// Remove the items `drop` picks: how many went.
fn remove(inbox: &mut Inbox, drop: impl Fn(&Item) -> bool) -> usize {
    let before = inbox.items.len();
    inbox.items.retain(|item| !drop(item));
    before - inbox.items.len()
}

/// The inbox as stored, within [`INBOX_MAX_BYTES`]. While it is larger, the oldest remembered ids
/// go first (a quarter at a time, never fewer than there are notifications), then the oldest
/// notifications, never the newest one, and last any ids still left: five hundred remembered ids
/// at their longest, or fifty notifications at their longest, can each pass it alone.
fn encode_within_budget(inbox: &mut Inbox) -> io::Result<Vec<u8>> {
    loop {
        let bytes = serde_json::to_vec(inbox).map_err(data_error)?;
        if bytes.len() <= INBOX_MAX_BYTES {
            return Ok(bytes);
        }
        let spare = inbox.seen.len().saturating_sub(inbox.items.len());
        if spare > 0 {
            let quarter = inbox.seen.len().div_ceil(4).min(spare);
            inbox.seen.drain(..quarter);
        } else if inbox.items.len() > 1 {
            inbox.items.remove(0);
        } else if !inbox.seen.is_empty() {
            let quarter = inbox.seen.len().div_ceil(4);
            inbox.seen.drain(..quarter);
        } else {
            return Ok(bytes);
        }
    }
}

fn decode_inbox(bytes: Option<&[u8]>) -> io::Result<Inbox> {
    bytes.map_or(Ok(Inbox::default()), |bytes| {
        serde_json::from_slice(bytes).map_err(data_error)
    })
}

/// The inbox as a page sees it.
fn inbox_view(inbox: &Inbox) -> serde_json::Value {
    let items: Vec<&Item> = inbox.items.iter().rev().collect();
    serde_json::json!({ "items": items, "dnd": inbox.dnd })
}

/// Read the inbox, apply `change`, and write it back by compare-and-set when
/// `change` says it changed. Returns what `change` returned.
async fn update<T>(
    space: &mut Space<'_>,
    mut change: impl FnMut(&mut Inbox) -> (T, bool),
) -> io::Result<T> {
    for _ in 0..CAS_ATTEMPTS {
        let stored = space.get_versioned(INBOX).await?;
        let version = stored.as_ref().map(|(_, version)| *version);
        // An inbox that cannot be read is left as it is, not replaced.
        let mut inbox = decode_inbox(stored.as_ref().map(|(bytes, _)| bytes.as_slice()))?;
        let (out, changed) = change(&mut inbox);
        if !changed {
            return Ok(out);
        }
        let bytes = encode_within_budget(&mut inbox)?;
        if space.put_if_version(INBOX, &bytes, version).await? {
            return Ok(out);
        }
    }
    Err(io::Error::other("the inbox kept changing; retry"))
}

/// When the Guest User `principal`'s time ends (epoch ms): the guest's
/// account record's creation plus the guest lifetime, exactly as guest
/// sign-in sets the session and the record to expire. `None` when the record
/// is gone (expired, or purged after a log-out) or that time has passed.
async fn guest_ends_ms<'s>(
    store: impl IntoStore<'s>,
    principal: &str,
    now_ms: u64,
) -> io::Result<Option<u64>> {
    let mut store = store.into_store();
    #[derive(serde::Deserialize)]
    #[serde(crate = "ferrite_app::serde")]
    struct GuestRecord {
        created_ms: u64,
        #[serde(default)]
        guest: bool,
    }
    let key = format!("{}{principal}", crate::accounts::USERS_PREFIX);
    let Some((bytes, _)) = store.get_versioned(key.as_bytes()).await? else {
        return Ok(None);
    };
    let Ok(record) = serde_json::from_slice::<GuestRecord>(&bytes) else {
        return Ok(None);
    };
    let ends = record.created_ms + crate::session::GUEST_MAX_AGE_SECONDS * 1000;
    Ok((record.guest && ends > now_ms).then_some(ends))
}

/// The person's storage outside a request. A Guest User's keys expire when
/// the guest's time ends, as the router makes them in requests; `None` for a
/// guest whose time has ended, so nothing of theirs is written again.
async fn storage_for<'a>(
    store: impl IntoStore<'a>,
    principal: &'a str,
    now_ms: u64,
) -> io::Result<Option<Storage<'a>>> {
    let mut store = store.into_store();
    if !principal.starts_with("g-") {
        return Ok(Some(Storage::new(store, APP, principal)));
    }
    let Some(ends) = guest_ends_ms(&mut store, principal, now_ms).await? else {
        return Ok(None);
    };
    Ok(Some(
        Storage::new(store, APP, principal).user_data_expires(Some(ends)),
    ))
}

/// Deliver `note` to the person `principal` (the account id, or an anonymous
/// browser's session id: `Session::principal`). `Ok(true)` when it was added,
/// `Ok(false)` when it had been delivered before or `principal` is a Guest
/// User whose time has ended, an `InvalidInput` error when [`normalize`]
/// refuses it.
pub async fn notify<'s>(
    store: impl IntoStore<'s>,
    principal: &'s str,
    now_ms: u64,
    note: &Notification,
) -> io::Result<bool> {
    let note = normalize(note).map_err(invalid)?;
    let Some(mut storage) = storage_for(store, principal, now_ms).await? else {
        return Ok(false);
    };
    let mut space = storage.user();
    update(&mut space, |inbox| {
        let added = deliver(inbox, note.clone(), now_ms);
        (added, added)
    })
    .await
}

/// Take back the notification `id` of `app` from `principal`'s inbox, if it
/// is still there, at `now_ms` (a Guest User's inbox keeps its expiry). It
/// stays delivered: the same id is not shown again.
pub async fn withdraw_at<'s>(
    store: impl IntoStore<'s>,
    principal: &'s str,
    now_ms: u64,
    app: &str,
    id: &str,
) -> io::Result<()> {
    let Some(mut storage) = storage_for(store, principal, now_ms).await? else {
        return Ok(());
    };
    let mut space = storage.user();
    update(&mut space, |inbox| {
        let removed = remove(inbox, |item| item.note.app == app && item.note.id == id);
        ((), removed > 0)
    })
    .await
}

/// [`withdraw_at`] without the time: a Guest User's inbox is left as it is
/// (the notification stays until the guest clears it or the guest's data is
/// purged), because rewriting it without the time would drop its expiry.
/// Prefer [`withdraw_at`].
pub async fn withdraw<'s>(
    store: impl IntoStore<'s>,
    principal: &'s str,
    app: &str,
    id: &str,
) -> io::Result<()> {
    if principal.starts_with("g-") {
        return Ok(());
    }
    let mut storage = Storage::new(store, APP, principal);
    let mut space = storage.user();
    update(&mut space, |inbox| {
        let removed = remove(inbox, |item| item.note.app == app && item.note.id == id);
        ((), removed > 0)
    })
    .await
}

/// A browser's tag in the change counts: a short hash of its session id, so
/// a page can tell its own changes from those of the person's other
/// browsers, and the session id itself is never sent to them.
pub fn browser_tag(session_id: &str) -> String {
    let digest = hex(&sha256(
        format!("macalicious/browser-tag/{session_id}").as_bytes(),
    ));
    digest[..16].to_string()
}

fn changes_key(principal: &str) -> String {
    format!("{CHANGES}{principal}")
}

fn decode_changes(bytes: Option<&[u8]>) -> BTreeMap<String, Change> {
    // Counts that cannot be read start again: they only make pages reload.
    bytes
        .and_then(|bytes| serde_json::from_slice(bytes).ok())
        .unwrap_or_default()
}

/// Record that the browser of `session_id` changed a document of module
/// `app` for `principal` (the router calls it after every write that
/// succeeded). Returns the number the change was given, or `None` when it
/// was not counted (a Guest User whose time has ended).
pub async fn touched<'s>(
    store: impl IntoStore<'s>,
    principal: &str,
    app: &str,
    session_id: &str,
    now_ms: u64,
) -> io::Result<Option<u64>> {
    let mut store = store.into_store();
    let key = changes_key(principal);
    let by = browser_tag(session_id);
    // A Guest User's counts go when the guest's time ends.
    let mut expires_ms = now_ms + CHANGES_TTL_MS;
    if principal.starts_with("g-") {
        let Some(ends) = guest_ends_ms(&mut store, principal, now_ms).await? else {
            return Ok(None);
        };
        expires_ms = expires_ms.min(ends);
    }
    for _ in 0..CAS_ATTEMPTS {
        let stored = store.get_versioned(key.as_bytes()).await?;
        let version = stored.as_ref().map(|(_, version)| *version);
        let mut changes = decode_changes(stored.as_ref().map(|(bytes, _)| bytes.as_slice()));
        let (n, since) = changes
            .get(app)
            .map_or((1, now_ms), |change| (change.n + 1, change.since));
        changes.insert(
            app.to_string(),
            Change {
                n,
                by: by.clone(),
                since,
            },
        );
        let bytes = serde_json::to_vec(&changes).map_err(data_error)?;
        let written = store
            .put_if_version_expiring(key.as_bytes(), &bytes, version, expires_ms)
            .await?;
        if written.is_ok() {
            return Ok(Some(n));
        }
    }
    Err(io::Error::other("the change counts kept changing"))
}

/// What the personal stream sends `principal`: `{"items", "dnd",
/// "changes"}`, and a version that changes whenever either document does: a
/// hash of both documents' presence and store versions. It only tells a
/// change apart; it is not ordered.
pub async fn personal_state(
    store: &mut StoreClusterClient,
    principal: &str,
) -> io::Result<(u64, serde_json::Value)> {
    let changes = store
        .get_versioned(changes_key(principal).as_bytes())
        .await?;
    let mut storage = Storage::new(store, APP, principal);
    let stored = storage.user().get_versioned(INBOX).await?;
    let identity = format!(
        "{:?}/{:?}",
        stored.as_ref().map(|(_, v)| *v),
        changes.as_ref().map(|(_, v)| *v)
    );
    let digest = sha256(identity.as_bytes());
    let mut first = [0u8; 8];
    first.copy_from_slice(&digest[..8]);
    let version = u64::from_be_bytes(first);
    let mut view = match decode_inbox(stored.as_ref().map(|(bytes, _)| bytes.as_slice())) {
        Ok(inbox) => inbox_view(&inbox),
        Err(_) => serde_json::json!({ "items": [], "dnd": false, "unreadable": true }),
    };
    view["changes"] = serde_json::to_value(decode_changes(
        changes.as_ref().map(|(bytes, _)| bytes.as_slice()),
    ))
    .map_err(data_error)?;
    Ok((version, view))
}

fn ticket_key(ticket: &str) -> String {
    format!("{TICKETS}{}", hex(&sha256(ticket.as_bytes())))
}

/// A ticket for `session`'s personal stream: `{"ticket", "expires_ms",
/// "tag"}`, `tag` being this browser's [`browser_tag`]. The router answers
/// `POST /api/session/ticket` with it.
pub async fn issue_ticket(
    store: &mut StoreClusterClient,
    session: &Session,
    now_ms: u64,
) -> io::Result<serde_json::Value> {
    let ticket = crate::crypto::random::random_token(32)?;
    let expires_ms = now_ms + TICKET_TTL_MS;
    let record = Ticket {
        principal: session.principal.clone(),
        session: session.id.clone(),
        expires_ms,
        used: false,
        claimed_by: None,
    };
    let bytes = serde_json::to_vec(&record).map_err(data_error)?;
    let created = store
        .put_if_version_expiring(ticket_key(&ticket).as_bytes(), &bytes, None, expires_ms)
        .await?;
    if created.is_err() {
        return Err(io::Error::other("a new ticket already existed"));
    }
    Ok(serde_json::json!({
        "ticket": ticket,
        "expires_ms": expires_ms,
        "tag": browser_tag(&session.id),
    }))
}

fn well_formed_ticket(ticket: &str) -> bool {
    ticket.len() == 64
        && ticket
            .bytes()
            .all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
}

/// Redeem a ticket for the stream open `claimant` (its correlation id), once:
/// `(principal, session id)` it was issued to, or `None` when it is
/// malformed, unknown, expired or spent by another open. The same open,
/// redelivered because a later step failed before it was answered, redeems it
/// again, so a transient failure does not turn into a refusal.
pub async fn redeem_ticket(
    store: &mut StoreClusterClient,
    ticket: &str,
    claimant: &str,
    now_ms: u64,
) -> io::Result<Option<(String, String)>> {
    if !well_formed_ticket(ticket) {
        return Ok(None);
    }
    let key = ticket_key(ticket);
    let Some((bytes, version)) = store.get_versioned(key.as_bytes()).await? else {
        return Ok(None);
    };
    let Ok(mut record) = serde_json::from_slice::<Ticket>(&bytes) else {
        return Ok(None);
    };
    match claim(&record, claimant, now_ms) {
        Claim::Refused => return Ok(None),
        Claim::Again => return Ok(Some((record.principal, record.session))),
        Claim::New => {}
    }
    record.used = true;
    record.claimed_by = Some(claimant.to_string());
    let used = serde_json::to_vec(&record).map_err(data_error)?;
    // Claimed by compare-and-set: of two opens with one ticket, one wins.
    let claimed = store
        .put_if_version_expiring(key.as_bytes(), &used, Some(version), record.expires_ms)
        .await?;
    Ok(claimed
        .is_ok()
        .then_some((record.principal, record.session)))
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Dnd {
    on: bool,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Raised {
    app: String,
    title: String,
    #[serde(default)]
    subtitle: Option<String>,
    #[serde(default)]
    body: Option<String>,
}

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    let (method, path) = (cx.request.method, cx.request.path);
    let outcome = match (method, path) {
        ("GET", "/inbox") => {
            let stored = cx.storage.user().get(INBOX).await;
            stored.and_then(|bytes| {
                decode_inbox(bytes.as_deref()).map(|inbox| Response::json(200, &inbox_view(&inbox)))
            })
        }
        ("DELETE", "/inbox") => {
            let app = cx.request.query_param("app").map(str::to_string);
            clear(&mut cx, |item| {
                app.as_deref().is_none_or(|app| item.note.app == app)
            })
            .await
        }
        ("DELETE", _) if path.starts_with("/inbox/") => {
            match path["/inbox/".len()..].parse::<u64>() {
                Ok(seq) => clear(&mut cx, |item| item.seq == seq).await,
                Err(_) => Ok(Response::error(
                    400,
                    "a notification is named by its number",
                )),
            }
        }
        (_, "/inbox") => Ok(Response::method_not_allowed()),
        ("PUT", "/dnd") => match cx.request.json::<Dnd>() {
            Err(response) => Ok(response),
            Ok(Dnd { on }) => update(&mut cx.storage.user(), |inbox| {
                let changed = inbox.dnd != on;
                inbox.dnd = on;
                ((), changed)
            })
            .await
            .map(|()| Response::json(200, &serde_json::json!({ "dnd": on }))),
        },
        (_, "/dnd") => Ok(Response::method_not_allowed()),
        ("POST", "/notify") => raise(&mut cx).await,
        (_, "/notify") => Ok(Response::method_not_allowed()),
        _ => Ok(Response::not_found()),
    };
    outcome.unwrap_or_else(|error| Response::error(503, &format!("storage failed: {error}")))
}

async fn clear(cx: &mut ApiCtx<'_>, drop: impl Fn(&Item) -> bool) -> io::Result<Response> {
    let removed = update(&mut cx.storage.user(), |inbox| {
        let removed = remove(inbox, &drop);
        (removed, removed > 0)
    })
    .await?;
    Ok(Response::json(
        200,
        &serde_json::json!({ "removed": removed }),
    ))
}

/// `POST /notify`: a notification a page raises for its own person.
async fn raise(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let raised: Raised = match cx.request.json() {
        Ok(raised) => raised,
        Err(response) => return Ok(response),
    };
    // A resend with the browser's own key is the same notification; without
    // one each request is a new one.
    let id = match cx.request.idempotency_key {
        Some(key) => format!("page-{key}"),
        None => format!("page-{}", crate::crypto::random::random_token(8)?),
    };
    let note = Notification {
        app: raised.app,
        id,
        title: raised.title,
        subtitle: raised.subtitle,
        body: raised.body,
        ..Notification::default()
    };
    let note = match normalize(&note) {
        Ok(note) => note,
        Err(message) => return Ok(Response::error(400, &message)),
    };
    let now_ms = cx.now_ms;
    let delivered = update(&mut cx.storage.user(), |inbox| {
        let added = deliver(inbox, note.clone(), now_ms);
        (added, added)
    })
    .await?;
    Ok(Response::json(
        201,
        &serde_json::json!({ "delivered": delivered }),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn note(app: &str, id: &str) -> Notification {
        Notification {
            app: app.into(),
            id: id.into(),
            title: format!("{app} {id}"),
            ..Notification::default()
        }
    }

    #[test]
    fn a_notification_is_delivered_once_even_after_it_was_cleared() {
        let mut inbox = Inbox::default();
        assert!(deliver(&mut inbox, note("calendar", "e1"), 10));
        assert!(!deliver(&mut inbox, note("calendar", "e1"), 11), "a retry");
        assert!(
            deliver(&mut inbox, note("reminders", "e1"), 12),
            "another app's id"
        );
        assert_eq!(remove(&mut inbox, |item| item.note.app == "calendar"), 1);
        assert!(
            !deliver(&mut inbox, note("calendar", "e1"), 13),
            "cleared stays cleared"
        );
        assert_eq!(
            inbox.items.iter().map(|i| i.seq).collect::<Vec<_>>(),
            [2],
            "numbers are never reused"
        );
    }

    #[test]
    fn the_inbox_and_its_memory_are_bounded() {
        let mut inbox = Inbox::default();
        for n in 0..SEEN_LIMIT + 5 {
            deliver(&mut inbox, note("messages", &n.to_string()), n as u64);
        }
        assert_eq!(inbox.items.len(), INBOX_LIMIT);
        assert_eq!(inbox.seen.len(), SEEN_LIMIT);
        assert_eq!(inbox.items.last().unwrap().seq, (SEEN_LIMIT + 5) as u64);
        let view = inbox_view(&inbox);
        assert_eq!(
            view["items"][0]["seq"],
            (SEEN_LIMIT + 5) as u64,
            "newest first"
        );
        assert_eq!(
            view["items"][0]["app"], "messages",
            "flattened for the page"
        );
    }

    #[test]
    fn normalize_cuts_long_texts_and_refuses_what_cannot_be_shown() {
        let long = Notification {
            title: "t".repeat(500),
            body: Some("b".repeat(5_000)),
            subtitle: Some("   ".into()),
            ..note("reminders", "r1@5")
        };
        let kept = normalize(&long).unwrap();
        assert_eq!(kept.title.chars().count(), MAX_TITLE_CHARS);
        assert!(kept.title.ends_with('\u{2026}'));
        assert_eq!(kept.body.unwrap().chars().count(), MAX_BODY_CHARS);
        assert_eq!(kept.subtitle, None, "a blank subtitle is dropped");

        let ok_action = Action {
            label: "Snooze".into(),
            post: Some("/alerts/r1@5/snooze".into()),
        };
        let with = |f: fn(&mut Notification)| {
            let mut n = Notification {
                actions: vec![ok_action.clone()],
                dismiss: Some("/alerts/r1@5/dismiss".into()),
                alert: true,
                ..note("reminders", "r1@5")
            };
            f(&mut n);
            normalize(&n)
        };
        assert!(with(|_| {}).is_ok());
        for bad in [
            with(|n| n.app = "Bad App".into()),
            with(|n| n.id = String::new()),
            with(|n| n.id = "a\nb".into()),
            with(|n| n.title = "  ".into()),
            with(|n| n.dismiss = Some("/../session/sign-out".into())),
            with(|n| n.dismiss = Some("https://evil.example/".into())),
            with(|n| n.dismiss = Some("/%2e%2e/session/sign-out".into())),
            with(|n| n.actions[0].post = Some("/a%2Fb".into())),
            with(|n| n.actions[0].post = Some("alerts".into())),
            with(|n| n.actions[0].label = " ".into()),
            with(|n| n.actions = vec![n.actions[0].clone(); 3]),
        ] {
            assert!(bad.is_err(), "{bad:?}");
        }
    }

    #[test]
    fn a_browser_tag_is_short_stable_and_not_the_session_id() {
        let id = "ab".repeat(32);
        let tag = browser_tag(&id);
        assert_eq!(tag.len(), 16);
        assert_eq!(tag, browser_tag(&id));
        assert_ne!(tag, browser_tag(&"cd".repeat(32)));
        assert!(!id.contains(&tag));
    }

    #[test]
    fn a_spent_ticket_opens_again_only_for_the_open_that_spent_it() {
        let mut record = Ticket {
            principal: "p".into(),
            session: "s".into(),
            expires_ms: 1_000,
            used: false,
            claimed_by: None,
        };
        assert_eq!(claim(&record, "open-1", 10), Claim::New);
        record.used = true;
        record.claimed_by = Some("open-1".into());
        // The same open, redelivered after a failed first frame.
        assert_eq!(claim(&record, "open-1", 20), Claim::Again);
        // Any other open, and every open once it has expired.
        assert_eq!(claim(&record, "open-2", 20), Claim::Refused);
        assert_eq!(claim(&record, "open-1", 1_000), Claim::Refused);
        // A record spent before claims were recorded opens nothing again.
        record.claimed_by = None;
        assert_eq!(claim(&record, "open-1", 20), Claim::Refused);
    }

    #[test]
    fn an_inbox_of_the_longest_notifications_is_stored_within_its_byte_budget() {
        let mut inbox = Inbox::default();
        // Wide characters (3 bytes each) at every field's longest.
        let long = |n: usize| "€".repeat(n);
        for n in 0..INBOX_LIMIT {
            let note = Notification {
                app: "calendar".into(),
                id: format!("{n}{}", long(MAX_ID_CHARS - 4)),
                title: long(MAX_TITLE_CHARS),
                subtitle: Some(long(MAX_TITLE_CHARS)),
                body: Some(long(MAX_BODY_CHARS)),
                ..Notification::default()
            };
            assert!(deliver(&mut inbox, note, n as u64));
        }
        assert!(serde_json::to_vec(&inbox).unwrap().len() > INBOX_MAX_BYTES);
        let newest = inbox.items.last().unwrap().seq;
        let bytes = encode_within_budget(&mut inbox).unwrap();
        assert!(bytes.len() <= INBOX_MAX_BYTES, "{} bytes", bytes.len());
        // The oldest went; the newest stays.
        assert!(!inbox.items.is_empty() && inbox.items.len() < INBOX_LIMIT);
        assert_eq!(inbox.items.last().unwrap().seq, newest);
        assert_eq!(decode_inbox(Some(&bytes)).unwrap(), inbox);
    }

    #[test]
    fn a_full_memory_of_the_longest_ids_never_costs_the_newest_notification() {
        let mut inbox = Inbox::default();
        let long = |n: usize| "€".repeat(n);
        // Five hundred deliveries with ids at their longest, all cleared but the last few.
        for n in 0..SEEN_LIMIT {
            let note = Notification {
                app: long(MAX_APP_CHARS),
                id: format!("{n}{}", long(MAX_ID_CHARS - 4)),
                title: "t".into(),
                ..Notification::default()
            };
            assert!(deliver(&mut inbox, note, n as u64));
        }
        inbox.items.drain(..inbox.items.len() - 3);
        assert_eq!(inbox.seen.len(), SEEN_LIMIT);
        assert!(serde_json::to_vec(&inbox).unwrap().len() > INBOX_MAX_BYTES);
        let kept: Vec<u64> = inbox.items.iter().map(|item| item.seq).collect();
        let bytes = encode_within_budget(&mut inbox).unwrap();
        assert!(bytes.len() <= INBOX_MAX_BYTES, "{} bytes", bytes.len());
        // Only remembered ids went: every notification, the newest included, stays.
        assert_eq!(
            inbox.items.iter().map(|item| item.seq).collect::<Vec<_>>(),
            kept
        );
        assert!(inbox.seen.len() < SEEN_LIMIT && inbox.seen.len() >= inbox.items.len());
    }

    #[test]
    fn only_a_well_formed_ticket_is_looked_up() {
        assert!(well_formed_ticket(&"0a".repeat(32)));
        for bad in ["", "0A".repeat(32).as_str(), &"0a".repeat(31), "../x"] {
            assert!(!well_formed_ticket(bad), "{bad:?}");
        }
    }
}

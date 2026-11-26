//! Reminders' server half: a session's lists and reminders, and the alerts of
//! reminders that fall due.
//!
//! The Reminders demo edits in the browser. When the desktop is served by this
//! application it saves its lists and reminders here, starts from them when
//! the window opens, and asks here which reminders have fallen due.
//!
//! * `GET /api/reminders/data`: `{"data": {"lists": [...], "reminders": [...]}, "rev": n}`,
//!   or `{"data": null, "rev": 0}` when the session never saved any (the demo then
//!   starts from the reminders of the reference screenshots).
//! * `PUT /api/reminders/data` with `{"base": n, "data": {...}, "alerts": {"<id>": <ms>}}`:
//!   replaces the lists and reminders (the shapes of `ReminderList` and
//!   `Reminder` in `demos/reminders/reminders-data.ts`) and answers `200` with
//!   `{"rev"}`, the new revision.
//!   `alerts` names, for each reminder that is due and not completed, the
//!   instant (epoch ms) its alert fires, and must name every such reminder
//!   and no other. The browser works it out, because
//!   only the browser knows its time zone: the reminder's due minute
//!   (`dueTime`) on its due day, or 9:00 on the due day for a reminder without
//!   one, local time. A
//!   body that does not hang together is refused with `400` and nothing
//!   changes. The server owns the revision (0 before the first save, one more
//!   with each), and `base` is the revision the writer last had: the write is
//!   stored only when `base` is still the stored revision. Any other base is
//!   refused with `409` and `{"rev"}` of the stored one, and nothing changes, so
//!   a write made from a stale copy never replaces what it did not see; the
//!   page then reads the stored reminders and merges its changes into them
//!   (`demos/desktop/synced-document.ts`).
//! * `GET /api/reminders/alerts`: `{"alerts": [{"id", "title", "at"}]}`, the
//!   reminders whose alert has fired and was not dismissed, earliest first.
//! * `POST /api/reminders/alerts/<id>/dismiss` with `{"at": <ms>}`: dismisses
//!   that alert; `{"dismissed": false}` when the reminder's alert has moved to
//!   another instant since (the newer one stays). Repeating it changes nothing.
//! * `PUT /api/reminders/alerts` with `{"alerts": {"<id>": {"at", "due",
//!   "dueTime"?, "timeZone"?}}}`: arms the alerts the stored reminders lack (a
//!   list taken back from sharing comes back without its alerts), each only for
//!   a reminder that is due and still to do, has no alert yet, and still says
//!   the day, minute and zone the browser worked the instant out from. An alert
//!   the document has is never moved, and the revision does not change:
//!   `{"armed": n}`.
//!
//! A reminder is `{id, listId, title}` and the optional `completed`,
//! `flagged`, `due` (`YYYY-MM-DD`), `dueTime` (`HH:MM`, only with `due`),
//! `timeZone` (the IANA zone `due` and `dueTime` are read in, only with `due`),
//! `repeat` (`daily`, `weekdays`, `weekly`, `biweekly`, `monthly`, `yearly` or
//! `custom`, only with `due`), `repeatRule` (`{every, unit, weekdays?}`, with
//! `custom` alone), `repeatEnd` (`YYYY-MM-DD`, the last day it may repeat to,
//! only with `repeat`), `notes`, `priority`, `url`, `atLocation`,
//! `whenMessaging`, `images` and `createdAt` (epoch ms). Every field added after the first build is
//! optional, so a document saved before, and a writer that never names them
//! (Automator, Siri), still reads and writes. A reminder that repeats is
//! moved to its next due day by the browser when it is completed; here it is
//! a reminder like any other, alerting at the instant the browser names.
//!
//! ## Who decides that a reminder is due
//!
//! Ferrite's clock, not this process's. Arming an alert writes a timer key
//! that expires at the alert's instant (`timers/<id>/<at>`, through the
//! store's create-if-absent with an expiry). The store judges expiry by the
//! platform clock, so the alert fires when that key is gone. Under
//! `ferrite dev --clock-ms <instant>` the clock is virtual, and
//! `POST /__forge/clock {"advance_ms": …}` makes reminders fall due without
//! waiting. A process's own `now_ms` keeps the wall clock there, so it is not
//! used for this.
//!
//! ## Alerts with no Reminders window open
//!
//! The desktop's personal stream (`src/live.rs`) calls [`raise_due_alerts`]
//! every few seconds, and a fired alert reaches the person through Notification
//! Center, one notification per alert instant.
//!
//! * `POST /alerts/shown` with `{"alerts": [{"id", "at"}]}`: the window shows
//!   these itself. Their notifications are taken back, or kept from ever being
//!   raised. `{"told": n}`.
//! * `POST /alerts/<id>/<at>/close`: as `dismiss`. `POST
//!   /alerts/<id>/<at>/complete`: completes the reminder, by compare-and-set on
//!   the document. `{"changed": bool}`. A reminder that repeats has no such
//!   button: only the browser works out its next due day, so its notification
//!   opens Reminders.
//!
//! Storage, in the session's own space:
//!
//! * `data`: `{rev, data, alerts, writes?, writes_from?}`, the recent write ids
//!   as `document.rs` keeps them, and the lists and reminders, the instant each
//!   due reminder alerts, and the revision that wrote them, in one value
//!   written by compare-and-set;
//! * `timers/<id>/<at>`: present until the alert's instant; created before
//!   the document that names it, never deleted (it expires by itself);
//! * `dismissed/<id>/<at>`: the alert of that instant was dismissed, written
//!   without rewriting the document. A moved alert has a new instant, so it
//!   shows again.
//!
//! A write is stored only on the revision it was based on, and the alerts
//! always belong to the document they were written with.
//!
//! Lists shared between accounts are documents of their own in the module's
//! shared space, read and written through `/api/reminders/shared`
//! (`shared.rs`).

use std::collections::{BTreeMap, BTreeSet};
use std::io;

use ferrite_app::client::StoreClusterClient;
use ferrite_app::serde;
use ferrite_app::serde_json;

use crate::apps::document;
use crate::apps::notification_center::{self, Action, Notification};
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture, Space, Storage};

mod shared;

pub const MODULE: AppModule = AppModule {
    name: "reminders",
    title: "Reminders",
    handle,
};

pub const MAX_LISTS: usize = 100;
pub const MAX_REMINDERS: usize = 2_000;
pub const MAX_NAME_CHARS: usize = 100;
pub const MAX_TITLE_CHARS: usize = 1_000;
pub const MAX_NOTES_CHARS: usize = 10_000;
pub const MAX_URL_CHARS: usize = 2_048;
pub const MAX_IMAGES: u32 = 50;
/// The latest instant an alert may name: the year 275760, JavaScript's limit.
const MAX_INSTANT_MS: u64 = 8_640_000_000_000_000;
/// The ids of the four smart lists, which a list may not take.
const SMART_LISTS: [&str; 4] = ["today", "scheduled", "all", "flagged"];
const DATA_KEY: &str = "data";
const APP: &str = "reminders";
/// The most alerts one pass raises, and one `POST /alerts/shown` names.
const MAX_AT_ONCE: usize = 20;

#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum Color {
    Red,
    Orange,
    Yellow,
    Green,
    Blue,
    Purple,
    Brown,
    Gray,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum Priority {
    None,
    Low,
    Medium,
    High,
}

/// How a reminder repeats once it is completed: the info popover's "repeat".
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum Repeat {
    Daily,
    Weekdays,
    Weekly,
    Biweekly,
    Monthly,
    Yearly,
    Custom,
}

/// The unit of a custom repeat.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum RepeatUnit {
    Day,
    Week,
    Month,
    Year,
}

/// How a reminder that repeats `custom` does.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct RepeatRule {
    /// How many units from one occurrence to the next: 1 to 999.
    pub every: u16,
    pub unit: RepeatUnit,
    /// For weeks: the days it falls on, 0 for Sunday to 6, each once.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub weekdays: Option<Vec<u8>>,
}

impl RepeatRule {
    fn is_valid(&self) -> bool {
        (1..=999).contains(&self.every)
            && self.weekdays.as_ref().is_none_or(|days| {
                self.unit == RepeatUnit::Week
                    && !days.is_empty()
                    && days.iter().all(|day| *day <= 6)
                    && days.iter().collect::<BTreeSet<_>>().len() == days.len()
            })
    }
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct List {
    pub id: String,
    pub name: String,
    pub color: Color,
    /// The group of lists it is in, if any. A shared list is in none.
    #[serde(default, rename = "groupId", skip_serializing_if = "Option::is_none")]
    pub group_id: Option<String>,
}

/// A group of lists in the sidebar. It holds nothing but its name: a list
/// names the group it is in.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Group {
    pub id: String,
    pub name: String,
    /// While it holds no list: the list it stands before. A list gone from
    /// under it leaves it last, so this is not checked against the lists.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub before: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(
    crate = "ferrite_app::serde",
    rename_all = "camelCase",
    deny_unknown_fields
)]
pub struct Reminder {
    pub id: String,
    pub list_id: String,
    pub title: String,
    /// The reminder this one is a sub-reminder of: in the same list, and not
    /// a sub-reminder itself.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub completed: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub flagged: Option<bool>,
    /// The due day, `YYYY-MM-DD`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub due: Option<String>,
    /// The due minute on that day, `HH:MM` on the clocks of `time_zone`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub due_time: Option<String>,
    /// The time zone `due` and `due_time` are read in, by its IANA name: the
    /// zone of the browser that set them, so that every browser of the person
    /// names the same alert instant. Absent in documents written before it,
    /// and by writers that do not name it. Only with `due`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub time_zone: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repeat: Option<Repeat>,
    /// The rule of a reminder that repeats `custom`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repeat_rule: Option<RepeatRule>,
    /// The last day it may repeat to, `YYYY-MM-DD`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repeat_end: Option<String>,
    /// An early reminder: how many minutes before its due minute the alert fires. The page works
    /// the instant out; this keeps the choice.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub early_minutes: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub priority: Option<Priority>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub at_location: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub when_messaging: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub images: Option<u32>,
    /// When it was made, in epoch milliseconds, as the page says.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<u64>,
}

impl Reminder {
    /// Whether the reminder can have an alert: it is due and still to do.
    fn alertable(&self) -> bool {
        self.due.is_some() && self.completed != Some(true)
    }
}

/// What a session stores.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq, Default)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Data {
    pub lists: Vec<List>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub groups: Vec<Group>,
    pub reminders: Vec<Reminder>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Put {
    /// The revision the writer last had; the write is stored only on it.
    base: u64,
    data: Data,
    alerts: BTreeMap<String, u64>,
}

/// What the session's `data` key holds: the document, its alerts and the
/// revision that wrote them, all written at once.
#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Stored {
    rev: u64,
    data: Data,
    alerts: BTreeMap<String, u64>,
    /// The writes that named themselves (`document.rs`).
    #[serde(default)]
    writes: Vec<String>,
    #[serde(default)]
    writes_from: Option<u64>,
}

/// How many times a write tries its compare-and-set while others get in.
const CAS_ATTEMPTS: usize = 8;

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Dismiss {
    at: u64,
}

/// A fired alert, as `GET /alerts` lists it.
#[derive(serde::Serialize, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Fired {
    pub id: String,
    pub title: String,
    pub at: u64,
}

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    let method = cx.request.method;
    let path = cx.request.path;
    let outcome = match (method, path) {
        ("GET", "/data") => {
            let mut user = cx.storage.user();
            let stored = user.get_json::<Stored>(DATA_KEY).await;
            stored.map(|stored| {
                match &stored {
                    Some(s) => user
                        .write_ids()
                        .heard(&s.writes, s.writes_from.unwrap_or(s.rev)),
                    None => user.write_ids().heard(&[], 0),
                }
                let rev = stored.as_ref().map_or(0, |s| s.rev);
                let data = stored.map(|s| s.data);
                Response::json(200, &serde_json::json!({ "data": data, "rev": rev }))
            })
        }
        ("PUT", "/data") => put(&mut cx).await,
        (_, "/data") => Ok(Response::method_not_allowed()),
        ("GET", "/alerts") => fired(&mut cx.storage.user())
            .await
            .map(|alerts| Response::json(200, &serde_json::json!({ "alerts": alerts }))),
        ("PUT", "/alerts") => arm(&mut cx).await,
        (_, "/alerts") => Ok(Response::method_not_allowed()),
        ("POST", "/alerts/shown") => shown(&mut cx).await,
        ("GET", "/shared") => shared::lists(&mut cx).await,
        ("POST", "/shared") => shared::share(&mut cx).await,
        (_, "/shared") => Ok(Response::method_not_allowed()),
        _ if path.starts_with("/shared/") => {
            shared_route(&mut cx, method, &path["/shared/".len()..]).await
        }
        _ => {
            let rest = path.strip_prefix("/alerts/").unwrap_or_default();
            match rest.split('/').collect::<Vec<_>>()[..] {
                [id, "dismiss"] if is_id(id) => match method {
                    "POST" => dismiss(&mut cx, id).await,
                    _ => Ok(Response::method_not_allowed()),
                },
                [id, at, action @ ("close" | "complete")] if is_id(id) => {
                    match (method, at.parse::<u64>()) {
                        ("POST", Ok(at)) if action == "close" => close(&mut cx, id, at).await,
                        ("POST", Ok(at)) => complete(&mut cx, id, at).await,
                        ("POST", Err(_)) => Ok(Response::not_found()),
                        _ => Ok(Response::method_not_allowed()),
                    }
                }
                _ => Ok(Response::not_found()),
            }
        }
    };
    outcome.unwrap_or_else(|error| Response::error(503, &format!("storage failed: {error}")))
}

/// The routes of one shared list (`shared.rs`): `<id>`, `<id>/people[/<name>]`,
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

async fn put(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let put = match cx.request.json::<Put>() {
        Ok(put) => put,
        Err(response) => return Ok(response),
    };
    if let Err(message) = validate(&put.data).and_then(|()| validate_alerts(&put.data, &put.alerts))
    {
        return Ok(Response::error(400, &message));
    }
    let Some(rev) = put.base.checked_add(1) else {
        return Ok(Response::error(400, "base is past the last revision"));
    };
    let mut user = cx.storage.user();
    // The timers first, so that no stored alert lacks its timer (which would
    // read as fired). A timer is only ever created; it removes itself at its
    // instant, and one a later write no longer names is never read.
    for (id, &at) in &put.alerts {
        user.create_expiring(&timer_key(id, at), b"due", at).await?;
    }
    let body = serde_json::json!({ "rev": rev, "data": put.data, "alerts": put.alerts });
    Ok(match put_revised(&mut user, put.base, &body).await? {
        Ok(()) => Response::json(200, &serde_json::json!({ "rev": rev })),
        Err(stored) => Response::json(
            409,
            &serde_json::json!({ "error": "the reminders have changed since that revision", "rev": stored }),
        ),
    })
}

/// Write `body` if the stored revision is still `base` (`Ok(Err(stored))`
/// otherwise): a compare-and-set, tried again while other writers get in
/// between. So a write made from a stale copy never replaces a newer one.
async fn put_revised(
    user: &mut Space<'_>,
    base: u64,
    body: &serde_json::Value,
) -> io::Result<Result<(), u64>> {
    for _ in 0..CAS_ATTEMPTS {
        let current = user.get_versioned(DATA_KEY).await?;
        // Only an absent document is revision 0: one that cannot be read is never overwritten.
        let (stored, writes, from) = match &current {
            None => (0, Vec::new(), None),
            Some((value, _)) => {
                // The whole stored value is read: a revision beside a document that cannot be
                // read does not make the document replaceable.
                let stored = serde_json::from_slice::<Stored>(value).map_err(|e| {
                    io::Error::new(
                        io::ErrorKind::InvalidData,
                        format!("the stored reminders are unreadable: {e}"),
                    )
                })?;
                (stored.rev, stored.writes, stored.writes_from)
            }
        };
        if stored != base {
            return Ok(Err(stored));
        }
        let (writes, from) = document::with_write(writes, from, stored, user.write_ids().this());
        let mut next = body.clone();
        document::stamp_writes(&mut next, &writes, from);
        let bytes = serde_json::to_vec(&next)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;
        let expected = current.map(|(_, version)| version);
        if user.put_if_version(DATA_KEY, &bytes, expected).await? {
            return Ok(Ok(()));
        }
    }
    Err(io::Error::other(
        "the document kept changing under this write",
    ))
}

fn timer_key(id: &str, at: u64) -> String {
    format!("timers/{id}/{at}")
}

fn dismissed_key(id: &str, at: u64) -> String {
    format!("dismissed/{id}/{at}")
}

/// The alerts that have fired and were not dismissed, earliest first.
async fn fired(user: &mut Space<'_>) -> io::Result<Vec<Fired>> {
    let Some(stored) = user.get_json::<Stored>(DATA_KEY).await? else {
        return Ok(Vec::new());
    };
    let mut out = Vec::new();
    for (id, at) in stored.alerts {
        let Some(reminder) = stored
            .data
            .reminders
            .iter()
            .find(|r| r.id == id && r.alertable())
        else {
            continue;
        };
        // The platform's clock has passed the instant once the timer is gone.
        if user.get(&timer_key(&id, at)).await?.is_none()
            && user.get(&dismissed_key(&id, at)).await?.is_none()
        {
            out.push(Fired {
                id,
                title: reminder.title.clone(),
                at,
            });
        }
    }
    out.sort_by(|a, b| a.at.cmp(&b.at).then_with(|| a.id.cmp(&b.id)));
    Ok(out)
}

async fn dismiss(cx: &mut ApiCtx<'_>, id: &str) -> io::Result<Response> {
    let body = match cx.request.json::<Dismiss>() {
        Ok(body) => body,
        Err(response) => return Ok(response),
    };
    let armed = mark_dismissed(cx, id, body.at).await?;
    Ok(Response::json(
        200,
        &serde_json::json!({ "dismissed": armed }),
    ))
}

/// Mark the alert of that instant dismissed, when it is still the reminder's.
async fn mark_dismissed(cx: &mut ApiCtx<'_>, id: &str, at: u64) -> io::Result<bool> {
    let mut user = cx.storage.user();
    let armed = user
        .get_json::<Stored>(DATA_KEY)
        .await?
        .is_some_and(|stored| stored.alerts.get(id) == Some(&at));
    if armed {
        // Only this instant is marked: the document is not rewritten.
        user.put(&dismissed_key(id, at), b"1").await?;
    }
    Ok(armed)
}

/// The notification of a fired alert: what Reminders' alert says, under the
/// reminder's title, and its notes as the message.
fn note(reminder: &Reminder, at: u64) -> Notification {
    let path = |action: &str| format!("/alerts/{}/{at}/{action}", reminder.id);
    Notification {
        app: APP.into(),
        id: format!("alert:{}@{at}", reminder.id),
        title: if reminder.title.is_empty() {
            "New Reminder".into()
        } else {
            reminder.title.clone()
        },
        subtitle: None,
        body: reminder.notes.clone(),
        alert: true,
        dismiss: Some(path("close")),
        actions: vec![if reminder.repeat.is_some() {
            Action {
                label: "Show".into(),
                post: None,
            }
        } else {
            Action {
                label: "Complete".into(),
                post: Some(path("complete")),
            }
        }],
    }
}

/// Raise what has fired of `principal`'s reminders. Called again and again, by
/// every browser the person has open: nothing is raised twice.
pub async fn raise_due_alerts(
    store: &mut StoreClusterClient,
    principal: &str,
    now_ms: u64,
) -> io::Result<()> {
    let mut storage = Storage::new(store, APP, principal);
    let mut user = storage.user();
    let fired = fired(&mut user).await?;
    if fired.is_empty() {
        return Ok(());
    }
    let Some(stored) = user.get_json::<Stored>(DATA_KEY).await? else {
        return Ok(());
    };
    let raising = fired.iter().take(MAX_AT_ONCE).filter_map(|alert| {
        let reminder = stored.data.reminders.iter().find(|r| r.id == alert.id)?;
        Some(note(reminder, alert.at))
    });
    for note in raising {
        notification_center::notify(storage.store(), principal, now_ms, &note).await?;
    }
    Ok(())
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct ShownBody {
    alerts: Vec<ShownAlert>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct ShownAlert {
    id: String,
    at: u64,
}

/// `POST /alerts/shown`. Delivered and taken back at once: a notification
/// taken back stays delivered, so a later pass does not raise it.
async fn shown(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let body: ShownBody = match cx.request.json() {
        Ok(body) => body,
        Err(response) => return Ok(response),
    };
    if body.alerts.len() > MAX_AT_ONCE {
        return Ok(Response::error(
            400,
            &format!("at most {MAX_AT_ONCE} alerts"),
        ));
    }
    let (now_ms, principal) = (cx.now_ms, cx.session.principal.clone());
    let Some(stored) = cx.storage.user().get_json::<Stored>(DATA_KEY).await? else {
        return Ok(Response::json(200, &serde_json::json!({ "told": 0 })));
    };
    let mut told = 0;
    for alert in body.alerts {
        let Some(reminder) = stored.data.reminders.iter().find(|r| r.id == alert.id) else {
            continue;
        };
        let note = note(reminder, alert.at);
        notification_center::notify(cx.storage.store(), &principal, now_ms, &note).await?;
        notification_center::withdraw_at(cx.storage.store(), &principal, now_ms, APP, &note.id)
            .await?;
        told += 1;
    }
    Ok(Response::json(200, &serde_json::json!({ "told": told })))
}

/// `POST /alerts/<id>/<at>/close`, Close on the notification.
async fn close(cx: &mut ApiCtx<'_>, id: &str, at: u64) -> io::Result<Response> {
    let changed = mark_dismissed(cx, id, at).await?;
    Ok(Response::json(
        200,
        &serde_json::json!({ "changed": changed }),
    ))
}

/// Complete the reminder whose alert of `at` this is; false for one that has
/// been completed or moved since, or that repeats.
fn complete_stored(stored: &mut Stored, id: &str, at: u64) -> bool {
    if stored.alerts.get(id) != Some(&at) {
        return false;
    }
    let Some(reminder) = stored
        .data
        .reminders
        .iter_mut()
        .find(|r| r.id == id && r.alertable() && r.repeat.is_none())
    else {
        return false;
    };
    reminder.completed = Some(true);
    stored.alerts.remove(id);
    true
}

/// `POST /alerts/<id>/<at>/complete`, by compare-and-set on the document, so a
/// window's save that comes between is kept. Done again, it changes nothing.
async fn complete(cx: &mut ApiCtx<'_>, id: &str, at: u64) -> io::Result<Response> {
    let mut user = cx.storage.user();
    for _ in 0..CAS_ATTEMPTS {
        let Some(mut stored) = user.get_json::<Stored>(DATA_KEY).await? else {
            break;
        };
        if !complete_stored(&mut stored, id, at) {
            break;
        }
        let body = serde_json::json!({
            "rev": stored.rev + 1,
            "data": stored.data,
            "alerts": stored.alerts,
        });
        if put_revised(&mut user, stored.rev, &body).await?.is_ok() {
            return Ok(Response::json(200, &serde_json::json!({ "changed": true })));
        }
    }
    Ok(Response::json(
        200,
        &serde_json::json!({ "changed": false }),
    ))
}

/// One alert `PUT /alerts` asks to arm: its instant, and the day, minute and
/// zone of the reminder the browser worked it out from.
#[derive(serde::Deserialize)]
#[serde(
    crate = "ferrite_app::serde",
    rename_all = "camelCase",
    deny_unknown_fields
)]
struct ArmOne {
    at: u64,
    due: String,
    #[serde(default)]
    due_time: Option<String>,
    #[serde(default)]
    time_zone: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Arm {
    alerts: BTreeMap<String, ArmOne>,
}

/// The alerts of `asked` that `stored` lacks and may take: each for a reminder
/// that is due and still to do, has no alert yet, and still says the day,
/// minute and zone its instant was worked out from.
fn missing_alerts(stored: &Stored, asked: &BTreeMap<String, ArmOne>) -> BTreeMap<String, u64> {
    asked
        .iter()
        .filter(|(id, one)| {
            !stored.alerts.contains_key(*id)
                && one.at > 0
                && one.at <= MAX_INSTANT_MS
                && stored.data.reminders.iter().any(|reminder| {
                    &reminder.id == *id
                        && reminder.alertable()
                        && reminder.due.as_deref() == Some(one.due.as_str())
                        && reminder.due_time == one.due_time
                        && reminder.time_zone == one.time_zone
                })
        })
        .map(|(id, one)| (id.clone(), one.at))
        .collect()
}

/// `PUT /alerts`: arm the alerts the stored reminders lack, without moving
/// one they have or changing the revision.
async fn arm(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let body = match cx.request.json::<Arm>() {
        Ok(body) => body,
        Err(response) => return Ok(response),
    };
    if body.alerts.len() > MAX_REMINDERS {
        return Ok(Response::error(
            400,
            &format!("at most {MAX_REMINDERS} alerts"),
        ));
    }
    let unreadable = |e: serde_json::Error| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            format!("the stored reminders are unreadable: {e}"),
        )
    };
    let mut user = cx.storage.user();
    for _ in 0..CAS_ATTEMPTS {
        let Some((bytes, version)) = user.get_versioned(DATA_KEY).await? else {
            return Ok(Response::json(200, &serde_json::json!({ "armed": 0 })));
        };
        let mut stored: Stored = serde_json::from_slice(&bytes).map_err(unreadable)?;
        let missing = missing_alerts(&stored, &body.alerts);
        if missing.is_empty() {
            return Ok(Response::json(200, &serde_json::json!({ "armed": 0 })));
        }
        // The timers first, as a save makes them: no stored alert lacks its timer.
        for (id, &at) in &missing {
            user.create_expiring(&timer_key(id, at), b"due", at).await?;
        }
        let armed = missing.len();
        stored.alerts.extend(missing);
        let mut next =
            serde_json::json!({ "rev": stored.rev, "data": stored.data, "alerts": stored.alerts });
        document::stamp_writes(&mut next, &stored.writes, stored.writes_from);
        let bytes = serde_json::to_vec(&next)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;
        if user.put_if_version(DATA_KEY, &bytes, Some(version)).await? {
            return Ok(Response::json(200, &serde_json::json!({ "armed": armed })));
        }
    }
    Ok(Response::error(
        503,
        "the reminders kept changing; try again",
    ))
}

/// An id the demo makes: 1 to 64 letters, digits, `-` and `_`.
fn is_id(id: &str) -> bool {
    (1..=64).contains(&id.len())
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

fn chars(text: &str) -> usize {
    text.chars().count()
}

/// Whether `day` is a calendar day written `YYYY-MM-DD`.
fn is_day(day: &str) -> bool {
    let bytes = day.as_bytes();
    if bytes.len() != 10 || bytes[4] != b'-' || bytes[7] != b'-' {
        return false;
    }
    let number = |range: std::ops::Range<usize>| {
        day.get(range)
            .filter(|part| part.bytes().all(|b| b.is_ascii_digit()))
            .and_then(|part| part.parse::<u32>().ok())
    };
    let (Some(year), Some(month), Some(date)) = (number(0..4), number(5..7), number(8..10)) else {
        return false;
    };
    let leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
    let days = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if leap => 29,
        2 => 28,
        _ => return false,
    };
    (1..=days).contains(&date)
}

/// Whether `time` is a minute written `HH:MM`, 00:00 to 23:59.
fn is_time(time: &str) -> bool {
    let bytes = time.as_bytes();
    bytes.len() == 5
        && bytes[2] == b':'
        && bytes[..2].iter().chain(&bytes[3..]).all(u8::is_ascii_digit)
        && time[..2].parse::<u32>().is_ok_and(|hour| hour < 24)
        && time[3..].parse::<u32>().is_ok_and(|minute| minute < 60)
}

/// Whether `zone` is written as an IANA time zone may be: 1 to 64 letters,
/// digits, `/`, `_`, `+` and `-` (`America/New_York`, `Etc/GMT+5`).
fn is_zone(zone: &str) -> bool {
    (1..=64).contains(&zone.len())
        && zone
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'/' | b'_' | b'+' | b'-'))
}

/// Bound a submitted document and check that it hangs together.
pub fn validate(data: &Data) -> Result<(), String> {
    if data.lists.len() > MAX_LISTS {
        return Err(format!("at most {MAX_LISTS} lists"));
    }
    if data.reminders.len() > MAX_REMINDERS {
        return Err(format!("at most {MAX_REMINDERS} reminders"));
    }
    if data.groups.len() > MAX_LISTS {
        return Err(format!("at most {MAX_LISTS} groups"));
    }
    let mut groups = BTreeSet::new();
    for group in &data.groups {
        if !is_id(&group.id) || SMART_LISTS.contains(&group.id.as_str()) {
            return Err(format!(
                "group id {:?} must be 1 to 64 letters, digits, '-' or '_', and not a smart list's",
                group.id
            ));
        }
        if !groups.insert(group.id.as_str()) {
            return Err(format!("group id {:?} is used twice", group.id));
        }
        if group.before.as_deref().is_some_and(|list| !is_id(list)) {
            return Err(format!("group {:?} stands before no list id", group.id));
        }
        if chars(group.name.trim()) == 0 || chars(&group.name) > MAX_NAME_CHARS {
            return Err(format!(
                "group {:?} needs a name of 1 to {MAX_NAME_CHARS} characters",
                group.id
            ));
        }
    }
    let mut lists = BTreeSet::new();
    for list in &data.lists {
        if !is_id(&list.id) || SMART_LISTS.contains(&list.id.as_str()) {
            return Err(format!(
                "list id {:?} must be 1 to 64 letters, digits, '-' or '_', and not a smart list's",
                list.id
            ));
        }
        if !lists.insert(list.id.as_str()) || groups.contains(list.id.as_str()) {
            return Err(format!("list id {:?} is used twice", list.id));
        }
        if list
            .group_id
            .as_deref()
            .is_some_and(|group| !groups.contains(group))
        {
            return Err(format!(
                "list {:?} is in a group that does not exist",
                list.id
            ));
        }
        if chars(list.name.trim()) == 0 || chars(&list.name) > MAX_NAME_CHARS {
            return Err(format!(
                "list {:?} needs a name of 1 to {MAX_NAME_CHARS} characters",
                list.id
            ));
        }
    }
    let mut reminders = BTreeSet::new();
    for reminder in &data.reminders {
        let id = &reminder.id;
        if !is_id(id) {
            return Err(format!(
                "reminder id {id:?} must be 1 to 64 letters, digits, '-' or '_'"
            ));
        }
        if !reminders.insert(id.as_str()) {
            return Err(format!("reminder id {id:?} is used twice"));
        }
        if !lists.contains(reminder.list_id.as_str()) {
            return Err(format!("reminder {id:?} is in a list that does not exist"));
        }
        if chars(reminder.title.trim()) == 0 || chars(&reminder.title) > MAX_TITLE_CHARS {
            return Err(format!(
                "reminder {id:?} needs a title of 1 to {MAX_TITLE_CHARS} characters"
            ));
        }
        if reminder.due.as_deref().is_some_and(|day| !is_day(day)) {
            return Err(format!(
                "reminder {id:?}: the due day is written YYYY-MM-DD"
            ));
        }
        if reminder
            .due_time
            .as_deref()
            .is_some_and(|time| !is_time(time))
        {
            return Err(format!("reminder {id:?}: the due minute is written HH:MM"));
        }
        if reminder
            .repeat_end
            .as_deref()
            .is_some_and(|day| !is_day(day))
        {
            return Err(format!(
                "reminder {id:?}: the end of its repeat is written YYYY-MM-DD"
            ));
        }
        if reminder.due.is_none() && (reminder.due_time.is_some() || reminder.repeat.is_some()) {
            return Err(format!(
                "reminder {id:?} has a due minute or a repeat but no due day"
            ));
        }
        if let Some(zone) = reminder.time_zone.as_deref() {
            if reminder.due.is_none() || !is_zone(zone) {
                return Err(format!(
                    "reminder {id:?}: a time zone is an IANA name of 1 to 64 letters, digits, '/', '_', '+' or '-', and only with a due day"
                ));
            }
        }
        if (reminder.repeat == Some(Repeat::Custom)) != reminder.repeat_rule.is_some()
            || reminder.repeat_rule.as_ref().is_some_and(|rule| !rule.is_valid())
        {
            return Err(format!(
                "reminder {id:?}: a custom repeat has a rule of 1 to 999 days, weeks, months or years, and only it has one"
            ));
        }
        if reminder.repeat.is_none() && reminder.repeat_end.is_some() {
            return Err(format!(
                "reminder {id:?} has an end of repeat but does not repeat"
            ));
        }
        if reminder
            .early_minutes
            .is_some_and(|minutes| !(1..=10_080).contains(&minutes))
        {
            return Err(format!(
                "reminder {id:?}: an early reminder is 1 minute to a week before"
            ));
        }
        if reminder
            .notes
            .as_deref()
            .is_some_and(|notes| chars(notes) > MAX_NOTES_CHARS)
            || reminder
                .url
                .as_deref()
                .is_some_and(|url| chars(url) > MAX_URL_CHARS)
            || reminder.images.is_some_and(|images| images > MAX_IMAGES)
        {
            return Err(format!("reminder {id:?} has overlong notes, URL or images"));
        }
    }
    for reminder in &data.reminders {
        let Some(parent) = reminder.parent_id.as_deref() else {
            continue;
        };
        let parent = data.reminders.iter().find(|other| other.id == parent);
        if !parent.is_some_and(|parent| {
            parent.id != reminder.id
                && parent.list_id == reminder.list_id
                && parent.parent_id.is_none()
        }) {
            return Err(format!(
                "reminder {:?}: a sub-reminder's parent is a reminder of its list that is no sub-reminder",
                reminder.id
            ));
        }
    }
    Ok(())
}

/// There is one alert for each reminder that is due and still to do, and no
/// other, and each names a possible instant.
fn validate_alerts(data: &Data, alerts: &BTreeMap<String, u64>) -> Result<(), String> {
    for (id, &at) in alerts {
        if !data.reminders.iter().any(|r| &r.id == id && r.alertable()) {
            return Err(format!(
                "alert {id:?} is not a reminder that is due and still to do"
            ));
        }
        if at == 0 || at > MAX_INSTANT_MS {
            return Err(format!("alert {id:?} names an impossible instant"));
        }
    }
    if let Some(missing) = data
        .reminders
        .iter()
        .find(|r| r.alertable() && !alerts.contains_key(&r.id))
    {
        return Err(format!(
            "reminder {:?} is due and still to do but has no alert",
            missing.id
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn reminder(id: &str) -> Reminder {
        Reminder {
            id: id.into(),
            list_id: "work".into(),
            parent_id: None,
            title: "Pay rent".into(),
            completed: None,
            flagged: None,
            due: None,
            due_time: None,
            time_zone: None,
            repeat: None,
            repeat_rule: None,
            repeat_end: None,
            early_minutes: None,
            notes: None,
            priority: None,
            url: None,
            at_location: None,
            when_messaging: None,
            images: None,
            created_at: None,
        }
    }

    fn data(reminders: Vec<Reminder>) -> Data {
        Data {
            lists: vec![List {
                id: "work".into(),
                name: "Work".into(),
                color: Color::Green,
                group_id: None,
            }],
            groups: Vec::new(),
            reminders,
        }
    }

    #[test]
    fn a_sub_reminder_hangs_under_a_top_level_reminder_of_its_list() {
        let mut child = reminder("child");
        child.parent_id = Some("top".into());
        assert!(validate(&data(vec![reminder("top"), child.clone()])).is_ok());
        assert!(
            validate(&data(vec![child.clone()])).is_err(),
            "no such parent"
        );
        let mut own = reminder("top");
        own.parent_id = Some("top".into());
        assert!(validate(&data(vec![own])).is_err(), "its own parent");
        let mut grandchild = reminder("grandchild");
        grandchild.parent_id = Some("child".into());
        assert!(
            validate(&data(vec![reminder("top"), child.clone(), grandchild])).is_err(),
            "two levels"
        );
        let mut elsewhere = reminder("top");
        elsewhere.list_id = "home".into();
        let mut two_lists = data(vec![elsewhere, child]);
        two_lists.lists.push(List {
            id: "home".into(),
            name: "Home".into(),
            color: Color::Red,
            group_id: None,
        });
        assert!(validate(&two_lists).is_err(), "parent in another list");
    }

    #[test]
    fn a_group_is_named_and_a_list_can_only_be_in_a_group_that_exists() {
        let mut grouped = data(Vec::new());
        grouped.lists[0].group_id = Some("g".into());
        assert!(validate(&grouped).is_err(), "no such group");
        grouped.groups.push(Group {
            id: "g".into(),
            name: "Home".into(),
            before: None,
        });
        assert!(validate(&grouped).is_ok());
        let stored = serde_json::to_value(&grouped).unwrap();
        assert_eq!(stored["lists"][0]["groupId"], "g");
        assert_eq!(stored["groups"][0]["name"], "Home");
        grouped.groups[0].name = "  ".into();
        assert!(validate(&grouped).is_err(), "no name");
        grouped.groups[0].name = "Home".into();
        grouped.groups[0].id = "work".into();
        grouped.lists[0].group_id = Some("work".into());
        assert!(validate(&grouped).is_err(), "a list's id");
        let without = serde_json::to_value(data(Vec::new())).unwrap();
        assert!(without.get("groups").is_none(), "{without}");
    }

    #[test]
    fn the_demo_shape_round_trips() {
        let json = r#"{"base":0,"data":{"lists":[{"id":"imac-colors","name":"iMac Colors","color":"blue"}],
            "reminders":[{"id":"imac-7","listId":"imac-colors","title":"Graphite","whenMessaging":true,
            "images":1,"due":"2026-10-12","priority":"high"}]},"alerts":{"imac-7":1791795600000}}"#;
        let put: Put = serde_json::from_str(json).unwrap();
        validate(&put.data).unwrap();
        validate_alerts(&put.data, &put.alerts).unwrap();
        let stored = serde_json::to_value(&put.data).unwrap();
        assert_eq!(stored["reminders"][0]["listId"], "imac-colors");
        assert_eq!(stored["reminders"][0]["whenMessaging"], true);
        assert!(stored["reminders"][0].get("completed").is_none());
        assert!(stored["reminders"][0].get("dueTime").is_none());
        assert_eq!(serde_json::from_value::<Data>(stored).unwrap(), put.data);
    }

    #[test]
    fn due_minutes_and_repeats_round_trip() {
        let json = r#"{"lists":[{"id":"home","name":"Home","color":"orange"}],
            "reminders":[{"id":"bins","listId":"home","title":"Bins","due":"2026-10-12",
            "dueTime":"07:30","repeat":"weekly","repeatEnd":"2026-12-31"}]}"#;
        let data: Data = serde_json::from_str(json).unwrap();
        validate(&data).unwrap();
        let bins = &data.reminders[0];
        assert_eq!(bins.due_time.as_deref(), Some("07:30"));
        assert_eq!(bins.repeat, Some(Repeat::Weekly));
        let stored = serde_json::to_value(&data).unwrap();
        assert_eq!(stored["reminders"][0]["dueTime"], "07:30");
        assert_eq!(stored["reminders"][0]["repeat"], "weekly");
        assert_eq!(stored["reminders"][0]["repeatEnd"], "2026-12-31");
        let unknown = json.replace("weekly", "hourly");
        assert!(serde_json::from_str::<Data>(&unknown).is_err());
    }

    #[test]
    fn a_due_minute_and_a_repeat_need_a_due_day() {
        let mut timed = reminder("a");
        timed.due = Some("2026-10-12".into());
        timed.due_time = Some("15:00".into());
        timed.repeat = Some(Repeat::Weekdays);
        timed.repeat_end = Some("2026-11-12".into());
        assert!(validate(&data(vec![timed.clone()])).is_ok());
        for time in ["24:00", "9:00", "12:60", "12-00", ""] {
            let mut bad = timed.clone();
            bad.due_time = Some(time.into());
            assert!(validate(&data(vec![bad])).is_err(), "{time}");
        }
        let mut no_day = timed.clone();
        no_day.due = None;
        assert!(validate(&data(vec![no_day])).is_err(), "no due day");
        let mut no_repeat = timed.clone();
        no_repeat.repeat = None;
        assert!(
            validate(&data(vec![no_repeat])).is_err(),
            "an end without a repeat"
        );
        let mut bad_end = timed;
        bad_end.repeat_end = Some("2026-02-30".into());
        assert!(validate(&data(vec![bad_end])).is_err(), "not a day");
    }

    #[test]
    fn reminders_must_hang_together() {
        assert!(validate(&data(vec![reminder("a")])).is_ok());
        let mut orphan = reminder("a");
        orphan.list_id = "gone".into();
        assert!(validate(&data(vec![orphan])).is_err());
        let mut untitled = reminder("a");
        untitled.title = "  ".into();
        assert!(
            validate(&data(vec![untitled])).is_err(),
            "a reminder being typed is not saved"
        );
        assert!(validate(&data(vec![reminder("a"), reminder("a")])).is_err());
        let mut smart = data(vec![]);
        smart.lists[0].id = "today".into();
        assert!(
            validate(&smart).is_err(),
            "a list cannot take a smart list's id"
        );
    }

    #[test]
    fn a_time_zone_is_an_iana_name_and_needs_a_due_day() {
        let json = r#"{"lists":[{"id":"work","name":"Work","color":"green"}],
            "reminders":[{"id":"call","listId":"work","title":"Call","due":"2026-10-21",
            "dueTime":"15:00","timeZone":"America/New_York"}]}"#;
        let data: Data = serde_json::from_str(json).unwrap();
        validate(&data).unwrap();
        assert_eq!(
            data.reminders[0].time_zone.as_deref(),
            Some("America/New_York")
        );
        let stored = serde_json::to_value(&data).unwrap();
        assert_eq!(stored["reminders"][0]["timeZone"], "America/New_York");
        for zone in ["UTC", "Etc/GMT+5", "America/Argentina/Buenos_Aires"] {
            let mut ok = data.clone();
            ok.reminders[0].time_zone = Some(zone.into());
            assert!(validate(&ok).is_ok(), "{zone}");
        }
        let long = "A".repeat(65);
        // Spaces, dots and over 64 characters are not an IANA name.
        for zone in ["", "New York", "Europe/../etc", long.as_str()] {
            let mut bad = data.clone();
            bad.reminders[0].time_zone = Some(zone.to_string());
            assert!(validate(&bad).is_err(), "{zone}");
        }
        let mut undated = data.clone();
        undated.reminders[0].due = None;
        undated.reminders[0].due_time = None;
        assert!(validate(&undated).is_err(), "a zone without a due day");
        // A document written before the field still reads and validates.
        let mut older = data;
        older.reminders[0].time_zone = None;
        assert!(validate(&older).is_ok());
    }

    #[test]
    fn the_notification_of_an_alert_closes_and_completes_by_its_instant() {
        let mut call = reminder("a");
        call.notes = Some("Ask for Sam".into());
        let shown = note(&call, 500);
        assert_eq!(shown.app, "reminders");
        assert_eq!(shown.id, "alert:a@500");
        assert_eq!(shown.title, "Pay rent");
        assert_eq!(shown.body.as_deref(), Some("Ask for Sam"));
        assert!(shown.alert);
        assert_eq!(shown.dismiss.as_deref(), Some("/alerts/a/500/close"));
        assert_eq!(shown.actions[0].label, "Complete");
        assert_eq!(
            shown.actions[0].post.as_deref(),
            Some("/alerts/a/500/complete")
        );
        assert!(notification_center::normalize(&shown).is_ok());

        call.repeat = Some(Repeat::Daily);
        let opens = note(&call, 500);
        assert_eq!(opens.actions[0].label, "Show");
        assert_eq!(opens.actions[0].post, None);
    }

    #[test]
    fn completing_from_a_notification_takes_only_the_alert_it_names() {
        let mut call = reminder("a");
        call.due = Some("2026-10-21".into());
        let mut repeats = reminder("b");
        repeats.due = Some("2026-10-21".into());
        repeats.repeat = Some(Repeat::Daily);
        let mut stored = Stored {
            rev: 3,
            data: data(vec![call, repeats]),
            alerts: BTreeMap::from([("a".to_string(), 7), ("b".to_string(), 8)]),
            writes: Vec::new(),
            writes_from: None,
        };
        // Moved since the alert was raised, and one only the browser can move on.
        assert!(!complete_stored(&mut stored, "a", 6));
        assert!(!complete_stored(&mut stored, "b", 8));
        assert_eq!(stored.data.reminders[0].completed, None);

        assert!(complete_stored(&mut stored, "a", 7));
        assert_eq!(stored.data.reminders[0].completed, Some(true));
        assert_eq!(stored.alerts, BTreeMap::from([("b".to_string(), 8)]));
        assert!(validate_alerts(&stored.data, &stored.alerts).is_ok());
        // Done again, it changes nothing.
        assert!(!complete_stored(&mut stored, "a", 7));
    }

    #[test]
    fn arming_takes_only_the_alerts_a_due_reminder_lacks_and_still_matches() {
        let mut call = reminder("a");
        call.due = Some("2026-10-21".into());
        call.due_time = Some("15:00".into());
        call.time_zone = Some("America/New_York".into());
        let mut armed = reminder("b");
        armed.due = Some("2026-10-22".into());
        let mut done = reminder("c");
        done.due = Some("2026-10-22".into());
        done.completed = Some(true);
        let stored = Stored {
            rev: 3,
            data: data(vec![call, armed, done]),
            alerts: BTreeMap::from([("b".to_string(), 7)]),
            writes: Vec::new(),
            writes_from: None,
        };
        let one = |at: u64, due: &str, time: Option<&str>, zone: Option<&str>| ArmOne {
            at,
            due: due.into(),
            due_time: time.map(Into::into),
            time_zone: zone.map(Into::into),
        };
        let ny = Some("America/New_York");
        let asked = BTreeMap::from([
            ("a".to_string(), one(100, "2026-10-21", Some("15:00"), ny)),
            // An alert the document has is never moved.
            ("b".to_string(), one(200, "2026-10-22", None, None)),
            // Completed, and no such reminder.
            ("c".to_string(), one(300, "2026-10-22", None, None)),
            ("d".to_string(), one(400, "2026-10-22", None, None)),
        ]);
        assert_eq!(
            missing_alerts(&stored, &asked),
            BTreeMap::from([("a".to_string(), 100)])
        );
        // Worked out from a minute, a zone or a day the reminder no longer says, or impossible.
        for stale in [
            one(100, "2026-10-21", Some("16:00"), ny),
            one(100, "2026-10-21", Some("15:00"), Some("Asia/Tokyo")),
            one(100, "2026-10-22", Some("15:00"), ny),
            one(0, "2026-10-21", Some("15:00"), ny),
        ] {
            let asked = BTreeMap::from([("a".to_string(), stale)]);
            assert!(missing_alerts(&stored, &asked).is_empty());
        }
    }

    #[test]
    fn due_days_are_calendar_days() {
        for day in ["2026-10-12", "2024-02-29", "2000-02-29"] {
            assert!(is_day(day), "{day}");
        }
        for day in [
            "2026-13-01",
            "2026-02-29",
            "1900-02-29",
            "2026-1-12",
            "2026-10-1x",
            "",
        ] {
            assert!(!is_day(day), "{day}");
        }
    }

    #[test]
    fn alerts_belong_to_reminders_that_are_due_and_to_do() {
        let mut due = reminder("a");
        due.due = Some("2026-10-12".into());
        let alerts = |at| BTreeMap::from([("a".to_string(), at)]);
        assert!(validate_alerts(&data(vec![due.clone()]), &alerts(1)).is_ok());
        assert!(validate_alerts(&data(vec![due.clone()]), &alerts(0)).is_err());
        assert!(
            validate_alerts(&data(vec![due.clone()]), &BTreeMap::new()).is_err(),
            "a due reminder without its alert"
        );
        assert!(
            validate_alerts(&data(vec![reminder("a")]), &alerts(1)).is_err(),
            "not due"
        );
        due.completed = Some(true);
        assert!(
            validate_alerts(&data(vec![due]), &alerts(1)).is_err(),
            "completed"
        );
        assert!(
            validate_alerts(&data(vec![]), &alerts(1)).is_err(),
            "no such reminder"
        );
    }
}

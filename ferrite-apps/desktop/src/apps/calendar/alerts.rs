//! Alerts with no Calendar window open.
//!
//! The page raises an event's alert while Calendar is open
//! (`demos/calendar/calendar-alerts.ts`). Without a window, the desktop's
//! personal stream (`src/live.rs`) calls [`raise_due_alerts`] every few
//! seconds, and a due alert reaches the person through Notification Center.
//! A notification is one per occurrence (and per snooze), so several browsers
//! and repeated passes raise it once.
//!
//! Limits, all from what the server knows: it has no time-zone database and
//! does not know the person's zone, so it lays out no repeating or floating
//! event's occurrences and knows no birthdays or invitations' defaults; the
//! desktop shell lays those out, in a browser, and names what is due at
//! `/alerts/raise` (`demos/calendar/calendar-alert-watch.ts`). An all-day alert
//! counts its minutes on the instants stored, so it can be an hour out across a
//! change of the clocks; and the message of an alert the server finds itself
//! says how far off the event is, not at what time of day.
//!
//! * `POST /alerts/shown` with `{"alerts": [{"event", "start", "until"?,
//!   "title"?, "location"?, "allDay"?}]}`: the window shows these itself. Their
//!   notifications are taken back, or kept from ever being raised. `{"told": n}`.
//!   `title` and the rest name a birthday or an invitation, which the document
//!   does not hold.
//! * `POST /alerts/raise`, the same with `"when"?`, the time the page says: raises
//!   their notifications, one per occurrence and snooze. `{"told": n}`.
//! * `POST /alerts/<event>/<start>/close`: as Close on the window's alert, saved
//!   with the event. `POST /alerts/<event>/<start>/snooze`: puts it off
//!   [`SNOOZE_MS`]. `{"changed": bool}`. A birthday's or invitation's answer is
//!   kept beside the document ([`OTHERS_KEY`]).
//! * `GET /alerts/others`: `{"alerts": {id: {"dismissed"?, "snooze"?}}}`, those
//!   answers, which the page lays its alerts out with.

use std::collections::BTreeMap;
use std::io;

use ferrite_app::client::StoreClusterClient;
use ferrite_app::{serde, serde_json};

use super::super::document::{self, Saved};
use super::super::notification_center::{self, Action, Notification};
use super::model::{AlertSnooze, Event, MAX_ABS_MS};
use super::{commit, read, APP};
use crate::http::Response;
use crate::module::{ApiCtx, Storage};

const MINUTE_MS: i64 = 60_000;
/// What Snooze on a notification puts an alert off by: the first of the
/// window's choices.
const SNOOZE_MS: i64 = 5 * MINUTE_MS;
/// The most alerts one pass raises, and one `POST /alerts/shown` names.
const MAX_AT_ONCE: usize = 20;
/// Writes of the document one request tries before giving up.
const CAS_ATTEMPTS: usize = 8;
/// Where the answers to the alerts of birthdays and invitations are kept.
const OTHERS_KEY: &str = "alert-others";
/// The most of them kept: the oldest close goes first.
const OTHERS_KEPT: usize = 500;

/// Whether `id` names a birthday's or an invitation's alert (`birthday-<card>`,
/// `invitation-<token>`), in letters a notification's path can carry.
fn is_other(id: &str) -> bool {
    (id.starts_with("birthday-") || id.starts_with("invitation-"))
        && id.len() <= 120
        && !id.contains("..")
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~'))
}

/// A birthday's or invitation's alert as the person answered it.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, Default, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
struct OtherAnswer {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    dismissed: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    snooze: Option<AlertSnooze>,
}

type OtherAnswers = BTreeMap<String, OtherAnswer>;

fn answered(answers: &mut OtherAnswers, id: &str, start: i64, action: &str, now: i64) {
    let answer = answers.entry(id.to_string()).or_default();
    if action == "close" {
        answer.dismissed = Some(answer.dismissed.map_or(start, |at| at.max(start)));
        answer.snooze = answer.snooze.filter(|snooze| snooze.start != start);
    } else {
        answer.snooze = Some(AlertSnooze {
            start,
            until: now + SNOOZE_MS,
        });
    }
    while answers.len() > OTHERS_KEPT {
        let oldest = answers
            .iter()
            .filter(|(each, _)| each.as_str() != id)
            .min_by_key(|(_, answer)| answer.dismissed.unwrap_or(i64::MIN))
            .map(|(each, _)| each.clone());
        match oldest {
            Some(oldest) => answers.remove(&oldest),
            None => break,
        };
    }
}

/// An occurrence whose alert has come: its start, and the end of its snooze
/// when that is why it shows.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Due {
    start: i64,
    until: Option<i64>,
}

/// The alerts of `event` that show at `now`, as `dueAlerts` in
/// `calendar-alerts.ts` has them for what the server can lay out.
fn due(event: &Event, now: i64) -> Vec<Due> {
    let Some(alert) = event.alert else {
        return Vec::new();
    };
    let mut found = Vec::new();
    let snooze = event.alert_snooze;
    if let Some(snooze) = snooze.filter(|snooze| snooze.until <= now) {
        found.push(Due {
            start: snooze.start,
            until: Some(snooze.until),
        });
    }
    let start = event.start;
    let closed = event.alert_dismissed.is_some_and(|at| start <= at);
    let snoozed = snooze.is_some_and(|snooze| snooze.start == start);
    let lasts = event.end.max(start + MINUTE_MS);
    if event.repeat.is_none()
        && !event.floating
        && !closed
        && !snoozed
        && start - i64::from(alert) * MINUTE_MS <= now
        && now < lasts
    {
        found.push(Due { start, until: None });
    }
    found
}

/// `amount` of time in words: "1 minute", "3 hours", "2 days".
fn span(ms: i64) -> String {
    let minutes = (ms + MINUTE_MS - 1) / MINUTE_MS;
    let (amount, unit) = if minutes < 60 {
        (minutes, "minute")
    } else if minutes < 48 * 60 {
        (minutes / 60, "hour")
    } else {
        (minutes / (24 * 60), "day")
    };
    format!("{amount} {unit}{}", if amount == 1 { "" } else { "s" })
}

fn when(start: i64, now: i64) -> String {
    if start > now {
        format!("Starts in {}", span(start - now))
    } else if now - start < MINUTE_MS {
        "Starts now".to_string()
    } else {
        format!("Started {} ago", span(now - start))
    }
}

fn note_id(event: &str, due: Due) -> String {
    match due.until {
        Some(until) => format!("alert:{event}@{}@{until}", due.start),
        None => format!("alert:{event}@{}", due.start),
    }
}

fn note(event: &Event, due: Due, now: i64) -> Notification {
    let title = if event.title.is_empty() {
        "New Event"
    } else {
        &event.title
    };
    note_of(
        &event.id,
        title,
        event.location.clone(),
        event.all_day,
        due,
        now,
        None,
    )
}

fn note_of(
    id: &str,
    title: &str,
    location: Option<String>,
    all_day: bool,
    due: Due,
    now: i64,
    said: Option<String>,
) -> Notification {
    let start = due.start;
    // An id of the module's letters makes a path the notification can carry,
    // but for two dots in a row, which no path may hold.
    let path =
        |action: &str| (!id.contains("..")).then(|| format!("/alerts/{id}/{start}/{action}"));
    Notification {
        app: APP.into(),
        id: note_id(id, due),
        title: title.to_string(),
        subtitle: location,
        body: Some(said.unwrap_or_else(|| {
            if all_day {
                "All day".to_string()
            } else {
                when(start, now)
            }
        })),
        alert: true,
        dismiss: path("close"),
        actions: path("snooze")
            .map(|post| {
                vec![Action {
                    label: "Snooze".into(),
                    post: Some(post),
                }]
            })
            .unwrap_or_default(),
    }
}

/// Raise what is due of `principal`'s events at `now_ms`. Called again and
/// again, by every browser the person has open: nothing is raised twice.
pub async fn raise_due_alerts(
    store: &mut StoreClusterClient,
    principal: &str,
    now_ms: u64,
) -> io::Result<()> {
    let now = now_ms as i64;
    let mut storage = Storage::new(store, APP, principal);
    let Some(doc) = read(&mut storage.user()).await?.doc else {
        return Ok(());
    };
    let raising = doc
        .events
        .iter()
        .flat_map(|event| due(event, now).into_iter().map(move |one| (event, one)))
        .take(MAX_AT_ONCE);
    for (event, one) in raising {
        notification_center::notify(storage.store(), principal, now_ms, &note(event, one, now))
            .await?;
    }
    Ok(())
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct ShownBody {
    alerts: Vec<Shown>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Shown {
    event: String,
    start: i64,
    #[serde(default)]
    until: Option<i64>,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    location: Option<String>,
    #[serde(default, rename = "allDay")]
    all_day: bool,
    #[serde(default)]
    when: Option<String>,
}

/// The notification of an alert a page names: of an event of the document, which
/// says what it is, or of a birthday or invitation with its title. `raising`, the
/// document's word goes over a stale page's: one closed stays closed. `None` for
/// what it cannot be.
fn named(alert: Shown, events: &[Event], raising: bool, now: i64) -> Option<Notification> {
    if !(-MAX_ABS_MS..=MAX_ABS_MS).contains(&alert.start) {
        return None;
    }
    let one = Due {
        start: alert.start,
        until: alert.until,
    };
    if let Some(event) = events.iter().find(|event| event.id == alert.event) {
        let closed =
            alert.until.is_none() && event.alert_dismissed.is_some_and(|at| alert.start <= at);
        if raising && (event.alert.is_none() || closed) {
            return None;
        }
        let mut made = note(event, one, now);
        if let Some(said) = alert.when {
            made.body = Some(said);
        }
        return Some(made);
    }
    let title = alert.title.filter(|title| !title.trim().is_empty())?;
    is_other(&alert.event).then(|| {
        note_of(
            &alert.event,
            &title,
            alert.location,
            alert.all_day,
            one,
            now,
            alert.when,
        )
    })
}

/// `POST /alerts/shown`: delivered and taken back at once, as a notification
/// taken back stays delivered, so a later pass does not raise it. `POST
/// /alerts/raise`: delivered, once per occurrence.
pub async fn told(cx: &mut ApiCtx<'_>, shown: bool) -> io::Result<Response> {
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
    let doc = read(&mut cx.storage.user()).await?.doc.unwrap_or_default();
    let mut told = 0;
    for alert in body.alerts {
        let Some(note) = named(alert, &doc.events, !shown, now_ms as i64) else {
            continue;
        };
        notification_center::notify(cx.storage.store(), &principal, now_ms, &note).await?;
        if shown {
            notification_center::withdraw_at(cx.storage.store(), &principal, now_ms, APP, &note.id)
                .await?;
        }
        told += 1;
    }
    Ok(Response::json(200, &serde_json::json!({ "told": told })))
}

/// `GET /alerts/others`.
pub async fn others(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let answers = document::read::<OtherAnswers>(&mut cx.storage.user(), OTHERS_KEY).await?;
    Ok(Response::json(
        200,
        &serde_json::json!({ "alerts": answers.doc.unwrap_or_default() }),
    ))
}

/// `POST /alerts/<event>/<start>/<close or snooze>`, by compare-and-set on the
/// document, so a window's save that comes between is kept. Done again, it
/// changes nothing further.
pub async fn answer(
    cx: &mut ApiCtx<'_>,
    event: &str,
    start: &str,
    action: &str,
) -> io::Result<Response> {
    let Some(start) = start
        .parse::<i64>()
        .ok()
        .filter(|start| (-MAX_ABS_MS..=MAX_ABS_MS).contains(start))
    else {
        return Ok(Response::not_found());
    };
    let now = cx.now_ms as i64;
    if is_other(event) {
        for _ in 0..CAS_ATTEMPTS {
            let current =
                document::read::<OtherAnswers>(&mut cx.storage.user(), OTHERS_KEY).await?;
            let mut answers = current.doc.unwrap_or_default();
            answered(&mut answers, event, start, action, now);
            let saved = document::write(
                &mut cx.storage.user(),
                OTHERS_KEY,
                Some(current.rev),
                Some(&answers),
            )
            .await?;
            if let Saved::Stored(_) = saved {
                return Ok(Response::json(200, &serde_json::json!({ "changed": true })));
            }
        }
        return Ok(Response::error(503, "the answers kept changing"));
    }
    for _ in 0..CAS_ATTEMPTS {
        let current = read(&mut cx.storage.user()).await?;
        let Some(mut doc) = current.doc else {
            return Ok(Response::json(
                200,
                &serde_json::json!({ "changed": false }),
            ));
        };
        let Some(found) = doc
            .events
            .iter_mut()
            .find(|each| each.id == event && each.alert.is_some())
        else {
            return Ok(Response::json(
                200,
                &serde_json::json!({ "changed": false }),
            ));
        };
        if action == "close" {
            close(found, start);
        } else {
            found.alert_snooze = Some(AlertSnooze {
                start,
                until: now + SNOOZE_MS,
            });
        }
        if let Saved::Stored(_) = commit(&mut cx.storage.user(), current.rev, &doc).await? {
            return Ok(Response::json(200, &serde_json::json!({ "changed": true })));
        }
    }
    Ok(Response::error(503, "the document kept changing"))
}

fn close(event: &mut Event, start: i64) {
    event.alert_dismissed = Some(event.alert_dismissed.map_or(start, |at| at.max(start)));
    if event
        .alert_snooze
        .is_some_and(|snooze| snooze.start == start)
    {
        event.alert_snooze = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: i64 = 1_800_000_000_000;

    fn event(extra: serde_json::Value) -> Event {
        let mut json = serde_json::json!({
            "id": "e1", "title": "Standup", "start": NOW + 10 * MINUTE_MS,
            "end": NOW + 40 * MINUTE_MS, "calendar": "home", "alert": 15,
        });
        for (key, value) in extra.as_object().unwrap() {
            json[key] = value.clone();
        }
        serde_json::from_value(json).unwrap()
    }

    #[test]
    fn an_alert_shows_from_its_moment_until_its_occurrence_ends() {
        let start = NOW + 10 * MINUTE_MS;
        let shows = vec![Due { start, until: None }];
        assert_eq!(due(&event(serde_json::json!({})), NOW), shows);
        let not_yet = serde_json::json!({ "alert": 5 });
        assert_eq!(due(&event(not_yet), NOW), vec![]);
        assert_eq!(
            due(&event(serde_json::json!({})), start + 30 * MINUTE_MS),
            vec![]
        );
        let none: Event = {
            let mut plain = event(serde_json::json!({}));
            plain.alert = None;
            plain
        };
        assert_eq!(due(&none, NOW), vec![]);
    }

    #[test]
    fn what_was_closed_and_what_only_a_browser_can_lay_out_stay_quiet() {
        let start = NOW + 10 * MINUTE_MS;
        assert_eq!(
            due(&event(serde_json::json!({ "alertDismissed": start })), NOW),
            vec![]
        );
        let repeating = serde_json::json!({ "repeat": { "freq": "daily" } });
        assert_eq!(due(&event(repeating), NOW), vec![]);
        assert_eq!(
            due(&event(serde_json::json!({ "floating": true })), NOW),
            vec![]
        );
    }

    #[test]
    fn a_snooze_holds_its_occurrence_back_then_shows_it_with_a_new_id() {
        let start = NOW + 10 * MINUTE_MS;
        let snooze =
            serde_json::json!({ "alertSnooze": { "start": start, "until": NOW + MINUTE_MS } });
        assert_eq!(due(&event(snooze.clone()), NOW), vec![]);
        let later = NOW + MINUTE_MS;
        let back = Due {
            start,
            until: Some(later),
        };
        assert_eq!(due(&event(snooze), later), vec![back]);
        assert_eq!(note_id("e1", back), format!("alert:e1@{start}@{later}"));
        assert_eq!(
            note_id("e1", Due { start, until: None }),
            format!("alert:e1@{start}")
        );
    }

    #[test]
    fn the_notification_says_how_far_off_and_can_be_closed_and_snoozed() {
        let start = NOW + 10 * MINUTE_MS;
        let shown = note(
            &event(serde_json::json!({ "location": "Pier" })),
            Due { start, until: None },
            NOW,
        );
        assert_eq!(shown.title, "Standup");
        assert_eq!(shown.subtitle.as_deref(), Some("Pier"));
        assert_eq!(shown.body.as_deref(), Some("Starts in 10 minutes"));
        assert_eq!(shown.dismiss, Some(format!("/alerts/e1/{start}/close")));
        assert_eq!(
            shown.actions[0].post,
            Some(format!("/alerts/e1/{start}/snooze"))
        );
        assert!(notification_center::normalize(&shown).is_ok());
        assert_eq!(when(NOW - 2 * 3_600_000, NOW), "Started 2 hours ago");
        assert_eq!(when(NOW, NOW), "Starts now");
        assert_eq!(when(NOW + 3 * 86_400_000, NOW), "Starts in 3 days");
    }

    #[test]
    fn a_page_names_a_birthday_with_its_title_and_an_event_by_the_document() {
        let start = NOW + 10 * MINUTE_MS;
        let shown = |fields: serde_json::Value| -> Shown {
            let mut json = serde_json::json!({ "event": "birthday-c1", "start": start });
            for (key, value) in fields.as_object().unwrap() {
                json[key] = value.clone();
            }
            serde_json::from_value(json).unwrap()
        };
        let birthday = named(
            shown(serde_json::json!({ "title": "Ann’s Birthday", "allDay": true })),
            &[],
            true,
            NOW,
        )
        .unwrap();
        assert_eq!(birthday.id, format!("alert:birthday-c1@{start}"));
        assert_eq!(birthday.title, "Ann’s Birthday");
        assert_eq!(birthday.body.as_deref(), Some("All day"));
        assert_eq!(
            birthday.dismiss,
            Some(format!("/alerts/birthday-c1/{start}/close"))
        );
        assert!(notification_center::normalize(&birthday).is_ok());
        assert_eq!(named(shown(serde_json::json!({})), &[], true, NOW), None);
        let stranger = shown(serde_json::json!({ "event": "elsewhere", "title": "Hello" }));
        assert_eq!(named(stranger, &[], true, NOW), None);

        let daily = event(serde_json::json!({ "repeat": { "freq": "daily" } }));
        let mine = shown(serde_json::json!({
            "event": "e1", "title": "Not this", "when": "9:10 AM to 9:30 AM",
        }));
        let raised = named(mine, std::slice::from_ref(&daily), true, NOW).unwrap();
        assert_eq!(raised.title, "Standup");
        assert_eq!(raised.body.as_deref(), Some("9:10 AM to 9:30 AM"));
        assert_eq!(raised.id, format!("alert:e1@{start}"));

        let closed = event(serde_json::json!({ "alertDismissed": start }));
        let raise = shown(serde_json::json!({ "event": "e1" }));
        assert_eq!(named(raise, std::slice::from_ref(&closed), true, NOW), None);
        let window = shown(serde_json::json!({ "event": "e1" }));
        assert!(named(window, std::slice::from_ref(&closed), false, NOW).is_some());
    }

    #[test]
    fn only_a_birthday_or_an_invitation_is_kept_beside_the_document() {
        assert!(is_other("birthday-c1"));
        assert!(is_other("invitation-abc_1"));
        assert!(!is_other("e1"));
        assert!(!is_other("birthday-a/b"));
        assert!(!is_other("birthday-a..b"));

        let mut answers = OtherAnswers::new();
        answered(&mut answers, "birthday-c1", 100, "snooze", NOW);
        assert_eq!(
            answers["birthday-c1"].snooze,
            Some(AlertSnooze {
                start: 100,
                until: NOW + SNOOZE_MS
            })
        );
        answered(&mut answers, "birthday-c1", 100, "close", NOW);
        assert_eq!(answers["birthday-c1"].dismissed, Some(100));
        assert_eq!(answers["birthday-c1"].snooze, None);
        answered(&mut answers, "birthday-c1", 50, "close", NOW);
        assert_eq!(answers["birthday-c1"].dismissed, Some(100));

        for n in 0..(OTHERS_KEPT + 5) {
            answered(
                &mut answers,
                &format!("birthday-{n}"),
                n as i64,
                "close",
                NOW,
            );
        }
        assert_eq!(answers.len(), OTHERS_KEPT);
        assert!(answers.contains_key(&format!("birthday-{}", OTHERS_KEPT + 4)));
    }

    #[test]
    fn closing_keeps_a_later_close_and_ends_that_occurrence_s_snooze() {
        let start = NOW + 10 * MINUTE_MS;
        let mut held = event(serde_json::json!({
            "alertDismissed": start + 1,
            "alertSnooze": { "start": start, "until": NOW },
        }));
        close(&mut held, start);
        assert_eq!(held.alert_dismissed, Some(start + 1));
        assert_eq!(held.alert_snooze, None);
    }
}

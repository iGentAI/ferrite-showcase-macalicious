//! Calendar's server half: a person's calendars and events.
//!
//! The Calendar window edits in the browser and saves the whole document after
//! every change; this module keeps it, one document per person.
//!
//! * `GET /api/calendar/events`: `{"events": [...], "calendars": [...],
//!   "settings": {...} | null, "rev": n, "session": id}`. `events` is `null`
//!   before the person has saved any (the window then shows its starting
//!   events); `calendars` are the person's own (Home and Work until they change
//!   them); `settings` are their preferences as `GET /settings` answers them, in
//!   the same reply, so that the window lays out its first week from the stored
//!   first day without a second read before it.
//! * `PUT /api/calendar/events` with `{"events": [...], "rev": n, "calendars"?}`,
//!   `n` the revision the page last had: replaces the document and answers it
//!   under its new revision, or, when `n` is not the stored revision, changes
//!   nothing and answers 409 with the current one (`document.rs`). Without
//!   `calendars` the stored ones stay. A `settings` field, which a page may
//!   carry over from a read when it merges a change, is ignored: preferences
//!   are saved at `/settings` only.
//! * `DELETE /api/calendar/events`: forgets the document; the next GET answers
//!   `null`, under a new revision.
//!
//! * `GET /api/calendar/sent`: `{"events": {"<event id>": [{"name",
//!   "full_name", "status"}]}, "pending": bool}`, the answers to the person's
//!   invitations; `pending` while some invitee is still to be told, which the
//!   next read carries on with.
//! * `GET /api/calendar/inbox`: `{"invitations": [{"id", "version",
//!   "organizer": {"name", "full_name"}, "event", "status", "invitees"}]}`,
//!   the events other people invited the person to.
//! * `POST /api/calendar/inbox/<id>/<version>/accept` and `/decline`: the
//!   person's answer to the version of one of them they saw; 404 for an
//!   invitation they do not have, 409 when its time changed since.
//! * `GET /api/calendar/people/<account name>`: `{"name", "full_name"}` of
//!   the account an event can invite, 404 when there is none.
//! * `GET /api/calendar/settings`: `{"settings": {...} | null, "rev": n,
//!   "session": id}`, the person's preferences (the Preferences window's General
//!   pane, `model::Settings`); `null` until they change one.
//! * `PUT /api/calendar/settings` with `{"settings": {...}, "rev": n}`: replaces
//!   them, compare-and-set on the revision as the events are (409 with the
//!   stored ones on an older revision); 400 for preferences the window does not
//!   offer.
//!
//! An event invites people by account name (`invitees`), only from a
//! signed-in account; `invites.rs` says how the invitations are kept.
//!
//! Every write is a compare-and-set on the document's revision, so two saves
//! never both land on the same revision. Storage, in the person's own space
//! (`apps/calendar/users/<principal>/`): `events`, the document (`{rev, doc}`,
//! `document.rs`; an earlier build's plain list of events still reads), and
//! `settings`, the preferences (`{rev, doc}`).
//! Invitations are in the module's shared space (`invites.rs`). Alerts with no
//! window open, and their routes, are in `alerts.rs`: the page raises what only it
//! can lay out.

use std::io;

use ferrite_app::{serde, serde_json};

mod alerts;
mod invites;
mod model;

pub use alerts::raise_due_alerts;

use super::attachments::{self, NewAttachment};
use super::document::{self, Saved};
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture, Space};
use model::{Calendar, Doc, Event, Settings, Stored};

pub const MODULE: AppModule = AppModule {
    name: APP,
    title: "Calendar",
    handle,
};

const APP: &str = "calendar";
const KEY: &str = "events";
const SETTINGS_KEY: &str = "settings";

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct SettingsBody {
    settings: Settings,
    rev: u64,
    #[serde(default)]
    session: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Body {
    events: Vec<Event>,
    /// The revision the page based this document on, and the session it
    /// loaded it under (`document.rs`).
    rev: u64,
    #[serde(default)]
    session: Option<String>,
    #[serde(default)]
    calendars: Option<Vec<Calendar>>,
    /// The preferences a read answered beside the events, carried over by a
    /// page's merge: ignored (they are saved at `/settings`).
    #[serde(default)]
    #[allow(dead_code)]
    settings: Option<serde::de::IgnoredAny>,
}

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    let outcome = match (cx.request.method, cx.request.path) {
        ("GET", "/events") => get_events(&mut cx).await,
        ("PUT", "/events") => put_events(&mut cx).await,
        ("DELETE", "/events") => delete_events(&mut cx).await,
        (_, "/events") => Ok(Response::method_not_allowed()),
        ("GET", "/settings") => get_settings(&mut cx).await,
        ("PUT", "/settings") => put_settings(&mut cx).await,
        (_, "/settings") => Ok(Response::method_not_allowed()),
        (method, path) if path == "/attachments" || path.starts_with("/attachments/") => {
            attachment_route(&mut cx, method, path).await
        }
        ("GET", "/sent") => invites::sent(&mut cx).await,
        ("GET", "/inbox") => invites::inbox(&mut cx).await,
        (_, "/sent" | "/inbox") => Ok(Response::method_not_allowed()),
        ("POST", "/alerts/shown") => alerts::told(&mut cx, true).await,
        ("POST", "/alerts/raise") => alerts::told(&mut cx, false).await,
        ("GET", "/alerts/others") => alerts::others(&mut cx).await,
        (_, "/alerts/shown" | "/alerts/raise" | "/alerts/others") => {
            Ok(Response::method_not_allowed())
        }
        (method, path) => {
            if let Some((event, start, action)) = path.strip_prefix("/alerts/").and_then(|rest| {
                let mut parts = rest.splitn(3, '/');
                Some((parts.next()?, parts.next()?, parts.next()?))
            }) {
                match (method, action) {
                    ("POST", "close" | "snooze") => {
                        alerts::answer(&mut cx, event, start, action).await
                    }
                    (_, "close" | "snooze") => Ok(Response::method_not_allowed()),
                    _ => Ok(Response::not_found()),
                }
            } else if let Some(name) = path.strip_prefix("/people/") {
                if method == "GET" {
                    invites::people_route(&mut cx, name).await
                } else {
                    Ok(Response::method_not_allowed())
                }
            } else if let Some((token, version, answer)) = path
                .strip_prefix("/inbox/")
                .and_then(|rest| {
                    let mut parts = rest.splitn(3, '/');
                    Some((parts.next()?, parts.next()?, parts.next()?))
                })
                .filter(|(token, _, _)| invites::is_token(token))
            {
                let status = match answer {
                    "accept" => Some(invites::Status::Accepted),
                    "decline" => Some(invites::Status::Declined),
                    _ => None,
                };
                // A version is the revision digits of a document, as the inbox lists it.
                let version = Some(version)
                    .filter(|v| {
                        (1..=19).contains(&v.len()) && v.bytes().all(|b| b.is_ascii_digit())
                    })
                    .and_then(|v| v.parse::<u64>().ok());
                match (method, status, version) {
                    ("POST", Some(status), Some(version)) => {
                        invites::respond(&mut cx, token, version, status).await
                    }
                    (_, Some(_), Some(_)) => Ok(Response::method_not_allowed()),
                    _ => Ok(Response::not_found()),
                }
            } else {
                Ok(Response::not_found())
            }
        }
    };
    outcome.unwrap_or_else(|error| Response::error(503, &format!("storage failed: {error}")))
}

/// A file of an event: uploaded in pieces as Mail's are (`attachments.rs`),
/// held by the save that names it, and read only by its owner.
async fn attachment_route(cx: &mut ApiCtx<'_>, method: &str, path: &str) -> io::Result<Response> {
    let Some(account) = cx.session.account.clone() else {
        return Ok(Response::error(401, "sign in to use Calendar"));
    };
    let segments: Vec<&str> = path.trim_start_matches('/').split('/').collect();
    if method != "GET" && account.guest {
        return Ok(Response::error(403, "a Guest User cannot attach files"));
    }
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
            let current = read(&mut cx.storage.user()).await?;
            let found = current.doc.as_ref().and_then(|doc| {
                doc.events
                    .iter()
                    .flat_map(|event| &event.attachments)
                    .find(|file| file.id == *id)
            });
            match found {
                Some(file) => attachments::read(ctx, MODULE.name, file, first, count).await,
                None => Response::error(404, "no event holds this attachment"),
            }
        }
        (_, ["attachments", ..]) => Response::method_not_allowed(),
        _ => Response::not_found(),
    })
}

/// The stored document, an earlier build's list of events read as one.
async fn read(space: &mut Space<'_>) -> io::Result<document::Current<Doc>> {
    let current = document::read::<Stored>(space, KEY).await?;
    Ok(document::Current {
        doc: current.doc.map(Doc::from),
        rev: current.rev,
    })
}

/// What a `GET` answers for a document and its revision.
fn view(doc: Option<&Doc>, rev: u64) -> serde_json::Value {
    let events = doc.map(|doc| &doc.events);
    let calendars = doc.map_or_else(model::default_calendars, Doc::calendars);
    serde_json::json!({ "events": events, "calendars": calendars, "rev": rev })
}

async fn get_events(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let current = read(&mut cx.storage.user()).await?;
    let mut body = view(current.doc.as_ref(), current.rev);
    // The preferences in the same reply: the window's first week is laid out
    // from the stored first day, with no read before the events'.
    let settings = document::read::<Settings>(&mut cx.storage.user(), SETTINGS_KEY).await?;
    body["settings"] = serde_json::json!(settings.doc);
    Ok(document::for_session(body, cx.session))
}

/// Write `doc` over revision `rev`. When the write's outcome is unknown, read
/// it back: the document holding exactly `doc` under a later revision was
/// written; another document under a later revision is a conflict; the same
/// revision means nothing was written, and the error stands.
async fn commit(space: &mut Space<'_>, rev: u64, doc: &Doc) -> io::Result<Saved<Stored>> {
    let stored = Stored::Current(doc.clone());
    match document::write(space, KEY, Some(rev), Some(&stored)).await {
        Ok(saved) => Ok(saved),
        Err(error) => {
            // The write's outcome is unknown: the document as it is now says what happened.
            let now = read(space).await?;
            if now.rev == rev {
                // Nothing was written: a failure, not a conflict.
                Err(error)
            } else if now.doc.as_ref() == Some(doc) {
                Ok(Saved::Stored(now.rev))
            } else {
                Ok(Saved::Conflict(document::Current {
                    doc: now.doc.map(Stored::Current),
                    rev: now.rev,
                }))
            }
        }
    }
}

async fn put_events(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let body: Body = match cx.request.json() {
        Ok(body) => body,
        Err(response) => return Ok(response),
    };
    if let Some(refused) = document::other_session(body.session.as_deref(), cx.session) {
        return Ok(refused);
    }
    let current = read(&mut cx.storage.user()).await?;
    if body.rev != current.rev {
        return Ok(document::conflict(view(current.doc.as_ref(), current.rev)));
    }
    let stored = current.doc;
    let inviting = |doc: &Doc| doc.events.iter().any(|event| !event.invitees.is_empty());
    let invited_before = stored.as_ref().is_some_and(inviting);
    let before_calendars = stored.as_ref().and_then(|doc| doc.calendars.clone());
    let calendars = match body.calendars {
        Some(calendars) => match model::validate_calendars(calendars) {
            Ok(calendars) => Some(calendars),
            Err(message) => return Ok(Response::error(400, &message)),
        },
        None => before_calendars,
    };
    let known = calendars.clone().unwrap_or_else(model::default_calendars);
    let mut events = match model::validate(body.events, &known) {
        Ok(events) => events,
        Err(message) => return Ok(Response::error(400, &message)),
    };
    // A file the page names is the stored record of it, or one of the person's
    // own uploads, which this save holds: what the page says of it is not used.
    let mut files: std::collections::BTreeMap<String, attachments::Attachment> = stored
        .iter()
        .flat_map(|doc| &doc.events)
        .flat_map(|event| &event.attachments)
        .map(|file| (file.id.clone(), file.clone()))
        .collect();
    let new: std::collections::BTreeSet<String> = events
        .iter()
        .flat_map(|event| &event.attachments)
        .filter(|file| !files.contains_key(&file.id))
        .map(|file| file.id.clone())
        .collect();
    if !new.is_empty() {
        let ids: Vec<String> = new.into_iter().collect();
        let now_ms = cx.now_ms;
        match attachments::hold(&mut cx.storage.user(), &ids, now_ms).await {
            Ok(held) => files.extend(held.into_iter().map(|file| (file.id.clone(), file))),
            Err(refusal) => return Ok(refusal.reply()),
        }
    }
    for file in events.iter_mut().flat_map(|event| &mut event.attachments) {
        if let Some(record) = files.get(&file.id) {
            *file = record.clone();
        }
    }
    let doc = Doc { events, calendars };
    if let Err(refused) = invites::check(cx, stored.as_ref(), &doc).await? {
        return Ok(refused);
    }
    let invited = inviting(&doc) || invited_before;
    match commit(&mut cx.storage.user(), current.rev, &doc).await? {
        Saved::Stored(rev) => {
            if invited {
                send_invitations(cx).await;
            }
            Ok(Response::json(200, &view(Some(&doc), rev)))
        }
        Saved::Conflict(now_stored) => {
            let stored = now_stored.doc.map(Doc::from);
            Ok(document::conflict(view(stored.as_ref(), now_stored.rev)))
        }
    }
}

/// Bring the person's invitations in line with the document just stored. A
/// failure leaves the save as it is; the next `GET /sent` finishes the work.
async fn send_invitations(cx: &mut ApiCtx<'_>) {
    let Some(account) = invites::inviter(cx) else {
        return;
    };
    if let Err(error) = invites::reconcile(cx, &account).await {
        ferrite_app::tracing::warn!(%error, "invitations left for the next read");
    }
}

/// Forget the document: store `null` under the next revision, and take back
/// every invitation it sent.
async fn delete_events(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let current = read(&mut cx.storage.user()).await?;
    let invited = current
        .doc
        .as_ref()
        .is_some_and(|doc| doc.events.iter().any(|event| !event.invitees.is_empty()));
    let saved =
        document::write::<Stored>(&mut cx.storage.user(), KEY, Some(current.rev), None).await?;
    let rev = match saved {
        Saved::Stored(rev) => rev,
        Saved::Conflict(_) => return Ok(Response::error(503, "the document kept changing")),
    };
    if invited {
        send_invitations(cx).await;
    }
    Ok(Response::json(
        200,
        &serde_json::json!({ "events": null, "calendars": model::default_calendars(), "rev": rev }),
    ))
}

/// What a `GET` of the preferences answers.
fn settings_view(settings: Option<&Settings>, rev: u64) -> serde_json::Value {
    serde_json::json!({ "settings": settings, "rev": rev })
}

async fn get_settings(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let current = document::read::<Settings>(&mut cx.storage.user(), SETTINGS_KEY).await?;
    let body = settings_view(current.doc.as_ref(), current.rev);
    Ok(document::for_session(body, cx.session))
}

async fn put_settings(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let body: SettingsBody = match cx.request.json() {
        Ok(body) => body,
        Err(response) => return Ok(response),
    };
    if let Some(refused) = document::other_session(body.session.as_deref(), cx.session) {
        return Ok(refused);
    }
    let settings = match model::validate_settings(body.settings) {
        Ok(settings) => settings,
        Err(message) => return Ok(Response::error(400, &message)),
    };
    let mut space = cx.storage.user();
    let saved =
        match document::write(&mut space, SETTINGS_KEY, Some(body.rev), Some(&settings)).await {
            Ok(saved) => saved,
            Err(error) => {
                // The write's outcome is unknown: the preferences as they are now say what happened.
                let now = document::read::<Settings>(&mut space, SETTINGS_KEY).await?;
                if now.rev == body.rev {
                    return Err(error);
                } else if now.doc.as_ref() == Some(&settings) {
                    Saved::Stored(now.rev)
                } else {
                    Saved::Conflict(now)
                }
            }
        };
    Ok(match saved {
        Saved::Stored(rev) => Response::json(200, &settings_view(Some(&settings), rev)),
        Saved::Conflict(now) => document::conflict(settings_view(now.doc.as_ref(), now.rev)),
    })
}

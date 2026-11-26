//! Automator's server half: workflows built from the desktop's actions, run
//! on the server with a real log when the person presses Run.
//!
//! * `GET /api/automator/actions`: `{"actions": [...]}`, the library: every
//!   action (`actions.rs`) and Run JavaScript.
//! * `GET /api/automator/workflows`: `{"library": {"workflows": [...],
//!   "tz"} | null, "rev", "session"}`.
//! * `PUT /api/automator/workflows` with `{"library": {...}, "rev"}`:
//!   replaces the workflows (`document.rs`: 409 with the current ones when
//!   `rev` is not the stored revision). A workflow's `kind` is one of
//!   `workflow::KINDS`.
//! * `GET /api/automator/versions/<id>`: `{"versions": [{"saved_ms",
//!   "workflow"}]}`, what the workflow was at its last
//!   [`runs::VERSIONS_KEPT`] saves, newest first.
//! * `POST /api/automator/run` with `{"workflow": {...}, "tz", "trigger"?}`:
//!   runs the workflow now, as the person, and answers its log
//!   (`workflow::RunLog`), whose steps carry every item; the log that is kept
//!   holds their preview. `trigger` is one of `workflow::TRIGGERS`, by default
//!   `manual`.
//! * `POST /api/automator/claim` with `{"key"}`: `{"claimed": bool}`, whether
//!   this is the first request to name a run the desktop's page starts by
//!   itself (`runs::claim`).
//! * `GET /api/automator/runs`: `{"runs": [...]}`, the last
//!   [`runs::RUNS_KEPT`] runs, newest first.
//! * `GET /api/automator/locations`: `{"locations": {workflow id: drive file
//!   id}, "rev", "session"}`, which file on the drive File > Move To… made each
//!   workflow's. `PUT` with `{"locations", "rev"}` replaces them (`document.rs`).
//!   They sit beside the library: whatever moves, the workflow itself stays
//!   there, which is what folder actions, alarms and Services start.
//!
//! A workflow's steps reach the person's data only through the apps' own
//! routes, as the person (`actions.rs`); nothing a workflow says can name
//! another person.

pub mod actions;
pub mod local_time;
pub mod runs;
pub mod workflow;

use std::collections::BTreeMap;

use ferrite_app::serde::Deserialize;
use ferrite_app::serde_json::{json, Value};

use crate::apps::document;
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};
use actions::Actor;
use workflow::{Library, Workflow};

pub const MODULE: AppModule = AppModule {
    name: "automator",
    title: "Automator",
    handle,
};

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

#[derive(Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct PutBody {
    library: Library,
    rev: u64,
    #[serde(default)]
    session: Option<String>,
}

#[derive(Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct RunBody {
    workflow: Workflow,
    #[serde(default)]
    tz: i64,
    #[serde(default)]
    trigger: Option<String>,
}

#[derive(Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct ClaimBody {
    key: String,
}

const LOCATIONS_KEY: &str = "workflow-locations";

/// A drive file id for each moved workflow's id.
type Locations = BTreeMap<String, String>;

#[derive(Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct LocationsBody {
    locations: Locations,
    rev: u64,
    #[serde(default)]
    session: Option<String>,
}

fn locations_reply(locations: Option<&Locations>, rev: u64) -> Value {
    json!({ "locations": locations.cloned().unwrap_or_default(), "rev": rev })
}

fn locations_fit(locations: &Locations) -> bool {
    let id_fits = |id: &String| (1..=document::MAX_KEY_BYTES).contains(&id.len());
    locations.len() <= workflow::MAX_WORKFLOWS
        && locations.iter().all(|(id, file)| id_fits(id) && id_fits(file))
}

fn reply(library: Option<&Library>, rev: u64) -> Value {
    json!({ "library": library, "rev": rev })
}

fn unavailable(error: std::io::Error) -> Response {
    ferrite_app::tracing::error!(%error, "automator storage failed");
    Response::error(503, "Automator's storage is unavailable; try again")
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    let session = cx.session;
    match (cx.request.method, cx.request.path) {
        ("GET", "/actions") => {
            let mut list = actions::describe().as_array().cloned().unwrap_or_default();
            list.push(workflow::run_javascript_info());
            Response::json(200, &json!({ "actions": list }))
        }
        (_, "/actions") => Response::method_not_allowed(),
        ("GET", "/workflows") => {
            match document::read::<Library>(&mut cx.storage.user(), runs::LIBRARY_KEY).await {
                Ok(current) => {
                    document::for_session(reply(current.doc.as_ref(), current.rev), session)
                }
                Err(error) => unavailable(error),
            }
        }
        ("PUT", "/workflows") => put(&mut cx).await,
        (_, "/workflows") => Response::method_not_allowed(),
        ("GET", path) if path.starts_with("/versions/") => {
            let id = &path["/versions/".len()..];
            match runs::versions(&mut cx.storage.user(), id).await {
                Ok(versions) => Response::json(200, &json!({ "versions": versions })),
                Err(error) => unavailable(error),
            }
        }
        ("POST", "/run") => run(&mut cx).await,
        (_, "/run") => Response::method_not_allowed(),
        ("POST", "/claim") => claim(&mut cx).await,
        (_, "/claim") => Response::method_not_allowed(),
        ("GET", "/runs") => match runs::runs(&mut cx.storage.user()).await {
            Ok(runs) => Response::json(200, &json!({ "runs": runs })),
            Err(error) => unavailable(error),
        },
        (_, "/runs") => Response::method_not_allowed(),
        ("GET", "/locations") => {
            match document::read::<Locations>(&mut cx.storage.user(), LOCATIONS_KEY).await {
                Ok(current) => document::for_session(
                    locations_reply(current.doc.as_ref(), current.rev),
                    session,
                ),
                Err(error) => unavailable(error),
            }
        }
        ("PUT", "/locations") => put_locations(&mut cx).await,
        (_, "/locations") => Response::method_not_allowed(),
        _ => Response::not_found(),
    }
}

async fn put(cx: &mut ApiCtx<'_>) -> Response {
    let body: PutBody = match cx.request.json() {
        Ok(body) => body,
        Err(reply) => return reply,
    };
    if let Some(refused) = document::other_session(body.session.as_deref(), cx.session) {
        return refused;
    }
    if let Err(message) = body.library.check() {
        return Response::error(400, &message);
    }
    let before = match document::read::<Library>(&mut cx.storage.user(), runs::LIBRARY_KEY).await {
        Ok(current) => current.doc,
        Err(error) => return unavailable(error),
    };
    let saved = match document::write(
        &mut cx.storage.user(),
        runs::LIBRARY_KEY,
        Some(body.rev),
        Some(&body.library),
    )
    .await
    {
        Ok(saved) => saved,
        Err(error) => return unavailable(error),
    };
    if matches!(saved, document::Saved::Stored(_)) {
        let now_ms = cx.now_ms;
        let kept = runs::record_versions(
            &mut cx.storage.user(),
            before.as_ref(),
            &body.library,
            now_ms,
        )
        .await;
        if let Err(error) = kept {
            ferrite_app::tracing::warn!(%error, "could not keep a workflow's version");
        }
    }
    document::answer(saved, Some(&body.library), reply)
}

async fn put_locations(cx: &mut ApiCtx<'_>) -> Response {
    let body: LocationsBody = match cx.request.json() {
        Ok(body) => body,
        Err(reply) => return reply,
    };
    if let Some(refused) = document::other_session(body.session.as_deref(), cx.session) {
        return refused;
    }
    if !locations_fit(&body.locations) {
        return Response::error(400, "too many locations, or an id that is too long");
    }
    match document::write(
        &mut cx.storage.user(),
        LOCATIONS_KEY,
        Some(body.rev),
        Some(&body.locations),
    )
    .await
    {
        Ok(saved) => document::answer(saved, Some(&body.locations), locations_reply),
        Err(error) => unavailable(error),
    }
}

async fn run(cx: &mut ApiCtx<'_>) -> Response {
    let body: RunBody = match cx.request.json() {
        Ok(body) => body,
        Err(reply) => return reply,
    };
    if let Err(message) = body.workflow.check() {
        return Response::error(400, &message);
    }
    let trigger = body.trigger.as_deref().unwrap_or("manual");
    if !workflow::TRIGGERS.contains(&trigger) {
        return Response::error(400, &format!("{trigger:?} is not what starts a workflow"));
    }
    let (ctx, session, now_ms) = (cx.ctx, cx.session, cx.now_ms);
    let tz = local_time::clamp_tz(body.tz);
    let log = {
        let mut actor = Actor::new(ctx, cx.storage.store(), session, now_ms, tz);
        workflow::run(&mut actor, &body.workflow, Vec::new(), trigger).await
    };
    if let Err(error) = runs::record_run(&mut cx.storage.user(), &log).await {
        ferrite_app::tracing::warn!(%error, "could not keep a workflow's log");
    }
    cx.log(
        crate::applog::Level::Default,
        "workflow",
        &format!(
            "ran a workflow of {} steps: {}",
            log.steps.len(),
            if log.ok { "completed" } else { "a step failed" }
        ),
    )
    .await;
    Response::json(200, &log)
}

async fn claim(cx: &mut ApiCtx<'_>) -> Response {
    let body: ClaimBody = match cx.request.json() {
        Ok(body) => body,
        Err(reply) => return reply,
    };
    if body.key.is_empty() || body.key.chars().count() > runs::MAX_CLAIM_CHARS {
        return Response::error(400, "a claim names a background run");
    }
    match runs::claim(&mut cx.storage.user(), &body.key).await {
        Ok(claimed) => Response::json(200, &json!({ "claimed": claimed })),
        Err(error) => unavailable(error),
    }
}

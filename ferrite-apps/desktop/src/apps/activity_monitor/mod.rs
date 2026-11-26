//! Activity Monitor's server half: how much and how fast the desktop's
//! Ferrite application is answering, from what it measures of itself.
//!
//! * `GET /api/activity-monitor/ferrite`: the Ferrite view. `{"generation",
//!   "instance", "application", "now_ms", "window_ms", "apps": [...],
//!   "total": {...}, "minutes": [...]}`. Each app, and `total` for all of
//!   them, is `{"name", "title", "requests", "per_second", "errors",
//!   "store_ops", "ops_per_request", "mean_ms", "p50_ms", "p95_ms"}` over the
//!   last five minutes ([`timing::summarize`]), from the minutes the router
//!   keeps in each module's request counter; `minutes` gives each minute of
//!   that window its requests and percentiles for a graph. `generation` is
//!   the deployment generation serving the request and `instance` the
//!   instance that answered it, as the platform names them. It reads the
//!   same one page of counters as `/requests`.
//! * `GET /api/activity-monitor/requests`: `{"counters": [...], "now_ms":
//!   t}`, the all-time request counts the router keeps (`src/applog.rs`), one
//!   counter per module that has answered a request and for the router's own
//!   `session` and `apps` endpoints, each with `name`, `title`, `requests`,
//!   `writes`, `errors` (answered 400 or more), `first_ms` and `last_ms`.
//!
//! The figures are the application's, for every person together; they name
//! modules and counts, never a person. Server time is measured by the router
//! ([`timing`]); Ferrite shows an application no processes, CPU, memory,
//! energy or disk figures, so none is reported. The window lists the
//! desktop's open applications and windows from the page itself, and
//! measures the network round trip from the browser.

use ferrite_app::serde_json;

use crate::applog;
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};
use crate::timing;

pub const MODULE: AppModule = AppModule {
    name: "activity-monitor",
    title: "Activity Monitor",
    handle,
};

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

/// The title of a counter's name.
pub fn title(name: &str) -> Option<&'static str> {
    match name {
        "session" => Some("Session"),
        "apps" => Some("App Registry"),
        _ => super::find(name).map(|module| module.title),
    }
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    match (cx.request.method, cx.request.path) {
        ("GET", "/requests") => {
            let now_ms = cx.now_ms;
            match counters(&mut cx).await {
                Ok(counters) => Response::json(
                    200,
                    &serde_json::json!({ "counters": counters, "now_ms": now_ms }),
                ),
                Err(error) => Response::error(
                    503,
                    &format!("the request counts could not be read: {error}"),
                ),
            }
        }
        ("GET", "/ferrite") => match applog::counts(cx.storage.store()).await {
            Ok(counts) => {
                let mut body = timing::summarize(&timing::counters(&counts), cx.now_ms, title);
                body["generation"] = cx.ctx.generation().into();
                body["instance"] = cx.ctx.instance().map(str::to_string).into();
                body["application"] = super::system::APPLICATION.into();
                body["now_ms"] = cx.now_ms.into();
                Response::json(200, &body)
            }
            Err(error) => Response::error(
                503,
                &format!("the request timings could not be read: {error}"),
            ),
        },
        (_, "/requests" | "/ferrite") => Response::method_not_allowed(),
        _ => Response::not_found(),
    }
}

/// Every counter of a name the router counts, with its title.
pub async fn counters(cx: &mut ApiCtx<'_>) -> std::io::Result<Vec<serde_json::Value>> {
    Ok(applog::counts(cx.storage.store())
        .await?
        .into_iter()
        .filter_map(|(name, counts)| {
            let title = title(&name)?;
            Some(serde_json::json!({
                "name": name,
                "title": title,
                "requests": counts.requests,
                "writes": counts.writes,
                "errors": counts.errors,
                "first_ms": counts.first_ms,
                "last_ms": counts.last_ms,
            }))
        })
        .collect())
}

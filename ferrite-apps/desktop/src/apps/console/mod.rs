//! Console's server half: the desktop application's own log
//! (`src/applog.rs`).
//!
//! * `GET /api/console/log[?limit=n]`: `{"entries": [...], "now_ms": t}`, the
//!   newest `n` entries (at most 500, the default), oldest first. Each entry
//!   has `id`, `at_ms`, `level`, `process`, `category` and `message`.
//!
//! The window reads it when it opens and again every two seconds while it is
//! open, and Reload reads it at once. This is the application's log only:
//! there is no system log, and other applications' logs are out of reach.

use ferrite_app::serde_json;

use crate::applog;
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};

pub const MODULE: AppModule = AppModule {
    name: "console",
    title: "Console",
    handle,
};

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    match (cx.request.method, cx.request.path) {
        ("GET", "/log") => {
            let limit = cx
                .request
                .query_param("limit")
                .and_then(|value| value.parse::<usize>().ok())
                .unwrap_or(applog::LOG_LIMIT);
            let now_ms = cx.now_ms;
            match applog::recent(cx.storage.store(), limit).await {
                Ok(entries) => Response::json(
                    200,
                    &serde_json::json!({ "entries": entries, "now_ms": now_ms }),
                ),
                Err(error) => Response::error(503, &format!("the log could not be read: {error}")),
            }
        }
        (_, "/log") => Response::method_not_allowed(),
        _ => Response::not_found(),
    }
}

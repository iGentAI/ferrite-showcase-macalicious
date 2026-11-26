//! System Information's server half: the application's facts, its modules
//! and its request counts, in one report.
//!
//! * `GET /api/system-information/report`: `facts` (as About This Mac's
//!   `GET /api/about-this-mac/facts`), `modules` (as `GET /api/apps` lists
//!   them) and `counters` (as `GET /api/activity-monitor/requests` lists
//!   them).
//!
//! The window adds what the browser itself reports (`navigator`, `screen`);
//! there is no hardware report.

use ferrite_app::serde_json;

use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};

pub const MODULE: AppModule = AppModule {
    name: "system-information",
    title: "System Information",
    handle,
};

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    match (cx.request.method, cx.request.path) {
        ("GET", "/report") => {
            let facts = match super::system::facts(&mut cx).await {
                Ok(facts) => facts,
                Err(error) => return Response::error(503, &format!("storage failed: {error}")),
            };
            let counters = match super::activity_monitor::counters(&mut cx).await {
                Ok(counters) => counters,
                Err(error) => return Response::error(503, &format!("storage failed: {error}")),
            };
            Response::json(
                200,
                &serde_json::json!({
                    "facts": facts,
                    "modules": super::describe()["apps"],
                    "counters": counters,
                }),
            )
        }
        (_, "/report") => Response::method_not_allowed(),
        _ => Response::not_found(),
    }
}

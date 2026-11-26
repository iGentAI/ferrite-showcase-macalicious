//! About This Mac's server half: the facts the application can know about
//! itself (`../system.rs`).
//!
//! * `GET /api/about-this-mac/facts`: `application`, `generation` (the
//!   deployment generation; 0 under `ferrite dev`, which deploys nothing),
//!   `instance` (`null` under `ferrite dev`), `build` (the site build it
//!   serves), `site_files`, `modules`, `now_ms` (the platform clock),
//!   `session_created_ms`, `storage`: the bytes and keys this session
//!   keeps in each module's space, and their sums, and `drive`: the person's
//!   Ferrite drive, its `quota`, `used` and `available` bytes and its
//!   `categories` (each `{id, name, bytes, files}`), as Storage Management
//!   reports it.
//!
//! There are no hardware facts: Ferrite shows an application none.

use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};

pub const MODULE: AppModule = AppModule {
    name: "about-this-mac",
    title: "About This Mac",
    handle,
};

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    match (cx.request.method, cx.request.path) {
        ("GET", "/facts") => match super::system::facts(&mut cx).await {
            Ok(facts) => Response::json(200, &facts),
            Err(error) => Response::error(503, &format!("storage failed: {error}")),
        },
        (_, "/facts") => Response::method_not_allowed(),
        _ => Response::not_found(),
    }
}

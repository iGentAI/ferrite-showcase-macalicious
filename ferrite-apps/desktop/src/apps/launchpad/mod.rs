//! Launchpad's server half: a session's order of the apps and the page it
//! was left on.
//!
//! Launchpad shows the apps of the desktop's catalogue (`../catalogue.rs`)
//! that the session has: those that come with the desktop and those got from
//! the App Store (`../app_store`). Dragging an app, or Option and an arrow
//! key, moves it; turning the page changes the page. Both are saved here.
//!
//! * `GET /api/launchpad/layout`: `{"order": [...], "page": n, "rev": r}`,
//!   or both `null` before the session has saved (Launchpad then shows the
//!   apps in the Dock's order, on the first page).
//! * `PUT /api/launchpad/layout` with `{"order": [...], "page": n, "rev":
//!   r}`, `r` the revision the page last had: replaces both, or 409 with the
//!   current layout (`document.rs`).
//! * `DELETE /api/launchpad/layout`: forgets both.
//!
//! `order` lists ids of the catalogue, each once; an app it leaves out
//! follows those it lists. `page` counts from 0 and is below [`MAX_PAGES`];
//! Launchpad shows its last page when the apps fill fewer.

use std::collections::BTreeSet;

use ferrite_app::{serde, serde_json};

use super::{catalogue, document};
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};

pub const MODULE: AppModule = AppModule {
    name: "launchpad",
    title: "Launchpad",
    handle,
};

/// One more than the highest page a layout may name.
pub const MAX_PAGES: u32 = 16;
const KEY: &str = "layout";

/// What the session keeps.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Layout {
    pub order: Vec<String>,
    pub page: u32,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Body {
    order: Vec<String>,
    page: u32,
    rev: u64,
    #[serde(default)]
    session: Option<String>,
}

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    let session = cx.session;
    let outcome = match (cx.request.method, cx.request.path) {
        ("GET", "/layout") => document::read(&mut cx.storage.user(), KEY)
            .await
            .map(|current| {
                document::for_session(reply(current.doc.as_ref(), current.rev), session)
            }),
        ("PUT", "/layout") => match cx.request.json::<Body>().map(|body| {
            let named = body.session;
            validate(Layout {
                order: body.order,
                page: body.page,
            })
            .map(|layout| (layout, body.rev, named))
        }) {
            Err(response) => Ok(response),
            Ok(Err(message)) => Ok(Response::error(400, &message)),
            Ok(Ok((layout, base, named))) => {
                match document::other_session(named.as_deref(), session) {
                    Some(refused) => Ok(refused),
                    None => document::write(&mut cx.storage.user(), KEY, Some(base), Some(&layout))
                        .await
                        .map(|saved| document::answer(saved, Some(&layout), reply)),
                }
            }
        },
        ("DELETE", "/layout") => document::write::<Layout>(&mut cx.storage.user(), KEY, None, None)
            .await
            .map(|saved| document::answer(saved, None, reply)),
        (_, "/layout") => Ok(Response::method_not_allowed()),
        _ => Ok(Response::not_found()),
    };
    outcome.unwrap_or_else(|error| Response::error(503, &format!("storage failed: {error}")))
}

/// What a `GET` answers.
fn reply(layout: Option<&Layout>, rev: u64) -> serde_json::Value {
    serde_json::json!({
        "order": layout.map(|l| &l.order),
        "page": layout.map(|l| l.page),
        "rev": rev,
    })
}

/// Check a submitted layout.
fn validate(layout: Layout) -> Result<Layout, String> {
    if layout.page >= MAX_PAGES {
        return Err(format!("the page is below {MAX_PAGES}"));
    }
    let mut seen = BTreeSet::new();
    for id in &layout.order {
        if catalogue::find(id).is_none() {
            return Err(format!("{id:?} is not an app of the catalogue"));
        }
        if !seen.insert(id.as_str()) {
            return Err(format!("{id:?} is listed twice"));
        }
    }
    Ok(layout)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn layout(ids: &[&str], page: u32) -> Layout {
        Layout {
            order: ids.iter().map(|id| id.to_string()).collect(),
            page,
        }
    }

    #[test]
    fn a_layout_names_apps_of_the_catalogue_once_on_a_page_in_range() {
        assert!(validate(layout(&[], 0)).is_ok());
        assert!(validate(layout(&["notes", "calculator", "books"], 1)).is_ok());
        assert!(validate(layout(&["notes", "notes"], 0)).is_err(), "twice");
        assert!(
            validate(layout(&["finder"], 0)).is_err(),
            "not in the catalogue"
        );
        assert!(
            validate(layout(&[], MAX_PAGES)).is_err(),
            "page out of range"
        );
        assert!(
            serde_json::from_str::<Layout>(r#"{"order":[],"page":-1}"#).is_err(),
            "a page is not negative"
        );
    }
}

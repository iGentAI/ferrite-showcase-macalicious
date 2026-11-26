//! Script Editor's server half: run JavaScript against the desktop's own
//! apps, and keep scripts in the person's drive.
//!
//! * `GET /api/script-editor/dictionary`: `{"actions": [...]}`, every action
//!   a script can call (`../automator/actions.rs`), for the Library window.
//! * `POST /api/script-editor/run` with `{"code": "...", "tz": <minutes east
//!   of UTC>}`: runs the script ([`engine`]) and answers `200` with
//!   `{outcome, result, logs, error?, calls, effects, rounds, ms}`. `429`
//!   when another script is running in this process (try again in a moment).
//! * `GET /api/script-editor/scripts`: `{"scripts": [{id, name, path, size,
//!   modified}]}`, the files in `Documents/Scripts` of the person's drive.
//! * `GET /api/script-editor/scripts/<file id>`: `{id, code}`.
//! * `POST /api/script-editor/scripts` with `{"name", "code", "replace"?}`:
//!   saves the script as `Documents/Scripts/<name>.js` (the folder is made
//!   when missing) through the drive's own upload routes, and answers `201`
//!   `{id, path}`. Without `replace`, a name in use gets the next free one.
//!
//! A script reaches exactly what its person could do in the apps' own
//! windows, through those apps' routes, and nothing else: [`engine`] says
//! how. Nothing of a script is stored here; saved scripts are the person's
//! files.

pub mod engine;

use ferrite_app::serde_json::{json, Value};

use crate::apps::automator::actions::{self, Actor};
use crate::apps::automator::local_time::clamp_tz;
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};

pub const MODULE: AppModule = AppModule {
    name: "script-editor",
    title: "Script Editor",
    handle,
};

/// Where saved scripts live in the drive.
pub const SCRIPTS_FOLDER: &str = "Documents/Scripts";

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(async move {
        let mut cx = cx;
        let method = cx.request.method;
        let path = cx.request.path;
        match (method, path) {
            ("GET", "/dictionary") => Response::json(
                200,
                &json!({ "actions": actions::describe(), "globals": GLOBALS }),
            ),
            (_, "/dictionary") => Response::method_not_allowed(),
            ("POST", "/run") => run(&mut cx).await,
            (_, "/run") => Response::method_not_allowed(),
            ("GET", "/scripts") => list(&mut cx).await,
            ("POST", "/scripts") => save(&mut cx).await,
            (_, "/scripts") => Response::method_not_allowed(),
            ("GET", _) if path.starts_with("/scripts/") => {
                open(&mut cx, &path["/scripts/".len()..]).await
            }
            (_, _) if path.starts_with("/scripts/") => Response::method_not_allowed(),
            _ => Response::not_found(),
        }
    })
}

/// The globals a script has, for the Library window.
const GLOBALS: &[&str] = &[
    "Desktop",
    "Notes",
    "Reminders",
    "Calendar",
    "Contacts",
    "Stickies",
    "Files",
    "Messages",
    "Appearance",
    "Application",
    "console",
    "input",
];

/// The browser's offset from UTC (`tz`, minutes east) of a body.
fn tz_of(body: &Value) -> i32 {
    clamp_tz(body["tz"].as_i64().unwrap_or(0))
}

fn action_error(error: actions::ActionError) -> Response {
    let status = match error.code {
        "not_found" => 404,
        "bad_args" => 400,
        "denied" => 403,
        "conflict" => 409,
        "unavailable" => 503,
        _ => 422,
    };
    Response::json(
        status,
        &json!({ "error": error.message, "code": error.code }),
    )
}

async fn run(cx: &mut ApiCtx<'_>) -> Response {
    let body: Value = match cx.request.json() {
        Ok(body) => body,
        Err(reply) => return reply,
    };
    let Some(code) = body["code"].as_str() else {
        return Response::error(400, "send the script as `code`");
    };
    if let Err(message) = engine::check(code) {
        return Response::error(400, &message);
    }
    let Some(_slot) = engine::Slot::wait().await else {
        return Response::error(429, "another script is running; try again in a moment")
            .add_header("retry-after", "1");
    };
    let (ctx, session, now_ms) = (cx.ctx, cx.session, cx.now_ms);
    let outcome = {
        let mut actor = Actor::new(ctx, cx.storage.store(), session, now_ms, tz_of(&body));
        engine::run(
            &mut actor,
            code,
            &Value::Null,
            engine::Reach::ActionsAndRoutes,
            engine::WALL_LIMIT,
        )
        .await
    };
    let calls = outcome.calls.len();
    cx.log(
        crate::applog::Level::Default,
        "script",
        &format!(
            "ran a script: {} with {calls} app calls in {} ms",
            outcome.outcome, outcome.ms
        ),
    )
    .await;
    Response::json(200, &outcome)
}

async fn list(cx: &mut ApiCtx<'_>) -> Response {
    let (ctx, session, now_ms) = (cx.ctx, cx.session, cx.now_ms);
    let mut actor = Actor::new(ctx, cx.storage.store(), session, now_ms, 0);
    match actor
        .run("files.list", &json!({ "folder": SCRIPTS_FOLDER }))
        .await
    {
        Ok(items) => {
            let scripts: Vec<Value> = items
                .as_array()
                .map(Vec::as_slice)
                .unwrap_or_default()
                .iter()
                .filter(|item| item["kind"] == "file")
                .map(|item| {
                    json!({
                        "id": item["id"], "name": item["name"], "path": item["path"],
                        "size": item["size"], "modified": item["modified"],
                    })
                })
                .collect();
            Response::json(200, &json!({ "scripts": scripts }))
        }
        // No Scripts folder yet: no scripts.
        Err(error) if error.code == "not_found" => Response::json(200, &json!({ "scripts": [] })),
        Err(error) => action_error(error),
    }
}

async fn open(cx: &mut ApiCtx<'_>, id: &str) -> Response {
    if id.is_empty()
        || id.len() > 128
        || !id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
    {
        return Response::not_found();
    }
    let (ctx, session, now_ms) = (cx.ctx, cx.session, cx.now_ms);
    let mut actor = Actor::new(ctx, cx.storage.store(), session, now_ms, 0);
    match actor.read_file_text(id).await {
        Ok(code) => Response::json(200, &json!({ "id": id, "code": code })),
        Err(error) => action_error(error),
    }
}

async fn save(cx: &mut ApiCtx<'_>) -> Response {
    let body: Value = match cx.request.json() {
        Ok(body) => body,
        Err(reply) => return reply,
    };
    let (Some(name), Some(code)) = (body["name"].as_str(), body["code"].as_str()) else {
        return Response::error(400, "send the script's `name` and `code`");
    };
    let name = name.trim();
    if name.is_empty()
        || name.len() > 200
        || name.contains('/')
        || name.chars().any(char::is_control)
    {
        return Response::error(400, "a script's name is 1 to 200 characters without '/'");
    }
    if code.len() > engine::MAX_CODE_BYTES {
        return Response::error(
            400,
            &format!("a script is at most {} bytes", engine::MAX_CODE_BYTES),
        );
    }
    let file = if name.to_lowercase().ends_with(".js") {
        name.to_string()
    } else {
        format!("{name}.js")
    };
    let replace = body["replace"].as_bool().unwrap_or(false);
    let (ctx, session, now_ms) = (cx.ctx, cx.session, cx.now_ms);
    let mut actor = Actor::new(ctx, cx.storage.store(), session, now_ms, 0);
    match actor
        .write_file(
            SCRIPTS_FOLDER,
            &file,
            code.as_bytes(),
            "text/javascript",
            replace,
        )
        .await
    {
        Ok((id, path)) => Response::json(201, &json!({ "id": id, "path": path })),
        Err(error) => action_error(error),
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn the_dictionary_lists_every_action() {
        let listed = super::actions::describe();
        assert_eq!(
            listed.as_array().unwrap().len(),
            super::actions::ACTIONS.len()
        );
        let _ = ferrite_app::serde_json::to_string(&listed).unwrap();
    }
}

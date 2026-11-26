//! Scripts: JavaScript on the bounded QuickJS engine (`src/qjs`, the
//! `qjs-engine` source package, running quickjs-ng on the vendored WebAssembly
//! interpreter), with the desktop's actions as its only host calls.
//!
//! The engine grants a script nothing. Every host call arrives at
//! [`policy`], and that function is the whole capability policy:
//!
//! | the script calls | answer |
//! |---|---|
//! | `Notes.make({...})`, `Desktop.action("notes.make", {...})` | the action, for the person who started the run ([`Actor::run`]) |
//! | `Desktop.request(app, method, path, body)` | that app's own route, for the same person, when the run allows it |
//! | `fetch`, `env.store(..)`, blobs, files | refused: there is no network, store or file system in a script |
//!
//! So a script reaches exactly what its person could do in the apps' own
//! windows, and nothing of anyone else's: whose data an action touches is
//! the run's session, which a script cannot name or change.
//!
//! Bounds, all checked by the engine: [`FUEL`] interpreter instructions
//! across every replay round, [`MAX_HOST_CALLS`] host calls, [`WALL_LIMIT`]
//! of the platform clock (host calls included), 64 MiB of guest memory and
//! [`MAX_OUTPUT_BYTES`] of output. The guest clock is fixed at the run's
//! start. Each host call re-runs the script from the top with the earlier
//! answers preloaded (the engine's deterministic replay), so every call
//! happens exactly once. At most [`MAX_CONCURRENT`] scripts run at once in
//! one process; another is refused with 429 rather than queued behind them.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use ferrite_app::serde::Serialize;
use ferrite_app::serde_json::{self, json, Value};

use crate::apps::automator::actions::{self, ActionError, Actor, Body};
use crate::qjs::engine::{execute_with_wall_limit, Program, Request, Response};
use crate::qjs::module::module_bytes;

/// The largest script.
pub const MAX_CODE_BYTES: usize = 32 * 1024;
/// Interpreter instructions one run may use, across all its rounds.
pub const FUEL: u64 = 400_000_000;
/// Host calls one run may make.
pub const MAX_HOST_CALLS: u32 = 24;
/// Bytes of output one round may write.
pub const MAX_OUTPUT_BYTES: usize = 64 * 1024;
/// Platform-clock time one run may take, host calls included: inside the
/// gateway's 8-second deadline with room for the reply.
pub const WALL_LIMIT: Duration = Duration::from_secs(5);
/// Scripts running at once in one process. Each holds up to 64 MiB of guest
/// memory and keeps one API worker busy.
pub const MAX_CONCURRENT: usize = 1;
/// How long a run waits for a place before it is refused.
pub const SLOT_WAIT_MS: u64 = 2_500;

static RUNNING: AtomicUsize = AtomicUsize::new(0);
static PROGRAM: OnceLock<Result<Program, String>> = OnceLock::new();

/// The embedded quickjs module, decoded once per process.
fn program() -> Result<&'static Program, String> {
    PROGRAM
        .get_or_init(|| Program::load(&module_bytes()))
        .as_ref()
        .map_err(|e| format!("the script engine did not load: {e}"))
}

/// One of the [`MAX_CONCURRENT`] places, given back when dropped.
pub struct Slot(());

impl Slot {
    /// A place to run a script, or `None` when every place is taken.
    pub fn take() -> Option<Slot> {
        let mut running = RUNNING.load(Ordering::SeqCst);
        while running < MAX_CONCURRENT {
            match RUNNING.compare_exchange(running, running + 1, Ordering::SeqCst, Ordering::SeqCst)
            {
                Ok(_) => return Some(Slot(())),
                Err(now) => running = now,
            }
        }
        None
    }

    /// A place, waiting up to [`SLOT_WAIT_MS`] for one to come free: a script
    /// runs for at most a few seconds, so a short wait spares the person a
    /// refusal.
    pub async fn wait() -> Option<Slot> {
        Slot::wait_up_to(SLOT_WAIT_MS).await
    }

    /// A place, waiting up to `limit_ms` (at most [`SLOT_WAIT_MS`]): a workflow
    /// waits no longer than its own time allows.
    pub async fn wait_up_to(limit_ms: u64) -> Option<Slot> {
        let limit_ms = limit_ms.min(SLOT_WAIT_MS);
        let mut waited = 0;
        loop {
            if let Some(slot) = Slot::take() {
                return Some(slot);
            }
            if waited >= limit_ms {
                return None;
            }
            ferrite_app::sleep_ms(50).await;
            waited += 50;
        }
    }
}

impl Drop for Slot {
    fn drop(&mut self) {
        RUNNING.fetch_sub(1, Ordering::SeqCst);
    }
}

/// The globals a script gets: `Desktop`, and one object per app (`Notes`,
/// `Reminders`, ...), each a thin wrapper over `ferrite.callTool`, so every
/// one of them goes through [`policy`].
pub fn prelude() -> String {
    let mut names: Vec<(&str, &str)> = actions::ACTIONS
        .iter()
        .filter_map(|action| action.name.split_once('.'))
        .collect();
    names.dedup();
    let table = serde_json::to_string(&names).unwrap_or_else(|_| "[]".into());
    format!(
        r#"
globalThis.Desktop = (function () {{
  const call = (name, args) => ferrite.callTool(name, args === undefined || args === null ? {{}} : args);
  const desktop = {{
    action: call,
    request: (app, method, path, body) =>
      ferrite.callTool("desktop.request", {{ app, method: method || "GET", path: path || "/", body: body === undefined ? null : body }}),
    open: (app, place) => call("app.open", place === undefined ? {{ app }} : {{ app, place }}),
  }};
  for (const [group, verb] of {table}) {{
    desktop[group] = desktop[group] || {{}};
    desktop[group][verb] = (args) => call(group + "." + verb, typeof args === "string" ? {{ text: args }} : args);
  }}
  return Object.freeze(desktop);
}})();
globalThis.Notes = Desktop.notes;
globalThis.Reminders = Desktop.reminders;
globalThis.Calendar = Desktop.calendar;
globalThis.Contacts = Desktop.contacts;
globalThis.Stickies = Desktop.stickies;
globalThis.Files = Desktop.files;
globalThis.Messages = Desktop.messages;
globalThis.Appearance = Desktop.appearance;
globalThis.Application = (name) => ({{ activate: () => Desktop.open(name), open: (place) => Desktop.open(name, place) }});
"#
    )
}

/// One host call, as the Result view lists it.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(crate = "ferrite_app::serde")]
pub struct CallRecord {
    /// The action, or `request <app> <method> <path>`.
    pub action: String,
    pub ok: bool,
    /// The refusal's code.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

/// What one run produced.
#[derive(Debug, Clone, Serialize)]
#[serde(crate = "ferrite_app::serde")]
pub struct ScriptRun {
    /// `completed`, `threw`, `fuel_exhausted`, `time_exhausted`,
    /// `too_many_host_calls` or `fault`.
    pub outcome: &'static str,
    /// The value the script returned (its last `return`).
    pub result: Value,
    /// What it logged with `console.log` and friends.
    pub logs: Vec<String>,
    /// The error, when it did not complete.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub calls: Vec<CallRecord>,
    /// What the page should do now (open an app, switch appearance).
    pub effects: Vec<Value>,
    pub rounds: u32,
    /// Platform-clock milliseconds the run took.
    pub ms: u64,
}

/// What a script may reach beyond the actions.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Reach {
    /// The actions and `Desktop.request` (Script Editor).
    ActionsAndRoutes,
    /// The actions alone (Automator's Run JavaScript step).
    Actions,
}

/// The answer to one host call.
async fn policy(
    actor: &mut Actor<'_>,
    request: &Request,
    reach: Reach,
) -> Result<Value, ActionError> {
    match request.op.as_str() {
        "tool" => {
            let name = request.args["name"].as_str().unwrap_or("");
            let args = &request.args["args"];
            if name == "desktop.request" {
                if reach != Reach::ActionsAndRoutes {
                    return Err(ActionError::new(
                        "denied",
                        "Desktop.request is for Script Editor; a workflow step uses actions",
                    ));
                }
                return desktop_request(actor, args).await;
            }
            if actions::info(name).is_none() {
                return Err(ActionError::new(
                    "unknown_action",
                    format!("there is no action named '{name}'; see Window > Library"),
                ));
            }
            actor.run(name, args).await
        }
        "fetch" => Err(ActionError::new(
            "denied",
            "scripts have no network; use the actions, such as Files.read",
        )),
        op if op.starts_with("store.") || op.starts_with("blob.") || op.starts_with("file.") => {
            Err(ActionError::new(
                "denied",
                "scripts have no store or file system of their own; use the actions",
            ))
        }
        other => Err(ActionError::new(
            "denied",
            format!("'{other}' is not a host operation"),
        )),
    }
}

/// `Desktop.request(app, method, path, body)`: an app's own route for the
/// run's person. The reply's status and body (JSON, or text).
async fn desktop_request(actor: &mut Actor<'_>, args: &Value) -> Result<Value, ActionError> {
    let app = args["app"].as_str().unwrap_or("");
    let method = args["method"]
        .as_str()
        .unwrap_or("GET")
        .to_ascii_uppercase();
    let path = args["path"].as_str().unwrap_or("/");
    let body = &args["body"];
    let body = if body.is_null() {
        Body::None
    } else {
        Body::Json(body)
    };
    let reply = actor.request(app, &method, path, body).await?;
    let body = if reply.json.is_null() && !reply.bytes.is_empty() {
        Value::String(
            String::from_utf8_lossy(&reply.bytes)
                .chars()
                .take(100_000)
                .collect(),
        )
    } else {
        reply.json
    };
    Ok(json!({ "status": reply.status, "body": body }))
}

fn outcome_of(exit_code: i32, stderr: &str) -> &'static str {
    match exit_code {
        0 => "completed",
        3 => "threw",
        108 => "too_many_host_calls",
        110 if stderr.contains("exceeded the fuel budget") => "fuel_exhausted",
        110 if stderr.contains("exceeded the wall-clock budget") => "time_exhausted",
        _ => "fault",
    }
}

/// The error line to show for a run that did not complete.
fn error_of(outcome: &str, stderr: &str) -> Option<String> {
    let first = |text: &str| text.lines().next().unwrap_or("").trim().to_string();
    match outcome {
        "completed" => None,
        "threw" => Some(first(stderr.trim_start_matches("UNCAUGHT: "))),
        "fuel_exhausted" => Some("The script ran too long and was stopped.".into()),
        "time_exhausted" => Some(format!(
            "The script took longer than {} seconds and was stopped.",
            WALL_LIMIT.as_secs()
        )),
        "too_many_host_calls" => Some(format!(
            "The script made more than {MAX_HOST_CALLS} calls to the apps and was stopped."
        )),
        _ => Some(first(stderr)),
    }
}

/// Check a script before it runs.
pub fn check(code: &str) -> Result<(), String> {
    if code.trim().is_empty() {
        return Err("there is no script to run".into());
    }
    if code.len() > MAX_CODE_BYTES {
        return Err(format!(
            "the script is {} bytes; the limit is {MAX_CODE_BYTES}",
            code.len()
        ));
    }
    Ok(())
}

/// Run `code` with `input` as the global `input`, its host calls answered
/// by [`policy`] for `actor`'s person, for at most `wall` (at most
/// [`WALL_LIMIT`]). The caller holds a [`Slot`].
pub async fn run(
    actor: &mut Actor<'_>,
    code: &str,
    input: &Value,
    reach: Reach,
    wall: Duration,
) -> ScriptRun {
    let wall = wall.min(WALL_LIMIT);
    let started = actor.ctx().now_ms();
    let failed = |message: String| ScriptRun {
        outcome: "fault",
        result: Value::Null,
        logs: Vec::new(),
        error: Some(message),
        calls: Vec::new(),
        effects: Vec::new(),
        rounds: 0,
        ms: 0,
    };
    if let Err(message) = check(code) {
        return failed(message);
    }
    let program = match program() {
        Ok(program) => program,
        Err(message) => return failed(message),
    };
    let input_json = serde_json::to_string(input).unwrap_or_else(|_| "null".into());
    let clock = actor.ctx().clock();
    let clock_ns = actor.now_ms.saturating_mul(1_000_000);
    let prelude = prelude();

    // The dispatch closure answers one call at a time; the actor is lent to
    // each call's future and handed back when it finishes.
    let calls: Arc<Mutex<Vec<CallRecord>>> = Arc::new(Mutex::new(Vec::new()));
    let lent: Arc<Mutex<Option<&mut Actor<'_>>>> = Arc::new(Mutex::new(Some(actor)));
    let result = {
        let calls = calls.clone();
        let lent = lent.clone();
        execute_with_wall_limit(
            program,
            &prelude,
            code,
            &input_json,
            false,
            clock_ns,
            MAX_HOST_CALLS,
            FUEL,
            MAX_OUTPUT_BYTES,
            &clock,
            wall,
            move |request: Request| {
                let calls = calls.clone();
                let lent = lent.clone();
                async move {
                    let borrowed = lent.lock().ok().and_then(|mut slot| slot.take());
                    let label = label_of(&request);
                    let answer = match borrowed {
                        Some(actor) => {
                            let answer = policy(actor, &request, reach).await;
                            if let Ok(mut slot) = lent.lock() {
                                *slot = Some(actor);
                            }
                            answer
                        }
                        None => Err(ActionError::new("unavailable", "the run has ended")),
                    };
                    if let Ok(mut held) = calls.lock() {
                        held.push(CallRecord {
                            action: label,
                            ok: answer.is_ok(),
                            code: answer.as_ref().err().map(|e| e.code.to_string()),
                            message: answer.as_ref().err().map(|e| e.message.clone()),
                        });
                    }
                    match answer {
                        Ok(value) => Response::Ok(value),
                        Err(error) => Response::Err {
                            code: error.code.to_string(),
                            message: error.message,
                        },
                    }
                }
            },
        )
        .await
    };
    let actor = lent.lock().ok().and_then(|mut slot| slot.take());
    let effects = actor
        .map(|actor| std::mem::take(&mut actor.effects))
        .unwrap_or_default();
    let calls = calls.lock().map(|held| held.clone()).unwrap_or_default();
    let outcome = outcome_of(result.exit_code, &result.stderr);
    let mut logs = result.logs;
    logs.truncate(500);
    ScriptRun {
        outcome,
        error: error_of(outcome, &result.stderr),
        result: if outcome == "completed" {
            result.output
        } else {
            Value::Null
        },
        logs,
        calls,
        effects,
        rounds: result.rounds,
        ms: clock.now_ms().saturating_sub(started),
    }
}

fn label_of(request: &Request) -> String {
    match request.op.as_str() {
        "tool" => {
            let name = request.args["name"].as_str().unwrap_or("");
            if name == "desktop.request" {
                let args = &request.args["args"];
                format!(
                    "request {} {} {}",
                    args["app"].as_str().unwrap_or(""),
                    args["method"].as_str().unwrap_or("GET"),
                    args["path"].as_str().unwrap_or("/")
                )
            } else {
                name.chars().take(80).collect()
            }
        }
        op => op.chars().take(40).collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_allowed_number_of_scripts_run_at_once() {
        let first = Slot::take().expect("a place");
        assert!(Slot::take().is_none(), "every place is taken");
        drop(first);
        assert!(Slot::take().is_some(), "a place is free again");
    }

    #[test]
    fn the_prelude_names_every_action() {
        let prelude = prelude();
        for action in actions::ACTIONS {
            let (group, verb) = action.name.split_once('.').unwrap();
            assert!(
                prelude.contains(&format!("[\"{group}\",\"{verb}\"]")),
                "{}",
                action.name
            );
        }
        assert!(check("").is_err());
        assert!(check(&"x".repeat(MAX_CODE_BYTES + 1)).is_err());
    }
}

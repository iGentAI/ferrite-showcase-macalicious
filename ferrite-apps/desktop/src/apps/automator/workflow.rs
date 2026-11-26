//! Automator's workflows: what one is, how it is checked, and how it runs.
//!
//! A workflow is a list of steps, each an action of the desktop
//! (`actions.rs`) or a Run JavaScript step, run in order: each step is given
//! the items the step before it produced (its `input`) and hands its own
//! items to the next. A step that fails stops the workflow, as in Automator,
//! and the run's log says which step and why.
//!
//! Six kinds are kept: `workflow`, which runs when the person presses Run, and
//! `quick-action`, `application`, `folder-action`, `calendar-alarm` and
//! `dictation-command`, which
//! the desktop's page starts (`demos/automator/automator-background.ts`) on
//! its own event, so only while the desktop is open: the server has no event
//! of its own for them, and a page step needs a page. A plug-in kind is refused.

use ferrite_app::serde::{Deserialize, Serialize};
use ferrite_app::serde_json::{self, json, Value};

use super::actions::{self, item_text, text_item, ActionError, Actor};
use super::local_time as lt;
use crate::apps::script_editor::engine;

/// The most workflows one person keeps.
pub const MAX_WORKFLOWS: usize = 50;
/// The most steps in one workflow: a person's [`MAX_WORKFLOWS`] workflows, each this long with
/// steps of ordinary settings, still fit in one stored document, which takes at most 200 KB.
pub const MAX_STEPS: usize = 32;
/// The largest JSON of one step's settings.
const MAX_PARAMS_BYTES: usize = 40 * 1024;
/// The longest name.
const MAX_NAME_CHARS: usize = 100;
/// The step that runs JavaScript, which is not an action of its own.
pub const RUN_JAVASCRIPT: &str = "javascript.run";

/// One step.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Step {
    /// An action's name, or [`RUN_JAVASCRIPT`].
    pub action: String,
    /// The action's settings (`{"code"}` for Run JavaScript).
    #[serde(default)]
    pub params: Value,
    /// A step that is switched off is passed over; its input goes on.
    #[serde(default = "yes", skip_serializing_if = "is_true")]
    pub enabled: bool,
    /// Whether the step is handed no items, whatever the step before it gave.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub ignore_input: bool,
}

fn yes() -> bool {
    true
}

fn is_true(value: &bool) -> bool {
    *value
}

/// One workflow.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Workflow {
    pub id: String,
    pub name: String,
    /// One of [`KINDS`].
    pub kind: String,
    pub steps: Vec<Step>,
    /// Kept as the window sends it; a workflow run by hand ignores it.
    #[serde(default = "yes")]
    pub enabled: bool,
    /// What a Quick Action takes: `files` when absent, `text` or `none`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub receives: Option<String>,
    /// The drive folder a Folder Action watches.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub folder: Option<String>,
}

/// The document types this desktop keeps.
pub const KINDS: &[&str] = &[
    "workflow",
    "quick-action",
    "application",
    "folder-action",
    "calendar-alarm",
    "dictation-command",
];
/// What can start a run, as its log says.
pub const TRIGGERS: &[&str] = &[
    "manual",
    "quick-action",
    "application",
    "folder-action",
    "calendar-alarm",
    "dictation-command",
];
/// The longest drive id a Folder Action names.
const MAX_FOLDER_CHARS: usize = 128;

/// What the person keeps: their workflows and the time zone of the browser
/// that saved them (minutes east of UTC).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Library {
    pub workflows: Vec<Workflow>,
    #[serde(default)]
    pub tz: i32,
}

fn is_id(text: &str) -> bool {
    (1..=64).contains(&text.len())
        && text
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

impl Workflow {
    pub fn check(&self) -> Result<(), String> {
        if !is_id(&self.id) {
            return Err(format!(
                "workflow id {:?} must be 1 to 64 letters, digits, '-' or '_'",
                self.id
            ));
        }
        let name = self.name.trim();
        if name.is_empty() || self.name.chars().count() > MAX_NAME_CHARS {
            return Err(format!(
                "a workflow needs a name of 1 to {MAX_NAME_CHARS} characters"
            ));
        }
        if self.steps.len() > MAX_STEPS {
            return Err(format!("a workflow has at most {MAX_STEPS} steps"));
        }
        for (n, step) in self.steps.iter().enumerate() {
            let n = n + 1;
            if step.action != RUN_JAVASCRIPT && actions::info(&step.action).is_none() {
                return Err(format!("step {n} names no action: {:?}", step.action));
            }
            if !(step.params.is_null() || step.params.is_object()) {
                return Err(format!("step {n}'s settings are an object"));
            }
            let size = serde_json::to_vec(&step.params).map_or(usize::MAX, |b| b.len());
            if size > MAX_PARAMS_BYTES {
                return Err(format!(
                    "step {n}'s settings are larger than {MAX_PARAMS_BYTES} bytes"
                ));
            }
            if step.params.get("input").is_some() {
                return Err(format!("step {n}: input comes from the step before it"));
            }
            if step.action == RUN_JAVASCRIPT {
                let code = step.params["code"].as_str().unwrap_or("");
                engine::check(code).map_err(|e| format!("step {n}: {e}"))?;
            }
        }
        if !KINDS.contains(&self.kind.as_str()) {
            return Err(format!(
                "kind {:?} is not one this desktop keeps",
                self.kind
            ));
        }
        if let Some(receives) = &self.receives {
            if self.kind != "quick-action"
                || !["files", "text", "none"].contains(&receives.as_str())
            {
                return Err("only a Quick Action receives files, text or nothing".into());
            }
        }
        if let Some(folder) = &self.folder {
            if self.kind != "folder-action"
                || folder.is_empty()
                || folder.chars().count() > MAX_FOLDER_CHARS
            {
                return Err("only a Folder Action names a folder".into());
            }
        }
        Ok(())
    }
}

impl Library {
    pub fn check(&self) -> Result<(), String> {
        if self.workflows.len() > MAX_WORKFLOWS {
            return Err(format!("at most {MAX_WORKFLOWS} workflows"));
        }
        let mut seen = std::collections::BTreeSet::new();
        for workflow in &self.workflows {
            workflow.check()?;
            if workflow.kind == "folder-action" && workflow.folder.is_none() {
                return Err(format!(
                    "the Folder Action “{}” needs a folder to watch",
                    workflow.name
                ));
            }
            if !seen.insert(workflow.id.as_str()) {
                return Err(format!("workflow id {:?} is used twice", workflow.id));
            }
        }
        if !(-lt::MAX_TZ_MINUTES..=lt::MAX_TZ_MINUTES).contains(&self.tz) {
            return Err("the time zone is out of range".into());
        }
        Ok(())
    }

    pub fn find(&self, id: &str) -> Option<&Workflow> {
        self.workflows.iter().find(|w| w.id == id)
    }
}

/// The library's describe of Run JavaScript, beside the actions.
pub fn run_javascript_info() -> Value {
    json!({
        "name": RUN_JAVASCRIPT,
        "title": "Run JavaScript",
        "app": "script-editor",
        "summary": "Runs JavaScript with the input as `input`; what it returns is the output. It can call the same actions as Script Editor.",
        "takes_input": true,
        "writes": true,
        "params": [{ "name": "code", "kind": "code", "required": true, "summary": "The script" }],
    })
}

/// One step of a run, as the log shows it.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
pub struct StepLog {
    pub action: String,
    pub title: String,
    /// `completed`, `failed` or `skipped` (switched off, or after a failure).
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    /// How many items it handed on.
    pub items: usize,
    /// The text of the first few.
    pub preview: Vec<String>,
    pub ms: u64,
    /// What a Run JavaScript step logged.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub logs: Vec<String>,
    /// Every item it handed on, in the reply to the run only: the kept log
    /// (`runs::record_run`) holds `preview`. Empty past [`MAX_WHOLE_BYTES`].
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub all: Vec<Value>,
}

/// One run.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
pub struct RunLog {
    pub id: String,
    pub workflow: String,
    pub name: String,
    /// One of [`TRIGGERS`].
    pub trigger: String,
    pub started: u64,
    pub ms: u64,
    pub ok: bool,
    pub steps: Vec<StepLog>,
    /// The text of the last step's items.
    pub output: Vec<String>,
    /// What the page should do (open an app, switch appearance); a run the
    /// page did not start shows them in its log instead.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub effects: Vec<Value>,
}

fn preview(items: &[Value]) -> Vec<String> {
    items
        .iter()
        .take(5)
        .map(|item| item_text(item).chars().take(200).collect())
        .collect()
}

fn title_of(action: &str) -> String {
    if action == RUN_JAVASCRIPT {
        return "Run JavaScript".into();
    }
    actions::info(action)
        .map_or(action, |a| a.title)
        .to_string()
}

/// The items a Run JavaScript step's returned value hands on.
fn items_of(value: Value) -> Vec<Value> {
    let wrap = |v: Value| match v {
        Value::Object(_) if v.get("text").is_some() => v,
        Value::String(text) => text_item(&text),
        Value::Null => text_item(""),
        other => text_item(&other.to_string()),
    };
    match value {
        Value::Array(items) => items
            .into_iter()
            .take(actions::MAX_ITEMS)
            .map(wrap)
            .collect(),
        Value::Null => Vec::new(),
        other => vec![wrap(other)],
    }
}

/// The longest a whole run takes, its steps included: inside the gateway's
/// 8-second deadline with room for the reply, so a run started from the
/// window always answers with its log. A step that would start with less
/// than [`MIN_STEP_MS`] left is not run.
pub const WORKFLOW_BUDGET_MS: u64 = 7_000;
/// Time a step needs at least to be started.
const MIN_STEP_MS: u64 = 300;
/// How many bytes of whole items one run's reply carries, well under the
/// platform's reply limit of about 4 MiB.
const MAX_WHOLE_BYTES: usize = 1024 * 1024;

/// `items` for the reply when they fit in what `left` allows, which they use up.
fn whole_items(items: &[Value], left: &mut usize) -> Vec<Value> {
    let size = serde_json::to_vec(items).map_or(usize::MAX, |bytes| bytes.len());
    if size > *left {
        return Vec::new();
    }
    *left -= size;
    items.to_vec()
}

/// Run `workflow` for `actor`'s person with `input` as the first step's
/// input, within [`WORKFLOW_BUDGET_MS`].
pub async fn run(
    actor: &mut Actor<'_>,
    workflow: &Workflow,
    input: Vec<Value>,
    trigger: &str,
) -> RunLog {
    let started = actor.now_ms;
    let clock = actor.ctx().clock();
    let began = clock.now_ms();
    let left = |clock: &ferrite_app::Clock| {
        WORKFLOW_BUDGET_MS.saturating_sub(clock.now_ms().saturating_sub(began))
    };
    let mut items = input;
    let mut steps = Vec::new();
    let mut ok = true;
    let mut whole_left = MAX_WHOLE_BYTES;
    for step in &workflow.steps {
        let title = title_of(&step.action);
        let out_of_time = ok && step.enabled && left(&clock) < MIN_STEP_MS;
        if !ok || !step.enabled || out_of_time {
            if out_of_time {
                ok = false;
            }
            steps.push(StepLog {
                action: step.action.clone(),
                title,
                status: "skipped".into(),
                message: out_of_time.then(|| "not run: the workflow ran out of time".to_string()),
                items: 0,
                preview: Vec::new(),
                ms: 0,
                logs: Vec::new(),
                all: Vec::new(),
            });
            continue;
        }
        let step_started = clock.now_ms();
        let mut logs = Vec::new();
        let given = if step.ignore_input {
            Vec::new()
        } else {
            items.clone()
        };
        let outcome: Result<Vec<Value>, ActionError> = if step.action == RUN_JAVASCRIPT {
            let code = step.params["code"].as_str().unwrap_or("");
            match engine::Slot::wait_up_to(left(&clock).saturating_sub(MIN_STEP_MS)).await {
                None => Err(ActionError::new(
                    "unavailable",
                    "another script is running; run the workflow again in a moment",
                )),
                Some(_slot) => {
                    let run = engine::run(
                        actor,
                        code,
                        &Value::Array(given),
                        engine::Reach::Actions,
                        std::time::Duration::from_millis(left(&clock)),
                    )
                    .await;
                    logs = run.logs.clone();
                    actor.effects.extend(run.effects.clone());
                    match run.error {
                        None => Ok(items_of(run.result)),
                        Some(error) => Err(ActionError::new("refused", error)),
                    }
                }
            }
        } else {
            let mut args = match &step.params {
                Value::Object(map) => map.clone(),
                _ => Default::default(),
            };
            args.insert("input".into(), Value::Array(given));
            // Cut off at the run's time: a step stopped there may have changed
            // something before it stopped, so it is reported as uncertain.
            match crate::apps::safari::within(
                left(&clock),
                actor.run(&step.action, &Value::Object(args)),
            )
            .await
            {
                Some(result) => result.map(|value| match value {
                    Value::Array(list) => list,
                    other => vec![other],
                }),
                None => Err(ActionError::new(
                    "unavailable",
                    "not finished in time: it may or may not have happened",
                )),
            }
        };
        let ms = clock.now_ms().saturating_sub(step_started);
        match outcome {
            Ok(next) => {
                steps.push(StepLog {
                    action: step.action.clone(),
                    title,
                    status: "completed".into(),
                    message: None,
                    items: next.len(),
                    preview: preview(&next),
                    ms,
                    logs,
                    all: whole_items(&next, &mut whole_left),
                });
                items = next;
            }
            Err(error) => {
                ok = false;
                steps.push(StepLog {
                    action: step.action.clone(),
                    title,
                    status: "failed".into(),
                    message: Some(error.message),
                    items: 0,
                    preview: Vec::new(),
                    ms,
                    logs,
                    all: Vec::new(),
                });
            }
        }
    }
    RunLog {
        id: actor.new_id("run"),
        workflow: workflow.id.clone(),
        name: workflow.name.clone(),
        trigger: trigger.into(),
        started,
        ms: clock.now_ms().saturating_sub(started),
        ok,
        steps,
        output: if ok { preview(&items) } else { Vec::new() },
        effects: std::mem::take(&mut actor.effects),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn workflow(kind: &str) -> Workflow {
        Workflow {
            id: "w1".into(),
            name: "Morning".into(),
            kind: kind.into(),
            steps: vec![Step {
                action: "calendar.events".into(),
                params: json!({}),
                enabled: true,
                ignore_input: false,
            }],
            enabled: true,
            receives: None,
            folder: None,
        }
    }

    #[test]
    fn the_kinds_are_kept_with_what_each_needs() {
        for kind in KINDS {
            assert!(workflow(kind).check().is_ok(), "{kind} is kept");
        }
        assert!(workflow("print-plugin").check().is_err());

        let mut quick = workflow("quick-action");
        quick.receives = Some("text".into());
        assert!(quick.check().is_ok());
        quick.receives = Some("mail".into());
        assert!(quick.check().is_err());
        let mut plain = workflow("workflow");
        plain.receives = Some("text".into());
        assert!(plain.check().is_err());

        let unwatched = Library {
            workflows: vec![workflow("folder-action")],
            tz: 0,
        };
        assert_eq!(
            unwatched.check(),
            Err("the Folder Action “Morning” needs a folder to watch".to_string()),
        );
        let mut watching = workflow("folder-action");
        watching.folder = Some("folder-1".into());
        let library = Library {
            workflows: vec![watching],
            tz: 0,
        };
        assert_eq!(library.check(), Ok(()));
        let mut misplaced = workflow("workflow");
        misplaced.folder = Some("folder-1".into());
        assert!(misplaced.check().is_err());
    }

    #[test]
    fn workflows_are_checked() {
        assert!(workflow("workflow").check().is_ok());
        assert!(workflow("script").check().is_err());
        let mut bad = workflow("workflow");
        bad.steps[0].action = "system.shutdown".into();
        assert!(bad.check().is_err());
        let mut bad = workflow("workflow");
        bad.steps[0].params = json!({ "input": ["forged"] });
        assert!(bad.check().is_err(), "input is never set by hand");
        let mut js = workflow("workflow");
        js.steps[0] = Step {
            action: RUN_JAVASCRIPT.into(),
            params: json!({ "code": "" }),
            enabled: true,
            ignore_input: false,
        };
        assert!(js.check().is_err(), "empty code");
        let library = Library {
            workflows: vec![workflow("workflow"), workflow("workflow")],
            tz: 0,
        };
        assert!(library.check().is_err(), "ids are unique");
    }

    fn long_workflow(id: usize, steps: usize) -> Workflow {
        Workflow {
            id: format!("w{id}"),
            steps: (0..steps)
                .map(|_| Step {
                    action: "calendar.events".into(),
                    params: json!({ "days": 7 }),
                    enabled: true,
                    ignore_input: false,
                })
                .collect(),
            ..workflow("workflow")
        }
    }

    #[test]
    fn a_workflow_may_be_as_long_as_a_full_library_can_store() {
        assert_eq!(MAX_STEPS, 32);
        assert_eq!(long_workflow(1, MAX_STEPS).check(), Ok(()));
        assert_eq!(
            long_workflow(1, MAX_STEPS + 1).check(),
            Err("a workflow has at most 32 steps".to_string()),
        );
        let library = Library {
            workflows: (0..MAX_WORKFLOWS)
                .map(|id| long_workflow(id, MAX_STEPS))
                .collect(),
            tz: 0,
        };
        assert_eq!(library.check(), Ok(()));
        let stored = serde_json::to_vec(&library).unwrap().len();
        assert!(stored < 200_000, "{stored} bytes");
    }

    #[test]
    fn a_step_keeps_ignore_input_only_when_it_is_on() {
        let stored: Step = ferrite_app::serde_json::from_value(
            json!({ "action": "calendar.events", "params": {} }),
        )
        .unwrap();
        assert!(
            !stored.ignore_input,
            "a step saved before the option takes its input"
        );
        let written = ferrite_app::serde_json::to_value(&stored).unwrap();
        assert!(written.get("ignore_input").is_none());
        let on = Step {
            ignore_input: true,
            ..stored
        };
        assert_eq!(
            ferrite_app::serde_json::to_value(&on).unwrap()["ignore_input"],
            true
        );
    }

    #[test]
    fn whole_items_stop_at_what_the_reply_allows() {
        let items = vec![json!({ "text": "one" }), json!({ "text": "two" })];
        let size = serde_json::to_vec(&items).unwrap().len();
        let mut left = size + 1;
        assert_eq!(whole_items(&items, &mut left), items);
        assert_eq!(left, 1);
        assert_eq!(whole_items(&items, &mut left), Vec::<Value>::new());
        assert_eq!(left, 1, "items that did not fit take nothing");
    }

    #[test]
    fn a_script_s_value_becomes_items() {
        assert_eq!(items_of(json!(["a", { "text": "b", "x": 1 }, 3])).len(), 3);
        assert_eq!(items_of(json!("one"))[0]["text"], "one");
        assert!(items_of(Value::Null).is_empty());
        assert_eq!(items_of(json!({ "a": 1 }))[0]["text"], "{\"a\":1}");
    }
}

//! Where Automator keeps a person's workflows, what they were at each save,
//! and the log of their runs.

use std::io;

use ferrite_app::serde::{Deserialize, Serialize};
use ferrite_app::serde_json::{self, json, Value};

use super::workflow::{Library, RunLog, Workflow};
use crate::module::Space;

/// Runs kept in the log.
pub const RUNS_KEPT: usize = 30;
/// The key of the person's workflows (a `document.rs` document).
pub const LIBRARY_KEY: &str = "workflows";
const RUNS_KEY: &str = "runs";
const CLAIMS_KEY: &str = "claims";
/// Background runs remembered, so that no page of the person starts one twice.
pub const CLAIMS_KEPT: usize = 500;
/// The longest name of a background run.
pub const MAX_CLAIM_CHARS: usize = 300;
/// Saves kept of one workflow.
pub const VERSIONS_KEPT: usize = 20;
/// The most bytes one workflow's versions take, under the store's 200 KB
/// value limit: the oldest go first.
const MAX_VERSIONS_BYTES: usize = 180_000;

/// One save of a workflow.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Version {
    pub saved_ms: u64,
    pub workflow: Workflow,
}

fn versions_key(id: &str) -> String {
    format!("versions/{id}")
}

/// `kept` with `version` in front, as JSON within the bound, oldest dropped;
/// `None` when the version alone is over it, and `kept` stays as it was.
fn with_version(mut kept: Vec<Version>, version: Version) -> Option<Vec<u8>> {
    kept.insert(0, version);
    kept.truncate(VERSIONS_KEPT);
    while !kept.is_empty() {
        let bytes = serde_json::to_vec(&kept).ok()?;
        if bytes.len() <= MAX_VERSIONS_BYTES {
            return Some(bytes);
        }
        kept.pop();
    }
    None
}

/// Keep a version of every workflow of `after` that differs from `before`,
/// and forget the versions of those `after` no longer has.
pub async fn record_versions(
    space: &mut Space<'_>,
    before: Option<&Library>,
    after: &Library,
    now_ms: u64,
) -> io::Result<()> {
    for workflow in &after.workflows {
        if before.and_then(|library| library.find(&workflow.id)) == Some(workflow) {
            continue;
        }
        let key = versions_key(&workflow.id);
        for _ in 0..4 {
            let current = space.get_versioned(&key).await?;
            let (kept, version) = match &current {
                Some((bytes, version)) => (
                    serde_json::from_slice(bytes).unwrap_or_default(),
                    Some(*version),
                ),
                None => (Vec::new(), None),
            };
            let saved = Version {
                saved_ms: now_ms,
                workflow: workflow.clone(),
            };
            let Some(bytes) = with_version(kept, saved) else {
                break;
            };
            if space.put_if_version(&key, &bytes, version).await? {
                break;
            }
        }
    }
    for workflow in before.map_or(&[][..], |library| &library.workflows) {
        if after.find(&workflow.id).is_none() {
            space.delete(&versions_key(&workflow.id)).await?;
        }
    }
    Ok(())
}

/// The versions of the workflow `id`, newest first.
pub async fn versions(space: &mut Space<'_>, id: &str) -> io::Result<Vec<Version>> {
    Ok(space
        .get_json::<Vec<Version>>(&versions_key(id))
        .await?
        .unwrap_or_default())
}

/// `run` as the log keeps it: without the whole items its reply carried.
fn kept_run(run: &RunLog) -> RunLog {
    let mut kept = run.clone();
    for step in &mut kept.steps {
        step.all.clear();
    }
    kept
}

/// Keep `run` at the head of the person's run log.
pub async fn record_run(space: &mut Space<'_>, run: &RunLog) -> io::Result<()> {
    let kept = serde_json::to_value(kept_run(run)).map_err(io::Error::other)?;
    for _ in 0..4 {
        let current = space.get_versioned(RUNS_KEY).await?;
        let (mut runs, version): (Vec<Value>, Option<u64>) = match &current {
            Some((bytes, version)) => (
                serde_json::from_slice(bytes).unwrap_or_default(),
                Some(*version),
            ),
            None => (Vec::new(), None),
        };
        runs.insert(0, kept.clone());
        runs.truncate(RUNS_KEPT);
        let bytes = serde_json::to_vec(&runs).map_err(io::Error::other)?;
        if space.put_if_version(RUNS_KEY, &bytes, version).await? {
            return Ok(());
        }
    }
    Err(io::Error::other("the run log kept changing"))
}

/// Whether `claims` took `key`, the newest first: `false` when it had been taken.
fn took(claims: &mut Vec<String>, key: &str) -> bool {
    if claims.iter().any(|each| each == key) {
        return false;
    }
    claims.insert(0, key.to_string());
    claims.truncate(CLAIMS_KEPT);
    true
}

/// Whether this request is the first to name the background run `key`: every
/// tab and browser of the person sees a file arrive or an alert come, and one
/// of them starts its workflow.
pub async fn claim(space: &mut Space<'_>, key: &str) -> io::Result<bool> {
    for _ in 0..4 {
        let current = space.get_versioned(CLAIMS_KEY).await?;
        let (mut claims, version): (Vec<String>, Option<u64>) = match &current {
            Some((bytes, version)) => (
                serde_json::from_slice(bytes).unwrap_or_default(),
                Some(*version),
            ),
            None => (Vec::new(), None),
        };
        if !took(&mut claims, key) {
            return Ok(false);
        }
        let bytes = serde_json::to_vec(&claims).map_err(io::Error::other)?;
        if space.put_if_version(CLAIMS_KEY, &bytes, version).await? {
            return Ok(true);
        }
    }
    Err(io::Error::other("the background runs kept changing"))
}

/// The person's run log, newest first.
pub async fn runs(space: &mut Space<'_>) -> io::Result<Value> {
    Ok(space
        .get_json::<Value>(RUNS_KEY)
        .await?
        .unwrap_or_else(|| json!([])))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::apps::automator::workflow::{Step, StepLog};

    fn version(at: u64, code: &str) -> Version {
        Version {
            saved_ms: at,
            workflow: Workflow {
                id: "w".into(),
                name: "W".into(),
                kind: "workflow".into(),
                steps: vec![Step {
                    action: "text.get".into(),
                    params: json!({ "text": code }),
                    enabled: true,
                    ignore_input: false,
                }],
                enabled: true,
                receives: None,
                folder: None,
            },
        }
    }

    #[test]
    fn a_claim_is_taken_once_and_the_oldest_are_forgotten() {
        let mut claims = Vec::new();
        assert!(took(&mut claims, "a"));
        assert!(!took(&mut claims, "a"));
        assert!(took(&mut claims, "b"));
        assert_eq!(claims, ["b", "a"]);
        for at in 0..CLAIMS_KEPT {
            took(&mut claims, &format!("k{at}"));
        }
        assert_eq!(claims.len(), CLAIMS_KEPT);
        assert!(took(&mut claims, "a"), "it was forgotten");
    }

    #[test]
    fn the_newest_version_comes_first_and_the_oldest_go() {
        let kept: Vec<_> = (0..VERSIONS_KEPT as u64)
            .map(|at| version(at, "a"))
            .collect();
        let bytes = with_version(kept, version(99, "b")).unwrap();
        let read: Vec<Version> = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(read.len(), VERSIONS_KEPT);
        assert_eq!(read[0].saved_ms, 99);
        assert_eq!(read[VERSIONS_KEPT - 1].saved_ms, VERSIONS_KEPT as u64 - 2);
    }

    #[test]
    fn versions_stay_within_the_store_s_limit() {
        let large = "x".repeat(100_000);
        let bytes = with_version(vec![version(1, &large)], version(2, &large)).unwrap();
        let read: Vec<Version> = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(read.iter().map(|v| v.saved_ms).collect::<Vec<_>>(), [2]);
        let huge = "x".repeat(MAX_VERSIONS_BYTES);
        assert_eq!(with_version(vec![], version(3, &huge)), None);
    }

    #[test]
    fn the_kept_log_holds_no_whole_items() {
        let run = RunLog {
            id: "r".into(),
            workflow: "w".into(),
            name: "W".into(),
            trigger: "manual".into(),
            started: 1,
            ms: 1,
            ok: true,
            steps: vec![StepLog {
                action: "text.get".into(),
                title: "Get Specified Text".into(),
                status: "completed".into(),
                message: None,
                items: 1,
                preview: vec!["one".into()],
                ms: 1,
                logs: Vec::new(),
                all: vec![json!({ "text": "one" })],
            }],
            output: vec!["one".into()],
            effects: Vec::new(),
        };
        let written = serde_json::to_value(kept_run(&run)).unwrap();
        assert_eq!(written["steps"][0].get("all"), None);
        assert_eq!(written["steps"][0]["preview"][0], "one");
        assert_eq!(
            serde_json::to_value(&run).unwrap()["steps"][0]["all"][0]["text"],
            "one"
        );
    }
}

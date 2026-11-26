//! Siri's model provider: the interface every provider meets, and the one
//! provider built in, Anthropic's Messages API through a declared egress
//! destination.
//!
//! Siri answers what [`super::commands`] understands without any model. For
//! everything else it asks a model, when the deployment has one: the secret
//! [`ANTHROPIC_KEY_SECRET`] holds an Anthropic API key (set with `ferrite
//! secrets set`, delivered by a deploy), and `ferrite.json` declares the
//! egress handle [`EGRESS_HANDLE`] for [`ANTHROPIC_URL`]. The model may call
//! the desktop's actions as tools, which run for the person exactly as their
//! own requests would (`../automator/actions.rs`). Without the secret Siri
//! says that a model is not set up, and names what it can do instead.
//!
//! The gateway allows 8 seconds per request and egress 10 seconds per
//! exchange, so a question gets one model call, plus one more after its tool
//! calls, within [`MODEL_BUDGET_MS`] in all.

use std::future::Future;

use ferrite_app::serde_json::{self, json, Value};
use ferrite_app::{AppContext, EgressHeader, EgressHttpMethod, EgressOutcome};

use crate::apps::automator::actions::{self, item_text, Actor};
use crate::apps::automator::local_time as lt;

/// The secret holding an Anthropic API key.
pub const ANTHROPIC_KEY_SECRET: &str = "siri_anthropic_api_key";
/// The secret naming the model (optional).
pub const MODEL_SECRET: &str = "siri_model";
/// The model asked when [`MODEL_SECRET`] is not set.
pub const DEFAULT_MODEL: &str = "claude-haiku-4-5";
/// The egress handle `ferrite.json` declares for the provider.
pub const EGRESS_HANDLE: &str = "siri";
pub const ANTHROPIC_URL: &str = "https://api.anthropic.com/v1/messages";
/// The time every model call of one question may take together.
pub const MODEL_BUDGET_MS: u64 = 6_500;
/// Tool calls the model may make for one question.
const MAX_TOOL_CALLS: usize = 3;

/// A model provider Siri can ask.
pub struct Provider {
    /// The provider's name, as the status says it.
    pub name: &'static str,
    key: String,
    pub model: String,
}

impl std::fmt::Debug for Provider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Provider")
            .field("name", &self.name)
            .field("model", &self.model)
            .finish()
    }
}

impl Provider {
    /// The provider the deployment's secrets set up, if any.
    pub fn configured(ctx: &AppContext) -> Option<Provider> {
        let key = ctx.secret(ANTHROPIC_KEY_SECRET)?.trim().to_string();
        if key.is_empty() {
            return None;
        }
        let model = ctx
            .secret(MODEL_SECRET)
            .map(|m| m.trim().to_string())
            .filter(|m| !m.is_empty())
            .unwrap_or_else(|| DEFAULT_MODEL.to_string());
        Some(Provider {
            name: "Anthropic",
            key,
            model,
        })
    }
}

/// What the model said, and the items of the actions it ran.
pub struct ModelAnswer {
    pub text: String,
    pub items: Vec<Value>,
}

/// The tools the model is offered: every action, its parameters as strings.
pub fn tools() -> Value {
    actions::ACTIONS
        .iter()
        .map(|action| {
            let mut properties = serde_json::Map::new();
            for param in action.params {
                let kind = if param.kind == "boolean" {
                    "boolean"
                } else if param.kind == "number" {
                    "number"
                } else {
                    "string"
                };
                properties.insert(
                    param.name.into(),
                    json!({ "type": kind, "description": format!("{} ({})", param.summary, param.kind) }),
                );
            }
            let required: Vec<&str> = action.params.iter().filter(|p| p.required).map(|p| p.name).collect();
            json!({
                "name": action.name.replace('.', "_"),
                "description": action.summary,
                "input_schema": { "type": "object", "properties": properties, "required": required },
            })
        })
        .collect()
}

/// The system prompt: who Siri is, and the person's local time.
fn system(actor: &Actor<'_>) -> String {
    let now = lt::local(actor.now_ms as i64, actor.tz);
    let name = actor
        .session()
        .account
        .as_ref()
        .map(|a| a.full_name.clone())
        .unwrap_or_else(|| "the person".into());
    format!(
        "You are Siri on Macalicious, a macOS Catalina desktop that runs in the browser on Ferrite. \
         You are talking to {name}. It is {} local time ({}). Use the tools to act on their own notes, \
         reminders, calendar, contacts, stickies, files, messages and appearance, or to open an app. \
         Days are YYYY-MM-DD or words like tomorrow; times are like 17:00. \
         Answer in one or two short, friendly sentences, as Siri would.",
        lt::long_text(&now),
        lt::ymd(now.days),
    )
}

/// Run `work` for at most `ms` (Safari's helper, which boxes both futures:
/// the hosted code gate admits no `pin!`).
async fn within<F: Future>(ms: u64, work: F) -> Option<F::Output> {
    crate::apps::safari::within(ms, work).await
}

async fn call(
    ctx: &AppContext,
    provider: &Provider,
    body: &Value,
    ms: u64,
) -> Result<Value, String> {
    let mut egress = ctx
        .egress(EGRESS_HANDLE)
        .map_err(|e| format!("the deployment declares no '{EGRESS_HANDLE}' egress: {e}"))?;
    let headers = [
        EgressHeader {
            name: "x-api-key".into(),
            value: provider.key.clone(),
        },
        EgressHeader {
            name: "anthropic-version".into(),
            value: "2023-06-01".into(),
        },
        EgressHeader {
            name: "content-type".into(),
            value: "application/json".into(),
        },
    ];
    let bytes = serde_json::to_vec(body).map_err(|e| e.to_string())?;
    let exchange = egress.deliver_http(EgressHttpMethod::Post, ANTHROPIC_URL, &headers, &bytes);
    match within(ms, exchange).await {
        None => Err("the model did not answer in time".into()),
        Some(Ok(EgressOutcome::Delivered { status: 200, body })) => {
            serde_json::from_slice(&body).map_err(|_| "the model's answer was not JSON".into())
        }
        Some(Ok(EgressOutcome::Delivered { status, body })) => {
            let reason = serde_json::from_slice::<Value>(&body)
                .ok()
                .and_then(|v| v["error"]["message"].as_str().map(str::to_string))
                .unwrap_or_default();
            Err(
                format!("the model provider answered HTTP {status} {reason}")
                    .trim()
                    .to_string(),
            )
        }
        Some(Ok(EgressOutcome::Denied { reason })) => {
            Err(format!("egress refused the request: {reason}"))
        }
        Some(Err(error)) => Err(format!("the model provider could not be reached: {error}")),
    }
}

fn text_of(reply: &Value) -> String {
    reply["content"]
        .as_array()
        .map(Vec::as_slice)
        .unwrap_or_default()
        .iter()
        .filter(|block| block["type"] == "text")
        .filter_map(|block| block["text"].as_str())
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string()
}

/// Ask `provider` about `question`, letting it run actions for `actor`'s
/// person.
pub async fn ask(
    actor: &mut Actor<'_>,
    provider: &Provider,
    question: &str,
) -> Result<ModelAnswer, String> {
    let ctx = actor.ctx();
    let clock = ctx.clock();
    let started = clock.now_ms();
    let left = |clock: &ferrite_app::Clock| {
        MODEL_BUDGET_MS.saturating_sub(clock.now_ms().saturating_sub(started))
    };
    let mut messages = vec![json!({ "role": "user", "content": question })];
    let system_prompt = system(actor);
    let body = |messages: &Vec<Value>, may_use_tools: bool| {
        let mut body = json!({
            "model": provider.model, "max_tokens": 400, "system": system_prompt,
            "tools": tools(), "messages": messages,
        });
        if !may_use_tools {
            // The wording after the tools ran: no further tool call, so
            // nothing the model asks for goes undone.
            body["tool_choice"] = json!({ "type": "none" });
        }
        body
    };
    let first = call(ctx, provider, &body(&messages, true), left(&clock)).await?;
    let uses: Vec<Value> = first["content"]
        .as_array()
        .map(Vec::as_slice)
        .unwrap_or_default()
        .iter()
        .filter(|block| block["type"] == "tool_use")
        .cloned()
        .collect();
    if uses.is_empty() {
        return Ok(ModelAnswer {
            text: text_of(&first),
            items: Vec::new(),
        });
    }
    let mut results = Vec::new();
    let mut items = Vec::new();
    // What each tool came to, for an answer when the model's wording fails.
    let mut outcomes: Vec<(String, Result<(), String>)> = Vec::new();
    for (index, block) in uses.iter().enumerate() {
        let name = block["name"].as_str().unwrap_or("").replacen('_', ".", 1);
        // Every tool call gets a result, also those that are not run, so the
        // follow-up request names no call without its answer.
        let outcome = if index >= MAX_TOOL_CALLS {
            Err(format!(
                "not done: at most {MAX_TOOL_CALLS} actions per request"
            ))
        } else if left(&clock) < MIN_TOOL_TIME_MS {
            Err("not done: there was no time left for it".to_string())
        } else {
            match actions::info(&name) {
                // The room every person reads is no place for a message meant
                // for one person: the model sends one only when the person's
                // own request was addressed to everyone.
                Some(info)
                    if info.name == "messages.send"
                        && !super::commands::addresses_everyone(question) =>
                {
                    Err(format!("not done: {}", super::commands::MESSAGE_TO_SOMEONE))
                }
                // The action is bounded by what is left of the budget too. An
                // action cut off there may have changed something before it
                // stopped, so its result says it is uncertain, never done.
                Some(info) => {
                    match within(left(&clock), actor.run(info.name, &block["input"])).await {
                        Some(result) => result.map_err(|e| e.message),
                        None => Err(format!(
                            "not finished in time: it may or may not have happened; look in {}",
                            crate::apps::catalogue::CATALOGUE
                                .iter()
                                .find(|app| app.id == info.app)
                                .map_or("the app", |app| app.name)
                        )),
                    }
                }
                None => Err(format!("there is no tool named {name}")),
            }
        };
        let title = actions::info(&name).map_or(name.clone(), |info| info.title.to_string());
        let (content, is_error) = match &outcome {
            Ok(value) => {
                if let Value::Array(list) = value {
                    items.extend(list.iter().take(20).cloned());
                }
                (tool_content(value), false)
            }
            Err(message) => (message.clone(), true),
        };
        outcomes.push((title, outcome.map(|_| ())));
        results.push(json!({
            "type": "tool_result", "tool_use_id": block["id"], "content": content, "is_error": is_error,
        }));
    }
    messages.push(json!({ "role": "assistant", "content": first["content"] }));
    messages.push(json!({ "role": "user", "content": results }));
    let worded = if left(&clock) >= MIN_TOOL_TIME_MS {
        call(ctx, provider, &body(&messages, false), left(&clock))
            .await
            .ok()
            .map(|second| text_of(&second))
            .filter(|text| !text.is_empty())
    } else {
        None
    };
    let text = worded.unwrap_or_else(|| summary(&outcomes));
    Ok(ModelAnswer { text, items })
}

/// The most characters of an action's result given back to the model.
const MAX_TOOL_RESULT_CHARS: usize = 4_000;

/// An action's result as the model reads it: a plain line per item for a list,
/// then the result itself as JSON (ids and every field the answer may need),
/// cut at [`MAX_TOOL_RESULT_CHARS`] and saying so.
fn tool_content(value: &Value) -> String {
    let mut text = match value.as_array() {
        Some(list) => {
            let lines: Vec<String> = list.iter().take(30).map(item_text).collect();
            format!("Done. {} item(s): {}\n", list.len(), lines.join("; "))
        }
        None => "Done.\n".to_string(),
    };
    text.push_str("Result: ");
    text.push_str(&value.to_string());
    if text.chars().count() > MAX_TOOL_RESULT_CHARS {
        text = text.chars().take(MAX_TOOL_RESULT_CHARS).collect();
        text.push_str(" … (cut)");
    }
    text
}

/// Time a tool call or the final wording needs at least; with less left,
/// nothing more is started.
const MIN_TOOL_TIME_MS: u64 = 700;

/// What the actions came to, said plainly, when the model's wording did not
/// come: never "done" for an action that failed.
fn summary(outcomes: &[(String, Result<(), String>)]) -> String {
    let failed: Vec<String> = outcomes
        .iter()
        .filter_map(|(title, outcome)| outcome.as_ref().err().map(|why| format!("{title}: {why}")))
        .collect();
    let done: Vec<&str> = outcomes
        .iter()
        .filter(|(_, outcome)| outcome.is_ok())
        .map(|(title, _)| title.as_str())
        .collect();
    match (done.is_empty(), failed.is_empty()) {
        (_, true) => format!("Done: {}.", done.join(", ")),
        (true, false) => format!("Sorry, that didn’t work. {}.", failed.join("; ")),
        (false, false) => format!(
            "I did {}, but not everything: {}.",
            done.join(", "),
            failed.join("; ")
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_tool_result_carries_the_whole_value_within_a_bound() {
        let object = json!({ "id": "n-42", "title": "Groceries" });
        let text = tool_content(&object);
        assert!(text.contains("\"id\":\"n-42\""), "{text}");
        let list = json!([{ "text": "call Mom", "id": "r1" }]);
        let text = tool_content(&list);
        assert!(text.starts_with("Done. 1 item(s): call Mom"), "{text}");
        assert!(text.contains("\"id\":\"r1\""), "{text}");
        let long = json!("x".repeat(10_000));
        let text = tool_content(&long);
        assert!(text.chars().count() <= MAX_TOOL_RESULT_CHARS + 10);
        assert!(text.ends_with("(cut)"));
    }

    #[test]
    fn the_fallback_answer_never_calls_a_failure_done() {
        let ok = |t: &str| (t.to_string(), Ok(()));
        let bad = |t: &str, why: &str| (t.to_string(), Err(why.to_string()));
        assert_eq!(summary(&[ok("New Note")]), "Done: New Note.");
        assert_eq!(
            summary(&[bad("New Note", "no time")]),
            "Sorry, that didn’t work. New Note: no time."
        );
        assert!(summary(&[ok("New Note"), bad("Send Message", "refused")])
            .starts_with("I did New Note, but not everything"));
    }

    #[test]
    fn every_action_is_offered_as_a_tool_with_a_valid_name() {
        let tools = tools();
        let tools = tools.as_array().unwrap();
        assert_eq!(tools.len(), actions::ACTIONS.len());
        for tool in tools {
            let name = tool["name"].as_str().unwrap();
            assert!(
                name.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_'),
                "{name}"
            );
            let back = name.replacen('_', ".", 1);
            assert!(
                actions::info(&back).is_some(),
                "{name} maps back to an action"
            );
        }
    }

    #[test]
    fn a_provider_never_shows_its_key() {
        let provider = Provider {
            name: "Anthropic",
            key: "sk-secret".into(),
            model: DEFAULT_MODEL.into(),
        };
        assert!(!format!("{provider:?}").contains("sk-secret"));
    }
}

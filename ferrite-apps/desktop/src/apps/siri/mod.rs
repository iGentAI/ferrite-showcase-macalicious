//! Siri's server half: answers to typed or spoken requests, acted on with
//! the person's own data.
//!
//! * `GET /api/siri/status`: `{"model": bool, "provider", "needs"}`: whether
//!   a model provider is set up, and what it would take ([`model`]).
//! * `POST /api/siri/ask` with `{"text": "...", "tz": <minutes east of
//!   UTC>, "made"?: {"app", "id"}}`: `{"text", "card"?, "effects", "via",
//!   "understood", "made"}`. `text` is
//!   what Siri says; `card` is `{title, app, items: [{text}]}` to show under
//!   it; `effects` are for the page to carry out (`{"open": app}`,
//!   `{"appearance": mode}`); `via` is `commands` or `model`; `made` names the
//!   note, sticky, reminder or event the answer made, which the window keeps
//!   and sends back with "change it to 5" ([`change`]).
//!
//! Requests [`commands`] understands are answered without any model: open an
//! app, switch dark mode, make a note or sticky, add, list or complete
//! reminders, read or add calendar events, find contacts, list documents,
//! send a message, tell the time and date, and do sums. Anything else goes
//! to the model provider when the deployment has one ([`model`]); without
//! one a question of who or what something is goes to Wikipedia, through
//! Dictionary's egress, and anything else Siri says so and lists what it can do.
//!
//! Every action runs through the apps' own routes for the person asking
//! (`../automator/actions.rs`). Nothing of what is asked is logged. A
//! request sent with an `idempotency-key` header is answered once: its
//! answer is kept in the person's own space for [`ASK_MEMORY_MS`], and the
//! same request sent again with the same key gets that answer back without
//! acting again ([`claim_ask`]).

pub mod change;
pub mod commands;
pub mod model;

use ferrite_app::serde_json::{json, Value};
use ferrite_app::AppContext;

use crate::apps::automator::actions::{app_name, item_text, ActionError, Actor};
use crate::apps::automator::local_time::{self as lt, clamp_tz};
use crate::apps::dictionary;
use crate::apps::fetch::{self, Fetched};
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};
use commands::Intent;

pub const MODULE: AppModule = AppModule {
    name: "siri",
    title: "Siri",
    handle,
};

/// The longest request.
const MAX_TEXT_CHARS: usize = 1_000;
/// How long Wikipedia may take, in ms: Siri is waiting.
const ENCYCLOPEDIA_MS: u64 = 6_000;
/// The most of an article said aloud when its first sentence does not end sooner.
const SPOKEN_CHARS: usize = 300;
/// Items a card shows.
const CARD_ITEMS: usize = 8;

/// What Siri lists when asked what it can do.
pub const EXAMPLES: &[&str] = &[
    "Open Calculator",
    "What’s on my calendar today?",
    "Remind me to call Mom at 5 PM tomorrow",
    "Make a note that says Buy flowers",
    "Turn on dark mode",
    "Schedule Design review tomorrow at 10 AM",
    "What are my reminders?",
    "What time is it?",
];

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(async move {
        let mut cx = cx;
        match (cx.request.method, cx.request.path) {
            ("GET", "/status") => status(&cx),
            (_, "/status") => Response::method_not_allowed(),
            ("POST", "/ask") => ask(&mut cx).await,
            (_, "/ask") => Response::method_not_allowed(),
            _ => Response::not_found(),
        }
    })
}

fn status(cx: &ApiCtx<'_>) -> Response {
    let provider = model::Provider::configured(cx.ctx);
    Response::json(
        200,
        &json!({
            "model": provider.is_some(),
            "provider": provider.as_ref().map(|p| p.name),
            "model_name": provider.as_ref().map(|p| p.model.clone()),
            "needs": {
                "secret": model::ANTHROPIC_KEY_SECRET,
                "egress": model::ANTHROPIC_URL,
            },
            "examples": EXAMPLES,
        }),
    )
}

/// A card under the answer.
fn card(title: &str, app: &str, items: &[Value]) -> Value {
    let items: Vec<Value> = items
        .iter()
        .take(CARD_ITEMS)
        .map(|item| {
            let mut shown =
                json!({ "text": item_text(item).chars().take(200).collect::<String>() });
            if let Some(id) = item["id"].as_str() {
                shown["id"] = json!(id);
            }
            shown
        })
        .collect();
    json!({ "title": title, "app": app, "items": items })
}

fn count(n: usize, one: &str, many: &str) -> String {
    match n {
        0 => format!("no {many}"),
        1 => format!("1 {one}"),
        n => format!("{n} {many}"),
    }
}

/// "today", "tomorrow" or "on October 16".
fn day_words(day: i64, today: i64) -> String {
    match day - today {
        0 => "today".into(),
        1 => "tomorrow".into(),
        -1 => "yesterday".into(),
        _ => {
            let local = lt::local(lt::utc_of(day, 12 * 60, 0), 0);
            let date = lt::date_text(&local);
            format!(
                "on {}",
                date.rsplit_once(',').map_or(date.as_str(), |(md, _)| md)
            )
        }
    }
}

/// The words for an action's result.
fn phrase(name: &str, args: &Value, items: &[Value], today: i64) -> (String, Option<Value>) {
    let first = items.first().map(item_text).unwrap_or_default();
    match name {
        "app.open" => (
            format!("Opening {}.", app_name(args["app"].as_str().unwrap_or(""))),
            None,
        ),
        "appearance.set" => {
            let mode = items.first().and_then(|i| i["mode"].as_str()).unwrap_or("");
            let text = match mode {
                "dark" => "Dark mode is on.",
                "light" => "Light mode is on.",
                _ => "OK, the appearance now follows your settings.",
            };
            (text.into(), None)
        }
        "notes.make" => (
            format!(
                "OK, I made a note: “{}”.",
                items
                    .first()
                    .and_then(|i| i["title"].as_str())
                    .unwrap_or(&first)
            ),
            Some(card("Notes", "notes", items)),
        ),
        "notes.list" => (
            format!("You have {}.", count(items.len(), "note", "notes")),
            Some(card(
                "Notes",
                "notes",
                &items
                    .iter()
                    .map(|i| json!({ "text": i["title"], "id": i["id"] }))
                    .collect::<Vec<_>>(),
            )),
        ),
        "stickies.add" => (
            "I put a sticky note on your desktop.".into(),
            Some(card("Stickies", "stickies", items)),
        ),
        "reminders.add" => {
            let reminder = items.first().cloned().unwrap_or(Value::Null);
            let mut when = String::new();
            if let Some(day) = reminder["due"].as_str().and_then(lt::parse_ymd) {
                when = format!(" {}", day_words(day, today));
                if let Some(minutes) = reminder["dueTime"].as_str().and_then(lt::parse_time) {
                    when.push_str(&format!(
                        " at {}",
                        lt::clock_text(minutes / 60, minutes % 60)
                    ));
                }
            }
            (
                format!("OK, I’ll remind you{when}: “{first}”."),
                Some(card("Reminders", "reminders", items)),
            )
        }
        "reminders.complete" => (
            format!("Marked “{first}” as done."),
            Some(card("Reminders", "reminders", items)),
        ),
        "reminders.list" => (
            format!(
                "You have {} to do.",
                count(items.len(), "reminder", "reminders")
            ),
            Some(card("Reminders", "reminders", items)),
        ),
        "calendar.events" => {
            let day = args["day"]
                .as_str()
                .and_then(lt::parse_ymd)
                .unwrap_or(today);
            let when = day_words(day, today);
            let text = if items.is_empty() {
                format!("Your calendar is clear {when}.")
            } else {
                format!("You have {} {when}.", count(items.len(), "event", "events"))
            };
            (text, Some(card("Calendar", "calendar", items)))
        }
        "calendar.add" => {
            let event = items.first().cloned().unwrap_or(Value::Null);
            let start = event["start"].as_i64().unwrap_or(0);
            let title = event["title"].as_str().unwrap_or("");
            let local_day = args["day"]
                .as_str()
                .and_then(lt::parse_ymd)
                .unwrap_or(today);
            let when = if event["allDay"] == true {
                day_words(local_day, today)
            } else {
                let minutes = args["time"].as_str().and_then(lt::parse_time).unwrap_or(0);
                let _ = start;
                format!(
                    "{} at {}",
                    day_words(local_day, today),
                    lt::clock_text(minutes / 60, minutes % 60)
                )
            };
            (
                format!("OK, I added “{title}” to your calendar {when}."),
                Some(card("Calendar", "calendar", items)),
            )
        }
        "contacts.find" => {
            let text = if items.is_empty() {
                format!(
                    "I couldn’t find “{}” in your contacts.",
                    args["query"].as_str().unwrap_or("")
                )
            } else {
                format!("I found {}.", count(items.len(), "contact", "contacts"))
            };
            let shown: Vec<Value> = items
                .iter()
                .map(|c| {
                    let mut parts = vec![c["name"].as_str().unwrap_or("").to_string()];
                    for field in ["phones", "emails"] {
                        if let Some(first) = c[field]
                            .as_array()
                            .and_then(|a| a.first())
                            .and_then(Value::as_str)
                        {
                            parts.push(first.to_string());
                        }
                    }
                    json!({ "text": parts.join(" · "), "id": c["id"] })
                })
                .collect();
            if let [only] = &items[..] {
                // One person: a card of their own, with every number and address.
                let lines: Vec<Value> = ["phones", "emails"]
                    .iter()
                    .filter_map(|field| only[*field].as_array())
                    .flatten()
                    .filter_map(Value::as_str)
                    .map(|value| json!({ "text": value, "id": only["id"] }))
                    .collect();
                let mut own = card("Contacts", "contacts", &lines);
                own["lead"] = only["name"].clone();
                return (text, Some(own));
            }
            (text, Some(card("Contacts", "contacts", &shown)))
        }
        "files.list" => (
            format!(
                "Your Documents folder has {}.",
                count(items.len(), "item", "items")
            ),
            Some(card(
                "Documents",
                "finder",
                &items
                    .iter()
                    .map(|i| json!({ "text": i["name"], "id": i["id"] }))
                    .collect::<Vec<_>>(),
            )),
        ),
        "messages.send" => (
            format!("Sent to everyone in Messages: “{first}”."),
            Some(card("Messages", "messages", items)),
        ),
        _ => ("Done.".into(), None),
    }
}

fn sorry(error: &ActionError) -> String {
    format!("Sorry, I couldn’t do that. {}", sentence(&error.message))
}

fn sentence(text: &str) -> String {
    let text = text.trim();
    let mut chars = text.chars();
    let mut out: String = match chars.next() {
        Some(first) => first.to_uppercase().chain(chars).collect(),
        None => String::new(),
    };
    if !out.ends_with(['.', '!', '?']) {
        out.push('.');
    }
    out
}

fn help_card() -> Value {
    json!({
        "title": "Some things you can ask",
        "app": "siri",
        "items": EXAMPLES.iter().map(|e| json!({ "text": e })).collect::<Vec<_>>(),
    })
}

/// The opening of an article, to say aloud: its first sentence, cut at about
/// [`SPOKEN_CHARS`] characters when it runs on.
fn first_sentence(extract: &str) -> String {
    let mut chars = extract.char_indices().peekable();
    while let Some((at, c)) = chars.next() {
        let ends = c == '.'
            && at >= 30
            && extract[at + 1..].starts_with(' ')
            && extract[at + 2..]
                .chars()
                .next()
                .is_some_and(char::is_uppercase);
        if ends {
            return extract[..=at].to_string();
        }
    }
    if extract.chars().count() <= SPOKEN_CHARS {
        return extract.to_string();
    }
    let cut: String = extract.chars().take(SPOKEN_CHARS).collect();
    format!("{}…", cut.trim_end())
}

/// What Wikipedia says of `subject`: the sentence to say and the card to show.
/// `None` when it has no such article, only a list of meanings, or cannot be
/// reached, so that Siri says what it says of any other question.
async fn encyclopedia(ctx: &AppContext, subject: &str) -> Option<(String, Value)> {
    let url = format!(
        "{}?action=query&format=json&formatversion=2&generator=search&gsrlimit=1&gsrsearch={}&prop=extracts%7Cinfo&inprop=url&exintro=1&explaintext=1",
        dictionary::WIKIPEDIA,
        fetch::encode(subject)
    );
    let fetched = fetch::get(
        ctx,
        dictionary::EGRESS,
        &url,
        "application/json",
        ENCYCLOPEDIA_MS,
    )
    .await;
    let Fetched::Body(body) = fetched else {
        return None;
    };
    let summary = dictionary::wikipedia_summary(&body).ok()??;
    let extract = summary["extract"].as_str()?;
    if extract.contains("may refer to") {
        return None;
    }
    let found = json!({
        "title": summary["title"],
        "app": "siri",
        "lead": extract,
        "detail": "From Wikipedia, CC BY-SA 4.0",
        "items": [],
    });
    Some((first_sentence(extract), found))
}

async fn ask(cx: &mut ApiCtx<'_>) -> Response {
    let body: Value = match cx.request.json() {
        Ok(body) => body,
        Err(reply) => return reply,
    };
    let Some(text) = body["text"].as_str() else {
        return Response::error(400, "send the request as `text`");
    };
    if text.chars().count() > MAX_TEXT_CHARS {
        return Response::error(
            400,
            &format!("a request is at most {MAX_TEXT_CHARS} characters"),
        );
    }
    let tz = clamp_tz(body["tz"].as_i64().unwrap_or(0));
    let (ctx, session, now_ms) = (cx.ctx, cx.session, cx.now_ms);
    // A retry of a request already answered gets that answer, not a second
    // run of its actions.
    let asked = match cx.request.idempotency_key {
        Some(key) => {
            let slot = ask_slot(key);
            let fingerprint = ask_fingerprint(text, tz);
            match claim_ask(&mut cx.storage.user(), &slot, &fingerprint, now_ms).await {
                Ok(Claimed::Fresh) => Some((slot, fingerprint)),
                Ok(Claimed::Answered(reply)) => return Response::json(200, &reply),
                Ok(Claimed::Busy) => {
                    return Response::error(
                        409,
                        "this request is being answered, or its answer was lost; ask again",
                    )
                    .add_header("retry-after", "1")
                }
                Ok(Claimed::OtherRequest) => {
                    return Response::error(
                        422,
                        "this idempotency key was already used for another request",
                    )
                }
                Err(error) => {
                    ferrite_app::tracing::warn!(%error, "Siri could not claim a request");
                    return Response::error(503, "Siri is unavailable; retry");
                }
            }
        }
        None => None,
    };
    let today = lt::local(now_ms as i64, tz).days;
    // "Change it to 5", about what the window says Siri last made.
    let changing = ferrite_app::serde_json::from_value::<change::Made>(body["made"].clone())
        .ok()
        .and_then(|made| Some((made, change::asked_to(text)?)));
    let intent = match changing {
        Some((made, to)) => Intent::Change { made, to },
        None => commands::understand(text, today),
    };
    let mut made = None;
    let mut actor = Actor::new(ctx, cx.storage.store(), session, now_ms, tz);
    let mut understood = true;
    let mut via = "commands";
    let (answer, card_value) = match intent {
        Intent::Change { made: thing, to } => {
            match change::change(&mut actor, &thing, &to, today, tz).await {
                Ok((said, item)) => {
                    made = Some(json!({ "app": thing.app, "id": thing.id }));
                    let name = app_name(&thing.app);
                    (said, Some(card(name, &thing.app, &[item])))
                }
                Err(why) => (format!("Sorry, I couldn’t change it. {why}"), None),
            }
        }
        Intent::Action { name, args } => match actor.run(name, &args).await {
            Ok(items) => {
                made = change::made_of(name, &items);
                phrase(
                    name,
                    &args,
                    items.as_array().map(Vec::as_slice).unwrap_or_default(),
                    today,
                )
            }
            Err(error) => (sorry(&error), None),
        },
        Intent::Show { name, args, .. } => match actor.run(name, &args).await {
            Ok(items) => phrase(
                name,
                &args,
                items.as_array().map(Vec::as_slice).unwrap_or_default(),
                today,
            ),
            Err(error) if error.code == "not_found" && name == "files.list" => {
                ("Your Documents folder is empty.".into(), None)
            }
            Err(error) => (sorry(&error), None),
        },
        Intent::Time => {
            let now = lt::local(now_ms as i64, tz);
            (
                format!("It’s {}.", lt::clock_text(now.hour, now.minute)),
                None,
            )
        }
        Intent::Date => {
            let now = lt::local(now_ms as i64, tz);
            let weekday = [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
            ][((now.days + 3).rem_euclid(7)) as usize];
            (
                format!("Today is {weekday}, {}.", lt::date_text(&now)),
                None,
            )
        }
        Intent::Sum { value, shown } => (
            format!("{shown} is {}.", commands::plain(value)),
            Some(
                json!({ "title": "Calculator", "app": "calculator", "items": [{ "text": format!("{shown} = {}", commands::plain(value)) }] }),
            ),
        ),
        Intent::Greeting => ("Hi. What can I help you with?".into(), Some(help_card())),
        Intent::Help => (
            "Here are some things you can ask me.".into(),
            Some(help_card()),
        ),
        Intent::NoSuchApp(name) => (format!("I couldn’t find an app called “{name}”."), None),
        Intent::Refuse(why) => (why, None),
        Intent::Unknown => match model::Provider::configured(ctx) {
            Some(provider) => {
                via = "model";
                match model::ask(&mut actor, &provider, &commands::clean(text)).await {
                    Ok(reply) => {
                        let card_value =
                            (!reply.items.is_empty()).then(|| card("Siri", "siri", &reply.items));
                        (
                            if reply.text.is_empty() {
                                "Sorry, I don’t have an answer to that.".into()
                            } else {
                                reply.text
                            },
                            card_value,
                        )
                    }
                    Err(error) => {
                        ferrite_app::tracing::warn!(%error, "Siri's model call failed");
                        (
                            format!(
                                "Sorry, I can’t reach my model right now. {}",
                                sentence(&error)
                            ),
                            None,
                        )
                    }
                }
            }
            None => {
                let known = match commands::knowledge_subject(text) {
                    Some(subject) => encyclopedia(ctx, &subject).await,
                    None => None,
                };
                match known {
                    Some((said, found)) => {
                        via = "encyclopedia";
                        (said, Some(found))
                    }
                    None => {
                        understood = false;
                        (
                            "I can’t answer that yet: open questions need a model provider, and none is set up on this desktop. Here’s what I can do.".into(),
                            Some(help_card()),
                        )
                    }
                }
            }
        },
    };
    let effects = std::mem::take(&mut actor.effects);
    drop(actor);
    cx.log(
        crate::applog::Level::Default,
        "request",
        &format!("answered a request ({via})"),
    )
    .await;
    let reply = json!({
        "text": answer,
        "card": card_value,
        "effects": effects,
        "via": via,
        "understood": understood,
        "made": made,
    });
    if let Some((slot, fingerprint)) = asked {
        let kept = json!({ "state": "answered", "request": fingerprint, "reply": reply });
        let stored = match ferrite_app::serde_json::to_vec(&kept) {
            Ok(bytes) => {
                cx.storage
                    .user()
                    .put_expiring(&slot, &bytes, now_ms + ASK_MEMORY_MS)
                    .await
            }
            Err(error) => Err(std::io::Error::other(error)),
        };
        if let Err(error) = stored {
            // The actions ran: answer all the same. The claim stays, so a
            // retry with this key is refused rather than run again.
            ferrite_app::tracing::warn!(%error, "Siri could not keep an answer");
        }
    }
    Response::json(200, &reply)
}

/// How long an answer is kept for a retry with the same key.
pub const ASK_MEMORY_MS: u64 = 10 * 60 * 1000;
/// How long a request being answered holds its key: as long as an answer is
/// kept. A request whose answer could not be kept, or whose server stopped
/// after acting, is then refused on a retry rather than run again: an action
/// is never repeated for one key. The page sends a new key for each request.
const ASK_CLAIM_MS: u64 = ASK_MEMORY_MS;

/// The key an idempotency key's answer is kept under: its digest, so any
/// visible characters the browser chose make a plain key.
fn ask_slot(key: &str) -> String {
    let digest = crate::crypto::sha256::sha256(key.as_bytes());
    format!("asked/{}", &crate::crypto::sha256::to_hex(&digest)[..32])
}

/// What makes two requests the same request.
fn ask_fingerprint(text: &str, tz: i32) -> String {
    let digest = crate::crypto::sha256::sha256(format!("{tz}\n{text}").as_bytes());
    crate::crypto::sha256::to_hex(&digest)[..32].to_string()
}

enum Claimed {
    /// Nobody has asked with this key: answer it.
    Fresh,
    /// The same request was answered: this is its answer.
    Answered(Value),
    /// The same request is being answered now.
    Busy,
    /// The key was used for a different request.
    OtherRequest,
}

/// Claim `slot` for the request `fingerprint`, or find what an earlier
/// request with the same key left there.
async fn claim_ask(
    space: &mut crate::module::Space<'_>,
    slot: &str,
    fingerprint: &str,
    now_ms: u64,
) -> std::io::Result<Claimed> {
    let pending = json!({ "state": "pending", "request": fingerprint });
    let bytes = ferrite_app::serde_json::to_vec(&pending).map_err(std::io::Error::other)?;
    if space
        .create_expiring(slot, &bytes, now_ms + ASK_CLAIM_MS)
        .await?
    {
        return Ok(Claimed::Fresh);
    }
    let Some(kept) = space.get_json::<Value>(slot).await? else {
        // Expired between the two calls: claim it again next time.
        return Ok(Claimed::Busy);
    };
    if kept["request"].as_str() != Some(fingerprint) {
        return Ok(Claimed::OtherRequest);
    }
    Ok(match kept["state"].as_str() {
        Some("answered") => Claimed::Answered(kept["reply"].clone()),
        _ => Claimed::Busy,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_article_is_said_by_its_first_sentence() {
        assert_eq!(
            first_sentence("Ada Lovelace was an English mathematician. She worked with Babbage."),
            "Ada Lovelace was an English mathematician."
        );
        assert_eq!(
            first_sentence("St. Ives is a town in Cornwall by the sea."),
            "St. Ives is a town in Cornwall by the sea."
        );
        let long = "a".repeat(400);
        assert_eq!(first_sentence(&long).chars().count(), SPOKEN_CHARS + 1);
    }

    #[test]
    fn days_are_said_in_words() {
        let today = lt::days_from_civil(2026, 10, 14);
        assert_eq!(day_words(today, today), "today");
        assert_eq!(day_words(today + 1, today), "tomorrow");
        assert_eq!(day_words(today + 2, today), "on October 16");
        assert_eq!(
            sentence("notes: at most 500 notes"),
            "Notes: at most 500 notes."
        );
    }

    #[test]
    fn results_are_phrased() {
        let today = lt::days_from_civil(2026, 10, 14);
        let (text, card) = phrase(
            "reminders.add",
            &json!({}),
            &[json!({ "text": "call Mom", "due": "2026-10-15", "dueTime": "17:00" })],
            today,
        );
        assert_eq!(text, "OK, I’ll remind you tomorrow at 5:00 PM: “call Mom”.");
        assert_eq!(card.unwrap()["app"], "reminders");
        let (text, _) = phrase(
            "calendar.events",
            &json!({ "day": "2026-10-14" }),
            &[],
            today,
        );
        assert_eq!(text, "Your calendar is clear today.");
        let (text, _) = phrase("app.open", &json!({ "app": "notes" }), &[], today);
        assert_eq!(text, "Opening Notes.");
    }
}

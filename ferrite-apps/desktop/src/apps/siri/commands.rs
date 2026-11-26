//! What Siri understands without a model: plain requests turned into the
//! desktop's actions (`../automator/actions.rs`), the time and date, and
//! sums. Pure functions of the words and today's date, so every rule is
//! tested here.

use ferrite_app::serde_json::{json, Value};

use crate::apps::automator::actions::app_id;
use crate::apps::automator::local_time as lt;

/// What a request asks for.
#[derive(Debug, Clone, PartialEq)]
pub enum Intent {
    /// Run an action with these arguments.
    Action {
        name: &'static str,
        args: Value,
    },
    /// Show what an application holds: an action whose items are read out and
    /// listed in a card, with a button that opens `app` (as Catalina's Siri
    /// answers "what's on my calendar" in its window, without leaving it).
    Show {
        name: &'static str,
        args: Value,
        app: &'static str,
    },
    Time,
    Date,
    /// A sum and how it was read (`12 × 7`).
    Sum {
        value: f64,
        shown: String,
    },
    Greeting,
    Help,
    /// "Open" of an application the desktop does not have.
    NoSuchApp(String),
    /// A request understood but not carried out, and why.
    Refuse(String),
    /// A follow-up that changes what Siri last made (`change.rs`).
    Change {
        made: super::change::Made,
        to: String,
    },
    /// Nothing the rules know.
    Unknown,
}

/// What an open question asks about, for the encyclopedia: "who was Ada Lovelace" asks about
/// Ada Lovelace. `None` for anything about the person or Siri, which no article answers.
pub fn knowledge_subject(text: &str) -> Option<String> {
    let text = clean(text);
    let lower = text.to_lowercase();
    let rest = [
        "who is ",
        "who's ",
        "who was ",
        "who were ",
        "who are ",
        "what is ",
        "what's ",
        "what was ",
        "what are ",
        "what were ",
        "where is ",
        "where's ",
        "tell me about ",
    ]
    .iter()
    .find_map(|start| lower.starts_with(start).then(|| &text[start.len()..]))?;
    let lower = rest.to_lowercase();
    let subject = ["a ", "an ", "the "]
        .iter()
        .find_map(|article| lower.starts_with(article).then(|| &rest[article.len()..]))
        .unwrap_or(rest)
        .trim();
    let first = subject.split(' ').next().unwrap_or("").to_lowercase();
    let about_us = [
        "my",
        "mine",
        "your",
        "yours",
        "our",
        "i",
        "me",
        "you",
        "we",
        "this",
        "that",
        "it",
        "he",
        "she",
        "they",
        "there",
        "up",
        "new",
        "going",
        "happening",
    ];
    (!subject.is_empty() && !about_us.contains(&first.as_str())).then(|| subject.to_string())
}

/// The request with its wake words, politeness and end punctuation taken
/// off, keeping the person's own capitals.
pub fn clean(text: &str) -> String {
    let mut text = text
        .trim()
        .trim_end_matches(['?', '!', '.', ' '])
        .trim()
        .to_string();
    for wake in ["hey siri", "ok siri", "siri"] {
        if text.to_ascii_lowercase().starts_with(wake) {
            text = text[wake.len()..]
                .trim_start_matches([',', ' ', ':'])
                .to_string();
        }
    }
    for polite in ["please ", "can you ", "could you ", "would you "] {
        if text.to_ascii_lowercase().starts_with(polite) {
            text = text[polite.len()..].to_string();
        }
    }
    let lower = text.to_ascii_lowercase();
    if let Some(stripped) = lower.strip_suffix(" please") {
        text.truncate(stripped.len());
    }
    text.trim()
        .trim_end_matches([',', '?', '!', '.'])
        .trim()
        .to_string()
}

/// `text` without the first of `prefixes` it starts with (any case), or
/// `None`. Keeps the person's capitals in what follows.
fn after<'t>(text: &'t str, prefixes: &[&str]) -> Option<&'t str> {
    let lower = text.to_ascii_lowercase();
    prefixes
        .iter()
        .find(|prefix| lower.starts_with(*prefix))
        .map(|prefix| text[prefix.len()..].trim())
}

/// Drop one leading filler word (`saying`, `that says`, `:`...).
fn content(text: &str) -> &str {
    after(
        text,
        &[
            "that says ",
            "saying ",
            "that ",
            "about ",
            "called ",
            "named ",
            "titled ",
            "to ",
            "for ",
            ": ",
            ":",
        ],
    )
    .unwrap_or(text)
    .trim()
}

/// Take a day and a time off the end of `text` ("call Mom at 5pm
/// tomorrow"): what is left, the day and the minutes past midnight.
pub fn take_when(text: &str, today: i64) -> (String, Option<i64>, Option<u32>) {
    let mut words: Vec<&str> = text.split_whitespace().collect();
    let (mut day, mut time) = (None, None);
    let mut tonight = false;
    let word = |w: &str| w.trim_matches([',', '.']).to_ascii_lowercase();
    loop {
        let n = words.len();
        if n == 0 {
            break;
        }
        let last = word(words[n - 1]);
        let is_day_word = matches!(last.as_str(), "today" | "tomorrow" | "tonight")
            || (last.ends_with("day") && lt::parse_day(&last, today).is_some());
        if day.is_none() && is_day_word {
            day = lt::parse_day(&last, today);
            tonight = last == "tonight";
            words.pop();
            if words.last().is_some_and(|w| word(w) == "on") {
                words.pop();
            }
            continue;
        }
        if time.is_none() && n >= 2 && word(words[n - 2]) == "at" {
            if let Some(minutes) = lt::parse_time(&last) {
                time = Some(minutes);
                words.truncate(n - 2);
                continue;
            }
        }
        if time.is_none() && n >= 3 && word(words[n - 3]) == "at" {
            if let Some(minutes) = lt::parse_time(&format!("{} {last}", word(words[n - 2]))) {
                time = Some(minutes);
                words.truncate(n - 3);
                continue;
            }
        }
        break;
    }
    // "Tonight" means 8 PM only when no time was said ("at 5pm tonight").
    if tonight && time.is_none() {
        time = Some(20 * 60);
    }
    (words.join(" "), day, time)
}

fn when_args(args: &mut Value, day: Option<i64>, time: Option<u32>, day_key: &str) {
    if let Some(day) = day {
        args[day_key] = json!(lt::ymd(day));
    }
    if let Some(minutes) = time {
        args["time"] = json!(lt::hhmm(minutes));
    }
}

/// The day a question names ("what's on my calendar tomorrow"), today when
/// none.
fn day_in(lower: &str, today: i64) -> i64 {
    lower
        .split_whitespace()
        .rev()
        .find_map(|w| {
            let w = w.trim_matches([',', '.', '?']);
            let named = matches!(w, "today" | "tomorrow" | "tonight" | "yesterday")
                || (w.ends_with("day") && w.len() > 5);
            if named {
                lt::parse_day(w, today)
            } else {
                None
            }
        })
        .unwrap_or(today)
}

fn has_any(lower: &str, words: &[&str]) -> bool {
    words.iter().any(|w| lower.contains(w))
}

/// What `text` asks for, on the local day `today`.
pub fn understand(text: &str, today: i64) -> Intent {
    let text = clean(text);
    let lower = text.to_ascii_lowercase();
    if lower.is_empty() {
        return Intent::Help;
    }

    // Greetings and help.
    if matches!(
        lower.as_str(),
        "hi" | "hello" | "hey" | "good morning" | "good afternoon" | "good evening"
    ) {
        return Intent::Greeting;
    }
    // Help only as the whole request, never as a command's content ("make a note saying what
    // can you do").
    if matches!(
        lower.as_str(),
        "help"
            | "what can you do"
            | "what can you do for me"
            | "what can i say"
            | "what can i ask"
            | "what can i ask you"
    ) {
        return Intent::Help;
    }

    // Appearance: only a request that is about the appearance as a whole
    // ("turn on dark mode"), never one that merely mentions it ("make a note
    // about dark mode").
    if let Some(mode) = appearance_of(&lower) {
        return Intent::Action {
            name: "appearance.set",
            args: json!({ "mode": mode }),
        };
    }

    // Commands come before questions: a request that starts as a command is
    // that command, whatever its content mentions ("make a note about my
    // calendar", "tell everyone what time it is").

    // Reminders.
    if let Some(rest) = after(
        &text,
        &[
            "remind me ",
            "add a reminder ",
            "set a reminder ",
            "create a reminder ",
            "new reminder ",
            "make a reminder ",
        ],
    ) {
        let (what, day, time) = take_when(content(rest), today);
        let what = content(&what).to_string();
        if !what.is_empty() {
            let mut args = json!({ "title": what });
            when_args(&mut args, day, time, "due");
            return Intent::Action {
                name: "reminders.add",
                args,
            };
        }
    }
    if let Some(rest) = after(&text, &["add "]) {
        let lower_rest = rest.to_ascii_lowercase();
        for tail in [
            " to my reminders",
            " to reminders",
            " to my to do list",
            " to my todo list",
        ] {
            if let Some(what) = lower_rest.strip_suffix(tail) {
                return Intent::Action {
                    name: "reminders.add",
                    args: json!({ "title": &rest[..what.len()] }),
                };
            }
        }
        for tail in [" to my calendar", " to the calendar", " to calendar"] {
            if let Some(found) = lower_rest.find(tail) {
                let what = format!("{} {}", &rest[..found], &rest[found + tail.len()..]);
                return event_intent(what.trim(), today);
            }
        }
    }
    if let Some(rest) = after(
        &text,
        &[
            "mark ",
            "check off ",
            "complete ",
            "i finished ",
            "i've done ",
        ],
    ) {
        let lower_rest = rest.to_ascii_lowercase();
        let cut = [" as done", " as complete", " as completed", " done", " off"]
            .iter()
            .find_map(|tail| lower_rest.strip_suffix(tail).map(str::len))
            .unwrap_or(rest.len());
        let what = rest[..cut].trim();
        if !what.is_empty() {
            return Intent::Action {
                name: "reminders.complete",
                args: json!({ "title": what }),
            };
        }
    }

    // Calendar.
    if let Some(rest) = after(
        &text,
        &[
            "add an event ",
            "add event ",
            "create an event ",
            "create event ",
            "new event ",
            "schedule a meeting ",
            "schedule an event ",
            "schedule ",
            "put ",
        ],
    ) {
        let lower_rest = rest.to_ascii_lowercase();
        let what = [" on my calendar", " in my calendar", " on the calendar"]
            .iter()
            .find_map(|tail| {
                lower_rest
                    .find(tail)
                    .map(|at| format!("{} {}", &rest[..at], &rest[at + tail.len()..]))
            })
            .unwrap_or_else(|| rest.to_string());
        if lower.starts_with("put ") && what.len() == rest.len() {
            // "put" without a calendar is not an event.
        } else {
            return event_intent(what.trim(), today);
        }
    }

    // Notes and stickies.
    if let Some(rest) = after(&text, &["note to self ", "note to self: ", "note: "]) {
        return Intent::Action {
            name: "notes.make",
            args: json!({ "text": content(rest) }),
        };
    }
    if let Some(rest) = after(
        &text,
        &[
            "make a sticky note ",
            "create a sticky note ",
            "add a sticky note ",
            "new sticky note ",
            "make a sticky ",
            "add a sticky ",
            "sticky note ",
        ],
    ) {
        let what = content(rest);
        if !what.is_empty() {
            return Intent::Action {
                name: "stickies.add",
                args: json!({ "text": what }),
            };
        }
    }
    if let Some(rest) = after(
        &text,
        &[
            "take a note ",
            "make a note ",
            "create a note ",
            "write a note ",
            "add a note ",
            "new note ",
            "note ",
        ],
    ) {
        let what = content(rest);
        if !what.is_empty() {
            return Intent::Action {
                name: "notes.make",
                args: json!({ "text": what }),
            };
        }
    }

    // Messages: the room every person on the desktop reads. A message to
    // someone in particular is not sent at all, rather than shown to everyone.
    if let Some(rest) = after(
        &text,
        &[
            "send a message to everyone ",
            "send a message to the room ",
            "message everyone ",
            "tell everyone ",
            "text everyone ",
        ],
    ) {
        let what = content(rest);
        if !what.is_empty() {
            return Intent::Action {
                name: "messages.send",
                args: json!({ "text": what }),
            };
        }
    }
    if after(
        &text,
        &[
            "send a message",
            "send message",
            "send a text",
            "message ",
            "text ",
        ],
    )
    .is_some()
        || (lower.starts_with("tell ") && !lower.starts_with("tell me"))
    {
        return Intent::Refuse(MESSAGE_TO_SOMEONE.into());
    }

    // Contacts.
    if let Some(rest) = after(&text, &["find ", "look up ", "search for "]) {
        let lower_rest = rest.to_ascii_lowercase();
        for tail in [" in my contacts", " in contacts"] {
            if let Some(who) = lower_rest.strip_suffix(tail) {
                return Intent::Show {
                    name: "contacts.find",
                    args: json!({ "query": &rest[..who.len()] }),
                    app: "contacts",
                };
            }
        }
    }

    // Applications, by name after a verb that opens one ("open Calendar").
    if let Some(rest) = after(
        &text,
        &["open ", "launch ", "start ", "go to ", "switch to "],
    ) {
        let name = app_name(rest);
        if let Some(app) = app_id(name) {
            return Intent::Action {
                name: "app.open",
                args: json!({ "app": app }),
            };
        }
        if lower.starts_with("open ") || lower.starts_with("launch ") {
            return Intent::NoSuchApp(name.to_string());
        }
    }

    // Questions, once no command matched. The time and the date only as the
    // whole request.
    const TIME: &[&str] = &[
        "what time is it",
        "what's the time",
        "what is the time",
        "current time",
        "what's the current time",
        "what is the current time",
        "the time",
        "time",
        "tell me the time",
    ];
    const DATE: &[&str] = &[
        "what's the date",
        "what is the date",
        "what's the date today",
        "what is the date today",
        "what day is it",
        "what day is it today",
        "today's date",
        "what is today's date",
        "what's today's date",
        "what is today",
        "what's today",
        "the date",
        "date",
    ];
    let bare = lower
        .trim_end_matches(" now")
        .trim_end_matches(" right")
        .trim();
    if TIME.contains(&bare) {
        return Intent::Time;
    }
    if DATE.contains(&bare) {
        return Intent::Date;
    }
    if let Some(sum) = sum_of(&lower) {
        return sum;
    }
    if has_any(
        &lower,
        &[
            "my reminders",
            "what do i need to do",
            "my to do",
            "my todo",
            "what's on my list",
        ],
    ) {
        return Intent::Show {
            name: "reminders.list",
            args: json!({}),
            app: "reminders",
        };
    }
    if has_any(
        &lower,
        &[
            "calendar",
            "my events",
            "my schedule",
            "what do i have",
            "any meetings",
            "my meetings",
            "my day look",
        ],
    ) {
        let day = day_in(&lower, today);
        return Intent::Show {
            name: "calendar.events",
            args: json!({ "day": lt::ymd(day) }),
            app: "calendar",
        };
    }
    if has_any(&lower, &["my notes", "show notes", "read notes"]) {
        return Intent::Show {
            name: "notes.list",
            args: json!({}),
            app: "notes",
        };
    }
    if let Some(rest) = after(&text, &["what's ", "what is ", "show me ", "give me "]) {
        if let Some(at) = rest.find("'s ") {
            let field = rest[at + 3..].to_ascii_lowercase();
            if has_any(&field, &["phone", "number", "email", "address"]) {
                return Intent::Show {
                    name: "contacts.find",
                    args: json!({ "query": &rest[..at] }),
                    app: "contacts",
                };
            }
        }
    }

    // Files.
    if has_any(&lower, &["my files", "my documents", "documents folder"]) {
        return Intent::Show {
            name: "files.list",
            args: json!({ "folder": "Documents" }),
            app: "finder",
        };
    }

    // Applications, by name alone or after "show me".
    let name = app_name(after(&text, &["show me "]).unwrap_or(&text));
    if let Some(app) = app_id(name) {
        return Intent::Action {
            name: "app.open",
            args: json!({ "app": app }),
        };
    }
    Intent::Unknown
}

/// An application's name as a request says it ("the Notes app", "my notes").
fn app_name(text: &str) -> &str {
    let text = text.trim();
    let text = after(text, &["the ", "my "]).unwrap_or(text);
    let lower = text.to_ascii_lowercase();
    match lower.strip_suffix(" app") {
        Some(stripped) => text[..stripped.len()].trim(),
        None => text,
    }
}

/// Why Siri sends no message to one person.
pub const MESSAGE_TO_SOMEONE: &str = "I can only send messages to everyone in the Messages room, so I didn\u{2019}t send that. Say \u{201c}Tell everyone\u{201d} and the message.";

/// Whether a request is addressed to everyone in the Messages room, the one
/// place Siri sends messages: a model may send one only then. Only the
/// request's own opening counts ("tell everyone …", "post in the room …"),
/// never what the message says, so "send Bob a message saying everyone is
/// late" is a message for Bob, and refused.
pub fn addresses_everyone(text: &str) -> bool {
    const OPENINGS: &[&str] = &[
        "tell everyone ",
        "tell everybody ",
        "tell the room ",
        "message everyone ",
        "text everyone ",
        "send everyone ",
        "send a message to everyone ",
        "send a message to everybody ",
        "send a message to the room ",
        "send the room ",
        "let everyone know ",
        "let everybody know ",
        "post in the room ",
        "post to the room ",
        "post in messages ",
        "say to everyone ",
        "announce to everyone ",
        "announce to everybody ",
        "announce in the room ",
    ];
    let lower = format!("{} ", clean(text).to_ascii_lowercase());
    OPENINGS.iter().any(|opening| lower.starts_with(opening))
}

/// The appearance a request asks for, when the whole request is about the
/// appearance: an optional verb ("turn on", "switch to", "make it"...) and a
/// mode ("dark mode", "light", "auto", "the appearance").
fn appearance_of(lower: &str) -> Option<&'static str> {
    const VERBS: &[&str] = &[
        "turn on ",
        "turn off ",
        "switch on ",
        "switch off ",
        "switch to ",
        "change to ",
        "change the appearance to ",
        "set the appearance to ",
        "set appearance to ",
        "enable ",
        "disable ",
        "toggle ",
        "make it ",
        "use ",
        "go ",
        "turn ",
        "switch ",
        "change ",
        "set ",
    ];
    let (verb, rest) = VERBS
        .iter()
        .find_map(|verb| lower.strip_prefix(verb).map(|rest| (*verb, rest)))
        .unwrap_or(("", lower));
    let mut rest = rest.trim().trim_start_matches("the ").trim();
    let mut off = verb.contains("off") || verb == "disable ";
    for (tail, is_off) in [(" on", false), (" off", true)] {
        if let Some(stripped) = rest.strip_suffix(tail) {
            rest = stripped.trim();
            off |= is_off;
        }
    }
    let base = rest
        .strip_suffix(" mode")
        .or_else(|| rest.strip_suffix(" appearance"))
        .unwrap_or(rest);
    let named_mode = rest != base;
    let toggles = verb == "toggle ";
    match base {
        // "Toggle dark mode" switches whichever way the appearance is now.
        "dark" | "night" | "light" | "day" | "appearance" if toggles => Some("toggle"),
        // A bare "dark" needs a verb ("make it dark"); "dark mode" does not.
        "dark" | "night" if named_mode || !verb.is_empty() => {
            Some(if off { "light" } else { "dark" })
        }
        "light" | "day" if named_mode || !verb.is_empty() => {
            Some(if off { "dark" } else { "light" })
        }
        "auto" | "automatic" if named_mode || !verb.is_empty() => Some("auto"),
        "appearance" if verb == "toggle " || verb == "switch " || verb == "change " => {
            Some("toggle")
        }
        _ => None,
    }
}

fn event_intent(what: &str, today: i64) -> Intent {
    let (title, day, time) = take_when(content(what), today);
    let title = content(&title).to_string();
    let mut args = json!({ "title": if title.is_empty() { "Event".to_string() } else { title } });
    when_args(&mut args, day, time, "day");
    Intent::Action {
        name: "calendar.add",
        args,
    }
}

/// "what is 12 times 7", "calculate 3 + 4".
fn sum_of(lower: &str) -> Option<Intent> {
    let rest = after(
        lower,
        &[
            "what is ",
            "what's ",
            "calculate ",
            "compute ",
            "how much is ",
        ],
    )?;
    let words: Vec<&str> = rest.split_whitespace().collect();
    let at = words.iter().position(|word| {
        matches!(
            *word,
            "plus"
                | "+"
                | "minus"
                | "-"
                | "times"
                | "x"
                | "*"
                | "×"
                | "multiplied"
                | "divided"
                | "over"
                | "/"
                | "÷"
        )
    })?;
    let a = number_of(&words[..at])?;
    let (op, rest) = match &words[at..] {
        ["plus" | "+", rest @ ..] => ('+', rest),
        ["minus" | "-", rest @ ..] => ('-', rest),
        ["times" | "x" | "*" | "×", rest @ ..] => ('×', rest),
        ["multiplied", "by", rest @ ..] => ('×', rest),
        ["divided", "by", rest @ ..] | ["over" | "/" | "÷", rest @ ..] => ('÷', rest),
        _ => return None,
    };
    let b = number_of(rest)?;
    let value = match op {
        '+' => a + b,
        '-' => a - b,
        '×' => a * b,
        _ if b == 0.0 => return None,
        _ => a / b,
    };
    Some(Intent::Sum {
        value,
        shown: format!("{} {op} {}", plain(a), plain(b)),
    })
}

/// A number as digits ("1,200") or as it is said ("twenty-one", "three hundred and five").
fn number_of(words: &[&str]) -> Option<f64> {
    if let [word] = words {
        if let Ok(number) = word.replace(',', "").parse::<f64>() {
            return Some(number);
        }
    }
    let (mut total, mut part, mut any) = (0.0, 0.0, false);
    for word in words.iter().flat_map(|word| word.split('-')) {
        let unit = match word {
            "and" if any => continue,
            "zero" => 0,
            "one" | "a" => 1,
            "two" => 2,
            "three" => 3,
            "four" => 4,
            "five" => 5,
            "six" => 6,
            "seven" => 7,
            "eight" => 8,
            "nine" => 9,
            "ten" => 10,
            "eleven" => 11,
            "twelve" => 12,
            "thirteen" => 13,
            "fourteen" => 14,
            "fifteen" => 15,
            "sixteen" => 16,
            "seventeen" => 17,
            "eighteen" => 18,
            "nineteen" => 19,
            "twenty" => 20,
            "thirty" => 30,
            "forty" => 40,
            "fifty" => 50,
            "sixty" => 60,
            "seventy" => 70,
            "eighty" => 80,
            "ninety" => 90,
            "hundred" if any => {
                part *= 100.0;
                continue;
            }
            "thousand" if any => {
                total += part * 1000.0;
                part = 0.0;
                continue;
            }
            _ => return None,
        };
        part += f64::from(unit);
        any = true;
    }
    any.then_some(total + part)
}

/// A number as people write it: no `.0`, at most 6 decimals.
pub fn plain(value: f64) -> String {
    if value.fract() == 0.0 && value.abs() < 1e15 {
        format!("{}", value as i64)
    } else {
        let text = format!("{value:.6}");
        text.trim_end_matches('0').trim_end_matches('.').to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_open_question_names_what_the_encyclopedia_is_asked_about() {
        assert_eq!(
            knowledge_subject("Who was Ada Lovelace?").as_deref(),
            Some("Ada Lovelace")
        );
        assert_eq!(
            knowledge_subject("Hey Siri, what is a volcano").as_deref(),
            Some("volcano")
        );
        assert_eq!(
            knowledge_subject("tell me about the Eiffel Tower").as_deref(),
            Some("Eiffel Tower")
        );
        for about_us in [
            "what is my name",
            "who are you",
            "what's up",
            "what is",
            "sing me a song",
        ] {
            assert_eq!(knowledge_subject(about_us), None, "{about_us}");
        }
    }

    const TODAY: i64 = 20_740; // 2026-10-14, a Wednesday

    fn action(text: &str) -> (&'static str, Value) {
        match understand(text, TODAY) {
            Intent::Action { name, args } | Intent::Show { name, args, .. } => (name, args),
            other => panic!("{text:?} was read as {other:?}"),
        }
    }

    #[test]
    fn wake_words_and_politeness_are_dropped() {
        assert_eq!(clean("Hey Siri, open Notes please?"), "open Notes");
        assert_eq!(clean("Siri: can you open Calculator"), "open Calculator");
    }

    #[test]
    fn applications_open() {
        assert_eq!(
            action("Open Notes"),
            ("app.open", json!({ "app": "notes" }))
        );
        assert_eq!(
            action("launch system preferences"),
            ("app.open", json!({ "app": "system-preferences" }))
        );
        assert_eq!(action("Safari"), ("app.open", json!({ "app": "safari" })));
        assert_eq!(
            understand("open Photoshop", TODAY),
            Intent::NoSuchApp("Photoshop".into())
        );
    }

    #[test]
    fn reminders_keep_their_words_day_and_time() {
        assert_eq!(
            action("Remind me to call Mom at 5pm tomorrow"),
            (
                "reminders.add",
                json!({ "title": "call Mom", "due": "2026-10-15", "time": "17:00" })
            )
        );
        assert_eq!(
            action("remind me to water the plants on Friday"),
            (
                "reminders.add",
                json!({ "title": "water the plants", "due": "2026-10-16" })
            )
        );
        assert_eq!(
            action("remind me to buy milk"),
            ("reminders.add", json!({ "title": "buy milk" }))
        );
        assert_eq!(
            action("remind me to stretch at 3:30 pm"),
            (
                "reminders.add",
                json!({ "title": "stretch", "time": "15:30" })
            )
        );
        assert_eq!(
            action("add eggs to my reminders"),
            ("reminders.add", json!({ "title": "eggs" }))
        );
        assert_eq!(
            action("mark buy milk as done"),
            ("reminders.complete", json!({ "title": "buy milk" }))
        );
        assert_eq!(action("what are my reminders").0, "reminders.list");
    }

    #[test]
    fn notes_stickies_and_messages_take_the_rest() {
        assert_eq!(
            action("Make a note that says Buy flowers"),
            ("notes.make", json!({ "text": "Buy flowers" }))
        );
        assert_eq!(
            action("note to self: ship it"),
            ("notes.make", json!({ "text": "ship it" }))
        );
        assert_eq!(action("show my notes").0, "notes.list");
        assert_eq!(
            action("make a sticky note saying Call Ana"),
            ("stickies.add", json!({ "text": "Call Ana" }))
        );
        assert_eq!(
            action("tell everyone lunch is ready"),
            ("messages.send", json!({ "text": "lunch is ready" }))
        );
    }

    #[test]
    fn the_calendar_is_read_and_added_to() {
        assert_eq!(
            action("What's on my calendar today?"),
            ("calendar.events", json!({ "day": "2026-10-14" }))
        );
        assert_eq!(
            action("what do I have tomorrow"),
            ("calendar.events", json!({ "day": "2026-10-15" }))
        );
        assert_eq!(
            action("schedule a meeting called Design review tomorrow at 10am"),
            (
                "calendar.add",
                json!({ "title": "Design review", "day": "2026-10-15", "time": "10:00" })
            )
        );
        assert_eq!(
            action("add dentist to my calendar on Friday"),
            (
                "calendar.add",
                json!({ "title": "dentist", "day": "2026-10-16" })
            )
        );
    }

    #[test]
    fn only_a_request_about_the_appearance_changes_it() {
        assert_eq!(
            action("Make a note about dark mode"),
            ("notes.make", json!({ "text": "dark mode" }))
        );
        assert_eq!(
            action("turn dark mode off"),
            ("appearance.set", json!({ "mode": "light" }))
        );
        assert_eq!(
            action("dark mode"),
            ("appearance.set", json!({ "mode": "dark" }))
        );
        assert_eq!(
            action("make it dark"),
            ("appearance.set", json!({ "mode": "dark" }))
        );
        assert_eq!(
            action("toggle dark mode"),
            ("appearance.set", json!({ "mode": "toggle" }))
        );
        assert_eq!(
            action("toggle light mode"),
            ("appearance.set", json!({ "mode": "toggle" }))
        );
        assert_eq!(
            action("tell everyone that dark mode is on"),
            ("messages.send", json!({ "text": "dark mode is on" }))
        );
    }

    #[test]
    fn a_command_s_content_is_never_read_as_a_question() {
        assert_eq!(
            action("make a note saying what can you do"),
            ("notes.make", json!({ "text": "what can you do" }))
        );
        assert_eq!(understand("What can you do?", TODAY), Intent::Help);
        assert_eq!(
            action("make a note about my calendar"),
            ("notes.make", json!({ "text": "my calendar" }))
        );
        assert_eq!(
            action("tell everyone what time is it"),
            ("messages.send", json!({ "text": "what time is it" }))
        );
        assert_eq!(
            action("remind me to check my calendar"),
            ("reminders.add", json!({ "title": "check my calendar" }))
        );
        assert_eq!(
            action("Open Calendar"),
            ("app.open", json!({ "app": "calendar" }))
        );
        assert_eq!(
            action("open my notes"),
            ("app.open", json!({ "app": "notes" }))
        );
        assert_eq!(understand("what time is it now", TODAY), Intent::Time);
        assert_eq!(
            understand("what time is it in Tokyo", TODAY),
            Intent::Unknown
        );
    }

    #[test]
    fn tonight_gives_8_pm_only_when_no_time_is_said() {
        assert_eq!(
            action("Remind me to call Mom at 5pm tonight"),
            (
                "reminders.add",
                json!({ "title": "call Mom", "due": "2026-10-14", "time": "17:00" })
            )
        );
        assert_eq!(
            action("remind me to lock up tonight"),
            (
                "reminders.add",
                json!({ "title": "lock up", "due": "2026-10-14", "time": "20:00" })
            )
        );
    }

    #[test]
    fn only_a_request_for_everyone_may_send_to_the_room() {
        assert!(addresses_everyone("let everyone know lunch is ready"));
        assert!(addresses_everyone("post in the room that I'm late"));
        assert!(addresses_everyone(
            "Hey Siri, tell everyone the build is green"
        ));
        assert!(!addresses_everyone("send Bob a message saying hello"));
        assert!(!addresses_everyone("tell my roommate I'm home"));
        assert!(!addresses_everyone(
            "send Bob a message saying everyone is late"
        ));
        assert!(!addresses_everyone("text Alice that I am in the room"));
        assert!(!addresses_everyone(
            "announce to Alice that my password changed"
        ));
        assert!(addresses_everyone(
            "announce to everyone that lunch is here"
        ));
    }

    #[test]
    fn a_message_to_one_person_is_not_sent_to_everyone() {
        assert_eq!(
            understand("send a message to Alice saying hello", TODAY),
            Intent::Refuse(MESSAGE_TO_SOMEONE.into())
        );
        assert_eq!(
            understand("text Bob I'm late", TODAY),
            Intent::Refuse(MESSAGE_TO_SOMEONE.into())
        );
    }

    #[test]
    fn appearance_time_and_sums() {
        assert_eq!(
            action("turn on dark mode"),
            ("appearance.set", json!({ "mode": "dark" }))
        );
        assert_eq!(
            action("turn off dark mode"),
            ("appearance.set", json!({ "mode": "light" }))
        );
        assert_eq!(
            action("switch to light mode"),
            ("appearance.set", json!({ "mode": "light" }))
        );
        assert_eq!(understand("What time is it?", TODAY), Intent::Time);
        assert_eq!(understand("what's the date", TODAY), Intent::Date);
        assert_eq!(understand("what is today's date", TODAY), Intent::Date);
        assert_eq!(
            understand("what is 12 times 7", TODAY),
            Intent::Sum {
                value: 84.0,
                shown: "12 × 7".into()
            }
        );
        assert_eq!(
            understand("what's 10 divided by 4", TODAY),
            Intent::Sum {
                value: 2.5,
                shown: "10 ÷ 4".into()
            }
        );
        assert_eq!(plain(2.5), "2.5");
        assert_eq!(
            understand("what is the meaning of life", TODAY),
            Intent::Unknown
        );
    }

    #[test]
    fn sums_said_in_words_are_worked_out() {
        assert_eq!(
            understand("what is six times seven", 0),
            Intent::Sum {
                value: 42.0,
                shown: "6 × 7".to_string()
            }
        );
        assert_eq!(
            understand("what's twenty-one plus three hundred and five", 0),
            Intent::Sum {
                value: 326.0,
                shown: "21 + 305".to_string()
            }
        );
        assert_eq!(
            understand("what is two thousand divided by 8", 0),
            Intent::Sum {
                value: 250.0,
                shown: "2000 ÷ 8".to_string()
            }
        );
        assert!(!matches!(
            understand("what is love over time", 0),
            Intent::Sum { .. }
        ));
        assert!(!matches!(
            understand("what is the plus", 0),
            Intent::Sum { .. }
        ));
    }

    #[test]
    fn contacts_and_files() {
        assert_eq!(
            action("find Kate in my contacts"),
            ("contacts.find", json!({ "query": "Kate" }))
        );
        assert_eq!(
            action("what's John's phone number"),
            ("contacts.find", json!({ "query": "John" }))
        );
        assert_eq!(action("show me my documents").0, "files.list");
    }
}

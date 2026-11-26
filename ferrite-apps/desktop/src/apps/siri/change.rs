//! "Change it to 5": a follow-up that edits what Siri last made in the
//! conversation (the window keeps it and names it in the request). A time or
//! day moves a reminder or an event; any other words become its title, or the
//! text of a note or sticky.

use ferrite_app::serde;
use ferrite_app::serde_json::{json, Value};

use super::commands;
use crate::apps::automator::actions::{reminder_alerts, ActionError, Actor, Body};
use crate::apps::automator::local_time as lt;

/// What the window says Siri last made.
#[derive(serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Made {
    pub app: String,
    pub id: String,
}

/// A thing just made, as a reply names it, by the action that made it.
pub fn made_of(action: &str, items: &Value) -> Option<Value> {
    let app = match action {
        "notes.make" => "notes",
        "stickies.add" => "stickies",
        "reminders.add" => "reminders",
        "calendar.add" => "calendar",
        _ => return None,
    };
    let id = items.get(0)?.get("id")?.as_str()?;
    Some(json!({ "app": app, "id": id }))
}

/// What the request wants the thing changed to: "change it to 5", "make it
/// tomorrow", "move that to 3 PM". `None` for anything else.
pub fn asked_to(text: &str) -> Option<String> {
    let clean = commands::clean(text);
    let lower = clean.to_lowercase();
    let rest = ["change", "move", "make"].iter().find_map(|verb| {
        ["it", "that"].iter().find_map(|what| {
            let opening = format!("{verb} {what} ");
            lower.starts_with(&opening).then_some(opening.len())
        })
    })?;
    let after = clean.get(rest..)?.trim();
    let after = match after.get(..3) {
        Some(to) if to.eq_ignore_ascii_case("to ") => after[3..].trim(),
        _ => after,
    };
    (!after.is_empty()).then(|| after.to_string())
}

/// A day and a time the words are wholly about; `None` when they are other
/// words. A bare hour takes the side of noon of the time it replaces: "change
/// it to 5" of a 3 PM meeting is 5 PM.
fn when_of(to: &str, today: i64, was: Option<u32>) -> Option<(Option<i64>, Option<u32>)> {
    let (left, day, time) = commands::take_when(&format!("at {to}"), today);
    let (day, time) = if left.is_empty() && (day.is_some() || time.is_some()) {
        (day, time)
    } else {
        let (left, day, time) = commands::take_when(to, today);
        if !left.is_empty() || (day.is_none() && time.is_none()) {
            return None;
        }
        (day, time)
    };
    let lower = to.to_ascii_lowercase();
    let named_side = lower.contains("am") || lower.contains("pm") || lower.contains(':');
    let time = time.map(|minutes| match was {
        Some(was) if was >= 12 * 60 && minutes < 12 * 60 && !named_side => minutes + 12 * 60,
        _ => minutes,
    });
    Some((day, time))
}

/// Change `id` in the document of `app`. Answers what Siri says, and the item
/// its card shows.
fn apply(
    app: &str,
    doc: &mut Value,
    id: &str,
    to: &str,
    today: i64,
    tz: i32,
) -> Result<(String, Value), String> {
    let gone = || "I can’t find it any more.".to_string();
    let list = match app {
        "reminders" => doc["reminders"].as_array_mut(),
        "calendar" => doc.as_array_mut(),
        _ => doc["notes"].as_array_mut(),
    }
    .ok_or_else(gone)?;
    let thing = list
        .iter_mut()
        .find(|each| each["id"].as_str() == Some(id))
        .ok_or_else(gone)?;
    match app {
        "notes" => {
            let lines = thing["lines"].as_array_mut().ok_or_else(gone)?;
            match lines.first_mut() {
                Some(first) => *first = json!(to),
                None => lines.push(json!(to)),
            }
            Ok((
                format!("OK, the note now says “{to}”."),
                json!({ "text": to, "id": id }),
            ))
        }
        "stickies" => {
            thing["text"] = json!(to);
            Ok((
                format!("OK, the sticky note now says “{to}”."),
                json!({ "text": to, "id": id }),
            ))
        }
        "reminders" => {
            let was = thing["dueTime"].as_str().and_then(lt::parse_time);
            match when_of(to, today, was) {
                Some((day, time)) => {
                    let day = day
                        .or_else(|| thing["due"].as_str().and_then(lt::parse_ymd))
                        .unwrap_or(today);
                    thing["due"] = json!(lt::ymd(day));
                    if let Some(minutes) = time.or(was) {
                        thing["dueTime"] = json!(lt::hhmm(minutes));
                    }
                }
                None => thing["title"] = json!(to),
            }
            let title = thing["title"].as_str().unwrap_or("").to_string();
            let due = thing["due"].as_str().and_then(lt::parse_ymd);
            let at = thing["dueTime"].as_str().and_then(lt::parse_time);
            Ok((
                format!(
                    "OK, I changed the reminder{}: “{title}”.",
                    when_words(due, at, today)
                ),
                json!({ "text": title, "id": id }),
            ))
        }
        "calendar" => {
            let start = thing["start"].as_i64().ok_or_else(gone)?;
            let end = thing["end"].as_i64().unwrap_or(start);
            let all_day = thing["allDay"] == true;
            let local = lt::local(start, tz);
            let was = (!all_day).then_some(local.hour * 60 + local.minute);
            match when_of(to, today, was) {
                Some((day, time)) => {
                    let day = day.unwrap_or(local.days);
                    let length = end - start;
                    match time.or(was) {
                        Some(minutes) => {
                            let moved = lt::utc_of(day, minutes, tz);
                            let length = if all_day { 60 * 60_000 } else { length };
                            thing["start"] = json!(moved);
                            thing["end"] = json!(moved + length);
                            if let Some(fields) = thing.as_object_mut() {
                                fields.remove("allDay");
                            }
                        }
                        None => {
                            thing["start"] = json!(lt::utc_of(day, 0, tz));
                            thing["end"] = json!(lt::utc_of(day + 1, 0, tz));
                        }
                    }
                }
                None => thing["title"] = json!(to),
            }
            let title = thing["title"].as_str().unwrap_or("").to_string();
            let now = thing["start"].as_i64().map(|at| lt::local(at, tz));
            let at = (thing["allDay"] != true)
                .then(|| now.as_ref().map(|at| at.hour * 60 + at.minute))
                .flatten();
            Ok((
                format!(
                    "OK, “{title}” is now{}.",
                    when_words(now.as_ref().map(|at| at.days), at, today)
                ),
                json!({ "text": title, "id": id }),
            ))
        }
        _ => Err(gone()),
    }
}

/// " tomorrow at 5:00 PM", or nothing without a day.
fn when_words(day: Option<i64>, time: Option<u32>, today: i64) -> String {
    let Some(day) = day else {
        return String::new();
    };
    let mut words = format!(" {}", super::day_words(day, today));
    if let Some(minutes) = time {
        words.push_str(&format!(
            " at {}",
            lt::clock_text(minutes / 60, minutes % 60)
        ));
    }
    words
}

/// Change what Siri made, on its module's own document and by its own route,
/// over the revision read. Answers what Siri says, and the card's item.
pub async fn change(
    actor: &mut Actor<'_>,
    made: &Made,
    to: &str,
    today: i64,
    tz: i32,
) -> Result<(String, Value), String> {
    let (path, field, revision) = match made.app.as_str() {
        "calendar" => ("/events", "events", "rev"),
        "notes" | "stickies" | "reminders" => ("/data", "data", "base"),
        _ => return Err("I can’t change that from here.".into()),
    };
    let unreachable = |error: ActionError| error.message;
    for _ in 0..3 {
        let read = actor
            .request(&made.app, "GET", path, Body::None)
            .await
            .map_err(unreachable)?;
        if read.status != 200 {
            return Err(format!("{} could not be read.", made.app));
        }
        let mut doc = read.json[field].clone();
        let said = apply(&made.app, &mut doc, &made.id, to, today, tz)?;
        let mut body = json!({ field: doc, revision: read.json["rev"] });
        if made.app == "reminders" {
            body["alerts"] = reminder_alerts(
                body["data"]["reminders"]
                    .as_array()
                    .map(Vec::as_slice)
                    .unwrap_or_default(),
                tz,
            );
        }
        let wrote = actor
            .request(&made.app, "PUT", path, Body::Json(&body))
            .await
            .map_err(unreachable)?;
        match wrote.status {
            200 => return Ok(said),
            409 => continue,
            status => return Err(format!("{} refused the change ({status}).", made.app)),
        }
    }
    Err(format!("{} kept changing; try again.", made.app))
}

#[cfg(test)]
mod tests {
    use super::*;

    const TODAY: i64 = 20_000;

    #[test]
    fn it_hears_what_to_change_it_to() {
        assert_eq!(asked_to("change it to 5").as_deref(), Some("5"));
        assert_eq!(asked_to("Make that tomorrow.").as_deref(), Some("tomorrow"));
        assert_eq!(asked_to("move it to 3 PM").as_deref(), Some("3 PM"));
        assert_eq!(
            asked_to("Change it to Call Dad").as_deref(),
            Some("Call Dad")
        );
        assert_eq!(asked_to("change it"), None);
        assert_eq!(asked_to("open Notes"), None);
    }

    #[test]
    fn a_reminder_takes_a_time_on_its_side_of_noon_or_a_new_title() {
        let mut doc = json!({ "reminders": [
            { "id": "r", "title": "Call Mom", "due": lt::ymd(TODAY), "dueTime": "15:00" },
        ] });
        let (said, _) = apply("reminders", &mut doc, "r", "5", TODAY, 0).unwrap();
        assert_eq!(doc["reminders"][0]["dueTime"], "17:00");
        assert_eq!(
            said,
            "OK, I changed the reminder today at 5:00 PM: “Call Mom”."
        );
        apply("reminders", &mut doc, "r", "9 am", TODAY, 0).unwrap();
        assert_eq!(doc["reminders"][0]["dueTime"], "09:00");
        apply("reminders", &mut doc, "r", "tomorrow", TODAY, 0).unwrap();
        assert_eq!(doc["reminders"][0]["due"], lt::ymd(TODAY + 1));
        assert_eq!(doc["reminders"][0]["dueTime"], "09:00");
        apply("reminders", &mut doc, "r", "Call Dad", TODAY, 0).unwrap();
        assert_eq!(doc["reminders"][0]["title"], "Call Dad");
    }

    #[test]
    fn an_event_moves_and_keeps_its_length() {
        let start = lt::utc_of(TODAY, 15 * 60, 60);
        let mut doc = json!([{
            "id": "e", "title": "Review", "start": start, "end": start + 30 * 60_000,
        }]);
        let (said, _) = apply("calendar", &mut doc, "e", "5", TODAY, 60).unwrap();
        let moved = lt::utc_of(TODAY, 17 * 60, 60);
        assert_eq!(doc[0]["start"], moved);
        assert_eq!(doc[0]["end"], moved + 30 * 60_000);
        assert_eq!(said, "OK, “Review” is now today at 5:00 PM.");
    }

    #[test]
    fn a_note_and_a_sticky_take_the_words_and_a_lost_thing_says_so() {
        let mut notes = json!({ "notes": [{ "id": "n", "lines": ["Buy flowers", "Tulips"] }] });
        apply("notes", &mut notes, "n", "5", TODAY, 0).unwrap();
        assert_eq!(notes["notes"][0]["lines"], json!(["5", "Tulips"]));
        let mut stickies = json!({ "notes": [{ "id": "s", "text": "Buy flowers" }] });
        apply("stickies", &mut stickies, "s", "5", TODAY, 0).unwrap();
        assert_eq!(stickies["notes"][0]["text"], "5");
        assert_eq!(
            apply("stickies", &mut stickies, "gone", "5", TODAY, 0),
            Err("I can’t find it any more.".to_string())
        );
    }

    #[test]
    fn only_what_was_made_is_named() {
        let items = json!([{ "kind": "reminder", "id": "r1" }]);
        assert_eq!(
            made_of("reminders.add", &items),
            Some(json!({ "app": "reminders", "id": "r1" }))
        );
        assert_eq!(made_of("reminders.list", &items), None);
    }
}

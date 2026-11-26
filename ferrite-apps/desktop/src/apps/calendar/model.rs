//! What Calendar keeps for a person: the shapes of its document and the rules a
//! submitted one must meet.

use std::collections::BTreeSet;

use ferrite_app::serde;

use super::super::attachments::{self, Attachment};
use super::super::document;

/// The most events a person keeps.
pub const MAX_EVENTS: usize = 1000;
pub const MAX_TITLE_CHARS: usize = 200;
pub const MAX_LOCATION_CHARS: usize = 200;
pub const MAX_NOTES_CHARS: usize = 5_000;
pub const MAX_URL_CHARS: usize = 2_048;
/// The most calendars of a person's own.
pub const MAX_CALENDARS: usize = 50;
pub const MAX_CALENDAR_NAME_CHARS: usize = 64;
/// The most occurrences removed from one repeating event.
pub const MAX_EXDATES: usize = 200;
/// The most people one event invites.
pub const MAX_INVITEES: usize = 20;
/// The most events of one person that invite anyone.
pub const MAX_INVITED_EVENTS: usize = 50;
/// An alert shows from four weeks before an occurrence's start to a day
/// after it (minutes before the start; negative after it, as an all-day
/// event's "on the day, 9 AM").
pub const MAX_ALERT_MINUTES: i32 = 40_320;
pub const MIN_ALERT_MINUTES: i32 = -1_440;
/// The longest travel time an event names: a day, in minutes.
pub const MAX_TRAVEL_MINUTES: u32 = 1_440;
/// The most files one event holds.
pub const MAX_EVENT_ATTACHMENTS: usize = 20;
/// The calendars every person has that are not their own: the Birthdays,
/// Holidays and Siri Suggestions calendars of the sidebar's Other group.
pub const BUILT_IN: &[&str] = &["birthdays", "holidays", "siri"];
/// Dates stay within what JavaScript's `Date` can hold.
pub const MAX_ABS_MS: i64 = 8_640_000_000_000_000;
/// No event lasts longer than ten years.
const MAX_DURATION_MS: i64 = 10 * 366 * 24 * 60 * 60 * 1000;

/// A calendar's colour, as Calendar's colour menu names them.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum Color {
    Red,
    Orange,
    Yellow,
    Green,
    Blue,
    Purple,
    Brown,
    Cyan,
    Gray,
}

/// One of the person's own calendars (the iCloud group of the sidebar).
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Calendar {
    pub id: String,
    pub name: String,
    pub color: Color,
}

/// The calendars a person starts with: Home and Work, as in the capture.
pub fn default_calendars() -> Vec<Calendar> {
    vec![
        Calendar {
            id: "home".into(),
            name: "Home".into(),
            color: Color::Cyan,
        },
        Calendar {
            id: "work".into(),
            name: "Work".into(),
            color: Color::Purple,
        },
    ]
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum Freq {
    Daily,
    Weekly,
    Monthly,
    Yearly,
}

fn one() -> u32 {
    1
}

fn is_one(value: &u32) -> bool {
    *value == 1
}

fn is_false(value: &bool) -> bool {
    !*value
}

/// How an event repeats, in the person's local time: every `interval` days,
/// weeks (on `days`, 0 Sunday to 6 Saturday, or the start's weekday), months
/// (on the start's day of the month) or years, ending after `count`
/// occurrences or at `until` (epoch ms), or never. The page expands it
/// (`demos/calendar/calendar-recurrence.ts`), because only the browser knows
/// the person's time zone.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(
    crate = "ferrite_app::serde",
    rename_all = "camelCase",
    deny_unknown_fields
)]
pub struct Repeat {
    pub freq: Freq,
    #[serde(default = "one", skip_serializing_if = "is_one")]
    pub interval: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub count: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub until: Option<i64>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub days: Vec<u8>,
}

/// How an event counts for the person's availability. Absent means busy.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum ShowAs {
    Busy,
    Free,
}

/// One occurrence's alert, put off: it shows again from `until` (epoch ms)
/// until it is closed, also after the occurrence has ended.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct AlertSnooze {
    /// The occurrence's start (epoch ms).
    pub start: i64,
    pub until: i64,
}

/// One event. `start` and `end` are epoch milliseconds, as JavaScript's
/// `Date.getTime()` gives them.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(
    crate = "ferrite_app::serde",
    rename_all = "camelCase",
    deny_unknown_fields
)]
pub struct Event {
    pub id: String,
    pub title: String,
    pub start: i64,
    pub end: i64,
    #[serde(default, skip_serializing_if = "is_false")]
    pub all_day: bool,
    pub calendar: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repeat: Option<Repeat>,
    /// Starts (epoch ms) of occurrences removed from a repeating event.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub exdates: Vec<i64>,
    /// The account names of the people the event invites (`invites.rs`).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub invitees: Vec<String>,
    /// The IANA zone a timed event keeps its time in (`America/New_York`): a
    /// repeating event's occurrences are laid out on that zone's clock, wherever
    /// they are seen, and Time Zone Support shows it on any timed event. On an
    /// all-day event, the zone it was written in, which says which days its
    /// instants name. None for a single event with no zone chosen.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub time_zone: Option<String>,
    /// A timed event that reads the same time of day on every clock:
    /// `time_zone` then names the clock `start` and `end` were written on.
    #[serde(default, skip_serializing_if = "is_false")]
    pub floating: bool,
    /// When the event's alert shows: minutes before each occurrence's start
    /// (negative: after it). `None` for no alert. The page raises it while
    /// Calendar is open (`demos/calendar/calendar-alerts.ts`), and the server
    /// otherwise (`alerts.rs`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub alert: Option<i32>,
    /// The start (epoch ms) of the latest occurrence whose alert the person
    /// closed: neither its alert nor an earlier one's shows again.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub alert_dismissed: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub alert_snooze: Option<AlertSnooze>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub show_as: Option<ShowAs>,
    /// Minutes of travel before the event starts, which the week and day views
    /// draw above it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub travel_time: Option<u32>,
    /// The files attached to it. A save takes only their ids from the page: the
    /// records come from the stored document or the person's own uploads
    /// (`mod.rs`).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Attachment>,
}

/// The stored document.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq, Default)]
#[serde(crate = "ferrite_app::serde", rename_all = "camelCase")]
pub struct Doc {
    pub events: Vec<Event>,
    /// `None` until the person changes their calendars: Home and Work.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub calendars: Option<Vec<Calendar>>,
}

impl Doc {
    /// The person's calendars, or the ones everyone starts with.
    pub fn calendars(&self) -> Vec<Calendar> {
        self.calendars.clone().unwrap_or_else(default_calendars)
    }
}

/// The document as stored: the current form, or the plain list of events an
/// earlier build wrote under the same key.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", untagged)]
pub enum Stored {
    Current(Doc),
    Events(Vec<Event>),
}

impl From<Stored> for Doc {
    fn from(stored: Stored) -> Doc {
        match stored {
            Stored::Current(doc) => doc,
            Stored::Events(events) => Doc {
                events,
                ..Doc::default()
            },
        }
    }
}

fn chars(text: &str) -> usize {
    text.chars().count()
}

/// Whether `zone` reads as an IANA zone's name (`America/New_York`, `UTC`,
/// `Etc/GMT+5`): 1 to 64 letters, digits and `/_+-`. The page checks that it
/// knows the zone.
fn is_zone_name(zone: &str) -> bool {
    (1..=64).contains(&zone.len())
        && zone
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"/_+-".contains(&b))
}

/// What the week view's arrows scroll by.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "kebab-case")]
pub enum ScrollBy {
    Day,
    Week,
    WeekStopOnToday,
}

/// The numbers of hours the grid can show at a time, as the Show pop-up offers them.
pub const HOURS_SHOWN: &[u8] = &[6, 8, 10, 12, 14, 16, 18, 24];

/// A person's Calendar preferences, the General pane's: how the views lay out
/// days and hours, the calendar new events go to, and which built-in calendars
/// are listed. Kept apart from the events (`settings`), so that the
/// Preferences window saves them without the events.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(
    crate = "ferrite_app::serde",
    rename_all = "camelCase",
    deny_unknown_fields
)]
pub struct Settings {
    pub days_per_week: u8,
    /// 0 for Sunday to 6 for Saturday.
    pub week_starts_on: u8,
    pub scroll_by: ScrollBy,
    /// Hours of the day, 0 to 23; the day ends after it starts.
    pub day_starts_at: u8,
    pub day_ends_at: u8,
    pub hours_shown: u8,
    /// `"selected"` (the calendar selected in the sidebar) or a calendar's id.
    pub default_calendar: String,
    pub show_birthdays: bool,
    pub show_holidays: bool,
    pub show_alternate_calendar: bool,
    /// Advanced: Turn on time zone support.
    #[serde(default, skip_serializing_if = "is_false")]
    pub time_zone_support: bool,
    /// The alerts pane: minutes before the start a new timed event, a new
    /// all-day event and a birthday alert, as an event's `alert` counts them.
    /// `None` for no alert.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_alert: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_all_day_alert: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_birthday_alert: Option<i32>,
}

/// Check submitted preferences against what the Preferences window offers.
pub fn validate_settings(settings: Settings) -> Result<Settings, String> {
    if ![5, 7].contains(&settings.days_per_week) {
        return Err("a week shows 5 or 7 days".into());
    }
    if settings.week_starts_on > 6 {
        return Err("a week starts on day 0 (Sunday) to 6 (Saturday)".into());
    }
    if settings.day_ends_at > 23 || settings.day_starts_at >= settings.day_ends_at {
        return Err("the day starts and ends at hours 0 to 23, and ends after it starts".into());
    }
    if !HOURS_SHOWN.contains(&settings.hours_shown) {
        return Err(format!("the grid shows one of {HOURS_SHOWN:?} hours"));
    }
    if settings.default_calendar != "selected" && !document::valid_key(&settings.default_calendar) {
        return Err("the default calendar is \"selected\" or a calendar's id".into());
    }
    if [
        settings.default_alert,
        settings.default_all_day_alert,
        settings.default_birthday_alert,
    ]
    .into_iter()
    .flatten()
    .any(|minutes| !(MIN_ALERT_MINUTES..=MAX_ALERT_MINUTES).contains(&minutes))
    {
        return Err("a default alert shows from four weeks before to a day after".into());
    }
    Ok(settings)
}

/// A trimmed optional text: `None` when empty, an error when longer than `max`.
fn text(value: Option<String>, max: usize, what: &str) -> Result<Option<String>, String> {
    match value.map(|v| v.trim().to_string()) {
        Some(v) if v.is_empty() => Ok(None),
        Some(v) if chars(&v) > max => Err(format!("{what} has at most {max} characters")),
        other => Ok(other),
    }
}

/// Check a submitted list of calendars: one to `MAX_CALENDARS`. The window
/// never deletes the last one, so an empty list is refused rather than stored.
pub fn validate_calendars(calendars: Vec<Calendar>) -> Result<Vec<Calendar>, String> {
    if calendars.is_empty() {
        return Err("a person keeps at least one calendar".into());
    }
    if calendars.len() > MAX_CALENDARS {
        return Err(format!("at most {MAX_CALENDARS} calendars"));
    }
    let mut ids = BTreeSet::new();
    calendars
        .into_iter()
        .map(|mut calendar| {
            if !document::valid_key(&calendar.id) || BUILT_IN.contains(&calendar.id.as_str()) {
                return Err(format!("{:?} cannot name a calendar", calendar.id));
            }
            if !ids.insert(calendar.id.clone()) {
                return Err(format!("calendar {:?} is listed twice", calendar.id));
            }
            calendar.name = calendar.name.trim().to_string();
            if !(1..=MAX_CALENDAR_NAME_CHARS).contains(&chars(&calendar.name)) {
                return Err(format!(
                    "a calendar's name has 1 to {MAX_CALENDAR_NAME_CHARS} characters"
                ));
            }
            Ok(calendar)
        })
        .collect()
}

/// An event's invitees as account names (`accounts::account_name`), each once,
/// at most [`MAX_INVITEES`], in the order given.
fn validate_invitees(names: Vec<String>) -> Result<Vec<String>, String> {
    if names.len() > MAX_INVITEES {
        return Err(format!("an event invites at most {MAX_INVITEES} people"));
    }
    let mut seen = BTreeSet::new();
    names
        .into_iter()
        .map(|raw| {
            let name = crate::accounts::account_name(&raw)
                .ok_or_else(|| format!("{raw:?} is not an account name"))?;
            if !seen.insert(name.clone()) {
                return Err(format!("{name:?} is invited twice"));
            }
            Ok(name)
        })
        .collect()
}

fn validate_repeat(repeat: Repeat) -> Result<Repeat, String> {
    let mut repeat = repeat;
    if !(1..=99).contains(&repeat.interval) {
        return Err("a repeat's interval is 1 to 99".into());
    }
    if repeat
        .count
        .is_some_and(|count| !(1..=999).contains(&count))
    {
        return Err("a repeat ends after 1 to 999 occurrences".into());
    }
    if repeat
        .until
        .is_some_and(|until| !(-MAX_ABS_MS..=MAX_ABS_MS).contains(&until))
    {
        return Err("a repeat's end is out of range".into());
    }
    if repeat.count.is_some() && repeat.until.is_some() {
        return Err("a repeat ends after a count or on a date, not both".into());
    }
    if !repeat.days.is_empty() && repeat.freq != Freq::Weekly {
        return Err("only a weekly repeat names days".into());
    }
    if repeat.days.iter().any(|day| *day > 6) {
        return Err("a repeat's days are 0 (Sunday) to 6 (Saturday)".into());
    }
    repeat.days.sort_unstable();
    repeat.days.dedup();
    Ok(repeat)
}

/// Check and tidy a submitted list of events against the person's calendars.
pub fn validate(events: Vec<Event>, calendars: &[Calendar]) -> Result<Vec<Event>, String> {
    if events.len() > MAX_EVENTS {
        return Err(format!("at most {MAX_EVENTS} events"));
    }
    let known = |id: &str| BUILT_IN.contains(&id) || calendars.iter().any(|c| c.id == id);
    let dates = -MAX_ABS_MS..=MAX_ABS_MS;
    let mut ids = BTreeSet::new();
    let mut events = events
        .into_iter()
        .map(|mut event| {
            if !document::valid_key(&event.id) {
                return Err(format!(
                    "event id {:?} is not a plain id of 1 to 128 characters",
                    event.id
                ));
            }
            if !ids.insert(event.id.clone()) {
                return Err(format!("event id {:?} is listed twice", event.id));
            }
            event.title = event.title.trim().to_string();
            if chars(&event.title) > MAX_TITLE_CHARS {
                return Err(format!(
                    "an event title has at most {MAX_TITLE_CHARS} characters"
                ));
            }
            if !known(&event.calendar) {
                return Err(format!("{:?} is not one of the calendars", event.calendar));
            }
            // A range test rather than `abs()`, which overflows on i64::MIN.
            if !dates.contains(&event.start) || !dates.contains(&event.end) {
                return Err("an event date is out of range".into());
            }
            // Both dates are in range, so the difference cannot overflow.
            if event.end < event.start || event.end - event.start > MAX_DURATION_MS {
                return Err(format!(
                    "event {:?} must end after it starts, within ten years",
                    event.id
                ));
            }
            event.location = text(event.location, MAX_LOCATION_CHARS, "a location")?;
            event.notes = text(event.notes, MAX_NOTES_CHARS, "an event's notes")?;
            event.url = text(event.url, MAX_URL_CHARS, "an event's URL")?;
            event.repeat = event.repeat.map(validate_repeat).transpose()?;
            if event.repeat.is_none() && !event.exdates.is_empty() {
                return Err("only a repeating event has removed occurrences".into());
            }
            if event.exdates.len() > MAX_EXDATES || event.exdates.iter().any(|d| !dates.contains(d))
            {
                return Err(format!(
                    "at most {MAX_EXDATES} removed occurrences, each a possible date"
                ));
            }
            event.exdates.sort_unstable();
            event.exdates.dedup();
            event.invitees = validate_invitees(std::mem::take(&mut event.invitees))?;
            // The zone a timed event keeps its time in, or the one an all-day event's days were
            // written in, which says which days they are.
            event.time_zone = match event.time_zone.take() {
                Some(zone) => {
                    if !is_zone_name(&zone) {
                        return Err(format!("{zone:?} is not a time zone's name"));
                    }
                    Some(zone)
                }
                None => None,
            };
            if event.floating && (event.all_day || event.time_zone.is_none()) {
                return Err(
                    "a floating event is timed and names the zone it was written in".into(),
                );
            }
            if event
                .alert
                .is_some_and(|minutes| !(MIN_ALERT_MINUTES..=MAX_ALERT_MINUTES).contains(&minutes))
            {
                return Err(
                    "an alert shows from four weeks before an event to a day after it".into(),
                );
            }
            // What was closed belongs to an alert: an event without one keeps none.
            event.alert_dismissed = match event.alert_dismissed.take() {
                Some(at) if event.alert.is_some() => {
                    if !dates.contains(&at) {
                        return Err("an alert's closed occurrence is out of range".into());
                    }
                    Some(at)
                }
                _ => None,
            };
            // A snoozed alert belongs to an alert too.
            event.alert_snooze = match event.alert_snooze.take() {
                Some(snooze) if event.alert.is_some() => {
                    if !dates.contains(&snooze.start) || !dates.contains(&snooze.until) {
                        return Err("a snoozed alert's dates are out of range".into());
                    }
                    Some(snooze)
                }
                _ => None,
            };
            if event
                .travel_time
                .is_some_and(|minutes| !(1..=MAX_TRAVEL_MINUTES).contains(&minutes))
            {
                return Err(format!(
                    "an event's travel time is 1 to {MAX_TRAVEL_MINUTES} minutes"
                ));
            }
            if event.attachments.len() > MAX_EVENT_ATTACHMENTS {
                return Err(format!(
                    "an event holds at most {MAX_EVENT_ATTACHMENTS} attachments"
                ));
            }
            let mut attached = BTreeSet::new();
            if !event
                .attachments
                .iter()
                .all(|file| attachments::is_id(&file.id) && attached.insert(file.id.clone()))
            {
                return Err("an event's attachments are named by their ids, once each".into());
            }
            Ok(event)
        })
        .collect::<Result<Vec<_>, _>>()?;
    if events
        .iter()
        .filter(|event| !event.invitees.is_empty())
        .count()
        > MAX_INVITED_EVENTS
    {
        return Err(format!(
            "at most {MAX_INVITED_EVENTS} events invite other people"
        ));
    }
    // Stored, and answered, in start order.
    events.sort_by(|a, b| a.start.cmp(&b.start).then_with(|| a.id.cmp(&b.id)));
    Ok(events)
}

#[cfg(test)]
mod tests {
    use super::*;

    pub fn event(id: &str, title: &str) -> Event {
        Event {
            id: id.into(),
            title: title.into(),
            start: 1_570_136_400_000,
            end: 1_570_140_000_000,
            all_day: false,
            calendar: "work".into(),
            location: None,
            notes: None,
            url: None,
            repeat: None,
            exdates: Vec::new(),
            invitees: Vec::new(),
            time_zone: None,
            floating: false,
            alert: None,
            alert_dismissed: None,
            alert_snooze: None,
            show_as: None,
            travel_time: None,
            attachments: Vec::new(),
        }
    }

    fn weekly() -> Repeat {
        Repeat {
            freq: Freq::Weekly,
            interval: 1,
            count: None,
            until: None,
            days: vec![4, 2, 2],
        }
    }

    #[test]
    fn a_valid_list_is_kept_tidied_and_in_order() {
        let mut lunch = event("new-1", "  Lunch ");
        lunch.location = Some("  ".into());
        lunch.notes = Some(" Bring cake ".into());
        lunch.repeat = Some(weekly());
        lunch.exdates = vec![3, 1, 3];
        let events = validate(
            vec![lunch, event("halloween", "Halloween")],
            &default_calendars(),
        )
        .unwrap();
        let lunch = &events[1];
        assert_eq!(lunch.id, "new-1", "the same start, so sorted by id");
        assert_eq!(lunch.title, "Lunch");
        assert_eq!(lunch.location, None, "an empty location is none");
        assert_eq!(lunch.notes.as_deref(), Some("Bring cake"));
        assert_eq!(lunch.repeat.as_ref().unwrap().days, vec![2, 4]);
        assert_eq!(lunch.exdates, vec![1, 3]);
    }

    #[test]
    fn events_belong_to_a_known_calendar() {
        let own = vec![Calendar {
            id: "cal-1".into(),
            name: "Running".into(),
            color: Color::Green,
        }];
        let mut run = event("a", "Run");
        run.calendar = "cal-1".into();
        assert!(validate(vec![run.clone()], &own).is_ok());
        assert!(
            validate(vec![event("a", "x")], &own).is_err(),
            "Work was removed"
        );
        let mut holiday = event("a", "x");
        holiday.calendar = "holidays".into();
        assert!(validate(vec![holiday], &own).is_ok(), "built in");
    }

    #[test]
    fn bad_events_are_refused() {
        let calendars = default_calendars();
        let refused = |events: Vec<Event>| validate(events, &calendars).is_err();
        assert!(
            refused(vec![event("a", "x"), event("a", "y")]),
            "duplicate id"
        );
        assert!(refused(vec![event("a/b", "x")]), "id with a slash");
        assert!(refused(vec![event("a", &"x".repeat(201))]), "long title");
        let mut backwards = event("a", "x");
        backwards.end = backwards.start - 1;
        assert!(refused(vec![backwards]), "ends before it starts");
        assert!(refused(vec![event("a", "x"); MAX_EVENTS + 1]), "too many");
        for (start, end) in [
            (i64::MIN, 0),
            (0, i64::MAX),
            (MAX_ABS_MS + 1, MAX_ABS_MS + 2),
        ] {
            let mut extreme = event("a", "x");
            extreme.start = start;
            extreme.end = end;
            assert!(refused(vec![extreme]), "{start}..{end} is out of range");
        }
        let mut stray = event("a", "x");
        stray.exdates = vec![1];
        assert!(refused(vec![stray]), "removed occurrence of a single event");
        let mut daily_days = event("a", "x");
        daily_days.repeat = Some(Repeat {
            freq: Freq::Daily,
            ..weekly()
        });
        assert!(refused(vec![daily_days]), "days on a daily repeat");
        let mut both = event("a", "x");
        both.repeat = Some(Repeat {
            count: Some(3),
            until: Some(5),
            ..weekly()
        });
        assert!(refused(vec![both]), "count and until");
    }

    #[test]
    fn invitees_are_account_names_each_once() {
        let mut lunch = event("a", "Lunch");
        lunch.invitees = vec![" Martin ".into(), "anna".into()];
        let kept = validate(vec![lunch.clone()], &default_calendars()).unwrap();
        assert_eq!(kept[0].invitees, ["martin", "anna"]);
        for bad in [
            vec!["martin".to_string(), "MARTIN".to_string()],
            vec!["no spaces".to_string()],
            vec![String::new()],
            (0..=MAX_INVITEES).map(|n| format!("p{n}")).collect(),
        ] {
            let mut refused = lunch.clone();
            refused.invitees = bad.clone();
            assert!(
                validate(vec![refused], &default_calendars()).is_err(),
                "{bad:?}"
            );
        }
        let many: Vec<Event> = (0..=MAX_INVITED_EVENTS)
            .map(|n| {
                let mut each = event(&format!("e{n}"), "x");
                each.invitees = vec!["martin".into()];
                each
            })
            .collect();
        assert!(validate(many, &default_calendars()).is_err());
    }

    #[test]
    fn calendars_are_checked() {
        let calendar = |id: &str, name: &str| Calendar {
            id: id.into(),
            name: name.into(),
            color: Color::Red,
        };
        let kept = validate_calendars(vec![calendar("cal-1", " Gym ")]).unwrap();
        assert_eq!(kept[0].name, "Gym");
        assert!(validate_calendars(vec![calendar("holidays", "Mine")]).is_err());
        assert!(validate_calendars(vec![calendar("a", "x"), calendar("a", "y")]).is_err());
        assert!(validate_calendars(vec![calendar("a", "  ")]).is_err());
        assert!(
            validate_calendars(Vec::new()).is_err(),
            "no calendar at all"
        );
    }

    #[test]
    fn an_alert_is_kept_within_its_range_with_what_was_closed() {
        let mut meeting = event("a", "Meeting");
        meeting.alert = Some(15);
        meeting.alert_dismissed = Some(meeting.start);
        let kept = validate(vec![meeting.clone()], &default_calendars()).unwrap();
        assert_eq!(kept[0].alert, Some(15));
        assert_eq!(kept[0].alert_dismissed, Some(meeting.start));
        let mut on_the_day = meeting.clone();
        on_the_day.all_day = true;
        on_the_day.alert = Some(-540);
        assert!(validate(vec![on_the_day], &default_calendars()).is_ok());
        let mut none = meeting.clone();
        none.alert = None;
        let kept = validate(vec![none], &default_calendars()).unwrap();
        assert_eq!(kept[0].alert_dismissed, None, "no alert, nothing closed");
        for bad in [MAX_ALERT_MINUTES + 1, MIN_ALERT_MINUTES - 1] {
            let mut refused = meeting.clone();
            refused.alert = Some(bad);
            assert!(
                validate(vec![refused], &default_calendars()).is_err(),
                "{bad}"
            );
        }
        let mut far = meeting.clone();
        far.alert_dismissed = Some(i64::MAX);
        assert!(validate(vec![far], &default_calendars()).is_err());
    }

    #[test]
    fn a_floating_event_is_timed_and_names_where_it_was_written() {
        let mut floating = event("a", "Vitamins");
        floating.floating = true;
        assert!(validate(vec![floating.clone()], &default_calendars()).is_err());
        floating.time_zone = Some("Asia/Tokyo".into());
        let kept = validate(vec![floating.clone()], &default_calendars()).unwrap();
        assert!(kept[0].floating);
        floating.all_day = true;
        assert!(validate(vec![floating], &default_calendars()).is_err());
    }

    #[test]
    fn a_timed_event_keeps_its_zone() {
        let mut standup = event("a", "Standup");
        standup.repeat = Some(weekly());
        standup.time_zone = Some("America/New_York".into());
        let kept = validate(vec![standup.clone()], &default_calendars()).unwrap();
        assert_eq!(kept[0].time_zone.as_deref(), Some("America/New_York"));
        let mut single = standup.clone();
        single.repeat = None;
        let kept = validate(vec![single], &default_calendars()).unwrap();
        assert_eq!(kept[0].time_zone.as_deref(), Some("America/New_York"));
        let mut all_day = standup.clone();
        all_day.all_day = true;
        let kept = validate(vec![all_day], &default_calendars()).unwrap();
        assert_eq!(
            kept[0].time_zone.as_deref(),
            Some("America/New_York"),
            "an all-day event keeps the zone that says which days it is"
        );
        for bad in ["", "New York", "a;b", &"x".repeat(65)] {
            let mut refused = standup.clone();
            refused.time_zone = Some(bad.to_string());
            assert!(
                validate(vec![refused], &default_calendars()).is_err(),
                "{bad:?}"
            );
        }
    }

    #[test]
    fn travel_time_and_a_snoozed_alert_are_kept_within_their_rules() {
        let mut meeting = event("a", "Clinic");
        meeting.travel_time = Some(30);
        meeting.show_as = Some(ShowAs::Free);
        meeting.alert = Some(15);
        meeting.alert_snooze = Some(AlertSnooze {
            start: meeting.start,
            until: meeting.start + 1,
        });
        let kept = validate(vec![meeting.clone()], &default_calendars()).unwrap();
        assert_eq!(kept[0], meeting);

        let mut no_alert = meeting.clone();
        no_alert.alert = None;
        let kept = validate(vec![no_alert], &default_calendars()).unwrap();
        assert_eq!(kept[0].alert_snooze, None, "no alert, nothing snoozed");

        for minutes in [0, MAX_TRAVEL_MINUTES + 1] {
            let mut far = meeting.clone();
            far.travel_time = Some(minutes);
            assert!(
                validate(vec![far], &default_calendars()).is_err(),
                "{minutes}"
            );
        }
        let mut far = meeting;
        far.alert_snooze = Some(AlertSnooze {
            start: 0,
            until: i64::MAX,
        });
        assert!(validate(vec![far], &default_calendars()).is_err());
    }

    #[test]
    fn preferences_are_what_the_window_offers() {
        let good = Settings {
            days_per_week: 5,
            week_starts_on: 1,
            scroll_by: ScrollBy::WeekStopOnToday,
            day_starts_at: 7,
            day_ends_at: 19,
            hours_shown: 10,
            default_calendar: "home".into(),
            show_birthdays: true,
            show_holidays: false,
            show_alternate_calendar: false,
            time_zone_support: false,
            default_alert: Some(15),
            default_all_day_alert: None,
            default_birthday_alert: None,
        };
        assert_eq!(validate_settings(good.clone()), Ok(good.clone()));
        let refused = |change: fn(&mut Settings)| {
            let mut bad = good.clone();
            change(&mut bad);
            validate_settings(bad).is_err()
        };
        assert!(refused(|s| s.days_per_week = 6), "six days");
        assert!(refused(|s| s.week_starts_on = 7), "no eighth weekday");
        assert!(
            refused(|s| s.day_ends_at = s.day_starts_at),
            "ends as it starts"
        );
        assert!(refused(|s| s.day_ends_at = 24), "hour 24");
        assert!(refused(|s| s.hours_shown = 9), "not offered");
        assert!(refused(|s| s.default_calendar = "a/b".into()), "not an id");
        let read: Settings = ferrite_app::serde_json::from_str(
            r#"{"daysPerWeek":7,"weekStartsOn":0,"scrollBy":"week-stop-on-today","dayStartsAt":8,"dayEndsAt":18,"hoursShown":12,"defaultCalendar":"selected","showBirthdays":false,"showHolidays":true,"showAlternateCalendar":false}"#,
        )
        .unwrap();
        assert_eq!(read.scroll_by, ScrollBy::WeekStopOnToday);
        assert!(
            ferrite_app::serde_json::from_str::<Settings>(
                r#"{"daysPerWeek":7,"weekStartsOn":0,"scrollBy":"week","dayStartsAt":8,"dayEndsAt":18,"hoursShown":12,"defaultCalendar":"selected","showBirthdays":false,"showHolidays":true,"showAlternateCalendar":false,"alerts":"none"}"#
            )
            .is_err(),
            "unknown fields are refused"
        );
    }

    #[test]
    fn an_earlier_build_s_list_still_reads() {
        let stored: Stored = ferrite_app::serde_json::from_str(
            r#"[{"id":"a","title":"x","start":0,"end":1,"calendar":"home"}]"#,
        )
        .unwrap();
        let doc = Doc::from(stored);
        assert_eq!(doc.events.len(), 1);
        assert_eq!(doc.calendars(), default_calendars());
        let current: Stored = ferrite_app::serde_json::from_str(
            r#"{"events":[],"calendars":[{"id":"c","name":"C","color":"red"}]}"#,
        )
        .unwrap();
        assert_eq!(Doc::from(current).calendars()[0].id, "c");
        assert!(
            ferrite_app::serde_json::from_str::<Event>(
                r#"{"id":"a","title":"x","start":0,"end":1,"calendar":"home","color":"red"}"#
            )
            .is_err(),
            "unknown fields are refused"
        );
    }
}

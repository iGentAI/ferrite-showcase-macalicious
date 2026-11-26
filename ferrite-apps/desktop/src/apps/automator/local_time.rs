//! Local dates and times for the desktop's actions.
//!
//! The server has no time zone of its own: the browser sends its offset from
//! UTC with a run (`tz`, minutes east of UTC, which is
//! `-new Date().getTimezoneOffset()`), and a scheduled run uses the offset
//! saved with its workflow. Dates are the proleptic Gregorian calendar.

/// Milliseconds in a day.
pub const DAY_MS: i64 = 24 * 60 * 60 * 1000;

/// The largest offset any zone has, in minutes (UTC+14:00, UTC-12:00 is less).
pub const MAX_TZ_MINUTES: i32 = 14 * 60;

/// A UTC offset in minutes clamped to the zones that exist.
pub fn clamp_tz(tz: i64) -> i32 {
    tz.clamp(-i64::from(MAX_TZ_MINUTES), i64::from(MAX_TZ_MINUTES)) as i32
}

/// Days since 1970-01-01 of a civil date (Howard Hinnant's algorithm).
pub fn days_from_civil(year: i64, month: u32, day: u32) -> i64 {
    let y = if month <= 2 { year - 1 } else { year };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let m = i64::from(month);
    let doy = (153 * (if m > 2 { m - 3 } else { m + 9 }) + 2) / 5 + i64::from(day) - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

/// The civil date of a day count since 1970-01-01.
pub fn civil_from_days(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let month = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let year = yoe + era * 400 + i64::from(month <= 2);
    (year, month, day)
}

/// A moment in one zone.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Local {
    pub year: i64,
    pub month: u32,
    pub day: u32,
    pub hour: u32,
    pub minute: u32,
    /// Days since 1970-01-01 of the local date.
    pub days: i64,
}

/// `utc_ms` seen in the zone `tz` minutes east of UTC.
pub fn local(utc_ms: i64, tz: i32) -> Local {
    let ms = utc_ms + i64::from(tz) * 60_000;
    let days = ms.div_euclid(DAY_MS);
    let in_day = ms.rem_euclid(DAY_MS);
    let (year, month, day) = civil_from_days(days);
    Local {
        year,
        month,
        day,
        hour: (in_day / 3_600_000) as u32,
        minute: (in_day / 60_000 % 60) as u32,
        days,
    }
}

/// The UTC instant of `minutes` past local midnight of day `days`.
pub fn utc_of(days: i64, minutes: u32, tz: i32) -> i64 {
    days * DAY_MS + i64::from(minutes) * 60_000 - i64::from(tz) * 60_000
}

/// `YYYY-MM-DD` of a local day.
pub fn ymd(days: i64) -> String {
    let (y, m, d) = civil_from_days(days);
    format!("{y:04}-{m:02}-{d:02}")
}

/// The local day `YYYY-MM-DD` names.
pub fn parse_ymd(text: &str) -> Option<i64> {
    let mut parts = text.trim().splitn(3, '-');
    let year: i64 = parts.next()?.parse().ok()?;
    let month: u32 = parts.next()?.parse().ok()?;
    let day: u32 = parts.next()?.parse().ok()?;
    if !(1..=12).contains(&month) || day == 0 || day > month_days(year, month) {
        return None;
    }
    if !(1000..=9999).contains(&year) {
        return None;
    }
    Some(days_from_civil(year, month, day))
}

fn month_days(year: i64, month: u32) -> u32 {
    match month {
        2 if (year % 4 == 0 && year % 100 != 0) || year % 400 == 0 => 29,
        2 => 28,
        4 | 6 | 9 | 11 => 30,
        _ => 31,
    }
}

/// The local day a word or date names, relative to `today`: `today`,
/// `tomorrow`, `yesterday`, a weekday name (the next one, today excluded),
/// or `YYYY-MM-DD`.
pub fn parse_day(text: &str, today: i64) -> Option<i64> {
    let word = text.trim().to_ascii_lowercase();
    match word.as_str() {
        "today" | "tonight" => return Some(today),
        "tomorrow" => return Some(today + 1),
        "yesterday" => return Some(today - 1),
        _ => {}
    }
    if let Some(index) = WEEKDAYS.iter().position(|day| *day == word) {
        // 1970-01-01 was a Thursday: weekday 0 is Monday.
        let current = (today + 3).rem_euclid(7);
        let ahead = (index as i64 - current).rem_euclid(7);
        return Some(today + if ahead == 0 { 7 } else { ahead });
    }
    parse_ymd(&word)
}

const WEEKDAYS: [&str; 7] = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
];

/// Minutes past midnight of `HH:MM` (24-hour), `5pm`, `5:30 pm`, `noon` or
/// `midnight`.
pub fn parse_time(text: &str) -> Option<u32> {
    let word = text.trim().to_ascii_lowercase().replace('.', "");
    match word.as_str() {
        "noon" | "midday" => return Some(12 * 60),
        "midnight" => return Some(0),
        _ => {}
    }
    let (digits, meridiem) = if let Some(rest) = word.strip_suffix("am") {
        (rest.trim(), Some(false))
    } else if let Some(rest) = word.strip_suffix("pm") {
        (rest.trim(), Some(true))
    } else {
        (word.as_str(), None)
    };
    let (hour, minute) = match digits.split_once(':') {
        Some((h, m)) => (h.trim().parse::<u32>().ok()?, m.trim().parse::<u32>().ok()?),
        None => (digits.parse::<u32>().ok()?, 0),
    };
    if minute > 59 {
        return None;
    }
    let hour = match meridiem {
        Some(pm) => {
            if hour == 0 || hour > 12 {
                return None;
            }
            (hour % 12) + if pm { 12 } else { 0 }
        }
        None if hour < 24 => hour,
        None => return None,
    };
    Some(hour * 60 + minute)
}

/// `HH:MM` of minutes past midnight.
pub fn hhmm(minutes: u32) -> String {
    format!("{:02}:{:02}", minutes / 60, minutes % 60)
}

/// `3:55 PM`.
pub fn clock_text(hour: u32, minute: u32) -> String {
    let h12 = match hour % 12 {
        0 => 12,
        h => h,
    };
    let meridiem = if hour < 12 { "AM" } else { "PM" };
    format!("{h12}:{minute:02} {meridiem}")
}

const MONTHS: [&str; 12] = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

/// `October 3, 2019`.
pub fn date_text(local: &Local) -> String {
    format!(
        "{} {}, {}",
        MONTHS[(local.month - 1) as usize],
        local.day,
        local.year
    )
}

/// `October 3, 2019 at 3:55 PM`.
pub fn long_text(local: &Local) -> String {
    format!(
        "{} at {}",
        date_text(local),
        clock_text(local.hour, local.minute)
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn civil_dates_round_trip() {
        assert_eq!(days_from_civil(1970, 1, 1), 0);
        assert_eq!(civil_from_days(0), (1970, 1, 1));
        for days in [-1_000_000, -1, 0, 59, 365, 18_000, 20_000, 2_000_000] {
            let (y, m, d) = civil_from_days(days);
            assert_eq!(days_from_civil(y, m, d), days);
        }
        assert_eq!(parse_ymd("2024-02-29"), Some(days_from_civil(2024, 2, 29)));
        assert_eq!(parse_ymd("2023-02-29"), None);
        assert_eq!(parse_ymd("2023-13-01"), None);
        assert_eq!(ymd(days_from_civil(2026, 10, 14)), "2026-10-14");
    }

    #[test]
    fn a_moment_is_read_in_the_browser_s_zone() {
        // 2026-10-14T23:30:00Z is the 15th at 01:30 in UTC+2 and the 14th at
        // 16:30 in UTC-7.
        let utc = utc_of(days_from_civil(2026, 10, 14), 23 * 60 + 30, 0);
        let east = local(utc, 120);
        assert_eq!((east.day, east.hour, east.minute), (15, 1, 30));
        let west = local(utc, -420);
        assert_eq!((west.day, west.hour, west.minute), (14, 16, 30));
        assert_eq!(utc_of(east.days, 90, 120), utc);
        assert_eq!(long_text(&west), "October 14, 2026 at 4:30 PM");
    }

    #[test]
    fn days_and_times_are_read_from_words() {
        let today = days_from_civil(2026, 10, 14); // a Wednesday
        assert_eq!(parse_day("Tomorrow", today), Some(today + 1));
        assert_eq!(parse_day("friday", today), Some(today + 2));
        assert_eq!(parse_day("wednesday", today), Some(today + 7));
        assert_eq!(parse_day("2026-12-25", today), parse_ymd("2026-12-25"));
        assert_eq!(parse_day("someday", today), None);
        assert_eq!(parse_time("5pm"), Some(17 * 60));
        assert_eq!(parse_time("5:30 p.m."), Some(17 * 60 + 30));
        assert_eq!(parse_time("12 am"), Some(0));
        assert_eq!(parse_time("09:05"), Some(9 * 60 + 5));
        assert_eq!(parse_time("noon"), Some(720));
        assert_eq!(parse_time("25:00"), None);
        assert_eq!(parse_time("13pm"), None);
        assert_eq!(clock_text(0, 5), "12:05 AM");
        assert_eq!(hhmm(17 * 60 + 5), "17:05");
    }
}

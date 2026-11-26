//! How fast the desktop's Ferrite application answers: the server time and
//! store calls of every counted `/api/` request, per module and per minute,
//! for Activity Monitor's Ferrite view (`apps/activity_monitor`).
//!
//! The router (`src/lib.rs`) measures each module request from the moment it
//! calls the module to the moment the module's reply and its change
//! notification are done, on the platform clock's sub-millisecond reading
//! (`Clock::now_ms_f64`), and counts every store call made in that span,
//! through the module's key spaces or any helper (`store.rs`). Requests the
//! router answers itself (the session and app-registry endpoints, and a
//! module's refusals for a stale page or a locked screen) are counted but not
//! timed. The clock is the platform's wall clock: a step back reads as 0, and
//! a step forward puts one request in the slowest bucket.
//!
//! The figures travel in the request counter the router already advances for
//! every counted request (`applog::count`, one compare-and-set per request):
//! each counter keeps the [`Minute`]s of the last [`WINDOW_MINUTES`] minutes
//! in which its module answered, so timing a request adds no store call, and
//! no read or key grows with time. A minute holds the requests per latency
//! bucket ([`BUCKET_UPPER_US`], stored without its trailing empty buckets),
//! their total server time in microseconds, the store calls they made and the
//! requests answered 400 or more. A minute that does not parse is dropped
//! ([`lenient_minutes`]), never the counter it is in.
//! [`counters`] gathers the minutes from every counter and [`summarize`] turns
//! them into requests per second, the median and 95th percentile (estimated
//! within their latency bucket), mean server time, store calls per request
//! and errors.
//!
//! What this is not: the router's own work outside that span (resolving the
//! session, this recording, the request log), the gateway's own time, the
//! queue's wait before a worker takes the request, or the network to the
//! browser (Activity Monitor's Network view measures that from the browser).
//! A count that loses its compare-and-set race too often is dropped
//! (`applog::count`), and its time with it.

use std::collections::BTreeMap;

use ferrite_app::serde::{self, Deserialize, Deserializer, Serializer};
use ferrite_app::serde_json::{self, json, Value};

/// The minutes a summary covers, and a counter keeps: this one and the four
/// before it.
pub const WINDOW_MINUTES: u64 = 5;
const MINUTE_MS: u64 = 60_000;
/// The number of latency buckets.
pub const BUCKETS: usize = 17;

/// The upper bound of each latency bucket, in microseconds; the last is
/// open-ended.
pub const BUCKET_UPPER_US: [u64; BUCKETS] = [
    250,
    500,
    1_000,
    2_000,
    4_000,
    8_000,
    16_000,
    32_000,
    64_000,
    128_000,
    256_000,
    512_000,
    1_024_000,
    2_048_000,
    4_096_000,
    8_192_000,
    u64::MAX,
];

/// What the router measured of one request.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Sample {
    /// Server time, in microseconds.
    pub server_us: u64,
    /// Store calls made through the request's counted handle.
    pub store_calls: u64,
}

/// One module's figures for one minute.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, Default, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", default)]
pub struct Minute {
    /// The minute (epoch ms divided by 60,000).
    pub minute: u64,
    /// Requests per latency bucket.
    #[serde(
        serialize_with = "crate::timing::serialize_buckets",
        deserialize_with = "crate::timing::deserialize_buckets"
    )]
    pub buckets: [u64; BUCKETS],
    /// Their total server time, in microseconds.
    #[serde(skip_serializing_if = "is_zero")]
    pub us: u64,
    /// The store calls they made.
    #[serde(skip_serializing_if = "is_zero")]
    pub ops: u64,
    /// Those answered 400 or more.
    #[serde(skip_serializing_if = "is_zero")]
    pub errors: u64,
}

fn is_zero(n: &u64) -> bool {
    *n == 0
}

// The buckets as stored: a list without its trailing empty buckets. One read
// with more buckets than [`BUCKETS`] puts the rest in the last, open bucket,
// so no request is lost from the count. The two are free functions named by
// their full path in the field's attribute: the platform's code gate admits a
// serde callback only when it can resolve its identity, which a `with` module
// or a name reached through a glob import does not give it.

pub(crate) fn serialize_buckets<S: Serializer>(
    buckets: &[u64; BUCKETS],
    to: S,
) -> Result<S::Ok, S::Error> {
    let used = buckets.iter().rposition(|n| *n > 0).map_or(0, |at| at + 1);
    to.collect_seq(&buckets[..used])
}

pub(crate) fn deserialize_buckets<'de, D: Deserializer<'de>>(
    from: D,
) -> Result<[u64; BUCKETS], D::Error> {
    let mut buckets = [0u64; BUCKETS];
    for (at, n) in Vec::<u64>::deserialize(from)?.into_iter().enumerate() {
        let at = at.min(BUCKETS - 1);
        buckets[at] = buckets[at].saturating_add(n);
    }
    Ok(buckets)
}

/// A counter's minutes as stored, for `#[serde(deserialize_with)]`: those
/// that parse, in order, one per minute. A minute that does not parse is left
/// out and a value that is not a list reads as none, so a damaged minute can
/// never cost the counter's totals.
pub fn lenient_minutes<'de, D: Deserializer<'de>>(from: D) -> Result<Vec<Minute>, D::Error> {
    let Value::Array(items) = Value::deserialize(from)? else {
        return Ok(Vec::new());
    };
    let mut minutes: Vec<Minute> = items
        .into_iter()
        .filter_map(|item| serde_json::from_value(item).ok())
        .collect();
    minutes.sort_by_key(|m| m.minute);
    minutes.dedup_by(|later, kept| {
        let same = later.minute == kept.minute;
        if same {
            kept.merge(later);
        }
        same
    });
    Ok(minutes)
}

impl Minute {
    pub fn requests(&self) -> u64 {
        self.buckets.iter().fold(0, |sum, n| sum.saturating_add(*n))
    }

    fn merge(&mut self, other: &Minute) {
        for (mine, theirs) in self.buckets.iter_mut().zip(other.buckets) {
            *mine = mine.saturating_add(theirs);
        }
        self.us = self.us.saturating_add(other.us);
        self.ops = self.ops.saturating_add(other.ops);
        self.errors = self.errors.saturating_add(other.errors);
    }
}

/// The bucket of a server time.
pub fn bucket(us: u64) -> usize {
    BUCKET_UPPER_US
        .iter()
        .position(|upper| us < *upper)
        .unwrap_or(BUCKETS - 1)
}

/// The microseconds between two readings of the platform clock in
/// milliseconds (`Clock::now_ms_f64`); 0 when the clock went back.
pub fn elapsed_us(started_ms: f64, ended_ms: f64) -> u64 {
    let us = (ended_ms - started_ms) * 1000.0;
    if us.is_finite() && us > 0.0 {
        us as u64
    } else {
        0
    }
}

fn minute_of(ms: u64) -> u64 {
    ms / MINUTE_MS
}

/// The first minute the summary covers at `now_ms`.
pub fn window_start(now_ms: u64) -> u64 {
    minute_of(now_ms).saturating_sub(WINDOW_MINUTES - 1)
}

/// Add one request answered at `now_ms` to a counter's minutes, and drop the
/// minutes that have left the window. The minutes stay in order, one per
/// minute. Minutes up to [`WINDOW_MINUTES`] ahead of this clock are kept, so
/// an instance whose clock runs slow does not drop what the others wrote;
/// that bounds a counter to twice the window.
pub fn add(minutes: &mut Vec<Minute>, now_ms: u64, sample: Sample, error: bool) {
    let now = minute_of(now_ms);
    let first = window_start(now_ms);
    minutes.retain(|m| m.minute >= first && m.minute <= now + WINDOW_MINUTES);
    let at = match minutes.binary_search_by_key(&now, |m| m.minute) {
        Ok(at) => at,
        Err(at) => {
            minutes.insert(
                at,
                Minute {
                    minute: now,
                    ..Minute::default()
                },
            );
            at
        }
    };
    let slot = &mut minutes[at];
    let index = bucket(sample.server_us);
    slot.buckets[index] = slot.buckets[index].saturating_add(1);
    slot.us = slot.us.saturating_add(sample.server_us);
    slot.ops = slot.ops.saturating_add(sample.store_calls);
    if error {
        slot.errors = slot.errors.saturating_add(1);
    }
}

/// The minutes kept, by `(minute, app)`.
pub type Counters = BTreeMap<(u64, String), Minute>;

/// Every counter's minutes, by minute and counter name.
pub fn counters(counts: &[(String, crate::applog::Counts)]) -> Counters {
    let mut counters = Counters::new();
    for (name, counts) in counts {
        for minute in &counts.minutes {
            counters
                .entry((minute.minute, name.clone()))
                .or_default()
                .merge(minute);
        }
    }
    counters
}

/// The server time below which `share` (0 to 1) of the requests fell,
/// estimated within its bucket, in milliseconds; `None` with no requests.
pub fn percentile(buckets: &[u64; BUCKETS], share: f64) -> Option<f64> {
    let total: u64 = buckets.iter().fold(0, |sum, n| sum.saturating_add(*n));
    if total == 0 {
        return None;
    }
    let rank = (share * total as f64).ceil().max(1.0);
    let mut below = 0u64;
    for (index, count) in buckets.iter().enumerate() {
        if *count == 0 {
            continue;
        }
        if (below + count) as f64 >= rank {
            let lower = if index == 0 {
                0
            } else {
                BUCKET_UPPER_US[index - 1]
            };
            let upper = BUCKET_UPPER_US[index];
            if upper == u64::MAX {
                return Some(lower as f64 / 1000.0);
            }
            let within = (rank - below as f64) / *count as f64;
            return Some((lower as f64 + within * (upper - lower) as f64) / 1000.0);
        }
        below += count;
    }
    None
}

fn round2(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

fn figures(minute: &Minute, seconds: f64) -> Value {
    let requests = minute.requests();
    let mean = (requests > 0).then(|| round2(minute.us as f64 / requests as f64 / 1000.0));
    json!({
        "requests": requests,
        "per_second": round2(requests as f64 / seconds.max(1.0)),
        "errors": minute.errors,
        "store_ops": minute.ops,
        "ops_per_request": (requests > 0).then(|| round2(minute.ops as f64 / requests as f64)),
        "mean_ms": mean,
        "p50_ms": percentile(&minute.buckets, 0.5).map(round2),
        "p95_ms": percentile(&minute.buckets, 0.95).map(round2),
    })
}

/// The figures of the last [`WINDOW_MINUTES`] minutes up to `now_ms`, per
/// app (titled by `title`, apps it does not title left out) and for all of
/// them, and the requests of each of those minutes for a graph.
pub fn summarize(
    counters: &Counters,
    now_ms: u64,
    title: impl Fn(&str) -> Option<&'static str>,
) -> Value {
    let now_minute = minute_of(now_ms);
    let first = window_start(now_ms);
    // The window runs from the start of its first minute to now.
    let seconds = (now_ms.saturating_sub(first * MINUTE_MS)) as f64 / 1000.0;
    let mut per_app: BTreeMap<&str, Minute> = BTreeMap::new();
    let mut total = Minute::default();
    let mut by_minute: BTreeMap<u64, Minute> = BTreeMap::new();
    for ((minute, app), figures) in counters {
        if title(app).is_none() || *minute < first || *minute > now_minute {
            continue;
        }
        by_minute.entry(*minute).or_default().merge(figures);
        per_app.entry(app.as_str()).or_default().merge(figures);
        total.merge(figures);
    }
    let apps: Vec<Value> = per_app
        .iter()
        .filter_map(|(app, minute)| {
            let mut value = figures(minute, seconds);
            value["name"] = (*app).into();
            value["title"] = title(app)?.into();
            Some(value)
        })
        .collect();
    let minutes: Vec<Value> = by_minute
        .iter()
        .map(|(minute, figures)| {
            json!({
                "at_ms": minute * MINUTE_MS,
                "requests": figures.requests(),
                "errors": figures.errors,
                "p50_ms": percentile(&figures.buckets, 0.5).map(round2),
                "p95_ms": percentile(&figures.buckets, 0.95).map(round2),
            })
        })
        .collect();
    serde_json::json!({
        "window_ms": now_ms.saturating_sub(first * MINUTE_MS),
        "apps": apps,
        "total": figures(&total, seconds),
        "minutes": minutes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample(server_us: u64, store_calls: u64) -> Sample {
        Sample {
            server_us,
            store_calls,
        }
    }

    #[test]
    fn buckets_split_server_time_and_the_last_is_open() {
        assert_eq!(bucket(0), 0);
        assert_eq!(bucket(249), 0);
        assert_eq!(bucket(250), 1);
        assert_eq!(bucket(1_500), 3);
        assert_eq!(bucket(9_000_000), 16);
        assert_eq!(bucket(u64::MAX), 16);
    }

    #[test]
    fn elapsed_time_is_in_microseconds_and_never_negative() {
        assert_eq!(elapsed_us(1_000.0, 1_002.5), 2_500);
        assert_eq!(elapsed_us(1_000.0, 999.0), 0, "a clock that went back");
        assert_eq!(elapsed_us(f64::NAN, 1.0), 0);
    }

    #[test]
    fn a_counter_keeps_only_the_minutes_of_the_window_in_order() {
        let mut minutes = Vec::new();
        for minute in 0..20 {
            add(&mut minutes, minute * MINUTE_MS + 1, sample(300, 2), false);
            add(&mut minutes, minute * MINUTE_MS + 2, sample(300, 2), false);
            assert!(minutes.len() as u64 <= WINDOW_MINUTES);
        }
        let kept: Vec<u64> = minutes.iter().map(|m| m.minute).collect();
        assert_eq!(kept, vec![15, 16, 17, 18, 19]);
        assert!(minutes.iter().all(|m| m.requests() == 2 && m.ops == 4));
        // A request timed by a clock a minute ahead keeps its own minute, and
        // one from a slower clock neither drops it nor loses its own place.
        add(&mut minutes, 20 * MINUTE_MS, sample(300, 0), false);
        add(&mut minutes, 19 * MINUTE_MS, sample(300, 0), true);
        let kept: Vec<u64> = minutes.iter().map(|m| m.minute).collect();
        assert_eq!(kept, vec![16, 17, 18, 19, 20]);
        assert_eq!(minutes[3].requests(), 3);
        assert_eq!(minutes[3].errors, 1);
        // A minute far ahead of the writer's clock is dropped at its next write.
        minutes.push(Minute {
            minute: 99,
            ..Minute::default()
        });
        add(&mut minutes, 20 * MINUTE_MS, sample(300, 0), false);
        assert_eq!(minutes.last().map(|m| m.minute), Some(20));
        assert!(minutes.len() as u64 <= 2 * WINDOW_MINUTES);
    }

    #[test]
    fn a_minute_is_stored_without_its_empty_buckets_and_read_back_whole() {
        let mut minutes = Vec::new();
        add(&mut minutes, 0, sample(300, 2), false);
        add(&mut minutes, 0, sample(1_500, 0), true);
        let stored = serde_json::to_string(&minutes[0]).unwrap();
        assert_eq!(
            stored,
            r#"{"minute":0,"buckets":[0,1,0,1],"us":1800,"ops":2,"errors":1}"#
        );
        let read: Minute = serde_json::from_str(&stored).unwrap();
        assert_eq!(read, minutes[0]);
        let empty: Minute = serde_json::from_str(r#"{"minute":3}"#).unwrap();
        assert_eq!(empty.requests(), 0);
        // More buckets than this build has go into the last, open one.
        let wide: Minute = serde_json::from_str(&format!(
            r#"{{"minute":1,"buckets":{:?}}}"#,
            vec![1u64; BUCKETS + 3]
        ))
        .unwrap();
        assert_eq!(wide.requests(), BUCKETS as u64 + 3);
        assert_eq!(wide.buckets[BUCKETS - 1], 4);
    }

    #[test]
    fn a_damaged_minute_is_dropped_and_its_neighbours_kept() {
        #[derive(serde::Deserialize)]
        #[serde(crate = "ferrite_app::serde")]
        struct Held {
            #[serde(deserialize_with = "crate::timing::lenient_minutes")]
            minutes: Vec<Minute>,
        }
        let held: Held = serde_json::from_str(
            r#"{"minutes":[{"minute":7,"buckets":[2]},{"minute":"x"},{"minute":5,"buckets":[1]},{"minute":7,"buckets":[0,1]}]}"#,
        )
        .unwrap();
        let kept: Vec<(u64, u64)> = held
            .minutes
            .iter()
            .map(|m| (m.minute, m.requests()))
            .collect();
        assert_eq!(kept, vec![(5, 1), (7, 3)], "in order, one per minute");
        let held: Held = serde_json::from_str(r#"{"minutes":{"not":"a list"}}"#).unwrap();
        assert!(held.minutes.is_empty());
    }

    #[test]
    fn counts_and_times_are_kept_apart_however_large_the_time() {
        let mut minutes = Vec::new();
        add(&mut minutes, 0, sample(u64::MAX, u64::MAX), false);
        add(&mut minutes, 0, sample(u64::MAX, 1), false);
        add(&mut minutes, 0, sample(1 << 40, 0), false);
        let minute = &minutes[0];
        assert_eq!(minute.requests(), 3);
        assert_eq!(minute.buckets[16], 3);
        assert_eq!(minute.us, u64::MAX, "the sum saturates");
        assert_eq!(minute.ops, u64::MAX);
    }

    #[test]
    fn percentiles_are_estimated_within_their_bucket() {
        let mut buckets = [0u64; BUCKETS];
        assert_eq!(percentile(&buckets, 0.5), None);
        buckets[2] = 10; // 0.5 to 1 ms
        assert_eq!(percentile(&buckets, 0.5), Some(0.75));
        assert_eq!(percentile(&buckets, 1.0), Some(1.0));
        buckets[6] = 1; // 16 to 32 ms
        let p95 = percentile(&buckets, 0.95).unwrap();
        assert!((16.0..=32.0).contains(&p95), "{p95}");
        let mut slow = [0u64; BUCKETS];
        slow[16] = 1;
        assert_eq!(
            percentile(&slow, 0.5),
            Some(8_192.0),
            "the open bucket reports its floor"
        );
    }

    #[test]
    fn a_summary_covers_the_window_per_app_and_in_total() {
        use crate::applog::Counts;
        let now = 100 * MINUTE_MS + 30_000; // half a minute into minute 100
        let mut notes = Counts::default();
        add(&mut notes.minutes, 90 * MINUTE_MS, sample(700, 0), false); // dropped below
        add(&mut notes.minutes, 99 * MINUTE_MS, sample(3_000, 0), true);
        add(&mut notes.minutes, now, sample(600, 3), false);
        add(&mut notes.minutes, now, sample(800, 3), false);
        let mut old = Counts::default();
        add(&mut old.minutes, 90 * MINUTE_MS, sample(700, 0), false); // before the window
        let mut secret = Counts::default();
        add(&mut secret.minutes, now, sample(10, 0), false); // no title: left out
        let counts = vec![
            ("notes".to_string(), notes),
            ("old".to_string(), old),
            ("secret".to_string(), secret),
        ];
        let titled = |app: &str| match app {
            "notes" => Some("Notes"),
            "old" => Some("Old"),
            _ => None,
        };
        let summary = summarize(&counters(&counts), now, titled);
        let notes = &summary["apps"][0];
        assert_eq!(summary["apps"].as_array().unwrap().len(), 1);
        assert_eq!(notes["title"], "Notes");
        assert_eq!(notes["requests"], 3);
        assert_eq!(notes["errors"], 1);
        assert_eq!(notes["store_ops"], 6);
        assert_eq!(notes["ops_per_request"], 2.0);
        assert_eq!(notes["mean_ms"], 1.47);
        // Four and a half minutes of window.
        assert_eq!(summary["window_ms"], 270_000);
        assert_eq!(notes["per_second"], 0.01);
        assert_eq!(summary["total"]["requests"], 3);
        let minutes = summary["minutes"].as_array().unwrap();
        assert_eq!(minutes.len(), 2, "the window's minutes with requests");
        assert_eq!(minutes[0]["at_ms"], 99 * MINUTE_MS);
    }
}

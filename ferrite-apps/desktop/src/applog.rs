//! The desktop application's own log and request counts, kept in the `data`
//! store beside the modules' keys, under `desktop/`.
//!
//! * The log (`desktop/log/`) holds what the application and its modules
//!   write: the router writes one entry for every request that changes state
//!   (any method but `GET` and `HEAD`) and for every reply of 400 or more, the
//!   boot writes one when the process starts and one when the site is live,
//!   and a module writes its own through [`crate::module::ApiCtx::log`].
//!   Entries expire after [`LOG_TTL_MS`]; readers see the newest
//!   [`LOG_LIMIT`]. Keys count down in time, so a prefix scan reads the newest
//!   first without a counter every writer would contend on.
//! * The counters (`desktop/requests/<name>`) count the `/api/` requests the
//!   router answered for each module, and for its own `session` and `apps`
//!   endpoints: all of them, the writes among them, and those answered 400 or
//!   more. Each is advanced by compare-and-set; a count that loses the race
//!   [`CAS_ATTEMPTS`] times is dropped and the request still answers. The
//!   same write carries the request's server time and store calls into the
//!   counter's last minutes (`crate::timing`), for Activity Monitor.
//!
//! The log is one for the whole application, shared by every session, so no
//! entry carries a session id, a query string or a request body: only the
//! method, the path and the status.

use std::io;

use ferrite_app::client::StoreClusterClient;
use ferrite_app::{serde, serde_json};

use crate::store::IntoStore;

/// Where the log's entries live in the `data` store.
pub const LOG_PREFIX: &str = "desktop/log/";
/// Where the request counters live in the `data` store.
pub const REQUESTS_PREFIX: &str = "desktop/requests/";
/// How long an entry is kept: a day.
pub const LOG_TTL_MS: u64 = 24 * 60 * 60 * 1000;
/// The most entries a reader is given: the newest.
pub const LOG_LIMIT: usize = 500;
/// The longest message kept, in characters; the rest is cut.
pub const MAX_MESSAGE_CHARS: usize = 500;
/// Entries the application can write in one millisecond.
const SLOTS: u64 = 8;
/// Compare-and-set attempts before a count is dropped.
const CAS_ATTEMPTS: usize = 4;
/// The most counters listed (one per module and two for the router).
const MAX_COUNTERS: u32 = 256;

/// An entry's level, by the names Console gives them.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Level {
    Default,
    Info,
    Debug,
    Error,
    Fault,
}

impl Level {
    pub fn as_str(self) -> &'static str {
        match self {
            Level::Default => "default",
            Level::Info => "info",
            Level::Debug => "debug",
            Level::Error => "error",
            Level::Fault => "fault",
        }
    }
}

/// One entry of the log.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Entry {
    /// Grows with time: `at_ms` times 8, plus the entry's place in its
    /// millisecond.
    pub id: u64,
    pub at_ms: u64,
    /// `default`, `info`, `debug`, `error` or `fault`.
    pub level: String,
    /// Who wrote it: a module's name, or `macalicious-desktop` for the
    /// application itself.
    pub process: String,
    /// What it is about: `request`, `boot`, `site`, or a module's own word.
    pub category: String,
    pub message: String,
}

/// A module's request counts.
#[derive(serde::Serialize, serde::Deserialize, Default, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", default)]
pub struct Counts {
    pub requests: u64,
    pub writes: u64,
    /// Requests answered with a status of 400 or more.
    pub errors: u64,
    /// When the first counted request was answered (epoch ms).
    pub first_ms: u64,
    /// When the last counted request was answered (epoch ms).
    pub last_ms: u64,
    /// The server time and store calls of the requests answered in the last
    /// few minutes ([`crate::timing::add`]), oldest first.
    #[serde(
        skip_serializing_if = "Vec::is_empty",
        deserialize_with = "crate::timing::lenient_minutes"
    )]
    pub minutes: Vec<crate::timing::Minute>,
}

fn log_key(at_ms: u64, slot: u64) -> String {
    // Newest first in key order: the time counts down, and so does the slot.
    format!(
        "{LOG_PREFIX}{:020}-{:02}",
        u64::MAX - at_ms,
        SLOTS - 1 - slot
    )
}

/// Write one entry to the log at `now_ms`.
pub async fn append<'s>(
    store: impl IntoStore<'s>,
    now_ms: u64,
    level: Level,
    process: &str,
    category: &str,
    message: &str,
) -> io::Result<Entry> {
    let mut store = store.into_store();
    let message: String = message.chars().take(MAX_MESSAGE_CHARS).collect();
    for slot in 0..SLOTS {
        let entry = Entry {
            id: now_ms.saturating_mul(SLOTS).saturating_add(slot),
            at_ms: now_ms,
            level: level.as_str().into(),
            process: process.into(),
            category: category.into(),
            message: message.clone(),
        };
        let bytes = serde_json::to_vec(&entry).map_err(io::Error::other)?;
        // Create only: another entry of the same millisecond keeps its slot.
        if store
            .put_if_version_expiring(
                log_key(now_ms, slot).as_bytes(),
                &bytes,
                None,
                now_ms.saturating_add(LOG_TTL_MS),
            )
            .await?
            .is_ok()
        {
            return Ok(entry);
        }
    }
    Err(io::Error::other("too many log entries in one millisecond"))
}

/// The newest `limit` entries (at most [`LOG_LIMIT`]), oldest first.
pub async fn recent<'s>(store: impl IntoStore<'s>, limit: usize) -> io::Result<Vec<Entry>> {
    let mut store = store.into_store();
    let limit = limit.clamp(1, LOG_LIMIT) as u32;
    let (rows, _) = store
        .scan_prefix(LOG_PREFIX.as_bytes(), None, limit)
        .await?;
    let mut entries: Vec<Entry> = rows
        .iter()
        .filter_map(|(_, value, _)| serde_json::from_slice(value).ok())
        .collect();
    entries.reverse();
    Ok(entries)
}

/// Count one request answered for `name` at `now_ms`, with what the router
/// measured of it (`sample`), when it timed it.
pub async fn count(
    store: &mut StoreClusterClient,
    name: &str,
    now_ms: u64,
    write: bool,
    error: bool,
    sample: Option<crate::timing::Sample>,
) -> io::Result<()> {
    let key = format!("{REQUESTS_PREFIX}{name}");
    for _ in 0..CAS_ATTEMPTS {
        let (mut counts, version) = match store.get_versioned(key.as_bytes()).await? {
            // A counter that no longer parses starts again rather than
            // stopping every count after it.
            Some((bytes, version)) => (
                serde_json::from_slice::<Counts>(&bytes).unwrap_or_default(),
                Some(version),
            ),
            None => (Counts::default(), None),
        };
        counts.requests = counts.requests.saturating_add(1);
        if write {
            counts.writes = counts.writes.saturating_add(1);
        }
        if error {
            counts.errors = counts.errors.saturating_add(1);
        }
        if counts.first_ms == 0 {
            counts.first_ms = now_ms;
        }
        counts.last_ms = counts.last_ms.max(now_ms);
        if let Some(sample) = sample {
            crate::timing::add(&mut counts.minutes, now_ms, sample, error);
        }
        let bytes = serde_json::to_vec(&counts).map_err(io::Error::other)?;
        if store
            .put_if_version(key.as_bytes(), &bytes, version)
            .await?
            .is_ok()
        {
            return Ok(());
        }
    }
    Err(io::Error::other(format!(
        "the request counter of '{name}' kept changing; this request is not counted"
    )))
}

/// Every counter, by name.
pub async fn counts<'s>(store: impl IntoStore<'s>) -> io::Result<Vec<(String, Counts)>> {
    let mut store = store.into_store();
    let (rows, _) = store
        .scan_prefix(REQUESTS_PREFIX.as_bytes(), None, MAX_COUNTERS)
        .await?;
    Ok(rows
        .into_iter()
        .filter_map(|(key, value, _)| {
            let key = String::from_utf8(key).ok()?;
            let name = key.strip_prefix(REQUESTS_PREFIX)?.to_string();
            Some((name, serde_json::from_slice(&value).ok()?))
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keys_sort_newest_first_and_slots_in_writing_order_reversed() {
        assert!(log_key(2_000, 0) < log_key(1_000, 0), "later time first");
        assert!(log_key(1_000, 1) < log_key(1_000, 0), "later slot first");
        assert!(log_key(u64::MAX, 0).starts_with(LOG_PREFIX));
        assert_eq!(log_key(0, 0).len(), log_key(u64::MAX, SLOTS - 1).len());
    }

    #[test]
    fn levels_have_console_s_names() {
        let names: Vec<_> = [
            Level::Default,
            Level::Info,
            Level::Debug,
            Level::Error,
            Level::Fault,
        ]
        .iter()
        .map(|level| level.as_str())
        .collect();
        assert_eq!(names, ["default", "info", "debug", "error", "fault"]);
    }

    #[test]
    fn a_counter_of_an_earlier_shape_still_reads() {
        let counts: Counts = serde_json::from_str(r#"{"requests":3}"#).unwrap();
        assert_eq!(counts.requests, 3);
        assert_eq!(counts.errors, 0);
    }
}

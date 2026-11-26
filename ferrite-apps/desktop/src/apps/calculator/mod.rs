//! Calculator's server half: the paper tape, per browser session, and exchange
//! rates for the Convert menu (`rates.rs`).
//!
//! The Calculator demo computes in the browser; this module keeps a session's
//! tape of finished calculations, the record macOS shows under Window > Show
//! Paper Tape.
//!
//! * `GET /api/calculator/rates`: see `rates.rs`.
//! * `GET /api/calculator/tape`: `{"entries": [{expression, result, at_ms}]}`,
//!   oldest first, the newest [`TAPE_LIMIT`].
//! * `POST /api/calculator/tape` with `{"expression": "12+3", "result": "15"}`:
//!   appends one entry and answers `201` with it. When the browser sends its
//!   own `idempotency-key` header (a random key per calculation, such as
//!   `crypto.randomUUID()`), a resend with that key within a day answers `200`
//!   with the same entry and appends nothing. Without the header the request
//!   is simply appended; nothing deduplicates it.
//! * `DELETE /api/calculator/tape`: clears every entry admitted before it.
//!   It is not deduplicated: a resent DELETE clears again, including entries
//!   appended in between.
//!
//! Storage, in the session's own space (so markers of different sessions
//! never meet):
//!
//! * `seq`: the last sequence number handed out, advanced by compare-and-set,
//!   so tape keys (`tape/<seq>`) sort in the order entries were admitted;
//! * `tape/<seq>`: one entry;
//! * `cleared`: the highest sequence number any clear has covered. An entry
//!   at or below it is never shown; an append re-reads the floor after writing
//!   and takes its entry back if a clear overtook it, and pruning deletes any
//!   that remain;
//! * `retry/<hash of the browser's key>`: which entry that key admitted,
//!   claimed with the store's atomic create-if-absent so exactly one delivery
//!   wins, and marked done only after the entry is written and the tape
//!   pruned. A pending marker is finished by the next delivery.

pub mod rates;

use std::io;

use ferrite_app::serde;
use ferrite_app::serde_json;

use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture, Space};

pub const MODULE: AppModule = AppModule {
    name: "calculator",
    title: "Calculator",
    handle,
};

/// The most entries a tape keeps; the oldest go first.
pub const TAPE_LIMIT: usize = 100;
const MAX_EXPRESSION_CHARS: usize = 200;
const MAX_RESULT_CHARS: usize = 64;
/// How long a retry is recognised.
const RETRY_WINDOW_MS: u64 = 24 * 60 * 60 * 1000;
/// Compare-and-set attempts before a write gives up with 503.
const CAS_ATTEMPTS: usize = 16;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Entry {
    pub expression: String,
    pub result: String,
    pub at_ms: u64,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct NewEntry {
    expression: String,
    result: String,
}

/// The retry marker: which entry a request admitted, and whether it is done.
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Admitted {
    seq: u64,
    entry: Entry,
    done: bool,
}

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    let outcome = match (cx.request.method, cx.request.path) {
        ("GET", "/tape") => read_tape(&mut cx.storage.user())
            .await
            .map(|entries| Response::json(200, &serde_json::json!({ "entries": entries }))),
        ("POST", "/tape") => {
            let outcome = append(&mut cx).await;
            // A new entry (201), not a recognised resend (200).
            if matches!(&outcome, Ok(response) if response.status == 201) {
                cx.log(
                    crate::applog::Level::Info,
                    "tape",
                    "appended an entry to a session's paper tape",
                )
                .await;
            }
            outcome
        }
        ("DELETE", "/tape") => {
            let outcome = clear(&mut cx).await;
            if matches!(&outcome, Ok(response) if response.status < 300) {
                cx.log(
                    crate::applog::Level::Info,
                    "tape",
                    "cleared a session's paper tape",
                )
                .await;
            }
            outcome
        }
        (_, "/tape") => Ok(Response::method_not_allowed()),
        ("GET", "/rates") => Ok(rates::answer(&mut cx).await),
        (_, "/rates") => Ok(Response::method_not_allowed()),
        _ => Ok(Response::not_found()),
    };
    outcome.unwrap_or_else(|error| Response::error(503, &format!("storage failed: {error}")))
}

fn tape_key(seq: u64) -> String {
    format!("tape/{seq:016}")
}

fn seq_of(key: &str) -> Option<u64> {
    key.strip_prefix("tape/")?.parse().ok()
}

fn invalid(e: impl ToString) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, e.to_string())
}

/// The newest [`TAPE_LIMIT`] entries above the clear floor, oldest first.
async fn read_tape(user: &mut Space<'_>) -> io::Result<Vec<Entry>> {
    let floor = counter(user, "cleared").await?;
    let rows: Vec<_> = user
        .list("tape/", usize::MAX)
        .await?
        .into_iter()
        .filter(|(key, _)| seq_of(key).is_some_and(|seq| seq > floor))
        .collect();
    let skip = rows.len().saturating_sub(TAPE_LIMIT);
    Ok(rows
        .iter()
        .skip(skip)
        .filter_map(|(_, value)| serde_json::from_slice(value).ok())
        .collect())
}

/// Delete every entry at or below the clear floor, then all but the newest
/// [`TAPE_LIMIT`] of the rest.
async fn prune(user: &mut Space<'_>) -> io::Result<()> {
    let floor = counter(user, "cleared").await?;
    let rows = user.list("tape/", usize::MAX).await?;
    let (covered, live): (Vec<_>, Vec<_>) = rows
        .into_iter()
        .partition(|(key, _)| seq_of(key).is_none_or(|seq| seq <= floor));
    let excess = live.len().saturating_sub(TAPE_LIMIT);
    for (key, _) in covered.iter().chain(live.iter().take(excess)) {
        user.delete(key).await?;
    }
    Ok(())
}

/// A `u64` counter at `key` (absent reads as 0), raised to at least `floor`
/// or by one when `floor` is `None`; returns the new value.
async fn advance(user: &mut Space<'_>, key: &str, floor: Option<u64>) -> io::Result<u64> {
    for _ in 0..CAS_ATTEMPTS {
        let current = user.get_versioned(key).await?;
        let (value, version) = match &current {
            Some((bytes, version)) => (
                serde_json::from_slice::<u64>(bytes).map_err(invalid)?,
                Some(*version),
            ),
            None => (0, None),
        };
        let next = match floor {
            Some(floor) if floor <= value => return Ok(value),
            Some(floor) => floor,
            None => value + 1,
        };
        if user
            .put_if_version(key, next.to_string().as_bytes(), version)
            .await?
        {
            return Ok(next);
        }
    }
    Err(io::Error::other(format!(
        "{key}: too much contention; retry"
    )))
}

async fn counter(user: &mut Space<'_>, key: &str) -> io::Result<u64> {
    match user.get(key).await? {
        Some(bytes) => serde_json::from_slice(&bytes).map_err(invalid),
        None => Ok(0),
    }
}

async fn append(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let new = match cx.request.json::<NewEntry>() {
        Ok(new) => new,
        Err(response) => return Ok(response),
    };
    let entry = match validate(new, cx.now_ms) {
        Ok(entry) => entry,
        Err(message) => return Ok(Response::error(400, &message)),
    };
    let mut user = cx.storage.user();
    let Some(key) = cx.request.idempotency_key else {
        // No key of the browser's own: append once, with no marker.
        let seq = advance(&mut user, "seq", None).await?;
        write_entry(&mut user, seq, &entry).await?;
        prune(&mut user).await?;
        return Ok(Response::json(201, &entry));
    };
    let retry_key = format!("retry/{}", short_hash(key));
    let expires = cx.now_ms + RETRY_WINDOW_MS;

    if let Some(seen) = user.get_json::<Admitted>(&retry_key).await? {
        return replay(&mut user, &retry_key, seen, expires).await;
    }
    let seq = advance(&mut user, "seq", None).await?;
    let claim = Admitted {
        seq,
        entry,
        done: false,
    };
    let bytes = serde_json::to_vec(&claim).map_err(invalid)?;
    if !user.create_expiring(&retry_key, &bytes, expires).await? {
        // Another delivery of the same request claimed the key first; its
        // entry is the one this request admitted. (`seq` stays unused.)
        let seen = user
            .get_json::<Admitted>(&retry_key)
            .await?
            .ok_or_else(|| io::Error::other("the retry marker vanished; retry"))?;
        return replay(&mut user, &retry_key, seen, expires).await;
    }
    let entry = claim.entry.clone();
    complete(&mut user, &retry_key, claim, expires).await?;
    Ok(Response::json(201, &entry))
}

/// Answer a repeated request. A done marker only replies; a pending one (its
/// first delivery may have died before writing) is completed first.
async fn replay(
    user: &mut Space<'_>,
    retry_key: &str,
    seen: Admitted,
    expires: u64,
) -> io::Result<Response> {
    let entry = seen.entry.clone();
    if !seen.done {
        complete(user, retry_key, seen, expires).await?;
    }
    Ok(Response::json(200, &entry))
}

/// Write a claimed entry, prune the tape, then mark the claim done. Every
/// step is idempotent, so two deliveries completing the same claim agree, and
/// a delivery that dies or fails partway leaves the claim pending for the next
/// one to finish.
async fn complete(
    user: &mut Space<'_>,
    retry_key: &str,
    mut claim: Admitted,
    expires: u64,
) -> io::Result<()> {
    write_entry(user, claim.seq, &claim.entry).await?;
    prune(user).await?;
    claim.done = true;
    let bytes = serde_json::to_vec(&claim).map_err(invalid)?;
    user.put_expiring(retry_key, &bytes, expires).await?;
    Ok(())
}

/// Write entry `seq` unless a clear already covers it.
async fn write_entry(user: &mut Space<'_>, seq: u64, entry: &Entry) -> io::Result<()> {
    if seq > counter(user, "cleared").await? {
        let key = tape_key(seq);
        user.put_json(&key, entry).await?;
        // A clear may have raised the floor after the read above and finished
        // its scan before this write landed. The floor only rises, so reading
        // it again after the write sees any such clear: take the entry back.
        if seq <= counter(user, "cleared").await? {
            user.delete(&key).await?;
        }
    }
    Ok(())
}

async fn clear(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let mut user = cx.storage.user();
    // Everything admitted so far. Not deduplicated: a resent DELETE clears
    // again (see the module documentation).
    let boundary = counter(&mut user, "seq").await?;
    // Raise the floor first: from then on every entry at or below it is
    // hidden, and an append that writes one later takes it back. Then delete
    // what is below it.
    advance(&mut user, "cleared", Some(boundary)).await?;
    for (key, _) in user.list("tape/", usize::MAX).await? {
        if seq_of(&key).is_some_and(|seq| seq <= boundary) {
            user.delete(&key).await?;
        }
    }
    let entries = read_tape(&mut user).await?;
    Ok(Response::json(
        200,
        &serde_json::json!({ "entries": entries }),
    ))
}

/// Trim and bound a submitted entry.
fn validate(new: NewEntry, now_ms: u64) -> Result<Entry, String> {
    let expression = new.expression.trim();
    let result = new.result.trim();
    if expression.is_empty() || expression.chars().count() > MAX_EXPRESSION_CHARS {
        return Err(format!(
            "expression must be 1 to {MAX_EXPRESSION_CHARS} characters"
        ));
    }
    if result.is_empty() || result.chars().count() > MAX_RESULT_CHARS {
        return Err(format!("result must be 1 to {MAX_RESULT_CHARS} characters"));
    }
    Ok(Entry {
        expression: expression.to_string(),
        result: result.to_string(),
        at_ms: now_ms,
    })
}

fn short_hash(text: &str) -> String {
    let digest = ferrite_app::crypto::sha256(text.as_bytes());
    ferrite_app::crypto::hex(&digest[..8])
}

#[cfg(test)]
mod tests {
    use super::*;

    fn new(expression: &str, result: &str) -> NewEntry {
        NewEntry {
            expression: expression.into(),
            result: result.into(),
        }
    }

    #[test]
    fn an_entry_is_trimmed_and_stamped() {
        let entry = validate(new("  12 + 3 ", " 15"), 1_700_000_000_000).unwrap();
        assert_eq!(
            entry,
            Entry {
                expression: "12 + 3".into(),
                result: "15".into(),
                at_ms: 1_700_000_000_000
            }
        );
    }

    #[test]
    fn empty_or_oversized_entries_are_refused() {
        assert!(validate(new("   ", "1"), 0).is_err());
        assert!(validate(new("1+1", ""), 0).is_err());
        assert!(validate(new(&"9".repeat(201), "9"), 0).is_err());
        assert!(
            validate(new(&"9".repeat(200), "9"), 0).is_ok(),
            "200 characters is the limit"
        );
        assert!(validate(new("1", &"9".repeat(65)), 0).is_err());
    }

    #[test]
    fn tape_keys_sort_by_sequence_and_parse_back() {
        assert!(
            tape_key(9) < tape_key(10),
            "zero padding keeps numeric order"
        );
        assert_eq!(seq_of(&tape_key(42)), Some(42));
        assert_eq!(seq_of("tape/x"), None);
    }
}

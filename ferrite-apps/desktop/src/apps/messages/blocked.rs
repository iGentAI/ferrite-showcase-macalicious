//! Buddies > Block Person: the accounts a person does not hear from.
//!
//! Each is a key `blocked/<account name>` in the person's own Messages space,
//! which nobody else's request reaches, holding the spans of time it was
//! blocked ([`Record`]). A message written during a span never shows to the
//! person who blocked its writer, tells them nothing and counts as nothing
//! unread; its writer sees it Delivered, as on a Mac, and is not told. A
//! message written while blocked stays out of sight after an unblock, which is
//! why a record outlives its last span. Past [`SPANS`] of them the oldest two
//! join, so that what was hidden stays hidden, with what was said between them.
//! A record that cannot be understood counts as blocked since the beginning
//! ([`Record::read`]).
//!
//! `GET /api/messages/blocked` lists who is blocked now; `PUT
//! /api/messages/blocked/<name>` with `{"blocked": true|false}` sets one.

use ferrite_app::{serde, serde_json};

use super::MODULE;
use crate::http::Response;
use crate::module::{ApiCtx, Space, Storage};

/// The most accounts a person can start a record of. Two requests at once can pass it by one, so
/// reading does not stop here: [`load`] reads every record there is.
const BLOCKED_LIMIT: usize = 200;
/// The most spans one record holds.
const SPANS: usize = 256;
const CAS_ATTEMPTS: usize = 16;

fn key(name: &str) -> String {
    format!("blocked/{name}")
}

/// One blocked account as stored.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, Default, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
struct Record {
    #[serde(default)]
    full_name: String,
    /// From when to when, oldest first; the last has no end while it lasts.
    spans: Vec<(u64, Option<u64>)>,
}

impl Record {
    /// A stored record; one that cannot be understood hides all that its account ever wrote, so
    /// that damage never shows what a person blocked. Unblocking ends that span and writes a
    /// record that can be read.
    fn read(bytes: &[u8]) -> Self {
        let closed = || Self {
            full_name: String::new(),
            spans: vec![(0, None)],
        };
        match serde_json::from_slice::<Self>(bytes) {
            Ok(record) if record.in_order() => record,
            Ok(_) => {
                ferrite_app::tracing::warn!("a blocked record's spans were out of order");
                closed()
            }
            Err(error) => {
                ferrite_app::tracing::warn!(%error, "a blocked record could not be read");
                closed()
            }
        }
    }

    /// Whether each span ends after it starts and before the next, and only the last is open.
    fn in_order(&self) -> bool {
        let mut after = 0;
        let last = self.spans.len().saturating_sub(1);
        self.spans.iter().enumerate().all(|(at, (from, until))| {
            let fits = *from >= after && until.map_or(at == last, |until| until >= *from);
            after = until.unwrap_or(*from);
            fits
        })
    }

    fn blocked_now(&self) -> bool {
        self.spans.last().is_some_and(|(_, until)| until.is_none())
    }

    fn hides(&self, at_ms: u64) -> bool {
        self.spans
            .iter()
            .any(|(from, until)| *from <= at_ms && until.is_none_or(|until| at_ms < until))
    }

    /// Starts or ends the span; whether the record changed. A request that took its time and is
    /// older than the last change came before it, and changes nothing.
    fn set(&mut self, blocked: bool, now_ms: u64) -> bool {
        if blocked == self.blocked_now() {
            return false;
        }
        let changed = self
            .spans
            .last()
            .map_or(0, |(from, until)| until.unwrap_or(*from));
        if now_ms < changed {
            return false;
        }
        if blocked {
            if self.spans.len() >= SPANS {
                let (_, until) = self.spans.remove(1);
                self.spans[0].1 = until;
            }
            self.spans.push((now_ms, None));
        } else if let Some(last) = self.spans.last_mut() {
            last.1 = Some(now_ms);
        }
        true
    }
}

/// Everyone a person has a record of, read once per request.
#[derive(Clone, Debug, Default)]
pub struct Blocks(Vec<(String, Record)>);

impl Blocks {
    /// Whether a message `author` wrote at `at_ms` stays out of this person's sight.
    pub fn hides(&self, author: &str, at_ms: u64) -> bool {
        self.0
            .iter()
            .any(|(name, record)| name == author && record.hides(at_ms))
    }

    /// Whether the person has a record of anyone.
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    /// Whether `name` is blocked now.
    pub fn now(&self, name: &str) -> bool {
        self.0
            .iter()
            .any(|(each, record)| each == name && record.blocked_now())
    }
}

/// A person's records, all of them.
pub async fn load(space: &mut Space<'_>) -> std::io::Result<Blocks> {
    let entries = space.list("blocked/", usize::MAX).await?;
    Ok(Blocks(
        entries
            .into_iter()
            .filter_map(|(key, value)| {
                let name = key.strip_prefix("blocked/")?.to_string();
                Some((name, Record::read(&value)))
            })
            .collect(),
    ))
}

/// Whether `principal` has blocked `author` at `at_ms`.
pub async fn hides_from(
    cx: &mut ApiCtx<'_>,
    principal: &str,
    author: &str,
    at_ms: u64,
) -> std::io::Result<bool> {
    let mut storage = Storage::new(cx.storage.store(), MODULE.name, principal);
    let found = storage.user().get(&key(author)).await?;
    Ok(found.is_some_and(|bytes| Record::read(&bytes).hides(at_ms)))
}

/// Route a request under `/api/messages/blocked`; `None` when the path is elsewhere.
pub async fn route(cx: &mut ApiCtx<'_>) -> Option<Response> {
    let path = cx.request.path.trim_end_matches('/').to_string();
    let rest = path.strip_prefix("/blocked")?;
    let name = match rest {
        "" => None,
        rest => Some(rest.strip_prefix('/')?.to_string()),
    };
    if cx.session.account.is_none() {
        return Some(match (cx.request.method, &name) {
            ("GET", None) => Response::json(200, &serde_json::json!({ "blocked": [] })),
            _ => Response::error(401, "sign in to block someone"),
        });
    }
    Some(match (cx.request.method, name) {
        ("GET", None) => list(cx).await,
        ("PUT", Some(name)) => set(cx, &name).await,
        _ => Response::method_not_allowed(),
    })
}

async fn list(cx: &mut ApiCtx<'_>) -> Response {
    match load(&mut cx.storage.user()).await {
        Ok(Blocks(records)) => {
            let blocked: Vec<_> = records
                .iter()
                .filter(|(_, record)| record.blocked_now())
                .map(|(name, record)| {
                    serde_json::json!({ "name": name, "full_name": record.full_name })
                })
                .collect();
            Response::json(200, &serde_json::json!({ "blocked": blocked }))
        }
        Err(error) => storage_error(error),
    }
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Blocking {
    blocked: bool,
}

async fn set(cx: &mut ApiCtx<'_>, name: &str) -> Response {
    let Blocking { blocked } = match cx.request.json::<Blocking>() {
        Ok(body) => body,
        Err(response) => return response,
    };
    let found = match crate::accounts::lookup(cx.storage.store(), name).await {
        Ok(Some(found)) => found,
        Ok(None) => return Response::error(404, "no account of this desktop has that name"),
        Err(error) => return storage_error(error),
    };
    if found.id == cx.session.principal {
        return Response::error(400, "you cannot block yourself");
    }
    let now_ms = cx.now_ms;
    let by = cx.session.id.clone();
    let principal = cx.session.principal.clone();
    for _ in 0..CAS_ATTEMPTS {
        let mut space = cx.storage.user();
        let stored = match space.get_versioned(&key(&found.name)).await {
            Ok(stored) => stored,
            Err(error) => return storage_error(error),
        };
        let mut record = stored
            .as_ref()
            .map(|(bytes, _)| Record::read(bytes))
            .unwrap_or_default();
        record.full_name = found.full_name.clone();
        let changed = record.set(blocked, now_ms);
        // What holds now, which a request older than the last change did not alter.
        let answer = serde_json::json!({ "name": found.name, "blocked": record.blocked_now() });
        if !changed {
            return Response::json(200, &answer);
        }
        if stored.is_none() {
            match space.list("blocked/", BLOCKED_LIMIT).await {
                Ok(held) if held.len() >= BLOCKED_LIMIT => {
                    return Response::error(409, "you have blocked the most people you can");
                }
                Ok(_) => {}
                Err(error) => return storage_error(error),
            }
        }
        let bytes = match serde_json::to_vec(&record) {
            Ok(bytes) => bytes,
            Err(error) => return Response::error(500, &error.to_string()),
        };
        match space
            .put_if_version(
                &key(&found.name),
                &bytes,
                stored.map(|(_, version)| version),
            )
            .await
        {
            Ok(true) => {
                if let Err(error) = super::super::notification_center::touched(
                    cx.storage.store(),
                    &principal,
                    MODULE.name,
                    &by,
                    now_ms,
                )
                .await
                {
                    ferrite_app::tracing::warn!(%error, "other browsers were not told to reload");
                }
                return Response::json(200, &answer);
            }
            Ok(false) => continue,
            Err(error) => return storage_error(error),
        }
    }
    Response::error(503, "the setting is busy; retry")
}

fn storage_error(error: std::io::Error) -> Response {
    ferrite_app::tracing::warn!(%error, "who is blocked was not read or kept");
    Response::error(503, "who is blocked could not be kept just now; try again")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_message_written_while_blocked_stays_hidden_after_an_unblock() {
        let mut record = Record::default();
        assert!(record.set(true, 100));
        assert!(!record.set(true, 110), "already blocked");
        assert!(record.blocked_now());
        assert!(record.hides(100));
        assert!(!record.hides(99), "said before the block");
        assert!(record.set(false, 200));
        assert!(!record.blocked_now());
        assert!(record.hides(150));
        assert!(!record.hides(200), "said after the unblock");
        assert!(!record.set(false, 210), "already unblocked");
    }

    #[test]
    fn every_span_stays_hidden_however_often_someone_is_unblocked() {
        let mut record = Record::default();
        for at in 0..SPANS as u64 + 4 {
            assert!(record.set(true, 100 + at * 10));
            assert!(record.set(false, 105 + at * 10));
        }
        assert!(!record.blocked_now(), "the last unblock held");
        assert!(record.spans.len() <= SPANS);
        assert!(record.hides(100), "the first span still hides");
        assert!(record.hides(100 + 10 * (SPANS as u64 + 3)), "and the last");
        assert!(
            !record.hides(100 + 10 * (SPANS as u64 + 3) + 5),
            "after the last"
        );
    }

    #[test]
    fn a_record_out_of_order_hides_everything_until_unblocked() {
        for spans in [
            serde_json::json!([[200, 100]]),
            serde_json::json!([[100, null], [200, 300]]),
            serde_json::json!([[300, 400], [100, 200]]),
        ] {
            let bytes = serde_json::json!({ "full_name": "", "spans": spans }).to_string();
            let record = Record::read(bytes.as_bytes());
            assert!(record.blocked_now(), "{bytes}");
            assert!(record.hides(0), "{bytes}");
        }
        let fine = br#"{"full_name":"","spans":[[100,200],[200,null]]}"#;
        assert_eq!(
            Record::read(fine).spans,
            vec![(100, Some(200)), (200, None)]
        );
    }

    #[test]
    fn a_late_request_changes_nothing_of_what_came_after_it() {
        let mut record = Record::default();
        record.set(true, 200);
        assert!(!record.set(false, 100), "an unblock from before the block");
        assert!(record.blocked_now());
        assert!(record.hides(250));
        assert!(record.set(false, 300));
        assert!(!record.set(true, 250), "a block from before the unblock");
        assert!(record.hides(250));
        assert!(!record.hides(300));
    }

    #[test]
    fn a_damaged_record_hides_everything_until_unblocked() {
        let mut record = Record::read(b"not json");
        assert!(record.blocked_now());
        assert!(record.hides(0));
        assert!(record.set(false, 500));
        assert!(record.hides(499));
        assert!(!record.hides(500));
        let kept = serde_json::to_vec(&record).unwrap();
        assert_eq!(Record::read(&kept), record);
    }

    #[test]
    fn blocks_name_one_author() {
        let mut record = Record::default();
        record.set(true, 100);
        let blocks = Blocks(vec![("bob".into(), record)]);
        assert!(blocks.hides("bob", 100));
        assert!(!blocks.hides("ann", 100));
        assert!(blocks.now("bob"));
        assert!(!blocks.now("ann"));
    }
}

//! Live updates: the `/live/` stream route (server-sent events).
//!
//! A module that wants its pages to update without a reload declares a
//! [`LiveFeed`] in `src/apps/mod.rs` ([`crate::apps::FEEDS`]). A feed names
//! one document in the module's shared space for each subscription path. A
//! browser opens `new EventSource("/live/<app>/<rest>")`, and this loop
//! answers with a `state` event holding the document as the feed renders it,
//! then another `state` event every time the document's store version
//! changes. Every event carries the whole current state, so a page that missed
//! one, or reconnected, loses nothing by taking the latest.
//!
//! How it is built, and why:
//!
//! * One loop consumes the `live` queue, where the gateway publishes each
//!   subscription's OPEN (`GET`) and its `STREAM_CLOSE`. An OPEN's first frame
//!   is published before its lease is acked, as the API workers reply before
//!   they ack, so an OPEN that could not be answered is redelivered.
//! * Each admitted subscription gets a producer task that reads the
//!   document's version every [`POLL_MS`]. Reading the store, rather than
//!   passing notes between tasks, keeps it right with more than one instance
//!   and across restarts: whichever process wrote, the version moves.
//! * The producer sends a `ping` event after [`PING_MS`] without a change. A
//!   process that dies (a deploy, or `ferrite dev --chaos`) leaves the
//!   gateway's connection open but silent, so a page that hears nothing for a
//!   few pings reconnects, and its new OPEN starts a producer in the live
//!   process. A subscription ends itself after [`LIFETIME_MS`], with a
//!   terminal `ended` event, so no producer outlives its bound even if its
//!   close is never delivered; `EventSource` reconnects by itself.
//!
//! What the stream face does not carry (upstream Core): no request header
//! reaches the app on an OPEN, so there is no session here. A feed is
//! therefore public to anyone who can name it: it serves shared documents
//! only, never a session's own space. The reply head is always
//! `200 text/event-stream`, so a refusal is a terminal `refused` event.
//!
//! The one personal stream, `/live/me?ticket=<ticket>`, is how a person's own
//! updates reach their browsers: the page asks the router for a single-use
//! ticket (`POST /api/session/ticket`) and opens the stream with it; the
//! ticket is redeemed once here, for that stream open (a redelivery of the
//! same open after a failure redeems it again), and names the person and the session
//! (`src/apps/notification_center/mod.rs`). Its producer sends that person's
//! notifications and change counts (`notification_center::personal_state`)
//! and, every [`SESSION_CHECK_MS`], checks that the session is still signed
//! in to that person and unlocked, ending the subscription when it is not.

use std::collections::HashMap;
use std::time::Duration;

use ferrite_app::{rt, serde_json, tracing, AppContext, IngressRequest, StreamFrame};

use crate::module::Storage;

/// The stream-request queue the `/live/` route publishes to.
pub const LIVE_BINDING: &str = "live";
/// The route prefix.
pub const LIVE_PREFIX: &str = "/live/";
/// The personal stream's path; its ticket is the query parameter `ticket`.
pub const PERSONAL_PATH: &str = "/live/me";
/// How often a personal subscription checks that its session still belongs
/// to the same person and is unlocked.
pub const SESSION_CHECK_MS: u64 = 5_000;
/// How often a personal subscription looks for Calendar and Reminders alerts
/// that are due (`apps/calendar/alerts.rs`, `apps/reminders/mod.rs`).
pub const ALERT_SCAN_MS: u64 = 10_000;
/// Milliseconds between two reads of a subscription's document.
pub const POLL_MS: u64 = 250;
/// Milliseconds without a change before a `ping` event.
pub const PING_MS: u64 = 5_000;
/// The longest one subscription lasts before it ends itself.
pub const LIFETIME_MS: u64 = 5 * 60_000;
/// Subscriptions one process serves at once; an OPEN beyond that is told
/// `busy` and ended, and its `EventSource` tries again later.
pub const MAX_SUBSCRIPTIONS: usize = 128;
/// The longest one frame publication may take before it counts as failed.
const PUBLISH_TIMEOUT_MS: u64 = 5_000;
/// The longest one read of a subscription's document may take.
const READ_TIMEOUT_MS: u64 = 2_000;
/// Consecutive failed publications after which a producer gives up.
const PUBLISH_FAILURES: u32 = 3;
/// Consecutive failed reads (an error or a timeout) after which a producer
/// ends its subscription, so the page reconnects instead of hearing pings
/// over a document nobody can read.
const READ_FAILURES: u32 = 3;

/// One module's live documents.
pub struct LiveFeed {
    /// The module's name: the URL segment after `/live/` and the storage
    /// namespace the document is read from.
    pub app: &'static str,
    /// The key in the module's shared space ([`Storage::shared`]) for the
    /// rest of the path after `/live/<app>/` (query removed), or `None` when
    /// the path names no document.
    pub key: fn(&str) -> Option<String>,
    /// The document as a page sees it: the stored bytes, or `None` while the
    /// key is absent.
    pub view: fn(Option<&[u8]>) -> serde_json::Value,
}

impl std::fmt::Debug for LiveFeed {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("LiveFeed").field("app", &self.app).finish()
    }
}

/// What an OPEN's path asks for.
#[derive(Debug)]
pub enum Target {
    Feed(&'static LiveFeed, String),
    /// The personal stream, with the ticket the path carries.
    Personal(String),
    Invalid(&'static str),
}

/// Read the feed and document key, or the personal stream's ticket, from a
/// subscription path.
pub fn target(feeds: &'static [LiveFeed], path: &str) -> Target {
    let (route, query) = path.split_once('?').unwrap_or((path, ""));
    if route == PERSONAL_PATH {
        return match query
            .split('&')
            .find_map(|pair| pair.strip_prefix("ticket="))
        {
            Some(ticket) if !ticket.is_empty() => Target::Personal(ticket.to_string()),
            _ => Target::Invalid(
                "the personal stream opens with a ticket from POST /api/session/ticket",
            ),
        };
    }
    let Some(rest) = route.strip_prefix(LIVE_PREFIX) else {
        return Target::Invalid("live subscriptions are under /live/<app>/");
    };
    let (app, rest) = rest.split_once('/').unwrap_or((rest, ""));
    let Some(feed) = feeds.iter().find(|feed| feed.app == app) else {
        return Target::Invalid("no app has a live feed by that name");
    };
    match (feed.key)(rest) {
        Some(key) => Target::Feed(feed, key),
        None => Target::Invalid("the path names no live document of this app"),
    }
}

/// A frame's body: the document's version and its view.
pub fn state_data(version: u64, view: serde_json::Value) -> Vec<u8> {
    serde_json::json!({ "version": version, "state": view })
        .to_string()
        .into_bytes()
}

fn frame(correlation_id: &str, event: &str, data: Vec<u8>, done: bool) -> StreamFrame {
    StreamFrame {
        correlation_id: correlation_id.to_string(),
        event: Some(event.to_string()),
        data,
        done,
    }
}

/// Publishing one frame the way the SDK this crate is built against wants it.
///
/// Ferrite Cloud's gateway ends a session at any frame that carries no number,
/// though the queue accepts that frame, so a plain `publish` closes the stream
/// with nothing delivered. The hosted builder's SDK numbers frames through
/// `ferrite_app::FramePublish`. The local twin in CLI 0.1.20 has no such trait,
/// and its Forge takes plain frames. The glob import brings the trait in only
/// where it exists, and the same source compiles against both: for a receiver
/// of type `&mut QueueClusterClient`, Rust tries the SDK trait's method (whose
/// `self` is exactly that type) before `PlainPublish`'s (one `&mut` further).
/// Delete this module, and call `FramePublish` directly, once the pinned CLI's
/// twin has the trait.
mod frame_publish {
    use ferrite_app::client::QueueClusterClient;
    use ferrite_app::*;

    pub(super) trait PlainPublish {
        async fn publish_frame(&mut self, frame: &StreamFrame) -> std::io::Result<()>;
    }

    impl PlainPublish for &mut QueueClusterClient {
        async fn publish_frame(&mut self, frame: &StreamFrame) -> std::io::Result<()> {
            let encoded = serde_json::to_vec(frame).map_err(std::io::Error::other)?;
            self.publish(&encoded).await.map(|_| ())
        }
    }

    pub(super) async fn publish(
        queue: &mut QueueClusterClient,
        frame: &StreamFrame,
    ) -> std::io::Result<()> {
        // `mut` is needed only when `PlainPublish` is the method chosen.
        #[allow(unused_mut)]
        let mut queue = queue;
        queue.publish_frame(frame).await
    }
}

/// Encode and publish one frame within [`PUBLISH_TIMEOUT_MS`].
async fn publish(ctx: &AppContext, reply_to: &str, frame: &StreamFrame) -> bool {
    let attempt = async {
        match ctx.reply_to_queue(reply_to).await {
            Ok(mut frames) => frame_publish::publish(&mut frames, frame).await.is_ok(),
            Err(_) => false,
        }
    };
    rt::time::timeout(Duration::from_millis(PUBLISH_TIMEOUT_MS), attempt)
        .await
        .unwrap_or(false)
}

/// What one subscription reads.
enum Source {
    /// A feed's shared document.
    Shared(&'static LiveFeed, String),
    /// A person's notifications and change counts, for one session.
    Personal { principal: String, session: String },
}

/// The source's version (0 while absent) and its view.
async fn read(
    store: &mut ferrite_app::client::StoreClusterClient,
    source: &Source,
) -> std::io::Result<(u64, serde_json::Value)> {
    match source {
        Source::Shared(feed, key) => {
            let mut storage = Storage::new(store, feed.app, "");
            let stored = storage.shared().get_versioned(key).await?;
            Ok(match stored {
                Some((bytes, version)) => (version, (feed.view)(Some(&bytes))),
                None => (0, (feed.view)(None)),
            })
        }
        Source::Personal { principal, .. } => {
            crate::apps::notification_center::personal_state(store, principal).await
        }
    }
}

/// Whether a personal subscription's session still belongs to its person:
/// `Some(false)` when it does not (signed out, switched, locked or expired),
/// `None` when that could not be read in time. Shared feeds always do.
async fn still_allowed(
    ctx: &AppContext,
    store: &mut ferrite_app::client::StoreClusterClient,
    source: &Source,
) -> Option<bool> {
    let Source::Personal { principal, session } = source else {
        return Some(true);
    };
    let check = crate::session::live_principal(store, session, ctx.now_ms());
    match rt::time::timeout(Duration::from_millis(READ_TIMEOUT_MS), check).await {
        Ok(Ok(current)) => Some(current.as_deref() == Some(principal.as_str())),
        _ => None,
    }
}

/// One subscription after its first frame: a `state` event per change, a
/// `ping` after a quiet [`PING_MS`], `ended` after [`LIFETIME_MS`].
///
/// Lifetime and quiet are measured on the platform clock (`now_ms`), not by
/// adding up sleeps, and every read and publication is bounded, so a slow or
/// hung store cannot keep a producer past its lifetime or silence its pings.
///
/// With more than one instance, the OPEN and the close of one subscription
/// can reach different processes, so a producer may miss its close, and a
/// redelivered OPEN may start a second producer elsewhere. Both are bounded:
/// the producer ends at its lifetime deadline whatever happens, and every
/// frame carries the whole state with the store's version, so a page keeps
/// the newest version it has seen and a duplicate frame changes nothing.
async fn produce(
    ctx: AppContext,
    reply_to: String,
    correlation_id: String,
    source: Source,
    mut last: u64,
) {
    let Ok(mut store) = ctx.store(crate::DATA_BINDING) else {
        return;
    };
    let started = ctx.now_ms();
    let deadline = started.saturating_add(LIFETIME_MS);
    let mut heard = started;
    let mut checked = started;
    let mut scanned = 0;
    let mut failures = 0;
    let mut read_failures = 0;
    loop {
        ferrite_app::sleep_ms(POLL_MS).await;
        let now = ctx.now_ms();
        if now >= deadline {
            break;
        }
        // A personal subscription ends once its session no longer belongs to
        // its person; the page then asks for a new ticket, which only the
        // person signed in now can get.
        if now.saturating_sub(checked) >= SESSION_CHECK_MS {
            match still_allowed(&ctx, &mut store, &source).await {
                Some(true) => checked = now,
                Some(false) => break,
                // Unknown: asked again next round, and counted like a
                // failed read so a store that stays unreadable ends it.
                None => {
                    read_failures += 1;
                    if read_failures >= READ_FAILURES {
                        break;
                    }
                    continue;
                }
            }
        }
        if let Source::Personal { principal, .. } = &source {
            if now.saturating_sub(scanned) >= ALERT_SCAN_MS {
                scanned = now;
                let raise = async {
                    crate::apps::calendar::raise_due_alerts(&mut store, principal, now).await?;
                    crate::apps::reminders::raise_due_alerts(&mut store, principal, now).await
                };
                let raised = rt::time::timeout(Duration::from_millis(READ_TIMEOUT_MS), raise).await;
                // Left for the next pass, with a fresh client: the stream's own
                // reads say whether the store can be read at all.
                if !matches!(raised, Ok(Ok(()))) {
                    tracing::warn!(correlation_id, "alerts left for the next pass");
                    if let Ok(fresh) = ctx.store(crate::DATA_BINDING) {
                        store = fresh;
                    }
                }
            }
        }
        let budget = (deadline - now).min(READ_TIMEOUT_MS);
        let read =
            rt::time::timeout(Duration::from_millis(budget), read(&mut store, &source)).await;
        let next = match read {
            Ok(Ok((version, view))) => {
                read_failures = 0;
                (version != last).then(|| {
                    (
                        version,
                        frame(&correlation_id, "state", state_data(version, view), false),
                    )
                })
            }
            // A read that failed or ran out of time: start over with a fresh
            // client, and send nothing for this round, not even a ping. After
            // `READ_FAILURES` in a row the subscription ends (`ended`, below),
            // so the page reconnects; its new OPEN is left unacked while the
            // store stays unreadable, and is redelivered.
            Ok(Err(_)) | Err(_) => {
                read_failures += 1;
                if read_failures >= READ_FAILURES {
                    tracing::warn!(correlation_id, "live subscription ended after failed reads");
                    break;
                }
                match ctx.store(crate::DATA_BINDING) {
                    Ok(fresh) => store = fresh,
                    Err(_) => break,
                }
                continue;
            }
        };
        let quiet = ctx.now_ms().saturating_sub(heard);
        let (version, outgoing) = match next {
            Some((version, outgoing)) => (Some(version), outgoing),
            None if quiet >= PING_MS => {
                (None, frame(&correlation_id, "ping", b"{}".to_vec(), false))
            }
            None => continue,
        };
        if publish(&ctx, &reply_to, &outgoing).await {
            failures = 0;
            heard = ctx.now_ms();
            if let Some(version) = version {
                last = version;
            }
        } else {
            failures += 1;
            if failures >= PUBLISH_FAILURES {
                tracing::warn!(
                    correlation_id,
                    "live subscription gave up after failed publications"
                );
                return;
            }
        }
    }
    let ended = frame(&correlation_id, "ended", b"{}".to_vec(), true);
    let _ = publish(&ctx, &reply_to, &ended).await;
}

/// Every producer of one loop, by correlation id; dropping it stops them.
struct Producers(HashMap<String, rt::JoinHandle<()>>);

impl Drop for Producers {
    fn drop(&mut self) {
        for (_, task) in self.0.drain() {
            task.abort();
        }
    }
}

/// Serve the `/live/` route until its queue fails. Returns at once with an
/// error when the spec binds no `live` queue.
pub async fn run(ctx: AppContext, feeds: &'static [LiveFeed]) -> std::io::Result<()> {
    let mut requests = ctx.queue(LIVE_BINDING)?;
    let mut store = ctx.store(crate::DATA_BINDING)?;
    let mut producers = Producers(HashMap::new());
    loop {
        let Some(lease) = requests.poll_wait(1_000).await? else {
            producers.0.retain(|_, task| !task.is_finished());
            continue;
        };
        let Ok(req) = serde_json::from_slice::<IngressRequest>(&lease.payload) else {
            let _ = requests.ack(lease.token).await;
            continue;
        };
        producers.0.retain(|_, task| !task.is_finished());
        // A redelivered OPEN replaces its producer, and a close stops it.
        if let Some(task) = producers.0.remove(&req.correlation_id) {
            task.abort();
        }
        if req.method != "GET" {
            // STREAM_CLOSE, or a verb this route does not use.
            let _ = requests.ack(lease.token).await;
            continue;
        }
        let corr = req.correlation_id.clone();
        let refuse = |error: &str| {
            let data = serde_json::json!({ "error": error })
                .to_string()
                .into_bytes();
            frame(&corr, "refused", data, true)
        };
        let source = match target(feeds, &req.path) {
            Target::Invalid(reason) => Err(refuse(reason)),
            Target::Feed(..) | Target::Personal(_) if producers.0.len() >= MAX_SUBSCRIPTIONS => {
                let data = serde_json::json!({ "error": "too many live subscriptions" })
                    .to_string()
                    .into_bytes();
                Err(frame(&corr, "busy", data, true))
            }
            Target::Feed(feed, key) => Ok(Some(Source::Shared(feed, key))),
            Target::Personal(ticket) => {
                let now = ctx.now_ms();
                let redeem = async {
                    // Claimed for this open: if a later step fails and the
                    // OPEN is redelivered (same correlation id), it redeems
                    // the ticket again instead of being refused.
                    let Some((principal, session)) =
                        crate::apps::notification_center::redeem_ticket(
                            &mut store, &ticket, &corr, now,
                        )
                        .await?
                    else {
                        return Ok(None);
                    };
                    // The session the ticket was issued to must still be that
                    // person's and unlocked before anything of theirs is sent.
                    let current = crate::session::live_principal(&mut store, &session, now).await?;
                    Ok::<_, std::io::Error>(
                        (current.as_deref() == Some(principal.as_str()))
                            .then_some((principal, session)),
                    )
                };
                match rt::time::timeout(Duration::from_millis(READ_TIMEOUT_MS), redeem).await {
                    Ok(Ok(Some((principal, session)))) => {
                        Ok(Some(Source::Personal { principal, session }))
                    }
                    Ok(Ok(None)) => Err(refuse(
                        "the ticket is unknown, used or expired, or its session has ended",
                    )),
                    // The store is unreachable or slow: left unacked below,
                    // so the OPEN is redelivered.
                    Err(_) => {
                        store = ctx.store(crate::DATA_BINDING)?;
                        Ok(None)
                    }
                    Ok(Err(_)) => Ok(None),
                }
            }
        };
        let delivered = match source {
            Err(refusal) => publish(&ctx, &req.reply_to, &refusal).await,
            Ok(None) => false,
            Ok(Some(source)) => match rt::time::timeout(
                Duration::from_millis(READ_TIMEOUT_MS),
                read(&mut store, &source),
            )
            .await
            {
                // The store is unreachable or slow: leave the OPEN unacked so
                // it is redelivered, rather than starting a subscription that
                // has nothing to say.
                Err(_) => {
                    store = ctx.store(crate::DATA_BINDING)?;
                    false
                }
                Ok(Err(_)) => false,
                Ok(Ok((version, view))) => {
                    let first = frame(&corr, "state", state_data(version, view), false);
                    let sent = publish(&ctx, &req.reply_to, &first).await;
                    if sent {
                        let task = rt::spawn(produce(
                            ctx.clone(),
                            req.reply_to.clone(),
                            corr.clone(),
                            source,
                            version,
                        ));
                        producers.0.insert(corr, task);
                    }
                    sent
                }
            },
        };
        if delivered {
            let _ = requests.ack(lease.token).await;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn key_of(rest: &str) -> Option<String> {
        (!rest.is_empty() && !rest.contains('/')).then(|| format!("docs/{rest}"))
    }

    fn view_of(bytes: Option<&[u8]>) -> serde_json::Value {
        serde_json::json!({ "bytes": bytes.map(|b| b.len()) })
    }

    static FEEDS: &[LiveFeed] = &[LiveFeed {
        app: "demo",
        key: key_of,
        view: view_of,
    }];

    #[test]
    fn a_path_names_a_feed_and_a_document() {
        match target(FEEDS, "/live/demo/one?after=3") {
            Target::Feed(feed, key) => {
                assert_eq!(feed.app, "demo");
                assert_eq!(key, "docs/one");
            }
            other => panic!("{other:?}"),
        }
        for bad in [
            "/live/",
            "/live/other/one",
            "/live/demo/",
            "/live/demo/a/b",
            "/api/demo/one",
            "/live/me",
            "/live/me?ticket=",
            "/live/me?other=1",
        ] {
            assert!(matches!(target(FEEDS, bad), Target::Invalid(_)), "{bad}");
        }
        match target(FEEDS, "/live/me?x=1&ticket=abc") {
            Target::Personal(ticket) => assert_eq!(ticket, "abc"),
            other => panic!("{other:?}"),
        }
    }

    #[test]
    fn a_state_frame_carries_the_version_and_the_view() {
        let data = state_data(7, serde_json::json!({ "a": 1 }));
        let value: serde_json::Value = serde_json::from_slice(&data).unwrap();
        assert_eq!(
            value,
            serde_json::json!({ "version": 7, "state": { "a": 1 } })
        );
    }
}

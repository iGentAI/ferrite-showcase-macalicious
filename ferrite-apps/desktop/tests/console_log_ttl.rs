//! Console's log on the in-process Forge planes, on a clock the test moves: an
//! entry is read back for a day and then is gone, while newer ones stay.

use std::time::Duration;

use ferrite_app::{serde_json, IngressRequest};
use ferrite_app_test::{ingress, TestEnv, TestHarness};

const HOUR_MS: u64 = 60 * 60 * 1000;

async fn boot() -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let env = TestHarness::new()
        .with_queue("requests")
        .with_queue("replies")
        .with_queue("live")
        .with_queue("frames")
        .with_store("data")
        .manual_clock(1_760_000_000_000)
        .build()
        .await;
    let ctx = ferrite_app::AppContext::with_clock(env.payload().clone(), env.clock());
    env.run_app(move |_| async move { macalicious_desktop::run(ctx).await });
    crate::support::Env::new(env, slot)
}

/// What a fresh browser reads, as each entry's message and time.
async fn log(env: &TestEnv) -> Vec<(String, u64)> {
    let request: IngressRequest = ingress::request("GET", "/api/console/log", "", b"");
    let reply = env.handle(request).await.expect("a reply");
    let body: serde_json::Value = serde_json::from_slice(&reply.body).expect("json");
    body["entries"]
        .as_array()
        .expect("entries")
        .iter()
        .map(|entry| {
            (
                entry["message"].as_str().unwrap().to_string(),
                entry["at_ms"].as_u64().unwrap(),
            )
        })
        .collect()
}

/// Moves the clock on once the worker has acknowledged what it was sent: a
/// request still leased when the clock jumps would expire and be handled twice.
async fn advance(env: &TestEnv, ms: u64) {
    crate::support::advance(env, ms).await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn an_entry_is_kept_for_a_day_and_then_is_gone() {
    let env = boot().await;
    // Boot logging and request workers start independently. Wait for the actual boot
    // entry on a bounded wall-clock deadline before advancing the manual TTL clock.
    let first = tokio::time::timeout(Duration::from_secs(10), async {
        loop {
            let entries = log(&env).await;
            if entries.iter().any(|(message, _)| {
                message.starts_with("macalicious-desktop started at deployment generation ")
            }) {
                break entries;
            }
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
    })
    .await
    .expect("the boot entry becomes readable within ten seconds before the TTL clock advances");

    advance(&env, 23 * HOUR_MS).await;
    let later = log(&env).await;
    for entry in &first {
        assert!(later.contains(entry), "{entry:?} is still kept at 23 hours");
    }

    let bad = ingress::request("PUT", "/api/launchpad/layout", "", b"not json");
    env.handle(bad).await.expect("a reply");
    let written_at = env.clock().now_ms();
    // The router publishes the reply before it logs the request, so the entry
    // can follow the reply by a moment; wait for it on a wall-clock deadline.
    let newer = tokio::time::timeout(Duration::from_secs(10), async {
        loop {
            let newer: Vec<_> = log(&env)
                .await
                .into_iter()
                .filter(|(message, at)| *at >= written_at && message.contains("launchpad"))
                .collect();
            if !newer.is_empty() {
                break newer;
            }
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
    })
    .await
    .expect("the refused request is in the log within ten seconds");

    advance(&env, 2 * HOUR_MS).await;
    let after = log(&env).await;
    let cut = env.clock().now_ms().saturating_sub(24 * HOUR_MS);
    assert!(
        after.iter().all(|(_, at)| *at > cut),
        "nothing older than a day is read: {after:?}, before {cut}"
    );
    for entry in &first {
        assert!(!after.contains(entry), "{entry:?} is gone after a day");
    }
    for entry in &newer {
        assert!(after.contains(entry), "{entry:?} is an hour old and stays");
    }
}

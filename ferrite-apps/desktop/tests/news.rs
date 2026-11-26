//! Network fixtures: shared tests omit outbound bindings; `local-egress`
//! repeats them with Forge's deny-all policy. See tests/README.md.
//!
//! News's manifest and the server's handling of a failing feed: the `news`
//! egress handle of `ferrite.json` declares exactly the feeds News reads
//! (`src/apps/news/sources.rs`), and a feed whose read failed is backed off.
//! Real feeds are read by the browser journey (`e2e/news-journey.mjs`)
//! under `ferrite dev --egress allow`; the unit tests in `src/apps/news/`
//! cover the feed reader, the catalogue and the library's limits.

use ferrite_app::serde_json;
use ferrite_app_test::{ingress, TestHarness};
use macalicious_desktop::apps::news::sources::SOURCES;

#[test]
fn every_feed_is_declared_for_the_news_egress_handle_and_nothing_else() {
    let spec: serde_json::Value = serde_json::from_str(include_str!("../ferrite.json")).unwrap();
    // `news` is split into `news`, `news-2`, ... to the platform's 16-destination
    // capability limit (`src/apps/egress.rs`); together they hold the feeds.
    let mut declared: Vec<&str> = spec["applications"][0]["egress"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|e| {
            let handle = e["handle"].as_str().unwrap_or("");
            handle == "news" || handle.starts_with("news-")
        })
        .flat_map(|e| e["destinations"].as_array().unwrap().iter())
        .map(|d| d.as_str().unwrap())
        .collect();
    assert!(
        !declared.is_empty(),
        "ferrite.json declares a `news` egress handle"
    );
    let mut feeds: Vec<&str> = SOURCES.iter().map(|s| s.feed).collect();
    declared.sort_unstable();
    feeds.sort_unstable();
    assert_eq!(declared, feeds);
}

/// How many times the server tried `publisher`'s feed: each read that fails
/// writes one "<publisher> could not be read" entry to the application's log
/// (`applog.rs`), and an answer from the back-off writes none.
async fn tries(env: &ferrite_app_test::TestEnv, publisher: &str) -> usize {
    let (rows, _) = env
        .store("data")
        .scan_prefix(b"desktop/log/", None, 500)
        .await
        .expect("the application's log");
    let needle = format!("{publisher} could not be read");
    rows.iter()
        .filter(|(_, value, _)| String::from_utf8_lossy(value).contains(&needle))
        .count()
}

/// The seconds a reply's `retry-after` asks for, which must be in the back-off:
/// more than none and at most its two minutes.
fn retry_after(reply: &ferrite_app::IngressReply) -> u64 {
    let seconds: u64 = reply
        .headers
        .iter()
        .find(|(n, _)| n.eq_ignore_ascii_case("retry-after"))
        .map(|(_, v)| v.parse().expect("whole seconds"))
        .expect("a retry-after");
    assert!(
        (1..=120).contains(&seconds),
        "retry-after {seconds} is not within the back-off"
    );
    seconds
}

/// A feed whose read failed is left alone for a while: the failure and every
/// answer during the back-off carry a `retry-after` within the back-off, and
/// the next request is answered with the recorded failure without asking the
/// publisher again. The harness's egress refuses every call, so a read fails.
#[tokio::test]
async fn a_failed_feed_is_not_asked_for_again_at_once() {
    let slot = crate::support::Slot::acquire();
    let harness = TestHarness::new()
        .with_queue("requests")
        .with_queue("replies")
        .with_store("data");
    #[cfg(feature = "local-egress")]
    let harness = harness.with_egress("news");
    let env = harness.build().await;
    let env = crate::support::Env::new(env, slot);
    env.run_app(|ctx| async move { macalicious_desktop::run(ctx).await });

    let first = env
        .handle(ingress::get("/api/news/sources/bbc"))
        .await
        .expect("a reply");
    assert_eq!(
        first.status,
        502,
        "{}",
        String::from_utf8_lossy(&first.body)
    );
    retry_after(&first);
    assert_eq!(tries(&env, "BBC News").await, 1, "the first request tried");

    let second = env
        .handle(ingress::get("/api/news/sources/bbc"))
        .await
        .expect("a reply");
    assert_eq!(second.status, 502);
    retry_after(&second);
    assert_eq!(
        tries(&env, "BBC News").await,
        1,
        "the second answer is the recorded failure, without a new try"
    );
    let message = |reply: &ferrite_app::IngressReply| {
        serde_json::from_slice::<serde_json::Value>(&reply.body).unwrap()["error"].clone()
    };
    assert_eq!(message(&first), message(&second));

    // Another feed is not held back by this one's failure: it is tried and
    // answers with its own failure. Two requests at once share that one read,
    // and the one that waited for it also gets the back-off left.
    let both = env
        .handle_all([
            ingress::get("/api/news/sources/npr"),
            ingress::get("/api/news/sources/npr"),
        ])
        .await;
    for other in &both {
        let other = other.as_ref().expect("a reply");
        assert_eq!(other.status, 502);
        assert_ne!(message(other), message(&first));
        retry_after(other);
    }
    assert_eq!(tries(&env, "NPR").await, 1, "one read for both");
}

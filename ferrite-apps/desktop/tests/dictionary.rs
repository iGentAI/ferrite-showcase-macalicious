//! Network fixtures: shared tests omit outbound bindings; `local-egress`
//! repeats them with Forge's deny-all policy. See tests/README.md.
//!
//! Dictionary on the in-process Forge planes (`ferrite-app-test`). The
//! harness's egress is deny-all, so no source is reached here: this test holds
//! what the module does without one (refuse bad input, answer 502 and keep
//! nothing). The parsers of the sources' real answers are unit tests in
//! `src/apps/dictionary`; the journey `e2e/dictionary-journey.mjs` reaches the
//! real sources under `ferrite dev --egress allow`.

use ferrite_app::{serde_json, IngressReply, IngressRequest};
use ferrite_app_test::{ingress, TestEnv, TestHarness};

async fn boot() -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let harness = TestHarness::new()
        .with_queue("requests")
        .with_queue("replies")
        .with_store("data");
    #[cfg(feature = "local-egress")]
    let harness = harness.with_egress("dictionary");
    let env = harness.build().await;
    env.run_app(|ctx| async move { macalicious_desktop::run(ctx).await });
    crate::support::Env::new(env, slot)
}

async fn call(env: &TestEnv, req: IngressRequest) -> IngressReply {
    env.handle(req).await.expect("a reply")
}

fn json(reply: &IngressReply) -> serde_json::Value {
    serde_json::from_slice(&reply.body)
        .unwrap_or_else(|e| panic!("{e}: {}", String::from_utf8_lossy(&reply.body)))
}

fn with_cookie(mut req: IngressRequest, token: &str) -> IngressRequest {
    req.headers
        .push(("cookie".into(), format!("mac_session={token}")));
    req
}

/// A new browser: the token of the session its first request was given.
async fn browser(env: &TestEnv) -> String {
    let reply = call(env, ingress::get("/api/session")).await;
    let cookie = reply
        .headers
        .iter()
        .find(|(n, _)| n.eq_ignore_ascii_case("set-cookie"))
        .map(|(_, v)| v.clone())
        .expect("a new session sets its cookie");
    cookie
        .split(';')
        .next()
        .and_then(|pair| pair.split_once('=').map(|(_, token)| token))
        .expect("the session cookie")
        .to_string()
}

async fn get(env: &TestEnv, token: &str, path: &str) -> IngressReply {
    call(env, with_cookie(ingress::get(path), token)).await
}

fn ok(reply: &IngressReply) -> serde_json::Value {
    assert_eq!(
        reply.status,
        200,
        "{}",
        String::from_utf8_lossy(&reply.body)
    );
    json(reply)
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn dictionary_refuses_bad_words_and_keeps_nothing_when_no_source_answers() {
    let env = boot().await;
    let a = browser(&env).await;
    for bad in ["", "a%2Fb", "what%3F", "%FF"] {
        let reply = get(&env, &a, &format!("/api/dictionary/entry?word={bad}")).await;
        assert_eq!(
            reply.status,
            400,
            "{bad:?}: {}",
            String::from_utf8_lossy(&reply.body)
        );
    }
    // Every source is refused: 502, and the word is not put in the history.
    let refused = get(&env, &a, "/api/dictionary/entry?word=serendipity").await;
    assert_eq!(
        refused.status,
        502,
        "{}",
        String::from_utf8_lossy(&refused.body)
    );
    let suggest = get(&env, &a, "/api/dictionary/suggest?prefix=ser").await;
    assert_eq!(suggest.status, 502);
    let history = ok(&get(&env, &a, "/api/dictionary/history").await);
    assert_eq!(history["history"], serde_json::Value::Null);
    assert_eq!(history["rev"], 0);
    let forgot = ok(&call(
        &env,
        with_cookie(
            ingress::request("DELETE", "/api/dictionary/history", "", Vec::new()),
            &a,
        ),
    )
    .await);
    assert_eq!(forgot["history"], serde_json::Value::Null);
    assert_eq!(get(&env, &a, "/api/dictionary/nothing").await.status, 404);
}

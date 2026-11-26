//! End-to-end tests on the in-process Forge planes (`ferrite-app-test`): the
//! application boots, publishes the desktop into its `site` blob, gives each
//! browser its own session, and routes `/api/<app>/` to the app modules.

use ferrite_app::{serde_json, IngressReply, IngressRequest};
use ferrite_app_test::{ingress, TestEnv, TestHarness};

async fn boot() -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let env = TestHarness::new()
        .with_blob("site")
        .with_queue("requests")
        .with_queue("replies")
        .with_store("data")
        .build()
        .await;
    env.run_app(|ctx| async move { macalicious_desktop::run(ctx).await });
    crate::support::Env::new(env, slot)
}

fn with_cookie(mut req: IngressRequest, cookie: &str) -> IngressRequest {
    req.headers
        .push(("cookie".into(), format!("mac_session={cookie}")));
    req
}

fn header<'a>(reply: &'a IngressReply, name: &str) -> Option<&'a str> {
    reply
        .headers
        .iter()
        .find(|(n, _)| n.eq_ignore_ascii_case(name))
        .map(|(_, v)| v.as_str())
}

/// The token a `set-cookie` reply hands the browser.
fn issued_token(reply: &IngressReply) -> String {
    let cookie = header(reply, "set-cookie").expect("a new session sets its cookie");
    let pair = cookie.split(';').next().unwrap();
    pair.strip_prefix("mac_session=")
        .expect("the session cookie")
        .to_string()
}

fn json(reply: &IngressReply) -> serde_json::Value {
    serde_json::from_slice(&reply.body)
        .unwrap_or_else(|e| panic!("{e}: {}", String::from_utf8_lossy(&reply.body)))
}

async fn call(env: &TestEnv, req: IngressRequest) -> IngressReply {
    env.handle(req).await.expect("a reply")
}

/// `req` carrying the browser's own `idempotency-key` header.
fn keyed(mut req: IngressRequest, key: &str) -> IngressRequest {
    req.headers.push(("idempotency-key".into(), key.into()));
    req
}

fn tape_post(token: &str, key: &str, result: &str) -> IngressRequest {
    let body = format!(r#"{{"expression":"x","result":"{result}"}}"#);
    with_cookie(
        keyed(ingress::post("/api/calculator/tape", body), key),
        token,
    )
}

fn tape_clear(token: &str) -> IngressRequest {
    with_cookie(
        ingress::request("DELETE", "/api/calculator/tape", "", b""),
        token,
    )
}

async fn tape_results(env: &TestEnv, token: &str) -> Vec<String> {
    let reply = call(
        env,
        with_cookie(ingress::get("/api/calculator/tape"), token),
    )
    .await;
    json(&reply)["entries"]
        .as_array()
        .unwrap()
        .iter()
        .map(|e| e["result"].as_str().unwrap().to_string())
        .collect()
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn the_desktop_is_published_into_the_site_blob_at_boot() {
    let env = boot().await;
    let health = call(&env, ingress::get("/health")).await;
    assert_eq!(health.status, 200);

    let bundle = macalicious_desktop::site_bundle();
    let mut site = env.blob("site");
    let mut marker = None;
    for _ in 0..600 {
        marker = site
            .get(b"ferrite-site.json")
            .await
            .expect("the blob answers");
        if marker.is_some() {
            break;
        }
        ferrite_app::sleep_ms(100).await;
    }
    let marker: serde_json::Value =
        serde_json::from_slice(&marker.expect("the marker is written within 60 s")).unwrap();
    assert_eq!(marker["build_id"], bundle.build_id);
    assert_eq!(marker["files"], bundle.files.len());

    // Every packed file is in the blob under its path, byte for byte, and
    // each compressed copy the build made beside it.
    use macalicious_desktop::site::{copy_key, Coding};
    for file in bundle.files {
        for coding in [Coding::Identity, Coding::Brotli, Coding::Gzip] {
            let Some(encoded) = file.encoded(coding) else {
                continue;
            };
            let key = copy_key(file.path, coding);
            let stored = site.get(key.as_bytes()).await.unwrap();
            let expected = macalicious_desktop::site::decode_base64(encoded).unwrap();
            assert!(stored.as_deref() == Some(expected.as_slice()), "{key}");
        }
    }
    let page = site.get(b"index.html").await.unwrap().unwrap();
    assert!(String::from_utf8_lossy(&page)
        .to_ascii_lowercase()
        .contains("<html"));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn no_app_answers_a_browser_whose_lock_is_on_its_way() {
    let env = boot().await;
    let first = call(&env, ingress::get("/api/session")).await;
    let token = issued_token(&first);
    let read = |lock: Option<&str>| {
        let mut req = ingress::get("/api/calculator/tape");
        let cookie = match lock {
            Some(pair) => format!("mac_session={token}; {pair}"),
            None => format!("mac_session={token}"),
        };
        req.headers.push(("cookie".into(), cookie));
        req
    };
    assert_eq!(call(&env, read(None)).await.status, 200);
    // Lock Screen was chosen and its request has not reached the server yet: a read that gets
    // there first is refused all the same, though the stored session is not locked, whatever
    // the attempt's cookie holds.
    for pair in ["mac_lock_k3x9a=1", "mac_lock_k3x9a=", "mac_lock=0"] {
        let refused = call(&env, read(Some(pair))).await;
        assert_eq!(
            refused.status,
            423,
            "{pair}: {}",
            String::from_utf8_lossy(&refused.body)
        );
    }
    // Once the page has deleted its attempt's cookie, reads answer again.
    assert_eq!(call(&env, read(Some("other=1"))).await.status, 200);
    assert_eq!(call(&env, read(None)).await.status, 200);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_session_record_past_its_time_is_refused_and_replaced() {
    let env = boot().await;
    let first = call(&env, ingress::get("/api/session")).await;
    let token = issued_token(&first);
    let id = json(&first)["session"].as_str().unwrap().to_string();
    let key = format!("sessions/{id}");
    let now = env.clock().now_ms();
    let max_age_ms = macalicious_desktop::session::MAX_AGE_SECONDS * 1000;
    let mut store = env.store("data");

    // A record of the older format, with no expiry of its own, written longer ago than a
    // session lives, and stored without a store expiry: still readable, never a session.
    let legacy = serde_json::json!({ "created_ms": now - max_age_ms - 60_000 });
    store
        .put(key.as_bytes(), legacy.to_string().as_bytes())
        .await
        .unwrap();
    let reply = call(&env, with_cookie(ingress::get("/api/session"), &token)).await;
    assert_eq!(reply.status, 200);
    let fresh = json(&reply);
    assert_ne!(
        fresh["session"],
        id.as_str(),
        "the old session is not resumed"
    );
    assert_eq!(fresh["new"], true);
    assert_ne!(
        issued_token(&reply),
        token,
        "a new cookie replaces the old one"
    );

    // A record whose own expiry has passed, though the store kept it: the same.
    let passed = serde_json::json!({ "created_ms": now - 120_000, "expires_ms": now - 60_000 });
    store
        .put(key.as_bytes(), passed.to_string().as_bytes())
        .await
        .unwrap();
    let reply = call(&env, with_cookie(ingress::get("/api/session"), &token)).await;
    assert_ne!(json(&reply)["session"], id.as_str());
    assert_eq!(json(&reply)["new"], true);

    // And one still in its time is the same session, with no new cookie.
    let current = serde_json::json!({ "created_ms": now - 60_000 });
    store
        .put(key.as_bytes(), current.to_string().as_bytes())
        .await
        .unwrap();
    let reply = call(&env, with_cookie(ingress::get("/api/session"), &token)).await;
    assert_eq!(json(&reply)["session"], id.as_str());
    assert_eq!(header(&reply, "set-cookie"), None);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn each_browser_gets_its_own_session_and_keeps_it() {
    let env = boot().await;

    // Browser A's first request creates a session and sets its cookie.
    let first = call(&env, ingress::get("/api/session")).await;
    assert_eq!(first.status, 200);
    let token_a = issued_token(&first);
    let a = json(&first);
    assert_eq!(a["new"], true);
    let id_a = a["session"].as_str().unwrap().to_string();
    assert_ne!(
        id_a, token_a,
        "the reply shows the id, never the cookie token"
    );

    // With its cookie, A is recognised and no new cookie is set.
    let again = call(&env, with_cookie(ingress::get("/api/session"), &token_a)).await;
    assert_eq!(again.status, 200);
    assert_eq!(header(&again, "set-cookie"), None);
    assert_eq!(json(&again)["session"], id_a.as_str());
    assert_eq!(json(&again)["new"], false);

    // Browser B, without a cookie, gets a different session.
    let other = call(&env, ingress::get("/api/session")).await;
    let token_b = issued_token(&other);
    assert_ne!(token_b, token_a);
    assert_ne!(json(&other)["session"], id_a.as_str());

    // A forged token (well-formed, never issued) is replaced, not adopted.
    let forged = call(
        &env,
        with_cookie(ingress::get("/api/session"), &"ab".repeat(32)),
    )
    .await;
    assert_eq!(json(&forged)["new"], true);
    assert_ne!(issued_token(&forged), "ab".repeat(32));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn the_calculator_tape_is_kept_per_session() {
    let env = boot().await;
    let token_a = issued_token(&call(&env, ingress::get("/api/session")).await);
    let token_b = issued_token(&call(&env, ingress::get("/api/session")).await);

    let body = br#"{"expression":"12+3","result":"15"}"#;
    let added = call(
        &env,
        with_cookie(
            keyed(ingress::post("/api/calculator/tape", body), "calc-1"),
            &token_a,
        ),
    )
    .await;
    assert_eq!(
        added.status,
        201,
        "{}",
        String::from_utf8_lossy(&added.body)
    );
    assert_eq!(json(&added)["result"], "15");

    // A retry of the same request appends nothing.
    let retried = call(
        &env,
        with_cookie(
            keyed(ingress::post("/api/calculator/tape", body), "calc-1"),
            &token_a,
        ),
    )
    .await;
    assert_eq!(retried.status, 200);
    assert_eq!(json(&retried), json(&added));

    let second = br#"{"expression":"6*7","result":"42"}"#;
    let added = call(
        &env,
        with_cookie(
            keyed(ingress::post("/api/calculator/tape", second), "calc-2"),
            &token_a,
        ),
    )
    .await;
    assert_eq!(added.status, 201);

    let tape_a = call(
        &env,
        with_cookie(ingress::get("/api/calculator/tape"), &token_a),
    )
    .await;
    let entries = json(&tape_a)["entries"].as_array().unwrap().clone();
    let results: Vec<&str> = entries
        .iter()
        .map(|e| e["result"].as_str().unwrap())
        .collect();
    assert_eq!(
        results,
        ["15", "42"],
        "A's tape, oldest first, without the retry"
    );

    let tape_b = call(
        &env,
        with_cookie(ingress::get("/api/calculator/tape"), &token_b),
    )
    .await;
    assert_eq!(
        json(&tape_b)["entries"],
        serde_json::json!([]),
        "B sees none of A's tape"
    );

    let cleared = call(
        &env,
        with_cookie(
            ingress::request("DELETE", "/api/calculator/tape", "", b""),
            &token_a,
        ),
    )
    .await;
    assert_eq!(cleared.status, 200);
    let tape_a = call(
        &env,
        with_cookie(ingress::get("/api/calculator/tape"), &token_a),
    )
    .await;
    assert_eq!(json(&tape_a)["entries"], serde_json::json!([]));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn tape_retries_are_exact_under_concurrency_clears_and_retention() {
    let env = boot().await;
    let token = issued_token(&call(&env, ingress::get("/api/session")).await);
    let post = |key: &str, result: &str| tape_post(&token, key, result);
    let clear = || tape_clear(&token);

    // Eight deliveries of one request, racing across the four workers:
    // exactly one admits it.
    let replies = env.handle_all((0..8).map(|_| post("same", "1"))).await;
    let statuses: Vec<u16> = replies.iter().map(|r| r.as_ref().unwrap().status).collect();
    assert_eq!(
        statuses.iter().filter(|s| **s == 201).count(),
        1,
        "{statuses:?}"
    );
    assert!(
        statuses.iter().all(|s| *s == 201 || *s == 200),
        "{statuses:?}"
    );
    assert_eq!(tape_results(&env, &token).await, ["1"]);

    // A retry after a clear answers as before and does not bring the entry back.
    assert_eq!(call(&env, clear()).await.status, 200);
    assert_eq!(call(&env, post("same", "1")).await.status, 200);
    assert!(
        tape_results(&env, &token).await.is_empty(),
        "a cleared entry stays cleared"
    );

    // A DELETE is not deduplicated: sent again, it clears what came since.
    assert_eq!(call(&env, post("after", "2")).await.status, 201);
    assert_eq!(call(&env, clear()).await.status, 200);
    assert!(tape_results(&env, &token).await.is_empty());
    assert_eq!(call(&env, post("two", "2")).await.status, 201);
    assert_eq!(tape_results(&env, &token).await, ["2"]);

    // Retention keeps the newest 100, in order, in storage as well as in replies.
    for n in 3..=105 {
        assert_eq!(
            call(&env, post(&format!("n{n}"), &n.to_string()))
                .await
                .status,
            201
        );
    }
    let results = tape_results(&env, &token).await;
    let expected: Vec<String> = (6..=105).map(|n| n.to_string()).collect();
    assert_eq!(results, expected);
    let (rows, _) = env
        .store("data")
        .scan_prefix(b"apps/calculator/users/", None, 1024)
        .await
        .unwrap();
    let stored = rows
        .iter()
        .filter(|(k, _, _)| String::from_utf8_lossy(k).contains("/tape/"))
        .count();
    assert_eq!(stored, 100);

    // A retry of an entry retention evicted does not restore it.
    assert_eq!(call(&env, post("n3", "3")).await.status, 200);
    assert_eq!(tape_results(&env, &token).await, expected);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_tampered_or_interrupted_publication_is_repaired() {
    let env = boot().await;
    let bundle = macalicious_desktop::site_bundle();
    let mut site = env.blob("site");
    for _ in 0..600 {
        if site.get(b"ferrite-site.json").await.unwrap().is_some() {
            break;
        }
        ferrite_app::sleep_ms(100).await;
    }
    let page = site.get(b"index.html").await.unwrap().expect("published");
    let ctx = env.context();
    let seed = || macalicious_desktop::site::seed(&ctx, bundle);
    assert_eq!(
        seed().await.unwrap(),
        macalicious_desktop::site::Seeded::AlreadyCurrent
    );

    // Another build's page went live after this build's marker was written.
    site.put(b"index.html", b"<html>another build</html>")
        .await
        .unwrap();
    assert!(matches!(
        seed().await.unwrap(),
        macalicious_desktop::site::Seeded::Published { .. }
    ));
    assert_eq!(site.get(b"index.html").await.unwrap(), Some(page.clone()));

    // A publication that died before its marker is published again.
    site.delete(b"ferrite-site.json").await.unwrap();
    assert!(matches!(
        seed().await.unwrap(),
        macalicious_desktop::site::Seeded::Published { .. }
    ));
    assert_eq!(
        seed().await.unwrap(),
        macalicious_desktop::site::Seeded::AlreadyCurrent
    );
}

/// The calculator's key prefix in the `data` store for a session token.
fn calculator_space(token: &str) -> String {
    format!(
        "apps/calculator/users/{}/",
        macalicious_desktop::session::session_id(token)
    )
}

/// The retry marker key the calculator uses for a browser's key.
fn retry_marker(token: &str, idempotency_key: &str) -> String {
    let digest = ferrite_app::crypto::sha256(idempotency_key.as_bytes());
    format!(
        "{}retry/{}",
        calculator_space(token),
        ferrite_app::crypto::hex(&digest[..8])
    )
}

fn tape_entry_key(token: &str, seq: u64) -> String {
    format!("{}tape/{seq:016}", calculator_space(token))
}

async fn stored_tape_keys(env: &TestEnv, token: &str) -> Vec<String> {
    let prefix = format!("{}tape/", calculator_space(token));
    let (rows, _) = env
        .store("data")
        .scan_prefix(prefix.as_bytes(), None, 4096)
        .await
        .unwrap();
    rows.iter()
        .map(|(k, _, _)| String::from_utf8_lossy(k).into_owned())
        .collect()
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_clear_that_overtakes_a_paused_append_still_wins() {
    let env = boot().await;
    let token = issued_token(&call(&env, ingress::get("/api/session")).await);
    assert_eq!(call(&env, tape_post(&token, "a", "1")).await.status, 201);

    // An append of key "late" has taken sequence number 2, claimed its retry
    // marker and read the old clear floor, then paused before writing.
    let mut store = env.store("data");
    let space = calculator_space(&token);
    store
        .put(format!("{space}seq").as_bytes(), b"2")
        .await
        .unwrap();
    let entry = serde_json::json!({ "expression": "x", "result": "2", "at_ms": 0 });
    let marker = serde_json::json!({ "seq": 2, "entry": entry, "done": false });
    store
        .put(
            retry_marker(&token, "late").as_bytes(),
            &serde_json::to_vec(&marker).unwrap(),
        )
        .await
        .unwrap();

    // A clear runs to completion meanwhile: it covers sequence number 2.
    assert_eq!(call(&env, tape_clear(&token)).await.status, 200);

    // The paused append's write lands after the clear returned.
    store
        .put(
            tape_entry_key(&token, 2).as_bytes(),
            &serde_json::to_vec(&entry).unwrap(),
        )
        .await
        .unwrap();
    assert!(
        tape_results(&env, &token).await.is_empty(),
        "an entry the clear covers is never shown"
    );

    // The append's own completion (here its redelivery) takes the entry back.
    assert_eq!(call(&env, tape_post(&token, "late", "2")).await.status, 200);
    assert!(stored_tape_keys(&env, &token).await.is_empty());
    assert_eq!(call(&env, tape_post(&token, "next", "3")).await.status, 201);
    assert_eq!(tape_results(&env, &token).await, ["3"]);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn an_interrupted_append_finishes_pruning_on_retry() {
    let env = boot().await;
    let token = issued_token(&call(&env, ingress::get("/api/session")).await);
    for n in 1..=100 {
        let reply = call(&env, tape_post(&token, &format!("n{n}"), &n.to_string())).await;
        assert_eq!(reply.status, 201);
    }

    // An append of key "crash" wrote entry 101 and died before pruning and
    // before marking its claim done: storage holds 101 entries.
    let mut store = env.store("data");
    let space = calculator_space(&token);
    store
        .put(format!("{space}seq").as_bytes(), b"101")
        .await
        .unwrap();
    let entry = serde_json::json!({ "expression": "x", "result": "101", "at_ms": 0 });
    let marker = serde_json::json!({ "seq": 101, "entry": entry, "done": false });
    store
        .put(
            retry_marker(&token, "crash").as_bytes(),
            &serde_json::to_vec(&marker).unwrap(),
        )
        .await
        .unwrap();
    store
        .put(
            tape_entry_key(&token, 101).as_bytes(),
            &serde_json::to_vec(&entry).unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(stored_tape_keys(&env, &token).await.len(), 101);

    // Its retry finishes the work: pruned to 100, then marked done.
    assert_eq!(
        call(&env, tape_post(&token, "crash", "101")).await.status,
        200
    );
    assert_eq!(stored_tape_keys(&env, &token).await.len(), 100);
    let marker = store
        .get(retry_marker(&token, "crash").as_bytes())
        .await
        .unwrap()
        .expect("the marker");
    let marker: serde_json::Value = serde_json::from_slice(&marker).unwrap();
    assert_eq!(marker["done"], true);
    let expected: Vec<String> = (2..=101).map(|n| n.to_string()).collect();
    assert_eq!(tape_results(&env, &token).await, expected);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn only_the_browsers_own_key_deduplicates() {
    let env = boot().await;
    let token = issued_token(&call(&env, ingress::get("/api/session")).await);
    let body = br#"{"expression":"x","result":"1"}"#;
    // The gateway's envelope key (the correlation id, or here a fixed one) is
    // never used: two requests without the header both append, even when the
    // envelope keys repeat, as they can after a gateway restart.
    let unkeyed = || {
        let mut req = with_cookie(
            ingress::post_keyed("/api/calculator/tape", "gw-1", body),
            &token,
        );
        req.correlation_id = "gw-1".into();
        req
    };
    assert_eq!(call(&env, unkeyed()).await.status, 201);
    assert_eq!(call(&env, unkeyed()).await.status, 201);
    assert_eq!(tape_results(&env, &token).await, ["1", "1"]);

    // A malformed header counts as none.
    let blank = keyed(unkeyed(), "");
    assert_eq!(call(&env, blank).await.status, 201);

    // The browser's key is kept per session: another browser's identical key
    // is a different request.
    let other = issued_token(&call(&env, ingress::get("/api/session")).await);
    assert_eq!(call(&env, tape_post(&token, "k", "2")).await.status, 201);
    assert_eq!(call(&env, tape_post(&other, "k", "2")).await.status, 201);
    assert_eq!(call(&env, tape_post(&token, "k", "2")).await.status, 200);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn the_router_lists_modules_and_refuses_what_it_cannot_serve() {
    let env = boot().await;

    let apps = call(&env, ingress::get("/api/apps")).await;
    assert_eq!(apps.status, 200);
    let names: Vec<String> = json(&apps)["apps"]
        .as_array()
        .unwrap()
        .iter()
        .map(|a| a["name"].as_str().unwrap().to_string())
        .collect();
    assert!(names.contains(&"calculator".to_string()), "{names:?}");

    assert_eq!(
        call(&env, ingress::get("/api/no-such-app/x")).await.status,
        404
    );
    assert_eq!(
        call(&env, ingress::get("/api/calculator/nothing"))
            .await
            .status,
        404
    );
    assert_eq!(
        call(
            &env,
            ingress::request("PUT", "/api/calculator/tape", "k", b"{}")
        )
        .await
        .status,
        405
    );

    let bad = call(
        &env,
        ingress::post_keyed("/api/calculator/tape", "bad", b"not json"),
    )
    .await;
    assert_eq!(bad.status, 400);
    let empty = br#"{"expression":" ","result":"1"}"#;
    assert_eq!(
        call(
            &env,
            ingress::post_keyed("/api/calculator/tape", "e", empty)
        )
        .await
        .status,
        400
    );

    // A browser write from another site is refused before any module runs.
    let mut cross = ingress::post_keyed(
        "/api/calculator/tape",
        "x",
        br#"{"expression":"1","result":"1"}"#,
    );
    cross
        .headers
        .push(("sec-fetch-site".into(), "cross-site".into()));
    let refused = call(&env, cross).await;
    assert_eq!(refused.status, 403);
    assert_eq!(
        header(&refused, "set-cookie"),
        None,
        "no session is made for a refused request"
    );

    // API replies are never cached.
    assert_eq!(header(&apps, "cache-control"), Some("no-store"));
}

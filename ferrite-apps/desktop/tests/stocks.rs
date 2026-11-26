//! Network fixtures: shared tests omit outbound bindings; `local-egress`
//! repeats them with Forge's deny-all policy. See tests/README.md.
//!
//! Stocks on the in-process Forge planes (`ferrite-app-test`). The
//! harness's egress is deny-all, so no provider is reached here: these tests
//! hold what the module does without one (refuse bad input, answer 502 and
//! keep nothing, keep each person's documents apart and to the module's
//! rules, keep an alert that could not be checked) and that quotes kept in
//! the shared cache are answered without asking the provider. The parsers of
//! the provider's real answers are unit tests in `src/apps/stocks/provider.rs`;
//! the journey `e2e/stocks-journey.mjs` reaches the provider under
//! `ferrite dev --egress allow`.

use crate::support;

use ferrite_app::{serde_json, IngressReply, IngressRequest};
use ferrite_app_test::{ingress, TestEnv, TestHarness};
use serde_json::json;

/// Where both of a test's clocks start.
const START_MS: u64 = 1_760_000_000_000;

async fn boot() -> crate::support::Env {
    boot_with_clock().await.0
}

/// Boots with the app on a manual clock of its own, which the test moves to
/// make a request waiting for the quotes call run out its time. The harness's
/// clock, the planes' one, stands still: the request queue times out a
/// request's lease on it and hands the request out again, which a request
/// that waits seconds by the app's clock would otherwise outlive (the hosted
/// harness's lease is 2 s) and leave a copy of itself still waiting.
async fn boot_with_clock() -> (crate::support::Env, ferrite_app::Clock) {
    let slot = crate::support::Slot::acquire();
    let harness = TestHarness::new()
        .manual_clock(START_MS)
        .with_queue("requests")
        .with_queue("replies")
        .with_store("data");
    #[cfg(feature = "local-egress")]
    let harness = harness.with_egress("stocks");
    let env = harness.build().await;
    let app_clock = ferrite_app::Clock::manual(START_MS);
    let ctx = ferrite_app::AppContext::with_clock(env.payload().clone(), app_clock.clone());
    env.run_app(move |_| async move { macalicious_desktop::run(ctx).await });
    (crate::support::Env::new(env, slot), app_clock)
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

async fn send(
    env: &TestEnv,
    token: &str,
    method: &str,
    path: &str,
    body: serde_json::Value,
) -> IngressReply {
    let mut req = ingress::request(method, path, "", serde_json::to_vec(&body).unwrap());
    req.headers
        .push(("content-type".into(), "application/json".into()));
    call(env, with_cookie(req, token)).await
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
async fn stocks_watchlists_are_per_person_and_saved_on_their_revision() {
    let env = boot().await;
    let a = browser(&env).await;
    let b = browser(&env).await;
    const LIST: &str = "/api/stocks/watchlist";

    let empty = ok(&get(&env, &a, LIST).await);
    assert_eq!(empty["symbols"], serde_json::Value::Null);
    let saved = ok(&send(
        &env,
        &a,
        "PUT",
        LIST,
        json!({ "symbols": ["AAPL", ".SPX"], "rev": 0 }),
    )
    .await);
    assert_eq!(saved["symbols"], json!(["AAPL", ".SPX"]));
    assert_eq!(saved["rev"], 1);
    let stored = ok(&get(&env, &a, LIST).await);
    assert_eq!(stored["symbols"], json!(["AAPL", ".SPX"]), "read back");
    assert_eq!(stored["rev"], 1);
    // A save on an older revision changes nothing and answers the stored one.
    let stale = send(
        &env,
        &a,
        "PUT",
        LIST,
        json!({ "symbols": ["MSFT"], "rev": 0 }),
    )
    .await;
    assert_eq!(stale.status, 409);
    assert_eq!(json(&stale)["symbols"], json!(["AAPL", ".SPX"]));
    // Bad lists are refused.
    for bad in [
        json!({ "symbols": ["AAPL", "AAPL"], "rev": 1 }),
        json!({ "symbols": ["no way"], "rev": 1 }),
        json!({ "symbols": ["AAPL"] }),
        json!({ "symbols": ["AAPL"], "rev": 1, "extra": true }),
    ] {
        let reply = send(&env, &a, "PUT", LIST, bad.clone()).await;
        assert_eq!(
            reply.status,
            400,
            "{bad}: {}",
            String::from_utf8_lossy(&reply.body)
        );
    }
    // Another browser has its own.
    assert_eq!(
        ok(&get(&env, &b, LIST).await)["symbols"],
        serde_json::Value::Null
    );
    // A save that names another session is refused.
    let other = ok(&get(&env, &b, LIST).await)["session"].clone();
    let crossed = send(
        &env,
        &a,
        "PUT",
        LIST,
        json!({ "symbols": ["MSFT"], "rev": 1, "session": other }),
    )
    .await;
    assert_eq!(crossed.status, 409);
    // None of the refused writes changed what A stored.
    let after = ok(&get(&env, &a, LIST).await);
    assert_eq!(after["symbols"], json!(["AAPL", ".SPX"]));
    assert_eq!(after["rev"], 1);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn stocks_refuse_bad_requests_and_answer_502_without_a_provider() {
    let env = boot().await;
    let a = browser(&env).await;
    for (path, status) in [
        ("/api/stocks/quotes", 400),
        ("/api/stocks/quotes?symbols=AAPL,bad%20one", 400),
        ("/api/stocks/chart?symbol=AAPL&range=10Y", 400),
        ("/api/stocks/chart?range=1D", 400),
        ("/api/stocks/search?q=", 400),
        ("/api/stocks/quotes?symbols=AAPL", 502),
        ("/api/stocks/chart?symbol=AAPL&range=1D", 502),
        ("/api/stocks/search?q=apple", 502),
        ("/api/stocks/news", 502),
    ] {
        let reply = get(&env, &a, path).await;
        assert_eq!(
            reply.status,
            status,
            "{path}: {}",
            String::from_utf8_lossy(&reply.body)
        );
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn stocks_alerts_are_validated_and_kept_when_no_quote_can_check_them() {
    let env = boot().await;
    let a = browser(&env).await;
    const ALERTS: &str = "/api/stocks/alerts";
    let alert = json!({ "id": "a-1", "symbol": "AAPL", "above": 400.0, "below": null, "created": 1, "fired": null });
    let saved = ok(&send(
        &env,
        &a,
        "PUT",
        ALERTS,
        json!({ "alerts": [alert], "rev": 0 }),
    )
    .await);
    assert_eq!(saved["alerts"][0]["id"], "a-1");
    for bad in [
        json!({ "id": "a-2", "symbol": "AAPL", "created": 1 }),
        json!({ "id": "a/2", "symbol": "AAPL", "above": 1.0, "created": 1 }),
        json!({ "id": "a-2", "symbol": "AAPL", "above": -5.0, "created": 1 }),
    ] {
        let reply = send(
            &env,
            &a,
            "PUT",
            ALERTS,
            json!({ "alerts": [bad], "rev": 1 }),
        )
        .await;
        assert_eq!(
            reply.status,
            400,
            "{}",
            String::from_utf8_lossy(&reply.body)
        );
    }
    // The provider cannot be reached: the alert is answered exactly as it was
    // saved, unfired.
    let read = ok(&get(&env, &a, ALERTS).await);
    assert_eq!(read["alerts"], json!([alert]));
    assert_eq!(read["rev"], 1);
}

/// A quote as the module keeps it in the shared cache.
fn cached_quote(symbol: &str, price: f64) -> serde_json::Value {
    json!({
        "symbol": symbol, "name": symbol, "price": price, "change": 1.0,
        "previous_close": null, "open": null, "high": null, "low": null,
        "year_high": null, "year_low": null, "volume": null, "market_cap": null,
        "pe": null, "currency": "USD", "exchange": null, "kind": "stock", "time": null
    })
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn stocks_answer_cached_quotes_without_asking_the_provider() {
    let env = boot().await;
    let a = browser(&env).await;
    for (symbol, price) in [("AAPL", 342.94), (".SPX", 7690.73)] {
        env.store("data")
            .put(
                format!("apps/stocks/shared/quotes/{symbol}").as_bytes(),
                cached_quote(symbol, price).to_string().as_bytes(),
            )
            .await
            .expect("seed a cached quote");
    }
    // Every symbol is in the cache: the answer needs no provider call, which
    // the deny-all egress here would refuse.
    let both = ok(&get(&env, &a, "/api/stocks/quotes?symbols=.spx,AAPL").await);
    let symbols: Vec<&str> = both["quotes"]
        .as_array()
        .unwrap()
        .iter()
        .map(|q| q["symbol"].as_str().unwrap())
        .collect();
    assert_eq!(symbols, [".SPX", "AAPL"], "in the order asked for");
    assert_eq!(both["missing"], json!([]));
    // One symbol not cached: the provider is asked, and its failure is the
    // answer; nothing is made up for the missing one.
    let reply = get(&env, &a, "/api/stocks/quotes?symbols=AAPL,MSFT").await;
    assert_eq!(
        reply.status,
        502,
        "{}",
        String::from_utf8_lossy(&reply.body)
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn stocks_refuse_to_show_stored_documents_that_break_their_rules() {
    let env = boot().await;
    let a = browser(&env).await;
    let session = ok(&get(&env, &a, "/api/session").await)["session"]
        .as_str()
        .expect("the session id")
        .to_string();
    let seed = |name: &str, doc: serde_json::Value| {
        let key = format!("apps/stocks/users/{session}/{name}");
        let value = json!({ "rev": 1, "doc": doc }).to_string();
        let env = &env;
        async move {
            env.store("data")
                .put(key.as_bytes(), value.as_bytes())
                .await
                .expect("seed a document");
        }
    };
    seed("watchlist", json!({ "symbols": ["AAPL", "AAPL"] })).await;
    seed(
        "alerts",
        json!({ "alerts": [{ "id": "a-1", "symbol": "AAPL", "above": -1.0, "created": 1 }] }),
    )
    .await;
    for path in ["/api/stocks/watchlist", "/api/stocks/alerts"] {
        let reply = get(&env, &a, path).await;
        assert_eq!(
            reply.status,
            503,
            "{path}: {}",
            String::from_utf8_lossy(&reply.body)
        );
        assert!(
            String::from_utf8_lossy(&reply.body).contains("breaks the module's rules"),
            "{path}: {}",
            String::from_utf8_lossy(&reply.body)
        );
    }
}

/// Write `value` at `key` of the `data` store, as the module keeps it.
async fn seed(env: &TestEnv, key: &str, value: &[u8]) {
    env.store("data")
        .put(key.as_bytes(), value)
        .await
        .expect("seed a key");
}

/// The shared key of the quotes lease, and of the symbols requests waiting
/// for the call on its way leave for the next one.
const LEASE: &str = "apps/stocks/shared/leases/quotes";
const WAITING: &str = "apps/stocks/shared/leases/quotes-waiting";

/// What one request may spend on quotes, waiting included (`REQUEST_MS` in
/// `src/apps/stocks/mod.rs`): moving the app's clock this far makes a waiting
/// request give up at its next look and answer its own 503.
const REQUEST_MS: u64 = 6_500;

/// Returns once the symbols left for the next quotes call are `expected`.
/// A request that finds the lease held leaves its symbols there before it
/// waits, so this is when it is observably waiting.
async fn left_waiting(env: &TestEnv, expected: serde_json::Value) {
    let mut last = serde_json::Value::Null;
    let waiting = tokio::time::timeout(std::time::Duration::from_secs(60), async {
        loop {
            last = stored(env, WAITING).await;
            if last == expected {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(25)).await;
        }
    })
    .await;
    assert!(
        waiting.is_ok(),
        "the symbols left waiting become {expected}: {last}"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn stocks_keep_an_unknown_symbol_as_missing_without_asking_again() {
    let env = boot().await;
    let a = browser(&env).await;
    seed(
        &env,
        "apps/stocks/shared/quotes/AAPL",
        cached_quote("AAPL", 342.94).to_string().as_bytes(),
    )
    .await;
    // What a quotes call keeps for a symbol the provider does not know.
    seed(
        &env,
        "apps/stocks/shared/quotes/ZZZZQ",
        br#"{"unknown":"ZZZZQ"}"#,
    )
    .await;
    let answer = ok(&get(&env, &a, "/api/stocks/quotes?symbols=ZZZZQ,AAPL").await);
    assert_eq!(answer["missing"], json!(["ZZZZQ"]));
    assert_eq!(answer["quotes"][0]["symbol"], "AAPL");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn stocks_wait_for_the_quotes_call_on_its_way_and_take_a_lapsed_lease() {
    let (env, clock) = boot_with_clock().await;
    let a = browser(&env).await;
    seed(
        &env,
        "apps/stocks/shared/quotes/AAPL",
        cached_quote("AAPL", 342.94).to_string().as_bytes(),
    )
    .await;
    // A quotes call holds the lease and never ends.
    let held = (u64::MAX / 2).to_string();
    seed(&env, LEASE, held.as_bytes()).await;
    // A symbol that is kept needs no call, whoever holds the lease.
    ok(&get(&env, &a, "/api/stocks/quotes?symbols=AAPL").await);
    // One that is not waits for the call on its way, and when that never
    // ends answers its own 503 within its time (not the gateway's at the
    // deadline) rather than calling beside it.
    let (waited, ()) = support::join(get(&env, &a, "/api/stocks/quotes?symbols=MSFT"), async {
        left_waiting(&env, json!(["MSFT"])).await;
        clock.advance_ms(REQUEST_MS);
    })
    .await;
    assert_eq!(
        waited.status,
        503,
        "{}",
        String::from_utf8_lossy(&waited.body)
    );
    assert!(
        String::from_utf8_lossy(&waited.body).contains("being fetched for everyone"),
        "the module's own 503, not the gateway's: {}",
        String::from_utf8_lossy(&waited.body)
    );
    // A lease whose time is past is free: the request takes it and calls the
    // provider, which the deny-all egress here refuses (502).
    seed(&env, LEASE, b"1").await;
    let called = get(&env, &a, "/api/stocks/quotes?symbols=MSFT").await;
    assert_eq!(
        called.status,
        502,
        "{}",
        String::from_utf8_lossy(&called.body)
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn stocks_fire_an_alert_once_against_a_kept_quote() {
    let env = boot().await;
    let a = browser(&env).await;
    seed(
        &env,
        "apps/stocks/shared/quotes/AAPL",
        cached_quote("AAPL", 342.94).to_string().as_bytes(),
    )
    .await;
    const ALERTS: &str = "/api/stocks/alerts";
    let armed = json!({ "id": "a-1", "symbol": "AAPL", "above": 300.0, "created": 1 });
    let below = json!({ "id": "a-2", "symbol": "AAPL", "below": 100.0, "created": 1 });
    ok(&send(
        &env,
        &a,
        "PUT",
        ALERTS,
        json!({ "alerts": [armed.clone(), below], "rev": 0 }),
    )
    .await);
    let read = ok(&get(&env, &a, ALERTS).await);
    assert_eq!(read["alerts"][0]["fired"]["price"], 342.94, "{read}");
    assert_eq!(
        read["alerts"][1]["fired"],
        serde_json::Value::Null,
        "{read}"
    );
    assert_eq!(read["rev"], 2, "firing saved the alerts once");
    // A save based on the revision before the alert fired is refused, so it
    // cannot put the alert back unfired.
    let stale = send(
        &env,
        &a,
        "PUT",
        ALERTS,
        json!({ "alerts": [armed], "rev": 1 }),
    )
    .await;
    assert_eq!(
        stale.status,
        409,
        "{}",
        String::from_utf8_lossy(&stale.body)
    );
    let again = ok(&get(&env, &a, ALERTS).await);
    assert_eq!(again["rev"], 2, "it fires only once");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn stocks_tell_the_person_of_a_fired_alert_once_even_when_the_first_try_fails() {
    let env = boot().await;
    let a = browser(&env).await;
    seed(
        &env,
        "apps/stocks/shared/quotes/AAPL",
        cached_quote("AAPL", 342.94).to_string().as_bytes(),
    )
    .await;
    const ALERTS: &str = "/api/stocks/alerts";
    const INBOX: &str = "/api/notification-center/inbox";
    let armed = json!({ "id": "a-1", "symbol": "AAPL", "above": 300.0, "created": 1 });
    ok(&send(
        &env,
        &a,
        "PUT",
        ALERTS,
        json!({ "alerts": [armed], "rev": 0 }),
    )
    .await);
    let (kept, _) = env
        .store("data")
        .scan_prefix(b"apps/stocks/users/", None, 8)
        .await
        .expect("the alerts' key");
    let key = String::from_utf8(kept[0].0.clone()).unwrap();
    let principal = key.split('/').nth(3).expect("a principal").to_string();

    // An inbox that cannot be read makes the first delivery fail.
    let inbox = format!("apps/notification-center/users/{principal}/inbox");
    seed(&env, &inbox, b"not an inbox").await;
    let failed = ok(&get(&env, &a, ALERTS).await);
    let fired = failed["alerts"][0]["fired"].clone();
    assert_eq!(fired["price"], 342.94, "{failed}");
    assert_eq!(fired["notified"], false, "{failed}");

    // The next check delivers it, as fired: at its time and price, not today's quote.
    env.store("data")
        .delete(inbox.as_bytes())
        .await
        .expect("repair the inbox");
    seed(
        &env,
        "apps/stocks/shared/quotes/AAPL",
        cached_quote("AAPL", 400.0).to_string().as_bytes(),
    )
    .await;
    tokio::time::sleep(std::time::Duration::from_millis(5)).await;
    let told = ok(&get(&env, &a, ALERTS).await);
    let after = &told["alerts"][0]["fired"];
    assert_eq!(after["at"], fired["at"], "{told}");
    assert_eq!(after["price"], 342.94, "{told}");
    assert_eq!(after["notified"], serde_json::Value::Null, "{told}");
    let items = ok(&get(&env, &a, INBOX).await);
    assert_eq!(items["items"].as_array().unwrap().len(), 1, "{items}");
    assert_eq!(items["items"][0]["title"], "AAPL rose above 300.00");
    assert_eq!(items["items"][0]["body"], "Reached 342.94");
    assert_eq!(items["items"][0]["at_ms"], fired["at"], "{items}");

    // And no check after that says it again, or saves anything.
    let again = ok(&get(&env, &a, ALERTS).await);
    assert_eq!(again["rev"], told["rev"], "{again}");
    let items = ok(&get(&env, &a, INBOX).await);
    assert_eq!(items["items"].as_array().unwrap().len(), 1, "{items}");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn stocks_answer_a_waiting_request_from_the_call_it_waited_for() {
    let env = boot().await;
    let a = browser(&env).await;
    // Another request's quotes call is on its way: it holds the lease, and
    // once this request is waiting for it, keeps MSFT's quote and hands the
    // lease back.
    let held = (u64::MAX / 2).to_string();
    seed(&env, LEASE, held.as_bytes()).await;
    let (answer, ()) = support::join(get(&env, &a, "/api/stocks/quotes?symbols=MSFT"), async {
        left_waiting(&env, json!(["MSFT"])).await;
        seed(
            &env,
            "apps/stocks/shared/quotes/MSFT",
            cached_quote("MSFT", 512.5).to_string().as_bytes(),
        )
        .await;
        seed(&env, LEASE, b"0").await;
    })
    .await;
    // The waiting request answers with that call's quote and makes no call of
    // its own (the deny-all egress here would make one fail with 502).
    let answer = ok(&answer);
    assert_eq!(answer["quotes"][0]["price"], 512.5, "{answer}");
}

/// The JSON at `key` of the `data` store, or `null` when there is none.
async fn stored(env: &TestEnv, key: &str) -> serde_json::Value {
    match env
        .store("data")
        .get(key.as_bytes())
        .await
        .expect("read a key")
    {
        Some(bytes) => serde_json::from_slice(&bytes).expect("stored JSON"),
        None => serde_json::Value::Null,
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn stocks_requests_waiting_for_the_quotes_call_leave_their_symbols_to_the_next_call() {
    let (env, clock) = boot_with_clock().await;
    let a = browser(&env).await;
    // A call holds the lease and never ends: a request for symbols it does not
    // ask for waits, leaving them for the next call, and answers its own 503
    // when its time runs out.
    let held = (u64::MAX / 2).to_string();
    seed(&env, LEASE, held.as_bytes()).await;
    let (waited, ()) = support::join(
        get(&env, &a, "/api/stocks/quotes?symbols=MSFT,ibm"),
        async {
            left_waiting(&env, json!(["MSFT", "IBM"])).await;
            clock.advance_ms(REQUEST_MS);
        },
    )
    .await;
    assert_eq!(
        waited.status,
        503,
        "{}",
        String::from_utf8_lossy(&waited.body)
    );
    assert_eq!(stored(&env, WAITING).await, json!(["MSFT", "IBM"]));
    // A second waiting request adds only what is not left already.
    let (again, ()) = support::join(
        get(&env, &a, "/api/stocks/quotes?symbols=IBM,ORCL"),
        async {
            left_waiting(&env, json!(["MSFT", "IBM", "ORCL"])).await;
            clock.advance_ms(REQUEST_MS);
        },
    )
    .await;
    assert_eq!(again.status, 503);
    assert_eq!(stored(&env, WAITING).await, json!(["MSFT", "IBM", "ORCL"]));
    // The lease lapses: the next request takes it, and its one call asks for
    // its own symbol and every one left waiting, so the list is emptied. (The
    // deny-all egress here refuses the call: 502.)
    seed(&env, LEASE, b"1").await;
    let called = get(&env, &a, "/api/stocks/quotes?symbols=AAPL").await;
    assert_eq!(
        called.status,
        502,
        "{}",
        String::from_utf8_lossy(&called.body)
    );
    assert_eq!(stored(&env, WAITING).await, json!([]));
}

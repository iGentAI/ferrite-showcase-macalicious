//! Network fixtures: shared tests omit outbound bindings; `local-egress`
//! repeats them with Forge's deny-all policy. See tests/README.md.
//!
//! Maps on the in-process Forge planes (`ferrite-app-test`).
//!
//! Maps refuses searches and points that are not valid; answers 502 when
//! egress refuses Nominatim (the harness's egress is deny-all, so nothing
//! reaches the network here) and 503 when the application has no such
//! egress; refuses a route between points that are not valid and answers 502
//! when egress refuses the routers; keeps Nominatim to one request a second
//! for the whole application, answering 429 when the second stays taken;
//! serves a cached answer without asking anyone; and keeps each session's
//! Favorites, Recents and Guides under the revision rule.

use crate::egress_profile;

use ferrite_app::crypto::{hex, sha256};
use ferrite_app::{serde_json, IngressReply, IngressRequest};
use ferrite_app_test::{ingress, TestEnv, TestHarness};

/// A manual clock 900 ms into a second, so that waiting for the next second
/// takes a tenth of a second of real time.
const START_MS: u64 = 1_800_000_000_900;

async fn boot(egress: bool) -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let harness = TestHarness::new()
        .with_queue("requests")
        .with_queue("replies")
        .with_store("data")
        .manual_clock(START_MS);
    #[cfg(feature = "local-egress")]
    let harness = if egress {
        harness.with_egress("maps-search")
    } else {
        harness
    };
    #[cfg(not(feature = "local-egress"))]
    assert!(!egress, "deny-all fixtures require --features local-egress");
    let env = harness.build().await;
    env.run_app(|ctx| async move { macalicious_desktop::run(ctx).await });
    crate::support::Env::new(env, slot)
}

async fn call(env: &TestEnv, req: IngressRequest) -> IngressReply {
    env.handle(req).await.expect("a reply")
}

fn text(reply: &IngressReply) -> String {
    String::from_utf8_lossy(&reply.body).into_owned()
}

fn json(reply: &IngressReply) -> serde_json::Value {
    serde_json::from_slice(&reply.body).unwrap_or_else(|e| panic!("{e}: {}", text(reply)))
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
        .and_then(|pair| pair.strip_prefix("mac_session="))
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
    assert_eq!(reply.status, 200, "{}", text(reply));
    json(reply)
}

fn status(reply: &IngressReply, expected: u16) {
    assert_eq!(reply.status, expected, "{}", text(reply));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn maps_refuses_bad_requests_and_reports_a_refused_service() {
    let env = boot(egress_profile::DENIED).await;
    let a = browser(&env).await;
    const SEARCH: &str = "/api/maps/search";

    for bad in [
        String::new(),
        "?q=".into(),
        "?q=%20%20".into(),
        "?q=%C3".into(),
        format!("?q={}", "a".repeat(201)),
        "?q=cafe&near=91,0".into(),
        "?q=cafe&near=here".into(),
        // A location given but not decodable is refused, not dropped.
        "?q=cafe&near=%FF".into(),
    ] {
        status(&get(&env, &a, &format!("{SEARCH}{bad}")).await, 400);
    }
    status(
        &send(&env, &a, "POST", SEARCH, serde_json::json!({})).await,
        405,
    );

    // The harness's egress is deny-all: Nominatim is refused, as it is under
    // `ferrite dev` without `--egress allow`.
    let refused = get(
        &env,
        &a,
        &format!("{SEARCH}?q=Golden%20Gate%20Bridge&near=37.8%2C-122.4"),
    )
    .await;
    status(&refused, egress_profile::FAILURE_STATUS);
    assert!(
        text(&refused).contains(if egress_profile::DENIED {
            "egress refused the search service"
        } else {
            "no egress to the search service"
        }),
        "{}",
        text(&refused)
    );

    for bad in ["", "?lat=1", "?lat=1&lon=x", "?lat=-91&lon=0"] {
        status(
            &get(&env, &a, &format!("/api/maps/reverse{bad}")).await,
            400,
        );
    }
    for bad in [
        "",
        "?from=37.8%2C-122.4&to=37.9%2C-122.4",
        "?from=37.8%2C-122.4&to=37.9%2C-122.4&mode=flying",
        "?from=x&to=37.9%2C-122.4&mode=driving",
        "?from=37.8%2C-122.4&to=97%2C-122.4&mode=walking",
    ] {
        status(&get(&env, &a, &format!("/api/maps/route{bad}")).await, 400);
    }
    status(
        &send(&env, &a, "POST", "/api/maps/route", serde_json::json!({})).await,
        405,
    );
    // The harness has no egress named maps-route here: the application's manifest
    // would give it one (`ferrite.json`), and the module says what is missing.
    let no_router = get(
        &env,
        &a,
        "/api/maps/route?from=37.8199%2C-122.4783&to=37.803%2C-122.4662&mode=walking",
    )
    .await;
    status(&no_router, 503);
    assert!(
        text(&no_router).contains("no egress to the routing service"),
        "{}",
        text(&no_router)
    );
    status(&get(&env, &a, "/api/maps/nowhere").await, 404);
}

#[cfg(feature = "local-egress")]
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn maps_asks_nominatim_at_most_once_a_second_for_everyone() {
    let env = boot(egress_profile::DENIED).await;
    let a = browser(&env).await;
    let b = browser(&env).await;

    // The first search takes the second (and is refused by egress).
    status(
        &get(&env, &a, "/api/maps/search?q=Ferry%20Building").await,
        502,
    );
    // The clock stands still: another session's search finds every second it
    // tries taken, and is told to come back.
    let busy = get(&env, &b, "/api/maps/search?q=Coit%20Tower").await;
    status(&busy, 429);
    assert!(
        busy.headers
            .iter()
            .any(|(n, v)| n.eq_ignore_ascii_case("retry-after") && v == "1"),
        "{:?}",
        busy.headers
    );
    let reverse = get(&env, &a, "/api/maps/reverse?lat=37.8&lon=-122.4").await;
    status(&reverse, 429);
    // Less than a second later, even across the boundary of a calendar
    // second, the next request still waits its turn.
    crate::support::advance(&env, 600).await;
    status(&get(&env, &b, "/api/maps/search?q=Coit%20Tower").await, 429);
    // A full second after the first, the next search has its turn.
    crate::support::advance(&env, 400).await;
    status(&get(&env, &b, "/api/maps/search?q=Coit%20Tower").await, 502);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn maps_serves_a_cached_answer_without_asking_anyone() {
    // No egress at all: only the cache can answer.
    let env = boot(false).await;
    let a = browser(&env).await;
    let places = serde_json::json!([{
        "id": "osm-r21407754", "name": "Golden Gate Bridge", "category": "Bridge",
        "lat": 37.818292, "lon": -122.478384, "address": ["San Francisco, California"]
    }]);
    let key = format!(
        "apps/maps/shared/cache/search/{}",
        hex(&sha256(b"golden gate bridge"))
    );
    let mut store = env.store("data");
    store
        .put(key.as_bytes(), &serde_json::to_vec(&places).unwrap())
        .await
        .unwrap();

    let found = ok(&get(&env, &a, "/api/maps/search?q=Golden%20%20Gate%20BRIDGE").await);
    assert_eq!(found["cached"], true);
    assert_eq!(found["places"], places);
    assert_eq!(found["attribution"], "© OpenStreetMap contributors");
    // A search that is not cached needs the egress the application lacks.
    status(&get(&env, &a, "/api/maps/search?q=Alcatraz").await, 503);
}

fn place(id: &str, name: &str) -> serde_json::Value {
    serde_json::json!({
        "id": id, "name": name, "category": "Bridge", "lat": 37.818292, "lon": -122.478384,
        "address": ["San Francisco, California", "United States"],
        "website": "http://goldengatebridge.org/",
        "wikipedia": "https://en.wikipedia.org/wiki/Golden_Gate_Bridge"
    })
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn maps_keeps_each_persons_places_under_the_revision_rule() {
    let env = boot(false).await;
    let a = browser(&env).await;
    let b = browser(&env).await;
    const URL: &str = "/api/maps/places";

    let first = ok(&get(&env, &a, URL).await);
    assert_eq!(first["favorites"], serde_json::Value::Null);
    assert_eq!(first["rev"], 0);
    assert!(first["session"].is_string());

    let bridge = place("osm-r21407754", "Golden Gate Bridge");
    let doc = serde_json::json!({
        "favorites": [bridge],
        "recents": [bridge, place("osm-n1", "Fort Point")],
        "guides": [{ "id": "guide-1", "name": "Bridges", "places": [bridge] }],
        "rev": 0,
    });
    let saved = ok(&send(&env, &a, "PUT", URL, doc.clone()).await);
    assert_eq!(saved["rev"], 1);
    let read = ok(&get(&env, &a, URL).await);
    assert_eq!(read["favorites"][0]["name"], "Golden Gate Bridge");
    assert_eq!(read["recents"][1]["id"], "osm-n1");
    assert_eq!(read["guides"][0]["places"][0]["id"], "osm-r21407754");
    assert_eq!(
        ok(&get(&env, &b, URL).await)["favorites"],
        serde_json::Value::Null,
        "another person's places are their own"
    );

    let stale = send(&env, &a, "PUT", URL, doc.clone()).await;
    status(&stale, 409);
    assert_eq!(json(&stale)["rev"], 1);

    let mut script = doc.clone();
    script["rev"] = 1.into();
    script["favorites"][0]["website"] = "javascript:alert(1)".into();
    status(&send(&env, &a, "PUT", URL, script).await, 400);
    let mut twice = doc.clone();
    twice["rev"] = 1.into();
    twice["favorites"] = serde_json::json!([bridge, bridge]);
    status(&send(&env, &a, "PUT", URL, twice).await, 400);
    let mut unknown = doc.clone();
    unknown["rev"] = 1.into();
    unknown["notes"] = "x".into();
    status(&send(&env, &a, "PUT", URL, unknown).await, 400);
    let mut other = doc.clone();
    other["rev"] = 1.into();
    other["session"] = "another-session".into();
    status(&send(&env, &a, "PUT", URL, other).await, 409);

    status(
        &send(&env, &a, "DELETE", URL, serde_json::json!(null)).await,
        200,
    );
    assert_eq!(
        ok(&get(&env, &a, URL).await)["favorites"],
        serde_json::Value::Null
    );
    status(
        &send(&env, &a, "POST", URL, serde_json::json!({})).await,
        405,
    );
}

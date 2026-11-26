//! Find My on the in-process Forge planes (`ferrite-app-test`).
//!
//! Find My records the browser's reported position as its device, keeps a
//! device's newest report by the report's own time whatever order reports
//! arrive in, lists it with Play Sound's flag, lets only the device's own
//! person ask for or clear a sound or remove it, and forgets a device a week
//! after its last report. That one account never reaches another's devices is
//! also held by `tests/accounts_isolation.rs`.

use crate::support;

use ferrite_app::{serde_json, IngressReply, IngressRequest};
use ferrite_app_test::{ingress, TestEnv, TestHarness};

/// The platform's manual clock at the start of each test.
const START_MS: u64 = 1_800_000_000_900;

async fn boot() -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let harness = TestHarness::new()
        .with_queue("requests")
        .with_queue("replies")
        .with_store("data")
        .manual_clock(START_MS);
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
async fn find_my_lists_the_browser_as_a_device_and_plays_its_sound() {
    let env = boot().await;
    let a = browser(&env).await;
    let b = browser(&env).await;

    let none = ok(&get(&env, &a, "/api/find-my/devices").await);
    assert_eq!(none["devices"], serde_json::json!([]));

    let report = serde_json::json!({
        "lat": 37.8199, "lon": -122.4783, "accuracy_m": 25.0, "label": "Chromium on Linux",
        "reported_at": START_MS
    });
    let me = ok(&send(&env, &a, "PUT", "/api/find-my/me", report.clone()).await);
    let id = me["device"]["id"].as_str().unwrap().to_string();
    assert_eq!(id.len(), 16);
    assert_eq!(me["device"]["this"], true);
    assert_eq!(me["device"]["at"], START_MS);

    let listed = ok(&get(&env, &a, "/api/find-my/devices").await);
    assert_eq!(
        listed["devices"],
        serde_json::json!([{
            "id": id, "label": "Chromium on Linux", "lat": 37.8199, "lon": -122.4783,
            "accuracy_m": 25.0, "at": START_MS, "this": true, "sound_pending": false,
            "sound_request": null
        }])
    );
    assert_eq!(
        ok(&get(&env, &b, "/api/find-my/devices").await)["devices"],
        serde_json::json!([]),
        "another person sees none of this person's devices"
    );

    let sound = format!("/api/find-my/devices/{id}/sound");
    status(
        &send(&env, &b, "POST", &sound, serde_json::json!(null)).await,
        404,
    );
    let asked = ok(&send(&env, &a, "POST", &sound, serde_json::json!(null)).await);
    assert_eq!(asked["sound_pending"], true);
    assert_eq!(
        ok(&get(&env, &a, "/api/find-my/devices").await)["devices"][0]["sound_pending"],
        true
    );
    let mut again = report.clone();
    again["reported_at"] = serde_json::json!(START_MS + 1);
    let reported = ok(&send(&env, &a, "PUT", "/api/find-my/me", again).await);
    assert_eq!(reported["applied"], true);
    assert_eq!(
        reported["device"]["sound_pending"], true,
        "a new report does not drop the sound"
    );
    // An acknowledgement names the request it played: one without is refused
    // and clears nothing.
    status(
        &send(&env, &a, "DELETE", &sound, serde_json::json!(null)).await,
        400,
    );
    let waiting = asked["sound_request"].as_str().unwrap().to_string();
    ok(&send(
        &env,
        &a,
        "DELETE",
        &format!("{sound}?request={waiting}"),
        serde_json::json!(null),
    )
    .await);
    assert_eq!(
        ok(&get(&env, &a, "/api/find-my/devices").await)["devices"][0]["sound_pending"],
        false
    );

    // A request asked while the browser plays an earlier one is not cleared
    // by the earlier one's acknowledgement, even when both were asked from
    // this session in the same millisecond.
    let first = ok(&send(&env, &a, "POST", &sound, serde_json::json!(null)).await);
    let first_id = first["sound_request"].as_str().unwrap().to_string();
    assert_eq!(
        ok(&get(&env, &a, "/api/find-my/devices").await)["devices"][0]["sound_request"],
        first_id.as_str()
    );
    let second = ok(&send(&env, &a, "POST", &sound, serde_json::json!(null)).await);
    let second_id = second["sound_request"].as_str().unwrap().to_string();
    assert_ne!(first_id, second_id);
    let late = ok(&send(
        &env,
        &a,
        "DELETE",
        &format!("{sound}?request={first_id}"),
        serde_json::json!(null),
    )
    .await);
    assert_eq!(late["sound_pending"], true, "the newer request still waits");
    assert_eq!(late["sound_request"], second_id.as_str());
    let listed = ok(&get(&env, &a, "/api/find-my/devices").await);
    assert_eq!(listed["devices"][0]["sound_request"], second_id.as_str());
    let played = ok(&send(
        &env,
        &a,
        "DELETE",
        &format!("{sound}?request={second_id}"),
        serde_json::json!(null),
    )
    .await);
    assert_eq!(played["sound_pending"], false);
    assert_eq!(
        ok(&get(&env, &a, "/api/find-my/devices").await)["devices"][0]["sound_pending"],
        false
    );

    for bad in [
        serde_json::json!({ "lat": 91, "lon": 0, "accuracy_m": 1, "label": "x", "reported_at": 1 }),
        serde_json::json!({ "lat": 0, "lon": 0, "accuracy_m": -1, "label": "x", "reported_at": 1 }),
        serde_json::json!({ "lat": 0, "lon": 0, "accuracy_m": 1, "label": "", "reported_at": 1 }),
        serde_json::json!({ "lat": 0, "lon": 0, "accuracy_m": 1, "reported_at": 1 }),
        serde_json::json!({ "lat": 0, "lon": 0, "accuracy_m": 1, "label": "x" }),
        serde_json::json!({ "lat": 0, "lon": 0, "accuracy_m": 1, "label": "x", "reported_at": -1 }),
        serde_json::json!({ "lat": 0, "lon": 0, "accuracy_m": 1, "label": "x", "reported_at": START_MS + 10 * 60 * 1000 + 1 }),
        serde_json::json!({ "lat": 0, "lon": 0, "accuracy_m": 1, "label": "x", "reported_at": 1, "extra": 1 }),
    ] {
        status(&send(&env, &a, "PUT", "/api/find-my/me", bad).await, 400);
    }
    status(&get(&env, &a, "/api/find-my/me").await, 405);
    status(
        &send(
            &env,
            &a,
            "PUT",
            "/api/find-my/devices",
            serde_json::json!({}),
        )
        .await,
        405,
    );
    status(&get(&env, &a, &sound).await, 405);
    status(
        &send(
            &env,
            &a,
            "POST",
            "/api/find-my/devices/0123456789abcdef/sound",
            serde_json::json!(null),
        )
        .await,
        404,
    );
    status(
        &send(
            &env,
            &a,
            "DELETE",
            "/api/find-my/devices/..%2Fx",
            serde_json::json!(null),
        )
        .await,
        404,
    );
    status(
        &get(&env, &a, &format!("/api/find-my/devices/{id}/other")).await,
        404,
    );

    let removed = ok(&send(
        &env,
        &a,
        "DELETE",
        &format!("/api/find-my/devices/{id}"),
        serde_json::json!(null),
    )
    .await);
    assert_eq!(removed["removed"], true);
    assert_eq!(
        ok(&get(&env, &a, "/api/find-my/devices").await)["devices"],
        serde_json::json!([])
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn find_my_forgets_a_device_a_week_after_its_last_report() {
    let env = boot().await;
    let a = browser(&env).await;
    let report = serde_json::json!({
        "lat": 1.5, "lon": 2.5, "accuracy_m": 10, "label": "Firefox on Linux", "reported_at": START_MS
    });
    ok(&send(&env, &a, "PUT", "/api/find-my/me", report).await);
    // The clock jumps a week once the worker has acknowledged the request
    // (`support::advance`): a lease still open then would expire and the
    // report be delivered again.
    crate::support::advance(&env, 7 * 24 * 60 * 60 * 1000 - 1_000).await;
    assert_eq!(
        ok(&get(&env, &a, "/api/find-my/devices").await)["devices"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    crate::support::advance(&env, 2_000).await;
    assert_eq!(
        ok(&get(&env, &a, "/api/find-my/devices").await)["devices"],
        serde_json::json!([])
    );
}

/// A report of this browser at `lat`, made at `reported_at` by its clock.
fn report_at(lat: f64, reported_at: u64) -> serde_json::Value {
    serde_json::json!({
        "lat": lat, "lon": -122.0, "accuracy_m": 10.0, "label": "Chromium on Linux",
        "reported_at": reported_at
    })
}

async fn listed_lat(env: &TestEnv, token: &str) -> serde_json::Value {
    let listed = ok(&get(env, token, "/api/find-my/devices").await);
    assert_eq!(listed["devices"].as_array().unwrap().len(), 1, "{listed}");
    listed["devices"][0]["lat"].clone()
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn find_my_keeps_the_newest_report_when_reports_arrive_out_of_order() {
    let env = boot().await;
    let a = browser(&env).await;

    // The report made second reaches the server first.
    let newer = ok(&send(
        &env,
        &a,
        "PUT",
        "/api/find-my/me",
        report_at(37.2, START_MS - 1_000),
    )
    .await);
    assert_eq!(newer["applied"], true);
    assert_eq!(newer["device"]["lat"], 37.2);
    crate::support::advance(&env, 500).await;
    // The report made first arrives afterwards, received later by the
    // platform's clock: it changes nothing, and the answer is the newer
    // position the device keeps.
    let older = ok(&send(
        &env,
        &a,
        "PUT",
        "/api/find-my/me",
        report_at(37.1, START_MS - 2_000),
    )
    .await);
    assert_eq!(older["applied"], false);
    assert_eq!(older["device"]["lat"], 37.2);
    assert_eq!(
        older["device"]["at"], START_MS,
        "nor is the device seen again"
    );
    assert_eq!(listed_lat(&env, &a).await, 37.2);

    // A later report replaces it, as before.
    let later = ok(&send(
        &env,
        &a,
        "PUT",
        "/api/find-my/me",
        report_at(37.3, START_MS),
    )
    .await);
    assert_eq!(later["applied"], true);
    assert_eq!(later["device"]["at"], START_MS + 500);
    assert_eq!(listed_lat(&env, &a).await, 37.3);

    // Two reports sent at once, the older one first: the newer is kept
    // whichever the server stores first.
    let (first, second) = support::join(
        send(
            &env,
            &a,
            "PUT",
            "/api/find-my/me",
            report_at(40.0, START_MS + 10),
        ),
        send(
            &env,
            &a,
            "PUT",
            "/api/find-my/me",
            report_at(41.0, START_MS + 20),
        ),
    )
    .await;
    let applied = [
        ok(&first)["applied"].clone(),
        ok(&second)["applied"].clone(),
    ];
    assert_eq!(
        applied[1], true,
        "the newest report is always stored: {applied:?}"
    );
    assert_eq!(listed_lat(&env, &a).await, 41.0);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn find_my_keeps_the_first_of_two_reports_made_in_the_same_millisecond() {
    let env = boot().await;
    let a = browser(&env).await;
    let first = ok(&send(
        &env,
        &a,
        "PUT",
        "/api/find-my/me",
        report_at(10.0, START_MS),
    )
    .await);
    assert_eq!(first["applied"], true);
    let same = ok(&send(
        &env,
        &a,
        "PUT",
        "/api/find-my/me",
        report_at(20.0, START_MS),
    )
    .await);
    assert_eq!(same["applied"], false);
    assert_eq!(same["device"]["lat"], 10.0);
    assert_eq!(listed_lat(&env, &a).await, 10.0);

    // A browser's clock a little ahead of the platform's is accepted; one more
    // than ten minutes ahead is refused, so it cannot hold its device against
    // later reports for longer than that.
    let ahead = START_MS + 10 * 60 * 1000;
    ok(&send(&env, &a, "PUT", "/api/find-my/me", report_at(30.0, ahead)).await);
    status(
        &send(
            &env,
            &a,
            "PUT",
            "/api/find-my/me",
            report_at(31.0, ahead + 2),
        )
        .await,
        400,
    );
    assert_eq!(listed_lat(&env, &a).await, 30.0);
}

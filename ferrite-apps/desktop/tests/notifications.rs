//! The personal live stream (`/live/me`) and Notification Center, end to end
//! on the in-process Forge planes, with two people: Alice on two browsers
//! and Bob on one.
//!
//! What one person is told (a message in a room they read, a notification a
//! page raised, a change made in another browser, Do Not Disturb) reaches
//! every browser of that person, and never the other person's stream or
//! inbox. A ticket opens one stream once; a stream ends when its browser
//! signs out.

use ferrite_app::{serde_json, IngressReply, StreamFrame};
use ferrite_app_test::{ingress, TestEnv, TestHarness, WsSession};
use serde_json::{json, Value};

const PEPPER: &str = "test-pepper-0123456789abcdef0123456789abcdef";
const PASSWORD: &str = "correct horse battery";

async fn boot() -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let env = TestHarness::new()
        .with_queue("requests")
        .with_queue("replies")
        .with_queue("live")
        .with_queue("frames")
        .stream_requests("live")
        .with_store("data")
        .build()
        .await;
    let mut payload = env.payload().clone();
    payload
        .secrets
        .insert("mac_password_pepper".into(), PEPPER.into());
    let ctx = ferrite_app::AppContext::with_clock(payload, env.clock());
    env.run_app(move |_| async move { macalicious_desktop::run(ctx).await });
    crate::support::Env::new(env, slot)
}

fn text(reply: &IngressReply) -> String {
    String::from_utf8_lossy(&reply.body).into_owned()
}

fn header<'a>(reply: &'a IngressReply, name: &str) -> Option<&'a str> {
    reply
        .headers
        .iter()
        .find(|(n, _)| n.eq_ignore_ascii_case(name))
        .map(|(_, v)| v.as_str())
}

fn json_of(reply: &IngressReply) -> Value {
    serde_json::from_slice(&reply.body).unwrap_or_else(|e| panic!("{e}: {}", text(reply)))
}

/// One browser: the session cookie it holds.
#[derive(Default)]
struct Browser {
    token: Option<String>,
}

impl Browser {
    async fn send(
        &mut self,
        env: &TestEnv,
        method: &str,
        path: &str,
        body: Option<Value>,
    ) -> IngressReply {
        let bytes = body.map(|b| b.to_string().into_bytes()).unwrap_or_default();
        let mut req = ingress::request(method, path, "", &bytes);
        req.headers
            .push(("content-type".into(), "application/json".into()));
        if let Some(token) = &self.token {
            req.headers
                .push(("cookie".into(), format!("mac_session={token}")));
        }
        let reply = env
            .handle(req)
            .await
            .unwrap_or_else(|e| panic!("{method} {path}: no reply: {e}"));
        if let Some((_, cookie)) = reply
            .headers
            .iter()
            .find(|(n, _)| n.eq_ignore_ascii_case("set-cookie"))
        {
            let pair = cookie.split(';').next().unwrap_or("").trim();
            if let Some(token) = pair.strip_prefix("mac_session=") {
                self.token = (!token.is_empty()).then(|| token.to_string());
            }
        }
        reply
    }

    async fn get(&mut self, env: &TestEnv, path: &str) -> IngressReply {
        self.send(env, "GET", path, None).await
    }

    async fn post(&mut self, env: &TestEnv, path: &str, body: Value) -> IngressReply {
        self.send(env, "POST", path, Some(body)).await
    }

    /// A ticket for this browser's personal stream, and the browser's tag.
    async fn ticket(&mut self, env: &TestEnv) -> (String, String) {
        let reply = self.post(env, "/api/session/ticket", json!({})).await;
        assert_eq!(reply.status, 201, "ticket: {}", text(&reply));
        let body = json_of(&reply);
        (
            body["ticket"].as_str().unwrap().to_string(),
            body["tag"].as_str().unwrap().to_string(),
        )
    }

    /// This browser's personal stream, past its first `state` (returned).
    async fn stream(&mut self, env: &TestEnv) -> (WsSession, Value, String) {
        let (ticket, tag) = self.ticket(env).await;
        let mut sub = env
            .sse_open(&format!("/live/me?ticket={ticket}"))
            .await
            .unwrap();
        let first = sub.recv().await.expect("the first frame");
        assert_eq!(first.event.as_deref(), Some("state"), "{first:?}");
        (sub, state_of(&first), tag)
    }
}

async fn sign_up(env: &TestEnv, name: &str) -> Browser {
    let mut browser = Browser::default();
    let body = json!({ "name": name, "full_name": name.to_uppercase(), "password": PASSWORD });
    let reply = browser.post(env, "/api/session/sign-up", body).await;
    assert_eq!(reply.status, 201, "sign-up of {name}: {}", text(&reply));
    browser
}

async fn sign_in(env: &TestEnv, name: &str) -> Browser {
    let mut browser = Browser::default();
    browser.get(env, "/api/session").await;
    let body = json!({ "name": name, "password": PASSWORD });
    let reply = browser.post(env, "/api/session/sign-in", body).await;
    assert_eq!(reply.status, 200, "sign-in of {name}: {}", text(&reply));
    browser
}

fn state_of(frame: &StreamFrame) -> Value {
    serde_json::from_slice::<Value>(&frame.data).unwrap()["state"].clone()
}

/// The next `state` that satisfies `pred`. Every frame on the way must hold
/// none of `forbidden`.
async fn state_where(
    sub: &mut WsSession,
    forbidden: &[&str],
    mut pred: impl FnMut(&Value) -> bool,
) -> Value {
    loop {
        let frame = sub.recv().await.expect("the awaited state arrives");
        let data = String::from_utf8_lossy(&frame.data).into_owned();
        for needle in forbidden {
            assert!(
                !data.contains(needle),
                "LEAK: {needle:?} on this stream: {data}"
            );
        }
        if frame.event.as_deref() == Some("state") && pred(&state_of(&frame)) {
            return state_of(&frame);
        }
    }
}

fn titles(state: &Value) -> Vec<String> {
    state["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|item| item["title"].as_str().unwrap().to_string())
        .collect()
}

fn holds(state: &Value, title: &str) -> bool {
    titles(state).iter().any(|t| t == title)
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn one_persons_updates_reach_all_their_browsers_and_never_another_person() {
    let env = boot().await;
    let mut a1 = sign_up(&env, "alice").await;
    let mut bob = sign_up(&env, "bob").await;
    let mut a2 = sign_in(&env, "alice").await;

    let (mut alice_one, first, tag_one) = a1.stream(&env).await;
    assert_eq!(first["items"], json!([]));
    assert_eq!(first["dnd"], false);
    let (mut alice_two, _, tag_two) = a2.stream(&env).await;
    let (mut bobs, _, _) = bob.stream(&env).await;
    assert_ne!(tag_one, tag_two, "each browser has its own tag");
    // What only Alice may ever see.
    let alices = ["markerAliceDownload", "markerAliceNote", "markerBobToAlice"];

    // 1. A message: both read the room; Bob writes; Alice is told, on both
    //    browsers, and Bob, its author, is not.
    assert_eq!(a1.get(&env, "/api/messages/rooms/team").await.status, 200);
    assert_eq!(bob.get(&env, "/api/messages/rooms/team").await.status, 200);
    let said = bob
        .post(
            &env,
            "/api/messages/rooms/team",
            json!({ "name": "Bob", "text": "markerBobToAlice" }),
        )
        .await;
    assert_eq!(said.status, 201, "{}", text(&said));
    for stream in [&mut alice_one, &mut alice_two] {
        let state = state_where(stream, &[], |s| holds(s, "Bob")).await;
        let item = &state["items"][0];
        assert_eq!(item["app"], "messages");
        assert_eq!(item["body"], "markerBobToAlice");
        assert_eq!(item["subtitle"], "in team");
    }

    // 2. A notification a page raises reaches the person's every browser.
    let raised = a2
        .post(
            &env,
            "/api/notification-center/notify",
            json!({ "app": "finder", "title": "Download Finished", "body": "markerAliceDownload" }),
        )
        .await;
    assert_eq!(raised.status, 201, "{}", text(&raised));
    assert_eq!(json_of(&raised)["delivered"], true);
    let mut seq = 0;
    for stream in [&mut alice_one, &mut alice_two] {
        let state = state_where(stream, &[], |s| holds(s, "Download Finished")).await;
        seq = state["items"][0]["seq"].as_u64().unwrap();
    }

    // 3. A change in one browser reaches the other, named by its tag.
    let tape = a1
        .post(
            &env,
            "/api/calculator/tape",
            json!({ "expression": "markerAliceNote", "result": "1" }),
        )
        .await;
    assert!(tape.status < 400, "Calculator: {}", text(&tape));
    // The reply names the change's number, so the page that made it knows it for its own.
    assert_eq!(header(&tape, "x-macalicious-change"), Some("1"));
    let state = state_where(&mut alice_two, &[], |s| {
        s["changes"]["calculator"].is_object()
    })
    .await;
    assert_eq!(state["changes"]["calculator"]["n"], 1);
    assert_eq!(state["changes"]["calculator"]["by"], tag_one.as_str());
    let since = state["changes"]["calculator"]["since"].as_u64();
    assert!(
        since.is_some_and(|ms| ms > 0),
        "the count names when it began: {state}"
    );
    // A read names none, and the next write the next number, whichever browser makes it.
    let read = a2.get(&env, "/api/calculator/tape").await;
    assert_eq!(header(&read, "x-macalicious-change"), None);
    let again = a2
        .post(
            &env,
            "/api/calculator/tape",
            json!({ "expression": "markerAliceAgain", "result": "2" }),
        )
        .await;
    assert_eq!(header(&again, "x-macalicious-change"), Some("2"));
    let state = state_where(&mut alice_one, &[], |s| {
        s["changes"]["calculator"]["n"] == 2
    })
    .await;
    assert_eq!(state["changes"]["calculator"]["by"], tag_two.as_str());
    assert_eq!(
        state["changes"]["calculator"]["since"].as_u64(),
        since,
        "a count that goes on keeps when it began"
    );

    // 4. Cleared in one browser, gone from the other.
    let cleared = a2
        .send(
            &env,
            "DELETE",
            &format!("/api/notification-center/inbox/{seq}"),
            None,
        )
        .await;
    assert_eq!(json_of(&cleared)["removed"], 1);
    state_where(&mut alice_one, &[], |s| {
        !holds(s, "Download Finished") && holds(s, "Bob")
    })
    .await;

    // 5. Do Not Disturb, set in one browser, holds in the other.
    let dnd = a1
        .send(
            &env,
            "PUT",
            "/api/notification-center/dnd",
            Some(json!({ "on": true })),
        )
        .await;
    assert_eq!(json_of(&dnd)["dnd"], true);
    state_where(&mut alice_two, &[], |s| s["dnd"] == true).await;

    // 6. Bob's own notification reaches his stream, and nothing of Alice's
    //    ever came on it on the way; his inbox and settings hold none of it.
    let own = bob
        .post(
            &env,
            "/api/notification-center/notify",
            json!({ "app": "finder", "title": "Bob's Download" }),
        )
        .await;
    assert_eq!(own.status, 201);
    let state = state_where(&mut bobs, &alices, |s| holds(s, "Bob's Download")).await;
    assert_eq!(titles(&state), ["Bob's Download"]);
    assert_eq!(state["dnd"], false, "Alice's Do Not Disturb is hers");
    assert!(
        state["changes"]["calculator"].is_null(),
        "Alice's change is not Bob's: {state}"
    );
    assert_eq!(
        state["changes"]["messages"]["n"], 1,
        "Bob's own message is his change: {state}"
    );
    assert_ne!(state["changes"]["messages"]["by"], tag_one.as_str());
    assert_ne!(state["changes"]["messages"]["by"], tag_two.as_str());
    let inbox = text(&bob.get(&env, "/api/notification-center/inbox").await);
    for needle in alices {
        assert!(!inbox.contains(needle), "LEAK: Bob's inbox: {inbox}");
    }
    // Alice's streams never saw Bob's: a later notification of Alice's
    // reaches both, and no frame before it (Bob's came first) held his.
    let last = a1
        .post(
            &env,
            "/api/notification-center/notify",
            json!({ "app": "finder", "title": "Alice's Last" }),
        )
        .await;
    assert_eq!(last.status, 201, "{}", text(&last));
    for stream in [&mut alice_one, &mut alice_two] {
        let state = state_where(stream, &["Bob's Download"], |s| holds(s, "Alice's Last")).await;
        assert!(!holds(&state, "Bob's Download"));
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn a_ticket_opens_one_stream_once_and_a_signed_out_browser_hears_no_more() {
    let env = boot().await;
    let mut alice = sign_up(&env, "alice").await;
    let (ticket, _) = alice.ticket(&env).await;
    let mut first = env
        .sse_open(&format!("/live/me?ticket={ticket}"))
        .await
        .unwrap();
    assert_eq!(first.recv().await.unwrap().event.as_deref(), Some("state"));

    // Spent, unknown, malformed or missing: refused and ended.
    for path in [
        format!("/live/me?ticket={ticket}"),
        format!("/live/me?ticket={}", "0".repeat(64)),
        "/live/me?ticket=../../sessions".to_string(),
        "/live/me".to_string(),
    ] {
        let mut sub = env.sse_open(&path).await.unwrap();
        let frame = sub.recv().await.expect("a frame");
        assert_eq!(frame.event.as_deref(), Some("refused"), "{path}");
        assert!(frame.done, "{path}");
    }

    // A ticket whose browser has signed out since opens nothing.
    let mut leaving = sign_in(&env, "alice").await;
    let (stale, _) = leaving.ticket(&env).await;
    let out = leaving.post(&env, "/api/session/sign-out", json!({})).await;
    assert!(out.status < 400, "sign-out: {}", text(&out));
    let mut sub = env
        .sse_open(&format!("/live/me?ticket={stale}"))
        .await
        .unwrap();
    let frame = sub.recv().await.expect("a frame");
    assert_eq!(frame.event.as_deref(), Some("refused"), "{frame:?}");
    assert!(
        !String::from_utf8_lossy(&frame.data).contains("items"),
        "nothing of Alice's is sent"
    );

    // A browser that never signed in has its own anonymous stream, which
    // holds nothing of Alice's.
    let mut stranger = Browser::default();
    let (_, state, _) = stranger.stream(&env).await;
    assert_eq!(state["items"], json!([]));

    // Signing out ends Alice's subscription in that browser within a session
    // check, and the browser's next ticket is an anonymous one.
    let out = alice.post(&env, "/api/session/sign-out", json!({})).await;
    assert!(out.status < 400, "sign-out: {}", text(&out));
    let ended = first
        .recv_until(|f| f.event.as_deref() == Some("ended"))
        .await
        .expect("the subscription ends after the sign-out");
    assert!(ended.done);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_guest_inbox_written_from_elsewhere_ends_with_the_guest() {
    use macalicious_desktop::apps::notification_center::{self, Notification};
    use macalicious_desktop::session::GUEST_MAX_AGE_SECONDS;

    // A clock the test moves, to reach the end of the guest's time.
    let slot = crate::support::Slot::acquire();
    let env = TestHarness::new()
        .with_queue("requests")
        .with_queue("replies")
        .with_queue("live")
        .with_queue("frames")
        .stream_requests("live")
        .with_store("data")
        .manual_clock(1_760_000_000_000)
        .build()
        .await;
    let env = crate::support::Env::new(env, slot);
    let mut payload = env.payload().clone();
    payload
        .secrets
        .insert("mac_password_pepper".into(), PEPPER.into());
    let ctx = ferrite_app::AppContext::with_clock(payload, env.clock());
    env.run_app(move |_| async move { macalicious_desktop::run(ctx).await });
    let mut guest = Browser::default();
    guest.get(&env, "/api/session").await;
    let reply = guest.post(&env, "/api/session/guest", json!({})).await;
    assert!(reply.status < 400, "guest: {}", text(&reply));
    // The guest's principal, from the purge index (`accounts/guests/<expiry>/<id>`).
    let mut store = env.store("data");
    let (rows, _) = store
        .scan_prefix(b"accounts/guests/", None, 8)
        .await
        .unwrap();
    assert_eq!(rows.len(), 1, "one guest");
    let key = String::from_utf8(rows[0].0.clone()).unwrap();
    let principal = key.rsplit('/').next().unwrap().to_string();
    assert!(principal.starts_with("g-"), "{principal}");
    let inbox = format!("apps/notification-center/users/{principal}/inbox");
    let note = |id: &str| Notification {
        app: "messages".into(),
        id: id.into(),
        title: format!("Message {id}"),
        ..Notification::default()
    };

    let start = env.clock().now_ms();
    assert!(
        notification_center::notify(&mut store, &principal, start, &note("1"))
            .await
            .unwrap()
    );
    let shown = guest.get(&env, "/api/notification-center/inbox").await;
    assert!(text(&shown).contains("Message 1"), "{}", text(&shown));

    // Halfway through the guest's time, another notification: the inbox
    // still ends when the guest does, not a guest's lifetime after this write.
    let life = GUEST_MAX_AGE_SECONDS * 1000;
    crate::support::advance(&env, life / 2).await;
    let half = env.clock().now_ms();
    assert!(
        notification_center::notify(&mut store, &principal, half, &note("2"))
            .await
            .unwrap()
    );
    crate::support::advance(&env, life / 2 + 1_000).await;
    // Read as a listing from a fresh client, as the accounts tests read a
    // guest's keys.
    let (left, _) = env
        .store("data")
        .scan_prefix(inbox.as_bytes(), None, 8)
        .await
        .unwrap();
    assert!(left.is_empty(), "the guest's inbox went with the guest");
    // And nothing is written for a guest whose time has ended.
    let after = env.clock().now_ms();
    assert!(
        !notification_center::notify(&mut store, &principal, after, &note("3"))
            .await
            .unwrap()
    );
    let (left, _) = env
        .store("data")
        .scan_prefix(inbox.as_bytes(), None, 8)
        .await
        .unwrap();
    assert!(left.is_empty());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_redelivered_notification_is_shown_once_and_withdrawn_everywhere() {
    use macalicious_desktop::apps::notification_center::{self, Action, Notification};

    let env = boot().await;
    let mut alice = sign_up(&env, "alice").await;
    let (mut stream, _, _) = alice.stream(&env).await;
    // Alice's principal, as a module or timer loop would have it.
    let session = json_of(&alice.get(&env, "/api/session").await);
    assert_eq!(session["account"]["name"], "alice");
    let mut store = env.store("data");
    let record = store
        .get(b"accounts/names/alice")
        .await
        .unwrap()
        .expect("Alice's name record");
    let principal = serde_json::from_slice::<Value>(&record).unwrap()["id"]
        .as_str()
        .unwrap()
        .to_string();

    let alert = Notification {
        app: "reminders".into(),
        id: "rent@100".into(),
        title: "Pay rent".into(),
        alert: true,
        dismiss: Some("/alerts/rent/dismiss".into()),
        actions: vec![Action {
            label: "Snooze".into(),
            post: Some("/alerts/rent/snooze".into()),
        }],
        ..Notification::default()
    };
    let now = env.clock().now_ms();
    assert!(
        notification_center::notify(&mut store, &principal, now, &alert)
            .await
            .unwrap()
    );
    assert!(
        !notification_center::notify(&mut store, &principal, now, &alert)
            .await
            .unwrap(),
        "a redelivery is not a second notification"
    );
    let state = state_where(&mut stream, &[], |s| holds(s, "Pay rent")).await;
    assert_eq!(titles(&state), ["Pay rent"]);
    let item = &state["items"][0];
    assert_eq!(item["alert"], true);
    assert_eq!(item["dismiss"], "/alerts/rent/dismiss");
    assert_eq!(
        item["actions"],
        json!([{ "label": "Snooze", "post": "/alerts/rent/snooze" }])
    );

    notification_center::withdraw_at(&mut store, &principal, now, "reminders", "rent@100")
        .await
        .unwrap();
    state_where(&mut stream, &[], |s| s["items"] == json!([])).await;
    assert!(
        !notification_center::notify(&mut store, &principal, now, &alert)
            .await
            .unwrap(),
        "withdrawn stays delivered"
    );
    let bad = Notification {
        dismiss: Some("/../session/sign-out".into()),
        ..alert
    };
    assert!(
        notification_center::notify(&mut store, &principal, now, &bad)
            .await
            .is_err()
    );
}

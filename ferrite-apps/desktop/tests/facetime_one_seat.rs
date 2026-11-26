//! A person is in one FaceTime call at a time, also when two windows of theirs place or answer
//! calls at the same moment: their seat is claimed with compare-and-set before the call is
//! written, so only one of the two requests gets it, and the other is refused.

use crate::support;

use ferrite_app::{serde_json, IngressReply};
use ferrite_app_test::{ingress, TestEnv, TestHarness};
use serde_json::{json, Value};

const PEPPER: &str = "test-pepper-0123456789abcdef0123456789abcdef";
const PASSWORD: &str = "correct horse battery";
const START_MS: u64 = 1_792_396_800_000;
const PAGE_ONE: &str = "page-window-one-01";
const PAGE_TWO: &str = "page-window-two-02";
/// Rounds of two requests at once: each would seat the person twice without the claim.
const ROUNDS: usize = 6;
/// `CLAIM_HOLD_MS` in `src/apps/facetime/mod.rs`.
const CLAIM_HOLD_MS: u64 = 10_000;

async fn boot(manual: bool) -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let mut harness = TestHarness::new();
    if manual {
        harness = harness.manual_clock(START_MS);
    }
    let env = harness
        .with_queue("requests")
        .with_queue("replies")
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

fn json_of(reply: &IngressReply) -> Value {
    serde_json::from_slice(&reply.body).unwrap_or_else(|e| panic!("{e}: {}", text(reply)))
}

/// A browser window: its session cookie (two windows of one person share it).
#[derive(Clone)]
struct Window {
    token: Option<String>,
}

impl Window {
    async fn post(
        &mut self,
        env: &TestEnv,
        path: &str,
        body: Value,
        key: Option<&str>,
    ) -> IngressReply {
        let bytes = body.to_string();
        let mut req = ingress::request("POST", path, "", bytes.as_bytes());
        req.headers
            .push(("content-type".into(), "application/json".into()));
        if let Some(key) = key {
            req.headers.push(("idempotency-key".into(), key.into()));
        }
        if let Some(token) = &self.token {
            req.headers
                .push(("cookie".into(), format!("mac_session={token}")));
        }
        let reply = env
            .handle(req)
            .await
            .unwrap_or_else(|e| panic!("POST {path}: no reply: {e}"));
        if let Some((_, cookie)) = reply
            .headers
            .iter()
            .find(|(n, _)| n.eq_ignore_ascii_case("set-cookie"))
        {
            let pair = cookie.split(';').next().unwrap_or("").trim();
            if let Some(token) = pair.strip_prefix("mac_session=") {
                self.token = Some(token.to_string());
            }
        }
        reply
    }

    /// Calls `to` from the page `page`.
    async fn place(&mut self, env: &TestEnv, to: &str, page: &str, key: &str) -> IngressReply {
        let body = json!({ "to": to, "kind": "video", "page": page });
        self.post(env, "/api/facetime/calls", body, Some(key)).await
    }

    async fn join(&mut self, env: &TestEnv, id: &str, page: &str) -> IngressReply {
        let path = format!("/api/facetime/calls/{id}/join");
        self.post(env, &path, json!({ "page": page }), None).await
    }

    /// The caller hangs up (the caller's seat is 1).
    async fn hang_up(&mut self, env: &TestEnv, id: &str) {
        let path = format!("/api/facetime/calls/{id}/leave");
        let reply = self.post(env, &path, json!({ "seat": 1 }), None).await;
        assert_eq!(reply.status, 200, "hang up: {}", text(&reply));
    }
}

async fn sign_up(env: &TestEnv, name: &str) -> Window {
    let mut window = Window { token: None };
    let body = json!({ "name": name, "full_name": name.to_uppercase(), "password": PASSWORD });
    let reply = window.post(env, "/api/session/sign-up", body, None).await;
    assert_eq!(reply.status, 201, "sign-up of {name}: {}", text(&reply));
    window
}

fn call_id(reply: &IngressReply) -> String {
    json_of(reply)["state"]["id"]
        .as_str()
        .unwrap_or_else(|| panic!("a call: {}", text(reply)))
        .to_string()
}

/// Of two replies, the one that succeeded with `status`; the other must be the refusal of a
/// second call.
fn one_of<'a>(
    round: usize,
    status: u16,
    a: &'a IngressReply,
    b: &'a IngressReply,
) -> &'a IngressReply {
    let (won, lost) = match (a.status == status, b.status == status) {
        (true, false) => (a, b),
        (false, true) => (b, a),
        _ => panic!(
            "round {round}: one window must get the seat and the other be refused, got {} ({}) and {} ({})",
            a.status,
            text(a),
            b.status,
            text(b)
        ),
    };
    assert_eq!(lost.status, 409, "round {round}: {}", text(lost));
    assert_eq!(json_of(lost)["error"], "You are already in a call.");
    won
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn two_windows_placing_calls_at_once_seat_the_person_in_one_call() {
    let env = boot(false).await;
    let ada = sign_up(&env, "ada").await;
    sign_up(&env, "bob").await;
    sign_up(&env, "cat").await;
    let (mut one, mut two) = (ada.clone(), ada);
    for round in 0..ROUNDS {
        let (key_a, key_b) = (format!("place-{round}-a"), format!("place-{round}-b"));
        let (a, b) = support::join(
            one.place(&env, "bob", PAGE_ONE, &key_a),
            two.place(&env, "cat", PAGE_TWO, &key_b),
        )
        .await;
        let placed = one_of(round, 201, &a, &b);
        one.hang_up(&env, &call_id(placed)).await;
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn two_windows_answering_two_calls_at_once_take_one_seat() {
    let env = boot(false).await;
    let mut ada = sign_up(&env, "ada").await;
    let bob = sign_up(&env, "bob").await;
    let mut cat = sign_up(&env, "cat").await;
    let (mut one, mut two) = (bob.clone(), bob);
    for round in 0..ROUNDS {
        let from_ada = ada
            .place(&env, "bob", PAGE_ONE, &format!("ada-{round}"))
            .await;
        let from_cat = cat
            .place(&env, "bob", PAGE_TWO, &format!("cat-{round}"))
            .await;
        assert_eq!(from_ada.status, 201, "{}", text(&from_ada));
        assert_eq!(from_cat.status, 201, "{}", text(&from_cat));
        let (first, second) = (call_id(&from_ada), call_id(&from_cat));
        let (a, b) = support::join(
            one.join(&env, &first, PAGE_ONE),
            two.join(&env, &second, PAGE_TWO),
        )
        .await;
        one_of(round, 200, &a, &b);
        ada.hang_up(&env, &first).await;
        cat.hang_up(&env, &second).await;
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn the_same_answer_sent_twice_at_once_keeps_the_call() {
    let env = boot(false).await;
    let mut ada = sign_up(&env, "ada").await;
    let bob = sign_up(&env, "bob").await;
    let (mut one, mut two) = (bob.clone(), bob);
    for round in 0..ROUNDS {
        let placed = ada
            .place(&env, "bob", PAGE_ONE, &format!("same-{round}"))
            .await;
        assert_eq!(placed.status, 201, "{}", text(&placed));
        let id = call_id(&placed);
        // A retry of the same page's answer, delivered beside the first.
        let (a, b) =
            support::join(one.join(&env, &id, PAGE_TWO), two.join(&env, &id, PAGE_TWO)).await;
        assert_eq!(a.status, 200, "round {round}: {}", text(&a));
        assert_eq!(b.status, 200, "round {round}: {}", text(&b));
        for reply in [&a, &b] {
            let state = &json_of(reply)["state"];
            assert_eq!(
                state["ended_ms"], 0,
                "round {round}: the call goes on: {state}"
            );
        }
        // The call goes on after both: Ada hangs it up herself.
        ada.hang_up(&env, &id).await;
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_person_who_hangs_up_can_call_again_at_once() {
    let env = boot(true).await;
    let mut ada = sign_up(&env, "ada").await;
    sign_up(&env, "bob").await;
    sign_up(&env, "cat").await;
    let first = ada.place(&env, "bob", PAGE_ONE, "first").await;
    assert_eq!(first.status, 201, "{}", text(&first));
    ada.hang_up(&env, &call_id(&first)).await;
    // At the same instant: the claim of the call just ended keeps nothing.
    let second = ada.place(&env, "cat", PAGE_ONE, "second").await;
    assert_eq!(
        second.status,
        201,
        "a call right after hanging up: {}",
        text(&second)
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_claim_keeps_the_seat_only_while_its_request_may_still_be_writing() {
    let env = boot(true).await;
    let mut ada = sign_up(&env, "ada").await;
    for name in ["bob", "cat", "dan"] {
        sign_up(&env, name).await;
    }
    // Ada's own space: the key her keyed placing wrote.
    let first = ada.place(&env, "bob", PAGE_ONE, "first").await;
    assert_eq!(first.status, 201, "{}", text(&first));
    ada.hang_up(&env, &call_id(&first)).await;
    let (rows, _) = env
        .store("data")
        .scan_prefix(b"apps/facetime/users/", None, 64)
        .await
        .unwrap();
    let keyed = rows
        .iter()
        .map(|(key, _, _)| String::from_utf8_lossy(key).into_owned())
        .find(|key| key.ends_with("/keyed-calls"))
        .expect("Ada's keyed placings");
    let seat_key = keyed.replace("/keyed-calls", "/seat");
    let mut store = env.store("data");
    let unwritten = "f".repeat(32);

    // A request of another window claimed her seat just now and is writing its call: a call
    // placed meanwhile is refused.
    let fresh = json!({ "call": unwritten, "at_ms": START_MS }).to_string();
    store
        .put(seat_key.as_bytes(), fresh.as_bytes())
        .await
        .unwrap();
    let refused = ada.place(&env, "cat", PAGE_ONE, "during").await;
    assert_eq!(
        refused.status,
        409,
        "a call while another is being placed: {}",
        text(&refused)
    );
    assert_eq!(json_of(&refused)["error"], "You are already in a call.");

    // That request stopped and never wrote its call: once it can no longer be writing, its claim
    // keeps nothing.
    crate::support::advance(&env, CLAIM_HOLD_MS).await;
    let placed = ada.place(&env, "dan", PAGE_ONE, "after").await;
    assert_eq!(
        placed.status,
        201,
        "a claim nobody wrote a call for: {}",
        text(&placed)
    );
}

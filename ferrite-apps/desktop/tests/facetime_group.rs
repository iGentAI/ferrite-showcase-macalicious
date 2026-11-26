//! Group FaceTime over the app's own routes on the in-process Forge planes (`ferrite-app-test`): a
//! joined member adds someone, who rings with a line and a notification of their own, under the
//! checks of a new call; each pair of seats has its own link and a member reads only their own;
//! a person going ends the call only when fewer than two remain; and a call of two still ends for
//! both when one hangs up.

use ferrite_app::{serde_json, IngressReply};
use ferrite_app_test::{ingress, TestEnv, TestHarness};
use serde_json::{json, Value};

const PEPPER: &str = "test-pepper-0123456789abcdef0123456789abcdef";
const PASSWORD: &str = "correct horse battery";
/// The manual clock's start: Monday 19 October 2026, 08:00 UTC.
const START_MS: u64 = 1_792_396_800_000;
const SECOND: u64 = 1_000;

async fn boot() -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let env = TestHarness::new()
        .manual_clock(START_MS)
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

fn member<'a>(call: &'a Value, name: &str) -> &'a Value {
    call["members"]
        .as_array()
        .unwrap()
        .iter()
        .find(|m| m["name"] == name)
        .unwrap_or_else(|| panic!("{name} is not in {call}"))
}

struct Person {
    token: Option<String>,
}

impl Person {
    async fn send(
        &mut self,
        env: &TestEnv,
        method: &str,
        path: &str,
        body: Option<Value>,
    ) -> IngressReply {
        let bytes = body.map(|b| b.to_string()).unwrap_or_default();
        let mut req = ingress::request(method, path, "", bytes.as_bytes());
        if !bytes.is_empty() {
            req.headers
                .push(("content-type".into(), "application/json".into()));
        }
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
                self.token = Some(token.to_string());
            }
        }
        reply
    }

    async fn calls(&mut self, env: &TestEnv) -> Value {
        let reply = self.send(env, "GET", "/api/facetime/calls", None).await;
        assert_eq!(reply.status, 200, "{}", text(&reply));
        json_of(&reply)
    }

    /// The call as this person's page reads it, as its seat's sign of life.
    async fn read(&mut self, env: &TestEnv, id: &str, seat: u64) -> Value {
        let path = format!("/api/facetime/calls/{id}?seat={seat}");
        let reply = self.send(env, "GET", &path, None).await;
        assert_eq!(reply.status, 200, "{}", text(&reply));
        json_of(&reply)["state"].clone()
    }

    async fn act(&mut self, env: &TestEnv, id: &str, action: &str, body: Value) -> IngressReply {
        let path = format!("/api/facetime/calls/{id}/{action}");
        self.send(env, "POST", &path, Some(body)).await
    }

    async fn place(&mut self, env: &TestEnv, to: &str, page: &str) -> String {
        let body = json!({ "to": to, "kind": "video", "page": page });
        let reply = self
            .send(env, "POST", "/api/facetime/calls", Some(body))
            .await;
        assert_eq!(reply.status, 201, "{}", text(&reply));
        json_of(&reply)["state"]["id"].as_str().unwrap().to_string()
    }

    async fn join(&mut self, env: &TestEnv, id: &str, page: &str) -> u64 {
        let reply = self.act(env, id, "join", json!({ "page": page })).await;
        assert_eq!(reply.status, 200, "{}", text(&reply));
        let body = json_of(&reply);
        body["state"]["members"]
            .as_array()
            .unwrap()
            .iter()
            .find(|m| m["me"] == true)
            .and_then(|m| m["seat"]["n"].as_u64())
            .unwrap()
    }

    async fn add(&mut self, env: &TestEnv, id: &str, to: &str) -> IngressReply {
        self.act(env, id, "add", json!({ "to": to })).await
    }

    async fn added(&mut self, env: &TestEnv, id: &str, to: &str) -> Value {
        let reply = self.add(env, id, to).await;
        assert_eq!(reply.status, 201, "{}", text(&reply));
        json_of(&reply)["state"].clone()
    }

    async fn signal(&mut self, env: &TestEnv, id: &str, body: Value) {
        let reply = self.act(env, id, "signal", body).await;
        assert_eq!(reply.status, 200, "{}", text(&reply));
    }
}

async fn sign_up(env: &TestEnv, name: &str) -> Person {
    let mut person = Person { token: None };
    let body = json!({ "name": name, "full_name": name.to_uppercase(), "password": PASSWORD });
    let reply = person
        .send(env, "POST", "/api/session/sign-up", Some(body))
        .await;
    assert_eq!(reply.status, 201, "sign-up of {name}: {}", text(&reply));
    person
}

const PAGE_ADA: &str = "page-of-ada-00001";
const PAGE_BOB: &str = "page-of-bob-00001";
const PAGE_CID: &str = "page-of-cid-00001";

/// Ada calls Bob, Bob answers on seat 2, and Ada adds Cid, who answers on seat 3.
async fn three_in_a_call(env: &TestEnv) -> (Person, Person, Person, String) {
    let mut ada = sign_up(env, "ada").await;
    let mut bob = sign_up(env, "bob").await;
    let mut cid = sign_up(env, "cid").await;
    let id = ada.place(env, "bob", PAGE_ADA).await;
    assert_eq!(bob.join(env, &id, PAGE_BOB).await, 2);
    ada.added(env, &id, "cid").await;
    assert_eq!(cid.join(env, &id, PAGE_CID).await, 3);
    (ada, bob, cid, id)
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn someone_added_rings_with_a_line_and_a_notification_of_their_own() {
    let env = boot().await;
    let mut ada = sign_up(&env, "ada").await;
    let mut bob = sign_up(&env, "bob").await;
    let mut cid = sign_up(&env, "cid").await;
    let id = ada.place(&env, "bob", PAGE_ADA).await;
    assert_eq!(bob.join(&env, &id, PAGE_BOB).await, 2);

    let call = ada.added(&env, &id, "cid").await;
    assert_eq!(member(&call, "cid")["state"], "ringing");
    assert_eq!(member(&call, "cid")["seat"], Value::Null);
    assert!(
        !call.to_string().contains("u-"),
        "no account ids in the call: {call}"
    );

    let calls = cid.calls(&env).await;
    assert_eq!(calls["incoming"]["state"]["id"], id.as_str(), "{calls}");
    assert_eq!(calls["recents"][0]["status"], "incoming");
    assert_eq!(calls["recents"][0]["with"]["name"], "ada");
    assert_eq!(calls["recents"][0]["with_more"], 1);
    let inbox = cid
        .send(&env, "GET", "/api/notification-center/inbox", None)
        .await;
    let inbox = json_of(&inbox);
    assert_eq!(inbox["items"][0]["app"], "facetime", "{inbox}");
    assert_eq!(inbox["items"][0]["title"], "ADA");
    assert_eq!(inbox["items"][0]["alert"], true);

    // A resend is the same call, not a second ring.
    let again = ada.add(&env, &id, "cid").await;
    assert_eq!(again.status, 200, "{}", text(&again));
    assert_eq!(
        json_of(&again)["state"]["members"]
            .as_array()
            .unwrap()
            .len(),
        3
    );
    let inbox = cid
        .send(&env, "GET", "/api/notification-center/inbox", None)
        .await;
    assert_eq!(json_of(&inbox)["items"].as_array().unwrap().len(), 1);

    // The others' lines count the newcomer, and Bob's names the caller first.
    let calls = ada.calls(&env).await;
    assert_eq!(calls["recents"][0]["with"]["name"], "bob", "{calls}");
    assert_eq!(calls["recents"][0]["with_more"], 1);
    let calls = bob.calls(&env).await;
    assert_eq!(calls["recents"][0]["with"]["name"], "ada", "{calls}");
    assert_eq!(calls["recents"][0]["with_more"], 1);

    // Answering takes the ring away, with the next seat.
    assert_eq!(cid.join(&env, &id, PAGE_CID).await, 3);
    let inbox = cid
        .send(&env, "GET", "/api/notification-center/inbox", None)
        .await;
    assert_eq!(json_of(&inbox)["items"], json!([]));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn only_a_joined_member_adds_and_only_who_can_be_called() {
    let env = boot().await;
    let mut ada = sign_up(&env, "ada").await;
    let mut bob = sign_up(&env, "bob").await;
    let mut eve = sign_up(&env, "eve").await;
    let mut dee = sign_up(&env, "dee").await;
    let mut fay = sign_up(&env, "fay").await;
    sign_up(&env, "gus").await;
    let mut guest = Person { token: None };
    let reply = guest
        .send(&env, "POST", "/api/session/guest", Some(json!({})))
        .await;
    assert!(reply.status < 300, "{}", text(&reply));
    let guest_name = json_of(&guest.send(&env, "GET", "/api/facetime/me", None).await)["name"]
        .as_str()
        .unwrap()
        .to_string();

    let id = ada.place(&env, "bob", PAGE_ADA).await;
    // Bob still rings, and Eve is nobody in the call.
    assert_eq!(bob.add(&env, &id, "dee").await.status, 409);
    assert_eq!(eve.add(&env, &id, "dee").await.status, 404);
    assert_eq!(ada.add(&env, &id, "no-such-name").await.status, 404);
    assert_eq!(ada.add(&env, &id, &guest_name).await.status, 404);
    assert_eq!(ada.add(&env, &id, "ada").await.status, 400);
    assert_eq!(bob.join(&env, &id, PAGE_BOB).await, 2);
    let already = ada.add(&env, &id, "bob").await;
    assert_eq!(already.status, 409);
    assert_eq!(json_of(&already)["error"], "BOB is already in this call.");

    // Four people at most, whoever adds them.
    ada.added(&env, &id, "dee").await;
    bob.added(&env, &id, "fay").await;
    let full = ada.add(&env, &id, "gus").await;
    assert_eq!(full.status, 409, "{}", text(&full));
    assert_eq!(json_of(&full)["error"], "A call holds at most 4 people.");
    // Someone who went comes back only on a new call.
    assert_eq!(dee.act(&env, &id, "decline", json!({})).await.status, 200);
    assert_eq!(
        json_of(&ada.add(&env, &id, "dee").await)["error"],
        "DEE has already been in this call."
    );
    assert_eq!(fay.calls(&env).await["recents"][0]["added_by"], "bob");

    // After the call nobody adds to it.
    let bye = ada.act(&env, &id, "leave", json!({ "seat": 1 })).await;
    assert_eq!(bye.status, 200);
    bob.act(&env, &id, "leave", json!({ "seat": 2 })).await;
    assert_eq!(
        json_of(&ada.add(&env, &id, "gus").await)["error"],
        "This call has ended."
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn someone_who_blocked_a_person_in_the_call_hears_nothing_and_their_ring_runs_out() {
    let env = boot().await;
    let mut ada = sign_up(&env, "ada").await;
    let mut bob = sign_up(&env, "bob").await;
    let mut cid = sign_up(&env, "cid").await;
    // Cid has blocked Bob; it is Ada who adds them to a call Bob is in.
    let reply = cid
        .send(
            &env,
            "PUT",
            "/api/messages/blocked/bob",
            Some(json!({ "blocked": true })),
        )
        .await;
    assert_eq!(reply.status, 200, "{}", text(&reply));
    let id = ada.place(&env, "bob", PAGE_ADA).await;
    assert_eq!(bob.join(&env, &id, PAGE_BOB).await, 2);
    let call = ada.added(&env, &id, "cid").await;
    assert_eq!(member(&call, "cid")["state"], "ringing");

    let theirs = cid.calls(&env).await;
    assert_eq!(theirs["incoming"], Value::Null, "{theirs}");
    assert_eq!(theirs["recents"], json!([]), "{theirs}");
    let inbox = cid
        .send(&env, "GET", "/api/notification-center/inbox", None)
        .await;
    assert_eq!(json_of(&inbox)["items"], json!([]));

    // It rings out for the others, as a person nobody hears.
    for _ in 0..3 {
        crate::support::advance(&env, 15 * SECOND).await;
        ada.read(&env, &id, 1).await;
        bob.read(&env, &id, 2).await;
    }
    let call = bob.read(&env, &id, 2).await;
    assert_eq!(member(&call, "cid")["state"], "missed", "{call}");
    assert_eq!(call["ended_ms"], 0, "Ada and Bob go on: {call}");
    assert_eq!(cid.calls(&env).await["recents"], json!([]));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_member_rings_the_same_person_at_most_ten_times_an_hour_by_adding_too() {
    let env = boot().await;
    let mut bob = sign_up(&env, "bob").await;
    sign_up(&env, "cid").await;
    for round in 0..11 {
        // Someone new calls Bob each time, so only Bob's adding Cid counts towards a limit.
        let mut caller = sign_up(&env, &format!("caller{round}")).await;
        let id = caller.place(&env, "bob", PAGE_ADA).await;
        assert_eq!(bob.join(&env, &id, PAGE_BOB).await, 2);
        let reply = bob.add(&env, &id, "cid").await;
        if round < 10 {
            assert_eq!(reply.status, 201, "round {round}: {}", text(&reply));
        } else {
            assert_eq!(reply.status, 409, "round {round}: {}", text(&reply));
            assert!(text(&reply).contains("10 times"), "{}", text(&reply));
        }
        let bye = bob.act(&env, &id, "leave", json!({ "seat": 2 })).await;
        assert_eq!(bye.status, 200, "{}", text(&bye));
        let bye = caller.act(&env, &id, "leave", json!({ "seat": 1 })).await;
        assert_eq!(bye.status, 200, "{}", text(&bye));
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn each_pair_of_seats_has_its_link_and_a_member_reads_only_their_own() {
    let env = boot().await;
    let (mut ada, mut bob, mut cid, id) = three_in_a_call(&env).await;
    // Cid's later seat offers to each of the others, and Bob's to Ada.
    cid.signal(
        &env,
        &id,
        json!({ "from": 3, "to": 1, "offer": "cid to ada", "revision": 1 }),
    )
    .await;
    cid.signal(
        &env,
        &id,
        json!({ "from": 3, "to": 2, "offer": "cid to bob", "revision": 2 }),
    )
    .await;
    bob.signal(
        &env,
        &id,
        json!({ "from": 2, "to": 1, "offer": "bob to ada", "revision": 1 }),
    )
    .await;
    ada.signal(
        &env,
        &id,
        json!({ "from": 1, "to": 3, "answer": "ada to cid", "generation": 1 }),
    )
    .await;

    let of = |call: &Value| {
        let mut pairs: Vec<(u64, u64)> = call["links"]
            .as_array()
            .unwrap()
            .iter()
            .map(|l| (l["from"].as_u64().unwrap(), l["to"].as_u64().unwrap()))
            .collect();
        pairs.sort_unstable();
        pairs
    };
    let seen = ada.read(&env, &id, 1).await;
    assert_eq!(of(&seen), vec![(2, 1), (3, 1)], "{seen}");
    assert!(!seen.to_string().contains("cid to bob"), "{seen}");
    let seen = bob.read(&env, &id, 2).await;
    assert_eq!(of(&seen), vec![(2, 1), (3, 2)], "{seen}");
    let seen = cid.read(&env, &id, 3).await;
    assert_eq!(of(&seen), vec![(3, 1), (3, 2)], "{seen}");
    let answered = seen["links"]
        .as_array()
        .unwrap()
        .iter()
        .find(|l| l["to"] == 1)
        .unwrap();
    assert_eq!(answered["answer"], "ada to cid");
    // The overview carries no descriptions.
    let calls = cid.calls(&env).await;
    assert_eq!(calls["active"]["state"]["links"], json!([]));

    // A description past the share of a call of three is refused, and the call stays as it was.
    let long = "x".repeat(28 * 1024);
    let refused = bob
        .act(
            &env,
            &id,
            "signal",
            json!({ "from": 2, "to": 1, "offer": long, "revision": 2 }),
        )
        .await;
    assert_eq!(refused.status, 413, "{}", text(&refused));
    assert_eq!(ada.read(&env, &id, 1).await["ended_ms"], 0);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn four_people_connected_in_six_pairs_save_and_read_back() {
    let env = boot().await;
    let (mut ada, mut bob, mut cid, id) = three_in_a_call(&env).await;
    let mut dee = sign_up(&env, "dee").await;
    ada.added(&env, &id, "dee").await;
    assert_eq!(dee.join(&env, &id, "page-of-dee-00001").await, 4);

    let line = "a=candidate:1 1 udp 2122260223 192.0.2.1 50000 typ host\r\n";
    // Near the 14 KiB four people share, with its line ends counted as stored.
    let sdp = line.repeat(13 * 1024 / 59);
    let pairs = [(2, 1), (3, 1), (3, 2), (4, 1), (4, 2), (4, 3)];
    for (from, to) in pairs {
        let offer = json!({ "from": from, "to": to, "offer": sdp, "revision": 1 });
        let answer = json!({ "from": to, "to": from, "answer": sdp, "generation": 1 });
        for (seat, body) in [(from, offer), (to, answer)] {
            let person = match seat {
                1 => &mut ada,
                2 => &mut bob,
                3 => &mut cid,
                _ => &mut dee,
            };
            person.signal(&env, &id, body).await;
        }
    }
    let stored = env
        .store("data")
        .get(format!("apps/facetime/shared/calls/{id}").as_bytes())
        .await
        .unwrap()
        .expect("the call is stored");
    assert!(stored.len() > 12 * 12 * 1024, "{} bytes", stored.len());
    assert!(stored.len() <= 180 * 1024, "{} bytes", stored.len());
    // Each of the four reads three links, all answered.
    for (person, seat) in [(&mut ada, 1), (&mut bob, 2), (&mut cid, 3), (&mut dee, 4)] {
        let seen = person.read(&env, &id, seat).await;
        let links = seen["links"].as_array().unwrap();
        assert_eq!(links.len(), 3, "seat {seat}");
        assert!(links.iter().all(|l| l["answer"] == sdp.as_str()));
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_hang_up_drops_one_person_and_the_call_ends_when_fewer_than_two_remain() {
    let env = boot().await;
    let (mut ada, mut bob, mut cid, id) = three_in_a_call(&env).await;
    cid.signal(
        &env,
        &id,
        json!({ "from": 3, "to": 2, "offer": "cid to bob", "revision": 1 }),
    )
    .await;
    cid.signal(
        &env,
        &id,
        json!({ "from": 3, "to": 1, "offer": "cid to ada", "revision": 2 }),
    )
    .await;
    crate::support::advance(&env, 5 * SECOND).await;

    // Bob goes: Ada and Cid stay, with the link between them.
    let reply = bob.act(&env, &id, "leave", json!({ "seat": 2 })).await;
    assert_eq!(reply.status, 200, "{}", text(&reply));
    let call = ada.read(&env, &id, 1).await;
    assert_eq!(call["ended_ms"], 0, "{call}");
    assert_eq!(member(&call, "bob")["state"], "left");
    assert_eq!(call["links"].as_array().unwrap().len(), 1);
    assert_eq!(call["links"][0]["from"], 3);
    let cid_seen = cid.read(&env, &id, 3).await;
    assert_eq!(cid_seen["links"].as_array().unwrap().len(), 1, "{cid_seen}");
    assert_eq!(cid_seen["links"][0]["to"], 1);

    // Bob's line is finished, with his own time, and can be removed; he is in no call.
    let calls = bob.calls(&env).await;
    assert_eq!(calls["active"], Value::Null, "{calls}");
    assert_eq!(calls["recents"][0]["done"], true);
    assert_eq!(calls["recents"][0]["duration_ms"], 5 * SECOND);
    assert_eq!(calls["recents"][0]["with"]["name"], "ada");
    assert_eq!(calls["recents"][0]["with_more"], 1);
    let forget = format!("/api/facetime/calls/{id}");
    assert_eq!(bob.send(&env, "DELETE", &forget, None).await.status, 200);
    // The two others' lines are not finished yet.
    assert_eq!(ada.calls(&env).await["recents"][0]["done"], false);

    // Ada goes: only Cid is left, and the call ends for them.
    crate::support::advance(&env, 5 * SECOND).await;
    let reply = ada.act(&env, &id, "leave", json!({ "seat": 1 })).await;
    assert_eq!(reply.status, 200, "{}", text(&reply));
    assert_ne!(json_of(&reply)["state"]["ended_ms"], 0);
    let calls = cid.calls(&env).await;
    assert_eq!(calls["active"], Value::Null, "{calls}");
    assert_eq!(calls["recents"][0]["done"], true, "{calls}");
    assert_eq!(calls["recents"][0]["with"]["name"], "ada");
    assert_eq!(calls["recents"][0]["with_more"], 1);
    let calls = ada.calls(&env).await;
    assert_eq!(calls["recents"][0]["status"], "outgoing");
    assert_eq!(calls["recents"][0]["done"], true);
    assert_eq!(calls["recents"][0]["with"]["name"], "bob");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_page_gone_stale_drops_only_its_person_and_a_second_tab_takes_its_links_with_it() {
    let env = boot().await;
    let (mut ada, mut bob, mut cid, id) = three_in_a_call(&env).await;
    cid.signal(
        &env,
        &id,
        json!({ "from": 3, "to": 2, "offer": "cid to bob", "revision": 1 }),
    )
    .await;
    cid.signal(
        &env,
        &id,
        json!({ "from": 3, "to": 1, "offer": "cid to ada", "revision": 2 }),
    )
    .await;
    // Bob takes the call up in a second tab: his link goes, Ada's with Cid stays.
    assert_eq!(bob.join(&env, &id, "page-of-bob-00002").await, 4);
    let seen = ada.read(&env, &id, 1).await;
    assert_eq!(seen["links"].as_array().unwrap().len(), 1, "{seen}");
    let seen = cid.read(&env, &id, 3).await;
    assert_eq!(seen["links"].as_array().unwrap().len(), 1, "{seen}");
    assert_eq!(seen["links"][0]["to"], 1);
    // The later seat offers afresh to the two others.
    bob.signal(
        &env,
        &id,
        json!({ "from": 4, "to": 3, "offer": "bob to cid", "revision": 3 }),
    )
    .await;

    // Ada and Cid go on reading; Bob's tab goes quiet.
    for _ in 0..3 {
        crate::support::advance(&env, 10 * SECOND).await;
        ada.read(&env, &id, 1).await;
        cid.read(&env, &id, 3).await;
    }
    let call = ada.read(&env, &id, 1).await;
    assert_eq!(call["ended_ms"], 0, "{call}");
    assert_eq!(member(&call, "bob")["state"], "left");
    assert_eq!(bob.calls(&env).await["recents"][0]["done"], true);
    assert_eq!(
        cid.read(&env, &id, 3).await["links"]
            .as_array()
            .unwrap()
            .len(),
        1
    );

    // Cid goes quiet too: the call ends once Ada reads it.
    for _ in 0..3 {
        crate::support::advance(&env, 10 * SECOND).await;
        ada.read(&env, &id, 1).await;
    }
    let call = ada.read(&env, &id, 1).await;
    assert_ne!(call["ended_ms"], 0, "{call}");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn an_added_person_declining_or_ringing_out_ends_nothing_and_rings_for_their_own_time() {
    let env = boot().await;
    let mut ada = sign_up(&env, "ada").await;
    let mut bob = sign_up(&env, "bob").await;
    let mut cid = sign_up(&env, "cid").await;
    let mut dee = sign_up(&env, "dee").await;
    let id = ada.place(&env, "bob", PAGE_ADA).await;
    assert_eq!(bob.join(&env, &id, PAGE_BOB).await, 2);

    // Thirty seconds in, Cid is added: past the call's own 45 s of ringing, they still ring.
    for _ in 0..2 {
        crate::support::advance(&env, 15 * SECOND).await;
        ada.read(&env, &id, 1).await;
        bob.read(&env, &id, 2).await;
    }
    ada.added(&env, &id, "cid").await;
    crate::support::advance(&env, 20 * SECOND).await;
    ada.read(&env, &id, 1).await;
    bob.read(&env, &id, 2).await;
    let calls = cid.calls(&env).await;
    assert_eq!(calls["incoming"]["state"]["id"], id.as_str(), "{calls}");

    // Their ring runs out 45 s after they were added, and the call goes on.
    crate::support::advance(&env, 15 * SECOND).await;
    ada.read(&env, &id, 1).await;
    bob.read(&env, &id, 2).await;
    crate::support::advance(&env, 10 * SECOND).await;
    ada.read(&env, &id, 1).await;
    let call = bob.read(&env, &id, 2).await;
    assert_eq!(member(&call, "cid")["state"], "missed", "{call}");
    assert_eq!(call["ended_ms"], 0, "{call}");
    let calls = cid.calls(&env).await;
    assert_eq!(calls["incoming"], Value::Null, "{calls}");
    assert_eq!(calls["recents"][0]["status"], "missed");
    assert_eq!(calls["recents"][0]["done"], true);
    let inbox = cid
        .send(&env, "GET", "/api/notification-center/inbox", None)
        .await;
    let items = json_of(&inbox)["items"].clone();
    assert_eq!(
        items.as_array().map(Vec::len),
        Some(1),
        "the ring goes: {items}"
    );
    assert_eq!(
        items[0]["body"], "Missed FaceTime Video",
        "and the missed call stays"
    );

    // Dee declines: the call goes on, and the ring goes for Dee.
    ada.added(&env, &id, "dee").await;
    let reply = dee.act(&env, &id, "decline", json!({})).await;
    assert_eq!(reply.status, 200, "{}", text(&reply));
    assert_eq!(json_of(&reply)["state"]["ended_ms"], 0);
    let calls = dee.calls(&env).await;
    assert_eq!(calls["incoming"], Value::Null, "{calls}");
    assert_eq!(calls["recents"][0]["status"], "missed");
    assert_eq!(calls["recents"][0]["done"], true);
    let inbox = dee
        .send(&env, "GET", "/api/notification-center/inbox", None)
        .await;
    assert_eq!(json_of(&inbox)["items"], json!([]));
    assert_eq!(ada.read(&env, &id, 1).await["ended_ms"], 0);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_ring_run_out_leaves_notification_center_at_the_next_write_that_finds_it() {
    let env = boot().await;
    let mut ada = sign_up(&env, "ada").await;
    let mut bob = sign_up(&env, "bob").await;
    let mut cid = sign_up(&env, "cid").await;
    let mut dee = sign_up(&env, "dee").await;
    let id = ada.place(&env, "bob", PAGE_ADA).await;
    assert_eq!(bob.join(&env, &id, PAGE_BOB).await, 2);

    ada.added(&env, &id, "cid").await;
    let inbox = cid
        .send(&env, "GET", "/api/notification-center/inbox", None)
        .await;
    assert_eq!(json_of(&inbox)["items"].as_array().unwrap().len(), 1);
    for _ in 0..3 {
        crate::support::advance(&env, 14 * SECOND).await;
        ada.read(&env, &id, 1).await;
        bob.read(&env, &id, 2).await;
    }
    crate::support::advance(&env, 4 * SECOND).await;

    // Adding someone is the first write to find Cid's ring over.
    ada.added(&env, &id, "dee").await;
    let inbox = cid
        .send(&env, "GET", "/api/notification-center/inbox", None)
        .await;
    let items = json_of(&inbox)["items"].clone();
    assert_eq!(
        items.as_array().map(Vec::len),
        Some(1),
        "Cid's ring goes: {items}"
    );
    assert_eq!(
        items[0]["body"], "Missed FaceTime Video",
        "and the missed call stays"
    );

    let inbox = dee
        .send(&env, "GET", "/api/notification-center/inbox", None)
        .await;
    assert_eq!(json_of(&inbox)["items"].as_array().unwrap().len(), 1);
    for _ in 0..3 {
        crate::support::advance(&env, 14 * SECOND).await;
        ada.read(&env, &id, 1).await;
        bob.read(&env, &id, 2).await;
    }
    crate::support::advance(&env, 4 * SECOND).await;

    // An action on the call is the first write to find Dee's.
    bob.signal(
        &env,
        &id,
        json!({ "from": 2, "to": 1, "offer": "bob to ada", "revision": 1 }),
    )
    .await;
    let inbox = dee
        .send(&env, "GET", "/api/notification-center/inbox", None)
        .await;
    let items = json_of(&inbox)["items"].clone();
    assert_eq!(
        items.as_array().map(Vec::len),
        Some(1),
        "Dee's ring goes: {items}"
    );
    assert_eq!(
        items[0]["body"], "Missed FaceTime Video",
        "and the missed call stays"
    );
    let call = ada.read(&env, &id, 1).await;
    assert_eq!(member(&call, "cid")["state"], "missed", "{call}");
    assert_eq!(member(&call, "dee")["state"], "missed", "{call}");
    assert_eq!(call["ended_ms"], 0, "{call}");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn someone_who_left_a_call_going_on_can_place_another_at_once() {
    let env = boot().await;
    let (_ada, mut bob, _cid, id) = three_in_a_call(&env).await;
    sign_up(&env, "dee").await;
    let reply = bob.act(&env, &id, "leave", json!({ "seat": 2 })).await;
    assert_eq!(reply.status, 200, "{}", text(&reply));
    assert_eq!(json_of(&reply)["state"]["ended_ms"], 0);
    // Still inside the hold of the claim Bob's answer made a moment ago.
    let new = bob.place(&env, "dee", "page-of-bob-00002").await;
    assert_ne!(new, id);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_call_of_two_still_ends_for_both_when_one_hangs_up_or_declines() {
    let env = boot().await;
    let mut ada = sign_up(&env, "ada").await;
    let mut bob = sign_up(&env, "bob").await;
    let id = ada.place(&env, "bob", PAGE_ADA).await;
    assert_eq!(bob.join(&env, &id, PAGE_BOB).await, 2);
    let reply = bob.act(&env, &id, "leave", json!({ "seat": 2 })).await;
    assert_eq!(reply.status, 200, "{}", text(&reply));
    assert_ne!(json_of(&reply)["state"]["ended_ms"], 0);
    let calls = ada.calls(&env).await;
    assert_eq!(calls["active"], Value::Null, "{calls}");
    assert_eq!(calls["recents"][0]["done"], true);
    assert_eq!(calls["recents"][0].get("with_more"), None, "{calls}");

    let id = ada.place(&env, "bob", "page-of-ada-00002").await;
    let reply = bob.act(&env, &id, "decline", json!({})).await;
    assert_ne!(json_of(&reply)["state"]["ended_ms"], 0, "{}", text(&reply));
}

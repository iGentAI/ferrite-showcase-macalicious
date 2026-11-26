//! The desktop's accounts (`src/accounts/`, `src/session.rs`) on the
//! in-process Forge planes: signing up, in and out, the cookie each issues,
//! failed and locked-out sign-ins, Lock Screen, Guest User, the one-time move
//! of a browser's earlier data, the secrets that set them up, and that no
//! password or pepper is ever stored or answered.

use crate::support;

use ferrite_app::{serde_json, IngressReply, IngressRequest};
use ferrite_app_test::{ingress, TestEnv, TestHarness};
use macalicious_desktop::accounts::{MAX_FAILURES, SETTLE_MS};

const PEPPER: &str = "test-pepper-0123456789abcdef0123456789abcdef";
const PASSWORD: &str = "correct horse battery";

async fn boot_with(secrets: &[(&str, &str)]) -> crate::support::Env {
    boot_in(crate::support::Slot::acquire(), secrets).await
}

/// Boots in `slot`: a test's second environment, beside its first, takes
/// [`crate::support::Slot::beside`].
async fn boot_in(slot: crate::support::Slot, secrets: &[(&str, &str)]) -> crate::support::Env {
    let env = TestHarness::new()
        .with_blob("files")
        .with_queue("requests")
        .with_queue("replies")
        .with_store("data")
        .manual_clock(1_760_000_000_000)
        .build()
        .await;
    let mut payload = env.payload().clone();
    for (name, value) in secrets {
        payload.secrets.insert(name.to_string(), value.to_string());
    }
    let ctx = ferrite_app::AppContext::with_clock(payload, env.clock());
    env.run_app(move |_| async move { macalicious_desktop::run(ctx).await });
    crate::support::Env::new(env, slot)
}

async fn boot() -> crate::support::Env {
    boot_with(&[("mac_password_pepper", PEPPER)]).await
}

fn header<'a>(reply: &'a IngressReply, name: &str) -> Option<&'a str> {
    reply
        .headers
        .iter()
        .find(|(n, _)| n.eq_ignore_ascii_case(name))
        .map(|(_, v)| v.as_str())
}

fn json(reply: &IngressReply) -> serde_json::Value {
    serde_json::from_slice(&reply.body)
        .unwrap_or_else(|e| panic!("{e}: {}", String::from_utf8_lossy(&reply.body)))
}

/// One browser: the cookie it holds, replaced by every `set-cookie` it is
/// given.
#[derive(Default)]
struct Browser {
    token: Option<String>,
}

impl Browser {
    async fn send(&mut self, env: &TestEnv, mut req: IngressRequest) -> IngressReply {
        if let Some(token) = &self.token {
            req.headers
                .push(("cookie".into(), format!("mac_session={token}")));
        }
        let reply = env.handle(req).await.expect("a reply");
        if let Some(cookie) = header(&reply, "set-cookie") {
            let pair = cookie.split(';').next().unwrap();
            let token = pair
                .strip_prefix("mac_session=")
                .expect("the session cookie");
            self.token = (!token.is_empty()).then(|| token.to_string());
        }
        reply
    }

    async fn get(&mut self, env: &TestEnv, path: &str) -> IngressReply {
        self.send(env, ingress::get(path)).await
    }

    async fn post(&mut self, env: &TestEnv, path: &str, body: serde_json::Value) -> IngressReply {
        let mut req = ingress::post(path, body.to_string());
        req.headers
            .push(("content-type".into(), "application/json".into()));
        self.send(env, req).await
    }

    async fn sign_up(&mut self, env: &TestEnv, name: &str) -> IngressReply {
        let body = serde_json::json!({ "name": name, "full_name": name.to_uppercase(), "password": PASSWORD });
        self.post(env, "/api/session/sign-up", body).await
    }

    async fn sign_in(&mut self, env: &TestEnv, name: &str, password: &str) -> IngressReply {
        let body = serde_json::json!({ "name": name, "password": password });
        self.post(env, "/api/session/sign-in", body).await
    }

    async fn session(&mut self, env: &TestEnv) -> serde_json::Value {
        json(&self.get(env, "/api/session").await)
    }

    async fn tape(&mut self, env: &TestEnv) -> Vec<String> {
        json(&self.get(env, "/api/calculator/tape").await)["entries"]
            .as_array()
            .unwrap()
            .iter()
            .map(|e| e["result"].as_str().unwrap().to_string())
            .collect()
    }

    async fn add_to_tape(&mut self, env: &TestEnv, result: &str) {
        let body = serde_json::json!({ "expression": "x", "result": result });
        let reply = self.post(env, "/api/calculator/tape", body).await;
        assert_eq!(
            reply.status,
            201,
            "{}",
            String::from_utf8_lossy(&reply.body)
        );
    }
}

/// Every key in the `data` store under `prefix`.
async fn keys(env: &TestEnv, prefix: &str) -> Vec<(String, Vec<u8>)> {
    let mut out = Vec::new();
    let mut after: Option<Vec<u8>> = None;
    loop {
        let (rows, more) = env
            .store("data")
            .scan_prefix(prefix.as_bytes(), after.as_deref(), 1024)
            .await
            .unwrap();
        for (key, value, _) in rows {
            after = Some(key.clone());
            out.push((String::from_utf8_lossy(&key).into_owned(), value));
        }
        if !more || after.is_none() {
            return out;
        }
    }
}

fn has_attribute(cookie: &str, attribute: &str) -> bool {
    cookie.split(';').any(|a| a.trim() == attribute)
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn signing_up_signs_in_with_a_fresh_cookie_and_ends_the_old_session() {
    let env = boot().await;
    let mut browser = Browser::default();
    let anonymous = browser.session(&env).await;
    assert_eq!(anonymous["account"], serde_json::Value::Null);
    assert_eq!(anonymous["signup"], "open");
    assert_eq!(anonymous["sign_in_ready"], true);
    let before = browser.token.clone().unwrap();

    let reply = browser.sign_up(&env, "Alice").await;
    assert_eq!(
        reply.status,
        201,
        "{}",
        String::from_utf8_lossy(&reply.body)
    );
    let cookie = header(&reply, "set-cookie").unwrap().to_string();
    for attribute in [
        "HttpOnly",
        "Secure",
        "SameSite=Lax",
        "Path=/",
        "Max-Age=2592000",
    ] {
        assert!(
            has_attribute(&cookie, attribute),
            "{cookie} lacks {attribute}"
        );
    }
    let after = browser.token.clone().unwrap();
    assert_ne!(before, after, "signing in issues a new token");
    let me = json(&reply);
    assert_eq!(
        me["account"]["name"], "alice",
        "names are kept in lower case"
    );
    assert_eq!(me["account"]["full_name"], "ALICE");
    assert_eq!(me["account"]["guest"], false);
    assert!(me["account"].get("id").is_none());

    // The token from before sign-in reaches nothing: while the change is
    // fresh it is refused with no cookie, so its reply can never replace the
    // new one.
    let mut planted = Browser {
        token: Some(before),
    };
    let reply = planted.get(&env, "/api/session").await;
    assert_eq!(reply.status, 409);
    assert!(header(&reply, "set-cookie").is_none());
    assert!(json(&reply).get("account").is_none());

    // The name is taken now, in any case.
    let mut other = Browser::default();
    assert_eq!(other.sign_up(&env, "ALICE").await.status, 409);

    // Signing out issues yet another token and leaves the account.
    let reply = browser
        .post(&env, "/api/session/sign-out", serde_json::json!({}))
        .await;
    assert_eq!(reply.status, 200);
    assert_ne!(browser.token.as_deref(), Some(after.as_str()));
    assert_eq!(json(&reply)["account"], serde_json::Value::Null);
    let mut stale = Browser { token: Some(after) };
    assert_eq!(
        stale.session(&env).await["account"],
        serde_json::Value::Null
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn sign_in_checks_the_password_and_keeps_its_secrets() {
    let env = boot().await;
    let mut alice = Browser::default();
    assert_eq!(alice.sign_up(&env, "alice").await.status, 201);
    alice.add_to_tape(&env, "42").await;

    let mut laptop = Browser::default();
    let wrong = laptop.sign_in(&env, "alice", "not the password").await;
    assert_eq!(wrong.status, 401);
    let unknown = laptop.sign_in(&env, "nobody", PASSWORD).await;
    assert_eq!(unknown.status, 401);
    assert_eq!(
        json(&wrong)["error"],
        json(&unknown)["error"],
        "a wrong password and an unknown name are told apart by nothing"
    );
    assert_eq!(
        laptop.session(&env).await["account"],
        serde_json::Value::Null
    );

    let right = laptop.sign_in(&env, " Alice ", PASSWORD).await;
    assert_eq!(right.status, 200);
    assert_eq!(
        laptop.tape(&env).await,
        ["42"],
        "the account's data, from another browser"
    );

    // Neither the password nor the pepper is stored anywhere, or answered.
    for (key, value) in keys(&env, "").await {
        let text = String::from_utf8_lossy(&value);
        assert!(!text.contains(PASSWORD), "{key} holds the password");
        assert!(!text.contains(PEPPER), "{key} holds the pepper");
    }
    for body in [&right.body, &wrong.body] {
        let text = String::from_utf8_lossy(body);
        assert!(!text.contains("pbkdf2") && !text.contains(PEPPER), "{text}");
    }
    let users = keys(&env, "accounts/users/").await;
    assert_eq!(users.len(), 1);
    let record: serde_json::Value = serde_json::from_slice(&users[0].1).unwrap();
    let hash = record["hash"].as_str().unwrap();
    let iterations: u32 = hash.split('$').nth(1).unwrap().parse().unwrap();
    assert!(hash.starts_with("pbkdf2-sha256$"), "{hash}");
    assert!(
        (macalicious_desktop::accounts::MIN_ITERATIONS
            ..=macalicious_desktop::accounts::MAX_ITERATIONS)
            .contains(&iterations),
        "{iterations}"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn five_failures_lock_the_name() {
    let env = boot().await;
    let mut alice = Browser::default();
    assert_eq!(alice.sign_up(&env, "alice").await.status, 201);
    let mut thief = Browser::default();
    for _ in 0..5 {
        assert_eq!(
            thief.sign_in(&env, "alice", "guess guess").await.status,
            401
        );
    }
    assert_eq!(
        thief.sign_in(&env, "alice", PASSWORD).await.status,
        429,
        "locked even with the right password"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn attempts_sent_at_once_cannot_pass_the_limit() {
    let env = boot().await;
    let mut alice = Browser::default();
    assert_eq!(alice.sign_up(&env, "alice").await.status, 201);
    let attempts = (0..12).map(|n| {
        let body = serde_json::json!({ "name": "alice", "password": format!("guess {n:02}") });
        let mut req = ingress::post("/api/session/sign-in", body.to_string());
        req.headers
            .push(("content-type".into(), "application/json".into()));
        req
    });
    let replies = env.handle_all(attempts).await;
    let statuses: Vec<u16> = replies
        .iter()
        .map(|reply| reply.as_ref().expect("a reply").status)
        .collect();
    let checked = statuses.iter().filter(|&&status| status == 401).count();
    assert!(
        checked <= MAX_FAILURES as usize,
        "at most five passwords are checked: {statuses:?}"
    );
    assert!(statuses
        .iter()
        .all(|&status| status == 401 || status == 429));
    let mut thief = Browser::default();
    assert_eq!(thief.sign_in(&env, "alice", PASSWORD).await.status, 429);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn the_move_is_answered_once_even_when_two_browsers_were_offered_it() {
    let env = boot().await;
    let mut first = Browser::default();
    first.add_to_tape(&env, "1").await;
    let mut second = Browser::default();
    second.add_to_tape(&env, "2").await;
    assert_eq!(json(&first.sign_up(&env, "alice").await)["adopt"], true);
    // Both browsers are offered the move before either answers.
    assert_eq!(
        json(&second.sign_in(&env, "alice", PASSWORD).await)["adopt"],
        true
    );
    let kept = first
        .post(
            &env,
            "/api/session/adopt",
            serde_json::json!({ "keep": true }),
        )
        .await;
    assert_eq!(json(&kept)["done"], false, "not before the settle time");
    let refused = second
        .post(
            &env,
            "/api/session/adopt",
            serde_json::json!({ "keep": true }),
        )
        .await;
    assert_eq!(refused.status, 409);
    assert_eq!(json(&refused)["adopt"], false, "the offer is gone");
    crate::support::advance(&env, SETTLE_MS).await;
    let kept = first
        .post(
            &env,
            "/api/session/adopt",
            serde_json::json!({ "keep": true }),
        )
        .await;
    assert_eq!(json(&kept)["done"], true);
    assert_eq!(
        first.tape(&env).await,
        ["1"],
        "only the first browser's data moved"
    );
    assert_eq!(second.tape(&env).await, ["1"]);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_move_cut_short_carries_on_with_its_answer_at_the_next_sign_in() {
    let env = boot().await;
    let mut browser = Browser::default();
    browser.add_to_tape(&env, "1").await;
    let anonymous = macalicious_desktop::session::session_id(browser.token.as_deref().unwrap());
    // More keys than one request moves.
    let total = macalicious_desktop::accounts::STEP_KEYS + 50;
    let mut store = env.store("data");
    for n in 0..total {
        let key = format!("apps/notes/users/{anonymous}/test/{n:04}");
        store.put(key.as_bytes(), b"x").await.unwrap();
    }
    assert_eq!(json(&browser.sign_up(&env, "alice").await)["adopt"], true);
    crate::support::advance(&env, SETTLE_MS).await;
    let first = browser
        .post(
            &env,
            "/api/session/adopt",
            serde_json::json!({ "keep": true }),
        )
        .await;
    assert_eq!(json(&first)["done"], false, "one step moves part of it");

    // The browser signs out before the move finishes.
    browser
        .post(&env, "/api/session/sign-out", serde_json::json!({}))
        .await;
    // At the account's next sign-in, from another browser, the move is
    // offered again as one already answered, and carries on with Keep even
    // when the request says otherwise.
    let mut laptop = Browser::default();
    let signed_in = json(&laptop.sign_in(&env, "alice", PASSWORD).await);
    assert_eq!(signed_in["adopt"], true);
    assert_eq!(signed_in["adopt_resume"], true);
    crate::support::advance(&env, SETTLE_MS).await;
    let mut done = false;
    for _ in 0..10 {
        let step = json(
            &laptop
                .post(
                    &env,
                    "/api/session/adopt",
                    serde_json::json!({ "keep": false }),
                )
                .await,
        );
        if step["done"] == true {
            done = true;
            break;
        }
    }
    assert!(done);
    let (left, _) = store
        .scan_prefix(
            format!("apps/notes/users/{anonymous}/").as_bytes(),
            None,
            10,
        )
        .await
        .unwrap();
    assert!(
        left.is_empty(),
        "nothing is stranded in the anonymous session"
    );
    assert_eq!(laptop.tape(&env).await, ["1"]);
    let mut moved = 0;
    let mut after: Option<Vec<u8>> = None;
    loop {
        let (rows, more) = store
            .scan_prefix(b"apps/notes/users/u-", after.as_deref(), 1024)
            .await
            .unwrap();
        moved += rows.len();
        after = rows.last().map(|(key, _, _)| key.clone());
        if !more || after.is_none() {
            break;
        }
    }
    assert_eq!(moved, total);
    // Answered and finished: no browser is asked again.
    let mut third = Browser::default();
    third.add_to_tape(&env, "9").await;
    assert_eq!(
        json(&third.sign_in(&env, "alice", PASSWORD).await)["adopt"],
        false
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_session_is_rotated_exactly_once() {
    let env = boot().await;
    let mut alice = Browser::default();
    assert_eq!(alice.sign_up(&env, "alice").await.status, 201);
    let mut browser = Browser::default();
    browser.session(&env).await;
    let token = browser.token.clone().unwrap();
    // Four sign-ins sent at once from one browser (a double click, two tabs).
    let attempts = (0..4).map(|_| {
        let body = serde_json::json!({ "name": "alice", "password": PASSWORD });
        let mut req = ingress::post("/api/session/sign-in", body.to_string());
        req.headers
            .push(("content-type".into(), "application/json".into()));
        req.headers
            .push(("cookie".into(), format!("mac_session={token}")));
        req
    });
    let replies: Vec<IngressReply> = env
        .handle_all(attempts)
        .await
        .into_iter()
        .map(|reply| reply.expect("a reply"))
        .collect();
    let signed_in: Vec<&IngressReply> = replies.iter().filter(|r| r.status == 200).collect();
    assert_eq!(signed_in.len(), 1, "exactly one rotation wins");
    assert!(replies.iter().all(|r| r.status == 200 || r.status == 409));
    assert!(replies
        .iter()
        .filter(|r| r.status == 409)
        .all(|r| header(r, "set-cookie").is_none()));
    let cookie = header(signed_in[0], "set-cookie").unwrap();
    let successor = cookie
        .split(';')
        .next()
        .unwrap()
        .strip_prefix("mac_session=")
        .unwrap()
        .to_string();
    let mut winner = Browser {
        token: Some(successor.clone()),
    };
    assert_eq!(winner.session(&env).await["account"]["name"], "alice");

    // The consumed token is refused, with no cookie, so its reply cannot
    // replace the successor's; a late sign-out sent with it ends nothing.
    let mut stale = Browser {
        token: Some(token.clone()),
    };
    let late = stale
        .post(&env, "/api/session/sign-out", serde_json::json!({}))
        .await;
    assert_eq!(late.status, 409);
    assert!(header(&late, "set-cookie").is_none());
    assert_eq!(winner.session(&env).await["account"]["name"], "alice");
    assert_eq!(winner.token.as_deref(), Some(successor.as_str()));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn an_update_never_brings_back_an_ended_session() {
    use macalicious_desktop::session;
    let env = boot().await;
    let mut store = env.store("data");
    let (current, _) = session::resolve(&mut store, &ingress::get("/api/session"), env.now_ms())
        .await
        .unwrap()
        .expect("a new session");
    let locked = session::update(&mut store, &current, |s| s.locked = true)
        .await
        .unwrap()
        .expect("the session exists");
    assert!(locked.locked);
    let key = format!("sessions/{}", current.id);
    // The browser signs out (its record is deleted) while a lock or an
    // unlock is still on its way: that update finds nothing and writes
    // nothing.
    store.delete(key.as_bytes()).await.unwrap();
    assert_eq!(
        session::update(&mut store, &current, |s| s.locked = false)
            .await
            .unwrap(),
        None
    );
    assert!(store.get(key.as_bytes()).await.unwrap().is_none());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_locked_screen_opens_no_app_until_the_password_unlocks_it() {
    let env = boot().await;
    let mut alice = Browser::default();
    assert_eq!(alice.sign_up(&env, "alice").await.status, 201);
    alice.add_to_tape(&env, "7").await;
    let locked = alice
        .post(&env, "/api/session/lock", serde_json::json!({}))
        .await;
    assert_eq!(locked.status, 200);
    assert_eq!(json(&locked)["locked"], true);
    assert_eq!(alice.get(&env, "/api/calculator/tape").await.status, 423);
    assert_eq!(
        alice.session(&env).await["locked"],
        true,
        "a reload shows the lock screen"
    );

    let wrong = alice
        .post(
            &env,
            "/api/session/unlock",
            serde_json::json!({ "password": "wrong wrong" }),
        )
        .await;
    assert_eq!(wrong.status, 401);
    assert_eq!(alice.get(&env, "/api/calculator/tape").await.status, 423);
    let unlocked = alice
        .post(
            &env,
            "/api/session/unlock",
            serde_json::json!({ "password": PASSWORD }),
        )
        .await;
    assert_eq!(unlocked.status, 200);
    assert!(
        header(&unlocked, "set-cookie").is_none(),
        "the same session goes on"
    );
    assert_eq!(alice.tape(&env).await, ["7"]);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn changing_the_password_needs_the_old_one_and_ends_other_browsers() {
    let env = boot().await;
    let mut here = Browser::default();
    assert_eq!(here.sign_up(&env, "alice").await.status, 201);
    here.add_to_tape(&env, "7").await;
    let mut there = Browser::default();
    assert_eq!(
        there
            .post(
                &env,
                "/api/session/sign-in",
                serde_json::json!({ "name": "alice", "password": PASSWORD }),
            )
            .await
            .status,
        200
    );
    assert_eq!(there.tape(&env).await, ["7"]);
    let change = |current: &str, new: &str| serde_json::json!({ "current": current, "new": new });

    let wrong = here
        .post(
            &env,
            "/api/session/password",
            change("not it at all", "a new long phrase"),
        )
        .await;
    assert_eq!(wrong.status, 401);
    let short = here
        .post(&env, "/api/session/password", change(PASSWORD, "short"))
        .await;
    assert_eq!(short.status, 400);
    assert_eq!(
        there.tape(&env).await,
        ["7"],
        "a refused change ends nothing"
    );

    let changed = here
        .post(
            &env,
            "/api/session/password",
            change(PASSWORD, "a new long phrase"),
        )
        .await;
    assert_eq!(changed.status, 200);
    assert_eq!(here.tape(&env).await, ["7"], "this browser goes on");
    assert!(
        there.session(&env).await["account"].is_null(),
        "the other browser is signed out"
    );

    let mut later = Browser::default();
    let old = later
        .post(
            &env,
            "/api/session/sign-in",
            serde_json::json!({ "name": "alice", "password": PASSWORD }),
        )
        .await;
    assert_eq!(old.status, 401);
    let new = later
        .post(
            &env,
            "/api/session/sign-in",
            serde_json::json!({ "name": "alice", "password": "a new long phrase" }),
        )
        .await;
    assert_eq!(new.status, 200);
    assert_eq!(later.tape(&env).await, ["7"]);

    // Two changes at once, from the same password: one wins, and the other browser does not stay.
    let mut one = Browser::default();
    let mut two = Browser::default();
    for browser in [&mut one, &mut two] {
        let signed_in = browser
            .post(
                &env,
                "/api/session/sign-in",
                serde_json::json!({ "name": "alice", "password": "a new long phrase" }),
            )
            .await;
        assert_eq!(signed_in.status, 200);
    }
    let (first, second) = support::join(
        one.post(
            &env,
            "/api/session/password",
            change("a new long phrase", "phrase number one"),
        ),
        two.post(
            &env,
            "/api/session/password",
            change("a new long phrase", "phrase number two"),
        ),
    )
    .await;
    let wins = [first.status, second.status]
        .iter()
        .filter(|s| **s == 200)
        .count();
    assert_eq!(wins, 1, "{} and {}", first.status, second.status);
    let signed_in = [
        !one.session(&env).await["account"].is_null(),
        !two.session(&env).await["account"].is_null(),
    ];
    assert_eq!(signed_in, [first.status == 200, second.status == 200]);

    let mut guest = Browser::default();
    assert_eq!(
        guest
            .post(&env, "/api/session/guest", serde_json::json!({}))
            .await
            .status,
        201
    );
    let refused = guest
        .post(
            &env,
            "/api/session/password",
            change("x", "a new long phrase"),
        )
        .await;
    assert_eq!(refused.status, 409);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_guest_gets_its_own_desktop_and_loses_it_on_logging_out() {
    let env = boot().await;
    let mut guest = Browser::default();
    let reply = guest
        .post(&env, "/api/session/guest", serde_json::json!({}))
        .await;
    assert_eq!(reply.status, 201);
    let cookie = header(&reply, "set-cookie").unwrap().to_string();
    assert!(has_attribute(&cookie, "Max-Age=86400"), "{cookie}");
    assert_eq!(json(&reply)["account"]["guest"], true);
    assert_eq!(guest.tape(&env).await, Vec::<String>::new());
    guest.add_to_tape(&env, "3").await;
    let stored = keys(&env, "apps/calculator/users/g-").await;
    assert!(!stored.is_empty(), "the guest's data is keyed to the guest");
    // Every key a guest writes expires with the guest, so the store deletes
    // whatever a log-out leaves, late writes included.
    crate::support::advance(&env, 24 * 60 * 60 * 1000 + 1).await;
    assert!(
        keys(&env, "apps/calculator/users/g-").await.is_empty(),
        "a guest's data is gone when its time ends, without a log-out"
    );
    guest = Browser::default();
    assert_eq!(
        guest
            .post(&env, "/api/session/guest", serde_json::json!({}))
            .await
            .status,
        201
    );
    guest.add_to_tape(&env, "3").await;
    assert_eq!(
        guest
            .post(&env, "/api/session/lock", serde_json::json!({}))
            .await
            .status,
        409,
        "a guest has no password to unlock with"
    );

    let mut other = Browser::default();
    assert_eq!(
        other
            .post(&env, "/api/session/guest", serde_json::json!({}))
            .await
            .status,
        201
    );
    assert_eq!(
        other.tape(&env).await,
        Vec::<String>::new(),
        "each guest is separate"
    );

    assert_eq!(
        guest
            .post(&env, "/api/session/sign-out", serde_json::json!({}))
            .await
            .status,
        200
    );
    assert!(
        keys(&env, "apps/calculator/users/g-").await.is_empty(),
        "a guest's data is deleted when it logs out"
    );
    assert_eq!(guest.tape(&env).await, Vec::<String>::new());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_browsers_earlier_data_moves_into_the_account_once() {
    let env = boot().await;
    let mut browser = Browser::default();
    browser.add_to_tape(&env, "1").await;
    let anonymous = macalicious_desktop::session::session_id(browser.token.as_deref().unwrap());

    let reply = browser.sign_up(&env, "alice").await;
    assert_eq!(json(&reply)["adopt"], true, "the move is offered");
    // The account starts empty until the person answers.
    assert_eq!(browser.tape(&env).await, Vec::<String>::new());
    // Another browser signed in to the account cannot take that data.
    let mut laptop = Browser::default();
    assert_eq!(laptop.sign_in(&env, "alice", PASSWORD).await.status, 200);
    assert_eq!(
        laptop
            .post(
                &env,
                "/api/session/adopt",
                serde_json::json!({ "keep": true })
            )
            .await
            .status,
        409
    );

    let moved = browser
        .post(
            &env,
            "/api/session/adopt",
            serde_json::json!({ "keep": true }),
        )
        .await;
    assert_eq!(moved.status, 200);
    let moved = json(&moved);
    // A request the browser sent before signing in may still be writing:
    // nothing moves until none can be, and the reply says how long to wait.
    assert_eq!(moved["done"], false, "{moved}");
    let wait = moved["wait_ms"].as_u64().unwrap();
    assert!(wait > 0 && wait <= SETTLE_MS, "{moved}");
    assert_eq!(moved["moved"], 0, "nothing moves before the settle time");
    assert_eq!(browser.tape(&env).await, Vec::<String>::new());
    // Such a late write, and a late update of a key already there, land in
    // the anonymous space meanwhile.
    let mut store = env.store("data");
    store
        .put(
            format!("apps/notes/users/{anonymous}/late-write").as_bytes(),
            b"late",
        )
        .await
        .unwrap();
    let tape = keys(&env, &format!("apps/calculator/users/{anonymous}/")).await;
    assert!(!tape.is_empty());
    let mut updated = tape[0].1.clone();
    updated.extend_from_slice(b" ");
    store.put(tape[0].0.as_bytes(), &updated).await.unwrap();
    crate::support::advance(&env, wait).await;
    let moved = browser
        .post(
            &env,
            "/api/session/adopt",
            serde_json::json!({ "keep": true }),
        )
        .await;
    assert_eq!(moved.status, 200);
    let moved = json(&moved);
    assert_eq!(moved["done"], true);
    assert_eq!(moved["adopt"], false);
    assert!(
        moved["moved"].as_u64().unwrap() >= 2,
        "the late writes moved"
    );
    assert!(
        keys(&env, "apps/notes/users/u-")
            .await
            .iter()
            .any(|(key, _)| key.ends_with("/late-write")),
        "a write that arrived after the offer is in the account"
    );
    let suffix = tape[0].0[format!("apps/calculator/users/{anonymous}/").len()..].to_string();
    assert!(
        keys(&env, "apps/calculator/users/u-")
            .await
            .iter()
            .any(|(key, value)| key.ends_with(&format!("/{suffix}")) && *value == updated),
        "the late update is what the account keeps"
    );
    assert!(
        keys(&env, &format!("apps/notes/users/{anonymous}/"))
            .await
            .is_empty(),
        "nothing is left behind"
    );
    assert_eq!(browser.tape(&env).await, ["1"]);
    assert_eq!(laptop.tape(&env).await, ["1"]);
    assert!(
        keys(&env, &format!("apps/calculator/users/{anonymous}/"))
            .await
            .is_empty(),
        "the moved keys leave the anonymous session"
    );

    // Asked once per account: another browser with data of its own is not
    // offered the move.
    let mut third = Browser::default();
    third.add_to_tape(&env, "9").await;
    assert_eq!(
        json(&third.sign_in(&env, "alice", PASSWORD).await)["adopt"],
        false
    );
    assert_eq!(third.tape(&env).await, ["1"]);

    // A browser with nothing stored is not asked either.
    let mut fresh = Browser::default();
    assert_eq!(json(&fresh.sign_up(&env, "bob").await)["adopt"], false);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_first_write_still_under_way_at_sign_in_is_offered_once_it_lands() {
    let env = boot().await;
    // A browser that has a session but has stored nothing yet: its first
    // write is still on its way when it signs up.
    let mut browser = Browser::default();
    browser.session(&env).await;
    let anonymous = macalicious_desktop::session::session_id(browser.token.as_deref().unwrap());
    let signed_up = json(&browser.sign_up(&env, "erin").await);
    assert_eq!(signed_up["adopt"], false, "nothing to offer yet");
    let check = signed_up["adopt_check_in_ms"].as_u64().unwrap();
    assert!(check > 0 && check <= SETTLE_MS, "{signed_up}");
    // Nothing can be answered before the look.
    assert_eq!(
        browser
            .post(
                &env,
                "/api/session/adopt",
                serde_json::json!({ "keep": true })
            )
            .await
            .status,
        409
    );
    // The write lands, under the ended session.
    env.store("data")
        .put(
            format!("apps/notes/users/{anonymous}/late-first").as_bytes(),
            b"first",
        )
        .await
        .unwrap();
    assert_eq!(browser.session(&env).await["adopt"], false, "not before");
    crate::support::advance(&env, check).await;
    let now = browser.session(&env).await;
    assert_eq!(now["adopt"], true, "offered once it has landed: {now}");
    assert!(now.get("adopt_check_in_ms").is_none(), "{now}");
    let kept = json(
        &browser
            .post(
                &env,
                "/api/session/adopt",
                serde_json::json!({ "keep": true }),
            )
            .await,
    );
    assert_eq!(kept["done"], true, "{kept}");
    assert!(keys(&env, "apps/notes/users/u-")
        .await
        .iter()
        .any(|(key, value)| key.ends_with("/late-first") && value == b"first"));

    // A browser whose look finds nothing is not asked.
    let mut empty = Browser::default();
    empty.session(&env).await;
    let signed_up = json(&empty.sign_up(&env, "fay").await);
    let check = signed_up["adopt_check_in_ms"].as_u64().unwrap();
    crate::support::advance(&env, check).await;
    let now = empty.session(&env).await;
    assert_eq!(now["adopt"], false, "{now}");
    assert!(now.get("adopt_check_in_ms").is_none(), "{now}");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_page_showing_an_older_session_changes_nothing_of_the_next_persons() {
    let env = boot().await;
    let mut browser = Browser::default();
    assert_eq!(browser.sign_up(&env, "alice").await.status, 201);
    let mut other = Browser::default();
    assert_eq!(other.sign_up(&env, "bob").await.status, 201);
    // One tab shows Alice's desktop; another tab of the same browser then
    // switches to Bob.
    let alices = browser.session(&env).await["session"]
        .as_str()
        .unwrap()
        .to_string();
    assert_eq!(
        browser.sign_in(&env, "bob", PASSWORD).await.status,
        200,
        "the other tab switches"
    );
    let bobs = browser.session(&env).await["session"]
        .as_str()
        .unwrap()
        .to_string();
    assert_ne!(alices, bobs);
    // Alice's stale tab locks, signs out and answers an offer: each is
    // refused, and Bob's session is as it was.
    for path in ["/lock", "/sign-out", "/adopt", "/unlock"] {
        let reply = browser
            .post(
                &env,
                &format!("/api/session{path}?desktop_session={alices}"),
                serde_json::json!({ "keep": true, "password": PASSWORD }),
            )
            .await;
        assert_eq!(reply.status, 409, "{path}");
        assert_eq!(json(&reply)["session_changed"], true, "{path}");
        assert!(header(&reply, "set-cookie").is_none(), "{path}");
    }
    let now = browser.session(&env).await;
    assert_eq!(now["session"], bobs.as_str());
    assert_eq!(now["account"]["name"], "bob");
    assert_eq!(now["locked"], false);
    // The tab showing Bob's session locks it.
    let locked = browser
        .post(
            &env,
            &format!("/api/session/lock?desktop_session={bobs}"),
            serde_json::json!({}),
        )
        .await;
    assert_eq!(locked.status, 200);
    assert_eq!(json(&locked)["locked"], true);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn an_upload_named_for_the_person_who_left_never_reaches_the_next_persons_drive() {
    let env = boot().await;
    let mut other = Browser::default();
    assert_eq!(other.sign_up(&env, "bob").await.status, 201);
    let mut browser = Browser::default();
    assert_eq!(browser.sign_up(&env, "alice").await.status, 201);
    let alices = browser.session(&env).await["session"]
        .as_str()
        .unwrap()
        .to_string();
    let start = |name: &str| serde_json::json!({ "parent": "documents", "name": name, "size": 3, "type": "text/plain" });
    // Begun for Alice before another tab of the browser switches to Bob.
    let begun = browser
        .post(
            &env,
            &format!("/api/files/uploads?desktop_session={alices}"),
            start("Begun.txt"),
        )
        .await;
    assert_eq!(begun.status, 201);
    let upload = json(&begun)["upload"].as_str().unwrap().to_string();
    assert_eq!(browser.sign_in(&env, "bob", PASSWORD).await.status, 200);

    // Every step of a save for Alice is refused now, and says who is signed in.
    let refused = browser
        .post(
            &env,
            &format!("/api/files/uploads?desktop_session={alices}"),
            start("Stray.txt"),
        )
        .await;
    assert_eq!(refused.status, 409);
    assert!(json(&refused)["session"].is_string());
    let mut piece = ingress::request(
        "PUT",
        &format!("/api/files/uploads/{upload}/0?desktop_session={alices}"),
        "",
        b"abc",
    );
    piece
        .headers
        .push(("content-type".into(), "application/octet-stream".into()));
    assert_eq!(browser.send(&env, piece).await.status, 409);
    let done = browser
        .post(
            &env,
            &format!("/api/files/uploads/{upload}/complete?desktop_session={alices}"),
            serde_json::json!({}),
        )
        .await;
    assert_eq!(done.status, 409);
    let folder = browser
        .post(
            &env,
            &format!("/api/files/ops?desktop_session={alices}"),
            serde_json::json!({ "ops": [{ "op": "mkdir", "parent": "music", "name": "Stray folder", "existing": "reuse" }] }),
        )
        .await;
    assert_eq!(folder.status, 409);

    let names = |drive: serde_json::Value| -> Vec<String> {
        drive["entries"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|entry| entry["name"].as_str().map(String::from))
            .collect()
    };
    let bobs_drive = names(json(&browser.get(&env, "/api/files/").await));
    assert!(
        !bobs_drive
            .iter()
            .any(|name| name.ends_with(".txt") || name == "Stray folder"),
        "{bobs_drive:?}"
    );

    // A save for the person signed in goes through as ever.
    let bobs = browser.session(&env).await["session"]
        .as_str()
        .unwrap()
        .to_string();
    let own = browser
        .post(
            &env,
            &format!("/api/files/uploads?desktop_session={bobs}"),
            start("Own.txt"),
        )
        .await;
    assert_eq!(own.status, 201);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn declining_the_move_is_final() {
    let env = boot().await;
    let mut browser = Browser::default();
    browser.add_to_tape(&env, "5").await;
    assert_eq!(json(&browser.sign_up(&env, "carol").await)["adopt"], true);
    let declined = browser
        .post(
            &env,
            "/api/session/adopt",
            serde_json::json!({ "keep": false }),
        )
        .await;
    assert_eq!(declined.status, 200);
    assert_eq!(json(&declined)["adopt"], false);
    assert_eq!(browser.tape(&env).await, Vec::<String>::new());
    assert_eq!(
        browser
            .post(
                &env,
                "/api/session/adopt",
                serde_json::json!({ "keep": true })
            )
            .await
            .status,
        409
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn sign_in_needs_the_pepper_and_json() {
    let env = boot_with(&[]).await;
    let mut browser = Browser::default();
    assert_eq!(browser.session(&env).await["sign_in_ready"], false);
    let reply = browser.sign_up(&env, "alice").await;
    assert_eq!(reply.status, 503);
    assert!(
        json(&reply)["error"]
            .as_str()
            .unwrap()
            .contains("mac_password_pepper"),
        "the missing secret is named"
    );
    assert!(keys(&env, "accounts/").await.is_empty());

    let env = boot_in(
        crate::support::Slot::beside(),
        &[("mac_password_pepper", PEPPER)],
    )
    .await;
    let mut browser = Browser::default();
    let form = ingress::post("/api/session/sign-in", "name=alice&password=x");
    assert_eq!(browser.send(&env, form).await.status, 415);
    for bad in [
        serde_json::json!({ "name": "2bad", "full_name": "x", "password": PASSWORD }),
        serde_json::json!({ "name": "guest", "full_name": "x", "password": PASSWORD }),
        serde_json::json!({ "name": "dan", "full_name": "", "password": PASSWORD }),
        serde_json::json!({ "name": "dan", "full_name": "Dan", "password": "short" }),
    ] {
        assert_eq!(
            browser
                .post(&env, "/api/session/sign-up", bad.clone())
                .await
                .status,
            400,
            "{bad}"
        );
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn the_signup_secret_closes_sign_up_or_asks_for_a_code() {
    let env = boot_with(&[("mac_password_pepper", PEPPER), ("mac_signup", "closed")]).await;
    let mut browser = Browser::default();
    assert_eq!(browser.session(&env).await["signup"], "closed");
    assert_eq!(browser.sign_up(&env, "alice").await.status, 403);
    // Guest User stays open.
    assert_eq!(
        browser
            .post(&env, "/api/session/guest", serde_json::json!({}))
            .await
            .status,
        201
    );

    let env = boot_in(
        crate::support::Slot::beside(),
        &[
            ("mac_password_pepper", PEPPER),
            ("mac_signup", "invite:tidepool42"),
        ],
    )
    .await;
    let mut browser = Browser::default();
    assert_eq!(browser.session(&env).await["signup"], "invite");
    assert_eq!(browser.sign_up(&env, "alice").await.status, 403);
    let body = serde_json::json!({ "name": "alice", "full_name": "Alice", "password": PASSWORD, "invite": "tidepool42" });
    assert_eq!(
        browser
            .post(&env, "/api/session/sign-up", body)
            .await
            .status,
        201
    );
}

#[tokio::test]
async fn guest_cleanup_bounds_empty_scans_and_resumes_after_reopening_the_store() {
    use macalicious_desktop::{accounts::purge_guests, store::Store};
    use std::sync::atomic::{AtomicU64, Ordering};

    let slot = crate::support::Slot::acquire();
    let env = TestHarness::new()
        .with_store("data")
        .manual_clock(1_760_000_000_000)
        .build()
        .await;
    let env = crate::support::Env::new(env, slot);
    let now = 1_760_000_000_000;
    let budget = 8;
    let mut store = env.store("data");
    for i in 0..8 {
        store
            .put(
                format!("accounts/guests/0000000000000001/g-expired-{i}").as_bytes(),
                b"{}",
            )
            .await
            .unwrap();
        store
            .put(format!("accounts/users/g-expired-{i}").as_bytes(), b"{}")
            .await
            .unwrap();
    }
    // Data in the final module must be reached even when earlier modules are empty.
    let private = b"apps/weather/users/g-expired-0/private";
    store.put(private, b"private").await.unwrap();
    let active = b"accounts/guests/9999999999999999/g-active";
    store.put(active, b"{}").await.unwrap();
    let active_data = b"apps/weather/users/g-active/private";
    store.put(active_data, b"active").await.unwrap();
    let regular = b"apps/weather/users/a-member/private";
    store.put(regular, b"member").await.unwrap();
    let calls = AtomicU64::new(0);
    purge_guests(Store::counted(&mut store, &calls), now, budget)
        .await
        .unwrap();
    assert!(
        calls.load(Ordering::Relaxed) <= budget as u64,
        "cleanup made {} storage calls with a budget of {budget}",
        calls.load(Ordering::Relaxed)
    );
    assert!(
        store.get(private).await.unwrap().is_some(),
        "one bounded step must leave work for later"
    );
    // A fresh handle every step proves the cursor is durable, not process-local.
    for _ in 0..150 {
        let mut store = env.store("data");
        calls.store(0, Ordering::Relaxed);
        purge_guests(Store::counted(&mut store, &calls), now, budget)
            .await
            .unwrap();
        assert!(calls.load(Ordering::Relaxed) <= budget as u64);
        if keys(&env, "accounts/guests/0000000000000001/")
            .await
            .is_empty()
        {
            break;
        }
    }
    assert!(
        keys(&env, "accounts/guests/0000000000000001/")
            .await
            .is_empty(),
        "expired backlog must drain"
    );
    assert!(keys(&env, "accounts/users/g-expired-").await.is_empty());
    assert!(store.get(private).await.unwrap().is_none());
    assert!(store.get(active).await.unwrap().is_some());
    assert_eq!(
        store.get(active_data).await.unwrap().as_deref(),
        Some(b"active".as_slice())
    );
    assert_eq!(
        store.get(regular).await.unwrap().as_deref(),
        Some(b"member".as_slice())
    );
}

#[tokio::test]
async fn guest_entry_does_not_sweep_an_expired_backlog() {
    let slot = crate::support::Slot::acquire();
    let env = TestHarness::new()
        .with_store("data")
        .manual_clock(1_760_000_000_000)
        .build()
        .await;
    let env = crate::support::Env::new(env, slot);
    let mut store = env.store("data");
    let index = b"accounts/guests/0000000000000001/g-old";
    let private = b"apps/weather/users/g-old/private";
    store.put(index, b"{}").await.unwrap();
    store.put(private, b"old data").await.unwrap();
    let ctx = ferrite_app::AppContext::with_clock(env.payload().clone(), env.clock());
    let mut req = ingress::post("/api/session/guest", "{}");
    req.headers
        .push(("content-type".into(), "application/json".into()));
    let reply = macalicious_desktop::handle(&ctx, &mut store, &req).await;
    assert_eq!(
        reply.status,
        201,
        "{}",
        String::from_utf8_lossy(&reply.body)
    );
    assert_eq!(json(&reply)["account"]["guest"], true);
    assert!(header(&reply, "set-cookie").is_some());
    assert!(
        store.get(index).await.unwrap().is_some(),
        "entry must leave old cleanup to the background worker"
    );
    assert_eq!(
        store.get(private).await.unwrap().as_deref(),
        Some(b"old data".as_slice())
    );
}

#[tokio::test]
async fn guest_cleanup_keeps_the_grace_period_then_removes_late_writes_in_bounded_steps() {
    use macalicious_desktop::{
        accounts::{purge_guests, wipe, GUEST_CLEANUP_OPS, GUEST_GRACE_MS},
        store::Store,
    };
    use std::sync::atomic::{AtomicU64, Ordering};
    let now = 1_760_000_000_000;
    let slot = crate::support::Slot::acquire();
    let env = TestHarness::new()
        .with_store("data")
        .manual_clock(now)
        .build()
        .await;
    let env = crate::support::Env::new(env, slot);
    let mut store = env.store("data");
    let index = format!("accounts/guests/{:016}/g-ended", now + GUEST_GRACE_MS);
    store.put(index.as_bytes(), b"{}").await.unwrap();
    store.put(b"accounts/users/g-ended", b"{}").await.unwrap();
    // The immediate sign-out pass also counts empty modules, not only keys.
    let calls = AtomicU64::new(0);
    let (done, _) = wipe(
        Store::counted(&mut store, &calls),
        "g-ended",
        GUEST_CLEANUP_OPS,
    )
    .await
    .unwrap();
    assert!(!done);
    assert!(calls.load(Ordering::Relaxed) <= GUEST_CLEANUP_OPS as u64);
    // A request admitted before sign-out writes into an already-scanned module.
    let late = b"apps/calculator/users/g-ended/late";
    store.put(late, b"late write").await.unwrap();
    for i in 0..40 {
        store
            .put(
                format!("apps/weather/users/g-ended/{i}").as_bytes(),
                b"private",
            )
            .await
            .unwrap();
    }
    purge_guests(&mut store, now + GUEST_GRACE_MS - 1, GUEST_CLEANUP_OPS)
        .await
        .unwrap();
    assert!(
        store.get(late).await.unwrap().is_some(),
        "keep the index until in-flight writes have settled"
    );
    for _ in 0..30 {
        calls.store(0, Ordering::Relaxed);
        purge_guests(
            Store::counted(&mut store, &calls),
            now + GUEST_GRACE_MS,
            GUEST_CLEANUP_OPS,
        )
        .await
        .unwrap();
        assert!(calls.load(Ordering::Relaxed) <= GUEST_CLEANUP_OPS as u64);
        if store.get(index.as_bytes()).await.unwrap().is_none() {
            break;
        }
    }
    assert!(
        store.get(late).await.unwrap().is_none(),
        "the post-grace pass must revisit earlier modules"
    );
    assert!(keys(&env, "apps/weather/users/g-ended/").await.is_empty());
    assert!(store
        .get(b"accounts/users/g-ended")
        .await
        .unwrap()
        .is_none());
    assert!(
        store.get(index.as_bytes()).await.unwrap().is_none(),
        "delete the index only after private data is gone"
    );
}

#[tokio::test]
async fn guest_cleanup_drains_without_another_sign_in() {
    let env = boot().await;
    let mut store = env.store("data");
    let index = b"accounts/guests/0000000000000001/g-background";
    let private = b"apps/weather/users/g-background/private";
    store.put(index, b"{}").await.unwrap();
    store.put(private, b"private").await.unwrap();
    tokio::time::timeout(std::time::Duration::from_secs(20), async {
        while store.get(index).await.unwrap().is_some() {
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        }
    })
    .await
    .expect("background cleanup must drain without foreground requests");
    assert!(store.get(private).await.unwrap().is_none());
}

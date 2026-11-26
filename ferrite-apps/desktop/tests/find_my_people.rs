//! Find My's People on the in-process Forge planes (`ferrite-app-test`): one
//! account shares its position with another by its own choice, the other sees
//! only the newest position while the grant stands, and a rule on someone who
//! shares fires on a crossing and reaches Notification Center.

use ferrite_app::{serde_json, IngressReply};
use ferrite_app_test::{ingress, TestEnv, TestHarness};
use serde_json::{json, Value};

const START_MS: u64 = 1_800_000_000_900;

async fn boot() -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let env = TestHarness::new()
        .with_queue("requests")
        .with_queue("replies")
        .with_store("data")
        .manual_clock(START_MS)
        .build()
        .await;
    let mut payload = env.payload().clone();
    payload.secrets.insert(
        "mac_password_pepper".into(),
        "test-pepper-0123456789abcdef0123456789abcdef".into(),
    );
    let ctx = ferrite_app::AppContext::with_clock(payload, env.clock());
    env.run_app(move |_| async move { macalicious_desktop::run(ctx).await });
    crate::support::Env::new(env, slot)
}

#[derive(Clone)]
struct Browser {
    token: Option<String>,
}

impl Browser {
    async fn send(
        &mut self,
        env: &TestEnv,
        method: &str,
        path: &str,
        body: &Value,
    ) -> IngressReply {
        let bytes = if body.is_null() {
            Vec::new()
        } else {
            body.to_string().into_bytes()
        };
        let mut req = ingress::request(method, path, "", bytes);
        req.headers
            .push(("content-type".into(), "application/json".into()));
        if let Some(token) = &self.token {
            req.headers
                .push(("cookie".into(), format!("mac_session={token}")));
        }
        let reply = env.handle(req).await.expect("a reply");
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

    async fn ok(&mut self, env: &TestEnv, method: &str, path: &str, body: Value) -> Value {
        let reply = self.send(env, method, path, &body).await;
        let text = String::from_utf8_lossy(&reply.body).into_owned();
        assert_eq!(reply.status, 200, "{method} {path}: {text}");
        serde_json::from_str(&text).unwrap_or_else(|e| panic!("{e}: {text}"))
    }

    async fn status(&mut self, env: &TestEnv, method: &str, path: &str, body: Value) -> u16 {
        self.send(env, method, path, &body).await.status
    }

    async fn people(&mut self, env: &TestEnv) -> Vec<Value> {
        let listed = self
            .ok(env, "GET", "/api/find-my/people", Value::Null)
            .await;
        listed["people"].as_array().expect("a list").clone()
    }

    async fn report(&mut self, env: &TestEnv, lat: f64, lon: f64, at: u64) {
        self.ok(
            env,
            "PUT",
            "/api/find-my/me",
            json!({ "lat": lat, "lon": lon, "accuracy_m": 5.0, "label": "Chromium on Mac", "reported_at": at }),
        )
        .await;
    }

    async fn inbox(&mut self, env: &TestEnv) -> Vec<String> {
        let inbox = self
            .ok(env, "GET", "/api/notification-center/inbox", Value::Null)
            .await;
        inbox["items"]
            .as_array()
            .expect("items")
            .iter()
            .map(|item| item["title"].as_str().unwrap_or_default().to_string())
            .collect()
    }
}

async fn sign_up(env: &TestEnv, name: &str, full_name: &str) -> Browser {
    let mut browser = Browser { token: None };
    let reply = browser
        .send(
            env,
            "POST",
            "/api/session/sign-up",
            &json!({ "name": name, "full_name": full_name, "password": "correct horse battery" }),
        )
        .await;
    assert_eq!(
        reply.status,
        201,
        "{}",
        String::from_utf8_lossy(&reply.body)
    );
    browser
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_position_is_shown_only_while_its_owner_shares_it() {
    let env = boot().await;
    let mut ann = sign_up(&env, "ann", "Ann Lee").await;
    let mut bob = sign_up(&env, "bob", "Bob Ray").await;
    let mut cid = sign_up(&env, "cid", "Cid Fox").await;
    ann.report(&env, 48.8566, 2.3522, START_MS).await;
    assert_eq!(bob.people(&env).await, Vec::<Value>::new());

    ann.ok(&env, "PUT", "/api/find-my/people/bob/share", Value::Null)
        .await;
    let seen = bob.people(&env).await;
    assert_eq!(seen.len(), 1);
    assert_eq!(seen[0]["name"], "ann");
    assert_eq!(seen[0]["full_name"], "Ann Lee");
    assert_eq!(seen[0]["following"], true);
    assert_eq!(seen[0]["sharing"], false);
    assert_eq!(seen[0]["position"]["lat"], 48.8566);
    assert!(
        seen[0]["position"].get("label").is_none(),
        "no device name: {seen:?}"
    );
    let mine = ann.people(&env).await;
    assert_eq!(mine[0]["name"], "bob");
    assert_eq!(mine[0]["sharing"], true);
    assert_eq!(mine[0]["position"], Value::Null);
    assert_eq!(
        bob.inbox(&env).await,
        ["Ann Lee started sharing location with you"]
    );
    assert_eq!(cid.people(&env).await, Vec::<Value>::new());

    // Sharing again tells nobody again.
    ann.ok(&env, "PUT", "/api/find-my/people/bob/share", Value::Null)
        .await;
    assert_eq!(bob.inbox(&env).await.len(), 1);

    ann.ok(&env, "DELETE", "/api/find-my/people/bob/share", Value::Null)
        .await;
    assert_eq!(bob.people(&env).await, Vec::<Value>::new());
    assert_eq!(ann.people(&env).await, Vec::<Value>::new());
    // Stopping twice is the same as once.
    ann.ok(&env, "DELETE", "/api/find-my/people/bob/share", Value::Null)
        .await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn asking_to_follow_is_answered_by_the_person_asked() {
    let env = boot().await;
    let mut ann = sign_up(&env, "ann", "Ann Lee").await;
    let mut bob = sign_up(&env, "bob", "Bob Ray").await;
    bob.ok(&env, "PUT", "/api/find-my/people/ann/ask", Value::Null)
        .await;
    let asked = ann.people(&env).await;
    assert_eq!(asked[0]["asks_me"], true);
    assert_eq!(asked[0]["position"], Value::Null);
    assert_eq!(
        ann.inbox(&env).await,
        ["Bob Ray asked to follow your location"]
    );
    assert_eq!(bob.people(&env).await[0]["asked"], true);

    // Saying no leaves both lists empty, and shows no position.
    ann.ok(&env, "DELETE", "/api/find-my/people/bob/ask", Value::Null)
        .await;
    assert_eq!(ann.people(&env).await, Vec::<Value>::new());
    assert_eq!(bob.people(&env).await, Vec::<Value>::new());

    // Saying yes is sharing, which answers the request.
    bob.ok(&env, "PUT", "/api/find-my/people/ann/ask", Value::Null)
        .await;
    ann.ok(&env, "PUT", "/api/find-my/people/bob/share", Value::Null)
        .await;
    let answered = bob.people(&env).await;
    assert_eq!(answered[0]["following"], true);
    assert_eq!(answered[0]["asked"], false);
    assert_eq!(ann.people(&env).await[0]["asks_me"], false);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn refusals_and_removing_someone() {
    let env = boot().await;
    let mut ann = sign_up(&env, "ann", "Ann Lee").await;
    let mut bob = sign_up(&env, "bob", "Bob Ray").await;
    let anonymous_people = Browser { token: None }
        .ok(&env, "GET", "/api/find-my/people", Value::Null)
        .await;
    assert_eq!(anonymous_people["signed_in"], false);
    let mut anonymous = Browser { token: None };
    assert_eq!(
        anonymous
            .status(&env, "PUT", "/api/find-my/people/ann/share", Value::Null)
            .await,
        401
    );
    assert_eq!(
        ann.status(&env, "PUT", "/api/find-my/people/nobody/share", Value::Null)
            .await,
        404
    );
    assert_eq!(
        ann.status(&env, "PUT", "/api/find-my/people/ann/share", Value::Null)
            .await,
        400
    );
    let rule =
        json!({ "kind": "arrive", "lat": 1.0, "lon": 1.0, "label": "here", "repeat": false });
    assert_eq!(
        ann.status(&env, "PUT", "/api/find-my/people/bob/notify", rule)
            .await,
        409,
        "a rule needs someone who shares"
    );

    ann.ok(&env, "PUT", "/api/find-my/people/bob/share", Value::Null)
        .await;
    // The person who is shared with removes the sharer: gone from their list.
    bob.ok(&env, "DELETE", "/api/find-my/people/ann", Value::Null)
        .await;
    assert_eq!(bob.people(&env).await, Vec::<Value>::new());
    // The sharer removes the person: the grant is gone as well.
    ann.ok(&env, "DELETE", "/api/find-my/people/bob", Value::Null)
        .await;
    assert_eq!(ann.people(&env).await, Vec::<Value>::new());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_rule_tells_the_follower_of_a_crossing() {
    let env = boot().await;
    let mut ann = sign_up(&env, "ann", "Ann Lee").await;
    let mut bob = sign_up(&env, "bob", "Bob Ray").await;
    ann.report(&env, 48.8566, 2.3522, START_MS).await;
    ann.ok(&env, "PUT", "/api/find-my/people/bob/share", Value::Null)
        .await;
    let home = (51.5074, -0.1278);
    bob.ok(
        &env,
        "PUT",
        "/api/find-my/people/ann/notify",
        json!({ "kind": "arrive", "lat": home.0, "lon": home.1, "label": "your location", "repeat": true }),
    )
    .await;
    assert_eq!(bob.people(&env).await[0]["rule"]["kind"], "arrive");
    let before = bob.inbox(&env).await.len();

    ann.report(&env, 48.8567, 2.3522, START_MS + 1).await;
    assert_eq!(bob.inbox(&env).await.len(), before, "not there yet");
    ann.report(&env, home.0, home.1, START_MS + 2).await;
    assert_eq!(bob.inbox(&env).await[0], "Ann Lee arrived at your location");
    let told = bob.inbox(&env).await.len();
    ann.report(&env, home.0, home.1, START_MS + 3).await;
    assert_eq!(
        bob.inbox(&env).await.len(),
        told,
        "still there is no new arrival"
    );

    // A rule for once is gone once it has fired.
    bob.ok(
        &env,
        "PUT",
        "/api/find-my/people/ann/notify",
        json!({ "kind": "leave", "lat": home.0, "lon": home.1, "label": "your location", "repeat": false }),
    )
    .await;
    ann.report(&env, 48.8566, 2.3522, START_MS + 4).await;
    assert_eq!(bob.inbox(&env).await[0], "Ann Lee left your location");
    assert_eq!(bob.people(&env).await[0]["rule"], Value::Null);
}

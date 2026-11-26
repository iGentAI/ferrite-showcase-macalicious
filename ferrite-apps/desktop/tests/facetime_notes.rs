//! What FaceTime tells people besides a ringing call: a call someone missed stays in Notification
//! Center, unless they have blocked the caller; and a Live Photo tells the others in the call
//! before the page keeps it.

use ferrite_app::{serde_json, IngressReply};
use ferrite_app_test::{ingress, TestEnv, TestHarness};
use serde_json::{json, Value};

const PEPPER: &str = "test-pepper-0123456789abcdef0123456789abcdef";
const PASSWORD: &str = "correct horse battery";
const PAGE: &str = "page-window-one-01";
const OTHER_PAGE: &str = "page-window-two-02";

async fn boot() -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let env = TestHarness::new()
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

fn json_of(reply: &IngressReply) -> Value {
    serde_json::from_slice(&reply.body)
        .unwrap_or_else(|e| panic!("{e}: {}", String::from_utf8_lossy(&reply.body)))
}

struct Person {
    token: Option<String>,
}

impl Person {
    async fn send(&mut self, env: &TestEnv, method: &str, path: &str, body: Value) -> IngressReply {
        let bytes = body.to_string();
        let mut req = ingress::request(method, path, "", bytes.as_bytes());
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
                self.token = Some(token.to_string());
            }
        }
        reply
    }

    async fn ok(&mut self, env: &TestEnv, method: &str, path: &str, body: Value) -> Value {
        let reply = self.send(env, method, path, body).await;
        assert!(
            reply.status < 300,
            "{method} {path}: {}",
            String::from_utf8_lossy(&reply.body)
        );
        json_of(&reply)
    }

    async fn call(&mut self, env: &TestEnv, to: &str) -> String {
        let body = json!({ "to": to, "kind": "video", "page": PAGE });
        self.ok(env, "POST", "/api/facetime/calls", body).await["state"]["id"]
            .as_str()
            .unwrap()
            .to_string()
    }

    async fn inbox(&mut self, env: &TestEnv) -> Vec<(String, String)> {
        let inbox = self
            .ok(env, "GET", "/api/notification-center/inbox", json!(null))
            .await;
        inbox["items"]
            .as_array()
            .unwrap()
            .iter()
            .map(|item| {
                (
                    item["title"].as_str().unwrap_or_default().to_string(),
                    item["body"].as_str().unwrap_or_default().to_string(),
                )
            })
            .collect()
    }
}

async fn sign_up(env: &TestEnv, name: &str) -> Person {
    let mut person = Person { token: None };
    let body = json!({ "name": name, "full_name": name.to_uppercase(), "password": PASSWORD });
    let reply = person.send(env, "POST", "/api/session/sign-up", body).await;
    assert_eq!(reply.status, 201);
    person
}

#[tokio::test]
async fn a_missed_call_stays_in_notification_center() {
    let env = boot().await;
    let mut ada = sign_up(&env, "ada").await;
    let mut bob = sign_up(&env, "bob").await;
    let id = ada.call(&env, "bob").await;
    assert_eq!(
        bob.inbox(&env).await,
        [("ADA".to_string(), "FaceTime Video".to_string())]
    );
    let path = format!("/api/facetime/calls/{id}/leave");
    ada.ok(&env, "POST", &path, json!({ "seat": 1 })).await;
    assert_eq!(
        bob.inbox(&env).await,
        [("ADA".to_string(), "Missed FaceTime Video".to_string())]
    );
}

#[tokio::test]
async fn a_blocked_callers_missed_call_tells_nobody() {
    let env = boot().await;
    let mut ada = sign_up(&env, "ada").await;
    let mut bob = sign_up(&env, "bob").await;
    bob.ok(
        &env,
        "PUT",
        "/api/messages/blocked/ada",
        json!({ "blocked": true }),
    )
    .await;
    let id = ada.call(&env, "bob").await;
    let path = format!("/api/facetime/calls/{id}/leave");
    ada.ok(&env, "POST", &path, json!({ "seat": 1 })).await;
    assert_eq!(bob.inbox(&env).await, Vec::<(String, String)>::new());
}

#[tokio::test]
async fn a_live_photo_tells_the_others_first() {
    let env = boot().await;
    let mut ada = sign_up(&env, "ada").await;
    let mut bob = sign_up(&env, "bob").await;
    let mut cid = sign_up(&env, "cid").await;
    let id = ada.call(&env, "bob").await;
    let path = format!("/api/facetime/calls/{id}/live-photo");
    // Someone still ringing is not in the call yet, and someone else never was.
    assert_eq!(bob.send(&env, "POST", &path, json!({})).await.status, 409);
    assert_eq!(cid.send(&env, "POST", &path, json!({})).await.status, 404);
    let join = format!("/api/facetime/calls/{id}/join");
    bob.ok(&env, "POST", &join, json!({ "page": OTHER_PAGE }))
        .await;
    assert_eq!(
        ada.ok(&env, "POST", &path, json!({})).await["told"],
        json!(1)
    );
    assert!(bob.inbox(&env).await.contains(&(
        "ADA".to_string(),
        "took a Live Photo of your FaceTime call".to_string()
    )));
}

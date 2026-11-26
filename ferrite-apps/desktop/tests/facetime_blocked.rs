//! A person who has blocked someone (Messages' list, which FaceTime shares) hears nothing of their
//! calls: no ringing call, no line in their recents and no notification. The caller's call rings out
//! as one nobody answers, and after Unblock the next call rings again.

use ferrite_app::{serde_json, IngressReply};
use ferrite_app_test::{ingress, TestEnv, TestHarness};
use serde_json::{json, Value};

const PEPPER: &str = "test-pepper-0123456789abcdef0123456789abcdef";
const PASSWORD: &str = "correct horse battery";
const PAGE: &str = "page-window-one-01";

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
    serde_json::from_slice(&reply.body).unwrap_or_else(|e| {
        panic!("{e}: {}", String::from_utf8_lossy(&reply.body));
    })
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

    async fn calls(&mut self, env: &TestEnv) -> Value {
        let reply = self
            .send(env, "GET", "/api/facetime/calls", json!(null))
            .await;
        assert_eq!(reply.status, 200);
        json_of(&reply)
    }

    async fn call(&mut self, env: &TestEnv, to: &str) -> String {
        let body = json!({ "to": to, "kind": "video", "page": PAGE });
        let reply = self.send(env, "POST", "/api/facetime/calls", body).await;
        assert_eq!(reply.status, 201);
        json_of(&reply)["state"]["id"].as_str().unwrap().to_string()
    }

    async fn hang_up(&mut self, env: &TestEnv, id: &str) {
        let path = format!("/api/facetime/calls/{id}/leave");
        let reply = self.send(env, "POST", &path, json!({ "seat": 1 })).await;
        assert_eq!(reply.status, 200);
    }

    async fn block(&mut self, env: &TestEnv, name: &str, blocked: bool) {
        let path = format!("/api/messages/blocked/{name}");
        let reply = self
            .send(env, "PUT", &path, json!({ "blocked": blocked }))
            .await;
        assert_eq!(reply.status, 200);
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
async fn a_blocked_caller_rings_nobody_and_an_unblocked_one_rings_again() {
    let env = boot().await;
    let mut ada = sign_up(&env, "ada").await;
    let mut bob = sign_up(&env, "bob").await;
    bob.block(&env, "ada", true).await;

    let id = ada.call(&env, "bob").await;
    let mine = ada.calls(&env).await;
    assert_eq!(
        mine["recents"].as_array().unwrap().len(),
        1,
        "the caller has the line"
    );
    let theirs = bob.calls(&env).await;
    assert!(theirs["incoming"].is_null(), "it does not ring: {theirs}");
    assert_eq!(
        theirs["recents"].as_array().unwrap().len(),
        0,
        "no line: {theirs}"
    );

    ada.hang_up(&env, &id).await;
    let theirs = bob.calls(&env).await;
    assert_eq!(
        theirs["recents"].as_array().unwrap().len(),
        0,
        "none afterwards either"
    );

    bob.block(&env, "ada", false).await;
    let id = ada.call(&env, "bob").await;
    let theirs = bob.calls(&env).await;
    assert_eq!(
        theirs["incoming"]["state"]["id"],
        id.as_str(),
        "it rings again: {theirs}"
    );
}

#[tokio::test]
async fn blocking_one_person_leaves_another_able_to_ring() {
    let env = boot().await;
    let mut ada = sign_up(&env, "ada").await;
    let mut bob = sign_up(&env, "bob").await;
    sign_up(&env, "cat").await;
    bob.block(&env, "cat", true).await;
    let id = ada.call(&env, "bob").await;
    assert_eq!(
        bob.calls(&env).await["incoming"]["state"]["id"],
        id.as_str()
    );
}

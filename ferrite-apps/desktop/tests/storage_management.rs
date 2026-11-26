//! Keychain Access and Storage Management on the in-process Forge planes
//! (`ferrite-app-test`): Keychain Access keeps each session's encrypted vault
//! under the revision rule of `document.rs`, refusing malformed bodies;
//! Storage Management reports what the session keeps per module, lists the
//! documents a module can forget, and every route it names for forgetting
//! answers `DELETE`.

use ferrite_app::{serde_json, IngressReply, IngressRequest};
use ferrite_app_test::{ingress, TestEnv, TestHarness};

async fn boot() -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let env = TestHarness::new()
        .with_queue("requests")
        .with_queue("replies")
        .with_queue("live")
        .with_queue("frames")
        .with_store("data")
        .build()
        .await;
    env.run_app(|ctx| async move { macalicious_desktop::run(ctx).await });
    crate::support::Env::new(env, slot)
}

fn json(reply: &IngressReply) -> serde_json::Value {
    serde_json::from_slice(&reply.body)
        .unwrap_or_else(|e| panic!("{e}: {}", String::from_utf8_lossy(&reply.body)))
}

/// A browser: its session cookie, once the first reply has set it.
struct Browser {
    token: Option<String>,
}

impl Browser {
    fn new() -> Self {
        Browser { token: None }
    }

    async fn send(&mut self, env: &TestEnv, mut req: IngressRequest) -> IngressReply {
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
            let pair = cookie.split(';').next().unwrap();
            self.token = Some(pair.trim_start_matches("mac_session=").to_string());
        }
        reply
    }

    /// The `GET` reply's body without its `session`.
    async fn get(&mut self, env: &TestEnv, path: &str) -> serde_json::Value {
        let reply = self.send(env, ingress::get(path)).await;
        assert_eq!(
            reply.status,
            200,
            "GET {path}: {}",
            String::from_utf8_lossy(&reply.body)
        );
        let mut body = json(&reply);
        if let Some(object) = body.as_object_mut() {
            object.remove("session");
        }
        body
    }

    async fn put(&mut self, env: &TestEnv, path: &str, body: serde_json::Value) -> IngressReply {
        let mut req = ingress::request("PUT", path, "", body.to_string().as_bytes());
        req.headers
            .push(("content-type".into(), "application/json".into()));
        self.send(env, req).await
    }

    async fn delete(&mut self, env: &TestEnv, path: &str) -> IngressReply {
        self.send(env, ingress::request("DELETE", path, "", b""))
            .await
    }
}

fn vault() -> serde_json::Value {
    serde_json::json!({
        "version": 1,
        "kdf": { "name": "PBKDF2-SHA-256", "iterations": 600000, "salt": "AAAAAAAAAAAAAAAAAAAAAA==" },
        "iv": "AAAAAAAAAAAAAAAA",
        "ciphertext": "AAAAAAAAAAAAAAAAAAAAAAAAAAA="
    })
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn keychain_access_keeps_only_the_encrypted_envelope() {
    let env = boot().await;
    let (mut a, mut b) = (Browser::new(), Browser::new());
    const URL: &str = "/api/keychain-access/vault";
    assert_eq!(
        a.get(&env, URL).await,
        serde_json::json!({ "vault": null, "rev": 0 })
    );
    let put = a
        .put(&env, URL, serde_json::json!({ "vault": vault(), "rev": 0 }))
        .await;
    assert_eq!(put.status, 200, "{}", String::from_utf8_lossy(&put.body));
    assert_eq!(
        a.get(&env, URL).await,
        serde_json::json!({ "vault": vault(), "rev": 1 })
    );
    assert_eq!(b.get(&env, URL).await["vault"], serde_json::Value::Null);

    let mut plain = vault();
    plain["items"] = serde_json::json!([{ "name": "example.com", "password": "hunter2" }]);
    let mut weak = vault();
    weak["kdf"]["iterations"] = 1000.into();
    let mut short = vault();
    short["iv"] = "AAAA".into();
    for refused in [plain, weak, short] {
        let reply = a
            .put(&env, URL, serde_json::json!({ "vault": refused, "rev": 1 }))
            .await;
        assert_eq!(reply.status, 400, "{refused}");
    }
    let stale = a
        .put(&env, URL, serde_json::json!({ "vault": vault(), "rev": 0 }))
        .await;
    assert_eq!(stale.status, 409);

    assert_eq!(a.delete(&env, URL).await.status, 200);
    assert_eq!(
        a.get(&env, URL).await,
        serde_json::json!({ "vault": null, "rev": 2 })
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn storage_management_reports_the_session_s_data_and_what_can_be_forgotten() {
    let env = boot().await;
    let (mut a, mut b) = (Browser::new(), Browser::new());
    const URL: &str = "/api/storage-management/usage";
    let empty = a.get(&env, URL).await;
    assert_eq!(empty["bytes"], 0, "{empty}");
    let keychain = |body: &serde_json::Value| {
        body["apps"]
            .as_array()
            .unwrap()
            .iter()
            .find(|app| app["name"] == "keychain-access")
            .cloned()
            .expect("Keychain Access is reported")
    };
    assert_eq!(keychain(&empty)["documents"], serde_json::json!([]));

    let put = a
        .put(
            &env,
            "/api/keychain-access/vault",
            serde_json::json!({ "vault": vault(), "rev": 0 }),
        )
        .await;
    assert_eq!(put.status, 200);
    let used = a.get(&env, URL).await;
    let app = keychain(&used);
    assert_eq!(app["title"], "Keychain Access");
    assert_eq!(app["keys"], 1);
    let bytes = app["bytes"].as_u64().unwrap();
    assert!(bytes > 100, "{app}");
    assert_eq!(used["bytes"].as_u64().unwrap(), bytes);
    assert_eq!(
        app["documents"],
        serde_json::json!([{
            "key": "vault",
            "name": "Encrypted Keychain",
            "bytes": bytes,
            "rev": 1,
            "forget": "/api/keychain-access/vault",
        }])
    );
    assert_eq!(
        b.get(&env, URL).await["bytes"],
        0,
        "another session sees none of it"
    );

    // Forgetting goes through the module's own route; the document is then
    // no longer listed, though its tombstone still counts in the size.
    assert_eq!(
        a.delete(&env, "/api/keychain-access/vault").await.status,
        200
    );
    let forgotten = a.get(&env, URL).await;
    assert_eq!(keychain(&forgotten)["documents"], serde_json::json!([]));
    assert_eq!(keychain(&forgotten)["keys"], 1);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn every_route_storage_management_names_for_forgetting_answers_delete() {
    let env = boot().await;
    let mut a = Browser::new();
    for document in macalicious_desktop::apps::forgettable_documents() {
        let path = format!("/api/{}/{}", document.0, document.1);
        let reply = a.delete(&env, &path).await;
        assert_eq!(
            reply.status,
            200,
            "DELETE {path}: {}",
            String::from_utf8_lossy(&reply.body)
        );
    }
}

//! Launchpad and the App Store on the in-process Forge planes
//! (`ferrite-app-test`): `GET /api/apps` answers the catalogue, the App
//! Store keeps each session's apps and Launchpad each session's order and
//! page, both `null` until the session saves; bad bodies and stale revisions
//! are refused, and `DELETE` forgets.

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

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn the_registry_answers_the_catalogue() {
    let env = boot().await;
    let mut a = Browser::new();
    let body = a.get(&env, "/api/apps").await;
    let catalogue = body["catalogue"].as_array().expect("a catalogue");
    let calculator = catalogue
        .iter()
        .find(|app| app["id"] == "calculator")
        .expect("Calculator is listed");
    assert_eq!(calculator["name"], "Calculator");
    assert_eq!(calculator["preinstalled"], true);
    let books = catalogue.iter().find(|app| app["id"] == "books").unwrap();
    assert_eq!(books["preinstalled"], false, "the store sells Books");
    assert!(catalogue.iter().all(|app| app["id"] != "finder"));
    let names: Vec<_> = body["apps"]
        .as_array()
        .unwrap()
        .iter()
        .map(|app| app["name"].as_str().unwrap().to_string())
        .collect();
    assert!(names.contains(&"launchpad".to_string()) && names.contains(&"app-store".to_string()));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn the_app_store_keeps_the_apps_each_session_got() {
    let env = boot().await;
    let (mut a, mut b) = (Browser::new(), Browser::new());
    const URL: &str = "/api/app-store/library";
    assert_eq!(
        a.get(&env, URL).await,
        serde_json::json!({ "installed": null, "rev": 0 })
    );

    let put = a
        .put(
            &env,
            URL,
            serde_json::json!({ "installed": ["books"], "rev": 0 }),
        )
        .await;
    assert_eq!(put.status, 200, "{}", String::from_utf8_lossy(&put.body));
    assert_eq!(
        a.get(&env, URL).await,
        serde_json::json!({ "installed": ["books"], "rev": 1 })
    );
    assert_eq!(b.get(&env, URL).await["installed"], serde_json::Value::Null);

    let stale = a
        .put(&env, URL, serde_json::json!({ "installed": [], "rev": 0 }))
        .await;
    assert_eq!(stale.status, 409);
    assert_eq!(json(&stale)["installed"], serde_json::json!(["books"]));
    for refused in [
        serde_json::json!({ "installed": ["calculator"], "rev": 1 }),
        serde_json::json!({ "installed": ["nonsense"], "rev": 1 }),
        serde_json::json!({ "installed": ["books", "books"], "rev": 1 }),
        serde_json::json!({ "installed": "books", "rev": 1 }),
    ] {
        let reply = a.put(&env, URL, refused.clone()).await;
        assert_eq!(reply.status, 400, "{refused}");
    }

    assert_eq!(a.delete(&env, URL).await.status, 200);
    assert_eq!(
        a.get(&env, URL).await,
        serde_json::json!({ "installed": null, "rev": 2 })
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn launchpad_keeps_each_session_s_order_and_page() {
    let env = boot().await;
    let (mut a, mut b) = (Browser::new(), Browser::new());
    const URL: &str = "/api/launchpad/layout";
    assert_eq!(
        a.get(&env, URL).await,
        serde_json::json!({ "order": null, "page": null, "rev": 0 })
    );

    let layout = serde_json::json!({ "order": ["notes", "calculator"], "page": 1 });
    let put = a
        .put(
            &env,
            URL,
            serde_json::json!({ "order": layout["order"], "page": 1, "rev": 0 }),
        )
        .await;
    assert_eq!(put.status, 200, "{}", String::from_utf8_lossy(&put.body));
    assert_eq!(
        a.get(&env, URL).await,
        serde_json::json!({ "order": ["notes", "calculator"], "page": 1, "rev": 1 })
    );
    assert_eq!(b.get(&env, URL).await["order"], serde_json::Value::Null);

    let stale = a
        .put(
            &env,
            URL,
            serde_json::json!({ "order": [], "page": 0, "rev": 0 }),
        )
        .await;
    assert_eq!(stale.status, 409);
    assert_eq!(json(&stale)["page"], 1);
    for refused in [
        serde_json::json!({ "order": ["finder"], "page": 0, "rev": 1 }),
        serde_json::json!({ "order": ["notes", "notes"], "page": 0, "rev": 1 }),
        serde_json::json!({ "order": [], "page": 99, "rev": 1 }),
        serde_json::json!({ "order": [], "rev": 1 }),
    ] {
        let reply = a.put(&env, URL, refused.clone()).await;
        assert_eq!(reply.status, 400, "{refused}");
    }

    assert_eq!(a.delete(&env, URL).await.status, 200);
    assert_eq!(
        a.get(&env, URL).await,
        serde_json::json!({ "order": null, "page": null, "rev": 2 })
    );
}

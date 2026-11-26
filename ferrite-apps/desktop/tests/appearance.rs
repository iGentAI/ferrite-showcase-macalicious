//! The person's own desktop on the in-process Forge planes: the wallpaper,
//! appearance, accent and highlight colours, Dock, desktop icons and window
//! places that System Preferences keeps (`src/apps/system_preferences`) are
//! the account's, not the browser's: kept across sign-ins and browsers for
//! one person, never shown to another, and refused when they are not of
//! their shape.

use ferrite_app::{serde_json, IngressReply, IngressRequest};
use ferrite_app_test::{ingress, TestEnv, TestHarness};

const PEPPER: &str = "test-pepper-0123456789abcdef0123456789abcdef";
const PASSWORD: &str = "correct horse battery";
const URL: &str = "/api/system-preferences/settings";

async fn boot() -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let env = TestHarness::new()
        .with_queue("requests")
        .with_queue("replies")
        .with_store("data")
        .manual_clock(1_760_000_000_000)
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

fn json(reply: &IngressReply) -> serde_json::Value {
    serde_json::from_slice(&reply.body)
        .unwrap_or_else(|e| panic!("{e}: {}", String::from_utf8_lossy(&reply.body)))
}

/// One browser and the cookie it holds.
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
        if let Some((_, cookie)) = reply
            .headers
            .iter()
            .find(|(n, _)| n.eq_ignore_ascii_case("set-cookie"))
        {
            let pair = cookie.split(';').next().unwrap();
            let token = pair
                .strip_prefix("mac_session=")
                .expect("the session cookie");
            self.token = (!token.is_empty()).then(|| token.to_string());
        }
        reply
    }

    async fn post(&mut self, env: &TestEnv, path: &str, body: serde_json::Value) -> IngressReply {
        let mut req = ingress::post(path, body.to_string());
        req.headers
            .push(("content-type".into(), "application/json".into()));
        self.send(env, req).await
    }

    async fn sign_up(&mut self, env: &TestEnv, name: &str) {
        let body = serde_json::json!({ "name": name, "full_name": name, "password": PASSWORD });
        let reply = self.post(env, "/api/session/sign-up", body).await;
        assert_eq!(
            reply.status,
            201,
            "{}",
            String::from_utf8_lossy(&reply.body)
        );
    }

    async fn sign_in(&mut self, env: &TestEnv, name: &str) {
        let body = serde_json::json!({ "name": name, "password": PASSWORD });
        let reply = self.post(env, "/api/session/sign-in", body).await;
        assert!(
            (200..300).contains(&reply.status),
            "{}: {}",
            reply.status,
            String::from_utf8_lossy(&reply.body)
        );
    }

    async fn settings(&mut self, env: &TestEnv) -> serde_json::Value {
        let reply = self.send(env, ingress::get(URL)).await;
        assert_eq!(
            reply.status,
            200,
            "{}",
            String::from_utf8_lossy(&reply.body)
        );
        json(&reply)
    }

    async fn save(&mut self, env: &TestEnv, body: serde_json::Value) -> IngressReply {
        let mut req = ingress::request("PUT", URL, "", body.to_string().as_bytes());
        req.headers
            .push(("content-type".into(), "application/json".into()));
        self.send(env, req).await
    }
}

fn desktop() -> serde_json::Value {
    serde_json::json!({
        "dock.size": 30,
        "dock.magnification": true,
        "dock.position": "left",
        "dock.autohide": true,
        "dock.order": ["safari", "notes", "system-preferences"],
        "dock.removed": ["chess"],
        "desktop-and-screen-saver.picture": "mojave",
        "desktop-and-screen-saver.mode": "dynamic",
    })
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn each_person_keeps_their_own_desktop() {
    let env = boot().await;
    let mut chris = Browser::default();
    chris.sign_up(&env, "chris").await;
    let mut martin = Browser::default();
    martin.sign_up(&env, "martin").await;

    let theme = serde_json::json!({ "appearance": "dark", "accent": "green", "highlight": "pink" });
    let saved = chris
        .save(
            &env,
            serde_json::json!({ "values": desktop(), "theme": theme, "rev": 0 }),
        )
        .await;
    assert_eq!(
        saved.status,
        200,
        "{}",
        String::from_utf8_lossy(&saved.body)
    );

    // Martin's desktop is his own: nothing of Chris's.
    let his = martin.settings(&env).await;
    assert_eq!(his["values"], serde_json::Value::Null);
    assert_eq!(his["theme"], serde_json::Value::Null);

    // Chris signs in from another browser and finds his whole desktop there.
    let mut laptop = Browser::default();
    laptop.sign_in(&env, "chris").await;
    let mine = laptop.settings(&env).await;
    assert_eq!(mine["values"], desktop());
    assert_eq!(mine["theme"], theme);

    // Martin's own choice stays his, and leaves Chris's alone.
    let rev = his["rev"].as_u64().unwrap();
    let light = serde_json::json!({ "appearance": "light", "accent": "red", "highlight": null });
    let saved = martin
        .save(
            &env,
            serde_json::json!({
                "values": { "dock.position": "right", "desktop-and-screen-saver.picture": "photos" },
                "theme": light,
                "rev": rev,
            }),
        )
        .await;
    assert_eq!(
        saved.status,
        200,
        "{}",
        String::from_utf8_lossy(&saved.body)
    );
    assert_eq!(chris.settings(&env).await["values"], desktop());
    assert_eq!(martin.settings(&env).await["theme"], light);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_desktop_setting_of_the_wrong_shape_is_refused_and_nothing_is_kept() {
    let env = boot().await;
    let mut chris = Browser::default();
    chris.sign_up(&env, "chris").await;
    for (key, value) in [
        ("dock.position", serde_json::json!("top")),
        ("dock.order", serde_json::json!(["notes", "notes"])),
        (
            "desktop-and-screen-saver.picture",
            serde_json::json!("https://example.com/x.jpg"),
        ),
    ] {
        let reply = chris
            .save(
                &env,
                serde_json::json!({ "values": { key: value }, "theme": null, "rev": 0 }),
            )
            .await;
        assert_eq!(reply.status, 400, "{key} was taken");
    }
    assert_eq!(
        chris.settings(&env).await["values"],
        serde_json::Value::Null
    );
}

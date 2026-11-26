//! Calendar's preferences on the in-process Forge planes (`ferrite-app-test`):
//! `/api/calendar/settings`, one document per person beside the events.

use ferrite_app::{serde_json, IngressReply};
use ferrite_app_test::{ingress, TestEnv, TestHarness};
use serde_json::{json, Value};

const PEPPER: &str = "test-pepper-0123456789abcdef0123456789abcdef";
const PASSWORD: &str = "correct horse battery";
const URL: &str = "/api/calendar/settings";

async fn boot() -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let env = TestHarness::new()
        .manual_clock(1_791_964_800_000)
        .with_queue("requests")
        .with_queue("replies")
        .with_queue("timers")
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

/// A browser: its session cookie, kept from the replies that set it.
struct Browser {
    token: Option<String>,
}

impl Browser {
    async fn send(
        &mut self,
        env: &TestEnv,
        method: &str,
        path: &str,
        body: Option<&Value>,
    ) -> IngressReply {
        let bytes = body.map(Value::to_string).unwrap_or_default();
        let mut req = ingress::request(method, path, "", bytes.as_bytes());
        if body.is_some() {
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

    async fn read(&mut self, env: &TestEnv) -> Value {
        let reply = self.send(env, "GET", URL, None).await;
        assert_eq!(reply.status, 200, "GET {URL}: {}", text(&reply));
        json_of(&reply)
    }

    async fn put(&mut self, env: &TestEnv, settings: &Value, rev: &Value) -> IngressReply {
        let body = json!({ "settings": settings, "rev": rev });
        self.send(env, "PUT", URL, Some(&body)).await
    }
}

async fn sign_up(env: &TestEnv, name: &str) -> Browser {
    let mut browser = Browser { token: None };
    let reply = browser
        .send(
            env,
            "POST",
            "/api/session/sign-up",
            Some(&json!({ "name": name, "full_name": name, "password": PASSWORD })),
        )
        .await;
    assert_eq!(reply.status, 201, "sign up {name}: {}", text(&reply));
    browser
}

fn monday() -> Value {
    json!({
        "daysPerWeek": 7,
        "weekStartsOn": 1,
        "scrollBy": "week-stop-on-today",
        "dayStartsAt": 7,
        "dayEndsAt": 19,
        "hoursShown": 10,
        "defaultCalendar": "home",
        "showBirthdays": true,
        "showHolidays": false,
        "showAlternateCalendar": false
    })
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_person_keeps_preferences_of_their_own() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris").await;
    let mut anna = sign_up(&env, "anna").await;

    let first = chris.read(&env).await;
    assert_eq!(first["settings"], Value::Null, "none until a change");
    let saved = chris.put(&env, &monday(), &first["rev"]).await;
    assert_eq!(saved.status, 200, "{}", text(&saved));
    let now = chris.read(&env).await;
    assert_eq!(now["settings"], monday());
    assert_ne!(now["rev"], first["rev"], "a new revision");
    assert_eq!(
        anna.read(&env).await["settings"],
        Value::Null,
        "another account's preferences are its own"
    );

    // A save on the revision the page read before is refused, with the stored preferences.
    let mut wednesday = monday();
    wednesday["weekStartsOn"] = json!(3);
    let stale = chris.put(&env, &wednesday, &first["rev"]).await;
    assert_eq!(stale.status, 409, "{}", text(&stale));
    assert_eq!(json_of(&stale)["settings"], monday());
    assert_eq!(
        chris.read(&env).await["settings"],
        monday(),
        "nothing changed"
    );

    // Preferences the window does not offer, or fields it does not have, are refused.
    let rev = chris.read(&env).await["rev"].clone();
    for (field, value) in [
        ("daysPerWeek", json!(6)),
        ("weekStartsOn", json!(7)),
        ("dayEndsAt", json!(7)),
        ("hoursShown", json!(9)),
        ("scrollBy", json!("month")),
        ("defaultCalendar", json!("a/b")),
        ("alerts", json!("15 minutes before")),
    ] {
        let mut bad = monday();
        bad[field] = value;
        let refused = chris.put(&env, &bad, &rev).await;
        assert_eq!(refused.status, 400, "{field}: {}", text(&refused));
    }
    assert_eq!(
        chris.read(&env).await["rev"],
        rev,
        "no refused save was stored"
    );

    let other = chris.send(&env, "DELETE", URL, None).await;
    assert_eq!(other.status, 405);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn the_events_read_answers_the_preferences_too() {
    const EVENTS: &str = "/api/calendar/events";
    let env = boot().await;
    let mut chris = sign_up(&env, "chris").await;
    let mut anna = sign_up(&env, "anna").await;

    let first = chris.send(&env, "GET", EVENTS, None).await;
    assert_eq!(first.status, 200, "{}", text(&first));
    let first = json_of(&first);
    assert_eq!(first["settings"], Value::Null, "none until a change");
    let rev = chris.read(&env).await["rev"].clone();
    assert_eq!(chris.put(&env, &monday(), &rev).await.status, 200);

    // The window's first read: the events, and the preferences that lay out its first week.
    let after = json_of(&chris.send(&env, "GET", EVENTS, None).await);
    assert_eq!(after["settings"], monday());
    assert_eq!(
        after["rev"], first["rev"],
        "the events keep their own revision"
    );
    let theirs = json_of(&anna.send(&env, "GET", EVENTS, None).await);
    assert_eq!(
        theirs["settings"],
        Value::Null,
        "another account's read answers its own preferences"
    );

    // A save of the events carrying the preferences a read answered (a page's merge keeps them)
    // is taken; the preferences are saved at /settings only.
    let mut wednesday = monday();
    wednesday["weekStartsOn"] = json!(3);
    let body = json!({ "events": [], "rev": after["rev"], "settings": wednesday });
    let saved = chris.send(&env, "PUT", EVENTS, Some(&body)).await;
    assert_eq!(saved.status, 200, "{}", text(&saved));
    assert_eq!(chris.read(&env).await["settings"], monday());
}

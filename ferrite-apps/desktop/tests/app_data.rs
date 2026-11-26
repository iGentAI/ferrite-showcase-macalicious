//! The Calendar, Contacts and System Preferences modules on the in-process
//! Forge planes (`ferrite-app-test`): each keeps its document per browser
//! session, answers `null` until the session saves, replaces on `PUT`,
//! refuses bad bodies and forgets on `DELETE`. The server owns each
//! document's revision: a `PUT` names the revision it was based on, and one
//! based on any other is refused with 409 and the current document.

use crate::support;

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

async fn call(env: &TestEnv, req: IngressRequest) -> IngressReply {
    env.handle(req).await.expect("a reply")
}

fn json(reply: &IngressReply) -> serde_json::Value {
    serde_json::from_slice(&reply.body)
        .unwrap_or_else(|e| panic!("{e}: {}", String::from_utf8_lossy(&reply.body)))
}

/// A browser: its session cookie, once the first reply has set it, and the
/// session id the modules' `GET` replies name. A clone is a second window of
/// the same browser.
#[derive(Clone)]
struct Browser {
    token: Option<String>,
    session: Option<String>,
}

impl Browser {
    fn new() -> Self {
        Browser {
            token: None,
            session: None,
        }
    }

    async fn send(&mut self, env: &TestEnv, mut req: IngressRequest) -> IngressReply {
        if let Some(token) = &self.token {
            req.headers
                .push(("cookie".into(), format!("mac_session={token}")));
        }
        let reply = call(env, req).await;
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

    /// The reply's body, without the `session` it must carry: the same id on
    /// every `GET` of this browser.
    async fn get(&mut self, env: &TestEnv, path: &str) -> serde_json::Value {
        let reply = self.send(env, ingress::get(path)).await;
        assert_eq!(
            reply.status,
            200,
            "GET {path}: {}",
            String::from_utf8_lossy(&reply.body)
        );
        let mut body = json(&reply);
        let session = body
            .as_object_mut()
            .and_then(|object| object.remove("session"))
            .and_then(|session| session.as_str().map(str::to_owned))
            .unwrap_or_else(|| panic!("GET {path} names no session"));
        assert_eq!(session.len(), 64, "the session id is a hex SHA-256");
        match &self.session {
            Some(known) => assert_eq!(known, &session, "GET {path} named another session"),
            None => self.session = Some(session),
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
async fn calendar_events_are_kept_per_session() {
    let env = boot().await;
    let (mut a, mut b) = (Browser::new(), Browser::new());
    const URL: &str = "/api/calendar/events";
    // Before a save: no events, the calendars everyone starts with, and no preferences (the
    // events' read answers the person's preferences beside them, for the window's first week).
    let unsaved = serde_json::json!({
        "events": null,
        "calendars": [
            { "id": "home", "name": "Home", "color": "cyan" },
            { "id": "work", "name": "Work", "color": "purple" },
        ],
        "settings": null,
        "rev": 0,
    });
    assert_eq!(a.get(&env, URL).await, unsaved);

    let lunch = serde_json::json!({
        "id": "new-1", "title": " Lunch ", "start": 1_570_118_400_000_i64,
        "end": 1_570_122_000_000_i64, "calendar": "home",
    });
    let holiday = serde_json::json!({
        "id": "halloween", "title": "Halloween", "start": 1_572_480_000_000_i64,
        "end": 1_572_566_400_000_i64, "allDay": true, "calendar": "holidays",
    });
    let saved = a
        .put(
            &env,
            URL,
            serde_json::json!({ "events": [holiday, lunch], "rev": 0 }),
        )
        .await;
    assert_eq!(
        saved.status,
        200,
        "{}",
        String::from_utf8_lossy(&saved.body)
    );
    assert_eq!(
        json(&saved)["rev"],
        1,
        "the server answers the new revision"
    );

    // Ordered by start, the title trimmed.
    let stored = a.get(&env, URL).await;
    assert_eq!(stored["rev"], 1);
    let events = stored["events"].clone();
    let titles: Vec<_> = events
        .as_array()
        .unwrap()
        .iter()
        .map(|e| e["title"].clone())
        .collect();
    assert_eq!(titles, ["Lunch", "Halloween"]);
    assert_eq!(events[1]["allDay"], true);

    // Another browser sees none of it.
    assert_eq!(b.get(&env, URL).await, unsaved);

    // A replace drops what it leaves out.
    let replaced = a
        .put(
            &env,
            URL,
            serde_json::json!({ "events": [holiday], "rev": 1 }),
        )
        .await;
    assert_eq!(replaced.status, 200);
    assert_eq!(
        a.get(&env, URL).await["events"].as_array().unwrap().len(),
        1
    );

    // A replace with nothing is kept as an empty list, not as "never saved".
    let emptied = a
        .put(&env, URL, serde_json::json!({ "events": [], "rev": 2 }))
        .await;
    assert_eq!(emptied.status, 200);
    assert_eq!(a.get(&env, URL).await["events"], serde_json::json!([]));

    let bad = a
        .put(&env, URL, serde_json::json!({ "events": [{ "id": "x", "title": "x", "start": 2, "end": 1, "calendar": "home" }], "rev": 3 }))
        .await;
    assert_eq!(bad.status, 400);
    let extreme = a
        .put(&env, URL, serde_json::json!({ "events": [{ "id": "x", "title": "x", "start": i64::MIN, "end": 0, "calendar": "home" }], "rev": 3 }))
        .await;
    assert_eq!(
        extreme.status, 400,
        "a date JavaScript cannot hold is refused, not a crash"
    );
    let deleted = a.delete(&env, URL).await;
    assert_eq!(deleted.status, 200);
    let mut forgotten = unsaved.clone();
    forgotten["rev"] = 4.into();
    assert_eq!(
        a.get(&env, URL).await,
        forgotten,
        "a delete forgets the list (and the calendars) under a new revision"
    );

    let wrong = a.send(&env, ingress::post(URL, "{}")).await;
    assert_eq!(wrong.status, 405);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn contacts_cards_are_kept_per_session() {
    let env = boot().await;
    let (mut a, mut b) = (Browser::new(), Browser::new());
    const URL: &str = "/api/contacts/cards";
    assert_eq!(a.get(&env, URL).await["cards"], serde_json::Value::Null);

    let ada = serde_json::json!({
        "id": "new-1", "account": "icloud", "first": "Ada", "last": "Marsh",
        "emails": [{ "label": "work", "value": "ada@marsh.example" }],
    });
    let saved = a
        .put(&env, URL, serde_json::json!({ "cards": [ada], "rev": 0 }))
        .await;
    assert_eq!(
        saved.status,
        200,
        "{}",
        String::from_utf8_lossy(&saved.body)
    );
    assert_eq!(a.get(&env, URL).await["cards"], serde_json::json!([ada]));
    assert_eq!(b.get(&env, URL).await["cards"], serde_json::Value::Null);

    let unknown = a
        .put(&env, URL, serde_json::json!({ "cards": [{ "id": "x", "account": "icloud", "first": "", "last": "", "photo": "x" }], "rev": 1 }))
        .await;
    assert_eq!(unknown.status, 400, "an unknown field is refused");
    assert_eq!(
        a.get(&env, URL).await,
        serde_json::json!({ "cards": [ada], "rev": 1 }),
        "a refused PUT changes nothing"
    );
}

/// A save based on a revision that is no longer stored is refused with 409,
/// answering the current document and revision, so the page can take that
/// revision and try again.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_save_on_a_stale_revision_is_refused_with_the_current_document() {
    let env = boot().await;
    let mut a = Browser::new();
    const URL: &str = "/api/contacts/cards";
    let ada =
        serde_json::json!({ "id": "ada", "account": "icloud", "first": "Ada", "last": "Marsh" });
    let lena =
        serde_json::json!({ "id": "lena", "account": "icloud", "first": "Lena", "last": "Brandt" });
    assert_eq!(a.get(&env, URL).await["rev"], 0);
    let first = a
        .put(&env, URL, serde_json::json!({ "cards": [ada], "rev": 0 }))
        .await;
    assert_eq!(json(&first)["rev"], 1);

    let stale = a
        .put(&env, URL, serde_json::json!({ "cards": [lena], "rev": 0 }))
        .await;
    assert_eq!(
        stale.status,
        409,
        "{}",
        String::from_utf8_lossy(&stale.body)
    );
    let current = json(&stale);
    assert_eq!(current["cards"], serde_json::json!([ada]));
    assert_eq!(current["rev"], 1);
    assert!(current["error"].is_string());
    assert_eq!(
        a.get(&env, URL).await,
        serde_json::json!({ "cards": [ada], "rev": 1 }),
        "a refused save changes nothing"
    );

    // Retried on the revision the 409 answered, it is stored.
    let retried = a
        .put(
            &env,
            URL,
            serde_json::json!({ "cards": [ada, lena], "rev": 1 }),
        )
        .await;
    assert_eq!(retried.status, 200);
    assert_eq!(json(&retried)["rev"], 2);

    // A save from the future, and one with no revision, are refused too.
    let ahead = a
        .put(&env, URL, serde_json::json!({ "cards": [], "rev": 9 }))
        .await;
    assert_eq!(ahead.status, 409);
    let unnumbered = a.put(&env, URL, serde_json::json!({ "cards": [] })).await;
    assert_eq!(unnumbered.status, 400, "a PUT must name its base revision");

    // A delete moves the revision on, so the revision before it is stale.
    assert_eq!(a.delete(&env, URL).await.status, 200);
    let after_delete = a
        .put(&env, URL, serde_json::json!({ "cards": [ada], "rev": 2 }))
        .await;
    assert_eq!(after_delete.status, 409);
    assert_eq!(
        json(&after_delete),
        serde_json::json!({ "cards": null, "rev": 3, "error": json(&after_delete)["error"] })
    );
}

/// A window that is closed and opened again loads the document with its
/// current revision and saves on it; the closed window's revision is stale.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_reopened_window_saves_on_the_revision_it_loads() {
    let env = boot().await;
    let mut first = Browser::new();
    const URL: &str = "/api/calendar/events";
    let event = |id: &str| {
        serde_json::json!({
            "id": id, "title": id, "start": 1_570_118_400_000_i64,
            "end": 1_570_122_000_000_i64, "calendar": "work",
        })
    };
    let loaded = first.get(&env, URL).await["rev"].as_u64().unwrap();
    let saved = first
        .put(
            &env,
            URL,
            serde_json::json!({ "events": [event("a")], "rev": loaded }),
        )
        .await;
    assert_eq!(saved.status, 200);
    let closed_at = json(&saved)["rev"].as_u64().unwrap();

    // The window is closed; a new one of the same browser opens and loads.
    let mut reopened = first.clone();
    let reloaded = reopened.get(&env, URL).await;
    assert_eq!(reloaded["events"], serde_json::json!([event("a")]));
    assert_eq!(reloaded["rev"], closed_at);
    let again = reopened
        .put(
            &env,
            URL,
            serde_json::json!({ "events": [event("a"), event("b")], "rev": closed_at }),
        )
        .await;
    assert_eq!(
        again.status,
        200,
        "{}",
        String::from_utf8_lossy(&again.body)
    );
    assert_eq!(json(&again)["rev"], closed_at + 1);

    // A save still based on the closed window's revision cannot undo it.
    let late = first
        .put(
            &env,
            URL,
            serde_json::json!({ "events": [], "rev": closed_at }),
        )
        .await;
    assert_eq!(late.status, 409);
    assert_eq!(
        reopened.get(&env, URL).await["events"],
        serde_json::json!([event("a"), event("b")])
    );
}

/// Two sessions saving at the same moment each keep their own document;
/// two windows of one session saving on the same revision at the same
/// moment get exactly one save stored and the other refused.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn concurrent_saves_are_isolated_by_session_and_ordered_within_one() {
    let env = boot().await;
    let (mut a, mut b) = (Browser::new(), Browser::new());
    const URL: &str = "/api/contacts/cards";
    let card =
        |id: &str| serde_json::json!({ "id": id, "account": "mac", "first": id, "last": "" });
    // Each browser gets its session first.
    a.get(&env, URL).await;
    b.get(&env, URL).await;

    let (saved_a, saved_b) = support::join(
        a.put(
            &env,
            URL,
            serde_json::json!({ "cards": [card("a")], "rev": 0 }),
        ),
        b.put(
            &env,
            URL,
            serde_json::json!({ "cards": [card("b")], "rev": 0 }),
        ),
    )
    .await;
    assert_eq!((saved_a.status, saved_b.status), (200, 200));
    assert_eq!(
        a.get(&env, URL).await,
        serde_json::json!({ "cards": [card("a")], "rev": 1 })
    );
    assert_eq!(
        b.get(&env, URL).await,
        serde_json::json!({ "cards": [card("b")], "rev": 1 })
    );

    let mut a2 = a.clone();
    let (one, two) = support::join(
        a.put(
            &env,
            URL,
            serde_json::json!({ "cards": [card("one")], "rev": 1 }),
        ),
        a2.put(
            &env,
            URL,
            serde_json::json!({ "cards": [card("two")], "rev": 1 }),
        ),
    )
    .await;
    let mut statuses = [one.status, two.status];
    statuses.sort();
    assert_eq!(
        statuses,
        [200, 409],
        "exactly one save on revision 1 is stored"
    );
    let winner = if one.status == 200 { "one" } else { "two" };
    assert_eq!(
        a.get(&env, URL).await,
        serde_json::json!({ "cards": [card(winner)], "rev": 2 })
    );
    let loser = if one.status == 409 { &one } else { &two };
    assert_eq!(json(loser)["cards"], serde_json::json!([card(winner)]));
    assert_eq!(json(loser)["rev"], 2);
}

/// A save is stored only on the revision it was based on: a body on an older
/// revision gets 409 with the current list, and an unknown field is refused.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_save_on_a_stale_revision_is_refused() {
    let env = boot().await;
    let mut a = Browser::new();
    const URL: &str = "/api/contacts/cards";
    let card =
        |id: &str| serde_json::json!({ "id": id, "account": "mac", "first": id, "last": "" });
    a.get(&env, URL).await;

    let first = a
        .put(
            &env,
            URL,
            serde_json::json!({ "cards": [card("one")], "rev": 0 }),
        )
        .await;
    assert_eq!(first.status, 200);
    let stale = a
        .put(
            &env,
            URL,
            serde_json::json!({ "cards": [card("two")], "rev": 0 }),
        )
        .await;
    assert_eq!(stale.status, 409);
    assert_eq!(json(&stale)["cards"], serde_json::json!([card("one")]));
    assert_eq!(json(&stale)["rev"], 1);
    let named = a
        .put(
            &env,
            URL,
            serde_json::json!({ "cards": [], "rev": 1, "after": "s1" }),
        )
        .await;
    assert_eq!(named.status, 400, "a save names nothing but its revision");
    // A save from a page that loaded under another session (a replaced
    // cookie) is refused even on the stored revision, and shows nothing.
    let elsewhere = a
        .put(
            &env,
            URL,
            serde_json::json!({ "cards": [], "rev": 1, "session": "f".repeat(64) }),
        )
        .await;
    assert_eq!(elsewhere.status, 409);
    let own = a.session.clone().expect("the GET named the session");
    assert_eq!(
        json(&elsewhere),
        serde_json::json!({ "error": json(&elsewhere)["error"], "session": own })
    );
    assert_eq!(
        a.get(&env, URL).await,
        serde_json::json!({ "cards": [card("one")], "rev": 1 })
    );
    let mine = a
        .put(
            &env,
            URL,
            serde_json::json!({ "cards": [card("two")], "rev": 1, "session": own }),
        )
        .await;
    assert_eq!(mine.status, 200, "{}", String::from_utf8_lossy(&mine.body));
    assert_eq!(
        a.get(&env, URL).await,
        serde_json::json!({ "cards": [card("two")], "rev": 2 })
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn system_preferences_keep_settings_and_theme_per_session() {
    let env = boot().await;
    let (mut a, mut b) = (Browser::new(), Browser::new());
    const URL: &str = "/api/system-preferences/settings";
    let empty = serde_json::json!({ "values": null, "theme": null, "rev": 0 });
    assert_eq!(a.get(&env, URL).await, empty);

    let settings = serde_json::json!({
        "values": { "dock.size": 0.4, "general.scrollBars": "always" },
        "theme": { "appearance": "dark", "accent": "pink", "highlight": null },
    });
    let with_rev = |body: &serde_json::Value, rev: u64| {
        let mut body = body.clone();
        body["rev"] = rev.into();
        body
    };
    let saved = a.put(&env, URL, with_rev(&settings, 0)).await;
    assert_eq!(
        saved.status,
        200,
        "{}",
        String::from_utf8_lossy(&saved.body)
    );
    assert_eq!(json(&saved), with_rev(&settings, 1));
    assert_eq!(a.get(&env, URL).await, with_rev(&settings, 1));
    assert_eq!(b.get(&env, URL).await, empty);

    // A PUT replaces both halves together: a null half is stored as null.
    let theme_only = serde_json::json!({ "values": null, "theme": settings["theme"] });
    assert_eq!(a.put(&env, URL, with_rev(&theme_only, 1)).await.status, 200);
    assert_eq!(a.get(&env, URL).await, with_rev(&theme_only, 2));

    let bad = a
        .put(&env, URL, serde_json::json!({ "values": null, "theme": { "appearance": "dim", "accent": null, "highlight": null }, "rev": 2 }))
        .await;
    assert_eq!(bad.status, 400);
    assert_eq!(a.delete(&env, URL).await.status, 200);
    assert_eq!(
        a.get(&env, URL).await,
        serde_json::json!({ "values": null, "theme": null, "rev": 3 })
    );
}

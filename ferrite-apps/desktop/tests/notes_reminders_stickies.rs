//! The Notes, Reminders and Stickies modules on the in-process Forge planes:
//! each keeps a session's document, separate from every other session's, and
//! Reminders' alerts fire when the platform clock passes their instant.

use ferrite_app::{serde_json, IngressReply, IngressRequest};
use ferrite_app_test::{ingress, TestEnv, TestHarness};

/// The virtual clock's start: 2026-10-12 08:00 UTC.
const START_MS: u64 = 1_791_792_000_000;
const HOUR_MS: u64 = 60 * 60 * 1000;

async fn boot() -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let env = TestHarness::new()
        .with_queue("requests")
        .with_queue("replies")
        .with_store("data")
        .manual_clock(START_MS)
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

fn with_cookie(mut req: IngressRequest, token: &str) -> IngressRequest {
    req.headers
        .push(("cookie".into(), format!("mac_session={token}")));
    req
}

/// A new browser: the token of the session its first request was given.
async fn browser(env: &TestEnv) -> String {
    let reply = call(env, ingress::get("/api/session")).await;
    let cookie = reply
        .headers
        .iter()
        .find(|(n, _)| n.eq_ignore_ascii_case("set-cookie"))
        .map(|(_, v)| v.clone())
        .expect("a new session sets its cookie");
    cookie
        .split(';')
        .next()
        .and_then(|pair| pair.strip_prefix("mac_session="))
        .expect("the session cookie")
        .to_string()
}

async fn get(env: &TestEnv, token: &str, path: &str) -> IngressReply {
    call(env, with_cookie(ingress::get(path), token)).await
}

async fn send(
    env: &TestEnv,
    token: &str,
    method: &str,
    path: &str,
    mut body: serde_json::Value,
) -> IngressReply {
    // A body that names no base is sent on the stored revision, as a page that has just
    // read the document sends it.
    if method == "PUT" && body.get("base").is_none() {
        body["base"] = json(&get(env, token, path).await)["rev"].clone();
    }
    let body = serde_json::to_vec(&body).unwrap();
    let mut req = ingress::request(method, path, "", body);
    req.headers
        .push(("content-type".into(), "application/json".into()));
    call(env, with_cookie(req, token)).await
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_stored_document_that_cannot_be_read_is_never_overwritten() {
    let env = boot().await;
    let token = browser(&env).await;
    let session = macalicious_desktop::session::session_id(&token);
    let mut store = env.store("data");
    for (app, key, body) in [
        (
            "notes",
            "library",
            serde_json::json!({ "base": 0, "data": { "folders": [{ "id": "notes", "name": "Notes" }], "notes": [] } }),
        ),
        (
            "reminders",
            "data",
            serde_json::json!({
                "base": 0,
                "data": { "lists": [{ "id": "reminders", "name": "Reminders", "color": "blue" }], "reminders": [] },
                "alerts": {}
            }),
        ),
        (
            "stickies",
            "notes",
            serde_json::json!({ "base": 0, "data": { "notes": [] } }),
        ),
    ] {
        let stored = format!("apps/{app}/users/{session}/{key}");
        // Bytes that are no JSON, and a revision that matches the base beside a document that
        // is not one.
        let corrupt: [&[u8]; 2] = [b"not json", br#"{"rev":0,"data":"corrupt","alerts":{}}"#];
        for bytes in corrupt {
            store.put(stored.as_bytes(), bytes).await.unwrap();
            // Revision 0 is the revision of an absent document, not of an unreadable one.
            let reply = send(
                &env,
                &token,
                "PUT",
                &format!("/api/{app}/data"),
                body.clone(),
            )
            .await;
            // A valid body on revision 0 reaches storage, which refuses it as unreadable.
            assert_eq!(
                reply.status,
                503,
                "{app}: {}",
                String::from_utf8_lossy(&reply.body)
            );
            let (rows, _) = store
                .scan_prefix(stored.as_bytes(), None, 16)
                .await
                .unwrap();
            assert_eq!(rows.len(), 1, "{app}");
            assert_eq!(
                rows[0].1.as_slice(),
                bytes,
                "{app}: the stored bytes changed"
            );
        }
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn stickies_keeps_each_sessions_notes() {
    let env = boot().await;
    let a = browser(&env).await;
    let b = browser(&env).await;

    let empty = get(&env, &a, "/api/stickies/data").await;
    assert_eq!(empty.status, 200);
    assert_eq!(
        json(&empty)["data"],
        serde_json::Value::Null,
        "nothing saved yet"
    );

    let notes = serde_json::json!({ "notes": [{ "id": "note-1", "color": "yellow", "text": "Buy milk\n" }] });
    let saved = send(
        &env,
        &a,
        "PUT",
        "/api/stickies/data",
        serde_json::json!({ "data": notes }),
    )
    .await;
    assert_eq!(
        saved.status,
        200,
        "{}",
        String::from_utf8_lossy(&saved.body)
    );
    assert_eq!(
        json(&get(&env, &a, "/api/stickies/data").await)["data"],
        notes
    );
    assert_eq!(
        json(&get(&env, &b, "/api/stickies/data").await)["data"],
        serde_json::Value::Null,
        "another browser sees none of them"
    );

    let bad = send(
        &env,
        &a,
        "PUT",
        "/api/stickies/data",
        serde_json::json!({ "data": { "notes": [{ "id": "x", "color": "teal", "text": "" }] } }),
    )
    .await;
    assert_eq!(bad.status, 400);
    assert_eq!(
        json(&get(&env, &a, "/api/stickies/data").await)["data"],
        notes,
        "a refused write changes nothing"
    );
    assert_eq!(
        send(
            &env,
            &a,
            "POST",
            "/api/stickies/data",
            serde_json::json!({})
        )
        .await
        .status,
        405
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_write_on_a_stale_base_is_refused_and_changes_nothing() {
    let env = boot().await;
    let a = browser(&env).await;
    let notes = |text: &str| serde_json::json!({ "notes": [{ "id": "note-1", "color": "yellow", "text": text }] });
    let put = |base: u64, text: &str| serde_json::json!({ "base": base, "data": notes(text) });

    // The server owns the revision: each stored write answers the next one.
    let first = send(&env, &a, "PUT", "/api/stickies/data", put(0, "first")).await;
    assert_eq!(first.status, 200);
    assert_eq!(json(&first)["rev"], 1);
    let second = send(&env, &a, "PUT", "/api/stickies/data", put(1, "second")).await;
    assert_eq!(json(&second)["rev"], 2);
    // Another window, still on revision 1, and a retry of the write that made revision 2.
    let stale = send(&env, &a, "PUT", "/api/stickies/data", put(1, "stale")).await;
    assert_eq!(stale.status, 409, "a stale base is refused");
    assert_eq!(json(&stale)["rev"], 2, "and told the stored revision");
    let ahead = send(&env, &a, "PUT", "/api/stickies/data", put(7, "ahead")).await;
    assert_eq!(ahead.status, 409, "so is a base the server never had");
    let stored = json(&get(&env, &a, "/api/stickies/data").await);
    assert_eq!(stored["data"], notes("second"), "nothing was overwritten");
    assert_eq!(stored["rev"], 2);

    // Notes and Reminders keep their revisions the same way.
    let library =
        serde_json::json!({ "folders": [{ "id": "notes", "name": "Notes" }], "notes": [] });
    let body = |base: u64| serde_json::json!({ "base": base, "data": library });
    assert_eq!(
        send(&env, &a, "PUT", "/api/notes/data", body(0))
            .await
            .status,
        200
    );
    assert_eq!(
        send(&env, &a, "PUT", "/api/notes/data", body(0))
            .await
            .status,
        409
    );
    let body = |base: u64| serde_json::json!({ "base": base, "data": reminders(None, false), "alerts": {} });
    assert_eq!(
        send(&env, &a, "PUT", "/api/reminders/data", body(0))
            .await
            .status,
        200
    );
    assert_eq!(
        send(&env, &a, "PUT", "/api/reminders/data", body(0))
            .await
            .status,
        409
    );
    assert_eq!(json(&get(&env, &a, "/api/reminders/data").await)["rev"], 1);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn notes_keeps_each_sessions_folders_and_notes() {
    let env = boot().await;
    let a = browser(&env).await;
    let b = browser(&env).await;
    assert_eq!(
        json(&get(&env, &a, "/api/notes/data").await)["data"],
        serde_json::Value::Null
    );

    let data = serde_json::json!({
        "folders": [{ "id": "notes", "name": "Notes" }, { "id": "new-folder-1", "name": "Recipes" }],
        "notes": [{
            "id": "new-note-1", "folder": "new-folder-1", "lines": ["Pancakes", "Two eggs"],
            "date": "8:00 AM", "edited": "October 12, 2026 at 8:00 AM"
        }]
    });
    let saved = send(
        &env,
        &a,
        "PUT",
        "/api/notes/data",
        serde_json::json!({ "data": data }),
    )
    .await;
    assert_eq!(
        saved.status,
        200,
        "{}",
        String::from_utf8_lossy(&saved.body)
    );
    assert_eq!(json(&get(&env, &a, "/api/notes/data").await)["data"], data);
    assert_eq!(
        json(&get(&env, &b, "/api/notes/data").await)["data"],
        serde_json::Value::Null
    );

    // A note in a folder that is not there is refused, and nothing changes.
    let mut orphan = data.clone();
    orphan["folders"].as_array_mut().unwrap().truncate(1);
    assert_eq!(
        send(
            &env,
            &a,
            "PUT",
            "/api/notes/data",
            serde_json::json!({ "data": orphan })
        )
        .await
        .status,
        400
    );
    assert_eq!(json(&get(&env, &a, "/api/notes/data").await)["data"], data);
}

fn reminders(due: Option<&str>, completed: bool) -> serde_json::Value {
    let mut reminder =
        serde_json::json!({ "id": "new-1", "listId": "reminders", "title": "Pay rent" });
    if let Some(due) = due {
        reminder["due"] = due.into();
    }
    if completed {
        reminder["completed"] = true.into();
    }
    serde_json::json!({
        "lists": [{ "id": "reminders", "name": "Reminders", "color": "blue" }],
        "reminders": [reminder]
    })
}

async fn alert_ids(env: &TestEnv, token: &str) -> Vec<(String, u64)> {
    let reply = get(env, token, "/api/reminders/alerts").await;
    assert_eq!(reply.status, 200);
    json(&reply)["alerts"]
        .as_array()
        .unwrap()
        .iter()
        .map(|a| {
            (
                a["id"].as_str().unwrap().to_string(),
                a["at"].as_u64().unwrap(),
            )
        })
        .collect()
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_reminder_alert_fires_when_the_platform_clock_passes_it() {
    let env = boot().await;
    let a = browser(&env).await;
    let b = browser(&env).await;
    let at = START_MS + HOUR_MS; // 9:00
    let put = |data: serde_json::Value, alerts: serde_json::Value| serde_json::json!({ "data": data, "alerts": alerts });

    let saved = send(
        &env,
        &a,
        "PUT",
        "/api/reminders/data",
        put(
            reminders(Some("2026-10-12"), false),
            serde_json::json!({ "new-1": at }),
        ),
    )
    .await;
    assert_eq!(
        saved.status,
        200,
        "{}",
        String::from_utf8_lossy(&saved.body)
    );
    assert_eq!(
        json(&get(&env, &a, "/api/reminders/data").await)["data"],
        reminders(Some("2026-10-12"), false)
    );
    assert!(alert_ids(&env, &a).await.is_empty(), "not due before 9:00");

    crate::support::advance(&env, HOUR_MS - 1).await;
    assert!(
        alert_ids(&env, &a).await.is_empty(),
        "one millisecond early"
    );
    crate::support::advance(&env, 1).await;
    assert_eq!(
        alert_ids(&env, &a).await,
        vec![("new-1".to_string(), at)],
        "due at 9:00"
    );
    assert!(
        alert_ids(&env, &b).await.is_empty(),
        "another browser has no alert"
    );

    // Saving the same reminder again does not re-arm it.
    send(
        &env,
        &a,
        "PUT",
        "/api/reminders/data",
        put(
            reminders(Some("2026-10-12"), false),
            serde_json::json!({ "new-1": at }),
        ),
    )
    .await;
    assert_eq!(alert_ids(&env, &a).await.len(), 1);

    // A dismissal for another instant changes nothing; the right one ends the alert.
    let stale = send(
        &env,
        &a,
        "POST",
        "/api/reminders/alerts/new-1/dismiss",
        serde_json::json!({ "at": at + 1 }),
    )
    .await;
    assert_eq!(json(&stale)["dismissed"], false);
    assert_eq!(alert_ids(&env, &a).await.len(), 1);
    let dismissed = send(
        &env,
        &a,
        "POST",
        "/api/reminders/alerts/new-1/dismiss",
        serde_json::json!({ "at": at }),
    )
    .await;
    assert_eq!(json(&dismissed)["dismissed"], true);
    assert!(alert_ids(&env, &a).await.is_empty());
    send(
        &env,
        &a,
        "PUT",
        "/api/reminders/data",
        put(
            reminders(Some("2026-10-12"), false),
            serde_json::json!({ "new-1": at }),
        ),
    )
    .await;
    assert!(
        alert_ids(&env, &a).await.is_empty(),
        "a dismissed alert stays dismissed"
    );

    // Moving the alert to another instant arms it again.
    let later = START_MS + 26 * HOUR_MS; // 10:00 the next day
    send(
        &env,
        &a,
        "PUT",
        "/api/reminders/data",
        put(
            reminders(Some("2026-10-13"), false),
            serde_json::json!({ "new-1": later }),
        ),
    )
    .await;
    assert!(alert_ids(&env, &a).await.is_empty());
    crate::support::advance(&env, 25 * HOUR_MS).await;
    assert_eq!(
        alert_ids(&env, &a).await,
        vec![("new-1".to_string(), later)]
    );

    // A completed reminder has no alert, and cannot be given one.
    send(
        &env,
        &a,
        "PUT",
        "/api/reminders/data",
        put(reminders(Some("2026-10-13"), true), serde_json::json!({})),
    )
    .await;
    assert!(alert_ids(&env, &a).await.is_empty());
    let refused = send(
        &env,
        &a,
        "PUT",
        "/api/reminders/data",
        put(
            reminders(Some("2026-10-13"), true),
            serde_json::json!({ "new-1": later }),
        ),
    )
    .await;
    assert_eq!(refused.status, 400);
    // A reminder that is due and still to do must be given its alert.
    let unarmed = send(
        &env,
        &a,
        "PUT",
        "/api/reminders/data",
        put(reminders(Some("2026-10-13"), false), serde_json::json!({})),
    )
    .await;
    assert_eq!(unarmed.status, 400);
    let missing = send(
        &env,
        &a,
        "PUT",
        "/api/reminders/data",
        serde_json::json!({ "data": reminders(None, false) }),
    )
    .await;
    assert_eq!(missing.status, 400, "alerts is required");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn an_alert_for_an_instant_already_past_fires_at_once() {
    let env = boot().await;
    let a = browser(&env).await;
    let past = START_MS - HOUR_MS;
    let body = serde_json::json!({ "data": reminders(Some("2026-10-12"), false), "alerts": { "new-1": past } });
    let saved = send(&env, &a, "PUT", "/api/reminders/data", body).await;
    assert_eq!(
        saved.status,
        200,
        "{}",
        String::from_utf8_lossy(&saved.body)
    );
    assert_eq!(alert_ids(&env, &a).await, vec![("new-1".to_string(), past)]);
    assert_eq!(
        get(&env, &a, "/api/reminders/alerts/new-1/dismiss")
            .await
            .status,
        405
    );
    assert_eq!(get(&env, &a, "/api/reminders/nothing").await.status, 404);
}

// Lists shared between accounts.

const PEPPER: &str = "test-pepper-0123456789abcdef0123456789abcdef";
const SHARED: &str = "/api/reminders/shared";

/// The planes with the password pepper, so that accounts can be made.
async fn boot_accounts() -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let env = TestHarness::new()
        .with_queue("requests")
        .with_queue("replies")
        .with_store("data")
        .manual_clock(START_MS)
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

/// A new account, signed in: the token of its browser's session.
async fn account(env: &TestEnv, name: &str, full_name: &str) -> String {
    let token = browser(env).await;
    let body = serde_json::json!({ "name": name, "full_name": full_name, "password": "correct horse battery" });
    let mut req = ingress::request(
        "POST",
        "/api/session/sign-up",
        "",
        serde_json::to_vec(&body).unwrap(),
    );
    req.headers
        .push(("content-type".into(), "application/json".into()));
    let reply = call(env, with_cookie(req, &token)).await;
    assert_eq!(
        reply.status,
        201,
        "{}",
        String::from_utf8_lossy(&reply.body)
    );
    reply
        .headers
        .iter()
        .find(|(n, _)| n.eq_ignore_ascii_case("set-cookie"))
        .and_then(|(_, v)| v.split(';').next())
        .and_then(|pair| pair.strip_prefix("mac_session="))
        .map(str::to_string)
        .unwrap_or(token)
}

fn text(reply: &IngressReply) -> String {
    String::from_utf8_lossy(&reply.body).into_owned()
}

/// Groceries, with one reminder, as the person's own list.
fn groceries() -> serde_json::Value {
    serde_json::json!({
        "data": {
            "lists": [
                { "id": "reminders", "name": "Reminders", "color": "blue" },
                { "id": "groceries", "name": "Groceries", "color": "green" }
            ],
            "reminders": [
                { "id": "milk", "listId": "groceries", "title": "Milk" },
                { "id": "rent", "listId": "reminders", "title": "Pay rent" }
            ]
        },
        "alerts": {}
    })
}

/// Share the person's own Groceries with `people`: the shared list's id.
async fn share_groceries(env: &TestEnv, token: &str, people: &[&str]) -> String {
    let saved = send(env, token, "PUT", "/api/reminders/data", groceries()).await;
    assert_eq!(saved.status, 200, "{}", text(&saved));
    let shared = send(
        env,
        token,
        "POST",
        SHARED,
        serde_json::json!({ "list": "groceries", "people": people }),
    )
    .await;
    assert_eq!(shared.status, 201, "{}", text(&shared));
    json(&shared)["id"].as_str().expect("id").to_string()
}

async fn shared_lists(env: &TestEnv, token: &str) -> serde_json::Value {
    let reply = get(env, token, SHARED).await;
    assert_eq!(reply.status, 200, "{}", text(&reply));
    json(&reply)["lists"].clone()
}

/// Save shared list `id` with `reminders`, on revision `base`.
async fn put_shared(
    env: &TestEnv,
    token: &str,
    id: &str,
    base: u64,
    reminders: serde_json::Value,
) -> IngressReply {
    let body = serde_json::json!({
        "base": base,
        "data": { "lists": [{ "id": id, "name": "Groceries", "color": "green" }], "reminders": reminders }
    });
    send(env, token, "PUT", &format!("{SHARED}/{id}"), body).await
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_shared_list_is_changed_by_everyone_on_it_and_reached_by_nobody_else() {
    let env = boot_accounts().await;
    let chris = account(&env, "chris", "Chris Carter").await;
    let anna = account(&env, "anna", "Anna Berg").await;
    let ben = account(&env, "ben", "Ben Cole").await;
    let id = share_groceries(&env, &chris, &["anna"]).await;
    assert!(id.starts_with("sh-"), "{id}");

    // The list left Chris's own lists, its reminder with it; the rest stayed.
    let own = json(&get(&env, &chris, "/api/reminders/data").await);
    assert_eq!(
        own["data"]["lists"].as_array().map(Vec::len),
        Some(1),
        "{own}"
    );
    assert_eq!(own["data"]["reminders"][0]["id"], "rent", "{own}");

    // Anna has it, owned by Chris, and was told.
    let lists = shared_lists(&env, &anna).await;
    assert_eq!(lists[0]["name"], "Groceries", "{lists}");
    assert_eq!(lists[0]["owned"], false);
    assert_eq!(
        lists[0]["owner"],
        serde_json::json!({ "name": "chris", "full_name": "Chris Carter" })
    );
    assert_eq!(lists[0]["reminders"][0]["title"], "Milk");
    assert!(
        !lists.to_string().contains("\"u-"),
        "no account id: {lists}"
    );
    let told = json(&get(&env, &anna, "/api/notification-center/inbox").await);
    assert!(
        told.to_string()
            .contains("Chris Carter shared a list with you"),
        "{told}"
    );

    // Anna completes Milk and adds Eggs; Chris sees both.
    let rev = lists[0]["rev"].as_u64().expect("rev");
    let reminders = serde_json::json!([
        { "id": "milk", "listId": id, "title": "Milk", "completed": true },
        { "id": "eggs", "listId": id, "title": "Eggs" }
    ]);
    let saved = put_shared(&env, &anna, &id, rev, reminders.clone()).await;
    assert_eq!(saved.status, 200, "{}", text(&saved));
    let after = shared_lists(&env, &chris).await;
    assert_eq!(after[0]["reminders"], reminders, "{after}");
    assert_eq!(after[0]["owned"], true);
    // A save on the old revision is refused, and changes nothing.
    let stale = put_shared(&env, &chris, &id, rev, serde_json::json!([])).await;
    assert_eq!(stale.status, 409, "{}", text(&stale));
    assert_eq!(shared_lists(&env, &anna).await[0]["reminders"], reminders);

    // Ben reaches none of it.
    assert_eq!(shared_lists(&env, &ben).await, serde_json::json!([]));
    let path = format!("{SHARED}/{id}");
    for (method, route, body) in [
        (
            "PUT",
            path.clone(),
            serde_json::json!({ "base": rev + 1, "data": { "lists": [{ "id": id, "name": "Mine", "color": "red" }], "reminders": [] } }),
        ),
        ("POST", format!("{path}/leave"), serde_json::json!({})),
        ("POST", format!("{path}/stop"), serde_json::json!({})),
        (
            "POST",
            format!("{path}/people"),
            serde_json::json!({ "name": "ben" }),
        ),
        (
            "DELETE",
            format!("{path}/people/anna"),
            serde_json::json!({}),
        ),
    ] {
        let refused = send(&env, &ben, method, &route, body).await;
        assert_eq!(
            refused.status,
            404,
            "LEAK: Ben {method} {route}: {}",
            text(&refused)
        );
    }
    // Anna, who does not own it, adds nobody and stops nothing.
    let added = send(
        &env,
        &anna,
        "POST",
        &format!("{path}/people"),
        serde_json::json!({ "name": "ben" }),
    )
    .await;
    assert_eq!(added.status, 403, "{}", text(&added));
    let stopped = send(
        &env,
        &anna,
        "POST",
        &format!("{path}/stop"),
        serde_json::json!({}),
    )
    .await;
    assert_eq!(stopped.status, 403, "{}", text(&stopped));
    // Chris adds Ben, who then has it.
    let added = send(
        &env,
        &chris,
        "POST",
        &format!("{path}/people"),
        serde_json::json!({ "name": "ben" }),
    )
    .await;
    assert_eq!(added.status, 200, "{}", text(&added));
    assert_eq!(shared_lists(&env, &ben).await[0]["reminders"], reminders);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn anyone_leaves_a_shared_list_and_its_owner_takes_it_back() {
    let env = boot_accounts().await;
    let chris = account(&env, "chris", "Chris Carter").await;
    let anna = account(&env, "anna", "Anna Berg").await;
    let ben = account(&env, "ben", "Ben Cole").await;
    let id = share_groceries(&env, &chris, &["anna", "ben"]).await;
    let path = format!("{SHARED}/{id}");

    // Anna leaves: she has it no more, and Chris and Ben still do.
    let left = send(
        &env,
        &anna,
        "POST",
        &format!("{path}/leave"),
        serde_json::json!({}),
    )
    .await;
    assert_eq!(left.status, 200, "{}", text(&left));
    assert_eq!(shared_lists(&env, &anna).await, serde_json::json!([]));
    let lists = shared_lists(&env, &chris).await;
    assert_eq!(
        lists[0]["members"],
        serde_json::json!([{ "name": "ben", "full_name": "Ben Cole" }])
    );

    // Chris, the owner, takes Ben off and adds him back; then leaves, and Ben owns it.
    let off = send(
        &env,
        &chris,
        "DELETE",
        &format!("{path}/people/ben"),
        serde_json::json!({}),
    )
    .await;
    assert_eq!(off.status, 200, "{}", text(&off));
    assert_eq!(shared_lists(&env, &ben).await, serde_json::json!([]));
    let back = send(
        &env,
        &chris,
        "POST",
        &format!("{path}/people"),
        serde_json::json!({ "name": "ben" }),
    )
    .await;
    assert_eq!(back.status, 200, "{}", text(&back));
    let left = send(
        &env,
        &chris,
        "POST",
        &format!("{path}/leave"),
        serde_json::json!({}),
    )
    .await;
    assert_eq!(left.status, 200, "{}", text(&left));
    assert_eq!(shared_lists(&env, &chris).await, serde_json::json!([]));
    let lists = shared_lists(&env, &ben).await;
    assert_eq!(lists[0]["owned"], true, "{lists}");
    assert_eq!(lists[0]["members"], serde_json::json!([]));

    // Ben, alone on it, stops sharing it: it is one of his own lists again, with its reminder,
    // which takes an id of its own since one of Ben's own reminders has the one it had.
    let saved = send(&env, &ben, "PUT", "/api/reminders/data", groceries()).await;
    assert_eq!(saved.status, 200, "{}", text(&saved));
    let stopped = send(
        &env,
        &ben,
        "POST",
        &format!("{path}/stop"),
        serde_json::json!({}),
    )
    .await;
    assert_eq!(stopped.status, 200, "{}", text(&stopped));
    assert_eq!(shared_lists(&env, &ben).await, serde_json::json!([]));
    let own = json(&get(&env, &ben, "/api/reminders/data").await);
    let lists = own["data"]["lists"].as_array().expect("lists");
    assert!(lists.iter().any(|list| list["id"] == id.as_str()), "{own}");
    let back: Vec<&serde_json::Value> = own["data"]["reminders"]
        .as_array()
        .expect("reminders")
        .iter()
        .filter(|reminder| reminder["listId"] == id.as_str())
        .collect();
    assert_eq!(back.len(), 1, "{own}");
    assert_eq!(
        (back[0]["id"].as_str(), back[0]["title"].as_str()),
        (Some("milk-2"), Some("Milk"))
    );
    // The list is gone for everyone: nobody reaches it.
    let gone = send(
        &env,
        &chris,
        "POST",
        &format!("{path}/leave"),
        serde_json::json!({}),
    )
    .await;
    assert_eq!(gone.status, 404, "{}", text(&gone));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn only_an_account_shares_and_only_with_accounts_that_exist() {
    let env = boot_accounts().await;
    let chris = account(&env, "chris", "Chris Carter").await;
    let _anna = account(&env, "anna", "Anna Berg").await;
    let saved = send(&env, &chris, "PUT", "/api/reminders/data", groceries()).await;
    assert_eq!(saved.status, 200, "{}", text(&saved));
    for (list, people, status) in [
        ("groceries", serde_json::json!(["zed"]), 400),
        ("groceries", serde_json::json!(["chris"]), 400),
        ("groceries", serde_json::json!([]), 400),
        ("groceries", serde_json::json!(["anna", "anna"]), 400),
        ("no-such-list", serde_json::json!(["anna"]), 404),
    ] {
        let refused = send(
            &env,
            &chris,
            "POST",
            SHARED,
            serde_json::json!({ "list": list, "people": people }),
        )
        .await;
        assert_eq!(
            refused.status,
            status,
            "{list} {people}: {}",
            text(&refused)
        );
    }
    // Nothing moved.
    let own = json(&get(&env, &chris, "/api/reminders/data").await);
    assert_eq!(
        own["data"]["lists"].as_array().map(Vec::len),
        Some(2),
        "{own}"
    );
    // A browser nobody signed in to shares nothing and reads no shared list.
    let anonymous = browser(&env).await;
    let refused = send(
        &env,
        &anonymous,
        "POST",
        SHARED,
        serde_json::json!({ "list": "groceries", "people": ["anna"] }),
    )
    .await;
    assert_eq!(refused.status, 403, "{}", text(&refused));
    assert_eq!(
        json(&get(&env, &anonymous, SHARED).await),
        serde_json::json!({ "lists": [], "can_share": false, "me": null })
    );
}

async fn principal(env: &TestEnv, name: &str) -> String {
    macalicious_desktop::accounts::lookup(&mut env.store("data"), name)
        .await
        .expect("lookup")
        .expect("an account")
        .id
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_stop_cut_short_leaves_the_list_gone_and_its_places_free() {
    let env = boot_accounts().await;
    let chris = account(&env, "chris", "Chris Carter").await;
    let anna = account(&env, "anna", "Anna Berg").await;
    let id = share_groceries(&env, &chris, &["anna"]).await;
    let anna_id = principal(&env, "anna").await;
    // As if a Stop had marked the list and stopped before deleting anything.
    let key = format!("apps/reminders/shared/lists/{id}");
    let mut data = env.store("data");
    let bytes = data
        .get(key.as_bytes())
        .await
        .expect("get")
        .expect("the list");
    let mut doc: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    doc["stopped"] = true.into();
    data.put(key.as_bytes(), doc.to_string().as_bytes())
        .await
        .expect("put");
    // The list is gone for everyone, and every route says so, not that storage failed.
    assert_eq!(shared_lists(&env, &anna).await, serde_json::json!([]));
    let path = format!("{SHARED}/{id}");
    for (method, route) in [
        ("POST", format!("{path}/leave")),
        ("POST", format!("{path}/stop")),
    ] {
        let reply = send(&env, &chris, method, &route, serde_json::json!({})).await;
        assert_eq!(reply.status, 404, "{method} {route}: {}", text(&reply));
    }
    // Anna's index entry went with the read.
    let index = format!("apps/reminders/shared/members/{anna_id}/");
    let (rows, _) = data
        .scan_prefix(index.as_bytes(), None, 10)
        .await
        .expect("scan");
    assert!(rows.is_empty(), "{} entries left", rows.len());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn index_entries_of_lists_that_are_gone_hold_no_place() {
    let env = boot_accounts().await;
    let chris = account(&env, "chris", "Chris Carter").await;
    let anna = account(&env, "anna", "Anna Berg").await;
    let _ = &anna;
    let anna_id = principal(&env, "anna").await;
    // Twenty entries of lists that no longer exist, as requests cut short leave them.
    let mut data = env.store("data");
    for n in 0..20 {
        data.put(
            format!("apps/reminders/shared/members/{anna_id}/sh-{n:024x}").as_bytes(),
            b"1",
        )
        .await
        .expect("entry");
    }
    let id = share_groceries(&env, &chris, &["anna"]).await;
    let lists = shared_lists(&env, &anna).await;
    assert_eq!(lists.as_array().map(Vec::len), Some(1), "{lists}");
    assert_eq!(lists[0]["id"], id.as_str());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn an_entry_an_add_left_behind_goes_once_no_add_can_be_using_it() {
    let env = boot_accounts().await;
    let chris = account(&env, "chris", "Chris Carter").await;
    let _anna = account(&env, "anna", "Anna Berg").await;
    let ben = account(&env, "ben", "Ben Cole").await;
    let id = share_groceries(&env, &chris, &["anna"]).await;
    let ben_id = principal(&env, "ben").await;
    let anna_id = principal(&env, "anna").await;
    let mut data = env.store("data");
    let ben_key = format!("apps/reminders/shared/members/{ben_id}/{id}");
    let anna_key = format!("apps/reminders/shared/members/{anna_id}/{id}");
    let held = |bytes: Option<Vec<u8>>| bytes.is_some();

    // An entry for a list that does not name Ben, written just now: an add of his may still be
    // under way (it writes the entry before the change that names him), so it stays.
    data.put(ben_key.as_bytes(), START_MS.to_string().as_bytes())
        .await
        .expect("entry");
    assert_eq!(shared_lists(&env, &ben).await, serde_json::json!([]));
    assert!(held(data.get(ben_key.as_bytes()).await.expect("get")));

    // A minute on, no add can be using it: one that did not go through left it, and Ben's read
    // deletes it. Nothing of the list reached him either way.
    crate::support::advance(&env, 60_000).await;
    assert_eq!(shared_lists(&env, &ben).await, serde_json::json!([]));
    assert!(
        !held(data.get(ben_key.as_bytes()).await.expect("get")),
        "an entry an add left behind stays"
    );

    // One an earlier build left (it wrote `1`) goes at once.
    data.put(ben_key.as_bytes(), b"1").await.expect("entry");
    assert_eq!(shared_lists(&env, &ben).await, serde_json::json!([]));
    assert!(!held(data.get(ben_key.as_bytes()).await.expect("get")));

    // The entries of the people on the list stay, however old.
    assert_eq!(shared_lists(&env, &_anna).await[0]["id"], id.as_str());
    assert!(held(data.get(anna_key.as_bytes()).await.expect("get")));

    // An add that goes through writes the entry, and the list reaches Ben.
    let added = send(
        &env,
        &chris,
        "POST",
        &format!("{SHARED}/{id}/people"),
        serde_json::json!({ "name": "ben" }),
    )
    .await;
    assert_eq!(added.status, 200, "{}", text(&added));
    crate::support::advance(&env, 2 * 60_000).await;
    assert_eq!(shared_lists(&env, &ben).await[0]["id"], id.as_str());
    assert!(held(data.get(ben_key.as_bytes()).await.expect("get")));
}

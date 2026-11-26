//! Notes' password lock on the in-process Forge planes: what the server keeps of
//! a locked note, and how a late save is refused.

use ferrite_app::{serde_json, IngressReply, IngressRequest};
use ferrite_app_test::{ingress, TestEnv, TestHarness};
use serde_json::{json, Value};

async fn boot() -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let env = TestHarness::new()
        .with_queue("requests")
        .with_queue("replies")
        .with_store("data")
        .manual_clock(1_791_792_000_000)
        .build()
        .await;
    env.run_app(|ctx| async move { macalicious_desktop::run(ctx).await });
    crate::support::Env::new(env, slot)
}

async fn call(env: &TestEnv, req: IngressRequest) -> IngressReply {
    env.handle(req).await.expect("a reply")
}

fn body(reply: &IngressReply) -> Value {
    serde_json::from_slice(&reply.body)
        .unwrap_or_else(|e| panic!("{e}: {}", String::from_utf8_lossy(&reply.body)))
}

fn with_cookie(mut req: IngressRequest, token: &str) -> IngressRequest {
    req.headers
        .push(("cookie".into(), format!("mac_session={token}")));
    req
}

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

async fn data(env: &TestEnv, token: &str) -> Value {
    body(&call(env, with_cookie(ingress::get("/api/notes/data"), token)).await)
}

async fn put(env: &TestEnv, token: &str, path: &str, value: Value) -> IngressReply {
    let bytes = serde_json::to_vec(&value).unwrap();
    let mut req = ingress::request("PUT", path, "", bytes);
    req.headers
        .push(("content-type".into(), "application/json".into()));
    call(env, with_cookie(req, token)).await
}

fn envelope(ciphertext: &str) -> Value {
    json!({
        "kdf": {"name": "PBKDF2-SHA-256", "iterations": 100_000, "salt": "c2FsdHNhbHRzYWx0c2FsdA=="},
        "iv": "aXZpdml2aXZpdml2",
        "ciphertext": ciphertext,
    })
}

fn folders() -> Value {
    json!([{"id": "notes", "name": "Notes"}])
}

/// A session whose one plain note is `a`, holding the text "Bank PIN 4411".
async fn with_a_note(env: &TestEnv) -> String {
    let token = browser(env).await;
    let first = put(
        env,
        &token,
        "/api/notes/data",
        json!({"base": 0, "data": {"folders": folders(), "notes": [{
            "id": "a", "folder": "notes", "lines": ["Bank PIN 4411"],
            "html": "<b>Bank PIN 4411</b>", "date": "9:00 AM", "edited": "today",
        }]}}),
    )
    .await;
    assert_eq!(first.status, 200);
    token
}

async fn lock(env: &TestEnv, token: &str, ciphertext: &str) -> IngressReply {
    let base = data(env, token).await["rev"].clone();
    put(
        env,
        token,
        "/api/notes/locked",
        json!({"base": base, "changes": [{"id": "a", "rev": 0, "sealed": envelope(ciphertext)}]}),
    )
    .await
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn locking_leaves_only_ciphertext_on_the_server() {
    let env = boot().await;
    let token = with_a_note(&env).await;
    let locked = lock(&env, &token, "Y2lwaGVy").await;
    assert_eq!(locked.status, 200);
    assert_eq!(body(&locked)["notes"]["a"], 2);

    let stored = data(&env, &token).await;
    let note = &stored["data"]["notes"][0];
    assert_eq!(note["lines"], json!([]));
    assert_eq!(note["locked"], true);
    assert!(note.get("html").is_none());
    assert_eq!(note["sealed"]["ciphertext"], "Y2lwaGVy");
    assert_eq!(note["sealed"]["rev"], 2);
    assert!(!stored.to_string().contains("4411"));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_save_on_an_old_revision_is_refused_and_changes_nothing() {
    let env = boot().await;
    let token = with_a_note(&env).await;
    lock(&env, &token, "Y2lwaGVy").await;

    let first = put(
        &env,
        &token,
        "/api/notes/locked",
        json!({"changes": [{"id": "a", "rev": 2, "sealed": envelope("Zmlyc3Q=")}]}),
    )
    .await;
    assert_eq!(first.status, 200);
    assert_eq!(body(&first)["notes"]["a"], 3);

    let late = put(
        &env,
        &token,
        "/api/notes/locked",
        json!({"changes": [{"id": "a", "rev": 2, "sealed": envelope("bGF0ZQ==")}]}),
    )
    .await;
    assert_eq!(late.status, 409);
    assert_eq!(body(&late)["refused"], json!(["a"]));
    let stored = data(&env, &token).await;
    assert_eq!(
        stored["data"]["notes"][0]["sealed"]["ciphertext"],
        "Zmlyc3Q="
    );
    assert_eq!(stored["data"]["notes"][0]["sealed"]["rev"], 3);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_late_save_is_refused_after_the_lock_was_removed_and_made_again() {
    let env = boot().await;
    let token = with_a_note(&env).await;
    let held = body(&lock(&env, &token, "Y2lwaGVy").await)["notes"]["a"].clone();

    let freed = put(
        &env,
        &token,
        "/api/notes/locked",
        json!({"changes": [{"id": "a", "rev": held, "plain": {"lines": ["Rewritten"]}}]}),
    )
    .await;
    assert_eq!(freed.status, 200);
    let again = lock(&env, &token, "YWdhaW4=").await;
    assert_eq!(again.status, 200);
    assert_eq!(body(&again)["notes"]["a"], 4);

    let late = put(
        &env,
        &token,
        "/api/notes/locked",
        json!({"changes": [{"id": "a", "rev": held, "sealed": envelope("bGF0ZQ==")}]}),
    )
    .await;
    assert_eq!(late.status, 409);
    assert_eq!(body(&late)["refused"], json!(["a"]));
    assert_eq!(
        data(&env, &token).await["data"]["notes"][0]["sealed"]["ciphertext"],
        "YWdhaW4="
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_whole_document_save_cannot_undo_or_replace_a_lock() {
    let env = boot().await;
    let token = with_a_note(&env).await;
    lock(&env, &token, "Y2lwaGVy").await;
    let stored = data(&env, &token).await;
    let rev = stored["rev"].clone();

    let plain = put(
        &env,
        &token,
        "/api/notes/data",
        json!({"base": rev, "data": {"folders": folders(), "notes": [{
            "id": "a", "folder": "notes", "lines": ["Bank PIN 4411"], "date": "d", "edited": "e",
        }]}}),
    )
    .await;
    assert_eq!(plain.status, 400);
    assert!(!data(&env, &token).await.to_string().contains("4411"));

    // Its place in a folder and its pin are the document's to change.
    let mut moved = stored["data"].clone();
    moved["notes"][0]["pinned"] = json!(true);
    let pinned = put(
        &env,
        &token,
        "/api/notes/data",
        json!({"base": rev, "data": moved}),
    )
    .await;
    assert_eq!(pinned.status, 200);
    let after = data(&env, &token).await;
    assert_eq!(after["data"]["notes"][0]["pinned"], true);
    assert_eq!(
        after["data"]["notes"][0]["sealed"]["ciphertext"],
        "Y2lwaGVy"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn locking_needs_the_document_it_read() {
    let env = boot().await;
    let token = with_a_note(&env).await;
    let base = data(&env, &token).await["rev"].as_u64().unwrap();
    let stale = put(
        &env,
        &token,
        "/api/notes/locked",
        json!({"base": base - 1, "changes": [{"id": "a", "rev": 0, "sealed": envelope("Y2lwaGVy")}]}),
    )
    .await;
    assert_eq!(stale.status, 409);
    assert_eq!(
        data(&env, &token).await["data"]["notes"][0]["lines"],
        json!(["Bank PIN 4411"])
    );

    let gone = put(
        &env,
        &token,
        "/api/notes/locked",
        json!({"changes": [{"id": "nobody", "rev": 3, "sealed": envelope("Y2lwaGVy")}]}),
    )
    .await;
    assert_eq!(gone.status, 409);
    assert_eq!(body(&gone)["refused"], json!(["nobody"]));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn removing_a_lock_names_the_revision_and_brings_the_text_back() {
    let env = boot().await;
    let token = with_a_note(&env).await;
    lock(&env, &token, "Y2lwaGVy").await;
    let stale = put(
        &env,
        &token,
        "/api/notes/locked",
        json!({"changes": [{"id": "a", "rev": 9, "plain": {"lines": ["x"]}}]}),
    )
    .await;
    assert_eq!(stale.status, 409);
    let freed = put(
        &env,
        &token,
        "/api/notes/locked",
        json!({"changes": [{"id": "a", "rev": 2, "plain": {"lines": ["Back"], "html": "<b>Back</b>"}}]}),
    )
    .await;
    assert_eq!(freed.status, 200);
    let note = data(&env, &token).await["data"]["notes"][0].clone();
    assert_eq!(note["lines"], json!(["Back"]));
    assert_eq!(note["html"], "<b>Back</b>");
    assert!(note.get("sealed").is_none());
    assert!(note.get("locked").is_none());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_flag_with_no_password_behind_it_locks_nothing() {
    let env = boot().await;
    let token = browser(&env).await;
    let reply = put(
        &env,
        &token,
        "/api/notes/data",
        json!({"base": 0, "data": {"folders": folders(), "notes": [{
            "id": "old", "folder": "notes", "lines": ["Old"], "date": "d", "edited": "e", "locked": true,
        }]}}),
    )
    .await;
    assert_eq!(reply.status, 200);
    let note = data(&env, &token).await["data"]["notes"][0].clone();
    assert!(note.get("locked").is_none());
    assert_eq!(note["lines"], json!(["Old"]));
}

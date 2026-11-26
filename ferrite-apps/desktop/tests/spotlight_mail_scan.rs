//! Spotlight's search of Mail is bounded: it reads the newest `MAIL_HEADERS` headers and about
//! `MAIL_SCAN_BYTES` of them, however long the messages, and says how many of the newest
//! messages it searched and whether older ones were left, so the desktop can say so.

use ferrite_app::{serde_json, IngressReply, IngressRequest};
use ferrite_app_test::{ingress, TestEnv, TestHarness};

/// `MAIL_HEADERS` and `MAIL_SCAN_BYTES` in `src/apps/spotlight/index.rs`. The module is private
/// behind `src/apps/mod.rs`, so they are spelt out here: change both together.
const MAIL_HEADERS: usize = 200;
const MAIL_SCAN_BYTES: usize = 1024 * 1024;

async fn boot() -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let env = TestHarness::new()
        .with_queue("requests")
        .with_queue("replies")
        .with_store("data")
        .build()
        .await;
    env.run_app(|ctx| async move { macalicious_desktop::run(ctx).await });
    crate::support::Env::new(env, slot)
}

async fn call(env: &TestEnv, req: IngressRequest) -> IngressReply {
    env.handle(req).await.expect("a reply")
}

fn with_cookie(mut req: IngressRequest, token: &str) -> IngressRequest {
    req.headers
        .push(("cookie".into(), format!("mac_session={token}")));
    req
}

/// A new browser session's token.
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

/// A Mail header as Mail keeps it, in the Inbox, with `text` as the start of its text.
fn header(id: &str, subject: &str, text: &str) -> Vec<u8> {
    serde_json::to_vec(&serde_json::json!({
        "id": id,
        "mailbox": "inbox",
        "subject": subject,
        "from": { "name": "Ada", "address": "ada@example.test" },
        "to": [],
        "cc": [],
        "text": text,
        "at_ms": 1_700_000_000_000i64,
    }))
    .unwrap()
}

/// `count` messages in the person's Mail, newest first in key order, each with the subject
/// `note<n>` (four digits) and `text`; the bytes of one header.
async fn seed_mail(env: &TestEnv, token: &str, count: usize, text: &str) -> usize {
    let principal = macalicious_desktop::session::session_id(token);
    let mut store = env.store("data");
    let mut bytes = 0;
    for n in 0..count {
        let id = format!("m{n:04}");
        let value = header(&id, &format!("note{n:04}"), text);
        bytes = value.len();
        let key = format!("apps/mail/users/{principal}/m/{id}");
        store.put(key.as_bytes(), &value).await.unwrap();
    }
    bytes
}

/// The search reply for `query`, and the ids of the Mail messages it found.
async fn search(env: &TestEnv, token: &str, query: &str) -> (serde_json::Value, Vec<String>) {
    let reply = call(
        env,
        with_cookie(
            ingress::get(&format!("/api/spotlight/search?q={query}")),
            token,
        ),
    )
    .await;
    assert_eq!(
        reply.status,
        200,
        "{}",
        String::from_utf8_lossy(&reply.body)
    );
    let body: serde_json::Value = serde_json::from_slice(&reply.body).unwrap();
    let mail = body["results"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|result| result["kind"] == "mail")
        .map(|result| result["id"].as_str().unwrap_or_default().to_string())
        .collect();
    (body, mail)
}

/// The reply's account of the Mail searched: how many of the newest, and whether older ones
/// were left.
fn mail_searched(body: &serde_json::Value) -> (usize, bool) {
    let searched = body["searched_mail"]
        .as_u64()
        .unwrap_or_else(|| panic!("the reply says how much Mail was searched: {body}"));
    let left = body["unsearched_mail"]
        .as_bool()
        .unwrap_or_else(|| panic!("the reply says whether older Mail was left: {body}"));
    (searched as usize, left)
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn spotlight_reads_about_a_mebibyte_of_long_mail_and_says_older_messages_were_left() {
    let env = boot().await;
    let token = browser(&env).await;
    // 200 long messages in another script: 4,000 characters of three bytes each, some 12 KB a
    // header, 2.4 MB in all (and 4.8 MB where JSON writes six bytes a character).
    let size = seed_mail(&env, &token, MAIL_HEADERS, &"語".repeat(4_000)).await;
    assert!(size > 12_000 && MAIL_HEADERS * size > 2 * MAIL_SCAN_BYTES);

    let (body, found) = search(&env, &token, "note0199").await;
    assert!(
        found.is_empty(),
        "the oldest of 200 long messages lies past the bytes a search reads: {found:?}"
    );
    let (searched, left) = mail_searched(&body);
    assert!(left, "older messages were left, and the reply says so");
    // It stops within one header of the bytes, and not before.
    assert!(
        searched * size >= MAIL_SCAN_BYTES && (searched - 1) * size < MAIL_SCAN_BYTES,
        "{searched} headers of {size} bytes"
    );
    assert!(searched < MAIL_HEADERS);

    // The newest, and the last one read, are found.
    let (_, found) = search(&env, &token, "note0000").await;
    assert_eq!(found, ["m0000"]);
    let last = format!("note{:04}", searched - 1);
    let (_, found) = search(&env, &token, &last).await;
    assert_eq!(found, [format!("m{:04}", searched - 1)]);
    let next = format!("note{searched:04}");
    let (_, found) = search(&env, &token, &next).await;
    assert!(
        found.is_empty(),
        "the first header past the bytes is not read"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn spotlight_searches_every_message_of_a_short_mail_and_claims_nothing_left() {
    let env = boot().await;
    let token = browser(&env).await;
    seed_mail(&env, &token, 50, "See you at the lighthouse at noon.").await;
    let (body, found) = search(&env, &token, "note0049").await;
    assert_eq!(found, ["m0049"], "the oldest message is searched");
    assert_eq!(mail_searched(&body), (50, false));

    // Another session's search reads none of it, and says nothing was left.
    let other = browser(&env).await;
    let (body, found) = search(&env, &other, "note0049").await;
    assert!(found.is_empty());
    assert_eq!(mail_searched(&body), (0, false));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn spotlight_reads_the_newest_200_short_messages_and_says_older_ones_were_left() {
    let env = boot().await;
    let token = browser(&env).await;
    seed_mail(&env, &token, MAIL_HEADERS + 30, "Short.").await;
    let (body, found) = search(&env, &token, "note0199").await;
    assert_eq!(found, ["m0199"], "the 200th newest is searched");
    assert_eq!(mail_searched(&body), (MAIL_HEADERS, true));
    let (body, found) = search(&env, &token, "note0200").await;
    assert!(found.is_empty(), "the 201st is not");
    assert_eq!(mail_searched(&body), (MAIL_HEADERS, true));
}

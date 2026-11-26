//! Network fixtures: shared tests omit outbound bindings; `local-egress`
//! repeats them with Forge's deny-all policy. See tests/README.md.
//!
//! Books' shared text cache is bounded (`src/apps/books/text.rs`): it keeps at most
//! `MAX_CACHED_BOOKS` books and `MAX_CACHED_BYTES` bytes of their parts, and when an answer puts
//! it over either limit the books answered longest ago go whole, index and parts. These tests seed
//! the shared space with kept books and the cache's record, as a long-running desktop would have
//! them, then ask for a book. The harness's egress is deny-all, so a book that went is not served
//! from the cache any more: its source is asked, and refused.

use crate::egress_profile;

use ferrite_app::{serde_json, IngressReply};
use ferrite_app_test::{ingress, TestEnv, TestHarness};

/// `MAX_CACHED_BOOKS` and `MAX_CACHED_BYTES` of `src/apps/books/text.rs` (the module is private to
/// the crate): change them together.
const MAX_CACHED_BOOKS: usize = 200;
const MAX_CACHED_BYTES: u64 = 150_000_000;

const SHARED: &str = "apps/books/shared/";

async fn boot() -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let harness = TestHarness::new()
        .with_queue("requests")
        .with_queue("replies")
        .with_queue("live")
        .with_queue("frames")
        .with_store("data");
    #[cfg(feature = "local-egress")]
    let harness = harness.with_egress("books");
    let env = harness.build().await;
    env.run_app(|ctx| async move { macalicious_desktop::run(ctx).await });
    crate::support::Env::new(env, slot)
}

fn json(reply: &IngressReply) -> serde_json::Value {
    serde_json::from_slice(&reply.body)
        .unwrap_or_else(|e| panic!("{e}: {}", String::from_utf8_lossy(&reply.body)))
}

/// A kept book of one part, as `text.rs` keeps it; `bytes`: the bytes its index records (`None`
/// for an index kept before they were recorded).
async fn keep_book(env: &TestEnv, id: &str, bytes: Option<u64>) {
    let text = format!("CHAPTER I.\n\nThe text of {id}.");
    let mut index = serde_json::json!({
        "id": id, "source": "gutenberg", "credit": "Project Gutenberg",
        "licence": "Public domain in the USA.", "link": "https://www.gutenberg.org/",
        "parts": [text.encode_utf16().count()], "complete": true, "next": 0, "start": 0,
        "toc": [], "generations": [170], "seam_digest": "00", "seam": 1
    });
    if let Some(bytes) = bytes {
        index["bytes"] = bytes.into();
    }
    let mut store = env.store("data");
    for (key, value) in [
        (format!("text/{id}/index"), index.to_string()),
        (format!("text/{id}/g00000000000000aa/part/0"), text),
    ] {
        store
            .put(format!("{SHARED}{key}").as_bytes(), value.as_bytes())
            .await
            .unwrap();
    }
}

/// The cache's record: each book's bytes and last use.
async fn record(env: &TestEnv, books: &[(String, u64, u64)]) {
    let books: serde_json::Map<String, serde_json::Value> = books
        .iter()
        .map(|(id, bytes, used)| {
            (
                id.clone(),
                serde_json::json!({ "bytes": bytes, "used": used }),
            )
        })
        .collect();
    env.store("data")
        .put(
            format!("{SHARED}text/cache").as_bytes(),
            serde_json::json!({ "books": books }).to_string().as_bytes(),
        )
        .await
        .unwrap();
}

async fn kept(env: &TestEnv, key: &str) -> bool {
    env.store("data")
        .get(format!("{SHARED}{key}").as_bytes())
        .await
        .unwrap()
        .is_some()
}

async fn recorded(env: &TestEnv) -> serde_json::Value {
    let bytes = env
        .store("data")
        .get(format!("{SHARED}text/cache").as_bytes())
        .await
        .unwrap()
        .expect("the cache's record");
    serde_json::from_slice::<serde_json::Value>(&bytes).unwrap()["books"].clone()
}

async fn get(env: &TestEnv, path: &str) -> IngressReply {
    env.handle(ingress::get(path)).await.expect("a reply")
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_book_kept_before_the_heading_rules_has_its_contents_found_again_once() {
    let env = boot().await;
    let text = "The Title\n\nCHAPTER I.\nDown the Rabbit-Hole\n\nAlice was tired.";
    let index = serde_json::json!({
        "id": "pg-11", "source": "gutenberg", "credit": "Project Gutenberg",
        "licence": "Public domain in the USA.", "link": "https://www.gutenberg.org/",
        "parts": [text.encode_utf16().count()], "complete": true, "next": 0, "start": 0,
        "toc": [], "generations": [170], "seam_digest": "00", "seam": 1, "bytes": text.len()
    });
    let mut store = env.store("data");
    for (key, value) in [
        ("text/pg-11/index", index.to_string()),
        ("text/pg-11/g00000000000000aa/part/0", text.to_string()),
    ] {
        store
            .put(format!("{SHARED}{key}").as_bytes(), value.as_bytes())
            .await
            .unwrap();
    }

    let answered = json(&get(&env, "/api/books/text/pg-11").await);
    let expected = serde_json::json!([{"title": "CHAPTER I. Down the Rabbit-Hole", "at": 11}]);
    assert_eq!(answered["toc"], expected);
    assert!(answered.get("contents_current").is_none());

    // Saved, and not found again: with its part gone, the second answer still lists it.
    store
        .delete(format!("{SHARED}text/pg-11/g00000000000000aa/part/0").as_bytes())
        .await
        .unwrap();
    let again = json(&get(&env, "/api/books/text/pg-11").await);
    assert_eq!(again["toc"], expected);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn books_lets_go_of_the_book_used_longest_ago_when_the_cache_holds_too_many() {
    let env = boot().await;
    // A full cache: as many books as it keeps, the oldest used first.
    let full: Vec<(String, u64, u64)> = (1..=MAX_CACHED_BOOKS as u64)
        .map(|n| (format!("pg-{n}"), 1_000, n))
        .collect();
    record(&env, &full).await;
    keep_book(&env, "pg-1", Some(1_000)).await;
    keep_book(&env, "pg-2", Some(1_000)).await;
    // A book kept but not yet in the record: answering it adds one book too many.
    keep_book(&env, "pg-900", Some(1_000)).await;

    let reply = get(&env, "/api/books/text/pg-900").await;
    assert_eq!(
        reply.status,
        200,
        "{}",
        String::from_utf8_lossy(&reply.body)
    );
    assert_eq!(json(&reply)["id"], "pg-900");

    // The book used longest ago went whole; the next one stays.
    assert!(!kept(&env, "text/pg-1/index").await, "pg-1's index");
    assert!(
        !kept(&env, "text/pg-1/g00000000000000aa/part/0").await,
        "pg-1's part"
    );
    assert!(kept(&env, "text/pg-2/index").await, "pg-2 stays");
    assert!(
        kept(&env, "text/pg-900/index").await,
        "the book answered stays"
    );
    let books = recorded(&env).await;
    let books = books.as_object().unwrap();
    assert_eq!(books.len(), MAX_CACHED_BOOKS);
    assert!(books.contains_key("pg-900") && !books.contains_key("pg-1"));

    // Asked for again, the book that went is not served from the cache: its source is asked
    // (and the harness refuses it).
    let again = get(&env, "/api/books/text/pg-1").await;
    assert_eq!(
        again.status,
        egress_profile::FAILURE_STATUS,
        "{}",
        String::from_utf8_lossy(&again.body)
    );
    // The book answered is still served, without its source.
    assert_eq!(get(&env, "/api/books/text/pg-900/0").await.status, 200);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn books_lets_go_of_old_books_until_the_cache_holds_no_more_bytes_than_it_keeps() {
    let env = boot().await;
    let big = MAX_CACHED_BYTES * 2 / 3;
    let mid = MAX_CACHED_BYTES / 4;
    record(
        &env,
        &[
            ("pg-10".to_string(), big, 10),
            ("pg-11".to_string(), mid, 20),
        ],
    )
    .await;
    keep_book(&env, "pg-10", Some(big)).await;
    keep_book(&env, "pg-11", Some(mid)).await;
    // With this one the cache holds more bytes than it keeps.
    keep_book(&env, "pg-12", Some(MAX_CACHED_BYTES / 5)).await;

    assert_eq!(get(&env, "/api/books/text/pg-12").await.status, 200);
    assert!(!kept(&env, "text/pg-10/index").await, "the oldest goes");
    assert!(
        kept(&env, "text/pg-11/index").await,
        "that was enough: pg-11 stays"
    );
    let books = recorded(&env).await;
    let total: u64 = books
        .as_object()
        .unwrap()
        .values()
        .map(|book| book["bytes"].as_u64().unwrap())
        .sum();
    assert!(total <= MAX_CACHED_BYTES, "{total} bytes recorded");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn books_counts_a_book_kept_before_its_bytes_were_recorded_by_its_text() {
    let env = boot().await;
    keep_book(&env, "pg-11", None).await;
    assert_eq!(get(&env, "/api/books/text/pg-11").await.status, 200);
    let books = recorded(&env).await;
    let units = "CHAPTER I.\n\nThe text of pg-11.".encode_utf16().count() as u64;
    assert_eq!(books["pg-11"]["bytes"].as_u64(), Some(units));
    // Read again at once, the record is not written again: its use is less than a step old.
    let used = books["pg-11"]["used"].clone();
    assert_eq!(get(&env, "/api/books/text/pg-11/0").await.status, 200);
    assert_eq!(recorded(&env).await["pg-11"]["used"], used);
}

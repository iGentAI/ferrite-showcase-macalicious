//! The system apps of batch B16 on the in-process Forge planes
//! (`ferrite-app-test`): Spotlight's per-person index (the drive's files and
//! the words of its text files, Safari's bookmarks, kept current as the
//! documents change, and nothing of another person's), Storage Management's
//! report of the drive against its quota, Activity Monitor's Ferrite view,
//! and the request timing under it: a request's counted store handle
//! (`store.rs`) and the server time and store calls the router keeps in each
//! module's request counter (`timing.rs`).

use ferrite_app::{serde_json, IngressReply, IngressRequest};
use ferrite_app_test::{ingress, TestEnv, TestHarness};

async fn boot() -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let env = TestHarness::new()
        .with_blob("files")
        .with_queue("requests")
        .with_queue("replies")
        .with_queue("live")
        .with_queue("frames")
        .with_store("data")
        // Search over a drive of many files is the heaviest request in the suite; the hosted gate runs an
        // unoptimised build on few cores, where it took longer than the 15 s default (14 November).
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .await;
    env.run_app(|ctx| async move { macalicious_desktop::run(ctx).await });
    crate::support::Env::new(env, slot)
}

fn json(reply: &IngressReply) -> serde_json::Value {
    serde_json::from_slice(&reply.body)
        .unwrap_or_else(|e| panic!("{e}: {}", String::from_utf8_lossy(&reply.body)))
}

/// One browser: it keeps the session cookie it is given.
struct Browser {
    token: Option<String>,
}

impl Browser {
    async fn new(env: &TestEnv) -> Self {
        let mut browser = Browser { token: None };
        browser.send(env, ingress::get("/api/session")).await;
        assert!(browser.token.is_some(), "a new session sets its cookie");
        browser
    }

    async fn send(&mut self, env: &TestEnv, mut req: IngressRequest) -> IngressReply {
        if let Some(token) = &self.token {
            req.headers
                .push(("cookie".into(), format!("mac_session={token}")));
        }
        // A 503 whose message ends in "retry" is the app asking the browser to send again, which it does
        // (`demos/desktop/desktop-files.ts`): another delivery of the same request holds the piece, or the
        // drive was briefly unreachable. On the hosted gate's slow build the queue redelivers requests still
        // running after their visibility timeout, so these happen there (14 November). Bounded: 40 tries.
        let mut reply = env.handle(req.clone()).await.expect("a reply");
        for _ in 0..40 {
            if reply.status != 503 || !String::from_utf8_lossy(&reply.body).contains("retry") {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(250)).await;
            reply = env.handle(req.clone()).await.expect("a reply");
        }
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

    async fn get(&mut self, env: &TestEnv, path: &str) -> serde_json::Value {
        let reply = self.send(env, ingress::get(path)).await;
        assert_eq!(
            reply.status,
            200,
            "{path}: {}",
            String::from_utf8_lossy(&reply.body)
        );
        json(&reply)
    }

    async fn write(
        &mut self,
        env: &TestEnv,
        method: &str,
        path: &str,
        body: serde_json::Value,
    ) -> IngressReply {
        let mut req = ingress::request(method, path, "", body.to_string().as_bytes());
        req.headers
            .push(("content-type".into(), "application/json".into()));
        self.send(env, req).await
    }

    async fn ops(&mut self, env: &TestEnv, ops: serde_json::Value) {
        let reply = self
            .write(
                env,
                "POST",
                "/api/files/ops",
                serde_json::json!({ "ops": ops }),
            )
            .await;
        assert_eq!(
            reply.status,
            200,
            "{ops}: {}",
            String::from_utf8_lossy(&reply.body)
        );
    }

    /// Uploads `bytes` (one piece) as `name` into `parent`; answers the file id.
    async fn upload(
        &mut self,
        env: &TestEnv,
        parent: &str,
        name: &str,
        mime: &str,
        bytes: &[u8],
    ) -> String {
        let start = self
            .write(
                env,
                "POST",
                "/api/files/uploads",
                serde_json::json!({ "parent": parent, "name": name, "size": bytes.len(), "type": mime }),
            )
            .await;
        assert_eq!(
            start.status,
            201,
            "{}",
            String::from_utf8_lossy(&start.body)
        );
        let upload = json(&start)["upload"].as_str().unwrap().to_string();
        let mut piece =
            ingress::request("PUT", &format!("/api/files/uploads/{upload}/0"), "", bytes);
        piece
            .headers
            .push(("content-type".into(), "application/octet-stream".into()));
        let put = self.send(env, piece).await;
        assert_eq!(put.status, 200, "{}", String::from_utf8_lossy(&put.body));
        let done = self
            .write(
                env,
                "POST",
                &format!("/api/files/uploads/{upload}/complete"),
                serde_json::json!({}),
            )
            .await;
        assert_eq!(done.status, 200, "{}", String::from_utf8_lossy(&done.body));
        json(&done)["created"][0].as_str().unwrap().to_string()
    }

    async fn search(&mut self, env: &TestEnv, query: &str) -> Vec<serde_json::Value> {
        let found = self
            .get(
                env,
                &format!("/api/spotlight/search?q={}", query.replace(' ', "%20")),
            )
            .await;
        found["results"].as_array().unwrap().clone()
    }
}

/// The words Spotlight keeps, for everyone: its `text/` keys.
async fn kept_texts(env: &TestEnv) -> usize {
    let (rows, _) = env
        .store("data")
        .scan_prefix(b"apps/spotlight/users/", None, 1_000)
        .await
        .unwrap();
    rows.iter()
        .filter(|(key, _, _)| String::from_utf8_lossy(key).contains("/text/"))
        .count()
}

fn titles(results: &[serde_json::Value]) -> Vec<(String, String)> {
    results
        .iter()
        .map(|r| {
            (
                r["kind"].as_str().unwrap().to_string(),
                r["title"].as_str().unwrap().to_string(),
            )
        })
        .collect()
}

/// The request counter the router keeps for `name`, once it has counted at
/// least `requests` requests. The router publishes a reply before it writes
/// that request's count (`api_worker`), so a reply can reach the test before
/// its count reaches the store; this waits for the count on a bounded deadline.
async fn counter(env: &TestEnv, name: &str, requests: u64) -> macalicious_desktop::applog::Counts {
    let key = format!("{}{name}", macalicious_desktop::applog::REQUESTS_PREFIX);
    let mut store = env.store("data");
    let mut last = None;
    let counted = tokio::time::timeout(std::time::Duration::from_secs(10), async {
        loop {
            if let Some(bytes) = store.get(key.as_bytes()).await.unwrap() {
                let counts: macalicious_desktop::applog::Counts =
                    serde_json::from_slice(&bytes).unwrap();
                if counts.requests >= requests {
                    break counts;
                }
                last = Some(counts);
            }
            tokio::time::sleep(std::time::Duration::from_millis(25)).await;
        }
    })
    .await;
    counted.unwrap_or_else(|_| {
        panic!("the counter for {name} reaches {requests} requests within ten seconds: {last:?}")
    })
}

/// A counter's figures over all of its minutes.
fn figures(counts: &macalicious_desktop::applog::Counts) -> (u64, u64, u64) {
    counts.minutes.iter().fold((0, 0, 0), |(r, ops, err), m| {
        (r + m.requests(), ops + m.ops, err + m.errors)
    })
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_request_s_handle_counts_every_call_a_helper_makes_through_it() {
    use macalicious_desktop::store::{IntoStore, Store};
    use std::sync::atomic::{AtomicU64, Ordering};

    /// A helper that makes three calls through whatever handle it is given.
    async fn three_calls<'s>(store: impl IntoStore<'s>) -> std::io::Result<()> {
        let mut store = store.into_store();
        store.put(b"probe/a", b"1").await?;
        store.get(b"probe/a").await?;
        store.scan_prefix(b"probe/", None, 10).await?;
        Ok(())
    }

    let env = boot().await;
    let mut client = env.store("data");
    let calls = AtomicU64::new(0);
    let mut handle = Store::counted(&mut client, &calls);
    three_calls(&mut handle).await.unwrap();
    assert_eq!(
        calls.load(Ordering::Relaxed),
        3,
        "each of the helper's calls"
    );
    // A helper of the crate, given the same handle: the log's read is one page.
    macalicious_desktop::applog::recent(&mut handle, 5)
        .await
        .unwrap();
    assert_eq!(calls.load(Ordering::Relaxed), 4);
    // A handle reborrowed for a shorter while counts into the same counter.
    three_calls(handle.reborrow()).await.unwrap();
    assert_eq!(calls.load(Ordering::Relaxed), 7);
    // The plain client counts nothing.
    three_calls(&mut client).await.unwrap();
    assert_eq!(calls.load(Ordering::Relaxed), 7);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn the_router_keeps_each_request_s_store_calls_and_time_in_its_counter() {
    let env = boot().await;
    let mut a = Browser::new(&env).await;
    // An empty tape: each read is the clear floor and one page of the tape.
    for _ in 0..5 {
        a.get(&env, "/api/calculator/tape").await;
    }
    let reads = counter(&env, "calculator", 5).await;
    assert_eq!(reads.requests, 5);
    let (requests, ops, errors) = figures(&reads);
    assert_eq!((requests, ops, errors), (5, 10, 0), "{reads:?}");

    // A write counts the module's calls, its log entry's and its change
    // notification's.
    let wrote = a
        .write(
            &env,
            "POST",
            "/api/calculator/tape",
            serde_json::json!({ "expression": "1+2", "result": "3" }),
        )
        .await;
    assert_eq!(wrote.status, 201);
    let (requests, ops_after_write, _) = figures(&counter(&env, "calculator", 6).await);
    assert_eq!(requests, 6);
    assert_eq!(ops_after_write - ops, WRITE_CALLS);

    // A route the module does not have is timed and counted as an error, and
    // reads nothing.
    a.send(&env, ingress::get("/api/calculator/no-such-route"))
        .await;
    let (requests, ops_after_miss, errors) = figures(&counter(&env, "calculator", 7).await);
    assert_eq!((requests, errors), (7, 1));
    assert_eq!(ops_after_miss, ops_after_write);

    // A request the router answers itself is counted, not timed.
    a.get(&env, "/api/apps").await;
    let registry = counter(&env, "apps", 1).await;
    assert_eq!(registry.requests, 1);
    assert!(registry.minutes.is_empty(), "{registry:?}");
}

/// The store calls of one new tape entry: the module's own reads and writes
/// (its sequence number, the entry and the prune that keeps the tape short),
/// the log entry it writes, and the change notification the router makes.
const WRITE_CALLS: u64 = 10;

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_counter_stored_before_timing_keeps_its_totals() {
    let env = boot().await;
    let key = format!("{}calculator", macalicious_desktop::applog::REQUESTS_PREFIX);
    // A counter as the deployment before this one wrote it, and one with a
    // minute this build cannot read.
    for stored in [
        r#"{"requests":40,"writes":3,"errors":1,"first_ms":5,"last_ms":9}"#,
        r#"{"requests":40,"writes":3,"errors":1,"first_ms":5,"last_ms":9,"minutes":[{"minute":"?"}]}"#,
    ] {
        env.store("data")
            .put(key.as_bytes(), stored.as_bytes())
            .await
            .unwrap();
        let mut a = Browser::new(&env).await;
        a.get(&env, "/api/calculator/tape").await;
        let counts = counter(&env, "calculator", 41).await;
        assert_eq!(
            (
                counts.requests,
                counts.writes,
                counts.errors,
                counts.first_ms
            ),
            (41, 3, 1, 5),
            "{stored}"
        );
        assert_eq!(figures(&counts), (1, 2, 0), "{stored}");
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn spotlight_indexes_the_persons_files_words_and_bookmarks_and_follows_their_changes() {
    let env = boot().await;
    let mut a = Browser::new(&env).await;
    let mut b = Browser::new(&env).await;

    let garden = a
        .upload(
            &env,
            "documents",
            "garden.txt",
            "text/plain",
            b"Remember to plant the tulip bulbs before the first frost.",
        )
        .await;
    a.upload(
        &env,
        "pictures",
        "tulips.jpg",
        "image/jpeg",
        &[0xff, 0xd8, 0xff, 0xe0],
    )
    .await;

    // By the file's words: the detail shows them around the match.
    let found = a.search(&env, "bulbs").await;
    assert_eq!(titles(&found), [("files".into(), "garden.txt".into())]);
    assert_eq!(found[0]["app"], "finder");
    assert!(
        found[0]["detail"].as_str().unwrap().contains("tulip bulbs"),
        "{}",
        found[0]["detail"]
    );
    // By name, and by words and name together.
    assert_eq!(
        titles(&a.search(&env, "tulip").await),
        [
            ("files".to_string(), "tulips.jpg".to_string()),
            ("files".to_string(), "garden.txt".to_string()),
        ],
        "a title that starts with the word ranks first"
    );
    assert!(
        b.search(&env, "tulip").await.is_empty(),
        "another person finds nothing of this one's"
    );

    // A rename reaches the index at the next search; the Trash leaves it.
    a.ops(
        &env,
        serde_json::json!([{ "op": "rename", "id": garden, "name": "spring.txt" }]),
    )
    .await;
    assert_eq!(
        titles(&a.search(&env, "frost").await),
        [("files".into(), "spring.txt".into())]
    );
    a.ops(&env, serde_json::json!([{ "op": "trash", "id": garden }]))
        .await;
    assert!(
        a.search(&env, "frost").await.is_empty(),
        "the Trash is not searched"
    );
    assert_eq!(
        kept_texts(&env).await,
        0,
        "the words of a file in the Trash are forgotten"
    );

    // The other person's own file: each finds only their own.
    b.upload(
        &env,
        "documents",
        "orchard.txt",
        "text/plain",
        b"Prune the apple trees in late winter.",
    )
    .await;
    assert_eq!(
        titles(&b.search(&env, "apple").await),
        [("files".into(), "orchard.txt".into())]
    );
    assert!(a.search(&env, "apple").await.is_empty());
    assert!(b.search(&env, "tulip").await.is_empty());

    // Safari's bookmarks are found and open in Safari.
    let saved = a
        .write(
            &env,
            "PUT",
            "/api/safari/bookmarks",
            serde_json::json!({
                "favorites": [{ "title": "Tulip - Wikipedia", "url": "https://en.wikipedia.org/wiki/Tulip" }],
                "bookmarks": [],
                "rev": 0,
            }),
        )
        .await;
    assert_eq!(
        saved.status,
        200,
        "{}",
        String::from_utf8_lossy(&saved.body)
    );
    let web: Vec<serde_json::Value> = a
        .search(&env, "wikipedia tulip")
        .await
        .into_iter()
        .filter(|r| r["kind"] == "web")
        .collect();
    assert_eq!(web.len(), 1);
    assert_eq!(web[0]["app"], "safari");
    assert_eq!(web[0]["id"], "https://en.wikipedia.org/wiki/Tulip");
    assert!(
        b.search(&env, "wikipedia tulip").await.is_empty(),
        "another person finds nothing of this one's bookmarks"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn storage_management_reports_the_drive_against_its_quota() {
    let env = boot().await;
    let mut a = Browser::new(&env).await;
    let drive = a.get(&env, "/api/files/").await;
    let usage = a.get(&env, "/api/storage-management/usage").await;
    assert_eq!(
        usage["drive"]["quota"], drive["quota"],
        "Storage Management reports the drive's own quota"
    );
    assert_eq!(usage["drive"]["used"], 0);

    let photo = vec![7u8; 3_000];
    let picture = a
        .upload(&env, "pictures", "Beach.jpg", "image/jpeg", &photo)
        .await;
    a.upload(&env, "documents", "Plan.txt", "text/plain", b"plan")
        .await;
    a.ops(
        &env,
        serde_json::json!([{ "op": "copy", "id": picture, "parent": "documents" }]),
    )
    .await;
    let usage = a.get(&env, "/api/storage-management/usage").await;
    let drive = &usage["drive"];
    assert_eq!(drive["used"], 3_004, "a copy costs no more space");
    // About This Mac's Storage shows the same drive.
    let facts = a.get(&env, "/api/about-this-mac/facts").await;
    assert_eq!(facts["drive"]["used"], 3_004);
    assert_eq!(facts["drive"]["quota"], drive["quota"]);
    assert_eq!(facts["drive"]["available"], drive["available"]);
    assert_eq!(facts["drive"]["categories"], drive["categories"]);
    let category = |id: &str| {
        drive["categories"]
            .as_array()
            .unwrap()
            .iter()
            .find(|c| c["id"] == id)
            .cloned()
            .unwrap()
    };
    assert_eq!(category("photos")["bytes"], 3_000);
    assert_eq!(category("photos")["files"], 2);
    assert_eq!(category("documents")["bytes"], 4);
    assert_eq!(drive["files"][0]["size"], 3_000, "largest first");

    a.ops(&env, serde_json::json!([{ "op": "trash", "id": picture }]))
        .await;
    let trashed = a.get(&env, "/api/storage-management/usage").await;
    assert_eq!(trashed["drive"]["trash"]["items"], 1);
    assert_eq!(
        trashed["drive"]["used"], 3_004,
        "the copy outside the Trash keeps the content counted"
    );
    // Empty Trash goes through the drive's own route.
    a.ops(&env, serde_json::json!([{ "op": "empty-trash" }]))
        .await;
    let emptied = a.get(&env, "/api/storage-management/usage").await;
    assert_eq!(emptied["drive"]["trash"]["items"], 0);

    let mut b = Browser::new(&env).await;
    assert_eq!(
        b.get(&env, "/api/storage-management/usage").await["drive"]["used"],
        0,
        "another person's drive is their own"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn activity_monitor_shows_the_server_time_the_router_measured() {
    let env = boot().await;
    let mut a = Browser::new(&env).await;
    for _ in 0..5 {
        a.get(&env, "/api/calculator/tape").await;
    }
    a.send(&env, ingress::get("/api/calculator/no-such-route"))
        .await;
    // The router publishes each reply before it writes that request's count.
    counter(&env, "calculator", 6).await;
    let view = a.get(&env, "/api/activity-monitor/ferrite").await;
    assert_eq!(view["application"], "macalicious-desktop");
    let calculator = view["apps"]
        .as_array()
        .unwrap()
        .iter()
        .find(|app| app["name"] == "calculator")
        .cloned()
        .unwrap_or_else(|| panic!("no calculator in {view}"));
    assert_eq!(calculator["title"], "Calculator");
    assert_eq!(calculator["requests"], 6);
    assert_eq!(calculator["errors"], 1);
    assert!(calculator["p50_ms"].as_f64().unwrap() >= 0.0);
    assert!(calculator["p95_ms"].as_f64().unwrap() >= calculator["p50_ms"].as_f64().unwrap());
    assert_eq!(
        calculator["store_ops"], 10,
        "each tape read is the clear floor and one page: {calculator}"
    );
    assert_eq!(calculator["ops_per_request"], 1.67);
    // The view's own read is timed once it has answered.
    assert_eq!(view["total"]["requests"], 6);
    counter(&env, "activity-monitor", 1).await;
    let again = a.get(&env, "/api/activity-monitor/ferrite").await;
    assert_eq!(again["total"]["requests"], 7);
    let monitor = again["apps"]
        .as_array()
        .unwrap()
        .iter()
        .find(|app| app["name"] == "activity-monitor")
        .cloned()
        .unwrap_or_else(|| panic!("no activity-monitor in {again}"));
    assert_eq!(monitor["store_ops"], 1, "one page of counters");
    let post = a
        .write(
            &env,
            "POST",
            "/api/activity-monitor/ferrite",
            serde_json::json!({}),
        )
        .await;
    assert_eq!(post.status, 405);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_search_where_nothing_changed_makes_seven_store_calls() {
    let env = boot().await;
    let mut a = Browser::new(&env).await;
    a.upload(
        &env,
        "documents",
        "notes.txt",
        "text/plain",
        b"A quince tree by the gate.",
    )
    .await;
    // The first search reads the file and keeps its words.
    assert_eq!(a.search(&env, "quince").await.len(), 1);
    let (_, before, _) = figures(&counter(&env, "spotlight", 1).await);
    assert_eq!(a.search(&env, "quince").await.len(), 1);
    let (_, after, _) = figures(&counter(&env, "spotlight", 2).await);
    assert_eq!(
        after - before,
        7,
        "the documents, the kept words, Mail's first page, Find My's devices, the Chess games, FaceTime's recents and the Messages activity index"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_drive_of_many_text_files_is_searched_by_the_words_of_the_first_hundred() {
    let env = boot().await;
    let mut a = Browser::new(&env).await;
    for n in 0..105 {
        let text = format!("Entry {n} of the medlar ledger.");
        a.upload(
            &env,
            "documents",
            &format!("ledger {n:03}.txt"),
            "text/plain",
            text.as_bytes(),
        )
        .await;
    }
    // Twelve new files' words a search: nine searches read the first hundred.
    let mut indexing = true;
    for _ in 0..9 {
        let found = a.get(&env, "/api/spotlight/search?q=medlar").await;
        assert_eq!(found["unsearched_files"], 5, "{found}");
        indexing = found["indexing"].as_bool().unwrap();
    }
    assert!(!indexing, "every file the search reads has been read");
    let found = a.get(&env, "/api/spotlight/search?q=medlar").await;
    assert_eq!(
        found["results"].as_array().unwrap().len(),
        10,
        "one kind's most"
    );
    assert_eq!(found["truncated"], true);
    assert_eq!(kept_texts(&env).await, 100);
}

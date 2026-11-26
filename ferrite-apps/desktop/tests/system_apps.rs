//! Console, Activity Monitor, About This Mac and System Information on the
//! in-process Forge planes (`ferrite-app-test`): the router logs every write
//! and every failed request and counts every request per module, the boot
//! logs itself, a module writes its own entries, and the facts report what a
//! session keeps without any other session's data.

use ferrite_app::{serde_json, IngressReply, IngressRequest};
use ferrite_app_test::{ingress, TestEnv, TestHarness};

async fn boot() -> crate::support::Env {
    boot_with(TestHarness::new()).await
}

/// Boots with the `site` blob, into which the app publishes the packed desktop
/// at boot: only the test that reads that publication's log needs it.
async fn boot_with_site() -> crate::support::Env {
    boot_with(TestHarness::new().with_blob("site")).await
}

async fn boot_with(harness: TestHarness) -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let env = harness
        .with_queue("requests")
        .with_queue("replies")
        .with_queue("live")
        .with_queue("frames")
        .with_store("data")
        // The hosted gate's unoptimised build answers some requests here in more than the 15 s default
        // (14 November).
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

    async fn get(&mut self, env: &TestEnv, path: &str) -> serde_json::Value {
        let reply = self.send(env, ingress::get(path)).await;
        assert_eq!(
            reply.status,
            200,
            "GET {path}: {}",
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
}

/// The log's messages, oldest first.
async fn messages(browser: &mut Browser, env: &TestEnv) -> Vec<(String, String, String)> {
    browser.get(env, "/api/console/log").await["entries"]
        .as_array()
        .expect("entries")
        .iter()
        .map(|entry| {
            (
                entry["process"].as_str().unwrap().to_string(),
                entry["level"].as_str().unwrap().to_string(),
                entry["message"].as_str().unwrap().to_string(),
            )
        })
        .collect()
}

/// The counter named `name`, if any.
async fn counter(browser: &mut Browser, env: &TestEnv, name: &str) -> Option<serde_json::Value> {
    browser.get(env, "/api/activity-monitor/requests").await["counters"]
        .as_array()
        .expect("counters")
        .iter()
        .find(|counter| counter["name"] == name)
        .cloned()
}

/// The router publishes a reply before it counts and logs that request
/// (`api_worker`), so a reply can reach the test a moment before its count or
/// its log entry. These read again until it is there, on a bounded deadline.
const SETTLE: std::time::Duration = std::time::Duration::from_secs(10);

/// Activity Monitor's counter for `name`, once it has counted `requests`.
async fn counted(
    browser: &mut Browser,
    env: &TestEnv,
    name: &str,
    requests: u64,
) -> serde_json::Value {
    tokio::time::timeout(SETTLE, async {
        loop {
            if let Some(counter) = counter(browser, env, name).await {
                if counter["requests"].as_u64().unwrap() >= requests {
                    break counter;
                }
            }
            tokio::time::sleep(std::time::Duration::from_millis(25)).await;
        }
    })
    .await
    .unwrap_or_else(|_| panic!("{name} is counted {requests} times within ten seconds"))
}

/// The log's messages, once it holds each of `expected`.
async fn messages_with(
    browser: &mut Browser,
    env: &TestEnv,
    expected: &[&str],
) -> Vec<(String, String, String)> {
    tokio::time::timeout(SETTLE, async {
        loop {
            let log = messages(browser, env).await;
            if expected
                .iter()
                .all(|wanted| log.iter().any(|(_, _, message)| message == wanted))
            {
                break log;
            }
            tokio::time::sleep(std::time::Duration::from_millis(25)).await;
        }
    })
    .await
    .unwrap_or_else(|_| panic!("the log holds {expected:?} within ten seconds"))
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn console_shows_the_application_s_own_log() {
    let env = boot_with_site().await;
    let mut a = Browser::new();

    // The boot writes its entries in the background, beside the first requests.
    // Publication includes the full engine model. Wait for that observable
    // completion independently of request latency while other fixtures run.
    // 300 s: publishing the 68 MB packed site in the hosted gate's unoptimised build took over 120 s (14 November).
    let log = tokio::time::timeout(std::time::Duration::from_secs(300), async {
        loop {
            let log = messages(&mut a, &env).await;
            if log.iter().any(|(_, _, m)| m.contains("site build")) {
                break log;
            }
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        }
    })
    .await
    .expect("site publication completes and is logged within 300 seconds");
    assert!(
        log.iter().any(|(p, _, m)| p == "macalicious-desktop"
            && m.contains("started at deployment generation")),
        "{log:?}"
    );
    assert!(log
        .iter()
        .any(|(p, _, m)| p == "macalicious-desktop" && m.contains("site build sha256:")));
    let reads = log.len();
    assert!(
        !log.iter().any(|(_, _, m)| m.starts_with("GET ")),
        "successful reads are counted, not logged"
    );

    // A write is logged by the router under the module's name; the module
    // writes its own entry beside it.
    let put = a
        .write(
            &env,
            "POST",
            "/api/calculator/tape",
            serde_json::json!({ "expression": "12+3", "result": "15" }),
        )
        .await;
    assert_eq!(put.status, 201);
    let refused = a
        .write(
            &env,
            "PUT",
            "/api/launchpad/layout",
            serde_json::json!({ "order": "x" }),
        )
        .await;
    assert_eq!(refused.status, 400);
    let log = messages_with(
        &mut a,
        &env,
        &[
            "POST /api/calculator/tape answered 201",
            "PUT /api/launchpad/layout answered 400",
        ],
    )
    .await;
    assert!(log.len() >= reads + 3, "{log:?}");
    let tail: Vec<_> = log.iter().rev().take(3).rev().cloned().collect();
    assert_eq!(
        tail,
        vec![
            (
                "calculator".into(),
                "info".into(),
                "appended an entry to a session's paper tape".into()
            ),
            (
                "calculator".into(),
                "info".into(),
                "POST /api/calculator/tape answered 201".into()
            ),
            (
                "launchpad".into(),
                "default".into(),
                "PUT /api/launchpad/layout answered 400".into()
            ),
        ]
    );
    assert!(
        !log.iter().any(|(_, _, m)| m.contains("12+3")),
        "no entry carries what a person typed"
    );

    // Another browser reads the same log: it is the application's.
    let mut b = Browser::new();
    assert_eq!(messages(&mut b, &env).await.last(), log.last());
    let limited = b.get(&env, "/api/console/log?limit=2").await;
    assert_eq!(limited["entries"].as_array().unwrap().len(), 2);
    assert_eq!(
        a.send(
            &env,
            ingress::request("DELETE", "/api/console/log", "", b"")
        )
        .await
        .status,
        405
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn activity_monitor_counts_the_requests_the_router_answered() {
    let env = boot().await;
    let mut a = Browser::new();
    a.get(&env, "/api/launchpad/layout").await;
    a.get(&env, "/api/launchpad/layout").await;
    let missing = a.send(&env, ingress::get("/api/launchpad/nothing")).await;
    assert_eq!(missing.status, 404);
    let layout = counted(&mut a, &env, "launchpad", 3).await;
    assert_eq!(layout["title"], "Launchpad");
    assert_eq!(layout["requests"], 3);
    assert_eq!(layout["errors"], 1);
    assert_eq!(layout["writes"], 0);
    assert!(layout["last_ms"].as_u64().unwrap() >= layout["first_ms"].as_u64().unwrap());

    let put = a
        .write(
            &env,
            "PUT",
            "/api/launchpad/layout",
            serde_json::json!({ "order": [], "page": 0, "rev": 0 }),
        )
        .await;
    assert_eq!(put.status, 200);
    let layout = counted(&mut a, &env, "launchpad", 4).await;
    assert_eq!(
        (layout["requests"].as_u64(), layout["writes"].as_u64()),
        (Some(4), Some(1))
    );

    // Its own reads are counted too, and a name that is no module is not.
    let own = counted(&mut a, &env, "activity-monitor", 2).await;
    assert!(own["requests"].as_u64().unwrap() >= 2);
    assert_eq!(
        a.send(&env, ingress::get("/api/made-up/x")).await.status,
        404
    );
    assert!(counter(&mut a, &env, "made-up").await.is_none());

    // It is not counted, but a write or a failure to it is still logged,
    // under the application's own name.
    let posted = a
        .write(&env, "POST", "/api/made-up/x", serde_json::json!({}))
        .await;
    assert_eq!(posted.status, 404);
    let log = messages_with(
        &mut a,
        &env,
        &[
            "GET /api/made-up/x answered 404",
            "POST /api/made-up/x answered 404",
        ],
    )
    .await;
    let tail: Vec<_> = log.iter().rev().take(2).rev().cloned().collect();
    assert_eq!(
        tail,
        vec![
            (
                "macalicious-desktop".into(),
                "default".into(),
                "GET /api/made-up/x answered 404".into()
            ),
            (
                "macalicious-desktop".into(),
                "default".into(),
                "POST /api/made-up/x answered 404".into()
            ),
        ]
    );
    assert!(counter(&mut a, &env, "made-up").await.is_none());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn the_facts_report_the_deployment_and_this_session_s_storage() {
    let env = boot().await;
    let (mut a, mut b) = (Browser::new(), Browser::new());
    let put = a
        .write(
            &env,
            "PUT",
            "/api/launchpad/layout",
            serde_json::json!({ "order": ["notes"], "page": 0, "rev": 0 }),
        )
        .await;
    assert_eq!(put.status, 200);

    let facts = a.get(&env, "/api/about-this-mac/facts").await;
    assert_eq!(facts["application"], "macalicious-desktop");
    let runtime = ferrite_app::AppContext::new(env.payload().clone());
    assert_eq!(
        facts.get("generation"),
        Some(&serde_json::json!(runtime.generation())),
        "facts preserve the runtime's deployment generation"
    );
    assert_eq!(
        facts.get("instance"),
        Some(&serde_json::json!(runtime.instance())),
        "facts preserve the runtime's instance identity"
    );
    assert!(facts["build"].as_str().unwrap().starts_with("sha256:"));
    assert!(facts["now_ms"].as_u64().unwrap() > 0);
    let apps = facts["storage"]["apps"].as_array().unwrap();
    let launchpad = apps.iter().find(|app| app["name"] == "launchpad").unwrap();
    assert_eq!(launchpad["keys"], 1);
    assert!(launchpad["bytes"].as_u64().unwrap() > 0);
    assert_eq!(facts["storage"]["keys"], 1);
    assert_eq!(facts["storage"]["truncated"], false);
    assert_eq!(launchpad["truncated"], false);
    assert_eq!(apps.len(), facts["modules"].as_u64().unwrap() as usize);

    // Another session keeps nothing, and sees none of the first one's keys.
    let other = b.get(&env, "/api/about-this-mac/facts").await;
    assert_eq!(other["storage"]["keys"], 0);
    assert_eq!(other["storage"]["bytes"], 0);

    let report = a.get(&env, "/api/system-information/report").await;
    assert_eq!(report["facts"]["storage"]["keys"], 1);
    let modules: Vec<_> = report["modules"]
        .as_array()
        .unwrap()
        .iter()
        .map(|module| module["name"].as_str().unwrap().to_string())
        .collect();
    for name in [
        "console",
        "activity-monitor",
        "about-this-mac",
        "system-information",
    ] {
        assert!(modules.iter().any(|m| m == name), "{name} in {modules:?}");
    }
    assert!(report["counters"]
        .as_array()
        .unwrap()
        .iter()
        .any(|counter| counter["name"] == "launchpad"));
}

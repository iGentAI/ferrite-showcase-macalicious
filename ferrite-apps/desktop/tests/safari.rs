//! Network fixtures: shared tests omit outbound bindings; `local-egress`
//! repeats them with Forge's deny-all policy. See tests/README.md.
//!
//! Safari on the in-process Forge planes (`ferrite-app-test`). The harness's
//! egress is deny-all, so no page reaches the network here: these tests hold
//! what the module decides before and without the network (refusals of
//! schemes, private addresses and unlisted hosts; a listed page whose egress
//! is refused), the history and its search, the kept documents under the
//! revision rule and per session, and the agreement of `ferrite.json`'s `web`
//! egress with the module's list of sites. Real pages are fetched by the
//! browser journey (`e2e/safari-journey.mjs`) under `ferrite dev --egress
//! allow`.

use ferrite_app::{serde_json, IngressReply, IngressRequest};
use ferrite_app_test::{ingress, TestEnv, TestHarness};
use macalicious_desktop::apps::safari::policy;

async fn boot() -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let harness = TestHarness::new()
        .with_queue("requests")
        .with_queue("replies")
        .with_store("data");
    #[cfg(feature = "local-egress")]
    let harness = harness.with_egress("web");
    let env = harness.build().await;
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
    body: serde_json::Value,
) -> IngressReply {
    let mut req = ingress::request(method, path, "", serde_json::to_vec(&body).unwrap());
    req.headers
        .push(("content-type".into(), "application/json".into()));
    call(env, with_cookie(req, token)).await
}

fn ok(reply: &IngressReply) -> serde_json::Value {
    assert_eq!(
        reply.status,
        200,
        "{}",
        String::from_utf8_lossy(&reply.body)
    );
    json(reply)
}

fn encode(text: &str) -> String {
    policy::encode_component(text).replace('+', "%20")
}

#[test]
fn the_manifest_declares_exactly_the_resolver_the_listed_sites_and_their_picture_hosts() {
    let spec: serde_json::Value = serde_json::from_str(include_str!("../ferrite.json")).unwrap();
    // `web` is split into `web`, `web-2` to the platform's 16-destination
    // capability limit (`src/apps/egress.rs`); together they hold the list.
    let declared: Vec<&str> = spec["applications"][0]["egress"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|e| {
            let handle = e["handle"].as_str().unwrap_or("");
            handle == "web" || handle.starts_with("web-")
        })
        .flat_map(|e| e["destinations"].as_array().unwrap().iter())
        .map(|d| d.as_str().unwrap())
        .collect();
    assert!(!declared.is_empty(), "a web egress handle");
    let mut expected = vec![policy::RESOLVER.to_string()];
    expected.extend(
        policy::SITES
            .iter()
            .map(|site| format!("https://{}/", site.host)),
    );
    expected.extend(
        policy::ASSET_HOSTS
            .iter()
            .map(|host| format!("https://{host}/")),
    );
    assert_eq!(declared, expected);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn work_that_outlasts_its_budget_is_cut_off() {
    use macalicious_desktop::apps::safari::within;
    assert_eq!(within(5_000, async { 7 }).await, Some(7));
    let cut = tokio::time::timeout(
        tokio::time::Duration::from_secs(5),
        within(100, std::future::pending::<u8>()),
    )
    .await
    .expect("the budget ends work that never finishes");
    assert_eq!(cut, None);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn pages_are_refused_before_any_request_when_the_address_may_not_be_fetched() {
    let env = boot().await;
    let a = browser(&env).await;
    let sites = ok(&get(&env, &a, "/api/safari/sites").await);
    assert_eq!(
        sites["sites"].as_array().unwrap().len(),
        policy::SITES.len()
    );
    assert_eq!(
        sites["sites"][0]["url"],
        "https://en.wikipedia.org/wiki/Main_Page"
    );

    for (address, kind) in [
        ("http://169.254.169.254/latest/meta-data/", "private"),
        ("http://[::ffff:127.0.0.1]:8787/", "private"),
        ("http://2130706433/", "private"),
        ("http://localhost:8787/api/session", "private"),
        ("http://metadata.google.internal/", "private"),
        ("ftp://example.com/", "scheme"),
        ("javascript:alert(document.cookie)", "scheme"),
        ("file:///etc/passwd", "scheme"),
        ("https://user:secret@example.com/", "credentials"),
        ("https://example.com:8443/", "port"),
        ("https://8.8.8.8/", "not-listed"),
        // An unlisted name is not fetched: its name is looked up, and the
        // window offers it in a browser tab of the visitor's own.
        ("https://www.google.com/search?q=x", "not-listed"),
    ] {
        let reply = ok(&get(
            &env,
            &a,
            &format!("/api/safari/page?url={}", encode(address)),
        )
        .await);
        assert_eq!(reply["ok"], false, "{address}");
        assert_eq!(reply["kind"], kind, "{address}: {reply}");
        assert_eq!(reply["url"], address);
    }
    // An unlisted address literal needs no lookup (a private one was refused
    // above). An unlisted name is looked up first; the harness refuses the
    // resolver, so the page is still offered, marked as not checked.
    for (address, checked) in [
        ("https://8.8.8.8/", true),
        ("https://www.google.com/", false),
    ] {
        let reply = ok(&get(
            &env,
            &a,
            &format!("/api/safari/page?url={}", encode(address)),
        )
        .await);
        assert_eq!(
            (reply["kind"].as_str(), reply["checked"].as_bool()),
            (Some("not-listed"), Some(checked)),
            "{address}: {reply}"
        );
    }
    // A listed site, with egress refused by the harness: the DNS check cannot
    // run, so the page does not open, and nothing is added to the history.
    let reply = ok(&get(
        &env,
        &a,
        "/api/safari/page?url=https%3A%2F%2Fexample.com%2F",
    )
    .await);
    assert_eq!(
        (reply["ok"].as_bool(), reply["kind"].as_str()),
        (Some(false), Some("unreachable")),
        "{reply}"
    );
    let history = ok(&get(&env, &a, "/api/safari/history").await);
    assert_eq!(history["history"], serde_json::Value::Null);

    assert_eq!(get(&env, &a, "/api/safari/page").await.status, 400);
    assert_eq!(get(&env, &a, "/api/safari/page?url=%ZZ").await.status, 400);
    assert_eq!(
        send(&env, &a, "POST", "/api/safari/page", serde_json::json!({}))
            .await
            .status,
        405
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_file_is_downloaded_only_from_a_listed_site_and_refused_with_a_reason() {
    let env = boot().await;
    let a = browser(&env).await;
    for (address, kind) in [
        ("http://169.254.169.254/latest/meta-data/", "private"),
        ("file:///etc/passwd", "scheme"),
        ("https://user:secret@example.com/a.png", "credentials"),
        ("https://www.google.com/logo.png", "not-listed"),
        // A listed site with egress refused by the harness: nothing is fetched.
        (
            "https://www.gnu.org/graphics/gnu-head-mini.png",
            "unreachable",
        ),
    ] {
        let reply = ok(&get(
            &env,
            &a,
            &format!("/api/safari/file?url={}", encode(address)),
        )
        .await);
        assert_eq!(
            (reply["ok"].as_bool(), reply["kind"].as_str()),
            (Some(false), Some(kind)),
            "{address}: {reply}"
        );
        assert!(reply.get("data").is_none());
    }
    assert_eq!(get(&env, &a, "/api/safari/file").await.status, 400);
    assert_eq!(
        send(&env, &a, "POST", "/api/safari/file", serde_json::json!({}))
            .await
            .status,
        405
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn the_history_is_the_sessions_own_and_can_be_searched_and_forgotten() {
    let env = boot().await;
    let a = browser(&env).await;
    let b = browser(&env).await;
    for (url, title) in [
        (
            "https://en.wikipedia.org/wiki/MacOS_Catalina",
            "macOS Catalina - Wikipedia",
        ),
        ("https://www.example.org/", ""),
        (
            "https://en.wikipedia.org/wiki/MacOS_Catalina",
            "macOS Catalina - Wikipedia",
        ),
    ] {
        ok(&send(
            &env,
            &a,
            "POST",
            "/api/safari/history",
            serde_json::json!({ "url": url, "title": title }),
        )
        .await);
    }
    let all = ok(&get(&env, &a, "/api/safari/history").await);
    let visits = all["history"].as_array().unwrap();
    assert_eq!(visits.len(), 2);
    assert_eq!(visits[0]["count"], 2);
    assert_eq!(
        visits[1]["title"], "https://www.example.org/",
        "a live page without a title is named by its address"
    );
    let found = ok(&get(&env, &a, "/api/safari/history?q=catalina+WIKI").await);
    assert_eq!(found["history"].as_array().unwrap().len(), 1);
    assert_eq!(
        ok(&get(&env, &b, "/api/safari/history").await)["history"],
        serde_json::Value::Null,
        "another session sees nothing"
    );
    let refused = send(
        &env,
        &a,
        "POST",
        "/api/safari/history",
        serde_json::json!({ "url": "javascript:x" }),
    )
    .await;
    assert_eq!(refused.status, 400);
    ok(&send(
        &env,
        &a,
        "DELETE",
        "/api/safari/history",
        serde_json::json!({}),
    )
    .await);
    assert_eq!(
        ok(&get(&env, &a, "/api/safari/history").await)["history"],
        serde_json::Value::Null
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn bookmarks_reading_list_and_tabs_keep_the_revision_rule() {
    let env = boot().await;
    let a = browser(&env).await;
    let b = browser(&env).await;
    let empty = ok(&get(&env, &a, "/api/safari/bookmarks").await);
    assert_eq!(empty["rev"], 0);
    assert!(empty.get("favorites").is_none());
    let library = serde_json::json!({
        "favorites": [{ "title": "Wikipedia", "url": "https://en.wikipedia.org/wiki/Main_Page" }],
        "bookmarks": [{ "title": "Catalina", "url": "https://en.wikipedia.org/wiki/MacOS_Catalina" }],
        "rev": 0,
    });
    let saved = ok(&send(&env, &a, "PUT", "/api/safari/bookmarks", library.clone()).await);
    assert_eq!(saved["rev"], 1);
    let stale = send(&env, &a, "PUT", "/api/safari/bookmarks", library).await;
    assert_eq!(stale.status, 409, "a save on an old revision is refused");
    assert_eq!(json(&stale)["rev"], 1);
    let read = ok(&get(&env, &a, "/api/safari/bookmarks").await);
    assert_eq!(read["bookmarks"][0]["title"], "Catalina");
    assert!(read["session"].is_string());
    assert_eq!(
        ok(&get(&env, &b, "/api/safari/bookmarks").await)["rev"],
        0,
        "another session has its own"
    );
    let bad = serde_json::json!({ "favorites": [{ "title": "x", "url": "javascript:alert(1)" }], "bookmarks": [], "rev": 1 });
    assert_eq!(
        send(&env, &a, "PUT", "/api/safari/bookmarks", bad)
            .await
            .status,
        400
    );

    let list = serde_json::json!({ "items": [{ "title": "Later", "url": "https://text.npr.org/", "added": 5, "read": false }], "rev": 0 });
    assert_eq!(
        ok(&send(&env, &a, "PUT", "/api/safari/reading-list", list).await)["items"][0]["title"],
        "Later"
    );

    let tabs = serde_json::json!({ "tabs": ["", "https://example.com/"], "active": 1, "rev": 0 });
    assert_eq!(
        ok(&send(&env, &a, "PUT", "/api/safari/tabs", tabs).await)["active"],
        1
    );
    let bad_tabs = serde_json::json!({ "tabs": [""], "active": 3, "rev": 1 });
    assert_eq!(
        send(&env, &a, "PUT", "/api/safari/tabs", bad_tabs)
            .await
            .status,
        400
    );
    let forgotten = ok(&send(
        &env,
        &a,
        "DELETE",
        "/api/safari/tabs",
        serde_json::json!({}),
    )
    .await);
    assert_eq!(forgotten["rev"], 2);
    assert!(forgotten.get("tabs").is_none());
}

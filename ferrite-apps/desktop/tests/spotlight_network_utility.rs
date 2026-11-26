//! Network fixtures: shared tests omit outbound bindings; `local-egress`
//! repeats them with Forge's deny-all policy. See tests/README.md.
//!
//! Spotlight, Network Utility and Notification Center on the in-process Forge
//! planes (`ferrite-app-test`): Spotlight finds what one session saved in the
//! other apps and nothing of another session's, and bounds its query; Network
//! Utility refuses what is not a host, answers 502 when egress refuses the
//! resolver (the harness's egress is deny-all, so no lookup reaches the
//! network here), records nothing for a lookup that failed, and answers 503
//! when the application has no egress binding at all; Notification Center
//! keeps each session's own inbox, which its routes clear one, by app or all
//! at once, and refuse what cannot be shown. The apps not deployed on
//! Ferrite (`not-deployed.json`) are not in the catalogue.

use crate::egress_profile;

use ferrite_app::{serde_json, IngressReply, IngressRequest};
use ferrite_app_test::{ingress, TestEnv, TestHarness};

async fn boot(egress: bool) -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let harness = TestHarness::new()
        .with_queue("requests")
        .with_queue("replies")
        .with_store("data");
    #[cfg(feature = "local-egress")]
    let harness = if egress {
        harness.with_egress("dns")
    } else {
        harness
    };
    #[cfg(not(feature = "local-egress"))]
    assert!(!egress, "deny-all fixtures require --features local-egress");
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

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn spotlight_finds_what_the_session_saved_and_nothing_of_anothers() {
    let env = boot(false).await;
    let a = browser(&env).await;
    let b = browser(&env).await;
    const SEARCH: &str = "/api/spotlight/search";

    let before = ok(&get(&env, &a, &format!("{SEARCH}?q=ada")).await);
    assert_eq!(
        before["results"],
        serde_json::json!([]),
        "nothing saved yet"
    );

    let ada = serde_json::json!({
        "id": "card-ada", "account": "icloud", "first": "Ada", "last": "Lovelace",
        "emails": [{ "label": "work", "value": "ada@analytical.example" }],
    });
    ok(&send(
        &env,
        &a,
        "PUT",
        "/api/contacts/cards",
        serde_json::json!({ "cards": [ada], "rev": 0 }),
    )
    .await);
    let notes = serde_json::json!({ "notes": [
        { "id": "sticky-1", "color": "yellow", "text": "Call Ada\nabout the engine" },
        { "id": "sticky-2", "color": "blue", "text": "Buy milk" },
    ] });
    ok(&send(
        &env,
        &a,
        "PUT",
        "/api/stickies/data",
        serde_json::json!({ "base": 0, "data": notes }),
    )
    .await);

    let found = ok(&get(&env, &a, &format!("{SEARCH}?q=ADA")).await);
    assert_eq!(found["query"], "ADA");
    assert_eq!(found["truncated"], false);
    assert_eq!(
        found["results"],
        serde_json::json!([
            { "kind": "contacts", "app": "contacts", "id": "card-ada",
              "title": "Ada Lovelace", "detail": "ada@analytical.example",
              "lines": ["work ada@analytical.example"] },
            { "kind": "stickies", "app": "stickies", "id": "sticky-1",
              "title": "Call Ada", "detail": "about the engine" },
        ]),
        "contacts come before stickies, and Buy milk does not match"
    );
    let both = ok(&get(&env, &a, &format!("{SEARCH}?q=ada%20engine")).await);
    assert_eq!(
        both["results"].as_array().unwrap().len(),
        1,
        "every word must match"
    );
    let email = ok(&get(&env, &a, &format!("{SEARCH}?q=analytical")).await);
    assert_eq!(
        email["results"][0]["id"], "card-ada",
        "an email address is searched"
    );

    let other = ok(&get(&env, &b, &format!("{SEARCH}?q=ada")).await);
    assert_eq!(
        other["results"],
        serde_json::json!([]),
        "another session finds nothing of this one's"
    );

    let empty = ok(&get(&env, &a, SEARCH).await);
    assert_eq!(empty["results"], serde_json::json!([]));
    let many = get(&env, &a, &format!("{SEARCH}?q={}", "a+".repeat(9))).await;
    assert_eq!(many.status, 400, "more than eight words");
    let long = get(&env, &a, &format!("{SEARCH}?q={}", "a".repeat(201))).await;
    assert_eq!(long.status, 400, "more than 200 characters");
    let broken = get(&env, &a, &format!("{SEARCH}?q=%C3")).await;
    assert_eq!(broken.status, 400, "not UTF-8");
    let post = send(&env, &a, "POST", SEARCH, serde_json::json!({})).await;
    assert_eq!(post.status, 405);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn apps_not_deployed_on_ferrite_are_not_catalogued() {
    let env = boot(false).await;
    let a = browser(&env).await;
    let apps = ok(&get(&env, &a, "/api/apps").await);
    let catalogue: Vec<&str> = apps["catalogue"]
        .as_array()
        .expect("the catalogue")
        .iter()
        .filter_map(|app| app["id"].as_str())
        .collect();
    for id in ["airport-utility", "boot-camp-assistant", "disk-utility"] {
        assert!(
            !catalogue.contains(&id),
            "{id} is not in the catalogue: {catalogue:?}"
        );
    }
    for id in ["home", "network-utility"] {
        assert!(catalogue.contains(&id), "{id} is in the catalogue");
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn network_utility_refuses_non_hosts_and_reports_a_refused_resolver() {
    let env = boot(egress_profile::DENIED).await;
    let a = browser(&env).await;
    const LOOKUP: &str = "/api/network-utility/lookup";
    const HISTORY: &str = "/api/network-utility/history";

    for bad in [
        "",
        "exa%20mple.com",
        "2001%3Adb8%3A%3A1",
        "a%26type%3DMX",
        "%C3",
    ] {
        let reply = get(&env, &a, &format!("{LOOKUP}?host={bad}")).await;
        assert_eq!(
            reply.status,
            400,
            "{bad:?}: {}",
            String::from_utf8_lossy(&reply.body)
        );
    }

    // The harness's egress is deny-all: the resolver is refused, as it is
    // under `ferrite dev` without `--egress allow`.
    let refused = get(&env, &a, &format!("{LOOKUP}?host=example.com")).await;
    assert_eq!(
        refused.status,
        egress_profile::FAILURE_STATUS,
        "{}",
        String::from_utf8_lossy(&refused.body)
    );
    assert!(
        String::from_utf8_lossy(&refused.body).contains(if egress_profile::DENIED {
            "egress refused the resolver"
        } else {
            "no egress to the resolver"
        }),
        "{}",
        String::from_utf8_lossy(&refused.body)
    );
    let ptr = get(&env, &a, &format!("{LOOKUP}?host=192.0.2.1")).await;
    assert_eq!(
        ptr.status,
        egress_profile::FAILURE_STATUS,
        "an IPv4 address is asked, and refused the same way"
    );

    let history = ok(&get(&env, &a, HISTORY).await);
    assert_eq!(
        history["history"],
        serde_json::Value::Null,
        "a failed lookup is not kept"
    );
    let forgotten = send(&env, &a, "DELETE", HISTORY, serde_json::json!(null)).await;
    assert_eq!(
        forgotten.status,
        200,
        "{}",
        String::from_utf8_lossy(&forgotten.body)
    );
    let post = send(&env, &a, "POST", LOOKUP, serde_json::json!({})).await;
    assert_eq!(post.status, 405);
    let put = send(&env, &a, "PUT", HISTORY, serde_json::json!({})).await;
    assert_eq!(put.status, 405);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn network_utility_without_an_egress_binding_answers_503() {
    let env = boot(false).await;
    let a = browser(&env).await;
    let reply = get(&env, &a, "/api/network-utility/lookup?host=example.com").await;
    assert_eq!(
        reply.status,
        503,
        "{}",
        String::from_utf8_lossy(&reply.body)
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn notification_center_keeps_each_sessions_inbox_and_clears_it() {
    let env = boot(false).await;
    let a = browser(&env).await;
    let b = browser(&env).await;
    const INBOX: &str = "/api/notification-center/inbox";
    const NOTIFY: &str = "/api/notification-center/notify";
    assert_eq!(
        ok(&get(&env, &a, INBOX).await),
        serde_json::json!({ "items": [], "dnd": false })
    );
    let raise = |app: &str, title: &str| serde_json::json!({ "app": app, "title": title });
    for (app, title) in [("finder", "one"), ("finder", "two"), ("safari", "three")] {
        let reply = send(&env, &a, "POST", NOTIFY, raise(app, title)).await;
        assert_eq!(
            reply.status,
            201,
            "{}",
            String::from_utf8_lossy(&reply.body)
        );
    }
    let items = |body: serde_json::Value| -> Vec<(u64, String)> {
        body["items"]
            .as_array()
            .unwrap()
            .iter()
            .map(|i| {
                (
                    i["seq"].as_u64().unwrap(),
                    i["title"].as_str().unwrap().to_string(),
                )
            })
            .collect()
    };
    assert_eq!(
        items(ok(&get(&env, &a, INBOX).await)),
        [(3, "three".into()), (2, "two".into()), (1, "one".into())],
        "newest first"
    );
    assert_eq!(
        items(ok(&get(&env, &b, INBOX).await)),
        [],
        "another session's inbox is its own"
    );
    // Another session cannot clear what is not in its inbox.
    assert_eq!(
        ok(&send(
            &env,
            &b,
            "DELETE",
            &format!("{INBOX}/1"),
            serde_json::json!(null)
        )
        .await)["removed"],
        0
    );

    // Refused: what cannot be shown, and fields a page may not set.
    for bad in [
        raise("Not An App", "x"),
        raise("finder", "   "),
        serde_json::json!({ "app": "finder", "title": "x", "dismiss": "/a" }),
        serde_json::json!({ "app": "finder" }),
    ] {
        assert_eq!(
            send(&env, &a, "POST", NOTIFY, bad.clone()).await.status,
            400,
            "{bad}"
        );
    }
    assert_eq!(
        send(
            &env,
            &a,
            "DELETE",
            &format!("{INBOX}/x"),
            serde_json::json!(null)
        )
        .await
        .status,
        400
    );

    let one = send(
        &env,
        &a,
        "DELETE",
        &format!("{INBOX}/2"),
        serde_json::json!(null),
    )
    .await;
    assert_eq!(ok(&one)["removed"], 1);
    let group = send(
        &env,
        &a,
        "DELETE",
        &format!("{INBOX}?app=finder"),
        serde_json::json!(null),
    )
    .await;
    assert_eq!(ok(&group)["removed"], 1);
    assert_eq!(
        items(ok(&get(&env, &a, INBOX).await)),
        [(3, "three".into())]
    );
    let all = send(&env, &a, "DELETE", INBOX, serde_json::json!(null)).await;
    assert_eq!(ok(&all)["removed"], 1);

    // Do Not Disturb is the session's own too.
    let dnd = send(
        &env,
        &a,
        "PUT",
        "/api/notification-center/dnd",
        serde_json::json!({ "on": true }),
    )
    .await;
    assert_eq!(ok(&dnd)["dnd"], true);
    assert_eq!(ok(&get(&env, &a, INBOX).await)["dnd"], true);
    assert_eq!(ok(&get(&env, &b, INBOX).await)["dnd"], false);
    assert_eq!(
        send(
            &env,
            &a,
            "PUT",
            "/api/notification-center/dnd",
            serde_json::json!({ "on": 1 })
        )
        .await
        .status,
        400
    );
    assert_eq!(
        send(&env, &a, "POST", INBOX, serde_json::json!({}))
            .await
            .status,
        405
    );
    assert_eq!(
        get(&env, &a, "/api/notification-center/cleared")
            .await
            .status,
        404
    );
}

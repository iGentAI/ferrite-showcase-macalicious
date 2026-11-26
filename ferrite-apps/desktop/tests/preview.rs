use crate::support;

// Preview's server half (`src/apps/preview/`) on the in-process Forge planes
// (`ferrite-app-test`): a file's markup is kept beside it with the revision
// rule of `document.rs`, read back as written and forgotten on request; a
// stale save is refused with the current markup; markup the module cannot
// keep is refused before anything is stored; one person cannot read
// another's markup or signatures; and the count of files with markup is
// bounded per person.

use ferrite_app::{serde_json, Clock, IngressReply, IngressRequest};
use ferrite_app_test::{ingress, TestEnv, TestHarness};

async fn boot() -> crate::support::Env {
    boot_with_clock(Clock::real()).await
}

// A fixed clock isolates domain races from transport lease expiry. The harness's
// reply timeout still uses wall time, so a missing response cannot wait forever.
async fn boot_with_clock(clock: Clock) -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let env = TestHarness::new()
        .clock(clock)
        .with_blob("files")
        .with_queue("requests")
        .with_queue("replies")
        .with_queue("live")
        .with_queue("frames")
        .with_queue("timers")
        .with_store("data")
        .build()
        .await;
    env.run_app(|ctx| async move { macalicious_desktop::run(ctx).await });
    crate::support::Env::new(env, slot)
}

fn json(reply: &IngressReply) -> serde_json::Value {
    serde_json::from_slice(&reply.body)
        .unwrap_or_else(|e| panic!("{e}: {}", String::from_utf8_lossy(&reply.body)))
}

struct Browser {
    token: Option<String>,
}

impl Browser {
    fn new() -> Self {
        Browser { token: None }
    }

    /// A second tab of the same session.
    fn tab(&self) -> Self {
        Browser {
            token: self.token.clone(),
        }
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

    async fn get(&mut self, env: &TestEnv, path: &str) -> IngressReply {
        self.send(env, ingress::get(path)).await
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

fn markup() -> serde_json::Value {
    serde_json::json!({
        "rotation": 1,
        "pages": [{
            "page": 2,
            "items": [
                { "id": "r1", "kind": "rect", "color": "#ff3b30", "stroke": 0.004,
                  "x": 0.1, "y": 0.2, "w": 0.3, "h": 0.1 },
                { "id": "t1", "kind": "text", "color": "#000000", "stroke": 0.004,
                  "x": 0.5, "y": 0.5, "w": 0.2, "h": 0.03, "text": "Approved", "size": 0.03 },
                { "id": "s1", "kind": "signature", "color": "#000000", "stroke": 0.003,
                  "x": 0.6, "y": 0.8, "w": 0.3, "h": 0.1,
                  "strokes": [[[0.0, 0.5], [0.5, 0.0], [1.0, 1.0]]] }
            ]
        }]
    })
}

#[tokio::test]
async fn markup_is_kept_beside_a_file_with_the_revision_rule() {
    let env = boot().await;
    let mut ada = Browser::new();
    let path = "/api/preview/markup/f0123456789abcdef";

    let empty = ada.get(&env, path).await;
    assert_eq!(empty.status, 200);
    let body = json(&empty);
    assert!(body["markup"].is_null() && body["rev"] == 0, "{body}");
    assert!(body["session"].is_string());

    let saved = ada
        .put(
            &env,
            path,
            serde_json::json!({ "markup": markup(), "rev": 0 }),
        )
        .await;
    assert_eq!(
        saved.status,
        200,
        "{}",
        String::from_utf8_lossy(&saved.body)
    );
    assert_eq!(json(&saved)["rev"], 1);

    let read = json(&ada.get(&env, path).await);
    assert_eq!(read["markup"], markup());
    assert_eq!(read["rev"], 1);

    // A save based on an older revision changes nothing and answers the current markup.
    let stale = ada
        .put(
            &env,
            path,
            serde_json::json!({ "markup": { "rotation": 0, "pages": [] }, "rev": 0 }),
        )
        .await;
    assert_eq!(stale.status, 409);
    assert_eq!(json(&stale)["markup"], markup());

    // A delete names the revision it read: one from before the last save keeps the markup, and
    // one that names none is refused.
    let stale = ada.delete(&env, &format!("{path}?rev=0")).await;
    assert_eq!(stale.status, 409);
    assert_eq!(json(&stale)["markup"], markup());
    assert_eq!(ada.delete(&env, path).await.status, 400);
    assert_eq!(json(&ada.get(&env, path).await)["markup"], markup());

    let gone = ada.delete(&env, &format!("{path}?rev=1")).await;
    assert_eq!(gone.status, 200);
    let after = json(&ada.get(&env, path).await);
    assert!(after["markup"].is_null(), "{after}");
    assert_eq!(after["rev"], 2, "a delete takes the next revision");
}

#[tokio::test]
async fn markup_the_module_cannot_keep_is_refused_before_anything_is_stored() {
    let env = boot().await;
    let mut ada = Browser::new();
    let path = "/api/preview/markup/f1";
    let mut bad = markup();
    bad["pages"][0]["items"][0]["color"] = "red".into();
    let refused = ada
        .put(&env, path, serde_json::json!({ "markup": bad, "rev": 0 }))
        .await;
    assert_eq!(refused.status, 400);
    let mut script = markup();
    script["pages"][0]["items"][0]["onclick"] = "alert(1)".into();
    let refused = ada
        .put(
            &env,
            path,
            serde_json::json!({ "markup": script, "rev": 0 }),
        )
        .await;
    assert_eq!(refused.status, 400, "a field the module does not know");
    assert!(json(&ada.get(&env, path).await)["markup"].is_null());

    assert_eq!(
        ada.get(&env, "/api/preview/markup/a%2Fb").await.status,
        404,
        "an id that is not plain names no file"
    );
    assert_eq!(ada.get(&env, "/api/preview/elsewhere").await.status, 404);
    let mut post = ingress::request("POST", path, "", b"{}");
    post.headers
        .push(("content-type".into(), "application/json".into()));
    assert_eq!(ada.send(&env, post).await.status, 405);
}

#[tokio::test]
async fn where_each_file_was_left_is_kept_per_person_bounded_and_checked() {
    let env = boot().await;
    let mut ada = Browser::new();
    let mut bob = Browser::new();
    let path = "/api/preview/places";
    let place = |n: usize, page: u32| {
        serde_json::json!({
            "file": format!("f{n}"), "name": format!("Doc {n}.pdf"),
            "page": page, "zoom": 1.5625, "opened_ms": 1000 + n
        })
    };
    assert!(json(&ada.get(&env, path).await)["places"].is_null());
    let kept = ada
        .put(
            &env,
            path,
            serde_json::json!({ "places": [place(1, 3), place(2, 1)], "rev": 0 }),
        )
        .await;
    assert_eq!(kept.status, 200, "{}", String::from_utf8_lossy(&kept.body));
    let mine = json(&ada.get(&env, path).await);
    assert_eq!(mine["places"][0]["file"], "f1");
    assert_eq!(mine["places"][0]["page"], 3);
    assert_eq!(mine["places"][0]["zoom"], 1.5625);
    let rev = mine["rev"].as_u64().unwrap();

    // Another person sees none of them.
    assert!(json(&bob.get(&env, path).await)["places"].is_null());

    // A write from an older revision does not replace the newer one.
    let stale = ada
        .put(
            &env,
            path,
            serde_json::json!({ "places": [place(9, 1)], "rev": 0 }),
        )
        .await;
    assert_eq!(stale.status, 409);
    assert_eq!(json(&ada.get(&env, path).await)["places"][0]["file"], "f1");

    // What the module cannot keep is refused, and nothing changes.
    let many: Vec<serde_json::Value> = (0..21).map(|n| place(n, 1)).collect();
    let mut zero_zoom = place(1, 1);
    zero_zoom["zoom"] = 0.0.into();
    let mut nameless = place(1, 1);
    nameless["name"] = " ".into();
    let mut odd = place(1, 1);
    odd["file"] = "a/b".into();
    for (places, why) in [
        (serde_json::json!(many), "more than twenty"),
        (serde_json::json!([place(1, 0)]), "page 0"),
        (serde_json::json!([place(1, 5001)]), "past the last page"),
        (
            serde_json::json!([place(1, 1), place(1, 2)]),
            "one file twice",
        ),
        (serde_json::json!([zero_zoom]), "zoom 0"),
        (serde_json::json!([nameless]), "no name"),
        (serde_json::json!([odd]), "a file id that is not plain"),
    ] {
        let refused = ada
            .put(
                &env,
                path,
                serde_json::json!({ "places": places, "rev": rev }),
            )
            .await;
        assert_eq!(refused.status, 400, "{why}");
    }
    let after = json(&ada.get(&env, path).await);
    assert_eq!(after["places"].as_array().unwrap().len(), 2);
    assert_eq!(after["rev"].as_u64().unwrap(), rev);
}

#[tokio::test]
async fn one_person_cannot_read_anothers_markup_or_signatures() {
    let env = boot().await;
    let mut ada = Browser::new();
    let mut bob = Browser::new();
    let path = "/api/preview/markup/f42";
    assert_eq!(
        ada.put(
            &env,
            path,
            serde_json::json!({ "markup": markup(), "rev": 0 })
        )
        .await
        .status,
        200
    );
    let signatures = serde_json::json!({
        "signatures": [{ "id": "sig1", "aspect": 3.0, "strokes": [[[0.0, 0.0], [1.0, 1.0]]] }],
        "rev": 0
    });
    assert_eq!(
        ada.put(&env, "/api/preview/signatures", signatures)
            .await
            .status,
        200
    );
    assert!(json(&bob.get(&env, path).await)["markup"].is_null());
    assert!(json(&bob.get(&env, "/api/preview/signatures").await)["signatures"].is_null());
    let mine = json(&ada.get(&env, "/api/preview/signatures").await);
    assert_eq!(mine["signatures"][0]["id"], "sig1");

    let many: Vec<serde_json::Value> = (0..11)
        .map(|n| serde_json::json!({ "id": format!("s{n}"), "aspect": 2.0, "strokes": [[[0.5, 0.5]]] }))
        .collect();
    let refused = ada
        .put(
            &env,
            "/api/preview/signatures",
            serde_json::json!({ "signatures": many, "rev": 1 }),
        )
        .await;
    assert_eq!(refused.status, 400, "at most ten signatures");
}

#[tokio::test]
async fn the_files_with_markup_are_bounded_per_person() {
    // This checks the file quota, not transport lease expiry under a slow runner.
    let env = boot_with_clock(Clock::manual(1791979230000)).await;
    let mut ada = Browser::new();
    let small = serde_json::json!({ "rotation": 0, "pages": [] });
    for n in 0..1000 {
        let reply = ada
            .put(
                &env,
                &format!("/api/preview/markup/f{n}"),
                serde_json::json!({ "markup": small, "rev": 0 }),
            )
            .await;
        assert_eq!(
            reply.status,
            200,
            "file {n}: {}",
            String::from_utf8_lossy(&reply.body)
        );
    }
    let full = ada
        .put(
            &env,
            "/api/preview/markup/f1000",
            serde_json::json!({ "markup": small, "rev": 0 }),
        )
        .await;
    assert_eq!(full.status, 507);
    // A file that already has markup can still be saved.
    assert_eq!(
        ada.put(
            &env,
            "/api/preview/markup/f7",
            serde_json::json!({ "markup": markup(), "rev": 1 })
        )
        .await
        .status,
        200
    );
    // Forgetting one makes room for another.
    assert_eq!(
        ada.delete(&env, "/api/preview/markup/f3?rev=1")
            .await
            .status,
        200
    );
    assert_eq!(
        ada.put(
            &env,
            "/api/preview/markup/f1000",
            serde_json::json!({ "markup": small, "rev": 0 })
        )
        .await
        .status,
        200
    );
}

#[tokio::test]
async fn saves_that_store_nothing_leave_no_listing_behind() {
    let env = boot().await;
    let mut ada = Browser::new();
    let small = serde_json::json!({ "rotation": 0, "pages": [] });
    // A thousand saves of files that have no markup, each at a wrong revision.
    for n in 0..1000 {
        let reply = ada
            .put(
                &env,
                &format!("/api/preview/markup/g{n}"),
                serde_json::json!({ "markup": small, "rev": 5 }),
            )
            .await;
        assert_eq!(reply.status, 409, "file {n}");
    }
    // None of them holds a place: a real save still has room.
    assert_eq!(
        ada.put(
            &env,
            "/api/preview/markup/real",
            serde_json::json!({ "markup": small, "rev": 0 })
        )
        .await
        .status,
        200
    );
}

#[tokio::test]
async fn a_save_racing_a_delete_is_never_left_uncounted() {
    // Keep delivery leases fixed while the two tabs still execute concurrently.
    let env = boot_with_clock(Clock::manual(1791979230000)).await;
    let mut ada = Browser::new();
    let small = serde_json::json!({ "rotation": 0, "pages": [] });
    for n in 0..20 {
        let path = format!("/api/preview/markup/c{n}");
        let reply = ada
            .put(
                &env,
                &path,
                serde_json::json!({ "markup": small, "rev": 0 }),
            )
            .await;
        assert_eq!(
            reply.status,
            200,
            "file c{n}: {}",
            String::from_utf8_lossy(&reply.body)
        );
    }
    // Each file is deleted in one tab while another saves it at the delete's
    // revision (2): the save lands only after the delete, and must stay counted.
    for n in 0..20 {
        let path = format!("/api/preview/markup/c{n}");
        let mut one = ada.tab();
        let mut two = ada.tab();
        let body = serde_json::json!({ "markup": small, "rev": 2 });
        let stale_path = format!("{path}?rev=1");
        let _ = support::join(one.delete(&env, &stale_path), two.put(&env, &path, body)).await;
    }
    let mut live = 0;
    for n in 0..20 {
        let read = json(&ada.get(&env, &format!("/api/preview/markup/c{n}")).await);
        if !read["markup"].is_null() {
            live += 1;
        }
    }
    // Every file with markup holds a place: the others fill the rest exactly.
    let mut accepted = 0;
    for n in 0..1000 {
        let reply = ada
            .put(
                &env,
                &format!("/api/preview/markup/n{n}"),
                serde_json::json!({ "markup": small, "rev": 0 }),
            )
            .await;
        match reply.status {
            200 => accepted += 1,
            507 => break,
            other => panic!(
                "file n{n}: {other}: {}",
                String::from_utf8_lossy(&reply.body)
            ),
        }
    }
    assert_eq!(
        live + accepted,
        1000,
        "{live} live, {accepted} more accepted"
    );
}

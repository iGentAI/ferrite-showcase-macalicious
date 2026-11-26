//! TextEdit, Font Book and Help Viewer on the in-process Forge planes
//! (`ferrite-app-test`): each keeps its documents per browser session,
//! answers `null` until the session saves, refuses bad bodies and stale
//! revisions, and forgets on `DELETE`; Help Viewer serves its help book and
//! answers a search from it.

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

    /// The `GET` reply's body without its `session`.
    async fn get(&mut self, env: &TestEnv, path: &str) -> serde_json::Value {
        let reply = self.send(env, ingress::get(path)).await;
        assert_eq!(
            reply.status,
            200,
            "GET {path}: {}",
            String::from_utf8_lossy(&reply.body)
        );
        let mut body = json(&reply);
        if let Some(object) = body.as_object_mut() {
            object.remove("session");
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
async fn textedit_keeps_the_draft_and_the_saved_files_per_session() {
    let env = boot().await;
    let (mut a, mut b) = (Browser::new(), Browser::new());
    const DRAFT: &str = "/api/textedit/draft";
    const FILES: &str = "/api/textedit/files";
    assert_eq!(
        a.get(&env, DRAFT).await,
        serde_json::json!({ "draft": null, "rev": 0 })
    );
    assert_eq!(
        a.get(&env, FILES).await,
        serde_json::json!({ "files": null, "rev": 0 })
    );

    let letter = serde_json::json!({
        "name": "Letter", "format": "rich", "lines": ["Dear Ada,"],
        "html": "<div><b>Dear Ada,</b></div>",
        "ruler": { "first": 0.0, "head": 0.0, "tail": 0.0, "tabStops": [72.0] },
        "edited": true,
    });
    let put = a
        .put(
            &env,
            DRAFT,
            serde_json::json!({ "draft": letter, "rev": 0 }),
        )
        .await;
    assert_eq!(put.status, 200, "{}", String::from_utf8_lossy(&put.body));
    assert_eq!(json(&put)["rev"], 1);
    assert_eq!(
        a.get(&env, DRAFT).await,
        serde_json::json!({ "draft": letter, "rev": 1 })
    );
    // Another browser has its own session and no draft.
    assert_eq!(b.get(&env, DRAFT).await["draft"], serde_json::Value::Null);

    // A save based on an old revision changes nothing and gets the current draft.
    let stale = a
        .put(
            &env,
            DRAFT,
            serde_json::json!({ "draft": letter, "rev": 0 }),
        )
        .await;
    assert_eq!(stale.status, 409);
    assert_eq!(json(&stale)["rev"], 1);
    // A draft must say whether it is edited, and plain text has no formats.
    let mut unsaid = letter.clone();
    unsaid.as_object_mut().unwrap().remove("edited");
    let refused = a
        .put(
            &env,
            DRAFT,
            serde_json::json!({ "draft": unsaid, "rev": 1 }),
        )
        .await;
    assert_eq!(refused.status, 400);
    let mut plain = letter.clone();
    plain["format"] = "plain".into();
    let refused = a
        .put(&env, DRAFT, serde_json::json!({ "draft": plain, "rev": 1 }))
        .await;
    assert_eq!(refused.status, 400);

    let files = serde_json::json!([
        { "place": "documents", "folders": [],
          "file": { "id": "folder-1", "name": "untitled folder", "kind": "folder" } },
        { "place": "documents", "folders": ["folder-1"],
          "file": { "id": "saved-documents/folder-1/Notes", "name": "Notes", "kind": "document",
                    "detail": "Plain Text Document",
                    "document": { "name": "Notes", "format": "plain", "lines": ["Milk"] } } },
    ]);
    let put = a
        .put(&env, FILES, serde_json::json!({ "files": files, "rev": 0 }))
        .await;
    assert_eq!(put.status, 200, "{}", String::from_utf8_lossy(&put.body));
    assert_eq!(
        a.get(&env, FILES).await,
        serde_json::json!({ "files": files, "rev": 1 })
    );
    let draftless = serde_json::json!([{ "place": "documents", "folders": [],
        "file": { "id": "x", "name": "x", "kind": "document" } }]);
    let refused = a
        .put(
            &env,
            FILES,
            serde_json::json!({ "files": draftless, "rev": 1 }),
        )
        .await;
    assert_eq!(refused.status, 400, "a document without its text");

    assert_eq!(a.delete(&env, DRAFT).await.status, 200);
    assert_eq!(
        a.get(&env, DRAFT).await,
        serde_json::json!({ "draft": null, "rev": 2 })
    );
    assert_eq!(a.get(&env, FILES).await["rev"], 1, "the files are kept");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn font_book_keeps_collections_and_disabled_fonts_per_session() {
    let env = boot().await;
    let (mut a, mut b) = (Browser::new(), Browser::new());
    const URL: &str = "/api/font-book/library";
    assert_eq!(
        a.get(&env, URL).await,
        serde_json::json!({ "collections": null, "disabled": null, "rev": 0 })
    );
    let library = serde_json::json!({
        "collections": [{ "id": "collection-1", "name": "New Collection", "families": [] }],
        "disabled": ["verdana"],
    });
    let mut body = library.clone();
    body["rev"] = 0.into();
    let put = a.put(&env, URL, body).await;
    assert_eq!(put.status, 200, "{}", String::from_utf8_lossy(&put.body));
    let mut expected = library.clone();
    expected["rev"] = 1.into();
    assert_eq!(a.get(&env, URL).await, expected);
    assert_eq!(b.get(&env, URL).await["disabled"], serde_json::Value::Null);

    let refused = a
        .put(
            &env,
            URL,
            serde_json::json!({ "collections": [], "disabled": ["a/b"], "rev": 1 }),
        )
        .await;
    assert_eq!(refused.status, 400);
    let stale = a
        .put(
            &env,
            URL,
            serde_json::json!({ "collections": [], "disabled": [], "rev": 0 }),
        )
        .await;
    assert_eq!(stale.status, 409);
    assert_eq!(json(&stale)["disabled"], serde_json::json!(["verdana"]));
    assert_eq!(a.delete(&env, URL).await.status, 200);
    assert_eq!(
        a.get(&env, URL).await["collections"],
        serde_json::Value::Null
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn help_viewer_serves_its_book_searches_it_and_keeps_the_place() {
    let env = boot().await;
    let mut a = Browser::new();
    let books = a.get(&env, "/api/help-viewer/books").await;
    let book = &books["books"][0];
    assert_eq!(book["title"], "Macalicious Desktop Help");
    assert!(book["topics"].as_array().unwrap().len() >= 5);

    let found = a
        .send(&env, ingress::get("/api/help-viewer/search?q=font+book"))
        .await;
    assert_eq!(
        found.status,
        200,
        "{}",
        String::from_utf8_lossy(&found.body)
    );
    let found = json(&found);
    assert_eq!(found["query"], "font book");
    assert_eq!(found["results"][0]["id"], "desktop-font-book");
    assert_eq!(found["results"][0]["source"], "Macalicious Desktop Help");
    let none = a
        .send(&env, ingress::get("/api/help-viewer/search?q=zeppelin"))
        .await;
    assert_eq!(json(&none)["results"], serde_json::json!([]));
    let bad = a
        .send(&env, ingress::get("/api/help-viewer/search?q=%FF"))
        .await;
    assert_eq!(bad.status, 400);
    let wordy = a
        .send(
            &env,
            ingress::get("/api/help-viewer/search?q=one+two+three+four+five+six+seven+eight+nine"),
        )
        .await;
    assert_eq!(wordy.status, 400, "more than eight words");

    const PLACE: &str = "/api/help-viewer/place";
    assert_eq!(
        a.get(&env, PLACE).await,
        serde_json::json!({ "page": null, "rev": 0 })
    );
    let put = a
        .put(
            &env,
            PLACE,
            serde_json::json!({ "page": "server:desktop-font-book", "rev": 0 }),
        )
        .await;
    assert_eq!(put.status, 200);
    assert_eq!(
        a.get(&env, PLACE).await,
        serde_json::json!({ "page": "server:desktop-font-book", "rev": 1 })
    );
    let refused = a
        .put(&env, PLACE, serde_json::json!({ "page": "", "rev": 1 }))
        .await;
    assert_eq!(refused.status, 400);
}

//! Write ids on the document routes (`src/apps/document.rs`), on the in-process
//! Forge planes: a page whose reply was lost asks by its save's id whether the
//! document holds it. A save with no id, and a document stored before ids, go on
//! working, and the ids outlive what other clients save on top.

use ferrite_app::{serde_json, IngressReply};
use ferrite_app_test::{ingress, TestEnv, TestHarness};
use serde_json::{json, Value};

const PEPPER: &str = "test-pepper-0123456789abcdef0123456789abcdef";
const URL: &str = "/api/launchpad/layout";

/// The gateway passes a route only the headers the manifest lists, and these tests call the routes
/// past it: without these two, a deployed page's saves have no id and nobody is named to it.
#[test]
fn the_manifest_forwards_the_write_id_and_the_person() {
    let manifest: Value =
        serde_json::from_str(include_str!("../ferrite.json")).expect("ferrite.json is JSON");
    let api = manifest["applications"][0]["routes"]
        .as_array()
        .and_then(|routes| routes.iter().find(|route| route["prefix"] == "/api/"))
        .expect("the manifest routes /api/");
    for header in ["x-macalicious-write", "x-macalicious-person"] {
        assert!(
            api["forward_headers"]
                .as_array()
                .is_some_and(|all| all.iter().any(|each| each == header)),
            "{header} is not forwarded"
        );
    }
}

async fn boot() -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let env = TestHarness::new()
        .with_queue("requests")
        .with_queue("replies")
        .with_queue("live")
        .with_queue("frames")
        .stream_requests("live")
        .with_store("data")
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

struct Browser {
    token: Option<String>,
    url: &'static str,
}

impl Browser {
    async fn send(
        &mut self,
        env: &TestEnv,
        method: &str,
        body: Option<&Value>,
        write: Option<&str>,
    ) -> IngressReply {
        let bytes = body.map(Value::to_string).unwrap_or_default();
        let mut req = ingress::request(method, self.url, "", bytes.as_bytes());
        if body.is_some() {
            req.headers
                .push(("content-type".into(), "application/json".into()));
        }
        if let Some(write) = write {
            req.headers
                .push(("x-macalicious-write".into(), write.into()));
        }
        if let Some(token) = &self.token {
            req.headers
                .push(("cookie".into(), format!("mac_session={token}")));
        }
        let reply = env
            .handle(req)
            .await
            .unwrap_or_else(|e| panic!("{method} {}: no reply: {e}", self.url));
        if let Some((_, cookie)) = reply
            .headers
            .iter()
            .find(|(n, _)| n.eq_ignore_ascii_case("set-cookie"))
        {
            let pair = cookie.split(';').next().unwrap_or("").trim();
            if let Some(token) = pair.strip_prefix("mac_session=") {
                self.token = Some(token.to_string());
            }
        }
        reply
    }

    /// A `GET`'s revision, and the writes its reply names to a page that names itself.
    async fn read(&mut self, env: &TestEnv) -> (u64, String) {
        let reply = self.send(env, "GET", None, Some("reader")).await;
        assert_eq!(reply.status, 200);
        let body: Value = serde_json::from_slice(&reply.body).unwrap();
        (body["rev"].as_u64().unwrap(), writes_of(&reply))
    }

    async fn save(&mut self, env: &TestEnv, rev: u64, write: Option<&str>) -> IngressReply {
        let body = json!({ "rev": rev, "order": [], "page": 0 });
        self.send(env, "PUT", Some(&body), write).await
    }
}

fn writes_of(reply: &IngressReply) -> String {
    reply
        .headers
        .iter()
        .find(|(name, _)| name.eq_ignore_ascii_case("x-macalicious-writes"))
        .unwrap_or_else(|| panic!("no writes named in {:?}", reply.headers))
        .1
        .clone()
}

fn person_of(reply: &IngressReply) -> String {
    reply
        .headers
        .iter()
        .find(|(name, _)| name.eq_ignore_ascii_case("x-macalicious-person"))
        .unwrap_or_else(|| panic!("no person named in {:?}", reply.headers))
        .1
        .clone()
}

/// The two headers come from the browser, so either can be forged. Whose data a request reaches
/// is the signed session's alone: naming someone else is refused, and an id only ever goes in the
/// list of the person who sent it.
#[tokio::test]
async fn naming_another_person_or_their_write_reaches_nothing_of_theirs() {
    let env = boot().await;
    const NOTES: &str = "/api/notes/data";
    let note = json!({ "folders": [{ "id": "notes", "name": "ada-secret" }], "notes": [] });
    let empty = json!({ "folders": [{ "id": "notes", "name": "Notes" }], "notes": [] });
    let mut ada = Browser {
        token: None,
        url: NOTES,
    };
    let mut mallory = Browser {
        token: None,
        url: NOTES,
    };
    let ada_is = person_of(&ada.send(&env, "GET", None, Some("reader")).await);
    let mallory_is = person_of(&mallory.send(&env, "GET", None, Some("reader")).await);
    assert_ne!(ada_is, mallory_is);
    let body = json!({ "base": 0, "data": note });
    let stored = ada.send(&env, "PUT", Some(&body), Some("ada-1")).await;
    assert_eq!(stored.status, 200);

    let forged = |method: &str, bytes: &[u8], token: &str| {
        let mut req = ingress::request(method, NOTES, "", bytes);
        req.headers
            .push(("content-type".into(), "application/json".into()));
        req.headers
            .push(("x-macalicious-person".into(), ada_is.clone()));
        req.headers
            .push(("x-macalicious-write".into(), "ada-1".into()));
        req.headers
            .push(("cookie".into(), format!("mac_session={token}")));
        req
    };
    let token = mallory.token.clone().unwrap();

    // Reading as Ada is refused, and the refusal holds nothing of hers.
    let read = env.handle(forged("GET", b"", &token)).await.unwrap();
    assert_eq!(read.status, 409);
    assert!(!String::from_utf8_lossy(&read.body).contains("ada-secret"));
    assert!(!read
        .headers
        .iter()
        .any(|(name, _)| name.eq_ignore_ascii_case("x-macalicious-writes")));

    // Writing as Ada is refused, and changes neither person's document.
    let bytes = json!({ "base": 1, "data": empty }).to_string();
    let write = env
        .handle(forged("PUT", bytes.as_bytes(), &token))
        .await
        .unwrap();
    assert_eq!(write.status, 409);
    let read = ada.send(&env, "GET", None, Some("reader")).await;
    assert_eq!(writes_of(&read), "0:ada-1");
    let reply: Value = serde_json::from_slice(&read.body).unwrap();
    assert_eq!(reply["rev"], 1);
    let read = mallory.send(&env, "GET", None, Some("reader")).await;
    assert_eq!(person_of(&read), mallory_is);
    assert_eq!(
        writes_of(&read),
        "0:",
        "Ada's writes are not named to anyone else"
    );
    let reply: Value = serde_json::from_slice(&read.body).unwrap();
    assert_eq!(reply["rev"], 0);

    // The same id from another account goes in that account's list and no one else's.
    let body = json!({ "base": 0, "data": empty });
    let own = mallory.send(&env, "PUT", Some(&body), Some("ada-1")).await;
    assert_eq!(own.status, 200);
    let read = mallory.send(&env, "GET", None, Some("reader")).await;
    assert_eq!(writes_of(&read), "0:ada-1");
    let reply: Value = serde_json::from_slice(&read.body).unwrap();
    assert_eq!(reply["rev"], 1);
    assert_eq!(reply["data"]["folders"][0]["name"], "Notes");
    assert_eq!(
        writes_of(&ada.send(&env, "GET", None, Some("reader")).await),
        "0:ada-1"
    );

    // An id is a name and no permission: replaying a stored save on its old base is refused.
    let body = json!({ "base": 0, "data": empty });
    let replay = ada.send(&env, "PUT", Some(&body), Some("ada-1")).await;
    assert_eq!(replay.status, 409);
    let read = ada.send(&env, "GET", None, Some("reader")).await;
    let reply: Value = serde_json::from_slice(&read.body).unwrap();
    assert_eq!(reply["rev"], 1);
    assert_eq!(writes_of(&read), "0:ada-1");
}

#[tokio::test]
async fn a_save_bound_to_another_person_stores_nothing() {
    let env = boot().await;
    let mut page = Browser {
        token: None,
        url: "/api/notes/data",
    };
    let data = json!({ "folders": [{ "id": "notes", "name": "Notes" }], "notes": [] });
    let read = page.send(&env, "GET", None, Some("reader")).await;
    let me = read
        .headers
        .iter()
        .find(|(name, _)| name.eq_ignore_ascii_case("x-macalicious-person"))
        .map(|(_, value)| value.clone())
        .unwrap();
    let put = |owner: &str| {
        let bytes = json!({ "base": 0, "data": data }).to_string();
        let mut req = ingress::request("PUT", "/api/notes/data", "", bytes.as_bytes());
        req.headers
            .push(("content-type".into(), "application/json".into()));
        req.headers
            .push(("x-macalicious-person".into(), owner.into()));
        req.headers.push((
            "cookie".into(),
            format!("mac_session={}", page.token.as_deref().unwrap()),
        ));
        req
    };
    let refused = env.handle(put("someone-else")).await.unwrap();
    assert_eq!(refused.status, 409);
    let body: Value = serde_json::from_slice(&refused.body).unwrap();
    assert_eq!(body["session_changed"], true);
    let after = env.handle(put(&me)).await.unwrap();
    assert_eq!(
        after.status, 200,
        "the refused save stored nothing, so 0 is still the base"
    );
}

#[tokio::test]
async fn notes_and_stickies_name_their_writes_and_say_whose_they_are() {
    let env = boot().await;
    for (url, data) in [
        (
            "/api/notes/data",
            json!({ "folders": [{ "id": "notes", "name": "Notes" }], "notes": [] }),
        ),
        ("/api/stickies/data", json!({ "notes": [] })),
    ] {
        let mut page = Browser { token: None, url };
        let first = page.send(&env, "GET", None, Some("reader")).await;
        assert_eq!(writes_of(&first), "0:");
        let person = first
            .headers
            .iter()
            .find(|(name, _)| name.eq_ignore_ascii_case("x-macalicious-person"))
            .map(|(_, value)| value.clone());
        assert!(person.is_some_and(|who| !who.is_empty()), "{url}");

        let body = json!({ "base": 0, "data": data });
        let stored = page.send(&env, "PUT", Some(&body), Some("page-1")).await;
        assert_eq!(stored.status, 200, "{url}");
        let body = json!({ "base": 1, "data": data });
        let stored = page.send(&env, "PUT", Some(&body), Some("other-1")).await;
        assert_eq!(stored.status, 200, "{url}");
        let read = page.send(&env, "GET", None, Some("reader")).await;
        assert_eq!(writes_of(&read), "0:page-1,other-1", "{url}");
        let reply: Value = serde_json::from_slice(&read.body).unwrap();
        assert_eq!(reply["rev"], 2, "{url}");
        assert!(
            reply.get("writes").is_none(),
            "the list stays out of the document"
        );

        // A save that names nothing is stored, and the list stops answering for it.
        let body = json!({ "base": 2, "data": data });
        let stored = page.send(&env, "PUT", Some(&body), None).await;
        assert_eq!(stored.status, 200, "{url}");
        let read = page.send(&env, "GET", None, Some("reader")).await;
        assert_eq!(writes_of(&read), "3:page-1,other-1", "{url}");
    }
}

#[tokio::test]
async fn reminders_name_their_writes_and_sharing_keeps_them() {
    const DATA: &str = "/api/reminders/data";
    let env = boot().await;
    let mut page = Browser {
        token: None,
        url: "/api/session/sign-up",
    };
    let body = json!({ "name": "writes-ada", "full_name": "Ada", "password": "tide-pool-sound-9" });
    let made = page.send(&env, "POST", Some(&body), None).await;
    assert_eq!(made.status, 201, "{}", String::from_utf8_lossy(&made.body));
    page.url = DATA;
    let first = page.send(&env, "GET", None, Some("reader")).await;
    assert_eq!(writes_of(&first), "0:");

    let data = json!({
        "lists": [
            { "id": "reminders", "name": "Reminders", "color": "blue" },
            { "id": "groceries", "name": "Groceries", "color": "green" }
        ],
        "reminders": [
            { "id": "milk", "listId": "groceries", "title": "Milk" },
            { "id": "rent", "listId": "reminders", "title": "Pay rent" }
        ]
    });
    let body = json!({ "base": 0, "data": data, "alerts": {} });
    let stored = page.send(&env, "PUT", Some(&body), Some("page-1")).await;
    assert_eq!(stored.status, 200);
    let body = json!({ "base": 1, "data": data, "alerts": {} });
    let stored = page.send(&env, "PUT", Some(&body), Some("other-1")).await;
    assert_eq!(stored.status, 200);
    let read = page.send(&env, "GET", None, Some("reader")).await;
    assert_eq!(writes_of(&read), "0:page-1,other-1");
    let reply: Value = serde_json::from_slice(&read.body).unwrap();
    assert_eq!(reply["rev"], 2);
    assert!(reply.get("writes").is_none());

    // Sharing a list writes the document too: the list keeps its ids, and stops answering for
    // what that write did not name.
    let mut ben = Browser {
        token: None,
        url: "/api/session/sign-up",
    };
    let body = json!({ "name": "writes-ben", "full_name": "Ben", "password": "tide-pool-sound-9" });
    let made = ben.send(&env, "POST", Some(&body), None).await;
    assert_eq!(made.status, 201);
    page.url = "/api/reminders/shared";
    let body = json!({ "list": "groceries", "people": ["writes-ben"] });
    let shared = page.send(&env, "POST", Some(&body), None).await;
    assert_eq!(
        shared.status,
        201,
        "{}",
        String::from_utf8_lossy(&shared.body)
    );
    page.url = DATA;
    let read = page.send(&env, "GET", None, Some("reader")).await;
    assert_eq!(writes_of(&read), "3:page-1,other-1");
}

#[tokio::test]
async fn a_document_names_the_writes_stored_and_not_one_that_never_arrived() {
    let env = boot().await;
    let mut page = Browser {
        token: None,
        url: URL,
    };
    let (rev, none) = page.read(&env).await;
    assert_eq!(
        none, "0:",
        "a document nothing has stored: every write since is listed"
    );

    // A save with no id, as an earlier page or server makes: nothing is known of it, so the
    // list says it is complete only from the revision that save made.
    assert_eq!(page.save(&env, rev, None).await.status, 200);
    let (rev, none) = page.read(&env).await;
    assert_eq!((rev, none.as_str()), (1, "1:"));

    // The page's own save arrived, its reply lost; two other clients save on top.
    assert_eq!(page.save(&env, 1, Some("page-1")).await.status, 200);
    assert_eq!(page.save(&env, 2, Some("other-1")).await.status, 200);
    assert_eq!(page.save(&env, 3, Some("other-2")).await.status, 200);
    let (rev, named) = page.read(&env).await;
    assert_eq!((rev, named.as_str()), (4, "1:page-1,other-1,other-2"));

    // A page that names nothing, or a carrier that dropped the header, is told nothing.
    let silent = page.send(&env, "GET", None, None).await;
    assert_eq!(silent.status, 200);
    assert!(!silent
        .headers
        .iter()
        .any(|(name, _)| name.eq_ignore_ascii_case("x-macalicious-writes")));

    // A refusal names them too, and keeps nothing of the save it refused.
    let refused = page.save(&env, 1, Some("never")).await;
    assert_eq!(refused.status, 409);
    assert_eq!(writes_of(&refused), "1:page-1,other-1,other-2");
    assert!(!page.read(&env).await.1.contains("never"));

    // Something that is no id of a page's is no name, not an error, and the list says nothing
    // of that write: it is complete only from the revision the write made.
    assert_eq!(page.save(&env, 4, Some("a,b")).await.status, 200);
    assert_eq!(page.read(&env).await.1, "5:page-1,other-1,other-2");

    // A document keeps the last sixteen.
    let mut rev = 5;
    for n in 0..20 {
        let id = format!("many-{n}");
        assert_eq!(page.save(&env, rev, Some(&id)).await.status, 200);
        rev += 1;
    }
    let (_, named) = page.read(&env).await;
    assert_eq!(named.split(',').count(), 16);
    assert!(
        named.starts_with("5:many-4,") && named.ends_with(",many-19"),
        "{named}"
    );
}

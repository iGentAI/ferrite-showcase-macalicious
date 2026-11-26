//! Contacts between accounts on the in-process Forge planes
//! (`ferrite-app-test`): each person's address book is their own, `people`
//! lists only the caller's own desktop users, `users/<name>` finds an
//! account by its name (never a Guest User, never before sign-in), and the
//! cards, pictures and smart groups are checked before they are kept.

use ferrite_app::{serde_json, IngressReply};
use ferrite_app_test::{ingress, TestEnv, TestHarness};
use serde_json::{json, Value};

const PEPPER: &str = "test-pepper-0123456789abcdef0123456789abcdef";
const PASSWORD: &str = "correct horse battery";
/// The smallest JPEG data URL the module takes: it starts as a JPEG does.
const JPEG: &str = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA==";

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

fn text(reply: &IngressReply) -> String {
    String::from_utf8_lossy(&reply.body).into_owned()
}

fn json_of(reply: &IngressReply) -> Value {
    serde_json::from_slice(&reply.body).unwrap_or_else(|e| panic!("{e}: {}", text(reply)))
}

struct Browser {
    token: Option<String>,
}

impl Browser {
    async fn send(
        &mut self,
        env: &TestEnv,
        method: &str,
        path: &str,
        body: Option<&Value>,
    ) -> IngressReply {
        let bytes = body.map(Value::to_string).unwrap_or_default();
        let mut req = ingress::request(method, path, "", bytes.as_bytes());
        if body.is_some() {
            req.headers
                .push(("content-type".into(), "application/json".into()));
        }
        if let Some(token) = &self.token {
            req.headers
                .push(("cookie".into(), format!("mac_session={token}")));
        }
        let reply = env
            .handle(req)
            .await
            .unwrap_or_else(|e| panic!("{method} {path}: no reply: {e}"));
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

    async fn get(&mut self, env: &TestEnv, path: &str) -> Value {
        let reply = self.send(env, "GET", path, None).await;
        assert_eq!(reply.status, 200, "GET {path}: {}", text(&reply));
        json_of(&reply)
    }

    async fn put(&mut self, env: &TestEnv, path: &str, body: Value) -> IngressReply {
        self.send(env, "PUT", path, Some(&body)).await
    }

    /// Save `cards` on the revision the server has now.
    async fn save_cards(&mut self, env: &TestEnv, cards: Value) -> IngressReply {
        let rev = self.get(env, "/api/contacts/cards").await["rev"].clone();
        self.put(
            env,
            "/api/contacts/cards",
            json!({ "cards": cards, "rev": rev }),
        )
        .await
    }

    /// Save `groups` on the revision the server has now.
    async fn save_groups(&mut self, env: &TestEnv, groups: Value) -> IngressReply {
        let rev = self.get(env, "/api/contacts/smart-groups").await["rev"].clone();
        self.put(
            env,
            "/api/contacts/smart-groups",
            json!({ "smart_groups": groups, "rev": rev }),
        )
        .await
    }
}

async fn sign_up(env: &TestEnv, name: &str, full_name: &str) -> Browser {
    let mut browser = Browser { token: None };
    let reply = browser
        .send(
            env,
            "POST",
            "/api/session/sign-up",
            Some(&json!({ "name": name, "full_name": full_name, "password": PASSWORD })),
        )
        .await;
    assert_eq!(reply.status, 201, "sign-up of {name}: {}", text(&reply));
    browser
}

async fn guest(env: &TestEnv) -> Browser {
    let mut browser = Browser { token: None };
    let reply = browser
        .send(env, "POST", "/api/session/guest", Some(&json!({})))
        .await;
    assert_eq!(reply.status, 201, "guest: {}", text(&reply));
    browser
}

fn my_card(user: &str, first: &str, last: &str) -> Value {
    json!({ "id": "my-card", "account": "icloud", "first": first, "last": last,
            "me": true, "user": user })
}

fn user_card(id: &str, user: &str, first: &str, last: &str) -> Value {
    json!({ "id": id, "account": "icloud", "first": first, "last": last, "user": user })
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn each_person_keeps_an_address_book_of_their_own() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut martin = sign_up(&env, "martin", "Martin Klein").await;

    let cards = json!([
        my_card("chris", "Chris", "Carter"),
        user_card("m", "martin", "Martin", "Klein"),
        user_card("a", "ana", "Ana", "Other"),
        { "id": "lena", "account": "mac", "first": "Lena", "last": "Brandt",
          "note": "Not on this desktop." },
    ]);
    let saved = chris.save_cards(&env, cards.clone()).await;
    assert_eq!(saved.status, 200, "{}", text(&saved));
    assert_eq!(chris.get(&env, "/api/contacts/cards").await["cards"], cards);

    // Messages and Mail ask for the people: Chris's desktop users, by full
    // name, without his own card or a card that names no account.
    assert_eq!(
        chris.get(&env, "/api/contacts/people").await,
        json!({ "people": [
            { "user": "ana", "full_name": "Ana Other" },
            { "user": "martin", "full_name": "Martin Klein" },
        ] })
    );

    // Martin sees none of it: no cards, no people, no pictures, no groups.
    assert_eq!(
        martin.get(&env, "/api/contacts/cards").await["cards"],
        Value::Null
    );
    assert_eq!(
        martin.get(&env, "/api/contacts/people").await,
        json!({ "people": [] })
    );
    let pictured = chris
        .put(
            &env,
            "/api/contacts/pictures/m",
            json!({ "version": "v1", "image": JPEG }),
        )
        .await;
    assert_eq!(pictured.status, 200, "{}", text(&pictured));
    assert_eq!(
        chris.get(&env, "/api/contacts/pictures?ids=m,lena").await,
        json!({ "pictures": { "m": { "version": "v1", "image": JPEG } } })
    );
    assert_eq!(
        martin.get(&env, "/api/contacts/pictures?ids=m").await,
        json!({ "pictures": {} })
    );
    let groups = json!([{ "id": "desk", "name": "Desktop", "rule": "desktop-user" }]);
    assert_eq!(chris.save_groups(&env, groups.clone()).await.status, 200);
    assert_eq!(
        chris.get(&env, "/api/contacts/smart-groups").await["smart_groups"],
        groups
    );
    assert_eq!(
        martin.get(&env, "/api/contacts/smart-groups").await["smart_groups"],
        Value::Null
    );

    // Martin's own book is his, and Chris's is untouched by it.
    let his = json!([
        my_card("martin", "Martin", "Klein"),
        user_card("c", "chris", "Chris", "Carter"),
    ]);
    assert_eq!(martin.save_cards(&env, his).await.status, 200);
    assert_eq!(
        martin.get(&env, "/api/contacts/people").await,
        json!({ "people": [{ "user": "chris", "full_name": "Chris Carter" }] })
    );
    assert_eq!(chris.get(&env, "/api/contacts/cards").await["cards"], cards);

    // Forgetting the cards forgets their pictures too.
    let forgot = chris
        .send(&env, "DELETE", "/api/contacts/cards", None)
        .await;
    assert_eq!(forgot.status, 200, "{}", text(&forgot));
    assert_eq!(
        chris.get(&env, "/api/contacts/pictures?ids=m").await,
        json!({ "pictures": {} })
    );
    assert_eq!(
        chris.get(&env, "/api/contacts/people").await,
        json!({ "people": [] })
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_desktop_user_is_found_by_account_name() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let _martin = sign_up(&env, "martin", "Martin Klein").await;
    let mut visitor = guest(&env).await;
    let mut nobody = Browser { token: None };

    assert_eq!(
        chris.get(&env, "/api/contacts/users/martin").await,
        json!({ "name": "martin", "full_name": "Martin Klein" })
    );
    assert_eq!(
        chris.get(&env, "/api/contacts/users/Martin").await["name"],
        "martin",
        "an account name is found whatever its case"
    );
    let unknown = chris
        .send(&env, "GET", "/api/contacts/users/nobody", None)
        .await;
    assert_eq!(unknown.status, 404, "{}", text(&unknown));
    assert!(text(&unknown).contains("nobody"), "{}", text(&unknown));
    for malformed in ["9lives", "mar%20tin", "", "a.b%2Fc"] {
        let reply = chris
            .send(
                &env,
                "GET",
                &format!("/api/contacts/users/{malformed}"),
                None,
            )
            .await;
        assert_eq!(reply.status, 400, "{malformed:?}: {}", text(&reply));
    }
    assert_eq!(
        chris
            .send(&env, "GET", "/api/contacts/users/guest", None)
            .await
            .status,
        404,
        "a Guest User has no name to be found by"
    );
    assert_eq!(
        chris
            .send(&env, "POST", "/api/contacts/users/martin", Some(&json!({})))
            .await
            .status,
        405
    );

    // Before anyone signs in there is nobody to ask for.
    let anonymous = nobody
        .send(&env, "GET", "/api/contacts/users/martin", None)
        .await;
    assert_eq!(anonymous.status, 401, "{}", text(&anonymous));
    assert_eq!(
        nobody.get(&env, "/api/contacts/me").await,
        json!({ "name": null })
    );

    // My Card is made from the account.
    assert_eq!(
        chris.get(&env, "/api/contacts/me").await,
        json!({ "name": "chris", "full_name": "Chris Carter", "guest": false })
    );
    let me = visitor.get(&env, "/api/contacts/me").await;
    assert_eq!(me["guest"], true, "{me}");
    assert_eq!(
        visitor.get(&env, "/api/contacts/users/martin").await["full_name"],
        "Martin Klein",
        "a Guest User may add a desktop user"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn cards_pictures_and_smart_groups_are_checked_before_they_are_kept() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;

    for (why, cards) in [
        (
            "not an account name",
            json!([user_card("m", "Martin Klein", "Martin", "Klein")]),
        ),
        (
            "one card per desktop user",
            json!([
                user_card("m", "martin", "Martin", "Klein"),
                user_card("m2", "martin", "M.", "Klein"),
            ]),
        ),
        (
            "My Card names only the signed-in account",
            json!([my_card("martin", "Chris", "Carter")]),
        ),
        (
            "the picture is not in the card",
            json!([{ "id": "p", "account": "icloud", "first": "P", "last": "",
                     "image": JPEG }]),
        ),
        (
            "an unknown field",
            json!([{ "id": "p", "account": "icloud", "first": "P", "last": "",
                     "photo": "x" }]),
        ),
    ] {
        let reply = chris.save_cards(&env, cards).await;
        assert_eq!(reply.status, 400, "{why}: {}", text(&reply));
    }
    assert_eq!(
        chris.get(&env, "/api/contacts/cards").await["cards"],
        Value::Null,
        "nothing refused was kept"
    );
    let fine = chris
        .save_cards(
            &env,
            json!([
                my_card("chris", "Chris", "Carter"),
                user_card("m", "martin", "Martin", "Klein"),
                { "id": "p", "account": "mac", "first": "P", "last": "", "image": "v1" },
            ]),
        )
        .await;
    assert_eq!(fine.status, 200, "{}", text(&fine));

    // A picture is a JPEG or PNG data URL under the cap.
    let picture = |image: String| json!({ "version": "v1", "image": image });
    for (why, image) in [
        ("not a data URL", "https://example.com/a.jpg".to_string()),
        (
            "a GIF",
            "data:image/gif;base64,R0lGODlhAQABAAAAACw=".to_string(),
        ),
        (
            "PNG bytes called a JPEG",
            "data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUg==".to_string(),
        ),
        (
            "over 64 KiB",
            format!("data:image/jpeg;base64,/9j/{}", "A".repeat(65_536)),
        ),
    ] {
        let reply = chris
            .put(&env, "/api/contacts/pictures/p", picture(image))
            .await;
        assert_eq!(reply.status, 400, "{why}: {}", text(&reply));
    }
    let png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB".to_string();
    let kept = chris
        .put(&env, "/api/contacts/pictures/p", picture(png.clone()))
        .await;
    assert_eq!(kept.status, 200, "{}", text(&kept));
    let bad_id = chris
        .put(&env, "/api/contacts/pictures/a%2Fb", picture(png.clone()))
        .await;
    assert_eq!(bad_id.status, 400);
    let many: Vec<String> = (0..17).map(|n| format!("c{n}")).collect();
    let too_many = chris
        .send(
            &env,
            "GET",
            &format!("/api/contacts/pictures?ids={}", many.join(",")),
            None,
        )
        .await;
    assert_eq!(too_many.status, 400, "at most 16 at a time");
    assert_eq!(
        chris.get(&env, "/api/contacts/pictures?ids=p").await["pictures"]["p"]["image"],
        png.as_str()
    );
    let removed = chris
        .send(&env, "DELETE", "/api/contacts/pictures/p", None)
        .await;
    assert_eq!(removed.status, 200);
    assert_eq!(
        chris.get(&env, "/api/contacts/pictures?ids=p").await,
        json!({ "pictures": {} })
    );

    // Smart groups: a rule each, named, at most fifty.
    for (why, groups) in [
        (
            "contains needs its text",
            json!([{ "id": "g", "name": "Ferry", "rule": "contains" }]),
        ),
        (
            "an unknown rule",
            json!([{ "id": "g", "name": "All", "rule": "everyone" }]),
        ),
        (
            "a nameless group",
            json!([{ "id": "g", "name": "", "rule": "desktop-user" }]),
        ),
        (
            "too many",
            Value::Array(
                (0..51)
                    .map(|n| json!({ "id": format!("g{n}"), "name": "G", "rule": "desktop-user" }))
                    .collect(),
            ),
        ),
    ] {
        let reply = chris.save_groups(&env, groups).await;
        assert_eq!(reply.status, 400, "{why}: {}", text(&reply));
    }
    let groups = json!([
        { "id": "g1", "name": "On this desktop", "rule": "desktop-user" },
        { "id": "g2", "name": "Ferry", "rule": "contains", "text": "ferry" },
    ]);
    let saved = chris.save_groups(&env, groups.clone()).await;
    assert_eq!(saved.status, 200, "{}", text(&saved));
    assert_eq!(json_of(&saved)["smart_groups"], groups);
    let stale = chris
        .put(
            &env,
            "/api/contacts/smart-groups",
            json!({ "smart_groups": [], "rev": 0 }),
        )
        .await;
    assert_eq!(
        stale.status, 409,
        "a save on an old revision changes nothing"
    );
    assert_eq!(json_of(&stale)["smart_groups"], groups);
}

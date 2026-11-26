//! Messages between the desktop's accounts on the in-process Forge planes
//! (`ferrite-app-test`): a one-to-one conversation found again by either
//! person, a group, messages stored once under a resend, the others told,
//! unread counts, read receipts shown only when asked, typing, tapbacks,
//! replies, history moved to pages without loss, one account in two
//! browsers, nobody outside a conversation reaching it, the list chosen by
//! activity however many conversations a person has been in (an index write
//! in flight never lost, none listed twice), and leaving a group.

use ferrite_app::{serde_json, IngressReply};
use ferrite_app_test::{ingress, TestEnv, TestHarness};
use serde_json::{json, Value};

const PEPPER: &str = "test-pepper-0123456789abcdef0123456789abcdef";
const PASSWORD: &str = "correct horse battery";

async fn boot() -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let env = TestHarness::new()
        .with_blob("files")
        .with_queue("requests")
        .with_queue("replies")
        .with_queue("live")
        .with_queue("frames")
        .stream_requests("live")
        .with_store("data")
        // A virtual clock, so a test can move to the next day.
        .manual_clock(1_760_000_000_000)
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
        headers: &[(&str, &str)],
        body: &[u8],
    ) -> IngressReply {
        let mut req = ingress::request(method, path, "", body);
        for (name, value) in headers {
            req.headers.push((name.to_string(), value.to_string()));
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

    async fn post(&mut self, env: &TestEnv, path: &str, body: Value) -> IngressReply {
        self.send(
            env,
            "POST",
            path,
            &[("content-type", "application/json")],
            body.to_string().as_bytes(),
        )
        .await
    }

    async fn keyed(&mut self, env: &TestEnv, path: &str, key: &str, body: Value) -> IngressReply {
        self.send(
            env,
            "POST",
            path,
            &[
                ("content-type", "application/json"),
                ("idempotency-key", key),
            ],
            body.to_string().as_bytes(),
        )
        .await
    }

    async fn get(&mut self, env: &TestEnv, path: &str) -> Value {
        let reply = self.send(env, "GET", path, &[], b"").await;
        assert_eq!(reply.status, 200, "GET {path}: {}", text(&reply));
        json_of(&reply)
    }

    async fn list(&mut self, env: &TestEnv) -> Vec<Value> {
        self.get(env, "/api/messages/conversations").await["conversations"]
            .as_array()
            .unwrap()
            .clone()
    }

    async fn say(&mut self, env: &TestEnv, id: &str, words: &str) -> Value {
        let reply = self
            .post(
                env,
                &format!("/api/messages/conversations/{id}/messages"),
                json!({ "text": words }),
            )
            .await;
        assert_eq!(reply.status, 201, "{}", text(&reply));
        json_of(&reply)["message"].clone()
    }

    /// How many changes this person has been told of in Messages, as the
    /// first state of their personal stream (`/live/me`) shows it.
    async fn messages_changes(&mut self, env: &TestEnv) -> u64 {
        let reply = self.post(env, "/api/session/ticket", json!({})).await;
        assert_eq!(reply.status, 201, "ticket: {}", text(&reply));
        let ticket = json_of(&reply)["ticket"].as_str().unwrap().to_string();
        let mut sub = env
            .sse_open(&format!("/live/me?ticket={ticket}"))
            .await
            .unwrap();
        let first = sub.recv().await.expect("the first frame");
        assert_eq!(first.event.as_deref(), Some("state"), "{first:?}");
        sub.close().await.unwrap();
        let frame: Value = serde_json::from_slice(&first.data).unwrap();
        frame["state"]["changes"]["messages"]["n"]
            .as_u64()
            .unwrap_or(0)
    }
}

async fn sign_up(env: &TestEnv, name: &str, full_name: &str) -> Browser {
    let mut browser = Browser { token: None };
    let reply = browser
        .post(
            env,
            "/api/session/sign-up",
            json!({ "name": name, "full_name": full_name, "password": PASSWORD }),
        )
        .await;
    assert_eq!(reply.status, 201, "sign-up of {name}: {}", text(&reply));
    browser
}

async fn start(env: &TestEnv, who: &mut Browser, to: &[&str]) -> (u16, Value) {
    let reply = who
        .post(env, "/api/messages/conversations", json!({ "to": to }))
        .await;
    (reply.status, json_of(&reply))
}

/// The store prefix of a person's own Messages space
/// (`apps/messages/users/<account id>/`), found by the one index entry of
/// their note-to-self conversation `own`: account ids are never shown.
async fn own_space(env: &TestEnv, own: &str) -> String {
    let mut store = env.store("data");
    let (entries, _) = store
        .scan_prefix(b"apps/messages/users/", None, 1_000)
        .await
        .unwrap();
    let tail = format!("convs/{own}");
    let keys: Vec<String> = entries
        .iter()
        .map(|(key, _, _)| String::from_utf8_lossy(key).into_owned())
        .filter(|key| key.ends_with(&format!("/{tail}")))
        .collect();
    assert_eq!(keys.len(), 1, "{keys:?}");
    keys[0].strip_suffix(&tail).unwrap().to_string()
}

/// A person's activity-index key for conversation `id` at `at_ms`, as the
/// server writes it: the time inverted, so the newest sorts first.
fn activity_key(space: &str, id: &str, at_ms: u64) -> String {
    format!("{space}recent/{:016x}/{id}", u64::MAX - at_ms)
}

fn ids_of(list: &[Value]) -> Vec<String> {
    list.iter()
        .map(|c| c["id"].as_str().unwrap().to_string())
        .collect()
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn two_accounts_message_each_other_and_nobody_else_reads_it() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut martin = sign_up(&env, "martin", "Martin Klein").await;
    let mut ann = sign_up(&env, "ann", "Ann Lee").await;

    let me = chris.get(&env, "/api/messages/me").await;
    assert_eq!(
        (&me["name"], &me["full_name"]),
        (&json!("chris"), &json!("Chris Carter"))
    );

    let (status, made) = start(&env, &mut chris, &["martin"]).await;
    assert_eq!(status, 201, "{made}");
    let id = made["state"]["id"].as_str().unwrap().to_string();
    assert!(
        !made.to_string().contains("u-"),
        "no account id is shown: {made}"
    );
    // Martin starting a conversation with Chris finds the same one.
    let (status, found) = start(&env, &mut martin, &["Chris Carter (chris)"]).await;
    assert_eq!(status, 200, "{found}");
    assert_eq!(found["state"]["id"], id.as_str());

    let first = chris.say(&env, &id, "Ferry at 8:40?").await;
    assert_eq!(
        (&first["seq"], &first["author"]),
        (&json!(1), &json!("chris"))
    );

    // Martin's list shows it, unread; Chris's shows nothing unread.
    let list = martin.list(&env).await;
    assert_eq!(list.len(), 1);
    assert_eq!(list[0]["id"], id.as_str());
    assert_eq!(list[0]["unread"], 1);
    assert_eq!(list[0]["last"]["text"], "Ferry at 8:40?");
    assert_eq!(chris.list(&env).await[0]["unread"], 0);

    // Delivery reaches the members only. The conversation is on no public
    // feed (a stream open carries no session, and a one-to-one id is derived
    // from account ids): its members hear it through their own change counts,
    // which only their personal streams carry.
    let mut feed = env.sse_open(&format!("/live/messages/{id}")).await.unwrap();
    let refused = feed.recv().await.expect("a frame");
    assert_eq!(refused.event.as_deref(), Some("refused"), "{refused:?}");
    assert!(refused.done);
    let martin_heard = martin.messages_changes(&env).await;
    assert!(martin_heard >= 1, "Martin's windows reload on the message");
    assert_eq!(ann.messages_changes(&env).await, 0, "Ann hears nothing");
    let chris_heard = chris.messages_changes(&env).await;
    let typing = martin
        .post(
            &env,
            &format!("/api/messages/conversations/{id}/typing"),
            json!({}),
        )
        .await;
    assert_eq!(typing.status, 200, "{}", text(&typing));
    assert!(
        chris.messages_changes(&env).await > chris_heard,
        "Chris's windows reload when Martin types"
    );
    assert_eq!(ann.messages_changes(&env).await, 0, "Ann hears nothing");
    // Martin is notified.
    let notes = martin.get(&env, "/api/notification-center/inbox").await;
    assert!(
        notes["items"]
            .as_array()
            .unwrap()
            .iter()
            .any(|n| n["app"] == "messages"
                && n["title"] == "Chris Carter"
                && n["body"] == "Ferry at 8:40?"),
        "{notes}"
    );

    // Martin replies to it, reading it; with a receipt Chris sees Read.
    let path = format!("/api/messages/conversations/{id}");
    let read = martin
        .post(
            &env,
            &format!("{path}/read"),
            json!({ "seq": 1, "receipt": false }),
        )
        .await;
    assert_eq!(read.status, 200, "{}", text(&read));
    assert_eq!(martin.list(&env).await[0]["unread"], 0);
    let state = chris.get(&env, &path).await["state"].clone();
    assert!(
        state["read"].get("martin").is_none(),
        "no receipt unless asked: {state}"
    );
    martin
        .post(
            &env,
            &format!("{path}/read"),
            json!({ "seq": 1, "receipt": true }),
        )
        .await;
    let state = chris.get(&env, &path).await["state"].clone();
    assert_eq!(state["read"]["martin"], 1);

    let typing = martin
        .post(&env, &format!("{path}/typing"), json!({}))
        .await;
    assert_eq!(typing.status, 200);
    let state = chris.get(&env, &path).await["state"].clone();
    assert!(state["typing"]["martin"].as_u64().unwrap() > 0, "{state}");
    let reply = martin
        .post(
            &env,
            &format!("{path}/messages"),
            json!({ "text": "Yes, see you there", "reply_to": 1 }),
        )
        .await;
    assert_eq!(reply.status, 201, "{}", text(&reply));
    let state = chris.get(&env, &path).await["state"].clone();
    assert!(
        state["typing"].get("martin").is_none(),
        "sending ends typing"
    );
    assert_eq!(state["messages"][1]["reply_to"], 1);

    // A tapback on Martin's message.
    let tap = chris
        .post(
            &env,
            &format!("{path}/messages/2/tapback"),
            json!({ "kind": "love" }),
        )
        .await;
    assert_eq!(tap.status, 200, "{}", text(&tap));
    let bad = chris
        .post(
            &env,
            &format!("{path}/messages/2/tapback"),
            json!({ "kind": "wave" }),
        )
        .await;
    assert_eq!(bad.status, 400);
    let state = martin.get(&env, &path).await["state"].clone();
    assert_eq!(state["messages"][1]["tapbacks"]["chris"], "love");

    // Ann reaches none of it: not in her list, not by id, not to write.
    assert!(ann.list(&env).await.is_empty());
    for (method, sub) in [
        ("GET", ""),
        ("GET", "/history?page=000000-0123456789abcdef"),
        ("GET", "/history?page=0"),
    ] {
        let peek = ann
            .send(&env, method, &format!("{path}{sub}"), &[], b"")
            .await;
        assert_eq!(peek.status, 404, "{sub}: {}", text(&peek));
    }
    let intrude = ann
        .post(&env, &format!("{path}/messages"), json!({ "text": "hi" }))
        .await;
    assert_eq!(intrude.status, 404, "{}", text(&intrude));
    let tap = ann
        .post(
            &env,
            &format!("{path}/messages/1/tapback"),
            json!({ "kind": "like" }),
        )
        .await;
    assert_eq!(tap.status, 404);

    // Unknown names, and a browser that never signed in, are refused.
    let (status, body) = start(&env, &mut chris, &["nobody"]).await;
    assert_eq!(status, 422, "{body}");
    assert_eq!(body["unknown"], json!(["nobody"]));
    let (status, _) = start(&env, &mut chris, &[]).await;
    assert_eq!(status, 400, "a conversation names someone");
    // Writing to oneself is a conversation of one, which nobody else reaches.
    let (status, own) = start(&env, &mut ann, &["ann"]).await;
    assert_eq!(status, 201, "{own}");
    let own = own["state"]["id"].as_str().unwrap().to_string();
    ann.say(&env, &own, "note to self").await;
    assert_eq!(ann.list(&env).await[0]["last"]["text"], "note to self");
    assert!(!chris
        .list(&env)
        .await
        .iter()
        .any(|c| c["id"] == own.as_str()));
    let peek = chris
        .send(
            &env,
            "GET",
            &format!("/api/messages/conversations/{own}"),
            &[],
            b"",
        )
        .await;
    assert_eq!(peek.status, 404);
    let mut stranger = Browser { token: None };
    let reply = stranger
        .send(&env, "GET", "/api/messages/conversations", &[], b"")
        .await;
    // Not signed in: no conversations, and nothing of anyone else's.
    assert_eq!(reply.status, 200);
    assert_eq!(json_of(&reply), json!({ "conversations": [] }));
    let start = stranger
        .send(
            &env,
            "POST",
            "/api/messages/conversations",
            &[],
            br#"{"to":["chris"]}"#,
        )
        .await;
    assert_eq!(start.status, 401);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_resend_is_stored_once_and_groups_have_names() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut martin = sign_up(&env, "martin", "Martin Klein").await;
    let mut ann = sign_up(&env, "ann", "Ann Lee").await;

    let made = chris
        .keyed(
            &env,
            "/api/messages/conversations",
            "group-1",
            json!({ "to": ["martin", "ann"], "title": "Island trip" }),
        )
        .await;
    assert_eq!(made.status, 201, "{}", text(&made));
    let id = json_of(&made)["state"]["id"].as_str().unwrap().to_string();
    let again = chris
        .keyed(
            &env,
            "/api/messages/conversations",
            "group-1",
            json!({ "to": ["martin", "ann"], "title": "Island trip" }),
        )
        .await;
    assert_eq!(
        json_of(&again)["state"]["id"],
        id.as_str(),
        "one group per key"
    );
    // A conversation of two has no name, so the same key for two people is
    // refused before any key is looked at.
    let other = chris
        .keyed(
            &env,
            "/api/messages/conversations",
            "group-1",
            json!({ "to": ["martin"], "title": "Just us" }),
        )
        .await;
    assert_eq!(other.status, 400, "{}", text(&other));
    for person in [&mut martin, &mut ann] {
        let list = person.list(&env).await;
        assert_eq!(list.len(), 1);
        assert_eq!(list[0]["title"], "Island trip");
        assert_eq!(list[0]["members"].as_array().unwrap().len(), 3);
    }

    let path = format!("/api/messages/conversations/{id}/messages");
    let body = json!({ "text": "Who brings the map?" });
    let first = chris.keyed(&env, &path, "msg-1", body.clone()).await;
    assert_eq!(first.status, 201);
    let resend = chris.keyed(&env, &path, "msg-1", body).await;
    assert_eq!(resend.status, 200, "{}", text(&resend));
    assert_eq!(json_of(&resend)["message"], json_of(&first)["message"]);
    let reused = chris
        .keyed(&env, &path, "msg-1", json!({ "text": "Other" }))
        .await;
    assert_eq!(reused.status, 422);
    let state = ann
        .get(&env, &format!("/api/messages/conversations/{id}"))
        .await["state"]
        .clone();
    assert_eq!(
        state["messages"].as_array().unwrap().len(),
        1,
        "stored once"
    );

    // The group is renamed by a member; a two-person conversation has no name.
    let renamed = ann
        .send(
            &env,
            "PUT",
            &format!("/api/messages/conversations/{id}/title"),
            &[("content-type", "application/json")],
            json!({ "title": "Lighthouse loop" }).to_string().as_bytes(),
        )
        .await;
    assert_eq!(renamed.status, 200, "{}", text(&renamed));
    assert_eq!(martin.list(&env).await[0]["title"], "Lighthouse loop");
    let (_, direct) = start(&env, &mut chris, &["martin"]).await;
    let direct = direct["state"]["id"].as_str().unwrap().to_string();
    let refused = chris
        .send(
            &env,
            "PUT",
            &format!("/api/messages/conversations/{direct}/title"),
            &[("content-type", "application/json")],
            json!({ "title": "x" }).to_string().as_bytes(),
        )
        .await;
    assert_eq!(refused.status, 409);
    // Ann is in the group but not in Chris and Martin's conversation.
    let peek = ann
        .send(
            &env,
            "GET",
            &format!("/api/messages/conversations/{direct}"),
            &[],
            b"",
        )
        .await;
    assert_eq!(peek.status, 404);

    // The same key with another name is another request: a group of its own,
    // not the first one answered again.
    let renamed_request = chris
        .keyed(
            &env,
            "/api/messages/conversations",
            "group-1",
            json!({ "to": ["martin", "ann"], "title": "Another trip" }),
        )
        .await;
    assert_eq!(renamed_request.status, 201, "{}", text(&renamed_request));
    assert_ne!(json_of(&renamed_request)["state"]["id"], id.as_str());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn long_conversations_keep_every_message_in_pages() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut martin = sign_up(&env, "martin", "Martin Klein").await;
    let (_, made) = start(&env, &mut chris, &["martin"]).await;
    let id = made["state"]["id"].as_str().unwrap().to_string();
    for n in 1..=160 {
        chris.say(&env, &id, &format!("message {n}")).await;
    }
    let path = format!("/api/messages/conversations/{id}");
    let state = martin.get(&env, &path).await["state"].clone();
    assert_eq!(state["pages"].as_u64(), Some(2));
    // Pages are read newest first, each naming the one before.
    let mut older_pages: Vec<Vec<u64>> = Vec::new();
    let mut next = state["older"].as_str().map(str::to_string);
    while let Some(name) = next {
        let older = martin
            .get(&env, &format!("{path}/history?page={name}"))
            .await;
        older_pages.push(
            older["messages"]
                .as_array()
                .unwrap()
                .iter()
                .map(|m| m["seq"].as_u64().unwrap())
                .collect(),
        );
        next = older["prev"].as_str().map(str::to_string);
    }
    assert_eq!(older_pages.len(), 2);
    let mut seqs: Vec<u64> = older_pages.into_iter().rev().flatten().collect();
    seqs.extend(
        state["messages"]
            .as_array()
            .unwrap()
            .iter()
            .map(|m| m["seq"].as_u64().unwrap()),
    );
    assert_eq!(
        seqs,
        (1..=160).collect::<Vec<u64>>(),
        "none lost, none twice"
    );
    // Martin has read none of them: all 160 are unread, paged or not.
    assert_eq!(martin.list(&env).await[0]["unread"], 160);
    let read = martin
        .post(&env, &format!("{path}/read"), json!({ "seq": 150 }))
        .await;
    assert_eq!(read.status, 200, "{}", text(&read));
    assert_eq!(martin.list(&env).await[0]["unread"], 10);
    assert_eq!(chris.list(&env).await[0]["unread"], 0);
    // A name that is not a page of this conversation reads nothing.
    let bad = martin
        .send(&env, "GET", &format!("{path}/history?page=../x"), &[], b"")
        .await;
    assert_eq!(bad.status, 400);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn one_account_in_two_browsers_is_one_member() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut martin = sign_up(&env, "martin", "Martin Klein").await;
    let (_, made) = start(&env, &mut chris, &["martin"]).await;
    let id = made["state"]["id"].as_str().unwrap().to_string();

    // Chris signs in again on a second browser.
    let mut laptop = Browser { token: None };
    laptop.send(&env, "GET", "/api/session", &[], b"").await;
    let signed = laptop
        .post(
            &env,
            "/api/session/sign-in",
            json!({ "name": "chris", "password": PASSWORD }),
        )
        .await;
    assert_eq!(signed.status, 200, "{}", text(&signed));
    // It lists and finds the same conversation, and writes in it as Chris.
    assert_eq!(laptop.list(&env).await[0]["id"], id.as_str());
    let (status, again) = start(&env, &mut laptop, &["martin"]).await;
    assert_eq!(status, 200, "{again}");
    assert_eq!(again["state"]["id"], id.as_str());
    let heard = martin.messages_changes(&env).await;
    let said = laptop.say(&env, &id, "From the laptop").await;
    assert_eq!(said["author"], "chris");
    assert!(
        martin.messages_changes(&env).await > heard,
        "Martin hears it"
    );
    // The first browser reads it as Chris's own message, already read.
    let read = chris
        .get(&env, &format!("/api/messages/conversations/{id}"))
        .await;
    assert_eq!(read["state"]["messages"][0]["text"], "From the laptop");
    assert_eq!(chris.list(&env).await[0]["unread"], 0);
    assert_eq!(martin.list(&env).await[0]["unread"], 1);
    // An empty message is refused.
    let empty = chris
        .post(
            &env,
            &format!("/api/messages/conversations/{id}/messages"),
            json!({ "text": "  " }),
        )
        .await;
    assert_eq!(empty.status, 400);
}

/// A Guest User starts no conversation (nobody can address one, and its data
/// ends with its time), and one person starts a bounded number a day:
/// finding a conversation that exists takes nothing.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn guests_start_nothing_and_a_day_of_starts_is_bounded() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let _martin = sign_up(&env, "martin", "Martin Klein").await;
    let _ann = sign_up(&env, "ann", "Ann Lee").await;

    let mut guest = Browser { token: None };
    let reply = guest.post(&env, "/api/session/guest", json!({})).await;
    assert_eq!(reply.status, 201, "{}", text(&reply));
    let (status, body) = start(&env, &mut guest, &["chris"]).await;
    assert_eq!(status, 403, "{body}");
    assert!(chris.list(&env).await.is_empty(), "nothing reached Chris");

    let (status, direct) = start(&env, &mut chris, &["martin"]).await;
    assert_eq!(status, 201, "{direct}");
    // `STARTS_PER_DAY` in `src/apps/messages/conversations.rs`.
    for n in 1..100 {
        let (status, body) = start(&env, &mut chris, &["martin", "ann"]).await;
        assert_eq!(status, 201, "group {n}: {body}");
    }
    let (status, body) = start(&env, &mut chris, &["martin", "ann"]).await;
    assert_eq!(status, 429, "{body}");
    let (status, found) = start(&env, &mut chris, &["martin"]).await;
    assert_eq!(status, 200, "an existing conversation is found: {found}");
    assert_eq!(found["state"]["id"], direct["state"]["id"]);
    crate::support::advance(&env, 24 * 60 * 60 * 1000).await;
    let (status, body) = start(&env, &mut chris, &["martin", "ann"]).await;
    assert_eq!(status, 201, "a new day: {body}");
}

/// A start naming more people than a conversation can hold is refused
/// before any of them is looked up, and a day's messages are bounded.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_start_names_few_people_and_a_day_of_messages_is_bounded() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let _martin = sign_up(&env, "martin", "Martin Klein").await;

    let names: Vec<String> = (0..11).map(|n| format!("p{n}")).collect();
    let reply = chris
        .post(&env, "/api/messages/conversations", json!({ "to": names }))
        .await;
    assert_eq!(reply.status, 400, "{}", text(&reply));

    let (status, made) = start(&env, &mut chris, &["martin"]).await;
    assert_eq!(status, 201, "{made}");
    let id = made["state"]["id"].as_str().unwrap().to_string();
    let path = format!("/api/messages/conversations/{id}/messages");
    // `MESSAGES_PER_DAY` in `src/apps/messages/conversations.rs`.
    for n in 0..2_000 {
        let reply = chris
            .post(&env, &path, json!({ "text": format!("m{n}") }))
            .await;
        assert_eq!(reply.status, 201, "message {n}: {}", text(&reply));
    }
    let over = chris.post(&env, &path, json!({ "text": "one more" })).await;
    assert_eq!(over.status, 429, "{}", text(&over));
    crate::support::advance(&env, 24 * 60 * 60 * 1000).await;
    chris.say(&env, &id, "a new day").await;
}

/// The list is the person's most recently active conversations however many
/// they have been in: an account from before the activity index, with 6,000
/// older conversations whose ids all sort before any real one, still lists
/// its newest first (the older list read only the first 5,000 index entries
/// by id, and showed none of these). Activity reorders it.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn the_list_is_the_most_recent_conversations_however_many_there_are() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut martin = sign_up(&env, "martin", "Martin Klein").await;
    let _ann = sign_up(&env, "ann", "Ann Lee").await;
    let (_, own) = start(&env, &mut chris, &["chris"]).await;
    let own = own["state"]["id"].as_str().unwrap().to_string();
    let space = own_space(&env, &own).await;
    let mut store = env.store("data");
    for n in 0..6_000u64 {
        let key = format!("{space}convs/c-{n:032x}");
        let entry = json!({ "at_ms": 1_000 + n }).to_string();
        store.put(key.as_bytes(), entry.as_bytes()).await.unwrap();
    }
    crate::support::advance(&env, 1_000).await;
    let (_, direct) = start(&env, &mut chris, &["martin"]).await;
    let direct = direct["state"]["id"].as_str().unwrap().to_string();
    crate::support::advance(&env, 1_000).await;
    let (_, group) = start(&env, &mut chris, &["martin", "ann"]).await;
    let group = group["state"]["id"].as_str().unwrap().to_string();
    crate::support::advance(&env, 1_000).await;
    chris.say(&env, &direct, "the newest").await;
    assert_eq!(
        ids_of(&chris.list(&env).await),
        [direct.clone(), group.clone(), own.clone()],
        "the most recent first, past 6,000 older entries"
    );
    crate::support::advance(&env, 1_000).await;
    martin.say(&env, &group, "now this one").await;
    assert_eq!(
        ids_of(&chris.list(&env).await),
        [group.clone(), direct.clone(), own.clone()]
    );
    assert_eq!(ids_of(&martin.list(&env).await), [group, direct]);
}

/// A message's index write is two steps (the activity entry for the new time,
/// then the compare-and-set of `convs/<id>`). A list between them lists the
/// conversation once and keeps the new entry; a write abandoned between them
/// is finished by a list a minute later, which still lists it once; an entry
/// older than the time held is deleted.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_list_never_loses_an_index_write_in_flight_or_lists_one_twice() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let (_, own) = start(&env, &mut chris, &["chris"]).await;
    let id = own["state"]["id"].as_str().unwrap().to_string();
    chris.say(&env, &id, "first").await;
    let t1 = env.now_ms();
    let space = own_space(&env, &id).await;
    let index = format!("{space}convs/{id}");
    let mut store = env.store("data");
    let written = || json!({ "w": env.now_ms() }).to_string();
    let held = |bytes: Option<Vec<u8>>| -> u64 {
        serde_json::from_slice::<Value>(&bytes.expect("an index entry")).unwrap()["at_ms"]
            .as_u64()
            .unwrap()
    };
    assert_eq!(held(store.get(index.as_bytes()).await.unwrap()), t1);

    // Paused between its steps: the entry for t2 written, convs still at t1.
    let t2 = t1 + 5_000;
    let e2 = activity_key(&space, &id, t2);
    store
        .put(e2.as_bytes(), written().as_bytes())
        .await
        .unwrap();
    assert_eq!(ids_of(&chris.list(&env).await), [id.clone()]);
    assert!(
        store.get(e2.as_bytes()).await.unwrap().is_some(),
        "the entry being published is kept"
    );
    // The paused write completes.
    let e1 = activity_key(&space, &id, t1);
    let entry = json!({ "at_ms": t2 }).to_string();
    store.put(index.as_bytes(), entry.as_bytes()).await.unwrap();
    store.delete(e1.as_bytes()).await.unwrap();
    assert_eq!(ids_of(&chris.list(&env).await), [id.clone()]);

    // Abandoned between its steps: the entry for t3, convs still at t2. A
    // minute later the list finishes it, and both entries in the same read
    // name the conversation: it is listed once.
    let t3 = t2 + 5_000;
    let e3 = activity_key(&space, &id, t3);
    store
        .put(e3.as_bytes(), written().as_bytes())
        .await
        .unwrap();
    crate::support::advance(&env, 61_000).await;
    assert_eq!(ids_of(&chris.list(&env).await), [id.clone()], "listed once");
    assert_eq!(held(store.get(index.as_bytes()).await.unwrap()), t3);
    assert!(store.get(e3.as_bytes()).await.unwrap().is_some());
    assert!(
        store.get(e2.as_bytes()).await.unwrap().is_none(),
        "the older entry went"
    );

    // An entry older than the time held can never count again.
    store
        .put(e1.as_bytes(), written().as_bytes())
        .await
        .unwrap();
    assert_eq!(ids_of(&chris.list(&env).await), [id.clone()]);
    assert!(store.get(e1.as_bytes()).await.unwrap().is_none());
    // Writing again moves it on as before.
    crate::support::advance(&env, 1_000).await;
    chris.say(&env, &id, "second").await;
    assert_eq!(
        held(store.get(index.as_bytes()).await.unwrap()),
        env.now_ms()
    );
    assert_eq!(ids_of(&chris.list(&env).await), [id]);
}

/// A member leaves a group: it leaves their list, and they can no longer
/// read, write or leave it; the others see one member fewer, are told, and
/// carry on. Someone outside cannot leave it, and a conversation of two
/// cannot be left.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_member_leaves_a_group_and_the_others_carry_on() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut martin = sign_up(&env, "martin", "Martin Klein").await;
    let mut ann = sign_up(&env, "ann", "Ann Lee").await;
    let mut bob = sign_up(&env, "bob", "Bob Ray").await;
    let mut eve = sign_up(&env, "eve", "Eve Moss").await;
    let (status, made) = start(&env, &mut chris, &["martin", "ann", "bob"]).await;
    assert_eq!(status, 201, "{made}");
    let id = made["state"]["id"].as_str().unwrap().to_string();
    chris.say(&env, &id, "Who is in for Sunday?").await;
    let path = format!("/api/messages/conversations/{id}");
    let leave = format!("{path}/leave");

    let outside = eve.post(&env, &leave, json!({})).await;
    assert_eq!(outside.status, 404, "{}", text(&outside));

    let left = ann.post(&env, &leave, json!({})).await;
    assert_eq!(left.status, 200, "{}", text(&left));
    assert!(ann.list(&env).await.is_empty(), "gone from her list");
    let peek = ann.send(&env, "GET", &path, &[], b"").await;
    assert_eq!(peek.status, 404, "{}", text(&peek));
    let write = ann
        .post(&env, &format!("{path}/messages"), json!({ "text": "wait" }))
        .await;
    assert_eq!(write.status, 404, "{}", text(&write));
    let again = ann.post(&env, &leave, json!({})).await;
    assert_eq!(again.status, 404, "{}", text(&again));

    let state = martin.get(&env, &path).await["state"].clone();
    let names: Vec<&str> = state["members"]
        .as_array()
        .unwrap()
        .iter()
        .map(|m| m["name"].as_str().unwrap())
        .collect();
    assert_eq!(names, ["chris", "martin", "bob"]);
    let notes = martin.get(&env, "/api/notification-center/inbox").await;
    assert!(
        notes["items"]
            .as_array()
            .unwrap()
            .iter()
            .any(|n| n["app"] == "messages"
                && n["title"] == "Ann Lee"
                && n["body"] == "left the conversation"),
        "{notes}"
    );
    let heard = ann.messages_changes(&env).await;
    martin.say(&env, &id, "Still on").await;
    assert_eq!(ann.messages_changes(&env).await, heard, "Ann hears nothing");
    assert_eq!(chris.list(&env).await[0]["last"]["text"], "Still on");
    assert!(ann.list(&env).await.is_empty());

    // Down to two, it can no longer be left; nor can a one-to-one.
    let bob_left = bob.post(&env, &leave, json!({})).await;
    assert_eq!(bob_left.status, 200, "{}", text(&bob_left));
    let last_two = chris.post(&env, &leave, json!({})).await;
    assert_eq!(last_two.status, 409, "{}", text(&last_two));
    let (_, direct) = start(&env, &mut chris, &["eve"]).await;
    let direct = direct["state"]["id"].as_str().unwrap().to_string();
    let refused = chris
        .post(
            &env,
            &format!("/api/messages/conversations/{direct}/leave"),
            json!({}),
        )
        .await;
    assert_eq!(refused.status, 409, "{}", text(&refused));
}

/// A person deletes a conversation: it leaves their list and its transcript, in
/// every browser of theirs, and the other person keeps everything. Something
/// new brings it back, with only what is new. Someone outside cannot do it.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_person_deletes_a_conversation_for_themselves() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut martin = sign_up(&env, "martin", "Martin Klein").await;
    let mut eve = sign_up(&env, "eve", "Eve Moss").await;
    let (status, made) = start(&env, &mut chris, &["martin"]).await;
    assert_eq!(status, 201, "{made}");
    let id = made["state"]["id"].as_str().unwrap().to_string();
    chris.say(&env, &id, "First").await;
    martin.say(&env, &id, "Second").await;
    let path = format!("/api/messages/conversations/{id}");
    let clear = format!("{path}/clear");

    let outside = eve.post(&env, &clear, json!({ "seq": 2 })).await;
    assert_eq!(outside.status, 404, "{}", text(&outside));

    let done = chris.post(&env, &clear, json!({ "seq": 2 })).await;
    assert_eq!(done.status, 200, "{}", text(&done));
    assert!(chris.list(&env).await.is_empty(), "gone from his list");
    let again = chris.post(&env, &clear, json!({ "seq": 1 })).await;
    assert_eq!(again.status, 200, "{}", text(&again));
    assert!(
        chris.list(&env).await.is_empty(),
        "a lower number takes nothing back"
    );
    let read = chris.get(&env, &path).await;
    assert_eq!(read["state"]["messages"], json!([]));

    let his = martin.get(&env, &path).await;
    assert_eq!(his["state"]["messages"].as_array().unwrap().len(), 2);
    assert_eq!(ids_of(&martin.list(&env).await), [id.clone()]);

    martin.say(&env, &id, "Third").await;
    assert_eq!(ids_of(&chris.list(&env).await), [id.clone()]);
    let back = chris.get(&env, &path).await;
    let texts: Vec<&str> = back["state"]["messages"]
        .as_array()
        .unwrap()
        .iter()
        .map(|m| m["text"].as_str().unwrap())
        .collect();
    assert_eq!(texts, ["Third"]);
    assert_eq!(
        chris.list(&env).await[0]["unread"],
        1,
        "what he deleted is not waiting to be read"
    );

    // A conversation with nothing in it goes too, and its first message brings it back.
    let (_, empty) = start(&env, &mut chris, &["eve"]).await;
    let empty = empty["state"]["id"].as_str().unwrap().to_string();
    let path = format!("/api/messages/conversations/{empty}");
    let done = chris
        .post(&env, &format!("{path}/clear"), json!({ "seq": 0 }))
        .await;
    assert_eq!(done.status, 200, "{}", text(&done));
    assert!(!ids_of(&chris.list(&env).await).contains(&empty));
    eve.say(&env, &empty, "Hello").await;
    assert!(ids_of(&chris.list(&env).await).contains(&empty));
}

async fn set_muted(env: &TestEnv, who: &mut Browser, id: &str, muted: bool) -> IngressReply {
    who.send(
        env,
        "PUT",
        &format!("/api/messages/muted/{id}"),
        &[("content-type", "application/json")],
        json!({ "muted": muted }).to_string().as_bytes(),
    )
    .await
}

async fn muted_of(env: &TestEnv, who: &mut Browser) -> Vec<String> {
    who.get(env, "/api/messages/muted").await["muted"]
        .as_array()
        .unwrap()
        .iter()
        .map(|id| id.as_str().unwrap().to_string())
        .collect()
}

/// Whether `who` has a Messages notification whose text is `body`.
async fn notified(env: &TestEnv, who: &mut Browser, body: &str) -> bool {
    who.get(env, "/api/notification-center/inbox").await["items"]
        .as_array()
        .unwrap()
        .iter()
        .any(|n| n["app"] == "messages" && n["body"] == body)
}

/// The store prefix of this person's own Messages space, found through their note to self.
async fn space_of(env: &TestEnv, who: &mut Browser, name: &str) -> String {
    let (_, own) = start(env, who, &[name]).await;
    let id = own["state"]["id"].as_str().unwrap().to_string();
    who.say(env, &id, "note").await;
    own_space(env, &id).await
}

async fn set_blocked(env: &TestEnv, who: &mut Browser, name: &str, blocked: bool) {
    let reply = who
        .send(
            env,
            "PUT",
            &format!("/api/messages/blocked/{name}"),
            &[("content-type", "application/json")],
            json!({ "blocked": blocked }).to_string().as_bytes(),
        )
        .await;
    assert_eq!(reply.status, 200, "{}", text(&reply));
}

/// Blocked or deleted messages that have moved to a page count as nothing unread either.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn what_a_person_does_not_see_on_a_page_is_not_unread() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris").await;
    let mut martin = sign_up(&env, "martin", "Martin").await;
    let (_, made) = start(&env, &mut martin, &["chris"]).await;
    let id = made["state"]["id"].as_str().unwrap().to_string();
    let first = martin.say(&env, &id, "seen by chris").await;
    let path = format!("/api/messages/conversations/{id}");
    let unread =
        |list: Vec<Value>| list.iter().find(|c| c["id"] == id.as_str()).unwrap()["unread"].clone();
    assert_eq!(unread(chris.list(&env).await), json!(1));
    let hide = chris
        .post(
            &env,
            &format!("{path}/messages/{}/hide", first["seq"]),
            json!({}),
        )
        .await;
    assert_eq!(hide.status, 200, "{}", text(&hide));
    set_blocked(&env, &mut chris, "martin", true).await;
    // More than the document keeps, so that the oldest move to a page.
    for each in 0..151 {
        martin.say(&env, &id, &format!("blocked {each}")).await;
    }
    crate::support::advance(&env, 1).await;
    set_blocked(&env, &mut chris, "martin", false).await;
    crate::support::advance(&env, 1).await;
    assert_eq!(unread(chris.list(&env).await), json!(0));
    let state = chris.get(&env, &path).await;
    assert!(
        state["state"]["pages"].as_u64().unwrap() > 0,
        "the messages moved to pages"
    );
    martin.say(&env, &id, "after the unblock").await;
    assert_eq!(unread(chris.list(&env).await), json!(1));
}

/// A clear makes room for more deletions: what it covers no longer counts against the limit.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_full_list_of_deletions_is_freed_by_clearing() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris").await;
    let space = space_of(&env, &mut chris, "chris").await;
    sign_up(&env, "martin", "Martin").await;
    let (_, made) = start(&env, &mut chris, &["martin"]).await;
    let id = made["state"]["id"].as_str().unwrap().to_string();
    let old = chris.say(&env, &id, "old").await;
    let path = format!("/api/messages/conversations/{id}");
    let seq = old["seq"].as_u64().unwrap();
    let full = serde_json::to_vec(&vec![seq; 2_000]).unwrap();
    let mut store = env.store("data");
    store
        .put(format!("{space}hidden/{id}").as_bytes(), &full)
        .await
        .unwrap();
    let newer = chris.say(&env, &id, "newer").await;
    let hide = format!("{path}/messages/{}/hide", newer["seq"]);
    let refused = chris.post(&env, &hide, json!({})).await;
    assert_eq!(refused.status, 409, "{}", text(&refused));
    let cleared = chris
        .post(
            &env,
            &format!("{path}/clear"),
            json!({ "seq": seq, "listed": true }),
        )
        .await;
    assert_eq!(cleared.status, 200, "{}", text(&cleared));
    let hidden = chris.post(&env, &hide, json!({})).await;
    assert_eq!(hidden.status, 200, "{}", text(&hidden));
    assert_eq!(chris.get(&env, &path).await["state"]["messages"], json!([]));
}

/// A group people have left down to two is still a group, and a conversation of two is not.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_blocked_persons_conversation_stays_listed_while_a_page_holds_what_was_said() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris").await;
    let mut martin = sign_up(&env, "martin", "Martin").await;
    let (_, made) = start(&env, &mut martin, &["chris"]).await;
    let id = made["state"]["id"].as_str().unwrap().to_string();
    martin.say(&env, &id, "seen by chris").await;
    crate::support::advance(&env, 1).await;
    set_blocked(&env, &mut chris, "martin", true).await;
    for each in 0..151 {
        martin.say(&env, &id, &format!("blocked {each}")).await;
    }
    assert!(ids_of(&chris.list(&env).await).contains(&id));
}

/// Someone blocked who adds the person to a group tells them nothing.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_blocked_person_adding_someone_sends_no_notification() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris").await;
    let mut martin = sign_up(&env, "martin", "Martin").await;
    sign_up(&env, "ann", "Ann").await;
    sign_up(&env, "bob", "Bob").await;
    set_blocked(&env, &mut chris, "martin", true).await;
    let (_, made) = start(&env, &mut martin, &["ann", "bob"]).await;
    let group = made["state"]["id"].as_str().unwrap().to_string();
    let added = martin
        .post(
            &env,
            &format!("/api/messages/conversations/{group}/members"),
            json!({ "to": "chris" }),
        )
        .await;
    assert_eq!(added.status, 201, "{}", text(&added));
    assert!(!notified(&env, &mut chris, "added you to the conversation").await);
}

/// A group people have left down to two is still a group, and a conversation of two is not.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_group_down_to_two_takes_someone_in() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris").await;
    let mut martin = sign_up(&env, "martin", "Martin").await;
    sign_up(&env, "ann", "Ann").await;
    sign_up(&env, "bob", "Bob").await;
    let (_, made) = start(&env, &mut chris, &["martin", "ann"]).await;
    let group = made["state"]["id"].as_str().unwrap().to_string();
    let (_, made) = start(&env, &mut chris, &["martin"]).await;
    let direct = made["state"]["id"].as_str().unwrap().to_string();
    let refused = chris
        .post(
            &env,
            &format!("/api/messages/conversations/{direct}/members"),
            json!({ "to": "bob" }),
        )
        .await;
    assert_eq!(refused.status, 409, "{}", text(&refused));

    let path = format!("/api/messages/conversations/{group}");
    let left = martin.post(&env, &format!("{path}/leave"), json!({})).await;
    assert_eq!(left.status, 200, "{}", text(&left));
    let list = chris.list(&env).await;
    let listed = |id: &str| list.iter().find(|c| c["id"] == id).unwrap()["group"].clone();
    assert_eq!(listed(&group), json!(true));
    assert_eq!(listed(&direct), json!(false));
    let added = chris
        .post(&env, &format!("{path}/members"), json!({ "to": "bob" }))
        .await;
    assert_eq!(added.status, 201, "{}", text(&added));
    assert_eq!(json_of(&added)["members"].as_array().unwrap().len(), 3);
}

/// Being added leaves what the person chose about their list: a conversation they deleted, which a
/// late addition finds, stays out until something is said. The first time it is listed.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn being_added_keeps_what_the_person_chose_about_their_list() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris").await;
    let mut martin = sign_up(&env, "martin", "Martin").await;
    let mut dan = sign_up(&env, "dan", "Dan").await;
    sign_up(&env, "ann", "Ann").await;
    sign_up(&env, "bob", "Bob").await;
    let space = space_of(&env, &mut chris, "chris").await;
    let (_, made) = start(&env, &mut martin, &["ann", "bob"]).await;
    let group = made["state"]["id"].as_str().unwrap().to_string();
    let path = format!("/api/messages/conversations/{group}");
    let mut store = env.store("data");
    store
        .put(format!("{space}cleared/{group}").as_bytes(), b"0")
        .await
        .unwrap();
    let add = |to: &str| json!({ "to": to });
    let late = martin
        .post(&env, &format!("{path}/members"), add("chris"))
        .await;
    assert_eq!(late.status, 201, "{}", text(&late));
    assert!(!ids_of(&chris.list(&env).await).contains(&group));
    martin.say(&env, &group, "back").await;
    assert!(ids_of(&chris.list(&env).await).contains(&group));

    let first = martin
        .post(&env, &format!("{path}/members"), add("dan"))
        .await;
    assert_eq!(first.status, 201, "{}", text(&first));
    assert!(ids_of(&dan.list(&env).await).contains(&group));
}

/// A record that cannot be understood, or one past the number a person may start, still hides.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_damaged_or_extra_block_still_hides_and_tells_nothing() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris").await;
    let mut martin = sign_up(&env, "martin", "Martin").await;
    let mut ann = sign_up(&env, "ann", "Ann").await;
    let space = space_of(&env, &mut chris, "chris").await;
    let mut store = env.store("data");
    for each in 0..200 {
        let record = json!({ "full_name": "", "spans": [[0, 1]] }).to_string();
        store
            .put(
                format!("{space}blocked/a{each:03}").as_bytes(),
                record.as_bytes(),
            )
            .await
            .unwrap();
    }
    store
        .put(format!("{space}blocked/martin").as_bytes(), b"not json")
        .await
        .unwrap();
    let (_, made) = start(&env, &mut martin, &["chris"]).await;
    let id = made["state"]["id"].as_str().unwrap().to_string();
    martin.say(&env, &id, "from martin").await;
    let path = format!("/api/messages/conversations/{id}");
    assert_eq!(chris.get(&env, &path).await["state"]["messages"], json!([]));
    assert!(!notified(&env, &mut chris, "from martin").await);

    let (_, made) = start(&env, &mut ann, &["chris"]).await;
    let from_ann = made["state"]["id"].as_str().unwrap().to_string();
    ann.say(&env, &from_ann, "from ann").await;
    assert!(
        notified(&env, &mut chris, "from ann").await,
        "others still reach them"
    );

    crate::support::advance(&env, 1).await;
    set_blocked(&env, &mut chris, "martin", false).await;
    crate::support::advance(&env, 1).await;
    martin.say(&env, &id, "after").await;
    let messages = chris.get(&env, &path).await["state"]["messages"].clone();
    assert_eq!(messages.as_array().unwrap().len(), 1, "{messages}");
    assert_eq!(messages[0]["text"], "after");
}

/// Do Not Disturb is kept on the server per account: a conversation one
/// person mutes sends them no notification (the message still arrives,
/// unread), the setting is theirs alone, each room is muted on its own, and
/// turning it off brings notifications back. Bad ids, a browser that never
/// signed in, and more than the bound are refused.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn do_not_disturb_is_kept_per_account_and_silences_only_that_conversation() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut martin = sign_up(&env, "martin", "Martin Klein").await;
    let mut ann = sign_up(&env, "ann", "Ann Lee").await;
    let (_, made) = start(&env, &mut chris, &["martin"]).await;
    let id = made["state"]["id"].as_str().unwrap().to_string();
    assert!(muted_of(&env, &mut martin).await.is_empty());

    let on = set_muted(&env, &mut martin, &id, true).await;
    assert_eq!(on.status, 200, "{}", text(&on));
    assert_eq!(muted_of(&env, &mut martin).await, [id.clone()]);
    assert!(
        muted_of(&env, &mut ann).await.is_empty(),
        "Ann's is her own"
    );
    assert!(muted_of(&env, &mut chris).await.is_empty(), "so is Chris's");

    chris.say(&env, &id, "Quiet please").await;
    assert!(
        !notified(&env, &mut martin, "Quiet please").await,
        "no notification"
    );
    assert_eq!(
        martin.list(&env).await[0]["unread"],
        1,
        "the message still arrives"
    );

    let off = set_muted(&env, &mut martin, &id, false).await;
    assert_eq!(off.status, 200, "{}", text(&off));
    assert!(muted_of(&env, &mut martin).await.is_empty());
    chris.say(&env, &id, "Loud again").await;
    assert!(notified(&env, &mut martin, "Loud again").await);

    // A room is muted on its own: muting the desktop's room leaves another
    // room's notifications as they were.
    for room in ["desktop", "other"] {
        martin
            .get(&env, &format!("/api/messages/rooms/{room}"))
            .await;
    }
    let room = set_muted(&env, &mut martin, "room-desktop", true).await;
    assert_eq!(room.status, 200, "{}", text(&room));
    for (room, words) in [("desktop", "room hello"), ("other", "other hello")] {
        let sent = chris
            .post(
                &env,
                &format!("/api/messages/rooms/{room}"),
                json!({ "text": words, "name": "Chris" }),
            )
            .await;
        assert_eq!(sent.status, 201, "{}", text(&sent));
    }
    assert!(!notified(&env, &mut martin, "room hello").await);
    assert!(notified(&env, &mut martin, "other hello").await);

    // Refusals.
    for bad in ["Room", "..%2Fx", "a%20b"] {
        let reply = set_muted(&env, &mut martin, bad, true).await;
        assert_eq!(reply.status, 400, "{bad}: {}", text(&reply));
    }
    let mut stranger = Browser { token: None };
    let reply = stranger
        .send(&env, "GET", "/api/messages/muted", &[], b"")
        .await;
    assert_eq!(reply.status, 200);
    assert_eq!(json_of(&reply), json!({ "muted": [] }));
    let reply = set_muted(&env, &mut stranger, &id, true).await;
    assert_eq!(reply.status, 401, "{}", text(&reply));
    // At most `MUTED_LIMIT` (200) at once: Martin has one already.
    for n in 1..200 {
        let reply = set_muted(&env, &mut martin, &format!("room-r{n}"), true).await;
        assert_eq!(reply.status, 200, "{n}: {}", text(&reply));
    }
    let over = set_muted(&env, &mut martin, &id, true).await;
    assert_eq!(over.status, 409, "{}", text(&over));
    // One already on is no new one.
    let again = set_muted(&env, &mut martin, "room-desktop", true).await;
    assert_eq!(again.status, 200, "{}", text(&again));
}

/// Upload `bytes` as an attachment and seal it: its id.
async fn upload(env: &TestEnv, who: &mut Browser, name: &str, bytes: &[u8]) -> String {
    let staged = who
        .post(
            env,
            "/api/messages/attachments",
            json!({ "name": name, "type": "text/plain", "size": bytes.len() }),
        )
        .await;
    assert_eq!(staged.status, 201, "{}", text(&staged));
    let id = json_of(&staged)["attachment"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let put = who
        .send(
            env,
            "PUT",
            &format!("/api/messages/attachments/{id}/0"),
            &[("content-type", "application/octet-stream")],
            bytes,
        )
        .await;
    assert_eq!(put.status, 200, "{}", text(&put));
    let sealed = who
        .post(
            env,
            &format!("/api/messages/attachments/{id}/complete"),
            json!({}),
        )
        .await;
    assert_eq!(sealed.status, 200, "{}", text(&sealed));
    id
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_conversations_files_reach_its_members_and_nobody_else() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut martin = sign_up(&env, "martin", "Martin Klein").await;
    let mut ann = sign_up(&env, "ann", "Ann Lee").await;
    let (status, made) = start(&env, &mut chris, &["martin"]).await;
    assert_eq!(status, 201, "{made}");
    let id = made["state"]["id"].as_str().unwrap().to_string();
    let send = format!("/api/messages/conversations/{id}/messages");

    let att = upload(&env, &mut chris, "plan.txt", b"the plan").await;
    let unkeyed = chris
        .post(&env, &send, json!({ "attachments": [att] }))
        .await;
    assert_eq!(unkeyed.status, 400, "{}", text(&unkeyed));

    // Someone outside takes nothing: their own file stays free for another message.
    let hers = upload(&env, &mut ann, "hers.txt", b"hers").await;
    let outside = ann
        .keyed(&env, &send, "k-out", json!({ "attachments": [hers] }))
        .await;
    assert_eq!(outside.status, 404, "{}", text(&outside));

    // A file alone is a message, and a resend under the key stores it once.
    let body = json!({ "attachments": [att] });
    let sent = chris.keyed(&env, &send, "k-1", body.clone()).await;
    assert_eq!(sent.status, 201, "{}", text(&sent));
    let again = chris.keyed(&env, &send, "k-1", body).await;
    assert_eq!(again.status, 200, "{}", text(&again));
    let state = martin
        .get(&env, &format!("/api/messages/conversations/{id}"))
        .await;
    let messages = state["state"]["messages"].as_array().unwrap();
    assert_eq!(messages.len(), 1, "{state}");
    assert_eq!(messages[0]["attachments"][0]["name"], "plan.txt");

    let url = format!("/api/messages/conversations/{id}/attachments/{att}");
    let read = martin.send(&env, "GET", &url, &[], b"").await;
    assert_eq!(read.status, 200, "{}", text(&read));
    assert_eq!(read.body, b"the plan");
    assert!(read
        .headers
        .iter()
        .any(|(n, v)| n.eq_ignore_ascii_case("content-disposition") && v == "attachment"));
    let peek = ann.send(&env, "GET", &url, &[], b"").await;
    assert_eq!(peek.status, 404, "{}", text(&peek));
    let other = upload(&env, &mut chris, "other.txt", b"other").await;
    let unnamed = martin
        .send(
            &env,
            "GET",
            &format!("/api/messages/conversations/{id}/attachments/{other}"),
            &[],
            b"",
        )
        .await;
    assert_eq!(unnamed.status, 404, "a file no message names is not read");

    // Sent once, it cannot go again under another key.
    let twice = chris
        .keyed(&env, &send, "k-2", json!({ "attachments": [att] }))
        .await;
    assert_eq!(twice.status, 409, "{}", text(&twice));
}

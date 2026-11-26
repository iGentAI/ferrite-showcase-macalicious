//! Mail between the accounts of the desktop, on the in-process Forge planes
//! (`ferrite-app-test`): delivery into the recipient's own mailbox and the
//! sender's Sent, two-person isolation, a resend that delivers nothing twice,
//! refusals of unknown and internet addresses, flags and moves, drafts, the
//! Trash and the recipient's notification.

use ferrite_app::{serde_json, IngressReply};
use ferrite_app_test::{ingress, TestEnv, TestHarness};
use serde_json::{json, Value};

const PEPPER: &str = "test-pepper-0123456789abcdef0123456789abcdef";
const PASSWORD: &str = "correct horse battery";
/// `SENDS_PER_DAY` in `src/apps/mail/mod.rs`.
const SENDS_PER_DAY: u32 = 200;

async fn boot() -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let env = TestHarness::new()
        .with_blob("files")
        .with_queue("requests")
        .with_queue("replies")
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

    async fn json(&mut self, env: &TestEnv, method: &str, path: &str, body: Value) -> IngressReply {
        self.send(
            env,
            method,
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

    async fn messages(&mut self, env: &TestEnv) -> Vec<Value> {
        self.get(env, "/api/mail/messages").await["messages"]
            .as_array()
            .unwrap()
            .clone()
    }
}

async fn sign_up(env: &TestEnv, name: &str, full_name: &str) -> Browser {
    let mut browser = Browser { token: None };
    let reply = browser
        .json(
            env,
            "POST",
            "/api/session/sign-up",
            json!({ "name": name, "full_name": full_name, "password": PASSWORD }),
        )
        .await;
    assert_eq!(reply.status, 201, "sign-up of {name}: {}", text(&reply));
    browser
}

fn in_box<'a>(messages: &'a [Value], mailbox: &str) -> Vec<&'a Value> {
    messages
        .iter()
        .filter(|m| m["mailbox"] == mailbox)
        .collect()
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_person_makes_renames_and_deletes_a_mailbox_of_their_own() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut martin = sign_up(&env, "martin", "Martin Klein").await;
    let sent = chris
        .json(
            &env,
            "POST",
            "/api/mail/send",
            json!({ "to": ["martin"], "subject": "Ferry times", "text": "Noon." }),
        )
        .await;
    assert_eq!(sent.status, 201, "{}", text(&sent));
    let id = martin.messages(&env).await[0]["id"]
        .as_str()
        .unwrap()
        .to_string();

    let made = martin
        .json(
            &env,
            "POST",
            "/api/mail/mailboxes",
            json!({ "name": " Trips " }),
        )
        .await;
    assert_eq!(made.status, 200, "{}", text(&made));
    let mailbox = json_of(&made)["mailbox"].clone();
    assert_eq!(mailbox["name"], "Trips");
    let box_id = mailbox["id"].as_str().unwrap().to_string();

    // The same name again answers the same mailbox: a resend makes nothing twice.
    let again = martin
        .json(
            &env,
            "POST",
            "/api/mail/mailboxes",
            json!({ "name": "trips" }),
        )
        .await;
    assert_eq!(json_of(&again)["mailbox"]["id"], box_id.as_str());
    let listed = martin.get(&env, "/api/mail/messages").await;
    assert_eq!(listed["mailboxes"].as_array().unwrap().len(), 1);

    // A name every person has already is refused; so is a move to a mailbox nobody made.
    let fixed = martin
        .json(
            &env,
            "POST",
            "/api/mail/mailboxes",
            json!({ "name": "Inbox" }),
        )
        .await;
    assert_eq!(fixed.status, 400);
    let nowhere = martin
        .json(
            &env,
            "PATCH",
            &format!("/api/mail/messages/{id}"),
            json!({ "mailbox": "box-0000000000000000" }),
        )
        .await;
    assert_eq!(nowhere.status, 404, "{}", text(&nowhere));

    // Another person neither sees nor changes it.
    let theirs = chris.get(&env, "/api/mail/messages").await;
    assert_eq!(theirs["mailboxes"], json!([]));
    let other = chris
        .json(
            &env,
            "PATCH",
            &format!("/api/mail/mailboxes/{box_id}"),
            json!({ "name": "Mine" }),
        )
        .await;
    assert_eq!(other.status, 404);

    let moved = martin
        .json(
            &env,
            "PATCH",
            &format!("/api/mail/messages/{id}"),
            json!({ "mailbox": box_id }),
        )
        .await;
    assert_eq!(moved.status, 200, "{}", text(&moved));
    assert_eq!(martin.messages(&env).await[0]["mailbox"], box_id.as_str());

    let second = martin
        .json(
            &env,
            "POST",
            "/api/mail/mailboxes",
            json!({ "name": "Work" }),
        )
        .await;
    assert_eq!(second.status, 200);
    let taken = martin
        .json(
            &env,
            "PATCH",
            &format!("/api/mail/mailboxes/{box_id}"),
            json!({ "name": "work" }),
        )
        .await;
    assert_eq!(taken.status, 409);
    let renamed = martin
        .json(
            &env,
            "PATCH",
            &format!("/api/mail/mailboxes/{box_id}"),
            json!({ "name": "Holidays" }),
        )
        .await;
    assert_eq!(json_of(&renamed)["mailbox"]["name"], "Holidays");

    // Deleting it moves what it holds to the Trash, and the delete can be sent twice.
    for _ in 0..2 {
        let gone = martin
            .send(
                &env,
                "DELETE",
                &format!("/api/mail/mailboxes/{box_id}"),
                &[],
                b"",
            )
            .await;
        assert_eq!(gone.status, 200, "{}", text(&gone));
        assert_eq!(json_of(&gone)["more"], false);
    }
    let after = martin.get(&env, "/api/mail/messages").await;
    assert_eq!(after["messages"][0]["mailbox"], "trash");
    assert_eq!(after["mailboxes"][0]["name"], "Work");
    assert_eq!(after["mailboxes"].as_array().unwrap().len(), 1);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn mail_goes_from_one_account_to_another_and_nowhere_else() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut martin = sign_up(&env, "martin", "Martin Klein").await;
    let mut ann = sign_up(&env, "ann", "Ann Lee").await;

    let me = chris.get(&env, "/api/mail/me").await;
    assert_eq!(me["address"], "chris@macalicious");

    let sent = chris
        .keyed(
            &env,
            "/api/mail/send",
            "key-1",
            json!({
                "to": ["Martin Klein <martin@macalicious>"],
                "subject": "Saturday",
                "text": "The north trail.\n\nChris",
                "html": "<div><b>The north trail.</b></div><div>Chris</div>",
            }),
        )
        .await;
    assert_eq!(sent.status, 201, "{}", text(&sent));
    assert_eq!(json_of(&sent)["delivered"], json!(["martin"]));

    let inbox = martin.messages(&env).await;
    let received = in_box(&inbox, "inbox");
    assert_eq!(received.len(), 1, "{inbox:?}");
    let message = received[0];
    assert_eq!(message["from"]["name"], "chris");
    assert_eq!(message["from"]["full_name"], "Chris Carter");
    assert_eq!(message["subject"], "Saturday");
    assert_eq!(message["unread"], true);
    assert_eq!(message["html"], true);
    assert!(in_box(&inbox, "sent").is_empty(), "Martin sent nothing");

    let id = message["id"].as_str().unwrap();
    let full = martin.get(&env, &format!("/api/mail/messages/{id}")).await;
    assert_eq!(full["text"], "The north trail.\n\nChris");
    assert_eq!(
        full["html"],
        "<div><b>The north trail.</b></div><div>Chris</div>"
    );

    let mine = chris.messages(&env).await;
    assert_eq!(in_box(&mine, "sent").len(), 1);
    assert!(
        in_box(&mine, "inbox").is_empty(),
        "a sender's Inbox gets no copy"
    );
    assert_eq!(in_box(&mine, "sent")[0]["to"][0]["name"], "martin");

    // Nobody else sees either copy, nor reads Martin's by its id.
    assert!(ann.messages(&env).await.is_empty());
    let peek = ann
        .send(&env, "GET", &format!("/api/mail/messages/{id}"), &[], b"")
        .await;
    assert_eq!(peek.status, 404, "{}", text(&peek));

    // The recipient is told.
    let notes = martin.get(&env, "/api/notification-center/inbox").await;
    let items = notes["items"].as_array().unwrap();
    assert!(
        items.iter().any(|n| n["app"] == "mail"
            && n["title"] == "Chris Carter"
            && n["subtitle"] == "Saturday"),
        "{notes}"
    );

    // A resend with the same key delivers nothing more and answers the same Sent copy.
    let again = chris
        .keyed(
            &env,
            "/api/mail/send",
            "key-1",
            json!({
                "to": ["Martin Klein <martin@macalicious>"],
                "subject": "Saturday",
                "text": "The north trail.\n\nChris",
                "html": "<div><b>The north trail.</b></div><div>Chris</div>",
            }),
        )
        .await;
    assert_eq!(again.status, 200, "{}", text(&again));
    assert_eq!(
        json_of(&again)["message"]["id"],
        in_box(&mine, "sent")[0]["id"]
    );
    assert_eq!(in_box(&martin.messages(&env).await, "inbox").len(), 1);
    // The same key with another message is refused.
    let reused = chris
        .keyed(
            &env,
            "/api/mail/send",
            "key-1",
            json!({ "to": ["martin"], "subject": "Other", "text": "x" }),
        )
        .await;
    assert_eq!(reused.status, 422, "{}", text(&reused));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn unknown_and_internet_addresses_are_refused_and_nothing_is_sent() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut martin = sign_up(&env, "martin", "Martin Klein").await;

    let unknown = chris
        .json(
            &env,
            "POST",
            "/api/mail/send",
            json!({ "to": ["martin", "nobody"], "subject": "Hi", "text": "x" }),
        )
        .await;
    assert_eq!(unknown.status, 422, "{}", text(&unknown));
    assert_eq!(json_of(&unknown)["unknown"], json!(["nobody"]));
    let outside = chris
        .json(
            &env,
            "POST",
            "/api/mail/send",
            json!({ "to": ["someone@example.com"], "subject": "Hi", "text": "x" }),
        )
        .await;
    assert_eq!(outside.status, 422, "{}", text(&outside));
    assert_eq!(json_of(&outside)["outside"], json!(["someone@example.com"]));
    let empty = chris
        .json(
            &env,
            "POST",
            "/api/mail/send",
            json!({ "to": [], "text": "x" }),
        )
        .await;
    assert_eq!(empty.status, 400);
    assert!(
        martin.messages(&env).await.is_empty(),
        "nothing was delivered"
    );
    assert!(chris.messages(&env).await.is_empty(), "nothing was sent");

    // A browser that never signed in has no mailbox: an empty list, and it
    // can send nothing.
    let mut stranger = Browser { token: None };
    let reply = stranger
        .send(&env, "GET", "/api/mail/messages", &[], b"")
        .await;
    assert_eq!(reply.status, 200, "{}", text(&reply));
    assert_eq!(json_of(&reply)["messages"], json!([]));
    let send = stranger
        .send(
            &env,
            "POST",
            "/api/mail/send",
            &[],
            br#"{"to":["martin"],"text":"x"}"#,
        )
        .await;
    assert_eq!(send.status, 401, "{}", text(&send));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn flags_moves_drafts_and_the_trash_stay_in_one_mailbox() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut martin = sign_up(&env, "martin", "Martin Klein").await;

    // A draft, saved and saved again, then sent from: it leaves Drafts.
    let draft = chris
        .json(
            &env,
            "POST",
            "/api/mail/drafts",
            json!({ "to": ["martin"], "subject": "Plan", "text": "first" }),
        )
        .await;
    assert_eq!(draft.status, 200, "{}", text(&draft));
    let first = json_of(&draft)["message"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let again = chris
        .json(
            &env,
            "POST",
            "/api/mail/drafts",
            json!({ "id": first, "to": ["martin"], "subject": "Plan", "text": "second" }),
        )
        .await;
    let second = json_of(&again)["message"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let drafts = in_box(&chris.messages(&env).await, "drafts")
        .into_iter()
        .cloned()
        .collect::<Vec<_>>();
    assert_eq!(drafts.len(), 1, "the second save replaced the first");
    assert_eq!(drafts[0]["id"], second.as_str());
    assert_eq!(drafts[0]["text"], "second");
    let sent = chris
        .json(
            &env,
            "POST",
            "/api/mail/send",
            json!({ "to": ["martin"], "subject": "Plan", "text": "second", "draft": second }),
        )
        .await;
    assert_eq!(sent.status, 201, "{}", text(&sent));
    let mine = chris.messages(&env).await;
    assert!(
        in_box(&mine, "drafts").is_empty(),
        "the sent draft left Drafts"
    );

    // Martin reads, flags, mutes and files his copy; Chris's copy does not change.
    let id = martin.messages(&env).await[0]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let path = format!("/api/mail/messages/{id}");
    let patched = martin
        .json(
            &env,
            "PATCH",
            &path,
            json!({ "unread": false, "flag": "green", "muted": true }),
        )
        .await;
    assert_eq!(patched.status, 200, "{}", text(&patched));
    let message = json_of(&patched)["message"].clone();
    assert_eq!(
        (&message["unread"], &message["flag"], &message["muted"]),
        (&json!(false), &json!("green"), &json!(true))
    );
    let bad = martin
        .json(&env, "PATCH", &path, json!({ "flag": "pink" }))
        .await;
    assert_eq!(bad.status, 400);
    // Chris cannot change Martin's copy while it exists.
    let foreign = chris
        .json(&env, "PATCH", &path, json!({ "unread": true }))
        .await;
    assert_eq!(foreign.status, 404);
    let still = martin.messages(&env).await;
    assert_eq!(still[0]["id"], json!(id));
    assert_eq!(still[0]["unread"], false);
    let not_yet = martin.send(&env, "DELETE", &path, &[], b"").await;
    assert_eq!(not_yet.status, 409, "only the Trash is erased");
    let archived = martin
        .json(
            &env,
            "PATCH",
            &path,
            json!({ "mailbox": "archive", "flag": null }),
        )
        .await;
    assert_eq!(json_of(&archived)["message"]["mailbox"], "archive");
    assert!(json_of(&archived)["message"].get("flag").is_none());
    martin
        .json(&env, "PATCH", &path, json!({ "mailbox": "trash" }))
        .await;
    let erased = martin.send(&env, "DELETE", &path, &[], b"").await;
    assert_eq!(json_of(&erased)["erased"], 1);
    assert!(martin.messages(&env).await.is_empty());
    // Chris's Sent copy is untouched by all of it.
    let mine = chris.messages(&env).await;
    assert_eq!(in_box(&mine, "sent").len(), 1);
    assert!(mine[0].get("flag").is_none());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_sent_draft_leaves_drafts_and_every_message_is_listed() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut martin = sign_up(&env, "martin", "Martin Klein").await;

    let saved = chris
        .json(
            &env,
            "POST",
            "/api/mail/drafts",
            json!({ "to": ["martin"], "cc": [], "subject": "Plan", "text": "the plan" }),
        )
        .await;
    assert_eq!(saved.status, 200, "{}", text(&saved));
    let draft_id = json_of(&saved)["message"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let read = chris
        .get(&env, &format!("/api/mail/messages/{draft_id}"))
        .await;
    assert_eq!(read["text"], "the plan");
    let sent = chris
        .keyed(
            &env,
            "/api/mail/send",
            "send-1",
            json!({ "to": ["martin"], "subject": "Plan", "text": "the plan", "draft": draft_id }),
        )
        .await;
    assert_eq!(sent.status, 201, "{}", text(&sent));
    assert_eq!(martin.messages(&env).await.len(), 1);
    assert!(
        in_box(&chris.messages(&env).await, "drafts").is_empty(),
        "the sent draft is gone"
    );
    // A resend of the same request answers the same message and delivers nothing twice.
    let resent = chris
        .keyed(
            &env,
            "/api/mail/send",
            "send-1",
            json!({ "to": ["martin"], "subject": "Plan", "text": "the plan", "draft": draft_id }),
        )
        .await;
    assert_eq!(resent.status, 200, "{}", text(&resent));
    assert_eq!(
        json_of(&resent)["message"]["id"],
        json_of(&sent)["message"]["id"]
    );
    assert_eq!(json_of(&resent)["delivered"], json!(["martin"]));
    assert_eq!(martin.messages(&env).await.len(), 1);

    // A body past one stored value is refused before anything is kept.
    let huge = chris
        .json(
            &env,
            "POST",
            "/api/mail/drafts",
            json!({ "to": [], "cc": [], "subject": "Big", "text": "x".repeat(99_000),
                    "html": "y".repeat(99_000) }),
        )
        .await;
    assert_eq!(huge.status, 413, "{}", text(&huge));

    // More messages than one page: the cursor reaches every one.
    for n in 0..505 {
        // Each a millisecond newer: the Sent copy stays the oldest.
        crate::support::advance(&env, 1).await;
        let draft = chris
            .json(
                &env,
                "POST",
                "/api/mail/drafts",
                json!({ "to": [], "cc": [], "subject": format!("d{n}"), "text": "" }),
            )
            .await;
        assert_eq!(draft.status, 200, "{}", text(&draft));
    }
    // A page reads 500 entries; the sent draft's tombstone is one of them
    // wherever it sorts, so a page may hold one message fewer.
    let first = chris.get(&env, "/api/mail/messages").await;
    let on_first = first["messages"].as_array().unwrap().len();
    assert!((499..=500).contains(&on_first), "{on_first}");
    let next = first["next"].as_str().expect("a cursor").to_string();
    let second = chris
        .get(&env, &format!("/api/mail/messages?after={next}"))
        .await;
    // 505 drafts and the Sent copy.
    assert_eq!(on_first + second["messages"].as_array().unwrap().len(), 506);
    assert!(second["next"].is_null());
    let bad = chris
        .send(&env, "GET", "/api/mail/messages?after=../x", &[], b"")
        .await;
    assert_eq!(bad.status, 400);

    // The oldest message, under 505 newer ones, is trashed and erased by id.
    let sent_id = second["messages"]
        .as_array()
        .unwrap()
        .iter()
        .find(|m| m["mailbox"] == "sent")
        .unwrap()["id"]
        .as_str()
        .unwrap()
        .to_string();
    let trashed = chris
        .json(
            &env,
            "PATCH",
            &format!("/api/mail/messages/{sent_id}"),
            json!({ "mailbox": "trash" }),
        )
        .await;
    assert_eq!(trashed.status, 200);
    let erased = chris
        .send(
            &env,
            "DELETE",
            &format!("/api/mail/messages/{sent_id}"),
            &[],
            b"",
        )
        .await;
    assert_eq!(json_of(&erased)["erased"], 1, "{}", text(&erased));
    let gone = chris
        .send(
            &env,
            "GET",
            &format!("/api/mail/messages/{sent_id}"),
            &[],
            b"",
        )
        .await;
    assert_eq!(gone.status, 404);
}

/// One person's sends a day are bounded, a resend of a stored send takes
/// nothing from the allowance, and a field Mail does not know is refused
/// rather than dropped.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_day_of_sends_is_bounded_and_unknown_fields_are_refused() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut martin = sign_up(&env, "martin", "Martin Klein").await;

    let attached = chris
        .json(
            &env,
            "POST",
            "/api/mail/send",
            json!({ "to": ["martin"], "subject": "Photo", "text": "x", "importance": "high" }),
        )
        .await;
    assert_eq!(attached.status, 400, "{}", text(&attached));
    let attached = chris
        .json(
            &env,
            "POST",
            "/api/mail/drafts",
            json!({ "to": ["martin"], "subject": "Photo", "text": "x", "importance": "high" }),
        )
        .await;
    assert_eq!(attached.status, 400, "{}", text(&attached));
    assert!(martin.messages(&env).await.is_empty());

    let body = |n: u32| json!({ "to": ["martin"], "subject": format!("n{n}"), "text": "x" });
    for n in 0..SENDS_PER_DAY {
        let sent = chris
            .keyed(&env, "/api/mail/send", &format!("k{n}"), body(n))
            .await;
        assert_eq!(sent.status, 201, "send {n}: {}", text(&sent));
    }
    let over = chris
        .keyed(&env, "/api/mail/send", "one-more", body(9_999))
        .await;
    assert_eq!(over.status, 429, "{}", text(&over));
    // A resend of the refused send is refused too: nothing is delivered uncharged.
    let resent = chris
        .keyed(&env, "/api/mail/send", "one-more", body(9_999))
        .await;
    assert_eq!(resent.status, 429, "{}", text(&resent));
    // A resend of a send already made still answers it.
    let again = chris.keyed(&env, "/api/mail/send", "k0", body(0)).await;
    assert_eq!(again.status, 200, "{}", text(&again));
    let inbox = martin.messages(&env).await;
    assert_eq!(in_box(&inbox, "inbox").len(), SENDS_PER_DAY as usize);

    // The next day the allowance is whole again.
    env.clock().advance_ms(24 * 60 * 60 * 1000);
    let next_day = chris
        .keyed(&env, "/api/mail/send", "one-more", body(9_999))
        .await;
    assert_eq!(next_day.status, 201, "{}", text(&next_day));
}

/// An erasure that stopped after its tombstone and before the text was
/// deleted (a failed delete) is finished by the next listing: an erased
/// message's text never stays stored.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_message_sent_again_from_a_later_draft_is_delivered_once() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut martin = sign_up(&env, "martin", "Martin Klein").await;
    let message = json!({ "to": ["martin"], "subject": "Once", "text": "only once" });

    // The first answer was lost, and what the window held was saved as a draft.
    let first = chris
        .keyed(&env, "/api/mail/send", "lost", message.clone())
        .await;
    assert_eq!(first.status, 201, "{}", text(&first));
    let saved = chris
        .json(&env, "POST", "/api/mail/drafts", message.clone())
        .await;
    assert_eq!(json_of(&saved)["message"], Value::Null, "already delivered");

    let again = chris
        .keyed(&env, "/api/mail/send", "lost", message.clone())
        .await;
    assert_eq!(again.status, 200, "{}", text(&again));
    assert_eq!(
        in_box(&martin.messages(&env).await, "inbox").len(),
        1,
        "delivered once"
    );
    let listed = chris.messages(&env).await;
    assert!(in_box(&listed, "drafts").is_empty(), "the draft went");
    assert_eq!(in_box(&listed, "sent").len(), 1);

    let other = chris
        .keyed(
            &env,
            "/api/mail/send",
            "lost",
            json!({ "to": ["martin"], "subject": "Once", "text": "changed" }),
        )
        .await;
    assert_eq!(
        other.status,
        422,
        "another message under that key: {}",
        text(&other)
    );
}

/// A send's record written before a record ignored the draft holds the hash of the whole
/// request: the same request under its key still continues that send.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_send_recorded_by_the_whole_request_is_still_recognised() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut martin = sign_up(&env, "martin", "Martin Klein").await;
    let message = json!({ "to": ["martin"], "subject": "Old", "text": "record", "draft": "none" });
    let first = chris
        .keyed(&env, "/api/mail/send", "old", message.clone())
        .await;
    assert_eq!(first.status, 201, "{}", text(&first));

    let mut store = env.store("data");
    let (rows, _) = store
        .scan_prefix(b"apps/mail/users/", None, 200)
        .await
        .expect("scan");
    let (key, value, _) = rows
        .iter()
        .find(|(key, _, _)| String::from_utf8_lossy(key).contains("/sent/"))
        .expect("the send's record");
    let mut record: Value = serde_json::from_slice(value).expect("record");
    let whole = ferrite_app::crypto::sha256(message.to_string().as_bytes());
    record["payload"] = json!(ferrite_app::crypto::hex(&whole));
    store
        .put(key, record.to_string().as_bytes())
        .await
        .expect("put");

    let again = chris.keyed(&env, "/api/mail/send", "old", message).await;
    assert_eq!(again.status, 200, "{}", text(&again));
    assert_eq!(in_box(&martin.messages(&env).await, "inbox").len(), 1);
}

/// A send that stopped after storing its Sent copy, resent after that copy
/// was erased: the copy stays erased, and the answer says so.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn an_unfinished_send_does_not_bring_back_an_erased_sent_copy() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut martin = sign_up(&env, "martin", "Martin Klein").await;
    let message = json!({ "to": ["martin"], "subject": "Gone", "text": "erased" });
    let first = chris
        .keyed(&env, "/api/mail/send", "stopped", message.clone())
        .await;
    assert_eq!(first.status, 201, "{}", text(&first));
    let id = json_of(&first)["message"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let path = format!("/api/mail/messages/{id}");
    chris
        .json(&env, "PATCH", &path, json!({ "mailbox": "trash" }))
        .await;
    let erased = chris.send(&env, "DELETE", &path, &[], b"").await;
    assert_eq!(json_of(&erased)["erased"], 1);

    // The record as a send that stopped before it was closed leaves it.
    let mut store = env.store("data");
    let (rows, _) = store
        .scan_prefix(b"apps/mail/users/", None, 200)
        .await
        .expect("scan");
    let (key, value, _) = rows
        .iter()
        .find(|(key, _, _)| String::from_utf8_lossy(key).contains("/sent/"))
        .expect("the send's record");
    let mut record: Value = serde_json::from_slice(value).expect("record");
    record["done"] = json!(false);
    store
        .put(key, record.to_string().as_bytes())
        .await
        .expect("put");

    let again = chris
        .keyed(&env, "/api/mail/send", "stopped", message)
        .await;
    assert_eq!(again.status, 409, "{}", text(&again));
    assert!(in_box(&chris.messages(&env).await, "sent").is_empty());
    assert_eq!(in_box(&martin.messages(&env).await, "inbox").len(), 1);
}

/// An erasure that stopped after its tombstone and before the text was
/// deleted (a failed delete) is finished by the next listing: an erased
/// message's text never stays stored.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn an_unfinished_erasure_is_finished_by_the_next_listing() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let saved = chris
        .json(
            &env,
            "POST",
            "/api/mail/drafts",
            json!({ "to": ["martin"], "subject": "Later", "text": "unfinished" }),
        )
        .await;
    assert_eq!(saved.status, 200, "{}", text(&saved));
    let id = json_of(&saved)["message"]["id"]
        .as_str()
        .unwrap()
        .to_string();

    // Find the draft's keys, and leave it as an erasure that stopped part way.
    let mut store = env.store("data");
    let (rows, _) = store
        .scan_prefix(b"apps/mail/users/", None, 100)
        .await
        .expect("scan");
    let header = rows
        .iter()
        .map(|(key, _, _)| String::from_utf8_lossy(key).into_owned())
        .find(|key| key.ends_with(&format!("/m/{id}")))
        .expect("the draft's header");
    let body = header.replace(&format!("/m/{id}"), &format!("/b/{id}"));
    store
        .put(header.as_bytes(), br#"{"erased":true,"text":true}"#)
        .await
        .expect("put");
    assert!(store.get(body.as_bytes()).await.expect("get").is_some());

    assert!(
        chris.messages(&env).await.is_empty(),
        "erased, as far as anyone sees"
    );
    assert!(
        store.get(body.as_bytes()).await.expect("get").is_none(),
        "the listing deleted the text"
    );
    assert_eq!(
        store.get(header.as_bytes()).await.expect("get").as_deref(),
        Some(&br#"{"erased":true}"#[..]),
        "and finished the tombstone"
    );
}

/// A Guest User, which needs no account and whose allowance ends with it,
/// sends no mail; its drafts are its own.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_guest_sends_no_mail() {
    let env = boot().await;
    let mut martin = sign_up(&env, "martin", "Martin Klein").await;
    let mut guest = Browser { token: None };
    let reply = guest
        .json(&env, "POST", "/api/session/guest", json!({}))
        .await;
    assert_eq!(reply.status, 201, "{}", text(&reply));
    let sent = guest
        .json(
            &env,
            "POST",
            "/api/mail/send",
            json!({ "to": ["martin"], "subject": "Hello", "text": "x" }),
        )
        .await;
    assert_eq!(sent.status, 403, "{}", text(&sent));
    assert!(martin.messages(&env).await.is_empty());
    let draft = guest
        .json(
            &env,
            "POST",
            "/api/mail/drafts",
            json!({ "to": ["martin"], "subject": "Hello", "text": "x" }),
        )
        .await;
    assert_eq!(draft.status, 200, "{}", text(&draft));
    let staged = guest
        .json(
            &env,
            "POST",
            "/api/mail/attachments",
            json!({ "name": "a.txt", "size": 1 }),
        )
        .await;
    assert_eq!(staged.status, 403, "{}", text(&staged));
}

/// An upload nobody finished loses its bytes a day later, when the person next
/// lists their mail; what a draft holds or a message names keeps its bytes.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn abandoned_uploads_are_cleared_and_kept_files_are_not() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut martin = sign_up(&env, "martin", "Martin Klein").await;
    let held = upload(&env, &mut chris, "held.txt", b"held").await;
    let saved = chris
        .json(
            &env,
            "POST",
            "/api/mail/drafts",
            json!({ "subject": "Later", "text": "x", "attachments": [held] }),
        )
        .await;
    assert_eq!(saved.status, 200, "{}", text(&saved));
    let draft = json_of(&saved)["message"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let sent = upload(&env, &mut chris, "sent.txt", b"sent").await;
    let reply = chris
        .json(
            &env,
            "POST",
            "/api/mail/send",
            json!({ "to": ["martin"], "subject": "Now", "text": "x", "attachments": [sent] }),
        )
        .await;
    assert_eq!(reply.status, 201, "{}", text(&reply));

    // Staged and one piece written, never sealed.
    let staged = chris
        .json(
            &env,
            "POST",
            "/api/mail/attachments",
            json!({ "name": "left.txt", "size": 4 }),
        )
        .await;
    let left = json_of(&staged)["attachment"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let put = chris
        .send(
            &env,
            "PUT",
            &format!("/api/mail/attachments/{left}/0"),
            &[("content-type", "application/octet-stream")],
            b"left",
        )
        .await;
    assert_eq!(put.status, 200, "{}", text(&put));
    let marker = format!("/att/{left}/done/00000");
    let mut store = env.store("data");
    let (entries, _) = store
        .scan_prefix(b"apps/mail/users/", None, 500)
        .await
        .unwrap();
    let (_, attempt, _) = entries
        .into_iter()
        .find(|(key, _, _)| String::from_utf8_lossy(key).ends_with(&marker))
        .expect("the piece's marker");
    let piece = format!(
        "mail/att/{left}/00000-{}",
        String::from_utf8_lossy(&attempt)
    );
    let mut blobs = env.blob("files");
    assert!(blobs.get(piece.as_bytes()).await.unwrap().is_some());

    chris.messages(&env).await;
    assert!(
        blobs.get(piece.as_bytes()).await.unwrap().is_some(),
        "not before its day has passed"
    );
    crate::support::advance(&env, 24 * 60 * 60 * 1000 + 1).await;
    chris.messages(&env).await;
    assert!(
        blobs.get(piece.as_bytes()).await.unwrap().is_none(),
        "its bytes are gone"
    );
    let late = chris
        .json(
            &env,
            "POST",
            &format!("/api/mail/attachments/{left}/complete"),
            json!({}),
        )
        .await;
    assert_eq!(late.status, 404, "{}", text(&late));

    // The draft still sends what it holds, and the message's copy still reads.
    let received = martin.messages(&env).await;
    let id = received[0]["id"].as_str().unwrap();
    let bytes = martin
        .send(
            &env,
            "GET",
            &format!("/api/mail/messages/{id}/attachments/{sent}"),
            &[],
            b"",
        )
        .await;
    assert_eq!(bytes.body, b"sent");
    let from_draft = chris
        .json(
            &env,
            "POST",
            "/api/mail/send",
            json!({ "to": ["martin"], "subject": "Later", "text": "x",
                    "attachments": [held], "draft": draft }),
        )
        .await;
    assert_eq!(from_draft.status, 201, "{}", text(&from_draft));
}

/// However many files drafts keep, a sweep goes on from where the last stopped
/// and reaches every abandoned upload.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn what_drafts_keep_does_not_hide_abandoned_uploads() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    // 30 kept files, each a record and a marker: past one sweep's 32 entries.
    for _ in 0..3 {
        let mut files = Vec::new();
        for n in 0..10 {
            files.push(upload(&env, &mut chris, &format!("{n}.txt"), b"kept").await);
        }
        let saved = chris
            .json(
                &env,
                "POST",
                "/api/mail/drafts",
                json!({ "subject": "Keep", "text": "x", "attachments": files }),
            )
            .await;
        assert_eq!(saved.status, 200, "{}", text(&saved));
    }
    let mut left = Vec::new();
    for _ in 0..4 {
        let staged = chris
            .json(
                &env,
                "POST",
                "/api/mail/attachments",
                json!({ "name": "left.txt", "size": 4 }),
            )
            .await;
        left.push(
            json_of(&staged)["attachment"]["id"]
                .as_str()
                .unwrap()
                .to_string(),
        );
    }
    crate::support::advance(&env, 24 * 60 * 60 * 1000 + 1).await;
    for _ in 0..4 {
        chris.messages(&env).await;
    }
    let (entries, _) = env
        .store("data")
        .scan_prefix(b"apps/mail/users/", None, 500)
        .await
        .unwrap();
    let keys: Vec<String> = entries
        .iter()
        .map(|(key, _, _)| String::from_utf8_lossy(key).into_owned())
        .collect();
    for id in left {
        let record = format!("/att/{id}");
        assert!(
            !keys.iter().any(|key| key.ends_with(&record)),
            "{id} is left"
        );
    }
}

/// One upload may begin only so many objects, however often a piece is sent.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn an_upload_begins_a_bounded_number_of_objects() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let staged = chris
        .json(
            &env,
            "POST",
            "/api/mail/attachments",
            json!({ "name": "a.txt", "size": 4 }),
        )
        .await;
    let id = json_of(&staged)["attachment"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let mut store = env.store("data");
    let (entries, _) = store
        .scan_prefix(b"apps/mail/users/", None, 100)
        .await
        .unwrap();
    let record = format!("/att/{id}");
    let (key, value, _) = entries
        .into_iter()
        .find(|(key, _, _)| String::from_utf8_lossy(key).ends_with(&record))
        .expect("the upload's record");
    let mut spent: Value = serde_json::from_slice(&value).unwrap();
    // Every attempt the limit allows a one-piece upload has been made.
    spent["attempts"] = json!(18);
    store.put(&key, spent.to_string().as_bytes()).await.unwrap();
    let put = chris
        .send(
            &env,
            "PUT",
            &format!("/api/mail/attachments/{id}/0"),
            &[("content-type", "application/octet-stream")],
            b"left",
        )
        .await;
    assert_eq!(put.status, 409, "{}", text(&put));
    assert!(text(&put).contains("too many times"), "{}", text(&put));
}

/// A send refused for one file takes none of the others: they go with the
/// next message.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_send_refused_for_one_file_leaves_the_others_free() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let _martin = sign_up(&env, "martin", "Martin Klein").await;
    let good = upload(&env, &mut chris, "good.txt", b"good").await;
    let gone = upload(&env, &mut chris, "gone.txt", b"gone").await;
    let cancelled = chris
        .send(
            &env,
            "DELETE",
            &format!("/api/mail/attachments/{gone}"),
            &[],
            b"",
        )
        .await;
    assert_eq!(json_of(&cancelled)["cancelled"], true);
    let refused = chris
        .json(
            &env,
            "POST",
            "/api/mail/send",
            json!({ "to": ["martin"], "subject": "Both", "text": "x", "attachments": [good, gone] }),
        )
        .await;
    assert_eq!(refused.status, 409, "{}", text(&refused));
    let draft = chris
        .json(
            &env,
            "POST",
            "/api/mail/drafts",
            json!({ "subject": "Both", "text": "x", "attachments": [good, gone] }),
        )
        .await;
    assert_eq!(draft.status, 409, "{}", text(&draft));
    let sent = chris
        .json(
            &env,
            "POST",
            "/api/mail/send",
            json!({ "to": ["martin"], "subject": "One", "text": "x", "attachments": [good] }),
        )
        .await;
    assert_eq!(sent.status, 201, "{}", text(&sent));
}

/// A draft holds its attachments until it is sent, and a resend of the send
/// takes them again and delivers nothing twice.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_draft_keeps_its_attachments_until_it_is_sent() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut martin = sign_up(&env, "martin", "Martin Klein").await;
    let att = upload(&env, &mut chris, "plan.txt", b"the plan").await;
    let saved = chris
        .json(
            &env,
            "POST",
            "/api/mail/drafts",
            json!({ "to": [], "cc": [], "subject": "", "text": "", "attachments": [att] }),
        )
        .await;
    assert_eq!(saved.status, 200, "{}", text(&saved));
    let draft = json_of(&saved)["message"].clone();
    assert_eq!(draft["attachments"][0]["name"], "plan.txt");
    let draft_id = draft["id"].as_str().unwrap().to_string();
    let cancel = chris
        .send(
            &env,
            "DELETE",
            &format!("/api/mail/attachments/{att}"),
            &[],
            b"",
        )
        .await;
    assert_eq!(json_of(&cancel)["cancelled"], false, "the draft holds it");
    let read = chris
        .get(&env, &format!("/api/mail/messages/{draft_id}"))
        .await;
    assert_eq!(read["message"]["attachments"][0]["id"], att.as_str());
    let body = json!({ "to": ["martin"], "subject": "Plan", "text": "see attached",
                       "attachments": [att], "draft": draft_id });
    for status in [201, 200] {
        let sent = chris
            .keyed(&env, "/api/mail/send", "send-1", body.clone())
            .await;
        assert_eq!(sent.status, status, "{}", text(&sent));
    }
    let received = martin.messages(&env).await;
    assert_eq!(received.len(), 1, "delivered once");
    let id = received[0]["id"].as_str().unwrap();
    let bytes = martin
        .send(
            &env,
            "GET",
            &format!("/api/mail/messages/{id}/attachments/{att}"),
            &[],
            b"",
        )
        .await;
    assert_eq!(bytes.body, b"the plan");
    assert!(
        in_box(&chris.messages(&env).await, "drafts").is_empty(),
        "the sent draft is gone"
    );
}

/// A page of headers stops at about a megabyte, whatever its messages hold,
/// and the cursor still reaches every one.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_page_of_long_messages_stays_within_the_reply_limit() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    // Each header keeps 4,000 characters of the text, which JSON writes in
    // six bytes each: about 24 KB a header.
    let long = "\u{1}".repeat(4_000);
    for n in 0..120 {
        crate::support::advance(&env, 1).await;
        let saved = chris
            .json(
                &env,
                "POST",
                "/api/mail/drafts",
                json!({ "to": [], "subject": format!("d{n}"), "text": long }),
            )
            .await;
        assert_eq!(saved.status, 200, "{}", text(&saved));
    }
    let mut seen = 0;
    let mut after: Option<String> = None;
    let mut pages = 0;
    loop {
        let path = match &after {
            Some(next) => format!("/api/mail/messages?after={next}"),
            None => "/api/mail/messages".to_string(),
        };
        let reply = chris.send(&env, "GET", &path, &[], b"").await;
        assert_eq!(reply.status, 200, "{}", text(&reply));
        assert!(
            reply.body.len() < 2 * 1024 * 1024,
            "a page of {} bytes",
            reply.body.len()
        );
        let page = json_of(&reply);
        seen += page["messages"].as_array().unwrap().len();
        pages += 1;
        match page["next"].as_str() {
            Some(next) => after = Some(next.to_string()),
            None => break,
        }
        assert!(pages < 20, "the cursor moves on");
    }
    assert_eq!(seen, 120);
    assert!(pages > 1, "the long previews took more than one page");
}

/// A draft saved with the browser's idempotency key is stored once: a resend
/// of the same save (an answer lost on the way) answers the same draft and
/// leaves one draft, also when the save replaced an earlier one; the same key
/// with another draft is refused; a resend after the draft was sent finds it
/// gone. A save without a key makes a draft of its own each time, as before.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_keyed_draft_save_is_stored_once() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let _martin = sign_up(&env, "martin", "Martin Klein").await;
    let drafts = |messages: &[Value]| -> Vec<String> {
        in_box(messages, "drafts")
            .iter()
            .map(|m| m["id"].as_str().unwrap().to_string())
            .collect()
    };

    let body = json!({ "to": ["martin"], "subject": "Plan", "text": "first" });
    let saved = chris
        .keyed(&env, "/api/mail/drafts", "d-1", body.clone())
        .await;
    assert_eq!(saved.status, 200, "{}", text(&saved));
    let first = json_of(&saved)["message"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    crate::support::advance(&env, 5).await;
    let resent = chris
        .keyed(&env, "/api/mail/drafts", "d-1", body.clone())
        .await;
    assert_eq!(resent.status, 200, "{}", text(&resent));
    assert_eq!(
        json_of(&resent)["message"],
        json_of(&saved)["message"],
        "the same draft"
    );
    assert_eq!(
        drafts(&chris.messages(&env).await),
        [first.clone()],
        "stored once"
    );

    let other = chris
        .keyed(
            &env,
            "/api/mail/drafts",
            "d-1",
            json!({ "to": ["martin"], "subject": "Plan", "text": "changed" }),
        )
        .await;
    assert_eq!(other.status, 422, "{}", text(&other));

    // A keyed save that replaces the first draft, resent: still one draft.
    let replace = json!({ "id": first, "to": ["martin"], "subject": "Plan", "text": "second" });
    let second = chris
        .keyed(&env, "/api/mail/drafts", "d-2", replace.clone())
        .await;
    assert_eq!(second.status, 200, "{}", text(&second));
    let second_id = json_of(&second)["message"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    assert_ne!(second_id, first);
    let again = chris
        .keyed(&env, "/api/mail/drafts", "d-2", replace.clone())
        .await;
    assert_eq!(again.status, 200, "{}", text(&again));
    assert_eq!(json_of(&again)["message"]["id"], second_id.as_str());
    let listed = chris.messages(&env).await;
    assert_eq!(drafts(&listed), [second_id.clone()]);
    assert_eq!(in_box(&listed, "drafts")[0]["text"], "second");

    // Sent: a late resend of the save finds the draft gone, and makes none.
    let sent = chris
        .json(
            &env,
            "POST",
            "/api/mail/send",
            json!({ "to": ["martin"], "subject": "Plan", "text": "second", "draft": second_id }),
        )
        .await;
    assert_eq!(sent.status, 201, "{}", text(&sent));
    let late = chris.keyed(&env, "/api/mail/drafts", "d-2", replace).await;
    assert_eq!(late.status, 409, "{}", text(&late));
    assert!(
        drafts(&chris.messages(&env).await).is_empty(),
        "no draft came back"
    );

    // Without a key every save is a draft of its own.
    for _ in 0..2 {
        let plain = chris
            .json(&env, "POST", "/api/mail/drafts", body.clone())
            .await;
        assert_eq!(plain.status, 200, "{}", text(&plain));
    }
    assert_eq!(drafts(&chris.messages(&env).await).len(), 2);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn attachments_travel_with_the_message_and_are_read_only_through_it() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut martin = sign_up(&env, "martin", "Martin Klein").await;
    let mut ann = sign_up(&env, "ann", "Ann Lee").await;

    // 300,000 bytes: two pieces of 192 KiB and the rest.
    let bytes: Vec<u8> = (0..300_000u32).map(|n| (n % 251) as u8).collect();
    let staged = chris
        .json(
            &env,
            "POST",
            "/api/mail/attachments",
            json!({ "name": "harbor.png", "type": "image/png", "size": bytes.len() }),
        )
        .await;
    assert_eq!(staged.status, 201, "{}", text(&staged));
    let staged = json_of(&staged);
    let att = staged["attachment"]["id"].as_str().unwrap().to_string();
    let piece = staged["piece_bytes"].as_u64().unwrap() as usize;
    assert_eq!(staged["pieces"], 2);

    // Sending before it is complete is refused.
    let early = chris
        .json(
            &env,
            "POST",
            "/api/mail/send",
            json!({ "to": ["martin"], "subject": "Photo", "text": "x", "attachments": [att] }),
        )
        .await;
    assert_eq!(early.status, 409, "{}", text(&early));
    let octets = [("content-type", "application/octet-stream")];
    let wrong = chris
        .send(
            &env,
            "PUT",
            &format!("/api/mail/attachments/{att}/0"),
            &octets,
            b"short",
        )
        .await;
    assert_eq!(wrong.status, 400, "a piece of the wrong length");
    for (n, chunk) in bytes.chunks(piece).enumerate() {
        let put = chris
            .send(
                &env,
                "PUT",
                &format!("/api/mail/attachments/{att}/{n}"),
                &octets,
                chunk,
            )
            .await;
        assert_eq!(put.status, 200, "{}", text(&put));
    }
    // Another person cannot write to or seal it.
    let meddle = martin
        .send(
            &env,
            "PUT",
            &format!("/api/mail/attachments/{att}/0"),
            &octets,
            &bytes[..piece],
        )
        .await;
    assert_eq!(meddle.status, 404);
    let sealed = chris
        .json(
            &env,
            "POST",
            &format!("/api/mail/attachments/{att}/complete"),
            json!({}),
        )
        .await;
    assert_eq!(sealed.status, 200, "{}", text(&sealed));
    // A piece written once is never written again.
    let rewrite = chris
        .send(
            &env,
            "PUT",
            &format!("/api/mail/attachments/{att}/0"),
            &octets,
            &vec![0u8; piece],
        )
        .await;
    assert_eq!(
        rewrite.status, 200,
        "a resend is answered, and changes nothing"
    );

    let sent = chris
        .json(
            &env,
            "POST",
            "/api/mail/send",
            json!({ "to": ["martin"], "subject": "Photo", "text": "x", "attachments": [att] }),
        )
        .await;
    assert_eq!(sent.status, 201, "{}", text(&sent));

    let received = martin.messages(&env).await;
    let message = &received[0];
    assert_eq!(message["attachments"][0]["name"], "harbor.png");
    assert_eq!(message["attachments"][0]["size"], 300_000);
    let id = message["id"].as_str().unwrap();
    let url = format!("/api/mail/messages/{id}/attachments/{att}");
    let read = martin
        .send(&env, "GET", &format!("{url}?piece=0&count=8"), &[], b"")
        .await;
    assert_eq!(read.status, 200, "{}", text(&read));
    assert_eq!(read.body, bytes, "the bytes arrive whole and unchanged");
    assert!(read
        .headers
        .iter()
        .any(|(n, v)| n.eq_ignore_ascii_case("content-disposition") && v == "attachment"));
    // The sender reads it through the Sent copy; nobody else reaches it.
    let sent_id = json_of(&sent)["message"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let own = chris
        .send(
            &env,
            "GET",
            &format!("/api/mail/messages/{sent_id}/attachments/{att}?piece=1"),
            &[],
            b"",
        )
        .await;
    assert_eq!(own.status, 200);
    assert_eq!(own.body, bytes[piece..]);
    let peek = ann.send(&env, "GET", &url, &[], b"").await;
    assert_eq!(peek.status, 404, "{}", text(&peek));
    // Sending it again is refused: a sent attachment is no longer staged.
    let twice = chris
        .json(
            &env,
            "POST",
            "/api/mail/send",
            json!({ "to": ["ann"], "subject": "Again", "text": "x", "attachments": [att] }),
        )
        .await;
    assert_eq!(twice.status, 409, "{}", text(&twice));
    // Nor can it be cancelled: the message's bytes stay for its recipients.
    let late = chris
        .send(
            &env,
            "DELETE",
            &format!("/api/mail/attachments/{att}"),
            &[],
            b"",
        )
        .await;
    assert_eq!(json_of(&late)["cancelled"], false);
    let still = martin
        .send(&env, "GET", &format!("{url}?piece=0&count=8"), &[], b"")
        .await;
    assert_eq!(still.body, bytes, "a cancel after sending changes nothing");

    // An attachment given up is cancelled once.
    let other = chris
        .json(
            &env,
            "POST",
            "/api/mail/attachments",
            json!({ "name": "big.bin", "size": 10 * 1024 * 1024 }),
        )
        .await;
    let other = json_of(&other)["attachment"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let cancelled = chris
        .send(
            &env,
            "DELETE",
            &format!("/api/mail/attachments/{other}"),
            &[],
            b"",
        )
        .await;
    assert_eq!(json_of(&cancelled)["cancelled"], true);
    // A second cancel finds nothing to do.
    let again = chris
        .send(
            &env,
            "DELETE",
            &format!("/api/mail/attachments/{other}"),
            &[],
            b"",
        )
        .await;
    assert_eq!(json_of(&again)["cancelled"], false);
    let too_big = chris
        .json(
            &env,
            "POST",
            "/api/mail/attachments",
            json!({ "name": "huge.bin", "size": 10 * 1024 * 1024 + 1 }),
        )
        .await;
    assert_eq!(too_big.status, 413);
}

/// Upload `bytes` as an attachment named `name` and seal it: its id.
/// `Bcc` reaches the person and nobody learns of it but the sender.
#[tokio::test]
async fn rules_run_once_on_each_delivered_copy_however_many_arrive() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut martin = sign_up(&env, "martin", "Martin Klein").await;
    for at in 0..3 {
        let sent = chris
            .json(
                &env,
                "POST",
                "/api/mail/send",
                json!({ "to": ["martin"], "subject": format!("Ferry {at}"), "text": "" }),
            )
            .await;
        assert_eq!(sent.status, 201, "{}", text(&sent));
    }
    let listing = |value: Value| value["messages"].as_array().cloned().unwrap_or_default();
    let mine = chris
        .json(&env, "GET", "/api/mail/messages", json!(null))
        .await;
    let mine = listing(json_of(&mine));
    assert_eq!(mine.len(), 3);
    assert!(
        mine.iter().all(|sent| sent.get("rules_pending").is_none()),
        "a Sent copy is not new mail"
    );
    let theirs = martin
        .json(&env, "GET", "/api/mail/messages", json!(null))
        .await;
    let theirs = listing(json_of(&theirs));
    assert_eq!(theirs.len(), 3);
    assert!(theirs.iter().all(|new| new["rules_pending"] == true));

    let id = theirs[0]["id"].as_str().unwrap();
    let path = format!("/api/mail/messages/{id}");
    let rule = json!({ "rules_ran": true, "mailbox": "archive" });
    let ran = martin.json(&env, "PATCH", &path, rule.clone()).await;
    assert_eq!(ran.status, 200, "{}", text(&ran));
    assert_eq!(json_of(&ran)["message"]["mailbox"], "archive");
    assert!(json_of(&ran)["message"].get("rules_pending").is_none());

    // The person takes it back, and another browser's answer from the same read comes in late.
    let back = martin
        .json(&env, "PATCH", &path, json!({ "mailbox": "inbox" }))
        .await;
    assert_eq!(back.status, 200);
    let late = martin.json(&env, "PATCH", &path, rule).await;
    assert_eq!(late.status, 200, "{}", text(&late));
    assert_eq!(json_of(&late)["message"]["mailbox"], "inbox");

    let after = martin
        .json(&env, "GET", "/api/mail/messages", json!(null))
        .await;
    let pending = listing(json_of(&after))
        .iter()
        .filter(|each| each["rules_pending"] == true)
        .count();
    assert_eq!(pending, 2, "the other two are still new");
}

#[tokio::test]
async fn bcc_reaches_the_person_and_only_the_sent_copy_names_them() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris").await;
    let mut martin = sign_up(&env, "martin", "Martin").await;
    let mut ada = sign_up(&env, "ada", "Ada").await;
    let sent = chris
        .json(
            &env,
            "POST",
            "/api/mail/send",
            json!({
                "to": ["martin"],
                "bcc": ["ada", "martin"],
                "reply_to": " boxes@example.org ",
                "priority": "high",
                "subject": "Ferry",
                "text": "Eight o'clock.",
            }),
        )
        .await;
    assert_eq!(sent.status, 201, "{}", text(&sent));
    assert_eq!(json_of(&sent)["delivered"], json!(["martin", "ada"]));

    let to_martin = martin.messages(&env).await;
    let to_ada = ada.messages(&env).await;
    let mine = chris.messages(&env).await;
    for delivered in [&to_martin[0], &to_ada[0]] {
        assert_eq!(delivered["mailbox"], "inbox");
        assert_eq!(delivered["bcc"], Value::Null, "a recipient sees no Bcc");
        assert_eq!(delivered["reply_to"], "boxes@example.org");
        assert_eq!(delivered["priority"], "high");
    }
    assert_eq!(mine[0]["mailbox"], "sent");
    assert_eq!(mine[0]["bcc"][0]["name"], "ada");
    assert_eq!(mine[0]["bcc"].as_array().map(Vec::len), Some(1));
}

#[tokio::test]
async fn a_draft_keeps_bcc_reply_to_and_priority_and_a_priority_can_be_changed() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris").await;
    let saved = chris
        .json(
            &env,
            "POST",
            "/api/mail/drafts",
            json!({
                "bcc": ["not an account yet"],
                "reply_to": "me@example.org",
                "priority": "low",
                "subject": "Later",
            }),
        )
        .await;
    assert_eq!(saved.status, 200, "{}", text(&saved));
    let id = json_of(&saved)["message"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let listed = chris.messages(&env).await;
    assert_eq!(listed[0]["bcc"][0]["name"], "not an account yet");
    assert_eq!(listed[0]["reply_to"], "me@example.org");
    assert_eq!(listed[0]["priority"], "low");

    let path = format!("/api/mail/messages/{id}");
    let changed = chris
        .json(&env, "PATCH", &path, json!({ "priority": "high" }))
        .await;
    assert_eq!(changed.status, 200, "{}", text(&changed));
    assert_eq!(chris.messages(&env).await[0]["priority"], "high");
    let cleared = chris
        .json(&env, "PATCH", &path, json!({ "priority": null }))
        .await;
    assert_eq!(cleared.status, 200, "{}", text(&cleared));
    assert_eq!(chris.messages(&env).await[0]["priority"], Value::Null);
    let refused = chris
        .json(&env, "PATCH", &path, json!({ "priority": "urgent" }))
        .await;
    assert_eq!(refused.status, 400, "{}", text(&refused));
}

#[tokio::test]
async fn a_copy_stays_in_the_first_mailbox_too_and_is_made_once_per_request() {
    let env = boot().await;
    let mut martin = sign_up(&env, "martin", "Martin").await;
    let mut chris = sign_up(&env, "chris", "Chris").await;
    let reply = martin
        .keyed(
            &env,
            "/api/mail/send",
            "copy-1",
            json!({ "to": ["chris"], "subject": "Keep", "text": "Whole text" }),
        )
        .await;
    assert_eq!(reply.status, 201, "{}", text(&reply));
    let id = chris.messages(&env).await[0]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let copy_path = format!("/api/mail/messages/{id}/copy");
    let request = json!({ "mailbox": "archive", "key": "first" });
    let copied = chris.json(&env, "POST", &copy_path, request.clone()).await;
    assert_eq!(copied.status, 200, "{}", text(&copied));
    let copy_id = json_of(&copied)["message"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    assert_ne!(copy_id, id);
    let again = chris.json(&env, "POST", &copy_path, request.clone()).await;
    assert_eq!(json_of(&again)["message"]["id"], copy_id.as_str());
    // Asked again later: the copy as it has become, not made anew from the first message.
    let moved = chris
        .json(
            &env,
            "PATCH",
            &format!("/api/mail/messages/{copy_id}"),
            json!({ "mailbox": "trash", "flag": "red" }),
        )
        .await;
    assert_eq!(moved.status, 200, "{}", text(&moved));
    let replay = chris.json(&env, "POST", &copy_path, request.clone()).await;
    assert_eq!(json_of(&replay)["message"]["mailbox"], "trash");
    assert_eq!(json_of(&replay)["message"]["flag"], "red");
    let back = chris
        .json(
            &env,
            "PATCH",
            &format!("/api/mail/messages/{copy_id}"),
            json!({ "mailbox": "archive" }),
        )
        .await;
    assert_eq!(back.status, 200, "{}", text(&back));
    let mailboxes: Vec<(String, String)> = chris
        .messages(&env)
        .await
        .iter()
        .map(|each| {
            (
                each["id"].as_str().unwrap().to_string(),
                each["mailbox"].as_str().unwrap().to_string(),
            )
        })
        .collect();
    assert_eq!(mailboxes.len(), 2, "{mailboxes:?}");
    assert!(mailboxes.contains(&(id.clone(), "inbox".to_string())));
    assert!(mailboxes.contains(&(copy_id.clone(), "archive".to_string())));
    let read = chris
        .get(&env, &format!("/api/mail/messages/{copy_id}"))
        .await;
    assert_eq!(read["text"], "Whole text");
    let to_drafts = chris
        .json(
            &env,
            "POST",
            &copy_path,
            json!({ "mailbox": "drafts", "key": "two" }),
        )
        .await;
    assert_eq!(to_drafts.status, 409);
    let to_nowhere = chris
        .json(
            &env,
            "POST",
            &copy_path,
            json!({ "mailbox": "box-nothing", "key": "three" }),
        )
        .await;
    assert_ne!(to_nowhere.status, 200);
    let other = martin.json(&env, "POST", &copy_path, request).await;
    assert_eq!(
        other.status, 404,
        "another person's message is not theirs to copy"
    );
}

async fn upload(env: &TestEnv, who: &mut Browser, name: &str, bytes: &[u8]) -> String {
    let staged = who
        .json(
            env,
            "POST",
            "/api/mail/attachments",
            json!({ "name": name, "type": "text/plain", "size": bytes.len() }),
        )
        .await;
    assert_eq!(staged.status, 201, "{}", text(&staged));
    let id = json_of(&staged)["attachment"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let octets = [("content-type", "application/octet-stream")];
    let put = who
        .send(
            env,
            "PUT",
            &format!("/api/mail/attachments/{id}/0"),
            &octets,
            bytes,
        )
        .await;
    assert_eq!(put.status, 200, "{}", text(&put));
    let sealed = who
        .json(
            env,
            "POST",
            &format!("/api/mail/attachments/{id}/complete"),
            json!({}),
        )
        .await;
    assert_eq!(sealed.status, 200, "{}", text(&sealed));
    id
}

/// A mailbox the person made stands in for Sent: the sender's copy is filed there, keeps who was
/// written to unseen, and a resend makes no second one. A mailbox the person no longer has does not.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_mailbox_standing_in_for_sent_receives_the_senders_copy() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    sign_up(&env, "martin", "Martin Klein").await;
    sign_up(&env, "ann", "Ann Lee").await;
    let made = chris
        .json(
            &env,
            "POST",
            "/api/mail/mailboxes",
            json!({ "name": "Out" }),
        )
        .await;
    let box_id = json_of(&made)["mailbox"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let body = json!({ "to": ["martin"], "bcc": ["ann"], "subject": "Filed", "text": "x",
                       "sent_box": box_id });
    let first = chris
        .keyed(&env, "/api/mail/send", "filed", body.clone())
        .await;
    assert_eq!(first.status, 201, "{}", text(&first));
    assert_eq!(json_of(&first)["message"]["mailbox"], box_id.as_str());
    assert_eq!(json_of(&first)["message"]["bcc"][0]["name"], "ann");
    let again = chris.keyed(&env, "/api/mail/send", "filed", body).await;
    assert_eq!(
        json_of(&again)["message"]["id"],
        json_of(&first)["message"]["id"]
    );
    assert_eq!(in_box(&chris.messages(&env).await, &box_id).len(), 1);
    assert!(in_box(&chris.messages(&env).await, "sent").is_empty());

    let gone = chris
        .json(
            &env,
            "POST",
            "/api/mail/send",
            json!({ "to": ["martin"], "subject": "Back", "text": "x", "sent_box": "box-0" }),
        )
        .await;
    assert_eq!(gone.status, 201, "{}", text(&gone));
    assert_eq!(json_of(&gone)["message"]["mailbox"], "sent");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn the_last_copy_erased_frees_a_files_bytes_and_no_earlier_one_does() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut martin = sign_up(&env, "martin", "Martin Klein").await;
    let mut ann = sign_up(&env, "ann", "Ann Lee").await;
    let att = upload(&env, &mut chris, "shared.txt", b"shared").await;
    let sent = send_file(&env, &mut chris, &["martin", "ann"], &att).await;
    let piece = piece_of(&sent, &att);
    let mut blobs = env.blob("files");
    let inbox_id = in_box(&martin.messages(&env).await, "inbox")[0]["id"]
        .as_str()
        .unwrap()
        .to_string();

    // Martin keeps a second copy, and erases the first: the file is still named twice over.
    let copied = martin
        .json(
            &env,
            "POST",
            &format!("/api/mail/messages/{inbox_id}/copy"),
            json!({ "mailbox": "archive", "key": "keep" }),
        )
        .await;
    assert_eq!(copied.status, 200, "{}", text(&copied));
    let kept = json_of(&copied)["message"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    erase_message(&env, &mut martin, &inbox_id).await;
    erase_message(&env, &mut ann, &inbox_id).await;
    erase_message(&env, &mut chris, sent["id"].as_str().unwrap()).await;
    assert!(blobs.get(piece.as_bytes()).await.unwrap().is_some());
    let still = martin
        .send(
            &env,
            "GET",
            &format!("/api/mail/messages/{kept}/attachments/{att}"),
            &[],
            b"",
        )
        .await;
    assert_eq!(still.status, 200, "{}", text(&still));
    assert_eq!(still.body.as_slice(), &b"shared"[..]);

    // The last copy goes, and with it the bytes and everything that counted them.
    erase_message(&env, &mut martin, &kept).await;
    assert!(blobs.get(piece.as_bytes()).await.unwrap().is_none());
    assert!(counting_keys(&env).await.is_empty());

    // Erasing it again finds nothing more to do.
    let path = format!("/api/mail/messages/{kept}");
    let again = martin.send(&env, "DELETE", &path, &[], b"").await;
    assert_eq!(json_of(&again)["erased"], 0);
    assert!(counting_keys(&env).await.is_empty());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn remove_attachments_counts_as_a_copy_letting_the_file_go() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut martin = sign_up(&env, "martin", "Martin Klein").await;
    let att = upload(&env, &mut chris, "shared.txt", b"shared").await;
    let sent = send_file(&env, &mut chris, &["martin"], &att).await;
    let piece = piece_of(&sent, &att);
    let mut blobs = env.blob("files");
    let sent_id = sent["id"].as_str().unwrap().to_string();
    let take_off = json!({ "remove_attachments": true });
    let path = format!("/api/mail/messages/{sent_id}");
    let reply = chris.json(&env, "PATCH", &path, take_off.clone()).await;
    assert_eq!(reply.status, 200, "{}", text(&reply));
    assert!(blobs.get(piece.as_bytes()).await.unwrap().is_some());
    let inbox_id = in_box(&martin.messages(&env).await, "inbox")[0]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let path = format!("/api/mail/messages/{inbox_id}");
    let reply = martin.json(&env, "PATCH", &path, take_off.clone()).await;
    assert_eq!(reply.status, 200, "{}", text(&reply));
    assert!(blobs.get(piece.as_bytes()).await.unwrap().is_none());
    assert!(counting_keys(&env).await.is_empty());
    let again = martin.json(&env, "PATCH", &path, take_off).await;
    assert_eq!(again.status, 200, "{}", text(&again));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_draft_still_naming_a_sent_file_keeps_its_bytes_and_an_unsent_file_is_not_freed() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut martin = sign_up(&env, "martin", "Martin Klein").await;
    let att = upload(&env, &mut chris, "shared.txt", b"shared").await;
    let save = |subject: &str| json!({ "subject": subject, "text": "x", "attachments": [att] });
    let first = chris
        .json(&env, "POST", "/api/mail/drafts", save("One"))
        .await;
    let other = chris
        .json(&env, "POST", "/api/mail/drafts", save("Two"))
        .await;
    let first = json_of(&first)["message"].clone();
    let other = json_of(&other)["message"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let piece = piece_of(&first, &att);
    let mut blobs = env.blob("files");

    // Erasing a draft of a file nobody has sent leaves the file for the window that still holds it.
    let draft_path = format!("/api/mail/messages/{}", first["id"].as_str().unwrap());
    let gone = chris.send(&env, "DELETE", &draft_path, &[], b"").await;
    assert_eq!(json_of(&gone)["erased"], 1);
    assert!(blobs.get(piece.as_bytes()).await.unwrap().is_some());

    let sent = send_file(&env, &mut chris, &["martin"], &att).await;
    erase_message(&env, &mut chris, sent["id"].as_str().unwrap()).await;
    let inbox_id = in_box(&martin.messages(&env).await, "inbox")[0]["id"]
        .as_str()
        .unwrap()
        .to_string();
    erase_message(&env, &mut martin, &inbox_id).await;
    assert!(
        blobs.get(piece.as_bytes()).await.unwrap().is_some(),
        "the other draft still names it"
    );
    let read = chris
        .send(
            &env,
            "GET",
            &format!("/api/mail/messages/{other}/attachments/{att}"),
            &[],
            b"",
        )
        .await;
    assert_eq!(read.body.as_slice(), &b"shared"[..]);

    // A new draft cannot take up a sent file, and asking leaves no count of it behind.
    let refused = chris
        .json(&env, "POST", "/api/mail/drafts", save("Three"))
        .await;
    assert_eq!(refused.status, 409, "{}", text(&refused));
    let path = format!("/api/mail/messages/{other}");
    let gone = chris.send(&env, "DELETE", &path, &[], b"").await;
    assert_eq!(json_of(&gone)["erased"], 1);
    assert!(blobs.get(piece.as_bytes()).await.unwrap().is_none());
    assert!(counting_keys(&env).await.is_empty());
}

/// An erasure that stopped after its header became a tombstone is finished by the next listing.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn an_erasure_stopped_part_way_is_finished_by_the_next_listing() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let att = upload(&env, &mut chris, "shared.txt", b"shared").await;
    let sent = send_file(&env, &mut chris, &["chris"], &att).await;
    let piece = piece_of(&sent, &att);
    let sent_id = sent["id"].as_str().unwrap().to_string();
    let inbox_id = in_box(&chris.messages(&env).await, "inbox")[0]["id"]
        .as_str()
        .unwrap()
        .to_string();
    erase_message(&env, &mut chris, &inbox_id).await;

    // The state of a request that wrote its release record and tombstone and then stopped.
    let mut store = env.store("data");
    let (rows, _) = store
        .scan_prefix(b"apps/mail/users/", None, 500)
        .await
        .unwrap();
    let header_key = rows
        .iter()
        .map(|(key, _, _)| String::from_utf8_lossy(key).into_owned())
        .find(|key| key.ends_with(&format!("/m/{sent_id}")))
        .expect("the Sent copy's header");
    let release = header_key.replace("/m/", "/att-release/");
    store
        .put(
            release.as_bytes(),
            json!({ "message": sent_id, "attachments": sent["attachments"] })
                .to_string()
                .as_bytes(),
        )
        .await
        .unwrap();
    store
        .put(header_key.as_bytes(), br#"{"erased":true}"#)
        .await
        .unwrap();
    let mut blobs = env.blob("files");
    assert!(blobs.get(piece.as_bytes()).await.unwrap().is_some());

    chris.messages(&env).await;
    assert!(blobs.get(piece.as_bytes()).await.unwrap().is_none());
    assert!(store.get(release.as_bytes()).await.unwrap().is_none());
    assert!(counting_keys(&env).await.is_empty());
}

/// A send stopped before one recipient's copy was stored: its record open, the copy absent. The
/// person whose copy is missing comes second in the answer, then the id of the copies, the Sent
/// copy, the file's piece and the request to send it again.
async fn stopped_send(
    env: &TestEnv,
    chris: &mut Browser,
    mut one: Browser,
    mut other: Browser,
) -> (Browser, Browser, String, Value, String, String, Value) {
    let att = upload(env, chris, "shared.txt", b"shared").await;
    let body = json!({ "to": ["martin", "ann"], "subject": "Files", "text": "x",
                       "attachments": [att] });
    let first = chris
        .keyed(env, "/api/mail/send", "stopped", body.clone())
        .await;
    assert_eq!(first.status, 201, "{}", text(&first));
    let sent = json_of(&first)["message"].clone();
    let piece = piece_of(&sent, &att);
    let inbox_id = in_box(&one.messages(env).await, "inbox")[0]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let mut store = env.store("data");
    let (rows, _) = store
        .scan_prefix(b"apps/mail/users/", None, 1000)
        .await
        .unwrap();
    let (header, _, _) = rows
        .iter()
        .find(|(key, _, _)| String::from_utf8_lossy(key).ends_with(&format!("/m/{inbox_id}")))
        .expect("a recipient's header");
    store.delete(header).await.unwrap();
    let (record_key, record, _) = rows
        .iter()
        .find(|(key, _, _)| String::from_utf8_lossy(key).contains("/sent/"))
        .expect("the send's record");
    let mut record: Value = serde_json::from_slice(record).unwrap();
    record["done"] = json!(false);
    store
        .put(record_key, record.to_string().as_bytes())
        .await
        .unwrap();
    if in_box(&one.messages(env).await, "inbox").is_empty() {
        std::mem::swap(&mut one, &mut other);
    }
    (one, other, inbox_id, sent, piece, att, body)
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_copy_a_stopped_send_has_yet_to_deliver_keeps_the_file_for_its_resend() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let martin = sign_up(&env, "martin", "Martin Klein").await;
    let ann = sign_up(&env, "ann", "Ann Lee").await;
    let (mut holder, mut waiting, inbox_id, sent, piece, att, body) =
        stopped_send(&env, &mut chris, martin, ann).await;
    erase_message(&env, &mut holder, &inbox_id).await;
    erase_message(&env, &mut chris, sent["id"].as_str().unwrap()).await;
    let mut blobs = env.blob("files");
    assert!(
        blobs.get(piece.as_bytes()).await.unwrap().is_some(),
        "one copy has yet to arrive"
    );
    let again = chris.keyed(&env, "/api/mail/send", "stopped", body).await;
    assert_eq!(again.status, 409, "{}", text(&again));
    let read = waiting
        .send(
            &env,
            "GET",
            &format!("/api/mail/messages/{inbox_id}/attachments/{att}"),
            &[],
            b"",
        )
        .await;
    assert_eq!(read.status, 200, "{}", text(&read));
    assert_eq!(read.body.as_slice(), &b"shared"[..]);
    erase_message(&env, &mut waiting, &inbox_id).await;
    assert!(blobs.get(piece.as_bytes()).await.unwrap().is_none());
    assert!(counting_keys(&env).await.is_empty());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_copy_no_resend_delivered_stops_keeping_the_file_after_a_while() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let martin = sign_up(&env, "martin", "Martin Klein").await;
    let ann = sign_up(&env, "ann", "Ann Lee").await;
    let (mut holder, _, inbox_id, sent, piece, _, _) =
        stopped_send(&env, &mut chris, martin, ann).await;
    erase_message(&env, &mut holder, &inbox_id).await;
    erase_message(&env, &mut chris, sent["id"].as_str().unwrap()).await;
    let mut blobs = env.blob("files");
    chris.messages(&env).await;
    assert!(blobs.get(piece.as_bytes()).await.unwrap().is_some());
    crate::support::advance(&env, 2 * 24 * 60 * 60 * 1000 + 1).await;
    chris.messages(&env).await;
    assert!(blobs.get(piece.as_bytes()).await.unwrap().is_none());
    holder.messages(&env).await;
    assert!(counting_keys(&env).await.is_empty());
}

/// A message from before the count has copies nobody noted, so it never frees a file.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_file_sent_before_the_count_is_kept() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let att = upload(&env, &mut chris, "old.txt", b"old").await;
    let sent = send_file(&env, &mut chris, &["chris"], &att).await;
    let piece = piece_of(&sent, &att);
    let mut store = env.store("data");
    for key in counting_keys(&env).await {
        store.delete(key.as_bytes()).await.unwrap();
    }
    erase_message(&env, &mut chris, sent["id"].as_str().unwrap()).await;
    assert!(env
        .blob("files")
        .get(piece.as_bytes())
        .await
        .unwrap()
        .is_some());
}

async fn send_file(env: &TestEnv, who: &mut Browser, to: &[&str], att: &str) -> Value {
    let reply = who
        .json(
            env,
            "POST",
            "/api/mail/send",
            json!({ "to": to, "subject": "Files", "text": "x", "attachments": [att] }),
        )
        .await;
    assert_eq!(reply.status, 201, "{}", text(&reply));
    json_of(&reply)["message"].clone()
}

/// The blob key of the only piece of attachment `att` of `message`.
fn piece_of(message: &Value, att: &str) -> String {
    let part = message["attachments"][0]["parts"][0].as_str().unwrap();
    format!("mail/att/{att}/00000-{part}")
}

async fn erase_message(env: &TestEnv, who: &mut Browser, id: &str) {
    let path = format!("/api/mail/messages/{id}");
    let moved = who
        .json(env, "PATCH", &path, json!({ "mailbox": "trash" }))
        .await;
    assert_eq!(moved.status, 200, "{}", text(&moved));
    let erased = who.send(env, "DELETE", &path, &[], b"").await;
    assert_eq!(json_of(&erased)["erased"], 1, "{}", text(&erased));
}

/// The keys that count a file's copies, and what is left of any release.
async fn counting_keys(env: &TestEnv) -> Vec<String> {
    let mut store = env.store("data");
    let (shared, _) = store
        .scan_prefix(b"apps/mail/shared/att-", None, 100)
        .await
        .unwrap();
    let (users, _) = store
        .scan_prefix(b"apps/mail/users/", None, 1000)
        .await
        .unwrap();
    shared
        .into_iter()
        .chain(users)
        .map(|(key, _, _)| String::from_utf8_lossy(&key).into_owned())
        .filter(|key| key.contains("/shared/att-") || key.contains("/att-release/"))
        .collect()
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn an_import_keeps_a_message_as_the_file_says_it_and_only_once() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let made = chris
        .json(
            &env,
            "POST",
            "/api/mail/mailboxes",
            json!({ "name": "Old mail" }),
        )
        .await;
    assert_eq!(made.status, 200, "{}", text(&made));
    let mailbox = json_of(&made)["mailbox"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let message = json!({
        "mailbox": mailbox,
        "key": "file-1-message-1",
        "from": "Ann <ann@example.com>",
        "to": ["chris@example.com"],
        "subject": "Ferry times",
        "at_ms": 1_500_000_000_000u64,
        "text": "Noon.",
    });
    let first = chris
        .json(&env, "POST", "/api/mail/import", message.clone())
        .await;
    assert_eq!(first.status, 200, "{}", text(&first));
    let id = json_of(&first)["message"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let again = chris.json(&env, "POST", "/api/mail/import", message).await;
    assert_eq!(again.status, 200, "{}", text(&again));
    assert_eq!(json_of(&again)["message"]["id"], id.as_str());

    let listed = chris.messages(&env).await;
    let kept: Vec<_> = listed
        .iter()
        .filter(|each| each["id"] == id.as_str())
        .collect();
    assert_eq!(kept.len(), 1, "one copy: {listed:?}");
    assert_eq!(kept[0]["from"]["name"], "Ann <ann@example.com>");
    assert_eq!(kept[0]["at_ms"], 1_500_000_000_000u64);
    assert_eq!(kept[0]["unread"], false);
    let full = chris.get(&env, &format!("/api/mail/messages/{id}")).await;
    assert_eq!(full["text"], "Noon.");

    // Only a mailbox the person made takes an import, and an import reaches nobody else.
    let into_inbox = json!({
        "mailbox": "inbox", "key": "k2", "from": "a", "subject": "s", "at_ms": 1, "text": "t",
    });
    let refused = chris
        .json(&env, "POST", "/api/mail/import", into_inbox)
        .await;
    assert_eq!(refused.status, 409, "{}", text(&refused));
    let unknown = json!({
        "mailbox": "own:nothing", "key": "k3", "from": "a", "subject": "s", "at_ms": 1, "text": "t",
    });
    assert!(
        chris
            .json(&env, "POST", "/api/mail/import", unknown)
            .await
            .status
            >= 400
    );
}

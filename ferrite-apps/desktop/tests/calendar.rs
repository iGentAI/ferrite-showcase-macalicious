//! Calendar on the in-process Forge planes (`ferrite-app-test`): a person's
//! own calendars and events.

use ferrite_app::{serde_json, IngressReply};
use ferrite_app_test::{ingress, TestEnv, TestHarness};
use serde_json::{json, Value};

const PEPPER: &str = "test-pepper-0123456789abcdef0123456789abcdef";
const PASSWORD: &str = "correct horse battery";
const URL: &str = "/api/calendar/events";
/// The manual clock's start: Wednesday 14 October 2026, 08:00 UTC.
const START_MS: u64 = 1_791_964_800_000;
const MINUTE: u64 = 60_000;

async fn boot() -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let env = TestHarness::new()
        .manual_clock(START_MS)
        .with_queue("requests")
        .with_queue("replies")
        .with_queue("timers")
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

#[derive(Clone)]
struct Browser {
    token: Option<String>,
}

impl Browser {
    fn new() -> Self {
        Browser { token: None }
    }

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

    /// Save `events` (and `extra` fields) on the stored revision.
    async fn save(&mut self, env: &TestEnv, events: Value, extra: Value) -> IngressReply {
        let rev = self.get(env, URL).await["rev"].clone();
        let mut body = json!({ "events": events, "rev": rev });
        if let (Some(body), Some(extra)) = (body.as_object_mut(), extra.as_object()) {
            body.extend(extra.clone());
        }
        self.send(env, "PUT", URL, Some(&body)).await
    }
}

async fn sign_up(env: &TestEnv, name: &str, full_name: &str) -> Browser {
    let mut browser = Browser::new();
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

fn event(id: &str, title: &str, start: u64) -> Value {
    json!({
        "id": id, "title": title, "start": start, "end": start + 60 * MINUTE,
        "calendar": "work",
    })
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_person_keeps_calendars_of_their_own() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let calendars = json!([
        { "id": "work", "name": "Work", "color": "purple" },
        { "id": "cal-run", "name": "Running", "color": "green" },
    ]);
    let mut run = event("run-1", "Long run", START_MS + 24 * 60 * MINUTE);
    run["calendar"] = json!("cal-run");
    run["repeat"] = json!({ "freq": "weekly", "days": [6, 0] });
    run["location"] = json!("The park");
    let saved = chris
        .save(&env, json!([run]), json!({ "calendars": calendars }))
        .await;
    assert_eq!(saved.status, 200, "{}", text(&saved));
    let stored = chris.get(&env, URL).await;
    assert_eq!(stored["calendars"], calendars);
    assert_eq!(
        stored["events"][0]["repeat"],
        json!({ "freq": "weekly", "days": [0, 6] })
    );
    assert_eq!(stored["events"][0]["location"], "The park");

    // A save without calendars keeps them; an event in a removed calendar is refused.
    let kept = chris.save(&env, json!([run]), json!({})).await;
    assert_eq!(kept.status, 200, "{}", text(&kept));
    assert_eq!(chris.get(&env, URL).await["calendars"], calendars);
    let orphan = chris
        .save(
            &env,
            json!([run]),
            json!({ "calendars": [{ "id": "work", "name": "Work", "color": "purple" }] }),
        )
        .await;
    assert_eq!(orphan.status, 400, "{}", text(&orphan));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_forgotten_calendar_reads_as_never_saved() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let planning = event("plan-1", "Launch planning", START_MS + 120 * MINUTE);
    let saved = chris.save(&env, json!([planning]), json!({})).await;
    assert_eq!(saved.status, 200, "{}", text(&saved));
    let forgotten = chris.send(&env, "DELETE", URL, None).await;
    assert_eq!(forgotten.status, 200, "{}", text(&forgotten));
    assert_eq!(json_of(&forgotten)["events"], Value::Null);
    assert_eq!(chris.get(&env, URL).await["events"], Value::Null);
}

/// The notifications in `browser`'s Notification Center, as `(id, title, body)`.
async fn notes(env: &TestEnv, browser: &mut Browser) -> Vec<(String, String, String)> {
    let inbox = browser.get(env, "/api/notification-center/inbox").await;
    inbox["items"]
        .as_array()
        .expect("items")
        .iter()
        .filter(|item| item["app"] == "calendar")
        .map(|item| {
            (
                item["id"].as_str().unwrap_or("").to_string(),
                item["title"].as_str().unwrap_or("").to_string(),
                item["body"].as_str().unwrap_or("").to_string(),
            )
        })
        .collect()
}

fn invited(id: &str, title: &str, start: u64, invitees: &[&str]) -> Value {
    let mut event = event(id, title, start);
    event["invitees"] = json!(invitees);
    event
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn an_invitation_reaches_the_invitee_and_the_answer_reaches_the_organizer() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut anna = sign_up(&env, "anna", "Anna Berg").await;
    let mut ben = sign_up(&env, "ben", "Ben Cole").await;
    let lunch_at = START_MS + 4 * 60 * MINUTE;

    // The look-up an invitation is checked with as a name is typed.
    assert_eq!(
        chris.get(&env, "/api/calendar/people/Anna").await,
        json!({ "name": "anna", "full_name": "Anna Berg" })
    );
    let nobody = chris
        .send(&env, "GET", "/api/calendar/people/zed", None)
        .await;
    assert_eq!(nobody.status, 404, "{}", text(&nobody));

    let saved = chris
        .save(
            &env,
            json!([invited("lunch", "Lunch", lunch_at, &["anna"])]),
            json!({}),
        )
        .await;
    assert_eq!(saved.status, 200, "{}", text(&saved));
    assert_eq!(
        chris.get(&env, "/api/calendar/sent").await,
        json!({ "events": { "lunch": [{ "name": "anna", "full_name": "Anna Berg", "status": "pending" }] }, "pending": false })
    );

    // Anna has it, and is told; Ben, who is not invited, has nothing.
    let inbox = anna.get(&env, "/api/calendar/inbox").await;
    let invitations = inbox["invitations"].as_array().expect("invitations");
    assert_eq!(invitations.len(), 1, "{inbox}");
    let invitation = &invitations[0];
    assert_eq!(
        invitation["organizer"],
        json!({ "name": "chris", "full_name": "Chris Carter" })
    );
    assert_eq!(invitation["event"]["title"], "Lunch");
    assert_eq!(invitation["event"]["start"], json!(lunch_at));
    assert_eq!(invitation["status"], "pending");
    let id = invitation["id"].as_str().expect("id").to_string();
    let first = invitation["version"].as_u64().expect("version");
    assert!(
        !inbox.to_string().contains("u-"),
        "no account id reaches a browser: {inbox}"
    );
    let told = notes(&env, &mut anna).await;
    assert_eq!(told.len(), 1, "{told:?}");
    assert_eq!(
        (told[0].1.as_str(), told[0].2.as_str()),
        ("Chris Carter invited you", "Lunch")
    );
    assert_eq!(
        ben.get(&env, "/api/calendar/inbox").await,
        json!({ "invitations": [], "can_invite": true, "me": "ben" })
    );
    let stranger = ben
        .send(
            &env,
            "POST",
            &format!("/api/calendar/inbox/{id}/{first}/accept"),
            Some(&json!({})),
        )
        .await;
    assert_eq!(stranger.status, 404, "{}", text(&stranger));

    // Anna accepts: Chris sees it and is told; Anna's invitation notification goes.
    let answer = anna
        .send(
            &env,
            "POST",
            &format!("/api/calendar/inbox/{id}/{first}/accept"),
            Some(&json!({})),
        )
        .await;
    assert_eq!(answer.status, 200, "{}", text(&answer));
    assert_eq!(json_of(&answer)["status"], "accepted");
    assert!(notes(&env, &mut anna).await.is_empty());
    assert_eq!(
        chris.get(&env, "/api/calendar/sent").await["events"]["lunch"][0]["status"],
        "accepted"
    );
    let replies = notes(&env, &mut chris).await;
    assert_eq!(replies.len(), 1, "{replies:?}");
    assert_eq!(
        (replies[0].1.as_str(), replies[0].2.as_str()),
        ("Anna Berg accepted", "Lunch")
    );

    // A new title keeps the answer; a new time asks again.
    let renamed = chris
        .save(
            &env,
            json!([invited("lunch", "Long lunch", lunch_at, &["anna"])]),
            json!({}),
        )
        .await;
    assert_eq!(renamed.status, 200, "{}", text(&renamed));
    let inbox = anna.get(&env, "/api/calendar/inbox").await;
    assert_eq!(inbox["invitations"][0]["event"]["title"], "Long lunch");
    assert_eq!(inbox["invitations"][0]["status"], "accepted");
    let later = lunch_at + 60 * MINUTE;
    let moved = chris
        .save(
            &env,
            json!([invited("lunch", "Long lunch", later, &["anna", "ben"])]),
            json!({}),
        )
        .await;
    assert_eq!(moved.status, 200, "{}", text(&moved));
    let inbox = anna.get(&env, "/api/calendar/inbox").await;
    assert_eq!(inbox["invitations"][0]["status"], "pending");
    assert_eq!(inbox["invitations"][0]["event"]["start"], json!(later));
    let second = inbox["invitations"][0]["version"]
        .as_u64()
        .expect("version");
    assert!(second > first, "{inbox}");
    // An answer to the version Anna saw before the move is refused.
    let stale = anna
        .send(
            &env,
            "POST",
            &format!("/api/calendar/inbox/{id}/{first}/accept"),
            Some(&json!({})),
        )
        .await;
    assert_eq!(stale.status, 409, "{}", text(&stale));
    assert_eq!(json_of(&stale)["version"], json!(second));
    assert_eq!(
        notes(&env, &mut anna).await[0].1,
        "Chris Carter changed an invitation"
    );
    assert_eq!(
        ben.get(&env, "/api/calendar/inbox").await["invitations"]
            .as_array()
            .map(Vec::len),
        Some(1)
    );
    let bens = ben.get(&env, "/api/calendar/inbox").await["invitations"][0]["version"]
        .as_u64()
        .expect("version");
    let declined = ben
        .send(
            &env,
            "POST",
            &format!("/api/calendar/inbox/{id}/{bens}/decline"),
            Some(&json!({})),
        )
        .await;
    assert_eq!(
        json_of(&declined)["status"],
        "declined",
        "{}",
        text(&declined)
    );

    // Anna taken off: her inbox is empty, her answer is refused, she is told.
    let off = chris
        .save(
            &env,
            json!([invited("lunch", "Long lunch", later, &["ben"])]),
            json!({}),
        )
        .await;
    assert_eq!(off.status, 200, "{}", text(&off));
    assert_eq!(
        anna.get(&env, "/api/calendar/inbox").await,
        json!({ "invitations": [], "can_invite": true, "me": "anna" })
    );
    let late = anna
        .send(
            &env,
            "POST",
            &format!("/api/calendar/inbox/{id}/{second}/accept"),
            Some(&json!({})),
        )
        .await;
    assert_eq!(late.status, 404, "{}", text(&late));
    assert_eq!(
        notes(&env, &mut anna).await[0].1,
        "Chris Carter cancelled an event"
    );
    assert_eq!(
        chris.get(&env, "/api/calendar/sent").await,
        json!({ "events": { "lunch": [{ "name": "ben", "full_name": "Ben Cole", "status": "declined" }] }, "pending": false })
    );

    // The event deleted: nobody has it any more.
    let gone = chris.save(&env, json!([]), json!({})).await;
    assert_eq!(gone.status, 200, "{}", text(&gone));
    assert_eq!(
        ben.get(&env, "/api/calendar/inbox").await,
        json!({ "invitations": [], "can_invite": true, "me": "ben" })
    );
    assert_eq!(
        chris.get(&env, "/api/calendar/sent").await,
        json!({ "events": {}, "pending": false })
    );
    // Nothing is left over of the invitation: its card went once everyone was cleared.
    let (rows, _) = env
        .store("data")
        .scan_prefix(b"apps/calendar/shared/invites/", None, 10)
        .await
        .expect("scan");
    assert!(rows.is_empty(), "{} cards left", rows.len());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn only_an_account_invites_and_only_people_who_exist() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let _anna = sign_up(&env, "anna", "Anna Berg").await;
    let at = START_MS + 60 * MINUTE;
    for (invitees, status) in [
        (vec!["zed"], 400),
        (vec!["chris"], 400),
        (vec!["anna", "Anna"], 400),
        (vec!["not a name"], 400),
    ] {
        let refused = chris
            .save(&env, json!([invited("e", "x", at, &invitees)]), json!({}))
            .await;
        assert_eq!(refused.status, status, "{invitees:?}: {}", text(&refused));
    }
    // More new people than one save looks up, whether or not they exist.
    let names: Vec<String> = (1..=22).map(|n| format!("p{n:02}")).collect();
    let names: Vec<&str> = names.iter().map(AsRef::as_ref).collect();
    let refused = chris
        .save(
            &env,
            json!([
                invited("e", "x", at, &names[..11]),
                invited("f", "y", at, &names[11..])
            ]),
            json!({}),
        )
        .await;
    assert_eq!(refused.status, 400, "{}", text(&refused));
    assert!(
        text(&refused).contains("at most 20 more people"),
        "{}",
        text(&refused)
    );
    assert_eq!(
        chris.get(&env, URL).await["events"],
        Value::Null,
        "nothing was stored"
    );
    // A browser nobody signed in to cannot invite, and reads empty lists.
    let mut anonymous = Browser::new();
    let refused = anonymous
        .save(&env, json!([invited("e", "x", at, &["anna"])]), json!({}))
        .await;
    assert_eq!(refused.status, 403, "{}", text(&refused));
    assert_eq!(
        anonymous.get(&env, "/api/calendar/inbox").await,
        json!({ "invitations": [], "can_invite": false, "me": null })
    );
    assert_eq!(
        anonymous.get(&env, "/api/calendar/sent").await,
        json!({ "events": {}, "pending": false })
    );
    let lookup = anonymous
        .send(&env, "GET", "/api/calendar/people/anna", None)
        .await;
    assert_eq!(lookup.status, 401, "{}", text(&lookup));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_reconcile_cut_short_is_finished_by_the_next_read() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut anna = sign_up(&env, "anna", "Anna Berg").await;
    // Another reconcile holds the lock for the whole save: the save stores the
    // document, and sends nothing.
    // No reply carries an account id: it is found from the key Chris's first save writes.
    let first = chris.save(&env, json!([]), json!({})).await;
    assert_eq!(first.status, 200, "{}", text(&first));
    let (rows, _) = env
        .store("data")
        .scan_prefix(b"apps/calendar/users/", None, 10)
        .await
        .expect("scan");
    let key = String::from_utf8_lossy(&rows[0].0).into_owned();
    let principal = key.split('/').nth(3).expect("principal").to_string();
    env.store("data")
        .put_expiring(
            format!("apps/calendar/shared/locks/{principal}").as_bytes(),
            b"someone else",
            START_MS + 5 * MINUTE,
        )
        .await
        .expect("hold the lock");
    let at = START_MS + 60 * MINUTE;
    let saved = chris
        .save(
            &env,
            json!([invited("tea", "Tea", at, &["anna"])]),
            json!({}),
        )
        .await;
    assert_eq!(saved.status, 200, "{}", text(&saved));
    assert_eq!(
        anna.get(&env, "/api/calendar/inbox").await,
        json!({ "invitations": [], "can_invite": true, "me": "anna" })
    );
    // Once the lock has ended, the organizer's next read sends it.
    crate::support::advance(&env, 6 * MINUTE).await;
    let sent = chris.get(&env, "/api/calendar/sent").await;
    assert_eq!(sent["events"]["tea"][0]["status"], "pending", "{sent}");
    assert_eq!(
        anna.get(&env, "/api/calendar/inbox").await["invitations"][0]["event"]["title"],
        "Tea"
    );
}

/// The account id behind an account name, as the server keeps it.
async fn principal(env: &TestEnv, name: &str) -> String {
    macalicious_desktop::accounts::lookup(&mut env.store("data"), name)
        .await
        .expect("lookup")
        .expect("an account")
        .id
}

/// The store calls the calendar module has made so far, over every minute of
/// its counter, once the counter holds the module's first `requests` requests:
/// the router publishes a reply before it counts that request (`api_worker`).
async fn calendar_calls(env: &TestEnv, requests: u64) -> u64 {
    let key = format!("{}calendar", macalicious_desktop::applog::REQUESTS_PREFIX);
    let mut store = env.store("data");
    let counts = tokio::time::timeout(std::time::Duration::from_secs(10), async {
        loop {
            if let Some(bytes) = store.get(key.as_bytes()).await.expect("counter") {
                let counts: macalicious_desktop::applog::Counts =
                    serde_json::from_slice(&bytes).expect("counts");
                if counts.requests >= requests {
                    break counts;
                }
            }
            tokio::time::sleep(std::time::Duration::from_millis(25)).await;
        }
    })
    .await
    .unwrap_or_else(|_| panic!("the calendar counts {requests} requests within ten seconds"));
    assert_eq!(counts.requests, requests, "the calendar requests so far");
    counts.minutes.iter().map(|minute| minute.ops).sum()
}

/// The raw value of `key` in the data store, with its version.
async fn stored(env: &TestEnv, key: &str) -> Option<(Vec<u8>, u64)> {
    env.store("data")
        .get_versioned(key.as_bytes())
        .await
        .expect("read")
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn someone_taken_off_and_invited_again_is_told_again() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut anna = sign_up(&env, "anna", "Anna Berg").await;
    let at = START_MS + 90 * MINUTE;
    for (invitees, told) in [
        (vec!["anna"], "Chris Carter invited you"),
        (vec![], "Chris Carter cancelled an event"),
        (vec!["anna"], "Chris Carter invited you"),
    ] {
        let saved = chris
            .save(
                &env,
                json!([invited("tea", "Tea", at, &invitees)]),
                json!({}),
            )
            .await;
        assert_eq!(saved.status, 200, "{}", text(&saved));
        assert_eq!(notes(&env, &mut anna).await[0].1, told);
    }
    // The second invitation is a notification of its own, not the first one again.
    let invitations: Vec<String> = notes(&env, &mut anna)
        .await
        .into_iter()
        .filter(|(_, title, _)| title.ends_with("invited you"))
        .map(|(id, _, _)| id)
        .collect();
    assert_eq!(
        invitations.len(),
        1,
        "the first was withdrawn: {invitations:?}"
    );
    let inbox = anna.get(&env, "/api/calendar/inbox").await;
    assert_eq!(inbox["invitations"][0]["status"], "pending", "{inbox}");
    let first = invitations[0].clone();
    let saved = chris
        .save(&env, json!([invited("tea", "Tea", at, &[])]), json!({}))
        .await;
    assert_eq!(saved.status, 200, "{}", text(&saved));
    let saved = chris
        .save(
            &env,
            json!([invited("tea", "Tea", at, &["anna"])]),
            json!({}),
        )
        .await;
    assert_eq!(saved.status, 200, "{}", text(&saved));
    let again = notes(&env, &mut anna).await;
    assert_eq!(again[0].1, "Chris Carter invited you", "{again:?}");
    assert_ne!(again[0].0, first, "a new notification each time");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_save_that_changes_no_invitation_writes_no_card_and_tells_nobody() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let _anna = sign_up(&env, "anna", "Anna Berg").await;
    let at = START_MS + 90 * MINUTE;
    let with = |title: &str| {
        json!([
            invited("tea", "Tea", at, &["anna"]),
            event("walk", title, at)
        ])
    };
    let saved = chris.save(&env, with("Walk"), json!({})).await;
    assert_eq!(saved.status, 200, "{}", text(&saved));
    let card = format!(
        "apps/calendar/shared/invites/{}/tea",
        principal(&env, "chris").await
    );
    let changes = format!(
        "apps/notification-center/shared/changes/{}",
        principal(&env, "anna").await
    );
    let (card_before, count_before) = (stored(&env, &card).await, stored(&env, &changes).await);
    assert!(card_before.is_some(), "the card was written");
    // Two saves that change only the other event: measured from the second,
    // after the first has settled anything left over.
    let saved = chris.save(&env, with("Long walk"), json!({})).await;
    assert_eq!(saved.status, 200, "{}", text(&saved));
    let rev = chris.get(&env, URL).await["rev"].clone();
    // Two saves (a read and a write each) and this read.
    let calls = calendar_calls(&env, 5).await;
    let body = json!({ "events": with("Longer walk"), "rev": rev });
    let saved = chris.send(&env, "PUT", URL, Some(&body)).await;
    assert_eq!(saved.status, 200, "{}", text(&saved));
    let spent = calendar_calls(&env, 6).await - calls;
    eprintln!("store calls of a save that changes no invitation: {spent}");
    assert!(
        spent <= 16,
        "a save that invites nobody new made {spent} store calls"
    );
    assert_eq!(
        stored(&env, &card).await,
        card_before,
        "the card was not written again"
    );
    assert_eq!(
        stored(&env, &changes).await,
        count_before,
        "Anna's Calendar was not told to read again"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn work_left_after_the_card_is_written_is_finished_by_the_next_read() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut anna = sign_up(&env, "anna", "Anna Berg").await;
    let at = START_MS + 90 * MINUTE;
    let saved = chris
        .save(
            &env,
            json!([invited("tea", "Tea", at, &["anna"])]),
            json!({}),
        )
        .await;
    assert_eq!(saved.status, 200, "{}", text(&saved));
    let (chris_id, anna_id) = (
        principal(&env, "chris").await,
        principal(&env, "anna").await,
    );
    // As if the request had stopped once the card was written: Anna still to
    // be told, no inbox entry, and no reconcile finished at this revision.
    let key = format!("apps/calendar/shared/invites/{chris_id}/tea");
    let (bytes, _) = stored(&env, &key).await.expect("card");
    let mut card: Value = serde_json::from_slice(&bytes).expect("card json");
    card["invitees"][0]["due"] = json!(true);
    card["invitees"][0]["note"] = json!("");
    let mut data = env.store("data");
    data.put(key.as_bytes(), card.to_string().as_bytes())
        .await
        .expect("card");
    let (entries, _) = data
        .scan_prefix(
            format!("apps/calendar/shared/inbox/{anna_id}/").as_bytes(),
            None,
            10,
        )
        .await
        .expect("scan");
    for (entry, _, _) in entries {
        data.delete(&entry).await.expect("delete");
    }
    data.put(
        format!("apps/calendar/shared/reconciled/{chris_id}").as_bytes(),
        b"0",
    )
    .await
    .expect("marker");
    assert_eq!(
        anna.get(&env, "/api/calendar/inbox").await["invitations"],
        json!([])
    );

    let sent = chris.get(&env, "/api/calendar/sent").await;
    assert_eq!(sent["pending"], false, "{sent}");
    let inbox = anna.get(&env, "/api/calendar/inbox").await;
    assert_eq!(inbox["invitations"][0]["event"]["title"], "Tea", "{inbox}");
    assert_eq!(
        notes(&env, &mut anna).await[0].1,
        "Chris Carter invited you"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn an_inbox_holds_so_many_invitations_and_makes_room_from_stale_ones() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut anna = sign_up(&env, "anna", "Anna Berg").await;
    let at = START_MS + 90 * MINUTE;
    let saved = chris
        .save(
            &env,
            json!([invited("tea", "Tea", at, &["anna"])]),
            json!({}),
        )
        .await;
    assert_eq!(saved.status, 200, "{}", text(&saved));
    let (chris_id, anna_id) = (
        principal(&env, "chris").await,
        principal(&env, "anna").await,
    );
    let entry = json!({ "organizer": chris_id, "event": "tea" }).to_string();
    let stale = json!({ "organizer": chris_id, "event": "no-such-event" }).to_string();
    let mut data = env.store("data");
    // Anna's inbox full: entries of a live invitation, and one stale one.
    for n in 1..500 {
        let value = if n == 1 { &stale } else { &entry };
        data.put(
            format!("apps/calendar/shared/inbox/{anna_id}/{n:032x}").as_bytes(),
            value.as_bytes(),
        )
        .await
        .expect("entry");
    }
    // The stale entry makes room for one more.
    let saved = chris
        .save(
            &env,
            json!([
                invited("tea", "Tea", at, &["anna"]),
                invited("walk", "Walk", at, &["anna"])
            ]),
            json!({}),
        )
        .await;
    assert_eq!(saved.status, 200, "{}", text(&saved));
    let refused = chris
        .save(
            &env,
            json!([
                invited("tea", "Tea", at, &["anna"]),
                invited("walk", "Walk", at, &["anna"]),
                invited("run", "Run", at, &["anna"]),
            ]),
            json!({}),
        )
        .await;
    assert_eq!(refused.status, 422, "{}", text(&refused));
    assert!(
        text(&refused).contains("too many invitations"),
        "{}",
        text(&refused)
    );
    // Anna's own read lists each invitation once per entry, newest event first.
    let inbox = anna.get(&env, "/api/calendar/inbox").await;
    assert_eq!(inbox["invitations"].as_array().map(Vec::len), Some(500));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_save_that_asks_many_people_is_told_over_several_reads() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut people = Vec::new();
    for n in 1..=20 {
        let name = format!("p{n:02}");
        let browser = sign_up(&env, &name, &format!("Person {n}")).await;
        people.push((name, browser));
    }
    let names: Vec<&str> = people.iter().map(|(name, _)| name.as_str()).collect();
    let at = START_MS + 90 * MINUTE;
    // Forty invitations: more than one request tells.
    let saved = chris
        .save(
            &env,
            json!([
                invited("tea", "Tea", at, &names),
                invited("walk", "Walk", at + MINUTE, &names)
            ]),
            json!({}),
        )
        .await;
    assert_eq!(saved.status, 200, "{}", text(&saved));
    let first = chris.get(&env, "/api/calendar/sent").await;
    let mut reads = 1;
    let mut sent = first.clone();
    while sent["pending"] == true && reads < 10 {
        sent = chris.get(&env, "/api/calendar/sent").await;
        reads += 1;
    }
    assert_eq!(
        sent["pending"], false,
        "still pending after {reads} reads: {sent}"
    );
    assert!(
        reads > 1 || first["pending"] == true,
        "the work was spread over reads: {first}"
    );
    for (name, browser) in &mut people {
        let inbox = browser.get(&env, "/api/calendar/inbox").await;
        assert_eq!(
            inbox["invitations"].as_array().map(Vec::len),
            Some(2),
            "{name}: {inbox}"
        );
        assert_eq!(
            notes(&env, browser).await.len(),
            2,
            "{name} was told of each"
        );
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn an_inbox_read_keeps_the_entry_of_someone_still_to_be_cleared() {
    let env = boot().await;
    let mut chris = sign_up(&env, "chris", "Chris Carter").await;
    let mut anna = sign_up(&env, "anna", "Anna Berg").await;
    let at = START_MS + 90 * MINUTE;
    let saved = chris
        .save(
            &env,
            json!([invited("tea", "Tea", at, &["anna"])]),
            json!({}),
        )
        .await;
    assert_eq!(saved.status, 200, "{}", text(&saved));
    let (chris_id, anna_id) = (
        principal(&env, "chris").await,
        principal(&env, "anna").await,
    );
    // As if a pass had taken Anna off and stopped before clearing her.
    let key = format!("apps/calendar/shared/invites/{chris_id}/tea");
    let (bytes, _) = stored(&env, &key).await.expect("card");
    let mut card: Value = serde_json::from_slice(&bytes).expect("card json");
    card["leaving"] = json!([card["invitees"][0].clone()]);
    card["invitees"] = json!([]);
    let mut data = env.store("data");
    data.put(key.as_bytes(), card.to_string().as_bytes())
        .await
        .expect("card");
    let inbox = format!("apps/calendar/shared/inbox/{anna_id}/");
    let entries = |rows: Vec<(Vec<u8>, Vec<u8>, u64)>| rows.len();
    let (before, _) = data
        .scan_prefix(inbox.as_bytes(), None, 10)
        .await
        .expect("scan");
    assert_eq!(entries(before), 1);
    // Anna's read shows nothing, and leaves the entry to the reconcile.
    assert_eq!(
        anna.get(&env, "/api/calendar/inbox").await["invitations"],
        json!([])
    );
    let (after, _) = data
        .scan_prefix(inbox.as_bytes(), None, 10)
        .await
        .expect("scan");
    assert_eq!(entries(after), 1, "the entry is the reconcile's to clear");
}

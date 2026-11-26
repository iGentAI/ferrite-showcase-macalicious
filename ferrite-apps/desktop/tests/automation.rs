//! Script Editor, Automator and Siri on the in-process Forge planes
//! (`ferrite-app-test`): each acts on its own person's data through the apps'
//! own routes and nothing else; scripts cannot reach the network, a store,
//! another app's keys or another person; Automator's workflows run by hand
//! with a log, and calendar alarms and folder actions are refused; Siri's
//! commands work without a model provider and say so when one is needed.

use ferrite_app::serde_json::{self, json, Value};
use ferrite_app::{IngressReply, IngressRequest};
use ferrite_app_test::{ingress, TestEnv, TestHarness};

/// 2026-10-14T12:00:30Z, on the manual clock the runaway-script test moves on.
const START_MS: u64 = 1_791_979_230_000;

/// Scripts share one place per process (`engine::MAX_CONCURRENT`): the tests
/// that run them take turns, as people's requests wait for a place.
static SERIAL: std::sync::Mutex<()> = std::sync::Mutex::new(());

fn serial() -> std::sync::MutexGuard<'static, ()> {
    SERIAL
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

async fn boot() -> (crate::support::Env, ferrite_app::Clock) {
    let slot = crate::support::Slot::acquire();
    let env = TestHarness::new()
        .manual_clock(START_MS)
        .with_blob("files")
        .with_queue("requests")
        .with_queue("replies")
        .with_queue("live")
        .with_queue("frames")
        .with_store("data")
        .build()
        .await;
    // Advancing a script's deadline must not expire its in-flight queue lease.
    // Keep plane time fixed while the app's clock drives the engine wall limit.
    let app_clock = ferrite_app::Clock::manual(START_MS);
    let ctx = ferrite_app::AppContext::with_clock(env.payload().clone(), app_clock.clone());
    env.run_app(move |_| async move { macalicious_desktop::run(ctx).await });
    (crate::support::Env::new(env, slot), app_clock)
}

fn json_of(reply: &IngressReply) -> Value {
    serde_json::from_slice(&reply.body)
        .unwrap_or_else(|e| panic!("{e}: {}", String::from_utf8_lossy(&reply.body)))
}

/// A browser: its session cookie once the first reply set it.
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

    async fn get(&mut self, env: &TestEnv, path: &str) -> (u16, Value) {
        let reply = self.send(env, ingress::get(path)).await;
        (reply.status, json_of(&reply))
    }

    async fn write(
        &mut self,
        env: &TestEnv,
        method: &str,
        path: &str,
        body: Value,
    ) -> (u16, Value) {
        let mut req = ingress::request(method, path, "", body.to_string().as_bytes());
        req.headers
            .push(("content-type".into(), "application/json".into()));
        let reply = self.send(env, req).await;
        (reply.status, json_of(&reply))
    }

    async fn run(&mut self, env: &TestEnv, code: &str) -> Value {
        let (status, body) = self
            .write(
                env,
                "POST",
                "/api/script-editor/run",
                json!({ "code": code, "tz": 0 }),
            )
            .await;
        assert_eq!(status, 200, "{body}");
        body
    }

    async fn note_texts(&mut self, env: &TestEnv) -> Vec<String> {
        let (status, body) = self.get(env, "/api/notes/data").await;
        assert_eq!(status, 200, "{body}");
        body["data"]["notes"]
            .as_array()
            .map(Vec::as_slice)
            .unwrap_or_default()
            .iter()
            .map(|note| {
                note["lines"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .filter_map(Value::as_str)
                    .collect::<Vec<_>>()
                    .join("\n")
            })
            .collect()
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_script_opens_a_folder_in_finder_and_no_other_app_takes_one() {
    let _serial = serial();
    let (env, _) = boot().await;
    let mut a = Browser::new();

    let opened = a
        .run(&env, "Application('Finder').open('/Users/a/Documents');")
        .await;
    assert_eq!(opened["outcome"], "completed", "{opened}");
    assert_eq!(
        opened["effects"],
        json!([{ "open": "finder", "place": "/Users/a/Documents" }])
    );

    let plain = a.run(&env, "Application('Finder').open();").await;
    assert_eq!(plain["effects"], json!([{ "open": "finder" }]));

    let refused = a
        .run(&env, "Application('Notes').open('/Users/a/Documents');")
        .await;
    assert_eq!(refused["calls"][0]["ok"], false, "{refused}");
    assert_eq!(refused["effects"], json!([]));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_script_acts_for_its_person_and_reaches_nothing_else() {
    let _serial = serial();
    let (env, app_clock) = boot().await;
    let (mut a, mut b) = (Browser::new(), Browser::new());

    let made = a
        .run(
            &env,
            "const made = Notes.make({ title: 'Secret plan', text: 'for A only' });\n\
             console.log('made', made.length);\n\
             return made[0].title;",
        )
        .await;
    assert_eq!(made["outcome"], "completed", "{made}");
    assert_eq!(made["result"], "Secret plan");
    assert_eq!(made["logs"], json!(["made 1"]));
    assert_eq!(made["calls"][0]["action"], "notes.make");
    assert_eq!(made["calls"][0]["ok"], true);
    assert!(a
        .note_texts(&env)
        .await
        .iter()
        .any(|t| t.contains("Secret plan")));

    // The person's own routes answer with their own data.
    let own = a
        .run(
            &env,
            "return Desktop.request('notes', 'GET', '/data').body;",
        )
        .await;
    assert_eq!(own["outcome"], "completed", "{own}");
    assert!(own["result"].to_string().contains("Secret plan"), "{own}");

    // Another person's scripts see their own data, and only theirs, by action
    // or by route.
    let theirs = b
        .run(
            &env,
            "return Notes.make({ title: 'Errand of B', text: 'for B only' })[0].title;",
        )
        .await;
    assert_eq!(theirs["result"], "Errand of B", "{theirs}");
    let listed = b
        .run(&env, "return Notes.list().map((n) => n.title);")
        .await;
    assert_eq!(listed["outcome"], "completed", "{listed}");
    let listed_text = listed["result"].to_string();
    assert!(listed_text.contains("Errand of B"), "{listed}");
    assert!(!listed_text.contains("Secret plan"), "{listed}");
    let routed = b
        .run(
            &env,
            "return Desktop.request('notes', 'GET', '/data').body;",
        )
        .await;
    assert_eq!(routed["outcome"], "completed", "{routed}");
    let routed_text = routed["result"].to_string();
    assert!(routed_text.contains("Errand of B"), "{routed}");
    assert!(!routed_text.contains("Secret plan"), "{routed}");

    // Nothing outside the actions and the apps' own routes.
    for (code, expected) in [
        ("return fetch('https://example.com/');", "network"),
        (
            "return env.store('data').get('apps/notes/users/x/notes');",
            "store",
        ),
        (
            "return Desktop.request('keychain-access', 'GET', '/vault');",
            "may not call",
        ),
        (
            "return Desktop.request('script-editor', 'POST', '/run', { code: '1' });",
            "may not call",
        ),
        (
            "return Desktop.request('session', 'GET', '/');",
            "no app module",
        ),
        (
            "return Desktop.request('notes', 'GET', '/../../session');",
            "'..'",
        ),
        ("return Desktop.action('system.shutdown', {});", "no action"),
    ] {
        let run = b.run(&env, code).await;
        assert_ne!(run["outcome"], "completed", "{code}: {run}");
        assert!(
            run["error"].as_str().unwrap_or("").contains(expected),
            "{code}: {run}"
        );
    }

    // The engine's shim has no file system: a file read completes with nothing.
    let file = b.run(&env, "return std.loadFile('/etc/passwd');").await;
    assert_eq!(file["outcome"], "completed", "{file}");
    assert_eq!(file["result"], Value::Null, "{file}");

    // A runaway script is stopped. The test clock is moved on while it runs, so
    // the engine's wall-clock limit is what stops it, as on the real clock.
    //
    // The interpreter runs synchronously and holds one of this runtime's two
    // workers until the script ends. A worker blocked in a poll drives no
    // timers, and when it is the worker that was parked on the time driver the
    // other worker sleeps until it is handed a task, so no `tokio::time::sleep`
    // on this runtime fires until the script stops. A ticker task on this
    // runtime stalled with it (one run in three): the clock stood still, the
    // script ran on to its fuel limit, about 17 s, and its reply missed the
    // harness's 15 s bound. So the clock is moved from the blocking pool, on a
    // current-thread runtime of its own, whose timer the interpreter cannot
    // hold up. (The code gate refuses `std::thread` in tests as in the app.)
    //
    // The runtime waits for blocking tasks when it shuts down, so the ticker is
    // stopped by a guard: a failure that unwinds before the explicit stop below
    // must end the test, not leave the ticker running and the test hanging.
    struct StopOnDrop(std::sync::Arc<std::sync::atomic::AtomicBool>);
    impl Drop for StopOnDrop {
        fn drop(&mut self) {
            self.0.store(true, std::sync::atomic::Ordering::SeqCst);
        }
    }
    let stop = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let stop_ticker = StopOnDrop(stop.clone());
    let ticker = {
        let (clock, stop) = (app_clock, stop.clone());
        tokio::task::spawn_blocking(move || {
            let pacer = tokio::runtime::Builder::new_current_thread()
                .enable_time()
                .build()
                .expect("the ticker's runtime");
            pacer.block_on(async move {
                while !stop.load(std::sync::atomic::Ordering::SeqCst) {
                    clock.advance_ms(1_000);
                    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                }
            });
        })
    };
    let runaway = a.run(&env, "while (true) {}").await;
    drop(stop_ticker);
    ticker.await.expect("the clock task");
    assert_eq!(runaway["outcome"], "time_exhausted", "{runaway}");
    let (status, _) = a
        .write(
            &env,
            "POST",
            "/api/script-editor/run",
            json!({ "code": " " }),
        )
        .await;
    assert_eq!(status, 400, "an empty script is refused");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn scripts_are_saved_in_the_person_s_drive() {
    let _serial = serial();
    let (env, _) = boot().await;
    let (mut a, mut b) = (Browser::new(), Browser::new());
    let code = "return Calendar.events({ day: 'today' }).length;";
    let (status, saved) = a
        .write(
            &env,
            "POST",
            "/api/script-editor/scripts",
            json!({ "name": "Morning", "code": code }),
        )
        .await;
    assert_eq!(status, 201, "{saved}");
    assert_eq!(saved["path"], "Documents/Scripts/Morning.js");
    let id = saved["id"].as_str().unwrap().to_string();

    // The script is a file of the person's drive, in Documents/Scripts.
    let (status, drive) = a.get(&env, "/api/files/").await;
    assert_eq!(status, 200, "{drive}");
    let entries = drive["entries"].as_array().expect("the drive's entries");
    let file = entries
        .iter()
        .find(|entry| entry["id"] == id.as_str())
        .unwrap_or_else(|| panic!("no drive entry {id}: {drive}"));
    assert_eq!(file["name"], "Morning.js", "{file}");
    let folder = entries
        .iter()
        .find(|entry| entry["id"] == file["parent"])
        .unwrap_or_else(|| panic!("no parent folder: {drive}"));
    assert_eq!(folder["name"], "Scripts", "{folder}");
    assert_eq!(folder["parent"], "documents", "{folder}");

    let (_, listed) = a.get(&env, "/api/script-editor/scripts").await;
    assert_eq!(listed["scripts"][0]["name"], "Morning.js", "{listed}");
    let (status, opened) = a
        .get(&env, &format!("/api/script-editor/scripts/{id}"))
        .await;
    assert_eq!(status, 200, "{opened}");
    assert_eq!(opened["code"], code);

    // The same name again: a new name, or with replace the same one.
    let (_, again) = a
        .write(
            &env,
            "POST",
            "/api/script-editor/scripts",
            json!({ "name": "Morning", "code": "return 2;" }),
        )
        .await;
    assert_eq!(again["path"], "Documents/Scripts/Morning 2.js", "{again}");
    let (status, replaced) = a
        .write(
            &env,
            "POST",
            "/api/script-editor/scripts",
            json!({ "name": "Morning", "code": "return 3;", "replace": true }),
        )
        .await;
    assert_eq!(status, 201, "{replaced}");
    assert_eq!(replaced["path"], "Documents/Scripts/Morning.js");
    let replaced_id = replaced["id"].as_str().unwrap();
    let (status, reopened) = a
        .get(&env, &format!("/api/script-editor/scripts/{replaced_id}"))
        .await;
    assert_eq!(status, 200, "{reopened}");
    assert_eq!(reopened["code"], "return 3;", "{reopened}");
    let (_, listed) = a.get(&env, "/api/script-editor/scripts").await;
    assert_eq!(listed["scripts"].as_array().unwrap().len(), 2, "{listed}");

    // Another person can neither list nor open them, nor find them in their
    // own drive.
    let (_, theirs) = b.get(&env, "/api/script-editor/scripts").await;
    assert_eq!(theirs["scripts"], json!([]));
    let (status, _) = b
        .get(&env, &format!("/api/script-editor/scripts/{id}"))
        .await;
    assert_eq!(status, 404);
    let (status, their_drive) = b.get(&env, "/api/files/").await;
    assert_eq!(status, 200, "{their_drive}");
    assert!(their_drive["entries"].is_array(), "{their_drive}");
    assert!(
        !their_drive.to_string().contains("Morning"),
        "{their_drive}"
    );
}

fn step(action: &str, params: Value) -> Value {
    json!({ "action": action, "params": params })
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_workflow_runs_its_steps_with_a_real_log() {
    let _serial = serial();
    let (env, _) = boot().await;
    let mut a = Browser::new();
    let shopping = json!({
        "id": "shopping", "name": "Shopping", "kind": "workflow", "enabled": true,
        "steps": [
            step("text.get", json!({ "text": "Milk\nEggs" })),
            step("reminders.add", json!({ "list": "" })),
            step("text.combine", json!({ "separator": ", " })),
        ],
    });
    let (status, log) = a
        .write(
            &env,
            "POST",
            "/api/automator/run",
            json!({ "workflow": shopping, "tz": 0 }),
        )
        .await;
    assert_eq!(status, 200, "{log}");
    assert_eq!(log["ok"], true, "{log}");
    assert_eq!(log["steps"][1]["status"], "completed");
    assert_eq!(log["steps"][1]["items"], 2);
    assert_eq!(log["output"], json!(["Milk, Eggs"]));
    let (_, reminders) = a.get(&env, "/api/reminders/data").await;
    let titles: Vec<&str> = reminders["data"]["reminders"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|r| r["title"].as_str())
        .collect();
    assert!(
        titles.contains(&"Milk") && titles.contains(&"Eggs"),
        "{titles:?}"
    );

    // A step that fails stops the workflow, and the log says why.
    let broken = json!({
        "id": "broken", "name": "Broken", "kind": "workflow", "enabled": true,
        "steps": [
            step("files.read", json!({ "path": "Documents/missing.txt" })),
            step("notes.make", json!({ "title": "After the failure", "text": "must not be made" })),
        ],
    });
    let (_, log) = a
        .write(
            &env,
            "POST",
            "/api/automator/run",
            json!({ "workflow": broken, "tz": 0 }),
        )
        .await;
    assert_eq!(log["ok"], false);
    assert_eq!(log["steps"][0]["status"], "failed");
    assert!(log["steps"][0]["message"]
        .as_str()
        .unwrap()
        .contains("missing.txt"));
    assert_eq!(log["steps"][1]["status"], "skipped");
    assert!(
        !a.note_texts(&env)
            .await
            .iter()
            .any(|t| t.contains("After the failure")),
        "a step after the failing one ran"
    );

    // Run JavaScript takes the input and hands on what it returns; it has the
    // actions but not the apps' raw routes.
    let shout = json!({
        "id": "shout", "name": "Shout", "kind": "workflow", "enabled": true,
        "steps": [
            step("text.get", json!({ "text": "a\nb" })),
            step("javascript.run", json!({ "code": "console.log(input.length); return input.map((i) => i.text.toUpperCase());" })),
        ],
    });
    let (_, log) = a
        .write(
            &env,
            "POST",
            "/api/automator/run",
            json!({ "workflow": shout, "tz": 0 }),
        )
        .await;
    assert_eq!(log["ok"], true, "{log}");
    assert_eq!(log["output"], json!(["A", "B"]));
    assert_eq!(log["steps"][1]["logs"], json!(["2"]));
    let sneaky = json!({
        "id": "sneaky", "name": "Sneaky", "kind": "workflow", "enabled": true,
        "steps": [step("javascript.run", json!({ "code": "return Desktop.request('notes', 'GET', '/data');" }))],
    });
    let (_, log) = a
        .write(
            &env,
            "POST",
            "/api/automator/run",
            json!({ "workflow": sneaky, "tz": 0 }),
        )
        .await;
    assert_eq!(log["ok"], false, "{log}");

    // Every run is in the log, newest first.
    let (_, runs) = a.get(&env, "/api/automator/runs").await;
    let names: Vec<&str> = runs["runs"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|r| r["name"].as_str())
        .collect();
    assert_eq!(names, ["Sneaky", "Shout", "Broken", "Shopping"]);

    // A workflow that is not one is refused before anything runs.
    let (status, _) = a
        .write(
            &env,
            "POST",
            "/api/automator/run",
            json!({ "workflow": { "id": "x", "name": "X", "kind": "workflow", "enabled": true, "steps": [step("notes.make", json!({ "input": ["forged"] }))] } }),
        )
        .await;
    assert_eq!(status, 400);

    // Plug-in kinds are refused, not stored: a web page cannot join a print dialog or a camera.
    let (status, refused) = a
        .write(
            &env,
            "PUT",
            "/api/automator/workflows",
            json!({ "library": { "tz": 0, "workflows": [{ "id": "plugin", "name": "Daily", "kind": "print-plugin", "enabled": true, "steps": [] }] }, "rev": 0 }),
        )
        .await;
    assert_eq!(status, 400, "{refused}");
    assert!(
        refused["error"]
            .as_str()
            .unwrap()
            .contains("not one this desktop keeps"),
        "{refused}"
    );
    let (status, refused) = a
        .write(
            &env,
            "PUT",
            "/api/automator/workflows",
            json!({ "library": { "tz": 0, "workflows": [{ "id": "camera", "name": "Inbox", "kind": "image-capture-plugin", "enabled": true, "steps": [] }] }, "rev": 0 }),
        )
        .await;
    assert_eq!(status, 400, "{refused}");
    assert!(
        refused["error"]
            .as_str()
            .unwrap()
            .contains("not one this desktop keeps"),
        "{refused}"
    );
    let (_, stored) = a.get(&env, "/api/automator/workflows").await;
    assert_eq!(stored["library"], Value::Null, "{stored}");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn siri_acts_without_a_model_and_says_when_one_is_needed() {
    let _serial = serial();
    let (env, _) = boot().await;
    let mut a = Browser::new();
    let ask = |text: &str| json!({ "text": text, "tz": 120 });

    // Sent from UTC+12, where 12:00:30 UTC is already 00:00:30 on the 15th:
    // "tomorrow" there is the 16th, a day later than in UTC.
    let (status, said) = a
        .write(
            &env,
            "POST",
            "/api/siri/ask",
            json!({ "text": "Hey Siri, remind me to call Mom at 5pm tomorrow", "tz": 720 }),
        )
        .await;
    assert_eq!(status, 200, "{said}");
    assert_eq!(said["via"], "commands");
    assert!(
        said["text"]
            .as_str()
            .unwrap()
            .contains("tomorrow at 5:00 PM"),
        "{said}"
    );
    let (_, reminders) = a.get(&env, "/api/reminders/data").await;
    let reminder = reminders["data"]["reminders"]
        .as_array()
        .unwrap()
        .iter()
        .find(|r| r["title"] == "call Mom")
        .cloned()
        .expect("the reminder");
    assert_eq!(reminder["due"], "2026-10-16", "{reminder}");
    assert_eq!(reminder["dueTime"], "17:00");

    let (_, said) = a
        .write(&env, "POST", "/api/siri/ask", ask("What is 6 times 7?"))
        .await;
    assert_eq!(said["text"], "6 × 7 is 42.");

    // Siri's part of a desktop command is the effect it answers; the page that
    // asked carries it out (switches and saves its own theme, opens the app),
    // which e2e/siri-journey.mjs checks in a browser. The server changes no
    // setting itself.
    let (status, before) = a.get(&env, "/api/system-preferences/settings").await;
    assert_eq!(status, 200, "{before}");
    let (_, said) = a
        .write(&env, "POST", "/api/siri/ask", ask("Turn on dark mode"))
        .await;
    assert_eq!(said["effects"], json!([{ "appearance": "dark" }]), "{said}");
    let (status, after) = a.get(&env, "/api/system-preferences/settings").await;
    assert_eq!(status, 200, "{after}");
    assert_eq!(after, before, "Siri changed the stored settings");

    let (_, said) = a
        .write(&env, "POST", "/api/siri/ask", ask("Open Notes"))
        .await;
    assert_eq!(said["effects"], json!([{ "open": "notes" }]));

    let (_, said) = a
        .write(
            &env,
            "POST",
            "/api/siri/ask",
            ask("What is the meaning of life?"),
        )
        .await;
    assert_eq!(said["understood"], false);
    assert!(
        said["text"].as_str().unwrap().contains("model provider"),
        "{said}"
    );
    let (_, status_body) = a.get(&env, "/api/siri/status").await;
    assert_eq!(status_body["model"], false);
    assert_eq!(status_body["needs"]["secret"], "siri_anthropic_api_key");

    // Another person's Siri lists their own reminders, and none of A's.
    let mut b = Browser::new();
    let (status, said) = b
        .write(
            &env,
            "POST",
            "/api/siri/ask",
            ask("Remind me to buy stamps"),
        )
        .await;
    assert_eq!(status, 200, "{said}");
    let (status, said) = b
        .write(&env, "POST", "/api/siri/ask", ask("What are my reminders?"))
        .await;
    assert_eq!(status, 200, "{said}");
    assert_eq!(said["text"], "You have 1 reminder to do.", "{said}");
    assert!(said["card"].to_string().contains("buy stamps"), "{said}");
    assert!(!said.to_string().contains("call Mom"), "{said}");

    // A request sent twice with one idempotency key acts once and answers the
    // same both times; the key used for another request is refused.
    let keyed = |text: &str, key: &str| {
        let mut req = ingress::request(
            "POST",
            "/api/siri/ask",
            "",
            ask(text).to_string().as_bytes(),
        );
        req.headers
            .push(("content-type".into(), "application/json".into()));
        req.headers.push(("idempotency-key".into(), key.into()));
        req
    };
    let first = a
        .send(&env, keyed("Make a note that says Buy flowers", "k-1"))
        .await;
    let again = a
        .send(&env, keyed("Make a note that says Buy flowers", "k-1"))
        .await;
    assert_eq!((first.status, again.status), (200, 200));
    assert_eq!(json_of(&first), json_of(&again));
    let made = a
        .note_texts(&env)
        .await
        .iter()
        .filter(|t| t.contains("Buy flowers"))
        .count();
    assert_eq!(made, 1, "one note for one key");
    let other = a
        .send(&env, keyed("Make a note that says Buy bread", "k-1"))
        .await;
    assert_eq!(other.status, 422);
    assert!(
        !a.note_texts(&env)
            .await
            .iter()
            .any(|t| t.contains("Buy bread")),
        "the refused request made its note"
    );
}

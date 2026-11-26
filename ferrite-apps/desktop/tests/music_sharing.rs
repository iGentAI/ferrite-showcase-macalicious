//! Home Sharing between two accounts, on the in-process Forge planes. Chris's library
//! holds one drive song, one Internet Archive song, a private playlist and an open one;
//! Martin listens. Every read asks the server whether the library is lent at that moment.

use ferrite_app::{serde_json, IngressReply};
use ferrite_app_test::{ingress, TestEnv, TestHarness};
use serde_json::{json, Value};

const PEPPER: &str = "test-pepper-0123456789abcdef0123456789abcdef";
const SOUND: &[u8] = b"RIFF the bytes of a song, nothing else";
const LIBRARY_URL: &str = "/api/music/sharing/libraries/chris";
const SONG_URL: &str = "/api/music/sharing/libraries/chris/songs/kelp";

async fn boot() -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let env = TestHarness::new()
        .with_blob("files")
        .with_queue("requests")
        .with_queue("replies")
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
}

impl Browser {
    async fn send(&mut self, env: &TestEnv, method: &str, path: &str, body: &[u8]) -> IngressReply {
        let mut req = ingress::request(method, path, "", body);
        req.headers
            .push(("content-type".into(), "application/json".into()));
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
            let pair = cookie.split(';').next().unwrap_or("").trim();
            if let Some(token) = pair.strip_prefix("mac_session=") {
                self.token = Some(token.to_string());
            }
        }
        reply
    }

    async fn get(&mut self, env: &TestEnv, path: &str) -> IngressReply {
        self.send(env, "GET", path, b"").await
    }

    async fn json(&mut self, env: &TestEnv, method: &str, path: &str, body: Value) -> Value {
        let reply = self.send(env, method, path, body.to_string().as_bytes()).await;
        let text = String::from_utf8_lossy(&reply.body).into_owned();
        assert!(reply.status < 300, "{method} {path}: {} {text}", reply.status);
        serde_json::from_str(&text).unwrap_or_else(|e| panic!("{e}: {text}"))
    }

    async fn share(&mut self, env: &TestEnv, on: bool) {
        let answer = self.json(env, "PUT", "/api/music/sharing", json!({ "on": on })).await;
        assert_eq!(answer["on"], on);
    }

    /// Who this browser sees sharing, by full name.
    async fn sharers(&mut self, env: &TestEnv) -> Vec<String> {
        let listed = self.json(env, "GET", "/api/music/sharing/libraries", Value::Null).await;
        listed["libraries"]
            .as_array()
            .expect("a list")
            .iter()
            .map(|person| person["full_name"].as_str().expect("a name").to_string())
            .collect()
    }
}

async fn sign_up(env: &TestEnv, name: &str, full_name: &str) -> Browser {
    let mut browser = Browser { token: None };
    let body = json!({ "name": name, "full_name": full_name, "password": "correct horse battery" });
    let reply = browser
        .send(env, "POST", "/api/session/sign-up", body.to_string().as_bytes())
        .await;
    assert_eq!(reply.status, 201, "{}", String::from_utf8_lossy(&reply.body));
    browser
}

/// A drive file of `bytes` for `browser`, by id.
async fn upload(browser: &mut Browser, env: &TestEnv, name: &str, bytes: &[u8]) -> String {
    let start = browser
        .json(
            env,
            "POST",
            "/api/files/uploads",
            json!({ "parent": "music", "name": name, "size": bytes.len(), "type": "audio/wav" }),
        )
        .await;
    let upload = start["upload"].as_str().expect("an upload").to_string();
    let piece = browser
        .send(env, "PUT", &format!("/api/files/uploads/{upload}/0"), bytes)
        .await;
    assert_eq!(piece.status, 200, "{}", String::from_utf8_lossy(&piece.body));
    let done = browser
        .json(env, "POST", &format!("/api/files/uploads/{upload}/complete"), json!({}))
        .await;
    done["created"][0].as_str().expect("a file").to_string()
}

fn library(file: &str) -> Value {
    json!({
        "songs": [
            {
                "id": "kelp", "title": "Kelp", "artist": "Tide", "album": "Shore", "genre": "Ambient",
                "year": 2001, "track": 1, "duration": 10.0, "added": 1, "artwork": null, "rating": 5,
                "comments": "marker-comment",
                "source": { "kind": "file", "file": file, "name": "secret-name.wav", "type": "audio/wav",
                            "size": SOUND.len() }
            },
            {
                "id": "reef", "title": "Reef", "artist": "Tide", "album": "Shore", "genre": "",
                "year": null, "track": 2, "duration": 20.0, "added": 2, "artwork": null,
                "source": { "kind": "stream", "url": "https://archive.org/download/reef/reef.mp3" }
            }
        ],
        "playlists": [
            { "id": "open", "name": "Open Mix", "songs": ["kelp"] },
            { "id": "mine", "name": "Private Mix", "songs": ["reef"], "private": true },
            { "id": "rules", "name": "Smart Mix", "songs": [],
              "smart": { "all": true, "rules": [{ "field": "plays", "op": "greater", "value": "1" }] } }
        ],
        "loved": ["kelp"],
    })
}

async fn chris_with_a_library(env: &TestEnv) -> (Browser, String) {
    let mut chris = sign_up(env, "chris", "Chris Marsh").await;
    let file = upload(&mut chris, env, "kelp.wav", SOUND).await;
    chris
        .json(env, "PUT", "/api/music/library", json!({ "library": library(&file), "rev": 0 }))
        .await;
    chris
        .json(
            env,
            "PUT",
            "/api/music/playback",
            json!({ "playback": { "queue": ["kelp"], "unshuffled": [], "index": 0, "position": 3.0,
                "shuffle": false, "repeat": "off", "volume": 70, "recent": ["kelp"],
                "plays": { "kelp": 41 } }, "rev": 0 }),
        )
        .await;
    (chris, file)
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_library_is_lent_only_between_turning_on_and_turning_off() {
    let env = boot().await;
    let (mut chris, _) = chris_with_a_library(&env).await;
    let mut martin = sign_up(&env, "martin", "Martin Holt").await;

    let off = chris.json(&env, "GET", "/api/music/sharing", Value::Null).await;
    assert_eq!(off["on"], false, "off until it is turned on");
    assert_eq!(martin.sharers(&env).await, Vec::<String>::new());
    let listing = martin.get(&env, LIBRARY_URL).await;
    assert_eq!(listing.status, 403);
    assert!(!String::from_utf8_lossy(&listing.body).contains("Kelp"));
    let refused = martin.get(&env, SONG_URL).await;
    assert_eq!(refused.status, 403);
    assert!(
        !refused.body.windows(4).any(|part| part == b"RIFF"),
        "no bytes of the song"
    );

    chris.share(&env, true).await;
    assert_eq!(
        json_on(&mut chris, &env).await,
        true,
        "kept on the server"
    );
    assert_eq!(martin.sharers(&env).await, ["Chris Marsh"]);
    assert_eq!(
        chris.sharers(&env).await,
        Vec::<String>::new(),
        "a person does not listen to themself"
    );
    let listed = martin.json(&env, "GET", LIBRARY_URL, Value::Null).await;
    assert_eq!(listed["songs"][0]["title"], "Kelp");
    let song = martin.get(&env, SONG_URL).await;
    assert_eq!(song.status, 200);
    assert_eq!(song.body, SOUND);
    let header = |name: &str| {
        song.headers
            .iter()
            .find(|(n, _)| n.eq_ignore_ascii_case(name))
            .map(|(_, value)| value.as_str())
    };
    assert_eq!(header("x-file-pieces"), Some("1"));
    assert_eq!(header("cache-control"), Some("no-store"));
    assert_eq!(header("x-content-type-options"), Some("nosniff"));

    chris.share(&env, false).await;
    assert_eq!(martin.sharers(&env).await, Vec::<String>::new());
    assert_eq!(martin.get(&env, LIBRARY_URL).await.status, 403);
    let again = martin.get(&env, SONG_URL).await;
    assert_eq!(again.status, 403, "a listener with the library open is refused too");
    assert!(!again.body.windows(4).any(|part| part == b"RIFF"));

    chris.share(&env, false).await;
    chris.share(&env, true).await;
    chris.share(&env, true).await;
    assert_eq!(martin.get(&env, SONG_URL).await.status, 200, "each is idempotent");
}

async fn json_on(browser: &mut Browser, env: &TestEnv) -> bool {
    browser.json(env, "GET", "/api/music/sharing", Value::Null).await["on"]
        .as_bool()
        .expect("on is a boolean")
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_listener_reaches_only_the_songs_and_only_what_they_may_see() {
    let env = boot().await;
    let (mut chris, file) = chris_with_a_library(&env).await;
    let other = upload(&mut chris, &env, "diary.txt", b"a private diary").await;
    chris.share(&env, true).await;
    let mut martin = sign_up(&env, "martin", "Martin Holt").await;

    let listed = martin.json(&env, "GET", LIBRARY_URL, Value::Null).await;
    let text = listed.to_string();
    for private in [
        "Private Mix",
        "Smart Mix",
        "rating",
        "plays",
        "loved",
        "marker-comment",
        "secret-name",
        file.as_str(),
    ] {
        assert!(!text.contains(private), "{private} shows in {text}");
    }
    assert_eq!(listed["playlists"], json!([{ "id": "open", "name": "Open Mix", "songs": ["kelp"] }]));
    assert_eq!(listed["songs"][1]["source"]["url"], "https://archive.org/download/reef/reef.mp3");

    let nowhere = martin.get(&env, &format!("{LIBRARY_URL}/songs/nowhere")).await;
    assert_eq!(nowhere.status, 404, "a song not in the library");
    for raw in [&file, &other] {
        let by_file = martin.get(&env, &format!("{LIBRARY_URL}/songs/{raw}")).await;
        assert_eq!(by_file.status, 404, "a file id is not a song");
        assert!(by_file.body.windows(5).all(|part| part != b"diary"));
    }
    assert_eq!(
        martin.get(&env, &format!("{LIBRARY_URL}/songs/reef")).await.status,
        409,
        "a song at an address has no bytes here"
    );
    assert_eq!(
        martin.get(&env, &format!("/api/files/content/{other}")).await.status,
        404,
        "the drive's own route is still the listener's own drive"
    );

    let before = chris.json(&env, "GET", "/api/music/library", Value::Null).await;
    for (method, path) in [
        ("PUT", LIBRARY_URL),
        ("POST", LIBRARY_URL),
        ("DELETE", LIBRARY_URL),
        ("PUT", SONG_URL),
        ("DELETE", SONG_URL),
    ] {
        let body = json!({ "library": { "songs": [], "playlists": [], "loved": [] }, "rev": 1 });
        let write = martin.send(&env, method, path, body.to_string().as_bytes()).await;
        assert_eq!(write.status, 405, "{method} {path}");
    }
    assert_eq!(
        chris.json(&env, "GET", "/api/music/library", Value::Null).await,
        before,
        "nothing of it changed"
    );
    assert_eq!(chris.get(&env, &format!("/api/files/content/{file}")).await.body, SOUND);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_guest_and_a_browser_signed_in_to_nothing_neither_share_nor_listen() {
    let env = boot().await;
    let (mut chris, _) = chris_with_a_library(&env).await;
    chris.share(&env, true).await;

    let mut stranger = Browser { token: None };
    let mut guest = Browser { token: None };
    let signed_in = guest.send(&env, "POST", "/api/session/guest", b"{}").await;
    assert!(signed_in.status < 300, "{}", String::from_utf8_lossy(&signed_in.body));
    for browser in [&mut stranger, &mut guest] {
        assert_eq!(browser.sharers(&env).await, Vec::<String>::new());
        assert_eq!(browser.get(&env, LIBRARY_URL).await.status, 403);
        assert_eq!(browser.get(&env, SONG_URL).await.status, 403);
        let refused = browser
            .send(&env, "PUT", "/api/music/sharing", br#"{"on":true}"#)
            .await;
        assert_eq!(refused.status, 403);
    }

    let mut martin = sign_up(&env, "martin", "Martin Holt").await;
    assert_eq!(
        martin.get(&env, "/api/music/sharing/libraries/nobody").await.status,
        403,
        "nobody and somebody not sharing read alike"
    );
}

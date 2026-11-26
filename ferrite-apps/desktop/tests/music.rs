//! Network fixtures: shared tests omit outbound bindings; `local-egress`
//! repeats them with Forge's deny-all policy. See tests/README.md.
//!
//! Music on the in-process Forge planes (`ferrite-app-test`): each browser
//! keeps its own library, playback and Preferences under the revision rule, a
//! library that does not hold together is refused, Preferences other than the
//! settings this desktop carries out are refused, covers are kept under the
//! SHA-256 of their bytes, and the Internet Archive routes answer 502 when
//! egress refuses the Archive (the harness's egress is deny-all, so nothing
//! here reaches the network) and 503 when the application has no `archive`
//! egress at all.

use crate::egress_profile;

use ferrite_app::{serde_json, IngressReply, IngressRequest};
use ferrite_app_test::{ingress, TestEnv, TestHarness};

async fn boot(egress: bool) -> crate::support::Env {
    boot_in(crate::support::Slot::acquire(), egress).await
}

/// Boots in `slot`: a test's second environment, beside its first, takes
/// [`crate::support::Slot::beside`].
async fn boot_in(slot: crate::support::Slot, egress: bool) -> crate::support::Env {
    let harness = TestHarness::new()
        .with_queue("requests")
        .with_queue("replies")
        .with_store("data");
    #[cfg(feature = "local-egress")]
    let harness = if egress {
        harness.with_egress("archive")
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
        .and_then(|pair| pair.split_once('=').map(|(_, v)| v.to_string()))
        .expect("the session cookie")
}

async fn get(env: &TestEnv, token: &str, path: &str) -> IngressReply {
    call(env, with_cookie(ingress::get(path), token)).await
}

async fn send(env: &TestEnv, token: &str, method: &str, path: &str, body: Vec<u8>) -> IngressReply {
    let mut req = ingress::request(method, path, "", body);
    req.headers
        .push(("content-type".into(), "application/json".into()));
    call(env, with_cookie(req, token)).await
}

fn library(songs: &[&str]) -> serde_json::Value {
    let songs: Vec<_> = songs
        .iter()
        .map(|id| {
            serde_json::json!({
                "id": id, "title": format!("Song {id}"), "artist": "Artist", "album": "Album",
                "genre": "", "year": null, "track": 1, "duration": 10.0, "added": 1, "artwork": null,
                "source": { "kind": "file", "file": format!("f-{id}"), "name": format!("{id}.wav"),
                            "type": "audio/wav", "size": 441000 }
            })
        })
        .collect();
    serde_json::json!({
        "songs": songs,
        "playlists": [{ "id": "p1", "name": "Mix", "songs": [songs[0]["id"]] }],
        "loved": [songs[0]["id"]],
    })
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn each_browser_keeps_its_own_library_and_playback() {
    let env = boot(false).await;
    let a = browser(&env).await;
    let b = browser(&env).await;

    let empty = json(&get(&env, &a, "/api/music/library").await);
    assert_eq!(empty["library"], serde_json::Value::Null);
    assert_eq!(empty["rev"], 0);

    let body = serde_json::json!({ "library": library(&["s1", "s2"]), "rev": 0 });
    let saved = send(
        &env,
        &a,
        "PUT",
        "/api/music/library",
        serde_json::to_vec(&body).unwrap(),
    )
    .await;
    assert_eq!(
        saved.status,
        200,
        "{}",
        String::from_utf8_lossy(&saved.body)
    );
    assert_eq!(json(&saved)["rev"], 1);

    let stale = send(
        &env,
        &a,
        "PUT",
        "/api/music/library",
        serde_json::to_vec(&body).unwrap(),
    )
    .await;
    assert_eq!(stale.status, 409, "a save on an old revision is refused");
    assert_eq!(
        json(&stale)["library"]["songs"].as_array().unwrap().len(),
        2
    );

    let read = json(&get(&env, &a, "/api/music/library").await);
    assert_eq!(read["library"]["playlists"][0]["name"], "Mix");
    assert_eq!(read["library"]["songs"][1]["source"]["kind"], "file");
    assert_eq!(
        json(&get(&env, &b, "/api/music/library").await)["library"],
        serde_json::Value::Null,
        "another browser sees none of it"
    );

    let playback = serde_json::json!({ "playback": {
        "queue": ["s1", "s2"], "unshuffled": [], "index": 1, "position": 3.0, "shuffle": false,
        "repeat": "all", "volume": 70, "recent": ["s2", "s1"], "plays": { "s1": 1 } }, "rev": 0 });
    let kept = send(
        &env,
        &a,
        "PUT",
        "/api/music/playback",
        serde_json::to_vec(&playback).unwrap(),
    )
    .await;
    assert_eq!(kept.status, 200, "{}", String::from_utf8_lossy(&kept.body));
    let back = json(&get(&env, &a, "/api/music/playback").await);
    assert_eq!(back["playback"]["position"], 3.0);
    assert_eq!(back["playback"]["repeat"], "all");

    let forgot = send(&env, &a, "DELETE", "/api/music/library", Vec::new()).await;
    assert_eq!(forgot.status, 200);
    assert_eq!(
        json(&get(&env, &a, "/api/music/library").await)["library"],
        serde_json::Value::Null
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn each_browser_keeps_its_own_preferences_and_only_those_that_work() {
    let env = boot(false).await;
    let a = browser(&env).await;
    let b = browser(&env).await;
    let put = |rev: u64, preferences: serde_json::Value| {
        serde_json::to_vec(&serde_json::json!({ "preferences": preferences, "rev": rev })).unwrap()
    };
    let large = serde_json::json!({
        "listSize": "large", "notifications": false, "miniPlayerOnTop": true });

    let none = json(&get(&env, &a, "/api/music/preferences").await);
    assert_eq!(none["preferences"], serde_json::Value::Null);
    assert_eq!(none["rev"], 0);

    let saved = send(
        &env,
        &a,
        "PUT",
        "/api/music/preferences",
        put(0, large.clone()),
    )
    .await;
    assert_eq!(
        saved.status,
        200,
        "{}",
        String::from_utf8_lossy(&saved.body)
    );
    assert_eq!(json(&saved)["rev"], 1);
    let back = json(&get(&env, &a, "/api/music/preferences").await);
    assert_eq!(back["preferences"], large);
    assert_eq!(
        json(&get(&env, &b, "/api/music/preferences").await)["preferences"],
        serde_json::Value::Null,
        "another browser keeps its own"
    );

    let stale = send(
        &env,
        &a,
        "PUT",
        "/api/music/preferences",
        put(0, large.clone()),
    )
    .await;
    assert_eq!(stale.status, 409, "a save on an old revision is refused");
    assert_eq!(json(&stale)["preferences"], large);

    // A setting past what the window offers is not kept, nor an unknown list size, nor a
    // missing field.
    for refused in [
        serde_json::json!({ "listSize": "large", "notifications": true,
                            "miniPlayerOnTop": false, "crossfadeSeconds": 13 }),
        serde_json::json!({ "listSize": "huge", "notifications": true, "miniPlayerOnTop": false }),
        serde_json::json!({ "listSize": "small", "notifications": true }),
        serde_json::json!({ "listSize": "small", "notifications": "yes", "miniPlayerOnTop": false }),
    ] {
        let reply = send(
            &env,
            &a,
            "PUT",
            "/api/music/preferences",
            put(1, refused.clone()),
        )
        .await;
        assert_eq!(reply.status, 400, "{refused}");
    }
    assert_eq!(
        json(&get(&env, &a, "/api/music/preferences").await)["rev"],
        1,
        "nothing refused was stored"
    );

    let forgot = send(&env, &a, "DELETE", "/api/music/preferences", Vec::new()).await;
    assert_eq!(forgot.status, 200);
    assert_eq!(
        json(&get(&env, &a, "/api/music/preferences").await)["preferences"],
        serde_json::Value::Null
    );
    assert_eq!(
        send(&env, &a, "POST", "/api/music/preferences", Vec::new())
            .await
            .status,
        405
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_playback_keeps_its_epoch_and_a_bad_one_is_refused() {
    let env = boot(false).await;
    let a = browser(&env).await;
    let named = |epoch: &str, rev: u64| {
        serde_json::to_vec(&serde_json::json!({ "playback": {
            "queue": ["s1"], "unshuffled": [], "index": 0, "position": 1.5, "shuffle": false,
            "repeat": "off", "volume": 80, "recent": [], "plays": {}, "epoch": epoch },
            "rev": rev }))
        .unwrap()
    };
    let kept = send(&env, &a, "PUT", "/api/music/playback", named("pb-one", 0)).await;
    assert_eq!(kept.status, 200, "{}", String::from_utf8_lossy(&kept.body));
    let back = json(&get(&env, &a, "/api/music/playback").await);
    assert_eq!(back["playback"]["epoch"], "pb-one");
    let bad = send(&env, &a, "PUT", "/api/music/playback", named("a/b", 1)).await;
    assert_eq!(bad.status, 400, "an epoch is a plain id");
    // A playback saved before epochs were kept still reads, without one.
    let plain = serde_json::to_vec(&serde_json::json!({ "playback": {
        "queue": [], "unshuffled": [], "index": 0, "position": 0.0, "shuffle": false,
        "repeat": "off", "volume": 100, "recent": [], "plays": {} }, "rev": 1 }))
    .unwrap();
    assert_eq!(
        send(&env, &a, "PUT", "/api/music/playback", plain)
            .await
            .status,
        200
    );
    let read = json(&get(&env, &a, "/api/music/playback").await);
    assert!(read["playback"].get("epoch").is_none(), "{read}");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_library_that_does_not_hold_together_is_refused() {
    let env = boot(false).await;
    let a = browser(&env).await;
    let mut stray = library(&["s1"]);
    stray["loved"] = serde_json::json!(["nope"]);
    let reply = send(
        &env,
        &a,
        "PUT",
        "/api/music/library",
        serde_json::to_vec(&serde_json::json!({ "library": stray, "rev": 0 })).unwrap(),
    )
    .await;
    assert_eq!(
        reply.status, 400,
        "Loved names a song the library does not have"
    );

    let mut closed = library(&["s1"]);
    closed["songs"][0]["source"] = serde_json::json!({ "kind": "archive", "item": "x",
        "files": { "mp3": "a.mp3" }, "license": "https://example.com/all-rights-reserved" });
    let reply = send(
        &env,
        &a,
        "PUT",
        "/api/music/library",
        serde_json::to_vec(&serde_json::json!({ "library": closed, "rev": 0 })).unwrap(),
    )
    .await;
    assert_eq!(reply.status, 400, "only openly licensed Archive music");
    assert_eq!(
        json(&get(&env, &a, "/api/music/library").await)["rev"],
        0,
        "nothing was stored"
    );
}

/// A window behind another one's save is told to read the library again, even
/// when what it would have saved could not have been kept.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_stale_save_is_a_conflict_whatever_it_names() {
    let env = boot(false).await;
    let a = browser(&env).await;
    let first = serde_json::json!({ "library": library(&["s1"]), "rev": 0 });
    let saved = send(
        &env,
        &a,
        "PUT",
        "/api/music/library",
        serde_json::to_vec(&first).unwrap(),
    )
    .await;
    assert_eq!(saved.status, 200);

    let mut unopened = library(&["s1"]);
    unopened["songs"][0]["source"] = serde_json::json!({ "kind": "archive", "item": "never-opened",
        "files": { "mp3": "a.mp3" }, "license": "http://creativecommons.org/licenses/by/4.0/" });
    let stale = send(
        &env,
        &a,
        "PUT",
        "/api/music/library",
        serde_json::to_vec(&serde_json::json!({ "library": unopened, "rev": 0 })).unwrap(),
    )
    .await;
    assert_eq!(
        stale.status,
        409,
        "{}",
        String::from_utf8_lossy(&stale.body)
    );
    assert_eq!(json(&stale)["rev"], 1);

    let current = send(
        &env,
        &a,
        "PUT",
        "/api/music/library",
        serde_json::to_vec(&serde_json::json!({ "library": unopened, "rev": 1 })).unwrap(),
    )
    .await;
    assert_eq!(current.status, 400, "on the current revision it is checked");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn covers_are_kept_under_their_digest_for_their_browser() {
    let env = boot(false).await;
    let a = browser(&env).await;
    let b = browser(&env).await;
    let png = b"\x89PNG\r\n\x1a\nnot really a picture".to_vec();
    let digest = ferrite_app::crypto::hex(&ferrite_app::crypto::sha256(&png));
    let url = format!("/api/music/artwork/{digest}");

    let wrong = send(
        &env,
        &a,
        "PUT",
        &format!("/api/music/artwork/{}", "0".repeat(64)),
        png.clone(),
    )
    .await;
    assert_eq!(
        wrong.status, 400,
        "a body whose digest differs from its name"
    );
    let gif = send(&env, &a, "PUT", &url, b"GIF89a".to_vec()).await;
    assert_eq!(gif.status, 400, "only JPEG and PNG");

    let kept = send(&env, &a, "PUT", &url, png.clone()).await;
    assert_eq!(kept.status, 201, "{}", String::from_utf8_lossy(&kept.body));
    assert_eq!(
        send(&env, &a, "PUT", &url, png.clone()).await.status,
        200,
        "stored once"
    );
    let image = get(&env, &a, &url).await;
    assert_eq!(image.status, 200);
    assert_eq!(image.body, png);
    assert!(image
        .headers
        .iter()
        .any(|(n, v)| n.eq_ignore_ascii_case("content-type") && v == "image/png"));
    assert_eq!(
        get(&env, &b, &url).await.status,
        404,
        "another browser's cover is not found"
    );
    assert_eq!(send(&env, &a, "DELETE", &url, Vec::new()).await.status, 200);
    assert_eq!(get(&env, &a, &url).await.status, 404);
    assert_eq!(
        send(&env, &a, "DELETE", &url, Vec::new()).await.status,
        200,
        "deleted is deleted, however often it is asked"
    );

    assert_eq!(
        send(&env, &a, "PUT", &url, png.clone()).await.status,
        201,
        "a deleted cover can be kept again"
    );
    assert_eq!(get(&env, &a, &url).await.body, png);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_stored_library_names_only_covers_that_are_stored() {
    let env = boot(false).await;
    let a = browser(&env).await;
    let png = b"\x89PNG\r\n\x1a\na cover".to_vec();
    let digest = ferrite_app::crypto::hex(&ferrite_app::crypto::sha256(&png));
    let url = format!("/api/music/artwork/{digest}");
    let save = |rev: u64, artwork: serde_json::Value| {
        let mut songs = library(&["s1"]);
        songs["songs"][0]["artwork"] = artwork;
        serde_json::to_vec(&serde_json::json!({ "library": songs, "rev": rev })).unwrap()
    };

    // Named before it was kept (or after a concurrent save let it go): the song
    // is stored without it.
    let without = send(
        &env,
        &a,
        "PUT",
        "/api/music/library",
        save(0, digest.clone().into()),
    )
    .await;
    assert_eq!(
        without.status,
        200,
        "{}",
        String::from_utf8_lossy(&without.body)
    );
    assert_eq!(
        json(&without)["library"]["songs"][0]["artwork"],
        serde_json::Value::Null
    );
    let read = json(&get(&env, &a, "/api/music/library").await);
    assert_eq!(
        read["library"]["songs"][0]["artwork"],
        serde_json::Value::Null
    );

    assert_eq!(send(&env, &a, "PUT", &url, png.clone()).await.status, 201);
    let with = send(
        &env,
        &a,
        "PUT",
        "/api/music/library",
        save(1, digest.clone().into()),
    )
    .await;
    assert_eq!(with.status, 200);
    assert_eq!(
        json(&get(&env, &a, "/api/music/library").await)["library"]["songs"][0]["artwork"],
        digest.as_str()
    );
    assert_eq!(
        send(&env, &a, "DELETE", &url, Vec::new()).await.status,
        409,
        "a cover the library names stays"
    );
    assert_eq!(get(&env, &a, &url).await.status, 200);

    // The save that lets it go forgets it.
    let dropped = send(
        &env,
        &a,
        "PUT",
        "/api/music/library",
        save(2, serde_json::Value::Null),
    )
    .await;
    assert_eq!(dropped.status, 200);
    assert_eq!(get(&env, &a, &url).await.status, 404);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn the_internet_archive_routes_check_their_input_and_report_egress() {
    let env = boot(egress_profile::DENIED).await;
    let a = browser(&env).await;
    let search = get(&env, &a, "/api/music/archive/search?q=jazz&page=1").await;
    assert_eq!(
        search.status,
        egress_profile::FAILURE_STATUS,
        "deny-all egress: {}",
        String::from_utf8_lossy(&search.body)
    );
    assert!(json(&search)["error"].as_str().unwrap().contains("egress"));
    let item = get(&env, &a, "/api/music/archive/item/DWK255").await;
    assert_eq!(item.status, egress_profile::FAILURE_STATUS);
    assert_eq!(
        get(&env, &a, "/api/music/archive/item/a%2Fb").await.status,
        400
    );
    assert_eq!(
        get(&env, &a, "/api/music/archive/search?page=0")
            .await
            .status,
        400
    );
    let long = format!("/api/music/archive/search?q={}", "a".repeat(101));
    assert_eq!(get(&env, &a, &long).await.status, 400);
    let post = send(&env, &a, "POST", "/api/music/archive/search", Vec::new()).await;
    assert_eq!(post.status, 405);

    let bare = boot_in(crate::support::Slot::beside(), false).await;
    let c = browser(&bare).await;
    assert_eq!(
        get(&bare, &c, "/api/music/archive/search?q=jazz")
            .await
            .status,
        503,
        "no archive egress declared"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn radio_checks_what_it_is_asked_and_reports_egress() {
    let slot = crate::support::Slot::acquire();
    let harness = TestHarness::new()
        .with_queue("requests")
        .with_queue("replies")
        .with_store("data");
    #[cfg(feature = "local-egress")]
    let harness = harness.with_egress("radio");
    let env = harness.build().await;
    let env = crate::support::Env::new(env, slot);
    env.run_app(|ctx| async move { macalicious_desktop::run(ctx).await });
    let a = browser(&env).await;
    let found = get(
        &env,
        &a,
        "/api/music/radio/stations?name=sea&genre=jazz&page=2",
    )
    .await;
    assert_eq!(
        found.status,
        egress_profile::FAILURE_STATUS,
        "deny-all egress: {}",
        String::from_utf8_lossy(&found.body)
    );
    assert!(json(&found)["error"]
        .as_str()
        .unwrap()
        .contains("Radio Browser"));
    for bad in [
        "/api/music/radio/stations?genre=polka",
        "/api/music/radio/stations?page=0",
        "/api/music/radio/stations?page=21",
    ] {
        assert_eq!(get(&env, &a, bad).await.status, 400, "{bad}");
    }
    let long = format!("/api/music/radio/stations?name={}", "a".repeat(101));
    assert_eq!(get(&env, &a, &long).await.status, 400);
    let post = send(&env, &a, "POST", "/api/music/radio/stations", Vec::new()).await;
    assert_eq!(post.status, 405);

    let bare = boot_in(crate::support::Slot::beside(), false).await;
    let c = browser(&bare).await;
    assert_eq!(
        get(&bare, &c, "/api/music/radio/stations").await.status,
        503,
        "no radio egress declared"
    );
}

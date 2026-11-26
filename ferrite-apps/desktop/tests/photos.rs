//! Photos on the in-process Forge planes (`ferrite-app-test`): each session's
//! library of photos (records naming drive files, thumbnails, edits,
//! favourites, Recently Deleted) and its albums, the
//! refusals of what the module does not keep, and a resend or two deliveries
//! of one photo kept once.

use crate::support;

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

/// The thumbnail bytes a test sends: a JPEG's first bytes and a marker.
const THUMB: &[u8] = &[0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3];
const THUMB_B64: &str = "/9j/4AECAw==";
const EDITED: &[u8] = &[0xFF, 0xD8, 0xFF, 0xE0, 9, 9];
const EDITED_B64: &str = "/9j/4AkJ";

#[derive(Clone)]
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

    async fn library(&mut self, env: &TestEnv) -> serde_json::Value {
        let reply = self.send(env, ingress::get("/api/photos/library")).await;
        assert_eq!(
            reply.status,
            200,
            "{}",
            String::from_utf8_lossy(&reply.body)
        );
        json(&reply)
    }

    async fn post(&mut self, env: &TestEnv, path: &str, body: serde_json::Value) -> IngressReply {
        let mut req = ingress::request("POST", path, "", body.to_string().as_bytes());
        req.headers
            .push(("content-type".into(), "application/json".into()));
        self.send(env, req).await
    }

    async fn delete(&mut self, env: &TestEnv, path: &str) -> IngressReply {
        self.send(env, ingress::request("DELETE", path, "", b""))
            .await
    }

    async fn add(&mut self, env: &TestEnv, id: &str) -> IngressReply {
        self.post(env, "/api/photos/photos", new_photo(id)).await
    }

    async fn thumbs(&mut self, env: &TestEnv, ids: &str) -> serde_json::Value {
        let path = format!("/api/photos/thumbs?ids={ids}");
        let reply = self.send(env, ingress::get(&path)).await;
        assert_eq!(reply.status, 200);
        json(&reply)["thumbs"].clone()
    }
}

fn new_photo(id: &str) -> serde_json::Value {
    serde_json::json!({
        "id": id,
        "file": format!("file-{id}"),
        "name": "Beach",
        "mime": "image/jpeg",
        "bytes": 300_000,
        "width": 4000,
        "height": 3000,
        "taken_ms": 1_570_000_000_000u64,
        "source": "import",
        "camera": "Canon EOS R",
        "thumb": THUMB_B64,
    })
}

fn ids(library: &serde_json::Value) -> Vec<String> {
    library["photos"]
        .as_array()
        .unwrap()
        .iter()
        .map(|p| p["id"].as_str().unwrap().to_string())
        .collect()
}

fn b64url(bytes: &[u8]) -> String {
    ferrite_app::crypto::base64url_encode(bytes)
}

/// Every key Photos keeps in the `data` store, every person's (`Storage::user` is
/// `apps/photos/users/<principal>/`), with the size of its value.
async fn stored(env: &TestEnv) -> Vec<(String, usize)> {
    let prefix = b"apps/photos/users/";
    let mut out = Vec::new();
    let mut after: Option<Vec<u8>> = None;
    loop {
        let (rows, more) = env
            .store("data")
            .scan_prefix(prefix, after.as_deref(), 1024)
            .await
            .unwrap();
        for (key, value, _) in rows {
            after = Some(key.clone());
            out.push((String::from_utf8_lossy(&key).into_owned(), value.len()));
        }
        if !more || after.is_none() {
            break;
        }
    }
    out
}

/// How many thumbnails of photo `id` are stored.
fn thumbs_of(keys: &[(String, usize)], id: &str) -> usize {
    let part = format!("/thumb/{id}/");
    keys.iter().filter(|(key, _)| key.contains(&part)).count()
}

/// The size of the stored library document.
fn library_bytes(keys: &[(String, usize)]) -> usize {
    keys.iter()
        .filter(|(key, _)| key.ends_with("/library") || key.contains("/shard/"))
        .map(|(_, size)| *size)
        .sum()
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_session_keeps_its_photos_and_a_resend_keeps_one() {
    let env = boot().await;
    let (mut a, mut b) = (Browser::new(), Browser::new());
    let empty = a.library(&env).await;
    assert_eq!(empty["photos"], serde_json::json!([]));
    assert_eq!(empty["limits"]["photos"], 10240);
    assert!(empty["session"].is_string());

    let added = a.add(&env, "p1").await;
    assert_eq!(
        added.status,
        201,
        "{}",
        String::from_utf8_lossy(&added.body)
    );
    let photo = json(&added)["photo"].clone();
    assert_eq!(photo["file"], "file-p1");
    assert_eq!(photo["favorite"], false);
    assert_eq!(photo["deleted_ms"], serde_json::Value::Null);
    assert_eq!(photo["camera"], "Canon EOS R");

    // The same photo sent again: the one kept, unchanged.
    let mut again = new_photo("p1");
    again["name"] = "Other".into();
    let resent = a.post(&env, "/api/photos/photos", again).await;
    assert_eq!(resent.status, 200);
    assert_eq!(json(&resent)["photo"], photo);
    assert_eq!(ids(&a.library(&env).await), ["p1"]);

    // A photo taken before 1970 keeps its date, and comes first.
    let mut old = new_photo("p0");
    old["file"] = "file-p0".into();
    old["taken_ms"] = (-1_000_000_000_000_i64).into();
    let kept = a.post(&env, "/api/photos/photos", old).await;
    assert_eq!(kept.status, 201, "{}", String::from_utf8_lossy(&kept.body));
    assert_eq!(json(&kept)["photo"]["taken_ms"], -1_000_000_000_000_i64);
    assert_eq!(ids(&a.library(&env).await), ["p0", "p1"]);
    assert_eq!(a.delete(&env, "/api/photos/photos/p0").await.status, 200);

    // The thumbnail, as base64url; another session sees nothing of it.
    assert_eq!(
        a.thumbs(&env, "p1,nope").await,
        serde_json::json!({ "p1": b64url(THUMB) })
    );
    assert_eq!(b.library(&env).await["photos"], serde_json::json!([]));
    assert_eq!(b.thumbs(&env, "p1").await, serde_json::json!({}));
    let foreign = b
        .post(
            &env,
            "/api/photos/photos/p1",
            serde_json::json!({ "favorite": true }),
        )
        .await;
    assert_eq!(foreign.status, 404);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn what_the_module_does_not_keep_is_refused() {
    let env = boot().await;
    let mut a = Browser::new();
    let refused = |field: &str, value: serde_json::Value| {
        let mut body = new_photo("x");
        body[field] = value;
        body
    };
    for (body, status) in [
        (refused("mime", "image/heic".into()), 400),
        (refused("source", "camera-roll".into()), 400),
        (refused("width", 0.into()), 400),
        (refused("bytes", 0.into()), 400),
        (refused("file", "a/b".into()), 400),
        (refused("id", "a b".into()), 400),
        (refused("name", "   ".into()), 400),
        (refused("thumb", "iVBORw==".into()), 400),
        (refused("thumb", "not base64".into()), 400),
        (
            refused(
                "thumb",
                format!(
                    "{}==",
                    ferrite_app::crypto::base64url_encode(&[0xFF; 96_001])
                        .replace('-', "+")
                        .replace('_', "/")
                )
                .into(),
            ),
            413,
        ),
        (serde_json::json!({ "id": "x", "surprise": 1 }), 400),
    ] {
        let reply = a.post(&env, "/api/photos/photos", body.clone()).await;
        assert_eq!(
            reply.status,
            status,
            "{body}: {}",
            String::from_utf8_lossy(&reply.body)
        );
    }
    assert_eq!(a.library(&env).await["photos"], serde_json::json!([]));

    a.add(&env, "p1").await;
    let bad_edit = a
        .post(
            &env,
            "/api/photos/photos/p1",
            serde_json::json!({ "edit": { "filter": "sparkle" }, "thumb": EDITED_B64 }),
        )
        .await;
    assert_eq!(bad_edit.status, 400);
    let no_thumb = a
        .post(
            &env,
            "/api/photos/photos/p1",
            serde_json::json!({ "edit": { "rotate": 1 } }),
        )
        .await;
    assert_eq!(no_thumb.status, 400);
    let stray_thumb = a
        .post(
            &env,
            "/api/photos/photos/p1",
            serde_json::json!({ "favorite": true, "thumb": EDITED_B64 }),
        )
        .await;
    assert_eq!(stray_thumb.status, 400);
    let many = (0..49)
        .map(|n| format!("p{n}"))
        .collect::<Vec<_>>()
        .join(",");
    let too_many = a
        .send(
            &env,
            ingress::get(&format!("/api/photos/thumbs?ids={many}")),
        )
        .await;
    assert_eq!(too_many.status, 400);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn favourites_deletes_and_edits_are_kept_and_an_edit_reverts() {
    let env = boot().await;
    let mut a = Browser::new();
    a.add(&env, "p1").await;

    let fav = a
        .post(
            &env,
            "/api/photos/photos/p1",
            serde_json::json!({ "favorite": true, "name": "Shore" }),
        )
        .await;
    assert_eq!(fav.status, 200);
    assert_eq!(json(&fav)["photo"]["favorite"], true);
    assert_eq!(json(&fav)["photo"]["name"], "Shore");

    let edit = serde_json::json!({
        "rotate": 1,
        "crop": { "x": 0.1, "y": 0.1, "width": 0.5, "height": 0.5 },
        "adjust": { "exposure": 0.3 },
        "filter": "mono",
    });
    let edited = a
        .post(
            &env,
            "/api/photos/photos/p1",
            serde_json::json!({ "edit": edit, "thumb": EDITED_B64 }),
        )
        .await;
    assert_eq!(
        edited.status,
        200,
        "{}",
        String::from_utf8_lossy(&edited.body)
    );
    let photo = json(&edited)["photo"].clone();
    assert_eq!(photo["edit"]["filter"], "mono");
    assert_eq!(photo["edit"]["rotate"], 1);
    assert_eq!(photo["edit"]["adjust"]["exposure"], 0.3);
    assert!(photo["edited_ms"].is_u64());
    // The library keeps all of it, and the edited thumbnail is answered.
    let kept = a.library(&env).await["photos"][0].clone();
    assert_eq!(kept, photo);
    assert_eq!(a.thumbs(&env, "p1").await["p1"], b64url(EDITED));

    // Recently Deleted and back.
    let gone = a
        .post(
            &env,
            "/api/photos/photos/p1",
            serde_json::json!({ "deleted": true }),
        )
        .await;
    assert!(json(&gone)["photo"]["deleted_ms"].is_u64());
    let back = a
        .post(
            &env,
            "/api/photos/photos/p1",
            serde_json::json!({ "deleted": false }),
        )
        .await;
    assert_eq!(json(&back)["photo"]["deleted_ms"], serde_json::Value::Null);

    // Revert to Original: the edit and its thumbnail are gone, the original's is answered.
    let reverted = a
        .post(
            &env,
            "/api/photos/photos/p1",
            serde_json::json!({ "edit": null }),
        )
        .await;
    assert_eq!(reverted.status, 200);
    assert_eq!(json(&reverted)["photo"]["edit"], serde_json::Value::Null);
    assert_eq!(a.thumbs(&env, "p1").await["p1"], b64url(THUMB));

    // An edit that changes nothing is a revert too, and needs no thumbnail.
    let plain = a
        .post(
            &env,
            "/api/photos/photos/p1",
            serde_json::json!({ "edit": { "rotate": 0, "filter": "none" } }),
        )
        .await;
    assert_eq!(plain.status, 200);
    assert_eq!(json(&plain)["photo"]["edit"], serde_json::Value::Null);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn albums_hold_photos_and_lose_one_deleted_for_good() {
    let env = boot().await;
    let mut a = Browser::new();
    a.add(&env, "p1").await;
    a.add(&env, "p2").await;

    let made = a
        .post(
            &env,
            "/api/photos/albums",
            serde_json::json!({ "id": "trip", "name": " Trip " }),
        )
        .await;
    assert_eq!(made.status, 201);
    assert_eq!(json(&made)["albums"][0]["name"], "Trip");
    let again = a
        .post(
            &env,
            "/api/photos/albums",
            serde_json::json!({ "id": "trip", "name": "Trip" }),
        )
        .await;
    assert_eq!(again.status, 200, "making an album twice keeps one");

    let added = a
        .post(
            &env,
            "/api/photos/albums/trip",
            serde_json::json!({ "add": ["p2", "p1", "p2"], "name": "Summer" }),
        )
        .await;
    assert_eq!(added.status, 200);
    let album = json(&added)["albums"][0].clone();
    assert_eq!(album["photos"], serde_json::json!(["p2", "p1"]));
    assert_eq!(album["name"], "Summer");
    let missing = a
        .post(
            &env,
            "/api/photos/albums/trip",
            serde_json::json!({ "add": ["nope"] }),
        )
        .await;
    assert_eq!(missing.status, 404);
    let no_album = a
        .post(
            &env,
            "/api/photos/albums/none",
            serde_json::json!({ "add": ["p1"] }),
        )
        .await;
    assert_eq!(no_album.status, 404);

    // Deleted for good: the drive file is answered for the page to remove, and the album lets
    // the photo go.
    let gone = a.delete(&env, "/api/photos/photos/p2").await;
    assert_eq!(
        json(&gone),
        serde_json::json!({ "deleted": true, "file": "file-p2", "external": null })
    );
    let library = a.library(&env).await;
    assert_eq!(ids(&library), ["p1"]);
    assert_eq!(library["albums"][0]["photos"], serde_json::json!(["p1"]));
    assert_eq!(a.thumbs(&env, "p2").await, serde_json::json!({}));

    let removed = a
        .post(
            &env,
            "/api/photos/albums/trip",
            serde_json::json!({ "remove": ["p1"] }),
        )
        .await;
    assert_eq!(json(&removed)["albums"][0]["photos"], serde_json::json!([]));
    let deleted = a.delete(&env, "/api/photos/albums/trip").await;
    assert_eq!(json(&deleted)["albums"], serde_json::json!([]));
    assert_eq!(
        ids(&a.library(&env).await),
        ["p1"],
        "deleting an album keeps its photos"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn albums_keep_their_order_and_photos_move_between_them_in_one_write() {
    let env = boot().await;
    let mut a = Browser::new();
    a.add(&env, "p1").await;
    let mut second = new_photo("p2");
    second["file"] = "file-p2".into();
    a.post(&env, "/api/photos/photos", second).await;
    for (id, name) in [("trip", "Trip"), ("best", "Best")] {
        let made = a
            .post(
                &env,
                "/api/photos/albums",
                serde_json::json!({ "id": id, "name": name }),
            )
            .await;
        assert_eq!(made.status, 201);
        assert_eq!(
            json(&made)["albums"].as_array().unwrap().last().unwrap()["sort"],
            "custom",
            "a new album lists its photos as they were added"
        );
    }
    a.post(
        &env,
        "/api/photos/albums/trip",
        serde_json::json!({ "add": ["p1", "p2"] }),
    )
    .await;

    // The order is kept with the album, and only a known order is taken.
    let sorted = a
        .post(
            &env,
            "/api/photos/albums/trip",
            serde_json::json!({ "sort": "newest" }),
        )
        .await;
    assert_eq!(sorted.status, 200);
    assert_eq!(a.library(&env).await["albums"][0]["sort"], "newest");
    let unknown = a
        .post(
            &env,
            "/api/photos/albums/trip",
            serde_json::json!({ "sort": "random" }),
        )
        .await;
    assert_eq!(unknown.status, 400);
    assert_eq!(a.library(&env).await["albums"][0]["sort"], "newest");

    // Move p2 from Trip to Best: one write, it leaves Trip as it joins Best.
    let moved = a
        .post(
            &env,
            "/api/photos/albums/best",
            serde_json::json!({ "add": ["p2"], "from": "trip" }),
        )
        .await;
    assert_eq!(
        moved.status,
        200,
        "{}",
        String::from_utf8_lossy(&moved.body)
    );
    let albums = json(&moved)["albums"].clone();
    assert_eq!(albums[0]["photos"], serde_json::json!(["p1"]));
    assert_eq!(albums[1]["photos"], serde_json::json!(["p2"]));

    // A move that cannot happen changes neither album.
    for (body, status) in [
        (serde_json::json!({ "add": ["p1"], "from": "nowhere" }), 404),
        (serde_json::json!({ "add": ["p1"], "from": "best" }), 400),
        (serde_json::json!({ "add": ["gone"], "from": "trip" }), 404),
    ] {
        let refused = a.post(&env, "/api/photos/albums/best", body).await;
        assert_eq!(refused.status, status);
    }
    let library = a.library(&env).await;
    assert_eq!(library["albums"][0]["photos"], serde_json::json!(["p1"]));
    assert_eq!(library["albums"][1]["photos"], serde_json::json!(["p2"]));

    // Another person sees none of it and cannot move it.
    let mut b = Browser::new();
    let theirs = b.library(&env).await;
    assert_eq!(theirs["albums"], serde_json::json!([]));
    assert_eq!(theirs["photos"], serde_json::json!([]));
    let stranger = b
        .post(
            &env,
            "/api/photos/albums/best",
            serde_json::json!({ "add": ["p1"], "from": "trip" }),
        )
        .await;
    assert_eq!(stranger.status, 404, "another person cannot move my photos");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn two_deliveries_of_one_photo_keep_one_with_its_own_thumbnail() {
    let env = boot().await;
    let mut a = Browser::new();
    a.library(&env).await;
    // Two deliveries of one id with other names and other thumbnails, at
    // once: one is kept, and the thumbnail is the one sent with it.
    let mut beach = new_photo("same");
    beach["name"] = "Beach".into();
    let mut snow = new_photo("same");
    snow["name"] = "Snow".into();
    snow["thumb"] = EDITED_B64.into();
    let (mut x, mut y) = (a.clone(), a.clone());
    let (first, second) = support::join(
        x.post(&env, "/api/photos/photos", beach),
        y.post(&env, "/api/photos/photos", snow),
    )
    .await;
    let mut statuses = [first.status, second.status];
    statuses.sort();
    assert_eq!(statuses, [200, 201]);
    let library = a.library(&env).await;
    assert_eq!(ids(&library), ["same"]);
    let expected = if library["photos"][0]["name"] == "Beach" {
        THUMB
    } else {
        EDITED
    };
    assert_eq!(a.thumbs(&env, "same").await["same"], b64url(expected));

    // Two edits at once: the recipe kept and the edited thumbnail kept are
    // from the same request.
    let mono = serde_json::json!({ "edit": { "filter": "mono" }, "thumb": EDITED_B64 });
    let noir = serde_json::json!({ "edit": { "filter": "noir" }, "thumb": THUMB_B64 });
    let (mut x, mut y) = (a.clone(), a.clone());
    let (first, second) = support::join(
        x.post(&env, "/api/photos/photos/same", mono),
        y.post(&env, "/api/photos/photos/same", noir),
    )
    .await;
    assert_eq!((first.status, second.status), (200, 200));
    let kept = a.library(&env).await["photos"][0]["edit"]["filter"].clone();
    assert!(kept == "mono" || kept == "noir", "{kept}");
    let expected = if kept == "mono" { EDITED } else { THUMB };
    assert_eq!(a.thumbs(&env, "same").await["same"], b64url(expected));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn one_original_belongs_to_one_photo() {
    let env = boot().await;
    let mut a = Browser::new();
    a.add(&env, "p1").await;
    let mut twin = new_photo("p2");
    twin["file"] = "file-p1".into();
    let refused = a.post(&env, "/api/photos/photos", twin).await;
    assert_eq!(refused.status, 409);
    // Nor a file waiting to be removed from the drive.
    a.delete(&env, "/api/photos/photos/p1").await;
    let mut pending = new_photo("p3");
    pending["file"] = "file-p1".into();
    assert_eq!(
        a.post(&env, "/api/photos/photos", pending).await.status,
        409
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn originals_stay_in_purge_until_the_page_confirms_their_removal() {
    let env = boot().await;
    let mut a = Browser::new();
    a.add(&env, "p1").await;
    a.add(&env, "p2").await;
    a.post(
        &env,
        "/api/photos/albums",
        serde_json::json!({ "id": "trip", "name": "Trip" }),
    )
    .await;

    // Deleting twice hands the original over once.
    let (mut x, mut y) = (a.clone(), a.clone());
    let (first, second) = support::join(
        x.delete(&env, "/api/photos/photos/p1"),
        y.delete(&env, "/api/photos/photos/p1"),
    )
    .await;
    let mut deleted = [
        json(&first)["deleted"] == true,
        json(&second)["deleted"] == true,
    ];
    deleted.sort();
    assert_eq!(deleted, [false, true]);
    // A lost reply loses nothing: every listing names the file until confirmed.
    assert_eq!(
        a.library(&env).await["purge"],
        serde_json::json!(["file-p1"])
    );
    assert_eq!(
        a.library(&env).await["purge"],
        serde_json::json!(["file-p1"])
    );
    // An album cannot take a photo deleted for good.
    let dangling = a
        .post(
            &env,
            "/api/photos/albums/trip",
            serde_json::json!({ "add": ["p1"] }),
        )
        .await;
    assert_eq!(dangling.status, 404);

    let confirmed = a
        .post(
            &env,
            "/api/photos/purged",
            serde_json::json!({ "files": ["file-p1", "unknown"] }),
        )
        .await;
    assert_eq!(confirmed.status, 200);
    assert_eq!(json(&confirmed)["purge"], serde_json::json!([]));
    assert_eq!(a.library(&env).await["purge"], serde_json::json!([]));
    assert_eq!(ids(&a.library(&env).await), ["p2"]);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn deleting_for_good_reclaims_every_stored_image_and_the_record() {
    let env = boot().await;
    let mut a = Browser::new();
    a.add(&env, "p1").await;
    let mut second = new_photo("p2");
    second["file"] = "file-p2".into();
    a.post(&env, "/api/photos/photos", second).await;
    let edit = serde_json::json!({ "edit": { "filter": "mono" }, "thumb": EDITED_B64 });
    assert_eq!(
        a.post(&env, "/api/photos/photos/p1", edit.clone())
            .await
            .status,
        200
    );
    let keys = stored(&env).await;
    assert_eq!(
        thumbs_of(&keys, "p1"),
        2,
        "the original's thumbnail and the edit's: {keys:?}"
    );
    assert_eq!(thumbs_of(&keys, "p2"), 1);
    let full = library_bytes(&keys);
    assert!(full > 0, "{keys:?}");

    // Revert to Original drops the edit's thumbnail; editing again stores a new one.
    a.post(
        &env,
        "/api/photos/photos/p1",
        serde_json::json!({ "edit": null }),
    )
    .await;
    assert_eq!(thumbs_of(&stored(&env).await, "p1"), 1);
    a.post(&env, "/api/photos/photos/p1", edit).await;
    assert_eq!(thumbs_of(&stored(&env).await, "p1"), 2);

    // Recently Deleted keeps everything: the photo can still be recovered whole.
    a.post(
        &env,
        "/api/photos/photos/p1",
        serde_json::json!({ "deleted": true }),
    )
    .await;
    assert_eq!(thumbs_of(&stored(&env).await, "p1"), 2);
    assert_eq!(a.thumbs(&env, "p1").await["p1"], b64url(EDITED));

    // Deleted for good: its thumbnails and its record leave storage, the other photo's stay,
    // and its original is handed over for removal from the drive exactly once.
    let gone = a.delete(&env, "/api/photos/photos/p1").await;
    assert_eq!(
        json(&gone),
        serde_json::json!({ "deleted": true, "file": "file-p1", "external": null })
    );
    let keys = stored(&env).await;
    assert_eq!(thumbs_of(&keys, "p1"), 0, "{keys:?}");
    assert_eq!(
        thumbs_of(&keys, "p2"),
        1,
        "the other photo keeps its thumbnail"
    );
    assert!(
        library_bytes(&keys) < full,
        "the record left the library document ({} >= {full})",
        library_bytes(&keys)
    );
    assert_eq!(a.thumbs(&env, "p1").await, serde_json::json!({}));
    assert_eq!(
        a.library(&env).await["purge"],
        serde_json::json!(["file-p1"])
    );
    a.post(
        &env,
        "/api/photos/purged",
        serde_json::json!({ "files": ["file-p1"] }),
    )
    .await;
    assert_eq!(a.library(&env).await["purge"], serde_json::json!([]));

    // Another person's deletion reclaims nothing of mine.
    let mut b = Browser::new();
    assert_eq!(b.delete(&env, "/api/photos/photos/p2").await.status, 200);
    assert_eq!(thumbs_of(&stored(&env).await, "p2"), 1);
    assert_eq!(ids(&a.library(&env).await), ["p2"]);

    // Deleting the last photo reclaims the rest.
    a.delete(&env, "/api/photos/photos/p2").await;
    let keys = stored(&env).await;
    assert!(
        keys.iter().all(|(key, _)| !key.contains("/thumb/")),
        "{keys:?}"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn the_library_as_a_whole_cannot_be_deleted() {
    let env = boot().await;
    let mut a = Browser::new();
    a.add(&env, "kept").await;
    assert_eq!(a.delete(&env, "/api/photos/library").await.status, 405);
    assert_eq!(ids(&a.library(&env).await), ["kept"]);
}

/// The person's own key prefix in the `data` store, learnt from a photo they add and delete.
async fn user_prefix(env: &TestEnv, a: &mut Browser) -> String {
    assert_eq!(a.add(env, "probe").await.status, 201);
    let keys = stored(env).await;
    let key = keys
        .iter()
        .map(|(key, _)| key)
        .find(|key| key.contains("/shard/"))
        .expect("a shard");
    let prefix = key[..key.find("/shard/").unwrap()].to_string();
    a.delete(env, "/api/photos/photos/probe").await;
    a.post(
        env,
        "/api/photos/purged",
        serde_json::json!({ "files": ["file-probe"] }),
    )
    .await;
    prefix
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_library_from_before_the_shards_moves_once_and_loses_nothing() {
    let env = boot().await;
    let mut a = Browser::new();
    let prefix = user_prefix(&env, &mut a).await;
    let record = |id: &str, file: &str, taken: u64| {
        serde_json::json!({ "id": id, "file": file, "name": id, "mime": "image/jpeg",
            "bytes": 10, "width": 4, "height": 3, "taken_ms": taken, "added_ms": 1,
            "source": "import", "favorite": true, "thumb": format!("thumb/{id}/t") })
    };
    let legacy = serde_json::json!({
        "photos": [
            record("old1", "file-old1", 5),
            record("old2", "shared", 6),
            record("old3", "shared", 7),
        ],
        "albums": [{ "id": "al", "name": "Old Album", "photos": ["old1"], "created_ms": 2 }],
        "purge": ["file-gone"],
    });
    env.store("data")
        .put(
            format!("{prefix}/library").as_bytes(),
            legacy.to_string().as_bytes(),
        )
        .await
        .unwrap();

    let library = a.library(&env).await;
    assert_eq!(ids(&library), ["old1", "old2", "old3"]);
    assert_eq!(library["photos"][0]["favorite"], true);
    assert_eq!(library["albums"][0]["photos"], serde_json::json!(["old1"]));
    assert_eq!(library["purge"], serde_json::json!(["file-gone"]));

    // A change after the move stays changed on the next read: nothing moves back.
    a.delete(&env, "/api/photos/photos/old1").await;
    let library = a.library(&env).await;
    assert_eq!(ids(&library), ["old2", "old3"]);
    assert_eq!(library["albums"][0]["photos"], serde_json::json!([]));

    // Two photos that shared an original keep it while either stays: the first to go offers
    // nothing to remove, the last offers it, once.
    let gone = a.delete(&env, "/api/photos/photos/old2").await;
    assert_eq!(json(&gone)["deleted"], true);
    assert_eq!(json(&gone)["file"], serde_json::Value::Null);
    assert_eq!(
        a.library(&env).await["purge"],
        serde_json::json!(["file-gone", "file-old1"])
    );
    let last = a.delete(&env, "/api/photos/photos/old3").await;
    assert_eq!(json(&last)["file"], "shared");
    assert_eq!(
        a.library(&env).await["purge"],
        serde_json::json!(["file-gone", "file-old1", "shared"])
    );

    // A legacy purge entry protects its file from a new photo until it is confirmed.
    let mut waiting = new_photo("new1");
    waiting["file"] = "file-gone".into();
    assert_eq!(
        a.post(&env, "/api/photos/photos", waiting).await.status,
        409
    );

    // It is confirmed like any other.
    a.post(
        &env,
        "/api/photos/purged",
        serde_json::json!({ "files": ["file-gone", "file-old1", "shared"] }),
    )
    .await;
    assert_eq!(a.library(&env).await["purge"], serde_json::json!([]));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_confirmation_cannot_free_a_live_original() {
    let env = boot().await;
    let mut a = Browser::new();
    a.add(&env, "p1").await;
    // Confirming a file a photo still names changes nothing: another photo still cannot take it.
    let confirmed = a
        .post(
            &env,
            "/api/photos/purged",
            serde_json::json!({ "files": ["file-p1"] }),
        )
        .await;
    assert_eq!(confirmed.status, 200);
    let mut twin = new_photo("p2");
    twin["file"] = "file-p1".into();
    assert_eq!(
        a.post(&env, "/api/photos/photos", twin.clone())
            .await
            .status,
        409
    );

    // Deleted and confirmed, the file is gone: no import may name it, whatever it read before. What
    // this import read is what one paused across the delete and the confirmation would have read.
    a.delete(&env, "/api/photos/photos/p1").await;
    a.post(
        &env,
        "/api/photos/purged",
        serde_json::json!({ "files": ["file-p1"] }),
    )
    .await;
    assert_eq!(a.post(&env, "/api/photos/photos", twin).await.status, 409);
    assert_eq!(ids(&a.library(&env).await), Vec::<String>::new());
}

/// The stable hash of the module, to choose ids of one shard.
fn shard_of_id(id: &str) -> u32 {
    let mut hash: u32 = 0x811c_9dc5;
    for byte in id.as_bytes() {
        hash ^= u32::from(*byte);
        hash = hash.wrapping_mul(0x0100_0193);
    }
    hash % 64
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn of_two_imports_of_one_file_at_once_exactly_one_is_kept() {
    let env = boot().await;
    let mut a = Browser::new();
    a.library(&env).await;
    for round in 0..8 {
        let first = format!("left-{round}");
        let second = (0..)
            .map(|n| format!("right-{round}-{n}"))
            .find(|id| shard_of_id(id) != shard_of_id(&first))
            .unwrap();
        let file = format!("shared-{round}");
        let (mut one, mut two) = (new_photo(&first), new_photo(&second));
        one["file"] = file.clone().into();
        two["file"] = file.clone().into();
        let (mut x, mut y) = (a.clone(), a.clone());
        let (left, right) = support::join(
            x.post(&env, "/api/photos/photos", one),
            y.post(&env, "/api/photos/photos", two),
        )
        .await;
        let mut statuses = [left.status, right.status];
        statuses.sort();
        assert_eq!(statuses, [201, 409], "round {round}");
        let library = a.library(&env).await;
        let owners = library["photos"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|photo| photo["file"] == file.as_str())
            .count();
        assert_eq!(owners, 1, "round {round}");
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_read_leaves_out_references_to_no_photo_and_writes_nothing() {
    let env = boot().await;
    let mut a = Browser::new();
    let prefix = user_prefix(&env, &mut a).await;
    a.add(&env, "p1").await;
    a.post(
        &env,
        "/api/photos/albums",
        serde_json::json!({ "id": "al", "name": "Trip" }),
    )
    .await;
    a.post(
        &env,
        "/api/photos/albums/al",
        serde_json::json!({ "add": ["p1"], "key_photo": "p1" }),
    )
    .await;
    let key = format!("{prefix}/library");
    let mut store = env.store("data");
    let stored = store.get(key.as_bytes()).await.unwrap().unwrap();
    let mut index: serde_json::Value = serde_json::from_slice(&stored).unwrap();
    index["albums"][0]["photos"] = serde_json::json!(["p1", "ghost"]);
    index["albums"][0]["key_photo"] = "ghost".into();
    store
        .put(key.as_bytes(), index.to_string().as_bytes())
        .await
        .unwrap();

    let library = a.library(&env).await;
    assert_eq!(library["albums"][0]["photos"], serde_json::json!(["p1"]));
    assert_eq!(library["albums"][0]["key_photo"], serde_json::Value::Null);
    let stored = store.get(key.as_bytes()).await.unwrap().unwrap();
    let stored: serde_json::Value = serde_json::from_slice(&stored).unwrap();
    assert_eq!(
        stored["albums"][0]["photos"],
        serde_json::json!(["p1", "ghost"]),
        "a read changes nothing it stores"
    );

    // A delete that removed nothing changes nothing either; one that removed a photo forgets it.
    let before = store.get(key.as_bytes()).await.unwrap().unwrap();
    let absent = a.delete(&env, "/api/photos/photos/absent").await;
    assert_eq!(json(&absent)["deleted"], false);
    assert_eq!(store.get(key.as_bytes()).await.unwrap().unwrap(), before);
    a.delete(&env, "/api/photos/photos/p1").await;
    let library = a.library(&env).await;
    assert_eq!(library["albums"][0]["photos"], serde_json::json!([]));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_deleted_photos_id_is_never_used_again() {
    let env = boot().await;
    let mut a = Browser::new();
    a.add(&env, "p1").await;
    a.delete(&env, "/api/photos/photos/p1").await;
    let mut again = new_photo("p1");
    again["file"] = "another-file".into();
    assert_eq!(
        a.post(&env, "/api/photos/photos", again.clone())
            .await
            .status,
        409,
        "before the original's removal is confirmed"
    );
    a.post(
        &env,
        "/api/photos/purged",
        serde_json::json!({ "files": ["file-p1"] }),
    )
    .await;
    assert_eq!(
        a.post(&env, "/api/photos/photos", again).await.status,
        409,
        "after it"
    );
    assert_eq!(ids(&a.library(&env).await), Vec::<String>::new());

    // The file it would have named was not claimed by the refusal.
    let mut other = new_photo("p2");
    other["file"] = "another-file".into();
    assert_eq!(a.post(&env, "/api/photos/photos", other).await.status, 201);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_refused_import_keeps_its_claim_on_the_file() {
    let env = boot().await;
    let mut a = Browser::new();
    a.library(&env).await;
    let same_shard: Vec<String> = (0..)
        .map(|n| format!("full-{n}"))
        .filter(|id| shard_of_id(id) == 7)
        .take(161)
        .collect();
    for id in &same_shard[..160] {
        assert_eq!(a.add(&env, id).await.status, 201);
    }
    let mut refused = new_photo(&same_shard[160]);
    refused["file"] = "contested".into();
    assert_eq!(
        a.post(&env, "/api/photos/photos", refused.clone())
            .await
            .status,
        409
    );

    // Another delivery of that photo may still hold the claim: a different photo may not take it.
    let other = (0..)
        .map(|n| format!("other-{n}"))
        .find(|id| shard_of_id(id) != 7)
        .unwrap();
    let mut rival = new_photo(&other);
    rival["file"] = "contested".into();
    assert_eq!(a.post(&env, "/api/photos/photos", rival).await.status, 409);

    // Its own retry can, once there is room.
    a.delete(&env, &format!("/api/photos/photos/{}", same_shard[0]))
        .await;
    assert_eq!(
        a.post(&env, "/api/photos/photos", refused).await.status,
        201
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_legacy_library_near_the_bound_in_one_shard_moves_whole() {
    let env = boot().await;
    let mut a = Browser::new();
    let prefix = user_prefix(&env, &mut a).await;
    let mut store = env.store("data");
    let adjust = serde_json::json!({ "exposure": 0.1, "brightness": 0.0, "contrast": 0.0,
        "highlights": 0.0, "shadows": 0.0, "saturation": 0.0, "warmth": 0.0, "tint": 0.0 });
    let wanted: Vec<String> = (0..)
        .map(|n| format!("legacy-{n}"))
        .filter(|id| shard_of_id(id) == 7)
        .take(250)
        .collect();
    let record = |id: &str| {
        serde_json::json!({ "id": id, "file": format!("file-{id}"), "name": "n".repeat(500),
            "mime": "image/jpeg", "bytes": 10, "width": 4, "height": 3, "taken_ms": 5,
            "added_ms": 1, "source": "import", "favorite": false,
            "edit": { "rotate": 0, "flip": false, "straighten": 0.0, "crop": null,
                "adjust": adjust, "filter": "none" },
            "thumb": format!("thumb/{id}/t") })
    };
    let mut photos = Vec::new();
    for id in &wanted {
        photos.push(record(id));
        if serde_json::json!({ "photos": photos }).to_string().len() > 189_000 {
            photos.pop();
            break;
        }
    }
    let count = photos.len();
    assert!(count > 100, "{count} records");
    let first = wanted[0].clone();
    store
        .put(
            format!("{prefix}/thumb/{first}/t").as_bytes(),
            b"\xff\xd8\xff\xe0",
        )
        .await
        .unwrap();
    store
        .put(
            format!("{prefix}/library").as_bytes(),
            serde_json::json!({ "photos": photos })
                .to_string()
                .as_bytes(),
        )
        .await
        .unwrap();

    let library = a.library(&env).await;
    assert_eq!(ids(&library).len(), count);
    assert!(a.thumbs(&env, &first).await[first.as_str()].is_string());
    // A person's own change to a photo still goes through.
    let favourite = a
        .post(
            &env,
            &format!("/api/photos/photos/{first}"),
            serde_json::json!({ "favorite": true }),
        )
        .await;
    assert_eq!(favourite.status, 200);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_long_purge_list_is_offered_a_reply_at_a_time() {
    let env = boot().await;
    let mut a = Browser::new();
    let prefix = user_prefix(&env, &mut a).await;
    let waiting: Vec<String> = (0..600).map(|n| format!("gone-{n:04}")).collect();
    let legacy = serde_json::json!({ "purge": waiting });
    env.store("data")
        .put(
            format!("{prefix}/library").as_bytes(),
            legacy.to_string().as_bytes(),
        )
        .await
        .unwrap();
    let first = a.library(&env).await["purge"].clone();
    assert_eq!(first.as_array().unwrap().len(), 500);
    let confirmed = a
        .post(
            &env,
            "/api/photos/purged",
            serde_json::json!({ "files": first }),
        )
        .await;
    let rest = json(&confirmed)["purge"].clone();
    assert_eq!(rest.as_array().unwrap().len(), 100);
    assert_eq!(rest[0], "gone-0500");
    a.post(
        &env,
        "/api/photos/purged",
        serde_json::json!({ "files": rest }),
    )
    .await;
    assert_eq!(a.library(&env).await["purge"], serde_json::json!([]));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_file_a_photo_names_is_never_offered_for_removal() {
    let env = boot().await;
    let mut a = Browser::new();
    let prefix = user_prefix(&env, &mut a).await;
    // The state two imports racing past the add's check would leave: two photos of one original.
    let record = |id: &str| {
        serde_json::json!({ "id": id, "file": "raced", "name": id, "mime": "image/jpeg",
            "bytes": 10, "width": 4, "height": 3, "taken_ms": 5, "added_ms": 1,
            "source": "import", "favorite": false, "thumb": format!("thumb/{id}/t") })
    };
    let legacy = serde_json::json!({ "photos": [record("one"), record("two")] });
    env.store("data")
        .put(
            format!("{prefix}/library").as_bytes(),
            legacy.to_string().as_bytes(),
        )
        .await
        .unwrap();
    a.library(&env).await;

    let first = a.delete(&env, "/api/photos/photos/one").await;
    assert_eq!(json(&first)["file"], serde_json::Value::Null);
    assert_eq!(a.library(&env).await["purge"], serde_json::json!([]));
    // A confirmation sent anyway keeps the entry for when the last photo goes.
    let confirmed = a
        .post(
            &env,
            "/api/photos/purged",
            serde_json::json!({ "files": ["raced"] }),
        )
        .await;
    assert_eq!(json(&confirmed)["purge"], serde_json::json!([]));
    let last = a.delete(&env, "/api/photos/photos/two").await;
    assert_eq!(json(&last)["file"], "raced");
    assert_eq!(a.library(&env).await["purge"], serde_json::json!(["raced"]));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn metadata_is_kept_and_has_bounds() {
    let env = boot().await;
    let mut a = Browser::new();
    a.add(&env, "p1").await;
    let changed = a
        .post(
            &env,
            "/api/photos/photos/p1",
            serde_json::json!({
                "title": " Sunset ",
                "caption": "On the pier\nat dusk",
                "keywords": ["Beach", "beach", "Family"],
                "taken_ms": 1_000,
                "location": { "lat": 52.1, "lon": 4.3, "name": "Scheveningen" },
                "hidden": true,
            }),
        )
        .await;
    assert_eq!(changed.status, 200);
    let photo = json(&changed)["photo"].clone();
    assert_eq!(photo["title"], "Sunset");
    assert_eq!(photo["caption"], "On the pier\nat dusk");
    assert_eq!(photo["keywords"], serde_json::json!(["Beach", "Family"]));
    assert_eq!(photo["taken_ms"], 1_000);
    assert_eq!(photo["location"]["name"], "Scheveningen");
    assert_eq!(photo["hidden"], true);
    assert_eq!(a.library(&env).await["photos"][0], photo);

    let more = a
        .post(
            &env,
            "/api/photos/photos/p1",
            serde_json::json!({
                "add_keywords": ["Sun"], "remove_keywords": ["family"],
                "title": "", "location": null, "hidden": false,
            }),
        )
        .await;
    let photo = json(&more)["photo"].clone();
    assert_eq!(photo["keywords"], serde_json::json!(["Beach", "Sun"]));
    assert!(photo.get("title").is_none());
    assert!(photo.get("location").is_none());
    assert!(photo.get("hidden").is_none());

    for bad in [
        serde_json::json!({ "caption": "x".repeat(2_001) }),
        serde_json::json!({ "location": { "lat": 91.0, "lon": 0.0 } }),
        serde_json::json!({ "keywords": [""] }),
    ] {
        let refused = a.post(&env, "/api/photos/photos/p1", bad).await;
        assert_eq!(refused.status, 400);
    }
}

impl Browser {
    async fn put(&mut self, env: &TestEnv, path: &str, body: serde_json::Value) -> IngressReply {
        let mut req = ingress::request("PUT", path, "", body.to_string().as_bytes());
        req.headers
            .push(("content-type".into(), "application/json".into()));
        self.send(env, req).await
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn folders_smart_albums_keywords_and_settings_are_kept() {
    let env = boot().await;
    let mut a = Browser::new();
    a.add(&env, "p1").await;
    a.add(&env, "p2").await;

    a.post(
        &env,
        "/api/photos/folders",
        serde_json::json!({ "id": "f1", "name": "Trips" }),
    )
    .await;
    a.post(
        &env,
        "/api/photos/folders",
        serde_json::json!({ "id": "f2", "name": "Europe", "parent": "f1" }),
    )
    .await;
    a.post(
        &env,
        "/api/photos/albums",
        serde_json::json!({ "id": "a1", "name": "Paris", "folder": "f2" }),
    )
    .await;
    let added = a
        .post(
            &env,
            "/api/photos/albums/a1",
            serde_json::json!({ "add": ["p1", "p2"], "key_photo": "p2" }),
        )
        .await;
    assert_eq!(json(&added)["albums"][0]["key_photo"], "p2");
    let reordered = a
        .post(
            &env,
            "/api/photos/albums/a1",
            serde_json::json!({ "order": ["p2", "p1"] }),
        )
        .await;
    assert_eq!(
        json(&reordered)["albums"][0]["photos"],
        serde_json::json!(["p2", "p1"])
    );

    // A folder cannot go inside itself.
    let refused = a
        .post(
            &env,
            "/api/photos/folders/f1",
            serde_json::json!({ "parent": "f2" }),
        )
        .await;
    assert_eq!(refused.status, 409);

    let smart = serde_json::json!({
        "name": "Starred", "any": true, "folder": "f1",
        "rules": [{ "field": "favorite", "op": "is", "value": "true" }],
    });
    let reply = a.put(&env, "/api/photos/smart-albums/s1", smart).await;
    assert_eq!(reply.status, 200);
    assert_eq!(json(&reply)["smart_albums"][0]["name"], "Starred");
    let bad = serde_json::json!({ "name": "Odd", "rules": [{ "field": "mood", "op": "is" }] });
    assert_eq!(
        a.put(&env, "/api/photos/smart-albums/s2", bad).await.status,
        400
    );

    let list = serde_json::json!({ "keywords": [{ "name": "Beach", "key": "b" }] });
    assert_eq!(a.put(&env, "/api/photos/keywords", list).await.status, 200);
    let settings = serde_json::json!({ "view": "months" });
    assert_eq!(
        a.put(&env, "/api/photos/settings", settings).await.status,
        200
    );
    let library = a.library(&env).await;
    assert_eq!(library["keywords"][0]["key"], "b");
    assert_eq!(library["settings"]["view"], "months");
    assert_eq!(library["settings_rev"], 1);
    assert_eq!(library["folders"].as_array().unwrap().len(), 2);

    // A save on the stored revision moves it on, and what it was based on isn't kept.
    let next = serde_json::json!({ "view": "days", "base": 1 });
    let reply = a.put(&env, "/api/photos/settings", next).await;
    assert_eq!(reply.status, 200);
    assert_eq!(json(&reply)["rev"], 2);
    // A held older save, based on a revision that has gone, changes nothing.
    let late = serde_json::json!({ "view": "years", "base": 1 });
    let reply = a.put(&env, "/api/photos/settings", late).await;
    assert_eq!(reply.status, 409);
    assert_eq!(json(&reply)["rev"], 2);
    let library = a.library(&env).await;
    assert_eq!(library["settings"], serde_json::json!({ "view": "days" }));
    // The page's last save, as it leaves, names no revision; one held from before it is refused.
    let leaving = serde_json::json!({ "view": "all" });
    assert_eq!(
        a.put(&env, "/api/photos/settings", leaving).await.status,
        200
    );
    let late = serde_json::json!({ "view": "days", "base": 2 });
    assert_eq!(a.put(&env, "/api/photos/settings", late).await.status, 409);
    assert_eq!(a.library(&env).await["settings"]["view"], "all");

    // Each mark changes one memory, whatever else was marked, and marking twice changes nothing.
    for change in [
        serde_json::json!({ "id": "run-1", "favorite": true }),
        serde_json::json!({ "id": "run-1", "favorite": true }),
        serde_json::json!({ "id": "run-2", "favorite": true }),
        serde_json::json!({ "id": "album-a", "album": true }),
        serde_json::json!({ "id": "run-2", "deleted": true }),
    ] {
        assert_eq!(
            a.post(&env, "/api/photos/memories", change).await.status,
            200
        );
    }
    let memories = a.library(&env).await["memories"].clone();
    assert_eq!(memories["favorites"], serde_json::json!(["run-1"]));
    assert_eq!(memories["deleted"], serde_json::json!(["run-2"]));
    assert_eq!(memories["albums"], serde_json::json!(["album-a"]));
    let bad = serde_json::json!({ "id": "" });
    assert_eq!(a.post(&env, "/api/photos/memories", bad).await.status, 400);

    // Deleting a folder takes what it holds, and leaves the photos.
    let body = json(&a.delete(&env, "/api/photos/folders/f1").await);
    assert_eq!(body["folders"], serde_json::json!([]));
    assert_eq!(body["albums"], serde_json::json!([]));
    assert_eq!(body["smart_albums"], serde_json::json!([]));
    assert_eq!(ids(&a.library(&env).await).len(), 2);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn faces_found_in_the_page_stay_with_their_photo_and_take_names() {
    let env = boot().await;
    let mut a = Browser::new();
    assert_eq!(a.add(&env, "one").await.status, 201);
    assert_eq!(a.add(&env, "two").await.status, 201);
    let face =
        |x: f64| serde_json::json!({ "x": x, "y": 0.1, "width": 0.2, "height": 0.3, "score": 0.9 });
    let photo = |library: &serde_json::Value, id: &str| {
        library["photos"]
            .as_array()
            .unwrap()
            .iter()
            .find(|p| p["id"] == id)
            .unwrap()
            .clone()
    };
    assert!(photo(&a.library(&env).await, "one").get("faces").is_none());

    // A picture looked at and showing nothing named is kept as such, so it is not looked at again.
    let read = |id: &str, scenes: serde_json::Value| serde_json::json!({ "scans": [{ "id": id, "scenes": scenes }] });
    let unknown = read("one", serde_json::json!(["Gold"]));
    assert_eq!(
        a.post(&env, "/api/photos/scenes", unknown).await.status,
        400
    );
    assert!(photo(&a.library(&env).await, "one").get("scenes").is_none());
    let shown = read("one", serde_json::json!(["Dogs", "Beach"]));
    let reply = json(&a.post(&env, "/api/photos/scenes", shown).await);
    assert_eq!(reply["kept"], serde_json::json!(["one"]));
    let nothing = read("two", serde_json::json!([]));
    assert_eq!(
        a.post(&env, "/api/photos/scenes", nothing).await.status,
        200
    );
    let missing = read("never", serde_json::json!(["Dogs"]));
    let reply = json(&a.post(&env, "/api/photos/scenes", missing).await);
    assert_eq!(reply["kept"], serde_json::json!([]));
    let library = a.library(&env).await;
    assert_eq!(
        photo(&library, "one")["scenes"],
        serde_json::json!(["Dogs", "Beach"])
    );
    assert_eq!(photo(&library, "two")["scenes"], serde_json::json!([]));

    // A box outside its picture and too many photos are refused; nothing is kept.
    let scan = |id: &str, faces: serde_json::Value| serde_json::json!({ "scans": [{ "id": id, "edited_ms": null, "faces": faces }] });
    let outside = scan("one", serde_json::json!([face(0.9)]));
    assert_eq!(a.post(&env, "/api/photos/faces", outside).await.status, 400);
    let many: Vec<_> = (0..17)
        .map(|_| serde_json::json!({ "id": "one", "faces": [] }))
        .collect();
    let body = serde_json::json!({ "scans": many });
    assert_eq!(a.post(&env, "/api/photos/faces", body).await.status, 400);
    assert!(photo(&a.library(&env).await, "one").get("faces").is_none());

    // A photo looked at and holding no face is kept as such, so it is not looked at again.
    let none = scan("two", serde_json::json!([]));
    let reply = json(&a.post(&env, "/api/photos/faces", none).await);
    assert_eq!(reply["kept"][0]["faces"], serde_json::json!([]));
    assert_eq!(
        photo(&a.library(&env).await, "two")["faces"],
        serde_json::json!([])
    );

    let two = scan("one", serde_json::json!([face(0.1), face(0.5)]));
    let reply = json(&a.post(&env, "/api/photos/faces", two).await);
    assert_eq!(reply["kept"][0]["id"], "one");
    assert_eq!(reply["kept"][0]["faces"][1]["id"], 1);

    // Naming a face puts the name on the photo's people, as Info does; a second answer changes
    // nothing of what stands, and the name is answered back to whoever sent it.
    let name = |id: u32, name: &str| serde_json::json!({ "face": { "id": id, "name": name } });
    let reply = a.post(&env, "/api/photos/photos/one", name(1, "Ann")).await;
    assert_eq!(
        reply.status,
        200,
        "{}",
        String::from_utf8_lossy(&reply.body)
    );
    let again = scan("one", serde_json::json!([face(0.3)]));
    let reply = json(&a.post(&env, "/api/photos/faces", again).await);
    assert_eq!(reply["kept"][0]["faces"][1]["name"], "Ann");
    let one = photo(&a.library(&env).await, "one");
    assert_eq!(one["faces"].as_array().unwrap().len(), 2);
    assert_eq!(one["faces"][1]["name"], "Ann");
    assert_eq!(one["people"], serde_json::json!(["Ann"]));

    // A second face with the name, in another case, leaves one person; taking one off keeps them
    // while the other holds the name, and taking the last off takes them off the photo.
    a.post(&env, "/api/photos/photos/one", name(0, "ann")).await;
    assert_eq!(
        photo(&a.library(&env).await, "one")["people"],
        serde_json::json!(["Ann"])
    );
    let clear = |id: u32| serde_json::json!({ "face": { "id": id, "name": null } });
    a.post(&env, "/api/photos/photos/one", clear(1)).await;
    assert_eq!(
        photo(&a.library(&env).await, "one")["people"],
        serde_json::json!(["Ann"])
    );
    a.post(&env, "/api/photos/photos/one", clear(0)).await;
    assert!(photo(&a.library(&env).await, "one").get("people").is_none());

    // Info taking the name off takes it off the face.
    a.post(&env, "/api/photos/photos/one", name(0, "Bo")).await;
    let off = serde_json::json!({ "remove_people": ["bo"] });
    a.post(&env, "/api/photos/photos/one", off).await;
    assert!(photo(&a.library(&env).await, "one")["faces"][0]
        .get("name")
        .is_none());

    // No such face is refused; Not a Face drops the name and stays.
    let reply = a.post(&env, "/api/photos/photos/one", name(9, "Cy")).await;
    assert_eq!(reply.status, 400);
    a.post(&env, "/api/photos/photos/one", name(0, "Cy")).await;
    let not = serde_json::json!({ "face": { "id": 0, "not_a_face": true } });
    a.post(&env, "/api/photos/photos/one", not).await;
    let one = photo(&a.library(&env).await, "one");
    assert_eq!(one["faces"][0]["not_a_face"], true);
    assert!(one["faces"][0].get("name").is_none());
    assert!(one.get("people").is_none());

    // An edit of colour keeps the boxes; one that changes the frame clears them, the people stay.
    a.post(&env, "/api/photos/photos/one", name(1, "Di")).await;
    let warm = serde_json::json!({ "edit": { "filter": "vivid" }, "thumb": THUMB_B64 });
    let reply = a.post(&env, "/api/photos/photos/one", warm).await;
    assert_eq!(
        reply.status,
        200,
        "{}",
        String::from_utf8_lossy(&reply.body)
    );
    let one = photo(&a.library(&env).await, "one");
    assert_eq!(one["faces"][1]["name"], "Di");
    let stale = scan("one", serde_json::json!([face(0.3)]));
    assert_eq!(
        json(&a.post(&env, "/api/photos/faces", stale).await)["kept"],
        serde_json::json!([]),
        "a scan of the thumbnail before the edit is not taken"
    );
    let turned =
        serde_json::json!({ "edit": { "rotate": 1, "filter": "vivid" }, "thumb": THUMB_B64 });
    a.post(&env, "/api/photos/photos/one", turned).await;
    let one = photo(&a.library(&env).await, "one");
    assert!(one.get("faces").is_none());
    assert_eq!(one["people"], serde_json::json!(["Di"]));

    // Looked at again: the one face takes the one name; with two faces neither is guessed at.
    let body = serde_json::json!({ "scans": [{
        "id": "one", "edited_ms": one["edited_ms"], "faces": [face(0.2)]
    }] });
    let reply = json(&a.post(&env, "/api/photos/faces", body).await);
    assert_eq!(reply["kept"][0]["faces"][0]["name"], "Di");

    // Another person's library holds none of it.
    let mut b = Browser::new();
    assert_eq!(ids(&b.library(&env).await).len(), 0);
    let theirs = scan("one", serde_json::json!([face(0.1)]));
    assert_eq!(
        json(&b.post(&env, "/api/photos/faces", theirs).await)["kept"],
        serde_json::json!([])
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_library_past_the_old_limit_is_kept_whole() {
    let env = boot().await;
    let mut a = Browser::new();
    for n in 0..300 {
        assert_eq!(a.add(&env, &format!("photo-{n}")).await.status, 201, "{n}");
    }
    let mut seen = a.library(&env).await;
    let mut all = ids(&seen);
    while let Some(next) = seen["next"].as_u64() {
        let path = format!("/api/photos/library?from={next}");
        seen = json(&a.send(&env, ingress::get(&path)).await);
        all.extend(ids(&seen));
    }
    assert_eq!(all.len(), 300);
}

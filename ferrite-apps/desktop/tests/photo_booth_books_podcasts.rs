//! Network fixtures: shared tests omit outbound bindings; `local-egress`
//! repeats them with Forge's deny-all policy. See tests/README.md.
//!
//! Photo Booth, Books and Podcasts on the in-process Forge planes
//! (`ferrite-app-test`): Photo Booth keeps each session's JPEG pictures,
//! refusing other bodies, unknown effects and pictures past its limits, and
//! answers a resend of a photo with the one stored; Books and Podcasts keep
//! each session's library under the revision rule of `document.rs`; Books
//! keeps each person's books and reading of each book, at most one slot per
//! book, forgets them all at once, and serves a book's text kept in the
//! shared space in parts, each from the generation its index names; Podcasts
//! reads only feeds on the hosts it lists, says why for any other, and
//! answers an egress refusal without caching anything.

use crate::support;

use crate::egress_profile;

use ferrite_app::{serde_json, IngressReply, IngressRequest};
use ferrite_app_test::{ingress, TestEnv, TestHarness};

async fn boot() -> crate::support::Env {
    boot_in(crate::support::Slot::acquire()).await
}

/// Boots in `slot`: a test's second environment, beside its first, takes
/// [`crate::support::Slot::beside`].
async fn boot_in(slot: crate::support::Slot) -> crate::support::Env {
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

    async fn put_json(
        &mut self,
        env: &TestEnv,
        path: &str,
        body: serde_json::Value,
    ) -> IngressReply {
        let mut req = ingress::request("PUT", path, "", body.to_string().as_bytes());
        req.headers
            .push(("content-type".into(), "application/json".into()));
        self.send(env, req).await
    }

    async fn put_photo(&mut self, env: &TestEnv, path: &str, body: &[u8]) -> IngressReply {
        let mut req = ingress::request("PUT", path, "", body);
        req.headers
            .push(("content-type".into(), "image/jpeg".into()));
        self.send(env, req).await
    }

    async fn delete(&mut self, env: &TestEnv, path: &str) -> IngressReply {
        self.send(env, ingress::request("DELETE", path, "", b""))
            .await
    }
}

/// A body that starts as a JPEG does, `len` bytes long.
fn jpeg(len: usize, fill: u8) -> Vec<u8> {
    let mut bytes = vec![0xFF, 0xD8, 0xFF, 0xE0];
    bytes.resize(len, fill);
    bytes
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn photo_booth_keeps_each_session_s_pictures() {
    let env = boot().await;
    let (mut a, mut b) = (Browser::new(), Browser::new());
    const LIST: &str = "/api/photo-booth/photos";
    let empty = a.get(&env, LIST).await;
    assert_eq!(empty["photos"], serde_json::json!([]));
    assert_eq!(empty["limits"]["photos"], 50);

    let picture = jpeg(2_000, 7);
    let first = a
        .put_photo(&env, "/api/photo-booth/photos/p-1?effect=sepia", &picture)
        .await;
    assert_eq!(
        first.status,
        201,
        "{}",
        String::from_utf8_lossy(&first.body)
    );
    let stored = json(&first)["photo"].clone();
    assert_eq!(stored["id"], "p-1");
    assert_eq!(stored["effect"], "sepia");
    assert_eq!(stored["bytes"], 2_000);

    // The same photo sent again (its reply was lost): the one stored, unchanged.
    let again = a
        .put_photo(
            &env,
            "/api/photo-booth/photos/p-1?effect=x-ray",
            &jpeg(900, 1),
        )
        .await;
    assert_eq!(again.status, 200);
    assert_eq!(json(&again)["photo"], stored);

    let image = a
        .send(&env, ingress::get("/api/photo-booth/photos/p-1"))
        .await;
    assert_eq!(image.status, 200);
    assert_eq!(image.body, picture, "the bytes come back as they were sent");
    assert!(image
        .headers
        .iter()
        .any(|(n, v)| n.eq_ignore_ascii_case("content-type") && v == "image/jpeg"));

    let listed = a.get(&env, LIST).await;
    assert_eq!(listed["photos"], serde_json::json!([stored]));
    // Another browser sees none of it, and cannot read the picture.
    assert_eq!(b.get(&env, LIST).await["photos"], serde_json::json!([]));
    let stranger = b
        .send(&env, ingress::get("/api/photo-booth/photos/p-1"))
        .await;
    assert_eq!(stranger.status, 404);

    for (path, body, status) in [
        (
            "/api/photo-booth/photos/p-2?effect=sepia",
            b"\x89PNG\r\n\x1a\n".to_vec(),
            400,
        ),
        (
            "/api/photo-booth/photos/p-2?effect=sparkle",
            jpeg(100, 0),
            400,
        ),
        (
            "/api/photo-booth/photos/p-2?effect=sepia",
            jpeg(240_001, 0),
            413,
        ),
        (
            "/api/photo-booth/photos/a%2Fb?effect=sepia",
            jpeg(100, 0),
            400,
        ),
    ] {
        let reply = a.put_photo(&env, path, &body).await;
        assert_eq!(
            reply.status,
            status,
            "{path}: {}",
            String::from_utf8_lossy(&reply.body)
        );
    }
    assert_eq!(
        a.get(&env, LIST).await["photos"].as_array().unwrap().len(),
        1
    );

    let gone = a.delete(&env, "/api/photo-booth/photos/p-1").await;
    assert_eq!(json(&gone)["deleted"], true);
    assert_eq!(a.get(&env, LIST).await["photos"], serde_json::json!([]));
    let missing = a
        .send(&env, ingress::get("/api/photo-booth/photos/p-1"))
        .await;
    assert_eq!(missing.status, 404);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn photo_booth_holds_its_limit_and_one_photo_per_id_under_concurrent_uploads() {
    let env = boot().await;
    let mut a = Browser::new();
    const LIST: &str = "/api/photo-booth/photos";
    a.get(&env, LIST).await;
    for n in 0..48 {
        let path = format!("{LIST}/p-{n}");
        assert_eq!(a.put_photo(&env, &path, &jpeg(64, 1)).await.status, 201);
    }
    // Four photos at once with room for two: two are kept, two refused.
    let (mut w, mut x, mut y, mut z) = (a.clone(), a.clone(), a.clone(), a.clone());
    let body = jpeg(64, 2);
    let replies = support::join4(
        w.put_photo(&env, "/api/photo-booth/photos/q-1", &body),
        x.put_photo(&env, "/api/photo-booth/photos/q-2", &body),
        y.put_photo(&env, "/api/photo-booth/photos/q-3", &body),
        z.put_photo(&env, "/api/photo-booth/photos/q-4", &body),
    )
    .await;
    let mut statuses = [
        replies.0.status,
        replies.1.status,
        replies.2.status,
        replies.3.status,
    ];
    statuses.sort();
    assert_eq!(statuses, [201, 201, 409, 409]);
    assert_eq!(
        a.get(&env, LIST).await["photos"].as_array().unwrap().len(),
        50
    );

    // Two deliveries of one id with other bytes and effects, at once: one is
    // kept, and its image is the bytes of the effect the list names.
    assert_eq!(a.delete(&env, LIST).await.status, 200);
    let (sepia, xray) = (jpeg(80, 3), jpeg(90, 4));
    let (mut s, mut r) = (a.clone(), a.clone());
    let (first, second) = support::join(
        s.put_photo(&env, "/api/photo-booth/photos/same?effect=sepia", &sepia),
        r.put_photo(&env, "/api/photo-booth/photos/same?effect=x-ray", &xray),
    )
    .await;
    let mut statuses = [first.status, second.status];
    statuses.sort();
    assert_eq!(statuses, [200, 201]);
    let listed = a.get(&env, LIST).await;
    let photos = listed["photos"].as_array().unwrap();
    assert_eq!(photos.len(), 1);
    let expected = if photos[0]["effect"] == "sepia" {
        &sepia
    } else {
        &xray
    };
    assert_eq!(photos[0]["bytes"], expected.len());
    let image = a
        .send(&env, ingress::get("/api/photo-booth/photos/same"))
        .await;
    assert_eq!(image.status, 200);
    assert_eq!(&image.body, expected);

    // Deleting while the same id is stored again leaves no listed photo
    // without its image.
    let (mut d, mut p) = (a.clone(), a.clone());
    let again = jpeg(70, 5);
    let _ = support::join(
        d.delete(&env, "/api/photo-booth/photos/same"),
        p.put_photo(&env, "/api/photo-booth/photos/same?effect=glow", &again),
    )
    .await;
    for photo in a.get(&env, LIST).await["photos"].as_array().unwrap() {
        let id = photo["id"].as_str().unwrap();
        let image = a.send(&env, ingress::get(&format!("{LIST}/{id}"))).await;
        assert_eq!(image.status, 200, "{id} is listed without its image");
        assert_eq!(photo["bytes"], image.body.len());
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn photo_booth_stops_at_fifty_and_forgets_them_all() {
    let env = boot().await;
    let mut a = Browser::new();
    for n in 0..50 {
        let reply = a
            .put_photo(
                &env,
                &format!("/api/photo-booth/photos/p-{n}"),
                &jpeg(64, n as u8),
            )
            .await;
        assert_eq!(reply.status, 201, "photo {n}");
    }
    let full = a
        .put_photo(&env, "/api/photo-booth/photos/p-50", &jpeg(64, 0))
        .await;
    assert_eq!(full.status, 409);
    let listed = a.get(&env, "/api/photo-booth/photos").await;
    assert_eq!(listed["photos"].as_array().unwrap().len(), 50);
    assert_eq!(
        listed["photos"][0]["effect"], "normal",
        "a photo sent without an effect has none"
    );

    let cleared = a.delete(&env, "/api/photo-booth/photos").await;
    assert_eq!(json(&cleared)["deleted"], 50);
    assert_eq!(
        a.get(&env, "/api/photo-booth/photos").await["photos"],
        serde_json::json!([])
    );
    let usage = a.get(&env, "/api/storage-management/usage").await;
    let photo_booth = usage["apps"]
        .as_array()
        .unwrap()
        .iter()
        .find(|app| app["name"] == "photo-booth")
        .unwrap();
    // What is left is the index, an empty list, kept so that its version
    // never starts again: no picture's bytes.
    assert_eq!(photo_booth["keys"], 1, "no picture's bytes are left behind");
    assert!(photo_booth["bytes"].as_u64().unwrap() < 16);
}

fn books_library() -> serde_json::Value {
    serde_json::json!({
        "collections": [{ "id": "collection-1", "name": "Untitled Collection", "books": [] }],
        "pages": { "aqua-and-bondi": 2 },
        "marks": { "aqua-and-bondi": [2] },
        "sort": "title"
    })
}

fn podcasts_library() -> serde_json::Value {
    serde_json::json!({
        "subscribed": ["signal-path"],
        "played": [],
        "positions": { "signal-path-12": 30 },
        "settings": {
            "refresh": "Every Day", "download": "All Unplayed", "skipForward": 30,
            "skipBack": 15, "continuous": false, "sync": true
        }
    })
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn books_and_podcasts_keep_each_session_s_library() {
    let env = boot().await;
    for (url, library, bad) in [
        (
            "/api/books/library",
            books_library(),
            serde_json::json!({ "collections": [], "pages": { "aqua-and-bondi": 0 }, "marks": {}, "sort": "title" }),
        ),
        ("/api/podcasts/library", podcasts_library(), {
            let mut wrong = podcasts_library();
            wrong["settings"]["skipBack"] = 20.into();
            wrong
        }),
    ] {
        let mut expected = library.clone();
        if url == "/api/podcasts/library" {
            expected["current"] = serde_json::Value::Null;
            expected["queue"] = serde_json::json!([]);
            expected["shows"] = serde_json::json!([]);
            expected["speed"] = serde_json::json!(1.0);
        }
        let (mut a, mut b) = (Browser::new(), Browser::new());
        assert_eq!(
            a.get(&env, url).await,
            serde_json::json!({ "library": null, "rev": 0 }),
            "{url}"
        );
        let put = a
            .put_json(
                &env,
                url,
                serde_json::json!({ "library": library, "rev": 0 }),
            )
            .await;
        assert_eq!(
            put.status,
            200,
            "{url}: {}",
            String::from_utf8_lossy(&put.body)
        );
        assert_eq!(
            a.get(&env, url).await,
            serde_json::json!({ "library": expected, "rev": 1 })
        );
        assert_eq!(b.get(&env, url).await["library"], serde_json::Value::Null);

        let stale = a
            .put_json(
                &env,
                url,
                serde_json::json!({ "library": library, "rev": 0 }),
            )
            .await;
        assert_eq!(stale.status, 409, "{url}");
        assert_eq!(json(&stale)["library"], expected);

        let refused = a
            .put_json(&env, url, serde_json::json!({ "library": bad, "rev": 1 }))
            .await;
        assert_eq!(refused.status, 400, "{url}");

        let forgot = a.delete(&env, url).await;
        assert_eq!(forgot.status, 200);
        assert_eq!(
            a.get(&env, url).await,
            serde_json::json!({ "library": null, "rev": 2 })
        );
    }
}

/// The desktop with Books' egress handle bound. The harness's egress is
/// deny-all, so no request reaches Project Gutenberg or Standard Ebooks here:
/// these tests hold what is refused before any request, how a refused one is
/// answered, and that a book kept in the shared space is served without its
/// source. Real books are read by `e2e/books-journey.mjs` under
/// `ferrite dev --egress allow`.
async fn boot_for_books_requests() -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let harness = TestHarness::new()
        .with_queue("requests")
        .with_queue("replies")
        .with_queue("live")
        .with_queue("frames")
        .with_store("data");
    #[cfg(feature = "local-egress")]
    let harness = harness.with_egress("books");
    let env = harness.build().await;
    env.run_app(|ctx| async move { macalicious_desktop::run(ctx).await });
    crate::support::Env::new(env, slot)
}

/// A book got from the Book Store, as the library keeps it.
fn owned_book() -> serde_json::Value {
    serde_json::json!({
        "id": "pg-2701",
        "title": "Moby Dick; Or, The Whale",
        "author": "Herman Melville",
        "source": "gutenberg",
        "added": 1_760_000_000_000u64,
        "cover": "https://www.gutenberg.org/cache/epub/2701/pg2701.cover.medium.jpg"
    })
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn books_keeps_a_library_kept_over_its_size_limit_editable() {
    let env = boot().await;
    let mut a = Browser::new();
    const LIBRARY: &str = "/api/books/library";
    // Books with the longest titles and authors: 300 of them take about 204 KB, more than the
    // 200,000-byte limit, which came after such a library could be kept.
    let book = |n: u64| {
        serde_json::json!({
            "id": format!("pg-{}", n + 1),
            "title": "T".repeat(300),
            "author": "A".repeat(300),
            "source": "gutenberg",
            "added": 1_760_000_000_000u64 + n,
        })
    };
    let with = |count: u64| {
        let mut library = books_library();
        library["books"] = (0..count).map(book).collect();
        library
    };
    let new = a
        .put_json(
            &env,
            LIBRARY,
            serde_json::json!({ "library": with(300), "rev": 0 }),
        )
        .await;
    assert_eq!(new.status, 400, "a new library over the limit");
    let small = a
        .put_json(
            &env,
            LIBRARY,
            serde_json::json!({ "library": with(1), "rev": 0 }),
        )
        .await;
    assert_eq!(
        small.status,
        200,
        "{}",
        String::from_utf8_lossy(&small.body)
    );

    // The library as it was kept before the limit.
    let mut store = env.store("data");
    let (rows, _) = store
        .scan_prefix(b"apps/books/users/", None, 64)
        .await
        .unwrap();
    let key = rows
        .iter()
        .map(|(key, _, _)| key.clone())
        .find(|key| key.ends_with(b"/library"))
        .expect("the library is kept in the person's space");
    let old = serde_json::json!({ "rev": 5, "doc": with(300) });
    store.put(&key, old.to_string().as_bytes()).await.unwrap();

    // It can still be saved as it shrinks, though it is still over the limit.
    let smaller = a
        .put_json(
            &env,
            LIBRARY,
            serde_json::json!({ "library": with(299), "rev": 5 }),
        )
        .await;
    assert_eq!(
        smaller.status,
        200,
        "{}",
        String::from_utf8_lossy(&smaller.body)
    );
    assert_eq!(
        a.get(&env, LIBRARY).await["library"]["books"]
            .as_array()
            .map(Vec::len),
        Some(299)
    );
    // It may not grow.
    let grown = a
        .put_json(
            &env,
            LIBRARY,
            serde_json::json!({ "library": with(300), "rev": 6 }),
        )
        .await;
    assert_eq!(
        grown.status,
        400,
        "{}",
        String::from_utf8_lossy(&grown.body)
    );
}

/// The slot keys of a person's readings, with what each holds, from the store itself.
async fn reading_slots(env: &TestEnv) -> Vec<(String, serde_json::Value)> {
    let mut store = env.store("data");
    let (rows, _) = store
        .scan_prefix(b"apps/books/users/", None, 600)
        .await
        .unwrap();
    rows.iter()
        .filter_map(|(key, value, _)| {
            let key = String::from_utf8_lossy(key).into_owned();
            key.contains("/reading/")
                .then(|| (key, serde_json::from_slice(value).unwrap()))
        })
        .collect()
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn books_keeps_each_person_s_books_and_reading() {
    let env = boot().await;
    let (mut a, mut b) = (Browser::new(), Browser::new());
    const LIBRARY: &str = "/api/books/library";
    const READING: &str = "/api/books/reading/pg-2701";

    let mut library = books_library();
    library["books"] = serde_json::json!([owned_book()]);
    let put = a
        .put_json(
            &env,
            LIBRARY,
            serde_json::json!({ "library": library, "rev": 0 }),
        )
        .await;
    assert_eq!(put.status, 200, "{}", String::from_utf8_lossy(&put.body));
    assert_eq!(a.get(&env, LIBRARY).await["library"], library);
    assert_eq!(
        b.get(&env, LIBRARY).await["library"],
        serde_json::Value::Null
    );

    let refused = |change: &dyn Fn(&mut serde_json::Value)| {
        let mut bad = library.clone();
        change(&mut bad);
        serde_json::json!({ "library": bad, "rev": 1 })
    };
    for (what, body) in [
        (
            "one book twice",
            refused(&|l| l["books"] = serde_json::json!([owned_book(), owned_book()])),
        ),
        (
            "a book no source has",
            refused(&|l| l["books"][0]["id"] = "aqua-and-bondi".into()),
        ),
        (
            "a cover from elsewhere",
            refused(&|l| l["books"][0]["cover"] = "https://example.com/x.jpg".into()),
        ),
        (
            "an id of another source",
            refused(&|l| l["books"][0]["source"] = "standard-ebooks".into()),
        ),
        (
            "an EPUB, which this desktop does not open",
            refused(&|l| {
                l["books"][0]["id"] = "epub-0123456789abcdef0123456789abcdef".into();
                l["books"][0]["source"] = "epub".into();
            }),
        ),
        (
            "a field the library does not have",
            refused(&|l| l["books"][0]["file"] = "moby.epub".into()),
        ),
    ] {
        let reply = a.put_json(&env, LIBRARY, body).await;
        assert_eq!(
            reply.status,
            400,
            "{what}: {}",
            String::from_utf8_lossy(&reply.body)
        );
    }

    let reading = serde_json::json!({
        "place": 27982,
        "bookmarks": [{ "at": 27982, "label": "CHAPTER 1. Loomings." }],
        "highlights": [{
            "id": "h-1", "start": 28004, "end": 28020, "color": "yellow",
            "text": "Call me Ishmael.", "note": "The first line."
        }]
    });
    assert_eq!(
        a.get(&env, READING).await,
        serde_json::json!({ "reading": null, "rev": 0 })
    );
    // Forgetting a reading that is not kept stores nothing.
    assert_eq!(a.delete(&env, "/api/books/reading/pg-84").await.status, 200);
    assert!(reading_slots(&env).await.is_empty());
    let saved = a
        .put_json(
            &env,
            READING,
            serde_json::json!({ "reading": reading, "rev": 0 }),
        )
        .await;
    assert_eq!(
        saved.status,
        200,
        "{}",
        String::from_utf8_lossy(&saved.body)
    );
    assert_eq!(
        a.get(&env, READING).await,
        serde_json::json!({ "reading": reading, "rev": 1 })
    );
    // Another person has no place, bookmark or note in the book.
    assert_eq!(
        b.get(&env, READING).await["reading"],
        serde_json::Value::Null
    );
    let stale = a
        .put_json(
            &env,
            READING,
            serde_json::json!({ "reading": { "place": 1 }, "rev": 0 }),
        )
        .await;
    assert_eq!(stale.status, 409);
    assert_eq!(json(&stale)["reading"], reading);
    for bad in [
        serde_json::json!({ "place": 1, "highlights": [{ "id": "h", "start": 5, "end": 5, "color": "yellow", "text": "" }] }),
        serde_json::json!({ "place": 1, "highlights": [{ "id": "h", "start": 5, "end": 9, "color": "orange", "text": "" }] }),
        serde_json::json!({ "place": 1, "bookmarks": [{ "at": 9, "label": "" }, { "at": 2, "label": "" }] }),
        serde_json::json!({ "place": 1, "theme": "sepia" }),
    ] {
        let reply = a
            .put_json(
                &env,
                READING,
                serde_json::json!({ "reading": bad, "rev": 1 }),
            )
            .await;
        assert_eq!(reply.status, 400, "{bad}");
    }
    let unknown = a
        .send(&env, ingress::get("/api/books/reading/aqua-and-bondi"))
        .await;
    assert_eq!(
        unknown.status, 404,
        "only a book Books can read has a reading"
    );

    // Two more books get a reading; one is deleted again, which keeps its slot.
    for book in ["pg-11", "se.jane-austen.emma"] {
        let made = a
            .put_json(
                &env,
                &format!("/api/books/reading/{book}"),
                serde_json::json!({ "reading": { "place": 5 }, "rev": 0 }),
            )
            .await;
        assert_eq!(made.status, 200, "{}", String::from_utf8_lossy(&made.body));
    }
    assert_eq!(a.delete(&env, "/api/books/reading/pg-11").await.status, 200);
    let slots = reading_slots(&env).await;
    assert_eq!(slots.len(), 3, "one slot per book: {slots:?}");
    let space = slots[0].0.rsplit_once("reading/").unwrap().0.to_string();

    // Forgetting the library (Storage Management's Delete) forgets every book's reading too,
    // and empties every slot in the store, not only in what the routes answer.
    assert_eq!(a.delete(&env, LIBRARY).await.status, 200);
    for book in ["pg-2701", "pg-11", "se.jane-austen.emma"] {
        assert_eq!(
            a.get(&env, &format!("/api/books/reading/{book}")).await["reading"],
            serde_json::Value::Null,
            "{book} is forgotten"
        );
    }
    for (key, kept) in reading_slots(&env).await {
        assert_eq!(kept["doc"], serde_json::Value::Null, "{key} is emptied");
        assert_eq!(kept["generation"], 1, "{key}");
    }
    assert_eq!(
        a.get(&env, LIBRARY).await["library"],
        serde_json::Value::Null
    );

    // No revision goes back: the forgotten reading is none, under a revision higher than any
    // a page held before, and a page that still holds revision 1 is refused.
    const AFTER: u64 = 1 << 32;
    assert_eq!(
        a.get(&env, READING).await,
        serde_json::json!({ "reading": null, "rev": AFTER })
    );
    let late = a
        .put_json(
            &env,
            READING,
            serde_json::json!({ "reading": { "place": 1 }, "rev": 1 }),
        )
        .await;
    assert_eq!(late.status, 409);
    // The reading made again climbs past revision 1; the page left open since before the
    // forget still cannot write over it.
    for n in 0..2u64 {
        let made = a
            .put_json(
                &env,
                READING,
                serde_json::json!({ "reading": { "place": 100 + n }, "rev": AFTER + n }),
            )
            .await;
        assert_eq!(made.status, 200, "{}", String::from_utf8_lossy(&made.body));
    }
    let stale = a
        .put_json(
            &env,
            READING,
            serde_json::json!({ "reading": { "place": 1 }, "rev": 1 }),
        )
        .await;
    assert_eq!(stale.status, 409);
    assert_eq!(json(&stale)["reading"]["place"], 101);
    assert_eq!(json(&stale)["rev"], AFTER + 2);
    // After the forget the book took the first slot again: a forget leaves no slot behind.
    let mut store = env.store("data");
    let first = format!("{space}reading/0");
    let kept: serde_json::Value =
        serde_json::from_slice(&store.get(first.as_bytes()).await.unwrap().unwrap()).unwrap();
    assert_eq!(kept["book"], "pg-2701");

    // A writer that read the record before a forget raised it never replaces a reading saved
    // in the newer generation: a slot of a later generation than the record sends it back to
    // read the record, here until it gives up.
    let kept_newer = br#"{"generation":9,"book":"pg-2701","rev":1,"doc":{"place":3}}"#;
    store.put(first.as_bytes(), kept_newer).await.unwrap();
    let refused = a
        .put_json(
            &env,
            READING,
            serde_json::json!({ "reading": { "place": 4 }, "rev": AFTER + 2 }),
        )
        .await;
    assert_eq!(refused.status, 503);
    assert_eq!(
        store.get(first.as_bytes()).await.unwrap().as_deref(),
        Some(&kept_newer[..])
    );

    // A slot holding an earlier generation's document, as a write that lost to a forget would
    // leave it, or another book's, reads as none, and the next write replaces it.
    for planted in [
        br#"{"generation":0,"book":"pg-2701","rev":5,"doc":{"place":7}}"#.as_slice(),
        br#"{"generation":1,"book":"pg-84","rev":5,"doc":{"place":7}}"#.as_slice(),
    ] {
        store.put(first.as_bytes(), planted).await.unwrap();
        assert_eq!(
            a.get(&env, READING).await,
            serde_json::json!({ "reading": null, "rev": AFTER })
        );
        let replaced = a
            .put_json(
                &env,
                READING,
                serde_json::json!({ "reading": { "place": 9 }, "rev": AFTER }),
            )
            .await;
        assert_eq!(
            replaced.status,
            200,
            "{}",
            String::from_utf8_lossy(&replaced.body)
        );
        assert_eq!(json(&replaced)["rev"], AFTER + 1);
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn books_keeps_readings_for_at_most_as_many_books_as_a_library_holds() {
    let env = boot().await;
    let mut a = Browser::new();
    let put = |book: &str| {
        (
            format!("/api/books/reading/{book}"),
            serde_json::json!({ "reading": { "place": 1 }, "rev": 0 }),
        )
    };
    let (first, body) = put("pg-1");
    assert_eq!(a.put_json(&env, &first, body).await.status, 200);
    let slots = reading_slots(&env).await;
    let space = slots[0].0.rsplit_once("reading/").unwrap().0.to_string();

    // The record as it stands once 500 books have a reading.
    let books: Vec<String> = (1..=500).map(|n| format!("pg-{n}")).collect();
    let record = serde_json::json!({ "generation": 0, "books": books, "dirty": 0 });
    let mut store = env.store("data");
    store
        .put(
            format!("{space}readings").as_bytes(),
            record.to_string().as_bytes(),
        )
        .await
        .unwrap();

    // A 501st book is refused, whatever its id, and takes no key.
    let (path, body) = put("pg-501");
    let refused = a.put_json(&env, &path, body).await;
    assert_eq!(
        refused.status,
        400,
        "{}",
        String::from_utf8_lossy(&refused.body)
    );
    assert!(String::from_utf8_lossy(&refused.body).contains("at most 500 books"));
    assert_eq!(reading_slots(&env).await.len(), 1);
    // A book that has one keeps it.
    let (path, _) = put("pg-1");
    let kept = a
        .put_json(
            &env,
            &path,
            serde_json::json!({ "reading": { "place": 2 }, "rev": 1 }),
        )
        .await;
    assert_eq!(kept.status, 200, "{}", String::from_utf8_lossy(&kept.body));
    // Forgetting the library makes room again.
    assert_eq!(a.delete(&env, "/api/books/library").await.status, 200);
    let (path, _) = put("pg-501");
    let made = a
        .put_json(
            &env,
            &path,
            serde_json::json!({ "reading": { "place": 1 }, "rev": 1u64 << 32 }),
        )
        .await;
    assert_eq!(made.status, 200, "{}", String::from_utf8_lossy(&made.body));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn books_finishes_a_forget_that_stopped_before_its_slots_were_emptied() {
    let env = boot().await;
    let mut a = Browser::new();
    let made = a
        .put_json(
            &env,
            "/api/books/reading/pg-1",
            serde_json::json!({ "reading": { "place": 1 }, "rev": 0 }),
        )
        .await;
    assert_eq!(made.status, 200);
    let slots = reading_slots(&env).await;
    let space = slots[0].0.rsplit_once("reading/").unwrap().0.to_string();

    // As a forget that ran out of time leaves it: the generation raised, the list empty, and
    // three slots below `dirty` still holding the notes of the generation before.
    let mut store = env.store("data");
    for slot in 0..3 {
        let doc = format!(
            r#"{{"generation":0,"book":"pg-{}","rev":1,"doc":{{"place":5,"highlights":[{{"id":"h","start":1,"end":2,"color":"blue","text":"x","note":"left behind"}}]}}}}"#,
            slot + 1
        );
        store
            .put(format!("{space}reading/{slot}").as_bytes(), doc.as_bytes())
            .await
            .unwrap();
    }
    let record = serde_json::json!({ "generation": 1, "books": [], "dirty": 3 });
    store
        .put(
            format!("{space}readings").as_bytes(),
            record.to_string().as_bytes(),
        )
        .await
        .unwrap();

    // The next forget empties them, and says none is left to empty.
    assert_eq!(a.delete(&env, "/api/books/library").await.status, 200);
    for (key, kept) in reading_slots(&env).await {
        assert_eq!(kept["doc"], serde_json::Value::Null, "{key} is emptied");
    }
    let kept: serde_json::Value = serde_json::from_slice(
        &store
            .get(format!("{space}readings").as_bytes())
            .await
            .unwrap()
            .unwrap(),
    )
    .unwrap();
    assert_eq!(kept["generation"], 2);
    assert_eq!(kept["dirty"], 0);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn books_serves_a_kept_text_in_parts_and_says_why_it_cannot_fetch_one() {
    let env = boot_for_books_requests().await;
    let mut a = Browser::new();

    // Nothing kept yet: the store and an unkept book ask their source, which the harness refuses.
    for path in [
        "/api/books/store",
        "/api/books/store?shelf=standard-ebooks",
        "/api/books/store?q=moby%20dick&source=gutenberg&page=2",
        "/api/books/store?q=austen&source=standard-ebooks",
        "/api/books/text/pg-2701",
        "/api/books/text/se.jane-austen.emma/0",
    ] {
        let reply = a.send(&env, ingress::get(path)).await;
        assert_eq!(
            reply.status,
            egress_profile::FAILURE_STATUS,
            "{path}: {}",
            String::from_utf8_lossy(&reply.body)
        );
        assert!(
            json(&reply)["error"].as_str().unwrap().contains("egress"),
            "{path}"
        );
    }
    // Refused before any request.
    for (path, expected) in [
        ("/api/books/store?q=", 400),
        ("/api/books/store?q=%FF", 400),
        ("/api/books/store?shelf=bestsellers", 400),
        ("/api/books/store?q=moby&source=amazon", 400),
        ("/api/books/store?page=0", 400),
        ("/api/books/store?q=emma&source=standard-ebooks&page=2", 400),
        ("/api/books/text/aqua-and-bondi", 404),
        ("/api/books/text/epub-0123456789abcdef0123456789abcdef", 404),
        ("/api/books/text/pg-0", 404),
        ("/api/books/text/pg-11/first", 404),
        ("/api/books/elsewhere", 404),
    ] {
        let reply = a.send(&env, ingress::get(path)).await;
        assert_eq!(reply.status, expected, "{path}");
    }
    let post = a
        .send(&env, ingress::request("POST", "/api/books/store", "", b""))
        .await;
    assert_eq!(post.status, 405);

    // A book kept in the shared space is served from it, to anyone, without its source, each
    // part from the generation its index names, never from a key another round wrote.
    let parts = [
        "CHAPTER I.\n\nAlice was beginning to get very tired of sitting by her sister.\n\n",
        "So she was considering in her own mind \u{2014} as well as she could.",
    ];
    let units = |text: &str| text.encode_utf16().count();
    let index = |id: &str| {
        serde_json::json!({
            "id": id, "source": "gutenberg", "credit": "Project Gutenberg",
            "licence": "Public domain in the USA.", "link": "https://www.gutenberg.org/ebooks/11",
            "parts": [units(parts[0]), units(parts[1])], "complete": true, "next": 0, "start": 0,
            "toc": [{ "title": "CHAPTER I.", "at": 0 }],
            "generations": [170, 171], "seam_digest": "00", "seam": 1
        })
    };
    let mut store = env.store("data");
    for (key, text) in [
        ("text/pg-11/index", index("pg-11").to_string()),
        ("text/pg-11/g00000000000000aa/part/0", parts[0].to_string()),
        ("text/pg-11/g00000000000000ab/part/1", parts[1].to_string()),
        (
            "text/pg-11/g00000000000000ac/part/1",
            "written by a round that lost".to_string(),
        ),
    ] {
        let key = format!("apps/books/shared/{key}");
        store.put(key.as_bytes(), text.as_bytes()).await.unwrap();
    }
    let read = Browser::new().get(&env, "/api/books/text/pg-11").await;
    assert_eq!(
        read["parts"],
        serde_json::json!([units(parts[0]), units(parts[1])])
    );
    assert_eq!(read["complete"], true);
    assert_eq!(read["licence"], "Public domain in the USA.");
    assert_eq!(read["toc"][0]["title"], "CHAPTER I.");
    for internal in ["next", "generations", "seam_digest", "seam"] {
        assert!(read.get(internal).is_none(), "{internal} is the server's");
    }
    assert_eq!(
        a.get(&env, "/api/books/text/pg-11/0").await["text"],
        parts[0]
    );
    let second = a.get(&env, "/api/books/text/pg-11/1").await;
    assert_eq!(second["text"], parts[1]);
    assert_eq!(second["part"], 1);
    let past = a.send(&env, ingress::get("/api/books/text/pg-11/2")).await;
    assert_eq!(past.status, 404);

    // Without the egress binding the module says it has no way out.
    let bare = boot_in(crate::support::Slot::beside()).await;
    let none = Browser::new()
        .send(&bare, ingress::get("/api/books/store"))
        .await;
    assert_eq!(none.status, 503);
}

/// A Podcasts library that follows a real show and queues one of its episodes.
fn podcasts_library_with_a_show() -> serde_json::Value {
    serde_json::json!({
        "subscribed": ["510318"],
        "played": [],
        "positions": { "510318.0123456789abcdef": 30 },
        "settings": {
            "refresh": "Every Day", "download": "All Unplayed", "skipForward": 30,
            "skipBack": 15, "continuous": false, "sync": true
        },
        "shows": [{
            "id": "510318", "title": "Up First from NPR", "author": "NPR",
            "artwork": "https://is1-ssl.mzstatic.com/image/thumb/a/600x600bb.jpg",
            "genre": "Daily News", "feed": "https://feeds.npr.org/510318/podcast.xml",
            "seen": 1_791_892_800_000u64
        }],
        "queue": [{
            "id": "510318.fedcba9876543210", "show": "510318", "title": "Tuesday's news",
            "showTitle": "Up First from NPR", "artwork": null,
            "audio": "https://play.podtrac.com/npr-510318/tuesday.mp3", "kind": "audio/mpeg",
            "duration": 900, "published": 1_791_892_800_000u64,
            "feed": "https://feeds.npr.org/510318/podcast.xml"
        }],
        "current": null,
        "speed": 1.5
    })
}

/// The desktop with Podcasts' egress handle bound. The harness's egress is
/// deny-all, so no request reaches Apple or a feed here: these tests hold
/// what is refused before any request and how a refused one is answered.
/// Real shows and feeds are read by `e2e/podcasts-journey.mjs` under
/// `ferrite dev --egress allow`.
async fn boot_for_podcast_requests() -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let harness = TestHarness::new()
        .with_queue("requests")
        .with_queue("replies")
        .with_queue("live")
        .with_queue("frames")
        .with_store("data");
    #[cfg(feature = "local-egress")]
    let harness = harness.with_egress("podcasts");
    let env = harness.build().await;
    env.run_app(|ctx| async move { macalicious_desktop::run(ctx).await });
    crate::support::Env::new(env, slot)
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn podcasts_reads_only_listed_feeds_and_says_why_when_it_cannot() {
    let env = boot_for_podcast_requests().await;
    let mut a = Browser::new();
    let status = |reply: &IngressReply| reply.status;

    let hosts = a.get(&env, "/api/podcasts/hosts").await;
    assert_eq!(hosts["egress"], "podcasts");
    let feeds = hosts["feeds"].as_array().unwrap();
    assert!(feeds.iter().any(|f| f == "https://feeds.npr.org/"));
    assert_eq!(
        hosts["destinations"].as_array().unwrap().len(),
        feeds.len() + 3,
        "Apple's search, lookup and chart, then the feed hosts"
    );

    // A feed on a host this desktop cannot reach is refused, with the reason, before any request.
    let unlisted = a
        .send(
            &env,
            ingress::get("/api/podcasts/feed?url=https%3A%2F%2Ffeeds.example.org%2Fshow.xml"),
        )
        .await;
    assert_eq!(status(&unlisted), 400);
    let body = json(&unlisted);
    assert_eq!(body["followable"], false);
    assert!(body["error"]
        .as_str()
        .unwrap()
        .contains("feeds.example.org"));

    // A listed feed is asked for; the harness's egress refuses it: 502, and nothing is cached.
    for path in [
        "/api/podcasts/feed?url=https%3A%2F%2Ffeeds.npr.org%2F510318%2Fpodcast.xml",
        "/api/podcasts/feed?url=http%3A%2F%2Ffeeds.npr.org%2F510318%2Fpodcast.xml&max_age=0",
        "/api/podcasts/search?term=up%20first",
        "/api/podcasts/lookup?ids=510318,1200361736",
        "/api/podcasts/top",
    ] {
        let refused = a.send(&env, ingress::get(path)).await;
        assert_eq!(
            status(&refused),
            egress_profile::FAILURE_STATUS,
            "{path}: {}",
            String::from_utf8_lossy(&refused.body)
        );
        assert!(json(&refused)["error"].as_str().unwrap().contains("egress"));
    }

    for (path, expected) in [
        ("/api/podcasts/search?term=", 400),
        ("/api/podcasts/search?term=%20%20", 400),
        ("/api/podcasts/search?term=%FF", 400),
        ("/api/podcasts/lookup?ids=12a", 400),
        ("/api/podcasts/lookup?ids=", 400),
        ("/api/podcasts/feed?url=javascript%3Aalert(1)", 400),
        (
            "/api/podcasts/feed?url=https%3A%2F%2Ffeeds.npr.org%2F1&max_age=soon",
            400,
        ),
        ("/api/podcasts/elsewhere", 404),
    ] {
        let reply = a.send(&env, ingress::get(path)).await;
        assert_eq!(status(&reply), expected, "{path}");
    }
    let post = a
        .send(
            &env,
            ingress::request("POST", "/api/podcasts/search", "", b""),
        )
        .await;
    assert_eq!(status(&post), 405);

    // Without the egress binding the module says it has none.
    let bare = boot_in(crate::support::Slot::beside()).await;
    let none = Browser::new()
        .send(
            &bare,
            ingress::get(
                "/api/podcasts/feed?url=https%3A%2F%2Ffeeds.npr.org%2F510318%2Fpodcast.xml",
            ),
        )
        .await;
    assert_eq!(status(&none), 503);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn podcasts_refuses_a_follow_it_could_not_read_and_keeps_each_person_s_queue() {
    let env = boot().await;
    let (mut a, mut b) = (Browser::new(), Browser::new());
    const URL: &str = "/api/podcasts/library";
    a.get(&env, URL).await;
    let put = |library: serde_json::Value, rev: u64| serde_json::json!({ "library": library, "rev": rev });

    let mut elsewhere = podcasts_library_with_a_show();
    elsewhere["shows"][0]["feed"] = "https://feeds.example.org/show.xml".into();
    let refused = a.put_json(&env, URL, put(elsewhere, 0)).await;
    assert_eq!(refused.status, 400);
    assert!(String::from_utf8_lossy(&refused.body).contains("cannot be followed"));

    let mut fast = podcasts_library_with_a_show();
    fast["speed"] = 3.into();
    assert_eq!(a.put_json(&env, URL, put(fast, 0)).await.status, 400);

    let mut stray = podcasts_library_with_a_show();
    stray["queue"][0]["audio"] = "javascript:alert(1)".into();
    assert_eq!(a.put_json(&env, URL, put(stray, 0)).await.status, 400);

    // Text is limited in characters (Rust `char`s), as the window counts them (code points):
    // 201 are refused whatever their size; 200 of four bytes each are kept (below).
    let mut long = podcasts_library_with_a_show();
    long["shows"][0]["title"] = "\u{1F399}".repeat(201).into();
    assert_eq!(a.put_json(&env, URL, put(long, 0)).await.status, 400);

    let mut playing = podcasts_library_with_a_show();
    playing["shows"][0]["title"] = "\u{1F399}".repeat(200).into();
    playing["current"] = playing["queue"][0].clone();
    playing["queue"] = serde_json::json!([]);
    playing["positions"] = serde_json::json!({ "510318.fedcba9876543210": 120 });
    let saved = a.put_json(&env, URL, put(playing.clone(), 0)).await;
    assert_eq!(
        saved.status,
        200,
        "{}",
        String::from_utf8_lossy(&saved.body)
    );
    assert_eq!(a.get(&env, URL).await["library"], playing);
    // Another person sees none of it.
    assert_eq!(b.get(&env, URL).await["library"], serde_json::Value::Null);

    // A library saved before Podcasts read real feeds still reads, with no shows and normal speed.
    let old = serde_json::json!({
        "subscribed": ["signal-path"], "played": [], "positions": {},
        "settings": {
            "refresh": "Every Hour", "download": "Only New", "skipForward": 30,
            "skipBack": 15, "continuous": true, "sync": true
        }
    });
    assert_eq!(b.put_json(&env, URL, put(old, 0)).await.status, 200);
    let read = b.get(&env, URL).await;
    assert_eq!(read["library"]["speed"], 1.0);
    assert_eq!(read["library"]["shows"], serde_json::json!([]));
    assert_eq!(read["library"]["current"], serde_json::Value::Null);
}

#[test]
fn the_manifest_declares_podcasts_egress_exactly_as_the_module_reaches_it() {
    let spec: serde_json::Value = serde_json::from_str(include_str!("../ferrite.json")).unwrap();
    // `podcasts` is split into `podcasts`, `podcasts-2`, ... to the platform's 16-destination
    // capability limit (`src/apps/egress.rs`); together, in order, they hold the destinations.
    let declared: Vec<&str> = spec["applications"][0]["egress"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|e| {
            let handle = e["handle"].as_str().unwrap_or("");
            handle == "podcasts" || handle.starts_with("podcasts-")
        })
        .flat_map(|e| e["destinations"].as_array().unwrap().iter())
        .map(|d| d.as_str().unwrap())
        .collect();
    assert!(
        !declared.is_empty(),
        "ferrite.json declares the `podcasts` egress handles: without them every outside request of Podcasts is refused"
    );
    let reply = tokio::runtime::Runtime::new().unwrap().block_on(async {
        let env = boot_for_podcast_requests().await;
        Browser::new().get(&env, "/api/podcasts/hosts").await
    });
    let expected: Vec<&str> = reply["destinations"]
        .as_array()
        .unwrap()
        .iter()
        .map(|d| d.as_str().unwrap())
        .collect();
    assert_eq!(declared, expected);
}

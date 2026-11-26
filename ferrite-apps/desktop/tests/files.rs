// The personal drive (`src/apps/files/`) on the in-process Forge planes
// (`ferrite-app-test`): each browser's drive starts with the six home
// folders; a file uploads in pieces, in any order, and reads back byte for
// byte; folders and files are made, renamed, moved, copied, trashed, put
// back and deleted; a resent change is applied once; one browser can neither
// see nor read another's files; the limits answer the statuses the browser
// helper reports.

use ferrite_app::{serde_json, IngressReply, IngressRequest};
use ferrite_app_test::{ingress, TestEnv, TestHarness};

const PIECE: usize = 192 * 1024;

async fn boot() -> crate::support::Env {
    boot_with(TestHarness::new()).await
}

async fn boot_with(harness: TestHarness) -> crate::support::Env {
    // The harness is only configured here; its planes are bound in `build`.
    let slot = crate::support::Slot::acquire();
    let env = harness
        .with_blob("files")
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

    async fn drive(&mut self, env: &TestEnv) -> serde_json::Value {
        let reply = self.send(env, ingress::get("/api/files/")).await;
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

    async fn ops(&mut self, env: &TestEnv, ops: serde_json::Value) -> serde_json::Value {
        let reply = self
            .post(env, "/api/files/ops", serde_json::json!({ "ops": ops }))
            .await;
        assert_eq!(
            reply.status,
            200,
            "{ops}: {}",
            String::from_utf8_lossy(&reply.body)
        );
        json(&reply)
    }

    async fn put_piece(
        &mut self,
        env: &TestEnv,
        upload: &str,
        n: usize,
        bytes: &[u8],
    ) -> IngressReply {
        let mut req = ingress::request(
            "PUT",
            &format!("/api/files/uploads/{upload}/{n}"),
            "",
            bytes,
        );
        req.headers
            .push(("content-type".into(), "application/octet-stream".into()));
        self.send(env, req).await
    }

    /// Uploads `bytes` as `name` into `parent`, pieces in reverse order.
    async fn upload(&mut self, env: &TestEnv, parent: &str, name: &str, bytes: &[u8]) -> String {
        let start = self
            .post(
                env,
                "/api/files/uploads",
                serde_json::json!({ "parent": parent, "name": name, "size": bytes.len(), "type": "text/plain" }),
            )
            .await;
        assert_eq!(
            start.status,
            201,
            "{}",
            String::from_utf8_lossy(&start.body)
        );
        let start = json(&start);
        let upload = start["upload"].as_str().unwrap().to_string();
        let chunks: Vec<&[u8]> = bytes.chunks(PIECE).collect();
        assert_eq!(start["pieces"], chunks.len());
        for (n, chunk) in chunks.iter().enumerate().rev() {
            let reply = self.put_piece(env, &upload, n, chunk).await;
            assert_eq!(
                reply.status,
                200,
                "{}",
                String::from_utf8_lossy(&reply.body)
            );
        }
        let done = self
            .post(
                env,
                &format!("/api/files/uploads/{upload}/complete"),
                serde_json::json!({}),
            )
            .await;
        assert_eq!(done.status, 200, "{}", String::from_utf8_lossy(&done.body));
        json(&done)["created"][0].as_str().unwrap().to_string()
    }

    async fn read(&mut self, env: &TestEnv, id: &str, query: &str) -> IngressReply {
        self.send(
            env,
            ingress::get(&format!("/api/files/content/{id}?{query}")),
        )
        .await
    }
}

fn entry<'a>(drive: &'a serde_json::Value, id: &str) -> &'a serde_json::Value {
    drive["entries"]
        .as_array()
        .unwrap()
        .iter()
        .find(|e| e["id"] == id)
        .unwrap_or_else(|| panic!("no entry {id} in {drive}"))
}

fn names_in(drive: &serde_json::Value, parent: &str) -> Vec<String> {
    let mut names: Vec<String> = drive["entries"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|e| e["parent"] == parent && e.get("trashed_ms").is_none())
        .map(|e| e["name"].as_str().unwrap().to_string())
        .collect();
    names.sort();
    names
}

fn bytes(len: usize) -> Vec<u8> {
    (0..len).map(|n| (n * 7 % 251) as u8).collect()
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_file_uploads_in_pieces_and_reads_back_byte_for_byte() {
    let env = boot().await;
    let mut a = Browser::new();
    let drive = a.drive(&env).await;
    assert_eq!(drive["rev"], 0);
    assert_eq!(drive["usage"], 0);
    assert_eq!(drive["entries"].as_array().unwrap().len(), 6);
    assert!(drive["session"].is_string());

    // Over two pieces: the gateway's 256 KiB body cap needs the split.
    let data = bytes(PIECE * 2 + 1000);
    let start = a
        .post(
            &env,
            "/api/files/uploads",
            serde_json::json!({ "parent": "documents", "name": "Big.txt", "size": data.len(), "type": "text/plain" }),
        )
        .await;
    assert_eq!(start.status, 201);
    let upload = json(&start)["upload"].as_str().unwrap().to_string();
    // A piece of the wrong length is refused; a missing piece holds completion back.
    assert_eq!(a.put_piece(&env, &upload, 0, &data[..10]).await.status, 400);
    assert_eq!(a.put_piece(&env, &upload, 3, &data[..10]).await.status, 400);
    assert_eq!(
        a.put_piece(&env, &upload, 2, &data[PIECE * 2..])
            .await
            .status,
        200
    );
    assert_eq!(
        a.put_piece(&env, &upload, 0, &data[..PIECE]).await.status,
        200
    );
    let early = a
        .post(
            &env,
            &format!("/api/files/uploads/{upload}/complete"),
            serde_json::json!({}),
        )
        .await;
    assert_eq!(early.status, 409);
    assert_eq!(json(&early)["missing"], serde_json::json!([1]));
    let status = a
        .send(&env, ingress::get(&format!("/api/files/uploads/{upload}")))
        .await;
    assert_eq!(json(&status)["received"], serde_json::json!([0, 2]));
    // Resent, as after a lost reply.
    for _ in 0..2 {
        assert_eq!(
            a.put_piece(&env, &upload, 1, &data[PIECE..PIECE * 2])
                .await
                .status,
            200
        );
    }
    let done = a
        .post(
            &env,
            &format!("/api/files/uploads/{upload}/complete"),
            serde_json::json!({}),
        )
        .await;
    assert_eq!(done.status, 200, "{}", String::from_utf8_lossy(&done.body));
    let done = json(&done);
    let id = done["created"][0].as_str().unwrap().to_string();
    assert_eq!(entry(&done, &id)["size"], data.len());
    assert_eq!(entry(&done, &id)["type"], "text/plain");
    assert!(
        entry(&done, &id).get("content").is_none(),
        "content ids stay on the server"
    );
    assert_eq!(done["usage"], data.len());
    // Completing again answers the same file and adds none.
    let again = a
        .post(
            &env,
            &format!("/api/files/uploads/{upload}/complete"),
            serde_json::json!({}),
        )
        .await;
    assert_eq!(json(&again)["created"][0], id.as_str());
    assert_eq!(names_in(&a.drive(&env).await, "documents"), ["Big.txt"]);

    let whole = a.read(&env, &id, "piece=0&count=8").await;
    assert_eq!(whole.status, 200);
    assert_eq!(whole.body, data);
    assert!(whole
        .headers
        .iter()
        .any(|(n, v)| n == "content-type" && v == "application/octet-stream"));
    assert!(whole
        .headers
        .iter()
        .any(|(n, v)| n == "content-disposition" && v == "attachment"));
    let middle = a.read(&env, &id, "piece=1&count=1").await;
    assert_eq!(middle.body, &data[PIECE..PIECE * 2]);
    assert_eq!(a.read(&env, &id, "piece=3").await.status, 416);
    assert_eq!(a.read(&env, &id, "count=9").await.status, 400);

    // Another browser has a drive of its own and cannot read this file.
    let mut b = Browser::new();
    assert_eq!(b.drive(&env).await["usage"], 0);
    assert_eq!(b.read(&env, &id, "").await.status, 404);
    assert_eq!(
        b.post(
            &env,
            &format!("/api/files/uploads/{upload}/complete"),
            serde_json::json!({})
        )
        .await
        .status,
        404
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn folders_and_files_are_renamed_moved_copied_trashed_and_put_back() {
    let env = boot().await;
    let mut a = Browser::new();
    let note = a.upload(&env, "desktop", "Note.txt", b"hello drive").await;

    let made = a
        .ops(
            &env,
            serde_json::json!([{ "op": "mkdir", "parent": "documents", "name": "Letters" }]),
        )
        .await;
    let letters = made["created"][0].as_str().unwrap().to_string();
    let drive = a
        .ops(
            &env,
            serde_json::json!([
                { "op": "rename", "id": note, "name": "Hello.txt" },
                { "op": "move", "id": note, "parent": letters },
            ]),
        )
        .await;
    assert_eq!(names_in(&drive, &letters), ["Hello.txt"]);
    assert!(names_in(&drive, "desktop").is_empty());

    let copied = a
        .ops(
            &env,
            serde_json::json!([{ "op": "copy", "id": letters, "parent": "desktop" }]),
        )
        .await;
    let copy = copied["created"][0].as_str().unwrap().to_string();
    assert_eq!(names_in(&copied, "desktop"), ["Letters"]);
    assert_eq!(names_in(&copied, &copy), ["Hello.txt"]);
    assert_eq!(copied["usage"], 11, "a copy shares its bytes");
    let inner = copied["entries"]
        .as_array()
        .unwrap()
        .iter()
        .find(|e| e["parent"] == copy.as_str())
        .unwrap()["id"]
        .as_str()
        .unwrap()
        .to_string();
    assert_eq!(a.read(&env, &inner, "").await.body, b"hello drive");

    // A refused change answers why and changes nothing.
    let refused = a
        .post(
            &env,
            "/api/files/ops",
            serde_json::json!({ "ops": [
                { "op": "trash", "id": note },
                { "op": "rename", "id": "music", "name": "Tunes" },
            ]}),
        )
        .await;
    assert_eq!(refused.status, 409);
    assert!(json(&refused)["error"]
        .as_str()
        .unwrap()
        .contains("cannot be renamed"));
    assert_eq!(names_in(&a.drive(&env).await, &letters), ["Hello.txt"]);

    let trashed = a
        .ops(&env, serde_json::json!([{ "op": "trash", "id": note }]))
        .await;
    assert!(entry(&trashed, &note)["trashed_ms"].is_u64());
    assert!(names_in(&trashed, &letters).is_empty());
    let back = a
        .ops(&env, serde_json::json!([{ "op": "restore", "id": note }]))
        .await;
    assert_eq!(names_in(&back, &letters), ["Hello.txt"]);

    // Trash the copy and empty the Trash: the original keeps its bytes.
    let emptied = a
        .ops(
            &env,
            serde_json::json!([{ "op": "trash", "id": copy }, { "op": "empty-trash" }]),
        )
        .await;
    assert!(names_in(&emptied, "desktop").is_empty());
    assert_eq!(emptied["usage"], 11);
    assert_eq!(a.read(&env, &note, "").await.body, b"hello drive");
    assert_eq!(a.read(&env, &inner, "").await.status, 404);

    // Deleting the last file frees its bytes.
    let deleted = a
        .ops(&env, serde_json::json!([{ "op": "delete", "id": note }]))
        .await;
    assert_eq!(deleted["usage"], 0);
    assert_eq!(a.read(&env, &note, "").await.status, 404);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_resent_change_is_applied_once() {
    let env = boot().await;
    let mut a = Browser::new();
    a.drive(&env).await;
    let send = |key: &str| {
        let mut req = ingress::request(
            "POST",
            "/api/files/ops",
            "",
            serde_json::json!({ "ops": [{ "op": "mkdir", "parent": "documents", "name": "untitled folder" }] })
                .to_string()
                .as_bytes(),
        );
        req.headers.push(("idempotency-key".into(), key.into()));
        req
    };
    let first = json(&a.send(&env, send("k-1")).await);
    let again = json(&a.send(&env, send("k-1")).await);
    assert_eq!(first["created"], again["created"]);
    assert_eq!(names_in(&again, "documents"), ["untitled folder"]);
    let other = json(&a.send(&env, send("k-2")).await);
    assert_eq!(
        names_in(&other, "documents"),
        ["untitled folder", "untitled folder 2"]
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn the_limits_answer_their_statuses() {
    let env = boot().await;
    let mut a = Browser::new();
    let start = |size: u64, parent: &str| serde_json::json!({ "parent": parent, "name": "x.bin", "size": size });
    let too_big = a
        .post(
            &env,
            "/api/files/uploads",
            start(64 * 1024 * 1024 + 1, "movies"),
        )
        .await;
    assert_eq!(too_big.status, 413);
    assert_eq!(
        a.post(&env, "/api/files/uploads", start(1, "nowhere"))
            .await
            .status,
        404
    );
    let bad_name = a
        .post(
            &env,
            "/api/files/uploads",
            serde_json::json!({ "parent": "movies", "name": "a/b", "size": 1 }),
        )
        .await;
    assert_eq!(bad_name.status, 400);

    // An empty file needs no pieces.
    let empty = a.upload(&env, "documents", "Empty.txt", b"").await;
    let read = a.read(&env, &empty, "").await;
    assert_eq!((read.status, read.body.len()), (200, 0));

    // Eight uploads may be open at once; a cancelled one frees its place.
    let mut uploads = Vec::new();
    for _ in 0..8 {
        let reply = a.post(&env, "/api/files/uploads", start(5, "movies")).await;
        assert_eq!(reply.status, 201);
        uploads.push(json(&reply)["upload"].as_str().unwrap().to_string());
    }
    assert_eq!(
        a.post(&env, "/api/files/uploads", start(5, "movies"))
            .await
            .status,
        429
    );
    assert_eq!(
        a.put_piece(&env, &uploads[0], 0, b"12345").await.status,
        200
    );
    let cancel = a
        .send(
            &env,
            ingress::request(
                "DELETE",
                &format!("/api/files/uploads/{}", uploads[0]),
                "",
                b"",
            ),
        )
        .await;
    assert_eq!(cancel.status, 204);
    assert_eq!(
        a.send(
            &env,
            ingress::get(&format!("/api/files/uploads/{}", uploads[0]))
        )
        .await
        .status,
        404
    );
    assert_eq!(
        a.post(&env, "/api/files/uploads", start(5, "movies"))
            .await
            .status,
        201
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn opens_sent_at_once_cannot_pass_the_limit() {
    let env = std::sync::Arc::new(boot().await);
    let mut a = Browser::new();
    a.drive(&env).await;
    let cookie = (
        "cookie".to_string(),
        format!("mac_session={}", a.token.clone().unwrap()),
    );
    let handles: Vec<_> = (0..12)
        .map(|n| {
            let mut req = ingress::request(
                "POST",
                "/api/files/uploads",
                "",
                serde_json::json!({ "parent": "movies", "name": format!("m{n}"), "size": 5 })
                    .to_string()
                    .as_bytes(),
            );
            req.headers.push(cookie.clone());
            let env = env.clone();
            tokio::spawn(async move { env.handle(req).await.expect("a reply") })
        })
        .collect();
    let mut replies = Vec::new();
    for handle in handles {
        replies.push(handle.await.unwrap());
    }
    let opened = replies.iter().filter(|r| r.status == 201).count();
    assert!((1..=8).contains(&opened), "{opened} uploads opened at once");
    assert!(replies.iter().all(|r| matches!(r.status, 201 | 429 | 503)));
    let open = a.drive(&env).await;
    assert_eq!(open["reserved"], opened * 5, "{open}");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_completed_file_is_never_changed_or_given_up_by_its_upload() {
    let env = boot().await;
    let mut a = Browser::new();
    let data = bytes(PIECE + 10);
    let start = a
        .post(
            &env,
            "/api/files/uploads",
            serde_json::json!({ "parent": "documents", "name": "Kept.bin", "size": data.len() }),
        )
        .await;
    let upload = json(&start)["upload"].as_str().unwrap().to_string();
    for (n, chunk) in data.chunks(PIECE).enumerate() {
        assert_eq!(a.put_piece(&env, &upload, n, chunk).await.status, 200);
    }
    let done = a
        .post(
            &env,
            &format!("/api/files/uploads/{upload}/complete"),
            serde_json::json!({}),
        )
        .await;
    assert_eq!(done.status, 200);
    let id = json(&done)["created"][0].as_str().unwrap().to_string();

    // A late resend of a piece, with other bytes, changes nothing.
    let other = vec![0xEE; PIECE];
    let late = a.put_piece(&env, &upload, 0, &other).await;
    assert!(matches!(late.status, 200 | 404), "{}", late.status);
    // Giving the upload up after it completed gives nothing up.
    let cancel = a
        .send(
            &env,
            ingress::request("DELETE", &format!("/api/files/uploads/{upload}"), "", b""),
        )
        .await;
    assert_eq!(cancel.status, 204);
    // Later writes run the garbage collection; the file keeps its bytes.
    a.ops(
        &env,
        serde_json::json!([{ "op": "mkdir", "parent": "documents", "name": "x" }]),
    )
    .await;
    let read = a.read(&env, &id, "piece=0&count=8").await;
    assert_eq!(read.status, 200);
    assert_eq!(read.body, data);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_piece_is_written_once_and_a_resent_start_opens_one_upload() {
    let env = boot().await;
    let mut a = Browser::new();
    a.drive(&env).await;
    let keyed = |key: &str| {
        let mut req = ingress::request(
            "POST",
            "/api/files/uploads",
            "",
            serde_json::json!({ "parent": "documents", "name": "Once.txt", "size": 4 })
                .to_string()
                .as_bytes(),
        );
        req.headers.push(("idempotency-key".into(), key.into()));
        req
    };
    let first = json(&a.send(&env, keyed("start-1")).await);
    let again = json(&a.send(&env, keyed("start-1")).await);
    assert_eq!(first["upload"], again["upload"]);
    let upload = first["upload"].as_str().unwrap().to_string();
    assert_eq!(a.put_piece(&env, &upload, 0, b"good").await.status, 200);
    // The same piece sent again with other bytes keeps the first.
    assert_eq!(a.put_piece(&env, &upload, 0, b"evil").await.status, 200);
    let done = a
        .post(
            &env,
            &format!("/api/files/uploads/{upload}/complete"),
            serde_json::json!({}),
        )
        .await;
    let id = json(&done)["created"][0].as_str().unwrap().to_string();
    assert_eq!(a.read(&env, &id, "").await.body, b"good");
    assert_eq!(
        a.drive(&env).await["entries"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|e| e["name"] == "Once.txt")
            .count(),
        1
    );
}

/// The stored drive's pending deletions.
async fn drive_garbage(env: &TestEnv) -> Vec<serde_json::Value> {
    let (_, stored, _) = stored_drive(env).await;
    stored["doc"]["garbage"]
        .as_array()
        .cloned()
        .unwrap_or_default()
}

/// Whether the drive's pending deletions name `content`.
async fn pending(env: &TestEnv, content: &str) -> bool {
    drive_garbage(env)
        .await
        .iter()
        .any(|record| record["content"] == content)
}

/// Whether piece `n` of `content` is in the `files` blob.
async fn piece_stored(env: &TestEnv, content: &str, n: u32) -> bool {
    let mut blobs = env.context().blob("files").unwrap();
    blobs
        .get(format!("drive/{content}/{n:05}").as_bytes())
        .await
        .unwrap()
        .is_some()
}

/// The content id the stored drive gives the entry `id`.
async fn content_of(env: &TestEnv, id: &str) -> String {
    let (_, stored, _) = stored_drive(env).await;
    stored["doc"]["entries"]
        .as_array()
        .unwrap()
        .iter()
        .find(|entry| entry["id"] == id)
        .and_then(|entry| entry["content"].as_str())
        .unwrap_or_else(|| panic!("no content for {id}"))
        .to_string()
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_refused_batch_keeps_nothing_even_when_an_upload_expired_meanwhile() {
    let env = boot_with(TestHarness::new().manual_clock(1_000_000)).await;
    let mut a = Browser::new();
    let kept = a.upload(&env, "documents", "Kept.txt", b"keep me").await;
    // An upload left open, which expires a day later.
    let open = a
        .post(
            &env,
            "/api/files/uploads",
            serde_json::json!({ "parent": "movies", "name": "Late.mov", "size": 3 }),
        )
        .await;
    assert_eq!(open.status, 201);
    assert_eq!(a.drive(&env).await["reserved"], 3);
    advance(&env, 25 * 60 * 60 * 1000).await;
    // Delete the file, then a change the drive refuses: nothing of it is kept.
    let refused = a
        .post(
            &env,
            "/api/files/ops",
            serde_json::json!({ "ops": [
                { "op": "delete", "id": kept },
                { "op": "rename", "id": "music", "name": "Tunes" },
            ]}),
        )
        .await;
    assert_eq!(refused.status, 409);
    let drive = a.drive(&env).await;
    assert_eq!(names_in(&drive, "documents"), ["Kept.txt"]);
    assert_eq!(a.read(&env, &kept, "").await.body, b"keep me");
    // The expired upload was given up all the same, and its pieces wait in
    // the drive's pending deletions for their grace period.
    assert_eq!(drive["reserved"], 0);
    assert_eq!(drive_garbage(&env).await.len(), 1);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_deleted_file_s_pieces_are_deleted_by_the_next_request() {
    let env = boot().await;
    let mut a = Browser::new();
    let id = a
        .upload(&env, "documents", "Gone.txt", &bytes(PIECE + 1))
        .await;
    let content = content_of(&env, &id).await;
    a.ops(&env, serde_json::json!([{ "op": "delete", "id": id }]))
        .await;
    // The change only noted the bytes for deletion.
    assert!(pending(&env, &content).await);
    assert!(piece_stored(&env, &content, 0).await && piece_stored(&env, &content, 1).await);
    // The next request, whatever it is, deletes them before it is answered.
    assert_eq!(a.read(&env, &id, "").await.status, 404);
    assert!(!pending(&env, &content).await);
    assert!(!piece_stored(&env, &content, 0).await && !piece_stored(&env, &content, 1).await);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_retry_after_200_other_changes_answers_the_first_result_and_applies_once() {
    let env = boot().await;
    let mut a = Browser::new();
    a.drive(&env).await;
    let keyed = |key: &str, path: &str, body: serde_json::Value| {
        let mut req = ingress::request("POST", path, "", body.to_string().as_bytes());
        req.headers
            .push(("content-type".into(), "application/json".into()));
        req.headers.push(("idempotency-key".into(), key.into()));
        req
    };
    let mkdir = |name: &str| serde_json::json!({ "ops": [{ "op": "mkdir", "parent": "documents", "name": name }] });
    let start = serde_json::json!({ "parent": "movies", "name": "Clip.mov", "size": 4 });
    let first = json(
        &a.send(&env, keyed("k-first", "/api/files/ops", mkdir("Kept")))
            .await,
    );
    let opened = a
        .send(&env, keyed("s-first", "/api/files/uploads", start.clone()))
        .await;
    assert_eq!(opened.status, 201);
    let opened = json(&opened);
    // 200 unrelated keyed changes come between each request and its retry.
    for n in 0..200 {
        let reply = a
            .send(
                &env,
                keyed(
                    &format!("k-{n}"),
                    "/api/files/ops",
                    mkdir(&format!("other {n}")),
                ),
            )
            .await;
        assert_eq!(
            reply.status,
            200,
            "{}",
            String::from_utf8_lossy(&reply.body)
        );
    }
    let again = json(
        &a.send(&env, keyed("k-first", "/api/files/ops", mkdir("Kept")))
            .await,
    );
    assert_eq!(again["created"], first["created"]);
    let names = names_in(&again, "documents");
    assert_eq!(names.iter().filter(|n| n.starts_with("Kept")).count(), 1);
    assert_eq!(names.len(), 201);
    let reopened = a
        .send(&env, keyed("s-first", "/api/files/uploads", start))
        .await;
    assert_eq!(json(&reopened)["upload"], opened["upload"]);
    assert_eq!(a.drive(&env).await["reserved"], 4, "one upload is open");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn only_the_request_that_claimed_a_piece_writes_it() {
    let env = boot().await;
    let mut a = Browser::new();
    let start = a
        .post(
            &env,
            "/api/files/uploads",
            serde_json::json!({ "parent": "documents", "name": "Claimed.txt", "size": 4 }),
        )
        .await;
    let upload = json(&start)["upload"].as_str().unwrap().to_string();
    // A request that claimed piece 0 and ended before writing it. The
    // person's key space is wherever their drive document is.
    let mut store = env.context().store("data").unwrap();
    let (rows, _) = store
        .scan_prefix(b"apps/files/users/", None, 64)
        .await
        .unwrap();
    let drive_key = rows
        .iter()
        .map(|(key, _, _)| String::from_utf8_lossy(key).into_owned())
        .find(|key| key.ends_with("/drive"))
        .expect("the drive document");
    let space = drive_key.trim_end_matches("drive");
    let claim = format!("{space}piece/{upload}/00000/claim");
    store.put(claim.as_bytes(), b"{\"at\":0}").await.unwrap();
    // Every later sender is refused, whatever it sends, and the piece never
    // arrives: the upload cannot complete with bytes nobody acknowledged.
    for _ in 0..2 {
        assert_eq!(a.put_piece(&env, &upload, 0, b"late").await.status, 503);
    }
    let done = a
        .post(
            &env,
            &format!("/api/files/uploads/{upload}/complete"),
            serde_json::json!({}),
        )
        .await;
    assert_eq!(done.status, 409);
}

/// Moves the manual clock on, once the worker has acknowledged the requests
/// sent so far: a request still leased when the clock jumps would expire and
/// be delivered again.
async fn advance(env: &TestEnv, ms: u64) {
    crate::support::advance(env, ms).await;
}

/// The stored drive document of the only person with one: its key, its JSON
/// and its version.
async fn stored_drive(env: &TestEnv) -> (Vec<u8>, serde_json::Value, u64) {
    let mut store = env.context().store("data").unwrap();
    let (rows, _) = store
        .scan_prefix(b"apps/files/users/", None, 256)
        .await
        .unwrap();
    let mut drives: Vec<_> = rows
        .into_iter()
        .filter(|(key, _, _)| key.ends_with(b"/drive"))
        .collect();
    assert_eq!(
        drives.len(),
        1,
        "one drive document: {:?}",
        drives
            .iter()
            .map(|(key, value, _)| format!(
                "{} {}",
                String::from_utf8_lossy(key),
                String::from_utf8_lossy(value)
            ))
            .collect::<Vec<_>>()
    );
    let (key, value, version) = drives.remove(0);
    (key, serde_json::from_slice(&value).unwrap(), version)
}

/// Sets the person's pending deletions, as a sweep that stopped part-way
/// (a storage failure, a lost race) would leave them, with each record's one
/// piece in the `files` blob.
async fn strand_in_the_drive(env: &TestEnv, contents: &[String]) {
    let mut blobs = env.context().blob("files").unwrap();
    for content in contents {
        blobs
            .put(format!("drive/{content}/00000").as_bytes(), b"left")
            .await
            .unwrap();
    }
    let garbage: Vec<serde_json::Value> = contents
        .iter()
        .map(|content| {
            serde_json::json!({ "content": content, "pieces": 1, "next": 0, "not_before_ms": 0 })
        })
        .collect();
    let (key, mut stored, version) = stored_drive(env).await;
    stored["doc"]["garbage"] = serde_json::Value::Array(garbage);
    let mut store = env.context().store("data").unwrap();
    let written = store
        .put_if_version(&key, stored.to_string().as_bytes(), Some(version))
        .await
        .unwrap();
    assert!(written.is_ok());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_refused_change_still_advances_the_sweep() {
    let env = boot().await;
    let mut a = Browser::new();
    a.upload(&env, "documents", "Seed.txt", b"x").await;
    strand_in_the_drive(&env, &["stranded".to_string()]).await;
    let refused = a
        .post(
            &env,
            "/api/files/ops",
            serde_json::json!({ "ops": [{ "op": "rename", "id": "music", "name": "Tunes" }] }),
        )
        .await;
    assert_eq!(refused.status, 409);
    assert!(!pending(&env, "stranded").await);
    assert!(!piece_stored(&env, "stranded", 0).await);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn every_kind_of_request_advances_the_sweep() {
    let env = boot().await;
    let mut a = Browser::new();
    let file = a.upload(&env, "documents", "Seed.txt", b"seed").await;
    let start = a
        .post(
            &env,
            "/api/files/uploads",
            serde_json::json!({ "parent": "documents", "name": "Open.txt", "size": 4 }),
        )
        .await;
    let open = json(&start)["upload"].as_str().unwrap().to_string();
    let unknown = "0123456789abcdef0123456789abcdef";
    let requests = [
        (
            "a download",
            ingress::get(&format!("/api/files/content/{file}")),
        ),
        (
            "a status read",
            ingress::get(&format!("/api/files/uploads/{open}")),
        ),
        (
            "a piece",
            ingress::request("PUT", &format!("/api/files/uploads/{open}/0"), "", b"open"),
        ),
        (
            "a refused piece",
            ingress::request("PUT", &format!("/api/files/uploads/{unknown}/0"), "", b"x"),
        ),
        (
            "a missing file",
            ingress::get(&format!("/api/files/content/{unknown}")),
        ),
        (
            "a method not allowed",
            ingress::request("PATCH", "/api/files/ops", "", b""),
        ),
    ];
    for (n, (what, request)) in requests.into_iter().enumerate() {
        let content = format!("stranded-{n}");
        strand_in_the_drive(&env, &[content.clone()]).await;
        a.send(&env, request).await;
        assert!(!pending(&env, &content).await, "{what}");
        assert!(!piece_stored(&env, &content, 0).await, "{what}");
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn emptying_a_drive_of_hundreds_of_files_is_quick_and_later_requests_clear_the_rest() {
    let env = boot().await;
    let mut a = Browser::new();
    const FILES: usize = 200;
    let mut ids = Vec::new();
    for n in 0..FILES {
        ids.push(
            a.upload(&env, "documents", &format!("f{n}.txt"), b"x")
                .await,
        );
    }
    let first = content_of(&env, &ids[0]).await;
    let last = content_of(&env, &ids[FILES - 1]).await;
    for batch in ids.chunks(64) {
        let trash: Vec<serde_json::Value> = batch
            .iter()
            .map(|id| serde_json::json!({ "op": "trash", "id": id }))
            .collect();
        a.ops(&env, serde_json::Value::Array(trash)).await;
    }
    // Emptying the Trash only notes the bytes for deletion: one quick change.
    let clock = env.context();
    let started = clock.now_ms();
    let emptied = a
        .ops(&env, serde_json::json!([{ "op": "empty-trash" }]))
        .await;
    let took = clock.now_ms() - started;
    assert!(took < 2_000, "{took} ms");
    assert_eq!(emptied["usage"], 0);
    assert_eq!(drive_garbage(&env).await.len(), FILES);
    assert!(piece_stored(&env, &first, 0).await && piece_stored(&env, &last, 0).await);
    // Each later request deletes at most 16 pieces before it is answered.
    let mut reads = 0;
    loop {
        let left = drive_garbage(&env).await.len();
        if left == 0 {
            break;
        }
        let started = clock.now_ms();
        a.drive(&env).await;
        let took = clock.now_ms() - started;
        assert!(took < 2_000, "{took} ms");
        assert_eq!(drive_garbage(&env).await.len(), left.saturating_sub(16));
        reads += 1;
        assert!(reads <= FILES / 16 + 1, "the backlog keeps shrinking");
    }
    assert_eq!(reads, FILES.div_ceil(16));
    assert!(!piece_stored(&env, &first, 0).await && !piece_stored(&env, &last, 0).await);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_download_alone_advances_the_sweep() {
    let env = boot().await;
    let mut a = Browser::new();
    let file = a.upload(&env, "documents", "Kept.txt", b"kept").await;
    let stranded: Vec<String> = (0..40).map(|n| format!("g{n:02}")).collect();
    strand_in_the_drive(&env, &stranded).await;
    let read = a.read(&env, &file, "").await;
    assert_eq!(
        (read.status, read.body.as_slice()),
        (200, b"kept".as_slice())
    );
    assert_eq!(drive_garbage(&env).await.len(), 24);
    assert!(!piece_stored(&env, "g00", 0).await && !piece_stored(&env, "g15", 0).await);
    assert!(piece_stored(&env, "g16", 0).await);
    for left in [8, 0] {
        assert_eq!(a.read(&env, &file, "").await.body, b"kept");
        assert_eq!(drive_garbage(&env).await.len(), left);
    }
    assert!(!piece_stored(&env, "g39", 0).await);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn an_expired_upload_is_given_up_by_the_next_request() {
    let env = boot_with(TestHarness::new().manual_clock(1_000_000)).await;
    let mut a = Browser::new();
    let hour = 60 * 60 * 1000;
    let mut uploads = Vec::new();
    for n in 0..3 {
        if n > 0 {
            advance(&env, hour).await;
        }
        let reply = a
            .post(
                &env,
                "/api/files/uploads",
                serde_json::json!({ "parent": "movies", "name": format!("m{n}"), "size": 3 }),
            )
            .await;
        assert_eq!(reply.status, 201);
        uploads.push(json(&reply)["upload"].as_str().unwrap().to_string());
    }
    let (_, stored, _) = stored_drive(&env).await;
    let content = |id: &str| {
        stored["doc"]["uploads"][id]["content"]
            .as_str()
            .unwrap()
            .to_string()
    };
    let contents: Vec<String> = uploads.iter().map(|id| content(id)).collect();
    let open = |stored: &serde_json::Value, id: &str| stored["doc"]["uploads"].get(id).is_some();
    // The first gets its one piece before it expires.
    assert_eq!(a.put_piece(&env, &uploads[0], 0, b"abc").await.status, 200);
    assert!(piece_stored(&env, &contents[0], 0).await);

    // The first expires: the sweep at the start of the next request gives it
    // up, so completing it finds no upload.
    advance(&env, 22 * hour + hour / 2).await;
    let complete = a
        .post(
            &env,
            &format!("/api/files/uploads/{}/complete", uploads[0]),
            serde_json::json!({}),
        )
        .await;
    assert_eq!(complete.status, 404);
    let (_, stored, _) = stored_drive(&env).await;
    assert!(!open(&stored, &uploads[0]) && open(&stored, &uploads[1]));
    assert!(pending(&env, &contents[0]).await);
    // Within the grace period the piece that arrived stays.
    assert!(piece_stored(&env, &contents[0], 0).await);

    // The second: a piece sent to it finds no upload.
    advance(&env, hour).await;
    assert_eq!(a.put_piece(&env, &uploads[1], 0, b"abc").await.status, 404);
    let (_, stored, _) = stored_drive(&env).await;
    assert!(!open(&stored, &uploads[1]) && open(&stored, &uploads[2]));
    assert!(pending(&env, &contents[1]).await);
    // The first upload's piece waited out its grace period, and a sweep
    // since then deleted it.
    assert!(!pending(&env, &contents[0]).await);
    assert!(!piece_stored(&env, &contents[0], 0).await);

    // The third: asking how far it got answers 404.
    advance(&env, hour).await;
    let status = a
        .send(
            &env,
            ingress::get(&format!("/api/files/uploads/{}", uploads[2])),
        )
        .await;
    assert_eq!(status.status, 404);
    let (_, stored, _) = stored_drive(&env).await;
    assert!(!open(&stored, &uploads[2]));
    assert!(pending(&env, &contents[2]).await);
    assert_eq!(a.drive(&env).await["reserved"], 0);
    advance(&env, 61_000).await;
    a.drive(&env).await;
    assert!(drive_garbage(&env).await.is_empty());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_cancelled_upload_s_pieces_are_deleted_after_the_grace_period() {
    let env = boot_with(TestHarness::new().manual_clock(1_000_000)).await;
    let mut a = Browser::new();
    let start = a
        .post(
            &env,
            "/api/files/uploads",
            serde_json::json!({ "parent": "documents", "name": "Gone.txt", "size": 4 }),
        )
        .await;
    let upload = json(&start)["upload"].as_str().unwrap().to_string();
    let (_, stored, _) = stored_drive(&env).await;
    let content = stored["doc"]["uploads"][&upload]["content"]
        .as_str()
        .unwrap()
        .to_string();
    assert_eq!(a.put_piece(&env, &upload, 0, b"gone").await.status, 200);
    let cancel = a
        .send(
            &env,
            ingress::request("DELETE", &format!("/api/files/uploads/{upload}"), "", b""),
        )
        .await;
    assert_eq!(cancel.status, 204);
    // Within the grace period a piece write still under way may land, so the
    // piece stays.
    advance(&env, 30_000).await;
    a.drive(&env).await;
    assert!(pending(&env, &content).await && piece_stored(&env, &content, 0).await);
    advance(&env, 31_000).await;
    a.drive(&env).await;
    assert!(!pending(&env, &content).await && !piece_stored(&env, &content, 0).await);
}

/// Saves `bytes` in place of the file `id` (`existing: overwrite`), made from `base` when given:
/// the upload's id and the completion's reply, or no id and the start's reply when it is refused.
async fn save_in_place(
    browser: &mut Browser,
    env: &TestEnv,
    id: &str,
    bytes: &[u8],
    base: Option<u64>,
) -> (Option<String>, IngressReply) {
    let mut body = serde_json::json!({
        "parent": "documents", "name": "Letter.txt", "size": bytes.len(), "type": "text/plain",
        "existing": "overwrite", "replaces": id,
    });
    if let Some(base) = base {
        body["base"] = base.into();
    }
    let start = browser.post(env, "/api/files/uploads", body).await;
    if start.status != 201 {
        return (None, start);
    }
    let upload = json(&start)["upload"].as_str().unwrap().to_string();
    for (n, chunk) in bytes.chunks(PIECE).enumerate() {
        assert_eq!(browser.put_piece(env, &upload, n, chunk).await.status, 200);
    }
    let done = browser
        .post(
            env,
            &format!("/api/files/uploads/{upload}/complete"),
            serde_json::json!({}),
        )
        .await;
    (Some(upload), done)
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_save_in_place_and_a_read_name_the_version_they_were_made_from() {
    let env = boot().await;
    let mut a = Browser::new();
    a.drive(&env).await;
    let first = bytes(PIECE + 10);
    let id = a.upload(&env, "documents", "Letter.txt", &first).await;
    assert_eq!(entry(&a.drive(&env).await, &id)["version"], 0);

    // A read that names the version it started from is answered while the file has it.
    let piece = a.read(&env, &id, "piece=0&count=1&version=0").await;
    assert_eq!(piece.body, &first[..PIECE]);

    // A window saves from version 0: version 1.
    let second = bytes(PIECE + 10)
        .iter()
        .map(|b| b ^ 0xff)
        .collect::<Vec<u8>>();
    let (first_save, saved) = save_in_place(&mut a, &env, &id, &second, Some(0)).await;
    assert_eq!(
        saved.status,
        200,
        "{}",
        String::from_utf8_lossy(&saved.body)
    );
    assert_eq!(entry(&json(&saved), &id)["version"], 1);
    assert_eq!(
        json(&saved)["version"],
        1,
        "the completion says the version it made"
    );

    // The rest of the read begun on version 0 is refused, never the new version's bytes; read
    // again from version 1, the file is the new one whole.
    assert_eq!(
        a.read(&env, &id, "piece=1&count=1&version=0").await.status,
        412
    );
    assert_eq!(
        a.read(&env, &id, "piece=0&count=8&version=1").await.body,
        second
    );
    assert_eq!(a.read(&env, &id, "version=x").await.status, 400);

    // Another window, still on version 0, is refused and the file keeps the first save.
    let (_, stale) = save_in_place(&mut a, &env, &id, b"older", Some(0)).await;
    assert_eq!(
        stale.status,
        412,
        "{}",
        String::from_utf8_lossy(&stale.body)
    );
    assert!(json(&stale)["error"]
        .as_str()
        .is_some_and(|m| m.contains("changed elsewhere")));
    assert_eq!(a.read(&env, &id, "piece=0&count=8").await.body, second);

    // Save Anyway names no version and goes in.
    let (_, anyway) = save_in_place(&mut a, &env, &id, b"anyway", None).await;
    assert_eq!(anyway.status, 200);
    assert_eq!(entry(&json(&anyway), &id)["version"], 2);
    assert_eq!(a.read(&env, &id, "version=2").await.body, b"anyway");

    // The first save's completion resent now (its reply was lost) answers the version that save
    // made, 1, beside the file as it is now, at version 2: the window that sent it never takes
    // version 2 as its own.
    let first_save = first_save.expect("the first save opened");
    let resent = a
        .post(
            &env,
            &format!("/api/files/uploads/{first_save}/complete"),
            serde_json::json!({}),
        )
        .await;
    assert_eq!(resent.status, 200);
    assert_eq!(json(&resent)["created"][0], id.as_str());
    assert_eq!(json(&resent)["version"], 1);
    assert_eq!(entry(&json(&resent), &id)["version"], 2);
}

/// The numbers of the versions the file keeps, newest first.
async fn version_numbers(browser: &mut Browser, env: &TestEnv, id: &str) -> Vec<u64> {
    let reply = browser
        .send(env, ingress::get(&format!("/api/files/versions/{id}")))
        .await;
    assert_eq!(
        reply.status,
        200,
        "{}",
        String::from_utf8_lossy(&reply.body)
    );
    json(&reply)["versions"]
        .as_array()
        .unwrap()
        .iter()
        .map(|version| version["version"].as_u64().unwrap())
        .collect()
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_file_keeps_what_its_saves_replaced_and_goes_back_to_it() {
    let env = boot().await;
    let mut a = Browser::new();
    let first = bytes(PIECE + 10);
    let id = a.upload(&env, "documents", "Letter.txt", &first).await;
    assert_eq!(version_numbers(&mut a, &env, &id).await, [0u64; 0]);

    let entries = a.drive(&env).await["entries"].as_array().unwrap().len();
    let (_, saved) = save_in_place(&mut a, &env, &id, b"second", Some(0)).await;
    assert_eq!(saved.status, 200);
    let drive = a.drive(&env).await;
    assert_eq!(drive["entries"].as_array().unwrap().len(), entries);
    assert_eq!(
        drive["usage"],
        first.len() + 6,
        "counted in the person's storage"
    );
    assert_eq!(names_in(&drive, "documents"), ["Letter.txt"]);
    assert_eq!(version_numbers(&mut a, &env, &id).await, [0]);

    // File > Save marks the bytes as they are now; twice changes nothing.
    for _ in 0..2 {
        let keep = a
            .post(
                &env,
                &format!("/api/files/versions/{id}/keep"),
                serde_json::json!({ "version": 1 }),
            )
            .await;
        assert_eq!(keep.status, 204, "{}", String::from_utf8_lossy(&keep.body));
    }
    let (_, saved) = save_in_place(&mut a, &env, &id, b"third", Some(1)).await;
    assert_eq!(saved.status, 200);
    assert_eq!(version_numbers(&mut a, &env, &id).await, [1, 0]);

    // A version reads back byte for byte, in pieces, as an inert attachment.
    let reply = a
        .send(
            &env,
            ingress::get(&format!("/api/files/versions/{id}/0?piece=0&count=8")),
        )
        .await;
    assert_eq!(reply.status, 200);
    assert_eq!(reply.body, first);
    let header = |name: &str| {
        reply
            .headers
            .iter()
            .find(|(n, _)| n == name)
            .map(|(_, v)| v.clone())
    };
    assert_eq!(header("x-file-pieces").as_deref(), Some("2"));
    assert_eq!(
        header("content-type").as_deref(),
        Some("application/octet-stream")
    );
    let later = a
        .send(
            &env,
            ingress::get(&format!("/api/files/versions/{id}/0?piece=1&count=1")),
        )
        .await;
    assert_eq!(later.body, &first[PIECE..]);
    let none = a
        .send(&env, ingress::get(&format!("/api/files/versions/{id}/7")))
        .await;
    assert_eq!(none.status, 404);

    // Restored, twice: the old bytes are the file's, and what they replaced is kept.
    let path = format!("/api/files/versions/{id}/0/restore");
    for _ in 0..2 {
        let restored = a.post(&env, &path, serde_json::json!({ "base": 2 })).await;
        assert_eq!(
            restored.status,
            200,
            "{}",
            String::from_utf8_lossy(&restored.body)
        );
        assert_eq!(json(&restored)["version"], 3);
    }
    assert_eq!(a.read(&env, &id, "piece=0&count=8").await.body, first);
    assert_eq!(entry(&a.drive(&env).await, &id)["version"], 3);
    assert_eq!(entry(&a.drive(&env).await, &id)["size"], first.len());
    assert_eq!(version_numbers(&mut a, &env, &id).await, [2, 1]);
    let stale = a
        .post(
            &env,
            &format!("/api/files/versions/{id}/1/restore"),
            serde_json::json!({ "base": 2 }),
        )
        .await;
    assert_eq!(stale.status, 412);

    // Another person's browser reaches none of it.
    let mut b = Browser::new();
    b.drive(&env).await;
    let foreign = b
        .send(&env, ingress::get(&format!("/api/files/versions/{id}")))
        .await;
    assert_eq!(foreign.status, 404);
    let foreign = b
        .send(&env, ingress::get(&format!("/api/files/versions/{id}/1")))
        .await;
    assert_eq!(foreign.status, 404);

    // Erased, its versions are freed.
    a.ops(&env, serde_json::json!([{ "op": "delete", "id": id }]))
        .await;
    let drive = a.drive(&env).await;
    assert_eq!(drive["usage"], 0);
    let gone = a
        .send(&env, ingress::get(&format!("/api/files/versions/{id}")))
        .await;
    assert_eq!(gone.status, 404);
}

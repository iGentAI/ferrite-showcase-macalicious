//! The live apps on the in-process Forge planes: Messages' shared rooms and
//! Chess's shared games, their write rules, and the `/live/` stream route
//! that pushes every change to the open subscriptions.

use ferrite_app::{serde_json, IngressReply, IngressRequest, StreamFrame};
use ferrite_app_test::{ingress, TestEnv, TestHarness, WsSession};

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
    env.run_app(|ctx| async move { macalicious_desktop::run(ctx).await });
    crate::support::Env::new(env, slot)
}

fn json(reply: &IngressReply) -> serde_json::Value {
    serde_json::from_slice(&reply.body)
        .unwrap_or_else(|e| panic!("{e}: {}", String::from_utf8_lossy(&reply.body)))
}

async fn call(env: &TestEnv, req: IngressRequest) -> IngressReply {
    env.handle(req).await.expect("a reply")
}

/// A new browser: the token of a fresh session.
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
        .and_then(|pair| pair.strip_prefix("mac_session="))
        .expect("the session cookie")
        .to_string()
}

fn as_browser(mut req: IngressRequest, token: &str, key: Option<&str>) -> IngressRequest {
    req.headers
        .push(("cookie".into(), format!("mac_session={token}")));
    if let Some(key) = key {
        req.headers.push(("idempotency-key".into(), key.into()));
    }
    req
}

async fn author(env: &TestEnv, app: &str, token: &str) -> String {
    let reply = call(
        env,
        as_browser(ingress::get(&format!("/api/{app}/me")), token, None),
    )
    .await;
    json(&reply)["author"].as_str().unwrap().to_string()
}

fn say(token: &str, room: &str, text: &str, key: Option<&str>) -> IngressRequest {
    let body = serde_json::json!({ "text": text }).to_string();
    as_browser(
        ingress::post(&format!("/api/messages/rooms/{room}"), body),
        token,
        key,
    )
}

async fn room(env: &TestEnv, token: &str, room: &str) -> Vec<serde_json::Value> {
    let reply = call(
        env,
        as_browser(
            ingress::get(&format!("/api/messages/rooms/{room}")),
            token,
            None,
        ),
    )
    .await;
    assert_eq!(reply.status, 200);
    json(&reply)["state"]["messages"]
        .as_array()
        .unwrap()
        .clone()
}

fn ply(token: &str, number: u64, index: usize, from: &str, to: &str) -> IngressRequest {
    let body = serde_json::json!({ "number": number, "ply": index, "from": from, "to": to });
    as_browser(
        ingress::post("/api/chess/games/g1/plies", body.to_string()),
        token,
        None,
    )
}

fn new_game(token: &str, number: u64) -> IngressRequest {
    let body = serde_json::json!({ "number": number }).to_string();
    as_browser(ingress::post("/api/chess/games/g1/new", body), token, None)
}

fn frame_json(frame: &StreamFrame) -> serde_json::Value {
    serde_json::from_slice(&frame.data).unwrap()
}

/// The next `state` frame whose state satisfies `pred`.
async fn state_where(
    sub: &mut WsSession,
    mut pred: impl FnMut(&serde_json::Value) -> bool,
) -> serde_json::Value {
    let frame = ferrite_app::rt::time::timeout(
        std::time::Duration::from_secs(15),
        sub.recv_until(|f| f.event.as_deref() == Some("state") && pred(&frame_json(f)["state"])),
    )
    .await
    .expect("the state arrives within 15 seconds, even while pings continue")
    .expect("the state arrives on the live feed");
    frame_json(&frame)
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_message_is_appended_once_however_often_it_is_delivered() {
    let env = boot().await;
    let a = browser(&env).await;
    let b = browser(&env).await;
    let author_a = author(&env, "messages", &a).await;
    let author_b = author(&env, "messages", &b).await;
    assert_ne!(author_a, author_b);

    let first = call(&env, say(&a, "r1", "hello", Some("k-1"))).await;
    assert_eq!(first.status, 201);
    assert_eq!(json(&first)["message"]["seq"], 1);
    // A resend with the same key appends nothing and answers with the message.
    let again = call(&env, say(&a, "r1", "hello", Some("k-1"))).await;
    assert_eq!(again.status, 200);
    assert_eq!(json(&again)["message"]["seq"], 1);
    // Two deliveries racing each other append once.
    let raced = env
        .handle_all(vec![
            say(&a, "r1", "twice", Some("k-2")),
            say(&a, "r1", "twice", Some("k-2")),
        ])
        .await;
    let mut statuses: Vec<u16> = raced.iter().map(|r| r.as_ref().unwrap().status).collect();
    statuses.sort();
    assert_eq!(statuses, vec![200, 201]);
    // The same key from another session is another message.
    assert_eq!(
        call(&env, say(&b, "r1", "hi", Some("k-1"))).await.status,
        201
    );
    // Without a key a message is appended every time it arrives.
    assert_eq!(call(&env, say(&b, "r1", "plain", None)).await.status, 201);

    let messages = room(&env, &b, "r1").await;
    let texts: Vec<&str> = messages
        .iter()
        .map(|m| m["text"].as_str().unwrap())
        .collect();
    assert_eq!(texts, ["hello", "twice", "hi", "plain"]);
    let seqs: Vec<u64> = messages
        .iter()
        .map(|m| m["seq"].as_u64().unwrap())
        .collect();
    assert_eq!(seqs, [1, 2, 3, 4]);
    assert_eq!(messages[0]["author"], author_a.as_str());
    assert_eq!(messages[2]["author"], author_b.as_str());

    // Bad input is refused.
    assert_eq!(call(&env, say(&a, "r1", "   ", None)).await.status, 400);
    assert_eq!(call(&env, say(&a, "R1", "x", None)).await.status, 400);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_message_reaches_an_open_subscription_live() {
    let env = boot().await;
    let a = browser(&env).await;
    let mut sub = env.sse_open("/live/messages/r2").await.unwrap();
    // The first event is the room as it is: empty.
    let first = state_where(&mut sub, |_| true).await;
    assert_eq!(first["state"]["messages"], serde_json::json!([]));

    assert_eq!(
        call(&env, say(&a, "r2", "live!", Some("k"))).await.status,
        201
    );
    let next = state_where(&mut sub, |s| s["messages"].as_array().unwrap().len() == 1).await;
    assert_eq!(next["state"]["messages"][0]["text"], "live!");
    assert!(next["version"].as_u64().unwrap() > first["version"].as_u64().unwrap());
    sub.close().await.unwrap();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_path_that_names_no_feed_is_refused_and_ended() {
    let env = boot().await;
    for path in [
        "/live/nothing/x",
        "/live/messages/Not-A-Room",
        "/live/chess/a/b",
    ] {
        let mut sub = env.sse_open(path).await.unwrap();
        let frame = sub.recv().await.expect("a frame");
        assert_eq!(frame.event.as_deref(), Some("refused"), "{path}");
        assert!(frame.done, "{path}");
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn two_browsers_play_one_game_by_its_rules_of_turn() {
    let env = boot().await;
    let a = browser(&env).await;
    let b = browser(&env).await;
    let c = browser(&env).await;
    let author_a = author(&env, "chess", &a).await;
    let author_b = author(&env, "chess", &b).await;

    // A moves White first and holds it.
    let e4 = call(&env, ply(&a, 1, 0, "e2", "e4")).await;
    assert_eq!(e4.status, 201);
    assert_eq!(json(&e4)["state"]["white"], author_a.as_str());
    // A resend of the same ply is harmless.
    assert_eq!(call(&env, ply(&a, 1, 0, "e2", "e4")).await.status, 200);
    // B takes Black with the next ply; a stale ply 0 from B is told the game.
    let stale = call(&env, ply(&b, 1, 0, "d2", "d4")).await;
    assert_eq!(stale.status, 409);
    assert_eq!(json(&stale)["state"]["plies"].as_array().unwrap().len(), 1);
    let e5 = call(&env, ply(&b, 1, 1, "e7", "e5")).await;
    assert_eq!(e5.status, 201);
    assert_eq!(json(&e5)["state"]["black"], author_b.as_str());
    // White is A's: B may not move it, nor may a third browser.
    assert_eq!(call(&env, ply(&b, 1, 2, "g1", "f3")).await.status, 403);
    assert_eq!(call(&env, ply(&c, 1, 2, "g1", "f3")).await.status, 403);
    // A ply beyond the next, or for another game, is told the game.
    assert_eq!(call(&env, ply(&a, 1, 5, "g1", "f3")).await.status, 409);
    assert_eq!(call(&env, ply(&a, 2, 2, "g1", "f3")).await.status, 409);
    assert_eq!(call(&env, ply(&a, 1, 2, "z9", "f3")).await.status, 400);
    assert_eq!(call(&env, ply(&a, 1, 2, "g1", "f3")).await.status, 201);

    // Only a player starts a new game; a resend of it changes nothing.
    assert_eq!(call(&env, new_game(&c, 1)).await.status, 403);
    let fresh = call(&env, new_game(&a, 1)).await;
    assert_eq!(fresh.status, 201);
    assert_eq!(
        json(&fresh)["state"],
        serde_json::json!({ "number": 2, "plies": [], "white": null, "black": null })
    );
    let resent = call(&env, new_game(&a, 1)).await;
    assert_eq!(resent.status, 200);
    assert_eq!(json(&resent)["state"]["number"], 2);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_move_reaches_the_other_browser_live() {
    let env = boot().await;
    let a = browser(&env).await;
    let mut sub = env.sse_open("/live/chess/g1").await.unwrap();
    let first = state_where(&mut sub, |_| true).await;
    assert_eq!(first["state"]["plies"], serde_json::json!([]));
    assert_eq!(call(&env, ply(&a, 1, 0, "e2", "e4")).await.status, 201);
    let next = state_where(&mut sub, |s| s["plies"].as_array().unwrap().len() == 1).await;
    assert_eq!(next["state"]["plies"][0]["to"], "e4");
    sub.close().await.unwrap();
}

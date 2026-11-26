//! Chess and FaceTime between desktop accounts on the in-process Forge
//! planes (`ferrite-app-test`): Chess invitations, answers, moves only by
//! the two players and games against the computer; FaceTime calls placed by
//! account name, answered on a seat tied to the answering page, ended by a
//! hang-up only from the seat that holds the call, and kept in each person's
//! recent calls. A third account reaches none of it.

use ferrite_app::{serde_json, IngressReply};
use ferrite_app_test::{ingress, TestEnv, TestHarness};
use serde_json::{json, Value};

const PEPPER: &str = "test-pepper-0123456789abcdef0123456789abcdef";
const PASSWORD: &str = "correct horse battery";
/// The manual clock's start: Monday 19 October 2026, 08:00 UTC.
const START_MS: u64 = 1_792_396_800_000;

async fn boot(manual: bool) -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let mut harness = TestHarness::new();
    if manual {
        harness = harness.manual_clock(START_MS);
    }
    let env = harness
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
        body: Option<&Value>,
        key: Option<&str>,
    ) -> IngressReply {
        let bytes = body.map(Value::to_string).unwrap_or_default();
        let mut req = ingress::request(method, path, "", bytes.as_bytes());
        if let Some(key) = key {
            req.headers.push(("idempotency-key".into(), key.into()));
        }
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

    async fn get(&mut self, env: &TestEnv, path: &str) -> IngressReply {
        self.send(env, "GET", path, None, None).await
    }

    async fn read(&mut self, env: &TestEnv, path: &str) -> Value {
        let reply = self.get(env, path).await;
        assert_eq!(reply.status, 200, "GET {path}: {}", text(&reply));
        json_of(&reply)
    }

    async fn post(&mut self, env: &TestEnv, path: &str, body: Value) -> IngressReply {
        self.send(env, "POST", path, Some(&body), None).await
    }

    async fn post_keyed(
        &mut self,
        env: &TestEnv,
        path: &str,
        body: Value,
        key: &str,
    ) -> IngressReply {
        self.send(env, "POST", path, Some(&body), Some(key)).await
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

/// How many changes in `app` the personal stream has counted for the person
/// whose public id is `author` (the first 16 characters of their account).
async fn changes(env: &TestEnv, author: &str, app: &str) -> u64 {
    let prefix = format!("apps/notification-center/shared/changes/{author}");
    let (rows, _) = env
        .store("data")
        .scan_prefix(prefix.as_bytes(), None, 4)
        .await
        .expect("scan the change counts");
    rows.first()
        .and_then(|(_, value, _)| serde_json::from_slice::<Value>(value).ok())
        .and_then(|counts| counts[app]["n"].as_u64())
        .unwrap_or(0)
}

// ── Chess ──

async fn author(env: &TestEnv, browser: &mut Browser) -> String {
    browser.read(env, "/api/chess/me").await["author"]
        .as_str()
        .expect("an author")
        .to_string()
}

/// Ada invites `to`, playing White: the game's id and its state.
async fn invite(env: &TestEnv, from: &mut Browser, to: &str, key: &str) -> (String, Value) {
    let reply = from
        .post_keyed(
            env,
            "/api/chess/invitations",
            json!({ "to": to, "side": "white" }),
            key,
        )
        .await;
    assert_eq!(reply.status, 201, "invitation: {}", text(&reply));
    let body = json_of(&reply);
    (
        body["id"].as_str().unwrap().to_string(),
        body["state"].clone(),
    )
}

async fn ply(
    env: &TestEnv,
    browser: &mut Browser,
    game: &str,
    index: usize,
    from: &str,
    to: &str,
) -> IngressReply {
    browser
        .post(
            env,
            &format!("/api/chess/games/{game}/plies"),
            json!({ "number": 1, "ply": index, "from": from, "to": to }),
        )
        .await
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_clock_starts_when_the_game_does_charges_each_move_and_ends_the_game_at_zero() {
    let env = boot(true).await;
    let mut ada = sign_up(&env, "ada", "Ada Lovelace").await;
    let mut bob = sign_up(&env, "bob", "Bob Kahn").await;

    let too_long = ada
        .post_keyed(
            &env,
            "/api/chess/invitations",
            json!({ "to": "bob", "side": "white", "clock_minutes": 181 }),
            "clock-0",
        )
        .await;
    assert_eq!(too_long.status, 400, "{}", text(&too_long));

    let reply = ada
        .post_keyed(
            &env,
            "/api/chess/invitations",
            json!({ "to": "bob", "side": "white", "clock_minutes": 1 }),
            "clock-1",
        )
        .await;
    assert_eq!(reply.status, 201, "{}", text(&reply));
    let body = json_of(&reply);
    let game = body["id"].as_str().unwrap().to_string();
    assert_eq!(body["state"]["clock"]["white_ms"], 60_000);
    assert_eq!(body["state"]["clock"]["since_ms"], 0, "not running yet");

    // A wait for the answer costs nobody anything.
    crate::support::advance(&env, 30 * SECOND).await;
    let accepted = bob
        .post(&env, &format!("/api/chess/games/{game}/accept"), json!({}))
        .await;
    assert_eq!(accepted.status, 200, "{}", text(&accepted));
    assert_eq!(json_of(&accepted)["state"]["clock"]["white_ms"], 60_000);

    crate::support::advance(&env, 10 * SECOND).await;
    let moved = ply(&env, &mut ada, &game, 0, "e2", "e4").await;
    assert_eq!(moved.status, 201, "{}", text(&moved));
    assert_eq!(json_of(&moved)["state"]["clock"]["white_ms"], 50_000);
    assert_eq!(json_of(&moved)["state"]["clock"]["black_ms"], 60_000);

    // The other player hears of the move in Notification Center, once.
    let inbox = bob.read(&env, "/api/notification-center/inbox").await;
    let told = inbox["items"].to_string();
    assert!(told.contains("played e2 to e4"), "{inbox}");
    assert_eq!(
        ply(&env, &mut ada, &game, 0, "e2", "e4").await.status,
        200,
        "a resend"
    );
    let again = bob.read(&env, "/api/notification-center/inbox").await;
    assert_eq!(
        again["items"]
            .to_string()
            .matches("played e2 to e4")
            .count(),
        1,
        "{again}"
    );

    // Time left refuses a flag; time gone takes it, and a late move too ends the game.
    let early = ada
        .post(&env, &format!("/api/chess/games/{game}/flag"), json!({}))
        .await;
    assert_eq!(early.status, 409, "{}", text(&early));
    crate::support::advance(&env, 61 * SECOND).await;
    let flagged = ada
        .post(&env, &format!("/api/chess/games/{game}/flag"), json!({}))
        .await;
    assert_eq!(flagged.status, 200, "{}", text(&flagged));
    let ended = &json_of(&flagged)["state"]["ended"];
    assert_eq!(ended["reason"], "time");
    assert_eq!(ended["winner"], "white");
    assert_eq!(
        ply(&env, &mut bob, &game, 1, "e7", "e5").await.status,
        409,
        "the game is over"
    );
    let resent = bob
        .post(&env, &format!("/api/chess/games/{game}/flag"), json!({}))
        .await;
    assert_eq!(resent.status, 200, "a resend: {}", text(&resent));

    // A move that comes after its time is not played: it ends the game.
    let reply = ada
        .post_keyed(
            &env,
            "/api/chess/invitations",
            json!({ "to": "bob", "side": "white", "clock_minutes": 1 }),
            "clock-2",
        )
        .await;
    let late = json_of(&reply)["id"].as_str().unwrap().to_string();
    let accepted = bob
        .post(&env, &format!("/api/chess/games/{late}/accept"), json!({}))
        .await;
    assert_eq!(accepted.status, 200, "{}", text(&accepted));
    crate::support::advance(&env, 61 * SECOND).await;
    let moved = ply(&env, &mut ada, &late, 0, "e2", "e4").await;
    assert_eq!(moved.status, 409, "{}", text(&moved));
    let state = &json_of(&moved)["state"];
    assert_eq!(state["ended"]["reason"], "time");
    assert_eq!(state["ended"]["winner"], "black");
    assert_eq!(state["plies"].as_array().unwrap().len(), 0);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_resent_key_must_ask_for_the_same_clock_and_variant() {
    let env = boot(true).await;
    let mut ada = sign_up(&env, "ada", "Ada Lovelace").await;
    sign_up(&env, "bob", "Bob Kahn").await;
    let computer = json!({ "side": "black", "level": 1 });
    for (url, first, others) in [
        (
            "/api/chess/games",
            json!({ "computer": computer, "clock_minutes": 1 }),
            vec![
                json!({ "computer": computer, "clock_minutes": 30 }),
                json!({ "computer": computer, "clock_minutes": 1, "variant": "losers" }),
            ],
        ),
        (
            "/api/chess/invitations",
            json!({ "to": "bob", "side": "white", "clock_minutes": 1 }),
            vec![
                json!({ "to": "bob", "side": "white", "clock_minutes": 30 }),
                json!({ "to": "bob", "side": "white", "clock_minutes": 1, "variant": "suicide" }),
            ],
        ),
    ] {
        let key = format!("same-{url}");
        let made = ada.post_keyed(&env, url, first.clone(), &key).await;
        assert_eq!(made.status, 201, "{}", text(&made));
        let again = ada.post_keyed(&env, url, first, &key).await;
        assert_eq!(again.status, 200, "a resend: {}", text(&again));
        for other in others {
            let refused = ada.post_keyed(&env, url, other, &key).await;
            assert_eq!(refused.status, 409, "{}", text(&refused));
        }
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn taking_back_gives_no_time_back() {
    let env = boot(true).await;
    let mut ada = sign_up(&env, "ada", "Ada Lovelace").await;
    let reply = ada
        .post_keyed(
            &env,
            "/api/chess/games",
            json!({ "computer": { "side": "black", "level": 1 }, "clock_minutes": 1 }),
            "clock-back",
        )
        .await;
    assert_eq!(reply.status, 201, "{}", text(&reply));
    let game = json_of(&reply)["id"].as_str().unwrap().to_string();
    crate::support::advance(&env, 5 * SECOND).await;
    assert_eq!(ply(&env, &mut ada, &game, 0, "e2", "e4").await.status, 201);
    crate::support::advance(&env, 10 * SECOND).await;
    let answered = ply(&env, &mut ada, &game, 1, "e7", "e5").await;
    assert_eq!(answered.status, 201);
    let version = json_of(&answered)["version"].as_u64().unwrap();

    crate::support::advance(&env, 10 * SECOND).await;
    let back = ada
        .post(
            &env,
            &format!("/api/chess/games/{game}/takeback"),
            json!({ "number": 1, "to": 0, "version": version }),
        )
        .await;
    assert_eq!(back.status, 200, "{}", text(&back));
    let clock = &json_of(&back)["state"]["clock"];
    assert_eq!(clock["white_ms"], 45_000, "{clock}");
    assert_eq!(clock["black_ms"], 50_000, "{clock}");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_game_removed_is_not_started_again_as_a_board_for_anyone() {
    let env = boot(false).await;
    let mut ada = sign_up(&env, "ada", "Ada Lovelace").await;
    let reply = ada
        .post_keyed(
            &env,
            "/api/chess/games",
            json!({ "computer": { "side": "black", "level": 1 } }),
            "removed-1",
        )
        .await;
    assert_eq!(reply.status, 201, "{}", text(&reply));
    let game = json_of(&reply)["id"].as_str().unwrap().to_string();
    let removed = ada
        .post(&env, &format!("/api/chess/games/{game}/remove"), json!({}))
        .await;
    assert_eq!(removed.status, 200, "{}", text(&removed));
    let again = ada
        .post(
            &env,
            &format!("/api/chess/games/{game}/new"),
            json!({ "number": 0 }),
        )
        .await;
    assert_eq!(again.status, 404, "{}", text(&again));
    assert_eq!(
        ada.get(&env, &format!("/api/chess/games/{game}"))
            .await
            .status,
        404
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_game_over_on_the_board_is_not_lost_on_time_by_taking_back() {
    let env = boot(true).await;
    let mut ada = sign_up(&env, "ada", "Ada Lovelace").await;
    let reply = ada
        .post_keyed(
            &env,
            "/api/chess/games",
            json!({ "computer": { "side": "black", "level": 1 }, "clock_minutes": 1 }),
            "mated-back",
        )
        .await;
    assert_eq!(reply.status, 201, "{}", text(&reply));
    let game = json_of(&reply)["id"].as_str().unwrap().to_string();
    let mut version = 0;
    for (index, (from, to)) in [("f2", "f3"), ("e7", "e5"), ("g2", "g4"), ("d8", "h4")]
        .into_iter()
        .enumerate()
    {
        let moved = ply(&env, &mut ada, &game, index, from, to).await;
        assert_eq!(moved.status, 201, "{}", text(&moved));
        version = json_of(&moved)["version"].as_u64().unwrap();
    }
    crate::support::advance(&env, 120 * SECOND).await;
    let back = ada
        .post(
            &env,
            &format!("/api/chess/games/{game}/takeback"),
            json!({ "number": 1, "to": 2, "version": version }),
        )
        .await;
    assert_eq!(back.status, 200, "{}", text(&back));
    assert_eq!(json_of(&back)["state"]["ended"], Value::Null);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn the_other_player_is_told_how_a_move_ended_the_game() {
    let env = boot(false).await;
    let mut ada = sign_up(&env, "ada", "Ada Lovelace").await;
    let mut bob = sign_up(&env, "bob", "Bob Kahn").await;
    let (game, _) = invite(&env, &mut ada, "bob", "told-1").await;
    let accepted = bob
        .post(&env, &format!("/api/chess/games/{game}/accept"), json!({}))
        .await;
    assert!(accepted.status < 300, "{}", text(&accepted));
    assert_eq!(ply(&env, &mut ada, &game, 0, "f2", "f3").await.status, 201);
    assert_eq!(ply(&env, &mut bob, &game, 1, "e7", "e5").await.status, 201);
    assert_eq!(ply(&env, &mut ada, &game, 2, "g2", "g4").await.status, 201);
    assert_eq!(ply(&env, &mut bob, &game, 3, "d8", "h4").await.status, 201);
    let told = ada.read(&env, "/api/notification-center/inbox").await["items"].to_string();
    assert!(told.contains("played e7 to e5. Your move."), "{told}");
    assert!(
        told.contains("played d8 to h4. Checkmate. You lose."),
        "{told}"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_game_between_people_leaves_only_one_list_and_only_once_it_is_over() {
    let env = boot(false).await;
    let mut ada = sign_up(&env, "ada", "Ada Lovelace").await;
    let mut bob = sign_up(&env, "bob", "Bob Kahn").await;
    let (game, _) = invite(&env, &mut ada, "bob", "remove-1").await;
    let remove = format!("/api/chess/games/{game}/remove");
    assert_eq!(
        ada.post(&env, &remove, json!({})).await.status,
        409,
        "an invitation waiting"
    );
    let accept = format!("/api/chess/games/{game}/accept");
    assert_eq!(bob.post(&env, &accept, json!({})).await.status, 200);
    assert_eq!(
        ada.post(&env, &remove, json!({})).await.status,
        409,
        "in play"
    );
    let resign = format!("/api/chess/games/{game}/resign");
    assert_eq!(ada.post(&env, &resign, json!({})).await.status, 200);
    assert_eq!(ada.post(&env, &remove, json!({})).await.status, 200);
    assert_eq!(ada.read(&env, "/api/chess/mine").await["games"], json!([]));
    let theirs = bob.read(&env, "/api/chess/mine").await;
    assert_eq!(theirs["games"][0]["id"], game.as_str(), "{theirs}");
    assert_eq!(
        bob.get(&env, &format!("/api/chess/games/{game}"))
            .await
            .status,
        200
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn an_invitation_becomes_a_game_only_its_two_players_reach() {
    let env = boot(false).await;
    let mut ada = sign_up(&env, "ada", "Ada Lovelace").await;
    let mut bob = sign_up(&env, "bob", "Bob Kahn").await;
    let mut eve = sign_up(&env, "eve", "Eve Moneypenny").await;
    let bob_author = author(&env, &mut bob).await;
    let ada_author = author(&env, &mut ada).await;

    let (game, state) = invite(&env, &mut ada, "bob", "inv-1").await;
    assert_eq!(game.len(), 32, "a game made here has a random id: {game}");
    assert_eq!(state["white_name"], "Ada Lovelace");
    assert_eq!(state["black_name"], "Bob Kahn");
    assert_eq!(state["invite"]["state"], "pending");
    assert!(
        !state.to_string().contains("_account"),
        "no reply shows the account ids: {state}"
    );

    // Bob's list holds the invitation, and a notification says so.
    let mine = bob.read(&env, "/api/chess/mine").await;
    assert_eq!(mine["invitations"][0]["id"], game.as_str(), "{mine}");
    assert_eq!(mine["invitations"][0]["opponent"], "Ada Lovelace");
    assert_eq!(mine["games"], json!([]));
    let inbox = bob.read(&env, "/api/notification-center/inbox").await;
    assert_eq!(inbox["items"][0]["app"], "chess", "{inbox}");
    assert_eq!(inbox["items"][0]["title"], "Ada Lovelace");
    // Ada's list holds the game she is waiting on, not as an invitation.
    let mine = ada.read(&env, "/api/chess/mine").await;
    assert_eq!(mine["games"][0]["status"], "invited", "{mine}");
    assert_eq!(mine["invitations"], json!([]));

    // Nobody moves before Bob accepts.
    assert_eq!(ply(&env, &mut ada, &game, 0, "e2", "e4").await.status, 409);
    let reply = ada
        .post(&env, &format!("/api/chess/games/{game}/accept"), json!({}))
        .await;
    assert_eq!(
        reply.status,
        403,
        "the inviter does not accept: {}",
        text(&reply)
    );

    // Eve, who is not in the game, reaches nothing of it.
    let reply = eve.get(&env, &format!("/api/chess/games/{game}")).await;
    assert_eq!(reply.status, 404, "{}", text(&reply));
    for action in ["accept", "decline", "resign", "new"] {
        let reply = eve
            .post(
                &env,
                &format!("/api/chess/games/{game}/{action}"),
                json!({ "number": 1 }),
            )
            .await;
        assert_eq!(reply.status, 404, "Eve's {action}: {}", text(&reply));
        assert!(!text(&reply).contains("Ada"), "{}", text(&reply));
    }
    assert_eq!(ply(&env, &mut eve, &game, 0, "e2", "e4").await.status, 404);
    let mine = eve.read(&env, "/api/chess/mine").await;
    assert_eq!(mine, json!({ "games": [], "invitations": [] }));

    let reply = bob
        .post(&env, &format!("/api/chess/games/{game}/accept"), json!({}))
        .await;
    assert_eq!(reply.status, 200, "{}", text(&reply));
    assert_eq!(json_of(&reply)["state"]["invite"]["state"], "accepted");
    let inbox = bob.read(&env, "/api/notification-center/inbox").await;
    assert_eq!(
        inbox["items"],
        json!([]),
        "the answered invitation's notification goes"
    );
    // A resend of the answer stands.
    let reply = bob
        .post(&env, &format!("/api/chess/games/{game}/accept"), json!({}))
        .await;
    assert_eq!(reply.status, 200, "{}", text(&reply));

    // Each move counts a change in the other player's Chess.
    let before = changes(&env, &bob_author, "chess").await;
    assert_eq!(ply(&env, &mut ada, &game, 0, "e2", "e4").await.status, 201);
    assert_eq!(changes(&env, &bob_author, "chess").await, before + 1);
    // Ada may not move Black, and Bob's move of a white piece is no move of
    // Black's.
    assert_eq!(ply(&env, &mut ada, &game, 1, "e7", "e5").await.status, 403);
    assert_eq!(ply(&env, &mut bob, &game, 1, "g1", "f3").await.status, 409);
    let before = changes(&env, &ada_author, "chess").await;
    assert_eq!(ply(&env, &mut bob, &game, 1, "e7", "e5").await.status, 201);
    assert!(changes(&env, &ada_author, "chess").await > before);
    // An illegal move is refused with the game as it stands.
    let reply = ply(&env, &mut ada, &game, 2, "e4", "e6").await;
    assert_eq!(reply.status, 409);
    assert_eq!(
        json_of(&reply)["state"]["plies"].as_array().unwrap().len(),
        2
    );

    // The open feed never shows the game.
    let read = bob.read(&env, &format!("/api/chess/games/{game}")).await;
    assert_eq!(read["state"]["plies"][1]["to"], "e5");

    // A game between players is never replaced by New Game.
    let reply = ada
        .post(
            &env,
            &format!("/api/chess/games/{game}/new"),
            json!({ "number": 1 }),
        )
        .await;
    assert_eq!(reply.status, 409, "{}", text(&reply));

    // Ada resigns: Bob wins, and the game takes no more moves.
    let reply = ada
        .post(&env, &format!("/api/chess/games/{game}/resign"), json!({}))
        .await;
    assert_eq!(reply.status, 200, "{}", text(&reply));
    let ended = &json_of(&reply)["state"]["ended"];
    assert_eq!(ended["reason"], "resigned");
    assert_eq!(ended["winner"], "black");
    assert_eq!(ply(&env, &mut ada, &game, 2, "g1", "f3").await.status, 409);
    let mine = bob.read(&env, "/api/chess/mine").await;
    assert_eq!(mine["games"][0]["status"], "over", "{mine}");
    assert_eq!(mine["games"][0]["winner"], "black");
    assert_eq!(mine["games"][0]["side"], "black");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_resent_invitation_is_the_first_and_its_key_makes_nothing_else() {
    let env = boot(false).await;
    let mut ada = sign_up(&env, "ada", "Ada Lovelace").await;
    let mut bob = sign_up(&env, "bob", "Bob Kahn").await;
    let _carl = sign_up(&env, "carl", "Carl Sagan").await;
    let (game, _) = invite(&env, &mut ada, "bob", "same-key").await;
    let again = ada
        .post_keyed(
            &env,
            "/api/chess/invitations",
            json!({ "to": "bob", "side": "white" }),
            "same-key",
        )
        .await;
    assert_eq!(again.status, 200, "{}", text(&again));
    assert_eq!(json_of(&again)["id"], game.as_str());
    let mine = bob.read(&env, "/api/chess/mine").await;
    assert_eq!(mine["invitations"].as_array().unwrap().len(), 1, "{mine}");
    // The same key asking for another game is refused, and invites nobody.
    let other = ada
        .post_keyed(
            &env,
            "/api/chess/invitations",
            json!({ "to": "carl", "side": "white" }),
            "same-key",
        )
        .await;
    assert_eq!(other.status, 409, "{}", text(&other));
    // A resend after Bob answered changes nothing.
    let reply = bob
        .post(&env, &format!("/api/chess/games/{game}/decline"), json!({}))
        .await;
    assert_eq!(reply.status, 200, "{}", text(&reply));
    let again = ada
        .post_keyed(
            &env,
            "/api/chess/invitations",
            json!({ "to": "bob", "side": "white" }),
            "same-key",
        )
        .await;
    assert_eq!(again.status, 200, "{}", text(&again));
    assert_eq!(json_of(&again)["state"]["ended"]["reason"], "declined");
    let mine = bob.read(&env, "/api/chess/mine").await;
    assert_eq!(mine["invitations"], json!([]), "{mine}");
    // Nobody unknown, and not oneself.
    for (to, status) in [("nobody", 404), ("ada", 400)] {
        let reply = ada
            .post(&env, "/api/chess/invitations", json!({ "to": to }))
            .await;
        assert_eq!(reply.status, status, "{to}: {}", text(&reply));
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn an_invitation_is_declined_or_withdrawn_and_then_takes_no_answer() {
    let env = boot(false).await;
    let mut ada = sign_up(&env, "ada", "Ada Lovelace").await;
    let mut bob = sign_up(&env, "bob", "Bob Kahn").await;
    let (declined, _) = invite(&env, &mut ada, "bob", "k1").await;
    let reply = bob
        .post(
            &env,
            &format!("/api/chess/games/{declined}/decline"),
            json!({}),
        )
        .await;
    assert_eq!(json_of(&reply)["state"]["ended"]["reason"], "declined");
    let reply = bob
        .post(
            &env,
            &format!("/api/chess/games/{declined}/accept"),
            json!({}),
        )
        .await;
    assert_eq!(reply.status, 409, "{}", text(&reply));

    // Ada's decline of her own invitation withdraws it.
    let (withdrawn, _) = invite(&env, &mut ada, "bob", "k2").await;
    let reply = ada
        .post(
            &env,
            &format!("/api/chess/games/{withdrawn}/decline"),
            json!({}),
        )
        .await;
    assert_eq!(reply.status, 200, "{}", text(&reply));
    assert_eq!(json_of(&reply)["state"]["ended"]["reason"], "withdrawn");
    let inbox = bob.read(&env, "/api/notification-center/inbox").await;
    assert_eq!(inbox["items"], json!([]), "{inbox}");
    let reply = bob
        .post(
            &env,
            &format!("/api/chess/games/{withdrawn}/accept"),
            json!({}),
        )
        .await;
    assert_eq!(reply.status, 409, "{}", text(&reply));
    // Neither ever reached Bob's list: only an accepted game does.
    let mine = bob.read(&env, "/api/chess/mine").await;
    assert_eq!(mine, json!({ "games": [], "invitations": [] }), "{mine}");
    let mine = ada.read(&env, "/api/chess/mine").await;
    assert_eq!(mine["games"].as_array().unwrap().len(), 2, "{mine}");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_full_set_of_waiting_invitations_refuses_another_rather_than_lose_one() {
    let env = boot(false).await;
    let mut bob = sign_up(&env, "bob", "Bob Kahn").await;
    let mut senders = Vec::new();
    for name in ["ada", "carl", "dana", "erin", "fay"] {
        senders.push(sign_up(&env, name, &name.to_uppercase()).await);
    }
    let refused =
        |reply: &IngressReply| reply.status == 409 && text(reply).contains("too many invitations");
    // One person may have three waiting with Bob.
    let mut ada_games = Vec::new();
    for n in 0..3 {
        ada_games.push(
            invite(&env, &mut senders[0], "bob", &format!("ada-{n}"))
                .await
                .0,
        );
    }
    let fourth = senders[0]
        .post_keyed(
            &env,
            "/api/chess/invitations",
            json!({ "to": "bob" }),
            "ada-3",
        )
        .await;
    assert!(refused(&fourth), "{}", text(&fourth));
    // Twelve in all: three more people fill the set, and the fifth is refused.
    for (who, sender) in senders.iter_mut().enumerate().skip(1).take(3) {
        for n in 0..3 {
            invite(&env, sender, "bob", &format!("p{who}-{n}")).await;
        }
    }
    let past = senders[4]
        .post_keyed(
            &env,
            "/api/chess/invitations",
            json!({ "to": "bob" }),
            "fay-0",
        )
        .await;
    assert!(refused(&past), "{}", text(&past));
    let mine = bob.read(&env, "/api/chess/mine").await;
    assert_eq!(mine["invitations"].as_array().unwrap().len(), 12);
    // Once Bob answers one, there is room again.
    let reply = bob
        .post(
            &env,
            &format!("/api/chess/games/{}/decline", ada_games[0]),
            json!({}),
        )
        .await;
    assert_eq!(reply.status, 200);
    invite(&env, &mut senders[4], "bob", "fay-1").await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn nobody_else_s_invitations_push_a_game_off_a_person_s_list() {
    let env = boot(false).await;
    let mut bob = sign_up(&env, "bob", "Bob Kahn").await;
    let mut eve = sign_up(&env, "eve", "Eve Moneypenny").await;
    let reply = bob
        .post(
            &env,
            "/api/chess/games",
            json!({ "computer": { "side": "black", "level": 1 } }),
        )
        .await;
    assert_eq!(reply.status, 201, "{}", text(&reply));
    let kept = json_of(&reply)["id"].as_str().unwrap().to_string();
    // Eve invites Bob and withdraws, again and again.
    for n in 0..30 {
        let (game, _) = invite(&env, &mut eve, "bob", &format!("flood-{n}")).await;
        let reply = eve
            .post(&env, &format!("/api/chess/games/{game}/decline"), json!({}))
            .await;
        assert_eq!(reply.status, 200, "{}", text(&reply));
    }
    let mine = bob.read(&env, "/api/chess/mine").await;
    assert_eq!(mine["games"].as_array().unwrap().len(), 1, "{mine}");
    assert_eq!(mine["games"][0]["id"], kept.as_str());
    assert_eq!(mine["invitations"], json!([]));
    assert_eq!(
        bob.get(&env, &format!("/api/chess/games/{kept}"))
            .await
            .status,
        200
    );
    // Bob's own space holds his one game and an empty set of invitations.
    let bob_author = author(&env, &mut bob).await;
    let prefix = format!("apps/chess/users/{bob_author}");
    let (rows, _) = env
        .store("data")
        .scan_prefix(prefix.as_bytes(), None, 64)
        .await
        .unwrap();
    let games = rows
        .iter()
        .filter(|(key, _, _)| String::from_utf8_lossy(key).contains("/games/"))
        .count();
    assert_eq!(games, 1);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn games_of_one_s_own_need_an_account_and_a_guest_cannot_invite() {
    let env = boot(false).await;
    let _bob = sign_up(&env, "bob", "Bob Kahn").await;
    let mut anonymous = Browser { token: None };
    let reply = anonymous
        .post(
            &env,
            "/api/chess/games",
            json!({ "computer": { "side": "black", "level": 1 } }),
        )
        .await;
    assert_eq!(reply.status, 403, "{}", text(&reply));
    let reply = anonymous
        .post(&env, "/api/chess/invitations", json!({ "to": "bob" }))
        .await;
    assert_eq!(reply.status, 403, "{}", text(&reply));
    let mut guest = Browser { token: None };
    let reply = guest.post(&env, "/api/session/guest", json!({})).await;
    assert!(reply.status < 300, "a guest signs in: {}", text(&reply));
    let reply = guest
        .post(&env, "/api/chess/invitations", json!({ "to": "bob" }))
        .await;
    assert_eq!(reply.status, 403, "{}", text(&reply));
    let reply = guest
        .post(
            &env,
            "/api/chess/games",
            json!({ "computer": { "side": "black", "level": 1 } }),
        )
        .await;
    assert_eq!(
        reply.status,
        201,
        "a guest plays the computer: {}",
        text(&reply)
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn the_computer_s_moves_come_from_its_owner_s_page_and_nobody_else_sees_the_game() {
    let env = boot(false).await;
    let mut ada = sign_up(&env, "ada", "Ada Lovelace").await;
    let mut bob = sign_up(&env, "bob", "Bob Kahn").await;
    let reply = ada
        .post_keyed(
            &env,
            "/api/chess/games",
            json!({ "computer": { "side": "black", "level": 2 } }),
            "computer-1",
        )
        .await;
    assert_eq!(reply.status, 201, "{}", text(&reply));
    let body = json_of(&reply);
    let game = body["id"].as_str().unwrap().to_string();
    assert_eq!(body["state"]["black_name"], "Computer (level 2)");
    assert_eq!(body["state"]["white_name"], "Ada Lovelace");
    let again = ada
        .post_keyed(
            &env,
            "/api/chess/games",
            json!({ "computer": { "side": "black", "level": 2 } }),
            "computer-1",
        )
        .await;
    assert_eq!(again.status, 200, "a resend: {}", text(&again));
    assert_eq!(json_of(&again)["id"], game.as_str());
    // Ada moves for both sides.
    assert_eq!(ply(&env, &mut ada, &game, 0, "e2", "e4").await.status, 201);
    assert_eq!(ply(&env, &mut ada, &game, 1, "e7", "e5").await.status, 201);
    // Bob reaches nothing of it.
    assert_eq!(
        bob.get(&env, &format!("/api/chess/games/{game}"))
            .await
            .status,
        404
    );
    assert_eq!(ply(&env, &mut bob, &game, 2, "g1", "f3").await.status, 404);
    assert_eq!(
        bob.read(&env, "/api/chess/mine").await,
        json!({ "games": [], "invitations": [] })
    );
    let mine = ada.read(&env, "/api/chess/mine").await;
    assert_eq!(mine["games"][0]["status"], "playing", "{mine}");
    assert_eq!(mine["games"][0]["side"], "white");

    // A stranger, a wrong turn, too far back, an older game and a late resend each change nothing.
    let url = format!("/api/chess/games/{game}/takeback");
    let read_back = |reply: &Value| reply["version"].as_u64().unwrap();
    let back = |to: usize, at: u64| json!({ "number": 1, "to": to, "version": at });
    let seen = json_of(&ply(&env, &mut ada, &game, 2, "g1", "f3").await);
    let at = read_back(&seen);
    assert_eq!(bob.post(&env, &url, back(2, at)).await.status, 404);
    assert_eq!(
        ada.post(&env, &url, back(1, at)).await.status,
        409,
        "Black's turn"
    );
    let seen = json_of(&ply(&env, &mut ada, &game, 3, "b8", "c6").await);
    let at = read_back(&seen);
    assert_eq!(
        ada.post(&env, &url, back(0, at)).await.status,
        409,
        "too far"
    );
    assert_eq!(
        ada.post(&env, &url, back(2, at - 1)).await.status,
        409,
        "an older game"
    );
    let taken = ada.post(&env, &url, back(2, at)).await;
    assert_eq!(taken.status, 200, "{}", text(&taken));
    assert_eq!(
        json_of(&taken)["state"]["plies"].as_array().unwrap().len(),
        2
    );
    let resent = ada.post(&env, &url, back(2, at)).await;
    assert_eq!(resent.status, 200, "{}", text(&resent));
    assert_eq!(json_of(&resent)["version"], json_of(&taken)["version"]);
    assert_eq!(ply(&env, &mut ada, &game, 2, "b1", "c3").await.status, 201);
    let seen = json_of(&ply(&env, &mut ada, &game, 3, "g8", "f6").await);
    assert_eq!(
        ada.post(&env, &url, back(2, at)).await.status,
        409,
        "a late resend"
    );
    let kept = ada.read(&env, &format!("/api/chess/games/{game}")).await;
    assert_eq!(kept["state"]["plies"].as_array().unwrap().len(), 4);
    assert_eq!(kept["version"], seen["version"]);
    assert_eq!(
        ada.post(&env, &format!("/api/chess/games/{game}/resign"), json!({}))
            .await
            .status,
        200
    );
    let ended = ada.read(&env, &format!("/api/chess/games/{game}")).await;
    assert_eq!(
        ada.post(&env, &url, back(2, read_back(&ended)))
            .await
            .status,
        409,
        "a resigned game"
    );

    // Removed: off the list and gone. A resend changes nothing, and a stranger reaches nothing.
    let remove = format!("/api/chess/games/{game}/remove");
    assert_eq!(bob.post(&env, &remove, json!({})).await.status, 200);
    assert_eq!(
        ada.get(&env, &format!("/api/chess/games/{game}"))
            .await
            .status,
        200,
        "a stranger removed nothing"
    );
    assert_eq!(ada.post(&env, &remove, json!({})).await.status, 200);
    assert_eq!(ada.post(&env, &remove, json!({})).await.status, 200);
    assert_eq!(ada.read(&env, "/api/chess/mine").await["games"], json!([]));
    assert_eq!(
        ada.get(&env, &format!("/api/chess/games/{game}"))
            .await
            .status,
        404
    );
    for level in [0, 5] {
        let reply = ada
            .post(
                &env,
                "/api/chess/games",
                json!({ "computer": { "side": "white", "level": level } }),
            )
            .await;
        assert_eq!(reply.status, 400, "level {level}: {}", text(&reply));
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_game_that_cannot_be_read_can_be_removed_from_the_list() {
    let env = boot(false).await;
    let mut ada = sign_up(&env, "ada", "Ada Lovelace").await;
    let reply = ada
        .post(
            &env,
            "/api/chess/games",
            json!({ "computer": { "side": "black", "level": 1 } }),
        )
        .await;
    let game = json_of(&reply)["id"].as_str().unwrap().to_string();
    let key = format!("apps/chess/shared/games/{game}");
    env.store("data")
        .put(key.as_bytes(), b"{broken")
        .await
        .unwrap();
    let remove = format!("/api/chess/games/{game}/remove");
    assert_eq!(ada.post(&env, &remove, json!({})).await.status, 200);
    assert_eq!(ada.read(&env, "/api/chess/mine").await["games"], json!([]));
    assert_eq!(env.store("data").get(key.as_bytes()).await.unwrap(), None);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_game_that_cannot_be_read_is_taken_off_the_list_or_started_again() {
    let env = boot(false).await;
    let mut ada = sign_up(&env, "ada", "Ada Lovelace").await;
    let reply = ada
        .post(
            &env,
            "/api/chess/games",
            json!({ "computer": { "side": "black", "level": 1 } }),
        )
        .await;
    let game = json_of(&reply)["id"].as_str().unwrap().to_string();
    let reply = ada
        .post(&env, &format!("/api/chess/games/{game}/reset"), json!({}))
        .await;
    assert_eq!(
        reply.status,
        409,
        "a game that reads is left alone: {}",
        text(&reply)
    );
    env.store("data")
        .put(
            format!("apps/chess/shared/games/{game}").as_bytes(),
            b"{broken",
        )
        .await
        .unwrap();
    let mine = ada.read(&env, "/api/chess/mine").await;
    assert_eq!(
        mine["games"][0],
        json!({ "id": game, "status": "unreadable" })
    );
    let reply = ada
        .post(&env, &format!("/api/chess/games/{game}/reset"), json!({}))
        .await;
    assert_eq!(reply.status, 200, "{}", text(&reply));
    assert_eq!(ada.read(&env, "/api/chess/mine").await["games"], json!([]));
    // A game against the computer goes with its line; a resend of the reset
    // finds nothing of Ada's, and never makes the id an open board.
    let stored = env
        .store("data")
        .get(format!("apps/chess/shared/games/{game}").as_bytes())
        .await
        .unwrap();
    assert_eq!(stored, None);
    let again = ada
        .post(&env, &format!("/api/chess/games/{game}/reset"), json!({}))
        .await;
    assert_eq!(again.status, 404, "{}", text(&again));
    // An unreadable game made here that is not on the caller's list is left
    // as it is.
    let theirs = "fedcba9876543210fedcba9876543210";
    env.store("data")
        .put(
            format!("apps/chess/shared/games/{theirs}").as_bytes(),
            b"{broken",
        )
        .await
        .unwrap();
    let reply = ada
        .post(&env, &format!("/api/chess/games/{theirs}/reset"), json!({}))
        .await;
    assert_eq!(reply.status, 404, "{}", text(&reply));
    let stored = env
        .store("data")
        .get(format!("apps/chess/shared/games/{theirs}").as_bytes())
        .await
        .unwrap();
    assert_eq!(stored.as_deref(), Some(&b"{broken"[..]));

    // An open board that cannot be read starts again at its first game.
    env.store("data")
        .put(b"apps/chess/shared/games/board-1", b"{broken")
        .await
        .unwrap();
    assert_eq!(ada.get(&env, "/api/chess/games/board-1").await.status, 409);
    let reply = ada
        .post(&env, "/api/chess/games/board-1/reset", json!({}))
        .await;
    assert_eq!(reply.status, 201, "{}", text(&reply));
    let board = ada.read(&env, "/api/chess/games/board-1").await;
    assert_eq!(board["state"]["plies"], json!([]));
    assert_eq!(
        ply(&env, &mut ada, "board-1", 0, "e2", "e4").await.status,
        201
    );
}

// ── FaceTime ──

const SECOND: u64 = 1_000;
const PAGE_ADA: &str = "page-ada-00000001";
const PAGE_BOB: &str = "page-bob-00000001";
const PAGE_BOB_AGAIN: &str = "page-bob-00000002";

/// Ada's page calls `to` with its own idempotency key: the call's id and the
/// reply's body.
async fn place(
    env: &TestEnv,
    from: &mut Browser,
    to: &str,
    kind: &str,
    key: &str,
) -> (String, Value) {
    let reply = from
        .post_keyed(
            env,
            "/api/facetime/calls",
            json!({ "to": to, "kind": kind, "page": PAGE_ADA }),
            key,
        )
        .await;
    assert_eq!(reply.status, 201, "{}", text(&reply));
    let body = json_of(&reply);
    (body["state"]["id"].as_str().unwrap().to_string(), body)
}

fn member<'a>(call: &'a Value, name: &str) -> &'a Value {
    call["members"]
        .as_array()
        .unwrap()
        .iter()
        .find(|m| m["name"] == name)
        .unwrap_or_else(|| panic!("{name} is not in {call}"))
}

async fn act(
    env: &TestEnv,
    browser: &mut Browser,
    id: &str,
    action: &str,
    body: Value,
) -> IngressReply {
    browser
        .post(env, &format!("/api/facetime/calls/{id}/{action}"), body)
        .await
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn two_accounts_ring_answer_connect_and_hang_up() {
    let env = boot(false).await;
    let mut ada = sign_up(&env, "ada", "Ada Lovelace").await;
    let mut bob = sign_up(&env, "bob", "Bob Kahn").await;
    let mut eve = sign_up(&env, "eve", "Eve Moneypenny").await;
    let (id, placed) = place(&env, &mut ada, "bob", "video", "call-1").await;
    assert_eq!(id.len(), 32);
    assert_eq!(member(&placed["state"], "ada")["seat"]["n"], 1);
    assert_eq!(member(&placed["state"], "ada")["seat"]["page"], PAGE_ADA);
    assert_eq!(member(&placed["state"], "bob")["state"], "ringing");
    assert!(
        !placed.to_string().contains("u-"),
        "no account ids: {placed}"
    );

    // It rings for Bob: in his calls and as an alert.
    let calls = bob.read(&env, "/api/facetime/calls").await;
    assert_eq!(calls["incoming"]["state"]["id"], id.as_str(), "{calls}");
    assert_eq!(calls["active"], Value::Null);
    assert_eq!(calls["recents"][0]["status"], "incoming");
    assert_eq!(calls["recents"][0]["with"]["full_name"], "Ada Lovelace");
    let inbox = bob.read(&env, "/api/notification-center/inbox").await;
    assert_eq!(inbox["items"][0]["app"], "facetime", "{inbox}");
    assert_eq!(inbox["items"][0]["alert"], true);

    // Eve reaches nothing of it.
    assert_eq!(
        eve.get(&env, &format!("/api/facetime/calls/{id}"))
            .await
            .status,
        404
    );
    for (action, body) in [
        ("join", json!({ "page": "page-eve-00000001" })),
        ("decline", json!({})),
        ("leave", json!({ "seat": 1 })),
        (
            "signal",
            json!({ "from": 1, "to": 2, "offer": "x", "revision": 1 }),
        ),
    ] {
        let reply = act(&env, &mut eve, &id, action, body).await;
        assert_eq!(reply.status, 404, "Eve's {action}: {}", text(&reply));
    }
    let calls = eve.read(&env, "/api/facetime/calls").await;
    assert_eq!(calls["recents"], json!([]));
    assert_eq!(calls["incoming"], Value::Null);

    // Bob answers: he takes seat 2, and the call is connected.
    let ada_author = author(&env, &mut ada).await;
    let before = changes(&env, &ada_author, "facetime").await;
    let reply = act(&env, &mut bob, &id, "join", json!({ "page": PAGE_BOB })).await;
    assert_eq!(reply.status, 200, "{}", text(&reply));
    let state = &json_of(&reply)["state"];
    assert_eq!(member(state, "bob")["seat"]["n"], 2);
    assert_ne!(state["connected_ms"], 0);
    assert!(changes(&env, &ada_author, "facetime").await > before);
    let inbox = bob.read(&env, "/api/notification-center/inbox").await;
    assert_eq!(inbox["items"], json!([]), "answered: the alert goes");

    // The later seat offers, the earlier answers.
    let reply = act(
        &env,
        &mut bob,
        &id,
        "signal",
        json!({ "from": 2, "to": 1, "offer": "v=0 bob", "revision": 1 }),
    )
    .await;
    assert_eq!(reply.status, 200, "{}", text(&reply));
    let seen = ada
        .read(&env, &format!("/api/facetime/calls/{id}?seat=1"))
        .await;
    assert_eq!(seen["state"]["link"]["offer"], "v=0 bob");
    let generation = seen["state"]["link"]["generation"].as_u64().unwrap();
    let reply = act(
        &env,
        &mut ada,
        &id,
        "signal",
        json!({ "from": 1, "to": 2, "answer": "v=0 ada", "generation": generation }),
    )
    .await;
    assert_eq!(reply.status, 200, "{}", text(&reply));
    let seen = bob
        .read(&env, &format!("/api/facetime/calls/{id}?seat=2"))
        .await;
    assert_eq!(seen["state"]["link"]["answer"], "v=0 ada");
    let calls = ada.read(&env, "/api/facetime/calls").await;
    assert_eq!(calls["active"]["state"]["id"], id.as_str());
    assert_eq!(
        calls["active"]["state"]["link"],
        Value::Null,
        "the list carries no descriptions"
    );

    // Ada hangs up from her seat: the call ends for both.
    let reply = act(&env, &mut ada, &id, "leave", json!({ "seat": 1 })).await;
    assert_eq!(reply.status, 200, "{}", text(&reply));
    assert_ne!(json_of(&reply)["state"]["ended_ms"], 0);
    assert_eq!(json_of(&reply)["state"]["link"], Value::Null);
    for (browser, status) in [(&mut ada, "outgoing"), (&mut bob, "incoming")] {
        let calls = browser.read(&env, "/api/facetime/calls").await;
        assert_eq!(calls["active"], Value::Null);
        assert_eq!(calls["recents"][0]["status"], status, "{calls}");
        assert_eq!(calls["recents"][0]["done"], true);
    }
    // A leave sent again changes nothing.
    let reply = act(&env, &mut ada, &id, "leave", json!({ "seat": 1 })).await;
    assert_eq!(reply.status, 200);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_reload_or_a_second_tab_takes_the_seat_and_a_ghost_leave_ends_nothing() {
    let env = boot(false).await;
    let mut ada = sign_up(&env, "ada", "Ada Lovelace").await;
    let mut bob = sign_up(&env, "bob", "Bob Kahn").await;
    let (id, _) = place(&env, &mut ada, "bob", "audio", "call-1").await;
    let join = |page: &str| json!({ "page": page });
    let seat = |reply: &IngressReply| member(&json_of(reply)["state"], "bob")["seat"]["n"].clone();
    let first = act(&env, &mut bob, &id, "join", join(PAGE_BOB)).await;
    assert_eq!(seat(&first), 2);
    // The same page's join again (a resend, or the request delivered twice):
    // the same seat.
    let again = act(&env, &mut bob, &id, "join", join(PAGE_BOB)).await;
    assert_eq!(seat(&again), 2);
    // Another page (a reload, a second tab) takes a new seat.
    let reload = act(&env, &mut bob, &id, "join", join(PAGE_BOB_AGAIN)).await;
    assert_eq!(seat(&reload), 3);
    assert_eq!(
        member(&json_of(&reload)["state"], "bob")["seat"]["page"],
        PAGE_BOB_AGAIN
    );
    // The old page's hang-up, arriving late, ends nothing.
    let ghost = act(&env, &mut bob, &id, "leave", json!({ "seat": 2 })).await;
    assert_eq!(ghost.status, 200, "{}", text(&ghost));
    assert_eq!(json_of(&ghost)["state"]["ended_ms"], 0);
    assert_eq!(member(&json_of(&ghost)["state"], "bob")["state"], "joined");
    // Nor does it speak for the new seat.
    let signal = act(
        &env,
        &mut bob,
        &id,
        "signal",
        json!({ "from": 2, "to": 1, "offer": "old", "revision": 9 }),
    )
    .await;
    assert_eq!(signal.status, 409, "{}", text(&signal));
    let signal = act(
        &env,
        &mut bob,
        &id,
        "signal",
        json!({ "from": 3, "to": 1, "offer": "new", "revision": 1 }),
    )
    .await;
    assert_eq!(signal.status, 200, "{}", text(&signal));
    // A description larger than 64 KiB is refused.
    let big = "x".repeat(64 * 1024 + 1);
    let signal = act(
        &env,
        &mut bob,
        &id,
        "signal",
        json!({ "from": 3, "to": 1, "offer": big, "revision": 2 }),
    )
    .await;
    assert_eq!(signal.status, 400);
    let left = act(&env, &mut bob, &id, "leave", json!({ "seat": 3 })).await;
    assert_ne!(json_of(&left)["state"]["ended_ms"], 0);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_call_nobody_answers_is_missed_and_one_whose_page_closed_ends() {
    let env = boot(true).await;
    let mut ada = sign_up(&env, "ada", "Ada Lovelace").await;
    let mut bob = sign_up(&env, "bob", "Bob Kahn").await;
    let (id, _) = place(&env, &mut ada, "bob", "audio", "call-1").await;
    crate::support::advance(&env, 46 * SECOND).await;
    let calls = bob.read(&env, "/api/facetime/calls").await;
    assert_eq!(calls["incoming"], Value::Null, "{calls}");
    assert_eq!(calls["recents"][0]["call"], id.as_str());
    assert_eq!(calls["recents"][0]["status"], "missed");
    assert_eq!(calls["recents"][0]["done"], true);
    let inbox = bob.read(&env, "/api/notification-center/inbox").await;
    assert_eq!(
        inbox["items"].as_array().map(Vec::len),
        Some(1),
        "the ringing stops, and one notice of the missed call stays: {inbox}"
    );
    assert_eq!(inbox["items"][0]["body"], "Missed FaceTime Audio");
    let ours = ada.read(&env, "/api/facetime/calls").await;
    assert_eq!(ours["recents"][0]["status"], "outgoing", "{ours}");

    // Bob answers the next call, then Ada's tab closes without hanging up:
    // her seat is not heard from, and the call ends.
    let (id, _) = place(&env, &mut ada, "bob", "video", "call-2").await;
    let reply = act(&env, &mut bob, &id, "join", json!({ "page": PAGE_BOB })).await;
    assert_eq!(reply.status, 200);
    for _ in 0..2 {
        crate::support::advance(&env, 10 * SECOND).await;
        let seen = bob
            .read(&env, &format!("/api/facetime/calls/{id}?seat=2"))
            .await;
        assert_eq!(seen["state"]["ended_ms"], 0, "{seen}");
        assert_eq!(member(&seen["state"], "bob")["state"], "joined", "{seen}");
    }
    crate::support::advance(&env, 10 * SECOND).await;
    let seen = bob
        .read(&env, &format!("/api/facetime/calls/{id}?seat=2"))
        .await;
    assert_ne!(seen["state"]["ended_ms"], 0, "{seen}");
    assert_eq!(member(&seen["state"], "ada")["state"], "left");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn one_call_at_a_time_a_resend_is_the_first_and_history_keeps_a_call_in_progress() {
    let env = boot(false).await;
    let mut ada = sign_up(&env, "ada", "Ada Lovelace").await;
    let mut bob = sign_up(&env, "bob", "Bob Kahn").await;
    let _carl = sign_up(&env, "carl", "Carl Sagan").await;
    let (id, _) = place(&env, &mut ada, "bob", "video", "same-key").await;
    let again = ada
        .post_keyed(
            &env,
            "/api/facetime/calls",
            json!({ "to": "bob", "kind": "video", "page": PAGE_ADA }),
            "same-key",
        )
        .await;
    assert_eq!(again.status, 200, "{}", text(&again));
    assert_eq!(json_of(&again)["state"]["id"], id.as_str());
    let calls = bob.read(&env, "/api/facetime/calls").await;
    assert_eq!(
        calls["recents"].as_array().unwrap().len(),
        1,
        "rung once: {calls}"
    );
    // The same key naming someone else is refused, and rings nobody.
    let other = ada
        .post_keyed(
            &env,
            "/api/facetime/calls",
            json!({ "to": "carl", "kind": "video", "page": PAGE_ADA }),
            "same-key",
        )
        .await;
    assert_eq!(other.status, 409, "{}", text(&other));
    // A new call while Ada holds a seat in this one is refused, with it.
    let busy = ada
        .post_keyed(
            &env,
            "/api/facetime/calls",
            json!({ "to": "carl", "kind": "audio", "page": PAGE_ADA }),
            "another-key",
        )
        .await;
    assert_eq!(busy.status, 409, "{}", text(&busy));
    assert_eq!(json_of(&busy)["state"]["id"], id.as_str());
    // Clearing the history keeps the call in progress.
    let cleared = ada
        .send(&env, "DELETE", "/api/facetime/calls", None, None)
        .await;
    assert_eq!(cleared.status, 200);
    let calls = ada.read(&env, "/api/facetime/calls").await;
    assert_eq!(calls["recents"][0]["call"], id.as_str(), "{calls}");
    let one = ada
        .send(
            &env,
            "DELETE",
            &format!("/api/facetime/calls/{id}"),
            None,
            None,
        )
        .await;
    assert_eq!(one.status, 409);
    // Bob declines: the call ends, and both histories can be cleared.
    let declined = act(&env, &mut bob, &id, "decline", json!({})).await;
    assert_eq!(declined.status, 200, "{}", text(&declined));
    assert_ne!(json_of(&declined)["state"]["ended_ms"], 0);
    let calls = bob.read(&env, "/api/facetime/calls").await;
    assert_eq!(calls["recents"][0]["status"], "missed", "{calls}");
    for browser in [&mut ada, &mut bob] {
        let cleared = browser
            .send(&env, "DELETE", "/api/facetime/calls", None, None)
            .await;
        assert_eq!(cleared.status, 200);
        assert_eq!(
            browser.read(&env, "/api/facetime/calls").await["recents"],
            json!([])
        );
    }
    // And Ada may call again.
    place(&env, &mut ada, "carl", "audio", "third-key").await;
    // Nobody unknown, and not oneself.
    for (to, status) in [("nobody", 404), ("ada", 400)] {
        let reply = ada
            .post(
                &env,
                "/api/facetime/calls",
                json!({ "to": to, "kind": "audio", "page": PAGE_ADA }),
            )
            .await;
        assert_eq!(reply.status, status, "{to}: {}", text(&reply));
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_join_delivered_again_or_the_caller_s_own_join_takes_nothing_from_the_call() {
    let env = boot(false).await;
    let mut ada = sign_up(&env, "ada", "Ada Lovelace").await;
    let mut bob = sign_up(&env, "bob", "Bob Kahn").await;
    let (id, _) = place(&env, &mut ada, "bob", "video", "call-1").await;
    // Ada takes her own ringing call up again in another tab: Bob's alert stays.
    let reply = ada
        .post_keyed(
            &env,
            &format!("/api/facetime/calls/{id}/join"),
            json!({ "page": "page-ada-00000002" }),
            "ada-join-1",
        )
        .await;
    assert_eq!(reply.status, 200, "{}", text(&reply));
    let inbox = bob.read(&env, "/api/notification-center/inbox").await;
    assert_eq!(inbox["items"].as_array().unwrap().len(), 1, "{inbox}");
    // Bob answers from one tab, then from another.
    let path = format!("/api/facetime/calls/{id}/join");
    let first = bob
        .post_keyed(&env, &path, json!({ "page": PAGE_BOB }), "bob-join-1")
        .await;
    assert_eq!(member(&json_of(&first)["state"], "bob")["seat"]["n"], 3);
    let second = bob
        .post_keyed(&env, &path, json!({ "page": PAGE_BOB_AGAIN }), "bob-join-2")
        .await;
    assert_eq!(member(&json_of(&second)["state"], "bob")["seat"]["n"], 4);
    // The first tab's join, delivered again, leaves the second tab its seat.
    let again = bob
        .post_keyed(&env, &path, json!({ "page": PAGE_BOB }), "bob-join-1")
        .await;
    assert_eq!(again.status, 200, "{}", text(&again));
    assert_eq!(member(&json_of(&again)["state"], "bob")["seat"]["n"], 4);
    assert_eq!(
        member(&json_of(&again)["state"], "bob")["seat"]["page"],
        PAGE_BOB_AGAIN
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_person_in_a_call_cannot_answer_another() {
    let env = boot(false).await;
    let mut ada = sign_up(&env, "ada", "Ada Lovelace").await;
    let mut bob = sign_up(&env, "bob", "Bob Kahn").await;
    let mut carl = sign_up(&env, "carl", "Carl Sagan").await;
    let (first, _) = place(&env, &mut ada, "bob", "audio", "call-1").await;
    let reply = act(&env, &mut bob, &first, "join", json!({ "page": PAGE_BOB })).await;
    assert_eq!(reply.status, 200);
    let (second, _) = place(&env, &mut carl, "bob", "audio", "call-2").await;
    let reply = act(&env, &mut bob, &second, "join", json!({ "page": PAGE_BOB })).await;
    assert_eq!(reply.status, 409, "{}", text(&reply));
    assert_eq!(json_of(&reply)["state"]["id"], first.as_str());
    // Bob declines the second instead; the first goes on.
    assert_eq!(
        act(&env, &mut bob, &second, "decline", json!({}))
            .await
            .status,
        200
    );
    let calls = bob.read(&env, "/api/facetime/calls").await;
    assert_eq!(calls["active"]["state"]["id"], first.as_str(), "{calls}");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn an_ended_call_goes_after_a_day_and_a_guest_s_line_is_kept_by_the_guest() {
    let env = boot(true).await;
    let mut ada = sign_up(&env, "ada", "Ada Lovelace").await;
    let mut bob = sign_up(&env, "bob", "Bob Kahn").await;
    let (id, _) = place(&env, &mut ada, "bob", "audio", "call-1").await;
    assert_eq!(
        act(&env, &mut bob, &id, "decline", json!({})).await.status,
        200
    );
    assert_eq!(
        ada.get(&env, &format!("/api/facetime/calls/{id}"))
            .await
            .status,
        200
    );
    crate::support::advance(&env, 25 * 60 * 60 * SECOND).await;
    assert_eq!(
        ada.get(&env, &format!("/api/facetime/calls/{id}"))
            .await
            .status,
        404,
        "an ended call is kept a day"
    );
    // The history keeps it.
    let calls = ada.read(&env, "/api/facetime/calls").await;
    assert_eq!(calls["recents"][0]["call"], id.as_str(), "{calls}");
    assert_eq!(calls["recents"][0]["done"], true);

    // A Guest User calls Bob, who declines: Bob's request leaves the guest's
    // line alone (it would lose the guest's expiry), and the guest's own
    // look brings it up to date.
    let mut guest = Browser { token: None };
    let reply = guest.post(&env, "/api/session/guest", json!({})).await;
    assert!(reply.status < 300, "{}", text(&reply));
    let (id, _) = place(&env, &mut guest, "bob", "audio", "guest-call").await;
    assert_eq!(
        act(&env, &mut bob, &id, "decline", json!({})).await.status,
        200
    );
    let (rows, _) = env
        .store("data")
        .scan_prefix(b"apps/facetime/users/g-", None, 16)
        .await
        .unwrap();
    let line: Value = rows
        .iter()
        .find(|(key, _, _)| String::from_utf8_lossy(key).ends_with(&id))
        .map(|(_, value, _)| serde_json::from_slice(value).unwrap())
        .expect("the guest's line");
    assert_eq!(line["done"], false, "Bob's request did not write it");
    let calls = guest.read(&env, "/api/facetime/calls").await;
    assert_eq!(calls["recents"][0]["done"], true, "{calls}");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_guest_s_game_against_the_computer_goes_when_the_guest_does() {
    let env = boot(true).await;
    let mut guest = Browser { token: None };
    let reply = guest.post(&env, "/api/session/guest", json!({})).await;
    assert!(reply.status < 300, "{}", text(&reply));
    let reply = guest
        .post(
            &env,
            "/api/chess/games",
            json!({ "computer": { "side": "black", "level": 1 } }),
        )
        .await;
    assert_eq!(reply.status, 201, "{}", text(&reply));
    let game = json_of(&reply)["id"].as_str().unwrap().to_string();
    assert!(!text(&reply).contains("expires_ms"));
    assert_eq!(
        ply(&env, &mut guest, &game, 0, "e2", "e4").await.status,
        201
    );
    let key = format!("apps/chess/shared/games/{game}");
    assert!(env
        .store("data")
        .get(key.as_bytes())
        .await
        .unwrap()
        .is_some());
    crate::support::advance(&env, 25 * 60 * 60 * SECOND).await;
    assert_eq!(
        env.store("data").get(key.as_bytes()).await.unwrap(),
        None,
        "the game outlived the guest"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn one_caller_rings_the_same_person_at_most_ten_times_an_hour() {
    let env = boot(true).await;
    let mut ada = sign_up(&env, "ada", "Ada Lovelace").await;
    let mut bob = sign_up(&env, "bob", "Bob Kahn").await;
    let _carl = sign_up(&env, "carl", "Carl Sagan").await;
    for n in 0..10 {
        let (id, _) = place(&env, &mut ada, "bob", "audio", &format!("spam-{n}")).await;
        let reply = act(&env, &mut ada, &id, "leave", json!({ "seat": 1 })).await;
        assert_eq!(reply.status, 200);
    }
    let refused = ada
        .post_keyed(
            &env,
            "/api/facetime/calls",
            json!({ "to": "bob", "kind": "audio", "page": PAGE_ADA }),
            "spam-10",
        )
        .await;
    assert_eq!(refused.status, 409, "{}", text(&refused));
    assert!(text(&refused).contains("10 times in the last hour"));
    // Others may still call Bob, and Ada may call others.
    place(&env, &mut ada, "carl", "audio", "carl-1").await;
    let calls = bob.read(&env, "/api/facetime/calls").await;
    assert_eq!(calls["recents"].as_array().unwrap().len(), 10);
    // An hour on, Ada may ring Bob again.
    crate::support::advance(&env, 61 * 60 * SECOND).await;
    let calls = ada.read(&env, "/api/facetime/calls").await;
    assert_eq!(
        calls["active"],
        Value::Null,
        "the call to Carl has gone stale: {calls}"
    );
    place(&env, &mut ada, "bob", "audio", "spam-11").await;
}

//! Chess's server half: open boards that any browser can join, and games
//! that belong to their players, between two desktop accounts or against the
//! computer.
//!
//! Routes:
//!
//! * `GET /api/chess/me`: `{"author": "<id>"}`, the public id this person
//!   plays under, and for a signed-in account also `name` and `full_name`.
//! * `GET /api/chess/mine`: `{"games", "invitations"}`: the person's newest
//!   [`MINE_LIMIT`] games, each summed up ([`summary`]), and the invitations
//!   among them still waiting for this person's answer.
//! * `POST /api/chess/games` with `{"computer": {"side": "black", "level":
//!   2}, "clock_minutes": 5}`: a game against the computer, whose moves the
//!   person's own page chooses (`demos/chess/chess-engine.ts`) and sends like
//!   any other. `clock_minutes` is optional, here and on an invitation.
//! * `POST /api/chess/invitations` with `{"to": "martin", "side": "white" |
//!   "black" | "random"}`: a game against another account, which starts when
//!   they accept.
//! * `POST /api/chess/games/<game>/accept` and `.../decline`: the invited
//!   person's answer; `decline` from the person who invited withdraws the
//!   invitation. `.../resign` gives up a game in progress.
//! * `POST /api/chess/games/<game>/takeback` with `{"number": n, "to": i,
//!   "version": v}` (a game against the computer, by its owner): cuts game
//!   `n`, as it stood at version `v`, back to its first `i` plies, the last
//!   one or two, so it is the person's move again. Answers `200` with
//!   `{"version", "state"}`, also for a resend, which finds the game already
//!   at `i`. A game that has changed since `v`, any other `i`, or a game that
//!   has ended away from the board answers `409` with the current state, so a
//!   late resend never cuts moves played after it.
//! * `GET /api/chess/games/<game>`: `{"version", "state"}`. A game is
//!   `{"number", "plies", "white", "black"}` and, for a game that belongs to
//!   its players, their names, `computer`, `invite`, `created_ms` and
//!   `ended`. Such a game is read only by its players: anyone else is told
//!   there is no such game (`404`).
//! * `POST /api/chess/games/<game>/plies` with `{"number": n, "ply": i,
//!   "from": "e2", "to": "e4", "promotion": "queen"}`, or `{"number",
//!   "ply", "draw": true}` for a claimed draw: adds ply `i` to game `n` and
//!   answers `201` with `{"version", "state"}`. A ply that is not the next
//!   one, or a game that is not the current one, answers `409` with the
//!   current state, so a page that fell behind catches up. A resend of a ply
//!   already added by the same person answers `200`: the ply's number makes
//!   every move its own idempotency key, so this route needs no header.
//! * `POST /api/chess/games/<game>/new` with `{"number": n}` (open boards
//!   only): replaces game `n` with game `n + 1`, at the starting position
//!   with both sides free. Once a side is held, only the two players can.
//! * `POST /api/chess/games/<game>/reset`: for a stored game the server
//!   cannot read. On the person's own list it is taken off the list; an open
//!   board starts again at the first game. A game that can be read is left
//!   alone (`409`).
//! * `POST /api/chess/games/<game>/remove`: takes the game off the person's own
//!   list, and for a game against the computer, which nobody else holds, ends
//!   it for good. A game between accounts still being played or waiting on an
//!   invitation is refused (`409`): resign or decline it first. Removing what
//!   is not on the list answers `200` too, so a resend does nothing.
//! * `POST /api/chess/games/<game>/flag`: ends a clocked game whose side to
//!   move has run out of time, as either player's page asks when its display
//!   reaches zero. Time left answers `409` with the current state.
//! * `GET /live/chess/<game>` (the stream route, `src/live.rs`): an open
//!   board, pushed on every change. The feed carries no session, so it never
//!   shows a game that belongs to its players: it sends `{"private": true}`
//!   for one.
//!
//! Who may move. On an open board the first person to move a side holds it,
//! and only they move it afterwards (`403` for anyone else). A game between
//! accounts has both seats taken when it is made, and takes moves only once
//! the invitation is accepted and until the game ends. A game against the
//! computer gives both seats to its owner, whose page moves for the computer.
//!
//! The server applies the rules of chess ([`rules`], the pages' own rules of
//! `demos/chess/chess-game.ts` ported): it replays the stored plies and adds
//! a ply only when it is a legal move, or a draw the side to move may claim,
//! in the position they reach, so every stored game is one every page can
//! replay. Every write of a game is one compare-and-set of its document.
//!
//! How the other player hears of a change. A game between accounts has no
//! public feed, so every write to it counts a change in the other player's
//! Chess (`notification_center::touched`): their personal stream, which is
//! theirs alone, tells their pages to read the game again. An invitation is
//! also a notification, with Accept and Decline, and the other player's moves
//! and how the game ended are notifications too.
//!
//! Clocks. A game may carry a clock: the time each side has left, and when
//! the running clock last started. It starts when the game is made, or when
//! an invitation is accepted. The server judges time: a ply that comes after
//! its side's time ran out ends the game instead, and `flag` ends it when the
//! pages see the time gone. A taken-back move starts the clock again without
//! giving back the time it took.
//!
//! Where things are kept: every game in the shared space (`games/<id>`; a
//! game made here gets an id of 128 random bits, given only to its players);
//! each person's list of their games in their own space (`games/<id>`), so
//! the accounts layer covers it; and the invitations waiting for a person,
//! in their own space too (`invitations`, one document). Only a person's own
//! requests put games on their list: an invitation goes on the inviter's
//! list when it is sent and on the invited person's when they accept. The
//! inviter's request touches only the invited person's `invitations`, which
//! holds at most [`INVITATION_LIMIT`] invitations waiting, [`SENDER_LIMIT`]
//! of them from any one person. A list keeps the newest [`LISTED_LIMIT`]
//! games; a game against the computer that leaves its owner's list is
//! deleted, since nobody else can reach it. Games of one's own need a
//! signed-in account, and a Guest User cannot invite.

mod rules;

use ferrite_app::serde;
use ferrite_app::serde_json;

use super::notification_center::{self, Action, Notification};
use crate::http::Response;
use crate::live::LiveFeed;
use crate::module::{ApiCtx, AppModule, HandlerFuture, Space, Storage};
use crate::session::Account;

pub const MODULE: AppModule = AppModule {
    name: "chess",
    title: "Chess",
    handle,
};

pub const FEED: LiveFeed = LiveFeed {
    app: "chess",
    key: feed_key,
    view,
};

/// The most plies one game takes (far beyond any real game).
pub const MAX_PLIES: usize = 2_000;
/// The most games `GET /mine` sums up, newest first.
pub const MINE_LIMIT: usize = 30;
/// The most games a person's list keeps: listing one more lets the oldest
/// go. Only the person's own requests put games on it.
pub const LISTED_LIMIT: usize = 200;
/// The most invitations one person may have waiting for their answer, and
/// the most of them from any one person. A new invitation past either is
/// refused; none waiting is ever pushed out.
pub const INVITATION_LIMIT: usize = 12;
pub const SENDER_LIMIT: usize = 3;
/// How long an unanswered invitation waits: after a week it no longer counts
/// against [`INVITATION_LIMIT`], and the person's next look lets it go.
pub const INVITATION_WAIT_MS: u64 = 7 * 24 * 60 * 60 * 1_000;
/// How many entries a read of a list takes: the list is pruned whenever a
/// game is put on it, so this covers it with room for writes that raced.
const LISTED_SCAN: usize = 2 * LISTED_LIMIT;
/// The invited person's own document of the invitations waiting for them.
const INVITATIONS: &str = "invitations";
/// The computer's levels.
pub const LEVELS: std::ops::RangeInclusive<u8> = 1..=4;
/// How many keyed creations a person's record remembers: a resend comes
/// within moments of its first try.
const KEYED_LIMIT: usize = 64;
const CAS_ATTEMPTS: usize = 16;
const PROMOTIONS: [&str; 4] = ["queen", "rook", "bishop", "knight"];
/// The longest clock a game may start with, in minutes.
const CLOCK_MINUTES_LIMIT: u64 = 180;

#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum Side {
    White,
    Black,
}

impl Side {
    fn of_ply(ply: usize) -> Side {
        if ply % 2 == 0 {
            Side::White
        } else {
            Side::Black
        }
    }

    fn other(self) -> Side {
        match self {
            Side::White => Side::Black,
            Side::Black => Side::White,
        }
    }

    fn name(self) -> &'static str {
        match self {
            Side::White => "White",
            Side::Black => "Black",
        }
    }
}

impl From<rules::Side> for Side {
    fn from(side: rules::Side) -> Side {
        match side {
            rules::Side::White => Side::White,
            rules::Side::Black => Side::Black,
        }
    }
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq, Default)]
#[serde(crate = "ferrite_app::serde")]
pub struct Ply {
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub from: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub to: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub promotion: Option<String>,
    /// In Crazyhouse, the kind of piece dropped on `to`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub drop: Option<String>,
    /// A claimed draw instead of a move.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub draw: bool,
    /// The person who played it.
    pub author: String,
}

/// The computer's side and level in a game against it.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Computer {
    pub side: Side,
    pub level: u8,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum Answer {
    Pending,
    Accepted,
    Declined,
    Withdrawn,
}

/// An invitation: who asked whom (account names, as the pages show them),
/// the public id of the person who asked, and the answer.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Invite {
    pub from: String,
    pub to: String,
    pub by: String,
    pub state: Answer,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum Reason {
    Resigned,
    Declined,
    Withdrawn,
    /// The side to move ran out of time.
    Time,
}

/// How a game ended away from the board.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Ending {
    pub reason: Reason,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub winner: Option<Side>,
    pub at_ms: u64,
}

fn is_zero(value: &u64) -> bool {
    *value == 0
}

fn is_regular(variant: &rules::Variant) -> bool {
    *variant == rules::Variant::Regular
}

/// The time each side has left, and when the clock of the side to move last
/// started (epoch ms; 0 while an invitation waits for its answer).
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Clock {
    /// The minutes each side started with, which a resent request must ask for again.
    #[serde(default)]
    pub minutes: u64,
    pub white_ms: u64,
    pub black_ms: u64,
    #[serde(default)]
    pub since_ms: u64,
}

impl Clock {
    fn starting(minutes: u64, since_ms: u64) -> Clock {
        let each = minutes * 60_000;
        Clock {
            minutes,
            white_ms: each,
            black_ms: each,
            since_ms,
        }
    }

    /// What `running`, whose clock is running, has left at `now_ms`.
    fn left(&self, running: Side, now_ms: u64) -> u64 {
        let had = match running {
            Side::White => self.white_ms,
            Side::Black => self.black_ms,
        };
        had.saturating_sub(now_ms.saturating_sub(self.since_ms))
    }

    /// `mover` has played at `now_ms`: its time is charged, and the other
    /// clock starts. `false`, and nothing changed, when its time had gone.
    fn charge(&mut self, mover: Side, now_ms: u64) -> bool {
        let left = self.left(mover, now_ms);
        if left == 0 {
            return false;
        }
        match mover {
            Side::White => self.white_ms = left,
            Side::Black => self.black_ms = left,
        }
        self.since_ms = now_ms;
        true
    }
}

/// The clock a request's `clock_minutes` asks for, or the error it answers.
fn clock_asked(minutes: Option<u64>, since_ms: u64) -> Result<Option<Clock>, Response> {
    match minutes {
        None => Ok(None),
        Some(minutes) if (1..=CLOCK_MINUTES_LIMIT).contains(&minutes) => {
            Ok(Some(Clock::starting(minutes, since_ms)))
        }
        Some(_) => Err(Response::error(
            400,
            "a clock runs for 1 to 180 minutes a side",
        )),
    }
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq, Default)]
#[serde(crate = "ferrite_app::serde")]
pub struct Game {
    pub number: u64,
    pub plies: Vec<Ply>,
    pub white: Option<String>,
    pub black: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub white_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub black_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub computer: Option<Computer>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub invite: Option<Invite>,
    #[serde(default, skip_serializing_if = "is_zero")]
    pub created_ms: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ended: Option<Ending>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub clock: Option<Clock>,
    #[serde(default, skip_serializing_if = "is_regular")]
    pub variant: rules::Variant,
    /// The account ids behind the two seats of a game between accounts, so
    /// the module can tell the other player of a change. Kept in the store
    /// only: [`public`] leaves them out of every reply.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub white_account: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub black_account: Option<String>,
    /// When the stored game goes by itself (epoch ms), or 0 for never: a
    /// Guest User's game against the computer goes when the guest does.
    /// Every write keeps it. Never shown ([`public`]).
    #[serde(default, skip_serializing_if = "is_zero")]
    pub expires_ms: u64,
}

impl Game {
    /// The first game of an open board.
    fn first() -> Game {
        Game {
            number: 1,
            ..Game::default()
        }
    }

    /// Whether this is an open board, where the first to move a side holds
    /// it, rather than a game that belongs to its players.
    fn open(&self) -> bool {
        self.computer.is_none() && self.invite.is_none()
    }

    fn seat(&self, side: Side) -> Option<&str> {
        match side {
            Side::White => self.white.as_deref(),
            Side::Black => self.black.as_deref(),
        }
    }

    fn seated(&self, author: &str) -> bool {
        self.white.as_deref() == Some(author) || self.black.as_deref() == Some(author)
    }

    fn name_of(&self, side: Side) -> String {
        let name = match side {
            Side::White => self.white_name.as_deref(),
            Side::Black => self.black_name.as_deref(),
        };
        name.unwrap_or(side.name()).to_string()
    }

    /// The side `author` plays (the person's side in a game against the
    /// computer), or `None`.
    fn side_of(&self, author: &str) -> Option<Side> {
        if let Some(computer) = self.computer {
            return self.seated(author).then_some(computer.side.other());
        }
        if self.white.as_deref() == Some(author) {
            Some(Side::White)
        } else if self.black.as_deref() == Some(author) {
            Some(Side::Black)
        } else {
            None
        }
    }

    /// The account of the player who is not `author`, in a game between
    /// accounts.
    fn other_account(&self, author: &str) -> Option<&str> {
        match self.side_of(author)? {
            Side::White => self.black_account.as_deref(),
            Side::Black => self.white_account.as_deref(),
        }
    }

    /// The account of the person invited.
    fn invitee_account(&self) -> Option<&str> {
        let invite = self.invite.as_ref()?;
        self.other_account(&invite.by)
    }

    fn pending(&self) -> bool {
        self.ended.is_none()
            && self
                .invite
                .as_ref()
                .is_some_and(|i| i.state == Answer::Pending)
    }

    /// Whether moves may be added: not ended away from the board, and for a
    /// game between accounts, accepted.
    fn takes_moves(&self) -> bool {
        self.ended.is_none()
            && self
                .invite
                .as_ref()
                .is_none_or(|i| i.state == Answer::Accepted)
    }
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct NewPly {
    number: u64,
    ply: usize,
    #[serde(default)]
    from: String,
    #[serde(default)]
    to: String,
    #[serde(default)]
    promotion: Option<String>,
    #[serde(default)]
    drop: Option<String>,
    #[serde(default)]
    draw: bool,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct TakeBack {
    number: u64,
    to: usize,
    version: u64,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct NewGame {
    number: u64,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct NewComputerGame {
    computer: Computer,
    #[serde(default)]
    clock_minutes: Option<u64>,
    #[serde(default)]
    variant: rules::Variant,
}

#[derive(serde::Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
enum Choice {
    White,
    Black,
    Random,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct NewInvitation {
    to: String,
    #[serde(default = "random_choice")]
    side: Choice,
    #[serde(default)]
    clock_minutes: Option<u64>,
    #[serde(default)]
    variant: rules::Variant,
}

fn random_choice() -> Choice {
    Choice::Random
}

/// One entry of a person's list of games (their own space).
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
struct Listed {
    created_ms: u64,
    /// A game against the computer: nobody else holds it.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    computer: bool,
}

/// One invitation waiting for its answer: the game, the public id of the
/// person who sent it, and when.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
struct Waiting {
    game: String,
    by: String,
    created_ms: u64,
}

/// The invitations waiting for a person (their own space, [`INVITATIONS`]):
/// one document, so a new invitation's check against the limits and its
/// arrival are one compare-and-set.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, Default, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
struct Invitations {
    waiting: Vec<Waiting>,
}

impl Invitations {
    /// Drop the invitations that have waited longer than a week.
    fn fresh(&mut self, now: u64) {
        self.waiting
            .retain(|w| w.created_ms.saturating_add(INVITATION_WAIT_MS) > now);
    }

    /// Whether one more invitation from `by` fits.
    fn room_for(&self, by: &str) -> bool {
        self.waiting.len() < INVITATION_LIMIT
            && self.waiting.iter().filter(|w| w.by == by).count() < SENDER_LIMIT
    }
}

/// Whether `game` is an id this module makes: 32 lowercase hex digits. Such
/// a game is never treated as an open board when it cannot be read.
fn made_here(game: &str) -> bool {
    game.len() == 32 && game.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
}

/// The public id a person plays under (as Messages', `author_of`): the first
/// 16 characters of the account id, or of the browser's session id before
/// anyone signs in.
pub fn author_of(principal: &str) -> String {
    principal.chars().take(16).collect()
}

/// Whether `game` is a game id: 1 to 40 lowercase letters, digits or `-`.
pub fn is_game(game: &str) -> bool {
    (1..=40).contains(&game.len())
        && game
            .bytes()
            .all(|b| matches!(b, b'a'..=b'z' | b'0'..=b'9' | b'-'))
}

fn is_square(square: &str) -> bool {
    matches!(square.as_bytes(), [b'a'..=b'h', b'1'..=b'8'])
}

fn game_key(game: &str) -> String {
    format!("games/{game}")
}

fn feed_key(rest: &str) -> Option<String> {
    is_game(rest).then(|| game_key(rest))
}

fn invalid(e: impl std::fmt::Display) -> std::io::Error {
    std::io::Error::new(std::io::ErrorKind::InvalidData, e.to_string())
}

/// The stored game: the first game while absent, an error when the stored
/// bytes are not a game (which a write must not replace).
fn decode(bytes: Option<&[u8]>) -> Result<Game, serde_json::Error> {
    bytes.map_or(Ok(Game::first()), serde_json::from_slice)
}

/// The reply for a failed read: an unreadable document is left as it is
/// and refused (409, so a page does not resend), any other failure is the
/// store's (503).
fn storage_error(e: &std::io::Error) -> Response {
    if e.kind() == std::io::ErrorKind::InvalidData {
        Response::error(409, &e.to_string())
    } else {
        Response::error(503, &e.to_string())
    }
}

fn no_such_game() -> Response {
    Response::error(404, "no game of yours has that id")
}

/// A game as pages see it: without the account ids.
pub fn public(game: &Game) -> serde_json::Value {
    let mut value = serde_json::to_value(game).unwrap_or(serde_json::Value::Null);
    if let Some(object) = value.as_object_mut() {
        object.remove("white_account");
        object.remove("black_account");
        object.remove("expires_ms");
    }
    value
}

/// The feed's view: an open board, never a game that belongs to its players.
fn view(bytes: Option<&[u8]>) -> serde_json::Value {
    match decode(bytes) {
        Ok(game) if game.open() => public(&game),
        Ok(_) => serde_json::json!({ "private": true }),
        // Not a new game: the pages say the stored game cannot be read.
        Err(_) => serde_json::json!({ "unreadable": true }),
    }
}

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    let path = cx.request.path;
    let method = cx.request.method;
    match (method, path) {
        ("GET", "/me") => return describe_me(&cx),
        ("GET", "/mine") => return mine(&mut cx).await,
        ("POST", "/games") => return new_computer_game(&mut cx).await,
        ("POST", "/invitations") => return invite(&mut cx).await,
        (_, "/me" | "/mine" | "/games" | "/invitations") => return Response::method_not_allowed(),
        _ => {}
    }
    let Some(rest) = path.strip_prefix("/games/") else {
        return Response::not_found();
    };
    let (game, action) = rest.split_once('/').unwrap_or((rest, ""));
    if !is_game(game) {
        return Response::error(400, "a game id is 1 to 40 lowercase letters, digits or '-'");
    }
    match (method, action) {
        ("GET", "") => read_game(&mut cx, game).await,
        ("POST", "plies") => add_ply(&mut cx, game).await,
        ("POST", "takeback") => take_back(&mut cx, game).await,
        ("POST", "new") => new_game(&mut cx, game).await,
        ("POST", "reset") => reset(&mut cx, game).await,
        ("POST", "remove") => remove(&mut cx, game).await,
        ("POST", "flag") => flag(&mut cx, game).await,
        ("POST", "accept" | "decline" | "resign") => settle(&mut cx, game, action).await,
        (
            _,
            "" | "plies" | "takeback" | "new" | "reset" | "remove" | "flag" | "accept" | "decline"
            | "resign",
        ) => Response::method_not_allowed(),
        _ => Response::not_found(),
    }
}

/// The game the plies make from the starting position, or `None` when the
/// rules refuse one of them.
fn replay(plies: &[Ply], variant: rules::Variant) -> Option<rules::Game> {
    let mut game = rules::Game::new(variant);
    for ply in plies {
        let played = if ply.draw {
            game.claim_draw_here()
        } else if let Some(kind) = &ply.drop {
            game.drop_here(kind, &ply.to)
        } else {
            game.play_here(&ply.from, &ply.to, ply.promotion.as_deref())
        };
        if !played {
            return None;
        }
    }
    Some(game)
}

/// Whether the game is still being played on the board (and replays).
fn on_the_board(game: &Game) -> bool {
    replay(&game.plies, game.variant).is_some_and(|p| p.outcome() == rules::Outcome::Playing)
}

fn state(status: u16, version: u64, game: &Game) -> Response {
    Response::json(
        status,
        &serde_json::json!({ "version": version, "state": public(game) }),
    )
}

async fn read(shared: &mut Space<'_>, game: &str) -> std::io::Result<(Option<u64>, Game)> {
    let stored = shared.get_versioned(&game_key(game)).await?;
    let version = stored.as_ref().map(|(_, version)| *version);
    let game = decode(stored.as_ref().map(|(bytes, _)| bytes.as_slice())).map_err(|e| {
        invalid(format!(
            "the stored game cannot be read, so it is left unchanged: {e}"
        ))
    })?;
    Ok((version, game))
}

/// Write `game` if the document is still at `version`. When it was written,
/// the game as stored now, with its version, read back so that the version a
/// page is given is the store's own; `None` when another writer got there
/// first.
async fn write(
    shared: &mut Space<'_>,
    game_id: &str,
    game: &Game,
    version: Option<u64>,
) -> Result<Option<(u64, Game)>, Response> {
    let bytes = serde_json::to_vec(game).map_err(|e| Response::error(500, &e.to_string()))?;
    let written = if game.expires_ms != 0 {
        shared
            .put_if_version_expiring(&game_key(game_id), &bytes, version, game.expires_ms)
            .await
    } else {
        shared
            .put_if_version(&game_key(game_id), &bytes, version)
            .await
    };
    match written {
        Ok(true) => match read(shared, game_id).await {
            Ok((version, stored)) => Ok(Some((version.unwrap_or(0), stored))),
            Err(e) => Err(storage_error(&e)),
        },
        Ok(false) => Ok(None),
        Err(e) => Err(Response::error(503, &e.to_string())),
    }
}

/// Count a change in `account`'s Chess, so their pages read the game again.
/// It never fails the request, whose write is made already.
async fn tell(cx: &mut ApiCtx<'_>, account: Option<&str>) {
    let Some(account) = account else { return };
    let (now, by) = (cx.now_ms, cx.session.principal.clone());
    if let Err(error) =
        notification_center::touched(cx.storage.store(), account, MODULE.name, &by, now).await
    {
        ferrite_app::tracing::warn!(%error, "the other chess player was not told of a change");
    }
}

/// Put what just happened in the game in `account`'s notifications: `what`
/// names it among the game's others, so a resend shows nothing new. It never
/// fails the request, whose write is made already.
async fn announce(
    cx: &mut ApiCtx<'_>,
    account: Option<&str>,
    game: &str,
    what: &str,
    title: String,
    body: String,
) {
    let Some(account) = account else { return };
    let note = Notification {
        app: MODULE.name.into(),
        id: format!("{game}-{what}"),
        title,
        body: Some(body),
        ..Notification::default()
    };
    let now = cx.now_ms;
    if let Err(error) = notification_center::notify(cx.storage.store(), account, now, &note).await {
        ferrite_app::tracing::warn!(%error, "a chess notification was not delivered");
    }
}

fn describe_me(cx: &ApiCtx<'_>) -> Response {
    let author = author_of(&cx.session.principal);
    match &cx.session.account {
        Some(account) => Response::json(
            200,
            &serde_json::json!({
                "author": author,
                "name": account.name,
                "full_name": account.full_name,
            }),
        ),
        None => Response::json(200, &serde_json::json!({ "author": author })),
    }
}

async fn read_game(cx: &mut ApiCtx<'_>, game: &str) -> Response {
    let author = author_of(&cx.session.principal);
    let mut shared = cx.storage.shared();
    match read(&mut shared, game).await {
        Ok((None, _)) if made_here(game) => no_such_game(),
        Ok((_, doc)) if !doc.open() && !doc.seated(&author) => no_such_game(),
        Ok((version, doc)) => state(200, version.unwrap_or(0), &doc),
        Err(e) => storage_error(&e),
    }
}

/// The keys of a person: the caller's own, or `account`'s when a request of
/// the other player delivers or withdraws an invitation, which touches only
/// that person's [`INVITATIONS`] document.
fn storage_for<'s>(cx: &'s mut ApiCtx<'_>, account: Option<&'s str>) -> Storage<'s> {
    let session = cx.session;
    match account {
        Some(account) => Storage::new(cx.storage.store(), MODULE.name, account),
        None => Storage::new(cx.storage.store(), MODULE.name, &session.principal)
            .user_data_expires(session.guest_expires_ms()),
    }
}

/// The entries of a list, newest first, as `(id, entry)`.
async fn listed(list: &mut Space<'_>) -> std::io::Result<Vec<(String, Listed)>> {
    let mut entries: Vec<(String, Listed)> = list
        .list("games/", LISTED_SCAN)
        .await?
        .into_iter()
        .filter_map(|(key, bytes)| {
            let id = key.strip_prefix("games/")?.to_string();
            let entry: Listed = serde_json::from_slice(&bytes).ok()?;
            Some((id, entry))
        })
        .collect();
    entries.sort_by(|a, b| b.1.created_ms.cmp(&a.1.created_ms).then(a.0.cmp(&b.0)));
    Ok(entries)
}

/// Which entries of a list (newest first) go: past the newest
/// [`LISTED_LIMIT`], except `keep`.
fn to_prune<'a>(entries: &'a [(String, Listed)], keep: &str) -> Vec<&'a (String, Listed)> {
    let mut kept = 0;
    entries
        .iter()
        .filter(|(id, _)| {
            if id == keep {
                return false;
            }
            kept += 1;
            kept > LISTED_LIMIT
        })
        .collect()
}

/// Put `game` on the caller's own list and let the oldest games go. A game
/// against the computer that goes is deleted with it: nobody else holds it.
/// Only a person's own requests come here, so nobody else's request can push
/// a game off their list.
async fn put_listed(cx: &mut ApiCtx<'_>, game: &str, entry: &Listed) -> std::io::Result<()> {
    let bytes = serde_json::to_vec(entry).map_err(invalid)?;
    let pruned = {
        let mut storage = storage_for(cx, None);
        let mut list = storage.user();
        list.put(&game_key(game), &bytes).await?;
        let pruned = async {
            let entries = listed(&mut list).await?;
            let mut computer = Vec::new();
            for (id, entry) in to_prune(&entries, game) {
                list.delete(&game_key(id)).await?;
                if entry.computer {
                    computer.push(id.clone());
                }
            }
            std::io::Result::Ok(computer)
        };
        pruned.await
    };
    match pruned {
        Ok(computer) => {
            let mut shared = cx.storage.shared();
            for id in computer {
                if let Err(error) = shared.delete(&game_key(&id)).await {
                    ferrite_app::tracing::warn!(%error, "a pruned computer game was not deleted");
                }
            }
        }
        Err(error) => {
            ferrite_app::tracing::warn!(%error, "the oldest chess games were not taken off a list");
        }
    }
    Ok(())
}

async fn read_invitations(space: &mut Space<'_>) -> std::io::Result<(Invitations, Option<u64>)> {
    match space.get_versioned(INVITATIONS).await? {
        Some((bytes, version)) => Ok((
            serde_json::from_slice(&bytes).map_err(invalid)?,
            Some(version),
        )),
        None => Ok((Invitations::default(), None)),
    }
}

/// Change the invitations waiting for `account` (the caller when `None`) by
/// compare-and-set; `change` answers what to return and whether to write.
async fn change_invitations<T>(
    cx: &mut ApiCtx<'_>,
    account: Option<&str>,
    change: impl Fn(&mut Invitations) -> (T, bool),
) -> std::io::Result<T> {
    let mut storage = storage_for(cx, account);
    let mut space = storage.user();
    for _ in 0..CAS_ATTEMPTS {
        let (mut invitations, version) = read_invitations(&mut space).await?;
        let (answer, write) = change(&mut invitations);
        if !write {
            return Ok(answer);
        }
        let bytes = serde_json::to_vec(&invitations).map_err(invalid)?;
        if space.put_if_version(INVITATIONS, &bytes, version).await? {
            return Ok(answer);
        }
    }
    Err(std::io::Error::other("the invitations kept changing"))
}

/// Deliver the invitation to `game` from `by`: whether it is waiting now
/// (it was already, or there was room), or `false` when the invited person
/// has as many waiting as the limits allow.
async fn deliver(
    cx: &mut ApiCtx<'_>,
    account: &str,
    game: &str,
    by: &str,
    created_ms: u64,
) -> std::io::Result<bool> {
    let now = cx.now_ms;
    change_invitations(cx, Some(account), |invitations| {
        if invitations.waiting.iter().any(|w| w.game == game) {
            return (true, false);
        }
        invitations.fresh(now);
        if !invitations.room_for(by) {
            return (false, false);
        }
        invitations.waiting.push(Waiting {
            game: game.to_string(),
            by: by.to_string(),
            created_ms,
        });
        (true, true)
    })
    .await
}

/// Take the invitation to `game` out of `account`'s (or the caller's) waiting
/// invitations.
async fn unwait(cx: &mut ApiCtx<'_>, account: Option<&str>, game: &str) -> std::io::Result<()> {
    change_invitations(cx, account, |invitations| {
        let before = invitations.waiting.len();
        invitations.waiting.retain(|w| w.game != game);
        ((), invitations.waiting.len() != before)
    })
    .await
}

/// The games a person's keyed requests made: a digest of each request's
/// `idempotency-key`, with the random id the first request got.
#[derive(serde::Serialize, serde::Deserialize, Default)]
#[serde(crate = "ferrite_app::serde")]
struct Keyed {
    entries: Vec<(String, String)>,
}

/// The id of the game a request makes: 128 random bits. A request that
/// carries the page's own `idempotency-key` gets the id the first request
/// with that key got, recorded against a digest of the key in the person's
/// own space, so a resend after a lost reply finds the game the first
/// delivery made. The id is never worked out from the key, so knowing
/// someone's key gives no one the game.
async fn new_game_id(cx: &mut ApiCtx<'_>) -> std::io::Result<String> {
    let Some(key) = cx.request.idempotency_key else {
        return crate::crypto::random_token(16);
    };
    let digest = ferrite_app::crypto::hex(&ferrite_app::crypto::sha256(
        format!("chess-game\0{key}").as_bytes(),
    ));
    let mut own = cx.storage.user();
    for _ in 0..CAS_ATTEMPTS {
        let (mut keyed, version) = match own.get_versioned("keyed-games").await? {
            Some((bytes, version)) => (
                serde_json::from_slice::<Keyed>(&bytes).map_err(invalid)?,
                Some(version),
            ),
            None => (Keyed::default(), None),
        };
        if let Some((_, id)) = keyed.entries.iter().find(|(d, _)| *d == digest) {
            return Ok(id.clone());
        }
        let id = crate::crypto::random_token(16)?;
        keyed.entries.insert(0, (digest.clone(), id.clone()));
        keyed.entries.truncate(KEYED_LIMIT);
        let bytes = serde_json::to_vec(&keyed).map_err(invalid)?;
        if own.put_if_version("keyed-games", &bytes, version).await? {
            return Ok(id);
        }
    }
    Err(std::io::Error::other("the game keys kept changing"))
}

/// Create `game` under `id`: `Ok((201, ...))` with it, or `Ok((200, ...))`
/// with the game already there when a resend of the same request made it
/// first. A game already there is that request's only when the caller is
/// seated in it and `same` holds for it; otherwise the id is refused.
async fn create_as(
    cx: &mut ApiCtx<'_>,
    id: &str,
    game: &Game,
    same: &(dyn Fn(&Game) -> bool + Sync),
) -> Result<(u16, u64, Game), Response> {
    let author = author_of(&cx.session.principal);
    let mut shared = cx.storage.shared();
    match write(&mut shared, id, game, None).await? {
        Some((version, stored)) => Ok((201, version, stored)),
        None => match read(&mut shared, id).await {
            Ok((Some(version), existing)) if existing.seated(&author) && same(&existing) => {
                Ok((200, version, existing))
            }
            Ok(_) => Err(Response::error(
                409,
                "that idempotency key made another game",
            )),
            Err(e) => Err(storage_error(&e)),
        },
    }
}

fn created(status: u16, id: &str, version: u64, game: &Game) -> Response {
    Response::json(
        status,
        &serde_json::json!({ "id": id, "version": version, "state": public(game) }),
    )
}

async fn new_computer_game(cx: &mut ApiCtx<'_>) -> Response {
    let new: NewComputerGame = match cx.request.json() {
        Ok(new) => new,
        Err(response) => return response,
    };
    if !LEVELS.contains(&new.computer.level) {
        return Response::error(400, "the computer plays at level 1 to 4");
    }
    if cx.session.account.is_none() {
        return Response::error(403, "Sign in to play games of your own.");
    }
    let author = author_of(&cx.session.principal);
    let name = cx
        .session
        .account
        .as_ref()
        .map_or_else(|| "You".to_string(), |a| a.full_name.clone());
    let now = cx.now_ms;
    let clock = match clock_asked(new.clock_minutes, now) {
        Ok(clock) => clock,
        Err(response) => return response,
    };
    let computer = format!("Computer (level {})", new.computer.level);
    let (white_name, black_name) = match new.computer.side {
        Side::White => (computer, name),
        Side::Black => (name, computer),
    };
    let game = Game {
        number: 1,
        white: Some(author.clone()),
        black: Some(author),
        white_name: Some(white_name),
        black_name: Some(black_name),
        computer: Some(new.computer),
        clock,
        variant: new.variant,
        created_ms: now,
        expires_ms: cx.session.guest_expires_ms().unwrap_or(0),
        ..Game::default()
    };
    let id = match new_game_id(cx).await {
        Ok(id) => id,
        Err(e) => return storage_error(&e),
    };
    let wanted = new.computer;
    let variant = new.variant;
    let same = move |existing: &Game| {
        existing.computer == Some(wanted)
            && existing.clock.map(|each| each.minutes) == clock.map(|each| each.minutes)
            && existing.variant == variant
    };
    let (status, version, stored) = match create_as(cx, &id, &game, &same).await {
        Ok(made) => made,
        Err(response) => return response,
    };
    let entry = Listed {
        created_ms: stored.created_ms,
        computer: true,
    };
    if let Err(e) = put_listed(cx, &id, &entry).await {
        return storage_error(&e);
    }
    created(status, &id, version, &stored)
}

async fn invite(cx: &mut ApiCtx<'_>) -> Response {
    let new: NewInvitation = match cx.request.json() {
        Ok(new) => new,
        Err(response) => return response,
    };
    let clock = match clock_asked(new.clock_minutes, 0) {
        Ok(clock) => clock,
        Err(response) => return response,
    };
    let Some(me) = cx.session.account.clone() else {
        return Response::error(403, "Sign in to invite someone to a game.");
    };
    if me.guest {
        return Response::error(
            403,
            "A Guest User cannot invite anyone. Sign in with an account of your own.",
        );
    }
    let them = match crate::accounts::lookup(cx.storage.store(), &new.to).await {
        Ok(Some(them)) => them,
        Ok(None) => {
            return Response::error(
                404,
                &format!(
                    "No one on this desktop has the account name \u{201c}{}\u{201d}.",
                    new.to.trim()
                ),
            )
        }
        Err(e) => return storage_error(&e),
    };
    if them.id == me.id {
        return Response::error(
            400,
            "Invite someone else; you can play the computer yourself.",
        );
    }
    let id = match new_game_id(cx).await {
        Ok(id) => id,
        Err(e) => return storage_error(&e),
    };
    // A resend finds the game the first request made, and only lists and
    // delivers it again (each of which a resend leaves as it is).
    let exists = match cx.storage.shared().get(&game_key(&id)).await {
        Ok(stored) => stored.is_some(),
        Err(e) => return storage_error(&e),
    };
    let now = cx.now_ms;
    let too_many = || {
        Response::error(
            409,
            &format!(
                "{} has too many invitations waiting for an answer.",
                them.full_name
            ),
        )
    };
    if !exists {
        // A full set refuses before a game is made for it.
        let by = author_of(&me.id);
        let room = match read_invitations(&mut storage_for(cx, Some(&them.id)).user()).await {
            Ok((mut invitations, _)) => {
                invitations.fresh(now);
                invitations.room_for(&by)
            }
            Err(e) => return storage_error(&e),
        };
        if !room {
            return too_many();
        }
    }
    let mine_white = match new.side {
        Choice::White => true,
        Choice::Black => false,
        Choice::Random => match crate::crypto::random_u64() {
            Ok(n) => n % 2 == 0,
            Err(e) => return storage_error(&e),
        },
    };
    let (me_author, them_author) = (author_of(&me.id), author_of(&them.id));
    let (white, black) = if mine_white {
        ((&me, &me_author), (&them, &them_author))
    } else {
        ((&them, &them_author), (&me, &me_author))
    };
    let game = Game {
        number: 1,
        white: Some(white.1.clone()),
        black: Some(black.1.clone()),
        white_name: Some(white.0.full_name.clone()),
        black_name: Some(black.0.full_name.clone()),
        white_account: Some(white.0.id.clone()),
        black_account: Some(black.0.id.clone()),
        invite: Some(Invite {
            from: me.name.clone(),
            to: them.name.clone(),
            by: me_author.clone(),
            state: Answer::Pending,
        }),
        clock,
        variant: new.variant,
        created_ms: now,
        ..Game::default()
    };
    // A resend is the same invitation only when it asks for the same game:
    // the same person, and the side it named (a side left to chance accepts
    // whichever the first request drew).
    let (side, to_account) = (new.side, them.id.clone());
    let variant = new.variant;
    let same = move |existing: &Game| {
        let sided = match side {
            Choice::White => existing.white.as_deref() == Some(me_author.as_str()),
            Choice::Black => existing.black.as_deref() == Some(me_author.as_str()),
            Choice::Random => true,
        };
        sided
            && existing.invite.is_some()
            && existing.invitee_account() == Some(to_account.as_str())
            && existing.clock.map(|each| each.minutes) == clock.map(|each| each.minutes)
            && existing.variant == variant
    };
    let (status, version, stored) = match create_as(cx, &id, &game, &same).await {
        Ok(made) => made,
        Err(response) => return response,
    };
    // The game is written first, naming whom it invites, and only then
    // delivered: an id reaches nobody the game does not seat. The delivery
    // checks the limits again in the same compare-and-set that adds it; when
    // they filled meanwhile, the game is withdrawn and the invitation refused.
    let mine = Listed {
        created_ms: stored.created_ms,
        computer: false,
    };
    if let Err(e) = put_listed(cx, &id, &mine).await {
        return storage_error(&e);
    }
    if stored.pending() {
        match deliver(cx, &them.id, &id, &author_of(&me.id), stored.created_ms).await {
            Ok(true) => ring(cx, &them, &me, &id).await,
            Ok(false) => {
                let mut shared = cx.storage.shared();
                let mut ended = stored.clone();
                if let Some(invite) = ended.invite.as_mut() {
                    invite.state = Answer::Withdrawn;
                }
                ended.ended = Some(Ending {
                    reason: Reason::Withdrawn,
                    winner: None,
                    at_ms: now,
                });
                if let Err(response) = write(&mut shared, &id, &ended, Some(version)).await {
                    return response;
                }
                return too_many();
            }
            Err(e) => return storage_error(&e),
        }
    }
    tell(cx, Some(&them.id)).await;
    created(status, &id, version, &stored)
}

/// The invitation's notification for the person invited.
async fn ring(cx: &mut ApiCtx<'_>, them: &Account, me: &Account, game: &str) {
    let note = Notification {
        app: MODULE.name.into(),
        id: game.to_string(),
        title: me.full_name.clone(),
        body: Some("invites you to a game of chess.".into()),
        actions: vec![
            Action {
                label: "Accept".into(),
                post: Some(format!("/games/{game}/accept")),
            },
            Action {
                label: "Decline".into(),
                post: Some(format!("/games/{game}/decline")),
            },
        ],
        ..Notification::default()
    };
    let now = cx.now_ms;
    if let Err(error) = notification_center::notify(cx.storage.store(), &them.id, now, &note).await
    {
        ferrite_app::tracing::warn!(%error, "a chess invitation was not notified");
    }
}

/// How a game stands, in a few words for a list, from `author`'s side.
fn summary(id: &str, game: &Game, author: &str) -> serde_json::Value {
    let outcome = replay(&game.plies, game.variant).map(|p| p.outcome());
    let (status, winner) = match (&game.ended, outcome) {
        (Some(ending), _) => ("over", ending.winner),
        (None, Some(rules::Outcome::Checkmate(side) | rules::Outcome::Won(side))) => {
            ("over", Some(Side::from(side)))
        }
        (None, Some(rules::Outcome::Draw) | None) => ("over", None),
        (None, Some(rules::Outcome::Playing)) if game.pending() => ("invited", None),
        (None, Some(rules::Outcome::Playing)) => ("playing", None),
    };
    let mine = game.side_of(author);
    let opponent = match mine {
        Some(Side::White) => game.black_name.clone(),
        Some(Side::Black) => game.white_name.clone(),
        None => None,
    };
    serde_json::json!({
        "id": id,
        "variant": game.variant,
        "opponent": opponent,
        "side": mine,
        "computer": game.computer,
        "invite": game.invite,
        "status": status,
        "winner": winner,
        "reason": game.ended.map(|e| e.reason),
        "plies": game.plies.len(),
        "turn": Side::of_ply(game.plies.len()),
        "created_ms": game.created_ms,
    })
}

async fn mine(cx: &mut ApiCtx<'_>) -> Response {
    let author = author_of(&cx.session.principal);
    let now = cx.now_ms;
    let mut entries = match listed(&mut cx.storage.user()).await {
        Ok(entries) => entries,
        Err(e) => return storage_error(&e),
    };
    entries.truncate(MINE_LIMIT);
    let mut games = Vec::new();
    for (id, _) in &entries {
        let mut shared = cx.storage.shared();
        match read(&mut shared, id).await {
            // Gone (a computer game pruned meanwhile), or not this person's.
            Ok((None, _)) => {}
            Ok((Some(_), game)) if !game.seated(&author) => {}
            Ok((Some(_), game)) => games.push(summary(id, &game, &author)),
            // A game that cannot be read is listed as such: the page offers
            // to take it off the list (`reset`).
            Err(e) if e.kind() == std::io::ErrorKind::InvalidData => {
                games.push(serde_json::json!({ "id": id, "status": "unreadable" }));
            }
            Err(e) => return storage_error(&e),
        }
    }
    // The invitations waiting for this person, newest first; those no longer
    // waiting (answered, withdrawn, gone or a week old) are let go.
    let waiting = match read_invitations(&mut cx.storage.user()).await {
        Ok((invitations, _)) => invitations.waiting,
        Err(e) if e.kind() == std::io::ErrorKind::InvalidData => Vec::new(),
        Err(e) => return storage_error(&e),
    };
    let mut invitations = Vec::new();
    let mut done = Vec::new();
    for entry in waiting.iter().rev() {
        let mut shared = cx.storage.shared();
        let fresh = entry.created_ms.saturating_add(INVITATION_WAIT_MS) > now;
        match read(&mut shared, &entry.game).await {
            Ok((Some(_), game))
                if fresh
                    && game.pending()
                    && game.seated(&author)
                    && game.invite.as_ref().is_some_and(|i| i.by != author) =>
            {
                invitations.push(summary(&entry.game, &game, &author));
            }
            Ok(_) => done.push(entry.game.clone()),
            Err(e) if e.kind() == std::io::ErrorKind::InvalidData => done.push(entry.game.clone()),
            Err(e) => return storage_error(&e),
        }
    }
    if !done.is_empty() {
        let pruned = change_invitations(cx, None, |invitations| {
            let before = invitations.waiting.len();
            invitations.waiting.retain(|w| !done.contains(&w.game));
            ((), invitations.waiting.len() != before)
        })
        .await;
        if let Err(error) = pruned {
            ferrite_app::tracing::warn!(%error, "answered chess invitations were not let go");
        }
    }
    Response::json(
        200,
        &serde_json::json!({ "games": games, "invitations": invitations }),
    )
}

/// An answer to an invitation, or a resignation.
async fn settle(cx: &mut ApiCtx<'_>, game_id: &str, action: &str) -> Response {
    let author = author_of(&cx.session.principal);
    let now = cx.now_ms;
    for _ in 0..CAS_ATTEMPTS {
        let mut shared = cx.storage.shared();
        let (version, mut game) = match read(&mut shared, game_id).await {
            Ok(read) => read,
            Err(e) => return storage_error(&e),
        };
        let current = version.unwrap_or(0);
        if version.is_none() || game.open() || !game.seated(&author) {
            return no_such_game();
        }
        let inviter = game.invite.as_ref().is_some_and(|i| i.by == author);
        match action {
            "accept" | "decline" => {
                let Some(invite) = game.invite.as_mut() else {
                    return Response::error(409, "this game was not an invitation");
                };
                let wanted = match (action, inviter) {
                    ("accept", false) => Answer::Accepted,
                    ("accept", true) => {
                        return Response::error(403, "the person you invited accepts, not you")
                    }
                    (_, false) => Answer::Declined,
                    (_, true) => Answer::Withdrawn,
                };
                if invite.state == wanted {
                    // A resend: the answer stands, and what follows it is done
                    // again, in case the first delivery stopped short of it.
                    if let Err(response) = answered(cx, &game, game_id, &author).await {
                        return response;
                    }
                    let other = game.other_account(&author).map(str::to_string);
                    tell(cx, other.as_deref()).await;
                    return state(200, current, &game);
                }
                if invite.state != Answer::Pending || game.ended.is_some() {
                    return state(409, current, &game);
                }
                invite.state = wanted;
                if wanted == Answer::Accepted {
                    if let Some(clock) = game.clock.as_mut() {
                        clock.since_ms = now;
                    }
                }
                game.ended = match wanted {
                    Answer::Declined => Some(Ending {
                        reason: Reason::Declined,
                        winner: None,
                        at_ms: now,
                    }),
                    Answer::Withdrawn => Some(Ending {
                        reason: Reason::Withdrawn,
                        winner: None,
                        at_ms: now,
                    }),
                    _ => None,
                };
            }
            _ => {
                let Some(side) = game.side_of(&author) else {
                    return no_such_game();
                };
                // A resend of a resignation that was recorded.
                if game
                    .ended
                    .is_some_and(|e| e.reason == Reason::Resigned && e.winner == Some(side.other()))
                {
                    let other = game.other_account(&author).map(str::to_string);
                    tell(cx, other.as_deref()).await;
                    return state(200, current, &game);
                }
                if !game.takes_moves() || !on_the_board(&game) {
                    return state(409, current, &game);
                }
                game.ended = Some(Ending {
                    reason: Reason::Resigned,
                    winner: Some(side.other()),
                    at_ms: now,
                });
            }
        }
        match write(&mut shared, game_id, &game, version).await {
            Ok(Some((version, stored))) => {
                if action != "resign" {
                    if let Err(response) = answered(cx, &stored, game_id, &author).await {
                        return response;
                    }
                }
                let other = stored.other_account(&author).map(str::to_string);
                tell(cx, other.as_deref()).await;
                if action == "resign" {
                    if let Some(side) = stored.side_of(&author) {
                        let (title, body) =
                            (stored.name_of(side), "resigned. You win.".to_string());
                        announce(cx, other.as_deref(), game_id, "end", title, body).await;
                    }
                }
                return state(200, version, &stored);
            }
            Ok(None) => continue,
            Err(response) => return response,
        }
    }
    Response::error(503, "the game is busy; retry")
}

/// Once an invitation is answered or withdrawn: an accepted game goes on
/// the invited person's own list (their own request puts it there), the
/// invitation stops waiting, and its notification goes. Only the list write
/// can fail the request; a resend does it again.
async fn answered(
    cx: &mut ApiCtx<'_>,
    game: &Game,
    id: &str,
    author: &str,
) -> Result<(), Response> {
    let Some(invitee) = game.invitee_account().map(str::to_string) else {
        return Ok(());
    };
    let by_invitee = game.invite.as_ref().is_some_and(|i| i.by != author);
    let accepted = game
        .invite
        .as_ref()
        .is_some_and(|i| i.state == Answer::Accepted);
    if by_invitee && accepted {
        let entry = Listed {
            created_ms: game.created_ms.max(1),
            computer: false,
        };
        put_listed(cx, id, &entry)
            .await
            .map_err(|e| storage_error(&e))?;
    }
    let account = (!by_invitee).then_some(invitee.as_str());
    if let Err(error) = unwait(cx, account, id).await {
        ferrite_app::tracing::warn!(%error, "an answered chess invitation still waits");
    }
    let now = cx.now_ms;
    if let Err(error) =
        notification_center::withdraw_at(cx.storage.store(), &invitee, now, MODULE.name, id).await
    {
        ferrite_app::tracing::warn!(%error, "an answered chess invitation stayed notified");
    }
    Ok(())
}

async fn add_ply(cx: &mut ApiCtx<'_>, game_id: &str) -> Response {
    let new: NewPly = match cx.request.json() {
        Ok(new) => new,
        Err(response) => return response,
    };
    let promotion = new.promotion.filter(|p| !p.is_empty());
    let dropped = new.drop.filter(|d| !d.is_empty());
    if new.draw {
        if !new.from.is_empty() || !new.to.is_empty() || promotion.is_some() || dropped.is_some() {
            return Response::error(400, "a draw claim names no squares");
        }
    } else if let Some(kind) = &dropped {
        if !new.from.is_empty()
            || !is_square(&new.to)
            || promotion.is_some()
            || rules::Kind::droppable(kind).is_none()
        {
            return Response::error(400, "a drop names a piece in hand and one square");
        }
    } else if !is_square(&new.from) || !is_square(&new.to) || new.from == new.to {
        return Response::error(400, "a move names two different squares, such as e2 and e4");
    }
    if promotion
        .as_deref()
        .is_some_and(|p| !PROMOTIONS.contains(&p))
    {
        return Response::error(400, "a pawn becomes a queen, rook, bishop or knight");
    }
    let author = author_of(&cx.session.principal);
    let ply = Ply {
        from: new.from,
        to: new.to,
        promotion,
        drop: dropped,
        draw: new.draw,
        author: author.clone(),
    };
    for _ in 0..CAS_ATTEMPTS {
        let mut shared = cx.storage.shared();
        let (version, mut game) = match read(&mut shared, game_id).await {
            Ok(read) => read,
            Err(e) => return storage_error(&e),
        };
        let current = version.unwrap_or(0);
        if version.is_none() && made_here(game_id) {
            return no_such_game();
        }
        if !game.open() && !game.seated(&author) {
            return no_such_game();
        }
        if new.number != game.number {
            return state(409, current, &game);
        }
        if let Some(played) = game.plies.get(new.ply) {
            // A resend of a ply this person already added: the other player
            // is told again, in case the first delivery stopped short of it.
            if *played == ply {
                let other = game.other_account(&author).map(str::to_string);
                tell(cx, other.as_deref()).await;
                return state(200, current, &game);
            }
            return state(409, current, &game);
        }
        if new.ply != game.plies.len() || game.plies.len() >= MAX_PLIES || !game.takes_moves() {
            return state(409, current, &game);
        }
        let side = Side::of_ply(new.ply);
        let held = if game.open() {
            let seat = match side {
                Side::White => &mut game.white,
                Side::Black => &mut game.black,
            };
            match seat {
                Some(holder) => *holder == author,
                None => {
                    *seat = Some(author.clone());
                    true
                }
            }
        } else {
            game.seat(side) == Some(author.as_str())
        };
        if !held {
            return Response::error(
                403,
                &format!("{} is played by the other player", side.name()),
            );
        }
        // The position the stored plies reach, and the ply in it: a move the
        // rules refuse, or a draw that cannot be claimed, is not added.
        let Some(position) = replay(&game.plies, game.variant) else {
            return state(409, current, &game);
        };
        let next = if ply.draw {
            position.claim_draw()
        } else if let Some(kind) = &ply.drop {
            let mut dropped = position;
            dropped.drop_here(kind, &ply.to).then_some(dropped)
        } else {
            position.play(&ply.from, &ply.to, ply.promotion.as_deref())
        };
        if next.is_none() {
            return state(409, current, &game);
        }
        if let Some(clock) = game.clock.as_mut() {
            if !clock.charge(side, cx.now_ms) {
                return out_of_time(cx, game_id, game, version, side, &author).await;
            }
        }
        game.plies.push(ply.clone());
        match write(&mut shared, game_id, &game, version).await {
            Ok(Some((version, stored))) => {
                let other = stored.other_account(&author).map(str::to_string);
                tell(cx, other.as_deref()).await;
                let body = if ply.draw {
                    "claimed a draw.".to_string()
                } else if let Some(kind) = &ply.drop {
                    format!(
                        "dropped a {kind} on {}. {}",
                        ply.to,
                        after_move(&stored, side)
                    )
                } else {
                    format!(
                        "played {} to {}. {}",
                        ply.from,
                        ply.to,
                        after_move(&stored, side)
                    )
                };
                let what = format!(
                    "{}-p{}-{}{}{}",
                    stored.number,
                    new.ply,
                    ply.from,
                    ply.to,
                    ply.drop.as_deref().unwrap_or("")
                );
                let title = stored.name_of(side);
                announce(cx, other.as_deref(), game_id, &what, title, body).await;
                return state(201, version, &stored);
            }
            Ok(None) => continue,
            Err(response) => return response,
        }
    }
    Response::error(503, "the game is busy; retry")
}

/// `side`'s time ran out before its move came: the game ends instead, and the
/// page that sent the move is shown so. A write that loses a race leaves the
/// game for the next look to settle.
/// `side`'s time ran out, in `account`'s words: the person told is either player.
fn out_of_time_note(game: &Game, side: Side, account: Option<&str>) -> (String, String) {
    let told = account.and_then(|account| {
        if game.white_account.as_deref() == Some(account) {
            Some(Side::White)
        } else if game.black_account.as_deref() == Some(account) {
            Some(Side::Black)
        } else {
            None
        }
    });
    if told == Some(side) {
        (
            game.name_of(side.other()),
            "won on time: yours ran out.".to_string(),
        )
    } else {
        (game.name_of(side), "ran out of time. You win.".to_string())
    }
}

/// What follows a move in the other player's notification: whose turn it is, or
/// how the move ended the game.
fn after_move(game: &Game, mover: Side) -> &'static str {
    use rules::Outcome;
    let mover = match mover {
        Side::White => rules::Side::White,
        Side::Black => rules::Side::Black,
    };
    match replay(&game.plies, game.variant).map(|position| position.outcome()) {
        Some(Outcome::Checkmate(winner)) if winner == mover => "Checkmate. You lose.",
        Some(Outcome::Checkmate(_)) => "Checkmate. You win.",
        Some(Outcome::Won(winner)) if winner == mover => "They win.",
        Some(Outcome::Won(_)) => "You win.",
        Some(Outcome::Draw) => "The game is drawn.",
        _ => "Your move.",
    }
}

async fn out_of_time(
    cx: &mut ApiCtx<'_>,
    game_id: &str,
    mut game: Game,
    version: Option<u64>,
    side: Side,
    author: &str,
) -> Response {
    game.ended = Some(Ending {
        reason: Reason::Time,
        winner: Some(side.other()),
        at_ms: cx.now_ms,
    });
    let mut shared = cx.storage.shared();
    match write(&mut shared, game_id, &game, version).await {
        Ok(Some((version, stored))) => {
            let other = stored.other_account(author).map(str::to_string);
            tell(cx, other.as_deref()).await;
            let (title, body) = out_of_time_note(&stored, side, other.as_deref());
            announce(cx, other.as_deref(), game_id, "end", title, body).await;
            state(409, version, &stored)
        }
        Ok(None) => Response::error(503, "the game is busy; retry"),
        Err(response) => response,
    }
}

async fn flag(cx: &mut ApiCtx<'_>, game_id: &str) -> Response {
    let author = author_of(&cx.session.principal);
    let now = cx.now_ms;
    for _ in 0..CAS_ATTEMPTS {
        let mut shared = cx.storage.shared();
        let (version, mut game) = match read(&mut shared, game_id).await {
            Ok(read) => read,
            Err(e) => return storage_error(&e),
        };
        let current = version.unwrap_or(0);
        if version.is_none() || game.open() || !game.seated(&author) {
            return no_such_game();
        }
        if game.ended.is_some_and(|ended| ended.reason == Reason::Time) {
            return state(200, current, &game);
        }
        let running = Side::of_ply(game.plies.len());
        let gone = game
            .clock
            .is_some_and(|clock| clock.since_ms != 0 && clock.left(running, now) == 0);
        if !gone || !game.takes_moves() || !on_the_board(&game) {
            return state(409, current, &game);
        }
        game.ended = Some(Ending {
            reason: Reason::Time,
            winner: Some(running.other()),
            at_ms: now,
        });
        match write(&mut shared, game_id, &game, version).await {
            Ok(Some((version, stored))) => {
                let other = stored.other_account(&author).map(str::to_string);
                tell(cx, other.as_deref()).await;
                let (title, body) = out_of_time_note(&stored, running, other.as_deref());
                announce(cx, other.as_deref(), game_id, "end", title, body).await;
                return state(200, version, &stored);
            }
            Ok(None) => continue,
            Err(response) => return response,
        }
    }
    Response::error(503, "the game is busy; retry")
}

async fn take_back(cx: &mut ApiCtx<'_>, game_id: &str) -> Response {
    let asked: TakeBack = match cx.request.json() {
        Ok(asked) => asked,
        Err(response) => return response,
    };
    let author = author_of(&cx.session.principal);
    for _ in 0..CAS_ATTEMPTS {
        let mut shared = cx.storage.shared();
        let (version, mut game) = match read(&mut shared, game_id).await {
            Ok(read) => read,
            Err(e) => return storage_error(&e),
        };
        let current = version.unwrap_or(0);
        if !game.open() && !game.seated(&author) {
            return no_such_game();
        }
        if game.computer.is_none() {
            return Response::error(
                403,
                "a move is taken back only in a game against the computer",
            );
        }
        if asked.number != game.number || !game.takes_moves() {
            return state(409, current, &game);
        }
        if asked.to == game.plies.len() {
            return state(200, current, &game);
        }
        let mine = game.side_of(&author) == Some(Side::of_ply(asked.to));
        if !mine
            || asked.version != current
            || asked.to > game.plies.len()
            || game.plies.len() - asked.to > 2
        {
            return state(409, current, &game);
        }
        // The running side pays for its time so far, so that taking back gives none of it back.
        // A game over on the board has no running side: nobody's time can end it.
        if on_the_board(&game) {
            if let Some(clock) = game.clock.as_mut() {
                let running = Side::of_ply(game.plies.len());
                if !clock.charge(running, cx.now_ms) {
                    return out_of_time(cx, game_id, game, version, running, &author).await;
                }
            }
        }
        game.plies.truncate(asked.to);
        if let Some(clock) = game.clock.as_mut() {
            clock.since_ms = cx.now_ms;
        }
        match write(&mut shared, game_id, &game, version).await {
            Ok(Some((version, stored))) => return state(200, version, &stored),
            Ok(None) => continue,
            Err(response) => return response,
        }
    }
    Response::error(503, "the game is busy; retry")
}

async fn new_game(cx: &mut ApiCtx<'_>, game_id: &str) -> Response {
    let new: NewGame = match cx.request.json() {
        Ok(new) => new,
        Err(response) => return response,
    };
    let author = author_of(&cx.session.principal);
    let mut shared = cx.storage.shared();
    for _ in 0..CAS_ATTEMPTS {
        let (version, game) = match read(&mut shared, game_id).await {
            Ok(read) => read,
            Err(e) => return storage_error(&e),
        };
        let current = version.unwrap_or(0);
        // A removed game of accounts stays gone; only a public board is made by being used.
        if version.is_none() && made_here(game_id) {
            return no_such_game();
        }
        if !game.open() {
            if !game.seated(&author) {
                return no_such_game();
            }
            return Response::error(409, "a game of yours is kept; start another with New Game");
        }
        if new.number != game.number {
            // Already replaced (a resend), or a page that is behind.
            let status = if new.number.checked_add(1) == Some(game.number) {
                200
            } else {
                409
            };
            return state(status, current, &game);
        }
        let seated = [&game.white, &game.black];
        if seated.iter().any(|s| s.is_some()) && !game.seated(&author) {
            return Response::error(403, "only the two players can start a new game");
        }
        let Some(number) = game.number.checked_add(1) else {
            return state(409, current, &game);
        };
        let next = Game {
            number,
            ..Game::default()
        };
        match write(&mut shared, game_id, &next, version).await {
            Ok(Some((version, stored))) => return state(201, version, &stored),
            Ok(None) => continue,
            Err(response) => return response,
        }
    }
    Response::error(503, "the game is busy; retry")
}

async fn remove(cx: &mut ApiCtx<'_>, game_id: &str) -> Response {
    let key = game_key(game_id);
    let removed = serde_json::json!({ "removed": game_id });
    let entry: Option<Listed> = match cx.storage.user().get(&key).await {
        Ok(entry) => entry.and_then(|bytes| serde_json::from_slice(&bytes).ok()),
        Err(e) => return storage_error(&e),
    };
    let Some(entry) = entry else {
        return Response::json(200, &removed);
    };
    if entry.computer {
        // The game goes first: a crash between the two leaves an entry a resend can finish.
        if let Err(e) = cx.storage.shared().delete(&key).await {
            return storage_error(&e);
        }
    } else {
        let stored = match cx.storage.shared().get_versioned(&key).await {
            Ok(stored) => stored,
            Err(e) => return storage_error(&e),
        };
        if let Some(game) = stored.and_then(|(bytes, _)| decode(Some(&bytes)).ok()) {
            if game.ended.is_none() && on_the_board(&game) {
                return Response::error(409, "resign or decline this game before removing it");
            }
        }
    }
    if let Err(e) = cx.storage.user().delete(&key).await {
        return storage_error(&e);
    }
    Response::json(200, &removed)
}

/// A stored game that cannot be read: off the person's list when it is on
/// it (and gone, for a game against the computer, which nobody else holds),
/// or, for an open board, replaced by the first game. A game this module
/// made is never taken for an open board: once off the person's list, a
/// resend of the reset finds nothing of theirs to reset.
async fn reset(cx: &mut ApiCtx<'_>, game_id: &str) -> Response {
    let stored = match cx.storage.shared().get_versioned(&game_key(game_id)).await {
        Ok(stored) => stored,
        Err(e) => return storage_error(&e),
    };
    let listed: Option<Listed> = match cx.storage.user().get(&game_key(game_id)).await {
        Ok(entry) => entry.and_then(|bytes| serde_json::from_slice(&bytes).ok()),
        Err(e) => return storage_error(&e),
    };
    let Some((bytes, version)) = stored else {
        if listed.is_some() || made_here(game_id) {
            if let Err(e) = cx.storage.user().delete(&game_key(game_id)).await {
                return storage_error(&e);
            }
            return no_such_game();
        }
        return state(409, 0, &Game::first());
    };
    if let Ok(game) = decode(Some(&bytes)) {
        if !game.open() && !game.seated(&author_of(&cx.session.principal)) {
            return no_such_game();
        }
        return state(409, version, &game);
    }
    if let Some(entry) = listed {
        if let Err(e) = cx.storage.user().delete(&game_key(game_id)).await {
            return storage_error(&e);
        }
        if entry.computer {
            if let Err(e) = cx.storage.shared().delete(&game_key(game_id)).await {
                return storage_error(&e);
            }
        }
        return Response::json(200, &serde_json::json!({ "removed": game_id }));
    }
    if made_here(game_id) {
        return no_such_game();
    }
    let mut shared = cx.storage.shared();
    match write(&mut shared, game_id, &Game::first(), Some(version)).await {
        Ok(Some((version, game))) => state(201, version, &game),
        Ok(None) => Response::error(409, "the game changed meanwhile; read it again"),
        Err(response) => response,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn squares_and_game_ids() {
        assert!(is_square("e2") && is_square("a8") && is_square("h1"));
        for bad in ["", "e", "e9", "i1", "E2", "e22"] {
            assert!(!is_square(bad), "{bad:?}");
        }
        assert!(is_game("desktop"));
        assert!(!is_game("a/b"));
        assert_eq!(feed_key("desktop").as_deref(), Some("games/desktop"));
        assert_eq!(feed_key("a/b"), None);
    }

    #[test]
    fn an_absent_game_is_the_first_at_the_start() {
        assert_eq!(
            view(None),
            serde_json::json!({ "number": 1, "plies": [], "white": null, "black": null })
        );
    }

    fn mv(from: &str, to: &str) -> Ply {
        Ply {
            from: from.into(),
            to: to.into(),
            ..Ply::default()
        }
    }

    #[test]
    fn only_plies_the_rules_allow_replay() {
        assert!(replay(&[mv("e2", "e4"), mv("e7", "e5")], rules::Variant::Regular).is_some());
        assert!(
            replay(&[mv("e2", "e5")], rules::Variant::Regular).is_none(),
            "an illegal first move"
        );
        assert!(
            replay(&[mv("e7", "e5")], rules::Variant::Regular).is_none(),
            "Black does not move first"
        );
        let draw = Ply {
            draw: true,
            ..Ply::default()
        };
        assert!(
            replay(&[draw], rules::Variant::Regular).is_none(),
            "nothing to claim at the start"
        );
    }

    #[test]
    fn an_unreadable_stored_game_is_an_error_not_a_new_game() {
        assert_eq!(
            view(Some(b"not json")),
            serde_json::json!({ "unreadable": true })
        );
        assert!(decode(Some(b"not json")).is_err());
        assert_eq!(decode(None).unwrap(), Game::first());
        let e = std::io::Error::new(std::io::ErrorKind::InvalidData, "x");
        assert_eq!(storage_error(&e).status, 409);
        assert_eq!(storage_error(&std::io::Error::other("down")).status, 503);
    }

    #[test]
    fn the_feed_never_shows_a_game_that_belongs_to_its_players() {
        let between = Game {
            number: 1,
            white: Some("u-white".into()),
            black: Some("u-black".into()),
            invite: Some(Invite {
                from: "ada".into(),
                to: "bob".into(),
                by: "u-white".into(),
                state: Answer::Accepted,
            }),
            white_account: Some("u-secret-white".into()),
            black_account: Some("u-secret-black".into()),
            ..Game::default()
        };
        let bytes = serde_json::to_vec(&between).unwrap();
        assert_eq!(view(Some(&bytes)), serde_json::json!({ "private": true }));
        assert!(!public(&between).to_string().contains("u-secret"));
        assert_eq!(between.other_account("u-white"), Some("u-secret-black"));
        assert_eq!(between.invitee_account(), Some("u-secret-black"));
    }

    #[test]
    fn the_computer_s_owner_plays_its_side_too() {
        let game = Game {
            number: 1,
            white: Some("me".into()),
            black: Some("me".into()),
            computer: Some(Computer {
                side: Side::Black,
                level: 2,
            }),
            ..Game::default()
        };
        assert!(!game.open() && game.takes_moves());
        assert_eq!(game.side_of("me"), Some(Side::White));
        assert_eq!(game.side_of("someone"), None);
        assert_eq!(game.other_account("me"), None);
        assert_eq!(summary("g", &game, "me")["status"], "playing");
    }

    #[test]
    fn a_list_keeps_its_newest_games() {
        let entry = |created_ms| Listed {
            created_ms,
            computer: false,
        };
        let entries: Vec<(String, Listed)> = (0..LISTED_LIMIT + 5)
            .map(|n| (format!("g{n}"), entry(1_000 - n as u64)))
            .collect();
        let pruned: Vec<&str> = to_prune(&entries, "g0")
            .iter()
            .map(|(id, _)| id.as_str())
            .collect();
        // The four oldest past the limit; the game just listed is kept,
        // however old it is.
        assert_eq!(pruned, ["g201", "g202", "g203", "g204"]);
        let kept_old = to_prune(&entries, "g204");
        assert_eq!(kept_old.len(), 4);
        assert!(kept_old.iter().all(|(id, _)| id != "g204"));
    }

    #[test]
    fn invitations_are_limited_in_all_and_from_each_person() {
        let mut invitations = Invitations::default();
        let wait = |n: usize, by: &str| Waiting {
            game: format!("g{n}"),
            by: by.into(),
            created_ms: 10,
        };
        for n in 0..SENDER_LIMIT {
            invitations.waiting.push(wait(n, "eve"));
        }
        assert!(
            !invitations.room_for("eve"),
            "one person sends at most three"
        );
        assert!(invitations.room_for("ada"));
        for n in SENDER_LIMIT..INVITATION_LIMIT {
            invitations.waiting.push(wait(n, &format!("p{n}")));
        }
        assert!(!invitations.room_for("ada"), "at most twelve in all");
        invitations.fresh(10 + INVITATION_WAIT_MS);
        assert!(
            invitations.waiting.is_empty(),
            "a week old, they wait no more"
        );
        assert!(made_here("0123456789abcdef0123456789abcdef"));
        assert!(!made_here("desktop"));
    }
}

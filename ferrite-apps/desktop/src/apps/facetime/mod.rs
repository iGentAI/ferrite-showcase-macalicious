//! FaceTime's server half: audio and video calls between desktop accounts,
//! two people or a group of up to [`MAX_MEMBERS`].
//!
//! Ferrite carries no media. Sound and picture go peer to peer between the
//! browsers over WebRTC, with a public STUN server to find each side's
//! address; a group is a mesh, one connection for each pair of people, since
//! there is no media server. This module is the signalling: who calls whom,
//! who answers, and the session descriptions (SDP) each pair of browsers
//! exchanges to connect. There is no TURN relay, so two browsers that can
//! reach each other only through one (both behind strict NAT) do not connect;
//! the page then says so, and the rest of a group stay connected.
//!
//! Routes (all JSON; a call needs a signed-in account at both ends, and a
//! Guest User can call but cannot be called, having no account name):
//!
//! * `GET /api/facetime/me`: `{"name", "full_name"}` for the person signed
//!   in, or `{"name": null}` before anyone has.
//! * `GET /api/facetime/calls`: `{"recents", "incoming", "active",
//!   "server_ms"}`: the person's recent calls, newest first, the call ringing
//!   for them now, if any, and the call they are in. Reading it brings the
//!   person's unfinished calls up to date ([`settle`]).
//! * `POST /api/facetime/calls` with `{"to": "martin", "kind": "video",
//!   "page": "<token>"}`: calls one person by account name, from the page
//!   that names itself with `page`; `201` with the call. A person is in one
//!   call at a time: a new call while they hold a seat in another is refused
//!   (`409`, with that call).
//! * `GET /api/facetime/calls/<id>`: `{"version", "state", "server_ms"}`, for
//!   a member of the call. With `?seat=<n>`, from the page holding seat `n`,
//!   the read is also the page's sign of life ([`STALE_MS`]).
//! * `POST /api/facetime/calls/<id>/join` with `{"page"}`: answer, or take up
//!   the call again from a page loaded anew; `.../decline`; `.../leave` with
//!   `{"seat"}`; `.../signal` with `{"from", "to", "offer", "revision"}` or
//!   `{"from", "to", "answer", "generation"}`. Each answers with the call.
//! * `POST /api/facetime/calls/<id>/add` with `{"to": "cara"}`, from a member
//!   who is joined: rings one more person by account name, under the checks
//!   of a new call (exists, not blocked, not too often, room on their list);
//!   `201` with the call, or `200` when they ring already (a resend).
//! * `POST /api/facetime/calls/<id>/live-photo`, from a member who is joined:
//!   tells the others a picture of the call is being kept, before the page
//!   keeps it. `{"told": n}`.
//! * `DELETE /api/facetime/calls` clears the person's finished recent calls;
//!   `DELETE /api/facetime/calls/<id>` removes one finished call.
//!
//! Seats and pages. Every page that takes part in a call names itself with a
//! random page token. Each join takes a *seat*, a number that only grows,
//! tied to the page that asked: a resend of the same page's join keeps its
//! seat, and only another page (a reload, a second tab) takes a new one,
//! which replaces the old. Every leave and signal names the sender's seat and
//! counts only while the sender's account still holds that seat, so a
//! delayed hang-up from a page that has been replaced never ends the call of
//! the page that replaced it. A seat whose page has not read the call for
//! [`STALE_MS`] has gone (the tab closed without hanging up).
//!
//! Who stays. A person who hangs up or goes stale leaves the call, with the
//! links of their seat; so does one who declines or rings out. The call goes
//! on while two people remain in it (joined or ringing), one of them joined,
//! and ends otherwise ([`conclude`]): of two people, one hanging up ends it
//! for both.
//!
//! How a call connects. Each pair of joined seats has one [`Link`]. The
//! member with the later seat offers to the one with the earlier seat, which
//! answers: someone answering offers to everyone already joined, and a page
//! that takes up a call again offers anew. Offers and answers are whole
//! descriptions with their ICE candidates gathered (no trickle). A new offer
//! replaces the old of its pair (`generation` counts them, and an answer names
//! the offer it answers); `revision`, counted up by the offering page, keeps a
//! late copy of an older offer from replacing a newer one. A member reads only
//! the links of their own seat.
//!
//! A call's links stay in its one document, so compare-and-set covers seats
//! and links together. Of [`MAX_CALL_BYTES`], [`LINK_ROOM_BYTES`] is for
//! descriptions; while more than two people are in a call each description
//! gets its equal share of that room, as encoded, given the pairs those people
//! make ([`description_room`]). Six pairs of two descriptions at 14 KiB always
//! fit, where twelve at the 64 KiB a pair of people may send would not. A
//! description past its share is refused (`413`) rather than letting the call
//! fail to save, and the page names who could not be reached; adding someone
//! drops a link past the new share, which a connection already made does not
//! need.
//!
//! How the others hear of a change: every change to a call counts a change in
//! the other members' FaceTime (`notification_center::touched`), which their
//! own personal stream carries to their pages, and a ringing call is also a
//! notification. No feed serves a call: its id is given only to its members,
//! and every read checks membership.
//!
//! Where things are kept: the call in the shared space (`calls/<id>`, 128
//! random bits), kept for [`ENDED_KEEP_MS`] after it was last heard of; each member's line
//! for it in their own space (`recents/<id>`), written when the call is placed
//! or they are added, and brought up to date as people go and when it ends (a
//! Guest User's only by the guest's own requests, which keep its expiry); the keys of the person's
//! keyed placings (`keyed-calls`); and the claim on their one seat (`seat`,
//! [`claim_seat`]). A person's list is pruned only by their own
//! looks; a call to someone whose list holds [`LINE_CAP`] lines is refused
//! until they look, and one person rings another at most
//! [`CALLS_PER_HOUR`] times an hour.
//!
//! A join carries the page's idempotency key, and a member keeps the digests
//! of their last joins: a join delivered again after a later page took the
//! seat changes nothing. A person holding a seat in a call can neither place
//! nor answer another. The request reads the person's calls, and then claims
//! their one seat for the call (`seat` in their own space) with
//! compare-and-set before it writes the call ([`claim_seat`]): of two
//! requests at once from two windows, only one gets the seat, and the other
//! is refused as if the person were already in that call. Once its seat is
//! written, the request confirms its claim with compare-and-set over the
//! version it claimed ([`confirm_seat`]); a request whose claim another took
//! over meanwhile (it was slower than [`CLAIM_HOLD_MS`]) fails that, and
//! takes its seat back.

use ferrite_app::serde;
use ferrite_app::serde_json;

use super::notification_center::{self, Action, Notification};
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture, Space, Storage};
use crate::session::Account;

pub const MODULE: AppModule = AppModule {
    name: "facetime",
    title: "FaceTime",
    handle,
};

/// How long a call rings for someone before it counts as missed: from when
/// the call was placed, or from when they were added.
pub const RING_MS: u64 = 45_000;
/// The most people in a call at once, joined or ringing.
pub const MAX_MEMBERS: usize = 4;
/// The most people a call records, those who have gone included, so that it
/// keeps within [`MAX_CALL_BYTES`] and people cannot be added to it without end.
pub const MAX_ROSTER: usize = 3 * MAX_MEMBERS;
/// How long a seat lasts without its page reading the call: a page in a
/// call reads it every few seconds (`demos/facetime/facetime-live.tsx`).
pub const STALE_MS: u64 = 25_000;
/// A page's read refreshes its seat's sign of life at most this often, so a
/// call in progress costs one write every few seconds per member.
pub const ALIVE_WRITE_MS: u64 = 8_000;
/// The longest session description a page may send.
pub const MAX_SDP_BYTES: usize = 64 * 1024;
/// The most a call may take stored, as encoded (escapes included): below
/// the store's 200 KB limit for one value.
pub const MAX_CALL_BYTES: usize = 180 * 1024;
/// What a call's descriptions may take of [`MAX_CALL_BYTES`], as encoded; the
/// rest holds its [`MAX_ROSTER`] people and the head of each link.
pub const LINK_ROOM_BYTES: usize = 168 * 1024;
/// The most recent calls a person's list keeps; the oldest finished ones go,
/// at the person's own next look.
pub const RECENT_LIMIT: usize = 100;
/// The most lines a person's list may hold before it is pruned: others'
/// calls add lines and only the person's own looks prune them, so a call to
/// someone whose list is this full is refused.
pub const LINE_CAP: usize = 3 * RECENT_LIMIT;
/// How long an ended call is kept in the shared space, for a late request
/// of one of its pages to find it ended: a day. Each member's line keeps
/// what the history shows.
pub const ENDED_KEEP_MS: u64 = 24 * 60 * 60 * 1_000;
/// How many calls one person may place to another in an hour: a caller can
/// fill nobody's history, nor keep them from being called, faster than this.
pub const CALLS_PER_HOUR: usize = 10;
const HOUR_MS: u64 = 60 * 60 * 1_000;
/// The most finished lines one look prunes, so a list others have filled is
/// brought down over a few looks rather than in one long request.
const PRUNE_PER_LOOK: usize = 50;
/// How many joins a member's record remembers, so a join delivered again
/// after a later page took the seat does not take it back.
const JOIN_KEYS: usize = 8;
/// The most unfinished calls one look brings up to date, newest first.
const OPEN_LIMIT: usize = 10;
/// How many entries a read of the list takes: all of it, up to [`LINE_CAP`].
const RECENT_SCAN: usize = LINE_CAP + 1;
/// How many keyed placings a person's record remembers.
const KEYED_LIMIT: usize = 64;
const CAS_ATTEMPTS: usize = 16;
/// The person's claim on their one seat, in their own space ([`Claim`]).
const SEAT_KEY: &str = "seat";
/// How long a claim holds by itself, while the request that made it places or
/// answers its call: a call not written yet, or not yet answered, holds for
/// this long. An ended call never holds.
pub const CLAIM_HOLD_MS: u64 = 10_000;

#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum Kind {
    Audio,
    Video,
}

/// Where a member stands in a call.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum State {
    Ringing,
    Joined,
    Declined,
    Missed,
    Left,
}

/// The seat a member holds: its number, the page holding it, and when that
/// page was last heard from.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Seat {
    pub n: u32,
    pub page: String,
    pub seen_ms: u64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Member {
    /// The account id: kept for checks, never shown ([`view_for`]).
    pub account: String,
    pub name: String,
    pub full_name: String,
    pub state: State,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub seat: Option<Seat>,
    /// The first join (epoch ms), or 0.
    #[serde(default)]
    pub joined_ms: u64,
    #[serde(default)]
    pub left_ms: u64,
    /// Digests of the idempotency keys of this member's last joins: a join
    /// delivered again is recognised and changes nothing. Never shown.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub joins: Vec<String>,
    /// When this member was added to a call under way (epoch ms), which their
    /// ring counts from; 0 for the first two, whose ring counts from the
    /// call's placing.
    #[serde(default, skip_serializing_if = "is_zero")]
    pub rang_ms: u64,
    /// The account name of who added this member.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub added_by: Option<String>,
}

impl Member {
    /// Whether this member is in the call now, joined or ringing.
    fn in_call(&self) -> bool {
        matches!(self.state, State::Ringing | State::Joined)
    }
}

fn is_zero(n: &u64) -> bool {
    *n == 0
}

/// The descriptions exchanged between two seats: `from` offers to `to`.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Link {
    pub from: u32,
    pub to: u32,
    pub offer: String,
    pub generation: u64,
    pub revision: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub answer: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Call {
    pub id: String,
    pub kind: Kind,
    pub created_ms: u64,
    /// When both members were first joined (epoch ms), or 0.
    #[serde(default)]
    pub connected_ms: u64,
    /// When the call ended (epoch ms), or 0 while it goes on.
    #[serde(default)]
    pub ended_ms: u64,
    pub next_seat: u32,
    /// The caller first, the callee second, then whoever was added, in order;
    /// everyone stays listed after going.
    pub members: Vec<Member>,
    /// One link for each pair of joined seats that has one. A call stored
    /// before there were groups has a single `link` instead.
    #[serde(
        default,
        alias = "link",
        deserialize_with = "stored_links",
        skip_serializing_if = "Vec::is_empty"
    )]
    pub links: Vec<Link>,
}

fn stored_links<'de, D: serde::Deserializer<'de>>(stored: D) -> Result<Vec<Link>, D::Error> {
    #[derive(serde::Deserialize)]
    #[serde(crate = "ferrite_app::serde", untagged)]
    enum Stored {
        Many(Vec<Link>),
        One(Link),
    }
    Ok(
        match <Option<Stored> as serde::Deserialize>::deserialize(stored)? {
            Some(Stored::Many(links)) => links,
            Some(Stored::One(link)) => vec![link],
            None => Vec::new(),
        },
    )
}

impl Call {
    fn member(&self, account: &str) -> Option<&Member> {
        self.members.iter().find(|m| m.account == account)
    }

    fn member_mut(&mut self, account: &str) -> Option<&mut Member> {
        self.members.iter_mut().find(|m| m.account == account)
    }

    /// The first person on the list who is not `account`.
    fn other(&self, account: &str) -> Option<&Member> {
        self.members.iter().find(|m| m.account != account)
    }

    /// How many people are in the call now, joined or ringing.
    fn in_call(&self) -> usize {
        self.members.iter().filter(|m| m.in_call()).count()
    }

    /// How many people have gone.
    fn gone(&self) -> usize {
        self.members.len() - self.in_call()
    }

    fn caller(&self) -> Option<&Member> {
        self.members.first()
    }

    /// The seat `account` holds while joined.
    fn seat_of(&self, account: &str) -> Option<u32> {
        self.member(account)
            .filter(|m| m.state == State::Joined)
            .and_then(|m| m.seat.as_ref())
            .map(|s| s.n)
    }

    /// Whether the seat numbered `n` is held by a joined member.
    fn held(&self, n: u32) -> bool {
        self.members
            .iter()
            .any(|m| m.state == State::Joined && m.seat.as_ref().is_some_and(|s| s.n == n))
    }
}

/// How a recent call went, for the person whose list it is in.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum Status {
    Outgoing,
    Incoming,
    Missed,
}

/// Someone in a recent call.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Party {
    pub name: String,
    pub full_name: String,
}

/// One line of a person's recent calls (their own space, `recents/<id>`).
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Recent {
    pub call: String,
    pub kind: Kind,
    pub status: Status,
    pub with: Party,
    pub at_ms: u64,
    /// How long this person was connected, once the call has ended or they have left it.
    #[serde(default)]
    pub duration_ms: u64,
    /// Whether the call has ended, or this person has gone from it, and this
    /// line will not change again.
    #[serde(default)]
    pub done: bool,
    /// How many people the call had besides this person and `with`.
    #[serde(default, skip_serializing_if = "is_zero_u32")]
    pub with_more: u32,
    /// Who rang this person, when they were added to a call under way: it
    /// counts towards that person's [`CALLS_PER_HOUR`].
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub added_by: Option<String>,
}

fn is_zero_u32(n: &u32) -> bool {
    *n == 0
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Place {
    to: String,
    kind: Kind,
    page: String,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Join {
    page: String,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Leave {
    seat: u32,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Add {
    to: String,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Signal {
    from: u32,
    to: u32,
    #[serde(default)]
    offer: Option<String>,
    #[serde(default)]
    revision: Option<u64>,
    #[serde(default)]
    answer: Option<String>,
    #[serde(default)]
    generation: Option<u64>,
}

/// Whether `id` is 32 lowercase hex digits: a call id.
pub fn is_token(id: &str) -> bool {
    id.len() == 32 && id.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
}

/// Whether `page` is a page token: 16 to 64 letters, digits, `-` or `_`.
pub fn is_page(page: &str) -> bool {
    (16..=64).contains(&page.len())
        && page
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

fn call_key(id: &str) -> String {
    format!("calls/{id}")
}

fn recent_key(id: &str) -> String {
    format!("recents/{id}")
}

fn invalid(e: impl std::fmt::Display) -> std::io::Error {
    std::io::Error::new(std::io::ErrorKind::InvalidData, e.to_string())
}

fn decode<T: serde::de::DeserializeOwned>(bytes: &[u8]) -> std::io::Result<T> {
    serde_json::from_slice(bytes).map_err(invalid)
}

fn storage_error(e: &std::io::Error) -> Response {
    if e.kind() == std::io::ErrorKind::InvalidData {
        Response::error(409, &e.to_string())
    } else {
        Response::error(503, &e.to_string())
    }
}

fn signed_out() -> Response {
    Response::error(403, "Sign in to make and take FaceTime calls.")
}

fn no_such_call() -> Response {
    Response::error(404, "no call of yours has that id")
}

/// A call as `account` sees it: the members without their account ids, the
/// other members' page tokens left out, and only the links that join
/// `account`'s seat (the descriptions carry network addresses). `link` is the
/// first of `links`, as a page loaded before groups reads it.
pub fn view_for(call: &Call, account: &str, with_link: bool) -> serde_json::Value {
    let seat = call.seat_of(account);
    let members: Vec<serde_json::Value> = call
        .members
        .iter()
        .map(|m| {
            let mut seat = m.seat.as_ref().map(|s| serde_json::json!({ "n": s.n }));
            if m.account == account {
                seat = m
                    .seat
                    .as_ref()
                    .map(|s| serde_json::json!({ "n": s.n, "page": s.page }));
            }
            serde_json::json!({
                "name": m.name,
                "full_name": m.full_name,
                "state": m.state,
                "seat": seat,
                "joined_ms": m.joined_ms,
                "left_ms": m.left_ms,
                "me": m.account == account,
            })
        })
        .collect();
    let links: Vec<&Link> = call
        .links
        .iter()
        .filter(|l| with_link && seat.is_some_and(|s| l.from == s || l.to == s))
        .collect();
    serde_json::json!({
        "id": call.id,
        "kind": call.kind,
        "created_ms": call.created_ms,
        "connected_ms": call.connected_ms,
        "ended_ms": call.ended_ms,
        "members": members,
        "link": links.first(),
        "links": links,
    })
}

/// A member leaves at `now`.
fn depart(member: &mut Member, now: u64) {
    member.state = State::Left;
    member.left_ms = now;
    member.seat = None;
}

/// A member who was ringing stops, as `state`, at `now`.
fn stop_ringing(member: &mut Member, state: State, now: u64) {
    member.state = state;
    member.left_ms = now;
}

/// End the call at `now`: whoever still rings has missed it, whoever is
/// joined has left, and the links go.
fn end(call: &mut Call, now: u64) {
    call.ended_ms = now.max(1);
    for member in &mut call.members {
        match member.state {
            State::Ringing => stop_ringing(member, State::Missed, now),
            State::Joined => depart(member, now),
            _ => {}
        }
    }
    call.links.clear();
}

/// Whether a call is over: fewer than two people remain in it, or nobody
/// joined is left to speak to whoever still rings.
fn over(call: &Call) -> bool {
    call.in_call() < 2 || !call.members.iter().any(|m| m.state == State::Joined)
}

/// After someone has gone at `now`: the call ends if that was the last of it,
/// and otherwise only the links of seats no longer held go.
fn conclude(call: &mut Call, now: u64) {
    if over(call) {
        end(call, now);
    } else {
        drop_unheld_links(call);
    }
}

fn drop_unheld_links(call: &mut Call) {
    let links = std::mem::take(&mut call.links);
    call.links = links
        .into_iter()
        .filter(|l| call.held(l.from) && call.held(l.to))
        .collect();
}

/// The room one description has, as encoded, for as many pairs as the people
/// in the call make: an equal share of [`LINK_ROOM_BYTES`] among the two
/// descriptions of each pair.
pub fn description_room(call: &Call) -> usize {
    let people = call.in_call().max(2);
    LINK_ROOM_BYTES / (people * (people - 1))
}

/// `description`'s bytes as stored, escapes included.
fn encoded_len(description: &str) -> usize {
    serde_json::to_string(description).map_or(usize::MAX, |encoded| encoded.len())
}

/// Bring a call up to `now`: someone still ringing [`RING_MS`] after their
/// ring began has missed it, a seat whose page has not been heard from for
/// [`STALE_MS`] has gone, and a call with nobody left to speak to is over
/// ([`over`]). Whether anything changed.
pub fn settle(call: &mut Call, now: u64) -> bool {
    if call.ended_ms != 0 {
        return false;
    }
    let created = call.created_ms;
    let mut changed = false;
    for member in &mut call.members {
        let rang = member.rang_ms.max(created);
        if member.state == State::Ringing && now >= rang.saturating_add(RING_MS) {
            stop_ringing(member, State::Missed, now);
            changed = true;
        }
        let stale = member
            .seat
            .as_ref()
            .is_some_and(|s| now >= s.seen_ms.saturating_add(STALE_MS));
        if member.state == State::Joined && stale {
            depart(member, now);
            changed = true;
        }
    }
    if over(call) {
        end(call, now);
        changed = true;
    } else if changed {
        drop_unheld_links(call);
    }
    changed
}

/// The line a call makes in `account`'s recent calls.
pub fn recent_of(call: &Call, account: &str) -> Option<Recent> {
    let me = call.member(account)?;
    let other = call.other(account)?;
    let caller = call.caller().is_some_and(|m| m.account == account);
    let status = if caller {
        Status::Outgoing
    } else if me.joined_ms != 0 || (me.state == State::Ringing && call.ended_ms == 0) {
        Status::Incoming
    } else {
        Status::Missed
    };
    let duration_ms = if me.left_ms != 0 && me.joined_ms != 0 && call.connected_ms != 0 {
        me.left_ms
            .saturating_sub(call.connected_ms.max(me.joined_ms))
    } else {
        0
    };
    Some(Recent {
        call: call.id.clone(),
        kind: call.kind,
        status,
        with: Party {
            name: other.name.clone(),
            full_name: other.full_name.clone(),
        },
        at_ms: me.rang_ms.max(call.created_ms),
        duration_ms,
        done: call.ended_ms != 0 || !me.in_call(),
        with_more: u32::try_from(call.members.len().saturating_sub(2)).unwrap_or(u32::MAX),
        added_by: me.added_by.clone(),
    })
}

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    let path = cx.request.path;
    let method = cx.request.method;
    let me = cx.session.account.clone();
    if path == "/me" {
        return match (method, me) {
            ("GET", Some(me)) => Response::json(
                200,
                &serde_json::json!({ "name": me.name, "full_name": me.full_name, "guest": me.guest }),
            ),
            ("GET", None) => Response::json(200, &serde_json::json!({ "name": null })),
            _ => Response::method_not_allowed(),
        };
    }
    if path == "/calls" {
        return match (method, me) {
            ("GET", Some(me)) => overview(&mut cx, &me).await,
            ("GET", None) => Response::json(
                200,
                &serde_json::json!({ "recents": [], "incoming": null, "active": null, "server_ms": cx.now_ms }),
            ),
            ("POST", Some(me)) => place(&mut cx, &me).await,
            ("DELETE", Some(_)) => forget(&mut cx, None).await,
            ("POST" | "DELETE", None) => signed_out(),
            _ => Response::method_not_allowed(),
        };
    }
    let Some(rest) = path.strip_prefix("/calls/") else {
        return Response::not_found();
    };
    let (id, action) = rest.split_once('/').unwrap_or((rest, ""));
    if !is_token(id) {
        return Response::error(400, "a call id is 32 lowercase hex digits");
    }
    let Some(me) = me else {
        return match (method, action) {
            ("GET" | "DELETE", "")
            | ("POST", "join" | "decline" | "leave" | "signal" | "add" | "live-photo") => {
                signed_out()
            }
            _ => Response::not_found(),
        };
    };
    match (method, action) {
        ("GET", "") => read_call(&mut cx, &me, id).await,
        ("DELETE", "") => forget(&mut cx, Some(id)).await,
        ("POST", "join" | "decline" | "leave" | "signal") => act(&mut cx, &me, id, action).await,
        ("POST", "add") => add(&mut cx, &me, id).await,
        ("POST", "live-photo") => live_photo(&mut cx, &me, id).await,
        (_, "" | "join" | "decline" | "leave" | "signal" | "add" | "live-photo") => {
            Response::method_not_allowed()
        }
        _ => Response::not_found(),
    }
}

/// The keys of a person: the caller's own, or `account`'s when a request of
/// the other member writes their line.
fn storage_for<'s>(cx: &'s mut ApiCtx<'_>, account: Option<&'s str>) -> Storage<'s> {
    let session = cx.session;
    match account {
        Some(account) => Storage::new(cx.storage.store(), MODULE.name, account),
        None => Storage::new(cx.storage.store(), MODULE.name, &session.principal)
            .user_data_expires(session.guest_expires_ms()),
    }
}

async fn read(shared: &mut Space<'_>, id: &str) -> std::io::Result<Option<(Call, u64)>> {
    match shared.get_versioned(&call_key(id)).await? {
        Some((bytes, version)) => Ok(Some((decode(&bytes)?, version))),
        None => Ok(None),
    }
}

/// Write `call` if it is still at `version` (`None`: only if absent): the
/// version written, or `None` when another writer got there first. A call
/// that would pass [`MAX_CALL_BYTES`] is refused.
async fn write(
    shared: &mut Space<'_>,
    call: &Call,
    version: Option<u64>,
) -> Result<Option<u64>, Response> {
    let bytes = serde_json::to_vec(call).map_err(|e| Response::error(500, &e.to_string()))?;
    if bytes.len() > MAX_CALL_BYTES {
        return Err(Response::error(
            413,
            "the call's connection details are too large to keep",
        ));
    }
    // Every call goes by itself a day after it was last heard of: once it
    // ended, or, for one nobody ever settled (both pages gone), a day after
    // it was placed or a page last read it. A live call is written every few
    // seconds, so it never comes near.
    let heard = call
        .members
        .iter()
        .filter_map(|m| m.seat.as_ref().map(|s| s.seen_ms))
        .chain([call.created_ms, call.ended_ms])
        .max()
        .unwrap_or(0);
    let expires = heard.saturating_add(ENDED_KEEP_MS);
    match shared
        .put_if_version_expiring(&call_key(&call.id), &bytes, version, expires)
        .await
    {
        Ok(true) => match shared.get_versioned(&call_key(&call.id)).await {
            Ok(Some((_, version))) => Ok(Some(version)),
            Ok(None) => Err(Response::error(
                503,
                "the call could not be read back; retry",
            )),
            Err(e) => Err(storage_error(&e)),
        },
        Ok(false) => Ok(None),
        Err(e) => Err(Response::error(503, &e.to_string())),
    }
}

/// A refusal of an action on a call (`409`), with the call as it stands, so
/// the page that sent an out-of-date signal takes the newer state before it
/// tries again.
fn with_call(refusal: Response, version: u64, call: &Call, now: u64, account: &str) -> Response {
    if refusal.status != 409 {
        return refusal;
    }
    let error = serde_json::from_slice::<serde_json::Value>(&refusal.body)
        .ok()
        .and_then(|v| v.get("error").and_then(|e| e.as_str()).map(str::to_string))
        .unwrap_or_default();
    Response::json(
        409,
        &serde_json::json!({
            "error": error,
            "version": version,
            "state": view_for(call, account, true),
            "server_ms": now,
        }),
    )
}

fn reply(status: u16, version: u64, call: &Call, now: u64, account: &str) -> Response {
    Response::json(
        status,
        &serde_json::json!({ "version": version, "state": view_for(call, account, true), "server_ms": now }),
    )
}

/// Count a change in the FaceTime of the other members, apart from `unheard`
/// and anyone who went before now, so their pages read the call again. It
/// never fails the request.
async fn tell_but(cx: &mut ApiCtx<'_>, call: &Call, me: &str, unheard: Option<&str>) {
    let (now, by) = (cx.now_ms, cx.session.principal.clone());
    let others = call.members.iter().filter(|m| {
        m.account != me
            && Some(m.account.as_str()) != unheard
            && (m.in_call() || m.left_ms == 0 || m.left_ms >= now)
    });
    for other in others {
        if let Err(error) =
            notification_center::touched(cx.storage.store(), &other.account, MODULE.name, &by, now)
                .await
        {
            ferrite_app::tracing::warn!(%error, "a member was not told of a change in a call");
        }
    }
}

async fn tell(cx: &mut ApiCtx<'_>, call: &Call, me: &str) {
    tell_but(cx, call, me, None).await;
}

/// Whoever a call has stopped ringing for: their notification of it goes,
/// and someone who missed it is told, unless they have blocked the caller.
async fn unring(cx: &mut ApiCtx<'_>, call: &Call) {
    let now = cx.now_ms;
    for member in call
        .members
        .iter()
        .skip(1)
        .filter(|m| m.state != State::Ringing)
    {
        if let Err(error) = notification_center::withdraw_at(
            cx.storage.store(),
            &member.account,
            now,
            MODULE.name,
            &call.id,
        )
        .await
        {
            ferrite_app::tracing::warn!(%error, "a call that stopped ringing stayed notified");
        }
        let Some(caller) = call.members.first() else {
            continue;
        };
        if member.state != State::Missed
            || !matches!(
                super::messages::blocked::hides_from(cx, &member.account, &caller.name, now).await,
                Ok(false)
            )
        {
            continue;
        }
        let note = Notification {
            app: MODULE.name.into(),
            id: format!("{}-missed", call.id),
            title: caller.full_name.clone(),
            body: Some(match call.kind {
                Kind::Audio => "Missed FaceTime Audio".into(),
                Kind::Video => "Missed FaceTime Video".into(),
            }),
            ..Notification::default()
        };
        if let Err(error) =
            notification_center::notify(cx.storage.store(), &member.account, now, &note).await
        {
            ferrite_app::tracing::warn!(%error, "a missed call was not notified");
        }
    }
}

/// `POST /calls/<id>/live-photo`: a joined member is about to keep a picture
/// of the call, and the others are told first. A failure answers an error, and
/// the page then keeps no picture.
async fn live_photo(cx: &mut ApiCtx<'_>, me: &Account, id: &str) -> Response {
    let now = cx.now_ms;
    let call = match read(&mut cx.storage.shared(), id).await {
        Ok(Some((call, _))) if call.member(&me.id).is_some() => call,
        Ok(_) => return no_such_call(),
        Err(e) => return storage_error(&e),
    };
    if call.member(&me.id).map(|member| member.state) != Some(State::Joined) {
        return Response::error(409, "you are not in this call");
    }
    let others: Vec<String> = call
        .members
        .iter()
        .filter(|member| member.account != me.id && member.state == State::Joined)
        .map(|member| member.account.clone())
        .collect();
    for other in &others {
        let note = Notification {
            app: MODULE.name.into(),
            id: format!("{id}-live-photo-{}-{now}", me.name),
            title: me.full_name.clone(),
            body: Some("took a Live Photo of your FaceTime call".into()),
            ..Notification::default()
        };
        if let Err(error) = notification_center::notify(cx.storage.store(), other, now, &note).await
        {
            return storage_error(&error);
        }
    }
    Response::json(200, &serde_json::json!({ "told": others.len() }))
}

/// Write `line` to `account`'s list (the caller's own when `None`), unless
/// it would replace a finished line. With `create`, a missing line is made;
/// otherwise only an existing line is brought up to date, so a line the
/// person removed is never put back.
async fn put_line(
    cx: &mut ApiCtx<'_>,
    account: Option<&str>,
    line: &Recent,
    create: bool,
) -> std::io::Result<()> {
    // A Guest User's line is written only by the guest's own requests, which
    // give it the guest's expiry; their next look brings it up to date.
    if account.is_some_and(|a| a.starts_with("g-")) {
        return Ok(());
    }
    let bytes = serde_json::to_vec(line).map_err(invalid)?;
    let key = recent_key(&line.call);
    let mut storage = storage_for(cx, account);
    let mut own = storage.user();
    for _ in 0..CAS_ATTEMPTS {
        let stored = own.get_versioned(&key).await?;
        let version = match &stored {
            None if !create => return Ok(()),
            None => None,
            Some((bytes, version)) => {
                let existing: Option<Recent> = serde_json::from_slice(bytes).ok();
                if existing.is_some_and(|e| e.done) {
                    return Ok(());
                }
                Some(*version)
            }
        };
        if own.put_if_version(&key, &bytes, version).await? {
            return Ok(());
        }
    }
    Err(std::io::Error::other("a recent call kept changing"))
}

/// Prune the caller's own list to [`RECENT_LIMIT`] lines (as `lines` read
/// it), the oldest finished ones first; an unfinished line is never pruned.
/// Only a person's own requests prune their list.
async fn prune(cx: &mut ApiCtx<'_>, lines: &[Recent]) {
    let mut storage = storage_for(cx, None);
    let mut own = storage.user();
    let mut kept = 0;
    let mut deleted = 0;
    for line in lines.iter().filter(|l| l.done) {
        kept += 1;
        if kept > RECENT_LIMIT && deleted < PRUNE_PER_LOOK {
            deleted += 1;
            if let Err(error) = own.delete(&recent_key(&line.call)).await {
                ferrite_app::tracing::warn!(%error, "the oldest recent calls were not pruned");
                return;
            }
        }
    }
}

/// Bring the members' lines up to date with the call as it now stands.
async fn record(cx: &mut ApiCtx<'_>, call: &Call, me: &str) {
    for member in call.members.clone() {
        let Some(line) = recent_of(call, &member.account) else {
            continue;
        };
        let account = (member.account != me).then_some(member.account.as_str());
        if let Err(error) = put_line(cx, account, &line, false).await {
            ferrite_app::tracing::warn!(%error, "a recent call was not brought up to date");
        }
    }
}

/// A person's lines, newest first.
async fn lines(own: &mut Space<'_>) -> std::io::Result<Vec<Recent>> {
    let mut lines: Vec<Recent> = own
        .list("recents/", RECENT_SCAN)
        .await?
        .into_iter()
        .filter_map(|(_, bytes)| serde_json::from_slice(&bytes).ok())
        .collect();
    lines.sort_by(|a, b| b.at_ms.cmp(&a.at_ms).then(a.call.cmp(&b.call)));
    Ok(lines)
}

/// The person's unfinished calls, newest first, each brought up to `now`
/// and written back when that changed it, with its version.
async fn open_calls(cx: &mut ApiCtx<'_>, me: &Account) -> std::io::Result<Vec<(Call, u64)>> {
    let now = cx.now_ms;
    let open: Vec<String> = lines(&mut storage_for(cx, None).user())
        .await?
        .into_iter()
        .filter(|l| !l.done)
        .take(OPEN_LIMIT)
        .map(|l| l.call)
        .collect();
    let mut calls = Vec::new();
    for id in open {
        let mut found = None;
        for _ in 0..CAS_ATTEMPTS {
            let mut shared = cx.storage.shared();
            let Some((mut call, version)) = read(&mut shared, &id).await? else {
                break;
            };
            if call.member(&me.id).is_none() {
                break;
            }
            if !settle(&mut call, now) {
                found = Some((call, version, false));
                break;
            }
            match write(&mut shared, &call, Some(version)).await {
                Ok(Some(version)) => {
                    found = Some((call, version, true));
                    break;
                }
                Ok(None) => continue,
                Err(_) => {
                    found = Some((call, version, false));
                    break;
                }
            }
        }
        match found {
            Some((call, version, settled)) => {
                let gone = call.member(&me.id).is_some_and(|m| !m.in_call());
                if settled || call.ended_ms != 0 || gone {
                    record(cx, &call, &me.id).await;
                }
                if settled {
                    unring(cx, &call).await;
                    tell(cx, &call, &me.id).await;
                }
                calls.push((call, version));
            }
            None => {
                // The call is gone, or not this person's: its line is done.
                let mut storage = storage_for(cx, None);
                if let Ok(Some(bytes)) = storage.user().get(&recent_key(&id)).await {
                    if let Ok(mut line) = decode::<Recent>(&bytes) {
                        line.done = true;
                        if let Ok(bytes) = serde_json::to_vec(&line) {
                            let _ = storage.user().put(&recent_key(&id), &bytes).await;
                        }
                    }
                }
            }
        }
    }
    Ok(calls)
}

/// The call a person is taking their one seat in ([`SEAT_KEY`]), and when the
/// request that claimed it began.
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Claim {
    call: String,
    at_ms: u64,
}

/// Whether `claim` still keeps the person's seat at `now`. Its call, brought
/// up to `now`, decides: ended or gone after its request, or with the person
/// gone from it while it goes on for others, it holds nothing; going on, it
/// holds while the person has a seat in it. While the request
/// that made the claim is still under way ([`CLAIM_HOLD_MS`]), a call not
/// written yet, or one whose answer is not written yet, holds too.
async fn claim_holds(
    cx: &mut ApiCtx<'_>,
    me: &Account,
    claim: &Claim,
    now: u64,
) -> std::io::Result<bool> {
    let under_way = now < claim.at_ms.saturating_add(CLAIM_HOLD_MS);
    Ok(match read(&mut cx.storage.shared(), &claim.call).await? {
        Some((mut call, _)) => {
            settle(&mut call, now);
            let gone = call.member(&me.id).is_some_and(|m| !m.in_call());
            call.ended_ms == 0 && !gone && (call.seat_of(&me.id).is_some() || under_way)
        }
        None => under_way,
    })
}

/// Claim the person's one seat for call `id`, before the request places or
/// answers it: `Ok(Ok(version))` once claimed, with the version written (for
/// [`confirm_seat`]), `Ok(Err(other))` when the claim of another call still
/// holds ([`claim_holds`]). The claim is written with compare-and-set over the
/// one this read, and written again even for the same call, so two requests
/// at once from two windows never both get it: the one that loses reads the
/// winner's claim, which holds, and is refused.
async fn claim_seat(
    cx: &mut ApiCtx<'_>,
    me: &Account,
    id: &str,
) -> std::io::Result<Result<u64, String>> {
    let now = cx.now_ms;
    let bytes = serde_json::to_vec(&Claim {
        call: id.to_string(),
        at_ms: now,
    })
    .map_err(invalid)?;
    for _ in 0..CAS_ATTEMPTS {
        let stored = storage_for(cx, None).user().get_versioned(SEAT_KEY).await?;
        let version = stored.as_ref().map(|(_, version)| *version);
        let claim = stored
            .as_ref()
            .and_then(|(bytes, _)| serde_json::from_slice::<Claim>(bytes).ok());
        if let Some(claim) = claim {
            if claim.call != id && claim_holds(cx, me, &claim, now).await? {
                return Ok(Err(claim.call));
            }
        }
        if storage_for(cx, None)
            .user()
            .put_if_version(SEAT_KEY, &bytes, version)
            .await?
        {
            // The version just written; a claim another request wrote since
            // for another call has taken the seat from this request. One for
            // this same call (a retry, or another page of it) leaves the seat
            // this call's, and is the version to confirm over.
            match storage_for(cx, None).user().get_versioned(SEAT_KEY).await? {
                Some((stored, version)) if stored == bytes => return Ok(Ok(version)),
                Some((stored, version)) => {
                    let claim = decode::<Claim>(&stored)?;
                    if claim.call == id {
                        return Ok(Ok(version));
                    }
                    return Ok(Err(claim.call));
                }
                None => continue,
            }
        }
    }
    Err(std::io::Error::other("the person's seat kept changing"))
}

/// Who holds the person's seat, once a request has written its own.
enum Seated {
    /// This request's call: the claim names it at a version past the one
    /// claimed, so a request that read the claim before can no longer take it.
    Ours,
    /// Another call took the seat over: the claim names it.
    Theirs(String),
}

/// Confirm this request's claim on call `id` once its seat is written, with
/// compare-and-set over the `version` it was claimed at, reading the claim
/// as it now stands: still at that version, it is written again; for this
/// same call at a later version (this request's own confirmation, or a retry
/// or another page of the same call), the seat is this call's either way;
/// for another call (this request was slower than [`CLAIM_HOLD_MS`] and was
/// taken over), the seat is theirs and this request takes its seat back. A
/// request still to take the claim over finds it changed, reads it again,
/// and finds its call holding the seat. A store that fails is an error, never
/// read as either answer: the request is refused with the seat written, and
/// the page's retry confirms it.
async fn confirm_seat(cx: &mut ApiCtx<'_>, id: &str, claimed: u64) -> std::io::Result<Seated> {
    let bytes = serde_json::to_vec(&Claim {
        call: id.to_string(),
        at_ms: cx.now_ms,
    })
    .map_err(invalid)?;
    for _ in 0..CAS_ATTEMPTS {
        let stored = storage_for(cx, None).user().get_versioned(SEAT_KEY).await?;
        let version = match stored {
            Some((stored, version)) => {
                let call = decode::<Claim>(&stored)?.call;
                if call != id {
                    return Ok(Seated::Theirs(call));
                }
                if version != claimed {
                    return Ok(Seated::Ours);
                }
                Some(version)
            }
            // Gone (a guest's data expired): claimed again for this call.
            None => None,
        };
        if storage_for(cx, None)
            .user()
            .put_if_version(SEAT_KEY, &bytes, version)
            .await?
        {
            return Ok(Seated::Ours);
        }
    }
    Err(std::io::Error::other("the person's seat kept changing"))
}

/// Take back the seat a join took in call `id`, when its claim was taken
/// over by another request: the person leaves, as a hang-up from that page
/// would make them.
async fn undo_join(cx: &mut ApiCtx<'_>, me: &Account, id: &str) {
    let now = cx.now_ms;
    let body = cx.request.body.to_vec();
    let Ok(join) = serde_json::from_slice::<Join>(&body) else {
        return;
    };
    for _ in 0..CAS_ATTEMPTS {
        let Ok(Some((mut call, version))) = read(&mut cx.storage.shared(), id).await else {
            return;
        };
        let ours = call.member(&me.id).is_some_and(|m| {
            m.state == State::Joined && m.seat.as_ref().is_some_and(|s| s.page == join.page)
        });
        if call.ended_ms != 0 || !ours {
            return;
        }
        if let Some(member) = call.member_mut(&me.id) {
            depart(member, now);
        }
        conclude(&mut call, now);
        match write(&mut cx.storage.shared(), &call, Some(version)).await {
            Ok(Some(_)) => {
                record(cx, &call, &me.id).await;
                unring(cx, &call).await;
                tell(cx, &call, &me.id).await;
                return;
            }
            Ok(None) => continue,
            Err(_) => return,
        }
    }
}

/// Let go of this request's claim on call `id` when it did not take the seat
/// after all (the call was not placed, or the answer was refused), so that it
/// does not hold for [`CLAIM_HOLD_MS`]. Only a claim still for `id`, made at
/// this request's time, goes; it never fails the request.
async fn release_seat(cx: &mut ApiCtx<'_>, id: &str) {
    let now = cx.now_ms;
    let mut storage = storage_for(cx, None);
    let mut own = storage.user();
    let Ok(Some((bytes, version))) = own.get_versioned(SEAT_KEY).await else {
        return;
    };
    let ours = serde_json::from_slice::<Claim>(&bytes)
        .is_ok_and(|claim| claim.call == id && claim.at_ms == now);
    if !ours {
        return;
    }
    let released = Claim {
        call: id.to_string(),
        at_ms: 0,
    };
    if let Ok(bytes) = serde_json::to_vec(&released) {
        if let Err(error) = own.put_if_version(SEAT_KEY, &bytes, Some(version)).await {
            ferrite_app::tracing::warn!(%error, "a seat claimed for nothing was not let go");
        }
    }
}

/// The refusal of a second call (`409`), with the call that holds the
/// person's seat as it stands, when it can be read: the claim of a request
/// still under way may name a call not written yet.
async fn already_in_call(cx: &mut ApiCtx<'_>, me: &Account, other: &str) -> Response {
    let now = cx.now_ms;
    let found = read(&mut cx.storage.shared(), other).await.ok().flatten();
    match found.filter(|(call, _)| call.member(&me.id).is_some()) {
        Some((call, version)) => Response::json(
            409,
            &serde_json::json!({
                "error": "You are already in a call.",
                "version": version,
                "state": view_for(&call, &me.id, false),
                "server_ms": now,
            }),
        ),
        None => Response::json(
            409,
            &serde_json::json!({ "error": "You are already in a call.", "server_ms": now }),
        ),
    }
}

async fn overview(cx: &mut ApiCtx<'_>, me: &Account) -> Response {
    let now = cx.now_ms;
    let open = match open_calls(cx, me).await {
        Ok(open) => open,
        Err(e) => return storage_error(&e),
    };
    let recents = match lines(&mut storage_for(cx, None).user()).await {
        Ok(mut lines) => {
            prune(cx, &lines).await;
            lines.truncate(RECENT_LIMIT);
            lines
        }
        Err(e) => return storage_error(&e),
    };
    let state_of = |call: &Call| call.member(&me.id).map(|m| m.state);
    let incoming = open
        .iter()
        .find(|(call, _)| call.ended_ms == 0 && state_of(call) == Some(State::Ringing))
        .map(|(call, version)| serde_json::json!({ "version": version, "state": view_for(call, &me.id, false) }));
    let active = open
        .iter()
        .find(|(call, _)| call.ended_ms == 0 && state_of(call) == Some(State::Joined))
        .map(|(call, version)| serde_json::json!({ "version": version, "state": view_for(call, &me.id, false) }));
    Response::json(
        200,
        &serde_json::json!({ "recents": recents, "incoming": incoming, "active": active, "server_ms": now }),
    )
}

/// The calls a person's keyed requests placed: a digest of each request's
/// `idempotency-key`, with the random id the first request got.
#[derive(serde::Serialize, serde::Deserialize, Default)]
#[serde(crate = "ferrite_app::serde")]
struct Keyed {
    entries: Vec<(String, String)>,
}

/// The id of the call a request places: 128 random bits. A request that
/// carries the page's own `idempotency-key` gets the id the first request
/// with that key got, so a resend finds the call the first delivery made.
async fn new_call_id(cx: &mut ApiCtx<'_>) -> std::io::Result<String> {
    let Some(key) = cx.request.idempotency_key else {
        return crate::crypto::random_token(16);
    };
    let digest = ferrite_app::crypto::hex(&ferrite_app::crypto::sha256(
        format!("facetime-call\0{key}").as_bytes(),
    ));
    let mut storage = storage_for(cx, None);
    let mut own = storage.user();
    for _ in 0..CAS_ATTEMPTS {
        let (mut keyed, version) = match own.get_versioned("keyed-calls").await? {
            Some((bytes, version)) => (decode::<Keyed>(&bytes)?, Some(version)),
            None => (Keyed::default(), None),
        };
        if let Some((_, id)) = keyed.entries.iter().find(|(d, _)| *d == digest) {
            return Ok(id.clone());
        }
        let id = crate::crypto::random_token(16)?;
        keyed.entries.insert(0, (digest.clone(), id.clone()));
        keyed.entries.truncate(KEYED_LIMIT);
        let bytes = serde_json::to_vec(&keyed).map_err(invalid)?;
        if own.put_if_version("keyed-calls", &bytes, version).await? {
            return Ok(id);
        }
    }
    Err(std::io::Error::other("the call keys kept changing"))
}

/// The ringing notification for the person called.
async fn ring(cx: &mut ApiCtx<'_>, call: &Call, from: &Account, to: &Account) {
    let note = Notification {
        app: MODULE.name.into(),
        id: call.id.clone(),
        title: from.full_name.clone(),
        body: Some(match call.kind {
            Kind::Audio => "FaceTime Audio".into(),
            Kind::Video => "FaceTime Video".into(),
        }),
        alert: true,
        actions: vec![
            Action {
                label: "Decline".into(),
                post: Some(format!("/calls/{}/decline", call.id)),
            },
            Action {
                label: "Answer".into(),
                post: None,
            },
        ],
        ..Notification::default()
    };
    let now = cx.now_ms;
    if let Err(error) = notification_center::notify(cx.storage.store(), &to.id, now, &note).await {
        ferrite_app::tracing::warn!(%error, "a call was not notified");
    }
}

async fn place(cx: &mut ApiCtx<'_>, me: &Account) -> Response {
    let place: Place = match cx.request.json() {
        Ok(place) => place,
        Err(response) => return response,
    };
    if !is_page(&place.page) {
        return Response::error(400, "a page token is 16 to 64 letters, digits, '-' or '_'");
    }
    let them = match callee(cx, me, &place.to).await {
        Ok(them) => them,
        Err(refusal) => return refusal,
    };
    let now = cx.now_ms;
    let id = match new_call_id(cx).await {
        Ok(id) => id,
        Err(e) => return storage_error(&e),
    };
    // A resend finds the call the first delivery placed.
    let existing = match read(&mut cx.storage.shared(), &id).await {
        Ok(existing) => existing,
        Err(e) => return storage_error(&e),
    };
    if let Some((call, version)) = existing {
        let same = call.caller().is_some_and(|m| m.account == me.id)
            && call.members.get(1).is_some_and(|m| m.account == them.id)
            && call.kind == place.kind;
        if !same {
            return Response::error(409, "that idempotency key placed another call");
        }
        return placed(cx, &call, version, me, &them, 200).await;
    }
    // One call at a time: a seat held in another call refuses a new one.
    let open = match open_calls(cx, me).await {
        Ok(open) => open,
        Err(e) => return storage_error(&e),
    };
    if let Some((call, version)) = open
        .iter()
        .find(|(call, _)| call.ended_ms == 0 && call.seat_of(&me.id).is_some())
    {
        return Response::json(
            409,
            &serde_json::json!({
                "error": "You are already in a call.",
                "version": version,
                "state": view_for(call, &me.id, false),
                "server_ms": now,
            }),
        );
    }
    if let Err(refusal) = may_ring(cx, me, &them).await {
        return refusal;
    }
    // The check above read the person's calls; a request from another window
    // of theirs may be placing or answering one at this moment. The seat is
    // claimed with compare-and-set, so only one of them gets it.
    let claimed = match claim_seat(cx, me, &id).await {
        Ok(Ok(version)) => version,
        Ok(Err(other)) => return already_in_call(cx, me, &other).await,
        Err(e) => return storage_error(&e),
    };
    let call = Call {
        id: id.clone(),
        kind: place.kind,
        created_ms: now,
        connected_ms: 0,
        ended_ms: 0,
        next_seat: 2,
        members: vec![
            Member {
                account: me.id.clone(),
                name: me.name.clone(),
                full_name: me.full_name.clone(),
                state: State::Joined,
                seat: Some(Seat {
                    n: 1,
                    page: place.page,
                    seen_ms: now,
                }),
                joined_ms: now,
                left_ms: 0,
                joins: Vec::new(),
                rang_ms: 0,
                added_by: None,
            },
            Member {
                account: them.id.clone(),
                name: them.name.clone(),
                full_name: them.full_name.clone(),
                state: State::Ringing,
                seat: None,
                joined_ms: 0,
                left_ms: 0,
                joins: Vec::new(),
                rang_ms: 0,
                added_by: None,
            },
        ],
        links: Vec::new(),
    };
    // The call is written first, naming both members, and only then put on
    // either list: its id reaches nobody it does not name.
    let written = write(&mut cx.storage.shared(), &call, None).await;
    match written {
        Ok(Some(version)) => match confirm_seat(cx, &id, claimed).await {
            Ok(Seated::Ours) => placed(cx, &call, version, me, &them, 201).await,
            Ok(Seated::Theirs(other)) => {
                // Another call took the seat over while this request was under
                // way: the call is taken back before anyone hears of it (no
                // line and no ring are written yet).
                if let Err(error) = cx.storage.shared().delete(&call_key(&id)).await {
                    ferrite_app::tracing::warn!(%error, "a call placed without its seat stayed");
                }
                already_in_call(cx, me, &other).await
            }
            // The call stays written: the page's retry (the same idempotency
            // key) finds it and confirms its seat.
            Err(e) => storage_error(&e),
        },
        Ok(None) => {
            release_seat(cx, &id).await;
            Response::error(503, "the call could not be placed; retry")
        }
        Err(response) => {
            release_seat(cx, &id).await;
            response
        }
    }
}

/// The account a call or an addition names: refused when nobody has that
/// name (a Guest User has none), and when it is the person's own.
async fn callee(cx: &mut ApiCtx<'_>, me: &Account, to: &str) -> Result<Account, Response> {
    let them = match crate::accounts::lookup(cx.storage.store(), to).await {
        Ok(Some(them)) => them,
        Ok(None) => {
            return Err(Response::error(
                404,
                &format!(
                    "No one on this desktop has the account name \u{201c}{}\u{201d}.",
                    to.trim()
                ),
            ))
        }
        Err(e) => return Err(storage_error(&e)),
    };
    if them.id == me.id {
        return Err(Response::error(400, "You cannot call yourself."));
    }
    Ok(them)
}

/// Whether `me` may ring `them` now. Others' calls add lines to their list,
/// which only their own looks prune: a list that full takes no more until they
/// look. Nor may one person ring the same person more than a few times an hour.
async fn may_ring(cx: &mut ApiCtx<'_>, me: &Account, them: &Account) -> Result<(), Response> {
    let now = cx.now_ms;
    let theirs = match lines(&mut storage_for(cx, Some(&them.id)).user()).await {
        Ok(theirs) => theirs,
        Err(e) => return Err(storage_error(&e)),
    };
    if theirs.len() >= LINE_CAP {
        return Err(Response::error(
            409,
            &format!("{} cannot take more calls now.", them.full_name),
        ));
    }
    let rings = theirs.iter().filter(|l| {
        (l.with.name == me.name || l.added_by.as_deref() == Some(me.name.as_str()))
            && l.at_ms.saturating_add(HOUR_MS) > now
    });
    if rings.count() >= CALLS_PER_HOUR {
        return Err(Response::error(
            409,
            &format!(
                "You have called {} {CALLS_PER_HOUR} times in the last hour. Try again later.",
                them.full_name
            ),
        ));
    }
    Ok(())
}

/// Put `added` on the call as someone ringing: `Ok(true)` when they join the
/// list, `Ok(false)` when they ring already (a resend), or the refusal. A link
/// past the room the people now in the call leave goes; a connection already
/// made does not need it, and an offer not yet answered is made again.
fn add_member(call: &mut Call, me: &str, added: Member) -> Result<bool, Response> {
    let refuse =
        |message: String| -> Result<bool, Response> { Err(Response::error(409, &message)) };
    if call.ended_ms != 0 {
        return refuse("This call has ended.".into());
    }
    if call.member(me).is_none_or(|m| m.state != State::Joined) {
        return refuse("Only someone in the call can add a person.".into());
    }
    match call.member(&added.account) {
        Some(m) if m.state == State::Ringing => return Ok(false),
        Some(m) if m.state == State::Joined => {
            return refuse(format!("{} is already in this call.", m.full_name))
        }
        Some(m) => return refuse(format!("{} has already been in this call.", m.full_name)),
        None => {}
    }
    if call.in_call() >= MAX_MEMBERS {
        return refuse(format!("A call holds at most {MAX_MEMBERS} people."));
    }
    if call.members.len() >= MAX_ROSTER {
        return refuse("Too many people have been in this call to add another.".into());
    }
    call.members.push(added);
    let room = description_room(call);
    call.links.retain(|l| {
        encoded_len(&l.offer) <= room && l.answer.as_deref().is_none_or(|a| encoded_len(a) <= room)
    });
    Ok(true)
}

/// Ring one more person in a call under way (`POST .../add`).
async fn add(cx: &mut ApiCtx<'_>, me: &Account, id: &str) -> Response {
    let add: Add = match cx.request.json() {
        Ok(add) => add,
        Err(response) => return response,
    };
    let them = match callee(cx, me, &add.to).await {
        Ok(them) => them,
        Err(refusal) => return refusal,
    };
    let now = cx.now_ms;
    let mut checked = false;
    for _ in 0..CAS_ATTEMPTS {
        let (mut call, version) = match read(&mut cx.storage.shared(), id).await {
            Ok(Some(found)) if found.0.member(&me.id).is_some() => found,
            Ok(_) => return no_such_call(),
            Err(e) => return storage_error(&e),
        };
        let settled = settle(&mut call, now);
        let added = Member {
            account: them.id.clone(),
            name: them.name.clone(),
            full_name: them.full_name.clone(),
            state: State::Ringing,
            seat: None,
            joined_ms: 0,
            left_ms: 0,
            joins: Vec::new(),
            rang_ms: now,
            added_by: Some(me.name.clone()),
        };
        let new = match add_member(&mut call, &me.id, added) {
            Ok(new) => new,
            Err(refusal) => return with_call(refusal, version, &call, now, &me.id),
        };
        // A resend finds the person ringing, whose ring this request does not
        // count again.
        if new && !checked {
            if let Err(refusal) = may_ring(cx, me, &them).await {
                return refusal;
            }
            checked = true;
        }
        let version = match write(&mut cx.storage.shared(), &call, Some(version)).await {
            Ok(Some(version)) => version,
            Ok(None) => continue,
            Err(response) => return response,
        };
        if settled {
            unring(cx, &call).await;
        }
        return rung(cx, &call, version, me, &them, if new { 201 } else { 200 }).await;
    }
    Response::error(503, "the call is busy; retry")
}

/// What adding answers, for someone added now or by a delivery before: their
/// line and ring, unless they have blocked someone joined in the call, in which
/// case they hear nothing and their ring runs out; the others' lines, and the call.
async fn rung(
    cx: &mut ApiCtx<'_>,
    call: &Call,
    version: u64,
    me: &Account,
    them: &Account,
    status: u16,
) -> Response {
    let now = cx.now_ms;
    let mut unheard = false;
    let joined = call
        .members
        .iter()
        .filter(|m| m.account != them.id && m.state == State::Joined);
    for member in joined {
        match super::messages::blocked::hides_from(cx, &them.id, &member.name, now).await {
            Ok(hides) => unheard = unheard || hides,
            Err(e) => return storage_error(&e),
        }
    }
    if !unheard {
        if let Some(line) = recent_of(call, &them.id) {
            if let Err(e) = put_line(cx, Some(&them.id), &line, true).await {
                return storage_error(&e);
            }
        }
        ring(cx, call, me, them).await;
    }
    record(cx, call, &me.id).await;
    tell_but(cx, call, &me.id, unheard.then_some(them.id.as_str())).await;
    reply(status, version, call, now, &me.id)
}

/// What placing answers, for a call made now or by a delivery before: the
/// caller's and the callee's lines, the ring while it rings, and the call.
async fn placed(
    cx: &mut ApiCtx<'_>,
    call: &Call,
    version: u64,
    me: &Account,
    them: &Account,
    status: u16,
) -> Response {
    // A person who blocked the caller hears nothing of it: no line, no ring, no change in their
    // FaceTime. The caller's call rings out, as one nobody answers.
    let unheard =
        match super::messages::blocked::hides_from(cx, &them.id, &me.name, call.created_ms).await {
            Ok(unheard) => unheard,
            Err(e) => return storage_error(&e),
        };
    for member in call.members.iter().take(2) {
        let Some(line) = recent_of(call, &member.account) else {
            continue;
        };
        if unheard && member.account == them.id {
            continue;
        }
        let account = (member.account != me.id).then_some(member.account.as_str());
        if let Err(e) = put_line(cx, account, &line, true).await {
            return storage_error(&e);
        }
    }
    // The caller's own list is pruned here; the callee's only by the
    // callee's own looks.
    if let Ok(own) = lines(&mut storage_for(cx, None).user()).await {
        prune(cx, &own).await;
    }
    if !unheard
        && call.ended_ms == 0
        && call
            .members
            .get(1)
            .is_some_and(|m| m.state == State::Ringing)
    {
        ring(cx, call, me, them).await;
    }
    if !unheard {
        tell(cx, call, &me.id).await;
    }
    reply(status, version, call, cx.now_ms, &me.id)
}

async fn read_call(cx: &mut ApiCtx<'_>, me: &Account, id: &str) -> Response {
    let now = cx.now_ms;
    let seat = cx
        .request
        .query_param("seat")
        .and_then(|s| s.parse::<u32>().ok());
    for _ in 0..CAS_ATTEMPTS {
        let mut shared = cx.storage.shared();
        let (mut call, version) = match read(&mut shared, id).await {
            Ok(Some(found)) if found.0.member(&me.id).is_some() => found,
            Ok(_) => return no_such_call(),
            Err(e) => return storage_error(&e),
        };
        // The page holding `seat` is heard from: its seat stays. Written at
        // most every few seconds; the call is brought up to date as well.
        let mut changed = false;
        if let Some(n) = seat {
            if let Some(held) = call
                .member_mut(&me.id)
                .filter(|m| m.state == State::Joined)
                .and_then(|m| m.seat.as_mut())
                .filter(|s| s.n == n)
            {
                if now >= held.seen_ms.saturating_add(ALIVE_WRITE_MS) {
                    held.seen_ms = now;
                    changed = true;
                }
            }
        }
        let settled = settle(&mut call, now);
        if !(changed || settled) {
            return reply(200, version, &call, now, &me.id);
        }
        match write(&mut shared, &call, Some(version)).await {
            Ok(Some(version)) => {
                if settled {
                    record(cx, &call, &me.id).await;
                    unring(cx, &call).await;
                    tell(cx, &call, &me.id).await;
                }
                return reply(200, version, &call, now, &me.id);
            }
            Ok(None) => continue,
            Err(response) => return response,
        }
    }
    Response::error(503, "the call is busy; retry")
}

/// What one action does to the call: `Ok(true)` when it changed it,
/// `Ok(false)` when it stands as it is (a resend, or a hang-up from a seat
/// given up), or the refusal.
/// The digest a join's idempotency key is remembered by.
fn join_digest(key: &str) -> String {
    let digest = ferrite_app::crypto::hex(&ferrite_app::crypto::sha256(
        format!("facetime-join\0{key}").as_bytes(),
    ));
    digest[..16].to_string()
}

/// Whether `description` is past its share of a call of more than two people.
/// Between two people a description has the whole of [`MAX_SDP_BYTES`].
fn too_large_for(call: &Call, description: &str) -> bool {
    call.in_call() > 2 && encoded_len(description) > description_room(call)
}

fn too_large() -> Response {
    Response::error(
        413,
        "this connection's details are too large for a call of this many people",
    )
}

fn apply(
    call: &mut Call,
    me: &str,
    action: &str,
    body: &[u8],
    now: u64,
    key: Option<&str>,
) -> Result<bool, Response> {
    let refuse = |message: &str| -> Result<bool, Response> { Err(Response::error(409, message)) };
    let parse = |bytes: &[u8]| {
        serde_json::from_slice::<serde_json::Value>(if bytes.is_empty() { b"{}" } else { bytes })
            .map_err(|e| Response::error(400, &format!("the body is not JSON: {e}")))
    };
    match action {
        "join" => {
            let join: Join = serde_json::from_value(parse(body)?)
                .map_err(|e| Response::error(400, &format!("a join names its page: {e}")))?;
            if !is_page(&join.page) {
                return Err(Response::error(
                    400,
                    "a page token is 16 to 64 letters, digits, '-' or '_'",
                ));
            }
            if call.ended_ms != 0 {
                return refuse("This call has ended.");
            }
            let next = call.next_seat;
            let other_joined = call
                .members
                .iter()
                .any(|m| m.account != me && m.state == State::Joined);
            let Some(member) = call.member_mut(me) else {
                return Err(no_such_call());
            };
            // A join delivered again, after a later page may have taken the
            // seat: it changes nothing.
            let digest = key.map(join_digest);
            if digest.as_ref().is_some_and(|d| member.joins.contains(d)) {
                return Ok(false);
            }
            if let Some(digest) = digest {
                member.joins.insert(0, digest);
                member.joins.truncate(JOIN_KEYS);
            }
            match member.state {
                State::Joined => {
                    if member.seat.as_ref().is_some_and(|s| s.page == join.page) {
                        // A resend of this page's join keeps its seat.
                        if let Some(seat) = member.seat.as_mut() {
                            seat.seen_ms = now;
                        }
                        return Ok(true);
                    }
                }
                State::Ringing => {
                    member.state = State::Joined;
                    member.joined_ms = now;
                }
                _ => return refuse("You are no longer in this call."),
            }
            // A new page takes a new seat, which replaces the old one.
            member.seat = Some(Seat {
                n: next,
                page: join.page,
                seen_ms: now,
            });
            call.next_seat = next.saturating_add(1);
            if other_joined && call.connected_ms == 0 {
                call.connected_ms = now;
            }
            drop_unheld_links(call);
            Ok(true)
        }
        "decline" => {
            let Some(member) = call.member(me) else {
                return Err(no_such_call());
            };
            match member.state {
                State::Declined => Ok(false),
                State::Ringing if call.ended_ms == 0 => {
                    if let Some(member) = call.member_mut(me) {
                        stop_ringing(member, State::Declined, now);
                    }
                    conclude(call, now);
                    Ok(true)
                }
                _ if call.ended_ms != 0 => Ok(false),
                _ => refuse("Only a call that rings for you can be declined."),
            }
        }
        "leave" => {
            let leave: Leave = serde_json::from_value(parse(body)?)
                .map_err(|e| Response::error(400, &format!("a leave names its seat: {e}")))?;
            if call.ended_ms != 0 || call.seat_of(me) != Some(leave.seat) {
                // Over already, or a seat this person has given up: a page
                // that was replaced does not end the call of its successor.
                return Ok(false);
            }
            if let Some(member) = call.member_mut(me) {
                depart(member, now);
            }
            conclude(call, now);
            Ok(true)
        }
        _ => {
            let signal: Signal = serde_json::from_value(parse(body)?)
                .map_err(|e| Response::error(400, &format!("a signal names two seats: {e}")))?;
            if call.ended_ms != 0 {
                return refuse("This call has ended.");
            }
            if call.seat_of(me) != Some(signal.from) {
                return refuse("That seat is no longer yours.");
            }
            if signal.from == signal.to || !call.held(signal.to) {
                return refuse("No one in the call holds that seat.");
            }
            match (signal.offer, signal.answer) {
                (Some(offer), None) => {
                    if offer.is_empty() || offer.len() > MAX_SDP_BYTES {
                        return Err(Response::error(400, "an offer is 1 byte to 64 KiB"));
                    }
                    if too_large_for(call, &offer) {
                        return Err(too_large());
                    }
                    if signal.from < signal.to {
                        return refuse("The later seat offers; this seat answers.");
                    }
                    let revision = signal.revision.unwrap_or(0);
                    let pair = call
                        .links
                        .iter()
                        .position(|l| l.from == signal.from && l.to == signal.to);
                    if let Some(link) = pair.map(|at| &call.links[at]) {
                        if link.revision == revision && link.offer == offer {
                            return Ok(false);
                        }
                        if link.revision >= revision {
                            return refuse("A newer offer has replaced this one.");
                        }
                    }
                    let generation = pair.map_or(1, |at| call.links[at].generation + 1);
                    let link = Link {
                        from: signal.from,
                        to: signal.to,
                        offer,
                        generation,
                        revision,
                        answer: None,
                    };
                    match pair {
                        Some(at) => call.links[at] = link,
                        None => call.links.push(link),
                    }
                    Ok(true)
                }
                (None, Some(answer)) => {
                    if answer.is_empty() || answer.len() > MAX_SDP_BYTES {
                        return Err(Response::error(400, "an answer is 1 byte to 64 KiB"));
                    }
                    if too_large_for(call, &answer) {
                        return Err(too_large());
                    }
                    let Some(link) = call
                        .links
                        .iter_mut()
                        .find(|l| l.from == signal.to && l.to == signal.from)
                    else {
                        return refuse("There is no offer from that seat to answer.");
                    };
                    if signal.generation != Some(link.generation) {
                        return refuse("That offer has been replaced.");
                    }
                    if link.answer.as_deref() == Some(answer.as_str()) {
                        return Ok(false);
                    }
                    link.answer = Some(answer);
                    Ok(true)
                }
                _ => Err(Response::error(400, "a signal is an offer or an answer")),
            }
        }
    }
}

async fn act(cx: &mut ApiCtx<'_>, me: &Account, id: &str, action: &str) -> Response {
    let now = cx.now_ms;
    if action == "join" {
        // One call at a time: a seat held in another call refuses a join.
        let open = match open_calls(cx, me).await {
            Ok(open) => open,
            Err(e) => return storage_error(&e),
        };
        if let Some((other, version)) = open
            .iter()
            .find(|(c, _)| c.id != id && c.ended_ms == 0 && c.seat_of(&me.id).is_some())
        {
            return Response::json(
                409,
                &serde_json::json!({
                    "error": "You are already in a call.",
                    "version": version,
                    "state": view_for(other, &me.id, false),
                    "server_ms": now,
                }),
            );
        }
        // And of two answers at once from two windows, only one gets the seat.
        let claimed = match claim_seat(cx, me, id).await {
            Ok(Ok(version)) => version,
            Ok(Err(other)) => return already_in_call(cx, me, &other).await,
            Err(e) => return storage_error(&e),
        };
        let response = act_on(cx, me, id, action).await;
        if response.status >= 400 {
            release_seat(cx, id).await;
            return response;
        }
        return match confirm_seat(cx, id, claimed).await {
            Ok(Seated::Ours) => response,
            Ok(Seated::Theirs(other)) => {
                // Another call took the seat over meanwhile: this answer gives
                // back the seat it took.
                undo_join(cx, me, id).await;
                already_in_call(cx, me, &other).await
            }
            // The seat stays written: the page's retry of its join keeps it
            // and confirms it.
            Err(e) => storage_error(&e),
        };
    }
    act_on(cx, me, id, action).await
}

/// One action on the call, written with compare-and-set.
async fn act_on(cx: &mut ApiCtx<'_>, me: &Account, id: &str, action: &str) -> Response {
    let now = cx.now_ms;
    let body = cx.request.body.to_vec();
    let key = cx.request.idempotency_key.map(str::to_string);
    for _ in 0..CAS_ATTEMPTS {
        let mut shared = cx.storage.shared();
        let (mut call, version) = match read(&mut shared, id).await {
            Ok(Some(found)) if found.0.member(&me.id).is_some() => found,
            Ok(_) => return no_such_call(),
            Err(e) => return storage_error(&e),
        };
        let ended_before = call.ended_ms != 0;
        let gone_before = call.gone();
        let settled = settle(&mut call, now);
        let was_ringing = call
            .member(&me.id)
            .is_some_and(|m| m.state == State::Ringing);
        let changed = match apply(&mut call, &me.id, action, &body, now, key.as_deref()) {
            Ok(changed) => changed,
            Err(refusal) if settled => {
                // The refusal stands, but the call as brought up to date is
                // still kept.
                let mut current = version;
                if let Ok(Some(written)) = write(&mut shared, &call, Some(version)).await {
                    current = written;
                    record(cx, &call, &me.id).await;
                    unring(cx, &call).await;
                    tell(cx, &call, &me.id).await;
                }
                return with_call(refusal, current, &call, now, &me.id);
            }
            Err(refusal) => return with_call(refusal, version, &call, now, &me.id),
        };
        if !(changed || settled) {
            return reply(200, version, &call, now, &me.id);
        }
        match write(&mut shared, &call, Some(version)).await {
            Ok(Some(version)) => {
                if (call.ended_ms != 0 && !ended_before) || call.gone() != gone_before {
                    record(cx, &call, &me.id).await;
                }
                // The ring goes once the call ends, the person it rings for
                // answers or declines, or their time runs out; the caller taking
                // the call up in another window leaves it.
                if settled || call.ended_ms != 0 || was_ringing {
                    unring(cx, &call).await;
                }
                tell(cx, &call, &me.id).await;
                return reply(200, version, &call, now, &me.id);
            }
            Ok(None) => continue,
            Err(response) => return response,
        }
    }
    Response::error(503, "the call is busy; retry")
}

/// Remove the person's finished recent calls, or one of them. A call in
/// progress stays listed: it is how the person's pages find it.
async fn forget(cx: &mut ApiCtx<'_>, id: Option<&str>) -> Response {
    let mut storage = storage_for(cx, None);
    let mut own = storage.user();
    let lines = match lines(&mut own).await {
        Ok(lines) => lines,
        Err(e) => return storage_error(&e),
    };
    let mut removed = 0;
    for line in lines.iter().filter(|l| id.is_none_or(|id| l.call == id)) {
        if !line.done {
            if id.is_some() {
                return Response::error(409, "A call in progress stays in your recent calls.");
            }
            continue;
        }
        if let Err(e) = own.delete(&recent_key(&line.call)).await {
            return storage_error(&e);
        }
        removed += 1;
    }
    Response::json(200, &serde_json::json!({ "removed": removed }))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// One action, without an idempotency key.
    fn act(
        call: &mut Call,
        me: &str,
        action: &str,
        body: &[u8],
        now: u64,
    ) -> Result<bool, Response> {
        apply(call, me, action, body, now, None)
    }

    #[test]
    fn a_join_delivered_again_after_a_later_page_took_the_seat_changes_nothing() {
        let mut call = ringing();
        let first = br#"{"page":"page-bob-first-01"}"#;
        assert!(apply(&mut call, "bob", "join", first, 2_000, Some("k1")).unwrap());
        assert_eq!(call.seat_of("bob"), Some(3));
        apply(
            &mut call,
            "bob",
            "join",
            br#"{"page":"page-bob-second-2"}"#,
            3_000,
            Some("k2"),
        )
        .unwrap();
        assert_eq!(call.seat_of("bob"), Some(4));
        // The first page's join, delivered again: the second page keeps the seat.
        assert!(!apply(&mut call, "bob", "join", first, 3_500, Some("k1")).unwrap());
        assert_eq!(call.seat_of("bob"), Some(4));
        // A new join from the first page (Join Here pressed there) takes it back.
        apply(&mut call, "bob", "join", first, 4_000, Some("k3")).unwrap();
        assert_eq!(call.seat_of("bob"), Some(5));
        assert!(!view_for(&call, "ada", true).to_string().contains("joins"));
    }

    fn member(account: &str, state: State, seat: Option<u32>, seen_ms: u64) -> Member {
        Member {
            account: account.into(),
            name: account.into(),
            full_name: account.to_uppercase(),
            state,
            seat: seat.map(|n| Seat {
                n,
                page: format!("page-of-{account}-{n}"),
                seen_ms,
            }),
            joined_ms: if state == State::Joined { 1 } else { 0 },
            left_ms: 0,
            joins: Vec::new(),
            rang_ms: 0,
            added_by: None,
        }
    }

    fn call(members: Vec<Member>) -> Call {
        Call {
            id: "0".repeat(32),
            kind: Kind::Video,
            created_ms: 1_000,
            connected_ms: 0,
            ended_ms: 0,
            next_seat: 3,
            members,
            links: Vec::new(),
        }
    }

    fn ringing() -> Call {
        call(vec![
            member("ada", State::Joined, Some(1), 1_000),
            member("bob", State::Ringing, None, 0),
        ])
    }

    #[test]
    fn tokens_and_pages() {
        assert!(is_token(&"a".repeat(32)));
        assert!(!is_token("short"));
        assert!(is_page("0123456789abcdef"));
        assert!(is_page(&"x".repeat(64)));
        assert!(!is_page("short"));
        assert!(!is_page("0123456789abcde/"));
    }

    #[test]
    fn a_call_nobody_answers_is_missed_and_ends() {
        let mut call = ringing();
        // Ada's page is still heard from while it rings.
        call.members[0] = member("ada", State::Joined, Some(1), 40_000);
        assert!(!settle(&mut call, 1_000 + RING_MS - 1));
        assert!(settle(&mut call, 1_000 + RING_MS));
        assert_eq!(call.members[1].state, State::Missed);
        assert_eq!(call.members[0].state, State::Left);
        assert_eq!(recent_of(&call, "bob").unwrap().status, Status::Missed);
        assert!(recent_of(&call, "ada").unwrap().done);
    }

    #[test]
    fn a_seat_not_heard_from_goes_and_ends_the_call() {
        let mut call = ringing();
        call.members[1] = member("bob", State::Joined, Some(2), 10_000);
        call.connected_ms = 10_000;
        // Ada's page was last heard at 1 s: by 26 s her seat has gone.
        assert!(settle(&mut call, 1_000 + STALE_MS));
        assert_ne!(call.ended_ms, 0);
        assert_eq!(recent_of(&call, "bob").unwrap().status, Status::Incoming);
        assert_eq!(recent_of(&call, "bob").unwrap().duration_ms, 16_000);
    }

    #[test]
    fn a_resent_join_keeps_its_seat_and_another_page_takes_a_new_one() {
        let mut call = ringing();
        let join = |page: &str| format!(r#"{{"page":"{page}"}}"#).into_bytes();
        assert!(act(&mut call, "bob", "join", &join("page-bob-first-01"), 2_000).unwrap());
        assert_eq!(call.seat_of("bob"), Some(3));
        assert_eq!(call.connected_ms, 2_000);
        // The same page again, as a redelivered or resent request: the same seat.
        act(&mut call, "bob", "join", &join("page-bob-first-01"), 2_500).unwrap();
        assert_eq!(call.seat_of("bob"), Some(3));
        // A reload: a new seat, and the old seat's leave no longer counts.
        act(&mut call, "bob", "join", &join("page-bob-second-2"), 3_000).unwrap();
        assert_eq!(call.seat_of("bob"), Some(4));
        let leave_old = br#"{"seat":3}"#;
        assert!(!act(&mut call, "bob", "leave", leave_old, 3_100).unwrap());
        assert_eq!(call.ended_ms, 0, "a ghost leave ends nothing");
        assert!(act(&mut call, "bob", "leave", br#"{"seat":4}"#, 3_200).unwrap());
        assert_eq!(call.ended_ms, 3_200);
    }

    #[test]
    fn the_later_seat_offers_and_an_answer_names_its_offer() {
        let mut call = ringing();
        act(
            &mut call,
            "bob",
            "join",
            br#"{"page":"page-bob-first-01"}"#,
            2_000,
        )
        .unwrap();
        let offer = |rev: u64| format!(r#"{{"from":3,"to":1,"offer":"o{rev}","revision":{rev}}}"#);
        // Ada's earlier seat does not offer.
        let refused = act(
            &mut call,
            "ada",
            "signal",
            br#"{"from":1,"to":3,"offer":"x","revision":1}"#,
            2_100,
        );
        assert_eq!(refused.unwrap_err().status, 409);
        assert!(act(&mut call, "bob", "signal", offer(1).as_bytes(), 2_100).unwrap());
        assert!(
            !act(&mut call, "bob", "signal", offer(1).as_bytes(), 2_200).unwrap(),
            "a resend"
        );
        assert!(act(&mut call, "bob", "signal", offer(2).as_bytes(), 2_300).unwrap());
        assert_eq!(call.links[0].generation, 2);
        // A late copy of the first offer does not replace the second.
        assert!(act(&mut call, "bob", "signal", offer(1).as_bytes(), 2_400).is_err());
        // An answer to the first offer is refused; one to the second is kept.
        let answer = |generation: u64| {
            format!(r#"{{"from":1,"to":3,"answer":"a","generation":{generation}}}"#)
        };
        assert!(act(&mut call, "ada", "signal", answer(1).as_bytes(), 2_500).is_err());
        assert!(act(&mut call, "ada", "signal", answer(2).as_bytes(), 2_500).unwrap());
        // A signal from a seat given up is refused.
        act(
            &mut call,
            "bob",
            "join",
            br#"{"page":"page-bob-second-2"}"#,
            3_000,
        )
        .unwrap();
        assert!(call.links.is_empty(), "the replaced seat's link goes");
        assert!(act(&mut call, "bob", "signal", offer(3).as_bytes(), 3_100).is_err());
    }

    #[test]
    fn the_other_member_sees_no_account_and_no_page_token() {
        let mut call = ringing();
        call.members[0].account = "u-secret-ada".into();
        let seen = view_for(&call, "bob", true).to_string();
        assert!(!seen.contains("u-secret"), "{seen}");
        assert!(!seen.contains("page-of"), "{seen}");
        let own = view_for(&call, "u-secret-ada", true).to_string();
        assert!(own.contains("page-of-ada-1"), "{own}");
    }

    /// Ada, Bob and Cid joined on seats 1, 2 and 3.
    fn three_joined() -> Call {
        let mut call = call(vec![
            member("ada", State::Joined, Some(1), 10_000),
            member("bob", State::Joined, Some(2), 10_000),
            member("cid", State::Joined, Some(3), 10_000),
        ]);
        call.connected_ms = 2_000;
        call.next_seat = 4;
        call
    }

    fn offer(call: &mut Call, from_name: &str, from: u32, to: u32, sdp: &str) {
        let body = serde_json::json!({ "from": from, "to": to, "offer": sdp, "revision": 1 });
        act(
            call,
            from_name,
            "signal",
            body.to_string().as_bytes(),
            2_500,
        )
        .unwrap();
    }

    #[test]
    fn adding_someone_rings_them_from_now_and_refuses_who_cannot_be_added() {
        let mut call = ringing();
        call.members[1] = member("bob", State::Joined, Some(2), 1_000);
        let cid = |at: u64| Member {
            rang_ms: at,
            ..member("cid", State::Ringing, None, 0)
        };
        // Only someone joined adds a person.
        let mut waiting = ringing();
        assert_eq!(
            add_member(&mut waiting, "bob", cid(5_000))
                .unwrap_err()
                .status,
            409
        );
        assert!(add_member(&mut call, "ada", cid(5_000)).unwrap());
        assert_eq!(call.members.len(), 3);
        // A resend finds them ringing, and rings from the first time.
        assert!(!add_member(&mut call, "ada", cid(6_000)).unwrap());
        assert_eq!(call.member("cid").unwrap().rang_ms, 5_000);
        // Someone already joined is not added.
        let already = Member {
            account: "bob".into(),
            ..cid(6_000)
        };
        assert_eq!(
            add_member(&mut call, "ada", already).unwrap_err().status,
            409
        );
        // A fourth fits, and a fifth does not.
        let dee = Member {
            rang_ms: 7_000,
            ..member("dee", State::Ringing, None, 0)
        };
        assert!(add_member(&mut call, "bob", dee).unwrap());
        let eve = member("eve", State::Ringing, None, 0);
        assert_eq!(add_member(&mut call, "bob", eve).unwrap_err().status, 409);
        assert_eq!(call.in_call(), MAX_MEMBERS);
    }

    #[test]
    fn a_leave_drops_one_person_and_their_links_while_two_remain() {
        let mut call = three_joined();
        offer(&mut call, "bob", 2, 1, "bob to ada");
        offer(&mut call, "cid", 3, 1, "cid to ada");
        offer(&mut call, "cid", 3, 2, "cid to bob");
        assert_eq!(call.links.len(), 3);
        // Each sees only the links of their own seat.
        let seen = view_for(&call, "ada", true);
        assert_eq!(seen["links"].as_array().unwrap().len(), 2);
        assert!(!seen.to_string().contains("cid to bob"), "{seen}");

        assert!(act(&mut call, "bob", "leave", br#"{"seat":2}"#, 3_000).unwrap());
        assert_eq!(call.ended_ms, 0);
        assert_eq!(call.member("bob").unwrap().state, State::Left);
        assert_eq!(
            call.links
                .iter()
                .map(|l| (l.from, l.to))
                .collect::<Vec<_>>(),
            vec![(3, 1)],
            "only the link of the two who remain"
        );
        // Bob's line is finished with his own time in the call; Ada's goes on.
        let line = recent_of(&call, "bob").unwrap();
        assert!(line.done);
        assert_eq!(line.duration_ms, 1_000);
        assert!(!recent_of(&call, "ada").unwrap().done);
    }

    #[test]
    fn a_leave_that_leaves_one_person_ends_the_call_for_them() {
        let mut call = three_joined();
        act(&mut call, "bob", "leave", br#"{"seat":2}"#, 3_000).unwrap();
        assert!(act(&mut call, "ada", "leave", br#"{"seat":1}"#, 4_000).unwrap());
        assert_eq!(call.ended_ms, 4_000);
        assert_eq!(call.member("cid").unwrap().state, State::Left);
        assert!(call.links.is_empty());
        assert!(recent_of(&call, "cid").unwrap().done);
    }

    #[test]
    fn the_caller_leaving_ends_nothing_for_two_who_remain_but_two_still_ringing_are_over() {
        let mut call = three_joined();
        assert!(act(&mut call, "ada", "leave", br#"{"seat":1}"#, 3_000).unwrap());
        assert_eq!(call.ended_ms, 0, "Bob and Cid go on");
        assert_eq!(recent_of(&call, "ada").unwrap().status, Status::Outgoing);

        let mut rings = super::tests::call(vec![
            member("ada", State::Joined, Some(1), 1_000),
            member("bob", State::Ringing, None, 0),
            member("cid", State::Ringing, None, 0),
        ]);
        assert!(act(&mut rings, "ada", "leave", br#"{"seat":1}"#, 3_000).unwrap());
        assert_eq!(rings.ended_ms, 3_000, "nobody is left to answer");
        assert_eq!(rings.member("bob").unwrap().state, State::Missed);
    }

    #[test]
    fn someone_added_rings_from_when_they_were_added_and_declining_ends_nothing() {
        let mut call = ringing();
        call.members[0].seat.as_mut().unwrap().seen_ms = 60_000;
        call.members[1] = member("bob", State::Joined, Some(2), 60_000);
        call.connected_ms = 2_000;
        call.members.push(Member {
            rang_ms: 30_000,
            ..member("cid", State::Ringing, None, 0)
        });
        // The call was placed at 1 s: past its RING_MS, Cid still rings.
        assert!(!settle(&mut call, 1_000 + RING_MS + 1));
        assert_eq!(call.member("cid").unwrap().state, State::Ringing);
        assert!(settle(&mut call, 30_000 + RING_MS));
        assert_eq!(call.member("cid").unwrap().state, State::Missed);
        assert_eq!(call.ended_ms, 0, "Ada and Bob go on");
        assert_eq!(recent_of(&call, "cid").unwrap().status, Status::Missed);
        assert_eq!(recent_of(&call, "cid").unwrap().at_ms, 30_000);

        let mut other = three_joined();
        other.members[2] = Member {
            rang_ms: 2_000,
            ..member("cid", State::Ringing, None, 0)
        };
        assert!(act(&mut other, "cid", "decline", b"{}", 3_000).unwrap());
        assert_eq!(other.ended_ms, 0, "declining ends nothing for the others");
        assert_eq!(other.member("cid").unwrap().state, State::Declined);
        assert_eq!(other.member("ada").unwrap().state, State::Joined);
    }

    #[test]
    fn a_seat_gone_stale_drops_only_that_person_while_two_remain() {
        let mut call = three_joined();
        call.members[0].seat.as_mut().unwrap().seen_ms = 20_000;
        call.members[2].seat.as_mut().unwrap().seen_ms = 20_000;
        offer(&mut call, "cid", 3, 2, "cid to bob");
        offer(&mut call, "cid", 3, 1, "cid to ada");
        assert!(settle(&mut call, 10_000 + STALE_MS));
        assert_eq!(call.ended_ms, 0);
        assert_eq!(call.member("bob").unwrap().state, State::Left);
        assert_eq!(call.links.len(), 1);
        assert_eq!(call.links[0].to, 1);
    }

    #[test]
    fn a_line_names_the_first_other_person_and_counts_the_rest() {
        let mut call = three_joined();
        call.members.push(member("dee", State::Ringing, None, 0));
        let line = recent_of(&call, "ada").unwrap();
        assert_eq!(line.with.name, "bob");
        assert_eq!(line.with_more, 2);
        let line = recent_of(&call, "cid").unwrap();
        assert_eq!(line.with.name, "ada");
        assert_eq!(line.with_more, 2);
        // A call of two carries no count, and a line stored before groups reads as none.
        let two = recent_of(&ringing(), "ada").unwrap();
        assert!(!serde_json::to_string(&two).unwrap().contains("with_more"));
        let stored: Recent = serde_json::from_str(
            r#"{"call":"c","kind":"audio","status":"missed",
                "with":{"name":"a","full_name":"A"},"at_ms":1}"#,
        )
        .unwrap();
        assert_eq!(stored.with_more, 0);
    }

    #[test]
    fn a_call_stored_with_one_link_still_loads_and_goes_on_with_it() {
        let stored = br#"{"id":"00000000000000000000000000000000","kind":"video",
            "created_ms":1000,"connected_ms":2000,"ended_ms":0,"next_seat":3,
            "members":[
              {"account":"ada","name":"ada","full_name":"ADA","state":"joined",
               "seat":{"n":1,"page":"page-of-ada-1","seen_ms":2000},"joined_ms":1000},
              {"account":"bob","name":"bob","full_name":"BOB","state":"joined",
               "seat":{"n":2,"page":"page-of-bob-2","seen_ms":2000},"joined_ms":2000}
            ],
            "link":{"from":2,"to":1,"offer":"o","generation":1,"revision":0,"answer":"a"}}"#;
        let mut call: Call = decode(stored).unwrap();
        assert_eq!(call.links.len(), 1);
        assert_eq!(call.links[0].offer, "o");
        assert_eq!(view_for(&call, "ada", true)["link"]["answer"], "a");
        assert_eq!(view_for(&call, "ada", true)["links"][0]["answer"], "a");
        // It is written back in the new form, and a later offer replaces that pair's link.
        offer(&mut call, "bob", 2, 1, "o2");
        assert_eq!(call.links.len(), 1);
        assert_eq!(call.links[0].generation, 2);
        let written = serde_json::to_string(&call).unwrap();
        assert!(written.contains(r#""links":["#), "{written}");
        assert!(!written.contains(r#""link":"#), "{written}");
        let again: Call = serde_json::from_str(&written).unwrap();
        assert_eq!(again.links, call.links);
        // One with no link at all has none.
        let none: Call = serde_json::from_str(
            r#"{"id":"0","kind":"audio","created_ms":1,"next_seat":2,"members":[]}"#,
        )
        .unwrap();
        assert!(none.links.is_empty());
    }

    /// Twelve people on the list, the longest a name can be, each with every
    /// join remembered; four of them joined.
    fn longest_roster() -> Call {
        let long = |n: usize, state: State, seat: Option<u32>| Member {
            account: format!("{n:02}{}", "u".repeat(62)),
            name: format!("{n:02}{}", "n".repeat(crate::accounts::MAX_NAME_CHARS - 2)),
            full_name: "\u{1f600}".repeat(crate::accounts::MAX_FULL_NAME_CHARS),
            state,
            seat: seat.map(|n| Seat {
                n,
                page: "p".repeat(64),
                seen_ms: u64::MAX / 2,
            }),
            joined_ms: u64::MAX / 2,
            left_ms: u64::MAX / 2,
            joins: vec!["d".repeat(16); JOIN_KEYS],
            rang_ms: u64::MAX / 2,
            added_by: Some("a".repeat(crate::accounts::MAX_NAME_CHARS)),
        };
        let mut members: Vec<Member> = (0..4)
            .map(|n| long(n, State::Joined, Some(n as u32 + 1)))
            .collect();
        members.extend((4..MAX_ROSTER).map(|n| long(n, State::Left, None)));
        call(members)
    }

    #[test]
    fn six_pairs_of_the_longest_descriptions_keep_within_a_call_s_bytes() {
        let mut call = longest_roster();
        let room = description_room(&call);
        assert_eq!(room, 14 * 1024);
        // Lines of a session description, whose line ends encode longer than they are.
        let line = "a=candidate:1 1 udp 2122260223 192.0.2.1 50000 typ host\r\n";
        let mut sdp = String::new();
        while encoded_len(&sdp) + encoded_len(line) <= room {
            sdp.push_str(line);
        }
        sdp.push_str(&"x".repeat(room - encoded_len(&sdp)));
        assert_eq!(encoded_len(&sdp), room);
        let accounts: Vec<String> = call.members.iter().map(|m| m.account.clone()).collect();
        for later in 1..4usize {
            for earlier in 0..later {
                let (from, to) = (later as u32 + 1, earlier as u32 + 1);
                let body =
                    serde_json::json!({ "from": from, "to": to, "offer": sdp, "revision": 1 });
                let body = body.to_string();
                act(
                    &mut call,
                    &accounts[later],
                    "signal",
                    body.as_bytes(),
                    2_000,
                )
                .unwrap();
                let body =
                    serde_json::json!({ "from": to, "to": from, "answer": sdp, "generation": 1 });
                let body = body.to_string();
                act(
                    &mut call,
                    &accounts[earlier],
                    "signal",
                    body.as_bytes(),
                    2_000,
                )
                .unwrap();
            }
        }
        assert_eq!(call.links.len(), 6);
        let stored = serde_json::to_vec(&call).unwrap();
        assert!(
            stored.len() <= MAX_CALL_BYTES,
            "{} bytes stored",
            stored.len()
        );
        // One byte more of a description is refused, and leaves the call as it was.
        let body = serde_json::json!({
            "from": 4, "to": 1, "offer": format!("{sdp}x"), "revision": 2,
        });
        let body = body.to_string();
        let refused = act(&mut call, &accounts[3], "signal", body.as_bytes(), 2_000).unwrap_err();
        assert_eq!(refused.status, 413);
        assert_eq!(serde_json::to_vec(&call).unwrap(), stored);
    }

    #[test]
    fn adding_someone_drops_a_link_past_the_new_share_and_keeps_those_within_it() {
        let mut call = ringing();
        call.members[1] = member("bob", State::Joined, Some(2), 1_000);
        // Between two people a description may be the whole 64 KiB.
        offer(&mut call, "bob", 2, 1, &"x".repeat(MAX_SDP_BYTES));
        assert_eq!(call.links.len(), 1);
        add_member(&mut call, "ada", member("cid", State::Ringing, None, 0)).unwrap();
        assert!(call.links.is_empty(), "past the 28 KiB three people share");

        let mut small = ringing();
        small.members[1] = member("bob", State::Joined, Some(2), 1_000);
        offer(&mut small, "bob", 2, 1, "small");
        add_member(&mut small, "ada", member("cid", State::Ringing, None, 0)).unwrap();
        assert_eq!(small.links.len(), 1);
    }
}

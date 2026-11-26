//! Invitations between accounts.
//!
//! An event in the organizer's own document names the people it invites by
//! account name (`Event::invitees`). After each save the organizer's
//! invitations are brought in line with the document ([`reconcile`]): one
//! card per invited event in the module's shared space, read only through the
//! routes below, and one inbox entry per invitee pointing at it.
//!
//! * `invites/<organizer>/<event>`: the [`Card`]: the organizer, the event as
//!   saved, each invitee with their answer, and the people taken off whose
//!   inbox entries are still to be cleared. A card the document no longer
//!   wants keeps no event and is deleted once those are cleared. The
//!   reconcile alone puts and deletes the inbox entries of the people a card
//!   names; a read of an inbox clears only an entry whose card names the
//!   person nowhere, and a full inbox gives up those of events long over,
//!   each by a compare-and-set on the entry, so an entry put back meanwhile
//!   stays.
//! * `inbox/<invitee>/<token>`: `{organizer, event}`; the token is the first
//!   32 hex digits of a SHA-256 of the two ids, and is what a page names an
//!   invitation by. No account id ever reaches a browser.
//! * `locks/<organizer>`: held while a reconcile runs, so two never run at
//!   once. It expires by itself after [`LOCK_MS`], longer than a request may
//!   run; a pass does a bounded amount of work, so its holder always gives it
//!   up before then. A reconcile that finds the lock held leaves the work to
//!   the holder, which reads the document's revision again once it has given
//!   the lock up and goes round again when a save landed meanwhile.
//! * `reconciled/<organizer>`: the document revision the last finished
//!   reconcile brought everything to. `GET /sent` reconciles again while the
//!   document is newer, so work left over is finished by the next read.
//!
//! The card is written first, with each invitee still to be told marked
//! `due` and each person taken off listed in `leaving`; the inbox entries and
//! notifications follow, and the card is then marked done. Every step can be
//! made again (a notification's id says which version of the invitation it
//! is, and Notification Center keeps one of each id), so a reconcile cut short
//! is finished by the next one. A card this build cannot read (an earlier or
//! later build wrote it) is left alone, and does not hold a reconcile back.
//! One request's reconcile does at most [`PASS_STEPS`] steps' worth of work
//! (each step's store calls estimated from above) beyond its first unit,
//! which it always does so that nothing is put off for ever, and `GET /sent`
//! says when some is left.
//!
//! Who reaches what: the organizer's routes read and write only cards under
//! their own id; an invitee's routes start from their own inbox and act only
//! on a card that still lists them, checked in the same compare-and-set as
//! the answer, so an answer never lands once the invitation was taken back,
//! nor on a version of the event the invitee did not see. Anyone else finds
//! no inbox entry and is answered 404. Only a signed-in account (not a Guest
//! User) invites or is invited.

use std::collections::{BTreeMap, BTreeSet};
use std::io;

use ferrite_app::crypto::{hex, sha256};
use ferrite_app::{serde, serde_json};

use super::model::{Doc, Event};
use crate::apps::notification_center::{self, Action, Notification};
use crate::http::Response;
use crate::module::ApiCtx;
use crate::session::Account;

/// The module's name, for notifications and change counts.
const APP: &str = "calendar";
/// The most invitations one person's inbox holds.
pub const MAX_INBOX: usize = 500;
/// How far past [`MAX_INBOX`] a listing of an inbox reads: saves checked at
/// the same moment can each add to one inbox.
const INBOX_SLACK: usize = 100;
/// The most stale inbox entries one read clears.
const MAX_PRUNE: usize = 20;
/// An invitation to an event that ended this long ago leaves a full inbox
/// to make room for a new one.
const PAST_MS: i64 = 30 * 24 * 60 * 60 * 1000;
/// The most people one save invites who were not invited to that event
/// before, counted once each: each is looked up, and their inbox counted,
/// before the save.
pub const MAX_NEW_PER_SAVE: usize = 20;
/// How long a reconcile may hold the organizer's lock: more than a request
/// may run.
pub const LOCK_MS: u64 = 10_000;
/// The most cards one listing of an organizer's reads.
const MAX_CARDS: usize = 500;
const CAS_ATTEMPTS: usize = 8;
/// How many times a reconcile goes round when saves land while it runs.
const PASSES: usize = 3;

/// The work one request may do, in store calls, and what each step costs.
pub const PASS_STEPS: u32 = 240;
const CARD_STEPS: u32 = 3;
const LOOKUP_STEPS: u32 = 2;
/// Telling or clearing one person: the inbox entry, a withdrawal and a
/// notification, and the change count that tells their windows.
const TELL_STEPS: u32 = 10;
const TOUCH_STEPS: u32 = 3;

/// An invitee's answer.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum Status {
    Pending,
    Accepted,
    Declined,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Person {
    pub id: String,
    pub name: String,
    pub full_name: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Invitee {
    #[serde(flatten)]
    pub person: Person,
    pub status: Status,
    /// The document revision at which the invitee was last asked: when they
    /// were invited, or when the event's time last changed. An answer names
    /// it. For someone taken off, the revision that took them off.
    #[serde(default)]
    pub since: u64,
    /// The id of the last notification the invitee was sent about the event,
    /// withdrawn when another takes its place.
    #[serde(default)]
    pub note: String,
    /// Still to be told of the invitation as of `since`.
    #[serde(default)]
    pub due: bool,
    /// Notifications a pass may have sent and not recorded (it stopped
    /// before marking the card): withdrawn with `note` when the invitee is
    /// told again, answers, or is taken off.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub unrecorded: Vec<String>,
}

/// One invited event, as its invitees see it.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Card {
    /// The organizer's document revision that last changed it.
    pub rev: u64,
    pub organizer: Person,
    /// The event as saved, or `None` once the document no longer invites
    /// anyone to it.
    #[serde(default)]
    pub event: Option<Event>,
    #[serde(default)]
    pub invitees: Vec<Invitee>,
    /// People taken off whose inbox entry and notification are still to be
    /// cleared.
    #[serde(default)]
    pub leaving: Vec<Invitee>,
    /// Names the event invites that name no account (one deleted since, or
    /// the organizer's own): looked up once, not at every pass.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub missing: Vec<String>,
}

impl Card {
    /// Whether two cards say the same, whichever revision wrote them.
    fn same(&self, other: &Card) -> bool {
        Card {
            rev: other.rev,
            ..self.clone()
        } == *other
    }

    /// Whether some of the card's work is still to be done.
    fn unfinished(&self) -> bool {
        !self.leaving.is_empty() || self.invitees.iter().any(|invitee| invitee.due)
    }

    /// The people it names, to tell to read again when it changes.
    fn people(&self) -> usize {
        self.invitees.len() + self.leaving.len()
    }

    /// Whether it names `me`, as invited or still to be cleared.
    fn names(&self, me: &str) -> bool {
        self.invitees
            .iter()
            .chain(&self.leaving)
            .any(|i| i.person.id == me)
    }
}

/// The most unrecorded notifications an invitee keeps track of: past it the
/// oldest is forgotten, which takes five moves in a row whose passes all
/// stopped between telling and recording.
const MAX_UNRECORDED: usize = 4;

impl Invitee {
    /// The invitee as it is when the version it is to be told of is
    /// replaced (the event moved again, or they were taken off): the
    /// notification of that version may have gone out unrecorded.
    fn superseded(&self, token: &str) -> Invitee {
        let mut next = self.clone();
        if self.due {
            let maybe = invite_note(token, self.since);
            if maybe != self.note && !next.unrecorded.contains(&maybe) {
                next.unrecorded.push(maybe);
            }
            let excess = next.unrecorded.len().saturating_sub(MAX_UNRECORDED);
            next.unrecorded.drain(..excess);
        }
        next
    }

    /// Every notification of the invitee's to withdraw but `keep`.
    fn withdrawals(&self, keep: &str) -> Vec<String> {
        std::iter::once(&self.note)
            .chain(&self.unrecorded)
            .filter(|id| !id.is_empty() && *id != keep)
            .cloned()
            .collect()
    }
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
struct Entry {
    organizer: String,
    event: String,
}

/// The token a page names the invitation to `event` of `organizer` by.
pub fn token(organizer: &str, event: &str) -> String {
    let digest = hex(&sha256(
        format!("macalicious/calendar-invite/{organizer}/{event}").as_bytes(),
    ));
    digest[..32].to_string()
}

fn card_key(organizer: &str, event: &str) -> String {
    format!("invites/{organizer}/{event}")
}

fn inbox_key(invitee: &str, token: &str) -> String {
    format!("inbox/{invitee}/{token}")
}

fn data_error(e: serde_json::Error) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, e.to_string())
}

/// The account that may invite or be invited: signed in, and not a Guest User.
pub fn inviter(cx: &ApiCtx<'_>) -> Option<Account> {
    cx.session.account.clone().filter(|account| !account.guest)
}

fn person(account: &Account) -> Person {
    Person {
        id: account.id.clone(),
        name: account.name.clone(),
        full_name: account.full_name.clone(),
    }
}

/// Whether two versions of an event differ in when it happens: an answer to
/// the earlier one does not hold for the later.
fn moved(a: &Event, b: &Event) -> bool {
    a.start != b.start
        || a.end != b.end
        || a.all_day != b.all_day
        || a.repeat != b.repeat
        || a.exdates != b.exdates
}

/// Whether `event` ended more than [`PAST_MS`] before `now_ms`: a repeat
/// without an end date never has.
fn long_past(event: &Event, now_ms: u64) -> bool {
    let before = i64::try_from(now_ms)
        .unwrap_or(i64::MAX)
        .saturating_sub(PAST_MS);
    event.end < before
        && event.repeat.as_ref().map_or(true, |repeat| {
            repeat.until.is_some_and(|until| until < before)
        })
}

/// The event as a card keeps it: its own fields, without the organizer's
/// calendar or the invitees (the card lists those itself).
fn shown(event: &Event) -> Event {
    Event {
        calendar: "invitations".into(),
        invitees: Vec::new(),
        // The organizer's own alert and how they keep their time are theirs.
        alert: None,
        alert_dismissed: None,
        alert_snooze: None,
        show_as: None,
        travel_time: None,
        // The organizer's files stay theirs: nothing lets an invitee read them.
        attachments: Vec::new(),
        ..event.clone()
    }
}

/// A notification of the calendar module.
fn note(id: String, title: String, body: &str, actions: Vec<Action>) -> Notification {
    Notification {
        app: APP.into(),
        id,
        title,
        subtitle: None,
        body: Some(body.to_string()),
        alert: !actions.is_empty(),
        dismiss: None,
        actions,
    }
}

fn title_of(event: &Event) -> &str {
    if event.title.is_empty() {
        "New Event"
    } else {
        &event.title
    }
}

/// The id of the notification asking an invitee about the version `since`.
fn invite_note(token: &str, since: u64) -> String {
    format!("invite-{token}-{since}")
}

/// What one request may still do, in store calls.
struct Budget(u32);

impl Budget {
    /// Spend `steps`, or `false` when not that much is left. The first unit
    /// of work a request does is always done, whatever it costs, so that a
    /// unit dearer than a whole budget is not put off for ever.
    fn take(&mut self, steps: u32) -> bool {
        if self.0 == PASS_STEPS {
            self.0 = self.0.saturating_sub(steps);
            return true;
        }
        if self.0 < steps {
            return false;
        }
        self.0 -= steps;
        true
    }
}

/// The validated check of a save's invitees against the stored document,
/// before it is written: the organizer may invite, never invites themself,
/// names accounts that exist, invites at most [`MAX_NEW_PER_SAVE`] new people,
/// and each person invited has room in their inbox. `Err` is the response
/// refusing the save. The work the save asks for is not limited here: the
/// reconcile's budget spreads it over as many requests as it takes.
pub async fn check(
    cx: &mut ApiCtx<'_>,
    before: Option<&Doc>,
    after: &Doc,
) -> io::Result<Result<(), Response>> {
    if after.events.iter().all(|event| event.invitees.is_empty()) {
        return Ok(Ok(()));
    }
    let Some(account) = inviter(cx) else {
        return Ok(Err(Response::error(
            403,
            "Sign in to an account to invite people.",
        )));
    };
    if after
        .events
        .iter()
        .any(|event| event.invitees.contains(&account.name))
    {
        return Ok(Err(Response::error(
            400,
            "An event cannot invite its organizer.",
        )));
    }
    // New invitations, by person: each is looked up, and their inbox counted.
    let mut new: BTreeMap<String, usize> = BTreeMap::new();
    for event in &after.events {
        let old = before.and_then(|doc| doc.events.iter().find(|other| other.id == event.id));
        for name in &event.invitees {
            if !old.is_some_and(|old| old.invitees.contains(name)) {
                *new.entry(name.clone()).or_default() += 1;
            }
        }
    }
    if new.len() > MAX_NEW_PER_SAVE {
        return Ok(Err(Response::error(
            400,
            &format!("Invite at most {MAX_NEW_PER_SAVE} more people at a time."),
        )));
    }
    for (name, adding) in &new {
        let Some(found) = crate::accounts::lookup(cx.storage.store(), name).await? else {
            return Ok(Err(Response::error(
                400,
                &format!("No one on this desktop has the account name \u{201c}{name}\u{201d}."),
            )));
        };
        let prefix = format!("inbox/{}/", found.id);
        let mut held = cx
            .storage
            .shared()
            .list(&prefix, MAX_INBOX + 1)
            .await?
            .len();
        if held + adding > MAX_INBOX {
            // Entries of invitations taken back or long over make room.
            held = read_inbox(cx, &found.id, Prune::MakeRoom).await?.held;
        }
        if held + adding > MAX_INBOX {
            return Ok(Err(Response::error(
                422,
                &format!("\u{201c}{name}\u{201d} has too many invitations to take another."),
            )));
        }
    }
    Ok(Ok(()))
}

/// The organizer's cards, by event id, and the ids of those this build
/// cannot read, which are left alone, never written over.
async fn cards(
    cx: &mut ApiCtx<'_>,
    organizer: &str,
) -> io::Result<(BTreeMap<String, Card>, BTreeSet<String>)> {
    let prefix = format!("invites/{organizer}/");
    let listed = cx.storage.shared().list(&prefix, MAX_CARDS).await?;
    let mut out = BTreeMap::new();
    let mut unreadable = BTreeSet::new();
    for (key, value) in listed {
        let Some(event) = key.strip_prefix(&prefix) else {
            continue;
        };
        match serde_json::from_slice::<Card>(&value) {
            Ok(card) => {
                out.insert(event.to_string(), card);
            }
            Err(_) => {
                unreadable.insert(event.to_string());
            }
        }
    }
    Ok((out, unreadable))
}

/// Take the organizer's lock, or `None` when another reconcile holds it.
async fn lock(cx: &mut ApiCtx<'_>, organizer: &str) -> io::Result<Option<String>> {
    let holder = crate::crypto::random::random_token(16)?;
    let key = format!("locks/{organizer}");
    let taken = cx
        .storage
        .shared()
        .create_expiring(&key, holder.as_bytes(), cx.now_ms + LOCK_MS)
        .await?;
    Ok(taken.then_some(holder))
}

/// Give the lock up. Its holder does so well within [`LOCK_MS`], so the lock
/// is still its own; the check only spares a lock taken after a holder that
/// was stopped and never gave it up.
async fn unlock(cx: &mut ApiCtx<'_>, organizer: &str, holder: &str) {
    let key = format!("locks/{organizer}");
    let mut shared = cx.storage.shared();
    let still = matches!(shared.get(&key).await, Ok(Some(value)) if value == holder.as_bytes());
    if still {
        if let Err(error) = shared.delete(&key).await {
            ferrite_app::tracing::warn!(%error, "calendar lock left to expire");
        }
    }
}

/// The revision the last finished reconcile of `organizer` brought the cards to.
async fn reconciled(cx: &mut ApiCtx<'_>, organizer: &str) -> io::Result<u64> {
    Ok(cx
        .storage
        .shared()
        .get_json::<u64>(&format!("reconciled/{organizer}"))
        .await?
        .unwrap_or(0))
}

/// Whether the organizer's cards need bringing in line with their document
/// at `rev`: a reconcile has not finished at that revision, and the document
/// invites someone, or an earlier one did (a reconcile finished once, or a
/// card is there from one that never finished).
pub async fn behind(
    cx: &mut ApiCtx<'_>,
    organizer: &str,
    doc: Option<&Doc>,
    rev: u64,
) -> io::Result<bool> {
    let done = reconciled(cx, organizer).await?;
    if done >= rev {
        return Ok(false);
    }
    let invites = doc.is_some_and(|doc| doc.events.iter().any(|event| !event.invitees.is_empty()));
    if invites || done > 0 {
        return Ok(true);
    }
    let prefix = format!("invites/{organizer}/");
    Ok(!cx.storage.shared().list(&prefix, 1).await?.is_empty())
}

/// How a reconcile ended.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Outcome {
    /// Everything is in line with the document.
    Done,
    /// Some work is left, for the next read; or another reconcile holds the lock.
    Pending,
}

/// Bring the organizer's cards and their invitees' inboxes in line with the
/// stored document, as far as one request's budget goes. Reads the document
/// itself, under the organizer's lock, so it always works from the newest.
pub async fn reconcile(cx: &mut ApiCtx<'_>, organizer: &Account) -> io::Result<Outcome> {
    let mut budget = Budget(PASS_STEPS);
    for _ in 0..PASSES {
        let Some(holder) = lock(cx, &organizer.id).await? else {
            return Ok(Outcome::Pending);
        };
        let pass = reconcile_locked(cx, organizer, &mut budget).await;
        unlock(cx, &organizer.id, &holder).await;
        let Some(rev) = pass? else {
            return Ok(Outcome::Pending);
        };
        // A save that found the lock held left its work to this reconcile.
        if super::read(&mut cx.storage.user()).await?.rev == rev {
            return Ok(Outcome::Done);
        }
    }
    Ok(Outcome::Pending)
}

/// One pass: the revision it brought everything to, or `None` when the
/// budget ran out first.
async fn reconcile_locked(
    cx: &mut ApiCtx<'_>,
    organizer: &Account,
    budget: &mut Budget,
) -> io::Result<Option<u64>> {
    let current = super::read(&mut cx.storage.user()).await?;
    let rev = current.rev;
    let events: BTreeMap<String, Event> = current
        .doc
        .map(|doc| {
            doc.events
                .into_iter()
                .filter(|event| !event.invitees.is_empty())
                .map(|event| (event.id.clone(), event))
                .collect()
        })
        .unwrap_or_default();
    let (mut cards, unreadable) = cards(cx, &organizer.id).await?;
    let me = person(organizer);
    let mut found: BTreeMap<String, Option<Person>> = BTreeMap::new();
    let mut touched = BTreeSet::new();
    let mut finished = true;
    // Invitations the document no longer wants are taken back first: that is
    // cheap, and no one is then told of an event that is gone.
    let unwanted: Vec<String> = cards
        .iter()
        .filter(|(id, card)| card.event.is_some() && !events.contains_key(*id))
        .map(|(id, _)| id.clone())
        .collect();
    for id in unwanted {
        let people = cards.get(&id).map_or(0, Card::people) as u32;
        if !budget.take(CARD_STEPS + TOUCH_STEPS * people) {
            finished = false;
            break;
        }
        match take_back(cx, &me, &id, rev, &mut touched).await {
            Ok(Some(card)) => {
                cards.insert(id, card);
            }
            Ok(None) => {}
            Err(error) => {
                touch(cx, &touched).await;
                return Err(error);
            }
        }
    }
    for (id, event) in &events {
        if !finished {
            break;
        }
        if unreadable.contains(id) {
            continue;
        }
        let token = token(&me.id, id);
        // Unchanged since the last write: nothing to write, whatever the revision.
        let (wanted, unknown) = desired(cards.get(id), &me, event, rev, &token);
        if unknown.is_empty() && cards.get(id).is_some_and(|card| card.same(&wanted)) {
            continue;
        }
        let people = (wanted.people() + unknown.len()) as u32;
        let lookups = unknown.len() as u32;
        if !budget.take(CARD_STEPS + LOOKUP_STEPS * lookups + TOUCH_STEPS * people) {
            finished = false;
            break;
        }
        match write_card(cx, &me, event, rev, &mut found, &mut touched).await {
            Ok(Some(card)) => {
                cards.insert(id.clone(), card);
            }
            Ok(None) => {}
            Err(error) => {
                touch(cx, &touched).await;
                return Err(error);
            }
        }
    }
    // Then what the cards say is still to be done, once every card is in line
    // with the document.
    if finished {
        let mut failed = None;
        for (id, card) in &cards {
            if !card.unfinished() {
                continue;
            }
            match tell(cx, &me, id, card, budget, &mut touched).await {
                Ok(true) => {}
                Ok(false) => {
                    finished = false;
                    break;
                }
                Err(error) => {
                    failed = Some(error);
                    break;
                }
            }
        }
        if let Some(error) = failed {
            touch(cx, &touched).await;
            return Err(error);
        }
    }
    touch(cx, &touched).await;
    if !finished {
        return Ok(None);
    }
    // Finished at `rev`: a later read need not reconcile again.
    let key = format!("reconciled/{}", organizer.id);
    let mut shared = cx.storage.shared();
    for _ in 0..CAS_ATTEMPTS {
        let stored = shared.get_versioned(&key).await?;
        let done = stored
            .as_ref()
            .and_then(|(bytes, _)| serde_json::from_slice::<u64>(bytes).ok())
            .unwrap_or(0);
        if done >= rev {
            break;
        }
        let bytes = serde_json::to_vec(&rev).map_err(data_error)?;
        if shared
            .put_if_version(&key, &bytes, stored.map(|(_, version)| version))
            .await?
        {
            break;
        }
    }
    Ok(Some(rev))
}

/// The card `event` wants, given the card stored now, with the names it does
/// not know yet (to look up). An invitee already on the card keeps their
/// answer unless the event moved, which asks them again; anyone it no longer
/// names joins `leaving`.
fn desired(
    card: Option<&Card>,
    organizer: &Person,
    event: &Event,
    rev: u64,
    token: &str,
) -> (Card, Vec<String>) {
    let live = card.filter(|card| card.event.is_some());
    let moved = live
        .and_then(|card| card.event.as_ref())
        .is_some_and(|old| moved(old, event));
    let mut invitees = Vec::new();
    let mut unknown = Vec::new();
    // Names already found to name no account stay so until the event's list
    // of invitees changes, when they are looked up again (an account may have
    // that name now, and the save that changed the list checked it).
    let covered: BTreeSet<&String> = live
        .map(|card| {
            card.invitees
                .iter()
                .map(|i| &i.person.name)
                .chain(&card.missing)
                .collect()
        })
        .unwrap_or_default();
    let unchanged = covered == event.invitees.iter().collect::<BTreeSet<_>>();
    let missing: Vec<String> = card
        .filter(|_| unchanged)
        .map(|card| {
            card.missing
                .iter()
                .filter(|name| event.invitees.contains(name))
                .cloned()
                .collect()
        })
        .unwrap_or_default();
    for name in &event.invitees {
        if missing.contains(name) {
            continue;
        }
        let kept = live.and_then(|card| card.invitees.iter().find(|i| &i.person.name == name));
        // Taken off and invited again before they were cleared: asked afresh,
        // the old notification withdrawn when the new one goes.
        let back = card.and_then(|card| card.leaving.iter().find(|i| &i.person.name == name));
        match (kept, back) {
            (Some(kept), _) if moved => invitees.push(Invitee {
                status: Status::Pending,
                since: rev,
                due: true,
                ..kept.superseded(token)
            }),
            (Some(kept), _) => invitees.push(kept.clone()),
            (None, Some(back)) => invitees.push(Invitee {
                status: Status::Pending,
                since: rev,
                due: true,
                ..back.clone()
            }),
            (None, None) => unknown.push(name.clone()),
        }
    }
    let mut leaving: Vec<Invitee> = card.map(|card| card.leaving.clone()).unwrap_or_default();
    leaving.retain(|gone| !invitees.iter().any(|i| i.person.id == gone.person.id));
    for old in live.map_or(&[][..], |card| &card.invitees[..]) {
        if !event.invitees.contains(&old.person.name) {
            leaving.push(Invitee {
                since: rev,
                due: false,
                ..old.superseded(token)
            });
        }
    }
    let card = Card {
        rev,
        organizer: organizer.clone(),
        event: Some(shown(event)),
        invitees,
        leaving,
        missing,
    };
    (card, unknown)
}

/// Write the card of `event`, keeping each invitee's answer: the card as
/// written, or `None` when it was left as it was.
async fn write_card(
    cx: &mut ApiCtx<'_>,
    organizer: &Person,
    event: &Event,
    rev: u64,
    found: &mut BTreeMap<String, Option<Person>>,
    touched: &mut BTreeSet<String>,
) -> io::Result<Option<Card>> {
    let key = card_key(&organizer.id, &event.id);
    let token = token(&organizer.id, &event.id);
    for _ in 0..CAS_ATTEMPTS {
        let stored = cx.storage.shared().get_versioned(&key).await?;
        let (old, version) = match &stored {
            None => (None, None),
            Some((bytes, version)) => match serde_json::from_slice::<Card>(bytes) {
                Ok(card) => (Some(card), Some(*version)),
                // Never written over: a card this build cannot read.
                Err(_) => return Ok(None),
            },
        };
        let (mut card, unknown) = desired(old.as_ref(), organizer, event, rev, &token);
        for name in unknown {
            if !found.contains_key(&name) {
                let person = crate::accounts::lookup(cx.storage.store(), &name)
                    .await?
                    .map(|account| person(&account));
                found.insert(name.clone(), person);
            }
            // An account that is gone, or the organizer's own, is left off.
            match found.get(&name) {
                Some(Some(person)) if person.id != organizer.id => {
                    card.invitees.push(Invitee {
                        person: person.clone(),
                        status: Status::Pending,
                        since: rev,
                        note: String::new(),
                        due: true,
                        unrecorded: Vec::new(),
                    });
                }
                _ => card.missing.push(name.clone()),
            }
        }
        // Back in the document's order.
        card.invitees.sort_by_key(|invitee| {
            event
                .invitees
                .iter()
                .position(|name| name == &invitee.person.name)
        });
        if old.as_ref().is_some_and(|old| old.same(&card)) {
            return Ok(None);
        }
        let bytes = serde_json::to_vec(&card).map_err(data_error)?;
        if cx
            .storage
            .shared()
            .put_if_version(&key, &bytes, version)
            .await?
        {
            // Everyone whose view of the event changed.
            touched.extend(card.invitees.iter().map(|i| i.person.id.clone()));
            touched.extend(card.leaving.iter().map(|i| i.person.id.clone()));
            return Ok(Some(card));
        }
    }
    Err(io::Error::other("the invitation kept changing"))
}

/// Take the invitation to `event` back: the card keeps no event, and every
/// invitee is to be cleared. The card as written, or `None` when there was
/// nothing to take back.
async fn take_back(
    cx: &mut ApiCtx<'_>,
    organizer: &Person,
    event: &str,
    rev: u64,
    touched: &mut BTreeSet<String>,
) -> io::Result<Option<Card>> {
    let key = card_key(&organizer.id, event);
    for _ in 0..CAS_ATTEMPTS {
        let Some((bytes, version)) = cx.storage.shared().get_versioned(&key).await? else {
            return Ok(None);
        };
        let Ok(mut card) = serde_json::from_slice::<Card>(&bytes) else {
            return Ok(None);
        };
        if card.event.is_none() {
            return Ok(None);
        }
        card.rev = rev;
        card.event = None;
        card.missing.clear();
        let token = token(&organizer.id, event);
        for invitee in std::mem::take(&mut card.invitees) {
            card.leaving.push(Invitee {
                since: rev,
                due: false,
                ..invitee.superseded(&token)
            });
        }
        let written = serde_json::to_vec(&card).map_err(data_error)?;
        if cx
            .storage
            .shared()
            .put_if_version(&key, &written, Some(version))
            .await?
        {
            touched.extend(card.leaving.iter().map(|i| i.person.id.clone()));
            return Ok(Some(card));
        }
    }
    Err(io::Error::other("the invitation kept changing"))
}

/// Do what `card` says is still to be done, within the budget: tell each
/// invitee marked `due` (an inbox entry and a notification, the one before
/// it withdrawn), clear each person in `leaving`, then mark the card with
/// what was done, a step that failed included: its error is returned once the
/// steps before it are recorded. `false` when the budget ran out first.
async fn tell(
    cx: &mut ApiCtx<'_>,
    organizer: &Person,
    event_id: &str,
    card: &Card,
    budget: &mut Budget,
    touched: &mut BTreeSet<String>,
) -> io::Result<bool> {
    let token = token(&organizer.id, event_id);
    let mut told = Vec::new();
    let mut cleared = Vec::new();
    let mut complete = true;
    let mut failed = None;
    if let Some(event) = &card.event {
        let entry = serde_json::to_vec(&Entry {
            organizer: organizer.id.clone(),
            event: event_id.to_string(),
        })
        .map_err(data_error)?;
        for invitee in card.invitees.iter().filter(|invitee| invitee.due) {
            if !budget.take(TELL_STEPS) {
                complete = false;
                break;
            }
            if let Err(error) = ask(cx, organizer, &token, event, &entry, invitee).await {
                failed = Some(error);
                break;
            }
            told.push((invitee.person.id.clone(), invitee.since));
            touched.insert(invitee.person.id.clone());
        }
    }
    if complete && failed.is_none() {
        let title = card
            .event
            .as_ref()
            .map_or("New Event", title_of)
            .to_string();
        for gone in &card.leaving {
            if !budget.take(TELL_STEPS) {
                complete = false;
                break;
            }
            if let Err(error) = clear(cx, organizer, &token, &title, gone).await {
                failed = Some(error);
                break;
            }
            cleared.push((gone.person.id.clone(), gone.since));
            touched.insert(gone.person.id.clone());
        }
    }
    if !told.is_empty() || !cleared.is_empty() {
        mark(
            cx,
            &card_key(&organizer.id, event_id),
            &token,
            &told,
            &cleared,
        )
        .await?;
    }
    match failed {
        Some(error) => Err(error),
        None => Ok(complete),
    }
}

/// Tell `invitee` of the invitation as of `since`: the inbox entry, the
/// notification before it withdrawn, and a notification with Accept and
/// Decline.
async fn ask(
    cx: &mut ApiCtx<'_>,
    organizer: &Person,
    token: &str,
    event: &Event,
    entry: &[u8],
    invitee: &Invitee,
) -> io::Result<()> {
    let id = &invitee.person.id;
    cx.storage
        .shared()
        .put(&inbox_key(id, token), entry)
        .await?;
    let note_id = invite_note(token, invitee.since);
    for old in invitee.withdrawals(&note_id) {
        notification_center::withdraw_at(cx.storage.store(), id, cx.now_ms, APP, &old).await?;
    }
    // Someone who answered this version already (from the inbox, before this
    // pass reached them) is not asked it again.
    if invitee.status != Status::Pending {
        return Ok(());
    }
    let title = if invitee.note.is_empty() {
        format!("{} invited you", organizer.full_name)
    } else {
        format!("{} changed an invitation", organizer.full_name)
    };
    let answer = |word: &str| format!("/inbox/{token}/{}/{word}", invitee.since);
    let actions = vec![
        Action {
            label: "Accept".into(),
            post: Some(answer("accept")),
        },
        Action {
            label: "Decline".into(),
            post: Some(answer("decline")),
        },
    ];
    notification_center::notify(
        cx.storage.store(),
        id,
        cx.now_ms,
        &note(note_id, title, title_of(event), actions),
    )
    .await
    .map(|_| ())
}

/// Clear `gone`, taken off: their inbox entry, the notification asking them,
/// and a word that the event is cancelled for them. Someone never told of the
/// invitation is not told it ended.
async fn clear(
    cx: &mut ApiCtx<'_>,
    organizer: &Person,
    token: &str,
    title: &str,
    gone: &Invitee,
) -> io::Result<()> {
    let id = &gone.person.id;
    let key = inbox_key(id, token);
    // No entry and no recorded notification: no pass ever asked them (one
    // puts the entry before it notifies), so there is nothing to take back.
    let asked = !gone.note.is_empty() || cx.storage.shared().get(&key).await?.is_some();
    cx.storage.shared().delete(&key).await?;
    if !asked {
        return Ok(());
    }
    let withdrawn = gone.withdrawals("");
    for old in &withdrawn {
        notification_center::withdraw_at(cx.storage.store(), id, cx.now_ms, APP, old).await?;
    }
    if withdrawn.is_empty() {
        return Ok(());
    }
    notification_center::notify(
        cx.storage.store(),
        id,
        cx.now_ms,
        &note(
            format!("cancel-{token}-{}", gone.since),
            format!("{} cancelled an event", organizer.full_name),
            title,
            Vec::new(),
        ),
    )
    .await
    .map(|_| ())
}

/// Record on the card that the invitees in `told` were told (at the version
/// each names) and the people in `cleared` were cleared. A card left with no
/// event and nobody to clear is deleted: the reconciles are one at a time
/// under the lock, and an answer never writes a card without an event.
async fn mark(
    cx: &mut ApiCtx<'_>,
    key: &str,
    token: &str,
    told: &[(String, u64)],
    cleared: &[(String, u64)],
) -> io::Result<()> {
    // Told, but they had answered meanwhile: the question that went out after
    // their answer withdrew it is withdrawn now.
    let mut answered = Vec::new();
    for _ in 0..CAS_ATTEMPTS {
        answered.clear();
        let Some((bytes, version)) = cx.storage.shared().get_versioned(key).await? else {
            return Ok(());
        };
        let Ok(mut card) = serde_json::from_slice::<Card>(&bytes) else {
            return Ok(());
        };
        for invitee in &mut card.invitees {
            let id = (invitee.person.id.clone(), invitee.since);
            if invitee.due && told.contains(&id) {
                invitee.due = false;
                invitee.note = invite_note(token, invitee.since);
                invitee.unrecorded.clear();
                if invitee.status != Status::Pending {
                    answered.push((invitee.person.id.clone(), invitee.note.clone()));
                }
            }
        }
        card.leaving
            .retain(|gone| !cleared.contains(&(gone.person.id.clone(), gone.since)));
        if card.event.is_none() && card.leaving.is_empty() {
            cx.storage.shared().delete(key).await?;
            return Ok(());
        }
        let written = serde_json::to_vec(&card).map_err(data_error)?;
        if cx
            .storage
            .shared()
            .put_if_version(key, &written, Some(version))
            .await?
        {
            for (person, note) in &answered {
                notification_center::withdraw_at(cx.storage.store(), person, cx.now_ms, APP, note)
                    .await?;
            }
            return Ok(());
        }
    }
    Err(io::Error::other("the invitation kept changing"))
}

/// Tell every open Calendar of these people to read its data again. A
/// failure only delays that until their next read.
async fn touch(cx: &mut ApiCtx<'_>, principals: &BTreeSet<String>) {
    let by = cx.session.id.clone();
    for principal in principals {
        if let Err(error) =
            notification_center::touched(cx.storage.store(), principal, APP, &by, cx.now_ms).await
        {
            ferrite_app::tracing::warn!(%error, "invitee's change count not moved");
        }
    }
}

fn people(invitees: &[Invitee]) -> Vec<serde_json::Value> {
    invitees
        .iter()
        .map(|invitee| {
            serde_json::json!({
                "name": invitee.person.name,
                "full_name": invitee.person.full_name,
                "status": invitee.status,
            })
        })
        .collect()
}

/// `GET /sent`: each invited event's invitees and their answers, after
/// carrying on with a reconcile that was cut short. `pending` says that some
/// of that work is still left, for the next read.
pub async fn sent(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let Some(account) = inviter(cx) else {
        return Ok(Response::json(
            200,
            &serde_json::json!({ "events": {}, "pending": false }),
        ));
    };
    let current = super::read(&mut cx.storage.user()).await?;
    let mut pending = false;
    if behind(cx, &account.id, current.doc.as_ref(), current.rev).await? {
        pending = reconcile(cx, &account).await? == Outcome::Pending;
    }
    let invites = current
        .doc
        .as_ref()
        .is_some_and(|doc| doc.events.iter().any(|event| !event.invitees.is_empty()));
    let mut events = serde_json::Map::new();
    if invites || pending {
        for (id, card) in cards(cx, &account.id).await?.0 {
            if card.event.is_some() {
                events.insert(id, serde_json::Value::Array(people(&card.invitees)));
            }
        }
    }
    Ok(Response::json(
        200,
        &serde_json::json!({ "events": events, "pending": pending }),
    ))
}

/// Which inbox entries a read of an inbox clears on the way.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Prune {
    /// Those whose card names the person nowhere.
    Orphans,
    /// Those, and those of events that ended more than [`PAST_MS`] ago: to
    /// make room in a full inbox.
    MakeRoom,
}

/// What a read of an inbox found.
struct Inbox {
    /// The cards that invite the person, with the token of each.
    live: Vec<(String, Card)>,
    /// How many entries the inbox still holds: those, and any it could not
    /// clear.
    held: usize,
}

/// A card as an inbox read finds it.
enum Found {
    Absent,
    /// A card this build cannot read (one an earlier or later build wrote):
    /// its entries are never cleared.
    Unreadable,
    Card(Card),
}

impl Found {
    fn of(bytes: Option<Vec<u8>>) -> Found {
        match bytes {
            None => Found::Absent,
            Some(bytes) => match serde_json::from_slice::<Card>(&bytes) {
                Ok(card) => Found::Card(card),
                Err(_) => Found::Unreadable,
            },
        }
    }
}

/// Whether the entry of a card is one `prune` clears: the card is gone, or
/// names `me` nowhere (not even among those still to be cleared, whose
/// entries are the reconcile's), or, to make room, invites `me` to an event
/// long over.
fn stale(found: &Found, me: &str, prune: Prune, now_ms: u64) -> bool {
    let card = match found {
        Found::Absent => return true,
        Found::Unreadable => return false,
        Found::Card(card) => card,
    };
    if !card.names(me) {
        return true;
    }
    prune == Prune::MakeRoom
        && card
            .event
            .as_ref()
            .is_some_and(|event| long_past(event, now_ms))
        && card.invitees.iter().any(|i| i.person.id == me)
}

/// The person's inbox: the cards it points at that invite them, the entries
/// `prune` names cleared on the way (at most [`MAX_PRUNE`]).
async fn read_inbox(cx: &mut ApiCtx<'_>, me: &str, prune: Prune) -> io::Result<Inbox> {
    let prefix = format!("inbox/{me}/");
    let entries: Vec<(String, Entry)> = cx
        .storage
        .shared()
        .list(&prefix, MAX_INBOX + INBOX_SLACK)
        .await?
        .into_iter()
        .filter_map(|(key, value)| {
            let token = key.strip_prefix(&prefix)?.to_string();
            serde_json::from_slice::<Entry>(&value)
                .ok()
                .map(|entry| (token, entry))
        })
        .collect();
    let keys: Vec<String> = entries
        .iter()
        .map(|(_, entry)| card_key(&entry.organizer, &entry.event))
        .collect();
    let read = cx.storage.shared().get_many(&keys).await?;
    let mut live = Vec::new();
    let mut held = 0;
    let mut tries = 0;
    for ((token, entry), bytes) in entries.into_iter().zip(read) {
        let found = Found::of(bytes);
        if !stale(&found, me, prune, cx.now_ms) {
            held += 1;
            if let Found::Card(card) = found {
                if card.event.is_some() && card.invitees.iter().any(|i| i.person.id == me) {
                    live.push((token, card));
                }
            }
            continue;
        }
        tries += 1;
        if tries > MAX_PRUNE || !clear_entry(cx, me, &token, &entry, prune).await? {
            held += 1;
        }
    }
    Ok(Inbox { live, held })
}

/// Clear the entry `token` of `me`'s inbox if it is still stale: its version
/// is read before its card is read again, and the entry is cleared only at
/// that version, so one the reconcile put back meanwhile stays. Clearing
/// writes an empty value that expires at once (the store has no conditional
/// delete); readers take it for no entry.
async fn clear_entry(
    cx: &mut ApiCtx<'_>,
    me: &str,
    token: &str,
    entry: &Entry,
    prune: Prune,
) -> io::Result<bool> {
    let key = inbox_key(me, token);
    let Some((bytes, version)) = cx.storage.shared().get_versioned(&key).await? else {
        return Ok(true);
    };
    if serde_json::from_slice::<Entry>(&bytes).ok().as_ref() != Some(entry) {
        return Ok(false);
    }
    let found = Found::of(
        cx.storage
            .shared()
            .get(&card_key(&entry.organizer, &entry.event))
            .await?,
    );
    if !stale(&found, me, prune, cx.now_ms) {
        return Ok(false);
    }
    cx.storage
        .shared()
        .put_if_version_expiring(&key, b"{}", Some(version), cx.now_ms + 1)
        .await
}

fn invitation(token: &str, card: &Card, me: &str) -> serde_json::Value {
    let mine = card.invitees.iter().find(|invitee| invitee.person.id == me);
    let mut event = serde_json::to_value(&card.event).unwrap_or(serde_json::Value::Null);
    if let Some(object) = event.as_object_mut() {
        object.remove("id");
        object.remove("calendar");
    }
    serde_json::json!({
        "id": token,
        "version": mine.map_or(0, |invitee| invitee.since),
        "organizer": { "name": card.organizer.name, "full_name": card.organizer.full_name },
        "event": event,
        "status": mine.map_or(Status::Pending, |invitee| invitee.status),
        "invitees": people(&card.invitees),
    })
}

/// `GET /inbox`: the invitations the person has, newest event first, and
/// whether the person may invite (`can_invite`: signed in, not a Guest User)
/// and their own account name (`me`), whom their events cannot invite.
pub async fn inbox(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let Some(account) = inviter(cx) else {
        return Ok(Response::json(
            200,
            &serde_json::json!({ "invitations": [], "can_invite": false, "me": null }),
        ));
    };
    let mut found = read_inbox(cx, &account.id, Prune::Orphans).await?.live;
    found.sort_by_key(|(_, card)| {
        std::cmp::Reverse(card.event.as_ref().map_or(0, |event| event.start))
    });
    let list: Vec<serde_json::Value> = found
        .iter()
        .map(|(token, card)| invitation(token, card, &account.id))
        .collect();
    Ok(Response::json(
        200,
        &serde_json::json!({ "invitations": list, "can_invite": true, "me": account.name }),
    ))
}

/// Whether `token` is one this module makes: 32 lower-case hex digits.
pub fn is_token(token: &str) -> bool {
    token.len() == 32
        && token
            .bytes()
            .all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
}

/// `POST /inbox/<token>/<version>/accept` or `/decline`: the person's answer
/// to the version of the event they saw, and a word to the organizer. 404 for
/// an invitation the person does not have, 409 when the event's time changed
/// since that version.
pub async fn respond(
    cx: &mut ApiCtx<'_>,
    token: &str,
    version: u64,
    status: Status,
) -> io::Result<Response> {
    let missing = || Response::error(404, "There is no such invitation.");
    let Some(account) = inviter(cx) else {
        return Ok(missing());
    };
    // A cleared entry is an empty value until it expires: no entry.
    let Some(entry) = cx
        .storage
        .shared()
        .get(&inbox_key(&account.id, token))
        .await?
        .and_then(|bytes| serde_json::from_slice::<Entry>(&bytes).ok())
    else {
        return Ok(missing());
    };
    let key = card_key(&entry.organizer, &entry.event);
    for _ in 0..CAS_ATTEMPTS {
        let Some((bytes, stored)) = cx.storage.shared().get_versioned(&key).await? else {
            return Ok(missing());
        };
        let mut card: Card = serde_json::from_slice(&bytes).map_err(data_error)?;
        let live = card.event.is_some();
        // Taken back, or the person taken off: checked in the same write as the answer.
        let Some(mine) = card
            .invitees
            .iter_mut()
            .find(|invitee| invitee.person.id == account.id)
            .filter(|_| live)
        else {
            return Ok(missing());
        };
        if mine.since != version {
            return Ok(Response::json(
                409,
                &serde_json::json!({
                    "error": "The event changed since. Look at it again before you answer.",
                    "version": mine.since,
                }),
            ));
        }
        let changed = mine.status != status;
        mine.status = status;
        // The notifications asking them, recorded or not.
        let mut withdrawn = mine.withdrawals("");
        let asked = invite_note(token, mine.since);
        if !withdrawn.contains(&asked) {
            withdrawn.push(asked);
        }
        let since = mine.since;
        if changed {
            let written = serde_json::to_vec(&card).map_err(data_error)?;
            if !cx
                .storage
                .shared()
                .put_if_version(&key, &written, Some(stored))
                .await?
            {
                continue;
            }
        }
        for old in &withdrawn {
            notification_center::withdraw_at(cx.storage.store(), &account.id, cx.now_ms, APP, old)
                .await?;
        }
        if changed {
            let title = card
                .event
                .as_ref()
                .map_or("New Event", title_of)
                .to_string();
            let said = match status {
                Status::Accepted => "accepted",
                Status::Declined => "declined",
                Status::Pending => "has not answered",
            };
            // One word of each answer to each version: changing it back and
            // forth tells the organizer once of each.
            notification_center::notify(
                cx.storage.store(),
                &card.organizer.id,
                cx.now_ms,
                &note(
                    format!("reply-{token}-{}-{said}-{since}", account.name),
                    format!("{} {said}", account.full_name),
                    &title,
                    Vec::new(),
                ),
            )
            .await?;
            touch(cx, &BTreeSet::from([card.organizer.id.clone()])).await;
        }
        return Ok(Response::json(200, &invitation(token, &card, &account.id)));
    }
    Ok(Response::error(
        503,
        "The invitation kept changing. Try again.",
    ))
}

/// `GET /people/<name>`: the account an invitation can be sent to, by its exact name.
pub async fn people_route(cx: &mut ApiCtx<'_>, raw: &str) -> io::Result<Response> {
    if inviter(cx).is_none() {
        return Ok(Response::error(
            401,
            "Sign in to an account to invite people.",
        ));
    }
    let Some(name) = crate::accounts::account_name(raw) else {
        return Ok(Response::error(
            400,
            "An account name is 1 to 32 lower-case letters, digits, \u{201c}.\u{201d}, \u{201c}_\u{201d} or \u{201c}-\u{201d}, starting with a letter.",
        ));
    };
    match crate::accounts::lookup(cx.storage.store(), &name).await? {
        Some(found) => Ok(Response::json(
            200,
            &serde_json::json!({ "name": found.name, "full_name": found.full_name }),
        )),
        None => Ok(Response::error(
            404,
            &format!("No one on this desktop has the account name \u{201c}{name}\u{201d}."),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn event(invitees: &[&str]) -> Event {
        Event {
            id: "lunch".into(),
            title: "Lunch".into(),
            start: 1_000,
            end: 2_000,
            all_day: false,
            calendar: "work".into(),
            location: None,
            notes: None,
            url: None,
            repeat: None,
            exdates: Vec::new(),
            invitees: invitees.iter().map(|name| name.to_string()).collect(),
            time_zone: None,
            floating: false,
            alert: None,
            alert_dismissed: None,
            alert_snooze: None,
            show_as: None,
            travel_time: None,
            attachments: Vec::new(),
        }
    }

    fn invitee(name: &str, status: Status) -> Invitee {
        Invitee {
            person: Person {
                id: format!("u-{name}"),
                name: name.into(),
                full_name: name.to_uppercase(),
            },
            status,
            since: 1,
            note: format!("invite-{name}"),
            due: false,
            unrecorded: Vec::new(),
        }
    }

    fn organizer() -> Person {
        Person {
            id: "u-org".into(),
            name: "org".into(),
            full_name: "Org".into(),
        }
    }

    fn card(invitees: Vec<Invitee>) -> Card {
        Card {
            rev: 1,
            organizer: organizer(),
            event: Some(shown(&event(&["anna", "ben"]))),
            invitees,
            leaving: Vec::new(),
            missing: Vec::new(),
        }
    }

    #[test]
    fn an_invitation_leaves_the_organizer_s_alert_out() {
        let mut theirs = event(&["anna"]);
        theirs.alert = Some(15);
        theirs.alert_dismissed = Some(theirs.start);
        let card = shown(&theirs);
        assert_eq!(card.alert, None);
        assert_eq!(card.alert_dismissed, None);
        assert_eq!(card.title, theirs.title);
    }

    #[test]
    fn a_request_always_does_its_first_unit_of_work() {
        let mut budget = Budget(PASS_STEPS);
        assert!(
            budget.take(PASS_STEPS * 3),
            "a card dearer than a budget is still written"
        );
        assert_eq!(budget.0, 0);
        assert!(!budget.take(1));
        let mut budget = Budget(PASS_STEPS);
        assert!(budget.take(10) && budget.take(PASS_STEPS - 10));
        assert!(!budget.take(1));
    }

    #[test]
    fn tokens_are_stable_hex_and_differ_by_event() {
        let a = token("u-1", "lunch");
        assert_eq!(a, token("u-1", "lunch"));
        assert_ne!(a, token("u-1", "dinner"));
        assert_ne!(a, token("u-2", "lunch"));
        assert!(is_token(&a));
        assert!(!is_token("ABC"));
        assert!(!is_token(&"g".repeat(32)));
    }

    #[test]
    fn an_answer_holds_until_the_event_moves() {
        let card = card(vec![
            invitee("anna", Status::Accepted),
            invitee("ben", Status::Declined),
        ]);
        // A new title keeps the answers; the new name is to be looked up.
        let mut renamed = event(&["anna", "ben", "cara"]);
        renamed.title = "Long lunch".into();
        let (next, unknown) = desired(Some(&card), &organizer(), &renamed, 2, "t");
        assert_eq!(unknown, ["cara"]);
        assert_eq!(
            next.invitees.iter().map(|i| i.status).collect::<Vec<_>>(),
            [Status::Accepted, Status::Declined]
        );
        assert!(next.invitees.iter().all(|i| !i.due && i.since == 1));
        assert_eq!(next.event.as_ref().unwrap().calendar, "invitations");
        assert!(next.event.as_ref().unwrap().invitees.is_empty());
        // A new time asks everyone again, at the new revision.
        let mut later = event(&["anna"]);
        later.start += 3_600_000;
        later.end += 3_600_000;
        let (next, unknown) = desired(Some(&card), &organizer(), &later, 3, "t");
        assert!(unknown.is_empty());
        assert_eq!(next.invitees.len(), 1);
        assert_eq!(next.invitees[0].status, Status::Pending);
        assert_eq!((next.invitees[0].since, next.invitees[0].due), (3, true));
        // Ben, taken off, is to be cleared, his notification with him.
        assert_eq!(next.leaving.len(), 1);
        assert_eq!(next.leaving[0].person.name, "ben");
        assert_eq!(next.leaving[0].note, "invite-ben");
        // A card taken back keeps nobody, and asks again whoever was leaving.
        let gone = Card {
            event: None,
            invitees: Vec::new(),
            leaving: vec![invitee("anna", Status::Accepted)],
            ..card
        };
        let (back, unknown) = desired(Some(&gone), &organizer(), &event(&["anna"]), 4, "t");
        assert!(unknown.is_empty());
        assert!(back.leaving.is_empty());
        assert_eq!((back.invitees[0].since, back.invitees[0].due), (4, true));
        assert_eq!(back.invitees[0].status, Status::Pending);
    }

    #[test]
    fn a_card_the_save_did_not_change_is_the_same_at_any_revision() {
        let stored = card(vec![
            invitee("anna", Status::Accepted),
            invitee("ben", Status::Pending),
        ]);
        let (wanted, unknown) = desired(
            Some(&stored),
            &organizer(),
            &event(&["anna", "ben"]),
            9,
            "t",
        );
        assert!(unknown.is_empty());
        assert_eq!(wanted.rev, 9);
        assert!(stored.same(&wanted), "nothing to write");
        assert!(!stored.unfinished());
        let mut answered = stored.clone();
        answered.invitees[1].status = Status::Declined;
        assert!(!answered.same(&wanted));
    }

    #[test]
    fn a_notification_a_cut_short_pass_may_have_sent_is_withdrawn_later() {
        // Ben was being told when a pass stopped: due, and no notification recorded.
        let mut ben = invitee("ben", Status::Pending);
        ben.note = String::new();
        ben.due = true;
        ben.since = 5;
        let stored = card(vec![invitee("anna", Status::Accepted), ben]);
        // Taken off, he is to be cleared of the notification that pass may have sent.
        let (next, _) = desired(Some(&stored), &organizer(), &event(&["anna"]), 6, "t");
        assert_eq!(next.leaving[0].withdrawals(""), [invite_note("t", 5)]);
        // Asked again at a new time, the same one is withdrawn first.
        let mut later = event(&["anna", "ben"]);
        later.start += 60_000;
        let (next, _) = desired(Some(&stored), &organizer(), &later, 7, "t");
        assert_eq!((next.invitees[1].since, next.invitees[1].due), (7, true));
        assert_eq!(
            next.invitees[1].withdrawals(&invite_note("t", 7)),
            [invite_note("t", 5)]
        );
        // Anna, told at 1 and then moved to 2 without being told, is moved again: both go.
        let mut anna = invitee("anna", Status::Pending);
        anna.note = invite_note("t", 1);
        anna.since = 2;
        anna.due = true;
        let stored = card(vec![anna]);
        let mut again = event(&["anna"]);
        again.start += 120_000;
        let (next, _) = desired(Some(&stored), &organizer(), &again, 3, "t");
        assert_eq!(
            next.invitees[0].withdrawals(&invite_note("t", 3)),
            [invite_note("t", 1), invite_note("t", 2)]
        );
    }

    #[test]
    fn a_name_that_names_no_account_is_looked_up_once() {
        let stored = Card {
            missing: vec!["zed".into()],
            ..card(vec![invitee("anna", Status::Pending)])
        };
        let (next, unknown) = desired(
            Some(&stored),
            &organizer(),
            &event(&["anna", "zed"]),
            3,
            "t",
        );
        assert!(unknown.is_empty(), "{unknown:?}");
        assert_eq!(next.missing, ["zed"]);
        assert!(stored.same(&next));
        // Dropped from the event, it is forgotten.
        let (next, _) = desired(Some(&stored), &organizer(), &event(&["anna"]), 4, "t");
        assert!(next.missing.is_empty());
        // A new title changes nothing; a new list of invitees looks it up again.
        let mut renamed = event(&["anna", "zed"]);
        renamed.title = "Long lunch".into();
        let (_, unknown) = desired(Some(&stored), &organizer(), &renamed, 5, "t");
        assert!(unknown.is_empty(), "{unknown:?}");
        let (_, unknown) = desired(
            Some(&stored),
            &organizer(),
            &event(&["anna", "zed", "ben"]),
            6,
            "t",
        );
        assert_eq!(unknown, ["zed", "ben"]);
    }

    #[test]
    fn an_inbox_read_clears_only_what_no_card_still_names() {
        let mut stored = card(vec![invitee("anna", Status::Pending)]);
        stored.leaving = vec![invitee("ben", Status::Pending)];
        // Anna is invited, Ben is still to be cleared by the reconcile: neither is stale.
        assert!(!stale(
            &Found::Card(stored.clone()),
            "u-anna",
            Prune::Orphans,
            0
        ));
        assert!(!stale(
            &Found::Card(stored.clone()),
            "u-ben",
            Prune::Orphans,
            0
        ));
        assert!(stale(
            &Found::Card(stored.clone()),
            "u-cara",
            Prune::Orphans,
            0
        ));
        assert!(stale(&Found::Absent, "u-anna", Prune::Orphans, 0));
        // A card this build cannot read keeps its entries.
        assert!(!stale(&Found::Unreadable, "u-anna", Prune::Orphans, 0));
        // Long over, Anna's invitation makes room only when room is wanted.
        let now = (PAST_MS + 10_000) as u64;
        assert!(!stale(
            &Found::Card(stored.clone()),
            "u-anna",
            Prune::Orphans,
            now
        ));
        assert!(stale(
            &Found::Card(stored.clone()),
            "u-anna",
            Prune::MakeRoom,
            now
        ));
        assert!(!stale(
            &Found::Card(stored.clone()),
            "u-ben",
            Prune::MakeRoom,
            now
        ));
    }

    #[test]
    fn an_event_long_over_leaves_the_inbox_and_a_repeat_without_an_end_never_does() {
        let day = 24 * 60 * 60 * 1000;
        let now = (100 * day) as u64;
        let mut over = event(&[]);
        over.end = 100 * day - PAST_MS - 1;
        assert!(long_past(&over, now));
        over.end = 100 * day - PAST_MS + 1;
        assert!(!long_past(&over, now));
        over.end = 10 * day;
        over.repeat = Some(super::super::model::Repeat {
            freq: super::super::model::Freq::Daily,
            interval: 1,
            count: None,
            until: None,
            days: Vec::new(),
        });
        assert!(!long_past(&over, now));
        over.repeat.as_mut().unwrap().until = Some(20 * day);
        assert!(long_past(&over, now));
    }

    #[test]
    fn an_invitation_shows_no_account_id() {
        let card = Card {
            rev: 1,
            organizer: organizer(),
            event: Some(shown(&event(&[]))),
            invitees: vec![invitee("anna", Status::Accepted)],
            leaving: Vec::new(),
            missing: Vec::new(),
        };
        let view = invitation("t", &card, "u-anna").to_string();
        assert!(
            !view.contains("u-anna") && !view.contains("u-org"),
            "{view}"
        );
        assert!(view.contains(r#""status":"accepted""#), "{view}");
        assert!(view.contains(r#""version":1"#), "{view}");
        assert!(!view.contains(r#""calendar""#), "{view}");
    }
}

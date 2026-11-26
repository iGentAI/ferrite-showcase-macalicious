//! Attachments: the files a person sends with a Mail message or in a Messages
//! conversation.
//!
//! The page uploads an attachment in pieces before it sends the message, one
//! request a piece under the gateway's 256 KiB body cap, exactly as the drive
//! does (`src/apps/files/mod.rs`): a file from the person's drive is read in
//! the browser and uploaded here, so it does not matter which person's drive
//! it came from, and a file from the real computer goes the same way.
//!
//! * Staging (`stage`) records the attachment in the sender's own space of
//!   the module (`att/<id>`), with its name, type, size, number of pieces and
//!   [`State`], and counts its size against the sender's daily
//!   [`ALLOWANCE_BYTES`] for that module. The id is 128 random bits.
//! * A piece is written without any claim (`put_piece`): every attempt
//!   writes its own blob object `<module>/att/<id>/<n>-<attempt>` (a fresh
//!   random attempt id), then creates the marker `att/<id>/done/<n>` naming
//!   that attempt, only if absent. The first marker wins and is never
//!   replaced, so a piece's bytes cannot change once published; a write that
//!   failed anywhere is simply tried again; an attempt that lost the race
//!   deletes its own object.
//!
//! **Lifecycle.** The record's state changes only by compare-and-set, and
//! every change is decided by [`next_state`]:
//!
//! * `uploading` → `sealed` (`seal`, once every piece has its marker; the
//!   winning attempts are copied into the attachment as its `parts`);
//! * `sealed` → `held` (a saved draft holds it, with no expiry);
//! * `sealed` or `held` → `sent` (`take`, by a message about to be stored,
//!   naming the send's token; the same token takes it again, so a resend of
//!   the same message succeeds; nothing ever gives it back);
//! * `uploading` or `sealed` → `cancelled` (`cancel`). Only the request whose
//!   compare-and-set made it `cancelled` deletes the bytes, and nothing a
//!   message or draft carries (`sent`, `held`) can be cancelled.
//!
//! A message carries each attachment's record (id, name, type, size and
//! parts) in every copy, so reading never needs the sender's staging record.
//! From then on the module decides who may read the bytes: a Mail message in
//! the reader's own mailbox, or a conversation the reader belongs to, that
//! names the attachment. [`read`] serves them as inert bytes.
//!
//! **Allowance.** A person may stage at most [`ALLOWANCE_BYTES`] of
//! attachments a day (UTC) in each module. Nothing is given back: a cancelled
//! or abandoned upload counts until the day ends, and the next day starts at
//! zero.
//!
//! **Known limits.** Sent attachments are shared by every copy of the message
//! (each recipient's, and the sender's). Mail notes each copy and frees the
//! bytes with the last (`mail/copies.rs`); in Messages no copy knows of the
//! others, so deleting a message does not delete the bytes. Dropping an
//! attachment from a saved draft does not either. A piece's object is left behind when its
//! marker and the marker's read-back both fail, or when its upload races its
//! own cancel; [`max_attempts`] bounds how many one upload can leave, each no
//! larger than the piece its file was charged for. Two requests competing for one file leave what the loser took
//! before it lost as sent, since nothing gives a file back, so that file is
//! attached anew; no bytes a message names are ever at risk from this. The
//! allowance bounds how fast these can grow, not how much they add up to. An
//! upload never finished or sent is cleared by [`sweep`].

use std::io;

use ferrite_app::client::BlobClusterClient;
use ferrite_app::{serde, serde_json, AppContext};

use crate::http::Response;
use crate::module::Space;

/// The blob binding the bytes go to (the drive's).
pub const BLOB_BINDING: &str = "files";
/// One piece: the drive's size, under the gateway's body cap.
pub const PIECE_BYTES: u64 = 192 * 1024;
/// The largest attachment.
pub const MAX_BYTES: u64 = 10 * 1024 * 1024;
/// The bytes one person may stage in one module in a UTC day; nothing
/// staged is given back.
pub const ALLOWANCE_BYTES: u64 = 256 * 1024 * 1024;
/// The most pieces one read returns.
pub const MAX_READ_PIECES: u32 = 8;
/// How long a staged attachment waits to be sent.
pub const STAGED_TTL_MS: u64 = 24 * 60 * 60 * 1000;
/// One UTC day: the allowance's period.
const DAY_MS: u64 = 24 * 60 * 60 * 1000;
/// The longest name, in bytes.
pub const MAX_NAME_BYTES: usize = 255;
const ALLOWANCE_KEY: &str = "att-allowance";
const CAS_ATTEMPTS: usize = 8;

/// An attachment as a message carries it.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Attachment {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub mime: String,
    pub size: u64,
    /// The attempt whose object holds each piece, in order (set when the
    /// attachment is sealed).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub parts: Vec<String>,
}

/// Where an attachment is in its life (see the module documentation).
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum State {
    Uploading,
    Sealed,
    Held,
    /// Taken by the message of send token `by`, for good.
    Sent {
        by: String,
    },
    Cancelled,
}

/// A change asked of an attachment.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Op<'a> {
    Seal,
    Hold,
    Take(&'a str),
    Cancel,
}

/// What a change does to an attachment in `state`.
#[derive(Debug, PartialEq, Eq)]
pub enum Next {
    /// Write this state (by compare-and-set).
    Write(State),
    /// Nothing to write: the change is already so.
    Keep,
    /// Refused, with a status and a message.
    Refuse(u16, &'static str),
}

/// The one rule of the lifecycle: what `op` does to an attachment in
/// `state`. `expired` is whether its staging time has passed (a held
/// attachment, which a draft keeps, never expires).
pub fn next_state(state: &State, op: Op<'_>, expired: bool) -> Next {
    use State::{Cancelled, Held, Sealed, Sent, Uploading};
    match (op, state) {
        (Op::Seal, Uploading) if expired => Next::Refuse(404, "no such attachment"),
        (Op::Seal, Uploading) => Next::Write(Sealed),
        (Op::Seal, Sealed | Held | Sent { .. }) => Next::Keep,
        (Op::Hold, Sealed) if expired => Next::Refuse(409, "an attachment has expired"),
        (Op::Hold, Sealed) => Next::Write(Held),
        (Op::Hold, Held) => Next::Keep,
        (Op::Take(token), Sealed) if !expired => Next::Write(Sent {
            by: token.to_string(),
        }),
        (Op::Take(token), Held) => Next::Write(Sent {
            by: token.to_string(),
        }),
        (Op::Take(token), Sent { by }) if by == token => Next::Keep,
        (Op::Take(_), Sealed) => Next::Refuse(409, "an attachment has expired"),
        (Op::Take(_) | Op::Hold, Uploading) => {
            Next::Refuse(409, "an attachment has not finished uploading")
        }
        (Op::Cancel, Uploading | Sealed) => Next::Write(Cancelled),
        (Op::Cancel, _) => Next::Keep,
        (_, Cancelled) => Next::Refuse(404, "no such attachment"),
        (Op::Take(_) | Op::Hold, Sent { .. }) => {
            Next::Refuse(409, "an attachment was already sent with another message")
        }
    }
}

/// An attachment staged in its sender's space.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
struct Staged {
    attachment: Attachment,
    pieces: u32,
    expires_ms: u64,
    state: State,
    /// How many objects this upload has begun writing ([`max_attempts`]).
    #[serde(default)]
    attempts: u32,
}

impl Staged {
    fn expired(&self, now_ms: u64) -> bool {
        self.state != State::Held && self.expires_ms <= now_ms
    }
}

/// Why a request about an attachment is refused.
#[derive(Debug)]
pub enum Refusal {
    /// A status and a message for the page.
    Status(u16, String),
    /// Storage failed: 503.
    Storage(io::Error),
}

impl From<io::Error> for Refusal {
    fn from(error: io::Error) -> Self {
        Refusal::Storage(error)
    }
}

impl Refusal {
    fn status(status: u16, message: impl Into<String>) -> Self {
        Refusal::Status(status, message.into())
    }

    pub fn reply(self) -> Response {
        match self {
            Refusal::Status(status, message) => Response::error(status, &message),
            Refusal::Storage(error) => Response::error(503, &error.to_string()),
        }
    }
}

fn data_error(e: serde_json::Error) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, e.to_string())
}

/// A fresh 128-bit id in hex.
pub fn new_id() -> io::Result<String> {
    crate::crypto::random_token(16)
}

/// Whether `id` can be an attachment's id: 32 lowercase hex digits.
pub fn is_id(id: &str) -> bool {
    id.len() == 32 && id.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
}

/// The pieces of an attachment of `size` bytes (an empty one has one, empty).
pub fn pieces_for(size: u64) -> u32 {
    size.div_ceil(PIECE_BYTES).max(1) as u32
}

/// The length of piece `n` of an attachment of `size` bytes.
pub fn piece_len(size: u64, n: u32) -> u64 {
    let start = u64::from(n) * PIECE_BYTES;
    size.saturating_sub(start).min(PIECE_BYTES)
}

/// The name kept: trimmed, at most [`MAX_NAME_BYTES`], no `/`, no `\`, no
/// control characters, not `.` or `..`.
pub fn clean_name(name: &str) -> Option<String> {
    let name = name.trim();
    let ok = !name.is_empty()
        && name.len() <= MAX_NAME_BYTES
        && name != "."
        && name != ".."
        && !name
            .chars()
            .any(|c| c.is_control() || c == '/' || c == '\\');
    ok.then(|| name.to_string())
}

/// The media type kept: `type/subtype` in lowercase, or
/// `application/octet-stream` for anything else.
pub fn clean_type(mime: &str) -> String {
    let mime = mime
        .split(';')
        .next()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    let valid = mime.len() <= 100
        && mime.split_once('/').is_some_and(|(a, b)| {
            !a.is_empty()
                && !b.is_empty()
                && (a.bytes().chain(b.bytes()))
                    .all(|c| c.is_ascii_alphanumeric() || matches!(c, b'-' | b'+' | b'.' | b'_'))
        });
    if valid {
        mime
    } else {
        "application/octet-stream".into()
    }
}

fn staged_key(id: &str) -> String {
    format!("att/{id}")
}

fn done_prefix(id: &str) -> String {
    format!("att/{id}/done/")
}

fn done_key(id: &str, n: u32) -> String {
    format!("{}{n:05}", done_prefix(id))
}

/// The blob key of piece `n` of attachment `id` of module `app`, as attempt
/// `attempt` wrote it.
pub fn blob_key(app: &str, id: &str, n: u32, attempt: &str) -> Vec<u8> {
    format!("{app}/att/{id}/{n:05}-{attempt}").into_bytes()
}

/// Whether `attempt` can be an attempt id: 16 lowercase hex digits.
fn is_attempt(attempt: &str) -> bool {
    attempt.len() == 16
        && attempt
            .bytes()
            .all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
}

fn blob(ctx: &AppContext) -> io::Result<BlobClusterClient> {
    ctx.blob(BLOB_BINDING)
}

/// The staging record of `id` and its store version; `None` when there is
/// none (or the id cannot be one).
async fn read_staged(space: &mut Space<'_>, id: &str) -> Result<Option<(Staged, u64)>, Refusal> {
    if !is_id(id) {
        return Ok(None);
    }
    match space.get_versioned(&staged_key(id)).await? {
        Some((bytes, version)) => {
            let staged = serde_json::from_slice(&bytes).map_err(data_error)?;
            Ok(Some((staged, version)))
        }
        None => Ok(None),
    }
}

/// Apply `op` to attachment `id` by compare-and-set; a seal also records
/// `parts` (read before: a piece's marker never changes once made). Answers
/// the record as it now is, and whether this call changed it.
async fn change(
    space: &mut Space<'_>,
    id: &str,
    op: Op<'_>,
    now_ms: u64,
    parts: &[String],
) -> Result<(Staged, bool), Refusal> {
    for _ in 0..CAS_ATTEMPTS {
        let Some((mut staged, version)) = read_staged(space, id).await? else {
            return Err(Refusal::status(404, "no such attachment"));
        };
        let next = match next_state(&staged.state, op, staged.expired(now_ms)) {
            Next::Keep => return Ok((staged, false)),
            Next::Refuse(status, message) => return Err(Refusal::status(status, message)),
            Next::Write(next) => next,
        };
        if op == Op::Seal {
            staged.attachment.parts = parts.to_vec();
        }
        // Kept a day from now, for a resend of the send that took it.
        if matches!(next, State::Sent { .. }) {
            staged.expires_ms = now_ms + STAGED_TTL_MS;
        }
        staged.state = next;
        let bytes = serde_json::to_vec(&staged).map_err(data_error)?;
        if space
            .put_if_version(&staged_key(id), &bytes, Some(version))
            .await?
        {
            return Ok((staged, true));
        }
    }
    Err(Refusal::status(503, "the attachment kept changing; retry"))
}

/// Count `size` more bytes staged today (`now_ms`, UTC days): an error 413
/// when today's total would pass [`ALLOWANCE_BYTES`].
async fn charge(space: &mut Space<'_>, size: u64, now_ms: u64) -> Result<(), Refusal> {
    let today = now_ms / DAY_MS;
    for _ in 0..CAS_ATTEMPTS {
        let stored = space.get_versioned(ALLOWANCE_KEY).await?;
        let version = stored.as_ref().map(|(_, v)| *v);
        let (day, used): (u64, u64) = match &stored {
            Some((bytes, _)) => serde_json::from_slice(bytes).map_err(data_error)?,
            None => (today, 0),
        };
        // A day already moved on by another request is kept: the count never goes back to an
        // earlier day.
        let day_now = today.max(day);
        let used = if day == day_now { used } else { 0 };
        let next = used.saturating_add(size);
        if next > ALLOWANCE_BYTES {
            return Err(Refusal::status(
                413,
                "this would pass the attachments allowance of 256 MB a day",
            ));
        }
        let bytes = serde_json::to_vec(&(day_now, next)).map_err(data_error)?;
        if space.put_if_version(ALLOWANCE_KEY, &bytes, version).await? {
            return Ok(());
        }
    }
    Err(Refusal::status(503, "the allowance kept changing; retry"))
}

/// The body of `POST .../attachments`.
#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
pub struct NewAttachment {
    pub name: String,
    #[serde(default, rename = "type")]
    pub mime: String,
    pub size: u64,
}

/// Stage a new attachment in `space` (the sender's own space of the module):
/// `201 {"attachment", "piece_bytes", "pieces"}`.
pub async fn stage(space: &mut Space<'_>, new: &NewAttachment, now_ms: u64) -> Response {
    match stage_inner(space, new, now_ms).await {
        Ok(reply) => reply,
        Err(refusal) => refusal.reply(),
    }
}

async fn stage_inner(
    space: &mut Space<'_>,
    new: &NewAttachment,
    now_ms: u64,
) -> Result<Response, Refusal> {
    let Some(name) = clean_name(&new.name) else {
        return Err(Refusal::status(
            400,
            "a name is 1 to 255 bytes without '/' or control characters",
        ));
    };
    if new.size > MAX_BYTES {
        return Err(Refusal::status(413, "an attachment is at most 10 MB"));
    }
    // Charged first: a record the page never gets still counts until the day
    // ends, and nothing is ever given back.
    charge(space, new.size, now_ms).await?;
    let attachment = Attachment {
        id: new_id()?,
        name,
        mime: clean_type(&new.mime),
        size: new.size,
        parts: Vec::new(),
    };
    let pieces = pieces_for(new.size);
    let staged = Staged {
        attachment: attachment.clone(),
        pieces,
        expires_ms: now_ms + STAGED_TTL_MS,
        state: State::Uploading,
        attempts: 0,
    };
    let bytes = serde_json::to_vec(&staged).map_err(data_error)?;
    let key = staged_key(&attachment.id);
    space.put(&key, &bytes).await?;
    Ok(Response::json(
        201,
        &serde_json::json!({
            "attachment": attachment,
            "piece_bytes": PIECE_BYTES,
            "pieces": pieces,
        }),
    ))
}

/// The most objects one upload may begin writing: each piece twice and a few
/// more for failures. An object that fails to be recorded cannot be found
/// again, so this, with the charge for the file's size, bounds what can leak.
fn max_attempts(pieces: u32) -> u32 {
    pieces.saturating_mul(2).saturating_add(16)
}

/// Count one more object begun for upload `id`, or refuse it past the limit.
async fn count_attempt(space: &mut Space<'_>, id: &str) -> Result<(), Refusal> {
    for _ in 0..CAS_ATTEMPTS {
        let Some((mut staged, version)) = read_staged(space, id).await? else {
            return Err(Refusal::status(404, "no such attachment"));
        };
        if staged.state != State::Uploading {
            return Err(Refusal::status(409, "the attachment is not being uploaded"));
        }
        if staged.attempts >= max_attempts(staged.pieces) {
            return Err(Refusal::status(
                409,
                "this file failed too many times; attach it again",
            ));
        }
        staged.attempts += 1;
        let bytes = serde_json::to_vec(&staged).map_err(data_error)?;
        if space
            .put_if_version(&staged_key(id), &bytes, Some(version))
            .await?
        {
            return Ok(());
        }
    }
    Err(Refusal::status(503, "the attachment kept changing; retry"))
}

/// Write piece `n` of the staged attachment `id`.
pub async fn put_piece(
    space: &mut Space<'_>,
    ctx: &AppContext,
    app: &str,
    id: &str,
    n: u32,
    body: &[u8],
    now_ms: u64,
) -> Response {
    match put_piece_inner(space, ctx, app, id, n, body, now_ms).await {
        Ok(reply) => reply,
        Err(refusal) => refusal.reply(),
    }
}

async fn put_piece_inner(
    space: &mut Space<'_>,
    ctx: &AppContext,
    app: &str,
    id: &str,
    n: u32,
    body: &[u8],
    now_ms: u64,
) -> Result<Response, Refusal> {
    let Some((staged, _)) = read_staged(space, id).await? else {
        return Err(Refusal::status(404, "no such attachment"));
    };
    if n >= staged.pieces {
        return Err(Refusal::status(400, "the attachment has no such piece"));
    }
    let expected = piece_len(staged.attachment.size, n);
    if body.len() as u64 != expected {
        return Err(Refusal::status(
            400,
            format!("piece {n} is {expected} bytes"),
        ));
    }
    let done = Response::json(200, &serde_json::json!({ "piece": n }));
    // Published already: its bytes never change.
    if space.get(&done_key(id, n)).await?.is_some() {
        return Ok(done);
    }
    if staged.state != State::Uploading || staged.expired(now_ms) {
        return Err(Refusal::status(409, "the attachment is not being uploaded"));
    }
    // No claim: this attempt writes an object of its own, and the first
    // marker made wins. A failure anywhere leaves nothing a retry must wait
    // for.
    count_attempt(space, id).await?;
    let attempt = crate::crypto::random_token(8)?;
    let key = blob_key(app, id, n, &attempt);
    let mut blobs = blob(ctx)?;
    blobs.put(&key, body).await?;
    let marker = done_key(id, n);
    let ours = match space
        .put_if_version(&marker, attempt.as_bytes(), None)
        .await
    {
        Ok(created) => created,
        // The marker's outcome is unknown: read it back. Ours is kept only
        // when the marker names it, and is never deleted while that is
        // unknown.
        Err(error) => match space.get(&marker).await {
            Ok(Some(named)) => named == attempt.as_bytes(),
            Ok(None) => {
                if let Err(error) = blobs.delete(&key).await {
                    ferrite_app::tracing::warn!(%error, "an unpublished piece was left");
                }
                return Err(error.into());
            }
            Err(_) => return Err(error.into()),
        },
    };
    if !ours {
        // Another attempt published the piece first: this one is not used.
        if let Err(error) = blobs.delete(&key).await {
            ferrite_app::tracing::warn!(%error, "an unused piece was left");
        }
        return Ok(done);
    }
    // Cancelled meanwhile? A cancel lists the published pieces only after it
    // has made the attachment cancelled, so a piece published before that is
    // in its list; one published after finds the cancel here and deletes
    // itself. Either way no piece outlives a cancel uncharged.
    match read_staged(space, id).await {
        Ok(Some((now, _))) if now.state != State::Cancelled => {}
        Ok(_) => {
            if let Err(error) = blobs.delete(&key).await {
                ferrite_app::tracing::warn!(%error, "a piece of a cancelled attachment was left");
            } else if let Err(error) = space.delete(&marker).await {
                ferrite_app::tracing::warn!(%error, "a cancelled piece's marker was left");
            }
            return Err(Refusal::status(409, "the attachment was cancelled"));
        }
        Err(refusal) => return Err(refusal),
    }
    Ok(done)
}

/// The attempt that published each piece of `staged`, in order, or the
/// pieces that have not arrived yet.
async fn published(
    space: &mut Space<'_>,
    id: &str,
    pieces: u32,
) -> Result<Result<Vec<String>, Vec<u32>>, Refusal> {
    let done = space.list(&done_prefix(id), pieces as usize + 1).await?;
    let mut parts: Vec<Option<String>> = vec![None; pieces as usize];
    for (key, value) in done {
        let n: Option<usize> = key.rsplit('/').next().and_then(|n| n.parse().ok());
        let attempt = String::from_utf8(value).ok().filter(|a| is_attempt(a));
        if let (Some(n), Some(attempt)) = (n, attempt) {
            if let Some(slot) = parts.get_mut(n) {
                *slot = Some(attempt);
            }
        }
    }
    let missing: Vec<u32> = (0..pieces)
        .filter(|&n| parts[n as usize].is_none())
        .take(64)
        .collect();
    if missing.is_empty() {
        Ok(Ok(parts.into_iter().flatten().collect()))
    } else {
        Ok(Err(missing))
    }
}

/// Seal the staged attachment `id` once every piece has arrived:
/// `{"attachment"}`, or 409 with the pieces still `missing`.
pub async fn seal(space: &mut Space<'_>, id: &str, now_ms: u64) -> Response {
    match seal_inner(space, id, now_ms).await {
        Ok(reply) => reply,
        Err(refusal) => refusal.reply(),
    }
}

async fn seal_inner(space: &mut Space<'_>, id: &str, now_ms: u64) -> Result<Response, Refusal> {
    let Some((staged, _)) = read_staged(space, id).await? else {
        return Err(Refusal::status(404, "no such attachment"));
    };
    let parts = if staged.state == State::Uploading {
        match published(space, id, staged.pieces).await? {
            Ok(parts) => parts,
            Err(missing) => {
                return Ok(Response::json(
                    409,
                    &serde_json::json!({
                        "error": "some pieces have not arrived",
                        "missing": missing,
                    }),
                ))
            }
        }
    } else {
        Vec::new()
    };
    let (staged, _) = change(space, id, Op::Seal, now_ms, &parts).await?;
    Ok(Response::json(
        200,
        &serde_json::json!({ "attachment": staged.attachment }),
    ))
}

/// Give up the attachment `id`: `{"cancelled": true}` when this request
/// cancelled it, and then deleted its bytes; `{"cancelled": false}` when
/// there is nothing to cancel (unknown, already cancelled, or carried by a
/// message or a draft, which keep it).
pub async fn cancel(
    space: &mut Space<'_>,
    ctx: &AppContext,
    app: &str,
    id: &str,
    now_ms: u64,
) -> Response {
    let staged = match change(space, id, Op::Cancel, now_ms, &[]).await {
        Ok((staged, true)) => staged,
        Ok((_, false)) | Err(Refusal::Status(404, _)) => {
            return Response::json(200, &serde_json::json!({ "cancelled": false }))
        }
        Err(refusal) => return refusal.reply(),
    };
    // This request's compare-and-set cancelled it, so only this request
    // deletes the bytes. What a failure leaves, the next sweep deletes.
    if let Err(error) = clear_cancelled(space, ctx, app, id, &staged).await {
        ferrite_app::tracing::warn!(%error, "a cancelled attachment's bytes were left");
    }
    Response::json(200, &serde_json::json!({ "cancelled": true }))
}

/// Delete the bytes of a cancelled attachment, then its record and markers,
/// which stay until every piece is gone so that a failure is tried again.
async fn clear_cancelled(
    space: &mut Space<'_>,
    ctx: &AppContext,
    app: &str,
    id: &str,
    staged: &Staged,
) -> io::Result<()> {
    let parts: Vec<(u32, String)> = if staged.attachment.parts.is_empty() {
        // Cancelled while uploading: the pieces published so far.
        space
            .list(&done_prefix(id), staged.pieces as usize + 1)
            .await?
            .into_iter()
            .filter_map(|(key, value)| {
                let n = key.rsplit('/').next()?.parse::<u32>().ok()?;
                let attempt = String::from_utf8(value).ok().filter(|a| is_attempt(a))?;
                Some((n, attempt))
            })
            .collect()
    } else {
        staged
            .attachment
            .parts
            .iter()
            .enumerate()
            .map(|(n, attempt)| (n as u32, attempt.clone()))
            .collect()
    };
    let mut blobs = blob(ctx)?;
    for (n, attempt) in parts {
        blobs.delete(&blob_key(app, id, n, &attempt)).await?;
    }
    forget(space, id, staged.pieces).await
}

/// Delete an attachment's record and markers; its bytes are not touched.
async fn forget(space: &mut Space<'_>, id: &str, pieces: u32) -> io::Result<()> {
    for n in 0..pieces {
        space.delete(&done_key(id, n)).await?;
    }
    space.delete(&staged_key(id)).await
}

/// The most entries of a person's attachment records one sweep looks through,
/// going on from where the last one stopped, so what a draft keeps never hides
/// what lies after it.
const SWEEP_SCAN: u32 = 32;
/// Where the next sweep goes on from.
const SWEEP_CURSOR_KEY: &str = "att-sweep";
/// The most attachments one sweep clears.
const SWEEP_BATCH: usize = 8;

/// Clear what a person's attachments left behind: an upload never finished or
/// sent, once [`STAGED_TTL_MS`] has passed, loses its bytes; a cancel whose
/// delete failed is tried again; a sent attachment's record goes a day after
/// it was taken, with no resend left to need it, and the message keeps the
/// bytes. A held attachment is left alone. Runs when the person lists their
/// mail and when they upload. Nothing here fails the request: what is left is
/// tried again by the next sweep.
pub async fn sweep(space: &mut Space<'_>, ctx: &AppContext, app: &str, now_ms: u64) {
    let cursor = match space.get(SWEEP_CURSOR_KEY).await {
        Ok(bytes) => bytes.and_then(|bytes| String::from_utf8(bytes).ok()),
        Err(error) => {
            ferrite_app::tracing::warn!(%error, "attachments could not be swept");
            return;
        }
    };
    let (listed, more) = match space
        .list_after("att/", cursor.as_deref(), SWEEP_SCAN)
        .await
    {
        Ok(page) => page,
        Err(error) => {
            ferrite_app::tracing::warn!(%error, "attachments could not be swept");
            return;
        }
    };
    let mut stopped_at = None;
    let mut cleared = 0;
    for (key, value) in listed {
        if cleared >= SWEEP_BATCH {
            break;
        }
        stopped_at = Some(key.clone());
        let Some(id) = key.rsplit('/').next().filter(|id| is_id(id)) else {
            continue;
        };
        let Ok(staged) = serde_json::from_slice::<Staged>(&value) else {
            continue;
        };
        let result = match staged.state {
            State::Held => continue,
            State::Sent { .. } if staged.expired(now_ms) => forget(space, id, staged.pieces).await,
            State::Cancelled => clear_cancelled(space, ctx, app, id, &staged).await,
            State::Uploading | State::Sealed if staged.expired(now_ms) => {
                match change(space, id, Op::Cancel, now_ms, &[]).await {
                    Ok((now, _)) if now.state == State::Cancelled => {
                        clear_cancelled(space, ctx, app, id, &now).await
                    }
                    Ok(_) => continue,
                    Err(Refusal::Status(..)) => continue,
                    Err(Refusal::Storage(error)) => Err(error),
                }
            }
            _ => continue,
        };
        cleared += 1;
        if let Err(error) = result {
            ferrite_app::tracing::warn!(%error, "an attachment was not cleared");
        }
    }
    // At the end of the records, or having found none, the next one starts over.
    let saved = match stopped_at.filter(|_| more || cleared >= SWEEP_BATCH) {
        Some(key) => space.put(SWEEP_CURSOR_KEY, key.as_bytes()).await,
        None if cursor.is_some() => space.delete(SWEEP_CURSOR_KEY).await,
        None => Ok(()),
    };
    if let Err(error) = saved {
        ferrite_app::tracing::warn!(%error, "the attachments sweep did not keep its place");
    }
}

/// Apply `op` to each of `ids` (deduplicated, in order), answering their
/// records. Every one is looked at first, and nothing is written when one
/// would be refused, so a request refused for one file leaves the others free
/// for the next. Two requests competing for one file leave what the loser took
/// as it is: an attachment only ever moves forward, so nothing a delivered
/// message names can lose its bytes, and that file is attached anew. A held
/// file stays held: a draft can still take it.
async fn change_all(
    space: &mut Space<'_>,
    ids: &[String],
    op: Op<'_>,
    now_ms: u64,
) -> Result<Vec<Attachment>, Refusal> {
    let refused = |refusal| match refusal {
        Refusal::Status(404, _) => {
            Refusal::status(409, "an attachment was not uploaded, or was removed")
        }
        other => other,
    };
    for id in ids {
        let Some((staged, _)) = read_staged(space, id).await? else {
            return Err(refused(Refusal::status(404, "no such attachment")));
        };
        if let Next::Refuse(status, message) = next_state(&staged.state, op, staged.expired(now_ms))
        {
            return Err(refused(Refusal::status(status, message)));
        }
    }
    let mut out: Vec<Attachment> = Vec::with_capacity(ids.len());
    for id in ids {
        if out.iter().any(|a| &a.id == id) {
            continue;
        }
        match change(space, id, op, now_ms, &[]).await {
            Ok((staged, _)) => out.push(staged.attachment),
            Err(refusal) => return Err(refused(refusal)),
        }
    }
    Ok(out)
}

/// Take the attachments `ids` for the message of send token `token`, about
/// to be stored: each becomes `sent` and can no longer be cancelled, held or
/// taken by another message; the same token takes them again (a resend under
/// the same key). A take is never given back, not even when the message is
/// then refused: a resend under the same key takes them again. Answers their
/// records, in order; 409, having taken none unless another request competed,
/// when one cannot be taken.
pub async fn take(
    space: &mut Space<'_>,
    ids: &[String],
    now_ms: u64,
    token: &str,
) -> Result<Vec<Attachment>, Refusal> {
    change_all(space, ids, Op::Take(token), now_ms).await
}

/// Hold the attachments `ids` for a saved draft: each becomes `held`, keeps
/// its bytes with no expiry and can no longer be cancelled; sending the
/// draft takes them. Answers their records; 409, having held none, when one
/// cannot be held.
/// A hold is never undone, not even by a message then refused: another draft may
/// already carry an attachment this request held (the bytes then stay until
/// a message takes them).
pub async fn hold(
    space: &mut Space<'_>,
    ids: &[String],
    now_ms: u64,
) -> Result<Vec<Attachment>, Refusal> {
    change_all(space, ids, Op::Hold, now_ms).await
}

/// The `piece` and `count` query parameters of a read: pieces `first` to
/// `first + count`.
pub fn read_range(piece: Option<&str>, count: Option<&str>) -> Result<(u32, u32), Response> {
    let parse = |text: Option<&str>, default: u32| match text {
        None => Some(default),
        Some(text) => text.parse().ok(),
    };
    match (parse(piece, 0), parse(count, 1)) {
        (Some(first), Some(count)) if (1..=MAX_READ_PIECES).contains(&count) => Ok((first, count)),
        _ => Err(Response::error(400, "piece is a number and count 1 to 8")),
    }
}

/// The bytes of pieces `first..first + count` of `attachment`, which the
/// caller has checked the reader may see, as an inert download.
pub async fn read(
    ctx: &AppContext,
    app: &str,
    attachment: &Attachment,
    first: u32,
    count: u32,
) -> Response {
    let pieces = pieces_for(attachment.size);
    if first >= pieces {
        return Response::error(416, "the attachment has no such piece");
    }
    let last = first.saturating_add(count).min(pieces);
    let mut blobs = match blob(ctx) {
        Ok(blobs) => blobs,
        Err(error) => return Response::error(503, &error.to_string()),
    };
    let mut bytes = Vec::new();
    for n in first..last {
        // An attachment without parts was never sealed: none is served.
        let Some(attempt) = attachment.parts.get(n as usize) else {
            return Response::error(503, "a piece of the attachment is missing");
        };
        match blobs.get(&blob_key(app, &attachment.id, n, attempt)).await {
            Ok(Some(part)) => bytes.extend_from_slice(&part),
            Ok(None) if attachment.size == 0 => {}
            Ok(None) => return Response::error(503, "a piece of the attachment is missing"),
            Err(error) => return Response::error(503, &error.to_string()),
        }
    }
    // Whatever the file is, it is never run or shown as a page of this origin.
    Response::new(200, bytes)
        .add_header("content-type", "application/octet-stream")
        .add_header("content-disposition", "attachment")
        .add_header("x-content-type-options", "nosniff")
        .add_header("content-security-policy", "sandbox; default-src 'none'")
        .add_header("x-file-pieces", pieces.to_string())
}

#[cfg(test)]
mod tests {
    use super::{
        blob_key, clean_name, clean_type, done_key, is_attempt, is_id, next_state, piece_len,
        pieces_for, read_range, Attachment, Next, Op, Staged, State, PIECE_BYTES,
    };

    #[test]
    fn pieces_cover_the_file_exactly() {
        assert_eq!(pieces_for(0), 1);
        assert_eq!(pieces_for(1), 1);
        assert_eq!(pieces_for(PIECE_BYTES), 1);
        assert_eq!(pieces_for(PIECE_BYTES + 1), 2);
        assert_eq!(piece_len(PIECE_BYTES + 5, 0), PIECE_BYTES);
        assert_eq!(piece_len(PIECE_BYTES + 5, 1), 5);
        assert_eq!(piece_len(0, 0), 0);
    }

    #[test]
    fn names_and_types_are_kept_safe() {
        assert_eq!(clean_name(" photo.jpg ").as_deref(), Some("photo.jpg"));
        for bad in ["", " ", ".", "..", "a/b", "a\\b", "a\nb", &"x".repeat(256)] {
            assert_eq!(clean_name(bad), None, "{bad:?}");
        }
        assert_eq!(clean_type("Image/PNG; charset=x"), "image/png");
        assert_eq!(clean_type("text/html"), "text/html");
        assert_eq!(clean_type("nonsense"), "application/octet-stream");
        assert_eq!(clean_type("a/b c"), "application/octet-stream");
    }

    #[test]
    fn ids_and_keys_stay_in_their_place() {
        assert!(is_id(&"a1".repeat(16)));
        assert!(!is_id("../x"));
        assert!(!is_id(&"A".repeat(32)));
        assert_eq!(
            String::from_utf8(blob_key("mail", "ab", 3, "0123456789abcdef")).unwrap(),
            "mail/att/ab/00003-0123456789abcdef"
        );
        assert!(is_attempt("0123456789abcdef"));
        assert!(!is_attempt("../../x"));
        assert_eq!(done_key("ab", 12), "att/ab/done/00012");
        assert!(read_range(Some("0"), Some("9")).is_err());
        assert_eq!(read_range(None, None).ok(), Some((0, 1)));
    }

    #[test]
    fn the_lifecycle_moves_only_one_way_and_one_owner_cancels() {
        use State::{Cancelled, Held, Sealed, Sent, Uploading};
        let sent = |by: &str| Sent { by: by.into() };
        // Uploading: sealed once, or cancelled; nothing takes or holds it.
        assert_eq!(next_state(&Uploading, Op::Seal, false), Next::Write(Sealed));
        assert_eq!(
            next_state(&Uploading, Op::Cancel, false),
            Next::Write(Cancelled)
        );
        assert!(matches!(
            next_state(&Uploading, Op::Take("t"), false),
            Next::Refuse(409, _)
        ));
        assert!(matches!(
            next_state(&Uploading, Op::Hold, false),
            Next::Refuse(409, _)
        ));
        // A cancelled attachment cannot be sealed again (a late seal cannot
        // bring it back), and a second cancel finds nothing to do, so only
        // the first refunds.
        assert!(matches!(
            next_state(&Cancelled, Op::Seal, false),
            Next::Refuse(404, _)
        ));
        assert_eq!(next_state(&Cancelled, Op::Cancel, false), Next::Keep);
        assert!(matches!(
            next_state(&Cancelled, Op::Take("t"), false),
            Next::Refuse(404, _)
        ));
        // Sealed: taken by one send, held by a draft, or cancelled; not once
        // its time has passed.
        assert_eq!(
            next_state(&Sealed, Op::Take("t"), false),
            Next::Write(sent("t"))
        );
        assert!(matches!(
            next_state(&Sealed, Op::Take("t"), true),
            Next::Refuse(409, _)
        ));
        assert_eq!(next_state(&Sealed, Op::Hold, false), Next::Write(Held));
        assert_eq!(
            next_state(&Sealed, Op::Cancel, false),
            Next::Write(Cancelled)
        );
        // Sent: the same send takes it again; another send, a draft or a
        // cancel cannot touch it, and nothing gives it back.
        assert_eq!(next_state(&sent("t"), Op::Take("t"), false), Next::Keep);
        assert!(matches!(
            next_state(&sent("t"), Op::Take("u"), false),
            Next::Refuse(409, _)
        ));
        assert_eq!(next_state(&sent("t"), Op::Cancel, false), Next::Keep);
        assert!(matches!(
            next_state(&sent("t"), Op::Hold, false),
            Next::Refuse(409, _)
        ));
        // Held: a draft keeps it; sending the draft takes it; never cancelled.
        assert_eq!(
            next_state(&Held, Op::Take("t"), false),
            Next::Write(sent("t"))
        );
        assert_eq!(next_state(&Held, Op::Cancel, false), Next::Keep);
        assert_eq!(next_state(&Held, Op::Hold, false), Next::Keep);
    }

    #[test]
    fn a_held_attachment_never_expires() {
        let staged = |state| Staged {
            attachment: Attachment {
                id: "a".into(),
                name: "n".into(),
                mime: "text/plain".into(),
                size: 0,
                parts: Vec::new(),
            },
            pieces: 1,
            expires_ms: 10,
            state,
            attempts: 0,
        };
        assert!(staged(State::Sealed).expired(10));
        assert!(!staged(State::Sealed).expired(9));
        assert!(!staged(State::Held).expired(1_000));
    }
}

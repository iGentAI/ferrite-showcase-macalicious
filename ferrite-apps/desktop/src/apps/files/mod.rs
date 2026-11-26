//! Files: each person's drive, the folders and files Finder shows and the
//! open and save dialogs use.
//!
//! * The drive is one document under the person's own key space
//!   (`Storage::user`, key `drive`), kept with the revision rule of
//!   `document.rs`: the folder tree, the files' contents, the open uploads
//!   and the garbage. Every change, an upload opened, completed or given up
//!   included, is one compare-and-set of it. The rules are in [`drive`].
//! * A file's bytes are blob objects in the `files` blob, one per piece of
//!   [`drive::PIECE_BYTES`], keyed `drive/<content id>/<piece>`. A content id
//!   is 128 random bits and is never shown to the browser; the only record of
//!   which content belongs to whom is the person's own drive document. So when
//!   the person's key space moves (anonymous session to account), their files
//!   move with it, and a blob key cannot be guessed or read through another
//!   person's drive.
//!
//! Uploads go in pieces, one request each, under the gateway's 256 KiB body
//! cap:
//!
//! * Opening one reserves its size against the quota and takes one of
//!   [`drive::MAX_OPEN_UPLOADS`] places, atomically, in the drive document.
//! * A piece is written once. Before its blob is written the request claims
//!   it with a create-only key, `piece/<upload>/<n>/claim`, and after the blob
//!   is written it creates `piece/<upload>/<n>/done`. A piece whose `done`
//!   exists is never written again, so a resend after the upload completed
//!   cannot change the file. Only the request holding the claim writes the
//!   piece: another request is answered 503 (retry), and a piece whose writer
//!   ended without writing it never arrives, so the browser gives that upload
//!   up and starts again. Both keys expire a day after the upload would, so
//!   they outlive every request that could still write.
//! * Completion checks that every piece is `done` and, in one change of the
//!   drive, adds the file and closes the upload, so nothing can give up its
//!   pieces once a file names them.
//! * Cancelling, expiry and a completion the drive refuses send every piece
//!   key the upload could have written to the garbage, deleted no sooner than
//!   [`drive::UPLOAD_GRACE_MS`] later, after any piece write in flight.
//! * The garbage is the drive's own list of pending deletions
//!   ([`Drive::garbage`]): a change that frees bytes only appends a record to
//!   it, in the same compare-and-set as the change. Every request to
//!   `/api/files/`, a read or a download included, starts with one bounded
//!   sweep ([`sweep`]): it deletes at most [`SWEEP_PIECES`] pieces of records
//!   that are due, gives up expired uploads, and records its progress in the
//!   drive. A backlog of any size is cleared over the person's next requests,
//!   each a few storage calls, well inside the 8-second deadline. Deleting a
//!   piece twice is harmless, so two requests sweeping at once only repeat
//!   work. Nothing runs outside requests, so the bytes a person freed are
//!   deleted as that person goes on using the drive.
//!
//! Routes under `/api/files/`:
//!
//! * `GET /`: the drive (`Drive::view`), its `rev` and the `session`.
//! * `POST /ops` with `{"ops": [...]}` (1 to 64, see [`drive::Op`]): applied
//!   all or none; answers the drive and `created`, the ids of the entries
//!   made. With an `idempotency-key` header a resend within an hour
//!   ([`drive::REMEMBER_MS`]) answers the same ids and changes nothing.
//! * `POST /uploads` with `{parent, name, size, type, existing}`: `201`
//!   `{upload, piece_bytes, pieces}`; with an `idempotency-key` a resend
//!   within an hour answers the same upload. `existing` is `rename`,
//!   `fail`, `replace` (with `replaces`, the file the person chose to
//!   replace, which goes to the Trash) or `overwrite` (with `replaces`, the
//!   file whose bytes the upload becomes, kept under its id, name, folder
//!   and tags: an app saving a document in place). An overwrite may name
//!   `base`, the file's `version` it was made from; it is refused with 412
//!   once the file has another version.
//! * Every file entry has a `version`, raised by each save in place.
//! * `GET /uploads/<id>`: `{upload, pieces, received: [n...]}`, to resume.
//! * `PUT /uploads/<id>/<n>`: piece `n`, the raw bytes.
//! * `POST /uploads/<id>/complete`: the drive and `created: [file id]`; a
//!   resend answers the same file.
//! * `DELETE /uploads/<id>`: gives the upload up.
//! * `GET /content/<file id>?piece=<n>&count=<k>&version=<v>`: the bytes of
//!   pieces `n..n+k` (k at most 8), as an inert attachment: whatever the
//!   file is, it is never run or shown as a page of the desktop's origin.
//!   With `version`, only while the file has that version (412 otherwise),
//!   so a file read in several requests is read whole from one version.
//! * `GET /versions/<file id>`: the versions the file keeps, newest first,
//!   with their numbers, sizes and times, and the file's own `version`.
//!   A save in place keeps the bytes it replaced ([`drive::KeptVersion`]).
//! * `GET /versions/<file id>/<version>?piece=<n>&count=<k>`: the bytes of
//!   one, read like `/content`.
//! * `POST /versions/<file id>/<version>/restore` with `{base}`: that
//!   version's bytes become the file's and what they replace is kept. It
//!   only changes which content the file names, one compare-and-set of the
//!   drive, and a resend finds them current and changes nothing.
//! * `POST /versions/<file id>/keep` with `{version}`: the file's bytes now
//!   are a version the person asked for (File > Save).

pub(crate) mod drive;

use std::io;

use ferrite_app::client::BlobClusterClient;
use ferrite_app::crypto::{hex, hmac_sha256, Ed25519SigningKey};
use ferrite_app::{serde, serde_json};

use super::document::{self, Saved};
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture, Space};
use drive::{Drive, ExistingText, Garbage, Op, OpError, OpenUpload, PIECE_BYTES};

pub const MODULE: AppModule = AppModule {
    name: "files",
    title: "Files",
    handle,
};

/// The blob binding that holds file bytes.
pub const BLOB_BINDING: &str = "files";
/// The drive document's key in the person's space.
const DRIVE_KEY: &str = "drive";
/// Compare-and-set attempts before a write answers 503.
const ATTEMPTS: usize = 8;
/// How long an unfinished upload is kept.
const UPLOAD_TTL_MS: u64 = 24 * 60 * 60 * 1000;
/// How long a piece's markers outlive its upload.
const MARKER_TTL_MS: u64 = 24 * 60 * 60 * 1000;
/// Pieces one read answers at most (1.5 MiB).
const MAX_READ_PIECES: u32 = 8;
/// Operations one `POST /ops` carries at most.
const MAX_OPS: usize = 64;

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

/// Why a request failed: the drive refused it, or storage failed.
enum Failure {
    Refused(OpError),
    Storage(io::Error),
    Busy(&'static str),
}

impl From<io::Error> for Failure {
    fn from(error: io::Error) -> Self {
        Failure::Storage(error)
    }
}

impl From<OpError> for Failure {
    fn from(error: OpError) -> Self {
        Failure::Refused(error)
    }
}

impl Failure {
    fn reply(self) -> Response {
        match self {
            Failure::Refused(error) => Response::error(error.status(), error.message()),
            Failure::Storage(error) => {
                ferrite_app::tracing::warn!(%error, "files: storage failed");
                Response::error(503, "the drive could not be reached; retry")
            }
            Failure::Busy(why) => Response::error(503, why),
        }
    }
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    let method = cx.request.method;
    let path = cx.request.path;
    let parts: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
    // First, whatever the request is, the bounded sweep. Its failure only
    // leaves the work to the next request.
    if let Err(error) = sweep(&mut cx).await {
        ferrite_app::tracing::warn!(%error, "files: the sweep failed; the next request goes on");
    }
    let outcome = match (method, parts.as_slice()) {
        ("GET", []) => get_drive(&mut cx).await,
        ("POST", ["ops"]) => post_ops(&mut cx).await,
        ("POST", ["uploads"]) => start_upload(&mut cx).await,
        ("GET", ["uploads", id]) => upload_status(&mut cx, id).await,
        ("DELETE", ["uploads", id]) => cancel_upload(&mut cx, id).await,
        ("PUT", ["uploads", id, piece]) => put_piece(&mut cx, id, piece).await,
        ("POST", ["uploads", id, "complete"]) => complete_upload(&mut cx, id).await,
        ("GET", ["content", id]) => read_content(&mut cx, id).await,
        ("GET", ["versions", id]) => list_versions(&mut cx, id).await,
        ("POST", ["versions", id, "keep"]) => keep_version(&mut cx, id).await,
        ("GET", ["versions", id, version]) => read_version(&mut cx, id, version).await,
        ("POST", ["versions", id, version, "restore"]) => {
            restore_version(&mut cx, id, version).await
        }
        (
            _,
            []
            | ["ops"]
            | ["uploads"]
            | ["uploads", _]
            | ["uploads", _, _]
            | ["content", _]
            | ["versions", _]
            | ["versions", _, _]
            | ["versions", _, _, "restore"],
        ) => Ok(Response::method_not_allowed()),
        _ => Ok(Response::not_found()),
    };
    outcome.unwrap_or_else(Failure::reply)
}

/// A fresh 128-bit id from the system generator (as `session.rs` makes its
/// tokens: upstream exports no random function).
fn new_id() -> String {
    let document = Ed25519SigningKey::generate_pkcs8();
    hex(&hmac_sha256(&document, b"macalicious-desktop/files/id/v1"))[..32].to_string()
}

/// Whether `id` can be an entry's or an upload's id.
fn plausible_id(id: &str) -> bool {
    document::valid_key(id)
}

fn blob_key(content: &str, piece: u32) -> Vec<u8> {
    format!("drive/{content}/{piece:05}").into_bytes()
}

fn claim_key(upload: &str, piece: u32) -> String {
    format!("piece/{upload}/{piece:05}/claim")
}

fn done_key(upload: &str, piece: u32) -> String {
    format!("piece/{upload}/{piece:05}/done")
}

/// The piece numbers of `upload` whose `done` key is among `keys`.
fn done_pieces(upload: &str, keys: &[(String, Vec<u8>)]) -> Vec<u32> {
    let prefix = format!("piece/{upload}/");
    let mut done: Vec<u32> = keys
        .iter()
        .filter_map(|(key, _)| {
            key.strip_prefix(&prefix)?
                .strip_suffix("/done")?
                .parse()
                .ok()
        })
        .collect();
    done.sort_unstable();
    done.dedup();
    done
}

fn blob(cx: &ApiCtx<'_>) -> Result<BlobClusterClient, Failure> {
    cx.ctx.blob(BLOB_BINDING).map_err(Failure::Storage)
}

/// The stored drive (the six folders added) and its revision.
async fn load(space: &mut Space<'_>, now_ms: u64) -> io::Result<(Drive, u64)> {
    let current = document::read::<Drive>(space, DRIVE_KEY).await?;
    let mut drive = current.doc.unwrap_or_default();
    drive.ensure_special(now_ms);
    Ok((drive, current.rev))
}

/// The reply every drive route answers: the drive, its revision and the
/// session, with `created` when a change made entries, and `version` when a
/// completion made or saved a file: the version that upload left it at.
fn drive_reply(
    cx: &ApiCtx<'_>,
    drive: &Drive,
    rev: u64,
    created: Option<&[String]>,
    version: Option<u64>,
) -> Response {
    let mut body = drive.view();
    if let Some(object) = body.as_object_mut() {
        object.insert("rev".into(), rev.into());
        if let Some(created) = created {
            object.insert("created".into(), created.into());
        }
        if let Some(version) = version {
            object.insert("version".into(), version.into());
        }
    }
    document::for_session(body, cx.session)
}

async fn get_drive(cx: &mut ApiCtx<'_>) -> Result<Response, Failure> {
    let now_ms = cx.now_ms;
    let (drive, rev) = load(&mut cx.storage.user(), now_ms).await?;
    Ok(drive_reply(cx, &drive, rev, None, None))
}

/// Pieces one request's sweep deletes at most: each is one blob call, so the
/// sweep stays a small, fixed share of the 8-second deadline.
const SWEEP_PIECES: u32 = 16;
/// Compare-and-set attempts of the sweep's write; a lost race leaves the rest
/// of the work to the next request.
const SWEEP_ATTEMPTS: usize = 3;

/// The deletions a sweep makes: `(content, from, to)`, pieces `from..to` of
/// the first records in `garbage` that are due at `now_ms`, at most `budget`
/// pieces in all.
fn deletion_plan(garbage: &[Garbage], now_ms: u64, budget: u32) -> Vec<(String, u32, u32)> {
    let mut plan = Vec::new();
    let mut left = budget;
    for record in garbage {
        if left == 0 {
            break;
        }
        if record.not_before_ms > now_ms || record.next >= record.pieces {
            continue;
        }
        let to = record.pieces.min(record.next.saturating_add(left));
        left -= to - record.next;
        plan.push((record.content.clone(), record.next, to));
    }
    plan
}

/// Records the pieces deleted (`(content, next)`: every piece below `next` is
/// gone) and drops every record with nothing left to delete.
fn advance(garbage: &mut Vec<Garbage>, deleted: &[(String, u32)]) {
    for (content, next) in deleted {
        for record in garbage.iter_mut().filter(|g| &g.content == content) {
            record.next = record.next.max(*next);
        }
    }
    garbage.retain(|record| record.next < record.pieces);
}

/// The bounded sweep every request to `/api/files/` runs before it is
/// handled: deletes up to [`SWEEP_PIECES`] due pieces of the drive's garbage,
/// then, in one compare-and-set, records how far it got and gives up expired
/// uploads (whose pieces become garbage in their turn). With nothing to do it
/// costs one read of the drive.
async fn sweep(cx: &mut ApiCtx<'_>) -> io::Result<()> {
    let now_ms = cx.now_ms;
    let (drive, _) = load(&mut cx.storage.user(), now_ms).await?;
    let expired = drive.uploads.values().any(|u| u.expires_ms <= now_ms);
    let finished = drive.garbage.iter().any(|g| g.next >= g.pieces);
    let plan = deletion_plan(&drive.garbage, now_ms, SWEEP_PIECES);
    if plan.is_empty() && !expired && !finished {
        return Ok(());
    }
    let mut deleted: Vec<(String, u32)> = Vec::new();
    if !plan.is_empty() {
        let mut blobs = cx.ctx.blob(BLOB_BINDING)?;
        'plan: for (content, from, to) in &plan {
            for piece in *from..*to {
                if let Err(error) = blobs.delete(&blob_key(content, piece)).await {
                    ferrite_app::tracing::warn!(%error, "files: a piece could not be deleted yet");
                    if piece > *from {
                        deleted.push((content.clone(), piece));
                    }
                    break 'plan;
                }
            }
            deleted.push((content.clone(), *to));
        }
    }
    for _ in 0..SWEEP_ATTEMPTS {
        let mut space = cx.storage.user();
        let (stored, rev) = load(&mut space, now_ms).await?;
        let mut next = stored.clone();
        next.sweep(now_ms);
        advance(&mut next.garbage, &deleted);
        if next == stored {
            return Ok(());
        }
        match document::write(&mut space, DRIVE_KEY, Some(rev), Some(&next)).await? {
            Saved::Stored(_) => return Ok(()),
            Saved::Conflict(_) => continue,
        }
    }
    Ok(())
}

/// Applies `change` to the stored drive and writes it, again on a lost race.
/// Expired uploads are given up first. A request the drive remembers by `key`
/// changes nothing and answers what it created the first time.
///
/// A change the drive refuses is all or none: nothing of it is kept. Only
/// `refused`, applied to the drive as it was, may record what the refusal
/// itself gives up (a completion the drive refused gives its upload up); that
/// and the sweep of expired uploads are written, and the refusal answered.
/// Bytes a change frees only join the drive's garbage; requests' sweeps
/// delete them.
async fn update(
    cx: &mut ApiCtx<'_>,
    key: Option<&str>,
    mut change: impl FnMut(&mut Drive) -> Result<Vec<String>, OpError>,
    mut refused: impl FnMut(&mut Drive),
) -> Result<(Drive, u64, Vec<String>), Failure> {
    let now_ms = cx.now_ms;
    for _ in 0..ATTEMPTS {
        let mut space = cx.storage.user();
        let (drive, rev) = load(&mut space, now_ms).await?;
        if let Some(done) = key.and_then(|key| drive.done(key)) {
            let created = done.created.clone();
            return Ok((drive, rev, created));
        }
        let mut base = drive.clone();
        base.sweep(now_ms);
        // A keyed request is remembered for an hour; with the list full of
        // younger ones it waits rather than make one of them forgettable.
        if key.is_some() && !base.can_remember(now_ms) {
            return Err(Failure::Refused(OpError::Busy(
                "too many changes at once; try again in a moment".into(),
            )));
        }
        let mut next = base.clone();
        let (target, outcome) = match change(&mut next) {
            Ok(created) => {
                if let Some(key) = key {
                    next.remember(key, &created, now_ms);
                }
                (next, Ok(created))
            }
            Err(error) => {
                // `next` may be half changed: it is dropped whole.
                let mut kept = base;
                refused(&mut kept);
                (kept, Err(error))
            }
        };
        let at = if target == drive {
            rev
        } else {
            match document::write(&mut space, DRIVE_KEY, Some(rev), Some(&target)).await? {
                Saved::Stored(at) => at,
                Saved::Conflict(_) => continue,
            }
        };
        return match outcome {
            Ok(created) => Ok((target, at, created)),
            Err(error) => Err(error.into()),
        };
    }
    Err(Failure::Busy("the drive kept changing; retry"))
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct OpsBody {
    ops: Vec<Op>,
}

async fn post_ops(cx: &mut ApiCtx<'_>) -> Result<Response, Failure> {
    let body: OpsBody = match cx.request.json() {
        Ok(body) => body,
        Err(reply) => return Ok(reply),
    };
    if body.ops.is_empty() || body.ops.len() > MAX_OPS {
        return Ok(Response::error(400, &format!("send 1 to {MAX_OPS} ops")));
    }
    let key = cx.request.idempotency_key.map(|k| format!("ops:{k}"));
    let now_ms = cx.now_ms;
    let (drive, rev, created) = update(
        cx,
        key.as_deref(),
        |drive| drive.apply(&body.ops, now_ms, &mut new_id),
        |_| {},
    )
    .await?;
    Ok(drive_reply(cx, &drive, rev, Some(&created), None))
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct StartBody {
    parent: String,
    name: String,
    size: u64,
    #[serde(default, rename = "type")]
    mime: String,
    #[serde(default)]
    existing: ExistingText,
    /// With `existing: replace`, the id of the file the person chose to
    /// replace; with `existing: overwrite`, the file saved over.
    #[serde(default)]
    replaces: Option<String>,
    /// With `existing: overwrite`, the file's version the save was made from.
    #[serde(default)]
    base: Option<u64>,
}

fn upload_reply(status: u16, id: &str, upload: &OpenUpload) -> Response {
    Response::json(
        status,
        &serde_json::json!({
            "upload": id,
            "piece_bytes": PIECE_BYTES,
            "pieces": upload.pieces,
            "size": upload.size,
            "expires_ms": upload.expires_ms,
        }),
    )
}

async fn start_upload(cx: &mut ApiCtx<'_>) -> Result<Response, Failure> {
    let body: StartBody = match cx.request.json() {
        Ok(body) => body,
        Err(reply) => return Ok(reply),
    };
    let now_ms = cx.now_ms;
    let key = cx.request.idempotency_key.map(|k| format!("start:{k}"));
    if body.replaces.as_deref().is_some_and(|id| !plausible_id(id)) {
        return Ok(Response::error(400, "replaces names a file id"));
    }
    let upload = OpenUpload {
        parent: body.parent,
        name: body.name,
        mime: drive::clean_type(&body.mime),
        size: body.size,
        content: new_id(),
        pieces: drive::pieces_for(body.size),
        existing: body.existing,
        expires_ms: now_ms + UPLOAD_TTL_MS,
        replaces: body.replaces,
        base: body.base,
    };
    let id = new_id();
    let (drive, _, created) = update(
        cx,
        key.as_deref(),
        |drive| {
            drive.open_upload(id.clone(), upload.clone())?;
            Ok(vec![id.clone()])
        },
        // Asked to wait for bytes being deleted: the versions it gave up for them stay given up,
        // or the retry would find them still there and wait for ever.
        |drive| {
            let mut trial = drive.clone();
            if let Err(OpError::Busy(_)) = trial.open_upload(id.clone(), upload.clone()) {
                *drive = trial;
            }
        },
    )
    .await?;
    let opened = created.first().cloned().unwrap_or_default();
    match drive.uploads.get(&opened) {
        Some(open) => Ok(upload_reply(201, &opened, open)),
        // A resend of a start whose upload has since completed or gone.
        None => Ok(Response::error(404, "that upload is no longer open")),
    }
}

async fn upload_status(cx: &mut ApiCtx<'_>, id: &str) -> Result<Response, Failure> {
    if !plausible_id(id) {
        return Ok(Response::not_found());
    }
    let now_ms = cx.now_ms;
    let (drive, _) = load(&mut cx.storage.user(), now_ms).await?;
    let Some(upload) = drive.uploads.get(id) else {
        return Ok(Response::error(404, "no such upload"));
    };
    if upload.expires_ms <= now_ms {
        // The sweep gives it up at the next request.
        return Ok(Response::error(404, "no such upload"));
    }
    let keys = cx
        .storage
        .user()
        .list(&format!("piece/{id}/"), 2 * upload.pieces as usize + 2)
        .await?;
    Ok(Response::json(
        200,
        &serde_json::json!({
            "upload": id,
            "pieces": upload.pieces,
            "piece_bytes": PIECE_BYTES,
            "received": done_pieces(id, &keys),
        }),
    ))
}

/// The bytes piece `n` of an upload of `size` bytes holds.
fn piece_len(size: u64, piece: u32) -> u64 {
    size.saturating_sub(u64::from(piece) * PIECE_BYTES)
        .min(PIECE_BYTES)
}

async fn put_piece(cx: &mut ApiCtx<'_>, id: &str, piece: &str) -> Result<Response, Failure> {
    if !plausible_id(id) {
        return Ok(Response::not_found());
    }
    let Ok(piece) = piece.parse::<u32>() else {
        return Ok(Response::error(400, "the piece is a number"));
    };
    let now_ms = cx.now_ms;
    let (drive, _) = load(&mut cx.storage.user(), now_ms).await?;
    let Some(upload) = drive.uploads.get(id).cloned() else {
        return Ok(Response::error(404, "no such upload"));
    };
    if upload.expires_ms <= now_ms {
        return Ok(Response::error(410, "the upload expired; start it again"));
    }
    if piece >= upload.pieces {
        return Ok(Response::error(400, "the upload has no such piece"));
    }
    let expected = piece_len(upload.size, piece);
    if cx.request.body.len() as u64 != expected {
        return Ok(Response::error(
            400,
            &format!("piece {piece} is {expected} bytes"),
        ));
    }
    let markers_expire = upload.expires_ms + MARKER_TTL_MS;
    let mut space = cx.storage.user();
    // Written already: a piece is written once, so a resend changes nothing.
    if space.get(&done_key(id, piece)).await?.is_some() {
        return Ok(Response::json(200, &serde_json::json!({ "piece": piece })));
    }
    let claim = serde_json::json!({ "at": now_ms }).to_string();
    if !space
        .create_expiring(&claim_key(id, piece), claim.as_bytes(), markers_expire)
        .await?
    {
        // Another request holds the piece: only it ever writes it. If that
        // request is still under way, a retry finds the piece written; if it
        // ended without writing, the piece cannot arrive, and the browser gives
        // the upload up and starts again (`demos/desktop/desktop-files.ts`).
        return Err(Failure::Busy("this piece is being written; retry"));
    }
    blob(cx)?
        .put(&blob_key(&upload.content, piece), cx.request.body)
        .await?;
    // First `done` wins; another one already there is the same piece written.
    cx.storage
        .user()
        .create_expiring(&done_key(id, piece), b"1", markers_expire)
        .await?;
    Ok(Response::json(200, &serde_json::json!({ "piece": piece })))
}

async fn complete_upload(cx: &mut ApiCtx<'_>, id: &str) -> Result<Response, Failure> {
    if !plausible_id(id) {
        return Ok(Response::not_found());
    }
    let now_ms = cx.now_ms;
    let key = format!("upload:{id}");
    let (drive, rev) = load(&mut cx.storage.user(), now_ms).await?;
    if let Some(done) = drive.done(&key) {
        // Completed already: a resend answers the same file, at the version
        // this upload made it, whatever version it has since.
        return Ok(drive_reply(
            cx,
            &drive,
            rev,
            Some(&done.created),
            done.version,
        ));
    }
    let Some(upload) = drive.uploads.get(id).cloned() else {
        return Ok(Response::error(404, "no such upload"));
    };
    if upload.expires_ms <= now_ms {
        return Ok(Response::error(410, "the upload expired; start it again"));
    }
    let keys = cx
        .storage
        .user()
        .list(&format!("piece/{id}/"), 2 * upload.pieces as usize + 2)
        .await?;
    let arrived = done_pieces(id, &keys);
    let missing: Vec<u32> = (0..upload.pieces)
        .filter(|n| arrived.binary_search(n).is_err())
        .collect();
    if !missing.is_empty() {
        return Ok(Response::json(
            409,
            &serde_json::json!({
                "error": format!("{} of {} pieces have not arrived", missing.len(), upload.pieces),
                "missing": missing.iter().take(64).collect::<Vec<_>>(),
            }),
        ));
    }
    let file_id = new_id();
    let (drive, rev, created) = update(
        cx,
        Some(&key),
        |drive| {
            drive
                .complete_upload(id, now_ms, file_id.clone())
                .map(|made| vec![made])
        },
        // A completion the drive refuses gives the upload up: its pieces can
        // never become this file.
        |drive| {
            drive.drop_upload(id, now_ms);
        },
    )
    .await?;
    let version = drive.done(&key).and_then(|done| done.version);
    Ok(drive_reply(cx, &drive, rev, Some(&created), version))
}

async fn cancel_upload(cx: &mut ApiCtx<'_>, id: &str) -> Result<Response, Failure> {
    if !plausible_id(id) {
        return Ok(Response::not_found());
    }
    let now_ms = cx.now_ms;
    update(
        cx,
        None,
        |drive| {
            drive.drop_upload(id, now_ms);
            Ok(Vec::new())
        },
        |_| {},
    )
    .await?;
    Ok(Response::new(204, Vec::new()))
}

fn query_number(cx: &ApiCtx<'_>, name: &str, default: u32) -> Option<u32> {
    match cx.request.query_param(name) {
        None => Some(default),
        Some(text) => text.parse().ok(),
    }
}

async fn read_content(cx: &mut ApiCtx<'_>, id: &str) -> Result<Response, Failure> {
    if !plausible_id(id) {
        return Ok(Response::not_found());
    }
    let (Some(first), Some(count)) = (query_number(cx, "piece", 0), query_number(cx, "count", 1))
    else {
        return Ok(Response::error(400, "piece and count are numbers"));
    };
    if count == 0 || count > MAX_READ_PIECES {
        return Ok(Response::error(
            400,
            &format!("read 1 to {MAX_READ_PIECES} pieces at a time"),
        ));
    }
    let version = match cx.request.query_param("version") {
        None => None,
        Some(text) => match text.parse::<u64>() {
            Ok(version) => Some(version),
            Err(_) => return Ok(Response::error(400, "version is a number")),
        },
    };
    let now_ms = cx.now_ms;
    let (drive, _) = load(&mut cx.storage.user(), now_ms).await?;
    let Some(entry) = drive.find(id).filter(|e| e.kind == drive::Kind::File) else {
        return Ok(Response::error(404, "no such file"));
    };
    if version.is_some_and(|version| version != entry.version) {
        return Ok(Response::error(
            412,
            "the file was saved over while it was read; read it again",
        ));
    }
    let content = entry.content.clone().unwrap_or_default();
    read_pieces(cx, &drive, &content, first, count).await
}

/// Pieces `first..first + count` of `content`, as a reply.
async fn read_pieces(
    cx: &mut ApiCtx<'_>,
    drive: &Drive,
    content: &str,
    first: u32,
    count: u32,
) -> Result<Response, Failure> {
    let pieces = drive.contents.get(content).map_or(0, |c| c.pieces);
    if first >= pieces && !(first == 0 && pieces == 0) {
        return Ok(Response::error(416, "the file has no such piece"));
    }
    let last = first.saturating_add(count).min(pieces);
    let mut blobs = blob(cx)?;
    let mut bytes = Vec::new();
    for piece in first..last {
        match blobs.get(&blob_key(content, piece)).await? {
            Some(part) => bytes.extend_from_slice(&part),
            None => {
                return Ok(Response::error(
                    503,
                    "a piece of the file is missing from storage",
                ))
            }
        }
    }
    // The bytes are the person's own file, of any type: never served as
    // something the browser would run or show as a page of this origin. The
    // browser helper types the joined `Blob` from the drive's entry instead.
    Ok(inert(Response::new(200, bytes)).add_header("x-file-pieces", pieces.to_string()))
}

async fn list_versions(cx: &mut ApiCtx<'_>, id: &str) -> Result<Response, Failure> {
    if !plausible_id(id) {
        return Ok(Response::not_found());
    }
    let now_ms = cx.now_ms;
    let (drive, _) = load(&mut cx.storage.user(), now_ms).await?;
    Ok(match drive.versions_view(id) {
        Some(view) => Response::json(200, &view),
        None => Response::error(404, "no such file"),
    })
}

async fn read_version(cx: &mut ApiCtx<'_>, id: &str, version: &str) -> Result<Response, Failure> {
    if !plausible_id(id) {
        return Ok(Response::not_found());
    }
    let Ok(version) = version.parse::<u64>() else {
        return Ok(Response::error(400, "version is a number"));
    };
    let (Some(first), Some(count)) = (query_number(cx, "piece", 0), query_number(cx, "count", 1))
    else {
        return Ok(Response::error(400, "piece and count are numbers"));
    };
    if count == 0 || count > MAX_READ_PIECES {
        return Ok(Response::error(
            400,
            &format!("read 1 to {MAX_READ_PIECES} pieces at a time"),
        ));
    }
    let now_ms = cx.now_ms;
    let (drive, _) = load(&mut cx.storage.user(), now_ms).await?;
    let Some(content) = drive.kept_version(id, version).map(|k| k.content.clone()) else {
        return Ok(Response::error(404, "the file keeps no such version"));
    };
    read_pieces(cx, &drive, &content, first, count).await
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct RestoreBody {
    #[serde(default)]
    base: Option<u64>,
}

async fn restore_version(
    cx: &mut ApiCtx<'_>,
    id: &str,
    version: &str,
) -> Result<Response, Failure> {
    if !plausible_id(id) {
        return Ok(Response::not_found());
    }
    let Ok(version) = version.parse::<u64>() else {
        return Ok(Response::error(400, "version is a number"));
    };
    let body: RestoreBody = match cx.request.json() {
        Ok(body) => body,
        Err(reply) => return Ok(reply),
    };
    let now_ms = cx.now_ms;
    let (drive, rev, _) = update(
        cx,
        None,
        |drive| {
            drive.restore_version(id, version, body.base, now_ms)?;
            Ok(vec![id.to_string()])
        },
        |_| {},
    )
    .await?;
    let at = drive.find(id).map(|entry| entry.version);
    Ok(drive_reply(cx, &drive, rev, None, at))
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct KeepBody {
    #[serde(default)]
    version: Option<u64>,
}

async fn keep_version(cx: &mut ApiCtx<'_>, id: &str) -> Result<Response, Failure> {
    if !plausible_id(id) {
        return Ok(Response::not_found());
    }
    let body: KeepBody = match cx.request.json() {
        Ok(body) => body,
        Err(reply) => return Ok(reply),
    };
    update(
        cx,
        None,
        |drive| {
            drive.keep_version(id, body.version)?;
            Ok(Vec::new())
        },
        |_| {},
    )
    .await?;
    Ok(Response::new(204, Vec::new()))
}

/// A reply of stored bytes that the browser downloads and never runs: an
/// opaque type it may not sniff, an attachment, and a sandbox that allows
/// nothing should it be shown anyway.
fn inert(response: Response) -> Response {
    response
        .add_header("content-type", "application/octet-stream")
        .add_header("content-disposition", "attachment")
        .add_header("x-content-type-options", "nosniff")
        .add_header("content-security-policy", "sandbox; default-src 'none'")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids_are_fresh_and_storage_safe() {
        let (a, b) = (new_id(), new_id());
        assert_ne!(a, b);
        assert_eq!(a.len(), 32);
        assert!(plausible_id(&a));
        assert!(!plausible_id("../x"));
    }

    #[test]
    fn pieces_and_their_markers_are_named_in_order() {
        assert_eq!(piece_len(PIECE_BYTES * 9 + 5, 0), PIECE_BYTES);
        assert_eq!(piece_len(PIECE_BYTES * 9 + 5, 9), 5);
        assert_eq!(
            String::from_utf8(blob_key("abc", 7)).unwrap(),
            "drive/abc/00007"
        );
        let keys: Vec<(String, Vec<u8>)> = [
            "piece/u1/00009/claim",
            "piece/u1/00009/done",
            "piece/u1/00000/done",
            "piece/u1/00003/claim",
            "piece/u2/00001/done",
        ]
        .iter()
        .map(|k| (k.to_string(), Vec::new()))
        .collect();
        assert_eq!(done_pieces("u1", &keys), [0, 9]);
        assert_eq!(done_key("u1", 3), "piece/u1/00003/done");
    }

    fn garbage(content: &str, pieces: u32, next: u32, not_before_ms: u64) -> Garbage {
        Garbage {
            content: content.into(),
            pieces,
            next,
            not_before_ms,
        }
    }

    #[test]
    fn a_sweep_deletes_a_bounded_number_of_due_pieces_in_order() {
        let list = [
            garbage("later", 4, 0, 500),
            garbage("a", 10, 2, 0),
            garbage("done", 3, 3, 0),
            garbage("b", 30, 0, 100),
            garbage("c", 5, 0, 0),
        ];
        let plan = deletion_plan(&list, 100, 16);
        assert_eq!(
            plan,
            [("a".to_string(), 2, 10), ("b".to_string(), 0, 8)],
            "records not yet due and finished ones are skipped; 16 pieces in all"
        );
        assert!(deletion_plan(&list, 100, 0).is_empty());
        assert_eq!(
            deletion_plan(&list, 1_000, 2),
            [("later".to_string(), 0, 2)]
        );
    }

    #[test]
    fn a_sweep_records_its_progress_and_drops_finished_records() {
        let mut list = vec![
            garbage("a", 10, 2, 0),
            garbage("b", 30, 0, 0),
            garbage("empty", 0, 0, 0),
            garbage("c", 5, 4, 0),
        ];
        // Another sweep got further with `c` meanwhile: progress never goes back.
        advance(
            &mut list,
            &[("a".into(), 10), ("b".into(), 8), ("c".into(), 2)],
        );
        assert_eq!(list, [garbage("b", 30, 8, 0), garbage("c", 5, 4, 0)]);
        advance(&mut list, &[("gone".into(), 3), ("c".into(), 5)]);
        assert_eq!(list, [garbage("b", 30, 8, 0)]);
    }

    #[test]
    fn stored_bytes_are_served_inert() {
        let reply = inert(Response::new(200, b"<script>".to_vec()));
        let header = |name: &str| {
            reply
                .headers
                .iter()
                .find(|(n, _)| n == name)
                .map(|(_, v)| v.as_str())
        };
        assert_eq!(header("content-type"), Some("application/octet-stream"));
        assert_eq!(header("content-disposition"), Some("attachment"));
        assert_eq!(header("x-content-type-options"), Some("nosniff"));
        assert!(header("content-security-policy")
            .unwrap()
            .starts_with("sandbox"));
    }
}

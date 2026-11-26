//! Which messages still name a sent file, so that the last one to let it go
//! frees the bytes they all share.
//!
//! The count is a set in the module's shared space, one key a copy
//! (`att-copy/<attachment>/<principal>/<message>`), so writing or deleting one
//! twice changes nothing. `att-sent/<attachment>` says the file has been sent:
//! from then on the lifecycle in `../attachments.rs` lets nothing new take or
//! hold it, so no copy can appear but those already noted. A file without that
//! key is never freed here: a window may still send what its draft held, and a
//! message from before these keys has copies nobody noted.
//!
//! A copy is noted before it is stored, so the set never lacks a message that
//! names the file. Letting go is a person's own `att-release/<message>` record,
//! written before the header changes and deleted only when the work is done.
//! [`settle`] runs after the request and at every listing, so a stop anywhere
//! is finished later. It compares the record with the header, so a change that
//! lost its compare-and-set lets nothing go.
//!
//! What decides is each noted copy's header, not the note alone: a tombstone or
//! a header no longer naming the file counts for nothing. A noted copy with no
//! header may yet arrive (a send being resent), so the bytes wait for
//! [`NOTE_PATIENCE_MS`], which outlasts every resend, and the release record
//! stays to look again.

use std::io;

use ferrite_app::{serde, serde_json};

use super::attachments::{self, Attachment};
use super::{data_error, is_tombstone, model, MODULE, SEND_RECORD_MS};
use crate::module::{ApiCtx, Space, Storage};

const NOTE_PATIENCE_MS: u64 = 2 * SEND_RECORD_MS;
const RELEASE_PREFIX: &str = "att-release/";
/// The most release records one request finishes.
const RELEASE_BATCH: usize = 8;
/// The most noted copies read at once: a file with this many is not about to
/// lose its last one.
const NOTES_READ: usize = 256;

/// One message that names a file.
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Note {
    principal: String,
    message: String,
    at_ms: u64,
}

/// A person's message letting its files go.
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Release {
    message: String,
    attachments: Vec<Attachment>,
}

#[derive(PartialEq)]
enum Standing {
    Names,
    MayArrive,
    Gone,
}

fn sent_key(attachment: &str) -> String {
    format!("att-sent/{attachment}")
}

fn notes_prefix(attachment: &str) -> String {
    format!("att-copy/{attachment}/")
}

fn note_key(attachment: &str, principal: &str, message: &str) -> String {
    format!("{}{principal}/{message}", notes_prefix(attachment))
}

async fn header_bytes(
    cx: &mut ApiCtx<'_>,
    principal: &str,
    message: &str,
) -> io::Result<Option<Vec<u8>>> {
    Storage::new(cx.storage.store(), MODULE.name, principal)
        .user()
        .get(&model::header_key(message))
        .await
}

async fn standing(
    cx: &mut ApiCtx<'_>,
    principal: &str,
    message: &str,
    attachment: &str,
    noted_ms: Option<u64>,
) -> io::Result<Standing> {
    let Some(bytes) = header_bytes(cx, principal, message).await? else {
        let fresh = noted_ms.is_some_and(|at| cx.now_ms < at.saturating_add(NOTE_PATIENCE_MS));
        return Ok(if fresh {
            Standing::MayArrive
        } else {
            Standing::Gone
        });
    };
    if is_tombstone(&bytes) {
        return Ok(Standing::Gone);
    }
    Ok(match serde_json::from_slice::<model::Header>(&bytes) {
        Ok(header) if !header.attachments.iter().any(|a| a.id == attachment) => Standing::Gone,
        _ => Standing::Names,
    })
}

async fn put_note(
    cx: &mut ApiCtx<'_>,
    attachment: &str,
    principal: &str,
    message: &str,
) -> io::Result<()> {
    let bytes = serde_json::to_vec(&Note {
        principal: principal.to_string(),
        message: message.to_string(),
        at_ms: cx.now_ms,
    })
    .map_err(data_error)?;
    cx.storage
        .shared()
        .put(&note_key(attachment, principal, message), &bytes)
        .await
}

/// Note every copy a send will store, each `(principal, message)`, and that the
/// files are sent. An erased copy stays erased, so a resend notes it no more.
pub(super) async fn note_send(
    cx: &mut ApiCtx<'_>,
    files: &[Attachment],
    copies: &[(String, String)],
) -> io::Result<()> {
    let mut waiting = Vec::new();
    for (principal, message) in copies {
        let erased = header_bytes(cx, principal, message)
            .await?
            .is_some_and(|bytes| is_tombstone(&bytes));
        if !erased {
            waiting.push((principal, message));
        }
    }
    if waiting.is_empty() {
        return Ok(());
    }
    for file in files {
        for (principal, message) in &waiting {
            put_note(cx, &file.id, principal, message).await?;
        }
        cx.storage
            .shared()
            .put(&sent_key(&file.id), b"true")
            .await?;
    }
    Ok(())
}

/// Note one message of the person's about to name `ids`.
pub(super) async fn note_copy(
    cx: &mut ApiCtx<'_>,
    ids: &[String],
    message: &str,
) -> io::Result<()> {
    let principal = cx.session.principal.clone();
    for id in ids {
        put_note(cx, id, &principal, message).await?;
    }
    Ok(())
}

/// Take back what [`note_copy`] noted for a message that will not be stored,
/// unless another request of the same key stored it.
pub(super) async fn unnote_copy(
    cx: &mut ApiCtx<'_>,
    ids: &[String],
    message: &str,
) -> io::Result<()> {
    let principal = cx.session.principal.clone();
    for id in ids {
        if standing(cx, &principal, message, id, None).await? == Standing::Names {
            continue;
        }
        cx.storage
            .shared()
            .delete(&note_key(id, &principal, message))
            .await?;
    }
    Ok(())
}

/// Record that `header` is about to stop naming its files.
pub(super) async fn let_go(space: &mut Space<'_>, header: &model::Header) -> io::Result<()> {
    if header.attachments.is_empty() {
        return Ok(());
    }
    let bytes = serde_json::to_vec(&Release {
        message: header.id.clone(),
        attachments: header.attachments.clone(),
    })
    .map_err(data_error)?;
    space
        .put(&format!("{RELEASE_PREFIX}{}", header.id), &bytes)
        .await
}

/// Finish what the person's messages let go. Nothing here fails the request:
/// what is left is tried again by the next listing.
pub(super) async fn settle(cx: &mut ApiCtx<'_>) {
    if let Err(error) = settle_some(cx).await {
        ferrite_app::tracing::warn!(%error, "the bytes of an erased message's files were left");
    }
}

async fn settle_some(cx: &mut ApiCtx<'_>) -> io::Result<()> {
    let principal = cx.session.principal.clone();
    let releases = cx
        .storage
        .user()
        .list(RELEASE_PREFIX, RELEASE_BATCH)
        .await?;
    for (key, bytes) in releases {
        let release: Release = serde_json::from_slice(&bytes).map_err(data_error)?;
        let mut finished = true;
        for file in &release.attachments {
            if standing(cx, &principal, &release.message, &file.id, None).await? == Standing::Names
            {
                continue;
            }
            cx.storage
                .shared()
                .delete(&note_key(&file.id, &principal, &release.message))
                .await?;
            finished &= free_if_last(cx, file).await?;
        }
        if finished {
            cx.storage.user().delete(&key).await?;
        }
    }
    Ok(())
}

/// Free `file`'s bytes if it was sent and no message names it. `false` when a
/// noted copy may yet arrive, so the question stays open.
async fn free_if_last(cx: &mut ApiCtx<'_>, file: &Attachment) -> io::Result<bool> {
    if cx
        .storage
        .shared()
        .get(&sent_key(&file.id))
        .await?
        .is_none()
    {
        return Ok(true);
    }
    let notes = cx
        .storage
        .shared()
        .list(&notes_prefix(&file.id), NOTES_READ)
        .await?;
    if notes.len() >= NOTES_READ {
        return Ok(true);
    }
    let mut open = false;
    for (_, bytes) in &notes {
        let Ok(note) = serde_json::from_slice::<Note>(bytes) else {
            return Ok(true);
        };
        match standing(
            cx,
            &note.principal,
            &note.message,
            &file.id,
            Some(note.at_ms),
        )
        .await?
        {
            Standing::Names => return Ok(true),
            Standing::MayArrive => open = true,
            Standing::Gone => {}
        }
    }
    if open {
        return Ok(false);
    }
    let mut blobs = cx.ctx.blob(attachments::BLOB_BINDING)?;
    for (n, attempt) in file.parts.iter().enumerate() {
        blobs
            .delete(&attachments::blob_key(
                MODULE.name,
                &file.id,
                n as u32,
                attempt,
            ))
            .await?;
    }
    for (key, _) in notes {
        cx.storage.shared().delete(&key).await?;
    }
    cx.storage.shared().delete(&sent_key(&file.id)).await?;
    Ok(true)
}

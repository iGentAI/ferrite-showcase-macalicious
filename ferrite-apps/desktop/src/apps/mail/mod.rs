//! Mail's server half: mail between the accounts of this desktop.
//!
//! Every person has a mailbox of their own (Inbox, Drafts, Sent, Junk, Trash
//! and Archive), and the mailboxes they make. A message sent to `martin` (or `martin@macalicious`, or a
//! contact card naming the account) is delivered into Martin's own space at
//! once, a copy goes to the sender's Sent, Martin gets a notification and his
//! Mail change count moves on his personal stream (the sender's moves with
//! every write, as the router counts it). There is no internet mail: an outside address is
//! refused by name, since this desktop has no mail provider (one would need a
//! provider account and key, which the owner has not supplied).
//!
//! Routes under `/api/mail/` (a signed-in account, Guest User included, is
//! needed for everything but `/me`):
//!
//! * `GET /me`: `{"name", "full_name", "address"}`, or `{"name": null}`.
//! * `GET /messages?after=<id>`: `{"messages": [Header], "mailboxes":
//!   [OwnMailbox], "address", "next"}`, up to [`model::LIST_LIMIT`] headers of
//!   every mailbox, newest first, after the message `after` (from the start
//!   without it); `next` names the cursor for the following page, `null` after
//!   the last. A page reads the whole history this way, so search covers every
//!   message. A message in a mailbox the person no longer has reads as in the
//!   Inbox.
//! * `POST /mailboxes` with `{"name"}`: makes a mailbox of the person's own,
//!   or answers the one already of that name, so a resend makes nothing twice:
//!   `{"mailbox"}`. `PATCH /mailboxes/<id>` with `{"name"}` renames it (`409`
//!   when another has that name). `DELETE /mailboxes/<id>?after=<id>` moves
//!   its messages to the Trash, a bounded run of the history at a time:
//!   `{"moved", "more", "next"}`, and the page asks again with `after=next`
//!   while `more` is true; the last answer removes the mailbox.
//! * `GET /messages/<id>`: `{"message": Header, "text", "html"}`.
//! * `GET /search?q=<words>&after=<id>`: `{"ids", "next"}`: of a bounded run of the history, the
//!   messages longer than a header holds whose whole text holds the words.
//! * `PATCH /messages/<id>` with [`model::Patch`]: read or unread, flag,
//!   mute, move to another mailbox, take its files off. `{"message"}`.
//! * `POST /import` with [`ImportRequest`]: one message of a file File > Import
//!   Mailboxes read, kept in a mailbox the person made, under an id made from
//!   the key the request names, so a request sent again makes nothing twice.
//!   Not delivered, so nobody is told and no rule runs. `{"message"}`.
//! * `DELETE /messages/<id>`: erases a message that is in the Trash, or a
//!   draft. A message
//!   is erased only by a compare-and-set that turns its header into a
//!   tombstone at the version found in the Trash, so a message moved out of
//!   the Trash meanwhile is never erased; the tombstone stays a day, so a
//!   resend of a send never delivers an erased copy again.
//! * `POST /send` with `{"to": [..], "cc": [..], "subject", "text", "html"?,
//!   "attachments"?: [id], "draft"?: id, "sent_box"?: id}` (a Guest User sends none: 403): delivers to every recipient and
//!   answers `201 {"message": <the Sent copy>, "delivered": [names]}`; `422
//!   {"unknown": [..]}` (nothing sent) when a recipient is not an account of
//!   this desktop, `422 {"outside": [..]}` for internet addresses, `429`
//!   past [`SENDS_PER_DAY`]. With the browser's `idempotency-key` header, a
//!   resend within a day delivers nothing twice, to the accounts the first
//!   attempt resolved, and answers the same Sent copy. A field the body does
//!   not name is refused. A delivered message's draft goes, named by `draft` or
//!   saved with the very same text by a window whose send is under way
//!   ([`SENT_DRAFT_MS`]).
//! * `POST /drafts` with `{"id"?, "to", "cc", "subject", "text", "html"?,
//!   "attachments"?: [id]}`: saves a draft (replacing the draft `id`), which
//!   holds its attachments until it is sent. `{"message"}`. With the
//!   browser's `idempotency-key` header, a resend of the same body within a
//!   day stores nothing twice and answers the same draft (`draft-key/<hash>`
//!   pins its id and time); the same key with another body answers `422`,
//!   and a draft sent or deleted since answers `409`. A draft of a message
//!   delivered within [`SENT_DRAFT_MS`] is not kept: `{"message": null}`.
//! * `POST /attachments`, `PUT /attachments/<id>/<n>`, `POST
//!   /attachments/<id>/complete`, `DELETE /attachments/<id>`: a file uploaded
//!   in pieces before its message is sent (`../attachments.rs`). A Guest User
//!   uploads none: 403.
//! * `GET /messages/<id>/attachments/<attachment>?piece=<n>&count=<k>`: the
//!   bytes of an attachment of a message in the reader's own mailbox.
//!
//! Storage, in each person's own space (`apps/mail/users/<principal>/`):
//! `m/<id>` the [`model::Header`], `b/<id>` the [`model::Body`] (an id sorts
//! newest first), `mute/<hash of a subject>` the people of a conversation the
//! person muted, which delivery reads to stay quiet, `att/...` the attachments the person is uploading, and
//! `sent/<hash of idempotency key>` a day's record of what
//! a send did, `draft-key/<hash of idempotency key>` a day's record of the
//! draft a save made, `draft-of/<hash of a message>` and `sent-message/<hash of
//! a message>` the draft of that text saved and that it was delivered, each
//! kept [`SENT_DRAFT_MS`].
//! What frees a sent file's shared bytes, across accounts, is in `copies.rs`.
//! Delivery writes a recipient's copy into the recipient's own space: the
//! body first, then the header, created only if absent, so a repeated
//! delivery changes nothing and a half-made one is never listed.

mod copies;
mod model;

use std::collections::BTreeSet;

use ferrite_app::{serde, serde_json};

use super::allowance;
use super::attachments::{self, NewAttachment};
use super::notification_center::{self, Notification};
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture, Space, Storage};
use crate::session::Account;
use model::{Address, Body, Header, Mailbox, OwnMailbox, Patch, Recipient};

pub const MODULE: AppModule = AppModule {
    name: "mail",
    title: "Mail",
    handle,
};

/// How long a send's record is kept, so that a resend delivers nothing twice.
const SEND_RECORD_MS: u64 = 24 * 60 * 60 * 1000;
const CAS_ATTEMPTS: usize = 8;
/// The most messages one person may send in a day (UTC). Each recipient
/// keeps a copy in their own space, so this bounds what one account can make
/// the others keep: at most this many messages a day, of at most
/// [`model::BODY_BUDGET`] bytes each.
pub const SENDS_PER_DAY: u32 = 200;
/// The longest notification body, in characters.
const PREVIEW_CHARS: usize = 200;

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

fn storage_error(error: std::io::Error) -> Response {
    Response::error(503, &error.to_string())
}

fn data_error(e: serde_json::Error) -> std::io::Error {
    std::io::Error::new(std::io::ErrorKind::InvalidData, e.to_string())
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    let path = cx.request.path.trim_end_matches('/').to_string();
    let segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
    let method = cx.request.method;
    if segments == ["me"] {
        return match method {
            "GET" => me(&cx),
            _ => Response::method_not_allowed(),
        };
    }
    let Some(account) = cx.session.account.clone() else {
        // Before anyone signs in there are no mailboxes: an empty list, not
        // an error, so the desktop reads every app the same way.
        if method == "GET" && segments == ["messages"] {
            return Response::json(
                200,
                &serde_json::json!({ "messages": [], "address": null, "next": null }),
            );
        }
        return Response::error(401, "sign in to use Mail");
    };
    match (method, segments.as_slice()) {
        ("GET", ["messages"]) => list(&mut cx, &account).await,
        ("GET", ["messages", id]) => read(&mut cx, id).await,
        ("GET", ["search"]) => search_whole_text(&mut cx).await,
        ("PATCH", ["messages", id]) => patch(&mut cx, id).await,
        ("POST", ["messages", id, "copy"]) => copy(&mut cx, id).await,
        ("POST", ["import"]) => import(&mut cx).await,
        ("DELETE", ["messages", id]) => {
            let reply = erase(&mut cx, id).await;
            copies::settle(&mut cx).await;
            reply
        }
        ("POST", ["mailboxes"]) => create_mailbox(&mut cx).await,
        ("PATCH", ["mailboxes", id]) => rename_mailbox(&mut cx, id).await,
        ("DELETE", ["mailboxes", id]) => delete_mailbox(&mut cx, id).await,
        ("POST", ["send"]) => {
            let reply = send(&mut cx, &account).await;
            copies::settle(&mut cx).await;
            reply
        }
        ("POST", ["drafts"]) => {
            let reply = save_draft(&mut cx, &account).await;
            copies::settle(&mut cx).await;
            reply
        }
        ("POST" | "PUT" | "DELETE", ["attachments", ..]) if account.guest => {
            Response::error(403, "a Guest User cannot send attachments")
        }
        ("POST", ["attachments"]) => match cx.request.json::<NewAttachment>() {
            Ok(new) => {
                let (ctx, now_ms) = (cx.ctx, cx.now_ms);
                attachments::sweep(&mut cx.storage.user(), ctx, MODULE.name, now_ms).await;
                attachments::stage(&mut cx.storage.user(), &new, now_ms).await
            }
            Err(response) => response,
        },
        ("PUT", ["attachments", id, n]) => {
            let Ok(n) = n.parse::<u32>() else {
                return Response::error(400, "the piece is a number");
            };
            let (ctx, body, now_ms) = (cx.ctx, cx.request.body, cx.now_ms);
            attachments::put_piece(
                &mut cx.storage.user(),
                ctx,
                MODULE.name,
                id,
                n,
                body,
                now_ms,
            )
            .await
        }
        ("POST", ["attachments", id, "complete"]) => {
            let now_ms = cx.now_ms;
            attachments::seal(&mut cx.storage.user(), id, now_ms).await
        }
        ("DELETE", ["attachments", id]) => {
            let (ctx, now_ms) = (cx.ctx, cx.now_ms);
            attachments::cancel(&mut cx.storage.user(), ctx, MODULE.name, id, now_ms).await
        }
        ("GET", ["messages", id, "attachments", attachment]) => {
            read_attachment(&mut cx, id, attachment).await
        }
        (
            _,
            ["messages"]
            | ["messages", _]
            | ["send"]
            | ["import"]
            | ["drafts"]
            | ["mailboxes"]
            | ["mailboxes", _],
        ) => Response::method_not_allowed(),
        _ => Response::not_found(),
    }
}

fn me(cx: &ApiCtx<'_>) -> Response {
    match &cx.session.account {
        Some(account) => Response::json(
            200,
            &serde_json::json!({
                "name": account.name,
                "full_name": account.full_name,
                "guest": account.guest,
                "address": model::address_of(&account.name),
            }),
        ),
        None => Response::json(200, &serde_json::json!({ "name": null })),
    }
}

fn address(account: &Account) -> Address {
    Address {
        name: account.name.clone(),
        full_name: account.full_name.clone(),
    }
}

async fn list(cx: &mut ApiCtx<'_>, account: &Account) -> Response {
    let after = cx.request.query_param("after");
    if after.is_some_and(|id| !model::is_message_id(id)) {
        return Response::error(400, "after names a message");
    }
    let after = after.map(str::to_string);
    let mut page = match headers_page(cx, after.as_deref(), model::LIST_LIMIT).await {
        Ok(page) => page,
        Err(error) => return storage_error(error),
    };
    finish_erasures(cx, &page.unfinished).await;
    if after.is_none() {
        copies::settle(cx).await;
        let (ctx, now_ms) = (cx.ctx, cx.now_ms);
        attachments::sweep(&mut cx.storage.user(), ctx, MODULE.name, now_ms).await;
    }
    let own = match own_mailboxes(&mut cx.storage.user()).await {
        Ok((own, _)) => own,
        Err(error) => return storage_error(error),
    };
    // A move that passed a mailbox's removal leaves its message reachable.
    for header in &mut page.headers {
        model::settle_mailbox(header, &own);
    }
    Response::json(
        200,
        &serde_json::json!({
            "messages": page.headers,
            "mailboxes": own,
            "address": model::address_of(&account.name),
            "next": page.next,
        }),
    )
}

/// Finish the erasures a listing found stopped part way (a text whose delete
/// failed). Nothing here fails the request: what is left is tried again by
/// the next listing that reads it.
async fn finish_erasures(cx: &mut ApiCtx<'_>, ids: &[String]) {
    let now_ms = cx.now_ms;
    let mut space = cx.storage.user();
    for id in ids {
        if let Err(error) = finish_erase(&mut space, id, now_ms).await {
            ferrite_app::tracing::warn!(%error, "an erased message's text is still stored");
        }
    }
}

/// One page of a person's headers.
struct HeadersPage {
    headers: Vec<Header>,
    /// The cursor for the next page, `None` after the last.
    next: Option<String>,
    /// How many entries were read, tombstones and unreadable ones included.
    scanned: usize,
    /// Messages whose erasure stopped before their text was deleted
    /// ([`TOMBSTONE_UNFINISHED`]).
    unfinished: Vec<String>,
}

/// How many entries one store read of a listing takes.
const SCAN_CHUNK: usize = 100;

/// Up to `limit` of the person's headers after message `after` (from the
/// newest without it), and at most about [`model::PAGE_BYTES`] of them: a
/// page of long previews stops early, with the cursor where it stopped, so
/// no answer passes the reply limit whatever the mail holds. A header that
/// cannot be read (or a tombstone) is skipped, never failing the page, but
/// counts as scanned.
async fn headers_page(
    cx: &mut ApiCtx<'_>,
    after: Option<&str>,
    limit: usize,
) -> std::io::Result<HeadersPage> {
    let prefix = format!("apps/{}/users/{}/m/", MODULE.name, cx.session.principal);
    let mut start = after.map(|id| format!("{prefix}{id}").into_bytes());
    let mut last = None;
    let mut scanned = 0;
    let mut bytes = 0;
    let mut headers = Vec::new();
    let mut unfinished = Vec::new();
    let mut more = true;
    while more && scanned < limit && bytes < model::PAGE_BYTES {
        let chunk = SCAN_CHUNK.min(limit - scanned);
        let (entries, rest) = cx
            .storage
            .store()
            .scan_prefix(
                prefix.as_bytes(),
                start.as_deref(),
                u32::try_from(chunk).unwrap_or(u32::MAX),
            )
            .await?;
        more = rest;
        if entries.is_empty() {
            more = false;
        }
        for (key, value, _) in entries {
            scanned += 1;
            bytes += value.len();
            last = String::from_utf8(key[prefix.len().min(key.len())..].to_vec()).ok();
            if value == TOMBSTONE_UNFINISHED {
                unfinished.extend(last.clone().filter(|id| model::is_message_id(id)));
            } else if let Ok(header) = serde_json::from_slice::<Header>(&value) {
                headers.push(header);
            }
            start = Some(key);
            if bytes >= model::PAGE_BYTES {
                // The rest of this chunk is read again by the next page.
                more = true;
                break;
            }
        }
    }
    Ok(HeadersPage {
        headers,
        next: if more { last } else { None },
        scanned,
        unfinished,
    })
}

/// What an erased message's header becomes before its text is deleted: no
/// longer a message to anyone, so a move that raced the erase fails its
/// compare-and-set and finds nothing. While a header reads this, the text
/// may still be stored: a listing that finds it finishes the erasure
/// ([`finish_erase`]), so a failed delete is retried, never forgotten.
const TOMBSTONE_UNFINISHED: &[u8] = br#"{"erased":true,"text":true}"#;
/// What the header of an erased message whose text is gone reads, for a day.
const TOMBSTONE: &[u8] = br#"{"erased":true}"#;

fn is_tombstone(bytes: &[u8]) -> bool {
    bytes == TOMBSTONE || bytes == TOMBSTONE_UNFINISHED
}

async fn header_of(space: &mut Space<'_>, id: &str) -> Result<Option<(Header, u64)>, Response> {
    if !model::is_message_id(id) {
        return Ok(None);
    }
    match space.get_versioned(&model::header_key(id)).await {
        Ok(Some((bytes, _))) if is_tombstone(&bytes) => Ok(None),
        Ok(Some((bytes, version))) => serde_json::from_slice(&bytes)
            .map(|header| Some((header, version)))
            .map_err(|_| Response::error(409, "the stored message cannot be read")),
        Ok(None) => Ok(None),
        Err(error) => Err(storage_error(error)),
    }
}

async fn read(cx: &mut ApiCtx<'_>, id: &str) -> Response {
    let mut space = cx.storage.user();
    let mut header = match header_of(&mut space, id).await {
        Ok(Some((header, _))) => header,
        Ok(None) => return Response::error(404, "no such message"),
        Err(response) => return response,
    };
    if let Err(response) = settle(&mut space, &mut header).await {
        return response;
    }
    let body: Body = match space.get_json(&model::body_key(id)).await {
        Ok(Some(body)) => body,
        Ok(None) => return Response::error(409, "the message's text cannot be found"),
        Err(error) => return storage_error(error),
    };
    Response::json(
        200,
        &serde_json::json!({ "message": header, "text": body.text, "html": body.html }),
    )
}

async fn patch(cx: &mut ApiCtx<'_>, id: &str) -> Response {
    let change: Patch = match cx.request.json() {
        Ok(change) => change,
        Err(response) => return response,
    };
    let me = cx.session.account.clone();
    let mut space = cx.storage.user();
    if let Some(Mailbox::Own(mailbox)) = &change.mailbox {
        match own_mailboxes(&mut space).await {
            Ok((own, _)) if own.iter().any(|each| each.id == *mailbox) => {}
            Ok(_) => return Response::error(404, "no such mailbox"),
            Err(error) => return storage_error(error),
        }
    }
    if change.remove_attachments {
        match header_of(&mut space, id).await {
            Ok(Some((header, _))) => {
                if let Err(error) = copies::let_go(&mut space, &header).await {
                    return storage_error(error);
                }
            }
            Ok(None) => {}
            Err(response) => return response,
        }
    }
    let reply = match changed(&mut space, id, &change).await {
        Ok(Some(mut header)) => match settle(&mut space, &mut header).await {
            Ok(()) => {
                if let (Some(muted), Some(account)) = (change.muted, &me) {
                    note_muted_conversation(&mut space, &header, muted, &account.name).await;
                }
                Response::json(200, &serde_json::json!({ "message": header }))
            }
            Err(response) => response,
        },
        Ok(None) => Response::error(404, "no such message"),
        Err(response) => response,
    };
    if change.remove_attachments {
        copies::settle(cx).await;
    }
    reply
}

/// Where a person's muted conversation of `subject` names its people.
fn mute_key(subject: &str) -> String {
    format!("mute/{}", hex_sha256(subject.as_bytes()))
}

/// A message was muted or unmuted: the page does that to a whole conversation, so its subject and
/// people are kept for delivery, which knows nothing of threads. A failure costs a notification at
/// most, so it does not fail the change the person made.
async fn note_muted_conversation(space: &mut Space<'_>, header: &Header, muted: bool, me: &str) {
    let Some(subject) = model::thread_subject(&header.subject) else {
        return;
    };
    let key = mute_key(&subject);
    let written = if muted {
        let mut people: BTreeSet<String> = space
            .get_json::<BTreeSet<String>>(&key)
            .await
            .ok()
            .flatten()
            .unwrap_or_default();
        people.extend(model::people_on(header, me));
        match serde_json::to_vec(&people) {
            Ok(bytes) => space.put(&key, &bytes).await,
            Err(error) => Err(data_error(error)),
        }
    } else {
        space.delete(&key).await
    };
    if let Err(error) = written {
        ferrite_app::tracing::warn!(%error, "a muted conversation was not noted");
    }
}

/// Whether a person muted the conversation a new message of theirs belongs to: its subject, and
/// someone on it who was on the conversation.
async fn in_muted_conversation(space: &mut Space<'_>, header: &Header, me: &str) -> bool {
    let Some(subject) = model::thread_subject(&header.subject) else {
        return false;
    };
    let people = model::people_on(header, me);
    match space
        .get_json::<BTreeSet<String>>(&mute_key(&subject))
        .await
    {
        Ok(Some(muted)) => people.iter().any(|person| muted.contains(person)),
        _ => false,
    }
}

/// `GET /search?q=<words>&after=<id>`: of a bounded run of the history, the messages whose header
/// holds only the start of their text and whose whole text holds the words. `{"ids", "next"}`, and
/// the page asks again with `after=next` while `next` names a message.
async fn search_whole_text(cx: &mut ApiCtx<'_>) -> Response {
    let words = cx
        .request
        .query_param("q")
        .and_then(super::spotlight::decode)
        .map(|words| words.trim().to_lowercase())
        .filter(|words| !words.is_empty());
    let Some(words) = words else {
        return Response::error(400, "q names what to search for");
    };
    let after = cx.request.query_param("after").map(str::to_string);
    if after.as_deref().is_some_and(|id| !model::is_message_id(id)) {
        return Response::error(400, "after names a message");
    }
    let page = match headers_page(cx, after.as_deref(), model::LIST_LIMIT).await {
        Ok(page) => page,
        Err(error) => return storage_error(error),
    };
    let mut space = cx.storage.user();
    let mut ids = Vec::new();
    for header in &page.headers {
        if header.text.chars().count() < model::TEXT_INDEX_CHARS {
            continue;
        }
        match space.get_json::<Body>(&model::body_key(&header.id)).await {
            Ok(Some(body)) if body.text.to_lowercase().contains(&words) => {
                ids.push(header.id.clone());
            }
            Ok(_) => {}
            Err(error) => return storage_error(error),
        }
    }
    Response::json(200, &serde_json::json!({ "ids": ids, "next": page.next }))
}

/// `POST /messages/<id>/copy`: what Copy to asks for.
#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct CopyRequest {
    mailbox: Mailbox,
    /// Chosen by the page for this copy: asked again with the same key, nothing is made twice.
    key: String,
}

/// A copy of message `id` in another mailbox: the same text and files under an id of its own,
/// made from the key the request names, so a request sent again finds the copy it made.
async fn copy(cx: &mut ApiCtx<'_>, id: &str) -> Response {
    let request: CopyRequest = match cx.request.json() {
        Ok(request) => request,
        Err(response) => return response,
    };
    if request.key.is_empty() || request.key.len() > 64 {
        return Response::error(400, "a copy's key is 1 to 64 bytes");
    }
    if request.mailbox == Mailbox::Drafts {
        return Response::error(409, "only a saved draft is in Drafts");
    }
    let Some((sent_at, _)) = id.split_once('-').filter(|_| model::is_message_id(id)) else {
        return Response::error(404, "no such message");
    };
    let digest = hex_sha256(format!("{id}/{}", request.key).as_bytes());
    let copy_id = format!("{sent_at}-{}", &digest[..16]);
    let mut space = cx.storage.user();
    // Asked again: the copy as it is now, whatever has happened to it or to the first message since.
    match header_of(&mut space, &copy_id).await {
        Ok(Some((mut made, _))) => {
            return match settle(&mut space, &mut made).await {
                Ok(()) => Response::json(200, &serde_json::json!({ "message": made })),
                Err(response) => response,
            };
        }
        Ok(None) => {}
        Err(response) => return response,
    }
    if let Mailbox::Own(mailbox) = &request.mailbox {
        match own_mailboxes(&mut space).await {
            Ok((own, _)) if own.iter().any(|each| each.id == *mailbox) => {}
            Ok(_) => return Response::error(404, "no such mailbox"),
            Err(error) => return storage_error(error),
        }
    }
    let mut header = match header_of(&mut space, id).await {
        Ok(Some((header, _))) => header,
        Ok(None) => return Response::error(404, "no such message"),
        Err(response) => return response,
    };
    if header.mailbox == Mailbox::Drafts {
        return Response::error(409, "a draft can only be deleted");
    }
    let body: Body = match space.get_json(&model::body_key(id)).await {
        Ok(Some(body)) => body,
        Ok(None) => return Response::error(409, "the message's text cannot be found"),
        Err(error) => return storage_error(error),
    };
    header.id = copy_id.clone();
    header.mailbox = request.mailbox;
    header.rules_pending = false;
    let files: Vec<String> = header.attachments.iter().map(|a| a.id.clone()).collect();
    if !files.is_empty() {
        if let Err(error) = copies::note_copy(cx, &files, &copy_id).await {
            return storage_error(error);
        }
        // Noted first and the first message read again after: if it is still here, its erasure
        // has yet to count the copies, so it finds this one.
        let still = match header_of(&mut cx.storage.user(), id).await {
            Ok(found) => found.is_some_and(|(first, _)| {
                files
                    .iter()
                    .all(|file| first.attachments.iter().any(|a| a.id == *file))
            }),
            Err(response) => return response,
        };
        if !still {
            if let Err(error) = copies::unnote_copy(cx, &files, &copy_id).await {
                return storage_error(error);
            }
            return Response::error(404, "no such message");
        }
    }
    let mut space = cx.storage.user();
    if let Err(error) = store_copy(&mut space, &header, &body).await {
        return storage_error(error);
    }
    // Two requests at once made one copy, and both answer with it; one erased meanwhile is gone.
    match header_of(&mut space, &copy_id).await {
        Ok(Some((mut made, _))) => match settle(&mut space, &mut made).await {
            Ok(()) => Response::json(200, &serde_json::json!({ "message": made })),
            Err(response) => response,
        },
        Ok(None) => Response::error(404, "no such message"),
        Err(response) => response,
    }
}

/// `POST /import`: one message of an mbox file, as the file says it was.
#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct ImportRequest {
    /// A mailbox the person made.
    mailbox: Mailbox,
    /// Chosen by the page for this message: asked again with the same key, nothing is made twice.
    key: String,
    from: String,
    #[serde(default)]
    to: Vec<String>,
    #[serde(default)]
    cc: Vec<String>,
    subject: String,
    at_ms: u64,
    text: String,
}

/// An address as a file wrote it, kept as written: nothing is delivered to it.
fn written_address(raw: &str) -> Result<Address, Response> {
    let raw = raw.trim();
    if raw.chars().count() > 320 || raw.chars().any(char::is_control) {
        return Err(Response::error(400, "an address is at most 320 characters"));
    }
    Ok(Address {
        name: raw.to_string(),
        full_name: String::new(),
    })
}

async fn import(cx: &mut ApiCtx<'_>) -> Response {
    let request: ImportRequest = match cx.request.json() {
        Ok(request) => request,
        Err(response) => return response,
    };
    if request.key.is_empty() || request.key.len() > 64 {
        return Response::error(400, "an import's key is 1 to 64 bytes");
    }
    if !matches!(request.mailbox, Mailbox::Own(_)) {
        return Response::error(409, "messages are imported into a mailbox of your own");
    }
    let subject = match model::clean_subject(&request.subject) {
        Ok(subject) => subject,
        Err(message) => return Response::error(400, message),
    };
    if let Err(message) = model::check_texts(&request.text, None) {
        return Response::error(413, message);
    }
    if request.to.len() + request.cc.len() > model::MAX_RECIPIENTS {
        return Response::error(400, "a message has at most 20 recipients");
    }
    let written = |list: &[String]| -> Result<Vec<Address>, Response> {
        list.iter().map(|raw| written_address(raw)).collect()
    };
    let (from, to, cc) = match (
        written_address(&request.from),
        written(&request.to),
        written(&request.cc),
    ) {
        (Ok(from), Ok(to), Ok(cc)) => (from, to, cc),
        (Err(response), _, _) | (_, Err(response), _) | (_, _, Err(response)) => return response,
    };
    let id = model::message_id(request.at_ms, &hex_sha256(request.key.as_bytes()));
    let mut space = cx.storage.user();
    match own_mailboxes(&mut space).await {
        Ok((own, _)) if own.iter().any(|each| each.id == *request.mailbox.as_str()) => {}
        Ok(_) => return Response::error(404, "no such mailbox"),
        Err(error) => return storage_error(error),
    }
    let header = Header {
        id: id.clone(),
        mailbox: request.mailbox,
        from,
        to,
        cc,
        bcc: Vec::new(),
        reply_to: None,
        priority: None,
        subject,
        at_ms: request.at_ms,
        unread: false,
        flag: None,
        muted: false,
        rules_pending: false,
        text: model::prefix(&request.text, model::TEXT_INDEX_CHARS),
        attachments: Vec::new(),
        html: false,
    };
    let body = Body {
        text: request.text,
        html: None,
    };
    if let Err(error) = store_copy(&mut space, &header, &body).await {
        return storage_error(error);
    }
    match header_of(&mut space, &id).await {
        Ok(Some((mut made, _))) => match settle(&mut space, &mut made).await {
            Ok(()) => Response::json(200, &serde_json::json!({ "message": made })),
            Err(response) => response,
        },
        Ok(None) => Response::error(404, "no such message"),
        Err(response) => response,
    }
}

/// `header` as the person reads it ([`model::settle_mailbox`]).
async fn settle(space: &mut Space<'_>, header: &mut Header) -> Result<(), Response> {
    if matches!(header.mailbox, Mailbox::Own(_)) {
        let (own, _) = own_mailboxes(space).await.map_err(storage_error)?;
        model::settle_mailbox(header, &own);
    }
    Ok(())
}

/// Apply `change` to message `id` by compare-and-set: the message as it is
/// then, or `None` when there is no such message.
async fn changed(
    space: &mut Space<'_>,
    id: &str,
    change: &Patch,
) -> Result<Option<Header>, Response> {
    for _ in 0..CAS_ATTEMPTS {
        let Some((mut header, version)) = header_of(space, id).await? else {
            return Ok(None);
        };
        match model::apply(&mut header, change) {
            Ok(false) => return Ok(Some(header)),
            Ok(true) => {}
            Err(message) => return Err(Response::error(400, message)),
        }
        let bytes =
            serde_json::to_vec(&header).map_err(|e| Response::error(500, &e.to_string()))?;
        match space
            .put_if_version(&model::header_key(id), &bytes, Some(version))
            .await
        {
            Ok(true) => return Ok(Some(header)),
            Ok(false) => continue,
            Err(error) => return Err(storage_error(error)),
        }
    }
    Err(Response::error(503, "the message kept changing; retry"))
}

/// Where a person's own mailboxes are listed, in their space.
const OWN_MAILBOXES_KEY: &str = "mailboxes";

/// The mailboxes the person made, and the version of their list (`None`
/// before the first).
async fn own_mailboxes(space: &mut Space<'_>) -> std::io::Result<(Vec<OwnMailbox>, Option<u64>)> {
    match space.get_versioned(OWN_MAILBOXES_KEY).await? {
        Some((bytes, version)) => Ok((
            serde_json::from_slice(&bytes).map_err(data_error)?,
            Some(version),
        )),
        None => Ok((Vec::new(), None)),
    }
}

/// Change the person's list of mailboxes by compare-and-set. `edit` answers
/// what to reply with and whether it changed the list.
async fn edit_own_mailboxes<T, F>(space: &mut Space<'_>, edit: F) -> Result<T, Response>
where
    F: Fn(&mut Vec<OwnMailbox>) -> Result<(T, bool), Response>,
{
    for _ in 0..CAS_ATTEMPTS {
        let (mut own, version) = own_mailboxes(space).await.map_err(storage_error)?;
        let (answer, wrote) = edit(&mut own)?;
        if !wrote {
            return Ok(answer);
        }
        let bytes = serde_json::to_vec(&own).map_err(|e| Response::error(500, &e.to_string()))?;
        match space
            .put_if_version(OWN_MAILBOXES_KEY, &bytes, version)
            .await
        {
            Ok(true) => return Ok(answer),
            Ok(false) => continue,
            Err(error) => return Err(storage_error(error)),
        }
    }
    Err(Response::error(503, "your mailboxes kept changing; retry"))
}

/// A mailbox's name, as a request names it.
#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct MailboxName {
    name: String,
}

fn named_alike(mailbox: &OwnMailbox, name: &str) -> bool {
    mailbox.name.to_lowercase() == name.to_lowercase()
}

async fn create_mailbox(cx: &mut ApiCtx<'_>) -> Response {
    let asked: MailboxName = match cx.request.json() {
        Ok(asked) => asked,
        Err(response) => return response,
    };
    let name = match model::clean_mailbox_name(&asked.name) {
        Ok(name) => name,
        Err(message) => return Response::error(400, message),
    };
    let Ok(random) = new_random() else {
        return Response::error(503, "no random id could be made");
    };
    let id = format!("box-{}", &random[..16]);
    let mut space = cx.storage.user();
    let made = edit_own_mailboxes(&mut space, |own| {
        if let Some(found) = own.iter().find(|mailbox| named_alike(mailbox, &name)) {
            return Ok((found.clone(), false));
        }
        if own.len() >= model::MAX_OWN_MAILBOXES {
            return Err(Response::error(
                409,
                "you have made the most mailboxes Mail keeps",
            ));
        }
        let mailbox = OwnMailbox {
            id: id.clone(),
            name: name.clone(),
        };
        own.push(mailbox.clone());
        Ok((mailbox, true))
    })
    .await;
    match made {
        Ok(mailbox) => Response::json(200, &serde_json::json!({ "mailbox": mailbox })),
        Err(response) => response,
    }
}

async fn rename_mailbox(cx: &mut ApiCtx<'_>, id: &str) -> Response {
    let asked: MailboxName = match cx.request.json() {
        Ok(asked) => asked,
        Err(response) => return response,
    };
    let name = match model::clean_mailbox_name(&asked.name) {
        Ok(name) => name,
        Err(message) => return Response::error(400, message),
    };
    let mut space = cx.storage.user();
    let renamed = edit_own_mailboxes(&mut space, |own| {
        if own
            .iter()
            .any(|mailbox| mailbox.id != id && named_alike(mailbox, &name))
        {
            return Err(Response::error(
                409,
                "Mail already has a mailbox with that name",
            ));
        }
        let Some(mailbox) = own.iter_mut().find(|mailbox| mailbox.id == id) else {
            return Err(Response::error(404, "no such mailbox"));
        };
        let wrote = mailbox.name != name;
        mailbox.name.clone_from(&name);
        Ok((mailbox.clone(), wrote))
    })
    .await;
    match renamed {
        Ok(mailbox) => Response::json(200, &serde_json::json!({ "mailbox": mailbox })),
        Err(response) => response,
    }
}

/// `DELETE /mailboxes/<id>?after=<id>`: moves what the mailbox holds to the
/// Trash among up to [`ERASE_SCAN`] headers after `after`, and removes the
/// mailbox once the whole history has been read. A mailbox already gone
/// answers the same, so a resend changes nothing.
async fn delete_mailbox(cx: &mut ApiCtx<'_>, id: &str) -> Response {
    if !model::is_own_mailbox_id(id) {
        return Response::error(404, "no such mailbox");
    }
    let after = cx.request.query_param("after");
    if after.is_some_and(|id| !model::is_message_id(id)) {
        return Response::error(400, "after names a message");
    }
    let mut after = after.map(str::to_string);
    let target = Mailbox::Own(id.to_string());
    let to_trash = Patch {
        mailbox: Some(Mailbox::Trash),
        only_from: Some(target.clone()),
        ..Patch::default()
    };
    let mut moved = 0;
    let mut seen = 0;
    loop {
        let page = match headers_page(cx, after.as_deref(), model::LIST_LIMIT).await {
            Ok(page) => page,
            Err(error) => return storage_error(error),
        };
        seen += page.scanned;
        let mut space = cx.storage.user();
        for header in page.headers.iter().filter(|h| h.mailbox == target) {
            match changed(&mut space, &header.id, &to_trash).await {
                Ok(Some(now)) if now.mailbox == Mailbox::Trash => moved += 1,
                Ok(_) => {}
                Err(response) => return response,
            }
        }
        match page.next {
            Some(next) if seen < ERASE_SCAN => after = Some(next),
            Some(next) => {
                return Response::json(
                    200,
                    &serde_json::json!({ "moved": moved, "more": true, "next": next }),
                )
            }
            None => break,
        }
    }
    let mut space = cx.storage.user();
    let removed = edit_own_mailboxes(&mut space, |own| {
        let before = own.len();
        own.retain(|mailbox| mailbox.id != id);
        Ok(((), own.len() != before))
    })
    .await;
    match removed {
        Ok(()) => Response::json(
            200,
            &serde_json::json!({ "moved": moved, "more": false, "next": null }),
        ),
        Err(response) => response,
    }
}

/// Erase message `id` if it is still at `version`: its header becomes a
/// tombstone by compare-and-set (`Ok(false)` when it changed meanwhile, and
/// nothing is erased), then the body goes ([`finish_erase`]). Its files are let
/// go first ([`copies`]).
async fn erase_at(
    space: &mut Space<'_>,
    header: &Header,
    version: u64,
    now_ms: u64,
) -> std::io::Result<bool> {
    let id = header.id.as_str();
    copies::let_go(space, header).await?;
    let key = model::header_key(id);
    if !space
        .put_if_version(&key, TOMBSTONE_UNFINISHED, Some(version))
        .await?
    {
        return Ok(false);
    }
    finish_erase(space, id, now_ms).await?;
    Ok(true)
}

/// Delete an erased message's body, then mark its tombstone finished. The
/// tombstone stays for [`SEND_RECORD_MS`], as long as a resend of the message
/// can arrive, so a resend finds the copy present and never delivers it
/// again; then it expires. Until the body is deleted the tombstone stays
/// unfinished, with no expiry, for a later listing to finish.
async fn finish_erase(space: &mut Space<'_>, id: &str, now_ms: u64) -> std::io::Result<()> {
    space.delete(&model::body_key(id)).await?;
    // Nothing but a tombstone is written to an erased message's header.
    space
        .put_expiring(&model::header_key(id), TOMBSTONE, now_ms + SEND_RECORD_MS)
        .await
}

/// Whether a message in `mailbox` may be erased for good.
fn erasable(mailbox: &Mailbox) -> bool {
    matches!(mailbox, Mailbox::Trash | Mailbox::Drafts)
}

async fn erase(cx: &mut ApiCtx<'_>, id: &str) -> Response {
    let now_ms = cx.now_ms;
    let mut space = cx.storage.user();
    for _ in 0..CAS_ATTEMPTS {
        let (header, version) = match header_of(&mut space, id).await {
            Ok(Some(found)) => found,
            Ok(None) => {
                // Erased already; an erasure that stopped part way is finished now.
                if model::is_message_id(id) {
                    match space.get(&model::header_key(id)).await {
                        Ok(Some(bytes)) if bytes == TOMBSTONE_UNFINISHED => {
                            if let Err(error) = finish_erase(&mut space, id, now_ms).await {
                                return storage_error(error);
                            }
                        }
                        Ok(_) => {}
                        Err(error) => return storage_error(error),
                    }
                }
                return Response::json(200, &serde_json::json!({ "erased": 0 }));
            }
            Err(response) => return response,
        };
        if !erasable(&header.mailbox) {
            return Response::error(409, "move the message to the Trash first");
        }
        match erase_at(&mut space, &header, version, now_ms).await {
            Ok(true) => return Response::json(200, &serde_json::json!({ "erased": 1 })),
            // Changed meanwhile (moved out of the Trash, perhaps): look again.
            Ok(false) => continue,
            Err(error) => return storage_error(error),
        }
    }
    Response::error(503, "the message kept changing; retry")
}

/// How many headers one run over a mailbox looks through before answering with
/// the cursor to go on from.
const ERASE_SCAN: usize = 2_000;

/// A message to send or a draft to save. A field it does not name is
/// refused, so a request carrying something this Mail does not keep is told
/// so rather than sent without it.
#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Outgoing {
    #[serde(default)]
    to: Vec<String>,
    #[serde(default)]
    cc: Vec<String>,
    #[serde(default)]
    bcc: Vec<String>,
    #[serde(default)]
    reply_to: Option<String>,
    #[serde(default)]
    priority: Option<model::Priority>,
    #[serde(default)]
    subject: String,
    #[serde(default)]
    text: String,
    #[serde(default)]
    html: Option<String>,
    #[serde(default)]
    attachments: Vec<String>,
    #[serde(default)]
    draft: Option<String>,
    #[serde(default)]
    id: Option<String>,
    /// A mailbox of the sender's own that stands in for Sent, which a mailbox since deleted does not.
    #[serde(default)]
    sent_box: Option<String>,
}

/// What one send did, kept a day under its idempotency key.
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct SendRecord {
    /// SHA-256 of the request body: the same key with another body is refused.
    payload: String,
    sent_id: String,
    delivery_id: String,
    at_ms: u64,
    /// The accounts the first attempt resolved: a resend delivers to them,
    /// whatever the names have come to mean since.
    to: Vec<Account>,
    cc: Vec<Account>,
    #[serde(default)]
    bcc: Vec<Account>,
    /// Whether the day's allowance has been taken for this message. Every
    /// attempt that finds it untaken takes it before delivering, so no
    /// attempt delivers what nobody was charged for.
    #[serde(default)]
    charged: bool,
    #[serde(default)]
    done: bool,
}

fn hex_sha256(bytes: &[u8]) -> String {
    ferrite_app::crypto::hex(&ferrite_app::crypto::sha256(bytes))
}

/// How long a message's draft and its delivery know of each other. A window taken away during its
/// send saves what it holds while the send is under way, and either request can reach the server
/// first; a person writing the same message again takes longer.
const SENT_DRAFT_MS: u64 = 60_000;

fn draft_of_key(composed: &str) -> String {
    format!("draft-of/{composed}")
}

fn sent_message_key(composed: &str) -> String {
    format!("sent-message/{composed}")
}

/// The reply to a draft of a message already delivered: nothing was kept.
fn draft_not_kept() -> Response {
    Response::json(200, &serde_json::json!({ "message": null }))
}

/// A Reply-To as typed: blank is none, and it is kept with the message whatever it says, since a
/// reply is what resolves it.
fn clean_reply_to(raw: Option<&str>) -> Result<Option<String>, Response> {
    let Some(raw) = raw.map(str::trim).filter(|raw| !raw.is_empty()) else {
        return Ok(None);
    };
    if raw.chars().count() > 320 || raw.chars().any(char::is_control) {
        return Err(Response::error(400, "a Reply-To is at most 320 characters"));
    }
    Ok(Some(raw.to_string()))
}

/// The recipients' accounts, deduplicated in order, or the reply refusing
/// the send.
async fn resolve(cx: &mut ApiCtx<'_>, tokens: &[String]) -> Result<Vec<Account>, Response> {
    let mut unknown = Vec::new();
    let mut outside = Vec::new();
    let mut found: Vec<Account> = Vec::new();
    for raw in tokens {
        match model::recipient(raw) {
            Recipient::Desktop(name) => {
                if found.iter().any(|account| account.name == name) {
                    continue;
                }
                match crate::accounts::lookup(cx.storage.store(), &name).await {
                    Ok(Some(account)) => found.push(account),
                    Ok(None) => unknown.push(raw.trim().to_string()),
                    Err(error) => return Err(storage_error(error)),
                }
            }
            Recipient::Outside(address) => outside.push(address),
            Recipient::Invalid => unknown.push(raw.trim().to_string()),
        }
    }
    if !outside.is_empty() {
        return Err(Response::json(
            422,
            &serde_json::json!({
                "error": "this desktop sends mail only to its own accounts; it has no internet mail provider",
                "outside": outside,
            }),
        ));
    }
    if !unknown.is_empty() {
        return Err(Response::json(
            422,
            &serde_json::json!({
                "error": "no account of this desktop has that name",
                "unknown": unknown,
            }),
        ));
    }
    Ok(found)
}

async fn send(cx: &mut ApiCtx<'_>, account: &Account) -> Response {
    // A Guest User needs no account to begin with and its allowance ends
    // with it, so a guest could send without bound into other people's
    // mailboxes; nobody can write back to one either.
    if account.guest {
        return Response::error(403, "a Guest User cannot send mail");
    }
    let outgoing: Outgoing = match cx.request.json() {
        Ok(outgoing) => outgoing,
        Err(response) => return response,
    };
    if outgoing.to.len() + outgoing.cc.len() + outgoing.bcc.len() > model::MAX_RECIPIENTS {
        return Response::error(400, "a message has at most 20 recipients");
    }
    if outgoing.to.is_empty() && outgoing.cc.is_empty() && outgoing.bcc.is_empty() {
        return Response::error(400, "a message needs a recipient");
    }
    let reply_to = match clean_reply_to(outgoing.reply_to.as_deref()) {
        Ok(reply_to) => reply_to,
        Err(response) => return response,
    };
    if outgoing.attachments.len() > model::MAX_ATTACHMENTS {
        return Response::error(400, "a message has at most 10 attachments");
    }
    let subject = match model::clean_subject(&outgoing.subject) {
        Ok(subject) => subject,
        Err(message) => return Response::error(400, message),
    };
    let html = outgoing.html.filter(|html| !html.trim().is_empty());
    if let Err(message) = model::check_texts(&outgoing.text, html.as_deref()) {
        return Response::error(413, message);
    }
    let now_ms = cx.now_ms;

    // A resend with the browser's key continues what the first did.
    let record_key = cx
        .request
        .idempotency_key
        .map(|key| format!("sent/{}", hex_sha256(key.as_bytes())));
    let payload = send_payload(cx.request.body);
    let composed = composed_message(cx.request.body);
    let mut record = None;
    if let Some(key) = &record_key {
        match cx.storage.user().get_json::<SendRecord>(key).await {
            Ok(Some(stored))
                if stored.payload != payload && stored.payload != hex_sha256(cx.request.body) =>
            {
                return Response::error(422, "this idempotency key was sent with another message");
            }
            Ok(Some(stored)) => record = Some(stored),
            Ok(None) => {}
            Err(error) => return storage_error(error),
        }
    }
    let mut record = match record {
        Some(record) => record,
        None => {
            let to = match resolve(cx, &outgoing.to).await {
                Ok(to) => to,
                Err(response) => return response,
            };
            let cc: Vec<Account> = match resolve(cx, &outgoing.cc).await {
                Ok(cc) => cc
                    .into_iter()
                    .filter(|a| !to.iter().any(|b| a.id == b.id))
                    .collect(),
                Err(response) => return response,
            };
            let bcc: Vec<Account> = match resolve(cx, &outgoing.bcc).await {
                Ok(bcc) => bcc
                    .into_iter()
                    .filter(|a| !to.iter().chain(&cc).any(|b| a.id == b.id))
                    .collect(),
                Err(response) => return response,
            };
            let (Ok(a), Ok(b)) = (new_random(), new_random()) else {
                return Response::error(503, "no random id could be made");
            };
            let fresh = SendRecord {
                payload,
                sent_id: model::message_id(now_ms, &a),
                delivery_id: model::message_id(now_ms, &b),
                at_ms: now_ms,
                to,
                cc,
                bcc,
                charged: false,
                done: false,
            };
            if let Some(key) = &record_key {
                let bytes = match serde_json::to_vec(&fresh) {
                    Ok(bytes) => bytes,
                    Err(error) => return Response::error(500, &error.to_string()),
                };
                match cx
                    .storage
                    .user()
                    .create_expiring(key, &bytes, now_ms + SEND_RECORD_MS)
                    .await
                {
                    Ok(true) => {}
                    // Another delivery of this very request is under way.
                    Ok(false) => return Response::error(503, "this message is being sent; retry"),
                    Err(error) => return storage_error(error),
                }
            }
            fresh
        }
    };
    if !record.done && !record.charged {
        // Each message sent takes one of the day's allowance, before anything
        // is delivered: what one account can make others keep is bounded.
        // The record says it was taken, so a resend continuing this send
        // takes nothing; an attempt that could not take it (refused, or the
        // store failing) delivers nothing, and a resend tries again.
        match allowance::take(&mut cx.storage.user(), "send", SENDS_PER_DAY, now_ms).await {
            Ok(true) => {}
            Ok(false) => {
                if let Some(key) = &record_key {
                    // Given up, so a resend after the day starts afresh; one
                    // left behind is uncharged and charges again.
                    if let Err(error) = cx.storage.user().delete(key).await {
                        ferrite_app::tracing::warn!(%error, "a refused send kept its record");
                    }
                }
                return Response::error(429, "you have sent the most mail one day allows")
                    .add_header("retry-after", "3600");
            }
            Err(error) => return storage_error(error),
        }
        record.charged = true;
        if let Some(key) = &record_key {
            match serde_json::to_vec(&record) {
                Ok(bytes) => {
                    // A record not marked charges a resend again: twice the
                    // allowance, never a delivery for free.
                    if let Err(error) = cx
                        .storage
                        .user()
                        .put_expiring(key, &bytes, now_ms + SEND_RECORD_MS)
                        .await
                    {
                        ferrite_app::tracing::warn!(%error, "a send's charge was not recorded");
                    }
                }
                Err(error) => return Response::error(500, &error.to_string()),
            }
        }
    }
    if record.done {
        // Sent again from a draft saved since the first attempt: that draft goes too.
        if let Err(response) = forget_sent_drafts(
            &mut cx.storage.user(),
            outgoing.draft.as_deref(),
            &composed,
            now_ms,
        )
        .await
        {
            return response;
        }
        return match header_of(&mut cx.storage.user(), &record.sent_id).await {
            Ok(Some((sent, _))) => {
                let delivered: Vec<&str> = record
                    .to
                    .iter()
                    .chain(&record.cc)
                    .chain(&record.bcc)
                    .map(|account| account.name.as_str())
                    .collect();
                Response::json(
                    200,
                    &serde_json::json!({ "message": sent, "delivered": delivered }),
                )
            }
            Ok(None) => Response::error(409, "this message was sent and has since been erased"),
            Err(response) => response,
        };
    }

    // Taken for this send's Sent copy, after the day's allowance: a refused
    // send has taken nothing. A resend with the same key takes them again;
    // nothing else can take, hold or cancel them from now on.
    let taken = {
        let mut space = cx.storage.user();
        match attachments::take(&mut space, &outgoing.attachments, now_ms, &record.sent_id).await {
            Ok(taken) => taken,
            Err(refusal) => return refusal.reply(),
        }
    };

    if !taken.is_empty() {
        let mut held: Vec<(String, String)> = record
            .to
            .iter()
            .chain(&record.cc)
            .chain(&record.bcc)
            .map(|recipient| (recipient.id.clone(), record.delivery_id.clone()))
            .collect();
        held.push((cx.session.principal.clone(), record.sent_id.clone()));
        if let Err(error) = copies::note_send(cx, &taken, &held).await {
            return storage_error(error);
        }
    }

    let from = address(account);
    let addresses = |list: &[Account]| -> Vec<Address> { list.iter().map(address).collect() };
    let header = |id: &str, mailbox: Mailbox, unread: bool| Header {
        id: id.to_string(),
        from: from.clone(),
        to: addresses(&record.to),
        cc: addresses(&record.cc),
        // Nobody a copy is delivered to learns who else was written to unseen.
        bcc: if mailbox == Mailbox::Inbox {
            Vec::new()
        } else {
            addresses(&record.bcc)
        },
        reply_to: reply_to.clone(),
        priority: outgoing.priority,
        rules_pending: mailbox == Mailbox::Inbox,
        mailbox,
        subject: subject.clone(),
        at_ms: record.at_ms,
        unread,
        flag: None,
        muted: false,
        text: model::prefix(&outgoing.text, model::TEXT_INDEX_CHARS),
        attachments: taken.clone(),
        html: html.is_some(),
    };
    let body = Body {
        text: outgoing.text.clone(),
        html: html.clone(),
    };
    let note = Notification {
        app: MODULE.name.into(),
        id: format!("message-{}", record.delivery_id),
        title: account.full_name.clone(),
        subtitle: Some(subject.clone()),
        body: Some(model::prefix(&outgoing.text, PREVIEW_CHARS)).filter(|t| !t.trim().is_empty()),
        ..Notification::default()
    };

    let mut delivered = Vec::new();
    let mut seen = BTreeSet::new();
    for recipient in record.to.iter().chain(&record.cc).chain(&record.bcc) {
        if !seen.insert(recipient.id.clone()) {
            continue;
        }
        let copy = header(&record.delivery_id, Mailbox::Inbox, true);
        let (written, quiet) = {
            let mut storage = Storage::new(cx.storage.store(), MODULE.name, &recipient.id);
            let mut space = storage.user();
            let written = store_copy(&mut space, &copy, &body).await;
            let quiet = in_muted_conversation(&mut space, &copy, &recipient.name).await;
            (written, quiet)
        };
        if let Err(error) = written {
            return storage_error(error);
        }
        if !quiet {
            if let Err(error) =
                notification_center::notify(cx.storage.store(), &recipient.id, now_ms, &note).await
            {
                ferrite_app::tracing::warn!(%error, "a recipient was not notified of new mail");
            }
        }
        // The recipient's Mail change count moves, on their personal stream.
        // The sender's moves with every write they make (the router's), so a
        // message to oneself needs nothing more.
        if recipient.id != cx.session.principal {
            touch(cx, &recipient.id, now_ms).await;
        }
        delivered.push(recipient.name.clone());
    }
    let mut space = cx.storage.user();
    let filed = match own_mailboxes(&mut space).await {
        Ok((own, _)) => outgoing
            .sent_box
            .as_ref()
            .filter(|box_id| own.iter().any(|each| each.id == **box_id))
            .map_or(Mailbox::Sent, |box_id| Mailbox::Own(box_id.clone())),
        Err(error) => return storage_error(error),
    };
    let sent = header(&record.sent_id, filed, false);
    if let Err(error) = store_copy(&mut space, &sent, &body).await {
        return storage_error(error);
    }
    // An earlier attempt stored this copy and it has been erased since: it stays erased, and this
    // attempt says so rather than answering with a copy that does not exist.
    let sent_erased = match header_of(&mut space, &sent.id).await {
        Ok(found) => found.is_none(),
        Err(response) => return response,
    };
    if let Err(response) =
        forget_sent_drafts(&mut space, outgoing.draft.as_deref(), &composed, now_ms).await
    {
        return response;
    }
    if let Some(key) = &record_key {
        let done = SendRecord {
            done: true,
            ..record
        };
        if let Ok(bytes) = serde_json::to_vec(&done) {
            if let Err(error) = space
                .put_expiring(key, &bytes, now_ms + SEND_RECORD_MS)
                .await
            {
                ferrite_app::tracing::warn!(%error, "a send's record was not closed");
            }
        }
    }
    if sent_erased {
        return Response::error(409, "this message was sent and has since been erased");
    }
    Response::json(
        201,
        &serde_json::json!({ "message": sent, "delivered": delivered }),
    )
}

/// The draft a sent message was written in leaves Drafts. A failure is the send's: answered as one,
/// so the browser keeps the key and sends again, rather than leave a draft to be sent a second time.
async fn erase_sent_draft(
    space: &mut Space<'_>,
    draft: Option<&str>,
    now_ms: u64,
) -> Result<(), Response> {
    let Some(draft) = draft.filter(|d| model::is_message_id(d)) else {
        return Ok(());
    };
    if let Some((old, version)) = header_of(space, draft).await? {
        if old.mailbox == Mailbox::Drafts {
            erase_at(space, &old, version, now_ms)
                .await
                .map_err(storage_error)?;
        }
    }
    Ok(())
}

/// Everything a delivered message leaves behind in Drafts: the draft the request names, and the one
/// saved with its text by a window whose send was under way, which the request cannot name. It is
/// marked delivered first, so that a save at the same moment finds the mark or is found here.
async fn forget_sent_drafts(
    space: &mut Space<'_>,
    named: Option<&str>,
    composed: &str,
    now_ms: u64,
) -> Result<(), Response> {
    erase_sent_draft(space, named, now_ms).await?;
    space
        .put_expiring(&sent_message_key(composed), b"true", now_ms + SENT_DRAFT_MS)
        .await
        .map_err(storage_error)?;
    let saved = space
        .get_json::<String>(&draft_of_key(composed))
        .await
        .map_err(storage_error)?;
    erase_sent_draft(space, saved.as_deref(), now_ms).await
}

/// A request's body without the named fields, hashed.
fn hash_without(body: &[u8], fields: &[&str]) -> String {
    match serde_json::from_slice::<serde_json::Value>(body) {
        Ok(mut value) => {
            if let Some(object) = value.as_object_mut() {
                for field in fields {
                    object.remove(*field);
                }
            }
            hex_sha256(value.to_string().as_bytes())
        }
        Err(_) => hex_sha256(body),
    }
}

/// What makes two sends the same message: all of the request but the draft it was written in, since
/// a message whose first answer was lost may be sent again from a draft saved after it, and where the
/// sender's copy is filed.
fn send_payload(body: &[u8]) -> String {
    hash_without(body, &["draft", "sent_box"])
}

/// What a send and a draft save of one message share: their bodies, but for which draft each names
/// and where a send files its copy.
fn composed_message(body: &[u8]) -> String {
    hash_without(body, &["draft", "id", "sent_box"])
}

/// Move `principal`'s Mail change count (their personal stream carries it),
/// tagged with this browser. Nothing here fails the request.
async fn touch(cx: &mut ApiCtx<'_>, principal: &str, now_ms: u64) {
    let by = cx.session.id.clone();
    if let Err(error) =
        notification_center::touched(cx.storage.store(), principal, MODULE.name, &by, now_ms).await
    {
        ferrite_app::tracing::warn!(%error, "a person's Mail change count did not move");
    }
}

/// Store one copy: the body, then the header, created only if absent.
///
/// Two attempts of one send can store the same copy at once (a resend while
/// the first is still running). When the header is found written by the
/// other, the body written here holds the same text; when it is found erased
/// meanwhile, the body this attempt wrote after the erasure deleted it is
/// deleted again, so an erased message's text never stays stored.
async fn store_copy(space: &mut Space<'_>, header: &Header, body: &Body) -> std::io::Result<()> {
    let key = model::header_key(&header.id);
    if space.get(&key).await?.is_some() {
        return Ok(());
    }
    let body_key = model::body_key(&header.id);
    let body_bytes = serde_json::to_vec(body).map_err(data_error)?;
    space.put(&body_key, &body_bytes).await?;
    let header_bytes = serde_json::to_vec(header).map_err(data_error)?;
    if !space.put_if_version(&key, &header_bytes, None).await?
        && space.get(&key).await?.is_some_and(|b| is_tombstone(&b))
    {
        space.delete(&body_key).await?;
    }
    Ok(())
}

async fn save_draft(cx: &mut ApiCtx<'_>, account: &Account) -> Response {
    let composed = composed_message(cx.request.body);
    let draft: Outgoing = match cx.request.json() {
        Ok(draft) => draft,
        Err(response) => return response,
    };
    if draft.to.len() + draft.cc.len() + draft.bcc.len() > model::MAX_RECIPIENTS {
        return Response::error(400, "a message has at most 20 recipients");
    }
    if draft.attachments.len() > model::MAX_ATTACHMENTS {
        return Response::error(400, "a message has at most 10 attachments");
    }
    let typed = |list: &[String]| -> Result<Vec<Address>, Response> {
        list.iter()
            .map(|raw| {
                let raw = raw.trim();
                if raw.is_empty() || raw.chars().count() > 320 || raw.chars().any(char::is_control)
                {
                    Err(Response::error(400, "a recipient is 1 to 320 characters"))
                } else {
                    Ok(Address {
                        name: raw.to_string(),
                        full_name: String::new(),
                    })
                }
            })
            .collect()
    };
    let (to, cc, bcc) = match (typed(&draft.to), typed(&draft.cc), typed(&draft.bcc)) {
        (Ok(to), Ok(cc), Ok(bcc)) => (to, cc, bcc),
        (Err(response), _, _) | (_, Err(response), _) | (_, _, Err(response)) => return response,
    };
    let reply_to = match clean_reply_to(draft.reply_to.as_deref()) {
        Ok(reply_to) => reply_to,
        Err(response) => return response,
    };
    let subject = match model::clean_subject(&draft.subject) {
        Ok(subject) => subject,
        Err(message) => return Response::error(400, message),
    };
    let html = draft.html.filter(|html| !html.trim().is_empty());
    if let Err(message) = model::check_texts(&draft.text, html.as_deref()) {
        return Response::error(413, message);
    }
    let now_ms = cx.now_ms;
    let (new_id, at_ms) = match pinned_draft(cx, now_ms).await {
        Ok(pinned) => pinned,
        Err(response) => return response,
    };
    let mut space = cx.storage.user();
    // Not a resend of a save, which answers for the draft it made: the message has gone, and what
    // its window saved on the way out has no use.
    let first_save = match space.get(&model::header_key(&new_id)).await {
        Ok(found) => found.is_none(),
        Err(error) => return storage_error(error),
    };
    if first_save {
        match space.get_json::<bool>(&sent_message_key(&composed)).await {
            Ok(Some(_)) => return draft_not_kept(),
            Ok(None) => {}
            Err(error) => return storage_error(error),
        }
    }
    let replaced = match draft.id.as_deref() {
        Some(id) => match header_of(&mut space, id).await {
            Ok(Some((old, version))) if old.mailbox == Mailbox::Drafts => Some((old, version)),
            Ok(_) => None,
            Err(response) => return response,
        },
        None => None,
    };
    // Noted before it holds them: a send after this finds the draft, and one before it refuses.
    if let Err(error) = copies::note_copy(cx, &draft.attachments, &new_id).await {
        return storage_error(error);
    }
    let mut space = cx.storage.user();
    let held = match attachments::hold(&mut space, &draft.attachments, now_ms).await {
        Ok(held) => held,
        Err(refusal) => {
            if let Err(error) = copies::unnote_copy(cx, &draft.attachments, &new_id).await {
                return storage_error(error);
            }
            return refusal.reply();
        }
    };
    let header = Header {
        id: new_id,
        mailbox: Mailbox::Drafts,
        from: address(account),
        to,
        cc,
        bcc,
        reply_to,
        priority: draft.priority,
        subject,
        at_ms,
        unread: false,
        flag: None,
        muted: false,
        rules_pending: false,
        text: model::prefix(&draft.text, model::TEXT_INDEX_CHARS),
        attachments: held,
        html: html.is_some(),
    };
    let body = Body {
        text: draft.text,
        html,
    };
    if let Err(error) = store_copy(&mut space, &header, &body).await {
        return storage_error(error);
    }
    if let Some((old, version)) = replaced {
        // Only the draft as it was found: one changed meanwhile stays.
        if let Err(error) = erase_at(&mut space, &old, version, now_ms).await {
            ferrite_app::tracing::warn!(%error, "a replaced draft was left");
        }
    }
    let draft_id = serde_json::Value::from(header.id.as_str()).to_string();
    if let Err(error) = space
        .put_expiring(
            &draft_of_key(&composed),
            draft_id.as_bytes(),
            now_ms + SENT_DRAFT_MS,
        )
        .await
    {
        return storage_error(error);
    }
    // What is stored now: a resend of a save finds the draft the first made,
    // or nothing if it has been sent or deleted since.
    match header_of(&mut space, &header.id).await {
        Ok(Some((stored, version))) => {
            // Delivered while this was being stored, and the send looked before it was here.
            match space.get_json::<bool>(&sent_message_key(&composed)).await {
                Ok(Some(_)) => {
                    return match erase_at(&mut space, &stored, version, now_ms).await {
                        Ok(_) => draft_not_kept(),
                        Err(error) => storage_error(error),
                    };
                }
                Ok(None) => {}
                Err(error) => return storage_error(error),
            }
            Response::json(200, &serde_json::json!({ "message": stored }))
        }
        Ok(None) => Response::error(
            409,
            "this draft was saved and has since been sent or deleted",
        ),
        Err(response) => response,
    }
}

/// The bytes of an attachment of a message in the reader's own mailbox.
async fn read_attachment(cx: &mut ApiCtx<'_>, id: &str, attachment: &str) -> Response {
    let (first, count) = match attachments::read_range(
        cx.request.query_param("piece"),
        cx.request.query_param("count"),
    ) {
        Ok(range) => range,
        Err(response) => return response,
    };
    let header = match header_of(&mut cx.storage.user(), id).await {
        Ok(Some((header, _))) => header,
        Ok(None) => return Response::error(404, "no such message"),
        Err(response) => return response,
    };
    let Some(found) = header.attachments.iter().find(|a| a.id == attachment) else {
        return Response::error(404, "the message has no such attachment");
    };
    attachments::read(cx.ctx, MODULE.name, found, first, count).await
}

/// What a keyed draft save made, kept a day under its idempotency key.
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct DraftRecord {
    /// SHA-256 of the request body: the same key with another body is refused.
    payload: String,
    id: String,
    at_ms: u64,
}

/// The id and time of the draft this save stores. A save without an
/// idempotency key gets fresh ones. With a key, the first attempt records
/// them (`draft-key/<hash>`, created only if absent, kept a day) and every
/// resend of the same body takes the same, so storing the draft again
/// changes nothing ([`store_copy`] creates a header only if absent) and the
/// draft it replaced is erased once.
async fn pinned_draft(cx: &mut ApiCtx<'_>, now_ms: u64) -> Result<(String, u64), Response> {
    let fresh = || -> Result<(String, u64), Response> {
        new_random()
            .map(|random| (model::message_id(now_ms, &random), now_ms))
            .map_err(|_| Response::error(503, "no random id could be made"))
    };
    let Some(key) = cx
        .request
        .idempotency_key
        .map(|key| format!("draft-key/{}", hex_sha256(key.as_bytes())))
    else {
        return fresh();
    };
    let payload = hex_sha256(cx.request.body);
    // Two attempts of one request may race: the one that creates the record
    // wins, and the other reads what it pinned.
    for _ in 0..2 {
        match cx.storage.user().get_json::<DraftRecord>(&key).await {
            Ok(Some(record)) if record.payload != payload => {
                return Err(Response::error(
                    422,
                    "this idempotency key was sent with another draft",
                ));
            }
            Ok(Some(record)) => return Ok((record.id, record.at_ms)),
            Ok(None) => {}
            Err(error) => return Err(storage_error(error)),
        }
        let (id, at_ms) = fresh()?;
        let record = DraftRecord {
            payload: payload.clone(),
            id: id.clone(),
            at_ms,
        };
        let bytes =
            serde_json::to_vec(&record).map_err(|e| Response::error(500, &e.to_string()))?;
        match cx
            .storage
            .user()
            .create_expiring(&key, &bytes, now_ms + SEND_RECORD_MS)
            .await
        {
            Ok(true) => return Ok((id, at_ms)),
            Ok(false) => continue,
            Err(error) => return Err(storage_error(error)),
        }
    }
    Err(Response::error(503, "this draft is being saved; retry"))
}

/// 128 random bits in hex, for a message id.
fn new_random() -> std::io::Result<String> {
    crate::crypto::random_token(16)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_send_and_a_draft_of_one_message_share_what_they_compose() {
        let send = br#"{"to":["ann"],"subject":"Hi","text":"x","draft":"d1"}"#;
        let draft = br#"{"id":"d2","to":["ann"],"subject":"Hi","text":"x"}"#;
        let new_draft = br#"{"to":["ann"],"subject":"Hi","text":"x"}"#;
        assert_eq!(composed_message(send), composed_message(draft));
        assert_eq!(composed_message(send), composed_message(new_draft));
        let other = br#"{"to":["ann"],"subject":"Hi","text":"y"}"#;
        assert_ne!(composed_message(send), composed_message(other));
        assert_ne!(send_payload(send), send_payload(draft));
    }
}

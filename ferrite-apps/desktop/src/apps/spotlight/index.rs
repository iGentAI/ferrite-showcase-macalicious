//! Spotlight's search: every source document read whole in one batch, and
//! the words of the drive's text files, read from the `files` blob once per
//! content and kept in Store under a small list of what is kept. See
//! `mod.rs`, "How a search reads".

use std::collections::{BTreeMap, BTreeSet};
use std::io;

use ferrite_app::serde;
use ferrite_app::serde_json::{self, Value};

use super::sources::{self, Item, KINDS, SOURCES};
use super::{found_every, found_in_contents, found_with, result};
use crate::module::ApiCtx;

/// Text files of the drive whose words are searched at most (the first in
/// the drive's order).
pub const MAX_TEXT_FILES: usize = 100;
/// Text files read from the blob in one search at most; the rest are read
/// by the searches after it.
pub const NEW_TEXTS_PER_SEARCH: usize = 12;
/// The most characters of one text file kept for the search.
pub const FILE_TEXT_CHARS: usize = 4_000;
/// Writes of the list of what is kept one given text tries.
const CAS_ATTEMPTS: usize = 8;
/// Kept words a search forgets at most, of files deleted, renamed to another
/// kind or past [`MAX_TEXT_FILES`]; the rest go in the searches after it.
pub const FORGETS_PER_SEARCH: usize = 16;
/// The most keys one batch read asks for (the store's own limit is 256).
const BATCH_KEYS: usize = 256;
/// The time a search may spend reading new files, from its start: a slow
/// blob leaves the rest to the next search instead of taking the request
/// past its deadline.
const NEW_TEXTS_BUDGET_MS: f64 = 2_000.0;

/// How long a content whose blob could not be read is skipped before a
/// search tries it again.
pub const SKIPPED_RETRY_MS: u64 = 10 * 60 * 1000;

/// The list of what Spotlight keeps for the person (`texts`, in its own
/// space): the words kept, by content and way of reading
/// (`<mode>/<content>`, each the key `text/<mode>/<content>`), and the
/// contents whose blob could not be read, with the time after which a search
/// tries them again.
#[derive(serde::Serialize, serde::Deserialize, Default, Clone, PartialEq, Debug)]
#[serde(crate = "ferrite_app::serde", default)]
struct Kept {
    texts: BTreeSet<String>,
    skipped: BTreeMap<String, u64>,
}

const KEPT_KEY: &str = "texts";

/// What a search found.
pub struct Found {
    pub results: Vec<Value>,
    pub truncated: bool,
    /// Some text files were not read yet.
    pub indexing: bool,
    /// Text files whose words are not searched, beyond [`MAX_TEXT_FILES`].
    pub unsearched_files: usize,
    /// How many of the person's newest Mail messages were searched.
    pub searched_mail: usize,
    /// Older Mail messages were not searched: past [`MAIL_HEADERS`], or past
    /// about [`MAIL_SCAN_BYTES`] of headers.
    pub unsearched_mail: bool,
}

/// A content read in `mode` ([`sources::text_mode`]): the same bytes named
/// `.html` and `.txt` are read two ways, so each way is kept apart.
fn read_way(content: &str, mode: &str) -> String {
    format!("{mode}/{content}")
}

fn text_key(way: &str) -> String {
    format!("text/{way}")
}

/// Words a page gives rather than a search reads from the blob: a PDF's.
fn is_given(way: &str) -> bool {
    way.starts_with("pdf/")
}

/// The file's own words, as they are kept: runs of white space made one, at
/// most [`FILE_TEXT_CHARS`] characters.
fn given_text(text: &str) -> String {
    text.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(FILE_TEXT_CHARS)
        .collect()
}

/// The words of the PDF that is drive file `file`, as a page read them with
/// pdf.js, for its content. `Ok(false)` when the drive has no such PDF. Kept
/// under the list of what is kept, by its version, so a search that writes
/// the list between leaves it to the next try.
pub async fn keep_pdf_text(cx: &mut ApiCtx<'_>, file: &str, text: &str) -> io::Result<bool> {
    let Some(source) = SOURCES.iter().find(|source| source.app == "files") else {
        return Ok(false);
    };
    let principal = cx.session.principal.clone();
    let key = format!("apps/{}/users/{principal}/{}", source.app, source.key).into_bytes();
    let answers = read_all(cx, &[key]).await?;
    let stored = answers
        .into_iter()
        .next()
        .and_then(|(bytes, _)| serde_json::from_slice::<Value>(&bytes?).ok());
    let content = stored
        .map(|stored| (source.extract)(&stored))
        .unwrap_or_default()
        .into_iter()
        .find(|item| item.id == file && sources::text_mode(&item.title) == "pdf")
        .and_then(|item| item.content);
    let Some(content) = content else {
        return Ok(false);
    };
    let way = read_way(&content, "pdf");
    cx.storage
        .user()
        .put_json(&text_key(&way), &given_text(text))
        .await?;
    for _ in 0..CAS_ATTEMPTS {
        let (bytes, version) = read_all(
            cx,
            &[format!("apps/spotlight/users/{principal}/{KEPT_KEY}").into_bytes()],
        )
        .await?
        .into_iter()
        .next()
        .unwrap_or_default();
        let mut kept = bytes
            .and_then(|bytes| serde_json::from_slice::<Kept>(&bytes).ok())
            .unwrap_or_default();
        if !kept.texts.insert(way.clone()) {
            return Ok(true);
        }
        let bytes = serde_json::to_vec(&kept).map_err(io::Error::other)?;
        if cx
            .storage
            .user()
            .put_if_version(KEPT_KEY, &bytes, version)
            .await?
        {
            return Ok(true);
        }
    }
    Err(io::Error::other("the list of kept words kept changing"))
}

/// The contents a search reads now, out of those it has no words for yet,
/// each with the retry-after time a failed read left it (`None`: never
/// skipped), in the drive's order: first those never skipped, then those
/// whose retry time has come, at most `budget`, each with whether it was
/// skipped. A content still skipped is not read at all, so an unavailable
/// blob never takes a read from the files after it. `true` beside them when
/// readable contents were left for a later search.
fn to_read<T>(
    pending: Vec<(T, Option<u64>)>,
    now_ms: u64,
    budget: usize,
) -> (Vec<(T, bool)>, bool) {
    let (mut fresh, mut due) = (Vec::new(), Vec::new());
    for (content, retry_after) in pending {
        match retry_after {
            None => fresh.push((content, false)),
            Some(at) if at <= now_ms => due.push((content, true)),
            Some(_) => {}
        }
    }
    fresh.extend(due);
    let left = fresh.len() > budget;
    fresh.truncate(budget);
    (fresh, left)
}

/// The blob key of a content's first piece, as the files module names its
/// pieces (`blob_key` in `../files/mod.rs`: `drive/<content>/<piece:05>`).
fn first_piece_key(content: &str) -> Vec<u8> {
    format!("drive/{content}/00000").into_bytes()
}

/// Read `keys` in batches of at most [`BATCH_KEYS`].
async fn read_all(
    cx: &mut ApiCtx<'_>,
    keys: &[Vec<u8>],
) -> io::Result<Vec<(Option<Vec<u8>>, Option<u64>)>> {
    let mut answers = Vec::with_capacity(keys.len());
    for batch in keys.chunks(BATCH_KEYS) {
        let got = cx.storage.store().multi_get(batch).await?;
        if got.len() != batch.len() {
            return Err(io::Error::other(
                "the store answered another number of keys",
            ));
        }
        answers.extend(got);
    }
    Ok(answers)
}

/// What a search reads and lists.
#[derive(Clone, Copy, PartialEq)]
pub enum Only {
    /// Everything, at most [`super::PER_KIND`] of each kind: Spotlight.
    Everything,
    /// The drive's every file and folder that matches: Finder's search.
    Files,
    /// The drive's files whose words hold the query, not their names or tags: a Contents row.
    Contents,
}

/// Search what the person keeps for `words` (at least one).
pub async fn search(cx: &mut ApiCtx<'_>, words: &[String], only: Only) -> io::Result<Found> {
    let only_files = only != Only::Everything;
    let principal = cx.session.principal.clone();
    let sources: Vec<_> = SOURCES
        .iter()
        .filter(|source| !only_files || source.app == "files")
        .collect();
    let mut keys: Vec<Vec<u8>> = sources
        .iter()
        .map(|source| format!("apps/{}/users/{principal}/{}", source.app, source.key).into_bytes())
        .collect();
    // Photos' records are spread over its shards; each reads like its `library` document.
    if !only_files {
        keys.extend(
            crate::apps::photos::shard_keys()
                .iter()
                .map(|key| format!("apps/photos/users/{principal}/{key}").into_bytes()),
        );
    }
    keys.push(format!("apps/spotlight/users/{principal}/{KEPT_KEY}").into_bytes());
    let mut answers = read_all(cx, &keys).await?;
    let (kept_bytes, kept_version) = answers.pop().unwrap_or_default();
    let kept = kept_bytes
        .and_then(|bytes| serde_json::from_slice::<Kept>(&bytes).ok())
        .unwrap_or_default();

    let mut all: Vec<Item> = Vec::new();
    for (document, _) in answers.split_off(sources.len()) {
        if let Some(stored) = document
            .as_deref()
            .and_then(|bytes| serde_json::from_slice::<Value>(bytes).ok())
        {
            all.extend(sources::photos(&stored));
        }
    }
    for (source, (document, _)) in sources.iter().zip(&answers) {
        if let Some(stored) = document
            .as_deref()
            .and_then(|bytes| serde_json::from_slice::<Value>(bytes).ok())
        {
            all.extend((source.extract)(&stored));
        }
    }

    let (texts, indexing, unsearched_files) =
        file_texts(cx, &principal, &all, kept, kept_version).await?;
    let words_of = |item: &Item| {
        item.content.as_ref().and_then(|content| {
            texts
                .get(&read_way(content, sources::text_mode(&item.title)))
                .cloned()
        })
    };
    if only_files {
        let items = merged(all.iter().filter(|item| item.kind == "files"));
        let hits = if only == Only::Contents {
            found_in_contents(items, words, words_of)
        } else {
            found_every(items, words, words_of)
        };
        return Ok(Found {
            results: hits.iter().map(result).collect(),
            truncated: false,
            indexing,
            unsearched_files,
            searched_mail: 0,
            unsearched_mail: false,
        });
    }
    let mail_found = mail(cx, &principal).await?;
    all.extend(mail_found.items);
    all.extend(listed_items(cx, &principal).await?);
    all.extend(recent_calls(cx, &principal).await?);
    all.extend(conversations(cx, &principal, words).await?);

    let mut results = Vec::new();
    let mut truncated = false;
    for kind in KINDS {
        let items: Vec<Item> = merged(all.iter().filter(|item| item.kind == *kind));
        let (hits, more) = found_with(items, words, words_of);
        truncated |= more;
        results.extend(hits.iter().map(result));
    }
    Ok(Found {
        results,
        truncated,
        indexing,
        unsearched_files,
        searched_mail: mail_found.searched,
        unsearched_mail: mail_found.more,
    })
}

/// One kind's items, with the items of one web page (a bookmark and its
/// visits share an address) made one: it shows as the first of them (the
/// bookmark, as bookmarks come before history) and is found by the words of
/// all of them, so a page bookmarked under a short name is still found by its
/// visited title. Items of other kinds, which never share an id, stay as they
/// are.
pub fn merged<'a>(items: impl Iterator<Item = &'a Item>) -> Vec<Item> {
    let mut out: Vec<Item> = Vec::new();
    let mut at: BTreeMap<String, usize> = BTreeMap::new();
    for item in items {
        if item.kind == "web" {
            if let Some(&index) = at.get(&item.id) {
                let kept = &mut out[index];
                kept.text.push('\n');
                kept.text.push_str(&item.text);
                if kept.at.is_none() {
                    kept.at = item.at;
                }
                continue;
            }
            at.insert(item.id.clone(), out.len());
        }
        out.push(item.clone());
    }
    out
}

/// The most Mail headers a search reads: the newest, as their ids sort.
/// The pages grow from 32, so reading them all costs about this many of the
/// store's request units.
pub const MAIL_HEADERS: usize = 200;

/// About the most bytes of Mail headers a search reads, as Mail's own listing
/// reads at most (`PAGE_BYTES` in `apps/mail/model.rs`). A header carries up
/// to 4,000 characters of its message's text, so without it the newest
/// [`MAIL_HEADERS`] long messages could be some 4.8 MB for every search.
pub const MAIL_SCAN_BYTES: usize = 1024 * 1024;

/// The most bytes one Mail header takes, for sizing the pages: its text
/// (Mail's `TEXT_INDEX_CHARS`, 4,000 characters) and subject (300) as JSON
/// writes them at worst, six bytes a character, with its people.
pub const MAIL_HEADER_BYTES: usize = 26 * 1024;

/// The page of Mail headers to ask for after `pages` pages that read `read`
/// headers of `bytes` bytes, `0` once [`MAIL_HEADERS`] are read or
/// [`MAIL_SCAN_BYTES`] are: growing as [`crate::module::scan_page`] does, and
/// never more headers than the bytes left would hold at [`MAIL_HEADER_BYTES`]
/// each (one at least), so a search stops within one header of
/// [`MAIL_SCAN_BYTES`], whatever the headers hold.
pub fn mail_page(read: usize, pages: u32, bytes: usize) -> u32 {
    if read >= MAIL_HEADERS || bytes >= MAIL_SCAN_BYTES {
        return 0;
    }
    let fit = ((MAIL_SCAN_BYTES - bytes) / MAIL_HEADER_BYTES).max(1);
    crate::module::scan_page(MAIL_HEADERS - read, pages).min(u32::try_from(fit).unwrap_or(u32::MAX))
}

/// What a search found in Mail.
pub struct MailFound {
    pub items: Vec<Item>,
    /// The headers read: how many of the newest messages were searched.
    pub searched: usize,
    /// The person has older messages, which this search did not read.
    pub more: bool,
}

/// The most devices or games read for one search: their modules list no more.
const LISTED_ITEMS: u32 = 200;

/// Find My's devices and the Chess list, which each keep one key per item.
async fn listed_items(cx: &mut ApiCtx<'_>, principal: &str) -> io::Result<Vec<Item>> {
    let mut items = Vec::new();
    for (prefix, read) in [
        (
            format!("apps/find-my/users/{principal}/devices/"),
            (|id, value| sources::device(id, value)) as fn(&str, &Value) -> Option<Item>,
        ),
        (
            format!("apps/chess/users/{principal}/games/"),
            (|id, value| Some(sources::game(id, value))) as fn(&str, &Value) -> Option<Item>,
        ),
    ] {
        let (rows, _) = cx
            .storage
            .store()
            .scan_prefix(prefix.as_bytes(), None, LISTED_ITEMS)
            .await?;
        for (key, bytes, _) in &rows {
            let id = key
                .strip_prefix(prefix.as_bytes())
                .and_then(|id| std::str::from_utf8(id).ok());
            let value = serde_json::from_slice::<Value>(bytes).ok();
            if let (Some(id), Some(value)) = (id, value) {
                items.extend(read(id, &value));
            }
        }
    }
    Ok(items)
}

/// The most lines of FaceTime's a search reads: its module keeps no more (`LINE_CAP`).
const CALL_LINES: u32 = 301;

/// The newest call with each person FaceTime's recents hold.
async fn recent_calls(cx: &mut ApiCtx<'_>, principal: &str) -> io::Result<Vec<Item>> {
    let prefix = format!("apps/facetime/users/{principal}/recents/");
    let (rows, _) = cx
        .storage
        .store()
        .scan_prefix(prefix.as_bytes(), None, CALL_LINES)
        .await?;
    let lines: Vec<Value> = rows
        .iter()
        .filter_map(|(_, bytes, _)| serde_json::from_slice(bytes).ok())
        .collect();
    Ok(sources::recent_calls(lines.iter()))
}

/// The conversations a search reads: the person's most recently active.
pub const CONVERSATIONS: u32 = 30;
/// More than anyone's blocked records: the Messages module starts at most 200.
const BLOCKED_RECORDS: u32 = 256;

/// The person's own Messages conversations, the newest [`CONVERSATIONS`] of their activity index
/// (`recent/<inverted time>/<id>`), each read as a member reads it in Messages: the document holds
/// its newest messages (`KEEP`, 100), so older pages of history are not searched. The shared rooms
/// are not read.
async fn conversations(
    cx: &mut ApiCtx<'_>,
    principal: &str,
    words: &[String],
) -> io::Result<Vec<Item>> {
    let own = format!("apps/messages/users/{principal}/");
    let recent = format!("{own}recent/");
    let (rows, _) = cx
        .storage
        .store()
        .scan_prefix(recent.as_bytes(), None, CONVERSATIONS)
        .await?;
    let mut ids: Vec<String> = Vec::new();
    for (key, _, _) in &rows {
        let id = std::str::from_utf8(key)
            .ok()
            .and_then(|key| key.strip_prefix(recent.as_str()))
            .and_then(|rest| rest.split_once('/'))
            .map(|(_, id)| id.to_string());
        if let Some(id) = id.filter(|id| !ids.contains(id)) {
            ids.push(id);
        }
    }
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let blocked_prefix = format!("{own}blocked/");
    let (records, _) = cx
        .storage
        .store()
        .scan_prefix(blocked_prefix.as_bytes(), None, BLOCKED_RECORDS)
        .await?;
    let blocked: Vec<(String, Vec<(u64, Option<u64>)>)> = records
        .iter()
        .filter_map(|(key, bytes, _)| {
            let name = key.strip_prefix(blocked_prefix.as_bytes())?;
            Some((
                std::str::from_utf8(name).ok()?.to_string(),
                sources::blocked_spans(bytes),
            ))
        })
        .collect();
    let keys: Vec<Vec<u8>> = ids
        .iter()
        .flat_map(|id| {
            [
                format!("apps/messages/shared/convs/{id}").into_bytes(),
                format!("{own}cleared/{id}").into_bytes(),
                format!("{own}hidden/{id}").into_bytes(),
            ]
        })
        .collect();
    let answers = read_all(cx, &keys).await?;
    let mut items = Vec::new();
    for (id, read) in ids.iter().zip(answers.chunks(3)) {
        let [(stored, _), (cleared, _), (hidden, _)] = read else {
            continue;
        };
        let Some(stored) = stored
            .as_deref()
            .and_then(|bytes| serde_json::from_slice::<Value>(bytes).ok())
        else {
            continue;
        };
        let (through, listed) = match cleared.as_deref() {
            None => (0, false),
            Some(bytes) => match sources::cleared_of(bytes) {
                Some(cleared) => cleared,
                // A record that cannot be read: nothing deleted is shown on a guess.
                None => continue,
            },
        };
        let hidden = match hidden.as_deref() {
            None => Vec::new(),
            Some(bytes) => match serde_json::from_slice(bytes) {
                Ok(hidden) => hidden,
                Err(_) => continue,
            },
        };
        let unseen = sources::Unseen {
            through,
            listed,
            hidden,
            blocked: blocked.clone(),
        };
        items.extend(sources::conversation(
            id, &stored, principal, &unseen, words,
        ));
    }
    Ok(items)
}

/// The person's Mail messages. Mail keeps one small header per message
/// (`apps/mail/users/<person>/m/<id>`, newest first in key order), which holds
/// the subject, the people and the start of the text: the search reads the
/// newest [`MAIL_HEADERS`] of them, and at most about [`MAIL_SCAN_BYTES`] of
/// them, in pages sized by [`mail_page`], with no index of its own. It says
/// how many it read, and whether older ones are left, so Spotlight can say so.
async fn mail(cx: &mut ApiCtx<'_>, principal: &str) -> io::Result<MailFound> {
    let prefix = format!("apps/mail/users/{principal}/m/").into_bytes();
    let mut items = Vec::new();
    let mut after: Option<Vec<u8>> = None;
    let (mut pages, mut read, mut bytes, mut more) = (0u32, 0usize, 0usize, false);
    loop {
        let page = mail_page(read, pages, bytes);
        if page == 0 {
            break;
        }
        pages += 1;
        // Each page is a store call of its own, and counted as one.
        let (rows, rest) = cx
            .storage
            .store()
            .scan_prefix(&prefix, after.as_deref(), page)
            .await?;
        for (_, value, _) in &rows {
            read += 1;
            bytes += value.len();
            if let Some(found) = serde_json::from_slice::<Value>(value)
                .ok()
                .and_then(|header| sources::mail_header(&header))
            {
                items.push(found);
            }
        }
        after = rows.last().map(|(key, _, _)| key.clone());
        more = rest && after.is_some();
        if !more {
            break;
        }
    }
    Ok(MailFound {
        items,
        searched: read,
        more,
    })
}

/// The words of the drive's text files the items name, by way of reading
/// ([`read_way`]): those kept already, and up to [`NEW_TEXTS_PER_SEARCH`]
/// read now from the `files` blob and kept, chosen by [`to_read`]. A content
/// whose blob is not there or cannot be read is marked skipped until
/// [`SKIPPED_RETRY_MS`] later and the search goes on without it. Words no
/// file reads that way any more are forgotten, [`FORGETS_PER_SEARCH`] at a
/// time, and so are the skip marks of contents no file names. The list of
/// what is kept ([`Kept`]) is written back only when it changed, and only
/// over the version this search read: a search that loses that race leaves
/// its work to the next one, which reads those files again and lists them.
/// (A word key kept by a search that lost the race, of a file deleted before
/// any later search listed it, is left behind; it takes two searches at once
/// and a drive change between them.) New files are read only while the
/// search has spent less than [`NEW_TEXTS_BUDGET_MS`] on them.
/// `true` beside the words when some files were left for a later search,
/// and how many text files beyond [`MAX_TEXT_FILES`] are not searched by
/// their words (their names still are).
async fn file_texts(
    cx: &mut ApiCtx<'_>,
    principal: &str,
    items: &[Item],
    kept: Kept,
    kept_version: Option<u64>,
) -> io::Result<(Texts, bool, usize)> {
    // (read way, content, file name), in the drive's order.
    let mut wanted: Vec<(String, String, String)> = Vec::new();
    let mut named = BTreeSet::new();
    let mut ways = BTreeSet::new();
    let mut beyond = 0usize;
    for item in items {
        if let Some(content) = &item.content {
            named.insert(content.clone());
            let way = read_way(content, sources::text_mode(&item.title));
            // A PDF takes a place only once a page has given its words.
            if ways.contains(&way) || (is_given(&way) && !kept.texts.contains(&way)) {
                continue;
            }
            if wanted.len() < MAX_TEXT_FILES {
                ways.insert(way.clone());
                wanted.push((way, content.clone(), item.title.clone()));
            } else {
                beyond += 1;
            }
        }
    }
    let mut next = kept.clone();
    let mut texts = Texts::new();

    // The words kept already, in one batch read (at most MAX_TEXT_FILES keys).
    let listed: Vec<&(String, String, String)> = wanted
        .iter()
        .filter(|(way, _, _)| kept.texts.contains(way))
        .collect();
    let own = |key: &str| format!("apps/spotlight/users/{principal}/{key}").into_bytes();
    let keys: Vec<Vec<u8>> = listed
        .iter()
        .map(|(way, _, _)| own(&text_key(way)))
        .collect();
    let answers = if keys.is_empty() {
        Vec::new()
    } else {
        read_all(cx, &keys).await?
    };
    for ((way, _, _), (bytes, _)) in listed.iter().zip(answers) {
        match bytes.and_then(|bytes| serde_json::from_slice::<String>(&bytes).ok()) {
            Some(text) => {
                texts.insert(way.clone(), text);
            }
            // Listed but gone (a lost race, or expired with a guest's data): read it again.
            None => {
                next.texts.remove(way);
            }
        }
    }

    // Up to NEW_TEXTS_PER_SEARCH new ones from the blob.
    let pending: Vec<(&(String, String, String), Option<u64>)> = wanted
        .iter()
        .filter(|(way, _, _)| !texts.contains_key(way))
        .map(|wish| (wish, kept.skipped.get(&wish.1).copied()))
        .collect();
    let now_ms = cx.now_ms;
    let (reads, mut indexing) = to_read(pending, now_ms, NEW_TEXTS_PER_SEARCH);
    let started_ms = cx.ctx.clock().now_ms_f64();
    for ((way, content, name), _) in reads {
        if cx.ctx.clock().now_ms_f64() - started_ms > NEW_TEXTS_BUDGET_MS {
            indexing = true;
            break;
        }
        let read = match cx.ctx.blob(super::super::files::BLOB_BINDING) {
            Ok(mut blobs) => blobs.get(&first_piece_key(content)).await,
            Err(error) => Err(error),
        };
        let bytes = match read {
            Ok(Some(bytes)) => bytes,
            failed => {
                if let Err(error) = failed {
                    ferrite_app::tracing::warn!(%error, "spotlight: a file could not be read");
                }
                next.skipped
                    .insert(content.clone(), now_ms.saturating_add(SKIPPED_RETRY_MS));
                continue;
            }
        };
        let text = sources::file_text(name, &bytes, FILE_TEXT_CHARS);
        match cx.storage.user().put_json(&text_key(way), &text).await {
            Ok(()) => {
                next.texts.insert(way.clone());
                next.skipped.remove(content);
            }
            Err(error) => {
                ferrite_app::tracing::warn!(%error, "spotlight: a file's words were not kept")
            }
        }
        texts.insert(way.clone(), text);
    }

    // Forget what no file reads any more, a few at a time.
    let stale: Vec<String> = next
        .texts
        .iter()
        .filter(|way| !ways.contains(*way))
        .take(FORGETS_PER_SEARCH)
        .cloned()
        .collect();
    for way in stale {
        match cx.storage.user().delete(&text_key(&way)).await {
            Ok(()) => {
                next.texts.remove(&way);
            }
            Err(error) => {
                ferrite_app::tracing::warn!(%error, "spotlight: a file's words were not forgotten")
            }
        }
    }
    next.skipped.retain(|content, _| named.contains(content));

    if next != kept {
        let bytes = serde_json::to_vec(&next).map_err(io::Error::other)?;
        match cx
            .storage
            .user()
            .put_if_version(KEPT_KEY, &bytes, kept_version)
            .await
        {
            Ok(true) => {}
            Ok(false) => {
                ferrite_app::tracing::debug!("spotlight: another search kept its list first")
            }
            Err(error) => {
                ferrite_app::tracing::warn!(%error, "spotlight: the list of kept words was not written")
            }
        }
    }
    Ok((texts, indexing, beyond))
}

/// The words of text files, by way of reading ([`read_way`]).
type Texts = BTreeMap<String, String>;

#[cfg(test)]
mod tests {
    use super::super::found;
    use super::super::sources::item;
    use super::*;

    #[test]
    fn given_words_are_made_one_run_and_cut_and_only_a_pdf_s_are_given() {
        assert_eq!(given_text(" Tide\n\n tables "), "Tide tables");
        assert_eq!(
            given_text(&"x".repeat(FILE_TEXT_CHARS + 9)).chars().count(),
            FILE_TEXT_CHARS
        );
        assert!(is_given(&read_way("c1", "pdf")));
        assert!(!is_given(&read_way("c1", "plain")));
    }

    /// The headers and bytes a search reads from a Mail of endless headers of
    /// `size` bytes each, and the pages it asks for.
    fn mail_scan_of(size: usize) -> (usize, usize, Vec<u32>) {
        let (mut read, mut bytes, mut pages) = (0usize, 0usize, Vec::new());
        loop {
            let page = mail_page(read, pages.len() as u32, bytes);
            if page == 0 {
                return (read, bytes, pages);
            }
            pages.push(page);
            read += page as usize;
            bytes += page as usize * size;
        }
    }

    #[test]
    fn the_mail_scan_reads_the_newest_headers_but_stops_near_its_bytes() {
        // Short headers: the newest MAIL_HEADERS, in growing pages.
        let (read, bytes, pages) = mail_scan_of(800);
        assert_eq!(read, MAIL_HEADERS);
        assert!(bytes < MAIL_SCAN_BYTES);
        assert_eq!(pages[0], 32, "a short Mail still costs one small page");
        assert!(pages.len() <= 6, "{pages:?}");
        // Long ones (English, other scripts, and the longest a header takes):
        // never more than one header past the bytes, which 200 of them would
        // pass four times over.
        for size in [4_500, 12_000, 24_000, MAIL_HEADER_BYTES] {
            let (read, bytes, pages) = mail_scan_of(size);
            assert!(
                bytes <= MAIL_SCAN_BYTES + size,
                "{size}: {bytes} in {pages:?}"
            );
            assert!(
                read == MAIL_HEADERS || bytes >= MAIL_SCAN_BYTES,
                "{size}: stopped early, at {read} headers and {bytes} bytes"
            );
        }
        assert!(MAIL_HEADERS * 24_000 > 4 * MAIL_SCAN_BYTES);
        // A page asks for one header at least while any bytes are left.
        assert_eq!(mail_page(10, 3, MAIL_SCAN_BYTES - 1), 1);
        assert_eq!(mail_page(10, 3, MAIL_SCAN_BYTES), 0);
        assert_eq!(mail_page(MAIL_HEADERS, 3, 0), 0);
    }

    #[test]
    fn the_words_of_one_content_are_kept_apart_for_each_way_it_is_read() {
        let bytes = b"<p>tulip</p>";
        let as_page = sources::file_text("a.html", bytes, FILE_TEXT_CHARS);
        let as_text = sources::file_text("a.txt", bytes, FILE_TEXT_CHARS);
        assert_eq!(as_page, "tulip");
        assert_eq!(as_text, "<p>tulip</p>");
        let (page, text) = (
            read_way("c1", sources::text_mode("a.html")),
            read_way("c1", sources::text_mode("a.txt")),
        );
        assert_ne!(
            page, text,
            "a rename to another kind reads the content again"
        );
        assert_eq!(text_key(&page), "text/markup/c1");
    }

    #[test]
    fn unavailable_files_are_skipped_and_later_files_still_get_indexed() {
        // The drive lists twelve files whose blobs are unavailable, then eight that are there.
        // Each search reads at most NEW_TEXTS_PER_SEARCH and records what it could not read as
        // skipped until SKIPPED_RETRY_MS later, as `file_texts` does.
        let available = |n: usize| n >= NEW_TEXTS_PER_SEARCH;
        let total = NEW_TEXTS_PER_SEARCH + 8;
        let mut indexed = BTreeSet::new();
        let mut skipped: BTreeMap<usize, u64> = BTreeMap::new();
        let mut search = |now: u64, indexed: &mut BTreeSet<usize>| {
            let pending = (0..total)
                .filter(|n| !indexed.contains(n))
                .map(|n| (n, skipped.get(&n).copied()))
                .collect();
            let (reads, left) = to_read(pending, now, NEW_TEXTS_PER_SEARCH);
            for (n, _) in reads {
                if available(n) {
                    indexed.insert(n);
                    skipped.remove(&n);
                } else {
                    skipped.insert(n, now + SKIPPED_RETRY_MS);
                }
            }
            left
        };
        // The first search spends its reads on the unavailable files, and says more are left.
        assert!(search(1_000, &mut indexed));
        assert!(indexed.is_empty());
        // The next one, a moment later, skips them and indexes every later file.
        assert!(!search(2_000, &mut indexed));
        assert_eq!(indexed, (NEW_TEXTS_PER_SEARCH..total).collect());
        // Once their retry time has come they are read again, after any file never tried.
        let (reads, _) = to_read(
            vec![(0, Some(1_000 + SKIPPED_RETRY_MS)), (99, None)],
            1_000 + SKIPPED_RETRY_MS,
            NEW_TEXTS_PER_SEARCH,
        );
        assert_eq!(reads, vec![(99, false), (0, true)]);
        // Before then a skipped file is not read at all.
        let (reads, left) = to_read(vec![(0, Some(5_000))], 4_999, NEW_TEXTS_PER_SEARCH);
        assert!(reads.is_empty() && !left);
    }

    #[test]
    fn a_bookmarked_page_is_found_by_its_visited_title_and_listed_once() {
        let url = "https://en.wikipedia.org/wiki/Tulip";
        let bookmark = item("web", "safari", url, "Flowers", url, &["Flowers", url]);
        let mut visit = item(
            "web",
            "safari",
            url,
            "Tulip - Wikipedia",
            url,
            &["Tulip - Wikipedia", url],
        );
        visit.at = Some(7);
        let other = item(
            "web",
            "safari",
            "https://example.com/",
            "Example",
            "",
            &["Example"],
        );
        let all = [bookmark, visit, other];
        let items = merged(all.iter());
        assert_eq!(items.len(), 2, "one page, one result");
        assert_eq!(items[0].title, "Flowers", "shown as the bookmark");
        assert_eq!(items[0].at, Some(7));
        let words = vec!["wikipedia".to_string()];
        let (hits, _) = found(items, &words);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].title, "Flowers", "found by the visited title");
    }
}

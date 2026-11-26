//! Safari's server half: it opens pages of the listed sites through the
//! application's `web` egress, and keeps the person's history, bookmarks,
//! Reading List and open tabs.
//!
//! A Ferrite application reaches the network only through egress handles
//! that name every destination in advance (`ferrite.json`). So Safari works in two
//! ways, which the window shows plainly:
//!
//! * a page of a **listed site** ([`policy::SITES`]: Wikipedia and its
//!   search, news, developer documentation, ...) is fetched here, made safe
//!   ([`rewrite`]) with its pictures and stylesheets fetched here too and put
//!   in, and shown in a sandboxed frame that makes no request of its own,
//!   with working links; its article is offered in Reader ([`reader`]);
//! * any **other** page is not fetched and not framed: the window says it
//!   opens outside Safari on Ferrite and offers a real browser tab.
//!
//! Every address the module fetches, a page's or a picture's, the first or a
//! redirect's, is judged by [`policy`] before anything is sent, and every
//! host's DNS addresses are checked before the first request to it
//! ([`check_addresses`]): nothing is fetched from a private, loopback,
//! link-local or metadata address.
//!
//! Routes, every reply `application/json`:
//!
//! * `GET /api/safari/sites`: `{"sites": [{"host", "title", "url"}],
//!   "search"}`, the listed sites and the search address the words follow.
//! * `GET /api/safari/page?url=<percent-encoded address>`: `{"ok": true,
//!   "url", "title", "html", "status", "bytes", "reader": [{"kind",
//!   "text"}] | null}` for a page that opened (`status` is the site's own,
//!   so a site's 404 page is shown as the site wrote it), or `{"ok": false,
//!   "kind", "host", "url", "message"}` for one that did not. A page that did
//!   not open is still answered 200: the request succeeded, the page did not.
//!   `kind` is `invalid`, `scheme`, `credentials`, `private`, `port` or
//!   `not-listed` ([`policy::Refusal`]), or `not-found` (the name does not
//!   resolve), `timeout`, `too-large` (over the platform's 1 MiB egress
//!   reply), `redirect` (a redirect whose target the body does not name:
//!   the platform hands an application no response headers), `unsupported`
//!   (not text) or `unreachable`. A `not-listed` page's name is looked up
//!   before the window offers it in a browser tab, for at most
//!   [`DNS_CHECK_MS`] ([`outside_verdict`]): a name that does not exist is
//!   answered `not-found`, one that resolves into a private network
//!   `private`, and otherwise the reply says `"checked": true`, or `false`
//!   when the resolver could not be asked in time. Only a missing or
//!   undecodable `url` is answered 400. Every page that opened is added to
//!   the history: by the module within the reply's budget, or else by the
//!   window, which the reply's `x-safari-history: skipped` header
//!   ([`HISTORY_HEADER`]) tells to add it (`POST /history`). With `&private=1`,
//!   a private window's request, nothing is added and the header says
//!   `private`. With `&reader=1`, for a reader of the article alone, the reply
//!   has no `html` and the page's pictures and stylesheets are not fetched.
//! * `GET /api/safari/file?url=<percent-encoded address>`: a file of a listed
//!   site, for the window to save into the person's Downloads folder
//!   through the drive (`/api/files`): `{"ok": true, "url", "name",
//!   "type", "size", "data"}` (`data` is base64), or `{"ok": false, "kind",
//!   "host", "url", "message"}` with the same kinds as a page: `too-large`
//!   for a file over the platform's 1 MiB egress reply ([`MAX_PAGE_BYTES`]),
//!   `not-listed` for a site the server may not reach.
//! * `GET /api/safari/history[?q=<words>]`: `{"history": [{"url", "title",
//!   "at", "count"}], "rev"}`, newest first, at most [`HISTORY`]; with `q`,
//!   only the visits whose title or address holds every word.
//!   `POST /api/safari/history` with `{"url", "title"}` adds a page the
//!   window opened in a browser tab (the server never saw it); `DELETE`
//!   forgets them all. `POST /api/safari/history/forget` with `{"urls":
//!   [address]}` forgets those pages, and with `{"since": <ms>}` every page
//!   last opened since then.
//! * `GET`, `PUT` and `DELETE /api/safari/bookmarks` (`{"favorites",
//!   "bookmarks"}`, each a list of `{"title", "url"}`), `/reading-list`
//!   (`{"items": [{"title", "url", "added", "read"}]}`) and `/tabs`
//!   (`{"tabs": [address], "active"}`): documents under the revision rule of
//!   `document.rs`, in the session's own space.
//!
//! Deadlines: the platform answers an API request that takes over 8 seconds
//! with a 504, and egress allows 10 seconds per call, so the module stops
//! fetching (the page, then its pictures and stylesheets) at
//! [`PAGE_BUDGET_MS`], answers `timeout` itself when the page did not
//! arrive by then, leaves out the assets it had no time for, and skips the
//! history and the log once [`REPLY_BUDGET_MS`] has passed.

pub mod policy;
pub mod reader;
pub mod rewrite;

use std::future::Future;
use std::io;
use std::task::Poll;

use ferrite_app::serde::de::DeserializeOwned;
use ferrite_app::serde::Serialize;
use ferrite_app::{serde, serde_json, EgressHeader, EgressHttpMethod, EgressOutcome};
use serde_json::Value;

use super::document;
use crate::applog::Level;
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};

pub const MODULE: AppModule = AppModule {
    name: "safari",
    title: "Safari",
    handle,
};

/// The egress handle `ferrite.json` declares for the listed sites and the
/// DNS resolver.
pub const EGRESS: &str = "web";
/// How long the module works on fetching one page (DNS, the page, its
/// redirects) before it answers `timeout`.
pub const PAGE_BUDGET_MS: u64 = 6_000;
/// The time since a page request began after which no more of its pictures
/// and stylesheets are fetched: writing a large page out takes up to two
/// seconds more, and a reply past the window's deadline shows nothing at all.
pub const ASSETS_BUDGET_MS: u64 = 4_000;
/// How long a page request may take in all before the module answers, the
/// history and the log included: under the platform's 8-second API deadline,
/// with room for the router's own bookkeeping and the reply. Work left when
/// it runs out (adding the page to the history, a log line) is skipped.
pub const REPLY_BUDGET_MS: u64 = 7_000;
/// The most redirects followed for one page or asset.
pub const MAX_REDIRECTS: usize = 3;
/// The platform's largest egress reply (`MAX_EGRESS_FRAME`).
pub const MAX_PAGE_BYTES: usize = 1024 * 1024;
/// The largest picture or stylesheet put in a page.
pub const MAX_ASSET_BYTES: usize = 512 * 1024;
/// The most bytes of pictures and stylesheets one page takes in all, before
/// their `data:` encoding.
pub const MAX_ASSETS_BYTES: usize = 1024 * 1024;
/// The least time left of the page's budget worth starting another asset.
const ASSET_MIN_MS: u64 = 300;
/// The longest the module waits for the DNS lookup of a page off the list
/// before the window offers it in a browser tab: a slow resolver never holds
/// the window, and the tab is then offered as not checked.
pub const DNS_CHECK_MS: u64 = 2_500;
/// The header of a page reply that says whether the module kept the visit in
/// the history (`kept`), or had no time left in the reply's budget to
/// (`skipped`): the window then keeps it itself (`POST /history`, which has a
/// request's whole budget), so no page that opened is missing from History.
pub const HISTORY_HEADER: &str = "x-safari-history";
/// The most visits the history keeps.
pub const HISTORY: usize = 300;
/// The most links in a bookmarks list, items in the Reading List, and tabs.
pub const MAX_LINKS: usize = 500;
/// The most bookmark folders.
pub const MAX_FOLDERS: usize = 100;
pub const MAX_TABS: usize = 50;
/// The longest title kept.
pub const MAX_TITLE: usize = 300;
/// How the module introduces itself to the sites it fetches from.
pub const USER_AGENT: &str =
    "MacaliciousSafari/1.0 (Ferrite demo; +https://macalicious.ferrite.run/)";

const HISTORY_KEY: &str = "history";

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    let outcome = match (cx.request.method, cx.request.path) {
        ("GET", "/sites") => Ok(Response::json(200, &sites())),
        ("GET", "/page") => {
            let raw = cx.request.query_param("url").unwrap_or("");
            let private = cx.request.query_param("private").is_some();
            let reader_only = cx.request.query_param("reader").is_some();
            match super::spotlight::decode(raw) {
                Some(text) if !text.trim().is_empty() => {
                    Ok(open(&mut cx, &text, private, reader_only).await)
                }
                Some(_) => Ok(Response::error(400, "the url parameter names no address")),
                None => Ok(Response::error(
                    400,
                    "the url parameter is not valid percent-encoded UTF-8",
                )),
            }
        }
        ("GET", "/file") => {
            let raw = cx.request.query_param("url").unwrap_or("");
            match super::spotlight::decode(raw) {
                Some(text) if !text.trim().is_empty() => Ok(download(&mut cx, &text).await),
                Some(_) => Ok(Response::error(400, "the url parameter names no address")),
                None => Ok(Response::error(
                    400,
                    "the url parameter is not valid percent-encoded UTF-8",
                )),
            }
        }
        ("GET", "/suggest") => {
            let raw = cx.request.query_param("q").unwrap_or("");
            let words = super::spotlight::decode(raw).unwrap_or_default();
            Ok(suggest(&mut cx, &words).await)
        }
        ("POST", "/file-page") => Ok(file_page(&cx)),
        ("GET", "/history") => history(&mut cx).await,
        ("POST", "/history") => add_visit(&mut cx).await,
        ("POST", "/history/forget") => forget_visits(&mut cx).await,
        ("DELETE", "/history") => {
            document::write::<Vec<Visit>>(&mut cx.storage.user(), HISTORY_KEY, None, None)
                .await
                .map(|saved| document::answer(saved, None, history_reply))
        }
        (_, "/bookmarks") => keep::<Library>(&mut cx).await,
        (_, "/reading-list") => keep::<ReadingList>(&mut cx).await,
        (_, "/tabs") => keep::<Tabs>(&mut cx).await,
        (
            _,
            "/sites" | "/page" | "/file" | "/suggest" | "/file-page" | "/history"
            | "/history/forget",
        ) => Ok(Response::method_not_allowed()),
        _ => Ok(Response::not_found()),
    };
    outcome.unwrap_or_else(|error| Response::error(503, &format!("storage failed: {error}")))
}

/// The `GET /sites` body.
pub fn sites() -> Value {
    let sites: Vec<Value> = policy::SITES
        .iter()
        .map(|site| {
            serde_json::json!({
                "host": site.host,
                "title": site.title,
                "url": format!("https://{}{}", site.host, site.home),
            })
        })
        .collect();
    serde_json::json!({ "sites": sites, "search": policy::SEARCH })
}

// ── Opening a page ──

/// Why a page did not open.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Failure {
    pub kind: &'static str,
    pub host: Option<String>,
    pub message: String,
}

impl Failure {
    fn new(kind: &'static str, host: &str, message: impl Into<String>) -> Self {
        Failure {
            kind,
            host: Some(host.to_string()),
            message: message.into(),
        }
    }

    fn timeout(host: &str) -> Self {
        Failure::new("timeout", host, "the server did not answer in time")
    }
}

impl From<policy::Refusal> for Failure {
    fn from(refusal: policy::Refusal) -> Self {
        Failure {
            kind: refusal.kind(),
            host: refusal.host().map(str::to_string),
            message: refusal.message(),
        }
    }
}

/// A page that opened.
#[derive(Debug)]
struct Loaded {
    url: String,
    title: String,
    html: String,
    status: u16,
    bytes: usize,
    reader: Option<Vec<reader::Block>>,
}

/// A page rewritten, its pictures and stylesheets not yet fetched.
#[derive(Debug)]
struct Prepared {
    url: String,
    title: String,
    page: rewrite::Page,
    status: u16,
    bytes: usize,
    reader: Option<Vec<reader::Block>>,
}

async fn open(cx: &mut ApiCtx<'_>, text: &str, private: bool, reader_only: bool) -> Response {
    let started = cx.now_ms;
    let host = policy::parse(text)
        .map(|url| url.host_text())
        .unwrap_or_default();
    // The hosts whose addresses this request has checked.
    let mut checked: Vec<String> = Vec::new();
    // `fetch` bounds each network wait by the budget; this bounds the whole,
    // whatever else it awaits.
    let fetched = within(PAGE_BUDGET_MS, load(cx, text, started, &mut checked))
        .await
        .unwrap_or_else(|| Err(Failure::timeout(&host)));
    let loaded = match fetched.and_then(|(url, status, body)| prepare(&url, status, body)) {
        Ok(prepared) if reader_only => reader_reply(prepared, &host),
        Ok(prepared) => {
            let assets = fetch_assets(cx, &prepared.page.assets, started, &mut checked).await;
            finish(prepared, &assets, &host)
        }
        Err(failure) => Err(failure),
    };
    // What is left of the reply's budget, for the work after the page.
    let left =
        |cx: &ApiCtx<'_>| REPLY_BUDGET_MS.saturating_sub(cx.ctx.now_ms().saturating_sub(started));
    match loaded {
        Ok((page, body)) => {
            if private {
                return Response::new(200, body)
                    .add_header("content-type", "application/json")
                    .add_header(HISTORY_HEADER, "private");
            }
            let budget = left(cx);
            // A visit the module has no time to keep is kept by the window
            // instead, told by the reply's [`HISTORY_HEADER`].
            let kept = match within(budget, remember(cx, &page.url, &page.title)).await {
                Some(Ok(())) => true,
                Some(Err(error)) => {
                    ferrite_app::tracing::warn!(%error, "could not add the page to the history");
                    false
                }
                None => {
                    ferrite_app::tracing::warn!("no time left to add the page to the history");
                    false
                }
            };
            Response::new(200, body)
                .add_header("content-type", "application/json")
                .add_header(HISTORY_HEADER, if kept { "kept" } else { "skipped" })
        }
        Err(failure) => {
            // A page off the list is offered in a browser tab of the
            // visitor's own only once its name is known to resolve to public
            // addresses, or could not be checked in time (`checked` says
            // which): a name that does not exist, or one that resolves into a
            // private network, is answered as such instead.
            let (failure, checked) = if failure.kind == "not-listed" {
                match look_up_outside(cx, text, started).await {
                    Ok(checked) => (failure, Some(checked)),
                    Err(found) => (found, None),
                }
            } else {
                (failure, None)
            };
            // The kind only: the log is shared by every session, and holds
            // nothing a person typed.
            if failure.kind != "not-listed" {
                let budget = left(cx);
                let message = format!("a page did not open ({})", failure.kind);
                if within(budget, cx.log(Level::Info, "page", &message))
                    .await
                    .is_none()
                {
                    ferrite_app::tracing::warn!("no time left to log a page that did not open");
                }
            }
            Response::json(
                200,
                &serde_json::json!({
                    "ok": false,
                    "kind": failure.kind,
                    "host": failure.host,
                    "url": text,
                    "message": failure.message,
                    "checked": checked,
                }),
            )
        }
    }
}

/// The page with what was fetched of its assets, and its reply, written out
/// before anything is kept of the page. When the reply would pass the
/// platform's cap with the assets, the page goes without them; a page whose
/// reply passes it even so is answered too-large.
fn finish(
    page: Prepared,
    fetched: &[Option<String>],
    host: &str,
) -> Result<(Loaded, Vec<u8>), Failure> {
    let mut loaded = Loaded {
        url: page.url,
        title: page.title,
        // Built within the reply's budget: past it, the page goes without
        // its assets, before anything larger is allocated.
        html: page
            .page
            .html_within(fetched, MAX_REPLY_BYTES)
            .unwrap_or_else(|| page.page.html(&[])),
        status: page.status,
        bytes: page.bytes,
        reader: page.reader,
    };
    match page_reply(&loaded, host) {
        Ok(body) => Ok((loaded, body)),
        Err(failure) if failure.kind == "too-large" && fetched.iter().any(Option::is_some) => {
            loaded.html = page.page.html(&[]);
            page_reply(&loaded, host).map(|body| (loaded, body))
        }
        Err(failure) => Err(failure),
    }
}

/// The largest page reply, in bytes: the platform carries about 4 MiB of
/// reply body.
pub const MAX_REPLY_BYTES: usize = 3 * 1024 * 1024;

/// How many search suggestions a reply holds, and the longest text asked about.
pub const MAX_SUGGESTIONS: usize = 5;
const MAX_SUGGESTED_WORDS: usize = 200;
/// How long a suggestion may take: a person is typing.
const SUGGEST_BUDGET_MS: u64 = 2_000;

/// `GET /suggest`: what Wikipedia, the one search Safari has here, suggests for
/// the words. A reply with none when it does not answer: suggestions are a help
/// to typing, never a failure to report.
async fn suggest(cx: &mut ApiCtx<'_>, words: &str) -> Response {
    let words = words.trim();
    let mut found = Vec::new();
    if !words.is_empty() && words.len() <= MAX_SUGGESTED_WORDS {
        let address = format!(
            "https://en.wikipedia.org/w/api.php?action=opensearch&format=json&namespace=0&limit={MAX_SUGGESTIONS}&search={}",
            policy::encode_component(words)
        );
        let started = cx.now_ms;
        let mut checked = Vec::new();
        let judge = |text: &str| policy::judge(text).map(|target| target.url);
        let accept = "application/json";
        let reply = within(
            SUGGEST_BUDGET_MS,
            fetch(cx, &address, judge, accept, started, &mut checked),
        )
        .await;
        if let Some(Ok((_, 200, body))) = reply {
            found = suggestions_of(&body);
        }
    }
    Response::json(200, &serde_json::json!({ "suggestions": found }))
}

/// The titles of an OpenSearch answer, `[words, [title, ...], ...]`.
pub fn suggestions_of(body: &[u8]) -> Vec<String> {
    serde_json::from_slice::<Value>(body)
        .ok()
        .and_then(|answer| {
            answer.get(1)?.as_array().map(|titles| {
                titles
                    .iter()
                    .filter_map(Value::as_str)
                    .take(MAX_SUGGESTIONS)
                    .map(str::to_string)
                    .collect()
            })
        })
        .unwrap_or_default()
}

/// The address a person's own HTML file is made safe under: its relative links
/// and pictures resolve here, and nothing is ever fetched from it.
const FILE_BASE: &str = "https://file.invalid/";

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct FilePageBody {
    html: String,
}

/// `POST /file-page`: a person's own HTML file, made safe as a fetched page is,
/// and shown in the same frame. No picture or stylesheet of it is fetched.
fn file_page(cx: &ApiCtx<'_>) -> Response {
    let body: FilePageBody = match cx.request.json() {
        Ok(body) => body,
        Err(response) => return response,
    };
    match file_page_reply(body.html.into_bytes()) {
        Ok(reply) => Response::new(200, reply).add_header("content-type", "application/json"),
        Err(failure) => Response::json(
            200,
            &serde_json::json!({
                "ok": false,
                "kind": failure.kind,
                "host": failure.host,
                "message": failure.message,
            }),
        ),
    }
}

/// The JSON reply for a file's page: its title is empty when the file names none.
pub fn file_page_reply(html: Vec<u8>) -> Result<Vec<u8>, Failure> {
    let base = policy::parse(FILE_BASE)
        .map_err(|_| Failure::new("unreachable", "", "the file's address could not be read"))?;
    let mut prepared = prepare(&base, 200, html)?;
    if prepared.page.title.is_none() {
        prepared.title = String::new();
    }
    finish(prepared, &[], "").map(|(_, reply)| reply)
}

/// The JSON reply for a page that opened, or `too-large` when it would pass
/// [`MAX_REPLY_BYTES`] once written out (escaping can multiply a page's
/// size: a control character takes six bytes).
fn page_reply(page: &Loaded, host: &str) -> Result<Vec<u8>, Failure> {
    written_reply(
        &serde_json::json!({
            "ok": true,
            "url": page.url,
            "title": page.title,
            "html": page.html,
            "status": page.status,
            "bytes": page.bytes,
            "reader": page.reader,
        }),
        host,
    )
}

/// The page's article and what is known of it, with no `html` for a window that only reads.
fn reader_reply(page: Prepared, host: &str) -> Result<(Loaded, Vec<u8>), Failure> {
    let body = written_reply(
        &serde_json::json!({
            "ok": true,
            "url": page.url,
            "title": page.title,
            "status": page.status,
            "bytes": page.bytes,
            "reader": page.reader,
        }),
        host,
    )?;
    Ok((
        Loaded {
            url: page.url,
            title: page.title,
            html: String::new(),
            status: page.status,
            bytes: page.bytes,
            reader: page.reader,
        },
        body,
    ))
}

fn written_reply(reply: &Value, host: &str) -> Result<Vec<u8>, Failure> {
    let body = serde_json::to_vec(reply).map_err(|error| {
        Failure::new(
            "unreachable",
            host,
            format!("the page could not be written out: {error}"),
        )
    })?;
    if body.len() > MAX_REPLY_BYTES {
        return Err(Failure::new(
            "too-large",
            host,
            "the page is too large to send to the window once written out",
        ));
    }
    Ok(body)
}

/// Run `work` for at most `ms`: its output, or `None` when time ran out.
/// (Upstream Core's SDK has no egress deadline of its own.) Boxed rather than
/// pinned with `pin!`, which is not one of the macros the hosted gate admits.
pub async fn within<F: Future>(ms: u64, work: F) -> Option<F::Output> {
    let mut work = Box::pin(work);
    let mut timer = Box::pin(ferrite_app::sleep_ms(ms));
    std::future::poll_fn(move |context| {
        if let Poll::Ready(output) = work.as_mut().poll(context) {
            return Poll::Ready(Some(output));
        }
        if timer.as_mut().poll(context).is_ready() {
            return Poll::Ready(None);
        }
        Poll::Pending
    })
    .await
}

/// The time left of the page's budget.
fn remaining(cx: &ApiCtx<'_>, started: u64, host: &str) -> Result<u64, Failure> {
    let spent = cx.ctx.now_ms().saturating_sub(started);
    PAGE_BUDGET_MS
        .checked_sub(spent)
        .filter(|left| *left > 0)
        .ok_or_else(|| Failure::timeout(host))
}

/// Whether an egress call failed before anything was sent because the
/// connection took too long. Forge allows every connection a fixed 2 seconds
/// (`egress deadline exceeded; phase=connect; budget_ms=2000`), which a site
/// that answers in 0.3 seconds misses about one call in eight under `ferrite
/// dev`, so the caller tries again for as long as the page's budget lasts.
fn connect_timed_out<T>(attempt: &Result<T, io::Error>) -> bool {
    matches!(attempt, Err(error) if error.to_string().contains("phase=connect"))
}

/// Fetch a page: its address judged as a page (a listed site; another is
/// `not-listed`, which the window offers in a browser tab).
async fn load(
    cx: &mut ApiCtx<'_>,
    text: &str,
    started: u64,
    checked: &mut Vec<String>,
) -> Result<(policy::Parsed, u16, Vec<u8>), Failure> {
    let accept = "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5";
    let judge = |text: &str| policy::judge(text).map(|target| target.url);
    fetch(cx, text, judge, accept, started, checked).await
}

/// Fetch `text` through the `web` egress, following redirects whose body
/// names their target. Every address, the first and each redirect's, is
/// judged by `judge` before anything is sent to it, and every host's DNS
/// addresses are checked before the first request to it (`checked` holds the
/// hosts this request has checked; the platform's egress checks the address
/// it connects to once more). The address that answered, its status and body.
async fn fetch(
    cx: &mut ApiCtx<'_>,
    text: &str,
    judge: fn(&str) -> Result<policy::Parsed, policy::Refusal>,
    accept: &str,
    started: u64,
    checked: &mut Vec<String>,
) -> Result<(policy::Parsed, u16, Vec<u8>), Failure> {
    let mut url = judge(text)?;
    for _ in 0..=MAX_REDIRECTS {
        let host = url.host_text();
        if !checked.contains(&host) {
            check_addresses(cx, &host, started).await?;
            checked.push(host.clone());
        }
        let handle = super::egress::pick(EGRESS, &url.address());
        let mut egress = cx.ctx.egress(handle).map_err(|error| {
            Failure::new(
                "unreachable",
                &host,
                format!("this application has no web egress: {error}"),
            )
        })?;
        let headers = [
            EgressHeader {
                name: "user-agent".into(),
                value: USER_AGENT.into(),
            },
            EgressHeader {
                name: "accept".into(),
                value: accept.into(),
            },
            EgressHeader {
                name: "accept-language".into(),
                value: "en".into(),
            },
        ];
        let address = url.address();
        let outcome = loop {
            let left = remaining(cx, started, &host)?;
            let attempt = within(
                left,
                egress.deliver_http(EgressHttpMethod::Get, &address, &headers, &[]),
            )
            .await
            .ok_or_else(|| Failure::timeout(&host))?;
            if !connect_timed_out(&attempt) {
                break attempt;
            }
        };
        match outcome {
            Ok(EgressOutcome::Delivered { status, body })
                if matches!(status, 301 | 302 | 303 | 307 | 308) =>
            {
                let next = policy::redirect_target(&body)
                    .and_then(|named| match policy::resolve(&url, &named) {
                        Some(policy::Resolved::Web(next)) => Some(next),
                        _ => None,
                    })
                    .ok_or_else(|| {
                        Failure::new(
                            "redirect",
                            &host,
                            format!(
                                "the site answered HTTP {status} without naming the new address"
                            ),
                        )
                    })?;
                url = judge(&next)?;
            }
            Ok(EgressOutcome::Delivered { status, body }) => return Ok((url, status, body)),
            Ok(EgressOutcome::Denied { reason }) => return Err(denied(&host, &reason)),
            Err(error) => return Err(egress_error(&host, &error)),
        }
    }
    Err(Failure::new(
        "redirect",
        &url.host_text(),
        "the site redirected too many times",
    ))
}

/// Fetch a page's pictures and stylesheets, in the page's order, through
/// [`fetch`] with [`policy::judge_asset`]: each one's `data:` address or safe
/// stylesheet, or `None` for one that failed, was refused, or was left out
/// because the page's budget of time ([`ASSETS_BUDGET_MS`]) or bytes
/// ([`MAX_ASSETS_BYTES`]) ran out.
async fn fetch_assets(
    cx: &mut ApiCtx<'_>,
    assets: &[rewrite::Asset],
    started: u64,
    checked: &mut Vec<String>,
) -> Vec<Option<String>> {
    let mut fetched = Vec::with_capacity(assets.len());
    let mut total = 0usize;
    for asset in assets {
        let left = ASSETS_BUDGET_MS.saturating_sub(cx.ctx.now_ms().saturating_sub(started));
        if left < ASSET_MIN_MS || total >= MAX_ASSETS_BYTES {
            break;
        }
        match within(left, fetch_asset(cx, asset, started, checked)).await {
            None => break,
            Some(Ok((value, bytes))) if total + bytes <= MAX_ASSETS_BYTES => {
                total += bytes;
                fetched.push(Some(value));
            }
            Some(_) => fetched.push(None),
        }
    }
    fetched.resize(assets.len(), None);
    fetched
}

/// One picture as a `data:` address, or one stylesheet made safe
/// ([`rewrite::style_block`]), and its size as fetched.
async fn fetch_asset(
    cx: &mut ApiCtx<'_>,
    asset: &rewrite::Asset,
    started: u64,
    checked: &mut Vec<String>,
) -> Result<(String, usize), Failure> {
    let accept = match asset.kind {
        rewrite::AssetKind::Image => "image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8",
        rewrite::AssetKind::Style => "text/css,*/*;q=0.1",
    };
    let (url, status, body) = fetch(
        cx,
        &asset.url,
        policy::judge_asset,
        accept,
        started,
        checked,
    )
    .await?;
    asset_value(asset.kind, &url.host_text(), status, &body)
}

/// What a fetched asset becomes: a picture's `data:` address (its type read
/// from its bytes, since the platform hands an application no response
/// headers; anything that is not a picture is refused), or a stylesheet made
/// safe. Its size as fetched beside it.
pub fn asset_value(
    kind: rewrite::AssetKind,
    host: &str,
    status: u16,
    body: &[u8],
) -> Result<(String, usize), Failure> {
    if !(200..300).contains(&status) {
        return Err(Failure::new(
            "unreachable",
            host,
            format!("the site answered HTTP {status}"),
        ));
    }
    if body.len() > MAX_ASSET_BYTES {
        return Err(Failure::new("too-large", host, "the asset is too large"));
    }
    let unsupported = || Failure::new("unsupported", host, "not a picture or stylesheet");
    let value = match kind {
        rewrite::AssetKind::Image => {
            let mime = image_type(body).ok_or_else(unsupported)?;
            format!("data:{mime};base64,{}", rewrite::base64(body))
        }
        rewrite::AssetKind::Style => {
            if body.contains(&0) {
                return Err(unsupported());
            }
            let text = String::from_utf8_lossy(body);
            rewrite::style_block(text.trim_start_matches('\u{feff}')).ok_or_else(unsupported)?
        }
    };
    Ok((value, body.len()))
}

/// The type of a picture, read from its first bytes: PNG, JPEG, GIF, WebP,
/// AVIF, ICO or SVG (an SVG in an `<img>` runs no script and loads nothing).
pub fn image_type(bytes: &[u8]) -> Option<&'static str> {
    let at = |range: std::ops::Range<usize>| bytes.get(range).unwrap_or(&[]);
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some("image/png")
    } else if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        Some("image/jpeg")
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        Some("image/gif")
    } else if at(0..4) == b"RIFF" && at(8..12) == b"WEBP" {
        Some("image/webp")
    } else if at(4..8) == b"ftyp" && matches!(at(8..12), b"avif" | b"avis") {
        Some("image/avif")
    } else if bytes.starts_with(&[0, 0, 1, 0]) {
        Some("image/x-icon")
    } else {
        let start = String::from_utf8_lossy(&bytes[..bytes.len().min(1024)]).to_ascii_lowercase();
        let start = start.trim_start_matches(['\u{feff}', ' ', '\t', '\n', '\r']);
        let markup = start.starts_with("<?xml")
            || start.starts_with("<!--")
            || start.starts_with("<!doctype svg");
        (start.starts_with("<svg") || (markup && start.contains("<svg"))).then_some("image/svg+xml")
    }
}

/// What a refusal by the platform's egress means for the page.
pub fn denied(host: &str, reason: &str) -> Failure {
    let lower = reason.to_ascii_lowercase();
    if ["loopback", "private", "fabric", "internal", "link-local"]
        .iter()
        .any(|word| lower.contains(word))
    {
        Failure::new(
            "private",
            host,
            format!("egress refused a private address: {reason}"),
        )
    } else if ["scope", "permit", "declare"]
        .iter()
        .any(|word| lower.contains(word))
    {
        Failure::new(
            "not-listed",
            host,
            format!("egress does not reach this site: {reason}"),
        )
    } else {
        Failure::new(
            "unreachable",
            host,
            format!("egress refused the request: {reason}"),
        )
    }
}

/// What a failed egress call means for the page.
pub fn egress_error(host: &str, error: &io::Error) -> Failure {
    let message = error.to_string();
    let lower = message.to_ascii_lowercase();
    if lower.contains("exceeds the cap") {
        Failure::new(
            "too-large",
            host,
            "the page is larger than the 1 MB a Ferrite application can fetch",
        )
    } else if error.kind() == io::ErrorKind::TimedOut
        || ["timed out", "timeout", "deadline"]
            .iter()
            .any(|w| lower.contains(w))
    {
        Failure::timeout(host)
    } else if lower.contains("did not resolve")
        || lower.contains("no such host")
        || error.kind() == io::ErrorKind::NotFound
    {
        Failure::new("not-found", host, "the server's name could not be found")
    } else if lower.contains("loopback") || lower.contains("private") {
        Failure::new("private", host, message)
    } else {
        Failure::new(
            "unreachable",
            host,
            format!("the server could not be reached: {message}"),
        )
    }
}

/// The page as the frame shows it, but for its assets, or why it cannot be
/// shown.
fn prepare(url: &policy::Parsed, status: u16, body: Vec<u8>) -> Result<Prepared, Failure> {
    let host = url.host_text();
    let host = host.as_str();
    if body.len() > MAX_PAGE_BYTES {
        return Err(Failure::new(
            "too-large",
            host,
            "the page is larger than the 1 MB a Ferrite application can fetch",
        ));
    }
    let bytes = body.len();
    if body.iter().take(4096).any(|b| *b == 0) {
        return Err(Failure::new(
            "unsupported",
            host,
            "the address is a file Safari cannot show",
        ));
    }
    let text = String::from_utf8_lossy(&body);
    let (page, reader) = if rewrite::is_markup(&text) {
        let page = rewrite::render(&text, url);
        // Reader only for a page that will be shown.
        let blocks = if page.is_some() {
            reader::extract(&text)
        } else {
            Vec::new()
        };
        (page, reader::readable(&blocks).then_some(blocks))
    } else {
        (rewrite::text_page(&text, url), None)
    };
    let page = page.ok_or_else(|| {
        Failure::new(
            "too-large",
            host,
            "the page is too large to show once its links are written out in full",
        )
    })?;
    let title = page.title.clone().unwrap_or_else(|| host.to_string());
    Ok(Prepared {
        url: url.display(),
        title,
        page,
        status,
        bytes,
        reader,
    })
}

/// The status and the `A` and `AAAA` addresses of a resolver's JSON answer.
pub fn dns_addresses(body: &[u8]) -> Option<(u64, Vec<String>)> {
    let answer: Value = serde_json::from_slice(body).ok()?;
    let status = answer.get("Status")?.as_u64()?;
    let addresses = answer
        .get("Answer")
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or(&[])
        .iter()
        .filter(|record| matches!(record.get("type").and_then(Value::as_u64), Some(1 | 28)))
        .filter_map(|record| record.get("data")?.as_str().map(str::to_string))
        .collect();
    Some((status, addresses))
}

/// Ask DNS for a host's addresses and refuse the page when one is not
/// public. The platform's egress checks the addresses it connects to again,
/// so a name that changes its answer in between is still refused there.
async fn check_addresses(cx: &mut ApiCtx<'_>, host: &str, started: u64) -> Result<(), Failure> {
    let handle = super::egress::pick(EGRESS, policy::RESOLVER);
    let mut egress = cx.ctx.egress(handle).map_err(|error| {
        Failure::new(
            "unreachable",
            host,
            format!("this application has no web egress: {error}"),
        )
    })?;
    let accept = [EgressHeader {
        name: "accept".into(),
        value: "application/dns-json".into(),
    }];
    let mut addresses = Vec::new();
    for kind in ["A", "AAAA"] {
        let destination = format!("{}?name={host}&type={kind}", policy::RESOLVER);
        let outcome = loop {
            let left = remaining(cx, started, host)?;
            let attempt = within(
                left,
                egress.deliver_http(EgressHttpMethod::Get, &destination, &accept, &[]),
            )
            .await
            .ok_or_else(|| Failure::timeout(host))?;
            if !connect_timed_out(&attempt) {
                break attempt;
            }
        };
        let body = match outcome {
            Ok(EgressOutcome::Delivered { status: 200, body }) => body,
            Ok(EgressOutcome::Delivered { status, .. }) => {
                return Err(Failure::new(
                    "unreachable",
                    host,
                    format!("the DNS resolver answered HTTP {status}"),
                ))
            }
            Ok(EgressOutcome::Denied { reason }) => {
                return Err(Failure::new(
                    "unreachable",
                    host,
                    format!("egress refused the DNS resolver: {reason}"),
                ))
            }
            Err(error) => {
                let failure = egress_error(host, &error);
                return Err(if failure.kind == "timeout" {
                    failure
                } else {
                    Failure::new(
                        "unreachable",
                        host,
                        format!("the DNS resolver could not be reached: {error}"),
                    )
                });
            }
        };
        let (status, mut found) = dns_addresses(&body).ok_or_else(|| {
            Failure::new(
                "unreachable",
                host,
                "the DNS resolver's answer is not DNS JSON",
            )
        })?;
        match status {
            0 => addresses.append(&mut found),
            3 => {
                return Err(Failure::new(
                    "not-found",
                    host,
                    "the server's name could not be found",
                ))
            }
            other => {
                return Err(Failure::new(
                    "unreachable",
                    host,
                    format!("DNS answered response code {other}"),
                ))
            }
        }
    }
    if addresses.is_empty() {
        return Err(Failure::new(
            "not-found",
            host,
            "the server's name has no address",
        ));
    }
    policy::judge_addresses(host, &addresses).map_err(Failure::from)
}

/// Look up the name of a page off the list before the window offers it in a
/// browser tab, through the same resolver and checks as a listed site's
/// ([`check_addresses`]), for at most [`DNS_CHECK_MS`]. An address literal
/// needs no lookup: [`policy::judge`] has already refused a private one.
async fn look_up_outside(cx: &mut ApiCtx<'_>, text: &str, started: u64) -> Result<bool, Failure> {
    let Ok(url) = policy::parse(text) else {
        return Ok(false);
    };
    let name = match &url.host {
        policy::Host::Name(name) => name.clone(),
        policy::Host::V4(_) | policy::Host::V6(_) => return Ok(true),
    };
    let looked_up = within(DNS_CHECK_MS, check_addresses(cx, &name, started)).await;
    outside_verdict(looked_up)
}

/// What the lookup of a page off the list means for the window. `Ok(true)`:
/// every address is public, so the page is offered in a browser tab.
/// `Ok(false)`: the resolver could not be asked, failed, or took longer than
/// [`DNS_CHECK_MS`] (`None`), so the tab is still offered and the window says
/// the address was not checked. The failure itself when the name does not
/// exist (`not-found`) or resolves into a private network (`private`): no
/// tab is offered then, since the visitor's browser would fail, or would
/// reach into its own network.
pub fn outside_verdict(looked_up: Option<Result<(), Failure>>) -> Result<bool, Failure> {
    match looked_up {
        Some(Ok(())) => Ok(true),
        Some(Err(failure)) if matches!(failure.kind, "not-found" | "private") => Err(failure),
        Some(Err(_)) | None => Ok(false),
    }
}

// ── Downloading a linked file ──

/// The longest name a downloaded file is given, in UTF-8 bytes: under the
/// drive's 255 (`files::drive::MAX_NAME_BYTES`), with room for the " 2" the
/// drive adds when the Downloads folder already has the name.
pub const MAX_FILE_NAME_BYTES: usize = 200;

/// Fetch a file of a listed site for the window to save into the person's
/// Downloads folder: judged and fetched exactly as a page is ([`fetch`]:
/// listed sites only, every host's addresses checked, redirects whose body
/// names them), within [`PAGE_BUDGET_MS`].
async fn download(cx: &mut ApiCtx<'_>, text: &str) -> Response {
    let started = cx.now_ms;
    let host = policy::parse(text)
        .map(|url| url.host_text())
        .unwrap_or_default();
    let mut checked: Vec<String> = Vec::new();
    let judge = |text: &str| policy::judge(text).map(|target| target.url);
    let fetched = within(
        PAGE_BUDGET_MS,
        fetch(cx, text, judge, "*/*", started, &mut checked),
    )
    .await
    .unwrap_or_else(|| Err(Failure::timeout(&host)));
    match fetched.and_then(|(url, status, body)| file_reply(&url, status, &body)) {
        Ok(reply) => Response::json(200, &reply),
        Err(failure) => Response::json(
            200,
            &serde_json::json!({
                "ok": false,
                "kind": failure.kind,
                "host": failure.host,
                "url": text,
                "message": failure.message,
            }),
        ),
    }
}

/// The reply for a fetched file: its name, type, size and bytes, or why it
/// cannot be saved (a status other than 2xx, or over the platform's cap).
pub fn file_reply(url: &policy::Parsed, status: u16, body: &[u8]) -> Result<Value, Failure> {
    let host = url.host_text();
    if !(200..300).contains(&status) {
        return Err(Failure::new(
            "unreachable",
            &host,
            format!("the site answered HTTP {status}"),
        ));
    }
    if body.len() > MAX_PAGE_BYTES {
        return Err(Failure::new(
            "too-large",
            &host,
            "the file is larger than the 1 MB a Ferrite application can fetch",
        ));
    }
    let name = file_name(url);
    let mime = file_type(&name, body);
    Ok(serde_json::json!({
        "ok": true,
        "url": url.display(),
        "name": name,
        "type": mime,
        "size": body.len(),
        "data": rewrite::base64(body),
    }))
}

/// A downloaded file's name: the address's last path segment, decoded, with
/// anything a file name cannot hold replaced, at most
/// [`MAX_FILE_NAME_BYTES`] of UTF-8 (cut on a character boundary, its
/// extension kept), or `download` when the address names none.
pub fn file_name(url: &policy::Parsed) -> String {
    let last = url.path.rsplit('/').next().unwrap_or("");
    let decoded = String::from_utf8_lossy(&percent_decode(last)).into_owned();
    let cleaned: String = decoded
        .chars()
        .map(|c| {
            if c.is_control() || matches!(c, '/' | '\\' | ':') {
                '_'
            } else {
                c
            }
        })
        .collect();
    let cleaned = cleaned.trim().trim_start_matches('.').trim();
    if cleaned.is_empty() {
        return "download".to_string();
    }
    if cleaned.len() <= MAX_FILE_NAME_BYTES {
        return cleaned.to_string();
    }
    let extension = cleaned
        .rfind('.')
        .map(|at| &cleaned[at..])
        .filter(|ext| ext.chars().count() <= 16)
        .unwrap_or("");
    let room = MAX_FILE_NAME_BYTES - extension.len();
    let mut stem = String::new();
    for character in cleaned[..cleaned.len() - extension.len()].chars() {
        if stem.len() + character.len_utf8() > room {
            break;
        }
        stem.push(character);
    }
    format!("{stem}{extension}")
}

/// `%XX` escapes decoded to their bytes; anything else as it is.
fn percent_decode(text: &str) -> Vec<u8> {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut at = 0;
    while at < bytes.len() {
        let hex = |b: u8| (b as char).to_digit(16);
        if bytes[at] == b'%' && at + 2 < bytes.len() {
            if let (Some(high), Some(low)) = (hex(bytes[at + 1]), hex(bytes[at + 2])) {
                out.push((high * 16 + low) as u8);
                at += 3;
                continue;
            }
        }
        out.push(bytes[at]);
        at += 1;
    }
    out
}

/// A downloaded file's media type: a picture's from its bytes
/// ([`image_type`]), a PDF's from its signature, otherwise from its name's
/// extension, or `application/octet-stream`.
pub fn file_type(name: &str, body: &[u8]) -> &'static str {
    if let Some(mime) = image_type(body) {
        return mime;
    }
    if body.starts_with(b"%PDF-") {
        return "application/pdf";
    }
    let extension = name
        .rsplit_once('.')
        .map(|(_, ext)| ext.to_ascii_lowercase())
        .unwrap_or_default();
    match extension.as_str() {
        "pdf" => "application/pdf",
        "epub" => "application/epub+zip",
        "zip" => "application/zip",
        "gz" | "tgz" => "application/gzip",
        "txt" | "text" | "md" => "text/plain",
        "csv" => "text/csv",
        "json" => "application/json",
        "xml" => "application/xml",
        "ics" => "text/calendar",
        "vcf" => "text/vcard",
        "mp3" => "audio/mpeg",
        "mp4" => "video/mp4",
        _ => "application/octet-stream",
    }
}

// ── History ──

/// One page in the history: its address, its title, when it was last opened
/// and how many times.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Visit {
    pub url: String,
    pub title: String,
    pub at: u64,
    pub count: u64,
}

/// A title as it is kept: trimmed, at most [`MAX_TITLE`] characters.
fn clip(title: &str) -> String {
    title.trim().chars().take(MAX_TITLE).collect()
}

/// Put a visit at the front of the history: one entry per address, its
/// count carried on, at most [`HISTORY`] entries.
pub fn visit(history: Vec<Visit>, url: &str, title: &str, at: u64) -> Vec<Visit> {
    let count = history.iter().find(|v| v.url == url).map_or(0, |v| v.count) + 1;
    let mut next = vec![Visit {
        url: url.to_string(),
        title: clip(title),
        at,
        count,
    }];
    next.extend(history.into_iter().filter(|v| v.url != url));
    next.truncate(HISTORY);
    next
}

/// The visits whose title or address holds every word of `query`.
pub fn search(history: &[Visit], query: &str) -> Vec<Visit> {
    let words: Vec<String> = query.split_whitespace().map(str::to_lowercase).collect();
    history
        .iter()
        .filter(|v| {
            let haystack = format!("{} {}", v.title, v.url).to_lowercase();
            words.iter().all(|word| haystack.contains(word.as_str()))
        })
        .cloned()
        .collect()
}

fn history_reply(history: Option<&Vec<Visit>>, rev: u64) -> Value {
    serde_json::json!({ "history": history, "rev": rev })
}

async fn history(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let session = cx.session;
    let query = cx
        .request
        .query_param("q")
        .and_then(super::spotlight::decode)
        .unwrap_or_default();
    let current = document::read::<Vec<Visit>>(&mut cx.storage.user(), HISTORY_KEY).await?;
    let shown = current.doc.map(|all| {
        if query.trim().is_empty() {
            all
        } else {
            search(&all, &query)
        }
    });
    Ok(document::for_session(
        history_reply(shown.as_ref(), current.rev),
        session,
    ))
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct VisitBody {
    url: String,
    #[serde(default)]
    title: String,
}

async fn add_visit(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let body = match cx.request.json::<VisitBody>() {
        Ok(body) => body,
        Err(response) => return Ok(response),
    };
    if let Err(message) = check_link(&body.url) {
        return Ok(Response::error(400, &message));
    }
    let title = if body.title.trim().is_empty() {
        body.url.clone()
    } else {
        body.title
    };
    remember(cx, &body.url, &title).await?;
    Ok(Response::json(200, &serde_json::json!({ "ok": true })))
}

/// What to forget of the history.
#[derive(serde::Deserialize, Default)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct ForgetBody {
    #[serde(default)]
    urls: Vec<String>,
    #[serde(default)]
    since: Option<u64>,
}

/// The history without the named pages and those last opened since `since`.
pub fn forgotten(history: Vec<Visit>, urls: &[String], since: Option<u64>) -> Vec<Visit> {
    history
        .into_iter()
        .filter(|visit| !urls.contains(&visit.url) && since.is_none_or(|from| visit.at < from))
        .collect()
}

async fn forget_visits(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let body = match cx.request.json::<ForgetBody>() {
        Ok(body) => body,
        Err(response) => return Ok(response),
    };
    for _ in 0..4 {
        let mut user = cx.storage.user();
        let current = document::read::<Vec<Visit>>(&mut user, HISTORY_KEY).await?;
        let next = forgotten(current.doc.unwrap_or_default(), &body.urls, body.since);
        match document::write(&mut user, HISTORY_KEY, Some(current.rev), Some(&next)).await? {
            document::Saved::Stored(_) => {
                return Ok(Response::json(200, &serde_json::json!({ "ok": true })));
            }
            document::Saved::Conflict(_) => continue,
        }
    }
    Err(io::Error::other("the history kept changing"))
}

async fn remember(cx: &mut ApiCtx<'_>, url: &str, title: &str) -> io::Result<()> {
    let at = cx.now_ms;
    // Two pages opening at once keep both: each write is based on the
    // revision it read and tried again when it lost.
    for _ in 0..4 {
        let mut user = cx.storage.user();
        let current = document::read::<Vec<Visit>>(&mut user, HISTORY_KEY).await?;
        let next = visit(current.doc.unwrap_or_default(), url, title, at);
        match document::write(&mut user, HISTORY_KEY, Some(current.rev), Some(&next)).await? {
            document::Saved::Stored(_) => return Ok(()),
            document::Saved::Conflict(_) => continue,
        }
    }
    Err(io::Error::other("the history kept changing"))
}

// ── Documents: bookmarks, Reading List, tabs ──

/// A link: a title and an http(s) address.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Link {
    pub title: String,
    pub url: String,
}

/// Whether an address may be kept: http(s), at most [`policy::MAX_URL`].
fn check_link(url: &str) -> Result<(), String> {
    policy::parse(url)
        .map(|_| ())
        .map_err(|refusal| format!("{url:?} cannot be kept: {}", refusal.message()))
}

fn check_title(title: &str) -> Result<(), String> {
    if title.chars().count() > MAX_TITLE {
        return Err(format!("a title is at most {MAX_TITLE} characters"));
    }
    Ok(())
}

fn check_links(name: &str, links: &[Link]) -> Result<(), String> {
    if links.len() > MAX_LINKS {
        return Err(format!("{name} holds at most {MAX_LINKS} links"));
    }
    links
        .iter()
        .try_for_each(|link| check_title(&link.title).and_then(|()| check_link(&link.url)))
}

/// A document the window keeps whole, under the revision rule.
trait Kept: Serialize + DeserializeOwned {
    const KEY: &'static str;
    fn check(&self) -> Result<(), String>;
}

/// A bookmarks folder: a name no other folder has, and its links.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Folder {
    pub title: String,
    pub links: Vec<Link>,
}

/// The Favorites (the Favorites bar and the start page), the other
/// bookmarks and their folders. A document kept before folders has none.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Library {
    pub favorites: Vec<Link>,
    pub bookmarks: Vec<Link>,
    #[serde(default)]
    pub folders: Vec<Folder>,
}

impl Kept for Library {
    const KEY: &'static str = "bookmarks";
    fn check(&self) -> Result<(), String> {
        check_links("Favorites", &self.favorites)?;
        check_links("Bookmarks", &self.bookmarks)?;
        if self.folders.len() > MAX_FOLDERS {
            return Err(format!("there are at most {MAX_FOLDERS} bookmark folders"));
        }
        for (at, folder) in self.folders.iter().enumerate() {
            if folder.title.trim().is_empty() {
                return Err("a bookmark folder has a name".into());
            }
            check_title(&folder.title)?;
            if self.folders[..at].iter().any(|f| f.title == folder.title) {
                return Err(format!("two bookmark folders are named {:?}", folder.title));
            }
            check_links(&folder.title, &folder.links)?;
        }
        Ok(())
    }
}

/// One page saved for later.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Saved {
    pub title: String,
    pub url: String,
    pub added: u64,
    pub read: bool,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct ReadingList {
    pub items: Vec<Saved>,
}

impl Kept for ReadingList {
    const KEY: &'static str = "reading-list";
    fn check(&self) -> Result<(), String> {
        if self.items.len() > MAX_LINKS {
            return Err(format!("the Reading List holds at most {MAX_LINKS} pages"));
        }
        self.items
            .iter()
            .try_for_each(|item| check_title(&item.title).and_then(|()| check_link(&item.url)))
    }
}

/// How many pages a kept tab remembers for Back and Forward.
pub const MAX_TAB_PAGES: usize = 20;

/// What a kept tab has shown: its Back and Forward, with `pages[index]` the
/// tab's address.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct TabPages {
    pub pages: Vec<String>,
    pub index: usize,
}

/// The open tabs, by address (`""` is the start page), and the one in front.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Tabs {
    pub tabs: Vec<String>,
    pub active: usize,
    /// How many of the first tabs are pinned. A document kept before pinning has none.
    #[serde(default, skip_serializing_if = "is_zero")]
    pub pinned: usize,
    /// Each tab's Back and Forward, in the tabs' order; empty when none has any.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub histories: Vec<TabPages>,
}

fn is_zero(count: &usize) -> bool {
    *count == 0
}

impl Kept for Tabs {
    const KEY: &'static str = "tabs";
    fn check(&self) -> Result<(), String> {
        if self.tabs.is_empty() || self.tabs.len() > MAX_TABS {
            return Err(format!("a window has 1 to {MAX_TABS} tabs"));
        }
        if self.active >= self.tabs.len() {
            return Err("the tab in front is not one of the tabs".into());
        }
        if self.pinned > self.tabs.len() {
            return Err("more tabs are pinned than are open".into());
        }
        if !self.histories.is_empty() && self.histories.len() != self.tabs.len() {
            return Err("the tabs' histories are not one for each tab".into());
        }
        for (kept, tab) in self.histories.iter().zip(&self.tabs) {
            if kept.pages.len() > MAX_TAB_PAGES {
                return Err(format!("a tab keeps at most {MAX_TAB_PAGES} pages"));
            }
            if kept.pages.get(kept.index) != Some(tab) {
                return Err("a tab's history does not hold the page it shows".into());
            }
            kept.pages
                .iter()
                .filter(|url| !url.is_empty())
                .try_for_each(|url| check_link(url))?;
        }
        self.tabs
            .iter()
            .filter(|url| !url.is_empty())
            .try_for_each(|url| check_link(url))
    }
}

/// What a `GET` answers: the document's fields, and its revision.
fn kept_reply<T: Serialize>(doc: Option<&T>, rev: u64) -> Value {
    let mut object = doc
        .and_then(|doc| serde_json::to_value(doc).ok())
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default();
    object.insert("rev".into(), rev.into());
    Value::Object(object)
}

/// `GET`, `PUT` and `DELETE` of a kept document (`document.rs`).
async fn keep<T: Kept>(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let session = cx.session;
    match cx.request.method {
        "GET" => document::read::<T>(&mut cx.storage.user(), T::KEY)
            .await
            .map(|current| {
                document::for_session(kept_reply(current.doc.as_ref(), current.rev), session)
            }),
        "PUT" => {
            let mut value: Value = match cx.request.json() {
                Ok(value) => value,
                Err(response) => return Ok(response),
            };
            let Some(object) = value.as_object_mut() else {
                return Ok(Response::error(400, "the body is not a JSON object"));
            };
            let base = object.remove("rev").and_then(|rev| rev.as_u64());
            let named = object
                .remove("session")
                .and_then(|s| s.as_str().map(str::to_string));
            let Some(base) = base else {
                return Ok(Response::error(400, "the body names no rev"));
            };
            let doc: T = match serde_json::from_value(value) {
                Ok(doc) => doc,
                Err(error) => {
                    return Ok(Response::error(
                        400,
                        &format!("the body is not the expected JSON: {error}"),
                    ))
                }
            };
            if let Err(message) = doc.check() {
                return Ok(Response::error(400, &message));
            }
            if let Some(refused) = document::other_session(named.as_deref(), session) {
                return Ok(refused);
            }
            document::write(&mut cx.storage.user(), T::KEY, Some(base), Some(&doc))
                .await
                .map(|saved| document::answer(saved, Some(&doc), kept_reply))
        }
        "DELETE" => document::write::<T>(&mut cx.storage.user(), T::KEY, None, None)
            .await
            .map(|saved| document::answer(saved, None, kept_reply)),
        _ => Ok(Response::method_not_allowed()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn page(url: &str, status: u16, body: &[u8]) -> Result<Loaded, Failure> {
        let url = policy::parse(url).unwrap();
        let host = url.host_text();
        prepare(&url, status, body.to_vec())
            .and_then(|prepared| finish(prepared, &[], &host))
            .map(|(loaded, _)| loaded)
    }

    #[test]
    fn a_reply_over_the_platforms_cap_is_too_large_however_it_grew() {
        let url = policy::parse("https://example.com/").unwrap();
        let small = prepare(&url, 200, b"<title>Hi</title><p>Hi</p>".to_vec()).unwrap();
        let (_, body) = finish(small, &[], "example.com").unwrap();
        let parsed: Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(
            (parsed["ok"].as_bool(), parsed["title"].as_str()),
            (Some(true), Some("Hi"))
        );
        // A text page of control characters: under the egress cap and the
        // rendered cap, six times larger as JSON.
        let controls = prepare(&url, 200, "\u{1}".repeat(600_000).into_bytes()).unwrap();
        assert!(controls.page.html(&[]).len() <= rewrite::MAX_RENDERED);
        assert_eq!(
            finish(controls, &[], "example.com").unwrap_err().kind,
            "too-large"
        );
    }

    #[test]
    fn a_reader_only_reply_holds_the_article_and_not_the_page() {
        let url = policy::parse("https://en.wikipedia.org/wiki/X").unwrap();
        let long = "A sentence long enough to count as a paragraph of an article, and then some more of it to read through. ".repeat(3);
        let html = format!(
            "<title>X</title><img src=//upload.wikimedia.org/a.png alt=a><article><p>{long}a</p><p>{long}b</p><p>{long}c</p></article>"
        );
        let prepared = prepare(&url, 200, html.into_bytes()).unwrap();
        let (_, body) = reader_reply(prepared, "en.wikipedia.org").unwrap();
        let reply: Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(reply["ok"].as_bool(), Some(true));
        assert_eq!(reply["title"].as_str(), Some("X"));
        assert!(reply.get("html").is_none());
        assert_eq!(reply["reader"].as_array().map(Vec::len), Some(3));
    }

    #[test]
    fn a_page_whose_pictures_would_pass_the_cap_goes_without_them() {
        let url = policy::parse("https://en.wikipedia.org/wiki/X").unwrap();
        let html = b"<title>X</title><img src=//upload.wikimedia.org/a.png alt=a>";
        let prepared = prepare(&url, 200, html.to_vec()).unwrap();
        assert_eq!(prepared.page.assets.len(), 1);
        let small = Some("data:image/png;base64,QQ==".to_string());
        let (loaded, _) =
            finish(prepare(&url, 200, html.to_vec()).unwrap(), &[small], "h").unwrap();
        assert!(loaded
            .html
            .ends_with("<img alt=\"a\" src=\"data:image/png;base64,QQ==\">"));
        let huge = Some(format!(
            "data:image/png;base64,{}",
            "A".repeat(MAX_REPLY_BYTES)
        ));
        let (loaded, body) = finish(prepared, &[huge], "h").unwrap();
        assert!(loaded.html.ends_with("<img alt=\"a\">"), "{}", loaded.html);
        assert!(body.len() < MAX_REPLY_BYTES);
    }

    #[test]
    fn only_pictures_and_readable_stylesheets_are_put_in() {
        use rewrite::AssetKind::{Image, Style};
        let png = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR";
        assert_eq!(
            asset_value(Image, "h", 200, png).unwrap(),
            (
                format!("data:image/png;base64,{}", rewrite::base64(png)),
                png.len()
            )
        );
        let pictures: [(&[u8], &str); 7] = [
            (b"\xff\xd8\xff\xe0\0\x10JFIF", "image/jpeg"),
            (b"GIF89a\x01\0", "image/gif"),
            (b"RIFF\0\0\0\0WEBPVP8 ", "image/webp"),
            (b"\0\0\0\x1cftypavif\0\0", "image/avif"),
            (b"\0\0\x01\0\x01\0", "image/x-icon"),
            (
                b"<svg xmlns='http://www.w3.org/2000/svg'/>",
                "image/svg+xml",
            ),
            (
                b"\xef\xbb\xbf<?xml version='1.0'?>\n<svg/>",
                "image/svg+xml",
            ),
        ];
        for (bytes, mime) in pictures {
            assert_eq!(image_type(bytes), Some(mime), "{bytes:?}");
        }
        let others: [&[u8]; 4] = [
            b"<!DOCTYPE html><script>alert(1)</script>",
            b"<?xml version='1.0'?><html/>",
            b"plain text",
            b"",
        ];
        for bytes in others {
            assert_eq!(image_type(bytes), None, "{bytes:?}");
            assert_eq!(
                asset_value(Image, "h", 200, bytes).unwrap_err().kind,
                "unsupported"
            );
        }
        assert_eq!(
            asset_value(Image, "h", 404, png).unwrap_err().kind,
            "unreachable"
        );
        assert_eq!(
            asset_value(Image, "h", 200, &vec![0x89; MAX_ASSET_BYTES + 1])
                .unwrap_err()
                .kind,
            "too-large"
        );
        // A fetched stylesheet is cleaned: its imports and addresses go.
        let (css, _) = asset_value(
            Style,
            "h",
            200,
            b"\xef\xbb\xbf@import 'http://10.0.0.1/x.css';/* ' */a{background:url(http://127.0.0.1/)}",
        )
        .unwrap();
        assert_eq!(css, " a{background:none}");
        assert_eq!(
            asset_value(Style, "h", 200, b"a{b:\\75rl(x)}")
                .unwrap_err()
                .kind,
            "unsupported"
        );
        assert_eq!(
            asset_value(Style, "h", 200, b"a{}\0").unwrap_err().kind,
            "unsupported"
        );
    }

    #[test]
    fn forgetting_takes_the_named_pages_and_those_since_a_time() {
        let history = visit(Vec::new(), "https://a.test/", "A", 10);
        let history = visit(history, "https://b.test/", "B", 20);
        let history = visit(history, "https://c.test/", "C", 30);
        let urls = |h: &[Visit]| h.iter().map(|v| v.url.clone()).collect::<Vec<_>>();
        assert_eq!(
            urls(&forgotten(
                history.clone(),
                &["https://b.test/".into()],
                None
            )),
            ["https://c.test/", "https://a.test/"]
        );
        assert_eq!(
            urls(&forgotten(history.clone(), &[], Some(20))),
            ["https://a.test/"]
        );
        assert_eq!(forgotten(history.clone(), &[], None), history);
    }

    #[test]
    fn the_history_keeps_one_visit_per_page_newest_first_with_its_count() {
        let history = visit(Vec::new(), "https://a.test/", " A ", 1);
        let history = visit(history, "https://b.test/", "B", 2);
        let history = visit(history, "https://a.test/", "A again", 3);
        assert_eq!(history.len(), 2);
        assert_eq!(
            (
                history[0].url.as_str(),
                history[0].title.as_str(),
                history[0].count
            ),
            ("https://a.test/", "A again", 2)
        );
        assert_eq!(history[1].count, 1);
        let mut long = Vec::new();
        for n in 0..HISTORY + 3 {
            long = visit(long, &format!("https://h{n}.test/"), "x", n as u64);
        }
        assert_eq!(long.len(), HISTORY);
        assert_eq!(clip(&"t".repeat(MAX_TITLE + 5)).chars().count(), MAX_TITLE);
    }

    #[test]
    fn history_search_needs_every_word_in_the_title_or_address() {
        let history = vec![
            Visit {
                url: "https://en.wikipedia.org/wiki/MacOS_Catalina".into(),
                title: "macOS Catalina - Wikipedia".into(),
                at: 2,
                count: 1,
            },
            Visit {
                url: "https://text.npr.org/".into(),
                title: "NPR".into(),
                at: 1,
                count: 1,
            },
        ];
        assert_eq!(search(&history, "CATALINA wiki").len(), 1);
        assert_eq!(search(&history, "npr.org").len(), 1);
        assert_eq!(search(&history, "catalina npr").len(), 0);
        assert_eq!(search(&history, "  ").len(), 2);
    }

    #[test]
    fn a_library_kept_before_folders_reads_and_folders_are_checked() {
        let old: Library = ferrite_app::serde_json::from_str(r#"{"favorites":[],"bookmarks":[]}"#)
            .expect("a document with no folders");
        assert_eq!(old.folders, vec![]);
        let folder = |title: &str, url: &str| Folder {
            title: title.into(),
            links: vec![Link {
                title: "t".into(),
                url: url.into(),
            }],
        };
        let library = |folders: Vec<Folder>| Library {
            favorites: vec![],
            bookmarks: vec![],
            folders,
        };
        assert!(library(vec![folder("News", "https://example.com/")])
            .check()
            .is_ok());
        assert!(library(vec![folder("  ", "https://example.com/")])
            .check()
            .is_err());
        assert!(library(vec![folder("News", "file:///etc/passwd")])
            .check()
            .is_err());
        assert!(library(vec![
            folder("News", "https://example.com/"),
            folder("News", "https://example.org/"),
        ])
        .check()
        .is_err());
    }

    #[test]
    fn kept_documents_are_checked_before_they_are_stored() {
        let link = |url: &str| Link {
            title: "t".into(),
            url: url.into(),
        };
        assert!(Library {
            favorites: vec![link("https://example.com/")],
            bookmarks: vec![],
            folders: vec![]
        }
        .check()
        .is_ok());
        assert!(Library {
            favorites: vec![link("javascript:alert(1)")],
            bookmarks: vec![],
            folders: vec![]
        }
        .check()
        .is_err());
        assert!(Library {
            favorites: vec![],
            bookmarks: vec![link("https://example.com/"); MAX_LINKS + 1],
            folders: vec![]
        }
        .check()
        .is_err());
        assert!(Tabs {
            tabs: vec!["".into(), "https://example.com/".into()],
            active: 1,
            pinned: 0,
            histories: vec![]
        }
        .check()
        .is_ok());
        assert!(Tabs {
            tabs: vec![],
            active: 0,
            pinned: 0,
            histories: vec![]
        }
        .check()
        .is_err());
        assert!(Tabs {
            tabs: vec!["".into()],
            active: 1,
            pinned: 0,
            histories: vec![]
        }
        .check()
        .is_err());
        assert!(Tabs {
            tabs: vec!["file:///etc/passwd".into()],
            active: 0,
            pinned: 0,
            histories: vec![]
        }
        .check()
        .is_err());
        let item = Saved {
            title: "x".repeat(MAX_TITLE + 1),
            url: "https://example.com/".into(),
            added: 0,
            read: false,
        };
        assert!(ReadingList { items: vec![item] }.check().is_err());
        let reply = kept_reply(
            Some(&Tabs {
                tabs: vec!["".into()],
                active: 0,
                pinned: 0,
                histories: vec![],
            }),
            4,
        );
        assert_eq!(
            reply,
            serde_json::json!({ "tabs": [""], "active": 0, "rev": 4 })
        );
        assert_eq!(kept_reply::<Tabs>(None, 0), serde_json::json!({ "rev": 0 }));
        assert!(Tabs {
            tabs: vec!["".into()],
            active: 0,
            pinned: 2,
            histories: vec![]
        }
        .check()
        .is_err());
        let kept: Tabs =
            ferrite_app::serde_json::from_str(r#"{"tabs":[""],"active":0}"#).expect("no pins");
        assert_eq!(kept.pinned, 0);
        let pages = |index, pages: &[&str]| TabPages {
            pages: pages.iter().map(|page| page.to_string()).collect(),
            index,
        };
        let with = |histories| Tabs {
            tabs: vec!["https://a.example/".into()],
            active: 0,
            pinned: 0,
            histories,
        };
        assert!(with(vec![pages(1, &["", "https://a.example/"])])
            .check()
            .is_ok());
        assert!(
            with(vec![pages(0, &["https://b.example/"])])
                .check()
                .is_err(),
            "a history must hold the page its tab shows"
        );
        assert!(with(vec![pages(
            1,
            &["file:///etc/passwd", "https://a.example/"]
        )])
        .check()
        .is_err());
        assert!(with(vec![pages(0, &["https://a.example/"]); 2])
            .check()
            .is_err());
        assert!(with(vec![TabPages {
            pages: vec!["https://a.example/".into(); MAX_TAB_PAGES + 1],
            index: 0
        }])
        .check()
        .is_err());
    }

    #[test]
    fn a_persons_own_html_file_is_made_safe_like_a_fetched_page() {
        let reply = file_page_reply(
            b"<!DOCTYPE html><title>Notes</title><script>alert(1)</script><p>Own words</p><a href=page.html>next</a><a href=https://en.wikipedia.org/>out</a>"
                .to_vec(),
        )
        .expect("the file renders");
        let reply: Value = serde_json::from_slice(&reply).expect("a JSON reply");
        assert_eq!(reply["ok"], true);
        assert_eq!(reply["title"], "Notes");
        let html = reply["html"].as_str().expect("its page");
        assert!(html.contains("Own words"));
        assert!(!html.contains("alert(1)"));
        assert!(html.contains(r#"data-safari-href="https://en.wikipedia.org/""#));
        assert!(
            !html.contains("file.invalid/page.html"),
            "a link to another of the person's files has nowhere to go"
        );

        let untitled = file_page_reply(b"<html><p>No title</p></html>".to_vec()).expect("renders");
        let untitled: Value = serde_json::from_slice(&untitled).expect("a JSON reply");
        assert_eq!(untitled["title"], "");

        let large = file_page_reply(vec![b' '; MAX_PAGE_BYTES + 1]).expect_err("too large");
        assert_eq!(large.kind, "too-large");
    }

    #[test]
    fn suggestions_are_the_titles_of_an_opensearch_answer() {
        assert_eq!(
            suggestions_of(br#"["mac",["Mac","Macintosh"],["",""],["u","v"]]"#),
            vec!["Mac".to_string(), "Macintosh".to_string()]
        );
        assert_eq!(suggestions_of(b"<html>"), Vec::<String>::new());
        assert_eq!(suggestions_of(br#"{"error":1}"#), Vec::<String>::new());
    }

    #[test]
    fn the_resolvers_answer_gives_the_addresses_and_egress_failures_are_named() {
        let body = br#"{"Status":0,"Answer":[{"type":5,"data":"alias."},{"type":1,"data":"93.184.215.14"},{"type":28,"data":"2606:2800::1"}]}"#;
        assert_eq!(
            dns_addresses(body),
            Some((0, vec!["93.184.215.14".into(), "2606:2800::1".into()]))
        );
        assert_eq!(dns_addresses(br#"{"Status":3}"#), Some((3, vec![])));
        assert_eq!(dns_addresses(b"<html>"), None);
        let kind = |message: &str| egress_error("h", &io::Error::other(message.to_string())).kind;
        let attempt = |message: &str| Err::<(), _>(io::Error::other(message.to_string()));
        assert!(connect_timed_out(&attempt(
            "egress deadline exceeded; phase=connect; budget_ms=2000"
        )));
        assert!(!connect_timed_out(&attempt(
            "egress deadline exceeded; phase=response; budget_ms=10000"
        )));
        assert!(!connect_timed_out(&attempt("did not resolve")));
        assert!(!connect_timed_out(&Ok(())));
        assert_eq!(kind("egress response body exceeds the cap"), "too-large");
        assert_eq!(kind("egress response timeout"), "timeout");
        assert_eq!(
            kind("egress destination did not resolve: h:443"),
            "not-found"
        );
        assert_eq!(kind("connection reset"), "unreachable");
        assert_eq!(
            denied("h", "capability does not permit this key").kind,
            "not-listed"
        );
        assert_eq!(
            denied("h", "destination targets loopback/private/fabric space").kind,
            "private"
        );
        assert_eq!(denied("h", "egress denied (mode)").kind, "unreachable");
    }

    #[test]
    fn a_page_is_rendered_or_refused_by_what_it_holds() {
        let opened = page(
            "https://example.com/",
            200,
            b"<title>Example Domain</title><p>Hi</p>",
        )
        .unwrap();
        assert_eq!(
            (opened.title.as_str(), opened.status, opened.url.as_str()),
            ("Example Domain", 200, "https://example.com/")
        );
        assert!(opened.html.contains("Content-Security-Policy") && opened.reader.is_none());
        let text = page("https://example.com/", 404, b"not found").unwrap();
        assert_eq!((text.title.as_str(), text.status), ("example.com", 404));
        assert_eq!(
            page("https://example.com/", 200, &[0x89, b'P', b'N', b'G', 0, 0])
                .unwrap_err()
                .kind,
            "unsupported"
        );
        assert_eq!(
            page("https://example.com/", 200, &vec![b'a'; MAX_PAGE_BYTES + 1])
                .unwrap_err()
                .kind,
            "too-large"
        );
    }

    #[test]
    fn a_page_off_the_list_is_offered_once_its_name_is_public_or_could_not_be_checked() {
        assert_eq!(outside_verdict(Some(Ok(()))), Ok(true));
        let missing = Failure::new(
            "not-found",
            "nope.test",
            "the server's name could not be found",
        );
        assert_eq!(outside_verdict(Some(Err(missing.clone()))), Err(missing));
        let inside = Failure::from(policy::Refusal::Private("router.example".into()));
        assert_eq!(
            outside_verdict(Some(Err(inside))).unwrap_err().kind,
            "private"
        );
        for unchecked in [
            Failure::new("unreachable", "h", "the DNS resolver could not be reached"),
            Failure::timeout("h"),
        ] {
            assert_eq!(outside_verdict(Some(Err(unchecked))), Ok(false));
        }
        assert_eq!(
            outside_verdict(None),
            Ok(false),
            "a resolver slower than DNS_CHECK_MS never holds the window"
        );
        assert!(DNS_CHECK_MS < PAGE_BUDGET_MS);
    }

    #[test]
    fn a_downloaded_file_is_named_and_typed_from_its_address_and_bytes() {
        let name = |url: &str| file_name(&policy::parse(url).unwrap());
        assert_eq!(
            name("https://www.gnu.org/graphics/gnu-head-mini.png"),
            "gnu-head-mini.png"
        );
        assert_eq!(
            name("https://www.gutenberg.org/files/11/11-0%20copy.txt?x=1"),
            "11-0 copy.txt"
        );
        assert_eq!(name("https://example.com/"), "download");
        assert_eq!(
            name("https://example.com/..%2F..%2Fetc%2Fpasswd"),
            "_.._etc_passwd"
        );
        assert_eq!(name("https://example.com/a%0Ab%3Ac"), "a_b_c");
        assert_eq!(name("https://example.com/%zz.txt"), "%zz.txt");
        let long = name(&format!("https://example.com/{}.epub", "x".repeat(400)));
        assert_eq!(long.len(), MAX_FILE_NAME_BYTES);
        assert!(long.ends_with(".epub"));
        // Many-byte characters are cut on a character boundary, within the drive's
        // byte limit, the extension kept.
        for wide in ["文", "📚", "é"] {
            let encoded = policy::encode_component(&wide.repeat(150));
            let cut = name(&format!("https://example.com/{encoded}.pdf"));
            assert!(
                cut.len() <= MAX_FILE_NAME_BYTES,
                "{wide}: {} bytes",
                cut.len()
            );
            assert!(
                cut.ends_with(".pdf")
                    && cut
                        .trim_end_matches(".pdf")
                        .chars()
                        .all(|c| c.to_string() == wide)
            );
        }
        assert_eq!(name("https://example.com/%E6%96%87.txt"), "文.txt");

        let png = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR";
        assert_eq!(file_type("x.bin", png), "image/png");
        assert_eq!(file_type("report", b"%PDF-1.7\n"), "application/pdf");
        assert_eq!(
            file_type("book.EPUB", b"PK\x03\x04"),
            "application/epub+zip"
        );
        assert_eq!(file_type("data", b"\0\x01"), "application/octet-stream");

        let url = policy::parse("https://www.gnu.org/graphics/gnu-head-mini.png").unwrap();
        let reply = file_reply(&url, 200, png).unwrap();
        assert_eq!(
            (
                reply["ok"].as_bool(),
                reply["name"].as_str(),
                reply["type"].as_str(),
                reply["size"].as_u64()
            ),
            (
                Some(true),
                Some("gnu-head-mini.png"),
                Some("image/png"),
                Some(png.len() as u64)
            )
        );
        assert_eq!(reply["data"].as_str(), Some(rewrite::base64(png).as_str()));
        assert_eq!(file_reply(&url, 404, png).unwrap_err().kind, "unreachable");
        assert_eq!(
            file_reply(&url, 200, &vec![0; MAX_PAGE_BYTES + 1])
                .unwrap_err()
                .kind,
            "too-large"
        );
    }
}

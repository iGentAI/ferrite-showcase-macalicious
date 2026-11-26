//! Stocks' server half: real quotes, charts, symbol search and business
//! news from a market-data [`provider`], cached for everyone, and each
//! person's watchlist and price alerts.
//!
//! Every source call goes through the egress handle [`EGRESS`] and is
//! cached in the shared space. Quotes go out one call at a time for everyone
//! (a lease in the shared space), and a request that finds the call on its
//! way waits for its quotes, so a hundred open windows refreshing every
//! minute cost the provider one call a minute per symbol, known or not. A
//! request for symbols that call does not ask for leaves them for the next
//! call (`leases/quotes-waiting`), so the requests that waited for one call
//! are answered by the next one, not each by a call of its own in turn. Charts,
//! search and news are cached the same way but not leased: a few windows
//! missing the same expired entry at once may each ask for it.
//!
//! * `GET /api/stocks/quotes?symbols=AAPL,.SPX` (at most [`MAX_SYMBOLS`]):
//!   `{"quotes": [Quote], "missing": [symbol], "source", "source_url", "at"}`, each quote
//!   kept for [`QUOTE_TTL_MS`]. A symbol the provider does not know is named
//!   in `missing`, and kept as unknown for as long. When this person has price alerts on any of the symbols,
//!   they are checked against the prices (see `/alerts`).
//! * `GET /api/stocks/chart?symbol=AAPL&range=1D` (`1D`, `1W`, `1M`, `3M`,
//!   `6M`, `1Y`, `2Y`): `{"symbol", "range", "points": [[ms, price]]}`,
//!   oldest first, at most 240, kept for two minutes (the day) or an hour.
//! * `GET /api/stocks/search?q=apple`: `{"results": [{"symbol", "name",
//!   "exchange", "kind"}]}`, kept for a day.
//! * `GET /api/stocks/news`: `{"stories": [Story]}`, newest first, from the
//!   provider's business feeds, kept for ten minutes. When one feed fails and
//!   another answers, its stories are answered and kept for a minute only;
//!   when none answers, 502.
//! * `GET`/`PUT`/`DELETE /api/stocks/watchlist`: `{"symbols": [..], "rev"}`,
//!   the person's watchlist (`document.rs`), `null` before the first save.
//! * `GET`/`PUT`/`DELETE /api/stocks/alerts`: `{"alerts": [Alert], "rev"}`,
//!   the person's price alerts. An alert fires once, when a quote this
//!   module fetches for the person is at or above its `above` price or at or
//!   below its `below` price; `fired` then holds when and at what price. A
//!   `GET` checks every alert that has not fired against current quotes, so
//!   Notification Center's poll fires them while the Stocks window is shut.
//!
//! A failure of the provider is answered 502 with what went wrong; nothing is
//! made up. Prices are as the provider gives them (CNBC's are real-time for
//! US listings on Nasdaq and NYSE, delayed elsewhere).

pub mod provider;

use ferrite_app::{serde, serde_json};
use serde_json::{json, Value};

use super::document;
use super::fetch::{self, Fetched};
use super::notification_center::{self, Notification};
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};
use provider::{provider, Found, Quote, Story, RANGES};

pub const MODULE: AppModule = AppModule {
    name: "stocks",
    title: "Stocks",
    handle,
};

/// The egress handle `ferrite.json` declares for the provider's hosts.
pub const EGRESS: &str = "stocks";
/// The most symbols one quotes request, a watchlist or the alerts hold.
pub const MAX_SYMBOLS: usize = 50;
/// How long a quote is kept for everyone.
pub const QUOTE_TTL_MS: u64 = 60_000;
const DAY_CHART_TTL_MS: u64 = 120_000;
const CHART_TTL_MS: u64 = 60 * 60 * 1000;
const SEARCH_TTL_MS: u64 = 24 * 60 * 60 * 1000;
const NEWS_TTL_MS: u64 = 10 * 60 * 1000;
const PARTIAL_NEWS_TTL_MS: u64 = 60 * 1000;
/// The most one provider call may take, under the 8 s API deadline.
const BUDGET_MS: u64 = 5_000;
const MAX_STORIES: usize = 40;
const WATCHLIST: &str = "watchlist";
const ALERTS: &str = "alerts";

/// The person's watchlist.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Watchlist {
    pub symbols: Vec<String>,
}

/// When and at what price an alert fired.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Fired {
    pub at: u64,
    pub price: f64,
    /// Whether the person's notifications have it. Left false when delivering
    /// failed, for the next check to try again; alerts saved before there were
    /// notifications count as told.
    #[serde(default = "told", skip_serializing_if = "Clone::clone")]
    pub notified: bool,
}

fn told() -> bool {
    true
}

/// One price alert.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Alert {
    pub id: String,
    pub symbol: String,
    #[serde(default)]
    pub above: Option<f64>,
    #[serde(default)]
    pub below: Option<f64>,
    pub created: u64,
    #[serde(default)]
    pub fired: Option<Fired>,
}

/// The person's alerts.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Default)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Alerts {
    pub alerts: Vec<Alert>,
}

/// A `PUT` body: the document's fields beside `rev` and an optional `session`.
fn put_body<T: serde::de::DeserializeOwned>(
    body: &[u8],
) -> Result<(T, u64, Option<String>), Response> {
    let bad =
        |why: String| Response::error(400, &format!("the body is not the expected JSON: {why}"));
    let mut value: Value = serde_json::from_slice(body).map_err(|e| bad(e.to_string()))?;
    let object = value
        .as_object_mut()
        .ok_or_else(|| bad("not an object".into()))?;
    let rev = object
        .remove("rev")
        .and_then(|r| r.as_u64())
        .ok_or_else(|| bad("no rev".into()))?;
    let session = match object.remove("session") {
        None | Some(Value::Null) => None,
        Some(Value::String(session)) => Some(session),
        Some(_) => return Err(bad("session is not a string".into())),
    };
    let doc = serde_json::from_value(value).map_err(|e| bad(e.to_string()))?;
    Ok((doc, rev, session))
}

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    match (cx.request.method, cx.request.path) {
        ("GET", "/quotes") => {
            let raw = param(&cx, "symbols").unwrap_or_default();
            match symbols_of(&raw) {
                Ok(symbols) => quotes_route(&mut cx, symbols).await,
                Err(message) => Response::error(400, &message),
            }
        }
        ("GET", "/chart") => {
            let symbol = param(&cx, "symbol").unwrap_or_default();
            let range = param(&cx, "range").unwrap_or_else(|| "1D".into());
            if !valid_symbol(&symbol) {
                return Response::error(400, "name one symbol");
            }
            if !RANGES.contains(&range.as_str()) {
                return Response::error(400, &format!("the range is one of {}", RANGES.join(", ")));
            }
            chart(&mut cx, &symbol.to_uppercase(), &range).await
        }
        ("GET", "/search") => {
            let query = param(&cx, "q").unwrap_or_default();
            let query = query.split_whitespace().collect::<Vec<_>>().join(" ");
            if query.is_empty() || query.chars().count() > 60 {
                return Response::error(400, "type 1 to 60 characters to search for");
            }
            search(&mut cx, &query).await
        }
        ("GET", "/news") => news(&mut cx).await,
        (_, "/quotes" | "/chart" | "/search" | "/news") => Response::method_not_allowed(),
        (_, "/watchlist") => {
            document_route::<Watchlist>(
                &mut cx,
                WATCHLIST,
                check_watchlist,
                |w, rev| json!({ "symbols": w.map(|w| &w.symbols), "rev": rev }),
            )
            .await
        }
        ("GET", "/alerts") => alerts_get(&mut cx).await,
        (_, "/alerts") => {
            document_route::<Alerts>(
                &mut cx,
                ALERTS,
                check_alerts,
                |a, rev| json!({ "alerts": a.map(|a| &a.alerts), "rev": rev }),
            )
            .await
        }
        _ => Response::not_found(),
    }
}

/// Query parameter `name`, percent-decoded.
fn param(cx: &ApiCtx<'_>, name: &str) -> Option<String> {
    super::spotlight::decode(cx.request.query_param(name)?)
}

/// Whether `symbol` may be asked for: 1 to 20 letters, digits and `.-^=`.
pub fn valid_symbol(symbol: &str) -> bool {
    (1..=20).contains(&symbol.len())
        && symbol
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'-' | b'^' | b'='))
}

/// The symbols of a comma-separated list, upper-cased, each once.
pub fn symbols_of(list: &str) -> Result<Vec<String>, String> {
    let mut symbols: Vec<String> = Vec::new();
    for symbol in list.split(',').map(str::trim).filter(|s| !s.is_empty()) {
        if !valid_symbol(symbol) {
            return Err(format!("{symbol:?} is not a symbol"));
        }
        let symbol = symbol.to_uppercase();
        if !symbols.contains(&symbol) {
            symbols.push(symbol);
        }
    }
    if symbols.is_empty() || symbols.len() > MAX_SYMBOLS {
        return Err(format!("name 1 to {MAX_SYMBOLS} symbols"));
    }
    Ok(symbols)
}

fn failure(what: &str, fetched: &Fetched) -> Response {
    let why = match fetched {
        Fetched::Failed(why) => why.clone(),
        Fetched::Missing => "the provider has no such data".into(),
        Fetched::Body(_) => "the provider's answer could not be read".into(),
    };
    Response::error(502, &format!("{what}: {why}"))
}

/// A 200's body read by `parse`, or the 502 that says why it is not one: the
/// fetch's failure or the answer's mismatch with its documented shape.
fn read<T>(
    what: &str,
    fetched: &Fetched,
    parse: impl FnOnce(&[u8]) -> fetch::strict::Strict<T>,
) -> Result<T, Response> {
    let Some(body) = fetched.body() else {
        return Err(failure(what, fetched));
    };
    parse(body).map_err(|mismatch| {
        Response::error(
            502,
            &format!("{what}: the provider's answer could not be read: {mismatch}"),
        )
    })
}

/// A cached record that does not read is a storage fault: 503, naming it.
fn cache_failed(error: std::io::Error) -> Response {
    Response::error(503, &format!("a kept answer could not be read: {error}"))
}

/// The shared key of the quotes lease: the one request on its way to the
/// provider for quotes holds it, as the time (epoch ms) it lapses.
const QUOTE_LEASE: &str = "leases/quotes";
/// The shared key of the symbols that requests waiting for the quotes call on
/// its way still want (a JSON list, at most [`MAX_SYMBOLS`]): the request that
/// takes the lease next asks for them in its own call ([`call_symbols`]), so
/// the requests that waited for one call are answered by the next one, not
/// each by a call of its own in turn. A hint only: a list that cannot be read
/// or written leaves each request to call for its own symbols, as before.
const QUOTE_WAITING: &str = "leases/quotes-waiting";
/// How long a request waiting for the lease looks again.
const LEASE_POLL_MS: u64 = 250;
/// How much longer than its provider call a lease holds: the time to keep
/// the call's quotes and hand the lease back, so a lease never lapses while
/// its call is still on its way.
const LEASE_SLACK_MS: u64 = 1_500;
/// The most a request spends on quotes, waiting included, leaving the rest of
/// the 8 s API deadline for keeping them and checking the person's alerts.
const REQUEST_MS: u64 = 6_500;
/// The least time a quotes call is given: a request with less left answers
/// 503 rather than start a call it would have to cut short.
const MIN_CALL_MS: u64 = 1_000;

/// Whether a lease held until `held_until` (`None`: never taken) is free at
/// `now`.
pub fn lease_free(held_until: Option<u64>, now: u64) -> bool {
    held_until.is_none_or(|until| until <= now)
}

/// How long a quotes call started `elapsed` ms into a request may take: the
/// provider budget, cut to what the request has left, or `None` when that is
/// less than [`MIN_CALL_MS`].
pub fn call_budget(elapsed: u64) -> Option<u64> {
    let left = REQUEST_MS.saturating_sub(elapsed).min(BUDGET_MS);
    (left >= MIN_CALL_MS).then_some(left)
}

/// How long the call of a request that holds the lease until `lease` (epoch
/// ms) may take, `elapsed` ms into the request at `now`: within the request's
/// budget ([`call_budget`]), no more than the lease was taken for
/// (`taken_for`), and ending [`LEASE_SLACK_MS`] before the lease does, so the
/// call's quotes are kept and the lease handed back before it lapses and
/// another call could start beside it. `None` when that is less than
/// [`MIN_CALL_MS`].
pub fn call_window(elapsed: u64, now: u64, lease: u64, taken_for: u64) -> Option<u64> {
    let lease_left = lease.saturating_sub(now.saturating_add(LEASE_SLACK_MS));
    call_budget(elapsed)
        .map(|left| left.min(taken_for).min(lease_left))
        .filter(|ms| *ms >= MIN_CALL_MS)
}

/// Take the quotes lease for one provider call of at most `call_ms`, with
/// compare-and-set: `Some(lease)` to hand back to [`release_quote_lease`],
/// `None` while another request holds it.
async fn take_quote_lease(cx: &mut ApiCtx<'_>, call_ms: u64) -> std::io::Result<Option<u64>> {
    let mut space = cx.storage.shared();
    let stored = space.get_versioned(QUOTE_LEASE).await?;
    let now = cx.ctx.now_ms();
    let held_until = stored
        .as_ref()
        .map(|(bytes, _)| {
            std::str::from_utf8(bytes)
                .ok()
                .and_then(|text| text.parse::<u64>().ok())
                .ok_or_else(|| {
                    std::io::Error::new(
                        std::io::ErrorKind::InvalidData,
                        "the stored quotes lease is not a time",
                    )
                })
        })
        .transpose()?;
    if !lease_free(held_until, now) {
        return Ok(None);
    }
    let lease = now + call_ms + LEASE_SLACK_MS;
    let taken = space
        .put_if_version(
            QUOTE_LEASE,
            lease.to_string().as_bytes(),
            stored.map(|(_, version)| version),
        )
        .await?;
    Ok(taken.then_some(lease))
}

/// Hand back the lease taken as `lease`; one that lapsed and was taken by
/// another request is left alone.
async fn release_quote_lease(cx: &mut ApiCtx<'_>, lease: u64) {
    let mut space = cx.storage.shared();
    let released = match space.get_versioned(QUOTE_LEASE).await {
        Ok(Some((bytes, version))) if bytes == lease.to_string().as_bytes() => space
            .put_if_version(QUOTE_LEASE, b"0", Some(version))
            .await
            .map(|_| ()),
        Ok(_) => Ok(()),
        Err(error) => Err(error),
    };
    // A lease not handed back lapses at the end of its own time.
    if let Err(error) = released {
        ferrite_app::tracing::warn!(%error, "could not hand back the quotes lease");
    }
}

/// The symbols of one quotes call: the request's own `wanted` first, then the
/// symbols other requests left `waiting` that it does not ask for already
/// (in any case), at most [`MAX_SYMBOLS`] in all; and the waiting symbols left
/// for the call after it.
pub fn call_symbols(wanted: &[String], waiting: &[String]) -> (Vec<String>, Vec<String>) {
    let asked = |list: &[String], symbol: &str| list.iter().any(|s| s.eq_ignore_ascii_case(symbol));
    let mut call: Vec<String> = Vec::new();
    for symbol in wanted {
        if !asked(&call, symbol) {
            call.push(symbol.clone());
        }
    }
    let mut rest: Vec<String> = Vec::new();
    for symbol in waiting {
        if asked(&call, symbol) || asked(&rest, symbol) {
            continue;
        }
        if call.len() < MAX_SYMBOLS {
            call.push(symbol.clone());
        } else {
            rest.push(symbol.clone());
        }
    }
    (call, rest)
}

/// Leave `wanted` for the call that takes the lease next: added to
/// [`QUOTE_WAITING`] with compare-and-set, at most [`MAX_SYMBOLS`] in all.
/// Best effort: when the list cannot be read or written the request still
/// waits, and calls for its own symbols once the lease is free.
async fn leave_waiting(cx: &mut ApiCtx<'_>, wanted: &[String]) {
    for _ in 0..3 {
        let mut space = cx.storage.shared();
        let Ok(stored) = space.get_versioned(QUOTE_WAITING).await else {
            return;
        };
        let mut list: Vec<String> = stored
            .as_ref()
            .and_then(|(bytes, _)| serde_json::from_slice(bytes).ok())
            .unwrap_or_default();
        let before = list.len();
        for symbol in wanted {
            let symbol = symbol.to_uppercase();
            if list.len() < MAX_SYMBOLS && !list.contains(&symbol) {
                list.push(symbol);
            }
        }
        if list.len() == before {
            return;
        }
        let Ok(bytes) = serde_json::to_vec(&list) else {
            return;
        };
        match space
            .put_if_version(QUOTE_WAITING, &bytes, stored.map(|(_, version)| version))
            .await
        {
            Ok(false) => continue,
            Ok(true) | Err(_) => return,
        }
    }
}

/// The symbols the call of the request holding the lease asks for: its own
/// `wanted`, then the symbols other requests left waiting ([`QUOTE_WAITING`],
/// taken off the list with compare-and-set) that the cache does not hold
/// already, so none is asked for twice within [`QUOTE_TTL_MS`]. A waiting
/// request whose symbols this call does not keep (it failed) leaves them
/// again while it waits.
async fn with_waiting(cx: &mut ApiCtx<'_>, wanted: &[String]) -> Vec<String> {
    let mut taken: Vec<String> = Vec::new();
    for _ in 0..3 {
        let mut space = cx.storage.shared();
        let Ok(stored) = space.get_versioned(QUOTE_WAITING).await else {
            break;
        };
        let waiting: Vec<String> = stored
            .as_ref()
            .and_then(|(bytes, _)| serde_json::from_slice(bytes).ok())
            .unwrap_or_default();
        if waiting.is_empty() {
            break;
        }
        let (call, rest) = call_symbols(wanted, &waiting);
        let Ok(bytes) = serde_json::to_vec(&rest) else {
            break;
        };
        match space
            .put_if_version(QUOTE_WAITING, &bytes, stored.map(|(_, version)| version))
            .await
        {
            Ok(true) => {
                taken = call
                    .into_iter()
                    .filter(|s| !wanted.iter().any(|w| w.eq_ignore_ascii_case(s)))
                    .collect();
                break;
            }
            Ok(false) => continue,
            Err(_) => break,
        }
    }
    // Kept meanwhile (by a call that ended since they were left): not asked
    // for again.
    let (mut found, mut missing) = (Vec::new(), Vec::new());
    if !taken.is_empty()
        && cached_quotes(cx, &mut taken, &mut found, &mut missing)
            .await
            .is_err()
    {
        taken.clear();
    }
    wanted.iter().cloned().chain(taken).collect()
}

/// What the shared cache keeps for one symbol: its quote, or that the
/// provider does not know it, so an unknown symbol is not asked for again
/// within [`QUOTE_TTL_MS`] either.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", untagged)]
pub enum Kept {
    Known(Quote),
    Unknown { unknown: String },
}

/// The cached quotes of `wanted`, moved into `found` (or, for a symbol the
/// provider does not know, into `missing`); `wanted` keeps the symbols the
/// cache holds nothing for.
async fn cached_quotes(
    cx: &mut ApiCtx<'_>,
    wanted: &mut Vec<String>,
    found: &mut Vec<Quote>,
    missing: &mut Vec<String>,
) -> Result<(), Response> {
    let mut still = Vec::new();
    for symbol in wanted.drain(..) {
        match cx
            .storage
            .shared()
            .get_json::<Kept>(&format!("quotes/{symbol}"))
            .await
        {
            Ok(Some(Kept::Known(quote))) => found.push(quote),
            Ok(Some(Kept::Unknown { .. })) => missing.push(symbol),
            Ok(None) => still.push(symbol),
            Err(error) => return Err(cache_failed(error)),
        }
    }
    *wanted = still;
    Ok(())
}

/// Ask the provider for `wanted`, giving it `call_ms`, and keep what it
/// answers for every symbol for [`QUOTE_TTL_MS`] (a quote, or that the symbol
/// is unknown) before the lease is handed back, so a request waiting for it
/// finds them.
async fn fetch_quotes(
    cx: &mut ApiCtx<'_>,
    wanted: &[String],
    call_ms: u64,
) -> Result<Vec<Quote>, Response> {
    let source = provider();
    let url = (source.quotes_url)(wanted);
    let fetched = fetch::get(cx.ctx, EGRESS, &url, "application/json", call_ms).await;
    let fresh = read("no quotes", &fetched, source.parse_quotes)?;
    let expires = cx.ctx.now_ms() + QUOTE_TTL_MS;
    for symbol in wanted {
        let kept = match fresh.iter().find(|q| q.symbol.eq_ignore_ascii_case(symbol)) {
            Some(quote) => Kept::Known(quote.clone()),
            None => Kept::Unknown {
                unknown: symbol.clone(),
            },
        };
        if let Ok(bytes) = serde_json::to_vec(&kept) {
            let key = format!("quotes/{}", symbol.to_uppercase());
            if let Err(error) = cx
                .storage
                .shared()
                .put_expiring(&key, &bytes, expires)
                .await
            {
                ferrite_app::tracing::warn!(%error, "could not keep a quote");
            }
        }
    }
    Ok(fresh)
}

/// The 503 of a request left too little time to wait for the quotes call on
/// its way or to make its own.
fn too_busy() -> Response {
    Response::error(
        503,
        "quotes are being fetched for everyone right now; try again in a moment",
    )
    .add_header("retry-after", "1")
}

/// Current quotes of `symbols`: from the shared cache where fresh, the rest
/// in one call to the provider. At most one quotes call is on its way at a
/// time for everyone (the [`QUOTE_LEASE`]); a request that finds it held
/// waits for that call to end and reads what it kept, and makes a call of its
/// own only for what is still not kept, with the time it has left. So a
/// symbol, known or not, is asked for at most once per [`QUOTE_TTL_MS`]. One
/// lease for all symbols keeps the provider to one call at a time; a request
/// for other symbols than the call on its way asks for leaves them for the
/// next call ([`QUOTE_WAITING`]) while it waits, so every request that waited
/// for one call is answered by the next one, which asks for all their symbols
/// together, rather than each making a call of its own in turn.
/// `Err` holds the provider's failure, the 503 of a cached quote that could
/// not be read, or a 503 when too little time is left to wait or to call.
async fn quotes(
    cx: &mut ApiCtx<'_>,
    symbols: &[String],
) -> Result<(Vec<Quote>, Vec<String>), Response> {
    let started = cx.ctx.now_ms();
    let mut found = Vec::new();
    let mut missing = Vec::new();
    let mut wanted = symbols.to_vec();
    cached_quotes(cx, &mut wanted, &mut found, &mut missing).await?;
    while !wanted.is_empty() {
        let elapsed = cx.ctx.now_ms().saturating_sub(started);
        let call_ms = call_budget(elapsed);
        let lease = match call_ms {
            Some(ms) => take_quote_lease(cx, ms).await.map_err(cache_failed)?,
            None => None,
        };
        // Read again under the lease: the call that held it may have kept them.
        let read = cached_quotes(cx, &mut wanted, &mut found, &mut missing).await;
        let (Some(lease), Some(call_ms)) = (lease, call_ms) else {
            read?;
            if wanted.is_empty() {
                break;
            }
            if elapsed + LEASE_POLL_MS + MIN_CALL_MS > REQUEST_MS {
                return Err(too_busy());
            }
            // The next call asks for them too: this request need not make its own.
            leave_waiting(cx, &wanted).await;
            ferrite_app::sleep_ms(LEASE_POLL_MS).await;
            continue;
        };
        if let Err(response) = read {
            release_quote_lease(cx, lease).await;
            return Err(response);
        }
        if wanted.is_empty() {
            release_quote_lease(cx, lease).await;
            break;
        }
        // The symbols other requests left waiting for this call ride on it.
        // Gathered first: the time they take comes off the call's.
        let call = with_waiting(cx, &wanted).await;
        // The time left now, after taking the lease and reading the cache and
        // the waiting list: within the request's budget, never more than the
        // lease was taken for, and ending before the lease does.
        let now = cx.ctx.now_ms();
        let Some(call_ms) = call_window(now.saturating_sub(started), now, lease, call_ms) else {
            release_quote_lease(cx, lease).await;
            return Err(too_busy());
        };
        let fetched = fetch_quotes(cx, &call, call_ms).await;
        release_quote_lease(cx, lease).await;
        let fresh = fetched?;
        for symbol in wanted.drain(..) {
            match fresh
                .iter()
                .find(|q| q.symbol.eq_ignore_ascii_case(&symbol))
            {
                Some(quote) => found.push(quote.clone()),
                None => missing.push(symbol),
            }
        }
    }
    // In the order asked for.
    found.sort_by_key(|q| {
        symbols
            .iter()
            .position(|s| s.eq_ignore_ascii_case(&q.symbol))
    });
    missing.sort_by_key(|m| symbols.iter().position(|s| s.eq_ignore_ascii_case(m)));
    Ok((found, missing))
}

async fn quotes_route(cx: &mut ApiCtx<'_>, symbols: Vec<String>) -> Response {
    let (found, missing) = match quotes(cx, &symbols).await {
        Ok(answer) => answer,
        Err(response) => return response,
    };
    if let Err(error) = check_fired(cx, &found).await {
        ferrite_app::tracing::warn!(%error, "price alerts not checked");
    }
    Response::json(
        200,
        &json!({
            "quotes": found,
            "missing": missing,
            "source": provider().name,
            "source_url": provider().home,
            "at": cx.now_ms,
        }),
    )
}

async fn chart(cx: &mut ApiCtx<'_>, symbol: &str, range: &str) -> Response {
    let key = format!("charts/{range}/{symbol}");
    match cx.storage.shared().get_json::<Vec<(u64, f64)>>(&key).await {
        Ok(Some(points)) => {
            return Response::json(
                200,
                &json!({ "symbol": symbol, "range": range, "points": points }),
            )
        }
        Ok(None) => {}
        Err(error) => return cache_failed(error),
    }
    let source = provider();
    let url = (source.chart_url)(symbol, range);
    let fetched = fetch::get(cx.ctx, EGRESS, &url, "application/json", BUDGET_MS).await;
    let points = match read("no chart", &fetched, |body| {
        (source.parse_chart)(body, range, cx.now_ms)
    }) {
        Ok(points) => points,
        Err(response) => return response,
    };
    let ttl = if range == "1D" {
        DAY_CHART_TTL_MS
    } else {
        CHART_TTL_MS
    };
    if let Ok(bytes) = serde_json::to_vec(&points) {
        let _ = cx
            .storage
            .shared()
            .put_expiring(&key, &bytes, cx.now_ms + ttl)
            .await;
    }
    Response::json(
        200,
        &json!({ "symbol": symbol, "range": range, "points": points }),
    )
}

async fn search(cx: &mut ApiCtx<'_>, query: &str) -> Response {
    let key = format!("search/{}", query.to_lowercase());
    match cx.storage.shared().get_json::<Vec<Found>>(&key).await {
        Ok(Some(results)) => return Response::json(200, &json!({ "results": results })),
        Ok(None) => {}
        Err(error) => return cache_failed(error),
    }
    let source = provider();
    let url = (source.search_url)(query);
    let fetched = fetch::get(cx.ctx, EGRESS, &url, "application/json", BUDGET_MS).await;
    let results = match read("no search results", &fetched, source.parse_search) {
        Ok(results) => results,
        Err(response) => return response,
    };
    if let Ok(bytes) = serde_json::to_vec(&results) {
        let _ = cx
            .storage
            .shared()
            .put_expiring(&key, &bytes, cx.now_ms + SEARCH_TTL_MS)
            .await;
    }
    Response::json(200, &json!({ "results": results }))
}

async fn news(cx: &mut ApiCtx<'_>) -> Response {
    match cx.storage.shared().get_json::<Vec<Story>>("news").await {
        Ok(Some(stories)) => {
            return Response::json(
                200,
                &json!({ "stories": stories, "source": provider().name }),
            )
        }
        Ok(None) => {}
        Err(error) => return cache_failed(error),
    }
    let source = provider();
    let ctx = cx.ctx;
    let work: Vec<fetch::Pending<'_>> = source
        .news_urls
        .iter()
        .map(|url| {
            Box::pin(fetch::get(
                ctx,
                EGRESS,
                url,
                "application/rss+xml, application/xml",
                BUDGET_MS,
            )) as fetch::Pending<'_>
        })
        .collect();
    let answers = fetch::all(work).await;
    let mut stories: Vec<Story> = Vec::new();
    let mut failed = None;
    for answer in &answers {
        let feed = match read("no news", answer, source.parse_news) {
            Ok(feed) => feed,
            Err(response) => {
                failed = Some(response);
                continue;
            }
        };
        for story in feed {
            if !stories
                .iter()
                .any(|s| s.id == story.id || s.url == story.url)
            {
                stories.push(story);
            }
        }
    }
    if stories.is_empty() {
        return failed.unwrap_or_else(|| failure("no news", &Fetched::Missing));
    }
    stories.sort_by(|a, b| b.published_ms.cmp(&a.published_ms));
    stories.truncate(MAX_STORIES);
    // A feed that failed is asked again soon, not in ten minutes.
    let ttl = if failed.is_some() {
        PARTIAL_NEWS_TTL_MS
    } else {
        NEWS_TTL_MS
    };
    if let Ok(bytes) = serde_json::to_vec(&stories) {
        let _ = cx
            .storage
            .shared()
            .put_expiring("news", &bytes, cx.now_ms + ttl)
            .await;
    }
    Response::json(200, &json!({ "stories": stories, "source": source.name }))
}

fn check_watchlist(watchlist: &Watchlist) -> Result<(), String> {
    if watchlist.symbols.len() > MAX_SYMBOLS {
        return Err(format!("a watchlist holds at most {MAX_SYMBOLS} symbols"));
    }
    for (at, symbol) in watchlist.symbols.iter().enumerate() {
        if !valid_symbol(symbol) {
            return Err(format!("{symbol:?} is not a symbol"));
        }
        if watchlist.symbols[..at].contains(symbol) {
            return Err(format!("{symbol} is listed twice"));
        }
    }
    Ok(())
}

fn check_alerts(alerts: &Alerts) -> Result<(), String> {
    if alerts.alerts.len() > MAX_SYMBOLS {
        return Err(format!("at most {MAX_SYMBOLS} alerts"));
    }
    for (at, alert) in alerts.alerts.iter().enumerate() {
        if !document::valid_key(&alert.id) {
            return Err(format!("{:?} is not an alert id", alert.id));
        }
        if alerts.alerts[..at].iter().any(|other| other.id == alert.id) {
            return Err(format!("alert {} is listed twice", alert.id));
        }
        if !valid_symbol(&alert.symbol) {
            return Err(format!("{:?} is not a symbol", alert.symbol));
        }
        let price_ok = |p: Option<f64>| p.is_none_or(|p| p.is_finite() && p > 0.0);
        if alert.above.is_none() && alert.below.is_none() {
            return Err("an alert needs a price above or below".into());
        }
        if !price_ok(alert.above) || !price_ok(alert.below) {
            return Err("an alert's prices are positive numbers".into());
        }
    }
    Ok(())
}

/// The person's stored document `key`, held to the same rules as a `PUT`
/// (`check`): a stored document that breaks them (written by an older
/// version, or damaged) is answered 503 with the rule it breaks, never shown
/// or acted on as though it were valid.
async fn read_checked<T>(
    cx: &mut ApiCtx<'_>,
    key: &str,
    check: fn(&T) -> Result<(), String>,
) -> Result<document::Current<T>, Response>
where
    T: serde::de::DeserializeOwned,
{
    let current = document::read::<T>(&mut cx.storage.user(), key)
        .await
        .map_err(|error| Response::error(503, &format!("storage failed: {error}")))?;
    if let Some(doc) = &current.doc {
        if let Err(why) = check(doc) {
            return Err(Response::error(
                503,
                &format!("the stored {key} breaks the module's rules: {why}"),
            ));
        }
    }
    Ok(current)
}

/// GET, PUT and DELETE of one of the person's documents.
async fn document_route<T>(
    cx: &mut ApiCtx<'_>,
    key: &str,
    check: fn(&T) -> Result<(), String>,
    reply: fn(Option<&T>, u64) -> Value,
) -> Response
where
    T: serde::Serialize + serde::de::DeserializeOwned,
{
    let session = cx.session;
    match cx.request.method {
        "GET" => match read_checked::<T>(cx, key, check).await {
            Ok(current) => document::for_session(reply(current.doc.as_ref(), current.rev), session),
            Err(response) => response,
        },
        "PUT" => {
            let (doc, rev, named) = match put_body::<T>(cx.request.body) {
                Ok(body) => body,
                Err(response) => return response,
            };
            if let Some(refused) = document::other_session(named.as_deref(), session) {
                return refused;
            }
            if let Err(message) = check(&doc) {
                return Response::error(400, &message);
            }
            match document::write(&mut cx.storage.user(), key, Some(rev), Some(&doc)).await {
                Ok(saved) => document::answer(saved, Some(&doc), reply),
                Err(error) => Response::error(503, &format!("storage failed: {error}")),
            }
        }
        "DELETE" => match document::write::<T>(&mut cx.storage.user(), key, None, None).await {
            Ok(saved) => document::answer(saved, None, reply),
            Err(error) => Response::error(503, &format!("storage failed: {error}")),
        },
        _ => Response::method_not_allowed(),
    }
}

/// Fire every alert that has not fired and whose symbol's quote has crossed
/// its price. Whether any fired.
pub fn evaluate(alerts: &mut [Alert], quotes: &[Quote], now_ms: u64) -> bool {
    let mut changed = false;
    for alert in alerts.iter_mut().filter(|a| a.fired.is_none()) {
        let Some(quote) = quotes
            .iter()
            .find(|q| q.symbol.eq_ignore_ascii_case(&alert.symbol))
        else {
            continue;
        };
        let crossed = alert.above.is_some_and(|above| quote.price >= above)
            || alert.below.is_some_and(|below| quote.price <= below);
        if crossed {
            alert.fired = Some(Fired {
                at: now_ms,
                price: quote.price,
                notified: false,
            });
            changed = true;
        }
    }
    changed
}

/// What Notification Center says of an alert that fired.
fn fired_note(alert: &Alert, price: f64) -> Notification {
    let title = match (alert.above, alert.below) {
        (Some(above), _) if price >= above => format!("{} rose above {above:.2}", alert.symbol),
        (_, Some(below)) if price <= below => format!("{} fell below {below:.2}", alert.symbol),
        _ => alert.symbol.clone(),
    };
    Notification {
        app: MODULE.name.into(),
        id: format!("alert-{}", alert.id),
        title,
        body: Some(format!("Reached {price:.2}")),
        ..Notification::default()
    }
}

/// Check the person's alerts against `quotes`, then save them with what fired
/// and whether the person's notifications have it, whether or not Stocks is
/// open. Delivering comes first: `notify` shows an id once, so a save that does
/// not happen only means it is asked again, and one that fails is saved as
/// still to tell.
async fn check_fired(cx: &mut ApiCtx<'_>, quotes: &[Quote]) -> std::io::Result<()> {
    let now = cx.now_ms;
    let principal = cx.session.principal.clone();
    for _ in 0..4 {
        let current = document::read::<Alerts>(&mut cx.storage.user(), ALERTS).await?;
        let Some(mut doc) = current.doc else {
            return Ok(());
        };
        // Alerts that break the module's rules are not acted on; the read of
        // them answers why.
        if let Err(why) = check_alerts(&doc) {
            return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, why));
        }
        let mut changed = evaluate(&mut doc.alerts, quotes, now);
        for alert in &mut doc.alerts {
            let Some((at, price)) = alert
                .fired
                .as_ref()
                .filter(|fired| !fired.notified)
                .map(|fired| (fired.at, fired.price))
            else {
                continue;
            };
            let note = fired_note(alert, price);
            let store = cx.storage.store();
            match notification_center::notify(store, &principal, at, &note).await {
                Ok(_) => {
                    if let Some(fired) = &mut alert.fired {
                        fired.notified = true;
                        changed = true;
                    }
                }
                Err(error) => {
                    ferrite_app::tracing::warn!(%error, "a price alert's notification was not delivered");
                }
            }
        }
        if !changed {
            return Ok(());
        }
        match document::write(
            &mut cx.storage.user(),
            ALERTS,
            Some(current.rev),
            Some(&doc),
        )
        .await?
        {
            document::Saved::Stored(_) => return Ok(()),
            document::Saved::Conflict(_) => continue,
        }
    }
    Err(std::io::Error::other("the alerts kept changing"))
}

/// `GET /alerts`: the alerts, after checking those that have not fired and
/// telling the person of those that fired without reaching them.
async fn alerts_get(cx: &mut ApiCtx<'_>) -> Response {
    let (armed, untold): (Vec<String>, bool) =
        match read_checked::<Alerts>(cx, ALERTS, check_alerts).await {
            Ok(current) => {
                let mut symbols: Vec<String> = Vec::new();
                let alerts = current.doc.iter().flat_map(|d| &d.alerts);
                for alert in alerts.clone().filter(|a| a.fired.is_none()) {
                    let symbol = alert.symbol.to_uppercase();
                    if !symbols.contains(&symbol) {
                        symbols.push(symbol);
                    }
                }
                let untold = alerts
                    .filter_map(|a| a.fired.as_ref())
                    .any(|fired| !fired.notified);
                (symbols, untold)
            }
            Err(response) => return response,
        };
    // A provider that cannot be reached leaves the alerts as they are: the
    // person still sees them.
    let mut found = Vec::new();
    if !armed.is_empty() {
        if let Ok((answered, _)) = quotes(cx, &armed).await {
            found = answered;
        }
    }
    if !found.is_empty() || untold {
        if let Err(error) = check_fired(cx, &found).await {
            ferrite_app::tracing::warn!(%error, "price alerts not checked");
        }
    }
    let session = cx.session;
    match read_checked::<Alerts>(cx, ALERTS, check_alerts).await {
        Ok(current) => document::for_session(
            json!({ "alerts": current.doc.as_ref().map(|a| &a.alerts), "rev": current.rev }),
            session,
        ),
        Err(response) => response,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn quote(symbol: &str, price: f64) -> Quote {
        Quote {
            symbol: symbol.into(),
            name: symbol.into(),
            price,
            change: 0.0,
            previous_close: None,
            open: None,
            high: None,
            low: None,
            year_high: None,
            year_low: None,
            volume: None,
            market_cap: None,
            pe: None,
            currency: None,
            exchange: None,
            kind: "stock".into(),
            time: None,
        }
    }

    fn alert(id: &str, symbol: &str, above: Option<f64>, below: Option<f64>) -> Alert {
        Alert {
            id: id.into(),
            symbol: symbol.into(),
            above,
            below,
            created: 1,
            fired: None,
        }
    }

    #[test]
    fn the_quotes_lease_is_free_once_it_lapses() {
        assert!(lease_free(None, 5), "never taken");
        assert!(lease_free(Some(0), 5), "handed back");
        assert!(lease_free(Some(5), 5), "lapsed at its end");
        assert!(!lease_free(Some(6), 5), "still held");
        assert!(
            REQUEST_MS + LEASE_SLACK_MS <= 8_000,
            "the quotes leave time for the rest of the request"
        );
    }

    #[test]
    fn a_quotes_call_gets_the_time_its_request_has_left() {
        assert_eq!(call_budget(0), Some(BUDGET_MS), "the whole budget at first");
        assert_eq!(
            call_budget(REQUEST_MS - 2_000),
            Some(2_000),
            "a request that waited calls with what is left"
        );
        assert_eq!(call_budget(REQUEST_MS - MIN_CALL_MS), Some(MIN_CALL_MS));
        assert_eq!(
            call_budget(REQUEST_MS - MIN_CALL_MS + 1),
            None,
            "too little to call"
        );
        assert_eq!(call_budget(REQUEST_MS + 1), None);
    }

    #[test]
    fn a_quotes_call_ends_before_its_lease_however_long_the_reads_before_it_took() {
        // A lease taken at 0 for a call of BUDGET_MS.
        let lease = BUDGET_MS + LEASE_SLACK_MS;
        assert_eq!(call_window(0, 0, lease, BUDGET_MS), Some(BUDGET_MS));
        // Two seconds of reads (the cache, the waiting list) after taking it:
        // the call ends before the lease does, keeping its slack.
        assert_eq!(
            call_window(2_000, 2_000, lease, BUDGET_MS),
            Some(BUDGET_MS - 2_000)
        );
        // A request that had already waited before taking the lease: its own
        // budget is the shorter.
        assert_eq!(
            call_window(REQUEST_MS - 1_500, 0, lease, BUDGET_MS),
            Some(1_500)
        );
        // Too little of the lease left to call.
        assert_eq!(
            call_window(0, BUDGET_MS - MIN_CALL_MS + 1, lease, BUDGET_MS),
            None
        );
        assert_eq!(call_window(0, u64::MAX, lease, BUDGET_MS), None);
    }

    #[test]
    fn the_cache_tells_a_quote_from_an_unknown_symbol() {
        let known = serde_json::to_vec(&Kept::Known(quote("AAPL", 1.0))).unwrap();
        assert_eq!(
            serde_json::from_slice::<Kept>(&known).unwrap(),
            Kept::Known(quote("AAPL", 1.0))
        );
        let unknown = serde_json::to_vec(&Kept::Unknown {
            unknown: "ZZZZQ".into(),
        })
        .unwrap();
        assert_eq!(
            serde_json::from_slice::<Kept>(&unknown).unwrap(),
            Kept::Unknown {
                unknown: "ZZZZQ".into()
            }
        );
        assert!(serde_json::from_slice::<Kept>(b"{}").is_err());
    }

    #[test]
    fn symbol_lists_are_checked_upper_cased_and_unique() {
        assert_eq!(symbols_of("aapl, .spx,AAPL").unwrap(), vec!["AAPL", ".SPX"]);
        assert!(symbols_of("").is_err());
        assert!(symbols_of("AAPL,bad symbol").is_err());
        let many = (0..=MAX_SYMBOLS)
            .map(|n| format!("S{n}"))
            .collect::<Vec<_>>()
            .join(",");
        assert!(symbols_of(&many).is_err());
        assert!(valid_symbol("BRK.B") && valid_symbol("^GSPC") && !valid_symbol("a/b"));
    }

    #[test]
    fn an_alert_fires_once_when_its_price_is_crossed() {
        let mut alerts = vec![
            alert("up", "AAPL", Some(300.0), None),
            alert("down", "AAPL", None, Some(100.0)),
            alert("other", "MSFT", Some(1.0), None),
        ];
        assert!(evaluate(&mut alerts, &[quote("aapl", 344.38)], 7));
        assert_eq!(
            alerts[0].fired,
            Some(Fired {
                at: 7,
                price: 344.38,
                notified: false,
            })
        );
        assert_eq!(alerts[1].fired, None);
        assert_eq!(alerts[2].fired, None, "no quote, no check");
        assert!(
            !evaluate(&mut alerts, &[quote("AAPL", 400.0)], 8),
            "it fires only once"
        );
        assert_eq!(alerts[0].fired.as_ref().unwrap().at, 7);
    }

    #[test]
    fn a_fired_alert_says_what_it_crossed_and_where_it_got_to() {
        let up = fired_note(&alert("a1", "AAPL", Some(300.0), None), 344.38);
        assert_eq!(up.title, "AAPL rose above 300.00");
        assert_eq!(up.body.as_deref(), Some("Reached 344.38"));
        assert_eq!(up.id, "alert-a1");
        assert_eq!(
            fired_note(&alert("a2", "TSLA", None, Some(10.0)), 9.5).title,
            "TSLA fell below 10.00"
        );
        assert_eq!(
            fired_note(&alert("a3", "TSLA", Some(20.0), Some(10.0)), 9.5).title,
            "TSLA fell below 10.00",
            "an alert with both prices says the one it crossed"
        );
    }

    #[test]
    fn alerts_and_watchlists_are_validated() {
        let ok = Alerts {
            alerts: vec![alert("a1", "AAPL", Some(1.0), None)],
        };
        assert!(check_alerts(&ok).is_ok());
        let none = Alerts {
            alerts: vec![alert("a1", "AAPL", None, None)],
        };
        assert!(check_alerts(&none).is_err());
        let negative = Alerts {
            alerts: vec![alert("a1", "AAPL", Some(-1.0), None)],
        };
        assert!(check_alerts(&negative).is_err());
        let twice = Alerts {
            alerts: vec![
                alert("a", "AAPL", Some(1.0), None),
                alert("a", "MSFT", Some(1.0), None),
            ],
        };
        assert!(check_alerts(&twice).is_err());
        assert!(check_watchlist(&Watchlist {
            symbols: vec!["AAPL".into(), ".SPX".into()]
        })
        .is_ok());
        assert!(check_watchlist(&Watchlist {
            symbols: vec!["AAPL".into(), "AAPL".into()]
        })
        .is_err());
        assert!(check_watchlist(&Watchlist {
            symbols: vec!["no way".into()]
        })
        .is_err());
    }

    #[test]
    fn a_quotes_call_asks_for_its_own_symbols_then_those_left_waiting_up_to_the_limit() {
        let list = |items: &[&str]| items.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        // Its own first, then the waiting ones it does not ask for already.
        assert_eq!(
            call_symbols(
                &list(&["AAPL", ".SPX"]),
                &list(&["MSFT", "aapl", "IBM", "MSFT"])
            ),
            (list(&["AAPL", ".SPX", "MSFT", "IBM"]), list(&[]))
        );
        assert_eq!(
            call_symbols(&list(&["AAPL"]), &[]),
            (list(&["AAPL"]), list(&[]))
        );
        // At most MAX_SYMBOLS in one call: the rest wait for the next.
        let own: Vec<String> = (0..MAX_SYMBOLS - 1).map(|n| format!("S{n}")).collect();
        let (call, rest) = call_symbols(&own, &list(&["X1", "X2", "X3"]));
        assert_eq!(call.len(), MAX_SYMBOLS);
        assert_eq!(call.last().map(String::as_str), Some("X1"));
        assert_eq!(rest, list(&["X2", "X3"]));
    }
}

//! Podcasts' server half: Apple's directory and the shows' own feeds, read
//! through the `podcasts` egress handle, and what each person does with them,
//! kept as one document.
//!
//! Nothing here fetches, keeps or relays audio. An episode's enclosure is
//! played by the browser straight from its publisher; the server reads only
//! the directory and the feeds, and keeps the person's library.
//!
//! Directory and feeds, shared by everyone (cached in `storage.shared()`):
//!
//! * `GET /api/podcasts/search?term=<text>`: Apple's search for shows,
//!   `{"term", "results": [show, ...]}`. Each show is `{"id", "title",
//!   "author", "artwork"?, "genre"?, "feed"?, "followable", "reason"?,
//!   "episodes"?}` (`directory.rs`): `followable` says whether the feed is on
//!   one of the hosts this desktop can reach (`hosts.rs`), `reason` why not.
//!   Cached an hour per term (`search/<digest>`).
//! * `GET /api/podcasts/lookup?ids=<id>,<id>,...`: the same for up to 50
//!   show ids (Apple's `collectionId`), cached a day (`lookup/<digest>`).
//! * `GET /api/podcasts/top`: Apple's top chart, `{"shows": [{"id",
//!   "title", "author", "artwork"?, "genre"?}], "fetched"}`, read again after
//!   six hours (`charts/top`); the chart lists no feeds, so the page looks
//!   its shows up.
//! * `GET /api/podcasts/feed?url=<feed>&max_age=<seconds>`: a show's
//!   episodes, `{"feed": {"url", "fetched", "cut", "title", "author"?,
//!   "description"?, "image"?, "link"?, "episodes": [...]}, "stale",
//!   "error"?}` (`episodes.rs`). The cached copy (`feeds/<digest of the
//!   address>`) is answered while it is younger than `max_age` (at least five
//!   minutes, at most thirty days; an hour when absent); otherwise the feed
//!   is read again. A feed that cannot be read again (a fetch cut short
//!   before the feed's first episode with audio ended counts as unread) is
//!   answered from the cached copy with `stale: true` and the `error`, or 502
//!   when there is none. A feed on a host this desktop cannot reach is refused with 400 and
//!   the reason. There is no timer on the server: feeds are refreshed when a
//!   page asks for them, which Podcasts does when it opens and then at the
//!   person's Refresh interval while it stays open.
//! * `GET /api/podcasts/hosts`: `{"egress", "destinations", "feeds"}`, the
//!   egress handle and every destination it must declare, and the feed hosts
//!   whose shows can be followed (the window names them when a show cannot).
//! * `GET /api/podcasts/watch`: looks for new episodes of the person's shows
//!   and delivers each to Notification Center once, whether or not a window
//!   shows it: `{"delivered": n}`. One feed older than the Refresh interval
//!   is read again per request, the rest answer from their kept copies;
//!   Manually watches nothing. This is the only way the server looks: it has
//!   no timer, so a page has to ask.
//!
//! The person's library (`storage.user()`, through `document.rs`):
//!
//! * `GET /api/podcasts/library`: `{"library": {...} | null, "rev": n,
//!   "session": id}`; `null` before the person has saved.
//! * `PUT /api/podcasts/library` with `{"library": {...}, "rev": n}`:
//!   replaces it, or 409 with the current one (`document.rs`).
//! * `DELETE /api/podcasts/library`: forgets it.
//!
//! The library is `{"subscribed": [show, ...], "played": [episode, ...],
//! "positions": {episode: seconds}, "settings": {"refresh", "download",
//! "skipForward", "skipBack", "continuous", "sync"}, "shows": [followed,
//! ...], "queue": [episode, ...], "current": episode | null, "speed"}`:
//! the shows followed with what the window shows of them and the newest
//! episode the person has looked at (`seen`), Up Next, the episode loaded in
//! the player, and the playback speed. Positions are whole seconds, saved
//! every 10 seconds of listening and at every pause and skip. The settings
//! take the choices of `PodcastsSettings`; the "download" choice is kept and
//! does nothing, since no episode is ever downloaded.

use std::collections::{BTreeMap, BTreeSet};

use ferrite_app::{serde, serde_json};

use super::document;
use super::notification_center::{self, Notification};
use crate::applog::Level;
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};

// The RSS and Atom reader, and outside requests through declared egress,
// shared with News and Books (`src/apps/news/`).
use super::news::{feed, fetch};

mod directory;
mod episodes;
mod hosts;

pub const MODULE: AppModule = AppModule {
    name: "podcasts",
    title: "Podcasts",
    handle,
};

/// The egress handle `ferrite.json` declares for Podcasts, with every
/// destination of [`hosts::destinations`] (`GET /api/podcasts/hosts`).
pub const EGRESS: &str = "podcasts";

/// The most episodes played, or positions kept.
pub const MAX_ITEMS: usize = 1_000;
/// The longest position kept, in seconds: a day.
pub const MAX_POSITION: u32 = 86_400;
/// The most shows followed.
pub const MAX_SHOWS: usize = 100;
/// The most episodes in Up Next.
pub const MAX_QUEUE: usize = 50;
/// The largest library, in bytes of JSON: the store keeps values up to
/// 200 KB.
pub const MAX_LIBRARY_BYTES: usize = 190_000;
/// The longest title, publisher or genre kept, in characters: Unicode scalar
/// values (`char`s), which the window counts as a string's code points
/// (`limitText` in `podcasts-server.ts`), not UTF-16 units or bytes.
pub const MAX_TEXT: usize = 200;
/// The longest episode audio address kept, in bytes.
const MAX_AUDIO_URL: usize = 2048;
/// The speeds the player offers.
pub const SPEEDS: &[f64] = &[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
const KEY: &str = "library";
/// The choices of Preferences (`REFRESH_CHOICES`, `DOWNLOAD_CHOICES`,
/// `SKIP_CHOICES`).
const REFRESH: &[&str] = &[
    "Every Hour",
    "Every 6 Hours",
    "Every Day",
    "Every Week",
    "Manually",
];
const DOWNLOAD: &[&str] = &["Only New", "All Unplayed", "Never"];
const SKIPS: &[u32] = &[10, 15, 30, 45, 60];
/// The most episodes of one show a watch tells of at once: the newest.
const WATCH_NOTES_PER_SHOW: usize = 3;

/// The most bytes read of one of Apple's replies.
const APPLE_BYTES: usize = 600_000;
/// The most time spent on one of Apple's replies.
const APPLE_BUDGET_MS: u64 = 6_000;
/// How long a search is answered from the cache.
const SEARCH_CACHE_MS: u64 = 3_600_000;
/// How long a lookup is answered from the cache.
const LOOKUP_CACHE_MS: u64 = 86_400_000;
/// How old the cached chart may be before it is read again.
const CHART_MAX_AGE_MS: u64 = 6 * 3_600_000;
/// The longest search, in characters.
const MAX_TERM: usize = 100;
/// The bounds of a feed request's `max_age`, and its default, in seconds.
const MIN_FEED_AGE_S: u64 = 300;
const MAX_FEED_AGE_S: u64 = 30 * 86_400;
const DEFAULT_FEED_AGE_S: u64 = 3_600;
const FEED_ACCEPT: &str =
    "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.5";

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(
    crate = "ferrite_app::serde",
    deny_unknown_fields,
    rename_all = "camelCase"
)]
pub struct Settings {
    pub refresh: String,
    pub download: String,
    pub skip_forward: u32,
    pub skip_back: u32,
    pub continuous: bool,
    pub sync: bool,
}

/// A show the person follows, with what the window shows of it.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(
    crate = "ferrite_app::serde",
    deny_unknown_fields,
    rename_all = "camelCase"
)]
pub struct Followed {
    /// Apple's id of the show.
    pub id: String,
    pub title: String,
    pub author: String,
    #[serde(default)]
    pub artwork: Option<String>,
    #[serde(default)]
    pub genre: Option<String>,
    /// The feed, on one of [`FEED_HOSTS`].
    pub feed: String,
    /// The publication time (epoch ms) of the newest episode the person has
    /// looked at: episodes published later are new.
    pub seen: u64,
}

/// An episode in Up Next or in the player: what it takes to show and play
/// it after a reload, whether or not its show is followed.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(
    crate = "ferrite_app::serde",
    deny_unknown_fields,
    rename_all = "camelCase"
)]
pub struct Queued {
    /// `<show id>.<item id>`.
    pub id: String,
    pub show: String,
    pub title: String,
    pub show_title: String,
    #[serde(default)]
    pub artwork: Option<String>,
    /// The enclosure, played by the browser from its publisher.
    pub audio: String,
    #[serde(default)]
    pub kind: Option<String>,
    /// Seconds, 0 when the feed does not say.
    #[serde(default)]
    pub duration: u32,
    /// Epoch ms, 0 when the feed does not say.
    #[serde(default)]
    pub published: u64,
    /// The show's feed, to show the episode's notes.
    #[serde(default)]
    pub feed: Option<String>,
}

fn normal_speed() -> f64 {
    1.0
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Library {
    pub subscribed: Vec<String>,
    pub played: Vec<String>,
    pub positions: BTreeMap<String, u32>,
    pub settings: Settings,
    #[serde(default)]
    pub shows: Vec<Followed>,
    #[serde(default)]
    pub queue: Vec<Queued>,
    #[serde(default)]
    pub current: Option<Queued>,
    #[serde(default = "normal_speed")]
    pub speed: f64,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Body {
    library: Library,
    rev: u64,
    #[serde(default)]
    session: Option<String>,
}

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    match (cx.request.method, cx.request.path) {
        (_, "/library") => library(&mut cx).await,
        ("GET", "/search") => search(&mut cx).await,
        ("GET", "/lookup") => lookup(&mut cx).await,
        ("GET", "/top") => top(&mut cx).await,
        ("GET", "/feed") => feed_of(&mut cx).await,
        ("GET", "/watch") => watch(&mut cx).await,
        ("GET", "/hosts") => Response::json(
            200,
            &serde_json::json!({
                "egress": EGRESS,
                "destinations": hosts::destinations(),
                "feeds": hosts::FEED_HOSTS,
            }),
        ),
        (_, "/search" | "/lookup" | "/top" | "/feed" | "/hosts" | "/watch") => {
            Response::method_not_allowed()
        }
        _ => Response::not_found(),
    }
}

async fn library(cx: &mut ApiCtx<'_>) -> Response {
    let session = cx.session;
    let outcome = match cx.request.method {
        "GET" => document::read(&mut cx.storage.user(), KEY)
            .await
            .map(|current| {
                document::for_session(reply(current.doc.as_ref(), current.rev), session)
            }),
        "PUT" => match cx.request.json::<Body>().map(|body| {
            let named = body.session;
            validate(&body.library).map(|()| (body.library, body.rev, named))
        }) {
            Err(response) => Ok(response),
            Ok(Err(message)) => Ok(Response::error(400, &message)),
            Ok(Ok((library, base, named))) => {
                match document::other_session(named.as_deref(), session) {
                    Some(refused) => Ok(refused),
                    None => {
                        document::write(&mut cx.storage.user(), KEY, Some(base), Some(&library))
                            .await
                            .map(|saved| document::answer(saved, Some(&library), reply))
                    }
                }
            }
        },
        "DELETE" => document::write::<Library>(&mut cx.storage.user(), KEY, None, None)
            .await
            .map(|saved| document::answer(saved, None, reply)),
        _ => Ok(Response::method_not_allowed()),
    };
    outcome.unwrap_or_else(|error| Response::error(503, &format!("storage failed: {error}")))
}

fn reply(library: Option<&Library>, rev: u64) -> serde_json::Value {
    serde_json::json!({ "library": library, "rev": rev })
}

/// A list of plain ids, each once, at most `max`.
fn ids(what: &str, list: &[String], max: usize) -> Result<(), String> {
    if list.len() > max {
        return Err(format!("at most {max} {what}"));
    }
    let mut seen = BTreeSet::new();
    for id in list {
        if !document::valid_key(id) || !seen.insert(id.as_str()) {
            return Err(format!("{what}: {id:?} is not a plain id listed once"));
        }
    }
    Ok(())
}

/// A title or publisher: at most [`MAX_TEXT`] characters, and some text
/// when `required`.
fn text(what: &str, value: &str, required: bool) -> Result<(), String> {
    if value.chars().count() > MAX_TEXT {
        return Err(format!("{what} is longer than {MAX_TEXT} characters"));
    }
    if required && value.trim().is_empty() {
        return Err(format!("{what} is empty"));
    }
    Ok(())
}

/// A web address as the feed reader keeps one, at most `max` bytes.
fn address(what: &str, value: &str, max: usize) -> Result<(), String> {
    if value.len() <= max && feed::web_url(value).as_deref() == Some(value) {
        Ok(())
    } else {
        Err(format!(
            "{what} is not a web address of at most {max} bytes"
        ))
    }
}

/// A feed address as [`hosts::followable`] writes it.
fn followed_feed(value: &str) -> Result<(), String> {
    match hosts::followable(Some(value)) {
        Ok(url) if url == value => Ok(()),
        Ok(url) => Err(format!("the feed {value:?} is read as {url:?}; send that")),
        Err(reason) => Err(format!("the feed {value:?} cannot be followed: {reason}")),
    }
}

fn episode(what: &str, item: &Queued) -> Result<(), String> {
    if !document::valid_key(&item.id) || !document::valid_key(&item.show) {
        return Err(format!(
            "{what}: {:?} of {:?} is not a plain id",
            item.id, item.show
        ));
    }
    text("an episode's title", &item.title, true)?;
    text("a show's title", &item.show_title, false)?;
    if let Some(artwork) = &item.artwork {
        address("an episode's artwork", artwork, hosts::MAX_FEED_URL)?;
    }
    address("an episode's audio", &item.audio, MAX_AUDIO_URL)?;
    if let Some(kind) = &item.kind {
        if kind.len() > 100 || !(kind.starts_with("audio/") || kind.starts_with("video/")) {
            return Err(format!("{kind:?} is not an audio or video type"));
        }
    }
    if item.duration > MAX_POSITION {
        return Err(format!("an episode is at most {MAX_POSITION} seconds long"));
    }
    if let Some(feed) = &item.feed {
        followed_feed(feed)?;
    }
    Ok(())
}

/// Check a submitted library.
fn validate(library: &Library) -> Result<(), String> {
    ids("shows followed", &library.subscribed, MAX_ITEMS)?;
    ids("episodes played", &library.played, MAX_ITEMS)?;
    if library.positions.len() > MAX_ITEMS {
        return Err(format!("at most {MAX_ITEMS} positions"));
    }
    for (episode, seconds) in &library.positions {
        if !document::valid_key(episode) {
            return Err(format!("episode id {episode:?} is not a plain id"));
        }
        if *seconds > MAX_POSITION {
            return Err(format!("a position is at most {MAX_POSITION} seconds"));
        }
    }
    let settings = &library.settings;
    if !REFRESH.contains(&settings.refresh.as_str()) {
        return Err(format!("{:?} is not a refresh choice", settings.refresh));
    }
    if !DOWNLOAD.contains(&settings.download.as_str()) {
        return Err(format!("{:?} is not a download choice", settings.download));
    }
    if !SKIPS.contains(&settings.skip_forward) || !SKIPS.contains(&settings.skip_back) {
        return Err(format!("a skip is one of {SKIPS:?} seconds"));
    }
    if !SPEEDS.contains(&library.speed) {
        return Err(format!("a speed is one of {SPEEDS:?}"));
    }

    if library.shows.len() > MAX_SHOWS {
        return Err(format!("at most {MAX_SHOWS} shows followed"));
    }
    let mut shows = BTreeSet::new();
    for show in &library.shows {
        if !document::valid_key(&show.id) || !shows.insert(show.id.as_str()) {
            return Err(format!(
                "shows: {:?} is not a plain id listed once",
                show.id
            ));
        }
        text("a show's title", &show.title, true)?;
        text("a show's publisher", &show.author, false)?;
        if let Some(genre) = &show.genre {
            text("a show's genre", genre, false)?;
        }
        if let Some(artwork) = &show.artwork {
            address("a show's artwork", artwork, hosts::MAX_FEED_URL)?;
        }
        followed_feed(&show.feed)?;
    }

    if library.queue.len() > MAX_QUEUE {
        return Err(format!("at most {MAX_QUEUE} episodes in Up Next"));
    }
    let mut queued = BTreeSet::new();
    for item in &library.queue {
        episode("Up Next", item)?;
        if !queued.insert(item.id.as_str()) {
            return Err(format!("Up Next lists {:?} twice", item.id));
        }
    }
    if let Some(current) = &library.current {
        episode("the episode loaded", current)?;
    }

    let bytes = serde_json::to_vec(library).map_or(usize::MAX, |b| b.len());
    if bytes > MAX_LIBRARY_BYTES {
        return Err(format!(
            "the library is {bytes} bytes; at most {MAX_LIBRARY_BYTES} are kept"
        ));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Apple's directory and the feeds
// ---------------------------------------------------------------------------

/// Query parameter `name`, percent-decoded.
fn query(cx: &ApiCtx<'_>, name: &str) -> Result<String, Response> {
    let raw = cx.request.query_param(name).unwrap_or("");
    fetch::decode_query(raw).ok_or_else(|| {
        Response::error(
            400,
            &format!("the {name} is not valid percent-encoded UTF-8"),
        )
    })
}

/// The reply to an outside request that got no answer.
fn unanswered(error: &fetch::FetchError) -> Response {
    match error {
        fetch::FetchError::NoEgress(_) => Response::error(503, &error.to_string()),
        _ => Response::error(502, &error.to_string()),
    }
}

/// One of Apple's replies, whole.
async fn apple(cx: &ApiCtx<'_>, url: &str) -> Result<Vec<u8>, Response> {
    match fetch::get(
        cx.ctx,
        EGRESS,
        url,
        "application/json",
        APPLE_BYTES,
        APPLE_BUDGET_MS,
    )
    .await
    {
        Ok(got) if got.status == 200 && !got.cut => Ok(got.body),
        Ok(got) if got.status == 200 => Err(Response::error(
            502,
            "Apple's directory did not answer in time",
        )),
        Ok(got) => Err(Response::error(
            502,
            &format!("Apple's directory answered HTTP {}", got.status),
        )),
        Err(error) => Err(unanswered(&error)),
    }
}

async fn search(cx: &mut ApiCtx<'_>) -> Response {
    let term = match query(cx, "term") {
        Ok(term) => term.trim().to_string(),
        Err(response) => return response,
    };
    if term.is_empty() || term.chars().count() > MAX_TERM {
        return Response::error(400, &format!("a search is 1 to {MAX_TERM} characters"));
    }
    let key = format!("search/{}", feed::item_id(&term.to_lowercase()));
    if let Ok(Some(results)) = cx
        .storage
        .shared()
        .get_json::<Vec<directory::Listing>>(&key)
        .await
    {
        return Response::json(
            200,
            &serde_json::json!({ "term": term, "results": results }),
        );
    }
    let url = format!(
        "{}?media=podcast&entity=podcast&limit=25&term={}",
        hosts::SEARCH_URL,
        fetch::encode_query(&term)
    );
    let body = match apple(cx, &url).await {
        Ok(body) => body,
        Err(response) => return response,
    };
    match directory::listings(&body) {
        Ok(results) => {
            if let Ok(bytes) = serde_json::to_vec(&results) {
                let expires = cx.now_ms + SEARCH_CACHE_MS;
                let _ = cx
                    .storage
                    .shared()
                    .put_expiring(&key, &bytes, expires)
                    .await;
            }
            Response::json(
                200,
                &serde_json::json!({ "term": term, "results": results }),
            )
        }
        Err(error) => Response::error(502, &error),
    }
}

async fn lookup(cx: &mut ApiCtx<'_>) -> Response {
    let raw = match query(cx, "ids") {
        Ok(raw) => raw,
        Err(response) => return response,
    };
    let mut ids: Vec<&str> = raw
        .split(',')
        .map(str::trim)
        .filter(|id| !id.is_empty())
        .collect();
    ids.sort_unstable();
    ids.dedup();
    if ids.is_empty()
        || ids.len() > directory::MAX_RESULTS
        || !ids.iter().all(|id| directory::valid_id(id))
    {
        return Response::error(
            400,
            &format!(
                "ids are 1 to {} show ids, separated by commas",
                directory::MAX_RESULTS
            ),
        );
    }
    let joined = ids.join(",");
    let key = format!("lookup/{}", feed::item_id(&joined));
    if let Ok(Some(results)) = cx
        .storage
        .shared()
        .get_json::<Vec<directory::Listing>>(&key)
        .await
    {
        return Response::json(200, &serde_json::json!({ "results": results }));
    }
    let body = match apple(cx, &format!("{}?id={joined}", hosts::LOOKUP_URL)).await {
        Ok(body) => body,
        Err(response) => return response,
    };
    match directory::listings(&body) {
        Ok(results) => {
            if let Ok(bytes) = serde_json::to_vec(&results) {
                let expires = cx.now_ms + LOOKUP_CACHE_MS;
                let _ = cx
                    .storage
                    .shared()
                    .put_expiring(&key, &bytes, expires)
                    .await;
            }
            Response::json(200, &serde_json::json!({ "results": results }))
        }
        Err(error) => Response::error(502, &error),
    }
}

/// The chart as cached.
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Chart {
    fetched: u64,
    shows: Vec<directory::Charted>,
}

const CHART_KEY: &str = "charts/top";

async fn top(cx: &mut ApiCtx<'_>) -> Response {
    let cached = cx
        .storage
        .shared()
        .get_json::<Chart>(CHART_KEY)
        .await
        .ok()
        .flatten();
    let answer = |chart: &Chart, error: Option<&str>| {
        Response::json(
            200,
            &serde_json::json!({
                "shows": chart.shows,
                "fetched": chart.fetched,
                "stale": error.is_some(),
                "error": error,
            }),
        )
    };
    if let Some(chart) = &cached {
        if cx.now_ms.saturating_sub(chart.fetched) < CHART_MAX_AGE_MS {
            return answer(chart, None);
        }
    }
    let read = match apple(cx, hosts::CHART_URL).await {
        Ok(body) => directory::chart(&body).map_err(|error| Response::error(502, &error)),
        Err(response) => Err(response),
    };
    match read {
        Ok(shows) => {
            let chart = Chart {
                fetched: cx.now_ms,
                shows,
            };
            let _ = cx.storage.shared().put_json(CHART_KEY, &chart).await;
            answer(&chart, None)
        }
        Err(response) => match &cached {
            Some(chart) => answer(chart, Some("Apple's chart could not be read again")),
            None => response,
        },
    }
}

async fn feed_of(cx: &mut ApiCtx<'_>) -> Response {
    let raw = match query(cx, "url") {
        Ok(raw) => raw,
        Err(response) => return response,
    };
    let url = match hosts::followable(Some(&raw)) {
        Ok(url) => url,
        Err(reason) => {
            return Response::json(
                400,
                &serde_json::json!({ "error": reason, "followable": false }),
            )
        }
    };
    let max_age_s = match cx.request.query_param("max_age").filter(|v| !v.is_empty()) {
        None => DEFAULT_FEED_AGE_S,
        Some(value) => match value.parse::<u64>() {
            Ok(seconds) => seconds.clamp(MIN_FEED_AGE_S, MAX_FEED_AGE_S),
            Err(_) => return Response::error(400, "max_age is a number of seconds"),
        },
    };
    let key = episodes::key(&url);
    let cached = cx
        .storage
        .shared()
        .get_json::<episodes::CachedFeed>(&key)
        .await
        .ok()
        .flatten()
        .filter(|entry| entry.url == url);
    let answer = |entry: &episodes::CachedFeed, error: Option<&str>| {
        Response::json(
            200,
            &serde_json::json!({ "feed": entry, "stale": error.is_some(), "error": error }),
        )
    };
    if let Some(entry) = &cached {
        if cx.now_ms.saturating_sub(entry.fetched) < max_age_s * 1000 {
            return answer(entry, None);
        }
    }
    match read_again(cx, &url).await {
        Ok(entry) => answer(&entry, None),
        Err((status, reason)) => match &cached {
            Some(entry) => answer(entry, Some(&reason)),
            None => Response::error(status, &reason),
        },
    }
}

/// Reads a feed from its publisher and keeps it for everyone. The status is
/// what a request with no kept copy to fall back on answers.
async fn read_again(cx: &mut ApiCtx<'_>, url: &str) -> Result<episodes::CachedFeed, (u16, String)> {
    let fetched = fetch::get(
        cx.ctx,
        EGRESS,
        url,
        FEED_ACCEPT,
        episodes::FEED_BYTES,
        episodes::FEED_BUDGET_MS,
    )
    .await;
    let (read, status) = match fetched {
        Ok(got) if got.status == 200 => (episodes::read(url, cx.now_ms, &got.body, got.cut), 502),
        Ok(got) if (300..400).contains(&got.status) => (
            Err(format!(
                "the feed moved (HTTP {}), and this desktop follows no redirect",
                got.status
            )),
            502,
        ),
        Ok(got) => (
            Err(format!("the feed's host answered HTTP {}", got.status)),
            502,
        ),
        Err(error) => (Err(error.to_string()), unanswered(&error).status),
    };
    match read {
        Ok(entry) => {
            let _ = cx
                .storage
                .shared()
                .put_json(&episodes::key(url), &entry)
                .await;
            Ok(entry)
        }
        Err(reason) => {
            let host = url.split('/').nth(2).unwrap_or("").to_string();
            cx.log(
                Level::Error,
                "feeds",
                &format!("the feed at {host} could not be read: {reason}"),
            )
            .await;
            Err((status, reason))
        }
    }
}

/// How long a followed show's feed rests between a watch's reads, by the
/// Refresh setting; `None` for Manually.
fn watch_age_ms(refresh: &str) -> Option<u64> {
    let hours = match refresh {
        "Every Hour" => 1,
        "Every 6 Hours" => 6,
        "Every Day" => 24,
        "Every Week" => 168,
        _ => return None,
    };
    Some(hours * 3_600_000)
}

/// The notifications of `feed`'s episodes published after the person last
/// looked at `show`, newest first. A show with no such time tells of nothing:
/// its back catalogue is not news.
fn new_episode_notes(show: &Followed, feed: &episodes::CachedFeed) -> Vec<Notification> {
    if show.seen == 0 {
        return Vec::new();
    }
    let mut new: Vec<_> = feed
        .episodes
        .iter()
        .filter(|item| item.published.is_some_and(|at| at > show.seen))
        .collect();
    new.sort_by_key(|item| std::cmp::Reverse(item.published));
    new.into_iter()
        .take(WATCH_NOTES_PER_SHOW)
        .map(|item| Notification {
            app: MODULE.name.into(),
            id: format!("episode-{}.{}", show.id, item.id),
            title: show.title.clone(),
            subtitle: Some("New Episode".into()),
            body: Some(item.title.clone()),
            ..Notification::default()
        })
        .collect()
}

/// The feed a watch reads again this minute among those due, turn about, so
/// that one that keeps failing does not hold up the rest.
fn due_feed(due: &[usize], now_ms: u64) -> Option<usize> {
    let minute = usize::try_from(now_ms / 60_000).unwrap_or(0);
    due.get(minute.checked_rem(due.len())?).copied()
}

async fn watch(cx: &mut ApiCtx<'_>) -> Response {
    let library = match document::read::<Library>(&mut cx.storage.user(), KEY).await {
        Ok(current) => current.doc,
        Err(error) => return Response::error(500, &error.to_string()),
    };
    let Some(library) = library else {
        return Response::json(200, &serde_json::json!({ "delivered": 0 }));
    };
    let Some(age) = watch_age_ms(&library.settings.refresh) else {
        return Response::json(200, &serde_json::json!({ "delivered": 0 }));
    };
    let now = cx.now_ms;
    let mut kept: Vec<Option<episodes::CachedFeed>> = Vec::with_capacity(library.shows.len());
    for show in &library.shows {
        kept.push(
            cx.storage
                .shared()
                .get_json::<episodes::CachedFeed>(&episodes::key(&show.feed))
                .await
                .ok()
                .flatten()
                .filter(|entry| entry.url == show.feed),
        );
    }
    let due: Vec<usize> = kept
        .iter()
        .enumerate()
        .filter(|(_, entry)| {
            entry
                .as_ref()
                .is_none_or(|entry| now.saturating_sub(entry.fetched) >= age)
        })
        .map(|(at, _)| at)
        .collect();
    if let Some(at) = due_feed(&due, now) {
        if let Ok(entry) = read_again(cx, &library.shows[at].feed).await {
            kept[at] = Some(entry);
        }
    }
    let principal = cx.session.principal.clone();
    let mut delivered = 0;
    for (show, entry) in library.shows.iter().zip(&kept) {
        let Some(entry) = entry else { continue };
        for note in new_episode_notes(show, entry) {
            let store = cx.storage.store();
            match notification_center::notify(store, &principal, now, &note).await {
                Ok(true) => delivered += 1,
                Ok(false) => {}
                Err(error) => {
                    ferrite_app::tracing::warn!(%error, "a new episode's notification was not delivered");
                }
            }
        }
    }
    Response::json(200, &serde_json::json!({ "delivered": delivered }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn followed(seen: u64) -> Followed {
        Followed {
            id: "510318".into(),
            title: "Up First".into(),
            author: "NPR".into(),
            artwork: None,
            genre: None,
            feed: "https://feeds.npr.org/510318/podcast.xml".into(),
            seen,
        }
    }

    fn feed_of_times(times: &[Option<u64>]) -> episodes::CachedFeed {
        episodes::CachedFeed {
            url: "https://feeds.npr.org/510318/podcast.xml".into(),
            fetched: 1,
            cut: false,
            title: "Up First".into(),
            author: None,
            description: None,
            image: None,
            link: None,
            episodes: times
                .iter()
                .enumerate()
                .map(|(at, published)| feed::Item {
                    id: format!("e{at}"),
                    title: format!("Episode {at}"),
                    published: *published,
                    ..feed::Item::default()
                })
                .collect(),
        }
    }

    #[test]
    fn a_watch_tells_of_episodes_after_the_last_look_newest_first() {
        let notes = new_episode_notes(
            &followed(100),
            &feed_of_times(&[Some(90), Some(300), None, Some(200), Some(100)]),
        );
        let told: Vec<_> = notes
            .iter()
            .map(|note| (note.id.as_str(), note.body.as_deref()))
            .collect();
        assert_eq!(
            told,
            [
                ("episode-510318.e1", Some("Episode 1")),
                ("episode-510318.e3", Some("Episode 3")),
            ]
        );
        assert_eq!(notes[0].app, "podcasts");
        assert_eq!(notes[0].title, "Up First");
        assert_eq!(notes[0].subtitle.as_deref(), Some("New Episode"));
    }

    #[test]
    fn a_watch_tells_of_three_at_most_and_nothing_of_a_show_never_looked_at() {
        let times = [Some(5), Some(4), Some(3), Some(2)];
        assert_eq!(
            new_episode_notes(&followed(1), &feed_of_times(&times)).len(),
            3
        );
        assert!(new_episode_notes(&followed(0), &feed_of_times(&times)).is_empty());
    }

    #[test]
    fn a_watch_follows_the_refresh_setting() {
        assert_eq!(watch_age_ms("Every Hour"), Some(3_600_000));
        assert_eq!(watch_age_ms("Every Week"), Some(604_800_000));
        assert_eq!(watch_age_ms("Manually"), None);
    }

    #[test]
    fn a_watch_takes_the_due_feeds_in_turn() {
        assert_eq!(due_feed(&[], 0), None);
        assert_eq!(due_feed(&[4, 7], 0), Some(4));
        assert_eq!(due_feed(&[4, 7], 60_000), Some(7));
        assert_eq!(due_feed(&[4, 7], 120_000), Some(4));
    }

    fn sample() -> Library {
        serde_json::from_str(
            r#"{"subscribed":["signal-path"],"played":["signal-path-11"],
                "positions":{"signal-path-12":120},
                "settings":{"refresh":"Every Hour","download":"Only New","skipForward":30,
                            "skipBack":15,"continuous":true,"sync":true}}"#,
        )
        .unwrap()
    }

    fn real() -> Library {
        serde_json::from_str(
            r#"{"subscribed":["510318"],"played":[],"positions":{"510318.0123456789abcdef":95},
                "settings":{"refresh":"Every Day","download":"Never","skipForward":30,
                            "skipBack":15,"continuous":true,"sync":false},
                "shows":[{"id":"510318","title":"Up First from NPR","author":"NPR",
                          "artwork":"https://is1-ssl.mzstatic.com/a/600x600bb.jpg","genre":"Daily News",
                          "feed":"https://feeds.npr.org/510318/podcast.xml","seen":1791892800000}],
                "queue":[{"id":"510318.fedcba9876543210","show":"510318","title":"Tuesday",
                           "showTitle":"Up First from NPR","artwork":null,
                           "audio":"https://play.podtrac.com/npr-510318/x.mp3","kind":"audio/mpeg",
                           "duration":900,"published":1791892800000,
                           "feed":"https://feeds.npr.org/510318/podcast.xml"}],
                "current":null,"speed":1.5}"#,
        )
        .unwrap()
    }

    #[test]
    fn the_demo_s_library_round_trips_in_its_field_names() {
        let library = sample();
        assert!(validate(&library).is_ok());
        assert_eq!(library.speed, 1.0, "a library saved before speeds had none");
        assert!(library.shows.is_empty() && library.queue.is_empty() && library.current.is_none());
        let text = serde_json::to_string(&library).unwrap();
        assert!(text.contains(r#""skipForward":30"#), "{text}");
        assert_eq!(serde_json::from_str::<Library>(&text).unwrap(), library);
    }

    #[test]
    fn a_library_of_real_shows_round_trips() {
        let library = real();
        assert_eq!(validate(&library), Ok(()));
        let text = serde_json::to_string(&library).unwrap();
        assert!(
            text.contains(r#""showTitle":"Up First from NPR""#),
            "{text}"
        );
        assert_eq!(serde_json::from_str::<Library>(&text).unwrap(), library);
    }

    #[test]
    fn bad_libraries_are_refused() {
        let mut twice = sample();
        twice.subscribed.push("signal-path".into());
        assert!(validate(&twice).is_err(), "a show followed twice");

        let mut skip = sample();
        skip.settings.skip_forward = 20;
        assert!(
            validate(&skip).is_err(),
            "a skip Preferences does not offer"
        );

        let mut refresh = sample();
        refresh.settings.refresh = "Hourly".into();
        assert!(validate(&refresh).is_err(), "an unknown refresh");

        let mut long = sample();
        long.positions.insert("x".into(), MAX_POSITION + 1);
        assert!(validate(&long).is_err(), "a position past a day");

        let mut stray = sample();
        stray.played.push("a b".into());
        assert!(validate(&stray).is_err(), "an id that is not plain");
    }

    #[test]
    fn bad_shows_episodes_and_speeds_are_refused() {
        let refused = |change: &dyn Fn(&mut Library), why: &str| {
            let mut library = real();
            change(&mut library);
            assert!(validate(&library).is_err(), "{why}");
        };
        refused(&|l| l.speed = 3.0, "a speed the player does not offer");
        refused(&|l| l.speed = 1.1, "a speed between the choices");
        refused(
            &|l| l.shows[0].feed = "https://example.com/feed.xml".into(),
            "a feed on a host this desktop cannot reach",
        );
        refused(
            &|l| l.shows[0].feed = "http://feeds.npr.org/510318/podcast.xml".into(),
            "a feed not in the form the server reads it",
        );
        refused(
            &|l| l.shows.push(l.shows[0].clone()),
            "a show followed twice",
        );
        refused(
            &|l| l.shows[0].title = "x".repeat(MAX_TEXT + 1),
            "a title too long",
        );
        refused(&|l| l.shows[0].title = " ".into(), "a show without a title");
        refused(
            &|l| l.shows[0].artwork = Some("javascript:alert(1)".into()),
            "artwork that is no web address",
        );
        refused(
            &|l| l.queue[0].audio = "data:audio/mpeg;base64,AA".into(),
            "audio that is no web address",
        );
        refused(
            &|l| l.queue[0].kind = Some("text/html".into()),
            "an enclosure that is no audio",
        );
        refused(
            &|l| l.queue.push(l.queue[0].clone()),
            "an episode queued twice",
        );
        refused(
            &|l| l.queue[0].id = "a/b".into(),
            "an episode id that is not plain",
        );
        refused(
            &|l| {
                l.current = Some(Queued {
                    duration: MAX_POSITION + 1,
                    ..l.queue[0].clone()
                })
            },
            "an episode longer than a day",
        );
        refused(
            &|l| {
                let first = l.queue[0].clone();
                l.queue = (0..=MAX_QUEUE)
                    .map(|n| Queued {
                        id: format!("510318.{n}"),
                        ..first.clone()
                    })
                    .collect();
            },
            "Up Next past its limit",
        );
        refused(
            &|l| {
                let first = l.shows[0].clone();
                l.shows = (0..=MAX_SHOWS)
                    .map(|n| Followed {
                        id: n.to_string(),
                        ..first.clone()
                    })
                    .collect();
            },
            "more shows than are followed",
        );
    }

    #[test]
    fn text_is_limited_in_characters_as_the_window_counts_them() {
        let mut library = real();
        // 200 characters that are 400 UTF-16 units and 800 bytes, and 200 of two bytes each.
        library.shows[0].title = "\u{1F399}".repeat(MAX_TEXT);
        library.shows[0].author = "\u{e9}".repeat(MAX_TEXT);
        library.queue[0].title = format!("{}\u{2026}", "\u{1F399}".repeat(MAX_TEXT - 1));
        assert_eq!(validate(&library), Ok(()));
        library.shows[0].author.push('\u{e9}');
        assert!(validate(&library).is_err(), "201 characters");
    }

    #[test]
    fn a_library_too_large_for_the_store_is_refused() {
        let mut library = real();
        let first = library.queue[0].clone();
        library.queue = (0..MAX_QUEUE)
            .map(|n| Queued {
                id: format!("510318.{n}"),
                audio: format!("https://play.example.org/{}", "a".repeat(1900)),
                ..first.clone()
            })
            .collect();
        assert_eq!(validate(&library), Ok(()), "50 long episodes still fit");
        library.played = (0..MAX_ITEMS)
            .map(|n| format!("{n}.{}", "e".repeat(100)))
            .collect();
        let refused = validate(&library).unwrap_err();
        assert!(refused.contains("at most 190000"), "{refused}");
    }
}

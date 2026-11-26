//! News' server half: real stories from publishers' RSS and Atom feeds, read
//! through the application's declared egress, and each person's channels,
//! saved stories and history.
//!
//! * `GET /api/news/catalogue`: the publishers a person can follow
//!   (`channels`), the `topics` of the sidebar with the feeds each merges, and
//!   the channels followed by default.
//! * `GET /api/news/sources/<id>`: one feed's stories, newest first as the
//!   publisher lists them: `{"source": {...}, "fetched": ms, "stale": bool,
//!   "error"?: text, "stories": [...]}`. A feed is kept in the shared space
//!   for every reader and read again from the publisher when it is older than
//!   [`FRESH_MS`] and someone asks for it, so no timer polls publishers nobody
//!   reads. While one request refreshes a feed, others are answered from the
//!   copy kept (`stale: true`). A refresh that fails answers the copy kept with
//!   the reason, or 502 when there is none, and the feed is not asked for
//!   again for [`FAILED_BACKOFF_MS`]. With `?fresh=1` (View > Reload) the copy
//!   counts as current only for [`RELOAD_FLOOR_MS`], so a reload reads the
//!   publisher without one person's key held down reaching them. Every such 502 carries `retry-after`,
//!   the back-off still to run in seconds.
//! * `GET`/`PUT`/`DELETE /api/news/library`: the person's document
//!   (`document.rs`): `{"following": [channel], "blocked": [channel],
//!   "saved": [story], "history": [story]}`, a story being the snapshot the
//!   window shows (`id`, `source`, `publisher`, `title`, `link`, `image`,
//!   `published`, and for a saved story a `summary` of at most 300
//!   characters), so a saved story stays readable after its feed moves on.
//!
//! What a story is: the headline, summary, picture and link the publisher
//! puts in its feed. This module never fetches or stores articles: the window
//! reads a story's article through Safari's route (`GET /api/safari/page`, the
//! listed sites only, kept nowhere), or opens it at the publisher's site in
//! Safari or a browser tab.

use std::collections::BTreeSet;

use ferrite_app::{serde, serde_json};

use super::document;
use crate::applog::Level;
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};

/// The RSS and Atom reader, shared with Podcasts and Books.
pub(crate) mod feed;
/// Outside requests through declared egress, shared with Podcasts and Books.
pub(crate) mod fetch;
pub mod sources;

pub const MODULE: AppModule = AppModule {
    name: "news",
    title: "News",
    handle,
};

/// The egress handle `ferrite.json` declares with every feed of [`sources`].
pub const EGRESS: &str = "news";
/// How long a feed kept in the shared space counts as current: 15 minutes.
pub const FRESH_MS: u64 = 15 * 60 * 1000;
/// How old a feed must be for a reload to read it from the publisher again.
pub const RELOAD_FLOOR_MS: u64 = 60 * 1000;
/// How long one request may hold the right to refresh a feed.
const CLAIM_MS: u64 = 20_000;
/// How long a feed whose read failed is left alone before it is tried again.
pub const FAILED_BACKOFF_MS: u64 = 2 * 60 * 1000;
/// The most bytes of a feed read: its newest stories come first.
const FEED_BYTES: usize = 900 * 1024;
/// The time one refresh may take, inside the gateway's 8-second deadline.
const BUDGET_MS: u64 = 6_000;
const ACCEPT: &str =
    "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8";
const LIMITS: feed::Limits = feed::Limits {
    items: 40,
    summary_chars: 1_200,
};

/// The most channels followed or blocked.
pub const MAX_CHANNELS: usize = 100;
/// The most saved stories.
pub const MAX_SAVED: usize = 150;
/// The most stories in History.
pub const MAX_HISTORY: usize = 60;
/// The largest stored library, in bytes of JSON.
pub const MAX_LIBRARY_BYTES: usize = 200_000;
const KEY: &str = "library";

/// A feed as the shared space keeps it.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
struct Kept {
    fetched: u64,
    stories: Vec<feed::Item>,
}

/// A story as the window keeps it in Saved Stories and History. A saved
/// story keeps a short summary too (at most [`MAX_SAVED_SUMMARY`]
/// characters), so it still says what it is about once its feed has moved
/// on; History keeps none.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Story {
    pub id: String,
    pub source: String,
    pub publisher: String,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub link: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub published: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
}

/// The longest summary a saved story keeps, in characters.
pub const MAX_SAVED_SUMMARY: usize = 300;

/// A person's News.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Library {
    pub following: Vec<String>,
    pub blocked: Vec<String>,
    pub saved: Vec<Story>,
    pub history: Vec<Story>,
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
    let path = cx.request.path;
    if path == "/catalogue" {
        return match cx.request.method {
            "GET" => Response::json(200, &catalogue()),
            _ => Response::method_not_allowed(),
        };
    }
    if let Some(id) = path.strip_prefix("/sources/") {
        return match cx.request.method {
            "GET" => source(&mut cx, id).await,
            _ => Response::method_not_allowed(),
        };
    }
    let session = cx.session;
    let outcome = match (cx.request.method, path) {
        ("GET", "/library") => document::read(&mut cx.storage.user(), KEY)
            .await
            .map(|current| {
                document::for_session(reply(current.doc.as_ref(), current.rev), session)
            }),
        ("PUT", "/library") => match cx.request.json::<Body>().map(|body| {
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
        ("DELETE", "/library") => {
            document::write::<Library>(&mut cx.storage.user(), KEY, None, None)
                .await
                .map(|saved| document::answer(saved, None, reply))
        }
        (_, "/library") => Ok(Response::method_not_allowed()),
        _ => Ok(Response::not_found()),
    };
    outcome.unwrap_or_else(|error| Response::error(503, &format!("storage failed: {error}")))
}

fn reply(library: Option<&Library>, rev: u64) -> serde_json::Value {
    serde_json::json!({ "library": library, "rev": rev })
}

/// The `GET /api/news/catalogue` body.
pub fn catalogue() -> serde_json::Value {
    let channels: Vec<_> = sources::CHANNELS
        .iter()
        .filter_map(|c| {
            let source = sources::find(c.id)?;
            Some(serde_json::json!({ "id": c.id, "name": c.name, "tint": c.tint, "site": source.site }))
        })
        .collect();
    let topics: Vec<_> = sources::TOPICS
        .iter()
        .map(|t| serde_json::json!({ "id": t.id, "name": t.name, "tint": t.tint, "sources": t.sources }))
        .collect();
    serde_json::json!({
        "channels": channels,
        "topics": topics,
        "following": sources::DEFAULT_FOLLOWING,
        "freshMs": FRESH_MS,
    })
}

fn source_reply(
    source: &sources::Source,
    kept: &Kept,
    stale: bool,
    error: Option<&str>,
) -> Response {
    let mut body = serde_json::json!({
        "source": { "id": source.id, "publisher": source.publisher, "site": source.site },
        "fetched": kept.fetched,
        "stale": stale,
        "stories": kept.stories,
    });
    if let (Some(error), Some(object)) = (error, body.as_object_mut()) {
        object.insert("error".into(), error.into());
    }
    Response::json(200, &body)
}

async fn source(cx: &mut ApiCtx<'_>, id: &str) -> Response {
    let Some(source) = sources::find(id) else {
        return Response::error(404, &format!("News reads no feed called '{id}'"));
    };
    let key = format!("sources/{id}");
    let now = cx.now_ms;
    let current_for = if cx.request.query_param("fresh") == Some("1") {
        RELOAD_FLOOR_MS
    } else {
        FRESH_MS
    };
    let kept: Option<Kept> = match cx.storage.shared().get_json(&key).await {
        Ok(kept) => kept,
        Err(error) => {
            ferrite_app::tracing::warn!(%error, id, "could not read the kept feed");
            None
        }
    };
    if let Some(kept) = &kept {
        if now.saturating_sub(kept.fetched) < current_for {
            return source_reply(source, kept, false, None);
        }
    }
    // A feed that failed lately is not asked for again until its back-off
    // ends: requests meanwhile get the kept copy, or the failure, at once.
    let failed_key = format!("failed/{id}");
    if let Some(answer) = backed_off(cx, source, &failed_key, kept.as_ref()).await {
        return answer;
    }
    // One refresh at a time: another request answers the copy kept.
    let claim = format!("refreshing/{id}");
    let claimed = cx
        .storage
        .shared()
        .create_expiring(&claim, b"1", now + CLAIM_MS)
        .await
        .unwrap_or(true);
    if !claimed {
        if let Some(kept) = &kept {
            return source_reply(source, kept, true, None);
        }
        // Nothing kept yet and another request is reading the feed: wait for
        // its copy, or its failure, rather than ask the publisher a second time.
        return await_refresh(cx, source, &key, &failed_key).await;
    }
    // Another request may have finished a refresh between the checks above
    // and this claim: look again before asking the publisher.
    let kept: Option<Kept> = cx.storage.shared().get_json(&key).await.unwrap_or(kept);
    let settled = match &kept {
        Some(fresh) if now.saturating_sub(fresh.fetched) < current_for => {
            Some(source_reply(source, fresh, false, None))
        }
        _ => backed_off(cx, source, &failed_key, kept.as_ref()).await,
    };
    if let Some(answer) = settled {
        let _ = cx.storage.shared().delete(&claim).await;
        return answer;
    }
    let outcome = refresh(cx, source).await;
    // The claim is released only after the new copy is kept, so a request
    // that arrives meanwhile still sees the claim and shares this refresh.
    let response = match outcome {
        Ok(stories) => {
            let fresh = Kept {
                fetched: now,
                stories,
            };
            if let Err(error) = cx.storage.shared().put_json(&key, &fresh).await {
                ferrite_app::tracing::warn!(%error, id, "could not keep the feed");
            }
            let _ = cx.storage.shared().delete(&failed_key).await;
            source_reply(source, &fresh, false, None)
        }
        Err(reason) => {
            let message = format!("{} could not be read: {reason}", source.publisher);
            cx.log(Level::Default, "feed", &message).await;
            // The back-off starts when the read failed, not when it began.
            let failure = Failure {
                message,
                until: cx.ctx.now_ms() + FAILED_BACKOFF_MS,
            };
            if let Ok(bytes) = serde_json::to_vec(&failure) {
                if let Err(error) = cx
                    .storage
                    .shared()
                    .put_expiring(&failed_key, &bytes, failure.until)
                    .await
                {
                    ferrite_app::tracing::warn!(%error, id, "could not record the failure");
                }
            }
            failure_reply(cx, source, &failure, kept.as_ref())
        }
    };
    let _ = cx.storage.shared().delete(&claim).await;
    response
}

/// A feed's last failed read, kept until its back-off ends.
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Failure {
    message: String,
    /// When the back-off ends, in milliseconds since the epoch.
    until: u64,
}

/// The answer for a feed in back-off: the kept copy with the failure, or a
/// 502 whose `retry-after` is the back-off still to run, in whole seconds.
fn failure_reply(
    cx: &ApiCtx<'_>,
    source: &sources::Source,
    failure: &Failure,
    kept: Option<&Kept>,
) -> Response {
    match kept {
        Some(kept) => source_reply(source, kept, true, Some(&failure.message)),
        None => {
            let left_ms = failure.until.saturating_sub(cx.ctx.now_ms());
            let seconds = left_ms.div_ceil(1000).max(1);
            Response::error(502, &failure.message).add_header("retry-after", seconds.to_string())
        }
    }
}

/// The feed's recorded failure, while its back-off lasts.
async fn recorded_failure(cx: &mut ApiCtx<'_>, failed_key: &str) -> Option<Failure> {
    cx.storage
        .shared()
        .get_json::<Failure>(failed_key)
        .await
        .ok()
        .flatten()
}

/// The answer for a feed whose last read failed less than
/// [`FAILED_BACKOFF_MS`] ago (see [`failure_reply`]); `None` when no failure
/// is recorded.
async fn backed_off(
    cx: &mut ApiCtx<'_>,
    source: &sources::Source,
    failed_key: &str,
    kept: Option<&Kept>,
) -> Option<Response> {
    let failure = recorded_failure(cx, failed_key).await?;
    Some(failure_reply(cx, source, &failure, kept))
}

/// How long a request without the refresh claim waits for the request that
/// holds it to keep a first copy of the feed, and how often it looks.
const WAIT_MS: u64 = 6_500;
const LOOK_EVERY_MS: u64 = 500;

/// Wait for another request's first read of a feed: the kept copy when it
/// arrives, its failure (502 with the back-off left) when it fails, or 503
/// (try again) when neither has come within [`WAIT_MS`].
async fn await_refresh(
    cx: &mut ApiCtx<'_>,
    source: &sources::Source,
    key: &str,
    failed_key: &str,
) -> Response {
    let mut waited = 0;
    while waited < WAIT_MS {
        ferrite_app::sleep_ms(LOOK_EVERY_MS).await;
        waited += LOOK_EVERY_MS;
        if let Ok(Some(kept)) = cx.storage.shared().get_json::<Kept>(key).await {
            return source_reply(source, &kept, false, None);
        }
        if let Some(failure) = recorded_failure(cx, failed_key).await {
            return failure_reply(cx, source, &failure, None);
        }
    }
    Response::error(
        503,
        &format!("{} is being read; try again in a moment", source.publisher),
    )
    .add_header("retry-after", "2")
}

/// Read a feed from its publisher.
async fn refresh(cx: &ApiCtx<'_>, source: &sources::Source) -> Result<Vec<feed::Item>, String> {
    let fetched = fetch::get(cx.ctx, EGRESS, source.feed, ACCEPT, FEED_BYTES, BUDGET_MS)
        .await
        .map_err(|e| e.to_string())?;
    if fetched.status != 200 {
        return Err(format!("the feed answered HTTP {}", fetched.status));
    }
    let parsed = feed::parse_received(&fetched.body, fetched.cut, LIMITS)?;
    let stories: Vec<feed::Item> = parsed
        .items
        .into_iter()
        .filter(|item| !item.title.is_empty())
        .map(|mut item| {
            // News lists stories, not media.
            item.audio = None;
            item.duration = None;
            item
        })
        .collect();
    if stories.is_empty() {
        let why = if fetched.cut {
            "it was cut before its first story"
        } else {
            "it lists no stories"
        };
        return Err(format!("the feed was read but {why}"));
    }
    Ok(stories)
}

/// A list of plain ids, each once, at most [`MAX_CHANNELS`].
fn channel_ids(what: &str, list: &[String]) -> Result<(), String> {
    if list.len() > MAX_CHANNELS {
        return Err(format!("at most {MAX_CHANNELS} channels {what}"));
    }
    let mut seen = BTreeSet::new();
    for id in list {
        if !document::valid_key(id) || !seen.insert(id.as_str()) {
            return Err(format!(
                "channels {what}: {id:?} is not a plain id listed once"
            ));
        }
    }
    Ok(())
}

fn story(what: &str, story: &Story) -> Result<(), String> {
    let fail = |why: &str| Err(format!("a story in {what}: {why}"));
    if !document::valid_key(&story.id) || !document::valid_key(&story.source) {
        return fail("its id and source are plain ids");
    }
    let title = story.title.chars().count();
    if title == 0 || title > 300 || story.title.trim().is_empty() {
        return fail("its title has 1 to 300 characters");
    }
    if story.publisher.trim().is_empty() || story.publisher.chars().count() > 100 {
        return fail("its publisher has 1 to 100 characters");
    }
    for url in [&story.link, &story.image].into_iter().flatten() {
        if feed::web_url(url).as_deref() != Some(url.as_str()) {
            return fail("its link and picture are web addresses");
        }
    }
    if let Some(summary) = &story.summary {
        if summary.chars().count() > MAX_SAVED_SUMMARY {
            return fail("its summary has at most 300 characters");
        }
    }
    Ok(())
}

fn stories(what: &str, list: &[Story], most: usize, summaries: bool) -> Result<(), String> {
    if list.len() > most {
        return Err(format!("at most {most} stories in {what}"));
    }
    let mut seen = BTreeSet::new();
    for each in list {
        story(what, each)?;
        if !summaries && each.summary.is_some() {
            return Err(format!("a story in {what} keeps no summary"));
        }
        if !seen.insert((each.source.as_str(), each.id.as_str())) {
            return Err(format!("a story is in {what} twice"));
        }
    }
    Ok(())
}

/// Check a submitted library.
fn validate(library: &Library) -> Result<(), String> {
    channel_ids("followed", &library.following)?;
    channel_ids("blocked", &library.blocked)?;
    stories("Saved Stories", &library.saved, MAX_SAVED, true)?;
    stories("History", &library.history, MAX_HISTORY, false)?;
    let bytes = serde_json::to_vec(library)
        .map(|b| b.len())
        .unwrap_or(usize::MAX);
    if bytes > MAX_LIBRARY_BYTES {
        return Err(format!("the library is over {MAX_LIBRARY_BYTES} bytes"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Library {
        serde_json::from_str(
            r#"{"following":["bbc","ars"],"blocked":["cbs"],
                "saved":[{"id":"0123456789abcdef","source":"bbc","publisher":"BBC News",
                          "title":"A headline","link":"https://www.bbc.co.uk/news/1",
                          "image":"https://ichef.bbci.co.uk/a.jpg","published":1791973800000}],
                "history":[]}"#,
        )
        .unwrap()
    }

    #[test]
    fn the_window_s_library_round_trips() {
        let library = sample();
        assert_eq!(validate(&library), Ok(()));
        let text = serde_json::to_string(&library).unwrap();
        assert_eq!(serde_json::from_str::<Library>(&text).unwrap(), library);
    }

    #[test]
    fn bad_libraries_are_refused() {
        let mut twice = sample();
        twice.following.push("bbc".into());
        assert!(validate(&twice).is_err(), "a channel followed twice");

        let mut script = sample();
        script.saved[0].link = Some("javascript:alert(1)".into());
        assert!(validate(&script).is_err(), "a link that is no web address");

        let mut blank = sample();
        blank.saved[0].title = "  ".into();
        assert!(validate(&blank).is_err(), "a blank headline");

        let mut repeated = sample();
        repeated.saved.push(repeated.saved[0].clone());
        assert!(validate(&repeated).is_err(), "one story saved twice");

        let mut many = sample();
        many.history = (0..=MAX_HISTORY)
            .map(|n| Story {
                id: format!("s{n}"),
                ..sample().saved[0].clone()
            })
            .collect();
        assert!(validate(&many).is_err(), "too long a history");

        let mut stray = sample();
        stray.blocked.push("a/b".into());
        assert!(validate(&stray).is_err(), "an id that is not plain");

        assert!(
            serde_json::from_str::<Library>(
                r#"{"following":[],"blocked":[],"saved":[],"history":[],"theme":"x"}"#
            )
            .is_err(),
            "unknown fields are refused"
        );
    }

    #[test]
    fn a_stored_library_always_fits_one_request() {
        assert!(
            MAX_LIBRARY_BYTES < 256 * 1024,
            "a PUT body is at most 256 KiB"
        );
        let long = Story {
            id: "0123456789abcdef".into(),
            source: "guardian-business".into(),
            publisher: "P".repeat(100),
            title: "T".repeat(300),
            link: Some(format!("https://example.com/{}", "a".repeat(700))),
            image: Some(format!("https://example.com/{}", "b".repeat(700))),
            published: Some(1),
            summary: Some("S".repeat(MAX_SAVED_SUMMARY)),
        };
        let library = Library {
            following: vec![],
            blocked: vec![],
            saved: (0..MAX_SAVED)
                .map(|n| Story {
                    id: format!("s{n}"),
                    ..long.clone()
                })
                .collect(),
            history: vec![],
        };
        assert!(
            validate(&library).is_err(),
            "over the stored limit, refused with 400"
        );
    }

    #[test]
    fn a_saved_story_keeps_a_bounded_summary_and_history_none() {
        let mut saved = sample();
        saved.saved[0].summary = Some("What the story is about.".into());
        assert_eq!(validate(&saved), Ok(()));
        let text = serde_json::to_string(&saved).unwrap();
        assert_eq!(serde_json::from_str::<Library>(&text).unwrap(), saved);

        let mut long = saved.clone();
        long.saved[0].summary = Some("é".repeat(MAX_SAVED_SUMMARY + 1));
        assert!(validate(&long).is_err(), "a summary over the limit");
        let mut exact = saved.clone();
        exact.saved[0].summary = Some("é".repeat(MAX_SAVED_SUMMARY));
        assert_eq!(validate(&exact), Ok(()), "the limit counts characters");

        let mut history = sample();
        history.history = vec![saved.saved[0].clone()];
        assert!(validate(&history).is_err(), "History keeps no summary");
    }

    #[test]
    fn the_catalogue_names_every_channel_and_topic() {
        let body = catalogue();
        assert_eq!(
            body["channels"].as_array().unwrap().len(),
            sources::CHANNELS.len()
        );
        assert_eq!(
            body["topics"].as_array().unwrap().len(),
            sources::TOPICS.len()
        );
        assert_eq!(body["following"][0], "bbc");
    }
}

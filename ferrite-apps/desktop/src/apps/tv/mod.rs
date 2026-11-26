//! TV's server half: the person's YouTube library, kept as one document,
//! and the two lookups the window cannot make itself.
//!
//! Videos play in the browser through YouTube's official IFrame Player API
//! (`demos/tv/tv-youtube-player.tsx`); no video byte passes through the
//! application, and nothing is downloaded or stored but ids, titles and
//! times. What the server keeps for the person (`storage.user()`, so the
//! accounts change re-keys it with every other module):
//!
//! * `GET /api/tv/library`: `{"library": {...} | null, "rev": n,
//!   "session": id}`; `null` before the first save.
//! * `PUT /api/tv/library` with `{"library": {...}, "rev": n}`: replaces it,
//!   or 409 with the current one (`document.rs`).
//! * `DELETE /api/tv/library`: forgets it.
//!
//! The library is `{"videos": [{"id", "title", "channel"}], "history":
//! [{"id", "at"}], "upNext": [id], "watchLater": [id], "positions": {id:
//! seconds}, "playlists": [{"id", "name", "videos": [id]}]}`. Every id is an
//! 11-character YouTube video id; every id the other lists name is one of
//! `videos`, so a title is always at hand after a reload. History is newest
//! first, one entry per video. `playlists` is left out while there are none,
//! which is also how a library saved before playlists reads. `homeVideos`
//! (`[{"id", "place"}]`, also left out while empty) names files of the
//! person's own drive, each with the seconds where the person stopped: only
//! the file's id is kept here, and its bytes stay in the drive. `genres`
//! (`{id: name}`, also left out while empty) is the Genre the person set in
//! Get Info, on one of `videos` or `homeVideos`; a YouTube link carries none.
//!
//! Lookups, through the egress handle [`EGRESS`]:
//!
//! * `GET /api/tv/video?link=<YouTube link or id>`: the video's id, title and
//!   channel from YouTube's oEmbed endpoint ([`OEMBED`], no key). 400 for a
//!   link that names no YouTube video, 404 when YouTube knows no public video
//!   by that id, 422 when its owner does not allow it to be embedded, 502
//!   when YouTube cannot be reached.
//! * `GET /api/tv/search?q=<words>`: YouTube search through the YouTube Data
//!   API ([`SEARCH`]), which needs a key: the secret [`KEY_SECRET`]. Without
//!   it the reply is `{"available": false, "results": []}` and the window
//!   says so; with it, `{"available": true, "results": [{"id", "title",
//!   "channel"}]}` of embeddable videos. The key is never logged or echoed.
//!
//! The Preferences settings TV carries out, kept for the person the same way:
//!
//! * `GET`, `PUT`, `DELETE /api/tv/preferences`: `{"preferences":
//!   {"listSize": "small" | "medium" | "large", "screenSaver"?: true,
//!   "checkboxes"?: true, "unchecked"?: [ids]} | null, "rev": n}` under the
//!   same revision rule. The window carries out these; the others are shown
//!   dimmed with their reasons and are not stored ([`Preferences`] takes no
//!   other field). `unchecked` holds at most [`MAX_UNCHECKED`] ids.

use std::collections::{BTreeMap, BTreeSet};

use ferrite_app::{serde, serde_json, EgressHttpMethod, EgressOutcome};
use serde_json::Value;

use super::document;
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};

pub const MODULE: AppModule = AppModule {
    name: "tv",
    title: "TV",
    handle,
};

/// The egress handle `ferrite.json` declares for YouTube.
pub const EGRESS: &str = "youtube";
/// YouTube's oEmbed endpoint: a declared egress destination.
pub const OEMBED: &str = "https://www.youtube.com/oembed";
/// The YouTube Data API's search: a declared egress destination.
pub const SEARCH: &str = "https://www.googleapis.com/youtube/v3/search";
/// The secret holding a YouTube Data API key, which only search needs.
pub const KEY_SECRET: &str = "youtube_api_key";

/// The most a lookup waits for YouTube, well inside the gateway's 8-second
/// API deadline, so that a slow answer gets this module's 502 and not the
/// gateway's 504.
pub const YOUTUBE_DEADLINE_MS: u64 = 5_000;
/// The most videos the library knows.
pub const MAX_VIDEOS: usize = 1_000;
/// The most videos History keeps.
pub const MAX_HISTORY: usize = 200;
/// The most videos queued in Up Next.
pub const MAX_UP_NEXT: usize = 200;
/// The most videos in Watch Later.
pub const MAX_WATCH_LATER: usize = 500;
/// The most places kept in started videos.
pub const MAX_POSITIONS: usize = 1_000;
/// The most playlists.
pub const MAX_PLAYLISTS: usize = 50;
/// The most videos in one playlist.
pub const MAX_PLAYLIST_VIDEOS: usize = 200;
/// The most entries of all playlists together, which keeps their share of
/// [`MAX_LIBRARY_BYTES`] small.
pub const MAX_PLAYLIST_ENTRIES: usize = 1_000;
/// The longest playlist name, in characters.
pub const MAX_PLAYLIST_NAME: usize = 100;
/// The longest playlist id, in bytes.
const MAX_PLAYLIST_ID: usize = 40;
/// The most home videos.
pub const MAX_HOME_VIDEOS: usize = 200;
/// The longest drive id a home video names, in bytes.
const MAX_HOME_VIDEO_ID: usize = 64;
/// The most videos with a genre.
pub const MAX_GENRES: usize = 500;
/// The longest genre, in characters.
pub const MAX_GENRE: usize = 40;
/// The latest place kept, in seconds: a week, longer than any upload.
pub const MAX_POSITION: u32 = 604_800;
/// The longest title kept, in characters.
pub const MAX_TITLE: usize = 300;
/// The longest channel name kept, in characters.
pub const MAX_CHANNEL: usize = 200;
/// The longest search, in characters.
pub const MAX_QUERY: usize = 100;
/// The most bytes the library takes as JSON: below the store's 200 KB value
/// limit, which a library of valid fields can otherwise pass (1,000 videos with
/// long titles).
pub const MAX_LIBRARY_BYTES: usize = 190_000;
/// The most results one search answers.
const SEARCH_RESULTS: usize = 12;
const KEY: &str = "library";
const PREFERENCES_KEY: &str = "preferences";

/// How wide the Library's cards are, as the Preferences' List Size names it.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum ListSize {
    Small,
    Medium,
    Large,
}

/// The Preferences settings TV carries out, and so keeps. No other field is
/// taken, so a setting the window shows dimmed cannot be stored as if it did
/// something. The fields after List Size are left out while they are off.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(
    crate = "ferrite_app::serde",
    deny_unknown_fields,
    rename_all = "camelCase"
)]
pub struct Preferences {
    pub list_size: ListSize,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub screen_saver: bool,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub checkboxes: bool,
    /// The videos whose Library checkbox is cleared.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub unchecked: Vec<String>,
}

/// The most videos whose checkbox stays cleared.
pub const MAX_UNCHECKED: usize = 1000;
/// The longest id of a video: a YouTube id or a drive file's.
const MAX_VIDEO_ID: usize = 128;

fn preferences_problem(preferences: &Preferences) -> Option<String> {
    if preferences.unchecked.len() > MAX_UNCHECKED {
        return Some(format!("at most {MAX_UNCHECKED} videos can be unchecked"));
    }
    preferences
        .unchecked
        .iter()
        .any(|id| id.is_empty() || id.len() > MAX_VIDEO_ID)
        .then(|| format!("an unchecked video's id has 1 to {MAX_VIDEO_ID} bytes"))
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct PreferencesBody {
    preferences: Preferences,
    rev: u64,
    #[serde(default)]
    session: Option<String>,
}

/// A video the library knows.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Video {
    pub id: String,
    pub title: String,
    pub channel: String,
}

/// A video opened, and when (epoch ms, the browser's clock).
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Watched {
    pub id: String,
    pub at: u64,
}

/// A list the person made and named.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub videos: Vec<String>,
}

/// A file of the person's drive in the Library, and where they stopped in it.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct HomeVideo {
    pub id: String,
    pub place: u32,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(
    crate = "ferrite_app::serde",
    deny_unknown_fields,
    rename_all = "camelCase"
)]
pub struct Library {
    pub videos: Vec<Video>,
    pub history: Vec<Watched>,
    pub up_next: Vec<String>,
    pub watch_later: Vec<String>,
    pub positions: BTreeMap<String, u32>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub playlists: Vec<Playlist>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub home_videos: Vec<HomeVideo>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub genres: BTreeMap<String, String>,
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
    let session = cx.session;
    let outcome = match (cx.request.method, cx.request.path) {
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
        ("GET", "/preferences") => document::read(&mut cx.storage.user(), PREFERENCES_KEY)
            .await
            .map(|current| {
                document::for_session(
                    preferences_reply(current.doc.as_ref(), current.rev),
                    session,
                )
            }),
        ("PUT", "/preferences") => match cx.request.json::<PreferencesBody>() {
            Err(response) => Ok(response),
            Ok(body) => match document::other_session(body.session.as_deref(), session) {
                Some(refused) => Ok(refused),
                None => match preferences_problem(&body.preferences) {
                    Some(problem) => Ok(Response::error(400, &problem)),
                    None => document::write(
                        &mut cx.storage.user(),
                        PREFERENCES_KEY,
                        Some(body.rev),
                        Some(&body.preferences),
                    )
                    .await
                    .map(|saved| {
                        document::answer(saved, Some(&body.preferences), preferences_reply)
                    }),
                },
            },
        },
        ("DELETE", "/preferences") => {
            document::write::<Preferences>(&mut cx.storage.user(), PREFERENCES_KEY, None, None)
                .await
                .map(|saved| document::answer(saved, None, preferences_reply))
        }
        (_, "/preferences") => Ok(Response::method_not_allowed()),
        ("GET", "/video") => Ok(look_up(&cx).await),
        (_, "/video") => Ok(Response::method_not_allowed()),
        ("GET", "/search") => Ok(search(&cx).await),
        (_, "/search") => Ok(Response::method_not_allowed()),
        _ => Ok(Response::not_found()),
    };
    outcome.unwrap_or_else(|error| Response::error(503, &format!("storage failed: {error}")))
}

fn reply(library: Option<&Library>, rev: u64) -> Value {
    serde_json::json!({ "library": library, "rev": rev })
}

fn preferences_reply(preferences: Option<&Preferences>, rev: u64) -> Value {
    serde_json::json!({ "preferences": preferences, "rev": rev })
}

/// Whether `id` is a YouTube video id: 11 letters, digits, `-` or `_`.
pub fn valid_video_id(id: &str) -> bool {
    id.len() == 11
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

/// The video id a YouTube link names, or the id itself: `youtube.com/watch?v=`,
/// `youtu.be/`, `/embed/`, `/shorts/`, `/live/` and `/v/` on youtube.com,
/// m.youtube.com, music.youtube.com and youtube-nocookie.com. `None` for
/// anything else.
pub fn video_id(link: &str) -> Option<String> {
    let link = link.trim();
    if valid_video_id(link) {
        return Some(link.to_string());
    }
    let rest = link
        .strip_prefix("https://")
        .or_else(|| link.strip_prefix("http://"))
        .unwrap_or(link);
    let end = rest.find(['/', '?', '#']).unwrap_or(rest.len());
    let host = rest[..end].to_ascii_lowercase();
    let host = ["www.", "m.", "music."]
        .iter()
        .find_map(|prefix| host.strip_prefix(prefix))
        .unwrap_or(&host)
        .to_string();
    let after = &rest[end..];
    let path_end = after.find(['?', '#']).unwrap_or(after.len());
    let path = &after[..path_end];
    let query = after[path_end..]
        .strip_prefix('?')
        .map(|q| q.split('#').next().unwrap_or(""))
        .unwrap_or("");
    let segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
    let id = match host.as_str() {
        "youtu.be" => segments.first().copied(),
        "youtube.com" | "youtube-nocookie.com" => match segments.as_slice() {
            ["watch"] => query.split('&').find_map(|pair| pair.strip_prefix("v=")),
            ["embed" | "shorts" | "live" | "v", id, ..] => Some(*id),
            _ => None,
        },
        _ => None,
    }?;
    valid_video_id(id).then(|| id.to_string())
}

/// The oEmbed request for a video id: the canonical watch address, built
/// here, never what was pasted.
pub fn oembed_destination(id: &str) -> String {
    format!("{OEMBED}?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D{id}")
}

/// The first `max` characters of `text`, without control characters.
fn clean(text: &str, max: usize) -> String {
    text.chars().filter(|c| !c.is_control()).take(max).collect()
}

/// The video an oEmbed answer describes, or `None` when it is not one.
pub fn parse_oembed(id: &str, body: &[u8]) -> Option<Video> {
    let answer: Value = serde_json::from_slice(body).ok()?;
    let title = clean(answer.get("title")?.as_str()?, MAX_TITLE);
    let channel = clean(
        answer
            .get("author_name")
            .and_then(Value::as_str)
            .unwrap_or(""),
        MAX_CHANNEL,
    );
    (!title.is_empty()).then(|| Video {
        id: id.to_string(),
        title,
        channel,
    })
}

async fn look_up(cx: &ApiCtx<'_>) -> Response {
    let raw = cx.request.query_param("link").unwrap_or("");
    let Some(link) = super::spotlight::decode(raw) else {
        return Response::error(400, "the link is not valid percent-encoded UTF-8");
    };
    let Some(id) = video_id(&link) else {
        return Response::error(400, "that is not a link to a YouTube video");
    };
    let mut egress = match cx.ctx.egress(EGRESS) {
        Ok(egress) => egress,
        Err(error) => return Response::error(503, &format!("no egress to YouTube: {error}")),
    };
    let Some(outcome) = super::safari::within(
        YOUTUBE_DEADLINE_MS,
        egress.deliver_http(EgressHttpMethod::Get, &oembed_destination(&id), &[], &[]),
    )
    .await
    else {
        return Response::error(502, "YouTube did not answer in time");
    };
    match outcome {
        Ok(EgressOutcome::Delivered { status: 200, body }) => match parse_oembed(&id, &body) {
            Some(video) => Response::json(200, &video),
            None => Response::error(502, "YouTube's answer is not oEmbed JSON"),
        },
        Ok(EgressOutcome::Delivered {
            status: 401 | 403, ..
        }) => Response::error(
            422,
            "the video's owner does not allow it to be played outside YouTube",
        ),
        Ok(EgressOutcome::Delivered {
            status: 400 | 404, ..
        }) => Response::error(404, "YouTube knows no public video with that id"),
        Ok(EgressOutcome::Delivered { status, .. }) => {
            Response::error(502, &format!("YouTube answered HTTP {status}"))
        }
        Ok(EgressOutcome::Denied { reason }) => {
            Response::error(502, &format!("egress refused YouTube: {reason}"))
        }
        Err(error) => Response::error(502, &format!("YouTube could not be reached: {error}")),
    }
}

/// Percent-encode everything but RFC 3986's unreserved characters.
pub fn encode(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for b in text.bytes() {
        if b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~') {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

/// The search request: embeddable videos only, moderate safe search.
pub fn search_destination(query: &str, key: &str) -> String {
    format!(
        "{SEARCH}?part=snippet&type=video&videoEmbeddable=true&safeSearch=moderate&maxResults={SEARCH_RESULTS}&q={}&key={}",
        encode(query),
        encode(key)
    )
}

/// The five entities the Data API writes into its titles.
fn unescape(text: &str) -> String {
    text.replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&#x27;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&")
}

/// The videos of a search answer, or `None` when it is not one.
pub fn parse_search(body: &[u8]) -> Option<Vec<Video>> {
    let answer: Value = serde_json::from_slice(body).ok()?;
    let items = answer.get("items")?.as_array()?;
    Some(
        items
            .iter()
            .filter_map(|item| {
                let id = item.get("id")?.get("videoId")?.as_str()?;
                let snippet = item.get("snippet")?;
                let title = clean(&unescape(snippet.get("title")?.as_str()?), MAX_TITLE);
                let channel = clean(
                    &unescape(
                        snippet
                            .get("channelTitle")
                            .and_then(Value::as_str)
                            .unwrap_or(""),
                    ),
                    MAX_CHANNEL,
                );
                (valid_video_id(id) && !title.is_empty()).then(|| Video {
                    id: id.to_string(),
                    title,
                    channel,
                })
            })
            .take(SEARCH_RESULTS)
            .collect(),
    )
}

async fn search(cx: &ApiCtx<'_>) -> Response {
    let raw = cx.request.query_param("q").unwrap_or("");
    let Some(query) = super::spotlight::decode(raw) else {
        return Response::error(400, "the search is not valid percent-encoded UTF-8");
    };
    let query = query.trim();
    if query.is_empty() || query.chars().count() > MAX_QUERY {
        return Response::error(400, &format!("a search is 1 to {MAX_QUERY} characters"));
    }
    let Some(key) = cx
        .ctx
        .secret(KEY_SECRET)
        .filter(|key| !key.trim().is_empty())
    else {
        return Response::json(
            200,
            &serde_json::json!({
                "available": false,
                "results": [],
                "reason": "Searching YouTube needs a YouTube Data API key, which this desktop has not been given.",
            }),
        );
    };
    let mut egress = match cx.ctx.egress(EGRESS) {
        Ok(egress) => egress,
        Err(error) => return Response::error(503, &format!("no egress to YouTube: {error}")),
    };
    let destination = search_destination(query, key.trim());
    let Some(outcome) = super::safari::within(
        YOUTUBE_DEADLINE_MS,
        egress.deliver_http(EgressHttpMethod::Get, &destination, &[], &[]),
    )
    .await
    else {
        return Response::error(502, "YouTube search did not answer in time");
    };
    // Nothing of a failed exchange is echoed: its text could hold the key.
    match outcome {
        Ok(EgressOutcome::Delivered { status: 200, body }) => match parse_search(&body) {
            Some(results) => Response::json(
                200,
                &serde_json::json!({ "available": true, "results": results }),
            ),
            None => Response::error(502, "YouTube's search answer is not in its usual shape"),
        },
        Ok(EgressOutcome::Delivered { status, .. }) => Response::error(
            502,
            &format!("YouTube refused the search (HTTP {status}): the key's quota or permissions"),
        ),
        Ok(EgressOutcome::Denied { .. }) => Response::error(502, "egress refused YouTube search"),
        Err(_) => Response::error(502, "YouTube search could not be reached"),
    }
}

/// A list of known video ids, each once, at most `max`.
fn ids(what: &str, list: &[String], known: &BTreeSet<&str>, max: usize) -> Result<(), String> {
    if list.len() > max {
        return Err(format!("at most {max} videos in {what}"));
    }
    let mut seen = BTreeSet::new();
    for id in list {
        if !known.contains(id.as_str()) {
            return Err(format!("{what}: {id:?} is not one of the library's videos"));
        }
        if !seen.insert(id.as_str()) {
            return Err(format!("{what}: {id:?} is listed twice"));
        }
    }
    Ok(())
}

/// Check a submitted library.
pub fn validate(library: &Library) -> Result<(), String> {
    if library.videos.len() > MAX_VIDEOS {
        return Err(format!("at most {MAX_VIDEOS} videos"));
    }
    let mut known = BTreeSet::new();
    for video in &library.videos {
        if !valid_video_id(&video.id) {
            return Err(format!("{:?} is not a YouTube video id", video.id));
        }
        if !known.insert(video.id.as_str()) {
            return Err(format!("the video {:?} is listed twice", video.id));
        }
        let title = video.title.chars().count();
        if title == 0 || title > MAX_TITLE || video.title.chars().any(char::is_control) {
            return Err(format!(
                "a title is 1 to {MAX_TITLE} characters, without control characters"
            ));
        }
        if video.channel.chars().count() > MAX_CHANNEL
            || video.channel.chars().any(char::is_control)
        {
            return Err(format!(
                "a channel is at most {MAX_CHANNEL} characters, without control characters"
            ));
        }
    }
    let history: Vec<String> = library.history.iter().map(|w| w.id.clone()).collect();
    ids("History", &history, &known, MAX_HISTORY)?;
    ids("Up Next", &library.up_next, &known, MAX_UP_NEXT)?;
    ids("Watch Later", &library.watch_later, &known, MAX_WATCH_LATER)?;
    if library.positions.len() > MAX_POSITIONS {
        return Err(format!("at most {MAX_POSITIONS} places in started videos"));
    }
    for (id, seconds) in &library.positions {
        if !known.contains(id.as_str()) {
            return Err(format!(
                "a place in {id:?}, which is not one of the library's videos"
            ));
        }
        if *seconds > MAX_POSITION {
            return Err(format!("a place is at most {MAX_POSITION} seconds"));
        }
    }
    validate_playlists(&library.playlists, &known)?;
    validate_home_videos(&library.home_videos)?;
    validate_genres(library, &known)?;
    let bytes = serde_json::to_vec(library).map_or(usize::MAX, |text| text.len());
    if bytes > MAX_LIBRARY_BYTES {
        return Err(format!(
            "the library takes at most {MAX_LIBRARY_BYTES} bytes; this is {bytes}"
        ));
    }
    Ok(())
}

fn validate_genres(library: &Library, known: &BTreeSet<&str>) -> Result<(), String> {
    if library.genres.len() > MAX_GENRES {
        return Err(format!("at most {MAX_GENRES} videos have a genre"));
    }
    for (id, genre) in &library.genres {
        if !known.contains(id.as_str()) && !library.home_videos.iter().any(|home| home.id == *id) {
            return Err(format!(
                "a genre for {id:?}, which is not one of the library's videos"
            ));
        }
        let length = genre.chars().count();
        if length == 0
            || length > MAX_GENRE
            || genre.trim() != genre
            || genre.chars().any(char::is_control)
        {
            return Err(format!(
                "a genre is 1 to {MAX_GENRE} characters, trimmed, without control characters"
            ));
        }
    }
    Ok(())
}

fn validate_home_videos(videos: &[HomeVideo]) -> Result<(), String> {
    if videos.len() > MAX_HOME_VIDEOS {
        return Err(format!("at most {MAX_HOME_VIDEOS} home videos"));
    }
    let mut seen = BTreeSet::new();
    for video in videos {
        let id = video.id.as_str();
        let well_formed = !id.is_empty()
            && id.len() <= MAX_HOME_VIDEO_ID
            && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-');
        if !well_formed {
            return Err(format!("{id:?} is not a drive file's id"));
        }
        if !seen.insert(id) {
            return Err(format!("the home video {id:?} is listed twice"));
        }
        if video.place > MAX_POSITION {
            return Err(format!("a place is at most {MAX_POSITION} seconds"));
        }
    }
    Ok(())
}

fn validate_playlists(playlists: &[Playlist], known: &BTreeSet<&str>) -> Result<(), String> {
    if playlists.len() > MAX_PLAYLISTS {
        return Err(format!("at most {MAX_PLAYLISTS} playlists"));
    }
    let mut seen = BTreeSet::new();
    let mut entries = 0;
    for playlist in playlists {
        let id = playlist.id.as_str();
        let well_formed = id.starts_with("pl-")
            && id.len() <= MAX_PLAYLIST_ID
            && !id[3..].is_empty()
            && id[3..].bytes().all(|b| b.is_ascii_alphanumeric());
        if !well_formed {
            return Err(format!("{id:?} is not a playlist id"));
        }
        if !seen.insert(id) {
            return Err(format!("the playlist {id:?} is listed twice"));
        }
        let name = playlist.name.chars().count();
        if name == 0 || name > MAX_PLAYLIST_NAME || playlist.name.chars().any(char::is_control) {
            return Err(format!(
                "a playlist's name is 1 to {MAX_PLAYLIST_NAME} characters, without control characters"
            ));
        }
        ids("A playlist", &playlist.videos, known, MAX_PLAYLIST_VIDEOS)?;
        entries += playlist.videos.len();
    }
    if entries > MAX_PLAYLIST_ENTRIES {
        return Err(format!(
            "playlists hold at most {MAX_PLAYLIST_ENTRIES} videos together"
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn with_playlist(id: &str, name: &str, videos: &[&str]) -> Library {
        let mut library = sample();
        library.playlists = vec![Playlist {
            id: id.into(),
            name: name.into(),
            videos: videos.iter().map(|video| video.to_string()).collect(),
        }];
        library
    }

    fn with_home_video(id: &str, place: u32) -> Library {
        let mut library = sample();
        library.home_videos = vec![HomeVideo {
            id: id.to_string(),
            place,
        }];
        library
    }

    #[test]
    fn a_home_video_round_trips_in_a_library_that_lists_it() {
        let library = with_home_video("0123456789abcdef0123456789abcdef", 42);
        assert_eq!(validate(&library), Ok(()));
        let text = serde_json::to_string(&library).unwrap();
        assert!(
            text.contains(r#""homeVideos":[{"id":"0123456789abcdef0123456789abcdef","place":42}]"#),
            "{text}"
        );
        assert_eq!(serde_json::from_str::<Library>(&text).unwrap(), library);
        assert!(!serde_json::to_string(&sample())
            .unwrap()
            .contains("homeVideos"));
    }

    #[test]
    fn a_home_video_is_refused_for_a_bad_id_a_late_place_or_a_repeat() {
        for id in ["", "a/b", "a b", &"a".repeat(65)] {
            assert!(validate(&with_home_video(id, 0)).is_err(), "{id:?}");
        }
        assert!(validate(&with_home_video("abc", MAX_POSITION + 1)).is_err());
        let mut twice = with_home_video("abc", 0);
        twice.home_videos.push(twice.home_videos[0].clone());
        assert!(validate(&twice).is_err());
    }

    #[test]
    fn a_genre_names_a_known_video_or_home_video() {
        let mut library = with_home_video("file1", 0);
        library.genres = BTreeMap::from([
            ("eRsGyueVLvQ".to_string(), "Drama".to_string()),
            ("file1".to_string(), "Family".to_string()),
        ]);
        assert_eq!(validate(&library), Ok(()));
        let text = serde_json::to_string(&library).unwrap();
        assert!(text.contains(r#""genres":{"eRsGyueVLvQ":"Drama","file1":"Family"}"#));
        assert!(!serde_json::to_string(&sample()).unwrap().contains("genres"));

        let mut unknown = sample();
        unknown.genres = BTreeMap::from([("nobody".to_string(), "Drama".to_string())]);
        assert!(validate(&unknown).is_err());

        for bad in ["", " Drama", "Dr\u{7}ama", &"x".repeat(MAX_GENRE + 1)] {
            let mut wrong = sample();
            wrong.genres = BTreeMap::from([("eRsGyueVLvQ".to_string(), bad.to_string())]);
            assert!(validate(&wrong).is_err(), "{bad:?}");
        }
    }

    #[test]
    fn home_videos_are_held_to_their_limit() {
        let mut many = sample();
        many.home_videos = (0..=MAX_HOME_VIDEOS)
            .map(|n| HomeVideo {
                id: format!("file{n}"),
                place: 0,
            })
            .collect();
        assert!(validate(&many).is_err());
        many.home_videos.pop();
        assert_eq!(validate(&many), Ok(()));
    }

    #[test]
    fn a_library_without_playlists_reads_and_writes_as_it_always_did() {
        let text = serde_json::to_string(&sample()).unwrap();
        assert!(!text.contains("playlists"), "{text}");
        assert_eq!(sample().playlists, vec![]);
    }

    #[test]
    fn a_playlist_round_trips_and_names_only_videos_the_library_knows() {
        let library = with_playlist("pl-abc1", "Evening", &["eRsGyueVLvQ"]);
        assert_eq!(validate(&library), Ok(()));
        let text = serde_json::to_string(&library).unwrap();
        assert_eq!(serde_json::from_str::<Library>(&text).unwrap(), library);
        assert!(validate(&with_playlist("pl-abc1", "Evening", &["zzzzzzzzzzz"])).is_err());
    }

    #[test]
    fn a_playlist_is_refused_for_a_bad_id_or_name_or_a_repeated_id() {
        for id in ["abc", "pl-", "pl-a b", "pl-a/b"] {
            assert!(
                validate(&with_playlist(id, "Evening", &[])).is_err(),
                "{id}"
            );
        }
        assert!(validate(&with_playlist("pl-a", "", &[])).is_err());
        assert!(validate(&with_playlist("pl-a", "a\nb", &[])).is_err());
        let mut twice = with_playlist("pl-a", "One", &[]);
        twice.playlists.push(twice.playlists[0].clone());
        assert!(validate(&twice).unwrap_err().contains("twice"));
    }

    #[test]
    fn playlists_are_held_to_their_limits() {
        let mut many = sample();
        many.playlists = (0..=MAX_PLAYLISTS)
            .map(|at| Playlist {
                id: format!("pl-{at}"),
                name: "P".into(),
                videos: vec![],
            })
            .collect();
        assert!(validate(&many).is_err());
        many.playlists.pop();
        assert_eq!(validate(&many), Ok(()));
    }

    fn sample() -> Library {
        serde_json::from_str(
            r#"{"videos":[{"id":"aqz-KE-bpKQ","title":"Big Buck Bunny","channel":"Blender"},
                          {"id":"eRsGyueVLvQ","title":"Sintel","channel":"Blender"}],
                "history":[{"id":"aqz-KE-bpKQ","at":1790000000000}],
                "upNext":["eRsGyueVLvQ"],"watchLater":["eRsGyueVLvQ"],
                "positions":{"aqz-KE-bpKQ":120}}"#,
        )
        .unwrap()
    }

    #[test]
    fn the_window_s_library_round_trips_in_its_field_names() {
        let library = sample();
        assert_eq!(validate(&library), Ok(()));
        let text = serde_json::to_string(&library).unwrap();
        assert!(text.contains(r#""upNext":["eRsGyueVLvQ"]"#), "{text}");
        assert!(text.contains(r#""watchLater""#), "{text}");
        assert_eq!(serde_json::from_str::<Library>(&text).unwrap(), library);
    }

    #[test]
    fn a_library_of_valid_fields_over_the_byte_limit_is_refused() {
        // 1,000 videos whose titles and channels are each within their limits,
        // in multibyte text: well over what the store keeps.
        let mut big = sample();
        big.videos = (0..MAX_VIDEOS)
            .map(|n| Video {
                id: format!("v{n:010}"),
                title: "€".repeat(MAX_TITLE),
                channel: "€".repeat(MAX_CHANNEL),
            })
            .collect();
        big.history.clear();
        big.up_next.clear();
        big.watch_later.clear();
        big.positions.clear();
        let error = validate(&big).unwrap_err();
        assert!(error.contains(&MAX_LIBRARY_BYTES.to_string()), "{error}");
        // The store's limit is above the module's.
        assert!(MAX_LIBRARY_BYTES < 200_000);
    }

    #[test]
    fn bad_libraries_are_refused() {
        let mut unknown = sample();
        unknown.watch_later.push("R6MlUcmOul8".into());
        assert!(
            validate(&unknown).is_err(),
            "a video the library does not know"
        );

        let mut twice = sample();
        twice.history.push(Watched {
            id: "aqz-KE-bpKQ".into(),
            at: 1,
        });
        assert!(validate(&twice).is_err(), "one video twice in History");

        let mut id = sample();
        id.videos[0].id = "not an id!!".into();
        assert!(validate(&id).is_err(), "an id that is not YouTube's");

        let mut title = sample();
        title.videos[0].title = String::new();
        assert!(validate(&title).is_err(), "an empty title");
        title.videos[0].title = "x".repeat(MAX_TITLE + 1);
        assert!(validate(&title).is_err(), "a title too long");
        title.videos[0].title = "a\nb".into();
        assert!(validate(&title).is_err(), "a control character");

        let mut place = sample();
        place
            .positions
            .insert("aqz-KE-bpKQ".into(), MAX_POSITION + 1);
        assert!(validate(&place).is_err(), "a place past a week");

        let mut queue = sample();
        queue.up_next = (0..=MAX_UP_NEXT).map(|_| "eRsGyueVLvQ".into()).collect();
        assert!(validate(&queue).is_err(), "too long an Up Next");

        assert!(
            serde_json::from_str::<Library>(
                r#"{"videos":[],"history":[],"upNext":[],"watchLater":[],"positions":{},"extra":1}"#
            )
            .is_err(),
            "a field the library does not know"
        );
    }

    #[test]
    fn links_of_every_youtube_form_name_their_video() {
        for link in [
            "aqz-KE-bpKQ",
            "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
            "https://www.youtube.com/watch?feature=share&v=aqz-KE-bpKQ&t=42s",
            "http://youtube.com/watch?v=aqz-KE-bpKQ#comments",
            "youtube.com/watch?v=aqz-KE-bpKQ",
            "https://m.youtube.com/watch?v=aqz-KE-bpKQ",
            "https://music.youtube.com/watch?v=aqz-KE-bpKQ&list=x",
            "https://youtu.be/aqz-KE-bpKQ?si=abc",
            "https://www.youtube.com/embed/aqz-KE-bpKQ?start=10",
            "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ",
            "https://www.youtube.com/shorts/aqz-KE-bpKQ",
            "https://www.youtube.com/live/aqz-KE-bpKQ",
            "  https://WWW.YOUTUBE.COM/watch?v=aqz-KE-bpKQ  ",
        ] {
            assert_eq!(video_id(link).as_deref(), Some("aqz-KE-bpKQ"), "{link}");
        }
        for link in [
            "",
            "https://vimeo.com/123456789",
            "https://www.youtube.com/watch?v=short",
            "https://www.youtube.com/@BlenderOfficial",
            "https://evil.example/watch?v=aqz-KE-bpKQ",
            "https://youtube.com.evil.example/watch?v=aqz-KE-bpKQ",
            "https://www.youtube.com/watch?v=aqz-KE-bpK%51",
            "https://www.youtube.com/playlist?list=PL123",
        ] {
            assert_eq!(video_id(link), None, "{link}");
        }
    }

    #[test]
    fn the_oembed_request_is_built_from_the_id_alone() {
        assert_eq!(
            oembed_destination("aqz-KE-bpKQ"),
            "https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Daqz-KE-bpKQ"
        );
        assert!(oembed_destination("aqz-KE-bpKQ").starts_with(OEMBED));
    }

    #[test]
    fn an_oembed_answer_gives_the_title_and_channel() {
        let body = br#"{"title":"Big Buck Bunny 60fps 4K - Official Blender Foundation Short Film",
            "author_name":"Blender","type":"video","thumbnail_url":"https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg"}"#;
        let video = parse_oembed("aqz-KE-bpKQ", body).unwrap();
        assert_eq!(video.channel, "Blender");
        assert!(video.title.starts_with("Big Buck Bunny"));
        assert!(validate(&Library {
            videos: vec![video],
            history: vec![],
            up_next: vec![],
            watch_later: vec![],
            positions: BTreeMap::new(),
            playlists: vec![],
            home_videos: vec![],
            genres: BTreeMap::new(),
        })
        .is_ok());
        assert!(parse_oembed("aqz-KE-bpKQ", b"Not Found").is_none());
        assert!(parse_oembed("aqz-KE-bpKQ", br#"{"title":""}"#).is_none());
        let long = format!(r#"{{"title":"{}\u0007"}}"#, "t".repeat(MAX_TITLE + 5));
        assert_eq!(
            parse_oembed("aqz-KE-bpKQ", long.as_bytes()).unwrap().title,
            "t".repeat(MAX_TITLE)
        );
    }

    #[test]
    fn a_search_is_encoded_and_its_answer_read() {
        let destination = search_destination("llamas & friends/?", "k&y=1");
        assert!(destination.starts_with(SEARCH));
        assert!(
            destination.contains("&q=llamas%20%26%20friends%2F%3F&"),
            "{destination}"
        );
        assert!(destination.ends_with("&key=k%26y%3D1"), "{destination}");
        assert!(destination.contains("videoEmbeddable=true"));

        let body = br#"{"items":[
            {"id":{"kind":"youtube#video","videoId":"SkVqJ1SGeL0"},
             "snippet":{"title":"Caminandes 3: Llamigos &amp; friends&#39;","channelTitle":"Blender"}},
            {"id":{"kind":"youtube#channel","channelId":"UC"},"snippet":{"title":"A channel"}},
            {"id":{"videoId":"bad"},"snippet":{"title":"x"}}]}"#;
        let results = parse_search(body).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "SkVqJ1SGeL0");
        assert_eq!(results[0].title, "Caminandes 3: Llamigos & friends'");
        assert!(parse_search(b"{}").is_none());
    }

    #[test]
    fn preferences_keep_what_tv_carries_out_in_the_browsers_field_names() {
        let kept: Preferences = serde_json::from_str(r#"{"listSize":"large"}"#).unwrap();
        assert_eq!(kept.list_size, ListSize::Large);
        assert_eq!(
            serde_json::to_string(&kept).unwrap(),
            r#"{"listSize":"large"}"#
        );
        let whole =
            r#"{"listSize":"small","screenSaver":true,"checkboxes":true,"unchecked":["a"]}"#;
        let read: Preferences = serde_json::from_str(whole).unwrap();
        assert_eq!(serde_json::to_string(&read).unwrap(), whole);
        assert_eq!(preferences_problem(&read), None);
        for refused in [
            r#"{"listSize":"huge"}"#,
            r#"{}"#,
            r#"{"listSize":"small","restrictMature":true}"#,
        ] {
            assert!(
                serde_json::from_str::<Preferences>(refused).is_err(),
                "{refused} was taken"
            );
        }
        let too_many = Preferences {
            unchecked: vec!["a".into(); MAX_UNCHECKED + 1],
            ..read.clone()
        };
        assert!(preferences_problem(&too_many).is_some());
        let empty_id = Preferences {
            unchecked: vec![String::new()],
            ..read
        };
        assert!(preferences_problem(&empty_id).is_some());
    }
}

//! Music's server half: the person's library, playlists, loved songs and
//! playback, small album artwork, and openly licensed music from the
//! Internet Archive ([`archive`]).
//!
//! The sound itself is never stored here. A song added from the person's
//! computer is a file in their drive (`src/apps/files/`, uploaded in pieces
//! by the browser), and the library names it by its drive file id; the
//! browser reads the pieces back, joins them into one `Blob` and plays it, so
//! seeking in it is local. A song from the Internet Archive names the item
//! and its files, and the browser plays it straight from archive.org, which
//! answers range requests. Nothing here holds or forwards audio.
//!
//! * `GET /api/music/library`: `{"library": {...} | null, "rev", "session"}`.
//! * `PUT /api/music/library` with `{"library": {...}, "rev"}`: replaces it,
//!   or 409 with the current one (`document.rs`). The covers the stored
//!   library named and the new one does not are then forgotten.
//! * `DELETE /api/music/library`: forgets it and its covers.
//! * `GET`, `PUT`, `DELETE /api/music/playback`: the same for what is
//!   playing: Up Next, the position, shuffle, repeat, volume, Recently Played,
//!   play counts, and the Internet Archive songs played without being added.
//! * `GET`, `PUT`, `DELETE /api/music/preferences`: the same for the
//!   Preferences settings this desktop carries out ([`Preferences`]): List
//!   Size, the notification when the song changes, the MiniPlayer kept on top,
//!   star ratings, the Songs list's checkboxes, Crossfade, Sound Enhancer and
//!   Sound Check. The settings Music shows
//!   but this desktop cannot carry out (the iTunes Store and the others) are
//!   dimmed in the window with the reason, and are not kept.
//! * `GET`, `PUT`, `DELETE /api/music/lyrics`: the same for the lyrics typed
//!   in Song Info, by song id. Lyrics in a song file's own tags stay in the
//!   file: the browser reads them there.
//! * `PUT /api/music/artwork/<sha256>` with a JPEG or PNG of at most
//!   [`MAX_ARTWORK_BYTES`]: keeps an album's cover, read from the song's tags
//!   in the browser and made small there. The name is the SHA-256 of the
//!   bytes, so a cover is stored once however many songs share it, and a
//!   body whose digest differs is refused. `GET` answers the image; `DELETE`
//!   forgets one the stored library does not name (409 otherwise).
//! * `/api/music/sharing...`: Home Sharing between this desktop's accounts
//!   ([`sharing`]).
//! * `GET /api/music/archive/search?q=<words>&page=<n>` and
//!   `GET /api/music/archive/item/<identifier>`: see [`archive`].
//! * `GET /api/music/radio/stations?name=<words>&genre=<tag>&page=<n>`: see [`radio`].
//!
//! The library is `{"songs": [song], "playlists": [{"id", "name", "songs":
//! [id]}], "loved": [id]}`, a song `{"id", "title", "artist", "album",
//! "genre", "composer", "year", "track", "duration", "added", "artwork", "source"}`, its
//! source `{"kind": "file", "file", "name", "type", "size"}` or `{"kind":
//! "archive", "item", "files": {"mp3" | "ogg" | "flac": name}, "license"}`.
//! Playlists and Loved name songs of the library only, each once.
//!
//! Who decides that an Archive song is openly licensed: the server. The item
//! route records, for the person, the licence and the playable files it found
//! in the item's own metadata ([`Verified`], `verified/<identifier>`). A save
//! that adds or changes an Archive song is refused unless it names exactly
//! that licence and only those files, so a browser cannot add a closed item
//! by naming an open licence for it.

pub mod archive;
pub mod radio;
pub mod sharing;

use std::collections::{BTreeMap, BTreeSet};

use ferrite_app::{serde, serde_json, EgressHttpMethod, EgressOutcome};
use serde_json::Value;

use super::document;
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture, Space};

pub const MODULE: AppModule = AppModule {
    name: "music",
    title: "Music",
    handle,
};

/// The most songs a library keeps: with every field at its longest, a
/// library stays under the gateway's 256 KiB request limit only when most
/// are short, so the browser also checks the size it sends.
pub const MAX_SONGS: usize = 500;
/// The most playlists.
pub const MAX_PLAYLISTS: usize = 100;
/// The most entries of Up Next.
pub const MAX_QUEUE: usize = 1_000;
/// The most songs Recently Played keeps.
pub const MAX_RECENT: usize = 50;
/// The most Internet Archive songs the playback keeps outside the library.
pub const MAX_GUESTS: usize = 200;
/// The longest text of a song or playlist, in characters.
pub const MAX_TEXT: usize = 200;
/// The largest cover kept, in bytes.
pub const MAX_ARTWORK_BYTES: usize = 100_000;
/// The most covers a person keeps.
pub const MAX_ARTWORKS: usize = 500;
/// The longest song, in seconds: a day.
pub const MAX_DURATION: f64 = 86_400.0;
/// The largest file a song may name, in bytes: the drive's own limit is
/// checked by the drive.
pub const MAX_FILE_SIZE: u64 = 1 << 32;
/// The most items one save may add songs of.
pub const MAX_NEW_ITEMS: usize = 20;
/// The largest library, as JSON: with the covers let go beside it (at most
/// [`MAX_ARTWORKS`] digests) it stays under the store's 200 KB value limit.
pub const MAX_LIBRARY_BYTES: usize = 160_000;
/// The largest playback, as JSON, under the store's 200 KB value limit.
pub const MAX_PLAYBACK_BYTES: usize = 190_000;
/// The longest lyrics of one song, in characters.
pub const MAX_LYRICS_CHARS: usize = 10_000;
/// The largest set of lyrics, as JSON, under the store's 200 KB value limit.
pub const MAX_LYRICS_BYTES: usize = 190_000;
/// How long what the item route found of an item may be named by a save: a
/// month after the item was last opened. Songs already saved stay; only
/// adding songs of the item again needs it opened again.
pub const VERIFIED_FOR_MS: u64 = 30 * 24 * 60 * 60 * 1000;

const LIBRARY: &str = "library";
const PLAYBACK: &str = "playback";
const PREFERENCES: &str = "preferences";
const LYRICS: &str = "lyrics";
const ARTWORK: &str = "artwork/";
const VERIFIED: &str = "verified/";

/// Where a song's sound is.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(
    crate = "ferrite_app::serde",
    tag = "kind",
    rename_all = "lowercase",
    deny_unknown_fields
)]
pub enum Source {
    /// A file of the person's drive.
    File {
        /// The drive's file id.
        file: String,
        /// The file's name when it was added, as Get Info shows it.
        name: String,
        /// Its media type, such as `audio/mpeg`.
        #[serde(rename = "type")]
        media_type: String,
        size: u64,
    },
    /// Files of an openly licensed Internet Archive item, by format.
    Archive {
        item: String,
        files: BTreeMap<String, String>,
        license: String,
    },
    /// A stream at a web address, opened with File > Open Stream.
    Stream { url: String },
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Song {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    #[serde(default)]
    pub genre: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub composer: String,
    #[serde(default)]
    pub year: Option<u32>,
    #[serde(default)]
    pub track: Option<u32>,
    /// Seconds.
    pub duration: f64,
    /// When it was added (epoch ms, the browser's clock).
    pub added: u64,
    /// The SHA-256 of its cover under `/api/music/artwork/`, if it has one.
    #[serde(default)]
    pub artwork: Option<String>,
    /// Stars, 1 to 5.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rating: Option<u8>,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub disliked: bool,
    /// Song Info, Details: Grouping, which Shuffle by Groupings keeps together.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub grouping: String,
    /// Song Info, Details: Comments.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub comments: String,
    /// Song Info, Sorting: what the lists sort the song by in place of its name.
    #[serde(default, rename = "sortName", skip_serializing_if = "String::is_empty")]
    pub sort_name: String,
    #[serde(
        default,
        rename = "sortArtist",
        skip_serializing_if = "String::is_empty"
    )]
    pub sort_artist: String,
    #[serde(
        default,
        rename = "sortAlbum",
        skip_serializing_if = "String::is_empty"
    )]
    pub sort_album: String,
    #[serde(
        default,
        rename = "sortAlbumArtist",
        skip_serializing_if = "String::is_empty"
    )]
    pub sort_album_artist: String,
    #[serde(
        default,
        rename = "sortComposer",
        skip_serializing_if = "String::is_empty"
    )]
    pub sort_composer: String,
    /// Song Info, Options: Remember playback position; the place is in
    /// [`Playback::bookmarks`].
    #[serde(
        default,
        rename = "rememberPosition",
        skip_serializing_if = "std::ops::Not::not"
    )]
    pub remember_position: bool,
    /// Song Info, Options: where it starts and stops, in seconds.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub start: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stop: Option<f64>,
    /// Song Info, Options: Volume Adjustment, -100 to 100 percent.
    #[serde(
        default,
        rename = "volumeAdjust",
        skip_serializing_if = "Option::is_none"
    )]
    pub volume_adjust: Option<i16>,
    /// Song Info, Options: the Equalizer preset it plays through.
    #[serde(default, rename = "eqPreset", skip_serializing_if = "String::is_empty")]
    pub eq_preset: String,
    /// Song Info, Options: Skip when shuffling.
    #[serde(
        default,
        rename = "skipShuffle",
        skip_serializing_if = "std::ops::Not::not"
    )]
    pub skip_shuffle: bool,
    /// Its checkbox in the Songs list is cleared: playing on passes it by.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub unchecked: bool,
    pub source: Source,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub songs: Vec<String>,
    /// The folder it sits in; none at the top of the list.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub folder: Option<String>,
    /// Rules make this a smart playlist: the browser works out its songs and `songs` stays empty.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub smart: Option<SmartPlaylist>,
    /// Home Sharing leaves it out of what other accounts see.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub private: bool,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct SmartPlaylist {
    pub all: bool,
    pub rules: Vec<SmartRule>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub limit: Option<u32>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct SmartRule {
    pub field: String,
    pub op: String,
    pub value: String,
}

/// The most rules of a smart playlist.
pub const MAX_SMART_RULES: usize = 20;
const SMART_FIELDS: [&str; 8] = [
    "title", "artist", "album", "genre", "year", "plays", "loved", "added",
];
const SMART_OPS: [&str; 10] = [
    "contains",
    "not-contains",
    "is",
    "is-not",
    "starts",
    "ends",
    "greater",
    "less",
    "in-last",
    "not-in-last",
];

fn validate_smart(playlist: &Playlist, smart: &SmartPlaylist) -> Result<(), String> {
    if !playlist.songs.is_empty() {
        return Err(format!(
            "smart playlist {:?} lists no songs of its own",
            playlist.name
        ));
    }
    if smart.rules.is_empty() || smart.rules.len() > MAX_SMART_RULES {
        return Err(format!("a smart playlist has 1 to {MAX_SMART_RULES} rules"));
    }
    if smart.limit == Some(0) || smart.limit.is_some_and(|limit| limit as usize > MAX_SONGS) {
        return Err(format!("a smart playlist keeps 1 to {MAX_SONGS} songs"));
    }
    for rule in &smart.rules {
        if !SMART_FIELDS.contains(&rule.field.as_str()) || !SMART_OPS.contains(&rule.op.as_str()) {
            return Err(format!(
                "a smart rule cannot read {:?} {:?}",
                rule.field, rule.op
            ));
        }
        plain_text("a smart rule's value", &rule.value, true)?;
    }
    Ok(())
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Folder {
    pub id: String,
    pub name: String,
    /// The folder it sits in; none at the top of the list.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Default)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Library {
    pub songs: Vec<Song>,
    pub playlists: Vec<Playlist>,
    pub loved: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub folders: Vec<Folder>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum Repeat {
    Off,
    All,
    One,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(
    crate = "ferrite_app::serde",
    deny_unknown_fields,
    rename_all = "camelCase"
)]
pub struct Playback {
    /// Song ids in the order they play: the song playing is `queue[index]`,
    /// Up Next is what follows it.
    pub queue: Vec<String>,
    /// The same songs in the order they were chosen, while shuffled; empty
    /// otherwise.
    pub unshuffled: Vec<String>,
    pub index: usize,
    /// Seconds into the song playing, kept at pauses, seeks, song changes and
    /// every few seconds of listening.
    pub position: f64,
    pub shuffle: bool,
    pub repeat: Repeat,
    /// 0 to 100.
    pub volume: u8,
    /// Newest first.
    pub recent: Vec<String>,
    /// Times each song was played to its end.
    pub plays: BTreeMap<String, u32>,
    /// Internet Archive songs that were played without being added to the
    /// library, so that Up Next and Recently Played can still name them: at
    /// most [`MAX_GUESTS`], each with an Archive source.
    #[serde(default)]
    pub guests: Vec<Song>,
    /// While shuffled, where each entry of `queue` stands in `unshuffled`, so
    /// that a song queued twice keeps both of its places across a reload; empty
    /// when not shuffled or not known.
    #[serde(default)]
    pub order: Vec<usize>,
    /// The playback's name since it was last empty or forgotten, given by the
    /// browser that first saved it then: a page whose copy names another epoch
    /// than the stored one missed a forget, and takes it up instead of bringing
    /// back what was forgotten. A plain id; absent in a playback saved before
    /// epochs were kept.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub epoch: Option<String>,
    /// What Shuffle keeps together; absent means songs, none kept together.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shuffle_by: Option<ShuffleBy>,
    /// Where each song set to remember its position was left, in seconds.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub bookmarks: BTreeMap<String, f64>,
}

/// Controls > Shuffle: what stays together in a shuffled queue.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum ShuffleBy {
    Songs,
    Albums,
    Groupings,
}

/// The row height of the song lists, as the Preferences' List Size names it.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum ListSize {
    Small,
    Medium,
    Large,
}

/// The Preferences settings this desktop carries out, and so keeps. No other
/// field is taken: a setting the window shows dimmed cannot be stored as if it
/// did something. The optional ones are absent from settings saved before
/// they were kept.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(
    crate = "ferrite_app::serde",
    deny_unknown_fields,
    rename_all = "camelCase"
)]
pub struct Preferences {
    /// General: List Size.
    pub list_size: ListSize,
    /// General: Notifications, When song changes.
    pub notifications: bool,
    /// Advanced: MiniPlayer, Keep on top of all other windows.
    pub mini_player_on_top: bool,
    /// General: Show, Star ratings.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub star_ratings: Option<bool>,
    /// General: Show, Songs list checkboxes.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub song_checkboxes: Option<bool>,
    /// Playback: Crossfade songs.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub crossfade: Option<bool>,
    /// Playback: how long a crossfade lasts, in seconds, 1 to 12.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub crossfade_seconds: Option<u8>,
    /// Playback: Sound Enhancer.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sound_enhancer: Option<bool>,
    /// Playback: how much Sound Enhancer does, 0 (Low) to 100 (High).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sound_enhancer_level: Option<u8>,
    /// Playback: Sound Check.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sound_check: Option<bool>,
}

impl Preferences {
    /// Why the sliders' values cannot be kept, if they cannot.
    fn invalid(&self) -> Option<&'static str> {
        if self
            .crossfade_seconds
            .is_some_and(|s| !(1..=12).contains(&s))
        {
            return Some("a crossfade lasts 1 to 12 seconds");
        }
        if self.sound_enhancer_level.is_some_and(|l| l > 100) {
            return Some("Sound Enhancer goes from 0 to 100");
        }
        None
    }
}

/// What the item route found an Internet Archive item to hold, kept for the
/// person under `verified/<identifier>`: a library or playback save may name
/// only this licence and these files of the item.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Verified {
    pub license: String,
    pub files: Vec<String>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct LibraryBody {
    library: Library,
    rev: u64,
    #[serde(default)]
    session: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct PlaybackBody {
    playback: Playback,
    rev: u64,
    #[serde(default)]
    session: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct PreferencesBody {
    preferences: Preferences,
    rev: u64,
    #[serde(default)]
    session: Option<String>,
}

/// The lyrics typed in Song Info, by song id.
type Lyrics = BTreeMap<String, String>;

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct LyricsBody {
    lyrics: Lyrics,
    rev: u64,
    #[serde(default)]
    session: Option<String>,
}

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    let path = cx.request.path;
    let outcome = match (path, cx.request.method) {
        ("/library", "GET") => get_document::<Library>(&mut cx, LIBRARY, "library").await,
        ("/library", "PUT") => put_library(&mut cx).await,
        ("/library", "DELETE") => delete_library(&mut cx).await,
        ("/playback", "GET") => get_document::<Playback>(&mut cx, PLAYBACK, "playback").await,
        ("/playback", "PUT") => put_playback(&mut cx).await,
        ("/playback", "DELETE") => {
            document::write::<Playback>(&mut cx.storage.user(), PLAYBACK, None, None)
                .await
                .map(|saved| document::answer(saved, None, |doc, rev| reply("playback", doc, rev)))
        }
        ("/archive/search", "GET") => Ok(search(&mut cx).await),
        ("/radio/stations", "GET") => Ok(radio_stations(&mut cx).await),
        ("/preferences", "GET") => {
            get_document::<Preferences>(&mut cx, PREFERENCES, "preferences").await
        }
        ("/preferences", "PUT") => put_preferences(&mut cx).await,
        ("/preferences", "DELETE") => {
            document::write::<Preferences>(&mut cx.storage.user(), PREFERENCES, None, None)
                .await
                .map(|saved| {
                    document::answer(saved, None, |doc, rev| reply("preferences", doc, rev))
                })
        }
        ("/lyrics", "GET") => get_document::<Lyrics>(&mut cx, LYRICS, "lyrics").await,
        ("/lyrics", "PUT") => put_lyrics(&mut cx).await,
        ("/lyrics", "DELETE") => {
            document::write::<Lyrics>(&mut cx.storage.user(), LYRICS, None, None)
                .await
                .map(|saved| document::answer(saved, None, |doc, rev| reply("lyrics", doc, rev)))
        }
        (
            "/library" | "/playback" | "/preferences" | "/lyrics" | "/archive/search"
            | "/radio/stations",
            _,
        ) => Ok(Response::method_not_allowed()),
        _ if path == "/sharing" || path.starts_with("/sharing/") => sharing::route(&mut cx).await,
        _ => {
            if let Some(identifier) = path.strip_prefix("/archive/item/") {
                match cx.request.method {
                    "GET" if archive::valid_identifier(identifier) => {
                        Ok(item(&mut cx, identifier).await)
                    }
                    "GET" => Ok(Response::error(
                        400,
                        "that is not an Internet Archive identifier",
                    )),
                    _ => Ok(Response::method_not_allowed()),
                }
            } else if let Some(digest) = path.strip_prefix("/artwork/") {
                if valid_digest(digest) {
                    artwork(&mut cx, digest).await
                } else {
                    Ok(Response::error(
                        400,
                        "a cover is named by the SHA-256 of its bytes, in lowercase hex",
                    ))
                }
            } else {
                Ok(Response::not_found())
            }
        }
    };
    outcome.unwrap_or_else(|error| Response::error(503, &format!("storage failed: {error}")))
}

/// What a `GET` of a document answers: `{<field>: doc | null, "rev"}`.
fn reply<T: serde::Serialize>(field: &str, doc: Option<&T>, rev: u64) -> Value {
    let mut body = serde_json::Map::new();
    body.insert(
        field.into(),
        serde_json::to_value(doc).unwrap_or(Value::Null),
    );
    body.insert("rev".into(), rev.into());
    Value::Object(body)
}

async fn get_document<T>(cx: &mut ApiCtx<'_>, key: &str, field: &str) -> std::io::Result<Response>
where
    T: serde::Serialize + serde::de::DeserializeOwned,
{
    let session = cx.session;
    let current = document::read::<T>(&mut cx.storage.user(), key).await?;
    Ok(document::for_session(
        reply(field, current.doc.as_ref(), current.rev),
        session,
    ))
}

fn parse_body<T: serde::de::DeserializeOwned>(body: &[u8]) -> Result<T, Response> {
    serde_json::from_slice(body)
        .map_err(|e| Response::error(400, &format!("the body is not the expected JSON: {e}")))
}

/// How many bytes `doc` takes as JSON, as it is stored.
fn json_size<T: serde::Serialize>(doc: &T) -> usize {
    serde_json::to_vec(doc).map_or(usize::MAX, |bytes| bytes.len())
}

/// The covers a library names.
fn covers(library: &Library) -> BTreeSet<&str> {
    library
        .songs
        .iter()
        .filter_map(|song| song.artwork.as_deref())
        .collect()
}

/// The covers `before` named and `kept` does not: those a save let go. A
/// cover not yet named (uploaded before its song is saved) is not among them.
pub fn covers_let_go(before: &Library, kept: Option<&Library>) -> Vec<String> {
    let still = kept.map(covers).unwrap_or_default();
    covers(before)
        .difference(&still)
        .map(|digest| digest.to_string())
        .collect()
}

/// Finish forgetting the covers let go ([`finish_covers`]). A failure is
/// traced: the covers stay recorded, and a later save finishes them.
async fn drop_covers(space: &mut Space<'_>, now: u64) {
    if let Err(error) = finish_covers(space, now).await {
        ferrite_app::tracing::warn!(%error, "could not forget a Music cover");
    }
}

/// Compare-and-set attempts before a write to the library gives up on a
/// library that keeps changing under it.
const ATTEMPTS: usize = 8;

/// How long one request's claim on deleting the covers let go holds: far
/// longer than a request may run, so only a request that stopped part way
/// leaves a claim another request takes over.
const CLAIM_MS: u64 = 60_000;

/// Tells this process's claims apart within one millisecond.
static CLAIMS: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

/// Who is deleting the covers let go, and since when.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
struct Claim {
    by: String,
    at: u64,
}

/// The library as stored: `document.rs`'s `{"rev", "doc"}` (which is all a
/// `GET` reads), with the covers let go and not yet deleted, and the claim of
/// the request deleting them.
///
/// A cover is deleted only while it is listed in `pending`, and it is listed
/// there only by a write of this one key (compare-and-set) that also checks
/// the library does not name it. While it is listed, a save stores no song
/// with it and its `PUT` is refused, so nothing can name it again before it
/// is gone; a request that stops part way leaves it listed, and the next save
/// deletes it. So a stored library never names a deleted cover, however
/// requests interleave or stop.
#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct StoredLibrary {
    rev: u64,
    doc: Option<Library>,
    #[serde(default)]
    pending: Vec<String>,
    #[serde(default)]
    claim: Option<Claim>,
    /// The writes that named themselves (`document.rs`), kept by every write here.
    #[serde(default)]
    writes: Vec<String>,
    #[serde(default)]
    writes_from: Option<u64>,
}

#[derive(serde::Serialize)]
#[serde(crate = "ferrite_app::serde")]
struct StoredLibraryRef<'a> {
    rev: u64,
    doc: Option<&'a Library>,
    #[serde(skip_serializing_if = "no_pending")]
    pending: &'a [String],
    #[serde(skip_serializing_if = "Option::is_none")]
    claim: Option<&'a Claim>,
    #[serde(skip_serializing_if = "no_pending")]
    writes: &'a [String],
    #[serde(skip_serializing_if = "Option::is_none")]
    writes_from: Option<u64>,
}

/// Whether a stored library has no covers waiting to be deleted, or no named
/// writes. A named function: the hosted code gate cannot parse a qualified path
/// such as `<[String]>::is_empty` in a serde callback (CODE_MACRO_OPAQUE).
fn no_pending(pending: &&[String]) -> bool {
    pending.is_empty()
}

/// The stored library and the store's version of it (`None` before the first
/// save).
async fn read_library(space: &mut Space<'_>) -> std::io::Result<(Option<u64>, StoredLibrary)> {
    Ok(match space.get_versioned(LIBRARY).await? {
        None => (
            None,
            StoredLibrary {
                rev: 0,
                doc: None,
                pending: Vec::new(),
                claim: None,
                writes: Vec::new(),
                writes_from: None,
            },
        ),
        Some((bytes, version)) => {
            let stored = serde_json::from_slice(&bytes).map_err(std::io::Error::other)?;
            (Some(version), stored)
        }
    })
}

/// Write `stored` if the store is still at `version`; `Ok(false)` when
/// another write got there first.
async fn write_library(
    space: &mut Space<'_>,
    version: Option<u64>,
    stored: &StoredLibraryRef<'_>,
) -> std::io::Result<bool> {
    let bytes = serde_json::to_vec(stored).map_err(std::io::Error::other)?;
    space.put_if_version(LIBRARY, &bytes, version).await
}

/// The bytes of the cover `digest`: none when it has none, or a deleted one's
/// mark ([`erase_cover`]).
async fn cover_bytes(space: &mut Space<'_>, digest: &str) -> std::io::Result<Option<Vec<u8>>> {
    let bytes = space.get(&format!("{ARTWORK}{digest}")).await?;
    Ok(bytes.filter(|bytes| !bytes.is_empty()))
}

/// The covers stored, without the marks of deleted ones, however many of those
/// sort among them.
async fn stored_covers(space: &mut Space<'_>) -> std::io::Result<Vec<String>> {
    let mut live = Vec::new();
    let mut after: Option<String> = None;
    loop {
        let (page, more) = space.list_after(ARTWORK, after.as_deref(), 32).await?;
        after = page.last().map(|(key, _)| key.clone());
        live.extend(
            page.into_iter()
                .filter(|(_, bytes)| !bytes.is_empty())
                .map(|(key, _)| key[ARTWORK.len()..].to_string()),
        );
        if !more || after.is_none() {
            return Ok(live);
        }
    }
}

/// Delete the cover `digest` if it is still `version`: the store has no
/// conditional delete, so its bytes give way to an empty mark that expires. A
/// request that stalled past its claim therefore cannot delete the same cover
/// uploaded again since: that has another version, and is left alone.
async fn erase_cover(
    space: &mut Space<'_>,
    digest: &str,
    version: u64,
    now: u64,
) -> std::io::Result<bool> {
    let expires = now.saturating_add(CLAIM_MS);
    space
        .put_if_version_expiring(&format!("{ARTWORK}{digest}"), b"", Some(version), expires)
        .await
}

/// The covers a stored library names.
fn named_covers(stored: &StoredLibrary) -> BTreeSet<String> {
    stored
        .doc
        .as_ref()
        .map(|doc| covers(doc).into_iter().map(String::from).collect())
        .unwrap_or_default()
}

/// Store `library` (`None` forgets it) under the next revision if `base` is
/// the stored one (`None`: whatever is stored), as `document::write` does,
/// listing the covers the replaced library named and this one does not as
/// let go, in the same write; then delete them ([`finish_covers`]).
///
/// A song naming a cover that is let go, or one this save names newly that
/// is not stored, is stored without it. Answers what was stored.
async fn save_library(
    space: &mut Space<'_>,
    now: u64,
    base: Option<u64>,
    mut library: Option<Library>,
) -> std::io::Result<(document::Saved<Library>, Option<Library>)> {
    // Covers an earlier request let go and did not get to delete.
    drop_covers(space, now).await;
    for _ in 0..ATTEMPTS {
        let (version, current) = read_library(space).await?;
        if base.is_some_and(|base| base != current.rev) {
            space
                .write_ids()
                .heard(&current.writes, current.writes_from.unwrap_or(current.rev));
            let conflict = document::Current {
                doc: current.doc,
                rev: current.rev,
            };
            return Ok((document::Saved::Conflict(conflict), None));
        }
        if let Some(library) = library.as_mut() {
            let had = named_covers(&current);
            let added: Vec<String> = covers(library)
                .into_iter()
                .filter(|digest| !had.contains(*digest))
                .map(String::from)
                .collect();
            let mut gone: BTreeSet<String> = current.pending.iter().cloned().collect();
            for digest in added {
                if cover_bytes(space, &digest).await?.is_none() {
                    gone.insert(digest);
                }
            }
            for song in &mut library.songs {
                if song.artwork.as_ref().is_some_and(|d| gone.contains(d)) {
                    song.artwork = None;
                }
            }
        }
        let rev = current
            .rev
            .checked_add(1)
            .ok_or_else(|| std::io::Error::other("the library's revision is at its limit"))?;
        let replaced = current.doc.clone().unwrap_or_default();
        let mut pending = current.pending.clone();
        for digest in covers_let_go(&replaced, library.as_ref()) {
            // Past the cap, a cover let go stays stored, for the quota sweep to reclaim.
            if pending.len() >= MAX_ARTWORKS {
                break;
            }
            if !pending.contains(&digest) {
                pending.push(digest);
            }
        }
        let (writes, writes_from) = document::with_write(
            current.writes,
            current.writes_from,
            current.rev,
            space.write_ids().this(),
        );
        let stored = StoredLibraryRef {
            rev,
            doc: library.as_ref(),
            pending: &pending,
            claim: current.claim.as_ref(),
            writes: &writes,
            writes_from,
        };
        if write_library(space, version, &stored).await? {
            drop_covers(space, now).await;
            return Ok((document::Saved::Stored(rev), library));
        }
    }
    Err(std::io::Error::other(
        "the library kept changing during the save",
    ))
}

/// List those of `candidates` that the stored library does not name as let
/// go, without changing the library or its revision. Only covers that are
/// stored are listed, and the list never holds more than [`MAX_ARTWORKS`]:
/// the rest stay stored until a later sweep.
async fn mark_covers(space: &mut Space<'_>, candidates: &[String]) -> std::io::Result<()> {
    let mut stored = Vec::new();
    for digest in candidates {
        if cover_bytes(space, digest).await?.is_some() {
            stored.push(digest.clone());
        }
    }
    for _ in 0..ATTEMPTS {
        let (version, current) = read_library(space).await?;
        let named = named_covers(&current);
        let mut pending = current.pending.clone();
        for digest in &stored {
            if pending.len() >= MAX_ARTWORKS {
                break;
            }
            if !named.contains(digest) && !pending.contains(digest) {
                pending.push(digest.clone());
            }
        }
        if pending.len() == current.pending.len() {
            return Ok(());
        }
        let stored = StoredLibraryRef {
            rev: current.rev,
            doc: current.doc.as_ref(),
            pending: &pending,
            claim: current.claim.as_ref(),
            writes: &current.writes,
            writes_from: current.writes_from,
        };
        if write_library(space, version, &stored).await? {
            return Ok(());
        }
    }
    Err(std::io::Error::other(
        "the library kept changing while covers were let go",
    ))
}

/// Delete the covers listed as let go: claim them (one request at a time;
/// a claim older than [`CLAIM_MS`] belongs to a request that stopped and is
/// taken over), delete their bytes, then take them off the list. A failure
/// leaves them listed, and claimed until the claim runs out.
async fn finish_covers(space: &mut Space<'_>, now: u64) -> std::io::Result<()> {
    let by = format!(
        "{now}-{}",
        CLAIMS.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
    );
    let mut claimed: Option<(Vec<String>, Vec<(String, u64)>)> = None;
    for _ in 0..ATTEMPTS {
        let (version, current) = read_library(space).await?;
        if current.pending.is_empty() {
            return Ok(());
        }
        if current
            .claim
            .as_ref()
            .is_some_and(|claim| now.saturating_sub(claim.at) < CLAIM_MS)
        {
            // Another request is deleting them.
            return Ok(());
        }
        // Read before the claim's write, which holds only if the library has not changed: these
        // are the versions of the covers let go, not of any uploaded after another request
        // finished deleting them.
        let mut doomed = Vec::new();
        for digest in &current.pending {
            let key = format!("{ARTWORK}{digest}");
            if let Some((bytes, cover)) = space.get_versioned(&key).await? {
                if !bytes.is_empty() {
                    doomed.push((digest.clone(), cover));
                }
            }
        }
        let claim = Claim {
            by: by.clone(),
            at: now,
        };
        let stored = StoredLibraryRef {
            rev: current.rev,
            doc: current.doc.as_ref(),
            pending: &current.pending,
            claim: Some(&claim),
            writes: &current.writes,
            writes_from: current.writes_from,
        };
        if write_library(space, version, &stored).await? {
            claimed = Some((current.pending.clone(), doomed));
            break;
        }
    }
    let Some((digests, doomed)) = claimed else {
        return Err(std::io::Error::other(
            "the library kept changing while covers were deleted",
        ));
    };
    for (digest, version) in &doomed {
        erase_cover(space, digest, *version, now).await?;
    }
    for _ in 0..ATTEMPTS {
        let (version, current) = read_library(space).await?;
        if current.claim.as_ref().map(|claim| claim.by.as_str()) != Some(by.as_str()) {
            // Taken over after it ran out: the request that took it finishes.
            return Ok(());
        }
        let pending: Vec<String> = current
            .pending
            .iter()
            .filter(|digest| !digests.contains(digest))
            .cloned()
            .collect();
        let stored = StoredLibraryRef {
            rev: current.rev,
            doc: current.doc.as_ref(),
            pending: &pending,
            claim: None,
            writes: &current.writes,
            writes_from: current.writes_from,
        };
        if write_library(space, version, &stored).await? {
            return Ok(());
        }
    }
    Err(std::io::Error::other(
        "the library kept changing while covers were deleted",
    ))
}

/// Forget those of `candidates` that the stored library does not name:
/// list them as let go, then delete them.
async fn sweep_covers(
    space: &mut Space<'_>,
    now: u64,
    candidates: &[String],
) -> std::io::Result<()> {
    if candidates.is_empty() {
        return Ok(());
    }
    mark_covers(space, candidates).await?;
    finish_covers(space, now).await
}

/// Whether `digest` is listed as let go and not yet deleted.
async fn cover_pending(space: &mut Space<'_>, digest: &str) -> std::io::Result<bool> {
    let (_, current) = read_library(space).await?;
    Ok(current.pending.iter().any(|pending| pending == digest))
}

#[cfg(test)]
mod stored_tests {
    use super::*;

    /// The quota and the deletion of a whole library see every cover, past any
    /// number of marks that sort before it.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn the_marks_of_deleted_covers_hide_no_cover() {
        let env = ferrite_app_test::TestHarness::new()
            .with_store("data")
            .build()
            .await;
        let mut client = env.store("data");
        let mut storage = crate::module::Storage::new(&mut client, MODULE.name, "someone");
        let mut space = storage.user();
        for n in 0..MAX_ARTWORKS {
            space.put(&format!("{ARTWORK}a{n:04}"), b"").await.unwrap();
        }
        space.put(&format!("{ARTWORK}z"), b"cover").await.unwrap();
        assert_eq!(stored_covers(&mut space).await.unwrap(), vec!["z"]);
    }

    /// What a request that stalled past its claim does when it resumes, once
    /// another request has finished and the same cover has been uploaded again.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn a_late_deletion_leaves_a_cover_uploaded_again() {
        let env = ferrite_app_test::TestHarness::new()
            .with_store("data")
            .build()
            .await;
        let mut client = env.store("data");
        let mut storage = crate::module::Storage::new(&mut client, MODULE.name, "someone");
        let mut space = storage.user();
        let key = format!("{ARTWORK}digest");
        space.put(&key, b"cover").await.unwrap();
        let (_, seen) = space.get_versioned(&key).await.unwrap().unwrap();

        assert!(erase_cover(&mut space, "digest", seen, 1).await.unwrap());
        assert_eq!(cover_bytes(&mut space, "digest").await.unwrap(), None);
        assert_eq!(
            stored_covers(&mut space).await.unwrap(),
            Vec::<String>::new()
        );

        space.put(&key, b"cover").await.unwrap();
        assert!(!erase_cover(&mut space, "digest", seen, 1).await.unwrap());
        assert_eq!(
            cover_bytes(&mut space, "digest").await.unwrap().as_deref(),
            Some(&b"cover"[..])
        );
        assert_eq!(stored_covers(&mut space).await.unwrap(), vec!["digest"]);
    }

    #[test]
    fn a_library_with_nothing_let_go_is_stored_as_document_rs_stores_it() {
        let bytes = serde_json::to_vec(&StoredLibraryRef {
            rev: 4,
            doc: None,
            pending: &[],
            claim: None,
            writes: &[],
            writes_from: None,
        })
        .unwrap();
        assert_eq!(String::from_utf8_lossy(&bytes), r#"{"rev":4,"doc":null}"#);
        let read: StoredLibrary = serde_json::from_slice(&bytes).unwrap();
        assert!(read.pending.is_empty() && read.claim.is_none());
    }

    #[test]
    fn covers_let_go_and_their_claim_round_trip_beside_the_document() {
        let claim = Claim {
            by: "7-1".into(),
            at: 7,
        };
        let pending = ["a".repeat(64)];
        let bytes = serde_json::to_vec(&StoredLibraryRef {
            rev: 2,
            doc: Some(&Library::default()),
            pending: &pending,
            claim: Some(&claim),
            writes: &["page-1".to_owned()],
            writes_from: Some(1),
        })
        .unwrap();
        let read: StoredLibrary = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(read.rev, 2);
        assert_eq!(read.pending, pending);
        assert_eq!(read.claim, Some(claim));
        assert_eq!(read.writes, ["page-1"]);
        assert_eq!(read.writes_from, Some(1));
        // What `document::read` (a `GET`) takes from it: the document and its revision.
        let value: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(value["doc"]["songs"], serde_json::json!([]));
    }
}

/// The Archive songs of `songs` whose source is not already among `old`'s:
/// the ones a save adds or changes, which are checked against what the item
/// route found.
pub fn new_archive_songs<'a>(songs: &'a [Song], old: &[Song]) -> Vec<&'a Song> {
    let known: Vec<&Source> = old.iter().map(|song| &song.source).collect();
    songs
        .iter()
        .filter(|song| {
            matches!(song.source, Source::Archive { .. }) && !known.contains(&&song.source)
        })
        .collect()
}

/// Whether one Archive source names exactly the licence and only files of
/// what the item route found the item to hold.
pub fn matches_verified(source: &Source, record: &Verified) -> bool {
    match source {
        Source::Archive { files, license, .. } => {
            record.license == *license && files.values().all(|f| record.files.contains(f))
        }
        Source::File { .. } | Source::Stream { .. } => true,
    }
}

/// Check every Archive song of `songs` against the person's `verified/`
/// records: `Ok(Err(why))` when one names an item never opened, another
/// licence or a file the item does not hold.
async fn check_archive(
    space: &mut Space<'_>,
    songs: &[&Song],
) -> std::io::Result<Result<(), String>> {
    let mut records: BTreeMap<String, Option<Verified>> = BTreeMap::new();
    for song in songs {
        let Source::Archive { item, .. } = &song.source else {
            continue;
        };
        if !records.contains_key(item) {
            if records.len() >= MAX_NEW_ITEMS {
                return Ok(Err(format!(
                    "add the songs of at most {MAX_NEW_ITEMS} Internet Archive items at a time"
                )));
            }
            let record = space
                .get_json::<Verified>(&format!("{VERIFIED}{item}"))
                .await?;
            records.insert(item.clone(), record);
        }
        match records.get(item).and_then(Option::as_ref) {
            None => {
                return Ok(Err(format!(
                    "{item:?} was not opened in Music's Internet Archive browser"
                )))
            }
            Some(record) if !matches_verified(&song.source, record) => {
                return Ok(Err(format!(
                    "{:?} names a licence or files the Internet Archive does not list for {item:?}",
                    song.title
                )))
            }
            Some(_) => {}
        }
    }
    Ok(Ok(()))
}

async fn put_library(cx: &mut ApiCtx<'_>) -> std::io::Result<Response> {
    let body: LibraryBody = match parse_body(cx.request.body) {
        Ok(body) => body,
        Err(refused) => return Ok(refused),
    };
    if let Err(message) = validate_library(&body.library) {
        return Ok(Response::error(400, &message));
    }
    if json_size(&body.library) > MAX_LIBRARY_BYTES {
        return Ok(Response::error(
            413,
            &format!("a library is at most {MAX_LIBRARY_BYTES} bytes; delete some songs first"),
        ));
    }
    if let Some(refused) = document::other_session(body.session.as_deref(), cx.session) {
        return Ok(refused);
    }
    let mut space = cx.storage.user();
    let before = document::read::<Library>(&mut space, LIBRARY).await?;
    let current = before.rev == body.rev;
    let old = before.doc.unwrap_or_default();
    // A song played from the Archive and kept with the playback was checked when
    // it was kept there: moving it into the library needs no second check.
    let guests = document::read::<Playback>(&mut space, PLAYBACK)
        .await?
        .doc
        .map(|playback| playback.guests)
        .unwrap_or_default();
    let known: Vec<Song> = old.songs.iter().chain(&guests).cloned().collect();
    let fresh = new_archive_songs(&body.library.songs, &known);
    // A save on an old revision is answered with the conflict, which tells the browser to read the
    // library again, whatever it names.
    if current {
        if let Err(message) = check_archive(&mut space, &fresh).await? {
            return Ok(Response::error(400, &message));
        }
    }
    // The covers the replaced library named and this one does not go with the
    // save ([`save_library`]).
    let now = cx.ctx.now_ms();
    let (saved, stored) = save_library(&mut space, now, Some(body.rev), Some(body.library)).await?;
    Ok(document::answer(saved, stored.as_ref(), |doc, rev| {
        reply("library", doc, rev)
    }))
}

async fn delete_library(cx: &mut ApiCtx<'_>) -> std::io::Result<Response> {
    let now = cx.ctx.now_ms();
    let mut space = cx.storage.user();
    let (saved, _) = save_library(&mut space, now, None, None).await?;
    if matches!(saved, document::Saved::Stored(_)) {
        // Every cover goes with the library, those never named by a saved song too.
        let stored = stored_covers(&mut space).await?;
        if let Err(error) = sweep_covers(&mut space, now, &stored).await {
            ferrite_app::tracing::warn!(%error, "could not forget a Music cover");
        }
    }
    Ok(document::answer(saved, None, |doc, rev| {
        reply("library", doc, rev)
    }))
}

async fn put_playback(cx: &mut ApiCtx<'_>) -> std::io::Result<Response> {
    let body: PlaybackBody = match parse_body(cx.request.body) {
        Ok(body) => body,
        Err(refused) => return Ok(refused),
    };
    if let Err(message) = validate_playback(&body.playback) {
        return Ok(Response::error(400, &message));
    }
    if json_size(&body.playback) > MAX_PLAYBACK_BYTES {
        return Ok(Response::error(
            413,
            &format!("a playback is at most {MAX_PLAYBACK_BYTES} bytes"),
        ));
    }
    if let Some(refused) = document::other_session(body.session.as_deref(), cx.session) {
        return Ok(refused);
    }
    let mut space = cx.storage.user();
    let before = document::read::<Playback>(&mut space, PLAYBACK).await?;
    let current = before.rev == body.rev;
    let old_guests = before.doc.map(|doc| doc.guests).unwrap_or_default();
    let fresh = new_archive_songs(&body.playback.guests, &old_guests);
    if current {
        if let Err(message) = check_archive(&mut space, &fresh).await? {
            return Ok(Response::error(400, &message));
        }
    }
    let saved = document::write(&mut space, PLAYBACK, Some(body.rev), Some(&body.playback)).await?;
    Ok(document::answer(saved, Some(&body.playback), |doc, rev| {
        reply("playback", doc, rev)
    }))
}

/// `PUT /api/music/preferences`: the settings, under the revision rule. Their
/// shape is the check, with List Size one of its three and the sliders in range.
async fn put_preferences(cx: &mut ApiCtx<'_>) -> std::io::Result<Response> {
    let body: PreferencesBody = match parse_body(cx.request.body) {
        Ok(body) => body,
        Err(refused) => return Ok(refused),
    };
    if let Some(message) = body.preferences.invalid() {
        return Ok(Response::error(400, message));
    }
    if let Some(refused) = document::other_session(body.session.as_deref(), cx.session) {
        return Ok(refused);
    }
    let saved = document::write(
        &mut cx.storage.user(),
        PREFERENCES,
        Some(body.rev),
        Some(&body.preferences),
    )
    .await?;
    Ok(document::answer(
        saved,
        Some(&body.preferences),
        |doc, rev| reply("preferences", doc, rev),
    ))
}

/// Check the lyrics of a save: plain ids, and text that breaks lines but holds
/// no other control character.
pub fn validate_lyrics(lyrics: &Lyrics) -> Result<(), String> {
    if lyrics.len() > MAX_SONGS {
        return Err(format!("lyrics are kept for at most {MAX_SONGS} songs"));
    }
    for (id, text) in lyrics {
        if !document::valid_key(id) {
            return Err(format!("lyrics of {id:?}: not a plain id"));
        }
        if text.chars().count() > MAX_LYRICS_CHARS
            || text.chars().any(|c| c.is_control() && c != '\n')
        {
            return Err(format!(
                "lyrics are at most {MAX_LYRICS_CHARS} characters, with no control character but line breaks"
            ));
        }
    }
    Ok(())
}

/// `PUT /api/music/lyrics`: the lyrics typed in Song Info, under the revision rule.
async fn put_lyrics(cx: &mut ApiCtx<'_>) -> std::io::Result<Response> {
    let body: LyricsBody = match parse_body(cx.request.body) {
        Ok(body) => body,
        Err(refused) => return Ok(refused),
    };
    if let Err(message) = validate_lyrics(&body.lyrics) {
        return Ok(Response::error(400, &message));
    }
    if json_size(&body.lyrics) > MAX_LYRICS_BYTES {
        return Ok(Response::error(
            413,
            &format!("the lyrics kept are at most {MAX_LYRICS_BYTES} bytes"),
        ));
    }
    if let Some(refused) = document::other_session(body.session.as_deref(), cx.session) {
        return Ok(refused);
    }
    let saved = document::write(
        &mut cx.storage.user(),
        LYRICS,
        Some(body.rev),
        Some(&body.lyrics),
    )
    .await?;
    Ok(document::answer(saved, Some(&body.lyrics), |doc, rev| {
        reply("lyrics", doc, rev)
    }))
}

/// A text of at most [`MAX_TEXT`] characters with no control character.
fn plain_text(what: &str, text: &str, may_be_empty: bool) -> Result<(), String> {
    if (!may_be_empty && text.trim().is_empty())
        || text.chars().count() > MAX_TEXT
        || text.chars().any(char::is_control)
    {
        return Err(format!(
            "{what} is {} at most {MAX_TEXT} characters without control characters",
            if may_be_empty { "" } else { "1 to" }
        ));
    }
    Ok(())
}

/// Whether `digest` is a SHA-256 in lowercase hex.
pub fn valid_digest(digest: &str) -> bool {
    digest.len() == 64
        && digest
            .bytes()
            .all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
}

/// Ids that name songs of `known`, each once.
fn song_refs(what: &str, ids: &[String], known: &BTreeSet<&str>) -> Result<(), String> {
    let mut seen = BTreeSet::new();
    for id in ids {
        if !known.contains(id.as_str()) {
            return Err(format!("{what}: {id:?} is not a song of the library"));
        }
        if !seen.insert(id.as_str()) {
            return Err(format!("{what}: {id:?} is listed twice"));
        }
    }
    Ok(())
}

fn validate_source(source: &Source) -> Result<(), String> {
    match source {
        Source::File {
            file,
            name,
            media_type,
            size,
        } => {
            if !document::valid_key(file) {
                return Err(format!("{file:?} is not a drive file id"));
            }
            plain_text("a file name", name, false)?;
            if !(media_type.starts_with("audio/") || media_type == "video/mp4")
                || media_type.len() > 100
                || !media_type.bytes().all(|b| b.is_ascii_graphic())
            {
                return Err(format!("{media_type:?} is not an audio type"));
            }
            if *size == 0 || *size > MAX_FILE_SIZE {
                return Err("a song's file size is out of range".into());
            }
        }
        Source::Archive {
            item,
            files,
            license,
        } => {
            if !archive::valid_identifier(item) {
                return Err(format!("{item:?} is not an Internet Archive identifier"));
            }
            if files.is_empty() {
                return Err("an Internet Archive song names at least one file".into());
            }
            for (format, name) in files {
                if !matches!(format.as_str(), "mp3" | "ogg" | "flac") || !archive::valid_file(name)
                {
                    return Err(format!(
                        "{format:?}: {name:?} is not a playable file of the item"
                    ));
                }
            }
            if !archive::open_license(license) {
                return Err("only openly licensed Internet Archive music can be added".into());
            }
        }
        Source::Stream { url } => {
            let scheme = url.starts_with("https://") || url.starts_with("http://");
            if !scheme || url.len() > 2000 || !url.bytes().all(|b| b.is_ascii_graphic()) {
                return Err("a stream is an http or https address of at most 2000 bytes".into());
            }
        }
    }
    Ok(())
}

/// Check one song's own fields.
fn validate_song(song: &Song) -> Result<(), String> {
    if !document::valid_key(&song.id) {
        return Err(format!("song id {:?} is not a plain id", song.id));
    }
    plain_text("a title", &song.title, false)?;
    plain_text("an artist", &song.artist, true)?;
    plain_text("an album", &song.album, true)?;
    plain_text("a genre", &song.genre, true)?;
    plain_text("a composer", &song.composer, true)?;
    plain_text("a grouping", &song.grouping, true)?;
    plain_text("a comment", &song.comments, true)?;
    plain_text("a sort name", &song.sort_name, true)?;
    plain_text("a sort artist", &song.sort_artist, true)?;
    plain_text("a sort album", &song.sort_album, true)?;
    plain_text("a sort album artist", &song.sort_album_artist, true)?;
    plain_text("a sort composer", &song.sort_composer, true)?;
    plain_text("an equalizer preset", &song.eq_preset, true)?;
    if [song.start, song.stop]
        .iter()
        .flatten()
        .any(|at| !at.is_finite() || *at < 0.0 || *at > MAX_DURATION)
    {
        return Err(format!(
            "a start or stop time is 0 to {MAX_DURATION} seconds"
        ));
    }
    if song
        .volume_adjust
        .is_some_and(|adjust| !(-100..=100).contains(&adjust))
    {
        return Err("a volume adjustment is -100 to 100 percent".into());
    }
    if song.year.is_some_and(|year| !(1000..=9999).contains(&year)) {
        return Err("a year has four digits".into());
    }
    if song.track.is_some_and(|track| track == 0 || track > 9999) {
        return Err("a track number is 1 to 9999".into());
    }
    if song.rating.is_some_and(|stars| !(1..=5).contains(&stars)) {
        return Err("a rating is 1 to 5 stars".into());
    }
    if !song.duration.is_finite() || song.duration < 0.0 || song.duration > MAX_DURATION {
        return Err(format!("a song lasts 0 to {MAX_DURATION} seconds"));
    }
    if song
        .artwork
        .as_deref()
        .is_some_and(|digest| !valid_digest(digest))
    {
        return Err("a song's artwork is named by its SHA-256".into());
    }
    validate_source(&song.source)
}

/// Check a submitted library.
pub fn validate_library(library: &Library) -> Result<(), String> {
    if library.songs.len() > MAX_SONGS {
        return Err(format!("a library keeps at most {MAX_SONGS} songs"));
    }
    let mut known = BTreeSet::new();
    for song in &library.songs {
        validate_song(song)?;
        if !known.insert(song.id.as_str()) {
            return Err(format!("song id {:?} is listed twice", song.id));
        }
    }
    if library.playlists.len() > MAX_PLAYLISTS {
        return Err(format!("at most {MAX_PLAYLISTS} playlists"));
    }
    let mut playlist_ids = BTreeSet::new();
    if library.folders.len() > MAX_PLAYLISTS {
        return Err(format!("at most {MAX_PLAYLISTS} playlist folders"));
    }
    let mut parents = BTreeMap::new();
    for folder in &library.folders {
        if !document::valid_key(&folder.id)
            || parents
                .insert(folder.id.as_str(), folder.parent.as_deref())
                .is_some()
        {
            return Err(format!(
                "folder id {:?} is not a plain id listed once",
                folder.id
            ));
        }
        plain_text("a folder's name", &folder.name, false)?;
    }
    for folder in &library.folders {
        let mut above = folder.parent.as_deref();
        let mut steps = 0;
        while let Some(id) = above {
            steps += 1;
            above = match parents.get(id) {
                None => return Err(format!("folder {:?} is in no known folder", folder.name)),
                Some(_) if steps > library.folders.len() => {
                    return Err(format!("folder {:?} is inside itself", folder.name))
                }
                Some(parent) => *parent,
            };
        }
    }
    for playlist in &library.playlists {
        if !document::valid_key(&playlist.id) || !playlist_ids.insert(playlist.id.as_str()) {
            return Err(format!(
                "playlist id {:?} is not a plain id listed once",
                playlist.id
            ));
        }
        plain_text("a playlist's name", &playlist.name, false)?;
        if let Some(smart) = &playlist.smart {
            validate_smart(playlist, smart)?;
        }
        if let Some(folder) = &playlist.folder {
            if !parents.contains_key(folder.as_str()) {
                return Err(format!(
                    "playlist {:?} is in no known folder",
                    playlist.name
                ));
            }
        }
        song_refs(
            &format!("playlist {:?}", playlist.name),
            &playlist.songs,
            &known,
        )?;
    }
    song_refs("Loved", &library.loved, &known)
}

/// Check a submitted playback. It names songs by id only: a song deleted from
/// the library meanwhile is skipped by the browser.
pub fn validate_playback(playback: &Playback) -> Result<(), String> {
    let ids = |what: &str, list: &[String], max: usize| -> Result<(), String> {
        if list.len() > max {
            return Err(format!("{what} has at most {max} songs"));
        }
        match list.iter().find(|id| !document::valid_key(id)) {
            Some(id) => Err(format!("{what}: {id:?} is not a plain id")),
            None => Ok(()),
        }
    };
    ids("Up Next", &playback.queue, MAX_QUEUE)?;
    ids("the unshuffled order", &playback.unshuffled, MAX_QUEUE)?;
    if !playback.unshuffled.is_empty() && !playback.shuffle {
        return Err("only a shuffled queue keeps its unshuffled order".into());
    }
    if playback.index > playback.queue.len() {
        return Err("the place in Up Next is past its end".into());
    }
    if !playback.position.is_finite() || playback.position < 0.0 || playback.position > MAX_DURATION
    {
        return Err("the position is out of range".into());
    }
    if playback.volume > 100 {
        return Err("the volume is 0 to 100".into());
    }
    if playback
        .epoch
        .as_deref()
        .is_some_and(|epoch| !document::valid_key(epoch) || epoch.len() > 64)
    {
        return Err("a playback's epoch is a plain id of at most 64 characters".into());
    }
    ids("Recently Played", &playback.recent, MAX_RECENT)?;
    let unique: BTreeSet<&String> = playback.recent.iter().collect();
    if unique.len() != playback.recent.len() {
        return Err("Recently Played lists each song once".into());
    }
    if playback.plays.len() > MAX_SONGS {
        return Err(format!("at most {MAX_SONGS} play counts"));
    }
    if let Some(id) = playback.plays.keys().find(|id| !document::valid_key(id)) {
        return Err(format!("play count of {id:?}: not a plain id"));
    }
    if playback.bookmarks.len() > MAX_SONGS {
        return Err(format!("at most {MAX_SONGS} remembered positions"));
    }
    if let Some((id, _)) = playback
        .bookmarks
        .iter()
        .find(|(id, place)| !document::valid_key(id) || !place.is_finite() || **place < 0.0)
    {
        return Err(format!(
            "remembered position of {id:?}: not a plain id and a place"
        ));
    }
    if playback.guests.len() > MAX_GUESTS {
        return Err(format!("at most {MAX_GUESTS} songs outside the library"));
    }
    let mut seen = BTreeSet::new();
    for song in &playback.guests {
        validate_song(song)?;
        if matches!(song.source, Source::File { .. }) {
            return Err(
                "only Internet Archive songs and streams play without being in the library".into(),
            );
        }
        if !seen.insert(song.id.as_str()) {
            return Err(format!("song id {:?} is listed twice", song.id));
        }
    }
    if !playback.order.is_empty() {
        let len = playback.queue.len();
        if !playback.shuffle || playback.order.len() != len || playback.unshuffled.len() != len {
            return Err("the shuffled order names every entry of a shuffled queue once".into());
        }
        let mut places = vec![false; len];
        for (entry, &place) in playback.order.iter().enumerate() {
            if place >= len || places[place] || playback.unshuffled[place] != playback.queue[entry]
            {
                return Err("the shuffled order does not match the two queues".into());
            }
            places[place] = true;
        }
    }
    Ok(())
}

/// The media type of a cover, from its first bytes: JPEG or PNG only.
pub fn image_type(bytes: &[u8]) -> Option<&'static str> {
    if bytes.len() > 3 && bytes[..3] == [0xFF, 0xD8, 0xFF] {
        Some("image/jpeg")
    } else if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some("image/png")
    } else {
        None
    }
}

async fn artwork(cx: &mut ApiCtx<'_>, digest: &str) -> std::io::Result<Response> {
    let key = format!("{ARTWORK}{digest}");
    match cx.request.method {
        "GET" => Ok(match cover_bytes(&mut cx.storage.user(), digest).await? {
            Some(bytes) => {
                let kind = image_type(&bytes).unwrap_or("application/octet-stream");
                Response::new(200, bytes)
                    .add_header("content-type", kind)
                    // The name is the digest of the bytes, but it is the same for everyone who
                    // keeps that cover: the browser asks again each time, so a person signed
                    // in after another is answered by the server, never by the cache.
                    .add_header("cache-control", "private, no-cache")
            }
            None => Response::not_found(),
        }),
        "PUT" => {
            let body = cx.request.body;
            if body.len() > MAX_ARTWORK_BYTES {
                return Ok(Response::error(
                    413,
                    &format!("a cover has at most {MAX_ARTWORK_BYTES} bytes"),
                ));
            }
            if image_type(body).is_none() {
                return Ok(Response::error(400, "a cover is a JPEG or PNG picture"));
            }
            let actual = ferrite_app::crypto::hex(&ferrite_app::crypto::sha256(body));
            if actual != digest {
                return Ok(Response::error(
                    400,
                    "the cover's bytes do not have the SHA-256 it is named by",
                ));
            }
            let now = cx.ctx.now_ms();
            let mut space = cx.storage.user();
            // A cover being let go is deleted first; one still being deleted by
            // another request is refused for now (the browser keeps the song
            // without it), so nothing names it again before it is gone.
            if cover_pending(&mut space, digest).await? {
                drop_covers(&mut space, now).await;
                if cover_pending(&mut space, digest).await? {
                    return Ok(Response::error(
                        409,
                        "this cover is being let go; try again in a minute",
                    ));
                }
            }
            if cover_bytes(&mut space, digest).await?.is_some() {
                return Ok(Response::json(
                    200,
                    &serde_json::json!({ "artwork": digest }),
                ));
            }
            let mut stored = stored_covers(&mut space).await?;
            if stored.len() >= MAX_ARTWORKS {
                // At the limit, the covers no song of the stored library names go
                // first: uploads whose song was never saved.
                sweep_covers(&mut space, now, &stored).await?;
                stored = stored_covers(&mut space).await?;
            }
            if stored.len() >= MAX_ARTWORKS {
                return Ok(Response::error(
                    409,
                    &format!("Music keeps at most {MAX_ARTWORKS} covers; delete some songs first"),
                ));
            }
            space.put(&key, body).await?;
            Ok(Response::json(
                201,
                &serde_json::json!({ "artwork": digest }),
            ))
        }
        "DELETE" => {
            let now = cx.ctx.now_ms();
            let mut space = cx.storage.user();
            // Only a cover the stored library does not name goes ([`sweep_covers`]).
            sweep_covers(&mut space, now, &[digest.to_string()]).await?;
            if cover_bytes(&mut space, digest).await?.is_some() {
                return Ok(Response::error(409, "a song of the library has this cover"));
            }
            Ok(Response::json(200, &serde_json::json!({ "deleted": true })))
        }
        _ => Ok(Response::method_not_allowed()),
    }
}

/// One GET through the declared egress `handle` to the source named `who`: the
/// body of a 200, or the reply to give the browser.
async fn fetch_from(
    cx: &mut ApiCtx<'_>,
    handle: &str,
    who: &str,
    url: &str,
) -> Result<Vec<u8>, Response> {
    // No deadline of its own: upstream Core's SDK has no `EgressDeadline`, so
    // the platform's egress timeout bounds the exchange.
    let mut egress = cx
        .ctx
        .egress(handle)
        .map_err(|error| Response::error(503, &format!("no egress to {who}: {error}")))?;
    let accept = [ferrite_app::EgressHeader {
        name: "accept".into(),
        value: "application/json".into(),
    }];
    match egress
        .deliver_http(EgressHttpMethod::Get, url, &accept, &[])
        .await
    {
        Ok(EgressOutcome::Delivered { status: 200, body }) => Ok(body),
        Ok(EgressOutcome::Delivered { status, .. }) => Err(Response::error(
            502,
            &format!("{who} answered HTTP {status}"),
        )),
        Ok(EgressOutcome::Denied { reason }) => Err(Response::error(
            502,
            &format!("egress refused {who}: {reason}"),
        )),
        Err(error) => Err(Response::error(
            502,
            &format!("{who} could not be reached: {error}"),
        )),
    }
}

async fn fetch(cx: &mut ApiCtx<'_>, url: &str) -> Result<Vec<u8>, Response> {
    fetch_from(cx, archive::EGRESS, "the Internet Archive", url).await
}

async fn radio_stations(cx: &mut ApiCtx<'_>) -> Response {
    let raw = cx.request.query_param("name").unwrap_or("");
    let Some(name) = super::spotlight::decode(raw) else {
        return Response::error(400, "the name is not valid percent-encoded UTF-8");
    };
    let name = name.trim().to_string();
    if name.chars().count() > radio::MAX_QUERY_CHARS {
        return Response::error(
            400,
            &format!("a name has at most {} characters", radio::MAX_QUERY_CHARS),
        );
    }
    let genre = match cx.request.query_param("genre").unwrap_or("") {
        "" => None,
        genre => match radio::GENRES.iter().find(|known| **known == genre) {
            Some(known) => Some(*known),
            None => return Response::error(400, "that genre is not one Radio offers"),
        },
    };
    let page = match cx.request.query_param("page").unwrap_or("1").parse::<u32>() {
        Ok(page) if (1..=radio::MAX_PAGE).contains(&page) => page,
        _ => return Response::error(400, &format!("the page is 1 to {}", radio::MAX_PAGE)),
    };
    let url = radio::search_url(&name, genre, page);
    let body = match fetch_from(cx, radio::EGRESS, "the Radio Browser directory", &url).await {
        Ok(body) => body,
        Err(reply) => return reply,
    };
    match radio::stations(&body) {
        Some(answer) => Response::json(200, &answer),
        None => Response::error(502, "the Radio Browser directory's answer is not a list"),
    }
}

async fn search(cx: &mut ApiCtx<'_>) -> Response {
    let raw = cx.request.query_param("q").unwrap_or("");
    let Some(query) = super::spotlight::decode(raw) else {
        return Response::error(400, "the search is not valid percent-encoded UTF-8");
    };
    let words = match archive::words(&query) {
        Ok(words) => words,
        Err(message) => return Response::error(400, &message),
    };
    let page = match cx.request.query_param("page").unwrap_or("1").parse::<u32>() {
        Ok(page) if (1..=archive::MAX_PAGE).contains(&page) => page,
        _ => return Response::error(400, &format!("the page is 1 to {}", archive::MAX_PAGE)),
    };
    let body = match fetch(cx, &archive::search_url(&words, page)).await {
        Ok(body) => body,
        Err(reply) => return reply,
    };
    match archive::search_results(&body) {
        Some(mut results) => {
            results["page"] = page.into();
            results["rows"] = archive::ROWS.into();
            results["query"] = query.into();
            Response::json(200, &results)
        }
        None => Response::error(502, "the Internet Archive's answer is not search JSON"),
    }
}

/// The record the item route keeps of an item it answered: its licence and
/// every playable file of its tracks.
pub fn verified_of(item: &Value) -> Option<Verified> {
    let license = item.get("license")?.as_str()?.to_string();
    let files = item
        .get("tracks")?
        .as_array()?
        .iter()
        .filter_map(|track| track.get("files")?.as_object())
        .flat_map(|files| files.values().filter_map(Value::as_str).map(str::to_string))
        .collect();
    Some(Verified { license, files })
}

async fn item(cx: &mut ApiCtx<'_>, identifier: &str) -> Response {
    let url = format!("{}{identifier}", archive::METADATA);
    let body = match fetch(cx, &url).await {
        Ok(body) => body,
        Err(reply) => return reply,
    };
    match archive::item(identifier, &body) {
        Ok(item) => {
            // What a later save may name of this item, kept for a month: an item
            // browsed and never added does not stay. Without the record a save of
            // its songs is refused, so a failed write fails the reply.
            if let Some(record) = verified_of(&item) {
                let key = format!("{VERIFIED}{identifier}");
                let expires = cx.now_ms + VERIFIED_FOR_MS;
                let bytes = serde_json::to_vec(&record).unwrap_or_default();
                if let Err(error) = cx.storage.user().put_expiring(&key, &bytes, expires).await {
                    return Response::error(503, &format!("storage failed: {error}"));
                }
            }
            Response::json(200, &item)
        }
        Err((status, message)) => Response::error(status, &message),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_stream_is_a_web_address() {
        let stream = |url: &str| Source::Stream { url: url.into() };
        assert!(validate_source(&stream("https://radio.example/live.mp3")).is_ok());
        assert!(validate_source(&stream("http://127.0.0.1:8000/a%20b.wav")).is_ok());
        assert!(validate_source(&stream("javascript:alert(1)")).is_err());
        assert!(validate_source(&stream("https://a.example/with space")).is_err());
        let long = format!("https://a.example/{}", "x".repeat(2000));
        assert!(validate_source(&stream(&long)).is_err());
        let kept: Source =
            serde_json::from_str(r#"{"kind":"stream","url":"https://radio.example/live.mp3"}"#)
                .unwrap();
        assert_eq!(kept, stream("https://radio.example/live.mp3"));
    }

    fn song(id: &str) -> Song {
        Song {
            id: id.into(),
            title: format!("Song {id}"),
            artist: "Artist".into(),
            album: "Album".into(),
            genre: String::new(),
            composer: String::new(),
            year: Some(2019),
            track: Some(1),
            duration: 12.5,
            added: 1,
            artwork: None,
            rating: None,
            disliked: false,
            grouping: String::new(),
            comments: String::new(),
            sort_name: String::new(),
            sort_artist: String::new(),
            sort_album: String::new(),
            sort_album_artist: String::new(),
            sort_composer: String::new(),
            remember_position: false,
            start: None,
            stop: None,
            volume_adjust: None,
            eq_preset: String::new(),
            skip_shuffle: false,
            unchecked: false,
            source: Source::File {
                file: "f1".into(),
                name: "song.mp3".into(),
                media_type: "audio/mpeg".into(),
                size: 400_000,
            },
        }
    }

    fn archived(id: &str, file: &str) -> Song {
        Song {
            source: Source::Archive {
                item: "DWK255".into(),
                files: BTreeMap::from([("mp3".into(), file.into())]),
                license: "http://creativecommons.org/licenses/by-nc-nd/4.0/".into(),
            },
            ..song(id)
        }
    }

    fn library() -> Library {
        Library {
            songs: vec![song("a"), song("b")],
            playlists: vec![Playlist {
                id: "p".into(),
                name: "Road Trip".into(),
                songs: vec!["b".into(), "a".into()],
                folder: None,
                smart: None,
                private: false,
            }],
            loved: vec!["a".into()],
            folders: Vec::new(),
        }
    }

    #[test]
    fn a_rating_is_one_to_five_stars() {
        let mut held = song("a");
        held.rating = Some(5);
        assert_eq!(validate_song(&held), Ok(()));
        held.rating = Some(6);
        assert!(validate_song(&held).is_err());
        held.rating = Some(0);
        assert!(validate_song(&held).is_err());
    }

    #[test]
    fn smart_playlists_keep_rules_and_no_songs() {
        let rule = SmartRule {
            field: "artist".into(),
            op: "contains".into(),
            value: "Blue".into(),
        };
        let smart = SmartPlaylist {
            all: true,
            rules: vec![rule.clone()],
            limit: None,
        };
        let mut held = library();
        held.playlists[0].songs.clear();
        held.playlists[0].smart = Some(smart.clone());
        assert_eq!(validate_library(&held), Ok(()));

        let mut listing = library();
        listing.playlists[0].smart = Some(smart.clone());
        assert!(validate_library(&listing).is_err());

        let mut none = held.clone();
        none.playlists[0].smart = Some(SmartPlaylist {
            rules: Vec::new(),
            ..smart.clone()
        });
        assert!(validate_library(&none).is_err());

        let mut unknown = held.clone();
        unknown.playlists[0].smart = Some(SmartPlaylist {
            rules: vec![SmartRule {
                field: "path".into(),
                ..rule
            }],
            ..smart.clone()
        });
        assert!(validate_library(&unknown).is_err());

        let mut zero = held.clone();
        zero.playlists[0].smart = Some(SmartPlaylist {
            limit: Some(0),
            ..smart
        });
        assert!(validate_library(&zero).is_err());
    }

    #[test]
    fn folders_nest_and_refuse_a_loop_or_an_unknown_folder() {
        let folder = |id: &str, parent: Option<&str>| Folder {
            id: id.into(),
            name: id.into(),
            parent: parent.map(Into::into),
        };
        let mut held = library();
        held.folders = vec![folder("f", None), folder("g", Some("f"))];
        held.playlists[0].folder = Some("g".into());
        assert_eq!(validate_library(&held), Ok(()));

        let mut unknown = held.clone();
        unknown.playlists[0].folder = Some("gone".into());
        assert!(validate_library(&unknown).is_err());

        let mut orphan = held.clone();
        orphan.folders[0].parent = Some("gone".into());
        assert!(validate_library(&orphan).is_err());

        let mut looped = held.clone();
        looped.folders[0].parent = Some("g".into());
        assert!(validate_library(&looped).is_err());

        let saved: Library = serde_json::from_str(
            r#"{"songs":[],"playlists":[{"id":"p","name":"Old","songs":[]}],"loved":[]}"#,
        )
        .unwrap();
        assert_eq!(saved.folders, Vec::new());
        assert_eq!(saved.playlists[0].folder, None);
    }

    fn playback() -> Playback {
        Playback {
            queue: vec!["a".into(), "b".into()],
            unshuffled: Vec::new(),
            index: 1,
            position: 3.25,
            shuffle: false,
            repeat: Repeat::All,
            volume: 80,
            recent: vec!["a".into()],
            plays: BTreeMap::from([("a".into(), 2)]),
            guests: Vec::new(),
            order: Vec::new(),
            epoch: None,
            shuffle_by: None,
            bookmarks: BTreeMap::new(),
        }
    }

    #[test]
    fn a_shuffled_order_must_match_both_queues_entry_by_entry() {
        let mut shuffled = playback();
        shuffled.shuffle = true;
        shuffled.queue = vec!["a".into(), "b".into(), "c".into(), "a".into()];
        shuffled.unshuffled = vec!["a".into(), "b".into(), "a".into(), "c".into()];
        // The first entry played is the second "a" (place 2).
        shuffled.order = vec![2, 1, 3, 0];
        assert!(validate_playback(&shuffled).is_ok());
        let mut swapped = shuffled.clone();
        swapped.order = vec![2, 3, 1, 0];
        assert!(
            validate_playback(&swapped).is_err(),
            "places that name other songs"
        );
        let mut repeated = shuffled.clone();
        repeated.order = vec![2, 1, 3, 2];
        assert!(validate_playback(&repeated).is_err(), "a place named twice");
        let mut unshuffled = shuffled.clone();
        unshuffled.shuffle = false;
        unshuffled.unshuffled.clear();
        assert!(
            validate_playback(&unshuffled).is_err(),
            "an order without shuffle"
        );
    }

    #[test]
    fn a_library_and_its_covers_let_go_fit_one_store_value() {
        // A digest as stored in the list of covers let go: 64 hex characters,
        // quoted, with a comma.
        let let_go = MAX_ARTWORKS * 67;
        assert!(MAX_LIBRARY_BYTES + let_go + 200 < 200_000);
        assert!(MAX_PLAYBACK_BYTES + 100 < 200_000);
    }

    #[test]
    fn a_library_round_trips_in_the_browsers_field_names() {
        let text = r#"{"songs":[{"id":"ia-1","title":"NSIME","artist":"Subjectjazz",
            "album":"Saturne (EP)","genre":"Jazz","year":2014,"track":1,"duration":121,"added":5,
            "artwork":null,"source":{"kind":"archive","item":"DWK255",
            "files":{"mp3":"Subjectjazz_-_01_-_NSIME.mp3"},
            "license":"http://creativecommons.org/licenses/by-nc-nd/4.0/"}},
            {"id":"up-1","title":"Mine","artist":"","album":"","duration":3,"added":6,
            "source":{"kind":"file","file":"f-9","name":"mine.wav","type":"audio/wav","size":600000}}],
            "playlists":[{"id":"p1","name":"Mix","songs":["up-1","ia-1"]}],"loved":["ia-1"]}"#;
        let library: Library = serde_json::from_str(text).unwrap();
        assert!(validate_library(&library).is_ok());
        let again = serde_json::to_string(&library).unwrap();
        assert!(again.contains(r#""kind":"file""#) && again.contains(r#""type":"audio/wav""#));
        assert_eq!(serde_json::from_str::<Library>(&again).unwrap(), library);
        let playback = serde_json::to_string(&playback()).unwrap();
        assert!(playback.contains(r#""repeat":"all""#), "{playback}");
        let without_guests = playback.replace(r#","guests":[]"#, "");
        assert!(
            serde_json::from_str::<Playback>(&without_guests).is_ok(),
            "a playback saved before guests were kept still reads"
        );
    }

    #[test]
    fn libraries_that_do_not_hold_together_are_refused() {
        assert!(validate_library(&library()).is_ok());
        let mut twice = library();
        twice.songs.push(song("a"));
        assert!(validate_library(&twice).is_err(), "a song id twice");
        let mut stray = library();
        stray.loved.push("zzz".into());
        assert!(
            validate_library(&stray).is_err(),
            "Loved names a song not in it"
        );
        let mut doubled = library();
        doubled.playlists[0].songs.push("a".into());
        assert!(
            validate_library(&doubled).is_err(),
            "a playlist lists a song twice"
        );
        let mut unnamed = library();
        unnamed.playlists[0].name = "  ".into();
        assert!(
            validate_library(&unnamed).is_err(),
            "a playlist needs a name"
        );
        let mut long = library();
        long.songs[0].title = "x".repeat(MAX_TEXT + 1);
        assert!(validate_library(&long).is_err());
        let mut endless = library();
        endless.songs[0].duration = f64::INFINITY;
        assert!(validate_library(&endless).is_err());
        let mut closed = library();
        closed.songs[0].source = Source::Archive {
            item: "x".into(),
            files: BTreeMap::from([("mp3".into(), "a.mp3".into())]),
            license: "https://example.com/all-rights-reserved".into(),
        };
        assert!(validate_library(&closed).is_err(), "only open licences");
        let mut climbing = library();
        climbing.songs[0].source = Source::Archive {
            item: "x".into(),
            files: BTreeMap::from([("mp3".into(), "../a.mp3".into())]),
            license: "https://creativecommons.org/licenses/by/4.0/".into(),
        };
        assert!(
            validate_library(&climbing).is_err(),
            "no path out of the item"
        );
        let mut image = library();
        image.songs[0].source = Source::File {
            file: "f1".into(),
            name: "x.png".into(),
            media_type: "image/png".into(),
            size: 1,
        };
        assert!(validate_library(&image).is_err(), "only audio files");
        let mut many = library();
        many.songs = (0..=MAX_SONGS).map(|n| song(&format!("s{n}"))).collect();
        many.playlists.clear();
        many.loved.clear();
        assert!(validate_library(&many).is_err());
    }

    #[test]
    fn playback_is_checked_for_shape_not_against_the_library() {
        assert!(validate_playback(&playback()).is_ok());
        let mut past = playback();
        past.index = 3;
        assert!(validate_playback(&past).is_err());
        let mut loud = playback();
        loud.volume = 101;
        assert!(validate_playback(&loud).is_err());
        let mut order = playback();
        order.unshuffled = vec!["b".into(), "a".into()];
        assert!(
            validate_playback(&order).is_err(),
            "unshuffled order without shuffle"
        );
        order.shuffle = true;
        assert!(validate_playback(&order).is_ok());
        let mut recent = playback();
        recent.recent.push("a".into());
        assert!(
            validate_playback(&recent).is_err(),
            "Recently Played once each"
        );
        let mut negative = playback();
        negative.position = -1.0;
        assert!(validate_playback(&negative).is_err());
        let mut guests = playback();
        guests.guests = vec![archived("g", "g.mp3")];
        assert!(validate_playback(&guests).is_ok());
        guests.guests.push(song("up"));
        assert!(
            validate_playback(&guests).is_err(),
            "only Archive songs as guests"
        );
        let mut named = playback();
        named.epoch = Some("pb-0f8c2a64-5d3e-4e1b-9a77-2c1d0b9e6f31".into());
        assert!(validate_playback(&named).is_ok());
        named.epoch = Some("not plain/".into());
        assert!(validate_playback(&named).is_err(), "an epoch is a plain id");
        named.epoch = Some("e".repeat(65));
        assert!(validate_playback(&named).is_err(), "an epoch is short");
    }

    #[test]
    fn only_new_archive_songs_are_checked_and_only_against_what_the_item_holds() {
        let old = vec![archived("a", "a.mp3"), song("u")];
        let new = vec![archived("a", "a.mp3"), archived("b", "b.mp3"), song("v")];
        let fresh: Vec<&str> = new_archive_songs(&new, &old)
            .iter()
            .map(|song| song.id.as_str())
            .collect();
        assert_eq!(fresh, ["b"]);
        let record = Verified {
            license: "http://creativecommons.org/licenses/by-nc-nd/4.0/".into(),
            files: vec!["a.mp3".into(), "b.mp3".into()],
        };
        assert!(matches_verified(&archived("b", "b.mp3").source, &record));
        assert!(
            !matches_verified(&archived("c", "c.mp3").source, &record),
            "a file the item does not hold"
        );
        let mut other = archived("b", "b.mp3");
        if let Source::Archive { license, .. } = &mut other.source {
            *license = "https://creativecommons.org/publicdomain/zero/1.0/".into();
        }
        assert!(!matches_verified(&other.source, &record), "another licence");
    }

    #[test]
    fn a_save_lets_go_only_of_the_covers_it_no_longer_names() {
        let digest = |c: char| c.to_string().repeat(64);
        let mut before = library();
        before.songs[0].artwork = Some(digest('a'));
        before.songs[1].artwork = Some(digest('b'));
        let mut after = before.clone();
        after.songs.remove(1);
        assert_eq!(covers_let_go(&before, Some(&after)), [digest('b')]);
        assert_eq!(covers_let_go(&before, None).len(), 2);
        assert!(covers_let_go(&after, Some(&before)).is_empty());
    }

    #[test]
    fn the_item_route_records_the_licence_and_every_playable_file() {
        let item = serde_json::json!({ "license": "https://creativecommons.org/licenses/by/4.0/",
            "tracks": [{ "files": { "mp3": "1.mp3", "ogg": "1.ogg" } }, { "files": { "flac": "2.flac" } }] });
        let record = verified_of(&item).unwrap();
        assert_eq!(record.files, ["1.mp3", "1.ogg", "2.flac"]);
        assert_eq!(
            record.license,
            "https://creativecommons.org/licenses/by/4.0/"
        );
    }

    #[test]
    fn preferences_are_the_three_working_settings_in_the_browsers_field_names() {
        let text = r#"{"listSize":"small","notifications":false,"miniPlayerOnTop":true}"#;
        let kept: Preferences = serde_json::from_str(text).unwrap();
        assert_eq!(kept.list_size, ListSize::Small);
        assert!(kept.mini_player_on_top && !kept.notifications);
        assert_eq!(serde_json::to_string(&kept).unwrap(), text);
        for refused in [
            r#"{"listSize":"small","notifications":false,"miniPlayerOnTop":true,"showStore":true}"#,
            r#"{"listSize":"tiny","notifications":false,"miniPlayerOnTop":true}"#,
            r#"{"listSize":"small","notifications":false}"#,
        ] {
            assert!(
                serde_json::from_str::<Preferences>(refused).is_err(),
                "{refused}"
            );
        }
        let more = r#"{"listSize":"small","notifications":false,"miniPlayerOnTop":true,"starRatings":false,"songCheckboxes":true}"#;
        let kept: Preferences = serde_json::from_str(more).unwrap();
        assert_eq!(kept.star_ratings, Some(false));
        assert_eq!(kept.song_checkboxes, Some(true));
        assert_eq!(serde_json::to_string(&kept).unwrap(), more);
        let sound = r#"{"listSize":"small","notifications":false,"miniPlayerOnTop":true,"crossfade":true,"crossfadeSeconds":6,"soundEnhancer":true,"soundEnhancerLevel":50,"soundCheck":true}"#;
        let kept: Preferences = serde_json::from_str(sound).unwrap();
        assert_eq!(kept.crossfade_seconds, Some(6));
        assert_eq!(kept.invalid(), None);
        assert_eq!(serde_json::to_string(&kept).unwrap(), sound);
        let long = Preferences {
            crossfade_seconds: Some(13),
            ..kept.clone()
        };
        assert_eq!(long.invalid(), Some("a crossfade lasts 1 to 12 seconds"));
        let loud = Preferences {
            sound_enhancer_level: Some(101),
            ..kept
        };
        assert_eq!(loud.invalid(), Some("Sound Enhancer goes from 0 to 100"));
    }

    #[test]
    fn song_info_fields_are_kept_under_the_browsers_names_and_checked() {
        let mut held = song("a");
        held.sort_name = "Bell, The".into();
        held.start = Some(12.5);
        held.volume_adjust = Some(-40);
        held.skip_shuffle = true;
        let text = serde_json::to_string(&held).unwrap();
        assert!(text.contains(r#""sortName":"Bell, The""#), "{text}");
        assert!(text.contains(r#""volumeAdjust":-40"#), "{text}");
        assert!(text.contains(r#""skipShuffle":true"#), "{text}");
        assert_eq!(serde_json::from_str::<Song>(&text).unwrap(), held);
        assert!(validate_song(&held).is_ok());
        held.volume_adjust = Some(101);
        assert!(validate_song(&held).is_err());
        held.volume_adjust = None;
        held.stop = Some(-1.0);
        assert!(validate_song(&held).is_err());
    }

    #[test]
    fn lyrics_break_lines_and_hold_nothing_else() {
        let mut lyrics = Lyrics::new();
        lyrics.insert("up-1".into(), "first line\nsecond line".into());
        assert!(validate_lyrics(&lyrics).is_ok());
        lyrics.insert("up-2".into(), "bell\u{7}".into());
        assert!(validate_lyrics(&lyrics).is_err());
        lyrics.remove("up-2");
        lyrics.insert("up-3".into(), "x".repeat(MAX_LYRICS_CHARS + 1));
        assert!(validate_lyrics(&lyrics).is_err());
        lyrics.remove("up-3");
        lyrics.insert("../x".into(), String::new());
        assert!(validate_lyrics(&lyrics).is_err());
    }

    #[test]
    fn covers_are_jpeg_or_png_named_by_their_digest() {
        assert_eq!(image_type(&[0xFF, 0xD8, 0xFF, 0xE0]), Some("image/jpeg"));
        assert_eq!(image_type(b"\x89PNG\r\n\x1a\nrest"), Some("image/png"));
        assert_eq!(image_type(b"GIF89a"), None);
        assert!(valid_digest(&"a1".repeat(32)));
        assert!(!valid_digest(&"A1".repeat(32)));
        assert!(!valid_digest("abc"));
    }
}

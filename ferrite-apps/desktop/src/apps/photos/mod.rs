//! Photos' server half: the person's photo library.
//!
//! The original of every photo is a file of the person's drive (the `files`
//! module, `src/apps/files`): the page uploads it there in pieces, under the
//! gateway's 256 KiB request limit, and reads it back from there. This module
//! keeps what makes those files a library: one record per photo (the drive's
//! file id, its name, size, pixel size, the day it was taken, its title,
//! caption, keywords, place and camera settings, favourite, hidden, Recently
//! Deleted, the edit), a small JPEG thumbnail per photo and per edit, and how
//! the person organised them (albums, folders, smart albums, the keyword list,
//! slideshows). Everything is kept in the person's own space
//! ([`crate::module::Storage::user`]); no image is processed here.
//!
//! Editing is non-destructive. An edit is a recipe ([`Edit`]): quarter turns,
//! a flip, straightening, a crop, light and colour adjustments and a filter.
//! The page renders it from the original in a canvas whenever it shows or
//! exports the photo, and sends a thumbnail of the result beside the recipe;
//! reverting forgets the recipe and that thumbnail, and the original was
//! never changed.
//!
//! * `GET /api/photos/library[?from=<shard>]`: `{"photos": [...], "next":
//!   <shard or null>, "albums", "folders", "smart_albums", "keywords",
//!   "projects", "settings", "purge": [file ids], "limits", "session"}`.
//!   Photos are oldest taken first within a reply; a library larger than one
//!   reply says where the next begins. Photos that have been in Recently
//!   Deleted for [`RECENTLY_DELETED_MS`] are deleted for good first. `purge`
//!   lists the drive files of every photo deleted for good whose removal from
//!   the drive the page has not yet confirmed.
//! * `POST /api/photos/purged` `{"files": [ids]}`: the page removed those
//!   originals from the drive; they leave `purge`.
//! * `POST /api/photos/photos` with a [`NewPhoto`] (the thumbnail as base64):
//!   adds a photo, answering 201 with it. The id is the page's own, so a
//!   resend answers 200 with the photo already kept and changes nothing.
//! * `POST /api/photos/photos/<id>` with a [`Change`]: favourite, hide, move to
//!   or recover from Recently Deleted, rename, title, caption, keywords, date,
//!   place, edit (with the edited thumbnail) or revert (`"edit": null`).
//!   Answers the photo.
//! * `DELETE /api/photos/photos/<id>`: deletes a photo for good (Delete
//!   Immediately), answering `{"deleted", "file"}`; `file` is in `purge`
//!   until the page confirms it removed it.
//! * `GET /api/photos/thumbs?ids=<id>,<id>`: up to [`THUMBS_PER_REQUEST`]
//!   thumbnails as `{"thumbs": {id: base64url}}`, the edited one for an edited
//!   photo.
//! * `POST /api/photos/albums` `{"id", "name", "folder"?}` makes an album;
//!   `POST /api/photos/albums/<id>` with an [`AlbumChange`] renames it, sets
//!   its order, key photo or folder, moves it in the sidebar, or changes its
//!   photos; with `from`, the photos added leave that other album in the same
//!   write (Move to). `DELETE /api/photos/albums/<id>` deletes it (not its
//!   photos).
//! * `POST /api/photos/folders` `{"id", "name", "parent"?}`,
//!   `POST /api/photos/folders/<id>` `{"name"?, "parent"?, "before"?}` and
//!   `DELETE /api/photos/folders/<id>` (with what it holds, not the photos).
//! * `PUT /api/photos/smart-albums/<id>` with a [`SmartAlbum`] body makes or
//!   replaces a smart album, `DELETE` removes it; the page evaluates its rules.
//! * `PUT /api/photos/keywords` `{"keywords": [{"name", "key"?}]}` sets the
//!   Keyword Manager's list.
//! * `PUT /api/photos/projects/<id>` and `DELETE`: a saved slideshow.
//! * `PUT /api/photos/settings` with any object of at most [`MAX_SETTINGS_BYTES`]:
//!   how the window was left (its source, view, zoom, sidebar). Answered back
//!   by `GET /library` with its `settings_rev`, which the server owns
//!   (`document.rs`). A numeric `base` in the object is left out of what is kept:
//!   a save naming a revision that is no longer the stored one is refused with
//!   409, so an older save can't land over a newer one. A save with no `base`
//!   (the page's last, as it leaves) always stores, and moves the revision on.
//! * `POST /api/photos/memories` `{"id", "favorite"?, "deleted"?, "album"?}`:
//!   marks one memory, by the id the page gave it. Deleting takes it out of the
//!   favourites and of the albums shown as memories; showing an album brings its
//!   memory back.
//!   Each answers `{"albums", "folders", "smart_albums", "keywords", "projects"}`.
//! * `POST /api/photos/faces` `{"scans": [{"id", "edited_ms", "faces": [box]}]}`: keeps what
//!   the page found in a photo's thumbnail, the first answer for a photo standing; answers
//!   `{"kept": [{"id", "faces"}]}`. A [`Change`]'s `face` names a face or says it is none.
//! * `POST /api/photos/scenes` `{"scans": [{"id", "scenes": [word]}]}`: keeps what the page read
//!   in a photo's thumbnail, among [`SCENES`]; answers `{"kept": [id]}`.
//!
//! ## How it is stored
//!
//! A photo's record lives in one of [`SHARDS`] documents, `shard/<nn>`, chosen
//! by a hash of its id. Each is read with its version, changed, and written
//! only if the version is unchanged, trying again from the new document
//! otherwise ([`mutate_shard`]). A shard also holds the originals of its photos
//! deleted for good until the page confirms their removal, so a record leaving
//! and its original being handed over are one write, exactly once.
//!
//! How the person organised the photos is the one document `library`
//! ([`Index`]), changed the same way ([`mutate_index`]). A move between albums
//! is therefore still one write. An album may name a photo deleted for good if
//! a request stopped between the two documents, or an add to an album crossed a delete. No read
//! writes to repair that: `GET /library` leaves such a reference out of its reply, and a stored one
//! stays harmless, because a photo's id is never used twice: the shard that held a photo keeps its
//! id in `deleted`, in the one write that deletes it, and refuses it from then on.
//!
//! One original belongs to one photo. Before a photo is written, the key `file/<drive id>` claims
//! the file for it, created only if absent, so of two imports naming one file the second is
//! refused. A claim outlasts its photo: it stays while the file waits in a `purge` list, and when
//! the page confirms the file gone it becomes a marker ([`CLAIM_GONE`]) for good, which refuses any
//! import still under way. The `purge` list
//! given to the page, and a confirmation of it, leave out any file a photo names: a library from
//! before the shards may name one original from several photos, and its file is listed once the
//! last of them has gone. A claim is never given up: a request that stops after its claim, or is
//! refused, leaves one only that photo's retry can use; the page imports by uploading a new file,
//! so nothing waits on it.
//!
//! A library from before the shards keeps every record inside `library`. The
//! first request after the upgrade moves them ([`upgrade`]): each shard takes
//! all its records in one write and marks itself `migrated`, so a second
//! request doing the same, or a photo deleted meanwhile, changes nothing; only
//! then are they dropped from `library`. The size bound is for what a person adds, not for this
//! move: a shard holds a part of a document that was within the bound, and adjustments left at 0
//! are not written, so the records take no more than they did.
//!
//! Thumbnails are not in the documents: each is written, before the change
//! that names it, under a key of its own that no other write shares (a random
//! token), and the shard names it. A change that commits deletes the image keys
//! it stopped naming; a request whose change did not commit (or did not name
//! its key) deletes its own. So a record and its thumbnail always come from the
//! same request.

use std::collections::{BTreeMap, BTreeSet};
use std::io;

use ferrite_app::crypto::{hex, hmac_sha256, Ed25519SigningKey};
use ferrite_app::{serde, serde_json};

use super::document;
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture, Space};

pub const MODULE: AppModule = AppModule {
    name: "photos",
    title: "Photos",
    handle,
};

/// The documents the records are spread over. An even spread of 5,000 photos
/// gives a shard about 78 records, each well under [`MAX_LIBRARY_BYTES`] / 78.
pub const SHARDS: u32 = 64;
/// The most records one shard takes: far above what an even spread of 5,000
/// photos gives it. Checked in the write that adds a photo, this is the bound
/// a library has.
pub const MAX_SHARD_PHOTOS: usize = 160;
/// The most photos a library could keep, were its shards all full.
pub const MAX_PHOTOS: usize = SHARDS as usize * MAX_SHARD_PHOTOS;
/// The most bytes a document takes as JSON: below the store's 200 KB value
/// limit. A change that would make it larger answers 413 (one that makes it
/// smaller, such as a deletion, always goes through).
pub const MAX_LIBRARY_BYTES: usize = 190_000;
/// A `GET /library` reply stops at about this many bytes of records: the
/// platform's reply limit is about 4 MiB.
pub const REPLY_BYTES: usize = 2 * 1024 * 1024;
/// The largest thumbnail, in bytes.
pub const MAX_THUMB_BYTES: usize = 96_000;
/// The most albums.
pub const MAX_ALBUMS: usize = 100;
/// The most folders.
pub const MAX_FOLDERS: usize = 100;
/// The most smart albums.
pub const MAX_SMART_ALBUMS: usize = 100;
/// The most rules of a smart album.
pub const MAX_RULES: usize = 16;
/// The longest value of a rule, in characters.
pub const MAX_RULE_VALUE_CHARS: usize = 200;
/// The most keywords one photo has, and the longest, in characters.
pub const MAX_PHOTO_KEYWORDS: usize = 64;
pub const MAX_KEYWORD_CHARS: usize = 64;
/// The most people named on one photo.
pub const MAX_PHOTO_PEOPLE: usize = 32;
/// The most faces kept of one photo.
pub const MAX_PHOTO_FACES: usize = 32;
/// The most photos one request keeps the faces of.
const MAX_FACE_SCANS: usize = 16;
/// The most points of an edit's curve, and the most retouched spots.
pub const MAX_CURVE_POINTS: usize = 8;
pub const MAX_EDIT_SPOTS: usize = 32;
/// The most lines drawn with Markup on a photo, and the most points of one: all of an edit's
/// marks stay small next to a shard's [`MAX_LIBRARY_BYTES`].
pub const MAX_EDIT_STROKES: usize = 12;
pub const MAX_STROKE_POINTS: usize = 32;
/// The most keywords of the Keyword Manager's list.
pub const MAX_KEYWORDS: usize = 500;
/// The longest caption, in characters.
pub const MAX_CAPTION_CHARS: usize = 2_000;
/// The most saved slideshows, and the most photos one names.
pub const MAX_PROJECTS: usize = 50;
/// The window's own settings, in bytes.
pub const MAX_SETTINGS_BYTES: usize = 8_000;
/// The most memories in each of the lists of what the person chose about them.
pub const MAX_MEMORY_MARKS: usize = 1_000;
/// The longest memory id: a prefix and a photo or album id.
const MAX_MEMORY_ID_BYTES: usize = 80;
/// The longest photo name, in characters.
pub const MAX_NAME_CHARS: usize = 200;
/// The longest album name, in characters.
pub const MAX_ALBUM_NAME_CHARS: usize = 100;
/// The longest photo or album id, in bytes (a UUID is 36).
pub const MAX_ID_BYTES: usize = 64;
/// The largest original a record may name, in bytes; the drive keeps it.
pub const MAX_ORIGINAL_BYTES: u64 = 64 * 1024 * 1024;
/// The longest side of a photo, in pixels.
pub const MAX_SIDE: u32 = 30_000;
/// The most thumbnails one request reads.
pub const THUMBS_PER_REQUEST: usize = 48;
/// The most photos one album change names, or originals one confirmation.
pub const MAX_ALBUM_CHANGE: usize = 500;
/// The most hashes one request keeps.
const MAX_HASHES: usize = 48;
/// The hex digits of a picture's hash: 64 bits and a colour of 24.
const HASH_DIGITS: usize = 22;
/// How long a photo stays in Recently Deleted: 30 days.
pub const RECENTLY_DELETED_MS: u64 = 30 * 24 * 60 * 60 * 1000;
/// The picture and movie types a browser can draw, and so the ones a library takes.
pub const MIME_TYPES: &[&str] = &[
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "video/mp4",
    "video/webm",
    "video/quicktime",
];
/// Where a photo came from: imported, or taken in Photo Booth.
pub const SOURCES: &[&str] = &["import", "photo-booth"];
/// The filters of the Filters pane, by id (`demos/photos/photos-edit.ts`).
pub const FILTERS: &[&str] = &[
    "none",
    "vivid",
    "vivid-warm",
    "vivid-cool",
    "dramatic",
    "dramatic-warm",
    "dramatic-cool",
    "mono",
    "silvertone",
    "noir",
];
/// The orders an album lists its photos in: as they were added (`custom`),
/// oldest or newest taken first, or by title.
pub const ALBUM_SORTS: &[&str] = &["custom", "oldest", "newest", "title"];
/// What a smart album's rule can ask about (`demos/photos/photos-served-data.ts`).
pub const RULE_FIELDS: &[&str] = &[
    "album", "caption", "camera", "date", "edited", "favorite", "filename", "keyword", "kind",
    "location", "title", "text",
];
/// How a smart album's rule compares.
pub const RULE_OPS: &[&str] = &[
    "is", "is-not", "includes", "excludes", "before", "after", "in-last",
];

/// How many times a change is tried against concurrent ones.
const ATTEMPTS: usize = 16;
/// The key of the document of how the photos are organised.
const LIBRARY: &str = "library";
/// The key of the window's settings as a revisioned document.
const WINDOW: &str = "window";
/// The key they had before they had a revision, read until the next save.
const SETTINGS: &str = "settings";
/// Where thumbnails are kept, one key each.
const THUMB: &str = "thumb/";
/// Where the claims of originals are kept, one key each.
const CLAIM: &str = "file/";
/// A claim whose file is gone from the drive. A photo id cannot hold a `/`.
const CLAIM_GONE: &[u8] = b"/gone";

/// A crop, as fractions of the turned and straightened picture.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Crop {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// The light and colour sliders, each from -1 to 1, 0 changing nothing.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Default)]
#[serde(crate = "ferrite_app::serde", default, deny_unknown_fields)]
pub struct Adjust {
    pub exposure: f64,
    pub brightness: f64,
    pub contrast: f64,
    pub highlights: f64,
    pub shadows: f64,
    pub saturation: f64,
    pub warmth: f64,
    pub tint: f64,
    /// Added for the editor's second pass: the rest of the real app's sliders. Not written at 0,
    /// so a record kept before they existed takes no more room than it did.
    #[serde(skip_serializing_if = "is_zero")]
    pub brilliance: f64,
    #[serde(skip_serializing_if = "is_zero")]
    pub black_point: f64,
    #[serde(skip_serializing_if = "is_zero")]
    pub vibrance: f64,
    #[serde(skip_serializing_if = "is_zero")]
    pub cast: f64,
    #[serde(skip_serializing_if = "is_zero")]
    pub definition: f64,
    #[serde(skip_serializing_if = "is_zero")]
    pub sharpen: f64,
    #[serde(skip_serializing_if = "is_zero")]
    pub noise: f64,
    #[serde(skip_serializing_if = "is_zero")]
    pub vignette: f64,
    /// Black & White: 0 keeps colour, 1 is wholly grey.
    #[serde(skip_serializing_if = "is_zero")]
    pub mono: f64,
}

fn is_zero(value: &f64) -> bool {
    *value == 0.0
}

impl Adjust {
    fn values(&self) -> [f64; 17] {
        [
            self.exposure,
            self.brightness,
            self.contrast,
            self.highlights,
            self.shadows,
            self.saturation,
            self.warmth,
            self.tint,
            self.brilliance,
            self.black_point,
            self.vibrance,
            self.cast,
            self.definition,
            self.sharpen,
            self.noise,
            self.vignette,
            self.mono,
        ]
    }
}

/// An edit: the recipe the page renders from the original.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", default, deny_unknown_fields)]
pub struct Edit {
    /// Quarter turns to the left, 0 to 3.
    pub rotate: u8,
    /// Mirrored left to right.
    pub flip: bool,
    /// Degrees to straighten by, -45 to 45.
    pub straighten: f64,
    /// Perspective, -1 to 1: above 0 narrows the top. Not written at 0.
    #[serde(skip_serializing_if = "is_zero")]
    pub vertical: f64,
    /// Perspective, -1 to 1: above 0 narrows the right. Not written at 0.
    #[serde(skip_serializing_if = "is_zero")]
    pub horizontal: f64,
    pub crop: Option<Crop>,
    pub adjust: Adjust,
    /// One of [`FILTERS`].
    pub filter: String,
    /// Levels: what becomes black and white, and the midtones' gamma.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub levels: Option<Levels>,
    /// Curves: points `[in, out]` from 0 to 1, by rising `in`.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub curve: Vec<[f64; 2]>,
    /// Levels and Curves of one colour alone, by `red`, `green` and `blue`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channels: Option<Channels>,
    /// Selective Color: shifts to a range of hues, by the range's name.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub selective: Option<Selective>,
    /// Retouch and Red-eye: circles on the original, before any turn.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub spots: Vec<Spot>,
    /// Markup: lines drawn on the original, before any turn.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub marks: Vec<Stroke>,
    /// The drive file an outside editor saved: the recipe is drawn on it, not on the original.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub external: Option<String>,
}

/// The ranges of hue with a Selective Color shift of their own.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Default)]
#[serde(crate = "ferrite_app::serde", default, deny_unknown_fields)]
pub struct Selective {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub red: Option<BandShift>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub yellow: Option<BandShift>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub green: Option<BandShift>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cyan: Option<BandShift>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub blue: Option<BandShift>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub magenta: Option<BandShift>,
}

/// What Selective Color does to one range of hues, each from -1 to 1.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Default)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct BandShift {
    pub hue: f64,
    pub saturation: f64,
    pub luminance: f64,
}

/// The colours with Levels or a Curve of their own.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Default)]
#[serde(crate = "ferrite_app::serde", default, deny_unknown_fields)]
pub struct Channels {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub red: Option<ChannelTone>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub green: Option<ChannelTone>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub blue: Option<ChannelTone>,
}

/// One colour's own Levels and Curve.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Default)]
#[serde(crate = "ferrite_app::serde", default, deny_unknown_fields)]
pub struct ChannelTone {
    pub levels: Option<Levels>,
    pub curve: Vec<[f64; 2]>,
}

fn check_levels(levels: &Levels) -> Result<(), String> {
    let fits = [levels.black, levels.gamma, levels.white]
        .iter()
        .all(|v| v.is_finite())
        && levels.black >= 0.0
        && levels.white <= 1.0
        && levels.black < levels.white
        && (0.1..=10.0).contains(&levels.gamma);
    if fits {
        Ok(())
    } else {
        Err("levels are black below white, 0 to 1, and a gamma of 0.1 to 10".into())
    }
}

fn check_curve(curve: &[[f64; 2]]) -> Result<(), String> {
    let unit = |v: f64| v.is_finite() && (0.0..=1.0).contains(&v);
    if curve.len() > MAX_CURVE_POINTS
        || !curve.iter().all(|p| unit(p[0]) && unit(p[1]))
        || !curve.windows(2).all(|pair| pair[0][0] < pair[1][0])
    {
        return Err(format!(
            "a curve is at most {MAX_CURVE_POINTS} points from 0 to 1, by rising input"
        ));
    }
    Ok(())
}

/// An edit's Levels.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Levels {
    pub black: f64,
    pub gamma: f64,
    pub white: f64,
}

/// A retouched circle, as fractions of the original: `x` of its width, `y` of its height and
/// `radius` of its longer side.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Spot {
    pub x: f64,
    pub y: f64,
    pub radius: f64,
    /// `"retouch"` or `"red-eye"`.
    pub kind: String,
}

/// A line drawn with Markup: `points` are `[x, y]` as fractions of the original's width and height,
/// `width` a fraction of its longer side, `color` as `#rrggbb`.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Stroke {
    pub color: String,
    pub width: f64,
    pub points: Vec<[f64; 2]>,
}

impl Default for Edit {
    fn default() -> Self {
        Edit {
            rotate: 0,
            flip: false,
            straighten: 0.0,
            vertical: 0.0,
            horizontal: 0.0,
            crop: None,
            adjust: Adjust::default(),
            filter: "none".into(),
            levels: None,
            curve: Vec::new(),
            channels: None,
            selective: None,
            spots: Vec::new(),
            marks: Vec::new(),
            external: None,
        }
    }
}

impl Edit {
    /// Why the edit cannot be kept, if it cannot.
    pub fn check(&self) -> Result<(), String> {
        if self.rotate > 3 {
            return Err("rotate is a number of quarter turns, 0 to 3".into());
        }
        if !self.straighten.is_finite() || self.straighten.abs() > 45.0 {
            return Err("straighten is -45 to 45 degrees".into());
        }
        if ![self.vertical, self.horizontal]
            .iter()
            .all(|v| v.is_finite() && v.abs() <= 1.0)
        {
            return Err("vertical and horizontal perspective are -1 to 1".into());
        }
        if !self
            .adjust
            .values()
            .iter()
            .all(|v| v.is_finite() && v.abs() <= 1.0)
        {
            return Err("every adjustment is -1 to 1".into());
        }
        if !FILTERS.contains(&self.filter.as_str()) {
            return Err(format!("{:?} is not a filter of Photos", self.filter));
        }
        if let Some(levels) = &self.levels {
            check_levels(levels)?;
        }
        let unit = |v: f64| v.is_finite() && (0.0..=1.0).contains(&v);
        check_curve(&self.curve)?;
        if let Some(channels) = &self.channels {
            for tone in [&channels.red, &channels.green, &channels.blue]
                .into_iter()
                .flatten()
            {
                if let Some(levels) = &tone.levels {
                    check_levels(levels)?;
                }
                check_curve(&tone.curve)?;
            }
        }
        if let Some(file) = &self.external {
            if !valid_id(file) {
                return Err("an edit's file is named by its id".into());
            }
        }
        if let Some(selective) = &self.selective {
            for band in [
                &selective.red,
                &selective.yellow,
                &selective.green,
                &selective.cyan,
                &selective.blue,
                &selective.magenta,
            ]
            .into_iter()
            .flatten()
            {
                for value in [band.hue, band.saturation, band.luminance] {
                    if !value.is_finite() || !(-1.0..=1.0).contains(&value) {
                        return Err("a Selective Color shift is from -1 to 1".into());
                    }
                }
            }
        }
        if self.spots.len() > MAX_EDIT_SPOTS {
            return Err(format!(
                "an edit has at most {MAX_EDIT_SPOTS} retouched spots"
            ));
        }
        for spot in &self.spots {
            let fits = unit(spot.x)
                && unit(spot.y)
                && spot.radius.is_finite()
                && spot.radius > 0.0
                && spot.radius <= 0.25
                && (spot.kind == "retouch" || spot.kind == "red-eye");
            if !fits {
                return Err("a spot is a retouch or red-eye circle inside the picture".into());
            }
        }
        if self.marks.len() > MAX_EDIT_STROKES {
            return Err(format!(
                "an edit has at most {MAX_EDIT_STROKES} drawn lines"
            ));
        }
        for stroke in &self.marks {
            let colored = stroke.color.len() == 7
                && stroke.color.starts_with('#')
                && stroke.color[1..].bytes().all(|b| b.is_ascii_hexdigit());
            let fits = colored
                && stroke.width.is_finite()
                && stroke.width > 0.0
                && stroke.width <= 0.1
                && (1..=MAX_STROKE_POINTS).contains(&stroke.points.len())
                && stroke.points.iter().all(|p| unit(p[0]) && unit(p[1]));
            if !fits {
                return Err(format!(
                    "a drawn line is a #rrggbb colour and 1 to {MAX_STROKE_POINTS} points inside the picture"
                ));
            }
        }
        if let Some(crop) = &self.crop {
            let parts = [crop.x, crop.y, crop.width, crop.height];
            let fits = parts.iter().all(|v| v.is_finite() && *v >= 0.0)
                && crop.width >= 0.01
                && crop.height >= 0.01
                && crop.x + crop.width <= 1.000_001
                && crop.y + crop.height <= 1.000_001;
            if !fits {
                return Err("a crop is a rectangle inside the picture, as fractions".into());
            }
        }
        Ok(())
    }

    /// Whether the edit changes nothing, and so is no edit. Only meaningful
    /// for an edit that passed [`Edit::check`].
    pub fn is_identity(&self) -> bool {
        let whole = self.crop.as_ref().is_none_or(|c| {
            c.x <= 0.000_001 && c.y <= 0.000_001 && c.width >= 0.999_999 && c.height >= 0.999_999
        });
        self.rotate == 0
            && !self.flip
            && self.straighten == 0.0
            && self.vertical == 0.0
            && self.horizontal == 0.0
            && whole
            && self.adjust.values().iter().all(|v| *v == 0.0)
            && self.filter == "none"
            && self.levels.is_none()
            && self.curve.is_empty()
            && self.channels.is_none()
            && self.selective.is_none()
            && self.spots.is_empty()
            && self.marks.is_empty()
            && self.external.is_none()
    }
}

/// Where a photo was taken.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Location {
    pub lat: f64,
    pub lon: f64,
    /// The place's name, as the person typed it or a geocoder gave it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

impl Location {
    fn check(&self) -> Result<(), String> {
        if !(self.lat.is_finite() && self.lat.abs() <= 90.0)
            || !(self.lon.is_finite() && self.lon.abs() <= 180.0)
        {
            return Err("a place is a latitude and longitude in degrees".into());
        }
        if self.name.as_ref().is_some_and(|n| n.chars().count() > 200) {
            return Err("a place's name has at most 200 characters".into());
        }
        Ok(())
    }
}

/// What the camera recorded, from the picture's EXIF data.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Default)]
#[serde(crate = "ferrite_app::serde", default, deny_unknown_fields)]
pub struct Exif {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lens: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub iso: Option<u32>,
    /// The f-number.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub aperture: Option<f64>,
    /// Seconds.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exposure: Option<f64>,
    /// Millimetres.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub focal: Option<f64>,
    /// Exposure compensation, in stops.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bias: Option<f64>,
}

impl Exif {
    fn check(&self) -> Result<(), String> {
        if self.lens.as_ref().is_some_and(|l| l.chars().count() > 100) {
            return Err("a lens's name has at most 100 characters".into());
        }
        let numbers = [self.aperture, self.exposure, self.focal, self.bias];
        if !numbers.iter().flatten().all(|n| n.is_finite()) {
            return Err("a camera setting is a number".into());
        }
        Ok(())
    }
}

fn is_false(value: &bool) -> bool {
    !*value
}

/// A face found in a photo as it shows, its box as fractions of the picture.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Face {
    /// Its place in the list as first kept: the list never gains a face.
    pub id: u32,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    /// The detector's confidence, 0 to 1.
    pub score: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// The person said this is no face: it stays, so that the picture is not offered again.
    #[serde(default, skip_serializing_if = "is_false")]
    pub not_a_face: bool,
}

/// One photo of the library, as the page sees it.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Photo {
    pub id: String,
    /// The drive's id of the original.
    pub file: String,
    /// The file's name, without its extension: not the same as its title.
    pub name: String,
    pub mime: String,
    /// The original's size in bytes.
    pub bytes: u64,
    pub width: u32,
    pub height: u32,
    /// When it was taken (from the picture's EXIF data, else the file's date),
    /// in milliseconds from 1970; negative for an older photo.
    pub taken_ms: i64,
    /// When it was added to the library, by the platform's clock.
    pub added_ms: u64,
    /// One of [`SOURCES`].
    pub source: String,
    /// The Photo Booth effect it was taken with.
    #[serde(default)]
    pub effect: Option<String>,
    /// The camera, from the picture's EXIF data.
    #[serde(default)]
    pub camera: Option<String>,
    #[serde(default)]
    pub favorite: bool,
    /// When it was moved to Recently Deleted.
    #[serde(default)]
    pub deleted_ms: Option<u64>,
    #[serde(default)]
    pub edit: Option<Edit>,
    /// When it was last edited or reverted: what a thumbnail's address changes
    /// with.
    #[serde(default)]
    pub edited_ms: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub keywords: Vec<String>,
    /// The names the person gave the people in it, by a face or in Info.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub people: Vec<String>,
    /// The faces the page found in its thumbnail: this server looks at no picture. `None` until
    /// a page has looked; an edit that changes the picture's frame clears it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub faces: Option<Vec<Face>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub location: Option<Location>,
    #[serde(default, skip_serializing_if = "is_false")]
    pub hidden: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exif: Option<Exif>,
    /// A movie's length, in milliseconds.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
    /// The hash of its thumbnail, which the page works out to tell near-duplicates apart: this
    /// server looks at no picture. An edit clears it, since the thumbnail changes.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phash: Option<String>,
    /// What the page read in its thumbnail, once it has looked: this server looks at no picture.
    /// An edit leaves it, as a crop or a filter rarely changes what a picture shows.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scenes: Option<Vec<String>>,
}

/// A photo as a shard keeps it: the record, and the keys of its thumbnails.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
struct Kept {
    #[serde(flatten)]
    photo: Photo,
    thumb: String,
    #[serde(default)]
    edited_thumb: Option<String>,
}

/// One album: a name, the photos in it in the order they were added, and the
/// order it lists them in.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Album {
    pub id: String,
    pub name: String,
    pub photos: Vec<String>,
    pub created_ms: u64,
    /// One of [`ALBUM_SORTS`]; an album kept before sorting existed is `custom`.
    #[serde(default = "custom_sort")]
    pub sort: String,
    /// The photo its row shows.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub key_photo: Option<String>,
    /// The folder it is in.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub folder: Option<String>,
}

fn custom_sort() -> String {
    "custom".into()
}

/// A folder of My Albums, which holds albums, smart albums and folders.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Folder {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent: Option<String>,
    pub created_ms: u64,
}

/// One condition of a smart album.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Rule {
    /// One of [`RULE_FIELDS`].
    pub field: String,
    /// One of [`RULE_OPS`].
    pub op: String,
    #[serde(default)]
    pub value: String,
}

/// A smart album: what it lists follows from its rules, on the page.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
pub struct SmartAlbum {
    #[serde(default)]
    pub id: String,
    pub name: String,
    /// Whether a photo meeting any rule is listed, rather than all of them.
    #[serde(default)]
    pub any: bool,
    pub rules: Vec<Rule>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub folder: Option<String>,
    #[serde(default)]
    pub created_ms: u64,
}

/// A keyword of the Keyword Manager's list, with the key that applies it.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Keyword {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub key: Option<String>,
}

/// A saved slideshow.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Project {
    #[serde(default)]
    pub id: String,
    pub name: String,
    pub photos: Vec<String>,
    /// How each picture leads to the next.
    #[serde(default)]
    pub theme: String,
    /// Seconds each picture is shown.
    #[serde(default)]
    pub seconds: f64,
    /// The song played under it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub music: Option<ProjectMusic>,
}

/// A song of the person's Music library, by its file on the drive.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct ProjectMusic {
    pub file: String,
    pub title: String,
}

/// What the person chose about memories, which the page makes from the
/// photos' dates: each list holds memory ids.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
struct Memories {
    #[serde(default)]
    favorites: Vec<String>,
    #[serde(default)]
    deleted: Vec<String>,
    #[serde(default)]
    albums: Vec<String>,
}

/// The document of how the photos are organised. `photos` and `purge` hold
/// what a library from before the shards kept here, until [`upgrade`] moved it.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
struct Index {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    photos: Vec<Kept>,
    #[serde(default)]
    albums: Vec<Album>,
    #[serde(default)]
    folders: Vec<Folder>,
    #[serde(default)]
    smart_albums: Vec<SmartAlbum>,
    #[serde(default)]
    keywords: Vec<Keyword>,
    #[serde(default)]
    projects: Vec<Project>,
    #[serde(default)]
    memories: Memories,
    #[serde(default)]
    purge: Vec<String>,
}

/// One shard of the records.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
struct Shard {
    #[serde(default)]
    photos: Vec<Kept>,
    /// Drive files of photos deleted for good, until the page confirms it
    /// removed them.
    #[serde(default)]
    purge: Vec<String>,
    /// The ids of photos deleted for good from this shard. An id is never used twice; a delete
    /// always shrinks the document, as an id is far smaller than the record it replaces.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    deleted: Vec<String>,
    /// This shard has taken its records from a library from before the shards.
    #[serde(default, skip_serializing_if = "is_false")]
    migrated: bool,
}

impl Shard {
    /// Every image key the document names.
    fn images(&self) -> BTreeSet<String> {
        let mut keys = BTreeSet::new();
        for kept in &self.photos {
            keys.insert(kept.thumb.clone());
            if let Some(edited) = &kept.edited_thumb {
                keys.insert(edited.clone());
            }
        }
        keys
    }

    fn find(&self, id: &str) -> Option<&Kept> {
        self.photos.iter().find(|kept| kept.photo.id == id)
    }

    fn find_mut(&mut self, id: &str) -> Option<&mut Kept> {
        self.photos.iter_mut().find(|kept| kept.photo.id == id)
    }

    /// Delete the photos `gone` picks for good, in the one write that adds
    /// their originals to `purge`. Answers their ids and those files.
    fn remove(&mut self, gone: impl Fn(&Kept) -> bool) -> (Vec<String>, Vec<String>) {
        let (removed, kept): (Vec<Kept>, Vec<Kept>) =
            self.photos.drain(..).partition(|kept| gone(kept));
        self.photos = kept;
        let mut released: Vec<String> = Vec::new();
        for kept in &removed {
            let file = &kept.photo.file;
            if !self.purge.contains(file) {
                self.purge.push(file.clone());
            }
            released.push(file.clone());
        }
        let ids: Vec<String> = removed.into_iter().map(|k| k.photo.id).collect();
        self.deleted.extend(ids.iter().cloned());
        (ids, released)
    }
}

impl Index {
    /// Every photo an album or a slideshow names.
    fn named_photos(&self) -> impl Iterator<Item = &String> {
        self.albums
            .iter()
            .flat_map(|album| album.photos.iter().chain(album.key_photo.iter()))
            .chain(
                self.projects
                    .iter()
                    .flat_map(|project| project.photos.iter()),
            )
    }

    /// Take photos deleted for good out of whatever names them.
    fn forget_photos(&mut self, ids: &BTreeSet<String>) {
        for album in &mut self.albums {
            album.photos.retain(|id| !ids.contains(id));
            if album.key_photo.as_ref().is_some_and(|id| ids.contains(id)) {
                album.key_photo = None;
            }
        }
        for project in &mut self.projects {
            project.photos.retain(|id| !ids.contains(id));
        }
    }

    /// The folder `id` and every folder inside it.
    fn folder_tree(&self, id: &str) -> BTreeSet<String> {
        let mut tree = BTreeSet::from([id.to_string()]);
        loop {
            let more: Vec<String> = self
                .folders
                .iter()
                .filter(|f| {
                    !tree.contains(&f.id) && f.parent.as_ref().is_some_and(|p| tree.contains(p))
                })
                .map(|f| f.id.clone())
                .collect();
            if more.is_empty() {
                return tree;
            }
            tree.extend(more);
        }
    }
}

/// Move the item for which `is` holds to just before the one `before` names,
/// or to the end.
fn place<T>(
    items: &mut Vec<T>,
    is: impl Fn(&T) -> bool,
    before: Option<&str>,
    id: impl Fn(&T) -> &str,
) {
    let Some(at) = items.iter().position(is) else {
        return;
    };
    let item = items.remove(at);
    let to = before
        .and_then(|b| items.iter().position(|each| id(each) == b))
        .unwrap_or(items.len());
    items.insert(to, item);
}

/// FNV-1a: a stable hash, so a photo keeps its shard across builds.
fn shard_number(id: &str) -> u32 {
    let mut hash: u32 = 0x811c_9dc5;
    for byte in id.as_bytes() {
        hash ^= u32::from(*byte);
        hash = hash.wrapping_mul(0x0100_0193);
    }
    hash % SHARDS
}

fn shard_key(number: u32) -> String {
    format!("shard/{number:02}")
}

fn claim_key(file: &str) -> String {
    format!("{CLAIM}{file}")
}

fn shard_of(id: &str) -> String {
    shard_key(shard_number(id))
}

/// The key of every shard, for a reader of the records (Spotlight).
pub fn shard_keys() -> Vec<String> {
    (0..SHARDS).map(shard_key).collect()
}

/// Whether a photo of these shards names the drive file.
fn names_file(shards: &[(Shard, usize)], file: &str) -> bool {
    shards
        .iter()
        .any(|(shard, _)| shard.photos.iter().any(|kept| kept.photo.file == file))
}

/// Whether the drive file waits to be removed.
fn awaits_purge(index: &Index, shards: &[(Shard, usize)], file: &str) -> bool {
    index.purge.iter().any(|each| each == file)
        || shards
            .iter()
            .any(|(shard, _)| shard.purge.iter().any(|each| each == file))
}

/// The body that adds a photo.
#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct NewPhoto {
    pub id: String,
    pub file: String,
    pub name: String,
    pub mime: String,
    pub bytes: u64,
    pub width: u32,
    pub height: u32,
    pub taken_ms: i64,
    pub source: String,
    #[serde(default)]
    pub effect: Option<String>,
    #[serde(default)]
    pub camera: Option<String>,
    #[serde(default)]
    pub exif: Option<Exif>,
    #[serde(default)]
    pub location: Option<Location>,
    #[serde(default)]
    pub duration_ms: Option<u64>,
    /// A duplicate's, from the photo it copies.
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub caption: Option<String>,
    #[serde(default)]
    pub keywords: Vec<String>,
    /// A duplicate's, from the photo it copies.
    #[serde(default)]
    pub people: Vec<String>,
    /// The thumbnail, a JPEG in standard base64.
    pub thumb: String,
}

/// The body that changes a photo; every field is optional.
#[derive(serde::Deserialize, Default)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Change {
    #[serde(default)]
    pub favorite: Option<bool>,
    #[serde(default)]
    pub hidden: Option<bool>,
    /// `true` moves the photo to Recently Deleted, `false` recovers it.
    #[serde(default)]
    pub deleted: Option<bool>,
    #[serde(default)]
    pub name: Option<String>,
    /// A title; empty removes it.
    #[serde(default)]
    pub title: Option<String>,
    /// A caption; empty removes it.
    #[serde(default)]
    pub caption: Option<String>,
    /// Replaces the keywords.
    #[serde(default)]
    pub keywords: Option<Vec<String>>,
    /// Keywords to add and to take away, for several photos at once.
    #[serde(default)]
    pub add_keywords: Vec<String>,
    #[serde(default)]
    pub remove_keywords: Vec<String>,
    /// Names added to the photo's people, and names taken off it.
    #[serde(default)]
    pub add_people: Vec<String>,
    #[serde(default)]
    pub remove_people: Vec<String>,
    /// What one face of the photo now is.
    #[serde(default)]
    pub face: Option<FaceChange>,
    #[serde(default)]
    pub taken_ms: Option<i64>,
    /// A place, or `null` to remove it.
    #[serde(default, deserialize_with = "present")]
    pub location: Option<Option<Location>>,
    /// An edit, or `null` to revert to the original.
    #[serde(default, deserialize_with = "present")]
    pub edit: Option<Option<Edit>>,
    /// The thumbnail of the edited photo, with an edit.
    #[serde(default)]
    pub thumb: Option<String>,
}

/// A face's name, which also goes on the photo's people, or that it is no face.
#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct FaceChange {
    pub id: u32,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub not_a_face: bool,
}

/// A field that is present, `null` included, as `Some`.
fn present<'de, D, T>(deserializer: D) -> Result<Option<T>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: serde::Deserialize<'de>,
{
    T::deserialize(deserializer).map(Some)
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct NewAlbum {
    id: String,
    name: String,
    #[serde(default)]
    folder: Option<String>,
}

#[derive(serde::Deserialize, Default)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct AlbumChange {
    #[serde(default)]
    name: Option<String>,
    /// One of [`ALBUM_SORTS`].
    #[serde(default)]
    sort: Option<String>,
    #[serde(default)]
    add: Vec<String>,
    #[serde(default)]
    remove: Vec<String>,
    /// Another album the photos of `add` leave in the same write.
    #[serde(default)]
    from: Option<String>,
    /// The album's photos, reordered by hand (the same set in a new order).
    #[serde(default)]
    order: Option<Vec<String>>,
    /// The photo its row shows, or `null`.
    #[serde(default, deserialize_with = "present")]
    key_photo: Option<Option<String>>,
    /// The folder it goes in, or `null` for My Albums itself.
    #[serde(default, deserialize_with = "present")]
    folder: Option<Option<String>>,
    /// Where it goes in the sidebar: before this album, or `null` for last.
    #[serde(default, deserialize_with = "present")]
    before: Option<Option<String>>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct NewFolder {
    id: String,
    name: String,
    #[serde(default)]
    parent: Option<String>,
}

#[derive(serde::Deserialize, Default)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct FolderChange {
    #[serde(default)]
    name: Option<String>,
    #[serde(default, deserialize_with = "present")]
    parent: Option<Option<String>>,
    #[serde(default, deserialize_with = "present")]
    before: Option<Option<String>>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct KeywordList {
    keywords: Vec<Keyword>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Purged {
    files: Vec<String>,
}

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    match served(&mut cx).await {
        Ok(response) => response,
        Err(error) => Response::error(503, &format!("storage failed: {error}")),
    }
}

async fn served(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    upgrade(&mut cx.storage.user()).await?;
    let path = cx.request.path;
    let method = cx.request.method;
    match (method, path) {
        ("GET", "/library") => library(cx).await,
        (_, "/library") => Ok(Response::method_not_allowed()),
        ("POST", "/purged") => purged(cx).await,
        (_, "/purged") => Ok(Response::method_not_allowed()),
        ("POST", "/photos") => add(cx).await,
        (_, "/photos") => Ok(Response::method_not_allowed()),
        ("POST", "/hashes") => keep_hashes(cx).await,
        (_, "/hashes") => Ok(Response::method_not_allowed()),
        ("POST", "/scenes") => keep_scenes(cx).await,
        (_, "/scenes") => Ok(Response::method_not_allowed()),
        ("POST", "/faces") => keep_faces(cx).await,
        (_, "/faces") => Ok(Response::method_not_allowed()),
        ("GET", "/thumbs") => thumbs(cx).await,
        (_, "/thumbs") => Ok(Response::method_not_allowed()),
        ("POST", "/albums") => add_album(cx).await,
        (_, "/albums") => Ok(Response::method_not_allowed()),
        ("POST", "/folders") => add_folder(cx).await,
        (_, "/folders") => Ok(Response::method_not_allowed()),
        ("PUT", "/keywords") => set_keywords(cx).await,
        (_, "/keywords") => Ok(Response::method_not_allowed()),
        ("PUT", "/settings") => set_settings(cx).await,
        (_, "/settings") => Ok(Response::method_not_allowed()),
        ("POST", "/memories") => mark_memory(cx).await,
        (_, "/memories") => Ok(Response::method_not_allowed()),
        _ => {
            let Some((kind, id)) = path.trim_start_matches('/').split_once('/') else {
                return Ok(Response::not_found());
            };
            if !["photos", "albums", "folders", "smart-albums", "projects"].contains(&kind) {
                return Ok(Response::not_found());
            }
            if !valid_id(id) {
                return Ok(bad_id());
            }
            match (kind, method) {
                ("photos", "POST") => change(cx, id).await,
                ("photos", "DELETE") => delete_photo(&mut cx.storage.user(), id).await,
                ("albums", "POST") => change_album(cx, id).await,
                ("albums", "DELETE") => delete_album(&mut cx.storage.user(), id).await,
                ("folders", "POST") => change_folder(cx, id).await,
                ("folders", "DELETE") => delete_folder(&mut cx.storage.user(), id).await,
                ("smart-albums", "PUT") => put_smart_album(cx, id).await,
                ("smart-albums", "DELETE") => {
                    remove_from_index(&mut cx.storage.user(), |index| {
                        index.smart_albums.retain(|a| a.id != id)
                    })
                    .await
                }
                ("projects", "PUT") => put_project(cx, id).await,
                ("projects", "DELETE") => {
                    remove_from_index(&mut cx.storage.user(), |index| {
                        index.projects.retain(|p| p.id != id)
                    })
                    .await
                }
                _ => Ok(Response::method_not_allowed()),
            }
        }
    }
}

fn bad_id() -> Response {
    Response::error(400, "an id is 1 to 64 letters, digits, '-', '_' or '.'")
}

fn busy() -> Response {
    Response::error(503, "the library changed too often to save; try again")
}

/// Whether `id` may name a photo or an album.
pub fn valid_id(id: &str) -> bool {
    id.len() <= MAX_ID_BYTES && document::valid_key(id)
}

/// Whether `bytes` start as a JPEG does.
pub fn is_jpeg(bytes: &[u8]) -> bool {
    bytes.len() > 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF
}

/// A name as kept: control characters removed, then trimmed, 1 to `max` characters.
pub fn clean_name(name: &str, max: usize) -> Result<String, String> {
    let name: String = name.chars().filter(|c| !c.is_control()).collect();
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("a name cannot be empty".into());
    }
    if name.chars().count() > max {
        return Err(format!("a name has at most {max} characters"));
    }
    Ok(name)
}

/// A title or caption as kept: `None` when it is empty once trimmed. A caption
/// keeps its line breaks.
fn clean_text(text: &str, max: usize) -> Result<Option<String>, String> {
    let text: String = text
        .chars()
        .filter(|c| !c.is_control() || *c == '\n')
        .collect();
    let text = text.trim();
    if text.is_empty() {
        return Ok(None);
    }
    if text.chars().count() > max {
        return Err(format!("this text has at most {max} characters"));
    }
    Ok(Some(text.to_string()))
}

/// Keywords as kept: cleaned, without repeats ignoring case, within the limits.
fn clean_keywords(words: &[String]) -> Result<Vec<String>, String> {
    let mut kept: Vec<String> = Vec::new();
    for word in words {
        let word = clean_name(word, MAX_KEYWORD_CHARS)?;
        if !kept.iter().any(|k| k.eq_ignore_ascii_case(&word)) {
            kept.push(word);
        }
    }
    if kept.len() > MAX_PHOTO_KEYWORDS {
        return Err(format!("a photo has at most {MAX_PHOTO_KEYWORDS} keywords"));
    }
    Ok(kept)
}

/// A photo's people as kept: cleaned, without repeats ignoring case, within the limits.
fn clean_people(names: &[String]) -> Result<Vec<String>, String> {
    let mut kept: Vec<String> = Vec::new();
    for name in names {
        let name = clean_name(name, MAX_KEYWORD_CHARS)?;
        if !kept.iter().any(|k| k.eq_ignore_ascii_case(&name)) {
            kept.push(name);
        }
    }
    if kept.len() > MAX_PHOTO_PEOPLE {
        return Err(format!("a photo names at most {MAX_PHOTO_PEOPLE} people"));
    }
    Ok(kept)
}

/// A thumbnail sent as standard base64: the JPEG, or why it is refused.
pub fn decode_thumb(text: &str) -> Result<Vec<u8>, Response> {
    let bytes = ferrite_app::crypto::base64_decode(text)
        .map_err(|_| Response::error(400, "the thumbnail is not base64"))?;
    if bytes.len() > MAX_THUMB_BYTES {
        return Err(Response::error(
            413,
            &format!("a thumbnail has at most {MAX_THUMB_BYTES} bytes"),
        ));
    }
    if !is_jpeg(&bytes) {
        return Err(Response::error(400, "the thumbnail is not a JPEG picture"));
    }
    Ok(bytes)
}

/// Whether a photo in Recently Deleted has been there long enough to go.
pub fn expired(photo: &Photo, now_ms: u64) -> bool {
    photo
        .deleted_ms
        .is_some_and(|deleted| now_ms.saturating_sub(deleted) >= RECENTLY_DELETED_MS)
}

/// The ids of a `?ids=` list, split at commas (`,` or `%2C`).
pub fn split_ids(list: &str) -> Vec<String> {
    list.replace("%2C", ",")
        .replace("%2c", ",")
        .split(',')
        .filter(|id| !id.is_empty())
        .map(str::to_string)
        .collect()
}

fn to_json<T: serde::Serialize>(value: &T) -> io::Result<Vec<u8>> {
    serde_json::to_vec(value).map_err(io::Error::other)
}

/// A key no other write shares: `prefix`, the photo's id and a random token
/// (upstream's SDK has no random function; key generation is its route to
/// the system generator, as `src/session.rs` does it).
fn fresh_key(prefix: &str, id: &str) -> String {
    let document = Ed25519SigningKey::generate_pkcs8();
    let token = hex(&hmac_sha256(&document, b"macalicious-desktop/photos/v1"));
    format!("{prefix}{id}/{}", &token[..32])
}

/// A stored document and the version to write over (`None` while there is none).
async fn read<T>(space: &mut Space<'_>, key: &str) -> io::Result<(T, Option<u64>)>
where
    T: serde::de::DeserializeOwned + Default,
{
    match space.get_versioned(key).await? {
        Some((bytes, version)) => {
            let value = serde_json::from_slice(&bytes)
                .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
            Ok((value, Some(version)))
        }
        None => Ok((T::default(), None)),
    }
}

/// Every shard, in order, each with the bytes it takes.
async fn read_shards(space: &mut Space<'_>) -> io::Result<Vec<(Shard, usize)>> {
    let found = space.get_many(&shard_keys()).await?;
    found
        .into_iter()
        .map(|bytes| match bytes {
            Some(bytes) => serde_json::from_slice(&bytes)
                .map(|shard| (shard, bytes.len()))
                .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e)),
            None => Ok((Shard::default(), 0)),
        })
        .collect()
}

/// What a mutation did.
enum Outcome<T, D> {
    /// The change was written; the value `f` gave, and the document as written.
    Done(T, D),
    /// `f` refused the change, or the document kept changing: nothing written.
    Refused(Response),
}

/// Apply `f` to the current shard and write the result if no other change came
/// first, trying again from the newer shard otherwise. After a write, the image
/// keys the change stopped naming are deleted: each is deleted by the one
/// change that dropped it.
async fn mutate_shard<T>(
    space: &mut Space<'_>,
    key: &str,
    mut f: impl FnMut(&mut Shard) -> Result<T, Response>,
) -> io::Result<Outcome<T, Shard>> {
    for _ in 0..ATTEMPTS {
        let (current, version): (Shard, _) = read(space, key).await?;
        let mut next = current.clone();
        let value = match f(&mut next) {
            Ok(value) => value,
            Err(refused) => return Ok(Outcome::Refused(refused)),
        };
        if next == current {
            return Ok(Outcome::Done(value, next));
        }
        let bytes = to_json(&next)?;
        if let Err(refused) = fits(&bytes, &current) {
            return Ok(Outcome::Refused(refused));
        }
        if space.put_if_version(key, &bytes, version).await? {
            let kept = next.images();
            for image in current.images().difference(&kept) {
                if let Err(error) = space.delete(image).await {
                    ferrite_app::tracing::warn!(%error, "photos: a dropped image was not deleted");
                }
            }
            return Ok(Outcome::Done(value, next));
        }
    }
    Ok(Outcome::Refused(busy()))
}

/// The same for the document of how the photos are organised.
async fn mutate_index<T>(
    space: &mut Space<'_>,
    mut f: impl FnMut(&mut Index) -> Result<T, Response>,
) -> io::Result<Outcome<T, Index>> {
    for _ in 0..ATTEMPTS {
        let (current, version): (Index, _) = read(space, LIBRARY).await?;
        let mut next = current.clone();
        let value = match f(&mut next) {
            Ok(value) => value,
            Err(refused) => return Ok(Outcome::Refused(refused)),
        };
        if next == current {
            return Ok(Outcome::Done(value, next));
        }
        let bytes = to_json(&next)?;
        if let Err(refused) = fits(&bytes, &current) {
            return Ok(Outcome::Refused(refused));
        }
        if space.put_if_version(LIBRARY, &bytes, version).await? {
            return Ok(Outcome::Done(value, next));
        }
    }
    Ok(Outcome::Refused(busy()))
}

/// Whether the document as `next` (its JSON) may be written over `current`: at
/// most [`MAX_LIBRARY_BYTES`], or no larger than `current` was (so a document
/// that grew past the bound can still shrink).
fn fits<T: serde::Serialize>(next: &[u8], current: &T) -> Result<(), Response> {
    if next.len() <= MAX_LIBRARY_BYTES {
        return Ok(());
    }
    let before = to_json(current).map(|b| b.len()).unwrap_or(usize::MAX);
    if next.len() <= before {
        return Ok(());
    }
    Err(Response::error(
        413,
        "the library is full: delete some photos or albums, or empty Recently Deleted",
    ))
}

/// Move the records of a library from before the shards out of `library`. See
/// "How it is stored": safe to run twice, at once, or after a crash partway.
async fn upgrade(space: &mut Space<'_>) -> io::Result<()> {
    for _ in 0..ATTEMPTS {
        let (index, version): (Index, _) = read(space, LIBRARY).await?;
        if index.photos.is_empty() {
            return Ok(());
        }
        let mut groups: BTreeMap<String, Vec<Kept>> = BTreeMap::new();
        for kept in &index.photos {
            groups
                .entry(shard_of(&kept.photo.id))
                .or_default()
                .push(kept.clone());
        }
        for (key, group) in &groups {
            // Past the bound if it must be: see "How it is stored".
            let mut written = false;
            for _ in 0..ATTEMPTS {
                let (shard, shard_version): (Shard, _) = read(space, key).await?;
                if shard.migrated {
                    written = true;
                    break;
                }
                let mut next = shard;
                next.migrated = true;
                next.photos.extend(group.iter().cloned());
                if space
                    .put_if_version(key, &to_json(&next)?, shard_version)
                    .await?
                {
                    written = true;
                    break;
                }
            }
            if !written {
                return Err(io::Error::other("a shard kept changing during the upgrade"));
            }
        }
        // Created only if absent: a request paused here must not take a claim, or the mark of a
        // file gone, back from what has happened since.
        for kept in &index.photos {
            space
                .put_if_version(&claim_key(&kept.photo.file), kept.photo.id.as_bytes(), None)
                .await?;
        }
        for file in &index.purge {
            space
                .put_if_version(&claim_key(file), b"/purge", None)
                .await?;
        }
        let mut next = index;
        next.photos.clear();
        if space
            .put_if_version(LIBRARY, &to_json(&next)?, version)
            .await?
        {
            return Ok(());
        }
    }
    Err(io::Error::other(
        "the library kept changing during its upgrade",
    ))
}

/// The most files one reply offers for removal; the next offers the rest.
const MAX_PURGE_LISTED: usize = 500;

/// The drive files the page may remove: those waiting that no photo names.
fn removable(index: &Index, shards: &[(Shard, usize)]) -> Vec<String> {
    let mut purge = index.purge.clone();
    for (shard, _) in shards {
        purge.extend(shard.purge.iter().cloned());
    }
    purge.retain(|file| !names_file(shards, file));
    purge.sort();
    purge.dedup();
    purge.truncate(MAX_PURGE_LISTED);
    purge
}

/// Delete an image key this request wrote unless the shard names it: the request's change was
/// not written, or kept another request's image. Without `shard` (the write's outcome is not
/// known: storage failed) the shard is read again first, and an image it names, or one whose
/// outcome cannot be read, is left alone.
async fn drop_unless_named(space: &mut Space<'_>, key: &str, photo: &str, shard: Option<&Shard>) {
    let named = match shard {
        Some(shard) => shard.images().contains(key),
        None => match read::<Shard>(space, &shard_of(photo)).await {
            Ok((shard, _)) => shard.images().contains(key),
            Err(_) => true,
        },
    };
    if named {
        return;
    }
    if let Err(error) = space.delete(key).await {
        ferrite_app::tracing::warn!(%error, "photos: an unused image was not deleted");
    }
}

fn limits() -> serde_json::Value {
    serde_json::json!({
        "photos": MAX_PHOTOS,
        "albums": MAX_ALBUMS,
        "folders": MAX_FOLDERS,
        "smart_albums": MAX_SMART_ALBUMS,
        "thumb_bytes": MAX_THUMB_BYTES,
        "original_bytes": MAX_ORIGINAL_BYTES,
        "recently_deleted_days": RECENTLY_DELETED_MS / 86_400_000,
    })
}

fn organised(index: &Index) -> serde_json::Value {
    serde_json::json!({
        "albums": index.albums,
        "folders": index.folders,
        "smart_albums": index.smart_albums,
        "keywords": index.keywords,
        "projects": index.projects,
        "memories": index.memories,
    })
}

fn organised_reply(index: &Index, status: u16) -> Response {
    Response::json(status, &organised(index))
}

async fn library(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let now_ms = cx.now_ms;
    let session = cx.session;
    let from = cx
        .request
        .query_param("from")
        .and_then(|from| from.parse::<usize>().ok())
        .unwrap_or(0);
    let mut space = cx.storage.user();
    let (mut index, _): (Index, _) = read(&mut space, LIBRARY).await?;
    let mut shards = read_shards(&mut space).await?;
    // Expiry is decided again on the shard each write reads, so a photo
    // recovered meanwhile is not deleted.
    let mut gone = BTreeSet::new();
    for (number, (shard, size)) in shards.iter_mut().enumerate() {
        if !shard.photos.iter().any(|kept| expired(&kept.photo, now_ms)) {
            continue;
        }
        let key = shard_key(number as u32);
        let outcome = mutate_shard(&mut space, &key, |shard| {
            Ok(shard.remove(|kept| expired(&kept.photo, now_ms)).0)
        })
        .await?;
        match outcome {
            Outcome::Done(ids, written) => {
                gone.extend(ids);
                *shard = written;
                *size = to_json(shard)?.len();
            }
            Outcome::Refused(refused) => return Ok(refused),
        }
    }
    // Exactly the photos this request deleted. A request that stops here leaves references the
    // reply below leaves out.
    if !gone.is_empty() {
        match mutate_index(&mut space, |index| {
            index.forget_photos(&gone);
            Ok(())
        })
        .await?
        {
            Outcome::Done((), written) => index = written,
            Outcome::Refused(refused) => return Ok(refused),
        }
    }
    // Filtered for this reply and written nowhere.
    let held: BTreeSet<&String> = shards
        .iter()
        .flat_map(|(shard, _)| shard.photos.iter().map(|kept| &kept.photo.id))
        .collect();
    let dangling: BTreeSet<String> = index
        .named_photos()
        .filter(|id| !held.contains(id))
        .cloned()
        .collect();
    index.forget_photos(&dangling);
    let mut photos: Vec<Photo> = Vec::new();
    let mut bytes = 0;
    let mut next = None;
    for (number, (shard, size)) in shards.iter().enumerate().skip(from) {
        if bytes > 0 && bytes + size > REPLY_BYTES {
            next = Some(number);
            break;
        }
        bytes += size;
        photos.extend(shard.photos.iter().map(|kept| kept.photo.clone()));
    }
    photos.sort_by(|a, b| a.taken_ms.cmp(&b.taken_ms).then_with(|| a.id.cmp(&b.id)));
    let purge = removable(&index, &shards);
    let window: document::Current<serde_json::Value> = document::read(&mut space, WINDOW).await?;
    let settings: Option<serde_json::Value> = match window.doc {
        Some(doc) => Some(doc),
        None => space.get_json(SETTINGS).await?,
    };
    let mut body = organised(&index);
    if let Some(object) = body.as_object_mut() {
        object.insert("photos".into(), serde_json::json!(photos));
        object.insert("next".into(), serde_json::json!(next));
        object.insert("purge".into(), serde_json::json!(purge));
        object.insert(
            "settings".into(),
            settings.unwrap_or(serde_json::Value::Null),
        );
        object.insert("settings_rev".into(), window.rev.into());
        object.insert("limits".into(), limits());
    }
    Ok(document::for_session(body, session))
}

async fn purged(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let body: Purged = match cx.request.json() {
        Ok(body) => body,
        Err(refused) => return Ok(refused),
    };
    if body.files.len() > MAX_ALBUM_CHANGE {
        return Ok(Response::error(400, "too many files in one confirmation"));
    }
    if !body.files.iter().all(|file| document::valid_key(file)) {
        return Ok(Response::error(400, "that is not a drive file id"));
    }
    let mut space = cx.storage.user();
    let (index, _): (Index, _) = read(&mut space, LIBRARY).await?;
    let shards = read_shards(&mut space).await?;
    // Only a file waiting to be removed that no photo names: a late or wrong confirmation of
    // anything else changes nothing.
    let done: BTreeSet<&String> = body
        .files
        .iter()
        .filter(|file| awaits_purge(&index, &shards, file) && !names_file(&shards, file))
        .collect();
    // Its claim becomes the mark that it is gone before the list forgets it: an import still under
    // way is refused from here on, and stopping here leaves the file listed to confirm again.
    for file in &done {
        space.put(&claim_key(file), CLAIM_GONE).await?;
    }
    for (number, (shard, _)) in shards.iter().enumerate() {
        if !shard.purge.iter().any(|file| done.contains(file)) {
            continue;
        }
        let outcome = mutate_shard(&mut space, &shard_key(number as u32), |shard| {
            shard.purge.retain(|file| !done.contains(file));
            Ok(())
        })
        .await?;
        if let Outcome::Refused(refused) = outcome {
            return Ok(refused);
        }
    }
    let outcome = mutate_index(&mut space, |index| {
        index.purge.retain(|file| !done.contains(file));
        Ok(())
    })
    .await?;
    let index = match outcome {
        Outcome::Done((), index) => index,
        Outcome::Refused(refused) => return Ok(refused),
    };
    let purge = removable(&index, &read_shards(&mut space).await?);
    Ok(Response::json(200, &serde_json::json!({ "purge": purge })))
}

/// Why a new photo cannot be kept, if it cannot.
fn check_new(new: &NewPhoto) -> Result<(), String> {
    if !valid_id(&new.id) {
        return Err("a photo id is 1 to 64 letters, digits, '-', '_' or '.'".into());
    }
    if !document::valid_key(&new.file) {
        return Err("the file is not a drive file id".into());
    }
    if !MIME_TYPES.contains(&new.mime.as_str()) {
        return Err(format!(
            "{:?} is not a picture type a browser draws",
            new.mime
        ));
    }
    if new.bytes == 0 || new.bytes > MAX_ORIGINAL_BYTES {
        return Err(format!("an original has 1 to {MAX_ORIGINAL_BYTES} bytes"));
    }
    if !(1..=MAX_SIDE).contains(&new.width) || !(1..=MAX_SIDE).contains(&new.height) {
        return Err(format!("a photo's sides are 1 to {MAX_SIDE} pixels"));
    }
    if !SOURCES.contains(&new.source.as_str()) {
        return Err(format!("{:?} is not a source of photos", new.source));
    }
    if let Some(effect) = &new.effect {
        if effect.len() > 32 || !document::valid_key(effect) {
            return Err("an effect is a short plain id".into());
        }
    }
    if let Some(camera) = &new.camera {
        if camera.chars().count() > 100 {
            return Err("a camera's name has at most 100 characters".into());
        }
    }
    if let Some(exif) = &new.exif {
        exif.check()?;
    }
    if let Some(location) = &new.location {
        location.check()?;
    }
    Ok(())
}

async fn add(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let new: NewPhoto = match cx.request.json() {
        Ok(new) => new,
        Err(refused) => return Ok(refused),
    };
    if let Err(message) = check_new(&new) {
        return Ok(Response::error(400, &message));
    }
    let name = match clean_name(&new.name, MAX_NAME_CHARS) {
        Ok(name) => name,
        Err(message) => return Ok(Response::error(400, &message)),
    };
    let title = match clean_text(new.title.as_deref().unwrap_or(""), MAX_NAME_CHARS) {
        Ok(title) => title,
        Err(message) => return Ok(Response::error(400, &message)),
    };
    let caption = match clean_text(new.caption.as_deref().unwrap_or(""), MAX_CAPTION_CHARS) {
        Ok(caption) => caption,
        Err(message) => return Ok(Response::error(400, &message)),
    };
    let people = match clean_people(&new.people) {
        Ok(people) => people,
        Err(message) => return Ok(Response::error(400, &message)),
    };
    let keywords = match clean_keywords(&new.keywords) {
        Ok(keywords) => keywords,
        Err(message) => return Ok(Response::error(400, &message)),
    };
    let thumb = match decode_thumb(&new.thumb) {
        Ok(thumb) => thumb,
        Err(refused) => return Ok(refused),
    };
    let camera = new.camera.as_deref().and_then(|c| clean_name(c, 100).ok());
    let photo = Photo {
        id: new.id.clone(),
        file: new.file,
        name,
        mime: new.mime,
        bytes: new.bytes,
        width: new.width,
        height: new.height,
        taken_ms: new.taken_ms,
        added_ms: cx.now_ms,
        source: new.source,
        effect: new.effect,
        camera,
        favorite: false,
        deleted_ms: None,
        edit: None,
        edited_ms: None,
        title,
        caption,
        keywords,
        people,
        location: new.location,
        hidden: false,
        exif: new.exif,
        duration_ms: new.duration_ms,
        phash: None,
        scenes: None,
        faces: None,
    };
    let mut space = cx.storage.user();
    let home = shard_of(&photo.id);
    let (index, _): (Index, _) = read(&mut space, LIBRARY).await?;
    let shards = read_shards(&mut space).await?;

    // The same photo sent again keeps its answer, whatever file it names now.
    if let Some(kept) = shards[shard_number(&photo.id) as usize].0.find(&photo.id) {
        return Ok(Response::json(
            200,
            &serde_json::json!({ "photo": kept.photo }),
        ));
    }
    let taken = || {
        Response::error(
            409,
            "that original belongs to another photo, or is being removed",
        )
    };
    let used = || {
        Response::error(
            409,
            "that photo was deleted, and a photo's id is not used twice",
        )
    };
    if shards[shard_number(&photo.id) as usize]
        .0
        .deleted
        .contains(&photo.id)
    {
        return Ok(used());
    }
    if names_file(&shards, &photo.file) || awaits_purge(&index, &shards, &photo.file) {
        return Ok(taken());
    }
    // The file is this photo's from here, or the import stops: what was read above may be old by
    // now, and only this key decides between two imports of one file.
    let claim = claim_key(&photo.file);
    let mut held = false;
    for _ in 0..ATTEMPTS {
        match space.get(&claim).await? {
            Some(owner) if owner == photo.id.as_bytes() => {
                held = true;
                break;
            }
            Some(_) => return Ok(taken()),
            None => {
                if space
                    .put_if_version(&claim, photo.id.as_bytes(), None)
                    .await?
                {
                    held = true;
                    break;
                }
            }
        }
    }
    if !held {
        return Ok(busy());
    }
    let key = fresh_key(THUMB, &photo.id);
    space.put(&key, &thumb).await?;
    let outcome = mutate_shard(&mut space, &home, |shard| {
        // The same photo sent again (or delivered twice): the one kept.
        if let Some(kept) = shard.find(&photo.id) {
            return Ok((200, kept.photo.clone()));
        }
        if shard.deleted.contains(&photo.id) {
            return Err(used());
        }
        if shard.purge.contains(&photo.file)
            || shard
                .photos
                .iter()
                .any(|each| each.photo.file == photo.file)
        {
            return Err(Response::error(
                409,
                "that original belongs to another photo, or is being removed",
            ));
        }
        if shard.photos.len() >= MAX_SHARD_PHOTOS {
            return Err(Response::error(
                409,
                "the library has no more room for this photo; delete some first",
            ));
        }
        shard.photos.push(Kept {
            photo: photo.clone(),
            thumb: key.clone(),
            edited_thumb: None,
        });
        Ok((201, photo.clone()))
    })
    .await;
    let outcome = match outcome {
        Ok(outcome) => outcome,
        Err(error) => {
            drop_unless_named(&mut space, &key, &photo.id, None).await;
            return Err(error);
        }
    };
    Ok(match outcome {
        Outcome::Done((status, kept), shard) => {
            drop_unless_named(&mut space, &key, &photo.id, Some(&shard)).await;
            Response::json(status, &serde_json::json!({ "photo": kept }))
        }
        Outcome::Refused(refused) => {
            // Refused before any write: the image is this request's. The claim stays, as another
            // delivery of this photo may be using it.
            if let Err(error) = space.delete(&key).await {
                ferrite_app::tracing::warn!(%error, "photos: an unused image was not deleted");
            }
            refused
        }
    })
}

async fn change(cx: &mut ApiCtx<'_>, id: &str) -> io::Result<Response> {
    let change: Change = match cx.request.json() {
        Ok(change) => change,
        Err(refused) => return Ok(refused),
    };
    let name = match change
        .name
        .as_deref()
        .map(|n| clean_name(n, MAX_NAME_CHARS))
    {
        Some(Err(message)) => return Ok(Response::error(400, &message)),
        Some(Ok(name)) => Some(name),
        None => None,
    };
    let title = match change
        .title
        .as_deref()
        .map(|t| clean_text(t, MAX_NAME_CHARS))
    {
        Some(Err(message)) => return Ok(Response::error(400, &message)),
        Some(Ok(title)) => Some(title),
        None => None,
    };
    let caption = match change
        .caption
        .as_deref()
        .map(|t| clean_text(t, MAX_CAPTION_CHARS))
    {
        Some(Err(message)) => return Ok(Response::error(400, &message)),
        Some(Ok(caption)) => Some(caption),
        None => None,
    };
    let keywords = match change.keywords.as_deref().map(clean_keywords) {
        Some(Err(message)) => return Ok(Response::error(400, &message)),
        Some(Ok(keywords)) => Some(keywords),
        None => None,
    };
    let add_keywords = match clean_keywords(&change.add_keywords) {
        Ok(words) => words,
        Err(message) => return Ok(Response::error(400, &message)),
    };
    let add_people = match clean_people(&change.add_people) {
        Ok(names) => names,
        Err(message) => return Ok(Response::error(400, &message)),
    };
    let face_name = match change.face.as_ref().and_then(|face| face.name.as_deref()) {
        Some(name) => match clean_name(name, MAX_KEYWORD_CHARS) {
            Ok(name) => Some(name),
            Err(message) => return Ok(Response::error(400, &message)),
        },
        None => None,
    };
    if let Some(Some(location)) = &change.location {
        if let Err(message) = location.check() {
            return Ok(Response::error(400, &message));
        }
    }
    // An edit is checked first; one that is valid and changes nothing is a
    // revert.
    if let Some(Some(edit)) = &change.edit {
        if let Err(message) = edit.check() {
            return Ok(Response::error(400, &message));
        }
    }
    let edit = match change.edit {
        Some(Some(edit)) if edit.is_identity() => Some(None),
        other => other,
    };
    let thumb = match (&edit, change.thumb.as_deref()) {
        (Some(Some(_)), Some(text)) => match decode_thumb(text) {
            Ok(thumb) => Some(thumb),
            Err(refused) => return Ok(refused),
        },
        (Some(Some(_)), None) => {
            return Ok(Response::error(
                400,
                "an edit comes with the thumbnail of the edited photo",
            ))
        }
        (Some(None), Some(_)) | (None, Some(_)) => {
            // A revert sent with the thumbnail it no longer needs is still a
            // revert; anything else with a thumbnail is a mistake.
            if matches!(edit, Some(None)) {
                None
            } else {
                return Ok(Response::error(400, "a thumbnail comes only with an edit"));
            }
        }
        _ => None,
    };
    let now_ms = cx.now_ms;
    let mut space = cx.storage.user();
    let key = match &thumb {
        Some(bytes) => {
            let key = fresh_key(THUMB, id);
            space.put(&key, bytes).await?;
            Some(key)
        }
        None => None,
    };
    let outcome = mutate_shard(&mut space, &shard_of(id), |shard| {
        let Some(kept) = shard.find_mut(id) else {
            return Err(Response::not_found());
        };
        let photo = &mut kept.photo;
        if let Some(favorite) = change.favorite {
            photo.favorite = favorite;
        }
        if let Some(hidden) = change.hidden {
            photo.hidden = hidden;
        }
        match change.deleted {
            Some(true) if photo.deleted_ms.is_none() => photo.deleted_ms = Some(now_ms),
            Some(false) => photo.deleted_ms = None,
            _ => {}
        }
        if let Some(name) = &name {
            photo.name = name.clone();
        }
        if let Some(title) = &title {
            photo.title = title.clone();
        }
        if let Some(caption) = &caption {
            photo.caption = caption.clone();
        }
        if let Some(keywords) = &keywords {
            photo.keywords = keywords.clone();
        }
        photo.keywords.retain(|word| {
            !change
                .remove_keywords
                .iter()
                .any(|r| r.eq_ignore_ascii_case(word))
        });
        for word in &add_keywords {
            if !photo.keywords.iter().any(|k| k.eq_ignore_ascii_case(word)) {
                photo.keywords.push(word.clone());
            }
        }
        if photo.keywords.len() > MAX_PHOTO_KEYWORDS {
            return Err(Response::error(
                400,
                &format!("a photo has at most {MAX_PHOTO_KEYWORDS} keywords"),
            ));
        }
        if let Some(taken) = change.taken_ms {
            photo.taken_ms = taken;
        }
        if let Some(location) = &change.location {
            photo.location = location.clone();
        }
        photo.people.retain(|name| {
            !change
                .remove_people
                .iter()
                .any(|r| r.eq_ignore_ascii_case(name))
        });
        for face in photo.faces.iter_mut().flatten() {
            let taken_off = face.name.as_ref().is_some_and(|name| {
                change
                    .remove_people
                    .iter()
                    .any(|r| r.eq_ignore_ascii_case(name))
            });
            if taken_off {
                face.name = None;
            }
        }
        for name in &add_people {
            if !photo.people.iter().any(|p| p.eq_ignore_ascii_case(name)) {
                photo.people.push(name.clone());
            }
        }
        if let Some(wanted) = &change.face {
            let faces = photo.faces.get_or_insert_with(Vec::new);
            let Some(at) = faces.iter().position(|face| face.id == wanted.id) else {
                return Err(Response::error(400, "this photo has no such face"));
            };
            let new = if wanted.not_a_face {
                None
            } else {
                face_name.clone()
            };
            let old = std::mem::replace(&mut faces[at].name, new.clone());
            faces[at].not_a_face = wanted.not_a_face;
            let same = |a: &String, b: &String| a.eq_ignore_ascii_case(b);
            if let Some(old) = old {
                let held = faces
                    .iter()
                    .any(|face| face.name.as_ref().is_some_and(|name| same(name, &old)));
                if !held {
                    photo.people.retain(|name| !same(name, &old));
                }
            }
            if let Some(new) = new {
                if !photo.people.iter().any(|name| same(name, &new)) {
                    photo.people.push(new);
                }
            }
        }
        if photo.people.len() > MAX_PHOTO_PEOPLE {
            return Err(Response::error(
                400,
                &format!("a photo names at most {MAX_PHOTO_PEOPLE} people"),
            ));
        }
        // The file the edit stood on, when this change lets go of it: the page may delete it.
        let mut released = None;
        if let Some(edit) = &edit {
            let holds = edit.as_ref().and_then(|edit| edit.external.as_ref());
            released = external_of(photo).filter(|file| holds != Some(file));
            if !same_frame(photo.edit.as_ref(), edit.as_ref()) {
                photo.faces = None;
            }
            photo.edit = edit.clone();
            photo.phash = None;
            // The thumbnail's version: later than any before it, even within one millisecond.
            photo.edited_ms = Some(now_ms.max(photo.edited_ms.unwrap_or(0) + 1));
            kept.edited_thumb = if edit.is_some() { key.clone() } else { None };
        }
        Ok((kept.photo.clone(), released))
    })
    .await;
    let (response, written) = match outcome {
        Ok(Outcome::Done((photo, released), shard)) => (
            Ok(Response::json(
                200,
                &serde_json::json!({ "photo": photo, "released": released }),
            )),
            Some(shard),
        ),
        Ok(Outcome::Refused(refused)) => (Ok(refused), None),
        Err(error) => (Err(error), None),
    };
    if let Some(key) = &key {
        drop_unless_named(&mut space, key, id, written.as_ref()).await;
    }
    response
}

/// The hash of one thumbnail, of the photo as of its `edited_ms`.
#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct PictureHash {
    id: String,
    #[serde(default)]
    edited_ms: Option<u64>,
    hash: String,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct PictureHashes {
    hashes: Vec<PictureHash>,
}

/// A hash as the page writes it: 64 bits and a colour, in lower-case hex.
fn valid_hash(hash: &str) -> bool {
    hash.len() == HASH_DIGITS && hash.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
}

/// `POST /hashes`: keeps each hash with its photo, unless the photo was edited since the hash was
/// worked out. Answers the ids that have it now; a shard that cannot take it stays as it is, and
/// the page works it out again next time.
async fn keep_hashes(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let body = match cx.request.json::<PictureHashes>() {
        Ok(body) => body,
        Err(refused) => return Ok(refused),
    };
    if body.hashes.len() > MAX_HASHES {
        return Ok(Response::error(
            400,
            &format!("at most {MAX_HASHES} hashes at once"),
        ));
    }
    if let Some(bad) = body.hashes.iter().find(|each| !valid_hash(&each.hash)) {
        return Ok(Response::error(
            400,
            &format!("{:?} is not a picture's hash", bad.hash),
        ));
    }
    let mut shards: BTreeMap<String, Vec<PictureHash>> = BTreeMap::new();
    for each in body.hashes {
        shards.entry(shard_of(&each.id)).or_default().push(each);
    }
    let mut kept = Vec::new();
    let mut space = cx.storage.user();
    for (key, hashes) in &shards {
        let outcome = mutate_shard(&mut space, key, |shard| {
            let mut taken = Vec::new();
            for each in hashes {
                if let Some(found) = shard.find_mut(&each.id) {
                    if found.photo.edited_ms == each.edited_ms {
                        found.photo.phash = Some(each.hash.clone());
                        taken.push(each.id.clone());
                    }
                }
            }
            Ok(taken)
        })
        .await?;
        if let Outcome::Done(taken, _) = outcome {
            kept.extend(taken);
        }
    }
    Ok(Response::json(200, &serde_json::json!({ "kept": kept })))
}

/// The words the page may keep for what a picture shows (`photos-scenes.ts`).
pub const SCENES: &[&str] = &[
    "Airplanes",
    "Beach",
    "Bicycles",
    "Birds",
    "Boats",
    "Bridges",
    "Buildings",
    "Cars",
    "Cats",
    "Dogs",
    "Flowers",
    "Food",
    "Lake",
    "Mountains",
    "Snow",
    "Trains",
];

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct SceneScan {
    id: String,
    scenes: Vec<String>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct SceneScans {
    scans: Vec<SceneScan>,
}

/// `POST /scenes`: keeps what the page read in each photo's thumbnail. Answers the ids that have it
/// now; a shard that cannot take it stays as it is, and the page looks again next time.
async fn keep_scenes(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let body = match cx.request.json::<SceneScans>() {
        Ok(body) => body,
        Err(refused) => return Ok(refused),
    };
    if body.scans.len() > MAX_HASHES {
        return Ok(Response::error(
            400,
            &format!("at most {MAX_HASHES} scans at once"),
        ));
    }
    let unknown = body
        .scans
        .iter()
        .flat_map(|scan| &scan.scenes)
        .find(|scene| !SCENES.contains(&scene.as_str()));
    if let Some(bad) = unknown {
        return Ok(Response::error(400, &format!("{bad:?} is not a scene")));
    }
    if body
        .scans
        .iter()
        .any(|scan| scan.scenes.len() > SCENES.len())
    {
        return Ok(Response::error(400, "a picture names a scene twice"));
    }
    let mut shards: BTreeMap<String, Vec<SceneScan>> = BTreeMap::new();
    for each in body.scans {
        shards.entry(shard_of(&each.id)).or_default().push(each);
    }
    let mut kept = Vec::new();
    let mut space = cx.storage.user();
    for (key, scans) in &shards {
        let outcome = mutate_shard(&mut space, key, |shard| {
            let mut taken = Vec::new();
            for each in scans {
                if let Some(found) = shard.find_mut(&each.id) {
                    found.photo.scenes = Some(each.scenes.clone());
                    taken.push(each.id.clone());
                }
            }
            Ok(taken)
        })
        .await?;
        if let Outcome::Done(taken, _) = outcome {
            kept.extend(taken);
        }
    }
    Ok(Response::json(200, &serde_json::json!({ "kept": kept })))
}

/// A face's box as the page found it.
#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct FoundFace {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    score: f64,
}

impl FoundFace {
    fn valid(&self) -> bool {
        let share = |value: f64| (0.0..=1.0).contains(&value);
        share(self.x)
            && share(self.y)
            && share(self.score)
            && self.width > 0.0
            && self.height > 0.0
            && share(self.x + self.width)
            && share(self.y + self.height)
    }
}

/// What the page found in one thumbnail, of the photo as of its `edited_ms`.
#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct FaceScan {
    id: String,
    #[serde(default)]
    edited_ms: Option<u64>,
    faces: Vec<FoundFace>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct FaceScans {
    scans: Vec<FaceScan>,
}

/// Whether two edits show the same frame of the picture, so that a box in one fits the other.
fn same_frame(a: Option<&Edit>, b: Option<&Edit>) -> bool {
    let original = Edit::default();
    let frame = |edit: Option<&Edit>| {
        let edit = edit.unwrap_or(&original);
        (
            edit.rotate,
            edit.flip,
            edit.straighten,
            edit.vertical,
            edit.horizontal,
            edit.crop.clone(),
            edit.external.clone(),
        )
    };
    frame(a) == frame(b)
}

/// `POST /faces`: keeps the faces found in each photo, unless the photo was edited since it was
/// looked at. Two pages looking at once find one answer standing, and each hears it. A photo with
/// one face and one person already named gets that name on the face.
async fn keep_faces(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let body = match cx.request.json::<FaceScans>() {
        Ok(body) => body,
        Err(refused) => return Ok(refused),
    };
    if body.scans.len() > MAX_FACE_SCANS {
        return Ok(Response::error(
            400,
            &format!("at most {MAX_FACE_SCANS} photos at once"),
        ));
    }
    for scan in &body.scans {
        if scan.faces.len() > MAX_PHOTO_FACES {
            return Ok(Response::error(
                400,
                &format!("a photo keeps at most {MAX_PHOTO_FACES} faces"),
            ));
        }
        if !scan.faces.iter().all(FoundFace::valid) {
            return Ok(Response::error(400, "a face's box is outside its picture"));
        }
    }
    let mut shards: BTreeMap<String, Vec<FaceScan>> = BTreeMap::new();
    for scan in body.scans {
        shards.entry(shard_of(&scan.id)).or_default().push(scan);
    }
    let mut kept = Vec::new();
    let mut space = cx.storage.user();
    for (key, scans) in &shards {
        let outcome = mutate_shard(&mut space, key, |shard| {
            let mut taken = Vec::new();
            for scan in scans {
                let Some(found) = shard.find_mut(&scan.id) else {
                    continue;
                };
                let photo = &mut found.photo;
                if photo.edited_ms != scan.edited_ms {
                    continue;
                }
                if photo.faces.is_none() {
                    let mut faces: Vec<Face> = scan
                        .faces
                        .iter()
                        .zip(0..)
                        .map(|(each, id)| Face {
                            id,
                            x: each.x,
                            y: each.y,
                            width: each.width,
                            height: each.height,
                            score: each.score,
                            name: None,
                            not_a_face: false,
                        })
                        .collect();
                    if let ([face], [name]) = (faces.as_mut_slice(), photo.people.as_slice()) {
                        face.name = Some(name.clone());
                    }
                    photo.faces = Some(faces);
                }
                taken.push(serde_json::json!({ "id": photo.id, "faces": photo.faces }));
            }
            Ok(taken)
        })
        .await?;
        if let Outcome::Done(taken, _) = outcome {
            kept.extend(taken);
        }
    }
    Ok(Response::json(200, &serde_json::json!({ "kept": kept })))
}

/// The drive file a photo's edit stands on, if it stands on one.
fn external_of(photo: &Photo) -> Option<String> {
    photo.edit.as_ref().and_then(|edit| edit.external.clone())
}

async fn delete_photo(space: &mut Space<'_>, id: &str) -> io::Result<Response> {
    // `file` is the original the page may now remove from the drive, or null when
    // this request did not delete it.
    let outcome = mutate_shard(space, &shard_of(id), |shard| {
        let external = shard
            .photos
            .iter()
            .find(|kept| kept.photo.id == id)
            .and_then(|kept| external_of(&kept.photo));
        let (ids, released) = shard.remove(|kept| kept.photo.id == id);
        Ok((!ids.is_empty(), released.into_iter().next(), external))
    })
    .await?;
    let (deleted, file, external) = match outcome {
        Outcome::Done(done, _) => done,
        Outcome::Refused(refused) => return Ok(refused),
    };
    let shards = read_shards(space).await?;
    let file = file.filter(|file| !names_file(&shards, file));
    // Only what this call removed: a resend that deleted nothing changes nothing.
    if deleted {
        let gone = BTreeSet::from([id.to_string()]);
        if let Outcome::Refused(refused) = mutate_index(space, |index| {
            index.forget_photos(&gone);
            Ok(())
        })
        .await?
        {
            return Ok(refused);
        }
    }
    Ok(Response::json(
        200,
        &serde_json::json!({ "deleted": deleted, "file": file, "external": external }),
    ))
}

async fn thumbs(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let ids = split_ids(cx.request.query_param("ids").unwrap_or(""));
    if ids.len() > THUMBS_PER_REQUEST {
        return Ok(Response::error(
            400,
            &format!("at most {THUMBS_PER_REQUEST} thumbnails a request"),
        ));
    }
    if !ids.iter().all(|id| valid_id(id)) {
        return Ok(bad_id());
    }
    let mut space = cx.storage.user();
    let mut found = serde_json::Map::new();
    // A thumbnail whose key is gone was replaced by a change that committed
    // after the shard was read (an edit or a revert deletes the key it
    // stopped naming): the shard is read again and its new key tried. A key
    // the shard still names on the next read is missing for good.
    let mut pending: Vec<(String, Option<String>)> = ids.into_iter().map(|id| (id, None)).collect();
    for _ in 0..ATTEMPTS {
        if pending.is_empty() {
            break;
        }
        let mut shards: BTreeMap<String, Shard> = BTreeMap::new();
        let mut again = Vec::new();
        for (id, tried) in pending {
            let home = shard_of(&id);
            if !shards.contains_key(&home) {
                let (shard, _) = read(&mut space, &home).await?;
                shards.insert(home.clone(), shard);
            }
            let Some(kept) = shards.get(&home).and_then(|shard| shard.find(&id)) else {
                continue;
            };
            let key = kept.edited_thumb.as_ref().unwrap_or(&kept.thumb).clone();
            if tried.as_deref() == Some(key.as_str()) {
                continue;
            }
            match space.get(&key).await? {
                Some(bytes) => {
                    found.insert(id, ferrite_app::crypto::base64url_encode(&bytes).into());
                }
                None => again.push((id, Some(key))),
            }
        }
        pending = again;
    }
    Ok(Response::json(200, &serde_json::json!({ "thumbs": found })))
}

async fn add_album(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let new: NewAlbum = match cx.request.json() {
        Ok(new) => new,
        Err(refused) => return Ok(refused),
    };
    if !valid_id(&new.id) {
        return Ok(bad_id());
    }
    let name = match clean_name(&new.name, MAX_ALBUM_NAME_CHARS) {
        Ok(name) => name,
        Err(message) => return Ok(Response::error(400, &message)),
    };
    let now_ms = cx.now_ms;
    let outcome = mutate_index(&mut cx.storage.user(), |index| {
        if index.albums.iter().any(|a| a.id == new.id) {
            return Ok(200);
        }
        if index.albums.len() >= MAX_ALBUMS {
            return Err(Response::error(
                409,
                &format!("a library has at most {MAX_ALBUMS} albums"),
            ));
        }
        let folder = new
            .folder
            .clone()
            .filter(|folder| index.folders.iter().any(|f| &f.id == folder));
        index.albums.push(Album {
            id: new.id.clone(),
            name: name.clone(),
            photos: Vec::new(),
            created_ms: now_ms,
            sort: custom_sort(),
            key_photo: None,
            folder,
        });
        Ok(201)
    })
    .await?;
    Ok(match outcome {
        Outcome::Done(status, index) => organised_reply(&index, status),
        Outcome::Refused(refused) => refused,
    })
}

async fn change_album(cx: &mut ApiCtx<'_>, id: &str) -> io::Result<Response> {
    let body: AlbumChange = match cx.request.json() {
        Ok(body) => body,
        Err(refused) => return Ok(refused),
    };
    let name = match body
        .name
        .as_deref()
        .map(|n| clean_name(n, MAX_ALBUM_NAME_CHARS))
    {
        Some(Err(message)) => return Ok(Response::error(400, &message)),
        Some(Ok(name)) => Some(name),
        None => None,
    };
    if body.add.len() + body.remove.len() > MAX_ALBUM_CHANGE {
        return Ok(Response::error(
            400,
            &format!("one change names at most {MAX_ALBUM_CHANGE} photos"),
        ));
    }
    if !body.add.iter().chain(&body.remove).all(|p| valid_id(p)) {
        return Ok(bad_id());
    }
    if let Some(sort) = &body.sort {
        if !ALBUM_SORTS.contains(&sort.as_str()) {
            return Ok(Response::error(
                400,
                &format!("{sort:?} is not an order an album sorts by"),
            ));
        }
    }
    if let Some(from) = &body.from {
        if !valid_id(from) {
            return Ok(bad_id());
        }
        if from == id {
            return Ok(Response::error(
                400,
                "photos are moved from another album than the one they go to",
            ));
        }
    }
    let mut space = cx.storage.user();
    // Only photos the library keeps, and not in Recently Deleted, are added.
    let mut shards: BTreeMap<String, Shard> = BTreeMap::new();
    for photo in &body.add {
        let home = shard_of(photo);
        if !shards.contains_key(&home) {
            let (shard, _) = read(&mut space, &home).await?;
            shards.insert(home.clone(), shard);
        }
        if !shards
            .get(&home)
            .and_then(|shard| shard.find(photo))
            .is_some_and(|kept| kept.photo.deleted_ms.is_none())
        {
            return Ok(Response::error(
                404,
                &format!("the library has no photo {photo:?} to add"),
            ));
        }
    }
    let outcome = mutate_index(&mut space, |index| {
        if !index.albums.iter().any(|a| a.id == id) {
            return Err(Response::not_found());
        }
        if let Some(Some(folder)) = &body.folder {
            if !index.folders.iter().any(|f| &f.id == folder) {
                return Err(Response::error(404, "the library has no such folder"));
            }
        }
        // A move: the photos leave the other album in the same write, so they
        // are never in neither album nor, after the write, in both.
        if let Some(from) = &body.from {
            let Some(source) = index.albums.iter_mut().find(|a| &a.id == from) else {
                return Err(Response::error(
                    404,
                    &format!("the library has no album {from:?} to move from"),
                ));
            };
            source.photos.retain(|p| !body.add.contains(p));
        }
        let Some(album) = index.albums.iter_mut().find(|a| a.id == id) else {
            return Err(Response::not_found());
        };
        if let Some(name) = &name {
            album.name = name.clone();
        }
        if let Some(sort) = &body.sort {
            album.sort = sort.clone();
        }
        if let Some(key_photo) = &body.key_photo {
            album.key_photo = key_photo.clone();
        }
        if let Some(folder) = &body.folder {
            album.folder = folder.clone();
        }
        album.photos.retain(|p| !body.remove.contains(p));
        for photo in &body.add {
            if !album.photos.contains(photo) {
                album.photos.push(photo.clone());
            }
        }
        // A new order takes only what the album holds; what it does not name
        // keeps its turn after them, so a stale order loses no photo.
        if let Some(order) = &body.order {
            let mut listed: Vec<String> = Vec::with_capacity(album.photos.len());
            for photo in order.iter().chain(album.photos.iter()) {
                if album.photos.contains(photo) && !listed.contains(photo) {
                    listed.push(photo.clone());
                }
            }
            album.photos = listed;
            album.sort = custom_sort();
        }
        if let Some(before) = &body.before {
            place(
                &mut index.albums,
                |a| a.id == id,
                before.as_deref(),
                |a| a.id.as_str(),
            );
        }
        Ok(())
    })
    .await?;
    Ok(match outcome {
        Outcome::Done((), index) => organised_reply(&index, 200),
        Outcome::Refused(refused) => refused,
    })
}

async fn delete_album(space: &mut Space<'_>, id: &str) -> io::Result<Response> {
    remove_from_index(space, |index| index.albums.retain(|a| a.id != id)).await
}

async fn remove_from_index(space: &mut Space<'_>, f: impl Fn(&mut Index)) -> io::Result<Response> {
    let outcome = mutate_index(space, |index| {
        f(index);
        Ok(())
    })
    .await?;
    Ok(match outcome {
        Outcome::Done((), index) => organised_reply(&index, 200),
        Outcome::Refused(refused) => refused,
    })
}

async fn add_folder(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let new: NewFolder = match cx.request.json() {
        Ok(new) => new,
        Err(refused) => return Ok(refused),
    };
    if !valid_id(&new.id) {
        return Ok(bad_id());
    }
    let name = match clean_name(&new.name, MAX_ALBUM_NAME_CHARS) {
        Ok(name) => name,
        Err(message) => return Ok(Response::error(400, &message)),
    };
    let now_ms = cx.now_ms;
    let outcome = mutate_index(&mut cx.storage.user(), |index| {
        if index.folders.iter().any(|f| f.id == new.id) {
            return Ok(200);
        }
        if index.folders.len() >= MAX_FOLDERS {
            return Err(Response::error(
                409,
                &format!("a library has at most {MAX_FOLDERS} folders"),
            ));
        }
        let parent = new
            .parent
            .clone()
            .filter(|parent| index.folders.iter().any(|f| &f.id == parent));
        index.folders.push(Folder {
            id: new.id.clone(),
            name: name.clone(),
            parent,
            created_ms: now_ms,
        });
        Ok(201)
    })
    .await?;
    Ok(match outcome {
        Outcome::Done(status, index) => organised_reply(&index, status),
        Outcome::Refused(refused) => refused,
    })
}

async fn change_folder(cx: &mut ApiCtx<'_>, id: &str) -> io::Result<Response> {
    let body: FolderChange = match cx.request.json() {
        Ok(body) => body,
        Err(refused) => return Ok(refused),
    };
    let name = match body
        .name
        .as_deref()
        .map(|n| clean_name(n, MAX_ALBUM_NAME_CHARS))
    {
        Some(Err(message)) => return Ok(Response::error(400, &message)),
        Some(Ok(name)) => Some(name),
        None => None,
    };
    let outcome = mutate_index(&mut cx.storage.user(), |index| {
        if !index.folders.iter().any(|f| f.id == id) {
            return Err(Response::not_found());
        }
        if let Some(Some(parent)) = &body.parent {
            if !index.folders.iter().any(|f| &f.id == parent) {
                return Err(Response::error(404, "the library has no such folder"));
            }
            if index.folder_tree(id).contains(parent) {
                return Err(Response::error(
                    409,
                    "a folder cannot go inside itself or a folder it holds",
                ));
            }
        }
        if let Some(folder) = index.folders.iter_mut().find(|f| f.id == id) {
            if let Some(name) = &name {
                folder.name = name.clone();
            }
            if let Some(parent) = &body.parent {
                folder.parent = parent.clone();
            }
        }
        if let Some(before) = &body.before {
            place(
                &mut index.folders,
                |f| f.id == id,
                before.as_deref(),
                |f| f.id.as_str(),
            );
        }
        Ok(())
    })
    .await?;
    Ok(match outcome {
        Outcome::Done((), index) => organised_reply(&index, 200),
        Outcome::Refused(refused) => refused,
    })
}

/// A folder goes with the albums and folders in it, as in Photos; their photos
/// stay in the library.
async fn delete_folder(space: &mut Space<'_>, id: &str) -> io::Result<Response> {
    remove_from_index(space, |index| {
        let tree = index.folder_tree(id);
        let held = |folder: &Option<String>| folder.as_ref().is_some_and(|f| tree.contains(f));
        index.albums.retain(|a| !held(&a.folder));
        index.smart_albums.retain(|a| !held(&a.folder));
        index.folders.retain(|f| !tree.contains(&f.id));
    })
    .await
}

async fn put_smart_album(cx: &mut ApiCtx<'_>, id: &str) -> io::Result<Response> {
    let mut album: SmartAlbum = match cx.request.json() {
        Ok(album) => album,
        Err(refused) => return Ok(refused),
    };
    album.name = match clean_name(&album.name, MAX_ALBUM_NAME_CHARS) {
        Ok(name) => name,
        Err(message) => return Ok(Response::error(400, &message)),
    };
    if album.rules.is_empty() || album.rules.len() > MAX_RULES {
        return Ok(Response::error(
            400,
            &format!("a smart album has 1 to {MAX_RULES} rules"),
        ));
    }
    for rule in &album.rules {
        if !RULE_FIELDS.contains(&rule.field.as_str()) || !RULE_OPS.contains(&rule.op.as_str()) {
            return Ok(Response::error(400, "that is not a rule of a smart album"));
        }
        if rule.value.chars().count() > MAX_RULE_VALUE_CHARS {
            return Ok(Response::error(400, "a rule's value is too long"));
        }
    }
    album.id = id.to_string();
    album.created_ms = cx.now_ms;
    let outcome = mutate_index(&mut cx.storage.user(), |index| {
        let mut next = album.clone();
        if next
            .folder
            .as_ref()
            .is_some_and(|folder| !index.folders.iter().any(|f| &f.id == folder))
        {
            next.folder = None;
        }
        if let Some(kept) = index.smart_albums.iter_mut().find(|a| a.id == id) {
            next.created_ms = kept.created_ms;
            *kept = next;
        } else if index.smart_albums.len() >= MAX_SMART_ALBUMS {
            return Err(Response::error(
                409,
                &format!("a library has at most {MAX_SMART_ALBUMS} smart albums"),
            ));
        } else {
            index.smart_albums.push(next);
        }
        Ok(())
    })
    .await?;
    Ok(match outcome {
        Outcome::Done((), index) => organised_reply(&index, 200),
        Outcome::Refused(refused) => refused,
    })
}

async fn set_keywords(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let body: KeywordList = match cx.request.json() {
        Ok(body) => body,
        Err(refused) => return Ok(refused),
    };
    if body.keywords.len() > MAX_KEYWORDS {
        return Ok(Response::error(
            400,
            &format!("the list holds at most {MAX_KEYWORDS} keywords"),
        ));
    }
    let mut list = Vec::with_capacity(body.keywords.len());
    for keyword in body.keywords {
        let name = match clean_name(&keyword.name, MAX_KEYWORD_CHARS) {
            Ok(name) => name,
            Err(message) => return Ok(Response::error(400, &message)),
        };
        if keyword
            .key
            .as_ref()
            .is_some_and(|key| key.chars().count() != 1)
        {
            return Ok(Response::error(400, "a keyword's key is one character"));
        }
        list.push(Keyword {
            name,
            key: keyword.key,
        });
    }
    remove_from_index(&mut cx.storage.user(), |index| {
        index.keywords.clone_from(&list);
    })
    .await
}

async fn put_project(cx: &mut ApiCtx<'_>, id: &str) -> io::Result<Response> {
    let mut project: Project = match cx.request.json() {
        Ok(project) => project,
        Err(refused) => return Ok(refused),
    };
    project.name = match clean_name(&project.name, MAX_ALBUM_NAME_CHARS) {
        Ok(name) => name,
        Err(message) => return Ok(Response::error(400, &message)),
    };
    if project.photos.len() > MAX_ALBUM_CHANGE || !project.photos.iter().all(|p| valid_id(p)) {
        return Ok(Response::error(400, "a slideshow names up to 500 photos"));
    }
    if !project.seconds.is_finite() || project.seconds < 0.0 || project.seconds > 600.0 {
        return Ok(Response::error(
            400,
            "a picture is shown for at most 600 seconds",
        ));
    }
    if project.theme.len() > 32 {
        return Ok(Response::error(400, "that is not a slideshow's theme"));
    }
    if let Some(music) = &project.music {
        if !valid_id(&music.file) || music.title.chars().count() > MAX_ALBUM_NAME_CHARS {
            return Ok(Response::error(400, "that is not a slideshow's song"));
        }
    }
    project.id = id.to_string();
    let outcome = mutate_index(&mut cx.storage.user(), |index| {
        if let Some(kept) = index.projects.iter_mut().find(|p| p.id == id) {
            *kept = project.clone();
        } else if index.projects.len() >= MAX_PROJECTS {
            return Err(Response::error(
                409,
                &format!("a library has at most {MAX_PROJECTS} slideshows"),
            ));
        } else {
            index.projects.push(project.clone());
        }
        Ok(())
    })
    .await?;
    Ok(match outcome {
        Outcome::Done((), index) => organised_reply(&index, 200),
        Outcome::Refused(refused) => refused,
    })
}

async fn set_settings(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let mut settings: serde_json::Value = match cx.request.json() {
        Ok(settings) => settings,
        Err(refused) => return Ok(refused),
    };
    let Some(object) = settings.as_object_mut() else {
        return Ok(Response::error(400, "the settings are an object"));
    };
    let base = object.remove("base").and_then(|base| base.as_u64());
    let bytes = to_json(&settings)?;
    if bytes.len() > MAX_SETTINGS_BYTES {
        return Ok(Response::error(413, "the settings are too large"));
    }
    let saved = document::write(&mut cx.storage.user(), WINDOW, base, Some(&settings)).await?;
    Ok(document::answer(
        saved,
        Some(&settings),
        |doc, rev| serde_json::json!({ "settings": doc, "rev": rev }),
    ))
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct MemoryChange {
    id: String,
    #[serde(default)]
    favorite: Option<bool>,
    #[serde(default)]
    deleted: Option<bool>,
    #[serde(default)]
    album: Option<bool>,
}

fn mark(list: &mut Vec<String>, id: &str, on: bool) {
    if !on {
        list.retain(|each| each != id);
    } else if !list.iter().any(|each| each == id) {
        list.push(id.to_string());
    }
}

async fn mark_memory(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let change: MemoryChange = match cx.request.json() {
        Ok(change) => change,
        Err(refused) => return Ok(refused),
    };
    if change.id.is_empty() || change.id.len() > MAX_MEMORY_ID_BYTES {
        return Ok(Response::error(400, "that is not a memory's id"));
    }
    let outcome = mutate_index(&mut cx.storage.user(), |index| {
        let id = change.id.as_str();
        let memories = &mut index.memories;
        if let Some(favorite) = change.favorite {
            mark(&mut memories.favorites, id, favorite);
        }
        if let Some(album) = change.album {
            mark(&mut memories.albums, id, album);
            if album {
                mark(&mut memories.deleted, id, false);
            }
        }
        if let Some(deleted) = change.deleted {
            mark(&mut memories.deleted, id, deleted);
            if deleted {
                mark(&mut memories.favorites, id, false);
                mark(&mut memories.albums, id, false);
            }
        }
        if [&memories.favorites, &memories.deleted, &memories.albums]
            .iter()
            .any(|list| list.len() > MAX_MEMORY_MARKS)
        {
            return Err(Response::error(
                409,
                &format!("a library keeps at most {MAX_MEMORY_MARKS} memories in a list"),
            ));
        }
        Ok(())
    })
    .await?;
    Ok(match outcome {
        Outcome::Done((), index) => organised_reply(&index, 200),
        Outcome::Refused(refused) => refused,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn photo(id: &str) -> Photo {
        Photo {
            id: id.into(),
            file: format!("file-{id}"),
            name: id.into(),
            mime: "image/jpeg".into(),
            bytes: 1,
            width: 1,
            height: 1,
            taken_ms: 0,
            added_ms: 0,
            source: "import".into(),
            effect: None,
            camera: None,
            favorite: false,
            deleted_ms: None,
            edit: None,
            edited_ms: None,
            title: None,
            caption: None,
            keywords: Vec::new(),
            people: Vec::new(),
            location: None,
            hidden: false,
            exif: None,
            duration_ms: None,
            phash: None,
            scenes: None,
            faces: None,
        }
    }

    fn kept(id: &str) -> Kept {
        Kept {
            photo: photo(id),
            thumb: format!("thumb/{id}/t"),
            edited_thumb: None,
        }
    }

    #[test]
    fn an_edit_is_checked_and_a_plain_one_is_no_edit() {
        let plain = Edit::default();
        assert!(plain.check().is_ok());
        assert!(plain.is_identity());
        let turned = Edit {
            rotate: 1,
            ..Edit::default()
        };
        assert!(!turned.is_identity());
        for bad in [
            Edit {
                rotate: 4,
                ..Edit::default()
            },
            Edit {
                straighten: 46.0,
                ..Edit::default()
            },
            Edit {
                vertical: 1.5,
                ..Edit::default()
            },
            Edit {
                horizontal: f64::NAN,
                ..Edit::default()
            },
            Edit {
                filter: "sparkle".into(),
                ..Edit::default()
            },
            Edit {
                adjust: Adjust {
                    exposure: f64::NAN,
                    ..Adjust::default()
                },
                ..Edit::default()
            },
            // Looks like the whole picture to `is_identity`, but is outside it.
            Edit {
                crop: Some(Crop {
                    x: -1.0,
                    y: 0.0,
                    width: 2.0,
                    height: 1.0,
                }),
                ..Edit::default()
            },
        ] {
            assert!(bad.check().is_err(), "{bad:?}");
        }
    }

    #[test]
    fn an_edit_keeps_its_perspective_and_writes_none_at_zero() {
        let tilted = Edit {
            vertical: 0.5,
            horizontal: -0.25,
            ..Edit::default()
        };
        assert_eq!(tilted.check(), Ok(()));
        assert!(!tilted.is_identity());
        let json = serde_json::to_string(&tilted).unwrap();
        assert!(json.contains(r#""vertical":0.5"#), "{json}");
        assert!(json.contains(r#""horizontal":-0.25"#), "{json}");
        assert_eq!(serde_json::from_str::<Edit>(&json).unwrap(), tilted);
        let plain = serde_json::to_string(&Edit::default()).unwrap();
        assert!(!plain.contains("vertical"), "{plain}");
        assert!(!plain.contains("horizontal"), "{plain}");
    }

    #[test]
    fn an_edit_that_stands_on_a_file_is_an_edit_and_names_it_by_id() {
        let saved = Edit {
            external: Some("file-1".into()),
            ..Edit::default()
        };
        assert_eq!(saved.check(), Ok(()));
        assert!(!saved.is_identity());
        let json = serde_json::to_string(&saved).unwrap();
        assert!(json.contains(r#""external":"file-1""#), "{json}");
        assert_eq!(serde_json::from_str::<Edit>(&json).unwrap(), saved);
        let plain = serde_json::to_string(&Edit::default()).unwrap();
        assert!(!plain.contains("external"), "{plain}");
        let odd = Edit {
            external: Some("../elsewhere".into()),
            ..Edit::default()
        };
        assert!(odd.check().is_err());
    }

    #[test]
    fn a_change_tells_a_revert_from_no_edit() {
        let revert: Change = serde_json::from_str(r#"{"edit":null}"#).unwrap();
        assert_eq!(revert.edit, Some(None));
        let none: Change = serde_json::from_str(r#"{"favorite":true}"#).unwrap();
        assert_eq!(none.edit, None);
        assert_eq!(none.favorite, Some(true));
        let unplaced: Change = serde_json::from_str(r#"{"location":null}"#).unwrap();
        assert_eq!(unplaced.location, Some(None));
    }

    #[test]
    fn names_are_trimmed_and_bounded() {
        assert_eq!(clean_name("  Beach\u{7}  ", 10).unwrap(), "Beach");
        assert!(clean_name("   ", 10).is_err());
        assert!(clean_name(&"a".repeat(11), 10).is_err());
        assert_eq!(clean_text("  ", 10).unwrap(), None);
        assert_eq!(clean_text(" a\nb ", 10).unwrap().as_deref(), Some("a\nb"));
    }

    #[test]
    fn an_edit_keeps_lines_drawn_with_markup_within_their_limits() {
        let line = |color: &str, points: usize| Stroke {
            color: color.into(),
            width: 0.01,
            points: vec![[0.5, 0.5]; points],
        };
        let with = |marks: Vec<Stroke>| Edit {
            marks,
            ..Edit::default()
        };
        let good = with(vec![line("#ff3b30", MAX_STROKE_POINTS)]);
        assert_eq!(good.check(), Ok(()));
        assert!(!good.is_identity());
        assert!(with(Vec::new()).is_identity());
        assert!(with(vec![line("red", 1)]).check().is_err());
        assert!(with(vec![line("#ff3b30", 0)]).check().is_err());
        assert!(with(vec![line("#ff3b30", MAX_STROKE_POINTS + 1)])
            .check()
            .is_err());
        assert!(with(vec![line("#ff3b30", 1); MAX_EDIT_STROKES + 1])
            .check()
            .is_err());
        let mut outside = line("#ff3b30", 1);
        outside.points[0][0] = 1.5;
        assert!(with(vec![outside]).check().is_err());
    }

    #[test]
    fn an_edit_keeps_levels_a_curve_and_spots_within_their_limits() {
        let spot = |x: f64, kind: &str| Spot {
            x,
            y: 0.5,
            radius: 0.02,
            kind: kind.into(),
        };
        let good = Edit {
            levels: Some(Levels {
                black: 0.1,
                gamma: 1.2,
                white: 0.9,
            }),
            curve: vec![[0.0, 0.0], [0.5, 0.6], [1.0, 1.0]],
            spots: vec![spot(0.2, "retouch"), spot(0.4, "red-eye")],
            ..Edit::default()
        };
        assert_eq!(good.check(), Ok(()));
        assert!(!good.is_identity());

        let bad_levels = Edit {
            levels: Some(Levels {
                black: 0.9,
                gamma: 1.0,
                white: 0.1,
            }),
            ..Edit::default()
        };
        assert!(bad_levels.check().is_err());
        let falling_curve = Edit {
            curve: vec![[0.5, 0.5], [0.2, 0.2]],
            ..Edit::default()
        };
        assert!(falling_curve.check().is_err());
        let red = Edit {
            channels: Some(Channels {
                red: Some(ChannelTone {
                    levels: None,
                    curve: vec![[0.5, 0.75]],
                }),
                ..Channels::default()
            }),
            ..Edit::default()
        };
        assert_eq!(red.check(), Ok(()));
        assert!(!red.is_identity(), "one colour's curve is an edit");
        let text = serde_json::to_string(&red).unwrap();
        assert_eq!(serde_json::from_str::<Edit>(&text).unwrap(), red);
        let bad_channel = Edit {
            channels: Some(Channels {
                blue: Some(ChannelTone {
                    levels: Some(Levels {
                        black: 0.9,
                        gamma: 1.0,
                        white: 0.1,
                    }),
                    curve: Vec::new(),
                }),
                ..Channels::default()
            }),
            ..Edit::default()
        };
        assert!(bad_channel.check().is_err());
        let reds = Edit {
            selective: Some(Selective {
                red: Some(BandShift {
                    hue: 0.5,
                    saturation: -1.0,
                    luminance: 0.0,
                }),
                ..Selective::default()
            }),
            ..Edit::default()
        };
        assert_eq!(reds.check(), Ok(()));
        assert!(!reds.is_identity(), "a range's shift is an edit");
        let text = serde_json::to_string(&reds).unwrap();
        assert_eq!(serde_json::from_str::<Edit>(&text).unwrap(), reds);
        let too_far = Edit {
            selective: Some(Selective {
                blue: Some(BandShift {
                    hue: 2.0,
                    saturation: 0.0,
                    luminance: 0.0,
                }),
                ..Selective::default()
            }),
            ..Edit::default()
        };
        assert!(too_far.check().is_err());
        let odd_spot = Edit {
            spots: vec![spot(0.2, "blur")],
            ..Edit::default()
        };
        assert!(odd_spot.check().is_err());
        let too_many = Edit {
            spots: vec![spot(0.2, "retouch"); MAX_EDIT_SPOTS + 1],
            ..Edit::default()
        };
        assert!(too_many.check().is_err());
    }

    #[test]
    fn an_edit_kept_before_levels_reads_back_and_writes_no_more() {
        let old = r#"{"rotate":1,"flip":false,"straighten":0.0,"crop":null,"filter":"none"}"#;
        let edit: Edit = ferrite_app::serde_json::from_str(old).unwrap();
        assert_eq!(edit.rotate, 1);
        assert!(edit.spots.is_empty());
        let written = to_json(&edit).unwrap();
        let text = String::from_utf8_lossy(&written);
        assert!(!text.contains("levels") && !text.contains("curve") && !text.contains("spots"));
    }

    #[test]
    fn people_lose_repeats_ignoring_case_within_the_limit() {
        let kept = clean_people(&["Ann".into(), "ann".into(), " Bo ".into()]).unwrap();
        assert_eq!(kept, ["Ann", "Bo"]);
        let many: Vec<String> = (0..=MAX_PHOTO_PEOPLE).map(|n| format!("p{n}")).collect();
        assert!(clean_people(&many).is_err());
    }

    #[test]
    fn keywords_lose_repeats_ignoring_case() {
        let kept = clean_keywords(&["Beach".into(), "beach".into(), " Sun ".into()]).unwrap();
        assert_eq!(kept, ["Beach", "Sun"]);
        assert!(clean_keywords(&["".into()]).is_err());
    }

    #[test]
    fn thumbnails_are_small_base64_jpegs() {
        assert_eq!(
            decode_thumb("/9j/4AA=").unwrap(),
            vec![0xFF, 0xD8, 0xFF, 0xE0, 0x00]
        );
        assert_eq!(decode_thumb("iVBORw==").unwrap_err().status, 400);
        assert_eq!(decode_thumb("not base64!").unwrap_err().status, 400);
    }

    #[test]
    fn id_lists_split_at_plain_and_encoded_commas() {
        assert_eq!(split_ids("a,b%2Cc,,d"), ["a", "b", "c", "d"]);
        assert!(split_ids("").is_empty());
    }

    #[test]
    fn image_keys_are_never_shared() {
        let a = fresh_key(THUMB, "p");
        let b = fresh_key(THUMB, "p");
        assert!(a.starts_with("thumb/p/"));
        assert_ne!(a, b);
    }

    #[test]
    fn a_hash_is_22_lower_case_hex_digits() {
        assert!(valid_hash("0123456789abcdef012345"));
        assert!(!valid_hash("0123456789abcdef01234"));
        assert!(!valid_hash("0123456789ABCDEF012345"));
        assert!(!valid_hash("0123456789abcdef01234g"));
    }

    #[test]
    fn recently_deleted_photos_expire_after_thirty_days() {
        let mut photo = photo("p");
        assert!(!expired(&photo, u64::MAX));
        photo.deleted_ms = Some(1_000);
        assert!(!expired(&photo, 1_000 + RECENTLY_DELETED_MS - 1));
        assert!(expired(&photo, 1_000 + RECENTLY_DELETED_MS));
    }

    #[test]
    fn a_deleted_photo_leaves_its_images_and_hands_its_file_to_purge_once() {
        let mut shard = Shard {
            photos: vec![kept("a"), kept("b")],
            ..Shard::default()
        };
        shard.photos[1].edited_thumb = Some("thumb/b/e".into());
        assert_eq!(shard.images().len(), 3);
        assert_eq!(shard.remove(|k| k.photo.id == "b").1, ["file-b"]);
        assert_eq!(shard.remove(|k| k.photo.id == "b").1, Vec::<String>::new());
        assert_eq!(shard.purge, ["file-b"]);
        assert_eq!(
            shard.images().into_iter().collect::<Vec<_>>(),
            ["thumb/a/t"]
        );
    }

    #[test]
    fn a_full_library_of_rich_records_spreads_over_shards_that_fit() {
        let mut shards: BTreeMap<String, Shard> = BTreeMap::new();
        for n in 0..5_000 {
            let mut kept = kept(&format!("0000000{n:04}-aaaa-bbbb-cccc-dddddddddddd"));
            kept.photo.name = format!("IMG_{n:04} at the beach in October");
            kept.photo.file = format!("{n:032x}");
            kept.photo.camera = Some("Canon EOS R".into());
            kept.photo.title = Some("A title of ordinary length, as a person writes one".into());
            kept.photo.caption = Some("c".repeat(400));
            kept.photo.keywords = vec!["beach".into(), "family".into(), "october".into()];
            kept.photo.edit = Some(Edit::default());
            kept.thumb = format!("thumb/{}/{}", kept.photo.id, "f".repeat(32));
            shards
                .entry(shard_of(&kept.photo.id))
                .or_default()
                .photos
                .push(kept);
        }
        assert_eq!(shards.len(), SHARDS as usize, "every shard takes some");
        for (key, shard) in &shards {
            assert!(shard.photos.len() < MAX_SHARD_PHOTOS, "{key}");
            let bytes = to_json(shard).unwrap().len();
            assert!(bytes < MAX_LIBRARY_BYTES, "{key}: {bytes} bytes");
        }
        assert!(MAX_LIBRARY_BYTES < 200_000, "under the store's value limit");
    }

    #[test]
    fn a_folder_tree_holds_its_nested_folders_and_place_moves_items() {
        let folder = |id: &str, parent: Option<&str>| Folder {
            id: id.into(),
            name: id.into(),
            parent: parent.map(str::to_string),
            created_ms: 0,
        };
        let mut index = Index {
            folders: vec![
                folder("a", None),
                folder("b", Some("a")),
                folder("c", Some("b")),
                folder("d", None),
            ],
            ..Index::default()
        };
        let tree = index.folder_tree("a");
        assert_eq!(tree.into_iter().collect::<Vec<_>>(), ["a", "b", "c"]);
        place(
            &mut index.folders,
            |f| f.id == "d",
            Some("a"),
            |f| f.id.as_str(),
        );
        assert_eq!(index.folders[0].id, "d");
        place(&mut index.folders, |f| f.id == "d", None, |f| f.id.as_str());
        assert_eq!(index.folders[3].id, "d");
    }

    #[test]
    fn an_album_kept_before_sorting_existed_reads_as_custom() {
        let album: Album =
            serde_json::from_str(r#"{"id":"a","name":"A","photos":[],"created_ms":1}"#)
                .expect("an album without a sort still reads");
        assert_eq!(album.sort, "custom");
        assert!(ALBUM_SORTS.contains(&album.sort.as_str()));
    }

    #[test]
    fn a_document_past_its_bound_may_shrink_but_not_grow() {
        let small = Shard::default();
        assert!(fits(&vec![b' '; MAX_LIBRARY_BYTES], &small).is_ok());
        let refused = fits(&vec![b' '; MAX_LIBRARY_BYTES + 1], &small).unwrap_err();
        assert_eq!(refused.status, 413);
        let big = Shard {
            purge: vec!["x".repeat(MAX_LIBRARY_BYTES + 100)],
            ..Shard::default()
        };
        assert!(fits(&vec![b' '; MAX_LIBRARY_BYTES + 50], &big).is_ok());
    }
}

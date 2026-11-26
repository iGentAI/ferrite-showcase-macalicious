//! Preview's server half: the markup a person drew on each file of their
//! drive, kept beside the file (a sidecar), and the signatures they made.
//! The files themselves are on the person's drive (`src/apps/files`): the
//! browser reads them in pieces, renders them (images on a canvas, PDFs with
//! pdf.js) and burns markup into an exported or saved copy. This module only
//! keeps what the browser cannot keep in the file: shapes, text and
//! signatures that stay editable, and the rotation a PDF is viewed at.
//!
//! Every document uses the revision rule of `document.rs`:
//!
//! * `GET /api/preview/markup/<file id>`: `{"markup": {...} | null, "rev":
//!   n, "session": id}`; `null` before the first save and after a delete.
//! * `PUT /api/preview/markup/<file id>` with `{"markup": {...}, "rev": n}`:
//!   replaces it, or 409 with the current one.
//! * `DELETE /api/preview/markup/<file id>?rev=<n>[&session=<id>]`: forgets
//!   it, only at the revision the caller read (409 with the current markup
//!   otherwise; 200 when it is gone already), for a file the browser finds
//!   went away.
//! * `GET /api/preview/signatures` and `PUT /api/preview/signatures` with
//!   `{"signatures": [...], "rev": n}`: the person's signatures, at most
//!   [`MAX_SIGNATURES`].
//! * `GET /api/preview/places` and `PUT /api/preview/places` with
//!   `{"places": [...], "rev": n}`: where the person left each file they
//!   opened, newest first (`file`, `name`, `page`, `zoom`, `opened_ms`), at
//!   most [`MAX_PLACES`]. The window's Open Recent lists them, and on launch
//!   it reopens the first where it was left instead of showing the Open dialog.
//!
//! Markup is kept for at most [`MAX_SIDECARS`] files per person. The ids of
//! the files that have markup are listed in one more document, `index`,
//! changed only with compare-and-set, so the count holds however many
//! requests arrive at once. A save lists its file before writing the markup
//! and confirms the listing after, with a write to the index even when the
//! file is listed already; a file comes off the index only when, under the
//! index revision read first, its markup is found absent. So a removal racing
//! a save either sees the saved markup or loses its compare-and-set to the
//! save's confirmation, and a save that finds its listing gone and the index
//! full takes its markup back and answers 507. A listing whose save never
//! stored markup (a stale revision, a storage failure) is taken back at once
//! when possible, and in any case by the sweep a full index runs before it
//! refuses a file. A file id is only a name here: whether the drive still has
//! that file is the browser's to know, and it deletes the markup of a file it
//! finds gone.
//!
//! Coordinates are fractions of the page (or image): `0` is the left or top
//! edge, `1` the right or bottom edge, before the page is rotated for viewing.
//! A mark is one of:
//!
//! * `rect`, `oval`: the box `x, y, w, h`, drawn in `color` with a line of
//!   `stroke`, filled with `fill` when it has one;
//! * `mask`: the page dimmed outside the box `x, y, w, h`;
//! * `loupe`: the page magnified by `power` inside the oval of the box `x, y, w,
//!   h`, with a rim in `color`;
//! * `line`, `arrow`: from `(x, y)` to `(x + w, y + h)`, with `arrow_ends`
//!   saying which ends have a head (absent: an arrow's far end);
//! * `sketch`: a line through `points`, filled with `fill` when it has one; with
//!   `sides`, a polygon of that many sides; with `bubble`, a speech bubble that
//!   may say `text` in the style a `text` has;
//! * `text`: `text` in a box at `x, y` of width `w`, at `size` (a fraction of
//!   the page's width), in `font`, `bold`, `italic`, `underline` and aligned by
//!   `align`, and `turns`, the
//!   quarter turns the page was viewed at when it was typed: it is drawn turned
//!   back by those, and `w`, `h` run against the page's axes where that view's
//!   do; `mirrored`, when the page was viewed mirrored, is drawn mirrored back
//!   the same way;
//! * `signature`: `strokes`, each a line through points given as fractions of
//!   the box `x, y, w, h`;
//! * `highlight`, `underline`, `strikethrough`: `rects`, a box `[x, y, w, h]`
//!   for each line of a PDF's text it covers, with `text`, the words, and
//!   `x, y, w, h` the box around them all;
//! * `note`: `text` in a note whose icon is the box `x, y, w, h`.
//!
//! A `rect`, `oval`, `line`, `arrow` or `sketch` may have `dash` and `shadow`.
//!
//! A file's markup may have `order`: for each page shown, the file's page it
//! draws, or 0 for a blank page. `pages` then go by the page shown. It may have
//! `turns`: for each page shown, the quarter turns it stands at beyond
//! `rotation`. It may have `keywords`, the words the Inspector lists for the
//! file, at most [`MAX_KEYWORDS`].

use std::collections::BTreeSet;

use ferrite_app::{serde, serde_json};

use super::document::{self, Saved};
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};

pub const MODULE: AppModule = AppModule {
    name: "preview",
    title: "Preview",
    handle,
};

/// Files whose markup is kept, per person: the drive's own limit of entries.
pub const MAX_SIDECARS: usize = 1000;
/// Marks one file's markup holds, on all its pages together.
pub const MAX_MARKS: usize = 500;
/// Points one sketch or one signature holds.
pub const MAX_POINTS: usize = 4000;
/// Points one file's markup holds, on all its pages together.
pub const MAX_TOTAL_POINTS: usize = 20_000;
/// Strokes one signature holds.
pub const MAX_STROKES: usize = 64;
/// Lines of text one highlight, underline or strikethrough covers.
pub const MAX_RECTS: usize = 256;
/// The longest text of one mark, in characters.
pub const MAX_TEXT: usize = 2000;
/// The highest page number a mark may name.
pub const MAX_PAGE: u32 = 5000;
/// Signatures one person keeps.
pub const MAX_SIGNATURES: usize = 10;
/// Files whose place one person keeps (Open Recent).
pub const MAX_PLACES: usize = 20;
/// The longest name of a file in a place, in characters.
pub const MAX_NAME: usize = 255;
/// Keywords one file keeps.
pub const MAX_KEYWORDS: usize = 100;
/// The longest keyword, in characters.
pub const MAX_KEYWORD: usize = 100;
/// How a line may be broken up.
pub const DASHES: [&str; 2] = ["dashed", "dotted"];
/// Which ends of a line may have a head.
pub const ARROW_ENDS: [&str; 4] = ["none", "start", "end", "both"];
/// Whether a text's font names a family: the page's Fonts panel lists many,
/// and the browser showing it draws the ones it has.
pub fn is_font_name(font: &str) -> bool {
    let mut chars = font.chars();
    font.len() <= 64
        && chars.next().is_some_and(|c| c.is_ascii_alphanumeric())
        && chars.all(|c| c.is_ascii_alphanumeric() || " .'-".contains(c))
}
/// How a text's lines may stand in its box.
pub const ALIGNMENTS: [&str; 3] = ["left", "center", "right"];

const INDEX_KEY: &str = "index";
const SIGNATURES_KEY: &str = "signatures";
const PLACES_KEY: &str = "places";
/// Compare-and-set attempts on the index before a write answers 503.
const ATTEMPTS: usize = 8;

/// Whether an optional field is absent, so it is left out of the JSON (a plain
/// function: the hosted code gate takes no qualified paths in serde attributes).
fn absent<T>(value: &Option<T>) -> bool {
    value.is_none()
}

/// What a mark is.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum Kind {
    Rect,
    Oval,
    Mask,
    Loupe,
    Line,
    Arrow,
    Sketch,
    Text,
    Signature,
    Highlight,
    Underline,
    Strikethrough,
    Note,
}

/// A point, as fractions of the page or of a signature's box.
pub type Point = [f64; 2];

/// One mark on a page.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Mark {
    /// The browser's id of the mark, unique within the file's markup.
    pub id: String,
    pub kind: Kind,
    /// `#rrggbb`.
    pub color: String,
    /// `#rrggbb`, for a filled box.
    #[serde(default, skip_serializing_if = "absent")]
    pub fill: Option<String>,
    /// The width of the line, as a fraction of the page's width.
    pub stroke: f64,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    #[serde(default, skip_serializing_if = "absent")]
    pub points: Option<Vec<Point>>,
    #[serde(default, skip_serializing_if = "absent")]
    pub strokes: Option<Vec<Vec<Point>>>,
    /// A box `[x, y, w, h]` for each line a highlight, underline or strikethrough covers.
    #[serde(default, skip_serializing_if = "absent")]
    pub rects: Option<Vec<[f64; 4]>>,
    #[serde(default, skip_serializing_if = "absent")]
    pub text: Option<String>,
    /// The text's size, as a fraction of the page's width.
    #[serde(default, skip_serializing_if = "absent")]
    pub size: Option<f64>,
    /// The quarter turns the page was viewed at when a text was typed, 1 to 3.
    #[serde(default, skip_serializing_if = "absent")]
    pub turns: Option<u8>,
    /// `true` when the page was viewed mirrored as a text was typed.
    #[serde(default, skip_serializing_if = "absent")]
    pub mirrored: Option<bool>,
    /// One of [`DASHES`]; absent is a solid line.
    #[serde(default, skip_serializing_if = "absent")]
    pub dash: Option<String>,
    /// `true` when a shape casts a shadow.
    #[serde(default, skip_serializing_if = "absent")]
    pub shadow: Option<bool>,
    /// One of [`ARROW_ENDS`].
    #[serde(default, skip_serializing_if = "absent")]
    pub arrow_ends: Option<String>,
    /// One of [`FONTS`]; absent is the system's.
    #[serde(default, skip_serializing_if = "absent")]
    pub font: Option<String>,
    /// One of [`ALIGNMENTS`]; absent is left.
    #[serde(default, skip_serializing_if = "absent")]
    pub align: Option<String>,
    /// `true` when a text is bold.
    #[serde(default, skip_serializing_if = "absent")]
    pub bold: Option<bool>,
    /// `true` when a text is italic.
    #[serde(default, skip_serializing_if = "absent")]
    pub italic: Option<bool>,
    /// `true` when a text is underlined.
    #[serde(default, skip_serializing_if = "absent")]
    pub underline: Option<bool>,
    /// How many sides a polygon sketch has, 3 to 12.
    #[serde(default, skip_serializing_if = "absent")]
    pub sides: Option<u8>,
    /// How far a loupe magnifies, 1 to 5.
    #[serde(default, skip_serializing_if = "absent")]
    pub power: Option<f64>,
    /// `true` when a sketch is a speech bubble, whose `text` is what it says.
    #[serde(default, skip_serializing_if = "absent")]
    pub bubble: Option<bool>,
}

/// The marks of one page.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct PageMarks {
    /// From 1; an image is page 1.
    pub page: u32,
    pub items: Vec<Mark>,
}

/// One file's markup.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Markup {
    /// Quarter turns clockwise the file is viewed at (a PDF's pages), 0 to 3.
    pub rotation: u8,
    pub pages: Vec<PageMarks>,
    /// For each page shown, the file's page it draws (from 1), or 0 for a blank
    /// page; absent is the file's own pages in their own order.
    #[serde(default, skip_serializing_if = "absent")]
    pub order: Option<Vec<u32>>,
    /// For each page shown, the quarter turns it stands at beyond `rotation`, 0 to 3.
    #[serde(default, skip_serializing_if = "absent")]
    pub turns: Option<Vec<u8>>,
    /// The file's keywords.
    #[serde(default, skip_serializing_if = "absent")]
    pub keywords: Option<Vec<String>>,
}

/// One signature: strokes in a box of `aspect` (width over height).
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Signature {
    pub id: String,
    pub aspect: f64,
    pub strokes: Vec<Vec<Point>>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct MarkupBody {
    markup: Markup,
    rev: u64,
    #[serde(default)]
    session: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct SignaturesBody {
    signatures: Vec<Signature>,
    rev: u64,
    #[serde(default)]
    session: Option<String>,
}

/// Where a person left a file they opened: its page and zoom, and when they
/// opened it. Its name is kept so Open Recent can list it without reading the
/// drive; the window checks the file is still there before reopening it.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Place {
    pub file: String,
    pub name: String,
    pub page: u32,
    pub zoom: f64,
    /// How a PDF's pages are laid out, one of [`DISPLAYS`]; continuous when left out.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display: Option<String>,
    pub opened_ms: u64,
}

/// The ways a place may lay out a PDF's pages.
pub const DISPLAYS: [&str; 4] = ["continuous", "single", "two", "contact"];

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct PlacesBody {
    places: Vec<Place>,
    rev: u64,
    #[serde(default)]
    session: Option<String>,
}

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

fn markup_key(file: &str) -> String {
    format!("markup/{file}")
}

fn storage_failed(error: std::io::Error) -> Response {
    ferrite_app::tracing::warn!(%error, "preview: storage failed");
    Response::error(503, "Preview's storage could not be reached; retry")
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    let method = cx.request.method;
    let path = cx.request.path;
    let parts: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
    match (method, parts.as_slice()) {
        ("GET", ["markup", file]) if document::valid_key(file) => get_markup(&mut cx, file).await,
        ("PUT", ["markup", file]) if document::valid_key(file) => put_markup(&mut cx, file).await,
        ("DELETE", ["markup", file]) if document::valid_key(file) => {
            delete_markup(&mut cx, file).await
        }
        (_, ["markup", file]) if document::valid_key(file) => Response::method_not_allowed(),
        ("GET", ["signatures"]) => get_signatures(&mut cx).await,
        ("PUT", ["signatures"]) => put_signatures(&mut cx).await,
        (_, ["signatures"]) => Response::method_not_allowed(),
        ("GET", ["places"]) => get_places(&mut cx).await,
        ("PUT", ["places"]) => put_places(&mut cx).await,
        (_, ["places"]) => Response::method_not_allowed(),
        _ => Response::not_found(),
    }
}

fn markup_reply(markup: Option<&Markup>, rev: u64) -> serde_json::Value {
    serde_json::json!({ "markup": markup, "rev": rev })
}

fn signatures_reply(signatures: Option<&Vec<Signature>>, rev: u64) -> serde_json::Value {
    serde_json::json!({ "signatures": signatures, "rev": rev })
}

fn places_reply(places: Option<&Vec<Place>>, rev: u64) -> serde_json::Value {
    serde_json::json!({ "places": places, "rev": rev })
}

async fn get_markup(cx: &mut ApiCtx<'_>, file: &str) -> Response {
    match document::read::<Markup>(&mut cx.storage.user(), &markup_key(file)).await {
        Ok(current) => {
            document::for_session(markup_reply(current.doc.as_ref(), current.rev), cx.session)
        }
        Err(error) => storage_failed(error),
    }
}

/// Whether the index has room for a file.
enum Listed {
    Yes,
    Full,
}

/// Lists `file` in the index of files with markup, unless the index already
/// holds [`MAX_SIDECARS`] other files, and writes the index even when the
/// file is listed already: the new revision makes any removal based on an
/// earlier read of the index fail and look again.
async fn claim(cx: &mut ApiCtx<'_>, file: &str) -> std::io::Result<Listed> {
    for _ in 0..ATTEMPTS {
        let mut space = cx.storage.user();
        let current = document::read::<BTreeSet<String>>(&mut space, INDEX_KEY).await?;
        let mut index = current.doc.unwrap_or_default();
        if !index.contains(file) {
            if index.len() >= MAX_SIDECARS {
                return Ok(Listed::Full);
            }
            index.insert(file.to_string());
        }
        match document::write(&mut space, INDEX_KEY, Some(current.rev), Some(&index)).await? {
            Saved::Stored(_) => return Ok(Listed::Yes),
            Saved::Conflict(_) => continue,
        }
    }
    Err(std::io::Error::other("the index kept changing"))
}

/// Takes off the index every file of `files` (all listed files when `None`)
/// whose markup is absent, reading the markup after the index and writing the
/// index only if it is still at the revision read. Answers how many it took
/// off.
async fn unlist_absent(cx: &mut ApiCtx<'_>, files: Option<&str>) -> std::io::Result<usize> {
    for _ in 0..ATTEMPTS {
        let mut space = cx.storage.user();
        let current = document::read::<BTreeSet<String>>(&mut space, INDEX_KEY).await?;
        let mut index = current.doc.unwrap_or_default();
        let candidates: Vec<String> = match files {
            Some(file) if index.contains(file) => vec![file.to_string()],
            Some(_) => return Ok(0),
            None => index.iter().cloned().collect(),
        };
        let mut gone = 0;
        for file in candidates {
            let markup = document::read::<Markup>(&mut space, &markup_key(&file)).await?;
            if markup.doc.is_none() {
                index.remove(&file);
                gone += 1;
            }
        }
        if gone == 0 {
            return Ok(0);
        }
        match document::write(&mut space, INDEX_KEY, Some(current.rev), Some(&index)).await? {
            Saved::Stored(_) => return Ok(gone),
            Saved::Conflict(_) => continue,
        }
    }
    Err(std::io::Error::other("the index kept changing"))
}

fn full() -> Response {
    Response::error(
        507,
        &format!("Preview keeps markup for at most {MAX_SIDECARS} files"),
    )
}

async fn put_markup(cx: &mut ApiCtx<'_>, file: &str) -> Response {
    let body: MarkupBody = match cx.request.json() {
        Ok(body) => body,
        Err(reply) => return reply,
    };
    if let Err(message) = validate_markup(&body.markup) {
        return Response::error(400, &message);
    }
    if let Some(refused) = document::other_session(body.session.as_deref(), cx.session) {
        return refused;
    }
    let key = markup_key(file);
    // The markup this save replaces, kept to put back should the save be taken back below. A
    // save based on another revision is refused here, before anything is listed or written.
    let previous = match document::read::<Markup>(&mut cx.storage.user(), &key).await {
        Ok(previous) => previous,
        Err(error) => return storage_failed(error),
    };
    if previous.rev != body.rev {
        return document::answer(Saved::Conflict(previous), Some(&body.markup), markup_reply);
    }
    // List the file first; a full index first takes back listings that never
    // got markup.
    let listed = match claim(cx, file).await {
        Ok(Listed::Full) => match unlist_absent(cx, None).await {
            Ok(0) => Ok(Listed::Full),
            Ok(_) => claim(cx, file).await,
            Err(error) => Err(error),
        },
        other => other,
    };
    match listed {
        Ok(Listed::Yes) => {}
        Ok(Listed::Full) => return full(),
        Err(error) => return storage_failed(error),
    }
    let saved = match document::write(
        &mut cx.storage.user(),
        &key,
        Some(body.rev),
        Some(&body.markup),
    )
    .await
    {
        Ok(saved) => saved,
        Err(error) => {
            // The listing may hold no markup: take it back, as best it can be.
            let _ = unlist_absent(cx, Some(file)).await;
            return storage_failed(error);
        }
    };
    let rev = match saved {
        Saved::Stored(rev) => rev,
        Saved::Conflict(current) => {
            if current.doc.is_none() {
                let _ = unlist_absent(cx, Some(file)).await;
            }
            return document::answer(Saved::Conflict(current), Some(&body.markup), markup_reply);
        }
    };
    // Confirm the listing: a removal that raced the save either saw the
    // markup or loses to this write; one that won before it is undone here,
    // or, with the index full meanwhile, the markup is taken back.
    match claim(cx, file).await {
        Ok(Listed::Yes) => document::answer(Saved::Stored(rev), Some(&body.markup), markup_reply),
        // Not listed and no room, or the listing could not be confirmed: the save is taken
        // back, putting back the markup it replaced (none for a file's first markup), so no
        // markup is ever left off the index and none saved before is lost. A save made since
        // this one keeps its own.
        confirm => {
            let undone = document::write::<Markup>(
                &mut cx.storage.user(),
                &key,
                Some(rev),
                previous.doc.as_ref(),
            )
            .await;
            match (confirm, undone) {
                (Ok(_), Ok(_)) => full(),
                (Err(error), _) | (_, Err(error)) => storage_failed(error),
            }
        }
    }
}

async fn delete_markup(cx: &mut ApiCtx<'_>, file: &str) -> Response {
    // Forgets the markup the caller last read, never newer: `?rev=<n>` names
    // that revision, and `&session=<id>` the session, as a save's body does.
    let Some(base) = cx
        .request
        .query_param("rev")
        .and_then(|rev| rev.parse::<u64>().ok())
    else {
        return Response::error(400, "name the revision you read: ?rev=<n>");
    };
    if let Some(refused) = document::other_session(cx.request.query_param("session"), cx.session) {
        return refused;
    }
    let saved = match document::write::<Markup>(
        &mut cx.storage.user(),
        &markup_key(file),
        Some(base),
        None,
    )
    .await
    {
        Ok(saved) => saved,
        Err(error) => return storage_failed(error),
    };
    let saved = match saved {
        // Markup that is gone already is gone: nothing newer is lost.
        Saved::Conflict(current) if current.doc.is_none() => Saved::Stored(current.rev),
        // Markup saved since the caller read it is kept, and answered.
        Saved::Conflict(current) => {
            return document::answer(Saved::Conflict(current), None, markup_reply)
        }
        stored => stored,
    };
    // Unlisted only while it has no markup: a save at the delete's revision
    // that lands meanwhile keeps its listing.
    if let Err(error) = unlist_absent(cx, Some(file)).await {
        return storage_failed(error);
    }
    document::answer(saved, None, markup_reply)
}

async fn get_signatures(cx: &mut ApiCtx<'_>) -> Response {
    match document::read::<Vec<Signature>>(&mut cx.storage.user(), SIGNATURES_KEY).await {
        Ok(current) => document::for_session(
            signatures_reply(current.doc.as_ref(), current.rev),
            cx.session,
        ),
        Err(error) => storage_failed(error),
    }
}

async fn put_signatures(cx: &mut ApiCtx<'_>) -> Response {
    let body: SignaturesBody = match cx.request.json() {
        Ok(body) => body,
        Err(reply) => return reply,
    };
    if let Err(message) = validate_signatures(&body.signatures) {
        return Response::error(400, &message);
    }
    if let Some(refused) = document::other_session(body.session.as_deref(), cx.session) {
        return refused;
    }
    match document::write(
        &mut cx.storage.user(),
        SIGNATURES_KEY,
        Some(body.rev),
        Some(&body.signatures),
    )
    .await
    {
        Ok(saved) => document::answer(saved, Some(&body.signatures), signatures_reply),
        Err(error) => storage_failed(error),
    }
}

async fn get_places(cx: &mut ApiCtx<'_>) -> Response {
    match document::read::<Vec<Place>>(&mut cx.storage.user(), PLACES_KEY).await {
        Ok(current) => {
            document::for_session(places_reply(current.doc.as_ref(), current.rev), cx.session)
        }
        Err(error) => storage_failed(error),
    }
}

async fn put_places(cx: &mut ApiCtx<'_>) -> Response {
    let body: PlacesBody = match cx.request.json() {
        Ok(body) => body,
        Err(reply) => return reply,
    };
    if let Err(message) = validate_places(&body.places) {
        return Response::error(400, &message);
    }
    if let Some(refused) = document::other_session(body.session.as_deref(), cx.session) {
        return refused;
    }
    match document::write(
        &mut cx.storage.user(),
        PLACES_KEY,
        Some(body.rev),
        Some(&body.places),
    )
    .await
    {
        Ok(saved) => document::answer(saved, Some(&body.places), places_reply),
        Err(error) => storage_failed(error),
    }
}

/// Whether `color` is `#rrggbb`.
fn is_color(color: &str) -> bool {
    color.len() == 7 && color.starts_with('#') && color[1..].bytes().all(|b| b.is_ascii_hexdigit())
}

/// Whether `value` is a coordinate on or near the page: a mark may stand a
/// page's width outside it, no further.
fn is_coordinate(value: f64) -> bool {
    value.is_finite() && (-1.0..=2.0).contains(&value)
}

/// Whether `value` is the width or height of a box or a line's run.
fn is_extent(value: f64) -> bool {
    value.is_finite() && (-3.0..=3.0).contains(&value)
}

fn check_points(points: &[Point], inside_box: bool) -> Result<(), String> {
    if points.len() > MAX_POINTS {
        return Err(format!("a line has at most {MAX_POINTS} points"));
    }
    for [x, y] in points {
        let ok = if inside_box {
            x.is_finite() && y.is_finite() && (0.0..=1.0).contains(x) && (0.0..=1.0).contains(y)
        } else {
            is_coordinate(*x) && is_coordinate(*y)
        };
        if !ok {
            return Err("a point is outside the range a mark may have".into());
        }
    }
    Ok(())
}

fn check_strokes(strokes: &[Vec<Point>]) -> Result<usize, String> {
    if strokes.is_empty() || strokes.len() > MAX_STROKES {
        return Err(format!("a signature has 1 to {MAX_STROKES} strokes"));
    }
    let mut total = 0;
    for stroke in strokes {
        if stroke.is_empty() {
            return Err("a stroke of a signature has at least one point".into());
        }
        check_points(stroke, true)?;
        total += stroke.len();
    }
    if total > MAX_POINTS {
        return Err(format!("a signature has at most {MAX_POINTS} points"));
    }
    Ok(total)
}

/// Whether `text` is text a mark may hold: no control characters but line
/// breaks and tabs.
fn is_text(text: &str) -> bool {
    let count = text.chars().count();
    (1..=MAX_TEXT).contains(&count)
        && !text
            .chars()
            .any(|c| c.is_control() && c != '\n' && c != '\t')
}

/// Checks one mark; answers the points it holds.
fn check_mark(mark: &Mark) -> Result<usize, String> {
    if !document::valid_key(&mark.id) {
        return Err(format!("{:?} is not a mark id", mark.id));
    }
    if !is_color(&mark.color) || mark.fill.as_deref().is_some_and(|fill| !is_color(fill)) {
        return Err("a colour is written #rrggbb".into());
    }
    if !(mark.stroke.is_finite() && mark.stroke > 0.0 && mark.stroke <= 0.1) {
        return Err("a line's width is more than 0 and at most 0.1 of the page".into());
    }
    if !(is_coordinate(mark.x) && is_coordinate(mark.y) && is_extent(mark.w) && is_extent(mark.h)) {
        return Err("a mark's place is outside the range a mark may have".into());
    }
    let has_points = mark.points.is_some();
    let has_strokes = mark.strokes.is_some();
    let has_rects = mark.rects.is_some();
    let has_typing = mark.size.is_some() || mark.turns.is_some() || mark.mirrored.is_some();
    let has_text = mark.text.is_some() || has_typing;
    let drawn_line = matches!(
        mark.kind,
        Kind::Rect | Kind::Oval | Kind::Line | Kind::Arrow | Kind::Sketch
    );
    if (mark.dash.is_some() || mark.shadow.is_some()) && !drawn_line {
        return Err("only a shape has a line style or a shadow".into());
    }
    if mark
        .dash
        .as_deref()
        .is_some_and(|dash| !DASHES.contains(&dash))
    {
        return Err(format!("a line's style is one of {DASHES:?}"));
    }
    if mark.shadow == Some(false) {
        return Err("a shape has a shadow or says nothing about it".into());
    }
    if let Some(ends) = mark.arrow_ends.as_deref() {
        if !matches!(mark.kind, Kind::Line | Kind::Arrow) {
            return Err("only a line has arrow ends".into());
        }
        if !ARROW_ENDS.contains(&ends) {
            return Err(format!("a line's arrow ends are one of {ARROW_ENDS:?}"));
        }
    }
    if mark.bubble == Some(false) {
        return Err("a sketch is a speech bubble or says nothing about it".into());
    }
    let is_bubble = mark.bubble == Some(true);
    if is_bubble && mark.kind != Kind::Sketch {
        return Err("only a sketch is a speech bubble".into());
    }
    let styled = mark.font.is_some()
        || mark.align.is_some()
        || mark.bold.is_some()
        || mark.italic.is_some()
        || mark.underline.is_some();
    if styled && mark.kind != Kind::Text && !is_bubble {
        return Err("only a text has a font or an alignment".into());
    }
    if mark.bold == Some(false) || mark.italic == Some(false) || mark.underline == Some(false) {
        return Err("a text has a style or says nothing about it".into());
    }
    if let Some(sides) = mark.sides {
        if mark.kind != Kind::Sketch || !(3..=12).contains(&sides) {
            return Err("a polygon is a sketch of 3 to 12 sides".into());
        }
    }
    if let Some(power) = mark.power {
        if mark.kind != Kind::Loupe || !(power.is_finite() && (1.0..=5.0).contains(&power)) {
            return Err("a loupe magnifies 1 to 5 times".into());
        }
    }
    if mark.font.as_deref().is_some_and(|font| !is_font_name(font)) {
        return Err("a text's font is a family's name".into());
    }
    if mark
        .align
        .as_deref()
        .is_some_and(|align| !ALIGNMENTS.contains(&align))
    {
        return Err(format!("a text's alignment is one of {ALIGNMENTS:?}"));
    }
    match mark.kind {
        Kind::Highlight | Kind::Underline | Kind::Strikethrough => {
            if has_points || has_strokes || has_typing || mark.fill.is_some() {
                return Err("a mark on text has boxes and its words only".into());
            }
            if mark.text.as_deref().is_some_and(|text| !is_text(text)) {
                return Err(format!(
                    "the words of a mark are 1 to {MAX_TEXT} characters, without control characters"
                ));
            }
            let rects = mark.rects.as_deref().unwrap_or_default();
            if rects.is_empty() || rects.len() > MAX_RECTS {
                return Err(format!("a mark on text has 1 to {MAX_RECTS} boxes"));
            }
            let placed = |[x, y, w, h]: &[f64; 4]| {
                is_coordinate(*x) && is_coordinate(*y) && is_extent(*w) && is_extent(*h)
            };
            if !rects.iter().all(placed) {
                return Err("a box is outside the range a mark may have".into());
            }
            Ok(rects.len())
        }
        Kind::Note => {
            if has_points || has_strokes || has_rects || has_typing || mark.fill.is_some() {
                return Err("a note has text only".into());
            }
            if !mark.text.as_deref().is_some_and(is_text) {
                return Err(format!(
                    "a note is 1 to {MAX_TEXT} characters, without control characters"
                ));
            }
            Ok(0)
        }
        _ if has_rects => Err("only a mark on text has boxes".into()),
        Kind::Rect | Kind::Oval | Kind::Mask | Kind::Loupe | Kind::Line | Kind::Arrow => {
            if has_points || has_strokes || has_text {
                return Err("a shape has no points, strokes or text".into());
            }
            if mark.fill.is_some() && !matches!(mark.kind, Kind::Rect | Kind::Oval) {
                return Err("only a rectangle, an oval or a sketch has a fill".into());
            }
            Ok(0)
        }
        Kind::Sketch => {
            if has_strokes || (has_text && !is_bubble) {
                return Err("a sketch has points and a fill only".into());
            }
            if mark.text.as_deref().is_some_and(|text| !is_text(text)) {
                return Err(format!(
                    "a text is 1 to {MAX_TEXT} characters, without control characters"
                ));
            }
            if mark
                .size
                .is_some_and(|size| !(size.is_finite() && size > 0.0 && size <= 0.5))
            {
                return Err("a text's size is more than 0 and at most half the page".into());
            }
            if mark.turns.is_some_and(|turns| !(1..=3).contains(&turns)) {
                return Err("a text's turns are 1 to 3".into());
            }
            if mark.mirrored == Some(false) {
                return Err("a text is mirrored or says nothing about it".into());
            }
            let points = mark.points.as_deref().unwrap_or_default();
            if points.len() < 2 {
                return Err("a sketch has at least two points".into());
            }
            check_points(points, false)?;
            Ok(points.len())
        }
        Kind::Signature => {
            if has_points || has_text || mark.fill.is_some() {
                return Err("a signature has strokes only".into());
            }
            check_strokes(mark.strokes.as_deref().unwrap_or_default())
        }
        Kind::Text => {
            if has_points || has_strokes || mark.fill.is_some() {
                return Err("a text has text and a size only".into());
            }
            if !mark.text.as_deref().is_some_and(is_text) {
                return Err(format!(
                    "a text is 1 to {MAX_TEXT} characters, without control characters"
                ));
            }
            if !mark
                .size
                .is_some_and(|size| size.is_finite() && size > 0.0 && size <= 0.5)
            {
                return Err("a text's size is more than 0 and at most half the page".into());
            }
            if mark.turns.is_some_and(|turns| !(1..=3).contains(&turns)) {
                return Err("a text's turns are 1 to 3".into());
            }
            if mark.mirrored == Some(false) {
                return Err("a text is mirrored or says nothing about it".into());
            }
            Ok(0)
        }
    }
}

/// Checks a file's markup before it is stored.
pub fn validate_markup(markup: &Markup) -> Result<(), String> {
    if markup.rotation > 3 {
        return Err("the rotation is 0 to 3 quarter turns".into());
    }
    if let Some(order) = &markup.order {
        if order.is_empty() || order.len() > MAX_PAGE as usize {
            return Err(format!("a file shows 1 to {MAX_PAGE} pages"));
        }
        if order.iter().any(|source| *source > MAX_PAGE) {
            return Err(format!("a page shown draws a page of at most {MAX_PAGE}"));
        }
    }
    if let Some(turns) = &markup.turns {
        if turns.is_empty() || turns.len() > MAX_PAGE as usize {
            return Err(format!("a file turns 1 to {MAX_PAGE} pages"));
        }
        if turns.iter().any(|turn| *turn > 3) {
            return Err("a page's turns are 0 to 3".into());
        }
    }
    if let Some(keywords) = &markup.keywords {
        if keywords.len() > MAX_KEYWORDS {
            return Err(format!("a file has at most {MAX_KEYWORDS} keywords"));
        }
        let mut seen = BTreeSet::new();
        for keyword in keywords {
            let length = keyword.chars().count();
            if keyword.trim().is_empty()
                || length > MAX_KEYWORD
                || keyword.chars().any(char::is_control)
            {
                return Err(format!(
                    "a keyword is 1 to {MAX_KEYWORD} characters, without control characters"
                ));
            }
            if !seen.insert(keyword.as_str()) {
                return Err(format!("the keyword {keyword:?} is listed twice"));
            }
        }
    }
    let mut pages = BTreeSet::new();
    let mut ids = BTreeSet::new();
    let mut marks = 0;
    let mut points = 0;
    for page in &markup.pages {
        if !(1..=MAX_PAGE).contains(&page.page) {
            return Err(format!("a page is 1 to {MAX_PAGE}"));
        }
        if !pages.insert(page.page) {
            return Err(format!("page {} is listed twice", page.page));
        }
        for mark in &page.items {
            points += check_mark(mark)?;
            if !ids.insert(mark.id.as_str()) {
                return Err(format!("the mark {:?} is listed twice", mark.id));
            }
            marks += 1;
        }
    }
    if marks > MAX_MARKS {
        return Err(format!("a file's markup has at most {MAX_MARKS} marks"));
    }
    if points > MAX_TOTAL_POINTS {
        return Err(format!(
            "a file's markup has at most {MAX_TOTAL_POINTS} points"
        ));
    }
    Ok(())
}

/// Checks a person's signatures before they are stored.
pub fn validate_signatures(signatures: &[Signature]) -> Result<(), String> {
    if signatures.len() > MAX_SIGNATURES {
        return Err(format!("at most {MAX_SIGNATURES} signatures"));
    }
    let mut ids = BTreeSet::new();
    for signature in signatures {
        if !document::valid_key(&signature.id) {
            return Err(format!("{:?} is not a signature id", signature.id));
        }
        if !ids.insert(signature.id.as_str()) {
            return Err(format!("the signature {:?} is listed twice", signature.id));
        }
        if !(signature.aspect.is_finite() && (0.1..=20.0).contains(&signature.aspect)) {
            return Err("a signature's box is 0.1 to 20 times as wide as it is high".into());
        }
        check_strokes(&signature.strokes)?;
    }
    Ok(())
}

/// Checks a person's places before they are stored.
pub fn validate_places(places: &[Place]) -> Result<(), String> {
    if places.len() > MAX_PLACES {
        return Err(format!("at most {MAX_PLACES} places"));
    }
    let mut files = BTreeSet::new();
    for place in places {
        if !document::valid_key(&place.file) {
            return Err(format!("{:?} is not a file id", place.file));
        }
        if !files.insert(place.file.as_str()) {
            return Err(format!("the file {:?} is listed twice", place.file));
        }
        let length = place.name.chars().count();
        if place.name.trim().is_empty()
            || length > MAX_NAME
            || place.name.chars().any(char::is_control)
        {
            return Err(format!(
                "a place names its file in 1 to {MAX_NAME} characters, without control characters"
            ));
        }
        if !(1..=MAX_PAGE).contains(&place.page) {
            return Err(format!("a place's page is 1 to {MAX_PAGE}"));
        }
        if !(place.zoom.is_finite() && (0.01..=100.0).contains(&place.zoom)) {
            return Err("a place's zoom is 0.01 to 100".into());
        }
        if let Some(display) = &place.display {
            if !DISPLAYS.contains(&display.as_str()) {
                return Err(format!("a place's display is one of {DISPLAYS:?}"));
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn shape(id: &str, kind: Kind) -> Mark {
        Mark {
            id: id.into(),
            kind,
            color: "#ff3b30".into(),
            fill: None,
            stroke: 0.004,
            x: 0.1,
            y: 0.2,
            w: 0.3,
            h: 0.1,
            points: None,
            strokes: None,
            rects: None,
            text: None,
            size: None,
            turns: None,
            mirrored: None,
            dash: None,
            shadow: None,
            arrow_ends: None,
            font: None,
            align: None,
            bold: None,
            italic: None,
            underline: None,
            sides: None,
            power: None,
            bubble: None,
        }
    }

    fn markup(items: Vec<Mark>) -> Markup {
        Markup {
            rotation: 0,
            order: None,
            turns: None,
            keywords: None,
            pages: vec![PageMarks { page: 1, items }],
        }
    }

    #[test]
    fn each_page_keeps_its_turns() {
        let mut good = markup(vec![]);
        good.turns = Some(vec![0, 1, 3]);
        assert_eq!(validate_markup(&good), Ok(()));
        let text = serde_json::to_string(&good).unwrap();
        assert!(text.contains(r#""turns":[0,1,3]"#), "{text}");
        assert_eq!(serde_json::from_str::<Markup>(&text).unwrap(), good);
        let mut far = markup(vec![]);
        far.turns = Some(vec![4]);
        assert!(validate_markup(&far).is_err(), "four quarter turns");
        let mut none = markup(vec![]);
        none.turns = Some(vec![]);
        assert!(validate_markup(&none).is_err(), "no pages at all");
        let mut long = markup(vec![]);
        long.turns = Some(vec![0; MAX_PAGE as usize + 1]);
        assert!(validate_markup(&long).is_err(), "too many pages");
    }

    #[test]
    fn keywords_are_bounded() {
        let with = |words: Vec<String>| {
            let mut doc = markup(vec![]);
            doc.keywords = Some(words);
            validate_markup(&doc)
        };
        assert_eq!(with(vec!["beach".into(), "2020".into()]), Ok(()));
        assert!(with(vec!["beach".into(), "beach".into()]).is_err(), "twice");
        assert!(with(vec!["  ".into()]).is_err(), "blank");
        assert!(with(vec!["a\u{7}".into()]).is_err(), "a control character");
        assert!(with(vec!["x".repeat(MAX_KEYWORD + 1)]).is_err(), "too long");
        let many = (0..=MAX_KEYWORDS).map(|n| format!("k{n}")).collect();
        assert!(with(many).is_err(), "too many");
    }

    #[test]
    fn styles_belong_to_the_marks_that_show_them() {
        let kept = |mark: Mark| validate_markup(&markup(vec![mark])).is_ok();

        assert!(kept(shape("m", Kind::Mask)), "a mask");
        assert!(kept(shape("l", Kind::Loupe)), "a loupe");
        let mut m = shape("m", Kind::Mask);
        m.fill = Some("#000000".into());
        assert!(!kept(m), "a filled mask");
        let mut m = shape("l", Kind::Loupe);
        m.dash = Some("dashed".into());
        assert!(!kept(m), "a dashed loupe");

        let mut m = shape("s", Kind::Sketch);
        m.points = Some(vec![[0.1, 0.1], [0.2, 0.2], [0.1, 0.1]]);
        m.fill = Some("#ffcc00".into());
        m.dash = Some("dotted".into());
        m.shadow = Some(true);
        assert!(kept(m), "a filled outline with a style");

        let mut m = shape("a", Kind::Arrow);
        m.arrow_ends = Some("both".into());
        assert!(kept(m), "an arrow with two heads");
        let mut m = shape("a", Kind::Arrow);
        m.arrow_ends = Some("middle".into());
        assert!(!kept(m), "an end there is not");
        let mut m = shape("a", Kind::Rect);
        m.arrow_ends = Some("end".into());
        assert!(!kept(m), "a rectangle with arrow ends");

        let mut m = shape("a", Kind::Rect);
        m.dash = Some("wavy".into());
        assert!(!kept(m), "a style there is not");
        let mut m = shape("a", Kind::Rect);
        m.shadow = Some(false);
        assert!(!kept(m), "a shape saying it has no shadow");

        let mut m = shape("t", Kind::Text);
        m.text = Some("x".into());
        m.size = Some(0.02);
        m.font = Some("Georgia".into());
        m.align = Some("center".into());
        assert!(kept(m.clone()), "a text in a font");
        let mut bad = m.clone();
        bad.font = Some("<b>Comic Sans".into());
        assert!(!kept(bad), "no family's name");
        m.font = Some("Comic Sans MS".into());
        assert!(kept(m.clone()), "any family of the Fonts panel");
        let mut bad = m.clone();
        bad.align = Some("justified".into());
        assert!(!kept(bad), "an alignment there is not");
        let mut bad = m;
        bad.dash = Some("dashed".into());
        assert!(!kept(bad), "a dashed text");
        let mut m = shape("a", Kind::Rect);
        m.font = Some("Georgia".into());
        assert!(!kept(m), "a rectangle in a font");
    }

    #[test]
    fn a_text_style_a_polygon_a_loupe_and_a_bubble_keep_to_their_kinds() {
        let kept = |mark: Mark| validate_markup(&markup(vec![mark])).is_ok();
        let mut text = shape("t", Kind::Text);
        text.text = Some("hello".into());
        text.size = Some(0.03);
        text.bold = Some(true);
        text.italic = Some(true);
        text.underline = Some(true);
        assert!(kept(text.clone()), "a text in a style");
        text.bold = Some(false);
        assert!(!kept(text), "a text saying it is not bold");

        let mut rect = shape("r", Kind::Rect);
        rect.bold = Some(true);
        assert!(!kept(rect), "a rectangle in bold");

        let closed = vec![[0.1, 0.1], [0.4, 0.1], [0.2, 0.4], [0.1, 0.1]];
        let mut polygon = shape("p", Kind::Sketch);
        polygon.points = Some(closed.clone());
        polygon.sides = Some(12);
        assert!(kept(polygon.clone()), "twelve sides");
        polygon.sides = Some(13);
        assert!(!kept(polygon), "thirteen sides");
        let mut oval = shape("o", Kind::Oval);
        oval.sides = Some(5);
        assert!(!kept(oval), "an oval with sides");

        let mut loupe = shape("l", Kind::Loupe);
        loupe.power = Some(3.5);
        assert!(kept(loupe.clone()), "a loupe at 3.5");
        loupe.power = Some(6.0);
        assert!(!kept(loupe), "a loupe past 5");

        let mut bubble = shape("b", Kind::Sketch);
        bubble.points = Some(closed.clone());
        bubble.bubble = Some(true);
        bubble.text = Some("hi".into());
        bubble.size = Some(0.03);
        bubble.font = Some("Georgia".into());
        assert!(kept(bubble.clone()), "a bubble that says something");
        bubble.bubble = None;
        assert!(!kept(bubble), "a plain sketch with text");
    }

    #[test]
    fn a_page_order_is_bounded() {
        let mut good = markup(vec![]);
        good.order = Some(vec![3, 0, 1]);
        assert_eq!(validate_markup(&good), Ok(()));
        let text = serde_json::to_string(&good).unwrap();
        assert_eq!(serde_json::from_str::<Markup>(&text).unwrap(), good);
        let mut empty = markup(vec![]);
        empty.order = Some(vec![]);
        assert!(validate_markup(&empty).is_err(), "no pages at all");
        let mut far = markup(vec![]);
        far.order = Some(vec![MAX_PAGE + 1]);
        assert!(validate_markup(&far).is_err(), "a page past the last");
        let mut long = markup(vec![]);
        long.order = Some(vec![1; MAX_PAGE as usize + 1]);
        assert!(validate_markup(&long).is_err(), "too many pages");
    }

    #[test]
    fn every_kind_of_mark_round_trips() {
        let mut sketch = shape("s", Kind::Sketch);
        sketch.points = Some(vec![[0.1, 0.1], [0.2, 0.25], [0.3, 0.2]]);
        let mut text = shape("t", Kind::Text);
        text.text = Some("Approved\nby Ada".into());
        text.size = Some(0.03);
        text.turns = Some(1);
        text.mirrored = Some(true);
        let mut signature = shape("g", Kind::Signature);
        signature.strokes = Some(vec![vec![[0.0, 0.5], [0.5, 0.0], [1.0, 1.0]]]);
        let mut filled = shape("r", Kind::Rect);
        filled.fill = Some("#ffffff".into());
        let on_text = |id: &str, kind: Kind| {
            let mut mark = shape(id, kind);
            mark.rects = Some(vec![[0.1, 0.2, 0.3, 0.02], [0.1, 0.23, 0.2, 0.02]]);
            mark.text = Some("the ferry leaves at ten".into());
            mark
        };
        let mut note = shape("n", Kind::Note);
        note.text = Some("Check\nthis".into());
        let doc = Markup {
            rotation: 1,
            order: None,
            turns: None,
            keywords: None,
            pages: vec![
                PageMarks {
                    page: 1,
                    items: vec![filled, shape("o", Kind::Oval), sketch, text],
                },
                PageMarks {
                    page: 3,
                    items: vec![shape("l", Kind::Line), shape("a", Kind::Arrow), signature],
                },
                PageMarks {
                    page: 4,
                    items: vec![
                        on_text("h", Kind::Highlight),
                        on_text("u", Kind::Underline),
                        on_text("k", Kind::Strikethrough),
                        note,
                    ],
                },
            ],
        };
        assert_eq!(validate_markup(&doc), Ok(()));
        let json = serde_json::to_string(&doc).unwrap();
        assert!(json.contains(r#""kind":"signature""#), "{json}");
        assert!(
            !json.contains("\"points\":null"),
            "absent fields are left out: {json}"
        );
        assert_eq!(serde_json::from_str::<Markup>(&json).unwrap(), doc);
    }

    #[test]
    fn marks_on_text_and_notes_are_bounded() {
        let refused = |mark: Mark| validate_markup(&markup(vec![mark])).is_err();

        assert!(refused(shape("h", Kind::Highlight)), "no boxes");
        let mut m = shape("h", Kind::Underline);
        m.rects = Some(vec![]);
        assert!(refused(m), "an empty list of boxes");
        let mut m = shape("h", Kind::Strikethrough);
        m.rects = Some(vec![[0.1, 0.1, 0.1, 0.1]; MAX_RECTS + 1]);
        assert!(refused(m), "too many boxes");
        let mut m = shape("h", Kind::Highlight);
        m.rects = Some(vec![[9.0, 0.1, 0.1, 0.1]]);
        assert!(refused(m), "a box far off the page");
        let mut m = shape("h", Kind::Highlight);
        m.rects = Some(vec![[0.1, 0.1, 0.1, 0.1]]);
        m.size = Some(0.03);
        assert!(refused(m), "a highlight with a text's size");
        let mut m = shape("h", Kind::Highlight);
        m.rects = Some(vec![[0.1, 0.1, 0.1, 0.1]]);
        m.text = Some("a\u{0}b".into());
        assert!(refused(m), "words with a control character");

        assert!(refused(shape("n", Kind::Note)), "a note without text");
        let mut m = shape("n", Kind::Note);
        m.text = Some("x".into());
        m.rects = Some(vec![[0.1, 0.1, 0.1, 0.1]]);
        assert!(refused(m), "a note with boxes");
        let mut m = shape("r", Kind::Rect);
        m.rects = Some(vec![[0.1, 0.1, 0.1, 0.1]]);
        assert!(refused(m), "a rectangle with boxes");
    }

    #[test]
    fn marks_that_do_not_fit_their_kind_are_refused() {
        let refused = |mark: Mark| validate_markup(&markup(vec![mark])).is_err();
        let mut m = shape("a", Kind::Rect);
        m.color = "red".into();
        assert!(refused(m), "a named colour");
        let mut m = shape("a", Kind::Rect);
        m.stroke = 0.0;
        assert!(refused(m), "no line");
        let mut m = shape("a", Kind::Rect);
        m.x = f64::NAN;
        assert!(refused(m), "not a number");
        let mut m = shape("a", Kind::Rect);
        m.y = 5.0;
        assert!(refused(m), "far off the page");
        let mut m = shape("a", Kind::Rect);
        m.text = Some("x".into());
        assert!(refused(m), "a shape with text");
        let mut m = shape("a", Kind::Line);
        m.fill = Some("#000000".into());
        assert!(refused(m), "a filled line");
        let mut m = shape("a", Kind::Sketch);
        m.points = Some(vec![[0.1, 0.1]]);
        assert!(refused(m), "a sketch of one point");
        let mut m = shape("a", Kind::Sketch);
        m.points = Some(vec![[0.1, 0.1]; MAX_POINTS + 1]);
        assert!(refused(m), "too many points");
        let mut m = shape("a", Kind::Text);
        m.text = Some("bell\u{7}".into());
        m.size = Some(0.02);
        assert!(refused(m), "a control character");
        let mut m = shape("a", Kind::Text);
        m.text = Some("x".repeat(MAX_TEXT + 1));
        m.size = Some(0.02);
        assert!(refused(m), "too long");
        let mut m = shape("a", Kind::Text);
        m.text = Some("x".into());
        assert!(refused(m), "a text without a size");
        let mut m = shape("a", Kind::Text);
        m.text = Some("x".into());
        m.size = Some(0.02);
        m.turns = Some(4);
        assert!(refused(m), "a text turned more than three quarters");
        let mut m = shape("a", Kind::Rect);
        m.turns = Some(1);
        assert!(refused(m), "a turned shape");
        let mut m = shape("a", Kind::Rect);
        m.mirrored = Some(true);
        assert!(refused(m), "a mirrored shape");
        let mut m = shape("a", Kind::Text);
        m.text = Some("x".into());
        m.size = Some(0.02);
        m.mirrored = Some(false);
        assert!(refused(m), "a text saying it is not mirrored");
        let mut m = shape("a", Kind::Signature);
        m.strokes = Some(vec![vec![[0.5, 1.5]]]);
        assert!(refused(m), "a signature point outside its box");
        let mut m = shape("a", Kind::Signature);
        m.strokes = Some(vec![]);
        assert!(refused(m), "a signature without strokes");
        assert!(refused(shape("a/b", Kind::Oval)), "an id that is not plain");
    }

    #[test]
    fn the_document_as_a_whole_is_bounded() {
        assert!(
            validate_markup(&markup(vec![
                shape("a", Kind::Rect),
                shape("a", Kind::Oval)
            ]))
            .is_err(),
            "one id twice"
        );
        let many: Vec<Mark> = (0..=MAX_MARKS)
            .map(|n| shape(&format!("m{n}"), Kind::Rect))
            .collect();
        assert!(validate_markup(&markup(many)).is_err(), "too many marks");
        let twice = Markup {
            rotation: 0,
            order: None,
            turns: None,
            keywords: None,
            pages: vec![
                PageMarks {
                    page: 2,
                    items: vec![],
                },
                PageMarks {
                    page: 2,
                    items: vec![],
                },
            ],
        };
        assert!(validate_markup(&twice).is_err(), "a page twice");
        let zero = Markup {
            rotation: 0,
            order: None,
            turns: None,
            keywords: None,
            pages: vec![PageMarks {
                page: 0,
                items: vec![],
            }],
        };
        assert!(validate_markup(&zero).is_err(), "page 0");
        let turned = Markup {
            rotation: 4,
            order: None,
            turns: None,
            keywords: None,
            pages: vec![],
        };
        assert!(validate_markup(&turned).is_err(), "four quarter turns");
        let sketches: Vec<Mark> = (0..6)
            .map(|n| {
                let mut m = shape(&format!("s{n}"), Kind::Sketch);
                m.points = Some(vec![[0.5, 0.5]; MAX_POINTS]);
                m
            })
            .collect();
        assert!(
            validate_markup(&markup(sketches)).is_err(),
            "too many points in all"
        );
        assert!(
            serde_json::from_str::<Mark>(
                r##"{"id":"a","kind":"rect","color":"#000000","stroke":0.01,"x":0,"y":0,"w":0,"h":0,"script":1}"##
            )
            .is_err(),
            "a field the module does not know"
        );
        assert!(
            serde_json::from_str::<Mark>(
                r##"{"id":"a","kind":"image","color":"#000000","stroke":0.01,"x":0,"y":0,"w":0,"h":0}"##
            )
            .is_err(),
            "a kind the module does not know"
        );
    }

    #[test]
    fn signatures_are_bounded() {
        let signature = |id: &str| Signature {
            id: id.into(),
            aspect: 3.0,
            strokes: vec![vec![[0.0, 0.0], [1.0, 1.0]]],
        };
        assert_eq!(
            validate_signatures(&[signature("a"), signature("b")]),
            Ok(())
        );
        assert!(validate_signatures(&[signature("a"), signature("a")]).is_err());
        let many: Vec<Signature> = (0..=MAX_SIGNATURES)
            .map(|n| signature(&format!("s{n}")))
            .collect();
        assert!(validate_signatures(&many).is_err());
        let mut flat = signature("a");
        flat.aspect = 0.0;
        assert!(validate_signatures(&[flat]).is_err());
        let mut long = signature("a");
        long.strokes = vec![vec![[0.5, 0.5]; MAX_POINTS + 1]];
        assert!(validate_signatures(&[long]).is_err());
    }
}

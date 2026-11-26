//! The pictures of a store book, which its text does not have: Project Gutenberg's text names no
//! picture file, and the text kept for a Standard Ebooks book has its markup thrown away. A book's
//! text and every offset kept for it stay as they are; a picture is a position between two of its
//! characters, found afterwards.
//!
//! * `GET /api/books/pictures/<book>`: `{"pictures": [{"at", "path", "type"}], "complete"}`, once
//!   the book's text is all kept. Each request reads one round of the book's HTML edition
//!   (`pg<n>-images.html`, or Standard Ebooks' single page), under the gateway's 8 seconds, so the
//!   page asks again until `complete`. An `img` stands before the paragraph in which the words
//!   following it are found in the kept text, compared by letters and digits alone, so wrapping,
//!   punctuation and markup differ freely. One whose words are not found is left out, as is a file
//!   named more than once (a chapter ornament, or the "enlarge" icon beside each plate) and a kind
//!   other than JPEG, PNG, GIF or WebP.
//! * `GET /api/books/pictures/<book>/<n>`: the bytes of picture `n`, at most
//!   [`MAX_PICTURE_BYTES`], fetched from the source each time and left to the browser's cache:
//!   only the list is kept. A browser cannot read those hosts itself.
//!
//! Shared key: `pictures/<book>`, the list and how far it has come, at most [`MAX_PICTURES`]
//! entries. The text cache removes it along with the book (`text.rs`).

use ferrite_app::{serde, serde_json};

use super::source::{BookId, Source, EGRESS};
use super::text::{self, Index};
use crate::apps::news::feed::html_to_text;
use crate::apps::news::fetch;
use crate::http::Response;
use crate::module::Space;

/// The most of the HTML edition one round reads.
const ROUND_BYTES: usize = 2_400_000;
/// The time one request may spend fetching, under the gateway's 8 seconds.
const FETCH_BUDGET_MS: u64 = 5_200;
/// The most pictures listed for one book, as for an EPUB.
pub const MAX_PICTURES: usize = 2_000;
/// The largest picture passed on.
pub const MAX_PICTURE_BYTES: usize = 4 * 1024 * 1024;
/// How much HTML after an `img` is read for the words it stands before.
const AFTER_BYTES: usize = 4_000;
/// The letters and digits compared; a page number among them fails one try, not all.
const ANCHOR_CHARS: usize = 48;
const ANCHOR_STEP: usize = 24;
const ANCHOR_TRIES: usize = 3;
/// The fewest letters and digits that place a picture.
const MIN_ANCHOR_CHARS: usize = 16;
/// How many parts of the text one picture is looked for in, past the last one placed.
const WINDOW_PARTS: usize = 12;

/// One picture as the page gets it.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Picture {
    /// The offset in the text it stands before, in UTF-16 units.
    pub at: u64,
    /// Its address, relative to the book's HTML edition.
    pub path: String,
    #[serde(rename = "type")]
    pub kind: String,
}

/// How far the list has come.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Default)]
#[serde(crate = "ferrite_app::serde")]
struct Kept {
    pictures: Vec<Picture>,
    complete: bool,
    /// The byte of the HTML edition the next round starts at.
    next: u64,
    /// The part of the text the search goes on in, and the byte in it.
    part: usize,
    byte: usize,
    /// The files named more than once so far.
    repeated: Vec<String>,
}

impl Kept {
    /// Whether `path` has not been named before; if it has, it is no longer listed.
    fn named_first_here(&mut self, path: &str) -> bool {
        if self.repeated.iter().any(|each| each == path) {
            return false;
        }
        let Some(first) = self.pictures.iter().position(|each| each.path == path) else {
            return true;
        };
        self.pictures.remove(first);
        self.repeated.push(path.to_string());
        false
    }
}

fn key(book: &BookId) -> String {
    format!("pictures/{}", book.as_string())
}

/// The address of a book's edition that names its pictures.
fn edition_url(book: &BookId) -> String {
    match book {
        BookId::Gutenberg(n) => {
            format!(
                "{}cache/epub/{n}/pg{n}-images.html",
                super::source::GUTENBERG
            )
        }
        BookId::StandardEbooks(_) => book.text_url(),
    }
}

/// The media type of a picture's file: `None` for what is not one a page may be handed.
fn picture_type(path: &str) -> Option<&'static str> {
    let extension = path.rsplit('.').next()?.to_ascii_lowercase();
    match extension.as_str() {
        "jpg" | "jpeg" => Some("image/jpeg"),
        "png" => Some("image/png"),
        "gif" => Some("image/gif"),
        "webp" => Some("image/webp"),
        _ => None,
    }
}

/// A picture's address at its source, or `None` when `path` leaves the book's own folder, or is
/// anything but a plain relative path.
fn picture_url(book: &BookId, path: &str) -> Option<String> {
    let plain = !path.is_empty()
        && path.bytes().all(|b| {
            b.is_ascii_alphanumeric() || matches!(b, b'/' | b'.' | b'-' | b'_' | b'%' | b'@')
        });
    if !plain || path.starts_with('/') {
        return None;
    }
    let (root, mut folder): (String, Vec<&str>) = match book {
        BookId::Gutenberg(n) => (
            format!("{}cache/epub/{n}/", super::source::GUTENBERG),
            vec![],
        ),
        BookId::StandardEbooks(segments) => (
            format!(
                "{}ebooks/{}/",
                super::source::STANDARD_EBOOKS,
                segments.join("/")
            ),
            vec!["text"],
        ),
    };
    for segment in path.split('/') {
        match segment {
            "" | "." => return None,
            ".." => {
                folder.pop()?;
            }
            other => folder.push(other),
        }
    }
    Some(format!("{root}{}", folder.join("/")))
}

/// The value of attribute `name` in the tag `tag`.
fn attribute<'a>(tag: &'a str, name: &str) -> Option<&'a str> {
    let lower = tag.to_ascii_lowercase();
    let pattern = format!("{name}=");
    let mut from = 0;
    while let Some(found) = lower[from..].find(&pattern) {
        let at = from + found;
        let starts = at == 0 || lower.as_bytes()[at - 1].is_ascii_whitespace();
        let value = at + pattern.len();
        let quote = lower.as_bytes().get(value).copied();
        if starts && matches!(quote, Some(b'"') | Some(b'\'')) {
            let quote = quote? as char;
            let rest = tag.get(value + 1..)?;
            return rest.find(quote).map(|end| &rest[..end]);
        }
        from = at + pattern.len();
    }
    None
}

/// The letters and digits of `text`, lower-cased.
fn compact(text: &str) -> String {
    text.chars()
        .filter(|c| c.is_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}

/// The tries at the words after a picture: runs of letters and digits, each later than the last.
fn anchors(words: &str) -> Vec<String> {
    let chars: Vec<char> = words.chars().collect();
    (0..ANCHOR_TRIES)
        .filter_map(|try_at| {
            let from = try_at * ANCHOR_STEP;
            let run = chars.get(from..(from + ANCHOR_CHARS).min(chars.len()))?;
            (run.len() >= MIN_ANCHOR_CHARS).then(|| run.iter().collect())
        })
        .collect()
}

/// An `img` of the HTML, and the words it stands before.
#[derive(Debug, PartialEq)]
struct Found {
    path: String,
    anchors: Vec<String>,
}

/// The largest index at or below `at` that is a character's boundary.
fn boundary(text: &str, mut at: usize) -> usize {
    at = at.min(text.len());
    while !text.is_char_boundary(at) {
        at -= 1;
    }
    at
}

/// The `img`s of `html` with a picture's file, and how much of it was read: all of it at the end
/// of the file, else up to the first `img` too near the end for its words to be all here.
fn scan(html: &str, ended: bool) -> (Vec<Found>, usize) {
    let lower = html.to_ascii_lowercase();
    let mut found = Vec::new();
    let mut from = 0;
    while let Some(start) = lower[from..].find("<img").map(|at| from + at) {
        let Some(end) = lower[start..].find('>').map(|at| start + at + 1) else {
            return (found, if ended { html.len() } else { start });
        };
        let tag = &html[start..end];
        from = end;
        let Some(path) = attribute(tag, "src").filter(|src| picture_type(src).is_some()) else {
            continue;
        };
        let limit = boundary(html, end + AFTER_BYTES);
        let near_end = limit == html.len();
        let following = &html[end..limit];
        let whole = following.rfind('>').map_or("", |at| &following[..=at]);
        let words = compact(&html_to_text(whole));
        if !ended && near_end && words.chars().count() < ANCHOR_CHARS + 2 * ANCHOR_STEP {
            return (found, start);
        }
        found.push(Found {
            path: path.to_string(),
            anchors: anchors(&words),
        });
    }
    (found, html.len())
}

/// Some parts of the kept text, with its letters and digits to search.
struct Window {
    first_part: usize,
    /// The UTF-16 units before the first part.
    base: u64,
    raw: String,
    /// Where each part after the first starts in `raw`.
    starts: Vec<usize>,
    letters: String,
    /// The byte of `raw` each byte of `letters` came from.
    from_raw: Vec<u32>,
}

impl Window {
    fn new(first_part: usize, base: u64, parts: &[String]) -> Window {
        let mut raw = String::new();
        let mut starts = Vec::new();
        for (at, part) in parts.iter().enumerate() {
            if at > 0 {
                starts.push(raw.len());
            }
            raw.push_str(part);
        }
        let mut letters = String::with_capacity(raw.len());
        let mut from_raw = Vec::with_capacity(raw.len());
        for (byte, c) in raw.char_indices() {
            if c.is_alphanumeric() {
                for lower in c.to_lowercase() {
                    letters.push(lower);
                    from_raw.resize(letters.len(), byte as u32);
                }
            }
        }
        Window {
            first_part,
            base,
            raw,
            starts,
            letters,
            from_raw,
        }
    }

    /// The byte of `raw` where one of `anchors` is first found, at or past the byte `from`.
    fn find(&self, anchors: &[String], from: usize) -> Option<usize> {
        let start = self
            .from_raw
            .partition_point(|byte| (*byte as usize) < from);
        let letters = self.letters.get(start..)?;
        anchors
            .iter()
            .find_map(|anchor| letters.find(anchor.as_str()))
            .map(|at| self.from_raw[start + at] as usize)
    }

    /// Where a picture before the words at byte `byte` of `raw` stands, as an offset in the book:
    /// before their paragraph, and before the "[Illustration]" paragraph a Gutenberg text has in
    /// its place.
    fn offset_before(&self, byte: usize) -> u64 {
        let paragraph = |end: usize| self.raw[..end].rfind("\n\n").map_or(0, |at| at + 2);
        let mut start = paragraph(byte);
        let before = self.raw[..start].trim_end();
        let previous = paragraph(before.len());
        if before[previous..].starts_with("[Illustration") && before.ends_with(']') {
            start = previous;
        }
        self.base + self.raw[..start].encode_utf16().count() as u64
    }

    /// The part and the byte in it that byte `byte` of `raw` falls in.
    fn cursor(&self, byte: usize) -> (usize, usize) {
        let inside = self.starts.partition_point(|start| *start <= byte);
        let start = if inside == 0 {
            0
        } else {
            self.starts[inside - 1]
        };
        (self.first_part + inside, byte - start)
    }
}

async fn window(
    shared: &mut Space<'_>,
    book: &BookId,
    index: &Index,
    first_part: usize,
) -> Result<Window, Response> {
    let last = (first_part + WINDOW_PARTS).min(index.parts.len());
    let mut parts = Vec::with_capacity(last.saturating_sub(first_part));
    for part in first_part..last {
        parts.push(text::part_text(shared, book, index, part).await?);
    }
    let base = index.parts.iter().take(first_part).sum();
    Ok(Window::new(first_part, base, &parts))
}

/// Whether the source's answer settles that there is nothing (more) to read of this edition.
fn edition_is_absent(status: u16) -> bool {
    matches!(status, 404 | 410 | 416 | 451)
}

/// One round: the next stretch of the HTML edition, its pictures placed in the kept text.
async fn round(
    shared: &mut Space<'_>,
    ctx: &ferrite_app::AppContext,
    book: &BookId,
    index: &Index,
    mut kept: Kept,
) -> Result<Kept, Response> {
    let range = format!("bytes={}-{}", kept.next, kept.next + ROUND_BYTES as u64 - 1);
    let accept = match book.source() {
        Source::StandardEbooks => "application/xhtml+xml, text/html;q=0.9",
        Source::Gutenberg => "text/html",
    };
    let fetched = fetch::get_with(
        ctx,
        EGRESS,
        &edition_url(book),
        accept,
        &[("range", range.as_str())],
        ROUND_BYTES,
        FETCH_BUDGET_MS,
    )
    .await
    .map_err(|error| Response::error(503, &format!("the book's pictures: {error}")))?;
    let body = match fetched.status {
        200 => fetched
            .body
            .get(kept.next as usize..)
            .unwrap_or_default()
            .to_vec(),
        206 => fetched.body,
        // Nothing past the end, or the source says it has no such edition: no pictures, and the
        // book's text stands. Any other refusal may pass, so it is not kept as the answer.
        status if edition_is_absent(status) => {
            kept.complete = true;
            return Ok(kept);
        }
        status => {
            return Err(Response::error(
                503,
                &format!("the book's pictures: the source answered {status}"),
            ))
        }
    };
    let ended = !fetched.cut && (fetched.status == 200 || body.len() < ROUND_BYTES);
    let sound = match std::str::from_utf8(&body) {
        Ok(all) => all.len(),
        Err(error) => error.valid_up_to(),
    };
    let read = if ended {
        sound
    } else {
        text::markup_boundary(&body[..sound])
    };
    let html = std::str::from_utf8(&body[..read]).unwrap_or_default();
    let (found, used) = scan(html, ended);
    let mut searching: Option<Window> = None;
    for each in found {
        let Some(path) = Some(each.path)
            .filter(|path| picture_url(book, path).is_some())
            .filter(|path| kept.named_first_here(path))
        else {
            continue;
        };
        let Some(kind) = picture_type(&path) else {
            continue;
        };
        if kept.pictures.len() >= MAX_PICTURES {
            break;
        }
        if searching.as_ref().map(|w| w.first_part) != Some(kept.part) {
            searching = Some(window(shared, book, index, kept.part).await?);
        }
        let Some(place) = searching.as_ref() else {
            continue;
        };
        let Some(byte) = place.find(&each.anchors, kept.byte) else {
            continue;
        };
        kept.pictures.push(Picture {
            at: place.offset_before(byte),
            path,
            kind: kind.to_string(),
        });
        (kept.part, kept.byte) = place.cursor(byte);
    }
    kept.next += used as u64;
    // A round that could read nothing would read nothing again: the list ends where it is.
    kept.complete = ended || used == 0;
    Ok(kept)
}

fn reply(kept: &Kept) -> Response {
    Response::json(
        200,
        &serde_json::json!({ "pictures": kept.pictures, "complete": kept.complete }),
    )
}

async fn read_kept(shared: &mut Space<'_>, book: &BookId) -> Result<Kept, Response> {
    match shared.get(&key(book)).await {
        Ok(Some(bytes)) => Ok(serde_json::from_slice(&bytes).unwrap_or_default()),
        Ok(None) => Ok(Kept::default()),
        Err(error) => Err(Response::error(503, &format!("storage failed: {error}"))),
    }
}

/// Removes what is kept of a book's pictures.
pub async fn forget(shared: &mut Space<'_>, book: &BookId) {
    if let Err(error) = shared.delete(&key(book)).await {
        ferrite_app::tracing::warn!(%error, "could not remove a Books picture list");
    }
}

/// `GET /api/books/pictures/<book>[/<n>]`, `rest` being what follows `/pictures/`.
pub async fn answer(rest: &str, shared: &mut Space<'_>, ctx: &ferrite_app::AppContext) -> Response {
    let (id, n) = match rest.split_once('/') {
        Some((id, n)) => (id, Some(n)),
        None => (rest, None),
    };
    let Some(book) = BookId::parse(id) else {
        return Response::error(404, &format!("{id:?} is not a book Books can read"));
    };
    let kept = match read_kept(shared, &book).await {
        Ok(kept) => kept,
        Err(refused) => return refused,
    };
    match n {
        Some(n) => match n.parse::<usize>().ok().and_then(|n| kept.pictures.get(n)) {
            Some(picture) => picture_file(&book, picture, ctx).await,
            None => Response::error(404, "the book has no such picture"),
        },
        None if kept.complete => reply(&kept),
        None => {
            let index = match text::complete_index(shared, &book).await {
                Ok(index) => index,
                Err(refused) => return refused,
            };
            let next = match round(shared, ctx, &book, &index, kept).await {
                Ok(next) => next,
                Err(refused) => return refused,
            };
            let bytes = match serde_json::to_vec(&next) {
                Ok(bytes) => bytes,
                Err(error) => return Response::error(500, &error.to_string()),
            };
            if let Err(error) = shared.put(&key(&book), &bytes).await {
                return Response::error(503, &format!("storage failed: {error}"));
            }
            reply(&next)
        }
    }
}

async fn picture_file(book: &BookId, picture: &Picture, ctx: &ferrite_app::AppContext) -> Response {
    let Some(url) = picture_url(book, &picture.path) else {
        return Response::error(404, "the book has no such picture");
    };
    let fetched = match fetch::get(
        ctx,
        EGRESS,
        &url,
        "image/*",
        MAX_PICTURE_BYTES,
        FETCH_BUDGET_MS,
    )
    .await
    {
        Ok(fetched) => fetched,
        Err(error) => return Response::error(503, &format!("the picture: {error}")),
    };
    if fetched.status != 200 {
        return Response::error(404, "the source has no such picture");
    }
    if fetched.cut {
        return Response::error(413, "the picture is too large to show here");
    }
    Response::new(200, fetched.body)
        .add_header("content-type", picture.kind.clone())
        .add_header("x-content-type-options", "nosniff")
        .add_header("cache-control", "private, max-age=86400")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_a_lasting_refusal_ends_the_list() {
        for status in [404, 410, 416, 451] {
            assert!(edition_is_absent(status), "{status}");
        }
        for status in [400, 401, 403, 408, 425, 429, 500, 503] {
            assert!(!edition_is_absent(status), "{status}");
        }
    }

    #[test]
    fn a_picture_address_stays_in_the_books_folder() {
        let pride = BookId::parse("pg-1342").unwrap();
        assert_eq!(
            picture_url(&pride, "images/cover.jpg").as_deref(),
            Some("https://www.gutenberg.org/cache/epub/1342/images/cover.jpg")
        );
        assert_eq!(picture_url(&pride, "../1343/images/cover.jpg"), None);
        assert_eq!(picture_url(&pride, "/images/cover.jpg"), None);
        assert_eq!(picture_url(&pride, "https://evil.example/a.jpg"), None);
        assert_eq!(picture_url(&pride, "images//cover.jpg"), None);

        let emma = BookId::parse("se.jane-austen.emma").unwrap();
        assert_eq!(
            picture_url(&emma, "../images/plate.jpg").as_deref(),
            Some("https://standardebooks.org/ebooks/jane-austen/emma/images/plate.jpg")
        );
        assert_eq!(picture_url(&emma, "../../other/plate.jpg"), None);
    }

    #[test]
    fn an_img_takes_the_words_after_it_and_a_kind_a_page_may_show() {
        let html = concat!(
            r#"<p><IMG alt="[Illustration]" src="images/one.jpg"></p>"#,
            r#"<p>Call me &amp; Ishmael, some years ago, never mind how long precisely.</p>"#,
            r#"<img src="images/logo.svg"/><p>The words of a drawing no page is given.</p>"#,
            r#"<img data-src="x.jpg" src='images/two.PNG'/><h2>Loomings</h2>"#
        );
        let (found, used) = scan(html, true);
        assert_eq!(used, html.len());
        assert_eq!(
            found,
            vec![
                Found {
                    path: "images/one.jpg".into(),
                    anchors: vec![
                        "callmeishmaelsomeyearsagonevermindhowlongprecise".into(),
                        "onevermindhowlongpreciselythewordsofadrawingnopa".into(),
                        "lythewordsofadrawingnopageisgivenloomings".into(),
                    ],
                },
                Found {
                    path: "images/two.PNG".into(),
                    anchors: vec![],
                },
            ]
        );
    }

    #[test]
    fn a_file_named_twice_is_not_a_picture_of_the_book() {
        let picture = |path: &str| Picture {
            at: 0,
            path: path.into(),
            kind: "image/jpeg".into(),
        };
        let mut kept = Kept {
            pictures: vec![picture("images/plate.jpg"), picture("images/enlarge.jpg")],
            ..Kept::default()
        };
        assert!(kept.named_first_here("images/other.jpg"));
        assert!(!kept.named_first_here("images/enlarge.jpg"));
        assert!(!kept.named_first_here("images/enlarge.jpg"));
        assert_eq!(kept.pictures, vec![picture("images/plate.jpg")]);
    }

    #[test]
    fn a_round_stops_at_an_img_whose_words_are_not_all_here() {
        let start = "<p>Before.</p>";
        let html = format!(r#"{start}<img src="images/one.jpg"><p>Only a few words.</p>"#);
        let (found, used) = scan(&html, false);
        assert_eq!(found, vec![]);
        assert_eq!(used, start.len());
        assert_eq!(scan(&html, true).0.len(), 1);
    }

    #[test]
    fn a_picture_stands_before_its_words_and_its_illustration_line() {
        let parts = vec![
            "Header café 😀 line.\n\n[Illustration]\n\nCall me Ishmael, some years ago.\n\n"
                .to_string(),
            "Loomings came next, without any doubt at all.\n\n".to_string(),
        ];
        let window = Window::new(3, 1000, &parts);
        let found = window
            .find(&[compact("Call me Ishmael, some years")], 0)
            .unwrap();
        assert!(window.raw[found..].starts_with("Call"));
        assert_eq!(
            window.offset_before(found),
            1000 + "Header café 😀 line.\n\n".encode_utf16().count() as u64
        );
        assert_eq!(window.cursor(found), (3, found));
        let later = window
            .find(&[compact("Loomings came next")], found)
            .unwrap();
        assert_eq!(
            window.offset_before(later),
            1000 + parts[0].encode_utf16().count() as u64
        );
        assert_eq!(window.cursor(later), (4, 0));
        assert_eq!(
            window.find(&[compact("Call me Ishmael")], later),
            None,
            "the text is searched forward from the last picture"
        );
    }
}

//! A book's text, fetched once from its source and kept in the space every
//! person shares, then served to the browser in parts.
//!
//! * `GET /api/books/text/<book>`: the book's index, `{"id", "source",
//!   "credit", "licence", "link", "title"?, "author"?, "language"?, "parts":
//!   [n, ...], "complete", "truncated", "start", "toc": [{"title", "at"}]}`.
//!   `parts` are the lengths of the parts in UTF-16 code units, which is how
//!   the browser counts a string, so an offset into the whole text (a place,
//!   a bookmark, a highlight) names the same character everywhere. `start`
//!   is where the reading text begins (after Project Gutenberg's header, which
//!   stays in the text, as does its licence at the end). `toc` lists the
//!   chapter headings found in the text.
//! * `GET /api/books/text/<book>/<n>`: `{"part": n, "text", "parts",
//!   "complete", "truncated"}`.
//!
//! The first request for a book fetches it: for Project Gutenberg, first the
//! book's OPDS record, and Books refuses a book whose rights are not "public
//! domain" or that is not a text; then the text itself, as a stream
//! (`news/fetch.rs`), because a buffered egress reply is refused above
//! 1 MiB. A round reads at most [`ROUND_BYTES`] within the time left under the
//! gateway's 8 seconds. When it is cut, the text up to the last whole
//! paragraph is kept and the index records the byte to go on from; the
//! request for the next part fetches the rest with an HTTP `Range` request.
//! So a book of any length arrives in rounds. Egress passes no response
//! headers (no `Content-Range`, no `ETag`), so the book
//! is complete only when the source says nothing follows: a whole file read
//! to its end (`200`), an empty range, or `416`. A range that ends by itself
//! may be the end of the file or a source sending less than it was asked
//! for, so the round asks for the one byte after it: only when the source
//! answers that nothing is there is the reply kept whole and the book
//! complete; otherwise it is kept to its last whole paragraph, as a cut reply
//! is, and the next round asks again from there ([`ending`]). So a word, a
//! tag or an entity is never split between two rounds.
//! A claim key keeps two requests from fetching the same book at once: the
//! second waits briefly for the first and then reads what it kept.
//!
//! The rounds of one book must read one edition of its file. Without a
//! validator from the source, each round after the first asks for the
//! [`SEAM_BYTES`] before the byte it goes on from as well, and checks them
//! against the SHA-256 the index keeps of the source bytes the last round
//! ended with. A file that changed length before that point (an edition with
//! a line added or removed) no longer matches there, and the book is not
//! continued: what is kept stays as it is, marked `changed` and `truncated`,
//! so places, bookmarks and highlights keep naming the words they named. An
//! edit earlier in the file that keeps its length is not seen; the text then
//! joins the earlier edition's words to the later one's at a paragraph,
//! which shifts no offset.
//!
//! A kept book is kept until the cache needs its room: places, bookmarks and highlights are
//! offsets into the text as it was kept, and fetching it again could move them, so a book is
//! never fetched again while it is kept. The cache holds at most [`MAX_CACHED_BOOKS`] books and
//! [`MAX_CACHED_BYTES`] bytes of their parts, recorded in `text/cache`; each answer for a book
//! notes its use there (at most once a [`USE_STEP_MS`]), and when the cache is over either limit
//! the books used longest ago go whole, index first, then their parts. A book that went is
//! fetched again from its source when it is next opened; from the same edition the text is the
//! same, while from an edition changed since, offsets kept for it may name other words (the
//! reading keeps each bookmark's and highlight's words, which show what it named).
//!
//! Shared keys (`apps/books/shared/`):
//!
//! * `text/cache`: `{"books": {"<book>": {"bytes", "used"}}}`, the books kept, the bytes of
//!   their parts and when each was last answered;
//! * `text/<book>/index`: the index above, with the byte to continue from,
//!   the seam's digest and the generation of each part;
//! * `text/<book>/g<generation>/part/<n>`: part `n`, UTF-8, at most
//!   [`PART_BYTES`]. Each round draws a new generation (16 hex digits) for
//!   the parts it writes;
//! * `text/<book>/claim`: the fetch under way, `{"token", "until"}`, created
//!   only where none is kept, expiring in the store after 15 seconds, and
//!   removed by the request whose random token it names when it is done, so
//!   no claim outlives its fetch, whatever id a request names.
//!
//! Every part is written before the index names it, and the index is
//! replaced with compare-and-set, so a reader never sees a part named that
//! is not there, and a slow round never takes an index back. A part's key is
//! never written twice: a round that loses the compare-and-set wrote under
//! its own generation, which no index names, so it cannot change text an
//! index names, and it removes what it wrote. The request that takes the
//! claim reads the index again before it fetches, so it goes on from what
//! another request kept in the meantime.

use std::collections::BTreeMap;

use ferrite_app::{serde, serde_json};

use super::source::{BookId, Source, EGRESS};
use super::store::{fetch_failure, gutenberg_record};
use crate::apps::news::feed::{clip, html_to_text};
use crate::apps::news::fetch::{self, FetchError};
use crate::http::Response;
use crate::module::Space;

/// The most bytes of one stored part (a store value is kept under 200 KB).
pub const PART_BYTES: usize = 160_000;
/// The most bytes of the source one round reads.
pub const ROUND_BYTES: usize = 2_400_000;
/// The most parts a book keeps: about 19 MB of text. A longer source is
/// marked `truncated`.
pub const MAX_PARTS: usize = 120;
/// The most headings the contents list keeps.
pub const MAX_TOC: usize = 600;
/// The time one request may spend fetching, under the gateway's 8 seconds.
const FETCH_BUDGET_MS: u64 = 5_200;
/// The time the record of a Gutenberg book may take, of that budget.
const RECORD_BUDGET_MS: u64 = 2_000;
const RECORD_BYTES: usize = 512 * 1024;
/// How long a claim on a fetch lasts, and how long a second request waits.
const CLAIM_MS: u64 = 15_000;
const WAIT_MS: u64 = 5_000;
const WAIT_STEP_MS: u64 = 400;
/// How many source bytes before the place a round goes on from it reads again, to check that
/// the source is the edition the earlier rounds read.
pub const SEAM_BYTES: usize = 4096;
/// The most books the shared text cache keeps.
pub const MAX_CACHED_BOOKS: usize = 200;
/// The most bytes of parts the shared text cache keeps: some eight books of the longest kind.
pub const MAX_CACHED_BYTES: u64 = 150_000_000;
/// How often a book's use is written down while it is read, in milliseconds.
pub const USE_STEP_MS: u64 = 60_000;
/// The key of the cache's record of the books it keeps.
const CACHE_KEY: &str = "text/cache";
/// How many times noting a use is tried again when another request changed the record first.
const CACHE_TRIES: usize = 5;
/// What a book's index is replaced with while the cache lets the book go: read as no index, and,
/// being a value, it keeps any round from writing an index (whose compare-and-set expects none,
/// or the version it read) until the book's parts are gone and the mark is removed.
const GONE: &[u8] = b"{\"gone\":true}";
/// How long the mark lasts at most, should the request letting the book go not remove it.
const GONE_MS: u64 = 60_000;

/// One heading of the contents list.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Heading {
    pub title: String,
    /// Its offset in the whole text, in UTF-16 units.
    pub at: u64,
}

/// A book's index, as kept and answered.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Default)]
#[serde(crate = "ferrite_app::serde")]
pub struct Index {
    pub id: String,
    pub source: String,
    pub credit: String,
    pub licence: String,
    pub link: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    /// Each part's length in UTF-16 units.
    pub parts: Vec<u64>,
    pub complete: bool,
    #[serde(default)]
    pub truncated: bool,
    /// The source byte the next round starts at.
    pub next: u64,
    /// Where the reading text begins, in UTF-16 units.
    pub start: u64,
    #[serde(default)]
    pub toc: Vec<Heading>,
    /// Whether the source changed while the book was being fetched in rounds: the book ends
    /// with what was kept before.
    #[serde(default)]
    pub changed: bool,
    /// Whether Project Gutenberg's "*** END OF ..." line has been read: no heading after it
    /// (its licence's sections) goes in the contents.
    #[serde(default)]
    pub ended: bool,
    /// The generation each part was written under.
    #[serde(default)]
    pub generations: Vec<u64>,
    /// The SHA-256 (hex) of the last `seam` source bytes before `next`.
    #[serde(default)]
    pub seam_digest: String,
    #[serde(default)]
    pub seam: u64,
    /// The bytes of the parts kept, for the cache's limit. An index kept before this was
    /// recorded has 0, and its book counts its UTF-16 units instead ([`stored_bytes`]).
    #[serde(default)]
    pub bytes: u64,
    /// Whether `toc` was found by the present rules. A book kept before them has its contents
    /// found again from its parts, once, when its index is next asked for ([`refresh_contents`]);
    /// its text and so every offset kept for it stay as they are.
    #[serde(default)]
    pub contents_current: bool,
}

impl Index {
    fn units(&self) -> u64 {
        self.parts.iter().sum()
    }
}

/// The bytes a book's parts take: as recorded, or at least its UTF-16 units (UTF-8 never takes
/// fewer bytes than UTF-16 units) for a book kept before the bytes were recorded.
fn stored_bytes(index: &Index) -> u64 {
    if index.bytes > 0 {
        index.bytes
    } else {
        index.units()
    }
}

// ---------------------------------------------------------------------------
// Turning a source into text
// ---------------------------------------------------------------------------

/// How many leading bytes of a cut Gutenberg chunk to keep: through its last
/// blank line, so no paragraph is split between rounds. A chunk with no blank
/// line keeps nothing: the round is refused rather than cut inside a
/// paragraph, a word or a character.
fn text_boundary(raw: &[u8]) -> usize {
    let find_last = |needle: &[u8]| raw.windows(needle.len()).rposition(|w| w == needle);
    let Some(at) = find_last(b"\n\r\n").or_else(|| find_last(b"\n\n")) else {
        return 0;
    };
    // Through the blank line.
    let after = at + 1;
    after
        + raw[after..]
            .iter()
            .take_while(|b| **b == b'\r' || **b == b'\n')
            .count()
}

/// The XHTML block ends a cut Standard Ebooks chunk may stop after.
const BLOCK_ENDS: &[&str] = &[
    "</p>",
    "</h1>",
    "</h2>",
    "</h3>",
    "</h4>",
    "</h5>",
    "</h6>",
    "</section>",
    "</article>",
    "</blockquote>",
    "</li>",
    "</tr>",
    "</table>",
    "</div>",
];

/// How many leading bytes of a cut XHTML chunk to keep: through its last
/// closing block tag.
pub(super) fn markup_boundary(raw: &[u8]) -> usize {
    BLOCK_ENDS
        .iter()
        .filter_map(|end| {
            raw.windows(end.len())
                .rposition(|w| w.eq_ignore_ascii_case(end.as_bytes()))
                .map(|at| at + end.len())
        })
        .max()
        .unwrap_or(0)
}

/// Whether a Gutenberg paragraph's lines are prose wrapped at a fixed width
/// (joined into one line) rather than verse, a table or an indented quote
/// (kept line by line).
fn is_wrapped_prose(lines: &[&str]) -> bool {
    lines.len() >= 2
        && lines[1..].iter().all(|line| !line.starts_with([' ', '\t']))
        && lines[..lines.len() - 1]
            .iter()
            .all(|line| line.trim().chars().count() >= 45)
}

/// The reading text of a chunk of a Gutenberg `.txt` file: line ends made
/// `\n`, a byte-order mark dropped, paragraphs separated by one blank line,
/// and prose paragraphs unwrapped into one line each.
pub fn gutenberg_text(chunk: &str) -> String {
    let text = chunk
        .trim_start_matches('\u{feff}')
        .replace("\r\n", "\n")
        .replace('\r', "\n");
    let mut paragraphs: Vec<String> = Vec::new();
    let mut lines: Vec<&str> = Vec::new();
    let mut flush = |lines: &mut Vec<&str>| {
        if lines.is_empty() {
            return;
        }
        let paragraph = if is_wrapped_prose(lines) {
            lines.iter().map(|l| l.trim()).collect::<Vec<_>>().join(" ")
        } else {
            lines
                .iter()
                .map(|l| l.trim_end())
                .collect::<Vec<_>>()
                .join("\n")
        };
        paragraphs.push(paragraph);
        lines.clear();
    };
    for line in text.split('\n') {
        if line.trim().is_empty() {
            flush(&mut lines);
        } else {
            lines.push(line);
        }
    }
    flush(&mut lines);
    paragraphs.join("\n\n")
}

/// The reading text of a chunk of Standard Ebooks' single-page XHTML: the
/// body's text, a paragraph per block (`podcasts/feed.rs`, `html_to_text`).
pub fn markup_text(chunk: &str, first: bool) -> String {
    let body = if first {
        let lower = chunk.to_ascii_lowercase();
        lower.find("<body").map_or(chunk, |at| &chunk[at..])
    } else {
        chunk
    };
    html_to_text(body)
}

/// The length of `text` in UTF-16 units.
fn units(text: &str) -> u64 {
    text.encode_utf16().count() as u64
}

/// `text` cut into parts of at most `max` bytes, each ending after a blank
/// line where one falls in its second half, else after a line, a space, or a
/// character.
pub fn split_parts(text: &str, max: usize) -> Vec<&str> {
    let mut parts = Vec::new();
    let mut rest = text;
    while rest.len() > max {
        let mut limit = max;
        while !rest.is_char_boundary(limit) {
            limit -= 1;
        }
        let window = &rest[..limit];
        let half = limit / 2;
        let cut = ["\n\n", "\n", " "]
            .iter()
            .find_map(|sep| {
                window
                    .rfind(sep)
                    .map(|at| at + sep.len())
                    .filter(|at| *at > half)
            })
            .unwrap_or(limit);
        parts.push(&rest[..cut]);
        rest = &rest[cut..];
    }
    if !rest.is_empty() {
        parts.push(rest);
    }
    parts
}

/// Words that open a heading when a number, a numeral or a word follows.
const NUMBERED: &[&str] = &[
    "chapter",
    "book",
    "part",
    "act",
    "scene",
    "letter",
    "stave",
    "canto",
    "volume",
    "section",
    "lecture",
    "essay",
    "story",
    "adventure",
];
/// Words that are a heading by themselves.
const ALONE: &[&str] = &[
    "prologue",
    "epilogue",
    "preface",
    "introduction",
    "conclusion",
    "afterword",
    "foreword",
    "appendix",
    "postscript",
];

/// Whether a paragraph reads as a chapter heading: one short line that
/// starts with "Chapter 1", "BOOK III.", "Stave One", "Preface" and so on,
/// perhaps with its title on a second line ("CHAPTER I." over "Down the
/// Rabbit-Hole"); or a numeral and a title in capitals ("I. A SCANDAL IN
/// BOHEMIA"). Wrapped prose fills its first line, so a heading's first line
/// under a title is short.
pub fn is_heading(paragraph: &str) -> bool {
    let mut lines = paragraph.trim().lines().map(str::trim);
    let line = lines.next().unwrap_or("");
    let title = lines.next();
    if line.is_empty() || lines.next().is_some() {
        return false;
    }
    let first_limit = if title.is_some() { 40 } else { 80 };
    if line.chars().count() > first_limit || title.is_some_and(|t| t.chars().count() > 80) {
        return false;
    }
    if title.is_none() && is_numeral_and_title(line) {
        return true;
    }
    let mut words = line.split(|c: char| c.is_whitespace() || c == '.' || c == ':');
    let first = words.next().unwrap_or("").to_lowercase();
    if ALONE.contains(&first.as_str()) {
        return true;
    }
    if !NUMBERED.contains(&first.as_str()) {
        return false;
    }
    let Some(second) = words.find(|w| !w.is_empty()) else {
        return false;
    };
    let numeral =
        second.chars().all(|c| "IVXLCDM".contains(c)) || second.chars().all(|c| c.is_ascii_digit());
    numeral
        || second.chars().next().is_some_and(char::is_uppercase)
        || second.eq_ignore_ascii_case("the")
}

/// Whether a paragraph is a roman numeral alone ("IV", "XII."): how Standard
/// Ebooks titles most chapters.
fn is_numeral(paragraph: &str) -> bool {
    let line = paragraph.trim().trim_end_matches('.');
    (1..=8).contains(&line.len()) && line.chars().all(|c| "IVXLCDM".contains(c))
}

/// Whether a line is a roman numeral and a title in capitals: "II. THE RED-HEADED LEAGUE".
fn is_numeral_and_title(line: &str) -> bool {
    let Some((numeral, title)) = line.split_once(". ") else {
        return false;
    };
    is_numeral(numeral)
        && !title.chars().any(char::is_lowercase)
        && title.chars().filter(|c| c.is_alphabetic()).count() >= 2
}

/// The headings of `text`, which begins at `base` UTF-16 units into the book;
/// `numerals`: a roman numeral alone is a heading too.
fn headings(text: &str, base: u64, numerals: bool) -> Vec<Heading> {
    let mut out = Vec::new();
    let mut offset = base;
    for (index, paragraph) in text.split("\n\n").enumerate() {
        if index > 0 {
            offset += 2;
        }
        if is_heading(paragraph) || (numerals && is_numeral(paragraph)) {
            let lead = paragraph.len() - paragraph.trim_start().len();
            let title = paragraph
                .trim()
                .lines()
                .map(str::trim)
                .collect::<Vec<_>>()
                .join(" ");
            out.push(Heading {
                title: clip(&title, 80),
                at: offset + units(&paragraph[..lead]),
            });
        }
        offset += units(paragraph);
    }
    out
}

/// Add `found` to the contents list. Every heading is kept, so a title
/// repeated in a later volume is listed again; only the same heading at the
/// same offset is not added twice.
fn add_headings(toc: &mut Vec<Heading>, found: Vec<Heading>) {
    for heading in found {
        if toc.len() < MAX_TOC && !toc.contains(&heading) {
            toc.push(heading);
        }
    }
}

/// Where Project Gutenberg's "*** END OF THE PROJECT GUTENBERG EBOOK ... ***" line starts in
/// `text`, a byte offset.
pub fn gutenberg_end(text: &str) -> Option<usize> {
    let lower = text.to_lowercase();
    let markers = [
        "*** end of the project gutenberg",
        "*** end of this project gutenberg",
    ];
    markers
        .iter()
        .filter_map(|m| lower.find(m))
        .min()
        .filter(|at| text.is_char_boundary(*at))
}

/// Where the reading text of a Gutenberg book begins: the paragraph after its
/// "*** START OF THE PROJECT GUTENBERG EBOOK ... ***" line, or 0.
pub fn gutenberg_start(text: &str) -> u64 {
    let lower = text.to_lowercase();
    let markers = [
        "start of the project gutenberg",
        "start of this project gutenberg",
    ];
    let Some(at) = markers.iter().filter_map(|m| lower.find(m)).min() else {
        return 0;
    };
    // `to_lowercase` can change lengths outside ASCII; the header is ASCII,
    // but a byte offset is checked before it is used.
    if !text.is_char_boundary(at) {
        return 0;
    }
    let Some(end) = text[at..].find('\n').map(|n| at + n) else {
        return 0;
    };
    let next = end + text[end..].len() - text[end..].trim_start().len();
    units(&text[..next])
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

/// Why a request got no text.
pub struct Refusal(Response);

impl From<FetchError> for Refusal {
    fn from(error: FetchError) -> Self {
        Refusal(fetch_failure(&error))
    }
}

fn refuse(status: u16, message: &str) -> Refusal {
    Refusal(Response::error(status, message))
}

fn storage(error: std::io::Error) -> Refusal {
    refuse(503, &format!("storage failed: {error}"))
}

/// The index of a book not fetched yet: who to credit and what the rights
/// are, read from the Gutenberg record (one request) or known for Standard
/// Ebooks.
async fn new_index(ctx: &ferrite_app::AppContext, book: &BookId) -> Result<Index, Refusal> {
    let mut index = Index {
        id: book.as_string(),
        source: book.source().as_str().into(),
        credit: book.source().credit().into(),
        link: book.page_url(),
        contents_current: true,
        ..Index::default()
    };
    match book {
        BookId::Gutenberg(_) => {
            let url = book.record_url().unwrap_or_default();
            let accept = "application/atom+xml, application/xml;q=0.9";
            let fetched =
                fetch::get(ctx, EGRESS, &url, accept, RECORD_BYTES, RECORD_BUDGET_MS).await?;
            if matches!(fetched.status, 404 | 410) {
                return Err(refuse(404, "Project Gutenberg has no such book"));
            }
            if fetched.status != 200 {
                return Err(refuse(
                    502,
                    &format!("Project Gutenberg answered HTTP {}", fetched.status),
                ));
            }
            let record =
                gutenberg_record(&String::from_utf8_lossy(&fetched.body)).ok_or_else(|| {
                    refuse(
                        502,
                        "Project Gutenberg's record of the book could not be read",
                    )
                })?;
            let rights = record.rights.clone().unwrap_or_default();
            if !rights.to_lowercase().contains("public domain") {
                return Err(refuse(
                    403,
                    &format!("Books reads only public-domain books, and this one says: {rights}"),
                ));
            }
            if !record.text {
                return Err(refuse(404, "This book has no text: it is an audio book"));
            }
            index.licence = rights;
            index.title = record.title;
            index.author = record.author;
            index.language = record.language;
        }
        BookId::StandardEbooks(_) => {
            index.licence = "Public domain in the United States; Standard Ebooks' own work is dedicated to the public domain under CC0 1.0.".into();
        }
    }
    Ok(index)
}

/// What one round brought.
struct Round {
    text: String,
    /// The source byte the next round starts at.
    next: u64,
    complete: bool,
    /// The digest of the source bytes before `next` and how many they are ([`SEAM_BYTES`] or
    /// fewer), for the next round to check.
    seam_digest: String,
    seam: u64,
    /// The source no longer matches the seam the index kept: nothing of this round is kept.
    changed: bool,
}

impl Round {
    fn ended(at: u64, seam_digest: &str, seam: u64) -> Round {
        Round {
            text: String::new(),
            next: at,
            complete: true,
            seam_digest: seam_digest.to_string(),
            seam,
            changed: false,
        }
    }

    fn changed(at: u64) -> Round {
        Round {
            text: String::new(),
            next: at,
            complete: true,
            seam_digest: String::new(),
            seam: 0,
            changed: true,
        }
    }
}

fn digest(bytes: &[u8]) -> String {
    ferrite_app::crypto::hex(&ferrite_app::crypto::sha256(bytes))
}

/// Whether `body`, a reply that starts `seam` bytes before the place the round goes on from,
/// starts with the bytes whose digest the index kept.
fn seam_matches(body: &[u8], seam: usize, kept: &str) -> bool {
    body.len() >= seam && digest(&body[..seam]) == kept
}

/// How a round's reply ends, which says what of it to keep and whether the book ends there.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Ending {
    /// Cut by the byte limit or the time budget, or a range that stopped short of the end of
    /// the file: its whole paragraphs are kept, and the next round asks again from the first
    /// byte after them, so a word, a tag or an entity is never split between two rounds.
    Cut,
    /// A range that ended by itself before the byte limit. Without `Content-Range` it may be
    /// the end of the file or a source that sends less than it was asked for; [`read_round`]
    /// asks for the byte after it to tell which, and keeps it as [`Ending::End`] or as a cut
    /// reply.
    Short,
    /// Nothing follows: the book ends with this reply, all of which is kept.
    End,
}

/// How a reply of `status` (200, 206 or 416) holding `got` bytes ends; `cut`: the fetch
/// stopped before the reply did.
fn ending(status: u16, got: usize, cut: bool) -> Ending {
    match status {
        // Nothing at or after the byte asked for.
        416 => Ending::End,
        _ if cut => Ending::Cut,
        // A range that holds something: only a reply that holds nothing more ends the book.
        206 if got > 0 => Ending::Short,
        // The whole file read to its end, or an empty range.
        _ => Ending::End,
    }
}

/// How many leading bytes of a reply's `body` a round keeps: all of it at the end of the file,
/// else through its last whole paragraph. A short range not yet known to end the file is kept
/// as a cut one is.
fn kept_bytes(ending: Ending, body: &[u8], markup: bool) -> usize {
    match ending {
        Ending::End => body.len(),
        Ending::Cut | Ending::Short if markup => markup_boundary(body),
        Ending::Cut | Ending::Short => text_boundary(body),
    }
}

/// The least time left for asking whether a short range ended the file.
const PROBE_MIN_MS: u64 = 300;

/// Whether the source holds nothing at or after byte `at`, asked for that one byte: `Some(true)`
/// for `416` or an empty range, `Some(false)` when it sends a byte, `None` when it does not
/// say (an error, a status it should not send, or no time left).
async fn file_ends_at(
    ctx: &ferrite_app::AppContext,
    url: &str,
    accept: &str,
    at: u64,
    budget_ms: u64,
) -> Option<bool> {
    if budget_ms < PROBE_MIN_MS {
        return None;
    }
    let range = format!("bytes={at}-{at}");
    let probe = fetch::get_with(
        ctx,
        EGRESS,
        url,
        accept,
        &[("range", &range)],
        64,
        budget_ms,
    )
    .await
    .ok()?;
    probe_ends(probe.status, probe.body.is_empty(), probe.cut)
}

/// What a one-byte probe's reply says about the file ending at the byte asked for: `Some(true)`
/// for `416` or an empty range read to its end, `Some(false)` for a byte, `None` otherwise. A
/// reply the fetch stopped before its end says nothing, empty or not.
fn probe_ends(status: u16, empty: bool, cut: bool) -> Option<bool> {
    match status {
        416 => Some(true),
        206 if !cut => Some(empty),
        _ => None,
    }
}

/// Where a reply puts a round that goes on from the index's `next`.
#[derive(Debug, PartialEq)]
enum Placed {
    /// The source is not the edition the earlier rounds read.
    Changed,
    /// Nothing follows what is kept.
    Ended,
    /// The reply's bytes from the seam on: `seam` bytes already kept, then the new ones.
    Body { body: Vec<u8>, seam: usize },
}

/// The range a round asks for, from the seam before `at`, and the seam's length.
fn round_range(index: &Index) -> (Option<String>, usize) {
    let at = index.next;
    if at == 0 {
        return (None, 0);
    }
    let seam = index.seam.min(at);
    let range = format!("bytes={}-{}", at - seam, at + ROUND_BYTES as u64 - 1);
    (Some(range), seam as usize)
}

/// Place a reply of `status` and `body` (`cut`: the fetch stopped before its end) to the range
/// [`round_range`] asked for.
fn place(index: &Index, status: u16, mut body: Vec<u8>, cut: bool) -> Result<Placed, Refusal> {
    let at = index.next;
    let (_, seam) = round_range(index);
    let from = at - seam as u64;
    match status {
        200 if at > 0 => {
            // The range was not honoured: the body starts at byte 0.
            if (body.len() as u64) < from {
                if !cut {
                    // The whole file ends before the seam: it is not the file the rounds read.
                    return Ok(Placed::Changed);
                }
                return Err(refuse(
                    502,
                    "the book source does not answer part of a book",
                ));
            }
            body.drain(..from as usize);
        }
        200 | 206 => {}
        // Nothing at or after the seam: the file is shorter than what was read of it.
        416 if seam > 0 => return Ok(Placed::Changed),
        416 => return Ok(Placed::Ended),
        404 | 410 => return Err(refuse(404, "the book source has no text of this book")),
        status => {
            return Err(refuse(
                502,
                &format!("the book source answered HTTP {status}"),
            ))
        }
    }
    if at > 0 && !seam_matches(&body, seam, &index.seam_digest) {
        if body.len() < seam && cut {
            return Err(refuse(
                502,
                "the book source sent too little in time; open the book again",
            ));
        }
        return Ok(Placed::Changed);
    }
    Ok(Placed::Body { body, seam })
}

/// The round a placed body makes, ending as `ending` says.
fn finish(
    at: u64,
    body: &[u8],
    seam: usize,
    ending: Ending,
    markup: bool,
) -> Result<Round, Refusal> {
    let keep = kept_bytes(ending, &body[seam..], markup);
    if ending != Ending::End && keep == 0 {
        return Err(refuse(
            502,
            "the book source sent too little in time; open the book again",
        ));
    }
    // The next seam: the last source bytes this round keeps, with the earlier seam's when the
    // round keeps fewer than a seam's worth.
    let through = seam + keep;
    let next_seam = through.min(SEAM_BYTES);
    let chunk = String::from_utf8_lossy(&body[seam..through]);
    let text = if markup {
        markup_text(&chunk, at == 0)
    } else {
        gutenberg_text(&chunk)
    };
    Ok(Round {
        text,
        next: at + keep as u64,
        complete: ending == Ending::End,
        seam_digest: digest(&body[through - next_seam..through]),
        seam: next_seam as u64,
        changed: false,
    })
}

/// Read the source from the index's `next`, within `budget_ms`. A round after the first reads
/// the seam before it too and checks it.
async fn read_round(
    ctx: &ferrite_app::AppContext,
    book: &BookId,
    index: &Index,
    budget_ms: u64,
) -> Result<Round, Refusal> {
    let started = ctx.now_ms();
    let at = index.next;
    let url = book.text_url();
    let accept = match book.source() {
        Source::StandardEbooks => "application/xhtml+xml, text/html;q=0.9",
        Source::Gutenberg => "text/plain",
    };
    let (range, seam) = round_range(index);
    let extra: Vec<(&str, &str)> = range.as_deref().map(|r| ("range", r)).into_iter().collect();
    let fetched = fetch::get_with(
        ctx,
        EGRESS,
        &url,
        accept,
        &extra,
        ROUND_BYTES + seam,
        budget_ms,
    )
    .await?;
    let (body, seam) = match place(index, fetched.status, fetched.body, fetched.cut)? {
        Placed::Changed => return Ok(Round::changed(at)),
        Placed::Ended => return Ok(Round::ended(at, &index.seam_digest, index.seam)),
        Placed::Body { body, seam } => (body, seam),
    };
    let after_seam = body.len() - seam;
    let mut ending = ending(fetched.status, after_seam, fetched.cut);
    if ending == Ending::Short {
        // Only the source can say whether the file ends here. Until it does, the reply is
        // kept as a cut one, and its last paragraph is asked for again by the next round.
        let after = at + after_seam as u64;
        let left = budget_ms.saturating_sub(ctx.now_ms().saturating_sub(started));
        if file_ends_at(ctx, &url, accept, after, left).await == Some(true) {
            ending = Ending::End;
        }
    }
    finish(
        at,
        &body,
        seam,
        ending,
        book.source() == Source::StandardEbooks,
    )
}

fn index_key(book: &BookId) -> String {
    format!("text/{}/index", book.as_string())
}

fn claim_key(book: &BookId) -> String {
    format!("text/{}/claim", book.as_string())
}

/// A book's fetch claim: the request holding it (its random token) and until when.
#[derive(serde::Serialize, serde::Deserialize, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
struct Claim {
    token: u64,
    until: u64,
}

/// Whether a claim kept as `stored` may be taken at `now_ms`: it has run out (the store has not
/// removed it yet). A value that is not a claim may be taken too.
fn claim_free(stored: &[u8], now_ms: u64) -> bool {
    serde_json::from_slice::<Claim>(stored).map_or(true, |held| held.until <= now_ms)
}

/// Whether the claim kept as `stored` is held by `token`.
fn claim_held_by(stored: &[u8], token: u64) -> bool {
    serde_json::from_slice::<Claim>(stored).is_ok_and(|held| held.token == token)
}

/// Take the fetch claim `key` for `token` for [`CLAIM_MS`]: create it, expiring, where none is
/// kept. One that has run out but is still in the store is removed first. Two requests that
/// both find it run out may both go on to fetch; the index's compare-and-set keeps one round.
async fn take_claim(
    shared: &mut Space<'_>,
    key: &str,
    token: u64,
    now_ms: u64,
) -> Result<bool, Refusal> {
    let until = now_ms + CLAIM_MS;
    let mine =
        serde_json::to_vec(&Claim { token, until }).map_err(|e| refuse(500, &e.to_string()))?;
    match shared.get(key).await.map_err(storage)? {
        Some(stored) if !claim_free(&stored, now_ms) => return Ok(false),
        Some(_) => shared.delete(key).await.map_err(storage)?,
        None => {}
    }
    shared
        .create_expiring(key, &mine, until)
        .await
        .map_err(storage)
}

/// Let go of the fetch claim `key` while `token` holds it, by removing it. A request that ran
/// past its claim leaves the one a later request took (barring the moment between the read and
/// the removal, which costs at most a second fetch, as above).
async fn release_claim(shared: &mut Space<'_>, key: &str, token: u64) {
    match shared.get(key).await {
        Ok(Some(stored)) if claim_held_by(&stored, token) => {
            if let Err(error) = shared.delete(key).await {
                ferrite_app::tracing::warn!(%error, "could not release a Books fetch claim");
            }
        }
        Ok(_) => {}
        Err(error) => ferrite_app::tracing::warn!(%error, "could not read a Books fetch claim"),
    }
}

/// The key of part `part` written under `generation` (never 0).
fn part_key(book: &BookId, generation: u64, part: usize) -> String {
    format!("text/{}/g{generation:016x}/part/{part}", book.as_string())
}

/// Where part `part` of a book is kept: under the generation the index names for it.
fn stored_part_key(index: &Index, book: &BookId, part: usize) -> Option<String> {
    index
        .generations
        .get(part)
        .filter(|generation| **generation != 0)
        .map(|generation| part_key(book, *generation, part))
}

/// A generation for the parts one round writes: unpredictable, so no two rounds share one, and
/// never 0, which names none.
fn new_generation() -> Result<u64, Refusal> {
    crate::crypto::random_u64()
        .map(|value| value.max(1))
        .map_err(|e| {
            refuse(
                503,
                &format!("no random generation for the book's parts: {e}"),
            )
        })
}

/// Remove parts a round wrote that no index names. A part left behind takes space but is never
/// read, so a failure is only logged.
async fn discard(shared: &mut Space<'_>, keys: &[String]) {
    for key in keys {
        if let Err(error) = shared.delete(key).await {
            ferrite_app::tracing::warn!(%error, key, "could not remove a Books part no index names");
        }
    }
}

async fn read_index(
    shared: &mut Space<'_>,
    book: &BookId,
) -> Result<Option<(Index, u64)>, Refusal> {
    match shared
        .get_versioned(&index_key(book))
        .await
        .map_err(storage)?
    {
        None => Ok(None),
        // A book the cache is letting go is not kept.
        Some((bytes, _)) if bytes == GONE => Ok(None),
        Some((bytes, version)) => serde_json::from_slice(&bytes)
            .map(|index| Some((index, version)))
            .map_err(|e| {
                refuse(
                    503,
                    &format!("the kept index of the book is unreadable: {e}"),
                )
            }),
    }
}

/// Keep a round's text as the next parts of the book and answer the new
/// index; `version` is the index's version it was based on (`None`: none).
async fn keep_round(
    shared: &mut Space<'_>,
    book: &BookId,
    mut index: Index,
    version: Option<u64>,
    round: Round,
) -> Result<Index, Refusal> {
    if round.changed {
        // The source is another edition now: the book ends with what was kept of the first.
        index.changed = true;
        index.truncated = true;
        index.complete = true;
        return save_index(shared, book, index, version, &[]).await;
    }
    let first = index.parts.is_empty();
    let trimmed = round.text.trim_matches('\n');
    let text = if first || trimmed.is_empty() {
        trimmed.to_string()
    } else {
        format!("\n\n{trimmed}")
    };
    let base = index.units();
    let gutenberg = book.source() == Source::Gutenberg;
    if first && gutenberg {
        index.start = gutenberg_start(&text);
    }
    if !index.ended {
        // Project Gutenberg's licence follows its END line: its sections are no chapters.
        let end = if gutenberg {
            gutenberg_end(&text)
        } else {
            None
        };
        let read = &text[..end.unwrap_or(text.len())];
        add_headings(
            &mut index.toc,
            headings(read, base, book.source() == Source::StandardEbooks),
        );
        index.ended = end.is_some();
    }
    let mut complete = round.complete;
    let generation = new_generation()?;
    let mut written = Vec::new();
    for piece in split_parts(&text, PART_BYTES) {
        if index.parts.len() >= MAX_PARTS {
            index.truncated = true;
            complete = true;
            break;
        }
        let part = index.parts.len();
        let key = part_key(book, generation, part);
        if let Err(error) = shared.put(&key, piece.as_bytes()).await {
            discard(shared, &written).await;
            return Err(storage(error));
        }
        written.push(key);
        count_part(&mut index, generation, piece);
    }
    // A round that ends with the most parts kept, the source not finished, ends the book: no
    // part past them is served, so no round could add one.
    if !complete && index.parts.len() >= MAX_PARTS {
        index.truncated = true;
        complete = true;
    }
    if index.truncated {
        let kept = index.units();
        index.toc.retain(|h| h.at < kept);
    }
    index.complete = complete;
    index.next = round.next;
    index.seam_digest = round.seam_digest;
    index.seam = round.seam;
    save_index(shared, book, index, version, &written).await
}

/// Add `piece`, written under `generation`, to the index as its next part: its generation, its
/// length in UTF-16 units and its bytes. An index kept before its bytes were recorded first counts
/// the parts it has (as their UTF-16 units, [`stored_bytes`]), so they are not left out.
fn count_part(index: &mut Index, generation: u64, piece: &str) {
    if index.bytes == 0 {
        index.bytes = index.units();
    }
    let part = index.parts.len();
    index.generations.resize(part, 0);
    index.generations.push(generation);
    index.parts.push(units(piece));
    index.bytes += piece.len() as u64;
}

/// Replace the index kept at `version` with `index`; when another round got there first, remove
/// the parts this one `written` and answer the index that round kept.
async fn save_index(
    shared: &mut Space<'_>,
    book: &BookId,
    index: Index,
    version: Option<u64>,
    written: &[String],
) -> Result<Index, Refusal> {
    let bytes = serde_json::to_vec(&index).map_err(|e| refuse(500, &e.to_string()))?;
    // A failed write may still have landed, so its parts stay: they may be named now.
    if shared
        .put_if_version(&index_key(book), &bytes, version)
        .await
        .map_err(storage)?
    {
        return Ok(index);
    }
    // Another round got there first: what it kept is the index, and this round's parts, under
    // a generation no index names, go.
    discard(shared, written).await;
    read_index(shared, book)
        .await?
        .map(|(index, _)| index)
        .ok_or_else(|| refuse(503, "the book's index changed during the fetch"))
}

/// The book's index, fetching what it needs: the first round when nothing is
/// kept, the next round when `want` (a part number) is past what is kept and
/// the book is not complete.
async fn ensure(
    shared: &mut Space<'_>,
    ctx: &ferrite_app::AppContext,
    now_ms: u64,
    book: &BookId,
    want: usize,
) -> Result<Index, Refusal> {
    let enough = |index: &Index| want < index.parts.len() || index.complete;
    let kept = read_index(shared, book).await?;
    if let Some((index, _)) = &kept {
        if enough(index) {
            return Ok(index.clone());
        }
    }
    let claim = claim_key(book);
    let token = new_generation()?;
    if !take_claim(shared, &claim, token, now_ms).await? {
        // Another request is fetching this book: wait for it to keep the part wanted.
        let started = ctx.now_ms();
        while ctx.now_ms().saturating_sub(started) < WAIT_MS {
            ferrite_app::sleep_ms(WAIT_STEP_MS).await;
            if let Some((index, _)) = read_index(shared, book).await? {
                if enough(&index) {
                    return Ok(index);
                }
            }
        }
        return Err(Refusal(
            Response::error(
                503,
                "the book is still being fetched for another reader; try again in a moment",
            )
            .add_header("retry-after", "2"),
        ));
    }
    // Another request may have kept more, and let its claim go, since the index was read: what
    // is kept now is what this fetch goes on from.
    let outcome = match read_index(shared, book).await {
        Ok(Some((index, _))) if enough(&index) => Ok(index),
        Ok(current) => fetch_and_keep(shared, ctx, book, current).await,
        Err(refusal) => Err(refusal),
    };
    release_claim(shared, &claim, token).await;
    outcome
}

async fn fetch_and_keep(
    shared: &mut Space<'_>,
    ctx: &ferrite_app::AppContext,
    book: &BookId,
    kept: Option<(Index, u64)>,
) -> Result<Index, Refusal> {
    let started = ctx.now_ms();
    let (index, version) = match kept {
        Some((index, version)) => (index, Some(version)),
        None => (new_index(ctx, book).await?, None),
    };
    let left = FETCH_BUDGET_MS.saturating_sub(ctx.now_ms().saturating_sub(started));
    if left < 500 {
        return Err(refuse(
            502,
            "the book source was too slow; open the book again",
        ));
    }
    let round = read_round(ctx, book, &index, left).await?;
    keep_round(shared, book, index, version, round).await
}

/// A book kept before the present heading rules, with its contents found again from its kept
/// parts and saved. The time is checked before each part is read, so the gateway's limit is kept;
/// a scan that finished is saved, however long its last read took. Should a part be missing, the
/// store fail or the time run out first, the index is answered as it is and the next request tries
/// again.
async fn refresh_contents(
    shared: &mut Space<'_>,
    ctx: &ferrite_app::AppContext,
    book: &BookId,
    index: Index,
) -> Index {
    if index.contents_current || !index.complete {
        return index;
    }
    let Ok(Some((mut kept, version))) = read_index(shared, book).await else {
        return index;
    };
    let started = ctx.now_ms();
    let gutenberg = book.source() == Source::Gutenberg;
    let numerals = book.source() == Source::StandardEbooks;
    let mut toc = Vec::new();
    let mut base = 0;
    for (part, units) in kept.parts.clone().into_iter().enumerate() {
        if ctx.now_ms().saturating_sub(started) > FETCH_BUDGET_MS {
            return index;
        }
        let Some(key) = stored_part_key(&kept, book, part) else {
            return index;
        };
        let Ok(Some(bytes)) = shared.get(&key).await else {
            return index;
        };
        let text = String::from_utf8_lossy(&bytes);
        let end = if gutenberg {
            gutenberg_end(&text)
        } else {
            None
        };
        add_headings(
            &mut toc,
            headings(&text[..end.unwrap_or(text.len())], base, numerals),
        );
        if end.is_some() {
            break;
        }
        base += units;
    }
    kept.toc = toc;
    kept.contents_current = true;
    match save_index(shared, book, kept, Some(version), &[]).await {
        Ok(saved) => saved,
        Err(_) => index,
    }
}

fn index_reply(index: &Index) -> serde_json::Value {
    let mut value = serde_json::to_value(index).unwrap_or_default();
    if let Some(object) = value.as_object_mut() {
        for internal in [
            "next",
            "ended",
            "generations",
            "seam_digest",
            "seam",
            "bytes",
            "contents_current",
        ] {
            object.remove(internal);
        }
    }
    value
}

// ---------------------------------------------------------------------------
// The cache's limits
// ---------------------------------------------------------------------------

/// One book the cache keeps: the bytes of its parts and when it was last answered.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, Copy, PartialEq, Default)]
#[serde(crate = "ferrite_app::serde")]
pub struct Cached {
    pub bytes: u64,
    pub used: u64,
}

/// The cache's record of the books it keeps, by book id.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Default)]
#[serde(crate = "ferrite_app::serde")]
struct Record {
    #[serde(default)]
    books: BTreeMap<String, Cached>,
}

/// The books to let go so that `books` holds at most `max_books` books and `max_bytes` bytes:
/// those used longest ago first, never `keep` (the book being answered).
pub fn evictions(
    books: &BTreeMap<String, Cached>,
    keep: &str,
    max_books: usize,
    max_bytes: u64,
) -> Vec<String> {
    let mut count = books.len();
    let mut bytes: u64 = books.values().map(|book| book.bytes).sum();
    let mut oldest: Vec<(&String, &Cached)> =
        books.iter().filter(|(id, _)| id.as_str() != keep).collect();
    oldest.sort_by(|(a, x), (b, y)| x.used.cmp(&y.used).then_with(|| a.cmp(b)));
    let mut gone = Vec::new();
    for (id, book) in oldest {
        if count <= max_books && bytes <= max_bytes {
            break;
        }
        gone.push(id.clone());
        count -= 1;
        bytes = bytes.saturating_sub(book.bytes);
    }
    gone
}

/// Note that `book`, kept as `index`, was answered at `now_ms`, and let go of the books used
/// longest ago while the cache is over its limits. The record is replaced with compare-and-set,
/// so two requests never both keep a book the other let go. A failure only costs the record
/// a use, which the next answer notes; it is logged.
async fn note_use(shared: &mut Space<'_>, book: &BookId, index: &Index, now_ms: u64) {
    let id = book.as_string();
    let bytes = stored_bytes(index);
    for _ in 0..CACHE_TRIES {
        let (mut record, version) = match shared.get_versioned(CACHE_KEY).await {
            Ok(Some((stored, version))) => (
                serde_json::from_slice::<Record>(&stored).unwrap_or_default(),
                Some(version),
            ),
            Ok(None) => (Record::default(), None),
            Err(error) => {
                ferrite_app::tracing::warn!(%error, "could not read the Books text cache's record");
                return;
            }
        };
        // Read often, written seldom: a use within the last step changes nothing.
        if let Some(kept) = record.books.get(&id) {
            if kept.bytes == bytes && now_ms.saturating_sub(kept.used) < USE_STEP_MS {
                return;
            }
        }
        // A book the record does not list (new, or let go by another request a moment ago) is
        // put back: its index is written again below, which changes its version, so an eviction
        // that read the index before cannot mark it as going.
        let renewed = !record.books.contains_key(&id);
        record.books.insert(
            id.clone(),
            Cached {
                bytes,
                used: now_ms,
            },
        );
        let gone = evictions(&record.books, &id, MAX_CACHED_BOOKS, MAX_CACHED_BYTES);
        for other in &gone {
            record.books.remove(other);
        }
        let Ok(value) = serde_json::to_vec(&record) else {
            return;
        };
        match shared.put_if_version(CACHE_KEY, &value, version).await {
            Ok(true) => {
                if renewed {
                    renew_index(shared, book).await;
                }
                for other in gone {
                    forget_book(shared, &other, now_ms).await;
                }
                return;
            }
            // Another request changed the record first: read it again.
            Ok(false) => {}
            Err(error) => {
                ferrite_app::tracing::warn!(%error, "could not write the Books text cache's record");
                return;
            }
        }
    }
}

/// Write a book's index again as it is, which gives it a new version: an eviction that read the
/// version before cannot mark it as going ([`forget_book`]). An index another request changed or
/// let go of meanwhile is left as it is.
async fn renew_index(shared: &mut Space<'_>, book: &BookId) {
    let key = index_key(book);
    match shared.get_versioned(&key).await {
        Ok(Some((bytes, version))) if bytes != GONE => {
            if let Err(error) = shared.put_if_version(&key, &bytes, Some(version)).await {
                ferrite_app::tracing::warn!(%error, "could not renew a Books index");
            }
        }
        Ok(_) => {}
        Err(error) => {
            ferrite_app::tracing::warn!(%error, "could not read a Books index to renew it")
        }
    }
}

/// Let go of a book the cache no longer keeps, unless it was answered again since the record let
/// it go. The index's version is read first, then the record: a use that put the book back in the
/// record before this read is seen there, and one after it renewed the index ([`renew_index`]),
/// so the mark, written only at the version read, fails. Only then does the index go, replaced
/// with the [`GONE`] mark (a round that kept more since stays too, with its parts), so no reader
/// is told of a part that is going and no round can publish an index until the parts are gone;
/// then the parts, then the mark. A use between the record's read and the mark, whose renewal
/// comes after the mark, still loses the book: its reader is told a part is missing and the book
/// is fetched again. A part left behind is never read again; a failure is only logged.
async fn forget_book(shared: &mut Space<'_>, name: &str, now_ms: u64) {
    let Some(book) = BookId::parse(name) else {
        return;
    };
    let (index, version) = match read_index(shared, &book).await {
        Ok(Some(found)) => found,
        Ok(None) => return,
        Err(_) => {
            ferrite_app::tracing::warn!("could not read a Books index to let it go");
            return;
        }
    };
    match shared.get(CACHE_KEY).await {
        Ok(Some(stored)) => {
            let back = serde_json::from_slice::<Record>(&stored)
                .is_ok_and(|record| record.books.contains_key(name));
            if back {
                return;
            }
        }
        Ok(None) => {}
        Err(error) => {
            ferrite_app::tracing::warn!(%error, "could not read the Books text cache's record");
            return;
        }
    }
    let key = index_key(&book);
    match shared
        .put_if_version_expiring(&key, GONE, Some(version), now_ms + GONE_MS)
        .await
    {
        Ok(true) => {}
        // A round kept more of the book since: it stays.
        Ok(false) => return,
        Err(error) => {
            ferrite_app::tracing::warn!(%error, "could not mark a Books index as going");
            return;
        }
    }
    let keys: Vec<String> = (0..index.parts.len())
        .filter_map(|part| stored_part_key(&index, &book, part))
        .collect();
    discard(shared, &keys).await;
    super::pictures::forget(shared, &book).await;
    // The mark expires by itself if this fails.
    if let Err(error) = shared.delete(&key).await {
        ferrite_app::tracing::warn!(%error, "could not remove a Books index's mark");
    }
}

/// The index of a book whose whole text is kept; a refusal the page asks again after otherwise.
pub(super) async fn complete_index(
    shared: &mut Space<'_>,
    book: &BookId,
) -> Result<Index, Response> {
    match read_index(shared, book).await {
        Ok(Some((index, _))) if index.complete => Ok(index),
        Ok(_) => Err(
            Response::error(503, "the book is still being fetched; ask again")
                .add_header("retry-after", "2"),
        ),
        Err(Refusal(response)) => Err(response),
    }
}

/// The text of part `part` of a book as kept.
pub(super) async fn part_text(
    shared: &mut Space<'_>,
    book: &BookId,
    index: &Index,
    part: usize,
) -> Result<String, Response> {
    let missing = || Response::error(503, "a part of the book is missing; open it again");
    let key = stored_part_key(index, book, part).ok_or_else(missing)?;
    match shared.get(&key).await {
        Ok(Some(bytes)) => Ok(String::from_utf8_lossy(&bytes).into_owned()),
        Ok(None) => Err(missing()),
        Err(error) => Err(Response::error(503, &format!("storage failed: {error}"))),
    }
}

/// `GET /api/books/text/<book>[/<n>]`, `rest` being what follows `/text/`.
pub async fn answer(
    rest: &str,
    shared: &mut Space<'_>,
    ctx: &ferrite_app::AppContext,
    now_ms: u64,
) -> Response {
    let (id, part) = match rest.split_once('/') {
        Some((id, part)) => (id, Some(part)),
        None => (rest, None),
    };
    let Some(book) = BookId::parse(id) else {
        return Response::error(404, &format!("{id:?} is not a book Books can read"));
    };
    let part = match part.map(|p| {
        p.parse::<usize>()
            .ok()
            .filter(|n| p == n.to_string() && *n < MAX_PARTS)
    }) {
        None => None,
        Some(Some(n)) => Some(n),
        Some(None) => return Response::error(404, "no such part"),
    };
    let index = match ensure(shared, ctx, now_ms, &book, part.unwrap_or(0)).await {
        Ok(index) => index,
        Err(Refusal(response)) => return response,
    };
    let index = if part.is_none() {
        refresh_contents(shared, ctx, &book, index).await
    } else {
        index
    };
    note_use(shared, &book, &index, now_ms).await;
    let Some(n) = part else {
        return Response::json(200, &index_reply(&index));
    };
    if n >= index.parts.len() {
        // Only a complete book has no such part; one still being fetched may have it later.
        return if index.complete {
            Response::error(404, "the book has no such part")
        } else {
            Response::error(503, "the book is still being fetched; ask again")
                .add_header("retry-after", "2")
        };
    }
    let Some(key) = stored_part_key(&index, &book, n) else {
        return Response::error(503, "a part of the book is missing; open it again");
    };
    match shared.get(&key).await {
        Ok(Some(bytes)) => Response::json(
            200,
            &serde_json::json!({
                "part": n,
                "text": String::from_utf8_lossy(&bytes),
                "parts": index.parts,
                "complete": index.complete,
                "truncated": index.truncated,
            }),
        ),
        Ok(None) => Response::error(503, "a part of the book is missing; open it again"),
        Err(error) => Response::error(503, &format!("storage failed: {error}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gutenberg_prose_is_unwrapped_and_verse_kept() {
        let raw = "\u{feff}Title: Moby Dick\r\n\r\n\r\nCall me Ishmael. Some years ago--never mind how long precisely--having\r\nlittle or no money in my purse, and nothing particular to interest me\r\non shore.\r\n\r\n  Indented, kept\r\n  as it is\r\n\r\nShort line\r\nanother short\r\n";
        assert_eq!(
            gutenberg_text(raw),
            "Title: Moby Dick\n\nCall me Ishmael. Some years ago--never mind how long precisely--having little or no money in my purse, and nothing particular to interest me on shore.\n\n  Indented, kept\n  as it is\n\nShort line\nanother short"
        );
    }

    #[test]
    fn a_cut_chunk_ends_at_a_whole_paragraph() {
        let raw = b"One para\r\nline two\r\n\r\nSecond para that was cu";
        let keep = text_boundary(raw);
        assert_eq!(&raw[..keep], b"One para\r\nline two\r\n\r\n");
        assert_eq!(
            text_boundary(b"no newline \xC3"),
            0,
            "no blank line: nothing, never a cut inside a paragraph or a character"
        );
        assert_eq!(
            text_boundary(b"one line\r\nand half of the next"),
            0,
            "a line is no paragraph"
        );
        let markup = b"<body><p>One</p><p>Two</p><p>Thr";
        assert_eq!(
            &markup[..markup_boundary(markup)],
            b"<body><p>One</p><p>Two</p>"
        );
    }

    #[test]
    fn standard_ebooks_markup_becomes_paragraphs() {
        let page = r#"<?xml version="1.0"?><html><head><title>Emma</title><style>p{}</style></head>
<body><section><h2 epub:type="title">Chapter I</h2><p>Emma Woodhouse, handsome, clever, and rich&#8212;</p>
<p>Second &amp; last.</p></section></body></html>"#;
        assert_eq!(
            markup_text(page, true),
            "Chapter I\n\nEmma Woodhouse, handsome, clever, and rich—\n\nSecond & last."
        );
    }

    #[test]
    fn parts_end_at_paragraphs_and_count_utf16() {
        let text = format!("{}\n\n{}", "a".repeat(70), "b".repeat(40));
        let parts = split_parts(&text, 100);
        assert_eq!(parts.len(), 2);
        assert!(parts[0].ends_with("\n\n"));
        assert_eq!(parts.concat(), text, "nothing is lost or added");
        let wide = "é".repeat(80); // 160 bytes, never cut inside a character
        assert!(split_parts(&wide, 101).iter().all(|p| p.len() <= 101));
        assert_eq!(units("a😀"), 3, "as the browser counts");
    }

    #[test]
    fn headings_make_the_contents_and_keep_every_repeated_title() {
        assert!(is_heading("CHAPTER 1. Loomings."));
        assert!(is_heading("Chapter I.]"));
        assert!(is_heading("STAVE ONE."));
        assert!(is_heading("PREFACE"));
        assert!(!is_heading(
            "Chapter and verse were quoted at length by everyone in the room that night."
        ));
        assert!(!is_heading("Part of the crew"));
        // A title on a second line, as in Alice's Adventures in Wonderland.
        assert!(is_heading("CHAPTER I.\nDown the Rabbit-Hole"));
        assert_eq!(
            headings("CHAPTER I.\nDown the Rabbit-Hole\n\nAlice.", 0, false),
            [Heading {
                title: "CHAPTER I. Down the Rabbit-Hole".into(),
                at: 0,
            }]
        );
        assert!(!is_heading(
            " CHAPTER I.     One\n CHAPTER II.    Two\n CHAPTER III.   Three"
        ));
        assert!(!is_heading(
            "Chapter and verse were quoted by everyone that\nnight in the room."
        ));
        // A numeral and a title in capitals, as in The Adventures of Sherlock Holmes.
        assert!(is_heading("I. A SCANDAL IN BOHEMIA"));
        assert!(is_heading("XII. THE ADVENTURE OF THE COPPER BEECHES"));
        assert!(!is_heading("I. A scandal in Bohemia"));
        assert!(!is_heading("I."));
        assert!(!is_heading("Mr. BROWN SAID SO"));
        assert!(!is_heading(
            "BOOK III. (_Duodecimo_), CHAPTER 1. (_Huzza Porpoise_).—This is the porpoise...long"
        ));
        let text = "CONTENTS\n\nCHAPTER 1. Loomings.\n\nCHAPTER 2. The Carpet-Bag.\n\nCHAPTER 1. Loomings.\n\nCall me Ishmael.\n\nCHAPTER 2. The Carpet-Bag.\n\nI stuffed a shirt or two.";
        let mut toc = Vec::new();
        add_headings(&mut toc, headings(text, 10, false));
        let at = |n: usize, title: &str| {
            let byte = text.match_indices(title).nth(n).unwrap().0;
            10 + units(&text[..byte])
        };
        assert_eq!(
            toc,
            [
                Heading {
                    title: "CHAPTER 1. Loomings.".into(),
                    at: at(0, "CHAPTER 1."),
                },
                Heading {
                    title: "CHAPTER 2. The Carpet-Bag.".into(),
                    at: at(0, "CHAPTER 2."),
                },
                Heading {
                    title: "CHAPTER 1. Loomings.".into(),
                    at: at(1, "CHAPTER 1."),
                },
                Heading {
                    title: "CHAPTER 2. The Carpet-Bag.".into(),
                    at: at(1, "CHAPTER 2."),
                },
            ]
        );
        // The same headings found again at the same offsets are not listed twice.
        add_headings(&mut toc, headings(text, 10, false));
        assert_eq!(toc.len(), 4);

        // Numbering that restarts in each book keeps every chapter.
        let volumes = "BOOK I.\n\nCHAPTER I.\n\nIt began.\n\nCHAPTER II.\n\nIt went on.\n\nBOOK II.\n\nCHAPTER I.\n\nAgain.\n\nCHAPTER II.\n\nThe end.";
        let mut toc = Vec::new();
        add_headings(&mut toc, headings(volumes, 0, false));
        let titles: Vec<&str> = toc.iter().map(|h| h.title.as_str()).collect();
        assert_eq!(
            titles,
            [
                "BOOK I.",
                "CHAPTER I.",
                "CHAPTER II.",
                "BOOK II.",
                "CHAPTER I.",
                "CHAPTER II."
            ]
        );

        // So do Standard Ebooks' numerals repeated across parts, over two rounds.
        let mut toc = Vec::new();
        add_headings(&mut toc, headings("I.\n\nOne.\n\nII.\n\nTwo.", 0, true));
        add_headings(&mut toc, headings("I.\n\nThree.\n\nII.\n\nFour.", 20, true));
        assert_eq!(
            toc.iter().map(|h| h.at).collect::<Vec<_>>(),
            [0, 10, 20, 32]
        );
        assert_eq!(
            headings("XII.\n\nIt was", 0, true).len(),
            1,
            "Standard Ebooks' numerals"
        );
        assert_eq!(headings("XII.\n\nIt was", 0, false).len(), 0);
    }

    #[test]
    fn the_reading_text_starts_after_the_gutenberg_header() {
        let text = gutenberg_text("The Project Gutenberg eBook of Emma\r\n\r\n*** START OF THE PROJECT GUTENBERG EBOOK EMMA ***\r\n\r\n\r\nEMMA\r\n");
        let start = gutenberg_start(&text) as usize;
        assert_eq!(&text[start..], "EMMA");
        assert_eq!(gutenberg_start("no header here"), 0);
        let tail = "CHAPTER I.\n\nThe end.\n\n*** END OF THE PROJECT GUTENBERG EBOOK EMMA ***\n\nSection 1. General Terms";
        assert_eq!(&tail[gutenberg_end(tail).unwrap()..][..10], "*** END OF");
        assert_eq!(gutenberg_end("no footer"), None);
    }

    #[test]
    fn only_a_reply_that_holds_nothing_more_ends_the_book() {
        // The first round asks for the whole file: read to its end, it is the whole book.
        assert_eq!(ending(200, 170_000, false), Ending::End);
        assert_eq!(ending(200, ROUND_BYTES, true), Ending::Cut);
        // A range as long as the one asked for, which the fetch cuts at its byte limit, goes on.
        assert_eq!(ending(206, ROUND_BYTES, true), Ending::Cut);
        // A range that ended by itself may be a source sending less than asked: it goes on too,
        // whatever its length, even one the fetch did not cut at the limit.
        assert_eq!(ending(206, ROUND_BYTES, false), Ending::Short);
        assert_eq!(ending(206, 900_000, false), Ending::Short);
        assert_eq!(
            ending(206, 900_000, true),
            Ending::Cut,
            "cut by the time budget"
        );
        // Only an empty range, or nothing past the byte asked for, ends it.
        assert_eq!(ending(206, 0, false), Ending::End);
        assert_eq!(
            ending(416, 312, false),
            Ending::End,
            "whatever its error page"
        );

        let tail = b"last line\r\n\r\nEnd of the licence.";
        assert_eq!(kept_bytes(Ending::End, tail, false), tail.len());
        assert_eq!(
            kept_bytes(Ending::Short, tail, false),
            b"last line\r\n\r\n".len(),
            "a short range not known to end the file keeps whole paragraphs, as a cut one"
        );
        assert_eq!(
            kept_bytes(Ending::Cut, tail, false),
            b"last line\r\n\r\n".len(),
            "whole paragraphs"
        );
        assert_eq!(
            kept_bytes(Ending::Short, b"<p>One.</p>\n<p>Tw", true),
            b"<p>One.</p>".len(),
            "and whole blocks of markup"
        );
    }

    /// The text the rounds of `body` keep, `round` bytes at a time, joined as `keep_round`
    /// joins them; the last round is the end of the file, every other a short range.
    fn kept_in_rounds(body: &[u8], round: usize, markup: bool) -> String {
        let mut at = 0;
        let mut kept = String::new();
        while at < body.len() {
            let slice = &body[at..body.len().min(at + round)];
            let ending = if at + slice.len() == body.len() {
                Ending::End
            } else {
                Ending::Short
            };
            let keep = kept_bytes(ending, slice, markup);
            assert!(keep > 0, "a round of {round} bytes at {at} keeps nothing");
            let chunk = String::from_utf8_lossy(&slice[..keep]);
            let text = if markup {
                markup_text(&chunk, at == 0)
            } else {
                gutenberg_text(&chunk)
            };
            let trimmed = text.trim_matches('\n');
            if !trimmed.is_empty() {
                if !kept.is_empty() {
                    kept.push_str("\n\n");
                }
                kept.push_str(trimmed);
            }
            at += keep;
        }
        kept
    }

    #[test]
    fn a_short_range_never_changes_the_text_where_it_stops() {
        // Wrapped prose with an accent, cut at every byte a source sending less than it was
        // asked for might stop at: the kept text is always the whole file's, with no paragraph
        // break inside a word or a character.
        let book = concat!(
            "CHAPTER I.\r\n\r\n",
            "It was a bright cold day in April, and the clocks were\r\n",
            "striking thirteen. Winston Smith, his chin nuzzled into his\r\n",
            "breast, hurried caf\u{e9}-ward.\r\n\r\n",
            "The end.\r\n"
        );
        let whole = gutenberg_text(book);
        // Each round holds at least the longest paragraph, as every round of a real book does.
        for round in 170..book.len() {
            assert_eq!(
                kept_in_rounds(book.as_bytes(), round, false),
                whole,
                "rounds of {round} bytes"
            );
        }
        // Markup cut inside a tag or an entity is not changed either.
        let page = "<body><p>One &amp; two.</p><p>Three <i>four</i>.</p><p>Five.</p></body>";
        let whole = markup_text(page, true);
        for round in 40..page.len() {
            assert_eq!(
                kept_in_rounds(page.as_bytes(), round, true),
                whole,
                "rounds of {round} bytes"
            );
        }
    }

    #[test]
    fn a_claim_is_taken_when_free_and_let_go_only_by_its_holder() {
        let held = serde_json::to_vec(&Claim {
            token: 7,
            until: 1_000,
        })
        .unwrap();
        assert!(!claim_free(&held, 999), "held by another request");
        assert!(claim_free(&held, 1_000), "run out");
        assert!(claim_free(b"1", 0), "not a claim");
        assert!(claim_held_by(&held, 7));
        assert!(
            !claim_held_by(&held, 8),
            "a request that ran past its claim"
        );
        assert!(!claim_held_by(b"1", 7));
    }

    #[test]
    fn a_probe_cut_short_says_nothing_about_the_end_of_the_file() {
        assert_eq!(probe_ends(416, true, false), Some(true));
        assert_eq!(probe_ends(206, true, false), Some(true), "an empty range");
        assert_eq!(probe_ends(206, false, false), Some(false), "a byte follows");
        assert_eq!(
            probe_ends(206, true, true),
            None,
            "stopped before any byte came"
        );
        assert_eq!(probe_ends(200, false, false), None);
    }

    #[test]
    fn the_cache_lets_go_of_the_books_used_longest_ago_never_the_one_answered() {
        let books: BTreeMap<String, Cached> = [
            ("pg-1", 10, 300),
            ("pg-2", 10, 100),
            ("pg-3", 10, 200),
            ("pg-4", 10, 50),
        ]
        .into_iter()
        .map(|(id, bytes, used)| (id.to_string(), Cached { bytes, used }))
        .collect();
        // Within both limits: nothing goes.
        assert!(evictions(&books, "pg-4", 4, 40).is_empty());
        // One book too many: the one used longest ago, but not the one being answered.
        assert_eq!(evictions(&books, "pg-1", 3, 40), ["pg-4"]);
        assert_eq!(evictions(&books, "pg-4", 3, 40), ["pg-2"]);
        // Over the bytes: as many as it takes, oldest first.
        assert_eq!(evictions(&books, "pg-1", 10, 15), ["pg-4", "pg-2", "pg-3"]);
        // The book answered stays even when it alone is over the limit.
        assert_eq!(evictions(&books, "pg-1", 0, 0), ["pg-4", "pg-2", "pg-3"]);
        // An index kept before its bytes were recorded counts its UTF-16 units.
        let old = Index {
            parts: vec![100, 50],
            ..Index::default()
        };
        assert_eq!(stored_bytes(&old), 150);
        let new = Index {
            parts: vec![100],
            bytes: 180,
            ..Index::default()
        };
        assert_eq!(stored_bytes(&new), 180);

        // Extending an index kept before its bytes were recorded counts the parts it had too.
        let mut legacy = Index {
            parts: vec![100, 50],
            generations: vec![7, 7],
            ..Index::default()
        };
        count_part(&mut legacy, 9, "abcé");
        assert_eq!(legacy.parts, [100, 50, 4]);
        assert_eq!(legacy.generations, [7, 7, 9]);
        assert_eq!(
            legacy.bytes,
            150 + 5,
            "the old parts' units, then the new part's bytes"
        );
        count_part(&mut legacy, 9, "de");
        assert_eq!(legacy.bytes, 157);
        // A new book counts only its own parts.
        let mut fresh = Index::default();
        count_part(&mut fresh, 3, "hello");
        assert_eq!(fresh.bytes, 5);
    }

    #[test]
    fn each_part_is_read_from_the_generation_the_index_names() {
        let book = BookId::parse("pg-11").unwrap();
        let kept: Index = serde_json::from_str(
            r#"{"id":"pg-11","source":"gutenberg","credit":"","licence":"","link":"",
                "parts":[10,20,30],"complete":false,"next":40,"start":0,"generations":[7,255]}"#,
        )
        .unwrap();
        assert_eq!(
            stored_part_key(&kept, &book, 1).as_deref(),
            Some("text/pg-11/g00000000000000ff/part/1")
        );
        assert_eq!(
            stored_part_key(&kept, &book, 2),
            None,
            "no generation: missing"
        );
        let reply = index_reply(&kept);
        for internal in ["generations", "next", "seam_digest", "seam", "ended"] {
            assert!(reply.get(internal).is_none(), "{internal} is not answered");
        }
        // Two rounds never share a key.
        assert_ne!(part_key(&book, 1, 3), part_key(&book, 2, 3));
        assert_ne!(new_generation().ok(), Some(0));
    }

    /// The index after the rounds kept `file` up to byte `keep_to`, with the seam they leave.
    fn index_after(file: &[u8], keep_to: usize) -> Index {
        let seam = keep_to.min(SEAM_BYTES);
        Index {
            next: keep_to as u64,
            seam: seam as u64,
            seam_digest: digest(&file[keep_to - seam..keep_to]),
            ..Index::default()
        }
    }

    /// A Gutenberg-like file of `paragraphs` paragraphs, each about 120 bytes.
    fn file(paragraphs: usize, first: &str) -> Vec<u8> {
        let mut text = format!("{first}\r\n\r\n");
        for n in 0..paragraphs {
            text.push_str(&format!(
                "Paragraph {n} of the book, long enough to be wrapped prose at a fixed\r\nwidth as Project Gutenberg wraps it, and then some more.\r\n\r\n"
            ));
        }
        text.into_bytes()
    }

    #[test]
    fn a_round_goes_on_only_from_the_edition_the_last_one_read() {
        let old = file(200, "CHAPTER I.");
        let first = finish(0, &old[..10_000], 0, Ending::Cut, false)
            .ok()
            .unwrap();
        assert!(!first.changed && !first.complete);
        let kept_to = first.next as usize;
        let index = index_after(&old, kept_to);
        assert_eq!(index.seam_digest, first.seam_digest);
        assert_eq!(index.seam, first.seam);

        // The range the next round asks for starts a seam before the place it goes on from.
        let (range, seam) = round_range(&index);
        assert_eq!(seam, SEAM_BYTES);
        let from = kept_to - seam;
        assert_eq!(
            range.unwrap(),
            format!("bytes={from}-{}", kept_to + ROUND_BYTES - 1)
        );

        // The same file goes on, and the two rounds make the whole text.
        let same = place(&index, 206, old[from..].to_vec(), false)
            .ok()
            .unwrap();
        let Placed::Body { body, seam } = same else {
            panic!("the same edition goes on: {same:?}");
        };
        let second = finish(index.next, &body, seam, Ending::End, false)
            .ok()
            .unwrap();
        assert!(second.complete);
        assert_eq!(
            format!(
                "{}\n\n{}",
                first.text.trim_matches('\n'),
                second.text.trim_matches('\n')
            ),
            gutenberg_text(&String::from_utf8_lossy(&old))
        );
        // A source that ignores the range and sends the whole file goes on as well.
        assert!(matches!(
            place(&index, 200, old.clone(), false).ok(),
            Some(Placed::Body { .. })
        ));

        // A new edition with a line added before the seam is not continued, whichever way the
        // source answers.
        let new = file(200, "CHAPTER I.\r\n\r\nA line the new edition adds.");
        assert_eq!(
            place(&index, 206, new[from..].to_vec(), false).ok(),
            Some(Placed::Changed)
        );
        assert_eq!(
            place(&index, 200, new.clone(), false).ok(),
            Some(Placed::Changed)
        );
        // Nor is one shorter than what was read of it.
        assert_eq!(
            place(&index, 416, Vec::new(), false).ok(),
            Some(Placed::Changed)
        );
        assert_eq!(
            place(&index, 200, old[..from - 1].to_vec(), false).ok(),
            Some(Placed::Changed)
        );
        // A reply cut before the seam says nothing, and is asked again.
        assert!(place(&index, 206, old[from..from + 10].to_vec(), true).is_err());
    }

    #[test]
    fn a_round_that_keeps_less_than_a_seam_keeps_the_earlier_seam_bytes() {
        let old = file(40, "CHAPTER I.");
        let first = finish(0, &old[..1_000], 0, Ending::Cut, false)
            .ok()
            .unwrap();
        let index = index_after(&old, first.next as usize);
        assert!(
            index.seam < SEAM_BYTES as u64,
            "the first round kept less than a seam"
        );
        let (_, seam) = round_range(&index);
        let from = index.next as usize - seam;
        let Some(Placed::Body { body, seam }) =
            place(&index, 206, old[from..from + seam + 600].to_vec(), true).ok()
        else {
            panic!("the same edition goes on");
        };
        let second = finish(index.next, &body, seam, Ending::Cut, false)
            .ok()
            .unwrap();
        let through = second.next as usize;
        let expected = through.min(SEAM_BYTES);
        assert_eq!(second.seam, expected as u64);
        assert_eq!(
            second.seam_digest,
            digest(&old[through - expected..through])
        );
    }
}

//! The Book Store: Project Gutenberg's most downloaded books and its search,
//! and Standard Ebooks' new releases and its search, read from their feeds.
//!
//! * `GET /api/books/store?shelf=popular[&page=n]`: Gutenberg's OPDS listing
//!   by downloads, `https://www.gutenberg.org/ebooks/search.opds/?sort_order=downloads`.
//! * `GET /api/books/store?shelf=standard-ebooks`: Standard Ebooks' new
//!   releases, `https://standardebooks.org/feeds/atom/new-releases`.
//! * `GET /api/books/store?q=<text>[&source=gutenberg|standard-ebooks][&page=n]`:
//!   Gutenberg's OPDS search (`/ebooks/search.opds/?query=`) or Standard
//!   Ebooks' Atom search (`/feeds/atom/all?query=`, which answers a query
//!   without the patrons' sign-in the unfiltered feed asks for).
//!
//! Each answers `{"books": [{"id", "title", "author", "source", "cover",
//! "summary"?}], "more", "source"}`. A listing is kept in the space every
//! person shares, so the source is asked once for many readers: the two
//! shelves for 6 hours, a search for 24 hours. Nothing is fetched until a
//! person opens the store or searches it.
//!
//! The feeds are read by a small extraction of their entries rather than the
//! News and Podcasts reader (`podcasts/feed.rs`), whose items have no place
//! for a Gutenberg number; its entity and text helpers are reused.

use ferrite_app::{serde, serde_json};

use super::audiobooks;
use super::source::{BookId, Source, EGRESS, GUTENBERG, LIBRIVOX_SOURCE, STANDARD_EBOOKS};
use crate::apps::news::feed::{clip, decode_entities, html_to_text, web_url};
use crate::apps::news::fetch::{self, encode_query, FetchError};
use crate::http::Response;
use crate::module::{Request, Space};

/// The most characters of a title or an author's name.
pub const MAX_TITLE: usize = 300;
/// The most characters of a store summary.
const MAX_SUMMARY: usize = 300;
/// The longest search, in characters.
pub const MAX_QUERY: usize = 100;
/// The deepest page of a listing.
pub const MAX_PAGE: u32 = 20;
/// Books per Gutenberg page.
const GUTENBERG_PAGE: u32 = 25;
/// The most bytes of a feed read (Gutenberg's carry a picture per entry).
const FEED_BYTES: usize = 768 * 1024;
/// The time one listing fetch may take, under the gateway's 8 seconds.
const FEED_BUDGET_MS: u64 = 6_000;
/// How long the shelves and searches are kept.
const SHELF_KEEP_MS: u64 = 6 * 60 * 60 * 1000;
const SEARCH_KEEP_MS: u64 = 24 * 60 * 60 * 1000;

/// One book of a listing.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
pub struct StoreBook {
    pub id: String,
    pub title: String,
    pub author: String,
    pub source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cover: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
}

/// A listing as answered and kept.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Default)]
#[serde(crate = "ferrite_app::serde")]
pub struct Listing {
    pub books: Vec<StoreBook>,
    /// Whether the source has a next page.
    pub more: bool,
}

// ---------------------------------------------------------------------------
// Reading feeds
// ---------------------------------------------------------------------------

/// Where `<name` starts a tag of exactly that name in `text`, from `from`.
fn find_tag(text: &str, name: &str, from: usize) -> Option<usize> {
    let needle = format!("<{name}");
    let mut at = from;
    while let Some(found) = text.get(at..)?.find(&needle) {
        let start = at + found;
        let after = text.as_bytes().get(start + needle.len()).copied();
        if matches!(after, Some(b' ' | b'\t' | b'\r' | b'\n' | b'>' | b'/')) {
            return Some(start);
        }
        at = start + needle.len();
    }
    None
}

/// The start tag at `start` (`<name ...>`) and where it ends; whether it
/// closes itself.
fn start_tag_at(text: &str, start: usize) -> Option<(&str, usize, bool)> {
    let rest = &text[start..];
    let mut quote: Option<u8> = None;
    for (at, b) in rest.bytes().enumerate() {
        match (quote, b) {
            (Some(q), _) if b == q => quote = None,
            (Some(_), _) => {}
            (None, b'"' | b'\'') => quote = Some(b),
            (None, b'>') => {
                let tag = &rest[..at];
                return Some((tag, start + at + 1, tag.ends_with('/')));
            }
            _ => {}
        }
    }
    None
}

/// Every element called `name` in `text` that closes: its start tag and its
/// inner text. Elements of one name are taken not to nest (entries, titles);
/// an element the text was cut inside of is left out.
fn elements<'a>(text: &'a str, name: &str) -> Vec<(&'a str, &'a str)> {
    let close = format!("</{name}>");
    let mut out = Vec::new();
    let mut at = 0;
    while let Some(start) = find_tag(text, name, at) {
        let Some((tag, inner_start, self_closing)) = start_tag_at(text, start) else {
            break;
        };
        if self_closing {
            out.push((tag, ""));
            at = inner_start;
            continue;
        }
        let Some(end) = text[inner_start..].find(&close) else {
            break;
        };
        out.push((tag, &text[inner_start..inner_start + end]));
        at = inner_start + end + close.len();
    }
    out
}

/// The value of attribute `name` in a start tag, entities decoded.
fn attribute(tag: &str, name: &str) -> Option<String> {
    let mut rest = tag;
    while let Some(at) = rest.find(name) {
        let before = rest[..at].bytes().last();
        let after = rest[at + name.len()..].trim_start();
        if matches!(before, Some(b' ' | b'\t' | b'\r' | b'\n')) {
            if let Some(value) = after.strip_prefix('=') {
                let value = value.trim_start();
                if let Some(q) = value.chars().next().filter(|c| *c == '"' || *c == '\'') {
                    let body = &value[1..];
                    let end = body.find(q)?;
                    return Some(decode_entities(&body[..end]));
                }
            }
        }
        rest = &rest[at + name.len()..];
    }
    None
}

/// The plain text of an element's inner text: CDATA unwrapped, markup
/// removed, entities decoded, spaces collapsed to one line.
fn plain(inner: &str) -> String {
    let inner = inner.trim();
    let unwrapped = inner
        .strip_prefix("<![CDATA[")
        .and_then(|rest| rest.strip_suffix("]]>"))
        .unwrap_or(inner);
    html_to_text(unwrapped)
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// The text of the first `name` element of `text`, when it has any.
fn text_of(text: &str, name: &str) -> Option<String> {
    elements(text, name)
        .first()
        .map(|(_, inner)| plain(inner))
        .filter(|t| !t.is_empty())
}

/// Whether the feed links a next page.
fn has_next(feed: &str) -> bool {
    let head = feed.split("<entry").next().unwrap_or(feed);
    elements(head, "link")
        .iter()
        .any(|(tag, _)| attribute(tag, "rel").as_deref() == Some("next"))
}

/// The books of a Gutenberg OPDS listing (search or by downloads). Entries
/// that are not one ebook (the "Authors" and "Subjects" rows of a search)
/// are left out.
pub fn gutenberg_listing(feed: &str) -> Listing {
    let mut books = Vec::new();
    for (_, entry) in elements(feed, "entry") {
        let Some(id) = text_of(entry, "id") else {
            continue;
        };
        let Some(number) = id
            .rsplit_once("/ebooks/")
            .and_then(|(_, rest)| rest.strip_suffix(".opds"))
        else {
            continue;
        };
        let Some(book) = BookId::parse(&format!("pg-{number}")) else {
            continue;
        };
        let Some(title) = text_of(entry, "title") else {
            continue;
        };
        books.push(StoreBook {
            id: book.as_string(),
            title: clip(&title, MAX_TITLE),
            author: clip(&text_of(entry, "content").unwrap_or_default(), MAX_TITLE),
            source: Source::Gutenberg.as_str().into(),
            cover: Some(book.cover_url()),
            summary: None,
        });
    }
    Listing {
        books,
        more: has_next(feed),
    }
}

/// The books of a Standard Ebooks Atom feed (new releases or a search).
pub fn standard_ebooks_listing(feed: &str) -> Listing {
    let mut books = Vec::new();
    for (_, entry) in elements(feed, "entry") {
        let Some(book) = text_of(entry, "id").and_then(|id| BookId::from_standard_ebooks_url(&id))
        else {
            continue;
        };
        let Some(title) = text_of(entry, "title") else {
            continue;
        };
        let author = elements(entry, "author")
            .first()
            .and_then(|(_, inner)| text_of(inner, "name"))
            .unwrap_or_default();
        let cover = elements(entry, "media:thumbnail")
            .first()
            .and_then(|(tag, _)| attribute(tag, "url"))
            .and_then(|url| web_url(&url))
            .filter(|url| super::source::cover_allowed(url))
            .or_else(|| Some(book.cover_url()));
        books.push(StoreBook {
            id: book.as_string(),
            title: clip(&title, MAX_TITLE),
            author: clip(&author, MAX_TITLE),
            source: Source::StandardEbooks.as_str().into(),
            cover,
            summary: text_of(entry, "summary").map(|s| clip(&s, MAX_SUMMARY)),
        });
    }
    Listing {
        books,
        more: has_next(feed),
    }
}

/// What a Gutenberg OPDS record of one book says: whether Books may read it.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct Record {
    pub title: Option<String>,
    pub author: Option<String>,
    pub language: Option<String>,
    /// The rights line, such as "Public domain in the USA.".
    pub rights: Option<String>,
    /// Whether the book is a text (not an audio book).
    pub text: bool,
}

/// "Melville, Herman" as "Herman Melville"; any other form as given.
fn natural_name(name: &str) -> String {
    match name.split_once(", ") {
        Some((last, first)) if !first.contains(',') && !first.is_empty() => {
            format!("{first} {last}")
        }
        _ => name.to_string(),
    }
}

/// The first entry of a Gutenberg book's OPDS record, or `None` when the
/// reply is no such record.
pub fn gutenberg_record(feed: &str) -> Option<Record> {
    let (_, entry) = elements(feed, "entry").into_iter().next()?;
    let kind = elements(entry, "category")
        .into_iter()
        .find_map(|(tag, _)| {
            let scheme = attribute(tag, "scheme")?;
            scheme
                .ends_with("/DCMIType")
                .then(|| attribute(tag, "term").unwrap_or_default())
        });
    Some(Record {
        title: text_of(entry, "title").map(|t| clip(&t, MAX_TITLE)),
        author: elements(entry, "author")
            .first()
            .and_then(|(_, inner)| text_of(inner, "name"))
            .map(|name| clip(&natural_name(&name), MAX_TITLE)),
        language: text_of(entry, "dcterms:language").map(|l| clip(&l, 20)),
        rights: text_of(entry, "rights").map(|r| clip(&r, 300)),
        text: kind.is_none_or(|term| term.eq_ignore_ascii_case("text")),
    })
}

// ---------------------------------------------------------------------------
// The route
// ---------------------------------------------------------------------------

/// A search's text: decoded, single-spaced, 1 to [`MAX_QUERY`] characters.
pub fn query_text(raw: &str) -> Option<String> {
    let decoded = fetch::decode_query(raw)?;
    let text = decoded.split_whitespace().collect::<Vec<_>>().join(" ");
    let length = text.chars().count();
    ((1..=MAX_QUERY).contains(&length)).then_some(text)
}

/// What a store request asks for.
#[derive(Debug, Clone, PartialEq)]
enum Ask {
    Popular(u32),
    NewReleases,
    Search(Source, String, u32),
    /// LibriVox's catalogue, or a search of it (`audiobooks.rs`).
    Audiobooks(Option<String>, u32),
}

impl Ask {
    fn from_request(request: &Request<'_>) -> Result<Ask, String> {
        let page = match request.query_param("page") {
            None => 1,
            Some(text) => text
                .parse::<u32>()
                .ok()
                .filter(|n| (1..=MAX_PAGE).contains(n))
                .ok_or_else(|| format!("a page is 1 to {MAX_PAGE}"))?,
        };
        if let Some(raw) = request.query_param("q") {
            let text = query_text(raw)
                .ok_or_else(|| format!("a search has 1 to {MAX_QUERY} characters"))?;
            let source = match request.query_param("source") {
                None | Some("gutenberg") => Source::Gutenberg,
                Some("standard-ebooks") => Source::StandardEbooks,
                Some(LIBRIVOX_SOURCE) => return Ok(Ask::Audiobooks(Some(text), page)),
                Some(other) => return Err(format!("{other:?} is not a book source")),
            };
            if source == Source::StandardEbooks && page > 1 {
                return Err("Standard Ebooks' search has one page".into());
            }
            return Ok(Ask::Search(source, text, page));
        }
        match request.query_param("shelf") {
            None | Some("popular") => Ok(Ask::Popular(page)),
            Some("standard-ebooks") => Ok(Ask::NewReleases),
            Some(LIBRIVOX_SOURCE) => Ok(Ask::Audiobooks(None, page)),
            Some(other) => Err(format!("{other:?} is not a shelf")),
        }
    }

    fn source(&self) -> &'static str {
        match self {
            Ask::Popular(_) => Source::Gutenberg.as_str(),
            Ask::NewReleases => Source::StandardEbooks.as_str(),
            Ask::Search(source, _, _) => source.as_str(),
            Ask::Audiobooks(_, _) => LIBRIVOX_SOURCE,
        }
    }

    fn url(&self) -> String {
        let start = |page: u32| {
            if page > 1 {
                format!("&start_index={}", (page - 1) * GUTENBERG_PAGE + 1)
            } else {
                String::new()
            }
        };
        match self {
            Ask::Popular(page) => {
                format!(
                    "{GUTENBERG}ebooks/search.opds/?sort_order=downloads{}",
                    start(*page)
                )
            }
            Ask::NewReleases => format!("{STANDARD_EBOOKS}feeds/atom/new-releases"),
            Ask::Search(Source::StandardEbooks, text, _) => {
                format!(
                    "{STANDARD_EBOOKS}feeds/atom/all?query={}",
                    encode_query(text)
                )
            }
            Ask::Search(_, text, page) => format!(
                "{GUTENBERG}ebooks/search.opds/?query={}{}",
                encode_query(text),
                start(*page)
            ),
            Ask::Audiobooks(_, _) => unreachable!("audiobooks::listing fetches its own"),
        }
    }

    /// The shared key the listing is kept under, and for how long.
    fn cache(&self) -> (String, u64) {
        match self {
            Ask::Popular(page) => (format!("store/popular/{page}"), SHELF_KEEP_MS),
            Ask::NewReleases => ("store/standard-ebooks".into(), SHELF_KEEP_MS),
            Ask::Search(source, text, page) => {
                let digest = ferrite_app::crypto::sha256(text.to_lowercase().as_bytes());
                let key = ferrite_app::crypto::hex(&digest[..8]);
                (
                    format!("store/search/{}/{key}/{page}", source.as_str()),
                    SEARCH_KEEP_MS,
                )
            }
            Ask::Audiobooks(None, page) => (format!("store/librivox/{page}"), SHELF_KEEP_MS),
            Ask::Audiobooks(Some(text), page) => {
                let digest = ferrite_app::crypto::sha256(text.to_lowercase().as_bytes());
                let key = ferrite_app::crypto::hex(&digest[..8]);
                (
                    format!("store/search/{LIBRIVOX_SOURCE}/{key}/{page}"),
                    SEARCH_KEEP_MS,
                )
            }
        }
    }
}

/// The reply to a fetch that got no listing.
pub fn fetch_failure(error: &FetchError) -> Response {
    match error {
        FetchError::NoEgress(_) => Response::error(
            503,
            &format!("Books has no way to reach the book sources here: {error}"),
        ),
        _ => Response::error(502, &error.to_string()),
    }
}

/// `GET /api/books/store`.
pub async fn answer(
    request: &Request<'_>,
    shared: &mut Space<'_>,
    ctx: &ferrite_app::AppContext,
    now_ms: u64,
) -> Response {
    let ask = match Ask::from_request(request) {
        Ok(ask) => ask,
        Err(message) => return Response::error(400, &message),
    };
    let source = ask.source();
    let (key, keep_ms) = ask.cache();
    // A kept listing that no longer reads is fetched again.
    if let Ok(Some(listing)) = shared.get_json::<Listing>(&key).await {
        return reply(&listing, source, true);
    }
    if let Ask::Audiobooks(text, page) = &ask {
        return match audiobooks::listing(ctx, text.as_deref(), *page).await {
            Ok((listing, whole)) => {
                if whole {
                    keep(shared, &key, &listing, now_ms + keep_ms).await;
                }
                reply(&listing, source, false)
            }
            Err(response) => response,
        };
    }
    let accept = "application/atom+xml, application/xml;q=0.9, */*;q=0.1";
    let fetched =
        match fetch::get(ctx, EGRESS, &ask.url(), accept, FEED_BYTES, FEED_BUDGET_MS).await {
            Ok(fetched) => fetched,
            Err(error) => return fetch_failure(&error),
        };
    if fetched.status != 200 {
        return Response::error(
            502,
            &format!("the book source answered HTTP {}", fetched.status),
        );
    }
    let body = String::from_utf8_lossy(&fetched.body);
    let listing = match source {
        "standard-ebooks" => standard_ebooks_listing(&body),
        _ => gutenberg_listing(&body),
    };
    if listing.books.is_empty() && !body.contains("<feed") {
        return Response::error(502, "the book source's reply is not a catalogue");
    }
    // A listing cut short is answered but not kept, so the next person asks again.
    if !fetched.cut {
        keep(shared, &key, &listing, now_ms + keep_ms).await;
    }
    reply(&listing, source, false)
}

async fn keep(shared: &mut Space<'_>, key: &str, listing: &Listing, until_ms: u64) {
    if let Err(error) = shared
        .put_expiring(
            key,
            &serde_json::to_vec(listing).unwrap_or_default(),
            until_ms,
        )
        .await
    {
        ferrite_app::tracing::warn!(%error, "could not keep a Books listing");
    }
}

fn reply(listing: &Listing, source: &str, cached: bool) -> Response {
    Response::json(
        200,
        &serde_json::json!({
            "books": listing.books,
            "more": listing.more,
            "source": source,
            "cached": cached,
        }),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    const SEARCH: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog">
<id>http://www.gutenberg.org/ebooks/search.opds/?query=moby</id>
<title>Books: moby</title>
<link rel="self" type="application/atom+xml;profile=opds-catalog" href="/ebooks/search.opds/?query=moby"/>
<link rel="next" title="Next Page" type="application/atom+xml;profile=opds-catalog" href="/ebooks/search.opds/?query=moby&amp;start_index=26"/>
<entry>
<id>https://www.gutenberg.org/ebooks/authors/search.opds/?query=moby</id>
<title>Authors</title>
<content type="text">One author name matches your search.</content>
</entry>
<entry>
<updated>2026-10-14T16:09:41Z</updated>
<id>https://www.gutenberg.org/ebooks/2701.opds</id>
<title>Moby Dick; Or, The Whale</title>
<content type="text">Herman Melville</content>
<link type="application/atom+xml;profile=opds-catalog" rel="subsection" href="/ebooks/2701.opds"/>
<link type="image/png" rel="http://opds-spec.org/image/thumbnail" href="data:image/png;base64,iVBORw0KGgo="/>
</entry>
<entry>
<id>https://www.gutenberg.org/ebooks/11.opds</id>
<title>Alice&#x27;s Adventures in Wonderland &amp; more</title>
<content type="text">Lewis Carroll</content>
</entry>
<entry>
<id>https://www.gutenberg.org/ebooks/84.opds</id>
<title>Cut sh"#;

    #[test]
    fn a_gutenberg_listing_keeps_its_ebooks() {
        let listing = gutenberg_listing(SEARCH);
        assert!(listing.more, "the feed links a next page");
        assert_eq!(
            listing.books.len(),
            2,
            "the Authors row and the cut entry are left out"
        );
        let moby = &listing.books[0];
        assert_eq!(moby.id, "pg-2701");
        assert_eq!(moby.title, "Moby Dick; Or, The Whale");
        assert_eq!(moby.author, "Herman Melville");
        assert_eq!(moby.source, "gutenberg");
        assert_eq!(
            moby.cover.as_deref(),
            Some("https://www.gutenberg.org/cache/epub/2701/pg2701.cover.medium.jpg")
        );
        assert_eq!(
            listing.books[1].title,
            "Alice's Adventures in Wonderland & more"
        );
    }

    #[test]
    fn a_standard_ebooks_feed_keeps_its_books_and_covers() {
        let feed = r#"<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
	<id>https://standardebooks.org/feeds/atom/new-releases</id>
	<entry>
		<id>https://standardebooks.org/ebooks/henry-seton-merriman/the-sowers</id>
		<title>The Sowers</title>
		<author>
			<name>Henry Seton Merriman</name>
			<uri>https://standardebooks.org/ebooks/henry-seton-merriman</uri>
		</author>
		<rights>Public domain in the United States.</rights>
		<summary type="text">Two men return to Imperial Russia.</summary>
		<media:thumbnail height="525" url="https://standardebooks.org/ebooks/henry-seton-merriman/the-sowers/downloads/cover-thumbnail.jpg" width="350"/>
		<link href="https://standardebooks.org/ebooks/henry-seton-merriman/the-sowers" rel="alternate"/>
	</entry>
	<entry>
		<id>https://example.com/ebooks/a/b</id>
		<title>Elsewhere</title>
	</entry>
</feed>"#;
        let listing = standard_ebooks_listing(feed);
        assert!(!listing.more);
        assert_eq!(listing.books.len(), 1, "only Standard Ebooks' own books");
        let book = &listing.books[0];
        assert_eq!(book.id, "se.henry-seton-merriman.the-sowers");
        assert_eq!(book.author, "Henry Seton Merriman");
        assert_eq!(
            book.summary.as_deref(),
            Some("Two men return to Imperial Russia.")
        );
        assert!(book
            .cover
            .as_deref()
            .unwrap()
            .ends_with("/the-sowers/downloads/cover-thumbnail.jpg"));
    }

    #[test]
    fn a_gutenberg_record_says_whether_the_book_may_be_read() {
        let record = gutenberg_record(
            r#"<feed><title>Moby Dick by Herman Melville</title><entry>
<title>Moby Dick; Or, The Whale</title>
<content type="xhtml"><div><p>Rights: Public domain in the USA.</p></div></content>
<id>urn:gutenberg:2701:2</id>
<rights>Public domain in the USA.</rights>
<author>
<name>Melville, Herman</name>
</author>
<category scheme="http://purl.org/dc/terms/LCSH" term="Sea stories"/>
<category scheme="http://purl.org/dc/terms/DCMIType" term="Text"/>
<dcterms:language>en</dcterms:language>
</entry></feed>"#,
        )
        .unwrap();
        assert_eq!(record.title.as_deref(), Some("Moby Dick; Or, The Whale"));
        assert_eq!(record.author.as_deref(), Some("Herman Melville"));
        assert_eq!(record.language.as_deref(), Some("en"));
        assert_eq!(record.rights.as_deref(), Some("Public domain in the USA."));
        assert!(record.text);

        let audio = gutenberg_record(
            r#"<feed><entry><title>Moby Dick</title><rights>Public domain in the USA.</rights>
<category scheme="http://purl.org/dc/terms/DCMIType" term="Sound"/></entry></feed>"#,
        )
        .unwrap();
        assert!(!audio.text, "an audio book has no text");
        assert_eq!(gutenberg_record("<html>Moved</html>"), None);
    }

    #[test]
    fn searches_are_tidied_and_bounded() {
        assert_eq!(
            query_text("pride++and%20%20prejudice").as_deref(),
            Some("pride and prejudice")
        );
        assert_eq!(query_text("+++"), None);
        assert_eq!(query_text(&"a".repeat(MAX_QUERY + 1)), None);
        let search = Ask::Search(Source::Gutenberg, "moby dick".into(), 2);
        assert_eq!(
            search.url(),
            "https://www.gutenberg.org/ebooks/search.opds/?query=moby%20dick&start_index=26"
        );
        assert_eq!(
            Ask::Search(Source::StandardEbooks, "austen".into(), 1).url(),
            "https://standardebooks.org/feeds/atom/all?query=austen"
        );
        let (key, _) = Ask::Search(Source::Gutenberg, "Moby Dick".into(), 1).cache();
        let (same, _) = search.cache();
        assert!(key.starts_with("store/search/gutenberg/") && key.ends_with("/1"));
        assert_eq!(
            key.trim_end_matches("/1"),
            same.trim_end_matches("/2"),
            "case does not matter"
        );
        assert_eq!(
            attribute(r#"link rel="next" href='/a?b=1&amp;c=2'"#, "href").as_deref(),
            Some("/a?b=1&c=2")
        );
    }
}

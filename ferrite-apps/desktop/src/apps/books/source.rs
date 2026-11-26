//! The books Books reads, how each one is named, and where its text, cover
//! and page are.
//!
//! Two kinds of book, each with an id that is a plain document key
//! (`document::valid_key`):
//!
//! * `pg-<n>`: Project Gutenberg's ebook number `n`. The text is the plain
//!   UTF-8 file `https://www.gutenberg.org/cache/epub/<n>/pg<n>.txt`, which
//!   answers `200` itself (`/ebooks/<n>.txt.utf-8` redirects, and egress
//!   follows no redirect) and honours `Range`.
//! * `se.<author>.<title>[.<translator>[.<illustrator>]]`: a Standard Ebooks
//!   edition, its path under `https://standardebooks.org/ebooks/` (two to four
//!   segments, as Standard Ebooks names an edition). The text is the book's
//!   single-page XHTML, `.../text/single-page`, which honours `Range` too.

use crate::apps::document;

/// The egress handle every outside request of Books goes through.
pub const EGRESS: &str = "books";
/// Project Gutenberg's address: an egress destination of [`EGRESS`].
pub const GUTENBERG: &str = "https://www.gutenberg.org/";
/// Standard Ebooks' address: the other egress destination of [`EGRESS`].
pub const STANDARD_EBOOKS: &str = "https://standardebooks.org/";
/// LibriVox's catalogue API: an egress destination of [`EGRESS`] too (`audiobooks.rs`).
pub const LIBRIVOX: &str = "https://librivox.org/api/feed/audiobooks";
/// Where an audiobook's sound and cover are: only the browser fetches them.
pub const ARCHIVE_DOWNLOAD: &str = "https://archive.org/download/";
/// What the library and the replies call an audiobook's source. It has no [`BookId`]: nothing
/// here fetches its text.
pub const LIBRIVOX_SOURCE: &str = "librivox";

/// The largest Gutenberg ebook number accepted.
const MAX_GUTENBERG: u32 = 999_999;
/// The longest path segment of a Standard Ebooks book.
const MAX_SEGMENT: usize = 60;
/// How many path segments a Standard Ebooks edition has: author and title, then a translator
/// and an illustrator when it names them.
const SEGMENTS: std::ops::RangeInclusive<usize> = 2..=4;

/// Where a book comes from.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Source {
    Gutenberg,
    StandardEbooks,
}

impl Source {
    /// The name the library and the replies use.
    pub fn as_str(self) -> &'static str {
        match self {
            Source::Gutenberg => "gutenberg",
            Source::StandardEbooks => "standard-ebooks",
        }
    }

    pub fn parse(name: &str) -> Option<Source> {
        match name {
            "gutenberg" => Some(Source::Gutenberg),
            "standard-ebooks" => Some(Source::StandardEbooks),
            _ => None,
        }
    }

    /// The credit line the reader shows under the text.
    pub fn credit(self) -> &'static str {
        match self {
            Source::Gutenberg => "Project Gutenberg",
            Source::StandardEbooks => "Standard Ebooks, CC0",
        }
    }
}

/// The kind of a book the person added from a file of their drive (`epub-<hex>` or `pdf-<hex>`,
/// the first 128 bits of the file's SHA-256): `"epub"` or `"pdf"`. Its text never comes to the
/// server, so it has no [`BookId`]: nothing here can fetch it.
pub fn imported_kind(id: &str) -> Option<&'static str> {
    let (kind, digest) = id
        .strip_prefix("epub-")
        .map(|digest| ("epub", digest))
        .or_else(|| id.strip_prefix("pdf-").map(|digest| ("pdf", digest)))?;
    let plain = digest.len() == 32
        && digest
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b));
    plain.then_some(kind)
}

/// LibriVox's number for an audiobook, from its id (`lv-<n>`).
pub fn audiobook_number(id: &str) -> Option<u32> {
    let number = id.strip_prefix("lv-")?;
    let plain = !number.is_empty()
        && number.len() <= 9
        && number.bytes().all(|b| b.is_ascii_digit())
        && !number.starts_with('0');
    number.parse().ok().filter(|_| plain)
}

/// One book's identity.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BookId {
    /// A Project Gutenberg ebook number.
    Gutenberg(u32),
    /// The two to four path segments of a Standard Ebooks edition.
    StandardEbooks(Vec<String>),
}

fn segment_ok(segment: &str) -> bool {
    (1..=MAX_SEGMENT).contains(&segment.len())
        && segment
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-' || b == b'_')
}

impl BookId {
    /// The book an id names, or `None` when it names none.
    pub fn parse(id: &str) -> Option<BookId> {
        if !document::valid_key(id) {
            return None;
        }
        if let Some(number) = id.strip_prefix("pg-") {
            let plain = !number.is_empty()
                && number.bytes().all(|b| b.is_ascii_digit())
                && !number.starts_with('0');
            let n: u32 = number.parse().ok().filter(|_| plain)?;
            return (1..=MAX_GUTENBERG)
                .contains(&n)
                .then_some(BookId::Gutenberg(n));
        }
        if let Some(path) = id.strip_prefix("se.") {
            let segments: Vec<String> = path.split('.').map(str::to_string).collect();
            let ok = SEGMENTS.contains(&segments.len()) && segments.iter().all(|s| segment_ok(s));
            return ok.then_some(BookId::StandardEbooks(segments));
        }
        None
    }

    /// The Standard Ebooks edition at a web address
    /// (`https://standardebooks.org/ebooks/<author>/<title>[/<translator>[/<illustrator>]]`).
    pub fn from_standard_ebooks_url(url: &str) -> Option<BookId> {
        let path = url
            .trim()
            .strip_prefix(STANDARD_EBOOKS)?
            .strip_prefix("ebooks/")?
            .trim_end_matches('/');
        let segments: Vec<String> = path.split('/').map(str::to_string).collect();
        let id = format!("se.{}", segments.join("."));
        BookId::parse(&id)
    }

    /// The id as the library and the routes write it.
    pub fn as_string(&self) -> String {
        match self {
            BookId::Gutenberg(n) => format!("pg-{n}"),
            BookId::StandardEbooks(segments) => format!("se.{}", segments.join(".")),
        }
    }

    pub fn source(&self) -> Source {
        match self {
            BookId::Gutenberg(_) => Source::Gutenberg,
            BookId::StandardEbooks(_) => Source::StandardEbooks,
        }
    }

    /// The address of the book's text, which the server fetches.
    pub fn text_url(&self) -> String {
        match self {
            BookId::Gutenberg(n) => format!("{GUTENBERG}cache/epub/{n}/pg{n}.txt"),
            BookId::StandardEbooks(segments) => format!(
                "{STANDARD_EBOOKS}ebooks/{}/text/single-page",
                segments.join("/")
            ),
        }
    }

    /// The book's own page at its source, for the reader's credit line.
    pub fn page_url(&self) -> String {
        match self {
            BookId::Gutenberg(n) => format!("{GUTENBERG}ebooks/{n}"),
            BookId::StandardEbooks(segments) => {
                format!("{STANDARD_EBOOKS}ebooks/{}", segments.join("/"))
            }
        }
    }

    /// The OPDS record of a Gutenberg book: its rights, language and kind.
    pub fn record_url(&self) -> Option<String> {
        match self {
            BookId::Gutenberg(n) => Some(format!("{GUTENBERG}ebooks/{n}.opds")),
            _ => None,
        }
    }

    /// The cover picture, which the browser loads straight from the source.
    pub fn cover_url(&self) -> String {
        match self {
            BookId::Gutenberg(n) => format!("{GUTENBERG}cache/epub/{n}/pg{n}.cover.medium.jpg"),
            BookId::StandardEbooks(segments) => format!(
                "{STANDARD_EBOOKS}ebooks/{}/downloads/cover-thumbnail.jpg",
                segments.join("/")
            ),
        }
    }
}

/// Whether `url` is a picture address the library may keep for a cover: an
/// `https` address at one of the sources, without spaces or quotes.
pub fn cover_allowed(url: &str) -> bool {
    (url.starts_with(GUTENBERG)
        || url.starts_with(STANDARD_EBOOKS)
        || url.starts_with(ARCHIVE_DOWNLOAD))
        && url.len() <= 500
        && !url
            .bytes()
            .any(|b| b <= b' ' || matches!(b, b'"' | b'\'' | b'<' | b'>' | b'\\' | b'`' | 0x7f))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids_round_trip_and_name_their_sources() {
        let moby = BookId::parse("pg-2701").unwrap();
        assert_eq!(moby, BookId::Gutenberg(2701));
        assert_eq!(moby.as_string(), "pg-2701");
        assert_eq!(
            moby.text_url(),
            "https://www.gutenberg.org/cache/epub/2701/pg2701.txt"
        );
        assert_eq!(
            moby.record_url().as_deref(),
            Some("https://www.gutenberg.org/ebooks/2701.opds")
        );
        assert_eq!(
            moby.cover_url(),
            "https://www.gutenberg.org/cache/epub/2701/pg2701.cover.medium.jpg"
        );

        let emma = BookId::parse("se.jane-austen.emma").unwrap();
        assert_eq!(emma.source(), Source::StandardEbooks);
        assert_eq!(
            emma.text_url(),
            "https://standardebooks.org/ebooks/jane-austen/emma/text/single-page"
        );
        assert_eq!(
            BookId::from_standard_ebooks_url(
                "https://standardebooks.org/ebooks/leo-tolstoy/war-and-peace/louise-maude_aylmer-maude"
            )
            .unwrap()
            .as_string(),
            "se.leo-tolstoy.war-and-peace.louise-maude_aylmer-maude"
        );
        // An edition that names its illustrator as well as its translator has four segments.
        let illustrated = BookId::from_standard_ebooks_url(
            "https://standardebooks.org/ebooks/jules-verne/twenty-thousand-leagues-under-the-seas/f-p-walter/milo-winter",
        )
        .expect("a four-segment edition");
        assert_eq!(
            illustrated.as_string(),
            "se.jules-verne.twenty-thousand-leagues-under-the-seas.f-p-walter.milo-winter"
        );
        assert_eq!(
            BookId::parse(&illustrated.as_string()),
            Some(illustrated.clone())
        );
        assert_eq!(
            illustrated.text_url(),
            "https://standardebooks.org/ebooks/jules-verne/twenty-thousand-leagues-under-the-seas/f-p-walter/milo-winter/text/single-page"
        );
    }

    #[test]
    fn a_file_of_the_drive_is_named_by_its_digest() {
        let digest = "0123456789abcdef0123456789abcdef";
        assert_eq!(imported_kind(&format!("epub-{digest}")), Some("epub"));
        assert_eq!(imported_kind(&format!("pdf-{digest}")), Some("pdf"));
        assert_eq!(imported_kind("epub-0123"), None);
        assert_eq!(
            imported_kind(&format!("pdf-{}", digest.to_uppercase())),
            None
        );
        assert_eq!(imported_kind(&format!("txt-{digest}")), None);
        assert_eq!(imported_kind("pg-11"), None);
    }

    #[test]
    fn what_is_not_a_book_is_refused() {
        for id in [
            "pg-",
            "pg-0",
            "pg-01",
            "pg-1000000",
            "pg-12a",
            "se.emma",
            "se.a.b.c.d.e",
            "se.Jane.emma",
            "se.a..b",
            "epub-0123456789abcdef0123456789abcdef",
            "aqua-and-bondi",
            "pg-1/2",
        ] {
            assert_eq!(BookId::parse(id), None, "{id}");
        }
        assert_eq!(
            BookId::from_standard_ebooks_url("https://example.com/ebooks/a/b"),
            None
        );
        assert!(cover_allowed(
            "https://www.gutenberg.org/cache/epub/1/pg1.cover.medium.jpg"
        ));
        assert!(!cover_allowed("https://example.com/x.jpg"));
        assert!(!cover_allowed("https://www.gutenberg.org/a b.jpg"));
    }
}

//! Books' server half: the person's library and their reading of each book,
//! kept per person, and the public-domain books themselves, fetched from
//! Project Gutenberg and Standard Ebooks once and kept for everyone.
//!
//! Per person (`storage.user()`, through `document.rs`):
//!
//! * `GET /api/books/library`: `{"library": {...} | null, "rev": n,
//!   "session": id}`; `null` before the person has saved.
//! * `PUT /api/books/library` with `{"library": {...}, "rev": n}`: replaces
//!   it, or 409 with the current one.
//! * `DELETE /api/books/library`: forgets it, and every book's reading
//!   (see [`forget`]).
//! * `/api/books/reading/<book>`: the place, bookmarks, highlights and notes
//!   of one book (`reading.rs`).
//!
//! The library is `{"collections": [{"id", "name", "books"}], "pages":
//! {book: page}, "marks": {book: [page, ...]}, "sort", "books": [...]}`.
//! `books` lists the books the person got from the Book Store: `{"id",
//! "title", "author", "source", "added", "cover"?}` (`source.rs` for the
//! ids), and those they added from a file of their drive, whose source is
//! `epub` or `pdf` and whose `file` is the drive's id of it. It is left out
//! while empty,
//! so a library saved before Books had a store reads and writes as it did.
//! `pages` and `marks` are the demo's page-numbered places, kept as they are.
//!
//! Shared by everyone (`storage.shared()`):
//!
//! * `GET /api/books/store`: the Book Store's shelves and searches
//!   (`store.rs`);
//! * `GET /api/books/text/<book>[/<n>]`: a book's text in parts (`text.rs`);
//! * `GET /api/books/pictures/<book>[/<n>]`: the pictures of a book whose text
//!   is kept, placed in it, and their files (`pictures.rs`);
//! * `GET /api/books/audiobook/<book>`: an audiobook's chapters at LibriVox
//!   (`audiobooks.rs`);
//! * `/api/books/reviews/<book>`: the ratings and reviews people of this
//!   desktop wrote (`reviews.rs`).
//!
//! Outside requests go through the egress handle `books`, to
//! `https://www.gutenberg.org/`, `https://standardebooks.org/` and LibriVox's
//! API only, and only when a person opens a store, searches, or opens a book
//! not yet kept. An audiobook's sound goes from the Internet Archive straight
//! to the browser.

use std::collections::{BTreeMap, BTreeSet};

use ferrite_app::{serde, serde_json};

use super::document;
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};

mod audiobooks;
mod pictures;
mod reading;
mod reviews;
mod source;
mod store;
mod text;

use source::{BookId, Source};

pub const MODULE: AppModule = AppModule {
    name: "books",
    title: "Books",
    handle,
};

/// The most collections a person keeps.
pub const MAX_COLLECTIONS: usize = 100;
/// The most books in one collection, the most books with a page or
/// bookmarks kept, and the most books in the library.
pub const MAX_BOOKS: usize = 500;
/// The most bookmarks in one book.
pub const MAX_MARKS: usize = 1_000;
/// The highest page number kept.
pub const MAX_PAGE: u32 = 100_000;
/// The most bytes the stored library may take.
pub const MAX_LIBRARY_BYTES: usize = 200_000;
const MAX_NAME_CHARS: usize = 100;
const KEY: &str = "library";
/// The orders of the Sort By menu (`BooksSort`).
const SORTS: &[&str] = &["recent", "title", "author", "manual"];

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub books: Vec<String>,
}

/// A book the person got from the Book Store.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct OwnedBook {
    pub id: String,
    pub title: String,
    pub author: String,
    pub source: String,
    /// When it joined the library, epoch milliseconds.
    pub added: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cover: Option<String>,
    /// The drive's id of the file a book added from one is read from.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Library {
    pub collections: Vec<Collection>,
    pub pages: BTreeMap<String, u32>,
    pub marks: BTreeMap<String, Vec<u32>>,
    pub sort: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub books: Vec<OwnedBook>,
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

async fn route(cx: ApiCtx<'_>) -> Response {
    let ApiCtx {
        request,
        session,
        mut storage,
        ctx,
        now_ms,
    } = cx;
    let path = request.path;
    if let Some(rest) = path.strip_prefix("/reading/") {
        return reading_route(request.method, rest, &request, session, &mut storage).await;
    }
    if let Some(rest) = path.strip_prefix("/reviews/") {
        return reviews::answer(rest, &request, session, &mut storage.shared(), now_ms).await;
    }
    if path == "/store" {
        return match request.method {
            "GET" => store::answer(&request, &mut storage.shared(), ctx, now_ms).await,
            _ => Response::method_not_allowed(),
        };
    }
    if let Some(rest) = path.strip_prefix("/text/") {
        return match request.method {
            "GET" => text::answer(rest, &mut storage.shared(), ctx, now_ms).await,
            _ => Response::method_not_allowed(),
        };
    }
    if let Some(rest) = path.strip_prefix("/audiobook/") {
        return match request.method {
            "GET" => audiobooks::answer(rest, &mut storage.shared(), ctx, now_ms).await,
            _ => Response::method_not_allowed(),
        };
    }
    if let Some(rest) = path.strip_prefix("/pictures/") {
        return match request.method {
            "GET" => pictures::answer(rest, &mut storage.shared(), ctx).await,
            _ => Response::method_not_allowed(),
        };
    }
    let outcome = match (request.method, path) {
        ("GET", "/library") => document::read(&mut storage.user(), KEY)
            .await
            .map(|current| {
                document::for_session(reply(current.doc.as_ref(), current.rev), session)
            }),
        ("PUT", "/library") => match request.json::<Body>().map(|body| {
            let named = body.session;
            validate(&body.library).map(|()| (body.library, body.rev, named))
        }) {
            Err(response) => Ok(response),
            Ok(Err(message)) => Ok(Response::error(400, &message)),
            Ok(Ok((library, base, named))) => {
                match document::other_session(named.as_deref(), session) {
                    Some(refused) => Ok(refused),
                    None => save_library(&mut storage.user(), &library, base).await,
                }
            }
        },
        ("DELETE", "/library") => forget(&mut storage, ctx).await,
        (_, "/library") => Ok(Response::method_not_allowed()),
        _ => Ok(Response::not_found()),
    };
    outcome.unwrap_or_else(|error| Response::error(503, &format!("storage failed: {error}")))
}

/// The bytes `library` takes as stored.
fn library_bytes(library: &Library) -> usize {
    serde_json::to_vec(library).map_or(usize::MAX, |bytes| bytes.len())
}

/// Why a library of `bytes` may not replace one of `before` bytes: only growth past
/// [`MAX_LIBRARY_BYTES`] is refused, so a library kept larger before the limit can still be
/// saved as it shrinks or keeps its size.
fn growth_refusal(bytes: usize, before: usize) -> Option<String> {
    (bytes > MAX_LIBRARY_BYTES && bytes > before)
        .then(|| format!("a library takes at most {MAX_LIBRARY_BYTES} bytes; this is {bytes}"))
}

/// Store `library` if `base` is the stored revision and it does not grow past the size limit.
async fn save_library(
    space: &mut crate::module::Space<'_>,
    library: &Library,
    base: u64,
) -> std::io::Result<Response> {
    let bytes = library_bytes(library);
    if bytes > MAX_LIBRARY_BYTES {
        let current = document::read::<Library>(space, KEY).await?;
        let before = current.doc.as_ref().map_or(0, library_bytes);
        if let Some(message) = growth_refusal(bytes, before) {
            return Ok(Response::error(400, &message));
        }
    }
    document::write(space, KEY, Some(base), Some(library))
        .await
        .map(|saved| document::answer(saved, Some(library), reply))
}

/// How long forgetting may spend emptying the readings, under the gateway's 8 seconds.
const FORGET_BUDGET_MS: u64 = 5_000;

/// Forget the library and every book's reading.
///
/// The library goes first, stored as `null` under its next revision, as `document.rs` forgets;
/// then the readings, all at once, by raising their generation, and then their documents
/// (`reading.rs`): from then on every reading reads as none and every page holding a revision
/// from before is answered 409. A failure of either, or emptying that runs out of time, answers
/// 503, and forgetting again finishes the job: nothing is lost that the person did not ask to
/// forget.
async fn forget(
    storage: &mut crate::module::Storage<'_>,
    ctx: &ferrite_app::AppContext,
) -> std::io::Result<Response> {
    let mut space = storage.user();
    let saved = document::write::<Library>(&mut space, KEY, None, None).await?;
    let deadline = ctx.now_ms() + FORGET_BUDGET_MS;
    reading::forget_all(&mut space, || ctx.now_ms(), deadline).await?;
    Ok(document::answer(saved, None, reply))
}

async fn reading_route(
    method: &str,
    book: &str,
    request: &crate::module::Request<'_>,
    session: &crate::session::Session,
    storage: &mut crate::module::Storage<'_>,
) -> Response {
    let Some(id) = reading::book(book) else {
        return Response::error(404, &format!("{book:?} is not a book Books can read"));
    };
    let saved = |written: reading::Written, kept: Option<&reading::Reading>| {
        match written {
        reading::Written::Saved(saved) => document::answer(saved, kept, reading::reply),
        reading::Written::Full => Response::error(
            400,
            &format!(
                "places and notes are kept for at most {} books; forget the library's to start again",
                reading::MAX_READINGS
            ),
        ),
    }
    };
    let outcome = match method {
        "GET" => reading::read(&mut storage.user(), &id)
            .await
            .map(|current| {
                document::for_session(reading::reply(current.doc.as_ref(), current.rev), session)
            }),
        "PUT" => match request.json::<reading::Body>().map(|body| {
            let named = body.session;
            reading::validate(&body.reading).map(|()| (body.reading, body.rev, named))
        }) {
            Err(response) => Ok(response),
            Ok(Err(message)) => Ok(Response::error(400, &message)),
            Ok(Ok((kept, base, named))) => match document::other_session(named.as_deref(), session)
            {
                Some(refused) => Ok(refused),
                None => reading::write(&mut storage.user(), &id, Some(base), Some(&kept))
                    .await
                    .map(|written| saved(written, Some(&kept))),
            },
        },
        "DELETE" => reading::write(&mut storage.user(), &id, None, None)
            .await
            .map(|written| saved(written, None)),
        _ => Ok(Response::method_not_allowed()),
    };
    outcome.unwrap_or_else(|error| Response::error(503, &format!("storage failed: {error}")))
}

fn reply(library: Option<&Library>, rev: u64) -> serde_json::Value {
    serde_json::json!({ "library": library, "rev": rev })
}

fn book_id(id: &str) -> Result<(), String> {
    if document::valid_key(id) {
        Ok(())
    } else {
        Err(format!("book id {id:?} is not a plain id"))
    }
}

fn page(number: u32) -> Result<(), String> {
    if (1..=MAX_PAGE).contains(&number) {
        Ok(())
    } else {
        Err(format!("a page is 1 to {MAX_PAGE}"))
    }
}

/// Check one book of the library.
fn owned_book(book: &OwnedBook) -> Result<(), String> {
    if let Some(kind) = source::imported_kind(&book.id) {
        if book.source != kind {
            return Err(format!("book {:?} is not from {}", book.id, book.source));
        }
        if !book.file.as_deref().is_some_and(document::valid_key) {
            return Err(format!("book {:?} names no file of the drive", book.id));
        }
        if book.cover.is_some() {
            return Err("a book added from a file has no cover at a source".into());
        }
    } else if source::audiobook_number(&book.id).is_some() {
        if book.source != source::LIBRIVOX_SOURCE {
            return Err(format!("book {:?} is not from {}", book.id, book.source));
        }
        if book.file.is_some() {
            return Err("only a book added from a file names a file".into());
        }
    } else {
        let id = BookId::parse(&book.id)
            .ok_or_else(|| format!("{:?} is not a book Books can read", book.id))?;
        let source = Source::parse(&book.source)
            .ok_or_else(|| format!("{:?} is not a book source", book.source))?;
        if id.source() != source {
            return Err(format!("book {:?} is not from {}", book.id, book.source));
        }
        if book.file.is_some() {
            return Err("only a book added from a file names a file".into());
        }
    }
    let title = book.title.chars().count();
    if book.title.trim().is_empty() || title > store::MAX_TITLE {
        return Err(format!(
            "a book's title has 1 to {} characters",
            store::MAX_TITLE
        ));
    }
    if book.author.chars().count() > store::MAX_TITLE {
        return Err(format!(
            "an author's name has at most {} characters",
            store::MAX_TITLE
        ));
    }
    if book
        .cover
        .as_deref()
        .is_some_and(|url| !source::cover_allowed(url))
    {
        return Err("a cover is a picture at the book's source".into());
    }
    Ok(())
}

/// Check a submitted library.
fn validate(library: &Library) -> Result<(), String> {
    if !SORTS.contains(&library.sort.as_str()) {
        return Err(format!("{:?} is not an order of Sort By", library.sort));
    }
    if library.collections.len() > MAX_COLLECTIONS {
        return Err(format!("at most {MAX_COLLECTIONS} collections"));
    }
    let mut ids = BTreeSet::new();
    for collection in &library.collections {
        if !document::valid_key(&collection.id) || !ids.insert(collection.id.as_str()) {
            return Err(format!(
                "collection id {:?} is not a plain id used once",
                collection.id
            ));
        }
        let length = collection.name.chars().count();
        if collection.name.trim().is_empty() || length > MAX_NAME_CHARS {
            return Err(format!(
                "a collection's name has 1 to {MAX_NAME_CHARS} characters"
            ));
        }
        if collection.books.len() > MAX_BOOKS {
            return Err(format!("a collection holds at most {MAX_BOOKS} books"));
        }
        let mut books = BTreeSet::new();
        for book in &collection.books {
            book_id(book)?;
            if !books.insert(book.as_str()) {
                return Err(format!("book {book:?} is in a collection twice"));
            }
        }
    }
    if library.pages.len() > MAX_BOOKS || library.marks.len() > MAX_BOOKS {
        return Err(format!(
            "pages and bookmarks are kept for at most {MAX_BOOKS} books"
        ));
    }
    for (book, number) in &library.pages {
        book_id(book)?;
        page(*number)?;
    }
    for (book, marks) in &library.marks {
        book_id(book)?;
        if marks.len() > MAX_MARKS {
            return Err(format!("a book has at most {MAX_MARKS} bookmarks"));
        }
        for number in marks {
            page(*number)?;
        }
        if marks.windows(2).any(|pair| pair[0] >= pair[1]) {
            return Err("a book's bookmarks are pages in order, each once".into());
        }
    }
    if library.books.len() > MAX_BOOKS {
        return Err(format!("a library holds at most {MAX_BOOKS} books"));
    }
    let mut owned = BTreeSet::new();
    for book in &library.books {
        owned_book(book)?;
        if !owned.insert(book.id.as_str()) {
            return Err(format!("book {:?} is in the library twice", book.id));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Library {
        serde_json::from_str(
            r#"{"collections":[{"id":"collection-1","name":"Untitled Collection","books":["pg-2701"]}],
                "pages":{"aqua-and-bondi":2},"marks":{"aqua-and-bondi":[2,3]},"sort":"title",
                "books":[{"id":"pg-2701","title":"Moby Dick; Or, The Whale","author":"Herman Melville",
                          "source":"gutenberg","added":1760000000000,
                          "cover":"https://www.gutenberg.org/cache/epub/2701/pg2701.cover.medium.jpg"},
                         {"id":"se.jane-austen.emma","title":"Emma","author":"Jane Austen",
                          "source":"standard-ebooks","added":1760000000001}]}"#,
        )
        .unwrap()
    }

    #[test]
    fn only_growth_past_the_size_limit_is_refused() {
        let over = MAX_LIBRARY_BYTES + 10;
        assert_eq!(growth_refusal(MAX_LIBRARY_BYTES, 0), None);
        assert!(
            growth_refusal(over, 0).is_some(),
            "a new library over the limit"
        );
        assert!(
            growth_refusal(over, over - 1).is_some(),
            "one kept over it grows"
        );
        assert_eq!(
            growth_refusal(over, over),
            None,
            "kept over it, the same size"
        );
        assert_eq!(
            growth_refusal(over - 5, over),
            None,
            "kept over it, smaller"
        );
    }

    #[test]
    fn a_book_added_from_a_file_names_its_file() {
        let digest = "0123456789abcdef0123456789abcdef";
        let book = |id: String, source: &str, file: Option<&str>| OwnedBook {
            id,
            title: "My Book".into(),
            author: String::new(),
            source: source.into(),
            added: 1,
            cover: None,
            file: file.map(str::to_string),
        };
        let epub = format!("epub-{digest}");
        assert_eq!(
            owned_book(&book(epub.clone(), "epub", Some("f-12"))),
            Ok(())
        );
        let pdf = format!("pdf-{digest}");
        assert_eq!(owned_book(&book(pdf.clone(), "pdf", Some("f-12"))), Ok(()));
        assert!(owned_book(&book(epub.clone(), "pdf", Some("f-12"))).is_err());
        assert!(owned_book(&book(epub.clone(), "epub", None)).is_err());
        assert!(owned_book(&book(epub, "epub", Some("a/b"))).is_err());
        assert!(owned_book(&book("pg-11".into(), "gutenberg", Some("f-12"))).is_err());
    }

    #[test]
    fn the_library_round_trips() {
        let library = sample();
        assert_eq!(validate(&library), Ok(()));
        let text = serde_json::to_string(&library).unwrap();
        assert_eq!(serde_json::from_str::<Library>(&text).unwrap(), library);
    }

    #[test]
    fn a_library_saved_before_the_store_reads_and_writes_as_it_did() {
        let old = r#"{"collections":[],"pages":{"aqua-and-bondi":2},"marks":{},"sort":"recent"}"#;
        let library: Library = serde_json::from_str(old).unwrap();
        assert!(library.books.is_empty());
        assert_eq!(validate(&library), Ok(()));
        assert_eq!(
            serde_json::to_string(&library).unwrap(),
            old.replace(' ', "")
        );
    }

    #[test]
    fn bad_libraries_are_refused() {
        let mut sort = sample();
        sort.sort = "colour".into();
        assert!(validate(&sort).is_err(), "an unknown order");

        let mut zero = sample();
        zero.pages.insert("field-guide".into(), 0);
        assert!(validate(&zero).is_err(), "page 0");

        let mut unordered = sample();
        unordered.marks.insert("field-guide".into(), vec![3, 2]);
        assert!(validate(&unordered).is_err(), "bookmarks out of order");

        let mut twice = sample();
        twice.collections.push(twice.collections[0].clone());
        assert!(validate(&twice).is_err(), "one collection id twice");

        let mut blank = sample();
        blank.collections[0].name = "  ".into();
        assert!(validate(&blank).is_err(), "a blank name");

        let mut stray = sample();
        stray.pages.insert("a/b".into(), 1);
        assert!(validate(&stray).is_err(), "a book id that is not plain");

        let mut again = sample();
        again.books.push(again.books[0].clone());
        assert!(validate(&again).is_err(), "one book twice");

        let mut wrong = sample();
        wrong.books[0].source = "standard-ebooks".into();
        assert!(
            validate(&wrong).is_err(),
            "a Gutenberg id from another source"
        );

        let mut invented = sample();
        invented.books[0].id = "aqua-and-bondi".into();
        assert!(validate(&invented).is_err(), "a book no source has");

        let mut cover = sample();
        cover.books[0].cover = Some("https://example.com/cover.jpg".into());
        assert!(validate(&cover).is_err(), "a cover from elsewhere");

        let mut epub = sample();
        epub.books[1].id = "epub-0123456789abcdef0123456789abcdef".into();
        epub.books[1].source = "epub".into();
        assert!(
            validate(&epub).is_err(),
            "an EPUB, which this desktop does not open"
        );

        let mut untitled = sample();
        untitled.books[1].title = " ".into();
        assert!(validate(&untitled).is_err(), "a book without a title");

        assert!(
            serde_json::from_str::<Library>(
                r#"{"collections":[],"pages":{},"marks":{},"sort":"title","theme":"dark"}"#
            )
            .is_err(),
            "unknown fields are refused"
        );
    }
}

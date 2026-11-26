//! Audiobooks, from LibriVox: public-domain books read by volunteers. The catalogue and each book's
//! chapters come from LibriVox's API (`https://librivox.org/api/feed/audiobooks`, the egress handle
//! `books`), and only those small JSON replies pass through here. The sound is hosted by the
//! Internet Archive, and the browser plays it straight from `https://archive.org/download/`, which
//! answers range requests, so seeking in a chapter is the browser's own.
//!
//! * `GET /api/books/store?shelf=librivox[&page=n]` and
//!   `GET /api/books/store?q=<text>&source=librivox[&page=n]`: the listings (`store.rs`).
//! * `GET /api/books/audiobook/lv-<n>`: `{"id", "title", "author", "page", "seconds",
//!   "chapters": [{"title", "url", "seconds", "reader"}]}`, kept for everyone for a week.
//!
//! The API can search only for a title's start (`title=^words`) and an author's whole last name
//! (`author=name`), and has no order of popularity: the shelf is its catalogue from the start.

use ferrite_app::serde_json::{self, Value};
use ferrite_app::{serde, AppContext};

use super::source::{audiobook_number, ARCHIVE_DOWNLOAD, EGRESS, LIBRIVOX, LIBRIVOX_SOURCE};
use super::store::{fetch_failure, Listing, StoreBook, MAX_TITLE};
use crate::apps::news::feed::{clip, decode_entities, html_to_text};
use crate::apps::news::fetch::{self, encode_query};
use crate::http::Response;
use crate::module::Space;

/// Books on one page of a listing.
const PAGE: u32 = 24;
const MAX_SUMMARY: usize = 300;
/// The most bytes of a reply: the longest books list hundreds of chapters.
const REPLY_BYTES: usize = 768 * 1024;
/// The time one fetch of a search may take: up to three, under the gateway's 8 seconds.
const SEARCH_BUDGET_MS: u64 = 2_500;
const BOOK_BUDGET_MS: u64 = 6_000;
/// How long a book's chapters are kept.
const BOOK_KEEP_MS: u64 = 7 * 24 * 60 * 60 * 1000;
const ACCEPT: &str = "application/json";
const LISTING_FIELDS: &str =
    "format=json&coverart=1&fields=%7Bid,title,authors,description,coverart_thumbnail%7D";

/// One chapter, as the player needs it.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Chapter {
    pub title: String,
    pub url: String,
    pub seconds: u64,
    pub reader: String,
}

/// One audiobook, as answered and kept.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Audiobook {
    pub id: String,
    pub title: String,
    pub author: String,
    /// The book's page at LibriVox.
    pub page: String,
    pub seconds: u64,
    pub chapters: Vec<Chapter>,
}

fn string_of(value: Option<&Value>) -> Option<String> {
    match value? {
        Value::String(text) => Some(text.trim().to_string()).filter(|text| !text.is_empty()),
        Value::Number(number) => Some(number.to_string()),
        _ => None,
    }
}

fn seconds_of(value: Option<&Value>) -> u64 {
    string_of(value)
        .and_then(|text| text.parse().ok())
        .unwrap_or(0)
}

/// A file of the Internet Archive as the browser asks for it, or `None` for any other address.
fn archive_file(url: &str) -> Option<String> {
    let rest = url.trim();
    let rest = rest
        .strip_prefix("https://")
        .or_else(|| rest.strip_prefix("http://"))?;
    let path = rest.strip_prefix("www.").unwrap_or(rest);
    let path = path.strip_prefix("archive.org/download/")?;
    let plain = !path.is_empty()
        && path.len() <= 400
        && !path.split('/').any(|part| part == "..")
        && !path
            .bytes()
            .any(|b| b <= b' ' || matches!(b, b'"' | b'\'' | b'<' | b'>' | b'\\' | b'`' | 0x7f));
    plain.then(|| format!("{ARCHIVE_DOWNLOAD}{path}"))
}

fn authors_of(book: &Value) -> String {
    let names: Vec<String> = book
        .get("authors")
        .and_then(Value::as_array)
        .map(|authors| {
            authors
                .iter()
                .map(|author| {
                    let first = string_of(author.get("first_name")).unwrap_or_default();
                    let last = string_of(author.get("last_name")).unwrap_or_default();
                    format!("{first} {last}").trim().to_string()
                })
                .filter(|name| !name.is_empty())
                .collect()
        })
        .unwrap_or_default();
    clip(&decode_entities(&names.join(", ")), MAX_TITLE)
}

/// The books of a listing's reply; `Err` when it is no reply of the API.
fn books_of(body: &[u8]) -> Result<Vec<StoreBook>, String> {
    let reply: Value = serde_json::from_slice(body)
        .map_err(|_| "LibriVox's reply is not a catalogue".to_string())?;
    let books = reply
        .get("books")
        .and_then(Value::as_array)
        .ok_or("LibriVox's reply is not a catalogue")?;
    Ok(books
        .iter()
        .filter_map(|book| {
            let number: u32 = string_of(book.get("id"))?.parse().ok()?;
            let title = string_of(book.get("title"))?;
            let summary = string_of(book.get("description"))
                .map(|text| {
                    html_to_text(&text)
                        .split_whitespace()
                        .collect::<Vec<_>>()
                        .join(" ")
                })
                .filter(|text| !text.is_empty());
            Some(StoreBook {
                id: format!("lv-{number}"),
                title: clip(&decode_entities(&title), MAX_TITLE),
                author: authors_of(book),
                source: LIBRIVOX_SOURCE.into(),
                cover: string_of(book.get("coverart_thumbnail")).and_then(|url| archive_file(&url)),
                summary: summary.map(|text| clip(&text, MAX_SUMMARY)),
            })
        })
        .collect())
}

/// The book of a `?id=<n>&extended=1` reply; `Err` says what is wrong with it.
fn audiobook_of(number: u32, body: &[u8]) -> Result<Audiobook, String> {
    let reply: Value = serde_json::from_slice(body)
        .map_err(|_| "LibriVox's reply about this book could not be read".to_string())?;
    let book = reply
        .get("books")
        .and_then(Value::as_array)
        .and_then(|books| books.first())
        .ok_or("LibriVox lists no such book")?;
    let chapters: Vec<Chapter> = book
        .get("sections")
        .and_then(Value::as_array)
        .map(|sections| {
            sections
                .iter()
                .filter_map(|section| {
                    let url = archive_file(&string_of(section.get("listen_url"))?)?;
                    let number = string_of(section.get("section_number")).unwrap_or_default();
                    let title = string_of(section.get("title"))
                        .map(|title| decode_entities(&title))
                        .unwrap_or_else(|| format!("Section {number}"));
                    let reader = section
                        .get("readers")
                        .and_then(Value::as_array)
                        .and_then(|readers| readers.first())
                        .and_then(|reader| string_of(reader.get("display_name")))
                        .unwrap_or_default();
                    Some(Chapter {
                        title: clip(&title, MAX_TITLE),
                        url,
                        seconds: seconds_of(section.get("playtime")),
                        reader: clip(&decode_entities(&reader), MAX_TITLE),
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    if chapters.is_empty() {
        return Err("LibriVox lists no recording of this book at the Internet Archive".into());
    }
    Ok(Audiobook {
        id: format!("lv-{number}"),
        title: clip(
            &decode_entities(&string_of(book.get("title")).unwrap_or_default()),
            MAX_TITLE,
        ),
        author: authors_of(book),
        page: string_of(book.get("url_librivox"))
            .filter(|url| url.starts_with("https://librivox.org/"))
            .unwrap_or_else(|| format!("https://librivox.org/rss/{number}")),
        seconds: chapters.iter().map(|chapter| chapter.seconds).sum(),
        chapters,
    })
}

async fn fetch_books(
    ctx: &AppContext,
    query: &str,
    budget_ms: u64,
) -> Result<Vec<StoreBook>, Response> {
    let url = format!("{LIBRIVOX}/?{LISTING_FIELDS}&{query}");
    let fetched = fetch::get(ctx, EGRESS, &url, ACCEPT, REPLY_BYTES, budget_ms)
        .await
        .map_err(|error| fetch_failure(&error))?;
    // How the API says it found nothing.
    if fetched.status == 404 {
        return Ok(Vec::new());
    }
    if fetched.status != 200 {
        return Err(Response::error(
            502,
            &format!("LibriVox answered HTTP {}", fetched.status),
        ));
    }
    books_of(&fetched.body).map_err(|message| Response::error(502, &message))
}

/// A listing, and whether it is whole: one a later fetch failed for is answered but not kept.
pub async fn listing(
    ctx: &AppContext,
    text: Option<&str>,
    page: u32,
) -> Result<(Listing, bool), Response> {
    let paged = format!("limit={PAGE}&offset={}", (page - 1) * PAGE);
    let Some(text) = text else {
        let books = fetch_books(ctx, &paged, SEARCH_BUDGET_MS * 2).await?;
        let more = books.len() as u32 == PAGE;
        return Ok((Listing { books, more }, true));
    };
    let title = |words: &str| format!("{paged}&title={}", encode_query(&format!("^{words}")));
    let mut books = fetch_books(ctx, &title(text), SEARCH_BUDGET_MS).await?;
    let more = books.len() as u32 == PAGE;
    let mut whole = true;
    if page == 1 {
        // Most titles in the catalogue that are found by their second word start with "The".
        if books.is_empty() && !text.to_lowercase().starts_with("the ") {
            match fetch_books(ctx, &title(&format!("the {text}")), SEARCH_BUDGET_MS).await {
                Ok(found) => books = found,
                Err(_) => whole = false,
            }
        }
        let last_name = text.split_whitespace().last().unwrap_or(text);
        let by_author = format!("limit={PAGE}&author={}", encode_query(last_name));
        match fetch_books(ctx, &by_author, SEARCH_BUDGET_MS).await {
            Ok(found) => {
                for book in found {
                    if !books.iter().any(|each| each.id == book.id) {
                        books.push(book);
                    }
                }
            }
            Err(_) => whole = false,
        }
    }
    Ok((Listing { books, more }, whole))
}

/// `GET /api/books/audiobook/<id>`.
pub async fn answer(id: &str, shared: &mut Space<'_>, ctx: &AppContext, now_ms: u64) -> Response {
    let Some(number) = audiobook_number(id) else {
        return Response::error(404, &format!("{id:?} is not an audiobook"));
    };
    let key = format!("audiobook/{id}");
    if let Ok(Some(book)) = shared.get_json::<Audiobook>(&key).await {
        return Response::json(200, &book);
    }
    let url = format!("{LIBRIVOX}/?format=json&extended=1&id={number}");
    let fetched = match fetch::get(ctx, EGRESS, &url, ACCEPT, REPLY_BYTES, BOOK_BUDGET_MS).await {
        Ok(fetched) => fetched,
        Err(error) => return fetch_failure(&error),
    };
    if fetched.status == 404 {
        return Response::error(404, "LibriVox lists no such book");
    }
    if fetched.status != 200 {
        return Response::error(502, &format!("LibriVox answered HTTP {}", fetched.status));
    }
    match audiobook_of(number, &fetched.body) {
        Ok(book) => {
            if let Err(error) = shared
                .put_expiring(
                    &key,
                    &serde_json::to_vec(&book).unwrap_or_default(),
                    now_ms + BOOK_KEEP_MS,
                )
                .await
            {
                ferrite_app::tracing::warn!(%error, "could not keep an audiobook's chapters");
            }
            Response::json(200, &book)
        }
        Err(message) => Response::error(502, &message),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const ALICE: &str = r#"{"books":[{"id":"200","title":"Alice&#039;s Adventures",
      "description":"In this <i>classic</i>,<br />a girl falls.",
      "url_librivox":"https:\/\/librivox.org\/alices-adventures\/","totaltimesecs":10731,
      "authors":[{"first_name":"Lewis","last_name":"Carroll"}],
      "coverart_thumbnail":"https:\/\/www.archive.org\/download\/item\/thumb.jpg",
      "sections":[
       {"section_number":"1","title":"Chapter 1","playtime":"640",
        "listen_url":"https:\/\/www.archive.org\/download\/item\/ch_01_64kb.mp3",
        "readers":[{"display_name":"Kristen McQuillin"}]},
       {"section_number":"2","title":"","playtime":"735",
        "listen_url":"http:\/\/archive.org\/download\/item\/ch_02_64kb.mp3","readers":[]},
       {"section_number":"3","title":"Elsewhere","playtime":"5",
        "listen_url":"https:\/\/example.com\/ch_03.mp3","readers":[]}]}]}"#;

    #[test]
    fn a_listing_names_the_book_its_author_and_its_cover_at_the_archive() {
        let books = books_of(ALICE.as_bytes()).unwrap();
        assert_eq!(books.len(), 1);
        assert_eq!(books[0].id, "lv-200");
        assert_eq!(books[0].title, "Alice's Adventures");
        assert_eq!(books[0].author, "Lewis Carroll");
        assert_eq!(books[0].source, "librivox");
        assert_eq!(
            books[0].cover.as_deref(),
            Some("https://archive.org/download/item/thumb.jpg")
        );
        assert!(books[0]
            .summary
            .as_deref()
            .unwrap()
            .starts_with("In this classic"));
    }

    #[test]
    fn a_book_lists_its_chapters_at_the_archive_and_leaves_out_any_elsewhere() {
        let book = audiobook_of(200, ALICE.as_bytes()).unwrap();
        assert_eq!(book.seconds, 1375);
        assert_eq!(book.page, "https://librivox.org/alices-adventures/");
        let chapters: Vec<_> = book
            .chapters
            .iter()
            .map(|each| (each.title.as_str(), each.url.as_str(), each.seconds))
            .collect();
        assert_eq!(
            chapters,
            [
                (
                    "Chapter 1",
                    "https://archive.org/download/item/ch_01_64kb.mp3",
                    640
                ),
                (
                    "Section 2",
                    "https://archive.org/download/item/ch_02_64kb.mp3",
                    735
                ),
            ]
        );
        assert_eq!(book.chapters[0].reader, "Kristen McQuillin");
    }

    #[test]
    fn a_book_with_nothing_to_play_is_said_so() {
        assert!(audiobook_of(1, br#"{"books":[{"title":"X"}]}"#).is_err());
        assert!(audiobook_of(1, b"not json").is_err());
    }

    #[test]
    fn only_the_archives_download_paths_pass() {
        for refused in [
            "https://evil.example/download/a",
            "https://archive.org/details/a",
            "https://archive.org/download/",
            "https://archive.org/download/a/../b",
            "https://archive.org/download/a b",
            "ftp://archive.org/download/a",
        ] {
            assert_eq!(archive_file(refused), None, "{refused}");
        }
    }
}

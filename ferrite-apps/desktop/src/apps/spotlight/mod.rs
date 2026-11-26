//! Spotlight's server half: a search of what the signed-in person keeps in
//! the desktop's other apps, read from their own documents.
//!
//! The desktop's Spotlight (`demos/spotlight/spotlight-desktop.tsx`) searches
//! the names of the applications in the browser, works out sums and unit
//! conversions there, and asks here for the person's own things:
//!
//! * `GET /api/spotlight/search?q=<text>`: `{"query", "results": [...],
//!   "truncated", "indexing", "unsearched_files", "searched_mail",
//!   "unsearched_mail"}`. A result is `{"kind", "app", "id", "title",
//!   "detail", "at"?}`: `kind` one of [`sources::KINDS`], `app` the app that opens it,
//!   `id` the item's id in its document (a web page's address), `title` and
//!   `detail` the two lines Spotlight shows, and `at` an instant in epoch
//!   milliseconds (an event's start, a photo's day, a visit) that the browser
//!   writes in its own time zone. A contact has `lines`, its numbers and
//!   addresses; a kept place `lat` and `lon`; a one-to-one conversation `to`, the
//!   other person's account. Results come grouped by kind in the order of
//!   [`sources::KINDS`], at most [`PER_KIND`] of each; `truncated` says some kind had
//!   more. `indexing` says some text files of the drive were not read yet
//!   (the next search reads more of them). `unsearched_files` counts the text
//!   files beyond [`index::MAX_TEXT_FILES`] whose words no search reads (their
//!   names are still searched). `searched_mail` counts the newest Mail
//!   messages searched, and `unsearched_mail` says older ones were not: past
//!   [`index::MAIL_HEADERS`] messages, or past about [`index::MAIL_SCAN_BYTES`]
//!   of their headers. Spotlight says so under its results.
//! * `GET /api/spotlight/search?q=<text>&only=files`: the same answer for Finder's search: only the
//!   drive is read, and every file and folder that matches is listed, with no limit per kind.
//!   With `only=contents`, only those files whose words hold the query, not their names or tags.
//!
//! What is searched, in the person's own space of each app ([`sources`]):
//! Contacts' cards, Mail's messages (subject, people and the start of the
//! text; not the Trash or Junk), Calendar's events (title, place, notes),
//! Reminders' open reminders, Notes' notes, Stickies, TextEdit's saved
//! documents, the drive's folders and files (names and tags, and the words of
//! text files), Safari's bookmarks and history, Music's songs and Photos'
//! photos and albums, FaceTime's recent calls (the newest with each person) and
//! the books Books holds. An app the person has not saved anything in has
//! nothing to find.
//!
//! ## How a search reads
//!
//! A search reads every source document whole, with Spotlight's own list of
//! kept words, in one `multi_get`, and reads the items from them as it goes:
//! there is no copy of the items to keep current, so whichever route or
//! timer wrote a document, the search sees it as it is. A document is at
//! most what one request may write (a body is at most 256 KiB), and the
//! drive holds at most 1,000 entries. The words of a drive's text file are
//! kept by content and way of reading (`text/<mode>/<content id>`, listed in
//! `texts`): a content never changes, so it is read from the `files` blob
//! once, at most [`index::NEW_TEXTS_PER_SEARCH`] new ones per search, and
//! forgotten a few at a time once no file reads it so. Mail keeps one small
//! header per message, newest first (`apps/mail/users/<person>/m/`); the
//! search reads the newest [`index::MAIL_HEADERS`] of them, and at most about
//! [`index::MAIL_SCAN_BYTES`] of them (a header holds up to 4,000 characters
//! of text), in pages that grow from 32 but never ask for more headers than
//! the bytes left would hold at their longest ([`index::mail_page`]). So a
//! search where nothing changed makes seven store calls for someone with text
//! files and no conversations: the documents, the kept words, Mail's first page,
//! Find My's devices, the Chess games, FaceTime's recents and the Messages
//! activity index. Someone with conversations pays two more (who they blocked,
//! and one batch of the conversations and what they cleared of them). The kept
//! words are of at most [`index::MAX_TEXT_FILES`] files (at most
//! [`index::FILE_TEXT_CHARS`] characters each), and there is one more call for each
//! further page of a Mail of more than 32 messages (about six pages for 200
//! short ones).
//!
//! Every word of the query must appear in an item, ignoring case. Items whose
//! title starts with the first word come first, then those whose title holds
//! every word, then the rest, each in document order. The query is at most
//! [`MAX_QUERY_CHARS`] characters and [`MAX_WORDS`] words; a longer one is
//! refused with 400.
//!
//! Limits: ranking is the simple order above (no relevance score, stemming
//! or fuzzy matching); a text file's words are those of its first 192 KiB
//! piece, at most [`index::FILE_TEXT_CHARS`] characters, and only the first
//! [`index::MAX_TEXT_FILES`] text files of the drive are searched by their
//! words. Spotlight opens a web page in a new Safari tab, a text file in
//! TextEdit and another file selected in Finder; anything else opens the app
//! that keeps it, not the item.
//! Messages' shared rooms are not searched, since they belong to everyone who
//! names them; the person's own conversations are, the newest
//! [`index::CONVERSATIONS`] of them, each as far as its document goes and leaving
//! out what that person deleted or blocked.

mod index;
mod sources;

use ferrite_app::serde_json::{self, Value};

use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};

pub use sources::Item;

pub const MODULE: AppModule = AppModule {
    name: "spotlight",
    title: "Spotlight",
    handle,
};

/// The most results of one kind.
pub const PER_KIND: usize = 10;
/// The longest query, in characters.
pub const MAX_QUERY_CHARS: usize = 200;
/// The most words a query may have.
pub const MAX_WORDS: usize = 8;

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    match (cx.request.method, cx.request.path) {
        ("GET", "/search") => {
            let raw = cx.request.query_param("q").unwrap_or("");
            let query = match decode(raw) {
                Some(query) => query,
                None => {
                    return Response::error(400, "the query is not valid percent-encoded UTF-8")
                }
            };
            let words = match words(&query) {
                Ok(words) => words,
                Err(message) => return Response::error(400, &message),
            };
            if words.is_empty() {
                return Response::json(
                    200,
                    &serde_json::json!({
                        "query": query, "results": [], "truncated": false, "indexing": false,
                        "unsearched_files": 0, "searched_mail": 0, "unsearched_mail": false,
                    }),
                );
            }
            let only = match cx.request.query_param("only") {
                Some("files") => index::Only::Files,
                Some("contents") => index::Only::Contents,
                _ => index::Only::Everything,
            };
            match index::search(&mut cx, &words, only).await {
                Ok(found) => Response::json(
                    200,
                    &serde_json::json!({
                        "query": query,
                        "results": found.results,
                        "truncated": found.truncated,
                        "indexing": found.indexing,
                        "unsearched_files": found.unsearched_files,
                        "searched_mail": found.searched_mail,
                        "unsearched_mail": found.unsearched_mail,
                    }),
                ),
                Err(error) => Response::error(503, &format!("storage failed: {error}")),
            }
        }
        (_, "/search") => Response::method_not_allowed(),
        ("POST", "/pdf-text") => {
            let body: PdfText = match cx.request.json() {
                Ok(body) => body,
                Err(response) => return response,
            };
            match index::keep_pdf_text(&mut cx, &body.file, &body.text).await {
                Ok(true) => Response::json(200, &serde_json::json!({ "kept": true })),
                Ok(false) => Response::error(404, "the drive has no such PDF"),
                Err(error) => Response::error(503, &format!("storage failed: {error}")),
            }
        }
        (_, "/pdf-text") => Response::method_not_allowed(),
        _ => Response::not_found(),
    }
}

/// `POST /pdf-text`: the words of a PDF of the drive, which a page read with
/// pdf.js as the server cannot.
#[derive(ferrite_app::serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct PdfText {
    file: String,
    text: String,
}

/// Percent-decode a query parameter (`+` is a space, as a form sends it).
pub fn decode(raw: &str) -> Option<String> {
    let bytes = raw.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'+' => out.push(b' '),
            b'%' => {
                let hex = bytes.get(i + 1..i + 3)?;
                let text = std::str::from_utf8(hex).ok()?;
                out.push(u8::from_str_radix(text, 16).ok()?);
                i += 2;
            }
            b => out.push(b),
        }
        i += 1;
    }
    String::from_utf8(out).ok()
}

/// The query's words, lower-cased: at least none, at most [`MAX_WORDS`].
pub fn words(query: &str) -> Result<Vec<String>, String> {
    if query.chars().count() > MAX_QUERY_CHARS {
        return Err(format!("a query is at most {MAX_QUERY_CHARS} characters"));
    }
    let words: Vec<String> = query.split_whitespace().map(str::to_lowercase).collect();
    if words.len() > MAX_WORDS {
        return Err(format!("a query is at most {MAX_WORDS} words"));
    }
    Ok(words)
}

/// Whether `text` (lower-cased) holds every word.
pub fn matches_text(text: &str, words: &[String]) -> bool {
    !words.is_empty() && words.iter().all(|word| text.contains(word.as_str()))
}

/// Whether `item` holds every word.
pub fn matches(item: &Item, words: &[String]) -> bool {
    matches_text(&item.text, words)
}

/// The order within a kind: 0 when the title starts with the first word, 1
/// when the title holds every word, 2 otherwise.
pub fn rank(item: &Item, words: &[String]) -> u8 {
    let title = item.title.to_lowercase();
    if words
        .first()
        .is_some_and(|first| title.starts_with(first.as_str()))
    {
        0
    } else if words.iter().all(|word| title.contains(word.as_str())) {
        1
    } else {
        2
    }
}

/// The items of one kind that match, best first, and whether more than [`PER_KIND`] did, of which
/// only those are given. `extra` gives an item's further text (a text file's words), searched with
/// its own.
pub fn found_with(
    items: Vec<Item>,
    words: &[String],
    extra: impl Fn(&Item) -> Option<String>,
) -> (Vec<Item>, bool) {
    let hits = found_every(items, words, extra);
    let more = hits.len() > PER_KIND;
    (hits.into_iter().take(PER_KIND).collect(), more)
}

/// [`found_with`] with every item that matches.
pub fn found_every(
    items: Vec<Item>,
    words: &[String],
    extra: impl Fn(&Item) -> Option<String>,
) -> Vec<Item> {
    let mut hits: Vec<(u8, usize, Item)> = Vec::new();
    for (order, mut item) in items.into_iter().enumerate() {
        if matches(&item, words) {
            hits.push((rank(&item, words), order, item));
            continue;
        }
        // Not by its name: perhaps by its words, shown around the first one
        // its name lacks.
        let Some(more) = extra(&item) else { continue };
        let lower = format!("{}\n{}", item.text, more.to_lowercase());
        if matches_text(&lower, words) {
            if let Some(shown) = words
                .iter()
                .find(|word| !item.text.contains(word.as_str()))
                .and_then(|word| sources::snippet(&more, word))
            {
                item.detail = shown;
            }
            hits.push((rank(&item, words), order, item));
        }
    }
    hits.sort_by_key(|(rank, order, _)| (*rank, *order));
    hits.into_iter().map(|(_, _, item)| item).collect()
}

/// The items whose further text alone (`extra`) holds every word.
pub fn found_in_contents(
    items: Vec<Item>,
    words: &[String],
    extra: impl Fn(&Item) -> Option<String>,
) -> Vec<Item> {
    items
        .into_iter()
        .filter(|item| extra(item).is_some_and(|more| matches_text(&more.to_lowercase(), words)))
        .collect()
}

/// [`found_with`] without further text.
#[cfg(test)]
pub fn found(items: Vec<Item>, words: &[String]) -> (Vec<Item>, bool) {
    found_with(items, words, |_| None)
}

/// A result as the browser is given it.
fn result(hit: &Item) -> Value {
    let mut value = serde_json::json!({
        "kind": hit.kind,
        "app": hit.app,
        "id": hit.id,
        "title": hit.title,
        "detail": hit.detail,
    });
    if let Some(at) = hit.at {
        value["at"] = at.into();
    }
    if !hit.lines.is_empty() {
        value["lines"] = hit.lines.clone().into();
    }
    if let Some(to) = &hit.to {
        value["to"] = to.as_str().into();
    }
    if let Some((lat, lon)) = hit.spot {
        value["lat"] = lat.into();
        value["lon"] = lon.into();
    }
    value
}

#[cfg(test)]
mod tests {
    use super::sources::item;
    use super::*;

    fn q(text: &str) -> Vec<String> {
        words(text).unwrap()
    }

    #[test]
    fn queries_are_decoded_split_and_bounded() {
        assert_eq!(decode("ada%20lovelace").as_deref(), Some("ada lovelace"));
        assert_eq!(decode("caf%C3%A9+au+lait").as_deref(), Some("café au lait"));
        assert_eq!(decode("%zz"), None);
        assert_eq!(decode("%C3"), None, "not UTF-8");
        assert_eq!(q("  Ada   LOVELACE "), vec!["ada", "lovelace"]);
        assert!(words(&"a ".repeat(MAX_WORDS + 1)).is_err());
        assert!(words(&"a".repeat(MAX_QUERY_CHARS + 1)).is_err());
        assert!(
            words(&"é".repeat(MAX_QUERY_CHARS)).is_ok(),
            "counted in characters"
        );
    }

    #[test]
    fn every_word_must_match_and_title_prefixes_come_first() {
        let make = |id: &str, title: &str, extra: &str| {
            item("notes", "notes", id, title, "", &[title, extra])
        };
        let items = vec![
            make("a", "Shopping list", "tea milk"),
            make("b", "Tea party", ""),
            make("c", "Weekend", "tea at noon"),
            make("d", "Green tea", ""),
        ];
        let (hits, more) = found(items.clone(), &q("tea"));
        let ids: Vec<&str> = hits.iter().map(|hit| hit.id.as_str()).collect();
        assert_eq!(ids, vec!["b", "d", "a", "c"]);
        assert!(!more);
        let (hits, _) = found(items.clone(), &q("tea milk"));
        assert_eq!(hits.len(), 1);
        assert!(
            found(items, &[]).0.is_empty(),
            "an empty query finds nothing"
        );

        let many: Vec<Item> = (0..PER_KIND + 3)
            .map(|n| make(&n.to_string(), "tea", ""))
            .collect();
        let (hits, more) = found(many, &q("tea"));
        assert_eq!(hits.len(), PER_KIND);
        assert!(more);
    }

    #[test]
    fn the_words_inside_a_file_count_for_contents_and_its_name_does_not() {
        let named = sources::item(
            "files",
            "files",
            "a",
            "ferns.txt",
            "Documents",
            &["ferns.txt"],
        );
        let inside = sources::item(
            "files",
            "files",
            "b",
            "plain.txt",
            "Documents",
            &["plain.txt"],
        );
        let hits = found_in_contents(vec![named, inside], &q("ferns"), |item| {
            Some(
                if item.id == "b" {
                    "Some Ferns here"
                } else {
                    "nothing"
                }
                .to_string(),
            )
        });
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].id, "b");
    }

    #[test]
    fn a_file_is_found_by_its_words_and_shows_them() {
        let file = item(
            "files",
            "finder",
            "f1",
            "todo.txt",
            "Documents",
            &["todo.txt"],
        );
        let words_of = |_: &Item| Some("Remember to water the Ferns on Friday".to_string());
        let (hits, _) = found_with(vec![file.clone()], &q("ferns"), words_of);
        assert_eq!(hits.len(), 1);
        assert!(hits[0].detail.contains("Ferns"), "{}", hits[0].detail);
        let (hits, _) = found_with(vec![file.clone()], &q("todo friday"), words_of);
        assert_eq!(hits.len(), 1, "name and words together");
        let (hits, _) = found_with(vec![file], &q("todo"), words_of);
        assert_eq!(
            hits[0].detail, "Documents",
            "matched by name: the folder stays"
        );
    }
}

//! What a person keeps of one book: the place they read to, their bookmarks,
//! and their highlights with notes. One document per book in the person's
//! own space, so turning a page saves a small document and not the whole
//! library.
//!
//! * `GET /api/books/reading/<book>`: `{"reading": {...} | null, "rev": n,
//!   "session": id}`.
//! * `PUT /api/books/reading/<book>` with `{"reading": {...}, "rev": n}`.
//! * `DELETE /api/books/reading/<book>`.
//!
//! The document is `{"place": offset, "bookmarks": [{"at", "label"}],
//! "highlights": [{"id", "start", "end", "color", "text", "note"}]}`.
//! An audiobook's `place` is the seconds listened to across its whole recording.
//! Offsets count UTF-16 units of the book's whole text (`text.rs`), the same
//! for every browser and window size, so a place kept in one browser opens at
//! the same words in another. `label` and `text` are short excerpts, kept so
//! the Notes list can show them before the book's text has loaded.
//!
//! How they are kept. The person's space holds one record, `readings`: the
//! readings' generation and the books that have a reading in it, in the order
//! they got one. A book's reading lives in the slot of its position in that
//! list, `reading/<slot>`, as `{"generation", "book", "rev", "doc"}`. The list
//! holds at most [`MAX_READINGS`] books, so a person's readings take at most
//! that many keys whatever ids their requests name; a book joins the list,
//! with one compare-and-set of the record, before its slot is first written.
//!
//! Revisions follow `document.rs` (a `PUT` names the revision it was based
//! on and is answered 409 when that is not the stored one), with one
//! addition: forgetting the library forgets every reading at once, and no
//! reading's revision ever goes back. A forget raises the generation and
//! empties the list in one compare-and-set of the record; a slot whose
//! document is of an earlier generation, or of another book, reads as no
//! reading. The revision a page sees is `generation * 2^32 + revision`, so
//! after a forget every revision is higher than any a page holds from before
//! it, and a page left open across a forget is answered 409 instead of
//! writing over notes made since. A write checks the generation again once it
//! has committed: one that committed in a generation a forget has just raised
//! is answered 409, and its document is forgotten with the rest. The forget
//! then overwrites every slot that may hold an earlier generation's document
//! with an empty one of the new generation (each a compare-and-set that leaves
//! a newer write alone), so the notes are gone from the store and not only
//! unreadable. How far it got is kept in the record (`dirty`), so a forget
//! that runs out of time is finished by the next one rather than started over.

use std::collections::BTreeSet;
use std::io;

use ferrite_app::{serde, serde_json};

use super::source::BookId;
use crate::apps::document::{self, Current, Saved};
use crate::module::Space;

/// The highest offset kept.
pub const MAX_OFFSET: u64 = 100_000_000;
/// The most bookmarks, and the most highlights, of one book.
pub const MAX_BOOKMARKS: usize = 500;
pub const MAX_HIGHLIGHTS: usize = 500;
/// The most characters of a bookmark's label and a highlight's excerpt.
pub const MAX_LABEL: usize = 200;
pub const MAX_EXCERPT: usize = 300;
/// The most characters of a note.
pub const MAX_NOTE: usize = 2_000;
/// The longest highlight, in UTF-16 units.
pub const MAX_SPAN: u64 = 50_000;
/// The most bytes the stored document may take.
pub const MAX_BYTES: usize = 200_000;
/// The most books with a reading between two forgets, as many as a library holds.
pub const MAX_READINGS: usize = super::MAX_BOOKS;
/// The colours of a highlight, as the reader's menu offers them.
pub const COLORS: &[&str] = &["yellow", "green", "blue", "pink", "purple"];

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Bookmark {
    pub at: u64,
    pub label: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Highlight {
    pub id: String,
    pub start: u64,
    pub end: u64,
    pub color: String,
    pub text: String,
    #[serde(default)]
    pub note: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Reading {
    pub place: u64,
    #[serde(default)]
    pub bookmarks: Vec<Bookmark>,
    #[serde(default)]
    pub highlights: Vec<Highlight>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Body {
    pub reading: Reading,
    pub rev: u64,
    #[serde(default)]
    pub session: Option<String>,
}

/// The id of the book `book` names, as the record lists it, or `None` for an id that names no
/// book.
pub fn book(book: &str) -> Option<String> {
    BookId::parse(book)
        .map(|id| id.as_string())
        .or_else(|| super::source::imported_kind(book).map(|_| book.to_string()))
        .or_else(|| super::source::audiobook_number(book).map(|_| book.to_string()))
}

/// The key of the person's readings record.
pub const RECORD_KEY: &str = "readings";
/// The prefix of every reading slot's key.
pub const SLOT_PREFIX: &str = "reading/";
/// How many revisions one generation has: a page sees `generation * REV_SPAN + revision`.
const REV_SPAN: u64 = 1 << 32;
/// The most generations, so every revision a page sees is an integer JavaScript holds
/// exactly (below 2^53).
pub const MAX_GENERATION: u64 = (1 << 21) - 1;
/// Compare-and-set attempts before a write gives up on a key that keeps changing.
const ATTEMPTS: usize = 8;

/// The person's readings record.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Record {
    /// The readings' generation, raised by each forget; 0 before the first.
    pub generation: u64,
    /// The books with a reading in this generation; a book's position is its slot.
    #[serde(default)]
    pub books: Vec<String>,
    /// The slots below this one may still hold a document of an earlier generation: what a
    /// forget has yet to empty. A forget raises it to cover the slots of the generation it
    /// ends, and emptying lowers it from the top as it goes, so a forget that ran out of time
    /// goes on where it stopped.
    #[serde(default)]
    pub dirty: usize,
}

/// A slot as stored.
#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Stored {
    generation: u64,
    #[serde(default)]
    book: String,
    rev: u64,
    doc: Option<Reading>,
}

#[derive(serde::Serialize)]
#[serde(crate = "ferrite_app::serde")]
struct StoredRef<'a> {
    generation: u64,
    book: &'a str,
    rev: u64,
    doc: Option<&'a Reading>,
}

/// What a [`write`] did.
#[derive(Debug, PartialEq)]
pub enum Written {
    Saved(Saved<Reading>),
    /// Not stored: [`MAX_READINGS`] other books already have a reading.
    Full,
}

/// The revision a page sees of revision `rev` of `generation`.
pub fn seen(generation: u64, rev: u64) -> u64 {
    generation * REV_SPAN + rev
}

fn slot_key(slot: usize) -> String {
    format!("{SLOT_PREFIX}{slot}")
}

fn stored_bytes(
    generation: u64,
    book: &str,
    rev: u64,
    doc: Option<&Reading>,
) -> io::Result<Vec<u8>> {
    serde_json::to_vec(&StoredRef {
        generation,
        book,
        rev,
        doc,
    })
    .map_err(io::Error::other)
}

/// The readings record and the store's version of it (`None`: none yet).
pub async fn read_record(space: &mut Space<'_>) -> io::Result<(Record, Option<u64>)> {
    match space.get_versioned(RECORD_KEY).await? {
        None => Ok((Record::default(), None)),
        Some((bytes, version)) => serde_json::from_slice(&bytes)
            .map(|record| (record, Some(version)))
            .map_err(io::Error::other),
    }
}

/// The reading of `book` in `slot` as `generation` sees it (none when the slot holds an
/// earlier generation's document or another book's), its revision in that generation, and the
/// store's version of the key. `None` when the slot is of a later generation: a forget raised
/// the record after it was read, so the caller reads the record again.
async fn stored(
    space: &mut Space<'_>,
    slot: usize,
    book: &str,
    generation: u64,
) -> io::Result<Option<(Option<Reading>, u64, Option<u64>)>> {
    match space.get_versioned(&slot_key(slot)).await? {
        None => Ok(Some((None, 0, None))),
        Some((bytes, version)) => {
            let kept: Stored = serde_json::from_slice(&bytes).map_err(io::Error::other)?;
            Ok(match kept.generation.cmp(&generation) {
                std::cmp::Ordering::Equal if kept.book == book => {
                    Some((kept.doc, kept.rev, Some(version)))
                }
                std::cmp::Ordering::Equal | std::cmp::Ordering::Less => {
                    Some((None, 0, Some(version)))
                }
                std::cmp::Ordering::Greater => None,
            })
        }
    }
}

/// The reading of `book` and the revision a page sees.
pub async fn read(space: &mut Space<'_>, book: &str) -> io::Result<Current<Reading>> {
    for _ in 0..ATTEMPTS {
        let (record, _) = read_record(space).await?;
        let Some(slot) = record.books.iter().position(|b| b == book) else {
            return Ok(Current {
                doc: None,
                rev: seen(record.generation, 0),
            });
        };
        if let Some((doc, rev, _)) = stored(space, slot, book, record.generation).await? {
            return Ok(Current {
                doc,
                rev: seen(record.generation, rev),
            });
        }
    }
    Err(io::Error::other(
        "the reading is of a generation the readings record does not reach",
    ))
}

/// Store `doc` (`None` forgets the reading) for `book` if `base` is the revision the page sees
/// (`None`: whatever is stored).
pub async fn write(
    space: &mut Space<'_>,
    book: &str,
    base: Option<u64>,
    doc: Option<&Reading>,
) -> io::Result<Written> {
    for _ in 0..ATTEMPTS {
        let (mut record, record_version) = read_record(space).await?;
        let generation = record.generation;
        let slot = match record.books.iter().position(|b| b == book) {
            Some(slot) => slot,
            None => {
                let none = seen(generation, 0);
                if base.is_some_and(|base| base != none) {
                    return Ok(Written::Saved(Saved::Conflict(Current {
                        doc: None,
                        rev: none,
                    })));
                }
                // Forgetting a reading that is not kept changes nothing.
                if doc.is_none() {
                    return Ok(Written::Saved(Saved::Stored(none)));
                }
                if record.books.len() >= MAX_READINGS {
                    return Ok(Written::Full);
                }
                record.books.push(book.to_string());
                let bytes = serde_json::to_vec(&record).map_err(io::Error::other)?;
                if !space
                    .put_if_version(RECORD_KEY, &bytes, record_version)
                    .await?
                {
                    continue;
                }
                record.books.len() - 1
            }
        };
        // A slot written in a later generation than the record read is never replaced.
        let Some((current, rev, version)) = stored(space, slot, book, generation).await? else {
            continue;
        };
        if base.is_some_and(|base| base != seen(generation, rev)) {
            return Ok(Written::Saved(Saved::Conflict(Current {
                doc: current,
                rev: seen(generation, rev),
            })));
        }
        let next = rev + 1;
        if next >= REV_SPAN {
            return Err(io::Error::other("the reading's revision is at its limit"));
        }
        let bytes = stored_bytes(generation, book, next, doc)?;
        if !space
            .put_if_version(&slot_key(slot), &bytes, version)
            .await?
        {
            // Another write got there first: it shows as a changed revision on the next pass.
            continue;
        }
        // Checked as the write commits: a forget that began after this write read the record
        // has made it part of the generation it forgets.
        let (now, _) = read_record(space).await?;
        if now.generation == generation {
            return Ok(Written::Saved(Saved::Stored(seen(generation, next))));
        }
        empty_slot(space, slot, now.generation).await?;
        return Ok(Written::Saved(Saved::Conflict(read(space, book).await?)));
    }
    Err(io::Error::other(
        "the reading kept changing during the save",
    ))
}

/// Replace what `slot` holds, if it is of a generation before `generation`, with an empty
/// document of that generation, in one compare-and-set: a write of `generation` that got there
/// first is kept.
async fn empty_slot(space: &mut Space<'_>, slot: usize, generation: u64) -> io::Result<()> {
    let key = slot_key(slot);
    let Some((bytes, version)) = space.get_versioned(&key).await? else {
        return Ok(());
    };
    let older =
        serde_json::from_slice::<Stored>(&bytes).map_or(true, |kept| kept.generation < generation);
    if older {
        space
            .put_if_version(&key, &stored_bytes(generation, "", 0, None)?, Some(version))
            .await?;
    }
    Ok(())
}

/// How many slots emptying goes through between two saves of how far it got.
const CURSOR_EVERY: usize = 32;

/// Record that the slots from `low` up hold nothing of a generation before `generation`, if the
/// record is still of that generation and says less. A record that keeps changing is left: the
/// next forget empties those slots again, which costs time and loses nothing.
async fn lower_dirty(space: &mut Space<'_>, generation: u64, low: usize) -> io::Result<()> {
    for _ in 0..ATTEMPTS {
        let (mut record, version) = read_record(space).await?;
        if record.generation != generation || record.dirty <= low {
            return Ok(());
        }
        record.dirty = low;
        let bytes = serde_json::to_vec(&record).map_err(io::Error::other)?;
        if space.put_if_version(RECORD_KEY, &bytes, version).await? {
            return Ok(());
        }
    }
    Ok(())
}

/// Forget every reading of the person: raise the generation and empty the list in one
/// compare-and-set, so every reading reads as none from then on, then empty every slot that may
/// hold an earlier generation's document, from the highest down. `deadline_ms` bounds the
/// emptying (`now_ms` reads the clock); past it the answer is an error, the readings being
/// forgotten already, and forgetting again goes on from where this one stopped.
pub async fn forget_all(
    space: &mut Space<'_>,
    now_ms: impl Fn() -> u64,
    deadline_ms: u64,
) -> io::Result<()> {
    let mut raised = None;
    for _ in 0..ATTEMPTS {
        let (record, version) = read_record(space).await?;
        if record.generation >= MAX_GENERATION {
            return Err(io::Error::other("the readings cannot be forgotten again"));
        }
        let next = Record {
            generation: record.generation + 1,
            books: Vec::new(),
            dirty: record.dirty.max(record.books.len()),
        };
        let bytes = serde_json::to_vec(&next).map_err(io::Error::other)?;
        if space.put_if_version(RECORD_KEY, &bytes, version).await? {
            raised = Some(next);
            break;
        }
    }
    let Some(Record {
        generation, dirty, ..
    }) = raised
    else {
        return Err(io::Error::other(
            "the readings kept changing during the forget",
        ));
    };
    let mut low = dirty;
    while low > 0 {
        if now_ms() >= deadline_ms {
            lower_dirty(space, generation, low).await?;
            return Err(io::Error::new(
                io::ErrorKind::TimedOut,
                "forgetting the notes did not finish in time; forget again to finish",
            ));
        }
        empty_slot(space, low - 1, generation).await?;
        low -= 1;
        if (dirty - low) % CURSOR_EVERY == 0 {
            lower_dirty(space, generation, low).await?;
        }
    }
    lower_dirty(space, generation, 0).await
}

pub fn reply(reading: Option<&Reading>, rev: u64) -> serde_json::Value {
    serde_json::json!({ "reading": reading, "rev": rev })
}

fn offset(what: &str, at: u64) -> Result<(), String> {
    if at <= MAX_OFFSET {
        Ok(())
    } else {
        Err(format!("{what} is past the end of any book ({MAX_OFFSET})"))
    }
}

fn short(what: &str, text: &str, max: usize) -> Result<(), String> {
    if text.chars().count() <= max {
        Ok(())
    } else {
        Err(format!("{what} has at most {max} characters"))
    }
}

/// Check a submitted reading document.
pub fn validate(reading: &Reading) -> Result<(), String> {
    offset("the place", reading.place)?;
    if reading.bookmarks.len() > MAX_BOOKMARKS {
        return Err(format!("a book has at most {MAX_BOOKMARKS} bookmarks"));
    }
    for mark in &reading.bookmarks {
        offset("a bookmark", mark.at)?;
        short("a bookmark's label", &mark.label, MAX_LABEL)?;
    }
    if reading
        .bookmarks
        .windows(2)
        .any(|pair| pair[0].at >= pair[1].at)
    {
        return Err("a book's bookmarks are places in order, each once".into());
    }
    if reading.highlights.len() > MAX_HIGHLIGHTS {
        return Err(format!("a book has at most {MAX_HIGHLIGHTS} highlights"));
    }
    let mut ids = BTreeSet::new();
    for highlight in &reading.highlights {
        if !document::valid_key(&highlight.id) || !ids.insert(highlight.id.as_str()) {
            return Err(format!(
                "highlight id {:?} is not a plain id used once",
                highlight.id
            ));
        }
        offset("a highlight", highlight.end)?;
        if highlight.start >= highlight.end || highlight.end - highlight.start > MAX_SPAN {
            return Err(format!(
                "a highlight covers 1 to {MAX_SPAN} characters, start before end"
            ));
        }
        if !COLORS.contains(&highlight.color.as_str()) {
            return Err(format!("{:?} is not a highlight colour", highlight.color));
        }
        short("a highlight's excerpt", &highlight.text, MAX_EXCERPT)?;
        short("a note", &highlight.note, MAX_NOTE)?;
    }
    let bytes = serde_json::to_vec(reading).map_or(usize::MAX, |b| b.len());
    if bytes > MAX_BYTES {
        return Err(format!(
            "a book's notes take at most {MAX_BYTES} bytes; this is {bytes}"
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Reading {
        serde_json::from_str(
            r#"{"place": 1200,
                "bookmarks": [{"at": 812, "label": "Call me Ishmael."}, {"at": 1200, "label": "It is a way"}],
                "highlights": [{"id": "h-1", "start": 812, "end": 828, "color": "yellow",
                                "text": "Call me Ishmael.", "note": "The first line."}]}"#,
        )
        .unwrap()
    }

    #[test]
    fn a_reading_round_trips() {
        let reading = sample();
        assert_eq!(validate(&reading), Ok(()));
        let text = serde_json::to_string(&reading).unwrap();
        assert_eq!(serde_json::from_str::<Reading>(&text).unwrap(), reading);
        let bare: Reading = serde_json::from_str(r#"{"place": 0}"#).unwrap();
        assert!(bare.bookmarks.is_empty() && bare.highlights.is_empty());
        assert_eq!(book("pg-2701").as_deref(), Some("pg-2701"));
        assert_eq!(book("aqua-and-bondi"), None, "only a book Books can read");
    }

    #[test]
    fn bad_readings_are_refused() {
        let mut far = sample();
        far.place = MAX_OFFSET + 1;
        assert!(validate(&far).is_err(), "a place past any book");

        let mut unordered = sample();
        unordered.bookmarks.reverse();
        assert!(validate(&unordered).is_err(), "bookmarks out of order");

        let mut empty = sample();
        empty.highlights[0].end = empty.highlights[0].start;
        assert!(validate(&empty).is_err(), "an empty highlight");

        let mut colour = sample();
        colour.highlights[0].color = "orange".into();
        assert!(
            validate(&colour).is_err(),
            "a colour the menu does not offer"
        );

        let mut twice = sample();
        twice.highlights.push(twice.highlights[0].clone());
        assert!(validate(&twice).is_err(), "one highlight id twice");

        let mut long = sample();
        long.highlights[0].note = "n".repeat(MAX_NOTE + 1);
        assert!(validate(&long).is_err(), "a note too long");

        let mut heavy = sample();
        heavy.highlights = (0..MAX_HIGHLIGHTS)
            .map(|n| Highlight {
                id: format!("h-{n}"),
                start: n as u64,
                end: n as u64 + 1,
                color: "blue".into(),
                text: "t".repeat(MAX_EXCERPT),
                note: "n".repeat(MAX_NOTE),
            })
            .collect();
        assert!(
            validate(&heavy).is_err(),
            "more bytes than a stored value holds"
        );

        assert!(
            serde_json::from_str::<Reading>(r#"{"place": 1, "theme": "sepia"}"#).is_err(),
            "unknown fields are refused"
        );
    }
}

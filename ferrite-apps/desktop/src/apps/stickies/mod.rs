//! Stickies' server half: a session's notes.
//!
//! The Stickies demo edits its notes in the browser. When the desktop is served
//! by this application it saves them here and reads them back when a note
//! opens, so they survive a reload.
//!
//! * `GET /api/stickies/data`: `{"data": {"notes": [...]}, "rev": n}`, or
//!   `{"data": null, "rev": 0}` when the session never saved any.
//! * `PUT /api/stickies/data` with `{"base": n, "data": {"notes": [...]}}`: replaces the
//!   session's notes and answers `200` with `{"rev"}`, the new revision. Each note is
//!   `{id, color, text}` with optional `html`, `frame`, `collapsed` and `translucent`,
//!   as `SavedStickiesNote` in `demos/stickies/stickies-sync.ts`. A body that is
//!   not such a list is refused with `400` and nothing changes.
//!
//! `text` is the note's plain text: its title, what Spotlight searches and what
//! the length limit counts. `html` is the same text with its formats, as the
//! note's editor writes it: at most [`MAX_HTML_BYTES`], and only the markup that
//! formatting makes ([`valid_html`]): the elements of styled text and line
//! breaks, with `style`, `color`, `face`, `size` and `align` attributes whose
//! values, once their character references are decoded, are those formatting
//! writes: allow-listed style properties with plain values, nothing that loads
//! or runs anything. A picture is an `img` whose `src` holds the picture itself
//! ([`picture_address`]), so it loads nothing either. The page cleans what it sends to that
//! markup and cleans what it reads again before it shows it; a note without
//! `html`, as every note saved before formats were kept, opens as its text.
//!
//! The server owns the revision: 0 before the first save, one more with each.
//! `base` is the revision the writer last had. The write is stored only when
//! `base` is still the stored revision; any other base is refused with `409`
//! and `{"rev"}` of the stored one, and nothing changes, so a write made from
//! a stale copy never replaces what it did not see. The page then reads the
//! stored notes and merges its changes into them
//! (`demos/desktop/synced-document.ts`).
//!
//! Storage: one key, `notes`, in the session's own space, holding
//! `{rev, data}` and written by compare-and-set.

use std::io;

use ferrite_app::serde;
use ferrite_app::serde_json;

use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture, Space};

use super::document;

pub const MODULE: AppModule = AppModule {
    name: "stickies",
    title: "Stickies",
    handle,
};

/// The most notes a session keeps.
pub const MAX_NOTES: usize = 100;
/// The longest note, in characters.
pub const MAX_TEXT_CHARS: usize = 20_000;
/// The longest formatted text of a note, in bytes of UTF-8 (`MAX_HTML` of
/// `demos/stickies/stickies-sync.ts`, which saves a note's text alone when its
/// formats would take more).
pub const MAX_HTML_BYTES: usize = 100_000;
/// The farthest a frame may reach from the desktop's origin, in points.
const MAX_COORDINATE: f64 = 100_000.0;
const KEY: &str = "notes";

/// One of the six colours of the Color menu.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum Color {
    Yellow,
    Blue,
    Green,
    Pink,
    Purple,
    Gray,
}

/// Where a note is on the desktop and how large, in points.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Frame {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// One note.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Note {
    pub id: String,
    pub color: Color,
    pub text: String,
    /// The text with its formats, as the note's editor writes it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub html: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub frame: Option<Frame>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub collapsed: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub translucent: Option<bool>,
}

/// What a session stores.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Data {
    pub notes: Vec<Note>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Put {
    /// The revision the writer last had; the write is stored only on it.
    base: u64,
    data: Data,
}

/// What the session's key holds: the notes and the revision that wrote them.
#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Stored {
    rev: u64,
    data: Data,
    /// The writes that named themselves (`document.rs`).
    #[serde(default)]
    writes: Vec<String>,
    #[serde(default)]
    writes_from: Option<u64>,
}

/// How many times a write tries its compare-and-set while others get in.
const CAS_ATTEMPTS: usize = 8;

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    let outcome = match (cx.request.method, cx.request.path) {
        ("GET", "/data") => {
            let mut user = cx.storage.user();
            let stored = user.get_json::<Stored>(KEY).await;
            stored.map(|stored| {
                match &stored {
                    Some(s) => user
                        .write_ids()
                        .heard(&s.writes, s.writes_from.unwrap_or(s.rev)),
                    None => user.write_ids().heard(&[], 0),
                }
                let rev = stored.as_ref().map_or(0, |s| s.rev);
                let data = stored.map(|s| s.data);
                Response::json(200, &serde_json::json!({ "data": data, "rev": rev }))
            })
        }
        ("PUT", "/data") => {
            let put = match cx.request.json::<Put>() {
                Ok(put) => put,
                Err(response) => return response,
            };
            if let Err(message) = validate(&put.data) {
                return Response::error(400, &message);
            }
            let Some(rev) = put.base.checked_add(1) else {
                return Response::error(400, "base is past the last revision");
            };
            let body = serde_json::json!({ "rev": rev, "data": put.data });
            put_revised(&mut cx.storage.user(), put.base, &body)
                .await
                .map(|written| match written {
                    Ok(()) => Response::json(200, &serde_json::json!({ "rev": rev })),
                    Err(stored) => Response::json(
                        409,
                        &serde_json::json!({ "error": "the notes have changed since that revision", "rev": stored }),
                    ),
                })
        }
        (_, "/data") => Ok(Response::method_not_allowed()),
        _ => Ok(Response::not_found()),
    };
    outcome.unwrap_or_else(|error| Response::error(503, &format!("storage failed: {error}")))
}

/// Write `body` if the stored revision is still `base` (`Ok(Err(stored))`
/// otherwise): a compare-and-set, tried again while other writers get in
/// between.
async fn put_revised(
    user: &mut Space<'_>,
    base: u64,
    body: &serde_json::Value,
) -> io::Result<Result<(), u64>> {
    for _ in 0..CAS_ATTEMPTS {
        let current = user.get_versioned(KEY).await?;
        // Only an absent document is revision 0: one that cannot be read is never overwritten.
        let (stored, writes, from) = match &current {
            None => (0, Vec::new(), None),
            Some((value, _)) => {
                // The whole stored value is read: a revision beside a document that cannot be
                // read does not make the document replaceable.
                let stored = serde_json::from_slice::<Stored>(value).map_err(|e| {
                    io::Error::new(
                        io::ErrorKind::InvalidData,
                        format!("the stored notes are unreadable: {e}"),
                    )
                })?;
                (stored.rev, stored.writes, stored.writes_from)
            }
        };
        if stored != base {
            return Ok(Err(stored));
        }
        let (writes, from) = document::with_write(writes, from, stored, user.write_ids().this());
        let mut next = body.clone();
        document::stamp_writes(&mut next, &writes, from);
        let bytes = serde_json::to_vec(&next)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;
        let expected = current.map(|(_, version)| version);
        if user.put_if_version(KEY, &bytes, expected).await? {
            return Ok(Ok(()));
        }
    }
    Err(io::Error::other("the notes kept changing under this write"))
}

/// An id the demo makes: 1 to 64 letters, digits, `-` and `_`.
fn is_id(id: &str) -> bool {
    (1..=64).contains(&id.len())
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

/// Bound a submitted list of notes.
pub fn validate(data: &Data) -> Result<(), String> {
    if data.notes.len() > MAX_NOTES {
        return Err(format!("at most {MAX_NOTES} notes"));
    }
    let mut ids = std::collections::BTreeSet::new();
    for note in &data.notes {
        if !is_id(&note.id) {
            return Err(format!(
                "note id {:?} must be 1 to 64 letters, digits, '-' or '_'",
                note.id
            ));
        }
        if !ids.insert(note.id.as_str()) {
            return Err(format!("note id {:?} is used twice", note.id));
        }
        if note.text.chars().count() > MAX_TEXT_CHARS {
            return Err(format!(
                "note {:?} is longer than {MAX_TEXT_CHARS} characters",
                note.id
            ));
        }
        if let Some(html) = &note.html {
            if html.len() > MAX_HTML_BYTES {
                return Err(format!(
                    "the formatted text of note {:?} is longer than {MAX_HTML_BYTES} bytes",
                    note.id
                ));
            }
            if let Err(problem) = valid_html(html) {
                return Err(format!(
                    "the formatted text of note {:?} {problem}",
                    note.id
                ));
            }
        }
        if let Some(frame) = note.frame {
            let within = |v: f64| v.is_finite() && v.abs() <= MAX_COORDINATE;
            if ![frame.x, frame.y, frame.width, frame.height]
                .into_iter()
                .all(within)
                || frame.width <= 0.0
                || frame.height <= 0.0
            {
                return Err(format!("note {:?} has an impossible frame", note.id));
            }
        }
    }
    Ok(())
}

/// The elements a note's formatted text may hold: those the browsers' editing
/// commands and line breaks make, as `richTextFromHtml` in
/// `src/lib/rich-text.ts` keeps them.
const HTML_ELEMENTS: &[&str] = &[
    "div",
    "p",
    "br",
    "span",
    "font",
    "b",
    "i",
    "u",
    "s",
    "strike",
    "strong",
    "em",
    "sub",
    "sup",
    "ul",
    "ol",
    "li",
    "blockquote",
    "pre",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "img",
];

/// The attributes those elements may have.
const HTML_ATTRIBUTES: &[&str] = &["style", "color", "face", "size", "align"];

/// The style properties a note's formatting writes, as `richTextFromHtml` keeps them.
const STYLE_PROPERTIES: &[&str] = &[
    "text-align",
    "line-height",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "text-decoration",
    "text-decoration-line",
    "color",
    "background-color",
    "letter-spacing",
    "font-kerning",
    "font-variant-ligatures",
    "vertical-align",
    "-webkit-text-stroke",
    "-webkit-text-stroke-width",
    "-webkit-text-stroke-color",
    "-webkit-text-fill-color",
];

/// The named character references the browsers write when they serialize formatted text.
const NAMED_REFERENCES: &[(&str, char)] = &[
    ("amp", '&'),
    ("lt", '<'),
    ("gt", '>'),
    ("quot", '"'),
    ("apos", '\''),
    ("nbsp", '\u{a0}'),
];

/// `text` with its character references decoded, as a browser reads an attribute: decimal
/// (`&#114;`), hexadecimal (`&#x72;`) and the [`NAMED_REFERENCES`]. A reference that is not
/// closed by `;`, names a character outside those, or decodes to no character is refused, so
/// nothing a browser would decode differently reaches the checks unread. Notes checks its
/// formatted text with this too.
pub(crate) fn decode_references(text: &str) -> Result<String, String> {
    let mut decoded = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(start) = rest.find('&') {
        decoded.push_str(&rest[..start]);
        rest = &rest[start + 1..];
        let Some(end) = rest.find(';') else {
            return Err("holds a character reference that does not end".into());
        };
        let reference = &rest[..end];
        let character = if let Some(number) = reference.strip_prefix('#') {
            let code = match number.strip_prefix(['x', 'X']) {
                Some(hex) if !hex.is_empty() && hex.chars().all(|c| c.is_ascii_hexdigit()) => {
                    u32::from_str_radix(hex, 16).ok()
                }
                None if !number.is_empty() && number.chars().all(|c| c.is_ascii_digit()) => {
                    number.parse::<u32>().ok()
                }
                _ => None,
            };
            code.filter(|&code| code != 0).and_then(char::from_u32)
        } else {
            NAMED_REFERENCES
                .iter()
                .find(|(name, _)| *name == reference)
                .map(|&(_, character)| character)
        };
        let Some(character) = character else {
            return Err(format!(
                "holds the character reference &{reference};, which formatting does not write"
            ));
        };
        decoded.push(character);
        rest = &rest[end + 1..];
    }
    decoded.push_str(rest);
    Ok(decoded)
}

/// Whether one style property's `value` (decoded) is plain: words, numbers, units, `#`
/// colours, quoted family names and `rgb()`/`rgba()` colours, and nothing else. No `url(`,
/// no other function, no escape, no comment and no `!important` can be written with these.
fn plain_style_value(value: &str) -> bool {
    // Everything formatting writes is ASCII; refusing the rest first also keeps every index
    // below on a character boundary.
    if !value.is_ascii() {
        return false;
    }
    let lower = value.trim().to_ascii_lowercase();
    let mut rest = lower.as_str();
    let mut outside = String::with_capacity(rest.len());
    while let Some(open) = rest.find('(') {
        let before = &rest[..open];
        let name_start = before
            .rfind(|c: char| !c.is_ascii_alphabetic())
            .map_or(0, |at| at + 1);
        if !matches!(&before[name_start..], "rgb" | "rgba") {
            return false;
        }
        let Some(close) = rest[open..].find(')') else {
            return false;
        };
        let arguments = &rest[open + 1..open + close];
        if !arguments
            .chars()
            .all(|c| c.is_ascii_digit() || matches!(c, ' ' | ',' | '.' | '%' | '/'))
        {
            return false;
        }
        outside.push_str(&before[..name_start]);
        outside.push(' ');
        rest = &rest[open + close + 1..];
    }
    outside.push_str(rest);
    !lower.is_empty()
        && outside.chars().all(|c| {
            c.is_ascii_alphanumeric() || matches!(c, ' ' | '#' | '.' | ',' | '%' | '-' | '\'' | '"')
        })
}

/// Whether a `style` attribute's `value` (decoded) holds only declarations of
/// [`STYLE_PROPERTIES`] with plain values.
fn allowed_style(value: &str) -> Result<(), String> {
    for declaration in value.split(';') {
        if declaration.trim().is_empty() {
            continue;
        }
        let Some((property, property_value)) = declaration.split_once(':') else {
            return Err(format!(
                "holds the style {declaration:?}, which cannot be read"
            ));
        };
        let property = property.trim().to_ascii_lowercase();
        if !STYLE_PROPERTIES.contains(&property.as_str()) {
            return Err(format!(
                "sets the style property {property:?}, which formatting does not write"
            ));
        }
        if !plain_style_value(property_value) {
            return Err(format!(
                "gives the style property {property} the value {:?}, which formatting does not write",
                property_value.trim()
            ));
        }
    }
    Ok(())
}

/// Whether `value` (decoded) is one the attribute `name` of [`HTML_ATTRIBUTES`] may have: the
/// values `richTextFromHtml` keeps. Notes, whose text the same function rebuilds, checks those
/// five attributes with this too.
pub(crate) fn allowed_attribute(name: &str, value: &str) -> Result<(), String> {
    let plain = match name {
        "style" => return allowed_style(value),
        "color" => {
            let colour = value.strip_prefix('#').unwrap_or(value);
            (1..=20).contains(&colour.len()) && colour.chars().all(|c| c.is_ascii_alphanumeric())
        }
        "face" => {
            (1..=200).contains(&value.len())
                && value.chars().all(|c| {
                    c.is_ascii_alphanumeric() || matches!(c, '_' | ' ' | ',' | '\'' | '"' | '-')
                })
        }
        "size" => matches!(value, "1" | "2" | "3" | "4" | "5" | "6" | "7"),
        "align" => matches!(
            value.to_ascii_lowercase().as_str(),
            "left" | "right" | "center" | "justify"
        ),
        _ => false,
    };
    if plain {
        Ok(())
    } else {
        Err(format!(
            "holds the {name} {value:?}, which formatting does not write"
        ))
    }
}

/// Whether `value` (decoded) is a picture a note may hold: a base64 data address of a raster
/// type. SVG, which can hold markup, and every address that names another place are refused.
fn picture_address(value: &str) -> bool {
    let Some(rest) = value.strip_prefix("data:image/") else {
        return false;
    };
    let Some((kind, data)) = rest.split_once(";base64,") else {
        return false;
    };
    let digits = data.trim_end_matches('=');
    matches!(kind, "png" | "jpeg" | "webp" | "gif")
        && !digits.is_empty()
        && data.len() - digits.len() <= 2
        && digits
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'+' || b == b'/')
}

/// Whether the attribute `name` of the element `element` may have `value` (decoded): `src` and
/// `alt` belong to a picture alone, and a picture takes no other.
fn allowed_on(element: &str, name: &str, value: &str) -> Result<(), String> {
    match (element, name) {
        ("img", "src") if picture_address(value) => Ok(()),
        ("img", "alt") if value.chars().count() <= 200 && !value.contains(['<', '>']) => Ok(()),
        ("img", _) | (_, "src" | "alt") => {
            Err(format!("holds a {name} that formatting does not write"))
        }
        _ => allowed_attribute(name, value),
    }
}

/// Whether `html` is markup a note's editor writes: text and character
/// references, and tags of [`HTML_ELEMENTS`] with no attribute but those of
/// [`HTML_ATTRIBUTES`], each value, once its character references are decoded,
/// one formatting writes ([`STYLE_PROPERTIES`] with plain values for a style).
/// No comment, declaration or processing instruction, and no `<` that does not
/// start one of those tags (the editor writes a typed `<` as `&lt;`). The page
/// rebuilds what it shows from the same elements whatever it reads; this keeps
/// the store from holding anything else.
pub fn valid_html(html: &str) -> Result<(), String> {
    let bytes = html.as_bytes();
    let mut at = 0;
    while let Some(offset) = bytes[at..].iter().position(|&b| b == b'<') {
        at += offset + 1;
        let closing = bytes.get(at) == Some(&b'/');
        if closing {
            at += 1;
        }
        let name_length = bytes[at..]
            .iter()
            .take_while(|b| b.is_ascii_alphanumeric())
            .count();
        if name_length == 0 {
            return Err("holds a '<' that starts no element".into());
        }
        let name = html[at..at + name_length].to_ascii_lowercase();
        if !HTML_ELEMENTS.contains(&name.as_str()) {
            return Err(format!(
                "holds a <{name}> element, which formatting does not write"
            ));
        }
        at += name_length;
        loop {
            at += bytes[at..]
                .iter()
                .take_while(|b| b.is_ascii_whitespace())
                .count();
            match bytes.get(at) {
                None => return Err(format!("has a <{name}> tag that does not end")),
                Some(b'>') => {
                    at += 1;
                    break;
                }
                Some(b'/') if bytes.get(at + 1) == Some(&b'>') => {
                    at += 2;
                    break;
                }
                Some(_) if closing => {
                    return Err(format!("has a </{name}> tag with attributes"));
                }
                Some(_) => {
                    let length = bytes[at..]
                        .iter()
                        .take_while(|b| b.is_ascii_alphanumeric() || **b == b'-')
                        .count();
                    if length == 0 {
                        return Err(format!("has a <{name}> tag that cannot be read"));
                    }
                    let attribute = html[at..at + length].to_ascii_lowercase();
                    if !HTML_ATTRIBUTES.contains(&attribute.as_str())
                        && !matches!(attribute.as_str(), "src" | "alt")
                    {
                        return Err(format!(
                            "gives <{name}> a {attribute} attribute, which formatting does not write"
                        ));
                    }
                    at += length;
                    at += bytes[at..]
                        .iter()
                        .take_while(|b| b.is_ascii_whitespace())
                        .count();
                    if bytes.get(at) != Some(&b'=') {
                        allowed_on(&name, &attribute, "")
                            .map_err(|problem| format!("<{name}> {problem}"))?;
                        continue;
                    }
                    at += 1;
                    at += bytes[at..]
                        .iter()
                        .take_while(|b| b.is_ascii_whitespace())
                        .count();
                    let value = match bytes.get(at) {
                        Some(&quote) if quote == b'"' || quote == b'\'' => {
                            let Some(length) = bytes[at + 1..].iter().position(|&b| b == quote)
                            else {
                                return Err(format!("has a <{name}> attribute that does not end"));
                            };
                            let value = &html[at + 1..at + 1 + length];
                            at += length + 2;
                            value
                        }
                        _ => {
                            let length = bytes[at..]
                                .iter()
                                .take_while(|b| !b.is_ascii_whitespace() && **b != b'>')
                                .count();
                            let value = &html[at..at + length];
                            at += length;
                            value
                        }
                    };
                    let decoded = decode_references(value)
                        .map_err(|problem| format!("<{name}> {attribute} {problem}"))?;
                    allowed_on(&name, &attribute, &decoded)
                        .map_err(|problem| format!("<{name}> {problem}"))?;
                }
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(json: &str) -> Result<Data, String> {
        let mut body: serde_json::Value = serde_json::from_str(json).map_err(|e| e.to_string())?;
        body["base"] = 0.into();
        let put: Put = serde_json::from_value(body).map_err(|e| e.to_string())?;
        validate(&put.data)?;
        Ok(put.data)
    }

    #[test]
    fn the_demo_shape_round_trips() {
        let data = parse(
            r#"{"data":{"notes":[{"id":"note-1","color":"blue","text":"Buy milk\nand bread",
            "frame":{"x":28,"y":44,"width":355,"height":268},"collapsed":true}]}}"#,
        )
        .unwrap();
        assert_eq!(data.notes[0].color, Color::Blue);
        assert_eq!(data.notes[0].collapsed, Some(true));
        let stored = serde_json::to_value(&data).unwrap();
        assert!(
            stored["notes"][0].get("translucent").is_none(),
            "absent stays absent"
        );
        assert_eq!(serde_json::from_value::<Data>(stored).unwrap(), data);
    }

    #[test]
    fn malformed_notes_are_refused() {
        let note = |body: &str| format!(r#"{{"data":{{"notes":[{body}]}}}}"#);
        assert!(
            parse(&note(r#"{"id":"a","color":"orange","text":""}"#)).is_err(),
            "unknown colour"
        );
        assert!(
            parse(&note(r#"{"id":"a b","color":"gray","text":""}"#)).is_err(),
            "bad id"
        );
        assert!(parse(&note(r#"{"id":"a","color":"gray","text":"","extra":1}"#)).is_err());
        assert!(parse(&note(
            r#"{"id":"a","color":"gray","text":"","frame":{"x":0,"y":0,"width":0,"height":5}}"#
        ))
        .is_err());
        let twice = r#"{"id":"a","color":"gray","text":""},{"id":"a","color":"gray","text":""}"#;
        assert!(parse(&note(twice)).is_err(), "duplicate id");
        let long = format!(
            r#"{{"id":"a","color":"gray","text":"{}"}}"#,
            "x".repeat(MAX_TEXT_CHARS + 1)
        );
        assert!(parse(&note(&long)).is_err());
        let longest = format!(
            r#"{{"id":"a","color":"gray","text":"{}"}}"#,
            "x".repeat(MAX_TEXT_CHARS)
        );
        assert!(
            parse(&note(&longest)).is_ok(),
            "the limit itself is allowed"
        );
    }

    #[test]
    fn a_note_keeps_its_formatted_text_and_one_saved_before_it_has_none() {
        let data = parse(
            r#"{"data":{"notes":[{"id":"note-1","color":"yellow","text":"Buy milk\nand eggs",
            "html":"<b>Buy milk</b><div>and <span style=\"font-weight: bold;\">eggs</span></div>"},
            {"id":"note-2","color":"blue","text":"Call Ada"}]}}"#,
        )
        .unwrap();
        assert_eq!(
            data.notes[0].html.as_deref(),
            Some(r#"<b>Buy milk</b><div>and <span style="font-weight: bold;">eggs</span></div>"#)
        );
        assert_eq!(
            data.notes[1].html, None,
            "a note saved before formats were kept"
        );
        let stored = serde_json::to_value(&data).unwrap();
        assert!(
            stored["notes"][1].get("html").is_none(),
            "absent stays absent"
        );
        assert_eq!(serde_json::from_value::<Data>(stored).unwrap(), data);
        // What the session stored before this field existed still reads.
        let earlier: Stored = serde_json::from_str(
            r#"{"rev":3,"data":{"notes":[{"id":"a","color":"gray","text":"Old"}]}}"#,
        )
        .unwrap();
        assert_eq!(earlier.data.notes[0].html, None);
    }

    #[test]
    fn a_note_keeps_a_picture_held_in_its_own_markup_and_nothing_that_loads() {
        for html in [
            r#"<div>Trip</div><img src="data:image/webp;base64,UklGRg==" alt="Beach &amp; sea.png">"#,
            r#"<img src="data:image/png;base64,iVBORw0KGgo=">"#,
            r#"<img src="data:image/jpeg;base64,/9j/4AAQ" alt="">"#,
        ] {
            assert_eq!(valid_html(html), Ok(()), "{html}");
        }
        for html in [
            r#"<img src="https://example.com/track.png">"#,
            r#"<img src="/api/files/content/1">"#,
            r#"<img src="data:image/svg+xml;base64,PHN2Zz4=">"#,
            r#"<img src="data:text/html;base64,PHNjcmlwdD4=">"#,
            r#"<img src="data:image/png;base64,">"#,
            r#"<img src="data:image/png;base64,ab cd">"#,
            r#"<img src="&#100;ata:image/svg+xml;base64,PHN2Zz4=">"#,
            r#"<img src>"#,
            r#"<img src="data:image/png;base64,iVBOR" onerror="steal()">"#,
            r#"<img src="data:image/png;base64,iVBOR" style="color: red">"#,
            r#"<div src="data:image/png;base64,iVBOR">x</div>"#,
            r#"<span alt="x">y</span>"#,
        ] {
            assert!(valid_html(html).is_err(), "{html}");
        }
    }

    #[test]
    fn formatted_text_is_the_markup_formatting_writes() {
        for html in [
            "",
            "plain text &amp; more &lt;b&gt; &nbsp;",
            "<b>Title</b><div><br></div><div>line</div>",
            r#"<span style="font-family: &quot;Helvetica Neue&quot;, Helvetica; font-size: 18px;">x</span>"#,
            r#"<span style="letter-spacing: -0.5px; font-kerning: none; vertical-align: super">x</span>"#,
            r#"<span style="font-variant-ligatures: common-ligatures discretionary-ligatures">x</span>"#,
            r#"<span style="-webkit-text-stroke: 0.5px currentcolor; -webkit-text-fill-color: transparent">x</span>"#,
            r#"<span style="-webkit-text-stroke-width: 0.5px; -webkit-text-stroke-color: currentcolor; -webkit-text-fill-color: transparent">x</span>"#,
            r##"<font face="Georgia, serif" color="#ff0000" size="7">x</font>"##,
            r#"<div align="center" style='text-align: center'>x</div><br/>"#,
            "<ul><li>one</li></ul><blockquote>q</blockquote><pre>p</pre><h1>h</h1>",
            "<s>a</s><strike>b</strike><sub>c</sub><sup>d</sup><i>e</i><u>f</u><em>g</em>",
        ] {
            assert_eq!(valid_html(html), Ok(()), "{html}");
        }
        for html in [
            "<script>steal()</script>",
            r#"<img src="x" onerror="steal()">"#,
            r#"<a href="javascript:steal()">x</a>"#,
            r#"<span onclick="steal()">x</span>"#,
            r#"<span style="background: url(https://example.com/x)">x</span>"#,
            r#"<span style="width: expression(steal())">x</span>"#,
            r#"<div style="color: red\"">x</div>"#,
            "<!-- a comment -->",
            "<!DOCTYPE html>",
            "a < b",
            "<b",
            r#"<span style="color: red>x</span>"#,
            "</b class=\"x\">",
            "<style>b{}</style>",
            "<iframe></iframe>",
        ] {
            assert!(valid_html(html).is_err(), "{html}");
        }
    }

    #[test]
    fn encoded_payloads_are_decoded_before_they_are_checked() {
        for html in [
            // `url(` spelt with a decimal, a hexadecimal and a named reference.
            r#"<span style="color: red; background-image: u&#114;l(https://example.com/x)">x</span>"#,
            r#"<span style="color: u&#x72;l(https://example.com/x)">x</span>"#,
            r#"<span style="color: url&#40;https://example.com/x)">x</span>"#,
            // An escape, encoded: `\75 rl(` is `url(` to a style sheet.
            r#"<span style="color: &#92;75 rl(https://example.com/x)">x</span>"#,
            r#"<span style="color: &#x5c;75 rl(https://example.com/x)">x</span>"#,
            // A property formatting does not write, its name encoded.
            r#"<span style="&#98;ackground: red">x</span>"#,
            // A comment, a function and `!important`, encoded.
            r#"<span style="color: red&#47;&#42;x&#42;&#47;">x</span>"#,
            r#"<span style="color: e&#120;pression(steal())">x</span>"#,
            r#"<span style="color: red &#33;important">x</span>"#,
            // References a browser decodes but this does not: unterminated, unknown, zero.
            r#"<span style="color: u&#114l(https://example.com/x)">x</span>"#,
            r#"<span style="color: &lpar;">x</span>"#,
            r#"<span style="color: &#0;">x</span>"#,
            r#"<span style="color: &#xd800;">x</span>"#,
            // The other attributes keep their own values, decoded.
            r#"<font face="Georgia&#59; x">x</font>"#,
            r#"<font color="&#35;f00&#40;">x</font>"#,
            r#"<font size="&#56;">x</font>"#,
            r#"<div align="cen&#116;er&#33;">x</div>"#,
            // Characters outside ASCII, before a parenthesis or anywhere: refused, not a panic.
            r#"<span style="color: é(1)">x</span>"#,
            r#"<span style="color: &#233;(1)">x</span>"#,
            r#"<span style="font-family: 日本(1)">x</span>"#,
            r#"<span style="color: ré">x</span>"#,
        ] {
            assert!(valid_html(html).is_err(), "{html}");
        }
        for html in [
            r#"<span style="color: rgb(255, 0, 0); background-color: rgba(0, 0, 0, 0.5)">x</span>"#,
            r#"<span style="text-decoration: underline line-through; line-height: 1.2">x</span>"#,
            r#"<span style="font-weight: bold; font-style: italic; color: &#35;ff0000">x</span>"#,
            r#"<font face="&quot;Helvetica Neue&quot;" size="&#55;" color="&#x23;00f">x</font>"#,
            r#"<div align="cen&#116;er">x</div>"#,
        ] {
            assert_eq!(valid_html(html), Ok(()), "{html}");
        }
        assert_eq!(
            decode_references("a&amp;b &#114;&#X72; &nbsp;").as_deref(),
            Ok("a&b rr \u{a0}")
        );
    }

    #[test]
    fn formatted_text_is_bounded_and_checked_when_saved() {
        let note = |html: &str| {
            let body = serde_json::json!({
                "data": { "notes": [{ "id": "a", "color": "yellow", "text": "x", "html": html }] }
            });
            parse(&body.to_string())
        };
        assert!(note("<b>x</b>").is_ok());
        let error = note(r#"<img src="x" onerror="steal()">"#).unwrap_err();
        assert!(error.contains("img"), "{error}");
        let longest = "x".repeat(MAX_HTML_BYTES);
        assert!(note(&longest).is_ok(), "the limit itself is allowed");
        let error = note(&format!("{longest}x")).unwrap_err();
        assert!(error.contains("bytes"), "{error}");
        // Bytes, not characters: a three-byte character counts three.
        assert!(note(&"€".repeat(MAX_HTML_BYTES / 3 + 1)).is_err());
        // Not text at all is no note.
        let body = r#"{"data":{"notes":[{"id":"a","color":"yellow","text":"x","html":5}]}}"#;
        assert!(parse(body).is_err());
    }
}

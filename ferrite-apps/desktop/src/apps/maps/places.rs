//! Each person's places: Favorites, Recents and Guides, one document in the
//! person's own space (`storage.user()`) under the revision rule of
//! `document.rs`.
//!
//! * `GET /api/maps/places`: `{"favorites": [place], "recents": [place],
//!   "guides": [{"id", "name", "places": [place]}], "rev", "session"}`, the
//!   three `null` before the first save.
//! * `PUT /api/maps/places` with the three lists and the `rev` the page
//!   last had: replaces them, or answers 409 with the stored ones
//!   (`document.rs`).
//! * `DELETE /api/maps/places`: forgets them.
//!
//! The server refuses a document with more than [`MAX_FAVORITES`] favorites,
//! [`MAX_RECENTS`] recents (newest first), [`MAX_GUIDES`] guides or
//! [`MAX_GUIDE_PLACES`] places in one guide, or one over [`MAX_DOCUMENT_BYTES`]
//! serialized; a place listed twice in one
//! list; a place whose id is not a plain id, whose name is empty or longer
//! than [`MAX_NAME_CHARS`], whose point is off the globe, whose address has
//! more than [`MAX_ADDRESS_LINES`] lines, or whose links are not `http(s)`
//! (Wikipedia: `https://<language>.wikipedia.org/`); and any field it does
//! not know.

use std::collections::BTreeSet;

use ferrite_app::{serde, serde_json};

use super::super::document;
use crate::http::Response;
use crate::module::ApiCtx;

/// The most favorites.
pub const MAX_FAVORITES: usize = 200;
/// The most recent places, newest first.
pub const MAX_RECENTS: usize = 30;
/// The most guides.
pub const MAX_GUIDES: usize = 50;
/// The most places in one guide.
pub const MAX_GUIDE_PLACES: usize = 200;
/// The longest place or guide name.
pub const MAX_NAME_CHARS: usize = 200;
/// The longest guide name.
pub const MAX_GUIDE_NAME_CHARS: usize = 100;
/// The longest category.
pub const MAX_CATEGORY_CHARS: usize = 100;
/// The most lines of an address, and the longest line.
pub const MAX_ADDRESS_LINES: usize = 6;
pub const MAX_LINE_CHARS: usize = 200;
/// The longest link and the longest phone number.
pub const MAX_LINK_CHARS: usize = 2048;
pub const MAX_PHONE_CHARS: usize = 64;
/// The largest stored value this module writes, the bound the desktop's
/// modules keep every store value under (Books, News, TV): well under the
/// gateway's 256 KiB body cap as well.
pub const STORE_VALUE_BYTES: usize = 200_000;
/// The most bytes the stored form's revision wrapper adds around the document
/// (`{"rev":<u64>,"doc":` and `}` from `document.rs`, 35 at most), with room
/// to spare.
pub const REVISION_ENVELOPE_BYTES: usize = 64;
/// The largest document, serialized: what fits in [`STORE_VALUE_BYTES`] once
/// the revision wrapper is around it. Each list and string has its own bound
/// too, but together (50 guides of 200 places) they could reach megabytes,
/// which the store would refuse as a failure rather than as the person's
/// mistake; this check refuses it first, with a reason.
pub const MAX_DOCUMENT_BYTES: usize = STORE_VALUE_BYTES - REVISION_ENVELOPE_BYTES;
const KEY: &str = "places";

/// A place, as a search answers it and the document keeps it.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Place {
    pub id: String,
    pub name: String,
    pub category: String,
    pub lat: f64,
    pub lon: f64,
    #[serde(default)]
    pub address: Vec<String>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        deserialize_with = "present_text"
    )]
    pub website: Option<String>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        deserialize_with = "present_text"
    )]
    pub phone: Option<String>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        deserialize_with = "present_text"
    )]
    pub wikipedia: Option<String>,
}

/// An optional text field that, when present, is text: the module leaves an
/// absent link or phone out and never writes `null`, so a `null` is not its
/// record.
fn present_text<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: ferrite_app::serde::Deserializer<'de>,
{
    <String as ferrite_app::serde::Deserialize>::deserialize(deserializer).map(Some)
}

/// A guide: a named list of places.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Guide {
    pub id: String,
    pub name: String,
    pub places: Vec<Place>,
}

/// What a person keeps.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Places {
    pub favorites: Vec<Place>,
    pub recents: Vec<Place>,
    pub guides: Vec<Guide>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Body {
    favorites: Vec<Place>,
    recents: Vec<Place>,
    guides: Vec<Guide>,
    /// The revision the page based this on, and the session it loaded it
    /// under (`document.rs`).
    rev: u64,
    #[serde(default)]
    session: Option<String>,
}

fn reply(places: Option<&Places>, rev: u64) -> serde_json::Value {
    serde_json::json!({
        "favorites": places.map(|p| &p.favorites),
        "recents": places.map(|p| &p.recents),
        "guides": places.map(|p| &p.guides),
        "rev": rev,
    })
}

/// The stored document checked as a PUT is: a stored document that breaks a
/// rule was not written by this module and is a fault, never answered.
fn checked(current: Option<&Places>) -> std::io::Result<()> {
    match current.map(validate) {
        Some(Err(why)) => Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            format!("the stored places could not be read: {why}"),
        )),
        _ => Ok(()),
    }
}

/// Answer `/api/maps/places`.
pub async fn handle(cx: &mut ApiCtx<'_>) -> Response {
    let session = cx.session;
    let outcome = match cx.request.method {
        "GET" => document::read::<Places>(&mut cx.storage.user(), KEY)
            .await
            .and_then(|current| {
                checked(current.doc.as_ref())?;
                Ok(document::for_session(
                    reply(current.doc.as_ref(), current.rev),
                    session,
                ))
            }),
        "PUT" => {
            let body = match cx.request.json::<Body>() {
                Ok(body) => body,
                Err(response) => return response,
            };
            let places = Places {
                favorites: body.favorites,
                recents: body.recents,
                guides: body.guides,
            };
            if let Err(message) = validate(&places) {
                return Response::error(400, &message);
            }
            if let Some(refused) = document::other_session(body.session.as_deref(), session) {
                return refused;
            }
            document::write(&mut cx.storage.user(), KEY, Some(body.rev), Some(&places))
                .await
                .and_then(|saved| {
                    if let document::Saved::Conflict(current) = &saved {
                        checked(current.doc.as_ref())?;
                    }
                    Ok(document::answer(saved, Some(&places), reply))
                })
        }
        "DELETE" => document::write::<Places>(&mut cx.storage.user(), KEY, None, None)
            .await
            .map(|saved| document::answer(saved, None, reply)),
        _ => return Response::method_not_allowed(),
    };
    outcome.unwrap_or_else(|error| Response::error(503, &format!("storage failed: {error}")))
}

fn plain_text(what: &str, text: &str, min: usize, max: usize) -> Result<(), String> {
    let count = text.chars().count();
    if !(min..=max).contains(&count) {
        return Err(format!("{what} has {min} to {max} characters"));
    }
    if text.chars().any(char::is_control) {
        return Err(format!("{what} cannot contain control characters"));
    }
    Ok(())
}

/// The authority of an `http(s)` URL (between `//` and the next `/`, `?` or
/// `#`) and whether the URL is plain: no backslash anywhere and no user
/// information (`@`) in the authority, either of which can make a browser
/// open a host other than the one the text appears to name.
fn authority(url: &str) -> Option<&str> {
    if url.contains('\\') {
        return None;
    }
    let rest = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))?;
    let end = rest.find(['/', '?', '#']).unwrap_or(rest.len());
    let authority = &rest[..end];
    (!authority.is_empty() && !authority.contains('@')).then_some(authority)
}

/// Whether `url` is an `https` Wikipedia article, by the parts of the URL:
/// the scheme is `https`; the authority (from `//` to the first `/`, `?` or
/// `#`) has no user information, a host that is `wikipedia.org` or ends in
/// `.wikipedia.org` (compared without case, letters, digits, `-` and `.`
/// only), and no port or port 443; and the path starts `/wiki/`. A backslash
/// anywhere refuses it, since a browser may read it as `/`.
pub fn wikipedia_article(url: &str) -> bool {
    if url.contains('\\') {
        return false;
    }
    let Some((scheme, rest)) = url.split_once("://") else {
        return false;
    };
    if !scheme.eq_ignore_ascii_case("https") {
        return false;
    }
    let end = rest.find(['/', '?', '#']).unwrap_or(rest.len());
    let (authority, path) = rest.split_at(end);
    if authority.contains('@') {
        return false;
    }
    let (host, port) = match authority.split_once(':') {
        Some((host, port)) => (host, Some(port)),
        None => (authority, None),
    };
    let host = host.to_ascii_lowercase();
    let plain = !host.is_empty()
        && host
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || matches!(b, b'-' | b'.'));
    plain
        && (host == "wikipedia.org" || host.ends_with(".wikipedia.org"))
        && matches!(port, None | Some("443"))
        && path.starts_with("/wiki/")
}

/// Whether `url` is a link this document accepts for a website.
pub fn is_link(url: &str) -> bool {
    link("a link", url, false).is_ok()
}

fn link(what: &str, url: &str, wikipedia: bool) -> Result<(), String> {
    plain_text(what, url, 1, MAX_LINK_CHARS)?;
    let ok = if wikipedia {
        wikipedia_article(url)
    } else {
        authority(url).is_some()
    };
    if !ok || url.chars().any(char::is_whitespace) {
        return Err(format!("{what} is not a link this card can open"));
    }
    Ok(())
}

/// Check one place.
pub fn validate_place(place: &Place) -> Result<(), String> {
    if !document::valid_key(&place.id) {
        return Err(format!(
            "place id {:?} is not a plain id of 1 to 128 characters",
            place.id
        ));
    }
    plain_text("a place's name", &place.name, 1, MAX_NAME_CHARS)?;
    plain_text("a place's category", &place.category, 0, MAX_CATEGORY_CHARS)?;
    if !super::valid_point(place.lat, place.lon) {
        return Err(format!("{} is not at a point on the globe", place.name));
    }
    if place.address.len() > MAX_ADDRESS_LINES {
        return Err(format!("an address has at most {MAX_ADDRESS_LINES} lines"));
    }
    for line in &place.address {
        plain_text("an address line", line, 1, MAX_LINE_CHARS)?;
    }
    if let Some(phone) = &place.phone {
        plain_text("a phone number", phone, 1, MAX_PHONE_CHARS)?;
    }
    if let Some(website) = &place.website {
        link("a website", website, false)?;
    }
    if let Some(wikipedia) = &place.wikipedia {
        link("a Wikipedia link", wikipedia, true)?;
    }
    Ok(())
}

fn list(what: &str, places: &[Place], max: usize) -> Result<(), String> {
    if places.len() > max {
        return Err(format!("{what} holds at most {max} places"));
    }
    let mut seen = BTreeSet::new();
    for place in places {
        validate_place(place)?;
        if !seen.insert(place.id.as_str()) {
            return Err(format!("{} is listed twice in {what}", place.name));
        }
    }
    Ok(())
}

/// Check a submitted document.
pub fn validate(places: &Places) -> Result<(), String> {
    list("Favorites", &places.favorites, MAX_FAVORITES)?;
    list("Recents", &places.recents, MAX_RECENTS)?;
    if places.guides.len() > MAX_GUIDES {
        return Err(format!("at most {MAX_GUIDES} guides"));
    }
    let mut ids = BTreeSet::new();
    for guide in &places.guides {
        if !document::valid_key(&guide.id) {
            return Err(format!("guide id {:?} is not a plain id", guide.id));
        }
        if !ids.insert(guide.id.as_str()) {
            return Err(format!("guide id {:?} is listed twice", guide.id));
        }
        plain_text("a guide's name", &guide.name, 1, MAX_GUIDE_NAME_CHARS)?;
        list(
            &format!("the guide {:?}", guide.name),
            &guide.places,
            MAX_GUIDE_PLACES,
        )?;
    }
    let bytes = serde_json::to_vec(places).map_or(usize::MAX, |bytes| bytes.len());
    if bytes > MAX_DOCUMENT_BYTES {
        return Err(format!(
            "Favorites, Recents and Guides are too large to save together: they take {bytes} bytes, and at most {MAX_DOCUMENT_BYTES} can be kept. Remove some places or guides."
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn place(id: &str) -> Place {
        Place {
            id: id.into(),
            name: "Golden Gate Bridge".into(),
            category: "Bridge".into(),
            lat: 37.818292,
            lon: -122.478384,
            address: vec!["San Francisco, California".into(), "United States".into()],
            website: Some("http://goldengatebridge.org/".into()),
            phone: None,
            wikipedia: Some("https://en.wikipedia.org/wiki/Golden_Gate_Bridge".into()),
        }
    }

    fn doc(favorites: Vec<Place>) -> Places {
        Places {
            favorites,
            recents: vec![place("osm-r1")],
            guides: vec![Guide {
                id: "guide-1".into(),
                name: "Bridges".into(),
                places: vec![place("osm-r1")],
            }],
        }
    }

    #[test]
    fn a_place_round_trips_without_its_missing_parts() {
        let text = r#"{"id":"pin-1","name":"Dropped Pin","category":"","lat":1.5,"lon":-2.5,"address":[]}"#;
        let parsed: Place = serde_json::from_str(text).unwrap();
        assert_eq!(serde_json::to_string(&parsed).unwrap(), text);
        assert!(validate_place(&parsed).is_ok());
        assert!(serde_json::from_str::<Place>(
            r#"{"id":"a","name":"A","category":"","lat":1,"lon":1,"rating":5}"#
        )
        .is_err());
        // The module never writes null for an absent link or phone: a null is not its record.
        for field in ["website", "phone", "wikipedia"] {
            let text =
                format!(r#"{{"id":"a","name":"A","category":"","lat":1,"lon":1,"{field}":null}}"#);
            assert!(serde_json::from_str::<Place>(&text).is_err(), "{field}");
        }
        let phoned: Place = serde_json::from_str(
            r#"{"id":"a","name":"A","category":"","lat":1,"lon":1,"phone":"+1 555"}"#,
        )
        .unwrap();
        assert_eq!(phoned.phone.as_deref(), Some("+1 555"));
    }

    #[test]
    fn a_stored_document_that_breaks_a_rule_is_a_fault_not_an_answer() {
        assert!(checked(None).is_ok(), "nothing stored yet");
        assert!(checked(Some(&doc(vec![place("osm-r1")]))).is_ok());
        let mut off = place("osm-r1");
        off.lat = 95.0;
        let error = checked(Some(&doc(vec![off]))).unwrap_err();
        assert_eq!(error.kind(), std::io::ErrorKind::InvalidData);
        assert!(error
            .to_string()
            .starts_with("the stored places could not be read"));
        let twice = doc(vec![place("osm-r1"), place("osm-r1")]);
        assert!(checked(Some(&twice)).is_err());
    }

    #[test]
    fn good_documents_pass_and_bad_ones_are_refused() {
        assert!(validate(&doc(vec![place("osm-r1"), place("osm-w2")])).is_ok());
        assert!(
            validate(&doc(vec![place("osm-r1"), place("osm-r1")])).is_err(),
            "twice"
        );
        let bad = |change: fn(&mut Place)| {
            let mut p = place("osm-r1");
            change(&mut p);
            validate(&doc(vec![p])).is_err()
        };
        assert!(bad(|p| p.id = "a/b".into()), "id");
        assert!(bad(|p| p.name = String::new()), "no name");
        assert!(
            bad(|p| p.name = "x".repeat(MAX_NAME_CHARS + 1)),
            "long name"
        );
        assert!(bad(|p| p.lat = 91.0), "off the globe");
        assert!(bad(|p| p.lon = f64::NAN), "not a number");
        assert!(
            bad(|p| p.address = vec!["a".into(); MAX_ADDRESS_LINES + 1]),
            "address"
        );
        assert!(bad(|p| p.address = vec![String::new()]), "empty line");
        assert!(
            bad(|p| p.website = Some("javascript:alert(1)".into())),
            "script link"
        );
        assert!(
            bad(|p| p.wikipedia = Some("https://evil.example/wiki/x".into())),
            "not wikipedia"
        );
        for disguised in [
            "https://evil.example\\@en.wikipedia.org/wiki/x",
            "https://evil.example@en.wikipedia.org/wiki/x",
            "https://en.wikipedia.org@evil.example/wiki/x",
            "https://en.wikipedia.org.evil.example/wiki/x",
            "https://en.wikipedia.org\\wiki\\x",
            "http://en.wikipedia.org/wiki/x",
            "https://en.wikipedia.org/w/index.php",
            "https://evil.example/#.wikipedia.org/wiki/x",
            "https://en.wikipedia.org:8443/wiki/x",
            "https://en.wikipedia.org:/wiki/x",
            "https://:443/wiki/x",
            "ftp://en.wikipedia.org/wiki/x",
        ] {
            assert!(!wikipedia_article(disguised), "{disguised}");
        }
        assert!(wikipedia_article(
            "https://en.wikipedia.org/wiki/Golden_Gate_Bridge"
        ));
        assert!(wikipedia_article("https://en.wikipedia.org:443/wiki/Paris"));
        assert!(wikipedia_article("https://wikipedia.org/wiki/Paris"));
        assert!(wikipedia_article("https://EN.Wikipedia.org/wiki/x"));
        assert!(
            bad(|p| p.website = Some("https://bank.example@evil.example/".into())),
            "a website with user information"
        );
        assert!(
            bad(|p| p.website = Some("https://evil.example\\@bank.example/".into())),
            "a website with a backslash"
        );
        assert!(
            bad(|p| p.phone = Some("1".repeat(MAX_PHONE_CHARS + 1))),
            "phone"
        );
        assert!(bad(|p| p.name = "a\u{0}b".into()), "control character");
        let many: Vec<Place> = (0..=MAX_FAVORITES)
            .map(|n| place(&format!("p{n}")))
            .collect();
        assert!(validate(&doc(many)).is_err(), "too many favorites");
        let mut recents = doc(vec![]);
        recents.recents = (0..=MAX_RECENTS).map(|n| place(&format!("p{n}"))).collect();
        assert!(validate(&recents).is_err(), "too many recents");
        let mut guides = doc(vec![]);
        guides.guides[0].name = String::new();
        assert!(validate(&guides).is_err(), "an unnamed guide");
        let mut twice = doc(vec![]);
        twice.guides.push(twice.guides[0].clone());
        assert!(validate(&twice).is_err(), "a guide twice");
        // Every list within its own bound, the whole over the document's.
        let mut large = doc(vec![]);
        large.guides = (0..10)
            .map(|g| Guide {
                id: format!("guide-{g}"),
                name: format!("Guide {g}"),
                places: (0..MAX_GUIDE_PLACES)
                    .map(|n| place(&format!("p{n}")))
                    .collect(),
            })
            .collect();
        let error = validate(&large).unwrap_err();
        assert!(error.contains(&MAX_DOCUMENT_BYTES.to_string()), "{error}");
    }

    /// A valid document of exactly `target` bytes serialized: guides of
    /// places to within a few hundred bytes, then one favorite whose name and
    /// address lines make up the rest.
    fn document_of(target: usize) -> Places {
        let len = |doc: &Places| serde_json::to_vec(doc).unwrap().len();
        let mut doc = Places {
            favorites: Vec::new(),
            recents: Vec::new(),
            guides: Vec::new(),
        };
        'fill: for g in 0..MAX_GUIDES {
            doc.guides.push(Guide {
                id: format!("guide-{g}"),
                name: format!("Guide {g}"),
                places: Vec::new(),
            });
            for n in 0..MAX_GUIDE_PLACES {
                let guide = doc.guides.last_mut().unwrap();
                guide.places.push(place(&format!("p{n}")));
                if len(&doc) + 600 > target {
                    doc.guides.last_mut().unwrap().places.pop();
                    break 'fill;
                }
            }
        }
        doc.favorites.push(Place {
            id: "pad".into(),
            name: "n".into(),
            category: String::new(),
            lat: 0.0,
            lon: 0.0,
            address: Vec::new(),
            website: None,
            phone: None,
            wikipedia: None,
        });
        // Each added character of the name or of a line adds one byte.
        let room = target - len(&doc);
        doc.favorites[0].name = "n".repeat(1 + room.min(MAX_NAME_CHARS - 1));
        // Lines leave five characters spare, for the last few bytes.
        let longest = MAX_LINE_CHARS - 5;
        loop {
            let rest = target - len(&doc);
            // A line costs its text and two quotes, and a comma after the first.
            let cost = if doc.favorites[0].address.is_empty() {
                2
            } else {
                3
            };
            if rest < cost + 1 {
                if rest > 0 {
                    doc.favorites[0].address[0].push_str(&"a".repeat(rest));
                }
                break;
            }
            doc.favorites[0]
                .address
                .push("a".repeat((rest - cost).min(longest)));
        }
        doc
    }

    #[test]
    fn a_document_that_passes_fits_in_one_stored_value_with_its_revision() {
        // The revision wrapper `document.rs` writes, at its longest revision.
        let wrapper = serde_json::to_vec(&serde_json::json!({ "rev": u64::MAX, "doc": null }))
            .unwrap()
            .len()
            - "null".len();
        assert!(wrapper <= REVISION_ENVELOPE_BYTES, "{wrapper}");
        assert!(MAX_DOCUMENT_BYTES + wrapper <= STORE_VALUE_BYTES);

        // At the limit it is kept; one byte more is refused with a reason.
        let at_limit = document_of(MAX_DOCUMENT_BYTES);
        assert_eq!(
            serde_json::to_vec(&at_limit).unwrap().len(),
            MAX_DOCUMENT_BYTES
        );
        assert_eq!(validate(&at_limit), Ok(()));
        let over = document_of(MAX_DOCUMENT_BYTES + 1);
        let error = validate(&over).unwrap_err();
        assert!(error.contains("too large to save"), "{error}");

        // The most guides, each with the most places: every list is within
        // its own bound, and the whole is refused before it reaches the store.
        let mut full = doc(vec![]);
        full.guides = (0..MAX_GUIDES)
            .map(|g| Guide {
                id: format!("guide-{g}"),
                name: format!("Guide {g}"),
                places: (0..MAX_GUIDE_PLACES)
                    .map(|n| place(&format!("p{n}")))
                    .collect(),
            })
            .collect();
        let error = validate(&full).unwrap_err();
        assert!(error.contains(&MAX_DOCUMENT_BYTES.to_string()), "{error}");
    }
}

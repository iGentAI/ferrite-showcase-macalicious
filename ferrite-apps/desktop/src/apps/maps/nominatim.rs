//! Nominatim's `jsonv2` answers as the module's places.
//!
//! A search answers an array of results and a reverse geocode one result (or
//! `{"error": "Unable to geocode"}` where nothing is found). Each becomes a [`Place`]: its
//! OpenStreetMap element as the id (`osm-n<id>`, `osm-w<id>`, `osm-r<id>`),
//! its name (or the first part of its display name), a category from its
//! class and type, the address lines a card shows, and the website, phone
//! and Wikipedia article its tags name. Text is clipped to what the places
//! document accepts (`places.rs`), so a place found can be kept as it is.

use ferrite_app::serde_json;
use serde_json::{Map, Value};

use super::super::fetch::strict::{self, Strict};
use super::places::{
    self, Place, MAX_ADDRESS_LINES, MAX_CATEGORY_CHARS, MAX_LINE_CHARS, MAX_NAME_CHARS,
};
use super::valid_point;

/// The places of an answer, at most `limit`, read strictly
/// ([`super::super::fetch::strict`]): a list of results, one result (a reverse
/// geocode), or the reverse geocoder's documented answer for no place at the
/// point, `{"error": "Unable to geocode"}`. Any other error answer, and any
/// result not in Nominatim's `jsonv2` shape, fails the whole answer.
pub fn places(body: &[u8], limit: usize) -> Strict<Vec<Place>> {
    let answer = strict::json(body)?;
    let items: Vec<&Value> = match &answer {
        Value::Array(items) => items.iter().collect(),
        Value::Object(_) if nothing_found(body) => Vec::new(),
        Value::Object(object) if object.contains_key("error") => {
            let why = match object.get("error") {
                Some(Value::String(text)) => clip(text, 200),
                Some(other) => clip(&other.to_string(), 200),
                None => String::new(),
            };
            return strict::fail(format!("the search service answered an error: {why}"));
        }
        Value::Object(_) => vec![&answer],
        _ => return strict::fail("the answer is neither a result nor a list of them"),
    };
    let mut found: Vec<Place> = Vec::new();
    for (at, item) in items.into_iter().enumerate() {
        let place = place(item)
            .map_err(|strict::Mismatch(why)| strict::Mismatch(format!("results[{at}]: {why}")))?;
        if found.len() < limit && !found.iter().any(|other| other.id == place.id) {
            found.push(place);
        }
    }
    Ok(found)
}

/// The text field `key` of `object`, trimmed, when it is there and not empty;
/// present, it must be text.
fn text<'a>(object: Option<&'a Map<String, Value>>, key: &str) -> Strict<Option<&'a str>> {
    let Some(object) = object else {
        return Ok(None);
    };
    Ok(strict::optional_text(object, key)?
        .map(str::trim)
        .filter(|text| !text.is_empty()))
}

/// Whether `body` is the reverse geocoder's documented answer for no place at
/// the point: exactly `{"error": "Unable to geocode"}` (sent with HTTP 200
/// or 404, depending on its version). Any other error is a failure of the
/// service, never an empty result.
pub fn nothing_found(body: &[u8]) -> bool {
    let Ok(Value::Object(answer)) = serde_json::from_slice::<Value>(body) else {
        return false;
    };
    answer.len() == 1 && answer.get("error").and_then(Value::as_str) == Some("Unable to geocode")
}

/// `text` without control characters, at most `max` characters.
pub fn clip(text: &str, max: usize) -> String {
    text.chars()
        .filter(|c| !c.is_control())
        .take(max)
        .collect::<String>()
        .trim()
        .to_string()
}

/// A number to six decimals, about a tenth of a metre.
fn round6(value: f64) -> f64 {
    (value * 1e6).round() / 1e6
}

/// One result as a place, read strictly: an object with `lat` and `lon` (text
/// or numbers) on the globe, a `place_id` number, a `display_name` text, and,
/// where present, `osm_type` (`node`, `way` or `relation`), `osm_id`
/// (number), `name`, `category`
/// and `type` (text), an `address` object of texts. `extratags` is read for
/// the website, phone and Wikipedia article only: Nominatim answers `null`
/// for a place with no tags, so anything else it holds is not looked at. The
/// place answered always passes the places document's own check
/// ([`places::validate_place`]), so a place found can be kept as it is: a tag
/// that is not a link that check accepts is not offered as a link.
pub fn place(item: &Value) -> Strict<Place> {
    let item = strict::object(item, "a result")?;
    let number = |key: &str| -> Strict<f64> {
        let value = strict::field(item, key)?;
        value
            .as_str()
            .and_then(|text| text.trim().parse::<f64>().ok())
            .or_else(|| value.as_f64())
            .ok_or_else(|| strict::Mismatch(format!("`{key}` is not a number")))
    };
    let (lat, lon) = (number("lat")?, number("lon")?);
    if !valid_point(lat, lon) {
        return strict::fail("the result is not at a point on the globe");
    }
    let place_id = strict::field(item, "place_id")?
        .as_u64()
        .ok_or_else(|| strict::Mismatch("`place_id` is not a number".into()))?;
    let osm_id = match strict::optional(item, "osm_id") {
        None => None,
        Some(value) => Some(
            value
                .as_u64()
                .ok_or_else(|| strict::Mismatch("`osm_id` is not a number".into()))?,
        ),
    };
    let element = match strict::optional_text(item, "osm_type")? {
        None => None,
        Some("node") => Some('n'),
        Some("way") => Some('w'),
        Some("relation") => Some('r'),
        Some(other) => {
            return strict::fail(format!(
                "`osm_type` {other:?} is not an OpenStreetMap element"
            ))
        }
    };
    let id = match (element, osm_id) {
        (Some(kind), Some(number)) => format!("osm-{kind}{number}"),
        _ => format!("place-{place_id}"),
    };
    let display = strict::text(item, "display_name")?;
    let name = text(Some(item), "name")?
        .or_else(|| {
            display
                .split(',')
                .next()
                .map(str::trim)
                .filter(|part| !part.is_empty())
        })
        .map(|name| clip(name, MAX_NAME_CHARS))
        .filter(|name| !name.is_empty())
        .ok_or_else(|| strict::Mismatch("the result has no name".into()))?;
    let category = category(text(Some(item), "category")?, text(Some(item), "type")?);
    let address_fields = strict::optional_object(item, "address")?;
    for (key, value) in address_fields.into_iter().flatten() {
        if !value.is_string() {
            return strict::fail(format!("`address.{key}` is not text"));
        }
    }
    let tag = |key: &str| {
        item.get("extratags")?
            .get(key)?
            .as_str()
            .map(str::trim)
            .filter(|text| !text.is_empty())
    };
    let address = address(address_fields, display, &name);
    let mut website = None;
    for key in ["website", "contact:website", "url"] {
        if let Some(tag) = tag(key) {
            website = website.or_else(|| self::website(tag));
        }
    }
    let mut phone = None;
    for key in ["phone", "contact:phone"] {
        if let Some(tag) = tag(key) {
            let first = clip(tag.split(';').next().unwrap_or(tag), 64);
            phone = phone.or_else(|| (!first.is_empty()).then_some(first));
        }
    }
    let wikipedia = tag("wikipedia").and_then(self::wikipedia);
    let place = Place {
        id,
        name,
        category,
        lat: round6(lat),
        lon: round6(lon),
        address,
        website,
        phone,
        wikipedia,
    };
    places::validate_place(&place).map_err(strict::Mismatch)?;
    Ok(place)
}

/// What kind of place it is: its type in words (`bus_stop` is "Bus Stop"),
/// or its class where the type says only `yes`.
pub fn category(class: Option<&str>, kind: Option<&str>) -> String {
    let word = match kind {
        Some(kind) if kind != "yes" => kind,
        _ => class.unwrap_or("place"),
    };
    let words: Vec<String> = word
        .split(['_', ' ', ':'])
        .filter(|part| !part.is_empty())
        .map(|part| {
            let mut chars = part.chars();
            match chars.next() {
                Some(first) => first.to_uppercase().chain(chars).collect(),
                None => String::new(),
            }
        })
        .collect();
    let category = clip(&words.join(" "), MAX_CATEGORY_CHARS);
    if category.is_empty() {
        "Place".into()
    } else {
        category
    }
}

/// The lines a card shows: the street with its number, the town with its
/// region and postcode, the country. A line equal to the name is left out.
/// Without an address, the parts of the display name after the name. The
/// address's fields are texts ([`place`] checks them first).
pub fn address(address: Option<&Map<String, Value>>, display: &str, name: &str) -> Vec<String> {
    let first = |keys: &[&str]| {
        keys.iter()
            .find_map(|key| text(address, key).ok().flatten())
    };
    let join = |parts: &[Option<&str>], separator: &str| {
        parts
            .iter()
            .flatten()
            .copied()
            .collect::<Vec<_>>()
            .join(separator)
    };
    let street = join(
        &[
            first(&["house_number"]),
            first(&[
                "road",
                "pedestrian",
                "footway",
                "path",
                "cycleway",
                "square",
                "place",
            ]),
        ],
        " ",
    );
    let region = join(
        &[
            first(&["state", "province", "region"]),
            first(&["postcode"]),
        ],
        " ",
    );
    let town = join(
        &[
            first(&[
                "city",
                "town",
                "village",
                "hamlet",
                "suburb",
                "municipality",
            ]),
            Some(region.as_str()).filter(|region| !region.is_empty()),
        ],
        ", ",
    );
    let country = first(&["country"]).unwrap_or("").to_string();
    let mut lines: Vec<String> = [street, town, country]
        .iter()
        .map(|line| clip(line, MAX_LINE_CHARS))
        .filter(|line| !line.is_empty() && line != name)
        .collect();
    if lines.is_empty() {
        lines = display
            .split(',')
            .map(|part| clip(part, MAX_LINE_CHARS))
            .filter(|part| !part.is_empty() && part != name)
            .take(4)
            .collect();
    }
    lines.truncate(MAX_ADDRESS_LINES);
    lines
}

/// A website tag as a link: `http://` or `https://`, or a bare `www.` name
/// given `https://`, and only one the places document accepts as a link
/// ([`places::is_link`]: no user information, no backslash). A tag that is
/// not such a link (`javascript:`, text) is not offered as one.
pub fn website(tag: &str) -> Option<String> {
    let tag = tag.split(';').next()?.trim();
    let url = if tag.starts_with("https://") || tag.starts_with("http://") {
        tag.to_string()
    } else if tag.starts_with("www.") {
        format!("https://{tag}")
    } else {
        return None;
    };
    let plain = !url.chars().any(char::is_whitespace);
    (plain && places::is_link(&url)).then_some(url)
}

/// A `wikipedia` tag (`en:Golden Gate Bridge`) as the article's address.
pub fn wikipedia(tag: &str) -> Option<String> {
    let (language, title) = tag.split_once(':')?;
    let language = language.trim();
    let title = title.trim();
    let plain_language = (2..=12).contains(&language.len())
        && language
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b == b'-');
    if !plain_language || title.is_empty() || title.chars().count() > 300 {
        return None;
    }
    let url = format!(
        "https://{language}.wikipedia.org/wiki/{}",
        super::encode(&title.replace(' ', "_"))
    );
    (url.len() <= super::places::MAX_LINK_CHARS).then_some(url)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Nominatim's answer for "Golden Gate Bridge", cut down.
    const BRIDGE: &str = r#"[{"place_id":428205572,"osm_type":"relation","osm_id":21407754,
        "lat":"37.8182923","lon":"-122.4783842","category":"man_made","type":"bridge",
        "name":"Golden Gate Bridge",
        "display_name":"Golden Gate Bridge, Golden Gate, San Francisco, Marin County, California, 24129, United States",
        "address":{"man_made":"Golden Gate Bridge","road":"Golden Gate","city":"San Francisco",
                   "county":"Marin County","state":"California","postcode":"24129","country":"United States"},
        "extratags":{"website":"http://goldengatebridge.org/","wikipedia":"en:Golden Gate Bridge"}},
      {"place_id":427587291,"osm_type":"way","osm_id":1557712987,"lat":"37.8309114","lon":"-122.4799471",
        "category":"bridge","type":"yes","name":"Golden Gate Bridge",
        "display_name":"Golden Gate Bridge, Marin County, California, 24129, United States",
        "address":{"road":"Golden Gate Bridge","county":"Marin County","state":"California","postcode":"24129","country":"United States"},
        "extratags":{"website":"javascript:alert(1)","phone":"+1 415 555 0100;+1 415 555 0101"}}]"#;

    #[test]
    fn a_search_answer_becomes_places_with_cards() {
        let found = places(BRIDGE.as_bytes(), 8).unwrap();
        assert_eq!(found.len(), 2);
        let bridge = &found[0];
        assert_eq!(bridge.id, "osm-r21407754");
        assert_eq!(bridge.name, "Golden Gate Bridge");
        assert_eq!(bridge.category, "Bridge");
        assert_eq!((bridge.lat, bridge.lon), (37.818292, -122.478384));
        assert_eq!(
            bridge.address,
            [
                "Golden Gate",
                "San Francisco, California 24129",
                "United States"
            ]
        );
        assert_eq!(
            bridge.website.as_deref(),
            Some("http://goldengatebridge.org/")
        );
        assert_eq!(
            bridge.wikipedia.as_deref(),
            Some("https://en.wikipedia.org/wiki/Golden_Gate_Bridge")
        );
        let way = &found[1];
        assert_eq!(way.id, "osm-w1557712987");
        assert_eq!(
            way.category, "Bridge",
            "the class where the type is only yes"
        );
        assert_eq!(way.website, None, "a javascript: link is dropped");
        assert_eq!(way.phone.as_deref(), Some("+1 415 555 0100"));
        assert_eq!(
            way.address,
            ["California 24129", "United States"],
            "a road named like the place is not repeated"
        );
        assert_eq!(
            places(BRIDGE.as_bytes(), 1).unwrap().len(),
            1,
            "the limit holds"
        );
    }

    #[test]
    fn a_reverse_answer_is_one_place_or_none() {
        let one = r#"{"place_id":7,"osm_type":"node","osm_id":42,"lat":"1.5","lon":"2.5",
            "category":"amenity","type":"cafe","name":"","display_name":"12, Some Street, Town, Country",
            "address":{"house_number":"12","road":"Some Street","town":"Town","country":"Country"}}"#;
        let found = places(one.as_bytes(), 8).unwrap();
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].id, "osm-n42");
        assert_eq!(found[0].name, "12", "the first part of the display name");
        assert_eq!(found[0].category, "Cafe");
        assert_eq!(found[0].address, ["12 Some Street", "Town", "Country"]);
        assert_eq!(
            places(br#"{"error":"Unable to geocode"}"#, 8).unwrap(),
            Vec::<Place>::new()
        );
        assert!(places(b"<html>", 8).is_err());
        assert!(places(b"42", 8).is_err());
        assert!(nothing_found(br#"{"error":"Unable to geocode"}"#));
        assert!(!nothing_found(b"<html>Not Found</html>"));
        assert!(!nothing_found(br#"{"error":{"code":404}}"#));
        // A service failure is never "nothing found": it fails the answer.
        for failure in [
            br#"{"error":"Internal Server Error"}"#.as_slice(),
            br#"{"error":"Unable to geocode","code":500}"#,
            br#"{"error":{"code":503,"message":"busy"}}"#,
        ] {
            assert!(!nothing_found(failure));
            assert!(
                places(failure, 8)
                    .unwrap_err()
                    .0
                    .starts_with("the search service answered an error"),
                "{}",
                String::from_utf8_lossy(failure)
            );
        }
    }

    #[test]
    fn one_result_not_in_nominatims_shape_fails_the_whole_answer() {
        let good = r#"{"place_id":4,"lat":"1","lon":"1","name":"D","display_name":"D, Town"}"#;
        let found = places(format!("[{good},{good}]").as_bytes(), 8).unwrap();
        assert_eq!(found.len(), 1, "one place per id");
        assert_eq!(found[0].id, "place-4");
        assert_eq!(found[0].category, "Place");
        for bad in [
            r#"{"place_id":1,"lat":"x","lon":"0","name":"A","display_name":"A"}"#,
            r#"{"place_id":2,"lat":"95","lon":"0","name":"B","display_name":"B"}"#,
            r#"{"place_id":3,"lat":"1","lon":"1","name":"","display_name":""}"#,
            r#"{"lat":"1","lon":"1","name":"E","display_name":"E"}"#,
            r#"{"place_id":5,"lat":"1","lon":"1","name":7,"display_name":"F"}"#,
            r#"{"place_id":6,"lat":"1","lon":"1","display_name":"G","address":{"road":3}}"#,
            r#"{"place_id":9,"osm_type":"nonsense","osm_id":3,"lat":"1","lon":"1","display_name":"J"}"#,
            r#"{"place_id":10,"osm_type":"N","osm_id":3,"lat":"1","lon":"1","display_name":"K"}"#,
            r#"{"place_id":11,"lat":"1","lon":"1","name":null,"display_name":"L"}"#,
        ] {
            assert!(
                places(format!("[{good},{bad}]").as_bytes(), 8).is_err(),
                "{bad} fails the answer"
            );
        }
        let tagged = r#"[{"place_id":8,"lat":"1","lon":"1","display_name":"I",
            "extratags":{"website":"https://bank.example@evil.example/"}}]"#;
        assert_eq!(
            places(tagged.as_bytes(), 8).unwrap()[0].website,
            None,
            "a website tag the places document would refuse is not offered as a link"
        );
    }

    #[test]
    fn a_real_reply_whose_extratags_is_null_is_a_place() {
        // nominatim.openstreetmap.org/reverse for 48.858890,2.320041, as it answered.
        let reply = r#"{"place_id":98089431,"licence":"Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright","osm_type":"node","osm_id":1204772553,"lat":"48.8588785","lon":"2.3201019","category":"place","type":"house","place_rank":30,"importance":9.317235065227768e-05,"addresstype":"place","name":"","display_name":"3, Rue Casimir Périer, Quartier des Invalides, Paris 7e Arrondissement, Paris, Île-de-France, France métropolitaine, 75007, France","address":{"house_number":"3","road":"Rue Casimir Périer","quarter":"Quartier des Invalides","suburb":"Paris 7e Arrondissement","city":"Paris","municipality":"Paris","county":"Paris","ISO3166-2-lvl6":"FR-75C","state":"Île-de-France","ISO3166-2-lvl4":"FR-IDF","region":"France métropolitaine","postcode":"75007","country":"France","country_code":"fr"},"extratags":null,"namedetails":null,"boundingbox":["48.8588285","48.8589285","2.3200519","2.3201519"]}"#;
        let found = places(reply.as_bytes(), 8).unwrap();
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].id, "osm-n1204772553");
        assert_eq!(found[0].name, "3");
        assert_eq!(found[0].category, "House");
        assert_eq!(
            found[0].address,
            [
                "3 Rue Casimir Périer",
                "Paris, Île-de-France 75007",
                "France"
            ]
        );
        assert_eq!(found[0].website, None);
        assert_eq!(found[0].phone, None);
        assert_eq!(found[0].wikipedia, None);
    }

    #[test]
    fn tags_not_needed_or_not_in_shape_are_passed_over() {
        for tags in [
            "null",
            "[]",
            "3",
            r#"{"website":7,"phone":["x"],"wikipedia":null,"population":114394}"#,
        ] {
            let item = format!(
                r#"[{{"place_id":7,"lat":"1","lon":"1","display_name":"H, Town","extratags":{tags}}}]"#
            );
            let found = places(item.as_bytes(), 8).unwrap();
            assert_eq!(found[0].name, "H", "{tags}");
            assert_eq!(found[0].website, None, "{tags}");
            assert_eq!(found[0].phone, None, "{tags}");
        }
    }

    #[test]
    fn tags_become_safe_links() {
        assert_eq!(
            website("www.example.org").as_deref(),
            Some("https://www.example.org")
        );
        assert_eq!(website("https://a.example/x y"), None);
        assert_eq!(website("ftp://a.example/"), None);
        assert_eq!(
            wikipedia("de:Kölner Dom").as_deref(),
            Some("https://de.wikipedia.org/wiki/K%C3%B6lner_Dom")
        );
        assert_eq!(wikipedia("Golden Gate"), None);
        assert_eq!(wikipedia("EN:x"), None);
        assert_eq!(category(Some("highway"), Some("bus_stop")), "Bus Stop");
        assert_eq!(clip("a\u{7}b  ", 10), "ab");
    }
}

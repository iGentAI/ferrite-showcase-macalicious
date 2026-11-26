//! Music's Radio: internet stations from the free Radio Browser directory
//! (<https://www.radio-browser.info>), asked through the application's declared
//! egress (`ferrite.json`, handle [`EGRESS`]).
//!
//! Only the directory's small JSON answer passes through Ferrite. A station's
//! sound never does: the browser plays it straight from the station's own
//! address, which must be https, as the desktop's page is.

use ferrite_app::serde_json::{self, json, Value};

use super::archive::encode;

/// The egress handle `ferrite.json` declares for the directory.
pub const EGRESS: &str = "radio";
/// The directory's station search, which is also a declared destination. This
/// name answers from each of the directory's servers in turn.
pub const SEARCH: &str = "https://all.api.radio-browser.info/json/stations/search";
/// Stations on one page.
pub const ROWS: u32 = 30;
/// The last page a search may ask for.
pub const MAX_PAGE: u32 = 20;
/// The longest search, in characters.
pub const MAX_QUERY_CHARS: usize = 100;
/// The genres the window offers, as the directory's tags.
pub const GENRES: &[&str] = &["pop", "rock", "jazz", "classical", "dance", "news"];
/// The longest station name or country, in characters, as a song's text must be.
const MAX_TEXT: usize = 200;
/// The longest address, in bytes, as a stream song's must be.
const MAX_URL_BYTES: usize = 2000;

/// The search URL: most listened first, only stations the directory last found
/// working, in MP3, which every browser plays, at an https address.
pub fn search_url(name: &str, genre: Option<&str>, page: u32) -> String {
    let mut url = format!(
        "{SEARCH}?codec=MP3&is_https=true&hidebroken=true&order=clickcount&reverse=true\
         &limit={ROWS}&offset={}",
        (page - 1) * ROWS
    );
    if !name.is_empty() {
        url.push_str(&format!("&name={}", encode(name)));
    }
    if let Some(genre) = genre {
        url.push_str(&format!("&tag={genre}&tagExact=true"));
    }
    url
}

/// `value` as one line of at most [`MAX_TEXT`] characters, control characters
/// taken out.
fn line(value: Option<&Value>) -> String {
    value
        .and_then(Value::as_str)
        .unwrap_or("")
        .chars()
        .filter(|c| !c.is_control())
        .take(MAX_TEXT)
        .collect::<String>()
        .trim()
        .to_string()
}

/// The address to keep for a station: the one the directory resolved, or else
/// the one listed, if it is an https address a stream song may hold.
fn address(station: &Value) -> Option<String> {
    let usable = |url: &&str| {
        url.starts_with("https://")
            && url.len() <= MAX_URL_BYTES
            && url.bytes().all(|b| b.is_ascii_graphic())
    };
    ["url_resolved", "url"]
        .iter()
        .filter_map(|field| station.get(*field)?.as_str())
        .find(|url| usable(url))
        .map(str::to_string)
}

/// One station as the window reads it, or `None` when the entry cannot be played
/// or named.
fn station(entry: &Value) -> Option<Value> {
    let id = entry.get("stationuuid")?.as_str()?;
    if id.is_empty() || !id.bytes().all(|b| b.is_ascii_hexdigit() || b == b'-') {
        return None;
    }
    let name = line(entry.get("name"));
    if name.is_empty() {
        return None;
    }
    let tags: Vec<&str> = entry
        .get("tags")
        .and_then(Value::as_str)
        .unwrap_or("")
        .split(',')
        .map(str::trim)
        .filter(|tag| !tag.is_empty() && tag.chars().all(|c| !c.is_control()))
        .take(3)
        .collect();
    Some(json!({
        "id": id,
        "name": name,
        "url": address(entry)?,
        "country": line(entry.get("country")),
        "genre": tags.first().map(|tag| line(Some(&Value::from(*tag)))).unwrap_or_default(),
        "bitrate": entry.get("bitrate").and_then(Value::as_u64).unwrap_or(0),
    }))
}

/// The directory's answer as `{ "stations": [...] }`, or `None` when it is not a
/// list. An entry that cannot be played is left out; the list says nothing of it.
pub fn stations(body: &[u8]) -> Option<Value> {
    let entries: Vec<Value> = serde_json::from_slice(body).ok()?;
    let full = entries.len() == ROWS as usize;
    let stations: Vec<Value> = entries.iter().filter_map(station).collect();
    Some(json!({ "stations": stations, "more": full }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_search_asks_for_working_mp3_at_https_addresses() {
        assert_eq!(
            search_url("", None, 1),
            "https://all.api.radio-browser.info/json/stations/search?codec=MP3&is_https=true\
             &hidebroken=true&order=clickcount&reverse=true&limit=30&offset=0"
        );
        let asked = search_url("groove salad", Some("jazz"), 3);
        assert!(asked.contains("&offset=60"), "{asked}");
        assert!(
            asked.contains("&name=groove%20salad") || asked.contains("&name=groove+salad"),
            "{asked}"
        );
        assert!(asked.ends_with("&tag=jazz&tagExact=true"), "{asked}");
    }

    #[test]
    fn a_station_keeps_its_resolved_address_and_first_tag() {
        let body = br#"[{"stationuuid":"83dcfac4-b3c3-4731-afc1-a80dd271dffa",
            "name":" Radio Armisa \n","url":"http://onair.armisa.it/radio",
            "url_resolved":"https://onair.armisa.it/listen/armisa/radio.mp3",
            "tags":"anni 80, dance,folk,pop","country":"Italy","bitrate":128}]"#;
        assert_eq!(
            stations(body).unwrap(),
            json!({
                "stations": [{
                    "id": "83dcfac4-b3c3-4731-afc1-a80dd271dffa",
                    "name": "Radio Armisa",
                    "url": "https://onair.armisa.it/listen/armisa/radio.mp3",
                    "country": "Italy",
                    "genre": "anni 80",
                    "bitrate": 128,
                }],
                "more": false,
            })
        );
    }

    #[test]
    fn an_entry_that_cannot_be_played_or_named_is_left_out() {
        let body = br#"[
            {"stationuuid":"aa","name":"Plain http","url":"http://a.example/s","url_resolved":"http://a.example/s"},
            {"stationuuid":"bb","name":"","url":"https://b.example/s"},
            {"stationuuid":"not an id","name":"Bad id","url":"https://c.example/s"},
            {"stationuuid":"dd","name":"Space","url":"https://d.example/a b"},
            {"stationuuid":"ee","name":"Good","url_resolved":"","url":"https://e.example/s"}
        ]"#;
        let answer = stations(body).unwrap();
        let list = answer["stations"].as_array().unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0]["name"], "Good");
        assert_eq!(list[0]["url"], "https://e.example/s");
        assert_eq!(stations(b"{}"), None);
    }

    #[test]
    fn a_full_page_says_more_may_follow() {
        let entries: Vec<Value> = (0..ROWS)
            .map(|n| json!({ "stationuuid": "aa", "name": format!("S{n}"), "url": "https://a.example/" }))
            .collect();
        let answer = stations(&serde_json::to_vec(&entries).unwrap()).unwrap();
        assert_eq!(answer["more"], true);
    }
}

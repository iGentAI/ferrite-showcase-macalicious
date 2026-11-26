//! Music's Internet Archive browser: openly licensed music, found through the
//! Archive's public search and item metadata APIs over the application's
//! declared egress (`ferrite.json`, handle [`EGRESS`]).
//!
//! Only the small JSON answers pass through Ferrite: a search page of at most
//! [`ROWS`] items, and one item's metadata. Egress refuses a body over 1 MiB,
//! so an item whose metadata is larger is answered 502 with that reason. The
//! audio itself never passes through the application: the browser plays it
//! from `https://archive.org/download/<item>/<file>`, which answers range
//! requests, so seeking in an Archive track is the browser's own.
//!
//! Every search is limited to items whose `licenseurl` is a Creative Commons
//! licence or public-domain mark (both are on `creativecommons.org`), and an
//! item's tracks are answered only when its own metadata says so again
//! ([`open_license`]). No item without such a licence is listed or offered.

use std::collections::BTreeMap;

use ferrite_app::serde_json::{self, Value};

/// The egress handle `ferrite.json` declares for the Internet Archive; Music
/// is the only module that uses it.
pub const EGRESS: &str = "archive";
/// The search API, which is also a declared destination.
pub const SEARCH: &str = "https://archive.org/advancedsearch.php";
/// The item metadata API, which is also a declared destination.
pub const METADATA: &str = "https://archive.org/metadata/";
/// Results on one page of a search.
pub const ROWS: u32 = 24;
/// The last page a search may ask for.
pub const MAX_PAGE: u32 = 40;
/// The longest search, in characters.
pub const MAX_QUERY_CHARS: usize = 100;
/// The most tracks an item lists.
pub const MAX_TRACKS: usize = 200;
/// The longest item identifier, in bytes.
pub const MAX_IDENTIFIER_BYTES: usize = 100;
/// The longest file name inside an item, in bytes.
pub const MAX_FILE_BYTES: usize = 300;

/// Whether `id` may be an Archive item identifier: 1 to
/// [`MAX_IDENTIFIER_BYTES`] ASCII letters, digits, `.`, `-` or `_`, not
/// starting with `.`.
pub fn valid_identifier(id: &str) -> bool {
    (1..=MAX_IDENTIFIER_BYTES).contains(&id.len())
        && !id.starts_with('.')
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'-' | b'_'))
}

/// Whether `name` may be a file of an item: 1 to [`MAX_FILE_BYTES`] bytes, no
/// control character or backslash, no empty, `.` or `..` path segment.
pub fn valid_file(name: &str) -> bool {
    (1..=MAX_FILE_BYTES).contains(&name.len())
        && !name.chars().any(|c| c.is_control() || c == '\\')
        && name
            .split('/')
            .all(|segment| !segment.is_empty() && segment != "." && segment != "..")
}

/// Whether a licence URL names an open licence: a Creative Commons licence
/// of a known family, with a version (`/licenses/by-nc-nd/4.0/`, optionally
/// a jurisdiction after it), or the CC0 dedication or Public Domain Mark.
pub fn open_license(url: &str) -> bool {
    const FAMILIES: &[&str] = &[
        "by",
        "by-sa",
        "by-nd",
        "by-nc",
        "by-nc-sa",
        "by-nc-nd",
        "by-nd-nc",
        "sampling",
        "sampling+",
        "nc-sampling+",
    ];
    // The jurisdictions Creative Commons ported its licences to before 4.0.
    const JURISDICTIONS: &[&str] = &[
        "am", "ar", "at", "au", "az", "be", "bg", "br", "ca", "ch", "cl", "cn", "co", "cr", "cz",
        "de", "dk", "ec", "ee", "eg", "es", "eu", "fi", "fr", "ge", "gr", "gt", "hk", "hr", "hu",
        "ie", "igo", "il", "in", "it", "jo", "jp", "kr", "lu", "mk", "mt", "mx", "my", "nl", "no",
        "nz", "pe", "ph", "pl", "pr", "pt", "ro", "rs", "scotland", "se", "sg", "si", "th", "tw",
        "ug", "uk", "us", "ve", "vn", "za",
    ];
    let url = url.trim().to_ascii_lowercase();
    let rest = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))
        .unwrap_or("");
    let rest = rest.strip_prefix("www.").unwrap_or(rest);
    let Some(path) = rest.strip_prefix("creativecommons.org/") else {
        return false;
    };
    let parts: Vec<&str> = path.split('/').filter(|part| !part.is_empty()).collect();
    // The versions Creative Commons has published: 1.0, 2.0, 2.5, 3.0 and 4.0
    // (the sampling licences only 1.0), each but 4.0 also ported to
    // jurisdictions, named by a short code such as `us` or `de`.
    match parts.as_slice() {
        ["licenses", family, version, rest @ ..] => {
            let known = if family.contains("sampling") {
                *version == "1.0"
            } else {
                matches!(*version, "1.0" | "2.0" | "2.5" | "3.0" | "4.0")
            };
            FAMILIES.contains(family)
                && known
                && match rest {
                    [] => true,
                    [code] => *version != "4.0" && JURISDICTIONS.contains(code),
                    _ => false,
                }
        }
        ["publicdomain", "zero" | "mark", "1.0"] => true,
        _ => false,
    }
}

/// Percent-encode `text` for a query string (unreserved characters stay).
pub fn encode(text: &str) -> String {
    let mut out = String::with_capacity(text.len() * 3);
    for byte in text.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~') {
            out.push(byte as char);
        } else {
            out.push_str(&format!("%{byte:02X}"));
        }
    }
    out
}

/// The words of a search, cleaned for the Archive's query language: letters
/// and digits only (any script), each quoted when the query is built, so no
/// operator or field of the person's can widen the licence filter. `Err`
/// when it is too long.
pub fn words(query: &str) -> Result<Vec<String>, String> {
    if query.chars().count() > MAX_QUERY_CHARS {
        return Err(format!("a search has at most {MAX_QUERY_CHARS} characters"));
    }
    Ok(query
        .split(|c: char| !c.is_alphanumeric())
        .filter(|word| !word.is_empty())
        .map(str::to_string)
        .take(12)
        .collect())
}

/// The licence of an item's `licenseurl`: the URL itself, or, when the item
/// lists several, the first of them that is an open licence ([`open_license`]).
/// `None` when none is.
pub fn open_license_of(value: Option<&Value>) -> Option<String> {
    let candidates: Vec<&str> = match value? {
        Value::String(url) => vec![url.as_str()],
        Value::Array(urls) => urls.iter().filter_map(Value::as_str).collect(),
        _ => Vec::new(),
    };
    candidates
        .into_iter()
        .map(str::trim)
        .find(|url| open_license(url))
        .map(str::to_string)
}

/// The search URL for `words` (none: the most downloaded netlabel releases)
/// and `page` (from 1).
pub fn search_url(words: &[String], page: u32) -> String {
    let filter = "mediatype:audio AND licenseurl:*creativecommons.org*";
    let query = if words.is_empty() {
        format!("collection:netlabels AND {filter}")
    } else {
        // Quoted, so a word such as OR or AND is searched for, not obeyed.
        let quoted: Vec<String> = words.iter().map(|word| format!("\"{word}\"")).collect();
        format!("({}) AND {filter}", quoted.join(" AND "))
    };
    let fields = ["identifier", "title", "creator", "year", "licenseurl"]
        .iter()
        .map(|field| format!("&fl%5B%5D={field}"))
        .collect::<String>();
    format!(
        "{SEARCH}?q={}{fields}&sort%5B%5D=downloads+desc&rows={ROWS}&page={page}&output=json",
        encode(&query)
    )
}

/// A field the Archive answers as a string or a list of strings, as one
/// string (the list joined with ", "): control characters become spaces,
/// trimmed, at most 200 characters, as a song's text must be.
fn text(value: Option<&Value>) -> Option<String> {
    let joined = match value? {
        Value::String(s) => s.clone(),
        Value::Array(items) => items
            .iter()
            .filter_map(Value::as_str)
            .collect::<Vec<_>>()
            .join(", "),
        Value::Number(n) => n.to_string(),
        _ => return None,
    };
    let plain: String = joined
        .chars()
        .map(|c| if c.is_control() { ' ' } else { c })
        .collect();
    let trimmed: String = plain.trim().chars().take(200).collect();
    let trimmed = trimmed.trim_end().to_string();
    (!trimmed.is_empty()).then_some(trimmed)
}

/// A year from a field such as `2014`, `"2014"` or `"2014-02-10T00:00:00Z"`.
fn year(value: Option<&Value>) -> Option<u32> {
    let text = text(value)?;
    let digits: String = text.chars().take(4).collect();
    digits
        .parse()
        .ok()
        .filter(|year| (1000..=9999).contains(year))
}

/// The page of results of a search answer: `{"results": [...], "total"}`,
/// each result `{"identifier", "title", "creator", "year", "license"}`.
/// Results without an identifier or an open licence are left out. `None`
/// when the body is not the search API's JSON.
pub fn search_results(body: &[u8]) -> Option<Value> {
    let answer: Value = serde_json::from_slice(body).ok()?;
    let response = answer.get("response")?;
    let total = response.get("numFound")?.as_u64()?;
    let docs = response.get("docs")?.as_array()?;
    let results: Vec<Value> = docs
        .iter()
        .filter_map(|doc| {
            let identifier = doc.get("identifier")?.as_str()?;
            let license = open_license_of(doc.get("licenseurl"))?;
            if !valid_identifier(identifier) {
                return None;
            }
            Some(serde_json::json!({
                "identifier": identifier,
                "title": text(doc.get("title")).unwrap_or_else(|| identifier.to_string()),
                "creator": text(doc.get("creator")),
                "year": year(doc.get("year")),
                "license": license,
            }))
        })
        .collect();
    Some(serde_json::json!({ "results": results, "total": total }))
}

/// The formats a track can be played in, by the file format names the
/// Archive uses: `mp3`, `ogg` or `flac`.
fn format_kind(format: &str) -> Option<&'static str> {
    let format = format.to_ascii_lowercase();
    if format.contains("mp3") {
        Some("mp3")
    } else if format.contains("ogg vorbis") {
        Some("ogg")
    } else if format.contains("flac") {
        Some("flac")
    } else {
        None
    }
}

/// A length the Archive writes as seconds (`"121.73"`) or as `mm:ss` or
/// `hh:mm:ss` (`"02:01"`), in seconds.
pub fn length(text: &str) -> Option<f64> {
    let text = text.trim();
    let seconds = if text.contains(':') {
        text.split(':').try_fold(0.0f64, |total, part| {
            part.parse::<f64>().ok().map(|n| total * 60.0 + n)
        })?
    } else {
        text.parse::<f64>().ok()?
    };
    (seconds.is_finite() && seconds > 0.0 && seconds <= 86_400.0).then_some(seconds)
}

/// Whether a file format of the Archive is audio an uploader may give as a
/// track's original, whether or not a browser plays it.
fn audio_format(format: &str) -> bool {
    let format = format.to_ascii_lowercase();
    format_kind(&format).is_some()
        || [
            "wav",
            "aiff",
            "apple lossless",
            "aac",
            "m4a",
            "opus",
            "shorten",
        ]
        .iter()
        .any(|kind| format.contains(kind))
}

/// A file's name without its last extension.
fn stem(name: &str) -> &str {
    match name.rfind('.') {
        Some(dot) if dot > name.rfind('/').map_or(0, |slash| slash + 1) => &name[..dot],
        _ => name,
    }
}

/// A title from a file's stem (its name without the extension): the last
/// path segment with `_` as spaces.
fn title_from_stem(stem: &str) -> String {
    let last = stem.rsplit('/').next().unwrap_or(stem);
    last.replace('_', " ").trim().to_string()
}

/// A file entry's name and format, when its name may be a file of an item.
fn named(file: &Value) -> Option<(&str, &str)> {
    let name = file.get("name").and_then(Value::as_str)?;
    let format = file.get("format").and_then(Value::as_str)?;
    valid_file(name).then_some((name, format))
}

/// What `GET /api/music/archive/item/<identifier>` answers, from the metadata
/// API's body: `{"identifier", "title", "creator", "year", "license",
/// "tracks": [{"id", "title", "artist", "album", "track", "duration",
/// "files": {"mp3" | "ogg" | "flac": name}}]}`. A track is an original audio
/// file, in any format, with the derivatives the Archive made of it (named by
/// their `original` field, or of the same stem); its files are what the
/// browser may play, and a track with none is left out. `Err` names why the
/// item is not offered: not found, not audio, or not openly licensed.
pub fn item(identifier: &str, body: &[u8]) -> Result<Value, (u16, String)> {
    let answer: Value = serde_json::from_slice(body).map_err(|_| {
        (
            502,
            "the Internet Archive's answer is not metadata JSON".to_string(),
        )
    })?;
    let Some(metadata) = answer.get("metadata").filter(|m| m.is_object()) else {
        return Err((
            404,
            format!("the Internet Archive has no item {identifier:?}"),
        ));
    };
    if text(metadata.get("mediatype")).as_deref() != Some("audio") {
        return Err((404, format!("{identifier:?} is not an audio item")));
    }
    let Some(license) = open_license_of(metadata.get("licenseurl")) else {
        return Err((
            403,
            format!(
                "{identifier:?} is not under a Creative Commons licence or in the public domain"
            ),
        ));
    };
    if !open_license(&license) {
        return Err((
            403,
            format!(
                "{identifier:?} is not under a Creative Commons licence or in the public domain"
            ),
        ));
    }
    let creator = text(metadata.get("creator"));
    let title = text(metadata.get("title")).unwrap_or_else(|| identifier.to_string());
    let files = answer
        .get("files")
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or(&[]);

    // Every original audio file, by name: its facts and each playable format.
    struct Track<'a> {
        original: &'a Value,
        files: BTreeMap<&'static str, String>,
        length: Option<f64>,
    }
    let mut tracks: BTreeMap<&str, Track> = BTreeMap::new();
    for file in files {
        let Some((name, format)) = named(file) else {
            continue;
        };
        if file.get("source").and_then(Value::as_str) != Some("original") || !audio_format(format) {
            continue;
        }
        let mut playable = BTreeMap::new();
        if let Some(kind) = format_kind(format) {
            playable.insert(kind, name.to_string());
        }
        tracks.insert(
            name,
            Track {
                original: file,
                files: playable,
                length: file.get("length").and_then(Value::as_str).and_then(length),
            },
        );
    }
    // The derivatives: of the original they name, else of the original with
    // the same stem. A derivative with neither is a file no uploader gave.
    let by_stem: BTreeMap<&str, &str> = tracks.keys().map(|name| (stem(name), *name)).collect();
    for file in files {
        let Some((name, format)) = named(file) else {
            continue;
        };
        let Some(kind) = format_kind(format) else {
            continue;
        };
        if file.get("source").and_then(Value::as_str) == Some("original") {
            continue;
        }
        let owner = file
            .get("original")
            .and_then(Value::as_str)
            .filter(|original| tracks.contains_key(original))
            .or_else(|| by_stem.get(stem(name)).copied());
        let Some(track) = owner.and_then(|owner| tracks.get_mut(owner)) else {
            continue;
        };
        track.files.entry(kind).or_insert_with(|| name.to_string());
        if track.length.is_none() {
            track.length = file.get("length").and_then(Value::as_str).and_then(length);
        }
    }
    let mut listed: Vec<(Option<u32>, String, Value)> = tracks
        .into_iter()
        .filter(|(_, track)| !track.files.is_empty())
        .map(|(name, track)| {
            let stem_name = stem(name).to_string();
            let original = track.original;
            // A track number a song may keep (1 to 9999), or none.
            let number = text(original.get("track")).and_then(|t| {
                t.split('/')
                    .next()
                    .and_then(|n| n.trim().parse::<u32>().ok())
                    .filter(|n| (1..=9999).contains(n))
            });
            let files: serde_json::Map<String, Value> = track
                .files
                .into_iter()
                .map(|(kind, name)| (kind.to_string(), Value::String(name)))
                .collect();
            // Through the same cleaning as the Archive's own text: a file name may be
            // longer than a song's title may be.
            let as_text = |text_value: String| text(Some(&Value::String(text_value)));
            let fallback = as_text(title_from_stem(&stem_name))
                .or_else(|| as_text(name.to_string()))
                .unwrap_or_else(|| "Untitled".to_string());
            // The id is the whole original file name: two originals of one stem
            // (Song.mp3 and Song.flac) are two tracks.
            let value = serde_json::json!({
                "id": name,
                "title": text(original.get("title")).unwrap_or(fallback),
                "artist": text(original.get("creator")).or_else(|| creator.clone()),
                "album": text(original.get("album")).unwrap_or_else(|| title.clone()),
                "track": number,
                "duration": track.length,
                "files": files,
            });
            (number, name.to_string(), value)
        })
        .collect();
    listed.sort_by(|a, b| match (a.0, b.0) {
        (Some(x), Some(y)) => x.cmp(&y).then_with(|| a.1.cmp(&b.1)),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => a.1.cmp(&b.1),
    });
    listed.truncate(MAX_TRACKS);
    Ok(serde_json::json!({
        "identifier": identifier,
        "title": title,
        "creator": creator,
        "year": year(metadata.get("year")).or_else(|| year(metadata.get("date"))),
        "license": license,
        "tracks": listed.into_iter().map(|(_, _, value)| value).collect::<Vec<_>>(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identifiers_and_file_names_are_plain() {
        assert!(valid_identifier("DWK255"));
        assert!(valid_identifier("gd1977-05-08.sbd.hicks.4982"));
        assert!(!valid_identifier(""));
        assert!(!valid_identifier(".hidden"));
        assert!(!valid_identifier("a/b"));
        assert!(!valid_identifier("a b"));
        assert!(!valid_identifier(&"a".repeat(MAX_IDENTIFIER_BYTES + 1)));
        assert!(valid_file("Subjectjazz_-_01_-_NSIME.mp3"));
        assert!(valid_file("Disc 1/01 Ünïcode.ogg"));
        for bad in [
            "",
            "/abs.mp3",
            "a/../b.mp3",
            "./a.mp3",
            "a//b.mp3",
            "a\\b.mp3",
            "a\nb",
        ] {
            assert!(!valid_file(bad), "{bad:?}");
        }
    }

    #[test]
    fn only_creative_commons_and_public_domain_count_as_open() {
        assert!(open_license(
            "http://creativecommons.org/licenses/by-nc-nd/3.0/"
        ));
        assert!(open_license(
            "https://creativecommons.org/publicdomain/zero/1.0/"
        ));
        assert!(open_license(
            "https://www.creativecommons.org/publicdomain/mark/1.0/"
        ));
        assert!(!open_license(""));
        assert!(!open_license(
            "https://example.com/creativecommons.org/licenses/"
        ));
        assert!(!open_license("http://www.etree.org/legal.php"));
    }

    #[test]
    fn an_item_listing_several_licences_counts_as_open_when_one_of_them_is() {
        let listed = serde_json::json!([
            "http://example.com/all-rights",
            "https://creativecommons.org/licenses/by-sa/4.0/"
        ]);
        assert_eq!(
            open_license_of(Some(&listed)).as_deref(),
            Some("https://creativecommons.org/licenses/by-sa/4.0/")
        );
        assert_eq!(
            open_license_of(Some(&serde_json::json!(["http://example.com/closed"]))),
            None
        );
        assert_eq!(open_license_of(None), None);
        let body = br#"{"responseHeader":{"status":0},"response":{"numFound":1,"start":0,"docs":[
            {"identifier":"two","title":"Two","licenseurl":["http://example.com/x",
             "http://creativecommons.org/licenses/by/3.0/"]}]}}"#;
        let page = search_results(body).unwrap();
        assert_eq!(
            page["results"][0]["license"],
            "http://creativecommons.org/licenses/by/3.0/"
        );
        let item_body = br#"{"metadata":{"mediatype":"audio","title":"Two",
            "licenseurl":["https://creativecommons.org/licenses/by/4.0/","http://example.com/x"]},
            "files":[{"name":"A.mp3","format":"VBR MP3","source":"original"}]}"#;
        let item = item("two", item_body).unwrap();
        assert_eq!(
            item["license"],
            "https://creativecommons.org/licenses/by/4.0/"
        );
    }

    #[test]
    fn a_search_keeps_the_licence_filter_whatever_is_typed() {
        let typed = words("jazz OR licenseurl:* (x) -café").unwrap();
        assert_eq!(typed, ["jazz", "OR", "licenseurl", "x", "café"]);
        let url = search_url(&typed, 2);
        assert!(url.starts_with(SEARCH), "{url}");
        assert!(url.contains("page=2") && url.contains("rows=24") && url.contains("output=json"));
        assert!(url.contains(&encode(
            "(\"jazz\" AND \"OR\" AND \"licenseurl\" AND \"x\" AND \"café\") AND mediatype:audio AND licenseurl:*creativecommons.org*"
        )));
        assert!(search_url(&[], 1).contains(&encode("collection:netlabels AND mediatype:audio")));
        assert!(words(&"a".repeat(MAX_QUERY_CHARS + 1)).is_err());
        assert_eq!(encode("a b/é"), "a%20b%2F%C3%A9");
    }

    #[test]
    fn search_results_keep_only_openly_licensed_items() {
        let body = br#"{"responseHeader":{"status":0},"response":{"numFound":2,"start":0,"docs":[
            {"identifier":"DWK255","title":"Saturne (EP)","creator":"Subjectjazz","year":"2014",
             "licenseurl":"http://creativecommons.org/licenses/by-nc-nd/4.0/"},
            {"identifier":"closed","title":"Closed","licenseurl":"http://example.com/all-rights"},
            {"identifier":"bad id","licenseurl":"http://creativecommons.org/licenses/by/4.0/"}]}}"#;
        let page = search_results(body).unwrap();
        assert_eq!(page["total"], 2);
        assert_eq!(
            page["results"],
            serde_json::json!([{ "identifier": "DWK255", "title": "Saturne (EP)",
                "creator": "Subjectjazz", "year": 2014,
                "license": "http://creativecommons.org/licenses/by-nc-nd/4.0/" }])
        );
        assert!(search_results(b"<html>").is_none());
    }

    #[test]
    fn lengths_are_read_in_both_of_the_archives_forms() {
        assert_eq!(length("02:01"), Some(121.0));
        assert_eq!(length("1:02:03"), Some(3723.0));
        assert_eq!(length("121.73"), Some(121.73));
        assert_eq!(length(""), None);
        assert_eq!(length("x"), None);
        assert_eq!(length("0"), None);
    }

    const ITEM: &[u8] = br#"{"metadata":{"identifier":"DWK255","mediatype":"audio","title":"Saturne (EP)",
        "creator":"Subjectjazz","licenseurl":"http://creativecommons.org/licenses/by-nc-nd/4.0/","year":"2014"},
        "files":[
        {"name":"DWK255_meta.xml","format":"Metadata","source":"metadata"},
        {"name":"Subjectjazz_-_02_-_Connexion.mp3","format":"VBR MP3","source":"original","title":"Connexion","track":"02","length":"02:20","creator":"Subjectjazz","album":"Saturne (EP)"},
        {"name":"Subjectjazz_-_02_-_Connexion.ogg","format":"Ogg Vorbis","source":"derivative","length":"140.83"},
        {"name":"Subjectjazz_-_01_-_NSIME.ogg","format":"Ogg Vorbis","source":"derivative","length":"121.73"},
        {"name":"Subjectjazz_-_01_-_NSIME.mp3","format":"VBR MP3","source":"original","title":"NSIME","track":"1/8","length":"02:01"},
        {"name":"orphan.ogg","format":"Ogg Vorbis","source":"derivative"},
        {"name":"Bonus_Track.flac","format":"Flac","source":"original"},
        {"name":"Subjectjazz_-_Saturne.zip","format":"ZIP","source":"original"}]}"#;

    #[test]
    fn an_item_lists_its_tracks_in_order_with_every_playable_format() {
        let item = item("DWK255", ITEM).unwrap();
        assert_eq!(item["title"], "Saturne (EP)");
        assert_eq!(item["year"], 2014);
        let tracks = item["tracks"].as_array().unwrap();
        assert_eq!(
            tracks.len(),
            3,
            "the orphan derivative and the zip are no tracks"
        );
        assert_eq!(tracks[0]["title"], "NSIME");
        assert_eq!(tracks[0]["track"], 1);
        assert_eq!(tracks[0]["artist"], "Subjectjazz", "the item's creator");
        assert_eq!(tracks[0]["duration"], 121.0);
        assert_eq!(
            tracks[0]["files"],
            serde_json::json!({ "mp3": "Subjectjazz_-_01_-_NSIME.mp3", "ogg": "Subjectjazz_-_01_-_NSIME.ogg" })
        );
        assert_eq!(tracks[1]["title"], "Connexion");
        assert_eq!(
            tracks[2]["title"], "Bonus Track",
            "named from its file, after the numbered"
        );
        assert_eq!(tracks[2]["album"], "Saturne (EP)");
        assert_eq!(tracks[2]["duration"], Value::Null);
    }

    #[test]
    fn an_item_that_is_not_open_audio_is_refused() {
        let closed = String::from_utf8_lossy(ITEM).replace(
            "http://creativecommons.org/licenses/by-nc-nd/4.0/",
            "http://example.com/rights",
        );
        assert_eq!(item("DWK255", closed.as_bytes()).unwrap_err().0, 403);
        let video = String::from_utf8_lossy(ITEM).replace("\"audio\"", "\"movies\"");
        assert_eq!(item("DWK255", video.as_bytes()).unwrap_err().0, 404);
        assert_eq!(item("nope", b"{}").unwrap_err().0, 404);
        assert_eq!(item("nope", b"<html>").unwrap_err().0, 502);
    }

    #[test]
    fn a_title_from_a_long_file_name_is_one_a_song_may_keep() {
        let long = format!("{}.mp3", "a".repeat(250));
        let body = format!(
            r#"{{"metadata":{{"mediatype":"audio","title":"T",
            "licenseurl":"https://creativecommons.org/licenses/by/4.0/"}},"files":[
            {{"name":"{long}","format":"VBR MP3","source":"original"}}]}}"#
        );
        let item = item("long", body.as_bytes()).unwrap();
        let title = item["tracks"][0]["title"].as_str().unwrap();
        assert_eq!(title.chars().count(), 200);
    }

    #[test]
    fn only_real_licences_count_and_the_archives_text_is_made_keepable() {
        assert!(open_license(
            "http://creativecommons.org/licenses/by-sa/3.0/us/"
        ));
        assert!(!open_license(
            "https://creativecommons.org/licenses/not-a-license"
        ));
        assert!(!open_license("https://creativecommons.org/licenses/by/"));
        assert!(!open_license(
            "https://creativecommons.org/licenses/by/9999/"
        ));
        assert!(!open_license(
            "https://creativecommons.org/licenses/by/4.../"
        ));
        assert!(!open_license(
            "https://creativecommons.org/licenses/by/4.0/us/"
        ));
        assert!(!open_license(
            "https://creativecommons.org/licenses/by/3.0/not-real/"
        ));
        assert!(!open_license(
            "https://creativecommons.org/publicdomain/whatever/1.0/"
        ));
        let body = br#"{"metadata":{"mediatype":"audio","title":"Two\u0007Takes",
            "licenseurl":"https://creativecommons.org/publicdomain/zero/1.0/"},"files":[
            {"name":"Song.mp3","format":"VBR MP3","source":"original","track":"0","title":"Line\nBreak"},
            {"name":"Song.flac","format":"Flac","source":"original","track":"12345"}]}"#;
        let item = item("two", body).unwrap();
        assert_eq!(item["title"], "Two Takes");
        let tracks = item["tracks"].as_array().unwrap();
        let ids: Vec<&str> = tracks.iter().map(|t| t["id"].as_str().unwrap()).collect();
        assert_eq!(
            ids,
            ["Song.flac", "Song.mp3"],
            "one track per original, by file name"
        );
        assert!(
            tracks.iter().all(|t| t["track"].is_null()),
            "0 and 12345 are no track numbers"
        );
        assert!(tracks.iter().any(|t| t["title"] == "Line Break"));
    }

    #[test]
    fn an_original_in_any_audio_format_keeps_its_playable_derivatives() {
        let body = br#"{"metadata":{"mediatype":"audio","title":"Live Set",
            "licenseurl":"https://creativecommons.org/licenses/by/4.0/"},"files":[
            {"name":"set/Side.A.wav","format":"WAVE","source":"original","length":"300.5"},
            {"name":"set/Side.A.mp3","format":"VBR MP3","source":"derivative","original":"set/Side.A.wav","length":"300.4"},
            {"name":"renamed.ogg","format":"Ogg Vorbis","source":"derivative","original":"set/Side.A.wav"},
            {"name":"Artist.Track.aiff","format":"AIFF","source":"original"}]}"#;
        let item = item("set", body).unwrap();
        let tracks = item["tracks"].as_array().unwrap();
        assert_eq!(tracks.len(), 1, "the AIFF has nothing a browser plays");
        assert_eq!(
            tracks[0]["title"], "Side.A",
            "named from its stem, keeping its dots"
        );
        assert_eq!(tracks[0]["duration"], 300.5, "the original's length");
        assert_eq!(
            tracks[0]["files"],
            serde_json::json!({ "mp3": "set/Side.A.mp3", "ogg": "renamed.ogg" })
        );
    }
}

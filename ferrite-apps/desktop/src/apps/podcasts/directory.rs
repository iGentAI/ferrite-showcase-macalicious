//! Apple's podcast directory, read through the `podcasts` egress handle:
//! the keyless search and lookup (`itunes.apple.com/search`, `/lookup`),
//! whose results carry each show's feed, and the top chart
//! (`itunes.apple.com/us/rss/toppodcasts`), whose entries do not.
//!
//! Every show is answered with whether this desktop can follow it
//! ([`super::hosts::followable`]) and, when it cannot, why.

use ferrite_app::serde;
use ferrite_app::serde_json::{self, Value};

use super::hosts;
use crate::apps::news::feed;

/// The most shows a search or a lookup answers.
pub const MAX_RESULTS: usize = 50;
/// The longest title, publisher or genre kept, in characters.
const TEXT_CHARS: usize = 200;
/// The longest picture address kept, in bytes.
const ART_BYTES: usize = 1024;

/// A show as Apple's search or lookup lists it.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq)]
#[serde(crate = "ferrite_app::serde", rename_all = "camelCase")]
pub struct Listing {
    /// Apple's `collectionId`, in decimal.
    pub id: String,
    pub title: String,
    pub author: String,
    /// The 600-point cover, loaded by the browser straight from Apple.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub artwork: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub genre: Option<String>,
    /// The feed: the address this desktop reads when the show is followable,
    /// else the one Apple lists.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub feed: Option<String>,
    /// Whether the feed is on one of [`hosts::FEED_HOSTS`].
    pub followable: bool,
    /// Why the show cannot be followed here.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    /// How many episodes Apple counts.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub episodes: Option<u32>,
}

/// A show of the top chart: no feed, which a lookup of its id gives.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq)]
#[serde(crate = "ferrite_app::serde", rename_all = "camelCase")]
pub struct Charted {
    pub id: String,
    pub title: String,
    pub author: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub artwork: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub genre: Option<String>,
}

fn json(body: &[u8]) -> Result<Value, String> {
    serde_json::from_slice(body).map_err(|_| "Apple's reply is not JSON".to_string())
}

/// Trimmed, plain, clipped text of a string field, when it has any.
fn text(value: Option<&Value>) -> Option<String> {
    let raw = value?.as_str()?.trim();
    let plain = feed::html_to_text(raw).replace("\n\n", " ");
    (!plain.is_empty()).then(|| feed::clip(&plain, TEXT_CHARS))
}

fn picture(url: Option<&str>) -> Option<String> {
    url.and_then(feed::web_url).filter(|u| u.len() <= ART_BYTES)
}

/// A show id: Apple's decimal `collectionId`.
pub fn valid_id(id: &str) -> bool {
    (1..=20).contains(&id.len()) && id.bytes().all(|b| b.is_ascii_digit())
}

/// The shows of a search or lookup reply (`{"results": [...]}`), at most
/// [`MAX_RESULTS`]; entries that are not podcasts are skipped.
pub fn listings(body: &[u8]) -> Result<Vec<Listing>, String> {
    let value = json(body)?;
    let results = value
        .get("results")
        .and_then(Value::as_array)
        .ok_or_else(|| "Apple's reply lists no results".to_string())?;
    Ok(results
        .iter()
        .filter_map(listing)
        .take(MAX_RESULTS)
        .collect())
}

fn listing(result: &Value) -> Option<Listing> {
    if result
        .get("kind")
        .and_then(Value::as_str)
        .is_some_and(|kind| kind != "podcast")
    {
        return None;
    }
    let id = result.get("collectionId")?.as_u64()?.to_string();
    let title = text(result.get("collectionName"))?;
    let artwork = ["artworkUrl600", "artworkUrl100", "artworkUrl60"]
        .iter()
        .find_map(|name| picture(result.get(*name).and_then(Value::as_str)));
    let listed = result.get("feedUrl").and_then(Value::as_str);
    let (feed, reason) = match hosts::followable(listed) {
        Ok(url) => (Some(url), None),
        Err(reason) => (
            listed
                .and_then(feed::web_url)
                .filter(|u| u.len() <= hosts::MAX_FEED_URL),
            Some(reason),
        ),
    };
    Some(Listing {
        id,
        title,
        author: text(result.get("artistName")).unwrap_or_default(),
        artwork,
        genre: text(result.get("primaryGenreName")),
        followable: reason.is_none(),
        feed,
        reason,
        episodes: result
            .get("trackCount")
            .and_then(Value::as_u64)
            .map(|n| u32::try_from(n).unwrap_or(u32::MAX)),
    })
}

/// The shows of the top chart, in their order. Apple's chart answers a lone
/// entry as an object rather than a list; both are read. A reply of any other
/// shape, or one with no show that can be read, is an error, so a usable chart
/// kept from before is never replaced by an empty one.
pub fn chart(body: &[u8]) -> Result<Vec<Charted>, String> {
    let value = json(body)?;
    let unexpected = || "Apple's chart is not in the expected form".to_string();
    let feed = value
        .get("feed")
        .filter(|feed| feed.is_object())
        .ok_or_else(unexpected)?;
    let entries: Vec<&Value> = match feed.get("entry") {
        Some(Value::Array(list)) => list.iter().collect(),
        Some(one @ Value::Object(_)) => vec![one],
        _ => return Err(unexpected()),
    };
    let label = |entry: &Value, name: &str| text(entry.get(name).and_then(|v| v.get("label")));
    let shows: Vec<Charted> = entries
        .into_iter()
        .filter_map(|entry| {
            let id = entry
                .pointer("/id/attributes/im:id")?
                .as_str()
                .filter(|id| valid_id(id))?
                .to_string();
            let artwork = entry
                .get("im:image")
                .and_then(Value::as_array)
                .and_then(|images| images.last())
                .and_then(|image| image.get("label"))
                .and_then(Value::as_str)
                .and_then(|url| picture(Some(url)))
                .map(|url| larger_cover(&url));
            Some(Charted {
                id,
                title: label(entry, "im:name")?,
                author: label(entry, "im:artist").unwrap_or_default(),
                artwork,
                genre: text(entry.pointer("/category/attributes/label")),
            })
        })
        .take(MAX_RESULTS)
        .collect();
    if shows.is_empty() {
        return Err("Apple's chart lists no show that can be read".into());
    }
    Ok(shows)
}

/// The 600-point rendition of an Apple cover named by its size
/// (`.../170x170bb.png`), as search results give; other addresses as they are.
pub fn larger_cover(url: &str) -> String {
    let Some((base, last)) = url.rsplit_once('/') else {
        return url.to_string();
    };
    let host = url.split('/').nth(2).unwrap_or("");
    let sized = last.split_once("bb.").is_some_and(|(size, ext)| {
        matches!(ext, "png" | "jpg" | "jpeg" | "webp")
            && size.split_once('x').is_some_and(|(w, h)| {
                !w.is_empty()
                    && !h.is_empty()
                    && (w.to_string() + h).bytes().all(|b| b.is_ascii_digit())
            })
    });
    if host.ends_with(".mzstatic.com") && sized {
        format!("{base}/600x600bb.jpg")
    } else {
        url.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Two results in the shape of a real search reply (trimmed), and one
    /// that is not a podcast.
    const SEARCH: &str = r#"{"resultCount":3,"results":[
      {"wrapperType":"track","kind":"podcast","collectionId":1200361736,"artistName":"The New York Times",
       "collectionName":"The Daily","feedUrl":"https://feeds.simplecast.com/Sl5CSM3S",
       "artworkUrl100":"https://is1-ssl.mzstatic.com/image/thumb/a.jpg/100x100bb.jpg",
       "artworkUrl600":"https://is1-ssl.mzstatic.com/image/thumb/a.jpg/600x600bb.jpg",
       "trackCount":2669,"primaryGenreName":"Daily News"},
      {"wrapperType":"track","kind":"podcast","collectionId":1234,"artistName":"A &amp; B",
       "collectionName":"Elsewhere","feedUrl":"https://feeds.example.org/elsewhere.xml","primaryGenreName":"Arts"},
      {"wrapperType":"track","kind":"song","collectionId":99,"collectionName":"Not a show"},
      {"wrapperType":"track","kind":"podcast","collectionId":77,"collectionName":"No Feed"}
    ]}"#;

    #[test]
    fn search_results_say_which_shows_can_be_followed_and_why_not() {
        let shows = listings(SEARCH.as_bytes()).unwrap();
        assert_eq!(shows.len(), 3, "the song is skipped");
        let daily = &shows[0];
        assert_eq!(daily.id, "1200361736");
        assert_eq!(daily.title, "The Daily");
        assert_eq!(daily.author, "The New York Times");
        assert_eq!(
            daily.feed.as_deref(),
            Some("https://feeds.simplecast.com/Sl5CSM3S")
        );
        assert!(daily.followable && daily.reason.is_none());
        assert!(daily.artwork.as_deref().unwrap().ends_with("600x600bb.jpg"));
        assert_eq!(daily.episodes, Some(2669));
        assert_eq!(daily.genre.as_deref(), Some("Daily News"));

        let elsewhere = &shows[1];
        assert!(!elsewhere.followable);
        assert!(elsewhere
            .reason
            .as_deref()
            .unwrap()
            .contains("feeds.example.org"));
        assert_eq!(elsewhere.author, "A & B");
        assert_eq!(
            elsewhere.feed.as_deref(),
            Some("https://feeds.example.org/elsewhere.xml")
        );

        let none = &shows[2];
        assert!(!none.followable && none.feed.is_none());
        assert_eq!(
            none.reason.as_deref(),
            Some("Apple lists no public feed for this show.")
        );

        assert!(listings(b"<html>").is_err());
        assert!(listings(b"{\"errorMessage\":\"x\"}").is_err());
    }

    #[test]
    fn the_chart_reads_ids_names_and_a_larger_cover() {
        let chart_json = r#"{"feed":{"entry":[
          {"im:name":{"label":"The Daily"},"im:artist":{"label":"The New York Times"},
           "im:image":[{"label":"https://is1-ssl.mzstatic.com/image/thumb/x.jpg/55x55bb.png"},
                       {"label":"https://is1-ssl.mzstatic.com/image/thumb/x.jpg/170x170bb.png"}],
           "id":{"label":"https://podcasts.apple.com/us/podcast/the-daily/id1200361736?uo=2","attributes":{"im:id":"1200361736"}},
           "category":{"attributes":{"im:id":"1526","label":"Daily News"}}},
          {"im:name":{"label":"Bad id"},"id":{"attributes":{"im:id":"12a"}}}
        ]}}"#;
        let shows = chart(chart_json.as_bytes()).unwrap();
        assert_eq!(shows.len(), 1);
        assert_eq!(shows[0].id, "1200361736");
        assert_eq!(shows[0].genre.as_deref(), Some("Daily News"));
        assert_eq!(
            shows[0].artwork.as_deref(),
            Some("https://is1-ssl.mzstatic.com/image/thumb/x.jpg/600x600bb.jpg")
        );

        // One entry comes as an object.
        let lone =
            r#"{"feed":{"entry":{"im:name":{"label":"Solo"},"id":{"attributes":{"im:id":"5"}}}}}"#;
        assert_eq!(chart(lone.as_bytes()).unwrap()[0].title, "Solo");
        // Anything else is refused, so `top` keeps the chart it has rather than an empty one.
        for broken in [
            r#"{"x":1}"#,
            r#"{"feed":null}"#,
            r#"{"feed":[]}"#,
            r#"{"feed":{}}"#,
            r#"{"feed":{"entry":42}}"#,
            r#"{"feed":{"entry":null}}"#,
            r#"{"feed":{"entry":[]}}"#,
            r#"{"feed":{"entry":[{"im:name":{"label":"No id"}}]}}"#,
        ] {
            assert!(chart(broken.as_bytes()).is_err(), "{broken}");
        }
        assert_eq!(
            larger_cover("https://example.com/a/170x170bb.png"),
            "https://example.com/a/170x170bb.png",
            "only Apple's covers are renamed"
        );
    }

    #[test]
    fn show_ids_are_decimal() {
        assert!(valid_id("1200361736"));
        assert!(!valid_id(""));
        assert!(!valid_id("12a"));
        assert!(!valid_id(&"1".repeat(21)));
    }
}

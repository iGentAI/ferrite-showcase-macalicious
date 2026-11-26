//! A show's episodes, as read from its feed and kept for everyone in the
//! module's shared space.
//!
//! A feed is fetched through the `podcasts` egress handle, at most
//! [`FEED_BYTES`] of it in at most [`FEED_BUDGET_MS`] (the newest episodes
//! come first, so the head of a large feed is what is needed: `fetch.rs`
//! keeps it and `feed.rs` keeps every item that closed before a cut). A body
//! cut before any episode with audio closed is no reading of the feed: it is
//! an error, so that the copy kept from an earlier reading is answered
//! instead (stale) and never replaced by an empty list. Only items with an
//! audio or video enclosure are kept, at most [`MAX_EPISODES`], their show
//! notes clipped so that the whole entry stays under [`MAX_CACHED_BYTES`]
//! (the store keeps values up to 200 KB); an entry that leaves out any of the
//! feed's episodes says so (`cut`). The
//! entry is keyed by the feed's address (`feeds/<16 hex digits of its
//! SHA-256>`), never by a show id a request names, so a request can only ever
//! cache what that address itself served. No audio is fetched, stored or
//! relayed: the browser plays each enclosure straight from its publisher.

use ferrite_app::serde;
use ferrite_app::serde_json;

use crate::apps::news::feed::{self, Item, Limits};

/// The most episodes kept of a feed.
pub const MAX_EPISODES: usize = 100;
/// The most items read of a feed: items without audio are dropped, so a few
/// more than [`MAX_EPISODES`].
const ITEMS_READ: usize = MAX_EPISODES * 3 / 2;
/// The most bytes read of a feed.
pub const FEED_BYTES: usize = 900_000;
/// The most time spent reading a feed, so that the request is answered
/// before the gateway's 8-second deadline.
pub const FEED_BUDGET_MS: u64 = 6_000;
/// The largest stored entry, in bytes of JSON.
pub const MAX_CACHED_BYTES: usize = 180_000;
/// How much of each episode's notes is kept at first.
const SUMMARY_CHARS: usize = 600;

/// A feed as cached and answered.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq)]
#[serde(crate = "ferrite_app::serde", rename_all = "camelCase")]
pub struct CachedFeed {
    /// The address it was read from.
    pub url: String,
    /// When it was read, epoch milliseconds.
    pub fetched: u64,
    /// Whether the feed was longer than what was read, or lists more
    /// episodes than are kept (its older episodes are not listed).
    pub cut: bool,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub link: Option<String>,
    /// Newest first, as the feed lists them.
    pub episodes: Vec<Item>,
}

/// The shared key of a feed's entry.
pub fn key(url: &str) -> String {
    format!("feeds/{}", feed::item_id(url))
}

/// Read a fetched feed body into an entry, or say why it is no podcast feed.
/// `cut` says the fetch stopped before the end of the body.
///
/// A cut body that holds no whole episode with audio is an error too: the
/// fetch ran out of time or bytes before the first one closed, which says
/// nothing of the feed's episodes, and an empty entry stored for it would
/// replace a usable copy and be answered as fresh.
pub fn read(url: &str, fetched: u64, body: &[u8], cut: bool) -> Result<CachedFeed, String> {
    let parsed = feed::parse_received(
        body,
        cut,
        Limits {
            // One more than is kept: when it is there, the feed lists more.
            items: ITEMS_READ + 1,
            summary_chars: SUMMARY_CHARS,
        },
    )?;
    let mut cut = cut || parsed.items.len() > ITEMS_READ;
    let mut seen = std::collections::BTreeSet::new();
    let mut episodes: Vec<Item> = parsed
        .items
        .into_iter()
        .take(ITEMS_READ)
        .filter(|item| item.audio.is_some() && seen.insert(item.id.clone()))
        .take(MAX_EPISODES + 1)
        .collect();
    if episodes.len() > MAX_EPISODES {
        episodes.truncate(MAX_EPISODES);
        cut = true;
    }
    if episodes.is_empty() {
        return Err(if cut {
            "the feed was cut short before its first episode with audio ended".into()
        } else {
            "the feed lists no episode with audio".into()
        });
    }
    let mut entry = CachedFeed {
        url: url.to_string(),
        fetched,
        cut,
        title: parsed.title,
        author: parsed.author,
        description: parsed.description,
        image: parsed.image,
        link: parsed.link,
        episodes,
    };
    fit(&mut entry);
    Ok(entry)
}

fn size(entry: &CachedFeed) -> usize {
    serde_json::to_vec(entry).map_or(usize::MAX, |bytes| bytes.len())
}

/// Shrink `entry` until it is at most [`MAX_CACHED_BYTES`]: shorter notes
/// first, then no notes, then fewer episodes (the oldest go).
pub fn fit(entry: &mut CachedFeed) {
    for chars in [300, 120, 0] {
        if size(entry) <= MAX_CACHED_BYTES {
            return;
        }
        for episode in &mut entry.episodes {
            episode.summary = episode
                .summary
                .take()
                .map(|text| feed::clip(&text, chars))
                .filter(|text| chars > 0 && !text.is_empty());
        }
        if let Some(description) = entry.description.take() {
            entry.description = Some(feed::clip(&description, chars.max(200)));
        }
    }
    while size(entry) > MAX_CACHED_BYTES && !entry.episodes.is_empty() {
        entry.episodes.pop();
        entry.cut = true;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rss(items: usize, notes: usize) -> String {
        let mut body = String::from(
            r#"<?xml version="1.0"?><rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>
<title>Up First from NPR</title><itunes:author>NPR</itunes:author>
<description>The news you need to start your day.</description>
<itunes:image href="https://media.npr.org/up-first.jpg"/>"#,
        );
        for n in 0..items {
            body.push_str(&format!(
                r#"<item><title>Episode {n}</title><guid>ep-{n}</guid>
<pubDate>Tue, 14 Oct 2026 10:{:02}:00 GMT</pubDate><description>{}</description>
<enclosure url="https://play.example.org/{n}.mp3" length="1000" type="audio/mpeg"/>
<itunes:duration>12:34</itunes:duration></item>"#,
                59 - (n % 60),
                "word ".repeat(notes)
            ));
        }
        body.push_str("<item><title>No audio</title><guid>text</guid></item>");
        body.push_str("</channel></rss>");
        body
    }

    #[test]
    fn a_feed_becomes_its_episodes_with_audio_newest_first() {
        let entry = read(
            "https://feeds.npr.org/510318/podcast.xml",
            7,
            rss(3, 3).as_bytes(),
            false,
        )
        .unwrap();
        assert_eq!(entry.title, "Up First from NPR");
        assert_eq!(entry.author.as_deref(), Some("NPR"));
        assert_eq!(
            entry.image.as_deref(),
            Some("https://media.npr.org/up-first.jpg")
        );
        assert_eq!(entry.fetched, 7);
        assert!(!entry.cut, "every episode of the feed is listed");
        assert_eq!(
            entry.episodes.len(),
            3,
            "the item without audio is not an episode"
        );
        let first = &entry.episodes[0];
        assert_eq!(first.title, "Episode 0");
        assert_eq!(first.duration, Some(754));
        assert_eq!(
            first.audio.as_ref().unwrap().url,
            "https://play.example.org/0.mp3"
        );
        assert_eq!(first.id, feed::item_id("ep-0"));
        assert!(read(
            "u",
            0,
            b"<rss><channel><title>t</title></channel></rss>",
            false
        )
        .is_err());
        assert!(read("u", 0, b"<html></html>", false).is_err());
    }

    #[test]
    fn a_long_feed_is_kept_to_its_newest_episodes_and_under_the_store_s_limit() {
        let entry = read("u", 0, rss(400, 200).as_bytes(), false).unwrap();
        assert_eq!(entry.episodes.len(), MAX_EPISODES);
        assert!(entry.cut, "the feed lists more episodes than are kept");
        assert_eq!(entry.episodes[0].title, "Episode 0");
        let bytes = serde_json::to_vec(&entry).unwrap().len();
        assert!(bytes <= MAX_CACHED_BYTES, "{bytes} bytes");
        assert!(
            entry.episodes[0]
                .summary
                .as_deref()
                .unwrap_or("")
                .chars()
                .count()
                <= SUMMARY_CHARS,
            "notes are clipped"
        );
    }

    #[test]
    fn an_entry_too_large_loses_its_notes_and_then_its_oldest_episodes() {
        let long_url = format!("https://play.example.org/{}", "a".repeat(1900));
        let mut entry = read("u", 0, rss(100, 100).as_bytes(), false).unwrap();
        for episode in &mut entry.episodes {
            if let Some(audio) = episode.audio.as_mut() {
                audio.url = long_url.clone();
            }
            episode.link = Some(long_url.clone());
        }
        fit(&mut entry);
        assert!(serde_json::to_vec(&entry).unwrap().len() <= MAX_CACHED_BYTES);
        assert!(entry.episodes.iter().all(|e| e.summary.is_none()));
        assert!(entry.episodes.len() < 100 && entry.cut);
        assert_eq!(entry.episodes[0].title, "Episode 0", "the newest are kept");
    }

    #[test]
    fn a_feed_says_it_is_cut_exactly_when_episodes_are_left_out() {
        let all = read("u", 0, rss(MAX_EPISODES, 1).as_bytes(), false).unwrap();
        assert_eq!(all.episodes.len(), MAX_EPISODES);
        assert!(
            !all.cut,
            "exactly as many episodes as are kept: none is left out"
        );
        let more = read("u", 0, rss(MAX_EPISODES + 1, 1).as_bytes(), false).unwrap();
        assert_eq!(more.episodes.len(), MAX_EPISODES);
        assert!(more.cut, "one episode more than is kept");
    }

    #[test]
    fn a_feed_cut_before_its_first_episode_closed_is_not_read() {
        let body = rss(3, 3);
        let first = body.find("<item>").unwrap();
        // The fetch stopped (out of time or bytes) inside the first item, or before it.
        for end in [first + "<item><title>Episode 0</title>".len(), first] {
            let error = read("u", 0, body[..end].as_bytes(), true).unwrap_err();
            assert!(error.contains("cut short"), "{error}");
        }
        // Stopped after the first item closed: that episode is read, and the feed is cut.
        let second = body[first + 1..].find("<item>").unwrap() + first + 1;
        let entry = read("u", 0, body[..second + 20].as_bytes(), true).unwrap();
        assert_eq!(entry.episodes.len(), 1);
        assert_eq!(entry.episodes[0].title, "Episode 0");
        assert!(entry.cut);
    }

    #[test]
    fn the_key_is_the_address_s_digest() {
        assert_eq!(
            key("https://feeds.npr.org/510318/podcast.xml").len(),
            "feeds/".len() + 16
        );
        assert_ne!(key("https://a.example/1"), key("https://a.example/2"));
    }
}

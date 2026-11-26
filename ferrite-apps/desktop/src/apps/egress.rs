//! Egress handles split to the platform's limit.
//!
//! Ferrite turns each egress handle's destinations into the key prefixes of one
//! capability, and a capability holds at most [`MAX_DESTINATIONS`] of them
//! (the platform's `MAX_PREFIXES`). A deployment whose handle names more
//! is refused ("malformed capability: too many key prefixes (max 16)"). So a
//! group of destinations larger than that is declared in `ferrite.json` as
//! several handles (`web`, `web-2`, ...), and a caller names the group: [`pick`]
//! answers the handle whose destinations hold the URL. `tests/egress_split.rs`
//! holds this table and `ferrite.json` to each other.

/// The most destinations one egress handle may declare.
pub const MAX_DESTINATIONS: usize = 16;

/// `(group, handle, destinations)`, in `ferrite.json`'s order.
pub const SPLIT: &[(&str, &str, &[&str])] = &[
    (
        "web",
        "web",
        &[
            "https://cloudflare-dns.com/dns-query",
            "https://en.wikipedia.org/",
            "https://www.apple.com/",
            "https://text.npr.org/",
            "https://www.bbc.com/",
            "https://arstechnica.com/",
            "https://news.ycombinator.com/",
            "https://developer.mozilla.org/",
            "https://marginalia-search.com/",
            "https://lite.cnn.com/",
            "https://www.aljazeera.com/",
            "https://512pixels.net/",
            "https://daringfireball.net/",
            "https://lobste.rs/",
            "https://docs.python.org/",
            "https://doc.rust-lang.org/",
        ],
    ),
    (
        "web",
        "web-2",
        &[
            "https://go.dev/",
            "https://www.typescriptlang.org/",
            "https://react.dev/",
            "https://www.w3.org/",
            "https://www.rfc-editor.org/",
            "https://simple.wikipedia.org/",
            "https://en.wiktionary.org/",
            "https://www.wikipedia.org/",
            "https://www.gutenberg.org/",
            "https://www.gnu.org/",
            "https://example.com/",
            "https://upload.wikimedia.org/",
            "https://ichef.bbci.co.uk/",
            "https://cdn.arstechnica.net/",
            "https://thumb.wikimedia.org/",
        ],
    ),
    (
        "news",
        "news",
        &[
            "https://feeds.bbci.co.uk/news/rss.xml",
            "https://feeds.npr.org/1001/rss.xml",
            "https://www.theguardian.com/world/rss",
            "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
            "https://www.aljazeera.com/xml/rss/all.xml",
            "https://www.cbsnews.com/latest/rss/main",
            "https://feeds.arstechnica.com/arstechnica/index",
            "https://www.theverge.com/rss/index.xml",
            "https://www.wired.com/feed/rss",
            "https://www.engadget.com/rss.xml",
            "https://techcrunch.com/feed/",
            "https://feeds.macrumors.com/MacRumors-All",
            "https://9to5mac.com/feed/",
            "https://daringfireball.net/feeds/main",
            "https://www.nasa.gov/news-release/feed/",
            "https://www.sciencedaily.com/rss/all.xml",
        ],
    ),
    (
        "news",
        "news-2",
        &[
            "https://www.smithsonianmag.com/rss/latest_articles/",
            "https://variety.com/feed/",
            "https://www.vogue.com/feed/rss",
            "https://www.eater.com/rss/index.xml",
            "https://www.atlasobscura.com/feeds/latest",
            "https://feeds.bbci.co.uk/sport/rss.xml",
            "https://feeds.bbci.co.uk/news/business/rss.xml",
            "https://feeds.bbci.co.uk/news/technology/rss.xml",
            "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
            "https://feeds.bbci.co.uk/news/health/rss.xml",
            "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml",
            "https://feeds.npr.org/1014/rss.xml",
            "https://feeds.npr.org/1007/rss.xml",
            "https://feeds.npr.org/1128/rss.xml",
            "https://feeds.npr.org/1053/rss.xml",
            "https://www.theguardian.com/uk/business/rss",
        ],
    ),
    (
        "news",
        "news-3",
        &[
            "https://www.theguardian.com/politics/rss",
            "https://www.theguardian.com/uk/sport/rss",
            "https://www.theguardian.com/fashion/rss",
            "https://www.theguardian.com/food/rss",
            "https://www.theguardian.com/uk/travel/rss",
        ],
    ),
    (
        "podcasts",
        "podcasts",
        &[
            "https://itunes.apple.com/search",
            "https://itunes.apple.com/lookup",
            "https://itunes.apple.com/us/rss/toppodcasts/limit=25/json",
            "https://access.acast.com/rss/",
            "https://anchor.fm/s/",
            "https://api.riverside.fm/hosting/",
            "https://api.substack.com/feed/podcast/",
            "https://audioboom.com/channels/",
            "https://feed.podbean.com/",
            "https://feeds.acast.com/public/",
            "https://feeds.captivate.fm/",
            "https://feeds.feedburner.com/",
            "https://feeds.fireside.fm/",
            "https://feeds.megaphone.fm/",
            "https://feeds.npr.org/",
            "https://feeds.publicradio.org/public_feeds/",
        ],
    ),
    (
        "podcasts",
        "podcasts-2",
        &[
            "https://feeds.redcircle.com/",
            "https://feeds.simplecast.com/",
            "https://feeds.soundcloud.com/users/",
            "https://feeds.transistor.fm/",
            "https://feeds.twit.tv/",
            "https://mcsorleys.barstoolsports.com/feed/",
            "https://media.rss.com/",
            "https://podcastfeeds.nbcnews.com/",
            "https://podcasts.files.bbci.co.uk/",
            "https://rss.amperwave.net/",
            "https://rss.art19.com/",
            "https://rss.buzzsprout.com/",
            "https://rss.libsyn.com/shows/",
            "https://rss2.flightcast.com/",
            "https://www.omnycontent.com/d/playlist/",
            "https://www.spreaker.com/show/",
        ],
    ),
];

/// The handle of `group` whose destinations hold `url`: the first one with a
/// destination that `url` starts with. A group that is not split, or a URL no
/// destination holds, answers `group` itself (the platform then refuses an
/// undeclared destination, as before).
pub fn pick<'a>(group: &'a str, url: &str) -> &'a str {
    for (name, handle, destinations) in SPLIT {
        if *name == group && destinations.iter().any(|d| url.starts_with(d)) {
            return handle;
        }
    }
    group
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_handle_fits_the_capability_limit() {
        for (_, handle, destinations) in SPLIT {
            assert!(destinations.len() <= MAX_DESTINATIONS, "{handle}");
        }
    }

    #[test]
    fn a_url_goes_to_the_handle_that_declares_it() {
        assert_eq!(
            pick("web", "https://cloudflare-dns.com/dns-query?name=a&type=A"),
            "web"
        );
        assert_eq!(pick("web", "https://en.wikipedia.org/wiki/MacOS"), "web");
        assert_eq!(pick("web", "https://upload.wikimedia.org/a.png"), "web-2");
        assert_eq!(
            pick("news", "https://www.theguardian.com/food/rss"),
            "news-3"
        );
        assert_eq!(pick("news", "https://feeds.npr.org/1053/rss.xml"), "news-2");
        assert_eq!(pick("podcasts", "https://rss.art19.com/x"), "podcasts-2");
        assert_eq!(pick("books", "https://www.gutenberg.org/x"), "books");
        assert_eq!(pick("web", "https://unlisted.example/"), "web");
    }
}

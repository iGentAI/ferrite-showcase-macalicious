//! Where Podcasts may fetch from: the podcast hosts whose feeds this desktop
//! reads, and Apple's directory.
//!
//! Egress reaches a destination only when it starts with a prefix the
//! `podcasts` handle declares in `ferrite.json` (a literal `https://`
//! prefix: no wildcard, no plain `http`), follows no redirect and passes no
//! response header. So a show can be followed here only when its feed is
//! served, with a `200`, from one of [`FEED_HOSTS`]. Each prefix was checked
//! against real feeds listed by Apple's directory (search results and the
//! top chart): every sampled feed under it answered `200` itself. Hosts whose
//! feed addresses answer with a redirect (`feeds.libsyn.com`,
//! `feeds.buzzsprout.com`, `rss.pdrl.fm`) are left out, because their feeds
//! could never be read; their canonical hosts (`rss.libsyn.com`,
//! `rss.buzzsprout.com`) are listed instead.

/// Feed hosts, as the literal prefixes the `podcasts` egress handle
/// declares. Each ends with `/`, so a longer host name never matches.
pub const FEED_HOSTS: &[&str] = &[
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
];

/// Apple's keyless podcast search.
pub const SEARCH_URL: &str = "https://itunes.apple.com/search";
/// Apple's lookup of shows by their ids (the iTunes `collectionId`).
pub const LOOKUP_URL: &str = "https://itunes.apple.com/lookup";
/// Apple's chart of the most popular shows in the United States.
pub const CHART_URL: &str = "https://itunes.apple.com/us/rss/toppodcasts/limit=25/json";

/// Every destination prefix the `podcasts` egress handle must declare:
/// Apple's three addresses, then the feed hosts.
pub fn destinations() -> Vec<&'static str> {
    let mut all = vec![SEARCH_URL, LOOKUP_URL, CHART_URL];
    all.extend_from_slice(FEED_HOSTS);
    all
}

/// The longest feed address kept, in bytes.
pub const MAX_FEED_URL: usize = 1024;

/// The address to fetch a show's feed from, or why this desktop cannot.
///
/// The scheme and host are lower-cased (the egress match is literal), and
/// an `http://` address is read as `https://` when that is on the list: no
/// listed host serves its feeds over plain HTTP only, and egress refuses
/// plain HTTP.
pub fn followable(feed: Option<&str>) -> Result<String, String> {
    let Some(feed) = feed.map(str::trim).filter(|f| !f.is_empty()) else {
        return Err("Apple lists no public feed for this show.".into());
    };
    let lower = feed.to_ascii_lowercase();
    let rest = if lower.starts_with("https://") {
        &feed["https://".len()..]
    } else if lower.starts_with("http://") {
        &feed["http://".len()..]
    } else {
        return Err("The show's feed is not a web address.".into());
    };
    if feed.len() > MAX_FEED_URL
        || feed
            .bytes()
            .any(|b| b <= b' ' || matches!(b, b'"' | b'<' | b'>' | b'\\' | b'`' | 0x7f))
    {
        return Err("The show's feed address is not one this desktop can use.".into());
    }
    let (host, path) = rest.split_at(rest.find(['/', '?', '#']).unwrap_or(rest.len()));
    let host = host.to_ascii_lowercase();
    let url = format!("https://{host}{path}");
    if FEED_HOSTS.iter().any(|prefix| url.starts_with(prefix)) {
        Ok(url)
    } else {
        let shown = host.rsplit('@').next().unwrap_or(&host);
        Err(format!(
            "Its feed is published from {shown}, which is not one of the podcast hosts this desktop's server can reach."
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_destination_is_a_literal_https_prefix_listed_once() {
        let mut seen = std::collections::BTreeSet::new();
        for destination in destinations() {
            assert!(destination.starts_with("https://"), "{destination}");
            assert!(
                !destination.contains('*') && !destination.contains(' '),
                "{destination}: egress matches a literal prefix"
            );
            assert!(seen.insert(destination), "{destination} is listed twice");
        }
        for host in FEED_HOSTS {
            let after = &host["https://".len()..];
            assert!(
                after.contains('/') && host.ends_with('/'),
                "{host}: a feed prefix ends with '/' so that a longer host name never matches"
            );
            let host_name = &after[..after.find('/').unwrap()];
            assert_eq!(
                host_name,
                host_name.to_ascii_lowercase(),
                "{host}: the host is lower case, as followable() writes it"
            );
        }
        assert_eq!(destinations().len(), FEED_HOSTS.len() + 3);
    }

    #[test]
    fn a_feed_on_a_listed_host_is_followable_and_others_say_why_not() {
        assert_eq!(
            followable(Some("https://feeds.megaphone.fm/the-daily")).as_deref(),
            Ok("https://feeds.megaphone.fm/the-daily")
        );
        // Plain HTTP on a listed host is read over HTTPS; the host is lower-cased, the path kept.
        assert_eq!(
            followable(Some(
                " http://Feeds.FeedBurner.com/DanCarlin/history?format=xml "
            ))
            .as_deref(),
            Ok("https://feeds.feedburner.com/DanCarlin/history?format=xml")
        );
        assert_eq!(
            followable(Some("https://anchor.fm/s/10a340624/podcast/rss")).as_deref(),
            Ok("https://anchor.fm/s/10a340624/podcast/rss")
        );

        let refused = |feed: &str| followable(Some(feed)).unwrap_err();
        assert!(refused("https://feeds.libsyn.com/12345/rss").contains("feeds.libsyn.com"));
        assert!(refused("http://example.com/feed.xml").contains("example.com"));
        // A longer host name, a user name or another path on a listed host is not the host.
        assert!(followable(Some("https://feeds.megaphone.fm.example.com/x")).is_err());
        assert!(followable(Some("https://feeds.megaphone.fm@example.com/x")).is_err());
        assert!(followable(Some("https://anchor.fm/api/x")).is_err());
        assert!(followable(Some("https://www.spreaker.com/user/x")).is_err());
        assert!(followable(Some("ftp://feeds.megaphone.fm/x")).is_err());
        assert!(followable(Some("https://feeds.megaphone.fm/a b")).is_err());
        assert!(followable(Some(&format!(
            "https://feeds.megaphone.fm/{}",
            "a".repeat(MAX_FEED_URL)
        )))
        .is_err());
        assert_eq!(
            followable(None).unwrap_err(),
            "Apple lists no public feed for this show."
        );
        assert!(followable(Some("  ")).is_err());
    }
}

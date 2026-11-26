//! The publishers and topics News reads, and the feed behind each.
//!
//! Every feed address here is declared, exactly, as a destination of the
//! `news` egress handle in `ferrite.json` (`tests/news.rs` checks the two
//! lists agree). Ferrite's egress matches a literal prefix, follows no redirect and
//! refuses a buffered reply over 1 MiB, so each address was chosen because
//! it answered `200` itself with a feed well under that size (checked
//! 2026-10-14). A publisher's feed is read only to list its stories:
//! headline, summary, picture and link, as any feed reader shows them, with
//! the story itself opened at the publisher.

/// One feed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Source {
    /// A plain id, also the cache key.
    pub id: &'static str,
    /// The publisher's name, shown on each story.
    pub publisher: &'static str,
    /// The feed's address, declared for the `news` egress handle.
    pub feed: &'static str,
    /// The publisher's site.
    pub site: &'static str,
}

/// A channel: a publisher a person can follow or block, read from one feed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Channel {
    pub id: &'static str,
    pub name: &'static str,
    /// The colour of its sidebar tile.
    pub tint: &'static str,
}

/// A topic: the topic feeds of several publishers, merged.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Topic {
    pub id: &'static str,
    pub name: &'static str,
    pub tint: &'static str,
    pub sources: &'static [&'static str],
}

/// A [`Source`], written compactly. (A function, not a macro: the platform
/// admits no `macro_rules!` an application defines.)
const fn source(
    id: &'static str,
    publisher: &'static str,
    feed: &'static str,
    site: &'static str,
) -> Source {
    Source {
        id,
        publisher,
        feed,
        site,
    }
}

/// Every feed News reads. A channel's feed has the channel's id.
pub const SOURCES: &[Source] = &[
    // Publishers (channels).
    source(
        "bbc",
        "BBC News",
        "https://feeds.bbci.co.uk/news/rss.xml",
        "https://www.bbc.co.uk/news",
    ),
    source(
        "npr",
        "NPR",
        "https://feeds.npr.org/1001/rss.xml",
        "https://www.npr.org/",
    ),
    source(
        "guardian",
        "The Guardian",
        "https://www.theguardian.com/world/rss",
        "https://www.theguardian.com/",
    ),
    source(
        "nyt",
        "The New York Times",
        "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
        "https://www.nytimes.com/",
    ),
    source(
        "aljazeera",
        "Al Jazeera",
        "https://www.aljazeera.com/xml/rss/all.xml",
        "https://www.aljazeera.com/",
    ),
    source(
        "cbs",
        "CBS News",
        "https://www.cbsnews.com/latest/rss/main",
        "https://www.cbsnews.com/",
    ),
    source(
        "ars",
        "Ars Technica",
        "https://feeds.arstechnica.com/arstechnica/index",
        "https://arstechnica.com/",
    ),
    source(
        "verge",
        "The Verge",
        "https://www.theverge.com/rss/index.xml",
        "https://www.theverge.com/",
    ),
    source(
        "wired",
        "WIRED",
        "https://www.wired.com/feed/rss",
        "https://www.wired.com/",
    ),
    source(
        "engadget",
        "Engadget",
        "https://www.engadget.com/rss.xml",
        "https://www.engadget.com/",
    ),
    source(
        "techcrunch",
        "TechCrunch",
        "https://techcrunch.com/feed/",
        "https://techcrunch.com/",
    ),
    source(
        "macrumors",
        "MacRumors",
        "https://feeds.macrumors.com/MacRumors-All",
        "https://www.macrumors.com/",
    ),
    source(
        "9to5mac",
        "9to5Mac",
        "https://9to5mac.com/feed/",
        "https://9to5mac.com/",
    ),
    source(
        "daringfireball",
        "Daring Fireball",
        "https://daringfireball.net/feeds/main",
        "https://daringfireball.net/",
    ),
    source(
        "nasa",
        "NASA",
        "https://www.nasa.gov/news-release/feed/",
        "https://www.nasa.gov/",
    ),
    source(
        "sciencedaily",
        "ScienceDaily",
        "https://www.sciencedaily.com/rss/all.xml",
        "https://www.sciencedaily.com/",
    ),
    source(
        "smithsonian",
        "Smithsonian Magazine",
        "https://www.smithsonianmag.com/rss/latest_articles/",
        "https://www.smithsonianmag.com/",
    ),
    source(
        "variety",
        "Variety",
        "https://variety.com/feed/",
        "https://variety.com/",
    ),
    source(
        "vogue",
        "Vogue",
        "https://www.vogue.com/feed/rss",
        "https://www.vogue.com/",
    ),
    source(
        "eater",
        "Eater",
        "https://www.eater.com/rss/index.xml",
        "https://www.eater.com/",
    ),
    source(
        "atlasobscura",
        "Atlas Obscura",
        "https://www.atlasobscura.com/feeds/latest",
        "https://www.atlasobscura.com/",
    ),
    source(
        "bbc-sport",
        "BBC Sport",
        "https://feeds.bbci.co.uk/sport/rss.xml",
        "https://www.bbc.co.uk/sport",
    ),
    // Topic feeds of those publishers.
    source(
        "bbc-business",
        "BBC News",
        "https://feeds.bbci.co.uk/news/business/rss.xml",
        "https://www.bbc.co.uk/news/business",
    ),
    source(
        "bbc-technology",
        "BBC News",
        "https://feeds.bbci.co.uk/news/technology/rss.xml",
        "https://www.bbc.co.uk/news/technology",
    ),
    source(
        "bbc-science",
        "BBC News",
        "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
        "https://www.bbc.co.uk/news/science_and_environment",
    ),
    source(
        "bbc-health",
        "BBC News",
        "https://feeds.bbci.co.uk/news/health/rss.xml",
        "https://www.bbc.co.uk/news/health",
    ),
    source(
        "bbc-entertainment",
        "BBC News",
        "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml",
        "https://www.bbc.co.uk/news/entertainment_and_arts",
    ),
    source(
        "npr-politics",
        "NPR",
        "https://feeds.npr.org/1014/rss.xml",
        "https://www.npr.org/sections/politics/",
    ),
    source(
        "npr-science",
        "NPR",
        "https://feeds.npr.org/1007/rss.xml",
        "https://www.npr.org/sections/science/",
    ),
    source(
        "npr-health",
        "NPR",
        "https://feeds.npr.org/1128/rss.xml",
        "https://www.npr.org/sections/health/",
    ),
    source(
        "npr-food",
        "NPR",
        "https://feeds.npr.org/1053/rss.xml",
        "https://www.npr.org/sections/food/",
    ),
    source(
        "guardian-business",
        "The Guardian",
        "https://www.theguardian.com/uk/business/rss",
        "https://www.theguardian.com/uk/business",
    ),
    source(
        "guardian-politics",
        "The Guardian",
        "https://www.theguardian.com/politics/rss",
        "https://www.theguardian.com/politics",
    ),
    source(
        "guardian-sport",
        "The Guardian",
        "https://www.theguardian.com/uk/sport/rss",
        "https://www.theguardian.com/uk/sport",
    ),
    source(
        "guardian-fashion",
        "The Guardian",
        "https://www.theguardian.com/fashion/rss",
        "https://www.theguardian.com/fashion",
    ),
    source(
        "guardian-food",
        "The Guardian",
        "https://www.theguardian.com/food/rss",
        "https://www.theguardian.com/food",
    ),
    source(
        "guardian-travel",
        "The Guardian",
        "https://www.theguardian.com/uk/travel/rss",
        "https://www.theguardian.com/uk/travel",
    ),
];

/// The publishers, in the order Discover lists them. Each reads the source
/// of the same id.
pub const CHANNELS: &[Channel] = &[
    Channel {
        id: "bbc",
        name: "BBC News",
        tint: "#bb1919",
    },
    Channel {
        id: "npr",
        name: "NPR",
        tint: "#237bbd",
    },
    Channel {
        id: "guardian",
        name: "The Guardian",
        tint: "#052962",
    },
    Channel {
        id: "nyt",
        name: "The New York Times",
        tint: "#1a1a1a",
    },
    Channel {
        id: "aljazeera",
        name: "Al Jazeera",
        tint: "#c68a1f",
    },
    Channel {
        id: "cbs",
        name: "CBS News",
        tint: "#2a2a2a",
    },
    Channel {
        id: "ars",
        name: "Ars Technica",
        tint: "#ff4e00",
    },
    Channel {
        id: "verge",
        name: "The Verge",
        tint: "#5200ff",
    },
    Channel {
        id: "wired",
        name: "WIRED",
        tint: "#111111",
    },
    Channel {
        id: "engadget",
        name: "Engadget",
        tint: "#6e4ad8",
    },
    Channel {
        id: "techcrunch",
        name: "TechCrunch",
        tint: "#0a9e01",
    },
    Channel {
        id: "macrumors",
        name: "MacRumors",
        tint: "#2a6cb0",
    },
    Channel {
        id: "9to5mac",
        name: "9to5Mac",
        tint: "#1b8ae0",
    },
    Channel {
        id: "daringfireball",
        name: "Daring Fireball",
        tint: "#4a525a",
    },
    Channel {
        id: "nasa",
        name: "NASA",
        tint: "#0b3d91",
    },
    Channel {
        id: "sciencedaily",
        name: "ScienceDaily",
        tint: "#2f6f3e",
    },
    Channel {
        id: "smithsonian",
        name: "Smithsonian Magazine",
        tint: "#b8860b",
    },
    Channel {
        id: "variety",
        name: "Variety",
        tint: "#a01c2c",
    },
    Channel {
        id: "vogue",
        name: "Vogue",
        tint: "#222222",
    },
    Channel {
        id: "eater",
        name: "Eater",
        tint: "#e60023",
    },
    Channel {
        id: "atlasobscura",
        name: "Atlas Obscura",
        tint: "#2b4a5a",
    },
    Channel {
        id: "bbc-sport",
        name: "BBC Sport",
        tint: "#ffd230",
    },
];

/// The topics of the sidebar, in Catalina's order.
pub const TOPICS: &[Topic] = &[
    Topic {
        id: "business",
        name: "Business",
        tint: "#35508f",
        sources: &["bbc-business", "guardian-business"],
    },
    Topic {
        id: "entertainment",
        name: "Entertainment",
        tint: "#b548c6",
        sources: &["bbc-entertainment", "variety"],
    },
    Topic {
        id: "fashion",
        name: "Fashion",
        tint: "#7fb2d6",
        sources: &["guardian-fashion", "vogue"],
    },
    Topic {
        id: "food",
        name: "Food",
        tint: "#d98a3d",
        sources: &["guardian-food", "npr-food", "eater"],
    },
    Topic {
        id: "health",
        name: "Health",
        tint: "#4fa37c",
        sources: &["bbc-health", "npr-health"],
    },
    Topic {
        id: "politics",
        name: "Politics",
        tint: "#8a6f66",
        sources: &["guardian-politics", "npr-politics"],
    },
    Topic {
        id: "science",
        name: "Science",
        tint: "#5f7fa6",
        sources: &["bbc-science", "npr-science", "nasa"],
    },
    Topic {
        id: "sports",
        name: "Sports",
        tint: "#5a9a4b",
        sources: &["bbc-sport", "guardian-sport"],
    },
    Topic {
        id: "technology",
        name: "Technology",
        tint: "#4b4f7a",
        sources: &["bbc-technology", "ars", "verge"],
    },
    Topic {
        id: "travel",
        name: "Travel",
        tint: "#4d8fc4",
        sources: &["guardian-travel", "atlasobscura"],
    },
];

/// The channels a person follows before they change anything.
pub const DEFAULT_FOLLOWING: &[&str] = &["bbc", "npr", "guardian", "ars"];

/// The source with id `id`.
pub fn find(id: &str) -> Option<&'static Source> {
    SOURCES.iter().find(|s| s.id == id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::apps::document::valid_key;

    #[test]
    fn the_catalogue_hangs_together() {
        let mut ids = std::collections::BTreeSet::new();
        for source in SOURCES {
            assert!(valid_key(source.id), "{}", source.id);
            assert!(ids.insert(source.id), "{} twice", source.id);
            assert!(source.feed.starts_with("https://"), "{}", source.feed);
            assert!(source.site.starts_with("https://"), "{}", source.site);
        }
        for channel in CHANNELS {
            assert!(
                find(channel.id).is_some(),
                "channel {} has no feed",
                channel.id
            );
            assert!(
                TOPICS.iter().all(|t| t.id != channel.id),
                "{} is a topic too",
                channel.id
            );
        }
        for topic in TOPICS {
            assert!(valid_key(topic.id));
            assert!((1..=3).contains(&topic.sources.len()), "{}", topic.id);
            for source in topic.sources {
                assert!(find(source).is_some(), "topic {} names {source}", topic.id);
            }
        }
        for id in DEFAULT_FOLLOWING {
            assert!(CHANNELS.iter().any(|c| c.id == *id));
        }
    }
}

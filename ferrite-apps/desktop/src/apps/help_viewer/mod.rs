//! Help Viewer's server half: a help book the server holds, a search of it,
//! and the page each session last read.
//!
//! * `GET /api/help-viewer/books`: `{"books": [{"id", "title", "summary",
//!   "topics": [{"id", "title", "summary", "body", "source"}]}]}`, the
//!   help books this server serves. The demo adds each to its table of
//!   contents beside the macOS User Guide it carries itself.
//! * `GET /api/help-viewer/search?q=<text>`: `{"query", "results": [...]}`,
//!   the topics of the server's books that hold every word of the text, best
//!   first, at most [`MAX_RESULTS`]. The demo lists them before the results
//!   it finds in its own guide.
//! * `GET /api/help-viewer/place`: `{"page": "<id>" | null, "rev": n}`, the
//!   page the session last read; `PUT` with `{"page", "rev"}` keeps it, and
//!   `DELETE` forgets it (`document.rs`). The window opens on it again.
//!
//! The search reads an index of the books' words, built from the books when
//! a search first needs it: each word of a topic's title, summary and body,
//! with the topics that hold it. A word of the query matches a word of the
//! index that starts with it, so "sess" finds "sessions".

use std::collections::BTreeMap;
use std::sync::OnceLock;

use ferrite_app::{serde, serde_json};

use super::document;
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};

pub const MODULE: AppModule = AppModule {
    name: "help-viewer",
    title: "Help Viewer",
    handle,
};

/// The most results a search answers.
pub const MAX_RESULTS: usize = 50;
/// The longest query, in characters, and the most words it may hold.
const MAX_QUERY_CHARS: usize = 200;
const MAX_QUERY_WORDS: usize = 8;
/// The longest page id kept for a session.
const MAX_PAGE_CHARS: usize = 200;
const PLACE: &str = "place";

/// A page of a help book.
pub struct Topic {
    pub id: &'static str,
    pub title: &'static str,
    pub summary: &'static str,
    pub body: &'static [&'static str],
}

/// A help book: its entry in the table of contents and its pages.
pub struct Book {
    pub id: &'static str,
    pub title: &'static str,
    pub summary: &'static str,
    pub topics: &'static [Topic],
}

/// The books this server serves.
pub static BOOKS: &[Book] = &[Book {
    id: "desktop-help",
    title: "Macalicious Desktop Help",
    summary: "How the apps of this desktop keep your work on the Ferrite server that serves it.",
    topics: &[
        Topic {
            id: "desktop-sessions",
            title: "Your session on the desktop",
            summary: "The desktop keeps your work for this browser in a session on the Ferrite server.",
            body: &[
                "The first visit gives the browser a session cookie. Every app that saves keeps its documents under that session, for 400 days.",
                "Another browser, or a private window, has a session of its own and starts from the apps' own examples.",
            ],
        },
        Topic {
            id: "desktop-facetime",
            title: "Make calls with FaceTime",
            summary: "FaceTime calls another account of this desktop, with sound and picture going straight between the two browsers.",
            body: &[
                "Type an account's name in the field, or drag a contact onto the window, then choose Audio or Video. The person hears it ring in every browser they have open, for 45 seconds.",
                "The call goes directly between the browsers. Two browsers that can reach each other only through a relay do not connect, and the window says so.",
                "A call you miss stays in Notification Center and counts on the Dock. Someone you have blocked in Messages does not ring.",
            ],
        },
        Topic {
            id: "desktop-textedit",
            title: "Keep documents in TextEdit",
            summary: "TextEdit saves the document in its window as you type, and Save keeps a copy in the session's store.",
            body: &[
                "Reload the page and TextEdit opens the document as you left it, edited or not.",
                "The Open and Save panels list the documents and folders you saved. Nothing is written to the disk of your computer.",
            ],
        },
        Topic {
            id: "desktop-font-book",
            title: "Collections and disabled fonts in Font Book",
            summary: "Font Book keeps the collections you make and the fonts you turn off.",
            body: &[
                "Click the Add button under the sidebar to make a collection. Select a font and click the Disable button to turn it off.",
                "Fonts added from files are kept on the drive, in your own files.",
            ],
        },
        Topic {
            id: "desktop-notes",
            title: "Notes, Reminders and Stickies that stay",
            summary: "Notes, reminders and sticky notes are saved after every change and come back after a reload.",
            body: &[
                "When two windows change the same document at once, the later change is not kept and the window shows the stored version.",
            ],
        },
        Topic {
            id: "desktop-calculator",
            title: "The Calculator's paper tape",
            summary: "Each calculation is recorded on a paper tape the server keeps for the session.",
            body: &[
                "Choose Window > Show Paper Tape to see the last 100 calculations. Clear empties the tape.",
            ],
        },
        Topic {
            id: "desktop-live",
            title: "Messages and Chess between browsers",
            summary: "A message or a move made in one browser appears in every other browser showing the same room or game.",
            body: &[
                "Updates arrive without a reload. A message that could not be sent says Not Delivered and offers Try Again.",
            ],
        },
        Topic {
            id: "desktop-calendar",
            title: "Calendar, Contacts and System Preferences",
            summary: "Events, cards and settings are kept for the session and shown again after a reload.",
            body: &[
                "Dark mode chosen in System Preferences stays chosen for every window of the desktop.",
            ],
        },
        Topic {
            id: "desktop-music",
            title: "Play your own songs and open music in Music",
            summary: "Music plays songs you add from your computer and openly licensed music from the Internet Archive, and keeps your library, playlists and Loved songs.",
            body: &[
                "Choose Add to Library, press Command-O or drop song files on the window. The file goes to the Music folder of your drive, and its title, artist, album and cover are read from its tags.",
                "Internet Archive, Browse finds music under a Creative Commons licence or in the public domain. It plays straight from archive.org, and Add to Library keeps it with its licence.",
                "Right-click a song to play it next, love it or add it to a playlist. Shuffle, Repeat, Up Next and the MiniPlayer are in the playback bar, and the media keys work too.",
            ],
        },
        Topic {
            id: "desktop-spotlight",
            title: "Find your things with Spotlight",
            summary: "Click Spotlight in the menu bar and type: it finds apps by name, works out sums and unit conversions, and searches what you keep in the desktop's apps on the Ferrite server.",
            body: &[
                "Spotlight searches your contacts, your newest Mail messages (not the Trash or Junk), Calendar events, open reminders, notes, sticky notes, TextEdit documents, the names and tags of the files on your drive and the words of its text files, Safari's bookmarks and history, your songs and your photos. Every word you type must appear in a result.",
                "Type a sum such as 12*12 or a conversion such as 212 f to c, and Return copies the answer. A single word also shows its Dictionary definition, and Search the Web opens what you typed in a new Safari tab.",
                "Return opens the selected result in the app that keeps it: a text file opens in TextEdit, and any other file shows in Finder. Messages is not searched.",
            ],
        },
        Topic {
            id: "desktop-storage",
            title: "Your Ferrite drive in Storage Management",
            summary: "Storage Management shows your Ferrite drive against its 128 MiB quota, what each kind of file takes, and the data each app keeps for you.",
            body: &[
                "The bar shows Documents, Photos, Music, Movies, Other Files and the Trash, what is still being deleted and what is free. A file counts once, however many copies of it there are.",
                "Review Large Files lists the biggest files on your drive, and the Trash can be emptied from here.",
                "App Data lists the documents each app keeps for you on the server, with their size, and deletes the ones you choose. What the apps keep is not counted against the drive's quota.",
            ],
        },
        Topic {
            id: "desktop-activity",
            title: "How fast Ferrite answers, in Activity Monitor",
            summary: "Activity Monitor shows the apps running on the desktop, how the Ferrite server is doing, and the round trips your browser makes to it.",
            body: &[
                "Applications lists the apps with a window open, with their windows. Quit Process quits one, as Force Quit does.",
                "Ferrite shows the last five minutes of each of the server's modules: requests, errors, store calls and how long the server took, with graphs of the median and the 95th percentile.",
                "Network shows the round trips your browser timed to the server. Activity Monitor shows what the desktop application can measure of itself, not the processes of your computer.",
            ],
        },
        Topic {
            id: "desktop-app-store",
            title: "Get apps from the App Store, update and delete them",
            summary: "The App Store gets the desktop's other apps for you. What you get appears in the Dock and Launchpad of every browser you use.",
            body: &[
                "Click Get, then Install, and the app is in the Dock and Launchpad as soon as it has downloaded. Open opens an app you have.",
                "Store > Show Updates lists your apps; on this desktop every app is up to date.",
                "To delete an app, choose Uninstall on your account page, or hold Option in Launchpad and click the app's delete badge. The app leaves the Dock and Launchpad of all your browsers, and its data stays.",
            ],
        },
        Topic {
            id: "desktop-search",
            title: "Search this help on the server",
            summary: "The search field asks the Ferrite server, which searches its own help books and answers first.",
            body: &[
                "Help Viewer lists the server's results before the topics of the macOS User Guide. Every word you type must appear in a topic for it to be listed.",
                "Help Viewer opens again on the page you last read.",
            ],
        },
    ],
}, Book {
    id: "photos-help",
    title: "Photos Help",
    summary: "Import, organise, edit and share the photos of your library.",
    topics: &[
        Topic {
            id: "photos-import",
            title: "Import photos into Photos",
            summary: "Drag pictures onto the window, or choose File > Import, and each is kept as a file of your drive's Pictures folder.",
            body: &[
                "Import shows a review of the files first, with those the library already holds unchosen. Imports lists what you added, one batch for each time you added some.",
                "Dropping files from Finder or from the desktop imports them too, and Share > Add to Photos does it from Finder and Quick Look.",
            ],
        },
        Topic {
            id: "photos-organise",
            title: "Organise photos in albums",
            summary: "Albums, folders and smart albums live in the Photos sidebar, and a photo can be in many albums.",
            body: &[
                "Drag selected photos onto an album to add them. A smart album keeps itself full from the rules you give it.",
                "Favorites, Hidden and Recently Deleted are in the sidebar too. A photo in Recently Deleted can be recovered until its days run out.",
            ],
        },
        Topic {
            id: "photos-memories",
            title: "See your Memories in Photos",
            summary: "Memories are made from the dates and places of your photos; no picture is analysed.",
            body: &[
                "Right-click a memory to add it to Favorite Memories or delete it. Deleting a memory leaves its photos in your library. Show as Memory in an album's heading makes one of that album.",
            ],
        },
        Topic {
            id: "photos-edit",
            title: "Edit a photo in Photos",
            summary: "Edits never change the original: Revert to Original brings it back at any time.",
            body: &[
                "Open a photo and press Edit. Adjust has the light and colour sliders, Levels, Curves, Retouch and Red-eye, each with a tick that takes it off and puts it back. Filters and Crop are the other two panes.",
            ],
        },
        Topic {
            id: "photos-share",
            title: "Share and export from Photos",
            summary: "Share hands a photo to Mail, Messages or Notes with its edits; Export writes copies to a folder of your drive.",
            body: &[
                "An edited photo goes as a rendered copy in Pictures/Shared from Photos, and an unedited one as its original. AirDrop is dimmed, because a browser has no way to reach devices nearby.",
            ],
        },
    ],
}, Book {
    id: "tv-help",
    title: "TV Help",
    summary: "Watch films and YouTube videos in TV, and keep what you want to watch next.",
    topics: &[
        Topic {
            id: "tv-watch",
            title: "Watch a video in TV",
            summary: "Open a film from Watch Now, Movies or Kids, or paste a YouTube link in the search field and press Return.",
            body: &[
                "A video's page has Play, Add to Up Next, Add to Watch Later and Share. Space plays and pauses, and the Controls menu skips back and forward ten seconds.",
                "YouTube's videos play in YouTube's own player, and YouTube may refuse to play to some networks. TV then says so and offers Watch on YouTube. Searching YouTube's catalogue needs a key this desktop does not have, and TV says that too.",
            ],
        },
        Topic {
            id: "tv-library",
            title: "Up Next, Watch Later and History in TV",
            summary: "Up Next is what plays next. It shows in Watch Now, and the Library holds Watch Later, History and your playlists.",
            body: &[
                "Right-click a card to play it, queue it or add it to a playlist. Drag cards to change the order of Up Next or a playlist. Clear History in the Library empties History.",
                "All of this is kept on the server for your account, so it is there after a reload.",
            ],
        },
        Topic {
            id: "tv-home-videos",
            title: "Add home videos to TV",
            summary: "File > Import adds a movie from your drive to the Home Videos shelf of the Library.",
            body: &[
                "Nothing is copied: the file stays where it is, and Remove from Library leaves it on your drive. TV remembers where you stopped, and Show in Finder selects the file in its folder.",
            ],
        },
    ],
}, Book {
    id: "podcasts-help",
    title: "Podcasts Help",
    summary: "Follow shows in Podcasts by their feeds and keep your place in each episode.",
    topics: &[
        Topic {
            id: "podcasts-follow",
            title: "Follow a show in Podcasts",
            summary: "File > Add a Show by URL reads a show's feed, and File > Import Shows from OPML and Export Shows as OPML move a list of feeds.",
            body: &[
                "Podcasts reads feeds through the server, and only from the hosts this desktop may reach; a feed it may not read is refused with the reason. View > Refresh reads every followed feed again.",
                "File > New Station makes a station of the shows you choose, kept with your settings.",
            ],
        },
        Topic {
            id: "podcasts-listen",
            title: "Listen to an episode in Podcasts",
            summary: "Play an episode from its show or the Episodes list; Up Next holds what plays after it.",
            body: &[
                "Your follows, Up Next, the played marks and the playing speed are kept on the server for your account, so they are there after a reload.",
            ],
        },
    ],
}, Book {
    id: "safari-help",
    title: "Safari Help",
    summary: "Browse the listed sites in Safari, and keep bookmarks, a Reading List and your history.",
    topics: &[
        Topic {
            id: "safari-browse",
            title: "Open a page in Safari",
            summary: "Type an address or a search in the field at the top of the window and press Return.",
            body: &[
                "Safari asks the server for the page and shows it in the window, so it opens the sites this desktop lists. It offers any other address in a tab of your browser.",
                "When a site does not answer, Safari Can\u{2019}t Open the Page says why, and Reload asks again.",
            ],
        },
        Topic {
            id: "safari-keep",
            title: "Keep pages in Safari",
            summary: "Bookmarks > Add Bookmark keeps a page on the Favorites bar or in a folder; Add to Reading List keeps it to read later.",
            body: &[
                "Bookmarks, the Reading List, History and your open tabs are kept on the server for your account. A private window leaves no history.",
            ],
        },
    ],
}];

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Place {
    pub page: String,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct PlaceBody {
    page: String,
    rev: u64,
    #[serde(default)]
    session: Option<String>,
}

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    let session = cx.session;
    let outcome = match (cx.request.method, cx.request.path) {
        ("GET", "/books") => Ok(Response::json(200, &books())),
        ("GET", "/search") => Ok(match decode(cx.request.query_param("q").unwrap_or("")) {
            Some(query) if query.chars().count() > MAX_QUERY_CHARS => Response::error(
                400,
                &format!("a search has at most {MAX_QUERY_CHARS} characters"),
            ),
            Some(query) if words(&query).count() > MAX_QUERY_WORDS => Response::error(
                400,
                &format!("a search has at most {MAX_QUERY_WORDS} words"),
            ),
            Some(query) => {
                let results: Vec<_> = search(&query)
                    .into_iter()
                    .map(|(book, topic)| topic_json(book, topic))
                    .collect();
                Response::json(
                    200,
                    &serde_json::json!({ "query": query, "results": results }),
                )
            }
            None => Response::error(400, "the query is not percent-encoded UTF-8"),
        }),
        ("GET", "/place") => document::read(&mut cx.storage.user(), PLACE)
            .await
            .map(|current| {
                document::for_session(place_reply(current.doc.as_ref(), current.rev), session)
            }),
        ("PUT", "/place") => match cx.request.json::<PlaceBody>() {
            Err(response) => Ok(response),
            Ok(body) if !valid_page(&body.page) => Ok(Response::error(
                400,
                &format!(
                    "a page id has 1 to {MAX_PAGE_CHARS} characters and no control characters"
                ),
            )),
            Ok(body) => match document::other_session(body.session.as_deref(), session) {
                Some(refused) => Ok(refused),
                None => {
                    let place = Place { page: body.page };
                    document::write(&mut cx.storage.user(), PLACE, Some(body.rev), Some(&place))
                        .await
                        .map(|saved| document::answer(saved, Some(&place), place_reply))
                }
            },
        },
        ("DELETE", "/place") => document::write::<Place>(&mut cx.storage.user(), PLACE, None, None)
            .await
            .map(|saved| document::answer(saved, None, place_reply)),
        (_, "/books" | "/search" | "/place") => Ok(Response::method_not_allowed()),
        _ => Ok(Response::not_found()),
    };
    outcome.unwrap_or_else(|error| Response::error(503, &format!("storage failed: {error}")))
}

fn place_reply(place: Option<&Place>, rev: u64) -> serde_json::Value {
    serde_json::json!({ "page": place.map(|p| &p.page), "rev": rev })
}

fn valid_page(page: &str) -> bool {
    (1..=MAX_PAGE_CHARS).contains(&page.chars().count()) && !page.chars().any(char::is_control)
}

fn topic_json(book: &Book, topic: &Topic) -> serde_json::Value {
    serde_json::json!({
        "id": topic.id,
        "title": topic.title,
        "summary": topic.summary,
        "body": topic.body,
        "source": book.title,
    })
}

/// The `GET /books` body.
fn books() -> serde_json::Value {
    let books: Vec<_> = BOOKS
        .iter()
        .map(|book| {
            let topics: Vec<_> = book.topics.iter().map(|t| topic_json(book, t)).collect();
            serde_json::json!({
                "id": book.id,
                "title": book.title,
                "summary": book.summary,
                "topics": topics,
            })
        })
        .collect();
    serde_json::json!({ "books": books })
}

/// A query string's value: `+` is a space and `%XX` a byte. `None` when it
/// is not UTF-8 or a `%` is not followed by two hex digits.
fn decode(raw: &str) -> Option<String> {
    let bytes = raw.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut at = 0;
    while at < bytes.len() {
        match bytes[at] {
            b'+' => out.push(b' '),
            b'%' => {
                let hex = bytes.get(at + 1..at + 3)?;
                let hex = std::str::from_utf8(hex).ok()?;
                out.push(u8::from_str_radix(hex, 16).ok()?);
                at += 2;
            }
            byte => out.push(byte),
        }
        at += 1;
    }
    String::from_utf8(out).ok()
}

/// The words of a text: runs of letters and digits, in lower case.
fn words(text: &str) -> impl Iterator<Item = String> + '_ {
    text.split(|c: char| !c.is_alphanumeric())
        .filter(|word| !word.is_empty())
        .map(str::to_lowercase)
}

/// Where a word stands in a topic: 3 in its title, 2 in its summary, 1 in its
/// body; the best place counts.
type Postings = BTreeMap<(usize, usize), u32>;

/// The index: every word of the books, with each (book, topic) that holds it
/// and the weight of the best place it holds it in.
fn index() -> &'static BTreeMap<String, Postings> {
    static INDEX: OnceLock<BTreeMap<String, Postings>> = OnceLock::new();
    INDEX.get_or_init(|| {
        let mut index: BTreeMap<String, Postings> = BTreeMap::new();
        for (b, book) in BOOKS.iter().enumerate() {
            for (t, topic) in book.topics.iter().enumerate() {
                let fields = [(topic.title, 3), (topic.summary, 2)]
                    .into_iter()
                    .chain(topic.body.iter().map(|text| (*text, 1)));
                for (text, weight) in fields {
                    for word in words(text) {
                        let best = index.entry(word).or_default().entry((b, t)).or_insert(0);
                        *best = (*best).max(weight);
                    }
                }
            }
        }
        index
    })
}

/// The topics holding every word of `query` (a word matches the words of the
/// index it starts), by score, then in the books' order. The route refuses a
/// query of more than `MAX_QUERY_WORDS` words before it gets here.
pub fn search(query: &str) -> Vec<(&'static Book, &'static Topic)> {
    let wanted: Vec<String> = words(query).collect();
    if wanted.is_empty() {
        return Vec::new();
    }
    let index = index();
    let mut scores: Option<BTreeMap<(usize, usize), u32>> = None;
    for word in &wanted {
        // Every topic holding a word that starts with this one, at its best place.
        let mut found: BTreeMap<(usize, usize), u32> = BTreeMap::new();
        for (_, postings) in index
            .range(word.clone()..)
            .take_while(|(key, _)| key.starts_with(word.as_str()))
        {
            for (at, weight) in postings {
                let best = found.entry(*at).or_insert(0);
                *best = (*best).max(*weight);
            }
        }
        scores = Some(match scores {
            None => found,
            Some(before) => before
                .into_iter()
                .filter_map(|(at, score)| found.get(&at).map(|weight| (at, score + weight)))
                .collect(),
        });
    }
    let mut ranked: Vec<_> = scores.unwrap_or_default().into_iter().collect();
    // Stable: equal scores keep the books' order, which the map's key order is.
    ranked.sort_by(|a, b| b.1.cmp(&a.1));
    ranked
        .into_iter()
        .take(MAX_RESULTS)
        .map(|((b, t), _)| (&BOOKS[b], &BOOKS[b].topics[t]))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ids(query: &str) -> Vec<&'static str> {
        search(query)
            .into_iter()
            .map(|(_, topic)| topic.id)
            .collect()
    }

    #[test]
    fn every_topic_id_is_unique() {
        let mut seen = std::collections::BTreeSet::new();
        for book in BOOKS {
            assert!(seen.insert(book.id), "{} twice", book.id);
            for topic in book.topics {
                assert!(seen.insert(topic.id), "{} twice", topic.id);
            }
        }
    }

    #[test]
    fn a_search_needs_every_word_and_ranks_titles_first() {
        assert_eq!(ids("Font Book"), vec!["desktop-font-book"]);
        assert_eq!(ids("  "), Vec::<&str>::new());
        assert_eq!(ids("zeppelin"), Vec::<&str>::new());
        // "sess" starts "session" and "sessions"; the topic titled with it comes first.
        let found = ids("SESS");
        assert_eq!(found.first(), Some(&"desktop-sessions"));
        assert!(found.len() > 1);
        assert_eq!(ids("paper tape"), vec!["desktop-calculator"]);
    }

    #[test]
    fn the_book_explains_spotlight_storage_management_activity_monitor_and_the_app_store() {
        // Each app's name finds its own topic first.
        for (query, id) in [
            ("Spotlight", "desktop-spotlight"),
            ("Storage Management", "desktop-storage"),
            ("Activity Monitor", "desktop-activity"),
            ("App Store", "desktop-app-store"),
        ] {
            assert_eq!(ids(query).first(), Some(&id), "a search for {query}");
        }
        // And what each topic is for.
        assert_eq!(ids("unit conversions"), vec!["desktop-spotlight"]);
        assert_eq!(ids("Large Files").first(), Some(&"desktop-storage"));
        assert_eq!(ids("95th percentile"), vec!["desktop-activity"]);
        assert_eq!(ids("Uninstall"), vec!["desktop-app-store"]);
        // The book the window lists holds them.
        let served = books().to_string();
        for id in [
            "desktop-spotlight",
            "desktop-storage",
            "desktop-activity",
            "desktop-app-store",
        ] {
            assert!(served.contains(&format!("\"{id}\"")), "{id} is served");
        }
    }

    #[test]
    fn an_apps_name_finds_its_own_book_first() {
        for (query, book) in [
            ("TV", "tv-help"),
            ("Podcasts", "podcasts-help"),
            ("Safari", "safari-help"),
        ] {
            let found = search(query);
            assert_eq!(found.first().map(|(b, _)| b.id), Some(book), "a search for {query}");
        }
    }

    #[test]
    fn queries_are_percent_decoded() {
        assert_eq!(decode("paper+tape").as_deref(), Some("paper tape"));
        assert_eq!(decode("caf%C3%A9").as_deref(), Some("café"));
        assert_eq!(decode("100%"), None);
        assert_eq!(decode("%FF"), None);
    }

    #[test]
    fn page_ids_are_short_and_plain() {
        assert!(valid_page("desktop-textedit"));
        assert!(valid_page("server:desktop-help"));
        assert!(!valid_page(""));
        assert!(!valid_page("a\nb"));
        assert!(!valid_page(&"a".repeat(MAX_PAGE_CHARS + 1)));
    }
}

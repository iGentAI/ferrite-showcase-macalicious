//! What Spotlight indexes: one [`Source`] per document an app keeps for the
//! person, and how its items are read from the document as stored.
//!
//! Every extractor takes the stored JSON exactly as the owning module writes
//! it under its key (`{rev, doc}` for the modules on `document.rs`, `{rev,
//! data}` for Notes, Reminders and Stickies, the bare library for Photos) and
//! never fails: a shape it does not know has nothing to find.

use ferrite_app::serde;
use ferrite_app::serde_json::{self, Value};

/// The longest detail line a result carries, in characters.
const DETAIL_CHARS: usize = 120;

/// One item that can be found: what is shown and what is searched.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Item {
    pub kind: String,
    pub app: String,
    pub id: String,
    pub title: String,
    pub detail: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub at: Option<i64>,
    /// Every searchable text of the item, lower-cased and joined.
    pub text: String,
    /// For a text file of the drive: the content whose words are searched
    /// too (`index.rs` keeps that text apart, by content).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    /// A contact's phone numbers and addresses, for its card in the preview.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub lines: Vec<String>,
    /// The account a one-to-one conversation is with.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub to: Option<String>,
    /// Where a kept place is, for its map in the preview.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub spot: Option<(f64, f64)>,
}

pub fn item(kind: &str, app: &str, id: &str, title: &str, detail: &str, parts: &[&str]) -> Item {
    let detail: String = detail.chars().take(DETAIL_CHARS).collect();
    // Every word of the item is searched: the owning module already bounds what it keeps.
    let text: String = parts.join("\n").to_lowercase();
    Item {
        kind: kind.to_string(),
        app: app.to_string(),
        id: id.to_string(),
        title: title.trim().to_string(),
        detail,
        at: None,
        text,
        content: None,
        lines: Vec::new(),
        to: None,
        spot: None,
    }
}

/// A document Spotlight indexes: `apps/<app>/users/<person>/<key>`.
pub struct Source {
    /// The module that keeps the document.
    pub app: &'static str,
    pub key: &'static str,
    /// Reads the items from the stored JSON.
    pub extract: fn(&Value) -> Vec<Item>,
}

/// The kinds of result, in the order they are listed.
pub const KINDS: &[&str] = &[
    "contacts",
    "mail",
    "messages",
    "facetime",
    "events",
    "reminders",
    "notes",
    "stickies",
    "documents",
    "files",
    "web",
    "music",
    "photos",
    "books",
    "podcasts",
    "tv",
    "news",
    "stocks",
    "places",
    "scenes",
    "devices",
    "games",
];

/// Every source, in the order of their kinds.
pub const SOURCES: &[Source] = &[
    Source {
        app: "contacts",
        key: "cards",
        extract: |v| contacts(&doc(v)),
    },
    Source {
        app: "calendar",
        key: "events",
        extract: |v| events(&doc(v)),
    },
    Source {
        app: "reminders",
        key: "data",
        extract: |v| reminders(&data(v)),
    },
    Source {
        app: "notes",
        key: "library",
        extract: |v| notes(&data(v)),
    },
    Source {
        app: "stickies",
        key: "notes",
        extract: |v| stickies(&data(v)),
    },
    Source {
        app: "textedit",
        key: "files",
        extract: |v| documents(&doc(v)),
    },
    Source {
        app: "files",
        key: "drive",
        extract: |v| drive(&doc(v)),
    },
    Source {
        app: "safari",
        key: "bookmarks",
        extract: |v| bookmarks(&doc(v)),
    },
    Source {
        app: "safari",
        key: "history",
        extract: |v| history(&doc(v)),
    },
    Source {
        app: "music",
        key: "library",
        extract: |v| music(&doc(v)),
    },
    Source {
        app: "photos",
        key: "library",
        extract: photos,
    },
    Source {
        app: "books",
        key: "library",
        extract: |v| books(&doc(v)),
    },
    Source {
        app: "podcasts",
        key: "library",
        extract: |v| podcasts(&doc(v)),
    },
    Source {
        app: "tv",
        key: "library",
        extract: |v| tv(&doc(v)),
    },
    Source {
        app: "news",
        key: "library",
        extract: |v| news(&doc(v)),
    },
    Source {
        app: "stocks",
        key: "watchlist",
        extract: |v| stocks(&doc(v)),
    },
    Source {
        app: "maps",
        key: "places",
        extract: |v| places(&doc(v)),
    },
    Source {
        app: "home",
        key: "homes",
        extract: |v| scenes(&doc(v)),
    },
];

/// `doc` of a `document.rs` record.
fn doc(stored: &Value) -> Value {
    stored.get("doc").cloned().unwrap_or(Value::Null)
}

/// `data` of a `{rev, data}` record.
fn data(stored: &Value) -> Value {
    stored.get("data").cloned().unwrap_or(Value::Null)
}

fn str_of<'v>(value: &'v Value, key: &str) -> &'v str {
    value.get(key).and_then(Value::as_str).unwrap_or("")
}

fn array<'v>(value: Option<&'v Value>) -> &'v [Value] {
    value
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or(&[])
}

fn lines_of(value: &Value) -> Vec<&str> {
    array(value.get("lines"))
        .iter()
        .filter_map(Value::as_str)
        .collect()
}

fn kept(items: impl Iterator<Item = Item>) -> Vec<Item> {
    // Every item of the document is indexed: the owning module bounds how many it keeps.
    items.filter(|found| !found.title.is_empty()).collect()
}

/// One message of Mail (a header the mail module keeps under `m/<id>` in the
/// person's own space, `../mail/model.rs`): by its subject, the people it is
/// from and to, and the start of its text. Messages in the Trash or Junk are
/// not listed, nor is an erased one (its header is a tombstone,
/// `{"erased": true}`, with no message id); a sent message shows who it went
/// to.
pub fn mail_header(header: &Value) -> Option<Item> {
    let mailbox = str_of(header, "mailbox");
    if matches!(mailbox, "trash" | "junk") || str_of(header, "id").is_empty() {
        return None;
    }
    let person = |address: &Value| -> String {
        let full = str_of(address, "full_name").trim();
        if full.is_empty() {
            str_of(address, "name").to_string()
        } else {
            full.to_string()
        }
    };
    let from = header.get("from").map(person).unwrap_or_default();
    let to: Vec<String> = array(header.get("to"))
        .iter()
        .chain(array(header.get("cc")))
        .map(person)
        .collect();
    let subject = str_of(header, "subject").trim();
    let title = if subject.is_empty() {
        "(No Subject)"
    } else {
        subject
    };
    let detail = if matches!(mailbox, "sent" | "drafts") {
        format!("To {}", to.join(", "))
    } else {
        from.clone()
    };
    let names: Vec<&str> = header
        .get("from")
        .into_iter()
        .chain(array(header.get("to")))
        .chain(array(header.get("cc")))
        .flat_map(|address| [str_of(address, "name"), str_of(address, "full_name")])
        .filter(|name| !name.is_empty())
        .collect();
    let mut parts = vec![subject, from.as_str(), str_of(header, "text")];
    parts.extend(names);
    let mut found = item("mail", "mail", str_of(header, "id"), title, &detail, &parts);
    found.at = header.get("at_ms").and_then(Value::as_i64);
    Some(found)
}

/// Contacts' cards: `doc` of the `cards` document, a list of cards.
pub fn contacts(doc: &Value) -> Vec<Item> {
    kept(array(Some(doc)).iter().map(|card| {
        let first = str_of(card, "first");
        let last = str_of(card, "last");
        let company = str_of(card, "company");
        let person = format!("{first} {last}").trim().to_string();
        let is_company = card.get("isCompany").and_then(Value::as_bool) == Some(true);
        let title = if is_company || person.is_empty() {
            company.to_string()
        } else {
            person.clone()
        };
        let fields = |key: &str| -> Vec<&str> {
            array(card.get(key))
                .iter()
                .map(|field| str_of(field, "value"))
                .filter(|value| !value.is_empty())
                .collect()
        };
        let emails = fields("emails");
        let phones = fields("phones");
        let detail = emails
            .first()
            .or(phones.first())
            .copied()
            .unwrap_or(if is_company { "" } else { company });
        let mut parts = vec![first, last, company, str_of(card, "note")];
        parts.extend(emails.iter().copied());
        parts.extend(phones.iter().copied());
        let mut found = item(
            "contacts",
            "contacts",
            str_of(card, "id"),
            &title,
            detail,
            &parts,
        );
        found.lines = ["phones", "emails"]
            .iter()
            .flat_map(|key| array(card.get(*key)))
            .filter(|field| !str_of(field, "value").is_empty())
            .map(|field| {
                format!("{} {}", str_of(field, "label"), str_of(field, "value"))
                    .trim()
                    .to_string()
            })
            .collect();
        found
    }))
}

/// Calendar's events: `doc` of the `events` document, either the current
/// `{events, calendars}` or the plain list of events an earlier build wrote.
pub fn events(doc: &Value) -> Vec<Item> {
    let (events, calendars) = match doc {
        Value::Array(_) => (array(Some(doc)), &[][..]),
        _ => (array(doc.get("events")), array(doc.get("calendars"))),
    };
    let calendar_name = |id: &str| -> String {
        calendars
            .iter()
            .find(|calendar| str_of(calendar, "id") == id)
            .map(|calendar| str_of(calendar, "name").to_string())
            .unwrap_or_else(|| match id {
                "home" => "Home".into(),
                "work" => "Work".into(),
                other => other.to_string(),
            })
    };
    kept(events.iter().map(|event| {
        let title = str_of(event, "title");
        let location = str_of(event, "location");
        let detail = if location.is_empty() {
            calendar_name(str_of(event, "calendar"))
        } else {
            location.to_string()
        };
        let mut found = item(
            "events",
            "calendar",
            str_of(event, "id"),
            title,
            &detail,
            &[title, location, str_of(event, "notes")],
        );
        found.at = event.get("start").and_then(Value::as_i64);
        found
    }))
}

/// Reminders' reminders: `data` of the stored `{rev, data}`. Completed
/// reminders are not listed.
pub fn reminders(data: &Value) -> Vec<Item> {
    let lists = array(data.get("lists"));
    kept(
        array(data.get("reminders"))
            .iter()
            .filter(|reminder| reminder.get("completed").and_then(Value::as_bool) != Some(true))
            .map(|reminder| {
                let title = str_of(reminder, "title");
                let list = lists
                    .iter()
                    .find(|list| str_of(list, "id") == str_of(reminder, "listId"))
                    .map(|list| str_of(list, "name"))
                    .unwrap_or("");
                item(
                    "reminders",
                    "reminders",
                    str_of(reminder, "id"),
                    title,
                    list,
                    &[title, str_of(reminder, "notes")],
                )
            }),
    )
}

/// Notes' notes: `data` of the stored `{rev, data}`. A locked note is found
/// by its title only, as Notes shows nothing else of it; a note in Recently
/// Deleted is not found.
pub fn notes(data: &Value) -> Vec<Item> {
    let live = array(data.get("notes"))
        .iter()
        .filter(|note| note.get("deleted").is_none());
    kept(live.map(|note| {
        let lines = lines_of(note);
        let title = lines.first().copied().unwrap_or("").trim();
        let locked = note.get("locked").and_then(Value::as_bool) == Some(true);
        let detail = if locked {
            "Locked"
        } else {
            lines
                .iter()
                .skip(1)
                .map(|line| line.trim())
                .find(|line| !line.is_empty())
                .unwrap_or("")
        };
        let parts: Vec<&str> = if locked { vec![title] } else { lines.clone() };
        item("notes", "notes", str_of(note, "id"), title, detail, &parts)
    }))
}

/// Stickies' notes: `data` of the stored `{rev, data}`.
pub fn stickies(data: &Value) -> Vec<Item> {
    kept(array(data.get("notes")).iter().map(|note| {
        let text = str_of(note, "text");
        let mut lines = text.lines().map(str::trim).filter(|line| !line.is_empty());
        let title = lines.next().unwrap_or("");
        let detail = lines.next().unwrap_or("");
        item(
            "stickies",
            "stickies",
            str_of(note, "id"),
            title,
            detail,
            &[text],
        )
    }))
}

/// TextEdit's saved documents: `doc` of the `files` document. Folders are
/// not listed.
pub fn documents(doc: &Value) -> Vec<Item> {
    kept(
        array(Some(doc))
            .iter()
            .filter_map(|saved| saved.get("file"))
            .filter(|file| str_of(file, "kind") == "document")
            .map(|file| {
                let name = str_of(file, "name");
                let lines = file.get("document").map(lines_of).unwrap_or_default();
                let detail = lines
                    .iter()
                    .map(|line| line.trim())
                    .find(|line| !line.is_empty())
                    .unwrap_or("");
                let mut parts = vec![name];
                parts.extend(lines.iter().copied());
                item(
                    "documents",
                    "textedit",
                    str_of(file, "id"),
                    name,
                    detail,
                    &parts,
                )
            }),
    )
}

/// The extensions of files whose words are searched, besides `text/*`.
const TEXT_EXTENSIONS: &[&str] = &[
    "txt", "text", "md", "markdown", "csv", "tsv", "json", "xml", "html", "htm", "rtf", "log",
    "js", "ts", "tsx", "jsx", "css", "rs", "py", "rb", "go", "c", "h", "swift", "yaml", "yml",
    "toml", "ini", "sh",
];

/// Whether a drive file's words can be searched: text by its type or name.
pub fn is_text_file(name: &str, mime: &str) -> bool {
    let mime = mime.to_ascii_lowercase();
    if mime.starts_with("text/")
        || matches!(
            mime.as_str(),
            "application/json" | "application/xml" | "application/rtf" | "application/javascript"
        )
    {
        return true;
    }
    name.rsplit_once('.')
        .map(|(_, ext)| TEXT_EXTENSIONS.contains(&ext.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

/// The drive's live folders and files (`doc` of the files module's `drive`):
/// names and tags, with the folder that holds each as its detail. Items in
/// the Trash are not listed. A text file names its content, whose words
/// `index.rs` adds.
pub fn drive(doc: &Value) -> Vec<Item> {
    let entries = array(doc.get("entries"));
    let by_id: std::collections::BTreeMap<&str, &Value> = entries
        .iter()
        .map(|entry| (str_of(entry, "id"), entry))
        .collect();
    // Trashed folders take everything inside them to the Trash, by the drive's own rule
    // (`Drive::in_trash` in `../files/drive.rs`): a cycle, which no operation makes, counts as
    // gone.
    let trashed = |entry: &Value| -> bool {
        let mut at = Some(entry);
        let mut steps = 0;
        while let Some(current) = at {
            if current.get("trashed_ms").is_some_and(|v| !v.is_null()) {
                return true;
            }
            steps += 1;
            if steps > entries.len() {
                return true;
            }
            at = current
                .get("parent")
                .and_then(Value::as_str)
                .and_then(|parent| by_id.get(parent).copied());
        }
        false
    };
    kept(
        entries
            .iter()
            .filter(|entry| entry.get("parent").is_some_and(|p| p.is_string()))
            .filter(|entry| !trashed(entry))
            .filter(|entry| !str_of(entry, "name").starts_with('.'))
            .map(|entry| {
                let name = str_of(entry, "name");
                let folder = entry
                    .get("parent")
                    .and_then(Value::as_str)
                    .and_then(|parent| by_id.get(parent).copied())
                    .map(|parent| str_of(parent, "name"))
                    .unwrap_or("");
                let is_folder = str_of(entry, "kind") == "folder";
                let detail = if is_folder {
                    format!("Folder in {folder}")
                } else {
                    folder.to_string()
                };
                let tags: Vec<&str> = array(entry.get("tags"))
                    .iter()
                    .filter_map(Value::as_str)
                    .collect();
                let mut parts = vec![name];
                parts.extend(tags);
                let mut found = item(
                    "files",
                    "finder",
                    str_of(entry, "id"),
                    name,
                    &detail,
                    &parts,
                );
                // An empty file has no piece to read and no words.
                let empty = entry.get("size").and_then(Value::as_u64) == Some(0);
                let is_pdf = text_mode(name) == "pdf";
                if !is_folder && !empty && (is_pdf || is_text_file(name, str_of(entry, "type"))) {
                    found.content = entry
                        .get("content")
                        .and_then(Value::as_str)
                        .filter(|content| !content.is_empty())
                        .map(str::to_string);
                }
                found.at = entry.get("modified_ms").and_then(Value::as_i64);
                found
            }),
    )
}

/// Safari's Favorites, Bookmarks and the bookmarks in folders (`doc` of `bookmarks`).
pub fn bookmarks(doc: &Value) -> Vec<Item> {
    let links = array(doc.get("favorites"))
        .iter()
        .chain(array(doc.get("bookmarks")).iter())
        .chain(
            array(doc.get("folders"))
                .iter()
                .flat_map(|folder| array(folder.get("links")).iter()),
        );
    kept(links.map(|link| {
        let (title, url) = (str_of(link, "title"), str_of(link, "url"));
        let shown = if title.trim().is_empty() { url } else { title };
        item("web", "safari", url, shown, url, &[title, url])
    }))
}

/// Safari's history (`doc` of `history`, newest first).
pub fn history(doc: &Value) -> Vec<Item> {
    kept(array(Some(doc)).iter().map(|visit| {
        let (title, url) = (str_of(visit, "title"), str_of(visit, "url"));
        let shown = if title.trim().is_empty() { url } else { title };
        let mut found = item("web", "safari", url, shown, url, &[title, url]);
        found.at = visit.get("at").and_then(Value::as_i64);
        found
    }))
}

/// Music's songs (`doc` of `library`): title, artist, album and genre.
pub fn music(doc: &Value) -> Vec<Item> {
    kept(array(doc.get("songs")).iter().map(|song| {
        let (title, artist, album) = (
            str_of(song, "title"),
            str_of(song, "artist"),
            str_of(song, "album"),
        );
        let detail = match (artist.is_empty(), album.is_empty()) {
            (false, false) => format!("{artist} \u{2014} {album}"),
            (false, true) => artist.to_string(),
            _ => album.to_string(),
        };
        item(
            "music",
            "music",
            str_of(song, "id"),
            title,
            &detail,
            &[title, artist, album, str_of(song, "genre")],
        )
    }))
}

/// Photos' photos and albums (the bare `library` document): a photo by its
/// name and camera, an album by its name. Photos in Recently Deleted are
/// not listed.
pub fn photos(library: &Value) -> Vec<Item> {
    let photos = array(library.get("photos"))
        .iter()
        .filter(|photo| photo.get("deleted_ms").is_none_or(Value::is_null))
        .filter(|photo| photo.get("hidden").and_then(Value::as_bool) != Some(true))
        .map(|photo| {
            let name = str_of(photo, "name");
            let camera = str_of(photo, "camera");
            let favorite = photo.get("favorite").and_then(Value::as_bool) == Some(true);
            let detail = if favorite { "Favorite" } else { camera };
            let title = str_of(photo, "title");
            let mut parts = vec![name, camera, title, str_of(photo, "caption")];
            parts.extend(
                array(photo.get("keywords"))
                    .iter()
                    .filter_map(Value::as_str),
            );
            if let Some(place) = photo.get("location") {
                parts.push(str_of(place, "name"));
            }
            if favorite {
                parts.push("favorite");
            }
            let mut found = item(
                "photos",
                "photos",
                str_of(photo, "id"),
                if title.is_empty() { name } else { title },
                detail,
                &parts,
            );
            found.at = photo.get("taken_ms").and_then(Value::as_i64);
            found
        });
    let albums = array(library.get("albums")).iter().map(|album| {
        let name = str_of(album, "name");
        let count = array(album.get("photos")).len();
        let detail = format!(
            "Album, {count} {}",
            if count == 1 { "photo" } else { "photos" }
        );
        item(
            "photos",
            "photos",
            str_of(album, "id"),
            name,
            &detail,
            &[name, "album"],
        )
    });
    kept(albums.chain(photos))
}

/// Podcasts' shows the person follows, and the episodes of its Up Next and
/// player: the only episodes the server keeps, since the rest are read from
/// each show's feed. An episode's id is `<show id>.<item id>`.
pub fn podcasts(library: &Value) -> Vec<Item> {
    let shows = array(library.get("shows")).iter().map(|show| {
        let (title, author) = (str_of(show, "title"), str_of(show, "author"));
        item(
            "podcasts",
            "podcasts",
            str_of(show, "id"),
            title,
            author,
            &[title, author, str_of(show, "genre"), "podcast"],
        )
    });
    let mut seen = std::collections::BTreeSet::new();
    let episodes = library
        .get("current")
        .into_iter()
        .chain(array(library.get("queue")))
        .filter(|episode| seen.insert(str_of(episode, "id").to_string()))
        .map(|episode| {
            let (title, show) = (str_of(episode, "title"), str_of(episode, "showTitle"));
            item(
                "podcasts",
                "podcasts",
                str_of(episode, "id"),
                title,
                show,
                &[title, show, "podcast", "episode"],
            )
        });
    kept(shows.chain(episodes))
}

/// TV's videos the person has kept, watched or queued.
pub fn tv(library: &Value) -> Vec<Item> {
    kept(array(library.get("videos")).iter().map(|video| {
        let (title, channel) = (str_of(video, "title"), str_of(video, "channel"));
        item(
            "tv",
            "tv",
            str_of(video, "id"),
            title,
            channel,
            &[title, channel, "video"],
        )
    }))
}

/// News' Saved Stories.
pub fn news(library: &Value) -> Vec<Item> {
    kept(array(library.get("saved")).iter().map(|story| {
        let (title, publisher) = (str_of(story, "title"), str_of(story, "publisher"));
        let mut found = item(
            "news",
            "news",
            str_of(story, "id"),
            title,
            publisher,
            &[title, publisher, str_of(story, "summary"), "story"],
        );
        found.at = story.get("published").and_then(Value::as_i64);
        found
    }))
}

/// Stocks' watchlist, by symbol: the server keeps no company names.
pub fn stocks(watchlist: &Value) -> Vec<Item> {
    kept(
        array(watchlist.get("symbols"))
            .iter()
            .filter_map(Value::as_str)
            .map(|symbol| {
                item(
                    "stocks",
                    "stocks",
                    symbol,
                    symbol,
                    "On your watchlist",
                    &[symbol, "stock"],
                )
            }),
    )
}

/// Maps' Favorites, Recents and guides, each place once.
/// Home's scenes, each under the home that holds it.
pub fn scenes(homes: &Value) -> Vec<Item> {
    array(Some(homes))
        .iter()
        .flat_map(|home| {
            let holder = str_of(home, "name");
            array(home.get("scenes")).iter().map(move |scene| {
                let name = str_of(scene, "name");
                item(
                    "scenes",
                    "home",
                    str_of(scene, "id"),
                    name,
                    &format!("Scene in {holder}"),
                    &[name, holder],
                )
            })
        })
        .collect()
}

pub fn places(kept_places: &Value) -> Vec<Item> {
    let guides = array(kept_places.get("guides"));
    let lists = [
        array(kept_places.get("favorites")),
        array(kept_places.get("recents")),
    ]
    .into_iter()
    .chain(guides.iter().map(|guide| array(guide.get("places"))));
    let mut seen = std::collections::BTreeSet::new();
    kept(
        lists
            .flatten()
            .filter(|place| seen.insert(str_of(place, "id").to_string()))
            .map(|place| {
                let name = str_of(place, "name");
                let address: Vec<&str> = array(place.get("address"))
                    .iter()
                    .filter_map(Value::as_str)
                    .collect();
                let detail = address.join(", ");
                let mut parts = vec![name, str_of(place, "category")];
                parts.extend(&address);
                let mut found = item("places", "maps", str_of(place, "id"), name, &detail, &parts);
                found.spot = place
                    .get("lat")
                    .and_then(Value::as_f64)
                    .zip(place.get("lon").and_then(Value::as_f64));
                found
            }),
    )
}

/// The books the person got from the Book Store: `doc` of Books' `library` document.
pub fn books(library: &Value) -> Vec<Item> {
    kept(array(library.get("books")).iter().map(|book| {
        let title = str_of(book, "title");
        let author = str_of(book, "author");
        let mut found = item(
            "books",
            "books",
            str_of(book, "id"),
            title,
            author,
            &[title, author],
        );
        found.at = book.get("added").and_then(Value::as_i64);
        found
    }))
}

/// FaceTime's recent calls (`recents/<id>`), the newest with each person, newest first.
pub fn recent_calls<'v>(lines: impl Iterator<Item = &'v Value>) -> Vec<Item> {
    let mut calls: Vec<Item> = lines.filter_map(recent_call).collect();
    calls.sort_by_key(|call| std::cmp::Reverse(call.at));
    let mut seen = std::collections::BTreeSet::new();
    calls.retain(|call| seen.insert(call.id.clone()));
    calls
}

fn recent_call(line: &Value) -> Option<Item> {
    let with = line.get("with")?;
    let name = str_of(with, "name");
    let full = str_of(with, "full_name").trim();
    let title = if full.is_empty() { name } else { full };
    if name.is_empty() {
        return None;
    }
    let what = if str_of(line, "kind").eq_ignore_ascii_case("audio") {
        "FaceTime Audio"
    } else {
        "FaceTime Video"
    };
    let status = str_of(line, "status");
    let way = if status.eq_ignore_ascii_case("missed") {
        "Missed"
    } else if status.eq_ignore_ascii_case("outgoing") {
        "Outgoing"
    } else {
        "Incoming"
    };
    let detail = format!("{way} {what}");
    let mut found = item(
        "facetime",
        "facetime",
        name,
        title,
        &detail,
        &[title, name, &detail],
    );
    found.at = line.get("at_ms").and_then(Value::as_i64);
    Some(found)
}

/// What one person does not see of one Messages conversation, as `messages/conversations.rs`
/// keeps it: what they cleared, what they deleted one by one, and everyone they blocked.
#[derive(Default)]
pub struct Unseen {
    pub through: u64,
    /// Clear Chat Transcript: the conversation stays in their list with nothing in it.
    pub listed: bool,
    pub hidden: Vec<u64>,
    /// By account name, the spans of time they blocked it, `None` still running.
    pub blocked: Vec<(String, Vec<(u64, Option<u64>)>)>,
}

impl Unseen {
    fn shows(&self, message: &Value) -> bool {
        let seq = message.get("seq").and_then(Value::as_u64).unwrap_or(0);
        let at = message.get("at_ms").and_then(Value::as_u64).unwrap_or(0);
        let author = str_of(message, "author");
        seq > self.through
            && !self.hidden.contains(&seq)
            && !self.blocked.iter().any(|(name, spans)| {
                name == author
                    && spans
                        .iter()
                        .any(|(from, until)| *from <= at && until.is_none_or(|until| at < until))
            })
    }
}

/// A stored `cleared/<id>`: `<number>`, or `<number> listed`. `None` when it cannot be read.
pub fn cleared_of(bytes: &[u8]) -> Option<(u64, bool)> {
    let text = std::str::from_utf8(bytes).ok()?;
    match text.strip_suffix(" listed") {
        Some(number) => Some((number.parse().ok()?, true)),
        None => Some((text.parse().ok()?, false)),
    }
}

/// A stored `blocked/<name>`'s spans. One that cannot be read counts as blocked since the
/// beginning, as the Messages module reads it, so damage never shows what a person blocked.
pub fn blocked_spans(bytes: &[u8]) -> Vec<(u64, Option<u64>)> {
    serde_json::from_slice::<Value>(bytes)
        .ok()
        .and_then(|record| serde_json::from_value(record.get("spans")?.clone()).ok())
        .unwrap_or_else(|| vec![(0, None)])
}

/// One conversation of the person's, as Spotlight lists it: shown with the newest message they can
/// see that holds every word, with the names around it. `None` when they are not a member, when
/// nothing they can see matches, or when they deleted it and nothing new was said.
pub fn conversation(
    id: &str,
    stored: &Value,
    me: &str,
    unseen: &Unseen,
    words: &[String],
) -> Option<Item> {
    let members = array(stored.get("members"));
    if !members.iter().any(|member| str_of(member, "id") == me) {
        return None;
    }
    let others: Vec<&Value> = members
        .iter()
        .filter(|member| str_of(member, "id") != me)
        .collect();
    let names: Vec<&str> = others
        .iter()
        .map(|member| match str_of(member, "full_name").trim() {
            "" => str_of(member, "name"),
            full => full,
        })
        .collect();
    let joined = names.join(", ");
    let title = match stored.get("title").and_then(Value::as_str) {
        Some(title) if !title.trim().is_empty() => title.trim(),
        _ => joined.as_str(),
    };
    let called = format!("{title}\n{joined}").to_lowercase();
    let shown: Vec<&Value> = array(stored.get("messages"))
        .iter()
        .filter(|message| unseen.shows(message))
        .collect();
    let holds = |message: &&&Value| {
        let text = format!("{called}\n{}", str_of(message, "text")).to_lowercase();
        words.iter().all(|word| text.contains(word.as_str()))
    };
    let found = shown.iter().rev().find(holds);
    let mut hit = match found {
        Some(message) => {
            let text = str_of(message, "text");
            let wrote = str_of(message, "name");
            let detail = if wrote.is_empty() {
                text.to_string()
            } else {
                format!("{wrote}: {text}")
            };
            let mut hit = item("messages", "messages", id, title, &detail, &[&called, text]);
            hit.at = message.get("at_ms").and_then(Value::as_i64);
            hit
        }
        None if unseen.listed && shown.is_empty() => {
            item("messages", "messages", id, title, "", &[&called])
        }
        None => return None,
    };
    if let ([other], None) = (
        others.as_slice(),
        stored.get("title").and_then(Value::as_str),
    ) {
        hit.to = Some(str_of(other, "name").to_string());
    }
    Some(hit)
}

/// One device of Find My's (`devices/<id>`): `id` from its key.
pub fn device(id: &str, record: &Value) -> Option<Item> {
    let label = str_of(record, "label");
    (!label.is_empty()).then(|| {
        item(
            "devices",
            "find-my",
            id,
            label,
            "Device",
            &[label, "device"],
        )
    })
}

/// One game on the person's Chess list (`games/<id>`): `id` from its key. The
/// list keeps only when it began and whether it is against the computer.
pub fn game(id: &str, entry: &Value) -> Item {
    let against = if entry.get("computer").and_then(Value::as_bool) == Some(true) {
        "Chess game against the computer"
    } else {
        "Chess game with another player"
    };
    let mut found = item("games", "chess", id, against, "Chess", &[against]);
    found.at = entry.get("created_ms").and_then(Value::as_i64);
    found
}

/// How a text file's bytes are read for its words, by its name: `markup`
/// (HTML and XML, tags left out), `rtf` (control words left out) or `plain`;
/// `pdf` is no reading: only a page can read a PDF, and gives the words
/// (`index::keep_pdf_text`).
pub fn text_mode(name: &str) -> &'static str {
    let lower = name.to_ascii_lowercase();
    if lower.ends_with(".html") || lower.ends_with(".htm") || lower.ends_with(".xml") {
        "markup"
    } else if lower.ends_with(".rtf") {
        "rtf"
    } else if lower.ends_with(".pdf") {
        "pdf"
    } else {
        "plain"
    }
}

/// The words of a text file's first piece, for the index: the bytes as
/// UTF-8 (lossily), the markup of HTML and RTF left out ([`text_mode`]), runs
/// of white space made one, at most `limit` characters.
pub fn file_text(name: &str, bytes: &[u8], limit: usize) -> String {
    let raw = String::from_utf8_lossy(bytes);
    let stripped = match text_mode(name) {
        "markup" => strip_markup(&raw),
        "rtf" => strip_rtf(&raw),
        _ => raw.into_owned(),
    };
    // Runs of white space become one space; then the text is cut at `limit` characters, keeping
    // the part of a long run of text (minified JSON has no spaces at all) that fits.
    let normalized = stripped.split_whitespace().collect::<Vec<_>>().join(" ");
    normalized.chars().take(limit).collect()
}

/// The elements whose tags break text, as a line or a cell does: each of their
/// tags stands for a space. Any other tag (`b`, `i`, `span`, `a`, …) may sit
/// inside a word and adds nothing.
const BREAKING_TAGS: &[&str] = &[
    "address",
    "article",
    "aside",
    "blockquote",
    "body",
    "br",
    "caption",
    "dd",
    "div",
    "dl",
    "dt",
    "figcaption",
    "figure",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "head",
    "header",
    "hr",
    "html",
    "img",
    "li",
    "main",
    "nav",
    "ol",
    "option",
    "p",
    "pre",
    "section",
    "table",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "title",
    "tr",
    "ul",
];

/// The text of HTML or XML: tags left out (a space for those that break text,
/// [`BREAKING_TAGS`], nothing for inline ones), the contents of `script` and
/// `style` left out, character references decoded.
fn strip_markup(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    // The element whose contents are not text (`script`, `style`) while inside it.
    let mut hidden: Option<String> = None;
    let mut rest = text;
    while let Some(at) = rest.find('<') {
        if hidden.is_none() {
            out.push_str(&rest[..at]);
        }
        let tag_and_after = &rest[at + 1..];
        if hidden.is_none() && tag_and_after.starts_with("!--") {
            rest = tag_and_after
                .find("-->")
                .map_or("", |end| &tag_and_after[end + 3..]);
            continue;
        }
        let end = if hidden.is_some() {
            tag_and_after.find('>')
        } else {
            tag_end(tag_and_after)
        };
        let Some(end) = end else {
            // An unclosed `<` is text.
            if hidden.is_none() {
                out.push('<');
                out.push_str(tag_and_after);
            }
            rest = "";
            break;
        };
        let tag = &tag_and_after[..end];
        rest = &tag_and_after[end + 1..];
        let closing = tag.starts_with('/');
        let name: String = tag
            .trim_start_matches('/')
            .chars()
            .take_while(char::is_ascii_alphanumeric)
            .collect::<String>()
            .to_ascii_lowercase();
        match &hidden {
            Some(open) => {
                if closing && name == *open {
                    hidden = None;
                }
            }
            None if !closing && (name == "script" || name == "style") => hidden = Some(name),
            None if BREAKING_TAGS.contains(&name.as_str()) => out.push(' '),
            None => {}
        }
    }
    if hidden.is_none() {
        out.push_str(rest);
    }
    decode_references(&out)
}

/// Where a start tag ends: its first `>` outside a quoted attribute value.
fn tag_end(tag: &str) -> Option<usize> {
    let (mut quote, mut after_equals) = (None, false);
    for (at, byte) in tag.bytes().enumerate() {
        match quote {
            Some(open) if byte == open => quote = None,
            Some(_) => {}
            None if byte == b'>' => return Some(at),
            None if after_equals && matches!(byte, b'"' | b'\'') => quote = Some(byte),
            None => {}
        }
        if !byte.is_ascii_whitespace() {
            after_equals = byte == b'=';
        }
    }
    None
}

/// Text with its character references (`&eacute;`, `&#233;`, `&#xE9;`)
/// replaced by the characters they stand for. A reference this does not know,
/// or one with no `;`, stays as it is.
fn decode_references(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(at) = rest.find('&') {
        out.push_str(&rest[..at]);
        let after = &rest[at + 1..];
        // A reference is at most 12 bytes: the `;` is looked for no further, so text with many
        // `&` and no `;` costs no more than its length.
        let decoded = after
            .bytes()
            .take(13)
            .position(|byte| byte == b';')
            .and_then(|end| reference(&after[..end]).map(|ch| (ch, end)));
        match decoded {
            Some((ch, end)) => {
                out.push(ch);
                rest = &after[end + 1..];
            }
            None => {
                out.push('&');
                rest = after;
            }
        }
    }
    out.push_str(rest);
    out
}

/// The HTML entities of Latin-1, U+00A0 to U+00FF in order.
const LATIN_1_ENTITIES: [&str; 96] = [
    "nbsp", "iexcl", "cent", "pound", "curren", "yen", "brvbar", "sect", "uml", "copy", "ordf",
    "laquo", "not", "shy", "reg", "macr", "deg", "plusmn", "sup2", "sup3", "acute", "micro",
    "para", "middot", "cedil", "sup1", "ordm", "raquo", "frac14", "frac12", "frac34", "iquest",
    "Agrave", "Aacute", "Acirc", "Atilde", "Auml", "Aring", "AElig", "Ccedil", "Egrave", "Eacute",
    "Ecirc", "Euml", "Igrave", "Iacute", "Icirc", "Iuml", "ETH", "Ntilde", "Ograve", "Oacute",
    "Ocirc", "Otilde", "Ouml", "times", "Oslash", "Ugrave", "Uacute", "Ucirc", "Uuml", "Yacute",
    "THORN", "szlig", "agrave", "aacute", "acirc", "atilde", "auml", "aring", "aelig", "ccedil",
    "egrave", "eacute", "ecirc", "euml", "igrave", "iacute", "icirc", "iuml", "eth", "ntilde",
    "ograve", "oacute", "ocirc", "otilde", "ouml", "divide", "oslash", "ugrave", "uacute", "ucirc",
    "uuml", "yacute", "thorn", "yuml",
];

/// Other entities written in text: markup's own, and typography.
const OTHER_ENTITIES: [(&str, u32); 30] = [
    ("amp", 38),
    ("lt", 60),
    ("gt", 62),
    ("quot", 34),
    ("apos", 39),
    ("OElig", 338),
    ("oelig", 339),
    ("Scaron", 352),
    ("scaron", 353),
    ("Yuml", 376),
    ("fnof", 402),
    ("circ", 710),
    ("tilde", 732),
    ("ensp", 8194),
    ("emsp", 8195),
    ("thinsp", 8201),
    ("ndash", 8211),
    ("mdash", 8212),
    ("lsquo", 8216),
    ("rsquo", 8217),
    ("sbquo", 8218),
    ("ldquo", 8220),
    ("rdquo", 8221),
    ("bdquo", 8222),
    ("bull", 8226),
    ("hellip", 8230),
    ("prime", 8242),
    ("euro", 8364),
    ("trade", 8482),
    ("minus", 8722),
];

/// The character a reference names (the text between `&` and `;`).
fn reference(name: &str) -> Option<char> {
    if let Some(number) = name.strip_prefix('#') {
        let code = match number.strip_prefix(|c: char| c == 'x' || c == 'X') {
            Some(hex) => u32::from_str_radix(hex, 16).ok()?,
            None => number.parse::<u32>().ok()?,
        };
        return char::from_u32(code).filter(|c| *c != '\0');
    }
    if let Some(index) = LATIN_1_ENTITIES.iter().position(|known| *known == name) {
        return char::from_u32(0xA0 + u32::try_from(index).ok()?);
    }
    OTHER_ENTITIES
        .iter()
        .find(|(known, _)| *known == name)
        .and_then(|(_, code)| char::from_u32(*code))
}

/// The text of RTF: control words and groups left out, `\'hh` escapes read
/// as Windows-1252 (RTF's `\ansi` default), and `\uN` escapes read as the
/// UTF-16 code unit N (a surrogate pair as one character), skipping the
/// `\ucN` fallback characters after each (one unless `\uc` says otherwise,
/// for the rest of its group), as an RTF reader does.
fn strip_rtf(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let mut out = String::with_capacity(text.len());
    // The fallback characters a `\uN` is followed by, and how many are still to skip; the
    // fallback count of each enclosing group; a high surrogate waiting for its low half.
    let (mut fallback, mut skip) = (1usize, 0usize);
    let mut groups: Vec<usize> = Vec::new();
    let mut high: Option<u32> = None;
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if c == '\\' {
            match chars.get(i + 1).copied() {
                // A control word, its number, and the space that ends it.
                Some(next) if next.is_ascii_alphabetic() => {
                    let mut j = i + 1;
                    while chars.get(j).is_some_and(char::is_ascii_alphabetic) {
                        j += 1;
                    }
                    let word: String = chars[i + 1..j].iter().collect();
                    let number_at = j;
                    if chars.get(j) == Some(&'-') {
                        j += 1;
                    }
                    while chars.get(j).is_some_and(char::is_ascii_digit) {
                        j += 1;
                    }
                    let number: Option<i64> =
                        chars[number_at..j].iter().collect::<String>().parse().ok();
                    if chars.get(j) == Some(&' ') {
                        j += 1;
                    }
                    i = j;
                    match (word.as_str(), number) {
                        ("u", Some(code)) => {
                            // A code above 32767 is written negative.
                            let code = u32::try_from(if code < 0 { code + 65_536 } else { code })
                                .unwrap_or(0xFFFD);
                            match code {
                                0xD800..=0xDBFF => high = Some(code),
                                0xDC00..=0xDFFF => {
                                    let pair = high.take().and_then(|high| {
                                        char::from_u32(
                                            0x10000 + ((high - 0xD800) << 10) + (code - 0xDC00),
                                        )
                                    });
                                    out.push(pair.unwrap_or('\u{FFFD}'));
                                }
                                _ => {
                                    if high.take().is_some() {
                                        out.push('\u{FFFD}');
                                    }
                                    out.push(char::from_u32(code).unwrap_or('\u{FFFD}'));
                                }
                            }
                            skip = fallback;
                        }
                        ("uc", Some(count)) => fallback = usize::try_from(count).unwrap_or(0),
                        // Words that stand for whitespace; every other control word is
                        // formatting, which may sit inside a word.
                        (
                            "par" | "line" | "tab" | "sect" | "page" | "cell" | "row" | "emspace"
                            | "enspace" | "qmspace",
                            _,
                        ) => out.push(' '),
                        _ => {}
                    }
                }
                // A character by its code in the document's code page.
                Some('\'') => {
                    let mut j = i + 2;
                    while j < i + 4 && chars.get(j).is_some_and(char::is_ascii_hexdigit) {
                        j += 1;
                    }
                    let hex: String = chars[i + 2..j].iter().collect();
                    i = j;
                    if skip > 0 {
                        skip -= 1;
                    } else if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                        out.push(windows_1252(byte));
                    }
                }
                // An escaped symbol.
                Some(symbol) => {
                    i += 2;
                    if skip > 0 {
                        skip -= 1;
                    } else if matches!(symbol, '\\' | '{' | '}') {
                        out.push(symbol);
                    }
                }
                None => i += 1,
            }
            continue;
        }
        i += 1;
        match c {
            // A destination that holds no text (`{\*\…}`, the font and colour tables, the
            // document's information, pictures): left out whole.
            '{' if destination_at(&chars, i) => i = group_end(&chars, i),
            // A group keeps the fallback count it opened with; its end restores the one before
            // and ends any fallback still to skip. A group is formatting, not a space.
            '{' => {
                groups.push(fallback);
                skip = 0;
            }
            '}' => {
                fallback = groups.pop().unwrap_or(fallback);
                skip = 0;
            }
            // Line breaks in RTF source are not text.
            '\r' | '\n' => {}
            _ if skip > 0 => skip -= 1,
            _ => out.push(c),
        }
    }
    out
}

/// RTF destinations whose contents are not the document's text.
const RTF_HIDDEN_DESTINATIONS: &[&str] = &[
    "fonttbl",
    "colortbl",
    "stylesheet",
    "info",
    "pict",
    "object",
    "listtable",
    "listoverridetable",
    "revtbl",
    "rsidtbl",
    "filetbl",
    "generator",
    "xmlnstbl",
    "themedata",
    "colorschememapping",
    "latentstyles",
    "datastore",
    "header",
    "headerl",
    "headerr",
    "headerf",
    "footer",
    "footerl",
    "footerr",
    "footerf",
];

/// Whether the group opened just before `at` is a destination with no text:
/// `{\*\…}` or one of [`RTF_HIDDEN_DESTINATIONS`].
fn destination_at(chars: &[char], at: usize) -> bool {
    if chars.get(at) != Some(&'\\') {
        return false;
    }
    if chars.get(at + 1) == Some(&'*') {
        return true;
    }
    let word: String = chars[at + 1..]
        .iter()
        .take_while(|c| c.is_ascii_alphabetic())
        .collect();
    RTF_HIDDEN_DESTINATIONS.contains(&word.as_str())
}

/// Where the group opened just before `at` ends: just past its `}`, counting
/// the groups inside it and leaving escaped braces alone.
fn group_end(chars: &[char], at: usize) -> usize {
    let mut depth = 1usize;
    let mut i = at;
    while i < chars.len() {
        match chars[i] {
            '\\' => i += 1,
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    return i + 1;
                }
            }
            _ => {}
        }
        i += 1;
    }
    chars.len()
}

/// A byte of Windows-1252 as its character.
fn windows_1252(byte: u8) -> char {
    const HIGH: [u32; 32] = [
        0x20AC, 0x81, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021, 0x02C6, 0x2030, 0x0160,
        0x2039, 0x0152, 0x8D, 0x017D, 0x8F, 0x90, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013,
        0x2014, 0x02DC, 0x2122, 0x0161, 0x203A, 0x0153, 0x9D, 0x017E, 0x0178,
    ];
    match byte {
        0x80..=0x9F => char::from_u32(HIGH[usize::from(byte - 0x80)]).unwrap_or(' '),
        _ => char::from(byte),
    }
}

/// The text around the first place `word` appears in `text` (lower-cased
/// both), for a result's detail line: `…` marks what was cut.
pub fn snippet(text: &str, word: &str) -> Option<String> {
    // Lower-casing can turn one character into several (İ is two), so the lower-cased text is
    // built with, for each of its bytes, the original character it came from.
    let chars: Vec<char> = text.chars().collect();
    let mut lower = String::with_capacity(text.len());
    let mut origin: Vec<usize> = Vec::with_capacity(text.len());
    for (index, c) in chars.iter().enumerate() {
        for low in c.to_lowercase() {
            lower.push(low);
            origin.extend(std::iter::repeat_n(index, low.len_utf8()));
        }
    }
    let start_char = *origin.get(lower.find(word)?)?;
    let from = start_char.saturating_sub(30);
    let to = (start_char + 90).min(chars.len());
    let mut out = String::new();
    if from > 0 {
        out.push('\u{2026}');
    }
    out.extend(chars[from..to].iter());
    if to < chars.len() {
        out.push('\u{2026}');
    }
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use ferrite_app::serde_json::json;

    fn asked(text: &str) -> Vec<String> {
        text.split_whitespace().map(str::to_lowercase).collect()
    }

    #[test]
    fn comments_and_attributes_of_markup_are_not_words() {
        assert_eq!(
            strip_markup("<p>one <!-- a > hidden --> two</p>").trim(),
            "one  two"
        );
        assert_eq!(
            strip_markup(r#"<a title="x > hidden" href='y>z'>shown</a>"#).trim(),
            "shown"
        );
        assert_eq!(
            strip_markup("<script>if (a<b) { c(\"</p>\") }</script>after").trim(),
            "after"
        );
        assert_eq!(strip_markup("it's 1 < 2").trim(), "it's 1 < 2");
    }

    #[test]
    fn books_are_found_by_title_and_author() {
        let found = books(&json!({"books": [
            {"id": "gutenberg:1342", "title": "Pride and Prejudice", "author": "Jane Austen", "source": "gutenberg", "added": 7},
            {"id": "x", "title": "", "author": "Nobody"}
        ]}));
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].app, "books");
        assert_eq!(found[0].id, "gutenberg:1342");
        assert_eq!(found[0].detail, "Jane Austen");
        assert_eq!(found[0].at, Some(7));
        assert!(found[0].text.contains("austen"));
    }

    #[test]
    fn each_person_called_is_listed_once_with_the_newest_call() {
        let lines = [
            json!({"call": "a", "kind": "video", "status": "outgoing", "at_ms": 10,
                   "with": {"name": "ada", "full_name": "Ada Lovelace"}}),
            json!({"call": "b", "kind": "audio", "status": "missed", "at_ms": 30,
                   "with": {"name": "ada", "full_name": "Ada Lovelace"}}),
            json!({"call": "c", "kind": "video", "status": "incoming", "at_ms": 20,
                   "with": {"name": "bob", "full_name": ""}}),
        ];
        let calls = recent_calls(lines.iter());
        let seen: Vec<_> = calls
            .iter()
            .map(|call| (call.title.as_str(), call.detail.as_str(), call.at))
            .collect();
        assert_eq!(
            seen,
            [
                ("Ada Lovelace", "Missed FaceTime Audio", Some(30)),
                ("bob", "Incoming FaceTime Video", Some(20)),
            ]
        );
    }

    fn chat() -> Value {
        json!({
            "members": [
                {"id": "me", "name": "me", "full_name": "Me"},
                {"id": "u2", "name": "ada", "full_name": "Ada Lovelace"}
            ],
            "messages": [
                {"seq": 1, "author": "ada", "name": "Ada Lovelace", "text": "Lunch at noon?", "at_ms": 100},
                {"seq": 2, "author": "me", "name": "Me", "text": "Lunch works", "at_ms": 200},
                {"seq": 3, "author": "ada", "name": "Ada Lovelace", "text": "See you", "at_ms": 300}
            ]
        })
    }

    #[test]
    fn a_conversation_shows_the_newest_message_that_matches() {
        let hit = conversation("c1", &chat(), "me", &Unseen::default(), &asked("lunch")).unwrap();
        assert_eq!(hit.title, "Ada Lovelace");
        assert_eq!(hit.detail, "Me: Lunch works");
        assert_eq!(hit.at, Some(200));
        assert_eq!(hit.to.as_deref(), Some("ada"));
        let named = conversation("c1", &chat(), "me", &Unseen::default(), &asked("ada")).unwrap();
        assert_eq!(named.detail, "Ada Lovelace: See you");
        assert!(conversation("c1", &chat(), "me", &Unseen::default(), &asked("tea")).is_none());
    }

    #[test]
    fn someone_else_s_conversation_is_never_found() {
        assert!(conversation("c1", &chat(), "u9", &Unseen::default(), &asked("lunch")).is_none());
    }

    #[test]
    fn what_the_person_does_not_see_is_not_found() {
        let through = Unseen {
            through: 2,
            ..Unseen::default()
        };
        assert!(conversation("c1", &chat(), "me", &through, &asked("lunch")).is_none());
        let hidden = Unseen {
            hidden: vec![2],
            ..Unseen::default()
        };
        let hit = conversation("c1", &chat(), "me", &hidden, &asked("lunch")).unwrap();
        assert_eq!(hit.detail, "Ada Lovelace: Lunch at noon?");
        let blocked = Unseen {
            blocked: vec![("ada".to_string(), vec![(50, Some(150))])],
            ..Unseen::default()
        };
        let hit = conversation("c1", &chat(), "me", &blocked, &asked("noon"));
        assert!(hit.is_none(), "written while blocked");
        let deleted = Unseen {
            through: 3,
            ..Unseen::default()
        };
        assert!(conversation("c1", &chat(), "me", &deleted, &asked("ada")).is_none());
        let cleared = Unseen {
            through: 3,
            listed: true,
            ..Unseen::default()
        };
        let hit = conversation("c1", &chat(), "me", &cleared, &asked("ada")).unwrap();
        assert_eq!(hit.detail, "");
    }

    #[test]
    fn a_group_goes_by_its_name_and_reaches_no_one_person() {
        let mut group = chat();
        group["title"] = json!("Book club");
        let hit = conversation("c1", &group, "me", &Unseen::default(), &asked("club")).unwrap();
        assert_eq!(hit.title, "Book club");
        assert_eq!(hit.to, None);
    }

    #[test]
    fn stored_records_of_what_was_cleared_and_blocked_are_read() {
        assert_eq!(cleared_of(b"12"), Some((12, false)));
        assert_eq!(cleared_of(b"12 listed"), Some((12, true)));
        assert_eq!(cleared_of(b"junk"), None);
        assert_eq!(
            blocked_spans(br#"{"full_name":"","spans":[[5,9],[20,null]]}"#),
            [(5, Some(9)), (20, None)]
        );
        assert_eq!(blocked_spans(b"junk"), [(0, None)]);
    }

    #[test]
    fn a_contact_s_card_and_a_place_s_spot_are_given() {
        let cards = contacts(&json!([{ "id": "c", "first": "Ada", "last": "L",
            "phones": [{"label": "mobile", "value": "555"}],
            "emails": [{"label": "home", "value": "a@b"}, {"label": "work", "value": ""}] }]));
        assert_eq!(cards[0].lines, ["mobile 555", "home a@b"]);
        let kept =
            places(&json!({"favorites": [{"id": "p", "name": "Home", "lat": 51.5, "lon": -0.1}]}));
        assert_eq!(kept[0].spot, Some((51.5, -0.1)));
    }

    #[test]
    fn a_renamed_file_and_a_changed_bookmark_are_found_by_what_they_say_now() {
        let file_named = |name: &str| {
            drive(&json!({"entries": [
                {"id": "documents", "name": "Documents", "kind": "folder", "created_ms": 0, "modified_ms": 0},
                {"id": "f", "parent": "documents", "kind": "file", "name": name, "created_ms": 0, "modified_ms": 1}
            ]}))
            .into_iter()
            .find(|file| file.id == "f")
            .unwrap()
        };
        assert!(file_named("before.txt").text.contains("before"));
        let renamed = file_named("after.txt");
        assert!(!renamed.text.contains("before"), "{}", renamed.text);

        let marked = |title: &str| {
            bookmarks(&json!({"bookmarks": [{"title": title, "url": "https://example.com/"}]}))
        };
        assert!(marked("Old name")[0].text.contains("old name"));
        assert!(!marked("New name")[0].text.contains("old name"));
        assert!(
            bookmarks(&json!({"bookmarks": []})).is_empty(),
            "a removed bookmark"
        );
    }

    #[test]
    fn the_media_apps_kept_things_can_be_found() {
        let ids = |found: Vec<Item>| {
            found
                .iter()
                .map(|item| format!("{}:{}:{}", item.kind, item.app, item.id))
                .collect::<Vec<_>>()
        };
        let show = json!({"id": "s1", "title": "Harbour Talk", "author": "Ann"});
        let episode =
            json!({"id": "s1.e1", "show": "s1", "title": "Tide", "showTitle": "Harbour Talk"});
        let library = json!({"shows": [show], "current": episode, "queue": [episode]});
        assert_eq!(
            ids(podcasts(&library)),
            ["podcasts:podcasts:s1", "podcasts:podcasts:s1.e1"]
        );
        assert_eq!(podcasts(&library)[1].detail, "Harbour Talk");
        assert_eq!(
            ids(podcasts(&json!({"shows": [show], "current": null}))),
            ["podcasts:podcasts:s1"]
        );
        let videos = json!({"videos": [{"id": "v1", "title": "Ferry", "channel": "Boats"}]});
        assert_eq!(ids(tv(&videos)), ["tv:tv:v1"]);
        assert!(tv(&videos)[0].text.contains("boats"));
        let saved = json!({
            "saved": [{"id": "n1", "title": "Bridge", "publisher": "BBC", "published": 7}],
            "history": [{"id": "n2", "title": "Read once", "publisher": "BBC"}],
        });
        assert_eq!(ids(news(&saved)), ["news:news:n1"], "Saved Stories only");
        assert_eq!(news(&saved)[0].at, Some(7));
        assert_eq!(
            ids(stocks(&json!({"symbols": ["AAPL", ".DJI"]}))),
            ["stocks:stocks:AAPL", "stocks:stocks:.DJI"]
        );
        let pier = json!({"id": "p1", "name": "Pier", "category": "pier",
            "address": ["Pier 15", "San Francisco"]});
        let kept_places = json!({
            "favorites": [pier],
            "recents": [pier],
            "guides": [{"id": "g", "name": "Trip", "places": [pier, {"id": "p2", "name": "Hill"}]}],
        });
        assert_eq!(
            ids(places(&kept_places)),
            ["places:maps:p1", "places:maps:p2"]
        );
        assert_eq!(places(&kept_places)[0].detail, "Pier 15, San Francisco");
        assert_eq!(
            device("d1", &json!({"label": "Safari on Mac"}))
                .unwrap()
                .app,
            "find-my"
        );
        assert_eq!(device("d1", &json!({})), None, "a device without a name");
        let against = game("g1", &json!({"created_ms": 5, "computer": true}));
        assert_eq!((against.at, against.app.as_str()), (Some(5), "chess"));
        assert!(against.title.contains("computer"));
        assert!(game("g2", &json!({"created_ms": 5}))
            .title
            .contains("another player"));
    }

    #[test]
    fn every_source_reads_its_stored_shape() {
        let cards = json!({"rev": 1, "doc": [
            {"id": "c1", "first": "Ada", "last": "Lovelace", "company": "Analytical",
             "emails": [{"label": "work", "value": "ada@example.com"}]},
            {"id": "c2", "first": "", "last": "", "company": "Acme", "isCompany": true},
        ]});
        let found = (SOURCES[0].extract)(&cards);
        assert_eq!(found[0].title, "Ada Lovelace");
        assert_eq!(found[0].detail, "ada@example.com");
        assert!(found[0].text.contains("analytical"));
        assert_eq!(found[1].title, "Acme");

        // The current calendar document and the list an earlier build wrote.
        let current = json!({"events": [{"id": "e1", "title": "Lunch", "start": 5, "end": 9,
            "calendar": "work", "notes": "bring the slides"}],
            "calendars": [{"id": "work", "name": "Office", "color": "purple"}]});
        let found = events(&current);
        assert_eq!((found[0].at, found[0].detail.as_str()), (Some(5), "Office"));
        assert!(found[0].text.contains("slides"), "notes are searched");
        let earlier = json!([{"id": "e2", "title": "Dentist", "start": 1, "end": 2,
            "calendar": "home", "location": "Main St"}]);
        assert_eq!(events(&earlier)[0].detail, "Main St");

        let todo = json!({"lists": [{"id": "l1", "name": "Errands"}], "reminders": [
            {"id": "r1", "listId": "l1", "title": "Buy milk", "notes": "oat"},
            {"id": "r2", "listId": "l1", "title": "Done thing", "completed": true},
        ]});
        let found = reminders(&todo);
        assert_eq!(found.len(), 1, "a completed reminder is not listed");
        assert_eq!(found[0].detail, "Errands");

        let library = json!({"notes": [
            {"id": "n1", "lines": ["Trip", "", "Pack the tent"]},
            {"id": "n2", "lines": ["Secret plans", "the tent too"], "locked": true},
            {"id": "n3", "lines": ["Thrown away"], "deleted": "2026-11-02T11:00:00.000Z"},
        ]});
        let found = notes(&library);
        assert_eq!(found.len(), 2, "a note in Recently Deleted is not found");
        assert_eq!(found[0].detail, "Pack the tent");
        assert_eq!(found[1].detail, "Locked");
        assert!(
            !found[1].text.contains("tent"),
            "a locked note's text is not searched"
        );

        let sticky =
            json!({"notes": [{"id": "s1", "color": "yellow", "text": "Call Bob\nabout tea"}]});
        assert_eq!(stickies(&sticky)[0].detail, "about tea");

        let files = json!([
            {"place": "documents", "folders": [], "file": {"id": "f1", "name": "Recipes", "kind": "folder"}},
            {"place": "documents", "folders": ["f1"], "file": {"id": "f2", "name": "Soup.rtf", "kind": "document",
             "document": {"name": "Soup.rtf", "format": "rich", "lines": ["Leek and potato"]}}},
        ]);
        let found = documents(&files);
        assert_eq!(found.len(), 1, "folders are not listed");
        assert_eq!(found[0].app, "textedit");

        let links = json!({"favorites": [{"title": "Rust", "url": "https://www.rust-lang.org/"}],
            "bookmarks": [{"title": "", "url": "https://example.com/"}],
            "folders": [{"title": "Reading",
                "links": [{"title": "In a folder", "url": "https://example.org/"}]}]});
        let found = bookmarks(&links);
        assert_eq!(
            found[2].title, "In a folder",
            "a folder's bookmark is found"
        );
        assert_eq!(
            found[1].title, "https://example.com/",
            "an untitled bookmark shows its address"
        );
        assert_eq!(
            (found[0].kind.as_str(), found[0].app.as_str()),
            ("web", "safari")
        );
        let visits = json!([{"url": "https://en.wikipedia.org/wiki/Ada", "title": "Ada - Wikipedia", "at": 7, "count": 2}]);
        assert_eq!(history(&visits)[0].at, Some(7));

        let songs = json!({"songs": [{"id": "s1", "title": "Clair de Lune", "artist": "Debussy",
            "album": "Suite bergamasque", "genre": "Classical"}]});
        let found = music(&songs);
        assert_eq!(found[0].detail, "Debussy \u{2014} Suite bergamasque");
        assert!(found[0].text.contains("classical"));

        let pictures = json!({"photos": [
            {"id": "p1", "name": "Beach.jpg", "favorite": true, "taken_ms": 3},
            {"id": "p2", "name": "Gone.jpg", "deleted_ms": 4},
            {"id": "p3", "name": "Private.jpg", "hidden": true},
        ], "albums": [{"id": "a1", "name": "Summer", "photos": ["p1"]}]});
        let found = photos(&pictures);
        let titles: Vec<&str> = found.iter().map(|f| f.title.as_str()).collect();
        assert_eq!(
            titles,
            ["Summer", "Beach.jpg"],
            "Recently Deleted and Hidden are not listed"
        );
        assert_eq!(found[0].detail, "Album, 1 photo");
        assert_eq!(found[1].at, Some(3));
    }

    #[test]
    fn mail_is_found_by_subject_people_and_text_but_not_in_the_trash() {
        // An erased message's tombstone is no message.
        assert!(mail_header(&json!({"erased": true})).is_none());
        assert!(mail_header(&json!({"erased": true, "text": true})).is_none());
        let header = json!({"id": "m1", "mailbox": "inbox", "subject": "Garden party",
            "from": {"name": "martin", "full_name": "Martin Ramos"},
            "to": [{"name": "chris", "full_name": "Chris"}], "at_ms": 9,
            "text": "Bring the tulips on Saturday"});
        let found = mail_header(&header).unwrap();
        assert_eq!(
            (found.title.as_str(), found.detail.as_str()),
            ("Garden party", "Martin Ramos")
        );
        assert_eq!(
            (found.kind.as_str(), found.app.as_str(), found.at),
            ("mail", "mail", Some(9))
        );
        assert!(found.text.contains("tulips") && found.text.contains("martin"));
        // A recipient is found by their account name as well as their display name.
        let to_kim = json!({"id": "m4", "mailbox": "inbox", "subject": "Plans",
            "from": {"name": "martin"}, "to": [{"name": "kpark", "full_name": "Kim Park"}],
            "cc": [{"name": "lee", "full_name": "Lee Ann"}], "text": ""});
        let to_kim = mail_header(&to_kim).unwrap();
        for word in ["kpark", "kim park", "lee", "lee ann"] {
            assert!(to_kim.text.contains(word), "{word} in {:?}", to_kim.text);
        }
        let sent = json!({"id": "m2", "mailbox": "sent", "subject": "", "from": {"name": "chris"},
            "to": [{"name": "martin", "full_name": "Martin Ramos"}], "at_ms": 1, "text": ""});
        let sent = mail_header(&sent).unwrap();
        assert_eq!(
            (sent.title.as_str(), sent.detail.as_str()),
            ("(No Subject)", "To Martin Ramos")
        );
        let trashed =
            json!({"id": "m3", "mailbox": "trash", "subject": "x", "from": {"name": "a"}});
        assert!(mail_header(&trashed).is_none());
    }

    #[test]
    fn the_drive_lists_live_entries_and_names_the_content_of_text_files() {
        let stored = json!({"entries": [
            {"id": "documents", "name": "Documents", "kind": "folder", "created_ms": 0, "modified_ms": 0},
            {"id": "d1", "parent": "documents", "name": "Plans", "kind": "folder", "created_ms": 0, "modified_ms": 0},
            {"id": "f1", "parent": "d1", "name": "todo.txt", "kind": "file", "type": "text/plain",
             "content": "c1", "size": 10, "created_ms": 0, "modified_ms": 9, "tags": ["Red"]},
            {"id": "f2", "parent": "documents", "name": "photo.jpg", "kind": "file", "type": "image/jpeg",
             "content": "c2", "size": 10, "created_ms": 0, "modified_ms": 0},
            {"id": "d2", "parent": "documents", "name": "Old", "kind": "folder", "created_ms": 0,
             "modified_ms": 0, "trashed_ms": 5},
            {"id": "f3", "parent": "d2", "name": "inside.md", "kind": "file", "content": "c3",
             "created_ms": 0, "modified_ms": 0},
            {"id": "f4", "parent": "documents", "name": ".icon-f1", "kind": "file", "type": "image/png",
             "content": "c4", "size": 10, "created_ms": 0, "modified_ms": 0},
        ]});
        let found = drive(&stored);
        let names: Vec<&str> = found.iter().map(|f| f.title.as_str()).collect();
        assert_eq!(
            names,
            ["Plans", "todo.txt", "photo.jpg"],
            "special folders, the Trash and hidden files are not listed"
        );
        assert_eq!(found[0].detail, "Folder in Documents");
        assert_eq!(found[1].detail, "Plans");
        assert_eq!(found[1].content.as_deref(), Some("c1"));
        assert!(found[1].text.contains("red"), "tags are searched");
        assert_eq!(found[2].content, None, "a picture's bytes are not words");
        assert_eq!(found[1].app, "finder");

        // A PDF names its content too: a page gives its words, never the blob read here.
        let pdf = json!({"entries": [
            {"id": "documents", "name": "Documents", "kind": "folder", "created_ms": 0, "modified_ms": 0},
            {"id": "p", "parent": "documents", "name": "Report.PDF", "kind": "file", "type": "application/pdf",
             "content": "c7", "size": 9, "created_ms": 0, "modified_ms": 0},
        ]});
        assert_eq!(drive(&pdf)[0].content.as_deref(), Some("c7"));
        assert_eq!(text_mode("Report.PDF"), "pdf");

        // An empty text file has no piece to read: it is found by its name alone.
        let empty = json!({"entries": [
            {"id": "documents", "name": "Documents", "kind": "folder", "created_ms": 0, "modified_ms": 0},
            {"id": "e", "parent": "documents", "name": "blank.txt", "kind": "file", "type": "text/plain",
             "content": "c9", "size": 0, "created_ms": 0, "modified_ms": 0},
        ]});
        assert_eq!(drive(&empty)[0].content, None);
    }

    #[test]
    fn text_files_are_told_by_type_or_name_and_read_without_markup() {
        assert!(is_text_file("a.bin", "text/plain"));
        assert!(is_text_file("Notes.MD", "application/octet-stream"));
        assert!(!is_text_file("a.png", "image/png"));
        assert_eq!(
            file_text("a.html", b"<p>Hello <b>there</b></p>", 100),
            "Hello there"
        );
        assert_eq!(
            file_text(
                "a.rtf",
                br"{\rtf1\ansi{\fonttbl\f0 Helvetica;}\f0\fs24 Leek \{soup\}}",
                100
            ),
            "Leek {soup}"
        );
        assert_eq!(
            file_text("a.txt", b"one  two\n\nthree four", 13),
            "one two three"
        );
        assert_eq!(
            file_text("a.txt", b"one two", 5),
            "one t",
            "a cut keeps the part that fits"
        );
        // Minified JSON longer than the limit: one run with no space at all.
        let minified = format!("{{\"items\":[{}]}}", "\"tulip\",".repeat(2_000));
        let kept = file_text("data.json", minified.as_bytes(), 8_000);
        assert_eq!(kept.chars().count(), 8_000);
        assert!(kept.contains("tulip"));
        assert_eq!(file_text("a.txt", &[0xff, b'o', b'k'], 10), "\u{fffd}ok");
    }

    #[test]
    fn inline_formatting_keeps_words_whole() {
        assert_eq!(
            file_text(
                "a.html",
                b"<p>hel<b>lo</b> wor<i>ld</i></p><p>next</p><script>var x=1</script>line<br>end",
                100
            ),
            "hello world next line end"
        );
        assert_eq!(
            file_text(
                "a.rtf",
                br"{\rtf1{\fonttbl\f0 Helvetica;}{\*\generator Writer;}hel{\b lo} wor\i ld\i0\par next\tab end}",
                100
            ),
            "hello world next end"
        );
        let text = file_text("a.html", b"<p>Caf<span>&eacute;</span> au lait</p>", 100);
        let file = item("files", "finder", "f3", "a.html", "Documents", &["a.html"]);
        let (hits, _) =
            super::super::found_with(vec![file], &["café".to_string()], |_| Some(text.clone()));
        assert_eq!(hits.len(), 1, "{text}");
    }

    #[test]
    fn character_references_in_markup_are_read_and_found() {
        let page = b"<p>Caf&eacute; cr&#232;me br&#xFB;l&eacute;e&nbsp;na&iuml;ve &amp; more &bogus; &#99999999; &amp</p>";
        let text = file_text("menu.html", page, 200);
        assert_eq!(
            text, "Café crème brûlée naïve & more &bogus; &#99999999; &amp",
            "known references decoded, the rest left as written"
        );
        let file = item(
            "files",
            "finder",
            "f2",
            "menu.html",
            "Documents",
            &["menu.html"],
        );
        for query in ["café", "crème brûlée", "naïve"] {
            let words: Vec<String> = query.split(' ').map(str::to_string).collect();
            let (hits, _) =
                super::super::found_with(vec![file.clone()], &words, |_| Some(text.clone()));
            assert_eq!(hits.len(), 1, "{query}");
        }
        assert_eq!(
            file_text(
                "a.xml",
                b"<t>Fish &amp;amp; chips &#x2014; &lt;b&gt;</t>",
                100
            ),
            "Fish &amp; chips \u{2014} <b>",
            "each reference is decoded once"
        );
        // Many `&` and no `;`: read in one pass, left as written.
        let ampersands = "&".repeat(200_000);
        assert_eq!(decode_references(&ampersands), ampersands);
    }

    #[test]
    fn rtf_escapes_are_read_as_the_characters_they_stand_for() {
        // `\'e9` is é in Windows-1252; `\u232?` is è with one fallback character; `\uc2` makes
        // the fallback two (here two escapes); `\'93`/`\'94` are curly quotes; a negative `\u`
        // is a code above 32767.
        let rtf = br"{\rtf1\ansi\ansicpg1252 Caf\'e9 au lait, cr\u232?me br\u251?l\u233?e, {\uc2 na\u239\'3f\'3fve} \'93ok\'94 \u-3998?}";
        let text = file_text("menu.rtf", rtf, 200);
        assert_eq!(
            text,
            "Café au lait, crème brûlée, naïve \u{201c}ok\u{201d} \u{f062}"
        );
        // `\uc` holds for its own group only: after `{\uc2 …}` the fallback is one again.
        assert_eq!(
            file_text("a.rtf", br"{\rtf1 {\uc2 x\u233??} \u233?clair}", 50),
            "xé éclair"
        );
        // A character beyond the 16-bit plane is a surrogate pair of two escapes.
        assert_eq!(
            file_text("a.rtf", br"{\rtf1 Smile \u-10179?\u-8704? now}", 50),
            "Smile \u{1F600} now"
        );
        assert_eq!(
            file_text("a.rtf", br"{\rtf1 Lone \u-10179?x}", 50),
            "Lone x",
            "a high surrogate with no low half is dropped"
        );
        // And the words are found by search.
        let file = item(
            "files",
            "finder",
            "f1",
            "menu.rtf",
            "Documents",
            &["menu.rtf"],
        );
        for query in ["café", "crème brûlée", "naïve"] {
            let words: Vec<String> = query.split(' ').map(str::to_string).collect();
            let (hits, _) =
                super::super::found_with(vec![file.clone()], &words, |_| Some(text.clone()));
            assert_eq!(hits.len(), 1, "{query}");
        }
    }

    #[test]
    fn a_snippet_shows_the_words_around_a_match() {
        let text = format!("{} needle {}", "a".repeat(40), "b".repeat(200));
        let shown = snippet(&text, "needle").unwrap();
        assert!(shown.starts_with('\u{2026}') && shown.ends_with('\u{2026}'));
        assert!(shown.contains("needle"));
        assert_eq!(
            snippet("Ünïcode Text", "text").as_deref(),
            Some("Ünïcode Text")
        );
        assert_eq!(snippet("abc", "z"), None);
        // İ lower-cases to two characters: the place found is mapped back to the original.
        let expanding = format!("{} needle tail", "İ".repeat(100));
        let shown = snippet(&expanding, "needle").unwrap();
        assert!(shown.contains("needle tail"), "{shown}");
        assert!(snippet(&"İ".repeat(5), "i\u{307}").is_some());
    }
}

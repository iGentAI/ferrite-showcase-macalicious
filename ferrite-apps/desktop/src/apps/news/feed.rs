//! A tolerant reader of RSS 2.0, RSS 1.0 (RDF) and Atom feeds, shared by
//! News and Podcasts.
//!
//! The body is read into a small element tree, then the channel and its items
//! are taken from it. The reader is forgiving where feeds in the wild are
//! sloppy (a mismatched end tag closes what it encloses, unknown entities stay
//! as written) and strict where it matters: only `http` and `https` addresses
//! are kept for links, pictures and audio, and an item that the body ended in
//! the middle of (a fetch stops at a size or time limit, `fetch.rs`) is left
//! out, so a feed cut short still gives every item that closed before the cut.
//!
//! Text is kept plain: a description's HTML is turned into paragraphs of text
//! separated by a blank line, and never passed on as markup.

use ferrite_app::serde;

/// One element of the tree.
#[derive(Debug, Default)]
struct Element {
    /// The lower-case qualified name: `item`, `itunes:image`.
    name: String,
    attrs: Vec<(String, String)>,
    /// The element's content in document order: its own text (entities
    /// decoded, CDATA as written) and its children, by index.
    parts: Vec<Part>,
    children: Vec<Element>,
    /// The namespaces it declares: `(prefix, uri)`, `""` for the default.
    ns: Vec<(String, String)>,
    /// Whether an end tag (its own, or an enclosing element's) closed it.
    closed: bool,
}

/// A piece of an element's content.
#[derive(Debug)]
enum Part {
    Text(String),
    /// The child at this index of `children`.
    Child(usize),
}

/// The deepest element the tree keeps. Feeds nest a few levels; anything
/// deeper is read as the text of the element at this depth, so a hostile
/// feed cannot make the tree (built, walked and dropped recursively) as
/// deep as it likes.
const MAX_DEPTH: usize = 48;

impl Element {
    fn push_text(&mut self, text: &str) {
        if text.is_empty() {
            return;
        }
        match self.parts.last_mut() {
            Some(Part::Text(last)) => last.push_str(text),
            _ => self.parts.push(Part::Text(text.to_string())),
        }
    }

    fn push_child(&mut self, child: Element) {
        self.parts.push(Part::Child(self.children.len()));
        self.children.push(child);
    }

    fn child(&self, name: &str) -> Option<&Element> {
        self.children.iter().find(|c| c.name == name)
    }

    fn named<'a>(&'a self, name: &'a str) -> impl Iterator<Item = &'a Element> + 'a {
        self.children.iter().filter(move |c| c.name == name)
    }

    fn attr(&self, name: &str) -> Option<&str> {
        self.attrs
            .iter()
            .find(|(n, _)| n == name)
            .map(|(_, v)| v.as_str())
    }

    /// The trimmed text of the first child called `name` that has any (an
    /// RSS channel's Atom `<atom:link rel="self"/>` reads as `link` too, and
    /// has none). Atom's `type="xhtml"` text is markup inside the element: it
    /// is given back as HTML, for [`html_to_text`] and [`first_image`].
    fn text_of(&self, name: &str) -> Option<String> {
        self.named(name).find_map(|child| {
            let text = if child.attr("type") == Some("xhtml") {
                child.markup()
            } else {
                child.all_text()
            };
            Some(text).filter(|t| !t.is_empty())
        })
    }

    /// The element's text with its descendants', in document order, trimmed.
    fn all_text(&self) -> String {
        fn gather(element: &Element, out: &mut String) {
            for part in &element.parts {
                match part {
                    Part::Text(text) => out.push_str(text),
                    Part::Child(at) => gather(&element.children[*at], out),
                }
            }
        }
        let mut out = String::new();
        gather(self, &mut out);
        out.trim().to_string()
    }

    /// The element's content as HTML, in document order: text escaped, each
    /// child as a tag of its local name (an image keeps its `src`).
    fn markup(&self) -> String {
        fn escape(text: &str, out: &mut String) {
            for c in text.chars() {
                match c {
                    '&' => out.push_str("&amp;"),
                    '<' => out.push_str("&lt;"),
                    '>' => out.push_str("&gt;"),
                    '"' => out.push_str("&quot;"),
                    c => out.push(c),
                }
            }
        }
        fn render(element: &Element, out: &mut String) {
            for part in &element.parts {
                match part {
                    Part::Text(text) => escape(text, out),
                    Part::Child(at) => {
                        let child = &element.children[*at];
                        let local = child.name.rsplit(':').next().unwrap_or_default();
                        out.push('<');
                        out.push_str(local);
                        if let Some(src) = child.attr("src") {
                            out.push_str(" src=\"");
                            escape(src, out);
                            out.push('"');
                        }
                        out.push('>');
                        render(child, out);
                        out.push_str("</");
                        out.push_str(local);
                        out.push('>');
                    }
                }
            }
        }
        let mut out = String::new();
        render(self, &mut out);
        out.trim().to_string()
    }
}

/// A feed, as News and Podcasts answer it.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Default)]
#[serde(crate = "ferrite_app::serde", rename_all = "camelCase")]
pub struct Feed {
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub link: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    pub items: Vec<Item>,
}

/// One story or episode.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Default)]
#[serde(crate = "ferrite_app::serde", rename_all = "camelCase")]
pub struct Item {
    /// A plain id (16 hex digits) derived from the item's own id (its `guid`
    /// or Atom `id`, else its link, else its title), stable across fetches.
    pub id: String,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub link: Option<String>,
    /// Plain text, paragraphs separated by a blank line.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    /// Epoch milliseconds.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub published: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    /// The audio or video enclosure (Podcasts).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub audio: Option<Enclosure>,
    /// Seconds (`itunes:duration`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration: Option<u32>,
}

/// A media file an item points to.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Default)]
#[serde(crate = "ferrite_app::serde", rename_all = "camelCase")]
pub struct Enclosure {
    pub url: String,
    /// The MIME type the feed gives, or `audio/mpeg`.
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bytes: Option<u64>,
}

/// How much of a feed to keep.
#[derive(Debug, Clone, Copy)]
pub struct Limits {
    /// The most items kept, newest first as the feed lists them.
    pub items: usize,
    /// The most characters of an item's summary.
    pub summary_chars: usize,
}

/// The longest title kept, in characters.
const TITLE_CHARS: usize = 300;
/// The longest address kept, in bytes.
const URL_BYTES: usize = 2048;

/// Read a whole feed body. An error says the body is no RSS or Atom feed, or
/// is in an encoding this reader does not read.
#[cfg(test)]
pub fn parse(body: &[u8], limits: Limits) -> Result<Feed, String> {
    parse_received(body, false, limits)
}

/// Read a feed body as the fetch helper received it: `cut` says the helper
/// stopped before the body's end, so its last UTF-8 character may be
/// unfinished (see [`decode_body`]).
pub fn parse_received(body: &[u8], cut: bool, limits: Limits) -> Result<Feed, String> {
    let text = decode_body(body, cut)?;
    let document = tree(&text);
    let root = document
        .children
        .iter()
        .find(|c| matches!(c.name.as_str(), "rss" | "feed" | "rdf:rdf"))
        .ok_or_else(|| "the reply is not an RSS or Atom feed".to_string())?;
    if root.name == "feed" {
        return Ok(atom(root, limits));
    }
    let channel = root
        .child("channel")
        .ok_or_else(|| "the feed has no channel".to_string())?;
    // RSS 1.0 lists its items beside the channel, RSS 2.0 inside it.
    let holder = if root.name == "rdf:rdf" {
        root
    } else {
        channel
    };
    let items = holder
        .named("item")
        .filter(|item| item.closed)
        .take(limits.items)
        .map(|item| rss_item(item, limits))
        .filter(|item| !item.title.is_empty() || item.audio.is_some())
        .collect();
    Ok(Feed {
        title: clip(
            &channel
                .text_of("title")
                .map(|t| plain(&t))
                .unwrap_or_default(),
            TITLE_CHARS,
        ),
        link: channel.text_of("link").and_then(|l| web_url(&l)),
        description: channel
            .text_of("description")
            .or_else(|| channel.text_of("itunes:summary"))
            .map(|d| clip(&html_to_text(&d), limits.summary_chars))
            .filter(|d| !d.is_empty()),
        image: channel
            .child("itunes:image")
            .and_then(|i| i.attr("href"))
            .and_then(web_url)
            .or_else(|| {
                channel
                    .child("image")
                    .and_then(|i| i.text_of("url"))
                    .and_then(|u| web_url(&u))
            }),
        author: channel
            .text_of("itunes:author")
            .or_else(|| channel.text_of("dc:creator"))
            .or_else(|| {
                channel
                    .child("itunes:owner")
                    .and_then(|o| o.text_of("itunes:name"))
            })
            .map(|a| clip(&plain(&a), TITLE_CHARS)),
        items,
    })
}

fn rss_item(item: &Element, limits: Limits) -> Item {
    let title = item
        .text_of("title")
        .map(|t| clip(&plain(&t), TITLE_CHARS))
        .unwrap_or_default();
    let link = item.text_of("link").and_then(|l| web_url(&l)).or_else(|| {
        let guid = item.child("guid")?;
        if guid.attr("ispermalink") == Some("false") {
            return None;
        }
        web_url(&guid.all_text())
    });
    let body = item
        .text_of("content:encoded")
        .or_else(|| item.text_of("description"))
        .or_else(|| item.text_of("itunes:summary"))
        .unwrap_or_default();
    let enclosures: Vec<&Element> = item.named("enclosure").collect();
    let audio = enclosures.iter().find_map(|e| {
        let kind = e.attr("type").unwrap_or("audio/mpeg").to_ascii_lowercase();
        if !(kind.starts_with("audio/") || kind.starts_with("video/")) {
            return None;
        }
        Some(Enclosure {
            url: web_url(e.attr("url")?)?,
            kind,
            bytes: e
                .attr("length")
                .and_then(|l| l.trim().parse().ok())
                .filter(|b| *b > 0),
        })
    });
    let image = media_image(item)
        .or_else(|| {
            enclosures.iter().find_map(|e| {
                let kind = e.attr("type").unwrap_or("");
                if kind.starts_with("image/") {
                    web_url(e.attr("url")?)
                } else {
                    None
                }
            })
        })
        .or_else(|| first_image(&body));
    let own_id = item
        .text_of("guid")
        .or_else(|| link.clone())
        .or_else(|| audio.as_ref().map(|a| a.url.clone()))
        .unwrap_or_else(|| title.clone());
    Item {
        id: item_id(&own_id),
        title,
        link,
        summary: Some(clip(&html_to_text(&body), limits.summary_chars)).filter(|s| !s.is_empty()),
        published: item
            .text_of("pubdate")
            .or_else(|| item.text_of("dc:date"))
            .and_then(|d| parse_date(&d)),
        image,
        author: item
            .text_of("dc:creator")
            .or_else(|| item.text_of("author"))
            .or_else(|| item.text_of("itunes:author"))
            .map(|a| clip(&plain(&a), TITLE_CHARS)),
        audio,
        duration: item
            .text_of("itunes:duration")
            .and_then(|d| parse_duration(&d)),
    }
}

/// The text of a feed's body in the encoding it declares. Egress passes no
/// response headers, so the byte order mark and the XML declaration are all
/// there is to go on: UTF-8 (the default), US-ASCII, ISO-8859-1 and
/// Windows-1252 are read; any other encoding is refused rather than misread.
/// When `cut` says the fetch helper stopped before the body's end, a UTF-8
/// character left unfinished at that end is dropped (the cut item is dropped
/// anyway); a whole body gets no such allowance. Any byte that is not valid
/// in the declared encoding refuses the feed.
pub fn decode_body(body: &[u8], cut: bool) -> Result<String, String> {
    if body.starts_with(&[0xFE, 0xFF]) || body.starts_with(&[0xFF, 0xFE]) {
        return Err("the feed is in UTF-16, which this reader does not read".into());
    }
    let body = body.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(body);
    let encoding = declared_encoding(body)?.unwrap_or_else(|| "utf-8".into());
    match encoding.as_str() {
        "utf-8" | "utf8" => strict_utf8(body, cut),
        "us-ascii" | "ascii" => match body.iter().position(|b| !b.is_ascii()) {
            Some(at) => Err(format!(
                "the feed declares US-ASCII but byte {at} is not ASCII"
            )),
            None => Ok(body.iter().map(|&b| char::from(b)).collect()),
        },
        "iso-8859-1" | "iso_8859-1" | "latin1" | "latin-1" | "l1" => {
            Ok(body.iter().map(|&b| char::from(b)).collect())
        }
        "windows-1252" | "cp1252" => Ok(body.iter().map(|&b| windows_1252(b)).collect()),
        other => Err(format!(
            "the feed is in {other}, which this reader does not read"
        )),
    }
}

/// The longest XML declaration read, in bytes: far more than a real one
/// needs, whatever whitespace it holds.
const MAX_DECLARATION_BYTES: usize = 4096;

/// `body` as UTF-8, refusing any invalid byte. When the body was `cut`, a
/// character left unfinished at its very end is dropped.
fn strict_utf8(body: &[u8], cut: bool) -> Result<String, String> {
    match std::str::from_utf8(body) {
        Ok(text) => Ok(text.to_owned()),
        Err(error) if cut && error.error_len().is_none() => {
            Ok(String::from_utf8_lossy(&body[..error.valid_up_to()]).into_owned())
        }
        Err(error) => Err(format!(
            "the feed is not valid UTF-8 at byte {}",
            error.valid_up_to()
        )),
    }
}

/// The lower-case `encoding` of the XML declaration at the start of `body`:
/// `None` when there is no declaration or it names no encoding, an error
/// when a declaration is there but does not end within
/// [`MAX_DECLARATION_BYTES`] or names its encoding in a form not read.
fn declared_encoding(body: &[u8]) -> Result<Option<String>, String> {
    if !body.starts_with(b"<?xml") {
        return Ok(None);
    }
    let head = &body[..body.len().min(MAX_DECLARATION_BYTES)];
    let Some(end) = head.windows(2).position(|pair| pair == b"?>") else {
        return Err("the feed's XML declaration does not end".into());
    };
    // The declaration itself is ASCII in every encoding this reader reads.
    let declaration = String::from_utf8_lossy(&head[5..end]);
    let Some(at) = declaration.find("encoding") else {
        return Ok(None);
    };
    let value = (|| {
        let rest = declaration[at + "encoding".len()..]
            .trim_start()
            .strip_prefix('=')?
            .trim_start();
        let quote = rest.chars().next().filter(|q| *q == '"' || *q == '\'')?;
        let value = &rest[1..];
        Some(value[..value.find(quote)?].trim().to_ascii_lowercase())
    })();
    match value {
        Some(value) if !value.is_empty() => Ok(Some(value)),
        _ => Err("the feed's XML declaration names its encoding in a form not read".into()),
    }
}

/// The characters Windows-1252 puts at bytes 0x80 to 0x9F; the bytes it
/// leaves undefined read as the C1 control of the same number.
const WINDOWS_1252_HIGH: [u32; 32] = [
    0x20AC, 0x81, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021, 0x02C6, 0x2030, 0x0160, 0x2039,
    0x0152, 0x8D, 0x017D, 0x8F, 0x90, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014,
    0x02DC, 0x2122, 0x0161, 0x203A, 0x0153, 0x9D, 0x017E, 0x0178,
];

/// A Windows-1252 byte as a character: Latin-1, apart from 0x80 to 0x9F.
fn windows_1252(byte: u8) -> char {
    match byte {
        0x80..=0x9F => char::from_u32(WINDOWS_1252_HIGH[usize::from(byte - 0x80)])
            .unwrap_or(char::REPLACEMENT_CHARACTER),
        _ => char::from(byte),
    }
}

/// A picture an item names with Media RSS or the iTunes namespace: a
/// `media:content` that is an image (`medium="image"`, an `image/` type, or
/// neither given, as feeds commonly write pictures; never one whose medium or
/// type says video or audio), else a thumbnail, else the iTunes image.
fn media_image(item: &Element) -> Option<String> {
    let thumbnail = || {
        item.named("media:thumbnail")
            .find_map(|t| web_url(t.attr("url")?))
    };
    let content = || {
        let candidates = item.named("media:content").chain(
            item.named("media:group")
                .flat_map(|g| g.named("media:content")),
        );
        let mut best: Option<(u32, String)> = None;
        for c in candidates {
            let medium = c.attr("medium");
            let kind = c.attr("type");
            // A picture only when nothing it declares says otherwise: a
            // medium, when given, is `image`, and a type, when given, is an
            // image type.
            let is_image =
                medium.is_none_or(|m| m == "image") && kind.is_none_or(|t| t.starts_with("image/"));
            let Some(url) = c.attr("url").and_then(web_url) else {
                continue;
            };
            if !is_image {
                continue;
            }
            // Prefer a picture near 800 points wide: big enough for a lead, small to load.
            let width: u32 = c.attr("width").and_then(|w| w.parse().ok()).unwrap_or(600);
            let score = width.abs_diff(800);
            if best.as_ref().is_none_or(|(s, _)| score < *s) {
                best = Some((score, url));
            }
        }
        best.map(|(_, url)| url)
    };
    let itunes = || {
        item.child("itunes:image")
            .and_then(|i| web_url(i.attr("href")?))
    };
    content().or_else(thumbnail).or_else(itunes)
}

fn atom(feed: &Element, limits: Limits) -> Feed {
    let entries = feed
        .named("entry")
        .filter(|entry| entry.closed)
        .take(limits.items)
        .map(|entry| {
            let title = entry
                .text_of("title")
                .map(|t| clip(&plain(&t), TITLE_CHARS))
                .unwrap_or_default();
            let link = atom_link(entry);
            let body = entry
                .text_of("content")
                .or_else(|| entry.text_of("summary"))
                .unwrap_or_default();
            let audio = entry.named("link").find_map(|l| {
                if l.attr("rel") != Some("enclosure") {
                    return None;
                }
                Some(Enclosure {
                    url: web_url(l.attr("href")?)?,
                    kind: l.attr("type").unwrap_or("audio/mpeg").to_ascii_lowercase(),
                    bytes: l
                        .attr("length")
                        .and_then(|n| n.parse().ok())
                        .filter(|b| *b > 0),
                })
            });
            let own_id = entry
                .text_of("id")
                .or_else(|| link.clone())
                .unwrap_or_else(|| title.clone());
            Item {
                id: item_id(&own_id),
                title,
                link,
                summary: Some(clip(&html_to_text(&body), limits.summary_chars))
                    .filter(|s| !s.is_empty()),
                published: entry
                    .text_of("published")
                    .or_else(|| entry.text_of("updated"))
                    .and_then(|d| parse_date(&d)),
                image: media_image(entry).or_else(|| first_image(&body)),
                author: entry
                    .child("author")
                    .and_then(|a| a.text_of("name"))
                    .map(|a| clip(&plain(&a), TITLE_CHARS)),
                audio,
                duration: None,
            }
        })
        .filter(|item| !item.title.is_empty())
        .collect();
    Feed {
        title: clip(
            &feed.text_of("title").map(|t| plain(&t)).unwrap_or_default(),
            TITLE_CHARS,
        ),
        link: atom_link(feed),
        description: feed
            .text_of("subtitle")
            .map(|d| clip(&html_to_text(&d), limits.summary_chars)),
        image: feed
            .text_of("logo")
            .or_else(|| feed.text_of("icon"))
            .and_then(|u| web_url(&u)),
        author: feed
            .child("author")
            .and_then(|a| a.text_of("name"))
            .map(|a| clip(&plain(&a), TITLE_CHARS)),
        items: entries,
    }
}

/// An Atom element's page: its `alternate` link, or a link with no `rel`.
fn atom_link(element: &Element) -> Option<String> {
    element
        .named("link")
        .find(|l| matches!(l.attr("rel"), None | Some("alternate")))
        .and_then(|l| l.attr("href"))
        .and_then(web_url)
}

/// The plain id of an item: 16 hex digits of the SHA-256 of its own id.
pub fn item_id(own: &str) -> String {
    ferrite_app::crypto::hex(&ferrite_app::crypto::sha256(own.trim().as_bytes())[..8])
}

/// `url` when it is an absolute `http` or `https` address without spaces or
/// quotes, at most [`URL_BYTES`] long; protocol-relative `//host/...` reads as
/// `https:`.
pub fn web_url(url: &str) -> Option<String> {
    let url = url.trim();
    let url = if let Some(rest) = url.strip_prefix("//") {
        format!("https://{rest}")
    } else {
        url.to_string()
    };
    let lower = url.to_ascii_lowercase();
    let ok = (lower.starts_with("https://") || lower.starts_with("http://"))
        && url.len() <= URL_BYTES
        && url.len() > "https://".len()
        && !url
            .bytes()
            .any(|b| b <= b' ' || matches!(b, b'"' | b'<' | b'>' | b'\\' | b'`' | 0x7f));
    ok.then_some(url)
}

/// `text` cut to at most `chars` characters, ending with an ellipsis when cut.
pub fn clip(text: &str, chars: usize) -> String {
    if text.chars().count() <= chars {
        return text.to_string();
    }
    let mut out: String = text.chars().take(chars.saturating_sub(1)).collect();
    let trimmed = out.trim_end().len();
    out.truncate(trimmed);
    out.push('…');
    out
}

/// A title's text: any markup removed and spaces collapsed to one line.
fn plain(text: &str) -> String {
    html_to_text(text).replace("\n\n", " ")
}

// ---------------------------------------------------------------------------
// The element tree
// ---------------------------------------------------------------------------

fn tree(text: &str) -> Element {
    let mut stack: Vec<Element> = vec![Element {
        name: "#document".into(),
        ..Element::default()
    }];
    let len = text.len();
    let mut i = 0;
    // Start tags past `MAX_DEPTH`, not kept: their end tags are skipped too.
    let mut ignored: Vec<String> = Vec::new();
    while i < len {
        let rest = &text[i..];
        if !rest.starts_with('<') {
            let next = rest.find('<').map_or(len, |n| i + n);
            if let Some(top) = stack.last_mut() {
                top.push_text(&decode_entities(&text[i..next]));
            }
            i = next;
            continue;
        }
        if rest.starts_with("<!--") {
            i = rest.find("-->").map_or(len, |n| i + n + 3);
        } else if let Some(cdata) = rest.strip_prefix("<![CDATA[") {
            let end = cdata.find("]]>");
            if let Some(top) = stack.last_mut() {
                top.push_text(&cdata[..end.unwrap_or(cdata.len())]);
            }
            i = end.map_or(len, |n| i + 9 + n + 3);
        } else if rest.starts_with("<?") {
            i = rest.find("?>").map_or(len, |n| i + n + 2);
        } else if rest.starts_with("<!") {
            // A DOCTYPE, with any internal subset.
            let subset = rest.find('[');
            let close = rest.find('>');
            i = match (subset, close) {
                (Some(s), Some(c)) if s < c => rest.find("]>").map_or(len, |n| i + n + 2),
                (_, Some(c)) => i + c + 1,
                _ => len,
            };
        } else if let Some(end) = rest.strip_prefix("</") {
            let Some(close) = end.find('>') else { break };
            let raw = end[..close].trim().to_ascii_lowercase();
            i += 2 + close + 1;
            if ignored.last() == Some(&raw) {
                ignored.pop();
                continue;
            }
            // A kept element that closes closes whatever was opened inside it.
            ignored.clear();
            let name = resolve(&raw, &[], &stack);
            close_element(&mut stack, &name);
        } else {
            let Some(close) = tag_end(rest) else { break };
            let inner = &rest[1..close];
            let self_closing = inner.ends_with('/');
            let inner = inner.strip_suffix('/').unwrap_or(inner);
            let (raw, attrs) = start_tag(inner);
            i += close + 1;
            if raw.is_empty() {
                continue;
            }
            if stack.len() > MAX_DEPTH {
                if !self_closing {
                    ignored.push(raw);
                }
                continue;
            }
            // The namespaces this element declares, for itself and inside it.
            let ns: Vec<(String, String)> = attrs
                .iter()
                .filter_map(|(name, uri)| {
                    let prefix = if name == "xmlns" {
                        ""
                    } else {
                        name.strip_prefix("xmlns:")?
                    };
                    Some((prefix.to_string(), uri.trim().to_string()))
                })
                .collect();
            let element = Element {
                name: resolve(&raw, &ns, &stack),
                attrs,
                ns,
                closed: self_closing,
                ..Element::default()
            };
            if self_closing {
                if let Some(top) = stack.last_mut() {
                    top.push_child(element);
                }
            } else {
                stack.push(element);
            }
        }
    }
    // What the body ended inside stays unclosed.
    while stack.len() > 1 {
        let element = stack.pop().unwrap_or_default();
        if let Some(parent) = stack.last_mut() {
            parent.push_child(element);
        }
    }
    stack.pop().unwrap_or_default()
}

/// The prefix this reader names the elements of a namespace with, for the
/// namespaces it reads: Atom, RSS 1.0 and XHTML elements have none (`feed`,
/// `entry`, `item`), the others the prefix feeds conventionally give them.
fn canonical_prefix(uri: &str) -> Option<&'static str> {
    Some(match uri {
        "http://www.w3.org/2005/Atom"
        | "http://purl.org/rss/1.0/"
        | "http://www.w3.org/1999/xhtml"
        | "http://backend.userland.com/rss2" => "",
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#" => "rdf:",
        "http://www.itunes.com/dtds/podcast-1.0.dtd" => "itunes:",
        "http://search.yahoo.com/mrss/" | "http://search.yahoo.com/mrss" => "media:",
        "http://purl.org/rss/1.0/modules/content/" => "content:",
        "http://purl.org/dc/elements/1.1/" => "dc:",
        _ => return None,
    })
}

/// An element's name as this reader knows it: its namespace, found among the
/// declarations in scope (`own`, then the open elements', innermost first),
/// with that namespace's [`canonical_prefix`], so `<atom:entry>` under
/// `xmlns:atom="http://www.w3.org/2005/Atom"` reads as `entry` and an
/// `xmlns:m="http://search.yahoo.com/mrss/"` alias as `media:`. A prefix
/// that is not declared, or a namespace the reader does not know, keeps the
/// name as written (feeds often use `media:` without declaring it).
fn resolve(raw: &str, own: &[(String, String)], stack: &[Element]) -> String {
    let (prefix, local) = raw.split_once(':').unwrap_or(("", raw));
    let uri = own
        .iter()
        .chain(stack.iter().rev().flat_map(|element| element.ns.iter()))
        .find(|(declared, _)| declared == prefix)
        .map(|(_, uri)| uri.as_str());
    match uri.and_then(canonical_prefix) {
        Some(canonical) => format!("{canonical}{local}"),
        None => raw.to_string(),
    }
}

/// Close the innermost open element called `name`, and every element opened
/// inside it; an end tag that matches nothing open is ignored.
fn close_element(stack: &mut Vec<Element>, name: &str) {
    let Some(at) = stack.iter().skip(1).rposition(|e| e.name == name) else {
        return;
    };
    let at = at + 1;
    while stack.len() > at {
        let mut element = stack.pop().unwrap_or_default();
        element.closed = true;
        if let Some(parent) = stack.last_mut() {
            parent.push_child(element);
        }
    }
}

/// The index of the `>` that ends the tag `rest` starts with, outside quotes.
fn tag_end(rest: &str) -> Option<usize> {
    let mut quote: Option<u8> = None;
    for (at, b) in rest.bytes().enumerate().skip(1) {
        match (quote, b) {
            (Some(q), _) if b == q => quote = None,
            (Some(_), _) => {}
            (None, b'"' | b'\'') => quote = Some(b),
            (None, b'>') => return Some(at),
            _ => {}
        }
    }
    None
}

/// A start tag's lower-case name and attributes (names lower-case, values
/// decoded).
fn start_tag(inner: &str) -> (String, Vec<(String, String)>) {
    let inner = inner.trim();
    let name_end = inner
        .find(|c: char| c.is_ascii_whitespace())
        .unwrap_or(inner.len());
    let name = inner[..name_end].to_ascii_lowercase();
    let mut attrs = Vec::new();
    let mut rest = inner[name_end..].trim_start();
    while !rest.is_empty() {
        let key_end = rest
            .find(|c: char| c == '=' || c.is_ascii_whitespace())
            .unwrap_or(rest.len());
        let key = rest[..key_end].to_ascii_lowercase();
        rest = rest[key_end..].trim_start();
        let value = if let Some(after) = rest.strip_prefix('=') {
            let after = after.trim_start();
            match after.chars().next() {
                Some(q @ ('"' | '\'')) => {
                    let body = &after[1..];
                    let end = body.find(q).unwrap_or(body.len());
                    rest = body.get(end + 1..).unwrap_or("").trim_start();
                    decode_entities(&body[..end])
                }
                _ => {
                    let end = after
                        .find(|c: char| c.is_ascii_whitespace())
                        .unwrap_or(after.len());
                    rest = after[end..].trim_start();
                    decode_entities(&after[..end])
                }
            }
        } else {
            String::new()
        };
        if !key.is_empty() {
            attrs.push((key, value));
        } else {
            break;
        }
    }
    (name, attrs)
}

/// Decode XML's five entities, numeric references and the HTML entities
/// feeds commonly use; an unknown entity stays as written.
pub fn decode_entities(text: &str) -> String {
    if !text.contains('&') {
        return text.to_string();
    }
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(at) = rest.find('&') {
        out.push_str(&rest[..at]);
        rest = &rest[at..];
        // An entity is at most 12 bytes: look no further for its `;`, so a
        // body of bare ampersands is read in one pass.
        let end = rest.as_bytes()[1..]
            .iter()
            .take(12)
            .position(|b| *b == b';')
            .map(|n| n + 1);
        let decoded = end.and_then(|end| entity(&rest[1..end]).map(|c| (c, end)));
        match decoded {
            Some((c, end)) => {
                out.push(c);
                rest = &rest[end + 1..];
            }
            None => {
                out.push('&');
                rest = &rest[1..];
            }
        }
    }
    out.push_str(rest);
    out
}

fn entity(name: &str) -> Option<char> {
    if let Some(number) = name.strip_prefix('#') {
        let code = match number.strip_prefix(['x', 'X']) {
            Some(hex) => u32::from_str_radix(hex, 16).ok()?,
            None => number.parse().ok()?,
        };
        return char::from_u32(code).filter(|c| *c != '\0');
    }
    Some(match name {
        "amp" => '&',
        "lt" => '<',
        "gt" => '>',
        "quot" => '"',
        "apos" => '\'',
        "nbsp" => '\u{a0}',
        "mdash" => '—',
        "ndash" => '–',
        "hellip" => '…',
        "lsquo" => '‘',
        "rsquo" => '’',
        "ldquo" => '“',
        "rdquo" => '”',
        "laquo" => '«',
        "raquo" => '»',
        "bull" => '•',
        "middot" => '·',
        "copy" => '©',
        "reg" => '®',
        "trade" => '™',
        "deg" => '°',
        "times" => '×',
        "pound" => '£',
        "euro" => '€',
        "cent" => '¢',
        "yen" => '¥',
        "sect" => '§',
        "para" => '¶',
        "shy" => '\u{ad}',
        "eacute" => 'é',
        "egrave" => 'è',
        "ecirc" => 'ê',
        "aacute" => 'á',
        "agrave" => 'à',
        "acirc" => 'â',
        "iacute" => 'í',
        "oacute" => 'ó',
        "uacute" => 'ú',
        "auml" => 'ä',
        "ouml" => 'ö',
        "uuml" => 'ü',
        "szlig" => 'ß',
        "ccedil" => 'ç',
        "ntilde" => 'ñ',
        _ => return None,
    })
}

// ---------------------------------------------------------------------------
// HTML to text
// ---------------------------------------------------------------------------

/// Elements inside a run of text: removing their tags adds no space, so
/// `<b>w</b>orld` reads as `world`.
const INLINE: &[&str] = &[
    "a", "abbr", "b", "bdi", "bdo", "cite", "code", "data", "dfn", "em", "font", "i", "kbd",
    "mark", "q", "s", "samp", "small", "span", "strong", "sub", "sup", "time", "tt", "u", "var",
    "wbr",
];

/// Elements whose end starts a new paragraph.
const BLOCKS: &[&str] = &[
    "p",
    "div",
    "br",
    "li",
    "ul",
    "ol",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "figure",
    "figcaption",
    "table",
    "tr",
    "section",
    "article",
    "hr",
    "pre",
];

/// Plain text of an HTML fragment: tags removed (and the contents of
/// `script`, `style` and `iframe`), entities decoded, each paragraph on one
/// line, paragraphs separated by a blank line.
pub fn html_to_text(html: &str) -> String {
    let mut text = String::with_capacity(html.len());
    let lower = html.to_ascii_lowercase();
    let mut i = 0;
    while i < html.len() {
        let Some(at) = html[i..].find('<').map(|n| i + n) else {
            text.push_str(&html[i..]);
            break;
        };
        text.push_str(&html[i..at]);
        let Some(close) = tag_end(&html[at..]).map(|n| at + n) else {
            break;
        };
        let inner = &lower[at + 1..close];
        let name: String = inner
            .trim_start_matches('/')
            .chars()
            .take_while(|c| c.is_ascii_alphanumeric())
            .collect();
        i = close + 1;
        if !inner.starts_with('/') && matches!(name.as_str(), "script" | "style" | "iframe") {
            let end = format!("</{name}");
            i = lower[i..].find(&end).map_or(html.len(), |n| {
                let after = i + n;
                lower[after..]
                    .find('>')
                    .map_or(html.len(), |m| after + m + 1)
            });
            continue;
        }
        if BLOCKS.contains(&name.as_str()) {
            text.push_str("\n\n");
        } else if !INLINE.contains(&name.as_str()) {
            text.push(' ');
        }
    }
    let decoded = decode_entities(&text);
    let mut paragraphs: Vec<String> = Vec::new();
    for block in decoded.split("\n\n") {
        let line = block.split_whitespace().collect::<Vec<_>>().join(" ");
        let line = line
            .replace(" ,", ",")
            .replace(" .", ".")
            .replace("( ", "(")
            .replace(" )", ")");
        if !line.is_empty() {
            paragraphs.push(line);
        }
    }
    paragraphs.join("\n\n")
}

/// The first `<img src>` of an HTML fragment, when it is a web address.
pub fn first_image(html: &str) -> Option<String> {
    let lower = html.to_ascii_lowercase();
    let mut from = 0;
    while let Some(at) = lower[from..].find("<img").map(|n| from + n) {
        let close = tag_end(&html[at..]).map(|n| at + n)?;
        let (_, attrs) = start_tag(html[at + 1..close].trim_end_matches('/'));
        if let Some(url) = attrs
            .iter()
            .find(|(n, _)| n == "src")
            .and_then(|(_, v)| web_url(v))
        {
            // Tracking pixels are one point square.
            let tiny = attrs
                .iter()
                .any(|(n, v)| (n == "width" || n == "height") && v.trim() == "1");
            if !tiny {
                return Some(url);
            }
        }
        from = close;
    }
    None
}

// ---------------------------------------------------------------------------
// Dates and durations
// ---------------------------------------------------------------------------

/// Epoch milliseconds of an RFC 822 / RFC 2822 date (RSS `pubDate`) or an
/// RFC 3339 / ISO 8601 date (Atom, `dc:date`).
pub fn parse_date(text: &str) -> Option<u64> {
    let text = text.trim();
    if text.as_bytes().first().is_some_and(u8::is_ascii_digit) && text.get(4..5) == Some("-") {
        return parse_iso(text);
    }
    parse_rfc822(text)
}

/// `count` ASCII digits at `at` of `text`, as a number.
fn digits(text: &str, at: usize, count: usize) -> Option<i64> {
    let field = text.get(at..at + count)?;
    if !field.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    field.parse().ok()
}

/// `YYYY-MM-DD`, optionally followed by `T` (or a space) and `hh:mm`, `:ss`,
/// a fraction `.d+` and a zone; any other character refuses the date.
fn parse_iso(text: &str) -> Option<u64> {
    let bytes = text.as_bytes();
    if bytes.get(4) != Some(&b'-') || bytes.get(7) != Some(&b'-') {
        return None;
    }
    let year = digits(text, 0, 4)?;
    let month = u32::try_from(digits(text, 5, 2)?).ok()?;
    let day = u32::try_from(digits(text, 8, 2)?).ok()?;
    let (mut hour, mut minute, mut second, mut offset) = (0, 0, 0i64, 0i64);
    if text.len() > 10 {
        if !matches!(bytes[10], b'T' | b't' | b' ') {
            return None;
        }
        let time = &text[11..];
        if time.as_bytes().get(2) != Some(&b':') {
            return None;
        }
        hour = digits(time, 0, 2)?;
        minute = digits(time, 3, 2)?;
        let mut rest = &time[5..];
        if let Some(s) = rest.strip_prefix(':') {
            second = digits(s, 0, 2)?;
            rest = &s[2..];
            if let Some(fraction) = rest.strip_prefix('.') {
                let length = fraction.bytes().take_while(u8::is_ascii_digit).count();
                if length == 0 {
                    return None;
                }
                rest = &fraction[length..];
            }
        }
        offset = iso_zone(rest)?;
    }
    epoch_ms(year, month, day, hour, minute, second, offset)
}

/// `count` ASCII digits making up all of `text`, as a number.
fn exactly(text: &str, count: usize) -> Option<i64> {
    if text.len() != count {
        return None;
    }
    digits(text, 0, count)
}

/// An RFC 2822 date: `[Day,] D Mon YYYY hh:mm[:ss] [zone]`, nothing more.
/// The day of the week, when given, is one of the seven names; the month is
/// its three-letter or full English name; the year has four digits; each
/// time field has two; the zone is one [`rfc_zone`] reads. Anything else
/// refuses the date.
fn parse_rfc822(text: &str) -> Option<u64> {
    const WEEKDAYS: [&str; 7] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    let text = match text.split_once(',') {
        Some((weekday, rest)) => {
            if !WEEKDAYS.contains(&weekday.trim().to_ascii_lowercase().as_str()) {
                return None;
            }
            rest
        }
        None => text,
    };
    let parts: Vec<&str> = text.split_whitespace().collect();
    if !(4..=5).contains(&parts.len()) {
        return None;
    }
    let day = match parts[0].len() {
        1 | 2 => u32::try_from(exactly(parts[0], parts[0].len())?).ok()?,
        _ => return None,
    };
    let month = month_number(parts[1])?;
    let year = exactly(parts[2], 4)?;
    let time: Vec<&str> = parts[3].split(':').collect();
    let (hour, minute, second) = match time.as_slice() {
        [h, m] => (exactly(h, 2)?, exactly(m, 2)?, 0),
        [h, m, s] => (exactly(h, 2)?, exactly(m, 2)?, exactly(s, 2)?),
        _ => return None,
    };
    let offset = match parts.get(4) {
        Some(zone) => rfc_zone(zone)?,
        None => 0,
    };
    epoch_ms(year, month, day, hour, minute, second, offset)
}

/// A month's three-letter or full English name, in any case.
fn month_number(name: &str) -> Option<u32> {
    const MONTHS: [&str; 12] = [
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december",
    ];
    let lower = name.to_ascii_lowercase();
    MONTHS
        .iter()
        .position(|m| lower == *m || (lower.len() == 3 && m.starts_with(lower.as_str())))
        .map(|p| p as u32 + 1)
}

/// `+hhmm` or `-hhmm` with exactly four digits (or, with `colon`, also
/// `+hh:mm`), hours 0 to 23 and minutes 0 to 59, as seconds east of UTC.
fn numeric_zone(zone: &str, colon: bool) -> Option<i64> {
    let sign = match zone.as_bytes().first()? {
        b'+' => 1,
        b'-' => -1,
        _ => return None,
    };
    let rest = &zone[1..];
    let (h, m) = match rest.len() {
        4 => (exactly(rest.get(0..2)?, 2)?, exactly(rest.get(2..4)?, 2)?),
        5 if colon && rest.as_bytes()[2] == b':' => {
            (exactly(rest.get(0..2)?, 2)?, exactly(rest.get(3..5)?, 2)?)
        }
        _ => return None,
    };
    if h > 23 || m > 59 {
        return None;
    }
    Some(sign * (h * 3600 + m * 60))
}

/// An RFC 2822 zone: `+hhmm`, `GMT`, `UT`, `UTC`, `Z` or a North American
/// name; any other name is refused.
fn rfc_zone(zone: &str) -> Option<i64> {
    let hours = |h: i64| Some(h * 3600);
    match zone.to_ascii_uppercase().as_str() {
        "Z" | "GMT" | "UT" | "UTC" => Some(0),
        "EST" => hours(-5),
        "EDT" => hours(-4),
        "CST" => hours(-6),
        "CDT" => hours(-5),
        "MST" => hours(-7),
        "MDT" => hours(-6),
        "PST" => hours(-8),
        "PDT" => hours(-7),
        _ => numeric_zone(zone, false),
    }
}

/// An ISO 8601 zone: nothing (UTC), `Z`, `+hh:mm` or `+hhmm`.
fn iso_zone(zone: &str) -> Option<i64> {
    match zone {
        "" | "Z" | "z" => Some(0),
        _ => numeric_zone(zone, true),
    }
}

/// The days of `month` in `year`.
fn days_in_month(year: i64, month: u32) -> u32 {
    match month {
        2 if (year % 4 == 0 && year % 100 != 0) || year % 400 == 0 => 29,
        2 => 28,
        4 | 6 | 9 | 11 => 30,
        _ => 31,
    }
}

/// Epoch milliseconds of a civil date and time at `offset` seconds east of
/// UTC, or `None` for a date out of range or before 1970.
fn epoch_ms(
    year: i64,
    month: u32,
    day: u32,
    hour: i64,
    minute: i64,
    second: i64,
    offset: i64,
) -> Option<u64> {
    if !(1970..=9999).contains(&year)
        || !(1..=12).contains(&month)
        || day < 1
        || day > days_in_month(year, month)
        || !(0..=23).contains(&hour)
        || !(0..=59).contains(&minute)
        || !(0..=59).contains(&second)
        || !(-86_400..=86_400).contains(&offset)
    {
        return None;
    }
    // Days from 1970-01-01 (Howard Hinnant's days_from_civil).
    let y = if month <= 2 { year - 1 } else { year };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let m = i64::from(month);
    let doy = (153 * (if m > 2 { m - 3 } else { m + 9 }) + 2) / 5 + i64::from(day) - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = era * 146_097 + doe - 719_468;
    let seconds = days * 86_400 + hour * 3600 + minute * 60 + second - offset;
    u64::try_from(seconds).ok().map(|s| s * 1000)
}

/// Seconds of an `itunes:duration`: `ss`, `mm:ss` or `hh:mm:ss`.
pub fn parse_duration(text: &str) -> Option<u32> {
    let mut total: u32 = 0;
    let fields: Vec<&str> = text.trim().split(':').collect();
    if fields.is_empty() || fields.len() > 3 {
        return None;
    }
    for field in fields {
        let value: f64 = field.trim().parse().ok()?;
        if !(0.0..1e7).contains(&value) {
            return None;
        }
        total = total.checked_mul(60)?.checked_add(value as u32)?;
    }
    (total > 0).then_some(total)
}

#[cfg(test)]
mod tests {
    use super::*;

    const LIMITS: Limits = Limits {
        items: 50,
        summary_chars: 500,
    };

    const RSS: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<!-- a comment -->
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title><![CDATA[BBC News & more]]></title>
  <link>https://www.bbc.co.uk/news</link>
  <description>The latest stories</description>
  <image><url>https://news.bbcimg.co.uk/nol/shared/img/bbc_news_120x60.gif</url></image>
  <item>
    <title><![CDATA[Bridge &amp; tunnel reopen]]></title>
    <description><![CDATA[<p>The <b>bridge</b> reopened&nbsp;today.</p><p>Second paragraph.</p><img src="https://example.com/pixel.gif" width="1" height="1">]]></description>
    <link>https://www.bbc.co.uk/news/articles/c1</link>
    <guid isPermaLink="false">https://www.bbc.co.uk/news/articles/c1#0</guid>
    <pubDate>Tue, 14 Oct 2026 10:30:00 GMT</pubDate>
    <media:thumbnail width="240" height="135" url="https://ichef.bbci.co.uk/240/a.jpg"/>
  </item>
  <item>
    <title>An episode</title>
    <description>Show notes &lt;a href="https://x.example"&gt;link&lt;/a&gt;</description>
    <enclosure url="https://cdn.example/ep.mp3" length="1234" type="audio/mpeg"/>
    <itunes:duration>1:02:03</itunes:duration>
    <itunes:image href="https://cdn.example/ep.jpg"/>
    <guid>ep-42</guid>
    <pubDate>Mon, 13 Oct 2026 08:00:00 -0400</pubDate>
    <dc:creator>Jane Doe</dc:creator>
  </item>
  <item>
    <title>javascript link</title>
    <link>javascript:alert(1)</link>
    <media:content url="https://img.example/large.jpg" medium="image" width="1024"/>
    <media:content url="https://img.example/mid.jpg" medium="image" width="800"/>
  </item>
  <item>
    <title>Cut short</title>
    <description>this item never clo"#;

    #[test]
    fn rss_two_reads_with_its_namespaces_and_a_cut_body() {
        let feed = parse(RSS.as_bytes(), LIMITS).unwrap();
        assert_eq!(feed.title, "BBC News & more");
        assert_eq!(feed.link.as_deref(), Some("https://www.bbc.co.uk/news"));
        assert_eq!(feed.description.as_deref(), Some("The latest stories"));
        assert!(feed.image.as_deref().unwrap().ends_with("120x60.gif"));
        assert_eq!(feed.items.len(), 3, "the unclosed last item is left out");

        let first = &feed.items[0];
        assert_eq!(first.title, "Bridge & tunnel reopen");
        assert_eq!(
            first.summary.as_deref(),
            Some("The bridge reopened today.\n\nSecond paragraph.")
        );
        assert_eq!(
            first.link.as_deref(),
            Some("https://www.bbc.co.uk/news/articles/c1")
        );
        assert_eq!(
            first.image.as_deref(),
            Some("https://ichef.bbci.co.uk/240/a.jpg")
        );
        assert_eq!(first.published, Some(1_791_973_800_000));
        assert_eq!(
            first.id,
            item_id("https://www.bbc.co.uk/news/articles/c1#0")
        );
        assert_eq!(first.id.len(), 16);

        let episode = &feed.items[1];
        let audio = episode.audio.as_ref().unwrap();
        assert_eq!(audio.url, "https://cdn.example/ep.mp3");
        assert_eq!(audio.bytes, Some(1234));
        assert_eq!(episode.duration, Some(3723));
        assert_eq!(episode.image.as_deref(), Some("https://cdn.example/ep.jpg"));
        assert_eq!(episode.author.as_deref(), Some("Jane Doe"));
        assert_eq!(episode.summary.as_deref(), Some("Show notes link"));
        // 08:00 at -04:00 is 12:00 UTC.
        assert_eq!(episode.published, Some(1_791_892_800_000));
        assert_eq!(
            episode.link, None,
            "a guid that is no address is not a link"
        );

        let third = &feed.items[2];
        assert_eq!(third.link, None, "only web addresses are links");
        assert_eq!(third.image.as_deref(), Some("https://img.example/mid.jpg"));
    }

    #[test]
    fn atom_reads_links_dates_and_authors() {
        let atom = r#"<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title type="text">Standard Ebooks - New Releases</title>
  <link href="https://standardebooks.org" rel="alternate"/>
  <link href="https://standardebooks.org/feeds/atom" rel="self"/>
  <subtitle>Free and liberated ebooks</subtitle>
  <entry>
    <id>https://standardebooks.org/ebooks/jane-austen/emma</id>
    <title>Emma</title>
    <author><name>Jane Austen</name></author>
    <published>2026-10-01T12:00:00.5+02:00</published>
    <updated>2026-10-02T00:00:00Z</updated>
    <link href="https://standardebooks.org/ebooks/jane-austen/emma" rel="alternate"/>
    <summary type="html">&lt;p&gt;A novel.&lt;/p&gt;</summary>
    <content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml"><p>Inline</p></div></content>
  </entry>
</feed>"#;
        let feed = parse(atom.as_bytes(), LIMITS).unwrap();
        assert_eq!(feed.title, "Standard Ebooks - New Releases");
        assert_eq!(feed.link.as_deref(), Some("https://standardebooks.org"));
        assert_eq!(
            feed.description.as_deref(),
            Some("Free and liberated ebooks")
        );
        let entry = &feed.items[0];
        assert_eq!(entry.title, "Emma");
        assert_eq!(entry.author.as_deref(), Some("Jane Austen"));
        assert_eq!(
            entry.link.as_deref(),
            Some("https://standardebooks.org/ebooks/jane-austen/emma")
        );
        assert_eq!(entry.summary.as_deref(), Some("Inline"));
        assert_eq!(entry.published, Some(1_790_848_800_000));
    }

    #[test]
    fn xhtml_content_keeps_its_order_and_paragraphs() {
        let atom = r#"<feed xmlns="http://www.w3.org/2005/Atom"><title>T</title>
<entry><id>a</id><title type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml">A <i>b</i> c</div></title>
<content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml"><p>Hello <b>world</b> today &amp; &lt;then&gt;</p><p>Second <img src="https://img.example/p.jpg"/> one</p></div></content>
</entry></feed>"#;
        let feed = parse(atom.as_bytes(), LIMITS).unwrap();
        let entry = &feed.items[0];
        assert_eq!(entry.title, "A b c");
        assert_eq!(
            entry.summary.as_deref(),
            Some("Hello world today & <then>\n\nSecond one")
        );
        assert_eq!(entry.image.as_deref(), Some("https://img.example/p.jpg"));
        let rss = "<rss><channel><title>Mixed <b>bold</b> end</title></channel></rss>";
        assert_eq!(
            parse(rss.as_bytes(), LIMITS).unwrap().title,
            "Mixed bold end"
        );
    }

    #[test]
    fn a_deeply_nested_feed_is_read_without_growing_the_tree() {
        let depth = 100_000;
        let mut body =
            String::from("<rss><channel><title>Deep</title><item><title>One</title><description>");
        body.push_str(&"<x>".repeat(depth));
        body.push_str("text");
        body.push_str(&"</x>".repeat(depth));
        body.push_str("</description></item><item><title>Two</title></item></channel></rss>");
        let feed = parse(body.as_bytes(), LIMITS).unwrap();
        assert_eq!(feed.title, "Deep");
        let titles: Vec<&str> = feed.items.iter().map(|i| i.title.as_str()).collect();
        assert_eq!(titles, ["One", "Two"]);
        assert_eq!(feed.items[0].summary.as_deref(), Some("text"));
        // Unclosed, too: nothing past the depth limit is kept.
        let open = format!("<rss><channel><title>Open</title>{}", "<x>".repeat(depth));
        assert_eq!(parse(open.as_bytes(), LIMITS).unwrap().title, "Open");
    }

    #[test]
    fn namespaces_are_read_by_their_uri_not_their_prefix() {
        let atom = r#"<a:feed xmlns:a="http://www.w3.org/2005/Atom" xmlns:m="http://search.yahoo.com/mrss/">
<a:title>Prefixed</a:title><a:link href="https://site.example/"/>
<a:entry><a:id>x</a:id><a:title>One</a:title><a:link href="https://site.example/1"/>
<m:thumbnail url="https://img.example/1.jpg"/></a:entry></a:feed>"#;
        let feed = parse(atom.as_bytes(), LIMITS).unwrap();
        assert_eq!(feed.title, "Prefixed");
        assert_eq!(feed.link.as_deref(), Some("https://site.example/"));
        assert_eq!(
            feed.items[0].link.as_deref(),
            Some("https://site.example/1")
        );
        assert_eq!(
            feed.items[0].image.as_deref(),
            Some("https://img.example/1.jpg")
        );

        let rdf = r#"<r:RDF xmlns:r="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:d="http://purl.org/dc/elements/1.1/">
<channel><title>Aliased</title></channel>
<item><title>Paper</title><d:date>2026-10-14</d:date></item></r:RDF>"#;
        let feed = parse(rdf.as_bytes(), LIMITS).unwrap();
        assert_eq!(feed.title, "Aliased");
        assert_eq!(feed.items[0].published, Some(1_791_936_000_000));

        // An RSS channel's Atom self link does not hide its own link.
        let rss = r#"<rss xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>T</title>
<atom:link href="https://feeds.example/rss" rel="self"/><link>https://site.example/</link>
<item><title>I</title><link>https://site.example/i</link></item></channel></rss>"#;
        let feed = parse(rss.as_bytes(), LIMITS).unwrap();
        assert_eq!(feed.link.as_deref(), Some("https://site.example/"));
        assert_eq!(
            feed.items[0].link.as_deref(),
            Some("https://site.example/i")
        );
    }

    #[test]
    fn the_declared_encoding_is_honoured_or_refused() {
        let mut latin1 =
            b"<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?><rss><channel><title>Caf".to_vec();
        latin1.push(0xE9);
        latin1.extend_from_slice(b"</title></channel></rss>");
        assert_eq!(parse(&latin1, LIMITS).unwrap().title, "Café");

        let mut cp1252 =
            b"<?xml version='1.0' encoding='windows-1252'?><rss><channel><title>".to_vec();
        cp1252.extend_from_slice(&[0x93, b'Q', 0x94, b' ', 0x97, b' ', 0x80, b'5']);
        cp1252.extend_from_slice(b"</title></channel></rss>");
        assert_eq!(parse(&cp1252, LIMITS).unwrap().title, "“Q” — €5");

        let mut bom = vec![0xEF, 0xBB, 0xBF];
        bom.extend_from_slice("<rss><channel><title>Grüße</title></channel></rss>".as_bytes());
        assert_eq!(parse(&bom, LIMITS).unwrap().title, "Grüße");

        let shift_jis = b"<?xml version=\"1.0\" encoding=\"Shift_JIS\"?><rss><channel><title>x</title></channel></rss>";
        let refused = parse(shift_jis, LIMITS).unwrap_err();
        assert!(refused.contains("shift_jis"), "{refused}");
        assert!(parse(&[0xFF, 0xFE, b'<', 0], LIMITS)
            .unwrap_err()
            .contains("UTF-16"));

        // A declaration padded past 256 bytes is still read, not taken for UTF-8.
        let mut padded = format!(
            "<?xml version=\"1.0\"{}encoding=\"ISO-8859-1\"?>",
            " ".repeat(400)
        )
        .into_bytes();
        padded.extend_from_slice(b"<rss><channel><title>Caf");
        padded.push(0xE9);
        padded.extend_from_slice(b"</title></channel></rss>");
        assert_eq!(parse(&padded, LIMITS).unwrap().title, "Café");
        let padded_unread = format!(
            "<?xml version=\"1.0\"{}encoding=\"Big5\"?><rss><channel><title>x</title></channel></rss>",
            " ".repeat(400)
        );
        assert!(parse(padded_unread.as_bytes(), LIMITS).is_err());
        let endless = format!("<?xml version=\"1.0\"{}", " ".repeat(5000));
        assert!(
            parse(endless.as_bytes(), LIMITS).is_err(),
            "a declaration that does not end"
        );
        let unquoted =
            b"<?xml version='1.0' encoding=latin1?><rss><channel><title>x</title></channel></rss>";
        assert!(parse(unquoted, LIMITS).is_err(), "an unquoted encoding");

        // A byte that is not valid in the declared encoding refuses the feed,
        // except a UTF-8 character left unfinished where the body was cut.
        let mut bad_utf8 =
            b"<?xml version=\"1.0\" encoding=\"UTF-8\"?><rss><channel><title>Caf".to_vec();
        bad_utf8.push(0xE9);
        bad_utf8.extend_from_slice(b"</title></channel></rss>");
        assert!(parse(&bad_utf8, LIMITS).unwrap_err().contains("UTF-8"));
        let mut undeclared_bad = b"<rss><channel><title>Caf".to_vec();
        undeclared_bad.push(0xE9);
        undeclared_bad.extend_from_slice(b"</title></channel></rss>");
        assert!(parse(&undeclared_bad, LIMITS).is_err());
        let ascii = "<?xml version='1.0' encoding='us-ascii'?><rss><channel><title>Café</title></channel></rss>";
        assert!(parse(ascii.as_bytes(), LIMITS)
            .unwrap_err()
            .contains("US-ASCII"));
        let mut cut = "<rss><channel><title>Grüße</title></channel></rss><!-- é"
            .as_bytes()
            .to_vec();
        cut.pop();
        assert_eq!(parse_received(&cut, true, LIMITS).unwrap().title, "Grüße");
        assert!(
            parse(&cut, LIMITS).is_err(),
            "a whole body that ends inside a character is refused"
        );
        assert!(parse_received(&cut, false, LIMITS).is_err());
    }

    #[test]
    fn a_video_is_not_taken_for_a_picture() {
        let rss = r#"<rss xmlns:media="http://search.yahoo.com/mrss/"><channel><title>T</title>
<item><title>Clip</title><media:content url="https://v.example/clip.mp4" medium="video" width="800"/>
<media:content url="https://v.example/clip.webm" type="video/webm"/></item>
<item><title>Photo</title><media:content url="https://v.example/p.jpg" width="800"/></item>
<item><title>Contradictory</title><media:content url="https://v.example/a.jpg" medium="video" type="image/jpeg"/>
<media:content url="https://v.example/b.mp4" medium="image" type="video/mp4"/></item>
</channel></rss>"#;
        let feed = parse(rss.as_bytes(), LIMITS).unwrap();
        assert_eq!(feed.items[0].image, None);
        assert_eq!(
            feed.items[1].image.as_deref(),
            Some("https://v.example/p.jpg")
        );
        assert_eq!(
            feed.items[2].image, None,
            "a declared video is never a picture"
        );
    }

    #[test]
    fn rss_one_lists_items_beside_the_channel() {
        let rdf = r#"<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/">
<channel><title>Nature</title><link>https://www.nature.com</link></channel>
<item><title>A paper</title><link>https://www.nature.com/articles/x</link><dc:date>2026-10-14</dc:date></item>
</rdf:RDF>"#;
        let feed = parse(rdf.as_bytes(), LIMITS).unwrap();
        assert_eq!(feed.title, "Nature");
        assert_eq!(feed.items.len(), 1);
        assert_eq!(feed.items[0].published, Some(1_791_936_000_000));
    }

    #[test]
    fn what_is_not_a_feed_is_refused() {
        assert!(parse(b"<html><body>Moved</body></html>", LIMITS).is_err());
        assert!(parse(b"", LIMITS).is_err());
        assert!(parse(b"{\"json\": true}", LIMITS).is_err());
    }

    #[test]
    fn limits_cut_items_and_summaries() {
        let feed = parse(
            RSS.as_bytes(),
            Limits {
                items: 1,
                summary_chars: 10,
            },
        )
        .unwrap();
        assert_eq!(feed.items.len(), 1);
        assert_eq!(feed.items[0].summary.as_deref(), Some("The bridg…"));
    }

    #[test]
    fn dates_in_both_forms() {
        assert_eq!(parse_date("Thu, 01 Jan 1970 00:00:00 GMT"), Some(0));
        assert_eq!(parse_date("1 Jan 1970 01:00 +0100"), Some(0));
        assert_eq!(
            parse_date("Wed, 15 Oct 2026 01:00:00 PDT"),
            parse_date("2026-10-15T08:00:00Z")
        );
        assert_eq!(
            parse_date("2026-10-15T10:00:00+02:00"),
            parse_date("2026-10-15T08:00:00Z")
        );
        assert_eq!(parse_date("2000-02-29T00:00:00Z"), Some(951_782_400_000));
        assert_eq!(parse_date("yesterday"), None);
        assert_eq!(parse_date("1960-01-01T00:00:00Z"), None);
        // A publisher's extreme or negative fields give no date, never an overflow.
        assert_eq!(
            parse_date("Tue, 14 Oct 9223372036854775807 10:00:00 GMT"),
            None
        );
        assert_eq!(
            parse_date("Tue, 14 Oct 2026 9223372036854775807:00:00 GMT"),
            None
        );
        assert_eq!(parse_date("Tue, 14 Oct 2026 -5:-3:00 GMT"), None);
        assert_eq!(
            parse_date("Tue, 14 Oct 2026 10:00:00 +9959"),
            None,
            "an offset over a day"
        );
        assert_eq!(
            parse_date("Tue, 31 Feb 2026 10:00:00 GMT"),
            None,
            "February 31"
        );
        assert_eq!(parse_date("2025-02-29T00:00:00Z"), None, "not a leap year");
        assert_eq!(parse_date("Tue, 14 Oct 2026 24:59:00 GMT"), None);
        assert_eq!(parse_date("Tue, 14 Oct 2026 24:00:00 GMT"), None, "hour 24");
        assert_eq!(parse_date("14 Oct 2026 24:00 GMT"), None, "hour 24");
        assert_eq!(parse_date("2026-10-14T12:34:60Z"), None, "second 60");
        assert_eq!(
            parse_date("Tue, 14 Oct 2026 10:00:00 +0060"),
            None,
            "60 minutes"
        );
        assert_eq!(
            parse_date("Tue, 14 Oct 2026 10:00:xx GMT"),
            None,
            "bad seconds"
        );
        assert_eq!(parse_date("2026-10X14T10X00:00Z"), None, "bad separators");
        assert_eq!(parse_date("2026-10-14T10:00:00123Z"), None, "stray digits");
        assert_eq!(
            parse_date("2026-10-14T10:00:00.Z"),
            None,
            "an empty fraction"
        );
        assert_eq!(
            parse_date("2026-10-14 10:00:00.250+00:00"),
            parse_date("2026-10-14T10:00:00Z")
        );
        assert_eq!(
            parse_date("Tue, 14 Oct 2026 10:00:00 +ab"),
            None,
            "bad zone"
        );
        assert_eq!(
            parse_date("Tue, 14 Oct 2026 10:00:00 BST"),
            None,
            "a zone name it does not know"
        );
        assert_eq!(
            parse_date("Tue, 14 Oct 2026 10:00 +0130"),
            parse_date("2026-10-14T08:30:00Z")
        );
        assert_eq!(
            parse_date("14 October 2026 10:00 GMT"),
            parse_date("2026-10-14T10:00:00Z"),
            "a full month name, no weekday"
        );
        for malformed in [
            "Tue, 14 Oct 2026 10:00:00 GMT trailing",
            "Tue, 14 Oct -1 10:00:00 GMT",
            "Tue, 14 Oct 26 10:00:00 GMT",
            "Tue, 14 OctoberGarbage 2026 10:00:00 GMT",
            "Someday, 14 Oct 2026 10:00:00 GMT",
            "Tue, 14 Oct 2026 10:00:00 +0:100",
            "Tue, 14 Oct 2026 10:00:00 +01:30",
            "Tue, 14 Oct 2026 1:00:00 GMT",
            "2026-10-14T10:00:00ABC",
            "2026-10-14T10:00:00+0:100",
        ] {
            assert_eq!(parse_date(malformed), None, "{malformed}");
        }
        // Bare ampersands are read in one pass, not rescanned to the end each time.
        let ampersands = "&".repeat(200_000);
        assert_eq!(decode_entities(&ampersands), ampersands);
    }

    #[test]
    fn durations_and_text() {
        assert_eq!(parse_duration("3723"), Some(3723));
        assert_eq!(parse_duration("02:03"), Some(123));
        assert_eq!(parse_duration("1:02:03"), Some(3723));
        assert_eq!(parse_duration("soon"), None);
        assert_eq!(
            decode_entities("a &amp;amp; &#233;&#x2014; &bogus; & b"),
            "a &amp; é— &bogus; & b"
        );
        assert_eq!(
            html_to_text("<script>x()</script><p>One<br/>Two</p><style>p{}</style>three"),
            "One\n\nTwo\n\nthree"
        );
        assert_eq!(
            html_to_text("<p>Hello <b>w</b>orld, <a href=x>link</a>ed</p><td>a</td><td>b</td>"),
            "Hello world, linked\n\na b"
        );
        assert_eq!(clip("abcdef", 4), "abc…");
        assert_eq!(clip("abc", 4), "abc");
        assert_eq!(
            web_url("//cdn.example/a.png").as_deref(),
            Some("https://cdn.example/a.png")
        );
        assert_eq!(web_url("data:image/png;base64,AAA"), None);
        assert_eq!(web_url("https://a.example/b c"), None);
        assert_eq!(
            first_image(r#"<p><img src="https://t.example/p.gif" width="1"><IMG SRC='https://a.example/x.jpg'></p>"#)
                .as_deref(),
            Some("https://a.example/x.jpg")
        );
    }
}

//! Safari's Reader: the readable text of a page the module fetched.
//!
//! [`extract`] walks the page with the rewriter's tokenizer and keeps its
//! headings (`h1` to `h3`), paragraphs, block quotes, preformatted text and
//! long list items, as plain text. It skips what is not the article:
//! navigation, headers, footers, asides, forms, tables, figures, citation
//! marks (`sup`), and anything hidden or marked as navigation by a class Safari
//! knows from the sites it reads (`navbox`, `infobox`, `mw-editsection`,
//! `reference`, ...). It prefers the text inside `<article>`, `<main>` or a
//! `role="main"` element when that holds at least three paragraphs.
//!
//! Reader is offered when the page has [`MIN_PARAGRAPHS`] paragraphs.

use ferrite_app::serde;

use super::rewrite::{self, decode_entities};

/// The fewest paragraphs that make a page readable.
pub const MIN_PARAGRAPHS: usize = 3;
/// The most blocks kept, and the most characters in all.
const MAX_BLOCKS: usize = 600;
const MAX_CHARACTERS: usize = 300_000;

/// One block of the article.
#[derive(serde::Serialize, Debug, Clone, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Block {
    /// `"h"` for a heading, `"p"` for running text, `"pre"` for code.
    pub kind: &'static str,
    pub text: String,
}

/// Elements whose content is not the article.
const SKIPPED: &[&str] = &[
    "nav", "header", "footer", "aside", "form", "table", "figure", "sup", "button", "select",
    "svg", "math", "menu", "dialog", "label",
];
/// Raw-text elements, read past whole.
const RAW: &[&str] = &[
    "script", "style", "title", "textarea", "iframe", "noembed", "noframes", "xmp", "template",
];
/// Class names of navigation and furniture on the listed sites.
const SKIPPED_CLASSES: &[&str] = &[
    "navbox",
    "infobox",
    "mw-editsection",
    "reference",
    "reflist",
    "hatnote",
    "sidebar",
    "metadata",
    "noprint",
    "mw-jump-link",
    "toc",
    "catlinks",
    "share",
    "advert",
    "newsletter",
];
/// Void elements, which have no end tag and so open no region.
const VOID: &[&str] = &[
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source",
    "track", "wbr",
];

fn attribute<'t>(tag: &'t rewrite::Tag, name: &str) -> Option<&'t str> {
    tag.attributes
        .iter()
        .find(|(n, _)| n == name)
        .and_then(|(_, v)| v.as_deref())
}

/// Whether a start tag opens a region Reader leaves out.
fn skipped(tag: &rewrite::Tag) -> bool {
    if SKIPPED.contains(&tag.name.as_str()) || attribute(tag, "hidden").is_some() {
        return true;
    }
    if attribute(tag, "aria-hidden") == Some("true") || attribute(tag, "role") == Some("navigation")
    {
        return true;
    }
    let classes = attribute(tag, "class").unwrap_or("").to_ascii_lowercase();
    classes.split_ascii_whitespace().any(|class| {
        SKIPPED_CLASSES
            .iter()
            .any(|skipped| class == *skipped || class.starts_with(&format!("{skipped}-")))
    })
}

/// Whether a start tag opens the article itself.
fn article(tag: &rewrite::Tag) -> bool {
    matches!(tag.name.as_str(), "article" | "main")
        || attribute(tag, "role") == Some("main")
        || attribute(tag, "id") == Some("mw-content-text")
}

/// The kind of block a tag starts, if it starts one.
fn block_kind(name: &str) -> Option<&'static str> {
    match name {
        "h1" | "h2" | "h3" => Some("h"),
        "p" | "blockquote" | "li" | "dd" => Some("p"),
        "pre" => Some("pre"),
        _ => None,
    }
}

struct Walk {
    /// Blocks anywhere, and blocks inside the article.
    all: Vec<Block>,
    inside: Vec<Block>,
    /// The open elements, each with whether it skips and whether it is the
    /// article; at most [`MAX_DEPTH`].
    open: Vec<(String, bool, bool)>,
    /// How many of the open elements skip, and how many are the article: so
    /// that no text run reads the whole stack.
    skips: usize,
    articles: usize,
    /// The block being read: its kind, its tag and its text so far.
    current: Option<(&'static str, String, String)>,
    characters: usize,
}

/// The most open elements tracked. Deeper ones are read as text runs of the
/// element around them; their end tags find nothing to close. This bounds
/// every search of the stack, whatever a page nests.
const MAX_DEPTH: usize = 512;

impl Walk {
    fn skipping(&self) -> bool {
        self.skips > 0
    }

    fn in_article(&self) -> bool {
        self.articles > 0
    }

    fn finish(&mut self) {
        let Some((kind, tag, text)) = self.current.take() else {
            return;
        };
        let text = if kind == "pre" {
            decode_entities(text.trim_matches('\n'))
        } else {
            decode_entities(&text)
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ")
        };
        let long_enough = match tag.as_str() {
            "li" | "dd" => text.chars().count() >= 60,
            "p" | "blockquote" => text.chars().count() >= 25,
            _ => !text.is_empty(),
        };
        if !long_enough
            || self.all.len() >= MAX_BLOCKS
            || self.characters + text.len() > MAX_CHARACTERS
        {
            return;
        }
        self.characters += text.len();
        let block = Block { kind, text };
        if self.in_article() {
            self.inside.push(block.clone());
        }
        self.all.push(block);
    }

    fn text(&mut self, text: &str) {
        if self.skipping() {
            return;
        }
        if let Some((_, _, current)) = self.current.as_mut() {
            current.push_str(text);
        }
    }

    fn start(&mut self, tag: &rewrite::Tag) {
        let name = tag.name.as_str();
        if name == "br" {
            self.text(if matches!(self.current, Some(("pre", _, _))) {
                "\n"
            } else {
                " "
            });
        }
        if VOID.contains(&name) || tag.self_closing {
            return;
        }
        if let Some(kind) = block_kind(name) {
            if !self.skipping() {
                // A block starting inside another (a list in a paragraph's
                // place, a paragraph in a list item) ends the one being read.
                self.finish();
                self.current = Some((kind, name.to_string(), String::new()));
            }
        }
        if self.open.len() >= MAX_DEPTH {
            return;
        }
        let (skip, is_article) = (skipped(tag), article(tag));
        self.skips += usize::from(skip);
        self.articles += usize::from(is_article);
        self.open.push((name.to_string(), skip, is_article));
    }

    fn end(&mut self, name: &str) {
        if let Some((_, tag, _)) = &self.current {
            if tag == name {
                self.finish();
            }
        }
        if let Some(at) = self.open.iter().rposition(|(open, _, _)| open == name) {
            for (_, skip, is_article) in self.open.drain(at..) {
                self.skips -= usize::from(skip);
                self.articles -= usize::from(is_article);
            }
        }
    }
}

/// The readable blocks of a page: those inside its article when it has one
/// with enough paragraphs, otherwise the whole page's.
pub fn extract(source: &str) -> Vec<Block> {
    let bytes = source.as_bytes();
    let mut walk = Walk {
        all: Vec::new(),
        inside: Vec::new(),
        open: Vec::new(),
        skips: 0,
        articles: 0,
        current: None,
        characters: 0,
    };
    let mut text_from = 0;
    let mut at = 0;
    while at < bytes.len() {
        if bytes[at] != b'<' {
            at += 1;
            continue;
        }
        walk.text(&source[text_from..at]);
        let next = bytes.get(at + 1).copied();
        at = match next {
            Some(b'!') if source[at..].starts_with("<!--") => rewrite::comment_end(source, at + 4),
            Some(b'!') | Some(b'?') => rewrite::after_gt(source, at + 2),
            Some(b'/') => match bytes.get(at + 2).copied() {
                Some(b) if b.is_ascii_alphabetic() => match rewrite::read_tag(source, at + 2) {
                    Some((tag, after)) => {
                        walk.end(&tag.name);
                        after
                    }
                    None => source.len(),
                },
                _ => rewrite::after_gt(source, at + 2),
            },
            Some(b) if b.is_ascii_alphabetic() => match rewrite::read_tag(source, at + 1) {
                Some((tag, after)) if RAW.contains(&tag.name.as_str()) && !tag.self_closing => {
                    rewrite::raw_text(source, after, &tag.name).1
                }
                Some((tag, after)) => {
                    walk.start(&tag);
                    after
                }
                None => source.len(),
            },
            _ => {
                walk.text("<");
                at + 1
            }
        };
        text_from = at;
    }
    walk.text(&source[text_from.min(source.len())..]);
    walk.finish();
    let paragraphs = |blocks: &[Block]| blocks.iter().filter(|b| b.kind == "p").count();
    if paragraphs(&walk.inside) >= MIN_PARAGRAPHS {
        walk.inside
    } else {
        walk.all
    }
}

/// Whether Reader has enough to show.
pub fn readable(blocks: &[Block]) -> bool {
    blocks.iter().filter(|b| b.kind == "p").count() >= MIN_PARAGRAPHS
}

#[cfg(test)]
mod tests {
    use super::*;

    const LONG: &str = "This sentence is long enough to count as running text in Reader.";

    #[test]
    fn the_article_text_is_kept_and_the_furniture_left_out() {
        let html = format!(
            "<html><head><title>T</title><style>p{{}}</style></head><body>\
             <nav><p>{LONG} nav</p></nav><header><h1>Site</h1></header>\
             <main><h1>Heading &amp; more</h1><p>{LONG} one<sup>[1]</sup></p>\
             <div class=\"infobox\"><p>{LONG} box</p></div><table><tr><td><p>{LONG} cell</p></td></tr></table>\
             <p>{LONG}<br>two</p><p>{LONG} three<p>{LONG} four</p><script>var p = '<p>no</p>';</script>\
             <pre>a  b\n  c</pre><ul><li>short</li><li>{LONG} item</li></ul></main>\
             <footer><p>{LONG} footer</p></footer></body></html>"
        );
        let blocks = extract(&html);
        let texts: Vec<&str> = blocks.iter().map(|b| b.text.as_str()).collect();
        assert_eq!(
            texts,
            [
                "Heading & more",
                &format!("{LONG} one")[..],
                &format!("{LONG} two")[..],
                &format!("{LONG} three")[..],
                &format!("{LONG} four")[..],
                "a  b\n  c",
                &format!("{LONG} item")[..],
            ]
        );
        assert_eq!(blocks[0].kind, "h");
        assert_eq!(blocks[5].kind, "pre");
        assert!(readable(&blocks));
    }

    #[test]
    fn deep_nesting_and_stray_end_tags_are_read_in_linear_time() {
        let deep = format!(
            "{}<p>{LONG} a</p><p>{LONG} b</p><p>{LONG} c</p>{}",
            "<div>".repeat(200_000),
            "</x>".repeat(200_000)
        );
        assert_eq!(extract(&deep).len(), 3);
        let nav = format!(
            "<nav>{}</nav><p>{LONG} after</p>",
            "<span>t</span>".repeat(100_000)
        );
        assert_eq!(
            extract(&nav).len(),
            1,
            "the nav closes and the paragraph after it is read"
        );
        let ampersands = format!("<p>{LONG} {}</p>", "&".repeat(200_000));
        assert_eq!(extract(&ampersands).len(), 1);
    }

    #[test]
    fn a_page_without_an_article_is_read_whole_and_a_short_page_is_not_readable() {
        let html = format!("<div><p>{LONG} a</p><p>{LONG} b</p><p>{LONG} c</p></div>");
        assert_eq!(extract(&html).len(), 3);
        assert!(!readable(&extract("<p>Hello.</p><ul><li>One</li></ul>")));
        assert!(extract("").is_empty());
    }
}

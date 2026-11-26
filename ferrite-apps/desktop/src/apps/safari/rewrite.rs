//! How a fetched page is made safe to show in Safari's frame.
//!
//! The page is shown in an `<iframe sandbox="allow-scripts allow-forms"
//! srcdoc=...>` without `allow-same-origin`, so whatever runs in it has an
//! opaque origin of its own: it cannot reach the desktop page, its storage or
//! its session cookie, open windows or navigate the desktop. Inside that
//! frame three layers keep the page inert, in Safari, and off the network:
//!
//! 1. A Content-Security-Policy, first in the document ([`csp`]), names no
//!    network source at all: pictures and fonts may only be `data:`
//!    addresses, styles only inline, the one script [`FRAME_SCRIPT`] runs by
//!    its SHA-256 hash, and nothing may be fetched, framed, submitted or used
//!    as a base. So no request leaves the frame, whatever the rewrite below
//!    missed: not to a private, loopback, link-local or metadata address, and
//!    not to any other.
//! 2. [`render`] rewrites the HTML. It drops `<script>`, `<iframe>`,
//!    `<frame>`, `<object>`, `<embed>`, `<applet>`, `<template>`, `<base>`,
//!    `<meta>` and every `<link>` but stylesheets; every `on*` handler and
//!    every attribute that names an address, except three, rewritten:
//!    * a picture's address (`<img src>`, else its first `srcset`
//!      candidate) and a stylesheet's (`<link rel=stylesheet href>`) become
//!      [`Asset`]s when [`policy::judge_asset`] admits them. The module
//!      fetches them through the same checked fetch as the page (every host's
//!      addresses checked, redirects judged again) and [`Page::html`] puts
//!      them in as a `data:` address and a `<style>` element; one that was not
//!      fetched leaves the picture empty and the stylesheet out;
//!    * a link (`<a href>`, `<area href>`) becomes `data-safari-href` with
//!      the absolute address and no address of its own (an `<area>` keeps the
//!      inert `href="#"` that makes it a region of its image map), so the
//!      frame itself has nowhere to go: only [`FRAME_SCRIPT`] follows it, by
//!      asking the window;
//!    * a form keeps its absolute `action` for [`FRAME_SCRIPT`]; the policy
//!      refuses a form's own submission.
//!
//!    Links to a private host are dropped. Styles go through [`clean_css`]:
//!    a strict subset, kept only when it can be read. The tokenizer follows
//!    the browser's rules for tags, attributes, comments and raw text, and
//!    where it could read a piece differently from the browser it errs
//!    towards dropping it: the text it keeps inside `<style>`, `<title>` and
//!    `<textarea>` cannot open a tag in any parsing state.
//! 3. [`FRAME_SCRIPT`] turns a click on a link (or Return on it) and a GET
//!    form's submission into a message to the Safari window (`{safari: 1,
//!    type: "navigate", url, newTab}`), which loads the address through the
//!    module again. A link to a fragment of the same page scrolls instead. It
//!    also answers the window alone (`event.source === parent`): find, which
//!    lights every match, zoom, scroll, select all, read the selection and
//!    scroll to it. It sends command keys up, so the window's shortcuts work
//!    while the page has the keyboard, says which link the pointer is over,
//!    for the status bar, and what is selected, for the Services menu, and
//!    carries a link dragged out to the window, which no drag of the browser's
//!    may reach from a frame of another origin. None
//!    of this reads or sends anything but the page's own text to the window.

use super::policy::{self, Parsed, Resolved};

/// The one script the frame runs. Its hash is in [`csp`]. It reads the
/// page's address from `<meta name="safari-page">`, which [`head`] writes
/// (every `<meta>` of the page itself is dropped).
pub const FRAME_SCRIPT: &str = r##"(function(){var m=document.querySelector('meta[name="safari-page"]');var here=m?m.getAttribute("content"):"";var post=function(x){x.safari=1;parent.postMessage(x,"*")};var page=function(u){return u.split("#")[0]};var attr=function(el,n){return Element.prototype.getAttribute.call(el,n)};var jump=function(h){if(!h||h==="#")return;var id;try{id=decodeURIComponent(h.slice(1))}catch(x){id=h.slice(1)}var t=document.getElementById(id)||document.getElementsByName(id)[0];if(t)t.scrollIntoView()};var link=function(t){return t&&t.closest?t.closest("[data-safari-href]"):null};var go=function(a,tab){var u=a.getAttribute("data-safari-href");if(!u)return;var at=u.indexOf("#");if(!tab&&at>=0&&page(u)===page(here)){jump(u.slice(at));return}post({type:"navigate",url:u,newTab:tab})};var carrying=false,carried=false;var click=function(e){if(carried){carried=false;e.preventDefault();return}if(e.button>1)return;var a=link(e.target);if(!a)return;e.preventDefault();go(a,e.button===1||e.metaKey||e.ctrlKey)};document.addEventListener("click",click,true);document.addEventListener("auxclick",click,true);document.addEventListener("keydown",function(e){if(e.key!=="Enter")return;var a=link(e.target);if(!a)return;e.preventDefault();go(a,e.metaKey||e.ctrlKey)},true);document.addEventListener("submit",function(e){e.preventDefault();var f=e.target;var b=e.submitter;var how=b?attr(b,"formmethod"):null;if(how===null)how=attr(f,"method");how=(how||"").toLowerCase();if(how==="post"||how==="dialog"){post({type:"refused",reason:"post"});return}var u;try{u=new URL(attr(f,"action")||here)}catch(x){return}var q=new URLSearchParams();new FormData(f).forEach(function(v,k){if(typeof v==="string")q.append(k,v)});var s=e.submitter;if(s&&s.name)q.append(s.name,s.value||"");u.search=q.toString();u.hash="";post({type:"navigate",url:u.href,newTab:false})},true);document.addEventListener("DOMContentLoaded",function(){var at=here.indexOf("#");if(at>=0)jump(here.slice(at))});var count=function(q){var n=0,g=getSelection();if(g)g.removeAllRanges();while(n<2000&&window.find(q,false,false,false,false,false,false))n++;if(g)g.removeAllRanges();return n};var lit=function(q){if(!window.CSS||!CSS.highlights||typeof Highlight==="undefined")return;CSS.highlights.delete("safari-find");if(!q)return;if(!document.getElementById("safari-find-style")){var st=document.createElement("style");st.id="safari-find-style";st.textContent="::highlight(safari-find){background-color:#ffe76b;color:#000}";document.head.appendChild(st)}var w=document.createTreeWalker(document.body,4),n,r=[],l=q.toLowerCase();while((n=w.nextNode())&&r.length<2000){if(n.parentNode.nodeName==="STYLE")continue;var t=n.nodeValue.toLowerCase(),i=t.indexOf(l);while(i>=0&&r.length<2000&&i+l.length<=n.length){var g=document.createRange();g.setStart(n,i);g.setEnd(n,i+l.length);r.push(g);i=t.indexOf(l,i+l.length)}}if(r.length)CSS.highlights.set("safari-find",new Highlight(...r))};var move=function(k,sh){var h=innerHeight-40;var y=k==="ArrowUp"?-40:k==="ArrowDown"?40:k==="PageUp"?-h:k==="PageDown"?h:k===" "?(sh?-h:h):0;var x=k==="ArrowLeft"?-40:k==="ArrowRight"?40:0;if(k==="Home")scrollTo(scrollX,0);else if(k==="End")scrollTo(scrollX,document.documentElement.scrollHeight);else scrollBy(x,y)};window.addEventListener("message",function(e){var d=e.data;if(e.source!==parent||!d||d.safari!==1)return;var s=getSelection();if(d.type==="find"&&typeof d.query==="string"){var n=d.fresh&&d.query!==""?count(d.query):0;if(d.fresh){lit(d.query);if(s)s.removeAllRanges()}var hit=d.query!==""&&window.find(d.query,false,!!d.back,true,false,false,false);post({type:"found",query:d.query,count:n,hit:hit,fresh:!!d.fresh,back:!!d.back})}else if(d.type==="scroll"&&typeof d.key==="string"){move(d.key,!!d.shift)}else if(d.type==="print"){window.print()}else if(d.type==="zoom"&&typeof d.scale==="number"){document.documentElement.style.zoom=String(d.scale)}else if(d.type==="select-all"){document.execCommand("selectAll")}else if(d.type==="selection"){post({type:"selection",text:s?String(s):"",purpose:d.purpose})}else if(d.type==="jump"&&s&&s.rangeCount){var c=s.getRangeAt(0).startContainer;if(c.nodeType!==1)c=c.parentNode;if(c&&c.scrollIntoView)c.scrollIntoView({block:"center"})}});document.addEventListener("contextmenu",function(e){e.preventDefault();var a=link(e.target);var i=e.target.closest?e.target.closest("img"):null;var g=getSelection();post({type:"menu",x:e.clientX,y:e.clientY,link:a?a.getAttribute("data-safari-href"):null,linkText:a?(a.textContent||"").trim():"",image:i?i.getAttribute("src"):null,text:g?String(g):""})},true);document.addEventListener("selectionchange",function(){var g=getSelection();post({type:"selected",text:g?String(g):""})});document.addEventListener("dragstart",function(e){var a=link(e.target);var u=a?a.getAttribute("data-safari-href"):null;if(!u)return;e.preventDefault();carrying=true;post({type:"link-drag",phase:"start",url:u,title:(a.textContent||"").trim(),x:e.clientX,y:e.clientY})},true);document.addEventListener("mousedown",function(){carried=false},true);document.addEventListener("mousemove",function(e){if(carrying)post({type:"link-drag",phase:"move",x:e.clientX,y:e.clientY})},true);document.addEventListener("mouseup",function(e){if(!carrying)return;carrying=false;carried=true;post({type:"link-drag",phase:"end",x:e.clientX,y:e.clientY})},true);document.addEventListener("keydown",function(e){if(!e.metaKey&&!e.ctrlKey)return;var k=e.key.toLowerCase();if(k==="arrowup"||k==="arrowdown"){if(e.shiftKey||e.altKey||(e.target.closest&&e.target.closest("input,textarea,select")))return;e.preventDefault();move(k==="arrowup"?"Home":"End");return}var c=(e.metaKey&&e.ctrlKey?"m":"")+(e.altKey?"a":"")+(e.shiftKey?"s":"")+k;if(" f g e j 0 = - / t l w r y [ ] d . s p o 1 2 3 4 5 6 7 8 9 sg st sb s| s\\ sr sh sd sw sn al as ab m1 m2 tab stab ".indexOf(" "+c+" ")<0||(k==="tab"&&e.metaKey))return;e.preventDefault();post({type:"key",key:e.key,shift:e.shiftKey,alt:e.altKey,ctrl:e.ctrlKey,meta:e.metaKey})},true);var shown=null;document.addEventListener("mouseover",function(e){var t=e.target;var a=t&&t.closest?t.closest("[data-safari-href]"):null;var u=a?a.getAttribute("data-safari-href"):null;if(a){a.draggable=true;a.style.userSelect="text"}if(u===shown)return;shown=u;post({type:"hover",url:u})},true);document.documentElement.addEventListener("mouseleave",function(){if(shown===null)return;shown=null;post({type:"hover",url:null})})})();"##;

/// The frame's Content-Security-Policy: no network source in any directive.
/// Scripts: [`FRAME_SCRIPT`] alone. Styles: inline only. Pictures and fonts:
/// `data:` only. Everything else (connections, frames, media, objects,
/// workers, form submissions, a base address) is refused.
pub fn csp() -> String {
    let digest = ferrite_app::crypto::sha256(FRAME_SCRIPT.as_bytes());
    format!(
        "default-src 'none'; script-src 'sha256-{}'; style-src 'unsafe-inline'; \
         img-src data:; font-src data:; form-action 'none'; base-uri 'none'",
        base64(&digest)
    )
}

/// Standard base64 with padding (RFC 4648).
pub fn base64(bytes: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let n = (u32::from(chunk[0]) << 16)
            | (u32::from(*chunk.get(1).unwrap_or(&0)) << 8)
            | u32::from(*chunk.get(2).unwrap_or(&0));
        for (index, shift) in [18, 12, 6, 0].into_iter().enumerate() {
            if index <= chunk.len() {
                out.push(ALPHABET[(n >> shift & 63) as usize] as char);
            } else {
                out.push('=');
            }
        }
    }
    out
}

/// What a page's resource is used as.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AssetKind {
    /// A picture: put in as a `data:` address.
    Image,
    /// A stylesheet: put in as a `<style>` element.
    Style,
}

/// A picture or stylesheet the page needs: an absolute address that
/// [`policy::judge_asset`] admitted when the page was rewritten.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Asset {
    pub url: String,
    pub kind: AssetKind,
}

/// A piece of the rewritten page.
#[derive(Debug, Clone, PartialEq, Eq)]
enum Piece {
    Text(String),
    /// The ` src="..."` of an `<img>`: asset `n`'s `data:` address.
    Image(usize),
    /// A `<style>` element holding asset `n`, with the `<link>`'s `media`.
    Style {
        index: usize,
        media: Option<String>,
    },
}

/// A page ready for the frame, but for its pictures and stylesheets.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Page {
    head: String,
    pieces: Vec<Piece>,
    /// The pictures and stylesheets, in the page's order, each once.
    pub assets: Vec<Asset>,
    /// The text of the page's first `<title>`, when it has one.
    pub title: Option<String>,
}

impl Page {
    /// The whole `srcdoc` document, with what was fetched of each asset:
    /// `fetched[n]` is asset `n`'s `data:` address (a picture) or its
    /// stylesheet made safe by [`style_block`]. An asset without one is left
    /// out: the picture shows nothing, the stylesheet is not there.
    pub fn html(&self, fetched: &[Option<String>]) -> String {
        self.html_within(fetched, usize::MAX)
            .expect("no bound to pass")
    }

    /// [`Page::html`], or `None` as soon as the document passes `cap` bytes:
    /// a page that names one picture many times would otherwise repeat its
    /// `data:` address without bound. Nothing past `cap` is allocated.
    pub fn html_within(&self, fetched: &[Option<String>], cap: usize) -> Option<String> {
        let mut html = String::new();
        let push = |html: &mut String, text: &str| {
            if html.len() + text.len() > cap {
                return false;
            }
            html.push_str(text);
            true
        };
        if !push(&mut html, &self.head) {
            return None;
        }
        for piece in &self.pieces {
            let fits = match piece {
                Piece::Text(text) => push(&mut html, text),
                Piece::Image(index) => match fetched.get(*index) {
                    Some(Some(data)) => {
                        push(&mut html, " src=\"")
                            && push(&mut html, &escape_attribute(data))
                            && push(&mut html, "\"")
                    }
                    _ => true,
                },
                Piece::Style { index, media } => match fetched.get(*index) {
                    Some(Some(css)) => {
                        let media = media
                            .as_ref()
                            .map(|m| format!(" media=\"{}\"", escape_attribute(m)))
                            .unwrap_or_default();
                        push(&mut html, &format!("<style{media}>"))
                            && push(&mut html, css)
                            && push(&mut html, "</style>")
                    }
                    _ => true,
                },
            };
            if !fits {
                return None;
            }
        }
        Some(html)
    }
}

/// The head every frame document starts with: the policy before anything
/// else, no referrer, the page's address for [`FRAME_SCRIPT`], and the frame
/// script. No `<base>`: every address left in the page is absolute.
fn head(page: &Parsed) -> String {
    format!(
        "<!DOCTYPE html><meta charset=\"utf-8\"><meta http-equiv=\"Content-Security-Policy\" content=\"{}\">\
         <meta name=\"referrer\" content=\"no-referrer\"><meta name=\"safari-page\" content=\"{}\">\
         <script>{FRAME_SCRIPT}</script>",
        escape_attribute(&csp()),
        escape_attribute(&page.display())
    )
}

/// Whether a body is HTML rather than plain text: it starts with markup a
/// page starts with.
pub fn is_markup(text: &str) -> bool {
    let start: String = text
        .trim_start_matches(['\u{feff}', ' ', '\t', '\n', '\r'])
        .chars()
        .take(2048)
        .collect();
    let lower = start.to_ascii_lowercase();
    lower.starts_with('<')
        && [
            "<!doctype html",
            "<html",
            "<head",
            "<body",
            "<title",
            "<meta",
            "<div",
            "<p",
            "<a ",
            "<h1",
            "<table",
            "<!--",
            "<link",
            "<script",
            "<style",
        ]
        .iter()
        .any(|tag| lower.contains(tag))
}

/// The largest rewritten page, in bytes, before its pictures and stylesheets
/// are put in: with its JSON escaping, those assets and the Reader's text it
/// stays under the platform's reply of about 4 MiB (the module checks the
/// whole reply and leaves the assets out when it would not), and it bounds
/// what absolute addresses can add to a page of short relative ones.
pub const MAX_RENDERED: usize = 1536 * 1024;
/// The most attributes kept of one tag; the rest are read past and dropped.
const MAX_ATTRIBUTES: usize = 256;
/// The most pictures and stylesheets fetched for one page; the rest are left
/// out. (The module also stops at its time and size budgets.)
pub const MAX_IMAGES: usize = 32;
pub const MAX_STYLES: usize = 6;

/// Plain text, shown as Safari shows a text file; `None` when it would be
/// over [`MAX_RENDERED`].
pub fn text_page(text: &str, base: &Parsed) -> Option<Page> {
    let head = head(base);
    let body = format!(
        "<pre style=\"white-space: pre-wrap; overflow-wrap: anywhere;\">{}</pre>",
        escape_text(text)
    );
    (head.len() + body.len() <= MAX_RENDERED).then_some(Page {
        head,
        pieces: vec![Piece::Text(body)],
        assets: Vec::new(),
        title: None,
    })
}

/// The page, rewritten for the frame; `None` when the rewritten page would be
/// over [`MAX_RENDERED`].
pub fn render(source: &str, base: &Parsed) -> Option<Page> {
    let head = head(base);
    let out = rewrite(source, base, MAX_RENDERED.saturating_sub(head.len()))?;
    Some(Page {
        head,
        pieces: out.pieces,
        assets: out.assets,
        title: out.title,
    })
}

/// Elements dropped with their content, which the browser reads as raw text.
const DROPPED_RAW: &[&str] = &["script", "iframe", "noembed", "noframes"];
/// Elements whose tags are dropped; their content, if any, stays (the
/// fallback of an `<object>`, the content of a `<noscript>`).
const DROPPED_TAGS: &[&str] = &[
    "base",
    "meta",
    "embed",
    "frame",
    "frameset",
    "object",
    "applet",
    "param",
    "portal",
    "fencedframe",
    "noscript",
    "script",
    "iframe",
    "noembed",
    "noframes",
    "template",
    "xmp",
    "plaintext",
    "link",
    // SVG animation can set any attribute after the page is rewritten: an
    // `href` back on a link, or a picture's address.
    "animate",
    "animatemotion",
    "animatetransform",
    "animatecolor",
    "set",
    "discard",
];
/// Attributes that are dropped wherever they appear.
const DROPPED_ATTRIBUTES: &[&str] = &[
    "target",
    "ping",
    "srcdoc",
    "formaction",
    "formtarget",
    "nonce",
    "autofocus",
    "http-equiv",
    "manifest",
    "xml:base",
    "srcset",
    "imagesrcset",
];
/// Attributes that name an address. Each is dropped, but for the three the
/// rewriter writes itself: a link's `href`, a form's `action` and a
/// picture's `src`.
const URL_ATTRIBUTES: &[&str] = &[
    "href",
    "src",
    "action",
    "poster",
    "cite",
    "background",
    "longdesc",
    "xlink:href",
    "data",
    "codebase",
    "archive",
    "dynsrc",
    "lowsrc",
    "icon",
    "profile",
    "attributionsrc",
];

fn is_space(byte: u8) -> bool {
    matches!(byte, b' ' | b'\t' | b'\n' | b'\r' | 0x0c)
}

/// A start or end tag as the browser tokenizes it.
pub(super) struct Tag {
    pub(super) name: String,
    /// Each attribute once, the first spelling kept, as the browser keeps it;
    /// values raw (entities not decoded).
    pub(super) attributes: Vec<(String, Option<String>)>,
    pub(super) self_closing: bool,
}

impl Tag {
    fn value(&self, name: &str) -> Option<&str> {
        self.attributes
            .iter()
            .find(|(attribute, _)| attribute == name)
            .and_then(|(_, value)| value.as_deref())
    }

    fn has(&self, name: &str) -> bool {
        self.attributes
            .iter()
            .any(|(attribute, _)| attribute == name)
    }
}

/// Read the tag whose name starts at `from`. `None` at the end of the input
/// inside the tag, which the browser drops.
pub(super) fn read_tag(source: &str, from: usize) -> Option<(Tag, usize)> {
    let bytes = source.as_bytes();
    let mut at = from;
    while at < bytes.len() && !is_space(bytes[at]) && bytes[at] != b'/' && bytes[at] != b'>' {
        at += 1;
    }
    let name = source[from..at].to_ascii_lowercase();
    let mut attributes: Vec<(String, Option<String>)> = Vec::new();
    let mut self_closing = false;
    loop {
        while at < bytes.len() && is_space(bytes[at]) {
            at += 1;
        }
        match bytes.get(at).copied() {
            None => return None,
            Some(b'>') => {
                at += 1;
                break;
            }
            Some(b'/') => {
                if bytes.get(at + 1) == Some(&b'>') {
                    self_closing = true;
                    at += 2;
                    break;
                }
                at += 1;
                continue;
            }
            Some(_) => {}
        }
        let start = at;
        if bytes[at] == b'=' {
            at += 1;
        }
        while at < bytes.len() && !is_space(bytes[at]) && !matches!(bytes[at], b'/' | b'>' | b'=') {
            at += 1;
        }
        let attribute = source[start..at].to_ascii_lowercase();
        while at < bytes.len() && is_space(bytes[at]) {
            at += 1;
        }
        let mut value = None;
        if bytes.get(at) == Some(&b'=') {
            at += 1;
            while at < bytes.len() && is_space(bytes[at]) {
                at += 1;
            }
            match bytes.get(at).copied() {
                None => return None,
                Some(quote @ (b'"' | b'\'')) => {
                    let end = source[at + 1..].find(quote as char)? + at + 1;
                    value = Some(source[at + 1..end].to_string());
                    at = end + 1;
                }
                Some(b'>') => value = Some(String::new()),
                Some(_) => {
                    let start = at;
                    while at < bytes.len() && !is_space(bytes[at]) && bytes[at] != b'>' {
                        at += 1;
                    }
                    value = Some(source[start..at].to_string());
                }
            }
        }
        if attributes.len() < MAX_ATTRIBUTES
            && !attributes.iter().any(|(name, _)| *name == attribute)
        {
            attributes.push((attribute, value));
        }
    }
    Some((
        Tag {
            name,
            attributes,
            self_closing,
        },
        at,
    ))
}

/// Where a comment that opened before `from` (after `<!--`) ends: `<!-->`
/// and `<!--->` end at once, otherwise the first `-->` or `--!>`. One pass:
/// the scan never goes back over what it read.
pub(super) fn comment_end(source: &str, from: usize) -> usize {
    let rest = &source[from..];
    if rest.starts_with('>') {
        return from + 1;
    }
    if rest.starts_with("->") {
        return from + 2;
    }
    let mut search = 0;
    while let Some(found) = rest[search..].find("--") {
        let at = search + found;
        let after = &rest[at + 2..];
        if after.starts_with('>') {
            return from + at + 3;
        }
        if after.starts_with("!>") {
            return from + at + 4;
        }
        search = at + 1;
    }
    source.len()
}

/// The index after the next `>` from `from`, or the end.
pub(super) fn after_gt(source: &str, from: usize) -> usize {
    source[from..]
        .find('>')
        .map_or(source.len(), |at| from + at + 1)
}

/// The raw text of element `name` from `from`: where it ends, and where the
/// end tag ends (`</name` followed by a space, `/` or `>`). It reads only up
/// to that end tag, so a page of many raw elements is read once.
pub(super) fn raw_text(source: &str, from: usize, name: &str) -> (usize, usize) {
    let bytes = source.as_bytes();
    let mut search = from;
    while let Some(found) = source[search..].find("</") {
        let at = search + found;
        let name_end = at + 2 + name.len();
        if name_end <= bytes.len() && bytes[at + 2..name_end].eq_ignore_ascii_case(name.as_bytes())
        {
            let next = bytes.get(name_end).copied();
            if next.is_none_or(|b| is_space(b) || b == b'/' || b == b'>') {
                return (at, after_gt(source, name_end));
            }
        }
        search = at + 2;
    }
    (source.len(), source.len())
}

/// Whether a tag or attribute name is written plainly enough to be written
/// back: a letter, then letters, digits, `-`, `_`, `:` or `.`.
fn plain_name(name: &str) -> bool {
    let mut bytes = name.bytes();
    bytes.next().is_some_and(|b| b.is_ascii_alphabetic())
        && bytes.all(|b| {
            b.is_ascii_lowercase() || b.is_ascii_digit() || matches!(b, b'-' | b'_' | b':' | b'.')
        })
}

/// Escape text for an element's content.
pub fn escape_text(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

/// Escape text for a double-quoted attribute.
pub fn escape_attribute(text: &str) -> String {
    escape_text(text).replace('"', "&quot;")
}

/// Decode the character references a page's attributes and title use: the
/// numeric ones, and the named ones that can spell markup or hide a scheme.
/// Anything else stays as written.
pub fn decode_entities(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(at) = rest.find('&') {
        out.push_str(&rest[..at]);
        let after = &rest[at + 1..];
        // A reference is at most 12 characters before its `;`: look no further,
        // so a run of `&` without `;` is read once, not once per `&`.
        let decoded = after
            .as_bytes()
            .iter()
            .take(13)
            .position(|b| *b == b';')
            .and_then(|end| decode_reference(&after[..end]).map(|c| (c, end)));
        match decoded {
            Some((c, end)) => {
                out.push(c);
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

fn decode_reference(name: &str) -> Option<char> {
    if let Some(number) = name.strip_prefix('#') {
        let value = match number.strip_prefix(['x', 'X']) {
            Some(hex) => u32::from_str_radix(hex, 16).ok()?,
            None => number.parse::<u32>().ok()?,
        };
        return Some(
            char::from_u32(value)
                .filter(|c| *c != '\0')
                .unwrap_or('\u{fffd}'),
        );
    }
    Some(match name {
        "amp" | "AMP" => '&',
        "lt" | "LT" => '<',
        "gt" | "GT" => '>',
        "quot" | "QUOT" => '"',
        "apos" => '\'',
        "nbsp" => '\u{a0}',
        "Tab" => '\t',
        "NewLine" => '\n',
        "colon" => ':',
        "sol" => '/',
        "lpar" => '(',
        "rpar" => ')',
        "period" => '.',
        _ => return None,
    })
}

// ── Styles ──

/// Whether `text` starts with `word`, ASCII case ignored.
fn starts_with_word(text: &str, word: &str) -> bool {
    text.len() >= word.len() && text.as_bytes()[..word.len()].eq_ignore_ascii_case(word.as_bytes())
}

fn ident_byte(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_') || byte >= 0x80
}

/// Where the CSS string that opens at `at` ends (after its closing quote), as
/// the browser reads it: an escape takes the next character with it, and a
/// newline ends the string before it (a "bad string").
fn string_end(css: &str, at: usize) -> usize {
    let quote = css.as_bytes()[at];
    let mut chars = css[at + 1..].char_indices();
    while let Some((offset, c)) = chars.next() {
        match c {
            '\\' => {
                chars.next();
            }
            '\n' => return at + 1 + offset,
            _ if c as u32 == u32::from(quote) => return at + 1 + offset + 1,
            _ => {}
        }
    }
    css.len()
}

/// Where the statement from `at` ends: after its `;`, or before a `{` (an
/// `@import` has no block), strings and comments read past whole.
fn statement_end(css: &str, mut at: usize) -> usize {
    while at < css.len() {
        let rest = &css[at..];
        if rest.starts_with("/*") {
            at = rest[2..]
                .find("*/")
                .map_or(css.len(), |end| at + 2 + end + 2);
            continue;
        }
        match rest.as_bytes()[0] {
            b'"' | b'\'' => at = string_end(css, at),
            b';' => return at + 1,
            b'{' | b'}' => return at,
            _ => at += rest.chars().next().map_or(1, char::len_utf8),
        }
    }
    css.len()
}

/// The `url(` function whose argument starts at `from`: where it ends (after
/// its `)`), and its argument as written (a quoted one without its quotes).
fn url_end(css: &str, from: usize) -> (usize, &str) {
    let start = from + (css[from..].len() - css[from..].trim_start().len());
    let close = |from: usize| css[from..].find(')').map_or(css.len(), |at| from + at + 1);
    match css.as_bytes().get(start) {
        Some(b'"' | b'\'') => {
            let end = string_end(css, start);
            let inner_end = end.saturating_sub(1).max(start + 1);
            (close(end), css.get(start + 1..inner_end).unwrap_or(""))
        }
        _ => {
            let end = close(start);
            let inner = css[start..end].trim_end_matches(')').trim();
            (end, inner)
        }
    }
}

/// A stylesheet reduced to what is safe to keep, or `None` when it cannot be
/// read safely. The policy is strict rather than clever:
///
/// * comments are removed, so nothing in one (a quote, a `url(`) changes how
///   the rest is read;
/// * a backslash outside a string refuses the whole stylesheet if its escape
///   could spell a letter: that could write `url(` or `@import` in a way this
///   reader does not see. An escape of punctuation or a digit, as in a utility
///   class's `.md\:flex` or `.\32xl`, cannot, and stays ([`harmless_escape_end`]);
/// * every `@import` statement is dropped;
/// * every `url(...)` whose argument is not a `data:` address becomes `none`.
///
/// Strings are kept as written. A string that names an address elsewhere
/// (`image-set("a.png")`) is not followed: the frame's policy ([`csp`])
/// allows no network source, so the browser refuses it.
pub fn clean_css(css: &str) -> Option<String> {
    let bytes = css.as_bytes();
    let mut out = String::with_capacity(css.len());
    let mut at = 0;
    while at < css.len() {
        let rest = &css[at..];
        if rest.starts_with("/*") {
            at = rest[2..]
                .find("*/")
                .map_or(css.len(), |end| at + 2 + end + 2);
            out.push(' ');
            continue;
        }
        match bytes[at] {
            b'\\' => {
                let end = harmless_escape_end(css, at)?;
                out.push_str(&css[at..end]);
                at = end;
            }
            b'"' | b'\'' => {
                let end = string_end(css, at);
                out.push_str(&css[at..end]);
                at = end;
            }
            b'@' if starts_with_word(&rest[1..], "import")
                && !bytes.get(at + 7).is_some_and(|b| ident_byte(*b)) =>
            {
                at = statement_end(css, at);
            }
            b'u' | b'U'
                if starts_with_word(rest, "url(") && !(at > 0 && ident_byte(bytes[at - 1])) =>
            {
                let (end, argument) = url_end(css, at + 4);
                if starts_with_word(argument, "data:") {
                    out.push_str(&css[at..end]);
                } else {
                    out.push_str("none");
                }
                at = end;
            }
            _ => {
                let len = rest.chars().next().map_or(1, char::len_utf8);
                out.push_str(&rest[..len]);
                at += len;
            }
        }
    }
    Some(out)
}

/// Where the CSS escape at `at` ends, when what it stands for can spell no part of
/// a name this reader looks for: printable ASCII punctuation or a space written
/// as itself, or a hex escape of a digit. An escaped `@`, `(` or quote is part of a name to
/// the browser, opening no at-rule, function or string, and stepping over it here
/// reads it the same way.
fn harmless_escape_end(css: &str, at: usize) -> Option<usize> {
    let bytes = css.as_bytes();
    let next = *bytes.get(at + 1)?;
    if next.is_ascii_punctuation() || next == b' ' {
        return Some(at + 2);
    }
    let digits = bytes[at + 1..]
        .iter()
        .take(6)
        .take_while(|byte| byte.is_ascii_hexdigit())
        .count();
    let end = at + 1 + digits;
    let value = u32::from_str_radix(css.get(at + 1..end)?, 16).ok()?;
    if !(0x30..=0x39).contains(&value) {
        return None;
    }
    // One space after a hex escape belongs to it.
    Some(if matches!(bytes.get(end), Some(b' ')) {
        end + 1
    } else {
        end
    })
}

/// A stylesheet with no `<` that could open a tag if the browser read the
/// stylesheet as markup (inside `<svg>` a `<style>` is not raw text, and
/// `</style` would end it): such a `<` is written as the CSS escape `\3c `.
fn disarm_css(css: &str) -> String {
    let mut out = String::with_capacity(css.len());
    let bytes = css.as_bytes();
    for (at, c) in css.char_indices() {
        if c == '<'
            && bytes
                .get(at + 1)
                .is_some_and(|b| b.is_ascii_alphabetic() || matches!(*b, b'/' | b'!' | b'?'))
        {
            out.push_str("\\3c ");
        } else {
            out.push(c);
        }
    }
    out
}

/// A stylesheet as a `<style>` element may hold it: [`clean_css`], then
/// [`disarm_css`]. `None` when it cannot be read safely.
pub fn style_block(css: &str) -> Option<String> {
    clean_css(css).map(|clean| disarm_css(&clean))
}

/// Text of a `<title>` or `<textarea>`: the browser decodes its references,
/// so `<` can be written as `&lt;` and never opens a tag.
fn disarm_rcdata(text: &str) -> String {
    text.replace('<', "&lt;")
}

// ── Addresses ──

/// Whether an absolute address names a host the visitor's browser must not
/// be sent to from a page Safari shows (a private, loopback, link-local or
/// metadata address, or a local-only name). An address that cannot be read
/// counts as private: what cannot be classified is not sent.
fn private_target(url: &str) -> bool {
    policy::parse(url).map_or(true, |parsed| policy::private_host(&parsed.host))
}

/// The absolute address a link or form goes to, or `None` to drop it: http(s)
/// only, never a private host.
fn link_target(base: &Parsed, raw: &str) -> Option<String> {
    match policy::resolve(base, &decode_entities(raw))? {
        Resolved::Web(url) if !private_target(&url) => Some(url),
        _ => None,
    }
}

/// Where a picture comes from.
enum Picture {
    /// A `data:image/` address, kept as written: it reaches no network.
    Data(String),
    /// An address [`policy::judge_asset`] admits, fetched by the module.
    Fetched(String),
}

/// The candidates of a `srcset`, as the HTML standard splits them: an
/// address runs to the next space (a trailing comma ends it), its
/// descriptors to the next comma. An address may itself hold commas (`data:`).
fn srcset_candidates(text: &str) -> Vec<String> {
    let chars: Vec<char> = text.chars().collect();
    let mut out = Vec::new();
    let mut at = 0;
    while at < chars.len() {
        while at < chars.len() && (chars[at].is_whitespace() || chars[at] == ',') {
            at += 1;
        }
        let start = at;
        while at < chars.len() && !chars[at].is_whitespace() {
            at += 1;
        }
        let mut url: String = chars[start..at].iter().collect();
        if url.ends_with(',') {
            url = url.trim_end_matches(',').to_string();
        } else {
            while at < chars.len() && chars[at] != ',' {
                at += 1;
            }
        }
        if !url.is_empty() {
            out.push(url);
        }
    }
    out
}

/// The picture of an `<img>`: its `src`, or else the first `srcset`
/// candidate. `None` when it is neither a `data:image/` address nor one the
/// module may fetch.
fn picture(base: &Parsed, tag: &Tag) -> Option<Picture> {
    let raw = match tag.value("src").filter(|src| !src.trim().is_empty()) {
        Some(src) => decode_entities(src),
        None => srcset_candidates(&decode_entities(tag.value("srcset")?))
            .into_iter()
            .next()?,
    };
    match policy::resolve(base, &raw)? {
        Resolved::Web(url) => policy::judge_asset(&url)
            .ok()
            .map(|_| Picture::Fetched(url)),
        Resolved::Other { scheme, text } => (scheme == "data"
            && text["data:".len()..]
                .to_ascii_lowercase()
                .starts_with("image/"))
        .then_some(Picture::Data(text)),
    }
}

/// The address of a `<link>` that is a stylesheet the module may fetch.
fn stylesheet(base: &Parsed, tag: &Tag) -> Option<String> {
    let rel = decode_entities(tag.value("rel")?).to_ascii_lowercase();
    let tokens: Vec<&str> = rel.split_ascii_whitespace().collect();
    if !tokens.contains(&"stylesheet") || tokens.contains(&"alternate") {
        return None;
    }
    match policy::resolve(base, &decode_entities(tag.value("href")?))? {
        Resolved::Web(url) => policy::judge_asset(&url).ok().map(|_| url),
        Resolved::Other { .. } => None,
    }
}

/// The attributes of a kept start tag, filtered and written back quoted. An
/// address is kept only as a link's `data-safari-href` and a form's
/// `action`; a picture's `src` is written by [`start_tag`].
fn attributes(base: &Parsed, tag: &Tag) -> String {
    let mut out = String::new();
    let link = matches!(tag.name.as_str(), "a" | "area");
    let mut linked = false;
    for (name, value) in &tag.attributes {
        if !plain_name(name)
            || name.starts_with("on")
            || name.starts_with("data-safari")
            || DROPPED_ATTRIBUTES.contains(&name.as_str())
        {
            continue;
        }
        let address = URL_ATTRIBUTES.contains(&name.as_str());
        let Some(raw) = value else {
            if !address {
                out.push_str(&format!(" {name}"));
            }
            continue;
        };
        match name.as_str() {
            "href" | "xlink:href" if link => {
                if let Some(url) = link_target(base, raw).filter(|_| !linked) {
                    out.push_str(&format!(" data-safari-href=\"{}\"", escape_attribute(&url)));
                    linked = true;
                }
            }
            "action" if tag.name == "form" => {
                if let Some(url) = link_target(base, raw) {
                    out.push_str(&format!(" action=\"{}\"", escape_attribute(&url)));
                }
            }
            "style" => {
                if let Some(css) = clean_css(&decode_entities(raw)) {
                    out.push_str(&format!(" style=\"{}\"", escape_attribute(&css)));
                }
            }
            _ if address => {}
            _ => out.push_str(&format!(" {name}=\"{}\"", raw.replace('"', "&quot;"))),
        }
    }
    // A link without `href` is reached by Tab and named a link only when told.
    if linked && tag.name == "a" {
        if !tag.has("tabindex") {
            out.push_str(" tabindex=\"0\"");
        }
        if !tag.has("role") {
            out.push_str(" role=\"link\"");
        }
    }
    // An `<area>` is a region of its image map only with an `href`: it gets
    // the inert `#`, a fragment of the frame's own document that reaches no
    // network. The relay script takes the click and Return on it first.
    if linked && tag.name == "area" {
        out.push_str(" href=\"#\"");
    }
    out
}

/// A title as Safari shows it: references decoded, white space collapsed,
/// at most 300 characters.
fn title_text(raw: &str) -> String {
    let decoded = decode_entities(raw);
    let words: Vec<&str> = decoded.split_whitespace().collect();
    words.join(" ").chars().take(300).collect()
}

// ── The rewrite ──

/// The rewritten page as it is written: text, and the slots of its assets.
struct Out {
    pieces: Vec<Piece>,
    text: String,
    /// The bytes of text written so far.
    len: usize,
    assets: Vec<Asset>,
    title: Option<String>,
}

impl Out {
    fn push(&mut self, text: &str) {
        self.text.push_str(text);
        self.len += text.len();
    }

    fn slot(&mut self, piece: Piece) {
        if !self.text.is_empty() {
            self.pieces
                .push(Piece::Text(std::mem::take(&mut self.text)));
        }
        self.pieces.push(piece);
    }

    /// The index of the asset at `url`, added when it is new and its kind is
    /// under its cap ([`MAX_IMAGES`], [`MAX_STYLES`]).
    fn asset(&mut self, url: String, kind: AssetKind) -> Option<usize> {
        if let Some(index) = self
            .assets
            .iter()
            .position(|asset| asset.kind == kind && asset.url == url)
        {
            return Some(index);
        }
        let cap = match kind {
            AssetKind::Image => MAX_IMAGES,
            AssetKind::Style => MAX_STYLES,
        };
        if self
            .assets
            .iter()
            .filter(|asset| asset.kind == kind)
            .count()
            >= cap
        {
            return None;
        }
        self.assets.push(Asset { url, kind });
        Some(self.assets.len() - 1)
    }

    fn finish(mut self) -> Self {
        if !self.text.is_empty() {
            self.pieces
                .push(Piece::Text(std::mem::take(&mut self.text)));
        }
        self
    }
}

/// Rewrite the page's markup. `None` as soon as the rewritten markup passes
/// `cap` bytes.
fn rewrite(source: &str, base: &Parsed, cap: usize) -> Option<Out> {
    let bytes = source.as_bytes();
    let mut out = Out {
        pieces: Vec::new(),
        text: String::with_capacity(source.len() + source.len() / 4),
        len: 0,
        assets: Vec::new(),
        title: None,
    };
    // Inside how many `<template>` elements, whose content is dropped.
    let mut template_depth = 0usize;
    let mut text_from = 0;
    let mut at = 0;
    while at < bytes.len() {
        if bytes[at] != b'<' {
            at += 1;
            continue;
        }
        if template_depth == 0 {
            out.push(&source[text_from..at]);
        }
        let next = bytes.get(at + 1).copied();
        at = match next {
            Some(b'!') if source[at..].starts_with("<!--") => comment_end(source, at + 4),
            Some(b'!') | Some(b'?') => after_gt(source, at + 2),
            Some(b'/') => match bytes.get(at + 2).copied() {
                Some(b) if b.is_ascii_alphabetic() => match read_tag(source, at + 2) {
                    None => source.len(),
                    Some((tag, after)) => {
                        if tag.name == "template" {
                            template_depth = template_depth.saturating_sub(1);
                        } else if template_depth == 0
                            && plain_name(&tag.name)
                            && !DROPPED_TAGS.contains(&tag.name.as_str())
                        {
                            out.push(&format!("</{}>", tag.name));
                        }
                        after
                    }
                },
                Some(b'>') => at + 3,
                None => {
                    if template_depth == 0 {
                        out.push("&lt;/");
                    }
                    source.len()
                }
                Some(_) => after_gt(source, at + 2),
            },
            Some(b) if b.is_ascii_alphabetic() => match read_tag(source, at + 1) {
                None => source.len(),
                Some((tag, after)) => {
                    start_tag(source, base, &tag, after, &mut template_depth, &mut out)
                }
            },
            _ => {
                if template_depth == 0 {
                    out.push("&lt;");
                }
                at + 1
            }
        };
        text_from = at;
        if out.len > cap {
            return None;
        }
    }
    if template_depth == 0 && text_from < source.len() {
        out.push(&source[text_from..]);
    }
    (out.len <= cap).then(|| out.finish())
}

/// Handle a start tag that ended at `after`; returns where reading goes on.
fn start_tag(
    source: &str,
    base: &Parsed,
    tag: &Tag,
    after: usize,
    template_depth: &mut usize,
    out: &mut Out,
) -> usize {
    let name = tag.name.as_str();
    if name == "template" {
        if !tag.self_closing {
            *template_depth += 1;
        }
        return after;
    }
    if *template_depth > 0 {
        // Raw text inside a template is skipped whole, so its content
        // cannot end the template early.
        return match name {
            "script" | "style" | "title" | "textarea" | "iframe" | "noembed" | "noframes"
            | "xmp" => raw_text(source, after, name).1,
            _ => after,
        };
    }
    if !plain_name(name) {
        return after;
    }
    if DROPPED_RAW.contains(&name) {
        return raw_text(source, after, name).1;
    }
    match name {
        "style" => {
            let (end, next) = raw_text(source, after, name);
            if let Some(css) = style_block(&source[after..end]) {
                out.push(&format!("<style{}>{css}</style>", attributes(base, tag)));
            }
            next
        }
        "title" | "textarea" => {
            let (end, next) = raw_text(source, after, name);
            let content = &source[after..end];
            if name == "title" && out.title.is_none() {
                let text = title_text(content);
                if !text.is_empty() {
                    out.title = Some(text);
                }
            }
            out.push(&format!(
                "<{name}{}>{}</{name}>",
                attributes(base, tag),
                disarm_rcdata(content)
            ));
            next
        }
        "xmp" => {
            let (end, next) = raw_text(source, after, name);
            out.push(&format!("<pre>{}</pre>", escape_text(&source[after..end])));
            next
        }
        "plaintext" => {
            out.push(&format!("<pre>{}</pre>", escape_text(&source[after..])));
            source.len()
        }
        "link" => {
            if let Some(url) = stylesheet(base, tag) {
                if let Some(index) = out.asset(url, AssetKind::Style) {
                    let media = tag.value("media").map(decode_entities);
                    out.slot(Piece::Style { index, media });
                }
            }
            after
        }
        "img" => {
            out.push(&format!("<img{}", attributes(base, tag)));
            match picture(base, tag) {
                Some(Picture::Data(data)) => {
                    out.push(&format!(" src=\"{}\"", escape_attribute(&data)))
                }
                Some(Picture::Fetched(url)) => {
                    if let Some(index) = out.asset(url, AssetKind::Image) {
                        out.slot(Piece::Image(index));
                    }
                }
                None => {}
            }
            out.push(if tag.self_closing { " />" } else { ">" });
            after
        }
        _ if DROPPED_TAGS.contains(&name) => after,
        _ => {
            let close = if tag.self_closing { " /" } else { "" };
            out.push(&format!("<{name}{}{close}>", attributes(base, tag)));
            after
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base() -> Parsed {
        policy::parse("https://en.wikipedia.org/wiki/MacOS_Catalina").unwrap()
    }

    fn page(html: &str) -> Page {
        render(html, &base()).expect("within the size cap")
    }

    /// The rewritten body, without the head every page gets, with nothing
    /// fetched.
    fn body(html: &str) -> String {
        let page = page(html);
        page.html(&[])[page.head.len()..].to_string()
    }

    #[test]
    fn the_frames_policy_names_no_network_source() {
        let csp = csp();
        assert!(
            csp.starts_with("default-src 'none'; script-src 'sha256-"),
            "{csp}"
        );
        for directive in csp.split(';').map(str::trim) {
            let mut words = directive.split_whitespace();
            let name = words.next().unwrap();
            for source in words {
                let allowed = source == "'none'"
                    || source == "'unsafe-inline'"
                    || source == "data:"
                    || (name == "script-src" && source.starts_with("'sha256-"));
                assert!(allowed, "{name} allows {source}: {csp}");
            }
        }
        for needed in [
            "img-src data:",
            "font-src data:",
            "style-src 'unsafe-inline'",
            "form-action 'none'",
            "base-uri 'none'",
        ] {
            assert!(csp.contains(needed), "{needed}: {csp}");
        }
    }

    #[test]
    fn a_quote_inside_a_css_comment_does_not_hide_a_url() {
        // The bypass of the earlier scanner: the quote in the comment opened a
        // "string" that swallowed the url() after it.
        for css in [
            "/* ' */ a{background:url(http://127.0.0.1/x)}",
            "/* \" */ a{background:url(http://169.254.169.254/latest/meta-data/)}",
            "a{color:red}/*'*/b{background-image:url( //10.0.0.1/x )}/*'*/",
            "/* url( */ a{background:url('http://[::1]/x')}",
        ] {
            let out = clean_css(css).expect("readable");
            for gone in ["127.0.0.1", "169.254", "10.0.0.1", "[::1]", "/*"] {
                assert!(!out.contains(gone), "{gone} survived {css:?}: {out}");
            }
            assert!(out.contains("none"), "{out}");
        }
        let out = body("<style>/* ' */ a{background:url(http://127.0.0.1/x)}</style>");
        assert_eq!(out, "<style>  a{background:none}</style>");
        let out = body("<p style=\"/* ' */ background:url(http://127.0.0.1/x)\">p</p>");
        assert_eq!(out, "<p style=\"  background:none\">p</p>");
    }

    #[test]
    fn styles_keep_a_strict_subset_or_are_dropped() {
        let clean = |css: &str| clean_css(css);
        // Imports go, however they are written; the rule after them stays.
        assert_eq!(
            clean("@import url(https://en.wikipedia.org/a.css); a{b:c}").as_deref(),
            Some(" a{b:c}")
        );
        assert_eq!(
            clean("@IMPORT \"http://10.0.0.1/a;b.css\" screen;a{b:c}").as_deref(),
            Some("a{b:c}")
        );
        assert_eq!(
            clean("@import/**/'x.css';a{b:c}").as_deref(),
            Some("a{b:c}")
        );
        // Every url() but a data: address becomes none, in any case.
        assert_eq!(
            clean("a{background:URL(\"https://upload.wikimedia.org/x.png\") no-repeat}").as_deref(),
            Some("a{background:none no-repeat}")
        );
        assert_eq!(
            clean("@font-face{src:url(/f.woff2) format('woff2')}").as_deref(),
            Some("@font-face{src:none format('woff2')}")
        );
        assert_eq!(
            clean("a{background:url(data:image/png;base64,AA)}").as_deref(),
            Some("a{background:url(data:image/png;base64,AA)}")
        );
        assert_eq!(
            clean("a{background:url( 'DATA:image/svg+xml,<svg/>' )}").as_deref(),
            Some("a{background:url( 'DATA:image/svg+xml,<svg/>' )}")
        );
        // A function whose name only ends in url is not url().
        assert_eq!(clean("a{b:myurl(x)}").as_deref(), Some("a{b:myurl(x)}"));
        // A string is read as the browser reads it, escapes and all, and a
        // url() inside one is text.
        assert_eq!(
            clean("a::before{content:\"\\\" url(http://10.0.0.1/)\"}").as_deref(),
            Some("a::before{content:\"\\\" url(http://10.0.0.1/)\"}")
        );
        // An escape outside a string that can spell url( or @import: dropped whole.
        assert_eq!(clean("a{background:\\75rl(http://127.0.0.1/)}"), None);
        assert_eq!(clean("@\\69mport 'x.css';"), None);
        assert_eq!(
            clean(".a\\:b{color:red}").as_deref(),
            Some(".a\\:b{color:red}")
        );
        assert_eq!(
            body("<style>a{background:\\75rl(x)}</style><p style=\"b:\\75rl(x)\">p</p>"),
            "<p>p</p>"
        );
        // An unterminated comment ends the stylesheet.
        assert_eq!(clean("a{b:c}/* url(x)").as_deref(), Some("a{b:c} "));
    }

    #[test]
    fn links_go_to_safari_only_and_never_into_a_private_network() {
        let out = body(
            "<a href=\"/wiki/MacOS_Mojave\" title=m>m</a><a href=\"#History\">h</a>\
             <a href=\"/w/index.php?title=X&amp;action=edit\">e</a>\
             <a href=\"http://localhost:8787/\">l</a><a href=\"http://169.254.169.254/\">md</a>\
             <a href=\"javascript:alert(1)\">j</a><a href=\"mailto:a@b.c\">mail</a>\
             <span data-safari-href=\"http://10.0.0.1/\">forged</span>\
             <area href=//en.wikipedia.org/x><a href=/a tabindex=-1 role=button>t</a>",
        );
        assert!(
            out.contains("<a data-safari-href=\"https://en.wikipedia.org/wiki/MacOS_Mojave\" title=\"m\" tabindex=\"0\" role=\"link\">m</a>"),
            "{out}"
        );
        assert!(
            out.contains(
                "data-safari-href=\"https://en.wikipedia.org/wiki/MacOS_Catalina#History\""
            ),
            "{out}"
        );
        assert!(
            out.contains(
                "data-safari-href=\"https://en.wikipedia.org/w/index.php?title=X&amp;action=edit\""
            ),
            "{out}"
        );
        assert!(
            out.contains("<a>l</a><a>md</a><a>j</a><a>mail</a><span>forged</span>"),
            "{out}"
        );
        assert!(
            out.contains("<area data-safari-href=\"https://en.wikipedia.org/x\" href=\"#\">"),
            "{out}"
        );
        assert!(
            out.contains("<a data-safari-href=\"https://en.wikipedia.org/a\" tabindex=\"-1\" role=\"button\">t</a>"),
            "{out}"
        );
        assert!(
            !out.replace(" href=\"#\"", "").contains(" href="),
            "a frame link has nowhere to go itself: {out}"
        );
        assert_eq!(
            out.matches(" href=\"#\"").count(),
            1,
            "only the area: {out}"
        );
    }

    #[test]
    fn image_maps_keep_their_regions_and_send_them_to_safari() {
        // The journey clicks and presses Return on a map of exactly this shape.
        assert_eq!(
            body(
                "<img src=data:image/png;base64,AA usemap=#m alt=map><map name=m>\
                 <area shape=rect coords=0,0,10,10 href=/wiki/X alt=X>\
                 <area shape=rect coords=10,0,20,10 href=http://10.0.0.1/ alt=Y></map>"
            ),
            "<img usemap=\"#m\" alt=\"map\" src=\"data:image/png;base64,AA\"><map name=\"m\">\
             <area shape=\"rect\" coords=\"0,0,10,10\" data-safari-href=\"https://en.wikipedia.org/wiki/X\" alt=\"X\" href=\"#\">\
             <area shape=\"rect\" coords=\"10,0,20,10\" alt=\"Y\"></map>"
        );
    }

    #[test]
    fn pictures_and_stylesheets_become_slots_filled_only_with_what_was_fetched() {
        let page = page(
            "<link rel=stylesheet href=\"/w/load.php?only=styles\" media=screen>\
             <link rel=\"alternate stylesheet\" href=/alt.css><link rel=icon href=/favicon.ico>\
             <link rel=stylesheet href=\"http://10.0.0.1/s.css\"><link rel=stylesheet href=\"https://evil.example/s.css\">\
             <img src=\"//upload.wikimedia.org/a.png\" srcset=\"//upload.wikimedia.org/a2.png 2x\" alt=A>\
             <img srcset=\"/b.png 1x, /b2.png 2x\"><img src=\"//upload.wikimedia.org/a.png\">\
             <img src=\"http://169.254.169.254/x.png\" alt=md><img src=\"https://evil.example/x.png\">\
             <img src=\"data:image/png;base64,AAAA\"><img src=\"data:text/html,<script>x</script>\">",
        );
        let urls: Vec<(&str, AssetKind)> = page
            .assets
            .iter()
            .map(|asset| (asset.url.as_str(), asset.kind))
            .collect();
        assert_eq!(
            urls,
            [
                (
                    "https://en.wikipedia.org/w/load.php?only=styles",
                    AssetKind::Style
                ),
                ("https://upload.wikimedia.org/a.png", AssetKind::Image),
                ("https://en.wikipedia.org/b.png", AssetKind::Image),
            ]
        );
        let bare = page.html(&[]);
        let body = &bare[page.head.len()..];
        assert_eq!(
            body,
            "<img alt=\"A\"><img><img><img alt=\"md\"><img>\
             <img src=\"data:image/png;base64,AAAA\"><img>"
        );
        let fetched = page.html(&[
            Some("a{color:red}".into()),
            Some("data:image/png;base64,QQ==".into()),
            None,
        ]);
        assert!(
            fetched.ends_with(
                "<style media=\"screen\">a{color:red}</style><img alt=\"A\" src=\"data:image/png;base64,QQ==\">\
                 <img><img src=\"data:image/png;base64,QQ==\"><img alt=\"md\"><img>\
                 <img src=\"data:image/png;base64,AAAA\"><img>"
            ),
            "{fetched}"
        );
        // Each kind stops at its cap.
        let many: String = (0..MAX_IMAGES + 5)
            .map(|n| format!("<img src=/i{n}.png>"))
            .collect();
        assert_eq!(super::tests::page(&many).assets.len(), MAX_IMAGES);
    }

    #[test]
    fn svg_animation_cannot_put_an_address_back() {
        let out = body(
            "<svg><a id=x><set attributeName=href to=\"http://10.0.0.1/\"/>\
             <animate attributeName=\"xlink:href\" values=\"https://evil.example/\" begin=0s/>\
             <text>t</text></a><image><animateMotion dur=1s/><animateTransform/></image>\
             <SET attributeName=href to=//evil.example/></SET><discard/></svg>",
        );
        assert_eq!(
            out,
            "<svg><a id=\"x\"><text>t</text></a><image></image></svg>"
        );
    }

    #[test]
    fn a_picture_named_many_times_cannot_grow_the_page_without_bound() {
        let page = page(&"<img src=//upload.wikimedia.org/a.png>".repeat(10_000));
        assert_eq!(page.assets.len(), 1);
        let picture = Some(format!("data:image/png;base64,{}", "A".repeat(512 * 1024)));
        let fetched = [picture];
        assert_eq!(page.html_within(&fetched, 3 * 1024 * 1024), None);
        let bare = page.html_within(&[], 3 * 1024 * 1024).unwrap();
        assert!(bare.len() < 3 * 1024 * 1024);
        let two = super::tests::page(&"<img src=//upload.wikimedia.org/a.png>".repeat(2));
        assert!(two.html_within(&fetched, 3 * 1024 * 1024).is_some());
    }

    #[test]
    fn every_other_address_attribute_is_dropped() {
        let out = body(
            "<video src=/v.mp4 poster=/p.png><source src=/v.webm><track src=/t.vtt></video>\
             <audio src=/a.mp3></audio><table background=/b.png><tr><td background=/c.png>x</td></tr></table>\
             <blockquote cite=http://10.0.0.1/>q</blockquote><svg><image href=/i.png xlink:href=/j.png></image>\
             <use href=\"#icon\"></use></svg><input type=image src=/s.png><a href=/x attributionsrc=/r>a</a>\
             <img src=x.png lowsrc=/l.png dynsrc=/d.avi longdesc=/ld.html>",
        );
        for gone in [
            "src=\"/",
            "poster",
            "background",
            "cite",
            " href=",
            "xlink:href",
            "attributionsrc",
            "lowsrc",
            "dynsrc",
            "longdesc",
            "10.0.0.1",
        ] {
            assert!(!out.contains(gone), "{gone} survived: {out}");
        }
    }

    #[test]
    fn escapes_that_cannot_spell_a_name_stay_and_the_others_refuse_the_sheet() {
        for kept in [
            ".md\\:flex{color:red}",
            ".w-1\\/2{width:50%}",
            ".\\32xl\\:p-1{padding:0}",
            ".\\31 0{top:0}",
            ".a\\\\b{top:0}",
        ] {
            assert_eq!(clean_css(kept).as_deref(), Some(kept));
        }
        for refused in [
            "a{background:\\75rl(https://evil.example/x)}",
            "a{background:u\\72l(https://evil.example/x)}",
            "a{background:\\u\\r\\l(https://evil.example/x)}",
            "\\40import 'https://evil.example/x';",
            "@\\69mport 'https://evil.example/x';",
            "a\\\n{top:0}",
            "a\\",
        ] {
            assert_eq!(clean_css(refused), None, "{refused}");
        }
        // An escaped quote opens no string, so what follows is still read.
        assert_eq!(
            clean_css(".a\\\"{background:url(https://evil.example/x)}").as_deref(),
            Some(".a\\\"{background:none}")
        );
        // An escaped `@` opens no at-rule, and the address after it is still dropped.
        assert_eq!(
            clean_css("\\@import url(https://evil.example/x);").as_deref(),
            Some("\\@import none;")
        );
    }

    #[test]
    fn hostile_pages_are_read_in_linear_time_and_their_growth_is_capped() {
        // Ampersands without semicolons, in an attribute, a title and text.
        let ampersands = "&".repeat(400_000);
        assert_eq!(decode_entities(&ampersands).len(), 400_000);
        let html = format!("<title>{ampersands}</title><p title=\"{ampersands}\">x</p>");
        assert!(render(&html, &base()).is_some());
        assert_eq!(decode_entities("&amp;&#x41;&lt"), "&A&lt");
        // Many raw elements, comments and attributes: each read once.
        let many = "<script>x</script><!-- a -- b --><p a=1 a=2 a=3>t</p>".repeat(20_000);
        assert_eq!(body(&many).matches("<p a=\"1\">t</p>").count(), 20_000);
        let wide = format!(
            "<p {}>t</p>",
            (0..5_000)
                .map(|n| format!("a{n}=1"))
                .collect::<Vec<_>>()
                .join(" ")
        );
        assert_eq!(body(&wide).matches("=\"1\"").count(), MAX_ATTRIBUTES);
        // A long address times many short relative links would pass the cap.
        let long = policy::parse(&format!("https://example.com/{}/x", "d".repeat(3_900))).unwrap();
        let links = "<a href=a>x</a>".repeat(100_000);
        assert!(
            render(&links, &long).is_none(),
            "too large once written out"
        );
        assert!(render("<p>small</p>", &long).is_some());
        assert!(text_page(&"<".repeat(MAX_RENDERED), &long).is_none());
        // Comments and strings in a stylesheet are read once too.
        let css = "/* ' */ a{b:'x'} ".repeat(50_000);
        assert!(clean_css(&css).is_some());
    }

    #[test]
    fn scripts_frames_and_plugins_are_dropped_with_their_content() {
        let out = body(
            "<p>a</p><script>alert(1)</script><SCRIPT type=module>x()</SCRIPT ><p>b</p>\
             <iframe src=//evil.example>fallback <script>y()</script></iframe>\
             <object data=x.swf><p>c</p></object><embed src=x.swf><applet code=x></applet>\
             <noembed><img src=x onerror=alert(2)></noembed><frameset><frame src=x></frameset>",
        );
        assert_eq!(out, "<p>a</p><p>b</p><p>c</p>");
    }

    #[test]
    fn handlers_targets_and_script_urls_are_removed() {
        let out = body(
            "<a href=\"javascript:alert(1)\" onclick=\"x()\" target=_blank ping=/p>1</a>\
             <a href=\"jav&#x61;script:alert(1)\">2</a><a href=\"java&Tab;script:alert(1)\">3</a>\
             <a href=\" JaVaScRiPt:alert(1)\">4</a><img src=x.png ONERROR=alert(1) onload = 'y()'>\
             <form action=\"javascript:x\"><button formaction=//evil.example>go</button></form>\
             <div style=\"background:url(javascript:alert(1))\" id=k>5</div>\
             <svg><a xlink:href=\"javascript:x\">7</a></svg>",
        );
        for gone in [
            "javascript",
            "onclick",
            "onerror",
            "onload",
            "target",
            "ping",
            "formaction",
            "evil",
        ] {
            assert!(!out.to_lowercase().contains(gone), "{gone} survived: {out}");
        }
        assert!(out.contains("<form><button>go</button></form>"), "{out}");
        // An unquoted url() ends at its first `)`, as the browser's bad-url
        // token does; what follows it is plain text.
        assert!(
            out.contains("<div style=\"background:none)\" id=\"k\">5</div>"),
            "{out}"
        );
    }

    #[test]
    fn forms_keep_an_absolute_action_for_the_frame_script() {
        let out = body(
            "<form action=\"/w/index.php\" method=get><input name=search></form>\
             <form action=\"http://192.168.1.1/login\" method=post></form>",
        );
        assert_eq!(
            out,
            "<form action=\"https://en.wikipedia.org/w/index.php\" method=\"get\"><input name=\"search\"></form>\
             <form method=\"post\"></form>"
        );
    }

    #[test]
    fn base_meta_and_templates_are_dropped_and_noscript_content_shows() {
        let out = body(
            "<head><base href=https://evil.example/><meta http-equiv=refresh content=\"0;url=https://evil.example\">\
             <meta http-equiv=Content-Security-Policy content=\"script-src *\">\
             <meta name=safari-page content=\"https://evil.example/\"></head>\
             <body><template><p>hidden<template>deeper</template></p><script>z</script></template>\
             <noscript><img src=lazy.png alt=l></noscript></body>",
        );
        assert_eq!(out, "<head></head><body><img alt=\"l\"></body>");
    }

    #[test]
    fn comments_and_declarations_are_read_as_the_browser_reads_them() {
        assert_eq!(body("a<!-- <script>x</script> -->b"), "ab");
        assert_eq!(body("a<!-->b<!--->c"), "abc");
        assert_eq!(body("a<!-- x --!><p>b</p>"), "a<p>b</p>");
        assert_eq!(body("<!DOCTYPE html><?xml x?>a</>b"), "ab");
        assert_eq!(
            body("1 < 2 <3 a<b"),
            "1 &lt; 2 &lt;3 a",
            "a tag cut off by the end of the input is dropped"
        );
        assert_eq!(
            body("<p title='a\"b' class=x>t</p>"),
            "<p title=\"a&quot;b\" class=\"x\">t</p>"
        );
        assert_eq!(
            body("<a href=/a href=javascript:x>t</a>"),
            "<a data-safari-href=\"https://en.wikipedia.org/a\" tabindex=\"0\" role=\"link\">t</a>",
            "the first spelling wins, as in the browser"
        );
        assert_eq!(body("<p/onclick=alert(1)>x"), "<p>x");
        assert_eq!(
            body("<a\"b onclick=x>t</a\"b>"),
            "t",
            "a tag whose name is not plain is dropped"
        );
    }

    #[test]
    fn raw_text_cannot_open_a_tag_whatever_the_browser_makes_of_it() {
        let out = body("<svg><style><img src=x onerror=alert(1)></style></svg>");
        assert!(!out.contains("<img"), "{out}");
        assert!(out.contains("\\3c img"), "{out}");
        let out = body("<style>a{color:red}</STYLE><p>after</p>");
        assert_eq!(out, "<style>a{color:red}</style><p>after</p>");
        let out = body(
            "<style>@media (width < 600px){a{b:c}} x{background:url(javascript:alert(1))}</style>",
        );
        assert!(
            out.contains("(width < 600px)") && !out.contains("javascript:"),
            "{out}"
        );
        let out = body("<textarea></textarea><img src=x onerror=alert(1)></textarea>");
        assert_eq!(out, "<textarea></textarea><img></textarea>");
        let out = body("<title>A &amp; B</title><svg><title><img src=x onerror=y></title></svg>");
        assert!(
            out.starts_with("<title>A &amp; B</title>")
                && out.contains("&lt;img")
                && !out.contains("<img"),
            "{out}"
        );
        assert_eq!(
            body("<xmp><script>x</script></xmp>"),
            "<pre>&lt;script&gt;x&lt;/script&gt;</pre>"
        );
        assert_eq!(
            body("<script><!--<script></script>alert(1)</script>"),
            "alert(1)"
        );
        // A fetched stylesheet is made safe the same way before it goes in.
        assert_eq!(
            style_block("a{b:c}</style><script>x</script>@import 'y';").as_deref(),
            Some("a{b:c}\\3c /style>\\3c script>x\\3c /script>")
        );
    }

    #[test]
    fn the_title_is_the_first_one_decoded_and_collapsed() {
        let page = render(
            "<title>\n macOS  Catalina &#8211; Wikipedia </title><title>second</title>",
            &base(),
        )
        .unwrap();
        assert_eq!(page.title.as_deref(), Some("macOS Catalina – Wikipedia"));
        assert_eq!(render("<p>x</p>", &base()).unwrap().title, None);
    }

    #[test]
    fn every_page_starts_with_the_policy_its_address_and_the_frame_script() {
        let page = render(
            "<p>x</p>",
            &policy::parse("https://example.com/a?b=1#c").unwrap(),
        )
        .unwrap();
        let html = page.html(&[]);
        let policy_at = html.find("Content-Security-Policy").unwrap();
        assert!(policy_at < html.find("<script").unwrap());
        assert!(
            html.contains("<meta name=\"safari-page\" content=\"https://example.com/a?b=1#c\">")
        );
        assert!(!html.contains("<base"), "{html}");
        assert!(html.contains(&format!("<script>{FRAME_SCRIPT}</script>")));
        assert!(html.ends_with("<p>x</p>"));
        assert!(
            !FRAME_SCRIPT.contains("</"),
            "the frame script cannot end its own element"
        );
        assert!(
            FRAME_SCRIPT.contains("data-safari-href") && !FRAME_SCRIPT.contains("baseURI"),
            "the script follows only the links the rewriter wrote"
        );
    }

    #[test]
    fn base64_matches_the_rfc_4648_vectors() {
        for (input, expected) in [
            ("", ""),
            ("f", "Zg=="),
            ("fo", "Zm8="),
            ("foo", "Zm9v"),
            ("foob", "Zm9vYg=="),
            ("fooba", "Zm9vYmE="),
            ("foobar", "Zm9vYmFy"),
        ] {
            assert_eq!(base64(input.as_bytes()), expected);
        }
    }

    #[test]
    fn markup_is_told_from_plain_text() {
        assert!(is_markup("\u{feff}<!DOCTYPE html><html>"));
        assert!(is_markup("  <html lang=en>"));
        assert!(!is_markup("Network Working Group   RFC 2616"));
        assert!(!is_markup("{\"json\": true}"));
        let page = text_page("a <b> & c", &base()).unwrap();
        assert!(page.html(&[]).ends_with("a &lt;b&gt; &amp; c</pre>"));
        assert!(page.assets.is_empty());
    }
}

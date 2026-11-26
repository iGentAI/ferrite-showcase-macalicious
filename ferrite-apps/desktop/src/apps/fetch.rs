//! Outbound HTTPS for the modules that read public sources (Dictionary,
//! Stocks, Maps): one GET through a declared egress handle, bounded in time,
//! several at once, and the small text helpers their parsers share.
//!
//! Egress reaches only the destinations `ferrite.json` declares for a
//! handle (a literal `https://` prefix), follows no redirect, hands back no
//! response header and refuses a body over 1 MiB. Its own timeout (10 s)
//! is longer than the API deadline (8 s), so every call here carries a
//! deadline of its own and gives up first: the module then answers with what
//! it has instead of the gateway answering 504.

use std::future::Future;
use std::pin::Pin;
use std::task::Poll;

use ferrite_app::{AppContext, EgressHeader, EgressHttpMethod, EgressOutcome};

/// How the application introduces itself to public sources. Wikimedia and
/// OpenStreetMap ask for an agent that names the application and a contact.
pub const USER_AGENT: &str =
    "macalicious-desktop/1.0 (Ferrite demo; +https://macalicious.ferrite.run/)";

/// What one GET came to.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Fetched {
    /// HTTP 200 with this body.
    Body(Vec<u8>),
    /// HTTP 404 or 410: the source has nothing under that name.
    Missing,
    /// Anything else, said in a few words for a reply or the log.
    Failed(String),
}

impl Fetched {
    /// The body of a 200, or `None`.
    pub fn body(&self) -> Option<&[u8]> {
        match self {
            Fetched::Body(body) => Some(body),
            _ => None,
        }
    }
}

/// The largest body a fetch accepts: egress refuses a larger one, and this
/// holds the same bound wherever egress is not the platform's (a local run).
pub const MAX_BODY_BYTES: usize = 1 << 20;

/// Strict reading of upstream answers and stored records, the one rule every
/// parser of the source modules (Dictionary, Stocks, Maps) and Find My's
/// device records follows: a reply or record that does not have its
/// documented shape is a [`strict::Mismatch`] for the whole of it. A parser
/// never skips the item it cannot read or substitutes a default for a field
/// of the wrong type, so a mismatch fails its source or request with the
/// mismatch named, and nothing read from it is cached or answered as a
/// partial success. A field the documentation marks optional may be absent
/// (or JSON `null`, where the source writes that); present, it must have its
/// type.
pub mod strict {
    use ferrite_app::serde::de::DeserializeOwned;
    use ferrite_app::serde_json::{self, Map, Value};

    /// Why an answer or record does not have its documented shape.
    #[derive(Debug, Clone, PartialEq, Eq)]
    pub struct Mismatch(pub String);

    impl std::fmt::Display for Mismatch {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            f.write_str(&self.0)
        }
    }

    /// A strictly read value, or why it is not one.
    pub type Strict<T> = Result<T, Mismatch>;

    /// A mismatch saying `what`.
    pub fn fail<T>(what: impl Into<String>) -> Strict<T> {
        Err(Mismatch(what.into()))
    }

    /// `body` as JSON.
    pub fn json(body: &[u8]) -> Strict<Value> {
        serde_json::from_slice(body).map_err(|error| Mismatch(format!("not JSON: {error}")))
    }

    /// `bytes` as a `T`, every field of it.
    pub fn decode<T: DeserializeOwned>(bytes: &[u8], what: &str) -> Strict<T> {
        serde_json::from_slice(bytes).map_err(|error| Mismatch(format!("{what}: {error}")))
    }

    /// `value` as an object.
    pub fn object<'a>(value: &'a Value, what: &str) -> Strict<&'a Map<String, Value>> {
        value
            .as_object()
            .ok_or_else(|| Mismatch(format!("{what} is not an object")))
    }

    /// `value` as a list.
    pub fn list<'a>(value: &'a Value, what: &str) -> Strict<&'a Vec<Value>> {
        value
            .as_array()
            .ok_or_else(|| Mismatch(format!("{what} is not a list")))
    }

    /// The field `key` of `item`, which must be there (and not `null`).
    pub fn field<'a>(item: &'a Map<String, Value>, key: &str) -> Strict<&'a Value> {
        match item.get(key) {
            None | Some(Value::Null) => fail(format!("`{key}` is missing")),
            Some(value) => Ok(value),
        }
    }

    /// The field `key` of `item` when it is there. A present `null` is not
    /// absence: the readers below fail it as a value of the wrong type,
    /// since none of the sources read here writes `null` for a field it
    /// leaves out.
    pub fn optional<'a>(item: &'a Map<String, Value>, key: &str) -> Option<&'a Value> {
        item.get(key)
    }

    /// The text field `key`, which must be there.
    pub fn text<'a>(item: &'a Map<String, Value>, key: &str) -> Strict<&'a str> {
        field(item, key)?
            .as_str()
            .ok_or_else(|| Mismatch(format!("`{key}` is not text")))
    }

    /// The text field `key` when it is there; present, it must be text.
    pub fn optional_text<'a>(item: &'a Map<String, Value>, key: &str) -> Strict<Option<&'a str>> {
        match optional(item, key) {
            None => Ok(None),
            Some(Value::String(text)) => Ok(Some(text)),
            Some(_) => fail(format!("`{key}` is not text")),
        }
    }

    /// The number field `key`, which must be there.
    pub fn number(item: &Map<String, Value>, key: &str) -> Strict<f64> {
        field(item, key)?
            .as_f64()
            .filter(|n| n.is_finite())
            .ok_or_else(|| Mismatch(format!("`{key}` is not a number")))
    }

    /// The list field `key` when it is there; present, it must be a list.
    pub fn optional_list<'a>(
        item: &'a Map<String, Value>,
        key: &str,
    ) -> Strict<Option<&'a Vec<Value>>> {
        optional(item, key)
            .map(|value| list(value, &format!("`{key}`")))
            .transpose()
    }

    /// The object field `key` when it is there; present, it must be one.
    pub fn optional_object<'a>(
        item: &'a Map<String, Value>,
        key: &str,
    ) -> Strict<Option<&'a Map<String, Value>>> {
        optional(item, key)
            .map(|value| object(value, &format!("`{key}`")))
            .transpose()
    }

    /// Every item of `items` read by `read`: the first that does not read
    /// fails the whole list, named by its place in it.
    pub fn each<T>(
        items: &[Value],
        what: &str,
        mut read: impl FnMut(&Value) -> Strict<T>,
    ) -> Strict<Vec<T>> {
        items
            .iter()
            .enumerate()
            .map(|(at, item)| {
                read(item).map_err(|Mismatch(why)| Mismatch(format!("{what}[{at}]: {why}")))
            })
            .collect()
    }
}

/// Run `work` for at most `ms`: its output, or `None` when time ran out.
/// (Upstream Core's SDK has no egress deadline of its own.) Both futures are
/// pinned in a box: the hosted code gate refuses the `pin!` macro.
pub async fn within<F: Future>(ms: u64, work: F) -> Option<F::Output> {
    let mut work = Box::pin(work);
    let mut timer = Box::pin(ferrite_app::sleep_ms(ms));
    std::future::poll_fn(move |context| {
        if let Poll::Ready(output) = work.as_mut().poll(context) {
            return Poll::Ready(Some(output));
        }
        if timer.as_mut().poll(context).is_ready() {
            return Poll::Ready(None);
        }
        Poll::Pending
    })
    .await
}

/// A boxed fetch, so fetches of different shapes can run together.
pub type Pending<'a> = Pin<Box<dyn Future<Output = Fetched> + Send + 'a>>;

/// Run every fetch at once and answer their results in the order given.
pub async fn all(mut work: Vec<Pending<'_>>) -> Vec<Fetched> {
    let mut done: Vec<Option<Fetched>> = work.iter().map(|_| None).collect();
    std::future::poll_fn(move |context| {
        let mut pending = false;
        for (slot, future) in done.iter_mut().zip(work.iter_mut()) {
            if slot.is_none() {
                match future.as_mut().poll(context) {
                    Poll::Ready(output) => *slot = Some(output),
                    Poll::Pending => pending = true,
                }
            }
        }
        if pending {
            Poll::Pending
        } else {
            Poll::Ready(
                done.iter_mut()
                    .map(|slot| {
                        slot.take()
                            .unwrap_or_else(|| Fetched::Failed("not run".into()))
                    })
                    .collect(),
            )
        }
    })
    .await
}

/// GET `url` through egress handle `handle` with `accept`, giving up after
/// `ms`. The agent is [`USER_AGENT`].
pub async fn get(ctx: &AppContext, handle: &str, url: &str, accept: &str, ms: u64) -> Fetched {
    let mut egress = match ctx.egress(handle) {
        Ok(egress) => egress,
        Err(error) => return Fetched::Failed(format!("no egress '{handle}': {error}")),
    };
    let headers = [
        EgressHeader {
            name: "user-agent".into(),
            value: USER_AGENT.into(),
        },
        EgressHeader {
            name: "accept".into(),
            value: accept.into(),
        },
    ];
    let exchange = egress.deliver_http(EgressHttpMethod::Get, url, &headers, &[]);
    match within(ms, exchange).await {
        None => Fetched::Failed("the source did not answer in time".into()),
        Some(Ok(EgressOutcome::Delivered { status: 200, body })) if body.len() > MAX_BODY_BYTES => {
            Fetched::Failed(format!(
                "the source answered more than {MAX_BODY_BYTES} bytes"
            ))
        }
        Some(Ok(EgressOutcome::Delivered { status: 200, body })) => Fetched::Body(body),
        Some(Ok(EgressOutcome::Delivered {
            status: 404 | 410, ..
        })) => Fetched::Missing,
        Some(Ok(EgressOutcome::Delivered { status, .. })) => {
            Fetched::Failed(format!("the source answered HTTP {status}"))
        }
        Some(Ok(EgressOutcome::Denied { reason })) => {
            Fetched::Failed(format!("egress refused the request: {reason}"))
        }
        Some(Err(error)) => Fetched::Failed(format!("the source could not be reached: {error}")),
    }
}

/// `text` percent-encoded for a URL's path segment or query value: every
/// byte but the unreserved ASCII letters, digits and `-._~`.
pub fn encode(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for byte in text.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'.' | b'_' | b'~') {
            out.push(byte as char);
        } else {
            out.push_str(&format!("%{byte:02X}"));
        }
    }
    out
}

/// The text of a fragment of HTML: tags removed, the common entities
/// decoded, runs of white space made one space, trimmed.
pub fn text_of(html: &str) -> String {
    let mut stripped = String::with_capacity(html.len());
    let mut in_tag = false;
    for ch in html.chars() {
        match ch {
            '<' => in_tag = true,
            '>' if in_tag => in_tag = false,
            _ if !in_tag => stripped.push(ch),
            _ => {}
        }
    }
    let decoded = decode_entities(&stripped);
    decoded.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// The most bytes from an entity's `&` to its `;` (`&#x10FFFF;` is nine).
const MAX_ENTITY_BYTES: usize = 10;

/// `text` with `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`, `&nbsp;` and
/// numeric character references decoded; anything else is left as it is.
pub fn decode_entities(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(at) = rest.find('&') {
        out.push_str(&rest[..at]);
        let after = &rest[at..];
        // An entity is at most ten bytes from its `&` to its `;`, so only the
        // next ten bytes are searched: text full of `&` with no `;` stays one
        // pass.
        let Some(end) = after
            .bytes()
            .take(MAX_ENTITY_BYTES + 1)
            .position(|byte| byte == b';')
        else {
            out.push('&');
            rest = &after[1..];
            continue;
        };
        let name = &after[1..end];
        let decoded = match name {
            "amp" => Some('&'),
            "lt" => Some('<'),
            "gt" => Some('>'),
            "quot" => Some('"'),
            "apos" => Some('\''),
            "nbsp" => Some(' '),
            _ => name
                .strip_prefix("#x")
                .or_else(|| name.strip_prefix("#X"))
                .and_then(|hex| u32::from_str_radix(hex, 16).ok())
                .or_else(|| name.strip_prefix('#').and_then(|dec| dec.parse().ok()))
                .and_then(char::from_u32),
        };
        match decoded {
            Some(ch) => {
                out.push(ch);
                rest = &after[end + 1..];
            }
            None => {
                out.push('&');
                rest = &after[1..];
            }
        }
    }
    out.push_str(rest);
    out
}

/// At most `max` characters of `text`, cut at the last sentence end (or
/// else the last space) before the limit, with an ellipsis when cut.
pub fn clip(text: &str, max: usize) -> String {
    if text.chars().count() <= max {
        return text.to_string();
    }
    let cut: String = text.chars().take(max).collect();
    if let Some(end) = cut.rfind(". ").filter(|end| *end > max / 3) {
        return cut[..=end].to_string();
    }
    match cut.rfind(' ') {
        Some(space) => format!("{}…", &cut[..space]),
        None => format!("{cut}…"),
    }
}

#[cfg(test)]
mod tests {
    use super::{clip, decode_entities, encode, strict, text_of};

    #[test]
    fn encoding_keeps_only_unreserved_bytes() {
        assert_eq!(encode("ice cream"), "ice%20cream");
        assert_eq!(encode("a&b=c/d?"), "a%26b%3Dc%2Fd%3F");
        assert_eq!(encode("café"), "caf%C3%A9");
        assert_eq!(encode("X-y_z.~"), "X-y_z.~");
    }

    #[test]
    fn html_becomes_plain_text() {
        assert_eq!(
            text_of(
                r#"The <a rel="mw:WikiLink" href="/wiki/x">phenomenon</a>  of &quot;luck&quot; &amp; <i>chance</i>&#46;"#
            ),
            "The phenomenon of \"luck\" & chance."
        );
        assert_eq!(
            decode_entities("a &unknown; b &#x41; &#66;"),
            "a &unknown; b A B"
        );
        assert_eq!(decode_entities("fish & chips"), "fish & chips");
        // The longest entity named by its number still decodes; one with its
        // `;` past the limit is left as text.
        assert_eq!(decode_entities("&#x1F600;"), "\u{1F600}");
        assert_eq!(decode_entities("&#00000065;"), "A");
        assert_eq!(decode_entities("&#000000065;"), "&#000000065;");
    }

    #[test]
    fn bare_ampersands_are_decoded_in_one_pass() {
        // Each `&` looks no further than an entity can reach for its `;`, so
        // 200,000 of them with no `;` anywhere take one pass, not 200,000
        // searches of the rest of the text.
        let text = "&".repeat(200_000);
        assert_eq!(decode_entities(&text), text);
        let mixed = format!("{}&amp;", "& ".repeat(100_000));
        assert_eq!(
            decode_entities(&mixed),
            format!("{}&", "& ".repeat(100_000))
        );
    }

    #[test]
    fn a_strict_read_fails_the_whole_answer_and_names_what_did_not_match() {
        use strict::{
            decode, each, fail, field, json, list, object, optional_list, optional_object,
            optional_text, text,
        };
        let body = r#"{"items":[{"name":"a","n":1},{"name":2,"n":2}],"note":null}"#;
        let answer = json(body.as_bytes()).unwrap();
        let top = object(&answer, "the answer").unwrap();
        let items = list(field(top, "items").unwrap(), "`items`").unwrap();
        let names = each(items, "items", |item| {
            Ok(text(object(item, "an item")?, "name")?.to_string())
        });
        assert_eq!(names, fail("items[1]: `name` is not text"));
        assert_eq!(optional_text(top, "absent"), Ok(None));
        // A present null is a value of the wrong type, never an absent field.
        assert_eq!(optional_text(top, "note"), fail("`note` is not text"));
        assert_eq!(optional_list(top, "note"), fail("`note` is not a list"));
        assert_eq!(
            optional_object(top, "note"),
            fail("`note` is not an object")
        );
        assert_eq!(
            optional_text(object(&items[0], "x").unwrap(), "n"),
            fail("`n` is not text"),
            "present, an optional field has its type"
        );
        assert_eq!(field(top, "note"), fail("`note` is missing"));
        assert!(json(b"<html>").is_err());
        assert!(decode::<u32>(b"[1]", "a count").is_err());
    }

    #[test]
    fn long_text_is_clipped_at_a_sentence() {
        let text = "One sentence here. Another sentence that goes on and on and on.";
        assert_eq!(clip(text, 40), "One sentence here.");
        assert_eq!(clip("short", 40), "short");
        assert_eq!(clip("word word word word", 12), "word word…");
    }

    /// The destinations `ferrite.json` declares for egress handle `handle`.
    fn declared(handle: &str) -> Vec<String> {
        let spec: ferrite_app::serde_json::Value =
            ferrite_app::serde_json::from_str(include_str!("../../tests/fixtures/ferrite.json"))
                .expect("ferrite.json parses");
        let grants = spec["applications"][0]["egress"]
            .as_array()
            .expect("egress");
        let grant = grants
            .iter()
            .find(|grant| grant["handle"] == handle)
            .unwrap_or_else(|| panic!("ferrite.json declares no egress handle '{handle}'"));
        grant["destinations"]
            .as_array()
            .expect("destinations")
            .iter()
            .map(|d| d.as_str().expect("destination").to_string())
            .collect()
    }

    #[test]
    fn every_source_url_is_declared_under_its_handle() {
        use crate::apps::{dictionary, maps, stocks};
        let cnbc = stocks::provider::provider();
        let mut asked: Vec<(&str, String)> = vec![
            (
                dictionary::EGRESS,
                format!("{}luck", dictionary::WIKTIONARY),
            ),
            (
                dictionary::EGRESS,
                format!("{}luck", dictionary::FREE_DICTIONARY),
            ),
            (
                dictionary::EGRESS,
                format!("{}words?ml=luck", dictionary::DATAMUSE),
            ),
            (
                dictionary::EGRESS,
                format!("{}sug?s=lu", dictionary::DATAMUSE),
            ),
            (
                dictionary::EGRESS,
                format!("{}?action=query", dictionary::WIKIPEDIA),
            ),
            (maps::SEARCH_EGRESS, maps::search_request("Paris", None).0),
            (maps::SEARCH_EGRESS, maps::reverse_request(48.8, 2.3).0),
            (stocks::EGRESS, (cnbc.quotes_url)(&["AAPL".to_string()])),
            (stocks::EGRESS, (cnbc.chart_url)("AAPL", "1D")),
            (stocks::EGRESS, (cnbc.search_url)("tes")),
        ];
        asked.extend(
            cnbc.news_urls
                .iter()
                .map(|url| (stocks::EGRESS, url.to_string())),
        );
        for (handle, url) in asked {
            let destinations = declared(handle);
            assert!(
                destinations.len() <= crate::apps::egress::MAX_DESTINATIONS,
                "{handle}"
            );
            assert!(
                destinations.iter().any(|d| url.starts_with(d.as_str())),
                "{url} is not under a destination of '{handle}': {destinations:?}"
            );
        }
    }
}

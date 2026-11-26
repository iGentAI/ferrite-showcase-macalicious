//! Where Stocks gets its market data: one [`Provider`], chosen by
//! [`provider`].
//!
//! A provider is the addresses of its four questions (quotes, a chart, a
//! symbol search, business news) and a parser for each answer, all into this
//! module's own shapes, so the routes in `mod.rs` never see a provider's
//! format. The one provider today is [`CNBC`]: CNBC's public quote, chart,
//! symbol and RSS services, which need no key and answer delayed or
//! real-time US quotes as CNBC's own pages show them. They are not a licensed
//! data feed and their terms of use were not verified for redistribution; a
//! deployment with real traffic should switch to a keyed provider (for
//! example Finnhub or Polygon) by adding a second [`Provider`] value, its
//! hosts to the `stocks` egress handle in `ferrite.json`, and its key as a
//! Ferrite secret read in [`provider`].

use ferrite_app::{serde, serde_json};
use serde_json::Value;

use super::fetch;
use super::fetch::strict::{self, Strict};

/// The spans of time a chart can show, as the window names them.
pub const RANGES: &[&str] = &["1D", "1W", "1M", "3M", "6M", "1Y", "2Y"];

/// One quote, in the module's shape.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Quote {
    pub symbol: String,
    pub name: String,
    pub price: f64,
    pub change: f64,
    pub previous_close: Option<f64>,
    pub open: Option<f64>,
    pub high: Option<f64>,
    pub low: Option<f64>,
    pub year_high: Option<f64>,
    pub year_low: Option<f64>,
    pub volume: Option<String>,
    pub market_cap: Option<String>,
    pub pe: Option<String>,
    pub currency: Option<String>,
    pub exchange: Option<String>,
    /// `stock`, `index`, `fund` or another kind the provider names.
    pub kind: String,
    /// When the price was set, as the provider writes it ("12:09 PM EDT").
    pub time: Option<String>,
}

/// One point of a chart: epoch ms and the closing price.
pub type Point = (u64, f64);

/// One symbol a search found.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Found {
    pub symbol: String,
    pub name: String,
    pub exchange: String,
    pub kind: String,
}

/// One business story.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Story {
    pub id: String,
    pub headline: String,
    pub summary: String,
    pub url: String,
    pub published_ms: u64,
    pub publisher: String,
}

/// A source of market data. Each parser reads its answer strictly
/// (`fetch::strict`): an answer not in the provider's documented shape is a
/// mismatch for the whole of it.
pub struct Provider {
    /// Its name, as the window credits it.
    pub name: &'static str,
    /// The address the window links to for the provider's terms.
    pub home: &'static str,
    pub quotes_url: fn(&[String]) -> String,
    /// The quotes of the symbols the provider knows; an unknown symbol is
    /// left out.
    pub parse_quotes: fn(&[u8]) -> Strict<Vec<Quote>>,
    pub chart_url: fn(&str, &str) -> String,
    /// The points of a range from the answer, oldest first, given the time
    /// now (epoch ms).
    pub parse_chart: fn(&[u8], &str, u64) -> Strict<Vec<Point>>,
    pub search_url: fn(&str) -> String,
    pub parse_search: fn(&[u8]) -> Strict<Vec<Found>>,
    pub news_urls: &'static [&'static str],
    pub parse_news: fn(&[u8]) -> Strict<Vec<Story>>,
}

/// The provider in use: CNBC's keyless services.
pub fn provider() -> &'static Provider {
    &CNBC
}

pub const CNBC: Provider = Provider {
    name: "CNBC",
    home: "https://www.cnbc.com/",
    quotes_url: cnbc_quotes_url,
    parse_quotes: cnbc_quotes,
    chart_url: cnbc_chart_url,
    parse_chart: cnbc_chart,
    search_url: cnbc_search_url,
    parse_search: cnbc_search,
    // Business News and Earnings.
    news_urls: &[
        "https://www.cnbc.com/id/10001147/device/rss/rss.html",
        "https://www.cnbc.com/id/15839135/device/rss/rss.html",
    ],
    parse_news: rss_stories,
};

fn cnbc_quotes_url(symbols: &[String]) -> String {
    let list: Vec<String> = symbols.iter().map(|s| fetch::encode(s)).collect();
    format!(
        "https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols={}&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json",
        list.join("%7C")
    )
}

/// A number as CNBC writes it: "7,732.44", "+3.11", "-0.94%".
pub fn number(text: &str) -> Option<f64> {
    let cleaned: String = text
        .trim()
        .trim_end_matches('%')
        .chars()
        .filter(|c| *c != ',' && *c != '+')
        .collect();
    cleaned.parse::<f64>().ok().filter(|n| n.is_finite())
}

/// A number field of a CNBC quote: absent or one of CNBC's no-value marks
/// ("", "--", "N/A") is `None`; present, it must be text that reads as a
/// number.
fn cnbc_number(item: &serde_json::Map<String, Value>, key: &str) -> Strict<Option<f64>> {
    match strict::optional_text(item, key)?.map(str::trim) {
        None | Some("" | "--" | "N/A") => Ok(None),
        Some(text) => number(text)
            .map(Some)
            .ok_or_else(|| strict::Mismatch(format!("`{key}` is not a number: {text:?}"))),
    }
}

/// A text field of a CNBC quote, `None` when absent or blank.
fn cnbc_text(item: &serde_json::Map<String, Value>, key: &str) -> Strict<Option<String>> {
    Ok(strict::optional_text(item, key)?
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string))
}

/// CNBC's quotes: `FormattedQuoteResult.FormattedQuote`, a list or (for one
/// symbol) a single object. An item whose `code` is not 0 is a symbol CNBC
/// does not know and is left out; a known one needs `symbol`, `last` and
/// `change` ("UNCH" for none).
fn cnbc_quotes(body: &[u8]) -> Strict<Vec<Quote>> {
    let answer = strict::json(body)?;
    let answer = strict::object(&answer, "the answer")?;
    let result = strict::object(
        strict::field(answer, "FormattedQuoteResult")?,
        "`FormattedQuoteResult`",
    )?;
    let list = strict::field(result, "FormattedQuote")?;
    let items = match list {
        Value::Array(items) => items.as_slice(),
        item @ Value::Object(_) => std::slice::from_ref(item),
        _ => return strict::fail("`FormattedQuote` is neither a list nor an object"),
    };
    let read = strict::each(items, "quotes", |item| {
        let item = strict::object(item, "a quote")?;
        let symbol = strict::text(item, "symbol")?.trim().to_string();
        let code = strict::field(item, "code")?
            .as_u64()
            .ok_or_else(|| strict::Mismatch("`code` is not a number".into()))?;
        if code != 0 {
            return Ok(None);
        }
        if symbol.is_empty() {
            return strict::fail("`symbol` is empty");
        }
        let price = cnbc_number(item, "last")?
            .ok_or_else(|| strict::Mismatch("`last` has no value".into()))?;
        let change = match strict::text(item, "change")?.trim() {
            "UNCH" => 0.0,
            text => number(text)
                .ok_or_else(|| strict::Mismatch(format!("`change` is not a number: {text:?}")))?,
        };
        Ok(Some(Quote {
            name: cnbc_text(item, "name")?.unwrap_or_else(|| symbol.clone()),
            price,
            change,
            previous_close: cnbc_number(item, "previous_day_closing")?,
            open: cnbc_number(item, "open")?,
            high: cnbc_number(item, "high")?,
            low: cnbc_number(item, "low")?,
            year_high: cnbc_number(item, "yrhiprice")?,
            year_low: cnbc_number(item, "yrloprice")?,
            volume: match cnbc_text(item, "volume_alt")? {
                Some(volume) => Some(volume),
                None => cnbc_text(item, "volume")?,
            },
            market_cap: cnbc_text(item, "mktcapView")?,
            pe: cnbc_text(item, "pe")?,
            currency: cnbc_text(item, "currencyCode")?,
            exchange: cnbc_text(item, "exchange")?,
            kind: cnbc_text(item, "type")?
                .unwrap_or_else(|| "stock".into())
                .to_lowercase(),
            time: cnbc_text(item, "last_timedate")?,
            symbol,
        }))
    })?;
    Ok(read.into_iter().flatten().collect())
}

/// The chart CNBC answers for a range: 2Y is cut from the five years.
fn cnbc_span(range: &str) -> &'static str {
    match range {
        "1D" => "1D",
        "1W" => "5D",
        "1M" => "1M",
        "3M" => "3M",
        "6M" => "6M",
        "1Y" => "1Y",
        _ => "5Y",
    }
}

fn cnbc_chart_url(symbol: &str, range: &str) -> String {
    format!(
        "https://ts-api.cnbc.com/harmony/app/charts/{}.json?symbol={}",
        cnbc_span(range),
        fetch::encode(symbol)
    )
}

const DAY_MS: u64 = 24 * 60 * 60 * 1000;
/// The most points a chart is answered with.
pub const MAX_POINTS: usize = 240;

/// CNBC's chart: `barData.priceBars`, each bar with a `tradeTime`
/// ("YYYYMMDDhhmmss"), a `tradeTimeinMills` and a `close` (text or number).
/// An answer with `status` "ERROR" (an unknown symbol) or no bars in the
/// range is no chart.
fn cnbc_chart(body: &[u8], range: &str, now_ms: u64) -> Strict<Vec<Point>> {
    let answer = strict::json(body)?;
    let answer = strict::object(&answer, "the answer")?;
    if strict::optional_text(answer, "status")? == Some("ERROR") {
        let why = strict::optional_text(answer, "statusMessage")?.unwrap_or("no reason given");
        return strict::fail(format!(
            "the provider has no chart: {}",
            fetch::clip(why, 200)
        ));
    }
    let bar_data = strict::object(strict::field(answer, "barData")?, "`barData`")?;
    let bars = strict::list(strict::field(bar_data, "priceBars")?, "`priceBars`")?;
    let mut points = strict::each(bars, "priceBars", |bar| {
        let bar = strict::object(bar, "a bar")?;
        let time = strict::text(bar, "tradeTime")?;
        let day = match time.get(..8) {
            Some(day) if day.bytes().all(|b| b.is_ascii_digit()) => day.to_string(),
            _ => return strict::fail(format!("`tradeTime` is not a time: {time:?}")),
        };
        let at = strict::field(bar, "tradeTimeinMills")?
            .as_u64()
            .ok_or_else(|| strict::Mismatch("`tradeTimeinMills` is not a number".into()))?;
        let close = match strict::field(bar, "close")? {
            Value::String(text) => number(text),
            value => value.as_f64().filter(|n| n.is_finite()),
        }
        .ok_or_else(|| strict::Mismatch("`close` is not a number".into()))?;
        Ok((day, at, close))
    })?;
    points.sort_by_key(|(_, at, _)| *at);
    let kept: Vec<Point> = match range {
        // The day's chart is the last trading day's minutes.
        "1D" => {
            let last = points.last().map(|(day, _, _)| day.clone());
            points
                .into_iter()
                .filter(|(day, _, _)| Some(day) == last.as_ref())
                .map(|(_, at, p)| (at, p))
                .collect()
        }
        "1W" => points.into_iter().map(|(_, at, p)| (at, p)).collect(),
        _ => {
            let days = match range {
                "1M" => 31,
                "3M" => 92,
                "6M" => 183,
                "1Y" => 366,
                _ => 731,
            };
            let since = now_ms.saturating_sub(days * DAY_MS);
            points
                .into_iter()
                .filter(|(_, at, _)| *at >= since)
                .map(|(_, at, p)| (at, p))
                .collect()
        }
    };
    if kept.is_empty() {
        return strict::fail("the provider has no prices in this range");
    }
    Ok(thin(kept, MAX_POINTS))
}

/// At most `max` of `points`, evenly spaced, always with the last.
pub fn thin(points: Vec<Point>, max: usize) -> Vec<Point> {
    if points.len() <= max || max < 2 {
        return points;
    }
    let last = points.len() - 1;
    (0..max).map(|i| points[i * last / (max - 1)]).collect()
}

fn cnbc_search_url(query: &str) -> String {
    format!(
        "https://symlookup.cnbc.com/symservice/symlookup.do?prefix={}&partnerid=20064&pgok=1&pgsize=10",
        fetch::encode(query)
    )
}

/// CNBC's symbol search: a list whose first item may be a header
/// (`TotalMatchAvailable` and other counts); every other item names a
/// `symbolName` and, optionally, `companyName`, `exchangeName` and
/// `issueType`. A symbol this module does not accept as one is left out.
fn cnbc_search(body: &[u8]) -> Strict<Vec<Found>> {
    let answer = strict::json(body)?;
    let list = strict::list(&answer, "the answer")?;
    let header = list
        .first()
        .and_then(Value::as_object)
        .is_some_and(|first| first.contains_key("TotalMatchAvailable"));
    let items = if header { &list[1..] } else { &list[..] };
    let read = strict::each(items, "results", |item| {
        let item = strict::object(item, "a result")?;
        let symbol = strict::text(item, "symbolName")?.to_string();
        let name = strict::optional_text(item, "companyName")?.map(str::to_string);
        let exchange = strict::optional_text(item, "exchangeName")?.unwrap_or("");
        let kind = strict::optional_text(item, "issueType")?.unwrap_or("");
        Ok(super::valid_symbol(&symbol).then(|| Found {
            name: name.unwrap_or_else(|| symbol.clone()),
            exchange: exchange.to_string(),
            kind: kind.to_lowercase(),
            symbol,
        }))
    })?;
    Ok(read.into_iter().flatten().collect())
}

/// The text between `<name>` (with any attributes) and `</name>` in `xml`,
/// CDATA unwrapped and entities decoded.
fn element(xml: &str, name: &str) -> Option<String> {
    let open = format!("<{name}");
    let start = xml.find(&open)?;
    let after = &xml[start + open.len()..];
    let body_start = after.find('>')? + 1;
    let body = &after[body_start..];
    let end = body.find(&format!("</{name}>"))?;
    let inner = body[..end].trim();
    let inner = inner
        .strip_prefix("<![CDATA[")
        .and_then(|s| s.strip_suffix("]]>"))
        .unwrap_or(inner);
    Some(fetch::text_of(inner))
}

/// The stories of an RSS 2.0 feed. Every item needs a non-empty `title` and
/// an `https://` `link`; a `pubDate`, when there, must be an RFC 2822 date.
pub fn rss_stories(body: &[u8]) -> Strict<Vec<Story>> {
    let xml =
        std::str::from_utf8(body).map_err(|_| strict::Mismatch("the feed is not UTF-8".into()))?;
    if !xml.contains("<rss") {
        return strict::fail("not an RSS feed");
    }
    let mut stories = Vec::new();
    let mut rest = xml;
    while let Some(start) = rest.find("<item>") {
        let at = stories.len();
        let after = &rest[start + 6..];
        let Some(end) = after.find("</item>") else {
            return strict::fail(format!("items[{at}] is not closed"));
        };
        let item = &after[..end];
        rest = &after[end + 7..];
        let headline = element(item, "title").unwrap_or_default();
        if headline.is_empty() {
            return strict::fail(format!("items[{at}]: `title` is missing"));
        }
        let url = element(item, "link").unwrap_or_default();
        if !url.starts_with("https://") {
            return strict::fail(format!("items[{at}]: `link` is not an https link"));
        }
        let published_ms = match element(item, "pubDate") {
            None => 0,
            Some(date) => rfc2822_ms(&date).ok_or_else(|| {
                strict::Mismatch(format!("items[{at}]: `pubDate` is not a date: {date:?}"))
            })?,
        };
        stories.push(Story {
            id: element(item, "guid")
                .filter(|g| !g.is_empty())
                .unwrap_or_else(|| url.clone()),
            summary: element(item, "description")
                .map(|d| fetch::clip(&d, 400))
                .unwrap_or_default(),
            published_ms,
            publisher: "CNBC".into(),
            headline,
            url,
        });
    }
    Ok(stories)
}

/// Epoch ms of an RFC 2822 date in GMT or with a numeric offset:
/// "Wed, 14 Oct 2026 15:03:59 GMT", "14 Oct 2026 11:03:59 -0400".
pub fn rfc2822_ms(text: &str) -> Option<u64> {
    let text = text.trim();
    let text = text.split_once(", ").map_or(text, |(_, rest)| rest);
    let mut parts = text.split_whitespace();
    let day: i64 = parts.next()?.parse().ok()?;
    let month = match parts.next()? {
        "Jan" => 1,
        "Feb" => 2,
        "Mar" => 3,
        "Apr" => 4,
        "May" => 5,
        "Jun" => 6,
        "Jul" => 7,
        "Aug" => 8,
        "Sep" => 9,
        "Oct" => 10,
        "Nov" => 11,
        "Dec" => 12,
        _ => return None,
    };
    let year: i64 = parts.next()?.parse().ok()?;
    let mut clock = parts.next()?.split(':');
    let hour: i64 = clock.next()?.parse().ok()?;
    let minute: i64 = clock.next()?.parse().ok()?;
    let second: i64 = clock.next().unwrap_or("0").parse().ok()?;
    let offset_minutes = match parts.next().unwrap_or("GMT") {
        "GMT" | "UT" | "UTC" | "Z" => 0,
        "EST" => -300,
        "EDT" => -240,
        zone => {
            let sign = match zone.get(..1)? {
                "+" => 1,
                "-" => -1,
                _ => return None,
            };
            let hh: i64 = zone.get(1..3)?.parse().ok()?;
            let mm: i64 = zone.get(3..5)?.parse().ok()?;
            sign * (hh * 60 + mm)
        }
    };
    // Days from the civil date (Howard Hinnant's algorithm).
    let y = if month <= 2 { year - 1 } else { year };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let mp = (month + 9) % 12;
    let doy = (153 * mp + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = era * 146_097 + doe - 719_468;
    let seconds = days * 86_400 + hour * 3_600 + minute * 60 + second - offset_minutes * 60;
    u64::try_from(seconds).ok().map(|s| s * 1000)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cnbc_numbers_lose_their_commas_and_signs() {
        assert_eq!(number("7,732.44"), Some(7732.44));
        assert_eq!(number("+3.11"), Some(3.11));
        assert_eq!(number("-0.94%"), Some(-0.94));
        assert_eq!(number("UNCH"), None);
    }

    #[test]
    fn cnbc_quotes_keep_the_known_symbols() {
        let body = br#"{"FormattedQuoteResult":{"FormattedQuote":[
            {"symbol":"AAPL","code":0,"name":"Apple Inc.","last":"344.38","change":"+3.11","type":"STOCK",
             "open":"344.61","high":"347.09","low":"343.65","previous_day_closing":"341.27","volume_alt":"17.1M",
             "mktcapView":"5.026T","pe":"39.63","yrhiprice":"348.15","yrloprice":"243.42","last_timedate":"12:09 PM EDT"},
            {"symbol":".SPX","code":0,"name":"S&P 500 Index","last":"7,732.44","change":"-73.01","type":"INDEX","pe":"","open":"--"},
            {"symbol":"ZZZZQ","code":1}]}}"#;
        let quotes = cnbc_quotes(body).unwrap();
        assert_eq!(quotes.len(), 2);
        assert_eq!(quotes[0].price, 344.38);
        assert_eq!(quotes[0].market_cap.as_deref(), Some("5.026T"));
        assert_eq!(quotes[1].change, -73.01);
        assert_eq!(quotes[1].kind, "index");
        assert_eq!((quotes[1].pe.as_deref(), quotes[1].open), (None, None));
        let one = br#"{"FormattedQuoteResult":{"FormattedQuote":{"symbol":"MSFT","code":0,"last":"1","change":"UNCH"}}}"#;
        let one = cnbc_quotes(one).unwrap();
        assert_eq!((one[0].name.as_str(), one[0].change), ("MSFT", 0.0));
        assert!(cnbc_quotes(b"<html>").is_err());
    }

    #[test]
    fn one_quote_out_of_shape_fails_the_whole_answer() {
        let good = r#"{"symbol":"AAPL","code":0,"last":"1","change":"+1"}"#;
        for (bad, why) in [
            (
                r#"{"code":0,"last":"1","change":"0"}"#,
                "quotes[1]: `symbol` is missing",
            ),
            (
                r#"{"symbol":"X","last":"1","change":"0"}"#,
                "quotes[1]: `code` is missing",
            ),
            (
                r#"{"symbol":"X","code":0,"last":"--","change":"0"}"#,
                "quotes[1]: `last` has no value",
            ),
            (
                r#"{"symbol":"X","code":0,"last":"1"}"#,
                "quotes[1]: `change` is missing",
            ),
            (
                r#"{"symbol":"X","code":0,"last":"1","change":"up"}"#,
                "quotes[1]: `change` is not a number: \"up\"",
            ),
            (
                r#"{"symbol":"X","code":0,"last":"1","change":"0","high":12}"#,
                "quotes[1]: `high` is not text",
            ),
            (
                r#"{"symbol":"X","code":0,"last":"1","change":"0","low":"low"}"#,
                "quotes[1]: `low` is not a number: \"low\"",
            ),
            (
                r#"{"symbol":"X","code":0,"last":"1","change":"0","name":[]}"#,
                "quotes[1]: `name` is not text",
            ),
        ] {
            let body = format!(r#"{{"FormattedQuoteResult":{{"FormattedQuote":[{good},{bad}]}}}}"#);
            assert_eq!(
                cnbc_quotes(body.as_bytes()),
                Err(strict::Mismatch(why.into())),
                "{bad}"
            );
        }
    }

    #[test]
    fn the_day_chart_keeps_the_last_trading_day() {
        let body = br#"{"barData":{"priceBars":[
            {"close":"10.0","tradeTime":"20261013155900","tradeTimeinMills":100},
            {"close":"11.5","tradeTime":"20261014093000","tradeTimeinMills":300},
            {"close":"11.0","tradeTime":"20261014093100","tradeTimeinMills":200}]}}"#;
        assert_eq!(
            cnbc_chart(body, "1D", 0).unwrap(),
            vec![(200, 11.0), (300, 11.5)]
        );
        assert_eq!(cnbc_chart(body, "1W", 0).unwrap().len(), 3);
        let month = cnbc_chart(body, "1M", 31 * DAY_MS + 250).unwrap();
        assert_eq!(month, vec![(300, 11.5)], "older bars are cut");
        assert_eq!(cnbc_span("2Y"), "5Y");
        assert!(
            cnbc_chart(body, "1M", 1_000 * DAY_MS).is_err(),
            "no bars in the range is no chart"
        );
    }

    #[test]
    fn one_bar_out_of_shape_fails_the_whole_chart() {
        let good = r#"{"close":"10.0","tradeTime":"20261013155900","tradeTimeinMills":100}"#;
        for (bad, why) in [
            (
                r#"{"close":"x","tradeTime":"20261013155900","tradeTimeinMills":1}"#,
                "priceBars[1]: `close` is not a number",
            ),
            (
                r#"{"close":"1","tradeTime":"2026","tradeTimeinMills":1}"#,
                "priceBars[1]: `tradeTime` is not a time: \"2026\"",
            ),
            (
                r#"{"close":"1","tradeTime":"20261013155900","tradeTimeinMills":"1"}"#,
                "priceBars[1]: `tradeTimeinMills` is not a number",
            ),
        ] {
            let body = format!(r#"{{"barData":{{"priceBars":[{good},{bad}]}}}}"#);
            assert_eq!(
                cnbc_chart(body.as_bytes(), "1W", 0),
                Err(strict::Mismatch(why.into()))
            );
        }
        let unknown = br#"{"status":"ERROR","statusMessage":"Security Master not found"}"#;
        assert_eq!(
            cnbc_chart(unknown, "1M", 0),
            Err(strict::Mismatch(
                "the provider has no chart: Security Master not found".into()
            ))
        );
    }

    #[test]
    fn thinning_keeps_the_ends() {
        let points: Vec<Point> = (0..1000).map(|i| (i, i as f64)).collect();
        let thinned = thin(points, 10);
        assert_eq!(thinned.len(), 10);
        assert_eq!(thinned[0].0, 0);
        assert_eq!(thinned[9].0, 999);
    }

    #[test]
    fn rss_items_become_stories() {
        let body = br#"<?xml version="1.0"?><rss version="2.0"><channel><title>Business</title>
            <item><link>https://www.cnbc.com/2026/10/14/a.html</link><guid isPermaLink="false">108</guid>
            <title>Netflix to lay off &amp; more </title>
            <description><![CDATA[Netflix will <b>lay off</b> staff.]]></description>
            <pubDate>Wed, 14 Oct 2026 15:03:59 GMT</pubDate></item>
            <item><link>https://www.cnbc.com/b.html</link><title>No date</title></item></channel></rss>"#;
        let stories = rss_stories(body).unwrap();
        assert_eq!(stories.len(), 2);
        assert_eq!(stories[0].headline, "Netflix to lay off & more");
        assert_eq!(stories[0].summary, "Netflix will lay off staff.");
        assert_eq!(stories[0].id, "108");
        assert_eq!(stories[0].published_ms, 1_791_990_239_000);
        assert_eq!(
            (stories[1].id.as_str(), stories[1].published_ms),
            ("https://www.cnbc.com/b.html", 0)
        );
        assert!(rss_stories(b"{}").is_err());
    }

    #[test]
    fn one_story_out_of_shape_fails_the_whole_feed() {
        let good = "<item><link>https://www.cnbc.com/a.html</link><title>A</title></item>";
        for (bad, why) in [
            ("<item><title>No link</title></item>", "items[1]: `link` is not an https link"),
            ("<item><link>http://x.example/</link><title>B</title></item>", "items[1]: `link` is not an https link"),
            ("<item><link>https://x.example/</link></item>", "items[1]: `title` is missing"),
            ("<item><link>https://x.example/</link><title>B</title><pubDate>soon</pubDate></item>", "items[1]: `pubDate` is not a date: \"soon\""),
            ("<item><link>https://x.example/</link><title>B</title>", "items[1] is not closed"),
        ] {
            let body = format!("<rss version=\"2.0\"><channel>{good}{bad}</channel></rss>");
            assert_eq!(rss_stories(body.as_bytes()), Err(strict::Mismatch(why.into())), "{bad}");
        }
    }

    #[test]
    fn dates_with_offsets_agree() {
        assert_eq!(rfc2822_ms("Thu, 01 Jan 1970 00:00:00 GMT"), Some(0));
        assert_eq!(
            rfc2822_ms("14 Oct 2026 11:03:59 -0400"),
            rfc2822_ms("Wed, 14 Oct 2026 15:03:59 GMT")
        );
        assert_eq!(rfc2822_ms("yesterday"), None);
    }

    #[test]
    fn search_answers_symbols_and_skips_the_header() {
        let body = br#"[{"TotalMatchAvailable":"2"},
            {"issueType":"STOCK","exchangeName":"NASDAQ","symbolName":"AAPL","companyName":"Apple Inc."},
            {"issueType":"ETF","exchangeName":"OTC","symbolName":"bad symbol!","companyName":"X"}]"#;
        let found = cnbc_search(body).unwrap();
        assert_eq!(found.len(), 1, "a string that is not a symbol is left out");
        assert_eq!(found[0].symbol, "AAPL");
        assert_eq!(found[0].kind, "stock");
        assert_eq!(cnbc_search(b"[]").unwrap(), Vec::<Found>::new());
        assert_eq!(
            cnbc_search(br#"[{"TotalMatchAvailable":"1"},{"companyName":"X"}]"#),
            Err(strict::Mismatch(
                "results[0]: `symbolName` is missing".into()
            ))
        );
        assert_eq!(
            cnbc_search(br#"[{"symbolName":"A","exchangeName":4}]"#),
            Err(strict::Mismatch(
                "results[0]: `exchangeName` is not text".into()
            ))
        );
        assert!(cnbc_search(br#"{"symbolName":"A"}"#).is_err());
    }
}

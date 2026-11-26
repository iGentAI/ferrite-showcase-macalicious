//! Exchange rates for Calculator's Convert menu and Spotlight: the European
//! Central Bank's euro reference rates, published once each working day.
//!
//! * `GET /api/calculator/rates`: `{"base": "EUR", "date", "rates": {code:
//!   units per euro}, "source", "source_url", "read_at"}`, read from the bank
//!   at most once in [`KEPT_MS`].
//! * `GET /api/calculator/rates?update=1`: Update Currency Exchange Rates. It
//!   asks the bank unless someone did within [`UPDATE_GAP_MS`].
//!
//! When the bank cannot be read, the last rates read are answered with `stale`
//! saying why, under their own date, as a Mac keeps the rates it last
//! downloaded. With none kept the answer is 502.

use std::collections::BTreeMap;

use ferrite_app::{serde, serde_json};
use serde_json::{json, Value};

use crate::apps::fetch::strict::{self, Mismatch, Strict};
use crate::apps::fetch::{self, Fetched};
use crate::http::Response;
use crate::module::ApiCtx;

/// The egress handle `ferrite.json` declares for the bank's daily file alone.
pub const EGRESS: &str = "rates";
pub const DAILY_URL: &str = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
pub const SOURCE: &str = "European Central Bank";
/// How long rates serve before the bank is asked again. It publishes once a
/// working day, around 16:00 Central European Time.
pub const KEPT_MS: u64 = 6 * 60 * 60 * 1000;
pub const UPDATE_GAP_MS: u64 = 60 * 1000;
const KEY: &str = "rates/ecb";
const BUDGET_MS: u64 = 5_000;
const MOST_RATES: usize = 64;

/// One day's reference rates, in units of each currency per euro; the euro
/// itself is among them, at 1.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Rates {
    pub date: String,
    pub rates: BTreeMap<String, f64>,
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Kept {
    rates: Rates,
    read_at: u64,
}

/// The value of `name` in the attributes of a tag, in either kind of quote.
fn attribute<'a>(tag: &'a str, name: &str) -> Option<&'a str> {
    for quote in ['\'', '"'] {
        let opening = format!(" {name}={quote}");
        if let Some(at) = tag.find(&opening) {
            let rest = &tag[at + opening.len()..];
            return rest.find(quote).map(|end| &rest[..end]);
        }
    }
    None
}

fn is_date(text: &str) -> bool {
    let bytes = text.as_bytes();
    bytes.len() == 10
        && bytes.iter().enumerate().all(|(at, byte)| {
            if at == 4 || at == 7 {
                *byte == b'-'
            } else {
                byte.is_ascii_digit()
            }
        })
}

/// The bank's daily file, every `Cube` of it or nothing.
pub fn parse_daily(body: &[u8]) -> Strict<Rates> {
    let text = std::str::from_utf8(body).map_err(|_| Mismatch("not UTF-8".into()))?;
    let mut date = None;
    let mut rates = BTreeMap::new();
    for piece in text.split("<Cube").skip(1) {
        let tag = piece.split('>').next().unwrap_or(piece);
        if let Some(time) = attribute(tag, "time") {
            if !is_date(time) {
                return strict::fail(format!("`{time}` is not a date"));
            }
            if date.replace(time.to_string()).is_some() {
                return strict::fail("more than one day");
            }
        } else if let Some(code) = attribute(tag, "currency") {
            if code.len() != 3 || !code.bytes().all(|byte| byte.is_ascii_uppercase()) {
                return strict::fail(format!("`{code}` is not a currency code"));
            }
            let rate = attribute(tag, "rate")
                .and_then(|rate| rate.parse::<f64>().ok())
                .filter(|rate| rate.is_finite() && *rate > 0.0)
                .ok_or_else(|| Mismatch(format!("{code} has no rate")))?;
            rates.insert(code.to_string(), rate);
        }
    }
    let Some(date) = date else {
        return strict::fail("no day");
    };
    if rates.is_empty() || rates.len() > MOST_RATES {
        return strict::fail(format!("{} rates", rates.len()));
    }
    rates.insert("EUR".to_string(), 1.0);
    Ok(Rates { date, rates })
}

fn body_of(kept: &Kept, stale: Option<&str>) -> Value {
    let mut body = json!({
        "base": "EUR",
        "date": kept.rates.date,
        "rates": kept.rates.rates,
        "source": SOURCE,
        "source_url": DAILY_URL,
        "read_at": kept.read_at,
    });
    if let Some(why) = stale {
        body["stale"] = json!(why);
    }
    body
}

/// `GET /rates`.
pub async fn answer(cx: &mut ApiCtx<'_>) -> Response {
    let update = cx.request.query_param("update") == Some("1");
    let kept = match cx.storage.shared().get_json::<Kept>(KEY).await {
        Ok(kept) => kept,
        Err(error) => return Response::error(503, &format!("storage failed: {error}")),
    };
    if let Some(kept) = &kept {
        let age = cx.now_ms.saturating_sub(kept.read_at);
        if age < if update { UPDATE_GAP_MS } else { KEPT_MS } {
            return Response::json(200, &body_of(kept, None));
        }
    }
    let fetched = fetch::get(cx.ctx, EGRESS, DAILY_URL, "application/xml", BUDGET_MS).await;
    let read = match &fetched {
        Fetched::Body(body) => {
            parse_daily(body).map_err(|Mismatch(why)| format!("its file did not read: {why}"))
        }
        Fetched::Missing => Err("it has no such file".to_string()),
        Fetched::Failed(why) => Err(why.clone()),
    };
    match read {
        Ok(rates) => {
            let fresh = Kept {
                rates,
                read_at: cx.now_ms,
            };
            let _ = cx.storage.shared().put_json(KEY, &fresh).await;
            Response::json(200, &body_of(&fresh, None))
        }
        Err(why) => {
            let why = format!("{SOURCE}: {why}");
            match kept {
                Some(kept) => Response::json(200, &body_of(&kept, Some(&why))),
                None => Response::error(502, &why),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const DAILY: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
	<gesmes:subject>Reference rates</gesmes:subject>
	<gesmes:Sender><gesmes:name>European Central Bank</gesmes:name></gesmes:Sender>
	<Cube>
		<Cube time='2026-11-06'>
			<Cube currency='USD' rate='1.1165'/>
			<Cube currency='JPY' rate='176.77'/>
		</Cube>
	</Cube>
</gesmes:Envelope>"#;

    #[test]
    fn the_daily_file_is_read_with_the_euro_at_one() {
        assert_eq!(
            parse_daily(DAILY.as_bytes()).unwrap(),
            Rates {
                date: "2026-11-06".into(),
                rates: BTreeMap::from([
                    ("EUR".to_string(), 1.0),
                    ("JPY".to_string(), 176.77),
                    ("USD".to_string(), 1.1165),
                ]),
            }
        );
    }

    #[test]
    fn a_file_that_does_not_read_fails_whole() {
        assert_eq!(
            parse_daily(DAILY.replace("1.1165", "none").as_bytes()),
            strict::fail("USD has no rate")
        );
        assert_eq!(
            parse_daily(DAILY.replace("2026-11-06", "today").as_bytes()),
            strict::fail("`today` is not a date")
        );
        assert_eq!(
            parse_daily(b"<html>Service unavailable</html>"),
            strict::fail("no day")
        );
    }

    #[test]
    fn the_file_is_declared_and_nothing_else_of_the_bank() {
        let spec: Value = serde_json::from_str(include_str!("../../../tests/fixtures/ferrite.json")).unwrap();
        let declared: Vec<&Value> = spec["applications"][0]["egress"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|entry| entry["handle"] == EGRESS)
            .collect();
        assert_eq!(declared.len(), 1);
        assert_eq!(declared[0]["destinations"], json!([DAILY_URL]));
    }
}

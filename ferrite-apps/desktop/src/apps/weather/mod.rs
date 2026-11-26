//! Weather's server half: forecasts and place names from Open-Meteo, which
//! needs no key and asks for attribution (the desktop's weather views say
//! "Open-Meteo" beside each reading).
//!
//! * `GET /api/weather/forecast?lat=<lat>&lon=<lon>`: `{"lat", "lon",
//!   "timezone", "observed", "temperature_c", "code", "condition", "days":
//!   [{"date", "high_c", "low_c", "code", "condition"}], "source",
//!   "source_url", "read_at", "cached"}`. `observed` is the source's local time
//!   at the place; `read_at` when this module read it. Points are rounded to two
//!   decimals, read at most every [`FORECAST_TTL_MS`] for everyone. When the
//!   source cannot be read, a reading of the last [`FORECAST_KEPT_MS`] is answered
//!   with `stale` saying why, under its own `observed` time. With none, the answer
//!   is 200 `{"unavailable": why}`, because Maps and Today ask without the person
//!   asking, and a source outside the application being down is no failure of a
//!   request of theirs.
//! * `GET /api/weather/places?q=<name>`: `{"places": [{"name", "region"?,
//!   "country"?, "lat", "lon"}]}`, at most [`MOST_PLACES`], kept for
//!   [`PLACES_TTL_MS`].
//!
//! Places that cannot be looked up are 502 with what went wrong. An answer out of
//! its documented shape is kept nowhere, and no reading is made up.

use ferrite_app::{serde, serde_json};
use serde_json::{json, Value};

use super::fetch::strict::{self, Mismatch, Strict};
use super::fetch::{self, Fetched};
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};

pub const MODULE: AppModule = AppModule {
    name: "weather",
    title: "Weather",
    handle,
};

/// The egress handle `ferrite.json` declares for both of Open-Meteo's hosts.
pub const EGRESS: &str = "weather";
pub const FORECAST_URL: &str = "https://api.open-meteo.com/v1/forecast";
pub const GEOCODING_URL: &str = "https://geocoding-api.open-meteo.com/v1/search";
pub const SOURCE: &str = "Open-Meteo";
pub const SOURCE_URL: &str = "https://open-meteo.com/";
/// Open-Meteo updates its current conditions every 15 minutes.
pub const FORECAST_TTL_MS: u64 = 15 * 60 * 1000;
pub const FORECAST_KEPT_MS: u64 = 3 * 60 * 60 * 1000;
pub const PLACES_TTL_MS: u64 = 7 * 24 * 60 * 60 * 1000;
pub const MOST_PLACES: usize = 6;
const FORECAST_DAYS: usize = 5;
const MAX_QUERY_CHARS: usize = 100;
/// The most one try at the source may take: two fit under the 8 s API deadline.
/// Open-Meteo's hosts drop some connections, and a second one usually lands.
const TRY_MS: u64 = 3_000;
const TRIES: usize = 2;

/// One day of a forecast.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Day {
    pub date: String,
    pub high_c: f64,
    pub low_c: f64,
    pub code: u64,
    pub condition: String,
}

/// A forecast as Open-Meteo gave it, in the words the desktop shows.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Forecast {
    pub timezone: String,
    pub observed: String,
    pub temperature_c: f64,
    pub code: u64,
    pub condition: String,
    pub days: Vec<Day>,
}

/// A place a name finds.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Place {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub region: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub country: Option<String>,
    pub lat: f64,
    pub lon: f64,
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Kept {
    forecast: Forecast,
    read_at: u64,
}

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    match (cx.request.method, cx.request.path) {
        ("GET", "/forecast") => {
            let number = |name: &str| {
                cx.request
                    .query_param(name)
                    .and_then(|raw| raw.parse::<f64>().ok())
                    .filter(|value| value.is_finite())
            };
            match (number("lat"), number("lon")) {
                (Some(lat), Some(lon))
                    if (-90.0..=90.0).contains(&lat) && (-180.0..=180.0).contains(&lon) =>
                {
                    forecast(&mut cx, lat, lon).await
                }
                _ => Response::error(400, "lat and lon must be a latitude and a longitude"),
            }
        }
        ("GET", "/places") => {
            let asked = cx
                .request
                .query_param("q")
                .and_then(super::spotlight::decode)
                .map(|raw| raw.split_whitespace().collect::<Vec<_>>().join(" "))
                .filter(|text| !text.is_empty() && text.chars().count() <= MAX_QUERY_CHARS);
            match asked {
                Some(name) => places(&mut cx, &name).await,
                None => Response::error(
                    400,
                    &format!("q must be a place's name of at most {MAX_QUERY_CHARS} characters"),
                ),
            }
        }
        (_, "/forecast" | "/places") => Response::method_not_allowed(),
        _ => Response::not_found(),
    }
}

/// The address of the forecast at a point, rounded as it is kept.
pub fn forecast_request(lat: f64, lon: f64) -> String {
    format!(
        "{FORECAST_URL}?latitude={lat:.2}&longitude={lon:.2}\
         &current=temperature_2m,weather_code\
         &daily=weather_code,temperature_2m_max,temperature_2m_min\
         &timezone=auto&forecast_days={FORECAST_DAYS}"
    )
}

/// The address of the places a name finds.
pub fn places_request(name: &str) -> String {
    format!(
        "{GEOCODING_URL}?name={}&count={MOST_PLACES}&language=en&format=json",
        fetch::encode(name)
    )
}

/// The words for a WMO weather code, as Open-Meteo documents them. A code it
/// does not document has no words: the answer does not read.
pub fn condition_of(code: u64) -> Option<&'static str> {
    Some(match code {
        0 => "Clear",
        1 => "Mostly Clear",
        2 => "Partly Cloudy",
        3 => "Overcast",
        45 | 48 => "Fog",
        51 | 53 | 55 => "Drizzle",
        56 | 57 => "Freezing Drizzle",
        61 | 63 | 65 => "Rain",
        66 | 67 => "Freezing Rain",
        71 | 73 | 75 | 77 => "Snow",
        80..=82 => "Showers",
        85 | 86 => "Snow Showers",
        95 | 96 | 99 => "Thunderstorm",
        _ => return None,
    })
}

fn code_and_words(code: &Value) -> Strict<(u64, String)> {
    let code = code
        .as_u64()
        .ok_or_else(|| Mismatch("a weather code is not a number".into()))?;
    match condition_of(code) {
        Some(words) => Ok((code, words.to_string())),
        None => strict::fail(format!("weather code {code} is not documented")),
    }
}

/// Open-Meteo's forecast answer, every field of it or nothing.
pub fn parse_forecast(body: &[u8]) -> Strict<Forecast> {
    let answer = strict::json(body)?;
    let top = strict::object(&answer, "the answer")?;
    let current = strict::object(strict::field(top, "current")?, "`current`")?;
    let daily = strict::object(strict::field(top, "daily")?, "`daily`")?;
    let column = |key: &str| strict::list(strict::field(daily, key)?, &format!("`{key}`"));
    let dates = column("time")?;
    let codes = column("weather_code")?;
    let highs = column("temperature_2m_max")?;
    let lows = column("temperature_2m_min")?;
    if dates.is_empty()
        || dates.len() != codes.len()
        || dates.len() != highs.len()
        || dates.len() != lows.len()
    {
        return strict::fail("the daily columns are empty or of different lengths");
    }
    let degrees = |value: &Value| {
        value
            .as_f64()
            .ok_or_else(|| Mismatch("a daily temperature is not a number".into()))
    };
    let mut days = Vec::with_capacity(dates.len());
    for at in 0..dates.len() {
        let date = dates[at]
            .as_str()
            .ok_or_else(|| Mismatch("a date is not text".into()))?;
        let (code, condition) = code_and_words(&codes[at])?;
        days.push(Day {
            date: date.to_string(),
            high_c: degrees(&highs[at])?,
            low_c: degrees(&lows[at])?,
            code,
            condition,
        });
    }
    let (code, condition) = code_and_words(strict::field(current, "weather_code")?)?;
    Ok(Forecast {
        timezone: strict::text(top, "timezone")?.to_string(),
        observed: strict::text(current, "time")?.to_string(),
        temperature_c: strict::number(current, "temperature_2m")?,
        code,
        condition,
        days,
    })
}

/// Open-Meteo's geocoding answer. It leaves `results` out when a name finds
/// nothing.
pub fn parse_places(body: &[u8]) -> Strict<Vec<Place>> {
    let answer = strict::json(body)?;
    let top = strict::object(&answer, "the answer")?;
    let Some(results) = strict::optional_list(top, "results")? else {
        return Ok(Vec::new());
    };
    strict::each(results, "results", |item| {
        let item = strict::object(item, "a result")?;
        Ok(Place {
            name: strict::text(item, "name")?.to_string(),
            region: strict::optional_text(item, "admin1")?.map(str::to_string),
            country: strict::optional_text(item, "country")?.map(str::to_string),
            lat: strict::number(item, "latitude")?,
            lon: strict::number(item, "longitude")?,
        })
    })
}

/// GET `url`, again if it could not be reached.
async fn ask(cx: &ApiCtx<'_>, url: &str) -> Fetched {
    let mut fetched = Fetched::Failed("not asked".into());
    for _ in 0..TRIES {
        fetched = fetch::get(cx.ctx, EGRESS, url, "application/json", TRY_MS).await;
        if !matches!(fetched, Fetched::Failed(_)) {
            break;
        }
    }
    fetched
}

/// `read` of a fetched answer, or the words that say why there is none.
fn read<T>(fetched: &Fetched, read: impl FnOnce(&[u8]) -> Strict<T>) -> Result<T, String> {
    match fetched {
        Fetched::Body(body) => {
            read(body).map_err(|Mismatch(why)| format!("{SOURCE} answered something else: {why}"))
        }
        Fetched::Missing => Err(format!("{SOURCE} has no such data")),
        Fetched::Failed(why) => Err(format!("{SOURCE}: {why}")),
    }
}

fn forecast_body(lat: f64, lon: f64, kept: &Kept, cached: bool) -> Value {
    json!({
        "lat": lat,
        "lon": lon,
        "timezone": kept.forecast.timezone,
        "observed": kept.forecast.observed,
        "temperature_c": kept.forecast.temperature_c,
        "code": kept.forecast.code,
        "condition": kept.forecast.condition,
        "days": kept.forecast.days,
        "source": SOURCE,
        "source_url": SOURCE_URL,
        "read_at": kept.read_at,
        "cached": cached,
    })
}

async fn forecast(cx: &mut ApiCtx<'_>, lat: f64, lon: f64) -> Response {
    let (lat, lon) = ((lat * 100.0).round() / 100.0, (lon * 100.0).round() / 100.0);
    let key = format!("forecast/{lat:.2},{lon:.2}");
    let held;
    match cx.storage.shared().get_json::<Kept>(&key).await {
        Ok(kept) => held = kept,
        Err(error) => return Response::error(503, &format!("storage failed: {error}")),
    }
    if let Some(kept) = &held {
        if cx.now_ms.saturating_sub(kept.read_at) < FORECAST_TTL_MS {
            return Response::json(200, &forecast_body(lat, lon, kept, true));
        }
    }
    let url = forecast_request(lat, lon);
    let fetched = ask(cx, &url).await;
    let kept = match read(&fetched, parse_forecast) {
        Ok(forecast) => Kept {
            forecast,
            read_at: cx.now_ms,
        },
        Err(why) => {
            return Response::json(
                200,
                &match &held {
                    Some(kept) => {
                        let mut body = forecast_body(lat, lon, kept, true);
                        body["stale"] = json!(why);
                        body
                    }
                    None => json!({ "unavailable": why }),
                },
            )
        }
    };
    if let Ok(bytes) = serde_json::to_vec(&kept) {
        let _ = cx
            .storage
            .shared()
            .put_expiring(&key, &bytes, cx.now_ms + FORECAST_KEPT_MS)
            .await;
    }
    Response::json(200, &forecast_body(lat, lon, &kept, false))
}

async fn places(cx: &mut ApiCtx<'_>, name: &str) -> Response {
    let key = format!("places/{}", fetch::encode(&name.to_lowercase()));
    match cx.storage.shared().get_json::<Vec<Place>>(&key).await {
        Ok(Some(places)) => return Response::json(200, &json!({ "places": places })),
        Ok(None) => {}
        Err(error) => return Response::error(503, &format!("storage failed: {error}")),
    }
    let url = places_request(name);
    let fetched = ask(cx, &url).await;
    let mut places = match read(&fetched, parse_places) {
        Ok(places) => places,
        Err(why) => return Response::error(502, &why),
    };
    places.truncate(MOST_PLACES);
    if let Ok(bytes) = serde_json::to_vec(&places) {
        let _ = cx
            .storage
            .shared()
            .put_expiring(&key, &bytes, cx.now_ms + PLACES_TTL_MS)
            .await;
    }
    Response::json(200, &json!({ "places": places }))
}

#[cfg(test)]
mod tests {
    use super::*;

    const FORECAST: &str = r#"{"latitude":48.853382,"longitude":2.355208,"timezone":"Europe/Paris",
        "current":{"time":"2026-11-06T23:30","interval":900,"temperature_2m":6.8,"weather_code":45},
        "daily":{"time":["2026-11-06","2026-11-07"],"weather_code":[45,61],
        "temperature_2m_max":[13.4,12.2],"temperature_2m_min":[6.6,4.0]}}"#;

    #[test]
    fn a_forecast_is_read_whole() {
        assert_eq!(
            parse_forecast(FORECAST.as_bytes()).unwrap(),
            Forecast {
                timezone: "Europe/Paris".into(),
                observed: "2026-11-06T23:30".into(),
                temperature_c: 6.8,
                code: 45,
                condition: "Fog".into(),
                days: vec![
                    Day {
                        date: "2026-11-06".into(),
                        high_c: 13.4,
                        low_c: 6.6,
                        code: 45,
                        condition: "Fog".into(),
                    },
                    Day {
                        date: "2026-11-07".into(),
                        high_c: 12.2,
                        low_c: 4.0,
                        code: 61,
                        condition: "Rain".into(),
                    },
                ],
            }
        );
    }

    #[test]
    fn a_forecast_that_does_not_read_fails_whole() {
        let unknown = FORECAST.replace("\"weather_code\":45}", "\"weather_code\":4}");
        assert_eq!(
            parse_forecast(unknown.as_bytes()),
            strict::fail("weather code 4 is not documented")
        );
        let short = FORECAST.replace("[13.4,12.2]", "[13.4]");
        assert_eq!(
            parse_forecast(short.as_bytes()),
            strict::fail("the daily columns are empty or of different lengths")
        );
        assert!(parse_forecast(b"<html>").is_err());
    }

    #[test]
    fn places_are_read_and_a_name_may_find_none() {
        let body = r#"{"results":[{"id":2988507,"name":"Paris","latitude":48.85341,"longitude":2.3488,
            "country":"France","admin1":"Île-de-France Region"}],"generationtime_ms":0.15}"#;
        assert_eq!(
            parse_places(body.as_bytes()).unwrap(),
            vec![Place {
                name: "Paris".into(),
                region: Some("Île-de-France Region".into()),
                country: Some("France".into()),
                lat: 48.85341,
                lon: 2.3488,
            }]
        );
        assert_eq!(
            parse_places(br#"{"generationtime_ms":0.1}"#).unwrap(),
            vec![]
        );
    }

    #[test]
    fn a_request_is_rounded_and_encoded() {
        assert_eq!(
            forecast_request(48.853, 2.355),
            "https://api.open-meteo.com/v1/forecast?latitude=48.85&longitude=2.35\
             &current=temperature_2m,weather_code\
             &daily=weather_code,temperature_2m_max,temperature_2m_min\
             &timezone=auto&forecast_days=5"
        );
        assert_eq!(
            places_request("São Paulo"),
            "https://geocoding-api.open-meteo.com/v1/search?name=S%C3%A3o%20Paulo&count=6&language=en&format=json"
        );
    }

    #[test]
    fn every_request_is_under_a_declared_destination() {
        let spec: Value = serde_json::from_str(include_str!("../../../tests/fixtures/ferrite.json")).unwrap();
        let declared: Vec<&str> = spec["applications"][0]["egress"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|entry| entry["handle"] == EGRESS)
            .flat_map(|entry| entry["destinations"].as_array().unwrap())
            .map(|destination| destination.as_str().unwrap())
            .collect();
        assert_eq!(declared, [FORECAST_URL, GEOCODING_URL]);
        assert!(forecast_request(1.0, 2.0).starts_with(FORECAST_URL));
        assert!(places_request("a").starts_with(GEOCODING_URL));
    }
}

//! Maps' server half: place search and reverse geocoding through
//! OpenStreetMap's Nominatim, and each person's Favorites, Recents and
//! Guides.
//!
//! A Ferrite application reaches the internet only through the egress its
//! manifest declares (`ferrite.json`): [`SEARCH_EGRESS`] for Nominatim and
//! [`ROUTE_EGRESS`] for the FOSSGIS routers. Each is free for light use under
//! its usage policy, which this module keeps:
//!
//! * Nominatim (<https://operations.osmfoundation.org/policies/nominatim/>):
//!   at most one request a second for the whole application, a `user-agent`
//!   that names the application, answers cached, and no search as you type
//!   (the window searches on Return). Answers are cached for
//!   [`SEARCH_CACHE_MS`] under the normalised query.
//! * The FOSSGIS routers (<https://routing.openstreetmap.de/about.html>): at
//!   most one request a second for the whole application, a `user-agent` that
//!   names the application, attribution and a link to fix the map (the
//!   window's Directions panel shows both), and no heavy use: a route is asked
//!   only when the person asks for it, and kept as long as a search.
//!
//! The rate is kept by a lease per service, one key in the shared space that
//! every instance and session sees ([`claim_slot`]): a request takes it with
//! compare-and-set, holding it for its whole budget, and gives it back with
//! the time read after the service answered; the next request may go only
//! [`SEARCH_GAP_MS`] after that. Two requests are thus never sent closer
//! together than the gap, however slow storage is. A request that finds the
//! lease held waits, up to [`SLOT_ATTEMPTS`] times, then answers 429.
//!
//! Routes:
//!
//! * `GET /api/maps/search?q=<text>&near=<lat>,<lon>`: `{"query", "places":
//!   [place], "cached", "attribution"}`, at most 8 places, best first. `near`
//!   (optional) biases the search to a box of a degree around that point
//!   without limiting it to the box.
//! * `GET /api/maps/reverse?lat=<lat>&lon=<lon>`: the same shape, with the
//!   one place found at a dropped pin, or none.
//! * `GET /api/maps/route?from=<lat>,<lon>&to=<lat>,<lon>&mode=driving|walking`:
//!   `{"route": {"distance_m", "duration_s", "path": [[lat, lon]], "steps":
//!   [{"text", "distance_m", "lat", "lon"}]}, "cached", "attribution"}`, with
//!   `route` `null` when the router answered 200 with no journey (`routing.rs`).
//!   The routers say no journey under HTTP 400: that answers 404, uncached.
//! * `GET`, `PUT`, `DELETE /api/maps/places`: the person's places
//!   (`places.rs`), one document under the revision rule of `document.rs`.
//!
//! A place is `{"id", "name", "category", "lat", "lon", "address": [lines],
//! "website"?, "phone"?, "wikipedia"?}` (`places::Place`). Failures: 400 for
//! a query or coordinate that is not valid, 429 when the service's turn is
//! taken, 502 when egress refuses the service or its answer cannot be read, 503
//! when the application has no such egress or the service is busy, 504 when the
//! service does not answer within the module's budget.

mod nominatim;
mod places;
mod routing;

use std::io;

use ferrite_app::crypto::{hex, sha256};
use ferrite_app::{serde_json, EgressHeader, EgressHttpMethod, EgressOutcome};
use serde_json::Value;

use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};
// Upstream Core's SDK has no egress deadline of its own; `within` bounds one.
use super::fetch::within;

pub const MODULE: AppModule = AppModule {
    name: "maps",
    title: "Maps",
    handle,
};

/// The egress handle `ferrite.json` declares for Nominatim.
pub const SEARCH_EGRESS: &str = "maps-search";
/// Nominatim, the OpenStreetMap Foundation's geocoder.
pub const NOMINATIM: &str = "https://nominatim.openstreetmap.org";
/// The egress handle `ferrite.json` declares for the routers.
pub const ROUTE_EGRESS: &str = "maps-route";
/// The FOSSGIS OSRM routers.
pub const ROUTERS: &str = "https://routing.openstreetmap.de";
/// How the module introduces itself to both services, as their usage policies
/// ask: the application's one agent (`fetch.rs`).
pub const USER_AGENT: &str = super::fetch::USER_AGENT;
/// What every answer built from OpenStreetMap data must credit.
pub const ATTRIBUTION: &str = "© OpenStreetMap contributors";
/// How long a search or reverse answer is kept: 24 hours.
pub const SEARCH_CACHE_MS: u64 = 24 * 60 * 60 * 1000;
/// How many times a request tries to claim the service's turn.
pub const SLOT_ATTEMPTS: usize = 3;
/// The least time between two requests to Nominatim, for the whole
/// application: its usage policy allows one a second.
pub const SEARCH_GAP_MS: u64 = 1_000;
/// The shared key of Nominatim's lease.
const SEARCH_SLOT: &str = "nominatim/last-request-ms";
/// The shared key of the routers' lease.
const ROUTE_SLOT: &str = "routers/last-request-ms";
/// The most places a search answers.
pub const MAX_RESULTS: usize = 8;
/// The longest search, in characters.
pub const MAX_QUERY_CHARS: usize = 200;
/// How long the module works on one request, under the platform's 8-second
/// API deadline with room for the reply.
const BUDGET_MS: u64 = 6_500;

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    match (cx.request.method, cx.request.path) {
        ("GET", "/search") => {
            let query = match param(&cx, "q").map(|raw| raw.and_then(|raw| query_text(&raw))) {
                Some(Ok(query)) => query,
                Some(Err(message)) => return Response::error(400, &message),
                None => return Response::error(400, "enter a place or an address to search for"),
            };
            let near = match param(&cx, "near") {
                None => None,
                Some(Ok(raw)) if raw.is_empty() => None,
                Some(raw) => match raw.ok().as_deref().and_then(coordinate) {
                    Some(point) => Some(point),
                    None => return Response::error(400, "near must be <latitude>,<longitude>"),
                },
            };
            search(&mut cx, &query, near).await
        }
        (_, "/search") => Response::method_not_allowed(),
        ("GET", "/reverse") => {
            let number = |name: &str| {
                param(&cx, name)
                    .and_then(Result::ok)
                    .and_then(|raw| raw.trim().parse::<f64>().ok())
            };
            let (lat, lon) = (number("lat"), number("lon"));
            match (lat, lon) {
                (Some(lat), Some(lon)) if valid_point(lat, lon) => reverse(&mut cx, lat, lon).await,
                _ => Response::error(400, "lat and lon must be a latitude and a longitude"),
            }
        }
        (_, "/reverse") => Response::method_not_allowed(),
        ("GET", "/route") => {
            let point = |name: &str| {
                param(&cx, name)
                    .and_then(Result::ok)
                    .as_deref()
                    .and_then(coordinate)
            };
            let mode = param(&cx, "mode")
                .and_then(Result::ok)
                .as_deref()
                .and_then(routing::Mode::parse);
            match (point("from"), point("to"), mode) {
                (Some(from), Some(to), Some(mode)) => route_between(&mut cx, from, to, mode).await,
                (_, _, None) => Response::error(400, "mode must be driving or walking"),
                _ => Response::error(400, "from and to must be <latitude>,<longitude>"),
            }
        }
        (_, "/route") => Response::method_not_allowed(),
        (_, "/places") => places::handle(&mut cx).await,
        _ => Response::not_found(),
    }
}

/// A query parameter, percent-decoded: `None` when absent, an error when it
/// is there but does not decode to UTF-8.
fn param(cx: &ApiCtx<'_>, name: &str) -> Option<Result<String, String>> {
    let raw = cx.request.query_param(name)?;
    Some(
        super::spotlight::decode(raw).ok_or_else(|| format!("{name} is not percent-encoded UTF-8")),
    )
}

/// The search as it is asked and cached: trimmed, runs of white space made
/// one space, 1 to [`MAX_QUERY_CHARS`] characters with no control character.
pub fn query_text(raw: &str) -> Result<String, String> {
    let text = raw.split_whitespace().collect::<Vec<_>>().join(" ");
    if text.is_empty() {
        return Err("enter a place or an address to search for".into());
    }
    if text.chars().count() > MAX_QUERY_CHARS {
        return Err(format!("a search is at most {MAX_QUERY_CHARS} characters"));
    }
    if text.chars().any(char::is_control) {
        return Err("a search cannot contain control characters".into());
    }
    Ok(text)
}

/// Whether `lat`, `lon` is a point on the globe.
pub fn valid_point(lat: f64, lon: f64) -> bool {
    lat.is_finite()
        && lon.is_finite()
        && (-90.0..=90.0).contains(&lat)
        && (-180.0..=180.0).contains(&lon)
}

/// `<lat>,<lon>` as a point, or `None`.
pub fn coordinate(text: &str) -> Option<(f64, f64)> {
    let (lat, lon) = text.split_once(',')?;
    let lat: f64 = lat.trim().parse().ok()?;
    let lon: f64 = lon.trim().parse().ok()?;
    valid_point(lat, lon).then_some((lat, lon))
}

/// Percent-encode `text` for a URL's query or path: everything but ASCII
/// letters, digits and `-_.~`.
pub fn encode(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for byte in text.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~') {
            out.push(byte as char);
        } else {
            out.push_str(&format!("%{byte:02X}"));
        }
    }
    out
}

/// The URL Nominatim's search is asked, and the key its answer is cached
/// under. `near` is rounded to a tenth of a degree, so that searches from
/// nearby views share one answer; the box around it is a degree wide.
pub fn search_request(query: &str, near: Option<(f64, f64)>) -> (String, String) {
    let mut url = format!(
        "{NOMINATIM}/search?format=jsonv2&addressdetails=1&extratags=1&limit={MAX_RESULTS}&q={}",
        encode(query)
    );
    let mut key = query.to_lowercase();
    if let Some((lat, lon)) = near {
        let (lat, lon) = ((lat * 10.0).round() / 10.0, (lon * 10.0).round() / 10.0);
        let left = (lon - 0.5).max(-180.0);
        let right = (lon + 0.5).min(180.0);
        let top = (lat + 0.5).min(90.0);
        let bottom = (lat - 0.5).max(-90.0);
        url.push_str(&format!(
            "&viewbox={left:.1},{top:.1},{right:.1},{bottom:.1}"
        ));
        key.push_str(&format!("\n{lat:.1},{lon:.1}"));
    }
    (
        url,
        format!("cache/search/{}", hex(&sha256(key.as_bytes()))),
    )
}

/// The URL Nominatim's reverse geocoder is asked, and the cache key.
pub fn reverse_request(lat: f64, lon: f64) -> (String, String) {
    (
        format!(
            "{NOMINATIM}/reverse?format=jsonv2&addressdetails=1&extratags=1&zoom=18&lat={lat:.6}&lon={lon:.6}"
        ),
        format!("cache/reverse/{lat:.5},{lon:.5}"),
    )
}

fn storage_failed(error: io::Error) -> Response {
    Response::error(503, &format!("storage failed: {error}"))
}

/// A cached answer, if one is kept, read strictly as the `T` this module
/// wrote and checked by `check`: the cache holds only what this module wrote,
/// so an entry of any other shape is a storage fault the route answers 503
/// naming the mismatch, never an absent entry.
async fn cached<T: ferrite_app::serde::de::DeserializeOwned>(
    cx: &mut ApiCtx<'_>,
    key: &str,
    check: fn(&T) -> Result<(), String>,
) -> io::Result<Option<T>> {
    let Some(bytes) = cx.storage.shared().get(key).await? else {
        return Ok(None);
    };
    let invalid = |why: String| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            format!("a kept answer could not be read: {why}"),
        )
    };
    let value: T =
        super::fetch::strict::decode(&bytes, key).map_err(|mismatch| invalid(mismatch.0))?;
    check(&value).map_err(invalid)?;
    Ok(Some(value))
}

/// Every cached place passes the documents' own place rule, and the list is
/// one a search answers: at most [`MAX_RESULTS`] places, each id once.
fn cached_places(found: &Vec<places::Place>) -> Result<(), String> {
    if found.len() > MAX_RESULTS {
        return Err(format!("more than {MAX_RESULTS} places"));
    }
    for (at, place) in found.iter().enumerate() {
        if found[..at].iter().any(|other| other.id == place.id) {
            return Err(format!("the place {} is listed twice", place.id));
        }
    }
    found.iter().try_for_each(places::validate_place)
}

async fn keep(cx: &mut ApiCtx<'_>, key: &str, value: &Value, for_ms: u64) {
    let expires = cx.ctx.now_ms() + for_ms;
    let written = match serde_json::to_vec(value) {
        Ok(bytes) => cx.storage.shared().put_expiring(key, &bytes, expires).await,
        Err(error) => Err(io::Error::other(error)),
    };
    if let Err(error) = written {
        ferrite_app::tracing::warn!(%error, "could not cache a maps answer");
    }
}

/// How long to wait before a request may go to a service, given the time its
/// lease is held until (epoch ms, `None` before the first request) and the
/// time now: 0 once `gap` has passed since then.
pub fn slot_wait(held_until: Option<u64>, now: u64, gap: u64) -> u64 {
    held_until.map_or(0, |until| (until + gap).saturating_sub(now))
}

/// What a request writes when it takes a service's lease at `now`: held for
/// its whole budget, so nobody else goes while it may still be on its way.
pub fn lease_until(now: u64) -> u64 {
    now + BUDGET_MS
}

/// The time a stored lease is held until: `None` before the first request.
/// A stored lease of any other shape than the number this module writes is a
/// storage fault, never a free lease.
fn held_until(stored: Option<&[u8]>) -> io::Result<Option<u64>> {
    let Some(bytes) = stored else {
        return Ok(None);
    };
    std::str::from_utf8(bytes)
        .ok()
        .and_then(|text| text.parse::<u64>().ok())
        .map(Some)
        .ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidData,
                "a stored service lease is not a time",
            )
        })
}

/// Take the lease of the service whose shared key is `key`, so that this
/// request is the only one on its way to that service and goes at least
/// `gap` after the last one came back. The time is read after storage
/// answers, never before. A request that finds the lease held waits, up to
/// [`SLOT_ATTEMPTS`] times. `Ok(Some(lease))` with the value to hand back to
/// [`release_slot`]; `Ok(None)` when it never got a turn.
async fn claim_slot(cx: &mut ApiCtx<'_>, key: &str, gap: u64) -> io::Result<Option<u64>> {
    for attempt in 0..SLOT_ATTEMPTS {
        let stored = cx.storage.shared().get_versioned(key).await?;
        let now = cx.ctx.now_ms();
        let held_until = held_until(stored.as_ref().map(|(bytes, _)| bytes.as_slice()))?;
        let wait = slot_wait(held_until, now, gap);
        if wait == 0 {
            let version = stored.map(|(_, version)| version);
            let lease = lease_until(now);
            if cx
                .storage
                .shared()
                .put_if_version(key, lease.to_string().as_bytes(), version)
                .await?
            {
                return Ok(Some(lease));
            }
            // Another request took this turn.
        }
        if attempt + 1 < SLOT_ATTEMPTS {
            ferrite_app::sleep_ms(wait.clamp(1, gap) + 5).await;
        }
    }
    Ok(None)
}

/// Give back the lease taken as `lease`, recording the time the service's
/// answer (or failure) came back: the next request goes a full gap after it.
/// A lease that expired and was taken by another request is left alone.
async fn release_slot(cx: &mut ApiCtx<'_>, key: &str, lease: u64) {
    let done = cx.ctx.now_ms();
    let mut space = cx.storage.shared();
    let released = match space.get_versioned(key).await {
        Ok(Some((bytes, version))) => match held_until(Some(&bytes)) {
            Ok(Some(held)) if held == lease => space
                .put_if_version(key, done.to_string().as_bytes(), Some(version))
                .await
                .map(|_| ()),
            Ok(_) => Ok(()),
            Err(error) => Err(error),
        },
        Ok(None) => Ok(()),
        Err(error) => Err(error),
    };
    // A lease not given back expires at the end of its budget.
    if let Err(error) = released {
        ferrite_app::tracing::warn!(%error, "could not give back a maps service lease");
    }
}

fn headers() -> [EgressHeader; 3] {
    [
        EgressHeader {
            name: "user-agent".into(),
            value: USER_AGENT.into(),
        },
        EgressHeader {
            name: "accept".into(),
            value: "application/json".into(),
        },
        EgressHeader {
            name: "accept-language".into(),
            value: "en".into(),
        },
    ]
}

/// Ask `url` through egress `handle` within the time left of `started`'s
/// budget: the answer's status and body, or the reply that reports why
/// there is none. `service` names it in those replies.
async fn ask(
    cx: &mut ApiCtx<'_>,
    handle: &str,
    url: &str,
    service: &str,
    started: u64,
) -> Result<(u16, Vec<u8>), Response> {
    let left = BUDGET_MS.saturating_sub(cx.ctx.now_ms().saturating_sub(started));
    if left == 0 {
        return Err(Response::error(
            504,
            &format!("the {service} did not answer in time"),
        ));
    }
    let mut egress = cx.ctx.egress(handle).map_err(|error| {
        Response::error(
            503,
            &format!("this desktop has no egress to the {service}: {error}"),
        )
    })?;
    let headers = headers();
    match within(
        left,
        egress.deliver_http(EgressHttpMethod::Get, url, &headers, &[]),
    )
    .await
    {
        None => Err(Response::error(
            504,
            &format!("the {service} did not answer in time"),
        )),
        Some(Ok(EgressOutcome::Delivered { status, body })) => Ok((status, body)),
        Some(Ok(EgressOutcome::Denied { reason })) => Err(Response::error(
            502,
            &format!("egress refused the {service}: {reason}"),
        )),
        Some(Err(error)) => Err(Response::error(
            502,
            &format!("the {service} could not be reached: {error}"),
        )),
    }
}

/// The reply of a search or a reverse geocode.
fn places_reply(query: &str, places: &[places::Place], cached: bool) -> Response {
    Response::json(
        200,
        &serde_json::json!({
            "query": query,
            "places": places,
            "cached": cached,
            "attribution": ATTRIBUTION,
        }),
    )
}

/// Ask Nominatim (`url`, cached under `key`) once its second is claimed.
async fn geocode(cx: &mut ApiCtx<'_>, query: &str, url: &str, key: &str) -> Response {
    let started = cx.ctx.now_ms();
    match cached(cx, key, cached_places).await {
        Ok(Some(places)) => return places_reply(query, &places, true),
        Ok(None) => {}
        Err(error) => return storage_failed(error),
    }
    let lease = match claim_slot(cx, SEARCH_SLOT, SEARCH_GAP_MS).await {
        Ok(Some(lease)) => lease,
        Ok(None) => {
            return Response::error(
                429,
                "Maps asks OpenStreetMap's search at most once a second for everyone on this desktop, as its usage policy asks; search again in a moment",
            )
            .add_header("retry-after", "1")
        }
        Err(error) => return storage_failed(error),
    };
    let asked = ask(cx, SEARCH_EGRESS, url, "search service", started).await;
    release_slot(cx, SEARCH_SLOT, lease).await;
    let (status, body) = match asked {
        Ok(answer) => answer,
        Err(response) => return response,
    };
    match status {
        200 => {}
        // Nominatim's reverse geocoder answers 404 with `{"error": "Unable to geocode"}` when
        // no place is at the point: nothing found, readably.
        404 if nominatim::nothing_found(&body) => {
            keep(cx, key, &Value::Array(Vec::new()), SEARCH_CACHE_MS).await;
            return places_reply(query, &[], false);
        }
        429 | 503 => {
            return Response::error(
                503,
                &format!(
                "OpenStreetMap's search service is busy (HTTP {status}); search again in a minute"
            ),
            )
        }
        _ => return Response::error(502, &format!("the search service answered HTTP {status}")),
    }
    let found = match nominatim::places(&body, MAX_RESULTS) {
        Ok(found) => found,
        Err(mismatch) => {
            return Response::error(
                502,
                &format!("the search service's answer could not be read: {mismatch}"),
            )
        }
    };
    match serde_json::to_value(&found) {
        Ok(value) => keep(cx, key, &value, SEARCH_CACHE_MS).await,
        Err(error) => ferrite_app::tracing::warn!(%error, "could not cache a maps answer"),
    }
    places_reply(query, &found, false)
}

async fn search(cx: &mut ApiCtx<'_>, query: &str, near: Option<(f64, f64)>) -> Response {
    let (url, key) = search_request(query, near);
    geocode(cx, query, &url, &key).await
}

async fn reverse(cx: &mut ApiCtx<'_>, lat: f64, lon: f64) -> Response {
    let (url, key) = reverse_request(lat, lon);
    geocode(cx, &format!("{lat:.5},{lon:.5}"), &url, &key).await
}

/// The reply of a route.
fn route_reply(route: &routing::Answer, cached: bool) -> Response {
    Response::json(
        200,
        &serde_json::json!({
            "route": route,
            "cached": cached,
            "attribution": ATTRIBUTION,
        }),
    )
}

/// The route between two points, from the cache or from the router once its
/// second is claimed. An answer under any status but 200 is never a route and
/// is never cached; the router's own 400 saying there is no journey is the
/// 404 of the module.
async fn route_between(
    cx: &mut ApiCtx<'_>,
    from: (f64, f64),
    to: (f64, f64),
    mode: routing::Mode,
) -> Response {
    let started = cx.ctx.now_ms();
    let key = format!(
        "cache/route/{}/{:.5},{:.5};{:.5},{:.5}",
        mode.name(),
        from.0,
        from.1,
        to.0,
        to.1
    );
    match cached(cx, &key, routing::validate).await {
        Ok(Some(answer)) => return route_reply(&answer, true),
        Ok(None) => {}
        Err(error) => return storage_failed(error),
    }
    let lease = match claim_slot(cx, ROUTE_SLOT, SEARCH_GAP_MS).await {
        Ok(Some(lease)) => lease,
        Ok(None) => {
            return Response::error(
                429,
                "Maps asks the routing service at most once a second for everyone on this desktop, as its usage policy asks; ask again in a moment",
            )
            .add_header("retry-after", "1")
        }
        Err(error) => return storage_failed(error),
    };
    let url = routing::route_url(ROUTERS, mode, from, to);
    let asked = ask(cx, ROUTE_EGRESS, &url, "routing service", started).await;
    release_slot(cx, ROUTE_SLOT, lease).await;
    let (status, body) = match asked {
        Ok(answer) => answer,
        Err(response) => return response,
    };
    let read = match status {
        200 => routing::read_answer(&body),
        // The routers say "no journey" under this status. It is an error like any other answer
        // that is not 200, and never cached; the window reads the sentence.
        400 if routing::says_no_journey(&body) => {
            return Response::error(404, "no road joins these places")
        }
        429 | 503 => {
            return Response::error(
                503,
                &format!("the routing service is busy (HTTP {status}); ask again in a minute"),
            )
        }
        _ => return Response::error(502, &format!("the routing service answered HTTP {status}")),
    };
    let answer = match read {
        Ok(answer) => answer,
        Err(mismatch) => {
            return Response::error(
                502,
                &format!("the routing service's answer could not be read: {mismatch}"),
            )
        }
    };
    match serde_json::to_value(&answer) {
        Ok(value) => keep(cx, &key, &value, SEARCH_CACHE_MS).await,
        Err(error) => ferrite_app::tracing::warn!(%error, "could not cache a route"),
    }
    route_reply(&answer, false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn requests_are_a_full_gap_apart_whatever_second_they_fall_in() {
        let gap = SEARCH_GAP_MS;
        assert_eq!(slot_wait(None, 5, gap), 0, "the first request goes at once");
        // 999 ms and 1,001 ms fall in different seconds but are 2 ms apart.
        assert_eq!(slot_wait(Some(999), 1_001, gap), 998);
        assert_eq!(slot_wait(Some(999), 1_998, gap), 1);
        assert_eq!(slot_wait(Some(999), 1_999, gap), 0);
        assert_eq!(slot_wait(Some(999), 50_000, gap), 0);
    }

    #[test]
    fn a_request_on_its_way_holds_the_service_until_it_comes_back() {
        // Taken at 10,000 and not yet given back: storage or the service may
        // be slow, so nobody else goes for the whole budget and a gap after.
        let held = lease_until(10_000);
        assert!(slot_wait(Some(held), 10_000 + 5_000, SEARCH_GAP_MS) > 0);
        assert!(slot_wait(Some(held), 10_000 + BUDGET_MS, SEARCH_GAP_MS) > 0);
        // Given back when the answer came, at 13,250 (however late the
        // request went): the next goes a full gap after that.
        assert_eq!(slot_wait(Some(13_250), 14_000, SEARCH_GAP_MS), 250);
        assert_eq!(slot_wait(Some(13_250), 14_250, SEARCH_GAP_MS), 0);
    }

    #[test]
    fn a_cached_answer_is_one_a_search_could_give() {
        let place = |id: &str| places::Place {
            id: id.into(),
            name: "Golden Gate Bridge".into(),
            category: "Bridge".into(),
            lat: 37.8,
            lon: -122.4,
            address: vec![],
            website: None,
            phone: None,
            wikipedia: None,
        };
        assert_eq!(
            cached_places(&vec![place("osm-r1"), place("osm-w2")]),
            Ok(())
        );
        assert_eq!(
            cached_places(&vec![place("osm-r1"), place("osm-r1")]),
            Err("the place osm-r1 is listed twice".into())
        );
        let nine: Vec<places::Place> = (0..=MAX_RESULTS)
            .map(|n| place(&format!("osm-n{n}")))
            .collect();
        assert_eq!(cached_places(&nine), Err("more than 8 places".into()));
        let mut off = place("osm-r1");
        off.lat = 95.0;
        assert!(cached_places(&vec![off]).is_err());
    }

    #[test]
    fn searches_are_trimmed_bounded_and_plain() {
        assert_eq!(
            query_text("  Golden   Gate\tBridge ").unwrap(),
            "Golden Gate Bridge"
        );
        assert!(query_text("   ").is_err());
        assert!(query_text(&"a".repeat(MAX_QUERY_CHARS)).is_ok());
        assert!(query_text(&"a".repeat(MAX_QUERY_CHARS + 1)).is_err());
        assert!(query_text("a\u{0}b").is_err());
    }

    #[test]
    fn coordinates_are_points_on_the_globe() {
        assert_eq!(coordinate("37.8199,-122.4783"), Some((37.8199, -122.4783)));
        assert_eq!(coordinate(" -90 , 180 "), Some((-90.0, 180.0)));
        for bad in [
            "", "37.8", "91,0", "0,-181", "NaN,0", "inf,0", "a,b", "1,2,3",
        ] {
            assert_eq!(coordinate(bad), None, "{bad:?}");
        }
    }

    #[test]
    fn queries_are_percent_encoded() {
        assert_eq!(
            encode("Golden Gate & Co/x?"),
            "Golden%20Gate%20%26%20Co%2Fx%3F"
        );
        assert_eq!(encode("Zürich"), "Z%C3%BCrich");
        assert_eq!(encode("a-b_c.d~"), "a-b_c.d~");
    }

    #[test]
    fn a_search_is_cached_by_its_normalised_text_and_rounded_place() {
        let (url, key) = search_request("Golden Gate", None);
        assert!(url.starts_with("https://nominatim.openstreetmap.org/search?format=jsonv2"));
        assert!(url.ends_with("&limit=8&q=Golden%20Gate"));
        assert_eq!(
            search_request("golden gate", None).1,
            key,
            "case does not matter"
        );
        let (near, near_key) = search_request("Golden Gate", Some((37.7749, -122.4194)));
        assert!(near.ends_with("&viewbox=-122.9,38.3,-121.9,37.3"), "{near}");
        assert_ne!(near_key, key);
        assert_eq!(
            search_request("Golden Gate", Some((37.79, -122.41))).1,
            near_key,
            "nearby views share an answer"
        );
        assert!(key.starts_with("cache/search/") && key.len() == 13 + 64);
    }
}

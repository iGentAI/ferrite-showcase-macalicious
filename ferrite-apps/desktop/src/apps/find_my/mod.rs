//! Find My's server half: the person's browsers as devices, each with its
//! last position and time, and Play Sound.
//!
//! A browser with Find My open reports where it is, from its own Geolocation
//! API, and that report is the device. Devices live in the person's own
//! space (`storage.user()`), keyed by the signed-in account, so every browser
//! signed in to the account is listed; before anyone signs in, the browser's
//! session is the person and its one device. A device is named by its
//! browser's own session (`Session::browser`), never the account, so two
//! browsers of one account are two devices.
//!
//! * `PUT /api/find-my/me` with `{"lat", "lon", "accuracy_m", "label",
//!   "reported_at"}`: records this browser as `devices/<id>`, kept for
//!   [`DEVICE_TTL_MS`] after its last report, and answers `{"device",
//!   "applied", "session"}`. `reported_at` is when the browser made the
//!   report, by its own clock (epoch ms). A device keeps its newest report by
//!   that time, whatever order reports arrive in: a report no newer than the
//!   stored one (an older one that arrived late, or one made in the same
//!   millisecond) changes nothing and is answered with the stored device and
//!   `"applied": false`. A report dated more than [`MAX_CLOCK_AHEAD_MS`] after
//!   the platform clock is refused with 400, so a browser whose clock runs
//!   fast can hold its device against later reports for at most that long.
//! * `GET /api/find-my/devices`: `{"devices": [{"id", "label", "lat",
//!   "lon", "accuracy_m", "at", "this", "sound_pending", "sound_request"}],
//!   "session"}`, this browser first, then the most recently seen.
//! * `POST /api/find-my/devices/<id>/sound`: asks that device to play a
//!   sound. The request, with an id of its own, is kept as `sounds/<id>` for
//!   [`SOUND_TTL_MS`]; the device's browser sees `sound_pending` and
//!   `sound_request` on its next read, plays the sound and clears it.
//! * `DELETE /api/find-my/devices/<id>/sound?request=<request id>`: clears
//!   that request only. A request asked since it is left waiting, and the
//!   reply says so (`sound_pending`, `sound_request`). Without `request`, it
//!   answers 400: an acknowledgement always names what was played.
//! * `DELETE /api/find-my/devices/<id>`: forgets the device and any sound
//!   asked of it. A browser that reports again appears again.
//!
//! A device's id is derived from its browser's session id and cannot be
//! turned back into it: `<id>` names a device only in the person's own space,
//! so nobody reaches another person's devices. Sharing a position with another
//! account is [`people`]'s, by the sharer's own choice.

use ferrite_app::crypto::{hex, sha256};
use ferrite_app::{serde, serde_json};
use serde_json::Value;

use super::document;
use super::fetch::strict::{self, Strict};
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture, Space};

pub mod people;

pub const MODULE: AppModule = AppModule {
    name: "find-my",
    title: "Find My",
    handle,
};

/// How long a device is kept after its last report: 7 days.
pub const DEVICE_TTL_MS: u64 = 7 * 24 * 60 * 60 * 1000;
/// How long a Play Sound waits for its device: 10 minutes.
pub const SOUND_TTL_MS: u64 = 10 * 60 * 1000;
/// The most devices a listing shows: this browser, then the most recently
/// seen. Nothing is forgotten to make room: a device is forgotten
/// [`DEVICE_TTL_MS`] after its last report, or when the person removes it.
pub const MAX_DEVICES: usize = 50;
/// The most records a listing reads. Records are read in key order, not by
/// recency, so a listing reads them all before sorting; a space holding more
/// than this (one record per browser that reported in the last 7 days) is
/// answered 503 rather than shown with newer devices left out.
const LIST_CAP: usize = 1_000;
/// The longest device name.
pub const MAX_LABEL_CHARS: usize = 64;
/// The least precise position kept, in metres.
pub const MAX_ACCURACY_M: f64 = 100_000.0;
/// How far ahead of the platform clock a report's own time may be: 10
/// minutes. Reports are ordered by the browser's clock, so this bounds how
/// long a clock that was fast and is then set right keeps its later reports
/// from being stored.
pub const MAX_CLOCK_AHEAD_MS: u64 = 10 * 60 * 1000;
/// How often a report retries its compare-and-set before answering 503.
const REPORT_ATTEMPTS: usize = 4;

/// What a browser reports.
#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Report {
    pub lat: f64,
    pub lon: f64,
    pub accuracy_m: f64,
    pub label: String,
    /// When the browser made the report, by its own clock (epoch ms).
    pub reported_at: u64,
}

/// A device as it is kept.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Device {
    pub label: String,
    pub lat: f64,
    pub lon: f64,
    pub accuracy_m: f64,
    /// When the platform received the report it holds (epoch ms): what the
    /// window shows as "last seen".
    pub at: u64,
    /// The report's own time, by its browser's clock (epoch ms): what orders
    /// one device's reports.
    pub reported_at: u64,
}

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

/// The device id of a session: the first 16 hex digits of a hash of it.
pub fn device_id(session_id: &str) -> String {
    let digest = hex(&sha256(
        format!("macalicious/find-my/device/v1\n{session_id}").as_bytes(),
    ));
    digest[..16].to_string()
}

/// Whether `id` has the form of a device id.
pub fn is_device_id(id: &str) -> bool {
    id.len() == 16 && id.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
}

fn round6(value: f64) -> f64 {
    (value * 1e6).round() / 1e6
}

/// Why a position or name is not one a device may have: a point on the
/// globe, an accuracy of 0 to [`MAX_ACCURACY_M`] metres, a trimmed name of 1
/// to [`MAX_LABEL_CHARS`] characters.
fn invalid(lat: f64, lon: f64, accuracy_m: f64, label: &str) -> Option<String> {
    let on_globe = lat.is_finite()
        && lon.is_finite()
        && (-90.0..=90.0).contains(&lat)
        && (-180.0..=180.0).contains(&lon);
    if !on_globe {
        return Some("lat and lon must be a latitude and a longitude".into());
    }
    if !accuracy_m.is_finite() || !(0.0..=MAX_ACCURACY_M).contains(&accuracy_m) {
        return Some(format!("accuracy_m must be 0 to {MAX_ACCURACY_M} metres"));
    }
    let count = label.chars().count();
    if label != label.trim()
        || !(1..=MAX_LABEL_CHARS).contains(&count)
        || label.chars().any(char::is_control)
    {
        return Some(format!(
            "a device's name has 1 to {MAX_LABEL_CHARS} characters"
        ));
    }
    None
}

/// Check a report received at `at`: a point on the globe, an accuracy of 0
/// to [`MAX_ACCURACY_M`] metres, a name of 1 to [`MAX_LABEL_CHARS`]
/// characters, and a time of its own no more than [`MAX_CLOCK_AHEAD_MS`]
/// after `at`.
pub fn device(report: Report, at: u64) -> Result<Device, String> {
    let label = report.label.trim();
    if let Some(why) = invalid(report.lat, report.lon, report.accuracy_m, label) {
        return Err(why);
    }
    if report.reported_at > at.saturating_add(MAX_CLOCK_AHEAD_MS) {
        return Err(
            "reported_at is more than 10 minutes ahead of the server's clock: check this device's clock"
                .into(),
        );
    }
    Ok(Device {
        label: label.to_string(),
        lat: round6(report.lat),
        lon: round6(report.lon),
        accuracy_m: (report.accuracy_m * 10.0).round() / 10.0,
        at,
        reported_at: report.reported_at,
    })
}

/// Whether `incoming` replaces the device's stored report: only a report
/// strictly newer by its own time. An older report that arrives late, and a
/// second report made in the same millisecond, leave the stored one as it is,
/// so the order reports arrive in never decides which position is kept.
pub fn supersedes(stored: Option<&Device>, incoming: &Device) -> bool {
    stored.is_none_or(|stored| incoming.reported_at > stored.reported_at)
}

/// Store `incoming` as device `id` if it is newer than the stored report
/// ([`supersedes`]), with compare-and-set so two reports in flight at once
/// cannot overwrite each other out of order. Answers the device as it is now
/// stored and whether `incoming` is what was stored.
async fn record(
    space: &mut Space<'_>,
    id: &str,
    incoming: &Device,
    expires_at_ms: u64,
) -> Result<(Device, bool), Response> {
    let key = device_key(id);
    let bytes = serde_json::to_vec(incoming).map_err(|e| Response::error(500, &e.to_string()))?;
    for _ in 0..REPORT_ATTEMPTS {
        let stored = space.get_versioned(&key).await.map_err(storage_failed)?;
        let (current, version) = match &stored {
            Some((bytes, version)) => match stored_device(bytes, &key) {
                Ok(device) => (Some(device), Some(*version)),
                // The browser's own record, unreadable (damaged, or written by
                // an older version): a valid report replaces it, so the device
                // recovers at its next report instead of failing until it
                // expires. The listing still answers 503 for it until then.
                Err(mismatch) => {
                    ferrite_app::tracing::warn!(%mismatch, "a stored device is replaced by a report");
                    (None, Some(*version))
                }
            },
            None => (None, None),
        };
        if let Some(kept) = current.filter(|kept| !supersedes(Some(kept), incoming)) {
            return Ok((kept, false));
        }
        let written = space
            .put_if_version_expiring(&key, &bytes, version, expires_at_ms)
            .await
            .map_err(storage_failed)?;
        if written {
            return Ok((incoming.clone(), true));
        }
        // Another report was stored since it was read: compare with that one.
    }
    Err(Response::error(
        503,
        "this device's reports kept changing; try again",
    ))
}

/// A device as a reply shows it, with the id of the Play Sound request
/// waiting for it, if any.
fn view(id: &str, device: &Device, this: bool, sound: Option<String>) -> Value {
    serde_json::json!({
        "id": id,
        "label": device.label,
        "lat": device.lat,
        "lon": device.lon,
        "accuracy_m": device.accuracy_m,
        "at": device.at,
        "this": this,
        "sound_pending": sound.is_some(),
        "sound_request": sound,
    })
}

/// A stored Play Sound record: a request (`request`, with the time it was
/// asked), or the mark a device leaves when it has played one (`cleared`).
/// The id of the request it holds while it waits, `None` once it was played,
/// read strictly ([`fetch::strict`]): a record of any other shape (both
/// fields, neither, an id that is not a request id) is a mismatch, so a
/// waiting request is never mistaken for none.
pub fn waiting_request(bytes: &[u8]) -> Strict<Option<String>> {
    let record = strict::json(bytes)?;
    let record = strict::object(&record, "the sound record")?;
    let id = |key: &str| -> Strict<Option<String>> {
        match strict::optional_text(record, key)? {
            None => Ok(None),
            Some(id) if is_device_id(id) => Ok(Some(id.to_string())),
            Some(_) => strict::fail(format!("`{key}` is not a request id")),
        }
    };
    match (id("request")?, id("cleared")?) {
        (Some(request), None) => {
            strict::number(record, "requested_at")?;
            Ok(Some(request))
        }
        (None, Some(_)) => Ok(None),
        (Some(_), Some(_)) => strict::fail("the sound record is both asked and cleared"),
        (None, None) => strict::fail("the sound record has neither `request` nor `cleared`"),
    }
}

/// [`waiting_request`] as a storage read: a record that does not read is
/// an error the route answers 503, naming the mismatch.
fn read_sound(bytes: &[u8]) -> std::io::Result<Option<String>> {
    waiting_request(bytes).map_err(|mismatch| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            format!("a stored sound request could not be read: {mismatch}"),
        )
    })
}

/// A new Play Sound request's id: 16 random hex digits, so two requests are
/// never confused, even from one session for one device in one millisecond.
pub fn request_id() -> std::io::Result<String> {
    crate::crypto::random_token(8)
}

async fn sound_of(space: &mut Space<'_>, id: &str) -> std::io::Result<Option<String>> {
    match space.get(&sound_key(id)).await? {
        Some(bytes) => read_sound(&bytes),
        None => Ok(None),
    }
}

/// Whether an acknowledgement naming `wanted` clears the request `waiting`:
/// only that very request.
pub fn clears(waiting: Option<&str>, wanted: &str) -> bool {
    waiting == Some(wanted)
}

/// Clear device `id`'s Play Sound request `wanted`, with compare-and-set so
/// a request asked meanwhile is never cleared in its place. Answers the
/// request still waiting afterwards, if any. The mark it leaves expires at
/// `expires_at_ms`, as the request it replaces would have, so a played sound
/// leaves nothing behind for long.
async fn clear_sound(
    space: &mut Space<'_>,
    id: &str,
    wanted: &str,
    expires_at_ms: u64,
) -> std::io::Result<Option<String>> {
    let key = sound_key(id);
    for _ in 0..4 {
        let Some((bytes, version)) = space.get_versioned(&key).await? else {
            return Ok(None);
        };
        let waiting = read_sound(&bytes)?;
        if !clears(waiting.as_deref(), wanted) {
            return Ok(waiting);
        }
        let played = serde_json::json!({ "cleared": wanted });
        if space
            .put_if_version_expiring(
                &key,
                played.to_string().as_bytes(),
                Some(version),
                expires_at_ms,
            )
            .await?
        {
            return Ok(None);
        }
        // Changed since it was read (a new request): look again.
    }
    Err(std::io::Error::other("the sound request kept changing"))
}

/// The devices to list, this one first, then the most recently seen.
pub fn order(mut devices: Vec<(String, Device)>, this: &str) -> Vec<(String, Device)> {
    devices.sort_by(|(a_id, a), (b_id, b)| {
        (b_id == this)
            .cmp(&(a_id == this))
            .then(b.at.cmp(&a.at))
            .then(a_id.cmp(b_id))
    });
    devices
}

/// The devices a listing shows: this browser whenever it has reported, then
/// the most recently seen, at most [`MAX_DEVICES`] in all. Sorted before it
/// is cut, so the newest devices are never the ones dropped.
pub fn shown(devices: Vec<(String, Device)>, this: &str) -> Vec<(String, Device)> {
    let mut ordered = order(devices, this);
    ordered.truncate(MAX_DEVICES);
    ordered
}

/// The devices of a listing, read strictly ([`fetch::strict`]): a record
/// whose key is not a device id, or whose value is not a device, fails the
/// whole listing.
fn parse_devices(listed: Vec<(String, Vec<u8>)>) -> Strict<Vec<(String, Device)>> {
    listed
        .into_iter()
        .map(|(key, bytes)| {
            let Some(id) = key.strip_prefix("devices/").filter(|id| is_device_id(id)) else {
                return strict::fail(format!("{key} is not a device's key"));
            };
            Ok((id.to_string(), stored_device(&bytes, &key)?))
        })
        .collect()
}

/// A stored device, read strictly ([`fetch::strict`]): every field, with the
/// values [`device`] admits.
fn stored_device(bytes: &[u8], key: &str) -> Strict<Device> {
    let device = strict::decode::<Device>(bytes, key)?;
    match invalid(device.lat, device.lon, device.accuracy_m, &device.label) {
        Some(why) => strict::fail(format!("{key}: {why}")),
        None => Ok(device),
    }
}

fn device_key(id: &str) -> String {
    format!("devices/{id}")
}

fn sound_key(id: &str) -> String {
    format!("sounds/{id}")
}

fn storage_failed(error: std::io::Error) -> Response {
    Response::error(503, &format!("storage failed: {error}"))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    let session = cx.session;
    // The browser, not the person: every browser signed in to an account is
    // a device of its own.
    let this = device_id(&session.browser);
    match (cx.request.method, cx.request.path) {
        ("PUT", "/me") => {
            let report = match cx.request.json::<Report>() {
                Ok(report) => report,
                Err(response) => return response,
            };
            let incoming = match device(report, cx.now_ms) {
                Ok(device) => device,
                Err(message) => return Response::error(400, &message),
            };
            let mut space = cx.storage.user();
            // Only this browser's own record is written, so a report never
            // races another browser's; two of this browser's own are ordered
            // by their own time ([`record`]).
            let (stored, applied) =
                match record(&mut space, &this, &incoming, cx.now_ms + DEVICE_TTL_MS).await {
                    Ok(outcome) => outcome,
                    Err(response) => return response,
                };
            let pending = match sound_of(&mut space, &this).await {
                Ok(found) => found,
                Err(error) => return storage_failed(error),
            };
            if applied {
                people::reported(&mut cx, &stored).await;
            }
            document::for_session(
                serde_json::json!({
                    "device": view(&this, &stored, true, pending),
                    "applied": applied,
                }),
                session,
            )
        }
        (_, path) if path == "/people" || path.starts_with("/people/") => {
            people::route(&mut cx).await
        }
        (_, "/me") => Response::method_not_allowed(),
        ("GET", "/devices") => {
            let mut space = cx.storage.user();
            let listed = match space.list("devices/", LIST_CAP + 1).await {
                Ok(listed) if listed.len() > LIST_CAP => {
                    return Response::error(
                        503,
                        &format!(
                            "more than {LIST_CAP} devices are kept, too many to list by recency"
                        ),
                    )
                }
                Ok(listed) => listed,
                Err(error) => return storage_failed(error),
            };
            // A stored record that cannot be read fails the list: a list
            // with a device silently left out would pass as complete.
            let devices = match parse_devices(listed) {
                Ok(devices) => devices,
                Err(mismatch) => {
                    return Response::error(
                        503,
                        &format!("a stored device could not be read: {mismatch}"),
                    )
                }
            };
            let shown = shown(devices, &this);
            // Each shown device's own Play Sound request, read by its key, so
            // no listing limit can hide one.
            let mut views = Vec::with_capacity(shown.len());
            for (id, device) in &shown {
                let pending = match sound_of(&mut space, id).await {
                    Ok(found) => found,
                    Err(error) => return storage_failed(error),
                };
                views.push(view(id, device, *id == this, pending));
            }
            document::for_session(serde_json::json!({ "devices": views }), session)
        }
        (_, "/devices") => Response::method_not_allowed(),
        (method, path) if path.starts_with("/devices/") => {
            let rest = &path["/devices/".len()..];
            let (id, sound) = match rest.split_once('/') {
                Some((id, "sound")) => (id, true),
                Some(_) => return Response::not_found(),
                None => (rest, false),
            };
            if !is_device_id(id) {
                return Response::error(404, "no device has that id");
            }
            let mut space = cx.storage.user();
            match (method, sound) {
                ("POST", true) => {
                    match space.get(&device_key(id)).await {
                        Ok(Some(bytes)) => {
                            if let Err(mismatch) = stored_device(&bytes, &device_key(id)) {
                                return Response::error(
                                    503,
                                    &format!("a stored device could not be read: {mismatch}"),
                                );
                            }
                        }
                        Ok(None) => return Response::error(404, "no device has that id"),
                        Err(error) => return storage_failed(error),
                    }
                    let request = match request_id() {
                        Ok(request) => request,
                        Err(error) => {
                            return Response::error(
                                503,
                                &format!("no request id could be made: {error}"),
                            )
                        }
                    };
                    let asked =
                        serde_json::json!({ "requested_at": cx.now_ms, "request": request });
                    let written = space
                        .put_expiring(
                            &sound_key(id),
                            asked.to_string().as_bytes(),
                            cx.now_ms + SOUND_TTL_MS,
                        )
                        .await;
                    match written {
                        Ok(()) => Response::json(
                            200,
                            &serde_json::json!({
                                "id": id, "sound_pending": true, "sound_request": request,
                            }),
                        ),
                        Err(error) => storage_failed(error),
                    }
                }
                ("DELETE", true) => {
                    let Some(wanted) = cx.request.query_param("request") else {
                        return Response::error(
                            400,
                            "name the request that was played: ?request=<its id>",
                        );
                    };
                    match clear_sound(&mut space, id, wanted, cx.now_ms + SOUND_TTL_MS).await {
                        Ok(waiting) => Response::json(
                            200,
                            &serde_json::json!({
                                "id": id,
                                "sound_pending": waiting.is_some(),
                                "sound_request": waiting,
                            }),
                        ),
                        Err(error) => storage_failed(error),
                    }
                }
                ("DELETE", false) => {
                    let removed = match space.delete(&device_key(id)).await {
                        Ok(()) => space.delete(&sound_key(id)).await,
                        Err(error) => Err(error),
                    };
                    match removed {
                        Ok(()) => {
                            Response::json(200, &serde_json::json!({ "id": id, "removed": true }))
                        }
                        Err(error) => storage_failed(error),
                    }
                }
                _ => Response::method_not_allowed(),
            }
        }
        _ => Response::not_found(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_played_request_is_cleared_and_a_newer_one_keeps_waiting() {
        let a = request_id().unwrap();
        let b = request_id().unwrap();
        assert!(is_device_id(&a), "16 hex digits: {a}");
        // Asked again from the same session, of the same device, in the same
        // millisecond: still a request of its own.
        assert_ne!(a, b, "two requests are never one");
        let many: std::collections::HashSet<String> =
            (0..64).map(|_| request_id().unwrap()).collect();
        assert_eq!(many.len(), 64);
        let asked = |id: &str| format!(r#"{{"requested_at":1,"request":"{id}"}}"#);
        assert_eq!(waiting_request(asked(&a).as_bytes()), Ok(Some(a.clone())));
        assert_eq!(
            waiting_request(format!(r#"{{"cleared":"{a}"}}"#).as_bytes()),
            Ok(None)
        );
        // Any other record is a mismatch, never "nothing waits".
        for (bad, why) in [
            (
                r#"{"requested_at":1}"#.to_string(),
                "the sound record has neither `request` nor `cleared`",
            ),
            (
                format!(r#"{{"request":"{a}"}}"#),
                "`requested_at` is missing",
            ),
            (
                format!(r#"{{"requested_at":1,"request":"{a}","cleared":"{b}"}}"#),
                "the sound record is both asked and cleared",
            ),
            (
                r#"{"requested_at":1,"request":7}"#.to_string(),
                "`request` is not text",
            ),
            (
                r#"{"cleared":"not-an-id"}"#.to_string(),
                "`cleared` is not a request id",
            ),
            ("[]".to_string(), "the sound record is not an object"),
        ] {
            assert_eq!(
                waiting_request(bad.as_bytes()),
                Err(strict::Mismatch(why.into())),
                "{bad}"
            );
        }
        assert!(waiting_request(b"<html>").is_err());
        // Which acknowledgement clears which record: only the one it names.
        assert!(clears(Some(&a), &a));
        assert!(!clears(Some(&b), &a), "a newer request is kept");
        assert!(!clears(None, &a));
    }

    fn report(lat: f64, lon: f64, accuracy_m: f64, label: &str) -> Report {
        Report {
            lat,
            lon,
            accuracy_m,
            label: label.into(),
            reported_at: 5,
        }
    }

    #[test]
    fn a_report_is_a_point_with_its_accuracy_and_a_name() {
        let kept = device(
            report(37.8199123456, -122.4783, 12.345, " Chrome on macOS "),
            7,
        )
        .unwrap();
        assert_eq!(
            kept,
            Device {
                label: "Chrome on macOS".into(),
                lat: 37.819912,
                lon: -122.4783,
                accuracy_m: 12.3,
                at: 7,
                reported_at: 5,
            }
        );
        assert!(device(report(91.0, 0.0, 1.0, "x"), 0).is_err());
        assert!(device(report(0.0, f64::INFINITY, 1.0, "x"), 0).is_err());
        assert!(device(report(0.0, 0.0, -1.0, "x"), 0).is_err());
        assert!(device(report(0.0, 0.0, MAX_ACCURACY_M + 1.0, "x"), 0).is_err());
        assert!(device(report(0.0, 0.0, 1.0, "  "), 0).is_err());
        assert!(device(report(0.0, 0.0, 1.0, &"x".repeat(MAX_LABEL_CHARS + 1)), 0).is_err());
        assert!(device(report(0.0, 0.0, 1.0, "a\nb"), 0).is_err());
        assert!(serde_json::from_str::<Report>(
            r#"{"lat":0,"lon":0,"accuracy_m":1,"label":"x","reported_at":1,"session":"s"}"#
        )
        .is_err());
        assert!(
            serde_json::from_str::<Report>(r#"{"lat":0,"lon":0,"accuracy_m":1,"label":"x"}"#)
                .is_err(),
            "a report says when it was made"
        );
        // A browser's clock may run a little ahead of the platform's, not more.
        let ahead = |reported_at| Report {
            reported_at,
            ..report(0.0, 0.0, 1.0, "x")
        };
        assert!(device(ahead(1_000 + MAX_CLOCK_AHEAD_MS), 1_000).is_ok());
        assert!(device(ahead(1_001 + MAX_CLOCK_AHEAD_MS), 1_000).is_err());
        assert!(device(ahead(0), 1_000).is_ok(), "a slow clock is its own");
    }

    #[test]
    fn only_a_newer_report_replaces_a_device() {
        let made = |reported_at, lat| Device {
            label: "x".into(),
            lat,
            lon: 0.0,
            accuracy_m: 1.0,
            at: 100,
            reported_at,
        };
        assert!(supersedes(None, &made(1, 0.0)), "the first report is kept");
        assert!(supersedes(Some(&made(1, 0.0)), &made(2, 1.0)));
        assert!(
            !supersedes(Some(&made(2, 1.0)), &made(1, 0.0)),
            "an older report that arrives later changes nothing"
        );
        assert!(
            !supersedes(Some(&made(2, 1.0)), &made(2, 0.0)),
            "a report made in the same millisecond leaves the stored one"
        );
    }

    #[test]
    fn a_stored_device_has_the_values_a_report_may_have() {
        let kept =
            serde_json::to_vec(&device(report(51.5, -0.12, 20.0, "Safari"), 9).unwrap()).unwrap();
        assert_eq!(
            stored_device(&kept, "devices/k"),
            Ok(Device {
                label: "Safari".into(),
                lat: 51.5,
                lon: -0.12,
                accuracy_m: 20.0,
                at: 9,
                reported_at: 5,
            })
        );
        for (bad, why) in [
            (
                r#"{"label":"x","lat":999,"lon":0,"accuracy_m":1,"at":1,"reported_at":1}"#,
                "devices/k: lat and lon must be a latitude and a longitude",
            ),
            (
                r#"{"label":"x","lat":0,"lon":0,"accuracy_m":-1,"at":1,"reported_at":1}"#,
                "devices/k: accuracy_m must be 0 to 100000 metres",
            ),
            (
                r#"{"label":"","lat":0,"lon":0,"accuracy_m":1,"at":1,"reported_at":1}"#,
                "devices/k: a device's name has 1 to 64 characters",
            ),
            (
                r#"{"label":" x","lat":0,"lon":0,"accuracy_m":1,"at":1,"reported_at":1}"#,
                "devices/k: a device's name has 1 to 64 characters",
            ),
        ] {
            assert_eq!(
                stored_device(bad.as_bytes(), "devices/k"),
                Err(strict::Mismatch(why.into())),
                "{bad}"
            );
        }
        assert!(stored_device(
            br#"{"label":"x","lat":0,"lon":0,"accuracy_m":1,"at":1,"reported_at":1,"extra":1}"#,
            "devices/k"
        )
        .is_err());
    }

    #[test]
    fn device_ids_are_stable_short_and_not_the_session() {
        let id = device_id("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
        assert!(is_device_id(&id), "{id}");
        assert_eq!(
            id,
            device_id("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
        );
        assert_ne!(id, device_id("another"));
        assert!(
            !"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad".starts_with(&id)
        );
        assert!(!is_device_id("ABCDEF0123456789"));
        assert!(!is_device_id("abc"));
        assert!(!is_device_id("../../../shared/x"));
    }

    #[test]
    fn this_device_comes_first_then_the_most_recent() {
        let at = |at| Device {
            label: "x".into(),
            lat: 0.0,
            lon: 0.0,
            accuracy_m: 1.0,
            at,
            reported_at: at,
        };
        let ordered = order(
            vec![
                ("a".into(), at(5)),
                ("b".into(), at(9)),
                ("me".into(), at(1)),
            ],
            "me",
        );
        let ids: Vec<&str> = ordered.iter().map(|(id, _)| id.as_str()).collect();
        assert_eq!(ids, ["me", "b", "a"]);
    }

    #[test]
    fn a_long_list_keeps_this_browser_and_the_newest_devices() {
        let at = |at| Device {
            label: "x".into(),
            lat: 0.0,
            lon: 0.0,
            accuracy_m: 1.0,
            at,
            reported_at: at,
        };
        // More devices than are shown, read in key order (oldest first), with
        // this browser the least recently seen of all.
        let total = MAX_DEVICES as u64 + 30;
        let mut devices: Vec<(String, Device)> = (0..total)
            .map(|n| (format!("{n:016x}"), at(1_000 + n)))
            .collect();
        devices.push(("me".into(), at(1)));
        let list = shown(devices, "me");
        assert_eq!(list.len(), MAX_DEVICES);
        assert_eq!(list[0].0, "me");
        // Then the newest, newest first; the oldest are the ones dropped.
        let times: Vec<u64> = list[1..].iter().map(|(_, device)| device.at).collect();
        let newest: Vec<u64> = (0..(MAX_DEVICES as u64 - 1))
            .map(|n| 1_000 + total - 1 - n)
            .collect();
        assert_eq!(times, newest);
    }
}

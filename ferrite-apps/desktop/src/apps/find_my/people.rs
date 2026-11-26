//! Find My's People: one account sharing its position with another of this
//! desktop's accounts, by that account's own choice and until it stops.
//!
//! Each link is kept twice, as `sharing/<name>` in the sharer's space and
//! `following/<name>` in the other person's. The sharer's record is what
//! grants: a reader sees a position only while the sharer's record still names
//! the reader's account id, so stopping takes effect at once even if the second
//! write fails, and an account that takes a freed name inherits nothing. Only
//! the newest position of the sharer's devices is shown, with no device name
//! and no history.
//!
//! * `GET /api/find-my/people`: `{"people": [Person]}`, each with `name`,
//!   `full_name`, `sharing` (I share with them), `following` (they share with
//!   me), `position` (`lat`, `lon`, `accuracy_m`, `at`, or null), `asked` (I
//!   asked to follow them), `asks_me` (they asked to follow me) and `rule`.
//! * `PUT /people/<name>/share`, `DELETE /people/<name>/share`: start or stop
//!   sharing with them. The first start tells them in Notification Center.
//! * `PUT /people/<name>/ask`, `DELETE /people/<name>/ask`: ask to follow them,
//!   which tells them; or, for someone who asked, say no.
//! * `PUT /people/<name>/notify` with `{"kind": "arrive"|"leave", "lat", "lon",
//!   "label", "repeat"}`, `DELETE /people/<name>/notify`: tell me when someone
//!   who shares with me arrives within [`RULE_RADIUS_M`] of a point or leaves
//!   it. Each of the sharer's reports is held against the rule
//!   ([`reported`]), so the rule works with the follower's windows closed.
//! * `PUT /people/<name>/tell` with the same body, `DELETE /people/<name>/tell`:
//!   tell them when I arrive at a point or leave it, while I share with them.
//!   Each of my own reports is held against it.
//! * `DELETE /people/<name>`: stops sharing with them and forgets them.
//!
//! Someone who has blocked the person in Messages is not reached: the request
//! answers as if it had been, as a message to them does. Nobody can address a
//! Guest User, and a Guest User cannot share.

use ferrite_app::{serde, serde_json};
use serde_json::Value;

use super::{stored_device, Device, LIST_CAP, MODULE};
use crate::apps::messages::blocked;
use crate::apps::notification_center::{self, Notification};
use crate::http::Response;
use crate::module::{ApiCtx, Space, Storage};
use crate::session::Account;

/// The most people one account can have links with, in each direction.
pub const MAX_PEOPLE: usize = 100;
/// How far from a rule's point counts as being there, in metres.
pub const RULE_RADIUS_M: f64 = 200.0;
/// The longest name of a rule's place.
const MAX_PLACE_CHARS: usize = 64;

/// One side of a link: the other account as it was when the link was made.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Link {
    id: String,
    name: String,
    full_name: String,
    since: u64,
}

/// A follower's rule on someone who shares with them.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Rule {
    kind: RuleKind,
    lat: f64,
    lon: f64,
    label: String,
    repeat: bool,
    /// Whether the last position held against it was within the radius;
    /// `None` until one has been.
    inside: Option<bool>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
enum RuleKind {
    Arrive,
    Leave,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct RuleRequest {
    kind: RuleKind,
    lat: f64,
    lon: f64,
    label: String,
    repeat: bool,
}

fn key(kind: &str, name: &str) -> String {
    format!("{kind}/{name}")
}

fn storage_failed(error: std::io::Error) -> Response {
    Response::error(503, &format!("storage failed: {error}"))
}

fn link_to(account: &Account, since: u64) -> Link {
    Link {
        id: account.id.clone(),
        name: account.name.clone(),
        full_name: account.full_name.clone(),
        since,
    }
}

/// Great-circle distance between two points, in metres.
pub fn metres_between(a: (f64, f64), b: (f64, f64)) -> f64 {
    const EARTH_M: f64 = 6_371_000.0;
    let (lat_a, lat_b) = (a.0.to_radians(), b.0.to_radians());
    let (d_lat, d_lon) = ((b.0 - a.0).to_radians(), (b.1 - a.1).to_radians());
    let h = (d_lat / 2.0).sin().powi(2) + lat_a.cos() * lat_b.cos() * (d_lon / 2.0).sin().powi(2);
    2.0 * EARTH_M * h.sqrt().min(1.0).asin()
}

/// What a new position means for a rule that last stood at `inside`: whether
/// it fires, given whether the position is within the radius. A rule's first
/// position only sets where it stands, so nobody is told of a crossing nobody
/// saw.
fn fires(kind: RuleKind, inside: Option<bool>, now_inside: bool) -> bool {
    match (kind, inside) {
        (RuleKind::Arrive, Some(false)) => now_inside,
        (RuleKind::Leave, Some(true)) => !now_inside,
        _ => false,
    }
}

async fn links(space: &mut Space<'_>, kind: &str) -> Result<Vec<Link>, Response> {
    let prefix = format!("{kind}/");
    let listed = space
        .list(&prefix, MAX_PEOPLE + 1)
        .await
        .map_err(storage_failed)?;
    Ok(listed
        .into_iter()
        .filter_map(|(key, bytes)| match serde_json::from_slice(&bytes) {
            Ok(link) => Some(link),
            Err(error) => {
                ferrite_app::tracing::warn!(%key, %error, "a stored link could not be read");
                None
            }
        })
        .collect())
}

/// The newest position of a person's devices.
async fn newest(cx: &mut ApiCtx<'_>, principal: &str) -> Result<Option<Device>, Response> {
    let mut theirs = Storage::new(cx.storage.store(), MODULE.name, principal);
    let listed = theirs
        .user()
        .list("devices/", LIST_CAP)
        .await
        .map_err(storage_failed)?;
    Ok(listed
        .iter()
        .filter_map(|(key, bytes)| stored_device(bytes, key).ok())
        .max_by_key(|device| device.at))
}

/// Whether `sharer` still grants its position to the account `me`.
async fn still_shares(cx: &mut ApiCtx<'_>, sharer: &Link, me: &Account) -> Result<bool, Response> {
    let mut theirs = Storage::new(cx.storage.store(), MODULE.name, &sharer.id);
    let grant = theirs
        .user()
        .get_json::<Link>(&key("sharing", &me.name))
        .await
        .map_err(storage_failed)?;
    Ok(grant.is_some_and(|grant| grant.id == me.id))
}

#[derive(Default)]
struct Person {
    full_name: String,
    sharing: bool,
    following: bool,
    position: Option<Device>,
    asked: bool,
    asks_me: bool,
    rule: Option<Rule>,
    tell: Option<Rule>,
}

/// A rule as `GET /people` shows it.
fn rule_view(rule: Rule) -> Value {
    serde_json::json!({
        "kind": rule.kind,
        "label": rule.label,
        "repeat": rule.repeat,
    })
}

async fn list(cx: &mut ApiCtx<'_>, me: &Account) -> Result<Response, Response> {
    let (sharing, following, asked, asks_me) = {
        let mut space = cx.storage.user();
        (
            links(&mut space, "sharing").await?,
            links(&mut space, "following").await?,
            links(&mut space, "asked").await?,
            links(&mut space, "asks").await?,
        )
    };
    let mut people = std::collections::BTreeMap::<String, Person>::new();
    for link in &sharing {
        let person = people.entry(link.name.clone()).or_default();
        person.full_name.clone_from(&link.full_name);
        person.sharing = true;
        person.tell = cx
            .storage
            .user()
            .get_json::<Rule>(&key("tell", &link.name))
            .await
            .map_err(storage_failed)?;
    }
    for link in &following {
        if !still_shares(cx, link, me).await? {
            continue;
        }
        let position = newest(cx, &link.id).await?;
        let rule = cx
            .storage
            .user()
            .get_json::<Rule>(&key("notify", &link.name))
            .await
            .map_err(storage_failed)?;
        let person = people.entry(link.name.clone()).or_default();
        person.full_name.clone_from(&link.full_name);
        person.following = true;
        person.position = position;
        person.rule = rule;
    }
    for link in &asked {
        let person = people.entry(link.name.clone()).or_default();
        person.full_name.clone_from(&link.full_name);
        // A wish that has come true is no longer a wish.
        person.asked = !person.following;
    }
    for link in &asks_me {
        let person = people.entry(link.name.clone()).or_default();
        person.full_name.clone_from(&link.full_name);
        person.asks_me = !person.sharing;
    }
    let people: Vec<Value> = people
        .into_iter()
        .filter(|(_, person)| person.sharing || person.following || person.asked || person.asks_me)
        .map(|(name, person)| {
            serde_json::json!({
                "name": name,
                "full_name": person.full_name,
                "sharing": person.sharing,
                "following": person.following,
                "position": person.position.map(|device| serde_json::json!({
                    "lat": device.lat,
                    "lon": device.lon,
                    "accuracy_m": device.accuracy_m,
                    "at": device.at,
                })),
                "asked": person.asked,
                "asks_me": person.asks_me,
                "rule": person.rule.map(rule_view),
                "tell": person.tell.map(rule_view),
            })
        })
        .collect();
    Ok(Response::json(
        200,
        &serde_json::json!({ "people": people, "signed_in": true }),
    ))
}

async fn find(cx: &mut ApiCtx<'_>, name: &str, me: &Account) -> Result<Account, Response> {
    let found = crate::accounts::lookup(cx.storage.store(), name)
        .await
        .map_err(storage_failed)?
        .ok_or_else(|| Response::error(404, "no account of this desktop has that name"))?;
    if found.id == me.id {
        return Err(Response::error(
            400,
            "your own devices are under Devices: choose someone else",
        ));
    }
    Ok(found)
}

async fn tell(cx: &mut ApiCtx<'_>, to: &str, now_ms: u64, note: Notification) {
    if let Err(error) = notification_center::notify(cx.storage.store(), to, now_ms, &note).await {
        ferrite_app::tracing::warn!(%error, "a Find My notification was not delivered");
    }
}

/// A write into someone else's Find My space.
async fn put_link(
    cx: &mut ApiCtx<'_>,
    principal: &str,
    kind: &str,
    link: &Link,
) -> Result<(), Response> {
    let mut theirs = Storage::new(cx.storage.store(), MODULE.name, principal);
    theirs
        .user()
        .put_json(&key(kind, &link.name), link)
        .await
        .map_err(storage_failed)
}

async fn delete_key(
    cx: &mut ApiCtx<'_>,
    principal: &str,
    kind: &str,
    name: &str,
) -> Result<(), Response> {
    let mut theirs = Storage::new(cx.storage.store(), MODULE.name, principal);
    theirs
        .user()
        .delete(&key(kind, name))
        .await
        .map_err(storage_failed)
}

async fn is_blocked_by(cx: &mut ApiCtx<'_>, other: &Account, me: &Account, now_ms: u64) -> bool {
    // Someone whose blocks cannot be read is told nothing either.
    !matches!(
        blocked::hides_from(cx, &other.id, &me.name, now_ms).await,
        Ok(false)
    )
}

async fn share(cx: &mut ApiCtx<'_>, me: &Account, name: &str) -> Result<Response, Response> {
    let now_ms = cx.now_ms;
    let friend = find(cx, name, me).await?;
    let mut space = cx.storage.user();
    let own_key = key("sharing", &friend.name);
    let kept = space
        .get_json::<Link>(&own_key)
        .await
        .map_err(storage_failed)?
        .filter(|link| link.id == friend.id);
    if kept.is_none() && links(&mut space, "sharing").await?.len() >= MAX_PEOPLE {
        return Err(Response::error(
            409,
            &format!("you share with {MAX_PEOPLE} people, the most you can"),
        ));
    }
    let is_new = kept.is_none();
    let since = kept.map_or(now_ms, |link| link.since);
    space
        .put_json(&own_key, &link_to(&friend, since))
        .await
        .map_err(storage_failed)?;
    delete_key(cx, &me.id, "asks", &friend.name).await?;
    let answer = serde_json::json!({ "name": friend.name, "sharing": true });
    if is_blocked_by(cx, &friend, me, now_ms).await {
        return Ok(Response::json(200, &answer));
    }
    put_link(cx, &friend.id, "following", &link_to(me, since)).await?;
    delete_key(cx, &friend.id, "asked", &me.name).await?;
    if is_new {
        let note = Notification {
            app: MODULE.name.into(),
            id: format!("share-{}-{since}", me.name),
            title: format!("{} started sharing location with you", me.full_name),
            subtitle: None,
            body: Some("Open Find My to see where they are.".into()),
            alert: false,
            dismiss: None,
            actions: Vec::new(),
        };
        tell(cx, &friend.id, now_ms, note).await;
    }
    Ok(Response::json(200, &answer))
}

async fn stop_sharing(cx: &mut ApiCtx<'_>, me: &Account, name: &str) -> Result<(), Response> {
    let own_key = key("sharing", name);
    let mut space = cx.storage.user();
    let kept = space
        .get_json::<Link>(&own_key)
        .await
        .map_err(storage_failed)?;
    space.delete(&own_key).await.map_err(storage_failed)?;
    space
        .delete(&key("tell", name))
        .await
        .map_err(storage_failed)?;
    if let Some(link) = kept {
        delete_key(cx, &link.id, "following", &me.name).await?;
    }
    Ok(())
}

async fn ask(cx: &mut ApiCtx<'_>, me: &Account, name: &str) -> Result<Response, Response> {
    let now_ms = cx.now_ms;
    let friend = find(cx, name, me).await?;
    let mut space = cx.storage.user();
    let own_key = key("asked", &friend.name);
    let is_new = space
        .get_json::<Link>(&own_key)
        .await
        .map_err(storage_failed)?
        .is_none();
    if is_new && links(&mut space, "asked").await?.len() >= MAX_PEOPLE {
        return Err(Response::error(
            409,
            &format!("you have asked {MAX_PEOPLE} people, the most you can"),
        ));
    }
    space
        .put_json(&own_key, &link_to(&friend, now_ms))
        .await
        .map_err(storage_failed)?;
    let answer = serde_json::json!({ "name": friend.name, "asked": true });
    if !is_new || is_blocked_by(cx, &friend, me, now_ms).await {
        return Ok(Response::json(200, &answer));
    }
    put_link(cx, &friend.id, "asks", &link_to(me, now_ms)).await?;
    let note = Notification {
        app: MODULE.name.into(),
        id: format!("ask-{}-{now_ms}", me.name),
        title: format!("{} asked to follow your location", me.full_name),
        subtitle: None,
        body: Some("Open Find My to share your location or say no.".into()),
        alert: false,
        dismiss: None,
        actions: Vec::new(),
    };
    tell(cx, &friend.id, now_ms, note).await;
    Ok(Response::json(200, &answer))
}

/// Say no to someone's request; or, for one's own request, take it back.
async fn decline(cx: &mut ApiCtx<'_>, me: &Account, name: &str) -> Result<(), Response> {
    let mut space = cx.storage.user();
    let theirs = space
        .get_json::<Link>(&key("asks", name))
        .await
        .map_err(storage_failed)?;
    let mine = space
        .get_json::<Link>(&key("asked", name))
        .await
        .map_err(storage_failed)?;
    space
        .delete(&key("asks", name))
        .await
        .map_err(storage_failed)?;
    space
        .delete(&key("asked", name))
        .await
        .map_err(storage_failed)?;
    if let Some(link) = theirs {
        delete_key(cx, &link.id, "asked", &me.name).await?;
    }
    if let Some(link) = mine {
        delete_key(cx, &link.id, "asks", &me.name).await?;
    }
    Ok(())
}

async fn set_rule(cx: &mut ApiCtx<'_>, me: &Account, name: &str) -> Result<Response, Response> {
    let request = rule_request(cx)?;
    let label = request.label.trim();
    let following = cx
        .storage
        .user()
        .get_json::<Link>(&key("following", name))
        .await
        .map_err(storage_failed)?;
    let sharer = match following {
        Some(link) if still_shares(cx, &link, me).await? => link,
        _ => {
            return Err(Response::error(
                409,
                "this person is not sharing their location with you",
            ))
        }
    };
    let inside = newest(cx, &sharer.id).await?.map(|device| {
        metres_between((device.lat, device.lon), (request.lat, request.lon)) <= RULE_RADIUS_M
    });
    let rule = Rule {
        kind: request.kind,
        lat: request.lat,
        lon: request.lon,
        label: label.to_string(),
        repeat: request.repeat,
        inside,
    };
    cx.storage
        .user()
        .put_json(&key("notify", &sharer.name), &rule)
        .await
        .map_err(storage_failed)?;
    Ok(Response::json(
        200,
        &serde_json::json!({ "name": sharer.name, "rule": rule.kind }),
    ))
}

/// A rule's body, read and checked.
fn rule_request(cx: &ApiCtx<'_>) -> Result<RuleRequest, Response> {
    let request: RuleRequest = cx.request.json()?;
    let on_globe = (-90.0..=90.0).contains(&request.lat) && (-180.0..=180.0).contains(&request.lon);
    if !on_globe {
        return Err(Response::error(
            400,
            "lat and lon must be a point on the globe",
        ));
    }
    let label = request.label.trim();
    let label_chars = label.chars().count();
    if !(1..=MAX_PLACE_CHARS).contains(&label_chars) || label.chars().any(char::is_control) {
        return Err(Response::error(
            400,
            &format!("a place's name has 1 to {MAX_PLACE_CHARS} characters"),
        ));
    }
    Ok(request)
}

/// Tell `name`, who I share with, when I arrive at a point or leave it.
async fn set_tell(cx: &mut ApiCtx<'_>, me: &Account, name: &str) -> Result<Response, Response> {
    let request = rule_request(cx)?;
    let sharing = cx
        .storage
        .user()
        .get_json::<Link>(&key("sharing", name))
        .await
        .map_err(storage_failed)?;
    let Some(friend) = sharing else {
        return Err(Response::error(
            409,
            "you are not sharing your location with this person",
        ));
    };
    let inside = newest(cx, &me.id).await?.map(|device| {
        metres_between((device.lat, device.lon), (request.lat, request.lon)) <= RULE_RADIUS_M
    });
    let rule = Rule {
        kind: request.kind,
        lat: request.lat,
        lon: request.lon,
        label: request.label.trim().to_string(),
        repeat: request.repeat,
        inside,
    };
    cx.storage
        .user()
        .put_json(&key("tell", &friend.name), &rule)
        .await
        .map_err(storage_failed)?;
    Ok(Response::json(
        200,
        &serde_json::json!({ "name": friend.name, "tell": rule.kind }),
    ))
}

/// Hold a position against the rule at `rule_key` and keep where it now
/// stands: the rule, if it fired. One that fires once is gone after.
async fn advance(space: &mut Space<'_>, rule_key: &str, device: &Device) -> Option<Rule> {
    let rule = match space.get_json::<Rule>(rule_key).await {
        Ok(Some(rule)) => rule,
        Ok(None) => return None,
        Err(error) => {
            ferrite_app::tracing::warn!(%error, "a Find My rule could not be read");
            return None;
        }
    };
    let now_inside =
        metres_between((device.lat, device.lon), (rule.lat, rule.lon)) <= RULE_RADIUS_M;
    if rule.inside == Some(now_inside) {
        return None;
    }
    let fired = fires(rule.kind, rule.inside, now_inside);
    let kept = if fired && !rule.repeat {
        space.delete(rule_key).await
    } else {
        let mut next = rule.clone();
        next.inside = Some(now_inside);
        space.put_json(rule_key, &next).await
    };
    if let Err(error) = kept {
        ferrite_app::tracing::warn!(%error, "a Find My rule could not be kept");
        return None;
    }
    fired.then_some(rule)
}

/// The notification of a rule that fired on `me`'s position.
fn fired_note(me: &Account, rule: &Rule, id: String) -> Notification {
    let verb = match rule.kind {
        RuleKind::Arrive => "arrived at",
        RuleKind::Leave => "left",
    };
    Notification {
        app: MODULE.name.into(),
        id,
        title: format!("{} {verb} {}", me.full_name, rule.label),
        subtitle: None,
        body: None,
        alert: false,
        dismiss: None,
        actions: Vec::new(),
    }
}

/// Hold a new position of the person `me` against the rules of those they
/// share with. A failure is logged, not answered: the report itself was stored.
pub async fn reported(cx: &mut ApiCtx<'_>, device: &Device) {
    let Some(me) = cx.session.account.clone() else {
        return;
    };
    if me.guest {
        return;
    }
    let now_ms = cx.now_ms;
    let sharing = match links(&mut cx.storage.user(), "sharing").await {
        Ok(sharing) => sharing,
        Err(_) => return,
    };
    for link in sharing {
        let told = advance(&mut cx.storage.user(), &key("tell", &link.name), device).await;
        if let Some(rule) = told {
            let id = format!("tell-{}-{}", me.name, device.reported_at);
            tell(cx, &link.id, now_ms, fired_note(&me, &rule, id)).await;
        }
        let rule_key = key("notify", &me.name);
        let fired = {
            let mut theirs = Storage::new(cx.storage.store(), MODULE.name, &link.id);
            let mut space = theirs.user();
            advance(&mut space, &rule_key, device).await
        };
        if let Some(rule) = fired {
            let id = format!("rule-{}-{}", me.name, device.reported_at);
            tell(cx, &link.id, now_ms, fired_note(&me, &rule, id)).await;
        }
    }
}

async fn forget(cx: &mut ApiCtx<'_>, me: &Account, name: &str) -> Result<(), Response> {
    stop_sharing(cx, me, name).await?;
    decline(cx, me, name).await?;
    let mut space = cx.storage.user();
    space
        .delete(&key("following", name))
        .await
        .map_err(storage_failed)?;
    space
        .delete(&key("notify", name))
        .await
        .map_err(storage_failed)
}

async fn answer(
    cx: &mut ApiCtx<'_>,
    me: &Account,
    method: &str,
    path: &str,
) -> Result<Response, Response> {
    let done = || Response::json(200, &serde_json::json!({ "done": true }));
    let Some(rest) = path.strip_prefix("/people") else {
        return Ok(Response::not_found());
    };
    let rest = rest.trim_matches('/');
    if rest.is_empty() {
        return match method {
            "GET" => list(cx, me).await,
            _ => Ok(Response::method_not_allowed()),
        };
    }
    let (raw, action) = rest.split_once('/').unwrap_or((rest, ""));
    let Some(name) = crate::accounts::account_name(raw) else {
        return Ok(Response::error(
            404,
            "no account of this desktop has that name",
        ));
    };
    match (method, action) {
        ("PUT", "share") => share(cx, me, &name).await,
        ("DELETE", "share") => {
            stop_sharing(cx, me, &name).await?;
            Ok(done())
        }
        ("PUT", "ask") => ask(cx, me, &name).await,
        ("DELETE", "ask") => {
            decline(cx, me, &name).await?;
            Ok(done())
        }
        ("PUT", "notify") => set_rule(cx, me, &name).await,
        ("DELETE", "notify") => {
            cx.storage
                .user()
                .delete(&key("notify", &name))
                .await
                .map_err(storage_failed)?;
            Ok(done())
        }
        ("PUT", "tell") => set_tell(cx, me, &name).await,
        ("DELETE", "tell") => {
            cx.storage
                .user()
                .delete(&key("tell", &name))
                .await
                .map_err(storage_failed)?;
            Ok(done())
        }
        ("DELETE", "") => {
            forget(cx, me, &name).await?;
            Ok(done())
        }
        (_, "" | "share" | "ask" | "notify" | "tell") => Ok(Response::method_not_allowed()),
        _ => Ok(Response::not_found()),
    }
}

/// Route a request under `/api/find-my/people`.
pub async fn route(cx: &mut ApiCtx<'_>) -> Response {
    let method = cx.request.method;
    let path = cx.request.path;
    let Some(me) = cx.session.account.clone().filter(|me| !me.guest) else {
        return if method == "GET" && path.trim_end_matches('/') == "/people" {
            Response::json(
                200,
                &serde_json::json!({ "people": [], "signed_in": false }),
            )
        } else {
            Response::error(401, "sign in to an account to share your location")
        };
    };
    match answer(cx, &me, method, path).await {
        Ok(response) | Err(response) => response,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_rule_fires_only_on_a_crossing_it_saw() {
        assert!(fires(RuleKind::Arrive, Some(false), true));
        assert!(!fires(RuleKind::Arrive, Some(false), false));
        assert!(!fires(RuleKind::Arrive, None, true));
        assert!(!fires(RuleKind::Arrive, Some(true), true));
        assert!(fires(RuleKind::Leave, Some(true), false));
        assert!(!fires(RuleKind::Leave, None, false));
        assert!(!fires(RuleKind::Leave, Some(false), true));
    }

    #[test]
    fn distance_is_in_metres() {
        let paris = (48.8566, 2.3522);
        let london = (51.5074, -0.1278);
        let apart = metres_between(paris, london);
        assert!((343_000.0..345_000.0).contains(&apart), "{apart}");
        assert_eq!(metres_between(paris, paris), 0.0);
    }
}

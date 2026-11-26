//! Home's server half: a session's homes, with their rooms, accessories and
//! scenes.
//!
//! The accessories are simulated: nothing here talks to HomeKit or to any
//! device. A switch, a scene or an accessory added in the window changes the
//! stored document and nothing else. When the desktop is served by this app
//! the Home window loads the homes from here when it opens and saves them
//! after every change.
//!
//! * `GET /api/home/homes`: `{"homes": [...], "rev": n, "session": id}`, or
//!   `{"homes": null, ...}` before the session has saved (the window then
//!   shows one empty home).
//! * `PUT /api/home/homes` with `{"homes": [...], "rev": n}`, `n` the
//!   revision the page last had: replaces the homes, or 409 with the current
//!   ones (`document.rs`).
//! * `DELETE /api/home/homes`: forgets them.
//!
//! A home is `{id, name, rooms, accessories, scenes}` in the shape of
//! `demos/home/home-data.ts`, with its optional `automations` and
//! `wallpaper`. Ids are unique across every home; an accessory's room is one
//! of its home's rooms, a scene sets only accessories of its own home, and an
//! automation runs a scene of its own home. Nothing here runs an automation:
//! the Home window does, while it is open, on the same stored document.

use std::collections::{BTreeMap, BTreeSet};

use ferrite_app::{serde, serde_json};

use super::document;
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};

pub const MODULE: AppModule = AppModule {
    name: "home",
    title: "Home",
    handle,
};

/// The most homes a session keeps.
pub const MAX_HOMES: usize = 10;
/// The most rooms in one home.
pub const MAX_ROOMS: usize = 50;
/// The most accessories in one home.
pub const MAX_ACCESSORIES: usize = 200;
/// The most scenes in one home.
pub const MAX_SCENES: usize = 100;
/// The most automations in one home.
pub const MAX_AUTOMATIONS: usize = 100;
/// The longest name of a home, a room, an accessory or a scene, and the
/// longest sensor detail.
const MAX_NAME_CHARS: usize = 100;
const KEY: &str = "homes";

/// The kinds of accessory the window draws (`HomeAccessoryKind`).
const KINDS: &[&str] = &[
    "light",
    "lamp",
    "outlet",
    "tv",
    "speaker",
    "garage-door",
    "blinds",
    "sensor",
];
/// The glyphs a scene may show.
const SCENE_ICONS: &[&str] = &["house", "house-person"];
/// The pictures a home may stand on (`WALLPAPERS`).
const WALLPAPERS: &[&str] = &["lagoon", "dusk", "forest"];

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Accessory {
    pub id: String,
    pub room: String,
    pub name: String,
    pub kind: String,
    pub on: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub favorite: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub brightness: Option<u8>,
    /// A light's colour, `#rrggbb`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    /// How far open blinds are, in percent.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub position: Option<u8>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub humidity: Option<u8>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub muted: Option<bool>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Scene {
    pub id: String,
    pub name: String,
    pub icon: String,
    /// The state the scene puts each accessory in, by accessory id.
    pub sets: BTreeMap<String, bool>,
}

/// What sets an automation off.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", tag = "kind", rename_all = "lowercase")]
pub enum Trigger {
    /// A time of day, `HH:MM`.
    Time { at: String },
    /// An accessory of the home turning on or off.
    Accessory { accessory: String, on: bool },
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(
    crate = "ferrite_app::serde",
    deny_unknown_fields,
    rename_all = "camelCase"
)]
pub struct Automation {
    pub id: String,
    pub name: String,
    pub trigger: Trigger,
    pub scene: String,
    pub enabled: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_run: Option<u64>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct HomeDefinition {
    pub id: String,
    pub name: String,
    pub rooms: Vec<String>,
    pub accessories: Vec<Accessory>,
    pub scenes: Vec<Scene>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub automations: Vec<Automation>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wallpaper: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Body {
    homes: Vec<HomeDefinition>,
    rev: u64,
    #[serde(default)]
    session: Option<String>,
}

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    let session = cx.session;
    let outcome = match (cx.request.method, cx.request.path) {
        ("GET", "/homes") => document::read(&mut cx.storage.user(), KEY)
            .await
            .map(|current| {
                document::for_session(reply(current.doc.as_ref(), current.rev), session)
            }),
        ("PUT", "/homes") => match cx.request.json::<Body>().map(|body| {
            let named = body.session;
            validate(&body.homes).map(|()| (body.homes, body.rev, named))
        }) {
            Err(response) => Ok(response),
            Ok(Err(message)) => Ok(Response::error(400, &message)),
            Ok(Ok((homes, base, named))) => {
                match document::other_session(named.as_deref(), session) {
                    Some(refused) => Ok(refused),
                    None => document::write(&mut cx.storage.user(), KEY, Some(base), Some(&homes))
                        .await
                        .map(|saved| document::answer(saved, Some(&homes), reply)),
                }
            }
        },
        ("DELETE", "/homes") => {
            document::write::<Vec<HomeDefinition>>(&mut cx.storage.user(), KEY, None, None)
                .await
                .map(|saved| document::answer(saved, None, reply))
        }
        (_, "/homes") => Ok(Response::method_not_allowed()),
        _ => Ok(Response::not_found()),
    };
    outcome.unwrap_or_else(|error| Response::error(503, &format!("storage failed: {error}")))
}

/// What a `GET` answers.
fn reply(homes: Option<&Vec<HomeDefinition>>, rev: u64) -> serde_json::Value {
    serde_json::json!({ "homes": homes, "rev": rev })
}

/// A name of 1 to [`MAX_NAME_CHARS`] characters that is not only spaces.
fn name(what: &str, value: &str) -> Result<(), String> {
    let length = value.chars().count();
    if value.trim().is_empty() || length > MAX_NAME_CHARS {
        return Err(format!("{what} has 1 to {MAX_NAME_CHARS} characters"));
    }
    Ok(())
}

/// An id unique among every id seen so far.
fn unique_id<'a>(what: &str, id: &'a str, seen: &mut BTreeSet<&'a str>) -> Result<(), String> {
    if !document::valid_key(id) {
        return Err(format!("{what} id {id:?} is not a plain id"));
    }
    if !seen.insert(id) {
        return Err(format!("{what} id {id:?} is listed twice"));
    }
    Ok(())
}

/// A time of day as `HH:MM`, on a 24-hour clock.
fn valid_time(at: &str) -> bool {
    let Some((hours, minutes)) = at.split_once(':') else {
        return false;
    };
    let two = |part: &str, below: u8| {
        part.len() == 2
            && part.bytes().all(|b| b.is_ascii_digit())
            && part.parse::<u8>().is_ok_and(|n| n < below)
    };
    two(hours, 24) && two(minutes, 60)
}

/// A colour as `#rrggbb`.
fn valid_color(text: &str) -> bool {
    text.len() == 7 && text.starts_with('#') && text.bytes().skip(1).all(|b| b.is_ascii_hexdigit())
}

/// Check a home's automations against what the home holds.
fn validate_automations<'a>(
    home: &'a HomeDefinition,
    accessories: &BTreeSet<&str>,
    seen: &mut BTreeSet<&'a str>,
) -> Result<(), String> {
    if home.automations.len() > MAX_AUTOMATIONS {
        return Err(format!("a home has at most {MAX_AUTOMATIONS} automations"));
    }
    for automation in &home.automations {
        unique_id("automation", &automation.id, seen)?;
        name("an automation's name", &automation.name)?;
        if !home.scenes.iter().any(|s| s.id == automation.scene) {
            return Err(format!(
                "automation {:?} runs {:?}, which is not a scene of its home",
                automation.id, automation.scene
            ));
        }
        match &automation.trigger {
            Trigger::Time { at } if !valid_time(at) => {
                return Err(format!("{at:?} is not a time of day"));
            }
            Trigger::Accessory { accessory, .. } if !accessories.contains(accessory.as_str()) => {
                return Err(format!(
                    "automation {:?} watches {accessory:?}, which is not an accessory of its home",
                    automation.id
                ));
            }
            _ => {}
        }
    }
    Ok(())
}

/// Check submitted homes.
fn validate(homes: &[HomeDefinition]) -> Result<(), String> {
    if homes.len() > MAX_HOMES {
        return Err(format!("at most {MAX_HOMES} homes"));
    }
    let (mut home_ids, mut accessory_ids, mut scene_ids, mut automation_ids) = (
        BTreeSet::new(),
        BTreeSet::new(),
        BTreeSet::new(),
        BTreeSet::new(),
    );
    for home in homes {
        unique_id("home", &home.id, &mut home_ids)?;
        name("a home's name", &home.name)?;
        if home.rooms.len() > MAX_ROOMS {
            return Err(format!("a home has at most {MAX_ROOMS} rooms"));
        }
        let mut rooms = BTreeSet::new();
        for room in &home.rooms {
            name("a room's name", room)?;
            if !rooms.insert(room.as_str()) {
                return Err(format!("room {room:?} is listed twice"));
            }
        }
        if home.accessories.len() > MAX_ACCESSORIES {
            return Err(format!("a home has at most {MAX_ACCESSORIES} accessories"));
        }
        let mut own = BTreeSet::new();
        for accessory in &home.accessories {
            unique_id("accessory", &accessory.id, &mut accessory_ids)?;
            own.insert(accessory.id.as_str());
            name("an accessory's name", &accessory.name)?;
            if !rooms.contains(accessory.room.as_str()) {
                return Err(format!(
                    "accessory {:?} is in {:?}, which is not a room of its home",
                    accessory.id, accessory.room
                ));
            }
            if !KINDS.contains(&accessory.kind.as_str()) {
                return Err(format!("{:?} is not a kind of accessory", accessory.kind));
            }
            if accessory.brightness.is_some_and(|b| b > 100)
                || accessory.humidity.is_some_and(|h| h > 100)
                || accessory.position.is_some_and(|p| p > 100)
            {
                return Err("brightness, humidity and position are percentages".into());
            }
            if accessory.color.as_deref().is_some_and(|c| !valid_color(c)) {
                return Err("a colour is #rrggbb".into());
            }
            if accessory
                .detail
                .as_ref()
                .is_some_and(|d| d.chars().count() > MAX_NAME_CHARS)
            {
                return Err(format!("a detail has at most {MAX_NAME_CHARS} characters"));
            }
        }
        if home.scenes.len() > MAX_SCENES {
            return Err(format!("a home has at most {MAX_SCENES} scenes"));
        }
        for scene in &home.scenes {
            unique_id("scene", &scene.id, &mut scene_ids)?;
            name("a scene's name", &scene.name)?;
            if !SCENE_ICONS.contains(&scene.icon.as_str()) {
                return Err(format!("{:?} is not a scene's glyph", scene.icon));
            }
            if let Some(stranger) = scene.sets.keys().find(|id| !own.contains(id.as_str())) {
                return Err(format!(
                    "scene {:?} sets {stranger:?}, which is not an accessory of its home",
                    scene.id
                ));
            }
        }
        if home
            .wallpaper
            .as_deref()
            .is_some_and(|w| !WALLPAPERS.contains(&w))
        {
            return Err("that is not one of the wallpapers".into());
        }
        validate_automations(home, &own, &mut automation_ids)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Vec<HomeDefinition> {
        serde_json::from_str(
            r#"[{"id":"home","name":"Home","rooms":["Den","Studio"],
                "accessories":[
                  {"id":"den-light","room":"Den","name":"Light","kind":"light","on":false,"favorite":true},
                  {"id":"studio-work","room":"Studio","name":"Work","kind":"lamp","on":true,"brightness":100},
                  {"id":"studio-humidity","room":"Studio","name":"Humidity Sensor","kind":"sensor","on":false,"detail":"4 Sensors","humidity":47},
                  {"id":"studio-homepod","room":"Studio","name":"HomePod","kind":"speaker","on":false,"muted":true}],
                "scenes":[{"id":"studio-on","name":"Studio On","icon":"house-person","sets":{"studio-work":true}}]}]"#,
        )
        .unwrap()
    }

    #[test]
    fn a_home_round_trips_in_the_demo_s_shape() {
        let homes = sample();
        assert!(validate(&homes).is_ok());
        let text = serde_json::to_string(&homes).unwrap();
        assert!(text.contains(r#""brightness":100"#) && !text.contains("null"));
        assert_eq!(
            serde_json::from_str::<Vec<HomeDefinition>>(&text).unwrap(),
            homes
        );
    }

    #[test]
    fn automations_stay_within_their_home() {
        let with = |trigger: serde_json::Value, scene: &str| {
            let mut homes = sample();
            homes[0].automations = vec![serde_json::from_value(serde_json::json!({
                "id": "a", "name": "A", "trigger": trigger, "scene": scene,
                "enabled": true, "lastRun": 5,
            }))
            .unwrap()];
            homes
        };
        let at = serde_json::json!({ "kind": "time", "at": "07:30" });
        let good = with(at.clone(), "studio-on");
        assert!(validate(&good).is_ok());
        let text = serde_json::to_string(&good).unwrap();
        assert!(
            text.contains(r#""trigger":{"kind":"time","at":"07:30"}"#)
                && text.contains(r#""lastRun":5"#),
            "{text}"
        );
        assert!(
            validate(&with(at, "elsewhere")).is_err(),
            "a stranger scene"
        );
        for bad in ["24:00", "7:30", "07:60", ""] {
            let time = serde_json::json!({ "kind": "time", "at": bad });
            assert!(validate(&with(time, "studio-on")).is_err(), "{bad:?}");
        }
        let stranger = serde_json::json!({ "kind": "accessory", "accessory": "x", "on": true });
        assert!(validate(&with(stranger, "studio-on")).is_err());
        let own = serde_json::json!({ "kind": "accessory", "accessory": "den-light", "on": false });
        assert!(validate(&with(own, "studio-on")).is_ok());
        let mut paper = sample();
        paper[0].wallpaper = Some("plaid".into());
        assert!(validate(&paper).is_err(), "an unknown wallpaper");
        paper[0].wallpaper = Some("dusk".into());
        assert!(validate(&paper).is_ok());
    }

    #[test]
    fn bad_homes_are_refused() {
        let mut twice = sample();
        twice.push(twice[0].clone());
        assert!(validate(&twice).is_err(), "the same home twice");

        let mut stray = sample();
        stray[0].accessories[0].room = "Garage".into();
        assert!(validate(&stray).is_err(), "a room the home lacks");

        let mut kind = sample();
        kind[0].accessories[0].kind = "toaster".into();
        assert!(validate(&kind).is_err(), "an unknown kind");

        let mut bright = sample();
        bright[0].accessories[1].brightness = Some(101);
        assert!(validate(&bright).is_err(), "brightness over 100");

        let mut scene = sample();
        scene[0].scenes[0].sets.insert("elsewhere".into(), true);
        assert!(validate(&scene).is_err(), "a scene setting a stranger");

        let mut unnamed = sample();
        unnamed[0].rooms[0] = "  ".into();
        assert!(validate(&unnamed).is_err(), "a blank room");

        let many: Vec<_> = (0..=MAX_HOMES)
            .map(|n| HomeDefinition {
                id: format!("h{n}"),
                name: "Home".into(),
                rooms: vec![],
                accessories: vec![],
                scenes: vec![],
                automations: vec![],
                wallpaper: None,
            })
            .collect();
        assert!(validate(&many).is_err(), "too many homes");
        assert!(
            serde_json::from_str::<Accessory>(
                r#"{"id":"a","room":"Den","name":"A","kind":"light","on":true,"colour":"red"}"#
            )
            .is_err(),
            "unknown fields are refused"
        );
    }
}

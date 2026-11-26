//! System Preferences' server half: a session's settings and theme.
//!
//! When the desktop is served by this app, the System Preferences demo loads
//! its settings from here when it opens and saves them after every change.
//! The desktop reads the theme when it starts, so a chosen appearance and
//! accent colour survive a reload before System Preferences is opened again.
//!
//! * `GET /api/system-preferences/settings`:
//!   `{"values": {"dock.size": 0.4, ...}, "theme": {"appearance": "dark",
//!   "accent": "blue", "highlight": "blue"}, "rev": n}`, or both halves
//!   `null` before the session has saved.
//! * `PUT /api/system-preferences/settings` with the same shape, `n` the
//!   revision the page last had: replaces both halves (a `null` half is
//!   stored as `null`) and answers them with the new revision, or, when `n`
//!   is not the stored revision, changes nothing and answers 409 with the
//!   current settings and revision (`document.rs`).
//! * `DELETE /api/system-preferences/settings`: forgets both, under a new
//!   revision.
//!
//! `values` holds the panes' settings by key (`<pane>.<name>`, the keys of
//! the demo's `usePreference`), each any JSON value of at most
//! [`MAX_VALUE_BYTES`]. `theme.appearance` is `light`, `dark` or `auto`;
//! `accent` and `highlight` are one of the eight accent names, or `null` for
//! a custom colour. Storage: the whole document under one key, `settings`, in
//! the session's own space (`document.rs`), so the values and the theme are
//! always read and replaced together.
//!
//! The same values hold the person's own desktop (`demos/desktop/
//! desktop-personal.ts`), and those keys must have their shape:
//!
//! * `dock.size` and `dock.magnificationSize`: a number from 0 to 100 (the
//!   Dock pane's sliders); `dock.magnification` and `dock.autohide`: true or
//!   false; `dock.position`: `left`, `bottom` or `right`;
//! * `dock.order` (the Dock's apps in the person's order) and `dock.removed`
//!   (the apps taken out of it): lists of app ids, without repeats;
//! * `desktop-and-screen-saver.picture`: one of the pane's pictures,
//!   `photos` (the photo Photos keeps as the desktop picture) or
//!   `drive:<file id>` (a picture of the person's drive), and
//!   `desktop-and-screen-saver.mode`: `dynamic`, `light` or `dark`.
//!
//! Since accounts landed, a session's own space is its account's
//! (`Storage::user`), so all of it is kept per person.

use std::collections::BTreeMap;

use ferrite_app::{serde, serde_json};

use super::document;
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};

pub const MODULE: AppModule = AppModule {
    name: "system-preferences",
    title: "System Preferences",
    handle,
};

/// The most settings a session keeps.
pub const MAX_VALUES: usize = 500;
/// The largest single setting, as JSON.
pub const MAX_VALUE_BYTES: usize = 4096;
const ACCENTS: &[&str] = &[
    "blue", "purple", "pink", "red", "orange", "yellow", "green", "graphite",
];
const KEY: &str = "settings";
/// The pictures of the Desktop & Screen Saver pane (`pictures.ts`).
const PICTURES: &[&str] = &[
    "color:black",
    "color:stone",
    "color:space-gray",
    "color:silver",
    "color:blue",
    "color:dark-blue",
    "color:teal",
    "color:green",
    "catalina",
    "mojave",
    "solar-gradients",
    "island-at-dusk",
    "island-at-night",
    "mountains",
    "sunlit-coast",
    "striated-rock",
    "green-bay",
    "dark-clouds",
    "cloudy-sea",
];
/// The most apps `dock.order` or `dock.removed` names.
pub const MAX_DOCK_IDS: usize = 128;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Theme {
    pub appearance: String,
    pub accent: Option<String>,
    pub highlight: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Settings {
    pub values: Option<BTreeMap<String, serde_json::Value>>,
    pub theme: Option<Theme>,
}

/// A `PUT` body: the settings and the revision the page based them on.
#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Body {
    values: Option<BTreeMap<String, serde_json::Value>>,
    theme: Option<Theme>,
    rev: u64,
    /// The session the page loaded the settings under (`document.rs`).
    #[serde(default)]
    session: Option<String>,
}

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    let session = cx.session;
    let outcome = match (cx.request.method, cx.request.path) {
        ("GET", "/settings") => document::read(&mut cx.storage.user(), KEY)
            .await
            .map(|current| {
                document::for_session(reply(current.doc.as_ref(), current.rev), session)
            }),
        ("PUT", "/settings") => match cx.request.json::<Body>().map(|body| {
            let settings = Settings {
                values: body.values,
                theme: body.theme,
            };
            validate(settings).map(|settings| (settings, body.rev, body.session))
        }) {
            Err(response) => Ok(response),
            Ok(Err(message)) => Ok(Response::error(400, &message)),
            Ok(Ok((settings, base, named))) => {
                match document::other_session(named.as_deref(), session) {
                    Some(refused) => Ok(refused),
                    None => {
                        document::write(&mut cx.storage.user(), KEY, Some(base), Some(&settings))
                            .await
                            .map(|saved| document::answer(saved, Some(&settings), reply))
                    }
                }
            }
        },
        ("DELETE", "/settings") => document::write(&mut cx.storage.user(), KEY, None, None)
            .await
            .map(|saved| document::answer(saved, None, reply)),
        (_, "/settings") => Ok(Response::method_not_allowed()),
        _ => Ok(Response::not_found()),
    };
    outcome.unwrap_or_else(|error| Response::error(503, &format!("storage failed: {error}")))
}

/// What a `GET` answers: both halves `null` when nothing is stored.
fn reply(settings: Option<&Settings>, rev: u64) -> serde_json::Value {
    serde_json::json!({
        "values": settings.and_then(|s| s.values.as_ref()),
        "theme": settings.and_then(|s| s.theme.as_ref()),
        "rev": rev,
    })
}

/// Check a submitted body.
fn validate(settings: Settings) -> Result<Settings, String> {
    if let Some(values) = &settings.values {
        if values.len() > MAX_VALUES {
            return Err(format!("at most {MAX_VALUES} settings"));
        }
        for (key, value) in values {
            let named = key
                .split_once('.')
                .is_some_and(|(pane, name)| !pane.is_empty() && !name.is_empty());
            if !document::valid_key(key) || !named {
                return Err(format!("setting {key:?} is not a <pane>.<name> key"));
            }
            let size = serde_json::to_vec(value).map_err(|e| e.to_string())?.len();
            if size > MAX_VALUE_BYTES {
                return Err(format!("setting {key:?} is over {MAX_VALUE_BYTES} bytes"));
            }
            desktop_value(key, value)?;
        }
    }
    if let Some(theme) = &settings.theme {
        if !matches!(theme.appearance.as_str(), "light" | "dark" | "auto") {
            return Err("the appearance is light, dark or auto".into());
        }
        for colour in [&theme.accent, &theme.highlight].into_iter().flatten() {
            if !ACCENTS.contains(&colour.as_str()) {
                return Err(format!("{colour:?} is not an accent colour"));
            }
        }
    }
    Ok(settings)
}

/// An app id as the desktop names apps: its demo folder's name.
fn app_id(id: &str) -> bool {
    (1..=64).contains(&id.len())
        && id
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}

/// A drive file's id, as `src/apps/files` makes them.
fn file_id(id: &str) -> bool {
    (1..=64).contains(&id.len())
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}

/// A finite number within `low..=high`.
fn number_in(value: &serde_json::Value, low: f64, high: f64) -> bool {
    value
        .as_f64()
        .is_some_and(|n| n.is_finite() && (low..=high).contains(&n))
}

/// Check a setting of the person's desktop (see the module's documentation).
/// Every other key is the panes' own, and any value of its size is taken.
fn desktop_value(key: &str, value: &serde_json::Value) -> Result<(), String> {
    let refuse = |what: &str| Err(format!("setting {key:?} must be {what}"));
    match key {
        "dock.size" | "dock.magnificationSize" if !number_in(value, 0.0, 100.0) => {
            refuse("a number from 0 to 100")
        }
        "dock.magnification" | "dock.autohide" if !value.is_boolean() => refuse("true or false"),
        "dock.position" if !matches!(value.as_str(), Some("left" | "bottom" | "right")) => {
            refuse("left, bottom or right")
        }
        "dock.order" | "dock.removed" => {
            let ids = value.as_array().map(|ids| {
                ids.iter()
                    .map(|id| id.as_str().filter(|id| app_id(id)))
                    .collect::<Option<Vec<_>>>()
            });
            match ids {
                Some(Some(ids))
                    if ids.len() <= MAX_DOCK_IDS
                        && ids.iter().collect::<std::collections::BTreeSet<_>>().len()
                            == ids.len() =>
                {
                    Ok(())
                }
                _ => refuse(&format!(
                    "a list of at most {MAX_DOCK_IDS} app ids, without repeats"
                )),
            }
        }
        "desktop-and-screen-saver.picture" => {
            let ok = value.as_str().is_some_and(|picture| {
                PICTURES.contains(&picture)
                    || picture == "photos"
                    || picture.strip_prefix("drive:").is_some_and(file_id)
            });
            if ok {
                Ok(())
            } else {
                refuse("one of the pane's pictures, photos, or drive:<file id>")
            }
        }
        "desktop-and-screen-saver.mode"
            if !matches!(value.as_str(), Some("dynamic" | "light" | "dark")) =>
        {
            refuse("dynamic, light or dark")
        }
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn settings(body: serde_json::Value) -> Settings {
        serde_json::from_value(body).unwrap()
    }

    #[test]
    fn a_theme_and_pane_settings_are_accepted() {
        let ok = settings(serde_json::json!({
            "values": { "dock.size": 0.4, "general.scrollBars": "always", "general.appearance": null },
            "theme": { "appearance": "dark", "accent": "pink", "highlight": null },
        }));
        assert_eq!(validate(ok.clone()), Ok(ok));
        let halves = settings(serde_json::json!({ "values": null, "theme": null }));
        assert!(validate(halves).is_ok());
    }

    #[test]
    fn bad_settings_are_refused() {
        let theme = |appearance: &str, accent: &str| {
            settings(serde_json::json!({
                "values": null,
                "theme": { "appearance": appearance, "accent": accent, "highlight": "blue" },
            }))
        };
        assert!(
            validate(theme("dim", "blue")).is_err(),
            "unknown appearance"
        );
        assert!(validate(theme("light", "teal")).is_err(), "unknown accent");
        let value = |key: &str, value: serde_json::Value| {
            settings(serde_json::json!({ "values": { key: value }, "theme": null }))
        };
        assert!(
            validate(value("size", 1.into())).is_err(),
            "no pane in the key"
        );
        assert!(
            validate(value("dock/size", 1.into())).is_err(),
            "slash in the key"
        );
        assert!(
            validate(value("dock.note", "x".repeat(MAX_VALUE_BYTES).into())).is_err(),
            "oversized value"
        );
    }

    fn values(key: &str, value: serde_json::Value) -> Settings {
        settings(serde_json::json!({ "values": { key: value }, "theme": null }))
    }

    #[test]
    fn the_persons_desktop_is_accepted() {
        let ok = settings(serde_json::json!({
            "values": {
                "dock.size": 42.5,
                "dock.magnification": true,
                "dock.magnificationSize": 100,
                "dock.position": "left",
                "dock.autohide": false,
                "dock.order": ["notes", "safari", "system-preferences"],
                "dock.removed": ["chess"],
                "desktop-and-screen-saver.picture": "drive:0123456789abcdef0123456789abcdef",
                "desktop-and-screen-saver.mode": "dark",
            },
            "theme": { "appearance": "auto", "accent": "green", "highlight": "pink" },
        }));
        assert_eq!(validate(ok.clone()), Ok(ok));
        for picture in ["catalina", "cloudy-sea", "photos", "color:teal"] {
            assert!(validate(values("desktop-and-screen-saver.picture", picture.into())).is_ok());
        }
    }

    #[test]
    fn a_desktop_setting_of_the_wrong_shape_is_refused() {
        let refused = [
            ("dock.size", serde_json::json!(101)),
            ("dock.size", serde_json::json!("large")),
            ("dock.magnificationSize", serde_json::json!(-1)),
            ("dock.autohide", serde_json::json!("yes")),
            ("dock.position", serde_json::json!("top")),
            ("dock.order", serde_json::json!(["notes", "notes"])),
            ("dock.order", serde_json::json!(["Notes"])),
            ("dock.removed", serde_json::json!("chess")),
            (
                "dock.order",
                serde_json::json!((0..=MAX_DOCK_IDS)
                    .map(|n| format!("a{n}"))
                    .collect::<Vec<_>>()),
            ),
            (
                "desktop-and-screen-saver.picture",
                serde_json::json!("https://example.com/a.jpg"),
            ),
            (
                "desktop-and-screen-saver.picture",
                serde_json::json!("drive:../x"),
            ),
            ("desktop-and-screen-saver.mode", serde_json::json!("auto")),
        ];
        for (key, value) in refused {
            assert!(
                validate(values(key, value.clone())).is_err(),
                "{key} = {value} was taken"
            );
        }
    }
}

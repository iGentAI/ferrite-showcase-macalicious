//! Voice Memos' server half: the person's Preferences, kept as one document.
//! The recordings themselves are files of the person's drive (`src/apps/files`),
//! in Music/Voice Memos, recorded and played by the browser.
//!
//! * `GET /api/voice-memos/preferences`: `{"preferences": {...} | null, "rev":
//!   n, "session": id}`; `null` before the first save.
//! * `PUT /api/voice-memos/preferences` with `{"preferences": {...}, "rev": n}`:
//!   replaces it, or 409 with the current one (`document.rs`).
//! * `DELETE /api/voice-memos/preferences`: forgets it.
//!
//! Preferences are `{"audioQuality", "clearDeleted", "locationNaming"}`:
//! `compressed` or `lossless`, `immediately`, `day`, `week`, `month` or
//! `never`, and `true` or nothing.

use ferrite_app::{serde, serde_json};

use super::document;
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};

pub const MODULE: AppModule = AppModule {
    name: "voice-memos",
    title: "Voice Memos",
    handle,
};

const KEY: &str = "preferences";

/// How a take is written.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum AudioQuality {
    Compressed,
    Lossless,
}

/// When a deleted recording leaves the Trash for good.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum ClearDeleted {
    Immediately,
    Day,
    Week,
    Month,
    Never,
}

/// The person's Preferences.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(
    crate = "ferrite_app::serde",
    deny_unknown_fields,
    rename_all = "camelCase"
)]
pub struct Preferences {
    pub audio_quality: AudioQuality,
    pub clear_deleted: ClearDeleted,
    /// New recordings are named after where the person is.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub location_naming: bool,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Body {
    preferences: Preferences,
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
        ("GET", "/preferences") => {
            document::read(&mut cx.storage.user(), KEY)
                .await
                .map(|current| {
                    document::for_session(reply(current.doc.as_ref(), current.rev), session)
                })
        }
        ("PUT", "/preferences") => match cx.request.json::<Body>() {
            Err(response) => Ok(response),
            Ok(body) => match document::other_session(body.session.as_deref(), session) {
                Some(refused) => Ok(refused),
                None => document::write(
                    &mut cx.storage.user(),
                    KEY,
                    Some(body.rev),
                    Some(&body.preferences),
                )
                .await
                .map(|saved| document::answer(saved, Some(&body.preferences), reply)),
            },
        },
        ("DELETE", "/preferences") => {
            document::write::<Preferences>(&mut cx.storage.user(), KEY, None, None)
                .await
                .map(|saved| document::answer(saved, None, reply))
        }
        (_, "/preferences") => Ok(Response::method_not_allowed()),
        _ => Ok(Response::not_found()),
    };
    outcome.unwrap_or_else(|error| Response::error(503, &format!("storage failed: {error}")))
}

fn reply(preferences: Option<&Preferences>, rev: u64) -> serde_json::Value {
    serde_json::json!({ "preferences": preferences, "rev": rev })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_window_s_preferences_round_trip() {
        let text = r#"{"audioQuality":"lossless","clearDeleted":"week"}"#;
        let read: Preferences = serde_json::from_str(text).unwrap();
        assert_eq!(read.audio_quality, AudioQuality::Lossless);
        assert_eq!(read.clear_deleted, ClearDeleted::Week);
        assert_eq!(serde_json::to_string(&read).unwrap(), text);
        let naming = r#"{"audioQuality":"lossless","clearDeleted":"week","locationNaming":true}"#;
        let read: Preferences = serde_json::from_str(naming).unwrap();
        assert!(read.location_naming);
        assert_eq!(serde_json::to_string(&read).unwrap(), naming);
    }

    #[test]
    fn other_preferences_are_refused() {
        for text in [
            r#"{"audioQuality":"best","clearDeleted":"week"}"#,
            r#"{"audioQuality":"lossless","clearDeleted":"year"}"#,
            r#"{"audioQuality":"lossless"}"#,
            r#"{"audioQuality":"lossless","clearDeleted":"week","place":1}"#,
        ] {
            assert!(serde_json::from_str::<Preferences>(text).is_err(), "{text}");
        }
    }
}

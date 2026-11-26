//! Do Not Disturb in Messages, per person and per conversation.
//!
//! The conversations a person has muted are keys `muted/<id>` in their own
//! Messages space, which nobody else's request reaches. `<id>` is an account
//! conversation (`c-<32 hex>`) or a room, as `room-<room>`
//! ([`room_conversation`]): each room is muted on its own. An id is 1 to 48
//! lowercase letters, digits or `-`. While a
//! conversation is muted, a message in it does not notify the person (the
//! message itself, its unread count and the list are as before), as
//! Do Not Disturb does on macOS.
//!
//! `GET /api/messages/muted` lists them; `PUT /api/messages/muted/<id>` with
//! `{"muted": true|false}` sets one. A person mutes at most [`MUTED_LIMIT`]
//! conversations. Before anyone signs in nothing is muted, and nothing can be.

use ferrite_app::{serde, serde_json};

use super::MODULE;
use crate::http::Response;
use crate::module::{ApiCtx, Storage};

/// The most conversations one person can have muted at once.
pub const MUTED_LIMIT: usize = 200;

/// The id under which a person's Do Not Disturb for room `room` is kept.
pub fn room_conversation(room: &str) -> String {
    format!("room-{room}")
}

/// Whether `id` names a conversation that can be muted: long enough for
/// `room-` and the longest room id.
fn valid(id: &str) -> bool {
    (1..=48).contains(&id.len())
        && id
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}

fn key(id: &str) -> String {
    format!("muted/{id}")
}

/// Route a request under `/api/messages/muted`; `None` when the path is
/// elsewhere.
pub async fn route(cx: &mut ApiCtx<'_>) -> Option<Response> {
    let path = cx.request.path.trim_end_matches('/').to_string();
    let rest = path.strip_prefix("/muted")?;
    let id = match rest {
        "" => None,
        rest => Some(rest.strip_prefix('/')?.to_string()),
    };
    if cx.session.account.is_none() {
        return Some(match (cx.request.method, &id) {
            ("GET", None) => Response::json(200, &serde_json::json!({ "muted": [] })),
            _ => Response::error(401, "sign in to keep Do Not Disturb"),
        });
    }
    Some(match (cx.request.method, id) {
        ("GET", None) => list(cx).await,
        ("PUT", Some(id)) => set(cx, &id).await,
        _ => Response::method_not_allowed(),
    })
}

async fn list(cx: &mut ApiCtx<'_>) -> Response {
    match cx.storage.user().list("muted/", MUTED_LIMIT).await {
        Ok(entries) => {
            let muted: Vec<String> = entries
                .into_iter()
                .filter_map(|(key, _)| key.strip_prefix("muted/").map(str::to_string))
                .filter(|id| valid(id))
                .collect();
            Response::json(200, &serde_json::json!({ "muted": muted }))
        }
        Err(error) => storage_error(error),
    }
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Muting {
    muted: bool,
}

async fn set(cx: &mut ApiCtx<'_>, id: &str) -> Response {
    if !valid(id) {
        return Response::error(
            400,
            "a conversation id is 1 to 48 lowercase letters, digits or '-'",
        );
    }
    let Muting { muted } = match cx.request.json::<Muting>() {
        Ok(body) => body,
        Err(response) => return response,
    };
    let mut space = cx.storage.user();
    let outcome = if muted {
        match space.get(&key(id)).await {
            Ok(Some(_)) => Ok(()),
            Ok(None) => match space.list("muted/", MUTED_LIMIT).await {
                Ok(held) if held.len() >= MUTED_LIMIT => {
                    return Response::error(
                        409,
                        &format!(
                            "Do Not Disturb is on for {MUTED_LIMIT} conversations already; \
                             turn it off for one first"
                        ),
                    );
                }
                Ok(_) => space.put(&key(id), b"1").await,
                Err(error) => Err(error),
            },
            Err(error) => Err(error),
        }
    } else {
        space.delete(&key(id)).await
    };
    match outcome {
        Ok(()) => Response::json(200, &serde_json::json!({ "id": id, "muted": muted })),
        Err(error) => storage_error(error),
    }
}

/// Whether `principal` has muted conversation `id`. A storage error counts as
/// not muted: a notification too many is better than one lost.
pub async fn is_muted(cx: &mut ApiCtx<'_>, principal: &str, id: &str) -> bool {
    let mut storage = Storage::new(cx.storage.store(), MODULE.name, principal);
    matches!(storage.user().get(&key(id)).await, Ok(Some(_)))
}

fn storage_error(error: std::io::Error) -> Response {
    ferrite_app::tracing::warn!(%error, "Do Not Disturb not read or kept");
    Response::error(503, "Do Not Disturb could not be kept just now; try again")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn conversation_ids_are_checked() {
        assert!(valid(&room_conversation("desktop")));
        assert!(valid(&room_conversation(&"x".repeat(40))));
        assert_ne!(room_conversation("desktop"), room_conversation("other"));
        assert!(valid(&format!("c-{}", "a1".repeat(16))));
        for bad in ["", "Room", "a/b", "../x", "a b", &"x".repeat(49)] {
            assert!(!valid(bad), "{bad}");
        }
    }
}

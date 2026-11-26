//! QuickTime Player's server half: the person's recent movies, kept as one
//! document. The movies themselves are files of the person's drive
//! (`src/apps/files`), uploaded and read back in pieces by the browser and
//! played by the browser's own `<video>`; this module keeps only which files
//! were opened, when, and where the person stopped in each.
//!
//! * `GET /api/quicktime-player/recents`: `{"recents": [...] | null, "rev":
//!   n, "session": id}`; `null` before the first save.
//! * `PUT /api/quicktime-player/recents` with `{"recents": [...], "rev": n}`:
//!   replaces it, or 409 with the current one (`document.rs`).
//! * `DELETE /api/quicktime-player/recents`: forgets it.
//! * `GET /api/quicktime-player/clips/<file>`: `{"cuts": [...]}`, the seconds a
//!   saved movie is split at, ascending; none when it has never been split.
//! * `PUT /api/quicktime-player/clips/<file>` with `{"cuts": [...]}`: replaces
//!   them. A movie's are kept apart from the recents, each under its own key, so
//!   that clearing Open Recent, or falling off it, loses no edit.
//!
//! A recent movie is `{"file": <drive file id>, "name", "at", "position"}`:
//! newest first, at most [`MAX_RECENTS`], one entry per file, the place in
//! whole seconds.

use std::collections::BTreeSet;

use ferrite_app::{serde, serde_json};

use super::document;
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};

pub const MODULE: AppModule = AppModule {
    name: "quicktime-player",
    title: "QuickTime Player",
    handle,
};

/// The most recent movies kept: File > Open Recent's ten, twice over.
pub const MAX_RECENTS: usize = 20;
/// The longest name kept, in characters.
pub const MAX_NAME: usize = 255;
/// The latest place kept, in seconds: a week.
pub const MAX_POSITION: u32 = 604_800;
/// The most splits kept in one movie.
pub const MAX_CUTS: usize = 256;
const KEY: &str = "recents";

/// One recent movie.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Recent {
    /// The drive's id of the file.
    pub file: String,
    /// Its name, as it was when it was opened.
    pub name: String,
    /// When it was last opened (epoch ms, the browser's clock).
    pub at: u64,
    /// Where the person stopped, in whole seconds.
    pub position: u32,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Body {
    recents: Vec<Recent>,
    rev: u64,
    #[serde(default)]
    session: Option<String>,
}

/// Where one saved movie is split into clips: the seconds, ascending.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct MovieClips {
    cuts: Vec<f64>,
}

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    let session = cx.session;
    let outcome = match (cx.request.method, cx.request.path) {
        ("GET", "/recents") => document::read(&mut cx.storage.user(), KEY)
            .await
            .map(|current| {
                document::for_session(reply(current.doc.as_ref(), current.rev), session)
            }),
        ("PUT", "/recents") => match cx.request.json::<Body>().map(|body| {
            let named = body.session;
            validate(&body.recents).map(|()| (body.recents, body.rev, named))
        }) {
            Err(response) => Ok(response),
            Ok(Err(message)) => Ok(Response::error(400, &message)),
            Ok(Ok((recents, base, named))) => {
                match document::other_session(named.as_deref(), session) {
                    Some(refused) => Ok(refused),
                    None => {
                        document::write(&mut cx.storage.user(), KEY, Some(base), Some(&recents))
                            .await
                            .map(|saved| document::answer(saved, Some(&recents), reply))
                    }
                }
            }
        },
        ("DELETE", "/recents") => {
            document::write::<Vec<Recent>>(&mut cx.storage.user(), KEY, None, None)
                .await
                .map(|saved| document::answer(saved, None, reply))
        }
        (_, "/recents") => Ok(Response::method_not_allowed()),
        (method, path) if path.starts_with("/clips/") => {
            let file = &path["/clips/".len()..];
            if !document::valid_key(file) {
                return Response::error(400, "that is not a file id");
            }
            let key = format!("clips/{file}");
            match method {
                "GET" => cx.storage.user().get(&key).await.map(|stored| {
                    let cuts = stored
                        .and_then(|bytes| serde_json::from_slice::<MovieClips>(&bytes).ok())
                        .map_or_else(Vec::new, |movie| movie.cuts);
                    Response::json(200, &serde_json::json!({ "cuts": cuts }))
                }),
                "PUT" => match cx
                    .request
                    .json::<MovieClips>()
                    .map(|movie| validate_cuts(&movie.cuts).map(|()| movie))
                {
                    Err(response) => Ok(response),
                    Ok(Err(message)) => Ok(Response::error(400, &message)),
                    Ok(Ok(movie)) => {
                        let mut space = cx.storage.user();
                        let done = if movie.cuts.is_empty() {
                            space.delete(&key).await
                        } else {
                            match serde_json::to_vec(&movie) {
                                Ok(bytes) => space.put(&key, &bytes).await,
                                Err(error) => Err(std::io::Error::other(error)),
                            }
                        };
                        done.map(|()| Response::json(200, &serde_json::json!({ "cuts": movie.cuts })))
                    }
                },
                _ => Ok(Response::method_not_allowed()),
            }
        }
        _ => Ok(Response::not_found()),
    };
    outcome.unwrap_or_else(|error| Response::error(503, &format!("storage failed: {error}")))
}

fn reply(recents: Option<&Vec<Recent>>, rev: u64) -> serde_json::Value {
    serde_json::json!({ "recents": recents, "rev": rev })
}

/// Check where a movie is said to be split: above 0, in ascending order.
fn validate_cuts(cuts: &[f64]) -> Result<(), String> {
    if cuts.len() > MAX_CUTS {
        return Err(format!("at most {MAX_CUTS} cuts"));
    }
    let inside = |cut: &f64| cut.is_finite() && *cut > 0.0 && *cut <= f64::from(MAX_POSITION);
    if !cuts.iter().all(inside) {
        return Err(format!("a cut is above 0 and at most {MAX_POSITION} seconds"));
    }
    if !cuts.windows(2).all(|pair| pair[0] < pair[1]) {
        return Err("cuts are in ascending order".to_string());
    }
    Ok(())
}

/// Check a submitted list of recent movies.
pub fn validate(recents: &[Recent]) -> Result<(), String> {
    if recents.len() > MAX_RECENTS {
        return Err(format!("at most {MAX_RECENTS} recent movies"));
    }
    let mut seen = BTreeSet::new();
    for recent in recents {
        if !document::valid_key(&recent.file) {
            return Err(format!("{:?} is not a file id", recent.file));
        }
        if !seen.insert(recent.file.as_str()) {
            return Err(format!("the file {:?} is listed twice", recent.file));
        }
        let name = recent.name.chars().count();
        if name == 0 || name > MAX_NAME || recent.name.chars().any(char::is_control) {
            return Err(format!(
                "a name is 1 to {MAX_NAME} characters, without control characters"
            ));
        }
        if recent.position > MAX_POSITION {
            return Err(format!("a place is at most {MAX_POSITION} seconds"));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn recent(file: &str) -> Recent {
        Recent {
            file: file.into(),
            name: "Holiday.webm".into(),
            at: 1_790_000_000_000,
            position: 42,
        }
    }

    #[test]
    fn a_movie_s_cuts_are_checked() {
        assert_eq!(validate_cuts(&[]), Ok(()));
        assert_eq!(validate_cuts(&[0.05, 1.5, 3.25]), Ok(()));
        for bad in [
            vec![2.0, 1.0],
            vec![1.0, 1.0],
            vec![0.0],
            vec![f64::NAN],
            vec![f64::from(MAX_POSITION) + 1.0],
            (1..=MAX_CUTS + 1).map(|cut| cut as f64).collect(),
        ] {
            assert!(validate_cuts(&bad).is_err(), "{bad:?}");
        }
    }

    #[test]
    fn the_window_s_recents_round_trip() {
        let list = vec![recent("f1"), recent("f2")];
        assert_eq!(validate(&list), Ok(()));
        let text = serde_json::to_string(&list).unwrap();
        assert_eq!(serde_json::from_str::<Vec<Recent>>(&text).unwrap(), list);
    }

    #[test]
    fn bad_recents_are_refused() {
        assert!(
            validate(&[recent("f1"), recent("f1")]).is_err(),
            "a file twice"
        );
        assert!(
            validate(&[recent("a/b")]).is_err(),
            "an id that is not plain"
        );
        let many: Vec<Recent> = (0..=MAX_RECENTS)
            .map(|n| recent(&format!("f{n}")))
            .collect();
        assert!(validate(&many).is_err(), "too many");
        let mut name = recent("f1");
        name.name = String::new();
        assert!(validate(&[name.clone()]).is_err(), "an empty name");
        name.name = "a\tb".into();
        assert!(validate(&[name]).is_err(), "a control character");
        let mut place = recent("f1");
        place.position = MAX_POSITION + 1;
        assert!(validate(&[place]).is_err(), "a place past a week");
        assert!(
            serde_json::from_str::<Recent>(
                r#"{"file":"f","name":"n","at":1,"position":0,"bytes":3}"#
            )
            .is_err(),
            "a field the module does not know"
        );
    }
}

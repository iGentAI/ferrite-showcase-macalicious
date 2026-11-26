//! The App Store's server half: the apps a session got.
//!
//! The store sells the apps of the desktop's catalogue (`../catalogue.rs`)
//! that do not come with it. A finished Get adds the app to the session's
//! library, and the desktop then shows it in Launchpad and the Dock.
//!
//! * `GET /api/app-store/library`: `{"installed": [...], "rev": n}`, or
//!   `installed: null` before the session has got anything.
//! * `PUT /api/app-store/library` with `{"installed": [...], "rev": n}`, `n`
//!   the revision the page last had: replaces the list and answers it with the
//!   new revision, or 409 with the current library when `n` is not the stored
//!   revision (`document.rs`).
//! * `DELETE /api/app-store/library`: forgets every app got.
//! * `GET /api/app-store/versions`: `{"current": "<version>", "kept": {id:
//!   "<version>"} | null, "rev": n}`. The current version is the first twelve
//!   digits of the served build's digest: the desktop is built as one, so a
//!   new build is a new version of every app. `kept` names the version of each
//!   app got that the person last took; one behind `current` waits on the
//!   Updates page.
//! * `PUT /api/app-store/versions` with `{"kept": {...}, "rev": n}`: replaces
//!   them, under the same revision rule.
//!
//! Each id must name an app of the catalogue that is not preinstalled, once.
//! Removing an app (Launchpad's delete button, or Uninstall in the store) is
//! a `PUT` of the list without it: the Dock and Launchpad of every browser of
//! the person then leave it out. The app's own data stays: it is counted in
//! Storage Management, which can forget the documents it lists, and the app
//! finds it again when it is got again.

use std::collections::{BTreeMap, BTreeSet};

use ferrite_app::{serde, serde_json};

use super::{catalogue, document};
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};

pub const MODULE: AppModule = AppModule {
    name: "app-store",
    title: "App Store",
    handle,
};

const KEY: &str = "library";
const VERSIONS_KEY: &str = "versions";

/// The digits of the build's digest a version is.
const VERSION_DIGITS: usize = 12;

/// What the session keeps.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Library {
    /// The apps got, in the order they were got.
    pub installed: Vec<String>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Body {
    installed: Vec<String>,
    rev: u64,
    #[serde(default)]
    session: Option<String>,
}

/// What the session keeps of the versions it took.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Versions {
    /// The version last taken of each app got.
    pub kept: BTreeMap<String, String>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct VersionsBody {
    kept: BTreeMap<String, String>,
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
        ("GET", "/library") => document::read(&mut cx.storage.user(), KEY)
            .await
            .map(|current| {
                document::for_session(reply(current.doc.as_ref(), current.rev), session)
            }),
        ("PUT", "/library") => match cx.request.json::<Body>().map(|body| {
            let named = body.session;
            validate(Library {
                installed: body.installed,
            })
            .map(|library| (library, body.rev, named))
        }) {
            Err(response) => Ok(response),
            Ok(Err(message)) => Ok(Response::error(400, &message)),
            Ok(Ok((library, base, named))) => {
                match document::other_session(named.as_deref(), session) {
                    Some(refused) => Ok(refused),
                    None => {
                        document::write(&mut cx.storage.user(), KEY, Some(base), Some(&library))
                            .await
                            .map(|saved| document::answer(saved, Some(&library), reply))
                    }
                }
            }
        },
        ("DELETE", "/library") => {
            document::write::<Library>(&mut cx.storage.user(), KEY, None, None)
                .await
                .map(|saved| document::answer(saved, None, reply))
        }
        (_, "/library") => Ok(Response::method_not_allowed()),
        ("GET", "/versions") => document::read(&mut cx.storage.user(), VERSIONS_KEY)
            .await
            .map(|current| {
                document::for_session(versions_reply(current.doc.as_ref(), current.rev), session)
            }),
        ("PUT", "/versions") => match cx.request.json::<VersionsBody>().map(|body| {
            let named = body.session;
            validate_versions(Versions { kept: body.kept }).map(|kept| (kept, body.rev, named))
        }) {
            Err(response) => Ok(response),
            Ok(Err(message)) => Ok(Response::error(400, &message)),
            Ok(Ok((kept, base, named))) => {
                match document::other_session(named.as_deref(), session) {
                    Some(refused) => Ok(refused),
                    None => document::write(
                        &mut cx.storage.user(),
                        VERSIONS_KEY,
                        Some(base),
                        Some(&kept),
                    )
                    .await
                    .map(|saved| document::answer(saved, Some(&kept), versions_reply)),
                }
            }
        },
        (_, "/versions") => Ok(Response::method_not_allowed()),
        _ => Ok(Response::not_found()),
    };
    outcome.unwrap_or_else(|error| Response::error(503, &format!("storage failed: {error}")))
}

/// What a `GET` answers.
fn reply(library: Option<&Library>, rev: u64) -> serde_json::Value {
    serde_json::json!({ "installed": library.map(|l| &l.installed), "rev": rev })
}

/// The version a build is: the first digits of its digest.
fn version_of(build_id: &str) -> &str {
    let digest = build_id.strip_prefix("sha256:").unwrap_or(build_id);
    digest.get(..VERSION_DIGITS).unwrap_or(digest)
}

/// What a versions `GET` answers.
fn versions_reply(versions: Option<&Versions>, rev: u64) -> serde_json::Value {
    serde_json::json!({
        "current": version_of(crate::site_bundle().build_id),
        "kept": versions.map(|v| &v.kept),
        "rev": rev,
    })
}

/// Check submitted versions: apps the store sells, each named by hex digits.
fn validate_versions(versions: Versions) -> Result<Versions, String> {
    for (id, version) in &versions.kept {
        match catalogue::find(id) {
            None => return Err(format!("{id:?} is not an app of the catalogue")),
            Some(app) if app.preinstalled => {
                return Err(format!("{id:?} comes with the desktop and is not got"))
            }
            Some(_) => {}
        }
        let readable = !version.is_empty()
            && version.len() <= VERSION_DIGITS
            && version.bytes().all(|b| b.is_ascii_hexdigit());
        if !readable {
            return Err(format!("{version:?} is not a version"));
        }
    }
    Ok(versions)
}

/// Check a submitted library: apps of the catalogue that the store sells,
/// each once.
fn validate(library: Library) -> Result<Library, String> {
    let mut seen = BTreeSet::new();
    for id in &library.installed {
        match catalogue::find(id) {
            None => return Err(format!("{id:?} is not an app of the catalogue")),
            Some(app) if app.preinstalled => {
                return Err(format!("{id:?} comes with the desktop and is not got"))
            }
            Some(_) => {}
        }
        if !seen.insert(id.as_str()) {
            return Err(format!("{id:?} is listed twice"));
        }
    }
    Ok(library)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn library(ids: &[&str]) -> Library {
        Library {
            installed: ids.iter().map(|id| id.to_string()).collect(),
        }
    }

    #[test]
    fn a_version_is_the_start_of_the_builds_digest() {
        assert_eq!(version_of("sha256:0123456789abcdef"), "0123456789ab");
        assert_eq!(version_of("short"), "short");
    }

    #[test]
    fn only_apps_the_store_sells_keep_a_version() {
        let versions = |id: &str, version: &str| Versions {
            kept: BTreeMap::from([(id.to_string(), version.to_string())]),
        };
        assert!(validate_versions(versions("books", "0123456789ab")).is_ok());
        assert!(validate_versions(versions("calculator", "01")).is_err());
        assert!(validate_versions(versions("nothing", "01")).is_err());
        assert!(validate_versions(versions("books", "")).is_err());
        assert!(validate_versions(versions("books", "not hex")).is_err());
        assert!(validate_versions(versions("books", "0123456789abc")).is_err());
    }

    #[test]
    fn only_apps_the_store_sells_are_got_once() {
        assert!(validate(library(&[])).is_ok());
        assert!(validate(library(&["books", "stocks"])).is_ok());
        assert!(validate(library(&["books", "books"])).is_err(), "twice");
        assert!(validate(library(&["calculator"])).is_err(), "preinstalled");
        assert!(
            validate(library(&["finder"])).is_err(),
            "not in the catalogue"
        );
        assert!(validate(library(&["Books"])).is_err(), "ids are exact");
        assert!(
            serde_json::from_str::<Library>(r#"{"installed":[],"extra":1}"#).is_err(),
            "unknown fields are refused"
        );
    }
}

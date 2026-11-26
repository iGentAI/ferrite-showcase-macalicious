//! Font Book's server half: a session's collections and the fonts it turned
//! off.
//!
//! The Font Book demo keeps both in the window; when the desktop is served by
//! this app it loads them from here when it opens and saves them after every
//! change.
//!
//! * `GET /api/font-book/library`: `{"collections": [...], "disabled": [...],
//!   "rev": n}`, or both `null` before the session has saved (the demo then
//!   shows its own starting state: no collections of the user's, every font
//!   on).
//! * `PUT /api/font-book/library` with `{"collections": [...], "disabled":
//!   [...], "rev": n}`, `n` the revision the page last had: replaces both and
//!   answers them with the new revision, or, when `n` is not the stored
//!   revision, changes nothing and answers 409 with the current library
//!   (`document.rs`).
//! * `DELETE /api/font-book/library`: forgets both.
//!
//! A collection is `{"id", "name", "families"}`, the families by id as
//! `demos/font-book/font-book-data.ts` names them. `disabled` lists the ids of
//! the families the user turned off. The ids are not checked against the
//! demo's list, which the server does not hold; the demo ignores one it does
//! not know. Fonts added from files are not kept: their files stay in the
//! page.

use std::collections::BTreeSet;

use ferrite_app::{serde, serde_json};

use super::document;
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};

pub const MODULE: AppModule = AppModule {
    name: "font-book",
    title: "Font Book",
    handle,
};

/// The most collections a session keeps.
pub const MAX_COLLECTIONS: usize = 100;
/// The most families in one collection, and the most turned off.
pub const MAX_FAMILIES: usize = 2000;
/// The longest collection name.
const MAX_NAME_CHARS: usize = 100;
const KEY: &str = "library";

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub families: Vec<String>,
}

/// What the session keeps.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Library {
    pub collections: Vec<Collection>,
    pub disabled: Vec<String>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct Body {
    collections: Vec<Collection>,
    disabled: Vec<String>,
    /// The revision the page based this on, and the session it loaded it
    /// under (`document.rs`).
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
            let library = Library {
                collections: body.collections,
                disabled: body.disabled,
            };
            validate(library).map(|library| (library, body.rev, named))
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
        _ => Ok(Response::not_found()),
    };
    outcome.unwrap_or_else(|error| Response::error(503, &format!("storage failed: {error}")))
}

/// What a `GET` answers.
fn reply(library: Option<&Library>, rev: u64) -> serde_json::Value {
    serde_json::json!({
        "collections": library.map(|l| &l.collections),
        "disabled": library.map(|l| &l.disabled),
        "rev": rev,
    })
}

/// Check a list of family ids: plain ids, each once, at most [`MAX_FAMILIES`].
fn family_ids(what: &str, ids: &[String]) -> Result<(), String> {
    if ids.len() > MAX_FAMILIES {
        return Err(format!("{what} lists at most {MAX_FAMILIES} fonts"));
    }
    let mut seen = BTreeSet::new();
    for id in ids {
        if !document::valid_key(id) {
            return Err(format!("{id:?} in {what} is not a plain font id"));
        }
        if !seen.insert(id.as_str()) {
            return Err(format!("{id:?} is listed twice in {what}"));
        }
    }
    Ok(())
}

/// Check a submitted library.
fn validate(library: Library) -> Result<Library, String> {
    if library.collections.len() > MAX_COLLECTIONS {
        return Err(format!("at most {MAX_COLLECTIONS} collections"));
    }
    let mut ids = BTreeSet::new();
    for collection in &library.collections {
        if !document::valid_key(&collection.id) {
            return Err(format!(
                "collection id {:?} is not a plain id of 1 to 128 characters",
                collection.id
            ));
        }
        if !ids.insert(collection.id.as_str()) {
            return Err(format!("collection id {:?} is listed twice", collection.id));
        }
        let length = collection.name.chars().count();
        if !(1..=MAX_NAME_CHARS).contains(&length) {
            return Err(format!(
                "a collection's name has 1 to {MAX_NAME_CHARS} characters"
            ));
        }
        family_ids("a collection", &collection.families)?;
    }
    family_ids("the disabled fonts", &library.disabled)?;
    Ok(library)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn collection(id: &str) -> Collection {
        Collection {
            id: id.into(),
            name: "New Collection".into(),
            families: vec!["zapfino".into()],
        }
    }

    fn library(collections: Vec<Collection>, disabled: &[&str]) -> Library {
        Library {
            collections,
            disabled: disabled.iter().map(|id| id.to_string()).collect(),
        }
    }

    #[test]
    fn a_library_round_trips_in_the_demo_s_shape() {
        let text = r#"{"collections":[{"id":"collection-1","name":"New Collection","families":[]}],"disabled":["zapfino"]}"#;
        let parsed: Library = serde_json::from_str(text).unwrap();
        assert_eq!(serde_json::to_string(&parsed).unwrap(), text);
    }

    #[test]
    fn bad_libraries_are_refused() {
        assert!(validate(library(
            vec![collection("a"), collection("b")],
            &["zapfino"]
        ))
        .is_ok());
        assert!(
            validate(library(vec![collection("a"), collection("a")], &[])).is_err(),
            "duplicate collection"
        );
        assert!(
            validate(library(vec![], &["zapfino", "zapfino"])).is_err(),
            "a font turned off twice"
        );
        assert!(
            validate(library(vec![], &["a/b"])).is_err(),
            "not a plain id"
        );
        let mut unnamed = collection("a");
        unnamed.name = String::new();
        assert!(validate(library(vec![unnamed], &[])).is_err(), "no name");
        let mut long = collection("a");
        long.name = "x".repeat(MAX_NAME_CHARS + 1);
        assert!(validate(library(vec![long], &[])).is_err(), "long name");
        let many: Vec<_> = (0..=MAX_COLLECTIONS)
            .map(|n| collection(&format!("c{n}")))
            .collect();
        assert!(
            validate(library(many, &[])).is_err(),
            "too many collections"
        );
        assert!(
            serde_json::from_str::<Library>(r#"{"collections":[],"disabled":[],"size":42}"#)
                .is_err(),
            "unknown fields are refused"
        );
    }
}

//! TextEdit's server half: a session's open document, saved as it is typed,
//! and the documents and folders saved through the Save panel.
//!
//! The page has no disk. When the desktop is served by this app, TextEdit's
//! Open and Save panels list the session's store instead of the demo's
//! made-up folders alone, and the document in the window is kept after every
//! change (autosave), so a reload opens it again as it was.
//!
//! * `GET /api/textedit/draft`: `{"draft": {...}, "rev": n}`, the document
//!   in the window, or `{"draft": null, ...}` before the session has saved
//!   one (the demo then opens its own starting document).
//! * `PUT /api/textedit/draft` with `{"draft": {...}, "rev": n}`.
//! * `GET /api/textedit/files`: `{"files": [...], "rev": n}`, every document
//!   and folder saved, in the order saved, or `null` before the first.
//! * `PUT /api/textedit/files` with `{"files": [...], "rev": n}`.
//! * `DELETE` of either forgets it.
//!
//! Both follow `document.rs`: a `PUT` based on a revision that is not the
//! stored one changes nothing and is answered 409 with the current document.
//!
//! A document is `{"name", "format": "rich" | "plain", "lines": [...],
//! "html"?, "ruler"?}`: `lines` is its text, `html` the rich text view's
//! paragraphs with their formats, `ruler` the indents and tab stops. The
//! draft adds `"edited"`. The server stores `html` as text and never serves
//! it as a page; the demo rebuilds it from a short list of elements, styles
//! and attributes before it shows it (`demos/textedit/textedit-server.ts`).
//!
//! A saved file is `{"place", "folders", "file"}`: the sidebar place and the
//! chain of folder ids it was saved into, and the file (`{"id", "name",
//! "kind": "document" | "folder", "detail"?, "document"?}`). The demo puts
//! the files into its places in the order saved, so a later save of the same
//! name replaces an earlier one, as in the Save panel. Since TextEdit saves
//! into the person's drive (`src/apps/files`), its client no longer writes
//! this list; it is kept for the documents saved before, which Spotlight
//! still finds.
//!
//! The draft may name the drive file it is the document of: `"file": {"id",
//! "name", "version"?}`, so a reload opens the document bound to its file
//! again; `version` is the file's version the document was last read from or
//! saved as, which its next save in place is made from.

use std::collections::BTreeSet;

use ferrite_app::{serde, serde_json};

use super::document;
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};

pub const MODULE: AppModule = AppModule {
    name: "textedit",
    title: "TextEdit",
    handle,
};

/// The most files and folders a session keeps.
pub const MAX_FILES: usize = 200;
/// The most characters of one document: its lines and its `html` together.
/// The gateway's 256 KiB body limit usually binds first.
pub const MAX_DOCUMENT_CHARS: usize = 262_144;
/// The most lines of one document.
const MAX_LINES: usize = 20_000;
/// The longest name or detail.
const MAX_NAME_CHARS: usize = 255;
/// The deepest folder a file is saved in.
const MAX_DEPTH: usize = 16;
/// The longest file or folder id. The demo makes a saved file's id from its
/// place, its chain of folders and its name (`saved-<place>/<folder>/…/<name>`),
/// so an id has room for a place, `MAX_DEPTH` folders and a name of the
/// longest length, with their separators.
const MAX_ID_CHARS: usize = (MAX_DEPTH + 2) * (MAX_NAME_CHARS + 1) + 8;
/// The most tab stops, and the largest indent or stop in points.
const MAX_TAB_STOPS: usize = 100;
const MAX_POINTS: f64 = 100_000.0;
/// The most characters of a document's property.
const MAX_PROPERTY_CHARS: usize = 1000;
const DRAFT: &str = "draft";
const FILES: &str = "files";

/// The drive file a draft is the document of.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct FileRef {
    pub id: String,
    pub name: String,
    /// The file's drive version the document was last read from or saved as.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<u64>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(
    crate = "ferrite_app::serde",
    rename_all = "camelCase",
    deny_unknown_fields
)]
pub struct Ruler {
    pub first: f64,
    pub head: f64,
    pub tail: f64,
    pub tab_stops: Vec<f64>,
}

/// A rich text document's properties, as the demo's `TextEditProperties`.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Default)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Properties {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub organization: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub copyright: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub keywords: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
}

/// A document, as the demo's `TextEditDocument` with its formats as `html`.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Doc {
    pub name: String,
    /// `"rich"` or `"plain"`.
    pub format: String,
    pub lines: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub html: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ruler: Option<Ruler>,
    /// File > Show Properties.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub properties: Option<Properties>,
    /// The draft's: whether it has changed since it was opened or saved.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub edited: Option<bool>,
    /// The draft's: whether it holds changes not yet written into its drive file. A reload
    /// writes such a draft into the file, and reads any other draft's file again.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unwritten: Option<bool>,
    /// The draft's: Format > Prevent Editing holds the document.
    #[serde(default, rename = "readOnly", skip_serializing_if = "Option::is_none")]
    pub read_only: Option<bool>,
    /// The draft's: the drive file it is the document of.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file: Option<FileRef>,
}

/// A file of the Open and Save panels.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct File {
    pub id: String,
    pub name: String,
    /// `"document"` or `"folder"`.
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub document: Option<Doc>,
}

/// A file and where it was saved.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Saved {
    pub place: String,
    pub folders: Vec<String>,
    pub file: File,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct DraftBody {
    draft: Doc,
    rev: u64,
    #[serde(default)]
    session: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct FilesBody {
    files: Vec<Saved>,
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
        ("GET", "/draft") => document::read(&mut cx.storage.user(), DRAFT)
            .await
            .map(|current| {
                document::for_session(draft_reply(current.doc.as_ref(), current.rev), session)
            }),
        ("PUT", "/draft") => match cx.request.json::<DraftBody>().map(|body| {
            let named = body.session;
            validate_draft(body.draft).map(|draft| (draft, body.rev, named))
        }) {
            Err(response) => Ok(response),
            Ok(Err(message)) => Ok(Response::error(400, &message)),
            Ok(Ok((draft, base, named))) => {
                match document::other_session(named.as_deref(), session) {
                    Some(refused) => Ok(refused),
                    None => {
                        document::write(&mut cx.storage.user(), DRAFT, Some(base), Some(&draft))
                            .await
                            .map(|saved| document::answer(saved, Some(&draft), draft_reply))
                    }
                }
            }
        },
        ("DELETE", "/draft") => document::write::<Doc>(&mut cx.storage.user(), DRAFT, None, None)
            .await
            .map(|saved| document::answer(saved, None, draft_reply)),
        ("GET", "/files") => document::read(&mut cx.storage.user(), FILES)
            .await
            .map(|current| {
                document::for_session(files_reply(current.doc.as_ref(), current.rev), session)
            }),
        ("PUT", "/files") => match cx.request.json::<FilesBody>().map(|body| {
            let named = body.session;
            validate_files(body.files).map(|files| (files, body.rev, named))
        }) {
            Err(response) => Ok(response),
            Ok(Err(message)) => Ok(Response::error(400, &message)),
            Ok(Ok((files, base, named))) => {
                match document::other_session(named.as_deref(), session) {
                    Some(refused) => Ok(refused),
                    None => {
                        document::write(&mut cx.storage.user(), FILES, Some(base), Some(&files))
                            .await
                            .map(|saved| document::answer(saved, Some(&files), files_reply))
                    }
                }
            }
        },
        ("DELETE", "/files") => {
            document::write::<Vec<Saved>>(&mut cx.storage.user(), FILES, None, None)
                .await
                .map(|saved| document::answer(saved, None, files_reply))
        }
        (_, "/draft" | "/files") => Ok(Response::method_not_allowed()),
        _ => Ok(Response::not_found()),
    };
    outcome.unwrap_or_else(|error| Response::error(503, &format!("storage failed: {error}")))
}

fn draft_reply(draft: Option<&Doc>, rev: u64) -> serde_json::Value {
    serde_json::json!({ "draft": draft, "rev": rev })
}

fn files_reply(files: Option<&Vec<Saved>>, rev: u64) -> serde_json::Value {
    serde_json::json!({ "files": files, "rev": rev })
}

/// Whether `id` can be a drive entry's id (`src/apps/files`: 32 hex digits;
/// any short run of letters and digits is accepted, nothing that could
/// reach another key).
fn drive_id(id: &str) -> bool {
    (1..=64).contains(&id.len()) && id.bytes().all(|b| b.is_ascii_alphanumeric())
}

fn name(what: &str, value: &str) -> Result<(), String> {
    text(what, value, MAX_NAME_CHARS)
}

fn id(what: &str, value: &str) -> Result<(), String> {
    text(what, value, MAX_ID_CHARS)
}

fn text(what: &str, value: &str, most: usize) -> Result<(), String> {
    let length = value.chars().count();
    if !(1..=most).contains(&length) || value.chars().any(char::is_control) {
        return Err(format!(
            "{what} has 1 to {most} characters and no control characters"
        ));
    }
    Ok(())
}

fn points(value: f64) -> bool {
    value.is_finite() && (0.0..=MAX_POINTS).contains(&value)
}

/// Check a document.
fn validate_document(doc: &Doc) -> Result<(), String> {
    name("a document's name", &doc.name)?;
    if !matches!(doc.format.as_str(), "rich" | "plain") {
        return Err("a document's format is \"rich\" or \"plain\"".into());
    }
    if doc.lines.is_empty() || doc.lines.len() > MAX_LINES {
        return Err(format!("a document has 1 to {MAX_LINES} lines"));
    }
    let chars: usize = doc
        .lines
        .iter()
        .map(|line| line.chars().count())
        .sum::<usize>()
        + doc.html.as_deref().map_or(0, |html| html.chars().count());
    if chars > MAX_DOCUMENT_CHARS {
        return Err(format!(
            "a document holds at most {MAX_DOCUMENT_CHARS} characters"
        ));
    }
    if doc.format == "plain"
        && (doc.html.is_some() || doc.ruler.is_some() || doc.properties.is_some())
    {
        return Err("a plain text document has no formats, ruler or properties".into());
    }
    if let Some(properties) = &doc.properties {
        let all = [
            &properties.author,
            &properties.organization,
            &properties.copyright,
            &properties.title,
            &properties.subject,
            &properties.keywords,
            &properties.comment,
        ];
        if all.into_iter().flatten().any(|value| {
            value.chars().count() > MAX_PROPERTY_CHARS || value.chars().any(char::is_control)
        }) {
            return Err(format!(
                "a property is one line of at most {MAX_PROPERTY_CHARS} characters"
            ));
        }
    }
    if let Some(ruler) = &doc.ruler {
        if ruler.tab_stops.len() > MAX_TAB_STOPS {
            return Err(format!("a ruler has at most {MAX_TAB_STOPS} tab stops"));
        }
        let all = [ruler.first, ruler.head, ruler.tail];
        if !all
            .iter()
            .chain(&ruler.tab_stops)
            .all(|value| points(*value))
        {
            return Err(format!(
                "a ruler's indents and stops are 0 to {MAX_POINTS} points"
            ));
        }
    }
    Ok(())
}

fn validate_draft(draft: Doc) -> Result<Doc, String> {
    validate_document(&draft)?;
    if draft.edited.is_none() {
        return Err("the draft says whether it is edited".into());
    }
    if let Some(file) = &draft.file {
        if !drive_id(&file.id) {
            return Err("the draft's file is a drive file id".into());
        }
        name("the draft's file name", &file.name)?;
    }
    Ok(draft)
}

/// Check the saved files.
fn validate_files(files: Vec<Saved>) -> Result<Vec<Saved>, String> {
    if files.len() > MAX_FILES {
        return Err(format!("at most {MAX_FILES} saved files and folders"));
    }
    let mut chars = 0;
    let mut ids = BTreeSet::new();
    for saved in &files {
        if !document::valid_key(&saved.place) {
            return Err(format!("{:?} is not a place", saved.place));
        }
        if saved.folders.len() > MAX_DEPTH {
            return Err(format!("a file is saved at most {MAX_DEPTH} folders deep"));
        }
        for folder in &saved.folders {
            id("a folder id", folder)?;
        }
        let file = &saved.file;
        id("a file's id", &file.id)?;
        name("a file's name", &file.name)?;
        if let Some(detail) = &file.detail {
            name("a file's detail", detail)?;
        }
        match (file.kind.as_str(), &file.document) {
            ("document", Some(doc)) => {
                validate_document(doc)?;
                if doc.edited.is_some()
                    || doc.unwritten.is_some()
                    || doc.read_only.is_some()
                    || doc.file.is_some()
                {
                    return Err("a saved document has no edited state".into());
                }
                chars += doc
                    .lines
                    .iter()
                    .map(|line| line.chars().count())
                    .sum::<usize>()
                    + doc.html.as_deref().map_or(0, |html| html.chars().count());
            }
            ("folder", None) => {
                // Two folders of one id would be one folder to the demo.
                if !ids.insert(file.id.as_str()) {
                    return Err(format!("folder id {:?} is listed twice", file.id));
                }
            }
            _ => return Err("a file is a document with its text, or a folder".into()),
        }
    }
    if chars > MAX_DOCUMENT_CHARS {
        return Err(format!(
            "the saved documents hold at most {MAX_DOCUMENT_CHARS} characters"
        ));
    }
    Ok(files)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn doc(format: &str) -> Doc {
        Doc {
            name: "Letter".into(),
            format: format.into(),
            lines: vec!["Dear Ada,".into(), String::new()],
            html: None,
            ruler: None,
            properties: None,
            edited: None,
            unwritten: None,
            read_only: None,
            file: None,
        }
    }

    fn saved(kind: &str, id: &str, document: Option<Doc>) -> Saved {
        Saved {
            place: "documents".into(),
            folders: vec![],
            file: File {
                id: id.into(),
                name: id.into(),
                kind: kind.into(),
                detail: None,
                document,
            },
        }
    }

    #[test]
    fn a_draft_round_trips_in_the_demo_s_shape() {
        let text = r#"{"name":"Letter","format":"rich","lines":["Dear Ada,"],"html":"<div><b>Dear Ada,</b></div>","ruler":{"first":0.0,"head":0.0,"tail":0.0,"tabStops":[72.0,144.0]},"edited":true}"#;
        let parsed: Doc = serde_json::from_str(text).unwrap();
        assert!(validate_draft(parsed.clone()).is_ok());
        assert_eq!(serde_json::to_string(&parsed).unwrap(), text);
    }

    #[test]
    fn bad_documents_are_refused() {
        assert!(validate_document(&doc("rich")).is_ok());
        assert!(validate_document(&doc("rtfd")).is_err(), "unknown format");
        let mut empty = doc("plain");
        empty.lines.clear();
        assert!(validate_document(&empty).is_err(), "no lines");
        let mut unnamed = doc("plain");
        unnamed.name = String::new();
        assert!(validate_document(&unnamed).is_err(), "no name");
        let mut formatted = doc("plain");
        formatted.html = Some("<b>x</b>".into());
        assert!(
            validate_document(&formatted).is_err(),
            "plain text with formats"
        );
        let mut long = doc("rich");
        long.lines = vec!["x".repeat(MAX_DOCUMENT_CHARS + 1)];
        assert!(validate_document(&long).is_err(), "too long");
        let mut ruled = doc("rich");
        ruled.ruler = Some(Ruler {
            first: -1.0,
            head: 0.0,
            tail: 0.0,
            tab_stops: vec![],
        });
        assert!(validate_document(&ruled).is_err(), "negative indent");
        assert!(
            validate_draft(doc("rich")).is_err(),
            "a draft says if it is edited"
        );
    }

    #[test]
    fn a_draft_names_its_drive_file_by_a_plain_id() {
        let mut draft = doc("rich");
        draft.edited = Some(false);
        draft.file = Some(FileRef {
            id: "0a1b2c3d4e5f60718293a4b5c6d7e8f9".into(),
            name: "Letter.rtf".into(),
            version: None,
        });
        assert!(validate_draft(draft.clone()).is_ok());
        let text = serde_json::to_string(&draft).unwrap();
        assert!(text
            .ends_with(r#""file":{"id":"0a1b2c3d4e5f60718293a4b5c6d7e8f9","name":"Letter.rtf"}}"#));
        // The version it was read from comes back with it.
        let versioned: Doc = serde_json::from_str(&text.replace(
            r#""name":"Letter.rtf"}"#,
            r#""name":"Letter.rtf","version":4}"#,
        ))
        .unwrap();
        assert_eq!(versioned.file.as_ref().and_then(|f| f.version), Some(4));
        assert!(validate_draft(versioned).is_ok());
        for bad in ["", "../files", "a/b", &"a".repeat(65)] {
            draft.file = Some(FileRef {
                id: bad.into(),
                name: "Letter.rtf".into(),
                version: None,
            });
            assert!(validate_draft(draft.clone()).is_err(), "{bad:?}");
        }
        draft.file = Some(FileRef {
            id: "abc".into(),
            name: String::new(),
            version: None,
        });
        assert!(validate_draft(draft).is_err(), "a file has a name");
        assert!(drive_id("documents") && !drive_id("a.b"));
    }

    #[test]
    fn bad_saved_files_are_refused() {
        let letter = saved("document", "saved-documents/Letter", Some(doc("rich")));
        let folder = saved("folder", "folder-1", None);
        assert!(validate_files(vec![folder.clone(), letter.clone(), letter.clone()]).is_ok());
        assert!(
            validate_files(vec![folder.clone(), folder.clone()]).is_err(),
            "one folder id twice"
        );
        assert!(
            validate_files(vec![saved("document", "x", None)]).is_err(),
            "a document without text"
        );
        assert!(
            validate_files(vec![saved("folder", "x", Some(doc("rich")))]).is_err(),
            "a folder with text"
        );
        let mut elsewhere = letter.clone();
        elsewhere.place = "../documents".into();
        assert!(validate_files(vec![elsewhere]).is_err(), "not a place");
        let mut drafted = letter;
        if let Some(doc) = drafted.file.document.as_mut() {
            doc.edited = Some(true);
        }
        assert!(
            validate_files(vec![drafted]).is_err(),
            "a saved file is not a draft"
        );
    }

    #[test]
    fn the_id_of_a_deep_file_with_a_long_name_fits() {
        let long = "n".repeat(MAX_NAME_CHARS);
        let folders: Vec<String> = (0..MAX_DEPTH).map(|_| "f".repeat(MAX_NAME_CHARS)).collect();
        let mut deep = saved("document", "x", Some(doc("rich")));
        deep.file.id = format!("saved-documents/{}/{long}", folders.join("/"));
        deep.file.name = long;
        deep.folders = folders;
        assert!(validate_files(vec![deep.clone()]).is_ok());
        deep.file.id = "x".repeat(MAX_ID_CHARS + 1);
        assert!(validate_files(vec![deep]).is_err(), "an id too long");
    }
}

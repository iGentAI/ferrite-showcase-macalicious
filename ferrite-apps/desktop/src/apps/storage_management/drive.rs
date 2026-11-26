//! The person's drive as Storage Management reports it: how much of the
//! quota each kind of file takes, the Trash, and every file by size. Read
//! from the files module's `drive` document as stored (`{rev, doc}`), with no
//! I/O, so every rule is tested here.
//!
//! A content is counted once, however many files name it (a copy costs no
//! space, as on APFS, and the drive's own quota counts it once): towards the
//! kind of the first live file that names it, or the Trash when only files
//! in the Trash do. So the kinds add up to exactly the bytes the quota
//! counts. Bytes the drive is still deleting (its garbage) are reported
//! apart, as `freeing`, and the bytes its open uploads have reserved as
//! `reserved`; `available` is what the quota leaves after all three, as the
//! drive admits an upload. The Trash follows the drive's own rule
//! (`Drive::in_trash`): an entry inside a trashed folder is in the Trash at
//! any depth.

use std::collections::{BTreeMap, BTreeSet};

use ferrite_app::serde_json::{self, Value};

use crate::apps::files::drive::{PIECE_BYTES, QUOTA_BYTES as DRIVE_QUOTA_BYTES};

/// The most files listed, the largest first; `files_truncated` says there
/// were more.
pub const MAX_FILES: usize = 500;

/// The kinds of file, in the order the window lists them.
pub const KINDS: &[(&str, &str)] = &[
    ("documents", "Documents"),
    ("photos", "Photos"),
    ("music", "Music"),
    ("movies", "Movies"),
    ("other", "Other Files"),
    ("trash", "Trash"),
];

const DOCUMENT_EXTENSIONS: &[&str] = &[
    "txt", "text", "md", "markdown", "rtf", "rtfd", "pdf", "doc", "docx", "pages", "odt", "csv",
    "tsv", "xls", "xlsx", "numbers", "key", "ppt", "pptx", "epub", "json", "xml", "html", "htm",
    "log",
];

/// The kind of a file: by its media type when that names one, else by its
/// name's extension.
pub fn kind_of(name: &str, mime: &str) -> &'static str {
    let mime = mime.to_ascii_lowercase();
    let ext = name
        .rsplit_once('.')
        .map(|(_, ext)| ext.to_ascii_lowercase())
        .unwrap_or_default();
    kind_by_type(&mime).unwrap_or_else(|| kind_by_extension(&ext))
}

fn kind_by_type(mime: &str) -> Option<&'static str> {
    if mime.starts_with("image/") {
        Some("photos")
    } else if mime.starts_with("audio/") {
        Some("music")
    } else if mime.starts_with("video/") {
        Some("movies")
    } else if mime.starts_with("text/")
        || mime == "application/pdf"
        || mime.contains("document")
        || mime.contains("spreadsheet")
        || mime.contains("presentation")
        || matches!(
            mime,
            "application/rtf" | "application/json" | "application/epub+zip"
        )
    {
        Some("documents")
    } else {
        None
    }
}

fn kind_by_extension(ext: &str) -> &'static str {
    if matches!(
        ext,
        "jpg" | "jpeg" | "png" | "gif" | "heic" | "webp" | "tiff"
    ) {
        "photos"
    } else if matches!(ext, "mp3" | "m4a" | "aac" | "wav" | "flac" | "ogg" | "aiff") {
        "music"
    } else if matches!(ext, "mp4" | "m4v" | "mov" | "webm" | "mkv") {
        "movies"
    } else if DOCUMENT_EXTENSIONS.contains(&ext) {
        "documents"
    } else {
        "other"
    }
}

fn str_of<'v>(value: &'v Value, key: &str) -> &'v str {
    value.get(key).and_then(Value::as_str).unwrap_or("")
}

fn u64_of(value: &Value, key: &str) -> u64 {
    value.get(key).and_then(Value::as_u64).unwrap_or(0)
}

/// Whether a stored document is a drive this report can read: `{rev, doc}`
/// with no document (forgotten), or with its list of entries. Anything else
/// is not an empty drive, and must not be reported as one.
pub fn readable(stored: &Value) -> bool {
    match stored.get("doc") {
        Some(Value::Null) => true,
        Some(doc) => doc.get("entries").is_some_and(Value::is_array),
        None => false,
    }
}

/// The report of a stored drive document; `None` (nothing stored yet) is an
/// empty drive.
pub fn report(stored: Option<&Value>) -> Value {
    let empty = Value::Null;
    let doc = stored.and_then(|s| s.get("doc")).unwrap_or(&empty);
    let entries: &[Value] = doc
        .get("entries")
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or(&[]);
    let by_id: BTreeMap<&str, &Value> = entries.iter().map(|e| (str_of(e, "id"), e)).collect();
    // The drive's own rule (`Drive::in_trash`): a cycle, which no operation makes, counts as
    // gone.
    let trashed = |entry: &Value| -> bool {
        let mut at = Some(entry);
        let mut steps = 0;
        while let Some(current) = at {
            if current.get("trashed_ms").is_some_and(|v| !v.is_null()) {
                return true;
            }
            steps += 1;
            if steps > entries.len() {
                return true;
            }
            at = current
                .get("parent")
                .and_then(Value::as_str)
                .and_then(|p| by_id.get(p).copied());
        }
        false
    };
    let contents: BTreeMap<String, u64> = doc
        .get("contents")
        .and_then(Value::as_object)
        .map(|map| {
            map.iter()
                .map(|(id, c)| (id.clone(), u64_of(c, "size")))
                .collect()
        })
        .unwrap_or_default();
    let used: u64 = contents.values().sum();
    let freeing: u64 = doc
        .get("garbage")
        .and_then(Value::as_array)
        .map(|garbage| {
            garbage
                .iter()
                .map(|g| u64_of(g, "pieces").saturating_sub(u64_of(g, "next")) * PIECE_BYTES)
                .sum()
        })
        .unwrap_or(0);
    let reserved: u64 = doc
        .get("uploads")
        .and_then(Value::as_object)
        .map(|uploads| uploads.values().map(|u| u64_of(u, "size")).sum())
        .unwrap_or(0);

    let files: Vec<&Value> = entries
        .iter()
        .filter(|e| str_of(e, "kind") == "file")
        .collect();
    // Each content counts once: live files first, in the drive's order.
    let mut counted = BTreeSet::new();
    let mut kinds: BTreeMap<&str, (u64, u64)> = BTreeMap::new(); // bytes, files
    let mut trash_items = 0u64;
    for pass_trashed in [false, true] {
        for file in &files {
            let in_trash = trashed(file);
            if in_trash != pass_trashed {
                continue;
            }
            let kind = if in_trash {
                "trash"
            } else {
                kind_of(str_of(file, "name"), str_of(file, "type"))
            };
            let slot = kinds.entry(kind).or_default();
            slot.1 += 1;
            let content = str_of(file, "content");
            if !content.is_empty() && counted.insert(content.to_string()) {
                slot.0 += contents.get(content).copied().unwrap_or(0);
            }
        }
    }
    // Contents no file names now: the versions a save kept.
    let orphaned: u64 = contents
        .iter()
        .filter(|(id, _)| !counted.contains(*id))
        .map(|(_, size)| size)
        .sum();
    if orphaned > 0 {
        kinds.entry("other").or_default().0 += orphaned;
    }
    for entry in entries {
        let top_of_trash = entry.get("trashed_ms").is_some_and(|v| !v.is_null());
        if top_of_trash {
            trash_items += 1;
        }
    }

    let mut listed: Vec<Value> = files
        .iter()
        .map(|file| {
            let in_trash = trashed(file);
            let folder = file
                .get("parent")
                .and_then(Value::as_str)
                .and_then(|p| by_id.get(p))
                .map(|parent| str_of(parent, "name"))
                .unwrap_or("");
            let mut value = serde_json::json!({
                "id": str_of(file, "id"),
                "name": str_of(file, "name"),
                "size": u64_of(file, "size"),
                "type": str_of(file, "type"),
                "kind": if in_trash { "trash" } else { kind_of(str_of(file, "name"), str_of(file, "type")) },
                "folder": folder,
                "modified_ms": u64_of(file, "modified_ms"),
                "trashed": in_trash,
            });
            if let Some(opened) = file.get("opened_ms").and_then(Value::as_u64) {
                value["opened_ms"] = opened.into();
            }
            value
        })
        .collect();
    listed.sort_by(|a, b| u64_of(b, "size").cmp(&u64_of(a, "size")));
    let truncated = listed.len() > MAX_FILES;
    listed.truncate(MAX_FILES);

    let categories: Vec<Value> = KINDS
        .iter()
        .map(|(id, name)| {
            let (bytes, count) = kinds.get(id).copied().unwrap_or_default();
            serde_json::json!({ "id": id, "name": name, "bytes": bytes, "files": count })
        })
        .collect();
    serde_json::json!({
        "quota": DRIVE_QUOTA_BYTES,
        "used": used,
        "freeing": freeing,
        "reserved": reserved,
        "available": DRIVE_QUOTA_BYTES.saturating_sub(used + freeing + reserved),
        "categories": categories,
        "trash": { "bytes": kinds.get("trash").map_or(0, |k| k.0), "items": trash_items },
        "files": listed,
        "files_truncated": truncated,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use ferrite_app::serde_json::json;

    fn category(report: &Value, id: &str) -> (u64, u64) {
        let c = report["categories"]
            .as_array()
            .unwrap()
            .iter()
            .find(|c| c["id"] == id)
            .unwrap();
        (c["bytes"].as_u64().unwrap(), c["files"].as_u64().unwrap())
    }

    #[test]
    fn files_are_counted_by_kind_once_per_content_and_the_kinds_add_up() {
        let stored = json!({"rev": 3, "doc": {
            "entries": [
                {"id": "documents", "name": "Documents", "kind": "folder", "created_ms": 0, "modified_ms": 0},
                {"id": "pictures", "name": "Pictures", "kind": "folder", "created_ms": 0, "modified_ms": 0},
                {"id": "a", "parent": "documents", "name": "Report.pdf", "kind": "file", "type": "application/pdf",
                 "size": 3000, "content": "c1", "created_ms": 0, "modified_ms": 5},
                {"id": "b", "parent": "pictures", "name": "Beach.jpg", "kind": "file", "type": "image/jpeg",
                 "size": 9000, "content": "c2", "created_ms": 0, "modified_ms": 6},
                {"id": "b2", "parent": "documents", "name": "Beach copy.jpg", "kind": "file", "type": "image/jpeg",
                 "size": 9000, "content": "c2", "created_ms": 0, "modified_ms": 6},
                {"id": "t", "parent": "documents", "name": "Old", "kind": "folder", "created_ms": 0,
                 "modified_ms": 0, "trashed_ms": 9},
                {"id": "s", "parent": "t", "name": "song.mp3", "kind": "file", "type": "audio/mpeg",
                 "size": 500, "content": "c3", "created_ms": 0, "modified_ms": 1},
                {"id": "x", "parent": "documents", "name": "data.bin", "kind": "file", "type": "",
                 "size": 70, "content": "c4", "created_ms": 0, "modified_ms": 1, "opened_ms": 4},
            ],
            "contents": {"c1": {"size": 3000, "pieces": 1}, "c2": {"size": 9000, "pieces": 1},
                         "c3": {"size": 500, "pieces": 1}, "c4": {"size": 70, "pieces": 1}},
            "garbage": [{"content": "old", "pieces": 3, "next": 1}],
        }});
        let report = report(Some(&stored));
        assert_eq!(report["used"], 12_570);
        assert_eq!(category(&report, "documents"), (3000, 1));
        assert_eq!(
            category(&report, "photos"),
            (9000, 2),
            "a copy costs nothing more"
        );
        assert_eq!(
            category(&report, "trash"),
            (500, 1),
            "inside a trashed folder"
        );
        assert_eq!(category(&report, "other"), (70, 1));
        let sum: u64 = report["categories"]
            .as_array()
            .unwrap()
            .iter()
            .map(|c| c["bytes"].as_u64().unwrap())
            .sum();
        assert_eq!(
            sum, 12_570,
            "the kinds add up to the bytes the quota counts"
        );
        assert_eq!(report["freeing"], 2 * PIECE_BYTES);
        assert_eq!(
            report["available"],
            DRIVE_QUOTA_BYTES - 12_570 - 2 * PIECE_BYTES
        );
        assert_eq!(report["trash"], json!({"bytes": 500, "items": 1}));
        let files = report["files"].as_array().unwrap();
        assert_eq!(files[0]["size"], 9000, "largest first");
        assert_eq!(files.last().unwrap()["name"], "data.bin");
        assert_eq!(files.last().unwrap()["opened_ms"], 4);
        let song = files.iter().find(|f| f["id"] == "s").unwrap();
        assert_eq!(
            (song["trashed"].clone(), song["folder"].clone()),
            (json!(true), json!("Old"))
        );
    }

    #[test]
    fn open_uploads_take_from_what_is_available_and_the_trash_has_no_depth() {
        // A file 80 folders below a trashed one, and an upload of 1,000 bytes still open.
        let mut entries = vec![
            json!({"id": "f0", "parent": "documents", "name": "f0", "kind": "folder",
            "created_ms": 0, "modified_ms": 0, "trashed_ms": 1}),
        ];
        for n in 1..=80 {
            entries.push(
                json!({"id": format!("f{n}"), "parent": format!("f{}", n - 1),
                "name": format!("f{n}"), "kind": "folder", "created_ms": 0, "modified_ms": 0}),
            );
        }
        entries.push(
            json!({"id": "deep", "parent": "f80", "name": "deep.txt", "kind": "file",
            "type": "text/plain", "size": 10, "content": "c1", "created_ms": 0, "modified_ms": 0}),
        );
        let stored = json!({"rev": 1, "doc": {
            "entries": entries,
            "contents": {"c1": {"size": 10, "pieces": 1}},
            "uploads": {"u1": {"parent": "documents", "name": "big.mov", "type": "video/quicktime",
                "size": 1000, "content": "c9", "pieces": 1}},
        }});
        let report = report(Some(&stored));
        assert_eq!(category(&report, "trash"), (10, 1), "however deep");
        assert_eq!(report["reserved"], 1000);
        assert_eq!(report["available"], DRIVE_QUOTA_BYTES - 10 - 1000);
        // A cycle, which no operation makes, counts as gone, as the drive counts it.
        let cycle = json!({"rev": 1, "doc": {"entries": [
            {"id": "a", "parent": "b", "name": "a", "kind": "folder", "created_ms": 0, "modified_ms": 0},
            {"id": "b", "parent": "a", "name": "b", "kind": "folder", "created_ms": 0, "modified_ms": 0},
            {"id": "x", "parent": "a", "name": "x.txt", "kind": "file", "size": 3, "content": "c",
             "created_ms": 0, "modified_ms": 0},
        ], "contents": {"c": {"size": 3, "pieces": 1}}}});
        assert_eq!(category(&super::report(Some(&cycle)), "trash"), (3, 1));
    }

    #[test]
    fn a_drive_of_the_wrong_shape_is_not_readable() {
        assert!(readable(&json!({"rev": 3, "doc": null})));
        assert!(readable(&json!({"rev": 3, "doc": {"entries": []}})));
        assert!(!readable(&json!({"rev": 3, "doc": {"entries": 7}})));
        assert!(!readable(&json!({"rev": 3, "doc": {}})));
        assert!(!readable(&json!({})));
        assert!(!readable(&json!({"unexpected": true})));
        assert!(!readable(&json!("not a drive")));
    }

    #[test]
    fn nothing_stored_is_an_empty_drive() {
        let report = report(None);
        assert_eq!(report["used"], 0);
        assert_eq!(report["available"], DRIVE_QUOTA_BYTES);
        assert_eq!(report["files"], json!([]));
        assert_eq!(report["categories"].as_array().unwrap().len(), KINDS.len());
    }

    #[test]
    fn kinds_follow_the_type_then_the_name() {
        assert_eq!(kind_of("a", "image/png"), "photos");
        assert_eq!(kind_of("a.MOV", ""), "movies");
        assert_eq!(kind_of("a.flac", "application/octet-stream"), "music");
        assert_eq!(kind_of("Budget.xlsx", ""), "documents");
        assert_eq!(
            kind_of(
                "a",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ),
            "documents"
        );
        assert_eq!(kind_of("archive.zip", "application/zip"), "other");
    }
}

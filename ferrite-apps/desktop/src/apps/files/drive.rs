//! The drive's model: one person's folders and files as one document, and the
//! operations that change it. Nothing here does I/O, so every rule is tested
//! on its own (`mod.rs` reads, changes and writes the document).
//!
//! * An entry is a folder or a file. Six folders always exist and cannot be
//!   renamed, moved or trashed: Desktop, Documents, Downloads, Movies, Music
//!   and Pictures, the folders of a Catalina home folder. They have no parent.
//! * A file names its bytes by a `content` id. The bytes are blob objects of
//!   [`PIECE_BYTES`] each (`mod.rs`), recorded once in [`Drive::contents`]. A
//!   copy is a new entry that names the same content, so copying is instant
//!   and costs no space, as a clone does on APFS. Content no entry names any
//!   more moves to [`Drive::garbage`], the drive's pending deletions, whose
//!   pieces each request's bounded sweep deletes a few at a time (`mod.rs`).
//!   Bytes still waiting there count against the quota when an upload opens,
//!   so freed space comes back only as it is really deleted, and their number
//!   is capped at [`MAX_PENDING_DELETIONS`].
//! * The Trash is not a folder: a trashed entry keeps its parent (where Put
//!   Back returns it) and carries `trashed_ms`. Everything inside a trashed
//!   folder is in the Trash with it.
//! * Names are unique among the live entries of a folder, and among the
//!   entries at the top of the Trash, ignoring case, as on APFS.
//! * Quota: the bytes of every content, trashed files included, at most
//!   [`QUOTA_BYTES`]. At most [`MAX_ENTRIES`] entries.
//! * Kept versions: a save in place leaves the bytes it replaced named by a
//!   [`KeptVersion`] of the file ([`Drive::versions`]) instead of sending them
//!   to the garbage. They count in the usage like any content, are never
//!   listed as entries, and go when the file is erased. They are the first
//!   thing to give way: the oldest are dropped whenever anything else needs
//!   the quota, a place among the items or room in this document, so a kept
//!   version never refuses a save or an upload. A burst of saves keeps about
//!   one version per [`VERSION_SPACING_MS`] unless a save is marked `saved`
//!   (File > Save), since autosave writes in place after every pause in typing.

use std::collections::{BTreeMap, BTreeSet};

use ferrite_app::{serde, serde_json};

/// The bytes of one piece: one upload request's body and one blob object.
/// Under the gateway's 262,144-byte request cap with room to spare.
pub const PIECE_BYTES: u64 = 192 * 1024;
/// The largest file.
pub const MAX_FILE_BYTES: u64 = 64 * 1024 * 1024;
/// The most bytes one person's files take.
pub const QUOTA_BYTES: u64 = 128 * 1024 * 1024;
/// The most entries one drive holds, trashed ones included.
pub const MAX_ENTRIES: usize = 1000;
/// The longest name, in bytes.
pub const MAX_NAME_BYTES: usize = 255;
const MAX_TAGS: usize = 8;
const MAX_TAG_BYTES: usize = 32;
const MAX_COMMENT_BYTES: usize = 4096;
const MAX_TYPE_BYTES: usize = 127;
/// How long the drive remembers a finished request, to answer a resend of it
/// with what it did the first time. The browser's resends all come within a
/// minute; nothing younger is ever forgotten.
pub const REMEMBER_MS: u64 = 60 * 60 * 1000;
/// Finished requests the drive remembers at most. A keyed request that
/// finds the list full of records younger than [`REMEMBER_MS`] is refused
/// (429, retry), never let to push out a record a resend may still need.
pub const DONE_KEPT: usize = 512;

/// The folders every drive has: `(id, name)`.
pub const SPECIAL: [(&str, &str); 6] = [
    ("desktop", "Desktop"),
    ("documents", "Documents"),
    ("downloads", "Downloads"),
    ("movies", "Movies"),
    ("music", "Music"),
    ("pictures", "Pictures"),
];

/// Where Put Back puts an entry whose folder is gone.
const RESTORE_FALLBACK: &str = "desktop";

/// Kept versions of one file at most: the oldest go first.
pub const VERSIONS_PER_FILE: usize = 20;
/// Kept versions of one drive at most, and never more than the places
/// [`MAX_ENTRIES`] leaves: every content can become one pending deletion at
/// once, and items and versions together stay under [`MAX_PENDING_DELETIONS`],
/// so emptying the Trash can always be done.
pub const VERSIONS_PER_DRIVE: usize = 200;
/// A version not marked `saved` is replaced by the next one until it stands this far from the
/// version before it: without this an hour of autosave would leave only its last 20 pauses.
pub const VERSION_SPACING_MS: u64 = 5 * 60 * 1000;
/// The drive document's JSON size past which versions go: the store keeps a value up to 200 KB,
/// and the folder tree and the finished requests come first.
const VERSIONS_DOCUMENT_BYTES: usize = 160_000;
/// The fewest bytes of the document one kept version takes.
const KEPT_VERSION_BYTES: usize = 130;

#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum Kind {
    Folder,
    File,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Entry {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent: Option<String>,
    pub name: String,
    pub kind: Kind,
    #[serde(default)]
    pub size: u64,
    /// The file's media type, as the browser gave it.
    #[serde(default, rename = "type", skip_serializing_if = "String::is_empty")]
    pub mime: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    pub created_ms: u64,
    pub modified_ms: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub opened_ms: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub trashed_ms: Option<u64>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
    /// What Get Info keeps of the entry.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub comment: String,
    /// A locked entry cannot be renamed, moved, sent to the Trash, deleted or saved over.
    #[serde(default, skip_serializing_if = "is_false")]
    pub locked: bool,
    #[serde(default, skip_serializing_if = "is_false")]
    pub hide_extension: bool,
    #[serde(default, skip_serializing_if = "is_false")]
    pub stationery: bool,
    /// How many times the file's bytes were saved over in place: the version an in-place save
    /// says it was made from ([`OpenUpload::base`]) and the version each piece of a read names.
    #[serde(default)]
    pub version: u64,
}

impl Entry {
    fn folder(id: &str, parent: Option<&str>, name: &str, now_ms: u64) -> Entry {
        Entry {
            id: id.to_string(),
            parent: parent.map(str::to_string),
            name: name.to_string(),
            kind: Kind::Folder,
            size: 0,
            mime: String::new(),
            content: None,
            created_ms: now_ms,
            modified_ms: now_ms,
            opened_ms: None,
            trashed_ms: None,
            tags: Vec::new(),
            comment: String::new(),
            locked: false,
            hide_extension: false,
            stationery: false,
            version: 0,
        }
    }
}

fn is_false(value: &bool) -> bool {
    !*value
}

/// The bytes of one content: its size and how many pieces hold it.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Content {
    pub size: u64,
    pub pieces: u32,
}

/// A content no entry names: pieces `next..pieces` are still to be deleted,
/// from `not_before_ms` on.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Garbage {
    pub content: String,
    pub pieces: u32,
    pub next: u32,
    #[serde(default)]
    pub not_before_ms: u64,
}

/// A finished request, by the browser's key: the entries it created.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Done {
    pub key: String,
    #[serde(default)]
    pub created: Vec<String>,
    /// When it finished (platform epoch ms).
    #[serde(default)]
    pub at_ms: u64,
    /// The version it left the first entry it created or saved at, when that
    /// is a file: a resent completion answers the version its upload made,
    /// not the one the file has since.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<u64>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Default)]
#[serde(crate = "ferrite_app::serde")]
pub struct Drive {
    pub entries: Vec<Entry>,
    #[serde(default)]
    pub contents: BTreeMap<String, Content>,
    #[serde(default)]
    pub garbage: Vec<Garbage>,
    #[serde(default)]
    pub done: Vec<Done>,
    /// Open uploads, by id. Kept in the drive document so that opening,
    /// completing and giving one up are each one compare-and-set of it.
    #[serde(default)]
    pub uploads: BTreeMap<String, OpenUpload>,
    /// The bytes earlier saves of a file replaced, by file id, oldest first. Absent on a drive
    /// with none, as on every drive stored before versions were kept.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub versions: BTreeMap<String, Vec<KeptVersion>>,
}

/// Bytes a file held before a save replaced them. They stay in [`Drive::contents`] as long as
/// this names them.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct KeptVersion {
    /// The file's `version` when it held these bytes: what the routes call this one by.
    pub version: u64,
    pub content: String,
    pub size: u64,
    #[serde(default, rename = "type", skip_serializing_if = "String::is_empty")]
    pub mime: String,
    /// When these bytes were written.
    pub modified_ms: u64,
    /// Asked for by the person (File > Save, or the bytes a restore replaced), not left by
    /// autosave.
    #[serde(default, skip_serializing_if = "is_false")]
    pub saved: bool,
}

/// Uploads one drive may have open at once.
pub const MAX_OPEN_UPLOADS: usize = 8;
/// Pending deletions, together with the open uploads (each may yet become
/// one), a drive may hold: a change that would pass it is refused until each
/// request's sweep has worked the list down.
pub const MAX_PENDING_DELETIONS: usize = 1024;
/// How long the pieces of an upload given up wait before they are deleted:
/// well past the time a request may take, so that a piece write that was
/// already under way has landed and is deleted too.
pub const UPLOAD_GRACE_MS: u64 = 60_000;

/// An upload in progress. Its pieces are blob objects of `content`, which no
/// file names until the upload completes. Its size is reserved against the
/// quota from the start, so staged pieces never pass the quota.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct OpenUpload {
    pub parent: String,
    pub name: String,
    #[serde(rename = "type")]
    pub mime: String,
    pub size: u64,
    pub content: String,
    pub pieces: u32,
    pub existing: ExistingText,
    pub expires_ms: u64,
    /// With `existing: replace`, the id of the file the person chose to
    /// replace: the upload completes only while that very file has the name.
    /// With `existing: overwrite`, the id of the file whose bytes it becomes.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub replaces: Option<String>,
    /// With `existing: overwrite`, the file's `version` the save was made from: it opens and
    /// completes only while the file still has that version (412 otherwise), so a save never
    /// writes over a change it did not see. Absent, it writes over whatever the file holds.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub base: Option<u64>,
}

/// [`Existing`] as an upload keeps it; an upload never reuses a file.
/// `Overwrite` is an upload's own: the bytes become the new content of the
/// file `replaces` names, which keeps its id, name, folder, tags and dates
/// but the modification time (a document saved in place by its app).
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum ExistingText {
    Rename,
    Replace,
    Fail,
    Overwrite,
}

// Written out rather than `#[default]`: the hosted code gate admits no
// unreviewed attribute there (CODE_MACRO_OPAQUE).
impl Default for ExistingText {
    fn default() -> Self {
        ExistingText::Rename
    }
}

impl From<ExistingText> for Existing {
    fn from(value: ExistingText) -> Self {
        match value {
            ExistingText::Rename => Existing::Rename,
            ExistingText::Replace => Existing::Replace,
            // An overwrite never adds a file; were it ever to, it would
            // take no name another item has.
            ExistingText::Fail | ExistingText::Overwrite => Existing::Fail,
        }
    }
}

/// What to do when the folder already has an item of the name.
#[derive(serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum Existing {
    /// Take the next free name: `Budget 2.txt`.
    Rename,
    /// Move the item that has the name to the Trash.
    Replace,
    /// Refuse.
    Fail,
    /// New Folder only: answer the folder that has the name.
    Reuse,
}

impl Default for Existing {
    fn default() -> Self {
        Existing::Rename
    }
}

/// One change to the drive (`POST /api/files/ops`).
#[derive(serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", tag = "op", rename_all = "kebab-case")]
pub enum Op {
    Mkdir {
        parent: String,
        name: String,
        #[serde(default)]
        existing: Existing,
    },
    Rename {
        id: String,
        name: String,
    },
    Move {
        id: String,
        parent: String,
        #[serde(default)]
        name: Option<String>,
        #[serde(default)]
        existing: Existing,
    },
    Copy {
        id: String,
        parent: String,
        #[serde(default)]
        name: Option<String>,
        #[serde(default)]
        existing: Existing,
        /// Dates the copy, and all in it, now: as `cp` does, where Finder's copy keeps the date.
        #[serde(default)]
        dated_now: bool,
    },
    Trash {
        id: String,
    },
    Restore {
        id: String,
    },
    Delete {
        id: String,
    },
    EmptyTrash,
    Tag {
        id: String,
        tags: Vec<String>,
    },
    Opened {
        id: String,
    },
    /// What Get Info changes; what is left out stays as it is.
    Info {
        id: String,
        #[serde(default)]
        comment: Option<String>,
        #[serde(default)]
        locked: Option<bool>,
        #[serde(default)]
        hide_extension: Option<bool>,
        #[serde(default)]
        stationery: Option<bool>,
    },
}

/// Why a change was refused.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OpError {
    /// The request itself is wrong (400).
    Invalid(String),
    /// It names an entry the drive does not have (404).
    Missing(String),
    /// The drive's state does not allow it (409).
    Conflict(String),
    /// The quota or the entry limit would be passed (507).
    Full(String),
    /// A file over the largest size (413).
    TooLarge(String),
    /// Too many uploads open at once (429).
    Busy(String),
    /// An in-place save made from a version of the file that is no longer its own (412).
    Stale(String),
}

impl OpError {
    pub fn status(&self) -> u16 {
        match self {
            OpError::Invalid(_) => 400,
            OpError::Missing(_) => 404,
            OpError::Conflict(_) => 409,
            OpError::Full(_) => 507,
            OpError::TooLarge(_) => 413,
            OpError::Busy(_) => 429,
            OpError::Stale(_) => 412,
        }
    }

    pub fn message(&self) -> &str {
        match self {
            OpError::Invalid(m)
            | OpError::Missing(m)
            | OpError::Conflict(m)
            | OpError::Full(m)
            | OpError::TooLarge(m)
            | OpError::Busy(m)
            | OpError::Stale(m) => m,
        }
    }
}

/// Refuses an in-place save made from `base` when the file `entry` has another version now.
fn unchanged_since(entry: &Entry, base: Option<u64>) -> Result<(), OpError> {
    match base {
        Some(base) if base != entry.version => Err(OpError::Stale(format!(
            "“{}” was changed elsewhere since it was opened or saved",
            entry.name
        ))),
        _ => Ok(()),
    }
}

/// Whether two names are the same name, ignoring case.
fn same_name(a: &str, b: &str) -> bool {
    a.to_lowercase() == b.to_lowercase()
}

/// Whether `id` is one of the six folders every drive has.
pub fn is_special(id: &str) -> bool {
    SPECIAL.iter().any(|(special, _)| *special == id)
}

/// A name a folder can hold: 1 to 255 bytes, not `.` or `..`, without `/`
/// or control characters.
pub fn check_name(name: &str) -> Result<(), OpError> {
    if name.is_empty() || name.len() > MAX_NAME_BYTES {
        return Err(OpError::Invalid(format!(
            "a name is 1 to {MAX_NAME_BYTES} bytes"
        )));
    }
    if name == "." || name == ".." || name.contains('/') || name.chars().any(char::is_control) {
        return Err(OpError::Invalid(format!(
            "“{name}” cannot be used as a name"
        )));
    }
    Ok(())
}

/// A media type as stored: `type/subtype` in lowercase, or empty for one
/// that is not of that form.
pub fn clean_type(mime: &str) -> String {
    let mime = mime
        .split(';')
        .next()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    let ok = mime.len() <= MAX_TYPE_BYTES
        && mime.split_once('/').is_some_and(|(a, b)| {
            let part = |s: &str| {
                !s.is_empty()
                    && s.bytes()
                        .all(|c| c.is_ascii_alphanumeric() || b"!#$&-^_.+".contains(&c))
            };
            part(a) && part(b)
        });
    if ok {
        mime
    } else {
        String::new()
    }
}

/// The number of pieces that hold `size` bytes.
pub fn pieces_for(size: u64) -> u32 {
    u32::try_from(size.div_ceil(PIECE_BYTES)).unwrap_or(u32::MAX)
}

/// `name`, or the first of `name 2`, `name 3`... that `taken` refuses not.
/// The number goes before a file's extension. A name that would grow past
/// [`MAX_NAME_BYTES`] loses characters from its stem, and an extension too
/// long to leave room for the number counts as part of the stem.
pub fn unique_name(taken: impl Fn(&str) -> bool, name: &str, folder: bool) -> String {
    if !taken(name) {
        return name.to_string();
    }
    let dot = if folder {
        None
    } else {
        name.rfind('.')
            .filter(|&at| at > 0 && name.len() - at <= MAX_NAME_BYTES / 2)
    };
    let (stem, extension) = match dot {
        Some(at) => (&name[..at], &name[at..]),
        None => (name, ""),
    };
    let mut count = 2u32;
    loop {
        let suffix = format!(" {count}{extension}");
        let mut keep = stem.len().min(MAX_NAME_BYTES.saturating_sub(suffix.len()));
        while !stem.is_char_boundary(keep) {
            keep -= 1;
        }
        let candidate = format!("{}{suffix}", &stem[..keep]);
        if !taken(&candidate) {
            return candidate;
        }
        count += 1;
    }
}

/// Why a locked entry is refused.
fn locked_error(entry: &Entry) -> OpError {
    OpError::Conflict(format!("“{}” is locked", entry.name))
}

fn check_tags(tags: &[String]) -> Result<Vec<String>, OpError> {
    let mut kept: Vec<String> = Vec::new();
    for tag in tags {
        if tag.is_empty() || tag.len() > MAX_TAG_BYTES || tag.chars().any(char::is_control) {
            return Err(OpError::Invalid(format!(
                "a tag is 1 to {MAX_TAG_BYTES} bytes without control characters"
            )));
        }
        if !kept.iter().any(|t| t == tag) {
            kept.push(tag.clone());
        }
    }
    if kept.len() > MAX_TAGS {
        return Err(OpError::Invalid(format!(
            "an item has at most {MAX_TAGS} tags"
        )));
    }
    Ok(kept)
}

impl Drive {
    /// A drive with only the six folders.
    #[cfg(test)]
    pub fn fresh(now_ms: u64) -> Drive {
        let mut drive = Drive::default();
        drive.ensure_special(now_ms);
        drive
    }

    /// Adds any of the six folders the drive lacks.
    pub fn ensure_special(&mut self, now_ms: u64) {
        for (at, (id, name)) in SPECIAL.iter().enumerate() {
            if !self.entries.iter().any(|e| e.id == *id) {
                let at = at.min(self.entries.len());
                self.entries
                    .insert(at, Entry::folder(id, None, name, now_ms));
            }
        }
    }

    /// The bytes the drive's files take.
    pub fn usage(&self) -> u64 {
        self.contents.values().map(|c| c.size).sum()
    }

    /// The bytes the open uploads have reserved.
    pub fn reserved(&self) -> u64 {
        self.uploads.values().map(|u| u.size).sum()
    }

    /// The bytes the pending deletions may still hold: every piece not yet
    /// deleted, counted whole.
    pub fn pending(&self) -> u64 {
        self.garbage
            .iter()
            .map(|g| u64::from(g.pieces.saturating_sub(g.next)) * PIECE_BYTES)
            .sum()
    }

    /// Gives up every upload that expired: its pieces, whichever arrived,
    /// go to the garbage.
    pub fn sweep(&mut self, now_ms: u64) {
        let expired: Vec<String> = self
            .uploads
            .iter()
            .filter(|(_, u)| u.expires_ms <= now_ms)
            .map(|(id, _)| id.clone())
            .collect();
        for id in expired {
            self.drop_upload(&id, now_ms);
        }
    }

    /// Removes the upload `id`, sending every piece key it could have
    /// written, arrived or not, to the garbage. They are deleted no sooner
    /// than [`UPLOAD_GRACE_MS`] from now, after any piece write still in
    /// flight has landed. Answers whether it was open.
    pub fn drop_upload(&mut self, id: &str, now_ms: u64) -> bool {
        let Some(upload) = self.uploads.remove(id) else {
            return false;
        };
        if upload.pieces > 0 {
            self.garbage.push(Garbage {
                content: upload.content,
                pieces: upload.pieces,
                next: 0,
                not_before_ms: now_ms + UPLOAD_GRACE_MS,
            });
        }
        true
    }

    /// Opens an upload: checks the folder, the name, the size, the quota
    /// (files, what open uploads reserved, and the bytes still waiting
    /// deletion), the pending deletions and the number open. The caller
    /// sweeps expired uploads first.
    pub fn open_upload(&mut self, id: String, upload: OpenUpload) -> Result<(), OpError> {
        self.live_folder(&upload.parent)?;
        check_name(&upload.name)?;
        if upload.size > MAX_FILE_BYTES {
            return Err(OpError::TooLarge(format!(
                "a file is at most {} MB",
                MAX_FILE_BYTES / 1_000_000
            )));
        }
        if matches!(
            upload.existing,
            ExistingText::Replace | ExistingText::Overwrite
        ) && upload.replaces.is_none()
        {
            return Err(OpError::Invalid(
                "a replacing upload names the file it replaces".into(),
            ));
        }
        if upload.existing == ExistingText::Overwrite {
            let target = self.overwritable(upload.replaces.as_deref().unwrap_or_default())?;
            unchanged_since(target, upload.base)?;
        }
        if self.uploads.len() >= MAX_OPEN_UPLOADS {
            return Err(OpError::Busy(format!(
                "at most {MAX_OPEN_UPLOADS} uploads at once; finish or cancel one"
            )));
        }
        self.free_versions_for(&upload);
        // An in-place save's completion releases the content it replaces, so that content is not
        // counted twice: a same-size save on a full drive still fits. The credit is the saves'
        // own and never goes below nothing: an ordinary upload never borrows what a pending
        // save in place would free (`reserved_with`).
        let committed = self.usage() + self.reserved_with(&upload);
        if committed > QUOTA_BYTES {
            return Err(OpError::Full(format!(
                "the file does not fit: a drive holds {} MB",
                QUOTA_BYTES / 1_000_000
            )));
        }
        // It fits once the deleted files are gone, and every request deletes
        // a few more: a retry a moment later succeeds.
        if committed + self.pending() > QUOTA_BYTES
            || self.garbage.len() + self.uploads.len() + 1 > MAX_PENDING_DELETIONS
        {
            return Err(OpError::Busy(
                "deleted files are still being cleared from the drive; try again in a moment"
                    .into(),
            ));
        }
        self.uploads.insert(id, upload);
        Ok(())
    }

    /// Completes the open upload `id` as the file `file_id`. The upload
    /// leaves the registry in the same change that makes the file, so nothing
    /// can give its pieces up once a file names them. A file the drive
    /// refuses (a name taken with `fail`, the entry limit) gives the upload up
    /// instead, and its pieces go to the garbage. A replacing upload replaces
    /// only a file, and only the file it names in `replaces` when it names
    /// one: a folder of the name, or another file there now, refuses it.
    pub fn complete_upload(
        &mut self,
        id: &str,
        now_ms: u64,
        file_id: String,
    ) -> Result<String, OpError> {
        let Some(upload) = self.uploads.get(id).cloned() else {
            return Err(OpError::Missing("no such upload".into()));
        };
        if upload.existing == ExistingText::Overwrite {
            let target = upload.replaces.clone().unwrap_or_default();
            return match self.overwrite(&upload, &target, id, now_ms) {
                Ok(trial) => {
                    *self = trial;
                    Ok(target)
                }
                Err(error) => {
                    self.drop_upload(id, now_ms);
                    Err(error)
                }
            };
        }
        if upload.existing == ExistingText::Replace {
            let occupant = self
                .sibling(&upload.parent, &upload.name, None)
                .map(|e| (e.id.clone(), e.kind == Kind::Folder));
            let refusal = match (&occupant, &upload.replaces) {
                (Some((_, true)), _) => Some(format!(
                    "“{}” is a folder; a file never replaces a folder",
                    upload.name
                )),
                (Some((there, false)), Some(chosen)) if there != chosen => Some(format!(
                    "“{}” changed since you chose to replace it; save again",
                    upload.name
                )),
                (None, Some(_)) => Some(format!(
                    "“{}” is no longer there to replace; save again",
                    upload.name
                )),
                (Some((_, false)), None) => Some(format!(
                    "“{}” is there; a replacing upload names the file it replaces",
                    upload.name
                )),
                _ => None,
            };
            if let Some(message) = refusal {
                self.drop_upload(id, now_ms);
                return Err(OpError::Conflict(message));
            }
        }
        let mut trial = self.clone();
        trial.uploads.remove(id);
        match trial.add_file(
            &upload.parent,
            &upload.name,
            &upload.mime,
            upload.size,
            &upload.content,
            upload.existing.into(),
            now_ms,
            file_id,
        ) {
            Ok(made) => {
                *self = trial;
                Ok(made)
            }
            Err(error) => {
                self.drop_upload(id, now_ms);
                Err(error)
            }
        }
    }

    /// The bytes the open uploads and `next` reserve against the quota. An ordinary upload
    /// reserves its size. The saves in place of one file together reserve their sizes less the
    /// content that file frees when saved over, never less than nothing, so the credit only ever
    /// covers those saves themselves.
    fn reserved_with(&self, next: &OpenUpload) -> u64 {
        let mut plain = 0;
        let mut by_target: BTreeMap<&str, u64> = BTreeMap::new();
        for open in self.uploads.values().chain(std::iter::once(next)) {
            match (open.existing, open.replaces.as_deref()) {
                (ExistingText::Overwrite, Some(target)) => {
                    *by_target.entry(target).or_default() += open.size;
                }
                _ => plain += open.size,
            }
        }
        plain
            + by_target
                .iter()
                .map(|(target, size)| size.saturating_sub(self.released_by_overwrite(target)))
                .sum::<u64>()
    }

    /// The bytes a save in place of the file `id` frees when it completes: its content's size,
    /// when no other file shares that content; otherwise nothing.
    fn released_by_overwrite(&self, id: &str) -> u64 {
        let Some(content) = self.find(id).and_then(|entry| entry.content.as_deref()) else {
            return 0;
        };
        let shared = self
            .entries
            .iter()
            .any(|entry| entry.id != id && entry.content.as_deref() == Some(content));
        if shared {
            return 0;
        }
        self.contents.get(content).map_or(0, |c| c.size)
    }

    /// The file `id`, if an upload may overwrite it: a file outside the
    /// Trash.
    fn overwritable(&self, id: &str) -> Result<&Entry, OpError> {
        let entry = self.get(id)?;
        if entry.locked {
            return Err(locked_error(entry));
        }
        if entry.kind != Kind::File {
            return Err(OpError::Conflict(format!(
                "“{}” is a folder; only a file is saved over",
                entry.name
            )));
        }
        if self.in_trash(id) {
            return Err(OpError::Conflict(format!(
                "“{}” is in the Trash; save it somewhere else",
                entry.name
            )));
        }
        Ok(entry)
    }

    /// The drive once the open upload `upload_id` has become the content of
    /// the file `target`: the file keeps its id, name, folder, tags and
    /// creation time, and its old bytes go to the garbage unless another
    /// entry (a copy) still names them. Checks the quota and the limits.
    fn overwrite(
        &self,
        upload: &OpenUpload,
        target: &str,
        upload_id: &str,
        now_ms: u64,
    ) -> Result<Drive, OpError> {
        let file = self.overwritable(target)?;
        unchanged_since(file, upload.base)?;
        let parent = file.parent.clone();
        let mut trial = self.clone();
        trial.uploads.remove(upload_id);
        trial.keep_current(target, false);
        trial.contents.insert(
            upload.content.clone(),
            Content {
                size: upload.size,
                pieces: pieces_for(upload.size),
            },
        );
        if let Some(entry) = trial.find_mut(target) {
            entry.content = Some(upload.content.clone());
            entry.size = upload.size;
            entry.mime = upload.mime.clone();
            entry.modified_ms = now_ms;
            entry.version = entry.version.saturating_add(1);
        }
        if let Some(parent) = parent {
            trial.touch(&parent, now_ms);
        }
        trial.collect();
        trial.make_room(0);
        if trial.usage() > QUOTA_BYTES {
            return Err(OpError::Full(format!(
                "the file does not fit: a drive holds {} MB",
                QUOTA_BYTES / 1_000_000
            )));
        }
        trial.check_limits()?;
        Ok(trial)
    }

    /// Keeps the bytes the file `id` holds now as one of its versions. Bytes it already keeps get
    /// no second record, so this can run twice. The last version gives way when it stands less
    /// than [`VERSION_SPACING_MS`] from the one before it and was not asked for.
    fn keep_current(&mut self, id: &str, saved: bool) {
        let Some(entry) = self.find(id) else {
            return;
        };
        let Some(content) = entry.content.clone() else {
            return;
        };
        let record = KeptVersion {
            version: entry.version,
            content,
            size: entry.size,
            mime: entry.mime.clone(),
            modified_ms: entry.modified_ms,
            saved,
        };
        let list = self.versions.entry(id.to_string()).or_default();
        if let Some(same) = list.iter_mut().find(|kept| kept.content == record.content) {
            same.saved |= saved;
            return;
        }
        if let [.., before, last] = list.as_slice() {
            if !last.saved
                && last.modified_ms.saturating_sub(before.modified_ms) < VERSION_SPACING_MS
            {
                list.pop();
            }
        }
        list.push(record);
        let over = list.len().saturating_sub(VERSIONS_PER_FILE);
        list.drain(..over);
    }

    /// How many versions the drive keeps.
    fn versions_kept(&self) -> usize {
        self.versions.values().map(Vec::len).sum()
    }

    /// Drops the `count` oldest versions of the whole drive. Their bytes leave at the next
    /// [`Drive::release_unnamed`].
    fn drop_oldest_versions(&mut self, count: usize) {
        if count == 0 {
            return;
        }
        let mut all: Vec<(u64, String, u64)> = self
            .versions
            .iter()
            .flat_map(|(id, list)| {
                list.iter()
                    .map(move |kept| (kept.modified_ms, id.clone(), kept.version))
            })
            .collect();
        all.sort_unstable();
        for (_, id, version) in all.into_iter().take(count) {
            if let Some(list) = self.versions.get_mut(&id) {
                list.retain(|kept| kept.version != version);
            }
        }
        self.versions.retain(|_, list| !list.is_empty());
    }

    /// Drops the oldest versions until `extra` more bytes fit the quota, or no version is left.
    fn make_room(&mut self, extra: u64) {
        while self.usage() + extra > QUOTA_BYTES && self.versions_kept() > 0 {
            self.drop_oldest_versions(1);
            self.release_unnamed();
        }
    }

    /// Drops the oldest versions until `upload` fits the quota. An upload that would not fit
    /// without any version drops none: it is refused, and the person keeps them.
    fn free_versions_for(&mut self, upload: &OpenUpload) {
        if self.usage() + self.reserved_with(upload) <= QUOTA_BYTES || self.versions_kept() == 0 {
            return;
        }
        let mut trial = self.clone();
        while trial.usage() + trial.reserved_with(upload) > QUOTA_BYTES && trial.versions_kept() > 0
        {
            trial.drop_oldest_versions(1);
            trial.release_unnamed();
        }
        if trial.usage() + trial.reserved_with(upload) <= QUOTA_BYTES {
            *self = trial;
        }
    }

    /// Makes the kept version `version` the file's current bytes: the bytes it replaces are kept
    /// as a version, and it stays listed by its own number. No byte is written, so this is one
    /// change of the document, and with those bytes current already it does nothing: run twice,
    /// it ends the same. `base` is the file's version the person chose from (412 otherwise).
    pub fn restore_version(
        &mut self,
        id: &str,
        version: u64,
        base: Option<u64>,
        now_ms: u64,
    ) -> Result<(), OpError> {
        let file = self.overwritable(id)?;
        let Some(chosen) = self.kept_version(id, version).cloned() else {
            return Err(OpError::Missing(format!(
                "“{}” keeps no such version",
                file.name
            )));
        };
        if file.content.as_deref() == Some(chosen.content.as_str()) {
            return Ok(());
        }
        unchanged_since(file, base)?;
        let parent = file.parent.clone();
        if let Some(list) = self.versions.get_mut(id) {
            for kept in list.iter_mut().filter(|kept| kept.version == version) {
                kept.saved = true;
            }
        }
        self.keep_current(id, true);
        if let Some(list) = self.versions.get_mut(id) {
            // It was the oldest of a full list: it stays, and the next oldest goes in its place.
            if !list.iter().any(|kept| kept.version == version) {
                list.insert(
                    0,
                    KeptVersion {
                        saved: true,
                        ..chosen.clone()
                    },
                );
                list.remove(1);
            }
        }
        if let Some(entry) = self.find_mut(id) {
            entry.content = Some(chosen.content);
            entry.size = chosen.size;
            entry.mime = chosen.mime;
            entry.modified_ms = now_ms;
            entry.version = entry.version.saturating_add(1);
        }
        if let Some(parent) = parent {
            self.touch(&parent, now_ms);
        }
        self.collect();
        self.check_limits()
    }

    /// Keeps the bytes the file `id` holds now as a version the person asked for (File > Save),
    /// for the next autosave to leave standing. `version` is the file's version those bytes are
    /// (412 otherwise). Run twice, it ends the same.
    pub fn keep_version(&mut self, id: &str, version: Option<u64>) -> Result<(), OpError> {
        let file = self.get(id)?;
        if file.kind != Kind::File {
            return Err(OpError::Conflict(format!(
                "“{}” is a folder; only a file has versions",
                file.name
            )));
        }
        unchanged_since(file, version)?;
        self.keep_current(id, true);
        self.collect();
        self.check_limits()
    }

    /// The kept version `version` of the file `id`.
    pub fn kept_version(&self, id: &str, version: u64) -> Option<&KeptVersion> {
        self.versions
            .get(id)?
            .iter()
            .find(|kept| kept.version == version)
    }

    /// What the browser is shown of a file's versions: newest first, without the one whose bytes
    /// the file holds now and without their content ids. Answers `None` for no such file.
    pub fn versions_view(&self, id: &str) -> Option<serde_json::Value> {
        let file = self.find(id).filter(|entry| entry.kind == Kind::File)?;
        let versions: Vec<serde_json::Value> = self
            .versions
            .get(id)
            .into_iter()
            .flatten()
            .rev()
            .filter(|kept| file.content.as_deref() != Some(kept.content.as_str()))
            .map(|kept| {
                serde_json::json!({
                    "version": kept.version,
                    "size": kept.size,
                    "type": kept.mime,
                    "modified_ms": kept.modified_ms,
                    "saved": kept.saved,
                })
            })
            .collect();
        Some(serde_json::json!({
            "file": id,
            "version": file.version,
            "size": file.size,
            "modified_ms": file.modified_ms,
            "versions": versions,
        }))
    }

    pub fn find(&self, id: &str) -> Option<&Entry> {
        self.entries.iter().find(|e| e.id == id)
    }

    fn find_mut(&mut self, id: &str) -> Option<&mut Entry> {
        self.entries.iter_mut().find(|e| e.id == id)
    }

    fn get(&self, id: &str) -> Result<&Entry, OpError> {
        self.find(id)
            .ok_or_else(|| OpError::Missing(format!("no item has the id {id}")))
    }

    /// Whether the entry, or a folder it is in, is in the Trash.
    pub fn in_trash(&self, id: &str) -> bool {
        let mut current = self.find(id);
        let mut steps = 0;
        while let Some(entry) = current {
            if entry.trashed_ms.is_some() {
                return true;
            }
            steps += 1;
            if steps > self.entries.len() {
                // A cycle, which no operation makes: treat it as gone.
                return true;
            }
            current = entry.parent.as_deref().and_then(|p| self.find(p));
        }
        false
    }

    /// Whether `id` is a folder outside the Trash, which can take items.
    pub fn is_live_folder(&self, id: &str) -> bool {
        self.find(id).is_some_and(|e| e.kind == Kind::Folder) && !self.in_trash(id)
    }

    fn live_folder(&self, id: &str) -> Result<&Entry, OpError> {
        let entry = self.get(id)?;
        if entry.kind != Kind::Folder {
            return Err(OpError::Conflict(format!(
                "“{}” is not a folder",
                entry.name
            )));
        }
        if self.in_trash(id) {
            return Err(OpError::Conflict(format!(
                "“{}” is in the Trash",
                entry.name
            )));
        }
        Ok(entry)
    }

    /// The live entry of folder `parent` named `name`, other than `except`.
    fn sibling(&self, parent: &str, name: &str, except: Option<&str>) -> Option<&Entry> {
        self.entries.iter().find(|e| {
            e.parent.as_deref() == Some(parent)
                && e.trashed_ms.is_none()
                && Some(e.id.as_str()) != except
                && same_name(&e.name, name)
        })
    }

    /// Whether an entry at the top of the Trash, other than `except`, is
    /// named `name`.
    fn in_trash_named(&self, name: &str, except: &str) -> bool {
        self.entries
            .iter()
            .any(|e| e.trashed_ms.is_some() && e.id != except && same_name(&e.name, name))
    }

    /// `id` and every entry inside it, trashed ones too.
    fn subtree(&self, id: &str) -> BTreeSet<String> {
        let mut found = BTreeSet::from([id.to_string()]);
        let mut grew = true;
        while grew {
            grew = false;
            for entry in &self.entries {
                if let Some(parent) = &entry.parent {
                    if found.contains(parent) && !found.contains(&entry.id) {
                        found.insert(entry.id.clone());
                        grew = true;
                    }
                }
            }
        }
        found
    }

    fn touch(&mut self, id: &str, now_ms: u64) {
        if let Some(entry) = self.find_mut(id) {
            entry.modified_ms = now_ms;
        }
    }

    /// The name an item gets in `parent`: `name` itself, or by `existing`.
    /// With `Replace` the item that has the name goes to the Trash, unless
    /// it holds `moving`.
    fn settle_name(
        &mut self,
        parent: &str,
        name: &str,
        existing: Existing,
        except: Option<&str>,
        folder: bool,
        now_ms: u64,
    ) -> Result<String, OpError> {
        let Some(other) = self.sibling(parent, name, except) else {
            return Ok(name.to_string());
        };
        match existing {
            Existing::Rename => Ok(unique_name(
                |candidate| self.sibling(parent, candidate, except).is_some(),
                name,
                folder,
            )),
            Existing::Replace => {
                let other = other.id.clone();
                if is_special(&other) || except.is_some_and(|e| self.subtree(&other).contains(e)) {
                    return Err(OpError::Conflict(format!("“{name}” cannot be replaced")));
                }
                self.trash(&other, now_ms)?;
                Ok(name.to_string())
            }
            Existing::Fail | Existing::Reuse => Err(OpError::Conflict(format!(
                "an item named “{name}” already exists in that folder"
            ))),
        }
    }

    fn trash(&mut self, id: &str, now_ms: u64) -> Result<(), OpError> {
        self.refuse_locked(id)?;
        let entry = self.get(id)?;
        if is_special(id) {
            return Err(OpError::Conflict(format!(
                "“{}” cannot be moved to the Trash",
                entry.name
            )));
        }
        if self.in_trash(id) {
            return Err(OpError::Conflict(format!(
                "“{}” is already in the Trash",
                entry.name
            )));
        }
        let (name, parent) = (entry.name.clone(), entry.parent.clone());
        let name = unique_name(|candidate| self.in_trash_named(candidate, id), &name, false);
        if let Some(entry) = self.find_mut(id) {
            entry.name = name;
            entry.trashed_ms = Some(now_ms);
        }
        if let Some(parent) = parent {
            self.touch(&parent, now_ms);
        }
        Ok(())
    }

    /// Refuses a change that would take away the entry `id` or a locked entry inside it.
    fn refuse_locked(&self, id: &str) -> Result<(), OpError> {
        let within = self.subtree(id);
        match self
            .entries
            .iter()
            .find(|entry| entry.locked && within.contains(&entry.id))
        {
            Some(entry) => Err(locked_error(entry)),
            None => Ok(()),
        }
    }

    fn remove(&mut self, ids: &BTreeSet<String>) {
        self.entries.retain(|e| !ids.contains(&e.id));
    }

    /// Lets go of the versions of erased files and of those past the drive's bounds, then moves
    /// content nothing names any more to the garbage.
    fn collect(&mut self) {
        self.trim_versions();
        self.release_unnamed();
    }

    fn trim_versions(&mut self) {
        if self.versions.is_empty() {
            return;
        }
        let files: BTreeSet<&str> = self.entries.iter().map(|e| e.id.as_str()).collect();
        let mut versions = std::mem::take(&mut self.versions);
        versions.retain(|id, list| files.contains(id.as_str()) && !list.is_empty());
        self.versions = versions;
        let room = VERSIONS_PER_DRIVE.min(MAX_ENTRIES.saturating_sub(self.entries.len()));
        self.drop_oldest_versions(self.versions_kept().saturating_sub(room));
        if self.versions.is_empty() {
            return;
        }
        let bytes = serde_json::to_vec(&*self).map_or(0, |json| json.len());
        let over = bytes.saturating_sub(VERSIONS_DOCUMENT_BYTES);
        self.drop_oldest_versions(over.div_ceil(KEPT_VERSION_BYTES));
    }

    /// Moves content no entry and no kept version names to the garbage.
    fn release_unnamed(&mut self) {
        let named: BTreeSet<&str> = self
            .entries
            .iter()
            .filter_map(|e| e.content.as_deref())
            .chain(
                self.versions
                    .values()
                    .flatten()
                    .map(|kept| kept.content.as_str()),
            )
            .collect();
        let unnamed: Vec<String> = self
            .contents
            .keys()
            .filter(|id| !named.contains(id.as_str()))
            .cloned()
            .collect();
        for id in unnamed {
            if let Some(content) = self.contents.remove(&id) {
                if content.pieces > 0 {
                    // A file's content: no piece of it is being written.
                    self.garbage.push(Garbage {
                        content: id,
                        pieces: content.pieces,
                        next: 0,
                        not_before_ms: 0,
                    });
                }
            }
        }
    }

    fn check_limits(&self) -> Result<(), OpError> {
        if self.entries.len() > MAX_ENTRIES {
            return Err(OpError::Full(format!(
                "a drive holds at most {MAX_ENTRIES} items, the Trash included"
            )));
        }
        // Every open upload may yet become one pending deletion (given up,
        // expired or refused), so both count against the cap: giving an
        // upload up then never passes it.
        if self.garbage.len() + self.uploads.len() > MAX_PENDING_DELETIONS {
            return Err(OpError::Busy(
                "deleted files are still being cleared from the drive; try again in a moment"
                    .into(),
            ));
        }
        Ok(())
    }

    /// The request the browser's `key` names, if the drive finished it.
    pub fn done(&self, key: &str) -> Option<&Done> {
        self.done.iter().find(|d| d.key == key)
    }

    /// Whether one more finished request can be remembered at `now_ms`
    /// without forgetting one younger than [`REMEMBER_MS`].
    pub fn can_remember(&self, now_ms: u64) -> bool {
        self.done
            .iter()
            .filter(|d| d.at_ms.saturating_add(REMEMBER_MS) > now_ms)
            .count()
            < DONE_KEPT
    }

    /// Remember that the request `key` finished at `now_ms`, creating
    /// `created`, and the version it left the first of them at when that is a
    /// file. Only records older than [`REMEMBER_MS`] are forgotten; the caller
    /// checks [`Drive::can_remember`] first.
    pub fn remember(&mut self, key: &str, created: &[String], now_ms: u64) {
        self.done
            .retain(|d| d.key != key && d.at_ms.saturating_add(REMEMBER_MS) > now_ms);
        let version = created
            .first()
            .and_then(|id| self.find(id))
            .filter(|entry| entry.kind == Kind::File)
            .map(|entry| entry.version);
        self.done.push(Done {
            key: key.to_string(),
            created: created.to_vec(),
            at_ms: now_ms,
            version,
        });
    }

    /// Applies `ops` in order, all or none: on an error the drive may be
    /// half changed, so the caller applies them to a copy. Answers the ids of
    /// the entries created (New Folder, a copy), in order. `new_id` makes ids.
    pub fn apply(
        &mut self,
        ops: &[Op],
        now_ms: u64,
        new_id: &mut dyn FnMut() -> String,
    ) -> Result<Vec<String>, OpError> {
        let mut created = Vec::new();
        for op in ops {
            self.apply_one(op, now_ms, new_id, &mut created)?;
        }
        self.collect();
        self.check_limits()?;
        Ok(created)
    }

    fn apply_one(
        &mut self,
        op: &Op,
        now_ms: u64,
        new_id: &mut dyn FnMut() -> String,
        created: &mut Vec<String>,
    ) -> Result<(), OpError> {
        match op {
            Op::Mkdir {
                parent,
                name,
                existing,
            } => {
                self.live_folder(parent)?;
                check_name(name)?;
                if *existing == Existing::Reuse {
                    if let Some(other) = self.sibling(parent, name, None) {
                        if other.kind == Kind::Folder {
                            created.push(other.id.clone());
                            return Ok(());
                        }
                        return Err(OpError::Conflict(format!("“{name}” is a file")));
                    }
                }
                let existing = if *existing == Existing::Replace {
                    Existing::Fail
                } else {
                    *existing
                };
                let name = self.settle_name(parent, name, existing, None, true, now_ms)?;
                let id = new_id();
                self.entries
                    .push(Entry::folder(&id, Some(parent), &name, now_ms));
                self.touch(parent, now_ms);
                created.push(id);
            }
            Op::Rename { id, name } => {
                let entry = self.get(id)?;
                if entry.locked {
                    return Err(locked_error(entry));
                }
                if is_special(id) {
                    return Err(OpError::Conflict(format!(
                        "“{}” cannot be renamed",
                        entry.name
                    )));
                }
                if self.in_trash(id) {
                    return Err(OpError::Conflict(format!(
                        "“{}” is in the Trash; put it back to rename it",
                        entry.name
                    )));
                }
                check_name(name)?;
                let parent = entry.parent.clone().unwrap_or_default();
                if self.sibling(&parent, name, Some(id)).is_some() {
                    return Err(OpError::Conflict(format!(
                        "the name “{name}” is already taken; please choose a different name"
                    )));
                }
                if let Some(entry) = self.find_mut(id) {
                    entry.name = name.clone();
                }
                self.touch(&parent, now_ms);
            }
            Op::Move {
                id,
                parent,
                name,
                existing,
            } => {
                let entry = self.get(id)?;
                if entry.locked {
                    return Err(locked_error(entry));
                }
                if is_special(id) {
                    return Err(OpError::Conflict(format!(
                        "“{}” cannot be moved",
                        entry.name
                    )));
                }
                if self.in_trash(id) {
                    return Err(OpError::Conflict(format!(
                        "“{}” is in the Trash; put it back first",
                        entry.name
                    )));
                }
                let name = name.clone().unwrap_or_else(|| entry.name.clone());
                let (from, folder) = (entry.parent.clone(), entry.kind == Kind::Folder);
                self.live_folder(parent)?;
                if self.subtree(id).contains(parent) {
                    return Err(OpError::Invalid("a folder cannot go inside itself".into()));
                }
                check_name(&name)?;
                let existing = if *existing == Existing::Reuse {
                    Existing::Fail
                } else {
                    *existing
                };
                let name = self.settle_name(parent, &name, existing, Some(id), folder, now_ms)?;
                if let Some(entry) = self.find_mut(id) {
                    entry.parent = Some(parent.clone());
                    entry.name = name;
                }
                if let Some(from) = from {
                    self.touch(&from, now_ms);
                }
                self.touch(parent, now_ms);
            }
            Op::Copy {
                id,
                parent,
                name,
                existing,
                dated_now,
            } => {
                let entry = self.get(id)?;
                if self.in_trash(id) {
                    return Err(OpError::Conflict(format!(
                        "“{}” is in the Trash",
                        entry.name
                    )));
                }
                let name = name.clone().unwrap_or_else(|| entry.name.clone());
                let folder = entry.kind == Kind::Folder;
                self.live_folder(parent)?;
                if self.subtree(id).contains(parent) {
                    return Err(OpError::Invalid(
                        "a folder cannot be copied into itself".into(),
                    ));
                }
                check_name(&name)?;
                let existing = if *existing == Existing::Reuse {
                    Existing::Fail
                } else {
                    *existing
                };
                let name = self.settle_name(parent, &name, existing, None, folder, now_ms)?;
                let root = self.copy_tree(id, parent, &name, *dated_now, now_ms, new_id);
                self.touch(parent, now_ms);
                created.push(root);
                self.check_limits()?;
            }
            Op::Trash { id } => self.trash(id, now_ms)?,
            Op::Restore { id } => {
                let entry = self.get(id)?;
                if entry.trashed_ms.is_none() {
                    return Err(OpError::Conflict(format!(
                        "“{}” is not at the top of the Trash",
                        entry.name
                    )));
                }
                let (name, folder) = (entry.name.clone(), entry.kind == Kind::Folder);
                let parent = entry
                    .parent
                    .clone()
                    .filter(|p| self.is_live_folder(p))
                    .unwrap_or_else(|| RESTORE_FALLBACK.to_string());
                if let Some(entry) = self.find_mut(id) {
                    entry.trashed_ms = None;
                }
                let name = unique_name(
                    |candidate| self.sibling(&parent, candidate, Some(id)).is_some(),
                    &name,
                    folder,
                );
                if let Some(entry) = self.find_mut(id) {
                    entry.parent = Some(parent.clone());
                    entry.name = name;
                }
                self.touch(&parent, now_ms);
            }
            Op::Delete { id } => {
                self.refuse_locked(id)?;
                let entry = self.get(id)?;
                if is_special(id) {
                    return Err(OpError::Conflict(format!(
                        "“{}” cannot be deleted",
                        entry.name
                    )));
                }
                let gone = self.subtree(id);
                self.remove(&gone);
            }
            Op::EmptyTrash => {
                let top: Vec<String> = self
                    .entries
                    .iter()
                    .filter(|e| e.trashed_ms.is_some())
                    .map(|e| e.id.clone())
                    .collect();
                let mut gone = BTreeSet::new();
                for id in top {
                    self.refuse_locked(&id)?;
                    gone.extend(self.subtree(&id));
                }
                self.remove(&gone);
            }
            Op::Tag { id, tags } => {
                self.get(id)?;
                let tags = check_tags(tags)?;
                if let Some(entry) = self.find_mut(id) {
                    entry.tags = tags;
                }
            }
            Op::Opened { id } => {
                let entry = self.get(id)?;
                if entry.kind != Kind::File {
                    return Err(OpError::Invalid("only a file is opened".into()));
                }
                if let Some(entry) = self.find_mut(id) {
                    entry.opened_ms = Some(now_ms);
                }
            }
            Op::Info {
                id,
                comment,
                locked,
                hide_extension,
                stationery,
            } => {
                let entry = self.get(id)?;
                if is_special(id) && (locked.is_some() || hide_extension.is_some()) {
                    return Err(OpError::Conflict(format!(
                        "“{}” cannot be changed",
                        entry.name
                    )));
                }
                if comment
                    .as_ref()
                    .is_some_and(|text| text.len() > MAX_COMMENT_BYTES)
                {
                    return Err(OpError::Invalid("the comment is too long".into()));
                }
                if let Some(entry) = self.find_mut(id) {
                    if let Some(comment) = comment {
                        entry.comment = comment.clone();
                    }
                    if let Some(locked) = locked {
                        entry.locked = *locked;
                    }
                    if let Some(hide_extension) = hide_extension {
                        entry.hide_extension = *hide_extension;
                    }
                    if let Some(stationery) = stationery {
                        entry.stationery = *stationery;
                    }
                }
            }
        }
        Ok(())
    }

    /// Copies the entry `id` and everything inside it that is not in the
    /// Trash into `parent` as `name`. Files share their content. Answers the
    /// copy's id. A copy keeps the dates its files were last changed, unless `dated_now`.
    fn copy_tree(
        &mut self,
        id: &str,
        parent: &str,
        name: &str,
        dated_now: bool,
        now_ms: u64,
        new_id: &mut dyn FnMut() -> String,
    ) -> String {
        let mut copies: Vec<Entry> = Vec::new();
        // (original id, copy's id), parents before their children.
        let mut queue: Vec<(String, String)> = Vec::new();
        let root_id = new_id();
        if let Some(original) = self.find(id) {
            let mut copy = original.clone();
            copy.id = root_id.clone();
            copy.parent = Some(parent.to_string());
            copy.name = name.to_string();
            copy.created_ms = now_ms;
            copy.opened_ms = None;
            copy.trashed_ms = None;
            copies.push(copy);
            queue.push((id.to_string(), root_id.clone()));
        }
        while let Some((original, copied)) = queue.pop() {
            for child in self.entries.iter().filter(|e| {
                e.parent.as_deref() == Some(original.as_str()) && e.trashed_ms.is_none()
            }) {
                let mut copy = child.clone();
                copy.id = new_id();
                copy.parent = Some(copied.clone());
                copy.created_ms = now_ms;
                copy.opened_ms = None;
                queue.push((child.id.clone(), copy.id.clone()));
                copies.push(copy);
            }
        }
        self.entries.extend(copies.into_iter().map(|mut copy| {
            if dated_now {
                copy.modified_ms = now_ms;
            }
            copy
        }));
        root_id
    }

    /// Adds a finished upload: a file in `parent` named by `existing`, whose
    /// bytes are `content`. Checks the quota and the entry limit. Answers the
    /// new entry's id.
    #[allow(clippy::too_many_arguments)]
    pub fn add_file(
        &mut self,
        parent: &str,
        name: &str,
        mime: &str,
        size: u64,
        content: &str,
        existing: Existing,
        now_ms: u64,
        id: String,
    ) -> Result<String, OpError> {
        self.live_folder(parent)?;
        check_name(name)?;
        self.make_room(size);
        if self.usage() + size > QUOTA_BYTES {
            return Err(OpError::Full(format!(
                "the file does not fit: a drive holds {} MB",
                QUOTA_BYTES / 1_000_000
            )));
        }
        let existing = if existing == Existing::Reuse {
            Existing::Rename
        } else {
            existing
        };
        let name = self.settle_name(parent, name, existing, None, false, now_ms)?;
        self.contents.insert(
            content.to_string(),
            Content {
                size,
                pieces: pieces_for(size),
            },
        );
        self.entries.push(Entry {
            id: id.clone(),
            parent: Some(parent.to_string()),
            name,
            kind: Kind::File,
            size,
            mime: clean_type(mime),
            content: Some(content.to_string()),
            created_ms: now_ms,
            modified_ms: now_ms,
            opened_ms: None,
            trashed_ms: None,
            tags: Vec::new(),
            comment: String::new(),
            locked: false,
            hide_extension: false,
            stationery: false,
            version: 0,
        });
        self.touch(parent, now_ms);
        self.collect();
        self.check_limits()?;
        Ok(id)
    }

    /// What the browser is shown: the entries without their content ids, the
    /// usage and the limits.
    pub fn view(&self) -> serde_json::Value {
        let entries: Vec<serde_json::Value> = self
            .entries
            .iter()
            .map(|entry| {
                let mut value = serde_json::to_value(entry).unwrap_or(serde_json::Value::Null);
                if let Some(object) = value.as_object_mut() {
                    object.remove("content");
                }
                value
            })
            .collect();
        serde_json::json!({
            "entries": entries,
            "usage": self.usage(),
            "reserved": self.reserved(),
            "quota": QUOTA_BYTES,
            "piece_bytes": PIECE_BYTES,
            "max_file_bytes": MAX_FILE_BYTES,
            "max_entries": MAX_ENTRIES,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ids() -> impl FnMut() -> String {
        let mut n = 0;
        move || {
            n += 1;
            format!("e{n}")
        }
    }

    fn names_in(drive: &Drive, parent: &str) -> Vec<String> {
        let mut names: Vec<String> = drive
            .entries
            .iter()
            .filter(|e| e.parent.as_deref() == Some(parent) && e.trashed_ms.is_none())
            .map(|e| e.name.clone())
            .collect();
        names.sort();
        names
    }

    fn trash_names(drive: &Drive) -> Vec<String> {
        let mut names: Vec<String> = drive
            .entries
            .iter()
            .filter(|e| e.trashed_ms.is_some())
            .map(|e| e.name.clone())
            .collect();
        names.sort();
        names
    }

    fn mkdir(parent: &str, name: &str) -> Op {
        Op::Mkdir {
            parent: parent.into(),
            name: name.into(),
            existing: Existing::Rename,
        }
    }

    /// A drive with `Documents/Report.txt` (content c1, 1000 bytes).
    fn with_report() -> (Drive, String) {
        let mut drive = Drive::fresh(1);
        let id = drive
            .add_file(
                "documents",
                "Report.txt",
                "text/plain",
                1000,
                "c1",
                Existing::Rename,
                2,
                "f1".into(),
            )
            .unwrap();
        (drive, id)
    }

    #[test]
    fn a_fresh_drive_has_the_six_home_folders_and_nothing_else() {
        let drive = Drive::fresh(5);
        let names: Vec<&str> = drive.entries.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(
            names,
            [
                "Desktop",
                "Documents",
                "Downloads",
                "Movies",
                "Music",
                "Pictures"
            ]
        );
        assert!(drive
            .entries
            .iter()
            .all(|e| e.parent.is_none() && e.kind == Kind::Folder));
        assert_eq!(drive.usage(), 0);
        // A stored drive that lost one gets it back, in its place.
        let mut stored = drive.clone();
        stored.entries.remove(2);
        stored.ensure_special(9);
        assert_eq!(stored.entries[2].id, "downloads");
    }

    #[test]
    fn new_folders_take_the_next_free_name_or_reuse_one() {
        let mut drive = Drive::fresh(1);
        let mut next = ids();
        let made = drive
            .apply(
                &[
                    mkdir("documents", "untitled folder"),
                    mkdir("documents", "Untitled Folder"),
                ],
                3,
                &mut next,
            )
            .unwrap();
        assert_eq!(made, ["e1", "e2"]);
        assert_eq!(
            names_in(&drive, "documents"),
            ["Untitled Folder 2", "untitled folder"]
        );
        let reused = drive
            .apply(
                &[Op::Mkdir {
                    parent: "documents".into(),
                    name: "UNTITLED FOLDER".into(),
                    existing: Existing::Reuse,
                }],
                4,
                &mut next,
            )
            .unwrap();
        assert_eq!(reused, ["e1"], "Reuse answers the folder that has the name");
        let refused = drive.clone().apply(
            &[Op::Mkdir {
                parent: "documents".into(),
                name: "untitled folder".into(),
                existing: Existing::Fail,
            }],
            4,
            &mut next,
        );
        assert_eq!(refused.unwrap_err().status(), 409);
        assert_eq!(
            drive.find("documents").unwrap().modified_ms,
            3,
            "New Folder moves the folder's date"
        );
    }

    #[test]
    fn names_are_checked() {
        for bad in ["", ".", "..", "a/b", "tab\there", &"x".repeat(256)] {
            assert!(check_name(bad).is_err(), "{bad:?}");
        }
        for good in ["Budget.txt", ".hidden", "Ünïcode ✓", &"x".repeat(255)] {
            assert!(check_name(good).is_ok(), "{good:?}");
        }
        let taken = |n: &str| ["Budget.txt", "Budget 2.txt", "Letters"].contains(&n);
        assert_eq!(unique_name(taken, "Budget.txt", false), "Budget 3.txt");
        assert_eq!(unique_name(taken, "Letters", true), "Letters 2");
        assert_eq!(unique_name(taken, "Fresh.txt", false), "Fresh.txt");
        let long = format!("{}.txt", "é".repeat(126));
        let renamed = unique_name(|n| n == long, &long, false);
        assert!(
            renamed.len() <= MAX_NAME_BYTES && renamed.ends_with(" 2.txt"),
            "{renamed}"
        );
    }

    #[test]
    fn rename_refuses_a_taken_name_and_the_home_folders() {
        let (mut drive, id) = with_report();
        let mut next = ids();
        drive
            .apply(&[mkdir("documents", "Letters")], 3, &mut next)
            .unwrap();
        let taken = drive.clone().apply(
            &[Op::Rename {
                id: id.clone(),
                name: "letters".into(),
            }],
            4,
            &mut next,
        );
        assert_eq!(taken.unwrap_err().status(), 409);
        let special = drive.clone().apply(
            &[Op::Rename {
                id: "music".into(),
                name: "Tunes".into(),
            }],
            4,
            &mut next,
        );
        assert_eq!(special.unwrap_err().status(), 409);
        drive
            .apply(
                &[Op::Rename {
                    id: id.clone(),
                    name: "Final.txt".into(),
                }],
                4,
                &mut next,
            )
            .unwrap();
        assert_eq!(names_in(&drive, "documents"), ["Final.txt", "Letters"]);
        // A change of case only is a rename of the same item.
        drive
            .apply(
                &[Op::Rename {
                    id,
                    name: "FINAL.txt".into(),
                }],
                5,
                &mut next,
            )
            .unwrap();
        assert_eq!(names_in(&drive, "documents"), ["FINAL.txt", "Letters"]);
    }

    #[test]
    fn moves_keep_folders_out_of_themselves_and_settle_names() {
        let (mut drive, report) = with_report();
        let mut next = ids();
        let made = drive
            .apply(
                &[mkdir("documents", "Outer"), mkdir("documents", "Inner")],
                3,
                &mut next,
            )
            .unwrap();
        let (outer, inner) = (made[0].clone(), made[1].clone());
        drive
            .apply(
                &[Op::Move {
                    id: inner.clone(),
                    parent: outer.clone(),
                    name: None,
                    existing: Existing::Rename,
                }],
                4,
                &mut next,
            )
            .unwrap();
        let loop_back = drive.clone().apply(
            &[Op::Move {
                id: outer.clone(),
                parent: inner.clone(),
                name: None,
                existing: Existing::Rename,
            }],
            5,
            &mut next,
        );
        assert_eq!(loop_back.unwrap_err().status(), 400);
        // A file of the same name already in Desktop: Rename keeps both, Fail refuses,
        // Replace sends the other one to the Trash.
        drive
            .add_file(
                "desktop",
                "Report.txt",
                "text/plain",
                10,
                "c2",
                Existing::Rename,
                5,
                "f2".into(),
            )
            .unwrap();
        let refused = drive.clone().apply(
            &[Op::Move {
                id: report.clone(),
                parent: "desktop".into(),
                name: None,
                existing: Existing::Fail,
            }],
            6,
            &mut next,
        );
        assert_eq!(refused.unwrap_err().status(), 409);
        let mut kept = drive.clone();
        kept.apply(
            &[Op::Move {
                id: report.clone(),
                parent: "desktop".into(),
                name: None,
                existing: Existing::Rename,
            }],
            6,
            &mut next,
        )
        .unwrap();
        assert_eq!(names_in(&kept, "desktop"), ["Report 2.txt", "Report.txt"]);
        drive
            .apply(
                &[Op::Move {
                    id: report.clone(),
                    parent: "desktop".into(),
                    name: None,
                    existing: Existing::Replace,
                }],
                6,
                &mut next,
            )
            .unwrap();
        assert_eq!(names_in(&drive, "desktop"), ["Report.txt"]);
        assert_eq!(
            drive.find(&report).unwrap().parent.as_deref(),
            Some("desktop")
        );
        assert_eq!(
            trash_names(&drive),
            ["Report.txt"],
            "the replaced file is in the Trash"
        );
        let special = drive.clone().apply(
            &[Op::Move {
                id: "pictures".into(),
                parent: "documents".into(),
                name: None,
                existing: Existing::Rename,
            }],
            7,
            &mut next,
        );
        assert_eq!(special.unwrap_err().status(), 409);
    }

    #[test]
    fn a_copy_shares_its_content_and_takes_no_space() {
        let (mut drive, report) = with_report();
        let mut next = ids();
        let folder = drive
            .apply(&[mkdir("documents", "Letters")], 3, &mut next)
            .unwrap()[0]
            .clone();
        drive
            .apply(
                &[Op::Move {
                    id: report.clone(),
                    parent: folder.clone(),
                    name: None,
                    existing: Existing::Rename,
                }],
                4,
                &mut next,
            )
            .unwrap();
        let copy = drive
            .apply(
                &[Op::Copy {
                    id: folder.clone(),
                    parent: "documents".into(),
                    name: Some("Letters copy".into()),
                    existing: Existing::Rename,
                    dated_now: false,
                }],
                5,
                &mut next,
            )
            .unwrap()[0]
            .clone();
        assert_eq!(names_in(&drive, "documents"), ["Letters", "Letters copy"]);
        assert_eq!(names_in(&drive, &copy), ["Report.txt"]);
        let copied = drive
            .entries
            .iter()
            .find(|e| e.parent.as_deref() == Some(copy.as_str()))
            .unwrap();
        assert_ne!(copied.id, report);
        assert_eq!(copied.content.as_deref(), Some("c1"));
        assert_eq!(drive.usage(), 1000, "one content, counted once");
        let into_itself = drive.clone().apply(
            &[Op::Copy {
                id: folder.clone(),
                parent: folder.clone(),
                name: None,
                existing: Existing::Rename,
                dated_now: false,
            }],
            6,
            &mut next,
        );
        assert_eq!(into_itself.unwrap_err().status(), 400);
        // Deleting one of the two leaves the content to the other.
        drive
            .apply(&[Op::Delete { id: folder }], 7, &mut next)
            .unwrap();
        assert!(drive.contents.contains_key("c1") && drive.garbage.is_empty());
        drive
            .apply(&[Op::Delete { id: copy }], 8, &mut next)
            .unwrap();
        assert!(drive.contents.is_empty());
        assert_eq!(
            drive.garbage,
            [Garbage {
                content: "c1".into(),
                pieces: 1,
                next: 0,
                not_before_ms: 0,
            }]
        );
    }

    fn upload(parent: &str, name: &str, size: u64, content: &str) -> OpenUpload {
        OpenUpload {
            parent: parent.into(),
            name: name.into(),
            mime: "text/plain".into(),
            size,
            content: content.into(),
            pieces: pieces_for(size),
            existing: ExistingText::Rename,
            expires_ms: 1_000,
            replaces: None,
            base: None,
        }
    }

    #[test]
    fn bytes_waiting_deletion_count_against_a_new_upload() {
        let mut drive = Drive::fresh(1);
        for (id, name) in [("u1", "a"), ("u2", "b")] {
            drive
                .open_upload(id.into(), upload("movies", name, MAX_FILE_BYTES, id))
                .unwrap();
        }
        // Cancelled: nothing is reserved any more, but the pieces are not gone.
        assert!(drive.drop_upload("u1", 5) && drive.drop_upload("u2", 5));
        assert_eq!(drive.reserved(), 0);
        assert!(drive.pending() >= QUOTA_BYTES);
        let busy = drive
            .open_upload("u3".into(), upload("movies", "c", MAX_FILE_BYTES, "c3"))
            .unwrap_err();
        assert_eq!(busy.status(), 429, "{}", busy.message());
        // Once the sweeps have deleted them, it opens.
        drive.garbage.clear();
        drive
            .open_upload("u3".into(), upload("movies", "c", MAX_FILE_BYTES, "c3"))
            .unwrap();
        // However small the records, their number is bounded, open uploads
        // included: a change that would pass the cap is refused.
        let mut drive = Drive::fresh(1);
        let mut next = ids();
        drive.garbage = (0..MAX_PENDING_DELETIONS - 1)
            .map(|n| Garbage {
                content: format!("g{n}"),
                pieces: 1,
                next: 1,
                not_before_ms: 0,
            })
            .collect();
        assert_eq!(drive.pending(), 0);
        for (content, id) in [("c1", "f1"), ("c2", "f2")] {
            drive
                .add_file(
                    "documents",
                    id,
                    "",
                    1,
                    content,
                    Existing::Rename,
                    2,
                    id.into(),
                )
                .unwrap();
        }
        drive
            .apply(&[Op::Delete { id: "f1".into() }], 3, &mut next)
            .unwrap();
        assert_eq!(drive.garbage.len(), MAX_PENDING_DELETIONS);
        let full = drive
            .clone()
            .apply(&[Op::Delete { id: "f2".into() }], 4, &mut next)
            .unwrap_err();
        assert_eq!(full.status(), 429);
        assert_eq!(
            drive
                .open_upload("u1".into(), upload("movies", "a", 1, "c9"))
                .unwrap_err()
                .status(),
            429
        );
        // One record fewer: an upload opens, and giving it up exactly
        // reaches the cap again.
        drive.garbage.pop();
        drive
            .open_upload("u1".into(), upload("movies", "a", 1, "c9"))
            .unwrap();
        assert!(drive.drop_upload("u1", 5));
        assert_eq!(drive.garbage.len(), MAX_PENDING_DELETIONS);
    }

    #[test]
    fn a_replacing_upload_replaces_only_the_file_the_person_chose() {
        let mut drive = Drive::fresh(1);
        let mut next = ids();
        drive
            .add_file(
                "documents",
                "Report.txt",
                "",
                1,
                "c0",
                Existing::Rename,
                1,
                "f0".into(),
            )
            .unwrap();
        let replacing = |content: &str, chosen: Option<&str>| OpenUpload {
            existing: ExistingText::Replace,
            replaces: chosen.map(String::from),
            ..upload("documents", "Report.txt", 1, content)
        };
        drive
            .open_upload("u1".into(), replacing("c1", Some("f0")))
            .unwrap();
        drive.complete_upload("u1", 2, "f1".into()).unwrap();
        assert!(drive.find("f0").unwrap().trashed_ms.is_some());
        // Another save chose `f0` too, but `f1` has the name now: refused,
        // and `f1` stays where it is.
        drive
            .open_upload("u2".into(), replacing("c2", Some("f0")))
            .unwrap();
        let changed = drive.complete_upload("u2", 3, "f2".into()).unwrap_err();
        assert_eq!(changed.status(), 409);
        assert!(drive.find("f1").unwrap().trashed_ms.is_none() && drive.find("f2").is_none());
        assert!(drive.uploads.is_empty(), "the refused upload is given up");
        // A folder of the name is never replaced by a file, and a replacing
        // upload always names the file it replaces.
        drive
            .apply(&[mkdir("documents", "Box")], 4, &mut next)
            .unwrap();
        let unnamed = drive
            .open_upload(
                "u3".into(),
                OpenUpload {
                    existing: ExistingText::Replace,
                    ..upload("documents", "Report.txt", 1, "c3")
                },
            )
            .unwrap_err();
        assert_eq!(unnamed.status(), 400);
        drive
            .open_upload("u3".into(), {
                let mut box_upload = replacing("c3", Some("f1"));
                box_upload.name = "Box".into();
                box_upload
            })
            .unwrap();
        let folder = drive.complete_upload("u3", 5, "f3".into()).unwrap_err();
        assert_eq!(folder.status(), 409);
        assert!(names_in(&drive, "documents").contains(&"Box".to_string()));
    }

    #[test]
    fn an_overwriting_upload_saves_into_the_same_file() {
        let mut drive = Drive::fresh(1);
        let mut next = ids();
        drive
            .add_file(
                "documents",
                "Letter.rtf",
                "text/rtf",
                3,
                "c0",
                Existing::Rename,
                1,
                "f0".into(),
            )
            .unwrap();
        drive
            .apply(
                &[
                    Op::Tag {
                        id: "f0".into(),
                        tags: vec!["Work".into()],
                    },
                    Op::Copy {
                        id: "f0".into(),
                        parent: "desktop".into(),
                        name: None,
                        existing: Existing::Rename,
                        dated_now: false,
                    },
                ],
                2,
                &mut next,
            )
            .unwrap();
        let saving = |content: &str, target: Option<&str>| OpenUpload {
            existing: ExistingText::Overwrite,
            replaces: target.map(String::from),
            mime: "text/rtf".into(),
            ..upload("documents", "Letter.rtf", 5, content)
        };
        // Saved in place: the same id, name, folder, tags and creation time,
        // the new size and modification time. The copy keeps the old bytes.
        drive
            .open_upload("u1".into(), saving("c1", Some("f0")))
            .unwrap();
        assert_eq!(
            drive.complete_upload("u1", 9, "unused".into()),
            Ok("f0".into())
        );
        let file = drive.find("f0").unwrap();
        assert_eq!(
            (file.name.as_str(), file.parent.as_deref(), file.size),
            ("Letter.rtf", Some("documents"), 5)
        );
        assert_eq!((file.created_ms, file.modified_ms), (1, 9));
        assert_eq!(file.tags, ["Work".to_string()]);
        assert_eq!(file.content.as_deref(), Some("c1"));
        assert!(drive.find("unused").is_none() && drive.uploads.is_empty());
        assert!(drive.contents.contains_key("c0"), "the copy still names c0");
        // Saved again: the file keeps the bytes it replaced, whether or not a copy names them.
        drive
            .open_upload("u2".into(), saving("c2", Some("f0")))
            .unwrap();
        drive.complete_upload("u2", 10, "unused".into()).unwrap();
        assert!(drive.contents.contains_key("c1"));
        assert!(drive.garbage.is_empty());
        assert_eq!(
            drive.versions["f0"]
                .iter()
                .map(|kept| kept.content.as_str())
                .collect::<Vec<_>>(),
            ["c0", "c1"]
        );
        // An overwrite names its file; a folder, a file in the Trash or a
        // file gone is refused, at the start or at completion.
        let unnamed = drive.open_upload("u3".into(), saving("c3", None));
        assert_eq!(unnamed.unwrap_err().status(), 400);
        let folder = drive.open_upload("u3".into(), saving("c3", Some("documents")));
        assert_eq!(folder.unwrap_err().status(), 409);
        drive
            .open_upload("u3".into(), saving("c3", Some("f0")))
            .unwrap();
        drive
            .apply(&[Op::Trash { id: "f0".into() }], 11, &mut next)
            .unwrap();
        let trashed = drive.complete_upload("u3", 12, "unused".into());
        assert_eq!(trashed.unwrap_err().status(), 409);
        assert!(drive.uploads.is_empty(), "the refused upload is given up");
        assert_eq!(drive.find("f0").unwrap().content.as_deref(), Some("c2"));
    }

    #[test]
    fn a_save_in_place_made_from_an_older_version_is_refused() {
        let mut drive = Drive::fresh(1);
        drive
            .add_file(
                "documents",
                "Letter.rtf",
                "text/rtf",
                3,
                "c0",
                Existing::Rename,
                1,
                "f0".into(),
            )
            .unwrap();
        assert_eq!(drive.find("f0").unwrap().version, 0);
        let saving = |content: &str, base: Option<u64>| OpenUpload {
            existing: ExistingText::Overwrite,
            replaces: Some("f0".into()),
            base,
            ..upload("documents", "Letter.rtf", 5, content)
        };
        // Two windows read version 0. The first save goes in and makes version 1.
        drive
            .open_upload("a".into(), saving("ca", Some(0)))
            .unwrap();
        drive
            .open_upload("b".into(), saving("cb", Some(0)))
            .unwrap();
        drive.complete_upload("a", 2, "unused".into()).unwrap();
        assert_eq!(drive.find("f0").unwrap().version, 1);
        // The second, made from version 0 too, is refused at completion and given up: the
        // file keeps the first window's bytes.
        let stale = drive.complete_upload("b", 3, "unused".into()).unwrap_err();
        assert_eq!(stale.status(), 412, "{}", stale.message());
        assert_eq!(drive.find("f0").unwrap().content.as_deref(), Some("ca"));
        assert!(drive.uploads.is_empty(), "the refused upload is given up");
        // Refused at the start as well, once the version has moved on.
        let late = drive.open_upload("c".into(), saving("cc", Some(0)));
        assert_eq!(late.unwrap_err().status(), 412);
        // Made from the version it has now, or with no version at all (Save Anyway), it goes in.
        drive
            .open_upload("d".into(), saving("cd", Some(1)))
            .unwrap();
        drive.complete_upload("d", 4, "unused".into()).unwrap();
        drive.open_upload("e".into(), saving("ce", None)).unwrap();
        drive.complete_upload("e", 5, "unused".into()).unwrap();
        let file = drive.find("f0").unwrap();
        assert_eq!((file.version, file.content.as_deref()), (3, Some("ce")));
        // The browser is shown the version, never the content id.
        let view = drive.view();
        let shown = view["entries"]
            .as_array()
            .unwrap()
            .iter()
            .find(|e| e["id"] == "f0")
            .unwrap();
        assert_eq!(shown["version"], 3);
        assert!(shown.get("content").is_none());
    }

    #[test]
    fn a_save_in_place_on_a_full_drive_counts_the_content_it_replaces_once() {
        let mut drive = Drive::fresh(1);
        // Two files of the largest size fill the drive.
        for (n, name) in ["a", "b"].iter().enumerate() {
            let id = format!("u{n}");
            drive
                .open_upload(
                    id.clone(),
                    upload("documents", name, MAX_FILE_BYTES, &format!("c{n}")),
                )
                .unwrap();
            drive.complete_upload(&id, 2, format!("f{n}")).unwrap();
        }
        assert_eq!(drive.usage(), QUOTA_BYTES);
        let saving = || OpenUpload {
            existing: ExistingText::Overwrite,
            replaces: Some("f0".into()),
            ..upload("documents", "a", MAX_FILE_BYTES, "c9")
        };
        // A new file does not fit; saving f0 in place at its size does.
        let new = drive.open_upload("u8".into(), upload("documents", "c", 1, "c8"));
        assert_eq!(new.unwrap_err().status(), 507);
        drive.open_upload("u9".into(), saving()).unwrap();
        // A second save of f0 meanwhile takes no credit of its own.
        let again = drive.open_upload("u10".into(), saving());
        assert_eq!(again.unwrap_err().status(), 507);
        // A same-size save in place of f1 meanwhile fits too: each file's content counts once.
        let other = OpenUpload {
            existing: ExistingText::Overwrite,
            replaces: Some("f1".into()),
            ..upload("documents", "b", MAX_FILE_BYTES, "c11")
        };
        drive.open_upload("u11".into(), other).unwrap();
        drive.complete_upload("u11", 3, "unused".into()).unwrap();
        drive.complete_upload("u9", 3, "unused".into()).unwrap();
        assert_eq!(drive.usage(), QUOTA_BYTES, "the old content is released");
        assert!(drive.garbage.iter().any(|g| g.content == "c0"));
    }

    #[test]
    fn an_upload_never_borrows_what_a_pending_save_in_place_will_free() {
        let mut drive = Drive::fresh(1);
        for (n, name) in ["a", "b"].iter().enumerate() {
            let id = format!("u{n}");
            drive
                .open_upload(
                    id.clone(),
                    upload("documents", name, MAX_FILE_BYTES, &format!("c{n}")),
                )
                .unwrap();
            drive.complete_upload(&id, 2, format!("f{n}")).unwrap();
        }
        // A save in place that shrinks f1 fits; what it will free is its own credit only.
        let shrinking = OpenUpload {
            existing: ExistingText::Overwrite,
            replaces: Some("f1".into()),
            ..upload("documents", "b", 1, "c12")
        };
        drive.open_upload("u12".into(), shrinking).unwrap();
        let borrowing = drive.open_upload("u13".into(), upload("documents", "d", 1, "c13"));
        assert_eq!(borrowing.unwrap_err().status(), 507);
    }

    #[test]
    fn uploads_reserve_their_size_and_their_number_is_bounded() {
        let mut drive = Drive::fresh(1);
        for n in 0..MAX_OPEN_UPLOADS {
            drive
                .open_upload(
                    format!("u{n}"),
                    upload("documents", "a", 1, &format!("c{n}")),
                )
                .unwrap();
        }
        let busy = drive
            .open_upload("u9".into(), upload("documents", "a", 1, "c9"))
            .unwrap_err();
        assert_eq!(busy.status(), 429);
        let mut drive = Drive::fresh(1);
        // Two of the largest files fill the quota.
        assert_eq!(2 * MAX_FILE_BYTES, QUOTA_BYTES);
        for (id, name) in [("u1", "a"), ("u2", "b")] {
            drive
                .open_upload(id.into(), upload("movies", name, MAX_FILE_BYTES, id))
                .unwrap();
        }
        // Nothing is stored yet, but the open uploads hold their place.
        assert_eq!(drive.usage(), 0);
        assert_eq!(drive.reserved(), QUOTA_BYTES);
        let full = drive
            .open_upload("u5".into(), upload("movies", "c", 1, "c5"))
            .unwrap_err();
        assert_eq!(full.status(), 507);
        let large = drive
            .open_upload("u3".into(), upload("movies", "b", MAX_FILE_BYTES + 1, "c3"))
            .unwrap_err();
        assert_eq!(large.status(), 413);
        assert_eq!(
            drive
                .open_upload("u4".into(), upload("nowhere", "b", 1, "c4"))
                .unwrap_err()
                .status(),
            404
        );
    }

    #[test]
    fn completing_an_upload_makes_the_file_and_leaves_nothing_to_give_up() {
        let mut drive = Drive::fresh(1);
        drive
            .open_upload("u1".into(), upload("documents", "Plan.txt", 10, "c1"))
            .unwrap();
        let file = drive.complete_upload("u1", 5, "f1".into()).unwrap();
        assert_eq!(file, "f1");
        assert!(drive.uploads.is_empty());
        assert_eq!(drive.find("f1").unwrap().content.as_deref(), Some("c1"));
        // Giving the upload up afterwards finds nothing, so its pieces, now
        // the file's, are never sent to the garbage.
        assert!(!drive.drop_upload("u1", 6));
        drive.sweep(u64::MAX);
        assert!(drive.garbage.is_empty());
        assert_eq!(
            drive
                .complete_upload("u1", 7, "f2".into())
                .unwrap_err()
                .status(),
            404
        );
    }

    #[test]
    fn an_upload_given_up_or_expired_sends_every_piece_to_the_garbage_later() {
        let mut drive = Drive::fresh(1);
        let size = PIECE_BYTES * 2 + 1;
        drive
            .open_upload("u1".into(), upload("documents", "a", size, "c1"))
            .unwrap();
        drive
            .open_upload("u2".into(), upload("documents", "b", 1, "c2"))
            .unwrap();
        assert!(drive.drop_upload("u1", 100));
        assert_eq!(
            drive.garbage,
            [Garbage {
                content: "c1".into(),
                pieces: 3,
                next: 0,
                not_before_ms: 100 + UPLOAD_GRACE_MS,
            }]
        );
        drive.sweep(999);
        assert_eq!(drive.uploads.len(), 1, "not expired yet");
        drive.sweep(1_000);
        assert!(drive.uploads.is_empty());
        assert_eq!(drive.garbage.len(), 2);
        // A completion the drive refuses gives the upload up.
        drive
            .open_upload("u3".into(), upload("documents", "Taken.txt", 1, "c3"))
            .unwrap();
        drive
            .add_file(
                "documents",
                "Taken.txt",
                "",
                1,
                "c0",
                Existing::Rename,
                1,
                "f0".into(),
            )
            .unwrap();
        drive.uploads.get_mut("u3").unwrap().existing = ExistingText::Fail;
        assert_eq!(
            drive
                .complete_upload("u3", 2, "f3".into())
                .unwrap_err()
                .status(),
            409
        );
        assert!(drive.uploads.is_empty() && drive.find("f3").is_none());
        assert_eq!(drive.garbage.last().unwrap().content, "c3");
    }

    #[test]
    fn files_of_one_name_trashed_from_two_folders_get_two_names_in_the_trash() {
        let mut drive = Drive::fresh(1);
        let mut next = ids();
        let a = drive
            .add_file(
                "documents",
                "Note.txt",
                "",
                1,
                "c1",
                Existing::Rename,
                2,
                "f1".into(),
            )
            .unwrap();
        let b = drive
            .add_file(
                "desktop",
                "note.TXT",
                "",
                1,
                "c2",
                Existing::Rename,
                2,
                "f2".into(),
            )
            .unwrap();
        drive
            .apply(
                &[Op::Trash { id: a.clone() }, Op::Trash { id: b.clone() }],
                3,
                &mut next,
            )
            .unwrap();
        let (na, nb) = (
            drive.find(&a).unwrap().name.clone(),
            drive.find(&b).unwrap().name.clone(),
        );
        assert_ne!(na.to_lowercase(), nb.to_lowercase(), "{na} / {nb}");
        // Put Back returns each to its own folder under its first name.
        drive
            .apply(&[Op::Restore { id: b.clone() }], 4, &mut next)
            .unwrap();
        assert_eq!(drive.find(&b).unwrap().parent.as_deref(), Some("desktop"));
    }

    #[test]
    fn a_collision_name_never_passes_the_longest_name() {
        let long = format!("a.{}", "b".repeat(MAX_NAME_BYTES - 2));
        assert_eq!(long.len(), MAX_NAME_BYTES);
        let renamed = unique_name(|n| n == long, &long, false);
        assert!(renamed.len() <= MAX_NAME_BYTES, "{}", renamed.len());
        assert!(check_name(&renamed).is_ok());
        assert_ne!(renamed, long);
    }

    #[test]
    fn renaming_an_item_moves_its_folder_s_date() {
        let (mut drive, report) = with_report();
        let mut next = ids();
        drive
            .apply(
                &[Op::Rename {
                    id: report,
                    name: "Final.txt".into(),
                }],
                42,
                &mut next,
            )
            .unwrap();
        assert_eq!(drive.find("documents").unwrap().modified_ms, 42);
    }

    #[test]
    fn trash_put_back_and_empty() {
        let (mut drive, report) = with_report();
        let mut next = ids();
        drive
            .apply(&[Op::Trash { id: report.clone() }], 3, &mut next)
            .unwrap();
        assert!(drive.in_trash(&report));
        assert!(names_in(&drive, "documents").is_empty());
        // A second file of the name goes to the Trash beside it under another name.
        let second = drive
            .add_file(
                "documents",
                "Report.txt",
                "text/plain",
                5,
                "c2",
                Existing::Rename,
                4,
                "f2".into(),
            )
            .unwrap();
        drive
            .apply(&[Op::Trash { id: second.clone() }], 5, &mut next)
            .unwrap();
        assert_eq!(trash_names(&drive), ["Report 2.txt", "Report.txt"]);
        assert_eq!(
            drive
                .clone()
                .apply(
                    &[Op::Rename {
                        id: report.clone(),
                        name: "x".into()
                    }],
                    6,
                    &mut next
                )
                .unwrap_err()
                .status(),
            409
        );
        assert_eq!(
            drive
                .clone()
                .apply(&[Op::Trash { id: report.clone() }], 6, &mut next)
                .unwrap_err()
                .status(),
            409
        );
        // Put Back returns it to its folder.
        drive
            .apply(&[Op::Restore { id: report.clone() }], 6, &mut next)
            .unwrap();
        assert_eq!(names_in(&drive, "documents"), ["Report.txt"]);
        // Empty Trash deletes the rest and frees its content.
        drive.apply(&[Op::EmptyTrash], 7, &mut next).unwrap();
        assert!(drive.find(&second).is_none());
        assert_eq!(drive.usage(), 1000);
        assert_eq!(drive.garbage.len(), 1);
        assert_eq!(
            drive
                .clone()
                .apply(
                    &[Op::Trash {
                        id: "desktop".into()
                    }],
                    8,
                    &mut next
                )
                .unwrap_err()
                .status(),
            409
        );
    }

    #[test]
    fn put_back_into_a_folder_that_is_gone_lands_on_the_desktop() {
        let mut drive = Drive::fresh(1);
        let mut next = ids();
        let folder = drive
            .apply(&[mkdir("documents", "Old")], 2, &mut next)
            .unwrap()[0]
            .clone();
        let file = drive
            .add_file(
                &folder,
                "Note.txt",
                "text/plain",
                3,
                "c1",
                Existing::Rename,
                3,
                "f1".into(),
            )
            .unwrap();
        drive
            .apply(
                &[
                    Op::Trash { id: file.clone() },
                    Op::Trash { id: folder.clone() },
                ],
                4,
                &mut next,
            )
            .unwrap();
        // The folder is in the Trash too: the file cannot go back into it.
        drive
            .apply(&[Op::Restore { id: file.clone() }], 5, &mut next)
            .unwrap();
        assert_eq!(
            drive.find(&file).unwrap().parent.as_deref(),
            Some("desktop")
        );
        assert!(!drive.in_trash(&file));
    }

    #[test]
    fn nothing_goes_into_a_trashed_or_missing_folder() {
        let mut drive = Drive::fresh(1);
        let mut next = ids();
        let folder = drive
            .apply(&[mkdir("documents", "Old")], 2, &mut next)
            .unwrap()[0]
            .clone();
        drive
            .apply(&[Op::Trash { id: folder.clone() }], 3, &mut next)
            .unwrap();
        assert_eq!(
            drive
                .clone()
                .apply(&[mkdir(&folder, "x")], 4, &mut next)
                .unwrap_err()
                .status(),
            409
        );
        let err = drive
            .add_file(
                &folder,
                "a.txt",
                "",
                1,
                "c",
                Existing::Rename,
                4,
                "f".into(),
            )
            .unwrap_err();
        assert_eq!(err.status(), 409);
        assert_eq!(
            drive
                .clone()
                .apply(&[mkdir("nowhere", "x")], 4, &mut next)
                .unwrap_err()
                .status(),
            404
        );
    }

    #[test]
    fn the_quota_and_the_entry_limit_hold() {
        let mut drive = Drive::fresh(1);
        drive
            .add_file(
                "movies",
                "Big.mov",
                "video/quicktime",
                QUOTA_BYTES - 10,
                "c1",
                Existing::Rename,
                2,
                "f1".into(),
            )
            .unwrap();
        let full = drive
            .add_file(
                "movies",
                "More.mov",
                "video/quicktime",
                11,
                "c2",
                Existing::Rename,
                3,
                "f2".into(),
            )
            .unwrap_err();
        assert_eq!(full.status(), 507);
        assert!(drive.find("f2").is_none() && !drive.contents.contains_key("c2"));
        let mut drive = Drive::fresh(1);
        let mut next = ids();
        let ops: Vec<Op> = (0..MAX_ENTRIES)
            .map(|n| mkdir("documents", &format!("f{n}")))
            .collect();
        assert_eq!(drive.apply(&ops, 2, &mut next).unwrap_err().status(), 507);
    }

    #[test]
    fn get_info_keeps_its_settings_and_a_locked_entry_stays_put() {
        let (mut drive, report) = with_report();
        let mut next = ids();
        drive
            .apply(
                &[Op::Info {
                    id: report.clone(),
                    comment: Some("Read it".into()),
                    locked: Some(true),
                    hide_extension: Some(true),
                    stationery: None,
                }],
                2,
                &mut next,
            )
            .unwrap();
        let entry = drive.entries.iter().find(|e| e.id == report).unwrap();
        assert_eq!(entry.comment, "Read it");
        assert!(entry.locked && entry.hide_extension && !entry.stationery);
        for op in [
            Op::Trash { id: report.clone() },
            Op::Delete { id: report.clone() },
            Op::Rename {
                id: report.clone(),
                name: "Other.txt".into(),
            },
            Op::Move {
                id: report.clone(),
                parent: "desktop".into(),
                name: None,
                existing: Existing::Fail,
            },
        ] {
            let refused = drive.apply(&[op], 3, &mut next).unwrap_err();
            assert_eq!(refused.status(), 409);
        }
        assert_eq!(names_in(&drive, "documents"), ["Report.txt"]);
        drive
            .apply(
                &[Op::Info {
                    id: report.clone(),
                    comment: None,
                    locked: Some(false),
                    hide_extension: None,
                    stationery: None,
                }],
                4,
                &mut next,
            )
            .unwrap();
        drive
            .apply(&[Op::Trash { id: report.clone() }], 5, &mut next)
            .unwrap();
        assert_eq!(trash_names(&drive), ["Report.txt"]);
        let long = Op::Info {
            id: "desktop".into(),
            comment: Some("x".repeat(MAX_COMMENT_BYTES + 1)),
            locked: None,
            hide_extension: None,
            stationery: None,
        };
        assert_eq!(
            drive.apply(&[long], 6, &mut next).unwrap_err().status(),
            400
        );
    }

    #[test]
    fn a_locked_entry_inside_what_goes_keeps_it_all_in_place() {
        let (mut drive, report) = with_report();
        let mut next = ids();
        let made = drive
            .apply(&[mkdir("documents", "Box")], 2, &mut next)
            .unwrap();
        let folder = made[0].clone();
        let lock = |id: &str, locked: bool| Op::Info {
            id: id.into(),
            comment: None,
            locked: Some(locked),
            hide_extension: None,
            stationery: None,
        };
        let inside = Op::Move {
            id: report.clone(),
            parent: folder.clone(),
            name: None,
            existing: Existing::Fail,
        };
        drive
            .apply(&[inside, lock(&report, true)], 3, &mut next)
            .unwrap();

        for op in [
            Op::Delete { id: folder.clone() },
            Op::Trash { id: folder.clone() },
        ] {
            assert_eq!(drive.apply(&[op], 4, &mut next).unwrap_err().status(), 409);
        }
        assert_eq!(names_in(&drive, &folder), ["Report.txt"]);

        // A file named the same cannot replace what is locked.
        let other = drive
            .apply(&[mkdir("documents", "Box 2")], 5, &mut next)
            .unwrap();
        let mut named = Op::Mkdir {
            parent: other[0].clone(),
            name: "Box".into(),
            existing: Existing::Fail,
        };
        let made = drive.apply(&[named.clone()], 6, &mut next).unwrap();
        named = Op::Move {
            id: made[0].clone(),
            parent: "documents".into(),
            name: None,
            existing: Existing::Replace,
        };
        assert_eq!(
            drive.apply(&[named], 7, &mut next).unwrap_err().status(),
            409
        );
        assert_eq!(names_in(&drive, &folder), ["Report.txt"]);

        // Something in the Trash that was locked there stays until it is unlocked.
        drive
            .apply(
                &[
                    lock(&report, false),
                    Op::Trash { id: folder.clone() },
                    lock(&report, true),
                ],
                8,
                &mut next,
            )
            .unwrap();
        assert_eq!(
            drive
                .apply(&[Op::EmptyTrash], 9, &mut next)
                .unwrap_err()
                .status(),
            409
        );
        assert_eq!(trash_names(&drive), ["Box"]);
        drive
            .apply(&[lock(&report, false), Op::EmptyTrash], 10, &mut next)
            .unwrap();
        assert!(trash_names(&drive).is_empty());
    }

    #[test]
    fn tags_opened_and_types_are_kept_clean() {
        let (mut drive, report) = with_report();
        let mut next = ids();
        drive
            .apply(
                &[
                    Op::Tag {
                        id: report.clone(),
                        tags: vec!["Red".into(), "Work".into(), "Red".into()],
                    },
                    Op::Opened { id: report.clone() },
                ],
                9,
                &mut next,
            )
            .unwrap();
        let entry = drive.find(&report).unwrap();
        assert_eq!(entry.tags, ["Red", "Work"]);
        assert_eq!(entry.opened_ms, Some(9));
        assert_eq!(
            drive
                .clone()
                .apply(&[Op::Opened { id: "music".into() }], 9, &mut next)
                .unwrap_err()
                .status(),
            400
        );
        assert_eq!(clean_type("Image/PNG"), "image/png");
        assert_eq!(clean_type("text/plain; charset=utf-8"), "text/plain");
        assert_eq!(clean_type("<script>"), "");
        assert_eq!(clean_type(""), "");
    }

    #[test]
    fn requests_are_remembered_for_resends() {
        let mut drive = Drive::fresh(1);
        let start = 10_000;
        for n in 0..DONE_KEPT {
            assert!(drive.can_remember(start + n as u64));
            drive.remember(&format!("k{n}"), &[format!("e{n}")], start + n as u64);
        }
        // Full of young records: the next keyed request must wait, and none
        // of them is forgotten.
        assert!(!drive.can_remember(start + DONE_KEPT as u64));
        assert_eq!(drive.done("k0").unwrap().created, ["e0"]);
        // Once the oldest is past the window it makes room.
        let later = start + REMEMBER_MS;
        assert!(drive.can_remember(later));
        drive.remember("new", &["e-new".into()], later);
        assert!(drive.done("k0").is_none());
        assert_eq!(drive.done("k1").unwrap().created, ["e1"]);
        assert_eq!(drive.done("new").unwrap().created, ["e-new"]);
        assert_eq!(drive.done.len(), DONE_KEPT);
    }

    #[test]
    fn ops_parse_from_the_wire() {
        let ops: Vec<Op> = serde_json::from_str(
            r#"[{"op":"mkdir","parent":"documents","name":"A","existing":"reuse"},{"op":"empty-trash"},{"op":"move","id":"x","parent":"y"}]"#,
        )
        .unwrap();
        assert_eq!(ops[1], Op::EmptyTrash);
        assert!(matches!(
            &ops[0],
            Op::Mkdir {
                existing: Existing::Reuse,
                ..
            }
        ));
        assert!(matches!(
            &ops[2],
            Op::Move {
                name: None,
                existing: Existing::Rename,
                ..
            }
        ));
        assert!(serde_json::from_str::<Op>(r#"{"op":"format-disk"}"#).is_err());
    }

    #[test]
    fn the_view_hides_content_ids() {
        let (drive, _) = with_report();
        let view = drive.view();
        assert!(view["entries"]
            .as_array()
            .unwrap()
            .iter()
            .all(|e| e.get("content").is_none()));
        assert_eq!(view["usage"], 1000);
        assert_eq!(view["piece_bytes"], PIECE_BYTES);
    }

    /// A drive with `Documents/Letter.txt`, 10 bytes of content c0, written at time 1000.
    fn with_letter() -> Drive {
        let mut drive = Drive::fresh(1);
        drive
            .add_file(
                "documents",
                "Letter.txt",
                "text/plain",
                10,
                "c0",
                Existing::Rename,
                1000,
                "f0".into(),
            )
            .unwrap();
        drive
    }

    /// Saves `size` bytes of `content` in place of the file f0 at `now_ms`.
    fn save(drive: &mut Drive, content: &str, size: u64, now_ms: u64) {
        let id = format!("up-{content}");
        drive
            .open_upload(
                id.clone(),
                OpenUpload {
                    existing: ExistingText::Overwrite,
                    replaces: Some("f0".into()),
                    ..upload("documents", "Letter.txt", size, content)
                },
            )
            .unwrap();
        drive.complete_upload(&id, now_ms, "unused".into()).unwrap();
    }

    fn kept(drive: &Drive) -> Vec<(u64, String)> {
        drive
            .versions
            .get("f0")
            .map(|list| {
                list.iter()
                    .map(|k| (k.version, k.content.clone()))
                    .collect()
            })
            .unwrap_or_default()
    }

    #[test]
    fn a_save_in_place_keeps_what_it_replaced_and_lists_nothing_new() {
        let mut drive = with_letter();
        let listed = drive.view()["entries"].as_array().unwrap().len();
        save(&mut drive, "c1", 20, 2000);
        assert_eq!(kept(&drive), [(0, "c0".to_string())]);
        assert_eq!(
            drive.usage(),
            30,
            "the kept bytes count in the person's storage"
        );
        assert!(drive.garbage.is_empty());
        let view = drive.view();
        assert_eq!(view["entries"].as_array().unwrap().len(), listed);
        assert!(view.get("versions").is_none());
        assert_eq!(view["usage"], 30);

        let versions = drive.versions_view("f0").unwrap();
        assert_eq!(
            versions,
            serde_json::json!({
                "file": "f0", "version": 1, "size": 20, "modified_ms": 2000,
                "versions": [{
                    "version": 0, "size": 10, "type": "text/plain", "modified_ms": 1000,
                    "saved": false,
                }],
            })
        );
        assert!(drive.versions_view("documents").is_none());
        assert!(drive.versions_view("nothing").is_none());
    }

    #[test]
    fn a_drive_stored_before_versions_goes_on_working_and_a_drive_with_none_stores_none() {
        let stored = r#"{"entries":[{"id":"f0","parent":"documents","name":"a","kind":"file",
            "size":3,"content":"c0","created_ms":1,"modified_ms":1}],
            "contents":{"c0":{"size":3,"pieces":1}}}"#;
        let mut drive: Drive = serde_json::from_str(stored).unwrap();
        drive.ensure_special(1);
        assert!(drive.versions.is_empty());
        assert_eq!(
            drive.versions_view("f0").unwrap()["versions"],
            serde_json::json!([])
        );
        assert!(!serde_json::to_string(&drive).unwrap().contains("versions"));
        save(&mut drive, "c1", 4, 50);
        assert_eq!(kept(&drive), [(0, "c0".to_string())]);
    }

    #[test]
    fn a_file_keeps_twenty_versions_and_the_oldest_bytes_go_to_the_garbage() {
        let mut drive = with_letter();
        for n in 1..=25u64 {
            save(
                &mut drive,
                &format!("c{n}"),
                10,
                1000 + n * VERSION_SPACING_MS,
            );
        }
        let list = kept(&drive);
        assert_eq!(list.len(), VERSIONS_PER_FILE);
        assert_eq!(list[0], (5, "c5".to_string()));
        assert_eq!(list[19], (24, "c24".to_string()));
        let gone: Vec<&str> = drive.garbage.iter().map(|g| g.content.as_str()).collect();
        assert_eq!(gone, ["c0", "c1", "c2", "c3", "c4"]);
        assert_eq!(drive.usage(), 210, "twenty versions and the file");
    }

    #[test]
    fn autosave_between_saves_keeps_what_was_saved_and_one_version_per_spacing() {
        let mut drive = with_letter();
        // Written every second for a minute: the first bytes and the last before these.
        for n in 1..=60u64 {
            save(&mut drive, &format!("a{n}"), 10, 1000 + n * 1000);
        }
        assert_eq!(
            kept(&drive),
            [(0, "c0".to_string()), (59, "a59".to_string())]
        );
        // File > Save marks the bytes as they are now, twice over a lost reply.
        drive.keep_version("f0", Some(60)).unwrap();
        drive.keep_version("f0", Some(60)).unwrap();
        assert_eq!(
            kept(&drive),
            [(0, "c0".to_string()), (60, "a60".to_string())]
        );
        assert!(drive.kept_version("f0", 60).unwrap().saved);
        assert_eq!(
            drive.keep_version("f0", Some(3)).unwrap_err().status(),
            412,
            "only the bytes the page saved"
        );
        // The next autosaves leave it standing, whatever the spacing.
        for n in 61..=64u64 {
            save(&mut drive, &format!("a{n}"), 10, 62_000 + n);
        }
        assert_eq!(
            kept(&drive),
            [
                (0, "c0".to_string()),
                (60, "a60".to_string()),
                (63, "a63".to_string())
            ]
        );
        // Past the spacing, an autosave stays too.
        for (at, name) in [(1, "a65"), (2, "a66"), (3, "a67")] {
            save(&mut drive, name, 10, 62_064 + at * VERSION_SPACING_MS);
        }
        assert_eq!(
            kept(&drive),
            [
                (0, "c0".to_string()),
                (60, "a60".to_string()),
                (65, "a65".to_string()),
                (66, "a66".to_string())
            ]
        );
    }

    #[test]
    fn the_oldest_versions_give_way_to_a_save_or_an_upload_and_never_refuse_one() {
        let mut drive = with_letter();
        // The file at the largest size, then saved over: its old bytes are kept, and with the
        // quota passed, the very oldest give way at once.
        assert_eq!(QUOTA_BYTES, 2 * MAX_FILE_BYTES, "the arithmetic below");
        save(&mut drive, "c1", MAX_FILE_BYTES, 2000);
        assert_eq!(kept(&drive), [(0, "c0".to_string())]);
        save(&mut drive, "c2", MAX_FILE_BYTES - 1, 3000);
        assert_eq!(kept(&drive), [(1, "c1".to_string())]);
        assert_eq!(drive.usage(), QUOTA_BYTES - 1);

        // A new file needs c1's room, and those bytes are real until they are deleted: the drive
        // gives c1 up and asks to wait.
        let another = drive.open_upload(
            "u2".into(),
            upload("documents", "Movie.mov", MAX_FILE_BYTES, "c9"),
        );
        assert_eq!(another.unwrap_err().status(), 429);
        assert!(
            drive.versions.is_empty(),
            "the versions it gave up stay given up"
        );
        assert!(drive.garbage.iter().any(|g| g.content == "c1"));
        // Once they are deleted, it fits.
        drive.garbage.clear();
        drive
            .open_upload(
                "u2".into(),
                upload("documents", "Movie.mov", MAX_FILE_BYTES, "c9"),
            )
            .unwrap();
        drive.complete_upload("u2", 3000, "f2".into()).unwrap();
        assert!(drive.find("f2").is_some());
        assert_eq!(drive.usage(), QUOTA_BYTES - 1);

        // On a full drive a same-size save still goes in, and keeps nothing that does not fit.
        save(&mut drive, "c3", MAX_FILE_BYTES - 1, 4000);
        assert_eq!(drive.usage(), QUOTA_BYTES - 1);
        assert_eq!(drive.find("f0").unwrap().content.as_deref(), Some("c3"));
        assert!(drive.versions.is_empty());
        assert!(drive.garbage.iter().any(|g| g.content == "c2"));
    }

    #[test]
    fn an_upload_too_big_even_without_versions_drops_none_of_them() {
        let mut drive = with_letter();
        save(&mut drive, "c1", 20, 2000);
        let plain = drive.clone();
        let mut too_big = upload("documents", "Big.mov", QUOTA_BYTES, "c9");
        too_big.size = MAX_FILE_BYTES;
        drive.open_upload("u1".into(), too_big.clone()).unwrap();
        let second = upload("documents", "Big 2.mov", MAX_FILE_BYTES, "c8");
        assert_eq!(
            drive.open_upload("u2".into(), second).unwrap_err().status(),
            507,
            "30 bytes do not fit, and the file itself is 20 of them"
        );
        assert_eq!(drive.versions, plain.versions);
    }

    #[test]
    fn the_trash_keeps_a_files_versions_and_erasing_it_frees_them() {
        let mut drive = with_letter();
        save(&mut drive, "c1", 20, 2000);
        save(&mut drive, "c2", 30, 2000 + VERSION_SPACING_MS);
        let mut next = ids();
        let trash = Op::Trash { id: "f0".into() };
        drive.apply(&[trash], 5000, &mut next).unwrap();
        assert_eq!(kept(&drive).len(), 2, "Put Back brings the file back whole");
        assert_eq!(drive.usage(), 60);

        drive.apply(&[Op::EmptyTrash], 5001, &mut next).unwrap();
        assert!(drive.versions.is_empty());
        assert_eq!(drive.usage(), 0);
        assert!(drive.contents.is_empty());
        let mut gone: Vec<&str> = drive.garbage.iter().map(|g| g.content.as_str()).collect();
        gone.sort_unstable();
        assert_eq!(gone, ["c0", "c1", "c2"]);

        // Deleted at once, the same.
        let mut drive = with_letter();
        save(&mut drive, "c1", 20, 2000);
        let delete = Op::Delete { id: "f0".into() };
        drive.apply(&[delete], 5000, &mut next).unwrap();
        assert!(drive.versions.is_empty());
        assert_eq!(drive.usage(), 0);
    }

    #[test]
    fn a_copy_keeps_its_date_unless_told_to_date_it_now() {
        let mut drive = with_letter();
        let mut next = ids();
        let before = drive.find("f0").unwrap().modified_ms;
        let copy = |name: &str, dated_now| Op::Copy {
            id: "f0".into(),
            parent: "documents".into(),
            name: Some(name.into()),
            existing: Existing::Fail,
            dated_now,
        };
        let kept = drive
            .apply(&[copy("Kept.txt", false)], before + 50, &mut next)
            .unwrap();
        let fresh = drive
            .apply(&[copy("Fresh.txt", true)], before + 90, &mut next)
            .unwrap();
        assert_eq!(drive.find(&kept[0]).unwrap().modified_ms, before);
        assert_eq!(drive.find(&fresh[0]).unwrap().modified_ms, before + 90);
    }

    #[test]
    fn a_copy_shares_the_bytes_but_not_the_history() {
        let mut drive = with_letter();
        let mut next = ids();
        let copy = Op::Copy {
            id: "f0".into(),
            parent: "documents".into(),
            name: Some("Copy.txt".into()),
            existing: Existing::Rename,
            dated_now: false,
        };
        let made = drive.apply(&[copy], 1500, &mut next).unwrap();
        save(&mut drive, "c1", 20, 2000);
        assert_eq!(kept(&drive).len(), 1);
        assert_eq!(
            drive.versions_view(&made[0]).unwrap()["versions"],
            serde_json::json!([])
        );
        // Erasing the file leaves the bytes the copy still names.
        let delete = Op::Delete { id: "f0".into() };
        drive.apply(&[delete], 3000, &mut next).unwrap();
        assert!(drive.contents.contains_key("c0"));
        assert!(!drive.contents.contains_key("c1"));
    }

    #[test]
    fn a_restore_makes_a_version_current_keeps_what_it_replaced_and_can_run_twice() {
        let mut drive = with_letter();
        save(&mut drive, "c1", 20, 1000 + VERSION_SPACING_MS);
        save(&mut drive, "c2", 30, 1000 + 2 * VERSION_SPACING_MS);
        let usage = drive.usage();
        drive.restore_version("f0", 0, Some(2), 900_000).unwrap();
        let file = drive.find("f0").unwrap();
        assert_eq!(file.content.as_deref(), Some("c0"));
        assert_eq!(file.size, 10);
        assert_eq!(file.version, 3);
        assert_eq!(file.modified_ms, 900_000);
        assert_eq!(
            kept(&drive),
            [
                (0, "c0".to_string()),
                (1, "c1".to_string()),
                (2, "c2".to_string())
            ]
        );
        assert_eq!(drive.usage(), usage, "no byte was written or freed");
        assert!(drive.garbage.is_empty());
        // The list leaves out the bytes the file holds now.
        let shown = drive.versions_view("f0").unwrap();
        let numbers: Vec<u64> = shown["versions"]
            .as_array()
            .unwrap()
            .iter()
            .map(|v| v["version"].as_u64().unwrap())
            .collect();
        assert_eq!(numbers, [2, 1]);

        // The same request again, its reply lost: it ends the same, base and all.
        let once = drive.clone();
        drive.restore_version("f0", 0, Some(2), 950_000).unwrap();
        assert_eq!(drive, once);

        // Saved again, the restored bytes are not kept a second time.
        save(&mut drive, "c4", 40, 960_000);
        assert_eq!(kept(&drive).len(), 3);
        assert_eq!(drive.find("f0").unwrap().version, 4);
    }

    #[test]
    fn a_restore_of_the_oldest_of_a_full_list_stays_run_twice() {
        let mut drive = with_letter();
        for n in 1..=20u64 {
            save(
                &mut drive,
                &format!("c{n}"),
                10,
                1000 + n * VERSION_SPACING_MS,
            );
        }
        assert_eq!(kept(&drive).len(), VERSIONS_PER_FILE);
        assert_eq!(kept(&drive)[0].0, 0);
        drive
            .restore_version("f0", 0, Some(20), 99_000_000)
            .unwrap();
        let once = drive.clone();
        assert_eq!(kept(&drive).len(), VERSIONS_PER_FILE);
        assert_eq!(kept(&drive)[0], (0, "c0".to_string()));
        assert_eq!(kept(&drive)[1].0, 2, "the next oldest went instead");
        assert_eq!(kept(&drive)[19], (20, "c20".to_string()));
        drive
            .restore_version("f0", 0, Some(20), 99_000_001)
            .unwrap();
        assert_eq!(drive, once);
    }

    #[test]
    fn a_restore_is_refused_for_a_stale_page_a_lost_version_a_locked_or_trashed_file() {
        let mut drive = with_letter();
        save(&mut drive, "c1", 20, 2000);
        let plain = drive.clone();
        let refused = drive.restore_version("f0", 9, None, 3000).unwrap_err();
        assert_eq!(refused.status(), 404);
        let stale = drive.restore_version("f0", 0, Some(0), 3000).unwrap_err();
        assert_eq!(stale.status(), 412);
        assert_eq!(drive, plain);

        let mut next = ids();
        let lock = Op::Info {
            id: "f0".into(),
            comment: None,
            locked: Some(true),
            hide_extension: None,
            stationery: None,
        };
        drive.apply(&[lock], 3000, &mut next).unwrap();
        let locked = drive.restore_version("f0", 0, None, 3000).unwrap_err();
        assert_eq!(locked.status(), 409);
        let unlock = Op::Info {
            id: "f0".into(),
            comment: None,
            locked: Some(false),
            hide_extension: None,
            stationery: None,
        };
        let trash = Op::Trash { id: "f0".into() };
        drive.apply(&[unlock, trash], 3000, &mut next).unwrap();
        let trashed = drive.restore_version("f0", 0, None, 3000).unwrap_err();
        assert_eq!(trashed.status(), 409);
    }

    #[test]
    fn versions_stay_within_the_drives_places_and_document_size() {
        let mut drive = with_letter();
        save(&mut drive, "c1", 10, 1000 + VERSION_SPACING_MS);
        save(&mut drive, "c2", 10, 1000 + 2 * VERSION_SPACING_MS);
        // Fill the items: the versions give up their places, the oldest first.
        let mut next = ids();
        let folders: Vec<Op> = (0..64)
            .map(|n| mkdir("documents", &format!("d{n}")))
            .collect();
        while drive.entries.len() + 64 < MAX_ENTRIES {
            drive.apply(&folders, 3000, &mut next).unwrap();
        }
        let left = MAX_ENTRIES - drive.entries.len();
        let last: Vec<Op> = (0..left - 1)
            .map(|n| mkdir("documents", &format!("last {n}")))
            .collect();
        drive.apply(&last, 3000, &mut next).unwrap();
        assert_eq!(
            kept(&drive),
            [(1, "c1".to_string())],
            "one place left: the newest stays"
        );
        // Past the document's budget, none.
        for n in 0..1800 {
            drive.done.push(Done {
                key: format!("upload:{n:0>64}"),
                created: vec![format!("{n:0>32}")],
                at_ms: 3000,
                version: None,
            });
        }
        assert!(serde_json::to_vec(&drive).unwrap().len() > VERSIONS_DOCUMENT_BYTES);
        drive.collect();
        assert!(drive.versions.is_empty());
    }

    #[test]
    fn a_drive_keeps_at_most_two_hundred_versions_across_its_files() {
        let mut drive = Drive::fresh(1);
        let mut time = 1000;
        for file in 0..12 {
            let id = format!("f{file}");
            drive
                .add_file(
                    "documents",
                    &format!("{id}.txt"),
                    "text/plain",
                    1,
                    &format!("{id}-0"),
                    Existing::Rename,
                    time,
                    id.clone(),
                )
                .unwrap();
            for n in 1..=20 {
                time += VERSION_SPACING_MS;
                let upload_id = format!("{id}-up-{n}");
                drive
                    .open_upload(
                        upload_id.clone(),
                        OpenUpload {
                            existing: ExistingText::Overwrite,
                            replaces: Some(id.clone()),
                            ..upload("documents", "x", 1, &format!("{id}-{n}"))
                        },
                    )
                    .unwrap();
                drive
                    .complete_upload(&upload_id, time, "unused".into())
                    .unwrap();
            }
        }
        assert_eq!(drive.versions_kept(), VERSIONS_PER_DRIVE);
        assert!(
            !drive.versions.contains_key("f0"),
            "the oldest went, whole files of them"
        );
        assert_eq!(drive.versions["f11"].len(), VERSIONS_PER_FILE);
    }
}

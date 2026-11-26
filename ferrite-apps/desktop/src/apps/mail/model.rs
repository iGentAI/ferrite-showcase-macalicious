//! Mail's model: a message as each person's mailbox keeps it, the mailboxes,
//! flags and desktop addresses, and the checks a sent message passes. Nothing
//! here does I/O (`mod.rs` stores and delivers).

use ferrite_app::{serde, serde_json};

/// The longest subject, in characters.
pub const MAX_SUBJECT_CHARS: usize = 300;
/// The longest plain text of a message, in characters.
pub const MAX_TEXT_CHARS: usize = 100_000;
/// The longest styled text (HTML) of a message, in bytes.
pub const MAX_HTML_BYTES: usize = 200_000;
/// How much of the plain text a message's header carries, for the message
/// list's preview and for search, in characters.
pub const TEXT_INDEX_CHARS: usize = 4_000;
/// The most recipients (To and Cc together).
pub const MAX_RECIPIENTS: usize = 20;
/// The most attachments of one message.
pub const MAX_ATTACHMENTS: usize = 10;
/// The most messages a mailbox listing returns at once: the newest, with a
/// cursor for the next.
pub const LIST_LIMIT: usize = 500;
/// About the most bytes of headers one listing reads and answers: a header
/// holds up to [`TEXT_INDEX_CHARS`] of text, which JSON may write in six
/// bytes a character, so a page stops early rather than pass the reply
/// limit (about 4 MiB).
pub const PAGE_BYTES: usize = 1024 * 1024;
/// The most bytes a stored body (its text and styled text together, as JSON)
/// may take: the store holds 200 KB a value.
pub const BODY_BUDGET: usize = 190_000;
/// The domain of a desktop address: `<account name>@macalicious`. It names an
/// account of this desktop; it is not an internet mail domain.
pub const DOMAIN: &str = "macalicious";

/// The most mailboxes one person may make.
pub const MAX_OWN_MAILBOXES: usize = 200;
/// The longest name of a person's own mailbox, in characters.
pub const MAX_MAILBOX_NAME_CHARS: usize = 100;

/// A mailbox: one of the six every person has, or one the person made
/// (`box-` and 16 hex digits, named by an [`OwnMailbox`]).
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Mailbox {
    Inbox,
    Drafts,
    Sent,
    Junk,
    Trash,
    Archive,
    Own(String),
}

impl Mailbox {
    /// How the mailbox is written in a header and on the wire.
    pub fn as_str(&self) -> &str {
        match self {
            Mailbox::Inbox => "inbox",
            Mailbox::Drafts => "drafts",
            Mailbox::Sent => "sent",
            Mailbox::Junk => "junk",
            Mailbox::Trash => "trash",
            Mailbox::Archive => "archive",
            Mailbox::Own(id) => id,
        }
    }
}

impl serde::Serialize for Mailbox {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(self.as_str())
    }
}

impl<'de> serde::Deserialize<'de> for Mailbox {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let raw = <String as serde::Deserialize>::deserialize(deserializer)?;
        Ok(match raw.as_str() {
            "inbox" => Mailbox::Inbox,
            "drafts" => Mailbox::Drafts,
            "sent" => Mailbox::Sent,
            "junk" => Mailbox::Junk,
            "trash" => Mailbox::Trash,
            "archive" => Mailbox::Archive,
            own if is_own_mailbox_id(own) => Mailbox::Own(raw),
            _ => return Err(<D::Error as serde::de::Error>::custom("no such mailbox")),
        })
    }
}

/// Whether `id` can be the id of a mailbox a person made.
pub fn is_own_mailbox_id(id: &str) -> bool {
    id.strip_prefix("box-").is_some_and(|hex| {
        hex.len() == 16 && hex.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
    })
}

/// A mailbox a person made, in the list kept under `mailboxes`.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct OwnMailbox {
    pub id: String,
    pub name: String,
}

/// The name kept for a mailbox, or why it cannot be one: not empty, not too
/// long, no line breaks, and not the name of one of the six every person has.
pub fn clean_mailbox_name(name: &str) -> Result<String, &'static str> {
    let name = name.trim();
    if name.is_empty() {
        return Err("a mailbox needs a name");
    }
    if name.chars().count() > MAX_MAILBOX_NAME_CHARS {
        return Err("a mailbox's name is at most 100 characters");
    }
    if name.chars().any(char::is_control) {
        return Err("a mailbox's name is one line");
    }
    if ["inbox", "drafts", "sent", "junk", "trash", "archive"]
        .iter()
        .any(|fixed| name.eq_ignore_ascii_case(fixed))
    {
        return Err("Mail already has a mailbox with that name");
    }
    Ok(name.to_string())
}

/// A flag's colour: the seven of Mail.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum Flag {
    Red,
    Orange,
    Yellow,
    Green,
    Blue,
    Purple,
    Gray,
}

/// A person a message is from or to: an account name of the desktop and its
/// full name. A draft's recipients are kept as typed, with no full name.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Address {
    pub name: String,
    #[serde(default)]
    pub full_name: String,
}

/// A message's priority, when it is not normal.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", rename_all = "lowercase")]
pub enum Priority {
    Low,
    High,
}

/// A message as one mailbox keeps it (`m/<id>`): everything the message list
/// shows, and the start of its text for search. Its full text and its styled
/// text are the [`Body`] (`b/<id>`).
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Header {
    pub id: String,
    pub mailbox: Mailbox,
    pub from: Address,
    pub to: Vec<Address>,
    #[serde(default)]
    pub cc: Vec<Address>,
    /// Those written to unseen: only the sender's Sent copy and a draft name them.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub bcc: Vec<Address>,
    /// Where a reply goes in place of `from`, as it was typed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reply_to: Option<String>,
    /// A priority other than normal.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub priority: Option<Priority>,
    pub subject: String,
    pub at_ms: u64,
    #[serde(default)]
    pub unread: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub flag: Option<Flag>,
    #[serde(default)]
    pub muted: bool,
    /// Delivered to the Inbox, and the person's rules have not run on it yet: they run on it once,
    /// from whichever browser asks first ([`Patch::rules_ran`]). Mail stored before this field
    /// reads as already run, so rules never reach back over old mail by themselves.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub rules_pending: bool,
    /// The first [`TEXT_INDEX_CHARS`] characters of the plain text.
    pub text: String,
    /// The files that came with it; every copy of the message names them.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<super::attachments::Attachment>,
    /// Whether the message has styled text.
    #[serde(default)]
    pub html: bool,
}

/// A message's text.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Body {
    pub text: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub html: Option<String>,
}

/// What a recipient typed in To or Cc names.
#[derive(Debug, PartialEq, Eq)]
pub enum Recipient {
    /// An account of this desktop, by its account name.
    Desktop(String),
    /// An internet address, which this desktop has no provider to send to.
    Outside(String),
    /// Nothing that can be an address.
    Invalid,
}

/// Read one recipient token: `martin`, `martin@macalicious`,
/// `Martin Klein <martin@macalicious>` or `Martin Klein (martin)`.
pub fn recipient(raw: &str) -> Recipient {
    let mut token = raw.trim();
    if let (Some(open), true) = (token.rfind('<'), token.ends_with('>')) {
        token = &token[open + 1..token.len() - 1];
    } else if let (Some(open), true) = (token.rfind('('), token.ends_with(')')) {
        token = &token[open + 1..token.len() - 1];
    }
    let token = token.trim();
    let local = match token.rsplit_once('@') {
        Some((local, domain)) if domain.eq_ignore_ascii_case(DOMAIN) => local,
        Some((local, domain)) if !local.is_empty() && domain.contains('.') => {
            return Recipient::Outside(token.to_string())
        }
        Some(_) => return Recipient::Invalid,
        None => token,
    };
    match crate::accounts::account_name(local) {
        Some(name) if name != "guest" => Recipient::Desktop(name),
        _ => Recipient::Invalid,
    }
}

/// The desktop address of account `name`.
pub fn address_of(name: &str) -> String {
    format!("{name}@{DOMAIN}")
}

/// A message's id: the time it was sent counted down (so that key order is
/// newest first), a dash and 16 random hex digits.
pub fn message_id(at_ms: u64, random: &str) -> String {
    format!(
        "{:016x}-{}",
        u64::MAX - at_ms,
        &random[..16.min(random.len())]
    )
}

/// Whether `id` can be a message's id.
pub fn is_message_id(id: &str) -> bool {
    let hex = |part: &str| {
        part.len() == 16 && part.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
    };
    id.split_once('-').is_some_and(|(a, b)| hex(a) && hex(b))
}

/// The subject a message's conversation goes by: without its Re: and Fwd:, in one case, as the page's
/// `threadSubject`. `None` for a message with no subject, which is in no conversation.
pub fn thread_subject(subject: &str) -> Option<String> {
    let mut rest = subject.trim();
    loop {
        let lower = rest.to_ascii_lowercase();
        let after = ["re", "fwd", "fw"].iter().find_map(|prefix| {
            lower
                .strip_prefix(prefix)
                .map(str::trim_start)
                .and_then(|tail| tail.strip_prefix(':'))
        });
        let Some(after) = after else { break };
        rest = rest[lower.len() - after.len()..].trim_start();
    }
    let subject = rest.trim().to_lowercase();
    (!subject.is_empty() && subject != "(no subject)").then_some(subject)
}

/// Everyone on a message but `me`, as the page's conversations read a message.
pub fn people_on(header: &Header, me: &str) -> Vec<String> {
    std::iter::once(&header.from)
        .chain(&header.to)
        .chain(&header.cc)
        .filter(|person| person.name != me)
        .map(|person| person.name.clone())
        .collect()
}

pub fn header_key(id: &str) -> String {
    format!("m/{id}")
}

pub fn body_key(id: &str) -> String {
    format!("b/{id}")
}

/// The first `max` characters of `text`.
pub fn prefix(text: &str, max: usize) -> String {
    text.chars().take(max).collect()
}

/// The subject kept: trimmed, without line breaks, `(No Subject)` when empty.
pub fn clean_subject(subject: &str) -> Result<String, &'static str> {
    let subject: String = subject
        .trim()
        .chars()
        .map(|c| if c.is_control() { ' ' } else { c })
        .collect();
    if subject.chars().count() > MAX_SUBJECT_CHARS {
        return Err("a subject is at most 300 characters");
    }
    Ok(if subject.is_empty() {
        "(No Subject)".into()
    } else {
        subject
    })
}

/// Check a message's texts against their limits, and that the body they
/// make fits in one stored value ([`BODY_BUDGET`]).
pub fn check_texts(text: &str, html: Option<&str>) -> Result<(), &'static str> {
    if text.chars().count() > MAX_TEXT_CHARS {
        return Err("a message's text is at most 100,000 characters");
    }
    if html.is_some_and(|html| html.len() > MAX_HTML_BYTES) {
        return Err("a message's styled text is at most 200 KB");
    }
    let body = Body {
        text: text.to_string(),
        html: html.map(str::to_string),
    };
    if serde_json::to_vec(&body).map_or(usize::MAX, |bytes| bytes.len()) > BODY_BUDGET {
        return Err("a message's text and styled text together are at most 190 KB");
    }
    Ok(())
}

/// A change to one message (`PATCH /messages/<id>`).
#[derive(serde::Deserialize, Default, Debug)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Patch {
    #[serde(default)]
    pub unread: Option<bool>,
    /// A colour, or `null` to clear the flag; absent leaves it.
    #[serde(default, deserialize_with = "present")]
    pub flag: Option<serde_json::Value>,
    /// A priority, or `null` for normal; absent leaves it.
    #[serde(default, deserialize_with = "present")]
    pub priority: Option<serde_json::Value>,
    #[serde(default)]
    pub muted: Option<bool>,
    #[serde(default)]
    pub mailbox: Option<Mailbox>,
    /// This patch is what the rules made of new mail: taken only while the message is
    /// [`Header::rules_pending`], and it ends that. Otherwise it changes nothing, so two browsers
    /// cannot both run the rules, and a person's own change since is not overruled.
    #[serde(default)]
    pub rules_ran: bool,
    /// Message > Remove Attachments: the message no longer names its files. The bytes stay for
    /// any other copy that names them.
    #[serde(default)]
    pub remove_attachments: bool,
    /// Only while the message is in this mailbox: a move decided from an
    /// older read leaves a message that has gone elsewhere as it is. Set by
    /// the server, never by a request.
    #[serde(skip)]
    pub only_from: Option<Mailbox>,
}

/// A field that is present, `null` included (an absent one is `None` through
/// `default`).
fn present<'de, D>(deserializer: D) -> Result<Option<serde_json::Value>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    <serde_json::Value as serde::Deserialize>::deserialize(deserializer).map(Some)
}

/// Apply `patch` to `header`: whether anything changed, or why it may not.
pub fn apply(header: &mut Header, patch: &Patch) -> Result<bool, &'static str> {
    let before = header.clone();
    if patch
        .only_from
        .as_ref()
        .is_some_and(|mailbox| *mailbox != header.mailbox)
    {
        return Ok(false);
    }
    if patch.rules_ran {
        if !header.rules_pending {
            return Ok(false);
        }
        header.rules_pending = false;
    }
    if patch.remove_attachments {
        if header.mailbox == Mailbox::Drafts {
            return Err("a draft's files are taken off in its window");
        }
        header.attachments.clear();
    }
    if let Some(unread) = patch.unread {
        header.unread = unread;
    }
    if let Some(muted) = patch.muted {
        header.muted = muted;
    }
    if let Some(flag) = &patch.flag {
        header.flag = match flag {
            serde_json::Value::Null => None,
            other => Some(
                serde_json::from_value(other.clone())
                    .map_err(|_| "a flag is one of Mail's seven colours")?,
            ),
        };
    }
    if let Some(priority) = &patch.priority {
        header.priority = match priority {
            serde_json::Value::Null => None,
            other => Some(
                serde_json::from_value(other.clone())
                    .map_err(|_| "a priority is low, or high, or null for normal")?,
            ),
        };
    }
    if let Some(mailbox) = &patch.mailbox {
        if *mailbox != header.mailbox {
            if *mailbox == Mailbox::Drafts {
                return Err("only a saved draft is in Drafts");
            }
            if header.mailbox == Mailbox::Drafts && *mailbox != Mailbox::Trash {
                return Err("a draft can only be deleted");
            }
            header.mailbox = mailbox.clone();
            // Rules run on what is new in the Inbox: a message taken out is not, should it come back.
            header.rules_pending = false;
        }
    }
    Ok(*header != before)
}

/// A message's mailbox as a person reads it: one they no longer have (a move
/// that passed its removal) reads as the Inbox, so the message stays reachable.
pub fn settle_mailbox(header: &mut Header, own: &[OwnMailbox]) {
    if let Mailbox::Own(id) = &header.mailbox {
        if !own.iter().any(|mailbox| mailbox.id == *id) {
            header.mailbox = Mailbox::Inbox;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn thread_subject_reads_as_the_page_does() {
        assert_eq!(
            thread_subject("Re: FWD:  fw : The Ferry").as_deref(),
            Some("the ferry")
        );
        assert_eq!(thread_subject("Red sails").as_deref(), Some("red sails"));
        assert_eq!(thread_subject("Re:"), None);
        assert_eq!(thread_subject("(no subject)"), None);
    }

    #[test]
    fn recipients_are_read_as_people_type_them() {
        for raw in [
            "martin",
            " Martin ",
            "martin@macalicious",
            "martin@MACALICIOUS",
            "Martin Klein <martin@macalicious>",
            "Martin Klein (martin)",
        ] {
            assert_eq!(recipient(raw), Recipient::Desktop("martin".into()), "{raw}");
        }
        assert_eq!(
            recipient("martin@example.com"),
            Recipient::Outside("martin@example.com".into())
        );
        for bad in ["", "@", "guest", "a b", "x@y", "<>"] {
            assert_eq!(recipient(bad), Recipient::Invalid, "{bad:?}");
        }
    }

    fn header_in(mailbox: Mailbox) -> Header {
        Header {
            id: message_id(1_000, "0123456789abcdef"),
            mailbox,
            from: Address {
                name: "martin".into(),
                full_name: String::new(),
            },
            to: Vec::new(),
            cc: Vec::new(),
            bcc: Vec::new(),
            reply_to: None,
            priority: None,
            subject: "Trip".into(),
            at_ms: 1_000,
            unread: false,
            flag: None,
            muted: false,
            rules_pending: false,
            text: String::new(),
            attachments: Vec::new(),
            html: false,
        }
    }

    #[test]
    fn remove_attachments_is_refused_on_a_draft_and_changes_nothing_twice() {
        let patch: Patch = serde_json::from_str(r#"{"remove_attachments":true}"#).unwrap();
        assert_eq!(
            apply(&mut header_in(Mailbox::Drafts), &patch),
            Err("a draft's files are taken off in its window")
        );
        assert_eq!(apply(&mut header_in(Mailbox::Inbox), &patch), Ok(false));
    }

    #[test]
    fn ids_sort_newest_first_and_are_checked() {
        let older = message_id(1_000, "0123456789abcdef");
        let newer = message_id(2_000, "0123456789abcdef");
        assert!(newer < older, "key order is newest first");
        assert!(is_message_id(&older));
        for bad in [
            "",
            "x",
            "0123456789abcdef",
            "../0123456789abcdef-0123456789abcdef",
        ] {
            assert!(!is_message_id(bad), "{bad}");
        }
    }

    #[test]
    fn subjects_and_texts_have_limits() {
        assert_eq!(clean_subject("  ").unwrap(), "(No Subject)");
        assert_eq!(clean_subject("a\nb").unwrap(), "a b");
        assert!(clean_subject(&"x".repeat(301)).is_err());
        assert!(check_texts(&"x".repeat(100_001), None).is_err());
        assert!(check_texts("x", Some(&"y".repeat(200_001))).is_err());
        assert!(check_texts("x", Some("<b>y</b>")).is_ok());
        // Each within its own limit, but together past one stored value.
        assert!(check_texts(&"x".repeat(99_000), Some(&"y".repeat(99_000))).is_err());
        // Characters that JSON escapes count as what they take.
        assert!(check_texts(&"\u{1}".repeat(40_000), None).is_err());
        assert!(check_texts(&"x".repeat(100_000), None).is_ok());
    }

    fn header(mailbox: Mailbox) -> Header {
        Header {
            id: message_id(1, "0123456789abcdef"),
            mailbox,
            from: Address {
                name: "chris".into(),
                full_name: "Chris".into(),
            },
            to: vec![],
            cc: vec![],
            bcc: vec![],
            reply_to: None,
            priority: None,
            subject: "s".into(),
            at_ms: 1,
            unread: true,
            flag: None,
            muted: false,
            rules_pending: false,
            text: String::new(),
            attachments: Vec::new(),
            html: false,
        }
    }

    #[test]
    fn rules_run_once_on_a_message_still_new_in_the_inbox() {
        let rule: Patch =
            serde_json::from_value(serde_json::json!({ "rules_ran": true, "mailbox": "archive" }))
                .unwrap();
        let mut new = Header {
            rules_pending: true,
            ..header(Mailbox::Inbox)
        };
        assert_eq!(apply(&mut new, &rule), Ok(true));
        assert_eq!(new.mailbox, Mailbox::Archive);
        assert!(!new.rules_pending);

        // A second browser, deciding from the same read, finds it done.
        new.mailbox = Mailbox::Inbox;
        assert_eq!(apply(&mut new, &rule), Ok(false));
        assert_eq!(new.mailbox, Mailbox::Inbox);

        // Mail from before rules were kept per message is never run by itself.
        let mut old = header(Mailbox::Inbox);
        assert_eq!(apply(&mut old, &rule), Ok(false));
        assert_eq!(old.mailbox, Mailbox::Inbox);
    }

    #[test]
    fn a_message_the_person_moved_is_no_longer_new_to_the_rules() {
        let mut new = Header {
            rules_pending: true,
            ..header(Mailbox::Inbox)
        };
        let moved: Patch =
            serde_json::from_value(serde_json::json!({ "mailbox": "junk" })).unwrap();
        assert_eq!(apply(&mut new, &moved), Ok(true));
        assert!(!new.rules_pending);
        let read: Patch = serde_json::from_value(serde_json::json!({ "unread": false })).unwrap();
        let mut other = Header {
            rules_pending: true,
            ..header(Mailbox::Inbox)
        };
        assert_eq!(apply(&mut other, &read), Ok(true));
        assert!(other.rules_pending, "reading it is not what runs the rules");
    }

    #[test]
    fn a_patch_reads_flags_moves_and_refuses_what_mail_does_not_do() {
        let mut message = header(Mailbox::Inbox);
        let patch: Patch = serde_json::from_str(r#"{"unread": false, "flag": "orange"}"#).unwrap();
        assert_eq!(apply(&mut message, &patch), Ok(true));
        assert_eq!(message.flag, Some(Flag::Orange));
        assert!(!message.unread);
        assert_eq!(apply(&mut message, &patch), Ok(false), "no change twice");
        let clear: Patch = serde_json::from_str(r#"{"flag": null}"#).unwrap();
        assert_eq!(apply(&mut message, &clear), Ok(true));
        assert_eq!(message.flag, None);
        let bad: Patch = serde_json::from_str(r#"{"flag": "pink"}"#).unwrap();
        assert!(apply(&mut message, &bad).is_err());
        let to_drafts: Patch = serde_json::from_str(r#"{"mailbox": "drafts"}"#).unwrap();
        assert!(apply(&mut message, &to_drafts).is_err());
        let mut draft = header(Mailbox::Drafts);
        let archive: Patch = serde_json::from_str(r#"{"mailbox": "archive"}"#).unwrap();
        assert!(apply(&mut draft, &archive).is_err());
        let trash: Patch = serde_json::from_str(r#"{"mailbox": "trash"}"#).unwrap();
        assert_eq!(apply(&mut draft, &trash), Ok(true));
        assert!(serde_json::from_str::<Patch>(r#"{"from": "x"}"#).is_err());
    }

    #[test]
    fn a_move_from_a_mailbox_leaves_a_message_that_has_gone_elsewhere() {
        let trips = Mailbox::Own("box-0123456789abcdef".into());
        let to_trash = Patch {
            mailbox: Some(Mailbox::Trash),
            only_from: Some(trips.clone()),
            ..Patch::default()
        };
        let mut moved_away = header(Mailbox::Archive);
        assert_eq!(apply(&mut moved_away, &to_trash), Ok(false));
        assert_eq!(moved_away.mailbox, Mailbox::Archive);
        let mut still_there = header(trips);
        assert_eq!(apply(&mut still_there, &to_trash), Ok(true));
        assert_eq!(still_there.mailbox, Mailbox::Trash);
        // No request can ask for it.
        assert!(serde_json::from_str::<Patch>(r#"{"only_from": "inbox"}"#).is_err());
    }

    #[test]
    fn a_message_in_a_mailbox_the_person_no_longer_has_reads_as_in_the_inbox() {
        let id = "box-0123456789abcdef";
        let mut orphan = header(Mailbox::Own(id.into()));
        let own = [OwnMailbox {
            id: id.into(),
            name: "Trips".into(),
        }];
        settle_mailbox(&mut orphan, &own);
        assert_eq!(orphan.mailbox, Mailbox::Own(id.into()));
        settle_mailbox(&mut orphan, &[]);
        assert_eq!(orphan.mailbox, Mailbox::Inbox);
    }

    #[test]
    fn a_mailbox_reads_and_writes_as_its_id() {
        let own: Mailbox = serde_json::from_str(r#""box-0123456789abcdef""#).unwrap();
        assert_eq!(own, Mailbox::Own("box-0123456789abcdef".into()));
        assert_eq!(
            serde_json::to_string(&own).unwrap(),
            r#""box-0123456789abcdef""#
        );
        assert_eq!(
            serde_json::from_str::<Mailbox>(r#""trash""#).unwrap(),
            Mailbox::Trash
        );
        for bad in [r#""pink""#, r#""box-""#, r#""box-XYZ""#, r#""Inbox""#] {
            assert!(serde_json::from_str::<Mailbox>(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn a_mailbox_name_is_one_line_and_not_one_every_person_has() {
        assert_eq!(clean_mailbox_name("  Trips ").unwrap(), "Trips");
        assert!(clean_mailbox_name("   ").is_err());
        assert!(clean_mailbox_name("a\nb").is_err());
        assert!(clean_mailbox_name("INBOX").is_err());
        assert!(clean_mailbox_name(&"x".repeat(101)).is_err());
    }
}

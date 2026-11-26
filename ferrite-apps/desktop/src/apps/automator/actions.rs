//! The desktop's actions: what Script Editor's scripts, Automator's
//! workflows and Siri can do with a person's data, each one carried out
//! through the apps' own routes.
//!
//! An action never touches another module's keys. [`Actor::request`] calls
//! the module's own handler in this process, exactly as the router would for
//! a request from the person's browser: with the same session, so the
//! module's storage is the same person's ([`Storage::user`]) and every rule
//! the module enforces (shapes, sizes, revisions, quotas) applies unchanged.
//! It forwards no header and no cookie, and it cannot name a person: whose
//! data an action reaches is decided by the session that started the run,
//! never by anything a script, workflow or request says.
//!
//! Some modules are out of reach on purpose ([`DENIED_APPS`]): the three
//! that run actions (so a script cannot start a script or a workflow) and
//! Keychain Access, whose vault is the person's own ciphertext. The session
//! routes (`/api/session/...`: sign-in, passwords, accounts) are not a module
//! and cannot be named at all.
//!
//! An action's answer is a list of items, each a JSON object with at least
//! `kind` and `text`, so one action's output can be the next one's input in a
//! workflow (`input`). Actions that change what the browser shows (open an
//! application, switch the appearance) also add an *effect* the page carries
//! out ([`Actor::effects`]).
//!
//! [`Storage::user`]: crate::module::Storage::user

use ferrite_app::serde_json::{self, json, Map, Value};
use ferrite_app::AppContext;

use super::local_time as lt;
use crate::module::{ApiCtx, Request, Storage};
use crate::session::Session;

/// Modules no action may call.
pub const DENIED_APPS: &[&str] = &["automator", "script-editor", "siri", "keychain-access"];

/// The most items an action takes in or gives back.
pub const MAX_ITEMS: usize = 200;
/// The longest text an action reads from or writes to a file, in bytes.
pub const MAX_FILE_TEXT_BYTES: usize = 256 * 1024;
/// The most files `files.read` reads in one step (so at most 5 MB of text).
/// A folder action hands its new files to its workflow in batches this size.
pub const MAX_READ_FILES: usize = 20;
/// The longest text one item carries.
const MAX_TEXT_CHARS: usize = 50_000;

/// Why an action did not happen.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActionError {
    /// A stable code: `bad_args`, `not_found`, `denied`, `refused`,
    /// `conflict`, `unavailable` or `unknown_action`.
    pub code: &'static str,
    pub message: String,
}

impl ActionError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        ActionError {
            code,
            message: message.into(),
        }
    }

    fn bad(message: impl Into<String>) -> Self {
        Self::new("bad_args", message)
    }
}

impl std::fmt::Display for ActionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} ({})", self.message, self.code)
    }
}

/// A body for [`Actor::request`].
pub enum Body<'b> {
    None,
    Json(&'b Value),
    Raw(&'b [u8]),
}

/// A module's answer.
pub struct Reply {
    pub status: u16,
    /// The body as JSON, or `null` when it is not JSON.
    pub json: Value,
    pub bytes: Vec<u8>,
}

impl Reply {
    fn error_text(&self) -> String {
        self.json
            .get("error")
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or_else(|| format!("HTTP {}", self.status))
    }
}

/// One run's authority: the person (by their session), the platform and the
/// browser's time zone.
pub struct Actor<'a> {
    ctx: &'a AppContext,
    /// The run's store: a request's counted handle (`crate::store`), so the
    /// calls an action makes count as the request's.
    store: crate::store::Store<'a>,
    /// The session as modules see it (`Session::for_modules`).
    session: &'a Session,
    pub now_ms: u64,
    /// The browser's offset from UTC in minutes east.
    pub tz: i32,
    /// What the page should do when the run is over: `{"open": app}`,
    /// `{"appearance": mode}`.
    pub effects: Vec<Value>,
    /// Requests made so far, for unique ids and idempotency keys.
    seq: u32,
    /// Whether a page of the person's desktop started the run and carries out
    /// its effects. That page also keeps its own appearance saved (System
    /// Preferences' storage), so an appearance change is only its effect;
    /// a run nobody watches (an alarm, a folder action) stores it instead.
    pub interactive: bool,
    /// Distinguishes this run's ids from another run's in the same
    /// millisecond.
    run_tag: String,
}

impl<'a> Actor<'a> {
    pub fn new(
        ctx: &'a AppContext,
        store: impl crate::store::IntoStore<'a>,
        session: &'a Session,
        now_ms: u64,
        tz: i32,
    ) -> Self {
        let run_tag = crate::crypto::random::random_u64()
            .map(|n| format!("{:08x}", n as u32))
            .unwrap_or_else(|_| format!("{:08x}", now_ms as u32 ^ 0x5a5a_5a5a));
        Actor {
            ctx,
            store: store.into_store(),
            session,
            now_ms,
            tz,
            effects: Vec::new(),
            seq: 0,
            interactive: true,
            run_tag,
        }
    }

    pub fn ctx(&self) -> &'a AppContext {
        self.ctx
    }

    pub fn session(&self) -> &'a Session {
        self.session
    }

    /// The store, for the calling module's own keys.
    pub fn store(&mut self) -> &mut crate::store::Store<'a> {
        &mut self.store
    }

    /// A fresh id for something an action makes: unique within the person's
    /// documents, made of letters, digits and `-`.
    pub fn new_id(&mut self, prefix: &str) -> String {
        self.seq += 1;
        format!("{prefix}-{:x}-{}-{}", self.now_ms, self.run_tag, self.seq)
    }

    fn today(&self) -> i64 {
        lt::local(self.now_ms as i64, self.tz).days
    }

    /// Call `method path` (path below `/api/<app>`, with its query) of the
    /// module `app` for this run's person.
    pub async fn request(
        &mut self,
        app: &str,
        method: &str,
        path: &str,
        body: Body<'_>,
    ) -> Result<Reply, ActionError> {
        if DENIED_APPS.contains(&app) {
            return Err(ActionError::new(
                "denied",
                format!("actions may not call '{app}'"),
            ));
        }
        let Some(module) = crate::apps::find(app) else {
            return Err(ActionError::new(
                "not_found",
                format!("no app module is named '{app}'"),
            ));
        };
        if !matches!(method, "GET" | "PUT" | "POST" | "DELETE") {
            return Err(ActionError::bad(format!("'{method}' is not a method")));
        }
        if !path.starts_with('/') || path.len() > 1024 || path.contains("..") {
            return Err(ActionError::bad("a path starts with '/' and has no '..'"));
        }
        let (path, query) = crate::http::split_query(path);
        let bytes: Vec<u8> = match body {
            Body::None => Vec::new(),
            Body::Json(value) => serde_json::to_vec(value).unwrap_or_default(),
            Body::Raw(bytes) => bytes.to_vec(),
        };
        if bytes.len() > 262_144 {
            return Err(ActionError::bad("a request body is at most 256 KiB"));
        }
        self.seq += 1;
        let key = format!("act-{:x}-{}-{}", self.now_ms, self.run_tag, self.seq);
        let key = (method != "GET").then_some(key.as_str());
        let storage = Storage::new(&mut self.store, module.name, &self.session.principal)
            .user_data_expires(self.session.guest_expires_ms());
        let cx = ApiCtx {
            request: Request::internal(method, path, query, &bytes, key),
            storage,
            session: self.session,
            ctx: self.ctx,
            now_ms: self.now_ms,
        };
        let response = (module.handle)(cx).await;
        let json = serde_json::from_slice(&response.body).unwrap_or(Value::Null);
        Ok(Reply {
            status: response.status,
            json,
            bytes: response.body,
        })
    }

    async fn get_ok(&mut self, app: &str, path: &str) -> Result<Value, ActionError> {
        let reply = self.request(app, "GET", path, Body::None).await?;
        if reply.status != 200 {
            return Err(refusal(app, &reply));
        }
        Ok(reply.json)
    }

    /// Read the document at `path` of `app`, change it with `change` and
    /// write it back on the revision it was read at, reading again when
    /// another writer got there first. `change` gets the document (`null`
    /// when the person never saved one) and answers the action's result and
    /// any further fields the write needs.
    async fn edit_document<F>(
        &mut self,
        app: &str,
        path: &str,
        shape: Shape,
        mut change: F,
    ) -> Result<Value, ActionError>
    where
        F: FnMut(&mut Value) -> Result<(Value, Map<String, Value>), ActionError>,
    {
        for _ in 0..3 {
            let read = self.get_ok(app, path).await?;
            let rev = read.get("rev").cloned().unwrap_or(json!(0));
            let mut doc = read.get(shape.field()).cloned().unwrap_or(Value::Null);
            let (result, extra) = change(&mut doc)?;
            let mut body = Map::new();
            match shape {
                Shape::Data => {
                    body.insert("base".into(), rev);
                    body.insert("data".into(), doc);
                }
                Shape::Field(field) => {
                    body.insert(field.into(), doc);
                    body.insert("rev".into(), rev);
                }
            }
            body.extend(extra);
            let body = Value::Object(body);
            let reply = self.request(app, "PUT", path, Body::Json(&body)).await?;
            match reply.status {
                200 => return Ok(result),
                409 => continue,
                _ => return Err(refusal(app, &reply)),
            }
        }
        Err(ActionError::new(
            "conflict",
            format!("{app} kept changing while the action ran; try again"),
        ))
    }
}

/// How a module's document travels.
#[derive(Clone, Copy)]
enum Shape {
    /// `GET` → `{data, rev}`, `PUT` ← `{base, data}` (Notes, Stickies,
    /// Reminders).
    Data,
    /// `GET` → `{<field>, rev}`, `PUT` ← `{<field>, rev}` (`document.rs`).
    Field(&'static str),
}

impl Shape {
    fn field(self) -> &'static str {
        match self {
            Shape::Data => "data",
            Shape::Field(field) => field,
        }
    }
}

fn refusal(app: &str, reply: &Reply) -> ActionError {
    let code = match reply.status {
        404 => "not_found",
        409 => "conflict",
        423 | 403 => "denied",
        s if s >= 500 => "unavailable",
        _ => "refused",
    };
    ActionError::new(code, format!("{app}: {}", reply.error_text()))
}

/// One parameter of an action, as the dictionary lists it.
pub struct Param {
    pub name: &'static str,
    /// `text`, `day`, `time`, `number`, `boolean`, `choice:a|b|c` or `code`.
    pub kind: &'static str,
    pub required: bool,
    pub summary: &'static str,
}

const fn p(name: &'static str, kind: &'static str, required: bool, summary: &'static str) -> Param {
    Param {
        name,
        kind,
        required,
        summary,
    }
}

/// One action, as Script Editor's dictionary and Automator's library list it.
pub struct ActionInfo {
    /// The name scripts and workflows call it by: `<app>.<verb>`.
    pub name: &'static str,
    /// Automator's title for it.
    pub title: &'static str,
    /// The app it belongs to (a demo folder), for its icon and grouping.
    pub app: &'static str,
    pub summary: &'static str,
    pub params: &'static [Param],
    /// Whether a workflow's previous step can supply its main input.
    pub takes_input: bool,
    /// Whether it changes the person's data.
    pub writes: bool,
}

/// Every action.
pub const ACTIONS: &[ActionInfo] = &[
    ActionInfo {
        name: "notes.list",
        title: "Get Notes",
        app: "notes",
        summary: "Every note, newest first: its title and text.",
        params: &[p(
            "contains",
            "text",
            false,
            "Only notes whose text holds this",
        )],
        takes_input: false,
        writes: false,
    },
    ActionInfo {
        name: "notes.make",
        title: "New Note",
        app: "notes",
        summary: "Makes a note in Notes. Without text, the input becomes the note.",
        params: &[
            p("title", "text", false, "The first line"),
            p("text", "text", false, "The body"),
            p("folder", "text", false, "A folder's name (default Notes)"),
        ],
        takes_input: true,
        writes: true,
    },
    ActionInfo {
        name: "reminders.list",
        title: "Find Reminders",
        app: "reminders",
        summary: "The reminders still to do, or all of them.",
        params: &[
            p("list", "text", false, "Only this list"),
            p("completed", "boolean", false, "Include completed ones"),
        ],
        takes_input: false,
        writes: false,
    },
    ActionInfo {
        name: "reminders.add",
        title: "New Reminders Item",
        app: "reminders",
        summary: "Adds a reminder. Without a title, each input item becomes one.",
        params: &[
            p("title", "text", false, "What to be reminded of"),
            p(
                "due",
                "day",
                false,
                "today, tomorrow, a weekday or YYYY-MM-DD",
            ),
            p("time", "time", false, "When on that day (5pm, 17:00)"),
            p("list", "text", false, "A list's name"),
        ],
        takes_input: true,
        writes: true,
    },
    ActionInfo {
        name: "reminders.complete",
        title: "Complete Reminders Item",
        app: "reminders",
        summary: "Marks the reminders whose title holds the text as done.",
        params: &[p("title", "text", true, "Text in the reminder's title")],
        takes_input: false,
        writes: true,
    },
    ActionInfo {
        name: "calendar.events",
        title: "Find Calendar Events",
        app: "calendar",
        summary: "The events of a day, or of several days from it.",
        params: &[
            p(
                "day",
                "day",
                false,
                "today (default), tomorrow, a weekday or YYYY-MM-DD",
            ),
            p("days", "number", false, "How many days, 1 to 31"),
        ],
        takes_input: false,
        writes: false,
    },
    ActionInfo {
        name: "calendar.add",
        title: "New Calendar Event",
        app: "calendar",
        summary: "Adds an event. Without a time it is an all-day event.",
        params: &[
            p(
                "title",
                "text",
                false,
                "The event's name (default: the input)",
            ),
            p(
                "day",
                "day",
                false,
                "today (default), tomorrow, a weekday or YYYY-MM-DD",
            ),
            p("time", "time", false, "When it starts"),
            p(
                "minutes",
                "number",
                false,
                "How long, in minutes (default 60)",
            ),
            p("calendar", "choice:home|work", false, "Which calendar"),
        ],
        takes_input: true,
        writes: true,
    },
    ActionInfo {
        name: "contacts.find",
        title: "Find People in Contacts",
        app: "contacts",
        summary: "Cards whose name, company or address holds the text.",
        params: &[p(
            "query",
            "text",
            false,
            "What to look for (all cards without)",
        )],
        takes_input: false,
        writes: false,
    },
    ActionInfo {
        name: "stickies.list",
        title: "Get Stickies",
        app: "stickies",
        summary: "The text of every sticky note.",
        params: &[],
        takes_input: false,
        writes: false,
    },
    ActionInfo {
        name: "stickies.add",
        title: "New Sticky Note",
        app: "stickies",
        summary: "Puts a sticky note on the desktop. Without text, the input.",
        params: &[
            p("text", "text", false, "What it says"),
            p(
                "color",
                "choice:yellow|blue|green|pink|purple|gray",
                false,
                "Its colour",
            ),
        ],
        takes_input: true,
        writes: true,
    },
    ActionInfo {
        name: "files.list",
        title: "Get Folder Contents",
        app: "finder",
        summary: "The files and folders in a folder of your drive.",
        params: &[p(
            "folder",
            "text",
            false,
            "A path such as Documents/Scripts (default Documents)",
        )],
        takes_input: false,
        writes: false,
    },
    ActionInfo {
        name: "files.read",
        title: "Read Text Files",
        app: "finder",
        summary: "The text of a file, or of every file in the input (at most 20).",
        params: &[p(
            "path",
            "text",
            false,
            "A path such as Documents/todo.txt",
        )],
        takes_input: true,
        writes: false,
    },
    ActionInfo {
        name: "files.write",
        title: "New Text File",
        app: "finder",
        summary: "Saves text as a file in your drive. Without text, the input.",
        params: &[
            p("path", "text", true, "Where, such as Documents/Notes.txt"),
            p("text", "text", false, "What it holds"),
            p("replace", "boolean", false, "Replace a file of that name"),
        ],
        takes_input: true,
        writes: true,
    },
    ActionInfo {
        name: "messages.send",
        title: "Send Message",
        app: "messages",
        summary: "Sends a message to a Messages room. Without text, the input.",
        params: &[
            p("text", "text", false, "The message"),
            p("room", "text", false, "The room (default desktop)"),
        ],
        takes_input: true,
        writes: true,
    },
    ActionInfo {
        name: "appearance.set",
        title: "Change System Appearance",
        app: "system-preferences",
        summary: "Switches the desktop to Light or Dark, or back to Auto.",
        params: &[p(
            "mode",
            "choice:light|dark|auto|toggle",
            true,
            "The appearance",
        )],
        takes_input: false,
        writes: true,
    },
    ActionInfo {
        name: "app.open",
        title: "Launch Application",
        app: "launchpad",
        summary: "Opens an application on the desktop when the run ends.",
        params: &[
            p("app", "text", true, "Its name, such as Notes"),
            p("place", "text", false, "For Finder, the folder to show"),
        ],
        takes_input: false,
        writes: false,
    },
    ActionInfo {
        name: "text.get",
        title: "Get Specified Text",
        app: "textedit",
        summary: "Passes the text on, one item per line.",
        params: &[p("text", "text", true, "The text")],
        takes_input: false,
        writes: false,
    },
    ActionInfo {
        name: "text.filter",
        title: "Filter Items",
        app: "textedit",
        summary: "Keeps the input items whose text holds the words.",
        params: &[p("contains", "text", true, "Text an item must hold")],
        takes_input: true,
        writes: false,
    },
    ActionInfo {
        name: "text.case",
        title: "Change Case of Text",
        app: "textedit",
        summary: "Upper, lower or title case for each input item.",
        params: &[p("case", "choice:upper|lower|title", true, "The case")],
        takes_input: true,
        writes: false,
    },
    ActionInfo {
        name: "text.combine",
        title: "Combine Text",
        app: "textedit",
        summary: "Joins the input items into one text.",
        params: &[p(
            "separator",
            "text",
            false,
            "Between items (default a new line)",
        )],
        takes_input: true,
        writes: false,
    },
];

/// The action `name` names.
pub fn info(name: &str) -> Option<&'static ActionInfo> {
    ACTIONS.iter().find(|action| action.name == name)
}

/// The dictionary as JSON, for Script Editor and Automator.
pub fn describe() -> Value {
    ACTIONS
        .iter()
        .map(|action| {
            json!({
                "name": action.name,
                "title": action.title,
                "app": action.app,
                "summary": action.summary,
                "takes_input": action.takes_input,
                "writes": action.writes,
                "params": action.params.iter().map(|param| json!({
                    "name": param.name,
                    "kind": param.kind,
                    "required": param.required,
                    "summary": param.summary,
                })).collect::<Vec<_>>(),
            })
        })
        .collect()
}

// ---------------------------------------------------------------- arguments

/// A text argument, trimmed; `None` when absent or blank.
fn text_arg(args: &Value, name: &str) -> Option<String> {
    match args.get(name)? {
        Value::String(text) if !text.trim().is_empty() => Some(text.trim().to_string()),
        Value::Number(number) => Some(number.to_string()),
        _ => None,
    }
}

/// A content argument exactly as given (a file's text): `None` only when it
/// is absent or `null`, so an empty or blank text is still that text.
fn content_arg(args: &Value, name: &str) -> Option<String> {
    match args.get(name)? {
        Value::String(text) => Some(text.clone()),
        Value::Number(number) => Some(number.to_string()),
        _ => None,
    }
}

fn bool_arg(args: &Value, name: &str) -> bool {
    match args.get(name) {
        Some(Value::Bool(value)) => *value,
        Some(Value::String(text)) => matches!(text.trim(), "true" | "yes" | "1"),
        Some(Value::Number(number)) => number.as_f64().is_some_and(|n| n != 0.0),
        _ => false,
    }
}

fn number_arg(args: &Value, name: &str) -> Option<f64> {
    match args.get(name)? {
        Value::Number(number) => number.as_f64(),
        Value::String(text) => text.trim().parse().ok(),
        _ => None,
    }
}

/// The items a workflow's previous step handed on (`args.input`).
pub fn input_items(args: &Value) -> Vec<Value> {
    match args.get("input") {
        Some(Value::Array(items)) => items.iter().take(MAX_ITEMS).cloned().collect(),
        Some(Value::Null) | None => Vec::new(),
        Some(other) => vec![other.clone()],
    }
}

/// The text of an item: its `text`, or the item itself when it is plain.
pub fn item_text(item: &Value) -> String {
    match item {
        Value::String(text) => text.clone(),
        Value::Null => String::new(),
        Value::Object(object) => match object.get("text") {
            Some(Value::String(text)) => text.clone(),
            Some(other) => item_text(other),
            None => object
                .get("title")
                .or_else(|| object.get("name"))
                .map(item_text)
                .unwrap_or_else(|| item.to_string()),
        },
        other => other.to_string(),
    }
}

/// A text item.
pub fn text_item(text: &str) -> Value {
    json!({ "kind": "text", "text": clip(text) })
}

fn clip(text: &str) -> String {
    if text.chars().count() <= MAX_TEXT_CHARS {
        text.to_string()
    } else {
        text.chars().take(MAX_TEXT_CHARS).collect()
    }
}

/// The input joined into one text, a line per item.
fn input_text(args: &Value) -> Option<String> {
    let joined = input_items(args)
        .iter()
        .map(item_text)
        .collect::<Vec<_>>()
        .join("\n");
    (!joined.trim().is_empty()).then_some(joined)
}

// ------------------------------------------------------------------ running

impl Actor<'_> {
    /// Run the action `name` with `args`; its items.
    pub async fn run(&mut self, name: &str, args: &Value) -> Result<Value, ActionError> {
        let args = if args.is_null() { &Value::Null } else { args };
        if !args.is_null() && !args.is_object() {
            return Err(ActionError::bad("an action's arguments are an object"));
        }
        match name {
            "notes.list" => self.notes_list(args).await,
            "notes.make" => self.notes_make(args).await,
            "reminders.list" => self.reminders_list(args).await,
            "reminders.add" => self.reminders_add(args).await,
            "reminders.complete" => self.reminders_complete(args).await,
            "calendar.events" => self.calendar_events(args).await,
            "calendar.add" => self.calendar_add(args).await,
            "contacts.find" => self.contacts_find(args).await,
            "stickies.list" => self.stickies_list().await,
            "stickies.add" => self.stickies_add(args).await,
            "files.list" => self.files_list(args).await,
            "files.read" => self.files_read(args).await,
            "files.write" => self.files_write(args).await,
            "messages.send" => self.messages_send(args).await,
            "appearance.set" => self.appearance_set(args).await,
            "app.open" => self.app_open(args),
            "text.get" => text_get(args),
            "text.filter" => text_filter(args),
            "text.case" => text_case(args),
            "text.combine" => text_combine(args),
            other => Err(ActionError::new(
                "unknown_action",
                format!("there is no action named '{other}'"),
            )),
        }
    }

    // ------------------------------------------------------------ Notes

    async fn notes_list(&mut self, args: &Value) -> Result<Value, ActionError> {
        let read = self.get_ok("notes", "/data").await?;
        let contains = text_arg(args, "contains").map(|t| t.to_lowercase());
        let data = &read["data"];
        let folders = data["folders"].as_array().cloned().unwrap_or_default();
        let folder_name = |id: &str| {
            folders
                .iter()
                .find(|f| f["id"] == id)
                .and_then(|f| f["name"].as_str())
                .unwrap_or("Notes")
                .to_string()
        };
        let items: Vec<Value> = data["notes"]
            .as_array()
            .map(Vec::as_slice)
            .unwrap_or_default()
            .iter()
            .filter(|note| note.get("deleted").is_none())
            .filter_map(|note| {
                let lines: Vec<&str> = note["lines"]
                    .as_array()?
                    .iter()
                    .filter_map(Value::as_str)
                    .collect();
                let text = lines.join("\n");
                if contains
                    .as_deref()
                    .is_some_and(|c| !text.to_lowercase().contains(c))
                {
                    return None;
                }
                Some(json!({
                    "kind": "note",
                    "id": note["id"],
                    "title": lines.first().copied().unwrap_or(""),
                    "folder": folder_name(note["folder"].as_str().unwrap_or("")),
                    "text": clip(&text),
                }))
            })
            .take(MAX_ITEMS)
            .collect();
        Ok(Value::Array(items))
    }

    async fn notes_make(&mut self, args: &Value) -> Result<Value, ActionError> {
        let title = text_arg(args, "title");
        let body = text_arg(args, "text").or_else(|| input_text(args));
        let mut lines: Vec<String> = Vec::new();
        if let Some(title) = &title {
            lines.push(title.clone());
        }
        if let Some(body) = &body {
            lines.extend(body.lines().map(str::to_string));
        }
        if lines.iter().all(|line| line.trim().is_empty()) {
            return Err(ActionError::bad("a note needs a title or text"));
        }
        let folder_name = text_arg(args, "folder");
        let id = self.new_id("note");
        let when = lt::local(self.now_ms as i64, self.tz);
        let date = lt::clock_text(when.hour, when.minute);
        let edited = lt::long_text(&when);
        let text = lines.join("\n");
        self.edit_document("notes", "/data", Shape::Data, |doc| {
            if doc.is_null() {
                *doc = json!({ "folders": [{ "id": "notes", "name": "Notes" }], "notes": [] });
            }
            let folder = folder_name
                .as_deref()
                .and_then(|name| {
                    doc["folders"].as_array()?.iter().find(|f| {
                        f["name"]
                            .as_str()
                            .is_some_and(|n| n.eq_ignore_ascii_case(name))
                    })
                })
                .and_then(|f| f["id"].as_str())
                .unwrap_or("notes")
                .to_string();
            let note = json!({
                "id": id, "folder": folder, "lines": lines, "date": date, "edited": edited,
            });
            let notes = doc["notes"]
                .as_array_mut()
                .ok_or_else(|| ActionError::new("unavailable", "Notes' document has no notes"))?;
            notes.insert(0, note);
            let item = json!({
                "kind": "note", "id": id, "title": lines[0], "folder": folder, "text": text,
            });
            Ok((json!([item]), Map::new()))
        })
        .await
    }

    // -------------------------------------------------------- Reminders

    fn reminder_item(reminder: &Value, lists: &[Value]) -> Value {
        let list = lists
            .iter()
            .find(|l| l["id"] == reminder["listId"])
            .and_then(|l| l["name"].as_str())
            .unwrap_or("");
        json!({
            "kind": "reminder",
            "id": reminder["id"],
            "title": reminder["title"],
            "list": list,
            "due": reminder.get("due").cloned().unwrap_or(Value::Null),
            "dueTime": reminder.get("dueTime").cloned().unwrap_or(Value::Null),
            "completed": reminder["completed"].as_bool().unwrap_or(false),
            "text": reminder["title"],
        })
    }

    async fn reminders_list(&mut self, args: &Value) -> Result<Value, ActionError> {
        let read = self.get_ok("reminders", "/data").await?;
        let lists = read["data"]["lists"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        let only = text_arg(args, "list");
        let completed = bool_arg(args, "completed");
        let items: Vec<Value> = read["data"]["reminders"]
            .as_array()
            .map(Vec::as_slice)
            .unwrap_or_default()
            .iter()
            .map(|r| Self::reminder_item(r, &lists))
            .filter(|item| completed || item["completed"] != true)
            .filter(|item| {
                only.as_deref().is_none_or(|name| {
                    item["list"]
                        .as_str()
                        .is_some_and(|l| l.eq_ignore_ascii_case(name))
                })
            })
            .take(MAX_ITEMS)
            .collect();
        Ok(Value::Array(items))
    }

    async fn reminders_add(&mut self, args: &Value) -> Result<Value, ActionError> {
        let titles: Vec<String> = match text_arg(args, "title") {
            Some(title) => vec![title],
            None => input_items(args)
                .iter()
                .map(item_text)
                .map(|t| t.trim().to_string())
                .filter(|t| !t.is_empty())
                .collect(),
        };
        if titles.is_empty() {
            return Err(ActionError::bad("a reminder needs a title"));
        }
        let today = self.today();
        let time = match text_arg(args, "time") {
            Some(text) => Some(
                lt::parse_time(&text)
                    .ok_or_else(|| ActionError::bad(format!("'{text}' is not a time")))?,
            ),
            None => None,
        };
        let due = match text_arg(args, "due") {
            Some(text) => Some(
                lt::parse_day(&text, today)
                    .ok_or_else(|| ActionError::bad(format!("'{text}' is not a day")))?,
            ),
            // A time alone means its next occurrence.
            None => time.map(|minutes| {
                let now = lt::local(self.now_ms as i64, self.tz);
                if minutes > now.hour * 60 + now.minute {
                    today
                } else {
                    today + 1
                }
            }),
        };
        let list_name = text_arg(args, "list");
        let ids: Vec<String> = titles.iter().map(|_| self.new_id("rem")).collect();
        let tz = self.tz;
        self.edit_document("reminders", "/data", Shape::Data, |doc| {
            if doc.is_null() {
                *doc = json!({
                    "lists": [{ "id": "reminders", "name": "Reminders", "color": "blue" }],
                    "reminders": [],
                });
            }
            let lists = doc["lists"].as_array().cloned().unwrap_or_default();
            let list = match &list_name {
                Some(name) => lists.iter().find(|l| {
                    l["name"]
                        .as_str()
                        .is_some_and(|n| n.eq_ignore_ascii_case(name))
                }),
                None => lists.first(),
            };
            let Some(list_id) = list.and_then(|l| l["id"].as_str()).map(str::to_string) else {
                return Err(match &list_name {
                    Some(name) => {
                        ActionError::new("not_found", format!("there is no list named '{name}'"))
                    }
                    None => ActionError::new("not_found", "there is no list to add to"),
                });
            };
            let reminders = doc["reminders"].as_array_mut().ok_or_else(|| {
                ActionError::new("unavailable", "Reminders' document has no reminders")
            })?;
            let mut made = Vec::new();
            for (title, id) in titles.iter().zip(&ids) {
                let mut reminder = json!({ "id": id, "listId": list_id, "title": title });
                if let Some(due) = due {
                    reminder["due"] = json!(lt::ymd(due));
                    if let Some(minutes) = time {
                        reminder["dueTime"] = json!(lt::hhmm(minutes));
                    }
                }
                made.push(Self::reminder_item(&reminder, &lists));
                reminders.push(reminder);
            }
            let mut extra = Map::new();
            extra.insert("alerts".into(), reminder_alerts(reminders, tz));
            Ok((Value::Array(made), extra))
        })
        .await
    }

    async fn reminders_complete(&mut self, args: &Value) -> Result<Value, ActionError> {
        let needle = text_arg(args, "title")
            .ok_or_else(|| ActionError::bad("say which reminder: its title"))?
            .to_lowercase();
        let tz = self.tz;
        self.edit_document("reminders", "/data", Shape::Data, |doc| {
            let lists = doc["lists"].as_array().cloned().unwrap_or_default();
            let reminders = doc["reminders"]
                .as_array_mut()
                .ok_or_else(|| ActionError::new("not_found", "there are no reminders"))?;
            let mut done = Vec::new();
            for reminder in reminders.iter_mut() {
                let matches = reminder["title"]
                    .as_str()
                    .is_some_and(|t| t.to_lowercase().contains(&needle));
                if matches && reminder["completed"] != true {
                    reminder["completed"] = json!(true);
                    done.push(Self::reminder_item(reminder, &lists));
                }
            }
            if done.is_empty() {
                return Err(ActionError::new(
                    "not_found",
                    format!("no reminder to do has '{needle}' in its title"),
                ));
            }
            let mut extra = Map::new();
            extra.insert("alerts".into(), reminder_alerts(reminders, tz));
            Ok((Value::Array(done), extra))
        })
        .await
    }

    // --------------------------------------------------------- Calendar

    async fn calendar_events(&mut self, args: &Value) -> Result<Value, ActionError> {
        let today = self.today();
        let day = match text_arg(args, "day") {
            Some(text) => lt::parse_day(&text, today)
                .ok_or_else(|| ActionError::bad(format!("'{text}' is not a day")))?,
            None => today,
        };
        let days = number_arg(args, "days").unwrap_or(1.0).clamp(1.0, 31.0) as i64;
        let from = lt::utc_of(day, 0, self.tz);
        let to = lt::utc_of(day + days, 0, self.tz);
        let read = self.get_ok("calendar", "/events").await?;
        let mut events: Vec<&Value> = read["events"]
            .as_array()
            .map(|events| {
                events
                    .iter()
                    .filter(|e| {
                        let (start, end) = (e["start"].as_i64(), e["end"].as_i64());
                        matches!((start, end), (Some(s), Some(n)) if s < to && n.max(s + 1) > from)
                    })
                    .collect()
            })
            .unwrap_or_default();
        events.sort_by_key(|e| e["start"].as_i64());
        let tz = self.tz;
        let items = events
            .into_iter()
            .take(MAX_ITEMS)
            .map(|e| event_item(e, tz))
            .collect();
        Ok(Value::Array(items))
    }

    async fn calendar_add(&mut self, args: &Value) -> Result<Value, ActionError> {
        let title = text_arg(args, "title")
            .or_else(|| input_text(args).map(|t| t.lines().next().unwrap_or("").to_string()))
            .filter(|t| !t.trim().is_empty())
            .ok_or_else(|| ActionError::bad("an event needs a title"))?;
        let today = self.today();
        let day = match text_arg(args, "day") {
            Some(text) => lt::parse_day(&text, today)
                .ok_or_else(|| ActionError::bad(format!("'{text}' is not a day")))?,
            None => today,
        };
        let time = match text_arg(args, "time") {
            Some(text) => Some(
                lt::parse_time(&text)
                    .ok_or_else(|| ActionError::bad(format!("'{text}' is not a time")))?,
            ),
            None => None,
        };
        let calendar = match text_arg(args, "calendar").map(|c| c.to_lowercase()) {
            None => "home".to_string(),
            Some(c) if matches!(c.as_str(), "home" | "work") => c,
            Some(c) => {
                return Err(ActionError::bad(format!(
                    "'{c}' is not a calendar: home or work"
                )))
            }
        };
        let mut event = json!({ "id": self.new_id("evt"), "title": title, "calendar": calendar });
        match time {
            Some(minutes) => {
                let length = number_arg(args, "minutes")
                    .unwrap_or(60.0)
                    .clamp(5.0, 24.0 * 60.0) as i64;
                let start = lt::utc_of(day, minutes, self.tz);
                event["start"] = json!(start);
                event["end"] = json!(start + length * 60_000);
            }
            None => {
                event["start"] = json!(lt::utc_of(day, 0, self.tz));
                event["end"] = json!(lt::utc_of(day + 1, 0, self.tz));
                event["allDay"] = json!(true);
            }
        }
        let tz = self.tz;
        let item = event_item(&event, tz);
        self.edit_document("calendar", "/events", Shape::Field("events"), |doc| {
            if !doc.is_array() {
                *doc = json!([]);
            }
            if let Some(events) = doc.as_array_mut() {
                events.push(event.clone());
                events.sort_by_key(|e| e["start"].as_i64());
            }
            Ok((json!([item.clone()]), Map::new()))
        })
        .await
    }

    // --------------------------------------------------------- Contacts

    async fn contacts_find(&mut self, args: &Value) -> Result<Value, ActionError> {
        let query = text_arg(args, "query").map(|q| q.to_lowercase());
        let read = self.get_ok("contacts", "/cards").await?;
        let values = |card: &Value, field: &str| -> Vec<String> {
            card[field]
                .as_array()
                .map(Vec::as_slice)
                .unwrap_or_default()
                .iter()
                .filter_map(|f| f["value"].as_str().map(str::to_string))
                .collect()
        };
        let items: Vec<Value> = read["cards"]
            .as_array()
            .map(Vec::as_slice)
            .unwrap_or_default()
            .iter()
            .filter_map(|card| {
                let first = card["first"].as_str().unwrap_or("");
                let last = card["last"].as_str().unwrap_or("");
                let company = card["company"].as_str().unwrap_or("");
                let name = match (first.is_empty(), last.is_empty()) {
                    (true, true) => company.to_string(),
                    _ => format!("{first} {last}").trim().to_string(),
                };
                let emails = values(card, "emails");
                let phones = values(card, "phones");
                let haystack = format!("{name} {company} {}", emails.join(" ")).to_lowercase();
                if query.as_deref().is_some_and(|q| !haystack.contains(q)) {
                    return None;
                }
                Some(json!({
                    "kind": "contact", "id": card["id"], "name": name, "company": company,
                    "emails": emails, "phones": phones, "text": name,
                }))
            })
            .take(MAX_ITEMS)
            .collect();
        Ok(Value::Array(items))
    }

    // --------------------------------------------------------- Stickies

    async fn stickies_list(&mut self) -> Result<Value, ActionError> {
        let read = self.get_ok("stickies", "/data").await?;
        let items = read["data"]["notes"]
            .as_array()
            .map(Vec::as_slice)
            .unwrap_or_default()
            .iter()
            .take(MAX_ITEMS)
            .map(|note| json!({ "kind": "sticky", "id": note["id"], "color": note["color"], "text": note["text"] }))
            .collect();
        Ok(Value::Array(items))
    }

    async fn stickies_add(&mut self, args: &Value) -> Result<Value, ActionError> {
        let text = text_arg(args, "text")
            .or_else(|| input_text(args))
            .ok_or_else(|| ActionError::bad("a sticky note needs text"))?;
        let color = text_arg(args, "color")
            .map(|c| c.to_lowercase())
            .unwrap_or_else(|| "yellow".into());
        if !matches!(
            color.as_str(),
            "yellow" | "blue" | "green" | "pink" | "purple" | "gray"
        ) {
            return Err(ActionError::bad(format!(
                "'{color}' is not a Stickies colour"
            )));
        }
        let id = self.new_id("sticky");
        self.edit_document("stickies", "/data", Shape::Data, |doc| {
            if doc.is_null() {
                *doc = json!({ "notes": [] });
            }
            let note = json!({ "id": id, "color": color, "text": text });
            doc["notes"]
                .as_array_mut()
                .ok_or_else(|| ActionError::new("unavailable", "Stickies' document has no notes"))?
                .push(note);
            Ok((
                json!([{ "kind": "sticky", "id": id, "color": color, "text": text }]),
                Map::new(),
            ))
        })
        .await
    }

    // ------------------------------------------------------------ Files

    async fn files_list(&mut self, args: &Value) -> Result<Value, ActionError> {
        let folder = text_arg(args, "folder").unwrap_or_else(|| "Documents".into());
        let drive = Drive::read(self).await?;
        let (id, path) = drive.resolve(&folder).ok_or_else(|| {
            ActionError::new("not_found", format!("there is no folder '{folder}'"))
        })?;
        if !drive.is_folder(&id) {
            return Err(ActionError::bad(format!(
                "'{folder}' is a file, not a folder"
            )));
        }
        let items = drive
            .children(&id)
            .into_iter()
            .take(MAX_ITEMS)
            .map(|entry| {
                let name = entry["name"].as_str().unwrap_or("");
                json!({
                    "kind": if entry["kind"] == "folder" { "folder" } else { "file" },
                    "id": entry["id"],
                    "name": name,
                    "path": format!("{path}/{name}"),
                    "size": entry["size"],
                    "type": entry.get("type").cloned().unwrap_or(Value::Null),
                    "modified": entry["modified_ms"],
                    "text": format!("{path}/{name}"),
                })
            })
            .collect();
        Ok(Value::Array(items))
    }

    async fn files_read(&mut self, args: &Value) -> Result<Value, ActionError> {
        let drive = Drive::read(self).await?;
        let mut targets: Vec<(String, String)> = Vec::new();
        match text_arg(args, "path") {
            Some(path) => {
                let (id, shown) = drive.resolve(&path).ok_or_else(|| {
                    ActionError::new("not_found", format!("there is no file '{path}'"))
                })?;
                targets.push((id, shown));
            }
            None => {
                for item in input_items(args) {
                    if item["kind"] == "file" {
                        if let (Some(id), Some(path)) = (item["id"].as_str(), item["path"].as_str())
                        {
                            targets.push((id.to_string(), path.to_string()));
                        }
                    }
                }
            }
        }
        if targets.is_empty() {
            return Err(ActionError::bad(
                "say which file: a path, or files as input",
            ));
        }
        if targets.len() > MAX_READ_FILES {
            // Refused rather than cut short, so no file is skipped silently.
            return Err(ActionError::bad(format!(
                "{} files came in; Read Text Files reads at most {MAX_READ_FILES} at once",
                targets.len()
            )));
        }
        let mut items = Vec::new();
        for (id, path) in targets {
            if drive.is_folder(&id) {
                return Err(ActionError::bad(format!("'{path}' is a folder")));
            }
            let text = self.read_file(&id, &drive).await?;
            let name = path.rsplit('/').next().unwrap_or(&path).to_string();
            // The whole text: a file is at most MAX_FILE_TEXT_BYTES, and a
            // read-then-write must not copy a shortened file.
            items.push(json!({ "kind": "text", "name": name, "path": path, "text": text }));
        }
        Ok(Value::Array(items))
    }

    /// The text of the drive file `id`.
    pub async fn read_file_text(&mut self, id: &str) -> Result<String, ActionError> {
        let drive = Drive::read(self).await?;
        if drive.entry(id).is_none() || drive.is_folder(id) {
            return Err(ActionError::new("not_found", "there is no such file"));
        }
        self.read_file(id, &drive).await
    }

    async fn read_file(&mut self, id: &str, drive: &Drive) -> Result<String, ActionError> {
        let size = drive
            .entry(id)
            .and_then(|e| e["size"].as_u64())
            .unwrap_or(0);
        if size as usize > MAX_FILE_TEXT_BYTES {
            return Err(ActionError::bad(format!(
                "the file is {size} bytes; actions read text files of at most {MAX_FILE_TEXT_BYTES}"
            )));
        }
        if size == 0 {
            return Ok(String::new());
        }
        let path = format!("/content/{id}?piece=0&count=8");
        let reply = self.request("files", "GET", &path, Body::None).await?;
        if reply.status != 200 {
            return Err(refusal("files", &reply));
        }
        String::from_utf8(reply.bytes).map_err(|_| ActionError::bad("the file is not text (UTF-8)"))
    }

    async fn files_write(&mut self, args: &Value) -> Result<Value, ActionError> {
        let path = text_arg(args, "path")
            .ok_or_else(|| ActionError::bad("say where: a path such as Documents/Notes.txt"))?;
        // The text exactly as given; only an absent text takes the input.
        let text = match content_arg(args, "text") {
            Some(text) => text,
            None => input_items(args)
                .iter()
                .map(item_text)
                .collect::<Vec<_>>()
                .join("\n"),
        };
        let (folder, name) = path.trim_matches('/').rsplit_once('/').ok_or_else(|| {
            ActionError::bad("a path names a folder and a file: Documents/Notes.txt")
        })?;
        let replace = bool_arg(args, "replace");
        let (id, shown) = self
            .write_file(folder, name, text.as_bytes(), mime_for(name), replace)
            .await?;
        Ok(
            json!([{ "kind": "file", "id": id, "name": shown.rsplit('/').next().unwrap_or(name), "path": shown, "size": text.len(), "text": shown }]),
        )
    }

    /// Save `bytes` as `name` in the drive folder at `folder` (made when
    /// missing); the new file's id and path. With `replace`, a file of the
    /// same name goes to the Trash; otherwise the drive picks a free name.
    pub async fn write_file(
        &mut self,
        folder: &str,
        name: &str,
        bytes: &[u8],
        mime: &str,
        replace: bool,
    ) -> Result<(String, String), ActionError> {
        if bytes.len() > MAX_FILE_TEXT_BYTES {
            return Err(ActionError::bad(format!(
                "actions write files of at most {MAX_FILE_TEXT_BYTES} bytes"
            )));
        }
        let drive = Drive::read(self).await?;
        let (parent, folder_path) = self.ensure_folder(&drive, folder).await?;
        let drive = Drive::read(self).await?;
        let existing = drive
            .children(&parent)
            .into_iter()
            .find(|e| {
                e["kind"] == "file"
                    && e["name"]
                        .as_str()
                        .is_some_and(|n| n.eq_ignore_ascii_case(name))
            })
            .and_then(|e| e["id"].as_str().map(str::to_string));
        let replaced = existing.filter(|_| replace);
        let mut start = json!({
            "parent": parent, "name": name, "size": bytes.len(), "type": mime,
            "existing": if replaced.is_some() { "replace" } else { "rename" },
        });
        if let Some(id) = &replaced {
            start["replaces"] = json!(id);
        }
        let reply = self
            .request("files", "POST", "/uploads", Body::Json(&start))
            .await?;
        if reply.status != 201 && reply.status != 200 {
            return Err(refusal("files", &reply));
        }
        let upload = reply.json["upload"]
            .as_str()
            .unwrap_or_default()
            .to_string();
        let piece_bytes = reply.json["piece_bytes"]
            .as_u64()
            .unwrap_or(192 * 1024)
            .max(1) as usize;
        let pieces = reply.json["pieces"].as_u64().unwrap_or(0) as usize;
        for n in 0..pieces {
            let from = n * piece_bytes;
            let to = (from + piece_bytes).min(bytes.len());
            let path = format!("/uploads/{upload}/{n}");
            let reply = self
                .request("files", "PUT", &path, Body::Raw(&bytes[from.min(to)..to]))
                .await?;
            if !(200..300).contains(&reply.status) {
                let path = format!("/uploads/{upload}");
                let _ = self.request("files", "DELETE", &path, Body::None).await;
                return Err(refusal("files", &reply));
            }
        }
        let path = format!("/uploads/{upload}/complete");
        let reply = self.request("files", "POST", &path, Body::None).await?;
        if !(200..300).contains(&reply.status) {
            return Err(refusal("files", &reply));
        }
        let id = reply.json["created"][0]
            .as_str()
            .unwrap_or_default()
            .to_string();
        let shown_name = reply.json["entries"]
            .as_array()
            .and_then(|entries| entries.iter().find(|e| e["id"] == id.as_str()))
            .and_then(|e| e["name"].as_str())
            .unwrap_or(name)
            .to_string();
        Ok((id, format!("{folder_path}/{shown_name}")))
    }

    /// The folder at `path`, made (with the folders above it) when missing.
    async fn ensure_folder(
        &mut self,
        drive: &Drive,
        path: &str,
    ) -> Result<(String, String), ActionError> {
        let segments: Vec<&str> = path
            .split('/')
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .collect();
        let Some((first, rest)) = segments.split_first() else {
            return Err(ActionError::bad(
                "a path starts with one of your folders, such as Documents",
            ));
        };
        let (mut id, mut shown) = drive
            .special(first)
            .ok_or_else(|| ActionError::bad(format!(
                "a path starts with Desktop, Documents, Downloads, Movies, Music or Pictures, not '{first}'"
            )))?;
        for segment in rest {
            let found = drive
                .children(&id)
                .into_iter()
                .find(|e| {
                    e["name"]
                        .as_str()
                        .is_some_and(|n| n.eq_ignore_ascii_case(segment))
                })
                .map(|e| {
                    (
                        e["id"].as_str().unwrap_or_default().to_string(),
                        e["kind"] == "folder",
                        e["name"].as_str().unwrap_or_default().to_string(),
                    )
                });
            match found {
                Some((child, true, name)) => {
                    id = child;
                    shown = format!("{shown}/{name}");
                }
                Some((_, false, _)) => {
                    return Err(ActionError::bad(format!(
                        "'{segment}' is a file, not a folder"
                    )))
                }
                None => {
                    let ops = json!({ "ops": [{ "op": "mkdir", "parent": id, "name": segment, "existing": "reuse" }] });
                    let reply = self
                        .request("files", "POST", "/ops", Body::Json(&ops))
                        .await?;
                    if reply.status != 200 {
                        return Err(refusal("files", &reply));
                    }
                    id = reply.json["created"][0]
                        .as_str()
                        .unwrap_or_default()
                        .to_string();
                    shown = format!("{shown}/{segment}");
                }
            }
        }
        Ok((id, shown))
    }

    // --------------------------------------------------------- Messages

    async fn messages_send(&mut self, args: &Value) -> Result<Value, ActionError> {
        let text = text_arg(args, "text")
            .or_else(|| input_text(args))
            .ok_or_else(|| ActionError::bad("a message needs text"))?;
        let room = text_arg(args, "room")
            .unwrap_or_else(|| "desktop".into())
            .to_lowercase();
        let name = self
            .session
            .account
            .as_ref()
            .map(|account| account.full_name.clone())
            .filter(|n| !n.trim().is_empty())
            .unwrap_or_else(|| "Me".into());
        let body = json!({ "text": text, "name": name });
        let path = format!("/rooms/{room}");
        let reply = self
            .request("messages", "POST", &path, Body::Json(&body))
            .await?;
        if !(200..300).contains(&reply.status) {
            return Err(refusal("messages", &reply));
        }
        Ok(json!([{ "kind": "message", "room": room, "text": text }]))
    }

    // ------------------------------------------------------- Appearance

    async fn appearance_set(&mut self, args: &Value) -> Result<Value, ActionError> {
        let mode = text_arg(args, "mode")
            .map(|m| m.to_lowercase())
            .ok_or_else(|| ActionError::bad("say which appearance: light, dark or auto"))?;
        if !matches!(mode.as_str(), "light" | "dark" | "auto" | "toggle") {
            return Err(ActionError::bad(format!(
                "'{mode}' is not an appearance: light, dark, auto or toggle"
            )));
        }
        if self.interactive {
            // The page switches and saves its own theme; writing it here too
            // would only race the page's save. A toggle follows what this run
            // already asked the page for, then what is stored.
            let chosen = if mode == "toggle" {
                let queued = self
                    .effects
                    .iter()
                    .rev()
                    .find_map(|effect| effect["appearance"].as_str().map(str::to_string));
                let current = match queued {
                    Some(mode) => mode,
                    None => {
                        let read = self.get_ok("system-preferences", "/settings").await?;
                        read["theme"]["appearance"]
                            .as_str()
                            .unwrap_or("light")
                            .to_string()
                    }
                };
                if current == "dark" { "light" } else { "dark" }.to_string()
            } else {
                mode
            };
            self.effects.push(json!({ "appearance": chosen }));
            return Ok(json!([{ "kind": "appearance", "mode": chosen, "text": chosen }]));
        }
        let mut chosen = mode.clone();
        let result = self
            .edit_document(
                "system-preferences",
                "/settings",
                Shape::Field("theme"),
                |theme| {
                    if !theme.is_object() {
                        *theme =
                            json!({ "appearance": "light", "accent": "blue", "highlight": "blue" });
                    }
                    chosen = if mode == "toggle" {
                        if theme["appearance"] == "dark" {
                            "light"
                        } else {
                            "dark"
                        }
                        .to_string()
                    } else {
                        mode.clone()
                    };
                    theme["appearance"] = json!(chosen);
                    Ok((
                        json!([{ "kind": "appearance", "mode": chosen, "text": chosen }]),
                        Map::new(),
                    ))
                },
            )
            .await;
        // System Preferences' PUT carries `values` beside `theme`.
        let result = match result {
            Err(error) if error.code == "refused" => self.appearance_with_values(&chosen).await,
            other => other,
        }?;
        self.effects.push(json!({ "appearance": chosen }));
        Ok(result)
    }

    /// System Preferences replaces its values and theme together: write the
    /// theme with the stored values.
    async fn appearance_with_values(&mut self, mode: &str) -> Result<Value, ActionError> {
        for _ in 0..3 {
            let read = self.get_ok("system-preferences", "/settings").await?;
            let mut theme = read["theme"].clone();
            if !theme.is_object() {
                theme = json!({ "appearance": "light", "accent": "blue", "highlight": "blue" });
            }
            theme["appearance"] = json!(mode);
            let body = json!({ "values": read["values"], "theme": theme, "rev": read["rev"] });
            let reply = self
                .request("system-preferences", "PUT", "/settings", Body::Json(&body))
                .await?;
            match reply.status {
                200 => return Ok(json!([{ "kind": "appearance", "mode": mode, "text": mode }])),
                409 => continue,
                _ => return Err(refusal("system-preferences", &reply)),
            }
        }
        Err(ActionError::new(
            "conflict",
            "System Preferences kept changing; try again",
        ))
    }

    // ------------------------------------------------------ Applications

    fn app_open(&mut self, args: &Value) -> Result<Value, ActionError> {
        let asked =
            text_arg(args, "app").ok_or_else(|| ActionError::bad("say which application"))?;
        let id = app_id(&asked).ok_or_else(|| {
            ActionError::new(
                "not_found",
                format!("there is no application named '{asked}'"),
            )
        })?;
        let place = text_arg(args, "place");
        if let Some(path) = &place {
            if id != "finder" {
                return Err(ActionError::bad("only Finder opens a folder"));
            }
            if !path.starts_with('/') {
                return Err(ActionError::bad("a folder is named by its whole path"));
            }
            self.effects.push(json!({ "open": id, "place": path }));
        } else {
            self.effects.push(json!({ "open": id }));
        }
        Ok(json!([{ "kind": "application", "id": id, "text": app_name(id) }]))
    }
}

/// The catalogue id of the application `asked` names (by id or name, any
/// case), Finder included.
pub fn app_id(asked: &str) -> Option<&'static str> {
    let wanted = asked.trim().trim_end_matches(".app").to_lowercase();
    if wanted == "finder" {
        return Some("finder");
    }
    crate::apps::catalogue::CATALOGUE
        .iter()
        .find(|app| app.id == wanted || app.name.to_lowercase() == wanted)
        .or_else(|| {
            crate::apps::catalogue::CATALOGUE
                .iter()
                .find(|app| app.id.replace('-', " ") == wanted)
        })
        .map(|app| app.id)
}

/// The name of the application `id`.
pub fn app_name(id: &str) -> &'static str {
    if id == "finder" {
        return "Finder";
    }
    crate::apps::catalogue::find(id).map_or("", |app| app.name)
}

fn mime_for(name: &str) -> &'static str {
    let lower = name.to_lowercase();
    if lower.ends_with(".js") {
        "text/javascript"
    } else if lower.ends_with(".md") {
        "text/markdown"
    } else if lower.ends_with(".json") {
        "application/json"
    } else if lower.ends_with(".csv") {
        "text/csv"
    } else if lower.ends_with(".html") {
        "text/html"
    } else {
        "text/plain"
    }
}

fn event_item(event: &Value, tz: i32) -> Value {
    let title = event["title"].as_str().unwrap_or("");
    let all_day = event["allDay"].as_bool().unwrap_or(false);
    let start = event["start"].as_i64().unwrap_or(0);
    let text = if all_day {
        format!("All day: {title}")
    } else {
        let at = lt::local(start, tz);
        format!("{} {title}", lt::clock_text(at.hour, at.minute))
    };
    json!({
        "kind": "event", "id": event["id"], "title": title, "start": start,
        "end": event["end"], "allDay": all_day, "calendar": event["calendar"], "text": text,
    })
}

/// The alert instant of every reminder that is due and still to do, as
/// Reminders' `PUT` requires: its due time on its day, or 9:00, in the
/// browser's zone.
pub fn reminder_alerts(reminders: &[Value], tz: i32) -> Value {
    let mut alerts = Map::new();
    for reminder in reminders {
        if reminder["completed"] == true {
            continue;
        }
        let (Some(id), Some(due)) = (reminder["id"].as_str(), reminder["due"].as_str()) else {
            continue;
        };
        let Some(day) = lt::parse_ymd(due) else {
            continue;
        };
        let minutes = reminder["dueTime"]
            .as_str()
            .and_then(lt::parse_time)
            .unwrap_or(9 * 60);
        let at = lt::utc_of(day, minutes, tz).max(1);
        alerts.insert(id.to_string(), json!(at));
    }
    Value::Object(alerts)
}

// ------------------------------------------------------------- pure text

fn text_get(args: &Value) -> Result<Value, ActionError> {
    let text = args
        .get("text")
        .and_then(Value::as_str)
        .ok_or_else(|| ActionError::bad("Get Specified Text needs text"))?;
    Ok(Value::Array(
        text.lines()
            .filter(|line| !line.trim().is_empty())
            .take(MAX_ITEMS)
            .map(text_item)
            .collect(),
    ))
}

fn text_filter(args: &Value) -> Result<Value, ActionError> {
    let needle = text_arg(args, "contains")
        .ok_or_else(|| ActionError::bad("Filter Items needs the text to look for"))?
        .to_lowercase();
    Ok(Value::Array(
        input_items(args)
            .into_iter()
            .filter(|item| item_text(item).to_lowercase().contains(&needle))
            .collect(),
    ))
}

fn text_case(args: &Value) -> Result<Value, ActionError> {
    let case = text_arg(args, "case").unwrap_or_default().to_lowercase();
    let change: fn(&str) -> String = match case.as_str() {
        "upper" => str::to_uppercase,
        "lower" => str::to_lowercase,
        "title" => title_case,
        _ => return Err(ActionError::bad("the case is upper, lower or title")),
    };
    Ok(Value::Array(
        input_items(args)
            .iter()
            .map(|item| text_item(&change(&item_text(item))))
            .collect(),
    ))
}

fn title_case(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut start = true;
    for c in text.chars() {
        if start && c.is_alphabetic() {
            out.extend(c.to_uppercase());
            start = false;
        } else {
            out.extend(c.to_lowercase());
            if c.is_whitespace() {
                start = true;
            }
        }
    }
    out
}

fn text_combine(args: &Value) -> Result<Value, ActionError> {
    let separator = args
        .get("separator")
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .unwrap_or("\n")
        .replace("\\n", "\n");
    let joined = input_items(args)
        .iter()
        .map(item_text)
        .collect::<Vec<_>>()
        .join(&separator);
    Ok(json!([text_item(&joined)]))
}

// ------------------------------------------------------------ the drive

/// The person's drive, as `GET /api/files/` lists it.
struct Drive {
    entries: Vec<Value>,
}

impl Drive {
    async fn read(actor: &mut Actor<'_>) -> Result<Drive, ActionError> {
        let read = actor.get_ok("files", "/").await?;
        Ok(Drive {
            entries: read["entries"].as_array().cloned().unwrap_or_default(),
        })
    }

    fn entry(&self, id: &str) -> Option<&Value> {
        self.entries
            .iter()
            .find(|e| e["id"] == id && e.get("trashed_ms").is_none_or(Value::is_null))
    }

    fn is_folder(&self, id: &str) -> bool {
        self.entry(id).is_some_and(|e| e["kind"] == "folder")
    }

    /// The live entries in the folder `id`, by name.
    fn children(&self, id: &str) -> Vec<&Value> {
        let mut children: Vec<&Value> = self
            .entries
            .iter()
            .filter(|e| e["parent"] == id && e.get("trashed_ms").is_none_or(Value::is_null))
            .collect();
        children.sort_by_key(|e| e["name"].as_str().unwrap_or("").to_lowercase());
        children
    }

    /// The special folder named `name` (any case), with its name.
    fn special(&self, name: &str) -> Option<(String, String)> {
        self.entries
            .iter()
            .filter(|e| e.get("parent").is_none_or(Value::is_null) && e["kind"] == "folder")
            .find(|e| {
                e["name"]
                    .as_str()
                    .is_some_and(|n| n.eq_ignore_ascii_case(name))
                    || e["id"]
                        .as_str()
                        .is_some_and(|n| n.eq_ignore_ascii_case(name))
            })
            .map(|e| {
                (
                    e["id"].as_str().unwrap_or_default().to_string(),
                    e["name"].as_str().unwrap_or_default().to_string(),
                )
            })
    }

    /// The entry at `path` (`Documents/Scripts/x.js`), with the path as the
    /// drive spells it.
    fn resolve(&self, path: &str) -> Option<(String, String)> {
        let mut segments = path.split('/').map(str::trim).filter(|s| !s.is_empty());
        let (mut id, mut shown) = self.special(segments.next()?)?;
        for segment in segments {
            let child = self.children(&id).into_iter().find(|e| {
                e["name"]
                    .as_str()
                    .is_some_and(|n| n.eq_ignore_ascii_case(segment))
            })?;
            id = child["id"].as_str()?.to_string();
            shown = format!("{shown}/{}", child["name"].as_str()?);
        }
        Some((id, shown))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_dictionary_is_well_formed() {
        let mut seen = std::collections::BTreeSet::new();
        for action in ACTIONS {
            assert!(seen.insert(action.name), "{} twice", action.name);
            let (app, verb) = action.name.split_once('.').expect("app.verb");
            assert!(!app.is_empty() && !verb.is_empty());
            assert!(!action.title.is_empty() && !action.summary.is_empty());
            assert!(!DENIED_APPS.contains(&action.app));
            for param in action.params {
                assert!(param.name != "input", "input is the previous step's");
            }
        }
    }

    #[test]
    fn applications_are_found_by_name_or_id() {
        assert_eq!(app_id("Notes"), Some("notes"));
        assert_eq!(app_id("system preferences"), Some("system-preferences"));
        assert_eq!(app_id("system-preferences"), Some("system-preferences"));
        assert_eq!(app_id("Safari.app"), Some("safari"));
        assert_eq!(app_id("Finder"), Some("finder"));
        assert_eq!(app_id("Photoshop"), None);
    }

    #[test]
    fn items_carry_their_text() {
        assert_eq!(item_text(&json!("plain")), "plain");
        assert_eq!(item_text(&json!({ "text": "a" })), "a");
        assert_eq!(item_text(&json!({ "title": "t" })), "t");
        assert_eq!(item_text(&json!(3)), "3");
        let args = json!({ "input": [{ "text": "Milk" }, { "text": "eggs" }], "contains": "MILK" });
        assert_eq!(text_filter(&args).unwrap(), json!([{ "text": "Milk" }]));
        let args = json!({ "input": ["hello world"], "case": "title" });
        assert_eq!(text_case(&args).unwrap()[0]["text"], "Hello World");
        let args = json!({ "input": ["a", "b"], "separator": ", " });
        assert_eq!(text_combine(&args).unwrap()[0]["text"], "a, b");
        assert_eq!(
            text_get(&json!({ "text": "x\n\ny" }))
                .unwrap()
                .as_array()
                .unwrap()
                .len(),
            2
        );
    }

    #[test]
    fn due_reminders_alert_at_their_time_or_nine() {
        let tz = -420; // UTC-7
        let reminders = vec![
            json!({ "id": "a", "due": "2026-10-14" }),
            json!({ "id": "b", "due": "2026-10-14", "dueTime": "17:30" }),
            json!({ "id": "c", "due": "2026-10-14", "completed": true }),
            json!({ "id": "d" }),
        ];
        let alerts = reminder_alerts(&reminders, tz);
        let day = lt::days_from_civil(2026, 10, 14);
        assert_eq!(alerts["a"], json!(lt::utc_of(day, 9 * 60, tz)));
        assert_eq!(alerts["b"], json!(lt::utc_of(day, 17 * 60 + 30, tz)));
        assert_eq!(alerts.as_object().unwrap().len(), 2);
    }
}

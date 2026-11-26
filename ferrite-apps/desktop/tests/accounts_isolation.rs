//! Accounts keep every person's data apart, in every app module.
//!
//! Two accounts, A and B, sign up in two browsers. A saves something in
//! every module that keeps per-person data, each write carrying a marker of
//! its own (`markerA<module>`) or, where the body has no free text, a
//! document B never sends. Then B reads every module's `GET` routes,
//! searches Spotlight for A's markers and asks Storage Management, About This
//! Mac and System Information what it keeps: none of A's data may appear,
//! and B's own documents read as never saved. B then saves and forgets in
//! every module, and A's keys in the `data` store must be byte for byte as
//! they were. Last, a browser that never signed in, A's browser after it
//! signs out, and A's cookie from before the sign-out reach none of A's data,
//! and signing A in again brings all of it back.
//!
//! Every module in `MODULES` is either probed here ([`probes`]) or listed in
//! [`NOT_PERSONAL`] with the reason it keeps no per-person data, and a test
//! fails when a module is added without one or the other.

use std::collections::{BTreeMap, BTreeSet};

use ferrite_app::{serde_json, IngressReply};
use ferrite_app_test::{ingress, TestEnv, TestHarness};
use serde_json::{json, Value};

const PEPPER: &str = "test-pepper-0123456789abcdef0123456789abcdef";
const PASSWORD_A: &str = "correct horse battery";
const PASSWORD_B: &str = "another staple pony";

/// Modules that keep no data of one person, so there is nothing of A's for
/// B to reach through them. B still reads each of their `GET` routes
/// ([`shared_reads`]) and none may show A's data.
const NOT_PERSONAL: &[(&str, &str)] = &[
    (
        "about-this-mac",
        "reports the deployment and the caller's own storage counts; stores nothing",
    ),
    (
        "activity-monitor",
        "shows the application's request counters, shared by design",
    ),
    (
        "console",
        "shows the application's own log, shared by design and free of typed text",
    ),
    (
        "siri",
        "answers requests through the other modules for the caller; stores nothing",
    ),
    (
        "weather",
        "keeps public forecasts by a rounded point and place names, for everyone; nothing of a person",
    ),
    (
        "spotlight",
        "searches the caller's own documents in other modules; keeps only the words of the caller's own files, in the caller's own space",
    ),
    (
        "storage-management",
        "reports the caller's own keys per module; stores nothing",
    ),
    (
        "system-information",
        "reports the deployment, modules and counters; stores nothing",
    ),
];

async fn boot() -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let env = TestHarness::new()
        .with_blob("files")
        .with_queue("requests")
        .with_queue("replies")
        .with_store("data")
        .build()
        .await;
    let mut payload = env.payload().clone();
    payload
        .secrets
        .insert("mac_password_pepper".into(), PEPPER.into());
    let ctx = ferrite_app::AppContext::with_clock(payload, env.clock());
    env.run_app(move |_| async move { macalicious_desktop::run(ctx).await });
    crate::support::Env::new(env, slot)
}

fn text(reply: &IngressReply) -> String {
    String::from_utf8_lossy(&reply.body).into_owned()
}

fn json_of(reply: &IngressReply) -> Value {
    serde_json::from_slice(&reply.body).unwrap_or_else(|e| panic!("{e}: {}", text(reply)))
}

/// One browser: the session cookie it holds, replaced by every reply that
/// sets a new one.
#[derive(Clone)]
struct Browser {
    token: Option<String>,
}

impl Browser {
    fn new() -> Self {
        Browser { token: None }
    }

    async fn send(
        &mut self,
        env: &TestEnv,
        method: &str,
        path: &str,
        content_type: Option<&str>,
        body: &[u8],
    ) -> IngressReply {
        let mut req = ingress::request(method, path, "", body);
        if let Some(content_type) = content_type {
            req.headers
                .push(("content-type".into(), content_type.into()));
        }
        if let Some(token) = &self.token {
            req.headers
                .push(("cookie".into(), format!("mac_session={token}")));
        }
        let reply = env
            .handle(req)
            .await
            .unwrap_or_else(|e| panic!("{method} {path}: no reply: {e}"));
        if let Some((_, cookie)) = reply
            .headers
            .iter()
            .find(|(n, _)| n.eq_ignore_ascii_case("set-cookie"))
        {
            let pair = cookie.split(';').next().unwrap_or("").trim();
            if let Some(token) = pair.strip_prefix("mac_session=") {
                self.token = Some(token.to_string());
            }
        }
        reply
    }

    async fn get(&mut self, env: &TestEnv, path: &str) -> IngressReply {
        self.send(env, "GET", path, None, b"").await
    }

    async fn json(
        &mut self,
        env: &TestEnv,
        method: &str,
        path: &str,
        body: &Value,
    ) -> IngressReply {
        self.send(
            env,
            method,
            path,
            Some("application/json"),
            body.to_string().as_bytes(),
        )
        .await
    }
}

async fn sign_up(env: &TestEnv, name: &str, full_name: &str, password: &str) -> Browser {
    let mut browser = Browser::new();
    let reply = browser
        .json(
            env,
            "POST",
            "/api/session/sign-up",
            &json!({ "name": name, "full_name": full_name, "password": password }),
        )
        .await;
    assert_eq!(reply.status, 201, "sign-up of {name}: {}", text(&reply));
    let token = browser
        .token
        .clone()
        .expect("sign-up sets the session cookie");
    assert_eq!(token.len(), 64, "the session token is 32 bytes in hex");
    let session = json_of(&browser.get(env, "/api/session").await);
    assert_eq!(session["account"]["name"], name, "{session}");
    browser
}

/// The marker a person's write carries in a module: `markerA<tag>`.
fn mark(who: &str, tag: &str) -> String {
    format!("marker{who}{tag}")
}

/// One write a person sends.
struct Write {
    method: &'static str,
    path: String,
    content_type: &'static str,
    body: Vec<u8>,
}

fn put(path: &str, body: Value) -> Write {
    Write {
        method: "PUT",
        path: path.into(),
        content_type: "application/json",
        body: body.to_string().into_bytes(),
    }
}

fn post(path: &str, body: Value) -> Write {
    Write {
        method: "POST",
        ..put(path, body)
    }
}

/// A body that starts as a JPEG does.
fn jpeg(len: usize, fill: u8) -> Vec<u8> {
    let mut bytes = vec![0xFF, 0xD8, 0xFF, 0xE0];
    bytes.resize(len, fill);
    bytes
}

/// One module's probe, for one person (`who` is `A` or `B`).
struct Probe {
    module: &'static str,
    /// What the person saves.
    writes: Vec<Write>,
    /// `(GET path, text its reply holds once the person has saved)`.
    shows: Vec<(&'static str, String)>,
    /// `(GET path, text its reply holds for someone who saved nothing)`:
    /// every route that reads the person's own data.
    reads: Vec<(&'static str, &'static str)>,
    /// Every `DELETE` route the module has.
    deletes: Vec<String>,
}

/// A cover Music keeps for `who`, named by the SHA-256 of its bytes: each person's differs.
fn music_cover(who: &str) -> Vec<u8> {
    let mut bytes = b"\x89PNG\r\n\x1a\n".to_vec();
    bytes.extend_from_slice(mark(who, "musiccover").as_bytes());
    bytes
}

fn music_cover_path(who: &str) -> String {
    let digest = ferrite_app::crypto::hex(&ferrite_app::crypto::sha256(&music_cover(who)));
    format!("/api/music/artwork/{digest}")
}

/// The module whose space keeps a module's writes: Script Editor saves
/// scripts as files in the person's drive, so they land under `files`.
fn stores_under(module: &str) -> &str {
    match module {
        "script-editor" => "files",
        other => other,
    }
}

/// Every module that keeps per-person data, with writes of `who`.
fn probes(who: &str) -> Vec<Probe> {
    let m = |tag: &str| mark(who, tag);
    let a_photo = mark("A", "photobooth");
    let a_picture = mark("A", "photoid");
    // Base64 letters only, a multiple of four: 24 characters are 18 bytes,
    // more than the 16-byte GCM tag the envelope check asks for.
    let mut ciphertext = m("keychain");
    while ciphertext.len() % 4 != 0 || ciphertext.len() < 24 {
        ciphertext.push('A');
    }
    let (launchpad, installed, podcasts_subscribed) = if who == "A" {
        (
            json!(["notes", "calculator"]),
            "books",
            json!(["signal-path"]),
        )
    } else {
        (json!(["calculator"]), "voice-memos", json!([]))
    };
    let page = if who == "A" { 1 } else { 0 };
    let chess_level = if who == "A" { 2 } else { 3 };
    let audio_quality = if who == "A" { "lossless" } else { "compressed" };
    // TV's probe: each person keeps a different YouTube video (two Blender open films).
    let video = if who == "A" {
        "aqz-KE-bpKQ"
    } else {
        "eRsGyueVLvQ"
    };
    vec![
        Probe {
            module: "app-store",
            writes: vec![put(
                "/api/app-store/library",
                json!({ "installed": [installed], "rev": 0 }),
            )],
            shows: vec![(
                "/api/app-store/library",
                format!(r#""installed":["{installed}"]"#),
            )],
            reads: vec![("/api/app-store/library", r#""installed":null"#)],
            deletes: vec!["/api/app-store/library".into()],
        },
        Probe {
            module: "automator",
            writes: vec![
                put(
                    "/api/automator/workflows",
                    json!({ "library": { "tz": 0, "workflows": [{ "id": "w1", "name": m("automator"),
                        "kind": "workflow", "enabled": true, "steps": [] }] }, "rev": 0 }),
                ),
                post(
                    "/api/automator/run",
                    json!({ "workflow": { "id": "w2", "name": m("automator-run"), "kind": "workflow",
                        "enabled": true, "steps": [] }, "tz": 0 }),
                ),
            ],
            shows: vec![
                ("/api/automator/workflows", m("automator")),
                ("/api/automator/runs", m("automator-run")),
            ],
            reads: vec![
                ("/api/automator/workflows", r#""library":null"#),
                ("/api/automator/runs", r#""runs":[]"#),
            ],
            deletes: vec![],
        },
        Probe {
            module: "script-editor",
            writes: vec![post(
                "/api/script-editor/scripts",
                json!({ "name": m("script"), "code": "return 1;" }),
            )],
            shows: vec![("/api/script-editor/scripts", m("script"))],
            reads: vec![("/api/script-editor/scripts", r#""scripts":[]"#)],
            deletes: vec![],
        },
        Probe {
            module: "books",
            // The library, with a book from the Book Store, and the person's reading of that
            // book: the place, a bookmark and a highlight with a note.
            writes: vec![
                put(
                    "/api/books/library",
                    json!({ "library": {
                        "collections": [{ "id": "collection-1", "name": m("books"), "books": ["pg-2701"] }],
                        "pages": { "aqua-and-bondi": 2 }, "marks": { "aqua-and-bondi": [2] }, "sort": "title",
                        "books": [{ "id": "pg-2701", "title": m("bookstitle"), "author": "Herman Melville",
                            "source": "gutenberg", "added": 1_760_000_000_000_u64 }]
                    }, "rev": 0 }),
                ),
                put(
                    "/api/books/reading/pg-2701",
                    json!({ "reading": {
                        "place": 27_982,
                        "bookmarks": [{ "at": 27_982, "label": m("booksmark") }],
                        "highlights": [{ "id": "h-1", "start": 28_004, "end": 28_020, "color": "yellow",
                            "text": "Call me Ishmael.", "note": m("booksnote") }]
                    }, "rev": 0 }),
                ),
            ],
            shows: vec![
                ("/api/books/library", m("bookstitle")),
                ("/api/books/reading/pg-2701", m("booksnote")),
            ],
            reads: vec![
                ("/api/books/library", r#""library":null"#),
                ("/api/books/reading/pg-2701", r#""reading":null"#),
            ],
            deletes: vec![
                "/api/books/library".into(),
                "/api/books/reading/pg-2701".into(),
            ],
        },
        Probe {
            module: "calculator",
            writes: vec![post(
                "/api/calculator/tape",
                json!({ "expression": m("calculator"), "result": "1" }),
            )],
            shows: vec![("/api/calculator/tape", m("calculator"))],
            reads: vec![("/api/calculator/tape", r#""entries":[]"#)],
            deletes: vec!["/api/calculator/tape".into()],
        },
        Probe {
            // A game against the computer is on the person's own list; a
            // game between two accounts is probed below
            // ([`a_game_between_two_accounts_reaches_no_third`]).
            module: "chess",
            writes: vec![post(
                "/api/chess/games",
                json!({ "computer": { "side": "black", "level": chess_level } }),
            )],
            shows: vec![("/api/chess/mine", format!("Computer (level {chess_level})"))],
            reads: vec![("/api/chess/mine", r#""games":[]"#)],
            deletes: vec![],
        },
        Probe {
            // A call needs a second person, so the calls between two
            // accounts are probed below
            // ([`a_call_between_two_accounts_reaches_no_third`]); here B
            // reads and clears an empty history.
            module: "facetime",
            writes: vec![],
            shows: vec![],
            reads: vec![("/api/facetime/calls", r#""recents":[]"#)],
            deletes: vec!["/api/facetime/calls".into()],
        },
        Probe {
            module: "calendar",
            writes: vec![put(
                "/api/calendar/events",
                json!({ "events": [{ "id": "new-1", "title": m("calendar"), "start": 1_570_118_400_000_i64,
                    "end": 1_570_122_000_000_i64, "calendar": "home" }], "rev": 0 }),
            )],
            shows: vec![("/api/calendar/events", m("calendar"))],
            reads: vec![
                ("/api/calendar/events", r#""events":null"#),
                ("/api/calendar/inbox", r#""invitations":[]"#),
                ("/api/calendar/sent", r#""events":{}"#),
            ],
            deletes: vec!["/api/calendar/events".into()],
        },
        Probe {
            module: "contacts",
            writes: vec![
                put(
                    "/api/contacts/cards",
                    json!({ "cards": [{ "id": "new-1", "account": "icloud", "first": m("contacts"), "last": "Marsh" }], "rev": 0 }),
                ),
                put(
                    "/api/contacts/smart-groups",
                    json!({ "smart_groups": [{ "id": "sg-1", "name": m("smartgroup"),
                        "rule": "contains", "text": m("rule") }], "rev": 0 }),
                ),
            ],
            shows: vec![
                ("/api/contacts/cards", m("contacts")),
                ("/api/contacts/smart-groups", m("smartgroup")),
            ],
            reads: vec![
                ("/api/contacts/cards", r#""cards":null"#),
                ("/api/contacts/smart-groups", r#""smart_groups":null"#),
                ("/api/contacts/people", r#""people":[]"#),
                ("/api/contacts/pictures?ids=new-1", r#""pictures":{}"#),
            ],
            deletes: vec![
                "/api/contacts/cards".into(),
                "/api/contacts/smart-groups".into(),
                "/api/contacts/pictures/new-1".into(),
            ],
        },
        Probe {
            // Its history grows only from a look-up a source answered, which
            // the harness's deny-all egress never does: A's history is written
            // into A's space directly ([`seed_lookups`]).
            module: "dictionary",
            writes: vec![],
            shows: vec![("/api/dictionary/history", m("dictionary"))],
            reads: vec![("/api/dictionary/history", r#""history":null"#)],
            deletes: vec!["/api/dictionary/history".into()],
        },
        Probe {
            module: "find-my",
            writes: vec![put(
                "/api/find-my/me",
                json!({ "lat": 37.33, "lon": -122.01, "accuracy_m": 10.0, "label": m("findmy"),
                    "reported_at": 1 }),
            )],
            shows: vec![("/api/find-my/devices", m("findmy"))],
            reads: vec![("/api/find-my/devices", r#""devices":[]"#)],
            // A device is named by a hash of its session; B forgets in its own
            // space only, whatever id it names. `find_my_devices_are_their_owners`
            // names A's real device.
            deletes: vec![
                "/api/find-my/devices/0123456789abcdef/sound?request=0000000000000000".into(),
                "/api/find-my/devices/0123456789abcdef".into(),
            ],
        },
        Probe {
            module: "font-book",
            writes: vec![put(
                "/api/font-book/library",
                json!({ "collections": [{ "id": "collection-1", "name": m("fontbook"), "families": [] }],
                    "disabled": ["verdana"], "rev": 0 }),
            )],
            shows: vec![("/api/font-book/library", m("fontbook"))],
            reads: vec![("/api/font-book/library", r#""collections":null"#)],
            deletes: vec!["/api/font-book/library".into()],
        },
        Probe {
            module: "help-viewer",
            writes: vec![put(
                "/api/help-viewer/place",
                json!({ "page": format!("server:{}", m("helpviewer")), "rev": 0 }),
            )],
            shows: vec![("/api/help-viewer/place", m("helpviewer"))],
            reads: vec![("/api/help-viewer/place", r#""page":null"#)],
            deletes: vec!["/api/help-viewer/place".into()],
        },
        Probe {
            module: "home",
            writes: vec![put(
                "/api/home/homes",
                json!({ "homes": [{ "id": format!("home-{who}"), "name": m("home"), "rooms": ["Den"],
                    "accessories": [{ "id": format!("light-{who}"), "room": "Den", "name": "Light", "kind": "light", "on": true }],
                    "scenes": [] }], "rev": 0 }),
            )],
            shows: vec![("/api/home/homes", m("home"))],
            reads: vec![("/api/home/homes", r#""homes":null"#)],
            deletes: vec!["/api/home/homes".into()],
        },
        Probe {
            module: "keychain-access",
            writes: vec![put(
                "/api/keychain-access/vault",
                json!({ "vault": { "version": 1,
                    "kdf": { "name": "PBKDF2-SHA-256", "iterations": 600_000, "salt": "AAAAAAAAAAAAAAAAAAAAAA==" },
                    "iv": "AAAAAAAAAAAAAAAA", "ciphertext": ciphertext }, "rev": 0 }),
            )],
            shows: vec![("/api/keychain-access/vault", m("keychain"))],
            reads: vec![("/api/keychain-access/vault", r#""vault":null"#)],
            deletes: vec!["/api/keychain-access/vault".into()],
        },
        Probe {
            module: "launchpad",
            writes: vec![put(
                "/api/launchpad/layout",
                json!({ "order": launchpad, "page": page, "rev": 0 }),
            )],
            shows: vec![("/api/launchpad/layout", format!(r#""order":{launchpad}"#))],
            reads: vec![("/api/launchpad/layout", r#""order":null"#)],
            deletes: vec!["/api/launchpad/layout".into()],
        },
        Probe {
            module: "mail",
            writes: vec![post(
                "/api/mail/drafts",
                json!({ "to": [m("mailto")], "subject": m("mail"), "text": m("mailtext") }),
            )],
            shows: vec![("/api/mail/messages", m("mail"))],
            reads: vec![("/api/mail/messages", r#""messages":[]"#)],
            deletes: vec![
                "/api/mail/trash".into(),
                format!("/api/mail/messages/{}-{}", "0".repeat(16), "0".repeat(16)),
            ],
        },
        Probe {
            module: "maps",
            writes: vec![put(
                "/api/maps/places",
                json!({ "favorites": [{ "id": "osm-n1", "name": m("maps"), "category": "Place",
                    "lat": 37.8, "lon": -122.4, "address": [] }], "recents": [], "guides": [], "rev": 0 }),
            )],
            shows: vec![("/api/maps/places", m("maps"))],
            reads: vec![("/api/maps/places", r#""favorites":null"#)],
            deletes: vec!["/api/maps/places".into()],
        },
        Probe {
            // Its history grows only from a lookup that reached the resolver,
            // which the harness's deny-all egress never does: A's history is
            // written into A's space directly ([`seed_lookups`]).
            module: "network-utility",
            writes: vec![],
            shows: vec![("/api/network-utility/history", m("networkutility"))],
            reads: vec![("/api/network-utility/history", r#""history":null"#)],
            deletes: vec!["/api/network-utility/history".into()],
        },
        Probe {
            module: "files",
            writes: vec![post(
                "/api/files/ops",
                json!({ "ops": [{ "op": "mkdir", "parent": "documents", "name": m("files") }] }),
            )],
            shows: vec![("/api/files/", m("files"))],
            // A drive nobody changed is the six empty folders at revision 0;
            // reading it writes nothing.
            reads: vec![("/api/files/", r#""rev":0"#)],
            // The only DELETE route gives up an upload; one B never opened
            // changes nothing.
            deletes: vec![format!("/api/files/uploads/{}", "0".repeat(32))],
        },
        Probe {
            module: "news",
            writes: vec![put(
                "/api/news/library",
                json!({ "library": {
                    "following": ["bbc"], "blocked": [],
                    "saved": [{ "id": format!("story-{who}"), "source": "bbc", "publisher": "BBC News",
                        "title": m("news"), "link": "https://www.bbc.co.uk/news/1" }],
                    "history": []
                }, "rev": 0 }),
            )],
            shows: vec![("/api/news/library", m("news"))],
            reads: vec![("/api/news/library", r#""library":null"#)],
            deletes: vec!["/api/news/library".into()],
        },
        Probe {
            module: "notes",
            writes: vec![put(
                "/api/notes/data",
                json!({ "base": 0, "data": {
                    "folders": [{ "id": "notes", "name": "Notes" }],
                    "notes": [{ "id": "new-note-1", "folder": "notes", "lines": [m("notes"), "Two eggs"],
                        "date": "8:00 AM", "edited": "October 12, 2026 at 8:00 AM" }]
                } }),
            )],
            shows: vec![("/api/notes/data", m("notes"))],
            reads: vec![("/api/notes/data", r#""data":null"#)],
            deletes: vec![],
        },
        Probe {
            module: "notification-center",
            writes: vec![post(
                "/api/notification-center/notify",
                json!({ "app": "finder", "title": m("notificationcenter") }),
            )],
            shows: vec![("/api/notification-center/inbox", m("notificationcenter"))],
            reads: vec![("/api/notification-center/inbox", r#""items":[]"#)],
            deletes: vec!["/api/notification-center/inbox".into()],
        },
        Probe {
            module: "photo-booth",
            writes: vec![Write {
                method: "PUT",
                path: format!("/api/photo-booth/photos/{}?effect=sepia", m("photobooth")),
                content_type: "image/jpeg",
                body: jpeg(2_000, if who == "A" { 0xA } else { 0xB }),
            }],
            shows: vec![("/api/photo-booth/photos", m("photobooth"))],
            reads: vec![("/api/photo-booth/photos", r#""photos":[]"#)],
            // B also tries to forget A's photo by its id.
            deletes: vec![
                format!("/api/photo-booth/photos/{a_photo}"),
                "/api/photo-booth/photos".into(),
            ],
        },
        Probe {
            module: "messages",
            // A conversation with oneself, named with the marker: nobody else
            // is in it, so it is the person's own data.
            writes: vec![post(
                "/api/messages/conversations",
                json!({ "to": [if who == "A" { "alice" } else { "bob" }], "title": m("messages") }),
            )],
            shows: vec![("/api/messages/conversations", m("messages"))],
            reads: vec![("/api/messages/conversations", r#""conversations":[]"#)],
            deletes: vec![],
        },
        Probe {
            module: "music",
            writes: vec![
                put(
                    "/api/music/library",
                    json!({ "library": {
                        "songs": [{ "id": m("musicsong"), "title": m("music"), "artist": "", "album": "",
                            "duration": 10.0, "added": 1,
                            "source": { "kind": "file", "file": m("musicfile"), "name": "tone.wav",
                                "type": "audio/wav", "size": 441000 } }],
                        "playlists": [{ "id": "p1", "name": m("musiclist"), "songs": [m("musicsong")] }],
                        "loved": [m("musicsong")]
                    }, "rev": 0 }),
                ),
                put(
                    "/api/music/playback",
                    json!({ "playback": {
                        "queue": [m("musicsong")], "unshuffled": [], "index": 0, "position": 3.0,
                        "shuffle": false, "repeat": "off", "volume": 50,
                        "recent": [m("musicsong")], "plays": {}
                    }, "rev": 0 }),
                ),
                Write {
                    method: "PUT",
                    path: music_cover_path(who),
                    content_type: "image/png",
                    body: music_cover(who),
                },
            ],
            shows: vec![
                ("/api/music/library", m("music")),
                (
                    "/api/music/playback",
                    format!(r#""recent":["{}"]"#, m("musicsong")),
                ),
            ],
            reads: vec![
                ("/api/music/library", r#""library":null"#),
                ("/api/music/playback", r#""playback":null"#),
            ],
            // B also tries to forget A's cover by its digest.
            deletes: vec![
                "/api/music/library".into(),
                "/api/music/playback".into(),
                music_cover_path("A"),
            ],
        },
        Probe {
            module: "photos",
            writes: vec![
                post(
                    "/api/photos/photos",
                    json!({ "id": m("photoid"), "file": m("photofile"), "name": m("photos"),
                        "mime": "image/jpeg", "bytes": 300_000, "width": 4000, "height": 3000,
                        "taken_ms": 1_570_000_000_000_u64, "source": "import",
                        // A JPEG's first bytes, in standard base64.
                        "thumb": "/9j/4AECAw==" }),
                ),
                post(
                    "/api/photos/albums",
                    json!({ "id": "album-1", "name": m("photosalbum") }),
                ),
            ],
            shows: vec![
                ("/api/photos/library", m("photos")),
                ("/api/photos/library", m("photosalbum")),
            ],
            reads: vec![("/api/photos/library", r#""photos":[]"#)],
            // B also tries to delete A's photo and A's album by their ids.
            deletes: vec![
                format!("/api/photos/photos/{a_picture}"),
                "/api/photos/albums/album-1".into(),
            ],
        },
        Probe {
            module: "podcasts",
            writes: vec![put(
                "/api/podcasts/library",
                json!({ "library": {
                    "subscribed": podcasts_subscribed, "played": [], "positions": {},
                    "settings": { "refresh": "Every Day", "download": "All Unplayed", "skipForward": 30,
                        "skipBack": 15, "continuous": false, "sync": true }
                }, "rev": 0 }),
            )],
            shows: vec![(
                "/api/podcasts/library",
                format!(r#""subscribed":{podcasts_subscribed}"#),
            )],
            reads: vec![("/api/podcasts/library", r#""library":null"#)],
            deletes: vec!["/api/podcasts/library".into()],
        },
        Probe {
            module: "preview",
            writes: vec![
                // The same file id for both people: markup is kept per person, not per file.
                put(
                    "/api/preview/markup/previewfile",
                    json!({ "markup": { "rotation": 0, "pages": [{ "page": 1, "items": [
                        { "id": m("previewmark"), "kind": "text", "color": "#000000",
                          "stroke": 0.004, "x": 0.1, "y": 0.1, "w": 0.3, "h": 0.05,
                          "text": m("previewtext"), "size": 0.03 }
                    ] }] }, "rev": 0 }),
                ),
                put(
                    "/api/preview/signatures",
                    json!({ "signatures": [
                        { "id": m("previewsig"), "aspect": 3.0, "strokes": [[[0.0, 0.0], [1.0, 1.0]]] }
                    ], "rev": 0 }),
                ),
            ],
            shows: vec![
                ("/api/preview/markup/previewfile", m("previewtext")),
                ("/api/preview/signatures", m("previewsig")),
            ],
            reads: vec![
                ("/api/preview/markup/previewfile", r#""markup":null"#),
                ("/api/preview/signatures", r#""signatures":null"#),
            ],
            deletes: vec!["/api/preview/markup/previewfile?rev=1".into()],
        },
        Probe {
            module: "quicktime-player",
            writes: vec![put(
                "/api/quicktime-player/recents",
                json!({ "recents": [
                    { "file": m("qtfile"), "name": m("qtname"), "at": 1, "position": 30 }
                ], "rev": 0 }),
            )],
            shows: vec![("/api/quicktime-player/recents", m("qtname"))],
            reads: vec![("/api/quicktime-player/recents", r#""recents":null"#)],
            deletes: vec!["/api/quicktime-player/recents".into()],
        },
        Probe {
            module: "reminders",
            writes: vec![
                put(
                    "/api/reminders/data",
                    json!({ "base": 0, "alerts": {}, "data": {
                        "lists": [{ "id": "reminders", "name": "Reminders", "color": "blue" }],
                        "reminders": [{ "id": "new-1", "listId": "reminders", "title": m("reminders") }]
                    } }),
                ),
                // A dismissal names a reminder id; B names A's.
                post("/api/reminders/alerts/new-1/dismiss", json!({ "at": 1 })),
            ],
            shows: vec![("/api/reminders/data", m("reminders"))],
            reads: vec![
                ("/api/reminders/data", r#""data":null"#),
                ("/api/reminders/alerts", r#""alerts":[]"#),
                ("/api/reminders/shared", r#""lists":[]"#),
            ],
            deletes: vec![],
        },
        Probe {
            module: "safari",
            writes: vec![
                post(
                    "/api/safari/history",
                    json!({ "url": format!("https://www.example.org/{}", m("safarihistory")), "title": m("safarihistory") }),
                ),
                put(
                    "/api/safari/bookmarks",
                    json!({ "favorites": [], "bookmarks": [{ "title": m("safaribookmarks"),
                        "url": "https://en.wikipedia.org/wiki/Main_Page" }], "rev": 0 }),
                ),
                put(
                    "/api/safari/reading-list",
                    json!({ "items": [{ "title": m("safarireadinglist"), "url": "https://text.npr.org/",
                        "added": 5, "read": false }], "rev": 0 }),
                ),
                put(
                    "/api/safari/tabs",
                    json!({ "tabs": [format!("https://example.com/{}", m("safaritabs"))], "active": 0, "rev": 0 }),
                ),
            ],
            shows: vec![
                ("/api/safari/history", m("safarihistory")),
                ("/api/safari/bookmarks", m("safaribookmarks")),
                ("/api/safari/reading-list", m("safarireadinglist")),
                ("/api/safari/tabs", m("safaritabs")),
            ],
            reads: vec![
                ("/api/safari/history", r#""history":null"#),
                ("/api/safari/bookmarks", r#""rev":0"#),
                ("/api/safari/reading-list", r#""rev":0"#),
                ("/api/safari/tabs", r#""rev":0"#),
            ],
            deletes: vec![
                "/api/safari/history".into(),
                "/api/safari/bookmarks".into(),
                "/api/safari/reading-list".into(),
                "/api/safari/tabs".into(),
            ],
        },
        Probe {
            module: "stickies",
            writes: vec![put(
                "/api/stickies/data",
                json!({ "base": 0, "data": { "notes": [{ "id": "note-1", "color": "yellow", "text": m("stickies") }] } }),
            )],
            shows: vec![("/api/stickies/data", m("stickies"))],
            reads: vec![("/api/stickies/data", r#""data":null"#)],
            deletes: vec![],
        },
        Probe {
            module: "stocks",
            writes: vec![
                put(
                    "/api/stocks/watchlist",
                    json!({ "symbols": [m("stocks")], "rev": 0 }),
                ),
                put(
                    "/api/stocks/alerts",
                    json!({ "alerts": [{ "id": "alert-1", "symbol": m("stockalert"), "above": 1.0,
                        "created": 1 }], "rev": 0 }),
                ),
            ],
            shows: vec![
                ("/api/stocks/watchlist", m("stocks")),
                ("/api/stocks/alerts", m("stockalert")),
            ],
            reads: vec![
                ("/api/stocks/watchlist", r#""symbols":null"#),
                ("/api/stocks/alerts", r#""alerts":null"#),
            ],
            deletes: vec!["/api/stocks/watchlist".into(), "/api/stocks/alerts".into()],
        },
        Probe {
            module: "system-preferences",
            writes: vec![put(
                "/api/system-preferences/settings",
                json!({ "values": { "general.note": m("systempreferences"), "dock.size": 0.4 },
                    "theme": { "appearance": "dark", "accent": "pink", "highlight": null }, "rev": 0 }),
            )],
            shows: vec![("/api/system-preferences/settings", m("systempreferences"))],
            reads: vec![("/api/system-preferences/settings", r#""values":null"#)],
            deletes: vec!["/api/system-preferences/settings".into()],
        },
        Probe {
            module: "textedit",
            writes: vec![
                put(
                    "/api/textedit/draft",
                    json!({ "draft": { "name": "Letter", "format": "rich", "lines": [m("texteditdraft")],
                        "html": format!("<div>{}</div>", m("texteditdraft")),
                        "ruler": { "first": 0.0, "head": 0.0, "tail": 0.0, "tabStops": [72.0] },
                        "edited": true }, "rev": 0 }),
                ),
                put(
                    "/api/textedit/files",
                    json!({ "files": [{ "place": "documents", "folders": [],
                        "file": { "id": "saved-documents/Notes", "name": "Notes", "kind": "document",
                            "detail": "Plain Text Document",
                            "document": { "name": "Notes", "format": "plain", "lines": [m("texteditfiles")] } } }],
                        "rev": 0 }),
                ),
            ],
            shows: vec![
                ("/api/textedit/draft", m("texteditdraft")),
                ("/api/textedit/files", m("texteditfiles")),
            ],
            reads: vec![
                ("/api/textedit/draft", r#""draft":null"#),
                ("/api/textedit/files", r#""files":null"#),
            ],
            deletes: vec!["/api/textedit/draft".into(), "/api/textedit/files".into()],
        },
        Probe {
            module: "tv",
            writes: vec![put(
                "/api/tv/library",
                json!({ "library": {
                    "videos": [{ "id": video, "title": m("tv"), "channel": "Blender" }],
                    "history": [{ "id": video, "at": 1 }], "upNext": [video],
                    "watchLater": [video], "positions": { (video): 30 }
                }, "rev": 0 }),
            )],
            shows: vec![("/api/tv/library", m("tv"))],
            reads: vec![("/api/tv/library", r#""library":null"#)],
            deletes: vec!["/api/tv/library".into()],
        },
        Probe {
            module: "voice-memos",
            writes: vec![put(
                "/api/voice-memos/preferences",
                json!({ "preferences": { "audioQuality": audio_quality, "clearDeleted": "week" }, "rev": 0 }),
            )],
            shows: vec![(
                "/api/voice-memos/preferences",
                format!(r#""audioQuality":"{audio_quality}""#),
            )],
            reads: vec![("/api/voice-memos/preferences", r#""preferences":null"#)],
            deletes: vec!["/api/voice-memos/preferences".into()],
        },
    ]
}

/// The `GET` routes of modules that keep no per-person data, and the
/// desktop's own, with the status each must answer (`None`: any, for a route
/// that needs egress the harness refuses).
fn shared_reads() -> Vec<(&'static str, Option<u16>)> {
    vec![
        ("/api/session", Some(200)),
        ("/api/apps", Some(200)),
        ("/api/about-this-mac/facts", Some(200)),
        ("/api/activity-monitor/requests", Some(200)),
        ("/api/chess/me", Some(200)),
        ("/api/chess/games/lobby", Some(200)),
        ("/api/console/log", Some(200)),
        ("/api/help-viewer/books", Some(200)),
        ("/api/help-viewer/search?q=markera", Some(200)),
        ("/api/messages/me", Some(200)),
        ("/api/messages/rooms/lobby", Some(200)),
        ("/api/network-utility/lookup?host=example.com", None),
        ("/api/safari/sites", Some(200)),
        ("/api/safari/history?q=markera", Some(200)),
        ("/api/siri/status", Some(200)),
        ("/api/weather/places?q=Oslo", None),
        ("/api/spotlight/search?q=markera", Some(200)),
        ("/api/storage-management/usage", Some(200)),
        ("/api/system-information/report", Some(200)),
    ]
}

/// Every key under `apps/` in the `data` store, with its value and version.
async fn scan_apps(env: &TestEnv) -> BTreeMap<String, (Vec<u8>, u64)> {
    let mut store = env.store("data");
    let mut out = BTreeMap::new();
    let mut after: Option<Vec<u8>> = None;
    loop {
        let (rows, more) = store
            .scan_prefix(b"apps/", after.as_deref(), 4096)
            .await
            .expect("scan the data store");
        let empty = rows.is_empty();
        for (key, value, version) in rows {
            out.insert(String::from_utf8_lossy(&key).into_owned(), (value, version));
            after = Some(key);
        }
        if !more || empty {
            return out;
        }
    }
}

/// `(module, principal)` of a key in a person's space,
/// `apps/<module>/users/<principal>/...`.
fn owner(key: &str) -> Option<(&str, &str)> {
    let rest = key.strip_prefix("apps/")?;
    let (module, rest) = rest.split_once('/')?;
    let (principal, _) = rest.strip_prefix("users/")?.split_once('/')?;
    Some((module, principal))
}

fn hex(text: &str) -> bool {
    text.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
}

/// An account id: `u-` and 32 hex digits.
fn is_account(principal: &str) -> bool {
    principal.len() == 34 && principal.starts_with("u-") && hex(&principal[2..])
}

/// A browser session id: 64 hex digits.
fn is_session(principal: &str) -> bool {
    principal.len() == 64 && hex(principal)
}

/// The keys of `principal`'s space in every module.
fn keys_of(
    snapshot: &BTreeMap<String, (Vec<u8>, u64)>,
    principal: &str,
) -> BTreeMap<String, (Vec<u8>, u64)> {
    snapshot
        .iter()
        .filter(|(key, _)| owner(key).is_some_and(|(_, p)| p == principal))
        .map(|(key, value)| (key.clone(), value.clone()))
        .collect()
}

fn principals(snapshot: &BTreeMap<String, (Vec<u8>, u64)>) -> BTreeSet<String> {
    snapshot
        .keys()
        .filter_map(|key| owner(key).map(|(_, p)| p.to_string()))
        .collect()
}

/// Network Utility's and Dictionary's histories for `principal`, written as
/// `document.rs` stores them, since no lookup reaches a source here.
async fn seed_lookups(env: &TestEnv, principal: &str, who: &str) {
    let key = format!("apps/network-utility/users/{principal}/history");
    let value = json!({ "rev": 1, "doc": [{ "host": format!("{}.example", mark(who, "networkutility")), "at": 1, "answers": 2 }] });
    env.store("data")
        .put(key.as_bytes(), value.to_string().as_bytes())
        .await
        .expect("seed the lookup history");
    let key = format!("apps/dictionary/users/{principal}/history");
    let value = json!({ "rev": 1, "doc": [{ "word": mark(who, "dictionary"), "at": 1 }] });
    env.store("data")
        .put(key.as_bytes(), value.to_string().as_bytes())
        .await
        .expect("seed the dictionary history");
}

/// Panic naming `what` when `body` holds any of `forbidden`.
fn assert_clean(what: &str, body: &str, forbidden: &[String]) {
    for needle in forbidden {
        assert!(
            !body.contains(needle.as_str()),
            "LEAK: {what} shows {needle:?} of another account: {body}"
        );
    }
}

/// What `who` saved, as each module shows it.
fn shows_of(probes: &[Probe]) -> Vec<String> {
    probes
        .iter()
        .flat_map(|p| p.shows.iter().map(|(_, s)| s.clone()))
        .collect()
}

/// `browser` reads every module and the desktop's own routes and sees none of
/// `forbidden`, its own documents empty and its own storage at zero keys.
async fn sees_nothing(env: &TestEnv, browser: &mut Browser, who: &str, forbidden: &[String]) {
    for probe in probes("B") {
        for (path, empty) in &probe.reads {
            let reply = browser.get(env, path).await;
            let body = text(&reply);
            assert_eq!(
                reply.status, 200,
                "{who}: {}: GET {path}: {body}",
                probe.module
            );
            assert_clean(
                &format!("{who}: {}: GET {path}", probe.module),
                &body,
                forbidden,
            );
            assert!(
                body.contains(empty),
                "{who}: {}: GET {path} should read as never saved ({empty}): {body}",
                probe.module
            );
        }
    }
    for (path, status) in shared_reads() {
        let reply = browser.get(env, path).await;
        let body = text(&reply);
        if let Some(status) = status {
            assert_eq!(reply.status, status, "{who}: GET {path}: {body}");
        }
        assert_clean(&format!("{who}: GET {path}"), &body, forbidden);
    }
    // Spotlight searches every word anywhere in an item: one search for
    // "markera" finds every marker of A's, and each is searched on its own.
    for needle in forbidden.iter().filter(|n| n.starts_with("marker")) {
        let reply = browser
            .get(env, &format!("/api/spotlight/search?q={needle}"))
            .await;
        assert_eq!(
            reply.status,
            200,
            "{who}: spotlight {needle}: {}",
            text(&reply)
        );
        assert_eq!(
            json_of(&reply)["results"],
            json!([]),
            "LEAK: {who}: Spotlight finds {needle} of another account"
        );
    }
    let found = json_of(&browser.get(env, "/api/spotlight/search?q=markera").await);
    assert_eq!(
        found["results"],
        json!([]),
        "LEAK: {who}: Spotlight finds A's items: {found}"
    );
    let usage = json_of(&browser.get(env, "/api/storage-management/usage").await);
    assert_eq!(
        usage["keys"], 0,
        "{who}: Storage Management counts another's keys: {usage}"
    );
    let facts = json_of(&browser.get(env, "/api/about-this-mac/facts").await);
    assert_eq!(
        facts["storage"]["keys"], 0,
        "{who}: About This Mac counts another's keys: {facts}"
    );
    let report = json_of(&browser.get(env, "/api/system-information/report").await);
    assert_eq!(
        report["facts"]["storage"]["keys"], 0,
        "{who}: System Information counts another's keys: {report}"
    );
    let photo = format!("/api/photo-booth/photos/{}", mark("A", "photobooth"));
    let reply = browser.get(env, &photo).await;
    assert_eq!(
        reply.status, 404,
        "LEAK: {who}: GET {photo} answered {}",
        reply.status
    );
    let cover = music_cover_path("A");
    let reply = browser.get(env, &cover).await;
    assert_eq!(
        reply.status, 404,
        "LEAK: {who}: GET {cover} answered {}",
        reply.status
    );
}

/// `browser` (A, signed in) reads back everything A saved and nothing of B's.
async fn reads_own(env: &TestEnv, browser: &mut Browser, when: &str, forbidden: &[String]) {
    for probe in probes("A") {
        for (path, shown) in &probe.shows {
            let reply = browser.get(env, path).await;
            let body = text(&reply);
            assert_eq!(
                reply.status, 200,
                "{when}: {}: GET {path}: {body}",
                probe.module
            );
            assert!(
                body.contains(shown.as_str()),
                "{when}: {}: A no longer reads its own {shown:?} at {path}: {body}",
                probe.module
            );
            assert_clean(
                &format!("{when}: {}: A's GET {path}", probe.module),
                &body,
                forbidden,
            );
        }
    }
    let photo = format!("/api/photo-booth/photos/{}", mark("A", "photobooth"));
    let image = browser.get(env, &photo).await;
    assert_eq!(image.status, 200, "{when}: A's photo");
    assert_eq!(
        image.body,
        jpeg(2_000, 0xA),
        "{when}: A's photo bytes changed"
    );
    let cover = browser.get(env, &music_cover_path("A")).await;
    assert_eq!(cover.status, 200, "{when}: A's Music cover");
    assert_eq!(
        cover.body,
        music_cover("A"),
        "{when}: A's Music cover bytes changed"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn one_account_never_reads_or_changes_anothers_data() {
    let env = boot().await;
    // 1. Two people, two browsers.
    let mut a = sign_up(&env, "alice", "Alice", PASSWORD_A).await;
    let mut b = sign_up(&env, "bob", "Bob", PASSWORD_B).await;
    let (of_a, of_b) = (probes("A"), probes("B"));

    // 2. A saves something in every module.
    for probe in &of_a {
        for write in &probe.writes {
            let reply = a
                .send(
                    &env,
                    write.method,
                    &write.path,
                    Some(write.content_type),
                    &write.body,
                )
                .await;
            assert!(
                (200..300).contains(&reply.status),
                "{}: A's {} {} answered {}: {}",
                probe.module,
                write.method,
                write.path,
                reply.status,
                text(&reply)
            );
        }
    }

    // 3. Every key A wrote is under one account principal, none under a
    //    browser session.
    let snapshot = scan_apps(&env).await;
    let owners = principals(&snapshot);
    assert_eq!(owners.len(), 1, "only A has written; spaces: {owners:?}");
    let principal_a = owners.into_iter().next().unwrap();
    assert!(
        is_account(&principal_a),
        "A's writes landed under {principal_a:?}, not an account id"
    );
    for key in snapshot.keys() {
        if let Some((module, principal)) = owner(key) {
            assert!(
                !is_session(principal),
                "{module}: {key} is under a browser session"
            );
        }
    }
    for probe in of_a.iter().filter(|p| !p.writes.is_empty()) {
        let prefix = format!("apps/{}/users/{principal_a}/", stores_under(probe.module));
        assert!(
            snapshot.keys().any(|k| k.starts_with(&prefix)),
            "{}: A's write left no key under {prefix}",
            probe.module
        );
    }
    seed_lookups(&env, &principal_a, "A").await;
    reads_own(&env, &mut a, "after A's writes", &[]).await;
    // Spotlight finds A's own items, so finding none for B means something.
    let found = json_of(&a.get(&env, "/api/spotlight/search?q=markera").await);
    let kinds: BTreeSet<&str> = found["results"]
        .as_array()
        .expect("results")
        .iter()
        .filter_map(|r| r["kind"].as_str())
        .collect();
    for kind in [
        "contacts",
        "events",
        "reminders",
        "notes",
        "stickies",
        "documents",
    ] {
        assert!(
            kinds.contains(kind),
            "A's Spotlight misses its own {kind}: {found}"
        );
    }
    let before = keys_of(&scan_apps(&env).await, &principal_a);

    // 4. B reads everything and sees none of it.
    let mut forbidden = shows_of(&of_a);
    forbidden.push(principal_a.clone());
    sees_nothing(&env, &mut b, "B", &forbidden).await;

    // 5. B saves and forgets in every module; A's keys do not move.
    for probe in &of_b {
        for write in &probe.writes {
            let reply = b
                .send(
                    &env,
                    write.method,
                    &write.path,
                    Some(write.content_type),
                    &write.body,
                )
                .await;
            assert!(
                (200..300).contains(&reply.status),
                "{}: B's {} {} answered {} (a 409 would mean B saw A's revision): {}",
                probe.module,
                write.method,
                write.path,
                reply.status,
                text(&reply)
            );
            assert_clean(
                &format!("{}: B's {} {}", probe.module, write.method, write.path),
                &text(&reply),
                &forbidden,
            );
        }
    }
    for probe in &of_b {
        for path in &probe.deletes {
            let reply = b
                .send(&env, "DELETE", path, Some("application/json"), b"{}")
                .await;
            assert!(
                (200..300).contains(&reply.status) || reply.status == 404,
                "{}: B's DELETE {path} answered {}: {}",
                probe.module,
                reply.status,
                text(&reply)
            );
            assert_clean(
                &format!("{}: B's DELETE {path}", probe.module),
                &text(&reply),
                &forbidden,
            );
        }
    }
    let after = scan_apps(&env).await;
    let unchanged = keys_of(&after, &principal_a);
    for (key, value) in &before {
        assert_eq!(
            unchanged.get(key),
            Some(value),
            "B changed or removed A's key {key}"
        );
    }
    for key in unchanged.keys() {
        assert!(
            before.contains_key(key),
            "a key appeared in A's space: {key}"
        );
    }
    let owners = principals(&after);
    let principal_b: Vec<&String> = owners.iter().filter(|p| *p != &principal_a).collect();
    assert_eq!(
        principal_b.len(),
        1,
        "B's writes landed in one space: {owners:?}"
    );
    assert!(
        is_account(principal_b[0]),
        "B's writes landed under {:?}",
        principal_b[0]
    );
    let mut of_b_shown = shows_of(&of_b);
    of_b_shown.push(principal_b[0].clone());
    reads_own(&env, &mut a, "after B's writes", &of_b_shown).await;

    // 6. A browser that never signed in sees nothing of A's.
    let mut anonymous = Browser::new();
    sees_nothing(&env, &mut anonymous, "an anonymous browser", &forbidden).await;

    // After A signs out, neither the browser nor its old cookie reaches A's data.
    let mut old_cookie = a.clone();
    let out = a
        .json(&env, "POST", "/api/session/sign-out", &json!({}))
        .await;
    assert_eq!(out.status, 200, "sign-out: {}", text(&out));
    assert_ne!(a.token, old_cookie.token, "sign-out replaces the cookie");
    let session = json_of(&a.get(&env, "/api/session").await);
    assert_eq!(session["account"], Value::Null, "signed out: {session}");
    sees_nothing(&env, &mut a, "A's browser after sign-out", &forbidden).await;
    // The replaced cookie is refused outright: every module read answers 409
    // "session ended", sets no new cookie and shows nothing of A's.
    let stale = old_cookie.token.clone();
    for probe in probes("B") {
        for (path, _) in &probe.reads {
            let reply = old_cookie.get(&env, path).await;
            let body = text(&reply);
            assert_eq!(
                reply.status, 409,
                "A's old cookie: {}: GET {path}: {body}",
                probe.module
            );
            assert!(
                body.contains("session_ended"),
                "A's old cookie: {}: GET {path}: {body}",
                probe.module
            );
            assert_clean(
                &format!("A's old cookie: {}: GET {path}", probe.module),
                &body,
                &forbidden,
            );
            assert_eq!(
                old_cookie.token, stale,
                "A's old cookie: {}: GET {path} must not issue a cookie",
                probe.module
            );
        }
    }
    for (path, _) in shared_reads() {
        let reply = old_cookie.get(&env, path).await;
        assert_clean(
            &format!("A's old cookie: GET {path}"),
            &text(&reply),
            &forbidden,
        );
    }

    // Signing in again brings everything back, unchanged.
    let back = a
        .json(
            &env,
            "POST",
            "/api/session/sign-in",
            &json!({ "name": "alice", "password": PASSWORD_A }),
        )
        .await;
    assert_eq!(back.status, 200, "sign-in: {}", text(&back));
    reads_own(&env, &mut a, "after signing in again", &of_b_shown).await;
    assert_eq!(
        keys_of(&scan_apps(&env).await, &principal_a),
        before,
        "A's keys changed while A was signed out"
    );
}

/// Find My lists a person's own browsers only, those of every browser signed
/// in to the account, and nobody else's: another account naming a device's
/// real id can neither see it, ask it to play a sound, nor forget it.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn find_my_devices_are_their_owners() {
    let env = boot().await;
    let mut a = sign_up(&env, "alice", "Alice", PASSWORD_A).await;
    let mut b = sign_up(&env, "bob", "Bob", PASSWORD_B).await;
    let report = |label: &str| json!({ "lat": 51.5, "lon": -0.12, "accuracy_m": 20.0, "label": label, "reported_at": 1 });
    let mine = a
        .json(&env, "PUT", "/api/find-my/me", &report("markerAfindmy"))
        .await;
    assert_eq!(mine.status, 200, "{}", text(&mine));
    let id = json_of(&mine)["device"]["id"]
        .as_str()
        .expect("a device id")
        .to_string();
    let theirs = b
        .json(&env, "PUT", "/api/find-my/me", &report("markerBfindmy"))
        .await;
    assert_eq!(theirs.status, 200, "{}", text(&theirs));
    assert_ne!(json_of(&theirs)["device"]["id"], id.as_str());

    // B names A's device by its real id.
    let sound = format!("/api/find-my/devices/{id}/sound");
    let asked = b.json(&env, "POST", &sound, &json!({})).await;
    assert_eq!(
        asked.status,
        404,
        "LEAK: B asked A's device: {}",
        text(&asked)
    );
    for path in [
        format!("{sound}?request=0000000000000000"),
        format!("/api/find-my/devices/{id}"),
    ] {
        let reply = b.send(&env, "DELETE", &path, None, b"").await;
        assert_eq!(reply.status, 200, "DELETE {path}: {}", text(&reply));
    }
    let seen_by_b = text(&b.get(&env, "/api/find-my/devices").await);
    assert_clean(
        "B: GET /api/find-my/devices",
        &seen_by_b,
        &["markerAfindmy".into(), id.clone()],
    );
    assert!(seen_by_b.contains("markerBfindmy"), "{seen_by_b}");

    // A's device is as it was, and a second browser signed in to A's account
    // lists both of A's browsers, never B's.
    let mut a2 = Browser::new();
    let signed_in = a2
        .json(
            &env,
            "POST",
            "/api/session/sign-in",
            &json!({ "name": "alice", "password": PASSWORD_A }),
        )
        .await;
    assert_eq!(signed_in.status, 200, "sign-in: {}", text(&signed_in));
    let second = a2
        .json(&env, "PUT", "/api/find-my/me", &report("markerA2findmy"))
        .await;
    assert_eq!(second.status, 200, "{}", text(&second));
    let listed = json_of(&a.get(&env, "/api/find-my/devices").await);
    let devices = listed["devices"].as_array().expect("devices");
    assert_eq!(devices.len(), 2, "{listed}");
    assert_eq!(
        devices[0]["id"],
        id.as_str(),
        "this browser first: {listed}"
    );
    assert_eq!(devices[0]["sound_pending"], false, "{listed}");
    assert_clean(
        "A: GET /api/find-my/devices",
        &listed.to_string(),
        &["markerBfindmy".into()],
    );
    assert!(listed.to_string().contains("markerA2findmy"), "{listed}");
}

/// A browser stays one Find My device through the session rotations of a
/// sign-out and a sign-in: its device id does not change, so signing in again
/// does not list the same browser twice.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn find_my_keeps_one_device_per_browser_across_sign_ins() {
    let env = boot().await;
    let mut a = sign_up(&env, "alice", "Alice", PASSWORD_A).await;
    let report = |reported_at: u64| {
        json!({ "lat": 1.0, "lon": 2.0, "accuracy_m": 5.0, "label": "Firefox on Linux",
            "reported_at": reported_at })
    };
    let device_of = |reply: &IngressReply| {
        assert_eq!(reply.status, 200, "{}", text(reply));
        json_of(reply)["device"]["id"]
            .as_str()
            .expect("a device id")
            .to_string()
    };
    let first = device_of(&a.json(&env, "PUT", "/api/find-my/me", &report(1)).await);
    let token = a.token.clone();
    let out = a
        .json(&env, "POST", "/api/session/sign-out", &json!({}))
        .await;
    assert_eq!(out.status, 200, "sign-out: {}", text(&out));
    assert_ne!(a.token, token, "signing out rotates the session");
    let signed_out = device_of(&a.json(&env, "PUT", "/api/find-my/me", &report(2)).await);
    assert_eq!(signed_out, first, "the same browser, signed out");
    let back = a
        .json(
            &env,
            "POST",
            "/api/session/sign-in",
            &json!({ "name": "alice", "password": PASSWORD_A }),
        )
        .await;
    assert_eq!(back.status, 200, "sign-in: {}", text(&back));
    let again = device_of(&a.json(&env, "PUT", "/api/find-my/me", &report(3)).await);
    assert_eq!(again, first, "the same browser, signed in again");
    let listed = json_of(&a.get(&env, "/api/find-my/devices").await);
    assert_eq!(
        listed["devices"].as_array().map(Vec::len),
        Some(1),
        "one browser is one device: {listed}"
    );
}

/// Every module in `MODULES` is probed above or listed in [`NOT_PERSONAL`],
/// never both, and each list names only registered modules.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn every_module_is_probed_or_named_as_keeping_nothing_personal() {
    let env = boot().await;
    let mut browser = Browser::new();
    let reply = browser.get(&env, "/api/apps").await;
    assert_eq!(reply.status, 200, "{}", text(&reply));
    let registered: BTreeSet<String> = json_of(&reply)["apps"]
        .as_array()
        .expect("apps")
        .iter()
        .map(|app| app["name"].as_str().expect("a name").to_string())
        .collect();
    let probed: BTreeSet<String> = probes("A").iter().map(|p| p.module.to_string()).collect();
    let shared: BTreeSet<String> = NOT_PERSONAL.iter().map(|(m, _)| m.to_string()).collect();
    for module in &registered {
        assert!(
            probed.contains(module) || shared.contains(module),
            "{module} is registered but neither probed in probes() nor listed in NOT_PERSONAL"
        );
        assert!(
            !(probed.contains(module) && shared.contains(module)),
            "{module} is both probed and listed in NOT_PERSONAL"
        );
    }
    for module in probed.union(&shared) {
        assert!(
            registered.contains(module),
            "{module} is listed here but not registered"
        );
    }
    // B's reads reach every registered module.
    let mut read: BTreeSet<String> = BTreeSet::new();
    for probe in probes("B") {
        for (path, _) in &probe.reads {
            read.insert(path.split('/').nth(2).unwrap().to_string());
        }
    }
    for (path, _) in shared_reads() {
        read.insert(
            path.split('/')
                .nth(2)
                .unwrap()
                .split('?')
                .next()
                .unwrap()
                .to_string(),
        );
    }
    for module in &registered {
        assert!(
            read.contains(module),
            "no GET of {module} is read by the isolation test"
        );
    }
}

/// A game between two accounts belongs to those two: a third account, an
/// anonymous browser and the open feed reach none of it, by any route, and
/// its answers and moves are refused to them without saying who plays.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_game_between_two_accounts_reaches_no_third() {
    let env = boot().await;
    let mut a = sign_up(&env, "alice", "Alice Markera", PASSWORD_A).await;
    let mut b = sign_up(&env, "bob", "Bob", PASSWORD_B).await;
    let mut c = sign_up(&env, "carol", "Carol", PASSWORD_B).await;
    let reply = a
        .json(
            &env,
            "POST",
            "/api/chess/invitations",
            &json!({ "to": "bob", "side": "white" }),
        )
        .await;
    assert_eq!(reply.status, 201, "{}", text(&reply));
    let game = json_of(&reply)["id"].as_str().unwrap().to_string();
    let reply = b
        .json(
            &env,
            "POST",
            &format!("/api/chess/games/{game}/accept"),
            &json!({}),
        )
        .await;
    assert_eq!(reply.status, 200, "{}", text(&reply));
    let reply = a
        .json(
            &env,
            "POST",
            &format!("/api/chess/games/{game}/plies"),
            &json!({ "number": 1, "ply": 0, "from": "e2", "to": "e4" }),
        )
        .await;
    assert_eq!(reply.status, 201, "{}", text(&reply));
    let before = scan_apps(&env).await;
    let forbidden = vec!["Markera".to_string(), game.clone()];

    let mut anonymous = Browser::new();
    for (who, browser) in [("C", &mut c), ("an anonymous browser", &mut anonymous)] {
        let reply = browser.get(&env, &format!("/api/chess/games/{game}")).await;
        assert_eq!(
            reply.status,
            404,
            "LEAK: {who} reads the game: {}",
            text(&reply)
        );
        assert_clean(
            &format!("{who}: GET the game"),
            &text(&reply),
            &forbidden[..1],
        );
        let mine = browser.get(&env, "/api/chess/mine").await;
        assert_clean(&format!("{who}: GET /mine"), &text(&mine), &forbidden);
        for (action, body) in [
            (
                "plies",
                json!({ "number": 1, "ply": 1, "from": "e7", "to": "e5" }),
            ),
            ("accept", json!({})),
            ("decline", json!({})),
            ("resign", json!({})),
            ("new", json!({ "number": 1 })),
            ("reset", json!({})),
        ] {
            let reply = browser
                .json(
                    &env,
                    "POST",
                    &format!("/api/chess/games/{game}/{action}"),
                    &body,
                )
                .await;
            assert_eq!(
                reply.status,
                404,
                "LEAK: {who}'s {action} reached the game: {}",
                text(&reply)
            );
            assert_clean(&format!("{who}: {action}"), &text(&reply), &forbidden[..1]);
        }
    }
    let after = scan_apps(&env).await;
    let shared = |snapshot: &BTreeMap<String, (Vec<u8>, u64)>| {
        snapshot
            .get(&format!("apps/chess/shared/games/{game}"))
            .cloned()
    };
    assert_eq!(shared(&after), shared(&before), "the game changed");
    for (key, value) in &before {
        if owner(key).is_some() {
            assert_eq!(after.get(key), Some(value), "{key} changed");
        }
    }
}

/// A FaceTime call between two accounts belongs to those two: a third
/// account and an anonymous browser can neither read it, answer it, hang it
/// up nor signal in it, and its descriptions and page tokens reach nobody
/// but the member whose seat they belong to.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_call_between_two_accounts_reaches_no_third() {
    let env = boot().await;
    let mut a = sign_up(&env, "alice", "Alice Markera", PASSWORD_A).await;
    let mut b = sign_up(&env, "bob", "Bob", PASSWORD_B).await;
    let mut c = sign_up(&env, "carol", "Carol", PASSWORD_B).await;
    let page_a = "page-alice-secret-01";
    let reply = a
        .json(
            &env,
            "POST",
            "/api/facetime/calls",
            &json!({ "to": "bob", "kind": "video", "page": page_a }),
        )
        .await;
    assert_eq!(reply.status, 201, "{}", text(&reply));
    let call = json_of(&reply)["state"]["id"].as_str().unwrap().to_string();
    let reply = b
        .json(
            &env,
            "POST",
            &format!("/api/facetime/calls/{call}/join"),
            &json!({ "page": "page-bob-secret-0001" }),
        )
        .await;
    assert_eq!(reply.status, 200, "{}", text(&reply));
    let reply = b
        .json(
            &env,
            "POST",
            &format!("/api/facetime/calls/{call}/signal"),
            &json!({ "from": 2, "to": 1, "offer": "v=0 markeraoffer", "revision": 1 }),
        )
        .await;
    assert_eq!(reply.status, 200, "{}", text(&reply));
    // Bob sees Alice's seat but not her page token.
    let seen = text(&b.get(&env, &format!("/api/facetime/calls/{call}")).await);
    assert!(
        !seen.contains(page_a),
        "LEAK: Bob sees Alice's page token: {seen}"
    );
    let before = scan_apps(&env).await;
    let forbidden = vec![
        "Markera".to_string(),
        "markeraoffer".to_string(),
        call.clone(),
        page_a.to_string(),
    ];

    let mut anonymous = Browser::new();
    for (who, browser) in [("C", &mut c), ("an anonymous browser", &mut anonymous)] {
        let reply = browser
            .get(&env, &format!("/api/facetime/calls/{call}"))
            .await;
        assert!(
            matches!(reply.status, 403 | 404),
            "LEAK: {who} reads the call: {}",
            text(&reply)
        );
        assert_clean(
            &format!("{who}: GET the call"),
            &text(&reply),
            &forbidden[..2],
        );
        let calls = browser.get(&env, "/api/facetime/calls").await;
        assert_clean(&format!("{who}: GET /calls"), &text(&calls), &forbidden);
        for (action, body) in [
            ("join", json!({ "page": "page-intruder-00001" })),
            ("decline", json!({})),
            ("leave", json!({ "seat": 1 })),
            ("leave", json!({ "seat": 2 })),
            (
                "signal",
                json!({ "from": 1, "to": 2, "answer": "x", "generation": 1 }),
            ),
        ] {
            let reply = browser
                .json(
                    &env,
                    "POST",
                    &format!("/api/facetime/calls/{call}/{action}"),
                    &body,
                )
                .await;
            assert!(
                matches!(reply.status, 403 | 404),
                "LEAK: {who}'s {action} reached the call: {}",
                text(&reply)
            );
            assert_clean(&format!("{who}: {action}"), &text(&reply), &forbidden[..2]);
        }
        let reply = browser
            .send(
                &env,
                "DELETE",
                &format!("/api/facetime/calls/{call}"),
                None,
                b"",
            )
            .await;
        assert_clean(&format!("{who}: DELETE"), &text(&reply), &forbidden);
    }
    let after = scan_apps(&env).await;
    let key = format!("apps/facetime/shared/calls/{call}");
    assert_eq!(after.get(&key), before.get(&key), "the call changed");
    for (key, value) in &before {
        if owner(key).is_some() {
            assert_eq!(after.get(key), Some(value), "{key} changed");
        }
    }
}

/// A Calendar invitation reaches the organizer and the people it invites and
/// nobody else: a third account reads no trace of it, cannot answer it with
/// the invitee's id for it, and the invitee's own saves and forgetting change
/// nothing of the organizer's.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_calendar_invitation_reaches_only_its_organizer_and_invitees() {
    let env = boot().await;
    let mut a = sign_up(&env, "alice", "Alice", PASSWORD_A).await;
    let mut b = sign_up(&env, "bob", "Bob", PASSWORD_B).await;
    let mut c = sign_up(&env, "carol", "Carol", "a third password here").await;
    let title = mark("A", "invitation");
    let notes = mark("A", "invitationnotes");
    let saved = a
        .json(
            &env,
            "PUT",
            "/api/calendar/events",
            &json!({ "events": [{ "id": "party", "title": title, "notes": notes,
                "start": 1_570_118_400_000_i64, "end": 1_570_122_000_000_i64,
                "calendar": "home", "invitees": ["bob"] }], "rev": 0 }),
        )
        .await;
    assert_eq!(saved.status, 200, "{}", text(&saved));

    // Bob sees it, with no account id; Carol sees nothing of it anywhere.
    let inbox = json_of(&b.get(&env, "/api/calendar/inbox").await);
    assert_eq!(
        inbox["invitations"][0]["event"]["title"],
        title.as_str(),
        "{inbox}"
    );
    assert!(
        !inbox.to_string().contains("\"u-"),
        "LEAK: an account id in {inbox}"
    );
    let id = inbox["invitations"][0]["id"]
        .as_str()
        .expect("id")
        .to_string();
    let version = inbox["invitations"][0]["version"]
        .as_u64()
        .expect("version");
    let forbidden = vec![title.clone(), notes.clone()];
    for path in [
        "/api/calendar/inbox",
        "/api/calendar/sent",
        "/api/calendar/events",
        "/api/notification-center/inbox",
        "/api/spotlight/search?q=markera",
    ] {
        let reply = c.get(&env, path).await;
        assert_clean(&format!("Carol: GET {path}"), &text(&reply), &forbidden);
    }
    for answer in ["accept", "decline"] {
        let path = format!("/api/calendar/inbox/{id}/{version}/{answer}");
        let reply = c.json(&env, "POST", &path, &json!({})).await;
        assert_eq!(
            reply.status,
            404,
            "LEAK: Carol answered Bob's invitation: {}",
            text(&reply)
        );
        let anonymous = Browser::new().json(&env, "POST", &path, &json!({})).await;
        assert_eq!(
            anonymous.status,
            404,
            "an anonymous browser answered: {}",
            text(&anonymous)
        );
    }
    let sent = json_of(&a.get(&env, "/api/calendar/sent").await);
    assert_eq!(sent["events"]["party"][0]["status"], "pending", "{sent}");

    // Carol's own saves and forgetting, and Bob's, leave Alice's invitation as it was.
    for browser in [&mut c, &mut b] {
        let put = browser
            .json(
                &env,
                "PUT",
                "/api/calendar/events",
                &json!({ "events": [], "rev": 0 }),
            )
            .await;
        assert_eq!(put.status, 200, "{}", text(&put));
        let forgot = browser
            .send(
                &env,
                "DELETE",
                "/api/calendar/events",
                Some("application/json"),
                b"{}",
            )
            .await;
        assert_eq!(forgot.status, 200, "{}", text(&forgot));
    }
    let still = json_of(&b.get(&env, "/api/calendar/inbox").await);
    assert_eq!(
        still["invitations"][0]["event"]["notes"],
        notes.as_str(),
        "{still}"
    );
    assert_eq!(json_of(&a.get(&env, "/api/calendar/sent").await), sent);

    // Bob's answer reaches Alice; Carol's inbox stays empty throughout.
    let accepted = b
        .json(
            &env,
            "POST",
            &format!("/api/calendar/inbox/{id}/{version}/accept"),
            &json!({}),
        )
        .await;
    assert_eq!(accepted.status, 200, "{}", text(&accepted));
    let sent = json_of(&a.get(&env, "/api/calendar/sent").await);
    assert_eq!(sent["events"]["party"][0]["status"], "accepted", "{sent}");
    assert_eq!(
        json_of(&c.get(&env, "/api/calendar/inbox").await)["invitations"],
        json!([])
    );

    // Signed out, Bob's browser reads no invitation.
    let out = b
        .json(&env, "POST", "/api/session/sign-out", &json!({}))
        .await;
    assert_eq!(out.status, 200, "sign-out: {}", text(&out));
    let after = b.get(&env, "/api/calendar/inbox").await;
    assert_clean(
        "Bob signed out: GET /api/calendar/inbox",
        &text(&after),
        &forbidden,
    );
}

/// A shared Reminders list reaches the people on it and nobody else: a third
/// account reads no trace of it and can neither change it, leave it, nor add
/// itself; once taken off, a member reads nothing more of it.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_shared_reminders_list_reaches_only_the_people_on_it() {
    let env = boot().await;
    let mut a = sign_up(&env, "alice", "Alice", PASSWORD_A).await;
    let mut b = sign_up(&env, "bob", "Bob", PASSWORD_B).await;
    let mut c = sign_up(&env, "carol", "Carol", "a third password here").await;
    let list = mark("A", "sharedlist");
    let item = mark("A", "sharedreminder");
    let saved = a
        .json(
            &env,
            "PUT",
            "/api/reminders/data",
            &json!({ "base": 0, "data": {
                "lists": [{ "id": "trip", "name": list, "color": "red" }],
                "reminders": [{ "id": "r1", "listId": "trip", "title": item }]
            }, "alerts": {} }),
        )
        .await;
    assert_eq!(saved.status, 200, "{}", text(&saved));
    let shared = a
        .json(
            &env,
            "POST",
            "/api/reminders/shared",
            &json!({ "list": "trip", "people": ["bob"] }),
        )
        .await;
    assert_eq!(shared.status, 201, "{}", text(&shared));
    let id = json_of(&shared)["id"].as_str().expect("id").to_string();

    let lists = json_of(&b.get(&env, "/api/reminders/shared").await);
    assert_eq!(
        lists["lists"][0]["reminders"][0]["title"],
        item.as_str(),
        "{lists}"
    );
    assert!(
        !lists.to_string().contains("\"u-"),
        "LEAK: an account id in {lists}"
    );
    let forbidden = vec![list.clone(), item.clone()];
    for path in [
        "/api/reminders/shared",
        "/api/reminders/data",
        "/api/notification-center/inbox",
        "/api/spotlight/search?q=markera",
    ] {
        let reply = c.get(&env, path).await;
        assert_clean(&format!("Carol: GET {path}"), &text(&reply), &forbidden);
    }
    let base = lists["lists"][0]["rev"].as_u64().expect("rev");
    let path = format!("/api/reminders/shared/{id}");
    for (method, route, body) in [
        (
            "PUT",
            path.clone(),
            json!({ "base": base, "data": { "lists": [{ "id": id, "name": "x", "color": "red" }], "reminders": [] } }),
        ),
        ("POST", format!("{path}/people"), json!({ "name": "carol" })),
        ("POST", format!("{path}/leave"), json!({})),
        ("POST", format!("{path}/stop"), json!({})),
    ] {
        let reply = c.json(&env, method, &route, &body).await;
        assert_eq!(
            reply.status,
            404,
            "LEAK: Carol {method} {route}: {}",
            text(&reply)
        );
    }
    assert_eq!(
        json_of(&b.get(&env, "/api/reminders/shared").await)["lists"][0]["reminders"][0]["title"],
        item.as_str(),
        "Carol changed nothing"
    );

    // Bob taken off reads nothing of it any more.
    let off = a
        .send(
            &env,
            "DELETE",
            &format!("{path}/people/bob"),
            Some("application/json"),
            b"{}",
        )
        .await;
    assert_eq!(off.status, 200, "{}", text(&off));
    let after = b.get(&env, "/api/reminders/shared").await;
    assert_clean(
        "Bob taken off: GET /api/reminders/shared",
        &text(&after),
        &forbidden,
    );
    let late = b
        .json(
            &env,
            "PUT",
            &path,
            &json!({ "base": base + 2, "data": { "lists": [{ "id": id, "name": "x", "color": "red" }], "reminders": [] } }),
        )
        .await;
    assert_eq!(
        late.status,
        404,
        "LEAK: Bob wrote after leaving: {}",
        text(&late)
    );
}

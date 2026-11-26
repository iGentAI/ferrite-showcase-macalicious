//! Home Sharing between this desktop's accounts: a person turns it on, and every
//! other account signed in to the desktop can list their songs and play them.
//!
//! * `GET /api/music/sharing`: `{"on": bool}`, the person's own switch. Off until
//!   they turn it on.
//! * `PUT /api/music/sharing` with `{"on": bool}`: sets it; a Guest User or a
//!   browser signed in to no account is refused.
//! * `GET /api/music/sharing/libraries`: `{"libraries": [{"name", "full_name"}]}`,
//!   those sharing now, the person themself left out.
//! * `GET /api/music/sharing/libraries/<name>`: their songs and playlists
//!   ([`lent_song`], [`lent_playlists`]), or 403.
//! * `GET /api/music/sharing/libraries/<name>/songs/<song>?piece=&count=`: pieces
//!   of a drive song, answered as the drive answers its owner, or 403.
//!
//! Whether a library is lent is one key in its owner's own space ([`SWITCH`]), read
//! on the server by every one of these reads, and nothing else lends it: deleting
//! that key ends the lending for the next read, and deleting an account's data
//! ends it too. The list in the shared space ([`SHARERS`]) only says whose switch
//! to read, so a stale entry shows nobody.
//!
//! A listener reaches nothing but this: the fields named here, and the bytes of the
//! file a song of the owner's library names. A request names a song, never a file.
//! Every route here but the person's own switch only reads. The drive's route runs
//! its bounded sweep of deleted pieces for its owner, as it does on any read.

use std::io;

use ferrite_app::{serde, serde_json};
use serde_json::{json, Value};

use super::{Library, Playlist, Song, Source, LIBRARY, MODULE};
use crate::accounts;
use crate::apps::{document, files};
use crate::http::Response;
use crate::module::{ApiCtx, Request, Storage};
use crate::session::Account;

/// The owner's switch: present while their library is lent.
const SWITCH: &str = "sharing";
/// Whose switch to read, by account id, in the shared space.
const SHARERS: &str = "sharers/";
/// The most people the list names.
const MAX_SHARERS: usize = 64;
const NOT_SHARED: &str = "That library is not shared.";

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
struct SwitchBody {
    on: bool,
}

/// The account of a person who may share and listen: a Guest User has no
/// password, so a guest of the desktop reaches nobody's songs.
fn member<'a>(cx: &ApiCtx<'a>) -> Option<&'a Account> {
    cx.session.account.as_ref().filter(|account| !account.guest)
}

/// Answers everything under `/sharing`.
pub(super) async fn route(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let path = cx.request.path;
    let parts: Vec<&str> = path.split('/').filter(|part| !part.is_empty()).collect();
    match (cx.request.method, parts.as_slice()) {
        ("GET", ["sharing"]) => {
            let on = cx.storage.user().get(SWITCH).await?.is_some();
            Ok(Response::json(200, &json!({ "on": on })))
        }
        ("PUT", ["sharing"]) => put_switch(cx).await,
        ("GET", ["sharing", "libraries"]) => libraries(cx).await,
        ("GET", ["sharing", "libraries", name]) => {
            let Some(owner) = lender(cx, name).await? else {
                return Ok(refused());
            };
            let library = library_of(cx, &owner).await?;
            Ok(unkept(Response::json(
                200,
                &json!({
                    "name": owner.name,
                    "full_name": owner.full_name,
                    "songs": library.songs.iter().map(lent_song).collect::<Vec<_>>(),
                    "playlists": lent_playlists(&library),
                }),
            )))
        }
        ("GET", ["sharing", "libraries", name, "songs", song]) => read_song(cx, name, song).await,
        (
            _,
            ["sharing"]
            | ["sharing", "libraries"]
            | ["sharing", "libraries", _]
            | ["sharing", "libraries", _, "songs", _],
        ) => Ok(Response::method_not_allowed()),
        _ => Ok(Response::not_found()),
    }
}

fn refused() -> Response {
    Response::error(403, NOT_SHARED)
}

/// A browser asks again each time: what it may read can end at any moment.
fn unkept(response: Response) -> Response {
    response.add_header("cache-control", "no-store")
}

/// Turning on writes the list first and turning off deletes the switch first, so a
/// request that stops part way leaves nothing lent that the person turned off, and
/// repeating either finishes it.
async fn put_switch(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let Some(account) = member(cx) else {
        return Ok(Response::error(
            403,
            "Only an account of this desktop can share its library.",
        ));
    };
    let body: SwitchBody = match cx.request.json() {
        Ok(body) => body,
        Err(response) => return Ok(response),
    };
    let entry = format!("{SHARERS}{}", account.id);
    if body.on {
        let name = serde_json::to_vec(&account.name).map_err(io::Error::other)?;
        cx.storage.shared().put(&entry, &name).await?;
        cx.storage.user().put(SWITCH, b"{}").await?;
    } else {
        cx.storage.user().delete(SWITCH).await?;
        cx.storage.shared().delete(&entry).await?;
    }
    Ok(Response::json(200, &json!({ "on": body.on })))
}

async fn switch_is_on(cx: &mut ApiCtx<'_>, owner: &str) -> io::Result<bool> {
    let mut storage = Storage::new(cx.storage.store(), MODULE.name, owner);
    let on = storage.user().get(SWITCH).await?.is_some();
    Ok(on)
}

/// The account whose library `name` names, when the person asking may read it now.
async fn lender(cx: &mut ApiCtx<'_>, name: &str) -> io::Result<Option<Account>> {
    if member(cx).is_none() {
        return Ok(None);
    }
    let Some(owner) = accounts::lookup(cx.storage.store(), name).await? else {
        return Ok(None);
    };
    Ok(switch_is_on(cx, &owner.id).await?.then_some(owner))
}

async fn libraries(cx: &mut ApiCtx<'_>) -> io::Result<Response> {
    let mut found = Vec::new();
    if let Some(me) = member(cx) {
        let listed = cx.storage.shared().list(SHARERS, MAX_SHARERS).await?;
        for (key, value) in listed {
            let id = key.strip_prefix(SHARERS).unwrap_or_default();
            let Ok(name) = serde_json::from_slice::<String>(&value) else {
                continue;
            };
            if id == me.id {
                continue;
            }
            let Some(owner) = lender(cx, &name).await? else {
                continue;
            };
            if owner.id == id {
                found.push(json!({ "name": owner.name, "full_name": owner.full_name }));
            }
        }
    }
    found.sort_by_key(|person| person["full_name"].as_str().map(str::to_lowercase));
    Ok(unkept(Response::json(200, &json!({ "libraries": found }))))
}

async fn library_of(cx: &mut ApiCtx<'_>, owner: &Account) -> io::Result<Library> {
    let mut storage = Storage::new(cx.storage.store(), MODULE.name, &owner.id);
    let current = document::read::<Library>(&mut storage.user(), LIBRARY).await?;
    Ok(current.doc.unwrap_or_default())
}

/// What a listener sees of a song. The fields are named one by one: plays, stars,
/// Loved, dislikes, comments and where the file is are the owner's, and a field
/// added to [`Song`] stays theirs until it is named here.
pub fn lent_song(song: &Song) -> Value {
    let source = match &song.source {
        Source::File {
            media_type, size, ..
        } => json!({ "kind": "file", "type": media_type, "size": size }),
        Source::Archive {
            item,
            files,
            license,
        } => json!({ "kind": "archive", "item": item, "files": files, "license": license }),
        Source::Stream { url } => json!({ "kind": "stream", "url": url }),
    };
    json!({
        "id": song.id,
        "title": song.title,
        "artist": song.artist,
        "album": song.album,
        "genre": song.genre,
        "composer": song.composer,
        "year": song.year,
        "track": song.track,
        "duration": song.duration,
        "source": source,
    })
}

/// The playlists a listener sees: the hand-made ones not marked private. A smart
/// playlist is left out, as its rules read the plays and Loved a listener does not
/// see.
pub fn lent_playlists(library: &Library) -> Vec<Value> {
    let shown = |list: &&Playlist| !list.private && list.smart.is_none();
    library
        .playlists
        .iter()
        .filter(shown)
        .map(|list| json!({ "id": list.id, "name": list.name, "songs": list.songs }))
        .collect()
}

async fn read_song(cx: &mut ApiCtx<'_>, name: &str, song: &str) -> io::Result<Response> {
    let Some(owner) = lender(cx, name).await? else {
        return Ok(refused());
    };
    let library = library_of(cx, &owner).await?;
    let Some(found) = library.songs.iter().find(|each| each.id == song) else {
        return Ok(Response::error(404, "That song is not in this library."));
    };
    let Source::File { file, .. } = &found.source else {
        return Ok(Response::error(
            409,
            "That song is played from its own address.",
        ));
    };
    let number = |param: &str, default: u32| match cx.request.query_param(param) {
        None => Some(default),
        Some(text) => text.parse::<u32>().ok(),
    };
    let (Some(piece), Some(count)) = (number("piece", 0), number("count", 1)) else {
        return Ok(Response::error(400, "piece and count are numbers"));
    };
    let content = format!("/content/{file}");
    let query = format!("piece={piece}&count={count}");
    let reply = (files::MODULE.handle)(ApiCtx {
        request: Request::internal("GET", &content, &query, &[], None),
        session: cx.session,
        storage: Storage::new(cx.storage.store(), files::MODULE.name, &owner.id),
        ctx: cx.ctx,
        now_ms: cx.now_ms,
    })
    .await;
    Ok(unkept(reply))
}

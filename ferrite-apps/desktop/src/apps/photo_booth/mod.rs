//! Photo Booth's server half: the pictures this browser's session took with
//! its camera.
//!
//! The camera is the browser's (`getUserMedia`): the page takes a frame from
//! it when the countdown ends, encodes it as a JPEG in a canvas, and sends
//! the bytes here. The server stores them as they came and does nothing to
//! them: there is no image processing on the server. An effect is kept as
//! the name of the one the picture was taken with, and the page draws it over
//! the picture, as it draws it over the camera.
//!
//! * `GET /api/photo-booth/photos`: `{"photos": [...], "limits": {...}}`,
//!   each photo `{"id", "effect", "taken_ms", "bytes"}`, oldest first (by the
//!   time the server stored it, then by id).
//! * `PUT /api/photo-booth/photos/<id>?effect=<effect>` with the JPEG as the
//!   body (`content-type: image/jpeg`): stores a new photo and answers 201
//!   with it. The id is the page's own (`crypto.randomUUID()`), so a resend
//!   of the same photo answers 200 with the photo already stored and changes
//!   nothing. A body that is not a JPEG, or is over [`MAX_PHOTO_BYTES`], an
//!   unknown effect or a bad id is refused with 400 or 413; a session that
//!   already keeps [`MAX_PHOTOS`] is answered 409.
//! * `GET /api/photo-booth/photos/<id>`: the JPEG (`image/jpeg`), or 404.
//! * `DELETE /api/photo-booth/photos/<id>`: forgets one photo;
//!   `DELETE /api/photo-booth/photos` forgets every one.
//!
//! The session's photos are one index, `index`, a versioned JSON list of
//! every photo with the key of its bytes, and one key per image. The index
//! is the only record of which photos exist, and every change to it is a
//! compare-and-set on its version, retried on a conflict: the limit of
//! [`MAX_PHOTOS`] holds however many uploads arrive together, and of two
//! deliveries of one id exactly one is listed.
//!
//! An image is written before the index names it, under a key no other
//! write shares unless it holds the same bytes: `image/<id>/<v>-<digest>`,
//! where `v` is the index version the upload read and `digest` the SHA-256
//! of its effect and bytes. So a concurrent delivery of the same id never
//! replaces the bytes of the photo that won, and an image is deleted only
//! after the index stops naming it, under a key a later upload (which reads
//! a newer version) cannot reuse. An upload whose index write lost deletes
//! the image it wrote, unless the winner names that very key.

use ferrite_app::{serde, serde_json};

use super::document;
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture, Space};

pub const MODULE: AppModule = AppModule {
    name: "photo-booth",
    title: "Photo Booth",
    handle,
};

/// The most photos a session keeps.
pub const MAX_PHOTOS: usize = 50;
/// The largest JPEG the module keeps, in bytes: under the gateway's 256 KiB
/// request limit. The page lowers the JPEG quality until a picture fits.
pub const MAX_PHOTO_BYTES: usize = 240_000;
/// The longest photo id, in bytes (a UUID is 36).
const MAX_ID_BYTES: usize = 64;
/// The key of the index of photos.
const INDEX: &str = "index";
/// How many times a change to the index is tried against concurrent ones.
const ATTEMPTS: usize = 16;

/// Every effect of the Effects browser, by id, page by page: the ids of
/// `demos/photo-booth/photo-booth-data.ts`, which
/// `demos/photo-booth/photo-booth-desktop.test.tsx` checks against this list.
pub const EFFECTS: &[&str] = &[
    "bulge",
    "dent",
    "twirl",
    "squeeze",
    "normal",
    "mirror",
    "light-tunnel",
    "fish-eye",
    "stretch",
    "sepia",
    "black-and-white",
    "plastic-camera",
    "comic-book",
    "color-pencil",
    "glow",
    "thermal-camera",
    "x-ray",
    "dusk",
    "frost",
    "ember",
    "fade",
    "ink",
    "negative",
    "tilt",
    "haze",
];

/// What the list shows of one photo.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
pub struct Photo {
    pub id: String,
    pub effect: String,
    pub taken_ms: u64,
    pub bytes: usize,
}

/// A photo as the index keeps it: what the list shows, and the key of its
/// bytes.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde")]
struct Entry {
    #[serde(flatten)]
    photo: Photo,
    image: String,
}

/// The index as read: its entries, oldest first, and the version to write
/// over (`None` while there is none).
struct Index {
    entries: Vec<Entry>,
    version: Option<u64>,
}

async fn read_index(space: &mut Space<'_>) -> std::io::Result<Index> {
    Ok(match space.get_versioned(INDEX).await? {
        Some((bytes, version)) => Index {
            entries: serde_json::from_slice(&bytes).map_err(|error| {
                std::io::Error::new(std::io::ErrorKind::InvalidData, error.to_string())
            })?,
            version: Some(version),
        },
        None => Index {
            entries: Vec::new(),
            version: None,
        },
    })
}

/// Write `entries` over the index read at `version`; `false` when another
/// change came first.
async fn write_index(
    space: &mut Space<'_>,
    entries: &[Entry],
    version: Option<u64>,
) -> std::io::Result<bool> {
    let bytes = serde_json::to_vec(entries).map_err(std::io::Error::other)?;
    space.put_if_version(INDEX, &bytes, version).await
}

fn busy() -> Response {
    Response::error(503, "the photos changed too often to save; try again")
}

/// The key an upload's bytes are written under: its id, the index version it
/// read, and the digest of its effect and bytes.
fn image_key(id: &str, version: Option<u64>, effect: &str, body: &[u8]) -> String {
    let mut hashed = Vec::with_capacity(effect.len() + 1 + body.len());
    hashed.extend_from_slice(effect.as_bytes());
    hashed.push(0);
    hashed.extend_from_slice(body);
    let digest = ferrite_app::crypto::hex(&ferrite_app::crypto::sha256(&hashed));
    format!("image/{id}/{}-{digest}", version.unwrap_or(0))
}

/// The index version an image key was written at.
fn image_version(key: &str) -> Option<u64> {
    let last = key.rsplit('/').next()?;
    last.split('-').next()?.parse().ok()
}

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    let path = cx.request.path;
    let outcome = match (cx.request.method, path) {
        ("GET", "/photos") => list(&mut cx.storage.user()).await.map(|photos| {
            Response::json(
                200,
                &serde_json::json!({
                    "photos": photos,
                    "limits": { "photos": MAX_PHOTOS, "bytes": MAX_PHOTO_BYTES },
                }),
            )
        }),
        ("DELETE", "/photos") => forget_all(&mut cx.storage.user()).await,
        (_, "/photos") => Ok(Response::method_not_allowed()),
        (method, _) => match path.strip_prefix("/photos/") {
            Some(id) if valid_id(id) => match method {
                "GET" => image(&mut cx.storage.user(), id).await,
                "PUT" => store(&mut cx, id).await,
                "DELETE" => forget(&mut cx.storage.user(), id).await,
                _ => Ok(Response::method_not_allowed()),
            },
            Some(_) => Ok(Response::error(
                400,
                "a photo id is 1 to 64 letters, digits, '-', '_' or '.'",
            )),
            None => Ok(Response::not_found()),
        },
    };
    outcome.unwrap_or_else(|error| Response::error(503, &format!("storage failed: {error}")))
}

/// Whether `id` may name a photo.
fn valid_id(id: &str) -> bool {
    id.len() <= MAX_ID_BYTES && document::valid_key(id)
}

/// Whether `bytes` start as a JPEG does (the SOI marker, then a marker).
pub fn is_jpeg(bytes: &[u8]) -> bool {
    bytes.len() > 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF
}

/// Every photo the session keeps, oldest first.
async fn list(space: &mut Space<'_>) -> std::io::Result<Vec<Photo>> {
    Ok(read_index(space)
        .await?
        .entries
        .into_iter()
        .map(|entry| entry.photo)
        .collect())
}

async fn image(space: &mut Space<'_>, id: &str) -> std::io::Result<Response> {
    let index = read_index(space).await?;
    let Some(entry) = index.entries.iter().find(|entry| entry.photo.id == id) else {
        return Ok(Response::not_found());
    };
    Ok(match space.get(&entry.image).await? {
        Some(bytes) => Response::new(200, bytes).add_header("content-type", "image/jpeg"),
        None => Response::not_found(),
    })
}

async fn store(cx: &mut ApiCtx<'_>, id: &str) -> std::io::Result<Response> {
    let effect = cx.request.query_param("effect").unwrap_or("normal");
    if !EFFECTS.contains(&effect) {
        return Ok(Response::error(
            400,
            &format!("{effect:?} is not an effect of Photo Booth"),
        ));
    }
    let body = cx.request.body;
    if body.len() > MAX_PHOTO_BYTES {
        return Ok(Response::error(
            413,
            &format!("a photo has at most {MAX_PHOTO_BYTES} bytes"),
        ));
    }
    if !is_jpeg(body) {
        return Ok(Response::error(400, "the body is not a JPEG picture"));
    }
    let now_ms = cx.now_ms;
    let mut space = cx.storage.user();
    // The image this upload wrote and the index does not (yet) name.
    let mut written: Option<String> = None;
    for _ in 0..ATTEMPTS {
        let index = read_index(&mut space).await?;
        // The same photo sent again (or delivered twice): the one stored.
        if let Some(first) = index.entries.iter().find(|entry| entry.photo.id == id) {
            if let Some(key) = written.take() {
                if key != first.image {
                    space.delete(&key).await?;
                }
            }
            return Ok(Response::json(
                200,
                &serde_json::json!({ "photo": first.photo }),
            ));
        }
        if index.entries.len() >= MAX_PHOTOS {
            if let Some(key) = written.take() {
                space.delete(&key).await?;
            }
            return Ok(Response::error(
                409,
                &format!("Photo Booth keeps at most {MAX_PHOTOS} photos; delete one first"),
            ));
        }
        let key = image_key(id, index.version, effect, body);
        if written.as_deref() != Some(key.as_str()) {
            if let Some(old) = written.take() {
                space.delete(&old).await?;
            }
            space.put(&key, body).await?;
            written = Some(key.clone());
        }
        let entry = Entry {
            photo: Photo {
                id: id.to_string(),
                effect: effect.to_string(),
                taken_ms: now_ms,
                bytes: body.len(),
            },
            image: key,
        };
        let mut entries = index.entries;
        entries.push(entry.clone());
        if write_index(&mut space, &entries, index.version).await? {
            return Ok(Response::json(
                201,
                &serde_json::json!({ "photo": entry.photo }),
            ));
        }
    }
    if let Some(key) = written {
        // An identical delivery that read the same index version shares this
        // key; if it won, the index names the key, which then stays. Once
        // the index has moved past that version, no later write can name it.
        let index = read_index(&mut space).await?;
        if !index.entries.iter().any(|entry| entry.image == key) {
            space.delete(&key).await?;
        }
    }
    Ok(busy())
}

/// Removes the photos `remove` picks from the index, then their bytes: how
/// many went, or `None` when the index kept changing.
async fn remove(
    space: &mut Space<'_>,
    remove: impl Fn(&Entry) -> bool,
) -> std::io::Result<Option<usize>> {
    for _ in 0..ATTEMPTS {
        let index = read_index(space).await?;
        let (gone, kept): (Vec<Entry>, Vec<Entry>) =
            index.entries.into_iter().partition(|entry| remove(entry));
        if gone.is_empty() {
            return Ok(Some(0));
        }
        if write_index(space, &kept, index.version).await? {
            for entry in &gone {
                space.delete(&entry.image).await?;
            }
            return Ok(Some(gone.len()));
        }
    }
    Ok(None)
}

async fn forget(space: &mut Space<'_>, id: &str) -> std::io::Result<Response> {
    Ok(match remove(space, |entry| entry.photo.id == id).await? {
        Some(deleted) => Response::json(200, &serde_json::json!({ "deleted": deleted > 0 })),
        None => busy(),
    })
}

async fn forget_all(space: &mut Space<'_>) -> std::io::Result<Response> {
    let Some(deleted) = remove(space, |_| true).await? else {
        return Ok(busy());
    };
    // Bytes no photo names: an upload that stopped between its two writes.
    // Only those written at an index version older than the one read now go:
    // an upload still running read that version or a newer one, and deletes
    // its own bytes when its index write loses.
    let index = read_index(space).await?;
    let current = index.version.unwrap_or(0);
    let named: std::collections::BTreeSet<String> =
        index.entries.into_iter().map(|entry| entry.image).collect();
    for (key, _) in space.list("image/", MAX_PHOTOS * 8).await? {
        if !named.contains(&key) && image_version(&key).is_some_and(|v| v < current) {
            space.delete(&key).await?;
        }
    }
    Ok(Response::json(
        200,
        &serde_json::json!({ "deleted": deleted }),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_jpeg_is_told_by_its_first_bytes() {
        assert!(is_jpeg(&[0xFF, 0xD8, 0xFF, 0xE0, 0x00]));
        assert!(!is_jpeg(b"\x89PNG\r\n"));
        assert!(!is_jpeg(&[0xFF, 0xD8]));
    }

    #[test]
    fn image_keys_carry_the_index_version_and_differ_by_content() {
        let a = image_key("p", Some(7), "sepia", b"\xff\xd8\xff1");
        assert!(a.starts_with("image/p/7-"));
        assert_eq!(image_version(&a), Some(7));
        assert_eq!(a, image_key("p", Some(7), "sepia", b"\xff\xd8\xff1"));
        assert_ne!(a, image_key("p", Some(7), "sepia", b"\xff\xd8\xff2"));
        assert_ne!(a, image_key("p", Some(7), "x-ray", b"\xff\xd8\xff1"));
        assert_ne!(a, image_key("p", Some(8), "sepia", b"\xff\xd8\xff1"));
        assert_eq!(
            image_version(&image_key("p", None, "normal", b"x")),
            Some(0)
        );
    }

    #[test]
    fn ids_are_short_and_plain() {
        assert!(valid_id("0b9c6f1e-4d1a-4c1b-9a7e-2f1d3c4b5a69"));
        assert!(!valid_id(""));
        assert!(!valid_id("a/b"));
        assert!(!valid_id(&"a".repeat(MAX_ID_BYTES + 1)));
    }

    #[test]
    fn every_effect_is_listed_once() {
        let mut seen = std::collections::BTreeSet::new();
        for effect in EFFECTS {
            assert!(seen.insert(effect), "{effect} twice");
        }
        assert_eq!(EFFECTS.len(), 25);
    }
}

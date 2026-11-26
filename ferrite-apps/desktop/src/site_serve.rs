//! Serving the desktop's page and its files from the `site` blob.
//!
//! The manifest routes `/` to the app's api face, so every path that is not
//! `/api/`, `/health` or `/favicon.ico` arrives here, with the browser's
//! `Accept-Encoding` and `If-None-Match` forwarded. A file is answered from
//! the blob ([`crate::site`] publishes it there at boot), in the best coding
//! the browser accepts among those the build made: brotli, then gzip, then
//! the bytes as they are, by the browser's own `q` values first and that order
//! second, never one it gives `q=0`.
//!
//! Every name but `index.html` (and the publication marker) carries a hash of
//! its bytes, so those files are cached for a year and never asked again;
//! `index.html` must be checked each time (`no-cache`), and costs a 304 when
//! it has not changed. Every reply has an `ETag`: for a hashed name it is the
//! name's hash and the coding, known without reading the file, so a check
//! costs nothing; otherwise it is a hash of the bytes served.
//!
//! The platform caps one api reply at about 4 MiB ([`MAX_REPLY_BYTES`]). A
//! file over that as it is (the page's main script) is sent only in a
//! compressed copy, which the build guarantees fits (`scripts/pack-site.mjs`);
//! a browser that takes neither brotli nor gzip is answered 406, rather than
//! with a reply the platform could not carry.

use std::io;

use ferrite_app::{AppContext, IngressRequest};

use crate::http::{self, Response};
use crate::site::{copy_key, decode_base64, Coding, SiteFile};

/// The most one file may hold: one api reply of about 4 MiB, with room for
/// its envelope. Equal to `MAX_REPLY_BYTES` in `scripts/pack-site.mjs`.
pub const MAX_REPLY_BYTES: usize = 3_670_016;

/// How a file whose name carries a hash of its bytes is cached.
const IMMUTABLE: &str = "public, max-age=31536000, immutable";
/// How the page and the other unhashed names are cached: kept, but checked.
const REVALIDATE: &str = "no-cache";

/// Whether the build makes compressed copies of `path`'s type (the same list
/// as `COMPRESSIBLE` in `scripts/pack-site.mjs`).
pub fn compressible(path: &str) -> bool {
    matches!(
        extension(path),
        "js" | "mjs" | "css" | "html" | "svg" | "json" | "wasm" | "map" | "txt"
    )
}

fn extension(path: &str) -> &str {
    let name = path.rsplit('/').next().unwrap_or(path);
    name.rsplit_once('.').map_or("", |(_, ext)| ext)
}

/// The `Content-Type` of `path`, by its extension.
pub fn content_type(path: &str) -> &'static str {
    match extension(path) {
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" | "map" => "application/json",
        "svg" => "image/svg+xml",
        "txt" => "text/plain; charset=utf-8",
        "wasm" => "application/wasm",
        "webp" => "image/webp",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "ico" => "image/x-icon",
        "avif" => "image/avif",
        "woff2" => "font/woff2",
        "woff" => "font/woff",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        "mp3" => "audio/mpeg",
        "m4a" => "audio/mp4",
        "ogg" => "audio/ogg",
        "wav" => "audio/wav",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "pdf" => "application/pdf",
        "gz" => "application/gzip",
        _ => "application/octet-stream",
    }
}

/// The 8-character content hash in a built file's name
/// (`<name>-<hash>.<ext>`), which every file but `index.html` carries.
pub fn name_hash(path: &str) -> Option<&str> {
    let name = path.rsplit('/').next()?;
    let (stem, _) = name.rsplit_once('.')?;
    // The hash may itself begin with `-`: the last eight characters, after a `-`.
    let at = stem.len().checked_sub(8)?;
    let hash = stem.get(at..)?;
    (at > 0
        && stem.as_bytes()[at - 1] == b'-'
        && hash
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-'))
    .then_some(hash)
}

/// The `q` value `accept` (an `Accept-Encoding` value) gives `coding`: its
/// own entry, else `*`'s, else 0, except that `identity`, which a browser
/// need not list, stays acceptable below every coding it does list. Without
/// the header only `identity` is taken.
pub fn quality(accept: Option<&str>, coding: Coding) -> f32 {
    let Some(accept) = accept else {
        return if coding == Coding::Identity { 1.0 } else { 0.0 };
    };
    let mut wildcard = None;
    for item in accept.split(',') {
        let mut parts = item.split(';');
        let name = parts.next().unwrap_or("").trim().to_ascii_lowercase();
        let q = parts
            .filter_map(|param| {
                let (key, value) = param.split_once('=')?;
                key.trim()
                    .eq_ignore_ascii_case("q")
                    .then(|| value.trim().parse::<f32>().ok())
                    .flatten()
            })
            .next()
            .unwrap_or(1.0)
            .clamp(0.0, 1.0);
        let named = match coding {
            Coding::Identity => name == "identity",
            Coding::Brotli => name == "br",
            Coding::Gzip => name == "gzip" || name == "x-gzip",
        };
        if named {
            return q;
        }
        if name == "*" {
            wildcard = Some(q);
        }
    }
    match (wildcard, coding) {
        (Some(q), _) => q,
        (None, Coding::Identity) => UNLISTED_IDENTITY,
        (None, _) => 0.0,
    }
}

/// The `q` of an `identity` that `Accept-Encoding` does not mention.
const UNLISTED_IDENTITY: f32 = 0.0001;

/// The coding to answer with among `available`, for a browser that sent
/// `accept`: the highest `q` above 0, brotli before gzip before identity
/// when they tie. `None` when it takes none of them.
pub fn negotiate(accept: Option<&str>, available: &[Coding]) -> Option<Coding> {
    let mut best: Option<(Coding, f32)> = None;
    for coding in [Coding::Brotli, Coding::Gzip, Coding::Identity] {
        if !available.contains(&coding) {
            continue;
        }
        let q = quality(accept, coding);
        if q > 0.0 && best.is_none_or(|(_, top)| q > top) {
            best = Some((coding, q));
        }
    }
    best.map(|(coding, _)| coding)
}

/// The `ETag` of `path`'s bytes `body` in `coding`: from the name's hash
/// when it has one, else from the bytes.
pub fn etag(path: &str, coding: Coding, body: Option<&[u8]>) -> Option<String> {
    let tag = match name_hash(path) {
        Some(hash) => hash.to_string(),
        None => crate::crypto::hex_encode(&crate::crypto::sha256(body?)[..12]),
    };
    Some(match coding {
        Coding::Identity => format!("\"{tag}\""),
        other => format!("\"{tag}.{}\"", other.token()),
    })
}

/// Whether `if_none_match` (an `If-None-Match` value) names `etag` or `*`.
pub fn matches(if_none_match: Option<&str>, etag: &str) -> bool {
    if_none_match.is_some_and(|value| {
        value.split(',').any(|candidate| {
            let candidate = candidate.trim();
            candidate == "*" || candidate.strip_prefix("W/").unwrap_or(candidate) == etag
        })
    })
}

/// The blob key a request path names: `index.html` for `/`, the path without
/// its leading `/` otherwise. `None` for a path no built file can have: one
/// outside the characters the build allows, with an empty or dot segment,
/// naming a compressed copy rather than a file, or, other than `index.html`
/// and the publication marker, without the content hash every built name has.
pub fn site_path(path: &str) -> Option<&str> {
    let rel = path.strip_prefix('/')?;
    if rel.is_empty() {
        return Some("index.html");
    }
    let safe = rel
        .bytes()
        .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'-' | b'/'));
    let segments_ok = rel
        .split('/')
        .all(|segment| !segment.is_empty() && segment != "." && segment != "..");
    let copy = rel.ends_with(".br") || rel.strip_suffix(".gz").is_some_and(compressible);
    let named = rel == "index.html" || rel == crate::site::MARKER || name_hash(rel).is_some();
    (safe && segments_ok && !copy && named).then_some(rel)
}

/// This build's own file at `path`, if it has one.
fn own_file(path: &str) -> Option<&'static SiteFile> {
    let files = crate::site_bundle().files;
    files
        .binary_search_by(|file| file.path.cmp(path))
        .ok()
        .map(|at| &files[at])
}

/// Answer a request for a path of the site.
pub async fn respond(ctx: &AppContext, req: &IngressRequest, path: &str) -> Response {
    let head = match req.method.as_str() {
        "GET" => false,
        "HEAD" => true,
        _ => return Response::method_not_allowed(),
    };
    let Some(path) = site_path(path) else {
        return Response::not_found();
    };
    let accept = http::header(req, "accept-encoding");
    let if_none_match = http::header(req, "if-none-match");
    let own = own_file(path);
    // The codings to try, best first. This build knows which copies its own
    // files have; for another build's file (a rolling deploy serves both) a
    // compressible type may have either, and a missing one is skipped.
    let available: Vec<Coding> = match own {
        Some(file) => [Coding::Brotli, Coding::Gzip, Coding::Identity]
            .into_iter()
            .filter(|coding| {
                file.encoded(*coding)
                    .is_some_and(|encoded| decoded_len(encoded) <= MAX_REPLY_BYTES)
            })
            .collect(),
        None if compressible(path) => vec![Coding::Brotli, Coding::Gzip, Coding::Identity],
        None => vec![Coding::Identity],
    };
    let mut candidates = Vec::new();
    let mut left = available.clone();
    while let Some(coding) = negotiate(accept, &left) {
        candidates.push(coding);
        left.retain(|c| *c != coding);
    }
    if candidates.is_empty() {
        return Response::error(406, "no coding the request accepts")
            .add_header("vary", "accept-encoding");
    }

    // A hashed name's ETag needs no read: a browser that holds the coding
    // it would be given is told so at once.
    if let Some(tag) = name_hash(path).and_then(|_| etag(path, candidates[0], None)) {
        if matches(if_none_match, &tag) && own.is_some() {
            return not_modified(path, &tag);
        }
    }

    let mut blob = match ctx.blob(crate::SITE_BINDING) {
        Ok(blob) => blob,
        Err(error) => return unavailable(error),
    };
    let mut too_large = false;
    for coding in candidates {
        let body = match read(&mut blob, own, path, coding).await {
            Ok(Some(body)) => body,
            Ok(None) => continue,
            Err(error) => return unavailable(error),
        };
        let Some(tag) = etag(path, coding, Some(&body)) else {
            continue;
        };
        if matches(if_none_match, &tag) {
            return not_modified(path, &tag);
        }
        if body.len() > MAX_REPLY_BYTES {
            too_large = true;
            continue;
        }
        let mut response = Response::new(200, if head { Vec::new() } else { body })
            .add_header("content-type", content_type(path))
            .add_header("x-content-type-options", "nosniff");
        response = with_caching(response, path, &tag);
        if coding != Coding::Identity {
            response = response.add_header("content-encoding", coding.token());
        }
        return response;
    }
    if too_large {
        return Response::error(406, "this file is sent only compressed, in br or gzip")
            .add_header("vary", "accept-encoding");
    }
    Response::not_found()
}

/// The length of the bytes a padded base64 text decodes to.
fn decoded_len(base64: &str) -> usize {
    let padding = base64.bytes().rev().take_while(|&b| b == b'=').count();
    (base64.len() / 4 * 3).saturating_sub(padding)
}

/// `path`'s bytes in `coding`: from the blob, or, for this build's own file
/// not yet published there (the first requests while it boots), from the
/// build itself.
async fn read(
    blob: &mut ferrite_app::client::BlobClusterClient,
    own: Option<&'static SiteFile>,
    path: &str,
    coding: Coding,
) -> io::Result<Option<Vec<u8>>> {
    if let Some(body) = blob.get(copy_key(path, coding).as_bytes()).await? {
        return Ok(Some(body));
    }
    match own.and_then(|file| file.encoded(coding)) {
        Some(encoded) => decode_base64(encoded)
            .map(Some)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, format!("{path}: {e}"))),
        None => Ok(None),
    }
}

fn with_caching(response: Response, path: &str, etag: &str) -> Response {
    let cache = if name_hash(path).is_some() {
        IMMUTABLE
    } else {
        REVALIDATE
    };
    let response = response
        .add_header("cache-control", cache)
        .add_header("etag", etag);
    if compressible(path) {
        response.add_header("vary", "accept-encoding")
    } else {
        response
    }
}

fn not_modified(path: &str, etag: &str) -> Response {
    with_caching(Response::new(304, Vec::new()), path, etag)
}

fn unavailable(error: io::Error) -> Response {
    ferrite_app::tracing::warn!(%error, "the site could not be read");
    Response::error(503, "the site is unavailable; retry").add_header("retry-after", "1")
}

#[cfg(test)]
mod tests {
    use super::*;

    const ALL: [Coding; 3] = [Coding::Brotli, Coding::Gzip, Coding::Identity];

    #[test]
    fn brotli_then_gzip_then_identity_when_the_browser_takes_them_all() {
        assert_eq!(
            negotiate(Some("gzip, deflate, br, zstd"), &ALL),
            Some(Coding::Brotli)
        );
        assert_eq!(negotiate(Some("gzip, deflate"), &ALL), Some(Coding::Gzip));
        assert_eq!(negotiate(Some("deflate"), &ALL), Some(Coding::Identity));
        assert_eq!(negotiate(None, &ALL), Some(Coding::Identity));
        assert_eq!(negotiate(Some(""), &ALL), Some(Coding::Identity));
        assert_eq!(
            negotiate(Some("br"), &[Coding::Gzip, Coding::Identity]),
            Some(Coding::Identity),
            "a copy the build did not make is not offered"
        );
    }

    #[test]
    fn q_values_are_honoured_and_zero_refuses() {
        assert_eq!(negotiate(Some("br;q=0, gzip"), &ALL), Some(Coding::Gzip));
        assert_eq!(
            negotiate(Some("br;q=0.5, gzip;q=0.8"), &ALL),
            Some(Coding::Gzip)
        );
        assert_eq!(
            negotiate(Some("BR; Q=1.0, GZIP"), &ALL),
            Some(Coding::Brotli)
        );
        assert_eq!(
            negotiate(Some("br;q=0, gzip;q=0"), &ALL),
            Some(Coding::Identity)
        );
        assert_eq!(negotiate(Some("*"), &ALL), Some(Coding::Brotli));
        assert_eq!(negotiate(Some("*;q=0, gzip"), &ALL), Some(Coding::Gzip));
        assert_eq!(negotiate(Some("identity;q=0"), &[Coding::Identity]), None);
        assert_eq!(negotiate(Some("*;q=0"), &[Coding::Identity]), None);
        assert_eq!(
            negotiate(Some("*;q=0, identity"), &[Coding::Identity]),
            Some(Coding::Identity)
        );
        assert_eq!(negotiate(Some("x-gzip"), &ALL), Some(Coding::Gzip));
    }

    #[test]
    fn hashed_names_are_immutable_and_their_etags_need_no_read() {
        assert_eq!(name_hash("assets/index-c7be48ae.js"), Some("c7be48ae"));
        assert_eq!(name_hash("assets/network-4-DGJyqwD3.gz"), Some("DGJyqwD3"));
        assert_eq!(
            name_hash("assets/text-spelling-words--NpA83St.js"),
            Some("-NpA83St")
        );
        assert_eq!(name_hash("index.html"), None);
        assert_eq!(name_hash("ferrite-site.json"), None);
        assert_eq!(
            etag("assets/a-12345678.js", Coding::Brotli, None).as_deref(),
            Some("\"12345678.br\"")
        );
        assert_eq!(
            etag("assets/a-12345678.js", Coding::Identity, None).as_deref(),
            Some("\"12345678\"")
        );
        assert_eq!(etag("index.html", Coding::Identity, None), None);
        let page = etag("index.html", Coding::Gzip, Some(b"<html>")).unwrap();
        assert!(page.starts_with('"') && page.ends_with(".gzip\""), "{page}");
        assert_ne!(
            Some(page),
            etag("index.html", Coding::Gzip, Some(b"<html> "))
        );
    }

    #[test]
    fn if_none_match_names_one_tag_among_several() {
        assert!(matches(Some("\"a\", \"b.br\""), "\"b.br\""));
        assert!(matches(Some("W/\"b.br\""), "\"b.br\""));
        assert!(matches(Some("*"), "\"x\""));
        assert!(!matches(Some("\"b\""), "\"b.br\""));
        assert!(!matches(None, "\"b\""));
    }

    #[test]
    fn only_paths_a_build_can_have_name_a_file() {
        assert_eq!(site_path("/"), Some("index.html"));
        assert_eq!(site_path("/index.html"), Some("index.html"));
        assert_eq!(
            site_path("/assets/a-12345678.js"),
            Some("assets/a-12345678.js")
        );
        assert_eq!(
            site_path("/assets/network-0-DGJyqwD3.gz"),
            Some("assets/network-0-DGJyqwD3.gz")
        );
        assert_eq!(site_path("/ferrite-site.json"), Some("ferrite-site.json"));
        for refused in [
            "/assets/a-12345678.js.br",
            "/assets/a-12345678.js.gz",
            "/assets/../index.html",
            "/assets//a.js",
            "/assets/",
            "/a%20b.js",
            "assets/a.js",
            "/assets/a.js",
            "/favicon.ico/x",
        ] {
            assert_eq!(site_path(refused), None, "{refused}");
        }
    }

    #[test]
    fn types_follow_the_extension() {
        assert_eq!(content_type("index.html"), "text/html; charset=utf-8");
        assert_eq!(
            content_type("assets/a-12345678.js"),
            "text/javascript; charset=utf-8"
        );
        assert_eq!(content_type("assets/a-12345678.wasm"), "application/wasm");
        assert_eq!(
            content_type("assets/network-0-12345678.gz"),
            "application/gzip"
        );
        assert_eq!(
            content_type("assets/model-0-12345678.tflite"),
            "application/octet-stream"
        );
        assert!(compressible("assets/a-12345678.css"));
        assert!(!compressible("assets/a-12345678.webp"));
    }

    #[test]
    fn the_decoded_length_is_known_without_decoding() {
        for (text, len) in [
            ("", 0),
            ("Zg==", 1),
            ("Zm8=", 2),
            ("Zm9v", 3),
            ("Zm9vYmFy", 6),
        ] {
            assert_eq!(decoded_len(text), len, "{text}");
        }
        for file in crate::site_bundle().files.iter().take(20) {
            assert_eq!(
                decoded_len(file.base64),
                decode_base64(file.base64).unwrap().len(),
                "{}",
                file.path
            );
        }
    }

    #[test]
    fn this_builds_files_are_found_by_path() {
        let files = crate::site_bundle().files;
        assert!(
            files.windows(2).all(|pair| pair[0].path < pair[1].path),
            "the build lists its files in order"
        );
        for file in files {
            assert_eq!(own_file(file.path).map(|f| f.path), Some(file.path));
        }
        assert!(own_file("assets/none-00000000.js").is_none());
    }
}

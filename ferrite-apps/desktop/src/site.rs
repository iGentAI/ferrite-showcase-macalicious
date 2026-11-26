//! Publishing the desktop's built files into the `site` blob.
//!
//! `scripts/pack-site.mjs` turns the Vite build of `docs/desktop` into
//! `site_assets.rs`: one base64 literal per file, with its brotli and gzip
//! copies where the build made them, and a build id. At boot [`seed`] decodes
//! each file and writes it to the blob under its relative path, and its
//! copies under `<path>.br` and `<path>.gz` ([`copy_key`]); the app serves
//! them from there (`site_serve.rs`).
//!
//! Builds share the blob safely because only one path is shared between
//! them: every file except `index.html` has a content hash in its name
//! (`pack-site.mjs` refuses a build where one does not), so two builds write
//! different keys, or the same bytes under the same key. Publication is:
//!
//! 1. delete the marker [`MARKER`], so an interrupted publication is never
//!    trusted by a later boot;
//! 2. write the assets;
//! 3. write `index.html`, the activation step, which only ever references
//!    assets its own process has already written;
//! 4. write the marker.
//!
//! A boot skips publication only when the marker names its build and the
//! live `index.html` is byte-for-byte its own page, which costs two reads.
//! When processes of two builds run at once (a rolling deploy), the page
//! served is always one complete build: whichever activated last. A process
//! of the older build that boots after the newer one has published will
//! activate the older build again until a newer process boots; this app has
//! no notion of which build is newer.

use std::io;

use ferrite_app::{serde_json, AppContext};

/// The blob key of the publication marker; served at `/ferrite-site.json`.
pub const MARKER: &str = "ferrite-site.json";

/// One built file: its path relative to the build root, base64-encoded bytes,
/// and the base64 of its brotli and gzip copies when the build made them (a
/// file of a compressible type whose copy saves at least a tenth).
pub struct SiteFile {
    pub path: &'static str,
    pub base64: &'static str,
    pub br: Option<&'static str>,
    pub gzip: Option<&'static str>,
}

/// A content coding of a site file's bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Coding {
    Identity,
    Brotli,
    Gzip,
}

impl Coding {
    /// The name `Accept-Encoding` and `Content-Encoding` use.
    pub fn token(self) -> &'static str {
        match self {
            Coding::Identity => "identity",
            Coding::Brotli => "br",
            Coding::Gzip => "gzip",
        }
    }
}

/// The blob key of `path`'s bytes in `coding`: the path itself, or the path
/// with `.br` or `.gz` after it for a compressed copy.
pub fn copy_key(path: &str, coding: Coding) -> String {
    match coding {
        Coding::Identity => path.to_string(),
        Coding::Brotli => format!("{path}.br"),
        Coding::Gzip => format!("{path}.gz"),
    }
}

impl SiteFile {
    /// The base64 of this file in `coding`, when the build has it.
    pub fn encoded(&self, coding: Coding) -> Option<&'static str> {
        match coding {
            Coding::Identity => Some(self.base64),
            Coding::Brotli => self.br,
            Coding::Gzip => self.gzip,
        }
    }
}

/// A packed build of the desktop page.
pub struct SiteBundle {
    /// `sha256:` and the hex digest of every path and its bytes.
    pub build_id: &'static str,
    pub files: &'static [SiteFile],
}

/// What [`seed`] did.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Seeded {
    /// The blob already held this build.
    AlreadyCurrent,
    /// This many files (and bytes) were written.
    Published { files: usize, bytes: usize },
}

/// Publish `bundle` into the `site` blob unless it is already there.
pub async fn seed(ctx: &AppContext, bundle: &SiteBundle) -> io::Result<Seeded> {
    let mut blob = ctx.blob(crate::SITE_BINDING)?;
    let decode = |file: &SiteFile| {
        decode_base64(file.base64)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, format!("{}: {e}", file.path)))
    };
    let (index, assets): (Vec<&SiteFile>, Vec<&SiteFile>) =
        bundle.files.iter().partition(|f| f.path == "index.html");
    let index = match index.as_slice() {
        [one] => *one,
        _ => {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "the bundle needs one index.html",
            ))
        }
    };
    let index_bytes = decode(index)?;

    // Current only when the marker names this build AND the live page is
    // this build's page: another build's process may have activated its own
    // page after this build's marker was written.
    if let Some(bytes) = blob.get(MARKER.as_bytes()).await? {
        let current = serde_json::from_slice::<serde_json::Value>(&bytes).ok();
        if current.as_ref().and_then(|v| v["build_id"].as_str()) == Some(bundle.build_id)
            && blob.get(b"index.html").await?.as_deref() == Some(index_bytes.as_slice())
        {
            return Ok(Seeded::AlreadyCurrent);
        }
    }
    // No marker while publishing: an interrupted publication leaves none, so
    // the next boot of any build publishes again instead of trusting it.
    blob.delete(MARKER.as_bytes()).await?;
    let mut bytes = index_bytes.len();
    // The compressed copies of every file, the page's too, go first: a copy
    // is only ever looked for once its file is there.
    for file in bundle.files {
        for coding in [Coding::Brotli, Coding::Gzip] {
            if let Some(encoded) = file.encoded(coding) {
                let decoded = decode_base64(encoded).map_err(|e| {
                    io::Error::new(io::ErrorKind::InvalidData, format!("{}: {e}", file.path))
                })?;
                bytes += decoded.len();
                blob.put(copy_key(file.path, coding).as_bytes(), &decoded)
                    .await?;
            }
        }
    }
    for file in &assets {
        let decoded = decode(file)?;
        bytes += decoded.len();
        blob.put(file.path.as_bytes(), &decoded).await?;
    }
    // Activation: the page that references the assets just written.
    blob.put(b"index.html", &index_bytes).await?;
    let marker = serde_json::json!({
        "build_id": bundle.build_id,
        "files": bundle.files.len(),
        "bytes": bytes,
    });
    blob.put(MARKER.as_bytes(), marker.to_string().as_bytes())
        .await?;
    Ok(Seeded::Published {
        files: bundle.files.len(),
        bytes,
    })
}

/// [`seed`], retried with backoff until it succeeds: the planes may not be
/// reachable the instant the process starts. Returns what the successful
/// attempt did.
pub async fn seed_with_retry(ctx: &AppContext, bundle: &SiteBundle) -> Seeded {
    let mut delay_ms = 250;
    loop {
        match seed(ctx, bundle).await {
            Ok(outcome) => {
                ferrite_app::tracing::info!(build = bundle.build_id, ?outcome, "site published");
                return outcome;
            }
            Err(error) => {
                ferrite_app::tracing::warn!(%error, delay_ms, "site publication failed; retrying");
                ferrite_app::sleep_ms(delay_ms).await;
                delay_ms = (delay_ms * 2).min(30_000);
            }
        }
    }
}

/// Decode standard base64 (RFC 4648 section 4, `=` padding required, and the
/// unused bits before padding zero, so every input has one decoding).
/// Upstream Core's SDK exports no base64 codec, so the app carries its own.
pub fn decode_base64(text: &str) -> Result<Vec<u8>, String> {
    fn value(c: u8) -> Option<u32> {
        Some(match c {
            b'A'..=b'Z' => c - b'A',
            b'a'..=b'z' => c - b'a' + 26,
            b'0'..=b'9' => c - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            _ => return None,
        } as u32)
    }
    let input = text.as_bytes();
    if input.len() % 4 != 0 {
        return Err(format!("length {} is not a multiple of 4", input.len()));
    }
    let mut out = Vec::with_capacity(input.len() / 4 * 3);
    let quads = input.len() / 4;
    for (i, quad) in input.chunks_exact(4).enumerate() {
        let pad = quad.iter().rev().take_while(|&&c| c == b'=').count();
        if pad > 2 || (pad > 0 && i + 1 != quads) {
            return Err(format!("misplaced padding in group {i}"));
        }
        let mut n = 0u32;
        for &c in &quad[..4 - pad] {
            n = (n << 6) | value(c).ok_or_else(|| format!("invalid character {:?}", c as char))?;
        }
        // The bits the last character carries beyond the decoded bytes:
        // four with `==`, two with `=`. A canonical encoding leaves them zero.
        if n & ((1u32 << (2 * pad as u32)) - 1) != 0 {
            return Err(format!("nonzero padding bits in group {i}"));
        }
        n <<= 6 * pad as u32;
        let bytes = [(n >> 16) as u8, (n >> 8) as u8, n as u8];
        out.extend_from_slice(&bytes[..3 - pad]);
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base64_decodes_the_rfc_4648_test_vectors() {
        for (encoded, plain) in [
            ("", ""),
            ("Zg==", "f"),
            ("Zm8=", "fo"),
            ("Zm9v", "foo"),
            ("Zm9vYg==", "foob"),
            ("Zm9vYmE=", "fooba"),
            ("Zm9vYmFy", "foobar"),
        ] {
            assert_eq!(
                decode_base64(encoded).unwrap(),
                plain.as_bytes(),
                "{encoded}"
            );
        }
        assert_eq!(decode_base64("//79").unwrap(), [0xff, 0xfe, 0xfd]);
    }

    #[test]
    fn malformed_base64_is_refused() {
        assert!(decode_base64("Zm9").is_err(), "truncated");
        assert!(decode_base64("Zg==Zm9v").is_err(), "padding before the end");
        assert!(decode_base64("Z===").is_err(), "three padding characters");
        assert!(decode_base64("Zm9-").is_err(), "the URL-safe alphabet");
        assert!(decode_base64("Zh==").is_err(), "nonzero bits before ==");
        assert!(decode_base64("Zm9=").is_err(), "nonzero bits before =");
    }

    #[test]
    fn the_packed_build_has_a_page_and_decodable_files() {
        let bundle = crate::site_bundle();
        assert!(bundle.build_id.starts_with("sha256:") && bundle.build_id.len() == 71);
        assert!(bundle.files.iter().any(|f| f.path == "index.html"));
        for file in bundle.files {
            assert!(
                !file.path.starts_with('/') && !file.path.contains(".."),
                "{}",
                file.path
            );
            assert!(decode_base64(file.base64).is_ok(), "{}", file.path);
        }
    }

    #[test]
    fn every_packed_file_fits_one_reply_and_its_copies_are_smaller() {
        for file in crate::site_bundle().files {
            let identity = decode_base64(file.base64).unwrap();
            // A file over one reply as it is goes out only as its gzip copy (and
            // brotli where the browser takes it), which must fit.
            let sendable = identity.len() <= crate::site_serve::MAX_REPLY_BYTES
                || file.gzip.is_some_and(|gzip| {
                    decode_base64(gzip).unwrap().len() <= crate::site_serve::MAX_REPLY_BYTES
                });
            assert!(sendable, "{} is {} bytes", file.path, identity.len());
            for coding in [Coding::Brotli, Coding::Gzip] {
                if let Some(encoded) = file.encoded(coding) {
                    assert!(
                        crate::site_serve::compressible(file.path),
                        "{} has a {} copy",
                        file.path,
                        coding.token()
                    );
                    let copy = decode_base64(encoded).unwrap();
                    assert!(
                        copy.len() <= crate::site_serve::MAX_REPLY_BYTES,
                        "{}",
                        file.path
                    );
                    assert!(
                        copy.len() * 10 <= identity.len() * 9,
                        "{}'s {} copy saves less than a tenth",
                        file.path,
                        coding.token()
                    );
                }
            }
        }
    }
}

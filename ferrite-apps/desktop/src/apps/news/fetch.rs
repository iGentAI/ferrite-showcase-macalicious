//! Outside requests for News, Podcasts and Books: one GET through a declared
//! egress handle, read as a stream with a byte limit and a time budget.
//!
//! Why a stream: a buffered egress call (`deliver_http`) refuses a response
//! body over 1 MiB, and many podcast feeds and books are larger. The streamed
//! call (`get_stream`, in upstream Core's surface) relays the body in pieces;
//! this helper keeps the first `limit` bytes and then drops the stream, which
//! stops the upstream transfer. A feed's newest items come first, so the head
//! of a large feed is what Podcasts needs.
//!
//! Why a budget: the gateway answers an API request 504 after 8 seconds on the
//! hosted platform, and one egress exchange may take 10. The helper stops
//! reading when its budget is spent and says the body was cut, so the module
//! still answers in time with what arrived (the feed reader keeps every item
//! that closed before the cut).
//!
//! Egress follows no redirects and passes no response headers: a `3xx` is
//! answered as such, so every declared address must answer `200` itself.

use std::time::Duration;

use ferrite_app::rt::time::timeout;
use ferrite_app::{AppContext, EgressHeader, EgressStreamOutcome};

/// The User-Agent every outside request carries, naming the app.
pub const USER_AGENT: &str =
    "Macalicious-Desktop/1.0 (Ferrite demo; +https://macalicious.ferrite.run/)";

/// What a fetch read.
#[derive(Debug)]
pub struct Fetched {
    /// The upstream's HTTP status.
    pub status: u16,
    pub body: Vec<u8>,
    /// Whether the body stopped at the byte limit or the time budget rather
    /// than at its end.
    pub cut: bool,
}

/// Why a fetch got no reply.
#[derive(Debug, PartialEq, Eq)]
pub enum FetchError {
    /// The application has no such egress handle.
    NoEgress(String),
    /// The platform refused the destination (not declared, or egress is off
    /// under `ferrite dev` without `--egress allow`).
    Denied(String),
    /// The upstream could not be reached or failed before its status.
    Failed(String),
    /// The budget ran out before the upstream answered.
    TimedOut,
}

impl std::fmt::Display for FetchError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FetchError::NoEgress(e) => write!(f, "no egress handle: {e}"),
            FetchError::Denied(reason) => write!(f, "egress refused the address: {reason}"),
            FetchError::Failed(e) => write!(f, "the source could not be reached: {e}"),
            FetchError::TimedOut => write!(f, "the source did not answer in time"),
        }
    }
}

/// GET `url` through the egress handle `handle`, keeping at most `limit`
/// bytes of the body and spending at most `budget_ms` in all.
pub async fn get(
    ctx: &AppContext,
    handle: &str,
    url: &str,
    accept: &str,
    limit: usize,
    budget_ms: u64,
) -> Result<Fetched, FetchError> {
    get_with(ctx, handle, url, accept, &[], limit, budget_ms).await
}

/// [`get`] with extra request headers (a `range`, for instance).
pub async fn get_with(
    ctx: &AppContext,
    handle: &str,
    url: &str,
    accept: &str,
    extra: &[(&str, &str)],
    limit: usize,
    budget_ms: u64,
) -> Result<Fetched, FetchError> {
    let started = ctx.now_ms();
    // A group split to the platform's capability limit (`apps::egress`).
    let handle = crate::apps::egress::pick(handle, url);
    let mut egress = ctx
        .egress(handle)
        .map_err(|e| FetchError::NoEgress(e.to_string()))?;
    let mut headers = vec![
        EgressHeader {
            name: "accept".into(),
            value: accept.into(),
        },
        EgressHeader {
            name: "user-agent".into(),
            value: USER_AGENT.into(),
        },
    ];
    headers.extend(extra.iter().map(|(name, value)| EgressHeader {
        name: (*name).into(),
        value: (*value).into(),
    }));
    let left = |now: u64| budget_ms.saturating_sub(now.saturating_sub(started));
    let opened = timeout(
        Duration::from_millis(left(ctx.now_ms()).max(1)),
        egress.get_stream(url, &headers),
    )
    .await
    .map_err(|_| FetchError::TimedOut)?
    .map_err(|e| FetchError::Failed(e.to_string()))?;
    let mut stream = match opened {
        EgressStreamOutcome::Denied { reason } => return Err(FetchError::Denied(reason)),
        EgressStreamOutcome::Streaming(stream) => stream,
    };
    let status = stream.status();
    let mut body = Vec::new();
    let mut cut = false;
    loop {
        let remaining = left(ctx.now_ms());
        if remaining == 0 {
            cut = true;
            break;
        }
        match timeout(Duration::from_millis(remaining), stream.next_chunk()).await {
            Err(_) => {
                cut = true;
                break;
            }
            Ok(Ok(None)) => break,
            Ok(Ok(Some(chunk))) => {
                body.extend_from_slice(&chunk);
                if body.len() >= limit {
                    body.truncate(limit);
                    cut = true;
                    break;
                }
            }
            // A stream that fails midway keeps what arrived, marked cut.
            Ok(Err(error)) => {
                if body.is_empty() {
                    return Err(FetchError::Failed(error.to_string()));
                }
                cut = true;
                break;
            }
        }
    }
    // Dropping an unfinished stream stops the upstream transfer.
    drop(stream);
    Ok(Fetched { status, body, cut })
}

/// Percent-encode a query value (RFC 3986 unreserved characters kept).
pub fn encode_query(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for b in value.bytes() {
        if b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~') {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

/// Decode a percent-encoded query value (`+` is a space); `None` when the
/// result is not UTF-8.
pub fn decode_query(value: &str) -> Option<String> {
    let bytes = value.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'+' => out.push(b' '),
            b'%' if i + 2 < bytes.len() => {
                let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).ok()?;
                out.push(u8::from_str_radix(hex, 16).ok()?);
                i += 2;
            }
            b => out.push(b),
        }
        i += 1;
    }
    String::from_utf8(out).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn query_values_round_trip() {
        assert_eq!(encode_query("pride & prejudice"), "pride%20%26%20prejudice");
        assert_eq!(
            decode_query("pride%20%26+prejudice").as_deref(),
            Some("pride & prejudice")
        );
        assert_eq!(decode_query("caf%C3%A9").as_deref(), Some("café"));
        assert_eq!(decode_query("%ZZ"), None);
        assert_eq!(decode_query("%FF"), None, "not UTF-8");
        assert_eq!(decode_query("100%").as_deref(), Some("100%"));
    }
}

//! Small HTTP helpers over the gateway's request and reply envelopes.

use ferrite_app::serde::Serialize;
use ferrite_app::{serde_json, IngressReply, IngressRequest};

/// A reply under construction: status, headers and body.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Response {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

impl Response {
    /// A response with `body` and no headers.
    pub fn new(status: u16, body: impl Into<Vec<u8>>) -> Self {
        Response {
            status,
            headers: Vec::new(),
            body: body.into(),
        }
    }

    /// `value` as a JSON body.
    pub fn json<T: Serialize + ?Sized>(status: u16, value: &T) -> Self {
        match serde_json::to_vec(value) {
            Ok(body) => Response::new(status, body).add_header("content-type", "application/json"),
            Err(error) => Response::error(500, &format!("could not encode the reply: {error}")),
        }
    }

    /// `{"error": message}` with `status`.
    pub fn error(status: u16, message: &str) -> Self {
        Response::json(status, &serde_json::json!({ "error": message }))
    }

    pub fn not_found() -> Self {
        Response::error(404, "not found")
    }

    pub fn method_not_allowed() -> Self {
        Response::error(405, "method not allowed")
    }

    /// Append one header.
    pub fn add_header(mut self, name: impl Into<String>, value: impl Into<String>) -> Self {
        self.headers.push((name.into(), value.into()));
        self
    }

    /// Drop every header called `name` (case-insensitive).
    pub fn without_header(mut self, name: &str) -> Self {
        self.headers.retain(|(n, _)| !n.eq_ignore_ascii_case(name));
        self
    }

    /// The reply envelope for `req`. API replies are per-session, so they are
    /// never cached. Headers are pushed onto `IngressReply.headers` directly:
    /// upstream Core's SDK has the field but not the builder method.
    pub fn into_reply(self, req: &IngressRequest) -> IngressReply {
        let mut reply = IngressReply::new(req.correlation_id.clone(), self.status, self.body);
        let cache_control = self
            .headers
            .iter()
            .any(|(n, _)| n.eq_ignore_ascii_case("cache-control"));
        reply.headers = self.headers;
        if !cache_control {
            reply
                .headers
                .push(("cache-control".into(), "no-store".into()));
        }
        reply
    }
}

/// `(path, query)` of a request target; the query excludes the `?`.
pub fn split_query(target: &str) -> (&str, &str) {
    match target.split_once('?') {
        Some((path, query)) => (path, query),
        None => (target, ""),
    }
}

/// The value of query parameter `name` (undecoded) and the query without
/// it, so that a parameter the router reads itself never reaches a module.
pub fn take_query_param(query: &str, name: &str) -> (Option<String>, String) {
    let mut value = None;
    let rest: Vec<&str> = query
        .split('&')
        .filter(|pair| {
            let (key, found) = pair.split_once('=').unwrap_or((pair, ""));
            if key == name {
                value = Some(found.to_string());
                false
            } else {
                !pair.is_empty()
            }
        })
        .collect();
    (value, rest.join("&"))
}

/// The first value of the forwarded header `name` (case-insensitive).
pub fn header<'a>(req: &'a IngressRequest, name: &str) -> Option<&'a str> {
    req.headers
        .iter()
        .find(|(n, _)| n.eq_ignore_ascii_case(name))
        .map(|(_, v)| v.as_str())
}

/// The value of cookie `name` across every forwarded `cookie` header.
pub fn cookie<'a>(req: &'a IngressRequest, name: &str) -> Option<&'a str> {
    req.headers
        .iter()
        .filter(|(n, _)| n.eq_ignore_ascii_case("cookie"))
        .flat_map(|(_, v)| v.split(';'))
        .filter_map(|pair| pair.trim().split_once('='))
        .find(|(n, _)| *n == name)
        .map(|(_, v)| v.trim())
}

/// Whether `req` would change state on behalf of another site.
///
/// Safe methods are always allowed. An unsafe one is refused when the browser
/// says it is cross-site, or same-site but from another origin
/// (`sec-fetch-site`, sent by every current browser). Requests without the
/// header (curl, the test harness) are not requests a page can forge, so they
/// pass. The session cookie's `SameSite=Lax` is the second line: a cross-site
/// write never carries the browser's session in the first place. (Upstream
/// Core's request envelope has no verified host, so `Origin` cannot be
/// compared against the app's own authority.)
pub fn is_cross_site_write(req: &IngressRequest) -> bool {
    if matches!(req.method.as_str(), "GET" | "HEAD" | "OPTIONS") {
        return false;
    }
    header(req, "sec-fetch-site").is_some_and(|site| !matches!(site.trim(), "same-origin" | "none"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(method: &str, headers: &[(&str, &str)]) -> IngressRequest {
        let mut req = IngressRequest::new(method, "/api/x", Vec::new());
        req.headers = headers
            .iter()
            .map(|(n, v)| (n.to_string(), v.to_string()))
            .collect();
        req
    }

    #[test]
    fn a_cookie_is_found_among_several_and_across_headers() {
        let req = request(
            "GET",
            &[
                ("cookie", "a=1; theme=dark"),
                ("Cookie", " mac_session=abc ; z=9"),
            ],
        );
        assert_eq!(cookie(&req, "mac_session"), Some("abc"));
        assert_eq!(cookie(&req, "theme"), Some("dark"));
        assert_eq!(cookie(&req, "session"), None, "a name is matched whole");
    }

    #[test]
    fn a_query_parameter_is_taken_out_of_the_query() {
        assert_eq!(
            take_query_param("q=a&desktop_session=abc&n=1", "desktop_session"),
            (Some("abc".into()), "q=a&n=1".into())
        );
        assert_eq!(
            take_query_param("desktop_session=abc", "desktop_session"),
            (Some("abc".into()), String::new())
        );
        assert_eq!(
            take_query_param("q=a", "desktop_session"),
            (None, "q=a".into())
        );
        assert_eq!(
            take_query_param("", "desktop_session"),
            (None, String::new())
        );
    }

    #[test]
    fn the_query_is_split_from_the_path() {
        assert_eq!(
            split_query("/api/notes/list?folder=a&x"),
            ("/api/notes/list", "folder=a&x")
        );
        assert_eq!(split_query("/api/notes"), ("/api/notes", ""));
    }

    #[test]
    fn cross_site_writes_are_refused_and_same_origin_ones_pass() {
        // Reads always pass.
        assert!(!is_cross_site_write(&request(
            "GET",
            &[("sec-fetch-site", "cross-site")]
        )));
        // The browser's own verdict decides writes.
        assert!(is_cross_site_write(&request(
            "POST",
            &[("sec-fetch-site", "cross-site")]
        )));
        assert!(is_cross_site_write(&request(
            "DELETE",
            &[("Sec-Fetch-Site", "same-site")]
        )));
        assert!(!is_cross_site_write(&request(
            "POST",
            &[("sec-fetch-site", "same-origin")]
        )));
        assert!(!is_cross_site_write(&request(
            "POST",
            &[("sec-fetch-site", "none")]
        )));
        // No browser header: not a request a page could forge.
        assert!(!is_cross_site_write(&request("POST", &[])));
    }

    #[test]
    fn a_reply_is_uncached_unless_the_module_says_otherwise() {
        let req = IngressRequest::new("GET", "/api/x", Vec::new());
        let plain = Response::new(200, "x").into_reply(&req);
        assert!(plain
            .headers
            .contains(&("cache-control".into(), "no-store".into())));
        let cached = Response::new(200, "x")
            .add_header("Cache-Control", "max-age=60")
            .into_reply(&req);
        assert_eq!(
            cached.headers,
            vec![("Cache-Control".into(), "max-age=60".into())]
        );
    }
}

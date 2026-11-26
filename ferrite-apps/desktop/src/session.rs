//! Per-browser sessions.
//!
//! A browser's first `/api/` request gets a session: 32 random bytes, sent
//! back as the `HttpOnly`, `SameSite=Lax` cookie [`COOKIE`], `Secure` except
//! when the browser shows the request goes to a plain-HTTP loopback page
//! (see [`cookie_for`]). The server keeps
//! only a record keyed by the token's SHA-256 (the session id), so neither the
//! store nor any reply body holds a usable token. A cookie whose record is
//! missing (forged, or from wiped state) is replaced, never adopted.
//!
//! Known limit, accepted for a demo: a cookieless first request that the
//! gateway redelivers after losing its reply creates a second session, and
//! whatever the first delivery wrote stays in the first, orphaned one.
//!
//! A session is anonymous until someone signs in (`src/accounts/`). Signing
//! in, signing up, choosing Guest User and signing out each end the session
//! and issue a new one in the same reply ([`start`]): the old record is
//! deleted and a fresh token replaces the cookie, so a token planted before
//! sign-in is worthless after it. A signed-in session's record names its
//! account, and module storage is keyed by the [`Session::principal`]: the
//! account id when signed in, the session id otherwise.

use std::io;

use ferrite_app::client::StoreClusterClient;
use ferrite_app::crypto::{hex, hmac_sha256, sha256, Ed25519SigningKey};
use ferrite_app::{serde, serde_json, IngressRequest};

/// The session cookie's name.
pub const COOKIE: &str = "mac_session";
/// The name each lock attempt's cookie starts with: the page sets `mac_lock_<attempt>` the moment
/// the person chooses Lock Screen, before the lock request is sent. While the browser carries any
/// such cookie, whatever its value, no app answers (423), even when a read reaches the server
/// before the lock itself does. A lock that succeeds deletes its own cookie, and only its own, so
/// no attempt ever touches another's; otherwise it expires after 20 seconds.
pub const LOCK_REQUESTED_COOKIE: &str = "mac_lock";

/// Whether the browser behind `req` has asked to lock its screen ([`LOCK_REQUESTED_COOKIE`]).
pub fn lock_requested(req: &IngressRequest) -> bool {
    req.headers
        .iter()
        .filter(|(name, _)| name.eq_ignore_ascii_case("cookie"))
        .flat_map(|(_, value)| value.split(';'))
        .filter_map(|pair| pair.trim().split('=').next())
        .any(|name| name.starts_with(LOCK_REQUESTED_COOKIE))
}
/// How long a browser keeps an anonymous session's cookie: 400 days, the
/// longest browsers honour.
pub const MAX_AGE_SECONDS: u64 = 400 * 24 * 60 * 60;
/// How long a signed-in account's session lasts: 30 days.
pub const ACCOUNT_MAX_AGE_SECONDS: u64 = 30 * 24 * 60 * 60;
/// How long a Guest User session, and the guest's data, lasts: 24 hours.
pub const GUEST_MAX_AGE_SECONDS: u64 = 24 * 60 * 60;

const TOKEN_BYTES: usize = 32;
const RECORD_PREFIX: &str = "sessions/";

/// The account a session is signed in to.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
pub struct Account {
    /// The account id: `u-` and 32 hex digits for a person, `g-` and 32 hex
    /// digits for a Guest User. Random, never derived from the name.
    pub id: String,
    /// The account name, lower case (`guest` for a Guest User).
    pub name: String,
    /// The full name the login window and the menu bar show.
    pub full_name: String,
    /// Whether this is a Guest User, whose data is deleted when it signs out
    /// or its 24 hours end.
    pub guest: bool,
    /// The account's password generation when this session signed in. A
    /// session signed in under an older one is over.
    #[serde(default)]
    pub generation: u64,
}

/// The session of one request.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Session {
    /// The session id: the hex SHA-256 of the cookie token. Safe to show and
    /// to use in storage keys; it cannot be turned back into the cookie.
    pub id: String,
    /// When the session was created (epoch ms).
    pub created_ms: u64,
    /// When the session's record expires (epoch ms).
    pub expires_ms: u64,
    /// Whether this request created it.
    pub is_new: bool,
    /// Whose data the request reaches: the account id when signed in,
    /// otherwise the session id. Module storage is keyed by it
    /// (`apps/<app>/users/<principal>/`).
    pub principal: String,
    /// The signed-in account, if any.
    pub account: Option<Account>,
    /// Whether the screen is locked: no module answers until the password
    /// unlocks it.
    pub locked: bool,
    /// The anonymous session whose data this account may still take in, once
    /// (`POST /api/session/adopt`).
    pub adopt_from: Option<String>,
    /// Whether that move was already answered (in an earlier session that
    /// ended before it finished): the page then carries on without asking.
    pub adopt_resume: bool,
    /// When not 0 (epoch ms), `adopt_from` held nothing at the sign-in and is
    /// only a candidate: a request it sent before then may still be writing,
    /// so it is looked at again at this time and offered only if it then holds
    /// data (`GET /api/session`).
    pub adopt_check_ms: u64,
    /// This browser's own id, which [`Session::for_modules`] keeps when it
    /// puts the principal in `id`: what tells one browser of an account from
    /// another (Find My's devices). It is the id of the browser's first
    /// session, a hash of that cookie that cannot be turned back into it, and
    /// [`start`] carries it to every session the browser rotates to, so a
    /// browser stays one device through sign-ins, sign-outs and switches.
    pub browser: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Record {
    created_ms: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    expires_ms: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    account: Option<Account>,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    locked: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    adopt_from: Option<String>,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    adopt_resume: bool,
    #[serde(default, skip_serializing_if = "is_zero")]
    adopt_check_ms: u64,
    /// Ended by a sign-in, sign-out or switch ([`start`]): kept briefly so
    /// that a second request rotating the same session finds it taken, and
    /// read everywhere as no session at all.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    consumed: bool,
    /// [`Session::browser`] when it is not the session's own id (a session a
    /// rotation started).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    browser: Option<String>,
    /// On a consumed record, the id of the session that ended it, so that a
    /// rotation whose claim went unanswered can tell its own claim from a
    /// concurrent one when it reads the record back.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    claimed_by: Option<String>,
}

impl Session {
    fn from_record(id: String, record: Record, is_new: bool) -> Session {
        let principal = match &record.account {
            Some(account) => account.id.clone(),
            None => id.clone(),
        };
        Session {
            expires_ms: record
                .expires_ms
                .unwrap_or(record.created_ms + MAX_AGE_SECONDS * 1000),
            browser: record.browser.unwrap_or_else(|| id.clone()),
            id,
            created_ms: record.created_ms,
            is_new,
            principal,
            account: record.account,
            locked: record.locked,
            adopt_from: record.adopt_from,
            adopt_resume: record.adopt_resume,
            adopt_check_ms: record.adopt_check_ms,
        }
    }

    fn record(&self) -> Record {
        Record {
            created_ms: self.created_ms,
            expires_ms: Some(self.expires_ms),
            account: self.account.clone(),
            locked: self.locked,
            adopt_from: self.adopt_from.clone(),
            adopt_resume: self.adopt_resume,
            adopt_check_ms: self.adopt_check_ms,
            consumed: false,
            browser: (self.browser != self.id).then(|| self.browser.clone()),
            claimed_by: None,
        }
    }

    /// The session as an app module is given it: its `id` is the
    /// [`Session::principal`], the person behind the request. A module keys
    /// what it attributes or names by `session.id` (a Messages author, a
    /// Chess seat, the `session` a document reply carries so that the page
    /// reloads when the person changes), so through this one place all of
    /// them follow the signed-in account instead of the browser's cookie.
    /// Before anyone signs in the principal is the session id, as before.
    pub fn for_modules(&self) -> Session {
        Session {
            id: self.principal.clone(),
            ..self.clone()
        }
    }

    /// When a Guest User's time ends (epoch ms), or `None` for anyone else:
    /// every key in the guest's own space expires then
    /// (`Storage::user_data_expires`).
    pub fn guest_expires_ms(&self) -> Option<u64> {
        self.account
            .as_ref()
            .filter(|account| account.guest)
            .map(|_| self.expires_ms)
    }

    /// Whether a move of earlier data is on offer now (not only a candidate
    /// still to be looked at).
    pub fn adopt_offered(&self) -> bool {
        self.adopt_from.is_some() && self.adopt_check_ms == 0
    }

    /// The `GET /api/session` body: the session id (a hash of the cookie),
    /// the signed-in account without its id, whether the screen is locked and
    /// whether a move of this browser's earlier data is on offer.
    pub fn describe(&self) -> serde_json::Value {
        let account = self.account.as_ref().map(|account| {
            serde_json::json!({
                "name": account.name,
                "full_name": account.full_name,
                "guest": account.guest,
            })
        });
        serde_json::json!({
            "session": self.id,
            "created_ms": self.created_ms,
            "new": self.is_new,
            "account": account,
            "locked": self.locked,
            "adopt": self.adopt_offered(),
            "adopt_resume": self.adopt_offered() && self.adopt_resume,
        })
    }
}

/// The cookie lifetime, in seconds, of a session signed in to `account`.
pub fn max_age_for(account: Option<&Account>) -> u64 {
    match account {
        None => MAX_AGE_SECONDS,
        Some(account) if account.guest => GUEST_MAX_AGE_SECONDS,
        Some(_) => ACCOUNT_MAX_AGE_SECONDS,
    }
}

/// How long an ended session's record is kept, marked consumed, so that a
/// late or concurrent request with its cookie is refused rather than given a
/// new session whose cookie could replace the successor's: longer than any
/// request (the gateway allows 8 seconds), short enough that a browser whose
/// sign-in reply was lost starts afresh soon.
const CONSUMED_TTL_MS: u64 = 60 * 1000;

/// End `previous` and start a new session for `account` (`None`: an
/// anonymous one), with a fresh token, or `Ok(None)` when `previous` was
/// already ended by another request (a sign-in, sign-out or switch sent at
/// the same time, or one that came first). The old record is claimed with
/// compare-and-set, marked consumed, before the new one is made, so a session
/// is rotated exactly once; the returned `set-cookie` value replaces the
/// browser's cookie. Signing in, signing up, Guest User and signing out all
/// go through here. `adopt` is the anonymous session whose data the account
/// may take in, whether that move was already answered, and when not 0 the
/// time to look at it again ([`Session::adopt_check_ms`]).
pub async fn start(
    store: &mut StoreClusterClient,
    req: &IngressRequest,
    now_ms: u64,
    previous: &Session,
    account: Option<Account>,
    adopt: Option<(String, bool, u64)>,
) -> io::Result<Option<(Session, String)>> {
    let old_key = record_key(&previous.id);
    let Some((bytes, version)) = store.get_versioned(old_key.as_bytes()).await? else {
        return Ok(None);
    };
    let mut old: Record = serde_json::from_slice(&bytes)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;
    if old.consumed {
        return Ok(None);
    }
    let token = new_token();
    let id = session_id(&token);
    old.consumed = true;
    // The successor's id makes this claim's bytes its own: a read-back after
    // an unanswered claim tells it from a concurrent rotation's.
    old.claimed_by = Some(id.clone());
    let tombstone = serde_json::to_vec(&old)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;
    let claimed = crate::store::replace_if_version(
        store,
        old_key.as_bytes(),
        &tombstone,
        version,
        now_ms + CONSUMED_TTL_MS,
    )
    .await?;
    if claimed == crate::store::Replaced::Changed {
        return Ok(None);
    }
    let max_age = max_age_for(account.as_ref());
    let (adopt_from, adopt_resume, adopt_check_ms) = match adopt {
        Some((from, resume, check)) => (Some(from), resume, check),
        None => (None, false, 0),
    };
    let record = Record {
        created_ms: now_ms,
        expires_ms: Some(now_ms + max_age * 1000),
        account,
        locked: false,
        adopt_from,
        adopt_resume,
        adopt_check_ms,
        consumed: false,
        // The same browser, whoever is signed in to it now.
        browser: Some(previous.browser.clone()),
        claimed_by: None,
    };
    let session = Session::from_record(id, record, true);
    create(store, &session).await?;
    Ok(Some((session, cookie_with(req, &token, max_age))))
}

fn is_zero(value: &u64) -> bool {
    *value == 0
}

fn encode(session: &Session) -> io::Result<Vec<u8>> {
    serde_json::to_vec(&session.record())
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))
}

/// Store a new session's record; its token is fresh, so the key is absent.
/// A write whose outcome the store cannot report (`SESSION_UNKNOWN`) is read
/// back and, when it did not apply, sent again
/// ([`crate::store::create_if_absent`]), so the request gets its session
/// instead of a 503.
async fn create(store: &mut StoreClusterClient, session: &Session) -> io::Result<()> {
    match crate::store::create_if_absent(
        store,
        record_key(&session.id).as_bytes(),
        &encode(session)?,
        session.expires_ms,
    )
    .await?
    {
        crate::store::Created::Ours => Ok(()),
        crate::store::Created::Taken => {
            Err(io::Error::other("a new session's record already exists"))
        }
    }
}

/// Compare-and-set attempts of [`update`] before it gives up.
const UPDATE_ATTEMPTS: usize = 8;

/// Apply `change` to the stored record of `session` (a lock, an unlock, a
/// decided move), keeping its expiry. The record is read again and the change
/// written with compare-and-set, so a concurrent change is never overwritten
/// with a stale copy, and a record deleted meanwhile (the browser signed out,
/// or signed in as someone else) is never brought back: `Ok(None)` then.
/// A write with an unknown outcome is settled by reading the record back
/// ([`crate::store::replace_if_version`]). Every `change` sets fields to
/// values, so applying it again to a record that moved on is harmless.
pub async fn update(
    store: &mut StoreClusterClient,
    session: &Session,
    change: impl Fn(&mut Session),
) -> io::Result<Option<Session>> {
    let key = record_key(&session.id);
    for _ in 0..UPDATE_ATTEMPTS {
        let Some((bytes, version)) = store.get_versioned(key.as_bytes()).await? else {
            return Ok(None);
        };
        let record: Record = serde_json::from_slice(&bytes)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;
        if record.consumed {
            return Ok(None);
        }
        let mut current = Session::from_record(session.id.clone(), record, false);
        change(&mut current);
        let written = crate::store::replace_if_version(
            store,
            key.as_bytes(),
            &encode(&current)?,
            version,
            current.expires_ms,
        )
        .await?;
        if written == crate::store::Replaced::Ours {
            return Ok(Some(current));
        }
    }
    Err(io::Error::other(
        "the session kept changing during the update",
    ))
}

/// The `set-cookie` value that ends the browser's cookie at once.
pub fn expired_cookie(req: &IngressRequest) -> String {
    let secure = if plain_http_loopback(req) {
        ""
    } else {
        " Secure;"
    };
    format!("{COOKIE}=; Path=/; Max-Age=0; HttpOnly;{secure} SameSite=Lax")
}

/// The request's session and, when one was created, the `set-cookie` value
/// that hands it to the browser; `Ok(None)` when the cookie names a session
/// another request has just ended (a sign-in, sign-out or switch sent at the
/// same time). Such a request is refused, with no cookie, so that its reply
/// can never replace the cookie of the session that took over.
pub async fn resolve(
    store: &mut StoreClusterClient,
    req: &IngressRequest,
    now_ms: u64,
) -> io::Result<Option<(Session, Option<String>)>> {
    if let Some(token) = crate::http::cookie(req, COOKIE).filter(|t| well_formed(t)) {
        let id = session_id(token);
        if let Some(bytes) = store.get(record_key(&id).as_bytes()).await? {
            let record: Record = serde_json::from_slice(&bytes)
                .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;
            if record.consumed {
                return Ok(None);
            }
            // A record past its time (one stored without a store expiry, for
            // one) is no session, as `live_principal` reads it: a new one
            // starts, with a new cookie.
            let session = Session::from_record(id, record, false);
            if session.expires_ms > now_ms && !outdated(store, &session).await? {
                return Ok(Some((session, None)));
            }
        }
    }
    let token = new_token();
    let id = session_id(&token);
    // The record lives as long as the cookie can.
    let record = Record {
        created_ms: now_ms,
        expires_ms: Some(now_ms + MAX_AGE_SECONDS * 1000),
        account: None,
        locked: false,
        adopt_from: None,
        adopt_resume: false,
        adopt_check_ms: 0,
        consumed: false,
        browser: None,
        claimed_by: None,
    };
    let session = Session::from_record(id, record, true);
    create(store, &session).await?;
    Ok(Some((session, Some(cookie_for(req, &token)))))
}

/// The `set-cookie` value that hands `token` to the browser behind `req`.
///
/// The cookie is `Secure` unless the browser itself shows that the request
/// goes to a page served over plain HTTP from a loopback host, as `ferrite
/// dev` serves it: WebKit does not keep a `Secure` cookie set over plain HTTP,
/// even on `localhost`, so every request would start a new session there.
///
/// The request envelope carries no scheme or host, so the evidence is two
/// headers a page cannot set: `Sec-Fetch-Site: same-origin`, the browser's
/// statement that the request goes to the very scheme, host and port of the
/// page that sent it, and that page's address, from `Origin` whenever the
/// request has one, and from `Referer` only when it has none. Together they
/// place the destination at plain-HTTP loopback. The page's address alone
/// never counts, since it says where a request came from, not where it went;
/// so a missing `Sec-Fetch-Site` (a browser without Fetch Metadata), `none`,
/// `same-site`, `cross-site`, an opaque (`null`) origin, or no page address
/// all keep `Secure`. A client that forges the headers only weakens its own
/// cookie.
pub fn cookie_for(req: &IngressRequest, token: &str) -> String {
    set_cookie(token, !plain_http_loopback(req))
}

/// [`cookie_for`] with a lifetime of `max_age` seconds.
pub fn cookie_with(req: &IngressRequest, token: &str, max_age: u64) -> String {
    set_cookie_for(token, !plain_http_loopback(req), max_age)
}

/// The `set-cookie` value for `token`, with or without `Secure`.
pub fn set_cookie(token: &str, secure: bool) -> String {
    set_cookie_for(token, secure, MAX_AGE_SECONDS)
}

fn set_cookie_for(token: &str, secure: bool, max_age: u64) -> String {
    let secure = if secure { " Secure;" } else { "" };
    format!("{COOKIE}={token}; Path=/; Max-Age={max_age}; HttpOnly;{secure} SameSite=Lax")
}

/// Whether the browser says `req` goes to its own page's origin and that page
/// is `http://127.0.0.1`, `http://localhost` or `http://[::1]` (any port).
fn plain_http_loopback(req: &IngressRequest) -> bool {
    let same_origin = crate::http::header(req, "sec-fetch-site")
        .is_some_and(|site| site.trim().eq_ignore_ascii_case("same-origin"));
    // An Origin, when there is one, decides alone (`null` matches no host);
    // Referer stands in only when the browser sent no Origin at all.
    let page = crate::http::header(req, "origin")
        .or_else(|| crate::http::header(req, "referer"))
        .map(str::trim);
    same_origin && page.and_then(http_host).is_some_and(is_loopback)
}

/// The host of an `http://` URL (not `https://`), without its port.
fn http_host(url: &str) -> Option<&str> {
    let scheme = url.get(..7)?;
    if !scheme.eq_ignore_ascii_case("http://") {
        return None;
    }
    let rest = &url[7..];
    let authority = &rest[..rest.find(['/', '?', '#']).unwrap_or(rest.len())];
    if authority.contains('@') {
        return None;
    }
    let (host, port) = if authority.starts_with('[') {
        let end = authority.find(']')?;
        (&authority[..=end], &authority[end + 1..])
    } else {
        match authority.split_once(':') {
            Some((host, _)) => (host, &authority[host.len()..]),
            None => (authority, ""),
        }
    };
    let port_ok = port.is_empty()
        || port
            .strip_prefix(':')
            .is_some_and(|p| !p.is_empty() && p.bytes().all(|b| b.is_ascii_digit()));
    port_ok.then_some(host)
}

fn is_loopback(host: &str) -> bool {
    host == "127.0.0.1" || host == "[::1]" || host.eq_ignore_ascii_case("localhost")
}

/// The session id for a cookie token.
pub fn session_id(token: &str) -> String {
    hex(&sha256(token.as_bytes()))
}

/// The principal of the session `id` while it is live: its record exists, it
/// was not ended by a sign-in, sign-out or switch, it has not expired and its
/// screen is not locked. `Ok(None)` otherwise. The personal live stream
/// (`src/live.rs`) asks this every few seconds, so a browser that signs out,
/// switches person or locks its screen stops hearing the person's updates.
pub async fn live_principal(
    store: &mut StoreClusterClient,
    id: &str,
    now_ms: u64,
) -> io::Result<Option<String>> {
    let Some(bytes) = store.get(record_key(id).as_bytes()).await? else {
        return Ok(None);
    };
    let record: Record = serde_json::from_slice(&bytes)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;
    if record.consumed || record.locked {
        return Ok(None);
    }
    let session = Session::from_record(id.to_string(), record, false);
    if outdated(store, &session).await? {
        return Ok(None);
    }
    Ok((session.expires_ms > now_ms).then_some(session.principal))
}

/// The generation of an account's password as its record says now.
async fn current_generation(store: &mut StoreClusterClient, id: &str) -> io::Result<Option<u64>> {
    #[derive(serde::Deserialize)]
    #[serde(crate = "ferrite_app::serde")]
    struct Generation {
        #[serde(default)]
        generation: u64,
    }
    let key = format!("{}{id}", crate::accounts::USERS_PREFIX);
    let Some(bytes) = store.get(key.as_bytes()).await? else {
        return Ok(None);
    };
    let read: Generation = serde_json::from_slice(&bytes)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;
    Ok(Some(read.generation))
}

/// Whether `session` was signed in before its account's password last changed.
async fn outdated(store: &mut StoreClusterClient, session: &Session) -> io::Result<bool> {
    let Some(account) = session.account.as_ref().filter(|account| !account.guest) else {
        return Ok(false);
    };
    Ok(current_generation(store, &account.id)
        .await?
        .is_some_and(|generation| generation != account.generation))
}

fn record_key(id: &str) -> String {
    format!("{RECORD_PREFIX}{id}")
}

fn well_formed(token: &str) -> bool {
    token.len() == TOKEN_BYTES * 2
        && token
            .bytes()
            .all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
}

/// A fresh random token from the operating system's generator. Upstream Core's SDK
/// exports no random function and the code gate refuses `getrandom`; key
/// generation is its one route to the system generator, so (as the
/// `sha256-hmac` source package does) the token is an HMAC keyed with a freshly
/// generated Ed25519 key document that is then dropped.
fn new_token() -> String {
    let document = Ed25519SigningKey::generate_pkcs8();
    hex(&hmac_sha256(&document, b"macalicious-desktop/session/v1"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokens_are_well_formed_and_distinct() {
        let a = new_token();
        let b = new_token();
        assert!(well_formed(&a) && well_formed(&b), "{a} / {b}");
        assert_ne!(a, b);
    }

    #[test]
    fn only_64_lowercase_hex_characters_make_a_token() {
        assert!(well_formed(&"0a".repeat(32)));
        assert!(
            !well_formed(&"0A".repeat(32)),
            "uppercase is not what we issue"
        );
        assert!(!well_formed(&"0a".repeat(31)));
        assert!(!well_formed(&format!("{}zz", "0a".repeat(31))));
    }

    #[test]
    fn a_record_of_an_earlier_build_reads_as_an_anonymous_session() {
        let record: Record = serde_json::from_slice(br#"{"created_ms":5}"#).unwrap();
        let session = Session::from_record("abc".into(), record, false);
        assert_eq!(session.principal, "abc");
        assert_eq!(session.account, None);
        assert!(!session.locked);
        assert_eq!(session.expires_ms, 5 + MAX_AGE_SECONDS * 1000);
    }

    #[test]
    fn a_signed_in_session_is_keyed_by_its_account() {
        let account = Account {
            id: "u-0123".into(),
            name: "chris".into(),
            full_name: "Chris".into(),
            guest: false,
            generation: 0,
        };
        let record = Record {
            created_ms: 1,
            expires_ms: Some(2),
            account: Some(account),
            locked: true,
            adopt_from: None,
            adopt_resume: false,
            adopt_check_ms: 0,
            consumed: false,
            browser: None,
            claimed_by: None,
        };
        let session = Session::from_record("abc".into(), record, false);
        assert_eq!(
            session.for_modules().id,
            "u-0123",
            "a module sees the account as the session"
        );
        assert_eq!(
            session.for_modules().browser,
            "abc",
            "and still tells this browser from the account's others"
        );
        assert_eq!(session.principal, "u-0123");
        let described = session.describe();
        assert_eq!(described["account"]["name"], "chris");
        assert!(
            described["account"].get("id").is_none(),
            "the id stays on the server"
        );
        assert_eq!(described["locked"], true);
    }

    #[test]
    fn cookie_lifetimes_follow_the_kind_of_session() {
        let guest = Account {
            id: "g-1".into(),
            name: "guest".into(),
            full_name: "Guest User".into(),
            guest: true,
            generation: 0,
        };
        let person = Account {
            guest: false,
            ..guest.clone()
        };
        assert_eq!(max_age_for(None), MAX_AGE_SECONDS);
        assert_eq!(max_age_for(Some(&guest)), 86_400);
        assert_eq!(max_age_for(Some(&person)), 30 * 86_400);
        let cookie = cookie_with(&request(&[]), "t", 86_400);
        for attribute in ["HttpOnly", "Secure", "SameSite=Lax", "Max-Age=86400"] {
            assert!(cookie.contains(attribute), "{cookie} lacks {attribute}");
        }
        let expired = expired_cookie(&request(&[]));
        assert!(expired.starts_with("mac_session=;") && expired.contains("Max-Age=0"));
    }

    #[test]
    fn the_session_id_is_the_sha256_of_the_token() {
        // SHA-256("abc"), the FIPS 180-2 example.
        assert_eq!(
            session_id("abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    fn request(headers: &[(&str, &str)]) -> IngressRequest {
        let mut req = IngressRequest::new("GET", "/api/session", Vec::new());
        req.headers = headers
            .iter()
            .map(|(n, v)| (n.to_string(), v.to_string()))
            .collect();
        req
    }

    fn cookie(headers: &[(&str, &str)]) -> String {
        let cookie = cookie_for(&request(headers), "t");
        assert!(cookie.starts_with("mac_session=t; Path=/;"), "{cookie}");
        for attribute in ["HttpOnly", "SameSite=Lax", "Max-Age=34560000"] {
            assert!(cookie.contains(attribute), "{cookie} lacks {attribute}");
        }
        cookie
    }

    fn is_secure(cookie: &str) -> bool {
        cookie.split(';').any(|a| a.trim() == "Secure")
    }

    #[test]
    fn an_https_page_gets_a_secure_cookie() {
        for headers in [
            &[("origin", "https://desktop.example.com")][..],
            &[("referer", "https://desktop.example.com/messages/")],
            &[
                ("origin", "https://localhost:8443"),
                ("sec-fetch-site", "same-origin"),
            ],
            &[("referer", "https://127.0.0.1/")],
            // The Origin decides; a Referer cannot overrule it.
            &[
                ("origin", "https://localhost"),
                ("referer", "http://localhost/"),
                ("sec-fetch-site", "same-origin"),
            ],
        ] {
            assert!(is_secure(&cookie(headers)), "{headers:?}");
        }
    }

    #[test]
    fn a_plain_http_loopback_page_gets_a_cookie_without_secure() {
        for headers in [
            &[
                ("origin", "http://127.0.0.1:8795"),
                ("sec-fetch-site", "same-origin"),
            ][..],
            &[
                ("referer", "http://127.0.0.1:8795/desktop/?app=messages"),
                ("sec-fetch-site", "same-origin"),
            ],
            &[
                ("referer", "http://localhost:8795/"),
                ("sec-fetch-site", "same-origin"),
            ],
            &[
                ("origin", "http://LOCALHOST"),
                ("sec-fetch-site", "Same-Origin"),
            ],
            &[
                ("origin", "http://[::1]:8795"),
                ("sec-fetch-site", "same-origin"),
            ],
            &[
                ("referer", "http://localhost:8795?x"),
                ("sec-fetch-site", "same-origin"),
            ],
        ] {
            assert!(!is_secure(&cookie(headers)), "{headers:?}");
        }
    }

    #[test]
    fn anything_else_keeps_secure() {
        let same = ("sec-fetch-site", "same-origin");
        for headers in [
            // Plain HTTP on a host that is not loopback.
            &[("origin", "http://desktop.example.com"), same][..],
            &[("referer", "http://192.168.1.20:8795/"), same],
            &[("origin", "http://127.0.0.2"), same],
            &[("origin", "http://localhost.example.com"), same],
            &[("referer", "http://[::2]/"), same],
            // Hosts dressed up to look like loopback.
            &[("referer", "http://localhost@example.com/"), same],
            &[("origin", "http://localhost:80x"), same],
            &[("origin", "http://localhost:"), same],
            // A loopback page, but the browser does not say the request went to that
            // page's origin: it may have gone to a deployed HTTPS app.
            &[
                ("origin", "http://localhost:3000"),
                ("sec-fetch-site", "cross-site"),
            ],
            &[
                ("origin", "http://localhost:3000"),
                ("sec-fetch-site", "same-site"),
            ],
            &[("referer", "http://127.0.0.1/"), ("sec-fetch-site", "none")],
            // A browser without Fetch Metadata following a link from a loopback page.
            &[("referer", "http://localhost:3000/")],
            &[("origin", "http://127.0.0.1:8795")],
            // No page, or an opaque origin whatever its Referer says.
            &[],
            &[same],
            &[("origin", "null"), same],
            &[("origin", "null"), ("referer", "http://localhost/"), same],
            &[("referer", "localhost"), same],
        ] {
            assert!(is_secure(&cookie(headers)), "{headers:?}");
        }
    }
}

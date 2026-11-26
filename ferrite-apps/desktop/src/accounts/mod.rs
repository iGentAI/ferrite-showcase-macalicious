//! Accounts: the desktop's own sign-in, so each person gets a desktop of
//! their own.
//!
//! Ferrite's preview gate passes no verified identity to an application and
//! upstream Core has no managed authentication, so the desktop keeps its own
//! accounts in the `data` store and signs people in itself. A session
//! (`src/session.rs`) is anonymous until someone signs in; signing in names
//! the account in the session's record, and from then on every module's
//! storage is keyed by the account ([`crate::session::Session::principal`]).
//!
//! Routes, beside `GET /api/session`:
//!
//! | route | does |
//! | --- | --- |
//! | `POST /api/session/sign-up` | `{name, full_name, password, invite?}`: a new account, signed in |
//! | `POST /api/session/sign-in` | `{name, password}` |
//! | `POST /api/session/guest` | a Guest User account for 24 hours, signed in |
//! | `POST /api/session/sign-out` | back to an anonymous session; a guest's data is deleted |
//! | `POST /api/session/lock` | Lock Screen: modules answer 423 until unlocked |
//! | `POST /api/session/unlock` | `{password}` |
//! | `POST /api/session/password` | `{current, new}`: a new password; the account's other sessions end |
//! | `POST /api/session/adopt` | `{keep}`: move this browser's earlier anonymous data into the account, once |
//!
//! Every one of them that signs in or out ends the old session and issues a
//! new cookie in the same reply. Writes must be `application/json`, so a
//! cross-site HTML form cannot reach them (the router has already refused a
//! write the browser marks as cross-site).
//!
//! Stored records, all in the `data` store:
//!
//! * `accounts/names/<name>` → `{"id"}`, written create-if-absent, so two
//!   sign-ups for one name cannot both win;
//! * `accounts/users/<id>` → the full name, the password record, when it was
//!   made and whether its one offer to take in a browser's data was decided;
//! * `accounts/failures/<name>` → failed sign-ins, expiring 15 minutes after
//!   the last: five lock the name until then. The gateway gives an app no
//!   verified client address, so the limit is per name;
//! * `accounts/guests/<expiry>/<id>` → the Guest User accounts, oldest
//!   first, so expired ones can have their data deleted.
//!
//! Sign-up is open by default. The secret [`SIGNUP_SECRET`] set to `closed`
//! closes it, and set to `invite:<code>` (a code of 8 or more characters)
//! lets only someone with the code sign up. Any other value closes it.

mod password;

use std::io;

use ferrite_app::client::StoreClusterClient;
use ferrite_app::{serde, serde_json, AppContext, IngressRequest};

use crate::http::Response;
use crate::session::{self, Account, Session};
use crate::store::IntoStore;

pub use password::{Calibration, MAX_ITERATIONS, MIN_ITERATIONS, PEPPER_SECRET, TARGET_MS};

/// The secret that opens or closes sign-up.
pub const SIGNUP_SECRET: &str = "mac_signup";
/// Where the records live in the `data` store.
pub const NAMES_PREFIX: &str = "accounts/names/";
pub const USERS_PREFIX: &str = "accounts/users/";
pub const FAILURES_PREFIX: &str = "accounts/failures/";
pub const GUESTS_PREFIX: &str = "accounts/guests/";
/// `accounts/migrations/<account>` holds the account's answer to the offer of
/// a browser's earlier data ([`Migration`]): created once, create-if-absent.
pub const MIGRATIONS_PREFIX: &str = "accounts/migrations/";
/// How long after a guest logs out its data stays in the purge's index, so a
/// request already under way (the gateway allows 8 seconds) that writes after
/// the log-out is cleaned up as well.
pub const GUEST_GRACE_MS: u64 = 60_000;
/// How long after a browser's anonymous session ends (at the sign-in that
/// offers its data) a request it sent before then may still write: longer than
/// the gateway's 8 seconds. Nothing moves into the account before this has
/// passed, so no late write or update is left behind or overwritten.
pub const SETTLE_MS: u64 = 10_000;
/// Failed sign-ins that lock a name, and for how long.
pub const MAX_FAILURES: u64 = 5;
pub const LOCKOUT_MS: u64 = 15 * 60 * 1000;
/// Keys one request moves or deletes, so no request nears the deadline; the
/// page asks again until the work is done.
pub const STEP_KEYS: usize = 400;
/// Storage calls in one guest cleanup step, including empty scans and progress writes.
pub const GUEST_CLEANUP_OPS: usize = 16;
/// The longest account name and full name, in characters.
pub const MAX_NAME_CHARS: usize = 32;
pub const MAX_FULL_NAME_CHARS: usize = 64;

/// What sign-up allows.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Signup {
    Open,
    Closed,
    Invite(String),
}

impl Signup {
    /// The mode a value of [`SIGNUP_SECRET`] sets.
    pub fn from_secret(value: Option<&str>) -> Signup {
        match value.map(str::trim) {
            None | Some("") | Some("open") => Signup::Open,
            Some(value) => match value.strip_prefix("invite:") {
                Some(code) if code.len() >= 8 => Signup::Invite(code.to_string()),
                _ => Signup::Closed,
            },
        }
    }

    fn as_str(&self) -> &'static str {
        match self {
            Signup::Open => "open",
            Signup::Closed => "closed",
            Signup::Invite(_) => "invite",
        }
    }
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct NameRecord {
    id: String,
}

/// `accounts/migrations/<account>`: the account's one answer to the offer
/// to take in a browser's earlier data, bound to that browser's anonymous
/// session, and whether the move has finished. It outlives the session that
/// answered, so a move cut short (by a sign-out, a switch or an expiry) is
/// carried on, with the same answer, at the account's next sign-in.
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Migration {
    from: String,
    keep: bool,
    #[serde(default)]
    done: bool,
    /// Not finished before this (epoch ms): [`SETTLE_MS`] after the sign-in
    /// that ended the anonymous session, so its late writes move too.
    #[serde(default)]
    settle_ms: u64,
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct UserRecord {
    name: String,
    full_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    hash: Option<String>,
    created_ms: u64,
    #[serde(default)]
    guest: bool,
    /// Whether the offer to take in a browser's earlier data was answered.
    #[serde(default)]
    adopted: bool,
    /// Raised by each change of password: a session signed in under an older
    /// value is over (`session::resolve`).
    #[serde(default)]
    generation: u64,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct SignUp {
    name: String,
    full_name: String,
    password: String,
    #[serde(default)]
    invite: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct SignIn {
    name: String,
    password: String,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Unlock {
    password: String,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct ChangePassword {
    current: String,
    new: String,
}

#[derive(serde::Deserialize)]
#[serde(crate = "ferrite_app::serde")]
struct Adopt {
    keep: bool,
}

/// The normalised account name: trimmed and lower case, 1 to
/// [`MAX_NAME_CHARS`] letters, digits, `.`, `_` or `-`, starting with a
/// letter; or `None`.
pub fn account_name(raw: &str) -> Option<String> {
    let name = raw.trim().to_ascii_lowercase();
    let ok = (1..=MAX_NAME_CHARS).contains(&name.len())
        && name.starts_with(|c: char| c.is_ascii_lowercase())
        && name.bytes().all(|b| {
            b.is_ascii_lowercase() || b.is_ascii_digit() || matches!(b, b'.' | b'_' | b'-')
        });
    ok.then_some(name)
}

/// The account someone addresses by its name (a FaceTime call, a Chess
/// invitation, a message or a shared note): its id, name and full name, or
/// `None` when no account has that name. A Guest User has no name record,
/// so nobody can address one. It reads exactly the two records sign-in
/// reads and nothing else.
pub async fn lookup<'s>(store: impl IntoStore<'s>, raw: &str) -> io::Result<Option<Account>> {
    let Some(name) = account_name(raw) else {
        return Ok(None);
    };
    let mut store = store.into_store();
    let record = store
        .get(format!("{NAMES_PREFIX}{name}").as_bytes())
        .await?;
    let Some(NameRecord { id }) = parse_json(record)? else {
        return Ok(None);
    };
    let user = store.get(format!("{USERS_PREFIX}{id}").as_bytes()).await?;
    let user: Option<UserRecord> = parse_json(user)?;
    Ok(user.filter(|user| !user.guest).map(|user| Account {
        id,
        name: user.name,
        full_name: user.full_name,
        guest: false,
        generation: user.generation,
    }))
}

/// The trimmed full name, 1 to [`MAX_FULL_NAME_CHARS`] characters with no
/// control characters; or `None`.
pub fn full_name(raw: &str) -> Option<String> {
    let name = raw.trim();
    let count = name.chars().count();
    ((1..=MAX_FULL_NAME_CHARS).contains(&count) && !name.chars().any(char::is_control))
        .then(|| name.to_string())
}

const INCORRECT: &str = "The name or password is incorrect.";

fn unavailable(error: io::Error) -> Response {
    ferrite_app::tracing::error!(%error, "accounts store failed");
    Response::error(503, "accounts are unavailable; retry")
}

fn no_pepper() -> Response {
    Response::error(
        503,
        &format!("sign-in is not set up: the secret {PEPPER_SECRET} is missing"),
    )
}

fn is_json(req: &IngressRequest) -> bool {
    crate::http::header(req, "content-type").is_some_and(|value| {
        value
            .split(';')
            .next()
            .is_some_and(|kind| kind.trim().eq_ignore_ascii_case("application/json"))
    })
}

fn body<T: serde::de::DeserializeOwned>(req: &IngressRequest) -> Result<T, Response> {
    serde_json::from_slice(&req.body)
        .map_err(|e| Response::error(400, &format!("the body is not the expected JSON: {e}")))
}

async fn get_json<T: serde::de::DeserializeOwned>(
    store: &mut StoreClusterClient,
    key: &str,
) -> io::Result<Option<T>> {
    parse_json(store.get(key.as_bytes()).await?)
}

/// A stored value read as JSON; `None` for none.
fn parse_json<T: serde::de::DeserializeOwned>(bytes: Option<Vec<u8>>) -> io::Result<Option<T>> {
    match bytes {
        Some(bytes) => serde_json::from_slice(&bytes)
            .map(Some)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string())),
        None => Ok(None),
    }
}

fn to_vec<T: serde::Serialize>(value: &T) -> io::Result<Vec<u8>> {
    serde_json::to_vec(value).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))
}

/// The session as `GET /api/session` describes it: a candidate for the move
/// of earlier data ([`Session::adopt_check_ms`]) whose time has come is looked
/// at now, and becomes an offer if it holds data, or is dropped if not.
async fn check_adopt(
    store: &mut StoreClusterClient,
    session: &Session,
    now_ms: u64,
) -> io::Result<Session> {
    let (Some(from), check) = (&session.adopt_from, session.adopt_check_ms) else {
        return Ok(session.clone());
    };
    if check == 0 || now_ms < check {
        return Ok(session.clone());
    }
    let found = has_data(store, from).await?;
    let updated = session::update(store, session, |current| {
        current.adopt_check_ms = 0;
        if !found {
            current.adopt_from = None;
        }
    })
    .await?;
    Ok(updated.unwrap_or_else(|| session.clone()))
}

/// The `GET /api/session` body: the session and what the login window needs.
pub fn describe(ctx: &AppContext, session: &Session) -> serde_json::Value {
    let mut body = session.describe();
    if let Some(object) = body.as_object_mut() {
        let signup = Signup::from_secret(ctx.secret(SIGNUP_SECRET).as_deref());
        object.insert("signup".into(), signup.as_str().into());
        object.insert(
            "sign_in_ready".into(),
            password::pepper(ctx).is_some().into(),
        );
        if session.adopt_from.is_some() && session.adopt_check_ms != 0 {
            // When to ask again: the offer is then made, or dropped.
            let wait = session.adopt_check_ms.saturating_sub(ctx.now_ms());
            object.insert("adopt_check_in_ms".into(), wait.into());
        }
    }
    body
}

/// Answer `/api/session` and every route below it (`path` is the part after
/// `/api/session`, `/` for the endpoint itself).
pub async fn handle(
    ctx: &AppContext,
    store: &mut StoreClusterClient,
    req: &IngressRequest,
    session: &Session,
    path: &str,
    now_ms: u64,
) -> Response {
    const ROUTES: &[&str] = &[
        "/sign-up",
        "/sign-in",
        "/guest",
        "/sign-out",
        "/lock",
        "/unlock",
        "/password",
        "/adopt",
    ];
    match (req.method.as_str(), path) {
        ("GET", "/") => match check_adopt(store, session, now_ms).await {
            Ok(current) => Response::json(200, &describe(ctx, &current)),
            Err(error) => unavailable(error),
        },
        (_, "/") => Response::method_not_allowed(),
        ("POST", route) if ROUTES.contains(&route) => {
            if !is_json(req) {
                return Response::error(415, "send the request as application/json");
            }
            let mut cx = Cx {
                ctx,
                store,
                req,
                session,
                now_ms,
            };
            let answer = match route {
                "/sign-up" => cx.sign_up().await,
                "/sign-in" => cx.sign_in().await,
                "/guest" => cx.guest().await,
                "/sign-out" => cx.sign_out().await,
                "/lock" => cx.lock(true, None).await,
                "/unlock" => match body::<Unlock>(req) {
                    Ok(unlock) => cx.lock(false, Some(unlock.password)).await,
                    Err(response) => Ok(response),
                },
                "/password" => cx.change_password().await,
                _ => cx.adopt().await,
            };
            answer.unwrap_or_else(unavailable)
        }
        (_, route) if ROUTES.contains(&route) => Response::method_not_allowed(),
        _ => Response::not_found(),
    }
}

struct Cx<'a> {
    ctx: &'a AppContext,
    store: &'a mut StoreClusterClient,
    req: &'a IngressRequest,
    session: &'a Session,
    now_ms: u64,
}

impl Cx<'_> {
    /// The pepper and the iteration count, logging the measurement the first
    /// time a process makes it.
    async fn hashing(&mut self) -> Option<(Vec<u8>, u32)> {
        let pepper = password::pepper(self.ctx)?;
        let (calibration, fresh) = password::calibration(self.ctx);
        if fresh {
            let message = format!(
                "password hashing: {} PBKDF2 iterations, from {} iterations measured at {} ms (target {} ms)",
                calibration.iterations,
                calibration.sample_iterations,
                calibration.sample_ms,
                TARGET_MS
            );
            let _ = crate::applog::append(
                &mut *self.store,
                self.now_ms,
                crate::applog::Level::Info,
                "loginwindow",
                "accounts",
                &message,
            )
            .await;
        }
        Some((pepper, calibration.iterations))
    }

    /// End this session and start one for `account`, answering `status` with
    /// the new session and its cookie.
    async fn open(
        &mut self,
        status: u16,
        account: Option<Account>,
        adopt: Option<(String, bool, u64)>,
    ) -> io::Result<Response> {
        let Some((session, cookie)) = session::start(
            self.store,
            self.req,
            self.now_ms,
            self.session,
            account,
            adopt,
        )
        .await?
        else {
            // Another request (a second click, another tab) already signed
            // this session in or out: this one changes nothing.
            return Ok(Response::error(
                409,
                "this browser's session changed meanwhile; load the page again",
            ));
        };
        Ok(Response::json(status, &describe(self.ctx, &session)).add_header("set-cookie", cookie))
    }

    /// The anonymous session whose data the account `id` may take in, whether
    /// that was already answered, and when not 0 the time to look at it again:
    /// a move answered earlier and not finished is carried on from any
    /// browser; otherwise the browser this sign-in leaves is offered when it
    /// holds data and the account has not answered yet. One that holds nothing
    /// yet may still have a request under way that writes its first data, so
    /// it is looked at again [`SETTLE_MS`] later ([`check_adopt`]).
    async fn adoptable(
        &mut self,
        id: &str,
        user: &UserRecord,
    ) -> io::Result<Option<(String, bool, u64)>> {
        if user.guest || user.adopted {
            return Ok(None);
        }
        let pending: Option<Migration> =
            get_json(self.store, &format!("{MIGRATIONS_PREFIX}{id}")).await?;
        if let Some(migration) = pending {
            return Ok((!migration.done).then_some((migration.from, true, 0)));
        }
        if self.session.account.is_some() || self.session.is_new {
            return Ok(None);
        }
        let from = self.session.id.clone();
        let check = if has_data(self.store, &from).await? {
            0
        } else {
            self.now_ms + SETTLE_MS
        };
        Ok(Some((from, false, check)))
    }

    async fn sign_up(&mut self) -> io::Result<Response> {
        let request: SignUp = match body(self.req) {
            Ok(request) => request,
            Err(response) => return Ok(response),
        };
        let Some((pepper, iterations)) = self.hashing().await else {
            return Ok(no_pepper());
        };
        match Signup::from_secret(self.ctx.secret(SIGNUP_SECRET).as_deref()) {
            Signup::Open => {}
            Signup::Closed => return Ok(Response::error(403, "New accounts cannot be made here.")),
            Signup::Invite(code) => {
                let given = request.invite.as_deref().unwrap_or("").trim();
                if !crate::crypto::constant_time_eq(given.as_bytes(), code.as_bytes()) {
                    return Ok(Response::error(403, "That invitation code is not valid."));
                }
            }
        }
        let Some(name) = account_name(&request.name).filter(|name| name != "guest") else {
            return Ok(Response::error(
                400,
                "An account name is 1 to 32 lower-case letters, digits, '.', '_' or '-', starting with a letter.",
            ));
        };
        let Some(full) = full_name(&request.full_name) else {
            return Ok(Response::error(400, "A full name is 1 to 64 characters."));
        };
        if !password::acceptable(&request.password) {
            return Ok(Response::error(400, "A password is 8 to 1,024 characters."));
        }
        let hash = password::hash(&pepper, &request.password, iterations)?;
        let id = format!("u-{}", crate::crypto::random_token(16)?);
        // The record names this account's fresh id, so reading it back after
        // an unanswered claim tells this sign-up's claim from another's.
        let claimed = crate::store::create_if_absent(
            self.store,
            format!("{NAMES_PREFIX}{name}").as_bytes(),
            &to_vec(&NameRecord { id: id.clone() })?,
            0,
        )
        .await?;
        if claimed == crate::store::Created::Taken {
            return Ok(Response::error(409, "That account name is taken."));
        }
        let user = UserRecord {
            name: name.clone(),
            full_name: full.clone(),
            hash: Some(hash),
            created_ms: self.now_ms,
            guest: false,
            adopted: false,
            generation: 0,
        };
        if let Err(error) = self
            .store
            .put(format!("{USERS_PREFIX}{id}").as_bytes(), &to_vec(&user)?)
            .await
        {
            // Give the name back rather than leave it claimed by no account.
            let _ = self
                .store
                .delete(format!("{NAMES_PREFIX}{name}").as_bytes())
                .await;
            return Err(error);
        }
        let adopt = self.adoptable(&id, &user).await?;
        let account = Account {
            id,
            name,
            full_name: full,
            guest: false,
            generation: 0,
        };
        self.open(201, Some(account), adopt).await
    }

    /// Count one attempt to sign in as `name` before its password is checked:
    /// `false` when the name already had [`MAX_FAILURES`] attempts that did
    /// not succeed within [`LOCKOUT_MS`]. The count is advanced with
    /// compare-and-set, so attempts sent at once each take a place and none
    /// gets past the limit; a successful sign-in clears it.
    async fn reserve_attempt(&mut self, name: &str) -> io::Result<bool> {
        let key = format!("{FAILURES_PREFIX}{name}");
        for _ in 0..8 {
            let (count, version) = match self.store.get_versioned(key.as_bytes()).await? {
                Some((bytes, version)) => (
                    serde_json::from_slice::<u64>(&bytes).unwrap_or(MAX_FAILURES),
                    Some(version),
                ),
                None => (0, None),
            };
            if count >= MAX_FAILURES {
                return Ok(false);
            }
            let written = self
                .store
                .put_if_version_expiring(
                    key.as_bytes(),
                    &to_vec(&(count + 1))?,
                    version,
                    self.now_ms + LOCKOUT_MS,
                )
                .await?;
            if written.is_ok() {
                return Ok(true);
            }
        }
        // Contended past every attempt: refuse rather than let it through.
        Ok(false)
    }

    /// The account named `name` and its record, if it exists.
    async fn find(&mut self, name: &str) -> io::Result<Option<(String, UserRecord)>> {
        let Some(NameRecord { id }) =
            get_json(self.store, &format!("{NAMES_PREFIX}{name}")).await?
        else {
            return Ok(None);
        };
        let user: Option<UserRecord> = get_json(self.store, &format!("{USERS_PREFIX}{id}")).await?;
        Ok(user.map(|user| (id, user)))
    }

    /// Check `password` for the account named `name`: the account, or the
    /// reply that refuses it.
    async fn check(
        &mut self,
        name: &str,
        password: &str,
    ) -> io::Result<Result<(String, UserRecord), Response>> {
        let Some((pepper, iterations)) = self.hashing().await else {
            return Ok(Err(no_pepper()));
        };
        if !self.reserve_attempt(name).await? {
            return Ok(Err(Response::error(
                429,
                "Too many attempts. Try again in 15 minutes.",
            )));
        }
        let found = self.find(name).await?;
        let matched = match &found {
            Some((_, user)) => user
                .hash
                .as_deref()
                .is_some_and(|record| password::verify(&pepper, password, record)),
            None => {
                password::verify_nothing(&pepper, password, iterations);
                false
            }
        };
        match found {
            Some(found) if matched => {
                self.store
                    .delete(format!("{FAILURES_PREFIX}{name}").as_bytes())
                    .await?;
                Ok(Ok(found))
            }
            _ => Ok(Err(Response::error(401, INCORRECT))),
        }
    }

    async fn sign_in(&mut self) -> io::Result<Response> {
        let request: SignIn = match body(self.req) {
            Ok(request) => request,
            Err(response) => return Ok(response),
        };
        // A name no account could have is checked like an unknown one.
        let name = account_name(&request.name).unwrap_or_else(|| "-".into());
        let (id, user) = match self.check(&name, &request.password).await? {
            Ok(found) => found,
            Err(response) => return Ok(response),
        };
        let adopt = self.adoptable(&id, &user).await?;
        let account = Account {
            id,
            name: user.name,
            full_name: user.full_name,
            guest: false,
            generation: user.generation,
        };
        self.open(200, Some(account), adopt).await
    }

    async fn guest(&mut self) -> io::Result<Response> {
        let id = format!("g-{}", crate::crypto::random_token(16)?);
        let expires = self.now_ms + session::GUEST_MAX_AGE_SECONDS * 1000;
        let user = UserRecord {
            name: "guest".into(),
            full_name: "Guest User".into(),
            hash: None,
            created_ms: self.now_ms,
            guest: true,
            adopted: true,
            generation: 0,
        };
        self.store
            .put(guest_key(expires, &id).as_bytes(), b"{}")
            .await?;
        self.store
            .put_expiring(
                format!("{USERS_PREFIX}{id}").as_bytes(),
                &to_vec(&user)?,
                expires,
            )
            .await?;
        let account = Account {
            id,
            name: user.name,
            full_name: user.full_name,
            guest: true,
            generation: 0,
        };
        self.open(201, Some(account), None).await
    }

    async fn sign_out(&mut self) -> io::Result<Response> {
        let guest = self
            .session
            .account
            .as_ref()
            .filter(|a| a.guest)
            .map(|a| a.id.clone());
        if let Some(id) = &guest {
            // The guest stays in the cleanup index until the purge has found
            // nothing left of it: its entry is moved to end a grace period
            // from now (written before the old one goes), so a request
            // already under way when the session ends, which may still write,
            // is cleaned up too.
            let old = guest_key(self.session.expires_ms, id);
            let ended = guest_key(self.now_ms + GUEST_GRACE_MS, id);
            self.store.put(ended.as_bytes(), b"{}").await?;
            if old != ended {
                self.store.delete(old.as_bytes()).await?;
            }
        }
        // End the session first: from here on no request reaches the guest.
        let response = self.open(200, None, None).await?;
        if let Some(id) = &guest {
            // Every key in a guest's own space expires with the guest
            // (`Storage::user_data_expires`), so the store deletes whatever
            // this log-out and the purge do not reach, late writes included.
            // What the guest added to a space everyone shares (a message in
            // the Messages room, a Chess game) belongs to that shared space
            // and stays, as anyone's does.
            // Its data goes now, as much as one request deletes; the purge
            // deletes whatever is left, or written late, and then its records.
            // The session has ended either way: a failure here leaves the
            // cleanup to the purge and still hands the browser its new cookie.
            if let Err(error) = wipe(&mut *self.store, id, GUEST_CLEANUP_OPS).await {
                ferrite_app::tracing::warn!(%error, "guest data left to the purge");
            }
        }
        Ok(response)
    }

    async fn lock(&mut self, lock: bool, password: Option<String>) -> io::Result<Response> {
        let Some(account) = self.session.account.clone() else {
            return Ok(Response::error(409, "nobody is signed in"));
        };
        if account.guest {
            return Ok(Response::error(
                409,
                "Guest User has no password to unlock with",
            ));
        }
        if !lock {
            let password = password.unwrap_or_default();
            match self.check(&account.name, &password).await? {
                Ok((id, _)) if id == account.id => {}
                Ok(_) => return Ok(Response::error(401, INCORRECT)),
                Err(response) => return Ok(response),
            }
        }
        match session::update(self.store, self.session, |session| session.locked = lock).await? {
            Some(session) => Ok(Response::json(200, &describe(self.ctx, &session))),
            None => Ok(Response::error(409, "this session has ended")),
        }
    }

    /// A new password for the signed-in account, given the current one. The
    /// password is what someone changes when another browser should no longer
    /// be theirs, so it raises the account's generation in the same write,
    /// which ends every session signed in under the old one, including a
    /// sign-in still under way. This session then takes the new generation and
    /// goes on; should that step fail, it has to sign in again.
    async fn change_password(&mut self) -> io::Result<Response> {
        let request: ChangePassword = match body(self.req) {
            Ok(request) => request,
            Err(response) => return Ok(response),
        };
        let Some(account) = self.session.account.clone() else {
            return Ok(Response::error(409, "nobody is signed in"));
        };
        if account.guest {
            return Ok(Response::error(409, "Guest User has no password to change"));
        }
        if self.session.locked {
            return Ok(Response::error(423, "the screen is locked"));
        }
        if !password::acceptable(&request.new) {
            return Ok(Response::error(400, "A password is 8 to 1,024 characters."));
        }
        let Some((pepper, iterations)) = self.hashing().await else {
            return Ok(no_pepper());
        };
        let (id, verified) = match self.check(&account.name, &request.current).await? {
            Ok((id, user)) if id == account.id => (id, user),
            Ok(_) => return Ok(Response::error(401, INCORRECT)),
            Err(response) => return Ok(response),
        };
        // The record the current password was checked against, unchanged, or no write: of two
        // changes at once one wins, and the other must ask again with the password now in force.
        const CHANGED: &str = "The password was just changed elsewhere. Try again.";
        let key = format!("{USERS_PREFIX}{id}");
        let Some((bytes, version)) = self.store.get_versioned(key.as_bytes()).await? else {
            return Ok(Response::error(409, CHANGED));
        };
        let mut user: UserRecord = serde_json::from_slice(&bytes)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;
        if user.hash != verified.hash || user.generation != verified.generation {
            return Ok(Response::error(409, CHANGED));
        }
        user.hash = Some(password::hash(&pepper, &request.new, iterations)?);
        user.generation += 1;
        let generation = user.generation;
        let written = self
            .store
            .put_if_version(key.as_bytes(), &to_vec(&user)?, Some(version))
            .await?;
        if written.is_err() {
            return Ok(Response::error(409, CHANGED));
        }
        let current = session::update(self.store, self.session, |session| {
            if let Some(account) = session.account.as_mut() {
                account.generation = generation;
            }
        })
        .await?
        .unwrap_or_else(|| self.session.clone());
        Ok(Response::json(200, &describe(self.ctx, &current)))
    }

    /// Forget this session's offer to move earlier data, answering what a
    /// `GET` would with `done`, `moved` and, when refused, `error`.
    async fn end_offer(
        &mut self,
        status: u16,
        moved: usize,
        error: Option<&str>,
    ) -> io::Result<Response> {
        let session = session::update(self.store, self.session, |session| {
            session.adopt_from = None
        })
        .await?
        .unwrap_or_else(|| self.session.clone());
        let mut body = describe(self.ctx, &session);
        if let Some(object) = body.as_object_mut() {
            object.insert("done".into(), true.into());
            object.insert("moved".into(), moved.into());
            if let Some(error) = error {
                object.insert("error".into(), error.into());
            }
        }
        Ok(Response::json(status, &body))
    }

    async fn adopt(&mut self) -> io::Result<Response> {
        let request: Adopt = match body(self.req) {
            Ok(request) => request,
            Err(response) => return Ok(response),
        };
        let (Some(account), Some(from)) = (
            self.session.account.clone(),
            self.session
                .adopt_offered()
                .then(|| self.session.adopt_from.clone())
                .flatten(),
        ) else {
            return Ok(Response::error(
                409,
                "there is no earlier data to move into this account",
            ));
        };
        if self.session.locked {
            return Ok(Response::error(423, "the screen is locked"));
        }
        const DECIDED: &str = "this account already answered for another browser's data";
        let user_key = format!("{USERS_PREFIX}{}", account.id);
        let user: Option<UserRecord> = get_json(self.store, &user_key).await?;
        if user.as_ref().is_none_or(|user| user.adopted) {
            return self.end_offer(409, 0, Some(DECIDED)).await;
        }
        // The account's one answer is claimed before any key moves, with the
        // answer itself: the first browser to answer binds its anonymous
        // session and its Keep or Don't Keep to the account, and an offer made
        // to another browser meanwhile is refused. Every later step, in this
        // session or in a later one after this was cut short, carries on with
        // the claimed answer, whatever the request says.
        let claim_key = format!("{MIGRATIONS_PREFIX}{}", account.id);
        let mut claim: Option<Migration> = get_json(self.store, &claim_key).await?;
        if claim.is_none() {
            let answer = Migration {
                from: from.clone(),
                keep: request.keep,
                done: false,
                // This session began at the sign-in that ended `from`.
                settle_ms: self.session.created_ms + SETTLE_MS,
            };
            let written = self
                .store
                .put_if_version(claim_key.as_bytes(), &to_vec(&answer)?, None)
                .await?;
            claim = if written.is_ok() {
                Some(answer)
            } else {
                get_json(self.store, &claim_key).await?
            };
        }
        let Some(mut claim) = claim.filter(|claim| claim.from == from) else {
            return self.end_offer(409, 0, Some(DECIDED)).await;
        };
        // A request the anonymous session sent before the sign-in may still
        // be writing to it until `settle_ms`: nothing moves before then, so
        // no late write or update can land behind the move. After it the
        // session is ended and nothing writes there any more; the page asks
        // again after `wait_ms`.
        let wait_ms = if claim.keep && !claim.done {
            claim.settle_ms.saturating_sub(self.now_ms)
        } else {
            0
        };
        let (done, moved) = if wait_ms > 0 {
            (false, 0)
        } else if claim.keep && !claim.done {
            move_data(self.store, &from, &account.id, STEP_KEYS).await?
        } else {
            (true, 0)
        };
        if !done {
            let mut body = describe(self.ctx, self.session);
            if let Some(object) = body.as_object_mut() {
                object.insert("done".into(), false.into());
                object.insert("moved".into(), moved.into());
                object.insert("wait_ms".into(), wait_ms.into());
            }
            return Ok(Response::json(200, &body));
        }
        claim.done = true;
        self.store
            .put(claim_key.as_bytes(), &to_vec(&claim)?)
            .await?;
        // Answered once: the account is not asked again from any browser.
        for _ in 0..8 {
            let Some((bytes, version)) = self.store.get_versioned(user_key.as_bytes()).await?
            else {
                break;
            };
            let mut user: UserRecord = serde_json::from_slice(&bytes)
                .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;
            user.adopted = true;
            let written = self
                .store
                .put_if_version(user_key.as_bytes(), &to_vec(&user)?, Some(version))
                .await?;
            if written.is_ok() {
                break;
            }
        }
        self.end_offer(200, moved, None).await
    }
}

fn guest_key(expires_ms: u64, id: &str) -> String {
    format!("{GUESTS_PREFIX}{expires_ms:016}/{id}")
}

/// The key prefix of `principal`'s data in `module`.
fn space(module: &str, principal: &str) -> String {
    format!("apps/{module}/users/{principal}/")
}

/// Whether `principal` keeps anything in any module.
pub async fn has_data(store: &mut StoreClusterClient, principal: &str) -> io::Result<bool> {
    for module in crate::apps::MODULES {
        let (rows, _) = store
            .scan_prefix(space(module.name, principal).as_bytes(), None, 1)
            .await?;
        if !rows.is_empty() {
            return Ok(true);
        }
    }
    Ok(false)
}

/// Move up to `budget` of `from`'s keys in every module to `to`, keeping any
/// key `to` already has (an account's own data wins), and deleting each moved
/// source key. Whether everything has moved, and how many keys moved. Run
/// again, it carries on where it stopped.
pub async fn move_data(
    store: &mut StoreClusterClient,
    from: &str,
    to: &str,
    mut budget: usize,
) -> io::Result<(bool, usize)> {
    let mut moved = 0;
    for module in crate::apps::MODULES {
        let source = space(module.name, from);
        let target = space(module.name, to);
        loop {
            if budget == 0 {
                return Ok((false, moved));
            }
            let page = crate::module::scan_page(budget, 0).max(1);
            let (rows, more) = store.scan_prefix(source.as_bytes(), None, page).await?;
            for (key, value, _) in &rows {
                let mut destination = target.clone().into_bytes();
                destination.extend_from_slice(&key[source.len().min(key.len())..]);
                // Ok(Err(_)): the account already has this key; it wins.
                let _ = store.put_if_version(&destination, value, None).await?;
                store.delete(key).await?;
                moved += 1;
                budget -= 1;
            }
            if rows.is_empty() || !more {
                break;
            }
        }
    }
    Ok((true, moved))
}

/// Delete a bounded part of a guest's data immediately at sign-out. The expiry
/// index deliberately starts a fresh pass after the grace period, catching writes
/// from requests already in flight. The budget counts scans as well as deletes.
pub async fn wipe<'a>(
    store: impl IntoStore<'a>,
    principal: &str,
    budget: usize,
) -> io::Result<(bool, usize)> {
    let mut store = store.into_store();
    let (next, deleted) = wipe_step(&mut store, principal, 0, budget).await?;
    Ok((next == crate::apps::MODULES.len(), deleted))
}

async fn wipe_step(
    store: &mut crate::store::Store<'_>,
    principal: &str,
    mut next: usize,
    mut operations: usize,
) -> io::Result<(usize, usize)> {
    let mut deleted = 0;
    while next < crate::apps::MODULES.len() && operations >= 2 {
        let prefix = space(crate::apps::MODULES[next].name, principal);
        // Reserve one call for the scan and one for every row it could return.
        let page = crate::module::scan_page(operations - 1, 0).max(1);
        let (rows, more) = store.scan_prefix(prefix.as_bytes(), None, page).await?;
        operations -= 1;
        for (key, _, _) in &rows {
            store.delete(key).await?;
            operations -= 1;
            deleted += 1;
        }
        if !more {
            next += 1;
        }
    }
    Ok((next, deleted))
}

#[derive(Default, serde::Serialize, serde::Deserialize)]
#[serde(crate = "ferrite_app::serde", default)]
struct GuestCleanup {
    // A module name survives additions/reordering between app deployments.
    module: Option<String>,
}

/// Resume one expired guest's cleanup. Every storage call, including scanning an
/// empty module and saving progress, fits within `budget`. Legacy `{}` entries
/// start at the first module. Concurrent replicas may repeat deletes, but a stale
/// cursor cannot overwrite newer progress or recreate a completed index entry.
pub async fn purge_guests<'a>(
    store: impl IntoStore<'a>,
    now_ms: u64,
    budget: usize,
) -> io::Result<()> {
    if budget < 5 {
        return Ok(());
    }
    let mut store = store.into_store();
    let (rows, _) = store.scan_prefix(GUESTS_PREFIX.as_bytes(), None, 1).await?;
    let Some((key, value, version)) = rows.into_iter().next() else {
        return Ok(());
    };
    let text = String::from_utf8_lossy(&key);
    let Some((expires, id)) = text
        .strip_prefix(GUESTS_PREFIX)
        .and_then(|rest| rest.split_once('/'))
    else {
        store.delete(&key).await?;
        return Ok(());
    };
    if expires.parse::<u64>().is_ok_and(|expires| expires > now_ms) {
        return Ok(());
    }
    // Only the single opaque guest ID can become a private namespace prefix.
    if !id.starts_with("g-") || id.contains('/') {
        store.delete(&key).await?;
        return Ok(());
    }
    let progress: GuestCleanup = serde_json::from_slice(&value).unwrap_or_default();
    let next = progress
        .module
        .as_deref()
        .and_then(|name| {
            crate::apps::MODULES
                .iter()
                .position(|module| module.name == name)
        })
        .unwrap_or(0);
    // One index scan plus at most two final record deletes; a cursor CAS needs one.
    let (next, _) = wipe_step(&mut store, id, next, budget - 3).await?;
    if next == crate::apps::MODULES.len() {
        store
            .delete(format!("{USERS_PREFIX}{id}").as_bytes())
            .await?;
        store.delete(&key).await?;
    } else {
        let progress = GuestCleanup {
            module: Some(crate::apps::MODULES[next].name.to_string()),
        };
        let _ = store
            .put_if_version(&key, &to_vec(&progress)?, Some(version))
            .await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn account_names_are_plain_and_lower_case() {
        assert_eq!(account_name(" Chris ").as_deref(), Some("chris"));
        assert_eq!(
            account_name("martin.k_2-x").as_deref(),
            Some("martin.k_2-x")
        );
        for bad in [
            "",
            "2chris",
            "chris carter",
            "chris/../x",
            "chrís",
            &"a".repeat(33),
        ] {
            assert_eq!(account_name(bad), None, "{bad}");
        }
    }

    #[test]
    fn full_names_are_short_and_printable() {
        assert_eq!(full_name("  Martin Kühl ").as_deref(), Some("Martin Kühl"));
        assert_eq!(full_name(""), None);
        assert_eq!(full_name("a\u{7}b"), None);
        assert_eq!(full_name(&"é".repeat(65)), None);
    }

    #[test]
    fn the_signup_secret_opens_closes_or_asks_for_a_code() {
        assert_eq!(Signup::from_secret(None), Signup::Open);
        assert_eq!(Signup::from_secret(Some("open")), Signup::Open);
        assert_eq!(Signup::from_secret(Some("closed")), Signup::Closed);
        assert_eq!(
            Signup::from_secret(Some("invite:tidepool42")),
            Signup::Invite("tidepool42".into())
        );
        assert_eq!(
            Signup::from_secret(Some("invite:short")),
            Signup::Closed,
            "a guessable code closes sign-up instead"
        );
        assert_eq!(Signup::from_secret(Some("invite")), Signup::Closed);
        assert_eq!(Signup::from_secret(Some("anything")), Signup::Closed);
    }
}

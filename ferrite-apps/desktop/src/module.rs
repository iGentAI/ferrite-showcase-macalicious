//! The seam every app module plugs into.
//!
//! An app module is one [`AppModule`] value: a name, which is its URL segment
//! (`/api/<name>/...`) and its storage namespace, a title, and a handler. The
//! router resolves the session, builds an [`ApiCtx`] and awaits the handler;
//! everything the handler needs arrives in that context:
//!
//! * [`ApiCtx::request`]: method, the path below `/api/<name>`, query, body,
//!   forwarded headers and the gateway's idempotency key;
//! * [`ApiCtx::session`]: the browser's session, and the account signed in to
//!   it (`src/accounts/`);
//! * [`ApiCtx::storage`]: keys in the `data` store under `apps/<name>/`, split
//!   into the signed-in person's own space ([`Storage::user`]) and one shared
//!   by everyone ([`Storage::shared`]);
//! * [`ApiCtx::ctx`]: the application's [`AppContext`], for anything else;
//! * [`ApiCtx::now_ms`]: the platform clock.
//!
//! See `src/apps/calculator/mod.rs` for a complete module and README.md,
//! "Adding an app module", for the steps.

use std::future::Future;
use std::io;
use std::pin::Pin;

use ferrite_app::serde::de::DeserializeOwned;
use ferrite_app::serde::Serialize;
use ferrite_app::{serde_json, AppContext, IngressRequest};

use crate::http::Response;
use crate::session::Session;
use crate::store::{IntoStore, Store};

/// The future a handler returns.
pub type HandlerFuture<'a> = Pin<Box<dyn Future<Output = Response> + Send + 'a>>;

/// A module's request handler.
pub type Handler = for<'a> fn(ApiCtx<'a>) -> HandlerFuture<'a>;

/// One app's server half.
pub struct AppModule {
    /// The URL segment and storage namespace: lowercase letters, digits and
    /// `-`, matching the demo folder name (`demos/<name>`).
    pub name: &'static str,
    /// The app's display name.
    pub title: &'static str,
    /// Answers every request under `/api/<name>/`.
    pub handle: Handler,
}

/// Everything one request hands a module.
pub struct ApiCtx<'a> {
    pub request: Request<'a>,
    pub session: &'a Session,
    pub storage: Storage<'a>,
    pub ctx: &'a AppContext,
    pub now_ms: u64,
}

impl ApiCtx<'_> {
    /// Write an entry to the desktop application's log (`src/applog.rs`),
    /// which Console shows, under the module's name. The log is shared by
    /// every session: write no session id and nothing the person typed. A
    /// failed write is traced and otherwise ignored, so logging never fails
    /// a request.
    pub async fn log(&mut self, level: crate::applog::Level, category: &str, message: &str) {
        let (now_ms, app) = (self.now_ms, self.storage.app);
        if let Err(error) = crate::applog::append(
            &mut self.storage.store,
            now_ms,
            level,
            app,
            category,
            message,
        )
        .await
        {
            ferrite_app::tracing::warn!(%error, app, "could not write to the desktop log");
        }
    }
}

/// The request as a module sees it.
pub struct Request<'a> {
    /// The HTTP method.
    pub method: &'a str,
    /// The path below `/api/<name>`, starting with `/` (`/` for the module root).
    pub path: &'a str,
    /// The query string without `?` (empty when absent).
    pub query: &'a str,
    /// The request body (the gateway caps it at 256 KiB).
    pub body: &'a [u8],
    /// The browser's own `idempotency-key` header (forwarded by the `/api/`
    /// route), when it sent a well-formed one: 1 to 128 visible ASCII
    /// characters, such as `crypto.randomUUID()`. A module deduplicates a
    /// write only by this key. A request without one is simply processed:
    /// there is deliberately no fallback to the gateway's correlation id or
    /// any other server counter, which can repeat after a restart.
    pub idempotency_key: Option<&'a str>,
    /// The gateway's request, or `None` for a request the desktop makes of a
    /// module itself on the signed-in person's behalf ([`Request::internal`]).
    raw: Option<&'a IngressRequest>,
}

impl<'a> Request<'a> {
    pub(crate) fn new(raw: &'a IngressRequest, path: &'a str, query: &'a str) -> Self {
        Request {
            method: raw.method.as_str(),
            path,
            query,
            body: &raw.body,
            idempotency_key: crate::http::header(raw, "idempotency-key").filter(|key| {
                (1..=128).contains(&key.len()) && key.bytes().all(|b| b.is_ascii_graphic())
            }),
            raw: Some(raw),
        }
    }

    /// A request one of the desktop's own modules makes of another for the
    /// person behind the current request (Script Editor, Automator and Siri
    /// acting through the apps' own routes). It carries no headers: no
    /// cookie, nothing forwarded.
    pub(crate) fn internal(
        method: &'a str,
        path: &'a str,
        query: &'a str,
        body: &'a [u8],
        idempotency_key: Option<&'a str>,
    ) -> Self {
        Request {
            method,
            path,
            query,
            body,
            idempotency_key,
            raw: None,
        }
    }

    /// A forwarded header (only those `ferrite.json` lists for `/api/` arrive).
    pub fn header(&self, name: &str) -> Option<&'a str> {
        self.raw.and_then(|raw| crate::http::header(raw, name))
    }

    /// The value of query parameter `name`, undecoded.
    pub fn query_param(&self, name: &str) -> Option<&'a str> {
        self.query
            .split('&')
            .filter_map(|pair| pair.split_once('=').or(Some((pair, ""))))
            .find(|(n, _)| *n == name)
            .map(|(_, v)| v)
    }

    /// The body as JSON, or a 400 response saying why it is not.
    pub fn json<T: DeserializeOwned>(&self) -> Result<T, Response> {
        serde_json::from_slice(self.body)
            .map_err(|e| Response::error(400, &format!("the body is not the expected JSON: {e}")))
    }
}

/// A module's keys in the `data` store.
pub struct Storage<'a> {
    store: Store<'a>,
    app: &'static str,
    principal: &'a str,
    /// When every key written to the person's own space expires (epoch ms),
    /// or 0 for never: a Guest User's data goes when the guest's time ends.
    user_expires_ms: u64,
    writes: WriteIds,
}

/// The id a request gave its write, and the ids of the writes the documents it
/// read or was refused by hold (`crate::apps::document`). The router takes the
/// first from the request and names the second in the reply (`WRITE_HEADER`,
/// `WRITES_HEADER`), so no module handles either.
#[derive(Clone, Default)]
pub struct WriteIds {
    this: Option<String>,
    heard: std::sync::Arc<std::sync::Mutex<Option<(u64, Vec<String>)>>>,
}

impl WriteIds {
    /// The ids of a request that names its write as `this`; a value that is not
    /// a short id of the page's counts as no name.
    pub(crate) fn new(this: Option<&str>) -> Self {
        let valid = |id: &&str| {
            (1..=WRITE_ID_MAX_BYTES).contains(&id.len())
                && id
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
        };
        WriteIds {
            this: this.filter(valid).map(str::to_owned),
            heard: Default::default(),
        }
    }

    pub(crate) fn this(&self) -> Option<&str> {
        self.this.as_deref()
    }

    /// A document holds `ids`, a list complete for the writes after revision
    /// `from`. Of several documents, the latest `from` says what holds of them all.
    pub(crate) fn heard(&self, ids: &[String], from: u64) {
        let mut heard = self
            .heard
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let (latest, all) = heard.get_or_insert_with(|| (from, Vec::new()));
        *latest = from.max(*latest);
        for id in ids {
            if all.len() < WRITES_NAMED_MAX && !all.contains(id) {
                all.push(id.clone());
            }
        }
    }

    /// The value of the reply's `WRITES_HEADER`, when a document was read for a
    /// request that named itself. A request that names nothing (an earlier page,
    /// or a carrier that dropped the header) is told nothing: "holds no such write"
    /// would be a claim about a write the server was never told the name of.
    pub(crate) fn reply_value(&self) -> Option<String> {
        self.this.as_ref()?;
        let heard = self
            .heard
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        heard
            .as_ref()
            .map(|(from, ids)| format!("{from}:{}", ids.join(",")))
    }
}

/// The request header in which the page names a save, or itself on a read.
pub const WRITE_HEADER: &str = "x-macalicious-write";
/// The reply header naming, to a page that named itself, whose data the request
/// reached (`Session::principal`): what keeps a browser's journal of unsent
/// changes (`demos/desktop/synced-document.ts`) to the person who typed them. On a
/// request, it binds a save to that person: the router refuses it for anyone else.
pub const PERSON_HEADER: &str = "x-macalicious-person";
/// The reply header naming the writes a document holds, as `<from>:<ids>`: the
/// revision after which the list is complete, and the ids, comma separated.
/// Absent when the route keeps no such list.
pub const WRITES_HEADER: &str = "x-macalicious-writes";
const WRITE_ID_MAX_BYTES: usize = 64;
/// The most ids one reply names, whatever number of documents the route read.
const WRITES_NAMED_MAX: usize = 64;

impl<'a> Storage<'a> {
    /// `principal` is whose data the request reaches
    /// ([`crate::session::Session::principal`]): the signed-in account, or
    /// the anonymous browser session. `store` is the plain client or a
    /// request's counted handle (`crate::store`): every call made through
    /// this storage is counted with that handle's calls.
    pub(crate) fn new(store: impl IntoStore<'a>, app: &'static str, principal: &'a str) -> Self {
        Storage {
            store: store.into_store(),
            app,
            principal,
            user_expires_ms: 0,
            writes: WriteIds::default(),
        }
    }

    /// What the router heard of the request's write, shared with its documents.
    pub(crate) fn with_write_ids(mut self, writes: WriteIds) -> Self {
        self.writes = writes;
        self
    }

    /// Stamp every write to [`Storage::user`] with the expiry `expires_ms`
    /// (epoch ms; `None` for none). The router sets it for a Guest User
    /// ([`crate::session::Session::guest_expires_ms`]), so the store itself
    /// deletes a guest's data when the guest's time ends, whatever a log-out
    /// or the purge managed to delete, and whatever was written late.
    pub(crate) fn user_data_expires(mut self, expires_ms: Option<u64>) -> Self {
        self.user_expires_ms = expires_ms.unwrap_or(0);
        self
    }

    /// The signed-in person's own keys: `apps/<name>/users/<principal>/`,
    /// where the principal is the account id (or, before anyone signs in, the
    /// browser's session id). Nobody else's request reaches them.
    pub fn user(&mut self) -> Space<'_> {
        let prefix = format!("apps/{}/users/{}/", self.app, self.principal);
        Space {
            store: self.store.reborrow(),
            prefix,
            expires_ms: self.user_expires_ms,
            writes: self.writes.clone(),
        }
    }

    /// Keys every session of this app shares: `apps/<name>/shared/`. They
    /// belong to everyone (a Messages room, a Chess game, a feed kept for all
    /// readers), not to the person whose request wrote them, so they carry no
    /// guest's expiry and stay when a guest's own space goes.
    pub fn shared(&mut self) -> Space<'_> {
        let prefix = format!("apps/{}/shared/", self.app);
        Space {
            store: self.store.reborrow(),
            prefix,
            expires_ms: 0,
            writes: self.writes.clone(),
        }
    }

    /// The whole `data` store, outside the module's namespace: only for the
    /// desktop's own modules that report on the application (Console, Activity
    /// Monitor, About This Mac, System Information), for those that read the
    /// person's own documents of other modules (Spotlight, Storage
    /// Management), and for the shared helpers (accounts, notifications). An
    /// app module keeps to [`Storage::user`] and [`Storage::shared`]. Its calls
    /// are counted as the module's.
    pub(crate) fn store(&mut self) -> &mut Store<'a> {
        &mut self.store
    }
}

/// One key space. Keys are relative to the space; they must be 1 to 512
/// bytes with no NUL. Listings come back in key order.
pub struct Space<'s> {
    store: Store<'s>,
    prefix: String,
    /// The expiry every write here carries (epoch ms), or 0 for none.
    expires_ms: u64,
    writes: WriteIds,
}

/// The expiry a write asking for `asked` gets in a space whose writes all
/// expire at `space` (either 0 for none): the earlier of the two.
fn capped_expiry(asked: u64, space: u64) -> u64 {
    match (asked, space) {
        (0, space) => space,
        (asked, 0) => asked,
        (asked, space) => asked.min(space),
    }
}

impl Space<'_> {
    pub(crate) fn write_ids(&self) -> &WriteIds {
        &self.writes
    }

    fn key(&self, key: &str) -> io::Result<Vec<u8>> {
        if key.is_empty() || key.len() > 512 || key.contains('\0') {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                format!("storage key {key:?} must be 1 to 512 bytes without NUL"),
            ));
        }
        Ok(format!("{}{key}", self.prefix).into_bytes())
    }

    pub async fn get(&mut self, key: &str) -> io::Result<Option<Vec<u8>>> {
        let key = self.key(key)?;
        self.store.get(&key).await
    }

    pub async fn put(&mut self, key: &str, value: &[u8]) -> io::Result<()> {
        let key = self.key(key)?;
        if self.expires_ms == 0 {
            self.store.put(&key, value).await.map(|_| ())
        } else {
            self.store
                .put_expiring(&key, value, self.expires_ms)
                .await
                .map(|_| ())
        }
    }

    /// Write a value that disappears at `expires_at_ms` (epoch ms).
    pub async fn put_expiring(
        &mut self,
        key: &str,
        value: &[u8],
        expires_at_ms: u64,
    ) -> io::Result<()> {
        let key = self.key(key)?;
        let expires_at_ms = capped_expiry(expires_at_ms, self.expires_ms);
        self.store
            .put_expiring(&key, value, expires_at_ms)
            .await
            .map(|_| ())
    }

    pub async fn delete(&mut self, key: &str) -> io::Result<()> {
        let key = self.key(key)?;
        self.store.delete(&key).await.map(|_| ())
    }

    /// The value and its version, for compare-and-set.
    pub async fn get_versioned(&mut self, key: &str) -> io::Result<Option<(Vec<u8>, u64)>> {
        let key = self.key(key)?;
        self.store.get_versioned(&key).await
    }

    /// The values of `keys`, in their order (`None` for one that is absent),
    /// read in one call for each [`GET_MANY_CHUNK`] keys.
    pub async fn get_many(&mut self, keys: &[String]) -> io::Result<Vec<Option<Vec<u8>>>> {
        let mut out = Vec::with_capacity(keys.len());
        for chunk in keys.chunks(GET_MANY_CHUNK) {
            let full = chunk
                .iter()
                .map(|key| self.key(key))
                .collect::<io::Result<Vec<_>>>()?;
            out.extend(
                self.store
                    .multi_get(&full)
                    .await?
                    .into_iter()
                    .map(|(value, _)| value),
            );
        }
        Ok(out)
    }

    /// Write only if the key is still at `expected` (`None`: only if absent).
    /// `Ok(false)` when another writer got there first.
    pub async fn put_if_version(
        &mut self,
        key: &str,
        value: &[u8],
        expected: Option<u64>,
    ) -> io::Result<bool> {
        let key = self.key(key)?;
        // An expiry of 0 is none: exactly `put_if_version`.
        Ok(self
            .store
            .put_if_version_expiring(&key, value, expected, self.expires_ms)
            .await?
            .is_ok())
    }

    /// [`Space::put_if_version`] for a value that disappears at
    /// `expires_at_ms` (epoch ms), or earlier when the space's own writes
    /// expire sooner. `Ok(false)` when another writer got there first.
    pub async fn put_if_version_expiring(
        &mut self,
        key: &str,
        value: &[u8],
        expected: Option<u64>,
        expires_at_ms: u64,
    ) -> io::Result<bool> {
        let key = self.key(key)?;
        let expires_at_ms = capped_expiry(expires_at_ms, self.expires_ms);
        Ok(self
            .store
            .put_if_version_expiring(&key, value, expected, expires_at_ms)
            .await?
            .is_ok())
    }

    /// Create the key only if it is absent, expiring at `expires_at_ms`: the
    /// claim primitive. `Ok(false)` when it already exists.
    pub async fn create_expiring(
        &mut self,
        key: &str,
        value: &[u8],
        expires_at_ms: u64,
    ) -> io::Result<bool> {
        let key = self.key(key)?;
        let expires_at_ms = capped_expiry(expires_at_ms, self.expires_ms);
        Ok(self
            .store
            .put_if_version_expiring(&key, value, None, expires_at_ms)
            .await?
            .is_ok())
    }

    pub async fn get_json<T: DeserializeOwned>(&mut self, key: &str) -> io::Result<Option<T>> {
        match self.get(key).await? {
            Some(bytes) => serde_json::from_slice(&bytes)
                .map(Some)
                .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string())),
            None => Ok(None),
        }
    }

    pub async fn put_json<T: Serialize + ?Sized>(
        &mut self,
        key: &str,
        value: &T,
    ) -> io::Result<()> {
        let bytes = serde_json::to_vec(value)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;
        self.put(key, &bytes).await
    }

    /// Up to `limit` entries whose keys start with `prefix` (may be empty),
    /// in key order, as `(key relative to the space, value)`.
    pub async fn list(&mut self, prefix: &str, limit: usize) -> io::Result<Vec<(String, Vec<u8>)>> {
        let full = format!("{}{prefix}", self.prefix).into_bytes();
        let mut out = Vec::new();
        let mut after: Option<Vec<u8>> = None;
        let mut pages_read = 0;
        while out.len() < limit {
            let page = scan_page(limit - out.len(), pages_read);
            pages_read += 1;
            let (entries, more) = self
                .store
                .scan_prefix(&full, after.as_deref(), page)
                .await?;
            for (key, value, _version) in entries {
                let relative =
                    String::from_utf8_lossy(&key[self.prefix.len().min(key.len())..]).into_owned();
                after = Some(key);
                out.push((relative, value));
            }
            if !more || after.is_none() {
                break;
            }
        }
        out.truncate(limit);
        Ok(out)
    }

    /// One page of up to `limit` entries whose keys start with `prefix`, after
    /// the key `after` (relative to the space), and whether more follow.
    pub async fn list_after(
        &mut self,
        prefix: &str,
        after: Option<&str>,
        limit: u32,
    ) -> io::Result<(Vec<(String, Vec<u8>)>, bool)> {
        let full = format!("{}{prefix}", self.prefix).into_bytes();
        let start = after.map(|key| format!("{}{key}", self.prefix).into_bytes());
        let (entries, more) = self
            .store
            .scan_prefix(&full, start.as_deref(), limit)
            .await?;
        let page = entries
            .into_iter()
            .map(|(key, value, _version)| {
                let relative =
                    String::from_utf8_lossy(&key[self.prefix.len().min(key.len())..]).into_owned();
                (relative, value)
            })
            .collect();
        Ok((page, more))
    }
}

/// The most keys one call of [`Space::get_many`] reads.
pub const GET_MANY_CHUNK: usize = 64;

/// The first page a listing asks `scan_prefix` for, and the largest.
const FIRST_SCAN_PAGE: u32 = 32;
const MAX_SCAN_PAGE: u32 = 1024;

/// The page to ask for after `pages_read` pages, with `remaining` entries
/// still wanted. Ferrite Cloud charges a scan the page it asks for (its
/// `limit`, clamped at 1024 request units), not the rows it returns, against
/// the `data` binding's rate, which every session shares. So a listing starts
/// small and doubles: a short list costs about what it returns, and a long one
/// at most about twice its length.
pub(crate) fn scan_page(remaining: usize, pages_read: u32) -> u32 {
    let grown = FIRST_SCAN_PAGE << pages_read.min(MAX_SCAN_PAGE.ilog2() - FIRST_SCAN_PAGE.ilog2());
    u32::try_from(remaining).unwrap_or(u32::MAX).min(grown)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The request units a listing of `rows` entries (with no limit) asks for.
    fn units_for(rows: usize) -> u64 {
        let (mut read, mut pages_read, mut units) = (0usize, 0, 0u64);
        loop {
            let page = scan_page(usize::MAX - read, pages_read);
            pages_read += 1;
            units += u64::from(page);
            let got = (rows - read).min(page as usize);
            read += got;
            // The store says `more` only when it stopped at the page.
            if got < page as usize {
                return units;
            }
        }
    }

    #[test]
    fn scan_pages_start_small_double_and_stop_at_the_platform_clamp() {
        let pages: Vec<u32> = (0..8).map(|n| scan_page(usize::MAX, n)).collect();
        assert_eq!(pages, [32, 64, 128, 256, 512, 1024, 1024, 1024]);
        assert_eq!(
            scan_page(10, 4),
            10,
            "never more than the entries still wanted"
        );
        assert_eq!(scan_page(0, 0), 0);
    }

    #[test]
    fn a_guest_space_never_writes_past_the_guest_s_time() {
        assert_eq!(capped_expiry(0, 0), 0, "no expiry asked and none set");
        assert_eq!(capped_expiry(0, 50), 50, "a guest's plain write expires");
        assert_eq!(capped_expiry(70, 0), 70);
        assert_eq!(capped_expiry(70, 50), 50, "never outlives the guest");
        assert_eq!(capped_expiry(30, 50), 30, "an earlier expiry stands");
    }

    #[test]
    fn a_listing_costs_about_what_it_returns() {
        // An empty or one-entry Calculator tape used to cost a full 1024-unit
        // page; Ferrite Cloud refused the third such read in a row.
        assert_eq!(units_for(0), 32);
        assert_eq!(units_for(1), 32);
        // A full tape (TAPE_LIMIT is 100).
        assert_eq!(units_for(100), 32 + 64 + 128);
        for rows in [31, 32, 33, 500, 1023, 1024, 5000] {
            assert!(units_for(rows) <= 2 * rows as u64 + 32, "{rows} rows");
        }
    }
}

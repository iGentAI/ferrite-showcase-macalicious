//! The `data` store as the desktop's code calls it, through [`Store`]: each
//! call (a read, a write, an increment, one page of a listing, one batch read)
//! is one call to the store, and a handle made for a module's request
//! ([`Store::counted`]) adds one to its counter for each, so Activity Monitor
//! (`timing.rs`) reports the store calls a request really made.
//!
//! Every helper that touches the store takes `impl IntoStore`: the router
//! passes the plain client (nothing is counted), a module passes the handle it
//! was given (its calls are counted, however many helpers they go through).
//! The handle gives no plain client out, so a call made through it, or through
//! `Storage` or a helper given it, cannot go around the count. A module could
//! still open a client of its own from its `AppContext`, which nothing counts;
//! none does, and none should.

use std::io;
use std::sync::atomic::{AtomicU64, Ordering};

use ferrite_app::client::StoreClusterClient;

/// The store, counting its calls when made for a request.
pub struct Store<'a> {
    client: &'a mut StoreClusterClient,
    calls: Option<&'a AtomicU64>,
}

/// What a helper takes for the store: the plain client, or a [`Store`].
pub trait IntoStore<'a> {
    fn into_store(self) -> Store<'a>;
}

impl<'a> IntoStore<'a> for &'a mut StoreClusterClient {
    fn into_store(self) -> Store<'a> {
        Store {
            client: self,
            calls: None,
        }
    }
}

impl<'a, 'b: 'a> IntoStore<'a> for &'a mut Store<'b> {
    fn into_store(self) -> Store<'a> {
        self.reborrow()
    }
}

impl<'a> IntoStore<'a> for Store<'a> {
    fn into_store(self) -> Store<'a> {
        self
    }
}

/// Adds one call to a counter, when there is one.
fn bump(calls: Option<&AtomicU64>) {
    if let Some(calls) = calls {
        calls.fetch_add(1, Ordering::Relaxed);
    }
}

impl<'a> Store<'a> {
    /// The store for one request, adding each call to `calls`.
    pub fn counted(client: &'a mut StoreClusterClient, calls: &'a AtomicU64) -> Self {
        Store {
            client,
            calls: Some(calls),
        }
    }

    /// The same store, counting into the same counter, for a shorter while.
    pub fn reborrow(&mut self) -> Store<'_> {
        Store {
            client: &mut *self.client,
            calls: self.calls,
        }
    }

    fn call(&self) {
        bump(self.calls);
    }

    pub async fn get(&mut self, key: &[u8]) -> io::Result<Option<Vec<u8>>> {
        self.call();
        self.client.get(key).await
    }

    /// A read that may be up to `max_lag_ms` behind the latest write.
    pub async fn get_within_ms(
        &mut self,
        key: &[u8],
        max_lag_ms: u64,
    ) -> io::Result<Option<Vec<u8>>> {
        self.call();
        self.client.get_within_ms(key, max_lag_ms).await
    }

    /// A read that may be up to `max_lag` versions behind the latest write.
    pub async fn get_within_lag(
        &mut self,
        key: &[u8],
        max_lag: u64,
    ) -> io::Result<Option<Vec<u8>>> {
        self.call();
        self.client.get_within_lag(key, max_lag).await
    }

    pub async fn get_versioned(&mut self, key: &[u8]) -> io::Result<Option<(Vec<u8>, u64)>> {
        self.call();
        self.client.get_versioned(key).await
    }

    pub async fn put(&mut self, key: &[u8], value: &[u8]) -> io::Result<u64> {
        self.call();
        self.client.put(key, value).await
    }

    pub async fn put_expiring(
        &mut self,
        key: &[u8],
        value: &[u8],
        expires_at_ms: u64,
    ) -> io::Result<u64> {
        self.call();
        self.client.put_expiring(key, value, expires_at_ms).await
    }

    pub async fn put_if_version(
        &mut self,
        key: &[u8],
        value: &[u8],
        expected: Option<u64>,
    ) -> io::Result<Result<u64, Option<u64>>> {
        self.call();
        self.client.put_if_version(key, value, expected).await
    }

    pub async fn put_if_version_expiring(
        &mut self,
        key: &[u8],
        value: &[u8],
        expected: Option<u64>,
        expires_at_ms: u64,
    ) -> io::Result<Result<u64, Option<u64>>> {
        self.call();
        self.client
            .put_if_version_expiring(key, value, expected, expires_at_ms)
            .await
    }

    pub async fn delete(&mut self, key: &[u8]) -> io::Result<u64> {
        self.call();
        self.client.delete(key).await
    }

    pub async fn add(&mut self, key: &[u8], delta: i64) -> io::Result<(i64, u64)> {
        self.call();
        self.client.add(key, delta).await
    }

    pub async fn add_expiring(
        &mut self,
        key: &[u8],
        delta: i64,
        expires_at_ms: u64,
    ) -> io::Result<(i64, u64)> {
        self.call();
        self.client.add_expiring(key, delta, expires_at_ms).await
    }

    /// One batch write: one call.
    pub async fn put_batch(&mut self, entries: &[(&[u8], &[u8])]) -> io::Result<Vec<u64>> {
        self.call();
        self.client.put_batch(entries).await
    }

    /// One page of a listing: one call.
    pub async fn scan_prefix(
        &mut self,
        prefix: &[u8],
        start_after: Option<&[u8]>,
        limit: u32,
    ) -> io::Result<(Vec<(Vec<u8>, Vec<u8>, u64)>, bool)> {
        self.call();
        self.client.scan_prefix(prefix, start_after, limit).await
    }

    /// One batch read: one call.
    pub async fn multi_get(
        &mut self,
        keys: &[Vec<u8>],
    ) -> io::Result<Vec<(Option<Vec<u8>>, Option<u64>)>> {
        self.call();
        self.client.multi_get(keys).await
    }
}

/// The two store calls that settle a conditional write: the write, and a read
/// of what its key holds now. [`StoreClusterClient`] is the one the app uses;
/// the tests give a store whose replies they can lose.
pub(crate) trait Conditional {
    async fn put_if_version_expiring(
        &mut self,
        key: &[u8],
        value: &[u8],
        expected: Option<u64>,
        expires_at_ms: u64,
    ) -> io::Result<Result<u64, Option<u64>>>;

    async fn get_versioned(&mut self, key: &[u8]) -> io::Result<Option<(Vec<u8>, u64)>>;
}

impl Conditional for StoreClusterClient {
    async fn put_if_version_expiring(
        &mut self,
        key: &[u8],
        value: &[u8],
        expected: Option<u64>,
        expires_at_ms: u64,
    ) -> io::Result<Result<u64, Option<u64>>> {
        StoreClusterClient::put_if_version_expiring(self, key, value, expected, expires_at_ms)
            .await
    }

    async fn get_versioned(&mut self, key: &[u8]) -> io::Result<Option<(Vec<u8>, u64)>> {
        StoreClusterClient::get_versioned(self, key).await
    }
}

/// How many times a conditional write whose outcome stays unknown is sent
/// before its error stands.
const UNKNOWN_OUTCOME_ATTEMPTS: usize = 3;

/// What a create-if-absent write found at its key.
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Created {
    /// The key holds this write's value.
    Ours,
    /// The key holds another value.
    Taken,
}

/// What a compare-and-set write found at its key.
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Replaced {
    /// The key holds this write's value.
    Ours,
    /// The key changed since `version`, or is gone: another write came first.
    Changed,
}

/// Create `key` holding `value`, expiring at `expires_at_ms` (0: never), when
/// it is absent.
///
/// A write that fails has an unknown outcome: the store answers
/// `SESSION_UNKNOWN` when it no longer knows the write session that carried
/// it, and a lost reply leaves the same doubt. So the key is read back. When it
/// holds `value`, the write applied. When it is empty, the write did not apply
/// (yet) and is sent again, which is safe because a create-if-absent write can
/// only ever apply once. Another value means another write made the key. The
/// error stands only when no attempt settles it, so `value` must be one no
/// other writer could produce (it carries a fresh random id).
pub(crate) async fn create_if_absent(
    store: &mut impl Conditional,
    key: &[u8],
    value: &[u8],
    expires_at_ms: u64,
) -> io::Result<Created> {
    let mut unknown = None;
    for _ in 0..UNKNOWN_OUTCOME_ATTEMPTS {
        match store
            .put_if_version_expiring(key, value, None, expires_at_ms)
            .await
        {
            Ok(Ok(_)) => return Ok(Created::Ours),
            Ok(Err(_)) if unknown.is_none() => return Ok(Created::Taken),
            // Present after an attempt whose reply was lost: that attempt may
            // be what made it.
            Ok(Err(_)) => {}
            Err(error) => unknown = Some(error),
        }
        match store.get_versioned(key).await {
            Ok(Some((held, _))) if held == value => return Ok(Created::Ours),
            Ok(Some(_)) => return Ok(Created::Taken),
            Ok(None) | Err(_) => {}
        }
    }
    Err(unknown.unwrap_or_else(|| io::Error::other("the create's outcome stayed unknown")))
}

/// Replace `key`, last read at `version`, with `value`, expiring at
/// `expires_at_ms` (0: never).
///
/// A write that fails is settled by reading the key back, as in
/// [`create_if_absent`]: `value` there means the write applied; the key
/// still at `version` means it did not, and it is sent again (it can apply
/// at most once, since it names `version`); anything else means another
/// write came first. Two writers that put identical bytes cannot be told
/// apart, so a caller that must know which one won puts something of its own
/// in `value`.
pub(crate) async fn replace_if_version(
    store: &mut impl Conditional,
    key: &[u8],
    value: &[u8],
    version: u64,
    expires_at_ms: u64,
) -> io::Result<Replaced> {
    let mut unknown = None;
    for _ in 0..UNKNOWN_OUTCOME_ATTEMPTS {
        match store
            .put_if_version_expiring(key, value, Some(version), expires_at_ms)
            .await
        {
            Ok(Ok(_)) => return Ok(Replaced::Ours),
            Ok(Err(_)) if unknown.is_none() => return Ok(Replaced::Changed),
            Ok(Err(_)) => {}
            Err(error) => unknown = Some(error),
        }
        match store.get_versioned(key).await {
            Ok(Some((held, _))) if held == value => return Ok(Replaced::Ours),
            Ok(Some((_, now))) if now == version => {}
            Ok(_) => return Ok(Replaced::Changed),
            Err(_) => {}
        }
    }
    Err(unknown.unwrap_or_else(|| io::Error::other("the write's outcome stayed unknown")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_call_is_counted_only_where_a_counter_is_given() {
        let calls = AtomicU64::new(0);
        bump(Some(&calls));
        bump(Some(&calls));
        bump(None);
        assert_eq!(calls.load(Ordering::Relaxed), 2);
    }

    use std::collections::HashMap;
    use std::future::Future;
    use std::task::{Context, Poll, Waker};

    /// A store whose writes can lose their reply, before or after applying.
    #[derive(Default)]
    struct Flaky {
        keys: HashMap<Vec<u8>, (Vec<u8>, u64)>,
        next_version: u64,
        /// The next writes, in order: `Some(true)` applies and then fails as
        /// `SESSION_UNKNOWN`, `Some(false)` fails without applying; once
        /// these run out, writes answer normally.
        faults: Vec<bool>,
        puts: usize,
    }

    impl Conditional for Flaky {
        async fn put_if_version_expiring(
            &mut self,
            key: &[u8],
            value: &[u8],
            expected: Option<u64>,
            _expires_at_ms: u64,
        ) -> io::Result<Result<u64, Option<u64>>> {
            self.puts += 1;
            let fault = (!self.faults.is_empty()).then(|| self.faults.remove(0));
            if fault == Some(false) {
                return Err(unknown());
            }
            let current = self.keys.get(key).map(|(_, version)| *version);
            if current != expected {
                return Ok(Err(current));
            }
            self.next_version += 1;
            self.keys
                .insert(key.to_vec(), (value.to_vec(), self.next_version));
            if fault == Some(true) {
                return Err(unknown());
            }
            Ok(Ok(self.next_version))
        }

        async fn get_versioned(&mut self, key: &[u8]) -> io::Result<Option<(Vec<u8>, u64)>> {
            Ok(self.keys.get(key).cloned())
        }
    }

    fn unknown() -> io::Error {
        io::Error::other(
            "SESSION_UNKNOWN: the outcome of the conditional put is unknown -- it may or may not have applied",
        )
    }

    /// Run a future of the fake store, which never waits.
    fn ready<F: Future>(future: F) -> F::Output {
        let mut future = std::pin::pin!(future);
        match future
            .as_mut()
            .poll(&mut Context::from_waker(Waker::noop()))
        {
            Poll::Ready(output) => output,
            Poll::Pending => panic!("the fake store never waits"),
        }
    }

    fn held(store: &Flaky, key: &[u8]) -> Option<Vec<u8>> {
        store.keys.get(key).map(|(value, _)| value.clone())
    }

    #[test]
    fn a_create_whose_reply_is_lost_after_it_applied_is_ours() {
        let mut store = Flaky {
            faults: vec![true],
            ..Flaky::default()
        };
        assert_eq!(
            ready(create_if_absent(&mut store, b"k", b"mine", 0)).unwrap(),
            Created::Ours
        );
        assert_eq!(store.puts, 1, "the read-back settles it; nothing is sent again");
        assert_eq!(held(&store, b"k").as_deref(), Some(&b"mine"[..]));
    }

    #[test]
    fn a_create_that_failed_before_applying_is_sent_again() {
        let mut store = Flaky {
            faults: vec![false, false],
            ..Flaky::default()
        };
        assert_eq!(
            ready(create_if_absent(&mut store, b"k", b"mine", 0)).unwrap(),
            Created::Ours
        );
        assert_eq!(store.puts, 3);
        assert_eq!(held(&store, b"k").as_deref(), Some(&b"mine"[..]));
    }

    #[test]
    fn a_create_meeting_another_value_reports_it_taken() {
        let mut store = Flaky::default();
        ready(create_if_absent(&mut store, b"k", b"theirs", 0)).unwrap();
        assert_eq!(
            ready(create_if_absent(&mut store, b"k", b"mine", 0)).unwrap(),
            Created::Taken
        );
        store.faults = vec![false];
        assert_eq!(
            ready(create_if_absent(&mut store, b"k", b"mine", 0)).unwrap(),
            Created::Taken,
            "after an unanswered attempt the read-back still tells another value from ours"
        );
        assert_eq!(held(&store, b"k").as_deref(), Some(&b"theirs"[..]));
    }

    #[test]
    fn a_create_that_never_settles_keeps_the_store_error() {
        let mut store = Flaky {
            faults: vec![false; UNKNOWN_OUTCOME_ATTEMPTS],
            ..Flaky::default()
        };
        let error = ready(create_if_absent(&mut store, b"k", b"mine", 0)).unwrap_err();
        assert!(error.to_string().starts_with("SESSION_UNKNOWN"), "{error}");
        assert_eq!(store.puts, UNKNOWN_OUTCOME_ATTEMPTS);
        assert_eq!(held(&store, b"k"), None);
    }

    #[test]
    fn a_replace_whose_reply_is_lost_is_settled_by_the_read_back() {
        let mut store = Flaky::default();
        ready(create_if_absent(&mut store, b"k", b"old", 0)).unwrap();
        let version = store.keys[&b"k"[..]].1;

        store.faults = vec![true];
        assert_eq!(
            ready(replace_if_version(&mut store, b"k", b"new", version, 0)).unwrap(),
            Replaced::Ours
        );
        assert_eq!(held(&store, b"k").as_deref(), Some(&b"new"[..]));

        let version = store.keys[&b"k"[..]].1;
        store.faults = vec![false];
        assert_eq!(
            ready(replace_if_version(&mut store, b"k", b"newer", version, 0)).unwrap(),
            Replaced::Ours,
            "unapplied, it is sent again under the same version"
        );
        assert_eq!(held(&store, b"k").as_deref(), Some(&b"newer"[..]));
    }

    #[test]
    fn a_replace_after_another_write_reports_the_change() {
        let mut store = Flaky::default();
        ready(create_if_absent(&mut store, b"k", b"old", 0)).unwrap();
        let version = store.keys[&b"k"[..]].1;
        ready(replace_if_version(&mut store, b"k", b"first", version, 0)).unwrap();
        assert_eq!(
            ready(replace_if_version(&mut store, b"k", b"second", version, 0)).unwrap(),
            Replaced::Changed
        );
        store.faults = vec![false];
        assert_eq!(
            ready(replace_if_version(&mut store, b"k", b"second", version, 0)).unwrap(),
            Replaced::Changed,
            "the read-back after an unanswered attempt sees the other write"
        );
        assert_eq!(held(&store, b"k").as_deref(), Some(&b"first"[..]));
    }
}

use std::future::{poll_fn, Future};
use std::ops::Deref;
use std::sync::{Condvar, Mutex, MutexGuard};
use std::task::Poll;
use std::time::Duration;

use ferrite_app_test::TestEnv;

/// How many tests may hold a live environment at once: each boots its own
/// planes (sockets and files), and the hosted gate runs `cargo test` at many
/// threads under a fixed open-file limit and on few cores. At six, nine heavy
/// tests (search, preview, messages) missed the 15 s reply deadline there on
/// 14 November; three keeps both the descriptors and the CPU within bounds.
pub const MAX_LIVE_ENVS: usize = 3;

/// The hard deadlines of the waits this module adds, so that a wait that
/// cannot end fails its test at once, with a message saying which wait it was,
/// instead of running into the hosted builder's deadline with no output.
///
/// A place among the live environments: long, because a test may queue behind
/// many others, but finite, because a test that never gives one back would
/// otherwise stop every test after it.
const SLOT_WAIT: Duration = Duration::from_secs(15 * 60);
/// Tearing one environment down.
const TEARDOWN: Duration = Duration::from_secs(30);
/// Every request sent being acknowledged, before a clock jump.
const SETTLE: Duration = Duration::from_secs(20);

static LIVE: Mutex<usize> = Mutex::new(0);
static FREED: Condvar = Condvar::new();

fn live() -> MutexGuard<'static, usize> {
    // A test that panics while holding the lock leaves only a count behind.
    LIVE.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// A place among the [`MAX_LIVE_ENVS`] live environments, given back when it
/// is dropped. Every boot takes one before it builds its harness.
pub struct Slot {
    _taken: (),
}

impl Slot {
    /// Waits for a place. A test's first environment takes its place here.
    pub fn acquire() -> Slot {
        // The deadline counts waits that time out, not wall-clock readings: the
        // platform gate refuses `std::time::Instant` (ambient authority), and a
        // wait woken by a freed place only shortens the total.
        const STEP: Duration = Duration::from_secs(1);
        let mut waited = Duration::ZERO;
        let mut live = live();
        while *live >= MAX_LIVE_ENVS {
            assert!(
                waited < SLOT_WAIT,
                "no test environment became free within {SLOT_WAIT:?}: a test holding one has hung"
            );
            let (guard, wait) = FREED
                .wait_timeout(live, STEP)
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            live = guard;
            if wait.timed_out() {
                waited += STEP;
            }
        }
        *live += 1;
        Slot { _taken: () }
    }

    /// Takes a place without waiting, for a second environment booted beside
    /// one the same test already holds: waiting there could wait for a place
    /// the test itself keeps. Use it only while the test holds an [`Env`].
    pub fn beside() -> Slot {
        *live() += 1;
        Slot { _taken: () }
    }
}

impl Drop for Slot {
    fn drop(&mut self) {
        *live() -= 1;
        FREED.notify_one();
    }
}

/// A booted environment with its [`Slot`]. It derefs to [`TestEnv`], so the
/// helpers that take `&TestEnv` take `&env` unchanged.
///
/// Dropping it tears the environment down completely before the slot is
/// given back: the harness's own `shutdown` stops the app's tasks and then
/// each plane node, awaiting each, before its directory is removed. The
/// harness's `Drop` cannot await the app's tasks, and a plane node still
/// writing when its directory goes ends the whole test process with exit 74
/// (`EXIT_DURABILITY_LOST`) after every test has passed.
pub struct Env {
    env: Option<TestEnv>,
    _slot: Slot,
}

impl Env {
    pub fn new(env: TestEnv, slot: Slot) -> Env {
        Env {
            env: Some(env),
            _slot: slot,
        }
    }
}

impl Deref for Env {
    type Target = TestEnv;

    fn deref(&self) -> &TestEnv {
        self.env.as_ref().expect("a live environment")
    }
}

impl Drop for Env {
    fn drop(&mut self) {
        let Some(env) = self.env.take() else {
            return;
        };
        // Only a multi-thread runtime can wait here; on a current-thread one
        // the harness's own `Drop` keeps the directory rather than race it.
        let Ok(handle) = tokio::runtime::Handle::try_current() else {
            return;
        };
        if handle.runtime_flavor() != tokio::runtime::RuntimeFlavor::MultiThread {
            return;
        }
        let mut shutdown = Box::pin(env.shutdown());
        let done = tokio::task::block_in_place(|| {
            handle.block_on(async { tokio::time::timeout(TEARDOWN, shutdown.as_mut()).await })
        });
        if done.is_err() {
            // Dropping the half-finished teardown would run the harness's own
            // `Drop` on top of it; keep it, and its directory, instead.
            std::mem::forget(shutdown);
            panic!("the test environment was not torn down within {TEARDOWN:?}");
        }
    }
}

/// Returns once every request sent to the app has been answered and
/// acknowledged. The app publishes a reply before it acknowledges the request,
/// and the request queue's visibility runs on the harness clock: moving a
/// manual clock past it while a request is still unacknowledged hands the
/// request out again, and it is handled twice.
pub async fn settled(env: &TestEnv) {
    let mut queue = env.queue("requests");
    let mut last = None;
    let drained = tokio::time::timeout(SETTLE, async {
        loop {
            let counts = queue.counts().await.unwrap_or_else(|error| {
                panic!("the request queue's counts are unreadable: {error}")
            });
            let (published, acked, dlq, pending) = counts;
            if pending == 0 && published <= acked + dlq {
                break;
            }
            last = Some(counts);
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
    })
    .await;
    assert!(
        drained.is_ok(),
        "the requests sent were not all acknowledged within {SETTLE:?} before a clock jump \
         (published, acked, dlq, pending): {last:?}"
    );
}

/// Moves the manual harness clock on by `ms` once every request sent so far
/// is acknowledged ([`settled`]), and answers the new time.
pub async fn advance(env: &TestEnv, ms: u64) -> u64 {
    settled(env).await;
    env.advance(ms)
}

/// Poll both operations concurrently, including when the first waits for the
/// second. This keeps race tests concurrent on the hosted runner without an
/// external macro expansion. Completed futures are never polled again.
pub async fn join<A: Future, B: Future>(a: A, b: B) -> (A::Output, B::Output) {
    let mut a = Box::pin(a);
    let mut b = Box::pin(b);
    let mut result_a = None;
    let mut result_b = None;
    poll_fn(move |cx| {
        if result_a.is_none() {
            if let Poll::Ready(value) = a.as_mut().poll(cx) {
                result_a = Some(value);
            }
        }
        if result_b.is_none() {
            if let Poll::Ready(value) = b.as_mut().poll(cx) {
                result_b = Some(value);
            }
        }
        match (result_a.take(), result_b.take()) {
            (Some(a), Some(b)) => Poll::Ready((a, b)),
            (a, b) => {
                result_a = a;
                result_b = b;
                Poll::Pending
            }
        }
    })
    .await
}

#[allow(dead_code)]
pub async fn join4<A: Future, B: Future, C: Future, D: Future>(
    a: A,
    b: B,
    c: C,
    d: D,
) -> (A::Output, B::Output, C::Output, D::Output) {
    let ((a, b), (c, d)) = join(join(a, b), join(c, d)).await;
    (a, b, c, d)
}

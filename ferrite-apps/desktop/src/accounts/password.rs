//! Password hashing for the desktop's accounts: PBKDF2-HMAC-SHA-256 from the
//! `sha256-hmac` source package (vendored at `src/crypto/`), over the password
//! first MAC'd with a server-side pepper.
//!
//! The pepper is the Ferrite secret [`PEPPER_SECRET`], 32 or more random
//! characters set with `ferrite secrets set` and delivered by a deploy. It is
//! never in source or in the store, so a copy of the store alone cannot be
//! attacked offline. Without it the accounts refuse to hash anything.
//!
//! The iteration count is chosen from a measurement on the machine that
//! serves the request: the first hash of a process times a sample run of
//! PBKDF2 on the platform clock and picks the count that takes about
//! [`TARGET_MS`], within [`MIN_ITERATIONS`] and [`MAX_ITERATIONS`] (OWASP's
//! figure for PBKDF2-HMAC-SHA-256). Each record stores its own count
//! (`pbkdf2-sha256$<iterations>$<salt>$<hash>`), so records hashed under
//! another count still verify. The hosted API deadline is 8 seconds, so the
//! target keeps a sign-up (one hash) or sign-in (one verification) far below
//! it even on a slow, shared CPU.

use std::sync::OnceLock;

use crate::crypto::{hmac_sha256, password_hash_with, password_verify, pbkdf2_sha256};

/// The secret holding the pepper.
pub const PEPPER_SECRET: &str = "mac_password_pepper";
/// The shortest pepper accepted, in bytes.
pub const MIN_PEPPER_BYTES: usize = 32;
/// The fewest iterations ever used, however slow the machine measures.
pub const MIN_ITERATIONS: u32 = 100_000;
/// The most iterations used, however fast the machine measures.
pub const MAX_ITERATIONS: u32 = 600_000;
/// The time one hash should take on the serving machine, in milliseconds.
pub const TARGET_MS: u64 = 250;
/// The shortest sample run that counts as a measurement.
const SAMPLE_MIN_MS: u64 = 40;
/// The iterations of the first sample run; each later one doubles.
const SAMPLE_START: u32 = 10_000;
/// The shortest password accepted, and the longest, in bytes.
pub const MIN_PASSWORD_BYTES: usize = 8;
pub const MAX_PASSWORD_BYTES: usize = 1024;

/// What the measurement found and chose.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Calibration {
    /// The iteration count chosen.
    pub iterations: u32,
    /// The iterations of the sample run that decided it.
    pub sample_iterations: u32,
    /// How long that run took on the platform clock, in milliseconds.
    pub sample_ms: u64,
}

static CALIBRATED: OnceLock<Calibration> = OnceLock::new();

/// The pepper, when the secret is set and long enough.
pub fn pepper(ctx: &ferrite_app::AppContext) -> Option<Vec<u8>> {
    ctx.secret(PEPPER_SECRET)
        .filter(|value| value.len() >= MIN_PEPPER_BYTES)
        .map(String::into_bytes)
}

/// Whether `password` has an acceptable length.
pub fn acceptable(password: &str) -> bool {
    (MIN_PASSWORD_BYTES..=MAX_PASSWORD_BYTES).contains(&password.len())
}

/// The iteration count that makes one hash take about [`TARGET_MS`], from a
/// sample run of `sample_iterations` that took `sample_ms`, rounded down to a
/// multiple of 10,000 and kept within the bounds.
pub fn choose(sample_iterations: u32, sample_ms: u64) -> u32 {
    if sample_ms == 0 {
        return MAX_ITERATIONS;
    }
    let scaled = u64::from(sample_iterations) * TARGET_MS / sample_ms;
    let rounded = scaled / 10_000 * 10_000;
    rounded.clamp(u64::from(MIN_ITERATIONS), u64::from(MAX_ITERATIONS)) as u32
}

/// Time sample runs on `now_ms` until one takes [`SAMPLE_MIN_MS`] (or reaches
/// [`MAX_ITERATIONS`]) and choose from it.
pub fn calibrate(now_ms: impl Fn() -> u64) -> Calibration {
    let mut sample = SAMPLE_START;
    loop {
        let started = now_ms();
        let mut out = [0u8; 32];
        // A fixed, public input: only the time it takes matters.
        let _ = pbkdf2_sha256(
            b"macalicious calibration",
            b"macalicious-salt",
            sample,
            &mut out,
        );
        let took = now_ms().saturating_sub(started);
        if took >= SAMPLE_MIN_MS || sample >= MAX_ITERATIONS {
            return Calibration {
                iterations: choose(sample, took),
                sample_iterations: sample,
                sample_ms: took,
            };
        }
        sample = sample.saturating_mul(2).min(MAX_ITERATIONS);
    }
}

/// This process's calibration, and whether this call made it.
pub fn calibration(ctx: &ferrite_app::AppContext) -> (Calibration, bool) {
    let mut fresh = false;
    let calibration = *CALIBRATED.get_or_init(|| {
        fresh = true;
        calibrate(|| ctx.now_ms())
    });
    (calibration, fresh)
}

fn peppered(pepper: &[u8], password: &str) -> [u8; 32] {
    hmac_sha256(pepper, password.as_bytes())
}

/// A storable record of `password` under `pepper`.
pub fn hash(pepper: &[u8], password: &str, iterations: u32) -> std::io::Result<String> {
    password_hash_with(&peppered(pepper, password), iterations)
}

/// Whether `password` under `pepper` matches `record`.
pub fn verify(pepper: &[u8], password: &str, record: &str) -> bool {
    password_verify(&peppered(pepper, password), record)
}

/// Spend the time of one verification for a name that has no account, so the
/// reply's timing does not tell which names exist: the same PBKDF2 run, with
/// the same pepper MAC, salt length and `iterations` a real record of this
/// process has, and the same constant-time comparison. It never succeeds: the
/// caller treats the name as unknown whatever it computes.
///
/// Nothing is remembered between calls: there is no cached dummy record that
/// a failed set-up could leave empty, so every call does the whole derivation.
/// A count of zero, which PBKDF2 refuses without deriving anything, is raised
/// to [`MIN_ITERATIONS`] rather than skipped.
pub fn verify_nothing(pepper: &[u8], password: &str, iterations: u32) {
    let derived = dummy_derive(&peppered(pepper, password), iterations);
    let _ = crate::crypto::constant_time_eq(&derived, &[0u8; 32]);
}

/// The PBKDF2 run of a check that has no record, over a zero salt of a real
/// record's length. The count is never below [`MIN_ITERATIONS`] when the
/// caller's is zero, so the run cannot be refused and skipped.
fn dummy_derive(key: &[u8], iterations: u32) -> [u8; 32] {
    let iterations = if iterations == 0 {
        MIN_ITERATIONS
    } else {
        iterations
    };
    let mut derived = [0u8; 32];
    // Only a zero count is refused, and that was replaced above.
    let _ = pbkdf2_sha256(key, &[0u8; 16], iterations, &mut derived);
    derived
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_count_follows_the_measurement_within_its_bounds() {
        // 50,000 iterations in 50 ms: 250 ms is 250,000.
        assert_eq!(choose(50_000, 50), 250_000);
        // Rounded down to a multiple of 10,000.
        assert_eq!(choose(40_000, 47), 210_000);
        // A fast machine is held at OWASP's count, a slow one at the floor.
        assert_eq!(choose(600_000, 41), MAX_ITERATIONS);
        assert_eq!(choose(10_000, 400), MIN_ITERATIONS);
        assert_eq!(choose(10_000, 0), MAX_ITERATIONS);
    }

    #[test]
    fn the_pepper_is_part_of_the_record() {
        let record = hash(b"pepper one", "correct horse", 1_000).unwrap();
        assert!(record.starts_with("pbkdf2-sha256$1000$"), "{record}");
        assert!(verify(b"pepper one", "correct horse", &record));
        assert!(!verify(b"pepper one", "correct horsf", &record));
        assert!(
            !verify(b"pepper two", "correct horse", &record),
            "without the pepper the record cannot be checked"
        );
    }

    #[test]
    fn a_sample_run_that_takes_long_enough_decides() {
        let clock = std::cell::Cell::new(0u64);
        // Every reading moves the clock 50 ms: the first sample counts.
        let calibration = calibrate(|| {
            clock.set(clock.get() + 50);
            clock.get()
        });
        assert_eq!(calibration.sample_iterations, SAMPLE_START);
        assert_eq!(calibration.sample_ms, 50);
        assert_eq!(calibration.iterations, MIN_ITERATIONS);
    }

    #[test]
    fn a_check_without_a_record_always_derives() {
        // A refused count (zero) must not turn into a skipped derivation: the
        // output is the real PBKDF2 result, not the untouched zero buffer.
        let key = peppered(b"pepper one", "correct horse");
        let skipped = dummy_derive(&key, 0);
        assert_ne!(skipped, [0u8; 32], "the derivation was skipped");
        let mut expected = [0u8; 32];
        pbkdf2_sha256(&key, &[0u8; 16], MIN_ITERATIONS, &mut expected).unwrap();
        assert_eq!(skipped, expected);
        // Nothing is kept between calls: a second call derives the same way.
        assert_eq!(dummy_derive(&key, 0), expected);
        // A normal count derives under that count.
        let mut at_1000 = [0u8; 32];
        pbkdf2_sha256(&key, &[0u8; 16], 1_000, &mut at_1000).unwrap();
        assert_eq!(dummy_derive(&key, 1_000), at_1000);
        assert_ne!(at_1000, expected);
    }

    #[test]
    fn password_lengths() {
        assert!(!acceptable("short"));
        assert!(acceptable("eight ch"));
        assert!(acceptable(&"x".repeat(MAX_PASSWORD_BYTES)));
        assert!(!acceptable(&"x".repeat(MAX_PASSWORD_BYTES + 1)));
    }
}

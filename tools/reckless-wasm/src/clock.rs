use std::time::Duration;
#[link(wasm_import_module = "host")]
unsafe extern "C" {
    fn now() -> f64;
}
#[derive(Clone)]
pub struct Instant(f64);
impl Instant {
    pub fn now() -> Self {
        Self(unsafe { now() })
    }
    pub fn elapsed(&self) -> Duration {
        Duration::from_secs_f64(((unsafe { now() }) - self.0).max(0.0) / 1000.0)
    }
}

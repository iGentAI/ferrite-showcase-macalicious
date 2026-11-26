#![forbid(unsafe_code)]
//! The process harness. The logic lives in the library so the tests drive the
//! same code the deployment runs.

use ferrite_app::{app_main, AppContext, FerriteApp};

struct Desktop;

impl FerriteApp for Desktop {
    fn run(ctx: AppContext) -> impl std::future::Future<Output = std::io::Result<()>> + Send {
        macalicious_desktop::run(ctx)
    }
}

fn main() {
    app_main::<Desktop>()
}

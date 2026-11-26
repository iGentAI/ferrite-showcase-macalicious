//! What the desktop application can say about itself and this browser's
//! session, for About This Mac and System Information. Nothing here is a
//! fact about hardware: a Ferrite application is shown no processor, memory,
//! disk or serial number, and none is invented.

use std::io;

use crate::store::IntoStore;
use ferrite_app::serde_json;

use super::MODULES;
use crate::module::ApiCtx;

/// The application's name, as `ferrite.json` declares it.
pub const APPLICATION: &str = "macalicious-desktop";
/// The most keys counted in one module's space for one session; a space
/// with more is reported as counted that far (`truncated`).
const MAX_KEYS_PER_APP: usize = 10_000;

/// What one module keeps for one session.
pub(super) struct Usage {
    pub(super) bytes: u64,
    pub(super) keys: u64,
    pub(super) truncated: bool,
    /// The keys named in the scan's `track` list that were found, each with
    /// its value, in key order.
    pub(super) tracked: Vec<(String, Vec<u8>)>,
}

/// Count the keys and bytes (key below the space's prefix, plus value) that
/// one session keeps in one module's space, `apps/<module>/users/<session>/`,
/// and keep the values of the keys `track` names (relative to that space).
pub(super) async fn usage<'s>(
    store: impl IntoStore<'s>,
    module: &str,
    session: &str,
    track: &[&str],
) -> io::Result<Usage> {
    let mut store = store.into_store();
    let prefix = format!("apps/{module}/users/{session}/");
    let mut usage = Usage {
        bytes: 0,
        keys: 0,
        truncated: false,
        tracked: Vec::new(),
    };
    let mut after: Option<Vec<u8>> = None;
    let mut pages_read = 0;
    loop {
        // Never ask for more keys than the budget has left, so the count stops
        // at MAX_KEYS_PER_APP exactly. Pages start small and grow: a scan is
        // charged the page it asks for, and these reports scan every module.
        let budget = crate::module::scan_page(
            MAX_KEYS_PER_APP.saturating_sub(usage.keys as usize),
            pages_read,
        );
        pages_read += 1;
        let (rows, more) = store
            .scan_prefix(prefix.as_bytes(), after.as_deref(), budget)
            .await?;
        for (key, value, _) in &rows {
            usage.keys += 1;
            let relative = key.get(prefix.len()..).unwrap_or_default();
            usage.bytes += (relative.len() + value.len()) as u64;
            if let Ok(name) = std::str::from_utf8(relative) {
                if track.contains(&name) {
                    usage.tracked.push((name.to_string(), value.clone()));
                }
            }
        }
        after = rows.last().map(|(key, _, _)| key.clone());
        if usage.keys as usize >= MAX_KEYS_PER_APP {
            usage.truncated = more;
            return Ok(usage);
        }
        if !more || after.is_none() {
            return Ok(usage);
        }
    }
}

/// The facts both apps show: the application, its deployment, the site
/// build it serves, the platform clock, this session, what this session
/// keeps in each module's space, and the person's drive against its quota
/// (`drive`: `quota`, `used`, `available` and `categories`, as Storage
/// Management reports them, read from the files module's document that the
/// scan of its space finds).
pub async fn facts(cx: &mut ApiCtx<'_>) -> io::Result<serde_json::Value> {
    let session = cx.session.principal.clone();
    let store = cx.storage.store();
    let mut apps = Vec::new();
    let (mut bytes, mut keys, mut truncated) = (0u64, 0u64, false);
    let mut drive_document = None;
    for module in MODULES {
        let files = module.name == super::files::MODULE.name;
        let track: &[&str] = if files { &["drive"] } else { &[] };
        let used = usage(&mut *store, module.name, &session, track).await?;
        if files {
            drive_document = used
                .tracked
                .first()
                .and_then(|(_, value)| serde_json::from_slice::<serde_json::Value>(value).ok());
        }
        bytes += used.bytes;
        keys += used.keys;
        truncated |= used.truncated;
        apps.push(serde_json::json!({
            "name": module.name,
            "title": module.title,
            "bytes": used.bytes,
            "keys": used.keys,
            "truncated": used.truncated,
        }));
    }
    let report = super::storage_management::drive::report(drive_document.as_ref());
    let drive = serde_json::json!({
        "quota": report["quota"],
        "used": report["used"],
        "available": report["available"],
        "categories": report["categories"],
    });
    let bundle = crate::site_bundle();
    Ok(serde_json::json!({
        "application": APPLICATION,
        "generation": cx.ctx.generation(),
        "instance": cx.ctx.instance(),
        "build": bundle.build_id,
        "site_files": bundle.files.len(),
        "modules": MODULES.len(),
        "now_ms": cx.now_ms,
        "session_created_ms": cx.session.created_ms,
        "storage": { "bytes": bytes, "keys": keys, "truncated": truncated, "apps": apps },
        "drive": drive,
    }))
}

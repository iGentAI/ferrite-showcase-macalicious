#![forbid(unsafe_code)]
//! **macalicious-desktop**: the Macalicious desktop page and its app modules as
//! one Ferrite application.
//!
//! Three faces share one gateway:
//!
//! * `/` is a `content` route on the `site` blob. The desktop's built files are
//!   compiled into this crate (`site_assets.rs`, generated) and published into
//!   that blob at boot by [`site::seed`], so a deployment serves them with no
//!   upload step.
//! * `/api/` is a request/reply route handled by [`handle`]: the session
//!   endpoint, the app registry, and one [`module::AppModule`] per app under
//!   `/api/<app>/`.
//! * `/health` answers liveness.
//! * `/favicon.ico` answers the page's icon ([`favicon`]): a browser asks for it for any document that
//!   declares no icon of its own (Chrome, for a JSON reply or a file opened in a tab).
//!
//! Every `/api/` request carries a per-browser session ([`session`]). The
//! desktop has its own sign-in ([`accounts`]): once someone signs in, every
//! module's storage is keyed by their account instead of the browser.

// The vendored source packages (`codec`, `qjs`, `wasm`) use `alloc::` paths.
extern crate alloc;

pub mod accounts;
pub mod applog;
pub mod apps;
// Vendored by ferrite-pkg (`@generated`). Not marked `rustfmt::skip`: the hosted
// code gate refuses that attribute in any form, so the copy is kept
// rustfmt-clean instead (whitespace only).
pub mod codec;
pub mod crypto;
pub mod favicon;
pub mod http;
pub mod live;
pub mod module;
// Vendored by `ferrite add qjs-engine`: the bounded JavaScript engine under
// Script Editor's scripts and Automator's Run JavaScript steps.
#[allow(dead_code)]
pub mod qjs;
pub mod session;
pub mod site;
mod site_assets;
pub mod site_serve;
pub mod store;
pub mod timing;
#[allow(unused_imports, unexpected_cfgs, dead_code)]
pub mod wasm;

use std::sync::atomic::{AtomicU64, Ordering};

use ferrite_app::client::StoreClusterClient;
use ferrite_app::{rt, serde_json, AppContext, IngressReply, IngressRequest};

use http::Response;
use module::{ApiCtx, Request, Storage};

/// The blob binding the `/` content route serves.
pub const SITE_BINDING: &str = "site";
/// The store binding every module's storage lives in.
pub const DATA_BINDING: &str = "data";
/// The request queue the `/api/`, `/health` and `/favicon.ico` routes publish to.
pub const REQUESTS_BINDING: &str = "requests";
/// The query parameter in which the desktop's page names the session it was
/// loaded for (the hash of its cookie, `session::Session::id`).
pub const PAGE_SESSION_PARAM: &str = "desktop_session";

/// The site bundle compiled into this build.
pub fn site_bundle() -> &'static site::SiteBundle {
    &site_assets::SITE
}

/// The application loop: publish the site, then serve the request queue.
pub async fn run(ctx: AppContext) -> std::io::Result<()> {
    let site_ctx = ctx.clone();
    rt::spawn(async move {
        boot_log(
            &site_ctx,
            "boot",
            &format!(
                "{} started at deployment generation {:?}",
                apps::system::APPLICATION,
                site_ctx.generation()
            ),
        )
        .await;
        let outcome = site::seed_with_retry(&site_ctx, site_bundle()).await;
        let build = site_bundle().build_id;
        let message = match outcome {
            site::Seeded::AlreadyCurrent => format!("site build {build} was already live"),
            site::Seeded::Published { files, bytes } => {
                format!("published site build {build} ({files} files, {bytes} bytes)")
            }
        };
        boot_log(&site_ctx, "site", &message).await;
    });
    spawn_live(ctx.clone());
    spawn_guest_cleanup(ctx.clone());
    for worker in 0..4 {
        let ctx = ctx.clone();
        rt::spawn(async move {
            // A worker returns only when it cannot reach its queue or store;
            // restart it with backoff rather than serving with fewer.
            let mut delay_ms = 250;
            loop {
                if let Err(error) = api_worker(ctx.clone()).await {
                    ferrite_app::tracing::error!(%error, worker, delay_ms, "api worker stopped; restarting");
                }
                ferrite_app::sleep_ms(delay_ms).await;
                delay_ms = (delay_ms * 2).min(30_000);
            }
        });
    }
    loop {
        ferrite_app::sleep_ms(60_000).await;
    }
}

/// Write one of the application's own entries to its log, retrying a few
/// times while the store may not be reachable yet.
async fn boot_log(ctx: &AppContext, category: &str, message: &str) {
    let mut delay_ms = 250;
    for _ in 0..5 {
        let written = match ctx.store(DATA_BINDING) {
            Ok(mut store) => applog::append(
                &mut store,
                ctx.now_ms(),
                applog::Level::Default,
                apps::system::APPLICATION,
                category,
                message,
            )
            .await
            .map(|_| ()),
            Err(error) => Err(error),
        };
        match written {
            Ok(()) => return,
            Err(error) => {
                ferrite_app::tracing::warn!(%error, "could not write to the desktop log")
            }
        }
        ferrite_app::sleep_ms(delay_ms).await;
        delay_ms *= 2;
    }
}

/// The `/live/` stream route (`src/live.rs`), restarted with backoff like
/// the API workers. Without a `live` binding it waits and tries again, so a
/// spec that declares no stream route costs nothing.
fn spawn_live(ctx: AppContext) {
    rt::spawn(async move {
        let mut delay_ms = 250;
        loop {
            if let Err(error) = live::run(ctx.clone(), apps::FEEDS).await {
                ferrite_app::tracing::warn!(%error, delay_ms, "live loop stopped; restarting");
            }
            ferrite_app::sleep_ms(delay_ms).await;
            delay_ms = (delay_ms * 2).min(30_000);
        }
    });
}

/// Expired guest data drains independently of sign-in traffic. Each replica does
/// one bounded step per interval; durable compare-and-set cursors coordinate them.
fn spawn_guest_cleanup(ctx: AppContext) {
    rt::spawn(async move {
        loop {
            ferrite_app::sleep_ms(2_000).await;
            let outcome = match ctx.store(DATA_BINDING) {
                Ok(mut store) => {
                    accounts::purge_guests(&mut store, ctx.now_ms(), accounts::GUEST_CLEANUP_OPS)
                        .await
                }
                Err(error) => Err(error),
            };
            if let Err(error) = outcome {
                ferrite_app::tracing::warn!(%error, "guest cleanup will resume next interval");
            }
        }
    });
}

async fn api_worker(ctx: AppContext) -> std::io::Result<()> {
    let mut requests = ctx.queue(REQUESTS_BINDING)?;
    let mut store = ctx.store(DATA_BINDING)?;
    loop {
        let lease = match requests.poll_wait(1_000).await {
            Ok(Some(lease)) => lease,
            Ok(None) => continue,
            Err(_) => {
                ferrite_app::sleep_ms(200).await;
                continue;
            }
        };
        let Ok(req) = serde_json::from_slice::<IngressRequest>(&lease.payload) else {
            let _ = requests.ack(lease.token).await; // undecodable: ack it away
            continue;
        };
        let mut pending = None;
        let reply = route(&ctx, &mut store, &req, &mut pending)
            .await
            .into_reply(&req);
        // Publish and acknowledge before best-effort diagnostic writes: a slow
        // counter must not delay the browser's reply or cause redelivery.
        let publish = async {
            match ctx.reply_to_queue(&req.reply_to).await {
                Ok(mut replies) => match serde_json::to_vec(&reply) {
                    Ok(payload) => replies.publish(&payload).await.is_ok(),
                    Err(_) => false,
                },
                Err(_) => false,
            }
        };
        let acknowledge = async {
            let _ = requests.ack(lease.token).await;
        };
        let observe = async {
            if let Some(observation) = pending {
                observation.record(&mut store).await;
            }
        };
        settle_reply(publish, acknowledge, observe).await;
    }
}

async fn settle_reply<P, A, O>(publish: P, acknowledge: A, observe: O)
where
    P: std::future::Future<Output = bool>,
    A: std::future::Future<Output = ()>,
    O: std::future::Future<Output = ()>,
{
    if publish.await {
        acknowledge.await;
    }
    observe.await;
}

/// Answer one request from the `/health`, `/favicon.ico` or `/api/` route.
pub async fn handle(
    ctx: &AppContext,
    store: &mut StoreClusterClient,
    req: &IngressRequest,
) -> IngressReply {
    let mut pending = None;
    let response = route(ctx, store, req, &mut pending).await.into_reply(req);
    if let Some(observation) = pending {
        observation.record(store).await;
    }
    response
}

struct PendingObservation {
    now_ms: u64,
    app: String,
    path: String,
    method: String,
    status: u16,
    sample: Option<timing::Sample>,
    ticket: bool,
    counted: bool,
}

impl PendingObservation {
    async fn record(self, store: &mut StoreClusterClient) {
        if self.ticket {
            if let Err(error) =
                applog::count(store, &self.app, self.now_ms, true, false, None).await
            {
                ferrite_app::tracing::warn!(%error, app = self.app, "request not counted");
            }
        } else if self.counted {
            record(
                store,
                self.now_ms,
                &self.app,
                &self.path,
                &self.method,
                self.status,
                self.sample,
            )
            .await;
        } else {
            log_request(
                store,
                self.now_ms,
                applog_process(None),
                &self.app,
                &self.path,
                &self.method,
                self.status,
            )
            .await;
        }
    }
}

async fn route(
    ctx: &AppContext,
    store: &mut StoreClusterClient,
    req: &IngressRequest,
    pending: &mut Option<PendingObservation>,
) -> Response {
    let (path, query) = http::split_query(&req.path);
    if path == "/health" {
        return match req.method.as_str() {
            "GET" | "HEAD" => Response::json(200, &serde_json::json!({ "status": "ok" })),
            _ => Response::method_not_allowed(),
        };
    }
    if path == "/favicon.ico" {
        return favicon::response(req.method.as_str());
    }
    // Every other path is the desktop's page or one of its files.
    let Some(rest) = path.strip_prefix("/api/") else {
        return site_serve::respond(ctx, req, path).await;
    };
    if http::is_cross_site_write(req) {
        return Response::error(403, "cross-site requests may not change state");
    }

    // Activity Monitor's timings (`timing.rs`): from the module's call to its
    // reply and change notification, with every store call made in between
    // (`store.rs`). A request no module answers is counted, not timed.
    let mut module_started_ms: Option<f64> = None;
    let store_calls = AtomicU64::new(0);
    let now_ms = ctx.now_ms();
    let (session, set_cookie) = match session::resolve(store, req, now_ms).await {
        Ok(Some(resolved)) => resolved,
        // The cookie's session was just ended by another request, whose reply
        // carries the browser's next cookie: this one sets none.
        Ok(None) => {
            return Response::json(
                409,
                &serde_json::json!({
                    "error": "this browser's session has just changed; load the page again",
                    "session_ended": true,
                }),
            )
        }
        Err(error) => {
            ferrite_app::tracing::error!(%error, "session lookup failed");
            return Response::error(503, "sessions are unavailable; retry");
        }
    };

    let (app, sub_path) = match rest.split_once('/') {
        Some((app, _)) => (app, &rest[app.len()..]),
        None => (rest, "/"),
    };
    // The session the page's desktop was loaded for, which it names in every
    // app request (`demos/desktop/desktop-server.ts`); the module never sees
    // the parameter.
    let (page_session, query) = http::take_query_param(query, PAGE_SESSION_PARAM);
    let response = match (app, req.method.as_str()) {
        // A session change sent by a page that was showing another session
        // (another tab signed in, out or as someone else since) changes
        // nothing: a stale tab cannot lock, sign out or answer an offer for
        // the person now signed in. The page reads the session again.
        ("session", "POST")
            if page_session
                .as_deref()
                .is_some_and(|named| named != session.id) =>
        {
            Response::json(
                409,
                &serde_json::json!({
                    "error": "this page was showing a session that has changed; it shows the current one now",
                    "session_changed": true,
                }),
            )
        }
        // A ticket for this browser's personal live stream (`src/live.rs`,
        // `/live/me`), for the person signed in now; none while locked.
        ("session", "POST") if sub_path == "/ticket" => {
            if session.locked || session::lock_requested(req) {
                Response::error(423, "the screen is locked")
            } else {
                match apps::notification_center::issue_ticket(store, &session, now_ms).await {
                    Ok(ticket) => Response::json(201, &ticket),
                    Err(error) => {
                        ferrite_app::tracing::error!(%error, "live ticket not issued");
                        Response::error(503, "live updates are unavailable; retry")
                    }
                }
            }
        }
        ("session", _) => accounts::handle(ctx, store, req, &session, sub_path, now_ms).await,
        ("apps", "GET") if sub_path == "/" => Response::json(200, &apps::describe()),
        ("apps", _) if sub_path == "/" => Response::method_not_allowed(),
        _ => match apps::find(app) {
            // A page loaded for another session (another tab signed in, out or
            // as someone else since) reads and writes nothing of this one's:
            // its reply names the current person, so the page loads again.
            Some(_)
                if page_session
                    .as_deref()
                    .is_some_and(|named| named != session.id) =>
            {
                Response::json(
                    409,
                    &serde_json::json!({
                        "error": "this page belongs to a session that has ended",
                        "session": session.principal,
                    }),
                )
            }
            // A save bound to another person than the one behind this request (the page's
            // copy is theirs: a sign-in happened since it was read) changes nothing.
            Some(_)
                if http::header(req, module::PERSON_HEADER)
                    .is_some_and(|named| named != session.principal) =>
            {
                Response::json(
                    409,
                    &serde_json::json!({
                        "error": "this save belongs to another person",
                        "session_changed": true,
                    }),
                )
            }
            // A locked screen opens no app's data until the password unlocks it, nor does one
            // whose lock is on its way (`session::lock_requested`).
            Some(_) if session.locked || session::lock_requested(req) => {
                Response::error(423, "the screen is locked")
            }
            Some(module) => {
                // The module sees the person behind the request as the
                // session (`Session::for_modules`).
                let seen = session.for_modules();
                module_started_ms = Some(ctx.clock().now_ms_f64());
                let writes = module::WriteIds::new(http::header(req, module::WRITE_HEADER));
                let cx = ApiCtx {
                    request: Request::new(req, sub_path, &query),
                    storage: Storage::new(
                        store::Store::counted(&mut *store, &store_calls),
                        module.name,
                        &session.principal,
                    )
                    .user_data_expires(session.guest_expires_ms())
                    .with_write_ids(writes.clone()),
                    session: &seen,
                    ctx,
                    now_ms,
                };
                // A module never sets cookies: the session owns the reply's
                // one set-cookie header.
                let mut response = (module.handle)(cx).await.without_header("set-cookie");
                if writes.this().is_some() {
                    response =
                        response.add_header(module::PERSON_HEADER, session.principal.clone());
                }
                if let Some(value) = writes.reply_value() {
                    response = response.add_header(module::WRITES_HEADER, value);
                }
                // A change the person made reaches their other browsers: the
                // personal stream carries each module's change count, and the
                // reply names the change's number to the page that made it.
                // It cannot fail the request.
                let write = !matches!(req.method.as_str(), "GET" | "HEAD");
                if write && response.status < 400 && module.name != apps::notification_center::APP {
                    match apps::notification_center::touched(
                        store::Store::counted(&mut *store, &store_calls),
                        &session.principal,
                        module.name,
                        &session.id,
                        now_ms,
                    )
                    .await
                    {
                        Ok(Some(n)) => {
                            response = response.add_header(
                                apps::notification_center::CHANGE_HEADER,
                                n.to_string(),
                            );
                        }
                        Ok(None) => {}
                        Err(error) => {
                            ferrite_app::tracing::warn!(%error, app, "change not recorded");
                        }
                    }
                }
                response
            }
            None => Response::error(404, &format!("no app module is named '{app}'")),
        },
    };
    // Queue the existing best-effort bookkeeping for after the reply is published.
    // A public `handle` call records before returning, preserving its test contract.
    let sample = module_started_ms.map(|started_ms| timing::Sample {
        server_us: timing::elapsed_us(started_ms, ctx.clock().now_ms_f64()),
        store_calls: store_calls.load(Ordering::Relaxed),
    });
    *pending = Some(PendingObservation {
        now_ms,
        app: app.to_owned(),
        path: sub_path.to_owned(),
        method: req.method.clone(),
        status: response.status,
        sample,
        ticket: app == "session" && sub_path == "/ticket" && response.status < 400,
        counted: apps::counted(app),
    });
    // The accounts routes issue their own cookie when they sign in or out; the
    // reply carries one set-cookie header, so theirs wins.
    let has_cookie = response
        .headers
        .iter()
        .any(|(name, _)| name.eq_ignore_ascii_case("set-cookie"));
    match set_cookie {
        Some(cookie) if !has_cookie => response.add_header("set-cookie", cookie),
        _ => response,
    }
}

/// Count an answered request for `app`, with its server time and store calls
/// when a module answered it (`sample`), and, when it changed state or failed,
/// log it
/// (`src/applog.rs`): the method, the path below `/api/` without its query,
/// and the status. The time goes into the same compare-and-set write as the
/// count, so timing a request costs no store call of its own. Neither step
/// can fail the request.
async fn record(
    store: &mut StoreClusterClient,
    now_ms: u64,
    app: &str,
    path: &str,
    method: &str,
    status: u16,
    sample: Option<timing::Sample>,
) {
    let write = !matches!(method, "GET" | "HEAD");
    if let Err(error) = applog::count(store, app, now_ms, write, status >= 400, sample).await {
        ferrite_app::tracing::warn!(%error, app, "request not counted");
    }
    log_request(
        store,
        now_ms,
        applog_process(Some(app)),
        app,
        path,
        method,
        status,
    )
    .await;
}

/// The process a request's log line names: the module, or the application
/// itself for a name no module has.
fn applog_process(module: Option<&str>) -> &str {
    module.unwrap_or(apps::system::APPLICATION)
}

/// Log a request that changed state or failed: the method, the route below
/// `/api/<app>` (its first segment; later ones are shown as `…`), and the
/// status. A read that succeeded is not logged. Writing the log cannot fail
/// the request.
async fn log_request(
    store: &mut StoreClusterClient,
    now_ms: u64,
    process: &str,
    app: &str,
    path: &str,
    method: &str,
    status: u16,
) {
    let write = !matches!(method, "GET" | "HEAD");
    if !write && status < 400 {
        return;
    }
    let level = match status {
        500.. => applog::Level::Error,
        400.. => applog::Level::Default,
        _ => applog::Level::Info,
    };
    // Only the route: segments after the first can be ids a person chose
    // (a photo, a reminder), and the log is read by everyone.
    let route = match path.trim_start_matches('/').split_once('/') {
        Some((first, _)) => format!("/{first}/\u{2026}"),
        None => path.to_string(),
    };
    let message = format!("{method} /api/{app}{route} answered {status}");
    if let Err(error) = applog::append(store, now_ms, level, process, "request", &message).await {
        ferrite_app::tracing::warn!(%error, app, "could not write to the desktop log");
    }
}

#[cfg(test)]
mod reply_order_tests {
    use super::settle_reply;
    use std::{
        cell::RefCell,
        future::Future,
        pin::pin,
        rc::Rc,
        sync::Arc,
        task::{Context, Poll, Wake, Waker},
    };
    struct Noop;
    impl Wake for Noop {
        fn wake(self: Arc<Self>) {}
    }
    #[test]
    fn delayed_observation_never_delays_published_reply_or_ack() {
        let events = Rc::new(RefCell::new(Vec::new()));
        let p = events.clone();
        let a = events.clone();
        let o = events.clone();
        let mut task = pin!(settle_reply(
            async move {
                p.borrow_mut().push("published");
                true
            },
            async move { a.borrow_mut().push("acked") },
            async move {
                o.borrow_mut().push("observation started");
                std::future::pending::<()>().await
            }
        ));
        let waker = Waker::from(Arc::new(Noop));
        let mut cx = Context::from_waker(&waker);
        assert!(matches!(task.as_mut().poll(&mut cx), Poll::Pending));
        assert_eq!(
            *events.borrow(),
            ["published", "acked", "observation started"]
        );
    }
    #[test]
    fn failed_publish_is_not_acked_but_is_observed() {
        let events = Rc::new(RefCell::new(Vec::new()));
        let p = events.clone();
        let a = events.clone();
        let o = events.clone();
        let mut task = pin!(settle_reply(
            async move {
                p.borrow_mut().push("publish failed");
                false
            },
            async move { a.borrow_mut().push("acked") },
            async move { o.borrow_mut().push("observed") }
        ));
        let waker = Waker::from(Arc::new(Noop));
        let mut cx = Context::from_waker(&waker);
        assert!(matches!(task.as_mut().poll(&mut cx), Poll::Ready(())));
        assert_eq!(*events.borrow(), ["publish failed", "observed"]);
    }
}

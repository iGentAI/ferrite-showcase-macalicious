//! The site's `/favicon.ico` (`src/favicon.rs`, the `/favicon.ico` route of `ferrite.json`): the same 32-pixel PNG the
//! desktop page declares inline, answered for `GET` and `HEAD`, cacheable, refused for any other method. A browser
//! asks a site for `/favicon.ico` for any document that declares no icon of its own (Google Chrome, for a JSON reply
//! or a file opened in a tab); without the route the site answered 404 and Chrome logged a console error. That the
//! bytes are the page's own inline icon is held by test/favicon-icon.test.ts (the code gate keeps file reads out of
//! these tests).

use ferrite_app::{IngressReply, IngressRequest};
use ferrite_app_test::{ingress, TestEnv, TestHarness};

async fn boot() -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let env = TestHarness::new()
        .with_queue("requests")
        .with_queue("replies")
        .with_store("data")
        .build()
        .await;
    env.run_app(|ctx| async move { macalicious_desktop::run(ctx).await });
    crate::support::Env::new(env, slot)
}

async fn call(env: &TestEnv, req: IngressRequest) -> IngressReply {
    env.handle(req).await.expect("a reply")
}

fn with_method(mut req: IngressRequest, method: &str) -> IngressRequest {
    req.method = method.into();
    req
}

fn header<'a>(reply: &'a IngressReply, name: &str) -> Option<&'a str> {
    reply
        .headers
        .iter()
        .find(|(n, _)| n.eq_ignore_ascii_case(name))
        .map(|(_, v)| v.as_str())
}

#[test]
fn the_icon_is_a_32_pixel_png() {
    let png = macalicious_desktop::favicon::PNG;
    assert_eq!(&png[..8], b"\x89PNG\r\n\x1a\n", "a PNG signature");
    assert_eq!(&png[12..16], b"IHDR");
    assert_eq!(
        u32::from_be_bytes(png[16..20].try_into().unwrap()),
        32,
        "32 pixels wide"
    );
    assert_eq!(
        u32::from_be_bytes(png[20..24].try_into().unwrap()),
        32,
        "32 pixels high"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn favicon_ico_answers_the_icon_for_get_and_head_and_refuses_other_methods() {
    let env = boot().await;

    let got = call(&env, ingress::get("/favicon.ico")).await;
    assert_eq!(got.status, 200);
    assert_eq!(header(&got, "content-type"), Some("image/png"));
    assert_eq!(header(&got, "cache-control"), Some("public, max-age=86400"));
    assert_eq!(got.body, macalicious_desktop::favicon::PNG);
    // It sets no session: the icon is the same for everyone and needs no cookie.
    assert_eq!(header(&got, "set-cookie"), None);

    let head = call(&env, with_method(ingress::get("/favicon.ico"), "HEAD")).await;
    assert_eq!(head.status, 200);
    assert_eq!(header(&head, "content-type"), Some("image/png"));

    let posted = call(&env, ingress::post("/favicon.ico", "")).await;
    assert_eq!(posted.status, 405);

    // A query does not change the answer (browsers add none, a cache-buster might).
    let queried = call(&env, ingress::get("/favicon.ico?v=2")).await;
    assert_eq!(queried.status, 200);
    assert_eq!(queried.body, macalicious_desktop::favicon::PNG);

    // Only the exact path: anything under it is not the icon.
    let under = call(&env, ingress::get("/favicon.ico/x")).await;
    assert_eq!(under.status, 404);
}

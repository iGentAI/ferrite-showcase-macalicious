//! The desktop's page and files on the in-process Forge planes
//! (`ferrite-app-test`), as the app's api face serves them
//! (`src/site_serve.rs`): each in the best coding the browser's
//! `Accept-Encoding` takes among the copies the build made, a hashed name cached
//! for a year and the page checked each time, and a file the browser holds
//! answered with a 304. The bytes are the build's own (`site_bundle`): the app
//! answers from the `site` blob, or from the build while it is still being
//! published there, so these tests need not wait for publication.

use ferrite_app::{serde_json, IngressReply, IngressRequest};
use ferrite_app_test::{ingress, TestEnv, TestHarness};
use macalicious_desktop::site::{decode_base64, Coding, SiteFile};

async fn boot() -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let env = TestHarness::new()
        .with_blob("site")
        .with_queue("requests")
        .with_queue("replies")
        .with_store("data")
        .build()
        .await;
    env.run_app(|ctx| async move { macalicious_desktop::run(ctx).await });
    crate::support::Env::new(env, slot)
}

fn header<'a>(reply: &'a IngressReply, name: &str) -> Option<&'a str> {
    reply
        .headers
        .iter()
        .find(|(n, _)| n.eq_ignore_ascii_case(name))
        .map(|(_, v)| v.as_str())
}

fn request(method: &str, path: &str, headers: &[(&str, &str)]) -> IngressRequest {
    let mut req = ingress::request(method, path, "", b"");
    for (name, value) in headers {
        req.headers.push((name.to_string(), value.to_string()));
    }
    req
}

async fn get(env: &TestEnv, path: &str, accept: Option<&str>) -> IngressReply {
    let headers: Vec<(&str, &str)> = accept.map(|a| ("accept-encoding", a)).into_iter().collect();
    env.handle(request("GET", path, &headers))
        .await
        .expect("a reply")
}

fn file(path: &str) -> &'static SiteFile {
    macalicious_desktop::site_bundle()
        .files
        .iter()
        .find(|file| file.path == path)
        .unwrap_or_else(|| panic!("the build has {path}"))
}

/// A hashed file of the build that has both compressed copies, and one of a
/// type that is never compressed.
fn compressed_asset() -> &'static SiteFile {
    macalicious_desktop::site_bundle()
        .files
        .iter()
        .find(|file| {
            file.path.ends_with(".js")
                && file.br.is_some()
                && file.gzip.is_some()
                && decode_base64(file.base64).unwrap().len()
                    <= macalicious_desktop::site_serve::MAX_REPLY_BYTES
        })
        .expect("the build has a script with both copies")
}

fn plain_asset() -> &'static SiteFile {
    macalicious_desktop::site_bundle()
        .files
        .iter()
        .find(|file| file.path.ends_with(".webp"))
        .expect("the build has an image")
}

fn bytes(file: &SiteFile, coding: Coding) -> Vec<u8> {
    decode_base64(file.encoded(coding).expect("the build made this copy")).unwrap()
}

/// What the browser is sent for `file` when it accepts `accept`: the coding
/// named by `Content-Encoding` and the body, which must be that copy's bytes.
fn assert_served(reply: &IngressReply, file: &SiteFile, coding: Coding) {
    assert_eq!(
        reply.status,
        200,
        "{}",
        String::from_utf8_lossy(&reply.body)
    );
    let named = header(reply, "content-encoding");
    match coding {
        Coding::Identity => assert_eq!(named, None, "{}", file.path),
        other => assert_eq!(named, Some(other.token()), "{}", file.path),
    }
    assert!(
        reply.body == bytes(file, coding),
        "{} in {}",
        file.path,
        coding.token()
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn each_browser_gets_the_best_copy_it_accepts() {
    let env = boot().await;
    let script = compressed_asset();
    let path = format!("/{}", script.path);
    for (accept, coding) in [
        (Some("gzip, deflate, br, zstd"), Coding::Brotli),
        (Some("gzip, deflate"), Coding::Gzip),
        (Some("br;q=0, gzip"), Coding::Gzip),
        (Some("br;q=0.5, gzip;q=0.8"), Coding::Gzip),
        (Some("br;q=0, gzip;q=0"), Coding::Identity),
        (None, Coding::Identity),
    ] {
        let reply = get(&env, &path, accept).await;
        assert_served(&reply, script, coding);
        assert_eq!(
            header(&reply, "vary"),
            Some("accept-encoding"),
            "{accept:?}"
        );
        assert_eq!(
            header(&reply, "content-type"),
            Some("text/javascript; charset=utf-8")
        );
    }

    // The page, at `/`, in the best of its own copies.
    let page = file("index.html");
    let best = [Coding::Brotli, Coding::Gzip, Coding::Identity]
        .into_iter()
        .find(|coding| page.encoded(*coding).is_some())
        .unwrap();
    let reply = get(&env, "/", Some("gzip, deflate, br")).await;
    assert_served(&reply, page, best);
    assert_eq!(
        header(&reply, "content-type"),
        Some("text/html; charset=utf-8")
    );
    assert_served(
        &get(&env, "/index.html", None).await,
        page,
        Coding::Identity,
    );

    // A type that is never compressed is sent as it is, whatever is accepted.
    let image = plain_asset();
    let reply = get(&env, &format!("/{}", image.path), Some("br, gzip")).await;
    assert_served(&reply, image, Coding::Identity);
    assert_eq!(header(&reply, "vary"), None);
    assert_eq!(header(&reply, "content-type"), Some("image/webp"));
    // And a browser that refuses it is told so rather than sent it.
    let refused = get(&env, &format!("/{}", image.path), Some("identity;q=0")).await;
    assert_eq!(refused.status, 406);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn hashed_files_are_kept_for_a_year_and_the_page_is_checked_each_time() {
    let env = boot().await;
    let script = compressed_asset();
    let path = format!("/{}", script.path);
    let reply = get(&env, &path, Some("br")).await;
    assert_eq!(
        header(&reply, "cache-control"),
        Some("public, max-age=31536000, immutable")
    );
    let etag = header(&reply, "etag").expect("an etag").to_string();
    // Another coding of the same file is another representation.
    let gzip = get(&env, &path, Some("gzip")).await;
    assert_ne!(header(&gzip, "etag"), Some(etag.as_str()));

    // A browser that holds the copy it would be sent is told so, and sent nothing.
    let held = env
        .handle(request(
            "GET",
            &path,
            &[("accept-encoding", "br"), ("if-none-match", &etag)],
        ))
        .await
        .unwrap();
    assert_eq!(held.status, 304);
    assert!(held.body.is_empty());
    assert_eq!(header(&held, "etag"), Some(etag.as_str()));
    assert_eq!(
        header(&held, "cache-control"),
        Some("public, max-age=31536000, immutable")
    );
    // One that holds another coding is sent the file.
    let other = env
        .handle(request(
            "GET",
            &path,
            &[("accept-encoding", "gzip"), ("if-none-match", &etag)],
        ))
        .await
        .unwrap();
    assert_served(&other, script, Coding::Gzip);

    let page = get(&env, "/", Some("br, gzip")).await;
    assert_eq!(header(&page, "cache-control"), Some("no-cache"));
    let page_tag = header(&page, "etag").expect("the page's etag").to_string();
    let again = env
        .handle(request(
            "GET",
            "/",
            &[
                ("accept-encoding", "br, gzip"),
                ("if-none-match", &page_tag),
            ],
        ))
        .await
        .unwrap();
    assert_eq!(again.status, 304);
    assert!(again.body.is_empty());
    assert_eq!(header(&again, "cache-control"), Some("no-cache"));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn only_the_builds_files_are_served_and_only_read() {
    let env = boot().await;
    let script = compressed_asset();
    let path = format!("/{}", script.path);

    let head = env
        .handle(request("HEAD", &path, &[("accept-encoding", "br")]))
        .await
        .unwrap();
    assert_eq!(head.status, 200);
    assert!(head.body.is_empty());
    assert_eq!(header(&head, "content-encoding"), Some("br"));

    let post = env.handle(request("POST", "/", &[])).await.unwrap();
    assert_eq!(post.status, 405);
    for missing in [
        "/assets/none-00000000.js".to_string(),
        format!("{path}.br"),
        format!("{path}.gz"),
        "/assets/../index.html".to_string(),
    ] {
        let reply = get(&env, &missing, Some("br, gzip")).await;
        assert_eq!(reply.status, 404, "{missing}");
    }
    // The api is still the api.
    let api = get(&env, "/api/apps", None).await;
    assert_eq!(api.status, 200);
    assert_eq!(header(&api, "content-type"), Some("application/json"));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_file_too_large_for_one_reply_is_sent_only_compressed() {
    let env = boot().await;
    let Some(script) = macalicious_desktop::site_bundle()
        .files
        .iter()
        .find(|file| {
            decode_base64(file.base64).unwrap().len()
                > macalicious_desktop::site_serve::MAX_REPLY_BYTES
        })
    else {
        return; // Nothing in this build is over one reply.
    };
    let path = format!("/{}", script.path);
    assert_served(&get(&env, &path, Some("gzip")).await, script, Coding::Gzip);
    if script.br.is_some() {
        assert_served(
            &get(&env, &path, Some("br, gzip")).await,
            script,
            Coding::Brotli,
        );
    }
    for accept in [None, Some("identity"), Some("br;q=0, gzip;q=0")] {
        let refused = get(&env, &path, accept).await;
        assert_eq!(refused.status, 406, "{accept:?}");
        assert_eq!(header(&refused, "vary"), Some("accept-encoding"));
    }
}

/// The gateway sends `/` (every path no other route claims) to the api face,
/// with the two headers serving needs; a content route beside it would never
/// be reached, since the gateway prefers any api route that matches.
#[test]
fn the_manifest_routes_the_site_to_the_api_with_its_headers() {
    let manifest: serde_json::Value =
        serde_json::from_str(include_str!("../ferrite.json")).expect("ferrite.json is JSON");
    let routes = manifest["applications"][0]["routes"].as_array().unwrap();
    let site = routes
        .iter()
        .find(|route| route["prefix"] == "/")
        .expect("the manifest routes /");
    assert_eq!(site["kind"], "api");
    assert_eq!(site["binding"], "requests");
    assert_eq!(site["public"], true);
    for header in ["accept-encoding", "if-none-match"] {
        assert!(
            site["forward_headers"]
                .as_array()
                .is_some_and(|all| all.iter().any(|each| each == header)),
            "{header} is not forwarded"
        );
    }
    assert!(
        routes.iter().all(|route| route["kind"] != "content"),
        "no content route is left"
    );
}

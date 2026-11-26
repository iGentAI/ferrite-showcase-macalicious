//! Network fixtures: shared tests omit outbound bindings; `local-egress`
//! repeats them with Forge's deny-all policy. See tests/README.md.
//!
//! Weather and exchange rates on the in-process Forge planes. The harness's
//! egress is deny-all, so neither source is reached here: these tests hold what
//! the routes do without one (refuse bad input, say the source is down and keep
//! nothing) and that what is kept answers without asking. The parsers' real
//! answers are unit tests beside them; `e2e/weather-rates-batch13-journey.mjs`
//! reaches both sources under `ferrite dev --egress allow`.

use ferrite_app::{serde_json, IngressReply};
use ferrite_app_test::{ingress, TestEnv, TestHarness};
use serde_json::{json, Value};

async fn boot() -> crate::support::Env {
    let slot = crate::support::Slot::acquire();
    let harness = TestHarness::new()
        .with_queue("requests")
        .with_queue("replies")
        .with_store("data");
    #[cfg(feature = "local-egress")]
    let harness = harness.with_egress("weather").with_egress("rates");
    let env = harness.build().await;
    env.run_app(|ctx| async move { macalicious_desktop::run(ctx).await });
    crate::support::Env::new(env, slot)
}

async fn get(env: &TestEnv, path: &str) -> IngressReply {
    env.handle(ingress::get(path)).await.expect("a reply")
}

fn body(reply: &IngressReply) -> Value {
    serde_json::from_slice(&reply.body)
        .unwrap_or_else(|e| panic!("{e}: {}", String::from_utf8_lossy(&reply.body)))
}

async fn seed(env: &TestEnv, key: &str, value: &Value) {
    env.store("data")
        .put(key.as_bytes(), value.to_string().as_bytes())
        .await
        .expect("seed a key");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn weather_refuses_a_point_that_is_not_one_and_a_name_that_is_empty() {
    let env = boot().await;
    for path in [
        "/api/weather/forecast",
        "/api/weather/forecast?lat=91&lon=0",
        "/api/weather/forecast?lat=a&lon=0",
        "/api/weather/places?q=%20",
    ] {
        assert_eq!(get(&env, path).await.status, 400, "{path}");
    }
    assert_eq!(get(&env, "/api/weather/other").await.status, 404);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn weather_says_the_source_is_down_and_keeps_nothing() {
    let env = boot().await;
    let reply = get(&env, "/api/weather/forecast?lat=48.85&lon=2.35").await;
    assert_eq!(reply.status, 200);
    assert!(body(&reply)["unavailable"]
        .as_str()
        .unwrap()
        .starts_with("Open-Meteo: "));
    assert!(body(&reply).get("temperature_c").is_none());
    let kept = env
        .store("data")
        .scan_prefix(b"apps/weather/", None, 8)
        .await
        .expect("a scan");
    assert!(kept.0.is_empty(), "{kept:?}");
    assert_eq!(get(&env, "/api/weather/places?q=Paris").await.status, 502);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn weather_answers_what_is_kept_without_asking() {
    let env = boot().await;
    let now = u64::MAX / 2;
    let kept = |read_at: u64| {
        json!({
            "forecast": {
                "timezone": "Europe/Paris", "observed": "2026-11-06T23:30",
                "temperature_c": 6.8, "code": 45, "condition": "Fog",
                "days": [{"date": "2026-11-06", "high_c": 13.4, "low_c": 6.6, "code": 45, "condition": "Fog"}],
            },
            "read_at": read_at,
        })
    };
    seed(&env, "apps/weather/shared/forecast/48.85,2.35", &kept(now)).await;
    let reply = get(&env, "/api/weather/forecast?lat=48.853&lon=2.349").await;
    assert_eq!(
        body(&reply),
        json!({
            "lat": 48.85, "lon": 2.35, "timezone": "Europe/Paris",
            "observed": "2026-11-06T23:30", "temperature_c": 6.8, "code": 45, "condition": "Fog",
            "days": [{"date": "2026-11-06", "high_c": 13.4, "low_c": 6.6, "code": 45, "condition": "Fog"}],
            "source": "Open-Meteo", "source_url": "https://open-meteo.com/",
            "read_at": now, "cached": true,
        })
    );
    // Past its time and the source down: the same reading, saying why it is old.
    seed(
        &env,
        "apps/weather/shared/forecast/48.85,2.35",
        &kept(1_000),
    )
    .await;
    let old = body(&get(&env, "/api/weather/forecast?lat=48.85&lon=2.35").await);
    assert_eq!(old["observed"], "2026-11-06T23:30");
    assert_eq!(old["temperature_c"], 6.8);
    assert!(old["stale"].as_str().unwrap().starts_with("Open-Meteo: "));
    seed(
        &env,
        "apps/weather/shared/places/paris",
        &json!([{"name": "Paris", "country": "France", "lat": 48.85, "lon": 2.35}]),
    )
    .await;
    assert_eq!(
        body(&get(&env, "/api/weather/places?q=PARIS").await)["places"][0]["name"],
        "Paris"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn rates_say_the_source_is_down_when_none_are_kept() {
    let env = boot().await;
    let reply = get(&env, "/api/calculator/rates").await;
    assert_eq!(reply.status, 502);
    assert!(body(&reply)["error"]
        .as_str()
        .unwrap()
        .starts_with("European Central Bank: "));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn rates_kept_stand_under_their_own_date_and_say_why_they_are_old() {
    let env = boot().await;
    seed(
        &env,
        "apps/calculator/shared/rates/ecb",
        &json!({
            "rates": {"date": "2026-11-06", "rates": {"EUR": 1.0, "USD": 1.1165}},
            "read_at": 1_000,
        }),
    )
    .await;
    let reply = body(&get(&env, "/api/calculator/rates?update=1").await);
    assert_eq!(reply["date"], "2026-11-06");
    assert_eq!(reply["rates"], json!({"EUR": 1.0, "USD": 1.1165}));
    assert_eq!(reply["source"], "European Central Bank");
    assert!(reply["stale"]
        .as_str()
        .unwrap()
        .starts_with("European Central Bank: "));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn rates_read_recently_answer_without_asking() {
    let env = boot().await;
    let now = ferrite_app::serde_json::json!(u64::MAX / 2);
    seed(
        &env,
        "apps/calculator/shared/rates/ecb",
        &json!({
            "rates": {"date": "2026-11-06", "rates": {"EUR": 1.0, "USD": 1.1165}},
            "read_at": now,
        }),
    )
    .await;
    for path in ["/api/calculator/rates", "/api/calculator/rates?update=1"] {
        let reply = body(&get(&env, path).await);
        assert_eq!(reply["rates"]["USD"], 1.1165, "{path}");
        assert!(reply.get("stale").is_none(), "{path}: {reply}");
    }
}

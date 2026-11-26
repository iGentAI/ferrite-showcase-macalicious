// Deployment consumes ferrite.json as its spec, so source-side unit tests read
// this generated asset. Its bytes must still be the actual deployment manifest.
#[test]
fn embedded_manifest_matches_the_deployment_manifest() {
    assert_eq!(
        include_str!("fixtures/ferrite.json"),
        include_str!("../ferrite.json"),
        "run node scripts/sync-test-manifest.mjs after changing ferrite.json"
    );
}

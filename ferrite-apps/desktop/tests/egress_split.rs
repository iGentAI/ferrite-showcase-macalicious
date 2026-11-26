//! `ferrite.json`'s egress handles and `src/apps/egress.rs`'s split table name
//! the same destinations, and no handle declares more than the platform's
//! capability holds (16 key prefixes; a deploy past it is refused).

use ferrite_app::serde_json::Value;
use macalicious_desktop::apps::egress::{MAX_DESTINATIONS, SPLIT};

#[test]
fn the_manifest_and_the_split_table_agree() {
    let text = include_str!("../ferrite.json");
    let spec: Value = ferrite_app::serde_json::from_str(text).expect("ferrite.json parses");
    let egress = spec["applications"][0]["egress"]
        .as_array()
        .expect("egress");
    for entry in egress {
        let handle = entry["handle"].as_str().expect("handle");
        let destinations: Vec<&str> = entry["destinations"]
            .as_array()
            .expect("destinations")
            .iter()
            .map(|d| d.as_str().expect("destination"))
            .collect();
        assert!(
            destinations.len() <= MAX_DESTINATIONS,
            "{handle} declares {} destinations",
            destinations.len()
        );
        if let Some((_, _, table)) = SPLIT.iter().find(|(_, h, _)| *h == handle) {
            assert_eq!(&destinations, table, "{handle}");
        }
    }
    for (_, handle, _) in SPLIT {
        assert!(
            egress.iter().any(|e| e["handle"] == *handle),
            "{handle} is not declared"
        );
    }
}

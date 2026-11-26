//! The FOSSGIS OSRM routers' answers as the module's routes.
//!
//! A route answer is read strictly ([`super::super::fetch::strict`]). Only the
//! router's `NoRoute` and `NoSegment` codes read as "no journey". `Ok` with no
//! routes, any other code, and a route not in OSRM's shape fail the answer.
//!
//! A step's sentence is written here from its maneuver, as the routers give
//! no text: <https://project-osrm.org/docs/v5.24.0/api/#stepmaneuver-object>.

use ferrite_app::{serde, serde_json};
use serde_json::{Map, Value};

use super::super::fetch::strict::{self, Strict};
use super::valid_point;

/// The most points of a route's line a reply carries; a longer line keeps
/// every n-th point and its ends.
pub const MAX_PATH_POINTS: usize = 2_000;
/// The most steps a route may have. A longer one fails with that said: a list
/// of steps with some left out would read as a whole journey.
pub const MAX_STEPS: usize = 1_000;

/// How the journey is made.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mode {
    Driving,
    Walking,
}

impl Mode {
    /// `driving` or `walking`.
    pub fn parse(text: &str) -> Option<Self> {
        match text {
            "driving" => Some(Self::Driving),
            "walking" => Some(Self::Walking),
            _ => None,
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            Self::Driving => "driving",
            Self::Walking => "walking",
        }
    }

    /// The router's path for this mode.
    fn router(self) -> &'static str {
        match self {
            Self::Driving => "routed-car/route/v1/driving",
            Self::Walking => "routed-foot/route/v1/foot",
        }
    }
}

/// The URL the router is asked.
pub fn route_url(base: &str, mode: Mode, from: (f64, f64), to: (f64, f64)) -> String {
    format!(
        "{base}/{}/{:.5},{:.5};{:.5},{:.5}?overview=full&geometries=geojson&steps=true",
        mode.router(),
        from.1,
        from.0,
        to.1,
        to.0
    )
}

/// One instruction of a route.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Step {
    pub text: String,
    pub distance_m: f64,
    pub lat: f64,
    pub lon: f64,
}

/// A route: its length, time, the line to draw (`[lat, lon]`) and its steps.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Route {
    pub distance_m: f64,
    pub duration_s: f64,
    pub path: Vec<[f64; 2]>,
    pub steps: Vec<Step>,
}

/// What the router answered: a route, or that the two points have no journey.
/// What is cached is an `Option`: `null` for no journey.
pub type Answer = Option<Route>;

/// Whether a body under a status other than 200 is the router saying there is
/// no journey: OSRM answers those with 400 and the code.
pub fn says_no_journey(body: &[u8]) -> bool {
    let Ok(Value::Object(answer)) = strict::json(body) else {
        return false;
    };
    matches!(
        answer.get("code").and_then(Value::as_str),
        Some("NoRoute" | "NoSegment")
    )
}

/// The first route of a 200 answer's body, or `None` for the codes that mean
/// no journey.
pub fn read_answer(body: &[u8]) -> Strict<Answer> {
    let answer = strict::json(body)?;
    let answer = strict::object(&answer, "the answer")?;
    match strict::text(answer, "code")? {
        "Ok" => {}
        "NoRoute" | "NoSegment" => return Ok(None),
        code => return strict::fail(format!("the router answered {code}")),
    }
    let routes = strict::list(strict::field(answer, "routes")?, "`routes`")?;
    let Some(route) = routes.first() else {
        return strict::fail("`routes` is empty");
    };
    read_route(strict::object(route, "a route")?).map(Some)
}

fn read_route(route: &Map<String, Value>) -> Strict<Route> {
    let geometry = strict::object(strict::field(route, "geometry")?, "`geometry`")?;
    let points = strict::list(strict::field(geometry, "coordinates")?, "`coordinates`")?;
    let legs = strict::list(strict::field(route, "legs")?, "`legs`")?;
    let mut steps = Vec::new();
    for leg in legs {
        let leg = strict::object(leg, "a leg")?;
        let raw = strict::list(strict::field(leg, "steps")?, "`steps`")?;
        steps.extend(strict::each(raw, "steps", read_step)?.into_iter().flatten());
    }
    if steps.is_empty() {
        return strict::fail("a route has no steps");
    }
    if steps.len() > MAX_STEPS {
        return strict::fail(format!("a route has more than {MAX_STEPS} steps"));
    }
    Ok(Route {
        distance_m: strict::number(route, "distance")?,
        duration_s: strict::number(route, "duration")?,
        path: thinned(&strict::each(points, "coordinates", read_point)?),
        steps,
    })
}

/// `[lon, lat]` as the module's `[lat, lon]`.
fn read_point(point: &Value) -> Strict<[f64; 2]> {
    let pair = strict::list(point, "a point")?;
    let (Some(lon), Some(lat), 2) = (
        pair.first().and_then(Value::as_f64),
        pair.get(1).and_then(Value::as_f64),
        pair.len(),
    ) else {
        return strict::fail("a point is not [longitude, latitude]");
    };
    if !valid_point(lat, lon) {
        return strict::fail("a point is off the globe");
    }
    Ok([lat, lon])
}

/// At most [`MAX_PATH_POINTS`] of `points`: every n-th, and always the last.
fn thinned(points: &[[f64; 2]]) -> Vec<[f64; 2]> {
    if points.len() <= MAX_PATH_POINTS {
        return points.to_vec();
    }
    let every = points.len().div_ceil(MAX_PATH_POINTS - 1);
    let mut kept: Vec<[f64; 2]> = points.iter().step_by(every).copied().collect();
    if let Some(last) = points.last().filter(|last| kept.last() != Some(*last)) {
        kept.push(*last);
    }
    kept
}

/// A step as a [`Step`]; `None` for what has nothing to say (a lane change on
/// the same road, a notification).
fn read_step(step: &Value) -> Strict<Option<Step>> {
    let step = strict::object(step, "a step")?;
    let maneuver = strict::object(strict::field(step, "maneuver")?, "`maneuver`")?;
    let at = read_point(strict::field(maneuver, "location")?)?;
    let Some(text) = sentence(step, maneuver)? else {
        return Ok(None);
    };
    Ok(Some(Step {
        text,
        distance_m: strict::number(step, "distance")?,
        lat: at[0],
        lon: at[1],
    }))
}

/// The compass point a bearing in degrees is nearest.
fn compass(bearing: f64) -> &'static str {
    const POINTS: [&str; 8] = [
        "north",
        "northeast",
        "east",
        "southeast",
        "south",
        "southwest",
        "west",
        "northwest",
    ];
    POINTS[((bearing.rem_euclid(360.0) + 22.5) / 45.0) as usize % 8]
}

/// The sentence for a step, as Maps writes one.
fn sentence(step: &Map<String, Value>, maneuver: &Map<String, Value>) -> Strict<Option<String>> {
    let kind = strict::text(maneuver, "type")?;
    let modifier = strict::optional_text(maneuver, "modifier")?;
    let name = strict::optional_text(step, "name")?.filter(|name| !name.is_empty());
    let road = name.or(strict::optional_text(step, "ref")?.filter(|name| !name.is_empty()));
    let onto = road.map_or(String::new(), |road| format!(" onto {road}"));
    let side = |base: &str| match modifier {
        Some("straight") | None => format!("{base}{onto}"),
        Some("uturn") => format!("Make a U-turn{onto}"),
        Some(direction) => format!("{base} {direction}{onto}"),
    };
    let on_side = match modifier {
        Some(direction) if direction.contains("left") => " on the left",
        Some(direction) if direction.contains("right") => " on the right",
        _ => "",
    };
    let text = match kind {
        "depart" => {
            let bearing = strict::number(maneuver, "bearing_after")?;
            match road {
                Some(road) => format!("Head {} on {road}", compass(bearing)),
                None => format!("Head {}", compass(bearing)),
            }
        }
        "arrive" => match modifier {
            Some(side @ ("left" | "right")) => {
                format!("Arrive at your destination, on the {side}")
            }
            _ => "Arrive at your destination".to_owned(),
        },
        "turn" | "end of road" => match modifier {
            Some("straight") | None => format!("Continue{onto}"),
            _ => side("Turn"),
        },
        "new name" | "continue" => side("Continue"),
        "merge" => side("Merge"),
        "on ramp" => format!("Take the ramp{on_side}{onto}"),
        "off ramp" => match strict::optional_text(step, "exits")?.filter(|exits| !exits.is_empty())
        {
            Some(exits) => format!("Take exit {exits}{on_side}{onto}"),
            None => format!("Take the exit{on_side}{onto}"),
        },
        "fork" => side("Keep"),
        "roundabout" | "rotary" => {
            let word = if kind == "rotary" {
                "rotary"
            } else {
                "roundabout"
            };
            match maneuver.get("exit").and_then(Value::as_u64) {
                Some(exit) => format!("At the {word}, take exit {exit}{onto}"),
                None => format!("At the {word}, continue{onto}"),
            }
        }
        // A turn at a small roundabout: the router gives its direction, and no exit.
        "roundabout turn" => match modifier {
            Some("straight") | None => format!("At the roundabout, continue{onto}"),
            Some("uturn") => format!("At the roundabout, make a U-turn{onto}"),
            Some(direction) => format!("At the roundabout, turn {direction}{onto}"),
        },
        "exit roundabout" | "exit rotary" => format!("Leave the roundabout{onto}"),
        "use lane" | "notification" => return Ok(None),
        other => return strict::fail(format!("the maneuver `{other}` is not known")),
    };
    Ok(Some(text))
}

/// A kept answer is one this module wrote: every point on the globe and within
/// the reply's bounds.
pub fn validate(answer: &Answer) -> Result<(), String> {
    let Some(route) = answer else {
        return Ok(());
    };
    if route.path.len() > MAX_PATH_POINTS || route.steps.len() > MAX_STEPS {
        return Err("a route over its bounds".into());
    }
    if route
        .path
        .iter()
        .any(|point| !valid_point(point[0], point[1]))
        || route
            .steps
            .iter()
            .any(|step| !valid_point(step.lat, step.lon))
    {
        return Err("a point off the globe".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// routing.openstreetmap.de's answer for two points in Cupertino, cut down
    /// to the fields read here and two others the router also sends.
    const CUPERTINO: &str = r#"{"code":"Ok","waypoints":[],"routes":[{"weight":312.1,"distance":3334.6,"duration":312.1,
      "geometry":{"type":"LineString","coordinates":[[-122.012296,37.333884],[-122.012305,37.333832],[-122.03,37.33]]},
      "legs":[{"steps":[
        {"name":"Infinite Loop","distance":120.5,"maneuver":{"type":"depart","bearing_after":191,"location":[-122.012296,37.333884]}},
        {"name":"","ref":"I 280","distance":3000,"maneuver":{"type":"turn","modifier":"left","location":[-122.012305,37.333832]}},
        {"name":"","distance":0,"maneuver":{"type":"use lane","modifier":"straight","location":[-122.02,37.33]}},
        {"name":"Stevens Creek","distance":0,"maneuver":{"type":"arrive","modifier":"right","location":[-122.03,37.33]}}
      ]}]}]}"#;

    #[test]
    fn a_route_reads_with_its_line_and_its_sentences() {
        let route = read_answer(CUPERTINO.as_bytes()).unwrap().unwrap();
        assert_eq!(route.distance_m, 3334.6);
        assert_eq!(route.duration_s, 312.1);
        assert_eq!(route.path[0], [37.333884, -122.012296]);
        assert_eq!(route.path.len(), 3);
        let said: Vec<&str> = route.steps.iter().map(|step| step.text.as_str()).collect();
        assert_eq!(
            said,
            [
                "Head south on Infinite Loop",
                "Turn left onto I 280",
                "Arrive at your destination, on the right",
            ]
        );
        assert_eq!(route.steps[1].lat, 37.333832);
        assert_eq!(validate(&Some(route)), Ok(()));
    }

    #[test]
    fn only_the_routers_two_codes_read_as_no_journey() {
        assert_eq!(read_answer(br#"{"code":"NoRoute"}"#).unwrap(), None);
        assert_eq!(read_answer(br#"{"code":"NoSegment"}"#).unwrap(), None);
        assert!(says_no_journey(br#"{"code":"NoRoute","message":"x"}"#));
        assert!(!says_no_journey(br#"{"code":"TooBig"}"#));
        assert!(!says_no_journey(b"<html>busy</html>"));
        assert!(read_answer(br#"{"code":"InvalidQuery"}"#).is_err());
        assert_eq!(
            read_answer(br#"{"code":"Ok","routes":[]}"#).unwrap_err().0,
            "`routes` is empty"
        );
        assert!(read_answer(br#"{"code":"Ok"}"#).is_err());
        assert!(read_answer(b"not json").is_err());
    }

    #[test]
    fn a_step_of_the_wrong_shape_fails_the_whole_answer() {
        let unknown = CUPERTINO.replace("\"use lane\"", "\"teleport\"");
        assert!(read_answer(unknown.as_bytes())
            .unwrap_err()
            .0
            .contains("teleport"));
        let off = CUPERTINO.replace("[-122.03,37.33]]", "[-122.03,97.33]]");
        assert!(read_answer(off.as_bytes())
            .unwrap_err()
            .0
            .contains("off the globe"));
    }

    #[test]
    fn each_maneuver_has_its_sentence() {
        let said = |kind: &str, modifier: Option<&str>, name: &str, extra: &str| {
            let modifier = modifier.map_or(String::new(), |m| format!(r#","modifier":"{m}""#));
            let body =
                format!(r#"{{"name":"{name}","maneuver":{{"type":"{kind}"{modifier}{extra}}}}}"#);
            let step: Value = serde_json::from_str(&body).unwrap();
            let step = step.as_object().unwrap();
            sentence(step, step["maneuver"].as_object().unwrap()).unwrap()
        };
        let cases = [
            (
                "turn",
                Some("sharp right"),
                "Elm",
                "",
                "Turn sharp right onto Elm",
            ),
            ("turn", Some("uturn"), "", "", "Make a U-turn"),
            ("turn", Some("straight"), "Elm", "", "Continue onto Elm"),
            ("end of road", Some("left"), "Elm", "", "Turn left onto Elm"),
            ("new name", Some("straight"), "Oak", "", "Continue onto Oak"),
            (
                "merge",
                Some("slight left"),
                "Oak",
                "",
                "Merge slight left onto Oak",
            ),
            (
                "on ramp",
                Some("right"),
                "I 5",
                "",
                "Take the ramp on the right onto I 5",
            ),
            (
                "off ramp",
                Some("right"),
                "Oak",
                "",
                "Take the exit on the right onto Oak",
            ),
            ("fork", Some("left"), "", "", "Keep left"),
            (
                "roundabout",
                None,
                "Oak",
                r#","exit":2"#,
                "At the roundabout, take exit 2 onto Oak",
            ),
            ("rotary", None, "", "", "At the rotary, continue"),
            (
                "exit roundabout",
                None,
                "Oak",
                "",
                "Leave the roundabout onto Oak",
            ),
            ("depart", None, "", r#","bearing_after":350"#, "Head north"),
            (
                "arrive",
                Some("straight"),
                "",
                "",
                "Arrive at your destination",
            ),
        ];
        for (kind, modifier, name, extra, expected) in cases {
            assert_eq!(
                said(kind, modifier, name, extra).as_deref(),
                Some(expected),
                "{kind}"
            );
        }
        assert_eq!(said("notification", None, "", ""), None);
        assert_eq!(
            said("roundabout turn", Some("left"), "Oak", "").as_deref(),
            Some("At the roundabout, turn left onto Oak")
        );
        assert_eq!(
            said("roundabout turn", Some("right"), "", "").as_deref(),
            Some("At the roundabout, turn right")
        );
        assert_eq!(
            said("on ramp", Some("slight left"), "I 5", "").as_deref(),
            Some("Take the ramp on the left onto I 5")
        );
        assert_eq!(
            said("off ramp", Some("slight left"), "Oak", "").as_deref(),
            Some("Take the exit on the left onto Oak")
        );
        let numbered: Value = serde_json::from_str(
            r#"{"name":"Oak","exits":"12B","maneuver":{"type":"off ramp","modifier":"right"}}"#,
        )
        .unwrap();
        let numbered = numbered.as_object().unwrap();
        assert_eq!(
            sentence(numbered, numbered["maneuver"].as_object().unwrap())
                .unwrap()
                .as_deref(),
            Some("Take exit 12B on the right onto Oak")
        );
    }

    #[test]
    fn a_route_with_too_many_steps_fails_rather_than_loses_some() {
        let step = r#"{"name":"Elm","distance":1,"maneuver":{"type":"turn","modifier":"left","location":[1,1]}}"#;
        let body = |count: usize| {
            format!(
                r#"{{"code":"Ok","routes":[{{"distance":1,"duration":1,"geometry":{{"coordinates":[[1,1]]}},"legs":[{{"steps":[{}]}}]}}]}}"#,
                vec![step; count].join(",")
            )
        };
        assert_eq!(
            read_answer(body(MAX_STEPS).as_bytes())
                .unwrap()
                .unwrap()
                .steps
                .len(),
            MAX_STEPS
        );
        assert!(read_answer(body(MAX_STEPS + 1).as_bytes())
            .unwrap_err()
            .0
            .contains("more than 1000 steps"));
    }

    #[test]
    fn a_long_line_keeps_its_ends_within_the_bound() {
        let line: Vec<[f64; 2]> = (0..6_001).map(|n| [0.0, f64::from(n) / 100.0]).collect();
        let kept = thinned(&line);
        assert!(kept.len() <= MAX_PATH_POINTS, "{}", kept.len());
        assert_eq!(kept.first(), line.first());
        assert_eq!(kept.last(), line.last());
        assert_eq!(thinned(&line[..5]).len(), 5);
    }

    #[test]
    fn the_url_is_longitude_first_and_the_modes_own_router() {
        assert_eq!(
            route_url("https://r", Mode::Walking, (37.8199, -122.4783), (37.803, -122.4662)),
            "https://r/routed-foot/route/v1/foot/-122.47830,37.81990;-122.46620,37.80300?overview=full&geometries=geojson&steps=true"
        );
        assert!(
            route_url("https://r", Mode::Driving, (1.0, 2.0), (3.0, 4.0))
                .starts_with("https://r/routed-car/route/v1/driving/2.00000,1.00000;")
        );
        assert_eq!(Mode::parse("driving"), Some(Mode::Driving));
        assert_eq!(Mode::parse("flying"), None);
    }
}

//! Network Utility's server half: DNS lookups and registry records over HTTPS
//! through the application's declared egress, a labelled HTTPS round trip,
//! and the session's recent lookups.
//!
//! A Ferrite application has no sockets and cannot see the machine's network
//! interfaces; its only way out is outbound HTTPS to the destinations its
//! manifest declares (`ferrite.json`). So of Network Utility's eight panes
//! Lookup and Whois can be real: Lookup asks a public DNS-over-HTTPS resolver
//! ([`RESOLVERS`], public JSON APIs that need no key) through [`EGRESS`],
//! and Whois asks a registry over RDAP ([`registry`]) through [`RDAP_EGRESS`].
//!
//! * `GET /api/network-utility/lookup?host=<name or IPv4 address>[&type=<t>][&server=<s>]`:
//!   `{"host", "resolver", "questions": [{"name", "type", "status",
//!   "answers": [{"name", "type", "ttl", "data"}]}], "at"}`. A name is
//!   asked for its `A` and `AAAA` records; an IPv4 address for its `PTR`
//!   record; `type`, one of [`RECORD_TYPES`], asks for that instead; `server`,
//!   one of [`RESOLVERS`], chooses the resolver, the first by default. `status`
//!   is the resolver's DNS response code (`NOERROR`, `NXDOMAIN`, ...). A host
//!   that is not a DNS name or an IPv4 address is refused with 400; a resolver
//!   that cannot be reached or refuses answers 502, and nothing is recorded.
//!   Each answered lookup is added to the session's history.
//! * `GET /api/network-utility/whois?query=<domain or IPv4 address>`:
//!   `{"query", "registry", "found", "facts": [{"label", "value"}], "at"}`.
//!   A query no declared registry holds is refused with 400; a registry that
//!   answers with a redirect, which egress does not follow, answers 502.
//! * `GET /api/network-utility/roundtrip?host=<name>`: `{"host", "declared":
//!   true, "status"}` after one HTTPS request to a host the `web` egress group
//!   declares; `{"host", "declared": false, "hosts": [...]}` for any other
//!   host, with nothing sent. The page times the whole request itself and says
//!   it is not ping.
//! * `GET /api/network-utility/declared`: `{"hosts", "dns", "rdap"}`, the way
//!   out this application has, which is what Netstat can truly show.
//! * `GET /api/network-utility/history`: `{"history": [{"host", "at",
//!   "answers"}], "rev"}`, newest first, at most [`HISTORY`], or `null`
//!   before the first lookup. `answers` counts the records found.
//! * `DELETE /api/network-utility/history`: forgets the history
//!   (`document.rs`), as Storage Management does.
//!
//! Gaps, as the window says them: no ping, traceroute, port scan, netstat or
//! finger, because an application has no sockets and its egress refuses
//! internal addresses; no interface information, because the application is
//! shown no network interfaces. Lookups go through a resolver the application
//! declares, not the machine's own.

use ferrite_app::{serde, serde_json, EgressHeader, EgressHttpMethod, EgressOutcome};
use serde_json::Value;

use super::{document, egress};
use crate::http::Response;
use crate::module::{ApiCtx, AppModule, HandlerFuture};

pub const MODULE: AppModule = AppModule {
    name: "network-utility",
    title: "Network Utility",
    handle,
};

/// The egress handle `ferrite.json` declares for the resolver.
pub const EGRESS: &str = "dns";
/// `(what the window calls it, its JSON API, which is also a destination of [`EGRESS`])`.
/// Both answer the same `name`, `type` and `application/dns-json`.
pub const RESOLVERS: &[(&str, &str)] = &[
    ("cloudflare", "https://cloudflare-dns.com/dns-query"),
    ("google", "https://dns.google/resolve"),
];
/// The egress handle `ferrite.json` declares for the RDAP registries.
pub const RDAP_EGRESS: &str = "rdap";
/// `(what a query ends in, the registry's RDAP base)`: each is a declared
/// destination and answers without a redirect, which egress does not follow.
pub const REGISTRIES: &[(&str, &str)] = &[
    ("com", "https://rdap.verisign.com/com/v1/domain/"),
    ("net", "https://rdap.verisign.com/net/v1/domain/"),
    (
        "org",
        "https://rdap.publicinterestregistry.org/rdap/domain/",
    ),
];
/// The registry asked about IPv4 addresses. It redirects for an address
/// another regional registry manages, which the window then says.
pub const RDAP_IP: &str = "https://rdap.arin.net/registry/ip/";
/// The record types a lookup can ask for.
pub const RECORD_TYPES: &[&str] = &["A", "AAAA", "CNAME", "MX", "NS", "PTR", "SOA", "TXT"];
/// The egress group whose whole-host destinations a round trip may reach.
const ROUND_TRIP_GROUP: &str = "web";
/// The most lookups the history keeps.
pub const HISTORY: usize = 20;
/// The most answers of one question that are kept.
const MAX_ANSWERS: usize = 50;
const KEY: &str = "history";

/// One lookup in the history.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "ferrite_app::serde", deny_unknown_fields)]
pub struct Past {
    pub host: String,
    pub at: u64,
    pub answers: usize,
}

fn handle(cx: ApiCtx<'_>) -> HandlerFuture<'_> {
    Box::pin(route(cx))
}

async fn route(mut cx: ApiCtx<'_>) -> Response {
    let session = cx.session;
    match (cx.request.method, cx.request.path) {
        ("GET", "/lookup") => {
            let raw = cx.request.query_param("host").unwrap_or("");
            let kind = cx.request.query_param("type").unwrap_or("");
            let chosen = cx.request.query_param("server").unwrap_or("");
            let Some(resolver) = resolver_named(chosen) else {
                return Response::error(400, &format!("{chosen:?} is not a lookup server here"));
            };
            let host = match super::spotlight::decode(raw).as_deref().map(target) {
                Some(Ok(host)) => host,
                Some(Err(message)) => return Response::error(400, &message),
                None => return Response::error(400, "the host is not valid percent-encoded UTF-8"),
            };
            match asking_for(host, kind) {
                Ok(host) => lookup(&mut cx, host, resolver).await,
                Err(message) => Response::error(400, &message),
            }
        }
        (_, "/lookup") => Response::method_not_allowed(),
        ("GET", "/whois") => {
            let raw = cx.request.query_param("query").unwrap_or("");
            let asked = super::spotlight::decode(raw)
                .as_deref()
                .map(target)
                .unwrap_or_else(|| Err("the query is not valid percent-encoded UTF-8".into()))
                .and_then(|target| registry(&target));
            match asked {
                Ok((query, url)) => whois(&mut cx, query, url).await,
                Err(message) => Response::error(400, &message),
            }
        }
        (_, "/whois") => Response::method_not_allowed(),
        ("GET", "/roundtrip") => {
            let raw = cx.request.query_param("host").unwrap_or("");
            let asked = super::spotlight::decode(raw)
                .as_deref()
                .map(target)
                .unwrap_or_else(|| Err("the host is not valid percent-encoded UTF-8".into()));
            match asked {
                Ok(target) => round_trip(&mut cx, target).await,
                Err(message) => Response::error(400, &message),
            }
        }
        (_, "/roundtrip") => Response::method_not_allowed(),
        ("GET", "/declared") => Response::json(
            200,
            &serde_json::json!({
                "hosts": declared_hosts(),
                "dns": RESOLVERS.iter().map(|(_, url)| host_of(url)).collect::<Vec<_>>(),
                "rdap": REGISTRIES
                    .iter()
                    .map(|(_, url)| *url)
                    .chain([RDAP_IP])
                    .map(host_of)
                    .collect::<std::collections::BTreeSet<_>>(),
            }),
        ),
        (_, "/declared") => Response::method_not_allowed(),
        ("GET", "/history") => match document::read::<Vec<Past>>(&mut cx.storage.user(), KEY).await
        {
            Ok(current) => document::for_session(reply(current.doc.as_ref(), current.rev), session),
            Err(error) => Response::error(503, &format!("storage failed: {error}")),
        },
        ("DELETE", "/history") => {
            match document::write::<Vec<Past>>(&mut cx.storage.user(), KEY, None, None).await {
                Ok(saved) => document::answer(saved, None, reply),
                Err(error) => Response::error(503, &format!("storage failed: {error}")),
            }
        }
        (_, "/history") => Response::method_not_allowed(),
        _ => Response::not_found(),
    }
}

fn reply(history: Option<&Vec<Past>>, rev: u64) -> Value {
    serde_json::json!({ "history": history, "rev": rev })
}

/// What a lookup asks: the name and the record types.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Target {
    /// What was typed, as it is shown.
    pub host: String,
    /// The name asked about.
    pub name: String,
    pub types: &'static [&'static str],
}

/// A dotted IPv4 address's four numbers: each 0 to 255, in decimal, with
/// no leading zero. (The gate refuses `std::net`, so it is parsed here.)
pub fn ipv4(text: &str) -> Option<[u8; 4]> {
    let mut octets = [0u8; 4];
    let mut parts = text.split('.');
    for octet in &mut octets {
        let part = parts.next()?;
        let digits = (1..=3).contains(&part.len()) && part.bytes().all(|b| b.is_ascii_digit());
        if !digits || (part.len() > 1 && part.starts_with('0')) {
            return None;
        }
        *octet = part.parse().ok()?;
    }
    parts.next().is_none().then_some(octets)
}

/// Check what was typed: a DNS name (ASCII letters, digits and hyphens, in
/// labels of 1 to 63 that neither start nor end with a hyphen, at most 253
/// characters, an optional final dot) or a dotted IPv4 address, whose
/// `in-addr.arpa` name is asked for `PTR`.
pub fn target(typed: &str) -> Result<Target, String> {
    let host = typed.trim().to_ascii_lowercase();
    if host.is_empty() {
        return Err("enter a host name or an IPv4 address".into());
    }
    if let Some([a, b, c, d]) = ipv4(&host) {
        return Ok(Target {
            name: format!("{d}.{c}.{b}.{a}.in-addr.arpa"),
            host,
            types: &["PTR"],
        });
    }
    if host.contains(':') {
        return Err(
            "IPv6 addresses are not looked up; enter a host name or an IPv4 address".into(),
        );
    }
    let name = host.strip_suffix('.').unwrap_or(&host);
    let valid_label = |label: &str| {
        (1..=63).contains(&label.len())
            && label
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
            && !label.starts_with('-')
            && !label.ends_with('-')
    };
    if name.len() > 253 || !name.split('.').all(valid_label) {
        return Err(format!("{typed:?} is not a host name or an IPv4 address"));
    }
    Ok(Target {
        name: name.to_string(),
        host: host.clone(),
        types: &["A", "AAAA"],
    })
}

/// The target asking for one record type, when `kind` names one.
pub fn asking_for(target: Target, kind: &str) -> Result<Target, String> {
    if kind.is_empty() {
        return Ok(target);
    }
    match RECORD_TYPES.iter().position(|known| *known == kind) {
        Some(at) => Ok(Target {
            types: &RECORD_TYPES[at..=at],
            ..target
        }),
        None => Err(format!(
            "{kind:?} is not a record type this lookup asks for"
        )),
    }
}

/// What the registry is asked, and at which URL: a name's registered domain
/// at the registry of its top level, or an IPv4 address at ARIN. Any other
/// query has no declared registry.
pub fn registry(target: &Target) -> Result<(String, String), String> {
    if ipv4(&target.host).is_some() {
        return Ok((target.host.clone(), format!("{RDAP_IP}{}", target.host)));
    }
    let labels: Vec<&str> = target.name.rsplit('.').collect();
    let base = labels
        .first()
        .and_then(|top| REGISTRIES.iter().find(|(end, _)| end == top));
    match (base, labels.get(1)) {
        (Some((top, url)), Some(second)) => {
            let domain = format!("{second}.{top}");
            Ok((domain.clone(), format!("{url}{domain}")))
        }
        _ => Err(format!(
            "no registry for {} is declared: Whois asks about names under .com, .net and .org, and IPv4 addresses",
            target.name
        )),
    }
}

/// The host of an `https://` URL.
fn host_of(url: &str) -> &str {
    let rest = url.strip_prefix("https://").unwrap_or(url);
    rest.split('/').next().unwrap_or(rest)
}

/// The whole hosts the round-trip group declares, each `https://<host>/`.
pub fn declared_hosts() -> Vec<&'static str> {
    egress::SPLIT
        .iter()
        .filter(|(group, _, _)| *group == ROUND_TRIP_GROUP)
        .flat_map(|(_, _, destinations)| destinations.iter().copied())
        .filter(|url| host_of(url).len() + "https:///".len() == url.len())
        .map(host_of)
        .collect()
}

/// One registry record as labelled lines, from its RDAP JSON (RFC 9083), or
/// `None` when the answer is not an object.
pub fn rdap_facts(body: &[u8]) -> Option<Vec<Value>> {
    let record: Value = serde_json::from_slice(body).ok()?;
    record.as_object()?;
    let list = |key: &str| {
        record
            .get(key)
            .and_then(Value::as_array)
            .map(Vec::as_slice)
            .unwrap_or(&[])
    };
    let text = |key: &str| record.get(key).and_then(Value::as_str).unwrap_or("");
    let mut facts = Vec::new();
    let mut fact = |label: &str, value: &str| {
        if !value.is_empty() {
            facts.push(serde_json::json!({ "label": label, "value": value }));
        }
    };
    fact("Domain Name", text("ldhName"));
    fact("Handle", text("handle"));
    fact("Network Name", text("name"));
    if !text("startAddress").is_empty() {
        let range = format!("{} - {}", text("startAddress"), text("endAddress"));
        fact("Range", &range);
    }
    fact("Country", text("country"));
    for each in list("status") {
        fact("Status", each.as_str().unwrap_or(""));
    }
    for entity in list("entities") {
        let registrar = entity
            .get("roles")
            .and_then(Value::as_array)
            .is_some_and(|roles| roles.iter().any(|role| role == "registrar"));
        if registrar {
            fact("Registrar", &vcard_name(entity));
        }
    }
    for event in list("events") {
        let action = event
            .get("eventAction")
            .and_then(Value::as_str)
            .unwrap_or("");
        let date = event.get("eventDate").and_then(Value::as_str).unwrap_or("");
        if !action.is_empty() {
            fact(action, date);
        }
    }
    for server in list("nameservers") {
        fact(
            "Name Server",
            server.get("ldhName").and_then(Value::as_str).unwrap_or(""),
        );
    }
    Some(facts)
}

/// The full name in an RDAP entity's vCard (`["vcard", [["fn", {}, "text", name], ...]]`).
fn vcard_name(entity: &Value) -> String {
    entity
        .pointer("/vcardArray/1")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .find(|field| field.get(0).is_some_and(|name| name == "fn"))
        .and_then(|field| field.get(3))
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string()
}

async fn whois(cx: &mut ApiCtx<'_>, query: String, url: String) -> Response {
    let mut egress = match cx.ctx.egress(RDAP_EGRESS) {
        Ok(egress) => egress,
        Err(error) => return Response::error(503, &format!("no egress to the registry: {error}")),
    };
    let accept = [EgressHeader {
        name: "accept".into(),
        value: "application/rdap+json".into(),
    }];
    let outcome = egress
        .deliver_http(EgressHttpMethod::Get, &url, &accept, &[])
        .await;
    let facts = match outcome {
        Ok(EgressOutcome::Delivered { status: 200, body }) => match rdap_facts(&body) {
            Some(facts) => facts,
            None => return Response::error(502, "the registry's answer is not RDAP JSON"),
        },
        Ok(EgressOutcome::Delivered { status: 404, .. }) => Vec::new(),
        Ok(EgressOutcome::Delivered { status, .. }) if (300..400).contains(&status) => {
            return Response::error(
                502,
                &format!("the registry sends this query elsewhere (HTTP {status}), which the application's egress does not follow"),
            )
        }
        Ok(EgressOutcome::Delivered { status, .. }) => {
            return Response::error(502, &format!("the registry answered HTTP {status}"))
        }
        Ok(EgressOutcome::Denied { reason }) => {
            return Response::error(502, &format!("egress refused the registry: {reason}"))
        }
        Err(error) => {
            return Response::error(502, &format!("the registry could not be reached: {error}"))
        }
    };
    Response::json(
        200,
        &serde_json::json!({
            "query": query,
            "registry": host_of(&url),
            "found": !facts.is_empty(),
            "facts": facts,
            "at": cx.now_ms,
        }),
    )
}

async fn round_trip(cx: &mut ApiCtx<'_>, target: Target) -> Response {
    if !declared_hosts().contains(&target.name.as_str()) {
        return Response::json(
            200,
            &serde_json::json!({
                "host": target.host,
                "declared": false,
                "hosts": declared_hosts(),
            }),
        );
    }
    let url = format!("https://{}/", target.name);
    let handle = egress::pick(ROUND_TRIP_GROUP, &url);
    let mut out = match cx.ctx.egress(handle) {
        Ok(out) => out,
        Err(error) => return Response::error(503, &format!("no egress to the host: {error}")),
    };
    match out
        .deliver_http(EgressHttpMethod::Get, &url, &[], &[])
        .await
    {
        Ok(EgressOutcome::Delivered { status, .. }) => Response::json(
            200,
            &serde_json::json!({ "host": target.host, "declared": true, "status": status }),
        ),
        Ok(EgressOutcome::Denied { reason }) => {
            Response::error(502, &format!("egress refused the host: {reason}"))
        }
        Err(error) => Response::error(502, &format!("the host could not be reached: {error}")),
    }
}

/// The name of a DNS response code.
pub fn status_name(code: u64) -> String {
    match code {
        0 => "NOERROR".into(),
        1 => "FORMERR".into(),
        2 => "SERVFAIL".into(),
        3 => "NXDOMAIN".into(),
        4 => "NOTIMP".into(),
        5 => "REFUSED".into(),
        other => format!("RCODE{other}"),
    }
}

/// The name of a DNS record type.
pub fn type_name(code: u64) -> String {
    match code {
        1 => "A".into(),
        2 => "NS".into(),
        5 => "CNAME".into(),
        6 => "SOA".into(),
        12 => "PTR".into(),
        15 => "MX".into(),
        16 => "TXT".into(),
        28 => "AAAA".into(),
        other => format!("TYPE{other}"),
    }
}

/// One question's part of the reply, from the resolver's JSON answer, or
/// `None` when the answer is not in its shape.
pub fn question(name: &str, kind: &str, body: &[u8]) -> Option<Value> {
    let answer: Value = serde_json::from_slice(body).ok()?;
    let status = answer.get("Status")?.as_u64()?;
    let records: Vec<Value> = answer
        .get("Answer")
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or(&[])
        .iter()
        .take(MAX_ANSWERS)
        .filter_map(|record| {
            Some(serde_json::json!({
                "name": record.get("name")?.as_str()?,
                "type": type_name(record.get("type")?.as_u64()?),
                "ttl": record.get("TTL")?.as_u64()?,
                "data": record.get("data")?.as_str()?,
            }))
        })
        .collect();
    Some(serde_json::json!({
        "name": name,
        "type": kind,
        "status": status_name(status),
        "answers": records,
    }))
}

/// The resolver of that name; no name is the first.
pub fn resolver_named(name: &str) -> Option<&'static str> {
    if name.is_empty() {
        return RESOLVERS.first().map(|(_, url)| *url);
    }
    RESOLVERS
        .iter()
        .find(|(id, _)| *id == name)
        .map(|(_, url)| *url)
}

async fn lookup(cx: &mut ApiCtx<'_>, target: Target, resolver: &str) -> Response {
    // No deadline of its own: upstream Core's SDK has no `EgressDeadline`, so
    // the platform's egress timeout bounds each question.
    let mut egress = match cx.ctx.egress(EGRESS) {
        Ok(egress) => egress,
        Err(error) => return Response::error(503, &format!("no egress to the resolver: {error}")),
    };
    let accept = [EgressHeader {
        name: "accept".into(),
        value: "application/dns-json".into(),
    }];
    let mut questions = Vec::new();
    for kind in target.types {
        let destination = format!("{resolver}?name={}&type={kind}", target.name);
        let outcome = egress
            .deliver_http(EgressHttpMethod::Get, &destination, &accept, &[])
            .await;
        let asked = match outcome {
            Ok(EgressOutcome::Delivered { status: 200, body }) => {
                question(&target.name, kind, &body)
            }
            Ok(EgressOutcome::Delivered { status, .. }) => {
                return Response::error(502, &format!("the resolver answered HTTP {status}"))
            }
            Ok(EgressOutcome::Denied { reason }) => {
                return Response::error(502, &format!("egress refused the resolver: {reason}"))
            }
            Err(error) => {
                return Response::error(502, &format!("the resolver could not be reached: {error}"))
            }
        };
        match asked {
            Some(asked) => questions.push(asked),
            None => return Response::error(502, "the resolver's answer is not DNS JSON"),
        }
    }
    let answers: usize = questions
        .iter()
        .map(|q| q["answers"].as_array().map_or(0, Vec::len))
        .sum();
    let at = cx.now_ms;
    if let Err(error) = remember(cx, &target.host, at, answers).await {
        ferrite_app::tracing::warn!(%error, "could not keep the lookup in the history");
    }
    Response::json(
        200,
        &serde_json::json!({
            "host": target.host,
            "resolver": format!("{} (DNS over HTTPS)", host_of(resolver)),
            "questions": questions,
            "at": at,
        }),
    )
}

/// Add a lookup to the front of the session's history, keeping [`HISTORY`]
/// and one entry per host.
pub fn add(history: Vec<Past>, past: Past) -> Vec<Past> {
    let mut next = vec![past.clone()];
    next.extend(history.into_iter().filter(|old| old.host != past.host));
    next.truncate(HISTORY);
    next
}

async fn remember(cx: &mut ApiCtx<'_>, host: &str, at: u64, answers: usize) -> std::io::Result<()> {
    let past = Past {
        host: host.to_string(),
        at,
        answers,
    };
    // A lookup racing another keeps both: each write is based on the
    // revision it read and tried again when it lost.
    for _ in 0..4 {
        let mut user = cx.storage.user();
        let current = document::read::<Vec<Past>>(&mut user, KEY).await?;
        let next = add(current.doc.unwrap_or_default(), past.clone());
        match document::write(&mut user, KEY, Some(current.rev), Some(&next)).await? {
            document::Saved::Stored(_) => return Ok(()),
            document::Saved::Conflict(_) => continue,
        }
    }
    Err(std::io::Error::other("the history kept changing"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_and_ipv4_addresses_are_looked_up_and_nothing_else() {
        let name = target(" WWW.Example.com. ").unwrap();
        assert_eq!(name.name, "www.example.com");
        assert_eq!(name.host, "www.example.com.");
        assert_eq!(name.types, &["A", "AAAA"]);
        let address = target("192.0.2.24").unwrap();
        assert_eq!(address.name, "24.2.0.192.in-addr.arpa");
        assert_eq!(address.types, &["PTR"]);
        assert_eq!(ipv4("255.0.10.1"), Some([255, 0, 10, 1]));
        for bad in [
            "256.1.1.1",
            "1.2.3",
            "1.2.3.4.5",
            "01.2.3.4",
            "1.2.3.",
            "+1.2.3.4",
        ] {
            assert_eq!(ipv4(bad), None, "{bad:?} is not an IPv4 address");
        }
        for bad in [
            "",
            "exa mple.com",
            "-bad.com",
            "bad-.com",
            "a..b",
            "café.com",
            "2001:db8::1",
            "x/y",
            "a&type=MX",
        ] {
            assert!(target(bad).is_err(), "{bad:?} is refused");
        }
        assert!(target(&format!("{}.com", "a".repeat(64))).is_err());
        assert!(
            target(&["a"; 128].join(".")).is_err(),
            "over 253 characters"
        );
        assert!(target(&["a"; 127].join(".")).is_ok(), "253 characters");
    }

    #[test]
    fn whois_asks_the_declared_registry_of_a_query() {
        let asked = |typed: &str| registry(&target(typed).unwrap());
        assert_eq!(
            asked("www.Example.com").unwrap(),
            (
                "example.com".to_string(),
                "https://rdap.verisign.com/com/v1/domain/example.com".to_string()
            )
        );
        assert_eq!(
            asked("wikipedia.org").unwrap().1,
            "https://rdap.publicinterestregistry.org/rdap/domain/wikipedia.org"
        );
        assert_eq!(
            asked("8.8.8.8").unwrap().1,
            "https://rdap.arin.net/registry/ip/8.8.8.8"
        );
        assert!(asked("example.co.uk")
            .unwrap_err()
            .starts_with("no registry"));
        assert!(asked("com").is_err(), "a top level alone is no domain");
    }

    #[test]
    fn an_rdap_record_becomes_labelled_lines() {
        let body = br#"{"ldhName":"EXAMPLE.COM","handle":"2336799_DOMAIN_COM-VRSN",
            "status":["client delete prohibited"],
            "entities":[{"roles":["registrar"],"vcardArray":["vcard",[["version",{},"text","4.0"],["fn",{},"text","RESERVED-IANA"]]]}],
            "events":[{"eventAction":"registration","eventDate":"1995-08-14T04:00:00Z"}],
            "nameservers":[{"ldhName":"A.IANA-SERVERS.NET"}]}"#;
        let facts = rdap_facts(body).unwrap();
        let line = |at: usize| {
            (
                facts[at]["label"].as_str().unwrap().to_string(),
                facts[at]["value"].as_str().unwrap().to_string(),
            )
        };
        assert_eq!(facts.len(), 6);
        assert_eq!(line(0), ("Domain Name".into(), "EXAMPLE.COM".into()));
        assert_eq!(line(3), ("Registrar".into(), "RESERVED-IANA".into()));
        assert_eq!(
            line(4),
            ("registration".into(), "1995-08-14T04:00:00Z".into())
        );
        assert_eq!(line(5), ("Name Server".into(), "A.IANA-SERVERS.NET".into()));
        assert!(rdap_facts(b"<html>").is_none());
        assert!(rdap_facts(b"[1]").is_none());
    }

    #[test]
    fn a_lookup_may_ask_for_one_record_type() {
        let mx = asking_for(target("example.com").unwrap(), "MX").unwrap();
        assert_eq!(mx.types, &["MX"]);
        assert_eq!(
            asking_for(target("example.com").unwrap(), "")
                .unwrap()
                .types,
            &["A", "AAAA"]
        );
        assert!(asking_for(target("example.com").unwrap(), "ANY").is_err());
    }

    #[test]
    fn a_round_trip_reaches_only_whole_hosts_egress_declares() {
        let hosts = declared_hosts();
        assert!(hosts.contains(&"example.com") && hosts.contains(&"www.apple.com"));
        assert!(
            !hosts.contains(&"cloudflare-dns.com"),
            "the resolver's destination is one path, not the host"
        );
        assert_eq!(host_of(resolver_named("").unwrap()), "cloudflare-dns.com");
        assert_eq!(host_of(resolver_named("google").unwrap()), "dns.google");
        assert_eq!(resolver_named("10.0.0.1"), None);
    }

    #[test]
    fn the_resolvers_json_becomes_named_records() {
        let body = br#"{"Status":0,"Question":[{"name":"example.com","type":1}],
            "Answer":[{"name":"example.com","type":1,"TTL":20,"data":"192.0.2.1"},
                      {"name":"example.com","type":5,"TTL":20,"data":"alias.example."}]}"#;
        let asked = question("example.com", "A", body).unwrap();
        assert_eq!(asked["status"], "NOERROR");
        assert_eq!(asked["answers"][0]["data"], "192.0.2.1");
        assert_eq!(asked["answers"][1]["type"], "CNAME");
        let missing = question("nope.example", "A", br#"{"Status":3}"#).unwrap();
        assert_eq!(missing["status"], "NXDOMAIN");
        assert_eq!(missing["answers"], serde_json::json!([]));
        assert!(question("x", "A", b"<html>").is_none());
        assert_eq!(type_name(99), "TYPE99");
    }

    #[test]
    fn the_history_keeps_the_newest_once_per_host() {
        let past = |host: &str, at| Past {
            host: host.into(),
            at,
            answers: 1,
        };
        let history = add(
            vec![past("a.test", 1), past("b.test", 2)],
            past("a.test", 3),
        );
        assert_eq!(history, vec![past("a.test", 3), past("b.test", 2)]);
        let mut long = Vec::new();
        for n in 0..HISTORY + 5 {
            long = add(long, past(&format!("h{n}.test"), n as u64));
        }
        assert_eq!(long.len(), HISTORY);
        assert_eq!(long[0].host, format!("h{}.test", HISTORY + 4));
    }
}

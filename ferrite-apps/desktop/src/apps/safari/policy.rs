//! Safari's URL policy: which addresses the module may fetch, and how a link
//! of a fetched page is resolved against the page's address.
//!
//! A typed address goes through [`judge`] before anything is sent:
//!
//! 1. Only `http` and `https` are fetched ([`Refusal::Scheme`]); an address
//!    with a user name or password is refused ([`Refusal::Credentials`]).
//! 2. The host is read the way a browser reads it: an IPv6 literal, an IPv4
//!    address in any spelling a resolver accepts (`127.1`, `2130706433`,
//!    `0x7f.0.0.1`, `0177.0.0.1`), or a DNS name. A loopback, private,
//!    link-local, carrier-grade NAT, multicast, documentation or metadata
//!    address ([`blocked_v4`], [`blocked_v6`]), and a name that only resolves
//!    inside a private network (`localhost`, `*.internal`, `*.local`, a
//!    single label), are refused ([`Refusal::Private`]).
//! 3. Only the default port is reached ([`Refusal::Port`]), and `http` is
//!    fetched as `https`: upstream Ferrite admits only `https://` egress
//!    destinations.
//! 4. The host must be one of [`SITES`], the destinations `ferrite.json`
//!    declares for the `web` egress handle ([`Refusal::NotListed`]). Ferrite
//!    egress matches a literal destination prefix and has no wildcard, so a
//!    Ferrite application cannot reach an arbitrary site; Safari offers such
//!    a page in a real browser tab instead, and never shows it in a frame.
//!
//! A page's pictures and stylesheets go through [`judge_asset`]: the same
//! rules, with the host one of [`SITES`] or [`ASSET_HOSTS`] (also declared).
//!
//! After that the module asks DNS for the name's addresses and refuses the
//! page, picture or stylesheet when any of them is blocked
//! ([`judge_addresses`]), for every host it reaches, redirects included; the
//! platform's egress checks the addresses it connects to once more.
//!
//! The gate refuses `std::net`, so addresses are parsed here.

/// A site Safari may open: the host, its name on the Favorites page, and the
/// page its bare address opens (the platform does not follow redirects).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Site {
    pub host: &'static str,
    pub title: &'static str,
    pub home: &'static str,
}

/// The sites of the `web` egress handle, in the Favorites page's order. Each
/// is declared in `ferrite.json` as `https://<host>/` (a test checks the two
/// lists agree). Every one answered its pages with `200` to a plain `GET`,
/// mostly under the platform's 1 MiB reply cap, when the list was made. Any
/// other host is not fetched by the server: Safari shows it live in a
/// sandboxed frame when the site allows that, or offers a real browser tab.
pub const SITES: &[Site] = &[
    Site {
        host: "en.wikipedia.org",
        title: "Wikipedia",
        home: "/wiki/Main_Page",
    },
    Site {
        host: "www.apple.com",
        title: "Apple",
        home: "/",
    },
    Site {
        host: "text.npr.org",
        title: "NPR",
        home: "/",
    },
    Site {
        host: "www.bbc.com",
        title: "BBC",
        home: "/news",
    },
    Site {
        host: "arstechnica.com",
        title: "Ars Technica",
        home: "/",
    },
    Site {
        host: "news.ycombinator.com",
        title: "Hacker News",
        home: "/",
    },
    Site {
        host: "developer.mozilla.org",
        title: "MDN Web Docs",
        home: "/en-US/",
    },
    Site {
        host: "marginalia-search.com",
        title: "Marginalia Search",
        home: "/",
    },
    Site {
        host: "lite.cnn.com",
        title: "CNN",
        home: "/",
    },
    Site {
        host: "www.aljazeera.com",
        title: "Al Jazeera",
        home: "/",
    },
    Site {
        host: "512pixels.net",
        title: "512 Pixels",
        home: "/",
    },
    Site {
        host: "daringfireball.net",
        title: "Daring Fireball",
        home: "/",
    },
    Site {
        host: "lobste.rs",
        title: "Lobsters",
        home: "/",
    },
    Site {
        host: "docs.python.org",
        title: "Python Docs",
        home: "/3/",
    },
    Site {
        host: "doc.rust-lang.org",
        title: "Rust Docs",
        home: "/std/",
    },
    Site {
        host: "go.dev",
        title: "Go",
        home: "/doc/",
    },
    Site {
        host: "www.typescriptlang.org",
        title: "TypeScript",
        home: "/docs/",
    },
    Site {
        host: "react.dev",
        title: "React",
        home: "/",
    },
    Site {
        host: "www.w3.org",
        title: "W3C",
        home: "/",
    },
    Site {
        host: "www.rfc-editor.org",
        title: "RFC Editor",
        home: "/",
    },
    Site {
        host: "simple.wikipedia.org",
        title: "Simple Wikipedia",
        home: "/wiki/Main_Page",
    },
    Site {
        host: "en.wiktionary.org",
        title: "Wiktionary",
        home: "/wiki/Wiktionary:Main_Page",
    },
    Site {
        host: "www.wikipedia.org",
        title: "Wikipedia (all languages)",
        home: "/",
    },
    Site {
        host: "www.gutenberg.org",
        title: "Project Gutenberg",
        home: "/",
    },
    Site {
        host: "www.gnu.org",
        title: "GNU",
        home: "/",
    },
    Site {
        host: "example.com",
        title: "Example Domain",
        home: "/",
    },
];

/// The hosts a listed site's pictures come from besides the site itself,
/// declared in `ferrite.json` after [`SITES`] (a test checks the order). Only
/// pictures and stylesheets are fetched from them, never pages.
pub const ASSET_HOSTS: &[&str] = &[
    "upload.wikimedia.org",
    "ichef.bbci.co.uk",
    "cdn.arstechnica.net",
    "thumb.wikimedia.org",
];

/// The DNS-over-HTTPS resolver Safari asks for a host's addresses before it
/// fetches a page, through the same `web` egress handle (so Safari does not
/// depend on another app's handle). Cloudflare's JSON API needs no key.
pub const RESOLVER: &str = "https://cloudflare-dns.com/dns-query";

/// Where a search goes: Wikipedia's full-text search, on a listed site, so
/// its results open too. The words follow, percent-encoded.
pub const SEARCH: &str = "https://en.wikipedia.org/w/index.php?fulltext=1&ns0=1&search=";

/// The longest address the module takes.
pub const MAX_URL: usize = 4096;

/// A host as a browser reads it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Host {
    Name(String),
    V4([u8; 4]),
    V6([u16; 8]),
}

impl Host {
    fn text(&self) -> String {
        match self {
            Host::Name(name) => name.clone(),
            Host::V4([a, b, c, d]) => format!("{a}.{b}.{c}.{d}"),
            Host::V6(groups) => {
                let parts: Vec<String> = groups.iter().map(|g| format!("{g:x}")).collect();
                format!("[{}]", parts.join(":"))
            }
        }
    }
}

/// An absolute http(s) address, parsed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Parsed {
    /// `http` or `https`.
    pub scheme: String,
    pub host: Host,
    pub port: Option<u16>,
    /// Starts with `/`, dot segments removed, unsafe bytes percent-encoded.
    pub path: String,
    pub query: Option<String>,
    pub fragment: Option<String>,
}

impl Parsed {
    /// The address without its fragment: what is fetched.
    pub fn address(&self) -> String {
        let port = self.port.map(|p| format!(":{p}")).unwrap_or_default();
        let query = self
            .query
            .as_ref()
            .map(|q| format!("?{q}"))
            .unwrap_or_default();
        format!(
            "{}://{}{port}{}{query}",
            self.scheme,
            self.host.text(),
            self.path
        )
    }

    /// The whole address, fragment included: what the address field shows.
    pub fn display(&self) -> String {
        match &self.fragment {
            Some(fragment) => format!("{}#{fragment}", self.address()),
            None => self.address(),
        }
    }

    /// The host's name, or its address.
    pub fn host_text(&self) -> String {
        self.host.text()
    }
}

/// Why an address is not fetched.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Refusal {
    /// Not an address at all.
    Invalid(String),
    /// A scheme other than http or https (`ftp`, `file`, `javascript`, ...).
    Scheme(String),
    /// A user name or password in the address.
    Credentials,
    /// A loopback, private, link-local or metadata address, or a name that
    /// only resolves inside a private network: the host.
    Private(String),
    /// A port other than the scheme's default.
    Port(u16),
    /// A public host this application's egress does not declare.
    NotListed(String),
}

impl Refusal {
    /// The kind the page is told, which picks Safari's error page.
    pub fn kind(&self) -> &'static str {
        match self {
            Refusal::Invalid(_) => "invalid",
            Refusal::Scheme(_) => "scheme",
            Refusal::Credentials => "credentials",
            Refusal::Private(_) => "private",
            Refusal::Port(_) => "port",
            Refusal::NotListed(_) => "not-listed",
        }
    }

    /// A plain sentence saying why.
    pub fn message(&self) -> String {
        match self {
            Refusal::Invalid(why) => format!("the address is not valid: {why}"),
            Refusal::Scheme(scheme) => {
                format!("addresses starting with \"{scheme}:\" are not opened")
            }
            Refusal::Credentials => "addresses with a user name or password are not opened".into(),
            Refusal::Private(host) => {
                format!("{host} is a loopback, private, link-local or metadata address")
            }
            Refusal::Port(port) => {
                format!("port {port} is not reachable; only the default port is")
            }
            Refusal::NotListed(host) => {
                format!("{host} is not one of the sites this Ferrite application may reach")
            }
        }
    }

    /// The host the refusal is about, when there is one.
    pub fn host(&self) -> Option<&str> {
        match self {
            Refusal::Private(host) | Refusal::NotListed(host) => Some(host),
            _ => None,
        }
    }
}

/// An address the module may fetch: `https`, a listed host, default port.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Target {
    pub url: Parsed,
    pub site: Site,
}

impl Target {
    pub fn host(&self) -> &'static str {
        self.site.host
    }
}

/// The checks every fetched address passes before its host is looked up in
/// a list: http(s), no credentials, not a private literal or a local-only
/// name, the default port, and a name rather than an address literal. The
/// parsed address and its host name.
fn screen(text: &str) -> Result<(Parsed, String), Refusal> {
    let url = parse(text)?;
    let name = match &url.host {
        Host::V4(address) if blocked_v4(*address) => return Err(Refusal::Private(url.host_text())),
        Host::V6(groups) if blocked_v6(*groups) => return Err(Refusal::Private(url.host_text())),
        Host::Name(name) if internal_name(name) => return Err(Refusal::Private(name.clone())),
        Host::Name(name) => Some(name.clone()),
        Host::V4(_) | Host::V6(_) => None,
    };
    // The port before the list: an odd port is refused whatever the host.
    let default = if url.scheme == "https" { 443 } else { 80 };
    if let Some(port) = url.port.filter(|port| *port != default) {
        return Err(Refusal::Port(port));
    }
    // A public address literal names no declared site.
    let name = name.ok_or_else(|| Refusal::NotListed(url.host_text()))?;
    Ok((url, name))
}

/// Decide whether `text`, an absolute address, may be fetched as a page.
pub fn judge(text: &str) -> Result<Target, Refusal> {
    let (mut url, name) = screen(text)?;
    let site = site_for(&name).ok_or(Refusal::NotListed(name))?;
    url.scheme = "https".into();
    url.port = None;
    url.host = Host::Name(site.host.into());
    if url.path == "/" && url.query.is_none() {
        url.path = site.home.into();
    }
    Ok(Target { url, site })
}

/// Decide whether `text`, the absolute address of a page's picture or
/// stylesheet, may be fetched: the checks of [`judge`], with the host exactly
/// one of [`SITES`] or [`ASSET_HOSTS`]. The address to fetch, over https.
pub fn judge_asset(text: &str) -> Result<Parsed, Refusal> {
    let (mut url, name) = screen(text)?;
    let declared =
        SITES.iter().any(|site| site.host == name) || ASSET_HOSTS.contains(&name.as_str());
    if !declared {
        return Err(Refusal::NotListed(name));
    }
    url.scheme = "https".into();
    url.port = None;
    url.fragment = None;
    Ok(url)
}

/// The listed site a host names: the host itself, its `www.` form, or for
/// Wikipedia its English edition.
pub fn site_for(host: &str) -> Option<Site> {
    let find = |wanted: &str| SITES.iter().copied().find(|site| site.host == wanted);
    match host {
        "wikipedia.org" | "en.m.wikipedia.org" => find("en.wikipedia.org"),
        _ => find(host).or_else(|| find(&format!("www.{host}"))),
    }
}

/// Whether a host is one the visitor's browser must not be sent to from a
/// page Safari shows: a blocked address literal or a name that resolves only
/// inside a private network.
pub fn private_host(host: &Host) -> bool {
    match host {
        Host::V4(address) => blocked_v4(*address),
        Host::V6(groups) => blocked_v6(*groups),
        Host::Name(name) => internal_name(name),
    }
}

/// The search address for `words`.
pub fn search_address(words: &str) -> String {
    format!("{SEARCH}{}", encode_component(words.trim()))
}

/// Percent-encode everything but unreserved characters; spaces become `+`.
pub fn encode_component(text: &str) -> String {
    let mut out = String::new();
    for byte in text.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char)
            }
            b' ' => out.push('+'),
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

/// Whether a name resolves only inside a private network: `localhost` and
/// its subdomains, a single label, or a suffix reserved for local use.
pub fn internal_name(name: &str) -> bool {
    const SUFFIXES: &[&str] = &[
        "localhost",
        "local",
        "internal",
        "lan",
        "home",
        "home.arpa",
        "corp",
        "intranet",
        "private",
        "localdomain",
        "test",
        "invalid",
    ];
    !name.contains('.')
        || SUFFIXES
            .iter()
            .any(|suffix| name == *suffix || name.ends_with(&format!(".{suffix}")))
}

/// Whether an IPv4 address is anything but public unicast: this network,
/// private, carrier-grade NAT, loopback, link-local (the metadata address
/// 169.254.169.254 among them), the IETF and documentation blocks, 6to4
/// relays, benchmarking, multicast, reserved and broadcast.
pub fn blocked_v4([a, b, c, _]: [u8; 4]) -> bool {
    a == 0
        || a == 10
        || a == 127
        || (a == 100 && (64..=127).contains(&b))
        || (a == 169 && b == 254)
        || (a == 172 && (16..=31).contains(&b))
        || (a == 192 && b == 0 && (c == 0 || c == 2))
        || (a == 192 && b == 88 && c == 99)
        || (a == 192 && b == 168)
        || (a == 198 && (b == 18 || b == 19))
        || (a == 198 && b == 51 && c == 100)
        || (a == 203 && b == 0 && c == 113)
        || a >= 224
}

/// Whether an IPv6 address is anything but public unicast. Formats that
/// embed an IPv4 address (mapped, translated, NAT64, 6to4, compatible) are
/// judged by that address; IANA's special-purpose block `2001::/23` (Teredo,
/// benchmarking, ORCHID and ORCHIDv2 among others), documentation
/// (`2001:db8::/32`, `3fff::/20`), the local NAT64 prefix and the discard
/// prefix are refused whole; outside `2000::/3` nothing is public (loopback,
/// unique local, link-local, multicast).
pub fn blocked_v6(s: [u16; 8]) -> bool {
    let embedded = |hi: u16, lo: u16| [(hi >> 8) as u8, hi as u8, (lo >> 8) as u8, lo as u8];
    if s[..5] == [0; 5] && s[5] == 0xffff {
        return blocked_v4(embedded(s[6], s[7]));
    }
    if s[..4] == [0; 4] && s[4] == 0xffff && s[5] == 0 {
        return blocked_v4(embedded(s[6], s[7]));
    }
    if s[..6] == [0; 6] {
        // `::`, `::1` and the deprecated `::a.b.c.d`.
        return true;
    }
    if s[0] == 0x64 && s[1] == 0xff9b && s[2..6] == [0; 4] {
        return blocked_v4(embedded(s[6], s[7]));
    }
    if s[0] == 0x2002 {
        return blocked_v4(embedded(s[1], s[2]));
    }
    (s[0] == 0x64 && s[1] == 0xff9b && s[2] == 1)
        || (s[0] == 0x2001 && s[1] < 0x0200)
        || (s[0] == 0x2001 && s[1] == 0x0db8)
        || (s[0] == 0x3fff && s[1] < 0x1000)
        || (s[0] == 0x0100 && s[1..4] == [0; 3])
        || (s[0] & 0xe000) != 0x2000
}

/// The DNS answers for a name, refused when any address is blocked or one
/// cannot be read: one blocked address refuses the whole name, so a name
/// with a public `A` and a loopback `AAAA` is never fetched.
pub fn judge_addresses(host: &str, answers: &[String]) -> Result<(), Refusal> {
    for answer in answers {
        let blocked = if answer.contains(':') {
            parse_ipv6(answer).map(blocked_v6)
        } else {
            dotted_v4(answer).map(blocked_v4)
        };
        if blocked != Some(false) {
            return Err(Refusal::Private(format!("{host} ({answer})")));
        }
    }
    Ok(())
}

/// A strict dotted IPv4 address, as DNS answers write them.
pub fn dotted_v4(text: &str) -> Option<[u8; 4]> {
    let mut octets = [0u8; 4];
    let mut parts = text.split('.');
    for octet in &mut octets {
        let part = parts.next()?;
        if !(1..=3).contains(&part.len()) || !part.bytes().all(|b| b.is_ascii_digit()) {
            return None;
        }
        *octet = part.parse().ok()?;
    }
    parts.next().is_none().then_some(octets)
}

/// An IPv6 address in text (no brackets, no zone): eight groups, `::` once,
/// an IPv4 address in the last 32 bits allowed.
pub fn parse_ipv6(text: &str) -> Option<[u16; 8]> {
    if text.is_empty() || text.len() > 45 {
        return None;
    }
    let mut text = text.to_string();
    if let Some(at) = text.rfind(':') {
        if text[at + 1..].contains('.') {
            let [a, b, c, d] = dotted_v4(&text[at + 1..])?;
            let hi = u16::from(a) << 8 | u16::from(b);
            let lo = u16::from(c) << 8 | u16::from(d);
            text = format!("{}{hi:x}:{lo:x}", &text[..=at]);
        }
    }
    let groups = |part: &str| -> Option<Vec<u16>> {
        if part.is_empty() {
            return Some(Vec::new());
        }
        part.split(':')
            .map(|g| {
                let hex = (1..=4).contains(&g.len()) && g.bytes().all(|b| b.is_ascii_hexdigit());
                hex.then(|| u16::from_str_radix(g, 16).ok()).flatten()
            })
            .collect()
    };
    let halves: Vec<&str> = text.split("::").collect();
    let mut out = [0u16; 8];
    match halves.as_slice() {
        [whole] => {
            let all = groups(whole)?;
            if all.len() != 8 {
                return None;
            }
            out.copy_from_slice(&all);
        }
        [head, tail] => {
            let (head, tail) = (groups(head)?, groups(tail)?);
            if head.len() + tail.len() > 7 {
                return None;
            }
            out[..head.len()].copy_from_slice(&head);
            out[8 - tail.len()..].copy_from_slice(&tail);
        }
        _ => return None,
    }
    Some(out)
}

/// Whether a host's last label is a number, which makes the host an IPv4
/// address (WHATWG URL Standard, "ends in a number").
fn ends_in_number(host: &str) -> bool {
    let mut labels: Vec<&str> = host.split('.').collect();
    if labels.len() > 1 && labels.last() == Some(&"") {
        labels.pop();
    }
    let last = labels.last().copied().unwrap_or("");
    (!last.is_empty() && last.bytes().all(|b| b.is_ascii_digit()))
        || last
            .strip_prefix("0x")
            .or_else(|| last.strip_prefix("0X"))
            .is_some_and(|hex| hex.bytes().all(|b| b.is_ascii_hexdigit()))
}

/// An IPv4 host in every spelling a browser and a resolver accept: one to
/// four parts, each decimal, octal (leading `0`) or hexadecimal (`0x`), the
/// last filling the remaining bytes.
pub fn parse_ipv4_host(host: &str) -> Option<[u8; 4]> {
    let mut parts: Vec<&str> = host.split('.').collect();
    if parts.len() > 1 && parts.last() == Some(&"") {
        parts.pop();
    }
    if parts.is_empty() || parts.len() > 4 {
        return None;
    }
    let mut numbers = Vec::with_capacity(parts.len());
    for part in &parts {
        if part.is_empty() || part.len() > 40 {
            return None;
        }
        let (digits, radix) =
            if let Some(hex) = part.strip_prefix("0x").or_else(|| part.strip_prefix("0X")) {
                (hex, 16)
            } else if part.len() > 1 && part.starts_with('0') {
                (&part[1..], 8)
            } else {
                (*part, 10)
            };
        let value = if digits.is_empty() {
            0
        } else {
            u64::from_str_radix(digits, radix).ok()?
        };
        numbers.push(value);
    }
    let last = numbers.pop()?;
    if numbers.iter().any(|n| *n > 255) || last >= 256u64.pow(4 - numbers.len() as u32) {
        return None;
    }
    let mut value = last;
    for (index, n) in numbers.iter().enumerate() {
        value += n << (8 * (3 - index));
    }
    Some((value as u32).to_be_bytes())
}

/// Whether `name` is a DNS name: labels of 1 to 63 letters, digits, `-` or
/// `_`, not starting or ending with `-`, 253 characters in all.
fn dns_name(name: &str) -> bool {
    name.len() <= 253
        && name.split('.').all(|label| {
            (1..=63).contains(&label.len())
                && !label.starts_with('-')
                && !label.ends_with('-')
                && label
                    .bytes()
                    .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-' || b == b'_')
        })
}

/// Read a host: a bracketed IPv6 literal, an IPv4 address, or a DNS name,
/// lower-cased and without a trailing dot.
pub fn parse_host(text: &str) -> Result<Host, Refusal> {
    if let Some(inside) = text.strip_prefix('[') {
        let inside = inside
            .strip_suffix(']')
            .ok_or_else(|| Refusal::Invalid("an unterminated IPv6 address".into()))?;
        return parse_ipv6(inside)
            .map(Host::V6)
            .ok_or_else(|| Refusal::Invalid(format!("{text} is not an IPv6 address")));
    }
    let host = text.to_ascii_lowercase();
    if host.is_empty() || !host.is_ascii() || host.contains('%') {
        return Err(Refusal::Invalid("the host is not a plain name".into()));
    }
    if ends_in_number(&host) {
        return parse_ipv4_host(&host)
            .map(Host::V4)
            .ok_or_else(|| Refusal::Invalid(format!("{text} is not an IPv4 address")));
    }
    let name = host.strip_suffix('.').unwrap_or(&host);
    if !dns_name(name) {
        return Err(Refusal::Invalid(format!("{text} is not a host name")));
    }
    Ok(Host::Name(name.to_string()))
}

/// The scheme of `text`, lower-cased, when it starts with one.
pub fn scheme_of(text: &str) -> Option<String> {
    let colon = text.find(':')?;
    let scheme = &text[..colon];
    let mut bytes = scheme.bytes();
    let first = bytes.next()?;
    (first.is_ascii_alphabetic()
        && bytes.all(|b| b.is_ascii_alphanumeric() || matches!(b, b'+' | b'-' | b'.')))
    .then(|| scheme.to_ascii_lowercase())
}

/// Strip what a browser strips from an address before reading it: leading
/// and trailing spaces and control characters, and every tab and newline.
fn clean(text: &str) -> String {
    text.trim_matches(|c: char| c <= ' ')
        .chars()
        .filter(|c| !matches!(c, '\t' | '\n' | '\r'))
        .collect()
}

/// Percent-encode the bytes of a path, query or fragment that must not
/// appear raw: controls, space, non-ASCII, and `"`, `<`, `>`, `\`, `` ` ``,
/// `{`, `}`. Everything else, `%` included, is kept.
fn encode_unsafe(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for byte in text.bytes() {
        if byte <= b' '
            || byte >= 0x7f
            || matches!(byte, b'"' | b'<' | b'>' | b'\\' | b'`' | b'{' | b'}')
        {
            out.push_str(&format!("%{byte:02X}"));
        } else {
            out.push(byte as char);
        }
    }
    out
}

/// Remove `.` and `..` segments from an absolute path (RFC 3986, 5.2.4).
pub fn remove_dot_segments(path: &str) -> String {
    let mut segments: Vec<&str> = Vec::new();
    let parts: Vec<&str> = path.split('/').skip(1).collect();
    for (index, segment) in parts.iter().enumerate() {
        let last = index + 1 == parts.len();
        match *segment {
            "." | "%2e" | "%2E" => {
                if last {
                    segments.push("");
                }
            }
            ".." | ".%2e" | "%2e." | "%2e%2e" | ".%2E" | "%2E." | "%2E%2E" => {
                segments.pop();
                if last {
                    segments.push("");
                }
            }
            other => segments.push(other),
        }
    }
    format!("/{}", segments.join("/"))
}

/// Split `rest` (what follows the authority) into path, query and fragment.
fn split_rest(rest: &str) -> (String, Option<String>, Option<String>) {
    let (before_fragment, fragment) = match rest.split_once('#') {
        Some((before, fragment)) => (before, Some(encode_unsafe(fragment))),
        None => (rest, None),
    };
    let (path, query) = match before_fragment.split_once('?') {
        Some((path, query)) => (path, Some(encode_unsafe(query))),
        None => (before_fragment, None),
    };
    let path = if path.is_empty() {
        "/".to_string()
    } else {
        remove_dot_segments(&encode_unsafe(path))
    };
    (path, query, fragment)
}

/// Parse an absolute address. Only `http` and `https` parse; any other
/// scheme is [`Refusal::Scheme`].
pub fn parse(text: &str) -> Result<Parsed, Refusal> {
    let text = clean(text);
    if text.len() > MAX_URL {
        return Err(Refusal::Invalid(format!(
            "the address is longer than {MAX_URL} characters"
        )));
    }
    let scheme =
        scheme_of(&text).ok_or_else(|| Refusal::Invalid("the address has no scheme".into()))?;
    if scheme != "http" && scheme != "https" {
        return Err(Refusal::Scheme(scheme));
    }
    let rest = &text[scheme.len() + 1..];
    let rest = rest
        .strip_prefix("//")
        .ok_or_else(|| Refusal::Invalid("an http address starts with //".into()))?;
    if rest.contains('\\') {
        return Err(Refusal::Invalid("the address contains a backslash".into()));
    }
    let end = rest.find(['/', '?', '#']).unwrap_or(rest.len());
    let (authority, after) = rest.split_at(end);
    if authority.contains('@') {
        return Err(Refusal::Credentials);
    }
    let (host_text, port) = match authority.rfind(':') {
        Some(colon) if !authority[colon..].contains(']') => {
            let digits = &authority[colon + 1..];
            let port = if digits.is_empty() {
                None
            } else if digits.len() <= 5 && digits.bytes().all(|b| b.is_ascii_digit()) {
                Some(
                    digits
                        .parse::<u16>()
                        .map_err(|_| Refusal::Invalid("the port is out of range".into()))?,
                )
            } else {
                return Err(Refusal::Invalid("the port is not a number".into()));
            };
            (&authority[..colon], port)
        }
        _ => (authority, None),
    };
    let host = parse_host(host_text)?;
    let (path, query, fragment) = split_rest(after);
    Ok(Parsed {
        scheme,
        host,
        port,
        path,
        query,
        fragment,
    })
}

/// What a link of a page resolves to.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Resolved {
    /// An http(s) address, absolute.
    Web(String),
    /// Another scheme (`mailto`, `data`, `javascript`, ...), as written.
    Other { scheme: String, text: String },
}

/// Resolve a reference found in a page against the page's address (RFC 3986
/// section 5, with the WHATWG cleaning of spaces, tabs and newlines). `None`
/// when it cannot be read.
pub fn resolve(base: &Parsed, reference: &str) -> Option<Resolved> {
    let reference = clean(reference);
    if let Some(scheme) = scheme_of(&reference) {
        if scheme == "http" || scheme == "https" {
            return parse(&reference)
                .ok()
                .map(|url| Resolved::Web(url.display()));
        }
        return Some(Resolved::Other {
            scheme,
            text: reference,
        });
    }
    if reference.contains('\\') {
        return None;
    }
    let origin = {
        let port = base.port.map(|p| format!(":{p}")).unwrap_or_default();
        format!("{}://{}{port}", base.scheme, base.host.text())
    };
    let absolute = if let Some(network) = reference.strip_prefix("//") {
        return parse(&format!("{}://{network}", base.scheme))
            .ok()
            .map(|url| Resolved::Web(url.display()));
    } else if reference.starts_with('/') {
        format!("{origin}{reference}")
    } else if reference.starts_with('?') {
        format!("{origin}{}{reference}", base.path)
    } else if reference.starts_with('#') || reference.is_empty() {
        let query = base
            .query
            .as_ref()
            .map(|q| format!("?{q}"))
            .unwrap_or_default();
        format!("{origin}{}{query}{reference}", base.path)
    } else {
        let directory = &base.path[..=base.path.rfind('/').unwrap_or(0)];
        format!("{origin}{directory}{reference}")
    };
    parse(&absolute)
        .ok()
        .map(|url| Resolved::Web(url.display()))
}

/// The target a redirect's body names, when the body is short and links
/// one address: the platform's egress hands the application no `Location`
/// header, but most servers write the new address in the body as well.
pub fn redirect_target(body: &[u8]) -> Option<String> {
    if body.len() > 16 * 1024 {
        return None;
    }
    let text = String::from_utf8_lossy(body);
    let lower = text.to_ascii_lowercase();
    let at = lower.find("href=")? + "href=".len();
    let rest = &text[at..];
    let quote = rest.chars().next()?;
    let value = if quote == '"' || quote == '\'' {
        rest[1..].split(quote).next()?
    } else {
        rest.split(|c: char| c.is_whitespace() || c == '>').next()?
    };
    let value = super::rewrite::decode_entities(value);
    (!value.is_empty()).then_some(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn refused(text: &str) -> &'static str {
        match judge(text) {
            Ok(target) => panic!("{text:?} was admitted as {}", target.url.display()),
            Err(refusal) => refusal.kind(),
        }
    }

    #[test]
    fn only_http_and_https_are_fetched() {
        for text in [
            "ftp://example.com/",
            "file:///etc/passwd",
            "javascript:alert(1)",
            "JavaScript:alert(1)",
            "data:text/html,<script>alert(1)</script>",
            "gopher://example.com/",
            "mailto:someone@example.com",
            "about:blank",
            "view-source:https://example.com/",
            "blob:https://example.com/x",
            "ws://example.com/",
        ] {
            assert_eq!(refused(text), "scheme", "{text}");
        }
        assert_eq!(refused("example.com"), "invalid", "no scheme");
        assert_eq!(refused("https:example.com"), "invalid");
    }

    #[test]
    fn loopback_private_link_local_and_metadata_literals_are_refused_in_every_spelling() {
        for text in [
            "http://127.0.0.1/",
            "http://127.1/",
            "http://2130706433/",
            "http://0x7f000001/",
            "http://0x7f.0.0.1/",
            "http://0177.0.0.1/",
            "http://127.0.0.1./",
            "http://0/",
            "http://0.0.0.0/",
            "http://10.0.0.1/",
            "http://172.16.5.4/",
            "http://172.31.255.255/",
            "http://192.168.1.1/",
            "http://100.64.0.1/",
            "http://169.254.169.254/latest/meta-data/",
            "http://0xa9fea9fe/",
            "http://2852039166/",
            "http://224.0.0.1/",
            "http://255.255.255.255/",
            "http://[::1]/",
            "http://[::]/",
            "http://[0:0:0:0:0:0:0:1]:80/",
            "http://[fe80::1]/",
            "http://[fc00::1]/",
            "http://[fd12:3456::1]/",
            "http://[ff02::1]/",
            "http://[::ffff:127.0.0.1]/",
            "http://[::ffff:169.254.169.254]/",
            "http://[::ffff:a9fe:a9fe]/",
            "http://[64:ff9b::a9fe:a9fe]/",
            "http://[2002:a9fe:a9fe::]/",
            "http://[2001:db8::1]/",
            "http://[2001::1]/",
        ] {
            assert_eq!(refused(text), "private", "{text}");
        }
    }

    #[test]
    fn names_that_resolve_only_inside_a_private_network_are_refused() {
        for text in [
            "http://localhost/",
            "http://LOCALHOST:8787/",
            "http://api.localhost/",
            "http://metadata/",
            "http://metadata.google.internal/computeMetadata/v1/",
            "http://printer.local/",
            "http://nas.lan/",
            "http://router.home.arpa/",
            "http://wiki.corp/",
            "http://instance-data/",
        ] {
            assert_eq!(refused(text), "private", "{text}");
        }
    }

    #[test]
    fn public_addresses_off_the_list_credentials_and_odd_ports_are_refused() {
        assert_eq!(refused("https://www.google.com/"), "not-listed");
        assert_eq!(refused("https://8.8.8.8/"), "not-listed");
        assert_eq!(refused("https://[2606:4700:4700::1111]/"), "not-listed");
        assert_eq!(
            refused("https://en.wikipedia.org.evil.example/"),
            "not-listed"
        );
        assert_eq!(refused("https://evilen.wikipedia.org/"), "not-listed");
        assert_eq!(
            refused("https://user:pass@en.wikipedia.org/"),
            "credentials"
        );
        assert_eq!(
            refused("https://evil.example@en.wikipedia.org/"),
            "credentials"
        );
        assert_eq!(refused("https://en.wikipedia.org:8443/"), "port");
        assert_eq!(refused("http://en.wikipedia.org:443/"), "port");
        assert_eq!(refused("https://8.8.8.8:8443/"), "port");
        assert_eq!(refused("https://[2606:4700:4700::1111]:8443/"), "port");
        assert_eq!(refused("https://www.google.com:8443/"), "port");
        assert_eq!(
            refused("http://127.0.0.1:8787/"),
            "private",
            "private before the port"
        );
        assert_eq!(refused("https://8.8.8.8:443/"), "not-listed");
        assert_eq!(refused("https://exa mple.com/"), "invalid");
        assert_eq!(refused("https://exa%6dple.com/"), "invalid");
        assert_eq!(refused("https://256.1.1.1/"), "invalid");
        assert_eq!(refused("https://1.2.3.4.5/"), "invalid");
        assert_eq!(refused("https://example.com\\@evil.example/"), "invalid");
    }

    #[test]
    fn listed_sites_are_fetched_over_https_on_their_canonical_host() {
        let target = judge("HTTP://Example.COM./a/./b/../c?q=1 2#top").unwrap();
        assert_eq!(target.url.address(), "https://example.com/a/c?q=1%202");
        assert_eq!(target.url.display(), "https://example.com/a/c?q=1%202#top");
        assert_eq!(
            judge("https://apple.com").unwrap().url.address(),
            "https://www.apple.com/"
        );
        assert_eq!(
            judge("https://wikipedia.org/").unwrap().url.address(),
            "https://en.wikipedia.org/wiki/Main_Page",
            "a bare address opens the site's home page"
        );
        assert!(SITES
            .iter()
            .all(|site| site.home.starts_with('/') && !internal_name(site.host)));
        let mut hosts: Vec<&str> = SITES.iter().map(|site| site.host).collect();
        hosts.sort_unstable();
        hosts.dedup();
        assert_eq!(hosts.len(), SITES.len(), "each site is listed once");
        assert_eq!(
            judge("https://en.wikipedia.org/wiki/Caf%C3%A9")
                .unwrap()
                .url
                .address(),
            "https://en.wikipedia.org/wiki/Caf%C3%A9"
        );
        assert_eq!(
            judge("https://en.wikipedia.org/wiki/Café")
                .unwrap()
                .url
                .address(),
            "https://en.wikipedia.org/wiki/Caf%C3%A9"
        );
        assert_eq!(
            judge("https://example.com/<script>").unwrap().url.address(),
            "https://example.com/%3Cscript%3E"
        );
        assert_eq!(
            search_address("macOS Catalina & more"),
            "https://en.wikipedia.org/w/index.php?fulltext=1&ns0=1&search=macOS+Catalina+%26+more"
        );
        assert!(
            judge(&search_address("x")).is_ok(),
            "the search page is on a listed site"
        );
    }

    #[test]
    fn dns_answers_with_any_blocked_address_refuse_the_name() {
        let answers = |list: &[&str]| list.iter().map(|a| a.to_string()).collect::<Vec<_>>();
        assert!(judge_addresses(
            "a.test",
            &answers(&["93.184.215.14", "2606:2800:21f:cb07:6820:80da:af6b:8b2c"])
        )
        .is_ok());
        assert!(judge_addresses("a.test", &answers(&["93.184.215.14", "127.0.0.1"])).is_err());
        assert!(judge_addresses("a.test", &answers(&["::1"])).is_err());
        assert!(judge_addresses("a.test", &answers(&["169.254.169.254"])).is_err());
        assert!(judge_addresses("a.test", &answers(&["fd00::5"])).is_err());
        // The edges of the special-purpose and documentation blocks.
        for blocked in [
            "2001::1",
            "2001:2::1",
            "2001:10::1",
            "2001:1f::1",
            "2001:20::1",
            "2001:1ff:ffff::1",
            "2001:db8:ffff::1",
            "3fff::1",
            "3fff:fff:ffff::1",
            "100::1",
            "64:ff9b:1::1",
        ] {
            assert!(
                judge_addresses("a.test", &answers(&[blocked])).is_err(),
                "{blocked}"
            );
        }
        for public in [
            "2001:200::1",
            "2001:4860:4860::8888",
            "3fff:1000::1",
            "2a00:1450:4001::1",
        ] {
            assert!(
                judge_addresses("a.test", &answers(&[public])).is_ok(),
                "{public}"
            );
        }
        assert!(
            judge_addresses("a.test", &answers(&["not an address"])).is_err(),
            "unreadable fails closed"
        );
    }

    #[test]
    fn the_address_rules_refuse_everything_that_is_not_public_unicast() {
        for public in [
            [8, 8, 8, 8],
            [1, 1, 1, 1],
            [172, 15, 255, 255],
            [172, 32, 0, 1],
            [100, 63, 255, 255],
            [198, 20, 0, 1],
        ] {
            assert!(!blocked_v4(public), "{public:?}");
        }
        for blocked in [
            [127, 0, 0, 1],
            [10, 9, 9, 9],
            [169, 254, 169, 254],
            [100, 100, 0, 1],
            [192, 0, 2, 1],
            [198, 18, 0, 1],
            [240, 0, 0, 1],
        ] {
            assert!(blocked_v4(blocked), "{blocked:?}");
        }
        let v6 = |text: &str| parse_ipv6(text).unwrap();
        assert!(!blocked_v6(v6("2606:4700:4700::1111")));
        assert!(!blocked_v6(v6("::ffff:8.8.8.8")));
        assert!(!blocked_v6(v6("64:ff9b::808:808")));
        assert!(!blocked_v6(v6("2002:808:808::")));
        assert!(blocked_v6(v6("64:ff9b:1::1")));
        assert!(blocked_v6(v6("::127.0.0.1")));
        assert_eq!(parse_ipv6("1:2:3:4:5:6:7:8:9"), None);
        assert_eq!(parse_ipv6("1::2::3"), None);
        assert_eq!(parse_ipv6("fe80::1%eth0"), None);
        assert_eq!(parse_ipv4_host("1.2.3.4.5"), None);
        assert_eq!(parse_ipv4_host("192.168.257"), Some([192, 168, 1, 1]));
        assert_eq!(parse_ipv4_host("4294967296"), None);
    }

    #[test]
    fn links_resolve_against_the_page_like_a_browser() {
        let base = parse("https://en.wikipedia.org/wiki/MacOS_Catalina?x=1#top").unwrap();
        let web = |reference: &str| match resolve(&base, reference) {
            Some(Resolved::Web(url)) => url,
            other => panic!("{reference:?} resolved to {other:?}"),
        };
        assert_eq!(
            web("/wiki/MacOS_Mojave"),
            "https://en.wikipedia.org/wiki/MacOS_Mojave"
        );
        assert_eq!(
            web("MacOS_Mojave#History"),
            "https://en.wikipedia.org/wiki/MacOS_Mojave#History"
        );
        assert_eq!(
            web("../w/index.php?a=1"),
            "https://en.wikipedia.org/w/index.php?a=1"
        );
        assert_eq!(
            web("//upload.wikimedia.org/a.png"),
            "https://upload.wikimedia.org/a.png"
        );
        assert_eq!(
            web("?y=2"),
            "https://en.wikipedia.org/wiki/MacOS_Catalina?y=2"
        );
        assert_eq!(
            web("#Features"),
            "https://en.wikipedia.org/wiki/MacOS_Catalina?x=1#Features"
        );
        assert_eq!(web(" HTTP://Example.com/a b "), "http://example.com/a%20b");
        assert_eq!(web("/a/../../b"), "https://en.wikipedia.org/b");
        assert_eq!(
            resolve(&base, "java\tscript:alert(1)"),
            Some(Resolved::Other {
                scheme: "javascript".into(),
                text: "javascript:alert(1)".into()
            }),
            "a tab inside the scheme does not hide it"
        );
        assert!(matches!(
            resolve(&base, "mailto:a@b.c"),
            Some(Resolved::Other { .. })
        ));
    }

    #[test]
    fn pictures_and_stylesheets_come_only_from_declared_public_hosts() {
        assert_eq!(
            judge_asset("//upload.wikimedia.org/a.png").map(|u| u.address()),
            Err(Refusal::Invalid("the address has no scheme".into())),
            "only absolute addresses are judged"
        );
        assert_eq!(
            judge_asset("http://upload.wikimedia.org/w/a.png?x=1#f")
                .unwrap()
                .address(),
            "https://upload.wikimedia.org/w/a.png?x=1"
        );
        assert!(judge_asset("https://en.wikipedia.org/w/load.php?only=styles").is_ok());
        let kind = |text: &str| judge_asset(text).unwrap_err().kind();
        for (text, expected) in [
            ("http://169.254.169.254/latest/meta-data/", "private"),
            ("http://127.1/a.png", "private"),
            ("http://[::ffff:10.0.0.1]/a.png", "private"),
            ("http://localhost/a.css", "private"),
            ("http://metadata.google.internal/x", "private"),
            ("https://upload.wikimedia.org:8443/a.png", "port"),
            ("https://user@upload.wikimedia.org/a.png", "credentials"),
            ("https://8.8.8.8/a.png", "not-listed"),
            ("https://evil.example/a.css", "not-listed"),
            ("https://wikipedia.org/a.css", "not-listed"),
            (
                "https://upload.wikimedia.org.evil.example/a.png",
                "not-listed",
            ),
            ("data:image/png;base64,AA", "scheme"),
        ] {
            assert_eq!(kind(text), expected, "{text}");
        }
        assert!(ASSET_HOSTS
            .iter()
            .all(|host| !internal_name(host) && site_for(host).is_none()));
    }

    #[test]
    fn a_redirects_body_names_its_target() {
        assert_eq!(
            redirect_target(b"<html><body>Moved <a HREF=\"https://example.com/new?a=1&amp;b=2\">here</a></body></html>"),
            Some("https://example.com/new?a=1&b=2".into())
        );
        assert_eq!(redirect_target(b""), None);
        assert_eq!(redirect_target(b"Moved"), None);
    }
}

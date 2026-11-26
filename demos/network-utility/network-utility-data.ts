/** The eight panes of Network Utility, in the order of its tabs. */
export type NetworkUtilityTab =
  | "info"
  | "netstat"
  | "ping"
  | "lookup"
  | "traceroute"
  | "whois"
  | "finger"
  | "port-scan";

/** The seven panes that run a tool; Info only reads an interface. */
export type NetworkUtilityTool = Exclude<NetworkUtilityTab, "info">;

/** A network interface as the Info pane lists it. */
export interface NetworkUtilityInterface {
  /** The BSD name, which identifies the interface: `en0`. */
  id: string;
  /** The title in the pop-up button: "Wi-Fi (en0)". */
  title: string;
  hardwareAddress: string;
  ipAddress: string;
  linkSpeed: string;
  linkStatus: string;
  vendor: string;
  model: string;
  /** The transfer counts; `null` where the count is not known, written "Unknown". */
  sentPackets: number | null;
  sendErrors: number | null;
  recvPackets: number | null;
  recvErrors: number | null;
  collisions: number | null;
}

/**
 * The tabs with the widths of their segments in the reference captures (dividers at x=328,
 * 462, 560, 694, 870, 990 and 1112 px of the 2x image; the strip is 523 pt).
 */
export const TABS: readonly { id: NetworkUtilityTab; title: string; width: number }[] = [
  { id: "info", title: "Info", width: 47 },
  { id: "netstat", title: "Netstat", width: 67 },
  { id: "ping", title: "Ping", width: 49 },
  { id: "lookup", title: "Lookup", width: 67 },
  { id: "traceroute", title: "Traceroute", width: 88 },
  { id: "whois", title: "Whois", width: 60 },
  { id: "finger", title: "Finger", width: 61 },
  { id: "port-scan", title: "Port Scan", width: 84 },
];

const wifi: NetworkUtilityInterface = {
  id: "en0",
  title: "Wi-Fi (en0)",
  hardwareAddress: "38:f9:d3:a6:8a:06",
  ipAddress: "192.168.7.167",
  linkSpeed: "304.2 Mbit/s",
  linkStatus: "Active",
  vendor: "Apple",
  model: "Wireless Network Adapter (802.11 a/b/g/n/ac)",
  sentPackets: 376836,
  sendErrors: 0,
  recvPackets: 45010,
  recvErrors: 0,
  collisions: 0,
};

/**
 * The interfaces of the demo. Wi-Fi is the one of the Aqua capture, figure for figure; the
 * other two are invented, with addresses from the ranges reserved for documentation.
 */
export const defaultInterfaces: readonly NetworkUtilityInterface[] = [
  wifi,
  {
    id: "en1",
    title: "Thunderbolt Ethernet (en1)",
    hardwareAddress: "82:15:0c:4d:21:40",
    ipAddress: "192.0.2.24",
    linkSpeed: "1 Gbit/s",
    linkStatus: "Active",
    vendor: "Apple",
    model: "Thunderbolt Ethernet Adapter",
    sentPackets: 18204,
    sendErrors: 0,
    recvPackets: 96377,
    recvErrors: 2,
    collisions: 0,
  },
  {
    id: "bridge0",
    title: "Thunderbolt Bridge (bridge0)",
    hardwareAddress: "82:15:0c:4d:21:00",
    ipAddress: "Unknown",
    linkSpeed: "Unknown",
    linkStatus: "Inactive",
    vendor: "Apple",
    model: "Thunderbolt Bridge",
    sentPackets: 0,
    sendErrors: 0,
    recvPackets: 0,
    recvErrors: 0,
    collisions: 0,
  },
];

/** The Wi-Fi interface with the transfer statistics of the Dark Aqua capture. */
export const darkCaptureInterfaces: readonly NetworkUtilityInterface[] = [
  { ...wifi, sentPackets: 894806, sendErrors: 63, recvPackets: 193934 },
  ...defaultInterfaces.slice(1),
];

/** A count as the Info pane writes it: 376,836, or "Unknown" for a count not known. */
export const formatCount = (count: number | null) =>
  count === null || !Number.isFinite(count) ? "Unknown" : count.toLocaleString("en-US");

/** One of the mutually exclusive choices of a tool. */
export interface NetworkUtilityOption {
  id: string;
  title: string;
}

/** What a tool's pane shows: its prompt, its field and its button. */
export interface NetworkUtilityToolDefinition {
  id: NetworkUtilityTool;
  /** The sentence at the top of the pane. */
  prompt: string;
  /** The accessible name of the field, when the tool takes an address. */
  field?: string;
  /** The example beside the field. */
  example?: string;
  /** The choices of the tool, when it has any; the first is selected at first. */
  options?: readonly NetworkUtilityOption[];
  /** The title of the button that runs the tool. */
  action: string;
}

export const TOOLS: Readonly<Record<NetworkUtilityTool, NetworkUtilityToolDefinition>> = {
  netstat: {
    id: "netstat",
    prompt: "Select the information to display.",
    options: [
      { id: "routing", title: "Display routing table information" },
      { id: "statistics", title: "Display comprehensive network statistics for each protocol" },
      { id: "multicast", title: "Display multicast information" },
      { id: "sockets", title: "Display the state of all current socket connections" },
    ],
    action: "Netstat",
  },
  ping: {
    id: "ping",
    prompt: "Enter the network address to ping.",
    field: "Network address",
    example: "(ex. 10.0.2.1 or www.example.com)",
    action: "Ping",
  },
  lookup: {
    id: "lookup",
    prompt: "Enter an internet address to lookup.",
    field: "Internet address",
    example: "(ex. 10.0.2.1 or www.example.com)",
    action: "Lookup",
  },
  traceroute: {
    id: "traceroute",
    prompt: "Enter the network address to trace an internet route to.",
    field: "Network address",
    example: "(ex. 10.0.2.1 or www.example.com)",
    action: "Trace",
  },
  whois: {
    id: "whois",
    prompt: "Enter a domain address to look up its “whois” information.",
    field: "Domain address",
    example: "(ex. 10.0.2.1 or example.com)",
    action: "Whois",
  },
  finger: {
    id: "finger",
    prompt: "Enter a user name and domain address to finger that user.",
    field: "User name and domain address",
    example: "(ex. user@example.com)",
    action: "Finger",
  },
  "port-scan": {
    id: "port-scan",
    prompt: "Enter an internet or IP address to scan for open ports.",
    field: "Internet or IP address",
    example: "(ex. 10.0.2.1 or www.example.com)",
    action: "Scan",
  },
};

/** A number that depends only on the text, so that the same input gives the same output. */
function seedOf(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** A sequence of numbers below one that depends only on the seed. */
function sequence(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * The address a name stands for in the demo: one in 203.0.113.0/24, a range reserved for
 * documentation, chosen by the name. An address stands for itself.
 */
export function addressOf(host: string): string {
  return IPV4.test(host) ? host : `203.0.113.${(seedOf(host.toLowerCase()) % 253) + 1}`;
}

const fixed = (value: number, digits = 3) => value.toFixed(digits);

function ping(host: string): string {
  const address = addressOf(host);
  const next = sequence(seedOf(host));
  const times = Array.from({ length: 10 }, () => 9 + next() * 14);
  const lines = times.map(
    (time, index) => `64 bytes from ${address}: icmp_seq=${index} ttl=56 time=${fixed(time)} ms`,
  );
  const mean = times.reduce((sum, time) => sum + time, 0) / times.length;
  const deviation = Math.sqrt(
    times.reduce((sum, time) => sum + (time - mean) ** 2, 0) / times.length,
  );
  return [
    "Ping has started…",
    "",
    `PING ${host} (${address}): 56 data bytes`,
    ...lines,
    "",
    `--- ${host} ping statistics ---`,
    "10 packets transmitted, 10 packets received, 0.0% packet loss",
    `round-trip min/avg/max/stddev = ${fixed(Math.min(...times))}/${fixed(mean)}/${fixed(Math.max(...times))}/${fixed(deviation)} ms`,
  ].join("\n");
}

function lookup(host: string): string {
  const address = addressOf(host);
  const id = seedOf(host) % 65536;
  const question = IPV4.test(host)
    ? `${host.split(".").reverse().join(".")}.in-addr.arpa.`
    : `${host}.`;
  const answer = IPV4.test(host)
    ? `${question}\t3600\tIN\tPTR\thost-${host.replaceAll(".", "-")}.example.net.`
    : `${question}\t\t300\tIN\tA\t${address}`;
  return [
    "Lookup has started…",
    "",
    `; <<>> DiG 9.10.6 <<>> ${host}`,
    ";; global options: +cmd",
    ";; Got answer:",
    `;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: ${id}`,
    ";; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 0",
    "",
    ";; QUESTION SECTION:",
    `;${question}\t\t\tIN\t${IPV4.test(host) ? "PTR" : "A"}`,
    "",
    ";; ANSWER SECTION:",
    answer,
    "",
    `;; Query time: ${(seedOf(host) % 40) + 8} msec`,
    ";; SERVER: 192.168.7.1#53(192.168.7.1)",
  ].join("\n");
}

function traceroute(host: string): string {
  const address = addressOf(host);
  const next = sequence(seedOf(host));
  const hops = 5 + (seedOf(host) % 5);
  const lines = Array.from({ length: hops }, (_, index) => {
    const hop =
      index === 0
        ? "192.168.7.1"
        : index === hops - 1
          ? address
          : `198.51.100.${Math.floor(next() * 253) + 1}`;
    const base = 1.5 + index * 3.2 + next() * 2;
    const times = [0, 1, 2].map(() => `${fixed(base + next() * 1.5)} ms`).join("  ");
    return `${String(index + 1).padStart(2)}  ${hop} (${hop})  ${times}`;
  });
  return [
    "Traceroute has started…",
    "",
    `traceroute to ${host} (${address}), 64 hops max, 72 byte packets`,
    ...lines,
  ].join("\n");
}

function whois(domain: string): string {
  const name = domain.toUpperCase();
  const year = 1995 + (seedOf(domain) % 20);
  return [
    "Whois has started…",
    "",
    `   Domain Name: ${name}`,
    "   Registrar: Example Registrar, Inc.",
    "   Registrar WHOIS Server: whois.example.net",
    `   Creation Date: ${year}-03-14T05:00:00Z`,
    "   Registry Expiry Date: 2021-03-13T04:00:00Z",
    "   Domain Status: clientTransferProhibited",
    "   Name Server: A.NS.EXAMPLE.NET",
    "   Name Server: B.NS.EXAMPLE.NET",
    "   DNSSEC: signedDelegation",
    "",
    ">>> This record is made up for the demo: nothing was looked up. <<<",
  ].join("\n");
}

function finger(target: string): string {
  const at = target.indexOf("@");
  const user = at < 0 ? target : target.slice(0, at);
  const host = at < 0 ? "localhost" : target.slice(at + 1) || "localhost";
  return [
    "Finger has started…",
    "",
    `[${host}]`,
    `Login: ${user.padEnd(33)}Name: ${user}`,
    `Directory: /Users/${user.padEnd(23)}Shell: /bin/zsh`,
    "Never logged in.",
    "No Mail.",
    "No Plan.",
  ].join("\n");
}

const PORTS = [
  [22, "ssh"],
  [53, "domain"],
  [80, "http"],
  [443, "https"],
  [548, "afpovertcp"],
  [631, "ipp"],
  [3689, "daap"],
  [5900, "rfb"],
] as const;

function portScan(host: string): string {
  const next = sequence(seedOf(host));
  const open = PORTS.filter(([port]) => port === 80 || port === 443 || next() < 0.35);
  return [
    "Port Scan has started…",
    "",
    `Port Scanning host: ${addressOf(host)}`,
    "",
    ...open.map(([port, service]) => `\t Open TCP Port: \t${port}\t\t${service}`),
    "Port Scan has completed…",
  ].join("\n");
}

const NETSTAT: Readonly<Record<string, string>> = {
  routing: [
    "Routing tables",
    "",
    "Internet:",
    "Destination        Gateway            Flags        Netif Expire",
    "default            192.168.7.1        UGSc           en0",
    "127                127.0.0.1          UCS            lo0",
    "127.0.0.1          127.0.0.1          UH             lo0",
    "192.168.7          link#6             UCS            en0",
    "192.168.7.1/32     link#6             UCS            en0",
    "192.168.7.167/32   link#6             UCS            en0",
    "224.0.0/4          link#6             UmCS           en0",
    "255.255.255.255/32 link#6             UCS            en0",
  ].join("\n"),
  statistics: [
    "tcp:",
    "\t376836 packets sent",
    "\t\t81204 data packets (60381222 bytes)",
    "\t\t112 data packets (95210 bytes) retransmitted",
    "\t45010 packets received",
    "\t\t30977 acks (for 60380514 bytes)",
    "\t\t0 discarded for bad checksums",
    "udp:",
    "\t20418 datagrams received",
    "\t\t0 with bad checksum",
    "\t18733 datagrams output",
    "ip:",
    "\t65428 total packets received",
    "\t\t0 bad header checksums",
  ].join("\n"),
  multicast: [
    "Link-layer Multicast Group Memberships",
    "Group                 Link-layer Address  Netif",
    "1:0:5e:0:0:fb         <none>              en0",
    "1:0:5e:0:0:1          <none>              en0",
    "",
    "IPv4 Multicast Group Memberships",
    "Group                 Link-layer Address  Netif",
    "224.0.0.251           1:0:5e:0:0:fb       en0",
    "224.0.0.1             1:0:5e:0:0:1        en0",
  ].join("\n"),
  sockets: [
    "Active Internet connections",
    "Proto Recv-Q Send-Q  Local Address          Foreign Address        (state)",
    "tcp4       0      0  192.168.7.167.49682    203.0.113.18.443       ESTABLISHED",
    "tcp4       0      0  192.168.7.167.49677    203.0.113.94.443       ESTABLISHED",
    "tcp4       0      0  192.168.7.167.49531    198.51.100.7.5223      ESTABLISHED",
    "udp4       0      0  *.5353                 *.*",
    "udp4       0      0  *.137                  *.*",
  ].join("\n"),
};

/**
 * What a tool prints for an input, or for the option chosen when it takes none. Nothing is
 * sent anywhere: the text is made up from the input alone, so the same input always gives the
 * same text.
 */
export function runTool(tool: NetworkUtilityTool, input: string, option?: string): string {
  const text = input.trim();
  switch (tool) {
    case "netstat":
      return `Netstat has started…\n\n${NETSTAT[option ?? "routing"] ?? NETSTAT.routing}`;
    case "ping":
      return ping(text);
    case "lookup":
      return lookup(text);
    case "traceroute":
      return traceroute(text);
    case "whois":
      return whois(text);
    case "finger":
      return finger(text);
    case "port-scan":
      return portScan(text);
  }
}

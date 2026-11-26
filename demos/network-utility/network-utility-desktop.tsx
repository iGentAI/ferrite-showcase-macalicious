import { useEffect, useMemo, useState } from "react";
import { readString, useKeptText, useKeptValue } from "../desktop/desktop-kept-value";
import { servedByDesktopApp, sessionFetch, withDeadline } from "../desktop/desktop-server";
import {
  NetworkUtility,
  type NetworkUtilityChoice,
  type NetworkUtilityProps,
  type NetworkUtilityRunContext,
  type NetworkUtilityToolState,
} from "./network-utility";
import {
  type NetworkUtilityInterface,
  type NetworkUtilityTab,
  type NetworkUtilityTool,
  TABS,
} from "./network-utility-data";
import { useNetworkUtilityMenus } from "./network-utility-menus";

/** The lookup route of the desktop's Network Utility module. */
export const LOOKUP_URL = "/api/network-utility/lookup";
/** The session's recent lookups (`ferrite-apps/desktop/src/apps/network_utility`). */
export const HISTORY_URL = "/api/network-utility/history";
/** A registry's record, over RDAP. */
export const WHOIS_URL = "/api/network-utility/whois";
/** One HTTPS request to a host the application declares. */
export const ROUND_TRIP_URL = "/api/network-utility/roundtrip";
/** The way out the application declares. */
export const DECLARED_URL = "/api/network-utility/declared";

/** How many timed requests Ping makes, a second apart. */
const ROUND_TRIPS = 4;
const ROUND_TRIP_PAUSE_MS = 1000;
/** The most a pane keeps of what it printed. */
const KEPT_OUTPUT = 6000;

/** Lookup's record types, as the module takes them. */
export const LOOKUP_CHOICE: NetworkUtilityChoice = {
  label: "Record:",
  options: [
    { id: "default", title: "A and AAAA" },
    ...["A", "AAAA", "CNAME", "MX", "NS", "PTR", "SOA", "TXT"].map((id) => ({ id, title: id })),
  ],
};

/** Lookup's resolvers, as the module takes them: each a public DNS-over-HTTPS service the application declares. */
export const LOOKUP_SERVER_CHOICE: NetworkUtilityChoice = {
  label: "Server:",
  options: [
    { id: "cloudflare", title: "Cloudflare" },
    { id: "google", title: "Google Public DNS" },
  ],
};

/** One line of a registry's record. */
export interface WhoisFact {
  label: string;
  value: string;
}

/** The module's answer to a Whois. */
export interface WhoisReply {
  query: string;
  registry: string;
  found: boolean;
  facts: readonly WhoisFact[];
}

/** The record of a reply, or `undefined` when it is not the module's. */
export function whoisFromServer(reply: unknown): WhoisReply | undefined {
  const body = reply as Record<string, unknown> | null;
  if (
    typeof body !== "object" ||
    body === null ||
    !isString(body.query) ||
    !isString(body.registry) ||
    typeof body.found !== "boolean" ||
    !Array.isArray(body.facts)
  )
    return undefined;
  const facts = body.facts as { label?: unknown; value?: unknown }[];
  if (!facts.every((fact) => isString(fact?.label) && isString(fact?.value))) return undefined;
  return {
    query: body.query,
    registry: body.registry,
    found: body.found,
    facts: facts as WhoisFact[],
  };
}

/** A registry's record as Whois prints it, with what it is instead of the whois protocol. */
export function whoisText(reply: WhoisReply): string {
  return [
    "Whois has started…",
    "",
    `Registry: ${reply.registry} (RDAP over HTTPS, not the whois protocol on port 43)`,
    "",
    ...(reply.found
      ? reply.facts.map((fact) => `${fact.label}: ${fact.value}`)
      : [`The registry holds no record of ${reply.query}.`]),
  ].join("\n");
}

/** One record the resolver answered. */
export interface LookupAnswer {
  name: string;
  type: string;
  ttl: number;
  data: string;
}

/** One question asked of the resolver, with its DNS status and answers. */
export interface LookupQuestion {
  name: string;
  type: string;
  status: string;
  answers: readonly LookupAnswer[];
}

/** The module's answer to a lookup. */
export interface LookupReply {
  host: string;
  resolver: string;
  questions: readonly LookupQuestion[];
  at: number;
}

/** One lookup the session made. */
export interface PastLookup {
  host: string;
  at: number;
  answers: number;
}

const isString = (value: unknown): value is string => typeof value === "string";
const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const isAnswer = (value: unknown): value is LookupAnswer => {
  const answer = value as Record<string, unknown> | null;
  return (
    typeof answer === "object" &&
    answer !== null &&
    isString(answer.name) &&
    isString(answer.type) &&
    isCount(answer.ttl) &&
    isString(answer.data)
  );
};

const isQuestion = (value: unknown): value is LookupQuestion => {
  const question = value as Record<string, unknown> | null;
  return (
    typeof question === "object" &&
    question !== null &&
    isString(question.name) &&
    isString(question.type) &&
    isString(question.status) &&
    Array.isArray(question.answers) &&
    question.answers.every(isAnswer)
  );
};

/** The lookup of a reply, or `undefined` when it is not the module's. */
export function lookupFromServer(reply: unknown): LookupReply | undefined {
  const body = reply as Record<string, unknown> | null;
  if (
    typeof body !== "object" ||
    body === null ||
    !isString(body.host) ||
    !isString(body.resolver) ||
    !isCount(body.at) ||
    !Array.isArray(body.questions) ||
    !body.questions.every(isQuestion)
  )
    return undefined;
  return { host: body.host, resolver: body.resolver, questions: body.questions, at: body.at };
}

/** The history of a reply: the lookups, newest first; empty before the first, or when unreadable. */
export function historyFromServer(reply: unknown): PastLookup[] {
  const history = (reply as { history?: unknown } | null)?.history;
  if (!Array.isArray(history)) return [];
  return history.filter((entry): entry is PastLookup => {
    const past = entry as Record<string, unknown> | null;
    return (
      typeof past === "object" &&
      past !== null &&
      isString(past.host) &&
      isCount(past.at) &&
      isCount(past.answers)
    );
  });
}

const time = (at: number) =>
  new Date(at).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
  });

/**
 * A lookup as the Lookup pane prints it: each question with the resolver's status, then its
 * records in the zone-file order `name TTL IN type data`, as dig writes them.
 */
export function lookupText(reply: LookupReply): string {
  const lines = ["Lookup has started…", "", `Server: ${reply.resolver}`, ""];
  for (const question of reply.questions) {
    lines.push(`;; ${question.name}  ${question.type}  status: ${question.status}`);
    if (question.answers.length === 0) lines.push(";; no records");
    for (const answer of question.answers) {
      lines.push(`${answer.name}\t${answer.ttl}\tIN\t${answer.type}\t${answer.data}`);
    }
    lines.push("");
  }
  lines.push(`;; Asked: ${time(reply.at)}`);
  return lines.join("\n");
}

/** The Lookup pane's text before a lookup: the session's recent ones, if any. */
export function historyText(history: readonly PastLookup[]): string {
  if (history.length === 0) return "";
  return [
    "Recent lookups in this session:",
    "",
    ...history.map(
      (past) =>
        `${past.host}\t${past.answers} ${past.answers === 1 ? "record" : "records"}\t${time(past.at)}`,
    ),
  ].join("\n");
}

/**
 * Why a tool cannot run when the desktop is served: what it would need that a Ferrite application
 * does not have. Ping, Whois and Netstat do what a web service can instead (`servedRun`).
 */
export function unavailableText(tool: "traceroute" | "finger" | "port-scan"): string {
  const title = TABS.find((tab) => tab.id === tool)?.title ?? tool;
  const why = {
    traceroute: "it sends packets with growing hop limits, and a web service has no sockets",
    finger: "it opens a TCP connection to port 79, and a web service has no sockets",
    "port-scan":
      "it opens TCP connections to many ports, and a web service has no sockets; its egress also refuses internal addresses",
  };
  return `${title} is not available on this desktop: ${why[tool]}. Nothing was sent.\n\nLookup and Whois are real: they ask a public DNS resolver and the registries over HTTPS.`;
}

/** What a pane says before it is first run: what it can do here, and what it cannot. */
export const SERVED_IDLE: Readonly<Record<NetworkUtilityTool, string>> = {
  lookup:
    "Real: asks a public DNS-over-HTTPS resolver through the application's declared egress, not this machine's own resolver.",
  whois:
    "Real, over RDAP rather than the whois protocol: asks the registries the application declares, for names under .com, .net and .org, and IPv4 addresses ARIN manages.",
  ping: "This is not ping: a web service cannot send ICMP. It times HTTPS requests from this browser, through the desktop's server, to a host the application declares, and says so.",
  netstat:
    "This is not netstat: a web page is shown no routing tables or sockets. It lists what the application and this browser can truly say, and says what each thing is.",
  traceroute: unavailableText("traceroute"),
  finger: unavailableText("finger"),
  "port-scan": unavailableText("port-scan"),
};

/** The requests this page has made, from the browser's own list. */
function pageRequests(): PerformanceResourceTiming[] {
  return typeof performance === "undefined"
    ? []
    : (performance.getEntriesByType("resource") as PerformanceResourceTiming[]);
}

function netstatStatistics(requests: readonly PerformanceResourceTiming[]): string {
  const protocols = new Map<string, { count: number; bytes: number }>();
  for (const request of requests) {
    const name = request.nextHopProtocol || "not told";
    const seen = protocols.get(name) ?? { count: 0, bytes: 0 };
    protocols.set(name, {
      count: seen.count + 1,
      bytes: seen.bytes + (request.transferSize ?? 0),
    });
  }
  return [
    "Not the machine's protocol statistics: these are the HTTP requests this page has made, from the browser's own timing list.",
    "",
    ...[...protocols].map(
      ([name, { count, bytes }]) => `${name}:\n\t${count} requests\n\t${bytes} bytes transferred`,
    ),
  ].join("\n");
}

function netstatSockets(requests: readonly PerformanceResourceTiming[]): string {
  const origins = new Map<string, number>();
  for (const request of requests) {
    const origin = URL.canParse(request.name) ? new URL(request.name).origin : request.name;
    origins.set(origin, (origins.get(origin) ?? 0) + 1);
  }
  return [
    "Not sockets: a web page is shown none. These are the origins this page has asked, and how many times.",
    "",
    ...[...origins].map(([origin, count]) => `${origin}\t${count}`),
  ].join("\n");
}

const NETSTAT_MULTICAST =
  "Not available: a web page is shown no multicast memberships, and a web service joins no groups. Nothing here can be read.";

/** What Netstat can truly say about the way out, for its routing choice. */
export function declaredText(reply: unknown): string {
  const body = reply as { hosts?: unknown; dns?: unknown; rdap?: unknown } | null;
  const list = (value: unknown) =>
    Array.isArray(value) ? value.filter(isString).map((each) => `\t${each}`) : [];
  return [
    "Not a routing table: the machine's is not shown to a web page. This is the only way out the application has, HTTPS to the destinations it declares.",
    "",
    "Lookup:",
    ...list(body?.dns),
    "Whois:",
    ...list(body?.rdap),
    "Ping's HTTPS round trip:",
    ...list(body?.hosts),
  ].join("\n");
}

const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });

/** The Ping pane's text so far. */
export function roundTripText(host: string, times: readonly number[], status: number): string {
  const lines = [
    "This is not ping: a web service cannot send ICMP.",
    `HTTPS requests from this browser, through the desktop's server, to ${host}. Each time includes the way to the server, the TLS and the host's answer.`,
    "",
    ...times.map(
      (time, at) =>
        `request ${at + 1}: HTTP ${status}, ${time.toFixed(0)} ms round trip over HTTPS`,
    ),
  ];
  if (times.length === ROUND_TRIPS) {
    const average = times.reduce((sum, each) => sum + each, 0) / times.length;
    lines.push(
      "",
      `min/avg/max = ${Math.min(...times).toFixed(0)}/${average.toFixed(0)}/${Math.max(...times).toFixed(0)} ms over HTTPS, not ICMP`,
    );
  }
  return lines.join("\n");
}

async function roundTrips(host: string, context: NetworkUtilityRunContext): Promise<string> {
  const url = `${ROUND_TRIP_URL}?host=${encodeURIComponent(host)}`;
  const times: number[] = [];
  let status = 0;
  for (let at = 0; at < ROUND_TRIPS && !context.signal.aborted; at += 1) {
    if (at > 0) await pause(ROUND_TRIP_PAUSE_MS, context.signal);
    const started = performance.now();
    const reply = await ask("Ping", url, context);
    if (typeof reply === "string") return reply;
    const body = reply as { declared?: unknown; status?: unknown; hosts?: unknown };
    if (body.declared !== true) {
      const hosts = Array.isArray(body.hosts) ? body.hosts.filter(isString) : [];
      return [
        `Nothing was sent to ${host}. This is not ping: a web service cannot send ICMP, and the application can reach only the hosts it declares. It can time an HTTPS request to these:`,
        "",
        ...hosts,
      ].join("\n");
    }
    times.push(performance.now() - started);
    status = typeof body.status === "number" ? body.status : 0;
    context.progress(roundTripText(host, times, status));
  }
  return roundTripText(host, times, status);
}

const errorOf = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string") return body.error;
  } catch {
    // The reply is not JSON: its status says enough.
  }
  return `HTTP ${response.status}`;
};

/** The module's reply to a GET, or the sentence a tool prints when there is none. */
async function ask(
  title: string,
  url: string,
  context: NetworkUtilityRunContext,
): Promise<unknown> {
  return withDeadline(async (signal) => {
    let response: Response;
    try {
      response = await sessionFetch(url, {
        credentials: "same-origin",
        headers: { accept: "application/json" },
        signal: AbortSignal.any([signal, context.signal]),
      });
    } catch (error) {
      return `${title} could not reach the desktop's server: ${error instanceof Error ? error.message : String(error)}`;
    }
    if (!response.ok) {
      const reason = await errorOf(response);
      return response.status === 400
        ? `${title} did not start: ${reason}.`
        : `${title} failed: ${reason}.`;
    }
    const reply: unknown = await response.json().catch(() => null);
    return reply ?? `${title} failed: the server's answer could not be read.`;
  });
}

/**
 * Runs a tool on the desktop's server. Lookup and Whois ask real services through the module;
 * Ping times HTTPS requests and says it is not ping; Netstat says what can be said; the rest say
 * why they cannot run. `onLookup` hears each lookup that was answered.
 */
export async function servedRun(
  tool: NetworkUtilityTool,
  input: string,
  onLookup?: () => void,
  option = "",
  context: NetworkUtilityRunContext = {
    signal: new AbortController().signal,
    progress: () => {},
  },
): Promise<string> {
  const host = input.trim();
  switch (tool) {
    case "traceroute":
    case "finger":
    case "port-scan":
      return unavailableText(tool);
    case "netstat": {
      if (option === "statistics") return netstatStatistics(pageRequests());
      if (option === "sockets") return netstatSockets(pageRequests());
      if (option === "multicast") return NETSTAT_MULTICAST;
      const reply = await ask("Netstat", DECLARED_URL, context);
      return typeof reply === "string" ? reply : declaredText(reply);
    }
    case "ping":
      return roundTrips(host, context);
    case "whois": {
      const reply = await ask("Whois", `${WHOIS_URL}?query=${encodeURIComponent(host)}`, context);
      if (typeof reply === "string") return reply;
      const record = whoisFromServer(reply);
      return record ? whoisText(record) : "Whois failed: the server's answer could not be read.";
    }
    case "lookup": {
      const [record = "", server = ""] = option.split(" ");
      const kind = record && record !== "default" ? `&type=${encodeURIComponent(record)}` : "";
      const from =
        server && server !== LOOKUP_SERVER_CHOICE.options[0]?.id
          ? `&server=${encodeURIComponent(server)}`
          : "";
      const reply = await ask(
        "Lookup",
        `${LOOKUP_URL}?host=${encodeURIComponent(host)}${kind}${from}`,
        context,
      );
      if (typeof reply === "string") return reply;
      const lookup = lookupFromServer(reply);
      if (!lookup) return "Lookup failed: the server's answer could not be read.";
      onLookup?.();
      return lookupText(lookup);
    }
  }
}

type BrowserConnection = { downlink?: number; effectiveType?: string; rtt?: number };

/**
 * The Info pane's one entry when served. A web page is shown no network interface, so each value
 * is what the browser itself says, labelled, or says that it is not shown.
 */
export function browserInterface(): NetworkUtilityInterface {
  const connection = (navigator as Navigator & { connection?: BrowserConnection }).connection;
  const hidden = "Not shown to a web page";
  return {
    id: "browser",
    title: "This Browser (not an interface)",
    hardwareAddress: hidden,
    ipAddress: hidden,
    linkSpeed:
      connection?.downlink !== undefined
        ? `${connection.downlink} Mbit/s (browser's estimate)`
        : "Unknown (this browser does not say)",
    linkStatus: `${navigator.onLine ? "Active" : "Inactive"} (browser's online flag)`,
    vendor: hidden,
    model:
      connection?.effectiveType !== undefined
        ? `Browser's class: ${connection.effectiveType}, ${connection.rtt ?? "?"} ms`
        : "Unknown (this browser does not say)",
    sentPackets: null,
    sendErrors: null,
    recvPackets: null,
    recvErrors: null,
    collisions: null,
  };
}

export const SERVED_INFO_PROMPT =
  "What this browser can say: a page is shown no network interface, address or packet count.";

/** The interface as the browser tells it now, read again when it goes on or off line. */
function useBrowserInterfaces(): readonly NetworkUtilityInterface[] {
  const [shown, setShown] = useState(() => [browserInterface()]);
  useEffect(() => {
    const read = () => setShown([browserInterface()]);
    window.addEventListener("online", read);
    window.addEventListener("offline", read);
    return () => {
      window.removeEventListener("online", read);
      window.removeEventListener("offline", read);
    };
  }, []);
  return shown;
}

/** The session's recent lookups, read when the window opens and again after each lookup. */
function useHistory(): [readonly PastLookup[], () => void] {
  const [history, setHistory] = useState<readonly PastLookup[]>([]);
  const [reads, setReads] = useState(0);
  useEffect(() => {
    let live = true;
    void reads;
    withDeadline(async (signal) => {
      const response = await sessionFetch(HISTORY_URL, {
        credentials: "same-origin",
        headers: { accept: "application/json" },
        signal,
      });
      return response.ok ? historyFromServer(await response.json()) : null;
    })
      .catch(() => null)
      .then((read) => {
        if (live && read) setHistory(read);
      });
    return () => {
      live = false;
    };
  }, [reads]);
  return [history, () => setReads((count) => count + 1)];
}

const readTab = (stored: unknown): NetworkUtilityTab | undefined =>
  TABS.find((tab) => tab.id === (readString(stored) ?? ""))?.id;

/** What the panes hold, from what was kept. */
export function toolsFromKept(
  text: string,
): Partial<Record<NetworkUtilityTool, NetworkUtilityToolState>> {
  try {
    const read = JSON.parse(text) as unknown;
    return typeof read === "object" && read !== null
      ? (read as Partial<Record<NetworkUtilityTool, NetworkUtilityToolState>>)
      : {};
  } catch {
    return {};
  }
}

function ServedNetworkUtility(props: NetworkUtilityProps) {
  const [history, reread] = useHistory();
  const interfaces = useBrowserInterfaces();
  const [tab, setTab] = useKeptValue<NetworkUtilityTab>(
    "networkUtility.tab",
    readTab,
    props.defaultTab ?? "info",
  );
  const [keptTools, keepTools] = useKeptText("networkUtility.tools", "{}");
  const [notice, setNotice] = useState("");
  const tools = useMemo(() => toolsFromKept(keptTools), [keptTools]);
  const shownTab = props.tab ?? tab;
  useNetworkUtilityMenus({
    title: TABS.find((each) => each.id === shownTab)?.title ?? "",
    output: (shownTab === "info" ? undefined : tools[shownTab])?.output ?? "",
    isKey: props.state === "key",
    say: setNotice,
  });
  const idleOutputs = useMemo(
    () => ({
      ...SERVED_IDLE,
      lookup: [SERVED_IDLE.lookup, historyText(history)].filter(Boolean).join("\n\n"),
    }),
    [history],
  );
  return (
    <NetworkUtility
      interfaces={interfaces}
      infoPrompt={SERVED_INFO_PROMPT}
      choices={{ lookup: [LOOKUP_CHOICE, LOOKUP_SERVER_CHOICE] }}
      run={(tool, input, option, context) => servedRun(tool, input, reread, option, context)}
      idleOutputs={idleOutputs}
      tab={tab}
      onTabChange={setTab}
      restored={tools}
      notice={notice}
      onToolStateChange={(tool, state) =>
        keepTools(
          JSON.stringify({
            ...tools,
            [tool]: { input: state.input, output: state.output.slice(0, KEPT_OUTPUT) },
          }),
        )
      }
      {...props}
    />
  );
}

/**
 * Network Utility as the desktop shows it. When the `macalicious-desktop` Ferrite application
 * serves the desktop, Lookup and Whois ask real services through the application's declared
 * egress, Ping times labelled HTTPS requests, and the window says plainly what each other pane
 * cannot be. Every other build shows the demo's made-up output, as `NetworkUtility` does.
 */
export function DesktopNetworkUtility(props: NetworkUtilityProps) {
  return servedByDesktopApp() ? <ServedNetworkUtility {...props} /> : <NetworkUtility {...props} />;
}

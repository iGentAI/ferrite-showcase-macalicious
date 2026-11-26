import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { forgetDesktopValues } from "../desktop/desktop-personal";
import {
  DesktopNetworkUtility,
  historyFromServer,
  historyText,
  lookupFromServer,
  lookupText,
  roundTripText,
  servedRun,
  toolsFromKept,
  unavailableText,
  whoisFromServer,
  whoisText,
} from "./network-utility-desktop";

afterEach(() => {
  forgetDesktopValues();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** A reply of the module, as `ferrite dev` answered it for example.com. */
const LOOKUP = {
  host: "example.com",
  resolver: "cloudflare-dns.com (DNS over HTTPS)",
  at: 1_791_833_045_615,
  questions: [
    {
      name: "example.com",
      type: "A",
      status: "NOERROR",
      answers: [{ name: "example.com", type: "A", ttl: 279, data: "104.20.23.154" }],
    },
    { name: "example.com", type: "AAAA", status: "NOERROR", answers: [] },
  ],
};

const output = (tool: string) =>
  screen.getByRole<HTMLTextAreaElement>("textbox", { name: `${tool} output` });

const json = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

describe("Network Utility on the desktop's Ferrite application", () => {
  it("reads only replies in the module's shape", () => {
    expect(lookupFromServer(LOOKUP)?.questions).toHaveLength(2);
    expect(lookupFromServer({ ...LOOKUP, at: -1 })).toBeUndefined();
    expect(
      lookupFromServer({ ...LOOKUP, questions: [{ ...LOOKUP.questions[0], answers: [{}] }] }),
    ).toBeUndefined();
    expect(historyFromServer({ history: null, rev: 0 })).toEqual([]);
    expect(
      historyFromServer({
        history: [{ host: "a.test", at: 1, answers: 2 }, { host: 3 }],
        rev: 1,
      }),
    ).toEqual([{ host: "a.test", at: 1, answers: 2 }]);
  });

  it("asks the chosen lookup server, and says which answered", async () => {
    const fetched = vi.fn(async (_url: string) =>
      json(200, {
        host: "example.com",
        resolver: "dns.google (DNS over HTTPS)",
        questions: [],
        at: 1,
      }),
    );
    vi.stubGlobal("fetch", fetched);
    const text = await servedRun("lookup", "example.com", undefined, "MX google");
    expect(String(fetched.mock.calls[0]?.[0])).toBe(
      "/api/network-utility/lookup?host=example.com&type=MX&server=google",
    );
    expect(text).toContain("Server: dns.google (DNS over HTTPS)");
    vi.unstubAllGlobals();
  });

  it("prints the resolver's records and statuses, and the recent lookups", () => {
    const text = lookupText(LOOKUP);
    expect(text).toContain("Server: cloudflare-dns.com (DNS over HTTPS)");
    expect(text).toContain(";; example.com  A  status: NOERROR");
    expect(text).toContain("example.com\t279\tIN\tA\t104.20.23.154");
    expect(text).toContain(";; example.com  AAAA  status: NOERROR\n;; no records");
    expect(historyText([])).toBe("");
    expect(historyText([{ host: "a.test", at: 0, answers: 1 }])).toContain("a.test\t1 record\t");
    expect(unavailableText("finger")).toMatch(
      /^Finger is not available on this desktop: .*sockets/,
    );
    expect(roundTripText("example.com", [12.4, 20, 30, 18], 200).split("\n").at(-1)).toBe(
      "min/avg/max = 12/20/30 ms over HTTPS, not ICMP",
    );
    expect(roundTripText("example.com", [12], 200)).toContain("This is not ping");
    expect(
      whoisText({ query: "nope.com", registry: "rdap.verisign.com", found: false, facts: [] }),
    ).toContain("The registry holds no record of nope.com.");
    expect(
      whoisFromServer({ query: "a", registry: "b", found: true, facts: [{ label: 1 }] }),
    ).toBeUndefined();
    expect(toolsFromKept("not json")).toEqual({});
  });

  it("looks a host up on the server, shows the history first, and explains the other tools", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    let history: unknown = { history: [{ host: "old.test", at: 0, answers: 3 }], rev: 1 };
    const fetch = vi.fn(async (url: string) => {
      if (url === "/api/network-utility/history") return json(200, history);
      if (url === "/api/network-utility/roundtrip?host=elsewhere.test")
        return json(200, { host: "elsewhere.test", declared: false, hosts: ["example.com"] });
      if (url === "/api/network-utility/lookup?host=example.com") {
        history = { history: [{ host: "example.com", at: 1, answers: 1 }], rev: 2 };
        return json(200, LOOKUP);
      }
      if (url === "/api/network-utility/lookup?host=bad%20host")
        return json(400, { error: '"bad host" is not a host name or an IPv4 address' });
      return json(404, { error: "not found" });
    });
    vi.stubGlobal("fetch", fetch);
    render(<DesktopNetworkUtility defaultTab="lookup" />);
    await waitFor(() => expect(output("Lookup").value).toContain("old.test\t3 records"));

    const field = screen.getByRole("textbox", { name: "Internet address" });
    await user.type(field, "example.com{Enter}");
    await waitFor(() => expect(output("Lookup").value).toContain("104.20.23.154"));
    expect(fetch).toHaveBeenCalledWith(
      "/api/network-utility/lookup?host=example.com",
      expect.anything(),
    );
    // The history is read again after a lookup.
    await waitFor(() =>
      expect(
        fetch.mock.calls.filter(([url]) => url === "/api/network-utility/history"),
      ).toHaveLength(2),
    );

    await user.clear(field);
    await user.type(field, "bad host{Enter}");
    await waitFor(() =>
      expect(output("Lookup").value).toBe(
        'Lookup did not start: "bad host" is not a host name or an IPv4 address.',
      ),
    );

    await user.click(screen.getByRole("tab", { name: "Ping" }));
    expect(output("Ping").value).toMatch(/^This is not ping: a web service cannot send ICMP/);
    await user.type(
      screen.getByRole("textbox", { name: "Network address" }),
      "elsewhere.test{Enter}",
    );
    await waitFor(() =>
      expect(output("Ping").value).toContain("Nothing was sent to elsewhere.test"),
    );
    expect(output("Ping").value).toContain("example.com");

    await user.click(screen.getByRole("tab", { name: "Traceroute" }));
    expect(output("Traceroute").value).toBe(unavailableText("traceroute"));

    await user.click(screen.getByRole("tab", { name: "Info" }));
    expect(screen.getByRole("combobox", { name: "Network interface" })).toHaveTextContent(
      "This Browser (not an interface)",
    );
    expect(screen.getByText("Sent Packets:").nextElementSibling?.textContent).toBe("Unknown");
    expect(screen.getByText("Link Status:").nextElementSibling?.textContent).toBe(
      "Active (browser's online flag)",
    );
    expect(screen.getByText("IP Address:").nextElementSibling?.textContent).toBe(
      "Not shown to a web page",
    );
  });

  it("asks a registry for Whois", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/network-utility/history") return json(200, { history: null, rev: 0 });
        if (url === "/api/network-utility/whois?query=example.com")
          return json(200, {
            query: "example.com",
            registry: "rdap.verisign.com",
            found: true,
            facts: [{ label: "Domain Name", value: "EXAMPLE.COM" }],
            at: 1,
          });
        return json(404, { error: "not found" });
      }),
    );
    render(<DesktopNetworkUtility tab="whois" />);
    await user.type(screen.getByRole("textbox", { name: "Domain address" }), "example.com{Enter}");
    await waitFor(() =>
      expect(output("Whois").value).toBe(
        "Whois has started…\n\nRegistry: rdap.verisign.com (RDAP over HTTPS, not the whois protocol on port 43)\n\nDomain Name: EXAMPLE.COM",
      ),
    );
  });

  it("stops a run that is under way and keeps what it printed", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "/api/network-utility/history") return json(200, { history: null, rev: 0 });
        signal = init?.signal ?? undefined;
        return new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        });
      }),
    );
    render(<DesktopNetworkUtility tab="ping" />);
    await user.type(screen.getByRole("textbox", { name: "Network address" }), "example.com{Enter}");
    await user.click(await screen.findByRole("button", { name: "Stop" }));
    expect(signal?.aborted).toBe(true);
    await waitFor(() =>
      expect(output("Ping").value).toBe("Ping has started…\n\nPing was stopped."),
    );
    expect(screen.getByRole("button", { name: "Ping" })).toBeEnabled();
  });

  it("says the resolver failed when the server could not reach it", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.startsWith("/api/network-utility/lookup")
          ? json(502, { error: "egress refused the resolver: egress denied" })
          : json(200, { history: null, rev: 0 }),
      ),
    );
    render(<DesktopNetworkUtility defaultTab="lookup" />);
    await user.type(
      screen.getByRole("textbox", { name: "Internet address" }),
      "example.com{Enter}",
    );
    await waitFor(() =>
      expect(output("Lookup").value).toBe(
        "Lookup failed: egress refused the resolver: egress denied.",
      ),
    );
  });

  it("shows the demo's output and asks nothing when not served", async () => {
    const user = userEvent.setup();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<DesktopNetworkUtility defaultTab="lookup" />);
    await user.type(
      screen.getByRole("textbox", { name: "Internet address" }),
      "example.com{Enter}",
    );
    expect(output("Lookup").value).toContain(";; ANSWER SECTION:");
    expect(fetch).not.toHaveBeenCalled();
  });
});

import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { reportAsText, type SystemInformationItem } from "./system-information-data";
import {
  type BrowserFacts,
  bytesText,
  DesktopSystemInformation,
  desktopItems,
  reportFromServer,
} from "./system-information-desktop";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const BROWSER: BrowserFacts = {
  userAgent: "Firefox/144.0",
  languages: ["en-US", "nl"],
  platform: "Linux x86_64",
  processors: 8,
  cookies: true,
  online: true,
  timeZone: "Europe/Amsterdam",
  screen: { width: 1440, height: 900, availWidth: 1440, availHeight: 875, colorDepth: 24 },
  scale: 2,
  viewport: { width: 1280, height: 800 },
  dark: false,
};

const REPLY = {
  facts: {
    application: "macalicious-desktop",
    generation: 0,
    instance: null,
    build: "sha256:abc",
    site_files: 120,
    modules: 2,
    now_ms: 1_760_000_000_000,
    storage: {
      bytes: 1500,
      keys: 2,
      apps: [
        { name: "calculator", title: "Calculator", bytes: 1500, keys: 2 },
        { name: "notes", title: "Notes", bytes: 0, keys: 0 },
      ],
    },
  },
  modules: [
    { name: "calculator", title: "Calculator", api: "/api/calculator/" },
    { name: "notes", title: "Notes", api: "/api/notes/" },
  ],
  counters: [{ name: "calculator", requests: 5, writes: 2, errors: 1, last_ms: 1_760_000_000_000 }],
};

const find = (items: readonly SystemInformationItem[], id: string): SystemInformationItem => {
  for (const item of items) {
    if (item.id === id) return item;
    const inner = item.children && find(item.children, id);
    if (inner) return inner;
  }
  return undefined as unknown as SystemInformationItem;
};

describe("System Information on the desktop's Ferrite application", () => {
  it("reads only a report in the module's shape", () => {
    expect(reportFromServer(REPLY)?.modules).toHaveLength(2);
    expect(reportFromServer({ facts: {}, modules: [] })).toBeUndefined();
    expect(reportFromServer([])).toBeUndefined();
    // Malformed facts, a module without a route, a counter without its figures, or a module
    // named twice: the report is not shown rather than shown with invented values.
    expect(
      reportFromServer({ ...REPLY, facts: { ...REPLY.facts, generation: "0" } }),
    ).toBeUndefined();
    expect(
      reportFromServer({ ...REPLY, modules: [...REPLY.modules, { name: "x", title: "X" }] }),
    ).toBeUndefined();
    expect(reportFromServer({ ...REPLY, counters: [{ name: "calculator" }] })).toBeUndefined();
    expect(
      reportFromServer({ ...REPLY, modules: [...REPLY.modules, REPLY.modules[0]] }),
    ).toBeUndefined();
  });

  it("marks a module's storage as a floor when the server stopped counting it", () => {
    const apps = REPLY.facts.storage.apps.map((app) => ({ ...app, truncated: true }));
    const report = reportFromServer({
      ...REPLY,
      facts: { ...REPLY.facts, storage: { ...REPLY.facts.storage, apps } },
    });
    const storage = find(desktopItems(BROWSER, report, false), "application/storage").report;
    expect(storage.kind === "table" && storage.rows[0]?.cells).toEqual({
      title: "Calculator",
      keys: "at least 2",
      bytes: "at least 1.5 KB",
    });
  });

  it("writes sizes in decimal units", () => {
    expect(bytesText(999)).toBe("999 bytes");
    expect(bytesText(1500)).toBe("1.5 KB");
    expect(bytesText(12_340_000)).toBe("12.3 MB");
    expect(bytesText(undefined)).toBe("");
  });

  it("lists the browser's facts and the application's, and says what a page cannot read", () => {
    const items = desktopItems(BROWSER, reportFromServer(REPLY), false);
    expect(items.map((item) => item.name)).toEqual([
      "Hardware",
      "Network",
      "Software",
      "Browser",
      "Ferrite Application",
    ]);
    expect(reportAsText(find(items, "hardware"))).toContain(
      "Model, Processor, Serial Number, Battery, USB and Disks: Not available to a web page",
    );
    // A table's rows, tab separated under its titles, for Copy and Save.
    expect(reportAsText(find(items, "application/modules")).split("\n").slice(0, 4)).toEqual([
      "App Modules",
      "",
      "Module\tRoute\tRequests",
      "Calculator\t/api/calculator/\t5",
    ]);
    const overview = find(items, "application").report;
    expect(overview.kind === "properties" && overview.sections[0]?.entries).toEqual(
      expect.arrayContaining([
        ["Deployment", "Not deployed (local ferrite dev)"],
        ["Instance", "Local runtime"],
        ["App Modules", "2"],
      ]),
    );
    const modules = find(items, "application/modules").report;
    expect(modules.kind === "table" && modules.rows.map((row) => row.cells)).toEqual([
      { title: "Calculator", api: "/api/calculator/", requests: "5" },
      { title: "Notes", api: "/api/notes/", requests: "0" },
    ]);
    // A module that keeps nothing for the session is not a row of Session Storage.
    const storage = find(items, "application/storage").report;
    expect(storage.kind === "table" && storage.rows.map((row) => row.id)).toEqual(["calculator"]);
    // Without the browser's estimate, Storage says so instead of inventing figures.
    expect(find(items, "browser/storage").report.kind).toBe("empty");
  });

  it("says when the application did not answer", () => {
    const items = desktopItems(BROWSER, undefined, true);
    expect(find(items, "application").report).toEqual({
      kind: "empty",
      message: "The application did not answer.",
    });
  });

  it("opens on the application's report when served", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const fetch = vi.fn(async () => ({ ok: true, json: async () => REPLY }));
    vi.stubGlobal("fetch", fetch);
    render(<DesktopSystemInformation />);
    expect(fetch).toHaveBeenCalledWith("/api/system-information/report", expect.anything());
    const frame = screen.getByRole("region", { name: "Macalicious Desktop" });
    await waitFor(() =>
      expect(within(frame).getByText("Not deployed (local ferrite dev)")).toBeInTheDocument(),
    );
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import notDeployed from "../../ferrite-apps/desktop/not-deployed.json";
import { onDesktopEffects } from "../desktop/desktop-effects";
import { requestHelp } from "../desktop/desktop-help";
import { HelpViewer } from "./help-viewer";
import {
  APP_GUIDES,
  actionsOf,
  DESKTOP_BOOKS,
  guideNamed,
  withDesktopBooks,
} from "./help-viewer-guides";

/** The same files the desktop's list is found from (`discoveredApps`), read as text. */
const sources = import.meta.glob<string>("../*/app.ts", {
  query: "?raw",
  import: "default",
  eager: true,
});
const left = new Set(notDeployed.apps.map((app) => app.id));
const deployed = Object.values(sources)
  .map((source) => ({
    id: /^\s+id: "([^"]+)"/m.exec(source)?.[1] ?? "",
    name: /^\s+name: "([^"]+)"/m.exec(source)?.[1] ?? "",
    menus: (/^\s+menus: \[([^\]]*)\]/m.exec(source)?.[1] ?? "").match(/[^",\s][^",]*/g) ?? [],
  }))
  .filter((app) => !left.has(app.id));

const NO_GUIDE: Readonly<Record<string, string>> = {
  "about-this-mac": "One window of facts about the desktop, with nothing to learn to use.",
  "force-quit": "One small panel, reached from the Apple menu, whose row says what it does.",
  "help-viewer": "Its own table of contents is its help, and macOS Help says how to search.",
};

const pageText = (book: { topics?: readonly { summary: string; body: readonly string[] }[] }) =>
  (book.topics ?? []).flatMap((topic) => [topic.summary, ...topic.body]);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a guide for every deployed application", () => {
  it("finds the applications the desktop lists", () => {
    expect(deployed.length).toBeGreaterThanOrEqual(39);
    expect(deployed.map((app) => app.id)).toContain("quicktime-player");
    expect(deployed.map((app) => app.id)).not.toContain("disk-utility");
    for (const app of deployed) expect(app.name).not.toBe("");
  });

  it("has a guide under the name each Help row asks with, or says why not", () => {
    const without = deployed.filter((app) => !guideNamed(app.name)).map((app) => app.id);
    expect(without.sort()).toEqual(Object.keys(NO_GUIDE).sort());
  });

  it("gives each guide the id of its application", () => {
    const ids = new Map(deployed.map((app) => [app.name, app.id]));
    for (const book of APP_GUIDES) {
      const name = book.title.replace(/ Help$/, "");
      expect(book.id).toBe(`guide:${ids.get(name)}`);
    }
    expect(guideNamed("QuickTime Player")?.id).toBe("guide:quicktime-player");
    expect(guideNamed("System Information")?.id).toBe("guide:system-information");
  });

  it("links every page of a guide to its application, by an id that exists", () => {
    const ids = new Set(deployed.map((app) => app.id));
    for (const book of DESKTOP_BOOKS)
      for (const topic of book.topics ?? [])
        for (const action of actionsOf(topic.id))
          if ("app" in action) expect(ids, `${topic.id} opens ${action.app}`).toContain(action.app);
    expect(actionsOf("guide:find-my:2")).toEqual([{ label: "Open Find My", app: "find-my" }]);
    expect(actionsOf("guide:app-store:1")).toEqual([{ label: "Open App Store", app: "app-store" }]);
    expect(actionsOf("mac:tips:1")).toEqual([]);
  });

  it("names in its text only menus the application has", () => {
    for (const app of deployed) {
      const book = guideNamed(app.name);
      if (!book || app.menus.length === 0) continue;
      for (const line of pageText(book))
        for (const [, menu] of line.matchAll(/\bChoose ([A-Z][A-Za-z ]*?) > /g))
          expect(app.menus, `${app.name}: ${line}`).toContain(menu);
    }
  });

  it("writes three topics or more for each application it was asked for", () => {
    const short = APP_GUIDES.filter((book) => (book.topics ?? []).length < 3)
      .map((book) => book.title)
      .filter(
        (title) =>
          !["Terminal", "Calculator", "Finder", "Safari", "Stickies", "Dictionary"].some((old) =>
            title.startsWith(old),
          ),
      );
    expect(short).toEqual([]);
  });
});

describe("books of the same title", () => {
  const photos = {
    id: "photos-help",
    title: "Photos Help",
    summary: "The server's.",
    topics: [
      { id: "photos-import", title: "Import", summary: "s", body: [], source: "Photos Help" },
    ],
  };

  it("are one entry, holding both's topics under the server's id", () => {
    const books = withDesktopBooks([photos]);
    expect(books.filter((book) => book.title === "Photos Help").map((book) => book.id)).toEqual([
      "photos-help",
    ]);
    const joined = books.find((book) => book.id === "photos-help");
    expect(joined?.topics?.at(-1)?.id).toBe("photos-import");
    expect(joined?.topics?.[0]?.id).toBe("guide:photos:1");
  });

  it("lists a server's other book first, then the Mac's, then the applications' by name", () => {
    const titles = withDesktopBooks([{ id: "d", title: "Desktop Help", summary: "" }]).map(
      (book) => book.title,
    );
    expect(titles.slice(0, 5)).toEqual([
      "Desktop Help",
      "macOS Help",
      "See What’s New in macOS",
      "Tips for Your Mac",
      "Activity Monitor Help",
    ]);
  });
});

describe("asking Help Viewer", () => {
  function open() {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "PUT")
          return { ok: true, json: async () => JSON.parse(String(init.body)) };
        if (url === "/api/help-viewer/books")
          return {
            ok: true,
            json: async () => ({
              books: [{ id: "tv-help", title: "TV Help", summary: "The server's.", topics: [] }],
            }),
          };
        return { ok: true, json: async () => ({ page: null, rev: 0 }) };
      }),
    );
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(673);
    render(<HelpViewer state="key" />);
    return waitFor(() =>
      expect(document.querySelector(".mac-help-viewer-body")).not.toHaveAttribute("aria-busy"),
    );
  }
  const page = () => screen.getByRole("heading", { level: 1 }).textContent;

  it.each([
    ["QuickTime Player", "QuickTime Player Help", "Record"],
    ["Find My", "Find My Help", "Share your location"],
    ["TV", "TV Help", "Make a playlist"],
    ["macOS", "macOS Help", "Get help in any application"],
    ["What’s New", "See What’s New in macOS", "Music, TV and Podcasts"],
    ["Tips", "Tips for Your Mac", "Switch applications"],
  ])("opens the book asked for by %s", async (asked, title, topic) => {
    await open();
    requestHelp(asked);
    await waitFor(() => expect(page()).toBe(title));
    expect(screen.getByRole("link", { name: topic })).toBeVisible();
  });

  it("opens the application a page of a hyphenated guide links to", async () => {
    const heard: unknown[] = [];
    const stop = onDesktopEffects((list) => heard.push(...list));
    await open();
    requestHelp("Find My");
    await waitFor(() => expect(page()).toBe("Find My Help"));
    screen.getByRole("link", { name: "Share your location" }).click();
    (await screen.findByRole("button", { name: "Open Find My" })).click();
    expect(heard).toContainEqual({ open: "find-my" });
    stop();
  });
});

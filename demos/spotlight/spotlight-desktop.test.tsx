import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DesktopApp } from "../desktop/desktop-apps";
import { takeOpenItemRequests } from "../desktop/desktop-open-item";
import { takeOpenUrlRequests } from "../desktop/desktop-open-url";
import { takeOpenFileRequests } from "../finder/finder-open";
import { takePaneRequest } from "../system-preferences/pane-request";
import {
  definitionFromServer,
  groupResults,
  instantText,
  mailNote,
  SpotlightSearchPanel,
  searchFromServer,
  searchNote,
} from "./spotlight-desktop";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Spotlight lists only an application's id and name. */
const APPS = [
  { id: "contacts", name: "Contacts" },
  { id: "stickies", name: "Stickies" },
  { id: "calculator", name: "Calculator" },
  { id: "safari", name: "Safari" },
] as unknown as DesktopApp[];

const ADA = {
  kind: "contacts",
  app: "contacts",
  id: "card-ada",
  title: "Ada Lovelace",
  detail: "ada@analytical.example",
};
const STICKY = {
  kind: "stickies",
  app: "stickies",
  id: "sticky-1",
  title: "Call Ada",
  detail: "about the engine",
};
const FILE = {
  kind: "files",
  app: "finder",
  id: "f1",
  title: "ada-notes.txt",
  detail: "…the Analytical Engine…",
  at: 0,
};

type Reply = { ok: boolean; status: number; json: () => Promise<unknown> };
const ok = (body: unknown): Reply => ({ ok: true, status: 200, json: async () => body });
const missing: Reply = { ok: false, status: 404, json: async () => ({ error: "no module" }) };

function renderSpotlight() {
  const launch = vi.fn();
  const onClose = vi.fn();
  render(<SpotlightSearchPanel apps={APPS} launch={launch} onClose={onClose} />);
  return {
    launch,
    onClose,
    field: screen.getByRole("combobox", { name: "Spotlight Search" }),
  };
}

describe("Spotlight on the desktop's Ferrite application", () => {
  it("reads only results in the module's shape, and groups them in the order of the kinds", () => {
    const search = searchFromServer({
      query: "ada",
      results: [FILE, STICKY, ADA, { ...ADA, kind: "smoke signals" }, { id: 3 }],
      truncated: true,
      indexing: true,
    });
    expect(search?.results).toEqual([FILE, STICKY, ADA]);
    expect(search?.truncated).toBe(true);
    expect(search?.indexing).toBe(true);
    expect(searchFromServer({ results: [] })).toBeUndefined();
    expect(groupResults(search?.results ?? []).map((group) => group.label)).toEqual([
      "Contacts",
      "Stickies",
      "Files",
    ]);
    const file = (title: string) => ({ ...FILE, kind: "files" as const, id: title, title });
    expect(
      groupResults([
        file("Beach.png"),
        file("Tax.pdf"),
        file("Film.mov"),
        file("Song.mp3"),
        file("Pitch.key"),
        file("a.zip"),
      ]).map((group) => [group.label, group.results.map((result) => result.title)]),
    ).toEqual([
      ["Files", ["a.zip"]],
      ["Images", ["Beach.png"]],
      ["PDF Documents", ["Tax.pdf"]],
      ["Movies", ["Film.mov"]],
      ["Music Files", ["Song.mp3"]],
      ["Presentations", ["Pitch.key"]],
    ]);
    expect(instantText({ kind: "photos", at: Date.UTC(2020, 0, 2, 12) })).toMatch(
      /^Taken Jan 2, 2020/,
    );
    expect(instantText({ kind: "notes" })).toBeUndefined();
  });

  it("reads how much of the person's Mail a search covered, and says so only when some was left", () => {
    const read = (fields: object) =>
      searchFromServer({ query: "q", results: [], truncated: false, ...fields });
    const cut = read({ searched_mail: 87, unsearched_mail: true });
    expect(cut).toMatchObject({ searchedMail: 87, unsearchedMail: true });
    expect(cut && mailNote(cut)).toBe("Mail: only your newest 87 messages were searched.");
    expect(mailNote({ searchedMail: 1, unsearchedMail: true })).toBe(
      "Mail: only your newest message was searched.",
    );
    expect(mailNote({ searchedMail: 0, unsearchedMail: true })).toBe(
      "Mail: no messages were searched.",
    );
    const whole = read({ searched_mail: 40, unsearched_mail: false });
    expect(whole && mailNote(whole)).toBeUndefined();
    // A reply without the fields, or with others than numbers and true: nothing is claimed.
    expect(read({})).toMatchObject({ searchedMail: 0, unsearchedMail: false });
    expect(read({ searched_mail: -3, unsearched_mail: "yes" })).toMatchObject({
      searchedMail: 0,
      unsearchedMail: false,
    });
  });

  it("says under the results when older Mail was not searched, and nothing once all of it was", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.startsWith("/api/dictionary/")) return missing;
        const query = decodeURIComponent(url.split("q=")[1] ?? "");
        return ok(
          query === "ada"
            ? { query, results: [ADA], truncated: false, searched_mail: 87, unsearched_mail: true }
            : query === "call"
              ? { query, results: [STICKY], truncated: false, searched_mail: 12 }
              : { query, results: [], truncated: false },
        );
      }),
    );
    const { field } = renderSpotlight();
    await user.type(field, "ada");
    await screen.findByRole("option", { name: "Ada Lovelace" });
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("Mail: only your newest 87 messages were searched.");
    expect(screen.getByRole("listbox")).not.toContainElement(note);
    await user.clear(field);
    await user.type(field, "call");
    await screen.findByRole("option", { name: "Call Ada" });
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("reads the first definition Dictionary gives, and nothing from a word it does not know", () => {
    const entry = {
      word: "serendipity",
      found: true,
      dictionary: { parts: [{ part: "noun", senses: [{ text: "A happy accident." }] }] },
    };
    expect(definitionFromServer(entry)).toEqual({
      word: "serendipity",
      part: "noun",
      text: "A happy accident.",
    });
    expect(definitionFromServer({ ...entry, found: false })).toBeUndefined();
    expect(definitionFromServer({ word: "x", found: true, dictionary: null })).toBeUndefined();
  });

  it("opens a file in the application that opens it, and says which", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    const picture = { ...FILE, id: "f-beach", title: "Beach.png" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.startsWith("/api/dictionary/")
          ? missing
          : ok({
              query: decodeURIComponent(url.split("q=")[1] ?? ""),
              results: [picture],
              truncated: false,
            }),
      ),
    );
    const { launch, field } = renderSpotlight();
    await user.type(field, "beach");
    await screen.findByRole("option", { name: "Beach.png" });
    expect(await screen.findByText("Opens in Preview")).toBeVisible();
    await user.keyboard("{Enter}");
    expect(launch).toHaveBeenCalledWith("preview");
    expect(takeOpenFileRequests("preview")).toEqual([
      { app: "preview", id: "f-beach", name: "Beach.png" },
    ]);
  });

  it("lists what the person saved after the applications, and opens the app that keeps it", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    const fetch = vi.fn(async (url: string) =>
      url.startsWith("/api/dictionary/")
        ? missing
        : ok(
            url === "/api/spotlight/search?q=ada"
              ? { query: "ada", results: [ADA, STICKY, FILE], truncated: false }
              : {
                  query: decodeURIComponent(url.split("q=")[1] ?? ""),
                  results: [],
                  truncated: false,
                },
          ),
    );
    vi.stubGlobal("fetch", fetch);
    const { launch, onClose, field } = renderSpotlight();
    await user.type(field, "ada");
    const contacts = await screen.findByRole("group", { name: "Top Hit" });
    expect(within(contacts).getByRole("option", { name: "Ada Lovelace" })).toBeVisible();
    expect(
      within(screen.getByRole("group", { name: "Files" })).getByRole("option", {
        name: "ada-notes.txt",
      }),
    ).toBeVisible();
    // No application is named "ada": the first data result is selected and previewed.
    expect(screen.getByRole("option", { name: "Ada Lovelace" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Opens in Contacts")).toBeVisible();
    expect(screen.getByText("ada@analytical.example")).toBeVisible();
    // A web search comes last.
    expect(screen.getByRole("option", { name: "Search the Web for “ada”" })).toBeVisible();
    // Dictionary is asked with history=0, and its 404 (not deployed) shows nothing.
    await waitFor(() =>
      expect(fetch.mock.calls.map(([url]) => url)).toContain(
        "/api/dictionary/entry?word=ada&history=0",
      ),
    );
    expect(screen.queryByRole("group", { name: "Definition" })).toBeNull();
    expect(
      fetch.mock.calls.filter(([url]) => url.startsWith("/api/spotlight/")).map(([url]) => url),
    ).toEqual(["/api/spotlight/search?q=ada"]);

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: "Call Ada" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.keyboard("{Enter}");
    expect(launch).toHaveBeenCalledWith("stickies");
    expect(onClose).toHaveBeenCalled();
  });

  it("finds a System Preferences pane by name and opens it there", async () => {
    const user = userEvent.setup();
    const { field, launch } = renderSpotlight();
    await user.type(field, "Dock");
    expect(screen.getByRole("group", { name: "Top Hit" })).toHaveTextContent("Dock");
    await user.keyboard("{Enter}");
    expect(launch).toHaveBeenCalledWith("system-preferences");
    expect(takePaneRequest()).toBe("dock");
  });

  it("shows a definition and opens Dictionary", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.startsWith("/api/dictionary/")
          ? ok({
              word: "serendipity",
              found: true,
              dictionary: { parts: [{ part: "noun", senses: [{ text: "A happy accident." }] }] },
            })
          : ok({ query: "serendipity", results: [], truncated: false }),
      ),
    );
    const { launch, field } = renderSpotlight();
    await user.type(field, "serendipity");
    const definition = await screen.findByRole("group", { name: "Definition" });
    const option = within(definition).getByRole("option");
    expect(option).toHaveTextContent("serendipity — A happy accident.");
    expect(option).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Enter}");
    expect(launch).toHaveBeenCalledWith("dictionary");
  });

  it("works out a sum first and opens Calculator with the result", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { launch, field } = renderSpotlight();
    await user.type(field, "12*12");
    const option = screen.getByRole("option", { name: "= 144" });
    expect(option).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Enter}");
    expect(writeText).toHaveBeenCalledWith("144");
    expect(launch).toHaveBeenCalledWith("calculator");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("converts units as they are typed", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn());
    const { field } = renderSpotlight();
    await user.type(field, "212 f to c");
    expect(screen.getByRole("option", { name: "= 100 °C" })).toBeVisible();
    expect(screen.getByText("212 °F = 100 °C")).toBeVisible();
  });

  it("shows a file in Finder with Command held, whatever opens it", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    const picture = { ...FILE, id: "f-beach", title: "Beach.png" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.startsWith("/api/dictionary/")
          ? missing
          : ok({
              query: decodeURIComponent(url.split("q=")[1] ?? ""),
              results: [picture],
              truncated: false,
            }),
      ),
    );
    const { launch, field } = renderSpotlight();
    await user.type(field, "beach");
    await screen.findByRole("option", { name: "Beach.png" });
    await user.keyboard("{Meta>}{Enter}{/Meta}");
    expect(launch).toHaveBeenCalledWith("finder");
    expect(takeOpenFileRequests("finder")).toEqual([
      { app: "finder", id: "f-beach", name: "Beach.png" },
    ]);
  });

  it("asks the application that keeps a contact to show it", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.startsWith("/api/dictionary/")
          ? missing
          : ok({
              query: decodeURIComponent(url.split("q=")[1] ?? ""),
              results: [ADA],
              truncated: false,
            }),
      ),
    );
    const { launch, field } = renderSpotlight();
    await user.type(field, "zzada");
    await screen.findByRole("option", { name: "Ada Lovelace" });
    await user.keyboard("{Enter}");
    expect(launch).toHaveBeenCalledWith("contacts");
    expect(takeOpenItemRequests("contacts")).toEqual([
      { app: "contacts", id: "card-ada", title: "Ada Lovelace" },
    ]);
  });

  it("goes back to the first result when the query changes", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.startsWith("/api/dictionary/")
          ? missing
          : ok({
              query: decodeURIComponent(url.split("q=")[1] ?? ""),
              results: [ADA, STICKY],
              truncated: false,
            }),
      ),
    );
    const { field } = renderSpotlight();
    await user.type(field, "zzcal");
    await screen.findByRole("option", { name: "Call Ada" });
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: "Call Ada" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.type(field, "l");
    expect(await screen.findByRole("option", { name: "Ada Lovelace" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("says what it did not look at", () => {
    const all = { searchedMail: 2, unsearchedMail: false, unsearchedFiles: 0, indexing: false };
    expect(searchNote(all)).toBeUndefined();
    expect(searchNote({ ...all, unsearchedFiles: 3 })).toBe(
      "Files: the words of 3 text files were not searched, only the names.",
    );
    expect(searchNote({ ...all, indexing: true })).toBe("Files: still reading your text files.");
  });

  it("opens a web search in Safari, which takes it as a new tab", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    const fetch = vi.fn(async (url: string) => {
      if (url.startsWith("/api/dictionary/")) return missing;
      return ok({ query: "moon landing", results: [], truncated: false });
    });
    vi.stubGlobal("fetch", fetch);
    const { onClose, field } = renderSpotlight();
    await user.type(field, "moon landing");
    expect(
      screen.getByRole("option", { name: "Search the Web for “moon landing”" }),
    ).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Enter}");
    expect(onClose).toHaveBeenCalled();
    expect(takeOpenUrlRequests()).toEqual([
      { url: expect.stringContaining("search=moon+landing"), from: "spotlight" },
    ]);
    expect(fetch.mock.calls.some(([url]) => url.startsWith("/api/safari/"))).toBe(false);
  });

  it("keeps an application first when its name matches too", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.startsWith("/api/dictionary/")
          ? missing
          : ok({ query: "sti", results: [STICKY], truncated: false }),
      ),
    );
    const { launch, field } = renderSpotlight();
    await user.type(field, "sti");
    await screen.findByRole("group", { name: "Stickies" });
    expect(screen.getByRole("option", { name: "Stickies" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.keyboard("{Enter}");
    expect(launch).toHaveBeenCalledWith("stickies");
  });

  it("shows no reply that answers another text than the one typed", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ok({ query: "something else", results: [ADA], truncated: false })),
    );
    const { field } = renderSpotlight();
    await user.type(field, "ada");
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.queryByRole("option", { name: "Ada Lovelace" })).toBeNull();
  });

  it("asks the server for a sum too, and not for a query longer than it takes", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    const fetch = vi.fn(async (url: string) =>
      ok(
        url.startsWith("/api/spotlight/search")
          ? { query: decodeURIComponent(url.split("q=")[1] ?? ""), results: [], truncated: false }
          : {},
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const { field } = renderSpotlight();
    const searched = () =>
      fetch.mock.calls
        .map(([url]) => String(url))
        .filter((url) => url.includes("spotlight/search"));
    // A phone number reads as a sum, and may still be a contact's.
    await user.type(field, "555-1234");
    await waitFor(() => expect(searched()).toHaveLength(1));
    await user.clear(field);
    await user.type(field, "one two three four five six seven eight nine");
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(searched().some((url) => url.includes("nine"))).toBe(false);
  });

  it("asks nothing when the page is not served by the application", async () => {
    const user = userEvent.setup();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { field } = renderSpotlight();
    await user.type(field, "con");
    expect(screen.getByRole("option", { name: "Contacts" })).toBeVisible();
    expect(screen.queryByRole("group", { name: "Search the Web" })).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(fetch).not.toHaveBeenCalled();
  });
});

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  beginDesktopValues,
  changeDesktopValue,
  forgetDesktopValues,
} from "../desktop/desktop-personal";
import { HelpViewer } from "./help-viewer";
import { searchGuides } from "./help-viewer-guides";
import { historyToKeep, mergeHistory, readExpandedRows, readHistory } from "./help-viewer-kept";
import { booksFromServer, placeReadable, resultsFromServer } from "./help-viewer-server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const TOPIC = {
  id: "desktop-textedit",
  title: "Keep documents in TextEdit",
  summary: "TextEdit saves the document in its window as you type.",
  body: ["Nothing is written to the disk of your computer."],
  source: "Macalicious Desktop Help",
};
const BOOKS = {
  books: [
    {
      id: "desktop-help",
      title: "Macalicious Desktop Help",
      summary: "How the apps keep your work.",
      topics: [TOPIC],
    },
  ],
};

/** A server with the book, a search that finds TOPIC for any text, and a stored place. */
function serve(place: unknown = { page: null, rev: 0 }) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "PUT")
      return { ok: true, json: async () => JSON.parse(String(init.body)) };
    if (url.startsWith("/api/help-viewer/search")) {
      const query = new URLSearchParams(url.split("?")[1]).get("q");
      return { ok: true, json: async () => ({ query, results: [TOPIC] }) };
    }
    if (url === "/api/help-viewer/books") return { ok: true, json: async () => BOOKS };
    return { ok: true, json: async () => place };
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const saves = (fetch: ReturnType<typeof serve>) =>
  fetch.mock.calls
    .filter(([, init]) => init?.method === "PUT")
    .map(([url, init]) => ({ url, body: JSON.parse(String(init?.body)) }));

const body = () => document.querySelector(".mac-help-viewer-body") as HTMLElement;
const contents = () => screen.getByRole("treegrid", { name: "Table of Contents" });

describe("Help Viewer on the desktop's Ferrite application", () => {
  it("reads the module's books, results and place, prefixing the server's ids", () => {
    const [book] = booksFromServer(BOOKS);
    expect(book?.id).toBe("server:desktop-help");
    expect(book?.topics?.map((topic) => topic.id)).toEqual(["server:desktop-textedit"]);
    expect(booksFromServer({ books: [{ id: 1 }] })).toEqual([]);
    expect(resultsFromServer({ query: "Text", results: [TOPIC, { id: 2 }] }, "Text")).toHaveLength(
      1,
    );
    expect(resultsFromServer({ query: "Tex", results: [TOPIC] }, "Text")).toBeUndefined();
    expect(placeReadable({ page: null })).toBe(true);
    expect(placeReadable({ page: "server:desktop-textedit" })).toBe(true);
    expect(placeReadable({ page: 3 })).toBe(false);
  });

  it("asks no server when the page is not served by the application", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<HelpViewer />);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("adds the server's book to the contents and lists its results first", async () => {
    const user = userEvent.setup();
    const fetch = serve();
    render(<HelpViewer />);
    await waitFor(() => expect(body()).not.toHaveAttribute("inert"));
    await within(contents()).findByText("Macalicious Desktop Help");

    await user.type(screen.getByRole("searchbox"), "File");
    const results = await screen.findByRole("link", { name: /Keep documents in TextEdit/ });
    const links = screen.getAllByRole("link").filter((link) => link.closest("li"));
    expect(links[0]).toBe(results);
    // The captured 558, the server's topic, and the desktop's books' topics that name File.
    expect(screen.getByRole("status")).toHaveTextContent(
      `(${558 + 1 + searchGuides("File").length} results)`,
    );
    expect(fetch.mock.calls.some(([url]) => url === "/api/help-viewer/search?q=File")).toBe(true);

    await user.click(results);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Keep documents in TextEdit" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(saves(fetch).at(-1)?.body.page).toBe("server:desktop-textedit"));
  });

  it("opens on the page the session last read, inert until the server's books are known", async () => {
    const fetch = serve({ page: "server:desktop-textedit", rev: 4 });
    const answered = fetch.getMockImplementation() as NonNullable<
      ReturnType<typeof fetch.getMockImplementation>
    >;
    let answerBooks: () => void = () => {};
    fetch.mockImplementation((url: string, init?: RequestInit) =>
      url === "/api/help-viewer/books"
        ? new Promise((resolve) => {
            answerBooks = () => resolve(answered(url, init));
          })
        : answered(url, init),
    );
    render(<HelpViewer />);
    await waitFor(() => expect(fetch.mock.calls.length).toBeGreaterThanOrEqual(2));
    await new Promise((resolve) => setTimeout(resolve, 20));
    // The place has answered, the books not yet: the window still takes no input.
    expect(body()).toHaveAttribute("inert");
    answerBooks();
    expect(
      await screen.findByRole("heading", { level: 1, name: "Keep documents in TextEdit" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(body()).not.toHaveAttribute("inert"));
    // The contents open the restored topic's book.
    expect(within(contents()).getByText("Keep documents in TextEdit")).toBeInTheDocument();
    // Back returns to the welcome page.
    expect(screen.getByRole("button", { name: "Back" })).toBeEnabled();
  });

  it("saves nothing over a stored place it cannot read", async () => {
    const user = userEvent.setup();
    const fetch = serve({ page: 7, rev: 1 });
    render(<HelpViewer />);
    await waitFor(() => expect(body()).not.toHaveAttribute("inert"));
    await user.click(within(contents()).getByText("Basics"));
    expect(screen.getByRole("heading", { level: 1, name: "Basics" })).toBeInTheDocument();
    expect(saves(fetch)).toEqual([]);
  });

  it("goes to a book from the switcher and limits results to one book", async () => {
    const user = userEvent.setup();
    serve();
    render(<HelpViewer />);
    await waitFor(() => expect(body()).not.toHaveAttribute("inert"));

    const book = await screen.findByRole("combobox", { name: "Book" });
    expect(book).toHaveTextContent("macOS User Guide");
    await user.click(book);
    await user.click(await screen.findByRole("option", { name: "Macalicious Desktop Help" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Macalicious Desktop Help" }),
    ).toBeInTheDocument();
    expect(within(contents()).getByText("Keep documents in TextEdit")).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox"), "File");
    await screen.findByRole("link", { name: /Keep documents in TextEdit/ });
    await user.click(screen.getByRole("combobox", { name: "Show results from" }));
    await user.click(await screen.findByRole("option", { name: "Macalicious Desktop Help" }));
    expect(screen.getByRole("status")).toHaveTextContent("(1 result)");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Macalicious Desktop Help");
  });

  it("shows no switcher or filter when the page is not served", async () => {
    const user = userEvent.setup();
    render(<HelpViewer />);
    await user.type(screen.getByRole("searchbox"), "File");
    await screen.findByRole("status");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("opens with the kept history and rows, and Back walks that history", async () => {
    const user = userEvent.setup();
    forgetDesktopValues();
    beginDesktopValues();
    changeDesktopValue("helpViewer.expanded", ["server:desktop-help"]);
    changeDesktopValue("helpViewer.history", {
      entries: [
        { kind: "page", id: "welcome" },
        { kind: "page", id: "server:desktop-help" },
        { kind: "page", id: "server:desktop-textedit" },
      ],
      index: 2,
    });
    serve({ page: "server:desktop-textedit", rev: 2 });
    render(<HelpViewer />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Keep documents in TextEdit" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(body()).not.toHaveAttribute("inert"));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Macalicious Desktop Help" }),
    ).toBeInTheDocument();
    forgetDesktopValues();
    beginDesktopValues();
  });

  it("opens on the welcome page the server names, with the kept history behind it", async () => {
    const user = userEvent.setup();
    forgetDesktopValues();
    beginDesktopValues();
    changeDesktopValue("helpViewer.history", {
      entries: [
        { kind: "page", id: "welcome" },
        { kind: "page", id: "server:desktop-help" },
      ],
      index: 1,
    });
    const fetch = serve({ page: "welcome", rev: 2 });
    render(<HelpViewer />);
    await waitFor(() => expect(body()).not.toHaveAttribute("inert"));
    expect(screen.getByRole("heading", { level: 1, name: "macOS User Guide" })).toBeInTheDocument();
    expect(saves(fetch)).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Macalicious Desktop Help" }),
    ).toBeInTheDocument();
    forgetDesktopValues();
    beginDesktopValues();
  });

  it("reads a kept history only when all of it is readable, as one object for one value", () => {
    const stored = { entries: [{ kind: "page", id: "a" }], index: 0 };
    expect(readHistory(stored)).toEqual(stored);
    expect(readHistory(stored)).toBe(readHistory(stored));
    expect(readHistory({ entries: [{ kind: "page", id: "a" }], index: 1 })).toBeUndefined();
    expect(readHistory({ entries: [{ kind: "film" }], index: 0 })).toBeUndefined();
    expect(readHistory({ entries: [], index: 0 })).toBeUndefined();
    const rows = ["a", 3];
    expect(readExpandedRows(rows)).toEqual(["a"]);
    expect(readExpandedRows(rows)).toBe(readExpandedRows(rows));
  });

  it("adds a page read elsewhere after the kept history, and leaves it alone on the same page", () => {
    const kept = {
      entries: [{ kind: "page", id: "a" } as const, { kind: "search", query: "find" } as const],
      index: 1,
    };
    const welcome = { entries: [{ kind: "page", id: "welcome" } as const], index: 0 };
    expect(mergeHistory(kept, welcome)).toBe(kept);
    // The server named the welcome page before the kept history arrived.
    expect(mergeHistory(kept, welcome, true).entries.at(-1)).toEqual({
      kind: "page",
      id: "welcome",
    });
    const samePage = { entries: [{ kind: "page", id: "a" } as const], index: 0 };
    expect(mergeHistory(kept, samePage)).toBe(kept);
    const elsewhere = { entries: [{ kind: "page", id: "b" } as const], index: 0 };
    expect(mergeHistory(kept, elsewhere).entries.map((entry) => entry.kind)).toEqual([
      "page",
      "search",
      "page",
    ]);
  });

  it("keeps the recent part of a history too long for one value, and no entry too long alone", () => {
    const entries = Array.from({ length: 200 }, (_, at) => ({
      kind: "page" as const,
      id: `page-${at}`,
    }));
    const kept = historyToKeep({ entries, index: 199 });
    expect(kept?.entries.at(-1)).toEqual({ kind: "page", id: "page-199" });
    expect(kept?.entries.length).toBeLessThan(200);
    expect(kept?.index).toBe((kept?.entries.length ?? 0) - 1);
    expect(
      historyToKeep({ entries: [{ kind: "search", query: "x".repeat(5000) }], index: 0 }),
    ).toBeUndefined();
  });
});

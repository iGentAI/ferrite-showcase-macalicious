import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FontBook } from "./font-book";
import { libraryFromServer, libraryReadable } from "./font-book-server";

// These replies are the library's alone; the drive has its own tests in font-book-kept.test.tsx.
vi.mock("./font-book-drive", async (original) => ({
  ...(await original<typeof import("./font-book-drive")>()),
  driveAvailable: () => false,
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const URL = "/api/font-book/library";

function serve(reply: unknown) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === "PUT"
      ? { ok: true, json: async () => JSON.parse(String(init.body)) }
      : { ok: true, json: async () => reply },
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const saves = (fetch: ReturnType<typeof serve>) =>
  fetch.mock.calls
    .filter(([, init]) => init?.method === "PUT")
    .map(([url, init]) => ({ url, body: JSON.parse(String(init?.body)) }));

const body = () => document.querySelector(".mac-font-book-body") as HTMLElement;
const button = (name: string) => screen.getByRole("button", { name });
const collections = () =>
  within(screen.getByRole("tree", { name: "Collections" }))
    .getAllByRole("treeitem")
    .map((item) => item.textContent);
const fontRow = (name: string) =>
  within(screen.getByRole("treegrid", { name: "Fonts" }))
    .getAllByRole("row")
    .find((row) => row.textContent?.endsWith(name)) as HTMLElement;

describe("Font Book on the desktop's Ferrite application", () => {
  it("reads only a library in the module's shape", () => {
    expect(libraryReadable({ collections: null, disabled: null })).toBe(true);
    expect(libraryReadable({ collections: [], disabled: ["zapfino"] })).toBe(true);
    expect(libraryReadable({ collections: "x", disabled: [] })).toBe(false);
    expect(libraryReadable({ collections: [], disabled: [3] })).toBe(false);
    expect(libraryReadable({ rev: 2 })).toBe(false);
    expect(libraryFromServer({ collections: null, disabled: null })).toBeUndefined();
    // One collection in another shape makes the whole library unreadable, so none is dropped.
    const mixed = {
      collections: [{ id: "c", name: "Mine", families: ["zapfino"] }, { id: 4 }],
      disabled: ["verdana"],
    };
    expect(libraryReadable(mixed)).toBe(false);
    expect(libraryFromServer(mixed)).toBeUndefined();
    expect(
      libraryFromServer({
        collections: [{ id: "c", name: "Mine", families: ["zapfino"] }],
        disabled: ["verdana"],
      }),
    ).toEqual({
      collections: [{ id: "c", name: "Mine", icon: "collection", families: ["zapfino"] }],
      disabled: ["verdana"],
    });
  });

  it("asks no server when the page is not served by the application", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<FontBook />);
    expect(fetch).not.toHaveBeenCalled();
    expect(body()).not.toHaveAttribute("inert");
  });

  it("keeps its controls inert until the library has loaded", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    let answer: (value: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise((resolve) => (answer = resolve))),
    );
    render(<FontBook />);
    expect(body()).toHaveAttribute("inert");
    expect(body()).toHaveAttribute("aria-busy", "true");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    answer({
      ok: true,
      json: async () => ({ collections: [{ id: "c1", name: "Mine", families: [] }], disabled: [] }),
    });
    await waitFor(() => expect(body()).not.toHaveAttribute("inert"));
    expect(collections()).toContain("Mine");
  });

  it("shows the session's collections and turned-off fonts, and saves each change", async () => {
    const user = userEvent.setup();
    const fetch = serve({
      collections: [{ id: "collection-1", name: "Mine", families: [] }],
      disabled: ["verdana"],
    });
    render(<FontBook />);
    await waitFor(() => expect(body()).not.toHaveAttribute("inert"));
    expect(collections()).toContain("Mine");
    expect(saves(fetch)).toEqual([]);

    await user.click(screen.getByRole("treeitem", { name: "Web" }));
    await user.click(fontRow("Verdana"));
    expect(fontRow("Verdana")).toHaveTextContent("Off");
    expect(button("Enable “Verdana”")).toBeInTheDocument();

    await user.click(button("Add Collection"));
    await waitFor(() => {
      const last = saves(fetch).at(-1);
      expect(last?.url).toBe(URL);
      expect(last?.body.collections.map((c: { name: string }) => c.name)).toEqual([
        "Mine",
        "New Collection",
      ]);
    });
    // The new collection takes an id the loaded one does not have.
    const ids = saves(fetch)
      .at(-1)
      ?.body.collections.map((c: { id: string }) => c.id);
    expect(new Set(ids).size).toBe(2);

    await user.click(screen.getByRole("treeitem", { name: "Web" }));
    await user.click(fontRow("Verdana"));
    await user.click(button("Enable “Verdana”"));
    await waitFor(() => expect(saves(fetch).at(-1)?.body.disabled).toEqual([]));
  });

  it("saves nothing over a stored library it cannot read", async () => {
    for (const reply of [
      { collections: "Mine", disabled: [] },
      { collections: [{ id: "c", name: "Mine", families: [] }, { id: 4 }], disabled: [] },
      { rev: 3 },
    ]) {
      const user = userEvent.setup();
      const fetch = serve(reply);
      const { unmount } = render(<FontBook />);
      await waitFor(() => expect(body()).not.toHaveAttribute("inert"));
      await user.click(button("Add Collection"));
      await screen.findByRole("textbox", { name: "Collection name" });
      await user.keyboard("{Enter}");
      expect(collections()).toContain("New Collection");
      expect(saves(fetch)).toEqual([]);
      unmount();
    }
  });
});

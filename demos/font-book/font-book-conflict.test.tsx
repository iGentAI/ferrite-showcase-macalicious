import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { serverDocument } from "../desktop/desktop-server";
import { FontBook } from "./font-book";
import { FONT_BOOK_LIBRARY_URL } from "./font-book-server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/*
 * A Font Book window left open in one browser while the person changes their library in
 * another. The fake keeps the library as `ferrite-apps/desktop/src/apps/document.rs` does: a save
 * is stored only on the stored revision, and any other is answered 409 with the current library.
 * Revisions start high, since the page's one channel to the library outlives each test.
 */
interface Library {
  collections: { id: string; name: string; families: string[] }[] | null;
  disabled: string[] | null;
}
let revision = 1_000;

function serve(library: Library) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  revision += 100;
  const kept = { library, rev: revision };
  const reply = (status: number, body: unknown) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.split("?")[0] !== FONT_BOOK_LIBRARY_URL) return reply(404, { error: "not found" });
    if (init?.method !== "PUT") return reply(200, { ...kept.library, rev: kept.rev });
    const { rev, session: _session, ...sent } = JSON.parse(String(init.body));
    if (rev !== kept.rev) return reply(409, { ...kept.library, rev: kept.rev, error: "changed" });
    kept.library = sent;
    kept.rev += 1;
    return reply(200, { ...kept.library, rev: kept.rev });
  });
  vi.stubGlobal("fetch", fetch);
  /** What another browser does: the library it saves, or forgets, under the next revision. */
  const elsewhere = (next: Library) => {
    kept.library = next;
    kept.rev += 1;
  };
  return { kept, elsewhere };
}

const body = () => document.querySelector(".mac-font-book-body") as HTMLElement;
const collections = () =>
  within(screen.getByRole("tree", { name: "Collections" }))
    .getAllByRole("treeitem")
    .map((item) => item.textContent);
const MINE = { id: "collection-1", name: "Mine", families: [] };

async function addCollection() {
  await waitFor(() => expect(body()).not.toHaveAttribute("inert"));
  await userEvent.setup().click(screen.getByRole("button", { name: "Add Collection" }));
  await act(() => serverDocument(FONT_BOOK_LIBRARY_URL).idle());
}

describe("a Font Book window left open while the library changes in another browser", () => {
  it("never brings back a library forgotten in the other browser", async () => {
    const { kept, elsewhere } = serve({ collections: [MINE], disabled: ["verdana"] });
    const view = render(<FontBook />);
    await waitFor(() => expect(collections()).toContain("Mine"));

    elsewhere({ collections: null, disabled: null });
    await addCollection();

    expect(kept.library).toEqual({ collections: null, disabled: null });
    // The window shows the forgotten library: none of the person's collections.
    await waitFor(() => expect(collections()).not.toContain("Mine"));
    expect(collections()).not.toContain("New Collection");
    view.unmount();
  });

  it("keeps a font turned off in the other browser beside the collection added here", async () => {
    const { kept, elsewhere } = serve({ collections: [MINE], disabled: ["verdana"] });
    const view = render(<FontBook />);
    await waitFor(() => expect(collections()).toContain("Mine"));

    elsewhere({ collections: [MINE], disabled: ["verdana", "zapfino"] });
    await addCollection();

    expect(kept.library.disabled).toEqual(["verdana", "zapfino"]);
    expect(kept.library.collections?.map((collection) => collection.name)).toEqual([
      "Mine",
      "New Collection",
    ]);
    view.unmount();
  });
});

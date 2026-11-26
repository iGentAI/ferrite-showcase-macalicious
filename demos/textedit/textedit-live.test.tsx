import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/*
 * Each test evaluates TextEdit afresh, and the first evaluation transforms all of it, which on a busy
 * machine outlasts a test's limit. A test that runs out of time keeps going with no cleanup after it,
 * and renders its window into the next test.
 */
vi.setConfig({ testTimeout: 30_000 });
beforeAll(async () => {
  await import("./textedit");
}, 120_000);

/**
 * TextEdit and the page's document channels, read fresh: the channels are kept for the page
 * (`serverDocument`), so a test that shared them would start from another test's revision.
 */
async function fresh() {
  vi.resetModules();
  const { TextEdit } = await import("./textedit");
  const { reloadServerDocuments, setDesktopSession } = await import("../desktop/desktop-server");
  return { TextEdit, reloadServerDocuments, setDesktopSession };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** The person's drive, empty: what `/api/files/` answers a fresh desktop. */
const DRIVE = {
  rev: 1,
  entries: ["Desktop", "Documents"].map((name) => ({
    id: name.toLowerCase(),
    name,
    kind: "folder",
    size: 0,
    created_ms: 1,
    modified_ms: 1,
  })),
  usage: 0,
  quota: 1_000_000,
  piece_bytes: 1 << 20,
  max_file_bytes: 1 << 24,
  max_entries: 100,
};

const LETTER = {
  name: "Letter",
  format: "rich",
  lines: ["Dear Ada,", "Yours"],
  html: "<div><b>Dear Ada,</b></div><div>Yours</div>",
  edited: true,
};

const editor = () => screen.getByRole("textbox", { name: "Document" });
const body = () => document.querySelector(".mac-textedit-body") as HTMLElement;
const textNode = (wanted: string) => {
  const walker = document.createTreeWalker(editor(), NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeValue?.includes(wanted)) return node as Text;
  }
  throw new Error(`no ${wanted} in the document`);
};

describe("a change made to the document in another window or browser", () => {
  it("is shown in the open window, which keeps the keyboard and the caret", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const { TextEdit, reloadServerDocuments } = await fresh();
    let stored: unknown = { draft: LETTER, rev: 3 };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) =>
        init?.method === "PUT"
          ? { ok: true, json: async () => JSON.parse(String(init.body)) }
          : {
              ok: true,
              json: async () =>
                String(url).startsWith("/api/files/")
                  ? { ...DRIVE, session: `s-${Math.random()}` }
                  : stored,
            },
      ),
    );
    render(<TextEdit />);
    await waitFor(() => expect(body()).not.toHaveAttribute("inert"));
    expect(editor().textContent).toContain("Yours");
    // The insertion point after "Yo", the document focused.
    act(() => {
      editor().focus();
      const range = document.createRange();
      range.setStart(textNode("Yours"), 2);
      range.collapse(true);
      document.getSelection()?.removeAllRanges();
      document.getSelection()?.addRange(range);
    });

    // Another window adds a line before the caret's: the open window shows it, and the caret
    // stays after "Yo".
    stored = {
      draft: {
        ...LETTER,
        lines: ["Dear Ada,", "Thank you.", "Yours"],
        html: "<div><b>Dear Ada,</b></div><div>Thank you.</div><div>Yours</div>",
      },
      rev: 4,
    };
    act(() => reloadServerDocuments("textedit"));
    await waitFor(() => expect(editor().textContent).toContain("Thank you."));
    expect(editor()).toHaveFocus();
    const range = document.getSelection()?.getRangeAt(0);
    expect(range?.startContainer.nodeValue).toBe("Yours");
    expect(range?.startOffset).toBe(2);
  });

  it("keeps a change still being saved here, merged with another window's change", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const { TextEdit, reloadServerDocuments } = await fresh();
    // The application's rule: a save names the revision it was made on (`rev`); on any other it
    // is refused with 409 and the stored copy, which the page merges its change onto.
    let stored: { doc: { draft: typeof LETTER & { name: string } }; rev: number } = {
      doc: { draft: LETTER },
      rev: 3,
    };
    const json = (body: unknown, status = 200) => ({
      ok: status < 400,
      status,
      headers: new Headers(),
      json: async () => body,
      text: async () => JSON.stringify(body),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (String(url).startsWith("/api/files/")) {
          return json({ ...DRIVE, session: "s-1" });
        }
        if (init?.method === "PUT") {
          const { rev, session: _session, ...doc } = JSON.parse(String(init.body));
          if (rev !== stored.rev)
            return json({ ...stored.doc, rev: stored.rev, error: "changed" }, 409);
          stored = { doc, rev: stored.rev + 1 };
          return json({ rev: stored.rev });
        }
        return json({ ...stored.doc, rev: stored.rev });
      }),
    );
    render(<TextEdit />);
    await waitFor(() => expect(body()).not.toHaveAttribute("inert"));
    // The draft the window saves once it has loaded settles first.
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
    const settled = stored.rev;
    // Another window renames the document while this one types into it, before its save is in.
    stored = {
      doc: { draft: { ...stored.doc.draft, name: "Letter to Ada" } },
      rev: settled + 1,
    };
    act(() => {
      editor().focus();
      textNode("Yours").nodeValue = "Yours truly";
      fireEvent.input(editor());
      const range = document.createRange();
      range.setStart(textNode("Yours truly"), 11);
      range.collapse(true);
      document.getSelection()?.removeAllRanges();
      document.getSelection()?.addRange(range);
    });
    act(() => reloadServerDocuments("textedit"));
    // Both changes are kept: the merge is stored on a newer revision, and the window, once it has
    // adopted the merge, saves nothing that undoes either. The channel sends the merge after its
    // short wait following a refusal.
    await waitFor(
      () => {
        expect(stored.rev).toBeGreaterThanOrEqual(settled + 2);
        expect(stored.doc.draft.name).toBe("Letter to Ada");
        expect(stored.doc.draft.html).toContain("Yours truly");
      },
      { timeout: 5000 },
    );
    await waitFor(
      () => expect(screen.getByRole("region", { name: /^Letter to Ada/ })).toBeInTheDocument(),
      { timeout: 5000 },
    );
    expect(editor().textContent).toContain("Yours truly");
    expect(editor()).toHaveFocus();
    const range = document.getSelection()?.getRangeAt(0);
    expect(range?.startContainer.nodeValue).toBe("Yours truly");
    expect(range?.startOffset).toBe(11);
  }, 15_000);
  it("keeps the version saved first of a document two windows changed at once, and offers this one's back", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const { TextEdit, reloadServerDocuments, setDesktopSession } = await fresh();
    setDesktopSession("session-a");
    let stored: { doc: { draft: typeof LETTER & { name: string } }; rev: number } = {
      doc: { draft: LETTER },
      rev: 3,
    };
    const json = (body: unknown, status = 200) => ({
      ok: status < 400,
      status,
      headers: new Headers(),
      json: async () => body,
      text: async () => JSON.stringify(body),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (String(url).startsWith("/api/files/")) return json({ ...DRIVE, session: "s-1" });
        if (init?.method === "PUT") {
          const { rev, session: _session, ...doc } = JSON.parse(String(init.body));
          if (rev !== stored.rev)
            return json({ ...stored.doc, rev: stored.rev, error: "changed" }, 409);
          stored = { doc, rev: stored.rev + 1 };
          return json({ rev: stored.rev });
        }
        return json({ ...stored.doc, rev: stored.rev });
      }),
    );
    const view = render(<TextEdit />);
    await waitFor(() => expect(body()).not.toHaveAttribute("inert"));
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
    // Another window changes the same text while this one types into it, before its save is in.
    const theirs = JSON.parse(JSON.stringify(stored.doc.draft).replaceAll("Yours", "Theirs"));
    stored = { doc: { draft: theirs }, rev: stored.rev + 1 };
    act(() => {
      editor().focus();
      textNode("Yours").nodeValue = "Yours truly";
      fireEvent.input(editor());
    });
    act(() => reloadServerDocuments("textedit"));
    // The version saved first stays, in the store and the window, and the window says so.
    const notice = await screen.findByRole("note", {}, { timeout: 5000 });
    expect(notice).toHaveTextContent("Changed in another window");
    await waitFor(() => expect(editor().textContent).toContain("Theirs"), { timeout: 5000 });
    expect(JSON.stringify(stored.doc.draft)).toContain("Theirs");
    expect(JSON.stringify(stored.doc.draft)).not.toContain("Yours truly");
    // Someone else signing in on this browser neither sees that version nor removes it.
    act(() => setDesktopSession("session-b"));
    await waitFor(() => expect(screen.queryByRole("note")).toBeNull());
    view.unmount();
    const other = render(<TextEdit />);
    await waitFor(() => expect(body()).not.toHaveAttribute("inert"));
    expect(screen.queryByRole("note")).toBeNull();
    other.unmount();
    // Back in the first session, reloaded before choosing: the window asks again.
    setDesktopSession("session-a");
    render(<TextEdit />);
    await screen.findByRole("note", {}, { timeout: 5000 });
    await waitFor(() => expect(body()).not.toHaveAttribute("inert"));
    // Keep Mine stores this window's version over it.
    fireEvent.click(screen.getByRole("button", { name: "Keep Mine" }));
    await waitFor(() => expect(JSON.stringify(stored.doc.draft)).toContain("Yours truly"), {
      timeout: 5000,
    });
    expect(screen.queryByRole("note")).toBeNull();
    await waitFor(
      () => expect(Object.keys(localStorage).filter((key) => key.includes("conflict"))).toEqual([]),
      { timeout: 5000 },
    );
  }, 15_000);
  /** A window on `stored`, with another window changing its text as this one types into it. */
  async function losing() {
    const { TextEdit, reloadServerDocuments, setDesktopSession } = await fresh();
    const server = {
      stored: { doc: { draft: LETTER } as object, rev: 3 },
      refuseSaves: false,
      afterSave: undefined as (() => void) | undefined,
    };
    const json = (body: unknown, status = 200) => ({
      ok: status < 400,
      status,
      headers: new Headers(),
      json: async () => body,
      text: async () => JSON.stringify(body),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (String(url).startsWith("/api/files/")) return json({ ...DRIVE, session: "s-1" });
        if (init?.method === "PUT") {
          if (server.refuseSaves) return json({ error: "down" }, 500);
          const { rev, session: _session, ...doc } = JSON.parse(String(init.body));
          if (rev !== server.stored.rev)
            return json({ ...server.stored.doc, rev: server.stored.rev, error: "changed" }, 409);
          server.stored = { doc, rev: server.stored.rev + 1 };
          const stored = server.stored;
          server.afterSave?.();
          return json({ rev: stored.rev });
        }
        return json({ ...server.stored.doc, rev: server.stored.rev });
      }),
    );
    const lose = async (word: string, typed: string) => {
      const draft = (server.stored.doc as { draft: object }).draft;
      const text = editor().textContent ?? "";
      const held = text.split(" ")[0] ?? "";
      const theirs = JSON.parse(JSON.stringify(draft).replaceAll(held, word));
      server.stored = { doc: { draft: theirs }, rev: server.stored.rev + 1 };
      act(() => {
        editor().focus();
        textNode(held).nodeValue = `${held} ${typed}`;
        fireEvent.input(editor());
      });
      act(() => reloadServerDocuments("textedit"));
      await waitFor(() => expect(editor().textContent).toContain(word), { timeout: 5000 });
    };
    return { TextEdit, server, lose, setDesktopSession, reloadServerDocuments };
  }
  const conflictKeys = () => Object.keys(localStorage).filter((key) => key.includes("conflict"));
  it("keeps each version that lost in a record of its own, and settles one at a time", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    localStorage.clear();
    const { TextEdit, server, lose } = await losing();
    const view = render(<TextEdit />);
    await waitFor(() => expect(body()).not.toHaveAttribute("inert"));
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
    await lose("Theirs", "first");
    await screen.findByRole("note", {}, { timeout: 5000 });
    await lose("Others", "second");
    await waitFor(() => expect(conflictKeys()).toHaveLength(2), { timeout: 5000 });
    view.unmount();
    render(<TextEdit />);
    await screen.findByRole("note", {}, { timeout: 5000 });
    await waitFor(() => expect(body()).not.toHaveAttribute("inert"));
    fireEvent.click(screen.getByRole("button", { name: "Keep Mine" }));
    await waitFor(() => expect(JSON.stringify(server.stored.doc)).toContain("first"), {
      timeout: 5000,
    });
    await waitFor(() => expect(conflictKeys()).toHaveLength(1), { timeout: 5000 });
    expect(await screen.findByRole("note")).toHaveTextContent("Changed in another window");
    fireEvent.click(screen.getByRole("button", { name: "Keep Mine" }));
    await waitFor(() => expect(JSON.stringify(server.stored.doc)).toContain("second"), {
      timeout: 5000,
    });
    await waitFor(() => expect(conflictKeys()).toEqual([]), { timeout: 5000 });
    expect(screen.queryByRole("note")).toBeNull();
  }, 20_000);
  it("keeps a version's record until Keep Mine's save is stored", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    localStorage.clear();
    const { TextEdit, server, lose } = await losing();
    const view = render(<TextEdit />);
    await waitFor(() => expect(body()).not.toHaveAttribute("inert"));
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
    await lose("Theirs", "restored");
    await screen.findByRole("note", {}, { timeout: 5000 });
    await lose("Others", "waiting");
    await waitFor(() => expect(conflictKeys()).toHaveLength(2), { timeout: 5000 });
    server.refuseSaves = true;
    fireEvent.click(screen.getByRole("button", { name: "Keep Mine" }));
    await waitFor(() => expect(editor().textContent).toContain("restored"));
    // The next version waits: choosing it now could replace one the store never held.
    expect(screen.queryByRole("button", { name: "Keep Mine" })).toBeNull();
    await act(() => new Promise((resolve) => setTimeout(resolve, 1500)));
    expect(JSON.stringify(server.stored.doc)).not.toContain("restored");
    expect(conflictKeys()).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Keep Mine" })).toBeNull();
    view.unmount();
    server.refuseSaves = false;
    render(<TextEdit />);
    await screen.findByRole("note", {}, { timeout: 5000 });
    await waitFor(() => expect(body()).not.toHaveAttribute("inert"));
    fireEvent.click(screen.getByRole("button", { name: "Keep Mine" }));
    await waitFor(() => expect(JSON.stringify(server.stored.doc)).toContain("restored"), {
      timeout: 5000,
    });
    await waitFor(() => expect(conflictKeys()).toHaveLength(1), { timeout: 5000 });
    fireEvent.click(await screen.findByRole("button", { name: "Keep Mine" }));
    await waitFor(() => expect(JSON.stringify(server.stored.doc)).toContain("waiting"), {
      timeout: 5000,
    });
    await waitFor(() => expect(conflictKeys()).toEqual([]), { timeout: 5000 });
  }, 20_000);
  it("offers a version again when another browser's text takes the window while it is put back", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    localStorage.clear();
    const { TextEdit, server, lose, reloadServerDocuments } = await losing();
    render(<TextEdit />);
    await waitFor(() => expect(body()).not.toHaveAttribute("inert"));
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
    await lose("Theirs", "restored");
    await screen.findByRole("note", {}, { timeout: 5000 });
    // Another browser saves straight after the version put back is stored, before the window has
    // read that it is, and its text takes the window.
    server.afterSave = () => {
      server.afterSave = undefined;
      const draft = (server.stored.doc as { draft: object }).draft;
      server.stored = {
        doc: { draft: JSON.parse(JSON.stringify(draft).replaceAll("restored", "Others")) },
        rev: server.stored.rev + 1,
      };
    };
    fireEvent.click(screen.getByRole("button", { name: "Keep Mine" }));
    act(() => reloadServerDocuments("textedit"));
    await waitFor(() => expect(editor().textContent).toContain("Others"), { timeout: 5000 });
    expect(editor().textContent).not.toContain("restored");
    // The only copy of that version stays, and is offered.
    expect(conflictKeys()).toHaveLength(1);
    expect(await screen.findByRole("button", { name: "Keep Mine" })).toBeInTheDocument();
    await act(() => new Promise((resolve) => setTimeout(resolve, 500)));
    expect(conflictKeys()).toHaveLength(1);
  }, 20_000);
  it("holds a version the browser refused until its own save is stored", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    localStorage.clear();
    const { TextEdit, server, lose, setDesktopSession } = await losing();
    setDesktopSession("session-a");
    const setItem = Storage.prototype.setItem;
    const refuse = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key.includes("conflict")) throw new DOMException("full", "QuotaExceededError");
      setItem.call(this, key, value);
    });
    render(<TextEdit />);
    await waitFor(() => expect(body()).not.toHaveAttribute("inert"));
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
    await lose("Theirs", "unkept");
    await screen.findByRole("note", {}, { timeout: 5000 });
    await lose("Others", "waiting");
    server.refuseSaves = true;
    fireEvent.click(screen.getByRole("button", { name: "Keep Mine" }));
    await waitFor(() => expect(editor().textContent).toContain("unkept"));
    await act(() => new Promise((resolve) => setTimeout(resolve, 1500)));
    expect(screen.queryByRole("button", { name: "Keep Mine" })).toBeNull();
    // Its save never stored, so a change of session and back offers it again.
    act(() => setDesktopSession("session-b"));
    await waitFor(() => expect(screen.queryByRole("note")).toBeNull());
    act(() => setDesktopSession("session-a"));
    await screen.findByRole("note", {}, { timeout: 5000 });
    server.refuseSaves = false;
    fireEvent.click(screen.getByRole("button", { name: "Keep Mine" }));
    await waitFor(() => expect(JSON.stringify(server.stored.doc)).toContain("unkept"), {
      timeout: 5000,
    });
    fireEvent.click(await screen.findByRole("button", { name: "Keep Mine" }, { timeout: 5000 }));
    await waitFor(() => expect(JSON.stringify(server.stored.doc)).toContain("waiting"), {
      timeout: 5000,
    });
    refuse.mockRestore();
  }, 20_000);
  it("says so when the browser's storage refuses the version, and still offers it", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    localStorage.clear();
    const { TextEdit, server, lose, setDesktopSession } = await losing();
    setDesktopSession("session-a");
    const setItem = Storage.prototype.setItem;
    const refuse = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key.includes("conflict")) throw new DOMException("full", "QuotaExceededError");
      setItem.call(this, key, value);
    });
    render(<TextEdit />);
    await waitFor(() => expect(body()).not.toHaveAttribute("inert"));
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
    await lose("Theirs", "unkept");
    const notice = await screen.findByRole("note", {}, { timeout: 5000 });
    expect(notice).toHaveTextContent("Yours is lost on reload");
    expect(conflictKeys()).toEqual([]);
    // Another session never sees the version only this window holds; its own session gets it back.
    act(() => setDesktopSession("session-b"));
    await waitFor(() => expect(screen.queryByRole("note")).toBeNull());
    act(() => setDesktopSession("session-a"));
    await screen.findByRole("note", {}, { timeout: 5000 });
    fireEvent.click(screen.getByRole("button", { name: "Keep Mine" }));
    await waitFor(() => expect(JSON.stringify(server.stored.doc)).toContain("unkept"), {
      timeout: 5000,
    });
    refuse.mockRestore();
  }, 15_000);
});

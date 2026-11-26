import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SavedStickies, SavedStickiesNote } from "./stickies-sync";

const sticky = (id: string, text: string): SavedStickiesNote => ({ id, color: "yellow", text });

describe("a change made in another window or browser", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const text = () => screen.getByRole("textbox");
  const textNode = (wanted: string) => {
    const walker = document.createTreeWalker(text(), NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeValue?.includes(wanted)) return node as Text;
    }
    throw new Error(`no ${wanted} in the note`);
  };
  /** The insertion point `offset` characters into `word`, the note focused. */
  const caretAt = (word: string, offset: number) => {
    const node = textNode(word);
    act(() => {
      text().focus();
      const range = document.createRange();
      range.setStart(node, (node.nodeValue ?? "").indexOf(word) + offset);
      range.collapse(true);
      document.getSelection()?.removeAllRanges();
      document.getSelection()?.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    });
  };
  /** Where the insertion point is, in characters into `word`; `null` when it is not in it. */
  const caretIn = (word: string) => {
    const range = document.getSelection()?.getRangeAt(0);
    const value = range?.startContainer.nodeValue ?? "";
    return value.includes(word) && range ? range.startOffset - value.indexOf(word) : null;
  };

  it("reaches the open note, which keeps the keyboard, the caret and a change still being typed", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    let server: { data: SavedStickies; rev: number } = {
      data: { notes: [sticky("one", "Groceries\nmilk and bread")] },
      rev: 1,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "PUT") {
          const body = JSON.parse(String(init.body));
          if (body.base !== server.rev) {
            return new Response(JSON.stringify({ rev: server.rev }), { status: 409 });
          }
          server = { data: body.data, rev: server.rev + 1 };
          return new Response(JSON.stringify({ rev: server.rev }), { status: 200 });
        }
        return new Response(JSON.stringify(server), { status: 200 });
      }),
    );
    const { StickiesDesktopNote } = await import("./stickies");
    const { reloadServerDocuments } = await import("../desktop/desktop-server");
    render(<StickiesDesktopNote />);
    await waitFor(() => expect(text().textContent).toContain("milk and bread"));
    caretAt("milk and bread", 4);

    // Another browser adds a line to the note: shown, with the keyboard and the caret kept.
    server = { data: { notes: [sticky("one", "Groceries\nmilk and bread\neggs")] }, rev: 2 };
    act(() => reloadServerDocuments("stickies"));
    await waitFor(() => expect(text().textContent).toContain("eggs"));
    expect(text()).toHaveFocus();
    expect(caretIn("milk and bread")).toBe(4);

    // Typed here, not saved yet, when another browser adds a note: both are kept, and the merge
    // is saved on the newer revision.
    act(() => {
      const node = textNode("milk and bread");
      node.nodeValue = (node.nodeValue ?? "").replace("milk and bread", "milk and rye bread");
      fireEvent.input(text());
    });
    caretAt("milk and rye bread", 12);
    server = {
      data: {
        notes: [sticky("one", "Groceries\nmilk and bread\neggs"), sticky("two", "Call Ada")],
      },
      rev: 3,
    };
    act(() => reloadServerDocuments("stickies"));
    await waitFor(() => expect(server.rev).toBe(4), { timeout: 3000 });
    expect(server.data.notes.map((each) => [each.id, each.text])).toEqual([
      ["one", "Groceries\nmilk and rye bread\neggs"],
      ["two", "Call Ada"],
    ]);
    expect(text().textContent).toContain("milk and rye bread");
    expect(text()).toHaveFocus();
    expect(caretIn("milk and rye bread")).toBe(12);
  });

  it("shows the version saved first of a note two windows changed at once, and offers this one's back", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    let server: { data: SavedStickies; rev: number } = {
      data: { notes: [sticky("one", "Groceries\nmilk and bread")] },
      rev: 1,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "PUT") {
          const body = JSON.parse(String(init.body));
          if (body.base !== server.rev) {
            return new Response(JSON.stringify({ rev: server.rev }), { status: 409 });
          }
          server = { data: body.data, rev: server.rev + 1 };
          return new Response(JSON.stringify({ rev: server.rev }), { status: 200 });
        }
        return new Response(JSON.stringify(server), { status: 200 });
      }),
    );
    const user = userEvent.setup();
    const { StickiesDesktopNote } = await import("./stickies");
    const { reloadServerDocuments } = await import("../desktop/desktop-server");
    render(<StickiesDesktopNote />);
    await waitFor(() => expect(text().textContent).toContain("milk and bread"));

    // Typed here, not saved yet, while another browser changes the same note.
    caretAt("milk and bread", 14);
    act(() => {
      const node = textNode("milk and bread");
      node.nodeValue = (node.nodeValue ?? "").replace("milk and bread", "milk and rye bread");
      fireEvent.input(text());
    });
    server = { data: { notes: [sticky("one", "Groceries\nmilk and butter")] }, rev: 2 };
    act(() => reloadServerDocuments("stickies"));

    // The note shows the version saved first and says another window changed it.
    const notice = await screen.findByRole("note");
    expect(notice).toHaveTextContent("Changed in another window.");
    await waitFor(() => expect(text().textContent).toContain("milk and butter"));

    // Keep Mine saves this window's text over it, and the note shows it.
    await user.click(screen.getByRole("button", { name: "Keep Mine" }));
    await waitFor(() => expect(server.data.notes[0]?.text).toBe("Groceries\nmilk and rye bread"), {
      timeout: 3000,
    });
    await waitFor(() => expect(text().textContent).toContain("milk and rye bread"));
    expect(screen.queryByRole("note")).toBeNull();
  }, 15_000);
});

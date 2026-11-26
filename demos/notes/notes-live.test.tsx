import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FOLDER, type NotesNote } from "./notes-data";
import { mergeRecordsById } from "./notes-merge";
import { keepConflictCopy, mergeNotes, type NotesConflict, type SavedNotes } from "./notes-sync";

const note = (id: string, lines: string[], folder = DEFAULT_FOLDER): NotesNote => ({
  id,
  folder,
  lines,
  date: "9:00 AM",
  edited: "October 21, 2026 at 9:00 AM",
});
const notesOf = (...notes: NotesNote[]): SavedNotes => ({
  folders: [{ id: DEFAULT_FOLDER, name: "Notes" }],
  notes,
});

describe("mergeRecordsById", () => {
  const r = (id: string, v: number) => ({ id, v });
  it("takes each side's own changes, the page's when both changed, and lets a removal win", () => {
    const base = [r("a", 1), r("b", 1), r("c", 1), r("d", 1)];
    // Here: a changed, c removed, e added. There: b changed, d changed, a changed too.
    const mine = [r("e", 1), r("a", 2), r("b", 1), r("d", 1)];
    const theirs = [r("a", 3), r("b", 2), r("c", 1), r("d", 2)];
    expect(mergeRecordsById(base, mine, theirs, { mineFirst: true })).toEqual([
      r("e", 1),
      r("a", 2),
      r("b", 2),
      r("d", 2),
    ]);
    // The stored order, with the page's new records after it.
    expect(mergeRecordsById(base, mine, theirs).map((each) => each.id)).toEqual([
      "a",
      "b",
      "d",
      "e",
    ]);
    // Removed there while changed here: the removal wins.
    expect(mergeRecordsById([r("a", 1)], [r("a", 2)], [])).toEqual([]);
  });

  it("merges a record both sides changed by its groups of fields", () => {
    const base = [{ id: "n", text: "Milk", html: "<b>Milk</b>", color: "yellow" }];
    const mine = [
      { id: "n", text: "Milk and eggs", html: "<b>Milk</b> and eggs", color: "yellow" },
    ];
    const theirs = [{ id: "n", text: "Milk", html: "<b>Milk</b>", color: "blue" }];
    expect(mergeRecordsById(base, mine, theirs, { together: [["text", "html"]] })).toEqual([
      { id: "n", text: "Milk and eggs", html: "<b>Milk</b> and eggs", color: "blue" },
    ]);
  });
});

describe("mergeNotes", () => {
  it("keeps a note typed here and another browser's change to another note, whole", () => {
    const base = notesOf(note("p", ["Pancakes", "Two eggs"]), note("w", ["Waffles"]));
    const mine = notesOf(note("p", ["Pancakes", "Two eggs and milk"]), note("w", ["Waffles"]));
    const theirs = notesOf(note("p", ["Pancakes", "Two eggs"]), note("w", ["Waffles", "Butter"]));
    expect(mergeNotes(base, mine, theirs)).toEqual(
      notesOf(note("p", ["Pancakes", "Two eggs and milk"]), note("w", ["Waffles", "Butter"])),
    );
  });

  it("moves a note left in a folder removed elsewhere to the default folder", () => {
    const withTrips = (notes: NotesNote[]): SavedNotes => ({
      folders: [
        { id: DEFAULT_FOLDER, name: "Notes" },
        { id: "trips", name: "Trips" },
      ],
      notes,
    });
    const base = withTrips([]);
    const mine = withTrips([note("n", ["Packing"], "trips")]);
    const theirs = notesOf();
    expect(mergeNotes(base, mine, theirs)).toEqual(notesOf(note("n", ["Packing"])));
  });

  const withHtml = (id: string, lines: string[], html: string): NotesNote => ({
    ...note(id, lines),
    html,
  });
  /** The copy a conflict makes of this window's `html`, and the note's own html after Keep. */
  const conflictOf = (html: string) => {
    const base = notesOf(withHtml("p", ["Base"], "<div>Base</div>"));
    const mine = notesOf(withHtml("p", ["Mine"], html));
    const theirs = notesOf(withHtml("p", ["Theirs"], "<div>Theirs</div>"));
    const found: NotesConflict[] = [];
    const merged = mergeNotes(base, mine, theirs, (conflict) => found.push(conflict));
    const conflict = found[0];
    if (!conflict) throw new Error("no conflict");
    const kept = keepConflictCopy(merged.notes, conflict);
    return { copy: merged.notes[1]?.html, kept: kept[0]?.html };
  };

  it("keeps the version saved first in a note both changed, and this window's as a marked copy", () => {
    const base = notesOf(
      withHtml("p", ["Pancakes", "Two eggs"], "<div>Pancakes</div><div>Two eggs</div>"),
    );
    const mine = notesOf(
      withHtml(
        "p",
        ["Pancakes", "Two eggs and milk"],
        "<div>Pancakes</div><div>Two eggs and milk</div>",
      ),
    );
    const theirs = notesOf(
      withHtml("p", ["Pancakes", "Three eggs"], "<div>Pancakes</div><div>Three eggs</div>"),
    );
    const found: NotesConflict[] = [];
    const merged = mergeNotes(base, mine, theirs, (conflict) => found.push(conflict));
    expect(merged.notes.map((each) => each.id)).toEqual(["p", "p-conflict-1"]);
    expect(merged.notes[0]).toMatchObject({ lines: ["Pancakes", "Three eggs"] });
    expect(merged.notes[1]).toMatchObject({
      lines: ["Pancakes (conflicted copy)", "Two eggs and milk"],
      html: "<div>Pancakes (conflicted copy)</div><div>Two eggs and milk</div>",
    });
    expect(found).toEqual([{ noteId: "p", copyId: "p-conflict-1", title: "Pancakes" }]);
    // Keep My Version: the note takes this window's version, the copy the other's.
    const kept = keepConflictCopy(merged.notes, found[0] as NotesConflict);
    expect(kept[0]).toMatchObject({
      id: "p",
      lines: ["Pancakes", "Two eggs and milk"],
      html: "<div>Pancakes</div><div>Two eggs and milk</div>",
    });
    expect(kept[1]).toMatchObject({
      id: "p-conflict-1",
      lines: ["Pancakes (conflicted copy)", "Three eggs"],
      html: "<div>Pancakes (conflicted copy)</div><div>Three eggs</div>",
    });
  });

  it("marks the end of the title only, whatever formats and line breaks hold it", () => {
    // Inline formats in the title: the marker after them, unformatted; the same words in the
    // body are left alone, also when the mark is taken off again.
    const body = "<div>Body (conflicted copy) text</div>";
    expect(conflictOf(`<div><b>Hello</b> world</div>${body}`)).toEqual({
      copy: `<div><b>Hello</b> world (conflicted copy)</div>${body}`,
      kept: `<div><b>Hello</b> world</div>${body}`,
    });
    expect(conflictOf("<div><b>Bold title</b></div><div>x</div>").copy).toBe(
      "<div><b>Bold title</b> (conflicted copy)</div><div>x</div>",
    );
    // A line break ends the title.
    expect(conflictOf("<div>Title<br>Body</div>")).toEqual({
      copy: "<div>Title (conflicted copy)<br>Body</div>",
      kept: "<div>Title<br>Body</div>",
    });
    // A list's first item is the title.
    expect(conflictOf("<ul><li>Title</li><li>Body</li></ul>").copy).toBe(
      "<ul><li>Title (conflicted copy)</li><li>Body</li></ul>",
    );
    // A line break inside a formatted run: the run is split at the end of the title.
    expect(conflictOf("<b>Title<br>Body</b>")).toEqual({
      copy: "<b>Title</b> (conflicted copy)<b><br>Body</b>",
      kept: "<b>Title</b><b><br>Body</b>",
    });
    // Bare text before the first block.
    expect(conflictOf("Title<div>Body</div>").copy).toBe("Title (conflicted copy)<div>Body</div>");
  });
});

describe("a change made in another window or browser", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  /** The editor of the note shown (those of notes shown before stay, hidden). */
  const editor = () => {
    const shown = screen
      .getAllByRole("textbox", { name: "Note" })
      .find((each) => !each.closest("[hidden]"));
    if (!shown) throw new Error("no note shown");
    return shown;
  };
  /** The text node of the editor that holds `text`. */
  const textNode = (text: string) => {
    const walker = document.createTreeWalker(editor(), NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeValue?.includes(text)) return node as Text;
    }
    throw new Error(`no ${text} in the note`);
  };
  /** The insertion point at `offset` in the text node holding `text`, the note focused. */
  const caretAt = (text: string, offset: number) => {
    const node = textNode(text);
    act(() => {
      editor().focus();
      const range = document.createRange();
      range.setStart(node, offset);
      range.collapse(true);
      document.getSelection()?.removeAllRanges();
      document.getSelection()?.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    });
  };
  const caret = () => {
    const range = document.getSelection()?.getRangeAt(0);
    return { text: range?.startContainer.nodeValue, offset: range?.startOffset };
  };

  it("reaches the open window, which keeps its note, the keyboard, the caret and a change still being typed", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    let server = {
      data: notesOf(note("p", ["Pancakes", "Two eggs"]), note("w", ["Waffles", "Flour"])),
      rev: 1,
    };
    const puts: { base: number; data: SavedNotes }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "PUT") {
          const body = JSON.parse(String(init.body));
          puts.push(body);
          if (body.base !== server.rev) {
            return new Response(JSON.stringify({ rev: server.rev }), { status: 409 });
          }
          server = { data: body.data, rev: server.rev + 1 };
          return new Response(JSON.stringify({ rev: server.rev }), { status: 200 });
        }
        return new Response(JSON.stringify(server), { status: 200 });
      }),
    );
    const { Notes } = await import("./notes");
    const { reloadServerDocuments } = await import("../desktop/desktop-server");
    render(<Notes />);
    await waitFor(() => expect(editor().textContent).toContain("Two eggs"));
    caretAt("Two eggs", 3);

    // Another browser adds a line after the caret's: the window shows it, with the keyboard and
    // the caret where they were.
    server = {
      data: notesOf(note("p", ["Pancakes", "Two eggs", "Syrup"]), note("w", ["Waffles", "Flour"])),
      rev: 2,
    };
    act(() => reloadServerDocuments("notes"));
    await waitFor(() => expect(editor().textContent).toContain("Syrup"));
    expect(editor()).toHaveFocus();
    expect(caret()).toEqual({ text: "Two eggs", offset: 3 });

    // Typed here, not saved yet, when another browser changes the other note: both are kept,
    // and the merge is saved on the newer revision.
    act(() => {
      textNode("Two eggs").nodeValue = "Two eggs and milk";
      fireEvent.input(editor());
    });
    caretAt("Two eggs and milk", 17);
    server = {
      data: notesOf(
        note("p", ["Pancakes", "Two eggs", "Syrup"]),
        note("w", ["Waffles", "Flour", "Butter"]),
      ),
      rev: 3,
    };
    act(() => reloadServerDocuments("notes"));
    await waitFor(() => expect(server.rev).toBe(4), { timeout: 3000 });
    const saved = server.data.notes.map((each) => each.lines);
    expect(saved).toEqual([
      ["Pancakes", "Two eggs and milk", "Syrup"],
      ["Waffles", "Flour", "Butter"],
    ]);
    expect(puts.at(-1)?.base).toBe(3);
    expect(editor().textContent).toContain("Two eggs and milk");
    expect(editor()).toHaveFocus();
    expect(caret()).toEqual({ text: "Two eggs and milk", offset: 17 });
  });

  it("keeps both versions of a note two windows changed at once, and tells this window", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    let server = {
      data: notesOf(note("p", ["Pancakes", "Two eggs"])),
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
    const { Notes } = await import("./notes");
    const { reloadServerDocuments } = await import("../desktop/desktop-server");
    render(<Notes />);
    await waitFor(() => expect(editor().textContent).toContain("Two eggs"));

    // Typed here, not saved yet, while another browser changes the same line.
    caretAt("Two eggs", 8);
    act(() => {
      textNode("Two eggs").nodeValue = "Two eggs and milk";
      fireEvent.input(editor());
    });
    server = { data: notesOf(note("p", ["Pancakes", "Three eggs"])), rev: 2 };
    act(() => reloadServerDocuments("notes"));

    // The version saved first stays in the note; this window's is a copy, and the window says so.
    const notice = await screen.findByRole("note");
    expect(notice).toHaveTextContent("“Pancakes” was changed in another window");
    expect(editor().textContent).toContain("Three eggs");
    await waitFor(() => expect(server.rev).toBe(3), { timeout: 3000 });
    expect(server.data.notes.map((each) => each.lines)).toEqual([
      ["Pancakes", "Three eggs"],
      ["Pancakes (conflicted copy)", "Two eggs and milk"],
    ]);

    // Show My Version opens the copy.
    await user.click(screen.getByRole("button", { name: "Show My Version" }));
    await waitFor(() => expect(editor().textContent).toContain("Two eggs and milk"));

    // Keep My Version: the note takes this window's version, the copy keeps the other's.
    await user.click(screen.getByRole("button", { name: "Keep My Version" }));
    await waitFor(() => expect(server.rev).toBe(4), { timeout: 3000 });
    expect(server.data.notes.map((each) => [each.id, each.lines])).toEqual([
      ["p", ["Pancakes", "Two eggs and milk"]],
      ["p-conflict-1", ["Pancakes (conflicted copy)", "Three eggs"]],
    ]);
    expect(screen.queryByRole("note")).toBeNull();
  }, 15_000);
});

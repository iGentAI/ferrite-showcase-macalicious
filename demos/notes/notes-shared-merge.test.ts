import { describe, expect, it } from "vitest";
import type { NotesNote } from "./notes-data";
import { blocksOf, mergeLines, mergeSharedNote } from "./notes-shared-merge";

const note = (lines: string[], extra: Partial<NotesNote> = {}): NotesNote => ({
  id: "sh-0",
  folder: "shared-with-people",
  lines,
  date: "Today",
  edited: "Today",
  ...extra,
});

describe("mergeLines", () => {
  it("keeps changes to different lines from both sides", () => {
    expect(mergeLines(["a", "b", "c"], ["a", "B", "c"], ["a", "b", "C"])).toEqual(["a", "B", "C"]);
  });

  it("keeps both when both added at the same place, theirs first", () => {
    expect(mergeLines(["a"], ["a", "mine"], ["a", "theirs"])).toEqual(["a", "theirs", "mine"]);
  });

  it("takes a removal from one side", () => {
    expect(mergeLines(["a", "b", "c"], ["a", "c"], ["a", "b", "c", "d"])).toEqual(["a", "c", "d"]);
  });

  it("says when both changed one line differently", () => {
    expect(mergeLines(["a", "b"], ["a", "mine"], ["a", "theirs"])).toBeNull();
  });

  it("does not call the same change on both sides a conflict", () => {
    expect(mergeLines(["a"], ["b"], ["b"])).toEqual(["b"]);
  });
});

describe("blocksOf", () => {
  it("reads a plain note as a block per line", () => {
    expect(blocksOf({ lines: ["Title", "", "1 < 2"] })).toEqual([
      "<div>Title</div>",
      "<div><br></div>",
      "<div>1 &lt; 2</div>",
    ]);
  });

  it("puts text before the first block in a block of its own, as the editor writes a title", () => {
    expect(blocksOf({ lines: [], html: "Title<div><b>bold</b></div><ul><li>x</li></ul>" })).toEqual(
      ["<div>Title</div>", "<div><b>bold</b></div>", "<ul><li>x</li></ul>"],
    );
  });
});

describe("mergeSharedNote", () => {
  it("takes theirs whole when this page changed nothing of the text", () => {
    const base = note(["a"]);
    const theirs = note(["a", "b"], { edited: "Later" });
    expect(mergeSharedNote(base, base, theirs)).toEqual({ note: theirs, conflict: false });
  });

  it("merges two people's lines in a plain note", () => {
    const base = note(["Trip", "boots", "map"]);
    const mine = note(["Trip", "boots", "map", "rope"], { edited: "Mine" });
    const theirs = note(["Trip", "BOOTS", "map"], { edited: "Theirs" });
    const { note: merged, conflict } = mergeSharedNote(base, mine, theirs);
    expect(conflict).toBe(false);
    expect(merged.lines).toEqual(["Trip", "BOOTS", "map", "rope"]);
    expect(merged.html).toBeUndefined();
    expect(merged.edited).toBe("Mine");
  });

  it("merges by block when the note has formats", () => {
    const base = note(["T", "x"], { html: "<h2>T</h2><div>x</div>" });
    const mine = note(["T", "x", "new"], { html: "<h2>T</h2><div>x</div><div>new</div>" });
    const theirs = note(["T!", "x"], { html: "<h2>T!</h2><div>x</div>" });
    const { note: merged, conflict } = mergeSharedNote(base, mine, theirs);
    expect(conflict).toBe(false);
    expect(merged.html).toBe("<h2>T!</h2><div>x</div><div>new</div>");
    expect(merged.lines).toEqual(["T!", "x", "new"]);
  });

  it("keeps theirs and says so when both changed one line", () => {
    const base = note(["a"]);
    const theirs = note(["theirs"]);
    expect(mergeSharedNote(base, note(["mine"]), theirs)).toEqual({ note: theirs, conflict: true });
  });

  it("keeps a file each side added and drops one this side removed", () => {
    const file = (id: string) => ({ id, name: id, type: "text/plain", size: 1 });
    const base = note(["a"], { files: [file("old")] });
    const mine = note(["a", "m"], { files: [file("mine")] });
    const theirs = note(["a", "t"], { files: [file("old"), file("theirs")] });
    const { note: merged } = mergeSharedNote(base, mine, theirs);
    expect(merged.files?.map((each) => each.id)).toEqual(["theirs", "mine"]);
    expect(merged.lines).toEqual(["a", "t", "m"]);
  });
});

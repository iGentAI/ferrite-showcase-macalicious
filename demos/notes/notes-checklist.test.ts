import { beforeEach, describe, expect, it } from "vitest";
import { moveListItem, runChecklist, tableToText, toggleChecked } from "./notes-checklist";
import { noteContent, noteHtml, readLines } from "./notes-editor";
import { findRanges } from "./notes-find";

let editor: HTMLDivElement;
const items = () =>
  [...editor.querySelectorAll("li")].map(
    (item) => `${item.hasAttribute("data-checked") ? "x" : "o"} ${item.textContent}`,
  );

beforeEach(() => {
  editor = document.createElement("div");
  editor.innerHTML =
    '<div>List</div><ul class="mac-notes-checklist"><li>Milk</li><li data-checked="true">Eggs</li><li>Tea</li></ul>';
  document.body.replaceChildren(editor);
});

const at = (index: number) => editor.querySelectorAll("li")[index] as HTMLElement;

describe("a checklist", () => {
  it("ticks and unticks an item", () => {
    toggleChecked(editor, at(0));
    toggleChecked(editor, at(1));
    expect(items()).toEqual(["x Milk", "o Eggs", "o Tea"]);
  });

  it("runs the Format menu's commands on the list the insertion point is in", () => {
    expect(runChecklist(editor, at(0), "mark-checked")).toBe(true);
    expect(items()).toEqual(["x Milk", "x Eggs", "o Tea"]);
    expect(runChecklist(editor, at(0), "move-checked")).toBe(true);
    expect(items()).toEqual(["o Tea", "x Milk", "x Eggs"]);
    expect(runChecklist(editor, at(0), "check-all")).toBe(true);
    expect(items()).toEqual(["x Tea", "x Milk", "x Eggs"]);
    expect(runChecklist(editor, at(0), "uncheck-all")).toBe(true);
    expect(items()).toEqual(["o Tea", "o Milk", "o Eggs"]);
    runChecklist(editor, at(0), "check-all");
    expect(runChecklist(editor, at(0), "delete-checked")).toBe(true);
    expect(editor.querySelector("ul")).toBeNull();
  });

  it("does nothing outside a checklist", () => {
    expect(runChecklist(editor, editor.firstChild, "check-all")).toBe(false);
  });

  it("is saved with its ticks and opens with them", () => {
    const saved = noteHtml(editor);
    expect(saved).toContain('class="mac-notes-checklist"');
    expect(saved).toContain('data-checked="true"');
    const opened = document.createElement("div");
    opened.append(noteContent({ lines: ["List"], html: saved }, document));
    expect(opened.innerHTML).toBe(saved);
  });

  it("keeps nothing else a saved document claims", () => {
    const opened = document.createElement("div");
    opened.append(
      noteContent(
        { lines: ["x"], html: '<ul class="evil"><li data-checked="maybe">x</li></ul>' },
        document,
      ),
    );
    expect(opened.innerHTML).toBe("<ul><li>x</li></ul>");
  });
});

describe("Move List Item", () => {
  it("moves an item up and down, and stops at the ends", () => {
    expect(moveListItem(editor, at(1), true)).toBe(true);
    expect(items()).toEqual(["x Eggs", "o Milk", "o Tea"]);
    expect(moveListItem(editor, at(0), true)).toBe(false);
    expect(moveListItem(editor, at(0), false)).toBe(true);
    expect(items()).toEqual(["o Milk", "x Eggs", "o Tea"]);
    expect(moveListItem(editor, editor.firstChild, false)).toBe(false);
  });
});

describe("Find", () => {
  beforeEach(() => {
    editor.innerHTML = "<div>foo</div><div>bar <b>foo</b>bar</div>";
  });

  it("does not run a match from one line into the next", () => {
    expect(findRanges(editor, "foobar").map((range) => range.toString())).toEqual(["foobar"]);
    expect(findRanges(editor, "foobar")[0]?.startContainer.parentElement?.tagName).toBe("B");
  });

  it("finds a selection over several lines", () => {
    const [range] = findRanges(editor, "foo\nbar");
    expect(range?.startContainer.nodeValue).toBe("foo");
    expect(range?.endContainer.nodeValue).toBe("bar ");
  });
});

describe("Convert to Text", () => {
  it("makes a table one line per row", () => {
    editor.innerHTML =
      '<table class="mac-notes-table"><tbody><tr><td>a</td><td>b</td></tr><tr><td>c</td><td><br></td></tr></tbody></table>';
    const first = tableToText(editor, editor.querySelector("td"), readLines);
    expect(first?.textContent).toBe("a\tb");
    expect([...editor.children].map((line) => line.textContent)).toEqual(["a\tb", "c\t"]);
    expect(tableToText(editor, editor.firstChild, readLines)).toBeNull();
  });

  it("keeps a cell's spaces and parts its lines", () => {
    editor.innerHTML =
      '<table class="mac-notes-table"><tbody><tr><td>   </td><td> </td></tr><tr><td> a <br>b</td><td>c</td></tr></tbody></table>';
    tableToText(editor, editor.querySelector("td"), readLines);
    expect([...editor.children].map((line) => line.textContent)).toEqual(["   \t ", " a  b\tc"]);
  });
});

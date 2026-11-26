import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Notes } from "./notes";
import { noteContent, noteHtml } from "./notes-editor";
import { changeTable, type NotesTableCommand, nextCell, tableCellAt } from "./notes-table";

/*
 * Notes' tables: the rows and columns of the table the insertion point is in, from Format > Table,
 * Option-Command and an arrow, and Tab between cells. The changes themselves are plain document
 * changes, so jsdom runs them; e2e/editors-tables-journey.mjs measures them in the three engines,
 * through the server, a reload, a second window and a restart.
 */

/** A Notes table of `rows`, each a list of its cells' texts, in a note editor. */
function tableOf(rows: string[][]) {
  const editor = document.createElement("div");
  editor.innerHTML = `<div>Title</div><table class="mac-notes-table"><tbody>${rows
    .map((row) => `<tr>${row.map((text) => `<td>${text}</td>`).join("")}</tr>`)
    .join("")}</tbody></table><div>After</div>`;
  return editor;
}

/** The texts of the table's cells, row by row (an empty cell reads as ""). */
const gridOf = (root: ParentNode) =>
  [...(root.querySelector("table")?.querySelectorAll("tr") ?? [])].map((row) =>
    [...row.querySelectorAll("td")].map((cell) => cell.textContent ?? ""),
  );

/** The cell whose text is `text`. */
function cellWith(root: ParentNode, text: string) {
  const cell = [...root.querySelectorAll("td")].find((each) => each.textContent === text);
  if (!cell) throw new Error(`no cell ${text}`);
  return cell;
}

describe("changeTable", () => {
  const grid = [
    ["A1", "B1"],
    ["A2", "B2"],
  ];
  const cases: [NotesTableCommand, string, string[][], [number, number]][] = [
    [
      "row-above",
      "B2",
      [
        ["A1", "B1"],
        ["", ""],
        ["A2", "B2"],
      ],
      [1, 1],
    ],
    [
      "row-below",
      "A1",
      [
        ["A1", "B1"],
        ["", ""],
        ["A2", "B2"],
      ],
      [1, 0],
    ],
    [
      "column-before",
      "B1",
      [
        ["A1", "", "B1"],
        ["A2", "", "B2"],
      ],
      [0, 1],
    ],
    [
      "column-after",
      "B2",
      [
        ["A1", "B1", ""],
        ["A2", "B2", ""],
      ],
      [1, 2],
    ],
    ["delete-row", "A1", [["A2", "B2"]], [0, 0]],
    ["delete-column", "B2", [["A1"], ["A2"]], [1, 0]],
  ];
  for (const [command, from, expected, [row, column]] of cases) {
    it(`${command} from ${from}: the table and where the insertion point goes`, () => {
      const editor = tableOf(grid);
      const caret = changeTable(cellWith(editor, from), command);
      expect(gridOf(editor)).toEqual(expected);
      const rows = editor.querySelectorAll("tr");
      expect(caret.node).toBe(rows[row]?.querySelectorAll("td")[column]);
    });
  }

  it("gives a new cell a line break, so that it has a line's height and takes the caret", () => {
    const editor = tableOf(grid);
    const caret = changeTable(cellWith(editor, "A1"), "row-below");
    expect((caret.node as HTMLElement).innerHTML).toBe("<br>");
  });

  it("takes the table out when its only row or its only column is deleted", () => {
    const one = tableOf([["A1", "B1"]]);
    const afterRow = changeTable(cellWith(one, "B1"), "delete-row");
    expect(one.querySelector("table")).toBeNull();
    expect(afterRow).toEqual({ node: one.lastChild, atEnd: false });
    const column = tableOf([["A1"], ["A2"]]);
    changeTable(cellWith(column, "A2"), "delete-column");
    expect(column.querySelector("table")).toBeNull();
    expect(column.textContent).toBe("TitleAfter");
  });

  it("finds the cell of a Notes table that holds a node, and nothing in other tables", () => {
    const editor = tableOf(grid);
    const text = cellWith(editor, "B2").firstChild as Node;
    expect(tableCellAt(editor, text)).toBe(cellWith(editor, "B2"));
    expect(tableCellAt(editor, editor.firstChild)).toBeNull();
    editor.querySelector("table")?.classList.remove("mac-notes-table");
    expect(tableCellAt(editor, text)).toBeNull();
  });
});

describe("nextCell", () => {
  it("goes across a row and on to the next, and back with Shift-Tab", () => {
    const editor = tableOf([
      ["A1", "B1"],
      ["A2", "B2"],
    ]);
    expect(nextCell(cellWith(editor, "B1"), false)?.node).toBe(cellWith(editor, "A2"));
    expect(nextCell(cellWith(editor, "A2"), true)?.node).toBe(cellWith(editor, "B1"));
    expect(nextCell(cellWith(editor, "A1"), true)).toBeNull();
  });

  it("adds a row after the last cell and goes to its first cell", () => {
    const editor = tableOf([["A1", "B1"]]);
    const to = nextCell(cellWith(editor, "B1"), false);
    expect(gridOf(editor)).toEqual([
      ["A1", "B1"],
      ["", ""],
    ]);
    expect(to?.node).toBe(editor.querySelectorAll("tr")[1]?.querySelector("td"));
  });
});

describe("Notes' tables in the window", () => {
  const setup = () => userEvent.setup({ pointerEventsCheck: 0 });
  const editor = () => screen.getByRole("textbox", { name: "Note" });
  const TABLE =
    '<div>Groceries</div><table class="mac-notes-table"><tbody><tr><td>A1</td><td>B1</td></tr><tr><td>A2</td><td>B2</td></tr></tbody></table>';

  /** Fill the note with `html` and put the insertion point at the end of the text `word`. */
  function caretAfter(html: string, word: string) {
    editor().innerHTML = html;
    const walker = document.createTreeWalker(editor(), NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.nodeValue?.includes(word)) continue;
      editor().focus();
      const range = document.createRange();
      range.setStart(node, (node.nodeValue ?? "").indexOf(word) + word.length);
      range.collapse(true);
      document.getSelection()?.removeAllRanges();
      document.getSelection()?.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
      return;
    }
    throw new Error(`no ${word} in the note`);
  }

  /** Choose `item` of the format button's Table submenu (opened with the arrow key). */
  async function chooseTable(user: ReturnType<typeof setup>, item: string) {
    await user.click(screen.getByRole("button", { name: "Format" }));
    const table = await screen.findByRole("menuitem", { name: "Table" });
    table.focus();
    await user.keyboard("{ArrowRight}");
    const entry = await screen.findByRole("menuitem", { name: new RegExp(`^${item}`) });
    expect(entry).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.click(entry);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  }

  it("adds and deletes rows and columns from Format > Table, the insertion point in the new cell", async () => {
    const user = setup();
    render(<Notes />);
    caretAfter(TABLE, "B2");
    await chooseTable(user, "Add Row Below");
    expect(gridOf(editor())).toEqual([
      ["A1", "B1"],
      ["A2", "B2"],
      ["", ""],
    ]);
    const anchor = document.getSelection()?.anchorNode as Node;
    expect(editor().querySelectorAll("tr")[2]?.querySelectorAll("td")[1]?.contains(anchor)).toBe(
      true,
    );
    await chooseTable(user, "Add Column Before");
    expect(gridOf(editor())).toEqual([
      ["A1", "", "B1"],
      ["A2", "", "B2"],
      ["", "", ""],
    ]);
    await chooseTable(user, "Delete Column");
    await chooseTable(user, "Delete Row");
    expect(gridOf(editor())).toEqual([
      ["A1", "B1"],
      ["A2", "B2"],
    ]);
  });

  it("adds rows and columns with Option-Command and an arrow, and goes between cells with Tab", () => {
    render(<Notes />);
    caretAfter(TABLE, "A1");
    expect(fireEvent.keyDown(editor(), { key: "ArrowRight", ctrlKey: true, altKey: true })).toBe(
      false,
    );
    expect(gridOf(editor())).toEqual([
      ["A1", "", "B1"],
      ["A2", "", "B2"],
    ]);
    fireEvent.keyDown(editor(), { key: "ArrowUp", ctrlKey: true, altKey: true });
    expect(gridOf(editor())[0]).toEqual(["", "", ""]);
    // Tab from the new row's cell goes on to the next cell, Shift-Tab back.
    const first = editor().querySelectorAll("tr")[0]?.querySelectorAll("td") ?? [];
    expect(fireEvent.keyDown(editor(), { key: "Tab" })).toBe(false);
    expect(first[2]?.contains(document.getSelection()?.anchorNode as Node)).toBe(true);
    fireEvent.keyDown(editor(), { key: "Tab", shiftKey: true });
    expect(first[1]?.contains(document.getSelection()?.anchorNode as Node)).toBe(true);
  });

  it("leaves Option-Command-arrow and Tab to the browser outside a table", () => {
    render(<Notes />);
    caretAfter(TABLE, "Groceries");
    expect(fireEvent.keyDown(editor(), { key: "ArrowDown", ctrlKey: true, altKey: true })).toBe(
      true,
    );
    expect(fireEvent.keyDown(editor(), { key: "Tab" })).toBe(true);
    expect(gridOf(editor())).toEqual([
      ["A1", "B1"],
      ["A2", "B2"],
    ]);
  });

  it("keeps a table, with its added rows and columns, in the saved formats", () => {
    const markup =
      '<table class="mac-notes-table"><tbody><tr><td>A1</td><td><br></td><td>B1</td></tr><tr><td><br></td><td><br></td><td>C3</td></tr></tbody></table>';
    const root = document.createElement("div");
    root.innerHTML = markup;
    expect(noteHtml(root)).toBe(markup);
    const holder = document.createElement("div");
    holder.append(noteContent({ lines: ["A1", "", "B1", "", "", "C3"], html: markup }, document));
    expect(gridOf(holder)).toEqual([
      ["A1", "", "B1"],
      ["", "", "C3"],
    ]);
  });
});

/*
 * Notes' tables: the rows and columns of the table the insertion point is in, changed in place,
 * as Catalina's Format > Table and Tab between cells do. A table is the `table.mac-notes-table`
 * Add Table makes, kept in the note's stored formats (`NOTES_HTML`), so a change here is saved,
 * reloaded and shown to another window like the rest of the note's text once the window reads
 * it. These functions only change the document and say where the insertion point goes; the window
 * reads the note afterwards. Format > Table's changes go through the browser's own editing
 * commands (`changeTableUndoably`), so Edit > Undo and Redo take them back and make them again.
 */

/** A command of Format > Table. */
export type NotesTableCommand =
  | "row-above"
  | "row-below"
  | "column-before"
  | "column-after"
  | "delete-row"
  | "delete-column";

/** Where the insertion point goes after a change: into `node`, at its start or at its end. */
export interface TableCaret {
  node: Node;
  atEnd: boolean;
}

/**
 * Notes' key equivalents for the four commands that add, with Option and Command (Control off
 * Apple platforms): an arrow adds a row above or below, or a column before or after.
 */
export const TABLE_KEY_COMMANDS: Readonly<Record<string, NotesTableCommand | undefined>> = {
  ArrowUp: "row-above",
  ArrowDown: "row-below",
  ArrowLeft: "column-before",
  ArrowRight: "column-after",
};

const isCell = (node: Node): node is HTMLTableCellElement =>
  node.nodeName === "TD" || node.nodeName === "TH";

/**
 * The cell of a Notes table that holds `node` inside `editor`, or `null` when `node` is outside
 * one (or in a table that is not a Notes table).
 */
export function tableCellAt(editor: HTMLElement, node: Node | null): HTMLTableCellElement | null {
  for (let at = node; at && at !== editor; at = at.parentNode) {
    if (isCell(at)) {
      const table = at.closest("table");
      return table?.classList.contains("mac-notes-table") && editor.contains(table) ? at : null;
    }
  }
  return null;
}

/** The cell of a Notes table that holds the insertion point in `editor`, or `null`. */
export function tableCellAtSelection(editor: HTMLElement): HTMLTableCellElement | null {
  const selection = editor.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  return tableCellAt(editor, selection.getRangeAt(0).startContainer);
}

/** A new, empty cell: a line break gives it the height of a line and a place for the caret. */
function emptyCell(document: Document): HTMLTableCellElement {
  const cell = document.createElement("td");
  cell.append(document.createElement("br"));
  return cell;
}

/** The cells of `row` (its own, not those of a table nested in one). */
const cellsOf = (row: HTMLTableRowElement) => [...row.children].filter(isCell);

/** The rows of `table`, in order, across its row groups (not those of a nested table). */
const rowsOf = (table: HTMLTableElement) =>
  [...table.querySelectorAll("tr")].filter((row) => row.closest("table") === table);

/**
 * Take `table` out of the note, as deleting its last row or column does, and say where the
 * insertion point goes: the start of the line after it, else the end of the line before it, else
 * a new empty line in its place.
 */
function removeTable(table: HTMLTableElement): TableCaret {
  const after = table.nextSibling;
  const before = table.previousSibling;
  if (after || before) {
    table.remove();
    return after ? { node: after, atEnd: false } : { node: before as Node, atEnd: true };
  }
  const line = table.ownerDocument.createElement("div");
  line.append(table.ownerDocument.createElement("br"));
  table.replaceWith(line);
  return { node: line, atEnd: false };
}

/**
 * Change the table that holds `cell` as `command` says, and say where the insertion point goes:
 * into the new row's or column's cell in the same column or row, or, after a deletion, into the
 * neighbouring cell. Deleting a table's only row or only column takes the table out.
 */
export function changeTable(cell: HTMLTableCellElement, command: NotesTableCommand): TableCaret {
  const document = cell.ownerDocument;
  const row = cell.parentElement as HTMLTableRowElement;
  const table = cell.closest("table") as HTMLTableElement;
  const rows = rowsOf(table);
  const rowIndex = rows.indexOf(row);
  const column = cellsOf(row).indexOf(cell);
  switch (command) {
    case "row-above":
    case "row-below": {
      const fresh = document.createElement("tr");
      for (let each = 0; each < cellsOf(row).length; each++) fresh.append(emptyCell(document));
      row.parentNode?.insertBefore(fresh, command === "row-above" ? row : row.nextSibling);
      return { node: cellsOf(fresh)[column] ?? fresh, atEnd: false };
    }
    case "column-before":
    case "column-after": {
      let caret: Node = cell;
      for (const each of rows) {
        const cells = cellsOf(each);
        const fresh = emptyCell(document);
        const at = command === "column-before" ? column : column + 1;
        each.insertBefore(fresh, cells[at] ?? null);
        if (each === row) caret = fresh;
      }
      return { node: caret, atEnd: false };
    }
    case "delete-row": {
      if (rows.length <= 1) return removeTable(table);
      const next = rows[rowIndex + 1] ?? rows[rowIndex - 1];
      row.remove();
      const cells = next ? cellsOf(next) : [];
      const to = cells[Math.min(column, cells.length - 1)];
      return to ? { node: to, atEnd: true } : removeTable(table);
    }
    case "delete-column": {
      for (const each of rows) {
        cellsOf(each)[column]?.remove();
        if (cellsOf(each).length === 0) each.remove();
      }
      const left = cellsOf(row);
      if (rowsOf(table).length === 0) return removeTable(table);
      const to =
        left[Math.min(column, left.length - 1)] ??
        cellsOf(rowsOf(table)[0] as HTMLTableRowElement)[0];
      return to ? { node: to, atEnd: true } : removeTable(table);
    }
  }
}

/**
 * Tab and Shift-Tab in a table: the next cell (the first of the next row after a row's last), or
 * the previous one. Tab in the table's last cell adds a row below, as in Notes, and goes to its
 * first cell; Shift-Tab in its first cell stays there (`null`). Given the note's `editor`, the new row is
 * one step of the browser's undo history (`changeTableUndoably`).
 */
export function nextCell(
  cell: HTMLTableCellElement,
  backwards: boolean,
  editor?: HTMLElement,
): TableCaret | null {
  const table = cell.closest("table") as HTMLTableElement;
  const cells = rowsOf(table).flatMap(cellsOf);
  const at = cells.indexOf(cell);
  const to = cells[backwards ? at - 1 : at + 1];
  if (to) return { node: to, atEnd: true };
  if (backwards) return null;
  // The row is added as Format > Table > Add Row Below adds it: in `editor`, one step of the undo history.
  const added = editor
    ? changeTableUndoably(editor, cell, "row-below")
    : changeTable(cell, "row-below");
  if (!added) return null;
  const holder = added.node instanceof Element ? added.node : added.node.parentElement;
  const row = holder?.closest("tr");
  return { node: (row && cellsOf(row)[0]) ?? added.node, atEnd: false };
}

/**
 * Put the insertion point into `caret.node`, at its start or its end, the note keeping focus. The
 * window's selection keeper follows `selectionchange`, which browsers report a task later; a menu
 * that has just closed gives the note its kept selection back sooner (in a microtask), which would
 * put the caret back in the cell of before the change. Reporting the change at once makes the new
 * place the one kept.
 */
export function placeTableCaret(caret: TableCaret) {
  const document = caret.node.ownerDocument;
  if (!document) return;
  const range = document.createRange();
  range.selectNodeContents(caret.node);
  range.collapse(!caret.atEnd);
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
}

/** A cell's place in its table: its row and its column. */
type CellPlace = [row: number, column: number];

/**
 * Where the insertion point was in a table before a change replaced it, and where it went in the
 * table that replaced it: Undo and Redo bring back those very tables, and the insertion point
 * goes back to its cell in them.
 */
const placeBefore = new WeakMap<HTMLTableElement, CellPlace>();
const placeAfter = new WeakMap<HTMLTableElement, CellPlace>();

/** The attribute that finds the table a change inserted; taken off at once. */
const INSERTED = "data-notes-table-change";

function placeOf(cell: HTMLTableCellElement): CellPlace {
  const row = cell.parentElement as HTMLTableRowElement;
  const table = cell.closest("table") as HTMLTableElement;
  return [rowsOf(table).indexOf(row), cellsOf(row).indexOf(cell)];
}

function cellAtPlace(table: HTMLTableElement, [row, column]: CellPlace) {
  const rows = rowsOf(table);
  const at = rows[Math.max(0, Math.min(row, rows.length - 1))];
  const cells = at ? cellsOf(at) : [];
  return cells[Math.max(0, Math.min(column, cells.length - 1))] ?? null;
}

/** Select `node` whole, so that the browser's next editing command replaces or deletes it. */
function selectWhole(node: Node) {
  const document = node.ownerDocument as Document;
  const range = document.createRange();
  range.selectNode(node);
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/**
 * Change the table that holds `cell` as `changeTable` does, as one step of the browser's undo
 * history, so that Edit > Undo and Command-Z put the table back as it was and Redo makes the change
 * again: the change is made on a copy of the table, which replaces it through the browser's own
 * `insertHTML` over the selected table; a change that takes the table out deletes it through
 * `delete`. Says where the insertion point goes, or `null` when the browser has put it (after a
 * table was taken out). A browser that refuses the command gets the change made in place, as
 * before, without an undo step.
 */
export function changeTableUndoably(
  editor: HTMLElement,
  cell: HTMLTableCellElement,
  command: NotesTableCommand,
): TableCaret | null {
  const document = editor.ownerDocument;
  // A document without the browser's editing commands (a test's): the change in place, as before.
  if (typeof document.execCommand !== "function") return changeTable(cell, command);
  const table = cell.closest("table") as HTMLTableElement;
  const before = placeOf(cell);
  const rows = rowsOf(table);
  const takesTableOut =
    (command === "delete-row" && rows.length <= 1) ||
    (command === "delete-column" && rows.every((row) => cellsOf(row).length <= 1));
  placeBefore.set(table, before);
  if (takesTableOut) {
    selectWhole(table);
    if (document.execCommand("delete") && !editor.contains(table)) return null;
    return editor.contains(table) ? changeTable(cell, command) : null;
  }
  const copy = table.cloneNode(true) as HTMLTableElement;
  const copied = cellAtPlace(copy, before);
  if (!copied) return changeTable(cell, command);
  const moved = changeTable(copied, command);
  const movedCell =
    moved.node instanceof Element
      ? moved.node.closest<HTMLTableCellElement>("td, th")
      : (moved.node.parentElement?.closest<HTMLTableCellElement>("td, th") ?? null);
  const after = movedCell && copy.contains(movedCell) ? placeOf(movedCell) : before;
  copy.setAttribute(INSERTED, "");
  selectWhole(table);
  const done = document.execCommand("insertHTML", false, copy.outerHTML);
  const inserted = editor.querySelector<HTMLTableElement>(`table[${INSERTED}]`);
  inserted?.removeAttribute(INSERTED);
  if (!done || !inserted) {
    // The browser refused (or dropped the table): the change in place, as before Undo covered it.
    if (inserted) inserted.remove();
    return editor.contains(table) ? changeTable(cell, command) : null;
  }
  placeAfter.set(inserted, after);
  const to = cellAtPlace(inserted, after);
  return to ? { node: to, atEnd: moved.atEnd } : null;
}

/**
 * After Undo or Redo in `editor`: when the insertion point is not in a table cell and the step
 * brought back a table a change replaced (Undo) or made (Redo), where it goes in that table: the
 * cell it had there. Only a table the step itself brought back is taken: the one the selection
 * holds (or, when the selection is not collapsed, a Notes table it covers: the browser selects what the step
 * brought back), or the one a collapsed insertion point sits right after or right before. An Undo or Redo
 * elsewhere in the note keeps the browser's selection (`null`), as does one inside a cell.
 */
export function tableCaretAfterHistory(editor: HTMLElement, redo: boolean): TableCaret | null {
  const selection = editor.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (range.collapsed && tableCellAt(editor, range.startContainer)) return null;
  const places = redo ? placeAfter : placeBefore;
  const known = [...editor.querySelectorAll<HTMLTableElement>("table.mac-notes-table")].filter(
    (each) => places.has(each),
  );
  const endOf = (each: HTMLTableElement) => {
    const parent = each.parentNode as Node;
    return range.comparePoint(parent, [...parent.childNodes].indexOf(each) + 1);
  };
  const startOf = (each: HTMLTableElement) => {
    const parent = each.parentNode as Node;
    return range.comparePoint(parent, [...parent.childNodes].indexOf(each));
  };
  // Firefox's Redo leaves the insertion point in the empty line beside the table it brought back.
  const inEmptyLineBeside = (each: HTMLTableElement) => {
    const at = range.startContainer;
    const line = at instanceof Element ? at : at.parentElement;
    return (
      line?.textContent === "" &&
      (each.previousElementSibling === line || each.nextElementSibling === line)
    );
  };
  const chosen =
    known.find((each) => range.intersectsNode(each)) ??
    (range.collapsed
      ? known.find((each) => endOf(each) === 0 || startOf(each) === 0 || inEmptyLineBeside(each))
      : [...editor.querySelectorAll<HTMLTableElement>("table.mac-notes-table")].find((each) =>
          range.intersectsNode(each),
        ));
  if (!chosen) return null;
  const to = cellAtPlace(chosen, places.get(chosen) ?? [0, 0]);
  return to ? { node: to, atEnd: true } : null;
}

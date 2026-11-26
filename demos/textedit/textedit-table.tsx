"use client";

import { DefaultButton } from "macalicious/default-button";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { SavePanelRow } from "macalicious/save-panel";
import { SheetActions, SheetDescription, SheetTitle } from "macalicious/sheet";
import { TextField } from "macalicious/text-field";
import { useId, useState } from "react";
import { HIGHLIGHTS } from "./textedit-data";
import { changeTableShape } from "./textedit-document";

/**
 * Format > Table…: tables in a rich text document. A table is the view's own `<table>`, so the browser
 * edits its cells; the functions here change its shape. Its cells hold paragraphs as the view does,
 * `paragraphsOf` reads them, and `textedit-rtf` carries a table through a file and a draft.
 */

export const MOST_TABLE_ROWS = 100;
export const MOST_TABLE_COLUMNS = 20;

const emptyCell = (target: Document) => {
  const cell = target.createElement("td");
  cell.append(target.createElement("div"));
  cell.firstElementChild?.append(target.createElement("br"));
  return cell;
};

/** The table the node is in, inside the view. */
export function tableAround(editor: HTMLElement, node: Node | null): HTMLTableElement | null {
  const element = node instanceof Element ? node : (node?.parentElement ?? null);
  const table = element?.closest("table") ?? null;
  return table && editor.contains(table) ? table : null;
}

const columnsOf = (table: HTMLTableElement) =>
  Math.max(1, ...tableCellGrid(table).map((row) => row.length));

/** What stands at each row and column of a table: a cell stands wherever it spans. */
export function tableCellGrid(table: HTMLTableElement): (HTMLTableCellElement | undefined)[][] {
  const rows = [...table.rows];
  const grid: (HTMLTableCellElement | undefined)[][] = rows.map(() => []);
  rows.forEach((row, rowAt) => {
    let column = 0;
    for (const cell of row.cells) {
      while (grid[rowAt]?.[column]) column += 1;
      const bottom = Math.min(rows.length, rowAt + cell.rowSpan);
      for (let down = rowAt; down < bottom; down += 1) {
        for (let across = 0; across < cell.colSpan; across += 1) {
          (grid[down] as (HTMLTableCellElement | undefined)[])[column + across] = cell;
        }
      }
      column += cell.colSpan;
    }
  });
  return grid;
}

/** How many tables `table` is inside. */
export function tableDepth(table: HTMLTableElement): number {
  let depth = 0;
  for (
    let at = table.parentElement?.closest("table");
    at;
    at = at.parentElement?.closest("table")
  ) {
    depth += 1;
  }
  return depth;
}

const newLine = (target: Document) => {
  const line = target.createElement("div");
  line.append(target.createElement("br"));
  return line;
};

/** A table of two rows and two columns in `cell`, after what it holds, with a line to go on in after it. */
export function nestTable(cell: HTMLTableCellElement): HTMLTableElement {
  const target = cell.ownerDocument;
  const table = target.createElement("table");
  table.dataset.border = "1";
  const body = table.appendChild(target.createElement("tbody"));
  for (let row = 0; row < 2; row += 1) {
    const line = body.appendChild(target.createElement("tr"));
    line.append(emptyCell(target), emptyCell(target));
  }
  if (!holdsSomething(cell)) cell.replaceChildren();
  cell.append(table, newLine(target));
  return table;
}

/** Takes a table out of the cell it is in, leaving what its cells held in that cell, in order. */
export function unnestTable(table: HTMLTableElement): void {
  const cell = table.parentElement?.closest("td");
  if (!cell) return;
  table.replaceWith(
    ...[...table.rows].flatMap((row) =>
      [...row.cells].flatMap((each) => (holdsSomething(each) ? [...each.childNodes] : [])),
    ),
  );
  if (!cell.firstChild) cell.append(newLine(cell.ownerDocument));
}

/** How many rows and columns a table has. */
export const tableSize = (table: HTMLTableElement) => ({
  rows: table.rows.length,
  columns: columnsOf(table),
});

/** A new table, with a line after it when it ends the document, so that text can follow it. */
export function insertTable(
  editor: HTMLElement,
  after: ChildNode | null,
  rows: number,
  columns: number,
): HTMLTableElement {
  const target = editor.ownerDocument;
  const table = target.createElement("table");
  table.dataset.border = "1";
  const body = table.appendChild(target.createElement("tbody"));
  for (let row = 0; row < rows; row += 1) {
    const line = body.appendChild(target.createElement("tr"));
    for (let column = 0; column < columns; column += 1) line.append(emptyCell(target));
  }
  editor.insertBefore(table, after ? after.nextSibling : editor.firstChild);
  if (!table.nextElementSibling) {
    const line = editor.appendChild(target.createElement("div"));
    line.append(target.createElement("br"));
  }
  return table;
}

/** The child of the view a new table goes after, by a range's end; none puts it first. */
export function childHoldingEnd(editor: HTMLElement, range: Range | null): ChildNode | null {
  if (!range || !editor.contains(range.endContainer)) return editor.lastChild;
  if (range.endContainer === editor) return editor.childNodes[range.endOffset - 1] ?? null;
  let at: Node | null = range.endContainer;
  while (at && at.parentNode !== editor) at = at.parentNode;
  return at as ChildNode | null;
}

/** Whether a cell or a row has anything in it that going would lose. */
const holdsSomething = (node: Element) =>
  node.textContent !== "" || node.querySelector("table, img") !== null;

const columnGroupOf = (table: HTMLTableElement) =>
  [...table.children].find((part) => part.tagName === "COLGROUP");

/** The columns `cells` stand in, counting across the merged cells before them. */
export function columnsOfCells(cells: readonly HTMLTableCellElement[]): number[] {
  const table = cells[0]?.closest("table");
  if (!table) return [];
  const columns = new Set<number>();
  for (const row of tableCellGrid(table)) {
    row.forEach((cell, at) => {
      if (cell && cells.includes(cell)) columns.add(at);
    });
  }
  return [...columns].sort((one, two) => one - two);
}

/** The width in points all these columns have, as the sheet shows it: empty when none, or they differ. */
export function widthOfColumns(table: HTMLTableElement, columns: readonly number[]): string {
  const widths = new Set(
    columns.map((at) => columnGroupOf(table)?.children[at]?.getAttribute("width") ?? ""),
  );
  return widths.size === 1 ? ([...widths][0] as string) : "";
}

/** Gives these columns a width in points, or takes it away to share what the others leave. */
export function setColumnWidth(
  table: HTMLTableElement,
  columns: readonly number[],
  points: number | null,
): void {
  const target = table.ownerDocument;
  const group =
    columnGroupOf(table) ?? table.insertBefore(target.createElement("colgroup"), table.firstChild);
  while (group.children.length < columnsOf(table)) group.append(target.createElement("col"));
  for (const at of columns) {
    if (points === null) group.children[at]?.removeAttribute("width");
    else group.children[at]?.setAttribute("width", String(points));
  }
  if (!group.querySelector("col[width]")) group.remove();
}

/** Whether making a table this size takes away cells with something in them. */
export function shapeLosesText(table: HTMLTableElement, rows: number, columns: number): boolean {
  const grid = tableCellGrid(table);
  return [...table.rows].some((row, at) => {
    if (at >= rows) return holdsSomething(row);
    return [...row.cells].some((cell) => {
      const first = grid[at]?.indexOf(cell) ?? 0;
      return first >= columns && holdsSomething(cell);
    });
  });
}

/** Makes a table this many rows and columns, adding empty cells or dropping them from the ends. */
export function reshapeTable(table: HTMLTableElement, rows: number, columns: number): void {
  const target = table.ownerDocument;
  const body =
    table.tBodies[table.tBodies.length - 1] ?? table.appendChild(target.createElement("tbody"));
  while (table.rows.length > rows) table.rows[table.rows.length - 1]?.remove();
  [...table.rows].forEach((row, at) => {
    for (const cell of row.cells) {
      if (at + cell.rowSpan <= rows) continue;
      if (rows - at > 1) cell.rowSpan = rows - at;
      else cell.removeAttribute("rowspan");
    }
  });
  while (table.rows.length < rows) body.append(target.createElement("tr"));
  const grid = tableCellGrid(table);
  [...table.rows].forEach((row, at) => {
    for (let width = grid[at]?.length ?? 0; width < columns; width += 1) {
      row.append(emptyCell(target));
    }
  });
  for (let column = columnsOf(table) - 1; column >= columns; column -= 1) {
    for (const cell of new Set(tableCellGrid(table).map((row) => row[column]))) {
      if (!cell) continue;
      if (cell.colSpan > 1) cell.colSpan -= 1;
      else cell.remove();
    }
  }
  const group = columnGroupOf(table);
  if (group) {
    while (group.children.length > columns) group.lastElementChild?.remove();
    while (group.children.length < columns) group.append(target.createElement("col"));
    if (!group.querySelector("col[width]")) group.remove();
  }
}

/**
 * The cell of `table` itself that `node` is in, past any table inside that cell.
 */
function ownCell(table: HTMLTableElement, node: Node): HTMLTableCellElement | null {
  let at = node instanceof Element ? node : node.parentElement;
  while (at) {
    const cell: HTMLTableCellElement | null = at.closest("td");
    if (!cell || !table.contains(cell)) return null;
    if (cell.closest("table") === table) return cell;
    at = cell.parentElement;
  }
  return null;
}

/**
 * The cells a range touches. From one cell of the table to another that is every cell in the
 * rectangle between them, as a Mac's table selection is, and a merged cell widens that rectangle to
 * hold it whole.
 */
export function cellsIn(table: HTMLTableElement, range: Range | null): HTMLTableCellElement[] {
  if (!range) return [];
  const from = ownCell(table, range.startContainer);
  const to = ownCell(table, range.endContainer);
  if (!from || !to) {
    return [...table.rows].flatMap((row) =>
      [...row.cells].filter((cell) => range.intersectsNode(cell)),
    );
  }
  const grid = tableCellGrid(table);
  const inBox = new Set([from, to]);
  for (let size = 0; size !== inBox.size; ) {
    size = inBox.size;
    const box = boxOf(grid, inBox);
    for (let rowAt = box.top; rowAt <= box.bottom; rowAt += 1) {
      for (let column = box.left; column <= box.right; column += 1) {
        const cell = grid[rowAt]?.[column];
        if (cell) inBox.add(cell);
      }
    }
  }
  return [...table.rows].flatMap((row) => [...row.cells].filter((cell) => inBox.has(cell)));
}

/** The rows and columns `cells` stand in, from the first to the last of each. */
function boxOf(
  grid: readonly (readonly (HTMLTableCellElement | undefined)[])[],
  cells: ReadonlySet<HTMLTableCellElement>,
) {
  const box = {
    top: Number.POSITIVE_INFINITY,
    bottom: -1,
    left: Number.POSITIVE_INFINITY,
    right: -1,
  };
  grid.forEach((row, rowAt) => {
    row.forEach((cell, column) => {
      if (!cell || !cells.has(cell)) return;
      box.top = Math.min(box.top, rowAt);
      box.bottom = Math.max(box.bottom, rowAt);
      box.left = Math.min(box.left, column);
      box.right = Math.max(box.right, column);
    });
  });
  return box;
}

/** Whether these cells can become one: two or more that fill a rectangle of one table. */
export function canMerge(cells: readonly HTMLTableCellElement[]): boolean {
  const table = cells[0]?.closest("table");
  if (!table || cells.length < 2) return false;
  if (cells.some((cell) => cell.closest("table") !== table)) return false;
  const grid = tableCellGrid(table);
  const chosen = new Set(cells);
  const box = boxOf(grid, chosen);
  for (let rowAt = box.top; rowAt <= box.bottom; rowAt += 1) {
    for (let column = box.left; column <= box.right; column += 1) {
      const cell = grid[rowAt]?.[column];
      if (!cell || !chosen.has(cell)) return false;
    }
  }
  return true;
}

/** Makes cells that fill a rectangle one, holding what they all held. */
export function mergeCells(cells: readonly HTMLTableCellElement[]): void {
  const table = cells[0]?.closest("table");
  const [first, ...rest] = cells;
  if (!table || !first || !canMerge(cells)) return;
  const box = boxOf(tableCellGrid(table), new Set(cells));
  for (const cell of rest) {
    if (holdsSomething(cell)) first.append(...cell.childNodes);
    cell.remove();
  }
  const across = box.right - box.left + 1;
  const down = box.bottom - box.top + 1;
  if (across > 1) first.colSpan = across;
  if (down > 1) first.rowSpan = down;
  // A row left with no cell of its own, because the merged cell covers it all, is no row at all.
  for (let at = table.rows.length - 1; at >= 0; at -= 1) {
    const row = table.rows[at] as HTMLTableRowElement;
    if (row.cells.length > 0) continue;
    for (const cell of new Set(tableCellGrid(table)[at])) {
      if (!cell) continue;
      if (cell.rowSpan > 2) cell.rowSpan -= 1;
      else cell.removeAttribute("rowspan");
    }
    row.remove();
  }
}

/** Makes a merged cell the cells it was, its content staying in the first. */
export function splitCell(cell: HTMLTableCellElement): void {
  const table = cell.closest("table");
  if (!table) return;
  const target = cell.ownerDocument;
  const grid = tableCellGrid(table);
  const box = boxOf(grid, new Set([cell]));
  const rows = [...table.rows];
  for (let rowAt = box.top; rowAt <= box.bottom; rowAt += 1) {
    const row = rows[rowAt] as HTMLTableRowElement;
    const ownAfter = grid[rowAt]
      ?.slice(box.right + 1)
      .find((other) => other && other.parentElement === row);
    for (let column = box.left; column <= box.right; column += 1) {
      if (rowAt === box.top && column === box.left) continue;
      row.insertBefore(emptyCell(target), ownAfter ?? null);
    }
  }
  cell.removeAttribute("colspan");
  cell.removeAttribute("rowspan");
}

/**
 * Tab and Shift-Tab inside a table: the caret goes to the next or the last cell, and Tab in the last
 * cell of all adds a row. Answers whether the key was for a table, and whether the table changed.
 */
export function moveBetweenCells(editor: HTMLElement, back: boolean): "moved" | "added" | null {
  const selection = editor.ownerDocument.getSelection();
  const table = tableAround(editor, selection?.focusNode ?? null);
  const target = editor.ownerDocument;
  const here = (
    selection?.focusNode instanceof Element
      ? selection.focusNode
      : selection?.focusNode?.parentElement
  )?.closest("td");
  if (!table || !here || !selection) return null;
  const cells = [...table.rows].flatMap((row) => [...row.cells]);
  const at = cells.indexOf(here as HTMLTableCellElement) + (back ? -1 : 1);
  let added = false;
  if (at >= cells.length) {
    const line = target.createElement("tr");
    for (let column = columnsOf(table); column > 0; column -= 1) line.append(emptyCell(target));
    changeTableShape(editor, table, () => table.rows[table.rows.length - 1]?.after(line));
    added = true;
  }
  const next = [...table.rows].flatMap((row) => [...row.cells])[Math.max(0, at)];
  if (next) selection.selectAllChildren(next);
  if (next && selection.anchorNode) selection.collapseToEnd();
  return added ? "added" : "moved";
}

/** The sheet's Cell Background when the selected cells' colours are not one it can name. */
export const KEEP_BACKGROUND = "keep";

/** What the sheet asks for. */
export interface TextEditTableChoice {
  rows: number;
  columns: number;
  border: number;
  /** A highlight's name for the selected cells' background; "none" for none; or `KEEP_BACKGROUND`. */
  background: string;
  /** The width of the columns of the selected cells in points; empty shares what the others leave. */
  width: string;
}

const BORDERS = [
  { value: "0", label: "None" },
  { value: "1", label: "1 pt" },
  { value: "2", label: "2 pt" },
  { value: "3", label: "3 pt" },
];

const whole = (text: string, most: number) =>
  /^\d+$/.test(text) && Number(text) >= 1 && Number(text) <= most;

/** The widest column the sheet sets, in points. */
export const MOST_COLUMN_WIDTH = 2000;

/** Whether the sheet takes this width: empty, or points between 1 and `MOST_COLUMN_WIDTH`. */
export const columnWidthFits = (width: string) => width === "" || whole(width, MOST_COLUMN_WIDTH);

/**
 * Whether the sheet takes these sizes. Only a field the person changed has to be within what the
 * sheet makes: a file or Tab may have taken a table past that, and its border can still change.
 */
export const tableSizeFits = (
  rows: string,
  columns: string,
  now: { rows: number; columns: number },
) =>
  (rows === String(now.rows) || whole(rows, MOST_TABLE_ROWS)) &&
  (columns === String(now.columns) || whole(columns, MOST_TABLE_COLUMNS));

/**
 * What the browser pasted or dropped, as a table from a file is once read (`htmlToContent`): header
 * and footer sections and header cells become plain ones, and the selection stays where it was.
 */
export function normalizeTables(editor: HTMLElement): void {
  const found = editor.querySelectorAll("thead, tfoot, th");
  if (found.length === 0) return;
  const selection = editor.ownerDocument.getSelection();
  const kept = selection?.rangeCount
    ? {
        anchor: selection.anchorNode,
        anchorOffset: selection.anchorOffset,
        focus: selection.focusNode,
        focusOffset: selection.focusOffset,
      }
    : null;
  const made = new Map<Node | null, Node>();
  for (const old of found) {
    const plain = editor.ownerDocument.createElement(old.tagName === "TH" ? "td" : "tbody");
    for (const { name, value } of old.attributes) plain.setAttribute(name, value);
    plain.append(...old.childNodes);
    old.replaceWith(plain);
    made.set(old, plain);
  }
  if (kept?.anchor && kept.focus) {
    selection?.setBaseAndExtent(
      made.get(kept.anchor) ?? kept.anchor,
      kept.anchorOffset,
      made.get(kept.focus) ?? kept.focus,
      kept.focusOffset,
    );
  }
}

/** The Table sheet: a table's size, its borders and its cells' background, and Merge and Split. */
export function TextEditTable({
  value,
  inTable,
  canMergeCells,
  canSplitCell,
  canNest,
  canUnnest,
  losesText,
  onChoose,
  onMerge,
  onSplit,
  onNest,
  onUnnest,
  onCancel,
}: {
  value: TextEditTableChoice;
  /** Whether the caret is in a table, which OK changes; otherwise OK makes a new one. */
  inTable: boolean;
  canMergeCells: boolean;
  canSplitCell: boolean;
  /** Whether the caret is in one cell, which can take a table of its own. */
  canNest: boolean;
  /** Whether this table is in a cell of another. */
  canUnnest: boolean;
  /** Whether this size takes away cells with something in them: OK asks first. */
  losesText: (rows: number, columns: number) => boolean;
  onChoose: (choice: TextEditTableChoice) => void;
  onMerge: () => void;
  onSplit: () => void;
  onNest: () => void;
  onUnnest: () => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState(String(value.rows));
  const [columns, setColumns] = useState(String(value.columns));
  const [border, setBorder] = useState(String(value.border));
  const [background, setBackground] = useState(value.background);
  const rowsField = useId();
  const columnsField = useId();
  const borderField = useId();
  const backgroundField = useId();
  const widthField = useId();
  const [columnWidth, setWidth] = useState(value.width);
  const valid = tableSizeFits(rows, columns, value) && columnWidthFits(columnWidth);
  const [confirming, setConfirming] = useState(false);
  const choose = () =>
    onChoose({
      rows: Number(rows),
      columns: Number(columns),
      border: Number(border),
      background,
      width: columnWidth,
    });
  if (confirming) {
    return (
      <>
        <SheetTitle>Remove cells with text in them?</SheetTitle>
        <SheetDescription>
          Making the table {rows} by {columns} deletes text in the rows and columns it loses. Edit
          &gt; Undo brings it back.
        </SheetDescription>
        <SheetActions>
          <PushButton type="button" onClick={() => setConfirming(false)}>
            Cancel
          </PushButton>
          <DefaultButton type="button" onClick={choose}>
            Remove
          </DefaultButton>
        </SheetActions>
      </>
    );
  }
  return (
    <form
      className="mac-textedit-rename"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        if (losesText(Number(rows), Number(columns))) setConfirming(true);
        else choose();
      }}
    >
      <SheetTitle>Table</SheetTitle>
      <div className="mac-save-panel-form">
        <SavePanelRow label="Rows:" labelFor={rowsField}>
          <TextField
            id={rowsField}
            autoFocus
            value={rows}
            onValueChange={setRows}
            style={{ width: 64 }}
          />
        </SavePanelRow>
        <SavePanelRow label="Columns:" labelFor={columnsField}>
          <TextField
            id={columnsField}
            value={columns}
            onValueChange={setColumns}
            style={{ width: 64 }}
          />
        </SavePanelRow>
        <SavePanelRow label="Column Width:" labelFor={widthField}>
          <TextField
            id={widthField}
            value={columnWidth}
            onValueChange={setWidth}
            placeholder="Automatic"
            aria-describedby={`${widthField}-unit`}
            style={{ width: 80 }}
          />
          <span id={`${widthField}-unit`}> pt</span>
        </SavePanelRow>
        <SavePanelRow label="Cell Border:" labelFor={borderField}>
          <PopUpButton
            id={borderField}
            value={border}
            onValueChange={(next) => setBorder(next as string)}
            style={{ width: 120 }}
          >
            {BORDERS.map((each) => (
              <PopUpButtonItem key={each.value} value={each.value}>
                {each.label}
              </PopUpButtonItem>
            ))}
          </PopUpButton>
        </SavePanelRow>
        <SavePanelRow label="Cell Background:" labelFor={backgroundField}>
          <PopUpButton
            id={backgroundField}
            value={background}
            onValueChange={(next) => setBackground(next as string)}
            style={{ width: 120 }}
          >
            <PopUpButtonItem value="none">None</PopUpButtonItem>
            {value.background === KEEP_BACKGROUND ? (
              <PopUpButtonItem value={KEEP_BACKGROUND}>As They Are</PopUpButtonItem>
            ) : null}
            {HIGHLIGHTS.map((each) => (
              <PopUpButtonItem key={each.value} value={each.value}>
                {each.label}
              </PopUpButtonItem>
            ))}
          </PopUpButton>
        </SavePanelRow>
        {inTable ? (
          <SavePanelRow label="Nesting:">
            <PushButton
              type="button"
              aria-label="Remove Nesting"
              disabled={!canUnnest}
              onClick={onUnnest}
            >
              −
            </PushButton>{" "}
            <PushButton type="button" aria-label="Nest Table" disabled={!canNest} onClick={onNest}>
              +
            </PushButton>
          </SavePanelRow>
        ) : null}
      </div>
      <SheetActions
        leading={
          inTable ? (
            <>
              <PushButton type="button" disabled={!canMergeCells} onClick={onMerge}>
                Merge Cells
              </PushButton>
              <PushButton type="button" disabled={!canSplitCell} onClick={onSplit}>
                Split Cell
              </PushButton>
            </>
          ) : null
        }
      >
        <PushButton type="button" onClick={onCancel}>
          Cancel
        </PushButton>
        <DefaultButton type="submit" disabled={!valid}>
          OK
        </DefaultButton>
      </SheetActions>
    </form>
  );
}

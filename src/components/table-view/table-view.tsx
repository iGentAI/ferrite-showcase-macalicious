"use client";

import {
  type ComponentProps,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ControlSize } from "../../lib/control-size";
import { nextSelection, type SelectionKey, type SelectionMode } from "../../lib/selection";
import { isSystemArrow } from "../../lib/system-arrows";
import { typeSelect } from "../../lib/type-select";
import { useControlled } from "../../lib/use-controlled";
import { useVirtualRange } from "../../lib/use-virtual-range";
import { ScrollView, type ScrollViewProps } from "../scroll-view";
import { TableHeader, type TableHeaderProps } from "../table-header";
import "./table-view.tokens.css";
import "./table-view.css";

// A press or double click on one of these inside the table, or on a control's label or on
// editable text, is its own, not the row's.
const CONTROLS =
  "button,input,select,textarea,a,label,[contenteditable]:not([contenteditable=false]),[role=columnheader]";

/** One column of a table view. */
export interface TableViewColumn {
  /** Identifies the column: in `renderCell`, `sort` and `onColumnResize`. */
  id: string;
  /** The heading: a noun or short noun phrase in title case. */
  title?: ReactNode;
  /** Width in points. A column without one shares the remaining width. */
  width?: number;
  /** Smallest width a resize gives the column (default 20). */
  minWidth?: number;
  /** Largest width a resize gives the column. */
  maxWidth?: number;
  /**
   * Alignment of the cells, and of the heading unless `headerAlign` is given (default
   * `"left"`).
   */
  align?: "left" | "center" | "right";
  /**
   * Alignment of the heading alone, for a heading that is not aligned as its cells are:
   * Activity Monitor centres every heading, over right-aligned numbers and left-aligned
   * names (default: the value of `align`).
   */
  headerAlign?: "left" | "center" | "right";
  /** Whether clicking the heading sorts by this column. */
  sortable?: boolean;
}

/** The column a table is sorted by, and the direction. */
export interface TableViewSort {
  column: string;
  direction: "ascending" | "descending";
}

export interface TableViewProps
  extends Omit<
    ScrollViewProps,
    "children" | "className" | "axis" | "defaultValue" | "viewportProps"
  > {
  /** The columns, in order. Give every column but one a `width`. */
  columns: readonly TableViewColumn[];
  /** Number of rows. Only the rows in view are rendered. */
  rowCount: number;
  /**
   * Content of one cell. Called for the rows in view only. A press on a control, a label or
   * editable text inside a cell is left to it; a widget built from other elements keeps its
   * presses by stopping their propagation.
   */
  renderCell: (row: number, column: TableViewColumn) => ReactNode;
  /** The id a row is selected by. Without it rows are selected by index. */
  getRowId?: (row: number) => SelectionKey;
  /** Text of a row for type-select: typing its first letters selects the row. */
  getRowLabel?: (row: number) => string;
  /**
   * Extra attributes for a row's element, such as `aria-level`, `data-*` or a class. The
   * table sets `id` and `data-row` itself.
   */
  getRowProps?: (row: number) => HTMLAttributes<HTMLDivElement> | undefined;
  /**
   * The id of the row to carry on from when the current row, the one with `id`, is no longer
   * in the table. An outline gives the nearest visible ancestor of a collapsed item.
   */
  getRowFallback?: (id: SelectionKey) => SelectionKey | undefined;
  /**
   * Row pitch in points: the row and the spacing under it. Catalina's tables use 16 to 21.
   * @default 19
   */
  rowHeight?: number;
  /**
   * Stripes every second row, and the space below the last row.
   * @default false
   */
  alternatingRows?: boolean;
  /**
   * The column headings: the standard grey header, the plain one on the content background,
   * the translucent one that the rows show through as they scroll under it (Console), or
   * none.
   * @default "standard"
   */
  header?: "standard" | "plain" | "translucent" | "none";
  /**
   * Props for the header the table renders (AppKit's `headerView`), a table header:
   * `topBorder` for a table that is not directly under a toolbar, `style`, `data-*`.
   */
  headerProps?: Omit<
    TableHeaderProps,
    "variant" | "className" | "children" | "columns" | "sort" | "onSortChange" | "onColumnResize"
  >;
  /**
   * Receives the element that scrolls: the clip view of AppKit's `enclosingScrollView`.
   * Read `scrollTop` and `clientHeight` from it and scroll with it; the header is pinned
   * inside it, over the first points of what it shows.
   */
  viewportRef?: Ref<HTMLDivElement>;
  /**
   * How many rows can be selected.
   * @default "single"
   */
  selectionMode?: SelectionMode;
  /** Ids of the selected rows (controlled). */
  value?: readonly SelectionKey[];
  /** Ids of the rows selected at first (uncontrolled). */
  defaultValue?: readonly SelectionKey[];
  /** Called with the ids of the selected rows when the selection changes. */
  onValueChange?: (value: readonly SelectionKey[]) => void;
  /** The column the rows are sorted by. The table shows the indicator; you sort the rows. */
  sort?: TableViewSort;
  /** Called when a sortable heading is clicked: the same column reversed, or a new one ascending. */
  onSortChange?: (sort: TableViewSort) => void;
  /** Called while a column is resized. With it, columns that have a `width` can be resized. */
  onColumnResize?: (column: string, width: number) => void;
  /** Called for a double click on a row, or Return while a row is selected. */
  onRowAction?: (row: number) => void;
  /**
   * Called with the current row for a key pressed in the table, before the table handles it.
   * Return a row to move the selection there; call `preventDefault()` to keep the key.
   */
  onRowKeyDown?: (row: number, event: KeyboardEvent<HTMLDivElement>) => number | undefined;
  /**
   * Text size of the cells: 13 pt, 12 pt (`"small"`) or 11 pt (`"mini"`).
   * @default "regular"
   */
  size?: ControlSize;
  /** Class of the root element. */
  className?: string;
}

/**
 * A table view (NSTableView in a scroll view): rows in columns under a header, with row
 * selection. It is a `grid` and one tab stop; rows outside the view are not rendered.
 */
export function TableView({
  columns,
  rowCount,
  renderCell,
  getRowId,
  getRowLabel,
  getRowProps,
  getRowFallback,
  rowHeight = 19,
  alternatingRows = false,
  header = "standard",
  headerProps,
  viewportRef,
  selectionMode = "single",
  value,
  defaultValue,
  onValueChange,
  sort,
  onSortChange,
  onColumnResize,
  onRowAction,
  onRowKeyDown,
  size = "regular",
  className,
  onKeyDown,
  onMouseDown,
  onDoubleClick,
  onFocus,
  ...props
}: TableViewProps) {
  const base = useId();
  const [selected, setSelected] = useControlled(value, defaultValue ?? [], onValueChange);
  // The id of the row the keyboard moves from, and of the row a Shift range starts at.
  const [leadId, setLeadId] = useState<SelectionKey>();
  const anchor = useRef<SelectionKey>(undefined);
  // The selection the user last made or moved the current row under: with it the current
  // row need not be a selected one. And the row the current row was last found at.
  const own = useRef<unknown>(null);
  const leadRow = useRef(-1);
  const typed = useRef({ text: "", time: 0 });
  // The header is 24 pt, and 25 pt with a line above it.
  const headerHeight = header === "none" ? 0 : headerProps?.topBorder ? 25 : 24;
  const [start, end, viewport, onScroll, reveal] = useVirtualRange(rowCount, rowHeight, {
    offset: headerHeight,
  });
  // The scrolling element is the parent of what scrolls. Its `ref` is the caller's, so the
  // rendered range follows it from here.
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => viewport(content.current?.parentElement ?? null), [viewport]);
  const idAt = (row: number) => (getRowId ? getRowId(row) : row);
  // Rows are looked up by id, so the current row survives sorting and rows coming and going.
  const find = (id: SelectionKey | undefined) => {
    if (id !== undefined) for (let row = 0; row < rowCount; row++) if (idAt(row) === id) return row;
    return -1;
  };
  const rowOf = (target: EventTarget) =>
    Number((target as Element).closest<HTMLElement>("[data-row]")?.dataset.row ?? -1);

  const chosen = new Set(selected);
  // The row the keyboard moves from and the grid names as active: the row last clicked or
  // moved to, while the selection is the one it was set under or still holds it, and else
  // the last selected row. So a selection set from outside is followed.
  const leadKey =
    leadId !== undefined && (own.current === selected || chosen.has(leadId))
      ? leadId
      : selected[selected.length - 1];
  let lead = leadRow.current;
  if (lead < 0 || lead >= rowCount || idAt(lead) !== leadKey) lead = find(leadKey);
  leadRow.current = lead;
  // The row has gone: carry on from the row that stands in for it, if there is one.
  if (lead < 0 && leadKey !== undefined) {
    const fallback = getRowFallback?.(leadKey);
    if (fallback !== leadId) {
      own.current = selected;
      setLeadId(fallback);
    }
  }

  // A row out of view is not rendered, and the grid can name only a rendered row. So while
  // the grid has the focus the current row is brought into view when it changes: after a
  // key, and after a selection set from outside. A new row height moves it too.
  const focused = useRef<Element>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the current row or the row height changes
  useLayoutEffect(() => {
    if (focused.current === document.activeElement) reveal(lead);
  }, [lead, rowHeight]);

  // Select the row and, for the keyboard (`keys`), scroll it into view. With `move` the row
  // becomes the current one and the selection stays as it is.
  const select = (
    row: number,
    toggle: boolean,
    extend: boolean,
    keys?: boolean,
    move?: boolean,
  ) => {
    if (row < 0 || row >= rowCount) return;
    // A range starts where the user's own last selection did, and else at the current row.
    // Under a selection set from outside, that is the row the selection made current.
    let from = -1;
    if (own.current === selected) from = find(anchor.current);
    else anchor.current = leadKey;
    setLeadId(idAt(row));
    own.current = selected;
    if (selectionMode !== "none" && !move) {
      const [next, at] = nextSelection(
        selectionMode,
        selected,
        from < 0 ? lead : from,
        row,
        idAt,
        toggle,
        extend,
        rowCount,
      );
      anchor.current = at < 0 ? undefined : idAt(at);
      own.current = next;
      setSelected(next);
    }
    if (keys) reveal(row);
  };

  const keyDown: NonNullable<ScrollViewProps["onKeyDown"]> = (event) => {
    onKeyDown?.(event);
    // Keys pressed in a heading or in a control inside a cell are theirs.
    if (event.defaultPrevented || event.target !== event.currentTarget || isSystemArrow(event))
      return;
    const height = event.currentTarget.firstElementChild?.clientHeight ?? 0;
    const page = Math.max(1, Math.floor((height - headerHeight) / rowHeight) - 1);
    const { key } = event;
    // With Control the keys move the current row and leave the selection, and Space adds the
    // current row to it or takes it out.
    const move = selectionMode === "multiple" && event.ctrlKey && !event.shiftKey;
    const moved =
      lead >= 0 ? onRowKeyDown?.(lead, event as KeyboardEvent<HTMLDivElement>) : undefined;
    let to: number | undefined;
    if (moved !== undefined) select(moved, false, false, true);
    else if (event.defaultPrevented) return;
    else if (key === "ArrowDown") to = lead + 1;
    else if (key === "ArrowUp") to = lead < 0 ? rowCount - 1 : lead - 1;
    else if (key === "PageDown") to = lead + page;
    else if (key === "PageUp") to = lead - page;
    else if (key === "Home") to = 0;
    else if (key === "End") to = rowCount - 1;
    else if (key === "Enter" && lead >= 0) onRowAction?.(lead);
    else if (move && key === " ") select(lead, true, false, true);
    else if (key === "a" && (event.metaKey || event.ctrlKey) && selectionMode === "multiple")
      setSelected(Array.from({ length: rowCount }, (_, row) => idAt(row)));
    else {
      const match = getRowLabel
        ? typeSelect(typed.current, event, rowCount, getRowLabel, lead)
        : -1;
      if (match < 0) return;
      select(match, false, false, true);
    }
    if (to !== undefined)
      select(Math.min(Math.max(to, 0), rowCount - 1), false, event.shiftKey, true, move);
    event.preventDefault();
  };

  const mouseDown: NonNullable<ScrollViewProps["onMouseDown"]> = (event) => {
    onMouseDown?.(event);
    const target = event.target as Element;
    // A press on a scroll bar is already cancelled; one on a control or heading is its own.
    if (event.button !== 0 || event.defaultPrevented || target.closest(CONTROLS)) return;
    // The grid takes the focus, not the scrolling element under the pointer. Browsers take a
    // focus() call for focus from the keyboard, so the press is marked, "1" while it gives
    // the focus and "" after: the ring is not drawn until the focus arrives another way.
    event.preventDefault();
    const grid = event.currentTarget;
    grid.dataset.pointerFocus = "1";
    grid.focus({ preventScroll: true });
    grid.dataset.pointerFocus = "";
    select(rowOf(target), event.metaKey || event.ctrlKey, event.shiftKey);
  };

  const rows: ReactNode[] = [];
  for (let row = start; row < end; row++) {
    const id = idAt(row);
    const extra = getRowProps?.(row);
    rows.push(
      // biome-ignore lint/a11y/useFocusableInteractive: the grid keeps the focus and names the active row with aria-activedescendant
      // biome-ignore lint/a11y/useSemanticElements: rows are positioned and virtualised, which tr and td cannot be
      <div
        // Ids are told apart by type too, as the selection does: 1 is not "1".
        key={typeof id + id}
        role="row"
        aria-rowindex={row + (headerHeight ? 2 : 1)}
        aria-selected={selectionMode === "none" ? undefined : chosen.has(id)}
        {...extra}
        // The table's own: the grid names the active row by this id, and finds a row by its index.
        id={`${base}${row}`}
        data-row={row}
        data-item-id={id}
        className={
          extra?.className ? `mac-table-view-row ${extra.className}` : "mac-table-view-row"
        }
      >
        {columns.map((column) => (
          // biome-ignore lint/a11y/useFocusableInteractive: see the row
          // biome-ignore lint/a11y/useSemanticElements: see the row
          <div
            key={column.id}
            role="gridcell"
            data-align={column.align}
            className="mac-table-view-cell"
            style={column.width === undefined ? undefined : { width: column.width, flex: "none" }}
          >
            {renderCell(row, column)}
          </div>
        ))}
      </div>,
    );
  }

  return (
    <ScrollView
      role="grid"
      aria-rowcount={rowCount + (headerHeight ? 1 : 0)}
      aria-colcount={columns.length}
      aria-multiselectable={selectionMode === "multiple" || undefined}
      aria-activedescendant={lead >= start && lead < end ? `${base}${lead}` : undefined}
      tabIndex={0}
      data-size={size}
      data-alternating={alternatingRows ? "" : undefined}
      className={className ? `mac-table-view ${className}` : "mac-table-view"}
      axis="both"
      // The scrolling element is the row group, and not a tab stop of its own.
      viewportProps={{ ref: viewportRef, onScroll, tabIndex: -1, role: "rowgroup" }}
      onKeyDown={keyDown}
      onMouseDown={mouseDown}
      // Focus from the keyboard brings a current row that is out of view into it, and ends
      // the mark of an earlier press. A press leaves the table where it is.
      onFocus={(event) => {
        onFocus?.(event);
        const grid = event.currentTarget;
        focused.current = grid;
        if (grid.dataset.pointerFocus) return;
        delete grid.dataset.pointerFocus;
        if (grid.matches(":focus-visible")) reveal(lead);
      }}
      onDoubleClick={(event) => {
        onDoubleClick?.(event);
        const row = rowOf(event.target);
        if (row >= 0 && !event.defaultPrevented && !(event.target as Element).closest(CONTROLS))
          onRowAction?.(row);
      }}
      {...props}
    >
      <div
        ref={content}
        className="mac-table-view-content"
        style={
          {
            "--_row": `${rowHeight}px`,
            minWidth: columns.reduce(
              (sum, column) => sum + (column.width ?? column.minWidth ?? 20),
              0,
            ),
          } as CSSProperties
        }
      >
        {header !== "none" && (
          // The header draws the headings of the columns itself.
          <TableHeader
            {...headerProps}
            variant={header}
            className="mac-table-view-header"
            columns={columns}
            sort={sort}
            onSortChange={onSortChange}
            onColumnResize={onColumnResize}
          />
        )}
        <div
          role="presentation"
          className="mac-table-view-body"
          style={{ height: rowCount * rowHeight }}
        >
          <div
            role="presentation"
            className="mac-table-view-rows"
            style={{ transform: `translateY(${start * rowHeight}px)` }}
          >
            {rows}
          </div>
        </div>
      </div>
    </ScrollView>
  );
}

export interface TableViewCellTextProps extends Omit<ComponentProps<"span">, "children"> {
  /** The text. */
  children: string;
  /**
   * Where the text is cut when it does not fit (AppKit's `lineBreakMode`): at its end, or
   * in its middle, which keeps its ending (`abc…xyz`).
   * @default "truncating-tail"
   */
  lineBreakMode?: "truncating-tail" | "truncating-middle";
}

/**
 * The text of a cell (the text field of an NSTableCellView): one line, cut where
 * `lineBreakMode` says. Use it beside an icon in a cell, and for text that is cut in its
 * middle; a cell that holds only text cuts it at the end by itself.
 */
export function TableViewCellText({
  lineBreakMode,
  className,
  children,
  ...props
}: TableViewCellTextProps) {
  // The text is in two parts: the first shrinks behind the ellipsis and the second stays.
  // Cut in its middle, a text keeps its last 17 characters and never more than half of it:
  // Keychain Access keeps 16 to 18 of its 11 pt names in a 220 pt column. The characters
  // are code points, so one outside the basic plane, such as an emoji, is never cut in two.
  const text = [...children];
  const cut =
    text.length - (lineBreakMode === "truncating-middle" ? Math.min(17, text.length >> 1) : 0);
  return (
    <span
      data-line-break-mode={lineBreakMode}
      className={className ? `mac-table-view-cell-text ${className}` : "mac-table-view-cell-text"}
      {...props}
    >
      <span>{text.slice(0, cut).join("")}</span>
      <span>{text.slice(cut).join("")}</span>
    </span>
  );
}

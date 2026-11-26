"use client";

import {
  type ComponentProps,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
} from "react";
import { cn } from "../../lib/cn";
import "./table-header.tokens.css";
import "./table-header.css";

/** One column of a header that draws its headings from a list (an NSTableColumn). */
export interface TableHeaderColumn {
  /** Identifies the column in `sort` and `onColumnResize`. */
  id: string;
  /** The heading. */
  title?: ReactNode;
  /** Width in points. A column without one shares the remaining width. */
  width?: number;
  /** Smallest width a resize gives the column (default 20). */
  minWidth?: number;
  /** Largest width a resize gives the column. */
  maxWidth?: number;
  /** Alignment of the column, and of its heading unless `headerAlign` is given. */
  align?: "left" | "center" | "right";
  /** Alignment of the heading alone. */
  headerAlign?: "left" | "center" | "right";
  /** Whether clicking the heading sorts by this column. */
  sortable?: boolean;
}

/** The column a table is sorted by, and the direction. */
export interface TableHeaderSort {
  column: string;
  direction: "ascending" | "descending";
}

export interface TableHeaderProps extends ComponentProps<"div"> {
  /**
   * `"standard"` is the grey header. `"plain"` is the same header on the content background.
   * `"translucent"` is the plain header without the opaque fill, as in Console: what is
   * behind it, such as the rows a table scrolls under it, shows through faintly.
   * @default "standard"
   */
  variant?: "standard" | "plain" | "translucent";
  /**
   * Draws a 1 pt line above the header, for a header that is not directly under a toolbar.
   * @default false
   */
  topBorder?: boolean;
  /**
   * The columns to draw headings for, in place of `TableHeaderCell` children: the header
   * then renders a cell per column, as a table view's header does.
   */
  columns?: readonly TableHeaderColumn[];
  /** With `columns`: the column the table is sorted by, which shows the indicator. */
  sort?: TableHeaderSort;
  /**
   * With `columns`: called when a sortable heading is clicked, with the same column
   * reversed or a new one ascending.
   */
  onSortChange?: (sort: TableHeaderSort) => void;
  /**
   * With `columns`: called while a column is resized. With it, the columns that have a
   * `width` can be resized.
   */
  onColumnResize?: (column: string, width: number) => void;
  /**
   * With `columns`: called when a heading is dragged to another place, or moved with
   * Option-Shift-Left or Option-Shift-Right Arrow, with the column it now goes before, or `null`
   * for the last place. With it, columns can be moved; you reorder `columns`.
   */
  onColumnMove?: (column: string, before: string | null) => void;
}

// Points a heading is dragged before it starts to move: a shorter press is a click on it.
const MOVE_THRESHOLD = 4;

const directionOf = (cell: Element) => (getComputedStyle(cell).direction === "rtl" ? -1 : 1);
const middleOf = (cell: Element) => {
  const box = cell.getBoundingClientRect();
  return box.left + box.width / 2;
};

/**
 * The row of column headings above a table or outline (NSTableHeaderView). It is a `row`;
 * its children are `TableHeaderCell`s.
 *
 * Two custom properties, set on the header or on an ancestor, place the titles where an
 * application's own header cells draw them: `--mac-table-header-title-inset` is the space
 * before and after a title (`5px 6px`), and `--mac-table-header-title-offset` moves the
 * titles down, or up when it is negative (`0px`).
 */
export function TableHeader({
  variant = "standard",
  topBorder = false,
  columns,
  sort,
  onSortChange,
  onColumnResize,
  onColumnMove,
  className,
  children,
  ...props
}: TableHeaderProps) {
  const moving = useRef(false);
  // Ends a drag under way, putting the heading back: the table or its moving may go first.
  const cancelDrag = useRef<(() => void) | null>(null);
  const movable = Boolean(onColumnMove);
  useEffect(() => (movable ? () => cancelDrag.current?.() : undefined), [movable]);
  // A drag outlasts renders: at its end it acts on what is current then.
  const latest = useRef({ columns, onColumnMove });
  latest.current = { columns, onColumnMove };
  // The click that ends a drag is not a press of the heading's button.
  const justMoved = useRef(false);
  const settle = (cell: HTMLElement, column: string, commit: boolean) => {
    const others = [...(cell.parentElement?.children ?? [])];
    const sign = directionOf(cell);
    const middle = middleOf(cell);
    const beforeCell = others.find(
      (other) => other !== cell && sign * (middleOf(other) - middle) > 0,
    );
    cell.style.removeProperty("transform");
    cell.removeAttribute("data-moving");
    justMoved.current = true;
    setTimeout(() => {
      justMoved.current = false;
    });
    const here = others.indexOf(cell);
    const there = beforeCell ? others.indexOf(beforeCell) : others.length;
    if (commit && there !== here + 1 && here >= 0)
      latest.current.onColumnMove?.(
        column,
        beforeCell ? (latest.current.columns?.[there]?.id ?? null) : null,
      );
  };
  const moveProps = (
    column: TableHeaderColumn,
    index: number,
    all: readonly TableHeaderColumn[],
  ) =>
    onColumnMove
      ? ({
          // A heading with no button and no resize is the tab stop for the keyboard move.
          ...(!column.sortable && (!onColumnResize || column.width === undefined)
            ? { tabIndex: 0 }
            : {}),
          // A touch on a heading drags it: the browser must not take the moves as a pan.
          style: { touchAction: "none" },
          onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
            if (!event.altKey || !event.shiftKey || event.defaultPrevented) return;
            const arrow = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
            if (!arrow) return;
            // Option-Arrow alone resizes: this key is the move's, at the ends too.
            event.preventDefault();
            const step = arrow * directionOf(event.currentTarget);
            const place = step > 0 ? index + 2 : index - 1;
            if (place < 0 || place > all.length || (step > 0 && index === all.length - 1)) return;
            onColumnMove(column.id, all[place]?.id ?? null);
          },
          onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
            if (
              moving.current ||
              event.button ||
              (event.target as Element).closest(".mac-table-header-resizer")
            )
              return;
            moving.current = true;
            const cell = event.currentTarget;
            const pointer = event.pointerId;
            const start = event.clientX;
            let moved = false;
            const end = (commit: boolean) => {
              moving.current = false;
              cancelDrag.current = null;
              window.removeEventListener("pointermove", follow, true);
              window.removeEventListener("pointerup", finish, true);
              window.removeEventListener("pointercancel", finish, true);
              window.removeEventListener("blur", cancel);
              cell.removeEventListener("lostpointercapture", lost);
              if (moved) settle(cell, column.id, commit);
            };
            const cancel = () => end(false);
            // A touch's capture starts on the heading's button: handing it to the heading ends that
            // one, and its event bubbles here.
            const lost = (next: globalThis.PointerEvent) => {
              if (next.target === cell && next.pointerId === pointer) cancel();
            };
            // The window hears the press's first moves wherever the pointer goes: a pointer capture
            // from the press would take the click from the heading's button.
            const follow = (next: globalThis.PointerEvent) => {
              if (next.pointerId !== pointer) return;
              // A release outside the browser sends no pointerup: the next move shows it.
              if (next.buttons === 0) {
                cancel();
                return;
              }
              const distance = next.clientX - start;
              if (!moved) {
                if (Math.abs(distance) < MOVE_THRESHOLD) return;
                moved = true;
                cell.setPointerCapture?.(pointer);
                cell.addEventListener("lostpointercapture", lost);
                cell.setAttribute("data-moving", "");
              }
              cell.style.transform = `translateX(${distance}px)`;
            };
            const finish = (next: globalThis.PointerEvent) => {
              if (next.pointerId === pointer) end(next.type === "pointerup");
            };
            cancelDrag.current = cancel;
            window.addEventListener("pointermove", follow, true);
            window.addEventListener("pointerup", finish, true);
            window.addEventListener("pointercancel", finish, true);
            window.addEventListener("blur", cancel);
          },
          onClickCapture: (event: MouseEvent<HTMLDivElement>) => {
            if (!justMoved.current) return;
            justMoved.current = false;
            event.stopPropagation();
          },
        } as const)
      : {};
  return (
    // biome-ignore lint/a11y/useSemanticElements: the header is laid out with flex or the table's grid, which tr and th cannot be
    // biome-ignore lint/a11y/useFocusableInteractive: a row is not focusable; its sortable headings are buttons
    <div
      role="row"
      data-variant={variant}
      data-top-border={topBorder ? "" : undefined}
      className={cn("mac-table-header", className)}
      {...props}
    >
      {columns
        ? columns.map((column, index) => {
            const sorted = sort?.column === column.id ? sort.direction : undefined;
            return (
              <TableHeaderCell
                key={column.id}
                {...moveProps(column, index, columns)}
                align={column.headerAlign ?? column.align}
                width={column.width}
                minWidth={column.minWidth}
                maxWidth={column.maxWidth}
                sortDirection={sorted}
                onSort={
                  column.sortable
                    ? () =>
                        onSortChange?.({
                          column: column.id,
                          direction: sorted === "ascending" ? "descending" : "ascending",
                        })
                    : undefined
                }
                onResize={
                  onColumnResize && column.width !== undefined
                    ? (width) => onColumnResize(column.id, width)
                    : undefined
                }
              >
                {column.title}
              </TableHeaderCell>
            );
          })
        : children}
    </div>
  );
}

export interface TableHeaderCellProps extends Omit<ComponentProps<"div">, "onResize"> {
  /**
   * Alignment of the title in the column.
   * @default "left"
   */
  align?: "left" | "center" | "right";
  /** Shows the sort indicator: the table is sorted by this column, in this direction. */
  sortDirection?: "ascending" | "descending";
  /** Called when the heading is clicked. With it the title is a button. */
  onSort?: () => void;
  /** Width of the column in points. Without it the cell shares the remaining width. */
  width?: number;
  /**
   * Called with the new width while the column's trailing edge is dragged, or Option-Left
   * or Option-Right Arrow is pressed on the focused heading. With it the cell has a resize
   * handle.
   */
  onResize?: (width: number) => void;
  /**
   * Smallest width a resize gives the column.
   * @default 20
   */
  minWidth?: number;
  /**
   * Largest width a resize gives the column.
   * @default Infinity (no limit)
   */
  maxWidth?: number;
}

// Points that Option-Arrow resizes a column by.
const STEP = 10;

/** One column heading (NSTableHeaderCell): a `columnheader` with its title. */
export function TableHeaderCell({
  align = "left",
  sortDirection,
  onSort,
  width,
  onResize,
  minWidth = 20,
  maxWidth = Number.POSITIVE_INFINITY,
  className,
  style,
  children,
  onKeyDown,
  onPointerDown,
  onPointerMove,
  ...props
}: TableHeaderCellProps) {
  const drag = useRef<{ start: number; width: number; pointer: number } | null>(null);
  // Without a resize handle there is no drag: one that was under way went with the handle.
  if (!onResize) drag.current = null;

  const resize = (wanted: number, cell: Element | null) => {
    const next = Math.round(Math.min(Math.max(wanted, minWidth), maxWidth));
    if (cell && next !== Math.round(cell.getBoundingClientRect().width)) onResize?.(next);
  };
  // +1 when the pointer or the arrow moves towards the cell's trailing edge.
  const direction = (cell: Element) => (getComputedStyle(cell).direction === "rtl" ? -1 : 1);

  const end = (event: PointerEvent<HTMLDivElement>) => {
    // Only the pointer that started the drag ends it.
    if (drag.current?.pointer !== event.pointerId) return;
    drag.current = null;
    event.currentTarget.removeAttribute("data-dragging");
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: see TableHeader
    <div
      role="columnheader"
      aria-sort={sortDirection ?? (onSort ? "none" : undefined)}
      // A heading that can only be resized is itself the tab stop for the keyboard resize.
      tabIndex={onResize && !onSort ? 0 : undefined}
      data-align={align}
      className={cn("mac-table-header-cell", className)}
      style={width === undefined ? style : { width, flex: "none", ...style }}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(event);
        const step = event.key === "ArrowRight" ? STEP : event.key === "ArrowLeft" ? -STEP : 0;
        if (!onResize || !event.altKey || !step || event.defaultPrevented) return;
        event.preventDefault();
        const cell = event.currentTarget;
        resize(cell.getBoundingClientRect().width + step * direction(cell), cell);
      }}
      // A drag of the resize handle is handled here, after the caller's own handlers, which
      // can cancel it. The handle captures the pointer, so its moves arrive here too.
      onPointerDown={(event) => {
        onPointerDown?.(event);
        const handle = event.target as Element;
        const cell = event.currentTarget;
        // While one pointer drags the handle, a press of another is ignored.
        if (
          drag.current ||
          event.button ||
          event.defaultPrevented ||
          !handle.matches(".mac-table-header-resizer")
        )
          return;
        handle.setPointerCapture?.(event.pointerId);
        handle.setAttribute("data-dragging", "");
        drag.current = {
          start: event.clientX * direction(cell),
          width: cell.getBoundingClientRect().width,
          pointer: event.pointerId,
        };
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        const cell = event.currentTarget;
        const state = drag.current;
        if (state?.pointer === event.pointerId && !event.defaultPrevented)
          resize(state.width + event.clientX * direction(cell) - state.start, cell);
      }}
      {...props}
    >
      {onSort ? (
        <button type="button" className="mac-table-header-title" onClick={onSort}>
          {children}
        </button>
      ) : (
        <span className="mac-table-header-title">{children}</span>
      )}
      {sortDirection && (
        <svg
          className="mac-table-header-indicator"
          data-direction={sortDirection}
          aria-hidden="true"
          viewBox="0 0 14 8"
          width="7"
          height="4"
        >
          <path d="M1 1l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="3" />
        </svg>
      )}
      {onResize && (
        // The handle loses the pointer when it is released or cancelled, and when something
        // else takes it: the drag is over.
        <div className="mac-table-header-resizer" onLostPointerCapture={end} />
      )}
    </div>
  );
}

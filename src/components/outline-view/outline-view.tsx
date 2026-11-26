"use client";

import { type ReactNode, useCallback, useLayoutEffect, useMemo, useRef } from "react";
import type { SelectionKey } from "../../lib/selection";
import { useControlled } from "../../lib/use-controlled";
import { DisclosureTriangle } from "../disclosure-triangle";
import { TableView, type TableViewColumn, type TableViewProps } from "../table-view";
import "./outline-view.tokens.css";
import "./outline-view.css";

/** One item of an outline. Add your own fields: `renderCell` receives the item. */
export interface OutlineViewItem {
  /** Identifies the item: in the selection and in `expanded`. */
  id: SelectionKey;
  /** The items inside this one. An item with `children`, even empty, has a triangle. */
  children?: readonly this[];
  /** Draws the row's text dimmed, as Font Book does for fonts that are not installed. */
  dimmed?: boolean;
}

export interface OutlineViewProps<Item extends OutlineViewItem = OutlineViewItem>
  extends Omit<
    TableViewProps,
    | "columns"
    | "rowCount"
    | "renderCell"
    | "getRowId"
    | "getRowLabel"
    | "getRowProps"
    | "onRowAction"
    | "onRowKeyDown"
  > {
  /** The top-level items. */
  items: readonly Item[];
  /** Content of one cell. The first column's content follows the indentation and triangle. */
  renderCell: (item: Item, column: TableViewColumn) => ReactNode;
  /** The columns. Without them the outline is a single column with no header. */
  columns?: readonly TableViewColumn[];
  /** Text of an item for type-select: typing its first letters selects the item. */
  getItemLabel?: (item: Item) => string;
  /** Ids of the expanded items (controlled). */
  expanded?: readonly SelectionKey[];
  /** Ids of the items expanded at first (uncontrolled). */
  defaultExpanded?: readonly SelectionKey[];
  /** Called with the ids of the expanded items when one is expanded or collapsed. */
  onExpandedChange?: (expanded: readonly SelectionKey[]) => void;
  /**
   * Points each level is indented by (NSOutlineView.indentationPerLevel).
   * @default 16
   */
  indentation?: number;
  /** Called for a double click on an item's row, or Return while it is selected. */
  onItemAction?: (item: Item) => void;
  /**
   * The id of an item to scroll into view (NSTableView.scrollRowToVisible). The outline
   * scrolls just far enough to show the item's row, when it is first shown and whenever this
   * id changes; a row that is in view stays where it is. The focus, the selection and
   * `expanded` are left alone: an item inside a collapsed parent has no row, and nothing
   * scrolls.
   * @default undefined
   */
  revealedItem?: SelectionKey;
}

const SINGLE: readonly TableViewColumn[] = [{ id: "outline" }];

/**
 * An outline view (NSOutlineView): a table whose first column shows a hierarchy, with a
 * disclosure triangle on every item that has children. It is a `treegrid` and one tab stop.
 */
export function OutlineView<Item extends OutlineViewItem = OutlineViewItem>({
  items,
  renderCell,
  columns,
  getItemLabel,
  expanded,
  defaultExpanded,
  onExpandedChange,
  indentation = 16,
  onItemAction,
  revealedItem,
  header = columns ? "standard" : "none",
  // The table view's default, which the row of `revealedItem` is placed by.
  rowHeight = 19,
  className,
  onClick,
  onMouseDown,
  ref,
  ...props
}: OutlineViewProps<Item>) {
  const [open, setOpen] = useControlled(expanded, defaultExpanded ?? [], onExpandedChange);
  // The visible rows in order: each with its level and the row of its parent.
  const rows = useMemo(() => {
    const shown = new Set(open);
    const out: { item: Item; level: number; parent: number; open: boolean }[] = [];
    const walk = (list: readonly Item[], level: number, parent: number) => {
      for (const item of list) {
        const isOpen = shown.has(item.id);
        const row = out.push({ item, level, parent, open: isOpen }) - 1;
        if (item.children && isOpen) walk(item.children, level + 1, row);
      }
    };
    walk(items, 1, -1);
    return out;
  }, [items, open]);

  // The root element, which the caller's ref gets too: the scrolling element is inside it.
  const root = useRef<HTMLDivElement>(null);
  const setRoot = useCallback(
    (element: HTMLDivElement | null) => {
      root.current = element;
      if (typeof ref === "function") return ref(element);
      if (ref) ref.current = element;
    },
    [ref],
  );

  // Bring the row of `revealedItem` into view, under the table view's header, whose height
  // is read from it: 24 pt, or 25 pt with a line above it. Layout is read here only, when the
  // id changes, and only for an item that has a row.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scrolls when the item to reveal changes, not when the rows or their height do
  useLayoutEffect(() => {
    const top = rows.findIndex((row) => row.item.id === revealedItem) * rowHeight;
    const view = top < 0 ? null : root.current?.querySelector('[role="rowgroup"]');
    if (view)
      view.scrollTop = Math.min(
        top,
        Math.max(
          view.scrollTop,
          top +
            rowHeight +
            (view.querySelector<HTMLElement>(".mac-table-view-header")?.offsetHeight ?? 0) -
            view.clientHeight,
        ),
      );
  }, [revealedItem]);

  // Expand or collapse an item; `deep` (Option) takes every item inside it along.
  const toggle = (item: OutlineViewItem, show: boolean, deep: boolean) => {
    const ids = new Set<SelectionKey>();
    const collect = (one: OutlineViewItem) => {
      ids.add(one.id);
      if (deep) for (const child of one.children ?? []) if (child.children) collect(child);
    };
    collect(item);
    setOpen(show ? [...new Set([...open, ...ids])] : open.filter((id) => !ids.has(id)));
  };

  const first = (columns ?? SINGLE)[0];
  return (
    <TableView
      ref={setRoot}
      role="treegrid"
      className={className ? `mac-outline-view ${className}` : "mac-outline-view"}
      columns={columns ?? SINGLE}
      header={header}
      rowHeight={rowHeight}
      rowCount={rows.length}
      getRowId={(row) => rows[row]?.item.id ?? row}
      getRowLabel={getItemLabel && ((row) => (rows[row] ? getItemLabel(rows[row].item) : ""))}
      getRowProps={(row) => {
        const entry = rows[row];
        return {
          "aria-level": entry?.level,
          "aria-expanded": entry?.item.children ? entry.open : undefined,
          className: entry?.item.dimmed ? "mac-outline-view-row-dimmed" : undefined,
        };
      }}
      onRowAction={onItemAction && ((row) => rows[row] && onItemAction(rows[row].item))}
      // The current item was collapsed out of sight, by a triangle or from outside: its
      // nearest visible ancestor takes its place.
      getRowFallback={(id) => {
        let found: SelectionKey | undefined;
        const walk = (list: readonly Item[], shown: SelectionKey | undefined, visible: boolean) => {
          for (const item of list) {
            if (item.id === id) found = shown;
            else if (item.children)
              walk(
                item.children as Item[],
                visible ? item.id : shown,
                visible && open.includes(item.id),
              );
          }
        };
        walk(items, undefined, true);
        return found;
      }}
      onRowKeyDown={(row, event) => {
        const entry = rows[row];
        const forward =
          getComputedStyle(event.currentTarget).direction === "rtl" ? "ArrowLeft" : "ArrowRight";
        if (!entry || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return undefined;
        event.preventDefault();
        const parent = entry.item.children !== undefined;
        if (event.key === forward) {
          if (parent && !entry.open) toggle(entry.item, true, event.altKey);
          // Already open: move to the first item inside it.
          else if (parent && entry.item.children?.length) return row + 1;
        } else if (parent && entry.open) toggle(entry.item, false, event.altKey);
        else if (entry.parent >= 0) return entry.parent;
        return undefined;
      }}
      renderCell={(row, column) => {
        const entry = rows[row];
        if (!entry) return null;
        const content = renderCell(entry.item, column);
        if (column !== first) return content;
        return (
          <div
            className="mac-outline-view-cell"
            style={{ paddingInlineStart: (entry.level - 1) * indentation }}
          >
            {entry.item.children ? (
              // The row announces the state (aria-expanded) and the arrow keys change it.
              <DisclosureTriangle
                aria-hidden="true"
                tabIndex={-1}
                className="mac-outline-view-triangle"
                expanded={entry.open}
              />
            ) : (
              <span className="mac-outline-view-triangle" />
            )}
            <div className="mac-outline-view-label">{content}</div>
          </div>
        );
      }}
      // The triangles have no handlers of their own: the outline finds the row of a click.
      // A press on one keeps the focus in the outline, and off the hidden button.
      onMouseDown={(event) => {
        onMouseDown?.(event);
        if (
          !event.button &&
          !event.defaultPrevented &&
          (event.target as Element).closest(TRIANGLE)
        ) {
          event.preventDefault();
          event.currentTarget.focus();
        }
      }}
      onClick={(event) => {
        onClick?.(event);
        const target = event.target as Element;
        const entry = rows[Number(target.closest<HTMLElement>("[data-row]")?.dataset.row ?? -1)];
        if (entry && !event.defaultPrevented && target.closest(TRIANGLE))
          toggle(entry.item, !entry.open, event.altKey);
      }}
      {...props}
    />
  );
}

const TRIANGLE = "button.mac-outline-view-triangle";

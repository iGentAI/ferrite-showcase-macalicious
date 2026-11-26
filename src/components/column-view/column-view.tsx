"use client";

import { type ComponentProps, memo, type ReactNode, useEffect, useId, useRef } from "react";
import { isSystemArrow } from "../../lib/system-arrows";
import { type TypeSelectState, typeSelect } from "../../lib/type-select";
import { useControlled } from "../../lib/use-controlled";
import { useVirtualRange } from "../../lib/use-virtual-range";
import { ScrollView, type ScrollViewProps } from "../scroll-view";
import "./column-view.tokens.css";
import "./column-view.css";

/** One item of a column. */
export interface ColumnViewItem {
  /** What the path holds for the item; unique among the items of its column. */
  id: string | number;
  /** The item's name: the row's text and what type-select matches. */
  label: string;
  /** A 16 pt icon before the name: decoration, not a control. */
  icon?: ReactNode;
  /** Whether the item opens a column of its own. Draws the triangle at the row's end. */
  hasChildren?: boolean;
}

export interface ColumnViewProps
  extends Omit<ScrollViewProps, "axis" | "viewportProps" | "children"> {
  /**
   * The items of one column: those of the root for `null`, otherwise the children of the
   * item with that id. Called while rendering for each column on the path, so return the same
   * array until the items change (keep them in state or a cache; return `[]` while they
   * load). Return `null` for an item that has nothing to list: its column is then the preview.
   */
  getChildren: (parentId: string | number | null) => readonly ColumnViewItem[] | null | undefined;
  /** Ids of the selected item of each column, from the root. Controlled. */
  path?: (string | number)[];
  /**
   * Items also selected in the column after the path's last: several picked at once, which open no
   * column of their own.
   */
  selection?: readonly (string | number)[];
  /** The path at first, when the view keeps its own. */
  defaultPath?: (string | number)[];
  /** Called with the new path when the selection of a column changes. */
  onPathChange?: (path: (string | number)[]) => void;
  /**
   * Content of the preview column, shown after the columns when the last item of the path
   * opens no column of its own. Without it there is no preview column.
   */
  renderPreview?: (item: ColumnViewItem) => ReactNode;
  /**
   * Width in points of a column that has no width of its own.
   * @default 204
   */
  columnWidth?: number;
  /** Widths in points of the columns, by position from the root. Controlled. */
  columnWidths?: number[];
  /** The widths at first, when the view keeps its own: `[160, 252]`. */
  defaultColumnWidths?: number[];
  /** Called with every column's width while a divider resizes one. */
  onColumnWidthsChange?: (widths: number[]) => void;
  /** Called with the item on a double click, and on Return for the selected item. */
  onItemAction?: (item: ColumnViewItem) => void;
}

// Row pitch in points. The narrowest column is 60 pt, and Option-arrow adds 10 pt to one.
const ROW = 18;
const NONE: never[] = [];

// One row. Memoised, so a selection change re-renders only the rows it touches.
const Row = memo(function Row(props: {
  id: string;
  index: number;
  count: number;
  selected: boolean;
  item: ColumnViewItem;
}) {
  const { item } = props;
  return (
    // biome-ignore lint/a11y/useFocusableInteractive: the listbox keeps focus and names the current option with aria-activedescendant
    <div
      role="option"
      id={props.id}
      aria-selected={props.selected}
      aria-setsize={props.count}
      aria-posinset={props.index + 1}
      data-index={props.index}
      data-item-id={item.id}
      data-children={item.hasChildren ? "" : undefined}
      className="mac-column-view-row"
    >
      {item.icon != null && <span className="mac-column-view-icon">{item.icon}</span>}
      <span className="mac-column-view-label">{item.label}</span>
    </div>
  );
});

// One column: a listbox that renders only the rows in view.
const Column = memo(function Column(props: {
  id: string;
  items: readonly ColumnViewItem[];
  selected: string | number | undefined;
  many: readonly (string | number)[] | undefined;
  active: boolean;
  width: number;
  label: string | undefined;
  labelledBy: string | undefined;
}) {
  const { id, items } = props;
  const [start, end, viewport, onScroll, reveal] = useVirtualRange(items.length, ROW);
  const index = items.findIndex((item) => item.id === props.selected);
  // A row out of view is not rendered, and the listbox can name only a rendered row: bring
  // the selected row into view when it changes, and when the keyboard focus arrives.
  useEffect(() => reveal(index), [index, reveal]);
  const rows: ReactNode[] = [];
  for (let at = start; at < end; at++) {
    const item = items[at];
    if (item)
      rows.push(
        <Row
          // Ids are told apart by type too, as the path does: 1 is not "1".
          key={typeof item.id + item.id}
          id={`${id}-${at}`}
          index={at}
          count={items.length}
          selected={at === index || props.many?.includes(item.id) === true}
          item={item}
        />,
      );
  }
  return (
    <ScrollView
      className="mac-column-view-column"
      style={{ width: props.width }}
      viewportProps={{
        ref: viewport,
        onScroll,
        onFocus: (event) => event.currentTarget.matches(":focus-visible") && reveal(index),
        id,
        role: "listbox",
        tabIndex: props.active ? 0 : -1,
        "aria-multiselectable": props.many ? true : undefined,
        "aria-label": props.label,
        "aria-labelledby": props.labelledBy,
        "aria-activedescendant": index >= start && index < end ? `${id}-${index}` : undefined,
        className: "mac-column-view-list",
      }}
    >
      <div style={{ boxSizing: "border-box", height: items.length * ROW, paddingTop: start * ROW }}>
        {rows}
      </div>
    </ScrollView>
  );
});

/**
 * A column view (NSBrowser): one scrolling column per level of a hierarchy, each listing the
 * children of the item selected in the column before it, and a preview column for an item
 * that has none. Props that are not its own, `ref` included, go to the root element.
 */
export function ColumnView({
  getChildren,
  path: controlled,
  selection,
  defaultPath,
  onPathChange,
  renderPreview,
  columnWidth = 204,
  columnWidths,
  defaultColumnWidths,
  onColumnWidthsChange,
  onItemAction,
  className,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  ...props
}: ColumnViewProps) {
  const [path, setPath] = useControlled(controlled, defaultPath ?? NONE, onPathChange);
  const [widths, setWidths] = useControlled(
    columnWidths,
    defaultColumnWidths ?? NONE,
    onColumnWidthsChange,
  );
  const id = useId();
  const outer = useRef<HTMLDivElement>(null);
  const typed = useRef<TypeSelectState>({ text: "", time: 0 });
  // A divider being dragged: its column, that column's width and the pointer at the start,
  // which way the pointer widens it, and which pointer it is.
  const drag = useRef<[number, number, number, number, number] | null>(null);

  // The item lists of the columns on the path, and the preview after them.
  const lists: (readonly ColumnViewItem[])[] = [getChildren(null) ?? NONE];
  const labels = [label];
  let preview: ReactNode;
  for (let depth = 0; depth < path.length; depth++) {
    const item = lists[depth]?.find((child) => child.id === path[depth]);
    const children = item?.hasChildren ? getChildren(item.id) : null;
    if (!children) {
      if (item) preview = renderPreview?.(item);
      break;
    }
    lists.push(children);
    labels.push(item?.label);
  }
  // The column of the last item on the path: the one tab stop.
  const active = Math.max(0, Math.min(path.length, lists.length) - 1);
  const count = lists.length + (preview == null ? 0 : 1);
  const widthOf = (index: number) => widths[index] ?? columnWidth;

  // Show the newest column.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the number of columns changes
  useEffect(() => {
    const view = outer.current;
    if (view)
      view.scrollLeft = view.scrollWidth * (getComputedStyle(view).direction === "rtl" ? -1 : 1);
  }, [count]);

  // Select `item` in the column at `depth` and give that column the keyboard.
  const go = (depth: number, item: string | number) => {
    setPath(path.slice(0, depth).concat(item));
    document.getElementById(id + depth)?.focus();
  };
  const resize = (index: number, width: number) =>
    setWidths(
      Array.from({ length: Math.max(widths.length, index + 1) }, (_, at) =>
        at === index ? Math.max(60, Math.round(width)) : widthOf(at),
      ),
    );
  // The column an event happened in (-1 for none) and the item of the row it happened on.
  // An event in a control inside an item (in its icon, say), in a control's label or in
  // editable text is the control's own: it has no column. Content marked
  // contenteditable="false" is not editable, and is the item's.
  const where = (element: HTMLElement): [number, ColumnViewItem | undefined] => {
    const list = element.closest(
      "button,input,select,textarea,a,label,[contenteditable]:not([contenteditable=false]),[role=listbox]",
    );
    const depth = list?.id.startsWith(id) ? +list.id.slice(id.length) : -1;
    return [
      depth,
      // Off a row the index is not a number, and no item has it.
      lists[depth]?.[+(element.closest<HTMLElement>("[data-index]")?.dataset.index as string)],
    ];
  };

  const nodes: ReactNode[] = [];
  for (let depth = 0; depth < count; depth++) {
    const items = lists[depth];
    const parent = path[depth - 1];
    nodes.push(
      items ? (
        <Column
          // A column is its parent's: by depth, and by the parent's id and that id's type.
          key={depth + typeof parent + parent}
          id={id + depth}
          items={items}
          selected={path[depth]}
          many={depth === path.length ? selection : undefined}
          active={depth === active}
          width={widthOf(depth)}
          label={labels[depth]}
          labelledBy={depth ? undefined : labelledBy}
        />
      ) : (
        <ScrollView
          key="preview"
          className="mac-column-view-preview"
          style={{ width: widthOf(depth) }}
        >
          {preview}
        </ScrollView>
      ),
      <div key={depth} data-divider={depth} className="mac-column-view-divider" />,
    );
  }

  return (
    <ScrollView
      role="group"
      aria-label={label}
      aria-labelledby={labelledBy}
      {...props}
      axis="horizontal"
      className={className ? `mac-column-view ${className}` : "mac-column-view"}
      viewportProps={{ ref: outer, tabIndex: -1, className: "mac-column-view-columns" }}
      onMouseDown={(event) => {
        props.onMouseDown?.(event);
        const [depth, item] = where(event.target as HTMLElement);
        if (event.button || event.defaultPrevented) return;
        // A divider takes no focus. A column takes it itself, as for any click.
        if ((event.target as HTMLElement).dataset.divider) event.preventDefault();
        // A click under the rows of a column leaves that column without a selection.
        if (depth >= 0) setPath(path.slice(0, depth).concat(item ? item.id : NONE));
      }}
      onDoubleClick={(event) => {
        props.onDoubleClick?.(event);
        const [, item] = where(event.target as HTMLElement);
        if (item && !event.defaultPrevented) onItemAction?.(item);
      }}
      onPointerDown={(event) => {
        props.onPointerDown?.(event);
        const target = event.target as HTMLElement;
        const index = +(target.dataset.divider ?? -1);
        // The dragging pointer's next press anywhere starts afresh. While another pointer
        // drags, a press is ignored.
        if (drag.current?.[4] === event.pointerId) drag.current = null;
        if (drag.current || index < 0 || event.button || event.defaultPrevented) return;
        target.setPointerCapture?.(event.pointerId);
        // The pointer is on the column's far edge: its right edge, unless right-to-left.
        drag.current = [
          index,
          widthOf(index),
          event.clientX,
          getComputedStyle(target).direction === "rtl" ? -1 : 1,
          event.pointerId,
        ];
      }}
      onPointerMove={(event) => {
        props.onPointerMove?.(event);
        const state = drag.current;
        // Only the pointer that started the drag moves or ends it.
        if (state?.[4] !== event.pointerId) return;
        if (!event.buttons) drag.current = null;
        else if (!event.defaultPrevented)
          resize(state[0], state[1] + (event.clientX - state[2]) * state[3]);
      }}
      // The divider gives the pointer up when it is released or cancelled: the drag is over.
      onLostPointerCapture={(event) => {
        props.onLostPointerCapture?.(event);
        if (drag.current?.[4] === event.pointerId) drag.current = null;
      }}
      onKeyDown={(event) => {
        props.onKeyDown?.(event);
        const target = event.target as HTMLElement;
        const [depth] = where(target);
        const items = lists[depth];
        if (!items || event.defaultPrevented || isSystemArrow(event)) return;
        const index = items.findIndex((item) => item.id === path[depth]);
        const { key } = event;
        // Towards the child column: Right Arrow, or Left Arrow when the columns run leftwards.
        const forward = (key === "ArrowRight") === (getComputedStyle(target).direction !== "rtl");
        let next = -1;
        if (key !== "ArrowRight" && key !== "ArrowLeft") {
          const steps: Record<string, number> = {
            ArrowDown: 1,
            ArrowUp: -1,
            Home: -items.length,
            End: items.length,
          };
          const step = steps[key];
          if (step) next = Math.max(0, Math.min(items.length - 1, index + step));
          else if (key === "Enter") {
            const item = items[index];
            if (item && onItemAction) {
              onItemAction(item);
              event.preventDefault();
            }
          } else
            next = typeSelect(
              typed.current,
              event,
              items.length,
              // Type-select asks only for items the column has.
              (at) => (items[at] as ColumnViewItem).label,
              index,
            );
          const item = items[next];
          if (!item) return;
          go(depth, item.id);
        } else {
          // Type-select starts afresh in another column.
          typed.current.text = "";
          if (event.altKey) resize(depth, widthOf(depth) + (forward ? 10 : -10));
          else if (forward) {
            const child = lists[depth + 1]?.[0];
            if (child && index >= 0) go(depth + 1, child.id);
          } else if (depth) go(depth - 1, path[depth - 1] as string | number);
        }
        event.preventDefault();
      }}
    >
      {nodes}
    </ScrollView>
  );
}

export interface ColumnViewPanelProps extends ComponentProps<"div"> {
  /** The panel's content, centred: artwork, the item's name, a status line, buttons. */
  children?: ReactNode;
}

/** The tinted panel at the top of a preview column: artwork, name, status and buttons. */
export function ColumnViewPanel({ className, ...props }: ColumnViewPanelProps) {
  return (
    <div
      className={className ? `mac-column-view-panel ${className}` : "mac-column-view-panel"}
      {...props}
    />
  );
}

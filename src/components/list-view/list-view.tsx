"use client";

import {
  type ComponentProps,
  type CSSProperties,
  type MouseEvent,
  memo,
  type ReactNode,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { nextSelection, type SelectionKey, type SelectionMode } from "../../lib/selection";
import { isSystemArrow } from "../../lib/system-arrows";
import { type TypeSelectState, typeSelect } from "../../lib/type-select";
import { useControlled } from "../../lib/use-controlled";
import { itemAt, itemOffsets, itemStart, useVirtualRange } from "../../lib/use-virtual-range";
import { ScrollView, type ScrollViewProps } from "../scroll-view";
import "./list-view.tokens.css";
import "./list-view.css";

export interface ListViewProps
  extends Omit<
    ScrollViewProps,
    "axis" | "viewportProps" | "children" | "defaultValue" | "className"
  > {
  /** Number of rows. */
  count: number;
  /**
   * Renders the content of the row at `index`: text, or the `ListViewRow…` parts. Only the
   * visible rows are rendered. Keep the function's identity stable (define it outside the
   * component or with `useCallback`) so that a selection change re-renders only the rows it
   * touches, and give it a new identity when what it reads changes: a row is rendered again
   * only when its index, its selection, the number of rows or this function changes. Rows
   * take content that is not interactive: a row that needs a control belongs in a table
   * view. As a safeguard a press on a control, a label or editable text inside a row is
   * left to it; a widget built from other elements keeps its presses by stopping their
   * propagation.
   */
  renderRow: (index: number) => ReactNode;
  /**
   * Height of every row in points, separator included: 24 (one line, Contacts), 34
   * (Reminders), 56 (two lines, Notes), 64 (Messages). Or a function that gives the height of
   * the row at `index`, for rows of different heights: Reminders' 70 pt row of a reminder with
   * a picture among rows of 34. Keep its identity stable, as for `renderRow`, and give it a
   * new one when a height changes.
   * @default 24
   */
  rowHeight?: number | ((index: number) => number);
  /**
   * The id of the row at `index`, which is what the selection holds.
   * @default the index itself
   */
  getRowId?: (index: number) => string | number;
  /** The text of the row at `index` for type-select. Without it typing does nothing. */
  getRowLabel?: (index: number) => string;
  /** Ids of the selected rows, controlled. */
  value?: (string | number)[];
  /** Ids of the rows selected at first, when the list keeps its own selection. */
  defaultValue?: (string | number)[];
  /** Called with the ids of the selected rows when the selection changes. */
  onValueChange?: (value: (string | number)[]) => void;
  /**
   * `"single"` selects one row; `"multiple"` adds Command-click to toggle, Shift to extend,
   * Command-A, and Control with the keys to move the current row without selecting it and
   * Control-Space to toggle it; `"none"` selects nothing and leaves the keys to scrolling.
   * @default "single"
   */
  selectionMode?: SelectionMode;
  /** Called with the row's index on a double click, and on Return for the current row. */
  onRowAction?: (index: number) => void;
  /**
   * `"inset"` draws a 1 pt line under each row, from `separatorInset` to the trailing edge.
   * @default "none"
   */
  separator?: "none" | "inset";
  /**
   * `"separator"` fills the view below the last row with empty rows of the last row's height,
   * drawn only as the 1 pt separator in each one's last point, as Messages does under its
   * conversations. The lines take no space and are not rows: they scroll with the list and
   * stop where the rows fill the view.
   * @default "none"
   */
  emptyRows?: "none" | "separator";
  /**
   * Points from the leading edge to the row's text, which is also where an inset separator
   * starts (unless `--mac-list-view-separator-inset` moves it): 25 in Notes, 29 in Contacts,
   * 50 in Reminders. A leading accessory sits before it.
   * @default 25
   */
  separatorInset?: number;
  /**
   * When the selection is drawn in the accent colour with white text. `"focus"`: only while
   * the list has the keyboard in a key window, and in grey otherwise, as in Contacts and Notes.
   * `"always"`: also without the keyboard and in a window that is not key, as the conversation
   * list of Messages.
   * @default "focus"
   */
  emphasis?: "focus" | "always";
  /**
   * Rows can be dragged: each row element is `draggable`; listen for `onDragStart` around the
   * list. A plain press on a row of a selection of several then keeps the selection for the drag,
   * and selects that row alone only when the button comes up without one.
   * @default false
   */
  rowDraggable?: boolean;
  /**
   * Whether the row at `index` is a heading of the rows after it, which `renderRow` renders as a
   * heading element: Scheduled's days in Reminders. It is no option: a press selects nothing, the
   * keys pass over it and it does not count in the list's length. Shift ranges and Command-A
   * still name its id, for `onValueChange` to leave out, and `getRowLabel` gives it no text, so
   * that type-select passes it.
   * @default no row is a heading
   */
  isRowHeading?: (index: number) => boolean;
  /** Class of the root element. */
  className?: string;
}

const byIndex = (index: number): SelectionKey => index;
const join = (base: string, extra?: string) => (extra ? `${base} ${extra}` : base);

// One row. Memoised, so a selection change re-renders only the rows whose state changed.
const Row = memo(function Row(props: {
  id: string;
  index: number;
  /** The options in the list, and this one's place among them: 0 for a heading. */
  size: number;
  position: number;
  selected: boolean;
  /** The row's own height, when the rows are not all the list's one height. */
  height?: number;
  draggable: boolean;
  render: (index: number) => ReactNode;
}) {
  return (
    <div
      {...(props.position
        ? {
            role: "option",
            "aria-selected": props.selected,
            "aria-setsize": props.size,
            "aria-posinset": props.position,
            draggable: props.draggable || undefined,
            // What a press finds its row by: a press on a heading finds none.
            "data-index": props.index,
          }
        : { role: "none" })}
      id={props.id}
      className="mac-list-view-row"
      style={props.height ? ({ "--_height": `${props.height}px` } as CSSProperties) : undefined}
    >
      {props.render(props.index)}
    </div>
  );
});

// The index of the row an event happened in, or -1. A press or a double click on a control
// inside a row, on a control's label or in editable text is the control's own. Content marked
// contenteditable="false" is not editable: it is the row's.
const rowOf = (event: MouseEvent) => {
  const target = event.target as Element;
  return target.closest(
    "button,input,select,textarea,a,label,[contenteditable]:not([contenteditable=false])",
  )
    ? -1
    : Number(target.closest<HTMLElement>("[data-index]")?.dataset.index ?? -1);
};

/**
 * A list (single-column NSTableView without a header): `count` rows of one height, or of the
 * heights a function gives, in a scroll view, of which only the visible ones are rendered. The scrolling element is the
 * `listbox`; other props, `ref` included, go to the scroll view's root. `onKeyDown`,
 * `onMouseDown` and `onDoubleClick` are called before the list acts and can cancel it with
 * `preventDefault()`.
 */
export function ListView({
  count,
  renderRow,
  rowHeight = 24,
  getRowId = byIndex,
  getRowLabel,
  value: controlled,
  defaultValue,
  onValueChange,
  selectionMode = "single",
  onRowAction,
  separator = "none",
  emptyRows = "none",
  separatorInset = 25,
  emphasis = "focus",
  rowDraggable = false,
  isRowHeading,
  className,
  onKeyDown,
  onMouseDown,
  onDoubleClick,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  ...props
}: ListViewProps) {
  const [value, setValue] = useControlled(controlled, defaultValue ?? [], onValueChange);
  // The id of the row last clicked or moved to, and of the row a Shift range starts at.
  const [active, setActive] = useState<SelectionKey>();
  const anchor = useRef<SelectionKey>(undefined);
  // The row a plain press on a selection of several landed on, while it may become a drag.
  const pressed = useRef(-1);
  // The selection the user last made or moved the current row under: with it the current
  // row need not be a selected one. And the index the current row was last found at.
  const own = useRef<unknown>(null);
  const leadRow = useRef(-1);
  const typed = useRef<TypeSelectState>({ text: "", time: 0 });
  const id = useId();
  // No row is selected in a list without selection, whatever `value` names.
  const selected = new Set(selectionMode === "none" ? [] : value);
  // Rows of different heights are placed by their offsets, computed once per height function.
  const offsets = useMemo(
    () => (typeof rowHeight === "number" ? undefined : itemOffsets(count, rowHeight)),
    [count, rowHeight],
  );
  const sizes = offsets ?? (rowHeight as number);
  const [start, end, viewport, onScroll, reveal] = useVirtualRange(count, sizes);
  const multiple = selectionMode === "multiple";
  // The rows that are options, when some are headings, in order.
  const stops =
    isRowHeading && Array.from({ length: count }, (_, at) => at).filter((at) => !isRowHeading(at));
  // A row's place among the options: 0 for a heading.
  const placeOf = (index: number) => (stops ? stops.indexOf(index) : index) + 1;
  const size = stops ? stops.length : count;
  const total = itemStart(sizes, count);
  // An empty row is as tall as the last row.
  const period = offsets ? (count ? total - itemStart(offsets, count - 1) : 24) : rowHeight;

  // Rows are known by id, so the current row and the start of a range survive reordering.
  const find = (key: SelectionKey | undefined) => {
    for (let index = 0; index < count; index++) if (getRowId(index) === key) return index;
    return -1;
  };
  // The row the keyboard moves from and the listbox names as active: the one last clicked or
  // moved to, while the selection is the one it was set under or still holds it, and else
  // the first selected row. So a selection set or cleared from outside is followed.
  const leadKey =
    active !== undefined && (own.current === value || selected.has(active)) ? active : value[0];
  let lead = leadRow.current;
  if (leadKey === undefined) lead = -1;
  else if (lead < 0 || lead >= count || getRowId(lead) !== leadKey) lead = find(leadKey);
  leadRow.current = lead;

  // A row out of view is not rendered, and the listbox can name only a rendered row. So
  // while the listbox has the focus the current row is brought into view when it changes:
  // after a key, and after a selection set from outside. A new row height moves it too.
  const focused = useRef<Element>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the current row or the row height changes
  useLayoutEffect(() => {
    if (focused.current === document.activeElement) reveal(lead);
  }, [lead, rowHeight]);

  const select = (index: number, toggle: boolean, extend: boolean) => {
    if (selectionMode === "none") return;
    // A range starts where the user's own last selection did, and else at the current row.
    const from = own.current === value ? find(anchor.current) : -1;
    const [next, origin] = nextSelection(
      selectionMode,
      value,
      from < 0 ? lead : from,
      index,
      getRowId,
      toggle,
      extend,
      count,
    );
    anchor.current = origin < 0 ? undefined : getRowId(origin);
    own.current = next;
    setActive(getRowId(index));
    setValue(next);
  };

  const rows: ReactNode[] = [];
  for (let index = start; index < end; index++) {
    const key = getRowId(index);
    rows.push(
      <Row
        // Ids are told apart by type too, as the selection does: 1 is not "1".
        key={typeof key + key}
        id={id + index}
        index={index}
        size={size}
        position={placeOf(index)}
        selected={selected.has(key)}
        height={offsets ? itemStart(offsets, index + 1) - itemStart(offsets, index) : undefined}
        draggable={rowDraggable}
        render={renderRow}
      />,
    );
  }

  return (
    <ScrollView
      data-separator={separator}
      data-empty-rows={emptyRows}
      data-emphasis={emphasis}
      className={join("mac-list-view", className)}
      viewportProps={{
        ref: viewport,
        className: "mac-list-view-viewport",
        // Where the empty rows start, how tall they are, and the text inset.
        style: {
          "--_end": `${total}px`,
          "--_period": `${period}px`,
          "--_inset": `${separatorInset}px`,
        } as CSSProperties,
        // Rendered before the frame is painted, so a jump never shows a blank list.
        onScroll: () => flushSync(onScroll),
        role: "listbox",
        tabIndex: 0,
        "aria-label": label,
        "aria-labelledby": labelledBy,
        "aria-multiselectable": multiple || undefined,
        "aria-activedescendant": lead >= start && lead < end ? id + lead : undefined,
        // Focus from the keyboard brings a current row that is out of view into it. A press
        // leaves the list where it is.
        onFocus: (event) => {
          focused.current = event.currentTarget;
          if (event.currentTarget.matches(":focus-visible")) reveal(lead);
        },
        onMouseDown: (event) => {
          onMouseDown?.(event);
          const index = rowOf(event);
          if (index < 0 || event.button || event.defaultPrevented) return;
          const toggle = event.metaKey || event.ctrlKey;
          if (
            rowDraggable &&
            selected.size > 1 &&
            selected.has(getRowId(index)) &&
            !toggle &&
            !event.shiftKey
          ) {
            pressed.current = index;
            return;
          }
          select(index, toggle, event.shiftKey);
        },
        onMouseUp: () => {
          if (pressed.current >= 0) select(pressed.current, false, false);
          pressed.current = -1;
        },
        onDragStart: () => {
          pressed.current = -1;
        },
        onDoubleClick: (event) => {
          onDoubleClick?.(event);
          const index = rowOf(event);
          if (index >= 0 && !event.defaultPrevented) onRowAction?.(index);
        },
        onKeyDown: (event) => {
          onKeyDown?.(event);
          const view = event.currentTarget;
          // Keys pressed in a control inside a row are the control's.
          if (
            event.defaultPrevented ||
            selectionMode === "none" ||
            !size ||
            event.target !== view ||
            isSystemArrow(event)
          )
            return;
          // With Control the keys move the current row and leave the selection, and Space
          // adds the current row to it or takes it out.
          const move = multiple && event.ctrlKey && !event.shiftKey;
          // A page is the rows a view's height holds, less one, from the current row on.
          let down = 1;
          let up = 1;
          if (offsets) {
            const at = Math.max(0, lead);
            const top = itemStart(offsets, at);
            const bottom = itemStart(offsets, at + 1);
            down = Math.max(1, itemAt(offsets, top + view.clientHeight) - at - 1);
            up = Math.max(1, at - itemAt(offsets, bottom - view.clientHeight) - 1);
          } else down = up = Math.max(1, Math.floor(view.clientHeight / (rowHeight as number)) - 1);
          const steps: Record<string, number> = {
            ArrowDown: 1,
            ArrowUp: -1,
            PageDown: down,
            PageUp: -up,
            Home: -count,
            End: count,
          };
          const step = steps[event.key];
          let next = -1;
          // The keys move among the options. With nothing selected, Up Arrow starts at the last row.
          if (step) {
            next = Math.max(
              0,
              Math.min(
                size - 1,
                (lead < 0 && event.key === "ArrowUp" ? size : placeOf(lead) - 1) + step,
              ),
            );
            next = stops?.[next] ?? next;
          } else if (event.key === "Enter") {
            if (lead >= 0 && onRowAction) {
              onRowAction(lead);
              event.preventDefault();
            }
          } else if (move && event.key === " ") next = lead;
          else if (multiple && event.key === "a" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            setValue(Array.from({ length: count }, (_, index) => getRowId(index)));
          } else if (getRowLabel) next = typeSelect(typed.current, event, count, getRowLabel, lead);
          if (next < 0) return;
          event.preventDefault();
          if (move && step) {
            // Under a selection set from outside, a range starts at the row it made current.
            if (own.current !== value) anchor.current = leadKey;
            own.current = value;
            setActive(getRowId(next));
          } else select(next, move, !!step && event.shiftKey);
          reveal(next);
        },
      }}
      {...props}
    >
      <div
        className="mac-list-view-rows"
        style={
          {
            height: total,
            paddingTop: itemStart(sizes, start),
            "--_height": offsets ? undefined : `${rowHeight}px`,
          } as CSSProperties
        }
      >
        {rows}
      </div>
    </ScrollView>
  );
}

export interface ListViewRowTitleProps extends ComponentProps<"div"> {}

/** The primary line of a row: 13 pt bold, cut with an ellipsis. */
export function ListViewRowTitle({ className, ...props }: ListViewRowTitleProps) {
  return <div className={join("mac-list-view-row-title", className)} {...props} />;
}

export interface ListViewRowDetailProps extends ComponentProps<"div"> {
  /** Text before the children in the primary colour: the date before a note's snippet. */
  lead?: ReactNode;
}

/** A secondary line under the title: 13 pt in the secondary label colour. */
export function ListViewRowDetail({ lead, className, children, ...props }: ListViewRowDetailProps) {
  return (
    <div className={join("mac-list-view-row-detail", className)} {...props}>
      {lead != null && <span className="mac-list-view-row-detail-lead">{lead}</span>}
      {children}
    </div>
  );
}

export interface ListViewRowLeadingProps extends ComponentProps<"div"> {}

/** An accessory centred in the gutter before the text: a reminder's circle, an avatar. */
export function ListViewRowLeading({ className, ...props }: ListViewRowLeadingProps) {
  return <div className={join("mac-list-view-row-leading", className)} {...props} />;
}

export interface ListViewRowTrailingProps extends ComponentProps<"div"> {}

/** An accessory after the text, vertically centred: a thumbnail, a date. */
export function ListViewRowTrailing({ className, ...props }: ListViewRowTrailingProps) {
  return <div className={join("mac-list-view-row-trailing", className)} {...props} />;
}

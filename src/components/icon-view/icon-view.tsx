"use client";

import {
  type CSSProperties,
  type MouseEvent,
  memo,
  type ReactNode,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { observeResize } from "../../lib/observe-resize";
import { nextSelection, type SelectionKey, type SelectionMode } from "../../lib/selection";
import { isSystemArrow } from "../../lib/system-arrows";
import { type TypeSelectState, typeSelect } from "../../lib/type-select";
import { useControlled } from "../../lib/use-controlled";
import { useVirtualRange } from "../../lib/use-virtual-range";
import { ScrollView, type ScrollViewProps } from "../scroll-view";
import "./icon-view.tokens.css";
import "./icon-view.css";

export interface IconViewProps
  extends Omit<
    ScrollViewProps,
    "axis" | "viewportProps" | "children" | "defaultValue" | "className"
  > {
  /** Number of items. */
  count: number;
  /**
   * Renders the icon of the item at `index`: an image or drawing of at most `iconSize` on
   * each side. It is artwork: the view hides it from assistive technology, since the label
   * names the item, so it must not hold buttons, fields or other controls. Only the items
   * in view are rendered. Keep the function's identity stable
   * (define it outside the component or with `useCallback`) so that a selection change
   * re-renders only the items it touches, and give it a new identity when what it reads
   * changes: an item is rendered again only when its index, label, selection, the number of
   * items or one of the render functions changes.
   */
  renderIcon: (index: number) => ReactNode;
  /** The name of the item at `index`: shown under the icon, and what type-select matches. */
  getItemLabel: (index: number) => string;
  /** A second line under the name, if any: what Finder's Show item info adds. */
  getItemDetail?: (index: number) => string | undefined;
  /** Renders what precedes the name on the label's line, if anything: a Finder tag dot. */
  renderTag?: (index: number) => ReactNode;
  /**
   * The id of the item at `index`, which is what the selection holds.
   * @default the index itself
   */
  getItemId?: (index: number) => string | number;
  /**
   * Side of the square icon box in points; Finder offers 16 to 512.
   * @default 64
   */
  iconSize?: number;
  /**
   * Width of an item's cell in points, which is also the widest a label gets. As many
   * columns as fit are laid out, a whole number of points apart, centred in the view.
   * @default iconSize + 17, and at least 103
   */
  cellWidth?: number;
  /**
   * Distance in points from one row of items to the next. The default holds the icon and
   * two lines of label.
   * @default iconSize + 52
   */
  rowHeight?: number;
  /** Ids of the selected items, controlled. */
  value?: (string | number)[];
  /** Ids of the items selected at first, when the view keeps its own selection. */
  defaultValue?: (string | number)[];
  /** Called with the ids of the selected items when the selection changes. */
  onValueChange?: (value: (string | number)[]) => void;
  /**
   * `"multiple"` adds Command-click to toggle, Shift to extend, Command-A, and Control with
   * the keys to move the current item without selecting it and Control-Space to toggle it;
   * `"single"` selects one item; `"none"` selects nothing and leaves the keys to scrolling.
   * @default "multiple"
   */
  selectionMode?: SelectionMode;
  /**
   * Called with the item's index on a double click, and on Return or Command-Down Arrow for
   * the current item: open it.
   */
  onItemAction?: (index: number) => void;
  /** Class of the root element. */
  className?: string;
}

const byIndex = (index: number): SelectionKey => index;

// The narrowest gap between two columns, and between a column and the view's edge.
const GAP = 8;

// One item. Memoised, so a selection change re-renders only the items whose state changed.
const Item = memo(function Item(props: {
  id: string;
  index: number;
  count: number;
  selected: boolean;
  label: string;
  detail?: string;
  render: (index: number) => ReactNode;
  itemId: string | number;
  tag?: (index: number) => ReactNode;
}) {
  const tag = props.tag?.(props.index);
  return (
    // biome-ignore lint/a11y/useFocusableInteractive: the listbox keeps focus and names the current option with aria-activedescendant
    <div
      role="option"
      id={props.id}
      aria-selected={props.selected}
      aria-setsize={props.count}
      aria-posinset={props.index + 1}
      data-index={props.index}
      data-item-id={props.itemId}
      className="mac-icon-view-item"
    >
      <span className="mac-icon-view-icon" aria-hidden="true">
        {props.render(props.index)}
      </span>
      <span className="mac-icon-view-label">
        {tag != null && <span className="mac-icon-view-tag">{tag}</span>}
        <span className="mac-icon-view-label-text">{props.label}</span>
      </span>
      {props.detail ? <span className="mac-icon-view-detail">{props.detail}</span> : null}
    </div>
  );
});

// The index of the item whose icon or label an event happened on, or -1.
const itemOf = (event: MouseEvent) =>
  Number((event.target as Element).closest<HTMLElement>("[data-index]")?.dataset.index ?? -1);
// A press or a double click on a control inside an item, on a control's label or in editable
// text is the control's own. Content marked contenteditable="false" is the item's.
const inControl = (event: MouseEvent) =>
  (event.target as Element).closest(
    "button,input,select,textarea,a,label,[contenteditable]:not([contenteditable=false])",
  );

/**
 * An icon view (Finder's icon view, NSCollectionView): `count` items, each an icon above its
 * name, in a grid that fills the width of a scroll view. Only the rows in view are rendered.
 * The scrolling element is the `listbox`; other props, `ref` included, go to the root.
 * `onKeyDown`, `onMouseDown` and `onDoubleClick` are called before the view acts and can
 * cancel it with `preventDefault()`.
 */
export function IconView({
  count,
  renderIcon,
  getItemLabel,
  getItemDetail,
  renderTag,
  getItemId = byIndex,
  iconSize = 64,
  cellWidth = Math.max(103, iconSize + 17),
  rowHeight = iconSize + 52,
  value: controlled,
  defaultValue,
  onValueChange,
  selectionMode = "multiple",
  onItemAction,
  className,
  onKeyDown,
  onMouseDown,
  onDoubleClick,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  ...props
}: IconViewProps) {
  const [value, setValue] = useControlled(controlled, defaultValue ?? [], onValueChange);
  // The id of the item last clicked or moved to, and of the item a Shift range starts at.
  const [active, setActive] = useState<SelectionKey>();
  const anchor = useRef<SelectionKey>(undefined);
  // The selection the user last made or moved the current item under: with it the current
  // item need not be a selected one. And the index the current item was last found at.
  const own = useRef<unknown>(null);
  const leadItem = useRef(-1);
  const typed = useRef<TypeSelectState>({ text: "", time: 0 });
  const id = useId();
  const selected = useMemo(() => new Set(value), [value]);
  const multiple = selectionMode === "multiple";

  // The width of the element that holds the items; 0 until it is measured. As many columns
  // as fit with the narrowest gap, then the same whole gap between them and to both edges.
  const [width, setWidth] = useState(0);
  const columns = Math.max(1, Math.floor((width - GAP) / (cellWidth + GAP)));
  const spare = width - columns * cellWidth;
  const gap = Math.max(0, Math.floor(spare / (columns + 1)));
  const items = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    const measure = () => setWidth(element.clientWidth);
    measure();
    return observeResize(element, measure);
  }, []);
  const rowCount = Math.ceil(count / columns);
  const [start, end, viewport, onScroll, reveal] = useVirtualRange(rowCount, rowHeight, {
    overscan: 3,
  });
  const first = start * columns;
  const last = Math.min(count, end * columns);

  // Items are known by id, so the current item and the start of a range survive reordering.
  const find = (key: SelectionKey | undefined) => {
    if (key !== undefined)
      for (let index = 0; index < count; index++) if (getItemId(index) === key) return index;
    return -1;
  };
  // The item the keyboard moves from and the listbox names as active: the one last clicked
  // or moved to, while the selection is the one it was set under or still holds it, and else
  // the first selected item. So a selection set or cleared from outside is followed.
  const leadKey =
    active !== undefined && (own.current === value || selected.has(active)) ? active : value[0];
  let lead = leadItem.current;
  if (leadKey === undefined) lead = -1;
  else if (lead < 0 || lead >= count || getItemId(lead) !== leadKey) lead = find(leadKey);
  leadItem.current = lead;

  // An item out of view is not rendered, and the listbox can name only a rendered item. So
  // while the listbox has the focus the current item's row is brought into view when the
  // item changes: after a key, and after a selection set from outside. A new number of
  // columns or row height moves it too.
  const focused = useRef<Element>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the current item or the grid changes
  useLayoutEffect(() => {
    if (focused.current === document.activeElement) reveal(Math.floor(lead / columns));
  }, [lead, columns, rowHeight]);

  const select = (index: number, toggle: boolean, extend: boolean) => {
    if (selectionMode === "none") return;
    // A range starts where the user's own last selection did, and else at the current item.
    const from = own.current === value ? find(anchor.current) : -1;
    const [next, origin] = nextSelection(
      selectionMode,
      value,
      from < 0 ? lead : from,
      index,
      getItemId,
      toggle,
      extend,
      count,
    );
    anchor.current = origin < 0 ? undefined : getItemId(origin);
    own.current = next;
    setActive(getItemId(index));
    setValue(next);
  };

  const cells: ReactNode[] = [];
  for (let index = first; index < last; index++) {
    const key = getItemId(index);
    cells.push(
      <Item
        // Ids are told apart by type too, as the selection does: 1 is not "1".
        key={typeof key + key}
        id={id + index}
        index={index}
        itemId={key}
        count={count}
        // No item is selected in a view without selection, whatever `value` names.
        selected={selectionMode !== "none" && selected.has(key)}
        label={getItemLabel(index)}
        detail={getItemDetail?.(index)}
        render={renderIcon}
        tag={renderTag}
      />,
    );
  }

  return (
    <ScrollView
      className={className ? `mac-icon-view ${className}` : "mac-icon-view"}
      viewportProps={{
        ref: viewport,
        // Rendered before the frame is painted, so a jump never shows an empty view.
        onScroll: () => flushSync(onScroll),
        role: "listbox",
        tabIndex: 0,
        "aria-label": label,
        "aria-labelledby": labelledBy,
        "aria-multiselectable": multiple || undefined,
        "aria-activedescendant": lead >= first && lead < last ? id + lead : undefined,
        // Focus from the keyboard brings a current item that is out of view into it. A press
        // leaves the view where it is.
        onFocus: (event) => {
          focused.current = event.currentTarget;
          if (event.currentTarget.matches(":focus-visible")) reveal(Math.floor(lead / columns));
        },
        onMouseDown: (event) => {
          onMouseDown?.(event);
          const index = itemOf(event);
          const toggle = event.metaKey || event.ctrlKey;
          if (event.button || event.defaultPrevented || inControl(event)) return;
          if (index >= 0) select(index, toggle, event.shiftKey);
          // A click on the background deselects, as in Finder.
          else if (value.length && !toggle && !event.shiftKey) setValue([]);
        },
        onDoubleClick: (event) => {
          onDoubleClick?.(event);
          const index = itemOf(event);
          if (index >= 0 && !event.defaultPrevented && !inControl(event)) onItemAction?.(index);
        },
        onKeyDown: (event) => {
          onKeyDown?.(event);
          const view = event.currentTarget;
          // Keys pressed in a control inside an item are the control's.
          if (
            event.defaultPrevented ||
            selectionMode === "none" ||
            !count ||
            event.target !== view ||
            isSystemArrow(event)
          )
            return;
          const from = lead;
          // With Control the keys move the current item and leave the selection, and Space
          // adds the current item to it or takes it out.
          const move = multiple && event.ctrlKey && !event.shiftKey;
          const forward = getComputedStyle(view).direction === "rtl" ? -1 : 1;
          const steps: Record<string, number> = {
            ArrowRight: forward,
            ArrowLeft: -forward,
            ArrowDown: columns,
            ArrowUp: -columns,
            Home: Number.NEGATIVE_INFINITY,
            End: Number.POSITIVE_INFINITY,
          };
          const step = steps[event.key];
          let next = -1;
          if (event.key === "Enter" || (event.metaKey && event.key === "ArrowDown")) {
            if (from >= 0) onItemAction?.(from);
            event.preventDefault();
          } else if (step) {
            next = from + step;
            // With nothing selected the arrows start at the first or the last item. Home
            // and End go there from anywhere: their steps are clamped below.
            if (from < 0 && Number.isFinite(step)) next = step > 0 ? 0 : count - 1;
            // Down Arrow above a short last row goes to the last item; otherwise the
            // selection stays inside the grid.
            else if (step === columns && next >= count)
              next = from < (rowCount - 1) * columns ? count - 1 : from;
            else if (step === -columns && next < 0) next = from;
            next = Math.max(0, Math.min(count - 1, next));
          } else if (move && event.key === " ") next = from;
          else if (
            multiple &&
            (event.metaKey || event.ctrlKey) &&
            !event.shiftKey &&
            event.key === "a"
          ) {
            event.preventDefault();
            setValue(Array.from({ length: count }, (_, index) => getItemId(index)));
          } else next = typeSelect(typed.current, event, count, getItemLabel, from);
          if (next < 0) return;
          event.preventDefault();
          if (move && step) {
            // Under a selection set from outside, a range starts at the item it made current.
            if (own.current !== value) anchor.current = leadKey;
            own.current = value;
            setActive(getItemId(next));
          } else select(next, move, !!step && event.shiftKey);
          reveal(Math.floor(next / columns));
        },
      }}
      {...props}
    >
      <div
        ref={items}
        className="mac-icon-view-items"
        style={
          {
            height: rowCount * rowHeight,
            paddingTop: start * rowHeight,
            // An odd point left over goes to the trailing edge: the grid is on whole points.
            paddingInlineEnd: width && (spare - (columns - 1) * gap) & 1,
            "--_columns": width ? columns : undefined,
            "--_gap": width ? `${gap}px` : undefined,
            "--_icon": `${iconSize}px`,
            "--_cell": `${cellWidth}px`,
            "--_row": `${rowHeight}px`,
          } as CSSProperties
        }
      >
        {cells}
      </div>
    </ScrollView>
  );
}

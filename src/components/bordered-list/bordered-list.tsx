"use client";

import {
  type ComponentProps,
  type CSSProperties,
  createContext,
  type ReactNode,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { nextSelection, type SelectionMode } from "../../lib/selection";
import { isSystemArrow } from "../../lib/system-arrows";
import { typeSelect } from "../../lib/type-select";
import { useControlled } from "../../lib/use-controlled";
import { GradientButtonFiller, GradientButtonGroup } from "../gradient-button";
import { ScrollView, type ScrollViewProps } from "../scroll-view";
import "./bordered-list.tokens.css";
import "./bordered-list.css";

export interface BorderedListProps extends ComponentProps<"div"> {
  /**
   * The gradient buttons under the list: usually add and remove, sometimes an action button.
   * They are placed in a `GradientButtonGroup`.
   */
  footer?: ReactNode;
  /**
   * `"attached"` joins the buttons to the list as a bar that runs to its trailing edge.
   * `"detached"` puts them 8 pt below the list as a control of their own.
   * @default "attached"
   */
  footerPlacement?: "attached" | "detached";
  /** Names the group of footer buttons for assistive technology, for example "Edit services". */
  footerLabel?: string;
  /**
   * The look of the footer's bar, the `variant` of its `GradientButtonGroup`: `"network"` is
   * the bar of the Network pane, lighter in Dark Aqua than every other pane's.
   * @default "standard"
   */
  footerVariant?: "standard" | "network";
}

/**
 * The bordered list of a preference pane (a bezel-bordered NSScrollView with a gradient
 * button bar): a 1 pt frame around a list, with its buttons directly below.
 * Its child is the list: `BorderedListRows`, or another view such as a table view.
 */
export function BorderedList({
  footer,
  footerPlacement = "attached",
  footerLabel,
  footerVariant,
  className,
  children,
  ...props
}: BorderedListProps) {
  const hasFooter = footer != null && footer !== false;
  return (
    <div
      data-footer={hasFooter ? footerPlacement : undefined}
      className={className ? `mac-bordered-list ${className}` : "mac-bordered-list"}
      {...props}
    >
      <div className="mac-bordered-list-frame">{children}</div>
      {hasFooter && (
        <GradientButtonGroup
          aria-label={footerLabel}
          variant={footerVariant}
          className="mac-bordered-list-footer"
        >
          {footer}
          {footerPlacement === "attached" && <GradientButtonFiller />}
        </GradientButtonGroup>
      )}
    </div>
  );
}

// The values of the selected rows, which rows read when they render. A change of selection
// does not render them again: the list moves aria-selected between the rows in the document.
const Selected = createContext<{ value: readonly string[] }>({ value: [] });
// A press on one of these inside a row is its own, not the row's. Content marked
// contenteditable="false" is not editable, and is the row's.
const CONTROLS =
  "button,input,select,textarea,a,label,[contenteditable]:not([contenteditable=false])";
const OPTIONS = "[role=option]:not([aria-disabled=true])";

export interface BorderedListRowsProps
  extends Omit<ScrollViewProps, "axis" | "className" | "defaultValue" | "viewportProps"> {
  /**
   * How many rows can be selected.
   * @default "single"
   */
  selectionMode?: SelectionMode;
  /** Values of the selected rows (controlled). */
  value?: readonly string[];
  /** Values of the rows selected at first (uncontrolled). */
  defaultValue?: readonly string[];
  /** Called with the values of the selected rows when the selection changes. */
  onValueChange?: (value: readonly string[]) => void;
  /**
   * Smallest height of a row in points. Catalina's panes use 18, 20, 22, 34, 41 and 42.
   * @default 20
   */
  rowHeight?: number;
  /**
   * Stripes every second row and the space below the last one. For rows of one height.
   * @default false
   */
  alternatingRows?: boolean;
  /** Called with a row's value for a double click on it, or Return while it is selected. */
  onRowAction?: (value: string) => void;
  /** Class of the root element. */
  className?: string;
}

/**
 * The rows of a bordered list: a scrolling `listbox` and one tab stop. Its children are
 * `BorderedListRow`s and `BorderedListGroupRow`s.
 */
export function BorderedListRows({
  selectionMode = "single",
  value,
  defaultValue,
  onValueChange,
  rowHeight = 20,
  alternatingRows = false,
  onRowAction,
  className,
  children,
  onFocus,
  onKeyDown,
  onMouseDown,
  onDoubleClick,
  ...props
}: BorderedListRowsProps) {
  const [selected, setSelected] = useControlled(value, defaultValue ?? [], onValueChange);
  // The element id of the row the keyboard moves from, and of the row a Shift range starts at.
  const [lead, setLead] = useState<string>();
  const anchor = useRef<string>(undefined);
  // The selection the user last made or moved the current row under: with it the current
  // row need not be a selected one.
  const own = useRef<unknown>(null);
  const typed = useRef({ text: "", time: 0 });
  const content = useRef<HTMLDivElement>(null);
  const [store] = useState({ value: selected });
  // No row is selected in a list without selection, whatever `value` names.
  store.value = selectionMode === "none" ? [] : selected;
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the selection or its mode changes; the store is read then
  useLayoutEffect(() => {
    const chosen = new Set(store.value);
    for (const row of content.current?.querySelectorAll<HTMLElement>("[role=option]") ?? [])
      row.setAttribute("aria-selected", `${chosen.has(row.dataset.value ?? "")}`);
  }, [selected, selectionMode]);
  // The current row is the selected one until a key or a click moves it, and again when the
  // row it was has gone or has become disabled, or the selection was set from outside and
  // does not hold it. The row is looked up by id, which can be any text the caller chose.
  // Gives the row that is current from now on.
  const settle = (root: Element | null) => {
    let row = document.getElementById(lead ?? "");
    if (
      root &&
      (!row?.matches(OPTIONS) ||
        !root.contains(row) ||
        (own.current !== selected && !row.matches("[aria-selected=true]")))
    ) {
      row = root.querySelector<HTMLElement>(`[aria-selected=true]${OPTIONS}`);
      setLead(row?.id);
    }
    return row;
  };
  // Rows come, go and are disabled without the list rendering, so the list watches them: a
  // selected row that arrives becomes the current one, and a current row that goes is replaced.
  useLayoutEffect(() => {
    const root = content.current;
    if (!root) return;
    settle(root);
    const observer = new MutationObserver(() => settle(root));
    observer.observe(root, { childList: true, subtree: true, attributeFilter: ["aria-disabled"] });
    return () => observer.disconnect();
  });

  // Rows are read from the document: they can be any mix of rows and group rows. With `move`
  // the row becomes the current one and the selection stays as it is.
  const select = (
    rows: HTMLElement[],
    index: number,
    toggle: boolean,
    extend: boolean,
    move?: boolean,
  ) => {
    const row = rows[index];
    if (!row) return;
    // A range starts where the user's own last selection did, and else at the current row:
    // while any row is selected, the list keeps one of them current.
    const rowOf = (id?: string) => rows.findIndex((other) => other.id === id);
    let from = own.current === selected ? rowOf(anchor.current) : -1;
    if (from < 0) from = rowOf(lead);
    // Under a selection set from outside, a range starts at the row that selection made current.
    if (own.current !== selected) anchor.current = lead;
    setLead(row.id);
    own.current = selected;
    row.scrollIntoView?.({ block: "nearest" });
    if (selectionMode === "none" || move) return;
    const [next, at] = nextSelection(
      selectionMode,
      selected,
      from,
      index,
      (at) => rows[at]?.dataset.value ?? "",
      toggle,
      extend,
      rows.length,
    );
    anchor.current = rows[at]?.id;
    own.current = next;
    setSelected(next as string[]);
  };

  return (
    <ScrollView
      role="listbox"
      aria-multiselectable={selectionMode === "multiple" || undefined}
      aria-activedescendant={lead}
      tabIndex={0}
      data-alternating={alternatingRows ? "" : undefined}
      className={className ? `mac-bordered-list-rows ${className}` : "mac-bordered-list-rows"}
      // The scrolling element is a group of the list, and not a tab stop of its own.
      viewportProps={{ tabIndex: -1, role: "group" }}
      onFocus={(event) => {
        onFocus?.(event);
        const row = settle(event.currentTarget);
        // Focus from the keyboard brings the current row into view. A press leaves the list
        // where it is.
        if (event.currentTarget.matches(":focus-visible"))
          row?.scrollIntoView?.({ block: "nearest" });
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || event.target !== event.currentTarget || isSystemArrow(event))
          return;
        const rows = [...event.currentTarget.querySelectorAll<HTMLElement>(OPTIONS)];
        const at = rows.findIndex((row) => row.id === lead);
        const { key } = event;
        // A page is the rows in view less one, in rows of the smallest height.
        const page = Math.max(1, Math.floor(event.currentTarget.clientHeight / rowHeight) - 1);
        const last = rows.length - 1;
        // With Control the keys move the current row and leave the selection, and Space adds
        // the current row to it or takes it out.
        const move = selectionMode === "multiple" && event.ctrlKey && !event.shiftKey;
        let to = -1;
        if (key === "ArrowDown") to = Math.min(at + 1, last);
        else if (key === "ArrowUp") to = at < 0 ? last : Math.max(at - 1, 0);
        else if (key === "PageDown") to = Math.min(at + page, last);
        else if (key === "PageUp") to = Math.max(at - page, 0);
        else if (key === "Home") to = 0;
        else if (key === "End") to = last;
        else if (key === "Enter" && rows[at]) onRowAction?.(rows[at].dataset.value ?? "");
        else if (move && key === " ") select(rows, at, true, false);
        else if (key === "a" && (event.metaKey || event.ctrlKey) && selectionMode === "multiple")
          setSelected(rows.map((row) => row.dataset.value ?? ""));
        else {
          to = typeSelect(
            typed.current,
            event,
            rows.length,
            (index) => {
              // Type-select asks only for rows the list has, and an element's text is never null.
              const row = rows[index] as HTMLElement;
              return row.dataset.label ?? (row.textContent as string);
            },
            at,
          );
          if (to < 0) return;
        }
        if (to >= 0) select(rows, to, false, event.shiftKey && key.length > 1, move);
        event.preventDefault();
      }}
      onMouseDown={(event) => {
        onMouseDown?.(event);
        const target = event.target as Element;
        if (event.button || event.defaultPrevented || target.closest(CONTROLS)) return;
        // The list takes the focus, not the scrolling element under the pointer.
        event.preventDefault();
        event.currentTarget.focus();
        const rows = [...event.currentTarget.querySelectorAll<HTMLElement>(OPTIONS)];
        const row = target.closest<HTMLElement>(OPTIONS);
        if (row) select(rows, rows.indexOf(row), event.metaKey || event.ctrlKey, event.shiftKey);
      }}
      onDoubleClick={(event) => {
        onDoubleClick?.(event);
        const target = event.target as Element;
        const row = target.closest<HTMLElement>(OPTIONS);
        if (row && !event.defaultPrevented && !target.closest(CONTROLS))
          onRowAction?.(row.dataset.value ?? "");
      }}
      {...props}
    >
      <div
        ref={content}
        role="presentation"
        className="mac-bordered-list-content"
        style={{ "--_row": `${rowHeight}px` } as CSSProperties}
      >
        <Selected.Provider value={store}>{children}</Selected.Provider>
      </div>
    </ScrollView>
  );
}

export interface BorderedListRowProps extends Omit<ComponentProps<"div">, "title"> {
  /** Identifies the row in the selection. */
  value: string;
  /** The row's main line, in 13 pt text. */
  title?: ReactNode;
  /** A second line under the title, in 11 pt secondary text. */
  subtitle?: ReactNode;
  /**
   * Content before the text: a status dot or an icon. Not a control: a row is an `option`,
   * and controls inside one are not exposed to assistive technology.
   */
  leading?: ReactNode;
  /** Content at the trailing edge: an icon. */
  trailing?: ReactNode;
  /** Text for type-select when the title is not a string. */
  textValue?: string;
  /**
   * A row that cannot be selected; its text is dimmed.
   * @default false
   */
  disabled?: boolean;
}

/** One row of a bordered list: an `option`. Children are rendered after the title lines. */
export function BorderedListRow({
  value,
  title,
  subtitle,
  leading,
  trailing,
  textValue,
  disabled = false,
  className,
  children,
  ...props
}: BorderedListRowProps) {
  const id = useId();
  const selected = useContext(Selected).value.includes(value);
  return (
    // biome-ignore lint/a11y/useFocusableInteractive: the listbox keeps the focus and names the active row with aria-activedescendant
    <div
      role="option"
      id={id}
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      data-value={value}
      data-label={textValue ?? (typeof title === "string" ? title : undefined)}
      className={className ? `mac-bordered-list-row ${className}` : "mac-bordered-list-row"}
      {...props}
    >
      {leading != null && <span className="mac-bordered-list-row-leading">{leading}</span>}
      <span className="mac-bordered-list-row-text">
        {title != null && <span className="mac-bordered-list-row-title">{title}</span>}
        {subtitle != null && <span className="mac-bordered-list-row-subtitle">{subtitle}</span>}
        {children}
      </span>
      {trailing != null && <span className="mac-bordered-list-row-trailing">{trailing}</span>}
    </div>
  );
}

export interface BorderedListGroupRowProps extends ComponentProps<"div"> {}

/** A group heading between rows (an NSTableView group row): small, dimmed, not selectable. */
export function BorderedListGroupRow({ className, ...props }: BorderedListGroupRowProps) {
  return (
    <div
      role="presentation"
      className={
        className ? `mac-bordered-list-group-row ${className}` : "mac-bordered-list-group-row"
      }
      {...props}
    />
  );
}

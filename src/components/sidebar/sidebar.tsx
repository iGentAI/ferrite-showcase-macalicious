"use client";

import {
  type ComponentProps,
  type CSSProperties,
  createContext,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { typeSelect } from "../../lib/type-select";
import { DisclosureTriangle } from "../disclosure-triangle";
import { ScrollView } from "../scroll-view";
import "./sidebar.tokens.css";
import "./sidebar.css";

// The selection, which rows read when they render. A change of selection does not render
// them again: the sidebar moves aria-selected between the two rows it concerns.
function createStore(id: string, value: string | null) {
  return { id, value, text: "", time: 0 };
}

const StoreContext = createContext(createStore("", null));
const LevelContext = createContext(1);

// A disabled row has no data-value, so it is never selected.
const ROWS = "[data-value]";
const SELECTED = '[aria-selected="true"]';
const TRIANGLE = ".mac-sidebar-triangle";
// A row's id; its group of child rows, its label and its accessory append "/g", "/l" and
// "/a". A value is any
// text: every character that is not a letter, a digit or "_" becomes "%", its code and ".",
// so no two values share an id and no row's id is another's group or label id.
const rowId = (tree: string, value: string) =>
  `${tree}-${value.replace(/\W/g, (character) => `%${character.charCodeAt(0)}.`)}`;

export interface SidebarProps extends Omit<ComponentProps<"div">, "defaultValue"> {
  /** The `value` of the selected item (controlled); `null` for no selection. */
  value?: string | null;
  /**
   * The `value` of the item selected at first (uncontrolled).
   * @default null
   */
  defaultValue?: string | null;
  /** Called with the `value` of the item the user selects. */
  onValueChange?: (value: string) => void;
  /**
   * The system-wide “Sidebar icon size” (NSTableView.rowSizeStyle): rows of 20, 24 or 32 pt
   * with 16, 18 or 32 pt icons. This is not the control size of other components.
   * @default "medium"
   */
  size?: "small" | "medium" | "large";
  /**
   * `"translucent"` is the vibrant sidebar material, which blurs what is behind the pane in
   * the page; `"opaque"` is the same surface as captured over a neutral window. Use opaque
   * when nothing is behind the pane, in a panel, or when a window has two sidebars.
   * @default "translucent"
   */
  material?: "translucent" | "opaque";
  /**
   * Pinned over the scrolling list, on the pane's material and outside the tree: a switch
   * between lists, as in Safari's sidebar, or a search field.
   * @default undefined
   */
  header?: ReactNode;
  /** Pinned under the scrolling list, outside the tree: a `SidebarFooter`. */
  footer?: ReactNode;
}

/**
 * A sidebar or source list (NSOutlineView, source-list style). The root is the pane; the
 * tree inside it scrolls, is the one tab stop and takes `aria-label` and `aria-labelledby`.
 * `onMouseDown` and `onKeyDown` are called on the tree before the sidebar acts and can cancel
 * it with `preventDefault()`.
 */
export function Sidebar({
  value,
  defaultValue = null,
  onValueChange,
  size = "medium",
  material = "translucent",
  header,
  footer,
  className,
  children,
  onMouseDown: callerMouseDown,
  onKeyDown: callerKeyDown,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: SidebarProps) {
  const id = useId();
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const selected = value === undefined ? uncontrolled : value;
  const [store] = useState(() => createStore(id, selected));
  const tree = useRef<HTMLDivElement>(null);
  // Rows that render from now on read the new selection; the rows in the document that it
  // concerns are updated below, without rendering any row.
  store.value = selected;

  // The selected row is named as the active one only while it is in the tree: a collapsed
  // row or section may hide it, and a disabled row is never active.
  const sync = () => {
    const now = store.value == null ? "" : rowId(id, store.value);
    if (document.getElementById(now)?.hasAttribute("data-value"))
      tree.current?.setAttribute("aria-activedescendant", now);
    else tree.current?.removeAttribute("aria-activedescendant");
  };

  // A disabled row is never selected, whatever the value names.
  useLayoutEffect(() => {
    const now = selected == null ? "" : rowId(id, selected);
    for (const row of tree.current?.querySelectorAll(`[role=treeitem]${SELECTED}`) ?? [])
      if (row.id !== now) row.setAttribute("aria-selected", "false");
    const row = document.getElementById(now);
    if (row?.hasAttribute("data-value")) row.setAttribute("aria-selected", "true");
    sync();
  });

  // Rows come, go and are disabled without the sidebar rendering: a row or a section that
  // is expanded or collapsed renders alone. One observer of the tree hears of them all.
  // biome-ignore lint/correctness/useExhaustiveDependencies: sync reads the store and the tree, which never change
  useLayoutEffect(() => {
    const observer = new MutationObserver(sync);
    if (tree.current)
      observer.observe(tree.current, {
        childList: true,
        subtree: true,
        attributeFilter: ["data-value"],
      });
    return () => observer.disconnect();
  }, []);

  const select = (row: Element | null | undefined) => {
    const next = row?.getAttribute("data-value");
    if (!row || next == null || next === selected) return;
    if (value === undefined) setUncontrolled(next);
    onValueChange?.(next);
    row.scrollIntoView?.({ block: "nearest" });
  };

  // Mouse down selects, as in AppKit. A disclosure triangle does not select its row or take
  // the focus, unless collapsing the row hides the selection. A press on any other control
  // in a row (in its accessory, say), or in editable text, is the control's own; content
  // marked contenteditable="false" is the row's. The caller's handler runs first and can
  // cancel the press.
  const onMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    callerMouseDown?.(event);
    const target = event.target as Element;
    const row = target.closest(ROWS);
    const triangle = target.closest(TRIANGLE);
    if (event.defaultPrevented || event.button) return;
    if (triangle) event.preventDefault();
    else if (
      target.closest(
        "button,input,select,textarea,a,label,[contenteditable]:not([contenteditable=false])",
      )
    )
      return;
    if (!triangle || row?.nextElementSibling?.querySelector(SELECTED)) select(row);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    callerKeyDown?.(event);
    const { key } = event;
    // Keys pressed in a control inside a row are the control's.
    if (
      event.defaultPrevented ||
      event.target !== event.currentTarget ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey
    )
      return;
    const rows = [...event.currentTarget.querySelectorAll(ROWS)];
    const index = rows.findIndex((row) => row.matches(SELECTED));
    const row = rows[index];
    let next: Element | null | undefined;
    if (key === "ArrowDown") next = rows[index + 1];
    else if (key === "ArrowUp") next = rows.at(index < 0 ? -1 : Math.max(index - 1, 0));
    else if (key === "Home") next = rows[0];
    else if (key === "End") next = rows.at(-1);
    else if (key === "ArrowLeft" || key === "ArrowRight") {
      // Left collapses or goes to the parent; Right expands or goes to the first child.
      // In a right-to-left layout the two swap.
      const left =
        key ===
        (getComputedStyle(event.currentTarget).direction === "rtl" ? "ArrowRight" : "ArrowLeft");
      const expanded = row?.getAttribute("aria-expanded");
      if (expanded === `${left}`) row?.querySelector<HTMLElement>(TRIANGLE)?.click();
      else if (left) next = row?.parentElement?.previousElementSibling?.closest(ROWS);
      else if (expanded) next = row?.nextElementSibling?.querySelector(ROWS);
    } else {
      // Type-select, from the selected row on; repeating a letter steps through its matches.
      const at = typeSelect(
        store,
        event,
        rows.length,
        (at) => rows[at]?.querySelector(".mac-sidebar-label")?.textContent ?? "",
        index,
      );
      if (at < 0) return;
      next = rows[at];
    }
    event.preventDefault();
    select(next);
  };

  return (
    <div
      data-size={size}
      data-material={material}
      className={className ? `mac-sidebar ${className}` : "mac-sidebar"}
      {...props}
    >
      {header}
      <ScrollView
        className="mac-sidebar-scroll"
        viewportProps={{
          ref: tree,
          role: "tree",
          tabIndex: 0,
          "aria-label": ariaLabel,
          "aria-labelledby": ariaLabelledBy,
          className: "mac-sidebar-tree",
          onMouseDown,
          onKeyDown,
        }}
      >
        <StoreContext value={store}>{children}</StoreContext>
      </ScrollView>
      {footer}
    </div>
  );
}

export interface SidebarSectionProps extends Omit<ComponentProps<"div">, "title"> {
  /** The section's header, in title case as authored (“Favorites”). It names the group. */
  title: ReactNode;
  /**
   * Hides the section's rows and leaves its header.
   * @default false
   */
  collapsed?: boolean;
}

/** A titled group of rows in a `Sidebar`. The header cannot be selected. */
export function SidebarSection({
  title,
  collapsed = false,
  className,
  children,
  ...props
}: SidebarSectionProps) {
  const id = useId();
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset is not allowed inside a tree
    <div
      role="group"
      aria-labelledby={id}
      className={className ? `mac-sidebar-section ${className}` : "mac-sidebar-section"}
      {...props}
    >
      <div id={id} className="mac-sidebar-header">
        {title}
      </div>
      {!collapsed && children}
    </div>
  );
}

export interface SidebarItemProps extends Omit<ComponentProps<"div">, "id"> {
  /** Identifies the item in the sidebar's `value`. Unique within the sidebar. */
  value: string;
  /** The row's text. Type-select matches its start. */
  label: ReactNode;
  /** A glyph before the label, drawn in the row's tint (`currentColor`), or a `TagDot`. */
  icon?: ReactNode;
  /** Content at the trailing edge, in the row's tint: a `SidebarBadge`, a count, a glyph. */
  accessory?: ReactNode;
  /** Whether the child items are shown (controlled). Only for an item with children. */
  expanded?: boolean;
  /**
   * Whether the child items are shown at first (uncontrolled).
   * @default false
   */
  defaultExpanded?: boolean;
  /** Called with the new state when the item is expanded or collapsed. */
  onExpandedChange?: (expanded: boolean) => void;
  /**
   * A disabled row is dimmed and cannot be selected.
   * @default false
   */
  disabled?: boolean;
  /** Child items: they make this row an outline row with a disclosure triangle. */
  children?: ReactNode;
}

/**
 * A row of a `Sidebar`; child items make it an outline row. Attributes and `ref` go to the
 * row element, whose `id` is derived from `value`.
 */
export function SidebarItem({
  value,
  label,
  icon,
  accessory,
  expanded,
  defaultExpanded = false,
  onExpandedChange,
  disabled = false,
  className,
  style,
  children,
  ...props
}: SidebarItemProps) {
  const store = useContext(StoreContext);
  const level = useContext(LevelContext);
  const selected = store.value === value && !disabled;
  const [uncontrolled, setUncontrolled] = useState(defaultExpanded);
  const open = children == null ? undefined : (expanded ?? uncontrolled);
  return (
    <>
      {/* biome-ignore lint/a11y/useFocusableInteractive: the tree keeps the focus and names the selected row with aria-activedescendant */}
      <div
        role="treeitem"
        aria-selected={selected}
        aria-expanded={open}
        aria-level={level}
        // The group of child rows follows the row in the document; this makes it the row's.
        aria-owns={open ? `${rowId(store.id, value)}/g` : undefined}
        // Its name is then its own label, not the text of the rows inside it. A row with an
        // accessory is named by both, which keeps them a space apart: “Work 5”, not “Work5”.
        aria-labelledby={
          accessory != null
            ? `${rowId(store.id, value)}/l ${rowId(store.id, value)}/a`
            : open
              ? `${rowId(store.id, value)}/l`
              : undefined
        }
        aria-disabled={disabled || undefined}
        data-value={disabled ? undefined : value}
        className={className ? `mac-sidebar-item ${className}` : "mac-sidebar-item"}
        style={level > 1 ? ({ "--_level": level - 1, ...style } as CSSProperties) : style}
        {...props}
        id={rowId(store.id, value)}
      >
        {open !== undefined && (
          <DisclosureTriangle
            aria-hidden="true"
            tabIndex={-1}
            className="mac-sidebar-triangle"
            expanded={open}
            onExpandedChange={(next) => {
              setUncontrolled(next);
              onExpandedChange?.(next);
            }}
          />
        )}
        {icon != null && <span className="mac-sidebar-icon">{icon}</span>}
        <span
          id={open || accessory != null ? `${rowId(store.id, value)}/l` : undefined}
          className="mac-sidebar-label"
        >
          {label}
        </span>
        {accessory != null && (
          <span id={`${rowId(store.id, value)}/a`} className="mac-sidebar-accessory">
            {accessory}
          </span>
        )}
      </div>
      {open && (
        // biome-ignore lint/a11y/useSemanticElements: the children of a tree item are a group
        <div role="group" id={`${rowId(store.id, value)}/g`}>
          <LevelContext value={level + 1}>{children}</LevelContext>
        </div>
      )}
    </>
  );
}

export interface SidebarFooterProps extends ComponentProps<"button"> {
  /**
   * Draws the plus cut out of a filled disc, as Reminders' “Add List” has it, where the
   * default is a plus in a ring (Notes' “New Folder”).
   * @default false
   */
  filled?: boolean;
}

/** The borderless button under the list (“New Folder”): pass it as the sidebar's `footer`. */
export function SidebarFooter({ filled = false, className, ...props }: SidebarFooterProps) {
  return (
    <button
      type="button"
      data-filled={filled ? "" : undefined}
      className={className ? `mac-sidebar-footer ${className}` : "mac-sidebar-footer"}
      {...props}
    />
  );
}

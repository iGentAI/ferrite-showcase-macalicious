"use client";

import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { type KeyboardEvent, type Ref, type RefObject, useRef } from "react";
import { withClassName } from "../../lib/cn";
import type { ControlSize } from "../../lib/control-size";
import "./tab-view.tokens.css";
import "./tab-view.css";

export interface TabViewProps extends Omit<BaseTabs.Root.Props, "ref" | "orientation"> {
  /**
   * Side of the content box on which the tab strip sits (NSTabView.tabPosition). `"left"` and
   * `"right"` turn the strip on its side and make the arrow keys Up and Down. With `"none"`
   * render no `TabViewList` and switch panes with `value`.
   * @default "top"
   */
  tabPosition?: "top" | "bottom" | "left" | "right" | "none";
  /**
   * Border of the content area (NSTabView.tabViewBorderType): `"bezel"` is the box surface,
   * `"line"` a plain one-point line, `"none"` nothing.
   * @default "bezel"
   */
  border?: "bezel" | "line" | "none";
  /**
   * AppKit control size of the tab strip.
   * @default "regular"
   */
  size?: ControlSize;
  /** Ref to the rendered element. */
  ref?: Ref<HTMLDivElement>;
}

/*
 * How tab-view.css draws it (kept here; the stylesheet is near its size budget).
 *
 * - The root is a grid: one track for the strip and one for the panes. `data-tab-position`
 *   swaps the tracks and sets a handful of private variables.
 * - The content box is the three `.mac-tab-view-box` spans below. Each is a grid item that
 *   only clips (clip-path); its ::before is the whole box, placed against the root. Part
 *   "body" shows the box beside the panes, parts "a" and "b" the pieces either side of the
 *   strip. Nothing is painted behind the strip: in Dark Aqua the strip's bezel is translucent,
 *   and the capture shows the window through it, not the box or its border.
 * - The strip's box is its alignment rectangle; the bezel is one hairline inside it, and the
 *   parts are clipped to reach that hairline.
 * - The bezel is the shared recipe of tokens/controls.css built from its parts, so that its
 *   gradient, highlight and shadow can turn with a strip on the left or right, as in AppKit.
 *   For top tabs it equals --mac-bezel-* and --mac-bezel-accent-*.
 * - Side tabs use vertical writing: the segments stack and the titles read top to bottom on
 *   the right and bottom to top on the left. A right strip is vertical-rl and a left strip
 *   vertical-lr, so block-start is the strip's outer edge on either side and the tabs' edge
 *   colours need no rule per side.
 * - What depends on `data-tab-position` or `data-border` is selected with child combinators,
 *   or carried by a private variable that every root sets, so that a tab view in a pane of
 *   another keeps its own position and border. `TabViewList` and `TabViewPanel` are items of
 *   the root's grid and must be its direct children.
 */

/** During one Control-Tab: each value already reported, and whether that change was cancelled. */
type Told = RefObject<[value: unknown, cancelled: boolean][] | null>;

/**
 * Control-Tab and Control-Shift-Tab select the next and the previous tab, wrapping round,
 * from anywhere in the tab view, as in AppKit. A browser keeps these keys for its own tabs, so
 * the page only receives them where there are none: an installed web app, an embedded web
 * view. The keys belong to the innermost tab view around the element they come from: a tab
 * view in a pane keeps them, even when it has no tab to go to, and so does a popup rendered
 * outside the tab view.
 */
function cycleTabs(event: KeyboardEvent<HTMLDivElement>, told: Told) {
  if (event.defaultPrevented || event.key !== "Tab" || !event.ctrlKey) return;
  if (event.altKey || event.metaKey) return;
  const root = event.currentTarget;
  if ((event.target as Element).closest(".mac-tab-view") !== root) return;
  const tabs = Array.from(root.querySelectorAll<HTMLElement>('[role="tab"]')).filter(
    (tab) =>
      tab.closest(".mac-tab-view") === root &&
      !tab.hasAttribute("data-disabled") &&
      tab.getAttribute("aria-disabled") !== "true",
  );
  if (tabs.length === 0) return;
  event.preventDefault();
  const selected = tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true");
  const step = event.shiftKey ? -1 : 1;
  // From no selected tab, forwards goes to the first tab and backwards to the last.
  const from = selected === -1 && step === -1 ? 0 : selected;
  const next = tabs[(from + step + tabs.length) % tabs.length] as HTMLElement;
  // Keyboard focus follows the selection when it is in the strip, which is one tab stop, and
  // when it is in a pane of this tab view: that pane is about to be hidden, and focus left in
  // it would fall back to the document, out of reach of the next Control-Tab. The focused
  // element is compared by identity and containment, not by its class: a tab view rendered
  // into another document has elements of that document's own HTMLElement.
  const active = root.ownerDocument.activeElement;
  const moves =
    active != null &&
    (tabs.includes(active as HTMLElement) ||
      (next !== tabs[selected] &&
        Array.from(root.querySelectorAll('[role="tabpanel"]')).some(
          (pane) => pane.closest(".mac-tab-view") === root && pane.contains(active),
        )));
  // Focusing a tab selects it when the strip activates on focus, and the click selects it
  // whether it does or not: the two are one selection, reported once (see TabView).
  told.current = [];
  try {
    if (moves) next.focus();
    next.click();
  } finally {
    told.current = null;
  }
}

/**
 * A tab view (NSTabView): several panes that share one area, with a strip of tabs centred on
 * the border of a box.
 *
 * Built on Base UI's Tabs, so it accepts `value`, `defaultValue` and `onValueChange` and
 * supplies the tab semantics and the arrow keys; Control-Tab and Control-Shift-Tab are added
 * here. Compose it from `TabViewList`, `TabViewTab` and `TabViewPanel`.
 */
export function TabView({
  tabPosition = "top",
  border = "bezel",
  size = "regular",
  className,
  children,
  onKeyDown,
  onValueChange,
  ...props
}: TabViewProps) {
  const told: Told = useRef<[unknown, boolean][] | null>(null);
  return (
    <BaseTabs.Root
      orientation={tabPosition === "left" || tabPosition === "right" ? "vertical" : "horizontal"}
      data-tab-position={tabPosition}
      data-border={border}
      data-size={size}
      className={withClassName("mac-tab-view", className)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        cycleTabs(event, told);
      }}
      onValueChange={(value, details) => {
        // One Control-Tab can ask for the same tab twice, by focus and by click: tell once,
        // and keep the answer if the first request was cancelled.
        const seen = told.current;
        const earlier = seen?.find((entry) => entry[0] === value);
        if (earlier) {
          if (earlier[1]) details.cancel();
          return;
        }
        onValueChange?.(value, details);
        seen?.push([value, details.isCanceled]);
      }}
      {...props}
    >
      {/* The content box, in three clipped parts that leave the strip's place empty. */}
      <span className="mac-tab-view-box" data-part="a" aria-hidden="true" />
      <span className="mac-tab-view-box" data-part="b" aria-hidden="true" />
      <span className="mac-tab-view-box" data-part="body" aria-hidden="true" />
      {children}
    </BaseTabs.Root>
  );
}

export interface TabViewListProps extends Omit<BaseTabs.List.Props, "ref"> {
  /**
   * Whether moving focus to a tab with the arrow keys also selects it, as in AppKit. When
   * false, the arrow keys only move focus and Space or Return selects.
   * @default true
   */
  activateOnFocus?: boolean;
  /** Ref to the rendered element. */
  ref?: Ref<HTMLDivElement>;
}

/** The strip of tabs: one rounded bezel split into segments. Renders Base UI's Tabs.List. */
export function TabViewList({ activateOnFocus = true, className, ...props }: TabViewListProps) {
  return (
    <BaseTabs.List
      activateOnFocus={activateOnFocus}
      className={withClassName("mac-tab-view-list", className)}
      {...props}
    />
  );
}

export interface TabViewTabProps extends Omit<BaseTabs.Tab.Props, "ref"> {
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/**
 * One tab (NSTabViewItem's label). `value` links it to the `TabViewPanel` with the same
 * value. Renders Base UI's Tabs.Tab, a `<button>`.
 *
 * A press with the mouse selects the tab when the button is released over it, as AppKit's
 * segments do: until then the tab is drawn pressed, and moving off it cancels. Base UI selects
 * a tab when it takes focus, which a press gives it at once; that is kept for the keyboard
 * (`activateOnFocus`) and left out while the tab is being pressed.
 */
export function TabViewTab({ className, children, onFocus, ...props }: TabViewTabProps) {
  return (
    <BaseTabs.Tab
      className={withClassName("mac-tab-view-tab", className)}
      onFocus={(event) => {
        onFocus?.(event);
        if (event.currentTarget.matches(":active")) event.preventBaseUIHandler();
      }}
      {...props}
    >
      <span className="mac-tab-view-tab-label">{children}</span>
    </BaseTabs.Tab>
  );
}

export interface TabViewPanelProps extends Omit<BaseTabs.Panel.Props, "ref"> {
  /** Ref to the rendered element. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * The pane shown while the tab with the same `value` is selected. Renders Base UI's
 * Tabs.Panel; a hidden pane is not in the DOM unless `keepMounted` is set.
 */
export function TabViewPanel({ className, ...props }: TabViewPanelProps) {
  return <BaseTabs.Panel className={withClassName("mac-tab-view-panel", className)} {...props} />;
}

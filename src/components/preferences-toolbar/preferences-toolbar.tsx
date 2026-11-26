"use client";

import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import type { ReactNode, Ref } from "react";
import { withClassName } from "../../lib/cn";
import "./preferences-toolbar.tokens.css";
import "./preferences-toolbar.css";

export interface PreferencesToolbarRootProps extends Omit<BaseTabs.Root.Props, "ref"> {
  /** Ref to the rendered element. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * Links a `PreferencesToolbar` to its panes: the element around both. Base UI's Tabs.Root, so
 * it takes `value`, `defaultValue` and `onValueChange`. `PreferencesWindow` is one already; use
 * this part only to put the toolbar in a window you assemble yourself, and give it that window
 * with `render` so that no extra element sits between the window and its bars.
 */
export function PreferencesToolbarRoot({ className, ...props }: PreferencesToolbarRootProps) {
  return (
    <BaseTabs.Root
      className={withClassName("mac-preferences-toolbar-root", className)}
      {...props}
    />
  );
}

export interface PreferencesToolbarProps extends Omit<BaseTabs.List.Props, "ref"> {
  /**
   * Where the items sit in the bar: packed from the leading edge, as in Mail, Safari and
   * Calendar, or centred as a group, as in Music and TV.
   * @default "leading"
   */
  alignment?: "leading" | "center";
  /**
   * Whether moving focus to an item with the arrow keys also selects it. AppKit moves focus
   * only, and Space selects.
   * @default false
   */
  activateOnFocus?: boolean;
  /** Ref to the rendered element. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * The toolbar of a preferences window (an NSToolbar with selectable items): a row of icons
 * with labels, one of them selected, that switches the pane below.
 *
 * It has no background of its own: it sits in a unified `TitleBar`, whose surface it shares.
 * Built on Base UI's Tabs.List, so it is a `tablist` with one tab stop, and the arrow keys,
 * Home and End move between the items. Give it an `aria-label`.
 */
export function PreferencesToolbar({
  alignment = "leading",
  activateOnFocus = false,
  className,
  ...props
}: PreferencesToolbarProps) {
  return (
    <BaseTabs.List
      activateOnFocus={activateOnFocus}
      data-alignment={alignment}
      className={withClassName("mac-preferences-toolbar", className)}
      {...props}
    />
  );
}

export interface PreferencesToolbarItemProps extends Omit<BaseTabs.Tab.Props, "ref"> {
  /**
   * The pane's icon, drawn in a 32 pt square above the label. Decorative: the label names the
   * item. Catalina's own icons are full-colour artwork and are not part of the library.
   */
  icon?: ReactNode;
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/**
 * One item of a preferences toolbar: an icon above a one-line label (the children). `value`
 * links it to the pane with the same value. Renders Base UI's Tabs.Tab, a `<button>` with the
 * `tab` role.
 */
export function PreferencesToolbarItem({
  icon,
  className,
  children,
  ...props
}: PreferencesToolbarItemProps) {
  return (
    <BaseTabs.Tab className={withClassName("mac-preferences-toolbar-item", className)} {...props}>
      <span className="mac-preferences-toolbar-item-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="mac-preferences-toolbar-item-label">{children}</span>
    </BaseTabs.Tab>
  );
}

export interface PreferencesToolbarPanelProps extends Omit<BaseTabs.Panel.Props, "ref"> {
  /** Ref to the rendered element. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * The pane shown while the item with the same `value` is selected. Renders Base UI's
 * Tabs.Panel, without any styling of its own; a hidden pane is not in the DOM unless
 * `keepMounted` is set. `PreferencesWindowPane` is this part with the margins of a pane.
 */
export function PreferencesToolbarPanel({ className, ...props }: PreferencesToolbarPanelProps) {
  return (
    <BaseTabs.Panel
      className={withClassName("mac-preferences-toolbar-panel", className)}
      {...props}
    />
  );
}

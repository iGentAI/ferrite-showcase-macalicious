"use client";

import { Collapsible as BaseCollapsible } from "@base-ui/react/collapsible";
import type { CSSProperties } from "react";
import { withClassName } from "../../lib/cn";
import "./drawer.css";

export interface DrawerProps extends BaseCollapsible.Root.Props {}

/**
 * A drawer (NSDrawer) and the window it belongs to: the element that holds a window, a
 * `DrawerPanel` beside it and, somewhere inside, the `DrawerTrigger` that slides the panel out.
 * The panel is placed against this element's edges, so make the window its only other child.
 *
 * Built on Base UI's Collapsible and takes its Root props: `open`, `defaultOpen`,
 * `onOpenChange`, `disabled`. A drawer is closed by default.
 */
export function Drawer({ className, ...props }: DrawerProps) {
  return <BaseCollapsible.Root className={withClassName("mac-drawer", className)} {...props} />;
}

export interface DrawerTriggerProps extends BaseCollapsible.Trigger.Props {}

/**
 * The button that opens and closes the drawer. Renders a `<button>`; pass the real control
 * with `render` (`render={<PushButton />}`). It carries `aria-expanded` and points to the
 * panel with `aria-controls`.
 */
export function DrawerTrigger({ className, ...props }: DrawerTriggerProps) {
  return (
    <BaseCollapsible.Trigger
      className={withClassName("mac-drawer-trigger", className)}
      {...props}
    />
  );
}

export interface DrawerPanelProps extends BaseCollapsible.Panel.Props {
  /**
   * The edge of the window the drawer slides out from (NSDrawer's `preferredEdge`).
   * @default "right"
   */
  edge?: "left" | "right" | "bottom";
  /**
   * How far the drawer extends from the window's edge (NSDrawer's `contentSize`): its width on
   * the left and right, its height at the bottom. A number of points, or any CSS length.
   * Without it the drawer is 200 pt.
   */
  contentSize?: number | string;
  /**
   * Distance from the window's top edge to the drawer's (from the left edge, for a bottom
   * drawer): NSDrawer's `leadingOffset`. A number of points, or any CSS length. Without it a
   * side drawer starts 30 pt down, under a 22 pt title bar, and a bottom drawer 8 pt in.
   */
  leadingOffset?: number | string;
  /**
   * Distance from the drawer's far end to the window's bottom edge (right edge, for a bottom
   * drawer): NSDrawer's `trailingOffset`. A number of points, or any CSS length. Without it
   * the drawer ends 8 pt short of the edge.
   */
  trailingOffset?: number | string;
  /**
   * The state of the window the drawer belongs to, written to the panel as `data-window-state`
   * so that controls inside it follow the window. Pass the window's own `state`.
   * @default "key"
   */
  state?: "key" | "main" | "inactive";
}

const length = (value: number | string | undefined) =>
  typeof value === "number" ? `${value}px` : value;

/**
 * The drawer itself: a surface of the window background that slides out from under one edge of
 * the window and back. It is in the DOM only while open, unless `keepMounted` is set. It is a
 * `group`: name it with `aria-label`.
 */
export function DrawerPanel({
  edge = "right",
  contentSize,
  leadingOffset,
  trailingOffset,
  state = "key",
  className,
  style,
  children,
  ...props
}: DrawerPanelProps) {
  const own = {
    "--mac-drawer-content-size": length(contentSize),
    "--mac-drawer-leading-offset": length(leadingOffset),
    "--mac-drawer-trailing-offset": length(trailingOffset),
  } as CSSProperties;
  return (
    <BaseCollapsible.Panel
      role="group"
      data-edge={edge}
      data-window-state={state}
      className={withClassName("mac-drawer-panel", className)}
      style={
        typeof style === "function"
          ? (panel) => ({ ...own, ...style(panel) })
          : { ...own, ...style }
      }
      {...props}
    >
      <div className="mac-drawer-content">{children}</div>
    </BaseCollapsible.Panel>
  );
}

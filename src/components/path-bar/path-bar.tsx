"use client";

import {
  Children,
  type ComponentProps,
  cloneElement,
  isValidElement,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "../../lib/cn";
import "./path-bar.tokens.css";
import "./path-bar.css";

export interface PathBarProps extends ComponentProps<"nav"> {
  /**
   * The path, as `PathBarItem` elements from the root to the item. The last `PathBarItem` is
   * marked as the current location unless an item sets `current` itself.
   */
  children?: ReactNode;
}

/**
 * A path bar (NSPathControl, standard style): the location of an item as icon-and-name
 * components separated by chevrons. Renders a `<nav>` named "Path" holding an ordered list.
 * Without children it is the empty bar Finder shows while nothing is selected.
 */
export function PathBar({ className, children, ...props }: PathBarProps) {
  const items = Children.toArray(children);
  let last = -1;
  let marked = false;
  items.forEach((item, index) => {
    if (isValidElement<PathBarItemProps>(item) && item.type === PathBarItem) {
      last = index;
      if (item.props.current !== undefined) marked = true;
    }
  });
  if (last >= 0 && !marked) {
    items[last] = cloneElement(items[last] as ReactElement<PathBarItemProps>, { current: true });
  }
  return (
    <nav aria-label="Path" className={cn("mac-path-bar", className)} {...props}>
      <ol className="mac-path-bar-list">{items}</ol>
    </nav>
  );
}

export interface PathBarItemProps extends ComponentProps<"li"> {
  /** A 16 pt icon shown before the name. It is decorative: the name labels the component. */
  icon?: ReactNode;
  /**
   * Marks the component as the current location (`aria-current="page"`). `PathBar` sets it on
   * its last item; pass `false` there, or `true` on another item, to override.
   */
  current?: boolean;
  /**
   * Called when the component is opened. With it the component is a `<button>`; without it,
   * plain text.
   */
  onActivate?: (event: MouseEvent<HTMLButtonElement>) => void;
  /**
   * What opens the component with a pointer: a double click, as in Finder, or a single click,
   * as breadcrumbs on the web. Return, Space and assistive technology always open it at once.
   * @default "double-click"
   */
  activation?: "double-click" | "click";
}

/** One component of a path: an optional icon and a name. Renders an `<li>`. */
export function PathBarItem({
  icon,
  current,
  onActivate,
  activation = "double-click",
  className,
  children,
  ...props
}: PathBarItemProps) {
  const content = (
    <>
      {icon != null && icon !== false ? (
        <span className="mac-path-bar-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="mac-path-bar-name">{children}</span>
    </>
  );
  const ariaCurrent = current ? "page" : undefined;
  return (
    <li className={cn("mac-path-bar-item", className)} {...props}>
      {onActivate ? (
        <button
          type="button"
          className="mac-path-bar-component"
          aria-current={ariaCurrent}
          onClick={(event) => {
            // A click from the keyboard or assistive technology reports detail 0; a pointer
            // reports 1, then 2 for the click that completes a double click, and counts on
            // for the clicks after it, which must not open the component again.
            if (activation === "click" || event.detail === 0 || event.detail === 2) {
              onActivate(event);
            }
          }}
        >
          {content}
        </button>
      ) : (
        <span className="mac-path-bar-component" aria-current={ariaCurrent}>
          {content}
        </span>
      )}
    </li>
  );
}

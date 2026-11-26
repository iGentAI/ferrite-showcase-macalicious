"use client";

import { Toolbar as BaseToolbar } from "@base-ui/react/toolbar";
import type { HTMLAttributeAnchorTarget, ReactNode, Ref } from "react";
import { withClassName } from "../../lib/cn";
import "./favorites-bar.tokens.css";
import "./favorites-bar.css";

export interface FavoritesBarProps extends Omit<BaseToolbar.Root.Props, "ref" | "orientation"> {
  /**
   * What stands at the trailing end of the bar, after the items: a `FavoritesBarOverflow`
   * button, whose menu lists the favourites that do not fit. It is shown only while an item
   * is cut off, where the browser can tell without a script (see the page); elsewhere it is
   * always shown.
   */
  overflow?: ReactNode;
  /** Ref to the rendered element, the one with `role="toolbar"`. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * Safari's Favorites bar: one line of bookmarks and bookmark folders under the toolbar.
 *
 * Built on Base UI's Toolbar: it is one tab stop, and the arrow keys move between its items.
 * Its children are `FavoritesBarItem`s and `FavoritesBarFolder`s. Items that do not fit are
 * cut off whole, never in the middle of a title. Give it an `aria-label`.
 */
export function FavoritesBar({ overflow, className, children, ...props }: FavoritesBarProps) {
  return (
    <BaseToolbar.Root className={withClassName("mac-favorites-bar", className)} {...props}>
      <div className="mac-favorites-bar-items">{children}</div>
      {overflow}
    </BaseToolbar.Root>
  );
}

/** An item's icon and title, in the order they are drawn. */
function content(icon: ReactNode, children: ReactNode) {
  return (
    <>
      {icon ? (
        <span className="mac-favorites-bar-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children != null && <span className="mac-favorites-bar-title">{children}</span>}
    </>
  );
}

export interface FavoritesBarItemProps extends Omit<BaseToolbar.Button.Props, "ref"> {
  /**
   * The bookmark's address. With it the item is a link (`<a>`); without it, a `<button>` that
   * the application handles with `onClick`. A disabled item is always a button.
   */
  href?: string;
  /** Where the link opens (`_blank` for a new tab). Only with `href`. */
  target?: HTMLAttributeAnchorTarget;
  /** The link's relationship (`noreferrer`). Only with `href`. */
  rel?: string;
  /**
   * The page's icon, shown before the title in a 16 pt box: a drawing or an image of your
   * own. It is hidden from assistive technology; an item with an icon and no title needs an
   * `aria-label`.
   */
  icon?: ReactNode;
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/**
 * One bookmark of a `FavoritesBar`: a title that opens a page. Renders Base UI's Toolbar
 * link when it has an `href` and the Toolbar button otherwise, and keeps their `render` prop.
 */
export function FavoritesBarItem({
  href,
  target,
  rel,
  icon,
  disabled,
  className,
  ref,
  children,
  ...props
}: FavoritesBarItemProps) {
  if (href !== undefined && !disabled) {
    const link = props as BaseToolbar.Link.Props;
    return (
      <BaseToolbar.Link
        href={href}
        target={target}
        rel={rel}
        {...link}
        ref={ref as Ref<HTMLAnchorElement>}
        className={withClassName(
          "mac-favorites-bar-item",
          className as BaseToolbar.Link.Props["className"],
        )}
      >
        {content(icon, children)}
      </BaseToolbar.Link>
    );
  }
  return (
    <BaseToolbar.Button
      disabled={disabled}
      ref={ref as Ref<HTMLButtonElement>}
      className={withClassName("mac-favorites-bar-item", className)}
      {...props}
    >
      {content(icon, children)}
    </BaseToolbar.Button>
  );
}

export interface FavoritesBarFolderProps extends Omit<BaseToolbar.Button.Props, "ref"> {
  /** An icon before the title, in a 16 pt box; hidden from assistive technology. */
  icon?: ReactNode;
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/**
 * A folder of bookmarks in a `FavoritesBar`: a title followed by a small chevron, which opens
 * a menu. The library draws the button only: attach your menu by rendering its trigger,
 * `render={<Menu.Trigger />}` with Base UI's Menu, or handle `onClick`. Renders Base UI's
 * Toolbar button with `aria-haspopup="menu"`, and looks pressed while its menu is open.
 */
export function FavoritesBarFolder({
  icon,
  className,
  ref,
  children,
  ...props
}: FavoritesBarFolderProps) {
  return (
    <BaseToolbar.Button
      aria-haspopup="menu"
      ref={ref as Ref<HTMLButtonElement>}
      className={withClassName("mac-favorites-bar-item", className)}
      {...props}
    >
      {content(icon, children)}
      <span className="mac-favorites-bar-chevron" aria-hidden="true" />
    </BaseToolbar.Button>
  );
}

export interface FavoritesBarOverflowProps
  extends Omit<BaseToolbar.Button.Props, "ref" | "children"> {
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/**
 * The double chevron at the trailing end of a `FavoritesBar`, for the favourites that do not
 * fit. Pass it as the bar's `overflow`. Like a folder it is only the button: attach a menu
 * with `render`. It has no text, so give it an `aria-label`.
 */
export function FavoritesBarOverflow({ className, ref, ...props }: FavoritesBarOverflowProps) {
  return (
    <BaseToolbar.Button
      aria-haspopup="menu"
      ref={ref as Ref<HTMLButtonElement>}
      className={withClassName("mac-favorites-bar-item mac-favorites-bar-overflow", className)}
      {...props}
    />
  );
}

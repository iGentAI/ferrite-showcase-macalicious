"use client";

import { Menu as BaseMenu } from "@base-ui/react/menu";
import { Menubar as BaseMenubar } from "@base-ui/react/menubar";
import type { ComponentProps, ReactNode } from "react";
import { useCallback, useRef } from "react";
import { attachRef } from "../../lib/attach-ref";
import { cn, withClassName } from "../../lib/cn";
import { observeResize } from "../../lib/observe-resize";
import { Menu, MenuPopup, type MenuPopupProps, type MenuProps } from "../menu";
import "./menu-bar.tokens.css";
import "./menu-bar.css";

export interface MenuBarProps extends ComponentProps<"div"> {
  /**
   * What sits at the trailing end of the bar: a `MenuBarExtras` group. It is a menu bar of
   * its own, as the status menus are in macOS.
   */
  extras?: ReactNode;
  /**
   * Whether an open menu is modal, as in AppKit: the page behind it does not scroll or take
   * clicks.
   * @default true
   */
  modal?: boolean;
  /**
   * Disables every menu of the bar.
   * @default false
   */
  disabled?: boolean;
  /**
   * Whether Left and Right Arrow wrap from the last title to the first.
   * @default true
   */
  loopFocus?: boolean;
  /** The accessible name of the menus, for a page with more than one menu bar. */
  "aria-label"?: string;
  /** The menus: `MenuBarMenu`s. */
  children?: ReactNode;
}

/**
 * The Catalina menu bar: the 22 pt vibrant strip that holds the menu titles and, at its
 * trailing end, the menu bar extras. Put `MenuBarMenu`s inside.
 *
 * The titles are a Base UI Menubar: one menu is open at a time, and once one is open,
 * pointing at another title switches to it. Attributes, `className`, `style` and `ref` go to
 * the strip.
 */
export function MenuBar({
  extras,
  modal,
  disabled,
  loopFocus,
  "aria-label": label,
  className,
  children,
  ref,
  ...props
}: MenuBarProps) {
  const setStrip = useCallback(
    (strip: HTMLDivElement) => {
      const release = attachRef(ref, strip);
      const stop = keepInside(strip);
      return () => {
        stop();
        release();
      };
    },
    [ref],
  );
  return (
    <div ref={setStrip} className={cn("mac-menu-bar", className)} {...props}>
      <BaseMenubar
        modal={modal}
        disabled={disabled}
        loopFocus={loopFocus}
        aria-label={label}
        className="mac-menu-bar-menus"
      >
        {children}
      </BaseMenubar>
      {extras}
    </div>
  );
}

/**
 * Keeps every cell of the bar inside it when the screen is narrower than the bar's contents,
 * as macOS does on a small display: menu titles are left out from the end, never the Apple
 * menu or the application menu, then menu bar extras from the leading side, and then any title
 * that would still run under the first extra drawn. A cell left
 * out carries `data-overflow` and is not drawn; it comes back as soon as there is room. On a
 * 390-point phone the Catalina desktop's Finder menus and status menus run 50 points past the
 * window otherwise (15 November 2026, the layout journey at 390x844).
 *
 * Measured whenever the bar, its titles or its extras change size or content. Returns the
 * function that stops watching.
 */
function keepInside(strip: HTMLElement): () => void {
  let frame = 0;
  const fit = () => {
    frame = 0;
    for (const cell of strip.querySelectorAll("[data-overflow]"))
      cell.removeAttribute("data-overflow");
    const edge = strip.getBoundingClientRect().right + 0.5;
    const titles = [
      ...strip.querySelectorAll<HTMLElement>(".mac-menu-bar-menus .mac-menu-bar-title"),
    ];
    // Titles are laid out from the leading edge, so leaving out the last moves none of the others.
    for (const title of titles.slice(2).reverse()) {
      if (title.getBoundingClientRect().right <= edge) break;
      title.setAttribute("data-overflow", "");
    }
    // Extras are laid out from the trailing edge of their group, which clips its leading side.
    const shownExtras: HTMLElement[] = [];
    for (const group of strip.querySelectorAll<HTMLElement>(".mac-menu-bar-extra-group")) {
      const start = group.getBoundingClientRect().left - 0.5;
      for (const extra of group.querySelectorAll<HTMLElement>(".mac-menu-bar-extra")) {
        const box = extra.getBoundingClientRect();
        if (box.left < start || box.right > edge) extra.setAttribute("data-overflow", "");
        else shownExtras.push(extra);
      }
    }
    // No title may run under an extra that is still drawn: a group that does not clip, or an extra
    // wider than its share, would otherwise draw over the last titles.
    const firstExtra =
      Math.min(...shownExtras.map((extra) => extra.getBoundingClientRect().left)) + 0.5;
    for (const title of titles.slice(2).reverse()) {
      if (title.hasAttribute("data-overflow")) continue;
      if (title.getBoundingClientRect().right <= firstExtra) break;
      title.setAttribute("data-overflow", "");
    }
  };
  const soon = () => {
    if (!frame) frame = requestAnimationFrame(fit);
  };
  const stops = [observeResize(strip, soon)];
  const menus = strip.querySelector(".mac-menu-bar-menus");
  if (menus) stops.push(observeResize(menus, soon));
  // A title or extra that appears or changes its text (another application's menus, the clock).
  const watch = typeof MutationObserver === "undefined" ? undefined : new MutationObserver(soon);
  watch?.observe(strip, { childList: true, subtree: true, characterData: true });
  return () => {
    for (const stop of stops) stop();
    watch?.disconnect();
    if (frame) cancelAnimationFrame(frame);
  };
}

export interface MenuBarTitleProps extends BaseMenu.Trigger.Props {
  /**
   * Marks the application menu, whose title, the application's name, is bold.
   * @default false
   */
  application?: boolean;
}

/**
 * A title in the menu bar: the cell that opens a menu and is highlighted while it is open.
 * Built on Base UI's Menu.Trigger; use it inside a `Menu`, before a `MenuPopup attached`.
 */
export function MenuBarTitle({ application = false, className, ...props }: MenuBarTitleProps) {
  return (
    <BaseMenu.Trigger
      data-application={application ? "" : undefined}
      className={withClassName("mac-menu-bar-title", className)}
      {...props}
    />
  );
}

export interface MenuBarMenuProps extends Omit<MenuProps, "children"> {
  /**
   * The title in the bar: text, or an image such as the mark of the Apple menu, which then
   * needs an `aria-label`.
   */
  title: ReactNode;
  /**
   * Marks the application menu, whose title is bold.
   * @default false
   */
  application?: boolean;
  /** The accessible name of a title that is an image. */
  "aria-label"?: string;
  /** Props for the title cell, a `MenuBarTitle`. */
  titleProps?: MenuBarTitleProps;
  /** Props for the menu's popup, a `MenuPopup` attached under the bar. */
  popup?: MenuPopupProps;
  /** The menu's items. */
  children?: ReactNode;
}

/**
 * How soon after the pointer opened a menu (another menu of the bar being open) a click on its title is the person
 * choosing that title, which closes nothing: moving onto a title and clicking it shows its menu, as in AppKit.
 */
const CHOOSE_AFTER_HOVER_MS = 600;

/**
 * One menu of the menu bar, assembled: a `Menu` with a `MenuBarTitle` and a `MenuPopup`
 * attached under it. Takes the props of `Menu` (`open`, `onOpenChange`, `disabled`).
 */
export function MenuBarMenu({
  title,
  application,
  "aria-label": label,
  titleProps,
  popup,
  children,
  onOpenChange,
  ...props
}: MenuBarMenuProps) {
  const hovered = useRef(Number.NEGATIVE_INFINITY);
  return (
    <Menu
      {...props}
      onOpenChange={(open, details) => {
        const fresh = performance.now() - hovered.current < CHOOSE_AFTER_HOVER_MS;
        // One exemption per hover switch: consumed by the click it covers, cleared by any other change.
        hovered.current =
          open && details.reason === "trigger-hover" ? performance.now() : Number.NEGATIVE_INFINITY;
        if (!open && details.reason === "trigger-press" && fresh) return details.cancel();
        onOpenChange?.(open, details);
      }}
    >
      <MenuBarTitle application={application} aria-label={label} {...titleProps}>
        {title}
      </MenuBarTitle>
      <MenuPopup attached {...popup}>
        {children}
      </MenuPopup>
    </Menu>
  );
}

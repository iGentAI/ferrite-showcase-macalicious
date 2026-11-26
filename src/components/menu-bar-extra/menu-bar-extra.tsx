"use client";

import { Menu as BaseMenu } from "@base-ui/react/menu";
import { Menubar as BaseMenubar } from "@base-ui/react/menubar";
import type { ReactNode } from "react";
import { cn, withClassName } from "../../lib/cn";
import { Menu, MenuPopup, type MenuPopupProps, type MenuProps } from "../menu";
import { MenuBarTitle, type MenuBarTitleProps } from "../menu-bar";
import "./menu-bar-extra.tokens.css";
import "./menu-bar-extra.css";

/** Props of `MenuBarExtras`: those of Base UI's Menubar. */
export interface MenuBarExtrasProps extends BaseMenubar.Props {}

/**
 * The group of menu bar extras at the trailing end of a `MenuBar` (pass it as `extras`): it
 * takes the room the menu titles leave and packs its items against the bar's trailing edge.
 *
 * It is a menu bar of its own, built on Base UI's Menubar, as the status menus are in macOS:
 * Left and Right Arrow move between the extras, and while one menu is open, pointing at
 * another extra switches to it. Its accessible name is "Status menus" unless `aria-label`
 * gives another.
 */
export function MenuBarExtras({ className, ...props }: MenuBarExtrasProps) {
  return (
    <BaseMenubar
      aria-label="Status menus"
      className={withClassName("mac-menu-bar-extra-group", className)}
      {...props}
    />
  );
}

export interface MenuBarExtraProps extends BaseMenu.Trigger.Props {
  /**
   * Sets the text in bold. No screenshot shows a bold extra, and the user name is not one.
   * @default false
   */
  emphasized?: boolean;
  /**
   * Highlights the extra, for as long as what it opened (a panel, a popover) is showing.
   * @default false
   */
  active?: boolean;
}

// A cell without a menu announces none, unless its owner says what it opens (a panel).
const NO_MENU = { "aria-haspopup": undefined, "aria-expanded": undefined };

/**
 * A menu bar extra (NSStatusItem) that does not open a menu: a cell with a template image or
 * text that acts when clicked, like Spotlight's. Give an image-only extra an `aria-label`.
 * For an extra with a menu use `MenuBarExtraMenu`.
 *
 * It is an item of the extras' menubar like the others, reached with the arrow keys. For
 * that it is built on Base UI's Menu.Trigger, with a menu that never opens.
 */
export function MenuBarExtra({
  emphasized = false,
  active = false,
  className,
  ...props
}: MenuBarExtraProps) {
  return (
    <BaseMenu.Root open={false}>
      <BaseMenu.Trigger
        data-emphasized={emphasized ? "" : undefined}
        data-active={active ? "" : undefined}
        className={withClassName("mac-menu-bar-title mac-menu-bar-extra", className)}
        {...NO_MENU}
        {...props}
      />
    </BaseMenu.Root>
  );
}

export interface MenuBarExtraMenuProps extends Omit<MenuProps, "children"> {
  /** What the cell shows: a template image drawn with `currentColor`, text, or both. */
  title: ReactNode;
  /**
   * Sets the title in bold, as the user name of fast user switching is.
   * @default false
   */
  emphasized?: boolean;
  /** The accessible name of an extra whose title is an image. */
  "aria-label"?: string;
  /** Props for the cell, a `MenuBarTitle`. */
  titleProps?: MenuBarTitleProps;
  /** Props for the menu's popup, a `MenuPopup` attached under the bar. */
  popup?: MenuPopupProps;
  /** The menu's items. */
  children?: ReactNode;
}

/**
 * A menu bar extra with its menu, assembled: a `Menu` whose title cell sits in the bar and
 * whose `MenuPopup` is attached under it. The cell is highlighted while the menu is open.
 */
export function MenuBarExtraMenu({
  title,
  emphasized = false,
  "aria-label": label,
  titleProps,
  popup,
  children,
  ...props
}: MenuBarExtraMenuProps) {
  const { className, ...cell } = titleProps ?? {};
  return (
    <Menu {...props}>
      <MenuBarTitle
        aria-label={label}
        data-emphasized={emphasized ? "" : undefined}
        className={
          typeof className === "function"
            ? (state) => cn("mac-menu-bar-extra", className(state))
            : cn("mac-menu-bar-extra", className)
        }
        {...cell}
      >
        {title}
      </MenuBarTitle>
      <MenuPopup attached {...popup}>
        {children}
      </MenuPopup>
    </Menu>
  );
}

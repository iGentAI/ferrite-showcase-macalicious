"use client";

import { Menu as BaseMenu } from "@base-ui/react/menu";
import { createContext, type ReactNode, use } from "react";
import { cn, withClassName } from "../../lib/cn";
import { MenuPopup, type MenuPopupProps } from "../menu";
import { MenuItem, MenuItemLabel } from "../menu-item";
import "./submenu.css";

/** Props of `Submenu`: those of Base UI's Menu.SubmenuRoot. */
export interface SubmenuProps extends BaseMenu.SubmenuRoot.Props {}

// Whether the submenu is disabled at its root, which disables its parent item too.
const SubmenuDisabled = createContext(false);

/**
 * A submenu (NSMenuItem.submenu): a menu that opens beside one item of its parent menu.
 * Groups the parts and renders no element: put a `SubmenuTrigger` and a `SubmenuPopup` inside,
 * in place of an item of the parent menu.
 *
 * Built on Base UI's Menu.SubmenuRoot (`open`, `defaultOpen`, `onOpenChange`, `disabled`,
 * `closeParentOnEsc`).
 */
export function Submenu(props: SubmenuProps) {
  return (
    <SubmenuDisabled value={!!props.disabled}>
      <BaseMenu.SubmenuRoot {...props} />
    </SubmenuDisabled>
  );
}

export interface SubmenuTriggerProps extends BaseMenu.SubmenuTrigger.Props {
  /** A 16 pt image before the title, normally an inline SVG drawn with `currentColor`. */
  image?: ReactNode;
  /**
   * How long the pointer rests on the item before the submenu opens, in milliseconds.
   * @default 200
   */
  delay?: number;
}

/**
 * The parent item of a submenu: a menu item with a triangle at its trailing edge in place of
 * a key equivalent. It stays highlighted while its submenu is open. Built on Base UI's
 * Menu.SubmenuTrigger.
 */
export function SubmenuTrigger({
  image,
  delay = 200,
  className,
  children,
  ...props
}: SubmenuTriggerProps) {
  if (use(SubmenuDisabled) || props.disabled) {
    // A disabled item is passed over by the keyboard, which MenuItem sees to (menu-item.tsx).
    const { openOnHover: _, closeDelay: __, render, style, ...rest } = props;
    const state = { disabled: true, highlighted: false, open: false };
    return (
      <MenuItem
        aria-haspopup="menu"
        aria-expanded={false}
        image={image}
        style={typeof style === "function" ? style(state) : style}
        render={
          typeof render === "function"
            ? (rowProps, rowState) => render(rowProps, { ...rowState, open: false })
            : render
        }
        className={cn(
          "mac-submenu-trigger",
          typeof className === "function" ? className(state) : className,
        )}
        {...rest}
        disabled
      >
        {children}
      </MenuItem>
    );
  }
  return (
    <BaseMenu.SubmenuTrigger
      delay={delay}
      className={withClassName("mac-menu-item mac-submenu-trigger", className)}
      {...props}
    >
      <MenuItemLabel image={image}>{children}</MenuItemLabel>
    </BaseMenu.SubmenuTrigger>
  );
}

export interface SubmenuPopupProps extends MenuPopupProps {
  /**
   * Distance from the parent menu, in points. The default lays the submenu's hairline over
   * the parent's.
   * @default -1
   */
  sideOffset?: MenuPopupProps["sideOffset"];
  /**
   * Shift along the parent's edge, in points. The default raises the submenu by its 4 pt top
   * padding, so that its first item is level with the parent item.
   * @default -4
   */
  alignOffset?: MenuPopupProps["alignOffset"];
}

/**
 * The submenu itself: a detached menu beside its parent item, on the other side when there is
 * no room. Takes the props of `MenuPopup`.
 */
export function SubmenuPopup({
  sideOffset = -1,
  alignOffset = -4,
  className,
  ...props
}: SubmenuPopupProps) {
  return (
    <MenuPopup
      sideOffset={sideOffset}
      alignOffset={alignOffset}
      className={
        typeof className === "function"
          ? (state) => cn("mac-submenu", className(state))
          : cn("mac-submenu", className)
      }
      {...props}
    />
  );
}

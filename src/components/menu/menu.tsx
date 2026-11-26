"use client";

import { Menu as BaseMenu } from "@base-ui/react/menu";
import { createContext, use } from "react";
import { withClassName } from "../../lib/cn";
import type { ControlSize } from "../../lib/control-size";
import "./menu.tokens.css";
import "./menu.css";

/** Props of `Menu`: those of Base UI's Menu.Root. */
export interface MenuProps extends BaseMenu.Root.Props {}

/**
 * A Catalina menu (NSMenu): a list of commands that stays open until one is chosen. Groups
 * the parts and renders no element: put a `MenuTrigger` and a `MenuPopup` inside.
 *
 * Built on Base UI's Menu.Root and takes its props (`open`, `defaultOpen`, `onOpenChange`,
 * `modal`, `disabled`, `loopFocus`, `handle`).
 */
export function Menu(props: MenuProps) {
  return <BaseMenu.Root {...props} />;
}

/** Props of `MenuTrigger`: those of Base UI's Menu.Trigger. */
export interface MenuTriggerProps extends BaseMenu.Trigger.Props {}

/**
 * The control that opens the menu. Renders an unstyled `<button>`: a menu has no bezel of its
 * own, so pass the control with `render` (`render={<PushButton />}`).
 */
export function MenuTrigger(props: MenuTriggerProps) {
  return <BaseMenu.Trigger {...props} />;
}

export interface MenuPopupContextValue {
  /** `"dark"` draws the menus in Dark Aqua whatever the page's appearance. */
  appearance?: "dark";
  /** `"hidden"` leaves out the key equivalents of the items. */
  keyEquivalents?: "hidden";
}

/**
 * What a kind of menu decides for every menu opened from it. A submenu is rendered in a portal
 * of its own, outside its parent's element, so its parent's look reaches it through this
 * context: a Dock menu's submenus are dark and, like a contextual menu's, show no key
 * equivalents. Provide it around a menu's items.
 */
export const MenuPopupContext = createContext<MenuPopupContextValue>({});

export interface MenuPopupProps extends BaseMenu.Popup.Props {
  /**
   * Draws the menu as one that hangs off a bar: square top corners and no rim along the top
   * edge, as under the menu bar. A detached menu (a pop-up, contextual or Dock menu, a
   * submenu) has four round corners.
   * @default false
   */
  attached?: boolean;
  /**
   * Size of the control that opens the menu, which sets the menu's font: `"regular"` is the
   * 13 pt menu of a regular pop-up button (18 pt rows), `"small"` 12 pt (17 pt rows) and
   * `"mini"` 11 pt (16 pt rows). Without it the menu uses the 14 pt menu font (19 pt rows)
   * of menu bar and contextual menus.
   */
  size?: ControlSize;
  /**
   * Side of the trigger the menu opens on. Base UI's default: `"bottom"`, and beside the
   * parent item for a submenu.
   */
  side?: BaseMenu.Positioner.Props["side"];
  /**
   * Alignment along that side.
   * @default "start"
   */
  align?: BaseMenu.Positioner.Props["align"];
  /**
   * Distance from the trigger, in points.
   * @default 0
   */
  sideOffset?: BaseMenu.Positioner.Props["sideOffset"];
  /**
   * Shift along the side, in points.
   * @default 0
   */
  alignOffset?: BaseMenu.Positioner.Props["alignOffset"];
  /** Element, rectangle or virtual element to position against instead of the trigger. */
  anchor?: BaseMenu.Positioner.Props["anchor"];
  /**
   * CSS position of the menu: `"fixed"` keeps it in place inside a scrolling ancestor.
   * @default "absolute"
   */
  positionMethod?: BaseMenu.Positioner.Props["positionMethod"];
  /**
   * Distance kept from the edges of the viewport, in points.
   * @default 5
   */
  collisionPadding?: BaseMenu.Positioner.Props["collisionPadding"];
  /** How the menu avoids the edges of the viewport: Base UI's `collisionAvoidance`. */
  collisionAvoidance?: BaseMenu.Positioner.Props["collisionAvoidance"];
  /** Element the menu is rendered into; the document body by default. */
  container?: BaseMenu.Portal.Props["container"];
}

/**
 * The menu itself: the vibrant surface that holds the items. Combines Base UI's portal,
 * positioner and popup, and is in the document only while the menu is open. It works under
 * any Base UI menu root: `Menu`, a submenu, a menu bar or a contextual menu.
 */
export function MenuPopup({
  attached = false,
  size,
  side,
  align = "start",
  sideOffset = 0,
  alignOffset = 0,
  anchor,
  positionMethod,
  collisionPadding,
  collisionAvoidance,
  container,
  className,
  ...props
}: MenuPopupProps) {
  const inherited = use(MenuPopupContext);
  return (
    <BaseMenu.Portal container={container}>
      <BaseMenu.Positioner
        data-appearance={inherited.appearance}
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        anchor={anchor}
        positionMethod={positionMethod}
        collisionPadding={collisionPadding}
        collisionAvoidance={collisionAvoidance}
        className="mac-menu-positioner"
      >
        <BaseMenu.Popup
          data-attached={attached ? "" : undefined}
          data-size={size}
          data-key-equivalents={inherited.keyEquivalents}
          className={withClassName("mac-menu", className)}
          {...props}
        />
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  );
}

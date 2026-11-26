"use client";

import { Menu as BaseMenu } from "@base-ui/react/menu";
import { mergeProps } from "@base-ui/react/merge-props";
import { createContext, use, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import {
  Menu,
  MenuPopupContext,
  type MenuPopupContextValue,
  type MenuPopupProps,
  type MenuProps,
} from "../menu";
import "./dock-menu.css";

/** The menu's state and the function that opens it, for the Dock item. */
interface DockMenuState {
  open: boolean;
  /** Whether the menu, and with it the Dock item, is disabled. */
  disabled?: boolean;
  /** Opens the menu unless it is disabled or open. */
  show: () => void;
}

const DockMenuContext = createContext<DockMenuState>({ open: false, show: () => {} });

export interface DockMenuProps extends Omit<MenuProps, "onOpenChange"> {
  /**
   * Called when the menu opens or closes. `details` is Base UI's change details; it is absent
   * when the Dock item opened the menu.
   */
  onOpenChange?: (open: boolean, details?: BaseMenu.Root.ChangeEventDetails) => void;
}

/**
 * A Dock menu (NSApplicationDelegate.applicationDockMenu): the menu of one item of the Dock.
 * Groups the parts and renders no element: put a `DockMenuTrigger`, the Dock item, and a
 * `DockMenuPopup` inside.
 *
 * Built on Base UI's Menu.Root and takes its props (`open`, `defaultOpen`, `disabled`,
 * `loopFocus`).
 */
export function DockMenu({
  open,
  defaultOpen = false,
  onOpenChange,
  disabled,
  ...props
}: DockMenuProps) {
  const [own, setOwn] = useState(defaultOpen);
  const shown = open ?? own;
  const change = (next: boolean, details?: BaseMenu.Root.ChangeEventDetails) => {
    // A click on the Dock item is the item's own: it does not open the menu.
    if (next && details?.reason === "trigger-press") {
      details.cancel();
      return;
    }
    onOpenChange?.(next, details);
    if (!details?.isCanceled) setOwn(next);
  };
  const show = () => {
    if (!disabled && !shown) change(true);
  };
  return (
    <DockMenuContext value={{ open: shown, disabled, show }}>
      <Menu open={shown} onOpenChange={change} disabled={disabled} {...props} />
    </DockMenuContext>
  );
}

/** Props of `DockMenuTrigger`: those of Base UI's Menu.Trigger. */
export interface DockMenuTriggerProps extends BaseMenu.Trigger.Props {}

/**
 * The Dock item the menu belongs to: a `<button>`, or the element given to `render` (with
 * `nativeButton={false}` when that is not a button). A click stays the item's own (it opens
 * the application); the menu opens on a secondary click or Control-click, when the item is
 * pressed and held for half a second, and with Up Arrow.
 *
 * Built on Base UI's Menu.Trigger, which names the menu, anchors it and takes the focus back
 * when it closes.
 */
export function DockMenuTrigger(props: DockMenuTriggerProps) {
  const menu = use(DockMenuContext);
  // A pending press acts on the menu and the item as they are when the half second is over,
  // not as they were when the press began: either may have been disabled meanwhile.
  const show = props.disabled ? () => {} : menu.show;
  const current = useRef(show);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The press in progress: "asked" once it was held long enough to ask for the menu, "opened"
  // once the menu did open. A press that opened the menu does not end in a click, even if the
  // menu has closed again by then; one that an owner declined does.
  const held = useRef<"" | "asked" | "opened">("");
  useEffect(() => {
    current.current = show;
    if (held.current && menu.open) held.current = "opened";
  });
  const release = () => clearTimeout(timer.current);
  useEffect(() => () => clearTimeout(timer.current), []);
  const merged = mergeProps<"button">(
    {
      onContextMenu(event) {
        if (props.disabled) return;
        event.preventDefault();
        release();
        menu.show();
      },
      onPointerDown(event) {
        held.current = "";
        release();
        // A disabled item, or the item of a disabled menu, does not begin a press, even if it
        // is enabled before the half second is over.
        if (!props.disabled && !menu.disabled && event.button === 0 && !event.ctrlKey) {
          timer.current = setTimeout(() => {
            held.current = "asked";
            current.current();
          }, 500);
        }
      },
      onPointerUp: release,
      onPointerLeave: release,
      // A cancelled press is over: it does not withhold a later click.
      onPointerCancel() {
        held.current = "";
        release();
      },
      onClickCapture(event) {
        if (held.current === "opened") {
          event.preventDefault();
          event.stopPropagation();
        }
        held.current = "";
      },
      onKeyDown(event) {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          show();
        }
      },
    },
    props as Record<string, unknown>,
  );
  return <BaseMenu.Trigger {...(merged as BaseMenu.Trigger.Props)} />;
}

export interface DockMenuPopupProps extends Omit<MenuPopupProps, "attached" | "size"> {
  /**
   * The appearance of the menu. Catalina draws Dock menus dark in both appearances;
   * `"inherit"` follows the page instead, or a `MenuPopupContext` around the menu.
   * @default "dark"
   */
  appearance?: "dark" | "inherit";
  /**
   * Side of the Dock item the menu opens on: `"top"` for a Dock along the bottom of the
   * screen, `"right"` or `"left"` for one along a side.
   * @default "top"
   */
  side?: MenuPopupProps["side"];
  /**
   * Alignment along that side.
   * @default "center"
   */
  align?: MenuPopupProps["align"];
  /**
   * Distance from the Dock item, in points: the 6 pt pointer and 4 pt.
   * @default 10
   */
  sideOffset?: MenuPopupProps["sideOffset"];
}

/**
 * The menu itself: a detached menu beside the Dock item, with a pointer towards it. Takes the
 * positioning props of `MenuPopup`. Key equivalents of its items are not shown. Its submenus
 * take its appearance and show no key equivalents either.
 */
export function DockMenuPopup({
  appearance = "dark",
  side = "top",
  align = "center",
  sideOffset = 10,
  alignOffset = 0,
  anchor,
  positionMethod,
  collisionPadding,
  collisionAvoidance,
  container,
  className,
  children,
  ...props
}: DockMenuPopupProps) {
  // Submenus are in portals of their own: the menu's look reaches them through the context,
  // added to what a provider around the menu decided.
  const inherited = use(MenuPopupContext);
  const context = useMemo<MenuPopupContextValue>(
    () => ({
      ...inherited,
      ...(appearance === "dark" && { appearance }),
      keyEquivalents: "hidden",
    }),
    [inherited, appearance],
  );
  return (
    <BaseMenu.Portal container={container}>
      <BaseMenu.Positioner
        data-appearance={context.appearance}
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        anchor={anchor}
        positionMethod={positionMethod}
        collisionPadding={collisionPadding}
        collisionAvoidance={collisionAvoidance}
        className="mac-menu-positioner mac-dock-menu-positioner"
      >
        <BaseMenu.Popup
          data-key-equivalents="hidden"
          className={
            typeof className === "function"
              ? (state) => cn("mac-menu mac-dock-menu", className(state))
              : cn("mac-menu mac-dock-menu", className)
          }
          {...props}
        >
          <MenuPopupContext value={context}>{children}</MenuPopupContext>
        </BaseMenu.Popup>
        <BaseMenu.Arrow className="mac-dock-menu-pointer" />
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  );
}

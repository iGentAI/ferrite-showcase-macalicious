"use client";

import { ContextMenu as BaseContextMenu } from "@base-ui/react/context-menu";
import { use, useMemo } from "react";
import { cn, withClassName } from "../../lib/cn";
import { MenuPopup, MenuPopupContext, type MenuPopupProps } from "../menu";
import "./contextual-menu.css";

/** Props of `ContextualMenu`: those of Base UI's ContextMenu.Root. */
export interface ContextualMenuProps extends BaseContextMenu.Root.Props {}

/**
 * A contextual menu (NSView.menu): the commands for what is under the pointer, opened by a
 * secondary click, a Control-click or a long press. Groups the parts and renders no element:
 * put a `ContextualMenuTrigger` and a `ContextualMenuPopup` inside.
 *
 * Built on Base UI's ContextMenu.Root and takes its props (`open`, `defaultOpen`,
 * `onOpenChange`, `disabled`, `loopFocus`).
 */
export function ContextualMenu(props: ContextualMenuProps) {
  return <BaseContextMenu.Root {...props} />;
}

/** Props of `ContextualMenuTrigger`: those of Base UI's ContextMenu.Trigger. */
export interface ContextualMenuTriggerProps extends BaseContextMenu.Trigger.Props {}

/**
 * The area the menu belongs to: a `<div>` around the content, or the content itself with
 * `render`. A secondary click anywhere inside opens the menu at the pointer, in place of the
 * browser's own menu.
 */
export function ContextualMenuTrigger({ className, ...props }: ContextualMenuTriggerProps) {
  return (
    <BaseContextMenu.Trigger
      className={withClassName("mac-contextual-menu-trigger", className)}
      {...props}
    />
  );
}

export interface ContextualMenuPopupProps extends MenuPopupProps {
  /**
   * Distance below the pointer, in points.
   * @default 1
   */
  sideOffset?: MenuPopupProps["sideOffset"];
  /**
   * Distance to the right of the pointer, in points.
   * @default 1
   */
  alignOffset?: MenuPopupProps["alignOffset"];
}

/**
 * The menu itself: a detached menu whose top left corner is at the pointer, moved to stay on
 * the screen. Takes the props of `MenuPopup`. Key equivalents of its items, and of the items
 * of its submenus, are not shown, as in a Catalina contextual menu.
 */
export function ContextualMenuPopup({
  sideOffset = 1,
  alignOffset = 1,
  className,
  children,
  ...props
}: ContextualMenuPopupProps) {
  // Submenus are in portals of their own: the menu's policy reaches them through the context,
  // added to what a provider around the menu decided (a dark appearance).
  const inherited = use(MenuPopupContext);
  const context = useMemo(() => ({ ...inherited, keyEquivalents: "hidden" as const }), [inherited]);
  return (
    <MenuPopup
      data-key-equivalents="hidden"
      sideOffset={sideOffset}
      alignOffset={alignOffset}
      className={
        typeof className === "function"
          ? (state) => cn("mac-contextual-menu", className(state))
          : cn("mac-contextual-menu", className)
      }
      {...props}
    >
      <MenuPopupContext value={context}>{children}</MenuPopupContext>
    </MenuPopup>
  );
}

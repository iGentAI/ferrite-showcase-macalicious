"use client";

import { Menu as BaseMenu } from "@base-ui/react/menu";
import type { ReactNode, Ref } from "react";
import { withClassName } from "../../lib/cn";
import { DockItem, type DockItemProps } from "../dock";
import "./dock-stack.tokens.css";
import "./dock-stack.css";

/**
 * Points from the tile's top edge to the fan: the lowest thumbnail's box ends 15 pt above
 * the shelf, whose top is 6 pt above the tile (measured on the Stacks screenshots).
 */
const OFFSET = 18.75;

/** The fan keeps its place when it does not fit the window; a grid or a list moves into view. */
const STAY = { side: "none", align: "none" } as const;

export interface DockStackProps extends Omit<DockItemProps, "children" | "render"> {
  /**
   * How the contents are shown (the Dock tile option "View content as"). `"fan"`: an arc of
   * thumbnails with labels that rises from the tile. `"grid"`: a panel of icons over their
   * names, four to a row. `"list"`: a menu of names with small icons.
   * @default "fan"
   */
  view?: "fan" | "grid" | "list";
  /** Whether the stack is open. Use with `onOpenChange` to control it. */
  open?: boolean;
  /**
   * Whether the stack is open when it first renders, for a stack that keeps its own state.
   * @default false
   */
  defaultOpen?: boolean;
  /** Called when the stack opens or closes. */
  onOpenChange?: BaseMenu.Root.Props["onOpenChange"];
  /**
   * The contents, as `DockStackItem`s, in the order they are shown from the top: in a fan
   * the last child sits nearest the Dock. The `DockStackMore` is the first child of a fan,
   * whose far end it is, and the last of a grid or a list.
   */
  children?: ReactNode;
}

/**
 * A Dock stack (Dock.app): a folder kept in the Dock. Its tile is a `DockItem`, so it takes
 * the same props (`label`, `icon`, `running`); activating it springs the folder's contents
 * out of the tile, and while they are out the tile shows a placeholder with a down triangle.
 *
 * Built on Base UI's Menu: the tile is the menu's trigger and the contents are its items, in
 * a portal that is in the DOM only while the stack is open. The ref and every other prop go
 * to the tile's button.
 */
export function DockStack({
  view = "fan",
  open,
  defaultOpen = false,
  onOpenChange,
  icon,
  className,
  children,
  onKeyDown,
  ...props
}: DockStackProps) {
  return (
    <BaseMenu.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} modal={false}>
      <DockItem
        render={<BaseMenu.Trigger />}
        className={withClassName("mac-dock-stack", className)}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          // In a Dock on a side, Up and Down Arrow move between the tiles. On a menu's trigger
          // they would open the menu instead, and the keyboard would never get past a stack.
          const tile = event.currentTarget;
          const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
          if (
            step &&
            !event.defaultPrevented &&
            !event.baseUIHandlerPrevented &&
            tile.dataset.orientation === "vertical"
          ) {
            event.preventBaseUIHandler();
            event.preventDefault();
            const tiles = Array.from(
              tile.parentElement?.querySelectorAll<HTMLElement>(".mac-dock-item") ?? [],
            );
            tiles[tiles.indexOf(tile) + step]?.focus();
          }
        }}
        icon={
          <>
            <span className="mac-dock-stack-icon">{icon}</span>
            <span className="mac-dock-stack-placeholder" />
          </>
        }
        {...props}
      />
      <BaseMenu.Portal>
        <BaseMenu.Positioner
          side="top"
          sideOffset={view === "fan" ? OFFSET : 14}
          collisionAvoidance={view === "fan" ? STAY : undefined}
          className="mac-dock-stack-positioner"
        >
          <BaseMenu.Popup data-view={view} className="mac-dock-stack-popup">
            {children}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}

export interface DockStackItemProps extends Omit<BaseMenu.Item.Props, "ref"> {
  /**
   * The item's thumbnail or icon, centred in its box: 60 pt in a fan, 64 pt in a grid, 16 pt
   * in a list. It is decorative: the item is named by its children, the text of its label.
   */
  icon?: ReactNode;
  /** Ref to the rendered menu item. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * One file or folder of an open stack: a thumbnail with its name in a label beside it.
 * `children` are the name; `onClick` opens the item, and the stack closes.
 *
 * Built on Base UI's Menu item and takes its props (`disabled`, `closeOnClick`, `label` for
 * typing ahead).
 */
export function DockStackItem({ icon, className, children, ...props }: DockStackItemProps) {
  return (
    <BaseMenu.Item className={withClassName("mac-dock-stack-item", className)} {...props}>
      <span className="mac-dock-stack-item-label">{children}</span>
      <span className="mac-dock-stack-item-icon" aria-hidden="true">
        {icon}
      </span>
    </BaseMenu.Item>
  );
}

export interface DockStackMoreProps extends Omit<BaseMenu.Item.Props, "ref"> {
  /** Ref to the rendered menu item. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * The element of an open stack that opens the folder itself. In a fan it is the far end: a
 * label, such as "7 More in Finder", beside a round button with an arrow. In a grid or a
 * list it is the last row, "Open in Finder". `children` are the label; `onClick` opens the
 * folder.
 */
export function DockStackMore(props: DockStackMoreProps) {
  return (
    <DockStackItem
      data-more=""
      icon={
        <span className="mac-dock-stack-more">
          <svg
            aria-hidden="true"
            viewBox="0 0 18 18"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          >
            <path d="M4.5 16v-4a5 5 0 0 1 5-5H12" />
            <path d="M11 1.500 17.500 7 11 12.500z" fill="currentColor" stroke="none" />
          </svg>
        </span>
      }
      {...props}
    />
  );
}

"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import { Toolbar as BaseToolbar } from "@base-ui/react/toolbar";
import { createContext, type ReactNode, type Ref, use, useEffect, useId, useRef } from "react";
import { cn, withClassName } from "../../lib/cn";
import "./dock.tokens.css";
import "./dock.css";

/** True below a `Dock`: an item there joins the Dock's arrow-key navigation. */
const DockContext = createContext(false);

/** How far the magnification reaches from the pointer, in tiles (inferred). */
const REACH = 2.5;

/**
 * Magnification: give every child of the Dock its scale and the shift that makes room for its
 * neighbours, as two custom properties the stylesheet turns into transforms. Without `max`
 * the properties are removed. Every tile's place is read before anything is written, and what
 * is read is the layout, which the transforms do not change.
 */
function magnify(dock: HTMLElement, vertical: boolean, max?: number, client = 0) {
  const tiles = Array.from(dock.children) as HTMLElement[];
  const box = dock.getBoundingClientRect();
  const pointer = client - (vertical ? box.top + dock.clientTop : box.left + dock.clientLeft);
  let before = 0;
  const grown = tiles.map((tile) => {
    const size = vertical ? tile.offsetHeight : tile.offsetWidth;
    const from = (vertical ? tile.offsetTop : tile.offsetLeft) - pointer;
    const reach = REACH * size;
    const distance = Math.abs(from + size / 2);
    const near =
      max && distance < reach && tile.matches(".mac-dock-item")
        ? (1 + Math.cos((Math.PI * distance) / reach)) / 2
        : 0;
    const extra = Math.max(0, (max ?? 0) - size) * near;
    // The part of this tile's growth that lies before the pointer: the point under the
    // pointer stays where it is.
    before += extra * Math.min(1, Math.max(0, -from / (size || 1)));
    return [extra, size] as const;
  });
  let shift = -before;
  tiles.forEach((tile, index) => {
    const [extra, size] = grown[index] as (typeof grown)[number];
    if (max) {
      tile.style.setProperty("--_grow", `${1 + extra / (size || 1)}`);
      tile.style.setProperty("--_shift", `${shift + extra / 2}px`);
    } else {
      tile.style.removeProperty("--_grow");
      tile.style.removeProperty("--_shift");
    }
    shift += extra;
  });
}

export interface DockProps extends Omit<BaseToolbar.Root.Props, "orientation" | "ref"> {
  /**
   * The edge of the desktop the Dock sits on (the Dock preference "Position on screen"). At
   * the bottom the tiles are in a row and the Left and Right arrow keys move between them;
   * on the left or right they are in a column and Up and Down do.
   * @default "bottom"
   */
  position?: "bottom" | "left" | "right";
  /**
   * Size in points that the tile under the pointer grows to (the Dock preference
   * "Magnification", 16 to 128); its neighbours grow less. Without it, or with a value no
   * larger than the tiles, nothing grows.
   */
  magnification?: number;
  /** Ref to the rendered toolbar element. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * The Dock (Dock.app): the translucent shelf at the edge of the desktop that holds
 * applications, folders and minimized windows. Put `DockItem`s and `DockSeparator`s inside.
 *
 * Built on Base UI's Toolbar, so it is one tab stop and the arrow keys move between its
 * items; Home and End go to the first and the last. It is named "Dock" unless `aria-label`
 * says otherwise. The shelf is positioned against the edge of its containing block, which is
 * the desktop: an element with `position: relative`, such as a window manager, whose
 * minimizing windows shrink towards it (it carries `data-window-minimize-target`).
 */
export function Dock({
  position = "bottom",
  magnification,
  className,
  onKeyDown,
  onPointerMove,
  onPointerLeave,
  ...props
}: DockProps) {
  const vertical = position !== "bottom";
  // The Dock whose tiles carry magnification styles, from the first move until they are reset.
  const grown = useRef<HTMLElement>(null);
  const reset = () => {
    if (grown.current) magnify(grown.current, vertical);
    grown.current = null;
  };
  // A change of the size or of the edge while tiles are grown starts from tiles at rest.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the reset is for these two props.
  useEffect(() => reset, [magnification, vertical]);
  return (
    <DockContext value={true}>
      <BaseToolbar.Root
        aria-label="Dock"
        data-window-minimize-target=""
        data-position={position}
        data-magnification={magnification ? "" : undefined}
        orientation={vertical ? "vertical" : "horizontal"}
        className={withClassName("mac-dock", className)}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          const dock = event.currentTarget;
          const end = event.key === "End";
          // A key pressed in a popup of an item arrives here too; it is the popup's.
          if (
            event.defaultPrevented ||
            (!end && event.key !== "Home") ||
            !dock.contains(event.target as Node)
          )
            return;
          const items = dock.querySelectorAll<HTMLElement>(".mac-dock-item");
          items[end ? items.length - 1 : 0]?.focus();
          event.preventDefault();
        }}
        onPointerMove={(event) => {
          onPointerMove?.(event);
          const dock = event.currentTarget;
          // Not for a pointer in a popup of an item, which arrives here too, and not for a
          // visitor who prefers reduced motion, for whom nothing would move.
          if (
            magnification &&
            dock.contains(event.target as Node) &&
            !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
          ) {
            grown.current = dock;
            magnify(dock, vertical, magnification, vertical ? event.clientY : event.clientX);
          }
        }}
        onPointerLeave={(event) => {
          onPointerLeave?.(event);
          reset();
        }}
        {...props}
      />
    </DockContext>
  );
}

export interface DockItemProps extends Omit<BaseButton.Props, "ref"> {
  /**
   * The item's name. It is the button's accessible name and the label that appears beside
   * the tile under the pointer and with keyboard focus.
   */
  label: string;
  /**
   * The tile's artwork: an image or a drawing that fills the tile. It is decorative; the
   * name comes from `label`.
   */
  icon?: ReactNode;
  /**
   * Marks an application that is running, or a window that is open, with the indicator dot
   * at the Dock's edge, and adds `runningLabel` to the item's accessible description.
   * @default false
   */
  running?: boolean;
  /**
   * What assistive technology is told about an item that is `running`.
   * @default "running"
   */
  runningLabel?: string;
  /**
   * The icon bounces, as Dock's does for an application that opens or asks for attention. A person
   * who prefers reduced motion sees it still.
   * @default false
   */
  bouncing?: boolean;
  /** Ref to the rendered button. */
  ref?: Ref<HTMLElement>;
}

/**
 * One tile of the Dock: an application, a folder, a file or a minimized window. A `<button>`
 * that shows `icon` and is named by `label`; `onClick` opens the item.
 *
 * Built on Base UI's Toolbar button inside a `Dock`, where it joins the arrow-key navigation,
 * and on Base UI's Button on its own. `children` are drawn over the tile, in front of the
 * icon, from its top trailing corner: a badge, for example.
 */
export function DockItem({
  label,
  icon,
  running = false,
  runningLabel = "running",
  bouncing = false,
  className,
  children,
  "aria-describedby": describedBy,
  ...props
}: DockItemProps) {
  const inDock = use(DockContext);
  const id = useId();
  const rest = {
    "aria-label": label,
    "aria-describedby": cn(describedBy, running && id) || undefined,
    "data-running": running ? "" : undefined,
    "data-bouncing": bouncing ? "" : undefined,
    className: withClassName("mac-dock-item", className),
    ...props,
    children: (
      <>
        <span className="mac-dock-item-icon" aria-hidden="true">
          {icon}
        </span>
        {children}
        <span className="mac-dock-item-label" aria-hidden="true">
          {label}
        </span>
        {running && (
          <span id={id} hidden>
            {runningLabel}
          </span>
        )}
      </>
    ),
  };
  return inDock ? (
    <BaseToolbar.Button {...(rest as BaseToolbar.Button.Props)} />
  ) : (
    <BaseButton {...rest} />
  );
}

export interface DockSeparatorProps extends Omit<BaseToolbar.Separator.Props, "ref"> {
  /** Ref to the rendered separator element. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * The line between two sections of the Dock: applications before it, then folders, minimized
 * windows and the Trash. A 30 pt slot with a 1 pt line. Use it inside a `Dock`.
 */
export function DockSeparator({ className, ...props }: DockSeparatorProps) {
  return (
    <BaseToolbar.Separator className={withClassName("mac-dock-separator", className)} {...props} />
  );
}

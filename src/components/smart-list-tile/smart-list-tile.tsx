"use client";

import { Toggle as BaseToggle } from "@base-ui/react/toggle";
import { useRender } from "@base-ui/react/use-render";
import type { CSSProperties, ReactNode, Ref } from "react";
import { cn } from "../../lib/cn";
import "./smart-list-tile.tokens.css";
import "./smart-list-tile.css";

export interface SmartListTileProps
  extends Omit<BaseToggle.Props, "ref" | "children" | "className" | "render" | "style"> {
  /**
   * The smart list's name, on the tile's last line: "Today", "Scheduled", "All", "Flagged".
   * @default undefined
   */
  children?: ReactNode;
  /**
   * How many items the smart list holds, at the tile's top trailing corner.
   * @default undefined
   */
  count?: ReactNode;
  /**
   * The glyph in the disc, on a 24 pt grid. Draw it with `currentColor`: it is white on the
   * tinted disc and takes the tint on the white disc of the tile that is shown.
   * @default undefined
   */
  icon?: ReactNode;
  /**
   * The smart list's colour, any CSS colour: the disc, and the whole tile while it is shown.
   * Without it the tile is the system blue.
   * @default undefined
   */
  tint?: string;
  /** Class names for the tile. */
  className?: string;
  /** Inline styles for the tile. */
  style?: CSSProperties;
  /** Ref to the button element. */
  ref?: Ref<HTMLButtonElement>;
}

/**
 * A smart-list tile of Reminders: Today, Scheduled, All or Flagged, with a glyph in a coloured
 * disc, a count and a name. The tile whose list is shown takes the list's colour.
 *
 * A toggle button, built on Base UI's Toggle: `pressed` says whether the tile's list is the one
 * shown, and `onPressedChange` hears a click. The name and the count are its accessible name.
 */
export function SmartListTile({
  children,
  count,
  icon,
  tint,
  className,
  style,
  ...props
}: SmartListTileProps) {
  return (
    <BaseToggle
      {...props}
      className={cn("mac-smart-list-tile", className)}
      style={tint ? ({ "--mac-smart-list-tile-tint": tint, ...style } as CSSProperties) : style}
    >
      <span className="mac-smart-list-tile-disc" aria-hidden="true">
        {icon}
      </span>
      <span className="mac-smart-list-tile-name">{children}</span>{" "}
      {count != null ? <span className="mac-smart-list-tile-count">{count}</span> : null}
    </BaseToggle>
  );
}

export interface SmartListTileGridProps extends useRender.ComponentProps<"div"> {}

/**
 * Lays the tiles out as Reminders does: two equal columns, 8 pt apart both ways. Renders a
 * `<div role="group">`; name it with `aria-label` ("Smart Lists") or `aria-labelledby`.
 */
export function SmartListTileGrid({ className, render, ref, ...props }: SmartListTileGridProps) {
  return useRender({
    defaultTagName: "div",
    render,
    ref,
    props: {
      role: "group",
      ...props,
      className: cn("mac-smart-list-tile-grid", className),
    },
  });
}

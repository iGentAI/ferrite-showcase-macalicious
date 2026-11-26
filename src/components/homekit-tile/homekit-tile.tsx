"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import { Toggle as BaseToggle } from "@base-ui/react/toggle";
import { useRender } from "@base-ui/react/use-render";
import type { CSSProperties, ReactNode, Ref } from "react";
import { cn } from "../../lib/cn";
import { useControlled } from "../../lib/use-controlled";
import "./homekit-tile.tokens.css";
import "./homekit-tile.css";

export interface HomekitTileProps
  extends Omit<
    BaseButton.Props,
    "ref" | "children" | "className" | "render" | "style" | "name" | "value"
  > {
  /**
   * What the tile stands for. An `"accessory"` is a square tile with up to three lines of text
   * that toggles; a `"scene"` is a wide tile with one line that runs the scene when clicked.
   * @default "accessory"
   */
  kind?: "accessory" | "scene";
  /** The accessory's or the scene's name: the second line of an accessory, a scene's title. */
  name: ReactNode;
  /** The room an accessory is in, its first line. Not shown on a scene. */
  room?: ReactNode;
  /** An accessory's state in words ("On", "Off", "72%"), its last line. Not shown on a scene. */
  status?: ReactNode;
  /**
   * The glyph, about 24 pt. Draw it with `currentColor`: it takes `tint` while the tile is
   * active and the tile's text tone while it is not.
   */
  icon?: ReactNode;
  /** A small mark in a 13 pt circle on the glyph's lower right, such as a muted microphone. */
  badge?: ReactNode;
  /**
   * Colour of the glyph on an active tile, any CSS colour. The default is the yellow of a
   * light that is on.
   */
  tint?: string;
  /**
   * `"more"` gives an inactive tile white text and glyph in place of the tone-on-tone ones,
   * which are hard to read. Readers whose system asks for more contrast get it without it.
   * @default "standard"
   */
  contrast?: "standard" | "more";
  /** Whether the accessory is on or the scene is active. Controlled; see `defaultActive`. */
  active?: boolean;
  /**
   * Whether the tile starts active, when `active` is not given.
   * @default false
   */
  defaultActive?: boolean;
  /**
   * Called with the new state when an accessory tile is toggled. A scene tile does not toggle:
   * use `onClick` to run the scene and set `active` when it has run.
   */
  onActiveChange?: (active: boolean) => void;
  /** Class names for the tile. */
  className?: string;
  /** Inline styles for the tile. */
  style?: CSSProperties;
  /** Ref to the button element. */
  ref?: Ref<HTMLButtonElement>;
}

/**
 * A tile of the Home app: one accessory or one scene.
 *
 * An active tile is opaque white with black text and a coloured glyph; an inactive tile is a
 * translucent panel over what is behind it, usually a wallpaper, with tone-on-tone text. An
 * accessory tile is a toggle button, built on Base UI's Toggle; a scene tile is a button,
 * built on Base UI's Button, that its owner sets active. On both `aria-pressed` says whether
 * the tile is active. The tile's lines are its accessible name.
 */
export function HomekitTile({
  kind = "accessory",
  name,
  room,
  status,
  icon,
  badge,
  tint,
  contrast = "standard",
  active: controlled,
  defaultActive = false,
  onActiveChange,
  className,
  style,
  ...props
}: HomekitTileProps) {
  const [active, setActive] = useControlled(controlled, defaultActive, onActiveChange);
  const scene = kind === "scene";
  const shared = {
    ...props,
    "data-kind": kind,
    "data-active": active ? "" : undefined,
    "data-contrast": contrast === "more" ? contrast : undefined,
    className: cn("mac-homekit-tile", className),
    style: tint ? ({ "--mac-homekit-tile-tint": tint, ...style } as CSSProperties) : style,
  };
  const content = (
    <>
      {icon || badge ? (
        <span className="mac-homekit-tile-icon" aria-hidden="true">
          {icon}
          {badge ? <span className="mac-homekit-tile-badge">{badge}</span> : null}
        </span>
      ) : null}
      <span className="mac-homekit-tile-text">
        {!scene && room ? <span className="mac-homekit-tile-room">{room}</span> : null}{" "}
        <span className="mac-homekit-tile-name">{name}</span>{" "}
        {!scene && status ? <span className="mac-homekit-tile-status">{status}</span> : null}
      </span>
    </>
  );
  if (scene)
    return (
      <BaseButton aria-pressed={active} {...shared}>
        {content}
      </BaseButton>
    );
  return (
    <BaseToggle {...shared} pressed={active} onPressedChange={(next) => setActive(next)}>
      {content}
    </BaseToggle>
  );
}

export interface HomekitTileGridProps extends useRender.ComponentProps<"div"> {}

/**
 * Lays tiles out as Home does: in rows that wrap, 7.5 pt apart both ways, at their own size.
 * Renders a `<div role="group">`; name it with `aria-label` or, when a heading stands above it
 * ("Favorite Accessories"), with `aria-labelledby`.
 */
export function HomekitTileGrid({ className, render, ref, ...props }: HomekitTileGridProps) {
  return useRender({
    defaultTagName: "div",
    render,
    ref,
    props: {
      role: "group",
      ...props,
      className: cn("mac-homekit-tile-grid", className),
    },
  });
}

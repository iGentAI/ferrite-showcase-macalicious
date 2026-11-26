"use client";

import { useRender } from "@base-ui/react/use-render";
import type { ReactNode } from "react";
import { cn, withClassName } from "../../lib/cn";
import { ImageButton, type ImageButtonProps } from "../image-button";
import "./preference-pane-icon.tokens.css";
import "./preference-pane-icon.css";

export interface PreferencePaneIconProps
  extends Omit<ImageButtonProps, "label" | "layout" | "title"> {
  /**
   * The pane's name, shown centred under the artwork and used as the button's name. A line
   * break in the string (`"Desktop &\nScreen Saver"`) is kept, as System Preferences breaks
   * its captions at fixed places; at most two lines are shown.
   */
  title: ReactNode;
  /**
   * The pane's artwork, centred in a 40 pt square: a `PreferencePaneIconArtwork`, an `<img>`
   * or an inline SVG. It is decorative, so give an image an empty `alt`.
   */
  children?: ReactNode;
}

/**
 * One pane of the System Preferences grid: artwork in a 40 pt square with the pane's name
 * under it, in a column slot 82 pt wide. Clicking it opens the pane; it is a momentary button
 * and has no selected state.
 *
 * Built on `ImageButton` (Base UI's Button), so it also accepts `disabled`,
 * `focusableWhenDisabled`, `render` and every native button attribute.
 */
export function PreferencePaneIcon({
  title,
  className,
  children,
  ...props
}: PreferencePaneIconProps) {
  return (
    <ImageButton
      label={title}
      className={withClassName("mac-preference-pane-icon", className)}
      {...props}
    >
      {children == null || typeof children === "boolean" ? null : (
        <span className="mac-preference-pane-icon-image">{children}</span>
      )}
    </ImageButton>
  );
}

export interface PreferencePaneIconGridProps extends useRender.ComponentProps<"div"> {
  /**
   * Number of 82 pt columns.
   * @default 8
   */
  columns?: number;
}

/**
 * The grid of System Preferences: columns 82 pt apart and rows 91 pt apart, filled with
 * `PreferencePaneIcon`s in reading order. It is a plain container without a role; the bands
 * behind the rows belong to the window.
 */
export function PreferencePaneIconGrid({
  columns = 8,
  className,
  style,
  render,
  ref,
  ...props
}: PreferencePaneIconGridProps) {
  return useRender({
    defaultTagName: "div",
    render,
    ref,
    props: {
      ...props,
      className: cn("mac-preference-pane-icon-grid", className),
      style: { "--_columns": columns, ...style } as typeof style,
    },
  });
}

export interface PreferencePaneIconArtworkProps extends useRender.ComponentProps<"span"> {
  /**
   * Outline of the drawing: a rounded square or a disc.
   * @default "tile"
   */
  shape?: "tile" | "circle";
  /**
   * Fill of the drawing, from the system colours.
   * @default "gray"
   */
  tint?: "blue" | "gray" | "graphite" | "green" | "orange" | "purple" | "red" | "white";
  /** A glyph drawn over the fill in its contrast colour: an inline SVG that uses `currentColor`. */
  children?: ReactNode;
}

/**
 * Stand-in artwork for a pane: a tinted 37 pt tile or disc with an optional glyph. It is an
 * original neutral drawing, not Apple's icon, and is hidden from assistive technology because
 * the pane's title names the button.
 */
export function PreferencePaneIconArtwork({
  shape = "tile",
  tint = "gray",
  className,
  render,
  ref,
  ...props
}: PreferencePaneIconArtworkProps) {
  return useRender({
    defaultTagName: "span",
    render,
    ref,
    props: {
      "aria-hidden": true,
      "data-shape": shape,
      "data-tint": tint,
      ...props,
      className: cn("mac-preference-pane-icon-artwork", className),
    },
  });
}

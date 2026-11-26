"use client";

import { Toolbar as BaseToolbar } from "@base-ui/react/toolbar";
import type { ComponentProps, Ref } from "react";
import { cn, withClassName } from "../../lib/cn";
import "./markup-toolbar.tokens.css";
import "./markup-toolbar.css";

export interface MarkupToolbarProps extends Omit<BaseToolbar.Root.Props, "ref" | "orientation"> {
  /** Ref to the rendered toolbar element. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * The Markup toolbar of Quick Look and Preview: a row of borderless glyph tools for
 * annotating an image or a PDF, with thin separators between groups.
 *
 * It is a horizontal row with no background of its own: put it in the `tools` of a
 * `QuickLookPanel`, or in any bar. Built on Base UI's Toolbar, so it is one tab stop and Left
 * and Right Arrow move between its tools. Give it an `aria-label`.
 */
export function MarkupToolbar({ className, ...props }: MarkupToolbarProps) {
  return (
    <BaseToolbar.Root
      className={withClassName("mac-markup-toolbar", className)}
      {...props}
      orientation="horizontal"
    />
  );
}

export interface MarkupToolbarToolProps extends Omit<BaseToolbar.Button.Props, "ref"> {
  /**
   * Marks the active drawing tool: tinted with the accent colour, and `aria-pressed` is set.
   * Leave it undefined on a tool that is not a mode (Rotate, Crop, a tool that opens a menu),
   * so that it is announced as a plain button.
   */
  selected?: boolean;
  /**
   * Draws the small chevron of a tool that opens a menu or a popover of choices, and sets
   * `aria-haspopup`. Opening it is yours: give the tool to the menu's trigger with `render`.
   * @default false
   */
  menu?: boolean;
  /** Ref to the rendered button. */
  ref?: Ref<HTMLButtonElement>;
}

/**
 * One tool of a Markup toolbar: a glyph of about 16 pt (the children), which takes the tool's
 * colour through `currentColor`. Renders Base UI's Toolbar.Button. It needs an `aria-label`.
 */
export function MarkupToolbarTool({
  selected,
  menu = false,
  className,
  children,
  ...props
}: MarkupToolbarToolProps) {
  return (
    <BaseToolbar.Button
      aria-pressed={selected}
      aria-haspopup={menu ? "menu" : undefined}
      data-selected={selected ? "" : undefined}
      className={withClassName("mac-markup-toolbar-tool", className)}
      {...props}
    >
      {children}
      {menu ? (
        <svg
          className="mac-markup-toolbar-tool-chevron"
          viewBox="0 0 8 5"
          width="8"
          height="5"
          aria-hidden="true"
        >
          <path d="M.75.75L4 4 7.25.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ) : null}
    </BaseToolbar.Button>
  );
}

export interface MarkupToolbarSeparatorProps extends Omit<BaseToolbar.Separator.Props, "ref"> {
  /** Ref to the rendered element. */
  ref?: Ref<HTMLDivElement>;
}

/** The 1 pt, 20 pt high line between two groups of tools. Renders Base UI's Toolbar.Separator. */
export function MarkupToolbarSeparator({ className, ...props }: MarkupToolbarSeparatorProps) {
  return (
    <BaseToolbar.Separator
      className={withClassName("mac-markup-toolbar-separator", className)}
      {...props}
    />
  );
}

export interface MarkupToolbarSwatchProps extends ComponentProps<"span"> {
  /**
   * The colour shown: any CSS colour. Without it the swatch shows "none", a white square
   * with a red diagonal.
   */
  color?: string;
  /**
   * `"fill"` is a solid square; `"border"` a square outline, as in the Border Colour tool.
   * @default "fill"
   */
  variant?: "fill" | "border";
}

/**
 * The 15 pt colour swatch that stands for the glyph in the Border Colour and Fill Colour
 * tools. Decorative: the tool's `aria-label` says what it is for.
 */
export function MarkupToolbarSwatch({
  color,
  variant = "fill",
  className,
  style,
  ...props
}: MarkupToolbarSwatchProps) {
  return (
    <span
      aria-hidden="true"
      data-variant={variant}
      data-none={color === undefined ? "" : undefined}
      className={cn("mac-markup-toolbar-swatch", className)}
      style={color === undefined ? style : { color, ...style }}
      {...props}
    />
  );
}

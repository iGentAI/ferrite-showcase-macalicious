"use client";

import { Toolbar as BaseToolbar } from "@base-ui/react/toolbar";
import { type ComponentProps, type Ref, useRef } from "react";
import { cn, withClassName } from "../../lib/cn";
import { ToolbarContext } from "../../lib/toolbar-context";
import "./toolbar.css";

export interface ToolbarProps extends Omit<BaseToolbar.Root.Props, "ref"> {
  /**
   * What each item shows (NSToolbar.displayMode). `"icon-only"`: the controls.
   * `"icon-and-label"`: every `ToolbarLabelledItem` shows its label under its control, and the
   * bar grows by the label's height. `"label-only"`: labelled items show only their label.
   * @default "icon-only"
   */
  displayMode?: "icon-only" | "icon-and-label" | "label-only";
  /** Ref to the rendered toolbar element. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * A window's toolbar (NSToolbar): a row of toolbar controls, 8 pt apart and 8 pt from the
 * window's edges, with flexible space between groups.
 *
 * It has no background of its own: put it in a `TitleBar` (as its children), whose surface it
 * shares. Built on Base UI's Toolbar, so it is one tab stop and the arrow keys move between
 * its items; toolbar buttons, segmented controls and search fields register with it by
 * themselves. Give it an `aria-label`.
 *
 * A text field in it selects its text when the keyboard moves focus to it and takes the caret
 * where it is clicked, as in AppKit.
 */
export function Toolbar({
  displayMode = "icon-only",
  className,
  onFocus,
  onBlur,
  onMouseDownCapture,
  onMouseUpCapture,
  onKeyDownCapture,
  ...props
}: ToolbarProps) {
  // True from a press on a text field until the focus it causes. Base UI's toolbar selects a
  // field's text on every focus; AppKit does that for keyboard focus only. Mouse events, not
  // pointer events, on purpose: the focus is the default action of mousedown for a mouse, a
  // pen and a touch alike, and a touch's pointerup comes before its mousedown.
  const pressedField = useRef(false);
  return (
    <ToolbarContext value={true}>
      <BaseToolbar.Root
        data-display-mode={displayMode}
        className={withClassName("mac-toolbar", className)}
        onMouseDownCapture={(event) => {
          pressedField.current = event.target instanceof HTMLInputElement;
          onMouseDownCapture?.(event);
        }}
        onMouseUpCapture={(event) => {
          pressedField.current = false;
          onMouseUpCapture?.(event);
        }}
        onKeyDownCapture={(event) => {
          pressedField.current = false;
          onKeyDownCapture?.(event);
        }}
        onBlur={(event) => {
          // Focus moving within the toolbar blurs one item before it focuses the pressed field.
          if (!event.currentTarget.contains(event.relatedTarget)) pressedField.current = false;
          onBlur?.(event);
        }}
        onFocus={(event) => {
          onFocus?.(event);
          if (pressedField.current) event.preventBaseUIHandler();
          pressedField.current = false;
        }}
        {...props}
      />
    </ToolbarContext>
  );
}

export interface ToolbarSpaceProps extends ComponentProps<"div"> {
  /**
   * A fixed width in points (NSToolbarItem.Identifier.space is 32 by convention). Without it
   * the space is flexible and takes every point the items leave, so what follows it is pushed
   * to the trailing edge.
   */
  width?: number;
}

/** Empty space between toolbar items: flexible by default, or of a fixed `width`. */
export function ToolbarSpace({ width, className, style, ...props }: ToolbarSpaceProps) {
  return (
    <div
      aria-hidden="true"
      data-flexible={width === undefined ? "" : undefined}
      className={cn("mac-toolbar-space", className)}
      style={width === undefined ? style : { width, ...style }}
      {...props}
    />
  );
}

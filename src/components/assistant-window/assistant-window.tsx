"use client";

import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { TitleBar, type TitleBarProps } from "../title-bar";
import { Window, WindowBody, type WindowProps } from "../window";
import { WindowControls } from "../window-controls";
import "./assistant-window.tokens.css";
import "./assistant-window.css";

export interface AssistantWindowProps extends Omit<WindowProps, "title"> {
  /** The window title, centred in the title bar: the assistant's name. It names the window. */
  title?: ReactNode;
  /**
   * The picture of the column at the left, which stays while the steps change. It may be wider
   * than its column and then reaches over the step. Decorative; the library ships no artwork.
   */
  artwork?: ReactNode;
  /**
   * The window controls. Pass `null` for none.
   * @default the usual three with zoom disabled
   */
  controls?: ReactNode;
  /** Called when the close button is activated. */
  onClose?: (event: MouseEvent<HTMLElement>) => void;
  /**
   * Called when Escape is pressed inside the window and nothing inside has used the key: go
   * back a step, or leave the assistant.
   */
  onCancel?: () => void;
  /**
   * Called when the primary pointer button goes down on the title bar itself, not on a window
   * control in it. A window manager starts moving the window here.
   */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /** Called when the title bar itself is double-clicked. */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
  /**
   * Frame width: a number of points or any CSS length. An assistant is not resizable.
   * @default 783
   */
  width?: number | string;
  /**
   * Frame height.
   * @default 548
   */
  height?: number | string;
}

/**
 * An assistant, as Boot Camp Assistant: a fixed-size `Window` that walks through a task one
 * step at a time. A column of artwork stays at the left; the step fills the rest, top to
 * bottom: an `AssistantWindowHeading`, an `AssistantWindowText` or an
 * `AssistantWindowContent`, and the `AssistantWindowActions`.
 *
 * It is a `Window` and takes its props (`state`, `style`, `ref`). Like it, the assistant is
 * presentational: it keeps no step of its own. Render the step you are at, and change it from
 * the buttons.
 */
export function AssistantWindow({
  title,
  artwork,
  controls,
  onClose,
  onCancel,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  width = 783,
  height = 548,
  className,
  onKeyDown,
  children,
  ...props
}: AssistantWindowProps) {
  return (
    <Window
      width={width}
      height={height}
      className={cn("mac-assistant-window", className)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.key === "Escape" && !event.defaultPrevented) onCancel?.();
      }}
      {...props}
    >
      <TitleBar
        title={title}
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
        controls={
          controls === undefined ? (
            <WindowControls zoomRole="zoom" zoomDisabled onClose={onClose} />
          ) : (
            controls
          )
        }
      />
      <WindowBody className="mac-assistant-window-body">
        <div className="mac-assistant-window-artwork" aria-hidden="true">
          {artwork}
        </div>
        <div className="mac-assistant-window-step">{children}</div>
      </WindowBody>
    </Window>
  );
}

export interface AssistantWindowHeadingProps extends ComponentProps<"h1"> {}

/**
 * The name of the step, in bold above its content: "Introduction". Renders an `<h1>` that is a
 * polite live region, so that a screen reader says the new step when it changes.
 */
export function AssistantWindowHeading({ className, ...props }: AssistantWindowHeadingProps) {
  return (
    <h1 aria-live="polite" className={cn("mac-assistant-window-heading", className)} {...props} />
  );
}

export interface AssistantWindowTextProps extends ComponentProps<"div"> {}

/**
 * The bordered box of text that fills a step: paragraphs (`<p>`) that can be selected and
 * not edited. It scrolls when the text is longer than the box, and is a tab stop so that the
 * keyboard can scroll it. It is a `group`; name it with `aria-labelledby` and the heading's
 * `id`.
 */
export function AssistantWindowText({ className, ...props }: AssistantWindowTextProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring a legend and a border; the box is a plain group that can be named.
    <div
      role="group"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the box scrolls and holds only text, so it has to be a tab stop itself for the keyboard to scroll it.
      tabIndex={0}
      className={cn("mac-assistant-window-text", className)}
      {...props}
    />
  );
}

export interface AssistantWindowContentProps extends ComponentProps<"div"> {}

/**
 * The area of a step that is not a box of text: a choice of tasks, a progress bar, a form. It
 * takes the room the text box would, without a border or a fill.
 */
export function AssistantWindowContent({ className, ...props }: AssistantWindowContentProps) {
  return <div className={cn("mac-assistant-window-content", className)} {...props} />;
}

export interface AssistantWindowActionsProps extends ComponentProps<"div"> {
  /**
   * Controls at the leading end of the row, under the left edge of the text: a button that
   * opens the help.
   */
  leading?: ReactNode;
}

/**
 * The button row at the bottom of a step. Its children are the navigation buttons, set at the
 * trailing end with Continue last and Go Back before it; each is at least
 * `--mac-assistant-window-button-min-width` wide.
 */
export function AssistantWindowActions({
  leading,
  className,
  children,
  ...props
}: AssistantWindowActionsProps) {
  return (
    <div className={cn("mac-assistant-window-actions", className)} {...props}>
      {leading === undefined ? null : (
        <div className="mac-assistant-window-actions-leading">{leading}</div>
      )}
      <div className="mac-assistant-window-actions-trailing">{children}</div>
    </div>
  );
}

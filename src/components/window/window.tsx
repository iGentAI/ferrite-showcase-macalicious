"use client";

import { type ComponentProps, useCallback, useId, useMemo, useState } from "react";
import { cn } from "../../lib/cn";
import { WindowContext } from "../../lib/window-context";
import { WindowShadow } from "../window-shadow";
import "./window.tokens.css";
import "./window.css";

/** AppKit's three window states (CONTRIBUTING, "Window state"). */
export type WindowState = "key" | "main" | "inactive";

export interface WindowProps extends ComponentProps<"div"> {
  /**
   * Whether the window is key (receives keyboard input), main (the front document window while
   * a panel or its own sheet is key) or inactive (behind another window). Written to the root
   * as `data-window-state`; the frame and every control inside restyle themselves from it. A
   * window manager decides which window is key: exactly one on a page.
   * @default "key"
   */
  state?: WindowState;
  /**
   * `"standard"` is a document or application window; `"panel"` is a utility panel, which
   * casts the smaller panel shadow.
   * @default "standard"
   */
  variant?: "standard" | "panel";
  /**
   * Full-screen presentation: no corner radius, outer hairline, rim or shadow. The size is
   * still yours to set.
   * @default false
   */
  fullScreen?: boolean;
  /**
   * Draws the two highlight rows of a title bar along the window's top edge, over the content.
   * For a window without a title bar, whose content reaches the top edge, such as App Store's
   * full-height sidebar; a `TitleBar` draws these rows itself. Not drawn in full screen.
   * @default false
   */
  topHighlight?: boolean;
  /** Frame width: a number of points, or any CSS length. Position the window with `style`. */
  width?: number | string;
  /** Frame height: a number of points, or any CSS length. */
  height?: number | string;
}

/**
 * A Catalina window frame (NSWindow): the rounded, shadowed box that holds a title bar, an
 * optional tab bar and scope bar, a body and an optional bottom bar, stacked top to bottom.
 *
 * It is presentational. It draws the frame for the state it is given and exposes that state to
 * its content as `data-window-state`, but it does not move, resize, order or focus itself: a
 * window manager does that with `state`, `width`, `height`, `style`, `ref`, the root's pointer
 * events, the title bar's drag-region callbacks and the window controls' callbacks.
 *
 * The root is a labelled `region`, named by the title of the `TitleBar` inside it; pass
 * `aria-label` for a window without a title, and `role="dialog"` for a panel or dialog.
 */
export function Window({
  state = "key",
  variant = "standard",
  fullScreen = false,
  topHighlight = false,
  width,
  height,
  className,
  style,
  children,
  ...props
}: WindowProps) {
  const titleId = useId();
  const [titled, setTitled] = useState(false);
  const registerTitle = useCallback(() => {
    setTitled(true);
    return () => setTitled(false);
  }, []);
  const context = useMemo(() => ({ titleId, registerTitle }), [titleId, registerTitle]);
  const labelled = props["aria-label"] !== undefined || props["aria-labelledby"] !== undefined;

  return (
    <WindowShadow
      role="region"
      aria-labelledby={titled && !labelled ? titleId : undefined}
      level={fullScreen ? "none" : variant === "panel" ? "panel" : "window"}
      data-window-state={state}
      data-variant={variant}
      data-full-screen={fullScreen ? "" : undefined}
      data-top-highlight={topHighlight ? "" : undefined}
      className={cn("mac-window", className)}
      style={width === undefined && height === undefined ? style : { width, height, ...style }}
      {...props}
    >
      <WindowContext value={context}>{children}</WindowContext>
    </WindowShadow>
  );
}

export interface WindowBodyProps extends ComponentProps<"div"> {
  /**
   * The fill behind the content: `"window"` is the window background of dialogs and
   * preference panes, `"content"` the white (dark: near black) of lists, browsers and
   * documents.
   * @default "window"
   */
  background?: "window" | "content";
}

/**
 * The body area of a window: takes the height the bars leave, scrolls when its content is
 * taller, and is clipped by the window's bottom corners.
 */
export function WindowBody({ background = "window", className, ...props }: WindowBodyProps) {
  return (
    <div data-background={background} className={cn("mac-window-body", className)} {...props} />
  );
}

"use client";

import { useRender } from "@base-ui/react/use-render";
import { type FocusEvent, type ReactNode, useRef } from "react";
import { cn } from "../../lib/cn";
import { useControlled } from "../../lib/use-controlled";
import { Window, type WindowProps } from "../window";
import "./full-screen-window.tokens.css";
import "./full-screen-window.css";

export interface FullScreenWindowProps extends WindowProps {
  /**
   * The screen's menu bar. In full screen it is out of sight above the top edge and slides
   * down, over the content, when the bars are revealed. It is not rendered outside full screen.
   */
  menuBar?: ReactNode;
  /** The window's own top bar: a `TitleBar`, with its toolbar and window controls. */
  titleBar?: ReactNode;
  /**
   * Whether the title bar hides with the menu bar (`NSApplication.PresentationOptions
   * .autoHideToolbar`). Without it the title bar stays at the top of the screen and moves
   * down to make room for the menu bar.
   * @default false
   */
  autoHideToolbar?: boolean;
  /** Whether the bars are revealed, controlled. */
  revealed?: boolean;
  /**
   * Whether the bars are revealed at first.
   * @default false
   */
  defaultRevealed?: boolean;
  /**
   * Called when the bars should appear or hide: the pointer reaches the top edge or leaves
   * the bars, or keyboard focus moves into or out of them.
   */
  onRevealedChange?: (revealed: boolean) => void;
  /**
   * Whether the window is in full screen. Set it to `false` to show the same window with an
   * ordinary title bar, so that one tree serves a window that enters and leaves full screen.
   * @default true
   */
  fullScreen?: boolean;
  /**
   * The root element, in place of a `Window`: pass `<div />` when a window is already around
   * it, as inside a `ManagedWindow`. The `Window` props are then not for this component.
   */
  render?: useRender.ComponentProps<"div">["render"];
}

/**
 * A window in full screen: it fills its Space without frame, and the menu bar, with the title
 * bar if that hides too, slides down over the content when the pointer reaches the top edge
 * or keyboard focus moves into the bars. Children are the window's content.
 */
export function FullScreenWindow({
  menuBar,
  titleBar,
  autoHideToolbar = false,
  revealed: revealedProp,
  defaultRevealed = false,
  onRevealedChange,
  fullScreen = true,
  render,
  ref,
  className,
  children,
  ...props
}: FullScreenWindowProps) {
  const [revealed, setRevealed] = useControlled(revealedProp, defaultRevealed, onRevealedChange);
  // Why the bars are down: the pointer came to the top edge and is still over them, or
  // keyboard focus is inside. They hide when neither holds.
  const reasons = useRef({ pointer: false, focus: false });
  const reveal = (reason: "pointer" | "focus", on: boolean) => {
    reasons.current[reason] = on;
    const next = fullScreen && (reasons.current.pointer || reasons.current.focus);
    if (next !== revealed) setRevealed(next);
  };
  // What brings down the hidden bars, and keeps them down, when the pointer or keyboard focus
  // is inside them: every bar when the title bar hides, else the menu bar alone.
  const hidden = {
    onPointerEnter: () => reveal("pointer", true),
    onFocus: () => reveal("focus", true),
    onBlur: (event: FocusEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget)) reveal("focus", false);
    },
  };

  return useRender({
    render: render ?? <Window fullScreen={fullScreen} />,
    ref,
    props: {
      "data-full-screen": fullScreen ? "" : undefined,
      "data-revealed": fullScreen && revealed ? "" : undefined,
      "data-auto-hide-toolbar": autoHideToolbar ? "" : undefined,
      ...props,
      className: cn("mac-full-screen-window", className),
      children: (
        <>
          <div
            className="mac-full-screen-window-bars"
            onPointerLeave={() => reveal("pointer", false)}
            {...(autoHideToolbar && hidden)}
          >
            {fullScreen ? (
              <div
                className="mac-full-screen-window-edge"
                onPointerEnter={() => reveal("pointer", true)}
              />
            ) : null}
            <div className="mac-full-screen-window-panel">
              {fullScreen && menuBar ? (
                <div className="mac-full-screen-window-menu-bar" {...(!autoHideToolbar && hidden)}>
                  {menuBar}
                </div>
              ) : null}
              {titleBar}
            </div>
          </div>
          {children}
        </>
      ),
    },
  });
}

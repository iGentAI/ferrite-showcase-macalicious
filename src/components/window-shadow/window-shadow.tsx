import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";
import "./window-shadow.css";

/** The window server's shadow classes that the Catalina screenshots show. */
export type WindowShadowLevel = "window" | "panel" | "menu" | "popover" | "banner" | "none";

export interface WindowShadowProps extends ComponentProps<"div"> {
  /**
   * Which shadow the surface casts. `"window"` is a document or application window, and is the
   * only level that shrinks when its window is inactive; `"panel"` is a utility panel;
   * `"menu"` and `"popover"` are the small transient surfaces; `"banner"` is a notification;
   * `"none"` keeps the element and its corner radius without a shadow (a full-screen window).
   * @default "window"
   */
  level?: WindowShadowLevel;
}

/**
 * The shadow and outer hairline that the window server draws around a surface: a rounded box
 * that casts the measured Catalina shadow for its level. `Window` is built on it; use it
 * directly for a custom floating surface.
 *
 * The shadow takes no part in layout. It follows `data-window-state` on itself or an ancestor.
 */
export function WindowShadow({ level = "window", className, ...props }: WindowShadowProps) {
  return <div data-level={level} className={cn("mac-window-shadow", className)} {...props} />;
}

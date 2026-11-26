"use client";

import {
  type ComponentProps,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  use,
  useEffect,
} from "react";
import { cn } from "../../lib/cn";
import { WindowContext } from "../../lib/window-context";
import { isWindowDragRegion } from "../../lib/window-drag-region";
import "./title-bar.tokens.css";
import "./title-bar.css";

export interface TitleBarProps extends Omit<ComponentProps<"div">, "title"> {
  /**
   * The layout of the frame's top bar.
   * `"standard"` is the plain 22 pt title bar. `"unified"` puts a toolbar (the children) under
   * the title strip on one continuous surface, 55 pt with an icon-only toolbar.
   * `"title-hidden"` puts the window controls and the toolbar on one 38 pt row; a title, if
   * given, is centred over that row. `"utility"` is the small 16 pt strip of a utility panel,
   * with a toolbar under it if there are children.
   * @default "standard"
   */
  variant?: "standard" | "unified" | "title-hidden" | "utility";
  /** The window title. It names the window for assistive technology. */
  title?: ReactNode;
  /** The 16 pt proxy icon shown before the title of a document window. Decorative. */
  icon?: ReactNode;
  /** The close, minimize and zoom buttons: a `WindowControls` element. */
  controls?: ReactNode;
  /**
   * What the bar's bottom edge borders. `"content"` draws the shadow row and the dark
   * separator that meet the window's body. `"bar"` draws the lighter pair of rows that Catalina
   * uses when another bar follows directly: a window tab bar or a scope bar. `"line"` draws
   * both rows in one colour, the single line Dictionary has above its scope bar.
   * @default "content"
   */
  divider?: "content" | "bar" | "line";
  /**
   * What the bar is made of. `"opaque"` is the bar of every ordinary window. `"translucent"`
   * is the bar of a movie window, laid over the picture as in QuickTime Player: a dark tint
   * over a blur of whatever is behind the bar. It is dark in Aqua and in Dark Aqua alike, so
   * the bar then carries `data-appearance="dark"` and the window controls, the title and a
   * toolbar inside it are drawn in Dark Aqua.
   * @default "opaque"
   */
  material?: "opaque" | "translucent";
  /**
   * Called when the primary pointer button goes down on the bar itself, not on a control in
   * it. A window manager starts moving the window here.
   */
  onDragRegionPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  /**
   * Called when the bar itself is double-clicked. macOS zooms or minimizes the window,
   * following the Dock preference.
   */
  onDragRegionDoubleClick?: (event: MouseEvent<HTMLDivElement>) => void;
}

/**
 * The bar at the top of a window frame: window controls at the leading edge, the title centred
 * on the window, and, in the unified and title-hidden layouts, a toolbar on the same surface.
 * Children are the toolbar (or any accessory row).
 *
 * The whole bar is the window's drag region. The bar does not move anything itself; it reports
 * pointer-down and double-click on its own surface through the two drag-region callbacks.
 */
export function TitleBar({
  variant = "standard",
  title,
  icon,
  controls,
  divider = "content",
  material = "opaque",
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  onPointerDown,
  onDoubleClick,
  className,
  children,
  ...props
}: TitleBarProps) {
  const windowContext = use(WindowContext);
  const hasTitle = title !== undefined && title !== null && title !== false;
  const registerTitle = windowContext?.registerTitle;

  useEffect(() => {
    if (hasTitle && registerTitle) return registerTitle();
  }, [hasTitle, registerTitle]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the bar is a pointer-only drag region; every command it offers is also a window control or a menu command.
    <div
      data-variant={variant}
      data-title-bar={variant}
      data-divider={divider}
      data-material={material}
      data-window-drag-region=""
      className={cn("mac-title-bar", className)}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (event.defaultPrevented) return;
        if (event.button === 0 && isWindowDragRegion(event.target))
          onDragRegionPointerDown?.(event);
      }}
      onDoubleClick={(event) => {
        onDoubleClick?.(event);
        if (event.defaultPrevented) return;
        if (isWindowDragRegion(event.target)) onDragRegionDoubleClick?.(event);
      }}
      {...props}
      // After the caller's props: a translucent bar is dark whatever the page or the caller
      // says, and an opaque bar keeps the appearance a caller gives it.
      {...(material === "translucent" ? { "data-appearance": "dark" } : {})}
    >
      {controls ? <div className="mac-title-bar-controls">{controls}</div> : null}
      {hasTitle || icon ? (
        <div className="mac-title-bar-title">
          {icon ? (
            <span className="mac-title-bar-icon" aria-hidden="true">
              {icon}
            </span>
          ) : null}
          {hasTitle ? (
            <span className="mac-title-bar-title-text" id={windowContext?.titleId}>
              {title}
            </span>
          ) : null}
        </div>
      ) : null}
      {children ? <div className="mac-title-bar-content">{children}</div> : null}
    </div>
  );
}

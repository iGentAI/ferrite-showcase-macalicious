"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import { type ComponentProps, type MouseEvent, type ReactNode, type Ref, useId } from "react";
import { cn, withClassName } from "../../lib/cn";
import { WindowShadow } from "../window-shadow";
import "./quick-look-panel.tokens.css";
import "./quick-look-panel.css";

/* The two title-bar discs: a glyph cut out of a filled 12 pt disc. Original drawings. */
const CLOSE =
  "M6 0a6 6 0 100 12A6 6 0 006 0zM8.05 2.82L9.18 3.95 7.13 6l2.05 2.05-1.13 1.13L6 7.13 3.95 9.18 2.82 8.05 4.87 6 2.82 3.95l1.13-1.13L6 4.87z";
const FULL_SCREEN = "M6 0a6 6 0 100 12A6 6 0 006 0zM5 3h4v4zM3 5v4h4z";

export interface QuickLookPanelProps extends Omit<ComponentProps<"div">, "title"> {
  /** The previewed item's name, centred in the bar. It names the panel. */
  title?: ReactNode;
  /**
   * The buttons at the trailing edge of the bar: `QuickLookPanelButton` elements (Rotate,
   * Markup, "Open with Preview", Share; or Done and Share in Markup mode).
   */
  actions?: ReactNode;
  /**
   * Tools that take the place of the title, after the close button: a `MarkupToolbar` in
   * Markup mode. The full-screen button is hidden while tools are shown, as in Catalina, and
   * `title` still names the panel.
   */
  tools?: ReactNode;
  /**
   * Whether the panel is key, main or inactive, written to the root as `data-window-state`.
   * A Quick Look panel is key while it is open; the window behind it is main.
   * @default "key"
   */
  state?: "key" | "main" | "inactive";
  /** Called when the close button is activated and when Escape is pressed in the panel. */
  onClose?: (event: MouseEvent<HTMLElement> | KeyboardEvent) => void;
  /** Called when the full-screen button is activated. */
  onFullScreen?: (event: MouseEvent<HTMLElement>) => void;
  /** Frame width: a number of points, or any CSS length. */
  width?: number | string;
  /** Frame height: a number of points, or any CSS length. */
  height?: number | string;
}

/**
 * The Quick Look panel (QLPreviewPanel): a floating panel with a translucent bar (close and
 * full-screen buttons, the item's name, a few actions) over a preview, which is the children,
 * centred and letterboxed by the same material.
 *
 * It is a `dialog` named by its title; it is not modal. It draws itself and reports Close,
 * Full Screen and Escape: opening it on Space, moving between items and positioning it are the
 * application's.
 */
export function QuickLookPanel({
  title,
  actions,
  tools,
  state = "key",
  onClose,
  onFullScreen,
  width,
  height,
  onKeyDown,
  className,
  style,
  children,
  ...props
}: QuickLookPanelProps) {
  const titleId = useId();
  const present = (node: ReactNode) => node !== undefined && node !== null && node !== false;
  const hasTitle = present(title);
  const hasTools = present(tools);
  const labelled = props["aria-label"] !== undefined || props["aria-labelledby"] !== undefined;
  return (
    <WindowShadow
      role="dialog"
      aria-labelledby={hasTitle && !labelled ? titleId : undefined}
      data-window-state={state}
      className={cn("mac-quick-look-panel", className)}
      style={width === undefined && height === undefined ? style : { width, height, ...style }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.key === "Escape" && !event.defaultPrevented && onClose) {
          // Handled here: a dialog around the panel must not close on the same key press.
          event.preventDefault();
          onClose(event.nativeEvent);
        }
      }}
      {...props}
    >
      <div className="mac-quick-look-panel-bar" data-tools={hasTools ? "" : undefined}>
        <div className="mac-quick-look-panel-controls">
          <BaseButton className="mac-quick-look-panel-control" aria-label="Close" onClick={onClose}>
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d={CLOSE} fill="currentColor" fillRule="evenodd" />
            </svg>
          </BaseButton>
          {hasTools ? null : (
            <BaseButton
              className="mac-quick-look-panel-control"
              aria-label="Enter Full Screen"
              onClick={onFullScreen}
            >
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d={FULL_SCREEN} fill="currentColor" fillRule="evenodd" />
              </svg>
            </BaseButton>
          )}
        </div>
        {hasTitle ? (
          <div id={titleId} className="mac-quick-look-panel-title">
            {title}
          </div>
        ) : null}
        {hasTools ? <div className="mac-quick-look-panel-tools">{tools}</div> : null}
        {present(actions) ? <div className="mac-quick-look-panel-actions">{actions}</div> : null}
      </div>
      <div className="mac-quick-look-panel-preview">{children}</div>
    </WindowShadow>
  );
}

export interface QuickLookPanelButtonProps extends Omit<BaseButton.Props, "ref"> {
  /** Ref to the rendered button. */
  ref?: Ref<HTMLElement>;
}

/**
 * A button of the Quick Look bar: a 19 pt white (dark: translucent) bezel holding a glyph or a
 * short title. Built on Base UI's Button. A button that shows only a glyph needs an
 * `aria-label`.
 */
export function QuickLookPanelButton({ className, ...props }: QuickLookPanelButtonProps) {
  return (
    <BaseButton className={withClassName("mac-quick-look-panel-button", className)} {...props} />
  );
}

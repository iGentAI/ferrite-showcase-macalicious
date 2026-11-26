"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import { type ComponentProps, type ReactNode, type Ref, useId } from "react";
import { cn, withClassName } from "../../lib/cn";
import "./hud-window.tokens.css";
import "./hud-window.css";

export interface HudWindowProps extends Omit<ComponentProps<"div">, "title"> {
  /**
   * `"panel"` is the HUD-style panel (NSPanel with the HUD style): the dark panel material, a
   * shadow and padded content. `"controller"` is the floating playback controller QuickTime
   * Player lays over a movie: a lighter material, smaller corners, no shadow, content placed by
   * the caller, and a foreground that lightens what is behind it.
   * @default "panel"
   */
  variant?: "panel" | "controller";
  /**
   * Whether the HUD is key, main or inactive, written to the root as `data-window-state` like a
   * window's. A HUD that floats inside a window follows that window, whatever this says.
   * @default "key"
   */
  state?: "key" | "main" | "inactive";
  /**
   * The title, centred in a 19 pt title bar. It names the HUD for assistive technology. A
   * panel without a title and without `onClose` has no title bar; give it an `aria-label`
   * then. A controller never has a title bar: a title that is a string only names it.
   */
  title?: ReactNode;
  /**
   * Called when the close button is activated. The button is drawn, at the leading end of the
   * title bar, only when this is given and the HUD is a panel.
   */
  onClose?: () => void;
  /**
   * Accessible name of the close button.
   * @default "Close"
   */
  closeLabel?: string;
}

/**
 * A HUD (heads-up display): a dark, translucent panel for quick adjustments over visual
 * content. It is dark in Aqua and in Dark Aqua alike, and everything inside it is drawn in
 * Dark Aqua: the root carries `data-appearance="dark"`.
 *
 * It is presentational: it does not move, float or fade by itself. The root is a `group`,
 * named by the title; pass `role="toolbar"` for a controller or `role="dialog"` for a panel
 * that behaves as one.
 */
export function HudWindow({
  variant = "panel",
  state = "key",
  title,
  onClose,
  closeLabel = "Close",
  className,
  children,
  ...props
}: HudWindowProps) {
  const titleId = useId();
  const titled = title != null && title !== false;
  const bar = variant === "panel" && (titled || onClose !== undefined);
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring a legend and a border; the HUD is a plain group.
    <div
      role="group"
      aria-labelledby={bar && titled ? titleId : undefined}
      aria-label={!bar && typeof title === "string" ? title : undefined}
      data-appearance="dark"
      data-variant={variant}
      data-window-state={state}
      data-title-bar={bar ? "" : undefined}
      className={cn("mac-hud-window", className)}
      {...props}
    >
      {bar ? (
        <div className="mac-hud-window-title-bar">
          {onClose ? (
            <BaseButton
              aria-label={closeLabel}
              className="mac-hud-window-close"
              onClick={onClose}
            />
          ) : null}
          {titled ? (
            <span id={titleId} className="mac-hud-window-title">
              {title}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="mac-hud-window-body">{children}</div>
    </div>
  );
}

export interface HudWindowButtonProps extends Omit<BaseButton.Props, "ref"> {
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/**
 * A borderless glyph button for a HUD (play, rewind, share): its content, an `<svg>` that uses
 * `currentColor`, is drawn in the HUD's foreground. It is as large as its content. Built on
 * Base UI's Button: accepts `disabled`, `focusableWhenDisabled`, `render` and every native
 * button attribute. A button without text needs an `aria-label`.
 */
export function HudWindowButton({ className, ...props }: HudWindowButtonProps) {
  return <BaseButton className={withClassName("mac-hud-window-button", className)} {...props} />;
}

export interface HudWindowTextProps extends ComponentProps<"span"> {}

/**
 * Text in the HUD's foreground, with tabular digits: a time code, a value, a caption. In a
 * controller it lightens what is behind it like the glyphs do.
 */
export function HudWindowText({ className, ...props }: HudWindowTextProps) {
  return <span className={cn("mac-hud-window-text", className)} {...props} />;
}

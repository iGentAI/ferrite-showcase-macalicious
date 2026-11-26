"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import type { ComponentProps, ReactNode, Ref } from "react";
import { cn, withClassName } from "../../lib/cn";
import "./window-banner.tokens.css";
import "./window-banner.css";

export interface WindowBannerProps extends ComponentProps<"div"> {
  /**
   * Content at the trailing edge of the strip, usually one `WindowBannerAction`. Provisional:
   * no reference screenshot shows a banner with an action.
   */
  trailing?: ReactNode;
}

/**
 * The informational strip Finder draws at the top of a window's content area ("Shared Folder"):
 * 25 pt high, bold text at the leading edge. It is a note, not a control: `role="note"`.
 */
export function WindowBanner({ trailing, className, children, ...props }: WindowBannerProps) {
  return (
    <div role="note" className={cn("mac-window-banner", className)} {...props}>
      <span className="mac-window-banner-text">{children}</span>
      {trailing != null && trailing !== false ? (
        <span className="mac-window-banner-trailing">{trailing}</span>
      ) : null}
    </div>
  );
}

export interface WindowBannerActionProps extends Omit<BaseButton.Props, "ref"> {
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/**
 * A round-rect button for a banner's `trailing` slot (AppKit's `roundRect` bezel, as on the
 * Finder scope bar). Built on Base UI's Button: accepts `disabled`, `focusableWhenDisabled`,
 * `render` and every native button attribute.
 */
export function WindowBannerAction({ className, ...props }: WindowBannerActionProps) {
  return <BaseButton className={withClassName("mac-window-banner-action", className)} {...props} />;
}

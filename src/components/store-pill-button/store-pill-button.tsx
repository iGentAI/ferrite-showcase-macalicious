"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import { type CSSProperties, type ReactNode, type Ref, useId } from "react";
import { cn, withClassName } from "../../lib/cn";
import "./store-pill-button.tokens.css";
import "./store-pill-button.css";

export interface StorePillButtonProps extends Omit<BaseButton.Props, "ref"> {
  /**
   * `"tinted"` is the offer button as the App Store shows it: a light grey capsule with a
   * blue title. `"filled"` is the confirmation step (`Install`, `Buy App`): the capsule takes
   * the title's blue and the title turns white.
   * @default "tinted"
   */
  variant?: "tinted" | "filled";
  /**
   * One line hung under the capsule, such as `In-App Purchases`. It is outside the button's
   * box and its hit area, is not part of the button's name, and is announced as its
   * description.
   */
  caption?: ReactNode;
  /**
   * Download progress from 0 to 1. While it is set, the capsule is replaced by a 21 pt ring
   * with a stop square, and the title is hidden from view but stays the button's name: title
   * it with what a click does then, such as `Stop`.
   */
  progress?: number;
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/**
 * The App Store's offer button: the capsule at the trailing edge of an app lockup, titled
 * with the offer (`Get`, a price, `Open`, `Update`).
 *
 * Built on Base UI's Button, so it also accepts `disabled`, `focusableWhenDisabled`, `render`,
 * `nativeButton` and every native button attribute. A title is shown in upper case, as the
 * store sets words; write it in ordinary case so that it is read as a word.
 */
export function StorePillButton({
  variant = "tinted",
  caption,
  progress,
  className,
  children,
  ref,
  "aria-describedby": describedBy,
  ...props
}: StorePillButtonProps) {
  const id = useId();
  const captioned = caption != null && caption !== false;
  return (
    <BaseButton
      data-variant={variant}
      data-progress={progress == null ? undefined : ""}
      aria-describedby={cn(describedBy, captioned && id) || undefined}
      className={withClassName("mac-store-pill-button", className)}
      ref={ref}
      {...props}
    >
      <span className="mac-store-pill-button-label">{children}</span>
      {progress != null && (
        <span
          aria-hidden="true"
          className="mac-store-pill-button-ring"
          style={{ "--_value": Math.min(1, Math.max(0, progress)) } as CSSProperties}
        />
      )}
      {/* Hidden so that it is no part of the name; the reference above makes it the description. */}
      {captioned && (
        <span id={id} aria-hidden="true" className="mac-store-pill-button-caption">
          {caption}
        </span>
      )}
    </BaseButton>
  );
}

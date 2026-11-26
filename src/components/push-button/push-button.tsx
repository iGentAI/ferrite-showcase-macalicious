"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import type { Ref } from "react";
import { withClassName } from "../../lib/cn";
import type { ControlSize } from "../../lib/control-size";
import { type KeyEquivalent, useKeyEquivalent } from "../../lib/key-equivalent";
import "./push-button.tokens.css";
import "./push-button.css";

export interface PushButtonProps extends Omit<BaseButton.Props, "ref"> {
  /**
   * Visual role of the button. `"primary"` draws AppKit's default button, the accent-filled
   * bezel. It changes the look only: for Return to activate it, use `DefaultButton`, set
   * `keyEquivalent="return"`, or give it `type="submit"` inside a form. Use at most one per
   * window, sheet or dialog. `"emphasized"` keeps the standard bezel and sets the title in
   * blue, semibold: the button that ends a mode, as Done does on a Contacts card.
   * @default "standard"
   */
  variant?: "standard" | "primary" | "emphasized";
  /**
   * Draws the bezel close around the content, 8 pt on each side in place of 14: for a
   * button that shows one image and no title, as the compose button of Messages. Give such a
   * button an `aria-label`.
   * @default false
   */
  compact?: boolean;
  /**
   * AppKit control size.
   * @default "regular"
   */
  size?: ControlSize;
  /**
   * AppKit's key equivalent: a key that activates the button from anywhere in its window, the
   * nearest enclosing form, dialog or element with `data-window-state`. `"escape"` is for a
   * Cancel button and answers Escape and Command-Period; `"return"` is the default button's
   * key. The key is left to a focused control that uses it, and to any handler that prevents
   * its default.
   * @default "none"
   */
  keyEquivalent?: KeyEquivalent;
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/**
 * A Catalina push button (NSButton with the rounded bezel style): starts an action when clicked.
 *
 * Built on Base UI's Button, so it also accepts `disabled`, `focusableWhenDisabled`, `render`,
 * `nativeButton` and every native button attribute. Like Base UI, it renders `type="button"`
 * unless `type="submit"` is given.
 */
export function PushButton({
  variant = "standard",
  size = "regular",
  compact = false,
  keyEquivalent = "none",
  className,
  children,
  ref,
  ...props
}: PushButtonProps) {
  const setElement = useKeyEquivalent(keyEquivalent, ref);
  return (
    <BaseButton
      data-variant={variant}
      data-size={size}
      data-compact={compact ? "" : undefined}
      className={withClassName("mac-push-button", className)}
      ref={setElement}
      {...props}
    >
      {/* The title has its own box so that it can truncate: see .mac-push-button-label. */}
      <span className="mac-push-button-label">{children}</span>
    </BaseButton>
  );
}

import { withClassName } from "../../lib/cn";
import { PushButton, type PushButtonProps } from "../push-button";
import "./default-button.css";

export interface DefaultButtonProps extends Omit<PushButtonProps, "variant" | "keyEquivalent"> {
  /**
   * AppKit's key equivalent of a default button. With `"return"`, pressing Return anywhere in
   * the enclosing window, dialog or form activates the button, unless the focused element uses
   * the key itself (another button, a link, a multi-line text view, an open list) or its own
   * `keydown` handler prevents the default. `"none"` leaves the keyboard alone and only draws
   * the button.
   * @default "return"
   */
  keyEquivalent?: "return" | "none";
}

/**
 * A Catalina default button: the push button a window draws with the accent colour and that
 * Return activates. Use at most one per window, sheet or dialog, and never for a destructive
 * action.
 *
 * It is a push button with `variant="primary"` and `keyEquivalent="return"`, so it accepts
 * every other push button prop. Like every button here it is `type="button"` unless told
 * otherwise.
 */
export function DefaultButton({
  keyEquivalent = "return",
  className,
  ...props
}: DefaultButtonProps) {
  return (
    <PushButton
      variant="primary"
      keyEquivalent={keyEquivalent}
      className={withClassName("mac-default-button", className)}
      {...props}
    />
  );
}

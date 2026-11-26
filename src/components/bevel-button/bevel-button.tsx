import { Toggle as BaseToggle } from "@base-ui/react/toggle";
import type { ReactNode, Ref } from "react";
import { withClassName } from "../../lib/cn";
import "./bevel-button.tokens.css";
import "./bevel-button.css";

export interface BevelButtonProps extends Omit<BaseToggle.Props, "ref" | "children"> {
  /**
   * Corner style of the bezel: AppKit's square bezel, or the rounded one.
   * @default "square"
   */
  variant?: "square" | "rounded";
  /** An image, a title, or both. */
  children?: ReactNode;
  /** Ref to the rendered element. */
  ref?: Ref<HTMLButtonElement>;
}

/**
 * A Catalina bevel button (NSButton with the regular-square bezel style, on/off type): a square
 * button that holds an image, a title or both and stays down while it is on, like the two
 * Orientation buttons of the Print dialog.
 *
 * Built on Base UI's Toggle: `pressed`, `defaultPressed` and `onPressedChange` hold the on
 * state, and `value` identifies the button inside a `BevelButtonGroup`. An image-only button
 * needs an `aria-label`.
 */
export function BevelButton({
  variant = "square",
  className,
  children,
  ...props
}: BevelButtonProps) {
  return (
    <BaseToggle
      data-variant={variant}
      className={withClassName("mac-bevel-button", className)}
      {...props}
    >
      <span className="mac-bevel-button-content">{children}</span>
    </BaseToggle>
  );
}

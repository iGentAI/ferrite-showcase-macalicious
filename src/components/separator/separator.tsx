import { Separator as BaseSeparator } from "@base-ui/react/separator";
import type { Ref } from "react";
import { withClassName } from "../../lib/cn";
import "./separator.css";

export interface SeparatorProps extends Omit<BaseSeparator.Props, "ref"> {
  /**
   * Direction of the line. A horizontal separator is as wide as its container and 1 pt high;
   * a vertical one is as tall as its container and 1 pt wide.
   * @default "horizontal"
   */
  orientation?: "horizontal" | "vertical";
  /** Ref to the rendered element. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * A separator (NSBox with the separator box type): a one-point line in the separator colour
 * that divides groups of controls without enclosing them.
 *
 * Built on Base UI's Separator, which gives it `role="separator"` and `aria-orientation`. Pass
 * `aria-hidden` when the line is purely visual.
 */
export function Separator({ className, ...props }: SeparatorProps) {
  return <BaseSeparator className={withClassName("mac-separator", className)} {...props} />;
}

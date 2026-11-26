import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";
import "./gradient-button.tokens.css";
import "./gradient-button.css";

export interface GradientButtonGroupProps extends ComponentProps<"div"> {
  /**
   * `"network"` draws the bar as the Network preference pane does: a lighter fill in Dark
   * Aqua and separate colours for its top line, its outer border and the lines between cells.
   * Every other pane in the screenshots has the `"standard"` bar.
   * @default "standard"
   */
  variant?: "standard" | "network";
}

/**
 * A row of gradient buttons that share their borders, as under a bordered list: add, remove,
 * then an action button, optionally followed by a `GradientButtonFiller`. It is a `role="group"`;
 * name it with `aria-label` when the buttons need a common description.
 */
export function GradientButtonGroup({
  variant = "standard",
  className,
  ...props
}: GradientButtonGroupProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset brings a legend and form semantics; this is a plain group of buttons
    <div
      role="group"
      data-variant={variant}
      className={cn("mac-gradient-button-group", className)}
      {...props}
    />
  );
}

export interface GradientButtonFillerProps extends ComponentProps<"span"> {}

/**
 * The empty cell that continues a gradient button bar to the far edge of the list above it. It
 * takes the remaining width of a `GradientButtonGroup` and is hidden from assistive technology.
 */
export function GradientButtonFiller({ className, ...props }: GradientButtonFillerProps) {
  return (
    <span aria-hidden="true" className={cn("mac-gradient-button-filler", className)} {...props} />
  );
}

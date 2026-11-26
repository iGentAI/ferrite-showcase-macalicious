import { ToggleGroup as BaseToggleGroup } from "@base-ui/react/toggle-group";
import type { Ref } from "react";
import { withClassName } from "../../lib/cn";
import "./bevel-button.tokens.css";
import "./bevel-button.css";

export interface BevelButtonGroupProps extends Omit<BaseToggleGroup.Props, "ref"> {
  /** Ref to the rendered element. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * A row of bevel buttons, 12 pt apart, that share one on state, like the Orientation pair of
 * the Print dialog.
 *
 * Built on Base UI's ToggleGroup: `value`, `defaultValue` and `onValueChange` hold the `value`s
 * of the buttons that are on, `multiple` allows more than one, and the arrow keys move between
 * the buttons. Name the group with `aria-label` or `aria-labelledby`.
 */
export function BevelButtonGroup({ className, ...props }: BevelButtonGroupProps) {
  return (
    <BaseToggleGroup className={withClassName("mac-bevel-button-group", className)} {...props} />
  );
}

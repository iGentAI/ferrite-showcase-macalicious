import { Input as BaseInput } from "@base-ui/react/input";
import type { Ref } from "react";
import { withClassName } from "../../lib/cn";
import "./color-well.tokens.css";
import "./color-well.css";

export interface ColorWellProps extends Omit<BaseInput.Props, "ref" | "type"> {
  /**
   * The colour, when controlled, as `#rrggbb`. Use it with `onValueChange`.
   */
  value?: string;
  /**
   * The colour the well starts with, when uncontrolled, as `#rrggbb`. Without it the well is
   * black, the browser's default.
   */
  defaultValue?: string;
  /**
   * Bezel style. `"standard"` is the square 44 x 23 pt well of a form; `"toolbar"` is the
   * rounded 22 x 16 pt well of a toolbar or a format bar. Either stretches to a `width` and
   * `height` set with CSS.
   * @default "standard"
   */
  variant?: "standard" | "toolbar";
  /**
   * Whether the well has its bezel (NSColorWell.isBordered). Without it the colour fills the
   * whole frame.
   * @default true
   */
  bordered?: boolean;
  /**
   * Draws the well as active (NSColorWell.isActive): the darkened bezel that shows which well
   * the open colour chooser is editing. The well also darkens by itself while it is pressed,
   * and while the browser's own chooser is open where the browser reports that. Set this when
   * you open a chooser of your own.
   * @default false
   */
  active?: boolean;
  /** Ref to the rendered `<input>`. */
  ref?: Ref<HTMLElement>;
}

/**
 * A Catalina colour well (NSColorWell): shows a colour and opens a colour chooser when
 * clicked.
 *
 * It is a native `<input type="color">` drawn as the well, rendered through Base UI's Input, so
 * it also accepts `onValueChange`, `name`, `disabled`, `render` and every native input
 * attribute, takes part in forms and works inside a Base UI Field. It has no text and needs
 * an accessible name: a `<label>`, `aria-label` or `aria-labelledby`.
 */
export function ColorWell({
  variant = "standard",
  bordered = true,
  active = false,
  className,
  ...props
}: ColorWellProps) {
  return (
    <BaseInput
      type="color"
      data-variant={variant}
      data-bordered={bordered ? "" : undefined}
      data-active={active ? "" : undefined}
      className={withClassName("mac-color-well", className)}
      {...props}
    />
  );
}

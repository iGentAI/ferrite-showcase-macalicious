import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import type { ReactNode, Ref } from "react";
import { withClassName } from "../../lib/cn";
import type { ControlSize } from "../../lib/control-size";
import "./checkbox.tokens.css";
import "./checkbox.css";

export interface CheckboxProps extends Omit<BaseCheckbox.Root.Props, "ref"> {
  /**
   * AppKit control size.
   * @default "regular"
   */
  size?: ControlSize;
  /**
   * The title, drawn to the right of the box. It is part of the control: clicking it toggles
   * the checkbox and it becomes the accessible name. A checkbox without a title (a checklist
   * cell) needs `aria-label` or `aria-labelledby`.
   */
  children?: ReactNode;
  /** Ref to the rendered element, the one with `role="checkbox"`. */
  ref?: Ref<HTMLElement>;
}

/* Original glyphs, drawn to the pixel coverage measured in the reference screenshots. Catalina
   draws a different checkmark in each appearance, so both are here and the stylesheet gives
   the one that does not apply a stroke width of zero (checkbox.tokens.css):
     light  round-capped 1.55 pt stroke, fitted to Security and Privacy @ 328,452
     dark   round-capped 1.65 pt stroke, fitted to Theme-Dark-Blue @ 1478,1312
   The mixed state is an 8 x 2 pt dash with round ends in both. */
const CHECK_LIGHT = "M3.8 7.725 5.95 10.275 10.2 3.775";
const CHECK_DARK = "M3.5 7.325 6.15 10.2 10.625 3.95";
const DASH = "M4 7h6";
const GLYPH = <svg viewBox="0 0 14 14" aria-hidden="true" focusable="false" />;

/**
 * A Catalina checkbox (NSButton of type switch): on, off or mixed, with its title.
 *
 * Built on Base UI's Checkbox, so it also accepts `checked`, `defaultChecked`,
 * `onCheckedChange`, `indeterminate` (AppKit's mixed state), `disabled`, `readOnly`,
 * `required`, `name`, `value`, `parent` (inside a Base UI Checkbox Group) and `render`.
 */
export function Checkbox({ size = "regular", className, children, ...props }: CheckboxProps) {
  return (
    <BaseCheckbox.Root
      data-size={size}
      className={withClassName("mac-checkbox", className)}
      {...props}
    >
      <span className="mac-checkbox-box">
        <BaseCheckbox.Indicator className="mac-checkbox-glyph" render={GLYPH}>
          <path className="mac-checkbox-check-light" d={CHECK_LIGHT} />
          <path className="mac-checkbox-check-dark" d={CHECK_DARK} />
          <path className="mac-checkbox-dash" d={DASH} />
        </BaseCheckbox.Indicator>
      </span>
      {children != null && children !== false && (
        <span className="mac-checkbox-title">{children}</span>
      )}
    </BaseCheckbox.Root>
  );
}

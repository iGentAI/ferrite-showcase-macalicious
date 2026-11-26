import { Radio as BaseRadio } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import type { ReactNode, Ref } from "react";
import { withClassName } from "../../lib/cn";
import type { ControlSize } from "../../lib/control-size";
import "./radio-button.tokens.css";
import "./radio-button.css";

export interface RadioGroupProps extends Omit<BaseRadioGroup.Props, "ref"> {
  /**
   * Direction in which the buttons are laid out: a column with AppKit's 22 pt pitch, or a row
   * with 10 pt between a title and the next button.
   * @default "vertical"
   */
  orientation?: "vertical" | "horizontal";
  /** Ref to the rendered element, the one with `role="radiogroup"`. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * A group of mutually exclusive radio buttons. Selecting one deselects the others.
 *
 * Built on Base UI's Radio Group, so it also accepts `value`, `defaultValue`, `onValueChange`,
 * `name`, `disabled`, `readOnly` and `required`. The group has one tab stop; the arrow keys
 * move the selection. Name it with `aria-label` or `aria-labelledby`.
 */
export function RadioGroup({ orientation = "vertical", className, ...props }: RadioGroupProps) {
  return (
    <BaseRadioGroup
      aria-orientation={orientation}
      data-orientation={orientation}
      className={withClassName("mac-radio-button-group", className)}
      {...props}
    />
  );
}

export interface RadioButtonProps extends Omit<BaseRadio.Root.Props, "ref"> {
  /**
   * AppKit control size.
   * @default "regular"
   */
  size?: ControlSize;
  /**
   * Draws AppKit's mixed state, a dash on the accent fill, for a button that stands for a
   * selection whose items differ. It changes the look only: ARIA has no mixed radio button, so
   * say what it means in the title or a description.
   * @default false
   */
  mixed?: boolean;
  /**
   * The title, drawn to the right of the circle. It is part of the control: clicking it
   * selects the button and it becomes the accessible name. A button without a title needs
   * `aria-label` or `aria-labelledby`.
   */
  children?: ReactNode;
  /** Ref to the rendered element, the one with `role="radio"`. */
  ref?: Ref<HTMLElement>;
}

/**
 * A Catalina radio button (NSButton of type radio). Use it inside a `RadioGroup`, with a
 * `value` that is unique in the group.
 *
 * Built on Base UI's Radio, so it also accepts `value`, `disabled`, `readOnly`, `required` and
 * `render`. The circle, its dot and the dash are drawn in CSS.
 */
export function RadioButton({
  size = "regular",
  mixed = false,
  className,
  children,
  ...props
}: RadioButtonProps) {
  return (
    <BaseRadio.Root
      data-size={size}
      data-mixed={mixed ? "" : undefined}
      className={withClassName("mac-radio-button", className)}
      {...props}
    >
      <span className="mac-radio-button-circle" />
      {children != null && children !== false && (
        <span className="mac-radio-button-title">{children}</span>
      )}
    </BaseRadio.Root>
  );
}

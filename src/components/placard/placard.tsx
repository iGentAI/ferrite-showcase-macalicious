import { Button as BaseButton } from "@base-ui/react/button";
import type { ComponentProps, Ref } from "react";
import { cn, withClassName } from "../../lib/cn";
import type { ControlSize } from "../../lib/control-size";
import "./placard.tokens.css";
import "./placard.css";

export interface PlacardProps extends ComponentProps<"div"> {
  /**
   * AppKit control size. A placard is as high as the scroll bar beside it: 15 pt at
   * `"regular"`, 11 pt at `"small"` and `"mini"`.
   * @default "regular"
   */
  size?: ControlSize;
}

/**
 * A placard: the small strip of controls at the bottom edge of a window, in the row of the
 * horizontal scroll bar, for quick changes to the view of the content (a magnification pop-up,
 * page buttons). Put `PlacardButton` and `PlacardLabel` elements inside.
 *
 * It is a `group`: name it with `aria-label`. The caller places it, usually at the bottom left
 * of a scroll view.
 */
export function Placard({ size = "regular", className, ...props }: PlacardProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring a legend and a border; the strip is a plain group.
    <div role="group" data-size={size} className={cn("mac-placard", className)} {...props} />
  );
}

export interface PlacardButtonProps extends Omit<BaseButton.Props, "ref"> {
  /**
   * Draws the pop-up indicator, a pair of arrowheads, after the title: for a button that opens
   * a menu of choices, such as a magnification.
   * @default false
   */
  popUp?: boolean;
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/**
 * A borderless button of a placard, as high as the strip. Built on Base UI's Button: accepts
 * `disabled`, `focusableWhenDisabled`, `render` and every native button attribute, and can be
 * the `render` of a menu trigger. A button that holds only a glyph needs an `aria-label`.
 */
export function PlacardButton({ popUp = false, className, ...props }: PlacardButtonProps) {
  return (
    <BaseButton
      data-pop-up={popUp ? "" : undefined}
      className={withClassName("mac-placard-button", className)}
      {...props}
    />
  );
}

export interface PlacardLabelProps extends ComponentProps<"span"> {}

/** Static text in a placard, such as "Page 3 of 12". */
export function PlacardLabel({ className, ...props }: PlacardLabelProps) {
  return <span className={cn("mac-placard-label", className)} {...props} />;
}

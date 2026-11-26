import { Button as BaseButton } from "@base-ui/react/button";
import type { Ref } from "react";
import { withClassName } from "../../lib/cn";
import "./gradient-button.tokens.css";
import "./gradient-button.css";

export interface GradientButtonProps extends Omit<BaseButton.Props, "ref"> {
  /**
   * One of the three standard glyphs: add (plus), remove (minus) or action (gear with a
   * chevron, for a button that opens a menu). Ignored when the button has children; pass any
   * 11 to 14 pt monochrome icon as children instead.
   */
  glyph?: "add" | "remove" | "action";
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/* Glyphs drawn for this library on the measured boxes: an 11 pt plus and minus made of 1 pt
   bars, and a 13 pt gear followed by a 7 x 4.5 pt chevron. The action glyph sits where the
   Network pane has it: 4 pt below the top of the fill and 2 pt above its bottom, which the two
   empty points at the top of its box give, and 2 pt from the fill's left edge (CSS). */
const glyphProps = {
  className: "mac-gradient-button-glyph",
  focusable: false,
  fill: "currentColor",
} as const;

const glyphs = {
  add: (
    <svg {...glyphProps} aria-hidden="true" viewBox="0 0 11 11" width="11" height="11">
      <path d="M0 5h11v1H0zM5 0h1v11H5z" />
    </svg>
  ),
  remove: (
    <svg {...glyphProps} aria-hidden="true" viewBox="0 0 11 11" width="11" height="11">
      <path d="M0 5h11v1H0z" />
    </svg>
  ),
  action: (
    <svg
      {...glyphProps}
      className="mac-gradient-button-glyph mac-gradient-button-glyph-action"
      aria-hidden="true"
      viewBox="0 -2 22 15"
      width="22"
      height="15"
    >
      <g fill="none" stroke="currentColor">
        <circle cx="6.5" cy="6.5" r="3.4" strokeWidth="2.8" />
        <circle cx="6.5" cy="6.5" r="5.5" strokeWidth="2" strokeDasharray="2.3 2.02" />
        <path d="M15.6 4.3l2.9 2.8 2.9-2.8" strokeWidth="1.5" />
      </g>
    </svg>
  ),
};

/**
 * A Catalina gradient button (NSButton with the small-square bezel style): a square-cornered
 * icon button that sits directly under a list and adds, removes or acts on its rows.
 *
 * Built on Base UI's Button, so it also accepts `disabled`, `focusableWhenDisabled`, `render`
 * and every native button attribute. It has no title: give it an `aria-label`. For a toggle,
 * set `aria-pressed`; for a menu button, pass it to a menu trigger's `render` prop (see the
 * docs page).
 */
export function GradientButton({ glyph, className, children, ...props }: GradientButtonProps) {
  return (
    <BaseButton className={withClassName("mac-gradient-button", className)} {...props}>
      {children ?? (glyph ? glyphs[glyph] : null)}
    </BaseButton>
  );
}

"use client";

import { useRender } from "@base-ui/react/use-render";
import { cn } from "../../lib/cn";
import "./label.css";

/**
 * A Catalina text style: a font size, weight and line height.
 *
 * `body`, `emphasized`, `callout`, `small`, `small-emphasized`, `mini` and `large-value` are
 * measured in the reference screenshots. The title and headline styles map to the provisional
 * title tokens.
 */
export type LabelTextStyle =
  | "body"
  | "emphasized"
  | "callout"
  | "small"
  | "small-emphasized"
  | "mini"
  | "large-value"
  | "headline"
  | "subheadline"
  | "title-1"
  | "title-2"
  | "title-3"
  | "large-title";

/** A system text colour (NSColor.labelColor and its relatives). */
export type LabelColor = "primary" | "secondary" | "tertiary" | "quaternary" | "text" | "link";

export interface LabelProps extends Omit<useRender.ComponentProps<"span">, "color"> {
  /**
   * Text style: font size, weight and line height. `body` is the 13 pt system font, `callout`
   * the 12 pt text of Activity Monitor's statistics, `small` the 11 pt small system font and
   * `mini` the 10 pt label font.
   * @default "body"
   */
  textStyle?: LabelTextStyle;
  /**
   * System text colour. `primary`, `secondary`, `tertiary` and `quaternary` are the four label
   * colours in order of importance; `text` is the opaque text colour; `link` is the link colour.
   * @default "primary"
   */
  color?: LabelColor;
  /**
   * Horizontal alignment of the text inside the label's box. `end` right-aligns a form label
   * against its control.
   * @default "start"
   */
  align?: "start" | "center" | "end";
  /**
   * Draws the label as the title of a disabled control: the tertiary label colour.
   * @default false
   */
  disabled?: boolean;
  /**
   * Lets people select and copy the text, as for an address or an error message.
   * @default false
   */
  selectable?: boolean;
  /**
   * Keeps the text on one line and ends it with an ellipsis when it does not fit.
   * @default false
   */
  truncate?: boolean;
}

/**
 * A Catalina label (NSTextField configured as a label): static text in one of the system text
 * styles and colours.
 *
 * Renders a `<span>`. Use Base UI's `render` prop to render another element: `<label htmlFor>`
 * for the label of a control, `<p>` for a paragraph, `<a href>` for a link.
 */
export function Label({
  textStyle = "body",
  color = "primary",
  align = "start",
  disabled = false,
  selectable = false,
  truncate = false,
  className,
  render,
  ref,
  ...props
}: LabelProps) {
  return useRender({
    defaultTagName: "span",
    render,
    ref,
    props: {
      "data-text-style": textStyle,
      "data-color": color,
      "data-align": align,
      "data-disabled": disabled ? "" : undefined,
      "data-selectable": selectable ? "" : undefined,
      "data-truncate": truncate ? "" : undefined,
      ...props,
      className: cn("mac-label", className),
    },
  });
}

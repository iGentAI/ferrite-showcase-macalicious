import { Radio as BaseRadio } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import type { CSSProperties, ReactNode, Ref } from "react";
import type { Accent } from "../../lib/appearance";
import { withClassName } from "../../lib/cn";
import "./color-swatch-picker.tokens.css";
import "./color-swatch-picker.css";

/** The eight swatches of System Preferences › General, whose colours are measured tokens. */
const PRESET = /^(blue|purple|pink|red|orange|yellow|green|graphite)$/;

export interface ColorSwatchPickerProps<Value = string>
  extends Omit<BaseRadioGroup.Props<Value>, "ref"> {
  /** Ref to the group element. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * A row of colour swatches of which one is chosen, as the accent colour picker of System
 * Preferences › General: a radio group.
 *
 * Built on Base UI's Radio Group, so it accepts `value`, `defaultValue`, `onValueChange`,
 * `disabled`, `readOnly`, `required`, `name` and `render`. Give the group an accessible name
 * with `aria-label` or `aria-labelledby`. Its children are `ColorSwatch`es or, for a choice
 * between pictures such as Light, Dark and Auto, `ThumbnailSwatch`es.
 */
export function ColorSwatchPicker<Value = string>({
  className,
  ...props
}: ColorSwatchPickerProps<Value>) {
  return (
    <BaseRadioGroup<Value>
      className={withClassName("mac-color-swatch-picker", className)}
      {...props}
    />
  );
}

export interface ColorSwatchProps<Value = string> extends Omit<BaseRadio.Root.Props<Value>, "ref"> {
  /**
   * The colour of the swatch: one of Catalina's eight accent names (`"blue"`, `"purple"`,
   * `"pink"`, `"red"`, `"orange"`, `"yellow"`, `"green"`, `"graphite"`), drawn with the
   * fill and edge measured for each appearance, or any CSS colour, whose edge is derived from
   * it. Defaults to `value` when that is a string, so an accent picker needs `value` only.
   */
  color?: Accent | (string & {});
  /** Ref to the rendered element. */
  ref?: Ref<HTMLSpanElement>;
}

/**
 * One swatch of a `ColorSwatchPicker`: a radio button drawn as a 16 pt disc of its colour,
 * with a white dot while it is the chosen one.
 *
 * Built on Base UI's Radio. A swatch has no text, so it needs an `aria-label` with the name
 * of its colour.
 */
export function ColorSwatch<Value = string>({
  color,
  value,
  style,
  className,
  ...props
}: ColorSwatchProps<Value>) {
  const shown = color ?? (typeof value === "string" ? value : undefined);
  const preset = shown !== undefined && PRESET.test(shown);
  const custom =
    shown === undefined || preset
      ? undefined
      : ({ "--mac-color-swatch-picker-color": shown } as CSSProperties);
  return (
    <BaseRadio.Root<Value>
      value={value}
      data-color={preset ? shown : undefined}
      className={withClassName("mac-color-swatch-picker-swatch", className)}
      style={
        custom && typeof style === "function"
          ? (state) => ({ ...custom, ...style(state) })
          : custom
            ? { ...custom, ...style }
            : style
      }
      {...props}
    />
  );
}

export interface ThumbnailSwatchProps<Value = string>
  extends Omit<BaseRadio.Root.Props<Value>, "ref"> {
  /**
   * The caption, centred under the picture. It is part of the control and becomes the
   * accessible name. A thumbnail without a caption needs `aria-label`.
   */
  label?: ReactNode;
  /**
   * The picture: an `<img>`, an inline SVG or any element. It fills the 67 x 44 pt frame and
   * is clipped to its rounded corners. Mark it decorative (`alt=""`, `aria-hidden`) when the
   * caption names the choice.
   */
  children?: ReactNode;
  /** Ref to the rendered element. */
  ref?: Ref<HTMLSpanElement>;
}

/**
 * One picture choice of a `ColorSwatchPicker`, as Light, Dark and Auto in System Preferences ›
 * General: a radio button drawn as a 67 x 44 pt picture with a caption, ringed in the accent
 * colour while it is the chosen one.
 *
 * Built on Base UI's Radio. The picture is yours: the library ships no artwork.
 */
export function ThumbnailSwatch<Value = string>({
  label,
  className,
  children,
  ...props
}: ThumbnailSwatchProps<Value>) {
  return (
    <BaseRadio.Root<Value>
      className={withClassName("mac-color-swatch-picker-thumbnail", className)}
      {...props}
    >
      <span className="mac-color-swatch-picker-thumbnail-image">{children}</span>
      {label != null && label !== false && (
        <span className="mac-color-swatch-picker-thumbnail-label">{label}</span>
      )}
    </BaseRadio.Root>
  );
}

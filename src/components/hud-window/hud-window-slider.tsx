"use client";

import { Slider as BaseSlider } from "@base-ui/react/slider";
import type { CSSProperties, Ref } from "react";
import { withClassName } from "../../lib/cn";
import "./hud-window.tokens.css";
import "./hud-window.css";

export interface HudWindowSliderProps
  extends Omit<
    BaseSlider.Root.Props<number>,
    | "ref"
    | "children"
    | "orientation"
    | "thumbAlignment"
    | "thumbCollisionBehavior"
    | "minStepsBetweenValues"
  > {
  /**
   * `"knob"` is the volume slider of QuickTime's controller: a round 11 pt knob on a track
   * filled with the accent colour up to it. `"scrubber"` is its timeline: a 3 pt bar that cuts
   * the track, whose played part is brighter than the rest.
   * @default "knob"
   */
  variant?: "knob" | "scrubber";
  /** Accessible name of the slider, given to its `<input type="range">`. */
  "aria-label"?: string;
  /** Id of the element that names the slider, given to its input. */
  "aria-labelledby"?: string;
  /** Text alternative of the current value, given to the input: a time code for a timeline. */
  "aria-valuetext"?: string;
  /** Returns the text alternative of the current value, for screen readers. */
  getAriaValueText?: (formattedValue: string, value: number, index: number) => string;
  /** Ref to the root element. */
  ref?: Ref<HTMLDivElement>;
}

// The stylesheet centres the thumb with margins, so that it is drawn on whole pixels.
const THUMB_STYLE: CSSProperties = { translate: "none" };

/**
 * A horizontal slider for a HUD: a thin track with a knob (volume) or a bar (timeline). As
 * wide as it is given room for; set a `width` in `style`. Built on Base UI's Slider and takes
 * its Root props: `value`, `defaultValue`, `onValueChange`, `onValueCommitted`, `min`, `max`,
 * `step`, `largeStep`, `disabled`, `name`. The arrow keys, Page Up, Page Down, Home and End
 * move it. Give it a name with `aria-label`.
 */
export function HudWindowSlider({
  variant = "knob",
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-valuetext": ariaValueText,
  getAriaValueText,
  ...props
}: HudWindowSliderProps) {
  return (
    <BaseSlider.Root
      data-variant={variant}
      className={withClassName("mac-hud-window-slider", className)}
      {...props}
    >
      <BaseSlider.Control className="mac-hud-window-slider-control">
        <BaseSlider.Track className="mac-hud-window-slider-track">
          <BaseSlider.Indicator className="mac-hud-window-slider-fill" />
          <BaseSlider.Thumb
            className="mac-hud-window-slider-thumb"
            style={THUMB_STYLE}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-valuetext={ariaValueText}
            getAriaValueText={getAriaValueText}
          />
        </BaseSlider.Track>
      </BaseSlider.Control>
    </BaseSlider.Root>
  );
}

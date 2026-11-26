import { Slider as BaseSlider } from "@base-ui/react/slider";
import type { CSSProperties, Ref } from "react";
import { withClassName } from "../../lib/cn";
import type { ControlSize } from "../../lib/control-size";
import "./slider.tokens.css";
import "./slider.css";

export interface SliderProps
  extends Omit<
    BaseSlider.Root.Props<number>,
    "ref" | "children" | "thumbAlignment" | "thumbCollisionBehavior" | "minStepsBetweenValues"
  > {
  /**
   * AppKit control size.
   * @default "regular"
   */
  size?: ControlSize;
  /**
   * Number of tick marks (`numberOfTickMarks`), spread evenly from the minimum to the maximum:
   * a whole number, at most 1000.
   * With tick marks the thumb is directional, pointing at them, and the track is not tinted;
   * without, the thumb is round and the track is filled with the accent colour up to it.
   * @default 0
   */
  tickMarks?: number;
  /**
   * Side of the track the tick marks are on (`tickMarkPosition`). `"below"` and `"above"`
   * are for a horizontal slider, `"trailing"` and `"leading"` for a vertical one; as in
   * AppKit, `"below"` and `"trailing"` are the same value, and so are the other two.
   * @default "below"
   */
  tickMarkPosition?: "below" | "above" | "trailing" | "leading";
  /**
   * Restrict the value to the tick marks (`allowsTickMarkValuesOnly`): `step` becomes the
   * distance between two marks. Needs at least two tick marks.
   * @default false
   */
  tickMarkValuesOnly?: boolean;
  /** Accessible name of the slider, given to its `<input type="range">`. */
  "aria-label"?: string;
  /** Id of the element that names the slider, given to its input and to the root. */
  "aria-labelledby"?: string;
  /** Id of the element that describes the slider, given to its input. */
  "aria-describedby"?: string;
  /** Text alternative of the current value, given to the input. */
  "aria-valuetext"?: string;
  /**
   * Returns the text alternative of the current value, for screen readers. It is given the
   * value formatted with `format`, the value, and the thumb's index, which is always 0.
   */
  getAriaValueText?: (formattedValue: string, value: number, index: number) => string;
  /** Ref to the `<input type="range">` inside the thumb. */
  inputRef?: Ref<HTMLInputElement>;
  /** Ref to the root element. */
  ref?: Ref<HTMLDivElement>;
}

/* Base UI centres the thumb with a translation, which the browser does not snap to device
   pixels. The stylesheet centres it with margins instead, so that the thumb is always drawn
   sharp, as AppKit draws it. */
const THUMB_STYLE: CSSProperties = { translate: "none" };

/**
 * A Catalina slider (NSSlider): a track with a thumb that is dragged to pick a value.
 *
 * Built on Base UI's Slider and assembled from its parts (Root, Control, Track, Indicator,
 * Thumb), so it also accepts `value`, `defaultValue`, `onValueChange`, `onValueCommitted`,
 * `min`, `max`, `step`, `largeStep`, `orientation`, `disabled`, `name`, `form`, `format`,
 * `locale` and `render`. It holds one value. Give it a name with `aria-label` or
 * `aria-labelledby`.
 */
export function Slider({
  size = "regular",
  tickMarks = 0,
  tickMarkPosition = "below",
  tickMarkValuesOnly = false,
  min = 0,
  max = 100,
  step,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-valuetext": ariaValueText,
  getAriaValueText,
  inputRef,
  ...props
}: SliderProps) {
  // A count that is not a whole number, or is absurdly large, would loop or allocate without
  // bound: whole marks only, at most 1000.
  const count = Number.isFinite(tickMarks) ? Math.min(1000, Math.max(0, Math.floor(tickMarks))) : 0;
  const ticks = [];
  for (let i = 0; i < count; i++) {
    const at = { "--_p": count > 1 ? i / (count - 1) : 0.5 } as CSSProperties;
    ticks.push(<span key={i} className="mac-slider-tick" style={at} />);
  }
  return (
    <BaseSlider.Root
      data-size={size}
      data-tick-marks={count > 0 ? tickMarkPosition : undefined}
      className={withClassName("mac-slider", className)}
      min={min}
      max={max}
      step={tickMarkValuesOnly && count > 1 ? (max - min) / (count - 1) : step}
      aria-labelledby={ariaLabelledBy}
      {...props}
    >
      <BaseSlider.Control className="mac-slider-control">
        <BaseSlider.Track className="mac-slider-track">
          {count > 0 ? (
            <span className="mac-slider-ticks" aria-hidden="true">
              {ticks}
            </span>
          ) : (
            <BaseSlider.Indicator className="mac-slider-fill" />
          )}
          <BaseSlider.Thumb
            className="mac-slider-thumb"
            style={THUMB_STYLE}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
            aria-valuetext={ariaValueText}
            getAriaValueText={getAriaValueText}
            inputRef={inputRef}
          />
        </BaseSlider.Track>
      </BaseSlider.Control>
    </BaseSlider.Root>
  );
}

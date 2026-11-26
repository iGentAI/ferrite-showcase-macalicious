"use client";

import { Meter as BaseMeter } from "@base-ui/react/meter";
import { Slider as BaseSlider } from "@base-ui/react/slider";
import { type ComponentProps, type CSSProperties, type ReactNode, type Ref, useState } from "react";
import { type StatefulClassName, withClassName } from "../../lib/cn";
import "./level-indicator.tokens.css";
import "./level-indicator.css";

/** Props of Base UI's `Meter.Root` that this component sets itself or declares below. */
type Replaced =
  | "children"
  | "value"
  | "defaultValue"
  | "onChange"
  | "ref"
  | "min"
  | "max"
  | "format"
  | "locale"
  | "getAriaValueText";

/** The props that may be functions of the state of the Base UI root that is rendered. */
type StateKeys = "className" | "style" | "render";
type MeterForms = Pick<BaseMeter.Root.Props, StateKeys>;
type SliderForms = Pick<ComponentProps<typeof BaseSlider.Root>, StateKeys>;
type RootAttributes = Omit<BaseMeter.Root.Props, Replaced | StateKeys>;
type ReadOnlyRoot = { editable?: false } & MeterForms;
type EditableRoot = { editable: true } & SliderForms;

/*
 * The root's own attributes are those of Base UI's Meter.Root. `className` and `style` may be
 * functions of the state, and `render` an element or a function: a read-only indicator
 * renders Meter.Root and its functions receive the meter's state; an editable one renders
 * Slider.Root and its functions receive the slider's state, so the three props are typed by
 * `editable`.
 */
type MeterOrSliderRoot = RootAttributes & (ReadOnlyRoot | EditableRoot);

export type LevelIndicatorProps = {
  /**
   * The level indicator style (NSLevelIndicator.Style). `"continuous"` is a track that fills
   * with a bar; `"discrete"` is a row of segments that fill whole, never partly; `"rating"` is
   * a row of stars; `"relevancy"` is a row of thin bars. `"storage"` is the large bordered
   * capacity bar that Disk Utility draws for a volume.
   * @default "continuous"
   */
  variant?: "continuous" | "discrete" | "rating" | "relevancy" | "storage";
  /**
   * The current value, between `min` and `max`. With `editable`, pass it together with
   * `onValueChange` for controlled use, or leave it out and pass `defaultValue`.
   */
  value?: number;
  /**
   * The value an editable indicator starts with when it is uncontrolled. Without it an
   * uncontrolled indicator starts at `min`.
   */
  defaultValue?: number;
  /**
   * The lower end of the range.
   * @default 0
   */
  min?: number;
  /**
   * The upper end of the range. For `"discrete"` and `"rating"` the number of segments or
   * stars is `max - min`; at most 100 are drawn, each then standing for an equal share of a
   * larger range, and none for a range that is not finite.
   * @default 100
   */
  max?: number;
  /**
   * Lets people set the value (NSLevelIndicator.isEditable): by clicking or dragging along
   * the indicator, and with the arrow keys, Home, End, Page Up and Page Down while it has
   * keyboard focus. An editable indicator is a slider to assistive technology.
   * @default false
   */
  editable?: boolean;
  /**
   * Called with the new value while an editable indicator is being changed.
   */
  onValueChange?: (value: number) => void;
  /**
   * Called once with the final value when a change to an editable indicator ends: on pointer
   * release, or after a key press.
   */
  onValueCommitted?: (value: number) => void;
  /**
   * The granularity of the value of an editable `"continuous"`, `"relevancy"` or `"storage"`
   * indicator. `"discrete"` and `"rating"` always step by one segment or star.
   * @default 1
   */
  step?: number;
  /**
   * Dims the indicator and, when it is editable, stops it from being changed or focused.
   * @default false
   */
  disabled?: boolean;
  /** Name under which an editable indicator's value is submitted with a form. */
  name?: string;
  /**
   * Value at which the fill turns yellow. If `criticalValue` is lower than `warningValue`, low
   * values are the problem (a battery) and the fill changes at or below each; otherwise high
   * values are (a disk) and it changes at or above each. Ignored by `"rating"`,
   * `"relevancy"` and `"storage"`.
   */
  warningValue?: number;
  /** Value at which the fill turns red. See `warningValue`. */
  criticalValue?: number;
  /**
   * Colours the fill in tiers (NSLevelIndicator.drawsTieredCapacityLevels): each part of a
   * continuous fill, and each filled segment, keeps the colour of the level it lies in, so a
   * critical value shows green, then yellow, then red. Without it the whole fill takes the
   * colour of the level the value has reached. Needs `warningValue` or `criticalValue`.
   * @default false
   */
  tiered?: boolean;
  /**
   * Number of tick marks drawn under a `"continuous"` indicator, spread evenly from end to
   * end. Fewer than two draws none.
   * @default 0
   */
  tickMarks?: number;
  /** `Intl.NumberFormat` options used to format the value for assistive technology. */
  format?: Intl.NumberFormatOptions;
  /** Locale used to format the value. Defaults to the runtime's locale. */
  locale?: Intl.LocalesArgument;
  /**
   * Returns the text that assistive technology reads for the value, for example
   * “3 of 5 stars”.
   */
  getAriaValueText?: (formattedValue: string, value: number) => string;
  /** Ref to the rendered element. */
  ref?: Ref<HTMLDivElement>;
} & MeterOrSliderRoot;

/** A five-pointed star in a 13 pt box; original artwork. */
const STAR =
  "M6.5.35l1.59 4.32 4.59.17-3.61 2.84 1.25 4.43L6.5 9.55l-3.82 2.56 1.25-4.43L.32 4.84l4.59-.17z";

/** The most segments or stars one indicator draws. */
const MAX_SEGMENTS = 100;

const lowIsBad = (warning: number | undefined, critical: number | undefined) =>
  warning != null && critical != null && critical < warning;

function levelOf(value: number, warning: number | undefined, critical: number | undefined) {
  const low = lowIsBad(warning, critical);
  const reached = (limit: number | undefined) =>
    limit != null && (low ? value <= limit : value >= limit);
  if (reached(critical)) return "critical";
  if (reached(warning)) return "warning";
  return "normal";
}

/**
 * Where the colour of a tiered continuous fill changes, as lengths along the fill: `--_t1`
 * ends the first tier and `--_t2` the second. The fill is as long as the value, kept within
 * the range as Base UI keeps it: a value beyond `max` fills the track and no more. A limit
 * that is not given, or lies beyond the value, falls outside the fill.
 */
function tierStops(
  min: number,
  max: number,
  value: number,
  warning: number | undefined,
  critical: number | undefined,
) {
  const span = Math.min(Math.max(value, min), max) - min;
  const at = (limit: number | undefined) =>
    limit == null || !(span > 0)
      ? "1000000%"
      : `${Math.min(Math.max(((limit - min) / span) * 100, 0), 1000000)}%`;
  const [first, second] = lowIsBad(warning, critical)
    ? [critical, warning]
    : [warning ?? critical, critical];
  return { "--_t1": at(first), "--_t2": at(second) } as CSSProperties;
}

/**
 * A level indicator (NSLevelIndicator): shows a value within a range as a capacity bar, a row
 * of segments, a rating or a relevance, and with `editable` lets people set it.
 *
 * A read-only indicator is built on Base UI's Meter and an editable one on Base UI's Slider,
 * which supplies the pointer and keyboard handling, the slider semantics and the form value.
 * Name it with `aria-label` or `aria-labelledby`.
 */
export function LevelIndicator({
  variant = "continuous",
  value,
  defaultValue,
  min = 0,
  max = 100,
  editable = false,
  onValueChange,
  onValueCommitted,
  step = 1,
  disabled = false,
  name,
  warningValue,
  criticalValue,
  tiered = false,
  tickMarks = 0,
  format,
  locale,
  getAriaValueText,
  className,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-details": ariaDetails,
  "aria-valuetext": ariaValueText,
  ...props
}: LevelIndicatorProps) {
  const { style, render, ...rest } = props;
  // The value is always handed to Base UI controlled, because the segments, the stars and the
  // warning level are drawn from it here.
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? min);
  const current = value ?? uncontrolled;

  const stepped = variant === "discrete" || variant === "rating";
  const leveled = variant === "continuous" || variant === "discrete";
  const span = max - min;
  const range = Math.round(span);
  const count = stepped && Number.isFinite(range) ? Math.min(Math.max(range, 0), MAX_SEGMENTS) : 0;
  // How much of the range one segment or star stands for: 1, unless the range was capped.
  // Then it is an equal share of the range as it is: rounding is for the count only.
  const share = count > 0 && range > count ? span / count : 1;
  const tiers = tiered && leveled && (warningValue != null || criticalValue != null);
  // Meter and Slider have the same two parts for a bar; only the primitive differs.
  const Parts = editable ? BaseSlider : BaseMeter;

  let content: ReactNode;
  if (stepped) {
    const filled = Math.min(Math.max(Math.round((current - min) / share), 0), count);
    const items = [];
    for (let index = 0; index < count; index++) {
      const on = index < filled ? "" : undefined;
      items.push(
        variant === "rating" ? (
          <svg
            key={index}
            className="mac-level-indicator-star"
            data-filled={on}
            viewBox="0 0 13 13"
            aria-hidden="true"
            focusable="false"
          >
            <path d={STAR} />
          </svg>
        ) : (
          <span
            key={index}
            className="mac-level-indicator-segment"
            data-filled={on}
            data-level={
              tiers && on != null
                ? levelOf(min + (index + 1) * share, warningValue, criticalValue)
                : undefined
            }
          />
        ),
      );
    }
    content = <span className="mac-level-indicator-segments">{items}</span>;
  } else {
    content = (
      <Parts.Track className="mac-level-indicator-track">
        <Parts.Indicator
          className="mac-level-indicator-fill"
          style={tiers ? tierStops(min, max, current, warningValue, criticalValue) : undefined}
        />
      </Parts.Track>
    );
  }

  const ticks = variant === "continuous" && tickMarks > 1 && (
    <span
      className="mac-level-indicator-ticks"
      style={{ "--_ticks": Math.round(tickMarks) } as CSSProperties}
    />
  );

  const shared = {
    min,
    max,
    format,
    locale,
    "data-variant": variant,
    "data-level": leveled ? levelOf(current, warningValue, criticalValue) : undefined,
    "data-tiered": tiers
      ? lowIsBad(warningValue, criticalValue)
        ? "falling"
        : "rising"
      : undefined,
    ...rest,
  };
  // Handed on as they came: Base UI calls the functions with the state of the root it renders,
  // which is the state their types promised (see MeterOrSliderRoot).
  const forms: unknown = {
    className: withClassName(
      "mac-level-indicator",
      className as unknown as StatefulClassName<unknown>,
    ),
    style,
    render,
  };

  if (!editable) {
    // Only what was given: an explicit `undefined` would hide Base UI's own value text.
    const text = {
      ...(getAriaValueText && { getAriaValueText }),
      ...(ariaValueText != null && { "aria-valuetext": ariaValueText }),
    };
    return (
      <BaseMeter.Root
        value={current}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-details={ariaDetails}
        data-disabled={disabled ? "" : undefined}
        {...text}
        {...shared}
        {...(forms as MeterForms)}
      >
        {content}
        {ticks}
      </BaseMeter.Root>
    );
  }

  return (
    <BaseSlider.Root
      value={current}
      onValueChange={(next) => {
        if (value === undefined) setUncontrolled(next);
        onValueChange?.(next);
      }}
      onValueCommitted={onValueCommitted}
      // A segment or a star at a time: one unit, or the share of a capped range it stands for.
      step={stepped ? share : step}
      largeStep={(stepped ? share : step) * 10}
      disabled={disabled}
      name={name}
      data-editable=""
      {...shared}
      {...(forms as SliderForms)}
    >
      <BaseSlider.Control
        className="mac-level-indicator-control"
        style={stepped ? ({ "--_count": Math.max(1, count) } as CSSProperties) : undefined}
      >
        {content}
        {/* Invisible: it holds the range input that takes keyboard focus and the form value.
            The input is the slider, so what names and describes the indicator goes to it. */}
        <BaseSlider.Thumb
          className="mac-level-indicator-thumb"
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          // Base UI passes the three attributes above on to the input, and no other, and has
          // no prop for the rest: `aria-details` is set when the input mounts, so markup
          // rendered on a server carries it only from hydration on.
          inputRef={(input) => {
            if (ariaDetails == null) input?.removeAttribute("aria-details");
            else input?.setAttribute("aria-details", ariaDetails);
          }}
          {...(ariaValueText != null && { "aria-valuetext": ariaValueText })}
          {...(getAriaValueText && { getAriaValueText })}
        />
      </BaseSlider.Control>
      {ticks}
    </BaseSlider.Root>
  );
}

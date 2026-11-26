"use client";

import { Toggle as BaseToggle } from "@base-ui/react/toggle";
import { ToggleGroup as BaseToggleGroup } from "@base-ui/react/toggle-group";
import { createContext, type Ref, useContext, useId } from "react";
import { withClassName } from "../../lib/cn";
import type { ControlSize } from "../../lib/control-size";
import "./segmented-control.tokens.css";
import "./segmented-control.css";

/** True inside a momentary control, whose segments are plain buttons without a pressed state. */
const MomentaryContext = createContext(false);

/** The value of a momentary control: nothing is ever selected, whatever `value` is passed. */
const MOMENTARY = { value: [], defaultValue: undefined };

export interface SegmentedControlProps<Value extends string = string>
  extends Omit<BaseToggleGroup.Props<Value>, "ref" | "orientation"> {
  /**
   * How the segments track clicks (NSSegmentedControl.trackingMode). `"select-one"` keeps
   * exactly one segment selected once a choice is made, like radio buttons: clicking the
   * selected segment does not deselect it. `"select-any"` lets every segment toggle on its
   * own, like checkboxes. `"momentary"` selects nothing: every segment is a plain button, so
   * handle `onClick` on each `Segment`; `value` and `onValueChange` are not used.
   * @default "select-one"
   */
  trackingMode?: "select-one" | "select-any" | "momentary";
  /**
   * Base UI's name for `trackingMode="select-any"`; either spelling works.
   * @default false
   */
  multiple?: boolean;
  /**
   * Bezel style (NSSegmentedControl.segmentStyle). `"rounded"` is one bezel divided by
   * hairlines; `"separated"` gives every segment a bezel of its own, one point apart.
   * @default "rounded"
   */
  variant?: "rounded" | "separated";
  /**
   * AppKit control size.
   * @default "regular"
   */
  size?: ControlSize;
  /**
   * How width is shared out (NSSegmentedControl.segmentDistribution). `"fill-equally"` makes
   * every segment as wide as the widest one; `"fit"` sizes each segment to its content, or to
   * the `width` you give it.
   * @default "fill-equally"
   */
  distribution?: "fill-equally" | "fit";
  /** Ref to the group element. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * A Catalina segmented control (NSSegmentedControl): a row of segments that each work as a
 * button, for closely related choices.
 *
 * Built on Base UI's Toggle Group, so it also accepts `value`, `defaultValue`, `onValueChange`,
 * `disabled`, `loopFocus` and `render`. As in Base UI the value is always an array, also when
 * one segment is selected. Give the group an accessible name with `aria-label` or
 * `aria-labelledby`.
 */
export function SegmentedControl<Value extends string = string>({
  trackingMode = "select-one",
  multiple = false,
  variant = "rounded",
  size = "regular",
  distribution = "fill-equally",
  onValueChange,
  className,
  ...props
}: SegmentedControlProps<Value>) {
  const mode = multiple ? "select-any" : trackingMode;
  return (
    <MomentaryContext.Provider value={mode === "momentary"}>
      <BaseToggleGroup<Value>
        data-tracking-mode={mode}
        data-variant={variant}
        data-size={size}
        data-distribution={distribution}
        className={withClassName("mac-segmented-control", className)}
        {...props}
        {...(mode === "momentary" ? MOMENTARY : undefined)}
        multiple={mode === "select-any"}
        onValueChange={(value, details) => {
          // Momentary segments never stay on, and a select-one control keeps its selection
          // when the selected segment is clicked again: veto the change inside Base UI.
          if (mode === "momentary" || (mode === "select-one" && value.length === 0)) {
            details.cancel();
          } else {
            onValueChange?.(value, details);
          }
        }}
      />
    </MomentaryContext.Provider>
  );
}

export interface SegmentProps<Value extends string = string>
  extends Omit<BaseToggle.Props<Value>, "ref"> {
  /** Ref to the rendered button. */
  ref?: Ref<HTMLButtonElement>;
}

/**
 * One segment of a `SegmentedControl`: a text title or a template icon you draw with
 * `currentColor`, not both mixed within one control.
 *
 * Built on Base UI's Toggle, so it accepts `value` (required in the selecting modes),
 * `disabled`, `onPressedChange`, `render` and every native button attribute. A segment with
 * only an icon needs an `aria-label`.
 */
export function Segment<Value extends string = string>({
  className,
  value,
  ...props
}: SegmentProps<Value>) {
  const momentary = useContext(MomentaryContext);
  // A momentary control holds an empty value, and Base UI wants every toggle of a group that
  // has a value to carry one: a segment given none gets one of its own.
  const own = useId();
  return (
    <BaseToggle<Value>
      className={withClassName("mac-segmented-control-segment", className)}
      value={value ?? (momentary ? (own as Value) : undefined)}
      {...props}
      // A momentary segment is a plain button; "not pressed" would announce a toggle.
      {...(momentary ? { "aria-pressed": undefined } : undefined)}
    />
  );
}

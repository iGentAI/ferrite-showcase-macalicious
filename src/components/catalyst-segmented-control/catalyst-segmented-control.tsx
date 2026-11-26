"use client";

import { Radio as BaseRadio } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import type { Ref } from "react";
import { withClassName } from "../../lib/cn";
import "./catalyst-segmented-control.tokens.css";
import "./catalyst-segmented-control.css";

export interface CatalystSegmentedControlProps extends Omit<BaseRadioGroup.Props, "ref"> {
  /** Ref to the root element. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * The segmented control of a Mac Catalyst app (`UISegmentedControl` in its iOS 13 style), as
 * the People and Devices switch of Find My: a grey track 24.5 pt tall whose selected segment
 * is a raised pill. AppKit's own segmented control is `SegmentedControl`.
 *
 * It is a radio group, built on Base UI's RadioGroup, so it takes `value`, `defaultValue`,
 * `onValueChange`, `disabled` and `name`; the arrow keys move the selection. Put
 * `CatalystSegment`s inside and name it with `aria-label`. Segments share its width equally.
 */
export function CatalystSegmentedControl({ className, ...props }: CatalystSegmentedControlProps) {
  return (
    <BaseRadioGroup
      {...props}
      className={withClassName("mac-catalyst-segmented-control", className)}
    />
  );
}

export interface CatalystSegmentProps extends Omit<BaseRadio.Root.Props, "ref"> {
  /** Ref to the radio element. */
  ref?: Ref<HTMLSpanElement>;
}

/** One segment of a `CatalystSegmentedControl`: a radio whose children are its title. */
export function CatalystSegment({ className, children, ...props }: CatalystSegmentProps) {
  return (
    <span className="mac-catalyst-segmented-control-slot">
      <BaseRadio.Root
        {...props}
        className={withClassName("mac-catalyst-segmented-control-segment", className)}
      >
        {children}
      </BaseRadio.Root>
    </span>
  );
}

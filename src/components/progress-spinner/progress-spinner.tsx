"use client";

import { Progress as BaseProgress } from "@base-ui/react/progress";
import { type CSSProperties, type Ref, useCallback } from "react";
import { attachRef } from "../../lib/attach-ref";
import { withClassName } from "../../lib/cn";
import type { ControlSize } from "../../lib/control-size";
import { trackOffscreen } from "../../lib/offscreen";
import "./progress-spinner.tokens.css";
import "./progress-spinner.css";

export interface ProgressSpinnerProps
  extends Omit<BaseProgress.Root.Props, "ref" | "value" | "children"> {
  /**
   * `null` shows the spinning indicator, for work whose length is not known. A number between
   * `min` and `max` shows the determinate form instead: a circle that fills clockwise.
   * @default null
   */
  value?: number | null;
  /**
   * AppKit control size: 32 pt, 16 pt or 10 pt across.
   * @default "regular"
   */
  size?: ControlSize;
  /**
   * Whether the indicator spins (NSProgressIndicator's startAnimation and stopAnimation). A
   * stopped spinner runs no animation and, unless `displayedWhenStopped` is set, is hidden
   * while keeping its place in the layout.
   * @default true
   */
  animating?: boolean;
  /**
   * Keeps a stopped spinner visible, as a still frame (NSProgressIndicator's
   * isDisplayedWhenStopped).
   * @default false
   */
  displayedWhenStopped?: boolean;
  /** Ref to the rendered element. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * A progress spinner (NSProgressIndicator with the spinning style): twelve fading spokes that
 * step round once a second while work of unknown length is under way.
 *
 * Built on Base UI's Progress, so it also accepts `min`, `max`, `format`, `locale`,
 * `getAriaValueText` and `aria-valuetext`. Name it with `aria-label` or `aria-labelledby`.
 */
export function ProgressSpinner({
  value = null,
  min = 0,
  max = 100,
  size = "regular",
  animating = true,
  displayedWhenStopped = false,
  className,
  ref,
  ...props
}: ProgressSpinnerProps) {
  const fraction =
    value == null || max <= min ? null : Math.min(Math.max((value - min) / (max - min), 0), 1);

  // Only a spinner that is spinning is watched: it is paused while it is off screen. The
  // callback always returns a cleanup, so React never calls it with null: the cleanup releases
  // the caller's ref itself.
  const spinning = value == null && animating;
  const setRoot = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) return;
      const release = attachRef(ref, element);
      const stop = spinning ? trackOffscreen(element) : undefined;
      return () => {
        stop?.();
        release();
      };
    },
    [ref, spinning],
  );

  return (
    <BaseProgress.Root
      ref={setRoot}
      value={value}
      min={min}
      max={max}
      data-size={size}
      data-animating={animating ? "" : undefined}
      data-displayed-when-stopped={displayedWhenStopped ? "" : undefined}
      className={withClassName("mac-progress-spinner", className)}
      {...props}
    >
      {fraction == null ? (
        <span className="mac-progress-spinner-spokes" />
      ) : (
        <span
          className="mac-progress-spinner-pie"
          style={{ "--_fraction": fraction } as CSSProperties}
        />
      )}
    </BaseProgress.Root>
  );
}

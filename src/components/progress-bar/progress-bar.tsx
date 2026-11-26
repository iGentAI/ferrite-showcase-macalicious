"use client";

import { Progress as BaseProgress } from "@base-ui/react/progress";
import { type Ref, useCallback } from "react";
import { attachRef } from "../../lib/attach-ref";
import { withClassName } from "../../lib/cn";
import { trackOffscreen } from "../../lib/offscreen";
import "./progress-bar.tokens.css";
import "./progress-bar.css";

export interface ProgressBarProps
  extends Omit<BaseProgress.Root.Props, "ref" | "value" | "children"> {
  /**
   * The current value, between `min` and `max`. `null` makes the bar indeterminate: a band
   * sweeps along the track for work whose length is not known.
   * @default null
   */
  value?: number | null;
  /**
   * AppKit control size: the regular bar is 6 pt high, the small one 4 pt.
   * @default "regular"
   */
  size?: "regular" | "small";
  /**
   * Whether an indeterminate bar animates (NSProgressIndicator's startAnimation and
   * stopAnimation). A stopped bar shows an empty track and runs no animation.
   * @default true
   */
  animating?: boolean;
  /** Ref to the rendered element. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * A progress bar (NSProgressIndicator with the bar style): a capsule that fills with the
 * accent colour as a task advances, or carries a sweeping band while the length of the task
 * is unknown.
 *
 * Built on Base UI's Progress, so it also accepts `min`, `max`, `format`, `locale`,
 * `getAriaValueText` and `aria-valuetext`. Name it with `aria-label` or `aria-labelledby`.
 */
export function ProgressBar({
  value = null,
  size = "regular",
  animating = true,
  className,
  ref,
  ...props
}: ProgressBarProps) {
  // Only a bar that is animating is watched: its sweep is paused while it is off screen.
  // The callback always returns a cleanup, so React never calls it with null: the cleanup
  // releases the caller's ref itself.
  const sweeping = value == null && animating;
  const setRoot = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) return;
      const release = attachRef(ref, element);
      const stop = sweeping ? trackOffscreen(element) : undefined;
      return () => {
        stop?.();
        release();
      };
    },
    [ref, sweeping],
  );

  return (
    <BaseProgress.Root
      ref={setRoot}
      value={value}
      data-size={size}
      data-animating={animating ? "" : undefined}
      className={withClassName("mac-progress-bar", className)}
      {...props}
    >
      <BaseProgress.Track className="mac-progress-bar-track">
        <BaseProgress.Indicator className="mac-progress-bar-indicator" />
      </BaseProgress.Track>
    </BaseProgress.Root>
  );
}

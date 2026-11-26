"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import type { ComponentProps, CSSProperties } from "react";
import { REFERENCE, text } from "./date-picker-date";
import "./date-picker.tokens.css";
import "./date-picker.css";

export interface DatePickerClockProps extends Omit<ComponentProps<"div">, "children"> {
  /**
   * The time the hands show. Without it the clock shows midnight; pass the current time from
   * an effect or a timer to make it run.
   * @default midnight, 1 January 2001
   */
  value?: Date;
}

/** The date picker's clock. */
export function DatePickerClock({ value = REFERENCE, ...props }: DatePickerClockProps) {
  return (
    <div
      role="img"
      aria-label={value.toTimeString().slice(0, 8)}
      {...mergeProps<"div">(
        {
          className: "mac-date-picker-clock",
          // The stylesheet turns the hands from these: hours, minutes and seconds.
          style: {
            "--_h": value.getHours(),
            "--_m": value.getMinutes(),
            "--_s": value.getSeconds(),
          } as CSSProperties,
        },
        props,
      )}
    >
      {/* The numerals, 1 to 12. */}
      {[...Array(12)].map((_, hour) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the twelve numerals never change
        <span key={hour} style={{ "--_n": hour + 1 } as CSSProperties}>
          {hour + 1}
        </span>
      ))}
      <span className="mac-date-picker-clock-period">{text(value, "P")}</span>
    </div>
  );
}

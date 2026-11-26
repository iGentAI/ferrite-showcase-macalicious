"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { type ComponentProps, useRef } from "react";
import type { ControlSize } from "../../lib/control-size";
import { Stepper } from "../stepper";
import { TextFieldBezel } from "../text-field";
import {
  FILL,
  highest,
  type Letter,
  read,
  SEGMENTS,
  step,
  text,
  useDate,
  write,
} from "./date-picker-date";
import "./date-picker.tokens.css";
import "./date-picker.css";

/**
 * What a textual date picker shows, in AppKit's names (NSDatePicker.ElementFlags): date
 * elements, time elements, or one of each separated by a space.
 */
export type DatePickerElements =
  | "yearMonthDay"
  | "yearMonth"
  | "hourMinute"
  | "hourMinuteSecond"
  | `${"yearMonthDay" | "yearMonth"} ${"hourMinute" | "hourMinuteSecond"}`;

export interface DatePickerProps
  extends Omit<ComponentProps<"div">, "children" | "defaultValue" | "onChange"> {
  /** The date, when controlled. Use it with `onValueChange`. */
  value?: Date;
  /**
   * The date the picker starts with, when uncontrolled. Without it the picker starts at
   * 1 January 2001, midnight, on the server and in the browser alike; pass the current date
   * for a picker that starts now.
   */
  defaultValue?: Date;
  /** Called with the new date whenever a key, a typed digit or the stepper changes it. */
  onValueChange?: (value: Date) => void;
  /** Earliest date (NSDatePicker.minDate). An earlier result is replaced by it. */
  min?: Date;
  /** Latest date (NSDatePicker.maxDate). A later result is replaced by it. */
  max?: Date;
  /**
   * The elements the field shows (NSDatePicker.datePickerElements): `"yearMonthDay"` or
   * `"yearMonth"`, `"hourMinute"` or `"hourMinuteSecond"`, or one of each separated by a
   * space, the date first.
   * @default "yearMonthDay hourMinuteSecond"
   */
  elements?: DatePickerElements;
  /**
   * Whether a stepper stands beside the field (NSDatePicker.Style.textFieldAndStepper). Without
   * it the picker is the field alone (`.textField`).
   * @default true
   */
  stepper?: boolean;
  /**
   * Disables the picker: its elements leave the tab order and the stepper ignores clicks.
   * @default false
   */
  disabled?: boolean;
  /**
   * AppKit control size.
   * @default "regular"
   */
  size?: ControlSize;
}

// The elements of each flag as a pattern: a letter of SEGMENTS is an element, anything else
// is text between them. The order is the one the reference screenshots show (United States).
// The spaces do not break: the field is a flex container, which drops a run of plain spaces.
const PATTERNS: Record<string, string> = {
  yearMonthDay: "M/D/Y",
  yearMonth: "M/Y",
  hourMinute: "h:m\u00a0P",
  hourMinuteSecond: "h:m:s\u00a0P",
};

const focus = (element?: Element | null) => (element as HTMLElement | null)?.focus();

/** The textual date picker. */
export function DatePicker({
  value,
  defaultValue,
  onValueChange,
  min,
  max,
  elements = "yearMonthDay hourMinuteSecond",
  stepper = true,
  disabled = false,
  size = "regular",
  ...props
}: DatePickerProps) {
  const [date, setDate] = useDate(value, defaultValue, onValueChange, min, max);
  const field = useRef<HTMLDivElement>(null);
  // The element the stepper changes, the one focused last: its letter and its node.
  const selected = useRef<[Letter, Element]>(undefined);
  // The digits typed into the focused element so far, as a number.
  const typed = useRef(0);
  const pattern = elements
    .split(" ")
    .map((name) => PATTERNS[name])
    .join("\u00a0");

  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring a legend and form semantics
    <div
      role="group"
      data-size={size}
      data-disabled={disabled ? "" : undefined}
      {...mergeProps<"div">({ className: "mac-date-picker", style: FILL }, props)}
    >
      <TextFieldBezel ref={field} className="mac-date-picker-field" size={size} disabled={disabled}>
        {([...pattern] as Letter[]).map((letter) => {
          const segment = SEGMENTS[letter];
          if (!segment) return letter;
          const shown = text(date, letter);
          return (
            <span
              key={letter}
              role="spinbutton"
              tabIndex={disabled ? undefined : 0}
              aria-label={segment[0]}
              aria-valuenow={read(date, letter)}
              aria-valuemin={segment[2]}
              aria-valuemax={highest(date, letter)}
              aria-valuetext={shown.trim()}
              aria-disabled={disabled || undefined}
              className="mac-date-picker-segment"
              onFocus={(event) => {
                typed.current = 0;
                selected.current = [letter, event.currentTarget];
              }}
              onKeyDown={(event) => {
                const { key, currentTarget } = event;
                if (disabled || event.altKey || event.ctrlKey || event.metaKey) return;
                // Only digits typed one after another join: a step ends the entry.
                const delta = ({ ArrowUp: 1, ArrowDown: -1 } as Record<string, number>)[key];
                if (delta) {
                  typed.current = 0;
                  setDate(step(date, letter, delta));
                } else if (key === "ArrowLeft") focus(currentTarget.previousElementSibling);
                else if (key === "ArrowRight") focus(currentTarget.nextElementSibling);
                else if (letter === "P" && /^[ap]$/i.test(key)) {
                  setDate(write(date, letter, +/p/i.test(key)));
                } else if (letter !== "P" && /^\d$/.test(key)) {
                  // A digit joins the ones typed before it while the result still fits the
                  // element; when no further digit could, the next element takes over.
                  let entry = typed.current * 10 + +key;
                  if (entry > segment[3]) entry = +key;
                  typed.current = entry;
                  if (entry >= segment[2]) setDate(write(date, letter, entry));
                  if (entry * 10 > segment[3]) focus(currentTarget.nextElementSibling);
                } else return;
                event.preventDefault();
              }}
            >
              {shown}
            </span>
          );
        })}
      </TextFieldBezel>
      {stepper && (
        // The stepper is a pointer's way to the Up and Down keys of the selected element: it
        // is out of the tab order and exposes its two buttons, not a value of its own.
        <Stepper
          role="group"
          tabIndex={-1}
          // biome-ignore lint/a11y/useValidAriaValues: removes the stepper's own value
          aria-valuenow={undefined}
          size={size}
          disabled={disabled}
          value={0}
          onValueChange={(delta) => {
            // An element that `elements` has removed since is no longer the selected one.
            const [letter, element] = selected.current?.[1].isConnected
              ? selected.current
              : [pattern[0] as Letter, field.current?.firstElementChild];
            focus(element);
            setDate(step(date, letter, delta));
          }}
        />
      )}
    </div>
  );
}

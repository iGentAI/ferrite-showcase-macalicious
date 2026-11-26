"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import type { ComponentProps } from "react";
import { TextFieldBezel } from "../text-field";
import { FILL, useDate, write } from "./date-picker-date";
import "./date-picker.tokens.css";
import "./date-picker.css";

export interface DatePickerCalendarProps
  extends Omit<ComponentProps<"div">, "children" | "defaultValue" | "onChange"> {
  /** The date, when controlled. Use it with `onValueChange`. */
  value?: Date;
  /**
   * The date the calendar starts with, when uncontrolled. Without it the calendar starts at
   * 1 January 2001, on the server and in the browser alike; pass the current date for a
   * calendar that starts today.
   */
  defaultValue?: Date;
  /**
   * Called with the new date whenever a click, a key or a button selects another day. The
   * time of day is the value's, except after the Today button, which gives the current time.
   */
  onValueChange?: (value: Date) => void;
  /**
   * Earliest date (NSDatePicker.minDate). A day cannot be selected when it would give an
   * earlier date at the value's time of day.
   */
  min?: Date;
  /**
   * Latest date (NSDatePicker.maxDate). A day cannot be selected when it would give a later
   * date at the value's time of day.
   */
  max?: Date;
  /**
   * Disables the calendar: its days and buttons leave the tab order and ignore clicks.
   * @default false
   */
  disabled?: boolean;
}

const WEEKDAYS = "Sunday Monday Tuesday Wednesday Thursday Friday Saturday".split(" ");

// Once the keyboard focus is in the grid it stays on the selected day: the keys act on that
// day, not on a cell that was clicked. Called after every render and after every click,
// whether or not the click selected another day.
const hold = (grid: HTMLElement | null) => {
  if (grid?.contains(document.activeElement)) {
    grid.querySelector<HTMLElement>("[aria-selected=true]")?.focus();
  }
};

/** The date picker's calendar. */
export function DatePickerCalendar({
  value,
  defaultValue,
  onValueChange,
  min,
  max,
  disabled = false,
  ...props
}: DatePickerCalendarProps) {
  const [date, setDate] = useDate(value, defaultValue, onValueChange, min, max);

  const month = date.getMonth();
  // A day of the shown month by number, at the value's time of day; numbers below 1 and
  // beyond the month's length reach into the neighbouring months.
  const day = (number: number) => {
    const result = new Date(date);
    result.setDate(number);
    return result;
  };
  // The grid starts on the Sunday on or before the first of the month.
  const start = 1 - day(1).getDay();

  return (
    // The frame is the bezel of a text field: its edge, its fill and its focus ring.
    <TextFieldBezel
      role="group"
      disabled={disabled}
      {...mergeProps<"div">({ className: "mac-date-picker-calendar", style: FILL }, props)}
    >
      {"Previous month,Today,Next month".split(",").map((label, index) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          disabled={disabled}
          className="mac-date-picker-calendar-button"
          // The month is written from 1: `month` is the previous one and `month + 2` the next.
          onClick={() => setDate(index === 1 ? new Date() : write(date, "M", month + index))}
        />
      ))}
      <table
        // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: a table of days is a grid, as in the WAI-ARIA date grid
        role="grid"
        className="mac-date-picker-calendar-grid"
        // An inline function, so that it runs after every render.
        ref={(grid) => hold(grid)}
        onClick={(event) => hold(event.currentTarget)}
        onKeyDown={(event) => {
          const { key } = event;
          // Days an arrow key moves the selection by; Page Up and Page Down move it a month.
          const days = (
            { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>
          )[key];
          const next =
            key === "PageUp"
              ? write(date, "M", month)
              : key === "PageDown"
                ? write(date, "M", month + 2)
                : days && day(date.getDate() + days);
          if (disabled || !next) return;
          event.preventDefault();
          setDate(next);
        }}
      >
        {/* The picker shows the month of its date and no other, as NSDatePicker does; the
            caption is the header's title and names the grid. `toDateString` is the same in
            every locale, "Thu Oct 03 2019": the title is its month and its year. */}
        <caption>{date.toDateString().replace(/....(...) ../, "$1")}</caption>
        <thead>
          <tr>
            {WEEKDAYS.map((name) => (
              // In the head's one row a header cell is a column header without `scope`.
              <th key={name} aria-label={name}>
                {name.slice(0, 2)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {WEEKDAYS.slice(1).map((week, row) => (
            <tr key={week}>
              {WEEKDAYS.map((name, column) => {
                const when = day(start + row * 7 + column);
                const off = disabled || (min && when < min) || (max && when > max) || undefined;
                const selected = +when === +date;
                return (
                  // biome-ignore lint/a11y/useKeyWithClickEvents: the grid handles the keys
                  <td
                    key={name}
                    // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: the cell of a grid, as in the WAI-ARIA date grid
                    role="gridcell"
                    tabIndex={off ? undefined : selected ? 0 : -1}
                    aria-selected={selected}
                    aria-disabled={off}
                    data-outside={when.getMonth() === month ? undefined : ""}
                    onClick={off ? undefined : () => setDate(when)}
                  >
                    {when.getDate()}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </TextFieldBezel>
  );
}

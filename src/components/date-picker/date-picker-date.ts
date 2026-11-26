"use client";

import type { CSSProperties } from "react";
import { useControlled } from "../../lib/use-controlled";

// Calendar arithmetic of the date picker: pure functions of local-time `Date`s, and the state
// hook its two editable forms share. Nothing here reads the clock.
// Comments are line comments on purpose: the size budget counts what the build keeps.

// The date a picker without a value shows: the reference date of AppKit's NSDate,
// 1 January 2001, the same on the server and in every browser.
export const REFERENCE = new Date(2001, 0, 1);

// The fill of the picker's bezels, through the hook the text field's bezel reads.
export const FILL = {
  "--mac-text-field-background": "var(--mac-date-picker-background)",
} as CSSProperties;

export type Letter = "M" | "D" | "Y" | "h" | "m" | "s" | "P";

// The elements a field can hold, by pattern letter: name, `Date` accessor, lowest and highest
// value. "h" is the hour on a 12-hour clock and "P" the half of the day (0 AM, 1 PM).
export const SEGMENTS: Record<Letter, [string, string, number, number]> = {
  M: ["Month", "Month", 1, 12],
  D: ["Day", "Date", 1, 31],
  Y: ["Year", "FullYear", 1, 9999],
  h: ["Hour", "Hours", 1, 12],
  m: ["Minute", "Minutes", 0, 59],
  s: ["Second", "Seconds", 0, 59],
  P: ["AM/PM", "Hours", 0, 1],
};

// The highest value of an element: for the day, the length of the month of `date`.
export const highest = (date: Date, letter: Letter) =>
  letter === "D"
    ? new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    : SEGMENTS[letter][3];

// The value of one element of `date`.
export const read = (date: Date, letter: Letter) => {
  const value = date[`get${SEGMENTS[letter][1]}` as "getDate"]();
  return letter === "M"
    ? value + 1
    : letter === "h"
      ? value % 12 || 12
      : letter === "P"
        ? +(value > 11)
        : value;
};

// A copy of `date` with one element set. The other elements stay, except that the day is held
// back to the last one of a shorter month. A month outside 1 to 12 reaches into another year.
export const write = (date: Date, letter: Letter, value: number) => {
  const next = new Date(date);
  const hours = date.getHours();
  next[`set${SEGMENTS[letter][1]}` as "setDate"](
    letter === "M"
      ? value - 1
      : letter === "D"
        ? Math.min(value, highest(date, letter))
        : letter === "h"
          ? (value % 12) + hours - (hours % 12)
          : letter === "P"
            ? (hours % 12) + value * 12
            : value,
  );
  if (letter !== "D" && next.getDate() !== date.getDate()) next.setDate(0);
  return next;
};

// One element moved by `delta`, wrapping inside its own range without carrying into the next.
export const step = (date: Date, letter: Letter, delta: number) => {
  const lowest = SEGMENTS[letter][2];
  const last = highest(date, letter);
  const value = read(date, letter) + delta;
  return write(date, letter, value > last ? lowest : value < lowest ? last : value);
};

// The text of one element: minutes and seconds with a leading zero, the others padded to two
// places with a figure space, as AppKit sets them ("10/ 3/2019").
export const text = (date: Date, letter: Letter) => {
  const value = read(date, letter);
  return letter === "P"
    ? `${"AP"[value]}M`
    : String(value).padStart(2, "ms".includes(letter) ? "0" : "\u2007");
};

// The picker's date and its setter. Controlled by `value`, started by `defaultValue`; with
// neither it starts at the reference date. The setter keeps a date inside `min` and `max`.
export function useDate(
  value: Date | undefined,
  defaultValue = REFERENCE,
  onValueChange: ((value: Date) => void) | undefined,
  min: Date | undefined,
  max: Date | undefined,
): [Date, (value: Date) => void] {
  const [date, setDate] = useControlled(value, defaultValue, onValueChange);
  return [date, (next) => setDate(min && next < min ? min : max && next > max ? max : next)];
}

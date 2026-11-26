import { useState } from "react";
import { readBoolean, useDesktopSetting } from "../desktop/desktop-personal";
import { servedByDesktopApp } from "../desktop/desktop-server";
import { type ProgrammerBase, parseProgrammer } from "./calculator-bits";
import { type CalculatorState, displayText, formatNumber } from "./calculator-engine";

/*
 * What Calculator keeps of how it looks and what it holds: the person's desktop values, which
 * survive a reload, when the desktop's Ferrite application serves it. Anywhere else (the
 * documentation, the tests) each is the window's own state and lasts as long as the window.
 */

export const CALCULATOR_SETTINGS = {
  layout: "calculator.layout",
  separators: "calculator.separators",
  decimals: "calculator.decimals",
  degrees: "calculator.degrees",
  saved: "calculator.saved",
  rpn: "calculator.rpn",
  speakButtons: "calculator.speakButtons",
  speakResults: "calculator.speakResults",
  recent: "calculator.recentConversions",
  tapeOpen: "calculator.tapeOpen",
} as const;

export type CalculatorLayout = "basic" | "scientific" | "programmer";

/** The window's frame in each layout, which the keypad's grid fills exactly. */
export const LAYOUT_SIZE: Record<CalculatorLayout, { width: number; height: number }> = {
  basic: { width: 232, height: 321 },
  scientific: { width: 580, height: 321 },
  programmer: { width: 412, height: 402 },
};

/** How much taller RPN Mode's row of stack keys makes a window: its 30 pt and a 1 pt gap. */
const RPN_ROW = 31;

export const frameOf = (layout: CalculatorLayout, rpn: boolean) => {
  const { width, height } = LAYOUT_SIZE[layout];
  return { width, height: rpn ? height + RPN_ROW : height };
};

export const readLayout = (stored: unknown): CalculatorLayout | undefined =>
  stored === "basic" || stored === "scientific" || stored === "programmer" ? stored : undefined;

/** Decimal Places runs to this, which leaves a number as it is. */
export const MAX_DECIMALS = 15;

export const readDecimals = (stored: unknown): number | undefined =>
  typeof stored === "number" && Number.isInteger(stored) && stored >= 0 && stored <= MAX_DECIMALS
    ? stored
    : undefined;

/** What comes back after a reload: the number on the display, not the sum it was part of. */
export interface SavedCalculator {
  value: number;
  memory: number;
  /** The Programmer layout's number, in decimal digits, which a JSON number would round. */
  programmer?: string;
  base?: ProgrammerBase;
}

export function readSaved(stored: unknown): SavedCalculator | undefined {
  const { value, memory, programmer, base } = (stored ?? {}) as Partial<SavedCalculator>;
  if (!Number.isFinite(value) || !Number.isFinite(memory)) return undefined;
  const fits = typeof programmer === "string" && parseProgrammer(programmer, 10) !== null;
  return {
    value: value as number,
    memory: memory as number,
    ...(fits && /^\d+$/.test(programmer) ? { programmer } : {}),
    ...(base === 8 || base === 10 || base === 16 ? { base } : {}),
  };
}

export { readBoolean };

/** One of Calculator's settings: a desktop value when served, else the window's own state. */
export function useCalculatorSetting<T>(
  key: string,
  read: (stored: unknown) => T | undefined,
  fallback: T,
): [T, (next: T) => void] {
  const stored = useDesktopSetting(key, read, fallback);
  const local = useState(fallback);
  return servedByDesktopApp() ? stored : local;
}

export interface DisplayOptions {
  separators: boolean;
  decimals: number;
}

const withSeparators = (text: string) =>
  text.replace(
    /^(-?)(\d+)/,
    (_, sign: string, digits: string) => `${sign}${digits.replace(/\B(?=(\d{3})+$)/g, ",")}`,
  );

/**
 * The text the display shows: a result rounded to the decimal places (trailing zeros dropped, as
 * the display always writes a result), and thousands separators on anything but an exponent. A
 * number being typed stays as typed.
 */
export function shownText(
  state: CalculatorState,
  { separators, decimals }: DisplayOptions,
): string {
  const text =
    state.entry === null && decimals < MAX_DECIMALS && Number.isFinite(state.value)
      ? formatNumber(Number(state.value.toFixed(decimals)))
      : displayText(state);
  return separators && !/e/i.test(text) ? withSeparators(text) : text;
}

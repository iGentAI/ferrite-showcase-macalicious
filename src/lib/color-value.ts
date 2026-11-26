import { createContext, use, useState } from "react";
import { useControlled } from "./use-controlled";

// Colour values for the colour pickers (colour wheel, colour panel). A colour is exchanged as a
// CSS hex string, `#rrggbb` or `#rrggbbaa`, and held as hue, saturation, brightness and opacity
// while it is edited, so that the hue survives a trip through black or grey.

/** Hue in degrees (0 to 360), then saturation, brightness and opacity, each 0 to 1. */
export type Hsva = readonly [h: number, s: number, v: number, a: number];

const byte = (n: number) =>
  Math.round(Math.min(1, Math.max(0, n)) * 255)
    .toString(16)
    .padStart(2, "0");

/** Hue, saturation and brightness to red, green and blue, each 0 to 1. */
export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

/** Red, green and blue, each 0 to 1, to hue (degrees), saturation and brightness. */
export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const v = Math.max(r, g, b);
  const d = v - Math.min(r, g, b);
  const h =
    d === 0 ? 0 : v === r ? ((g - b) / d + 6) % 6 : v === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, v === 0 ? 0 : d / v, v];
}

/** `#rrggbb` or `#rrggbbaa` (the `#` is optional) to a colour; anything else is opaque black. */
export function hexToHsva(hex: string): Hsva {
  const match = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex.trim());
  const n = match ? Number.parseInt(match[1] as string, 16) : 0;
  const a = match?.[2] ? Number.parseInt(match[2], 16) / 255 : 1;
  return [...rgbToHsv((n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255), a];
}

/** A colour to `#rrggbb`, or to `#rrggbbaa` when it is not opaque. Lower case. */
export function hsvaToHex([h, s, v, a]: Hsva): string {
  return `#${hsvToRgb(h, s, v).map(byte).join("")}${a < 1 ? byte(a) : ""}`;
}

/** A colour being edited and its setter. */
export type ColorState = readonly [Hsva, (color: Hsva) => void];

/**
 * The colour a Colors panel shares with the picker it shows, so that the hue survives a
 * change of picker as well: hex cannot carry it through black.
 */
export const ColorContext = createContext<ColorState | null>(null);

/**
 * A colour as state: `value` controls it, `defaultValue` only starts it, and `onValueChange`
 * hears every new hex value. Returns the colour being edited and its setter. The colour keeps
 * the hue and saturation the user chose while the hex value cannot express them (black has no
 * hue); a value set from outside replaces it.
 */
export function useColorState(
  value: string | undefined,
  defaultValue: string,
  onValueChange?: (value: string) => void,
): ColorState {
  const [hex, setHex] = useControlled(value, defaultValue, onValueChange);
  const [held, setHeld] = useState(() => hexToHsva(hex));
  const given = hexToHsva(hex);
  const current = hsvaToHex(given);
  // A value that is not the colour held came from outside (or the owner did not take an edit):
  // it replaces the colour, and with it the hue that was remembered. An owner that takes an
  // edit in the same update, as React state does, never shows up here.
  const replaced = hsvaToHex(held) !== current;
  if (replaced) setHeld(given);
  return [
    replaced ? given : held,
    (color) => {
      setHeld(color);
      const next = hsvaToHex(color);
      if (next !== current) setHex(next);
    },
  ];
}

/**
 * The state of a colour picker: its own (`useColorState`), or, for a picker without a `value`
 * that a Colors panel shows, the colour the panel shares with it.
 */
export function useColorValue(
  value: string | undefined,
  defaultValue: string,
  onValueChange?: (value: string) => void,
): ColorState {
  const own = useColorState(value, defaultValue, onValueChange);
  const shared = use(ColorContext);
  return value === undefined && shared ? shared : own;
}

import { useEffect, useRef, useState } from "react";
import { keepText, useKeptTextValue } from "./desktop-kept-text";
import { changeDesktopValue, useDesktopValue } from "./desktop-personal";
import { servedByDesktopApp } from "./desktop-server";

/*
 * What an application keeps of how its window was left among the person's desktop values, which
 * survive a reload and follow them from browser to browser: served by the desktop only. Each change
 * goes to the values at once: the settings' store sends the latest when it can, and a page that
 * leaves first hands it on to the next one.
 */

const MAX_VALUE_BYTES = 4000;

/** Whether `value` fits in one desktop value. */
export const fitsDesktopValue = (value: unknown): boolean =>
  new TextEncoder().encode(JSON.stringify(value)).length <= MAX_VALUE_BYTES;

export const readShown = (stored: unknown): boolean | undefined =>
  typeof stored === "boolean" ? stored : undefined;
export const readSize = (stored: unknown): number | undefined =>
  typeof stored === "number" && Number.isFinite(stored) ? stored : undefined;
export const readString = (stored: unknown): string | undefined =>
  typeof stored === "string" ? stored : undefined;

/**
 * `useState`, whose value is kept under `key` when the desktop serves the window. What is stored
 * takes the value's place when it arrives, unless the person changed it first.
 */
export function useKeptValue<T>(
  key: string,
  read: (stored: unknown) => T | undefined,
  initial: T,
): [T, (next: T) => void] {
  const [value, setValue] = useState(initial);
  const stored = useDesktopValue<T | undefined>(key, read, undefined);
  const changed = useRef(false);
  useEffect(() => {
    if (stored !== undefined && !changed.current && servedByDesktopApp()) setValue(stored);
  }, [stored]);
  const set = (next: T) => {
    changed.current = true;
    setValue(next);
    if (servedByDesktopApp() && fitsDesktopValue(next)) changeDesktopValue(key, next);
  };
  return [value, set];
}

/**
 * `useKeptValue` for a text the person writes, which may be larger than one value holds. Its third
 * value says the text now is too long to keep.
 */
export function useKeptText(
  key: string,
  initial: string,
): [string, (next: string) => void, boolean] {
  const [value, setValue] = useState(initial);
  const [tooLong, setTooLong] = useState(false);
  const stored = useKeptTextValue(key);
  const changed = useRef(false);
  useEffect(() => {
    if (stored !== undefined && !changed.current && servedByDesktopApp()) setValue(stored);
  }, [stored]);
  const set = (next: string) => {
    changed.current = true;
    setValue(next);
    if (servedByDesktopApp()) setTooLong(!keepText(key, next));
  };
  return [value, set, tooLong];
}

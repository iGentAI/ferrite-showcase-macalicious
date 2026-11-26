import type { FontFamily } from "macalicious/lib/font-families";
import { useSyncExternalStore } from "react";

/**
 * What the computer's font manager changes in every Fonts panel on the desktop, whatever `families`
 * each app gives it: the families added to the computer, and the names of those turned off.
 */
export interface FontPanelFonts {
  added: readonly FontFamily[];
  hidden: readonly string[];
}

const NONE: FontPanelFonts = { added: [], hidden: [] };
let fonts = NONE;
let refresh: (() => void) | null = null;
const listeners = new Set<() => void>();

/** Sets what every Fonts panel on the desktop adds and leaves out. */
export function setFontPanelFonts(next: FontPanelFonts): void {
  fonts = next;
  for (const listener of listeners) listener();
}

/**
 * Names what reads the fonts again: a panel asks each time it opens, so that it lists what changed
 * since. Answers the cleanup.
 */
export function provideFontPanelFonts(read: () => void): () => void {
  refresh = read;
  return () => {
    if (refresh === read) refresh = null;
    setFontPanelFonts(NONE);
  };
}

export const refreshFontPanelFonts = () => refresh?.();

export function useFontPanelFonts(): FontPanelFonts {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => fonts,
    () => NONE,
  );
}

/**
 * `families` as the panel lists them: without those turned off, and with those added in their
 * alphabetical place. A first family that does not sort first (Notes' System Font) stays first.
 */
export function familiesWith(
  families: readonly FontFamily[],
  { added, hidden }: FontPanelFonts,
): readonly FontFamily[] {
  if (added.length === 0 && hidden.length === 0) return families;
  const kept = families.filter((each) => !hidden.includes(each.name));
  const names = new Set(kept.map((each) => each.name.toLowerCase()));
  const [first, second] = kept;
  const fixed = first && second && first.name.localeCompare(second.name) > 0 ? 1 : 0;
  return [
    ...kept.slice(0, fixed),
    ...[
      ...kept.slice(fixed),
      ...added.filter((each) => !hidden.includes(each.name) && !names.has(each.name.toLowerCase())),
    ].sort((a, b) => a.name.localeCompare(b.name)),
  ];
}

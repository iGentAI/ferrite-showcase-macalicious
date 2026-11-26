import { STICKIES_COLORS, type StickiesColor } from "./stickies-data";

/*
 * What Stickies keeps per person beside its notes, among the person's desktop values
 * (`useDesktopSetting`), which survive a reload: Window > Use as Default, and the notes that float.
 * The server's notes hold neither.
 */

export const STICKIES_SETTINGS = {
  defaults: "stickies.defaults",
  floating: "stickies.floating",
  spelling: "stickies.spellingWhileTyping",
  times: "stickies.times",
  pageSetup: "stickies.pageSetup",
} as const;

/** When a note was made and last changed, in ms. The server keeps neither: these are the person's. */
export interface StickiesTimes {
  /** Absent on a note made before these were kept. */
  created?: number;
  modified?: number;
}

export const NO_TIMES: Readonly<Record<string, StickiesTimes>> = {};

const validTime = (time: unknown) =>
  typeof time === "number" && Number.isFinite(time) ? time : undefined;

export function readStickiesTimes(
  stored: unknown,
): Readonly<Record<string, StickiesTimes>> | undefined {
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return undefined;
  return Object.fromEntries(
    Object.entries(stored).map(([id, times]) => {
      const { created, modified } = (times ?? {}) as Record<string, unknown>;
      return [id, { created: validTime(created), modified: validTime(modified) }];
    }),
  );
}

const moment = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/** The tooltip of a note's text, as Stickies shows its dates; nothing when none is known. */
export function timesTooltip({ created, modified }: StickiesTimes = {}): string | undefined {
  const lines = [
    created === undefined ? null : `Created: ${moment(created)}`,
    modified === undefined ? null : `Modified: ${moment(modified)}`,
  ].filter((line) => line !== null);
  return lines.length > 0 ? lines.join("\n") : undefined;
}

/** What a new note starts with: Window > Use as Default. */
export interface StickiesDefaults {
  color: StickiesColor;
  /** The font of the first text typed in an empty note, when one was made the default. */
  family?: string;
  size?: number;
}

export const NO_DEFAULTS: StickiesDefaults = { color: "yellow" };
/** The app's own notes bound this list: floating one never unfloats another. */
export const NOT_FLOATING: readonly string[] = [];

export const readSpellingWhileTyping = (stored: unknown): boolean | undefined =>
  typeof stored === "boolean" ? stored : undefined;

export function readStickiesDefaults(stored: unknown): StickiesDefaults | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { color, family, size } = stored as Record<string, unknown>;
  const known = STICKIES_COLORS.find(({ value }) => value === color)?.value;
  if (!known) return undefined;
  return {
    color: known,
    ...(typeof family === "string" ? { family } : null),
    ...(typeof size === "number" && Number.isFinite(size) && size > 0 ? { size } : null),
  };
}

export function readFloatingNotes(stored: unknown): readonly string[] | undefined {
  return Array.isArray(stored) && stored.every((id) => typeof id === "string")
    ? (stored as string[])
    : undefined;
}

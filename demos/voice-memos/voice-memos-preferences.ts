/*
 * Voice Memos' Preferences, as its module of the `macalicious-desktop` Ferrite application keeps them
 * for the person (`ferrite-apps/desktop/src/apps/voice_memos`). Every function is pure.
 */

export const VOICE_MEMOS_PREFERENCES_URL = "/api/voice-memos/preferences";

/** How a take is written: in the browser's compressed format, or as WAV. */
export type AudioQuality = "compressed" | "lossless";
/** When a deleted recording leaves the Trash for good. */
export type ClearDeleted = "immediately" | "day" | "week" | "month" | "never";

export interface VoiceMemosPreferences {
  audioQuality: AudioQuality;
  clearDeleted: ClearDeleted;
  /** New recordings are named after where the person is. */
  locationNaming?: boolean;
}

export const DEFAULT_PREFERENCES: VoiceMemosPreferences = {
  audioQuality: "compressed",
  clearDeleted: "month",
};

const DAY = 86_400_000;
const KEPT_FOR: Readonly<Record<Exclude<ClearDeleted, "never">, number>> = {
  immediately: 0,
  day: DAY,
  week: 7 * DAY,
  month: 30 * DAY,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The Preferences of a `GET` reply: the defaults before the person has saved any; `undefined` when
 * the reply is not one the window can read, so that it is never saved over.
 */
export function preferencesFromServer(reply: unknown): VoiceMemosPreferences | undefined {
  const stored = isRecord(reply) ? reply.preferences : undefined;
  if (stored === null) return DEFAULT_PREFERENCES;
  if (!isRecord(stored)) return undefined;
  const { audioQuality, clearDeleted, locationNaming } = stored;
  if (audioQuality !== "compressed" && audioQuality !== "lossless") return undefined;
  if (
    clearDeleted !== "never" &&
    (typeof clearDeleted !== "string" || !Object.hasOwn(KEPT_FOR, clearDeleted))
  ) {
    return undefined;
  }
  return {
    audioQuality,
    clearDeleted: clearDeleted as ClearDeleted,
    ...(locationNaming === true ? { locationNaming } : {}),
  };
}

/** The `PUT` body. */
export const preferencesToServer = (preferences: VoiceMemosPreferences) => ({ preferences });

/** When a recording deleted at `deleted` leaves the drive; `null` when it never does. */
export const clearedAt = (clearDeleted: ClearDeleted, deleted: number): number | null =>
  clearDeleted === "never" ? null : deleted + KEPT_FOR[clearDeleted];

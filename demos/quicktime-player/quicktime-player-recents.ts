/*
 * QuickTime Player's recent movies, as its module of the `macalicious-desktop` Ferrite
 * application keeps them for the person (`ferrite-apps/desktop/src/apps/quicktime_player`): which
 * drive files were opened, when, and where the person stopped in each. Every function is pure.
 */

import { type DocumentMerge, mergeDocuments } from "../desktop/document-merge";

export const QUICKTIME_RECENTS_URL = "/api/quicktime-player/recents";

/** One recent movie: a file of the person's drive. */
export interface QuickTimeRecent {
  /** The drive's id of the file. */
  file: string;
  /** Its name when it was opened. */
  name: string;
  /** When it was last opened, in epoch milliseconds. */
  at: number;
  /** Where the person stopped, in whole seconds. */
  position: number;
}

/** The limits the server holds the list to. */
export const RECENTS_LIMITS = { recents: 20, name: 255, position: 604_800 } as const;
/** While a movie plays its place is kept to this many seconds: one save per step. */
export const RECENT_POSITION_STEP = 10;
/** A movie this close to its end counts as watched: it opens at its start again. */
export const RECENT_FINISHED_WITHIN = 5;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isRecent = (value: unknown): value is QuickTimeRecent =>
  isRecord(value) &&
  typeof value.file === "string" &&
  typeof value.name === "string" &&
  typeof value.at === "number" &&
  typeof value.position === "number" &&
  Number.isInteger(value.position) &&
  value.position >= 0;

/** Whether a `GET` reply is one the window can read: a list, or `null` before the first save. */
export function recentsReadable(reply: unknown): boolean {
  const recents = isRecord(reply) ? reply.recents : undefined;
  return recents === null || (Array.isArray(recents) && recents.every(isRecent));
}

/** The list of a `GET` reply; empty when the person has none yet. */
export function recentsFromServer(reply: unknown): QuickTimeRecent[] | undefined {
  if (!recentsReadable(reply)) return undefined;
  return (reply as { recents: QuickTimeRecent[] | null }).recents ?? [];
}

/** The `PUT` body. */
export function recentsToServer(recents: readonly QuickTimeRecent[]) {
  return {
    recents: recents.map(({ file, name, at, position }) => ({
      file,
      name,
      at: Math.max(0, Math.floor(at)),
      position,
    })),
  };
}

/**
 * How a change of the recents meets a newer list saved elsewhere: a movie is named by its drive
 * file, and the merged list is newest first and no longer than the server keeps, so that two
 * browsers each opening a movie never make a list the server refuses.
 */
export const mergeRecents: DocumentMerge = (base, mine, theirs) => {
  const merged = mergeDocuments(base, mine, theirs, { keys: ["file"] }) as { recents?: unknown };
  if (!Array.isArray(merged.recents)) return merged;
  const recents = [...(merged.recents as QuickTimeRecent[])]
    .sort((a, b) => b.at - a.at)
    .slice(0, RECENTS_LIMITS.recents);
  return { ...merged, recents };
};

/** A name as the server keeps it: no control characters, at most the limit. */
const keptName = (name: string) => {
  const plain = [...name]
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code >= 0x20 && !(code >= 0x7f && code <= 0x9f);
    })
    .slice(0, RECENTS_LIMITS.name)
    .join("")
    .trim();
  return plain || "Untitled Movie";
};

/** The list with `file` opened at `at`: first, once, keeping its place. */
export function remember(
  recents: readonly QuickTimeRecent[],
  file: string,
  name: string,
  at: number,
): QuickTimeRecent[] {
  const previous = recents.find((recent) => recent.file === file);
  return [
    { file, name: keptName(name), at, position: previous?.position ?? 0 },
    ...recents.filter((recent) => recent.file !== file),
  ].slice(0, RECENTS_LIMITS.recents);
}

/**
 * The list with the place in `file` kept: whole seconds, rounded down to the step while it plays,
 * exact when it is paused, and back to the start near the end.
 */
export function placedIn(
  recents: readonly QuickTimeRecent[],
  file: string,
  seconds: number,
  duration: number,
  playing: boolean,
): readonly QuickTimeRecent[] {
  const whole = Math.min(RECENTS_LIMITS.position, Math.max(0, Math.floor(seconds)));
  const done = duration > 0 && seconds >= duration - RECENT_FINISHED_WITHIN;
  const position = done ? 0 : playing ? whole - (whole % RECENT_POSITION_STEP) : whole;
  const at = recents.findIndex((recent) => recent.file === file);
  if (at < 0 || recents[at]?.position === position) return recents;
  const next = [...recents];
  next[at] = { ...(recents[at] as QuickTimeRecent), position };
  return next;
}

/** The desktop setting that keeps the movie's volume, 0 to 1. */
export const QUICKTIME_VOLUME_KEY = "quicktime-player.volume";
/** The desktop setting that keeps the drive file each window shows, by the window's id. */
export const QUICKTIME_OPEN_KEY = "quicktime-player.openMovies";

/** A kept volume; `undefined` when it is not one. */
export const readVolume = (stored: unknown): number | undefined =>
  typeof stored === "number" && stored >= 0 && stored <= 1 ? stored : undefined;

/** A file a window shows. */
export interface QuickTimeOpenMovie {
  id: string;
  name: string;
}

const isOpenMovie = (value: unknown): value is QuickTimeOpenMovie =>
  isRecord(value) && typeof value.id === "string" && typeof value.name === "string";

/** The kept files by window, without what is not one. */
export function readOpenMovies(stored: unknown): Record<string, QuickTimeOpenMovie> {
  if (!isRecord(stored)) return {};
  return Object.fromEntries(
    Object.entries(stored).filter(([, movie]) => isOpenMovie(movie)),
  ) as Record<string, QuickTimeOpenMovie>;
}

/** The kept files with `window` showing `movie`, or nothing with `null`. */
export function withOpenMovie(
  stored: unknown,
  window: string,
  movie: QuickTimeOpenMovie | null,
): Record<string, QuickTimeOpenMovie> {
  const { [window]: _left, ...others } = readOpenMovies(stored);
  return movie ? { ...others, [window]: movie } : others;
}

/** Whether a file is a movie the browser may play, by its type or its name. */
export function isMovie(file: { name: string; type?: string }): boolean {
  return (
    (file.type ?? "").startsWith("video/") || /\.(mp4|m4v|mov|webm|ogv|ogg|mkv)$/i.test(file.name)
  );
}

/** What the window plays from Finder: a movie, or sound, which a movie window plays with no picture. */
export function opensInQuickTime(file: { name: string; type?: string }): boolean {
  return (
    isMovie(file) ||
    (file.type ?? "").startsWith("audio/") ||
    /\.(mp3|m4a|aac|wav|aiff?|flac|opus)$/i.test(file.name)
  );
}

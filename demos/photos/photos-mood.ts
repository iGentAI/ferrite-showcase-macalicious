/*
 * The Mood of a memory's movie, named as Photos names them. Real Photos picks Apple's tracks and its
 * own cuts for a mood. Here a mood sets how long each picture shows and how one leads to the next,
 * and names a song of the person's Music library, so a mood with several songs to choose from sounds
 * different from another.
 */

export const MEMORY_MOODS = [
  "Dreamy",
  "Sentimental",
  "Gentle",
  "Chill",
  "Uplifting",
  "Happy",
  "Epic",
  "Club",
  "Extreme",
] as const;
export type MemoryMood = (typeof MEMORY_MOODS)[number];

export const DEFAULT_MEMORY_MOOD: MemoryMood = "Gentle";

/** Where the person's chosen moods are kept among the desktop's values, by memory id. */
export const MEMORY_MOODS_KEY = "photos.memoryMoods";
/** The most moods kept: the rest of the memories are Gentle. A value holds about 4 KB. */
const MOST_KEPT = 40;

const MOVIES: Record<MemoryMood, { seconds: number; theme: string }> = {
  Dreamy: { seconds: 5, theme: "dissolve" },
  Sentimental: { seconds: 4, theme: "dissolve" },
  Gentle: { seconds: 3, theme: "ken-burns" },
  Chill: { seconds: 3, theme: "dissolve" },
  Uplifting: { seconds: 2.5, theme: "ken-burns" },
  Happy: { seconds: 2, theme: "ken-burns" },
  Epic: { seconds: 2, theme: "dissolve" },
  Club: { seconds: 1.5, theme: "cut" },
  Extreme: { seconds: 1, theme: "cut" },
};

export const memoryMovieOf = (mood: MemoryMood) => MOVIES[mood];

/** The song a mood names among `songs`: Gentle the first, the others each one along from it. */
export function songOfMood<Song>(mood: MemoryMood, songs: readonly Song[]): Song | undefined {
  if (songs.length === 0) return undefined;
  const along = MEMORY_MOODS.indexOf(mood) - MEMORY_MOODS.indexOf(DEFAULT_MEMORY_MOOD);
  return songs[((along % songs.length) + songs.length) % songs.length];
}

const isMood = (value: unknown): value is MemoryMood => MEMORY_MOODS.includes(value as MemoryMood);

/** The kept moods as stored, leaving out anything that is not one. */
export function readMemoryMoods(stored: unknown): Readonly<Record<string, MemoryMood>> | undefined {
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return undefined;
  return Object.fromEntries(
    Object.entries(stored).filter((entry): entry is [string, MemoryMood] => isMood(entry[1])),
  );
}

/** The kept moods with `mood` chosen for `id`: the latest last, the oldest let go past the limit. */
export function withMemoryMood(
  kept: Readonly<Record<string, MemoryMood>>,
  id: string,
  mood: MemoryMood,
): Record<string, MemoryMood> {
  const { [id]: _replaced, ...others } = kept;
  const next = mood === DEFAULT_MEMORY_MOOD ? others : { ...others, [id]: mood };
  return Object.fromEntries(Object.entries(next).slice(-MOST_KEPT));
}

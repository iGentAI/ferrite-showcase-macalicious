import { type DictionaryEntry, type DictionarySource, SOURCES } from "./dictionary-data";

/*
 * What Dictionary's Preferences and its windows share among the person's desktop values: the text
 * size, and which sources are shown in what order.
 */

/** The text sizes of the two "A" buttons, as factors of the captured size; the third is it. */
export const TEXT_SIZES = [0.8, 0.9, 1, 1.15, 1.3, 1.5];
export const TEXT_SIZE_NAMES = ["Smallest", "Small", "Standard", "Large", "Larger", "Largest"];
export const DEFAULT_TEXT_SIZE = 2;
export const TEXT_SIZE_KEY = "dictionary.textSize";

export const readTextSize = (stored: unknown) =>
  typeof stored === "number" && Number.isInteger(stored) && TEXT_SIZES[stored] !== undefined
    ? stored
    : undefined;

/** The sources in the order the person put them, and those turned off. */
export interface SourcesSetting {
  order: readonly DictionarySource[];
  off: readonly DictionarySource[];
}

export const SOURCES_KEY = "dictionary.sources";
export const DEFAULT_SOURCES: SourcesSetting = {
  order: SOURCES.map((source) => source.id),
  off: [],
};

const sourceIds = (stored: unknown): DictionarySource[] =>
  Array.isArray(stored) ? DEFAULT_SOURCES.order.filter((id) => stored.includes(id)) : [];

const inTheirOrder = (stored: unknown): DictionarySource[] =>
  Array.isArray(stored)
    ? [...new Set(stored)].filter((id) => DEFAULT_SOURCES.order.includes(id))
    : [];

/** The setting as stored, with a source it does not name at the end of the order. */
export function readSources(stored: unknown): SourcesSetting | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { order, off } = stored as { order?: unknown; off?: unknown };
  const named = inTheirOrder(order);
  return {
    order: [...named, ...DEFAULT_SOURCES.order.filter((id) => !named.includes(id))],
    off: sourceIds(off),
  };
}

/** The accents Preferences offers, by the code a recording's file name ends in. */
export const ACCENTS = [
  { id: "us", title: "US English" },
  { id: "uk", title: "British English" },
] as const;
export type DictionaryAccent = (typeof ACCENTS)[number]["id"];
export const ACCENT_KEY = "dictionary.pronunciation";
export const DEFAULT_ACCENT: DictionaryAccent = "us";
export const readAccent = (stored: unknown) => ACCENTS.find((accent) => accent.id === stored)?.id;

/** The entry as this accent says it, or as its source does when it has no such accent. */
export function inAccent<T extends DictionaryEntry>(entry: T, accent: DictionaryAccent): T {
  const said = entry.dictionary?.accents?.[accent];
  if (!said || !entry.dictionary) return entry;
  return {
    ...entry,
    dictionary: {
      ...entry.dictionary,
      ...(said.pronunciation ? { pronunciation: said.pronunciation } : undefined),
      ...(said.audio ? { audio: said.audio } : undefined),
    },
  };
}

/** The sources the setting shows, in its order. */
export const shownSources = (setting: SourcesSetting) =>
  setting.order
    .filter((id) => !setting.off.includes(id))
    .flatMap((id) => SOURCES.filter((source) => source.id === id));

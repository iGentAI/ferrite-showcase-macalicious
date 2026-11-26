import type { LibrarySong, SmartPlaylist, SmartRule } from "./music-server";

export type { SmartPlaylist, SmartRule };

export type SmartField = SmartRule["field"];
type Kind = "text" | "number" | "flag" | "date";

export const SMART_FIELDS: readonly { field: SmartField; label: string; kind: Kind }[] = [
  { field: "title", label: "Song", kind: "text" },
  { field: "artist", label: "Artist", kind: "text" },
  { field: "album", label: "Album", kind: "text" },
  { field: "genre", label: "Genre", kind: "text" },
  { field: "year", label: "Year", kind: "number" },
  { field: "plays", label: "Plays", kind: "number" },
  { field: "loved", label: "Loved", kind: "flag" },
  { field: "added", label: "Date Added", kind: "date" },
];

export const SMART_OPS: Record<Kind, readonly { op: SmartRule["op"]; label: string }[]> = {
  text: [
    { op: "contains", label: "contains" },
    { op: "not-contains", label: "does not contain" },
    { op: "is", label: "is" },
    { op: "is-not", label: "is not" },
    { op: "starts", label: "begins with" },
    { op: "ends", label: "ends with" },
  ],
  number: [
    { op: "is", label: "is" },
    { op: "is-not", label: "is not" },
    { op: "greater", label: "is greater than" },
    { op: "less", label: "is less than" },
  ],
  flag: [
    { op: "is", label: "is true" },
    { op: "is-not", label: "is false" },
  ],
  date: [
    { op: "in-last", label: "is in the last (days)" },
    { op: "not-in-last", label: "is not in the last (days)" },
  ],
};

export const smartKind = (field: SmartField): Kind =>
  SMART_FIELDS.find((one) => one.field === field)?.kind ?? "text";

const DAY = 86_400_000;

/** What a smart playlist's rules read beyond the song itself. */
export interface SmartFacts {
  plays: Readonly<Record<string, number>>;
  loved: ReadonlySet<string>;
  now: number;
}

export function ruleMatches(rule: SmartRule, song: LibrarySong, facts: SmartFacts): boolean {
  const typed = Number(rule.value);
  switch (rule.field) {
    case "loved": {
      const loved = facts.loved.has(song.id);
      return rule.op === "is" ? loved : !loved;
    }
    case "added": {
      const within = song.added >= facts.now - typed * DAY;
      return rule.op === "in-last" ? within : !within;
    }
    case "year":
    case "plays": {
      const value = rule.field === "year" ? song.year : (facts.plays[song.id] ?? 0);
      if (value === null) return rule.op === "is-not";
      if (rule.op === "is") return value === typed;
      if (rule.op === "is-not") return value !== typed;
      return rule.op === "greater" ? value > typed : value < typed;
    }
    default: {
      const text = song[rule.field].toLocaleLowerCase();
      const wanted = rule.value.toLocaleLowerCase();
      if (rule.op === "contains") return text.includes(wanted);
      if (rule.op === "not-contains") return !text.includes(wanted);
      if (rule.op === "is") return text === wanted;
      if (rule.op === "is-not") return text !== wanted;
      return rule.op === "starts" ? text.startsWith(wanted) : text.endsWith(wanted);
    }
  }
}

/** The songs a smart playlist holds now; a limit keeps the most recently added. */
export function smartSongs(
  smart: SmartPlaylist,
  songs: readonly LibrarySong[],
  facts: SmartFacts,
): LibrarySong[] {
  const matching = songs.filter((song) =>
    smart.all
      ? smart.rules.every((rule) => ruleMatches(rule, song, facts))
      : smart.rules.some((rule) => ruleMatches(rule, song, facts)),
  );
  if (!smart.limit) return matching;
  const kept = new Set(
    [...matching]
      .sort((a, b) => b.added - a.added)
      .slice(0, smart.limit)
      .map((song) => song.id),
  );
  return matching.filter((song) => kept.has(song.id));
}

/** Why a rule cannot be kept as typed, or `null`. */
export function ruleProblem(rule: SmartRule): string | null {
  const kind = smartKind(rule.field);
  if (kind === "flag") return null;
  if (rule.value.trim() === "") return "Every rule needs a value.";
  if (kind === "text") return null;
  return /^\d{1,6}$/.test(rule.value.trim()) ? null : "Year, Plays and days are whole numbers.";
}

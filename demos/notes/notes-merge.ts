import { sameDocument } from "../desktop/document-merge";

/*
 * How a page's unsaved changes to a list of records meet a stored list that another window or
 * browser changed meanwhile: the merge Notes and Stickies give their synced documents
 * (`demos/desktop/synced-document.ts`, its `merge` option). Nothing here is fetched or kept, so
 * any demo may import it without loading Notes' data.
 */

/** A record both sides changed in the same fields, to different values. */
export interface RecordConflict<T> {
  id: string;
  /** The page's version of the record. */
  mine: T;
  /** The stored version, the change saved first. */
  theirs: T;
  /** The fields both sides changed to different values. */
  fields: string[];
}

/** How `mergeRecordsById` merges a record both sides changed, and orders the result. */
export interface RecordMergeOptions<T> {
  /**
   * Fields that go together, merged as one (a note's lines, formats and dates). Any other field
   * is merged on its own.
   */
  together?: readonly (readonly string[])[];
  /**
   * Put the records the page added or changed first, in its order (Notes lists the newest
   * first); otherwise the stored order is kept, with the page's new records after it.
   * @default false
   */
  mineFirst?: boolean;
  /**
   * The version a group both sides changed to different values keeps: the page's (`"mine"`) or
   * the stored one, the change saved first (`"theirs"`).
   * @default "mine"
   */
  prefer?: "mine" | "theirs";
  /** Called for each record both sides changed in the same fields, to different values. */
  onConflict?: (conflict: RecordConflict<T>) => void;
}

/**
 * Records named by `id`, merged as a page's unsaved changes (`mine`, made on `base`) meet a stored
 * list that moved on (`theirs`). A record only one side changed takes that side's version, and a
 * removal on either side wins, as in `document-merge.ts`. A record both sides changed is merged by
 * its groups of fields (`together`): a group only one side changed takes that side's, and a group
 * both changed to different values takes the side `prefer` names and is reported (`onConflict`).
 */
export function mergeRecordsById<T extends { id: string }>(
  base: readonly T[],
  mine: readonly T[],
  theirs: readonly T[],
  { together = [], mineFirst = false, prefer = "mine", onConflict }: RecordMergeOptions<T> = {},
): T[] {
  const was = new Map(base.map((record) => [record.id, record]));
  const ours = new Map(mine.map((record) => [record.id, record]));
  const now = new Map(theirs.map((record) => [record.id, record]));
  const pick = (id: string): T | undefined => {
    const before = was.get(id);
    const here = ours.get(id);
    const there = now.get(id);
    if (sameDocument(here ?? null, before ?? null)) return there;
    if (sameDocument(there ?? null, before ?? null)) return here;
    if (here === undefined || there === undefined) return undefined;
    if (before === undefined) {
      // Added on both sides under one id: one record, as if made from nothing.
      const merged = mergeFields({} as T, here, there, together, prefer);
      if (merged.fields.length > 0) onConflict?.({ id, mine: here, theirs: there, ...merged });
      return merged.record;
    }
    const merged = mergeFields(before, here, there, together, prefer);
    if (merged.fields.length > 0) onConflict?.({ id, mine: here, theirs: there, ...merged });
    return merged.record;
  };
  const touched = mine
    .filter((record) => !sameDocument(record, was.get(record.id) ?? null))
    .map((record) => record.id);
  const order = mineFirst
    ? [...touched, ...theirs.map((record) => record.id), ...ours.keys()]
    : [...theirs.map((record) => record.id), ...ours.keys()];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const id of order) {
    if (seen.has(id)) continue;
    seen.add(id);
    const record = pick(id);
    if (record) out.push(record);
  }
  return out;
}

/**
 * A record both sides changed, merged group by group: a group of fields one side left as it was
 * takes the other side's; a group both changed to different values takes `prefer`'s, and its
 * fields are reported.
 */
function mergeFields<T extends object>(
  before: T,
  here: T,
  there: T,
  together: readonly (readonly string[])[],
  prefer: "mine" | "theirs",
): { record: T; fields: string[] } {
  const was = before as Record<string, unknown>;
  const ours = here as Record<string, unknown>;
  const now = there as Record<string, unknown>;
  const all = new Set([...Object.keys(was), ...Object.keys(ours), ...Object.keys(now)]);
  const groups = [
    ...together.map((group) => [...group]),
    ...[...all]
      .filter((field) => !together.some((group) => group.includes(field)))
      .map((field) => [field]),
  ];
  const out: Record<string, unknown> = {};
  const fields: string[] = [];
  for (const group of groups) {
    const of = (record: Record<string, unknown>) => group.map((field) => record[field] ?? null);
    const changedHere = !sameDocument(of(ours), of(was));
    const changedThere = !sameDocument(of(now), of(was));
    const differ = changedHere && changedThere && !sameDocument(of(ours), of(now));
    if (differ) fields.push(...group.filter((field) => field in ours || field in now));
    const from = !changedHere ? now : !changedThere ? ours : prefer === "theirs" ? now : ours;
    for (const field of group) if (from[field] !== undefined) out[field] = from[field];
  }
  return { record: out as T, fields };
}

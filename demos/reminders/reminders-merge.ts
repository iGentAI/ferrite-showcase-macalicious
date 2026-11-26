import type { Reminder, ReminderGroup, ReminderList } from "./reminders-data";
import { settleGroups, settleParents } from "./reminders-tree";

/*
 * Taking in a document of the person's own that a window did not make (another window's or
 * browser's change, or the stored reminders read again after the server refused a save for a
 * newer revision, a 409), without losing what the window changed and had not had stored. The
 * window's changes since the document it last took in (`base`) are made again on the incoming
 * one (`theirs`), item by item, an item being a list or a reminder known by its id:
 *
 * - a field the window changed takes the window's value; every other field the incoming one's;
 * - an item the window added is added, after the incoming items;
 * - an item removed on either side stays removed, whatever the other side did to it, so nothing
 *   removed elsewhere comes back from a window that had not seen it go;
 * - a reminder whose list is removed goes with it.
 */

/** The lists and reminders of one person's document. */
export interface RemindersDocument {
  lists: ReminderList[];
  /** The groups of lists; a document with none may leave this out. */
  groups?: ReminderGroup[];
  reminders: Reminder[];
}

/** Whether two values hold the same, field by field. */
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** `theirs` with the fields `now` changed since `was` taken from `now`. */
function mergeFields<T extends object>(was: T, now: T, theirs: T): T {
  const keys = new Set([...Object.keys(was), ...Object.keys(now), ...Object.keys(theirs)]);
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const field = key as keyof T;
    const value = same(now[field], was[field]) ? theirs[field] : now[field];
    if (value !== undefined) out[key] = value;
  }
  return out as T;
}

/**
 * `mine`'s changes since `base` made on `theirs`, by the rules above. Answers `theirs` itself (the
 * same array) when nothing of `mine` applies, so that taking it in is no change to save.
 */
export function mergeItems<T extends { id: string }>(
  base: readonly T[],
  mine: readonly T[],
  theirs: readonly T[],
): readonly T[] {
  const was = new Map(base.map((item) => [item.id, item]));
  const now = new Map(mine.map((item) => [item.id, item]));
  const there = new Set(theirs.map((item) => item.id));
  let touched = false;
  const out: T[] = [];
  for (const item of theirs) {
    const before = was.get(item.id);
    const here = now.get(item.id);
    if (before && !here) {
      // Removed here: it stays removed.
      touched = true;
      continue;
    }
    if (!before || !here || same(here, before)) {
      out.push(item);
      continue;
    }
    const merged = mergeFields(before, here, item);
    if (same(merged, item)) out.push(item);
    else {
      out.push(merged);
      touched = true;
    }
  }
  for (const item of mine) {
    // Already there, or removed there (it was in the base): neither is added again.
    if (there.has(item.id) || was.has(item.id)) continue;
    out.push(item);
    touched = true;
  }
  return touched ? out : theirs;
}

/**
 * The window's document after taking in `theirs`: its changes since `base` (as `mine` holds them)
 * made again on it. Lists and reminders that nothing of the window's changes are the incoming
 * ones themselves.
 */
export function mergeReminders(
  base: RemindersDocument,
  mine: RemindersDocument,
  theirs: RemindersDocument,
): {
  lists: readonly ReminderList[];
  groups: readonly ReminderGroup[];
  reminders: readonly Reminder[];
} {
  const groups = mergeItems(base.groups ?? [], mine.groups ?? [], theirs.groups ?? []);
  const lists = settleGroups(mergeItems(base.lists, mine.lists, theirs.lists), groups);
  const kept = new Set(lists.map((list) => list.id));
  const merged = mergeItems(base.reminders, mine.reminders, theirs.reminders);
  const reminders = settleParents(
    merged.every((reminder) => kept.has(reminder.listId))
      ? merged
      : merged.filter((reminder) => kept.has(reminder.listId)),
  );
  return { lists, groups, reminders };
}

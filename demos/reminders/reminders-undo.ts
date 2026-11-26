import type { Reminder, ReminderGroup, ReminderList } from "./reminders-data";
import { mergeItems } from "./reminders-merge";
import { isSharedKey } from "./reminders-shared";
import { settleGroups, settleParents } from "./reminders-tree";

/** What Undo goes back to: a window's lists, groups and reminders, shared lists' too. */
export interface RemindersState {
  lists: readonly ReminderList[];
  groups: readonly ReminderGroup[];
  reminders: readonly Reminder[];
}

/** One change that can be undone. `key` names the reminder a run of changes is made to. */
export interface UndoStep {
  before: RemindersState;
  after: RemindersState;
  key?: string;
}

export interface UndoHistory {
  past: readonly UndoStep[];
  future: readonly UndoStep[];
}

export const NO_HISTORY: UndoHistory = { past: [], future: [] };
const MAX_STEPS = 100;

/** Whether two states hold the same lists, groups and reminders, element by element. */
export function sameState(a: RemindersState, b: RemindersState): boolean {
  const same = <T>(one: readonly T[], other: readonly T[]) =>
    one === other || (one.length === other.length && one.every((each, at) => each === other[at]));
  return same(a.lists, b.lists) && same(a.groups, b.groups) && same(a.reminders, b.reminders);
}

/**
 * `history` with the change from `before` to `after` on it. Changes with the same `key` in a row
 * are one step (typing in a reminder's info popover), unless something came in from elsewhere between
 * them, and a change takes away what could be redone.
 */
export function recordChange(
  history: UndoHistory,
  before: RemindersState,
  after: RemindersState,
  key?: string,
): UndoHistory {
  const last = history.past.at(-1);
  if (key !== undefined && last?.key === key && sameState(last.after, before)) {
    return { past: [...history.past.slice(0, -1), { ...last, after }], future: [] };
  }
  return { past: [...history.past, { before, after, key }].slice(-MAX_STEPS), future: [] };
}

/**
 * The window's state with a step reversed (`from` is what the step left, `to` what it should now
 * be). Nothing else having happened, that is `to` itself, with the order it had; after a document
 * taken in from elsewhere, only what the step changed is changed back, on what is there now.
 */
export function travelTo(
  from: RemindersState,
  to: RemindersState,
  now: RemindersState,
): RemindersState {
  if (sameState(from, now)) return to;
  const groups = mergeItems(from.groups, to.groups, now.groups);
  const lists = settleGroups(mergeItems(from.lists, to.lists, now.lists), groups);
  const here = new Set(lists.map((list) => list.id));
  const reminders = settleParents(
    mergeItems(from.reminders, to.reminders, now.reminders).filter(
      (reminder) => isSharedKey(reminder.id) || here.has(reminder.listId),
    ),
  );
  return { lists, groups, reminders };
}

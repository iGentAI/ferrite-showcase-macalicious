import type { DraftStep } from "./automator-server";

/*
 * The steps of the served Automator as a person edits them: where a drag or a paste puts them, and
 * the history Undo and Redo walk. Everything returns a new list, or the same list when nothing
 * changes, so the window can tell an edit from none.
 */

type Steps = readonly DraftStep[];

/** `added` before the step now at `index`. */
export function insertedSteps(steps: Steps, added: Steps, index: number): DraftStep[] {
  return [...steps.slice(0, index), ...added, ...steps.slice(index)];
}

/** The steps `keys` names, in their order, before the step now at `index`. */
export function movedSteps(
  steps: DraftStep[],
  keys: readonly number[],
  index: number,
): DraftStep[] {
  const moving = (step: DraftStep) => keys.includes(step.key);
  const next = [
    ...steps.slice(0, index).filter((step) => !moving(step)),
    ...steps.filter(moving),
    ...steps.slice(index).filter((step) => !moving(step)),
  ];
  return next.every((step, at) => step === steps[at]) ? steps : next;
}

/** The longest history kept: the oldest edit is forgotten after this many. */
const MOST_UNDOS = 100;

/** The step lists Undo and Redo go back to, with what the latest edit was typing into. */
export interface StepsHistory {
  past: readonly DraftStep[][];
  future: readonly DraftStep[][];
  typing: string | null;
}

export const NO_HISTORY: StepsHistory = { past: [], future: [], typing: null };

/**
 * The history after an edit of `before`. Edits with the same `typing` (keystrokes in one setting)
 * count as one edit, so Undo takes the whole value back, until `endedTyping`.
 */
export function recorded(
  history: StepsHistory,
  before: DraftStep[],
  typing: string | null,
): StepsHistory {
  if (typing !== null && history.typing === typing) return { ...history, future: [] };
  return { past: [...history.past, before].slice(-MOST_UNDOS), future: [], typing };
}

/** The history once the keyboard has left a setting or the workflow was saved: the next edit is its own. */
export const endedTyping = (history: StepsHistory): StepsHistory =>
  history.typing === null ? history : { ...history, typing: null };

/** Undo: the history after it and the steps it brings back; `null` with nothing to undo. */
export function undone(history: StepsHistory, now: DraftStep[]) {
  const steps = history.past.at(-1);
  if (!steps) return null;
  return {
    steps,
    history: { past: history.past.slice(0, -1), future: [now, ...history.future], typing: null },
  };
}

/** Redo: the history after it and the steps it brings back; `null` with nothing to redo. */
export function redone(history: StepsHistory, now: DraftStep[]) {
  const steps = history.future[0];
  if (!steps) return null;
  return {
    steps,
    history: { past: [...history.past, now], future: history.future.slice(1), typing: null },
  };
}

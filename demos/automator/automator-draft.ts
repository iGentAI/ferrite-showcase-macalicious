import { useMemo } from "react";
import { useKeptTextValue } from "../desktop/desktop-kept-text";
import { useDesktopValue } from "../desktop/desktop-personal";
import type { DraftStep, WorkflowDraft } from "./automator-server";

/*
 * What Automator keeps of the window among the person's desktop values, which survive a reload and
 * follow them from browser to browser: the workflow it shows, and its changes while they are unsaved,
 * as a text that goes in pieces when it needs them (`desktop-kept-text.ts`).
 */

export const KEPT_WORKFLOW = "automator.draft";

/** A saved workflow with no changes, by its id; or a workflow with changes, and what it was without. */
export type KeptWorkflow =
  | { open: string }
  | {
      draft: Omit<WorkflowDraft, "steps"> & { steps: Omit<DraftStep, "key">[] };
      clean: string | null;
    };

export const keptChanges = (draft: WorkflowDraft, clean: string | null): KeptWorkflow => ({
  draft: { ...draft, steps: draft.steps.map(({ key: _key, ...step }) => step) },
  clean,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function readKeptWorkflow(stored: unknown): KeptWorkflow | undefined {
  if (!isRecord(stored)) return undefined;
  if (typeof stored.open === "string") return { open: stored.open };
  const { draft, clean } = stored;
  if (!isRecord(draft) || (clean !== null && typeof clean !== "string")) return undefined;
  if (
    typeof draft.id !== "string" ||
    typeof draft.name !== "string" ||
    typeof draft.kind !== "string" ||
    typeof draft.enabled !== "boolean" ||
    !Array.isArray(draft.steps) ||
    !draft.steps.every(
      (step) =>
        isRecord(step) &&
        typeof step.action === "string" &&
        isRecord(step.params) &&
        typeof step.enabled === "boolean",
    )
  ) {
    return undefined;
  }
  return stored as KeptWorkflow;
}

const parseKept = (text: string | undefined): KeptWorkflow | undefined => {
  if (text === undefined) return undefined;
  try {
    return readKeptWorkflow(JSON.parse(text));
  } catch {
    return undefined;
  }
};

/** What is kept now: as a text, or as the record a page before the text form wrote. */
export function useKeptWorkflow(): KeptWorkflow | null {
  const text = useKeptTextValue(KEPT_WORKFLOW);
  const record = useDesktopValue<KeptWorkflow | null>(KEPT_WORKFLOW, readKeptWorkflow, null);
  return useMemo(() => parseKept(text) ?? record, [text, record]);
}

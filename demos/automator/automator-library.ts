"use client";

import { useSyncExternalStore } from "react";
import { SERVER_CHANGE_EVENT } from "../desktop/desktop-live";
import { servedByDesktopApp } from "../desktop/desktop-server";
import {
  loadWorkflows,
  type QuickInput,
  type RunItem,
  type RunTrigger,
  type Workflow,
} from "./automator-server";

/*
 * The person's saved workflows as the rest of the desktop lists them, and how it starts one: Finder's
 * Quick Actions and the Services menu read them here. What runs a workflow is loaded on first use
 * (automator-background.ts holds every page step's dependencies).
 */

const NONE: readonly Workflow[] = [];
let workflows: readonly Workflow[] = NONE;
let listening = false;
const listeners = new Set<() => void>();

/** Reads the workflows again; a failed read keeps what the page had. */
export async function refreshSavedWorkflows(): Promise<readonly Workflow[]> {
  try {
    workflows = (await loadWorkflows()).library?.workflows ?? NONE;
    for (const listener of listeners) listener();
  } catch (error) {
    console.error(error);
  }
  return workflows;
}

/** Hears each new list of the workflows, reading them for the first time if no one has. Returns the unsubscribe. */
export function subscribeSavedWorkflows(listener: () => void): () => void {
  listeners.add(listener);
  if (!listening && servedByDesktopApp()) {
    listening = true;
    void refreshSavedWorkflows();
    window.addEventListener(SERVER_CHANGE_EVENT, (event) => {
      if ((event as CustomEvent<{ app?: string }>).detail?.app === "automator") {
        void refreshSavedWorkflows();
      }
    });
  }
  return () => listeners.delete(listener);
}

export const savedWorkflows = () => workflows;

/** The person's saved workflows, kept up to date; none outside the served desktop. */
export const useSavedWorkflows = (): readonly Workflow[] =>
  useSyncExternalStore(subscribeSavedWorkflows, savedWorkflows, () => NONE);

/** The Quick Actions that take this kind of selection, by name. */
export const quickActionsFor = (list: readonly Workflow[], receives: QuickInput): Workflow[] =>
  list
    .filter(
      (workflow) =>
        workflow.kind === "quick-action" &&
        workflow.enabled &&
        (workflow.receives ?? "files") === receives,
    )
    .sort((one, two) => one.name.localeCompare(two.name));

/** Runs a saved workflow on these items, and says in a notification how it went. */
export function runSavedWorkflow(
  workflow: Workflow,
  items: readonly RunItem[],
  trigger: RunTrigger,
): void {
  void import("./automator-background").then(({ runAndTell }) =>
    runAndTell(workflow, items, trigger),
  );
}

/** Runs the Quick Action on the drive items with these ids. */
export function runQuickActionOnFiles(workflow: Workflow, ids: readonly string[]): void {
  void import("./automator-background").then(({ runOnEntries }) => runOnEntries(workflow, ids));
}

/** Opens an Application's `.app` file from the drive: it runs, rather than opening for editing. */
export function runApplicationFile(file: { id: string; name: string }): void {
  void import("./automator-background").then(({ runFile }) => runFile(file));
}

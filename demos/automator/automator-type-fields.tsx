"use client";

import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import type { ReactNode } from "react";
import { childrenOf, type Drive, homeFolders, useDrive } from "../desktop/desktop-files";
import {
  fileNameOf,
  type QuickInput,
  type WorkflowDraft,
  type WorkflowKind,
} from "./automator-server";

/*
 * What a document type adds to the head of Automator's window: what a Quick Action receives, the folder
 * a Folder Action watches, and the sentence that says plainly when the type runs.
 */

const RECEIVES: readonly { value: QuickInput; label: string }[] = [
  { value: "files", label: "files or folders" },
  { value: "text", label: "text" },
  { value: "none", label: "no input" },
];

/** A visible label beside a control in the workflow's settings. */
export function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  // biome-ignore lint/a11y/noLabelWithoutControl: names the field through htmlFor; Label puts the text inside
  const element = htmlFor ? <label htmlFor={htmlFor} /> : undefined;
  return (
    <Label render={element} textStyle="small" className="mac-automator-field-label">
      {children}
    </Label>
  );
}

/** The sentence under the window's head for a type; `name` is the workflow's. */
export function typeNote(kind: WorkflowKind, name: string): string {
  switch (kind) {
    case "quick-action":
      return "A Quick Action is listed under Quick Actions in Finder's contextual menu and in the Services menu, and runs on what is selected there.";
    case "application":
      return `A web page cannot make a real application. File > Export… writes “${fileNameOf(name, kind)}” to your drive, and opening that file from Finder, the desktop or the Dock runs this workflow on this desktop.`;
    case "folder-action":
      return "A Folder Action runs when something arrives in its folder, and only while this desktop is open and signed in: the server has no event for it, and a page step needs a page.";
    case "calendar-alarm":
      return "Saving adds an event with an alert to Calendar: move the event to say when. The workflow runs when the alert shows, and only while this desktop is open: the server has no event for it, and a page step needs a page.";
    case "dictation-command":
      return `Say “${name}” to run this workflow. While one is saved and enabled, this desktop listens through your browser's speech recognition, and only while the page is open. The browser may send what it hears to its maker, and asks for the microphone the first time.`;
    default:
      return "Workflows run when you press Run, or one action at a time with Step, and Stop ends a stepped run.";
  }
}

/** The drive's folders outside the Trash, each with its path, in the order of the drive's tree. */
export function driveFolders(drive: Drive): { id: string; path: string }[] {
  const found: { id: string; path: string }[] = [];
  const walk = (parent: string | undefined, prefix: string) => {
    const list = parent === undefined ? homeFolders(drive) : childrenOf(drive, parent);
    for (const entry of list) {
      if (entry.kind !== "folder") continue;
      const path = `${prefix}${entry.name}`;
      found.push({ id: entry.id, path });
      walk(entry.id, `${path}/`);
    }
  };
  walk(undefined, "");
  return found;
}

function FolderField({ draft, edit }: TypeFieldsProps) {
  const drive = useDrive();
  const folders = drive ? driveFolders(drive) : [];
  return (
    <span className="mac-automator-field">
      <FieldLabel>Receives files added to:</FieldLabel>
      <PopUpButton<string>
        size="small"
        aria-label="Folder Action folder"
        value={draft.folder ?? ""}
        onValueChange={(folder) => edit({ folder: folder || undefined })}
      >
        <PopUpButtonItem value="">Choose a folder</PopUpButtonItem>
        {folders.map(({ id, path }) => (
          <PopUpButtonItem key={id} value={id}>
            {path}
          </PopUpButtonItem>
        ))}
      </PopUpButton>
    </span>
  );
}

interface TypeFieldsProps {
  draft: WorkflowDraft;
  edit: (change: Partial<WorkflowDraft>) => void;
}

/** The controls of the workflow's type, beside its Name and Type. */
export function TypeFields({ draft, edit }: TypeFieldsProps) {
  if (draft.kind === "folder-action") return <FolderField draft={draft} edit={edit} />;
  if (draft.kind !== "quick-action") return null;
  return (
    <span className="mac-automator-field">
      <FieldLabel>Workflow receives current:</FieldLabel>
      <PopUpButton<string>
        size="small"
        aria-label="Quick Action receives"
        value={draft.receives ?? "files"}
        onValueChange={(receives) => edit({ receives: receives as QuickInput })}
      >
        {RECEIVES.map(({ value, label }) => (
          <PopUpButtonItem key={value} value={value}>
            {label}
          </PopUpButtonItem>
        ))}
      </PopUpButton>
    </span>
  );
}

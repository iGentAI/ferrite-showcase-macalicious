import { useState } from "react";
import { readBoolean, readNumber, useDesktopSetting } from "../desktop/desktop-personal";
import type { NotesSort } from "./notes-data";
import { syncEnabled } from "./notes-sync";

/*
 * What Notes keeps of how it looks: the person's desktop values, which survive a reload, when the
 * desktop's Ferrite application serves it. Anywhere else (the documentation, the tests) each is
 * the window's own state and lasts as long as the window. The Preferences window changes the same
 * values, so the open window follows it.
 */

export const NOTES_SETTINGS = {
  view: "notes.view",
  sort: "notes.sort",
  foldersShown: "notes.foldersShown",
  noteCount: "notes.noteCount",
  sidebarWidth: "notes.sidebarWidth",
  listWidth: "notes.listWidth",
  folder: "notes.folder",
  note: "notes.note",
  zoom: "notes.zoom",
  newNoteStart: "notes.newNoteStart",
  spelling: "notes.spelling",
  attachmentView: "notes.attachmentView",
  onMyMac: "notes.onMyMac",
} as const;

export type NotesView = "list" | "gallery";
/** Preferences > New notes start with: the style of a new note's first line. */
export type NotesNewNoteStart = "title" | "heading" | "body";
/** View > Attachment View: how the pictures in a note are drawn. */
export type NotesAttachmentView = "large" | "small";

const oneOf =
  <T extends string>(...values: readonly T[]) =>
  (stored: unknown): T | undefined =>
    values.find((value) => value === stored);

export const readView = oneOf<NotesView>("list", "gallery");
export const readSort = oneOf<NotesSort>("edited", "created", "title");
export const readNewNoteStart = oneOf<NotesNewNoteStart>("title", "heading", "body");
export const readAttachmentView = oneOf<NotesAttachmentView>("large", "small");
export const readText = (stored: unknown): string | undefined =>
  typeof stored === "string" ? stored : undefined;
export { readBoolean, readNumber };

/** The smallest and largest size of a note's text, as a share of its usual size. */
export const MIN_ZOOM = 0.75;
export const MAX_ZOOM = 2;

/** One of Notes' settings: a desktop value when served, else the window's own state. */
export function useNotesSetting<T>(
  key: string,
  read: (stored: unknown) => T | undefined,
  fallback: T,
): [T, (next: T) => void] {
  const stored = useDesktopSetting(key, read, fallback);
  const local = useState(fallback);
  return syncEnabled() ? stored : local;
}

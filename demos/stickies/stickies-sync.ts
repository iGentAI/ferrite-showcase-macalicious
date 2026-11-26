import { useSyncExternalStore } from "react";
import { createSyncedDocument } from "../desktop/synced-document";
import { mergeRecordsById } from "../notes/notes-merge";
import { STICKIES_COLORS, type StickiesColor } from "./stickies-data";

/*
 * Stickies' link to its server half, `/api/stickies/` of the macalicious-desktop Ferrite
 * application (ferrite-apps/desktop/src/apps/stickies), through the shared synced document of
 * demos/desktop/synced-document.ts: the server owns the revision, a save names the revision it
 * is based on, and a conflict is merged rather than overwritten. Only the desktop build made for
 * that application sets `VITE_MACALICIOUS_API` to "1". Anywhere else (the documentation, the
 * tests, a copy of the demo) nothing is fetched, and the notes last as long as the page.
 */

/** A note as the server keeps it. */
export interface SavedStickiesNote {
  id: string;
  color: StickiesColor;
  /** The text, one `\n` per line break: the note's title, its search text and its length limit. */
  text: string;
  /**
   * The text with its formats, as the note's editor wrote it and `richTextFromHtml` keeps it.
   * Shown in place of `text` when it reads as the same text; a note saved before formats were
   * kept has none.
   */
  html?: string;
  /** Where the note stands and how large, in points; kept as it is when the text changes. */
  frame?: { x: number; y: number; width: number; height: number };
  /** Collapsed to its title bar. */
  collapsed?: boolean;
  /** See-through. */
  translucent?: boolean;
}

/** What the server keeps for a browser session. */
export interface SavedStickies {
  notes: SavedStickiesNote[];
}

/**
 * The longest note text the server keeps, in characters (`MAX_TEXT_CHARS` of
 * ferrite-apps/desktop/src/apps/stickies): a saved note takes no more.
 */
export const MAX_TEXT = 20_000;

/** The most notes the server keeps (`MAX_NOTES` of ferrite-apps/desktop/src/apps/stickies). */
export const MAX_NOTES = 100;

/**
 * The longest formatted text the server keeps for a note, in bytes of UTF-8 (`MAX_HTML_BYTES`
 * of ferrite-apps/desktop/src/apps/stickies). A note whose formats would take more is saved as
 * its text alone.
 */
export const MAX_HTML = 100_000;

/** How many characters a text holds as the server counts them: Unicode scalar values. */
export function characters(text: string): number {
  let count = 0;
  for (const _ of text) count += 1;
  return count;
}

/** How many bytes a text takes in UTF-8, as the server counts the formatted text. */
export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

type Fields = Record<string, unknown>;
const isObject = (value: unknown): value is Fields =>
  typeof value === "object" && value !== null && !Array.isArray(value);
/** An optional field: absent, or of its type. */
const optional = (value: unknown, test: (value: unknown) => boolean) =>
  value === undefined || test(value);
const isBoolean = (value: unknown) => typeof value === "boolean";
const isString = (value: unknown) => typeof value === "string";
/** Whether `record` holds no field but `known`, as the server's documents do. */
const only = (record: Fields, known: readonly string[]) =>
  Object.keys(record).every((key) => known.includes(key));

const NOTE_FIELDS = ["id", "color", "text", "html", "frame", "collapsed", "translucent"];
const FRAME_FIELDS = ["x", "y", "width", "height"];

/** Whether `frame` is a place and size the server keeps: four finite numbers, a size above 0. */
function isFrame(frame: unknown): boolean {
  if (!isObject(frame) || !only(frame, FRAME_FIELDS)) return false;
  const { x, y, width, height } = frame;
  return (
    [x, y, width, height].every(Number.isFinite) && (width as number) > 0 && (height as number) > 0
  );
}

/** Whether `data` is a document the server keeps: every note of the right shape, ids used once. */
function isSavedStickies(data: unknown): data is SavedStickies {
  if (!isObject(data) || !only(data, ["notes"]) || !Array.isArray(data.notes)) return false;
  const ids = new Set<string>();
  for (const note of data.notes) {
    if (!isObject(note) || !only(note, NOTE_FIELDS)) return false;
    const { id, color, text, html, frame, collapsed, translucent } = note;
    if (typeof id !== "string" || ids.has(id) || typeof text !== "string") return false;
    ids.add(id);
    if (!STICKIES_COLORS.some(({ value }) => value === color)) return false;
    if (!optional(html, isString)) return false;
    if (!optional(frame, isFrame)) return false;
    if (!optional(collapsed, isBoolean) || !optional(translucent, isBoolean)) return false;
  }
  return true;
}

const stickiesDocument = createSyncedDocument<SavedStickies>({
  url: "/api/stickies/data",
  isDocument: isSavedStickies,
  // A change made in another window or browser reaches the open notes, which keep the caret
  // across it (`stickies.tsx`), and a change still being typed here is merged onto it note by
  // note, a note's text and formats together and its colour, frame and states each on their own
  // (`mergeRecordsById`), rather than dropped. Where both changed a note's text, the version saved
  // first stays, and the note tells the person and offers this page's back
  // (`useStickiesConflict`).
  refreshOnRemoteChange: true,
  merge: (base, mine, theirs) => ({
    notes: mergeRecordsById(base?.notes ?? [], mine.notes, theirs.notes, {
      together: [["text", "html"]],
      prefer: "theirs",
      onConflict: (conflict) => {
        if (!conflict.fields.includes("text") && !conflict.fields.includes("html")) return;
        const { text, html } = conflict.mine;
        noteConflict({ noteId: conflict.id, text, ...(html === undefined ? undefined : { html }) });
      },
    }),
  }),
});

/**
 * A note whose text this page and another window or browser changed at the same time: the other's
 * version, saved first, is in the note, and this page's is kept here until the person chooses.
 */
export interface StickiesConflict {
  noteId: string;
  /** This page's text, and its formats. */
  text: string;
  html?: string;
}

const NO_CONFLICTS: readonly StickiesConflict[] = [];
let conflicts = NO_CONFLICTS;
const conflictListeners = new Set<() => void>();
const conflictsChanged = (next: readonly StickiesConflict[]) => {
  conflicts = next;
  for (const listener of conflictListeners) listener();
};
function noteConflict(conflict: StickiesConflict) {
  conflictsChanged([...conflicts.filter((each) => each.noteId !== conflict.noteId), conflict]);
}

/** The conflict of the note `noteId`, for its notice, or `undefined`. */
export function useStickiesConflict(noteId: string): StickiesConflict | undefined {
  const all = useSyncExternalStore(
    (listener) => {
      conflictListeners.add(listener);
      return () => conflictListeners.delete(listener);
    },
    () => conflicts,
    () => NO_CONFLICTS,
  );
  return all.find((each) => each.noteId === noteId);
}

/** The person keeps the other window's version of the note `noteId`. */
export function dismissStickiesConflict(noteId: string) {
  conflictsChanged(conflicts.filter((each) => each.noteId !== noteId));
}

/**
 * The person keeps this page's version of the note `noteId`: its text and formats are saved over
 * the other's, as a document every note adopts, so that the note is built again with them.
 */
export function keepStickiesConflict(noteId: string) {
  const conflict = conflicts.find((each) => each.noteId === noteId);
  if (!conflict) return;
  dismissStickiesConflict(noteId);
  stickiesDocument.update(
    (document) => ({
      notes: (document?.notes ?? []).map((note) => {
        if (note.id !== noteId) return note;
        const { html: _stored, ...rest } = note;
        return conflict.html === undefined
          ? { ...rest, text: conflict.text }
          : { ...rest, text: conflict.text, html: conflict.html };
      }),
    }),
    {},
  );
}

/** Whether this build talks to the Ferrite application's API. */
export const syncEnabled = stickiesDocument.enabled;

/** Read the session's notes once per page: `null` when none are saved or they are unreadable. */
export const loadStickies = stickiesDocument.load;

/**
 * The saved notes, for a component: `undefined` while they are read, then the notes as the page
 * holds them (`null` when none are saved or they could not be read), and always `null` in a
 * build that does not talk to the API.
 */
export const useSavedStickies = stickiesDocument.useDocument;

/** The notes as the page holds them now, its unsaved changes included. */
export const currentStickies = stickiesDocument.current;

/**
 * The page's copy of the session's notes, for a component, and the window whose change it is
 * (`origin`; `null` when it was read from the server): `undefined` while they are read.
 */
export const useShownStickies = stickiesDocument.useShown;

/** For a saved note's window: a key that changes with each document the window adopts. */
export const useStickiesAdoptionKey = stickiesDocument.useAdoptionKey;

/**
 * Whether the newest change is not saved: the server refused the notes as they are, the server
 * could not be reached, or another window saved first and the change waits to be merged.
 */
export const useUnsaved = stickiesDocument.useUnsaved;

/**
 * Save one note's colour and text, as the window `origin` shows them, into the session's notes as
 * the page holds them, with its frame and states when they are given: the other notes, and what
 * is not given, stay as they are. A note not saved yet is added. `html` is the text with its formats: given, it replaces the
 * saved one, or removes it when it is longer than the server keeps (`MAX_HTML`), so that the
 * text is saved alone; left out (a colour chosen, the text unchanged), the saved one stays.
 */
export function saveStickiesNote(
  id: string,
  change: Pick<SavedStickiesNote, "color" | "text"> &
    Partial<Pick<SavedStickiesNote, "html" | "frame" | "collapsed" | "translucent">>,
  origin: object,
) {
  // A text the server would refuse (one still being composed past the limit) is not sent.
  if (characters(change.text) > MAX_TEXT) return;
  const { html, ...plain } = change;
  const edit = (note: SavedStickiesNote): SavedStickiesNote => {
    const { html: saved, ...rest } = { ...note, ...plain };
    if (html === undefined) return saved === undefined ? rest : { ...rest, html: saved };
    return utf8Bytes(html) > MAX_HTML ? rest : { ...rest, html };
  };
  stickiesDocument.update((document) => {
    const notes = document?.notes ?? [];
    return {
      notes: notes.some((note) => note.id === id)
        ? notes.map((note) => (note.id === id ? edit(note) : note))
        : [...notes, edit({ id, ...plain })],
    };
  }, origin);
}

/** Remove one note from the session's notes as the page holds them. */
export function removeStickiesNote(id: string, origin: object) {
  stickiesDocument.update(
    (document) => ({ notes: (document?.notes ?? []).filter((note) => note.id !== id) }),
    origin,
  );
}

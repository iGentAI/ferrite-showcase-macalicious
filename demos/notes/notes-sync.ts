import { useSyncExternalStore } from "react";
import { reportFailure } from "../desktop/desktop-server";
import { sameDocument } from "../desktop/document-merge";
import { createSyncedDocument, recordTag } from "../desktop/synced-document";
import { DEFAULT_FOLDER, type NotesFolder, type NotesNote, summarize } from "./notes-data";
import { mergeRecordsById, type RecordConflict } from "./notes-merge";

/*
 * Notes' link to its server half, `/api/notes/` of the macalicious-desktop Ferrite application
 * (ferrite-apps/desktop/src/apps/notes), through the shared synced document of
 * demos/desktop/synced-document.ts: the server owns the revision, a save names the revision it
 * is based on, and a save that meets a newer revision is dropped and the stored notes are shown.
 * Only the desktop build made for
 * that application sets `VITE_MACALICIOUS_API` to "1". Anywhere else (the documentation, the
 * tests, a copy of the demo) nothing is fetched, and the notes last as long as the window.
 */

/** What the server keeps for a browser session. */
export interface SavedNotes {
  folders: NotesFolder[];
  notes: NotesNote[];
}

/** The largest picture thumbnail sent, as a `data:` URL; a larger one is not kept. */
const MAX_PICTURE = 96_000;
/**
 * The longest text with formats sent for one note, in characters, as the application allows
 * (`MAX_HTML_CHARS`): a note past it is saved as its lines, without its formats.
 */
export const MAX_HTML = 100_000;

type Fields = Record<string, unknown>;
const isObject = (value: unknown): value is Fields =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
/** An optional field: absent, or of its type. */
const optional = (value: unknown, test: (value: unknown) => boolean) =>
  value === undefined || test(value);
/** Whether `record` holds no field but `known`, as the server's documents do. */
const only = (record: Fields, known: readonly string[]) =>
  Object.keys(record).every((key) => known.includes(key));

const FOLDER_FIELDS = ["id", "name", "parent", "local"] as const;
const NOTE_FIELDS = [
  "id",
  "folder",
  "lines",
  "html",
  "date",
  "edited",
  "attachment",
  "picture",
  "files",
  "locked",
  "sealed",
  "pinned",
  "created",
  "deleted",
];
const ATTACHMENTS: readonly unknown[] = ["screenshot", "photo"];
const isNoteFile = (file: unknown) =>
  isObject(file) &&
  isString(file.id) &&
  isString(file.name) &&
  isString(file.type) &&
  typeof file.size === "number";

/** Whether `value` is an envelope a locked note can hold. */
const isSealedNote = (value: unknown) =>
  isObject(value) &&
  typeof value.rev === "number" &&
  isObject(value.kdf) &&
  isString(value.kdf.name) &&
  typeof value.kdf.iterations === "number" &&
  isString(value.kdf.salt) &&
  isString(value.iv) &&
  isString(value.ciphertext) &&
  optional(value.hint, isString);

/**
 * Whether `data` is a document the server keeps: every folder and note of the right shape, ids
 * used once, the default folder present and every note in a folder that exists.
 */
function isSavedNotes(data: unknown): data is SavedNotes {
  if (!isObject(data) || !only(data, ["folders", "notes"])) return false;
  const { folders, notes } = data;
  if (!Array.isArray(folders) || !Array.isArray(notes)) return false;
  const folderIds = new Set<string>();
  for (const folder of folders) {
    if (!isObject(folder) || !only(folder, FOLDER_FIELDS)) return false;
    if (!isString(folder.id) || !isString(folder.name) || folderIds.has(folder.id)) return false;
    if (!optional(folder.parent, isString)) return false;
    if (!optional(folder.local, (value) => typeof value === "boolean")) return false;
    folderIds.add(folder.id);
  }
  if (!folderIds.has(DEFAULT_FOLDER)) return false;
  const noteIds = new Set<string>();
  for (const note of notes) {
    if (!isObject(note) || !only(note, NOTE_FIELDS)) return false;
    const { id, folder, lines, html, date, edited, attachment, picture, locked } = note;
    const { pinned, created, deleted } = note;
    if (!isString(id) || noteIds.has(id) || !isString(folder) || !folderIds.has(folder)) {
      return false;
    }
    noteIds.add(id);
    if (!Array.isArray(lines) || !lines.every(isString)) return false;
    // A note saved before formats were kept has no `html`; it is shown from its lines.
    if (!optional(html, isString)) return false;
    if (!isString(date) || !isString(edited)) return false;
    if (!optional(attachment, (value) => ATTACHMENTS.includes(value))) return false;
    if (!optional(picture, isString) || !optional(locked, (value) => typeof value === "boolean")) {
      return false;
    }
    if (!optional(note.files, (value) => Array.isArray(value) && value.every(isNoteFile))) {
      return false;
    }
    if (!optional(pinned, (value) => typeof value === "boolean")) return false;
    if (!optional(note.sealed, isSealedNote)) return false;
    if (!optional(created, isString) || !optional(deleted, isString)) return false;
  }
  return true;
}

const notesDocument = createSyncedDocument<SavedNotes>({
  url: "/api/notes/data",
  isDocument: isSavedNotes,
  // A change made in another window or browser reaches the open windows, which keep the note
  // shown and the caret across it (`notes.tsx`), and a change still being typed here is merged
  // onto it rather than dropped; a note whose text both changed keeps the version saved first,
  // and this page's becomes a conflicted copy beside it, which the window tells the person of.
  refreshOnRemoteChange: true,
  merge: (base, mine, theirs) => mergeNotes(base, mine, theirs, noteConflictAdded),
});

/**
 * A note this page and another window or browser changed at the same time: the other's version,
 * saved first, stays in the note, and this page's is the copy beside it.
 */
export interface NotesConflict {
  /** The note, with the version saved first. */
  noteId: string;
  /** The copy with this page's version. */
  copyId: string;
  /** The note's title, as the notice names it. */
  title: string;
}

/** What a conflicted copy's title says after the note's. */
export const CONFLICT_SUFFIX = " (conflicted copy)";

const NO_CONFLICTS: readonly NotesConflict[] = [];
let conflicts = NO_CONFLICTS;
const conflictListeners = new Set<() => void>();
const conflictsChanged = (next: readonly NotesConflict[]) => {
  conflicts = next;
  for (const listener of conflictListeners) listener();
};
function noteConflictAdded(conflict: NotesConflict) {
  conflictsChanged([...conflicts.filter((each) => each.copyId !== conflict.copyId), conflict]);
}
export const noteConflict = noteConflictAdded;

/** The conflicts this page's merges made, for the notice of every Notes window. */
export function useNotesConflicts(): readonly NotesConflict[] {
  return useSyncExternalStore(
    (listener) => {
      conflictListeners.add(listener);
      return () => conflictListeners.delete(listener);
    },
    () => conflicts,
    () => NO_CONFLICTS,
  );
}

/** The person has read the notice of the conflict whose copy is `copyId`. */
export function dismissNotesConflict(copyId: string) {
  conflictsChanged(conflicts.filter((each) => each.copyId !== copyId));
}

/** A note's fields that go together in a merge: its text, its formats, its dates and its lock. */
const NOTE_CONTENT = [
  "lines",
  "html",
  "date",
  "edited",
  "attachment",
  "picture",
  "files",
  "locked",
  "sealed",
] as const;
type NoteContent = Pick<NotesNote, (typeof NOTE_CONTENT)[number]>;

/** A note's content: its text, formats and dates. */
const contentOf = (note: NotesNote): NoteContent =>
  Object.fromEntries(
    NOTE_CONTENT.filter((field) => note[field] !== undefined).map((field) => [field, note[field]]),
  ) as NoteContent;
/** A note without its content, to give it another's. */
const withoutContent = (note: NotesNote) =>
  Object.fromEntries(
    Object.entries(note).filter(([field]) => !(NOTE_CONTENT as readonly string[]).includes(field)),
  ) as Omit<NotesNote, keyof NoteContent>;

/** Elements that start a line of their own in a note's stored formats (as `readLines` reads them). */
const LINE_BLOCKS = /^(DIV|P|H[1-6]|LI|UL|OL|TABLE|TBODY|TR|TD|TH|BLOCKQUOTE|PRE)$/;
const isLineBlock = (node: Node | null): node is Element =>
  node?.nodeType === 1 && LINE_BLOCKS.test((node as Element).tagName);

/**
 * The first line of stored formats, read in document order as `readLines` reads a note: it ends
 * at the first `<br>`, at a block that starts after its text, or at the end of the block that holds
 * its text, at any depth. Gives its last text node, and the `<br>` or block that ends it.
 */
function firstLineOf(root: Node): { last: Text | null; end: Node | null; block: Element | null } {
  let last: Text | null = null;
  let end: Node | null = null;
  let block: Element | null = null;
  let done = false;
  const walk = (node: Node) => {
    for (const child of [...node.childNodes]) {
      if (done) return;
      if (child.nodeType === 3) {
        if (child.nodeValue) last = child as Text;
        continue;
      }
      if (child.nodeType !== 1) continue;
      const element = child as Element;
      if (element.tagName === "BR") {
        end = element;
        done = true;
        return;
      }
      if (isLineBlock(element)) {
        if (last) {
          end = element;
          done = true;
          return;
        }
        block ??= element;
        walk(element);
        if (last) done = true;
        continue;
      }
      walk(element);
    }
  };
  walk(root);
  return { last, end, block };
}

/**
 * Split the inline element `top` right after `node`, which it holds: what follows `node` inside
 * `top`, at every depth, moves into copies of its elements placed right after `top`, so that
 * something can go between the two halves without moving any of the content.
 */
function splitAfter(node: Node, top: Node) {
  let child = node;
  let parent = node.parentNode;
  let carry: Node | null = null;
  while (parent) {
    const half = parent.cloneNode(false);
    if (carry) half.appendChild(carry);
    while (child.nextSibling) half.appendChild(child.nextSibling);
    carry = half;
    if (parent === top) {
      top.parentNode?.insertBefore(half, top.nextSibling);
      return;
    }
    child = parent;
    parent = parent.parentNode;
  }
}

/**
 * The stored formats with the conflicted-copy marker at the end of the first line, or without it
 * there, and nothing else touched. The marker is a text node of its own right after the line's
 * last text, outside the inline elements that hold it (so it never takes the title's bold; one
 * that also holds the line's end is split there) and inside its block. Parsed in an inert
 * template: nothing in it runs.
 */
function retitleHtml(html: string, copy: boolean): string {
  if (typeof document === "undefined") return html;
  const template = document.createElement("template");
  template.innerHTML = html;
  const root = template.content;
  const { last, end, block } = firstLineOf(root);
  if (!copy) {
    if (last?.data.endsWith(CONFLICT_SUFFIX)) {
      const rest = last.data.slice(0, -CONFLICT_SUFFIX.length);
      if (rest) last.data = rest;
      else last.remove();
    }
    return template.innerHTML;
  }
  if (last?.data.endsWith(CONFLICT_SUFFIX)) return template.innerHTML;
  const marker = document.createTextNode(CONFLICT_SUFFIX);
  if (last) {
    let top: Node = last;
    while (top.parentNode && top.parentNode !== root && !isLineBlock(top.parentNode)) {
      top = top.parentNode;
    }
    if (top !== last && end && top.contains(end)) splitAfter(last, top);
    top.parentNode?.insertBefore(marker, top.nextSibling);
  } else if (end) {
    end.parentNode?.insertBefore(marker, end);
  } else if (block) {
    block.appendChild(marker);
  } else {
    root.appendChild(marker);
  }
  return template.innerHTML;
}

/**
 * Content whose title says it is the conflicted copy, or no longer says so: the end of the first
 * line, in the lines and in the formats alike, and nothing else.
 */
function titled(content: NoteContent, copy: boolean): NoteContent {
  const [first = "", ...rest] = content.lines;
  const bare = first.endsWith(CONFLICT_SUFFIX) ? first.slice(0, -CONFLICT_SUFFIX.length) : first;
  const lines = [copy ? `${bare}${CONFLICT_SUFFIX}` : bare, ...rest];
  const html = content.html === undefined ? undefined : retitleHtml(content.html, copy);
  return { ...content, lines, ...(html === undefined ? undefined : { html }) };
}

/**
 * This page's version of a note as a copy beside it, its title saying so.
 */
export function conflictedCopy(note: NotesNote, id: string, folder: string): NotesNote {
  return { ...withoutContent(note), ...titled(contentOf(note), true), id, folder };
}

/**
 * Why a change typed here is not kept: a copy beside the note would put its text back on the server
 * in the clear after the person locked it.
 */
export const LOCKED_ELSEWHERE =
  "a note was locked in another window, so what was typed in it here wasn’t saved";

/**
 * `mine` where the stored notes lock a note otherwise than this page knows: that note takes the
 * stored content, whatever was typed in it here.
 */
function givingWayToLocks(
  base: SavedNotes | null,
  mine: SavedNotes,
  theirs: SavedNotes,
): SavedNotes {
  const stored = new Map(theirs.notes.map((note) => [note.id, note]));
  const was = new Map(base?.notes.map((note) => [note.id, note]));
  let dropped = false;
  const notes = mine.notes.map((note) => {
    const there = stored.get(note.id);
    if (!there?.sealed || sameDocument(note.sealed ?? null, there.sealed)) return note;
    const before = was.get(note.id);
    if (!before || !sameDocument(contentOf(before), contentOf(note))) dropped = true;
    return { ...withoutContent(note), ...contentOf(there) };
  });
  if (dropped) reportFailure({ url: "/api/notes/data", reason: LOCKED_ELSEWHERE });
  return { folders: mine.folders, notes };
}

/**
 * The session's notes as this page's unsaved changes (`mine`, made on `base`) meet the stored
 * notes that another window or browser changed meanwhile (`theirs`), folders and notes each
 * merged record by record (`mergeRecordsById`), a note's text, formats and dates together, the
 * notes this page changed first. Where both changed a note's text, the stored version, saved
 * first, stays in the note, and this page's is a copy beside it, its title saying so; each such
 * conflict is told to `onConflict`. A note left in a folder removed elsewhere goes to the default
 * folder, which every document keeps.
 */
export function mergeNotes(
  base: SavedNotes | null,
  mineAsTyped: SavedNotes,
  theirs: SavedNotes,
  onConflict?: (conflict: NotesConflict) => void,
): SavedNotes {
  const mine = givingWayToLocks(base, mineAsTyped, theirs);
  const folders = mergeRecordsById(base?.folders ?? [], mine.folders, theirs.folders, {
    prefer: "theirs",
  });
  if (!folders.some((folder) => folder.id === DEFAULT_FOLDER)) {
    const kept = theirs.folders.find((folder) => folder.id === DEFAULT_FOLDER);
    folders.unshift(kept ?? { id: DEFAULT_FOLDER, name: "Notes" });
  }
  const known = new Set(folders.map((folder) => folder.id));
  const conflicted: RecordConflict<NotesNote>[] = [];
  const notes = mergeRecordsById(base?.notes ?? [], mine.notes, theirs.notes, {
    together: [NOTE_CONTENT],
    mineFirst: true,
    prefer: "theirs",
    onConflict: (conflict) => conflicted.push(conflict),
  }).map((note) => (known.has(note.folder) ? note : { ...note, folder: DEFAULT_FOLDER }));
  const ids = new Set(notes.map((note) => note.id));
  for (const conflict of conflicted) {
    if (!conflict.fields.some((field) => (NOTE_CONTENT as readonly string[]).includes(field))) {
      continue;
    }
    let n = 1;
    while (ids.has(`${conflict.id}-conflict-${n}`)) n += 1;
    const copyId = `${conflict.id}-conflict-${n}`;
    ids.add(copyId);
    const at = notes.findIndex((note) => note.id === conflict.id);
    const folder = at >= 0 ? (notes[at]?.folder ?? DEFAULT_FOLDER) : DEFAULT_FOLDER;
    const copy: NotesNote = {
      ...withoutContent(conflict.mine),
      ...titled(contentOf(conflict.mine), true),
      id: copyId,
      folder,
    };
    notes.splice(at + 1, 0, copy);
    onConflict?.({ noteId: conflict.id, copyId, title: summarize(conflict.theirs).title });
  }
  return { folders, notes };
}

/**
 * Keep this window's version of a conflicted note: the note takes the copy's content, and the
 * copy the note's, so that the other window's version is kept as the copy in turn.
 */
export function keepConflictCopy(
  notes: readonly NotesNote[],
  conflict: NotesConflict,
): NotesNote[] {
  const note = notes.find((each) => each.id === conflict.noteId);
  const copy = notes.find((each) => each.id === conflict.copyId);
  if (!note || !copy) return [...notes];
  return notes.map((each) =>
    each.id === note.id
      ? { ...withoutContent(each), ...titled(contentOf(copy), false) }
      : each.id === copy.id
        ? { ...withoutContent(each), ...titled(contentOf(note), true) }
        : each,
  );
}

/** Whether this build talks to the Ferrite application's API. */
export const syncEnabled = notesDocument.enabled;

/** Read the session's notes once per page: `null` when none are saved or they are unreadable. */
export const loadNotes = notesDocument.load;

/**
 * The saved notes, for a component: `undefined` while they are read, `null` when nothing is
 * saved or they could not be read, and always `null` in a build that does not talk to the API.
 */
export const useSavedNotes = notesDocument.useDocument;

/**
 * Whether the newest change is not saved: the server refused the notes as they are, or could not
 * be reached to read them again after a save went unanswered.
 */
export const useUnsaved = notesDocument.useUnsaved;

/**
 * The page's copy of the session's notes, for a component, and the window whose change it is
 * (`origin`; `null` when it was read from the server): `undefined` while the notes are read.
 * Every Notes window shows it.
 */
export const useShownNotes = notesDocument.useShown;

/** For a Notes window: a key that changes with each document the window adopts. */
export const useNotesAdoptionKey = notesDocument.useAdoptionKey;

/** What goes in a new note's or folder's id so that two windows never make the same one. */
export const recordIdTag = recordTag;

/** Whether a note's picture is one that is saved: a small `data:` URL of an image. */
export const isSavedPicture = (picture: string | undefined): picture is string =>
  picture?.startsWith("data:image/") === true && picture.length <= MAX_PICTURE;

/**
 * A note as it is sent: a picture that is not a small `data:` URL stays in the page, and so do
 * the formats of a note whose text with formats is longer than the application keeps.
 */
const keepable_ = (note: NotesNote): NotesNote => {
  const { picture, html, ...rest } = note;
  return {
    ...rest,
    ...(html !== undefined && html.length <= MAX_HTML ? { html } : undefined),
    ...(picture !== undefined && isSavedPicture(picture) ? { picture } : undefined),
  };
};
export const keepable = keepable_;

const sendable = (data: SavedNotes): SavedNotes => ({
  folders: data.folders,
  notes: data.notes.map(keepable),
});

/**
 * Save the session's folders and notes as the window `origin` shows them. Nothing is written
 * before the session's notes were read, or at all when they could not be. Given another origin
 * than the window's (`{}`), every window shows them as a document it adopts, built again from it.
 */
export function saveNotes(data: SavedNotes, origin: object) {
  notesDocument.save(sendable(data), origin);
}

/** The session's notes as the page holds them now, its unsaved changes included. */
export const currentNotes = notesDocument.current;

/** Read the stored notes again and show them, when no change of this page waits. */
export const refreshNotes = notesDocument.refresh;

/** Whether the page's copy differs from the stored notes. */
export const notesUnsaved = notesDocument.unsaved;

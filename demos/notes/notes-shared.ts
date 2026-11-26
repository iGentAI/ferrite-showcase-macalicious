import { useEffect, useRef, useSyncExternalStore } from "react";
import { SERVER_CHANGE_EVENT } from "../desktop/desktop-live";
import {
  CHANGED_ELSEWHERE,
  reportFailure,
  sessionFetch,
  withDeadline,
} from "../desktop/desktop-server";
import { DEFAULT_FOLDER, type NotesNote, SHARED_FOLDER, summarize } from "./notes-data";
import { mergeSharedNote } from "./notes-shared-merge";
import {
  conflictedCopy,
  currentNotes,
  keepable,
  noteConflict,
  notesUnsaved,
  refreshNotes,
  type SavedNotes,
  saveNotes,
  syncEnabled,
} from "./notes-sync";

/*
 * The notes the signed-in person shares with other accounts, kept on the macalicious-desktop Ferrite
 * application (`/api/notes/shared`, ferrite-apps/desktop/src/apps/notes/shared.rs). Each is a
 * document of its own with its own revision, on the rule of the person's own document
 * (notes-sync.ts): a save names the revision it is based on, one save is under way per note, a save
 * refused because someone else saved first is merged onto what they saved and made again, and one
 * whose outcome is not known gives way to what is stored. In a window a shared note is a note whose
 * folder is `SHARED_FOLDER`, so the window edits it as any other. Nothing here runs unless the page
 * is served by the application.
 */

const SHARED = "/api/notes/shared";
/** How long a change waits for the next one before it is sent. */
const SAVE_DELAY = 400;
/** How long an action waits for the page's changes to be stored. */
const SETTLE_MS = 8000;
const SETTLE_CHECK = 100;

/** Someone on a shared note. */
export interface SharedPerson {
  /** The account name. */
  name: string;
  fullName: string;
}

/**
 * The note a request to open an item of Notes names, `null` for one the person no longer has.
 * Spotlight asks with the note's id; a shared note's notification says `share-<id>`,
 * `share-<id>-<rev>`, `left-<id>-<rev>` or `unshare-<id>-<rev>` (ferrite-apps/desktop/src/apps/notes/shared.rs).
 */
export function noteOfOpenItem(item: string): string | null {
  const told = /^(share|left|unshare)-(sh-[0-9a-f]{24})(?:-\d+)?$/.exec(item);
  if (!told) return item;
  return told[1] === "unshare" ? null : (told[2] ?? null);
}

/** A shared note as the server sends it. */
export interface SharedNote {
  id: string;
  rev: number;
  owner: SharedPerson;
  /** Everyone on it but its owner. */
  members: SharedPerson[];
  /** Whether the person reading it owns it. */
  owned: boolean;
  /** The full name of whoever saved it last. */
  editedBy?: string;
  /** The note, its folder `SHARED_FOLDER`. */
  note: NotesNote;
}

export interface SharedState {
  notes: readonly SharedNote[];
  canShare: boolean;
  /** The person's own account name. */
  me?: string;
  /** A new number each time the page's copy changes. */
  seq: number;
  /** The window whose change the copy is, or `null` when it was read from the server. */
  origin: object | null;
  /** Whether a change of this page to a shared note is not stored yet. */
  unsaved: boolean;
}

type Fields = Record<string, unknown>;
const isObject = (value: unknown): value is Fields =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";

function personOf(value: unknown): SharedPerson | null {
  return isObject(value) && isString(value.name) && isString(value.full_name)
    ? { name: value.name, fullName: value.full_name }
    : null;
}

/** A note of the `GET` reply, or `null` when it is not one. */
export function sharedNoteOf(value: unknown): SharedNote | null {
  if (!isObject(value) || !isString(value.id) || !/^sh-[0-9a-f]{24}$/.test(value.id)) return null;
  const { rev, owned, note } = value;
  if (!Number.isSafeInteger(rev) || (rev as number) < 0 || typeof owned !== "boolean") return null;
  const owner = personOf(value.owner);
  const members = Array.isArray(value.members) ? value.members.map(personOf) : null;
  if (!owner || !members || members.some((each) => each === null)) return null;
  if (!isObject(note) || note.id !== value.id || !Array.isArray(note.lines)) return null;
  if (!note.lines.every(isString) || !isString(note.date) || !isString(note.edited)) return null;
  return {
    id: value.id,
    rev: rev as number,
    owner,
    members: members as SharedPerson[],
    owned,
    ...(isString(value.edited_by) ? { editedBy: value.edited_by } : {}),
    note: { ...(note as unknown as NotesNote), folder: SHARED_FOLDER },
  };
}

const EMPTY: SharedState = { notes: [], canShare: false, seq: 0, origin: null, unsaved: false };
let state: SharedState = EMPTY;
const listeners = new Set<() => void>();
const publish = (next: SharedState) => {
  state = next;
  for (const listener of listeners) listener();
};

/** JSON with every object's fields in order, and no empty ones. */
const canon = (value: unknown) =>
  JSON.stringify(value, (_key, item: unknown) =>
    isObject(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : item,
  );

/** What a save sends: the note as it is kept. The server keeps the folder it holds. */
const sent = (note: NotesNote): NotesNote => ({ ...keepable(note), folder: DEFAULT_FOLDER });
const bodyOf = (note: NotesNote) => canon(sent(note));

/** What each note was last read or saved as: what a save is based on, and compared with. */
const stored = new Map<string, { rev: number; note: NotesNote; body: string }>();
const inflight = new Set<string>();
/** A note's newest change, waiting for its delay or for the save under way. */
const waiting = new Map<string, NotesNote>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
/** The notes whose change, as the windows show it, is not stored yet. */
const unsaved = new Set<string>();
let reads = 0;
/** Whether a read came back while a save was under way, and is to be made again after it. */
let reread = false;
let rereadForce = false;
/** Counts the saves started: a read answered after a save began may not hold it. */
let writes = 0;
let loading = 0;
let queued: "none" | "plain" | "force" = "none";

const markUnsaved = (id: string, on: boolean) => {
  if (unsaved.has(id) === on) return;
  if (on) unsaved.add(id);
  else unsaved.delete(id);
  publish({ ...state, unsaved: unsaved.size > 0 });
};

interface Reply {
  ok: boolean;
  status: number;
  body: unknown;
}

async function request(url: string, init?: RequestInit): Promise<Reply> {
  return withDeadline(async (signal) => {
    const response = await sessionFetch(url, {
      credentials: "same-origin",
      ...init,
      headers: { accept: "application/json", ...(init?.headers ?? {}) },
      signal,
    });
    const body = (await response.json().catch(() => null)) as unknown;
    return { ok: response.ok, status: response.status, body };
  });
}

const contentOf = (of: Pick<SharedState, "notes" | "canShare" | "me">) =>
  canon({ notes: of.notes, canShare: of.canShare, me: of.me ?? null });
/** What a window is built from: each note's id and content. */
const notesKey = (notes: readonly SharedNote[]) => canon(notes.map((each) => [each.id, each.note]));

/**
 * Read the shared notes again; the page's copy changes only when something did, or always with
 * `force`. A read that comes back while a save is waiting or under way, or after one began, is made
 * again once the saves are done: it may not hold the change being saved.
 */
export async function loadShared(force = false): Promise<void> {
  const read = ++reads;
  const since = writes;
  const busy = inflight.size > 0;
  loading += 1;
  try {
    const response = await request(SHARED);
    if (!response.ok) return;
    const reply = response.body;
    if (read !== reads || !isObject(reply) || !Array.isArray(reply.notes)) return;
    if (busy || writes !== since || inflight.size > 0 || waiting.size > 0) {
      reread = true;
      rereadForce ||= force;
      await afterSaves();
      return;
    }
    const notes = reply.notes.map(sharedNoteOf).filter((each): each is SharedNote => each !== null);
    stored.clear();
    for (const each of notes) {
      stored.set(each.id, { rev: each.rev, note: each.note, body: bodyOf(each.note) });
    }
    const next = {
      notes,
      canShare: reply.can_share === true,
      ...(isString(reply.me) ? { me: reply.me } : {}),
    };
    unsaved.clear();
    if (force || notesKey(next.notes) !== notesKey(state.notes)) {
      publish({ ...next, seq: state.seq + 1, origin: null, unsaved: false });
    } else if (contentOf(next) !== contentOf(state)) {
      // Who is on a note, or its revision: the windows show it without being built again, so a
      // popover open in them stays open.
      publish({ ...state, ...next, unsaved: false });
    } else if (state.unsaved) {
      publish({ ...state, unsaved: false });
    }
  } catch {
    // Read again at the next change or window.
  } finally {
    loading -= 1;
    if (loading === 0 && queued !== "none") {
      const again = queued === "force";
      queued = "none";
      void loadShared(again);
    }
  }
}

function requestShared(force = false) {
  if (loading > 0) {
    queued = force || queued === "force" ? "force" : "plain";
    return;
  }
  void loadShared(force);
}

async function afterSaves() {
  if (!reread || inflight.size > 0 || waiting.size > 0) return;
  const force = rereadForce;
  reread = false;
  rereadForce = false;
  await loadShared(force);
}

/** Shared note `id` as stored now, or `null` when it could not be read or is gone. */
async function freshNote(id: string): Promise<SharedNote | null> {
  try {
    const response = await request(SHARED);
    if (!response.ok || !isObject(response.body) || !Array.isArray(response.body.notes)) {
      return null;
    }
    return (
      response.body.notes
        .map(sharedNoteOf)
        .find((each): each is SharedNote => each !== null && each.id === id) ?? null
    );
  } catch {
    return null;
  }
}

/**
 * This page's version of a note both changed on one line: a copy among the person's own notes, with
 * the notice every window gives of a conflict (`NotesConflict`).
 */
function keepConflict(mine: NotesNote, theirs: NotesNote) {
  const own = currentNotes();
  if (!own) return;
  const known = new Set(own.notes.map((note) => note.id));
  let n = 1;
  while (known.has(`${mine.id}-conflict-${n}`)) n += 1;
  const copyId = `${mine.id}-conflict-${n}`;
  saveNotes(
    { folders: own.folders, notes: [conflictedCopy(mine, copyId, DEFAULT_FOLDER), ...own.notes] },
    {},
  );
  noteConflict({ noteId: mine.id, copyId, title: summarize(theirs).title });
}

/** Send note `id` as `note`, merged and made again once when someone else saved first. */
async function send(id: string, note: NotesNote, again = false): Promise<void> {
  const base = stored.get(id);
  if (!base) return;
  const body = bodyOf(note);
  if (body === base.body) {
    const pending = waiting.get(id);
    waiting.delete(id);
    if (pending) {
      await send(id, pending, again);
      return;
    }
    markUnsaved(id, false);
    await afterSaves();
    return;
  }
  writes += 1;
  inflight.add(id);
  let outcome: "saved" | "conflict" | "refused" | "unknown" = "unknown";
  let status = 0;
  let said: string | undefined;
  try {
    const response = await request(`${SHARED}/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: `{"base":${base.rev},"note":${body}}`,
    });
    if (response.ok) {
      const reply = (response.body ?? {}) as { rev?: unknown };
      if (Number.isSafeInteger(reply.rev)) {
        const rev = reply.rev as number;
        stored.set(id, { rev, note, body });
        publish({
          ...state,
          notes: state.notes.map((each) => (each.id === id ? { ...each, rev } : each)),
        });
        outcome = "saved";
      }
    } else if (response.status === 409) {
      outcome = "conflict";
    } else if (response.status < 500 && response.status !== 408 && response.status !== 429) {
      outcome = "refused";
      status = response.status;
      if (isObject(response.body) && isString(response.body.error)) said = response.body.error;
    }
  } catch {
    // Not known: read again below.
  }
  const timer = timers.get(id);
  if (timer !== undefined) clearTimeout(timer);
  timers.delete(id);
  if (outcome === "conflict" && !again) {
    const fresh = await freshNote(id);
    const latest = waiting.get(id) ?? note;
    waiting.delete(id);
    if (fresh) {
      const merged = mergeSharedNote(base.note, latest, fresh.note);
      if (merged.conflict) keepConflict(latest, fresh.note);
      stored.set(id, { rev: fresh.rev, note: fresh.note, body: bodyOf(fresh.note) });
      publish({
        ...state,
        notes: state.notes.map((each) => (each.id === id ? { ...fresh, note: merged.note } : each)),
        seq: state.seq + 1,
        origin: null,
      });
      inflight.delete(id);
      await send(id, merged.note, true);
      return;
    }
  }
  const next = waiting.get(id);
  waiting.delete(id);
  inflight.delete(id);
  if (outcome === "saved") {
    if (next) {
      await send(id, next);
      return;
    }
    markUnsaved(id, false);
  } else if (outcome === "refused") {
    reportFailure({
      url: `${SHARED}/${id}`,
      reason: `HTTP ${status}`,
      ...(said ? { detail: said } : {}),
    });
    if (next) {
      await send(id, next);
      return;
    }
  } else {
    if (outcome === "conflict") {
      reportFailure({ url: `${SHARED}/${id}`, reason: CHANGED_ELSEWHERE });
    }
    await loadShared(true);
    return;
  }
  await afterSaves();
}

/** Save shared note `note` as the window `origin` shows it, after a short pause in typing. */
function saveShared(note: NotesNote, origin: object) {
  const base = stored.get(note.id);
  if (!base) return;
  const changed = bodyOf(note) !== base.body;
  if (!changed && !waiting.has(note.id) && !inflight.has(note.id)) return;
  if (changed) unsaved.add(note.id);
  publish({
    ...state,
    notes: state.notes.map((each) => (each.id === note.id ? { ...each, note } : each)),
    seq: state.seq + 1,
    origin,
    unsaved: unsaved.size > 0,
  });
  waiting.set(note.id, note);
  const timer = timers.get(note.id);
  if (timer !== undefined) clearTimeout(timer);
  timers.set(
    note.id,
    setTimeout(() => {
      timers.delete(note.id);
      if (inflight.has(note.id)) return;
      const newest = waiting.get(note.id);
      waiting.delete(note.id);
      if (newest) void send(note.id, newest);
    }, SAVE_DELAY),
  );
}

/**
 * Save what a window shows: the shared notes that changed to their own documents, the rest to the
 * person's own. `origin` is the window, which already shows the change.
 */
export function saveAllNotes(data: SavedNotes, origin: object) {
  const own: NotesNote[] = [];
  for (const note of data.notes) {
    if (note.folder !== SHARED_FOLDER) own.push(note);
    else if (state.notes.find((each) => each.id === note.id)?.note !== note) {
      saveShared(note, origin);
    }
  }
  saveNotes({ folders: data.folders, notes: own }, origin);
}

/** Send what waits at once: the page is going away, and a timer would not fire. */
function flushOnLeave() {
  for (const [id, note] of waiting) {
    const base = stored.get(id);
    if (!base || inflight.has(id)) continue;
    void sessionFetch(`${SHARED}/${id}`, {
      method: "PUT",
      credentials: "same-origin",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: `{"base":${base.rev},"note":${bodyOf(note)}}`,
    }).catch(() => {});
  }
}

/** Wait until the changes `pending` tells of are stored; `false` when they could not be. */
async function settled(pending: () => boolean): Promise<boolean> {
  const until = Date.now() + SETTLE_MS;
  while (pending()) {
    if (Date.now() >= until) return false;
    await new Promise((resolve) => setTimeout(resolve, SETTLE_CHECK));
  }
  return true;
}

const COULD_NOT_SAVE = "Your changes to this note could not be saved. Try again.";
const noteSettled = (id: string) =>
  settled(() => inflight.has(id) || waiting.has(id) || unsaved.has(id));

/** What an action resolves with: why it failed, or `null`. `own`: the person's own notes changed. */
async function act(
  url: string,
  init: RequestInit,
  own = false,
  done?: (reply: Fields) => void,
): Promise<string | null> {
  try {
    const response = await request(url, {
      ...init,
      headers: { "content-type": "application/json" },
    });
    const reply = response.body;
    if (response.ok && isObject(reply)) done?.(reply);
    if (own && response.ok) await refreshNotes();
    await loadShared();
    if (response.ok) return null;
    return isObject(reply) && isString(reply.error) ? reply.error : "The desktop refused it.";
  } catch {
    return "The desktop could not be reached. Try again.";
  }
}

/**
 * Share the person's own note `note` with the account named `name`, once it is stored as the window
 * shows it; `shared` is given the id the shared note has.
 */
export async function shareNote(
  note: string,
  name: string,
  shown: SavedNotes,
  shared?: (id: string) => void,
): Promise<string | null> {
  saveAllNotes(shown, {});
  if (!(await settled(notesUnsaved))) return COULD_NOT_SAVE;
  return act(
    SHARED,
    { method: "POST", body: JSON.stringify({ note, people: [name] }) },
    true,
    (reply) => {
      if (isString(reply.id)) shared?.(reply.id);
    },
  );
}

/** The owner adds the account named `name` to shared note `id`. */
export async function addPerson(id: string, name: string): Promise<string | null> {
  if (!(await noteSettled(id))) return COULD_NOT_SAVE;
  return act(`${SHARED}/${id}/people`, { method: "POST", body: JSON.stringify({ name }) });
}

/** The owner takes the account named `name` off shared note `id`. */
export async function removePerson(id: string, name: string): Promise<string | null> {
  if (!(await noteSettled(id))) return COULD_NOT_SAVE;
  return act(`${SHARED}/${id}/people/${encodeURIComponent(name)}`, { method: "DELETE" });
}

/** Someone other than the owner leaves shared note `id`, which goes from their notes. */
export async function leaveNote(id: string): Promise<string | null> {
  if (!(await noteSettled(id))) return COULD_NOT_SAVE;
  return act(`${SHARED}/${id}/leave`, { method: "POST", body: "{}" });
}

/**
 * The owner stops sharing note `id`: it goes back to their own notes, in Recently Deleted when
 * `deleted` gives the date, and from everyone else's.
 */
export async function stopSharing(id: string, deleted?: string): Promise<string | null> {
  if (!(await noteSettled(id))) return COULD_NOT_SAVE;
  return act(
    `${SHARED}/${id}/stop`,
    { method: "POST", body: JSON.stringify(deleted ? { deleted } : {}) },
    true,
  );
}

let windows = 0;
const onServerChange = (event: Event) => {
  if ((event as CustomEvent<{ app?: string }>).detail?.app === "notes") requestShared();
};

/** The page's shared notes, read when a window opens and when the person's Notes changed. */
export function useSharedNotes(): SharedState {
  const enabled = syncEnabled();
  const shown = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => EMPTY,
  );
  useEffect(() => {
    if (!enabled) return;
    windows += 1;
    if (windows === 1) {
      window.addEventListener(SERVER_CHANGE_EVENT, onServerChange);
      window.addEventListener("pagehide", flushOnLeave);
    }
    requestShared();
    return () => {
      windows -= 1;
      if (windows === 0) {
        window.removeEventListener(SERVER_CHANGE_EVENT, onServerChange);
        window.removeEventListener("pagehide", flushOnLeave);
      }
    };
  }, [enabled]);
  return enabled ? shown : EMPTY;
}

/**
 * For the window `origin`: a number that changes each time the page's copy of the shared notes
 * changes but not by the window itself. The window is then built again from them.
 */
export function useSharedAdoptionKey(shared: SharedState, origin: object): number {
  const last = useRef(shared.seq);
  if (shared.origin !== origin) last.current = shared.seq;
  return last.current;
}

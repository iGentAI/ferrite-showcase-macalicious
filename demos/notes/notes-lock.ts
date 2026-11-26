"use client";

import { useSyncExternalStore } from "react";
import {
  currentDesktopSession,
  onDesktopSessionChange,
  reportFailure,
  sessionFetch,
} from "../desktop/desktop-server";
import {
  deriveKey,
  fromBase64,
  toBase64,
  VAULT_ITERATIONS,
  VAULT_KDF,
  WrongPasswordError,
} from "../keychain-access/keychain-access-vault";
import { type NotesNote, type SealedNote, stamp } from "./notes-data";
import {
  conflictedCopy,
  currentNotes,
  keepable,
  notesUnsaved,
  refreshNotes,
  syncEnabled,
} from "./notes-sync";

/*
 * Notes' password lock, in the page. A locked note in the document holds an envelope and no text
 * (`NotesNote.sealed`), so the document, its journal in the browser's storage, the note list, the
 * search and everything the server reads of it know nothing of what it says. The text of an open
 * locked note lives only here, in memory, with the keys.
 *
 * Everything held belongs to one object (`Held`), for one desktop session. Forgetting replaces that
 * object: work under way compares it after each wait and stops, so no key, text or late reply
 * reaches the next person. It is forgotten when the desktop names another session, on Close All
 * Locked Notes, when the last Notes window closes, and after `LOCK_IDLE_MS` with no click or key.
 *
 * A locked note changes only through `/api/notes/locked` (`src/apps/notes/locked.rs`), naming the
 * revision it was opened at: a save that meets another revision changes nothing, and the note says
 * so (`OpenNote.refused`).
 */

export const NOTES_LOCKED_URL = "/api/notes/locked";
const DATA_URL = "/api/notes/data";
/** How long an unlocked note stays open with nothing done: "a few minutes" on a Mac (provisional). */
export const LOCK_IDLE_MS = 5 * 60_000;
/** The server's `MAX_SEALED_CHARS`. */
const MAX_SEALED = 800_000;
const SAVE_WAIT_MS = 400;
const RETRY_MS = 3_000;
const UNSAVED_WAIT_MS = 400;
const ATTEMPTS = 8;

export const LOCK_CHANGED_ELSEWHERE =
  "This note changed in another window, so your latest changes here weren’t saved.";
/** The same, short enough for the banner over the note, which cuts a longer line. */
export const LOCK_CHANGED_BANNER = "Changed in another window: this wasn’t saved.";
export const FORGOTTEN_PASSWORD_LOSES_TEXT =
  "If you forget this password, the text of the notes locked with it is lost: no one can recover it, not even from the server.";
export const WRONG_PASSWORD = "The password you entered is not correct.";
const TOO_LONG = "This note is too long to lock.";
const UNREACHABLE = "The notes could not be reached. Try again.";
const LOCK_MOVED = "This note changed in another window. Check it, and try again.";
const NOTE_GONE = "This note is no longer there.";
const FORGOTTEN = "The locked notes were closed meanwhile.";
const UNSAVED_AFTER_CLOSE =
  "a locked note changed in another window, so your latest changes in it weren’t saved";

/** What the envelope holds of a note. */
export type LockedText = Pick<NotesNote, "lines" | "html" | "attachment" | "picture">;
type Envelope = Omit<SealedNote, "rev">;
type Kdf = SealedNote["kdf"];

const bytes = (text: string) => new TextEncoder().encode(text);

const textOf = (note: LockedText): LockedText => ({
  lines: note.lines,
  ...(note.html === undefined ? undefined : { html: note.html }),
  ...(note.attachment === undefined ? undefined : { attachment: note.attachment }),
  ...(note.picture === undefined ? undefined : { picture: note.picture }),
});
const sameText = (a: LockedText, b: LockedText) =>
  JSON.stringify(textOf(a)) === JSON.stringify(textOf(b));

/** The envelope of one note's text. The note's id is authenticated with it: it opens only there. */
export async function sealText(
  id: string,
  text: LockedText,
  key: CryptoKey,
  kdf: Kdf,
  hint?: string,
): Promise<Envelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: bytes(id) },
    key,
    bytes(JSON.stringify(textOf(text))),
  );
  const ciphertext = toBase64(new Uint8Array(sealed));
  if (ciphertext.length > MAX_SEALED) throw new Error(TOO_LONG);
  return { kdf, iv: toBase64(iv), ciphertext, ...(hint ? { hint } : undefined) };
}

/** The text of a note's envelope. Throws `WrongPasswordError` when `key` isn't its key. */
export async function openText(id: string, sealed: Envelope, key: CryptoKey): Promise<LockedText> {
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(sealed.iv), additionalData: bytes(id) },
      key,
      fromBase64(sealed.ciphertext),
    );
  } catch {
    throw new WrongPasswordError();
  }
  return textOf(JSON.parse(new TextDecoder().decode(plain)) as LockedText);
}

/** One locked note open on this page. */
export interface OpenNote {
  id: string;
  text: LockedText;
  date: string;
  edited: string;
  /** A save met a newer revision: the text is this page's, unsaved, and the note is read-only. */
  refused: boolean;
  /** Changes when the text is replaced from outside: its editor is built again. */
  generation: number;
}

export interface LockView {
  open: ReadonlyMap<string, OpenNote>;
}

/** How an action asked of the lock ended. */
export type LockResult = { ok: true } | { ok: false; reason: string; hint?: string };
const refusedWith = (reason: string, hint?: string): LockResult => ({
  ok: false,
  reason,
  ...(hint ? { hint } : undefined),
});
const DONE: LockResult = { ok: true };

interface Entry extends OpenNote {
  rev: number;
  salt: string;
  dirty: boolean;
  saving: boolean;
  again: boolean;
  timer?: ReturnType<typeof setTimeout>;
}
interface HeldKey {
  key: CryptoKey;
  kdf: Kdf;
  hint?: string;
}
interface Held {
  session: string | null;
  keys: Map<string, HeldKey>;
  open: Map<string, Entry>;
  opening: Set<string>;
}

const newKdf = (iterations: number): Kdf => ({
  name: VAULT_KDF,
  iterations,
  salt: toBase64(crypto.getRandomValues(new Uint8Array(16))),
});

const keyFrom = (password: string, kdf: Kdf) => deriveKey(password, { ...kdf, name: VAULT_KDF });

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function readStored(session: string | null) {
  const reply = await sessionFetch(DATA_URL, undefined, session).catch(() => null);
  if (!reply?.ok) return null;
  const body = (await reply.json().catch(() => null)) as {
    rev: number;
    data: { notes: NotesNote[] } | null;
  } | null;
  return body ? { rev: body.rev, notes: body.data?.notes ?? [] } : null;
}

const sendChanges = (session: string | null, request: object) =>
  sessionFetch(
    NOTES_LOCKED_URL,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    },
    session,
  ).catch(() => null);

const errorOf = async (reply: Response | null) =>
  ((await reply?.json().catch(() => null)) as { error?: string } | null)?.error ?? UNREACHABLE;

export interface NotesLockOptions {
  /** PBKDF2 iterations of a new password; the server takes no fewer than 100,000. */
  iterations?: number;
  idleMs?: number;
}

export function createNotesLock({
  iterations = VAULT_ITERATIONS,
  idleMs = LOCK_IDLE_MS,
}: NotesLockOptions = {}) {
  const newHeld = (): Held => ({
    session: currentDesktopSession(),
    keys: new Map(),
    open: new Map(),
    opening: new Set(),
  });
  let held = newHeld();
  let view: LockView = { open: new Map() };
  const listeners = new Set<() => void>();

  const publish = (mine: Held, deferred = false) => {
    if (mine !== held) return;
    view = {
      open: new Map(
        [...mine.open].map(([id, { text, date, edited, refused, generation }]) => [
          id,
          { id, text, date, edited, refused, generation },
        ]),
      ),
    };
    const tell = () => {
      for (const listener of listeners) listener();
    };
    // The desktop names a session during a render.
    if (deferred) queueMicrotask(tell);
    else tell();
  };

  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let lastActive = 0;
  const onActive = () => {
    if (Date.now() - lastActive >= idleMs) {
      forget();
      return;
    }
    lastActive = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(forget, idleMs);
  };
  const watchIdle = () => {
    if (idleTimer !== undefined) return;
    lastActive = Date.now();
    idleTimer = setTimeout(forget, idleMs);
    window.addEventListener("pointerdown", onActive, true);
    window.addEventListener("keydown", onActive, true);
  };
  const stopIdle = () => {
    if (idleTimer === undefined) return;
    clearTimeout(idleTimer);
    idleTimer = undefined;
    window.removeEventListener("pointerdown", onActive, true);
    window.removeEventListener("keydown", onActive, true);
  };

  /** Close every locked note: what was typed goes out under the keys that are going away. */
  function forget() {
    const was = held;
    const changedPerson = was.session !== currentDesktopSession();
    const hadSomething = was.open.size > 0 || was.keys.size > 0;
    held = newHeld();
    stopIdle();
    const last: Promise<void>[] = [];
    for (const entry of was.open.values()) {
      clearTimeout(entry.timer);
      if (entry.dirty && !entry.refused) last.push(save(was, entry));
    }
    view = { open: new Map() };
    queueMicrotask(() => {
      for (const listener of listeners) listener();
    });
    // This page's own saves don't reach its copy of the document (no window is built again under
    // what is being typed): it catches up now that no note is open.
    if (hadSomething && !changedPerson) void Promise.all(last).then(() => refreshNotes());
  }

  /** What is held, once it is known to be this session's. */
  const current = () => {
    if (held.session !== currentDesktopSession()) forget();
    return held;
  };

  onDesktopSessionChange(() => {
    if (held.session !== currentDesktopSession()) forget();
  });

  const schedule = (mine: Held, entry: Entry, wait = SAVE_WAIT_MS) => {
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => void save(mine, entry), wait);
  };

  /**
   * A 409 on a save: the server may hold that very save, its reply lost on the way. Otherwise the
   * note changed elsewhere, and the person is told.
   */
  const settleRefused = async (mine: Held, entry: Entry, sent: LockedText) => {
    const stored = await readStored(mine.session);
    const note = stored?.notes.find((each) => each.id === entry.id);
    const key = note?.sealed && mine.keys.get(note.sealed.kdf.salt)?.key;
    if (note?.sealed && key) {
      const there = await openText(entry.id, note.sealed, key).catch(() => null);
      if (there && sameText(there, sent)) {
        entry.rev = note.sealed.rev;
        if (entry.text === sent) entry.dirty = false;
        else schedule(mine, entry);
        return;
      }
    }
    if (mine !== held) {
      reportFailure({ url: NOTES_LOCKED_URL, reason: UNSAVED_AFTER_CLOSE });
      return;
    }
    entry.refused = true;
    clearTimeout(entry.timer);
    publish(mine);
    void refreshNotes();
  };

  /** Send the text as it is now, naming the revision it was made on. One save per note at a time. */
  async function save(mine: Held, entry: Entry): Promise<void> {
    if (entry.saving) {
      entry.again = true;
      return;
    }
    const heldKey = mine.keys.get(entry.salt);
    if (!heldKey || entry.refused) return;
    entry.saving = true;
    const { text, date, edited } = entry;
    try {
      const sealed = await sealText(entry.id, text, heldKey.key, heldKey.kdf, heldKey.hint);
      const reply = await sendChanges(mine.session, {
        changes: [{ id: entry.id, rev: entry.rev, sealed, date, edited }],
      });
      if (reply?.ok) {
        const body = (await reply.json()) as { notes: Record<string, number> };
        entry.rev = body.notes[entry.id] ?? entry.rev;
        if (entry.text === text) entry.dirty = false;
        else entry.again = true;
      } else if (reply?.status === 409) {
        await settleRefused(mine, entry, text);
      } else {
        reportFailure({ url: NOTES_LOCKED_URL, reason: await errorOf(reply) });
        if (mine === held) schedule(mine, entry, RETRY_MS);
      }
    } catch (error) {
      reportFailure({
        url: NOTES_LOCKED_URL,
        reason: error instanceof Error ? error.message : UNREACHABLE,
      });
    } finally {
      entry.saving = false;
      if (entry.again) {
        entry.again = false;
        if (!entry.refused) {
          if (mine === held) schedule(mine, entry);
          else void save(mine, entry);
        }
      }
    }
  }

  const openEntry = async (mine: Held, note: NotesNote, sealed: SealedNote, key: CryptoKey) => {
    const text = await openText(note.id, sealed, key);
    if (mine !== held) return;
    const entry = mine.open.get(note.id);
    if (entry) {
      Object.assign(entry, {
        text,
        rev: sealed.rev,
        salt: sealed.kdf.salt,
        date: note.date,
        edited: note.edited,
        refused: false,
        dirty: false,
        generation: entry.generation + 1,
      });
      clearTimeout(entry.timer);
      return;
    }
    mine.open.set(note.id, {
      id: note.id,
      text,
      date: note.date,
      edited: note.edited,
      refused: false,
      generation: 0,
      rev: sealed.rev,
      salt: sealed.kdf.salt,
      dirty: false,
      saving: false,
      again: false,
    });
  };

  /**
   * Bring what is open up to `notes`: open what a held key opens, take in a change made elsewhere
   * (refusing what was typed here if there is any), and close what is no longer a locked note.
   */
  const follow = async (notes: readonly NotesNote[], mine = current()) => {
    const byId = new Map(notes.map((note) => [note.id, note]));
    let changed = false;
    for (const entry of [...mine.open.values()]) {
      const note = byId.get(entry.id);
      if (!note?.sealed) {
        clearTimeout(entry.timer);
        mine.open.delete(entry.id);
        changed = true;
      }
    }
    await Promise.all(
      notes.map(async (note) => {
        const sealed = note.sealed;
        if (!sealed || mine.opening.has(note.id)) return;
        const entry = mine.open.get(note.id);
        if (entry && sealed.rev <= entry.rev) return;
        if (entry?.dirty) {
          entry.refused = true;
          clearTimeout(entry.timer);
          changed = true;
          return;
        }
        if (entry?.refused) return;
        const key = mine.keys.get(sealed.kdf.salt)?.key;
        if (!key) {
          if (entry) {
            // Its password changed elsewhere: it asks for the new one.
            mine.open.delete(note.id);
            changed = true;
          }
          return;
        }
        mine.opening.add(note.id);
        try {
          await openEntry(mine, note, sealed, key);
          changed = true;
        } catch {
          mine.open.delete(note.id);
          changed = true;
        } finally {
          mine.opening.delete(note.id);
        }
      }),
    );
    if (changed) {
      publish(mine);
      if (mine.open.size > 0) watchIdle();
    }
  };

  /** A key for a note, from `password` and the note's own derivation, proved on its envelope. */
  const proveKey = async (
    note: NotesNote,
    sealed: SealedNote,
    password: string,
  ): Promise<CryptoKey | LockResult> => {
    const key = await keyFrom(password, sealed.kdf);
    try {
      await openText(note.id, sealed, key);
    } catch {
      return refusedWith(WRONG_PASSWORD, sealed.hint);
    }
    return key;
  };

  /** Open a locked note with its password, and every note the same password opens, as a Mac does. */
  const unlock = async (id: string, password: string): Promise<LockResult> => {
    const mine = current();
    let stored = await readStored(mine.session);
    if (!stored) return refusedWith(UNREACHABLE);
    const note = stored.notes.find((each) => each.id === id);
    if (!note?.sealed) {
      void refreshNotes();
      return refusedWith(NOTE_GONE);
    }
    const key = await proveKey(note, note.sealed, password);
    if ("ok" in key) return key;
    if (mine !== held) return refusedWith(FORGOTTEN);
    mine.keys.set(note.sealed.kdf.salt, {
      key,
      kdf: note.sealed.kdf,
      ...(note.sealed.hint ? { hint: note.sealed.hint } : undefined),
    });
    // Deriving the key took a while: what opens is what is stored now.
    stored = (await readStored(mine.session)) ?? stored;
    if (mine !== held) return refusedWith(FORGOTTEN);
    await follow(stored.notes, mine);
    void refreshNotes();
    return DONE;
  };

  /**
   * Lock a plain note. With `create`, under a new password; with only `password`, under the password
   * the locked notes already have; with neither, under the key held. The note goes out only once the
   * server holds what this page shows, and the write names the document it read, so what is locked
   * is what the person saw. No text of it is sent.
   */
  const lock = async (
    id: string,
    { password, hint, create = false }: { password?: string; hint?: string; create?: boolean } = {},
  ): Promise<LockResult> => {
    const mine = current();
    let chosen: HeldKey | undefined;
    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      const stored = await readStored(mine.session);
      if (!stored) return refusedWith(UNREACHABLE);
      if (mine !== held) return refusedWith(FORGOTTEN);
      const there = stored.notes.find((note) => note.id === id);
      if (!there) return refusedWith(NOTE_GONE);
      if (there.sealed) return refusedWith(LOCK_MOVED);
      const here = currentNotes()?.notes.find((note) => note.id === id);
      if (!here || !sameText(there, keepable(here))) {
        if (notesUnsaved()) {
          await pause(UNSAVED_WAIT_MS);
          continue;
        }
        void refreshNotes();
        return refusedWith(LOCK_MOVED);
      }
      if (!chosen) {
        const sealedNotes = stored.notes.filter((note) => note.sealed);
        if (create) {
          const kdf = newKdf(iterations);
          if (password === undefined) return refusedWith(WRONG_PASSWORD);
          chosen = { key: await keyFrom(password, kdf), kdf, ...(hint ? { hint } : undefined) };
        } else if (password !== undefined && sealedNotes[0]?.sealed) {
          const first = sealedNotes[0];
          const proved = await proveKey(first, first.sealed as SealedNote, password);
          if ("ok" in proved) return proved;
          const { kdf, hint: kept } = first.sealed as SealedNote;
          chosen = { key: proved, kdf, ...(kept ? { hint: kept } : undefined) };
        } else {
          chosen =
            sealedNotes
              .map((note) => mine.keys.get((note.sealed as SealedNote).kdf.salt))
              .find(Boolean) ?? [...mine.keys.values()].at(-1);
          if (!chosen) return refusedWith(WRONG_PASSWORD);
        }
        if (mine !== held) return refusedWith(FORGOTTEN);
      }
      let sealed: Envelope;
      try {
        sealed = await sealText(id, textOf(there), chosen.key, chosen.kdf, chosen.hint);
      } catch (error) {
        return refusedWith(error instanceof Error ? error.message : TOO_LONG);
      }
      const reply = await sendChanges(mine.session, {
        base: stored.rev,
        changes: [{ id, rev: 0, sealed }],
      });
      if (reply?.status === 409) continue;
      if (!reply?.ok) return refusedWith(await errorOf(reply));
      if (mine !== held) return refusedWith(FORGOTTEN);
      mine.keys.set(chosen.kdf.salt, chosen);
      await refreshNotes();
      return DONE;
    }
    return refusedWith(LOCK_MOVED);
  };

  /** Take the lock off an open note: its text is stored in the clear again. */
  const removeLock = async (id: string): Promise<LockResult> => {
    const mine = current();
    const entry = mine.open.get(id);
    if (!entry) return refusedWith(FORGOTTEN);
    if (entry.refused) return refusedWith(LOCK_CHANGED_ELSEWHERE);
    clearTimeout(entry.timer);
    const { date, edited } = entry;
    const reply = await sendChanges(mine.session, {
      changes: [{ id, rev: entry.rev, plain: textOf(entry.text), date, edited }],
    });
    if (reply?.status === 409) {
      await settleRefused(mine, entry, { lines: [] });
      return refusedWith(LOCK_CHANGED_ELSEWHERE);
    }
    if (!reply?.ok) return refusedWith(await errorOf(reply));
    entry.dirty = false;
    await refreshNotes();
    return DONE;
  };

  /**
   * Every note the old password opens, under the new one, in one write naming every revision. A note
   * under another password stays as it is.
   */
  const changePassword = async (
    oldPassword: string,
    password: string,
    hint?: string,
  ): Promise<LockResult> => {
    const mine = current();
    for (const entry of mine.open.values()) {
      if (entry.dirty && !entry.refused) {
        clearTimeout(entry.timer);
        await save(mine, entry);
      }
    }
    const kdf = newKdf(iterations);
    const key = await keyFrom(password, kdf);
    const oldKeys = new Map<string, CryptoKey>();
    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      const stored = await readStored(mine.session);
      if (!stored) return refusedWith(UNREACHABLE);
      const changes: object[] = [];
      let hintOfOld: string | undefined;
      for (const note of stored.notes) {
        const sealed = note.sealed;
        if (!sealed) continue;
        hintOfOld ??= sealed.hint;
        let old = oldKeys.get(sealed.kdf.salt);
        if (!old) {
          old = await keyFrom(oldPassword, sealed.kdf);
          oldKeys.set(sealed.kdf.salt, old);
        }
        const text = await openText(note.id, sealed, old).catch(() => null);
        if (!text) continue;
        changes.push({
          id: note.id,
          rev: sealed.rev,
          sealed: await sealText(note.id, text, key, kdf, hint),
        });
      }
      if (mine !== held) return refusedWith(FORGOTTEN);
      if (changes.length === 0) return refusedWith(WRONG_PASSWORD, hintOfOld);
      const reply = await sendChanges(mine.session, { changes });
      if (reply?.status === 409) continue;
      if (!reply?.ok) return refusedWith(await errorOf(reply));
      if (mine !== held) return refusedWith(FORGOTTEN);
      const { notes } = (await reply.json()) as { notes: Record<string, number> };
      for (const entry of mine.open.values()) {
        const rev = notes[entry.id];
        if (rev !== undefined) {
          entry.rev = rev;
          entry.salt = kdf.salt;
        }
      }
      mine.keys.clear();
      mine.keys.set(kdf.salt, { key, kdf, ...(hint ? { hint } : undefined) });
      await refreshNotes();
      return DONE;
    }
    return refusedWith(LOCK_MOVED);
  };

  /** The note as stored, in place of what this page typed and was refused. */
  const showLatest = async (id: string): Promise<void> => {
    const mine = current();
    const stored = await readStored(mine.session);
    if (!stored || mine !== held) return;
    const entry = mine.open.get(id);
    const note = stored.notes.find((each) => each.id === id);
    if (!entry) return;
    const sealed = note?.sealed;
    const key = sealed && mine.keys.get(sealed.kdf.salt)?.key;
    const text = note && sealed && key ? await openText(id, sealed, key).catch(() => null) : null;
    if (mine !== held) return;
    if (note && sealed && text) {
      Object.assign(entry, {
        text,
        rev: sealed.rev,
        salt: sealed.kdf.salt,
        date: note.date,
        edited: note.edited,
        refused: false,
        dirty: false,
        generation: entry.generation + 1,
      });
    } else {
      mine.open.delete(id);
    }
    publish(mine);
    void refreshNotes();
  };

  /** What this page typed and was refused, as a new locked note, then the note as stored. */
  const keepCopy = async (note: NotesNote, copyId: string): Promise<LockResult> => {
    const mine = current();
    const entry = mine.open.get(note.id);
    const heldKey = entry && mine.keys.get(entry.salt);
    if (!entry || !heldKey) return refusedWith(FORGOTTEN);
    const { sealed: _sealed, locked: _locked, ...rest } = note;
    const copy = conflictedCopy({ ...rest, ...entry.text }, copyId, note.folder);
    const reply = await sendChanges(mine.session, {
      add: [
        {
          id: copyId,
          folder: note.folder,
          date: entry.date,
          edited: entry.edited,
          ...(note.created === undefined ? undefined : { created: note.created }),
          sealed: await sealText(copyId, copy, heldKey.key, heldKey.kdf, heldKey.hint),
        },
      ],
    });
    if (!reply?.ok) return refusedWith(await errorOf(reply));
    await showLatest(note.id);
    return DONE;
  };

  /** An edit of an open locked note. `false`: `id` isn't one, and the document takes the edit. */
  const edit = (
    id: string,
    lines: string[],
    attachment: boolean,
    picture: string | undefined,
    html: string | undefined,
  ): boolean => {
    const mine = current();
    const entry = mine.open.get(id);
    if (!entry) return false;
    if (entry.refused) return true;
    const text = textOf({
      lines,
      html,
      attachment: attachment ? entry.text.attachment : undefined,
      picture,
    });
    if (sameText(text, entry.text)) return true;
    Object.assign(entry, { text, dirty: true, ...stamp(new Date()) });
    schedule(mine, entry);
    publish(mine);
    return true;
  };

  let windows = 0;
  return {
    view: () => view,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    follow: (notes: readonly NotesNote[]) => void follow(notes),
    unlock,
    lock,
    removeLock,
    changePassword,
    showLatest,
    keepCopy,
    edit,
    closeAll: forget,
    /** Whether a key is held for the locks in `notes`, so that Lock Note asks for nothing. */
    keyHeld: () => current().keys.size > 0,
    /** A Notes window is on the screen; call what it returns when it closes. */
    windowOpened: () => {
      windows += 1;
      return () => {
        windows -= 1;
        if (windows === 0) forget();
      };
    },
  };
}

/** The page's lock. */
export const notesLock = createNotesLock();

const EMPTY_VIEW: LockView = { open: new Map() };

/** What the windows show of the lock. */
export function useNotesLock(): LockView {
  return useSyncExternalStore(notesLock.subscribe, notesLock.view, () => EMPTY_VIEW);
}

/** Whether this build has a server to keep a locked note on. */
export const lockAvailable = () => syncEnabled();

/**
 * `note` as a window shows it: an open locked note with its text. The document's note, with no text,
 * anywhere else. A note refused a save stays `locked`, which makes it read-only.
 */
export function revealNote(view: LockView, note: NotesNote): NotesNote {
  const open = note.sealed && view.open.get(note.id);
  if (!open) return note;
  const {
    sealed: _sealed,
    html: _html,
    attachment: _attachment,
    picture: _picture,
    ...rest
  } = note;
  return {
    ...rest,
    ...open.text,
    date: open.date,
    edited: open.edited,
    locked: open.refused ? true : undefined,
  };
}

/** Whether a note is locked and its text isn't on this page now. */
export const isClosed = (view: LockView, note: NotesNote) =>
  note.sealed !== undefined && !view.open.has(note.id);

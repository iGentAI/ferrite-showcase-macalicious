import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  CHANGED_ELSEWHERE,
  changeHeld,
  NAMES_ITSELF,
  nextWriteId,
  onDesktopSessionChange,
  onReloadServerDocument,
  PERSON_HEADER,
  reportFailure,
  sessionFetch,
  WRITE_HEADER,
  withDeadline,
  writesOf,
} from "./desktop-server";
import { mergeDocuments, sameDocument } from "./document-merge";

/*
 * One document a demo keeps on the macalicious-desktop Ferrite application
 * (`ferrite-apps/desktop`), for Notes, Reminders and Stickies. Only the desktop build made for
 * that application sets `VITE_MACALICIOUS_API` to "1"; anywhere else nothing is fetched.
 *
 * The protocol, the same for the three, and the rule of batch 2's documents:
 *
 * - The server owns an integer revision per document: `GET` answers `{data, rev}` (`rev` 0 and
 *   `data` null before the first save).
 * - A save is `PUT {base, data, ...}`, where `base` is the revision the page last had. The
 *   server stores it only when `base` is still its revision, then answers `{rev}`, one more.
 *   Any other base is answered 409 and nothing is stored.
 * - One save is under way per document at a time, and a save is never given up. Hiding or
 *   closing the page sends nothing of its own (no save on pagehide, no beacon). A change not yet
 *   stored is journaled in the browser's storage as it is made (`writeJournal`), under the person
 *   the server names, and comes back when that person next opens the app on this browser: merged
 *   onto what is stored by then, and saved. Each save names itself, so the next page can ask the
 *   server (Notes, Stickies) whether a save that got no answer was stored after all. Another
 *   person's journal is deleted unread when they open the app here.
 * - When the page's desktop names another session without loading again (signing in as Guest
 *   User), the document is read again from nothing, as on a new page: what was read belonged to
 *   the session before, and no change is made on it. Anything unsent stays in the journal.
 * - Every read and save settles by its deadline (`withDeadline`, `REQUEST_DEADLINE_MS`), the
 *   reading of its answer included: one the server never answers is given up and counts as a
 *   network error. So a hung save neither keeps the document from saving again nor, being a
 *   write under way, holds back the loading of another browser's change (`desktop-live.ts`)
 *   beyond its deadline.
 * - A save that met a network error before any answer is sent once more, the same body on the
 *   same base.
 * - On a 409, or when the outcome is not known (a second network error, a server error, an
 *   answer that cannot be read), the page's unsaved changes are dropped: it reads the stored
 *   document and every window of the app shows it. When two windows edit at the same time, the
 *   later conflicting edit is lost and the window shows the stored version. When the stored
 *   document is the page's own save, stored though its answer never came, nothing is dropped,
 *   and the changes made meanwhile are saved on it.
 * - A body the server refuses as it is (another 4xx) is not sent again; the next change is.
 * - The document is unsaved exactly while the page's copy differs from the stored one.
 * - When the session's document cannot be read, the page never writes: a write replaces the
 *   whole document, and one built on the starting data would replace what the page never saw.
 *
 * Every window of the app reads the page's one copy of the document (`useShown`): a change one
 * window saves is shown in the others, and a document read from the server is shown in all.
 * Two options change the rule for a demo whose windows keep their own state across a rebuild:
 * with `refreshOnRemoteChange`, a change made in another tab or browser of the person reaches the
 * page through `desktop-live.ts`, whose `reloadServerDocuments` reads the document again
 * (`refresh`); with `merge`, the page's unsaved changes are not dropped when the stored document
 * moved on (a 409, or that read): they are merged onto it and saved on its revision. A
 * window is keyed on `useAdoptionKey`, so it is built again from each document it adopts and
 * none of its own state (drafts, collapse, a refused edit) outlives one.
 */

export interface SyncedDocumentOptions<D> {
  /** The document's address, `/api/<demo>/data`. */
  url: string;
  /** Whether a stored document is one the page can use: its whole shape is checked. */
  isDocument: (data: unknown) => data is D;
  /** Fields sent beside `base` and `data`, worked out from the document. */
  extra?: (data: D) => Record<string, unknown>;
  /** How many times a read is tried, and how long apart, in milliseconds. */
  readAttempts?: number;
  readDelay?: number;
  /**
   * Read the stored document again when another tab or browser of the person changes it
   * (`desktop-live.ts` calls `reloadServerDocuments`), and show it in every window. A window keyed
   * on `useAdoptionKey` is built again from it, so only a demo whose windows keep what they need
   * across that (the selection, a draft) sets it.
   * @default false
   */
  refreshOnRemoteChange?: boolean;
  /**
   * How the page's unsaved changes meet a stored document that moved on: given the stored document
   * they were made on (`base`), the page's (`mine`) and the stored one now (`theirs`), the
   * document the page keeps and saves on the new revision. Without it the page's changes are
   * dropped and the stored document is shown, as the rule above says. A document forgotten on the
   * server (none stored) is never merged back: it stays forgotten.
   */
  merge?: (base: D | null, mine: D, theirs: D) => D;
}

/** The page's copy of the document, and the window whose change it is (`null`: the server's). */
export interface Shown<D> {
  data: D | null;
  origin: object | null;
  /** Counts the copies shown on the page: a new number for each. */
  seq: number;
}

export interface SyncedDocument<D> {
  /** Whether this build talks to the Ferrite application's API. */
  enabled: () => boolean;
  /** Whether the session's document was read: until then, and when it cannot be, nothing is written. */
  readable: () => boolean;
  /** Read the session's document once per page: `null` when none is saved or it is unreadable. */
  load: () => Promise<D | null>;
  /**
   * For a component: `undefined` while the document is read, then the page's copy, a new
   * object each time a window changes it or it is read from the server.
   */
  useShown: () => Shown<D> | undefined;
  /** The page's copy and its origin, outside React: `undefined` until the document is read. */
  shown: () => Shown<D> | undefined;
  /**
   * For the window `origin`: a key that changes each time the window is given a document it did
   * not make itself (the stored one read again, or another window's change). A window keyed on
   * it is built again from that document, so nothing of the window's own outlives it.
   */
  useAdoptionKey: (shown: Shown<D> | undefined, origin: object) => string;
  /** For a component: `undefined` while the document is read, then the page's copy. */
  useDocument: () => D | null | undefined;
  /** The document as the page holds it now, its unsaved changes included. */
  current: () => D | null;
  /**
   * Save the whole document as the window `origin` shows it. The other windows are given it to
   * show; the window that made it already does.
   */
  save: (next: D, origin?: object) => void;
  /** Apply a change to the page's copy as it is now, and save the result. */
  update: (change: (document: D | null) => D, origin?: object) => void;
  /** Read the stored document again and show it, when no change of this page waits. */
  refresh: () => Promise<void>;
  /** Whether the page's copy differs from the stored document. */
  useUnsaved: () => boolean;
  /** Whether the page's copy differs from the stored document, outside React. */
  unsaved: () => boolean;
}

const READ_ATTEMPTS = 3;
const READ_DELAY = 1000;
const SAVE_DELAY = 300;
/** How long a save waits before its one retry after a network error. */
const RETRY_DELAY = 1000;
/**
 * How many refusals in a row a merged change meets before it waits, unsaved, for the next change
 * (a document that keeps changing elsewhere, or a server that refuses every save).
 */
const MAX_CONFLICTS = 4;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** What a build that does not talk to the API shows: nothing saved. */
const OFF: Shown<never> = { data: null, origin: null, seq: 0 };
const isRevision = (rev: unknown): rev is number =>
  Number.isSafeInteger(rev) && (rev as number) >= 0;

/** A tag for this page, so that records two pages create never share an id. */
const PAGE_TAG =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
/** Counts the tags given on this page, so that two windows of one page never share one either. */
let tags = 0;

/**
 * What goes in a new record's id, between its prefix and its number, so that no two windows
 * make the same id: `""` where nothing is saved (ids then stay as short as before), and in the
 * build that saves to the Ferrite application this page's tag and a number new at each call.
 */
export function recordTag(): string {
  if (import.meta.env.VITE_MACALICIOUS_API !== "1") return "";
  tags += 1;
  return `${PAGE_TAG}-${tags}-`;
}

/** Starts every journal key: `<prefix><person>\n<url>\n<page>`. */
const JOURNAL = "macalicious-unsent:";

/** A change not yet stored, as the page that made it left it. */
interface JournalEntry<D> {
  /** The stored document it was made on, and that document's revision. */
  base: D | null;
  rev: number;
  data: D;
  /** The body last sent with no answer: the server may hold it, and `data` be a change of it. */
  sent: { write: string; data: D } | null;
}

/** Counts this page's documents, each with a journal entry of its own. */
let journals = 0;

/** Whether a save was refused on its first attempt, so that it is known not to be stored. */
const response409First = (answer: { response: Response } | undefined, retried: boolean) =>
  !retried && answer?.response.status === 409;

/** The browser's storage, where a page has any. */
function journalStore(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function createSyncedDocument<D>(options: SyncedDocumentOptions<D>): SyncedDocument<D> {
  const { url, isDocument, extra, merge } = options;
  const readAttempts = options.readAttempts ?? READ_ATTEMPTS;
  const readDelay = options.readDelay ?? READ_DELAY;
  const enabled = () => import.meta.env.VITE_MACALICIOUS_API === "1";

  /** The server's revision as the page last had it, and the document stored under it. */
  let rev = 0;
  let stored: D | null = null;
  /** The document the windows show: `stored` and the changes made since. */
  let local: D | null = null;
  let loading: Promise<D | null> | undefined;
  /** Whether the document was read. Until then, and for good when it cannot be, nothing is written. */
  let readable = false;
  let inflight = false;
  /** Set when the page's revision may be out of date: the document is read before anything is sent. */
  let stale = false;
  let reading: Promise<void> | undefined;
  /** A body refused as it is: not sent again until the document changes. */
  let refusedText: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Refusals in a row of the page's changes since it last saved or changed (`MAX_CONFLICTS`). */
  let conflicts = 0;
  /** Counts every change to the page's copy or its revision: a read started before one is stale. */
  let version = 0;

  /** Counts the sessions this page's copy has been read for: a reply to an earlier one is ignored. */
  let generation = 0;

  let shown: Shown<D> | undefined;
  let seq = 0;
  const shownListeners = new Set<() => void>();
  const show = (data: D | null, origin: object | null) => {
    seq += 1;
    shown = { data, origin, seq };
    for (const listener of shownListeners) listener();
  };

  /** Unsaved is nothing but this: the page's copy is not the stored document. */
  let isUnsaved = false;
  const unsavedListeners = new Set<() => void>();
  /** The body sent last whose outcome is not known, with the name it was sent under. */
  let lastSent: { write: string; data: D } | null = null;
  /** Whose document this is, as the server named it; nothing is journaled while it has not. */
  let person: string | null = null;
  /**
   * The last person named, whose the page's copy is: a reply that names nobody stops the journal
   * and says nothing of who the next one is for.
   */
  let holder: string | null = null;
  /** Whether the last read found the document is another person's now. */
  let ownerMoved = false;
  /** Whether the journal's last write failed, which the person is told of once. */
  let journalFailing = false;
  /** The writes the last read said the stored document holds. */
  let writes: ReturnType<typeof writesOf> = null;
  journals += 1;
  /** A key of this page's, given up when what it holds must outlive the page's copy. */
  const newJournalTag = () => {
    journals += 1;
    return `${PAGE_TAG}-${journals}`;
  };
  let journalTag = newJournalTag();
  /** Whether a document was stored when the page last looked. */
  let heldDocument = false;
  /** Whether this page has taken up what closed pages left: once, for the first person named. */
  let tookUpJournal = false;
  const journalKey = () => `${JOURNAL}${person}\n${url}\n${journalTag}`;
  /**
   * The page's copy as it stands, kept for the next page while it differs from the stored one, or
   * while a save with no answer may have left the server holding something else. An entry that
   * cannot be replaced (the browser's storage is full) stays: the older changes it holds are all
   * the next page would have, and the person is told the newest are not kept.
   */
  const writeJournal = (unsaved: boolean) => {
    const store = journalStore();
    if (!store || person === null) return;
    try {
      if ((!unsaved && lastSent === null) || local === null) {
        store.removeItem(journalKey());
      } else {
        const entry: JournalEntry<D> = { base: stored, rev, data: local, sent: lastSent };
        store.setItem(journalKey(), JSON.stringify(entry));
      }
      journalFailing = false;
    } catch {
      if (journalFailing) return;
      journalFailing = true;
      reportFailure({ url, reason: "this browser could not keep the latest unsent changes" });
    }
  };
  /**
   * What a change was made on, given the body a page sent with no answer, the document and revision
   * it had then, and the document stored now: that body when the server holds it, so that nothing
   * deleted on top of it comes back, and otherwise the document it had, so that the change is merged
   * and saved again. Where the server keeps no list covering that revision, the revision is all
   * there is: one write since that left another document was someone else's, and after two or more
   * the body may lie under them, so it counts as stored, whatever the document looks like now. It
   * may never have arrived, so the person is told when the document does not hold it.
   */
  const madeOnSent = (
    sent: { write: string; data: D } | null,
    base: D | null,
    baseRev: number,
    now: D | null,
    nowRev: number,
  ): D | null => {
    if (!sent) return base;
    const covered = writes !== null && baseRev >= writes.from;
    const held = covered
      ? writes?.ids.has(sent.write) === true
      : sameDocument(now, sent.data) || nowRev >= baseRev + 2;
    if (!held) return base;
    if (!covered && !changeHeld(base, sent.data, now)) {
      reportFailure({ url, reason: CHANGED_ELSEWHERE });
    }
    return sent.data;
  };
  /** What this person's closed pages left of this document; another person's is deleted unread. */
  const readJournal = (): { key: string; entry: JournalEntry<D> }[] => {
    const store = journalStore();
    if (!store || person === null) return [];
    const found: { key: string; entry: JournalEntry<D> }[] = [];
    const keys = Array.from({ length: store.length }, (_, index) => store.key(index));
    for (const key of keys) {
      if (!key?.startsWith(JOURNAL) || key.split("\n")[1] !== url) continue;
      try {
        if (!key.startsWith(`${JOURNAL}${person}\n`)) {
          store.removeItem(key);
          continue;
        }
        const text = store.getItem(key);
        const entry = text !== null ? (JSON.parse(text) as JournalEntry<D>) : null;
        if (entry && isDocument(entry.data) && (entry.base === null || isDocument(entry.base))) {
          found.push({ key, entry });
        } else {
          store.removeItem(key);
        }
      } catch {
        // An entry that cannot be read is no change to bring back.
        store.removeItem(key);
      }
    }
    return found;
  };
  /** How a change left by a closed page meets the document, in a demo with no merge of its own. */
  const mergeUnsent =
    merge ??
    ((was: D | null, mine: D, theirs: D) =>
      mergeDocuments(was as object | null, mine as object, theirs as object) as D);
  /**
   * The changes closed pages left, applied to the document just read (`madeOnSent`), and noted in
   * `applied`. One whose merge failed is not among them: it stays for the next time the app opens.
   */
  const applyJournal = () => {
    for (const { key, entry } of readJournal()) {
      const was = madeOnSent(entry.sent, entry.base, entry.rev, stored, rev);
      if (stored === null && was !== null && !sameDocument(entry.data, was)) {
        // Deleted elsewhere: nothing is put back, and this entry is all that is left of what was
        // typed, so it stays. The person is told each time the app opens.
        reportFailure({ url, reason: CHANGED_ELSEWHERE });
        continue;
      }
      try {
        if (!sameDocument(entry.data, was)) {
          local = local !== null ? mergeUnsent(was, entry.data, local) : entry.data;
          recovered = true;
        }
        applied.push(key);
      } catch (error) {
        console.error(error);
      }
    }
  };
  /** Takes up what closed pages left, when a read first names the person. */
  const recoverJournal = () => {
    if (!readable || person === null || tookUpJournal) return;
    tookUpJournal = true;
    applyJournal();
  };
  /**
   * Entries of closed pages that are in the page's copy (`applyJournal`), and whether that copy has
   * not been stored since: such changes are merged whether or not the demo merges, as nothing else
   * keeps them.
   */
  let applied: string[] = [];
  let recovered = false;
  /** How the page's unsaved changes meet a document that moved on, when they are kept at all. */
  const reconcile = () => merge ?? (recovered ? mergeUnsent : undefined);
  /**
   * Lets go of the entries applied, once the page's copy is the stored document or this page's own
   * entry holds it: until then they are all the browser has of those changes. A page closed in
   * between leaves both, and applying a change twice comes to the same document.
   */
  const releaseApplied = (unsaved: boolean) => {
    const store = journalStore();
    if (!store || applied.length === 0) return;
    try {
      if (unsaved && (journalFailing || store.getItem(journalKey()) === null)) return;
      for (const key of applied) store.removeItem(key);
      applied = [];
    } catch {
      // Storage that refuses keeps the entries, which come to nothing the next time.
    }
  };
  const updateUnsaved = () => {
    // In any order of fields: the server writes a record in its own order.
    const value = !sameDocument(local, stored);
    if (local === null && isUnsaved && !ownerMoved) {
      // The stored document went, or a first save was not stored: nothing is put back, and the
      // entries are all that is left of what was typed, so they stay, and this page writes under a
      // key of its own from now. Only the first is someone else's doing, to be told of.
      journalTag = newJournalTag();
      applied = [];
      if (heldDocument) reportFailure({ url, reason: CHANGED_ELSEWHERE });
    } else {
      writeJournal(value);
      releaseApplied(value);
    }
    if (!value) recovered = false;
    heldDocument = stored !== null;
    if (isUnsaved === value) return;
    isUnsaved = value;
    for (const listener of unsavedListeners) listener();
  };

  /** One `GET`: the stored document, its revision and whose it is, or `undefined` when unanswered or invalid. */
  async function readOnce(): Promise<
    | {
        data: D | null;
        rev: number;
        owner: string | null;
        listed: ReturnType<typeof writesOf>;
      }
    | undefined
  > {
    // Through the page's session gate: a fresh browser's loads must not each start a session.
    // A reply that never comes, or never finishes, is no read once the deadline has passed.
    const reply = await withDeadline(async (signal) => {
      const response = await sessionFetch(url, {
        credentials: "same-origin",
        headers: { accept: "application/json", ...NAMES_ITSELF },
        signal,
      });
      if (!response.ok) return undefined;
      // A body cut short, garbled or of another shape is no read.
      const body = (await response.json().catch(() => undefined)) as
        | { data?: unknown; rev?: unknown }
        | undefined;
      return {
        body,
        owner: response.headers?.get(PERSON_HEADER) ?? null,
        listed: writesOf(response),
      };
    }).catch(() => undefined);
    const body = reply?.body;
    if (!reply || typeof body !== "object" || body === null || !isRevision(body.rev)) {
      return undefined;
    }
    if (body.data !== null && !isDocument(body.data)) return undefined;
    return { data: body.data, rev: body.rev, owner: reply.owner, listed: reply.listed };
  }

  /**
   * A read the page accepts: whose the document is and which writes it holds count from here, and
   * never from a reply that was no read or that something newer has overtaken.
   */
  const acceptRead = (answer: { owner: string | null; listed: ReturnType<typeof writesOf> }) => {
    writes = answer.listed;
    ownerMoved = holder !== null && answer.owner !== null && answer.owner !== holder;
    if (answer.owner !== null) holder = answer.owner;
    if (ownerMoved) {
      // Another person's document now: nothing of the one before is shown, merged or saved. What
      // that person's page journaled stays under their name.
      clearTimeout(timer);
      local = null;
      stored = null;
      lastSent = null;
      refusedText = undefined;
      applied = [];
      recovered = false;
      // What this page wrote stays that person's, as a closed page's would.
      journalTag = newJournalTag();
    }
    person = answer.owner;
  };

  /**
   * What the page's unsaved changes were made on, given the stored document just read
   * (`madeOnSent`). The save with no answer is settled by it.
   */
  const madeOn = (now: D | null, nowRev: number): D | null => {
    const sent = lastSent;
    lastSent = null;
    return madeOnSent(sent, stored, rev, now, nowRev);
  };

  /**
   * Read the stored document, up to `readAttempts` times: whether it was read, and `"kept"` when
   * the stored document is `sent`, a save of this page's whose answer never came: the page's copy,
   * with the changes made since, then stays.
   */
  async function read(sent?: D): Promise<boolean | "kept"> {
    const started = generation;
    for (let attempt = 1; ; attempt += 1) {
      const answer = await readOnce();
      if (started !== generation) return false;
      if (answer) {
        acceptRead(answer);
        version += 1;
        const base = madeOn(answer.data, answer.rev);
        rev = answer.rev;
        stored = answer.data;
        // In any order of fields: the server writes a record in its own order.
        const kept = !ownerMoved && sent !== undefined && sameDocument(answer.data, sent);
        if (!kept) {
          // The page's unsaved changes, merged onto the stored document when the demo merges or
          // they came from a closed page; otherwise dropped.
          const mine = local;
          const combine = reconcile();
          local =
            combine &&
            mine !== null &&
            answer.data !== null &&
            readable &&
            !sameDocument(mine, base)
              ? combine(base, mine, answer.data)
              : answer.data;
        }
        recoverJournal();
        updateUnsaved();
        return kept ? "kept" : true;
      }
      if (attempt >= readAttempts) return false;
      await new Promise((resolve) => setTimeout(resolve, readDelay));
      if (started !== generation) return false;
    }
  }

  /** Whether the document follows other tabs' and browsers' changes (`refreshOnRemoteChange`). */
  let following = false;

  function load(): Promise<D | null> {
    // Outside the Ferrite application's build nothing is fetched.
    if (!enabled()) return Promise.resolve(null);
    if (options.refreshOnRemoteChange && !following) {
      following = true;
      onReloadServerDocument(url, () => void refresh());
    }
    if (!listening) {
      listening = true;
      // After the render that named the session: this tells the windows what to show.
      onDesktopSessionChange(() => queueMicrotask(startOver));
    }
    const started = generation;
    loading ??= read().then((ok) => {
      if (started !== generation) return null;
      readable = ok !== false;
      if (readable) {
        recoverJournal();
        updateUnsaved();
        if (!sameDocument(local, stored)) schedule(0);
      }
      show(ok ? local : null, null);
      return ok ? local : null;
    });
    return loading.then(() => (readable ? local : null));
  }

  /** Whether this document hears of the session changing. */
  let listening = false;
  /**
   * Back to before the first read, and read again, for the session the page names now. What the
   * old copy had unsent stays in the journal, under a key this page no longer writes, and comes
   * back like a closed page's if the same person is behind the new session.
   */
  function startOver() {
    generation += 1;
    version += 1;
    clearTimeout(timer);
    journalTag = newJournalTag();
    rev = 0;
    stored = null;
    local = null;
    loading = undefined;
    reading = undefined;
    readable = false;
    inflight = false;
    stale = false;
    refusedText = undefined;
    conflicts = 0;
    lastSent = null;
    person = null;
    holder = null;
    ownerMoved = false;
    writes = null;
    applied = [];
    recovered = false;
    heldDocument = false;
    tookUpJournal = false;
    shown = undefined;
    for (const listener of shownListeners) listener();
    if (isUnsaved) {
      isUnsaved = false;
      for (const listener of unsavedListeners) listener();
    }
    void load();
  }

  /**
   * Drop the page's unsaved changes and show the stored document in every window. While it
   * cannot be read nothing is sent; the next change tries again. When the stored document is
   * `sent`, a save of the page's that was stored though its answer never came, nothing is
   * dropped: the changes made since are saved on it.
   */
  function reload(sent?: D): Promise<void> {
    stale = true;
    clearTimeout(timer);
    const started = generation;
    reading ??= read(sent)
      .then((ok) => {
        // Unread, the page's copy stays as it is, and unsaved.
        if (!ok) return;
        stale = false;
        refusedText = undefined;
        if (ok === "kept") {
          if (!sameDocument(local, stored)) schedule(0);
          return;
        }
        show(local, null);
        // Merged changes of the page's are saved on the revision just read, unless the server has
        // refused them again and again: they then wait, unsaved, for the next change.
        if (!sameDocument(local, stored) && conflicts < MAX_CONFLICTS) {
          schedule(conflicts > 1 ? RETRY_DELAY : 0);
        }
      })
      .finally(() => {
        if (started === generation) reading = undefined;
      });
    return reading;
  }

  function schedule(delay: number) {
    clearTimeout(timer);
    timer = setTimeout(() => void send(), delay);
  }

  /** One `PUT` and the reading of its answer, settled by the deadline: a hung save is an error. */
  const put = (text: string, write: string, owner: string | null) =>
    withDeadline(async (signal) => {
      const response = await sessionFetch(url, {
        method: "PUT",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          [WRITE_HEADER]: write,
          // The server refuses it for anyone but the person whose copy this is.
          ...(owner === null ? {} : { [PERSON_HEADER]: owner }),
        },
        body: text,
        signal,
      });
      const body = response.ok
        ? ((await response.json().catch(() => null)) as { rev?: unknown } | null)
        : null;
      return { response, body };
    });

  /** Send the page's document on the revision the page has, when it differs from what is stored. */
  async function send() {
    if (inflight || !readable || local === null) return;
    // Whose this is has not been said since the last read: nothing is sent, so the journal entry
    // stays true, until a read says it again or the next change tries. A server that has never
    // named anyone predates the header: it saves as it always did, and nothing is journaled.
    if (holder !== null && person === null) return;
    if (stale) {
      await reload();
      return;
    }
    if (sameDocument(local, stored)) {
      refusedText = undefined;
      return;
    }
    const data = local;
    const text = JSON.stringify({ ...extra?.(data), base: rev, data });
    if (text === refusedText) return;
    inflight = true;
    const started = generation;
    const owner = holder;
    const write = nextWriteId();
    lastSent = { write, data };
    writeJournal(true);
    let answer: Awaited<ReturnType<typeof put>> | undefined;
    let retried = false;
    try {
      try {
        answer = await put(text, write, owner);
      } catch {
        // A network error, or no answer by the deadline: the same body on the same base, once.
        // Stored the first time after all, it is refused (409) the second, and the stored
        // document is read.
        retried = true;
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        // Another session's copy by now: this body is not for the person behind that one.
        if (started !== generation) return;
        answer = await put(text, write, owner).catch(() => undefined);
      }
      // Another session's copy by now: this answer says nothing of it.
      if (started !== generation) return;
      const response = answer?.response;
      const body = answer?.body ?? null;
      if (response?.ok && isRevision(body?.rev)) {
        version += 1;
        lastSent = null;
        rev = body.rev;
        stored = data;
        refusedText = undefined;
        conflicts = 0;
        updateUnsaved();
        if (!same(local, stored)) schedule(0);
        return;
      }
      // A refusal of the first attempt says it was not stored. One of the retry says nothing of the
      // attempt before it: that outcome is not known, and is settled by a read below.
      if (
        !retried &&
        response &&
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 409
      ) {
        // Refused as it is (past the server's limits): sending it again changes nothing, but a
        // change made since is sent. The page's copy stays unsaved.
        lastSent = null;
        refusedText = text;
        updateUnsaved();
        if (!same(local, data)) schedule(0);
        return;
      }
    } finally {
      if (started === generation) inflight = false;
    }
    // A 409, or an outcome that is not known: the stored document is read and shown, unless it is
    // this save's after all. A first attempt refused was not stored: only a retry can meet itself.
    if (response409First(answer, retried)) {
      lastSent = null;
      writeJournal(true);
    }
    conflicts += 1;
    await reload(data);
  }

  /**
   * Read the stored document again and show it, when no change of this page waits. With `merge`,
   * a change of the page's that waits (not yet sent) is merged onto what is read, and saved on its
   * revision; a save under way, or a read already started, settles it instead.
   */
  async function refresh() {
    const settled = () =>
      readable && !inflight && !stale && (reconcile() !== undefined || same(local, stored));
    if (!enabled() || !settled()) return;
    const started = version;
    const answer = await readOnce();
    // A change, a save, a reload or another refresh that came in meanwhile decides instead.
    if (!answer || version !== started || !settled()) return;
    acceptRead(answer);
    version += 1;
    const base = madeOn(answer.data, answer.rev);
    rev = answer.rev;
    stored = answer.data;
    const mine = local;
    const combine = reconcile();
    const before = local;
    local =
      combine && mine !== null && answer.data !== null && !sameDocument(mine, base)
        ? combine(base, mine, answer.data)
        : answer.data;
    recoverJournal();
    updateUnsaved();
    if (ownerMoved || !same(local, before)) show(local, null);
    // Merged changes of the page's, or one held back while nobody was named, are saved on the
    // revision just read.
    if (!sameDocument(local, stored)) schedule(SAVE_DELAY);
  }

  if (typeof window !== "undefined" && enabled()) void load();

  function useShown(): Shown<D> | undefined {
    const on = enabled();
    const value = useSyncExternalStore(
      (listener) => {
        shownListeners.add(listener);
        return () => shownListeners.delete(listener);
      },
      () => shown,
      () => undefined,
    );
    useEffect(() => {
      if (on) void load();
    }, [on]);
    return on ? value : OFF;
  }

  function save(next: D, origin?: object) {
    if (!enabled() || !readable || same(next, local)) return;
    version += 1;
    conflicts = 0;
    local = next;
    updateUnsaved();
    show(local, origin ?? null);
    schedule(SAVE_DELAY);
  }

  function useAdoptionKey(value: Shown<D> | undefined, origin: object): string {
    // The number of the last copy this window did not make; its own changes keep the key.
    const last = useRef(0);
    if (value && value.origin !== origin) last.current = value.seq;
    return `${url}:${last.current}`;
  }

  return {
    enabled,
    readable: () => readable,
    load,
    useShown,
    shown: () => shown,
    useAdoptionKey,
    useDocument() {
      const value = useShown();
      return value === undefined ? undefined : value.data;
    },
    current: () => local,
    save,
    update(change, origin) {
      if (!enabled() || !readable) return;
      save(change(local), origin);
    },
    refresh,
    useUnsaved() {
      return useSyncExternalStore(
        (listener) => {
          unsavedListeners.add(listener);
          return () => unsavedListeners.delete(listener);
        },
        () => isUnsaved,
        () => false,
      );
    },
    unsaved: () => isUnsaved,
  };
}

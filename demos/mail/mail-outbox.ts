/*
 * Take All Accounts Offline, in this browser: whether the person is offline (localStorage, read at
 * once and seen by every tab), the messages waiting in the Outbox and a copy of the mailboxes as they
 * stood, so a reload offline shows them without asking the server (both IndexedDB, for their size).
 * All of it is by account: another person signing in on this browser sees none of it. The copy of the
 * mailboxes goes when no one is signed in (`forgetSnapshots`); the Outbox stays, being all there is
 * of those messages.
 *
 * Also the draft a page could not send on its way out: larger than a request that outlives the page
 * may be, it is kept in localStorage, which is written before the page goes, and saved on the next
 * start.
 */

import type { SentContent } from "./mail-send-keys";

/** What `POST /api/mail/send` is given. */
export interface OutgoingBody extends SentContent {
  bcc?: readonly string[];
  reply_to?: string;
  priority?: string;
  draft?: string;
}

/** A message waiting to be sent, under the idempotency key it is sent with whatever happens. */
export interface OutboxEntry {
  key: string;
  at: number;
  body: OutgoingBody;
  /** Why the last try did not send it. */
  error?: string;
}

interface KeptEntry extends OutboxEntry {
  name: string;
  me: string;
}

/** The mailboxes as this browser last held them. */
export interface MailSnapshot<Header, Body, Mailbox> {
  headers: readonly Header[];
  bodies: readonly (readonly [string, Body])[];
  mailboxes: readonly Mailbox[];
}

const DATABASE = "macalicious.mail.outbox";
const ENTRIES = "entries";
const SNAPSHOTS = "snapshots";
const OFFLINE = "macalicious.mail.offline/";
const LEAVING = "macalicious.mail.leaving/";
const CHANNEL = "macalicious.mail.outbox";

const listeners = new Set<() => void>();
const tell = () => {
  for (const listener of listeners) listener();
};
let channel: BroadcastChannel | null | undefined;
/** Opened on first use: one opened on import keeps Node, which renders the docs, from exiting. */
function outboxChannel(): BroadcastChannel | null {
  if (channel === undefined) {
    channel = typeof BroadcastChannel === "function" ? new BroadcastChannel(CHANNEL) : null;
    if (channel) channel.onmessage = tell;
  }
  return channel;
}
const changed = () => {
  tell();
  outboxChannel()?.postMessage("changed");
};

/** `listener` is called when the Outbox or the offline state changes, in any tab. */
export function onOutboxChange(listener: () => void): () => void {
  listeners.add(listener);
  outboxChannel();
  const stored = (event: StorageEvent) => {
    if (event.key?.startsWith(OFFLINE)) listener();
  };
  window.addEventListener("storage", stored);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", stored);
  };
}

export function isOffline(me: string): boolean {
  try {
    return window.localStorage.getItem(OFFLINE + encodeURIComponent(me)) === "1";
  } catch {
    return false;
  }
}

export function setOffline(me: string, offline: boolean): void {
  const name = OFFLINE + encodeURIComponent(me);
  if (offline) window.localStorage.setItem(name, "1");
  else window.localStorage.removeItem(name);
  changed();
}

function openStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(DATABASE, 1);
    opening.onupgradeneeded = () => {
      opening.result.createObjectStore(ENTRIES, { keyPath: "name" });
      opening.result.createObjectStore(SNAPSHOTS, { keyPath: "me" });
    };
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error);
  });
}

/** Runs `work` in one transaction, and answers once that transaction has committed. */
async function inStore<T>(
  store: string,
  mode: IDBTransactionMode,
  work: (records: IDBObjectStore) => IDBRequest<T> | undefined,
): Promise<T | undefined> {
  const database = await openStore();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const transaction = database.transaction(store, mode);
      const request = work(transaction.objectStore(store));
      transaction.oncomplete = () => resolve(request?.result);
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

const entryName = (me: string, key: string) => `${encodeURIComponent(me)}/${key}`;

/**
 * Keeps a message in the Outbox, oldest first when read back. The same key replaces what it had, so
 * the same message sent twice waits once. Rejects when this browser cannot store it.
 */
export async function keepInOutbox(me: string, entry: OutboxEntry): Promise<void> {
  await inStore(ENTRIES, "readwrite", (records) =>
    records.put({ ...entry, name: entryName(me, entry.key), me } satisfies KeptEntry),
  );
  changed();
}

/** The person's Outbox, oldest first; empty when this browser cannot read it. */
export async function readOutbox(me: string): Promise<readonly OutboxEntry[]> {
  const start = `${encodeURIComponent(me)}/`;
  try {
    const all = await inStore<KeptEntry[]>(ENTRIES, "readonly", (records) =>
      records.getAll(IDBKeyRange.bound(start, `${start}\uffff`)),
    );
    return (all ?? [])
      .map(({ key, at, body, error }) => ({ key, at, body, ...(error ? { error } : {}) }))
      .sort((a, b) => a.at - b.at);
  } catch {
    return [];
  }
}

export async function dropFromOutbox(me: string, key: string): Promise<void> {
  await inStore(ENTRIES, "readwrite", (records) => records.delete(entryName(me, key)));
  changed();
}

/** Writes what this browser holds of the mailboxes; a browser that cannot simply keeps none. */
export async function keepSnapshot<Header, Body, Mailbox>(
  me: string,
  snapshot: MailSnapshot<Header, Body, Mailbox>,
): Promise<void> {
  try {
    await inStore(SNAPSHOTS, "readwrite", (records) => records.put({ me, ...snapshot }));
  } catch {
    // A reload offline then shows no messages, and says it is offline.
  }
}

export async function readSnapshot<Header, Body, Mailbox>(
  me: string,
): Promise<MailSnapshot<Header, Body, Mailbox> | null> {
  try {
    const kept = await inStore<MailSnapshot<Header, Body, Mailbox>>(
      SNAPSHOTS,
      "readonly",
      (records) => records.get(me),
    );
    return kept ?? null;
  } catch {
    return null;
  }
}

export async function dropSnapshot(me: string): Promise<void> {
  try {
    await inStore(SNAPSHOTS, "readwrite", (records) => records.delete(me));
  } catch {
    // Replaced by the next copy.
  }
}

/**
 * Forgets every person's copy of their mailboxes in this browser, once no one is signed in. The
 * server holds all of it. The Outbox stays: what waits there exists nowhere else.
 */
export async function forgetSnapshots(): Promise<void> {
  try {
    await inStore(SNAPSHOTS, "readwrite", (records) => records.clear());
  } catch {
    // A browser that cannot open the store holds no copy to forget.
  }
}

/** A draft saved on the way out of the page, too large for a request that outlives it. */
export interface LeavingDraft {
  key: string;
  body: unknown;
}

/** Whether it could be kept: the browser's quota can refuse. */
export function keepLeavingDraft(me: string, draft: LeavingDraft): boolean {
  try {
    window.localStorage.setItem(LEAVING + encodeURIComponent(me), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function leavingDraft(me: string): LeavingDraft | null {
  try {
    const kept: unknown = JSON.parse(
      window.localStorage.getItem(LEAVING + encodeURIComponent(me)) ?? "null",
    );
    const key = (kept as { key?: unknown } | null)?.key;
    return typeof key === "string" ? (kept as LeavingDraft) : null;
  } catch {
    return null;
  }
}

export function forgetLeavingDraft(me: string): void {
  try {
    window.localStorage.removeItem(LEAVING + encodeURIComponent(me));
  } catch {
    // Nothing kept, then.
  }
}

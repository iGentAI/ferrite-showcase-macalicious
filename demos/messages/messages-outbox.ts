/*
 * Messages a person sent that the server has not yet taken, kept in this browser so that closing or
 * reloading the window does not lose them. Each keeps its idempotency key: sent again after a
 * reload, a message the server already stored is recognised, not added twice. Each message is a
 * record of its own, under the account's name, so two windows of a browser writing at once cannot
 * overwrite each other's. A message waits until it is delivered; only one the server refused is
 * dropped, after a month.
 */

/** A message on its way to a conversation. */
export interface OutboxEntry {
  conversation: string;
  key: string;
  text: string;
  at: string;
  replyTo?: number;
  /** The files it carries, already uploaded. */
  attachments?: string[];
  failed?: boolean;
  /** The server said no: it waits for Try Again, even after a reload. */
  refused?: boolean;
  /** When it was written (epoch ms). */
  written: number;
}

const REFUSED_KEEP_MS = 30 * 86_400_000;
const prefix = (me: string) => `macalicious.messages.outbox.${me}.`;

const isEntry = (value: unknown): value is OutboxEntry => {
  const entry = value as OutboxEntry | null;
  return (
    typeof entry === "object" &&
    entry !== null &&
    typeof entry.conversation === "string" &&
    typeof entry.key === "string" &&
    typeof entry.text === "string" &&
    typeof entry.at === "string" &&
    typeof entry.written === "number"
  );
};

/** What is waiting for the account `me`, oldest first. */
export function readOutbox(me: string, now = Date.now()): OutboxEntry[] {
  const out: OutboxEntry[] = [];
  try {
    const { localStorage: storage } = window;
    for (let at = storage.length - 1; at >= 0; at -= 1) {
      const name = storage.key(at);
      if (!name?.startsWith(prefix(me))) continue;
      let entry: unknown = null;
      try {
        entry = JSON.parse(storage.getItem(name) ?? "null");
      } catch {
        // Not a record of this module's: left out.
      }
      if (!isEntry(entry)) continue;
      if (entry.refused && now - entry.written >= REFUSED_KEEP_MS) storage.removeItem(name);
      else out.push(entry);
    }
  } catch {
    return out;
  }
  return out.sort((a, b) => a.written - b.written);
}

/**
 * Write this window's entries, and remove those of `known`, every key the window has held, that it
 * no longer holds. Another window's records stay. False when storage refused one (full, or turned
 * off): that message is kept in the window only, and the window says so.
 */
export function writeOutbox(
  me: string,
  mine: readonly OutboxEntry[],
  known: ReadonlySet<string>,
): boolean {
  try {
    const held = new Set(mine.map((entry) => entry.key));
    for (const key of known) if (!held.has(key)) window.localStorage.removeItem(prefix(me) + key);
    for (const entry of mine) {
      window.localStorage.setItem(prefix(me) + entry.key, JSON.stringify(entry));
    }
    return true;
  } catch {
    return false;
  }
}

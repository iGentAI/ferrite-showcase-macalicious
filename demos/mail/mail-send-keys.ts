/*
 * The idempotency key of a message on its way to the server, kept in this browser until the server
 * has answered, so that the same message sent again after a lost answer (from a reload, or from the
 * draft a closed window left) carries the same key and is never delivered twice. IndexedDB holds
 * them because its read-write transaction is exclusive across tabs: two tabs sending the same
 * message in one moment get one key. The server keeps a key's record for a day, and so does this.
 */

const DAY_MS = 86_400_000;
const DATABASE = "macalicious.mail.sending";
const KEYS = "keys";
const prefix = (me: string) => `${encodeURIComponent(me)}/`;

/** What makes two sends the same message: all of it but the draft it is written in. */
export interface SentContent {
  to: readonly string[];
  cc: readonly string[];
  subject: string;
  text: string;
  html?: string;
  attachments: readonly string[];
}

interface KeptKey {
  name: string;
  key: string;
  at: number;
}

/** A short hash of the content (53 bits, cyrb53): crypto.subtle is missing on plain HTTP. */
function fingerprint(content: SentContent): string {
  const { to, cc, subject, text, html, attachments } = content;
  const source = JSON.stringify([to, cc, subject, text, html ?? null, attachments]);
  let a = 0xdeadbeef;
  let b = 0x41c6ce57;
  for (let at = 0; at < source.length; at += 1) {
    const code = source.charCodeAt(at);
    a = Math.imul(a ^ code, 2654435761);
    b = Math.imul(b ^ code, 1597334677);
  }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
  return (4294967296 * (2097151 & b) + (a >>> 0)).toString(36);
}

function openKeys(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(DATABASE, 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore(KEYS, { keyPath: "name" });
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error);
  });
}

/** Runs `work` in one read-write transaction, and answers once that transaction has committed. */
async function inTransaction<T>(work: (keys: IDBObjectStore, answer: (value: T) => void) => void) {
  const database = await openKeys();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const transaction = database.transaction(KEYS, "readwrite");
      let value: T | undefined;
      work(transaction.objectStore(KEYS), (given) => {
        value = given;
      });
      transaction.oncomplete = () => resolve(value);
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

/**
 * The key for this message: the one kept from an unanswered send of it, or else `fresh`, kept from
 * now on. A browser that cannot store it sends with `fresh` alone.
 */
export async function sendKeyFor(
  me: string,
  content: SentContent,
  fresh: string,
  now = Date.now(),
): Promise<string> {
  try {
    const name = prefix(me) + fingerprint(content);
    const kept = await inTransaction<string>((keys, answer) => {
      const all = keys.getAll(IDBKeyRange.bound(prefix(me), `${prefix(me)}\uffff`));
      all.onsuccess = () => {
        let found: KeptKey | undefined;
        for (const record of all.result as KeptKey[]) {
          if (now - record.at >= DAY_MS) keys.delete(record.name);
          else if (record.name === name) found = record;
        }
        if (found) {
          answer(found.key);
          return;
        }
        keys.put({ name, key: fresh, at: now } satisfies KeptKey);
        answer(fresh);
      };
    });
    return kept ?? fresh;
  } catch {
    return fresh;
  }
}

/** The server answered, or the person let the message go: a new send of it is a new message. */
export async function forgetSendKey(me: string, content: SentContent): Promise<void> {
  try {
    await inTransaction((keys) => {
      keys.delete(prefix(me) + fingerprint(content));
    });
  } catch {
    // Forgotten within a day.
  }
}

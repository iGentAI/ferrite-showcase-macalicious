import { sessionFetch } from "../desktop/desktop-server";

/** A recording kept in this browser until the drive has it. */
export interface HeldTake {
  id: string;
  title: string;
  /** The file name it is saved under. */
  name: string;
  blob: Blob;
  created: number;
}

/**
 * Where one person's recordings wait for the drive: it outlives the window and the page, so a save
 * that fails after the window closed is not the end of them. Each call rejects when the browser
 * refuses it, and resolves only when the change is stored.
 */
export interface VoiceMemosHolding {
  list(): Promise<HeldTake[]>;
  put(take: HeldTake): Promise<void>;
  remove(id: string): Promise<void>;
  /** What decoding a file of the drive found, when this browser kept it. */
  knownDecoded?(id: string): Promise<DecodedFile | undefined>;
  /** Keeps what decoding a file found: a file's bytes never change under its id. */
  keepDecoded?(id: string, decoded: DecodedFile): Promise<void>;
  /** Forgets what was kept of every file but these. */
  keepDecodedOnly?(ids: readonly string[]): Promise<void>;
}

/** What decoding a recording found: its length in seconds and its waveform. */
export interface DecodedFile {
  duration: number;
  peaks: readonly number[];
}

const DATABASE = "macalicious-voice-memos";
const STORE = "held-takes";
/** A database of its own: another tab may hold the takes' database open at its version. */
const DECODED_DATABASE = "macalicious-voice-memos-decoded";
const DECODED_STORE = "decoded";

const openedAs = (name: string, store: string) => (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(store);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
const opened = openedAs(DATABASE, STORE);
const openedDecoded = openedAs(DECODED_DATABASE, DECODED_STORE);

/** A change that holds only once its transaction has committed. */
async function writing(
  run: (store: IDBObjectStore) => void,
  open = opened,
  name = STORE,
): Promise<void> {
  const database = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(name, "readwrite");
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
      run(transaction.objectStore(name));
    });
  } finally {
    database.close();
  }
}

/** One read of the decoded store. */
async function readingDecoded<T>(read: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openedDecoded();
  try {
    const request = read(database.transaction(DECODED_STORE).objectStore(DECODED_STORE));
    return await new Promise<T>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

const isDecoded = (value: unknown): value is DecodedFile => {
  if (typeof value !== "object" || value === null) return false;
  const { duration, peaks } = value as Record<string, unknown>;
  return typeof duration === "number" && Array.isArray(peaks);
};

/**
 * Whose recordings this window holds: the signed-in account, or the guest session. Nobody, when the
 * session has changed since the window opened: its takes are not the new person's to keep.
 */
async function owner(session: string | null): Promise<string | null> {
  const reply = await sessionFetch("/api/session");
  if (!reply.ok) return null;
  const body = (await reply.json()) as { session?: unknown; account?: { name?: unknown } | null };
  if (session === null || body.session !== session) return null;
  const who = body.account?.name ?? body.session;
  return typeof who === "string" ? who : null;
}

/**
 * The holding place of the person signed in now, for one window to keep. It is bound to them when
 * the window opens: it needs no network afterwards, when the drive may be out of reach, and a take
 * of theirs cannot go to whoever signs in next. Null when the person or the store cannot be had.
 */
export async function openHolding(session: string | null): Promise<VoiceMemosHolding | null> {
  try {
    const who = await owner(session);
    if (who === null) return null;
    (await opened()).close();
    return {
      list: async () => {
        const database = await opened();
        try {
          const reading = database
            .transaction(STORE)
            .objectStore(STORE)
            .getAll(IDBKeyRange.bound([who], [who, []]));
          return await new Promise<HeldTake[]>((resolve, reject) => {
            reading.onsuccess = () => resolve(reading.result as HeldTake[]);
            reading.onerror = () => reject(reading.error);
          });
        } finally {
          database.close();
        }
      },
      put: (take) =>
        writing((store) => {
          store.put(take, [who, take.id]);
        }),
      remove: (id) =>
        writing((store) => {
          store.delete([who, id]);
        }),
      knownDecoded: async (id) => {
        const found = await readingDecoded((store) => store.get([who, id]));
        return isDecoded(found) ? found : undefined;
      },
      keepDecoded: (id, decoded) =>
        writing(
          (store) => {
            store.put(decoded, [who, id]);
          },
          openedDecoded,
          DECODED_STORE,
        ),
      keepDecodedOnly: async (ids) => {
        const kept = new Set(ids);
        const keys = await readingDecoded((store) =>
          store.getAllKeys(IDBKeyRange.bound([who], [who, []])),
        );
        const gone = keys.filter((key) => !kept.has((key as string[])[1] ?? ""));
        if (gone.length === 0) return;
        await writing(
          (store) => {
            for (const key of gone) store.delete(key);
          },
          openedDecoded,
          DECODED_STORE,
        );
      },
    };
  } catch {
    return null;
  }
}

import { useEffect, useSyncExternalStore } from "react";
import { playDriveSound } from "../system-preferences/panes/sound/alert-sounds";
import {
  currentDesktopSession,
  desktopSessionWasNamed,
  servedByDesktopApp,
  sessionFetch,
  withDeadline,
} from "./desktop-server";

/**
 * The person's file drive on the desktop's Ferrite application (`ferrite-apps/desktop`, module
 * `src/apps/files/`): folders and files kept in Ferrite storage, which Finder shows and the open
 * and save dialogs use. Only the desktop app's build has it (`servedByDesktopApp()`); in every
 * other build each call rejects with a `DriveError` of status 0 and nothing is requested.
 *
 * Large files move in pieces: the gateway takes request bodies up to 256 KiB, so an upload sends
 * one piece of `piece_bytes` (192 KiB) per request, three at a time, and retries a piece that
 * failed; a read asks for eight pieces per request and joins them into one `Blob`. Every reply
 * that carries the drive updates the page's one copy of it, which `useDrive` and `onDriveChange`
 * hand to every window.
 */

export type DriveKind = "folder" | "file";

/** One folder or file of the drive, as the server answers it. */
export interface DriveEntry {
  id: string;
  /** The folder it is in; the six home folders have none. */
  parent?: string;
  name: string;
  kind: DriveKind;
  /** Bytes; 0 for a folder. */
  size: number;
  /** The file's media type, as the browser gave it on upload. */
  type?: string;
  created_ms: number;
  modified_ms: number;
  /** When it was last opened (Recents). */
  opened_ms?: number;
  /** When it went to the Trash: set on the item at the top of the Trash only. */
  trashed_ms?: number;
  tags?: string[];
  comment?: string;
  locked?: boolean;
  hide_extension?: boolean;
  stationery?: boolean;
  /**
   * A file's version: raised each time its bytes are saved over in place. An in-place save made
   * from it (`UploadOptions.base`) is refused once the file has another, and a read is of one
   * version whole. Absent from a drive answered before versions were kept: version 0.
   */
  version?: number;
}

/** The whole drive. */
export interface Drive {
  rev: number;
  entries: DriveEntry[];
  /** Bytes the files take, the Trash included. */
  usage: number;
  quota: number;
  piece_bytes: number;
  max_file_bytes: number;
  max_entries: number;
  /** Bytes set aside by uploads under way, counted against the quota. */
  reserved?: number;
  /** The server session the drive belongs to (a hash, safe to show). */
  session?: string;
  /** The ids of the entries the change that answered made. */
  created?: string[];
  /**
   * With an upload's completion: the version that upload made its file, which a resent completion
   * still answers after the file has moved on to another.
   */
  version?: number;
}

/**
 * What to do when the folder already has an item of the name. `overwrite` is an upload's own:
 * with `replaces`, the bytes become the new content of that file, which keeps its id, name,
 * folder and tags (an app saving a document in place).
 */
export type DriveExisting = "rename" | "replace" | "fail" | "overwrite";

/** One change, as `POST /api/files/ops` takes it. */
export type DriveOp =
  | { op: "mkdir"; parent: string; name: string; existing?: DriveExisting | "reuse" }
  | { op: "rename"; id: string; name: string }
  | { op: "move"; id: string; parent: string; name?: string; existing?: DriveExisting }
  | {
      op: "copy";
      id: string;
      parent: string;
      name?: string;
      existing?: DriveExisting;
      /** Dates the copy now, as `cp` does; otherwise it keeps its files' dates. */
      dated_now?: boolean;
    }
  | { op: "trash"; id: string }
  | { op: "restore"; id: string }
  | { op: "delete"; id: string }
  | { op: "empty-trash" }
  | { op: "tag"; id: string; tags: string[] }
  | { op: "opened"; id: string }
  | {
      op: "info";
      id: string;
      comment?: string;
      locked?: boolean;
      hide_extension?: boolean;
      stationery?: boolean;
    };

/** The six folders every drive has, by name, with their fixed ids. */
export const SPECIAL_FOLDER_IDS = {
  Desktop: "desktop",
  Documents: "documents",
  Downloads: "downloads",
  Movies: "movies",
  Music: "music",
  Pictures: "pictures",
} as const;

export type SpecialFolder = keyof typeof SPECIAL_FOLDER_IDS;

/** A request the drive refused or could not be made: `status` is the HTTP status, 0 when no
 * reply came. `message` is the server's own sentence, fit to show. */
export class DriveError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "DriveError";
    this.status = status;
  }
}

const API = "/api/files";
/** Pieces uploaded at once. */
const UPLOAD_LANES = 3;
/** Pieces one read asks for (the server's most). */
const READ_PIECES = 8;
/** Sends of one request before it fails. */
const ATTEMPTS = 4;

/** Whether this build has a drive. */
export const driveAvailable = (): boolean => servedByDesktopApp();

function unavailable(): DriveError {
  return new DriveError(0, "The drive is only on the desktop served by Ferrite.");
}

// The page's copy of the drive, and who listens to it.
let current: Drive | null = null;
const listeners = new Set<(drive: Drive) => void>();

/**
 * Takes a drive a reply carried: it becomes the page's copy unless it is older than the copy
 * (revisions only grow within a session, so a late reply never takes the copy back; a drive of
 * another session, after the cookie changed or the person signed in, replaces it). Either way the
 * caller gets the reply's own drive, with the `created` ids of its own change.
 */
function adopt(drive: Drive): Drive {
  if (current && drive.session === current.session && drive.rev < current.rev) return drive;
  current = drive;
  for (const listener of listeners) {
    try {
      listener(drive);
    } catch (error) {
      console.error(error);
    }
  }
  return drive;
}

/** The drive as the page last had it, or `null` before the first load. */
export const currentDrive = (): Drive | null => current;

/** Hear every newer copy of the drive. Returns the unsubscribe. */
export function onDriveChange(listener: (drive: Drive) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });

/** Whether a failed send is worth sending again: no reply, a server failure, a timeout or a
 * rate limit. */
const retryable = (status: number) =>
  status === 0 || status === 408 || status === 429 || status >= 500;

async function errorOf(response: Response): Promise<DriveError> {
  let message = `The drive answered ${response.status}.`;
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body?.error === "string") message = body.error;
  } catch {
    // Not JSON: keep the status.
  }
  return new DriveError(response.status, message);
}

/**
 * One request to the drive, retried while it fails in a way a retry can mend. A write sent with
 * `key` carries one `idempotency-key`, the same on every send, so a write whose reply was lost is
 * applied once. Resolves with the reply's body as `read` reads it. `signal` gives the request up.
 */
async function request<T>(
  path: string,
  init: RequestInit & { key?: boolean; session?: string | null },
  read: (response: Response) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (!driveAvailable()) throw unavailable();
  const { key, session, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (key) headers.set("idempotency-key", crypto.randomUUID());
  let failure = new DriveError(0, "The drive could not be reached.");
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    if (attempt > 0) await wait(250 * 2 ** attempt, signal);
    if (signal?.aborted) throw signal.reason;
    try {
      return await withDeadline(async (deadline) => {
        // The caller's signal is forwarded by hand: WebKit never ends a request cancelled
        // through `AbortSignal.any`.
        const cancel = new AbortController();
        const forward = () => cancel.abort(signal?.reason ?? deadline.reason);
        if (deadline.aborted || signal?.aborted) forward();
        deadline.addEventListener("abort", forward, { once: true });
        signal?.addEventListener("abort", forward, { once: true });
        try {
          const response = await sessionFetch(
            `${API}${path}`,
            {
              ...rest,
              headers,
              credentials: "same-origin",
              signal: cancel.signal,
            },
            session,
          );
          if (!response.ok) throw await errorOf(response);
          return await read(response);
        } finally {
          deadline.removeEventListener("abort", forward);
          signal?.removeEventListener("abort", forward);
        }
      });
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      failure =
        error instanceof DriveError
          ? error
          : new DriveError(0, error instanceof Error ? error.message : String(error));
      if (!retryable(failure.status)) throw failure;
    }
  }
  throw failure;
}

const asDrive = async (response: Response) => adopt((await response.json()) as Drive);

/** Reads the drive. */
export function loadDrive(signal?: AbortSignal): Promise<Drive> {
  return request("/", { headers: { accept: "application/json" } }, asDrive, signal);
}

/**
 * The session a save names: the one it was begun for, or the page's as it starts. Refuses work that
 * has no session to name once someone has signed in, which would follow the browser's cookie wherever
 * it is now.
 */
function sessionOfSave(session: string | null | undefined): string | null {
  const now = currentDesktopSession();
  const named = session === undefined ? now : session;
  if (named === null && (now !== null || desktopSessionWasNamed())) {
    throw new DriveError(409, "The person this save was for is no longer signed in.");
  }
  return named;
}

/**
 * Applies `ops` in order, all or none, and answers the drive after them (its `created` lists the ids
 * of the entries they made). `session` is as `UploadOptions.session` means it, and every send of the
 * change names the same one.
 */
export async function runOps(
  ops: readonly DriveOp[],
  signal?: AbortSignal,
  session?: string | null,
): Promise<Drive> {
  const drive = await request(
    "/ops",
    {
      method: "POST",
      key: true,
      session: sessionOfSave(session),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ops }),
    },
    asDrive,
    signal,
  );
  playDriveSound(ops);
  return drive;
}

/** The drive as the page has it, loading it first if it has none. */
export async function ensureDrive(signal?: AbortSignal): Promise<Drive> {
  return current ?? loadDrive(signal);
}

/** The entry `id` of `drive`. */
export const entryOf = (drive: Drive, id: string): DriveEntry | undefined =>
  drive.entries.find((entry) => entry.id === id);

/** Whether the entry, or a folder it is in, is in the Trash. */
export function inTrash(drive: Drive, id: string): boolean {
  const seen = new Set<string>();
  for (let entry = entryOf(drive, id); entry; ) {
    if (entry.trashed_ms !== undefined || seen.has(entry.id)) return true;
    seen.add(entry.id);
    if (!entry.parent) return false;
    entry = entryOf(drive, entry.parent);
  }
  return false;
}

/** The items of folder `id` that are not in the Trash. */
export const childrenOf = (drive: Drive, id: string): DriveEntry[] =>
  drive.entries.filter((entry) => entry.parent === id && entry.trashed_ms === undefined);

/** The items at the top of the Trash. */
export const trashOf = (drive: Drive): DriveEntry[] =>
  drive.entries.filter((entry) => entry.trashed_ms !== undefined);

/** The six home folders, in order. */
export const homeFolders = (drive: Drive): DriveEntry[] =>
  Object.values(SPECIAL_FOLDER_IDS).flatMap((id) => entryOf(drive, id) ?? []);

/** The folder `name` of the home folder. */
export const specialFolder = (drive: Drive, name: SpecialFolder): DriveEntry | undefined =>
  entryOf(drive, SPECIAL_FOLDER_IDS[name]);

/** The folders from the home folder down to the entry, the entry last. */
export function pathOf(drive: Drive, id: string): DriveEntry[] {
  const path: DriveEntry[] = [];
  const seen = new Set<string>();
  for (let entry = entryOf(drive, id); entry && !seen.has(entry.id); ) {
    seen.add(entry.id);
    path.unshift(entry);
    entry = entry.parent ? entryOf(drive, entry.parent) : undefined;
  }
  return path;
}

/** The files of the drive outside the Trash, most recently opened or changed first. */
export function recentFiles(drive: Drive, limit = 20): DriveEntry[] {
  const stamp = (entry: DriveEntry) => Math.max(entry.opened_ms ?? 0, entry.modified_ms);
  return drive.entries
    .filter((entry) => entry.kind === "file" && !inTrash(drive, entry.id))
    .sort((a, b) => stamp(b) - stamp(a))
    .slice(0, limit);
}

/**
 * The folder `name` in `parentId`: the one there, or a new one. `session` is the session of the save
 * the folder is for, as `UploadOptions.session` means it: refused with a 409 once it is no longer the
 * browser's, so no folder reaches the next person's drive.
 */
export async function ensureFolder(
  parentId: string,
  name: string,
  session?: string | null,
): Promise<DriveEntry> {
  const drive = await runOps(
    [{ op: "mkdir", parent: parentId, name, existing: "reuse" }],
    undefined,
    session,
  );
  const id = drive.created?.[0];
  const entry = id ? entryOf(drive, id) : undefined;
  if (!entry) throw new DriveError(500, "The drive did not answer the folder.");
  return entry;
}

export interface UploadOptions {
  /** The file's name in the folder. Default: the File's own name, or "untitled". */
  name?: string;
  /** When the folder has an item of the name. Default: "rename". */
  existing?: DriveExisting;
  /**
   * With `existing: "replace"`, the id of the file the person chose to replace: the upload
   * completes only while that very file still has the name, and is refused with a 409 otherwise.
   * With `existing: "overwrite"`, the file whose bytes the upload becomes (409 when it is gone, in
   * the Trash or a folder).
   */
  replaces?: string;
  /**
   * With `existing: "overwrite"`, the file's `version` the bytes were made from: the save is
   * refused with a 412 once the file has another version (it was saved over elsewhere meanwhile).
   * Absent, the save writes over whatever the file holds.
   */
  base?: number;
  /**
   * The desktop session this save is for: `currentDesktopSession()` as it was when the person began
   * the work, kept from when a window opened or a batch of files started. Tabs of one browser share
   * its session, so another tab can sign someone else in meanwhile, and the page then names their
   * session: this upload is refused with a 409 rather than landing on their drive. Absent, the
   * session the page names as this upload starts. A page that signs people in and has no session to
   * name sends nothing: the upload is refused at once, as is one for `null` once there is a session.
   */
  session?: string | null;
  /** Called as pieces arrive, with the bytes sent and the file's size. */
  onProgress?: (sent: number, total: number) => void;
  signal?: AbortSignal;
}

interface Started {
  upload: string;
  piece_bytes: number;
  pieces: number;
}

/**
 * Uploads `file` into folder `parentId` in pieces and answers the new file's entry. The start is
 * sent with an idempotency key, so a start whose reply was lost opens one upload, and completion
 * is replay-safe on the server. A piece that fails is sent again; an upload given up (its signal
 * aborted, or a piece that keeps failing) stops every piece still going and is then cancelled on
 * the server. A refusal rejects with its `DriveError`: 413 for a file over the largest size, 507
 * when the quota or the entry limit would be passed, 404 for a folder the drive does not have,
 * 429 with too many uploads open, 409 when `session` is no longer the browser's, and 412 when
 * `base` is not the file's version.
 */
export async function uploadFile(
  file: Blob,
  parentId: string,
  options: UploadOptions = {},
): Promise<DriveEntry> {
  const { signal, onProgress } = options;
  const session = sessionOfSave(options.session);
  const name = options.name ?? (file instanceof File && file.name ? file.name : "untitled");
  const started = await request(
    "/uploads",
    {
      method: "POST",
      key: true,
      session,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        parent: parentId,
        name,
        size: file.size,
        type: file.type,
        existing: options.existing ?? "rename",
        ...(options.replaces ? { replaces: options.replaces } : {}),
        ...(options.base !== undefined ? { base: options.base } : {}),
      }),
    },
    async (response) => (await response.json()) as Started,
    signal,
  );
  const { upload, piece_bytes: pieceBytes, pieces } = started;
  // This upload's own stop: the caller's signal, or the first piece that fails.
  const stop = new AbortController();
  const forward = () => stop.abort(signal?.reason);
  if (signal?.aborted) forward();
  signal?.addEventListener("abort", forward, { once: true });
  let sent = 0;
  onProgress?.(0, file.size);
  const sendPiece = async (index: number) => {
    const part = file.slice(index * pieceBytes, Math.min(file.size, (index + 1) * pieceBytes));
    const body = await part.arrayBuffer();
    await request(
      `/uploads/${upload}/${index}`,
      { method: "PUT", session, headers: { "content-type": "application/octet-stream" }, body },
      async () => undefined,
      stop.signal,
    );
    if (stop.signal.aborted) return;
    sent += part.size;
    onProgress?.(sent, file.size);
  };
  try {
    let next = 0;
    const lane = async () => {
      while (next < pieces && !stop.signal.aborted) {
        const index = next;
        next += 1;
        try {
          await sendPiece(index);
        } catch (error) {
          stop.abort(error);
          throw error;
        }
      }
    };
    // Every lane settles before the upload is completed or given up.
    const lanes = await Promise.allSettled(
      Array.from({ length: Math.min(UPLOAD_LANES, pieces) }, lane),
    );
    if (signal?.aborted) throw signal.reason;
    const failed = lanes.find((settled) => settled.status === "rejected");
    if (failed) throw (failed as PromiseRejectedResult).reason;
    const drive = await request(
      `/uploads/${upload}/complete`,
      { method: "POST", session, headers: { "content-type": "application/json" }, body: "{}" },
      asDrive,
      signal,
    );
    const id = drive.created?.[0];
    const entry = id ? entryOf(drive, id) : undefined;
    if (!entry) throw new DriveError(500, "The drive did not answer the new file.");
    // The entry as the drive has it now, at the version this upload made it: a completion resent
    // after a lost reply answers the drive as another window may have changed it since.
    return drive.version !== undefined ? { ...entry, version: drive.version } : entry;
  } catch (error) {
    // Give the pieces back; the server also clears an upload left a day.
    void request(`/uploads/${upload}`, { method: "DELETE", session }, async () => undefined).catch(
      () => {},
    );
    throw error;
  } finally {
    signal?.removeEventListener("abort", forward);
  }
}

export interface ReadOptions {
  /** Called as pieces arrive, with the bytes read and the file's size. */
  onProgress?: (received: number, total: number) => void;
  signal?: AbortSignal;
}

/** A file read whole, and its entry as it was read: `entry.version` is the version of `blob`. */
export interface FileRead {
  blob: Blob;
  entry: DriveEntry;
}

/** Reads the file `id` whole, as a `Blob` typed from its entry (the server sends the bytes as an
 * opaque attachment). */
export async function readFile(id: string, options: ReadOptions = {}): Promise<Blob> {
  return (await readFileEntry(id, options)).blob;
}

/**
 * Reads the file `id` whole, with its entry as read. Every piece names the version the read
 * started from, so the bytes are all of that one version: a file saved over since the page's copy
 * of the drive was read, or while it is read, is read again whole with the drive as it is now.
 */
export async function readFileEntry(id: string, options: ReadOptions = {}): Promise<FileRead> {
  try {
    return await readWhole(id, await ensureDrive(options.signal), options);
  } catch (error) {
    // Saved over (412: the version read is no longer the file's; 503: not the size the copy
    // says): read the drive again, and the file with it, once.
    if (!(error instanceof DriveError) || (error.status !== 412 && error.status !== 503)) {
      throw error;
    }
    return readWhole(id, await loadDrive(options.signal), options);
  }
}

async function readWhole(id: string, known: Drive, options: ReadOptions): Promise<FileRead> {
  const { signal, onProgress } = options;
  let drive = known;
  let entry = entryOf(drive, id);
  // A file this page has not seen yet (another window or tab made it): read the drive again.
  if (!entry) {
    drive = await loadDrive(signal);
    entry = entryOf(drive, id);
  }
  if (entry?.kind !== "file") throw new DriveError(404, "No such file is on the drive.");
  const pieces = Math.ceil(entry.size / drive.piece_bytes);
  const version = entry.version ?? 0;
  const parts: ArrayBuffer[] = [];
  let received = 0;
  onProgress?.(0, entry.size);
  for (let first = 0; first < Math.max(pieces, 1); first += READ_PIECES) {
    const part = await request(
      `/content/${encodeURIComponent(id)}?piece=${first}&count=${READ_PIECES}&version=${version}`,
      {},
      (response) => response.arrayBuffer(),
      signal,
    );
    parts.push(part);
    received += part.byteLength;
    onProgress?.(received, entry.size);
  }
  // Every piece is of the version the entry says, so anything but its size means the read went
  // wrong: never hand back a short file.
  if (received !== entry.size) {
    throw new DriveError(503, "The file could not be read whole; try again.");
  }
  return { blob: new Blob(parts, { type: entry.type || "application/octet-stream" }), entry };
}

/** One kept version of a file: the bytes an earlier save replaced. */
export interface KeptVersion {
  /** The file's version when it held these bytes. */
  version: number;
  size: number;
  type: string;
  /** When these bytes were written. */
  modifiedMs: number;
  /** Asked for by the person (File > Save, or what a restore replaced), not left by autosave. */
  saved: boolean;
}

/** What the drive answers of a file's versions: the newest first, without the file's own bytes. */
export interface FileVersions {
  version: number;
  modifiedMs: number;
  versions: KeptVersion[];
}

const VERSIONS = `${API}/versions`;

function versionOf(value: unknown): KeptVersion | null {
  const kept = value as Record<string, unknown> | null;
  if (
    typeof kept?.version !== "number" ||
    typeof kept.size !== "number" ||
    typeof kept.modified_ms !== "number"
  ) {
    return null;
  }
  return {
    version: kept.version,
    size: kept.size,
    type: typeof kept.type === "string" ? kept.type : "",
    modifiedMs: kept.modified_ms,
    saved: kept.saved === true,
  };
}

/** The versions the file `id` keeps. */
export async function listVersions(id: string): Promise<FileVersions> {
  const response = await sessionFetch(`${VERSIONS}/${id}`, {
    headers: { accept: "application/json" },
    credentials: "same-origin",
  });
  if (!response.ok) throw await errorOf(response);
  const reply = (await response.json()) as {
    version?: unknown;
    modified_ms?: unknown;
    versions?: unknown;
  };
  return {
    version: typeof reply.version === "number" ? reply.version : 0,
    modifiedMs: typeof reply.modified_ms === "number" ? reply.modified_ms : 0,
    versions: (Array.isArray(reply.versions) ? reply.versions : [])
      .map(versionOf)
      .filter((kept): kept is KeptVersion => kept !== null),
  };
}

/** The bytes of the version `version` of the file `id`, read whole. */
export async function readVersion(id: string, version: number): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  let piece = 0;
  let pieces = 1;
  while (piece < pieces) {
    const response = await sessionFetch(
      `${VERSIONS}/${id}/${version}?piece=${piece}&count=${READ_PIECES}`,
      { credentials: "same-origin" },
    );
    if (!response.ok) throw await errorOf(response);
    pieces = Number(response.headers.get("x-file-pieces") ?? 0);
    parts.push(new Uint8Array(await response.arrayBuffer()));
    piece += READ_PIECES;
  }
  const whole = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    whole.set(part, at);
    at += part.length;
  }
  return whole;
}

/**
 * Makes the version `version` the bytes of the file `id`, keeping what they replace, and has the
 * page's copy of the drive say so. `base` is the file's version the person chose from: the drive
 * refuses with a 412 when it has another since. Sent again after a lost reply it changes nothing.
 */
export async function restoreVersion(
  id: string,
  version: number,
  base?: number,
  session?: string | null,
): Promise<void> {
  const response = await sessionFetch(
    `${VERSIONS}/${id}/${version}/restore`,
    {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(base === undefined ? {} : { base }),
    },
    session,
  );
  if (!response.ok) throw await errorOf(response);
  await loadDrive();
}

/** Keeps the bytes the file `id` holds at `version` as a version the person asked for (File > Save). */
export async function keepVersion(
  id: string,
  version: number,
  session?: string | null,
): Promise<void> {
  const response = await sessionFetch(
    `${VERSIONS}/${id}/keep`,
    {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version }),
    },
    session,
  );
  if (!response.ok) throw await errorOf(response);
}

/**
 * What File > Revert To > Previous Save goes back to: the newest version older than the last saved
 * one, one the person asked for when there is any. `versions` comes from `listVersions`.
 */
export function previousSaveOf(
  versions: readonly KeptVersion[],
  lastSaved: number | undefined,
): KeptVersion | undefined {
  const older = versions.filter((kept) => lastSaved === undefined || kept.version < lastSaved);
  return older.find((kept) => kept.saved) ?? older[0];
}

/** A version's date as a sheet and a menu show it, to the second: saves come close together. */
export const versionDate = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" });

/** Marks the file opened, for Recents. A failure is ignored: it only orders Recents. */
export function markOpened(id: string): void {
  void runOps([{ op: "opened", id }]).catch(() => {});
}

/**
 * Saves the file `id` to the computer: reads it whole and hands it to the browser as a
 * download named after it.
 */
export async function downloadFile(id: string, options: ReadOptions = {}): Promise<void> {
  const blob = await readFile(id, options);
  const name = (current && entryOf(current, id)?.name) || "download";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  // The browser has taken the address well before then.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  markOpened(id);
}

/**
 * The page's copy of the drive, loaded on first use where the drive exists: `null` before it has
 * loaded and in a build without a drive. Every window shares the one copy.
 */
export function useDrive(enabled: boolean = driveAvailable()): Drive | null {
  const drive = useSyncExternalStore(
    onDriveChange,
    () => current,
    () => null,
  );
  useEffect(() => {
    if (enabled && !current) void loadDrive().catch((error) => console.error(error));
  }, [enabled]);
  return enabled ? drive : null;
}

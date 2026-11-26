import {
  childrenOf,
  type Drive,
  type DriveEntry,
  DriveError,
  type DriveOp,
  driveAvailable,
  ensureFolder,
  entryOf,
  loadDrive,
  markOpened,
  onDriveChange,
  readFile,
  runOps,
  SPECIAL_FOLDER_IDS,
  trashOf,
  uploadFile,
} from "../desktop/desktop-files";
import { currentDesktopSession } from "../desktop/desktop-server";
import { extensionOf, isAudioFile, titleOf } from "./voice-memos-audio";
import { openHolding, type VoiceMemosHolding } from "./voice-memos-holding";

/** The folder of the drive's Music that Voice Memos keeps its recordings in. */
export const VOICE_MEMOS_FOLDER = "Voice Memos";

/** One recording: an audio file of Music/Voice Memos. */
export interface VoiceMemoFile {
  /** The drive's id of the file. */
  id: string;
  /** The file's name, extension included. */
  name: string;
  /** The name without its extension: what the list and the window show. */
  title: string;
  /** The extension with its dot, `.webm`, which a rename keeps. */
  extension: string;
  /** When the file was made, in milliseconds. */
  created: number;
  /** Its size in bytes. */
  size: number;
  /** Its media type, as the drive keeps it. */
  type: string;
  /** The folder it is in. */
  parent: string;
  /** When it went to the Trash, in milliseconds; only a recording of Recently Deleted has this. */
  deleted?: number;
}

/** What Recently Deleted does: the recordings in the store's Trash, which are still its files. */
export interface VoiceMemosDeleted {
  /** Reads the store and answers the deleted recordings, the last deleted first. */
  list(): Promise<VoiceMemoFile[]>;
  /** Hears them again whenever the store changes. Returns the unsubscribe. */
  watch(listener: (recordings: VoiceMemoFile[]) => void): () => void;
  /** Puts a deleted recording back among the recordings. */
  recover(id: string): Promise<void>;
  /** Deletes a recording for good. */
  erase(id: string): Promise<void>;
}

/**
 * Where Voice Memos keeps recordings: the person's drive on the desktop's Ferrite application,
 * or another store a host (or a test) gives the window.
 */
export interface VoiceMemosDrive {
  /** Reads the store and answers the recordings, newest first. */
  list(): Promise<VoiceMemoFile[]>;
  /** Hears the recordings again whenever the store changes, here or in another window. Returns
   * the unsubscribe. */
  watch(listener: (recordings: VoiceMemoFile[]) => void): () => void;
  /**
   * Keeps a new recording under exactly `name`, never another and never over another item. When
   * the folder has an item of the name already holding exactly the recording's bytes, it is an
   * earlier save of the same recording whose answer was lost, and that file is answered rather
   * than a second made; any other item of the name refuses the save. `onProgress` hears the
   * share sent, 0 to 1.
   */
  /**
   * Keeps `blob`. `session` is the desktop session it was recorded under, when that is known: the
   * save is refused if someone else has signed in since.
   */
  save(
    blob: Blob,
    name: string,
    onProgress?: (fraction: number) => void,
    session?: string | null,
  ): Promise<VoiceMemoFile>;
  /** Reads a recording back whole. */
  read(id: string): Promise<Blob>;
  /** Notes that a recording was played, for Finder's Recents. Never fails. */
  opened(id: string): void;
  /** Opens where this person's recordings wait for the drive, when there is such a place. */
  holding?: (session: string | null) => Promise<VoiceMemosHolding | null>;
  /** Gives a recording another name; refused when the folder has an item of that name. */
  rename(id: string, name: string): Promise<VoiceMemoFile>;
  /** Moves a recording to the Trash, from where Finder can put it back. */
  trash(id: string): Promise<void>;
  /** Recently Deleted, when the store can tell its deleted recordings. */
  deleted?: VoiceMemosDeleted;
  /**
   * Keeps `blob` beside `original` under `name`, then moves the original to the Trash; only once
   * the new file is kept, so a failure never loses the recording. The new file takes `name` even
   * when the folder held an item of it when the upload began (the original, or one of its
   * extension), if the drive will have it.
   */
  replace(
    original: VoiceMemoFile,
    blob: Blob,
    name: string,
    onProgress?: (fraction: number) => void,
  ): Promise<VoiceMemoFile>;
}

/** A file of the drive as a recording. */
export const asMemo = (entry: DriveEntry): VoiceMemoFile => ({
  id: entry.id,
  name: entry.name,
  title: titleOf(entry.name),
  extension: extensionOf(entry.name),
  created: entry.created_ms,
  size: entry.size,
  type: entry.type ?? "",
  parent: entry.parent ?? "",
});

/** Music/Voice Memos of a drive, when it has one outside the Trash. */
export function voiceMemosFolder(drive: Drive): DriveEntry | undefined {
  const name = VOICE_MEMOS_FOLDER.toLowerCase();
  return childrenOf(drive, SPECIAL_FOLDER_IDS.Music).find(
    (entry) => entry.kind === "folder" && entry.name.toLowerCase() === name,
  );
}

/** The recordings of a drive: the audio files of Music/Voice Memos not in the Trash, newest
 * first. */
export function memosOf(drive: Drive): VoiceMemoFile[] {
  const folder = voiceMemosFolder(drive);
  if (!folder) return [];
  return childrenOf(drive, folder.id)
    .filter((entry) => entry.kind === "file" && isAudioFile(entry))
    .map(asMemo)
    .sort((a, b) => b.created - a.created || a.name.localeCompare(b.name));
}

/** The recordings of a drive at the top of its Trash, from Music/Voice Memos, the last deleted first. */
export function deletedOf(drive: Drive): VoiceMemoFile[] {
  const folder = voiceMemosFolder(drive);
  if (!folder) return [];
  return trashOf(drive)
    .filter((entry) => entry.parent === folder.id && entry.kind === "file" && isAudioFile(entry))
    .map((entry) => ({ ...asMemo(entry), deleted: entry.trashed_ms }))
    .sort((a, b) => (b.deleted ?? 0) - (a.deleted ?? 0) || a.name.localeCompare(b.name));
}

const share = (onProgress?: (fraction: number) => void) =>
  onProgress
    ? (done: number, total: number) => onProgress(total > 0 ? done / total : 1)
    : undefined;

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Whether two files hold exactly the same bytes. */
export async function sameBytes(a: Blob, b: Blob): Promise<boolean> {
  if (a.size !== b.size) return false;
  const [left, right] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()]);
  const x = new Uint8Array(left);
  const y = new Uint8Array(right);
  for (let at = 0; at < x.length; at++) if (x[at] !== y[at]) return false;
  return true;
}

/**
 * The person's drive on the desktop's Ferrite application (`demos/desktop/desktop-files.ts`):
 * recordings are the audio files of Music/Voice Memos, which the first save makes. Every reply
 * that carries the drive reaches `watch`, so a recording Finder renames, moves or puts in the
 * Trash changes the list at once.
 */
export const desktopDrive: VoiceMemosDrive = {
  holding: openHolding,
  list: async () => memosOf(await loadDrive()),
  watch: (listener) => onDriveChange((drive) => listener(memosOf(drive))),
  save: async (blob, name, onProgress, session) => {
    const folder = await ensureFolder(SPECIAL_FOLDER_IDS.Music, VOICE_MEMOS_FOLDER, session);
    try {
      return asMemo(
        await uploadFile(blob, folder.id, {
          name,
          existing: "fail",
          session,
          onProgress: share(onProgress),
        }),
      );
    } catch (error) {
      if (!(error instanceof DriveError) || error.status !== 409) throw error;
      // The session named is no longer the one signed in: the drive at hand is someone else's.
      if (session !== undefined && session !== currentDesktopSession()) throw error;
      // The name is taken.
      // The name is taken. It is this very recording, saved before by a request whose answer was
      // lost, only when the file there holds exactly its bytes; anything else refuses the save,
      // and the recording stays unsaved in the window.
      const key = name.toLowerCase();
      const kept = memosOf(await loadDrive()).find(
        (memo) => memo.parent === folder.id && memo.name.toLowerCase() === key,
      );
      if (kept && kept.size === blob.size && (await sameBytes(await readFile(kept.id), blob))) {
        return kept;
      }
      throw error;
    }
  },
  read: (id) => readFile(id),
  opened: (id) => markOpened(id),
  rename: async (id, name) => {
    const entry = entryOf(await runOps([{ op: "rename", id, name }]), id);
    if (!entry) throw new DriveError(404, "The recording is no longer on the drive.");
    return asMemo(entry);
  },
  trash: async (id) => {
    await runOps([{ op: "trash", id }]);
  },
  deleted: {
    list: async () => deletedOf(await loadDrive()),
    watch: (listener) => onDriveChange((drive) => listener(deletedOf(drive))),
    recover: async (id) => {
      await runOps([{ op: "restore", id }]);
    },
    erase: async (id) => {
      await runOps([{ op: "delete", id }]);
    },
  },
  replace: async (original, blob, name, onProgress) => {
    const session = currentDesktopSession();
    const made = await uploadFile(blob, original.parent, {
      name,
      existing: "rename",
      session,
      onProgress: share(onProgress),
    });
    // The original goes to the Trash first, which frees its name for the new file. Both changes
    // are one request, applied together or not at all; if the name is still taken by another
    // item, the original goes to the Trash on its own and the new file keeps the drive's name.
    const trash: DriveOp = { op: "trash", id: original.id };
    const ops: DriveOp[] =
      made.name === name ? [trash] : [trash, { op: "rename", id: made.id, name }];
    let drive: Drive;
    try {
      drive = await runOps(ops, undefined, session);
    } catch (error) {
      try {
        if (ops.length === 1 || !(error instanceof DriveError) || error.status !== 409) throw error;
        drive = await runOps([trash], undefined, session);
      } catch (failure) {
        throw new Error(
          `The trimmed recording was saved as “${made.name}”, but “${original.name}” could not be moved to the Trash: ${messageOf(failure)}`,
        );
      }
    }
    return asMemo(entryOf(drive, made.id) ?? made);
  },
};

/** The store this build has: the desktop app's drive, or none. */
export const defaultDrive = (): VoiceMemosDrive | null => (driveAvailable() ? desktopDrive : null);

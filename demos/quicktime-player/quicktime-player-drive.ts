import {
  childrenOf,
  type DriveEntry,
  driveAvailable,
  entryOf,
  inTrash,
  type KeptVersion,
  keepVersion,
  listVersions,
  loadDrive,
  markOpened,
  pathOf,
  readFile,
  readFileEntry,
  restoreVersion,
  runOps,
  SPECIAL_FOLDER_IDS,
  uploadFile,
} from "../desktop/desktop-files";
import { currentDesktopSession, sessionFetch } from "../desktop/desktop-server";

/** A movie file of the person's drive, as the window lists it. */
export interface QuickTimeMovieFile {
  /** The drive's id of the file. */
  id: string;
  name: string;
  /** Its size in bytes. */
  size: number;
  /** Its MIME type, as the drive keeps it. */
  type: string;
  /** When it last changed, in epoch milliseconds, when the store says. */
  modified?: number;
  /** The file's version: raised each time its bytes are saved over in place. */
  version?: number;
  /** It is a folder of the drive, which the Open window goes into. */
  folder?: boolean;
}

/**
 * Where QuickTime Player keeps and finds movies: the person's drive on the desktop's Ferrite
 * application, or another store a host gives the window.
 */
export interface QuickTimeDrive {
  /** The files of the person's Movies folder. */
  movies(): Promise<QuickTimeMovieFile[]>;
  /** Upload a file into the Movies folder; `onProgress` hears the share sent, 0 to 1. */
  upload(file: File, onProgress: (fraction: number) => void): Promise<QuickTimeMovieFile>;
  /** Read a movie back; `onProgress` hears the share received, 0 to 1. */
  read(id: string, onProgress: (fraction: number) => void): Promise<Blob>;
  /** Read a movie back with the file's version those bytes are, which a save in place is made from. */
  readKept?(
    id: string,
    onProgress: (fraction: number) => void,
  ): Promise<{ blob: Blob; version: number }>;
  /**
   * Writes `blob` into the file `id` in place, keeping what it replaces as a version. Refused when
   * the file has another version than `base` by now, or is gone.
   */
  saveOver?(
    id: string,
    blob: Blob,
    base: number,
    onProgress: (fraction: number) => void,
  ): Promise<QuickTimeMovieFile>;
  /** The versions kept of a file saved in place. */
  versions?: {
    list(id: string): Promise<KeptVersion[]>;
    /** Makes the version the file's bytes, keeping what they replace. */
    restore(id: string, version: number, base: number | undefined): Promise<void>;
    /** Marks the bytes of a File > Save as asked for, so a quick next save does not thin them away. */
    keep(id: string, version: number): Promise<void>;
  };
  /** Read a file for the Open window's preview: looking at it does not make it recently opened. */
  preview?(id: string): Promise<Blob>;
  /** Where a saved movie is split into clips, in seconds; none when it never was. */
  clipsOf?(id: string): Promise<number[]>;
  /** Stores where a saved movie is split; resolves once they are stored. */
  keepClips?(id: string, cuts: readonly number[]): Promise<void>;
  /** Gives a movie another name; refused when its folder has an item of that name. */
  rename?(id: string, name: string): Promise<QuickTimeMovieFile>;
  /** The folders a movie can go to, each named with the path to it. */
  folders?(): Promise<{ id: string; name: string }[]>;
  /** Puts a movie in another folder; refused when that folder has an item of its name. */
  move?(id: string, folder: string): Promise<QuickTimeMovieFile>;
  /** The places the Open window's sidebar lists beside Recents; `movies` is Movies. */
  places?(): Promise<{ id: string; name: string }[]>;
  /** What a folder holds, its folders marked. Without it the Open window lists Movies alone. */
  contents?(folder: string): Promise<QuickTimeMovieFile[]>;
}

const clipsUrl = (id: string) => `/api/quicktime-player/clips/${encodeURIComponent(id)}`;

const asMovie = (entry: DriveEntry): QuickTimeMovieFile => ({
  id: entry.id,
  name: entry.name,
  size: entry.size,
  type: entry.type ?? "",
  modified: entry.modified_ms,
  version: entry.version ?? 0,
});

const share = (onProgress: (fraction: number) => void) => (done: number, total: number) =>
  onProgress(total > 0 ? done / total : 1);

/**
 * The person's drive on the desktop's Ferrite application (`demos/desktop/desktop-files.ts`):
 * Movies is its `movies` folder; a movie moves in pieces both ways and is read back whole as a
 * `Blob` the window plays; opening one marks it opened, for Finder's Recents. Its changes are for
 * `session`, the one its window opened in (`UploadOptions.session`).
 */
export const desktopDrive = (session: string | null): QuickTimeDrive => ({
  clipsOf: async (id) => {
    const reply = await sessionFetch(clipsUrl(id));
    if (!reply.ok) throw new Error(`the server answered ${reply.status}`);
    const { cuts } = (await reply.json()) as { cuts?: unknown };
    return Array.isArray(cuts) ? cuts.filter((cut) => typeof cut === "number") : [];
  },
  keepClips: async (id, cuts) => {
    const reply = await sessionFetch(
      clipsUrl(id),
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cuts }),
      },
      session,
    );
    if (!reply.ok) throw new Error(`the server answered ${reply.status}`);
  },
  movies: async () =>
    childrenOf(await loadDrive(), SPECIAL_FOLDER_IDS.Movies)
      .filter((entry) => entry.kind === "file")
      .map(asMovie),
  upload: async (file, onProgress) =>
    asMovie(
      await uploadFile(file, SPECIAL_FOLDER_IDS.Movies, {
        onProgress: share(onProgress),
        session,
      }),
    ),
  read: async (id, onProgress) => {
    const blob = await readFile(id, { onProgress: share(onProgress) });
    markOpened(id);
    return blob;
  },
  preview: (id) => readFile(id),
  readKept: async (id, onProgress) => {
    const { blob, entry } = await readFileEntry(id, { onProgress: share(onProgress) });
    markOpened(id);
    return { blob, version: entry.version ?? 0 };
  },
  saveOver: async (id, blob, base, onProgress) => {
    const entry = entryOf(await loadDrive(), id);
    if (!entry?.parent) throw new Error("The movie is no longer on the drive.");
    return asMovie(
      await uploadFile(blob, entry.parent, {
        name: entry.name,
        existing: "overwrite",
        replaces: id,
        base,
        onProgress: share(onProgress),
        session,
      }),
    );
  },
  versions: {
    list: async (id) => (await listVersions(id)).versions,
    restore: (id, version, base) => restoreVersion(id, version, base, session),
    keep: (id, version) => keepVersion(id, version, session),
  },
  rename: async (id, name) => {
    const entry = entryOf(await runOps([{ op: "rename", id, name }], undefined, session), id);
    if (!entry) throw new Error("The movie is no longer on the drive.");
    return asMovie(entry);
  },
  folders: async () => {
    const drive = await loadDrive();
    return drive.entries
      .filter((entry) => entry.kind === "folder" && !inTrash(drive, entry.id))
      .map((entry) => ({
        id: entry.id,
        name: pathOf(drive, entry.id)
          .map((each) => each.name)
          .join(" ▸ "),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
  move: async (id, folder) => {
    const entry = entryOf(
      await runOps([{ op: "move", id, parent: folder, existing: "fail" }], undefined, session),
      id,
    );
    if (!entry) throw new Error("The movie is no longer on the drive.");
    return asMovie(entry);
  },
  places: async () => Object.entries(SPECIAL_FOLDER_IDS).map(([name, id]) => ({ id, name })),
  contents: async (folder) =>
    childrenOf(await loadDrive(), folder).map((entry) =>
      entry.kind === "folder" ? { ...asMovie(entry), folder: true } : asMovie(entry),
    ),
});

/** The drive this build has, for the session the page has now: the desktop app's, or none. */
export const defaultDrive = (): QuickTimeDrive | null =>
  driveAvailable() ? desktopDrive(currentDesktopSession()) : null;

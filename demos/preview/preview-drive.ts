import {
  type DriveEntry,
  driveAvailable,
  entryOf,
  inTrash,
  loadDrive,
  markOpened,
  pathOf,
  readFile,
  runOps,
  uploadFile,
} from "../desktop/desktop-files";
import { currentDesktopSession } from "../desktop/desktop-server";
import type { DriveSaveTarget } from "../finder/finder-file-dialogs";

/** A folder a file can move to, named by its path on the drive. */
export interface PreviewFolder {
  id: string;
  path: string;
}

/**
 * Where Preview reads and writes files: the person's drive on the desktop's Ferrite application
 * (`demos/desktop/desktop-files.ts`), or another store a host or a test gives the window.
 */
export interface PreviewDrive {
  /** Reads a file whole; `onProgress` hears the share received, 0 to 1. */
  read(id: string, onProgress?: (fraction: number) => void): Promise<Blob>;
  /** Writes a new file where the Save dialog chose, or in place of the file it replaces. */
  save(target: DriveSaveTarget, data: Blob): Promise<DriveEntry>;
  /**
   * Writes `data` in place of the file `entry`, under its own name and in its own folder; the
   * file replaced goes to the Trash. Resolves with the new file.
   */
  replace(entry: DriveEntry, data: Blob): Promise<DriveEntry>;
  /** The file `id` as the drive has it now; `undefined` when it is gone or in the Trash. */
  current(id: string): Promise<DriveEntry | undefined>;
  /** Marks the file opened, for Recents. */
  opened(id: string): void;
  /** Writes a new file in `folder`, its name made free when the folder has one of it already. */
  create(folder: string, name: string, data: Blob): Promise<DriveEntry>;
  /** Copies `entry` beside itself under `name`, made free the same way. */
  duplicate(entry: DriveEntry, name: string): Promise<DriveEntry>;
  /** Gives `entry` the name `name`, refused when its folder has one of it. */
  rename(entry: DriveEntry, name: string): Promise<DriveEntry>;
  /** Moves `entry` to `folder`, refused when that folder has one of its name. */
  move(entry: DriveEntry, folder: string): Promise<DriveEntry>;
  /** Every folder outside the Trash, by path. */
  folders(): Promise<PreviewFolder[]>;
}

const share = (onProgress?: (fraction: number) => void) => (done: number, total: number) =>
  onProgress?.(total > 0 ? done / total : 1);

/** The entry `id` in a drive a change answered with. */
function changed(drive: Awaited<ReturnType<typeof runOps>>, id: string): DriveEntry {
  const entry = entryOf(drive, id);
  if (!entry) throw new Error("The drive no longer has the file.");
  return entry;
}

/**
 * The person's drive on the desktop's Ferrite application, for `session`: a save for another person
 * than the one signed in by then is refused (`UploadOptions.session`).
 */
export const desktopPreviewDrive = (session?: string): PreviewDrive => ({
  read: (id, onProgress) => readFile(id, { onProgress: share(onProgress) }),
  save: (target, data) =>
    uploadFile(data, target.folder, {
      name: target.name,
      existing: target.replaces ? "replace" : "fail",
      replaces: target.replaces?.id,
      session,
    }),
  replace: (entry, data) => {
    if (!entry.parent) return Promise.reject(new Error("The file has no folder."));
    return uploadFile(data, entry.parent, {
      name: entry.name,
      existing: "replace",
      replaces: entry.id,
      session,
    });
  },
  current: async (id) => {
    const drive = await loadDrive();
    const entry = entryOf(drive, id);
    return entry && entry.trashed_ms === undefined ? entry : undefined;
  },
  opened: markOpened,
  create: (folder, name, data) => uploadFile(data, folder, { name, existing: "rename", session }),
  duplicate: async (entry, name) => {
    if (!entry.parent) throw new Error("The file has no folder.");
    const drive = await runOps(
      [{ op: "copy", id: entry.id, parent: entry.parent, name, existing: "rename" }],
      undefined,
      session,
    );
    const made = drive.created?.[0];
    if (!made) throw new Error("The drive made no copy.");
    return changed(drive, made);
  },
  rename: async (entry, name) =>
    changed(await runOps([{ op: "rename", id: entry.id, name }], undefined, session), entry.id),
  move: async (entry, folder) =>
    changed(
      await runOps(
        [{ op: "move", id: entry.id, parent: folder, existing: "fail" }],
        undefined,
        session,
      ),
      entry.id,
    ),
  folders: async () => {
    const drive = await loadDrive();
    return drive.entries
      .filter((entry) => entry.kind === "folder" && !inTrash(drive, entry.id))
      .map((entry) => ({
        id: entry.id,
        path: pathOf(drive, entry.id)
          .map((part) => part.name)
          .join(" ▸ "),
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
  },
});

/** The drive where the desktop app serves the page, for the session the page has now; none elsewhere. */
export const defaultPreviewDrive = (): PreviewDrive | null =>
  driveAvailable() ? desktopPreviewDrive(currentDesktopSession() ?? undefined) : null;

import { type DriveEntry, entryOf, inTrash, loadDrive, runOps } from "../desktop/desktop-files";
import { changeDesktopValue, desktopValues } from "../desktop/desktop-personal";
import { DEFAULT_SETTINGS } from "./mail-data";
import { MAIL_SETTINGS, readMailSettings } from "./mail-saved";

/** The desktop value that lists the files Mail saved to the drive itself, each as Mail left it. */
export const MAIL_DOWNLOADS = "mail.downloads";

interface SavedDownload {
  id: string;
  version: number;
  parent?: string;
  name: string;
  message: string;
}

const saved = (): readonly SavedDownload[] => {
  const stored = desktopValues()[MAIL_DOWNLOADS];
  return Array.isArray(stored) ? (stored as SavedDownload[]) : [];
};

const forget = (gone: readonly SavedDownload[]) => {
  const ids = new Set(gone.map(({ id }) => id));
  changeDesktopValue(
    MAIL_DOWNLOADS,
    saved().filter(({ id }) => !ids.has(id)),
  );
};

const choice = () =>
  readMailSettings(desktopValues()[MAIL_SETTINGS])?.remove ?? DEFAULT_SETTINGS.remove;

/** Mail put `entry` on the drive from `message`'s attachment. */
export function noteMailDownload(entry: DriveEntry, message: string): void {
  const { id, version = 0, parent, name } = entry;
  changeDesktopValue(MAIL_DOWNLOADS, [...saved(), { id, version, parent, name, message }]);
}

/**
 * Moves to the Trash those of `records` still as Mail saved them. One saved over, renamed, moved,
 * locked or already in the Trash is the person's.
 */
async function removeUnedited(records: readonly SavedDownload[]) {
  const drive = await loadDrive();
  const unedited = records.filter((record) => {
    const entry = entryOf(drive, record.id);
    return (
      entry !== undefined &&
      !inTrash(drive, record.id) &&
      (entry.version ?? 0) === record.version &&
      entry.parent === record.parent &&
      entry.name === record.name &&
      entry.locked !== true
    );
  });
  if (unedited.length > 0) await runOps(unedited.map(({ id }) => ({ op: "trash" as const, id })));
}

/**
 * Preferences > General > Remove unedited downloads, for a message erased from the server. A failure
 * leaves the files where they are: tidying up never stands in the way of the mail.
 */
export async function messageErased(message: string): Promise<void> {
  const records = saved().filter((record) => record.message === message);
  if (records.length === 0 || choice() === "When Mail Quits") return;
  try {
    if (choice() === "After Message is Deleted") await removeUnedited(records);
    forget(records);
  } catch {}
}

let running = 0;

/**
 * For an effect of a served Mail: when the last one has gone, Mail has quit. Waits a microtask, for a
 * remount in the same commit.
 */
export function mailRunning(): () => void {
  running += 1;
  return () => {
    running -= 1;
    queueMicrotask(() => {
      if (running === 0 && choice() === "When Mail Quits") void mailQuit();
    });
  };
}

async function mailQuit() {
  const records = saved();
  if (records.length === 0) return;
  try {
    await removeUnedited(records);
    forget(records);
  } catch {}
}

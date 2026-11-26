import type { Drive, DriveEntry } from "./desktop-files";
import { recentFiles } from "./desktop-files";

/** When Clear Menu last forgot the documents of Recent Items, in epoch milliseconds. */
export const RECENT_DOCUMENTS_CLEARED = "desktop.recentDocumentsClearedAt";

/** The most App Exposé's shelf shows. */
const MOST_SHELVED = 8;

/** App Exposé's shelf: one application's documents of Recent Items, however many of others' came since. */
export function shelfDocuments(
  drive: Drive | null,
  clearedAt: number,
  isApplications: (entry: DriveEntry) => boolean,
): DriveEntry[] {
  return recentDocuments(drive, clearedAt, Number.POSITIVE_INFINITY)
    .filter(isApplications)
    .slice(0, MOST_SHELVED);
}

/** The documents of Recent Items: files opened since the menu was cleared, newest first. */
export function recentDocuments(
  drive: Drive | null,
  clearedAt: number,
  count: number,
): DriveEntry[] {
  if (!drive) return [];
  return recentFiles(drive, drive.entries.length)
    .filter((entry) => (entry.opened_ms ?? 0) > clearedAt)
    .sort((a, b) => (b.opened_ms ?? 0) - (a.opened_ms ?? 0))
    .slice(0, count);
}

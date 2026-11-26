import { useSyncExternalStore } from "react";
import {
  currentDrive,
  type Drive,
  DriveError,
  type DriveOp,
  entryOf,
  onDriveChange,
  readFile,
  runOps,
  specialFolder,
  uploadFile,
} from "../desktop/desktop-files";

/**
 * A picture pasted over an item's icon in Get Info. A Mac keeps a custom icon in the item's own
 * resource fork, or in a hidden `Icon` file in a folder; the drive has neither, and a setting is too
 * small for a picture, so each is a hidden file of its own in Documents, named after the item's id.
 * It follows the item wherever it moves, and whoever signs in sees only their drive's.
 */

const PREFIX = ".icon-";
/** The largest picture taken for an icon, in bytes: each is held in memory while it shows. */
const LARGEST = 8_000_000;

const iconName = (item: string) => `${PREFIX}${item}`;

interface Shown {
  entry: string;
  version: number;
  url: string | null;
}

const shown = new Map<string, Shown>();
const listeners = new Set<() => void>();
let hearing = false;

const iconsOf = (drive: Drive) => drive.entries.filter((each) => each.name.startsWith(PREFIX));

function follow(drive: Drive) {
  const icons = new Map(iconsOf(drive).map((each) => [each.name.slice(PREFIX.length), each]));
  let changed = false;
  for (const [item, was] of shown) {
    if (icons.get(item)?.id === was.entry) continue;
    if (was.url) URL.revokeObjectURL(was.url);
    shown.delete(item);
    changed = true;
  }
  for (const [item, entry] of icons) {
    const version = entry.version ?? entry.modified_ms;
    const was = shown.get(item);
    if (was?.version === version) continue;
    const now: Shown = { entry: entry.id, version, url: was?.url ?? null };
    shown.set(item, now);
    // An icon that cannot be read leaves the item its drawn one: there is nothing else to say about it.
    void readFile(entry.id)
      .then((blob) => {
        if (shown.get(item) !== now) return;
        if (now.url) URL.revokeObjectURL(now.url);
        now.url = URL.createObjectURL(blob);
        for (const listener of listeners) listener();
      })
      .catch(() => undefined);
  }
  if (changed) for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  if (!hearing) {
    hearing = true;
    onDriveChange(follow);
    const drive = currentDrive();
    if (drive) follow(drive);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The address of the picture over the item's icon, or `null` when it keeps its own. */
export function useCustomIcon(item: string | undefined): string | null {
  return useSyncExternalStore(
    subscribe,
    () => (item ? (shown.get(item)?.url ?? null) : null),
    () => null,
  );
}

/** Puts `picture` over the item's icon, and clears the icons of items that have gone. */
export async function setCustomIcon(
  item: string,
  picture: Blob,
  session?: string | null,
): Promise<void> {
  if (picture.size > LARGEST) {
    throw new DriveError(413, "That picture is too large to use as an icon.");
  }
  const drive = currentDrive();
  const documents = drive && specialFolder(drive, "Documents");
  if (!drive || !documents) throw new DriveError(404, "The drive is not loaded yet.");
  const name = iconName(item);
  const existing = iconsOf(drive).find((each) => each.name === name);
  await uploadFile(picture, existing?.parent ?? documents.id, {
    name,
    session,
    ...(existing ? { existing: "overwrite", replaces: existing.id } : undefined),
  });
  const orphans = iconsOf(drive).flatMap((each): DriveOp[] =>
    entryOf(drive, each.name.slice(PREFIX.length)) ? [] : [{ op: "delete", id: each.id }],
  );
  if (orphans.length > 0) await runOps(orphans, undefined, session);
}

/** Gives the item its own icon back. */
export async function removeCustomIcon(item: string, session?: string | null): Promise<void> {
  const icon = currentDrive()?.entries.find((each) => each.name === iconName(item));
  if (icon) await runOps([{ op: "delete", id: icon.id }], undefined, session);
}

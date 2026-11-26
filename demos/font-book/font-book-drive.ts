/*
 * The fonts a person added, kept as files on their drive (`demos/desktop/desktop-files.ts`, the
 * `files` module of the desktop's Ferrite application), so Finder shows them and removing one there
 * removes it here. They live in Documents/Fonts: the drive has no Library folder to hold them.
 */

import {
  childrenOf,
  type Drive,
  DriveError,
  driveAvailable,
  ensureFolder,
  loadDrive,
  readFile,
  runOps,
  SPECIAL_FOLDER_IDS,
  uploadFile,
} from "../desktop/desktop-files";
import { currentDesktopSession } from "../desktop/desktop-server";
import { REMOVED_FOLDER } from "./font-book-data";
import { isFontFile } from "./font-book-tables";
import type { KeptFontFile } from "./font-book-validate";

const FOLDER = "Fonts";
const { Documents: DOCUMENTS } = SPECIAL_FOLDER_IDS;

export { driveAvailable };

/** The family a font file is listed as: its name, without the extension. */
export const familyNameOf = (fileName: string) => fileName.replace(/\.[^.]+$/, "").trim();

/** The font files on the drive. Opening Font Book makes no folder; a desktop with no drive has none. */
export async function keptFonts(): Promise<readonly KeptFontFile[]> {
  let drive: Drive;
  try {
    drive = await loadDrive();
  } catch (error) {
    if (error instanceof DriveError && error.status === 404) return [];
    throw error;
  }
  const folder = childrenOf(drive, DOCUMENTS).find(
    (entry) => entry.kind === "folder" && entry.name === FOLDER,
  );
  if (!folder) return [];
  return childrenOf(drive, folder.id)
    .filter((entry) => entry.kind === "file" && isFontFile(entry.name))
    .map(({ id, name, size }) => ({ id, name, size }));
}

export const readKeptFont = (id: string): Promise<Blob> => readFile(id);

/** Keeps a font file on the drive, and answers its id there. */
export async function keepFont(file: File): Promise<string> {
  const session = currentDesktopSession();
  const folder = await ensureFolder(DOCUMENTS, FOLDER, session);
  return (await uploadFile(file, folder.id, { name: file.name, existing: "rename", session })).id;
}

/** File > Export Fonts: copies of the files in a folder named `name` of the folder `parent`. */
export async function exportFontFiles(
  files: readonly File[],
  parent: string,
  name: string,
): Promise<void> {
  const session = currentDesktopSession();
  const folder = await ensureFolder(parent, name, session);
  for (const file of files) {
    await uploadFile(file, folder.id, { name: file.name, existing: "rename", session });
  }
}

/** File > Restore Standard Fonts: every kept font goes to a folder beside theirs. Answers how many. */
export async function moveKeptFontsAside(): Promise<number> {
  const files = await keptFonts();
  if (files.length === 0) return 0;
  const folder = await ensureFolder(DOCUMENTS, REMOVED_FOLDER);
  await runOps(
    files.map(({ id }) => ({ op: "move", id, parent: folder.id, existing: "rename" }) as const),
  );
  return files.length;
}

/** Moves a kept font to the Trash; one the drive no longer has is already gone. */
export async function trashKeptFont(id: string): Promise<void> {
  try {
    await runOps([{ op: "trash", id }]);
  } catch (error) {
    if (!(error instanceof DriveError && error.status === 404)) throw error;
  }
}

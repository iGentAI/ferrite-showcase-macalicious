/*
 * Photos' originals on the person's drive, through the drive's browser helper
 * (`demos/desktop/desktop-files.ts`, the `files` module of the desktop's Ferrite application),
 * so Finder shows them in Pictures. The helper uploads a file in pieces, one request each under
 * the gateway's 256 KiB request limit, and reads it back several pieces a request. Imported
 * photos go in Pictures, Photo Booth's in Pictures/Photo Booth.
 */

import {
  DriveError,
  ensureFolder,
  readFile,
  runOps,
  SPECIAL_FOLDER_IDS,
  uploadFile,
} from "../desktop/desktop-files";

/** The drive's Pictures folder, which always exists. */
export const PICTURES = SPECIAL_FOLDER_IDS.Pictures;

/**
 * The folder originals go in: Pictures, or a folder of that name inside it, made once. `session` is
 * as `UploadOptions.session` means it: a task of several steps takes it once and names it in each.
 */
export async function picturesFolder(name?: string, session?: string | null): Promise<string> {
  if (!name) return PICTURES;
  return (await ensureFolder(PICTURES, name, session)).id;
}

/** Upload `blob` into folder `parent` as `name` (renamed when taken): the new file's id. */
export async function uploadToDrive(
  parent: string,
  name: string,
  blob: Blob,
  session?: string | null,
): Promise<string> {
  return (await uploadFile(blob, parent, { name, existing: "rename", session })).id;
}

/** The bytes of drive file `id`, typed `type` when the drive names no type. */
export async function readDriveFile(id: string, type: string): Promise<Blob> {
  const blob = await readFile(id);
  return blob.type && blob.type !== "application/octet-stream" ? blob : new Blob([blob], { type });
}

/** Delete drive file `id` for good; a file the drive no longer has is already deleted. */
export async function deleteDriveFile(id: string): Promise<void> {
  try {
    await runOps([{ op: "delete", id }]);
  } catch (error) {
    if (error instanceof DriveError && error.status === 404) return;
    throw error;
  }
}

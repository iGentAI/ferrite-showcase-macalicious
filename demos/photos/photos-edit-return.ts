import type { DriveEntry } from "../desktop/desktop-files";
import { entryOf, loadDrive, uploadFile } from "../desktop/desktop-files";
import { currentDesktopSession } from "../desktop/desktop-server";
import { deleteDriveFile, picturesFolder } from "./photos-drive";
import { encodeJpeg, isIdentity, NO_EDIT, renderEdit, withoutFile } from "./photos-edit";
import { copyOpenAs, type EditWithCopy, editWithCopies, keepCopy } from "./photos-edit-with";
import {
  announceChange,
  changePhoto,
  decodePicture,
  type LibraryPhoto,
  readOriginal,
  thumbnailOf,
} from "./photos-library";

/** The drive folder of the copies, in Pictures. */
const COPIES_FOLDER = "Photos Edits";

const deleteQuietly = (file: string | undefined) =>
  file ? deleteDriveFile(file).catch(() => undefined) : Promise.resolve();

/**
 * The file Edit With opens in Preview for `photo`: the copy already open, what Preview last saved of
 * it when nothing has changed since, or a new copy as the photo shows now, its edit drawn in.
 */
export async function copyForPreview(photo: LibraryPhoto, name: string): Promise<DriveEntry> {
  const session = currentDesktopSession();
  const at = photo.edited_ms ?? 0;
  const kept: EditWithCopy | undefined = editWithCopies()[photo.file];
  const external = photo.edit?.external;
  const asSaved = photo.edit && external && isIdentity(withoutFile(photo.edit));
  const standing = kept?.at === at ? kept.open : asSaved ? external : undefined;
  if (standing) {
    const entry = entryOf(await loadDrive(), standing);
    if (entry && entry.trashed_ms === undefined) {
      if (!kept)
        keepCopy(photo.file, { photo: photo.id, open: standing, base: standing, at, held: true });
      return entry;
    }
  }
  let picture = await readOriginal(photo);
  if (photo.edit) {
    const decoded = await decodePicture(picture);
    try {
      const side = Math.max(decoded.width, decoded.height);
      const drawn = await encodeJpeg(
        renderEdit(decoded, photo.edit, side),
        Number.MAX_SAFE_INTEGER,
        [0.92],
      );
      if (!drawn) throw new Error("this browser could not draw the edited photo");
      picture = drawn;
    } finally {
      decoded.close();
    }
  }
  const folder = await picturesFolder(COPIES_FOLDER, session);
  const made = await uploadFile(picture, folder, {
    name: photo.edit ? name.replace(/\.[^.]+$/, ".jpg") : name,
    existing: "rename",
    session,
  });
  // A copy of an earlier state nobody saved: the one that replaces it starts again from the photo.
  if (kept && kept.open !== kept.base) await deleteQuietly(kept.open);
  keepCopy(photo.file, {
    ...kept,
    ...(external ? { base: external, held: true } : {}),
    photo: photo.id,
    open: made.id,
    at,
  });
  return made;
}

/**
 * Preview saved the file `from`, as `saved`: when that was a copy from Edit With, the picture comes
 * back as the photo's edit, whichever windows are open. Answers whether it was such a copy.
 */
export async function returnToPhotos(
  from: string,
  saved: DriveEntry,
  picture: Blob,
): Promise<boolean> {
  const found = copyOpenAs(from);
  if (!found) return false;
  const [original, copy] = found;
  const decoded = await decodePicture(picture);
  let thumb: Blob;
  try {
    thumb = await thumbnailOf(decoded);
  } finally {
    decoded.close();
  }
  const photo = await changePhoto(copy.photo, {
    edit: { ...NO_EDIT, external: saved.id },
    thumb,
  });
  keepCopy(original, {
    photo: copy.photo,
    open: saved.id,
    base: saved.id,
    at: photo.edited_ms ?? 0,
    held: true,
  });
  if (copy.base !== from) await deleteQuietly(copy.base);
  announceChange();
  return true;
}

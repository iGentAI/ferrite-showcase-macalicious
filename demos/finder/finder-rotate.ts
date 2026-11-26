import { type DriveEntry, readFileEntry, uploadFile } from "../desktop/desktop-files";

/** What a canvas can write back as the same kind of file. */
const KEPT_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * Rotate Left for a picture on the drive: its pixels turned a quarter to the left and saved over the
 * file, as Quick Look and the Preview pane do on a Mac. Answers whether the file now holds the turn: a
 * kind the browser cannot write back stays as it is.
 */
export async function saveTurnedLeft(entry: DriveEntry, session?: string | null): Promise<boolean> {
  if (!canWritePicture(entry)) return false;
  const { blob } = await readFileEntry(entry.id);
  const picture = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = picture.height;
  canvas.height = picture.width;
  const context = canvas.getContext("2d");
  if (!context) return false;
  context.translate(0, canvas.height);
  context.rotate(-Math.PI / 2);
  context.drawImage(picture, 0, 0);
  picture.close();
  return writePictureBack(canvas, entry, session);
}

/** Whether a canvas can write this drive file back as the same kind of file. */
const canWritePicture = (entry: DriveEntry) =>
  Boolean(entry.parent) && KEPT_TYPES.has(entry.type ?? "");

/** Saves `canvas` over the picture, in its own kind. Answers whether the file now holds it. */
export async function writePictureBack(
  canvas: HTMLCanvasElement,
  entry: DriveEntry,
  session?: string | null,
): Promise<boolean> {
  if (!entry.parent || !canWritePicture(entry)) return false;
  const written = await new Promise<Blob | null>((done) =>
    canvas.toBlob(done, entry.type, entry.type === "image/png" ? undefined : 0.92),
  );
  // A browser that cannot write this kind answers another.
  if (!written || written.type !== entry.type) return false;
  await uploadFile(written, entry.parent, {
    name: entry.name,
    existing: "replace",
    replaces: entry.id,
    session,
  });
  return true;
}

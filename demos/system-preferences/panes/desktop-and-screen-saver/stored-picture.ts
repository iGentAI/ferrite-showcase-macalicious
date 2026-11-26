import { readFile, SPECIAL_FOLDER_IDS, uploadFile } from "../../../desktop/desktop-files";
import {
  changeDesktopValue,
  currentPictureChoice,
  type DesktopPictureDetail,
  desktopPictureGeneration,
  isLatestPictureChoice,
  showDesktopPicture,
  takePictureChoice,
} from "../../../desktop/desktop-personal";
import { servedByDesktopApp, sessionFetch } from "../../../desktop/desktop-server";
import { announceDesktopPicture, builtInPictureDetail, isBuiltInPicture } from "./artwork";
import { followPictureChanges } from "./picture-rotation";
import { type DesktopMode, drivePicture, PICTURE_KEY } from "./pictures";

export { drivePicture, PICTURE_KEY };

/**
 * The desktop picture the person chose, as System Preferences keeps it with its settings, and how
 * it is shown again when the desktop starts. The choice is one setting,
 * `desktop-and-screen-saver.picture`:
 *
 * - the id of one of the pane's pictures (`catalina`, `mountains`, ...), with
 *   `desktop-and-screen-saver.mode` for a dynamic one;
 * - `drive:<id>`, a picture file of the person's drive (`/api/files/`), uploaded from the pane's
 *   Add button, put in Pictures by Finder, or saved there when the person made a photo the
 *   desktop picture in Photos (Set Desktop Picture; `keepPhotosPicture`).
 *
 * A value `photos` stored before Photos' pictures were saved to the drive names no picture that
 * can be read again, and counts as no choice.
 */

export const MODE_KEY = "desktop-and-screen-saver.mode";
/** The `source` of a picture Photos names to the desktop. */
export const PHOTOS_PICTURE = "photos";
/** The name a photo made the desktop picture in Photos is saved under, in Pictures. */
export const PHOTOS_PICTURE_NAME = "Desktop Picture.jpg";
const DRIVE_PREFIX = "drive:";

/** The drive file a choice names, or `undefined`. */
export function driveFileOf(picture: string): string | undefined {
  if (!picture.startsWith(DRIVE_PREFIX)) return undefined;
  const id = picture.slice(DRIVE_PREFIX.length);
  return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : undefined;
}

const isMode = (value: unknown): value is DesktopMode =>
  value === "dynamic" || value === "light" || value === "dark";

/** The picture and mode `values` hold, or `undefined` when no picture was chosen. */
export function storedPictureChoice(
  values: Readonly<Record<string, unknown>> | null,
): { picture: string; mode: DesktopMode } | undefined {
  const picture = values?.[PICTURE_KEY];
  if (typeof picture !== "string") return undefined;
  if (!isBuiltInPicture(picture) && !driveFileOf(picture)) {
    return undefined;
  }
  const mode = values?.[MODE_KEY];
  return { picture, mode: isMode(mode) ? mode : "dynamic" };
}

// The person's choices of a desktop picture are counted with the desktop's picture
// (`desktop-personal.ts`), so that Photos takes them the same way.
export { currentPictureChoice, isLatestPictureChoice, takePictureChoice };

/** The person picks one of the pane's pictures, or a mode for it: shown at once. */
export function chooseBuiltInPicture(picture: string, mode: DesktopMode): void {
  takePictureChoice();
  announceDesktopPicture(picture, mode);
}

// The address of the picture made from a file or a photo that the desktop shows now. It is given
// back when another such picture replaces it, a moment later, once the desktop has the new one.
let shownUrl: string | null = null;

/** Show `blob` if `current()` still holds when it has been read; whether it was shown. */
function showBlob(
  blob: Blob,
  current: () => boolean,
  detail: Omit<DesktopPictureDetail, "day" | "night">,
): boolean {
  if (!current()) return false;
  const url = URL.createObjectURL(blob);
  const previous = shownUrl;
  shownUrl = url;
  showDesktopPicture({ ...detail, day: url, night: url, look: "auto" });
  if (previous) setTimeout(() => URL.revokeObjectURL(previous), 2_000);
  return true;
}

/** The picture last made from a file or a photo, while the desktop shows it. */
export const shownPictureUrl = (): string | null => shownUrl;

/**
 * Whether `blob` decodes as a picture the browser can show: a corrupt file, or one in a format the
 * browser cannot draw, is refused before it is shown or kept. Where the browser has no way to
 * decode off screen (a test page), the type alone is taken.
 */
async function decodes(blob: Blob): Promise<boolean> {
  if (typeof createImageBitmap === "function") {
    try {
      (await createImageBitmap(blob)).close();
      return true;
    } catch {
      return false;
    }
  }
  if (typeof Image === "function" && typeof Image.prototype.decode === "function") {
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      return true;
    } catch {
      return false;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return true;
}

/** Read a drive picture; it must be an image the browser can show. */
async function readPicture(id: string, signal?: AbortSignal): Promise<Blob> {
  const blob = await readFile(id, { signal });
  if (signal?.aborted) throw signal.reason;
  if (!blob.type.startsWith("image/")) throw new Error("That file is not a picture.");
  if (!(await decodes(blob))) throw new Error("That picture cannot be shown.");
  if (signal?.aborted) throw signal.reason;
  return blob;
}

/**
 * Read the drive file `id` and make it the desktop picture, for the person's `choice` (taken when
 * they acted): shown only if that choice is still the newest, and the session the same, when the
 * file has been read. Only then is it kept as the person's wallpaper: a read that fails, or that a
 * newer choice overtook, leaves the earlier wallpaper as it was. Resolves with whether it was
 * shown.
 */
export async function showDrivePicture(
  id: string,
  choice: number,
  signal?: AbortSignal,
): Promise<boolean> {
  const generation = desktopPictureGeneration();
  const blob = await readPicture(id, signal);
  const shown = showBlob(
    blob,
    () => isLatestPictureChoice(choice) && generation === desktopPictureGeneration(),
    { source: "system-preferences", file: id },
  );
  if (shown) changeDesktopValue(PICTURE_KEY, drivePicture(id));
  return shown;
}

/**
 * Keep a photo that Photos showed as the desktop picture (`detail`, with the ticket Photos took
 * when the person chose Set Desktop Picture): its picture is saved as a file of the person's
 * drive, in Pictures, so the choice is `drive:<id>` and is shown again the way any drive picture
 * is. Answers that choice, or `null` when the person made a newer choice, or the session ended,
 * while it was saved: the newer choice wins. `load` reads the picture the desktop was given (a
 * `blob:` address of the page), through the demos' one request helper like every other read;
 * the helper leaves an address outside `/api/` as it is.
 */
export async function keepPhotosPicture(
  detail: DesktopPictureDetail,
  signal?: AbortSignal,
  load: (url: string) => Promise<Blob> = async (url) => {
    const response = await sessionFetch(url, { signal });
    if (!response.ok) throw new Error(`the picture could not be read (${response.status})`);
    return response.blob();
  },
): Promise<string | null> {
  const { choice, generation, day } = detail;
  if (choice === undefined || generation === undefined || !day) return null;
  const current = () =>
    !signal?.aborted && isLatestPictureChoice(choice) && generation === desktopPictureGeneration();
  if (!current()) return null;
  const blob = await load(day);
  if (!current()) return null;
  const entry = await uploadFile(blob, SPECIAL_FOLDER_IDS.Pictures, {
    name: PHOTOS_PICTURE_NAME,
    signal,
  });
  return current() ? drivePicture(entry.id) : null;
}

/**
 * The desktop goes on to `picture` by itself (Change picture, picture-rotation.ts): a choice like
 * the person's, so a picture still being read gives way to it.
 */
function changeTo(picture: string): void {
  const file = driveFileOf(picture);
  if (file === undefined) {
    changeDesktopValue(PICTURE_KEY, picture);
    chooseBuiltInPicture(picture, "dynamic");
    return;
  }
  showDrivePicture(file, takePictureChoice()).catch((error: unknown) =>
    console.warn(`The desktop could not change its picture (${error})`),
  );
}

/**
 * Show the desktop picture `values` hold, when the desktop starts: nothing for no choice (the
 * desktop keeps its own Catalina picture), and nothing for a file that can no longer be read. It
 * is no choice of the person's: it is shown only if they have made none since `since` (the newest
 * choice when the settings were asked for) by the time it is ready, and only for the same
 * session. `signal` gives the read up.
 */
export async function showStoredPicture(
  values: Readonly<Record<string, unknown>> | null,
  signal?: AbortSignal,
  since: number = currentPictureChoice(),
): Promise<void> {
  followPictureChanges(changeTo);
  const stored = storedPictureChoice(values);
  const generation = desktopPictureGeneration();
  const current = () =>
    currentPictureChoice() === since && generation === desktopPictureGeneration();
  if (!stored || !current()) return;
  const { picture, mode } = stored;
  const builtIn = builtInPictureDetail(picture, mode);
  if (builtIn) {
    showDesktopPicture({ ...builtIn, source: "system-preferences", restored: true });
    return;
  }
  const file = driveFileOf(picture);
  if (!servedByDesktopApp() || file === undefined) return;
  try {
    const blob = await readPicture(file, signal);
    if (signal?.aborted || blob.size === 0) return;
    showBlob(blob, current, { source: "system-preferences", restored: true, file });
  } catch (error) {
    if (signal?.aborted) return;
    console.warn(`The desktop could not show its picture again (${error})`);
  }
}

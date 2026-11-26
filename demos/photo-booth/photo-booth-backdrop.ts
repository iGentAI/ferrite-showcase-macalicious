import {
  childrenOf,
  driveAvailable,
  ensureFolder,
  loadDrive,
  readFile,
  SPECIAL_FOLDER_IDS,
  uploadFile,
} from "../desktop/desktop-files";
import { currentDesktopSession } from "../desktop/desktop-server";

/*
 * Backdrops: the background of the camera's picture replaced, with no depth camera and no person
 * segmentation in the browser. The window learns the empty background from a frame taken while the
 * person steps out; what differs from that frame afterwards is kept, and the rest is the backdrop.
 * So it asks for a still camera and steady light, as Photo Booth does: a moved camera shows the old
 * background through.
 */

/** The backdrops the window draws itself: no picture of Apple's is shipped. */
const DRAWN: Record<string, readonly (readonly [number, string])[]> = {
  "backdrop-sunset": [
    [0, "#27235f"],
    [0.55, "#d9576b"],
    [1, "#f8c15c"],
  ],
  "backdrop-ocean": [
    [0, "#bfe7f7"],
    [0.5, "#3f9fd0"],
    [1, "#0c3b66"],
  ],
  "backdrop-aurora": [
    [0, "#08142e"],
    [0.5, "#1f8f76"],
    [1, "#0a1f2e"],
  ],
  "backdrop-stage": [
    [0, "#15080c"],
    [0.7, "#8a1a2b"],
    [1, "#2a0a10"],
  ],
};

/** The slots of the person's own backdrops, in the order of their files' names. */
export const USER_BACKDROPS = [
  "backdrop-user-1",
  "backdrop-user-2",
  "backdrop-user-3",
  "backdrop-user-4",
] as const;

/** What an empty slot says: the way to fill it. */
export const EMPTY_BACKDROP = "Drag Backdrops Here";
/** What a filled slot is called. */
export const USER_BACKDROP = "User Backdrop";

export const isBackdrop = (id: string) => id.startsWith("backdrop-");

const PICTURE_FILE = /\.(png|jpe?g|gif|webp|bmp)$/i;
export const isBackdropPicture = ({ name }: { name: string }) => PICTURE_FILE.test(name);

/** How far a pixel may differ from the empty frame and still be background, and where it is sure. */
const BACKGROUND = 36;
const PERSON = 84;

/** Blurs one byte per pixel with a box of `radius`, horizontally then vertically, in place. */
function blurMask(mask: Uint8ClampedArray, width: number, height: number, radius: number) {
  const line = new Uint8ClampedArray(mask.length);
  const across = 2 * radius + 1;
  const pass = (
    from: Uint8ClampedArray,
    to: Uint8ClampedArray,
    lines: number,
    length: number,
    lineStep: number,
    step: number,
  ) => {
    for (let each = 0; each < lines; each += 1) {
      const start = each * lineStep;
      let sum = 0;
      for (let i = -radius; i <= radius; i += 1) {
        sum += from[start + Math.max(0, Math.min(length - 1, i)) * step] as number;
      }
      for (let i = 0; i < length; i += 1) {
        to[start + i * step] = sum / across;
        sum +=
          (from[start + Math.min(length - 1, i + radius + 1) * step] as number) -
          (from[start + Math.max(0, i - radius) * step] as number);
      }
    }
  };
  pass(mask, line, height, width, width, 1);
  pass(line, mask, width, height, 1, width);
}

/**
 * Which of `frame` is not the empty background: one byte per pixel, 0 for background and 255 for
 * what is in front of it, soft at the edge. A speck of camera noise is smoothed away first.
 */
export function foregroundMask(
  frame: Uint8ClampedArray,
  empty: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const mask = new Uint8ClampedArray(width * height);
  for (let i = 0, at = 0; i < mask.length; i += 1, at += 4) {
    mask[i] =
      Math.abs((frame[at] as number) - (empty[at] as number)) +
      Math.abs((frame[at + 1] as number) - (empty[at + 1] as number)) +
      Math.abs((frame[at + 2] as number) - (empty[at + 2] as number));
  }
  const radius = Math.max(1, Math.round(width / 320));
  blurMask(mask, width, height, radius);
  for (let i = 0; i < mask.length; i += 1) {
    mask[i] = (((mask[i] as number) - BACKGROUND) / (PERSON - BACKGROUND)) * 255;
  }
  blurMask(mask, width, height, radius);
  return mask;
}

/** `frame`, in place, with what is the empty background replaced by `backdrop`. */
export function replaceBackground(
  frame: Uint8ClampedArray,
  empty: Uint8ClampedArray,
  backdrop: Uint8ClampedArray,
  width: number,
  height: number,
): void {
  const mask = foregroundMask(frame, empty, width, height);
  for (let i = 0, at = 0; i < mask.length; i += 1, at += 4) {
    const keep = (mask[i] as number) / 255;
    for (let channel = at; channel < at + 3; channel += 1) {
      frame[channel] =
        (frame[channel] as number) * keep + (backdrop[channel] as number) * (1 - keep);
    }
  }
}

/** `whole`: the backdrop alone, as a preview. `learning`: the camera as it is. `ready`: replaced. */
type Stage = "whole" | "learning" | "ready";
let stage: Stage = "whole";
let emptyFrame: HTMLCanvasElement | null = null;
const pictures = new Map<string, ImageBitmap>();
const pixels = new Map<string, Uint8ClampedArray>();

const forgetPixels = () => pixels.clear();

export function setBackdropStage(next: Stage): void {
  stage = next;
}

/** The empty background, as a frame the camera view crops: not mirrored. */
export function learnEmptyFrame(frame: HTMLCanvasElement): void {
  emptyFrame = frame;
  forgetPixels();
  stage = "ready";
}

export function setBackdropPicture(id: string, picture: ImageBitmap | null): void {
  if (picture) pictures.set(id, picture);
  else pictures.delete(id);
  forgetPixels();
}

/** The pixels `draw` paints at one size, kept for as long as nothing changes them. */
function pixelsOf(
  key: string,
  width: number,
  height: number,
  draw: (context: CanvasRenderingContext2D) => void,
): Uint8ClampedArray | null {
  const known = pixels.get(key);
  if (known) return known;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  draw(context);
  const read = context.getImageData(0, 0, width, height).data;
  // A window dragged through many sizes leaves no trail behind it.
  if (pixels.size >= 32) pixels.clear();
  pixels.set(key, read);
  return read;
}

function backdropPixels(id: string, width: number, height: number): Uint8ClampedArray | null {
  const stops = DRAWN[id];
  const picture = pictures.get(id);
  if (!stops && !picture) return null;
  return pixelsOf(`${id}:${width}x${height}`, width, height, (context) => {
    if (picture) {
      const scale = Math.max(width / picture.width, height / picture.height);
      const [w, h] = [picture.width * scale, picture.height * scale];
      context.drawImage(picture, (width - w) / 2, (height - h) / 2, w, h);
      return;
    }
    const sky = context.createLinearGradient(0, 0, 0, height);
    for (const [at, colour] of stops ?? []) sky.addColorStop(at, colour);
    context.fillStyle = sky;
    context.fillRect(0, 0, width, height);
  });
}

/**
 * A backdrop effect on a frame of RGBA pixels, in place. `mirrored` says which way round the frame
 * is drawn, as the empty frame is compared with it. A slot with no picture leaves the frame, and a
 * frame of another shape than the empty one (a preview) shows the backdrop alone.
 */
export function computeBackdrop(
  id: string,
  data: Uint8ClampedArray,
  width: number,
  height: number,
  mirrored: boolean,
): void {
  if (stage === "learning") return;
  const backdrop = backdropPixels(id, width, height);
  if (!backdrop) return;
  const learned = emptyFrame;
  const sameShape =
    learned !== null && Math.abs(learned.width / learned.height - width / height) < 0.02;
  if (stage === "whole" || !sameShape) {
    data.set(backdrop);
    return;
  }
  const empty = pixelsOf(`empty:${width}x${height}:${mirrored}`, width, height, (context) => {
    if (mirrored) {
      context.translate(width, 0);
      context.scale(-1, 1);
    }
    context.drawImage(learned, 0, 0, width, height);
  });
  if (empty) replaceBackground(data, empty, backdrop, width, height);
}

/** Where the person's own backdrops live on the drive: Finder shows them, and removes them there. */
const FOLDER = "Photo Booth Backdrops";
const { Documents: DOCUMENTS } = SPECIAL_FOLDER_IDS;

/** Reads the backdrops on the drive into their slots, and answers the slots they fill. */
export async function loadBackdrops(): Promise<readonly string[]> {
  if (!driveAvailable()) return [];
  const drive = await loadDrive();
  const folder = childrenOf(drive, DOCUMENTS).find(
    (entry) => entry.kind === "folder" && entry.name === FOLDER,
  );
  const files = folder
    ? childrenOf(drive, folder.id)
        .filter((entry) => entry.kind === "file" && isBackdropPicture(entry))
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];
  const filled: string[] = [];
  for (const [at, slot] of USER_BACKDROPS.entries()) {
    const file = files[at];
    const picture = file
      ? await createImageBitmap(await readFile(file.id)).catch(() => null)
      : null;
    setBackdropPicture(slot, picture);
    if (picture) filled.push(slot);
  }
  return filled;
}

/** Keeps a picture as a backdrop on the drive. Rejects when it is not a picture the browser reads. */
export async function keepBackdrop(file: File): Promise<void> {
  (await createImageBitmap(file)).close();
  const session = currentDesktopSession();
  const folder = await ensureFolder(DOCUMENTS, FOLDER, session);
  await uploadFile(file, folder.id, { name: file.name, existing: "rename", session });
}

import { MAX_IMAGE_CHARS } from "./contacts-server";

/** The largest side of a card's picture, in pixels. */
export const MAX_PICTURE_SIDE = 256;

/** The JPEG qualities tried, best first, until the picture fits under `MAX_IMAGE_CHARS`. */
const QUALITIES = [0.85, 0.75, 0.6, 0.45, 0.3];

/** Whether a file's media type or name is a picture a card can take. */
export function isPictureFile(type: string | undefined, name: string): boolean {
  return (
    /^image\/(jpeg|png|gif|webp|bmp)$/i.test(type ?? "") ||
    /\.(jpe?g|png|gif|webp|bmp)$/i.test(name)
  );
}

/** How a picture sits in its square: 1 and up, and where the square stands in what is left over. */
export interface PictureCrop {
  zoom: number;
  /** 0 at the left edge of the image, 1 at the right. */
  x: number;
  /** 0 at the top of the image, 1 at the bottom. */
  y: number;
}

const MIDDLE: PictureCrop = { zoom: 1, x: 0.5, y: 0.5 };

/** The square of an image of `width` by `height` pixels that `crop` keeps. */
export function cropSquare(
  width: number,
  height: number,
  crop: PictureCrop,
): { sx: number; sy: number; side: number } {
  const side = Math.min(width, height) / Math.max(1, crop.zoom);
  return { sx: (width - side) * crop.x, sy: (height - side) * crop.y, side };
}

/** The image of `blob`, decoded, with its size. */
async function decode(
  blob: Blob,
): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        done: () => bitmap.close(),
      };
    } catch {
      // Some engines decode fewer kinds this way: try an <img>.
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      done: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/**
 * A picture for a card from an image file: the square `crop` keeps, by default the middle of the
 * image, at most `maxSide` pixels a side, as a JPEG `data:` URL of at most `maxChars`
 * characters (the quality is lowered, then the size, until it fits). Rejects when the file is
 * not an image the browser can read.
 */
export async function pictureFromBlob(
  blob: Blob,
  maxSide = MAX_PICTURE_SIDE,
  maxChars = MAX_IMAGE_CHARS,
  crop: PictureCrop = MIDDLE,
): Promise<string> {
  const image = await decode(blob);
  try {
    if (!image.width || !image.height) throw new Error("The picture is empty.");
    const { sx, sy, side: kept } = cropSquare(image.width, image.height, crop);
    // The largest side first; a picture too big at every quality is tried at half the size,
    // down to 16 pixels. A picture smaller than that is tried at its own size.
    for (let side = Math.ceil(Math.min(maxSide, kept)); ; side = Math.floor(side / 2)) {
      const canvas = document.createElement("canvas");
      canvas.width = side;
      canvas.height = side;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser cannot draw the picture.");
      // A JPEG has no transparency: what is transparent in a PNG becomes white.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, side, side);
      context.imageSmoothingQuality = "high";
      context.drawImage(image.source, sx, sy, kept, kept, 0, 0, side, side);
      for (const quality of QUALITIES) {
        const url = canvas.toDataURL("image/jpeg", quality);
        if (url.startsWith("data:image/jpeg;base64,") && url.length <= maxChars) return url;
      }
      if (side <= 16) break;
    }
    throw new Error("The picture could not be made small enough.");
  } finally {
    image.done();
  }
}

/** A new version for a card's picture: letters, digits and `-`, as the server takes it. */
export function newPictureVersion(): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `p-${random}`;
}

/** A `data:` URL as a `Blob`, to save a picture read from a vCard. */
export function blobOfDataUrl(url: string): Blob {
  const match = /^data:([^;,]+);base64,(.*)$/.exec(url);
  if (!match) throw new Error("Not a data URL.");
  const bytes = atob(match[2] ?? "");
  const array = new Uint8Array(bytes.length);
  for (let at = 0; at < bytes.length; at += 1) array[at] = bytes.charCodeAt(at);
  return new Blob([array], { type: match[1] });
}

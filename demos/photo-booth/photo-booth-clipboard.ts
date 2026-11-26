import { decodePicture } from "../photos/photos-library";

/** Why Edit > Paste dims in a browser whose pages cannot ask for the clipboard's pictures. */
export const NO_CLIPBOARD_READ =
  "This browser does not let a menu read pictures from its clipboard. Press Command-V instead.";

/** Whether this browser takes a picture onto the computer's clipboard. */
export const canWriteClipboardPicture = () =>
  typeof ClipboardItem === "function" && typeof navigator.clipboard?.write === "function";

/** Whether a menu row can ask this browser for the pictures on the computer's clipboard. */
export const canReadClipboardPictures = () => typeof navigator.clipboard?.read === "function";

async function pngOf(picture: Blob): Promise<Blob> {
  const decoded = await decodePicture(picture);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = decoded.width;
    canvas.height = decoded.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("the picture could not be drawn");
    context.drawImage(decoded.image, 0, 0);
    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("the picture could not be drawn"))),
        "image/png",
      );
    });
  } finally {
    decoded.close();
  }
}

/** How far a channel can differ for two pictures to be one, after a change of format. */
const PIXEL_TOLERANCE = 2;

async function pixelsOf(picture: Blob) {
  const decoded = await decodePicture(picture);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = decoded.width;
    canvas.height = decoded.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("the picture could not be drawn");
    context.drawImage(decoded.image, 0, 0);
    return context.getImageData(0, 0, decoded.width, decoded.height);
  } finally {
    decoded.close();
  }
}

/** Whether two pictures show the same thing whatever format each is in, pixel by pixel. */
export async function samePicture(a: Blob, b: Blob): Promise<boolean> {
  const [first, second] = await Promise.all([pixelsOf(a), pixelsOf(b)]);
  if (first.width !== second.width || first.height !== second.height) return false;
  return first.data.every(
    (value, at) => Math.abs(value - (second.data[at] ?? 0)) <= PIXEL_TOLERANCE,
  );
}

/**
 * Puts a picture on the computer's clipboard as a PNG, the one picture type every browser's
 * clipboard takes. The item is built in the same task as the press and given a promise of its
 * bytes, because WebKit refuses a clipboard write begun after an await.
 */
export function writeClipboardPicture(picture: Promise<Blob>): Promise<void> {
  return navigator.clipboard.write([new ClipboardItem({ "image/png": picture.then(pngOf) })]);
}

/** What the computer's clipboard holds, as far as Photo Booth cares. */
export type ClipboardSeen = { pictures: readonly Blob[]; text: string };

/** What is on the computer's clipboard. The browser may ask the person first, or refuse, which throws. */
export async function readClipboardSeen(): Promise<ClipboardSeen> {
  const pictures: Blob[] = [];
  let text = "";
  for (const item of await navigator.clipboard.read()) {
    const type = item.types.find((each) => each.startsWith("image/"));
    if (type) pictures.push(await item.getType(type));
    if (item.types.includes("text/plain")) {
      text ||= await (await item.getType("text/plain")).text();
    }
  }
  return { pictures, text };
}

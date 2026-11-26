import { MAX_HTML, utf8Bytes } from "./stickies-sync";

/*
 * Pictures in a note. A note is one row of formatted text on the server, so a picture travels in it
 * as a data address, redrawn smaller until it fits.
 */

/** The addresses a note's picture may have: raster pictures only (`picture_address` on the server). */
export const PICTURE_ADDRESS = /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;
/** A picture's name as the note keeps it. */
export const PICTURE_NAME = /^[^<>]{0,200}$/;

/** The longest one picture's address, in bytes. */
export const MAX_PICTURE = 40_000;
/** The formatted text a picture may bring a note to, leaving the rest of `MAX_HTML` for typing. */
export const MAX_WITH_PICTURES = MAX_HTML - 20_000;

const PICTURE_FILE = /\.(png|jpe?g|gif|webp|bmp)$/i;
const LONGEST_SIDE = 640;
const SMALLEST_SIDE = 80;

/** Whether a file of this name is a picture a note can show. */
export const isNotePicture = ({ name }: { name: string }) => PICTURE_FILE.test(name);

/** Whether a note holding `html` has room for a picture of `address`. */
export const roomForPicture = (html: string, address: string) =>
  utf8Bytes(html) + address.length <= MAX_WITH_PICTURES;

/**
 * The markup that puts a picture in a note, on a line of its own after any text. The name is
 * written as an attribute, with what a browser would read differently escaped.
 */
export function pictureMarkup(address: string, name: string, afterText: boolean): string {
  const alt = name
    .replace(/[<>]/g, "")
    .slice(0, 200)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;");
  return `${afterText ? "<br>" : ""}<img src="${address}" alt="${alt}">`;
}

/**
 * The picture in `file` as an address of at most `MAX_PICTURE` bytes: drawn at most 640 points on
 * its longest side, then smaller until it fits. Rejects when the file is no picture the browser
 * can read. An animated picture keeps its first frame.
 */
export async function notePictureAddress(file: Blob): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The browser cannot draw this picture.");
    let side = Math.min(LONGEST_SIDE, Math.max(image.naturalWidth, image.naturalHeight));
    const scale = (length: number) =>
      Math.max(1, Math.round((length * side) / Math.max(image.naturalWidth, image.naturalHeight)));
    do {
      canvas.width = scale(image.naturalWidth);
      canvas.height = scale(image.naturalHeight);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const address = canvas.toDataURL("image/webp", 0.8);
      if (address.length <= MAX_PICTURE) return address;
      side = Math.floor(side * 0.75);
    } while (side >= SMALLEST_SIDE);
    throw new Error("The picture does not fit a note.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

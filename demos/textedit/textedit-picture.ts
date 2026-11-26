/**
 * Pictures in a document: a PNG or a JPEG held in the text as a `data:` address, so that it travels
 * with the file. Any other kind of file, a GIF or a WebP among them, is attached instead.
 */

/** The pictures a document holds: RTF, Word and OpenDocument all carry PNG and JPEG. */
export const PICTURE_SOURCE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;

/** The largest picture held in the text, in bytes: past it the file is attached instead. */
export const MOST_PICTURE_BYTES = 8 * 1024 * 1024;

/** The kind and size in pixels of a PNG or JPEG, read from its header; `null` for anything else. */
export function pictureHeader(
  bytes: Uint8Array,
): { type: "png" | "jpeg"; width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 24 && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a) {
    return { type: "png", width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (bytes.length < 4 || view.getUint16(0) !== 0xffd8) return null;
  // A JPEG's segments, up to the frame header (SOF0 to SOF15, without the tables DHT, JPG and DAC).
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1] ?? 0;
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { type: "jpeg", width: view.getUint16(at + 7), height: view.getUint16(at + 5) };
    }
    at += 2 + view.getUint16(at + 2);
  }
  return null;
}

const base64Of = (bytes: Uint8Array) => {
  let binary = "";
  for (let at = 0; at < bytes.length; at += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  }
  return btoa(binary);
};

/** A picture's `<img>` for the view, or `null` when the bytes are to be attached instead. */
export function pictureHtml(bytes: Uint8Array): string | null {
  if (bytes.length > MOST_PICTURE_BYTES) return null;
  const header = pictureHeader(bytes);
  if (!header || header.width === 0 || header.height === 0) return null;
  const src = `data:image/${header.type};base64,${base64Of(bytes)}`;
  return `<img src="${src}" width="${header.width}" height="${header.height}">`;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * A drive file attached to the text: a link to the file with its name, one character to the caret.
 * The drive has no bundles for a `.rtfd` to be, so the document refers to the file, holding no copy.
 */
export const attachmentHtml = (id: string, name: string) =>
  `<a href="drive:${escapeHtml(id)}" contenteditable="false">${escapeHtml(name)}</a>&nbsp;`;

/** The drive file an attachment's address names. */
export const attachedFile = (href: string) => /^drive:([A-Za-z0-9]{1,64})$/i.exec(href)?.[1];

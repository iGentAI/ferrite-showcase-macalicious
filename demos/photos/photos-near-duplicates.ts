/*
 * Near-duplicates, told apart by a hash of each thumbnail, computed in this page: nine columns by
 * eight rows of brightness give 64 bits, one for each neighbour that is brighter (a difference
 * hash), and the mean colour follows as six more hex digits. The thumbnail is already here, so
 * nothing more is fetched; the hash is kept with the photo on the server.
 */

import type { LibraryPhoto } from "./photos-library";

const COLUMNS = 9;
const ROWS = 8;
const BITS_HEX = 16;
/** The most of the 64 bits two near-duplicates differ in. */
const MAX_BITS_APART = 6;
/** The most one channel of their mean colours differs, of 255. */
const MAX_COLOUR_APART = 24;
/** The bits of a picture with no detail: every such picture would look alike. */
const NO_DETAIL = new Set(["0".repeat(BITS_HEX), "f".repeat(BITS_HEX)]);

const hex = (value: number, digits: number) => value.toString(16).padStart(digits, "0");

/** The hash of 9 by 8 RGBA pixels. */
export function hashOfPixels(rgba: ArrayLike<number>): string {
  const brightness: number[] = [];
  let red = 0;
  let green = 0;
  let blue = 0;
  for (let at = 0; at < COLUMNS * ROWS; at += 1) {
    const r = rgba[at * 4] ?? 0;
    const g = rgba[at * 4 + 1] ?? 0;
    const b = rgba[at * 4 + 2] ?? 0;
    brightness.push(0.299 * r + 0.587 * g + 0.114 * b);
    red += r;
    green += g;
    blue += b;
  }
  let bits = "";
  let nibble = 0;
  let count = 0;
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS - 1; column += 1) {
      const here = brightness[row * COLUMNS + column] ?? 0;
      const next = brightness[row * COLUMNS + column + 1] ?? 0;
      nibble = nibble * 2 + (next > here ? 1 : 0);
      count += 1;
      if (count % 4 === 0) {
        bits += hex(nibble, 1);
        nibble = 0;
      }
    }
  }
  const mean = (sum: number) => hex(Math.round(sum / (COLUMNS * ROWS)), 2);
  return `${bits}${mean(red)}${mean(green)}${mean(blue)}`;
}

/** A hash read for comparing: a library's memories compare thousands of photos on each change. */
const readHash = (hash: string) => ({
  high: Number.parseInt(hash.slice(0, BITS_HEX / 2), 16),
  low: Number.parseInt(hash.slice(BITS_HEX / 2, BITS_HEX), 16),
  red: Number.parseInt(hash.slice(BITS_HEX, BITS_HEX + 2), 16),
  green: Number.parseInt(hash.slice(BITS_HEX + 2, BITS_HEX + 4), 16),
  blue: Number.parseInt(hash.slice(BITS_HEX + 4, BITS_HEX + 6), 16),
  noDetail: NO_DETAIL.has(hash.slice(0, BITS_HEX)),
});

const bitsOf = (word: number) => {
  let bits = word >>> 0;
  bits -= (bits >>> 1) & 0x55555555;
  bits = (bits & 0x33333333) + ((bits >>> 2) & 0x33333333);
  bits = (bits + (bits >>> 4)) & 0x0f0f0f0f;
  return Math.imul(bits, 0x01010101) >>> 24;
};

const alike = (a: ReturnType<typeof readHash>, b: ReturnType<typeof readHash>) =>
  !a.noDetail &&
  !b.noDetail &&
  Math.abs(a.red - b.red) <= MAX_COLOUR_APART &&
  Math.abs(a.green - b.green) <= MAX_COLOUR_APART &&
  Math.abs(a.blue - b.blue) <= MAX_COLOUR_APART &&
  bitsOf(a.high ^ b.high) + bitsOf(a.low ^ b.low) <= MAX_BITS_APART;

/** Whether two hashes are of nearly the same picture. A picture with no detail is like no other. */
export function nearlyAlike(a: string, b: string): boolean {
  return alike(readHash(a), readHash(b));
}

/**
 * The photos without those nearly like one kept before them. A favourite, a movie and a photo not
 * yet hashed always stay, and a favourite is kept ahead of an earlier picture it resembles.
 */
export function withoutNearDuplicates<T extends LibraryPhoto>(photos: readonly T[]): T[] {
  const stays = (photo: T) => photo.favorite || !photo.phash || photo.duration_ms !== null;
  const kept = photos.flatMap((photo) =>
    photo.favorite && photo.duration_ms === null && photo.phash ? [readHash(photo.phash)] : [],
  );
  return photos.filter((photo) => {
    if (stays(photo)) return true;
    const hash = readHash(photo.phash as string);
    if (kept.some((each) => alike(each, hash))) return false;
    kept.push(hash);
    return true;
  });
}

/** The hash of a thumbnail's picture. */
export async function hashOfThumb(thumb: Blob): Promise<string> {
  const bitmap = await createImageBitmap(thumb);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = COLUMNS;
    canvas.height = ROWS;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("this browser cannot draw a thumbnail");
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, COLUMNS, ROWS);
    return hashOfPixels(context.getImageData(0, 0, COLUMNS, ROWS).data);
  } finally {
    bitmap.close();
  }
}

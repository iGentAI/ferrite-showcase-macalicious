/*
 * What Photos reads from a JPEG's EXIF data when it imports a photo: the day and time it was
 * taken (DateTimeOriginal, else DateTime), the camera (Make and Model), the camera's settings and
 * where it was taken. Only the APP1 segment at the start of the file is read; anything malformed
 * is ignored.
 */

import type { PhotoExif, PhotoLocation } from "./photos-library";

export interface ExifFacts {
  /** When the photo was taken, as the camera's local time read in this browser's time zone. */
  takenMs?: number;
  /** "Make Model", without the make repeated when the model starts with it. */
  camera?: string;
  /** The lens, ISO, aperture, shutter, focal length and exposure compensation it recorded. */
  settings?: PhotoExif;
  /** The GPS position. */
  location?: PhotoLocation;
}

const TAG_MAKE = 0x010f;
const TAG_MODEL = 0x0110;
const TAG_DATE_TIME = 0x0132;
const TAG_EXIF_IFD = 0x8769;
const TAG_GPS_IFD = 0x8825;
const TAG_DATE_TIME_ORIGINAL = 0x9003;
const TAG_EXPOSURE = 0x829a;
const TAG_F_NUMBER = 0x829d;
const TAG_ISO = 0x8827;
const TAG_BIAS = 0x9204;
const TAG_FOCAL = 0x920a;
const TAG_LENS = 0xa434;

/** "2019:10:07 14:03:22" as local time, or `undefined` for anything that is not a real date. */
export function exifDate(text: string): number | undefined {
  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(text.trim());
  if (!match) return undefined;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  if (year < 1 || hour > 23 || minute > 59 || second > 59) return undefined;
  // Any year from 0001 to 9999: `setFullYear` takes a year below 100 as it is (the Date
  // constructor would read 0050 as 1950).
  const date = new Date(2000, 0, 1, hour, minute, second);
  date.setFullYear(year, month - 1, day);
  // A date the calendar does not have (February 31) comes back as another day.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour
  )
    return undefined;
  const ms = date.getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

/** The EXIF facts of a JPEG's bytes. */
export function readExif(bytes: Uint8Array): ExifFacts {
  try {
    return parse(bytes);
  } catch {
    return {};
  }
}

function parse(bytes: Uint8Array): ExifFacts {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return {};
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 2;
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff) return {};
    const marker = bytes[at + 1] ?? 0;
    // Start of scan or end of image: no APP1 came before the picture.
    if (marker === 0xda || marker === 0xd9) return {};
    const length = view.getUint16(at + 2);
    // A segment's length counts its own two bytes; one that runs past the file is not read.
    if (length < 2 || at + 2 + length > bytes.length) return {};
    if (marker === 0xe1 && length >= 16) {
      const start = at + 4;
      const header = String.fromCharCode(...bytes.subarray(start, start + 4));
      // "Exif" and two zero bytes, then a TIFF header of eight bytes inside the segment.
      if (header === "Exif" && bytes[start + 4] === 0 && bytes[start + 5] === 0) {
        return readTiff(view, start + 6, start + length - 2);
      }
    }
    at += 2 + length;
  }
  return {};
}

function readTiff(view: DataView, tiff: number, end: number): ExifFacts {
  if (end - tiff < 8) return {};
  const order = view.getUint16(tiff);
  const little = order === 0x4949;
  if (!little && order !== 0x4d4d) return {};
  const u16 = (offset: number) => view.getUint16(offset, little);
  const u32 = (offset: number) => view.getUint32(offset, little);
  if (u16(tiff + 2) !== 42) return {};
  const ascii = (entry: number): string | undefined => {
    const type = u16(entry + 2);
    const count = u32(entry + 4);
    if (type !== 2 || count === 0 || count > 256) return undefined;
    const offset = count <= 4 ? entry + 8 : tiff + u32(entry + 8);
    if (offset + count > end) return undefined;
    let text = "";
    for (let i = 0; i < count; i += 1) {
      const code = view.getUint8(offset + i);
      if (code === 0) break;
      text += String.fromCharCode(code);
    }
    return text.trim() || undefined;
  };
  const entries = (ifd: number): Map<number, number> => {
    const found = new Map<number, number>();
    if (ifd + 2 > end) return found;
    const count = Math.min(u16(ifd), 512);
    for (let i = 0; i < count; i += 1) {
      const entry = ifd + 2 + i * 12;
      if (entry + 12 > end) break;
      found.set(u16(entry), entry);
    }
    return found;
  };
  const first = entries(tiff + u32(tiff + 4));
  const at = (tags: Map<number, number>, tag: number) => {
    const entry = tags.get(tag);
    return entry === undefined ? undefined : ascii(entry);
  };
  /** The `index`th rational of a RATIONAL (5) or SRATIONAL (10) entry. */
  const rational = (entry: number | undefined, index = 0): number | undefined => {
    if (entry === undefined) return undefined;
    const type = u16(entry + 2);
    if ((type !== 5 && type !== 10) || u32(entry + 4) <= index) return undefined;
    const offset = tiff + u32(entry + 8) + index * 8;
    if (offset + 8 > end) return undefined;
    const top = type === 5 ? u32(offset) : view.getInt32(offset, little);
    const bottom = type === 5 ? u32(offset + 4) : view.getInt32(offset + 4, little);
    return bottom === 0 ? undefined : top / bottom;
  };
  const degrees = (entry: number | undefined, ref: string | undefined, negative: string) => {
    const [d, m, s] = [rational(entry, 0), rational(entry, 1), rational(entry, 2)];
    if (d === undefined) return undefined;
    const value = d + (m ?? 0) / 60 + (s ?? 0) / 3600;
    return ref === negative ? -value : value;
  };
  const make = at(first, TAG_MAKE);
  const model = at(first, TAG_MODEL);
  // The original's time, else the file's: an unreadable original time falls back too.
  let takenMs: number | undefined;
  const settings: PhotoExif = {};
  const exifEntry = first.get(TAG_EXIF_IFD);
  if (exifEntry !== undefined) {
    const tags = entries(tiff + u32(exifEntry + 8));
    const original = at(tags, TAG_DATE_TIME_ORIGINAL);
    takenMs = original ? exifDate(original) : undefined;
    const lens = at(tags, TAG_LENS);
    if (lens) settings.lens = lens.slice(0, 100);
    const isoEntry = tags.get(TAG_ISO);
    if (isoEntry !== undefined && u16(isoEntry + 2) === 3) settings.iso = u16(isoEntry + 8);
    const aperture = rational(tags.get(TAG_F_NUMBER));
    if (aperture !== undefined) settings.aperture = aperture;
    const exposure = rational(tags.get(TAG_EXPOSURE));
    if (exposure !== undefined) settings.exposure = exposure;
    const focal = rational(tags.get(TAG_FOCAL));
    if (focal !== undefined) settings.focal = focal;
    const bias = rational(tags.get(TAG_BIAS));
    if (bias !== undefined) settings.bias = bias;
  }
  if (takenMs === undefined) {
    const changed = at(first, TAG_DATE_TIME);
    takenMs = changed ? exifDate(changed) : undefined;
  }
  const facts: ExifFacts = {};
  if (takenMs !== undefined) facts.takenMs = takenMs;
  const camera =
    make && model && !model.toLowerCase().startsWith(make.toLowerCase())
      ? `${make} ${model}`
      : (model ?? make);
  if (camera) facts.camera = camera.slice(0, 100);
  if (Object.keys(settings).length > 0) facts.settings = settings;
  const gpsEntry = first.get(TAG_GPS_IFD);
  if (gpsEntry !== undefined) {
    const gps = entries(tiff + u32(gpsEntry + 8));
    const lat = degrees(gps.get(2), at(gps, 1), "S");
    const lon = degrees(gps.get(4), at(gps, 3), "W");
    if (lat !== undefined && lon !== undefined && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      facts.location = { lat, lon };
    }
  }
  return facts;
}

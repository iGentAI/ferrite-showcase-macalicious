/**
 * A zip archive made in the browser, as Finder's Compress makes one: each file deflated where the
 * browser can (`CompressionStream`), stored where it cannot or where deflating would not shrink it.
 */

export interface ArchiveFile {
  /** The file's path in the archive, with `/` between folders. A folder ends in `/`. */
  path: string;
  /** The bytes; none for a folder. */
  blob?: Blob;
  modified?: Date;
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

/** The CRC-32 of `bytes`, as a zip records it. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function deflated(bytes: Uint8Array): Promise<Uint8Array> {
  let compressor: CompressionStream;
  try {
    compressor = new CompressionStream("deflate-raw");
  } catch {
    // No such class, or it does not know this format: the file is stored.
    return bytes;
  }
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(compressor);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const dosTime = (date: Date) =>
  (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
const dosDate = (date: Date) =>
  (Math.max(date.getFullYear() - 1980, 0) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();

const UTF8_NAMES = 0x0800;
const DEFLATE = 8;
const STORE = 0;

/** The most entries a zip without its 64-bit extension can name. */
export const MOST_ARCHIVE_ENTRIES = 65_535;

/** The archive of `files`. `onFile` is told as each one is done. */
export async function zipBlob(
  files: readonly ArchiveFile[],
  onFile?: (done: number) => void,
): Promise<Blob> {
  if (files.length > MOST_ARCHIVE_ENTRIES) {
    throw new RangeError(`A zip holds at most ${MOST_ARCHIVE_ENTRIES} items.`);
  }
  const parts: BlobPart[] = [];
  const central: BlobPart[] = [];
  const encoder = new TextEncoder();
  let offset = 0;
  let centralSize = 0;
  for (const [index, file] of files.entries()) {
    const raw = file.blob ? new Uint8Array(await file.blob.arrayBuffer()) : new Uint8Array();
    const packed = raw.length > 0 ? await deflated(raw) : raw;
    const useDeflate = packed.length < raw.length;
    const body = useDeflate ? packed : raw;
    const name = encoder.encode(file.path);
    const when = file.modified ?? new Date();
    const crc = crc32(raw);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, UTF8_NAMES, true);
    local.setUint16(8, useDeflate ? DEFLATE : STORE, true);
    local.setUint16(10, dosTime(when), true);
    local.setUint16(12, dosDate(when), true);
    local.setUint32(14, crc, true);
    local.setUint32(18, body.length, true);
    local.setUint32(22, raw.length, true);
    local.setUint16(26, name.length, true);
    parts.push(local.buffer, name as BlobPart, body as BlobPart);
    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, UTF8_NAMES, true);
    entry.setUint16(10, useDeflate ? DEFLATE : STORE, true);
    entry.setUint16(12, dosTime(when), true);
    entry.setUint16(14, dosDate(when), true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, body.length, true);
    entry.setUint32(24, raw.length, true);
    entry.setUint16(28, name.length, true);
    entry.setUint32(42, offset, true);
    central.push(entry.buffer, name as BlobPart);
    centralSize += 46 + name.length;
    offset += 30 + name.length + body.length;
    onFile?.(index + 1);
  }
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type: "application/zip" });
}

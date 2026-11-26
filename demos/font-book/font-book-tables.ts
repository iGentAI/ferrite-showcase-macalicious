import { type FontFamily, type FontScript, fontFamily } from "./font-book-data";

/*
 * What a font file says of itself: its `name`, `cmap`, `post` and `OS/2` tables, read from the bytes of a
 * TrueType or OpenType file or a WOFF. A WOFF2 compresses its tables with Brotli, for which a page has no
 * decoder, so it says nothing here.
 */

export interface FontTables {
  postScriptName?: string;
  fullName?: string;
  familyName?: string;
  styleName?: string;
  version?: string;
  copyright?: string;
  designer?: string;
  /** `post`'s isFixedPitch. */
  fixedWidth?: boolean;
  /** Which writing system the characters and the code page bits say. */
  script?: FontScript;
  /** The characters `cmap` gives a glyph, as ranges, without control characters. */
  ranges?: readonly (readonly [first: number, last: number])[];
}

const FONT_FILE = /\.(ttf|otf|woff2?)$/i;

/** Whether a file's name says it is a font Font Book takes. */
export const isFontFile = (name: string) => FONT_FILE.test(name);

/** The most characters kept of one font: a font cannot map more than this into a usable list. */
const MOST_CHARACTERS = 70_000;

const NAME_IDS = {
  copyright: 0,
  family: 1,
  style: 2,
  full: 4,
  version: 5,
  postScript: 6,
  designer: 9,
  typographicFamily: 16,
  typographicStyle: 17,
} as const;

const tagAt = (view: DataView, at: number) =>
  String.fromCharCode(
    view.getUint8(at),
    view.getUint8(at + 1),
    view.getUint8(at + 2),
    view.getUint8(at + 3),
  );

/** The rank of a name record's encoding, the lowest being the best; `undefined` for one not read. */
function nameRank(platform: number, language: number): number | undefined {
  if (platform === 3) return language === 0x409 ? 0 : 1;
  if (platform === 0) return 2;
  if (platform === 1 && language === 0) return 3;
  return undefined;
}

function readNames(view: DataView): Map<number, string> {
  const count = view.getUint16(2);
  const strings = view.getUint16(4);
  const best = new Map<number, { rank: number; text: string }>();
  for (let index = 0; index < count; index += 1) {
    const at = 6 + index * 12;
    const platform = view.getUint16(at);
    const rank = nameRank(platform, view.getUint16(at + 4));
    const id = view.getUint16(at + 6);
    const known = best.get(id);
    if (rank === undefined || (known && known.rank <= rank)) continue;
    const bytes = new Uint8Array(
      view.buffer,
      view.byteOffset + strings + view.getUint16(at + 10),
      view.getUint16(at + 8),
    );
    const text = new TextDecoder(platform === 1 ? "macintosh" : "utf-16be").decode(bytes).trim();
    if (text !== "") best.set(id, { rank, text });
  }
  return new Map([...best].map(([id, { text }]) => [id, text]));
}

/** Collects characters into ranges, in the order they come, leaving out what draws nothing. */
function rangeCollector() {
  const ranges: [number, number][] = [];
  let total = 0;
  const add = (code: number) => {
    if (
      total >= MOST_CHARACTERS ||
      code < 0x20 ||
      (code >= 0x7f && code <= 0x9f) ||
      (code >= 0xd800 && code <= 0xdfff) ||
      code > 0x10ffff
    ) {
      return;
    }
    total += 1;
    const last = ranges.at(-1);
    if (last && last[1] === code - 1) last[1] = code;
    else ranges.push([code, code]);
  };
  return { ranges, add };
}

function readFormat4(view: DataView, at: number, add: (code: number) => void) {
  const segments = view.getUint16(at + 6) / 2;
  const ends = at + 14;
  const starts = ends + segments * 2 + 2;
  const deltas = starts + segments * 2;
  const offsets = deltas + segments * 2;
  for (let segment = 0; segment < segments; segment += 1) {
    const start = view.getUint16(starts + segment * 2);
    const end = view.getUint16(ends + segment * 2);
    const delta = view.getUint16(deltas + segment * 2);
    const offsetAt = offsets + segment * 2;
    const offset = view.getUint16(offsetAt);
    for (let code = start; code <= end && code !== 0xffff; code += 1) {
      const stored = offset === 0 ? 1 : view.getUint16(offsetAt + offset + (code - start) * 2);
      const glyph = stored === 0 ? 0 : (offset === 0 ? code + delta : stored + delta) & 0xffff;
      if (glyph !== 0) add(code);
    }
  }
}

function readFormat12(view: DataView, at: number, add: (code: number) => void) {
  const groups = view.getUint32(at + 12);
  for (let group = 0; group < groups; group += 1) {
    const start = view.getUint32(at + 16 + group * 12);
    const end = view.getUint32(at + 20 + group * 12);
    const glyph = view.getUint32(at + 24 + group * 12);
    const last = Math.min(end, start + MOST_CHARACTERS);
    for (let code = start; code <= last; code += 1) {
      if (glyph + (code - start) !== 0) add(code);
    }
  }
}

const CMAP_FORMATS = new Set([0, 4, 6, 12]);

/** The rank of a `cmap` encoding, the lowest being the fullest. */
function cmapRank(platform: number, encoding: number): number | undefined {
  if (platform === 3 && encoding === 10) return 0;
  if (platform === 0) return encoding >= 4 ? 1 : 2;
  if (platform === 3 && encoding === 1) return 3;
  if (platform === 3 && encoding === 0) return 4;
  if (platform === 1 && encoding === 0) return 5;
  return undefined;
}

function readCmap(view: DataView): readonly [number, number][] {
  const count = view.getUint16(2);
  let best: { rank: number; at: number } | undefined;
  for (let index = 0; index < count; index += 1) {
    const entry = 4 + index * 8;
    const rank = cmapRank(view.getUint16(entry), view.getUint16(entry + 2));
    const at = view.getUint32(entry + 4);
    if (rank === undefined || !CMAP_FORMATS.has(view.getUint16(at))) continue;
    if (!best || rank < best.rank) best = { rank, at };
  }
  const { ranges, add } = rangeCollector();
  if (!best) return ranges;
  const { at } = best;
  const format = view.getUint16(at);
  if (format === 4) readFormat4(view, at, add);
  else if (format === 12) readFormat12(view, at, add);
  else if (format === 0) {
    for (let code = 0; code < 256; code += 1) if (view.getUint8(at + 6 + code) !== 0) add(code);
  } else {
    const first = view.getUint16(at + 6);
    const codes = view.getUint16(at + 8);
    for (let index = 0; index < codes; index += 1) {
      if (view.getUint16(at + 10 + index * 2) !== 0) add(first + index);
    }
  }
  return ranges;
}

const covers = (
  ranges: readonly (readonly [number, number])[],
  first: number,
  last: number,
): boolean => ranges.some(([start, end]) => start <= last && end >= first);

/** OS/2's ulCodePageRange1 bits for the East Asian code pages. */
const CODE_PAGE_GB2312 = 1 << 18;
const CODE_PAGE_BIG5 = 1 << 20;

function scriptOf(ranges: readonly (readonly [number, number])[], codePages: number): FontScript {
  if (covers(ranges, 0x3040, 0x30ff)) return "Japanese";
  if (covers(ranges, 0x4e00, 0x9fff)) {
    return (codePages & CODE_PAGE_BIG5) !== 0 && (codePages & CODE_PAGE_GB2312) === 0
      ? "Traditional Chinese"
      : "Simplified Chinese";
  }
  if (covers(ranges, 0x41, 0x5a)) return "Latin";
  if (covers(ranges, 0x600, 0x6ff)) return "Arabic";
  return "Symbols";
}

/** One table's reading, with nothing for a table whose offsets lead outside it. */
function attempt<T>(read: () => T): T | undefined {
  try {
    return read();
  } catch {
    return undefined;
  }
}

function fromTables(table: (tag: string) => DataView | undefined): FontTables {
  const name = table("name");
  const names = name ? (attempt(() => readNames(name)) ?? new Map<number, string>()) : new Map();
  const cmap = table("cmap");
  const ranges = cmap ? attempt(() => readCmap(cmap)) : undefined;
  const post = table("post");
  const os2 = table("OS/2");
  const codePages =
    os2 && os2.byteLength >= 82 && os2.getUint16(0) >= 1 ? os2.getUint32(78) : (0 as number);
  return {
    postScriptName: names.get(NAME_IDS.postScript),
    fullName: names.get(NAME_IDS.full),
    familyName: names.get(NAME_IDS.typographicFamily) ?? names.get(NAME_IDS.family),
    styleName: names.get(NAME_IDS.typographicStyle) ?? names.get(NAME_IDS.style),
    version: names.get(NAME_IDS.version),
    copyright: names.get(NAME_IDS.copyright),
    designer: names.get(NAME_IDS.designer),
    fixedWidth: post && post.byteLength >= 16 ? post.getUint32(12) !== 0 : undefined,
    script: ranges && ranges.length > 0 ? scriptOf(ranges, codePages) : undefined,
    ranges,
  };
}

function readSfnt(view: DataView): FontTables {
  const count = view.getUint16(4);
  const tables = new Map<string, DataView>();
  for (let index = 0; index < count; index += 1) {
    const at = 12 + index * 16;
    const offset = view.getUint32(at + 8);
    const length = view.getUint32(at + 12);
    if (offset + length <= view.byteLength) {
      tables.set(tagAt(view, at), new DataView(view.buffer, view.byteOffset + offset, length));
    }
  }
  return fromTables((tag) => tables.get(tag));
}

const WANTED = new Set(["name", "cmap", "post", "OS/2"]);

async function inflated(bytes: Uint8Array): Promise<ArrayBuffer> {
  const stream = new Response(bytes as BufferSource).body?.pipeThrough(
    new DecompressionStream("deflate"),
  );
  return new Response(stream).arrayBuffer();
}

async function readWoff(view: DataView): Promise<FontTables> {
  const count = view.getUint16(12);
  const tables = new Map<string, DataView>();
  for (let index = 0; index < count; index += 1) {
    const at = 44 + index * 20;
    const tag = tagAt(view, at);
    if (!WANTED.has(tag)) continue;
    const offset = view.getUint32(at + 4);
    const compressed = view.getUint32(at + 8);
    const original = view.getUint32(at + 12);
    const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, compressed);
    tables.set(
      tag,
      new DataView(compressed < original ? await inflated(bytes) : bytes.slice().buffer),
    );
  }
  return fromTables((tag) => tables.get(tag));
}

/** What the bytes of a font say, or `null` for bytes this cannot read, a WOFF2's among them. */
export async function readFontBytes(data: ArrayBuffer): Promise<FontTables | null> {
  const view = new DataView(data);
  if (view.byteLength < 12) return null;
  const signature = tagAt(view, 0);
  try {
    if (signature === "wOFF") return await readWoff(view);
    if (signature === "OTTO" || signature === "true" || view.getUint32(0) === 0x00010000) {
      return readSfnt(view);
    }
  } catch {
    return null;
  }
  return null;
}

export const readFontTables = async (file: Blob): Promise<FontTables | null> =>
  readFontBytes(await file.arrayBuffer());

/** The family a font file adds, listed by the file's name and filled in from its tables. */
export function familyOfFile(name: string, tables: FontTables | null): FontFamily {
  return fontFamily(name, "Regular", tables?.fixedWidth ? "mono" : "sans", {
    script: tables?.script,
    repertoire:
      tables?.ranges && tables.ranges.length > 0
        ? (tables.ranges as readonly [number, number][])
        : undefined,
  });
}

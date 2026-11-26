/**
 * Annotations in a QuickTime or MP4 file: the `moov/udta/meta/ilst` items that QuickTime Player and
 * other readers show as a movie's title, author, description and copyright (ISO 14496-12 for the
 * boxes, Apple's QuickTime File Format for the items).
 *
 * The rewritten `moov` goes at the end of the file and the old one becomes a `free` box, so every
 * sample stays at its offset and the chunk tables stay true.
 */

/** A file whose boxes are not a QuickTime or MP4 movie's, with why. */
export class NotAMovie extends Error {}

export interface MovieNotes {
  title: string;
  author: string;
  description: string;
  copyright: string;
}

const ITEMS: readonly (readonly [keyof MovieNotes, string])[] = [
  ["title", "\u00a9nam"],
  ["author", "\u00a9ART"],
  ["description", "\u00a9cmt"],
  ["copyright", "cprt"],
];

const FIRST_BOXES = new Set(["ftyp", "moov", "mdat", "wide", "free", "skip"]);

const latin = (bytes: Uint8Array, at: number, length: number) =>
  String.fromCharCode(...bytes.subarray(at, at + length));
const typeBytes = (type: string) => Uint8Array.from(type, (char) => char.charCodeAt(0));

function joined(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

function box(type: string, ...parts: readonly Uint8Array[]): Uint8Array {
  const body = joined(parts);
  const head = new Uint8Array(8);
  new DataView(head.buffer).setUint32(0, body.length + 8);
  head.set(typeBytes(type), 4);
  return joined([head, body]);
}

interface Child {
  type: string;
  start: number;
  body: number;
  end: number;
}

function childrenOf(bytes: Uint8Array, from: number, to: number): Child[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const children: Child[] = [];
  for (let at = from; at + 8 <= to; ) {
    const size = view.getUint32(at);
    const wide = size === 1 && at + 16 <= to;
    const length = wide ? Number(view.getBigUint64(at + 8)) : size === 0 ? to - at : size;
    if (length < 8 || at + length > to) break;
    children.push({
      type: latin(bytes, at + 4, 4),
      start: at,
      body: at + (wide ? 16 : 8),
      end: at + length,
    });
    at += length;
  }
  return children;
}

/** The boxes between `from` and `to` with the one of this type made anew, or added at the end. */
function withChild(
  bytes: Uint8Array,
  from: number,
  to: number,
  type: string,
  make: (child: Child | undefined) => Uint8Array,
): Uint8Array {
  const children = childrenOf(bytes, from, to);
  const found = children.find((child) => child.type === type);
  const kept = children
    .filter((child) => child !== found)
    .map((child) => bytes.subarray(child.start, child.end));
  return joined([...kept, make(found)]);
}

const handlerBox = () => box("hdlr", new Uint8Array(8), typeBytes("mdirappl"), new Uint8Array(9));

function itemList(bytes: Uint8Array, ilst: Child | undefined, notes: MovieNotes): Uint8Array {
  const written = ITEMS.filter(([key]) => notes[key].trim() !== "");
  const replaced = new Set(written.map(([, type]) => type));
  const kept = ilst
    ? childrenOf(bytes, ilst.body, ilst.end)
        .filter((child) => !replaced.has(child.type))
        .map((child) => bytes.subarray(child.start, child.end))
    : [];
  const text = new TextEncoder();
  const added = written.map(([key, type]) =>
    box(type, box("data", Uint8Array.of(0, 0, 0, 1, 0, 0, 0, 0), text.encode(notes[key].trim()))),
  );
  return box("ilst", ...kept, ...added);
}

function metaBox(bytes: Uint8Array, meta: Child | undefined, notes: MovieNotes): Uint8Array {
  if (!meta) {
    return box("meta", new Uint8Array(4), handlerBox(), itemList(bytes, undefined, notes));
  }
  // ISO's `meta` opens with four bytes of version and flags; QuickTime's goes straight to its boxes.
  const quickTime = latin(bytes, meta.body + 4, 4) === "hdlr";
  const from = quickTime ? meta.body : meta.body + 4;
  return box(
    "meta",
    bytes.subarray(meta.body, from),
    withChild(bytes, from, meta.end, "ilst", (ilst) => itemList(bytes, ilst, notes)),
  );
}

function annotatedMoov(bytes: Uint8Array, notes: MovieNotes): Uint8Array {
  const [moov] = childrenOf(bytes, 0, bytes.length);
  if (!moov) throw new NotAMovie("its movie box is damaged.");
  return box(
    "moov",
    withChild(bytes, moov.body, moov.end, "udta", (udta) =>
      box(
        "udta",
        udta
          ? withChild(bytes, udta.body, udta.end, "meta", (meta) => metaBox(bytes, meta, notes))
          : metaBox(bytes, undefined, notes),
      ),
    ),
  );
}

/** A copy of a QuickTime or MP4 file with these annotations, whichever others it has staying. */
export async function annotatedMovie(file: Blob, notes: MovieNotes): Promise<Blob> {
  let moov: { start: number; end: number } | null = null;
  for (let at = 0; at < file.size; ) {
    const head = new Uint8Array(await file.slice(at, at + 16).arrayBuffer());
    const type = head.length >= 8 ? latin(head, 4, 4) : "";
    if (at === 0 && !FIRST_BOXES.has(type)) {
      throw new NotAMovie("only a QuickTime or MP4 file has a place for them.");
    }
    const view = new DataView(head.buffer);
    const size = head.length >= 8 ? view.getUint32(0) : 8;
    if (size === 0) throw new NotAMovie("its last box does not say its size.");
    const wide = size === 1 && head.length === 16;
    const length = wide ? Number(view.getBigUint64(8)) : size;
    if (length < 8) throw new NotAMovie("its boxes are damaged.");
    if (type === "moov") moov = { start: at, end: at + length };
    at += length;
  }
  if (!moov) throw new NotAMovie("it has no movie box.");
  const old = new Uint8Array(await file.slice(moov.start, moov.end).arrayBuffer());
  const parts: BlobPart[] = [
    file.slice(0, moov.start + 4),
    "free",
    file.slice(moov.start + 8),
    annotatedMoov(old, notes) as Uint8Array<ArrayBuffer>,
  ];
  return new Blob(parts, { type: file.type });
}

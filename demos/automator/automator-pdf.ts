/**
 * A PDF as its objects, for the actions that change a document's pages: read every object of a file
 * (cross-reference tables and streams, object streams), change some, write the whole file again with
 * a plain cross-reference table. Page content is added, never interpreted, so text stays text.
 * Its `Crypt`, password and page rules are ISO 32000-1, 7.5 and 7.6.
 */

export class PdfName {
  constructor(readonly name: string) {}
}

export class PdfRef {
  constructor(readonly ref: number) {}
}

export class PdfBytes {
  constructor(readonly bytes: Uint8Array) {}
}

export type PdfValue =
  | null
  | boolean
  | number
  | PdfName
  | PdfRef
  | PdfBytes
  | PdfDict
  | readonly PdfValue[];

export type PdfDict = Map<string, PdfValue>;

export interface PdfStream {
  dict: PdfDict;
  bytes: Uint8Array;
}

export type PdfObject = PdfValue | PdfStream;

export interface PdfDocument {
  objects: Map<number, PdfObject>;
  trailer: PdfDict;
}

/** A file this reader cannot take apart, with why. */
export class PdfUnreadable extends Error {}

/** A file locked with a password. */
export class PdfLocked extends PdfUnreadable {}

export const isStream = (value: PdfObject | undefined): value is PdfStream =>
  typeof value === "object" && value !== null && "bytes" in value && "dict" in value;

const isDict = (value: PdfObject | undefined): value is PdfDict => value instanceof Map;

const latin = (bytes: Uint8Array) => {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return text;
};

const bytesOf = (text: string) => Uint8Array.from(text, (char) => char.charCodeAt(0) & 255);

const WHITE = new Set([0, 9, 10, 12, 13, 32]);
const DELIMITER = new Set([40, 41, 60, 62, 91, 93, 123, 125, 47, 37]);

class Scanner {
  at: number;
  constructor(
    readonly bytes: Uint8Array,
    at = 0,
  ) {
    this.at = at;
  }

  skip() {
    const { bytes } = this;
    for (;;) {
      const byte = bytes[this.at];
      if (byte === undefined) return;
      if (WHITE.has(byte)) this.at += 1;
      else if (byte === 37) {
        while (this.at < bytes.length && bytes[this.at] !== 10 && bytes[this.at] !== 13) {
          this.at += 1;
        }
      } else return;
    }
  }

  word() {
    this.skip();
    const start = this.at;
    const { bytes } = this;
    for (;;) {
      const byte = bytes[this.at];
      if (byte === undefined || WHITE.has(byte) || DELIMITER.has(byte)) break;
      this.at += 1;
    }
    return latin(bytes.subarray(start, this.at));
  }

  /** Skips `word` when it comes next. */
  accept(word: string) {
    this.skip();
    const start = this.at;
    if (this.word() === word) return true;
    this.at = start;
    return false;
  }

  value(): PdfValue {
    this.skip();
    const { bytes } = this;
    const byte = bytes[this.at];
    if (byte === undefined) throw new PdfUnreadable("The file ends inside an object.");
    if (byte === 47) return this.name();
    if (byte === 40) return this.literal();
    if (byte === 60) return bytes[this.at + 1] === 60 ? this.dict() : this.hex();
    if (byte === 91) return this.array();
    const start = this.at;
    const word = this.word();
    if (word === "true") return true;
    if (word === "false") return false;
    if (word === "null") return null;
    const number = Number(word);
    if (word === "" || !Number.isFinite(number)) {
      throw new PdfUnreadable(`Something that is not PDF stands at byte ${start}.`);
    }
    if (Number.isInteger(number) && number >= 0) {
      const back = this.at;
      const generation = this.word();
      if (/^\d+$/.test(generation) && this.word() === "R") return new PdfRef(number);
      this.at = back;
    }
    return number;
  }

  name() {
    this.at += 1;
    const raw = this.word();
    return new PdfName(
      raw.replace(/#([0-9a-fA-F]{2})/g, (_, hex: string) =>
        String.fromCharCode(Number.parseInt(hex, 16)),
      ),
    );
  }

  literal() {
    const { bytes } = this;
    const out: number[] = [];
    let depth = 1;
    this.at += 1;
    while (depth > 0) {
      const byte = bytes[this.at];
      if (byte === undefined) throw new PdfUnreadable("The file ends inside a string.");
      this.at += 1;
      if (byte === 92) {
        const next = bytes[this.at] ?? 0;
        this.at += 1;
        const plain: Record<number, number> = { 110: 10, 114: 13, 116: 9, 98: 8, 102: 12 };
        if (next >= 48 && next <= 55) {
          let code = next - 48;
          for (let more = 0; more < 2; more += 1) {
            const digit = bytes[this.at] ?? 0;
            if (digit < 48 || digit > 55) break;
            code = code * 8 + digit - 48;
            this.at += 1;
          }
          out.push(code & 255);
        } else if (next === 13) {
          if (bytes[this.at] === 10) this.at += 1;
        } else if (next !== 10) out.push(plain[next] ?? next);
        continue;
      }
      if (byte === 40) depth += 1;
      if (byte === 41) {
        depth -= 1;
        if (depth === 0) break;
      }
      out.push(byte);
    }
    return new PdfBytes(Uint8Array.from(out));
  }

  hex() {
    const { bytes } = this;
    this.at += 1;
    let digits = "";
    while (bytes[this.at] !== 62) {
      const byte = bytes[this.at];
      if (byte === undefined) throw new PdfUnreadable("The file ends inside a string.");
      if (!WHITE.has(byte)) digits += String.fromCharCode(byte);
      this.at += 1;
    }
    this.at += 1;
    if (digits.length % 2 === 1) digits += "0";
    return new PdfBytes(
      Uint8Array.from({ length: digits.length / 2 }, (_, at) =>
        Number.parseInt(digits.slice(at * 2, at * 2 + 2), 16),
      ),
    );
  }

  array() {
    this.at += 1;
    const out: PdfValue[] = [];
    for (;;) {
      this.skip();
      if (this.bytes[this.at] === 93) {
        this.at += 1;
        return out;
      }
      out.push(this.value());
    }
  }

  dict() {
    this.at += 2;
    const out: PdfDict = new Map();
    for (;;) {
      this.skip();
      if (this.bytes[this.at] === 62 && this.bytes[this.at + 1] === 62) {
        this.at += 2;
        return out;
      }
      if (this.bytes[this.at] !== 47)
        throw new PdfUnreadable("A dictionary has a key that is no name.");
      const key = this.name().name;
      out.set(key, this.value());
    }
  }
}

const lastIndexOf = (bytes: Uint8Array, word: string, from = bytes.length) => {
  const wanted = bytesOf(word);
  for (let at = Math.min(from, bytes.length - wanted.length); at >= 0; at -= 1) {
    if (wanted.every((byte, each) => bytes[at + each] === byte)) return at;
  }
  return -1;
};

const indexOf = (bytes: Uint8Array, word: string, from: number) => {
  const wanted = bytesOf(word);
  for (let at = from; at <= bytes.length - wanted.length; at += 1) {
    if (wanted.every((byte, each) => bytes[at + each] === byte)) return at;
  }
  return -1;
};

async function through(bytes: Uint8Array, stream: TransformStream<Uint8Array, Uint8Array>) {
  const writer = stream.writable.getWriter();
  void writer
    .write(bytes as Uint8Array<ArrayBuffer>)
    .then(() => writer.close())
    .catch(() => {});
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

/** Deflates as `FlateDecode` reads it. */
export const deflate = (bytes: Uint8Array) =>
  through(bytes, new CompressionStream("deflate") as TransformStream<Uint8Array, Uint8Array>);

async function inflate(bytes: Uint8Array) {
  return through(
    bytes,
    new DecompressionStream("deflate") as TransformStream<Uint8Array, Uint8Array>,
  );
}

const nameOf = (value: PdfValue | undefined) => (value instanceof PdfName ? value.name : undefined);

/** Undoes PNG predictors, by row (ISO 32000-1, 7.4.4.4). */
function undoPng(data: Uint8Array, columns: number, colors: number, bits: number) {
  const pixel = Math.max(1, Math.ceil((colors * bits) / 8));
  const row = Math.ceil((columns * colors * bits) / 8);
  const rows = Math.floor(data.length / (row + 1));
  const out = new Uint8Array(rows * row);
  for (let y = 0; y < rows; y += 1) {
    const kind = data[y * (row + 1)];
    for (let x = 0; x < row; x += 1) {
      const raw = data[y * (row + 1) + 1 + x] as number;
      const left = x >= pixel ? (out[y * row + x - pixel] as number) : 0;
      const up = y > 0 ? (out[(y - 1) * row + x] as number) : 0;
      const corner = x >= pixel && y > 0 ? (out[(y - 1) * row + x - pixel] as number) : 0;
      let add = 0;
      if (kind === 1) add = left;
      else if (kind === 2) add = up;
      else if (kind === 3) add = (left + up) >> 1;
      else if (kind === 4) {
        const guess = left + up - corner;
        const [a, b, c] = [Math.abs(guess - left), Math.abs(guess - up), Math.abs(guess - corner)];
        add = a <= b && a <= c ? left : b <= c ? up : corner;
      }
      out[y * row + x] = (raw + add) & 255;
    }
  }
  return out;
}

const listOf = (value: PdfValue | undefined): readonly PdfValue[] =>
  value === undefined || value === null ? [] : Array.isArray(value) ? value : [value as PdfValue];

/** A stream's bytes with `FlateDecode` undone; `null` when it uses another filter. */
export async function decodedStream(stream: PdfStream): Promise<Uint8Array | null> {
  const filters = listOf(stream.dict.get("Filter"));
  if (filters.length === 0) return stream.bytes;
  if (filters.length > 1 || nameOf(filters[0]) !== "FlateDecode") return null;
  let data: Uint8Array;
  try {
    data = await inflate(stream.bytes);
  } catch {
    return null;
  }
  const parms = listOf(stream.dict.get("DecodeParms"))[0];
  if (parms instanceof Map) {
    const predictor = Number(parms.get("Predictor") ?? 1);
    if (predictor >= 10) {
      return undoPng(
        data,
        Number(parms.get("Columns") ?? 1),
        Number(parms.get("Colors") ?? 1),
        Number(parms.get("BitsPerComponent") ?? 8),
      );
    }
    if (predictor !== 1) return null;
  }
  return data;
}

type XrefEntry = { offset: number } | { container: number; index: number };

function readObjectAt(bytes: Uint8Array, offset: number, lengths: (ref: PdfRef) => number | null) {
  const scanner = new Scanner(bytes, offset);
  const number = Number(scanner.word());
  scanner.word();
  if (!Number.isInteger(number) || !scanner.accept("obj")) {
    throw new PdfUnreadable(`The file's table points at no object at byte ${offset}.`);
  }
  const value = scanner.value();
  if (!(value instanceof Map) || !scanner.accept("stream"))
    return { number, object: value as PdfObject };
  if (bytes[scanner.at] === 13) scanner.at += 1;
  if (bytes[scanner.at] === 10) scanner.at += 1;
  const start = scanner.at;
  const said = value.get("Length");
  let length = said instanceof PdfRef ? lengths(said) : typeof said === "number" ? said : null;
  if (length !== null) {
    const after = new Scanner(bytes, start + length);
    if (after.word() !== "endstream") length = null;
  }
  if (length === null) {
    let end = indexOf(bytes, "endstream", start);
    if (end < 0) throw new PdfUnreadable("A stream has no end.");
    if (bytes[end - 1] === 10) end -= 1;
    if (bytes[end - 1] === 13) end -= 1;
    length = end - start;
  }
  return {
    number,
    object: {
      dict: value,
      bytes: bytes.slice(start, start + length),
    } satisfies PdfStream as PdfObject,
  };
}

/** Reads a whole file. Throws `PdfLocked` for a locked one and `PdfUnreadable` for anything else. */
export async function readPdf(bytes: Uint8Array): Promise<PdfDocument> {
  const mark = lastIndexOf(bytes, "startxref");
  if (mark < 0) throw new PdfUnreadable("The file has no table of its objects.");
  const entries = new Map<number, XrefEntry | null>();
  let trailer: PdfDict | undefined;
  const seen = new Set<number>();
  const pending = [Number(new Scanner(bytes, mark + 9).word())];
  while (pending.length > 0) {
    const start = pending.shift() as number;
    if (seen.has(start)) continue;
    seen.add(start);
    const scanner = new Scanner(bytes, start);
    let here: PdfDict;
    if (scanner.accept("xref")) {
      while (!scanner.accept("trailer")) {
        const first = Number(scanner.word());
        const count = Number(scanner.word());
        if (!Number.isInteger(first) || !Number.isInteger(count)) {
          throw new PdfUnreadable("The file's table of objects is damaged.");
        }
        for (let at = 0; at < count; at += 1) {
          const offset = Number(scanner.word());
          scanner.word();
          const kind = scanner.word();
          if (!entries.has(first + at)) {
            entries.set(first + at, kind === "n" ? { offset } : null);
          }
        }
      }
      here = scanner.value() as PdfDict;
      const hybrid = here.get("XRefStm");
      if (typeof hybrid === "number") pending.unshift(hybrid);
    } else {
      const { object } = readObjectAt(bytes, start, () => null);
      if (!isStream(object) || nameOf(object.dict.get("Type")) !== "XRef") {
        throw new PdfUnreadable("The file's table of objects is damaged.");
      }
      here = object.dict;
      const data = await decodedStream(object);
      if (!data) throw new PdfUnreadable("The file's table of objects uses an unknown filter.");
      const widths = (here.get("W") as readonly number[]) ?? [];
      const [one = 0, two = 0, three = 0] = widths;
      const index = (here.get("Index") as readonly number[]) ?? [0, Number(here.get("Size"))];
      let at = 0;
      const read = (width: number) => {
        let value = 0;
        for (let each = 0; each < width; each += 1)
          value = value * 256 + (data[at + each] as number);
        at += width;
        return value;
      };
      for (let section = 0; section + 1 < index.length; section += 2) {
        const first = index[section] as number;
        const count = index[section + 1] as number;
        for (let row = 0; row < count && at < data.length; row += 1) {
          const kind = one === 0 ? 1 : read(one);
          const field = read(two);
          const last = read(three);
          if (entries.has(first + row)) continue;
          entries.set(
            first + row,
            kind === 1 ? { offset: field } : kind === 2 ? { container: field, index: last } : null,
          );
        }
      }
    }
    trailer ??= here;
    const previous = here.get("Prev");
    if (typeof previous === "number") pending.push(previous);
  }
  if (!trailer) throw new PdfUnreadable("The file has no trailer.");
  if (trailer.has("Encrypt")) throw new PdfLocked("The file is locked with a password.");

  const objects = new Map<number, PdfObject>();
  const lengthOf = (ref: PdfRef) => {
    const entry = entries.get(ref.ref);
    if (!entry || !("offset" in entry)) return null;
    const { object } = readObjectAt(bytes, entry.offset, () => null);
    return typeof object === "number" ? object : null;
  };
  for (const [number, entry] of entries) {
    if (!entry || !("offset" in entry)) continue;
    const { object } = readObjectAt(bytes, entry.offset, lengthOf);
    objects.set(number, object);
  }
  const unpacked = new Map<number, Map<number, PdfValue>>();
  for (const [number, entry] of entries) {
    if (!entry || !("container" in entry)) continue;
    let held = unpacked.get(entry.container);
    if (!held) {
      held = new Map();
      unpacked.set(entry.container, held);
      const container = objects.get(entry.container);
      const data = isStream(container) ? await decodedStream(container) : null;
      if (!isStream(container) || !data)
        throw new PdfUnreadable("An object stream cannot be read.");
      const head = new Scanner(data);
      const first = Number(container.dict.get("First"));
      const pairs: [number, number][] = [];
      for (let at = 0; at < Number(container.dict.get("N")); at += 1) {
        pairs.push([Number(head.word()), Number(head.word())]);
      }
      for (const [inside, offset] of pairs) {
        held.set(inside, new Scanner(data, first + offset).value());
      }
    }
    if (held.has(number)) objects.set(number, held.get(number) as PdfValue);
  }
  for (const [number, object] of objects) {
    const type = isStream(object) ? nameOf(object.dict.get("Type")) : undefined;
    if (type === "XRef" || type === "ObjStm") objects.delete(number);
  }
  return { objects, trailer };
}

/** A number as PDF writes it: never with an exponent. */
const numberText = (value: number) => {
  const text = Number.isInteger(value) ? String(value) : value.toFixed(5).replace(/\.?0+$/, "");
  return text === "-0" ? "0" : text;
};

const nameText = (name: string) =>
  `/${name.replace(
    /[^!-~]|[#()<>[\]{}/%]/g,
    (char) => `#${char.charCodeAt(0).toString(16).padStart(2, "0")}`,
  )}`;

const hexText = (bytes: Uint8Array) => {
  let text = "<";
  for (const byte of bytes) text += byte.toString(16).padStart(2, "0");
  return `${text}>`;
};

function valueText(value: PdfValue): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number") return numberText(value);
  if (value instanceof PdfName) return nameText(value.name);
  if (value instanceof PdfRef) return `${value.ref} 0 R`;
  if (value instanceof PdfBytes) return hexText(value.bytes);
  if (value instanceof Map) {
    let text = "<<";
    for (const [key, each] of value) text += `${nameText(key)} ${valueText(each)} `;
    return `${text}>>`;
  }
  return `[${(value as readonly PdfValue[]).map(valueText).join(" ")}]`;
}

/** How a file's strings and streams are locked: one call per string or stream of an object. */
type Lock = (number: number, bytes: Uint8Array) => Promise<Uint8Array>;

async function lockedValue(value: PdfValue, number: number, lock: Lock): Promise<PdfValue> {
  if (value instanceof PdfBytes) return new PdfBytes(await lock(number, value.bytes));
  if (value instanceof Map) {
    const out: PdfDict = new Map();
    for (const [key, each] of value) out.set(key, await lockedValue(each, number, lock));
    return out;
  }
  if (Array.isArray(value)) {
    const out: PdfValue[] = [];
    for (const each of value) out.push(await lockedValue(each, number, lock));
    return out;
  }
  return value;
}

/** The whole file, one object after the other. `lock` encrypts all but the object `spared`. */
export async function writePdf(
  document: PdfDocument,
  lock?: Lock,
  spared?: number,
): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  let length = 0;
  const put = (part: Uint8Array | string) => {
    const bytes = typeof part === "string" ? bytesOf(part) : part;
    parts.push(bytes);
    length += bytes.length;
  };
  put("%PDF-1.7\n%\u00e2\u00e3\u00cf\u00d3\n");
  const offsets = new Map<number, number>();
  const numbers = [...document.objects.keys()].sort((a, b) => a - b);
  for (const number of numbers) {
    let object = document.objects.get(number) as PdfObject;
    offsets.set(number, length);
    if (lock && number !== spared) {
      object = isStream(object)
        ? {
            dict: (await lockedValue(object.dict, number, lock)) as PdfDict,
            bytes: await lock(number, object.bytes),
          }
        : await lockedValue(object, number, lock);
    }
    put(`${number} 0 obj\n`);
    if (isStream(object)) {
      const dict = new Map(object.dict);
      dict.set("Length", object.bytes.length);
      put(`${valueText(dict)}\nstream\n`);
      put(object.bytes);
      put("\nendstream");
    } else put(valueText(object));
    put("\nendobj\n");
  }
  const size = (numbers.at(-1) ?? 0) + 1;
  const table = length;
  put(`xref\n0 ${size}\n`);
  let lastFree = 0;
  const frees = new Map<number, number>();
  for (let number = size - 1; number > 0; number -= 1) {
    if (offsets.has(number)) continue;
    frees.set(number, lastFree);
    lastFree = number;
  }
  put(`${String(lastFree).padStart(10, "0")} 65535 f \n`);
  for (let number = 1; number < size; number += 1) {
    const offset = offsets.get(number);
    put(
      offset === undefined
        ? `${String(frees.get(number)).padStart(10, "0")} 00001 f \n`
        : `${String(offset).padStart(10, "0")} 00000 n \n`,
    );
  }
  const trailer: PdfDict = new Map([["Size", size]]);
  for (const key of ["Root", "Info", "ID", "Encrypt"]) {
    const value = document.trailer.get(key);
    if (value !== undefined) trailer.set(key, value);
  }
  put(`trailer\n${valueText(trailer)}\nstartxref\n${table}\n%%EOF\n`);
  const out = new Uint8Array(length);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

const resolved = (document: PdfDocument, value: PdfObject | undefined): PdfObject | undefined =>
  value instanceof PdfRef ? document.objects.get(value.ref) : value;

const nextNumber = (document: PdfDocument) => Math.max(0, ...document.objects.keys()) + 1;

/** Keeps a new object in the document, and answers a reference to it. */
export function addObject(document: PdfDocument, object: PdfObject): PdfRef {
  const number = nextNumber(document);
  document.objects.set(number, object);
  return new PdfRef(number);
}

/** A page, with what it inherits from the page tree. */
export interface PdfPage {
  dict: PdfDict;
  /** The visible box: x, y, width, height, in the page's own coordinates. */
  box: readonly [number, number, number, number];
  /** Clockwise, 0, 90, 180 or 270. */
  rotate: number;
  resources: PdfDict;
}

/** Every page of the document, in order. */
export function pagesOfPdf(document: PdfDocument): PdfPage[] {
  const catalog = resolved(document, document.trailer.get("Root"));
  if (!isDict(catalog)) throw new PdfUnreadable("The file has no catalogue.");
  const pages: PdfPage[] = [];
  const visited = new Set<PdfDict>();
  const walk = (node: PdfObject | undefined, inherited: Map<string, PdfValue>) => {
    if (!isDict(node) || visited.has(node)) return;
    visited.add(node);
    const here = new Map(inherited);
    for (const key of ["Resources", "MediaBox", "CropBox", "Rotate"]) {
      const value = node.get(key);
      if (value !== undefined) here.set(key, value);
    }
    if (nameOf(node.get("Type")) === "Pages" || node.has("Kids")) {
      const kids = resolved(document, node.get("Kids"));
      for (const kid of Array.isArray(kids) ? (kids as readonly PdfValue[]) : []) {
        walk(resolved(document, kid), here);
      }
      return;
    }
    const boxValue = resolved(document, here.get("CropBox") ?? here.get("MediaBox"));
    const numbers = (Array.isArray(boxValue) ? (boxValue as readonly PdfValue[]) : []).map((each) =>
      Number(resolved(document, each)),
    );
    if (numbers.length !== 4 || numbers.some((each) => !Number.isFinite(each))) {
      throw new PdfUnreadable("A page has no size.");
    }
    const [x0, y0, x1, y1] = numbers as [number, number, number, number];
    const rotate = ((Number(resolved(document, here.get("Rotate")) ?? 0) % 360) + 360) % 360;
    const held = resolved(document, here.get("Resources"));
    pages.push({
      dict: node,
      box: [Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)],
      rotate,
      resources: isDict(held) ? held : new Map(),
    });
  };
  walk(resolved(document, catalog.get("Pages")), new Map());
  if (pages.length === 0) throw new PdfUnreadable("The file has no pages.");
  return pages;
}

/** The size a page is seen at, its rotation applied. */
export const shownSize = ({ box, rotate }: PdfPage): readonly [number, number] =>
  rotate === 90 || rotate === 270 ? [box[3], box[2]] : [box[2], box[3]];

/** The matrix from a page as it is seen (origin at its lower left corner) to its own coordinates. */
export function shownMatrix({ box, rotate }: PdfPage): string {
  const [x, y, width, height] = box;
  if (rotate === 90) return `0 1 -1 0 ${x + width} ${y} cm`;
  if (rotate === 180) return `-1 0 0 -1 ${x + width} ${y + height} cm`;
  if (rotate === 270) return `0 -1 1 0 ${x} ${y + height} cm`;
  return `1 0 0 1 ${x} ${y} cm`;
}

/** Names that a new resource of a page's category can take. */
function resourceName(group: PdfDict): string {
  let at = group.size;
  while (group.has(`Automator${at}`)) at += 1;
  return `Automator${at}`;
}

/** Gives the page a resource of a category (`XObject`, `ExtGState`); answers its name there. */
export function addResource(
  document: PdfDocument,
  page: PdfPage,
  category: string,
  value: PdfValue,
): string {
  // The page's own copy: another page may share the dictionary it inherits.
  const own = new Map(page.resources);
  const held = resolved(document, own.get(category));
  const group = new Map(isDict(held) ? held : []);
  const name = resourceName(group);
  group.set(name, value);
  own.set(category, group);
  page.resources = own;
  page.dict.set("Resources", own);
  return name;
}

/** Draws on a page, over or under what it holds, whatever state that content leaves behind it. */
export function drawOnPage(document: PdfDocument, page: PdfPage, content: string, under = false) {
  const stream = (text: string) =>
    addObject(document, { dict: new Map(), bytes: bytesOf(text) } satisfies PdfStream);
  const before = resolved(document, page.dict.get("Contents"));
  const old = (
    Array.isArray(before)
      ? (before as readonly PdfValue[])
      : page.dict.has("Contents")
        ? [page.dict.get("Contents") as PdfValue]
        : []
  ).filter((each) => each !== null);
  const drawn = stream(`q\n${shownMatrix(page)}\n${content}\nQ\n`);
  page.dict.set(
    "Contents",
    under ? [drawn, ...old] : [stream("q\n"), ...old, stream("\nQ\n"), drawn],
  );
}

/** The lines of a grid over a page of this size, every `spacing` points from the lower left corner. */
export function gridContent(
  width: number,
  height: number,
  spacing: number,
  [red, green, blue]: readonly [number, number, number],
): string {
  const lines: string[] = [`${red} ${green} ${blue} RG`, "0.5 w"];
  for (let x = spacing; x < width; x += spacing) lines.push(`${x} 0 m ${x} ${height} l S`);
  for (let y = spacing; y < height; y += spacing) lines.push(`0 ${y} m ${width} ${y} l S`);
  return lines.join("\n");
}

type Tone = readonly { mode: string; colour: readonly number[]; opacity?: number }[];

const TO_GRAY = { mode: "Saturation", colour: [1, 1, 1] };
const BURN = { mode: "ColorBurn", colour: [0.5, 0.5, 0.5] };
const DODGE = { mode: "ColorDodge", colour: [0.5, 0.5, 0.5] };

/**
 * Each tone as blends of a cover the size of the page, which change what is drawn below without
 * reading it. Black & White: gray, then one burn and three dodges take every gray under 0.5 to black
 * and every gray over 0.5625 to white.
 */
const TONES: Readonly<Record<string, Tone>> = {
  "Black & White": [TO_GRAY, BURN, DODGE, DODGE, DODGE],
  "Blue Tone": [TO_GRAY, { mode: "Multiply", colour: [0.72, 0.82, 1] }],
  "Gray Tone": [TO_GRAY],
  "Lightness Decrease": [{ mode: "Normal", colour: [0, 0, 0], opacity: 0.25 }],
  "Lightness Increase": [{ mode: "Normal", colour: [1, 1, 1], opacity: 0.25 }],
  "Sepia Tone": [TO_GRAY, { mode: "Multiply", colour: [0.96, 0.87, 0.7] }],
};

export const isTone = (filter: string) => Object.hasOwn(TONES, filter);

/** Covers a page with a tone of `TONES`. */
export function toneOnPage(document: PdfDocument, page: PdfPage, filter: string) {
  const [width, height] = shownSize(page);
  const covers = (TONES[filter] ?? []).map(({ mode, colour, opacity = 1 }) => {
    const state = addResource(
      document,
      page,
      "ExtGState",
      new Map<string, PdfValue>([
        ["BM", new PdfName(mode)],
        ["ca", opacity],
      ]),
    );
    return `/${state} gs\n${colour.join(" ")} rg\n0 0 ${width} ${height} re f`;
  });
  drawOnPage(document, page, covers.join("\n"));
}

/** Places an image of this drawn size on a page: `x` and `y` from its lower left, turned by `angle`. */
export function placedImage(
  name: string,
  width: number,
  height: number,
  x: number,
  y: number,
  angle: number,
  state?: string,
): string {
  const radians = (angle * Math.PI) / 180;
  const [cos, sin] = [Math.cos(radians), Math.sin(radians)];
  const matrix = [width * cos, width * sin, -height * sin, height * cos, x, y].map(numberText);
  return `q\n${state ? `/${state} gs\n` : ""}${matrix.join(" ")} cm\n/${name} Do\nQ`;
}

/** RGBA pixels as an image object that keeps their transparency; answers a reference to it. */
export async function addPixelImage(
  document: PdfDocument,
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<PdfRef> {
  const count = width * height;
  const colours = new Uint8Array(count * 3);
  const alpha = new Uint8Array(count);
  let opaque = true;
  for (let at = 0; at < count; at += 1) {
    colours[at * 3] = pixels[at * 4] as number;
    colours[at * 3 + 1] = pixels[at * 4 + 1] as number;
    colours[at * 3 + 2] = pixels[at * 4 + 2] as number;
    alpha[at] = pixels[at * 4 + 3] as number;
    if (alpha[at] !== 255) opaque = false;
  }
  const image = (space: string, bytes: Uint8Array): PdfStream => ({
    dict: new Map<string, PdfValue>([
      ["Type", new PdfName("XObject")],
      ["Subtype", new PdfName("Image")],
      ["Width", width],
      ["Height", height],
      ["ColorSpace", new PdfName(space)],
      ["BitsPerComponent", 8],
      ["Filter", new PdfName("FlateDecode")],
    ]),
    bytes,
  });
  const made = image("DeviceRGB", await deflate(colours));
  if (!opaque) {
    made.dict.set("SMask", addObject(document, image("DeviceGray", await deflate(alpha))));
  }
  return addObject(document, made);
}

/** The images in a document that can be drawn on a canvas and written again as a JPEG. */
export function compressibleImages(document: PdfDocument): number[] {
  const found: number[] = [];
  for (const [number, object] of document.objects) {
    if (!isStream(object)) continue;
    const { dict } = object;
    if (nameOf(dict.get("Subtype")) !== "Image") continue;
    if (dict.get("ImageMask") === true || dict.has("Decode") || dict.has("Mask")) continue;
    if (dict.get("BitsPerComponent") !== 8 && !isJpeg(object)) continue;
    const space = nameOf(resolved(document, dict.get("ColorSpace")) as PdfValue);
    if (isJpeg(object) ? space === "DeviceCMYK" : space !== "DeviceRGB" && space !== "DeviceGray") {
      continue;
    }
    // A soft mask is itself an image, tied to its own pixels and read as coverage, not colour.
    if ([...document.objects.values()].some((each) => isMaskOf(each, number))) continue;
    found.push(number);
  }
  return found;
}

const isMaskOf = (object: PdfObject, number: number) => {
  if (!isStream(object)) return false;
  const mask = object.dict.get("SMask");
  return mask instanceof PdfRef && mask.ref === number;
};

export const isJpeg = (stream: PdfStream) => {
  const filters = listOf(stream.dict.get("Filter"));
  return filters.length === 1 && nameOf(filters[0]) === "DCTDecode";
};

/** Replaces an image's bytes with a JPEG of the same pixels. */
export function setJpeg(stream: PdfStream, bytes: Uint8Array) {
  stream.bytes = bytes;
  stream.dict.set("Filter", new PdfName("DCTDecode"));
  stream.dict.set("ColorSpace", new PdfName("DeviceRGB"));
  stream.dict.set("BitsPerComponent", 8);
  stream.dict.delete("DecodeParms");
}

/* ------------------------------------------------------------------------------- locking */

const MD5_SHIFTS = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
const MD5_SINES = Array.from({ length: 64 }, (_, at) =>
  Math.floor(Math.abs(Math.sin(at + 1)) * 2 ** 32),
);

/** MD5, which the PDF password scheme is built on; Web Crypto has none. */
export function md5(message: Uint8Array): Uint8Array {
  const padded = new Uint8Array((((message.length + 8) >> 6) + 1) * 64);
  padded.set(message);
  padded[message.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, message.length * 8, true);
  view.setUint32(padded.length - 4, Math.floor(message.length / 2 ** 29), true);
  let [a, b, c, d] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
  for (let block = 0; block < padded.length; block += 64) {
    let [aa, bb, cc, dd] = [a, b, c, d];
    for (let at = 0; at < 64; at += 1) {
      let mix: number;
      let word: number;
      if (at < 16) {
        mix = (bb & cc) | (~bb & dd);
        word = at;
      } else if (at < 32) {
        mix = (dd & bb) | (~dd & cc);
        word = (5 * at + 1) % 16;
      } else if (at < 48) {
        mix = bb ^ cc ^ dd;
        word = (3 * at + 5) % 16;
      } else {
        mix = cc ^ (bb | ~dd);
        word = (7 * at) % 16;
      }
      const total =
        (aa + mix + (MD5_SINES[at] as number) + view.getUint32(block + word * 4, true)) >>> 0;
      const shift = MD5_SHIFTS[(at >> 4) * 4 + (at % 4)] as number;
      aa = dd;
      dd = cc;
      cc = bb;
      bb = (bb + ((total << shift) | (total >>> (32 - shift)))) >>> 0;
    }
    a = (a + aa) >>> 0;
    b = (b + bb) >>> 0;
    c = (c + cc) >>> 0;
    d = (d + dd) >>> 0;
  }
  const out = new Uint8Array(16);
  const result = new DataView(out.buffer);
  [a, b, c, d].forEach((value, at) => {
    result.setUint32(at * 4, value, true);
  });
  return out;
}

/** RC4, which the scheme keeps its two password checks in. */
export function rc4(key: Uint8Array, data: Uint8Array): Uint8Array {
  const state = Uint8Array.from({ length: 256 }, (_, at) => at);
  let j = 0;
  for (let i = 0; i < 256; i += 1) {
    j = (j + (state[i] as number) + (key[i % key.length] as number)) & 255;
    [state[i], state[j]] = [state[j] as number, state[i] as number];
  }
  const out = new Uint8Array(data.length);
  let i = 0;
  j = 0;
  for (let at = 0; at < data.length; at += 1) {
    i = (i + 1) & 255;
    j = (j + (state[i] as number)) & 255;
    [state[i], state[j]] = [state[j] as number, state[i] as number];
    out[at] =
      (data[at] as number) ^ (state[((state[i] as number) + (state[j] as number)) & 255] as number);
  }
  return out;
}

const PADDING = Uint8Array.from([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);

const joined = (...parts: readonly Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

const padded = (password: string) =>
  joined(new TextEncoder().encode(password).slice(0, 32), PADDING).slice(0, 32);

/** What everyone may do with a document once it is open: everything. */
const PERMISSIONS = -4;

const rounds = (hash: Uint8Array) => {
  let out = hash;
  for (let at = 0; at < 50; at += 1) out = md5(out.slice(0, 16));
  return out.slice(0, 16);
};

const nineteen = (key: Uint8Array, start: Uint8Array) => {
  let out = rc4(key, start);
  for (let at = 1; at <= 19; at += 1) {
    out = rc4(
      key.map((byte) => byte ^ at),
      out,
    );
  }
  return out;
};

/** The checks and the key of the standard handler, revision 4 (ISO 32000-1, 7.6.3). */
export function pdfLockKeys(password: string, id: Uint8Array) {
  const owner = nineteen(rounds(md5(padded(password))), padded(password));
  const permissions = new Uint8Array(4);
  new DataView(permissions.buffer).setInt32(0, PERMISSIONS, true);
  const key = rounds(md5(joined(padded(password), owner, permissions, id)));
  const user = joined(nineteen(key, md5(joined(PADDING, id))), new Uint8Array(16));
  return { owner, user, key };
}

/** The file locked with a password, every string and stream encrypted with AES-128. */
export async function lockPdf(document: PdfDocument, password: string): Promise<Uint8Array> {
  const given = document.trailer.get("ID");
  const first = Array.isArray(given) ? (given as readonly PdfValue[])[0] : undefined;
  const id = first instanceof PdfBytes ? first.bytes : crypto.getRandomValues(new Uint8Array(16));
  document.trailer.set("ID", [new PdfBytes(id), new PdfBytes(id)]);
  const { owner, user, key } = pdfLockKeys(password, id);
  const filter = new Map<string, PdfValue>([
    ["CFM", new PdfName("AESV2")],
    ["AuthEvent", new PdfName("DocOpen")],
    ["Length", 16],
  ]);
  const encrypt = addObject(
    document,
    new Map<string, PdfValue>([
      ["Filter", new PdfName("Standard")],
      ["V", 4],
      ["R", 4],
      ["Length", 128],
      ["P", PERMISSIONS],
      ["O", new PdfBytes(owner)],
      ["U", new PdfBytes(user)],
      ["CF", new Map([["StdCF", filter]])],
      ["StmF", new PdfName("StdCF")],
      ["StrF", new PdfName("StdCF")],
    ]),
  );
  document.trailer.set("Encrypt", encrypt);
  const lock: Lock = async (number, bytes) => {
    const salted = joined(
      key,
      Uint8Array.from([number & 255, (number >> 8) & 255, (number >> 16) & 255, 0, 0]),
      bytesOf("sAlT"),
    );
    const objectKey = await crypto.subtle.importKey(
      "raw",
      md5(salted) as Uint8Array<ArrayBuffer>,
      "AES-CBC",
      false,
      ["encrypt"],
    );
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const sealed = await crypto.subtle.encrypt(
      { name: "AES-CBC", iv },
      objectKey,
      bytes as Uint8Array<ArrayBuffer>,
    );
    return joined(iv, new Uint8Array(sealed));
  };
  return writePdf(document, lock, encrypt.ref);
}

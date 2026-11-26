/*
 * An EPUB the person opens from a file, read in the browser: the ZIP's central directory, its
 * entries inflated with `DecompressionStream("deflate-raw")` (Chromium, Firefox and WebKit all
 * have it), `META-INF/container.xml`, the package document's title, author and spine, and each
 * spine document's text. The server never reads it: the file is on the person's drive, and the
 * library keeps the drive's id of it and an id made from its SHA-256.
 *
 * A file is refused, with an `EpubError` that says why, when it is not what it says it is: a
 * reading order that names a document the package does not list, or a chapter missing from the
 * archive (a book with chapters left out is not opened), and a file that asks for more work than
 * any book needs (`EPUB_LIMITS`): a longer reading order, more inflated chapter bytes in all (a
 * chapter named twice counts twice, so a small archive cannot inflate one chapter over and over),
 * or more text.
 *
 * A picture takes no room in the text: it is a position (`EpubPicture.at`) between two characters,
 * so the text of a book, and with it every place, bookmark, highlight and search result kept for
 * it, is the same with pictures as it was without them. Only files inside the archive are
 * pictures: an address elsewhere is never fetched.
 *
 * A book of pictures and no words at all has no characters for a position to stand between, so its
 * text is one line for each picture, "Picture 1", "Picture 2" and so on, each picture standing
 * before its line. The lines depend only on the file, so a place kept in such a book stays good.
 */
import { skipSpace } from "./books-text";

/** One heading of the book, at its offset in the text. */
export interface EpubHeading {
  title: string;
  at: number;
}

/** One picture of the book, at its position in the text. */
export interface EpubPicture {
  /** The offset in the text it stands before; the text's length for one after all of it. */
  at: number;
  /** Its file in the archive. */
  path: string;
  /** Its media type. */
  type: string;
  /** A store book's picture: its place in the server's list, by which its file is asked for. */
  n?: number;
}

export interface EpubBook {
  title: string;
  author: string;
  /** The whole text: paragraphs separated by a blank line. */
  text: string;
  toc: EpubHeading[];
  /** In the order of the text. */
  pictures: EpubPicture[];
}

/** The largest EPUB opened, in bytes. */
export const MAX_EPUB_BYTES = 64 * 1024 * 1024;
/** The most bytes one entry may hold once read, stored or inflated. */
export const MAX_ENTRY_BYTES = 32 * 1024 * 1024;

/** How much of a file Books reads before it refuses it. */
export interface EpubLimits {
  /** The most entries of the reading order (`itemref`), a document named twice counted twice. */
  spine: number;
  /** The most bytes the reading order's documents inflate to, all together, a document named
   * twice counted twice. */
  decoded: number;
  /** The most characters of text, in UTF-16 units. */
  text: number;
}

export const EPUB_LIMITS: EpubLimits = {
  spine: 2_000,
  decoded: 128 * 1024 * 1024,
  text: 20_000_000,
};

const megabytes = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;
const withCommas = (n: number) => n.toLocaleString("en-US");

export class EpubError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EpubError";
  }
}

interface Entry {
  name: string;
  method: number;
  compressed: number;
  size: number;
  offset: number;
}

const u16 = (view: DataView, at: number) => view.getUint16(at, true);
const u32 = (view: DataView, at: number) => view.getUint32(at, true);

/** The entries of a ZIP's central directory. */
export function zipEntries(bytes: Uint8Array): Map<string, Entry> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end-of-central-directory record: 22 bytes and a comment of at most 65,535.
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 65_535); at -= 1) {
    if (u32(view, at) === 0x06054b50) {
      end = at;
      break;
    }
  }
  if (end < 0) throw new EpubError("The file is not an EPUB: it is not a ZIP archive.");
  const count = u16(view, end + 10);
  let at = u32(view, end + 16);
  const entries = new Map<string, Entry>();
  const decoder = new TextDecoder();
  for (let index = 0; index < count; index += 1) {
    if (at + 46 > bytes.length || u32(view, at) !== 0x02014b50) {
      throw new EpubError("The EPUB's table of files is damaged.");
    }
    const nameLength = u16(view, at + 28);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    entries.set(name, {
      name,
      method: u16(view, at + 10),
      compressed: u32(view, at + 20),
      size: u32(view, at + 24),
      offset: u32(view, at + 42),
    });
    at += 46 + nameLength + u16(view, at + 30) + u16(view, at + 32);
  }
  return entries;
}

/** What one read of the stream hands over: an entry in pieces, so the limit stops a long one early. */
const INFLATE_CHUNK = 64 * 1024;

async function inflate(data: Uint8Array, limit: number, refusal: string): Promise<Uint8Array> {
  let sent = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= data.length) {
        controller.close();
        return;
      }
      controller.enqueue(data.subarray(sent, sent + INFLATE_CHUNK));
      sent += INFLATE_CHUNK;
    },
  }).pipeThrough(
    new DecompressionStream("deflate-raw") as unknown as TransformStream<Uint8Array, Uint8Array>,
  );
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      throw new EpubError(refusal);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/**
 * The bytes of one entry, inflated when it is compressed: at most [`MAX_ENTRY_BYTES`] whether it
 * is stored or compressed. `budget` bounds them further: at most `budget.bytes`, else an
 * `EpubError` with `budget.message`.
 */
export async function readEntry(
  bytes: Uint8Array,
  entry: Entry,
  budget?: { bytes: number; message: string },
): Promise<Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (entry.offset + 30 > bytes.length || u32(view, entry.offset) !== 0x04034b50) {
    throw new EpubError(`The EPUB's file ${entry.name} is damaged.`);
  }
  const start = entry.offset + 30 + u16(view, entry.offset + 26) + u16(view, entry.offset + 28);
  const data = bytes.subarray(start, start + entry.compressed);
  const left = budget?.bytes ?? Number.POSITIVE_INFINITY;
  if (entry.method === 0) {
    if (data.length > left) throw new EpubError(budget?.message ?? "");
    if (data.length > MAX_ENTRY_BYTES) {
      throw new EpubError("A file inside the EPUB is too large to read.");
    }
    return data;
  }
  if (entry.method === 8) {
    const own = Math.min(MAX_ENTRY_BYTES, Math.max(entry.size, 1) * 2);
    return own <= left
      ? inflate(data, own, "A file inside the EPUB is too large to read.")
      : inflate(data, left, budget?.message ?? "");
  }
  throw new EpubError(`The EPUB's file ${entry.name} is packed in a way Books cannot read.`);
}

/** `href` (URL-encoded, relative to `base`, a folder ending in "/" or "") as a ZIP path. */
export function resolvePath(base: string, href: string): string {
  const clean = href.split("#")[0] ?? "";
  let decoded = clean;
  try {
    decoded = decodeURIComponent(clean);
  } catch {
    decoded = clean;
  }
  const parts = (decoded.startsWith("/") ? decoded.slice(1) : `${base}${decoded}`).split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "..") out.pop();
    else if (part !== "." && part !== "") out.push(part);
  }
  return out.join("/");
}

const xml = (text: string, type: DOMParserSupportedType = "application/xml") => {
  const document = new DOMParser().parseFromString(text, type);
  return document.getElementsByTagName("parsererror").length > 0 ? null : document;
};

/** The media types an `<img>` shows, by file extension. */
const PICTURE_TYPES: Readonly<Record<string, string>> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
};
const SHOWN_TYPES = new Set(Object.values(PICTURE_TYPES));

/** The most pictures of one book shown; past them the book reads on with their alt text alone. */
const MAX_PICTURES = 10_000;

/** The elements of `document` with a local name, whatever their namespace prefix. */
const named = (root: Document | Element, local: string): Element[] =>
  [...root.getElementsByTagName("*")].filter((element) => element.localName === local);

const BLOCKS = new Set([
  "p",
  "div",
  "section",
  "article",
  "header",
  "footer",
  "aside",
  "nav",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "ul",
  "ol",
  "dl",
  "dt",
  "dd",
  "table",
  "tr",
  "figure",
  "figcaption",
  "hr",
  "br",
  "pre",
  "hgroup",
  "main",
  "body",
]);
const SKIPPED = new Set(["script", "style", "head", "title", "svg", "math"]);
const HEADINGS = new Set(["h1", "h2", "h3"]);

/** A picture of one document: where it stands in the paragraphs, and its address as written. */
export interface DocumentPicture {
  /** The paragraph it is in or before; the paragraphs' count for one after them all. */
  paragraph: number;
  /** How many characters of that paragraph come before it. */
  offset: number;
  src: string;
}

/** One spine document's paragraphs, headings and pictures. */
export function documentText(root: Element): {
  paragraphs: string[];
  headings: number[];
  pictures: DocumentPicture[];
} {
  const paragraphs: string[] = [];
  const headings: number[] = [];
  const pictures: DocumentPicture[] = [];
  let current = "";
  const picture = (src: string | null | undefined) => {
    if (!src) return;
    pictures.push({
      paragraph: paragraphs.length,
      offset: current.replace(/\s+/g, " ").trimStart().length,
      src,
    });
  };
  const flush = () => {
    const line = current.replace(/\s+/g, " ").trim();
    if (line) paragraphs.push(line);
    current = "";
  };
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      current += node.nodeValue ?? "";
      return;
    }
    if (node.nodeType !== 1) return;
    const element = node as Element;
    const name = element.localName.toLowerCase();
    if (name === "svg") {
      const image = named(element, "image")[0];
      picture(image?.getAttribute("xlink:href") ?? image?.getAttribute("href"));
    }
    if (SKIPPED.has(name)) return;
    const block = BLOCKS.has(name);
    if (block) flush();
    if (name === "img") {
      picture(element.getAttribute("src"));
      const alt = element.getAttribute("alt")?.trim();
      if (alt) current += ` ${alt} `;
    }
    for (const child of element.childNodes) walk(child);
    if (block) {
      const before = paragraphs.length;
      flush();
      if (HEADINGS.has(name) && paragraphs.length > before) headings.push(paragraphs.length - 1);
    }
  };
  walk(root);
  flush();
  return { paragraphs, headings, pictures };
}

/** The encoding a document's byte-order mark or XML declaration names; UTF-8 when it names none. */
function encodingOf(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return "utf-16le";
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return "utf-16be";
  const start = String.fromCharCode(...bytes.subarray(0, 200));
  return /^(?:\xef\xbb\xbf)?<\?xml[^>]*?encoding=["']([^"']+)["']/i.exec(start)?.[1] ?? "utf-8";
}

/** A document's text in the encoding it declares. One this browser has no decoder for is refused. */
function text(bytes: Uint8Array): string {
  const encoding = encodingOf(bytes);
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(encoding);
  } catch {
    throw new EpubError(
      `The EPUB is written in the encoding ${encoding}, which Books cannot read.`,
    );
  }
  return decoder.decode(bytes);
}

/**
 * Read an EPUB: its title, author, text and the headings of its chapters. `limits` replaces some
 * of `EPUB_LIMITS` (a test reads a small file under small ones).
 */
export async function readEpub(
  bytes: Uint8Array,
  limits: Partial<EpubLimits> = {},
): Promise<EpubBook> {
  const bounds: EpubLimits = { ...EPUB_LIMITS, ...limits };
  if (bytes.length > MAX_EPUB_BYTES) {
    throw new EpubError("The EPUB is larger than Books opens (64 MB).");
  }
  const entries = zipEntries(bytes);
  const entry = (name: string) => entries.get(name);
  const container = entry("META-INF/container.xml");
  if (!container) throw new EpubError("The file is not an EPUB: it has no META-INF/container.xml.");
  const containerXml = xml(text(await readEntry(bytes, container)));
  const rootPath = containerXml
    ? named(containerXml, "rootfile")[0]?.getAttribute("full-path")
    : null;
  const packageEntry = rootPath ? entry(resolvePath("", rootPath)) : undefined;
  if (!rootPath || !packageEntry) throw new EpubError("The EPUB names no package document.");
  const opf = xml(text(await readEntry(bytes, packageEntry)));
  if (!opf) throw new EpubError("The EPUB's package document cannot be read.");
  const base = rootPath.includes("/") ? rootPath.slice(0, rootPath.lastIndexOf("/") + 1) : "";
  const title = named(opf, "title")[0]?.textContent?.replace(/\s+/g, " ").trim() || "Untitled";
  const author = named(opf, "creator")[0]?.textContent?.replace(/\s+/g, " ").trim() ?? "";
  const manifest = new Map<string, { href: string; type: string }>();
  for (const item of named(opf, "item")) {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (id && href) manifest.set(id, { href, type: item.getAttribute("media-type") ?? "" });
  }
  // The reading order, every entry counted (one document named twice is read twice).
  const refs = named(opf, "itemref");
  if (refs.length > bounds.spine) {
    throw new EpubError(
      `The EPUB's reading order names ${withCommas(refs.length)} documents; Books reads at most ${withCommas(bounds.spine)}.`,
    );
  }
  const spine: { href: string; type: string }[] = [];
  for (const ref of refs) {
    if (ref.getAttribute("linear") === "no") continue;
    const idref = ref.getAttribute("idref") ?? "";
    const item = manifest.get(idref);
    if (!item) {
      throw new EpubError(
        `The EPUB is damaged: its reading order names “${idref}”, which its package does not list. Get the book again, or open another copy.`,
      );
    }
    // A picture named by the reading order stands in the text; any other kind has nothing to show.
    if (item.type === "" || /xhtml|html/.test(item.type) || SHOWN_TYPES.has(item.type)) {
      spine.push(item);
    }
  }
  if (spine.length === 0) throw new EpubError("The EPUB has no chapters to read.");
  const tooMuch = `The EPUB's chapters are larger than Books reads (${megabytes(bounds.decoded)} in all).`;
  const tooLong = `The EPUB's text is longer than Books reads (${withCommas(bounds.text)} characters).`;
  let decoded = 0;
  let out = "";
  const toc: EpubHeading[] = [];
  const pictures: EpubPicture[] = [];
  /** Pictures after the last text so far: they stand before the next paragraph, whichever it is. */
  let waiting: { path: string; type: string }[] = [];
  const typeOf = new Map(
    [...manifest.values()].map(({ href, type }) => [resolvePath(base, href), type]),
  );
  /** The picture of an address, when it names a picture in the archive. */
  const pictureFile = (folder: string, src: string) => {
    const path = resolvePath(folder, src);
    const type =
      typeOf.get(path) || (PICTURE_TYPES[path.split(".").pop()?.toLowerCase() ?? ""] ?? "");
    return entries.has(path) && SHOWN_TYPES.has(type) ? { path, type } : null;
  };
  for (const item of spine) {
    const path = resolvePath(base, item.href);
    if (SHOWN_TYPES.has(item.type)) {
      const own = pictureFile(base, item.href);
      if (own) waiting.push(own);
      continue;
    }
    const file = entry(path);
    if (!file) {
      throw new EpubError(
        `The EPUB is damaged: its chapter “${path}” is missing from the file. Get the book again, or open another copy.`,
      );
    }
    const raw = await readEntry(bytes, file, { bytes: bounds.decoded - decoded, message: tooMuch });
    decoded += raw.length;
    const source = text(raw);
    const document =
      xml(source, "application/xhtml+xml") ?? new DOMParser().parseFromString(source, "text/html");
    const body = named(document, "body")[0] ?? document.documentElement;
    if (!body) continue;
    const own = documentText(body);
    const { paragraphs, headings } = own;
    const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : "";
    for (let index = 0; index < paragraphs.length; index += 1) {
      const paragraph = paragraphs[index] as string;
      if (out.length + (out ? 2 : 0) + paragraph.length > bounds.text) throw new EpubError(tooLong);
      if (out) out += "\n\n";
      if (headings.includes(index)) toc.push({ title: paragraph.slice(0, 80), at: out.length });
      for (const held of waiting) pictures.push({ at: out.length, ...held });
      waiting = [];
      for (const each of own.pictures) {
        if (each.paragraph !== index) continue;
        const found = pictureFile(folder, each.src);
        if (!found) continue;
        // A page's next one starts past the white space after it, so a picture never stands
        // before white space, nor at a paragraph's end, where the blank line follows.
        const before = skipSpace(paragraph, each.offset);
        if (before >= paragraph.length) waiting.push(found);
        else pictures.push({ at: out.length + before, ...found });
      }
      out += paragraph;
    }
    for (const each of own.pictures) {
      if (each.paragraph < paragraphs.length) continue;
      const found = pictureFile(folder, each.src);
      if (found) waiting.push(found);
    }
  }
  if (!out) {
    if (waiting.length === 0) throw new EpubError("The EPUB has no text Books can show.");
    if (waiting.length > MAX_PICTURES) {
      throw new EpubError(
        `The EPUB is ${withCommas(waiting.length)} pictures; Books shows at most ${withCommas(MAX_PICTURES)}.`,
      );
    }
    for (const [at, held] of waiting.entries()) {
      if (out) out += "\n\n";
      pictures.push({ at: out.length, ...held });
      out += `Picture ${at + 1}`;
    }
    waiting = [];
  }
  for (const held of waiting) pictures.push({ at: out.length, ...held });
  const seen = new Set<string>();
  const once = pictures.filter(({ at, path }) => {
    const name = `${at}:${path}`;
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });
  return {
    title: title.slice(0, 300),
    author: author.slice(0, 300),
    text: out,
    toc,
    pictures: once.slice(0, MAX_PICTURES),
  };
}

/** The file of one of the book's pictures, read from the EPUB's bytes when it is shown. */
export async function readEpubPicture(bytes: Uint8Array, picture: EpubPicture): Promise<Blob> {
  const file = zipEntries(bytes).get(picture.path);
  if (!file) throw new EpubError(`The EPUB's picture ${picture.path} is missing from the file.`);
  const data = await readEntry(bytes, file);
  return new Blob([data as Uint8Array<ArrayBuffer>], { type: picture.type });
}

/** The library id of a file: `kind`, a dash and the first 128 bits of its SHA-256, in hex. */
export async function fileBookId(kind: "epub" | "pdf", bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${kind}-${hex.slice(0, 32)}`;
}

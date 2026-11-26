import {
  type DriveEntry,
  ensureDrive,
  entryOf,
  loadDrive,
  markOpened,
  readFileEntry,
  uploadFile,
} from "../desktop/desktop-files";
import {
  forgetKeptText,
  keepText,
  readKeptText,
  useKeptTextValue,
} from "../desktop/desktop-kept-text";
import type { TextEditDocument, TextEditProperties, TextEditRuler } from "./textedit-data";
import { readLines } from "./textedit-document";
import { decodeText, encodeText } from "./textedit-encodings";
import {
  readDocx,
  readOdt,
  readWebArchive,
  writeDocx,
  writeOdt,
  writeWebArchive,
} from "./textedit-office";
import {
  linesOfParagraphs,
  paragraphsOfContent,
  paragraphsOfLines,
  paragraphsToHtml,
  readRtf,
  rtfTextOfBytes,
  writeRtf,
} from "./textedit-rtf";
import { isBundleName, readBundle, writeBundle } from "./textedit-rtfd";
import { htmlToContent } from "./textedit-server";

/**
 * TextEdit's documents as files of the person's drive (`demos/desktop/desktop-files.ts`, module
 * `src/apps/files` of the desktop's Ferrite application): a rich text document is an `.rtf` file
 * written and read in the browser (`textedit-rtf.ts`: RTF in any code page the browser decodes),
 * a plain text document a `.txt` file in
 * UTF-8, and an `.html` file opens as rich text and is written back as HTML. Text in any other
 * encoding is refused (`UnsupportedEncodingError`). Saving a document that has a file writes its
 * new bytes into that same file (an "overwrite" upload) made from the version of the file it was
 * read from or last saved as, so Finder keeps showing the one file with its name, folder and
 * tags, and a change saved elsewhere meanwhile is never written over unasked.
 */

/**
 * The drive file a document is: its id, its name, and the file's version the document was read
 * from or last saved as (`DriveEntry.version`), which its next save in place is made from.
 */
export interface DriveFileRef {
  id: string;
  name: string;
  version?: number;
  /** A plain text file's encoding, when it is not UTF-8: it is written back in the same one. */
  encoding?: string;
}

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
};

const RICH_EXTENSIONS = ["rtf", "rtfd"];
const HTML_EXTENSIONS = ["html", "htm"];
/** Files whose bytes hold a rich text document that is kept as HTML while it is open. */
const PACKED_EXTENSIONS = ["docx", "odt", "webarchive"];
const PLAIN_EXTENSIONS = ["txt", "text", "md", "markdown", "csv", "log", "json", "xml"];
const DOCUMENT_EXTENSIONS = [
  ...RICH_EXTENSIONS,
  ...HTML_EXTENSIONS,
  ...PACKED_EXTENSIONS,
  ...PLAIN_EXTENSIONS,
];

const PACKED_TYPES: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  odt: "application/vnd.oasis.opendocument.text",
  webarchive: "application/x-webarchive",
};

/** Whether TextEdit opens the drive file: rich text, HTML or plain text. */
export function isTextDocument(entry: Pick<DriveEntry, "kind" | "name" | "type">): boolean {
  if (entry.kind !== "file") return isBundleName(entry.name);
  if (DOCUMENT_EXTENSIONS.includes(extensionOf(entry.name))) return true;
  const type = entry.type ?? "";
  return type.startsWith("text/") || type === "application/rtf";
}

/**
 * Whether a file of the document extension `extension` opens again in `format`: `.rtf` as rich
 * text; `.txt`, `.md` and the other plain extensions as plain text. `.html` opens as rich text
 * rebuilt from markup, so neither format's bytes belong in it, and Word, OpenDocument and Web
 * Archive files are not RTF.
 */
const fitsFormat = (extension: string, format: TextEditDocument["format"]) =>
  format === "rich" ? RICH_EXTENSIONS.includes(extension) : PLAIN_EXTENSIONS.includes(extension);

const extensionFor = (format: TextEditDocument["format"]) => (format === "rich" ? "rtf" : "txt");

/**
 * Whether a document in `format` is written into the file `name` as it is: rich text into `.rtf`
 * (RTF) and `.html` (HTML, `fileText`), plain text into `.txt`, `.md` and the other plain
 * extensions. A document converted to the other format leaves any other file.
 */
export const fileFitsFormat = (name: string, format: TextEditDocument["format"]) =>
  fitsFormat(extensionOf(name), format) || (format === "rich" && isMarkupName(name));

/**
 * `name` with a document extension that `format` does not open as (`.rtf` for plain text, `.txt`
 * or `.html` for rich text) replaced by that format's own, as a Mac's Save sheet does when its
 * File Format changes. A name without a document extension is returned as it is.
 */
export function nameInFormat(name: string, format: TextEditDocument["format"]): string {
  const dot = name.lastIndexOf(".");
  const extension = dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
  if (!DOCUMENT_EXTENSIONS.includes(extension)) return name;
  if (dot > 0 && fitsFormat(extension, format)) return name;
  return `${name.slice(0, dot).trim() || "Untitled"}.${extensionFor(format)}`;
}

/**
 * The name a document is saved under in `format`: its own name with a document extension that
 * format opens as (`Letter.rtf` as plain text is `Letter.txt`, `Notes.md` stays `Notes.md`), or
 * with the format's extension added.
 */
export function fileNameFor(name: string, format: TextEditDocument["format"]): string {
  const trimmed = name.trim() || "Untitled";
  const named = nameInFormat(trimmed, format);
  return named !== trimmed || DOCUMENT_EXTENSIONS.includes(extensionOf(trimmed))
    ? named
    : `${trimmed}.${extensionFor(format)}`;
}

/** The media type of a document's file. */
const typeOf = (format: TextEditDocument["format"]) =>
  format === "rich" ? "text/rtf" : "text/plain;charset=utf-8";

export const isHtmlName = (name: string) => HTML_EXTENSIONS.includes(extensionOf(name));

/** Whether a rich text document in the file `name` is held as HTML: a web page, Word and the like. */
export const isMarkupName = (name: string) =>
  isHtmlName(name) || PACKED_EXTENSIONS.includes(extensionOf(name));

/** `name` with the extension `extension`, for a document extension it has. */
export function nameWithExtension(name: string, extension: string): string {
  const trimmed = name.trim() || "Untitled";
  if (extensionOf(trimmed) === extension) return trimmed;
  return DOCUMENT_EXTENSIONS.includes(extensionOf(trimmed))
    ? `${trimmed.slice(0, trimmed.lastIndexOf(".")).trim() || "Untitled"}.${extension}`
    : `${trimmed}.${extension}`;
}

/** The name a document is saved under as a web page: its name with `.html` for a document extension. */
export function webPageName(name: string): string {
  const trimmed = name.trim() || "Untitled";
  if (isHtmlName(trimmed)) return trimmed;
  return DOCUMENT_EXTENSIONS.includes(extensionOf(trimmed))
    ? `${trimmed.slice(0, trimmed.lastIndexOf(".")).trim() || "Untitled"}.html`
    : `${trimmed}.html`;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** What a document is made of when it is written: its format, lines, formats and ruler. */
export interface DocumentBody {
  format: TextEditDocument["format"];
  lines: readonly string[];
  /** The rich text view, or a copy of its content: its paragraphs with their formats. */
  content?: Node | null;
  ruler?: TextEditRuler;
  properties?: TextEditProperties;
}

/** A document's file text: RTF for rich text, the lines for plain text. */
export function documentText(body: DocumentBody): string {
  if (body.format === "plain") return body.lines.join("\n");
  const paragraphs = body.content
    ? paragraphsOfContent(body.content)
    : paragraphsOfLines(body.lines);
  return writeRtf(paragraphs, body.ruler, body.properties);
}

/**
 * The text a document is written as into its file `name`. A rich text document whose file is
 * `.html` stays HTML (its paragraphs as the rich text view holds them, which open again through
 * `htmlToContent`), so a web page edited in TextEdit is never replaced by RTF under its own name;
 * Word, OpenDocument and Web Archive files are held the same way, and `fileBlob` packs them. Any
 * other file is `documentText`.
 */
export function fileText(body: DocumentBody, name: string): string {
  if (body.format !== "rich" || !isMarkupName(name)) return documentText(body);
  let paragraphs: string;
  if (body.content) {
    const holder = body.content.ownerDocument?.createElement("div");
    if (body.content.nodeType === 1) paragraphs = (body.content as Element).innerHTML;
    else if (holder) {
      holder.append(body.content.cloneNode(true));
      paragraphs = holder.innerHTML;
    } else paragraphs = "";
  } else {
    paragraphs = body.lines
      .map((line) => `<div>${line ? escapeHtml(line) : "<br>"}</div>`)
      .join("");
  }
  // No white space outside the body: it would open again as blank lines.
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${paragraphs}</body></html>`;
}

/** What TextEdit says of a file in a text encoding it does not open. */
export const UNSUPPORTED_ENCODING =
  "This document uses a text encoding TextEdit on Ferrite can’t open yet.";

/**
 * A file TextEdit on Ferrite does not open: RTF with text in a code page the browser does not
 * decode, or text the RTF reader does not read (`readRtf`'s `unsupported`), and a text file that is not
 * UTF-8. Such a file is refused whole, never guessed at or rewritten.
 */
export class UnsupportedEncodingError extends Error {
  constructor() {
    super(UNSUPPORTED_ENCODING);
    this.name = "UnsupportedEncodingError";
  }
}

/**
 * The document a file's text is, named `name`: `.rtf` read as RTF, `.html` rebuilt as rich text,
 * anything else as plain lines. The formats are rebuilt in `target` through the same short list
 * of elements and styles as a stored draft (`htmlToContent`), so nothing in a file can run. RTF
 * with text in another encoding throws `UnsupportedEncodingError`.
 */
export function documentFromText(name: string, text: string, target: Document): TextEditDocument {
  const extension = extensionOf(name);
  // A plain text extension is plain text, whatever its text starts with: a `.txt` holding
  // `{\rtf1 …}` literally opens as those characters.
  const sniffed = !PLAIN_EXTENSIONS.includes(extension) && /^\s*\{\\rtf/.test(text);
  if (RICH_EXTENSIONS.includes(extension) || sniffed) {
    const read = readRtf(text);
    if (read.unsupported) throw new UnsupportedEncodingError();
    const content = htmlToContent(paragraphsToHtml(read.paragraphs), target);
    return {
      name,
      format: "rich",
      lines: linesOfParagraphs(read.paragraphs),
      content,
      ...(read.ruler ? { ruler: read.ruler } : undefined),
      ...(read.properties ? { properties: read.properties } : undefined),
    };
  }
  if (HTML_EXTENSIONS.includes(extension) || PACKED_EXTENSIONS.includes(extension)) {
    const content = htmlToContent(text, target);
    return { name, format: "rich", lines: readLines(content), content };
  }
  const lines = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
  return { name, format: "plain", lines };
}

/** A drive file as a document, and the text it was read from. */
export interface OpenedDocument {
  document: TextEditDocument;
  text: string;
  /** A plain text file's encoding, when it is not UTF-8. */
  encoding?: string;
}

/** Whether bytes start as an RTF file does: `{\rtf`, after a byte order mark and white space. */
const startsAsRtf = (bytes: Uint8Array) =>
  /^(\xEF\xBB\xBF)?\s*\{\\rtf/.test(String.fromCharCode(...bytes.subarray(0, 64)));

/**
 * The document a file's bytes are, named `name`, and the text it was read from. RTF (bytes that
 * start as RTF, under any name but a plain text one) is read from its bytes in the code page it
 * declares (`rtfTextOfBytes`), a UTF-8 byte order mark dropped, and throws
 * `UnsupportedEncodingError` when its text is in one the browser does not decode. Anything else is
 * in `encoding` when the person chose one, else as `decodeText` tells; bytes that are not throw the
 * same, never decoded as a guess.
 */
export function documentFromBytes(
  name: string,
  bytes: Uint8Array,
  target: Document,
  encoding?: string,
): OpenedDocument {
  if (!PLAIN_EXTENSIONS.includes(extensionOf(name)) && startsAsRtf(bytes)) {
    const text = rtfTextOfBytes(bytes);
    return { document: documentFromText(name, text, target), text };
  }
  const read = decodeText(bytes, encoding);
  if (!read) throw new UnsupportedEncodingError();
  return {
    document: documentFromText(name, read.text, target),
    text: read.text,
    ...(read.encoding !== "utf-8" ? { encoding: read.encoding } : undefined),
  };
}

/** The HTML a Word, OpenDocument or Web Archive file holds. */
async function htmlOfPacked(name: string, bytes: Uint8Array): Promise<string> {
  const extension = extensionOf(name);
  if (extension === "webarchive") return readWebArchive(bytes);
  return paragraphsToHtml(await (extension === "docx" ? readDocx(bytes) : readOdt(bytes)));
}

/**
 * The bytes a document's text is written as in the file `name`: Word, OpenDocument and Web Archive
 * files packed from the HTML they are held as, plain text in `encoding`, anything else as UTF-8.
 * Throws `UnencodableTextError` for a character the encoding does not hold.
 */
export function fileBlob(
  text: string,
  name: string,
  format: TextEditDocument["format"],
  encoding = "utf-8",
): Blob {
  const extension = extensionOf(name);
  if (format === "rich" && PACKED_EXTENSIONS.includes(extension)) {
    const type = PACKED_TYPES[extension];
    if (extension === "webarchive") return new Blob([writeWebArchive(text) as BlobPart], { type });
    const paragraphs = paragraphsOfContent(htmlToContent(text, globalThis.document));
    const bytes = extension === "docx" ? writeDocx(paragraphs) : writeOdt(paragraphs);
    return new Blob([bytes as BlobPart], { type });
  }
  if (format === "plain" && encoding !== "utf-8") {
    return new Blob([encodeText(text, encoding) as BlobPart], {
      type: `text/plain;charset=${encoding}`,
    });
  }
  return new Blob([text], {
    type: format === "rich" && isHtmlName(name) ? "text/html;charset=utf-8" : typeOf(format),
  });
}

/**
 * Reads the drive file `entry` as a document. `version` is the file's version the document was read
 * from. This is no opening by the person, as when a window comes back with its draft: Recents is left
 * alone.
 */
export async function readDriveDocument(
  entry: Pick<DriveEntry, "id" | "name"> & { encoding?: string },
  target: Document,
  signal?: AbortSignal,
): Promise<OpenedDocument & { version: number }> {
  if (isBundleName(entry.name)) {
    const { text, version } = await readBundle(entry.id, signal);
    return { document: documentFromText(entry.name, text, target), text, version };
  }
  const read = await readFileEntry(entry.id, { signal });
  const bytes = new Uint8Array(await read.blob.arrayBuffer());
  const opened = await documentOfFileBytes(entry, bytes, target);
  return { ...opened, version: read.entry.version ?? 0 };
}

/** The document the bytes of a file named `entry.name` are, in `entry.encoding` when it has one. */
export async function documentOfFileBytes(
  entry: Pick<DriveEntry, "name"> & { encoding?: string },
  bytes: Uint8Array,
  target: Document,
): Promise<OpenedDocument> {
  if (PACKED_EXTENSIONS.includes(extensionOf(entry.name))) {
    const text = await htmlOfPacked(entry.name, bytes);
    return { document: documentFromText(entry.name, text, target), text };
  }
  return documentFromBytes(entry.name, bytes, target, entry.encoding);
}

/** Reads the drive file `entry` as a document the person opened, and marks it opened for Recents. */
export async function openDriveDocument(
  entry: Pick<DriveEntry, "id" | "name"> & { encoding?: string },
  target: Document,
  signal?: AbortSignal,
): Promise<OpenedDocument & { version: number }> {
  const opened = await readDriveDocument(entry, target, signal);
  markOpened(entry.id);
  return opened;
}

/**
 * The file `id` as the drive has it now, if it is a file: from the page's copy, or read again
 * when the copy does not have it (another window or browser made it).
 */
export async function currentFile(id: string): Promise<DriveEntry | undefined> {
  let entry = entryOf(await ensureDrive(), id);
  if (!entry) entry = entryOf(await loadDrive(), id);
  return entry?.kind === "file" || (entry && isBundleName(entry.name)) ? entry : undefined;
}

/**
 * Writes `text` into the drive file `file` in place: the same file, its new bytes, made from the
 * file's `version` when the reference has one. Rejects with the drive's `DriveError`: 412 when the
 * file was saved over elsewhere since that version (`STALE_FILE`), 409/404 when it is gone, in the
 * Trash or no longer a file, 507 when the drive is full. A reference without a version writes over
 * whatever the file holds (Save Anyway). Resolves with the file as the drive now has it.
 */
export function writeDriveDocument(
  file: DriveFileRef,
  folder: string,
  text: string,
  format: TextEditDocument["format"],
): Promise<DriveEntry> {
  if (isBundleName(file.name)) return writeBundle(file.id, text, file.version);
  return uploadFile(fileBlob(text, file.name, format, file.encoding), folder, {
    name: file.name,
    existing: "overwrite",
    replaces: file.id,
    ...(file.version !== undefined ? { base: file.version } : undefined),
  });
}

/** The status a save in place answers when the file was saved over elsewhere since it was read. */
export const STALE_FILE = 412;

/** `text` as a new file of the drive, as the Save dialog's `saveToDrive` takes it. */
export const documentBlob = (
  text: string,
  format: TextEditDocument["format"],
  name = "",
  encoding?: string,
) => fileBlob(text, name, format, encoding);

const LAST_SAVED = "textedit.lastSaved";

/**
 * Keeps the text the file `id` holds now as its last saved version, for File > Revert To > Last
 * Saved: autosave writes into the file between saves, and each page keeps this one to go back to at
 * once. `version` is the file's version that text is, which Previous Save goes back from. False
 * when the text is too long to keep; any earlier version of the file is then forgotten.
 */
export function keepLastSaved(id: string, text: string, version?: number): boolean {
  if (keepText(LAST_SAVED, JSON.stringify({ id, text, version }))) return true;
  forgetKeptText(LAST_SAVED);
  return false;
}

const lastSavedOf = (stored: string | undefined, id: string): string | undefined => {
  if (stored === undefined) return undefined;
  try {
    const kept = JSON.parse(stored) as { id?: unknown; text?: unknown };
    return kept.id === id && typeof kept.text === "string" ? kept.text : undefined;
  } catch {
    return undefined;
  }
};

/** The last saved version of the file `id`, when one is kept. */
export const readLastSaved = (id: string) => lastSavedOf(readKeptText(LAST_SAVED), id);

/** The file's version the last saved text of the file `id` is, when that is known. */
export function readLastSavedVersion(id: string): number | undefined {
  try {
    const kept = JSON.parse(readKeptText(LAST_SAVED) ?? "null") as {
      id?: unknown;
      version?: unknown;
    } | null;
    return kept?.id === id && typeof kept.version === "number" ? kept.version : undefined;
  } catch {
    return undefined;
  }
}

/** Whether a last saved version of the file `id` is kept, following every change. */
export function useHasLastSaved(id: string | undefined): boolean {
  const stored = useKeptTextValue(LAST_SAVED);
  return id !== undefined && lastSavedOf(stored, id) !== undefined;
}

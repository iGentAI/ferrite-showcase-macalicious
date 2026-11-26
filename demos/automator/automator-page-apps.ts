import {
  type Drive,
  type DriveEntry,
  entryOf,
  loadDrive,
  readFile,
  runOps,
  uploadFile,
} from "../desktop/desktop-files";
import { sessionFetch, withDeadline } from "../desktop/desktop-server";
import { readFinderSelection } from "../finder/finder-selection";
import { fontFamily } from "../font-book/font-book-data";
import { familyNameOf, keepFont, keptFonts } from "../font-book/font-book-drive";
import { syncFontPanelFonts } from "../font-book/font-book-panel-fonts";
import { FONT_BOOK_LIBRARY_URL } from "../font-book/font-book-server";
import { isFontFile } from "../font-book/font-book-tables";
import { validateFontFile, validationVerdict } from "../font-book/font-book-validate";
import { uploadAttachment } from "../mail/mail-attachments";
import { readMailSelection } from "../mail/mail-selection";
import { songOfDriveFile } from "../music/music-drive";
import { MUSIC_LIBRARY_URL, uploadArtwork } from "../music/music-server";
import { changeAlbum, createAlbum, importPicture, loadLibrary } from "../photos/photos-library";
import { readPhotosSelection } from "../photos/photos-selection";
import { annotatedMovie, type MovieNotes, NotAMovie } from "./automator-movie";
import {
  entriesOf,
  entryAtPath,
  fileItemOf,
  folderAt,
  PageFailure,
  type PageHost,
  stringOf,
} from "./automator-page";
import {
  addPixelImage,
  addResource,
  compressibleImages,
  decodedStream,
  drawOnPage,
  gridContent,
  isJpeg,
  isStream,
  isTone,
  lockPdf,
  type PdfDocument,
  PdfLocked,
  type PdfStream,
  PdfUnreadable,
  pagesOfPdf,
  placedImage,
  readPdf,
  setJpeg,
  shownSize,
  toneOnPage,
  writePdf,
} from "./automator-pdf";
import { type FileItem, itemText, type ParamDraft, type RunItem } from "./automator-server";

/*
 * The page actions that reach another app: each goes through that app's own routes, as its window
 * does, so every rule of that app applies. Loaded only when a workflow runs one of them, so the
 * window that never does carries none of Mail's, Photos', Music's or pdf.js's code.
 */

const MAIL = "/api/mail";
const SAFARI = "/api/safari";

type Fields = Record<string, unknown>;
const fieldsOf = (value: unknown): Fields =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Fields) : {};
const textOf = (value: unknown) => (typeof value === "string" ? value : "");

/** One request to an app's route: its status and parsed reply. */
async function call(url: string, method = "GET", body?: unknown, key?: string) {
  try {
    return await withDeadline(async (signal) => {
      const response = await sessionFetch(url, {
        method,
        credentials: "same-origin",
        headers: {
          accept: "application/json",
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...(key ? { "idempotency-key": key } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal,
      });
      const reply: unknown = await response.json().catch(() => null);
      return { status: response.status, reply: fieldsOf(reply) };
    });
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    throw new PageFailure(`The desktop's server could not be reached (${why}).`);
  }
}

const refusal = (reply: Fields, status: number) =>
  textOf(reply.error) || `The server answered ${status}.`;

const stemOf = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
};

const isFileItem = (item: RunItem): item is FileItem => typeof item !== "string";

function filesOf(drive: Drive, items: readonly RunItem[]): DriveEntry[] {
  return entriesOf(drive, items).map((entry) => {
    if (entry.kind !== "file") throw new PageFailure(`“${entry.name}” is not a file.`);
    return entry;
  });
}

function filesOrFail(drive: Drive, items: readonly RunItem[], what: string): DriveEntry[] {
  if (items.length === 0) throw new PageFailure(`It was given no ${what}.`);
  return filesOf(drive, items);
}

async function saved(
  blob: Blob,
  parent: string,
  name: string,
  session: PageHost["session"],
): Promise<FileItem> {
  const entry = await uploadFile(blob, parent, { name, existing: "rename", session });
  return fileItemOf(await loadDrive(), entry);
}

/* ---------------------------------------------------------------------------------- Mail */

/** A message a New Mail Message of this run made, kept in Mail's Drafts until it is sent. */
interface OutgoingMessage {
  id?: string;
  to: string[];
  cc: string[];
  subject: string;
  text: string;
  attachments: string[];
  key: string;
}

const OUTGOING = new WeakMap<PageHost["running"], OutgoingMessage[]>();

function outgoingOf(host: PageHost): OutgoingMessage[] {
  let list = OUTGOING.get(host.running);
  if (!list) {
    list = [];
    OUTGOING.set(host.running, list);
  }
  return list;
}

/** The names in a To or Cc setting. */
export const addressesOf = (text: string) =>
  text
    .split(/[,;\n]/)
    .map((name) => name.trim())
    .filter(Boolean);

async function storeDraft(message: OutgoingMessage) {
  const { id, to, cc, subject, text, attachments } = message;
  const { status, reply } = await call(
    `${MAIL}/drafts`,
    "POST",
    { ...(id ? { id } : {}), to, cc, subject, text, attachments },
    crypto.randomUUID(),
  );
  if (status !== 200) throw new PageFailure(refusal(reply, status));
  const stored = textOf(fieldsOf(reply.message).id);
  if (!stored) throw new PageFailure("Mail did not say which draft it kept.");
  message.id = stored;
}

async function attachmentsOf(items: readonly RunItem[]) {
  const files = items.filter(isFileItem);
  if (files.length === 0) return [];
  const entries = filesOf(await loadDrive(), files);
  const ids: string[] = [];
  for (const entry of entries) {
    const sent = await uploadAttachment(MAIL, await readFile(entry.id), entry.name);
    ids.push(sent.id);
  }
  return ids;
}

const subjectShown = (message: { subject: string }) => message.subject || "(No Subject)";

async function newMailMessage(
  value: (key: string) => string,
  params: Readonly<Record<string, ParamDraft>>,
  items: readonly RunItem[],
  host: PageHost,
) {
  const given = items.filter((item) => !isFileItem(item)).map(itemText);
  const message: OutgoingMessage = {
    to: addressesOf(value("to")),
    cc: addressesOf(value("cc")),
    subject: value("subject"),
    text: typeof params.message === "string" ? params.message : given.join("\n"),
    attachments: await attachmentsOf(items),
    key: crypto.randomUUID(),
  };
  await storeDraft(message);
  outgoingOf(host).push(message);
  return [subjectShown(message)];
}

async function addAttachments(items: readonly RunItem[], host: PageHost) {
  const front = outgoingOf(host).at(-1);
  if (!front) throw new PageFailure("No New Mail Message before it made a message in this run.");
  const files = items.filter(isFileItem);
  if (files.length === 0) throw new PageFailure("It was given no files.");
  const ids = await attachmentsOf(files);
  front.attachments = [...front.attachments, ...ids];
  await storeDraft(front);
  return [...items];
}

function whyNotSent(reply: Fields, status: number) {
  const names = (field: string) =>
    Array.isArray(reply[field]) ? (reply[field] as unknown[]).map(String).join(", ") : "";
  if (names("unknown")) return `Mail has no account for ${names("unknown")}.`;
  if (names("outside")) return `This desktop sends no mail outside it: ${names("outside")}.`;
  return refusal(reply, status);
}

async function sendOutgoing(host: PageHost) {
  const list = outgoingOf(host);
  if (list.length === 0) {
    throw new PageFailure("No New Mail Message before it made a message in this run.");
  }
  const sent: string[] = [];
  for (const message of [...list]) {
    const { to, cc, subject, text, attachments, id, key } = message;
    const { status, reply } = await call(
      `${MAIL}/send`,
      "POST",
      { to, cc, subject, text, attachments, ...(id ? { draft: id } : {}) },
      key,
    );
    if (status !== 201 && status !== 200) throw new PageFailure(whyNotSent(reply, status));
    list.splice(list.indexOf(message), 1);
    sent.push(subjectShown(message));
  }
  return sent;
}

const MOST_FOUND = 200;

/** How a message shows as an item: its subject, and who it is from. */
export function mailItemText(header: Fields): string {
  const from = fieldsOf(header.from);
  const who = textOf(from.full_name) || textOf(from.name);
  const subject = textOf(header.subject) || "(No Subject)";
  return who ? `${subject}, from ${who}` : subject;
}

/** The messages selected in Mail, as Find Mail Items gives them. */
export function selectedMail(): string[] {
  const chosen = readMailSelection();
  if (chosen.length === 0) throw new PageFailure("Nothing is selected in Mail.");
  return chosen.map(({ subject, from }) => {
    const title = subject || "(No Subject)";
    return from ? `${title}, from ${from}` : title;
  });
}

const mailboxOf = (header: Fields) => {
  const box = header.mailbox;
  return typeof box === "string" ? box.toLowerCase() : textOf(fieldsOf(box).own).toLowerCase();
};

async function findMail(contains: string, mailbox: string) {
  const needle = contains.toLowerCase();
  const wanted = mailbox === "Any Mailbox" || mailbox === "" ? "" : mailbox.toLowerCase();
  const found: string[] = [];
  let after = "";
  do {
    const { status, reply } = await call(
      `${MAIL}/messages${after ? `?after=${encodeURIComponent(after)}` : ""}`,
    );
    if (status !== 200) throw new PageFailure(refusal(reply, status));
    for (const entry of Array.isArray(reply.messages) ? reply.messages : []) {
      const header = fieldsOf(entry);
      if (wanted && mailboxOf(header) !== wanted) continue;
      if (needle && !JSON.stringify(header).toLowerCase().includes(needle)) continue;
      found.push(mailItemText(header));
      if (found.length >= MOST_FOUND) return found;
    }
    after = textOf(reply.next);
  } while (after);
  return found;
}

/* -------------------------------------------------------------------------------- Photos */

async function addToAlbumByName(name: string, photos: string[]) {
  const { albums } = await loadLibrary();
  const album = albums.find((each) => each.name === name);
  if (!album) throw new PageFailure(`Photos has no album “${name}”.`);
  await changeAlbum(album.id, { add: photos });
}

async function importIntoPhotos(items: readonly RunItem[], album: string) {
  const entries = filesOrFail(await loadDrive(), items, "files");
  const photos = [];
  for (const entry of entries) {
    photos.push(await importPicture(await readFile(entry.id), { name: stemOf(entry.name) }));
  }
  if (album)
    await addToAlbumByName(
      album,
      photos.map((photo) => photo.id),
    );
  const after = await loadDrive();
  return photos.flatMap((photo) => {
    const entry = entryOf(after, photo.file);
    return entry ? [fileItemOf(after, entry)] : [];
  });
}

/** The drive files of the photos selected in Photos, which the album actions take as they are. */
export async function selectedPhotos(): Promise<FileItem[]> {
  const files = readPhotosSelection();
  if (files.length === 0) throw new PageFailure("Nothing is selected in Photos.");
  const drive = await loadDrive();
  return files.flatMap((file) => {
    const entry = entryOf(drive, file);
    return entry ? [fileItemOf(drive, entry)] : [];
  });
}

/** The drive items selected in Finder, as they are on the drive now. */
export async function selectedFinderItems(): Promise<FileItem[]> {
  const ids = readFinderSelection();
  if (ids.length === 0) throw new PageFailure("Nothing is selected in Finder.");
  const drive = await loadDrive();
  return ids.flatMap((id) => {
    const entry = entryOf(drive, id);
    return entry ? [fileItemOf(drive, entry)] : [];
  });
}

/** The library's photos for these drive files; a file it does not hold fails the step. */
async function photoIdsOf(items: readonly RunItem[]) {
  const drive = await loadDrive();
  const { photos } = await loadLibrary();
  return filesOf(drive, items).map((entry) => {
    const photo = photos.find((each) => each.file === entry.id);
    if (!photo) {
      throw new PageFailure(`“${entry.name}” is not in Photos: Import Files into Photos first.`);
    }
    return photo.id;
  });
}

/* --------------------------------------------------------------------------------- Music */

const SAVE_ATTEMPTS = 3;

async function addToPlaylist(items: readonly RunItem[], name: string) {
  if (name === "") throw new PageFailure("It needs the playlist's name.");
  const entries = filesOrFail(await loadDrive(), items, "songs");
  const songs = new Map<string, Fields>();
  for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt += 1) {
    const { status, reply } = await call(MUSIC_LIBRARY_URL);
    if (status !== 200) throw new PageFailure(refusal(reply, status));
    const library = fieldsOf(reply.library);
    const stored = (Array.isArray(library.songs) ? library.songs : []) as Fields[];
    const lists = (Array.isArray(library.playlists) ? library.playlists : []) as Fields[];
    const ids: string[] = [];
    const added: Fields[] = [];
    for (const entry of entries) {
      const known = stored.find((song) => fieldsOf(song.source).file === entry.id);
      if (known) {
        ids.push(textOf(known.id));
        continue;
      }
      let song = songs.get(entry.id);
      if (!song) {
        const made = await songOfDriveFile(entry, crypto.randomUUID());
        const artwork = made.cover ? await uploadArtwork(made.cover) : null;
        song = { ...made.song, artwork };
        songs.set(entry.id, song);
      }
      if (!added.includes(song)) added.push(song);
      ids.push(textOf(song.id));
    }
    const list = lists.find((each) => each.name === name);
    const before = (list?.songs ?? []) as string[];
    const changed = {
      id: crypto.randomUUID(),
      ...list,
      name,
      songs: [...new Set([...before, ...ids])],
    };
    const put = await call(MUSIC_LIBRARY_URL, "PUT", {
      library: {
        ...library,
        songs: [...stored, ...added],
        playlists: list
          ? lists.map((each) => (each === list ? changed : each))
          : [...lists, changed],
        loved: library.loved ?? [],
      },
      rev: reply.rev,
      ...(reply.session ? { session: reply.session } : {}),
    });
    if (put.status === 200) return [...items];
    if (put.status !== 409) throw new PageFailure(refusal(put.reply, put.status));
  }
  throw new PageFailure("Music's library kept changing; run the workflow again.");
}

/* -------------------------------------------------------------------------------- Images */

const IMAGE_TYPES = {
  JPEG: { mime: "image/jpeg", extension: ".jpg" },
  PNG: { mime: "image/png", extension: ".png" },
  BMP: { mime: "image/bmp", extension: ".bmp" },
  TIFF: { mime: "image/tiff", extension: ".tiff" },
} as const;

/** The name of an image's copy of another type. */
export const convertedName = (name: string, type: keyof typeof IMAGE_TYPES) =>
  `${stemOf(name)}${IMAGE_TYPES[type].extension}`;

/** RGBA pixels as an uncompressed 24-bit BMP, which a canvas cannot write. */
export function encodeBmp(pixels: Uint8ClampedArray, width: number, height: number): Blob {
  const row = Math.ceil((width * 3) / 4) * 4;
  const bytes = new Uint8Array(54 + row * height);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, 0x4d42, true);
  view.setUint32(2, bytes.length, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(34, row * height, true);
  for (let y = 0; y < height; y += 1) {
    const out = 54 + (height - 1 - y) * row;
    for (let x = 0; x < width; x += 1) {
      const from = (y * width + x) * 4;
      bytes[out + x * 3] = pixels[from + 2] as number;
      bytes[out + x * 3 + 1] = pixels[from + 1] as number;
      bytes[out + x * 3 + 2] = pixels[from] as number;
    }
  }
  return new Blob([bytes], { type: IMAGE_TYPES.BMP.mime });
}

/** RGBA pixels as a baseline uncompressed RGB TIFF, which a canvas cannot write. */
export function encodeTiff(pixels: Uint8ClampedArray, width: number, height: number): Blob {
  const entries = 10;
  const ifd = 8;
  const bits = ifd + 2 + entries * 12 + 4;
  const data = bits + 6;
  const length = width * height * 3;
  const bytes = new Uint8Array(data + length);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, 0x4949, true);
  view.setUint16(2, 42, true);
  view.setUint32(4, ifd, true);
  view.setUint16(ifd, entries, true);
  const SHORT = 3;
  const LONG = 4;
  const tags: readonly (readonly [number, number, number, number])[] = [
    [256, LONG, 1, width],
    [257, LONG, 1, height],
    [258, SHORT, 3, bits],
    [259, SHORT, 1, 1],
    [262, SHORT, 1, 2],
    [273, LONG, 1, data],
    [277, SHORT, 1, 3],
    [278, LONG, 1, height],
    [279, LONG, 1, length],
    [284, SHORT, 1, 1],
  ];
  tags.forEach(([tag, type, count, value], at) => {
    const entry = ifd + 2 + at * 12;
    view.setUint16(entry, tag, true);
    view.setUint16(entry + 2, type, true);
    view.setUint32(entry + 4, count, true);
    // A SHORT that fits is held in the entry's first two bytes; the three samples' sizes are not.
    if (type === SHORT && count === 1) view.setUint16(entry + 8, value, true);
    else view.setUint32(entry + 8, value, true);
  });
  for (let at = 0; at < 3; at += 1) view.setUint16(bits + at * 2, 8, true);
  for (let at = 0; at < width * height; at += 1) {
    bytes[data + at * 3] = pixels[at * 4] as number;
    bytes[data + at * 3 + 1] = pixels[at * 4 + 1] as number;
    bytes[data + at * 3 + 2] = pixels[at * 4 + 2] as number;
  }
  return new Blob([bytes], { type: IMAGE_TYPES.TIFF.mime });
}

function canvasBlob(canvas: HTMLCanvasElement, mime: string, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new PageFailure("The browser drew no image."))),
      mime,
      quality,
    ),
  );
}

function canvasOf(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new PageFailure("The browser gave no canvas to draw on.");
  return { canvas, context };
}

async function changeImageType(
  items: readonly RunItem[],
  type: string,
  trash: boolean,
  session: PageHost["session"],
) {
  const to = type === "JPEG" || type === "BMP" || type === "TIFF" ? type : "PNG";
  const drive = await loadDrive();
  const entries = filesOrFail(drive, items, "images");
  const made: FileItem[] = [];
  for (const entry of entries) {
    // Already that type: with the original to replace, there is nothing to change.
    if (trash && convertedName(entry.name, to) === entry.name) {
      made.push(fileItemOf(drive, entry));
      continue;
    }
    const picture = await createImageBitmap(await readFile(entry.id)).catch(() => {
      throw new PageFailure(`“${entry.name}” could not be read as an image.`);
    });
    const { canvas, context } = canvasOf(picture.width, picture.height);
    // These types hold no transparency.
    if (to !== "PNG") {
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(picture, 0, 0);
    picture.close();
    const { width, height } = canvas;
    const blob =
      to === "BMP"
        ? encodeBmp(context.getImageData(0, 0, width, height).data, width, height)
        : to === "TIFF"
          ? encodeTiff(context.getImageData(0, 0, width, height).data, width, height)
          : await canvasBlob(canvas, IMAGE_TYPES[to].mime);
    made.push(await saved(blob, entry.parent ?? "", convertedName(entry.name, to), session));
    if (trash) await runOps([{ op: "trash", id: entry.id }], undefined, session);
  }
  return made;
}

const BANNER_FONT = "system-ui, -apple-system, sans-serif";

async function createBanner(
  text: string,
  size: number,
  colour: string,
  background: string,
  parent: string,
  name: string,
  session: PageHost["session"],
) {
  if (text.trim() === "") throw new PageFailure("It was given no text.");
  const points = Number.isFinite(size) && size > 0 ? Math.min(size, 400) : 72;
  const lines = text.split("\n");
  const margin = Math.ceil(points / 2);
  const leading = Math.ceil(points * 1.25);
  const font = `${points}px ${BANNER_FONT}`;
  const measured = canvasOf(1, 1).context;
  measured.font = font;
  const width = Math.max(...lines.map((line) => measured.measureText(line).width));
  const { canvas, context } = canvasOf(
    Math.min(Math.ceil(width) + margin * 2, 8192),
    lines.length * leading + margin * 2,
  );
  if (background !== "Transparent") {
    context.fillStyle = background.toLowerCase();
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.font = font;
  context.textBaseline = "top";
  context.fillStyle = colour.toLowerCase();
  lines.forEach((line, at) => {
    context.fillText(line, margin, margin + at * leading);
  });
  const blob = await canvasBlob(canvas, "image/png");
  return saved(blob, parent, name.toLowerCase().endsWith(".png") ? name : `${name}.png`, session);
}

/* -------------------------------------------------------------------------------- Movies */

async function annotateMovies(
  items: readonly RunItem[],
  where: string,
  notes: MovieNotes,
  session: PageHost["session"],
) {
  if (Object.values(notes).every((note) => note.trim() === "")) {
    throw new PageFailure("It was given no annotation to write.");
  }
  const drive = await loadDrive();
  const parent = folderAt(drive, where || "Desktop").id;
  const made: FileItem[] = [];
  for (const entry of filesOrFail(drive, items, "movies")) {
    const movie = await annotatedMovie(await readFile(entry.id), notes).catch((error) => {
      if (error instanceof NotAMovie) {
        throw new PageFailure(`“${entry.name}” cannot hold annotations: ${error.message}`);
      }
      throw error;
    });
    const type = entry.name.slice(stemOf(entry.name).length);
    made.push(await saved(movie, parent, `${stemOf(entry.name)} (annotated)${type}`, session));
  }
  return made;
}

/* ---------------------------------------------------------------------------------- PDFs */

async function opened(entry: DriveEntry) {
  const { openPdf } = await import("../preview/preview-pdf");
  try {
    return await openPdf(await readFile(entry.id));
  } catch {
    throw new PageFailure(`“${entry.name}” could not be read as a PDF, or it is locked.`);
  }
}

const pdfBlob = (bytes: Uint8Array) =>
  new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" });

const pagesOf = (count: number) => Array.from({ length: count }, (_, at) => at + 1);

async function extractPdfText(
  items: readonly RunItem[],
  where: string,
  session: PageHost["session"],
) {
  const drive = await loadDrive();
  const parent = folderAt(drive, where || "Desktop").id;
  const made: FileItem[] = [];
  for (const entry of filesOrFail(drive, items, "PDF documents")) {
    const pdf = await opened(entry);
    try {
      const pages: string[] = [];
      for (const page of pagesOf(pdf.pageCount)) pages.push(await pdf.text(page));
      const text = new Blob([pages.join("\n\n")], { type: "text/plain" });
      made.push(await saved(text, parent, `${stemOf(entry.name)}.txt`, session));
    } finally {
      pdf.destroy();
    }
  }
  return made;
}

async function combinePdfs(
  items: readonly RunItem[],
  where: string,
  name: string,
  session: PageHost["session"],
) {
  const drive = await loadDrive();
  const parent = folderAt(drive, where || "Desktop").id;
  const entries = filesOrFail(drive, items, "PDF documents");
  const pdfs = await Promise.all(entries.map(opened));
  try {
    let at = 0;
    const parts = [];
    for (const [index, pdf] of pdfs.entries()) {
      const pages = pagesOf(pdf.pageCount);
      const places = pages.map((page) => at + page - 1);
      at += pages.length;
      const file = entries[index] as DriveEntry;
      const document =
        index === 0 ? null : new Uint8Array(await (await readFile(file.id)).arrayBuffer());
      parts.push({ document, pages, at: places });
    }
    const bytes = await (pdfs[0] as (typeof pdfs)[number]).combined(parts);
    return [
      await saved(pdfBlob(bytes), parent, name.endsWith(".pdf") ? name : `${name}.pdf`, session),
    ];
  } finally {
    for (const pdf of pdfs) pdf.destroy();
  }
}

async function splitPdfs(items: readonly RunItem[], where: string, session: PageHost["session"]) {
  const drive = await loadDrive();
  const parent = folderAt(drive, where || "Desktop").id;
  const made: FileItem[] = [];
  for (const entry of filesOrFail(drive, items, "PDF documents")) {
    const pdf = await opened(entry);
    try {
      for (const page of pagesOf(pdf.pageCount)) {
        const bytes = await pdf.combined([{ document: null, pages: [page], at: [0] }]);
        made.push(
          await saved(pdfBlob(bytes), parent, `${stemOf(entry.name)} ${page}.pdf`, session),
        );
      }
    } finally {
      pdf.destroy();
    }
  }
  return made;
}

/* ------------------------------------------------------------------------ Drawing on PDFs */

const GRID_COLOURS: Record<string, readonly [number, number, number]> = {
  Gray: [0.6, 0.6, 0.6],
  Black: [0, 0, 0],
  Red: [0.85, 0.1, 0.1],
  Blue: [0.1, 0.3, 0.85],
};

const JPEG_QUALITIES: Record<string, number> = { Low: 0.35, Medium: 0.6, High: 0.8 };

async function objectsOf(entry: DriveEntry): Promise<PdfDocument> {
  try {
    return await readPdf(new Uint8Array(await (await readFile(entry.id)).arrayBuffer()));
  } catch (error) {
    if (error instanceof PdfLocked) {
      throw new PageFailure(`“${entry.name}” is locked, so this action cannot change it.`);
    }
    if (error instanceof PdfUnreadable) {
      throw new PageFailure(`“${entry.name}” could not be read as a PDF: ${error.message}`);
    }
    throw error;
  }
}

/** A changed copy of each PDF of the input, named `<name> (<mark>).pdf`. */
async function changedPdfs(
  items: readonly RunItem[],
  where: string,
  mark: string,
  session: PageHost["session"],
  change: (document: PdfDocument, entry: DriveEntry) => Promise<Uint8Array>,
) {
  const drive = await loadDrive();
  const parent = folderAt(drive, where || "Desktop").id;
  const made: FileItem[] = [];
  for (const entry of filesOrFail(drive, items, "PDF documents")) {
    const document = await objectsOf(entry);
    let bytes: Uint8Array;
    try {
      bytes = await change(document, entry);
    } catch (error) {
      if (error instanceof PdfUnreadable) {
        throw new PageFailure(`“${entry.name}” could not be read as a PDF: ${error.message}`);
      }
      throw error;
    }
    made.push(await saved(pdfBlob(bytes), parent, `${stemOf(entry.name)} (${mark}).pdf`, session));
  }
  return made;
}

function addGrid(
  items: readonly RunItem[],
  where: string,
  spacing: number,
  colour: string,
  session: PageHost["session"],
) {
  const step = Number.isFinite(spacing) && spacing > 0 ? Math.max(spacing, 4) : 36;
  return changedPdfs(items, where, "grid", session, async (document) => {
    for (const page of pagesOfPdf(document)) {
      const [width, height] = shownSize(page);
      const lines = gridContent(width, height, step, GRID_COLOURS[colour] ?? [0.6, 0.6, 0.6]);
      drawOnPage(document, page, lines);
    }
    return writePdf(document);
  });
}

const percent = (text: string, fallback: number) => {
  const value = Number(text);
  return text !== "" && Number.isFinite(value) ? Math.max(value, 0) / 100 : fallback;
};

async function watermark(
  items: readonly RunItem[],
  value: (key: string) => string,
  under: boolean,
  session: PageHost["session"],
) {
  const path = value("picture").trim();
  if (path === "") throw new PageFailure("It needs the picture's path on your drive.");
  const entry = entryAtPath(await loadDrive(), path);
  if (entry?.kind !== "file") throw new PageFailure(`Your drive has no file “${path}”.`);
  const { id: pictureFile, name: pictureName } = entry;
  const picture = await createImageBitmap(await readFile(pictureFile)).catch(() => {
    throw new PageFailure(`“${pictureName}” could not be read as an image.`);
  });
  const { canvas, context } = canvasOf(picture.width, picture.height);
  context.drawImage(picture, 0, 0);
  picture.close();
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const scale = percent(value("scale"), 1);
  const opacity = Math.min(percent(value("opacity"), 0.5), 1);
  const angle = Number(value("angle")) || 0;
  const [drawnWidth, drawnHeight] = [canvas.width * scale, canvas.height * scale];
  const radians = (angle * Math.PI) / 180;
  return changedPdfs(items, value("where"), "watermark", session, async (document) => {
    const image = await addPixelImage(document, pixels, canvas.width, canvas.height);
    for (const page of pagesOfPdf(document)) {
      const [width, height] = shownSize(page);
      const centreX =
        (width - (Math.cos(radians) * drawnWidth - Math.sin(radians) * drawnHeight)) / 2;
      const centreY =
        (height - (Math.sin(radians) * drawnWidth + Math.cos(radians) * drawnHeight)) / 2;
      const x = value("x") === "" ? centreX : Number(value("x")) || 0;
      const y = value("y") === "" ? centreY : Number(value("y")) || 0;
      const name = addResource(document, page, "XObject", image);
      const state = addResource(
        document,
        page,
        "ExtGState",
        new Map([
          ["ca", opacity],
          ["CA", opacity],
        ]),
      );
      drawOnPage(
        document,
        page,
        placedImage(name, drawnWidth, drawnHeight, x, y, angle, state),
        under,
      );
    }
    return writePdf(document);
  });
}

/** A PDF image's pixels on a canvas; `null` when they are not what its dictionary says. */
async function imageCanvas(stream: PdfStream) {
  const [width, height] = [Number(stream.dict.get("Width")), Number(stream.dict.get("Height"))];
  if (isJpeg(stream)) {
    const blob = new Blob([stream.bytes as Uint8Array<ArrayBuffer>], { type: "image/jpeg" });
    const picture = await createImageBitmap(blob).catch(() => null);
    if (!picture) return null;
    const { canvas, context } = canvasOf(picture.width, picture.height);
    context.drawImage(picture, 0, 0);
    picture.close();
    return canvas;
  }
  const data = await decodedStream(stream);
  const colours =
    (stream.dict.get("ColorSpace") as { name?: string })?.name === "DeviceGray" ? 1 : 3;
  if (!data || !(width > 0) || !(height > 0) || data.length < width * height * colours) return null;
  const { canvas, context } = canvasOf(width, height);
  const pixels = context.createImageData(width, height);
  for (let at = 0; at < width * height; at += 1) {
    pixels.data[at * 4] = data[at * colours] as number;
    pixels.data[at * 4 + 1] = data[at * colours + (colours === 3 ? 1 : 0)] as number;
    pixels.data[at * 4 + 2] = data[at * colours + (colours === 3 ? 2 : 0)] as number;
    pixels.data[at * 4 + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

async function withSmallerImages(document: PdfDocument, quality: string) {
  for (const number of compressibleImages(document)) {
    const stream = document.objects.get(number);
    if (!isStream(stream)) continue;
    const canvas = await imageCanvas(stream);
    if (!canvas) continue;
    const blob = await canvasBlob(canvas, "image/jpeg", JPEG_QUALITIES[quality] ?? 0.6);
    if (blob.size < stream.bytes.length) {
      setJpeg(stream, new Uint8Array(await blob.arrayBuffer()));
    }
  }
  return writePdf(document);
}

function compressImages(
  items: readonly RunItem[],
  where: string,
  quality: string,
  session: PageHost["session"],
) {
  return changedPdfs(items, where, "compressed", session, (document) =>
    withSmallerImages(document, quality),
  );
}

function applyQuartzFilter(
  items: readonly RunItem[],
  where: string,
  filter: string,
  session: PageHost["session"],
) {
  if (filter !== "Reduce File Size" && !isTone(filter)) {
    throw new PageFailure(`This action has no filter “${filter}”: choose one in the action.`);
  }
  return changedPdfs(items, where, filter.toLowerCase(), session, (document) => {
    if (filter === "Reduce File Size") return withSmallerImages(document, "Low");
    for (const page of pagesOfPdf(document)) toneOnPage(document, page, filter);
    return writePdf(document);
  });
}

async function encryptPdfs(items: readonly RunItem[], where: string, host: PageHost) {
  const ask = async (question: string) => {
    const answer = await host.ask({
      kind: "text",
      question,
      value: "",
      required: true,
      secret: true,
    });
    if (answer === null || answer === true || !("text" in answer)) {
      throw new PageFailure("You canceled it.");
    }
    return answer.text;
  };
  const password = await ask("A password for the PDF documents:");
  if ((await ask("The password again:")) !== password) {
    throw new PageFailure("The two passwords were not the same.");
  }
  return changedPdfs(items, where, "locked", host.session, (document) =>
    lockPdf(document, password),
  );
}

/* --------------------------------------------------------------------------------- Fonts */

async function addToFontLibrary(items: readonly RunItem[]) {
  const entries = filesOrFail(await loadDrive(), items, "fonts");
  const kept = await keptFonts();
  const ids: string[] = [];
  for (const entry of entries) {
    if (!isFontFile(entry.name)) throw new PageFailure(`“${entry.name}” is not a font file.`);
    if (kept.some((font) => font.id === entry.id)) {
      ids.push(entry.id);
      continue;
    }
    const blob = await readFile(entry.id);
    if (validationVerdict(await validateFontFile(blob)) === "failed") {
      throw new PageFailure(`“${entry.name}” does not pass Font Book's checks.`);
    }
    ids.push(await keepFont(new File([blob], entry.name, { type: blob.type })));
  }
  syncFontPanelFonts();
  const drive = await loadDrive();
  return ids.flatMap((id) => {
    const entry = entryOf(drive, id);
    return entry ? [fileItemOf(drive, entry)] : [];
  });
}

async function activateFonts(items: readonly RunItem[]) {
  const entries = filesOrFail(await loadDrive(), items, "fonts");
  const kept = await keptFonts();
  const on = entries.map((entry) => {
    if (!kept.some((font) => font.id === entry.id)) {
      throw new PageFailure(
        `Font Book does not hold “${entry.name}”: use Add to Font Library first.`,
      );
    }
    return fontFamily(familyNameOf(entry.name), "Regular", "sans").id;
  });
  for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt += 1) {
    const { status, reply } = await call(FONT_BOOK_LIBRARY_URL);
    if (status !== 200) throw new PageFailure(refusal(reply, status));
    const disabled = Array.isArray(reply.disabled) ? (reply.disabled as string[]) : [];
    if (!on.some((id) => disabled.includes(id))) return [...items];
    const put = await call(FONT_BOOK_LIBRARY_URL, "PUT", {
      collections: Array.isArray(reply.collections) ? reply.collections : [],
      disabled: disabled.filter((id) => !on.includes(id)),
      rev: reply.rev,
      ...(reply.session ? { session: reply.session } : {}),
    });
    if (put.status === 200) {
      syncFontPanelFonts();
      return [...items];
    }
    if (put.status !== 409) throw new PageFailure(refusal(put.reply, put.status));
  }
  throw new PageFailure("Font Book's library kept changing; run the workflow again.");
}

/* -------------------------------------------------------------------------------- Safari */

async function currentWebpage() {
  const { status, reply } = await call(`${SAFARI}/tabs`);
  if (status !== 200) throw new PageFailure(refusal(reply, status));
  const tabs = Array.isArray(reply.tabs) ? reply.tabs : [];
  const active = typeof reply.active === "number" ? reply.active : 0;
  const address = textOf(tabs[active]);
  if (!address) throw new PageFailure("Safari has no page open.");
  return [address];
}

/** A page's words: its Reader text, or else the text of its HTML. */
export function pageText(reply: Fields): string {
  if (Array.isArray(reply.reader) && reply.reader.length > 0) {
    return reply.reader.map((block) => textOf(fieldsOf(block).text)).join("\n");
  }
  const parsed = new DOMParser().parseFromString(textOf(reply.html), "text/html");
  for (const hidden of parsed.querySelectorAll("script, style, noscript")) hidden.remove();
  return (parsed.body?.textContent ?? "").replace(/\s+/g, " ").trim();
}

async function textOfPages(items: readonly RunItem[]) {
  if (items.length === 0) throw new PageFailure("It was given no address.");
  const texts: string[] = [];
  for (const item of items) {
    const address = itemText(item).trim();
    const { status, reply } = await call(
      `${SAFARI}/page?url=${encodeURIComponent(address)}&private=1`,
    );
    if (status !== 200) throw new PageFailure(refusal(reply, status));
    if (reply.ok !== true) {
      throw new PageFailure(textOf(reply.message) || `“${address}” did not open.`);
    }
    texts.push(pageText(reply));
  }
  return texts;
}

async function downloadUrls(
  items: readonly RunItem[],
  where: string,
  session: PageHost["session"],
) {
  if (items.length === 0) throw new PageFailure("It was given no address.");
  const parent = folderAt(await loadDrive(), where || "Downloads").id;
  const made: FileItem[] = [];
  for (const item of items) {
    const address = itemText(item).trim();
    const { status, reply } = await call(`${SAFARI}/file?url=${encodeURIComponent(address)}`);
    if (status !== 200) throw new PageFailure(refusal(reply, status));
    if (reply.ok !== true) {
      throw new PageFailure(textOf(reply.message) || `“${address}” did not download.`);
    }
    const bytes = Uint8Array.from(atob(textOf(reply.data)), (char) => char.charCodeAt(0));
    const blob = new Blob([bytes], { type: textOf(reply.type) });
    made.push(await saved(blob, parent, textOf(reply.name) || "download", session));
  }
  return made;
}

/* ------------------------------------------------------------------------------ dispatch */

/** Carry out one action that reaches another app; the items it hands on. Throws `PageFailure`. */
export async function runAppAction(
  name: string,
  params: Readonly<Record<string, ParamDraft>>,
  items: readonly RunItem[],
  host: PageHost,
): Promise<RunItem[]> {
  const value = (key: string) => stringOf(params[key]);
  const { session } = host;
  switch (name) {
    case "page.new-mail":
      return newMailMessage(value, params, items, host);
    case "page.add-attachments":
      return addAttachments(items, host);
    case "page.send-outgoing":
      return sendOutgoing(host);
    case "page.find-mail":
      return findMail(value("contains"), value("mailbox"));
    case "page.selected-mail":
      return selectedMail();
    case "page.selected-photos":
      return selectedPhotos();
    case "page.selected-finder":
      return selectedFinderItems();
    case "page.import-photos":
      return importIntoPhotos(items, value("album"));
    case "page.new-album": {
      if (value("name") === "") throw new PageFailure("It needs the album's name.");
      const photos = items.length > 0 ? await photoIdsOf(items) : [];
      const id = crypto.randomUUID();
      await createAlbum(value("name"), id);
      if (photos.length > 0) await changeAlbum(id, { add: photos });
      return [...items];
    }
    case "page.add-to-album":
      if (value("album") === "") throw new PageFailure("It needs the album's name.");
      if (items.length === 0) throw new PageFailure("It was given no photos.");
      await addToAlbumByName(value("album"), await photoIdsOf(items));
      return [...items];
    case "page.add-playlist":
      return addToPlaylist(items, value("playlist"));
    case "page.change-image-type":
      return changeImageType(
        items,
        value("to"),
        params["put the originals in the Trash"] === true,
        session,
      );
    case "page.apply-sql": {
      const { applySql } = await import("./automator-sql");
      return applySql(
        value("database"),
        {
          sql: typeof params.SQL === "string" ? params.SQL : "",
          input: items.map(itemText),
          asCsv: value("result as") === "Comma Separated",
        },
        session,
      );
    }
    case "page.banner": {
      const parent = folderAt(await loadDrive(), value("where") || "Desktop").id;
      const text =
        typeof params.text === "string" && params.text !== ""
          ? params.text
          : items.map(itemText).join("\n");
      return [
        await createBanner(
          text,
          Number(value("size")),
          value("colour") || "Black",
          value("background") || "White",
          parent,
          value("name") || "Banner",
          session,
        ),
      ];
    }
    case "page.extract-pdf-text":
      return extractPdfText(items, value("where"), session);
    case "page.combine-pdf":
      return combinePdfs(items, value("where"), value("name") || "Combined", session);
    case "page.split-pdf":
      return splitPdfs(items, value("where"), session);
    case "page.add-grid-pdf":
      return addGrid(items, value("where"), Number(value("spacing")), value("colour"), session);
    case "page.watermark-pdf":
      return watermark(items, value, params["draw under the page"] === true, session);
    case "page.quartz-filter-pdf":
      return applyQuartzFilter(items, value("where"), value("filter"), session);
    case "page.annotate-movie":
      return annotateMovies(
        items,
        value("where"),
        {
          title: value("title"),
          author: value("author"),
          description: value("description"),
          copyright: value("copyright"),
        },
        session,
      );
    case "page.compress-pdf":
      return compressImages(items, value("where"), value("quality"), session);
    case "page.encrypt-pdf":
      return encryptPdfs(items, value("where"), host);
    case "page.add-font-library":
      return addToFontLibrary(items);
    case "page.activate-fonts":
      return activateFonts(items);
    case "page.current-webpage":
      return currentWebpage();
    case "page.webpage-text":
      return textOfPages(items);
    case "page.download-urls":
      return downloadUrls(items, value("where"), session);
    default:
      throw new PageFailure("This desktop's Automator does not have this action any more.");
  }
}

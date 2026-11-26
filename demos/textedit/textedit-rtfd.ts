import {
  type DriveEntry,
  ensureDrive,
  ensureFolder,
  entryOf,
  loadDrive,
  readFile,
  readFileEntry,
  runOps,
  uploadFile,
} from "../desktop/desktop-files";
import type { DriveSaveTarget } from "../finder/finder-file-dialogs";
import { pictureHeader } from "./textedit-picture";
import { rtfTextOfBytes } from "./textedit-rtf";

/*
 * Rich Text With Graphics: a `.rtfd` is a folder of the drive holding `TXT.rtf` and its pictures, as
 * on a Mac. The window holds it as one RTF with the pictures in it, as `\pict`; only the drive sees
 * them apart. The document's file is the folder, so that a rename, a move, a tag or Locked acts on
 * the whole, and its version is that of `TXT.rtf`.
 */

const TEXT_FILE = "TXT.rtf";

/** Whether a drive item of this name is a Rich Text With Graphics document. */
export const isBundleName = (name: string) => /\.rtfd$/i.test(name);

const WRITTEN_PICTURE =
  /\{\\pict\\(png|jpeg)blip\\picw\d+\\pich\d+\\picwgoal(\d+)\\pichgoal(\d+)\s+([0-9a-f]+)\}/g;
const ATTACHMENT = /\{\{\\NeXTGraphic\s+(.+?)\s*\\width(\d+)\s*\\height(\d+)[^}]*\}[^{}]*\}/g;

const bytesOfHex = (hex: string) =>
  Uint8Array.from({ length: hex.length >> 1 }, (_, at) =>
    Number.parseInt(hex.slice(at * 2, at * 2 + 2), 16),
  );

/** A short mark of the bytes: a picture keeps its file's name across saves while it stays the same. */
function markOf(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  return hash.toString(16).padStart(8, "0");
}

export interface BundlePicture {
  name: string;
  bytes: Uint8Array;
}

/** The RTF a whole document is, as a bundle's `TXT.rtf` and the picture files it names. */
export function splitBundle(rtf: string): { text: string; pictures: BundlePicture[] } {
  const pictures = new Map<string, BundlePicture>();
  const text = rtf.replace(
    WRITTEN_PICTURE,
    (_, kind: string, width: string, height: string, hex: string) => {
      const bytes = bytesOfHex(hex);
      const name = `Pasted Graphic ${markOf(bytes)}.${kind === "png" ? "png" : "jpeg"}`;
      pictures.set(name, { name, bytes });
      return `{{\\NeXTGraphic ${name} \\width${width} \\height${height}\n}\\'ac}`;
    },
  );
  return { text, pictures: [...pictures.values()] };
}

const hexOf = (bytes: Uint8Array) => {
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
};

/**
 * A bundle's `TXT.rtf` with its pictures back in it. A file it names that is not a PNG or a JPEG, or
 * is not in the bundle, is left as its name.
 */
export function joinBundle(text: string, files: ReadonlyMap<string, Uint8Array>): string {
  return text.replace(ATTACHMENT, (_, name: string, width: string, height: string) => {
    const bytes = files.get(name);
    const header = bytes ? pictureHeader(bytes) : null;
    if (!bytes || !header) return name;
    return (
      `{\\pict\\${header.type}blip\\picw${header.width}\\pich${header.height}` +
      `\\picwgoal${width}\\pichgoal${height}\n${hexOf(bytes)}}`
    );
  });
}

const childrenOf = (entries: readonly DriveEntry[], folder: string) =>
  entries.filter((entry) => entry.parent === folder && entry.trashed_ms === undefined);

/** The document a `.rtfd` folder holds, as one RTF, and the version of its `TXT.rtf`. */
export async function readBundle(
  folder: string,
  signal?: AbortSignal,
): Promise<{ text: string; version: number }> {
  const drive = await loadDrive(signal);
  const children = childrenOf(drive.entries, folder);
  const main = children.find((entry) => entry.name === TEXT_FILE);
  if (!main) throw new Error(`The document has no ${TEXT_FILE}.`);
  const read = await readFileEntry(main.id, { signal });
  const rtf = rtfTextOfBytes(new Uint8Array(await read.blob.arrayBuffer()));
  const files = new Map<string, Uint8Array>();
  for (const [, name] of rtf.matchAll(ATTACHMENT)) {
    const file = children.find((entry) => entry.name === name);
    if (file && name) {
      files.set(name, new Uint8Array(await (await readFile(file.id, { signal })).arrayBuffer()));
    }
  }
  return { text: joinBundle(rtf, files), version: read.entry.version ?? 0 };
}

/**
 * Writes a whole document's RTF into its `.rtfd` folder: `TXT.rtf` made from `base`, the pictures it
 * lacks, and away with those it no longer names. Resolves with the folder, its version being that of
 * `TXT.rtf`.
 */
export async function writeBundle(
  folder: string,
  rtf: string,
  base?: number,
  session?: string | null,
): Promise<DriveEntry> {
  const { text, pictures } = splitBundle(rtf);
  const before = childrenOf((await ensureDrive()).entries, folder);
  for (const { name, bytes } of pictures) {
    if (before.some((entry) => entry.name === name)) continue;
    await uploadFile(
      new Blob([bytes as BlobPart], { type: name.endsWith("png") ? "image/png" : "image/jpeg" }),
      folder,
      { name, existing: "fail", ...(session !== undefined ? { session } : undefined) },
    );
  }
  const main = before.find((entry) => entry.name === TEXT_FILE);
  const written = await uploadFile(new Blob([text], { type: "application/rtf" }), folder, {
    name: TEXT_FILE,
    ...(main
      ? { existing: "overwrite", replaces: main.id, ...(base !== undefined ? { base } : undefined) }
      : { existing: "fail" }),
    ...(session !== undefined ? { session } : undefined),
  });
  const named = new Set([TEXT_FILE, ...pictures.map((picture) => picture.name)]);
  const gone = before.filter((entry) => !named.has(entry.name));
  if (gone.length > 0) await runOps(gone.map((entry) => ({ op: "delete", id: entry.id })));
  const entry = entryOf(await ensureDrive(), folder);
  if (!entry) throw new Error("The document's folder is no longer on your drive.");
  return { ...entry, version: written.version ?? 0 };
}

/** The Save sheet's Save as a `.rtfd`: a new folder, or in place of the item it replaces. */
export async function saveBundle(target: DriveSaveTarget, rtf: string): Promise<DriveEntry> {
  if (target.replaces) await runOps([{ op: "trash", id: target.replaces.id }]);
  const folder = await ensureFolder(target.folder, target.name, target.session);
  return writeBundle(folder.id, rtf, undefined, target.session);
}

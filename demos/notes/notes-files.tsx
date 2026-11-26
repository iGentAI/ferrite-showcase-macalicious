"use client";

import { useEffect, useState } from "react";
import {
  ATTACHMENT_MAX_BYTES,
  readAttachment,
  sizeLabel,
  uploadAttachment,
} from "../mail/mail-attachments";
import type { NoteFile } from "./notes-data";
import { syncEnabled } from "./notes-sync";

/*
 * The files attached to a note. On the desktop served by its Ferrite application a file is uploaded
 * in pieces to `/api/notes/attachments` and the save that names it holds it
 * (`ferrite-apps/desktop/src/apps/notes/mod.rs`); anywhere else it stays in the page. A file stands
 * in the editor as a block the browser cannot edit (`fileBlock`), which carries its record, so what
 * a note names is what its editor holds, Undo included.
 */

const API = "/api/notes";

/** The largest file a note takes, as the server allows it. */
export const MAX_NOTE_FILE = ATTACHMENT_MAX_BYTES;
/** The largest text file that becomes lines of the note: what the server keeps of a note. */
export const MAX_TEXT_FILE = 50_000;
/** A thumbnail is made of a picture whose own `data:` URL is longer than a note saves. */
const LONGEST_SAVED_PICTURE = 96_000;
const THUMBNAIL = { width: 164, height: 160 };

export const isPictureFile = (file: { name: string; type?: string }) =>
  file.type?.startsWith("image/") === true || /\.(png|jpe?g|gif|webp|svg)$/i.test(file.name);
export const isTextFile = (file: { name: string; type?: string }) =>
  file.type?.startsWith("text/") === true || /\.(txt|text|md|csv|log)$/i.test(file.name);
const isAudioFile = (file: { name: string; type?: string }) =>
  file.type?.startsWith("audio/") === true ||
  /\.(m4a|mp3|wav|aac|aiff?|ogg|webm)$/i.test(file.name);
const isVideoFile = (file: { name: string; type?: string }) =>
  file.type?.startsWith("video/") === true || /\.(mp4|mov|m4v)$/i.test(file.name);

/** How a note shows a file: the Attachments Browser's sections go by it as well. */
export type NoteFileKind = "picture" | "video" | "audio" | "document";
export function noteFileKind(file: { name: string; type?: string }): NoteFileKind {
  if (isPictureFile(file)) return "picture";
  if (isAudioFile(file)) return "audio";
  return isVideoFile(file) ? "video" : "document";
}

const bytes = new Map<string, Promise<Blob>>();
let localFiles = 0;

/** Keep `file` for a note: uploaded when the desktop is served. Rejects with the reason it failed. */
export async function keepNoteFile(file: File): Promise<NoteFile> {
  const kept = syncEnabled()
    ? await uploadAttachment(API, file, file.name)
    : { id: `local-file-${++localFiles}`, name: file.name, type: file.type, size: file.size };
  bytes.set(kept.id, Promise.resolve(file));
  return { id: kept.id, name: kept.name, type: kept.type, size: kept.size };
}

/** The bytes of a note's file: read once a page, and whole. */
export function readNoteFile(file: NoteFile): Promise<Blob> {
  const known = bytes.get(file.id);
  if (known) return known;
  const reading = readAttachment(`${API}/attachments/${file.id}`, file);
  bytes.set(file.id, reading);
  reading.catch(() => bytes.delete(file.id));
  return reading;
}

/** A picture's own bytes as a `data:` URL, and the thumbnail a note saves when that is too long. */
export async function pictureSources(
  file: File,
): Promise<{ src: string; thumbnail: string | undefined }> {
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  return {
    src,
    thumbnail: src.length > LONGEST_SAVED_PICTURE ? await thumbnailOf(file) : undefined,
  };
}

async function thumbnailOf(file: File): Promise<string | undefined> {
  if (typeof createImageBitmap !== "function") return undefined;
  try {
    const picture = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = THUMBNAIL.width;
    canvas.height = THUMBNAIL.height;
    const scale = Math.max(canvas.width / picture.width, canvas.height / picture.height);
    const width = picture.width * scale;
    const height = picture.height * scale;
    canvas
      .getContext("2d")
      ?.drawImage(picture, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    picture.close();
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    // A picture the browser cannot decode here has no thumbnail: the list shows a document's icon.
    return undefined;
  }
}

/** What a document's icon says: the name's extension. */
export const extensionLabel = (name: string) =>
  (/\.([a-z0-9]{1,4})$/i.exec(name)?.[1] ?? "").toUpperCase();

/** A file as it stands in a note's text: `src` is a picture's, when it is at hand. */
export function fileBlock(
  document: Document,
  file: NoteFile,
  picture?: { src?: string; thumbnail?: string },
): HTMLElement {
  const block = document.createElement("div");
  block.className = "mac-notes-attachment";
  block.dataset.attachment = "";
  block.dataset.fileId = file.id;
  block.dataset.fileName = file.name;
  block.dataset.fileType = file.type;
  block.dataset.fileSize = String(file.size);
  block.contentEditable = "false";
  const kind = noteFileKind(file);
  if (kind === "picture") {
    const image = document.createElement("img");
    image.className = "mac-notes-picture";
    image.alt = file.name;
    image.draggable = false;
    if (picture?.src) image.src = picture.src;
    if (picture?.thumbnail) block.dataset.thumbnail = picture.thumbnail;
    block.append(image);
    return block;
  }
  if (kind === "video") {
    const video = document.createElement("video");
    video.className = "mac-notes-picture";
    video.controls = true;
    video.title = file.name;
    block.append(video);
    return block;
  }
  const chip = document.createElement("div");
  chip.className = "mac-notes-file";
  const icon = document.createElement("span");
  icon.className = "mac-notes-file-icon";
  icon.textContent = extensionLabel(file.name);
  const name = document.createElement("span");
  name.className = "mac-notes-file-name";
  name.textContent = file.name;
  const size = document.createElement("span");
  size.className = "mac-notes-file-size";
  size.textContent = sizeLabel(file.size);
  chip.append(icon, name, size);
  if (kind === "audio") {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.title = file.name;
    chip.append(audio);
  }
  block.append(chip);
  return block;
}

/** The file a block of the editor stands for; `null` for a stand-in picture or anything else. */
export function fileOfBlock(block: Element): NoteFile | null {
  if (!(block instanceof HTMLElement) || block.dataset.fileId === undefined) return null;
  return {
    id: block.dataset.fileId,
    name: block.dataset.fileName ?? "",
    type: block.dataset.fileType ?? "",
    size: Number(block.dataset.fileSize ?? 0),
  };
}

/** The files an editor holds, in their order. */
export function filesIn(root: Element): NoteFile[] {
  const files = new Map<string, NoteFile>();
  for (const block of root.querySelectorAll("[data-file-id]")) {
    const file = fileOfBlock(block);
    if (file) files.set(file.id, file);
  }
  return [...files.values()];
}

/** Give each file in the editor still without its bytes (a note opened after a reload) those bytes. */
export function showFiles(root: Element) {
  for (const block of root.querySelectorAll("[data-file-id]")) {
    const file = fileOfBlock(block);
    const media = block.querySelector<HTMLImageElement | HTMLMediaElement>("img,audio,video");
    if (!file || !media || media.hasAttribute("src") || media.dataset.reading !== undefined) {
      continue;
    }
    media.dataset.reading = "";
    readNoteFile(file).then(
      (blob) => {
        delete media.dataset.reading;
        if (typeof URL.createObjectURL === "function") media.src = URL.createObjectURL(blob);
      },
      () => {
        delete media.dataset.reading;
        media.title = `${file.name} could not be read.`;
      },
    );
  }
}

/** A file's address in the page for as long as it is shown; `null` until it has been read. */
export function useNoteFileUrl(file: NoteFile | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const id = file?.id;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a file's bytes never change under its id
  useEffect(() => {
    if (!file || typeof URL.createObjectURL !== "function") return;
    let made: string | null = null;
    let gone = false;
    readNoteFile(file).then(
      (blob) => {
        if (gone) return;
        made = URL.createObjectURL(blob);
        setUrl(made);
      },
      () => setUrl(null),
    );
    return () => {
      gone = true;
      if (made) URL.revokeObjectURL(made);
      setUrl(null);
    };
  }, [id]);
  return url;
}

/** A document's icon: a page with its extension on it. */
export function NoteFileIcon({ name }: { name: string }) {
  return <span className="mac-notes-file-icon">{extensionLabel(name)}</span>;
}

/** What Quick Look shows of a note's file. */
export function NoteFilePreview({ file }: { file: NoteFile }) {
  const url = useNoteFileUrl(file);
  const kind = noteFileKind(file);
  if (kind === "picture" && url) {
    return <img className="mac-notes-quick-look" src={url} alt={file.name} />;
  }
  if (kind === "video" && url) {
    // biome-ignore lint/a11y/useMediaCaption: a person's own video has no captions
    return <video className="mac-notes-quick-look" controls src={url} />;
  }
  return (
    <div className="mac-notes-file-preview">
      <NoteFileIcon name={file.name} />
      <span>{file.name}</span>
      <span>{sizeLabel(file.size)}</span>
      {kind === "audio" && url ? (
        // biome-ignore lint/a11y/useMediaCaption: a person's recording has no captions
        <audio controls src={url} />
      ) : null}
    </div>
  );
}

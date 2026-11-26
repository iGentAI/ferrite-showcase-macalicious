/*
 * The Photos library on the desktop served by the `macalicious-desktop` Ferrite application: the
 * page's side of `ferrite-apps/desktop/src/apps/photos`. Originals are files of the person's
 * drive (photos-drive.ts), uploaded in pieces under the gateway's 256 KiB request limit; the
 * module keeps the library's records, thumbnails, edits and albums. Photo Booth imports its
 * pictures through `importPicture` too, so they appear in Photos.
 */

import {
  isCurrentPictureTicket,
  type PictureTicket,
  showDesktopPicture,
} from "../desktop/desktop-personal";
import { currentDesktopSession, sessionFetch, withDeadline } from "../desktop/desktop-server";
import { deleteDriveFile, picturesFolder, readDriveFile, uploadToDrive } from "./photos-drive";
import { type Edit, editFromServer, encodeJpeg, NO_EDIT, renderEdit } from "./photos-edit";
import { editedFileOf, forgetCopy } from "./photos-edit-with";
import { readExif } from "./photos-exif";

/** The module's address. */
export const PHOTOS_API = "/api/photos";
/** The longer side of a thumbnail, in pixels. */
export const THUMB_SIDE = 480;
/** The largest thumbnail the module keeps, in bytes. */
export const MAX_THUMB_BYTES = 96_000;
/** The most thumbnails one request reads. */
export const THUMBS_PER_REQUEST = 48;
/** The picture types a library takes. */
export const PICTURE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
export type PictureType = (typeof PICTURE_TYPES)[number];
/** The movie types a library takes (the module's `MIME_TYPES`). */
export const MOVIE_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;
export type MovieType = (typeof MOVIE_TYPES)[number];
/** The largest original the module keeps, in bytes (its `MAX_ORIGINAL_BYTES`): 64 MiB. */
export const MAX_ORIGINAL_BYTES = 64 * 1024 * 1024;

/** How an album lists its photos (the module's `ALBUM_SORTS`): as added, by date, by title. */
export type AlbumSort = "custom" | "oldest" | "newest" | "title";
const ALBUM_SORT_IDS: readonly AlbumSort[] = ["custom", "oldest", "newest", "title"];

/** Where a photo came from. */
export type PhotoSource = "import" | "photo-booth";

/** Where a photo was taken. */
export interface PhotoLocation {
  lat: number;
  lon: number;
  name?: string;
}

/** What the camera recorded (the module's `Exif`). */
export interface PhotoExif {
  lens?: string;
  iso?: number;
  aperture?: number;
  exposure?: number;
  focal?: number;
  bias?: number;
}

/** A face found in a photo as it shows: its box as fractions of the picture. */
export interface PhotoFace {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  name?: string | null;
  /** The person said this is no face. */
  not_a_face?: boolean;
}

/** One photo of the library, as the module answers it. */
export interface LibraryPhoto {
  id: string;
  /** The drive's id of the original. */
  file: string;
  name: string;
  mime: string;
  bytes: number;
  width: number;
  height: number;
  taken_ms: number;
  added_ms: number;
  source: PhotoSource;
  effect: string | null;
  camera: string | null;
  favorite: boolean;
  deleted_ms: number | null;
  edit: Edit | null;
  edited_ms: number | null;
  title: string | null;
  caption: string | null;
  keywords: string[];
  /** The names the person gave the people in it, by a face or in Info. */
  people: string[];
  location: PhotoLocation | null;
  hidden: boolean;
  exif: PhotoExif | null;
  /** A movie's length, in milliseconds; a picture has none. */
  duration_ms: number | null;
  /** The hash of its thumbnail (`photos-near-duplicates.ts`), once this page or another worked it out. */
  phash?: string | null;
  /** What its thumbnail shows (`photos-scenes.ts`); absent until a page has looked. */
  scenes?: string[] | null;
  /** The faces a page found in its thumbnail; absent until one has looked. */
  faces?: PhotoFace[] | null;
}

export interface LibraryAlbum {
  id: string;
  name: string;
  photos: string[];
  created_ms: number;
  /** The order it lists its photos in. */
  sort: AlbumSort;
  /** The photo its sidebar row shows. */
  key_photo: string | null;
  /** The folder it is in. */
  folder: string | null;
}

/** A folder of My Albums. */
export interface LibraryFolder {
  id: string;
  name: string;
  parent: string | null;
}

/** One condition of a smart album. The module's `RULE_FIELDS` and `RULE_OPS`. */
export interface SmartRule {
  field: string;
  op: string;
  value: string;
}

export interface SmartAlbum {
  id: string;
  name: string;
  /** Whether a photo meeting any rule is listed, rather than all of them. */
  any: boolean;
  rules: SmartRule[];
  folder: string | null;
}

/** A keyword of the Keyword Manager's list, with the key that applies it. */
export interface ManagedKeyword {
  name: string;
  key?: string;
}

/** A saved slideshow. */
export interface SlideshowProject {
  id: string;
  name: string;
  photos: string[];
  theme: string;
  seconds: number;
  /** The song of the person's Music library played under it. */
  music?: SlideshowMusic | null;
}

export interface SlideshowMusic {
  /** The drive's id of the song's file. */
  file: string;
  title: string;
}

/** How the person organised the photos: what each organising route answers. */
/** What the person chose about memories, by memory id. */
export interface MemoryMarks {
  favorites: readonly string[];
  deleted: readonly string[];
  albums: readonly string[];
}

export const NO_MEMORY_MARKS: MemoryMarks = { favorites: [], deleted: [], albums: [] };

export interface Organised {
  albums: LibraryAlbum[];
  folders: LibraryFolder[];
  smart_albums: SmartAlbum[];
  keywords: ManagedKeyword[];
  projects: SlideshowProject[];
  memories: MemoryMarks;
}

export interface Library extends Organised {
  photos: LibraryPhoto[];
  /** Drive files of photos deleted for good whose removal from the drive the module has not been
   * told of yet: the page removes them and confirms (`removePurged`). */
  purge: string[];
  limits: { photos: number; recently_deleted_days: number };
  /** How the window was left. */
  settings: Record<string, unknown>;
  /** The revision of `settings`, which a save names. */
  settings_rev?: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const str = (value: unknown) => (typeof value === "string" ? value : null);
const num = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/** A photo of a reply, or `undefined` when it is not in the module's shape. */
export function photoFromServer(value: unknown): LibraryPhoto | undefined {
  if (!isRecord(value)) return undefined;
  const id = str(value.id);
  const file = str(value.file);
  const name = str(value.name);
  const mime = str(value.mime);
  const bytes = num(value.bytes);
  const width = num(value.width);
  const height = num(value.height);
  const taken = num(value.taken_ms);
  const added = num(value.added_ms);
  if (
    id === null ||
    file === null ||
    name === null ||
    mime === null ||
    bytes === null ||
    width === null ||
    height === null ||
    taken === null ||
    added === null
  )
    return undefined;
  return {
    id,
    file,
    name,
    mime,
    bytes,
    width,
    height,
    taken_ms: taken,
    added_ms: added,
    source: value.source === "photo-booth" ? "photo-booth" : "import",
    effect: str(value.effect),
    camera: str(value.camera),
    favorite: value.favorite === true,
    deleted_ms: num(value.deleted_ms),
    edit: editFromServer(value.edit),
    edited_ms: num(value.edited_ms),
    title: str(value.title),
    caption: str(value.caption),
    keywords: Array.isArray(value.keywords)
      ? value.keywords.filter((each): each is string => typeof each === "string")
      : [],
    people: Array.isArray(value.people)
      ? value.people.filter((each): each is string => typeof each === "string")
      : [],
    location: locationFromServer(value.location),
    hidden: value.hidden === true,
    exif: isRecord(value.exif) ? (value.exif as PhotoExif) : null,
    duration_ms: num(value.duration_ms),
    phash: str(value.phash),
    scenes: Array.isArray(value.scenes)
      ? value.scenes.filter((each): each is string => typeof each === "string")
      : null,
    faces: Array.isArray(value.faces) ? (value.faces as PhotoFace[]) : null,
  };
}

function locationFromServer(value: unknown): PhotoLocation | null {
  if (!isRecord(value)) return null;
  const lat = num(value.lat);
  const lon = num(value.lon);
  if (lat === null || lon === null) return null;
  const name = str(value.name);
  return name === null ? { lat, lon } : { lat, lon, name };
}

function albumFromServer(value: unknown): LibraryAlbum | undefined {
  if (!isRecord(value)) return undefined;
  const id = str(value.id);
  const name = str(value.name);
  if (id === null || name === null || !Array.isArray(value.photos)) return undefined;
  return {
    id,
    name,
    photos: value.photos.filter((each): each is string => typeof each === "string"),
    created_ms: num(value.created_ms) ?? 0,
    sort: ALBUM_SORT_IDS.find((each) => each === value.sort) ?? "custom",
    key_photo: str(value.key_photo),
    folder: str(value.folder),
  };
}

/** The albums of a reply, or `undefined` when it is not in the module's shape. */
export function albumsFromServer(reply: unknown): LibraryAlbum[] | undefined {
  const albums = isRecord(reply) ? reply.albums : undefined;
  if (!Array.isArray(albums)) return undefined;
  const read = albums.map(albumFromServer);
  return read.every((album) => album !== undefined) ? (read as LibraryAlbum[]) : undefined;
}

/** What an organising route answered, or `undefined` when it is not in the module's shape. */
export function organisedFromServer(reply: unknown): Organised | undefined {
  const albums = albumsFromServer(reply);
  if (!albums || !isRecord(reply)) return undefined;
  const list = (value: unknown) => (Array.isArray(value) ? value.filter(isRecord) : []);
  const ids = (value: unknown) =>
    Array.isArray(value) ? value.filter((each): each is string => typeof each === "string") : [];
  const memories = isRecord(reply.memories) ? reply.memories : {};
  return {
    memories: {
      favorites: ids(memories.favorites),
      deleted: ids(memories.deleted),
      albums: ids(memories.albums),
    },
    albums,
    folders: list(reply.folders).flatMap((each) => {
      const id = str(each.id);
      const name = str(each.name);
      return id === null || name === null ? [] : [{ id, name, parent: str(each.parent) }];
    }),
    smart_albums: list(reply.smart_albums).flatMap((each) => {
      const id = str(each.id);
      const name = str(each.name);
      if (id === null || name === null) return [];
      const rules = list(each.rules).map((rule) => ({
        field: str(rule.field) ?? "",
        op: str(rule.op) ?? "",
        value: str(rule.value) ?? "",
      }));
      return [{ id, name, any: each.any === true, rules, folder: str(each.folder) }];
    }),
    keywords: list(reply.keywords).flatMap((each) => {
      const name = str(each.name);
      if (name === null) return [];
      const key = str(each.key);
      return [key === null ? { name } : { name, key }];
    }),
    projects: list(reply.projects).flatMap((each) => {
      const id = str(each.id);
      const name = str(each.name);
      if (id === null || name === null) return [];
      const photos = Array.isArray(each.photos)
        ? each.photos.filter((photo): photo is string => typeof photo === "string")
        : [];
      const music = isRecord(each.music) ? each.music : null;
      const file = music ? str(music.file) : null;
      const song = music ? str(music.title) : null;
      return [
        {
          id,
          name,
          photos,
          theme: str(each.theme) ?? "",
          seconds: num(each.seconds) ?? 3,
          music: file !== null && song !== null ? { file, title: song } : null,
        },
      ];
    }),
  };
}

/** The library of a `GET /library` reply, or `undefined` when it is not the module's. */
export function libraryFromServer(reply: unknown): Library | undefined {
  if (!isRecord(reply) || !Array.isArray(reply.photos)) return undefined;
  const photos = reply.photos.map(photoFromServer);
  if (!photos.every((photo) => photo !== undefined)) return undefined;
  const organised = organisedFromServer(reply);
  if (!organised) return undefined;
  const limits = isRecord(reply.limits) ? reply.limits : {};
  return {
    ...organised,
    settings_rev: num(reply.settings_rev) ?? 0,
    photos: photos as LibraryPhoto[],
    purge: Array.isArray(reply.purge)
      ? reply.purge.filter((each): each is string => typeof each === "string")
      : [],
    limits: {
      photos: num(limits.photos) ?? 5000,
      recently_deleted_days: num(limits.recently_deleted_days) ?? 30,
    },
    settings: isRecord(reply.settings) ? reply.settings : {},
  };
}

/** A refused or failed request, with the module's own message when it gave one. */
export class LibraryError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Whether an attempt went unanswered or failed on the server, so it may still commit. */
    readonly ambiguous = false,
    /** What the module answered, when it answered. */
    readonly reply: unknown = null,
  ) {
    super(message);
    this.name = "LibraryError";
  }
}

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

/**
 * One request to the module, under the desktop's deadline, answered as JSON. With `retry`, a
 * request that fails without a reply or with a server failure is sent once more, and only once
 * (every write here is safe to repeat: ids are the page's own).
 */
async function call(
  method: string,
  path: string,
  options: { body?: unknown; raw?: Blob; retry?: boolean; type?: string; keepalive?: boolean } = {},
): Promise<unknown> {
  const send = () =>
    withDeadline(async (signal) => {
      const init: RequestInit = {
        method,
        credentials: "same-origin",
        signal,
        keepalive: options.keepalive,
      };
      if (options.raw) {
        init.body = options.raw;
        init.headers = { "content-type": options.type ?? "application/octet-stream" };
      } else if (options.body !== undefined) {
        init.body = JSON.stringify(options.body);
        init.headers = { "content-type": "application/json" };
      }
      const response = await sessionFetch(`${PHOTOS_API}${path}`, init);
      return { status: response.status, reply: await readJson(response) };
    });
  const attempts = options.retry ? 2 : 1;
  let answer: { status: number; reply: unknown } | undefined;
  // An attempt with no answer, or a server failure, may still have been carried out.
  let ambiguous = false;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      answer = await send();
    } catch (error) {
      ambiguous = true;
      if (attempt === attempts) {
        throw new LibraryError(error instanceof Error ? error.message : String(error), 0, true);
      }
      continue;
    }
    if (answer.status < 500) break;
    ambiguous = true;
  }
  if (!answer) throw new LibraryError("no reply", 0, true);
  if (answer.status >= 200 && answer.status < 300) return answer.reply;
  const message = isRecord(answer.reply) ? str(answer.reply.error) : null;
  throw new LibraryError(
    message ?? `HTTP ${answer.status}`,
    answer.status,
    ambiguous,
    answer.reply,
  );
}

/** Originals being removed now: two loads close together both list them, and the drive would refuse the second. */
const removing = new Set<string>();

/**
 * Remove from the drive the originals of photos deleted for good, then tell the module which are
 * gone, so it stops listing them. A file the drive no longer has counts as removed; one that
 * could not be removed stays listed, and the next load tries again.
 */
export async function removePurged(files: readonly string[]): Promise<void> {
  const mine = files.filter((file) => !removing.has(file));
  for (const file of mine) removing.add(file);
  try {
    const removed: string[] = [];
    for (const file of mine) {
      try {
        await deleteDriveFile(file);
        removed.push(file);
      } catch (error) {
        console.warn(`Photos could not remove a deleted photo's original (${error})`);
      }
    }
    if (removed.length > 0) {
      await call("POST", "/purged", { body: { files: removed }, retry: true });
    }
  } finally {
    for (const file of mine) removing.delete(file);
  }
}

/** The library: every photo and album, read over as many replies as it takes. Removes purged
 * originals. */
export async function loadLibrary(): Promise<Library> {
  let reply = await call("GET", "/library", { retry: true });
  const library = libraryFromServer(reply);
  if (!library) throw new LibraryError("the library's reply is not the module's", 0);
  let next = isRecord(reply) ? num(reply.next) : null;
  while (next !== null) {
    reply = await call("GET", `/library?from=${next}`, { retry: true });
    const page = libraryFromServer(reply);
    if (!page) throw new LibraryError("the library's reply is not the module's", 0);
    library.photos.push(...page.photos);
    next = isRecord(reply) ? num(reply.next) : null;
  }
  if (library.purge.length > 0) {
    removePurged(library.purge).catch((error) =>
      console.warn(`Photos could not confirm removed originals (${error})`),
    );
  }
  return library;
}

/** A change to one photo; `edit: null` reverts it to its original. */
export interface PhotoChange {
  favorite?: boolean;
  hidden?: boolean;
  deleted?: boolean;
  name?: string;
  /** Empty removes it. */
  title?: string;
  /** Empty removes it. */
  caption?: string;
  keywords?: string[];
  add_keywords?: string[];
  remove_keywords?: string[];
  add_people?: string[];
  remove_people?: string[];
  /** What one face now is: its name goes on the photo's people, and comes off with it. */
  face?: { id: number; name?: string | null; not_a_face?: boolean };
  taken_ms?: number;
  /** `null` removes it. */
  location?: PhotoLocation | null;
  edit?: Edit | null;
  /** The thumbnail of the edited photo, with an edit. */
  thumb?: Blob;
}

/** Standard base64 of a blob's bytes. */
export async function base64Of(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let text = "";
  for (let at = 0; at < bytes.length; at += 0x8000) {
    text += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  }
  return btoa(text);
}

const photoOf = (reply: unknown): LibraryPhoto => {
  const photo = photoFromServer(isRecord(reply) ? reply.photo : undefined);
  if (!photo) throw new LibraryError("the reply holds no photo", 0);
  return photo;
};

/** Change one photo, answering it as the module keeps it now. */
export async function changePhoto(id: string, change: PhotoChange): Promise<LibraryPhoto> {
  const { thumb, ...rest } = change;
  const body: Record<string, unknown> = { ...rest };
  if (thumb) body.thumb = await base64Of(thumb);
  const reply = await call("POST", `/photos/${encodeURIComponent(id)}`, { body, retry: true });
  const photo = photoOf(reply);
  // A revert also takes back what Preview saved: the original stands again, and the copies go.
  if (change.edit !== undefined && !photo.edit) {
    deleteCopies(photo.file, isRecord(reply) ? str(reply.released) : null);
  }
  return photo;
}

/** Keeps what some thumbnails show with their photos, answering the ids that took it. */
export async function keepPictureScenes(
  scans: readonly { id: string; scenes: readonly string[] }[],
): Promise<string[]> {
  const reply = await call("POST", "/scenes", { body: { scans }, retry: true });
  return isRecord(reply) && Array.isArray(reply.kept)
    ? reply.kept.filter((id): id is string => typeof id === "string")
    : [];
}

/** Keeps the hashes of some thumbnails with their photos, answering the ids that took one. */
export async function keepPictureHashes(
  hashes: readonly { id: string; edited_ms: number | null; hash: string }[],
): Promise<string[]> {
  const reply = await call("POST", "/hashes", { body: { hashes }, retry: true });
  return isRecord(reply) && Array.isArray(reply.kept)
    ? reply.kept.filter((id): id is string => typeof id === "string")
    : [];
}

/** Keeps what a page found in some thumbnails: each photo's faces as they now stand on the server. */
export async function keepFaces(
  scans: readonly {
    id: string;
    edited_ms: number | null;
    faces: readonly Omit<PhotoFace, "id">[];
  }[],
): Promise<{ id: string; faces: PhotoFace[] }[]> {
  const reply = await call("POST", "/faces", { body: { scans }, retry: true });
  return isRecord(reply) && Array.isArray(reply.kept)
    ? (reply.kept as { id: string; faces: PhotoFace[] }[])
    : [];
}

/** Forgets what Preview had of the photo with this original, and deletes those files. */
function deleteCopies(original: string, external: string | null) {
  const copy = forgetCopy(original);
  for (const file of new Set([copy?.open, copy?.base, external])) {
    if (file) void deleteDriveFile(file).catch(() => undefined);
  }
}

/** Delete a photo for good, with its original on the drive. */
export async function deletePhoto(id: string): Promise<void> {
  const reply = await call("DELETE", `/photos/${encodeURIComponent(id)}`, { retry: true });
  const file = isRecord(reply) ? str(reply.file) : null;
  if (file) {
    deleteCopies(file, isRecord(reply) ? str(reply.external) : null);
    // The module keeps listing the file until its removal is confirmed, so a failure here is
    // retried by the next load.
    await removePurged([file]).catch((error) =>
      console.warn(`Photos could not confirm a removed original (${error})`),
    );
  }
}

/** The thumbnails of `ids`, as JPEG blobs, read `THUMBS_PER_REQUEST` at a time. */
export async function readThumbs(ids: readonly string[]): Promise<Map<string, Blob>> {
  const found = new Map<string, Blob>();
  for (let at = 0; at < ids.length; at += THUMBS_PER_REQUEST) {
    const batch = ids.slice(at, at + THUMBS_PER_REQUEST);
    const reply = await call("GET", `/thumbs?ids=${batch.map(encodeURIComponent).join(",")}`, {
      retry: true,
    });
    const thumbs = isRecord(reply) && isRecord(reply.thumbs) ? reply.thumbs : {};
    for (const [id, text] of Object.entries(thumbs)) {
      if (typeof text !== "string") continue;
      const plain = text.replace(/-/g, "+").replace(/_/g, "/");
      const padded = plain + "=".repeat((4 - (plain.length % 4)) % 4);
      const binary = atob(padded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      found.set(id, new Blob([bytes], { type: "image/jpeg" }));
    }
  }
  return found;
}

/** Originals already read in this page, by drive file: a photo is downloaded once. */
const originals = new Map<string, Promise<Blob>>();
/** How many originals the page keeps read at once, the latest. */
const ORIGINALS_KEPT = 12;

/** The original of a photo, from the drive, or what Preview saved of it, which its edit stands on. */
export function readOriginal(
  photo: Pick<LibraryPhoto, "file" | "mime"> & { edit?: Edit | null },
): Promise<Blob> {
  const standsOn = photo.edit?.external ?? editedFileOf(photo.file) ?? photo.file;
  return readUnedited({ file: standsOn, mime: photo.mime });
}

/** The file a photo was imported from, whatever came back from Preview. */
export function readUnedited(photo: Pick<LibraryPhoto, "file" | "mime">): Promise<Blob> {
  const kept = originals.get(photo.file);
  if (kept) {
    originals.delete(photo.file);
    originals.set(photo.file, kept);
    return kept;
  }
  const read = readDriveFile(photo.file, photo.mime);
  // A failed read is forgotten, unless a newer read of the file has taken its place.
  read.catch(() => {
    if (originals.get(photo.file) === read) originals.delete(photo.file);
  });
  originals.set(photo.file, read);
  while (originals.size > ORIGINALS_KEPT) {
    const oldest = originals.keys().next().value;
    if (oldest === undefined) break;
    originals.delete(oldest);
  }
  return read;
}

/** A decoded picture: its bitmap (or image element) and pixel size. */
export interface Decoded {
  image: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

/** Decode a picture's bytes, in the orientation its EXIF data names (the browser applies it). */
export async function decodePicture(blob: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      // Fall through to an image element, which some engines decode where a bitmap fails.
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => {},
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** How long a movie's first frame may take to appear, in milliseconds. */
const MOVIE_DECODE_MS = 20_000;

/**
 * A movie's poster frame and length, from a video element. A recording made in a browser names no
 * length until the element has looked for its end (`duration` is Infinity), so it is sought first.
 * Refuses what this browser cannot play, and a file it decodes to sound alone: MP4 and WebM hold
 * that as well, and only decoding shows it.
 */
export async function decodeMovie(
  blob: Blob,
  name: string,
): Promise<Decoded & { durationMs: number }> {
  const url = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";
  video.playsInline = true;
  const reached = (event: "loadeddata" | "seeked") =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("the movie took too long")), MOVIE_DECODE_MS);
      const settle = (then: () => void) => () => {
        clearTimeout(timer);
        video.removeEventListener(event, onDone);
        video.removeEventListener("error", onError);
        then();
      };
      const onDone = settle(resolve);
      const onError = settle(() => reject(new Error("this browser cannot play the movie")));
      video.addEventListener(event, onDone);
      video.addEventListener("error", onError);
    });
  try {
    const loaded = reached("loadeddata");
    video.src = url;
    await loaded;
    if (video.videoWidth === 0 || video.videoHeight === 0)
      throw new LibraryError(`“${name}” has sound but no picture`, 415);
    if (!Number.isFinite(video.duration)) {
      const end = reached("seeked");
      video.currentTime = Number.MAX_SAFE_INTEGER;
      await end;
    }
    const durationMs = Math.round(video.duration * 1000);
    if (!Number.isFinite(durationMs) || durationMs < 1) throw new Error("the movie has no length");
    const seconds = video.duration;
    const poster = reached("seeked");
    video.currentTime = Math.min(0.1, seconds / 2);
    await poster;
    return {
      image: video,
      width: video.videoWidth,
      height: video.videoHeight,
      durationMs,
      close: () => {
        video.removeAttribute("src");
        video.load();
        URL.revokeObjectURL(url);
      },
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/** The thumbnail of a decoded picture under an edit: a small JPEG. */
export async function thumbnailOf(decoded: Decoded, edit: Edit = NO_EDIT): Promise<Blob> {
  const canvas = renderEdit(decoded, edit, THUMB_SIDE);
  const blob =
    (await encodeJpeg(canvas, MAX_THUMB_BYTES)) ??
    (await encodeJpeg(renderEdit(decoded, edit, THUMB_SIDE / 2), MAX_THUMB_BYTES));
  if (!blob) throw new LibraryError("this browser made no thumbnail of the picture", 0);
  return blob;
}

export interface ImportOptions {
  /** The photo's name, normally the file's without its extension. */
  name: string;
  source?: PhotoSource;
  /** The Photo Booth effect it was taken with. */
  effect?: string;
  /** A folder inside Pictures to keep the original in (Photo Booth's own). */
  folder?: string;
  /** When it was taken, when no EXIF date says: by default the file's date, else now. */
  takenMs?: number;
  /** The id to add it under; by default a new one. */
  id?: string;
  /** What a duplicate carries over from the photo it copies. */
  title?: string | null;
  caption?: string | null;
  keywords?: readonly string[];
  people?: readonly string[];
  location?: PhotoLocation | null;
}

/** A picture's name without its extension. */
export const nameOf = (fileName: string) => fileName.replace(/\.[a-z0-9]{1,5}$/i, "") || fileName;

/**
 * What a file's first bytes say it is: a picture type the library takes, a HEIF picture (HEIC,
 * from an iPhone), an AVIF picture, or nothing Photos knows. The bytes decide, not the file's
 * name or the type the browser guessed from it: a JPEG without an extension is a JPEG, and a text
 * file named `.jpg` is not.
 */
export function sniffPicture(head: Uint8Array): PictureType | MovieType | "heic" | "avif" | null {
  const at = (offset: number, ...bytes: number[]) =>
    head.length >= offset + bytes.length && bytes.every((byte, n) => head[offset + n] === byte);
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (at(0, 0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  // An ISO media file: "ftyp" at 4, then its major brand.
  if (at(4, 0x66, 0x74, 0x79, 0x70) && head.length >= 12) {
    const brand = String.fromCharCode(...head.subarray(8, 12));
    if (["avif", "avis"].includes(brand)) return "avif";
    if (["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1", "heif"].includes(brand))
      return "heic";
    if (brand === "qt  ") return "video/quicktime";
    if (
      [
        "isom",
        "iso2",
        "iso3",
        "iso4",
        "iso5",
        "iso6",
        "mp41",
        "mp42",
        "avc1",
        "M4V ",
        "dash",
      ].includes(brand)
    )
      return "video/mp4";
  }
  if (at(0, 0x1a, 0x45, 0xdf, 0xa3)) return "video/webm";
  // A QuickTime file from before "ftyp" begins with one of these atoms.
  if (
    at(4, 0x6d, 0x6f, 0x6f, 0x76) ||
    at(4, 0x6d, 0x64, 0x61, 0x74) ||
    at(4, 0x77, 0x69, 0x64, 0x65)
  ) {
    return "video/quicktime";
  }
  return null;
}

/** "12.3 MB", in decimal units as the Finder counts. */
const megabytes = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;

/**
 * Whether a file can be imported, before anything is uploaded: its picture type as its bytes say,
 * or why it is refused, in words naming the file.
 */
export async function checkPicture(
  file: Blob,
  name: string,
): Promise<{ mime: PictureType | MovieType } | { refused: string }> {
  if (file.size === 0) return { refused: `“${name}” is empty` };
  if (file.size > MAX_ORIGINAL_BYTES) {
    return {
      refused: `“${name}” is ${megabytes(file.size)}, larger than the ${megabytes(MAX_ORIGINAL_BYTES)} Photos keeps for one picture`,
    };
  }
  const kind = sniffPicture(new Uint8Array(await file.slice(0, 32).arrayBuffer()));
  if (kind === "heic" || kind === "avif") {
    const what = kind === "heic" ? "a HEIC (HEIF) picture" : "an AVIF picture";
    return {
      refused: `“${name}” is ${what}, which not every browser can show; Photos keeps JPEG, PNG, GIF and WebP pictures, so export it as JPEG and import that`,
    };
  }
  if (kind === null) {
    return {
      refused: `“${name}” is not a picture or movie Photos can import (JPEG, PNG, GIF, WebP, MP4, MOV or WebM)`,
    };
  }
  return { mime: kind };
}

/**
 * Add a picture or movie to the library: check it by its bytes (`checkPicture`: a type the library
 * keeps, not too large), read its EXIF date and camera, decode it for its size and a thumbnail (a
 * movie's poster frame, and its length), upload
 * the original to the drive's Pictures folder in pieces, then add the photo. Every refusal names
 * the picture (`options.name`).
 */
export async function importPicture(blob: Blob, options: ImportOptions): Promise<LibraryPhoto> {
  const checked = await checkPicture(blob, options.name);
  if ("refused" in checked) throw new LibraryError(checked.refused, 415);
  const { mime } = checked;
  // The type its bytes say, whatever its name or the browser guessed from it.
  const fileDate = blob instanceof File ? blob.lastModified : undefined;
  const picture = blob.type === mime ? blob : new Blob([blob], { type: mime });
  const exif = mime === "image/jpeg" ? readExif(new Uint8Array(await picture.arrayBuffer())) : {};
  let decoded: Decoded;
  let durationMs: number | null = null;
  try {
    if (mime.startsWith("video/")) {
      const movie = await decodeMovie(picture, options.name);
      durationMs = movie.durationMs;
      decoded = movie;
    } else decoded = await decodePicture(picture);
  } catch (error) {
    if (error instanceof LibraryError) throw error;
    // The engine's own words differ (and name nothing): say what happened, the same everywhere.
    throw new LibraryError(
      mime.startsWith("video/")
        ? `“${options.name}” could not be played: this browser does not decode it, or the file is damaged`
        : `“${options.name}” could not be read as a picture: the file is damaged or incomplete`,
      422,
    );
  }
  let thumb: Blob;
  try {
    thumb = await thumbnailOf(decoded);
  } finally {
    decoded.close();
  }
  const extension = mime.split("/")[1]?.replace("jpeg", "jpg").replace("quicktime", "mov") ?? "jpg";
  const fileName = /\.[a-z0-9]{1,5}$/i.test(options.name)
    ? options.name
    : `${options.name}.${extension}`;
  const session = currentDesktopSession();
  const folder = await picturesFolder(options.folder, session);
  const file = await uploadToDrive(folder, fileName, picture, session);
  // Any moment a Date can hold, before 1970 too (negative).
  const taken = [exif.takenMs, options.takenMs, fileDate].find(
    (when): when is number => typeof when === "number" && Number.isFinite(when),
  );
  const body = {
    id: options.id ?? crypto.randomUUID(),
    file,
    name: nameOf(options.name),
    mime,
    bytes: picture.size,
    width: decoded.width,
    height: decoded.height,
    taken_ms: Math.round(taken ?? Date.now()),
    source: options.source ?? "import",
    effect: options.effect ?? null,
    camera: exif.camera ?? null,
    exif: exif.settings ?? null,
    // Null is a place taken away on purpose (a duplicate of such a photo): the EXIF does not refill it.
    location: options.location === undefined ? (exif.location ?? null) : options.location,
    title: options.title ?? null,
    caption: options.caption ?? null,
    keywords: options.keywords ?? [],
    people: options.people ?? [],
    duration_ms: durationMs,
    thumb: await base64Of(thumb),
  };
  let added: LibraryPhoto;
  try {
    added = photoOf(await call("POST", "/photos", { body, retry: true }));
  } catch (error) {
    await dropUnregistered(body.id, file, error);
    throw error;
  }
  return added;
}

/**
 * The original of an import the library refused is removed from the drive, so a refused import
 * (a full library) leaves no file behind. Only a definite refusal counts: every attempt was
 * answered, the last with a refusal (4xx), and a fresh read of the library shows neither the
 * photo nor its original kept. After an attempt that went unanswered or failed on the server,
 * the registration may still be running there and commit later, so the original stays on the
 * drive (in Pictures, where the person can see it) rather than risk deleting a kept photo's.
 */
export async function dropUnregistered(id: string, file: string, error: unknown): Promise<void> {
  const refused =
    error instanceof LibraryError && !error.ambiguous && error.status >= 400 && error.status < 500;
  if (!refused) {
    console.warn(`Photos may still keep an import (${error}); its original stays on the drive`);
    return;
  }
  try {
    const library = libraryFromServer(await call("GET", "/library", { retry: true }));
    if (!library) return;
    if (library.photos.some((photo) => photo.id === id || photo.file === file)) return;
    await deleteDriveFile(file);
  } catch (cleanup) {
    console.warn(`Photos could not remove the original of an import it did not keep (${cleanup})`);
  }
}

/** The window event that tells every Photos and Photo Booth window the library changed. */
export const LIBRARY_CHANGED_EVENT = "macalicious:photos-changed";

/**
 * Tell every open Photos and Photo Booth window (Photo Booth's shots, another window's import,
 * edit or delete) to read the library again. `origin` names the window that changed it, which
 * then does not read its own change again.
 */
export function announceChange(origin?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LIBRARY_CHANGED_EVENT, { detail: { origin } }));
}

/** The window a library-change event came from, when it named itself. */
export function announcedBy(event: Event): string | undefined {
  const detail = (event as CustomEvent<{ origin?: unknown } | null>).detail;
  return typeof detail?.origin === "string" ? detail.origin : undefined;
}

/** Make an album, answering every album. */
export async function createAlbum(name: string, id = crypto.randomUUID()) {
  return albumsOrThrow(await call("POST", "/albums", { body: { id, name }, retry: true }));
}

/**
 * Rename an album, set the order it lists its photos in, its key photo or folder, move it in the
 * sidebar, or change its photos, answering every album. With `from`, the photos added leave that
 * other album in the same write (Move to).
 */
export async function changeAlbum(
  id: string,
  change: {
    name?: string;
    sort?: AlbumSort;
    add?: string[];
    remove?: string[];
    from?: string;
    order?: string[];
    key_photo?: string | null;
    folder?: string | null;
    before?: string | null;
  },
) {
  return albumsOrThrow(
    await call("POST", `/albums/${encodeURIComponent(id)}`, { body: change, retry: true }),
  );
}

/** Delete an album (not its photos), answering every album. */
export async function deleteAlbum(id: string) {
  return albumsOrThrow(await call("DELETE", `/albums/${encodeURIComponent(id)}`, { retry: true }));
}

function albumsOrThrow(reply: unknown): LibraryAlbum[] {
  const albums = albumsFromServer(reply);
  if (!albums) throw new LibraryError("the reply holds no albums", 0);
  return albums;
}

function organisedOrThrow(reply: unknown): Organised {
  const organised = organisedFromServer(reply);
  if (!organised) throw new LibraryError("the reply holds no albums", 0);
  return organised;
}

const organise = async (method: string, path: string, body?: unknown) =>
  organisedOrThrow(await call(method, path, { body, retry: true }));

/** Make an album in a folder. */
export const createAlbumIn = (name: string, folder: string, id = crypto.randomUUID()) =>
  organise("POST", "/albums", { id, name, folder });

/**
 * Mark one memory on the server: in or out of Favorite Memories, deleted or not, and listed from an
 * album or not. Deleting also takes it out of the other two.
 */
export const changeMemory = (
  id: string,
  change: { favorite?: boolean; deleted?: boolean; album?: boolean },
) => organise("POST", "/memories", { id, ...change });

/** Make a folder, in `parent` when one is named. */
export const createFolder = (name: string, parent: string | null, id = crypto.randomUUID()) =>
  organise("POST", "/folders", { id, name, parent });

/** Rename a folder, move it inside another (or `null` for My Albums), or in the sidebar. */
export const changeFolder = (
  id: string,
  change: { name?: string; parent?: string | null; before?: string | null },
) => organise("POST", `/folders/${encodeURIComponent(id)}`, change);

/** Delete a folder and the albums in it; the photos stay in the library. */
export const deleteFolder = (id: string) =>
  organise("DELETE", `/folders/${encodeURIComponent(id)}`);

/** Make or replace a smart album. */
export const putSmartAlbum = (album: SmartAlbum) =>
  organise("PUT", `/smart-albums/${encodeURIComponent(album.id)}`, {
    name: album.name,
    any: album.any,
    rules: album.rules,
    folder: album.folder,
  });

export const deleteSmartAlbum = (id: string) =>
  organise("DELETE", `/smart-albums/${encodeURIComponent(id)}`);

/** Set the Keyword Manager's list. */
export const putKeywords = (keywords: readonly ManagedKeyword[]) =>
  organise("PUT", "/keywords", { keywords });

/** Make or replace a saved slideshow. */
export const putProject = (project: SlideshowProject) =>
  organise("PUT", `/projects/${encodeURIComponent(project.id)}`, {
    name: project.name,
    photos: project.photos,
    theme: project.theme,
    seconds: project.seconds,
    ...(project.music ? { music: project.music } : {}),
  });

export const deleteProject = (id: string) =>
  organise("DELETE", `/projects/${encodeURIComponent(id)}`);

/** Keep how the window was left. */
export async function putSettings(
  settings: Record<string, unknown>,
  options: { leaving?: boolean; base?: number } = {},
): Promise<number | null> {
  const reply = await call("PUT", "/settings", {
    body: options.base === undefined ? settings : { ...settings, base: options.base },
    retry: !options.leaving,
    keepalive: options.leaving,
  });
  return isRecord(reply) ? num(reply.rev) : null;
}

/** The stored revision a refused save names, when `error` is that refusal. */
export const settingsConflict = (error: unknown): number | null =>
  error instanceof LibraryError && error.status === 409 && isRecord(error.reply)
    ? num(error.reply.rev)
    : null;

/** The longer side a photo is drawn at for the desktop. */
const DESKTOP_PICTURE_SIDE = 2560;
// The address of the picture Photos last showed on the desktop, given back once a newer one from
// Photos has replaced it.
let shownPictureUrl: string | null = null;

/**
 * Make a photo the desktop picture: draw it with its edit and name it to the desktop, with the
 * `ticket` taken when the person chose Set Desktop Picture (`takePictureTicket`). The desktop
 * shows it only if no other choice was made meanwhile, in the same session; the desktop's own
 * settings keep the choice. Photos keeps no picture of its own. Answers whether it was shown.
 */
export async function setDesktopPicture(
  photo: LibraryPhoto,
  ticket: PictureTicket,
  load: (photo: LibraryPhoto) => Promise<Decoded> = async (each) =>
    decodePicture(await readOriginal(each)),
): Promise<boolean> {
  const decoded = await load(photo);
  let picture: Blob | null;
  try {
    if (!isCurrentPictureTicket(ticket)) return false;
    picture = await encodeJpeg(
      renderEdit(decoded, photo.edit ?? NO_EDIT, DESKTOP_PICTURE_SIDE),
      Number.MAX_SAFE_INTEGER,
      [0.9],
    );
  } finally {
    decoded.close();
  }
  if (!picture) throw new LibraryError("this browser could not draw the photo", 0);
  // Another picture was chosen while this one was drawn: it is not shown.
  if (!isCurrentPictureTicket(ticket)) return false;
  const url = URL.createObjectURL(picture);
  showDesktopPicture({ day: url, night: url, look: "auto", source: "photos", ...ticket });
  const previous = shownPictureUrl;
  shownPictureUrl = url;
  if (previous) setTimeout(() => URL.revokeObjectURL(previous), 2_000);
  return true;
}

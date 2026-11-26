import {
  type DriveEntry,
  DriveError,
  readFile,
  runOps,
  uploadFile,
} from "../desktop/desktop-files";
import type { LibrarySong } from "./music-server";
import { audioType, readFileTags, type SongTags, titleFromFileName } from "./music-tags";

/**
 * How Music keeps a song from the person's computer: the file goes to the Music folder of their
 * drive (`src/apps/files/`, uploaded in pieces under the gateway's 256 KiB request limit), its
 * tags are read here first, and the library keeps the drive's file id. Reading it back joins the
 * pieces into one `Blob`.
 */
export const MUSIC_FOLDER = "music";

/** The largest cover kept, in bytes, and the side it is drawn at. */
const COVER_BYTES = 100_000;
const COVER_SIDE = 300;

/** A file chosen to add, and why it cannot be when it cannot. */
export function songFileProblem(file: File): string | null {
  if (!audioType(file)) return `“${file.name}” is not a song file Music can add.`;
  if (file.size === 0) return `“${file.name}” is empty.`;
  return null;
}

/** How long a song lasts, from the browser's own decoder; rejects, saying why, when it cannot
 * play it. A file whose length the browser never finds is refused too: a song of no length
 * would be listed as if it could play. */
export function probeDuration(file: Blob, type: string, waitMs = 15_000): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    if (audio.canPlayType(type) === "") {
      reject(new Error("this browser does not play this kind of file."));
      return;
    }
    const url = URL.createObjectURL(file.type ? file : new Blob([file], { type }));
    const loaded = () => {
      const seconds = audio.duration;
      done(() =>
        Number.isFinite(seconds) && seconds > 0
          ? resolve(seconds)
          : reject(new Error("the browser could not find its length: the file may be damaged.")),
      );
    };
    const failed = () => {
      const code = (audio.error as { code?: number } | null)?.code;
      done(() =>
        reject(
          new Error(
            code === 2
              ? "the browser could not read the file."
              : "the browser could not decode it: the file is damaged, or not a song in a format it plays.",
          ),
        ),
      );
    };
    const done = (outcome: () => void) => {
      clearTimeout(timer);
      audio.removeEventListener("loadedmetadata", loaded);
      audio.removeEventListener("error", failed);
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
      outcome();
    };
    const timer = setTimeout(
      () =>
        done(() =>
          reject(new Error("the browser could not find its length: the file may be damaged.")),
        ),
      waitMs,
    );
    audio.preload = "metadata";
    audio.addEventListener("loadedmetadata", loaded);
    audio.addEventListener("error", failed);
    audio.src = url;
  });
}

/** The cover made small: a JPEG of at most `COVER_BYTES`, or `null` when it cannot be read. */
export async function shrinkCover(
  picture: NonNullable<SongTags["picture"]>,
): Promise<Uint8Array | null> {
  try {
    const bitmap = await createImageBitmap(
      new Blob([picture.data as Uint8Array<ArrayBuffer>], { type: picture.type }),
    );
    const scale = Math.min(1, COVER_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    for (const quality of [0.85, 0.7, 0.5, 0.3]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (blob && blob.size <= COVER_BYTES) return new Uint8Array(await blob.arrayBuffer());
    }
  } catch {
    // A cover the browser cannot decode is left out.
  }
  return null;
}

export interface AddedSong {
  song: Omit<LibrarySong, "artwork">;
  /** The cover to keep with it, made small. */
  cover: Uint8Array | null;
}

/**
 * Reads a song file's tags and length, uploads it to the drive's Music folder and resolves with
 * the library song for it (and its cover). `onProgress` hears the bytes sent. `length` is the
 * song's length in seconds when the caller knows it: a browser may find none for an MP3 with no
 * header frame, which is what a browser's own encoder writes.
 */
export async function addSongFile(
  file: File,
  id: string,
  onProgress: (sent: number, total: number) => void,
  signal?: AbortSignal,
  length?: number,
): Promise<AddedSong> {
  const type = audioType(file) ?? "audio/mpeg";
  const [tags, duration] = await Promise.all([
    readFileTags(file).catch((): SongTags => ({})),
    length ?? probeDuration(file, type),
  ]);
  signal?.throwIfAborted();
  const entry = await uploadFile(file, MUSIC_FOLDER, { onProgress, signal });
  const cover = tags.picture ? await shrinkCover(tags.picture) : null;
  return songOf(file, entry, id, tags, duration, type, cover);
}

/**
 * The library song for a file already on the drive, which stays where it is: a song names one
 * drive file, so opening that file again finds the song.
 */
export async function songOfDriveFile(
  entry: Pick<DriveEntry, "id" | "name" | "size" | "type">,
  id: string,
): Promise<AddedSong> {
  const blob = await readFile(entry.id);
  const file = new File([blob], entry.name, { type: entry.type || blob.type });
  const type = audioType(file) ?? "audio/mpeg";
  const [tags, duration] = await Promise.all([
    readFileTags(file).catch((): SongTags => ({})),
    probeDuration(file, type),
  ]);
  const cover = tags.picture ? await shrinkCover(tags.picture) : null;
  return songOf(
    file,
    { id: entry.id, name: entry.name, size: file.size },
    id,
    tags,
    duration,
    type,
    cover,
  );
}

function songOf(
  file: File,
  entry: { id: string; name: string; size: number },
  id: string,
  tags: SongTags,
  duration: number,
  type: string,
  cover: Uint8Array | null,
): AddedSong {
  return {
    song: {
      id,
      title: tags.title ?? titleFromFileName(file.name),
      artist: tags.artist ?? tags.albumArtist ?? "",
      album: tags.album ?? "",
      genre: tags.genre ?? "",
      ...(tags.composer ? { composer: tags.composer } : {}),
      ...(tags.grouping ? { grouping: tags.grouping } : {}),
      ...(tags.comments ? { comments: tags.comments } : {}),
      year: tags.year ?? null,
      track: tags.track ?? null,
      duration,
      added: Date.now(),
      source: { kind: "file", file: entry.id, name: entry.name, type, size: entry.size },
    },
    cover,
  };
}

/**
 * The picture embedded in a drive file (ID3 APIC, MP4 `covr`, FLAC PICTURE), made small; `null` when
 * it has none the browser can draw. The file is read here and goes nowhere else.
 */
export async function coverOfSongFile(fileId: string): Promise<Uint8Array | null> {
  const tags = await readFileTags(await readFile(fileId));
  return tags.picture ? shrinkCover(tags.picture) : null;
}

/** The songs File > Library > Get Album Artwork reads: those of the drive with no picture yet. */
export const songsWantingArtwork = (songs: readonly LibrarySong[]) =>
  songs.filter((song) => song.source.kind === "file" && !song.artwork);

/**
 * The picture each song with none takes from another song of its album, by song id: what a record's
 * sleeve is to all its tracks. An album of no name, or of two artists, shares nothing.
 */
export function sharedAlbumArtwork(songs: readonly LibrarySong[]): Map<string, string> {
  const keyOf = (song: LibrarySong) => `${song.artist}\u0000${song.album}`;
  const sleeves = new Map<string, string>();
  for (const song of songs) {
    if (song.album && song.artwork && !sleeves.has(keyOf(song))) {
      sleeves.set(keyOf(song), song.artwork);
    }
  }
  const shared = new Map<string, string>();
  for (const song of songs) {
    const sleeve = song.artwork ? undefined : sleeves.get(keyOf(song));
    if (sleeve) shared.set(song.id, sleeve);
  }
  return shared;
}

/** What Get Album Artwork says when it ends. */
export function artworkReport(found: number, read: number, failed: number, shared = 0): string {
  const songs = read === 1 ? "song" : "songs";
  const unread =
    failed > 0
      ? ` ${failed} could not be read or kept; choose Get Album Artwork again to try them.`
      : "";
  const sleeve =
    shared > 0
      ? ` ${shared} ${shared === 1 ? "song" : "songs"} took the picture of another song of the album.`
      : "";
  if (found === 0 && shared > 0) return `${sleeve.trim()}${unread}`;
  return found === 0
    ? `No picture was found in the files of ${read} ${songs}. Nothing here looks artwork up online; Song Info's Artwork pane takes a picture.${unread}`
    : `Artwork from their own files was added to ${found} of ${read} ${songs}.${sleeve}${unread}`;
}

/** What a drive file's own tags say the lyrics are, read once for the page. */
const fileLyrics = new Map<string, Promise<string>>();
export function lyricsOfSongFile(fileId: string): Promise<string> {
  let read = fileLyrics.get(fileId);
  if (!read) {
    read = readFile(fileId)
      .then(readFileTags)
      .then((tags) => tags.lyrics ?? "");
    read.catch(() => fileLyrics.delete(fileId));
    fileLyrics.set(fileId, read);
  }
  return read;
}

/** A drive file's bytes, joined from its pieces. */
export function readSongFile(fileId: string): Promise<Blob> {
  return readFile(fileId);
}

/** Take a song's file out of the drive again: its upload finished, but the song was never
 * added (Music closed meanwhile). A failure leaves the file in the Music folder. */
export function forgetSongFile(fileId: string): void {
  void runOps([{ op: "delete", id: fileId }]).catch(() => {});
}

/** The sentence to show for a failed add. */
export function addFailure(file: File, error: unknown): string {
  if (error instanceof DriveError && error.message) return `“${file.name}”: ${error.message}`;
  return `“${file.name}” could not be added: ${error instanceof Error ? error.message : String(error)}`;
}

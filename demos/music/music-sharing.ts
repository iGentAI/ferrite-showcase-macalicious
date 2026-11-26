"use client";

import { sessionFetch } from "../desktop/desktop-server";
import type { LibraryPlaylist, LibrarySong } from "./music-server";

/**
 * Home Sharing between this desktop's accounts (`src/apps/music/sharing.rs`). The server decides
 * at every read whether a library is lent; this page only follows what it answers.
 */
export const MUSIC_SHARING_URL = "/api/music/sharing";
const LIBRARIES_URL = `${MUSIC_SHARING_URL}/libraries`;
/** Pieces one read asks for: what the drive's route answers at most. */
const PIECES_PER_READ = 8;

export interface SharedPerson {
  /** The account name, which names the library in the routes. */
  name: string;
  full_name: string;
}

export interface SharedLibrary {
  owner: SharedPerson;
  songs: LibrarySong[];
  playlists: Pick<LibraryPlaylist, "id" | "name" | "songs">[];
}

/** The library's owner turned it off, or was never sharing. */
export class NotSharedError extends Error {
  constructor() {
    super("This library is no longer shared.");
    this.name = "NotSharedError";
  }
}

const refusedOr = (answer: Response, what: string) => {
  if (answer.status === 403) throw new NotSharedError();
  if (!answer.ok) throw new Error(`${what} could not be read (${answer.status}).`);
};

/** The id a borrowed song goes by here, which no song of a library can have: a library's ids hold no slash. */
export const borrowedId = (owner: string, song: string) => `shared/${owner}/${song}`;

/** The owner a borrowed song's id names, or `null` for any other id. */
export function ownerOfBorrowed(id: string): string | null {
  const [start, owner, song, ...rest] = id.split("/");
  return start === "shared" && owner && song && rest.length === 0 ? owner : null;
}

/** The URL of the song a borrowed id names. */
function songUrl(id: string): string | null {
  const [, owner, song] = id.split("/");
  return ownerOfBorrowed(id) === null || !owner || !song
    ? null
    : `${LIBRARIES_URL}/${encodeURIComponent(owner)}/songs/${encodeURIComponent(song)}`;
}

export async function readSharingOn(): Promise<boolean> {
  const answer = await sessionFetch(MUSIC_SHARING_URL);
  if (!answer.ok) return false;
  const { on } = (await answer.json()) as { on?: unknown };
  return on === true;
}

/** Turns the person's own sharing on or off, and answers what the server now holds. */
export async function writeSharingOn(on: boolean): Promise<boolean> {
  const answer = await sessionFetch(MUSIC_SHARING_URL, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ on }),
  });
  if (!answer.ok) throw new Error(`Home Sharing could not be changed (${answer.status}).`);
  const held = (await answer.json()) as { on?: unknown };
  return held.on === true;
}

/** Those sharing with this person now. */
export async function readSharedPeople(): Promise<SharedPerson[]> {
  const answer = await sessionFetch(LIBRARIES_URL);
  refusedOr(answer, "Shared libraries");
  const { libraries } = (await answer.json()) as { libraries: SharedPerson[] };
  return libraries;
}

interface LentSource {
  kind: string;
  type?: string;
  size?: number;
}

/** One lent song, made a song the player can hold. A drive song names no file: its `file` is its
 * own borrowed id, which `readSharedFile` turns into the route that names the song. */
function borrowedSong(owner: string, lent: LibrarySong & { source: LentSource }): LibrarySong {
  const id = borrowedId(owner, lent.id);
  const source: LibrarySong["source"] =
    lent.source.kind === "file"
      ? {
          kind: "file",
          file: id,
          name: lent.title,
          type: lent.source.type ?? "audio/mpeg",
          size: lent.source.size ?? 0,
        }
      : (lent.source as LibrarySong["source"]);
  return { ...lent, id, added: 0, artwork: null, source };
}

export async function readSharedLibrary(owner: string): Promise<SharedLibrary> {
  const answer = await sessionFetch(`${LIBRARIES_URL}/${encodeURIComponent(owner)}`);
  refusedOr(answer, "The shared library");
  const body = (await answer.json()) as SharedPerson & {
    songs: (LibrarySong & { source: LentSource })[];
    playlists: SharedLibrary["playlists"];
  };
  return {
    owner: { name: body.name, full_name: body.full_name },
    songs: body.songs.map((song) => borrowedSong(body.name, song)),
    playlists: body.playlists.map((list) => ({
      ...list,
      songs: list.songs.map((song) => borrowedId(body.name, song)),
    })),
  };
}

/** Whether a read in the player's name is a borrowed song's. */
export const isBorrowedFile = (file: string) => ownerOfBorrowed(file) !== null;

/** A borrowed song's bytes, joined from its pieces. Refused the moment its owner stops sharing. */
export async function readSharedFile(file: string): Promise<Blob> {
  const url = songUrl(file);
  if (!url) throw new Error("That is not a shared song.");
  const parts: ArrayBuffer[] = [];
  for (let piece = 0, pieces = 1; piece < pieces; piece += PIECES_PER_READ) {
    const answer = await sessionFetch(`${url}?piece=${piece}&count=${PIECES_PER_READ}`);
    refusedOr(answer, "The song");
    pieces = Number(answer.headers.get("x-file-pieces") ?? 0);
    parts.push(await answer.arrayBuffer());
  }
  return new Blob(parts);
}

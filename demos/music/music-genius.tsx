"use client";

import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import type { LibrarySong } from "./music-server";

/** How long a Genius playlist may be, as the pop-up over one offers it. */
export const GENIUS_SIZES = [25, 50, 75, 100] as const;
export const GENIUS_SIZE = GENIUS_SIZES[0];

/** The song a Genius playlist was made from and how long it is, by the playlist's id. */
export type GeniusLists = Readonly<Record<string, { seed: string; size: number }>>;

export const NO_GENIUS_LISTS: GeniusLists = {};
const readLists = new WeakMap<object, GeniusLists>();

/** The Genius playlists kept; anything that is not one is left out. */
export function readGeniusLists(stored: unknown): GeniusLists | undefined {
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return undefined;
  const known = readLists.get(stored);
  if (known) return known;
  const lists = Object.fromEntries(
    Object.entries(stored).filter(
      ([, list]) =>
        typeof list?.seed === "string" && (GENIUS_SIZES as readonly number[]).includes(list?.size),
    ),
  ) as GeniusLists;
  readLists.set(stored, lists);
  return lists;
}

const same = (one: string, other: string) =>
  one.trim() !== "" && one.trim().toLocaleLowerCase() === other.trim().toLocaleLowerCase();

/** What a Genius playlist weighs beyond the song itself. */
export interface GeniusFacts {
  plays: Readonly<Record<string, number>>;
  loved: ReadonlySet<string>;
}

/**
 * The song `seed` and, after it, the songs of the library that share its artist or genre: the artist
 * counts for more, then what the person loved, rated highly and played most. Disliked songs and those
 * whose checkbox is cleared stay out. Only the seed itself would be there: answers nothing.
 */
export function geniusSongs(
  seed: LibrarySong,
  songs: readonly LibrarySong[],
  facts: GeniusFacts,
  size: number = GENIUS_SIZE,
): string[] {
  const weigh = (song: LibrarySong) =>
    (same(song.artist, seed.artist) ? 8 : 0) +
    (same(song.genre, seed.genre) ? 4 : 0) +
    (facts.loved.has(song.id) ? 2 : 0) +
    ((song.rating ?? 0) >= 4 ? 1 : 0);
  const near = songs
    .filter(
      (song) =>
        song.id !== seed.id &&
        !song.disliked &&
        !song.unchecked &&
        (same(song.artist, seed.artist) || same(song.genre, seed.genre)),
    )
    .sort(
      (a, b) =>
        weigh(b) - weigh(a) ||
        (facts.plays[b.id] ?? 0) - (facts.plays[a.id] ?? 0) ||
        a.title.localeCompare(b.title),
    );
  return near.length === 0 ? [] : [seed.id, ...near.slice(0, size - 1).map((song) => song.id)];
}

/** A Genius playlist's name, which says what it was made from. */
export const geniusName = (seed: LibrarySong) => `Genius: ${seed.title}`;

/** Over a Genius playlist: what it is made from, how long it is, and Refresh. */
export function GeniusControls({
  seedTitle,
  size,
  onSize,
  onRefresh,
}: {
  /** The song it was made from; `null` once that song has left the library. */
  seedTitle: string | null;
  size: number;
  onSize: (size: number) => void;
  onRefresh: () => void;
}) {
  const gone = "The song this playlist was made from is no longer in your library.";
  return (
    <>
      <PopUpButton
        aria-label="Limit Genius playlist"
        size="small"
        value={String(size)}
        disabled={seedTitle === null}
        title={seedTitle === null ? gone : undefined}
        onValueChange={(next) => {
          if (next != null) onSize(Number(next));
        }}
      >
        {GENIUS_SIZES.map((each) => (
          <PopUpButtonItem key={each} value={String(each)}>
            {each} songs
          </PopUpButtonItem>
        ))}
      </PopUpButton>
      <PushButton
        disabled={seedTitle === null}
        title={seedTitle ? undefined : gone}
        onClick={onRefresh}
      >
        Refresh
      </PushButton>
      <Label textStyle="small" color="secondary" role="note" className="mac-music-genius-note">
        Made on this desktop from the artist and genre of {seedTitle ? `“${seedTitle}”` : "a song"}{" "}
        and your own library. Apple's Genius service is not part of it.
      </Label>
    </>
  );
}

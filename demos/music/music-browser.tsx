"use client";

import { ListView } from "macalicious/list-view";
import type { LibrarySong } from "./music-server";

/** What the Column Browser has chosen: each `null` is its All row. */
export interface BrowserChoice {
  genre: string | null;
  artist: string | null;
  album: string | null;
}

export const BROWSE_ALL: BrowserChoice = { genre: null, artist: null, album: null };

/** The albums chosen together in a grid, and the one a Shift-click reaches from. */
export interface AlbumsChosen {
  ids: readonly string[];
  anchor: string | null;
}

export const NO_ALBUMS: AlbumsChosen = { ids: [], anchor: null };

/** What a Command-click (toggles) or Shift-click (reaches from the anchor) leaves chosen. */
export function albumsAfter(
  now: AlbumsChosen,
  order: readonly string[],
  id: string,
  range: boolean,
): AlbumsChosen {
  const from = now.anchor === null ? -1 : order.indexOf(now.anchor);
  const to = order.indexOf(id);
  if (range && from >= 0 && to >= 0) {
    return { ids: order.slice(Math.min(from, to), Math.max(from, to) + 1), anchor: now.anchor };
  }
  return {
    ids: now.ids.includes(id) ? now.ids.filter((each) => each !== id) : [...now.ids, id],
    anchor: id,
  };
}

const sortedSet = (values: readonly string[]) =>
  [...new Set(values)].sort((a, b) => a.localeCompare(b));

/**
 * The columns and the songs a choice leaves. Each column lists what the columns before it leave, and
 * a choice its column no longer lists counts as All.
 */
export function browseSongs(songs: readonly LibrarySong[], choice: BrowserChoice) {
  const genres = sortedSet(songs.map((song) => song.genre));
  const genre = choice.genre !== null && genres.includes(choice.genre) ? choice.genre : null;
  const ofGenre = genre === null ? songs : songs.filter((song) => song.genre === genre);
  const artists = sortedSet(ofGenre.map((song) => song.artist));
  const artist = choice.artist !== null && artists.includes(choice.artist) ? choice.artist : null;
  const ofArtist = artist === null ? ofGenre : ofGenre.filter((song) => song.artist === artist);
  const albums = sortedSet(ofArtist.map((song) => song.album));
  const album = choice.album !== null && albums.includes(choice.album) ? choice.album : null;
  return {
    genres,
    artists,
    albums,
    choice: { genre, artist, album },
    songs: album === null ? ofArtist : ofArtist.filter((song) => song.album === album),
  };
}

function BrowserColumn({
  label,
  plural,
  values,
  chosen,
  unknown,
  onChoose,
}: {
  label: string;
  plural: string;
  values: readonly string[];
  chosen: string | null;
  unknown: string;
  onChoose: (value: string | null) => void;
}) {
  const titleOf = (index: number) =>
    index === 0
      ? `All (${values.length} ${values.length === 1 ? label : plural})`
      : values[index - 1] || unknown;
  return (
    <ListView
      aria-label={plural}
      className="mac-music-browser-column"
      count={values.length + 1}
      rowHeight={20}
      selectionMode="single"
      emphasis="always"
      value={[chosen === null ? 0 : values.indexOf(chosen) + 1]}
      onValueChange={(next) => {
        const index = next[0];
        if (typeof index !== "number") return;
        onChoose(index === 0 ? null : (values[index - 1] ?? null));
      }}
      getRowLabel={titleOf}
      renderRow={(index) => <span className="mac-music-browser-row">{titleOf(index)}</span>}
    />
  );
}

/** View > Column Browser, above the Songs list: Genres, Artists and Albums narrow it. */
export function ColumnBrowser({
  songs,
  choice,
  onChoice,
}: {
  songs: readonly LibrarySong[];
  choice: BrowserChoice;
  onChoice: (choice: BrowserChoice) => void;
}) {
  const shown = browseSongs(songs, choice);
  return (
    // biome-ignore lint/a11y/useSemanticElements: three lists, not the controls of a form
    <div className="mac-music-browser" role="group" aria-label="Column Browser">
      <BrowserColumn
        label="Genre"
        plural="Genres"
        unknown="Unknown Genre"
        values={shown.genres}
        chosen={shown.choice.genre}
        onChoose={(genre) => onChoice({ genre, artist: null, album: null })}
      />
      <BrowserColumn
        label="Artist"
        plural="Artists"
        unknown="Unknown Artist"
        values={shown.artists}
        chosen={shown.choice.artist}
        onChoose={(artist) => onChoice({ ...shown.choice, artist, album: null })}
      />
      <BrowserColumn
        label="Album"
        plural="Albums"
        unknown="Unknown Album"
        values={shown.albums}
        chosen={shown.choice.album}
        onChoose={(album) => onChoice({ ...shown.choice, album })}
      />
    </div>
  );
}

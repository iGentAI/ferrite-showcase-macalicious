"use client";

import { BorderlessButton } from "macalicious/borderless-button";
import { Checkbox } from "macalicious/checkbox";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator } from "macalicious/menu-item";
import { PushButton } from "macalicious/push-button";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { TableView, type TableViewColumn, type TableViewSort } from "macalicious/table-view";
import { TextField } from "macalicious/text-field";
import { type HTMLAttributes, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { LinkShareItems } from "../desktop/desktop-share-link";
import { formatDuration } from "./music-data";
import {
  type LibraryPlaylist,
  type LibrarySong,
  UNKNOWN_ALBUM,
  UNKNOWN_ARTIST,
} from "./music-server";

/** What a row's menu, or its Loved button, asks of the window. */
export type SongAction =
  | {
      type:
        | "play-next"
        | "play-later"
        | "love"
        | "delete"
        | "copy"
        | "show-in-finder"
        | "info"
        | "dislike"
        | "show-in-album";
      ids: readonly string[];
    }
  | { type: "rate"; ids: readonly string[]; stars: number | null }
  | { type: "check"; ids: readonly string[]; checked: boolean }
  | { type: "add-to-playlist"; ids: readonly string[]; playlist: string | null }
  | { type: "remove-from-playlist"; ids: readonly string[]; playlist: string };

/** The web address of a song, when it has one: an Internet Archive item's page. */
export const songLink = (song: LibrarySong): string =>
  song.source.kind === "archive"
    ? `https://archive.org/details/${encodeURIComponent(song.source.item)}`
    : "";

/** The value the songs share, or `null` when they differ or have none. */
export function sharedRating(songs: readonly LibrarySong[]): number | null {
  const [first, ...rest] = songs.map((song) => song.rating ?? null);
  return rest.every((stars) => stars === first) ? (first ?? null) : null;
}

/** Song > Rating, and a song's menu: None or one to five stars. */
export function RatingSubmenu({
  value,
  disabled,
  onChange,
}: {
  value: number | null;
  disabled?: boolean;
  onChange: (stars: number | null) => void;
}) {
  return (
    <Submenu>
      <SubmenuTrigger disabled={disabled}>Rating</SubmenuTrigger>
      <SubmenuPopup>
        <MenuRadioGroup
          value={String(value ?? 0)}
          onValueChange={(next) => onChange(Number(next) || null)}
        >
          <MenuRadioItem value="0">None</MenuRadioItem>
          {[1, 2, 3, 4, 5].map((stars) => (
            <MenuRadioItem key={stars} value={String(stars)}>
              {"★".repeat(stars)}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </SubmenuPopup>
    </Submenu>
  );
}

/** A song's or an album's Add to Playlist. */
function AddToPlaylist({
  ids,
  playlists,
  act,
}: {
  ids: readonly string[];
  playlists: readonly LibraryPlaylist[];
  act: (action: SongAction) => void;
}) {
  return (
    <Submenu>
      <SubmenuTrigger>Add to Playlist</SubmenuTrigger>
      <SubmenuPopup>
        <MenuItem onClick={() => act({ type: "add-to-playlist", ids, playlist: null })}>
          New Playlist
        </MenuItem>
        {playlists.length > 0 ? <MenuSeparator /> : null}
        {playlists.map((list) => (
          <MenuItem
            key={list.id}
            disabled={ids.every((id) => list.songs.includes(id))}
            onClick={() => act({ type: "add-to-playlist", ids, playlist: list.id })}
          >
            {list.name}
          </MenuItem>
        ))}
      </SubmenuPopup>
    </Submenu>
  );
}

/** The menu of the album under the pointer, in a grid of albums, or of the artist whose heading it
 * is on. */
export function AlbumMenu({
  albums,
  chosen,
  loved,
  playlists,
  onPlay,
  onAction,
  children,
}: {
  albums: readonly {
    id: string;
    title: string;
    artist?: string;
    songs: readonly { id: string }[];
  }[];
  /** The albums chosen together: a menu on one of them acts on them all. */
  chosen?: readonly string[];
  loved: ReadonlySet<string>;
  playlists: readonly LibraryPlaylist[];
  onPlay: (ids: readonly string[]) => void;
  onAction: (action: SongAction) => void;
  children: ReactNode;
}) {
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [artist, setArtist] = useState<string | null>(null);
  const album = albums.find((one) => one.id === albumId);
  const together =
    albumId !== null && chosen?.includes(albumId) ? chosen : albumId ? [albumId] : [];
  const ids = albums
    .filter((one) => (artist !== null ? one.artist === artist : together.includes(one.id)))
    .flatMap((one) => one.songs.map((song) => song.id));
  return (
    <ContextualMenu>
      <ContextualMenuTrigger
        className="mac-music-sidebar-menu"
        onContextMenu={(event) => {
          const target = event.target as Element;
          const card = target.closest<HTMLElement>("[data-album]");
          setAlbumId(card?.dataset.album ?? null);
          setArtist(
            target.closest(".mac-card-grid-header")
              ? (target.closest<HTMLElement>("[data-artist]")?.dataset.artist ?? null)
              : null,
          );
        }}
      >
        {children}
      </ContextualMenuTrigger>
      <ContextualMenuPopup aria-label={artist ?? album?.title ?? "Albums"}>
        {album || artist !== null ? (
          <>
            <MenuItem onClick={() => onPlay(ids)}>Play</MenuItem>
            <MenuItem onClick={() => onAction({ type: "play-next", ids })}>Play Next</MenuItem>
            <MenuItem onClick={() => onAction({ type: "play-later", ids })}>Play Later</MenuItem>
            <MenuSeparator />
            <MenuItem onClick={() => onAction({ type: "love", ids })}>
              {ids.every((id) => loved.has(id)) ? "Unlove" : "Love"}
            </MenuItem>
            <AddToPlaylist ids={ids} playlists={playlists} act={onAction} />
            <MenuSeparator />
            <MenuItem onClick={() => onAction({ type: "info", ids })}>
              {artist !== null ? "Get Info" : "Album Info"}
            </MenuItem>
            <MenuItem onClick={() => onAction({ type: "copy", ids })}>Copy</MenuItem>
            <MenuSeparator />
            <MenuItem onClick={() => onAction({ type: "delete", ids })}>
              Delete from Library
            </MenuItem>
          </>
        ) : (
          <MenuItem disabled>No Album Selected</MenuItem>
        )}
      </ContextualMenuPopup>
    </ContextualMenu>
  );
}

/** A heart, filled when loved: original drawing. */
export function HeartGlyph({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 12 11" width="12" height="11" aria-hidden="true">
      <path
        d="M6 10.2 1.6 5.8A2.6 2.6 0 0 1 5.3 2.1l.7.7.7-.7a2.6 2.6 0 0 1 3.7 3.7z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}

/** The speaker beside the song playing: original drawing. */
function SpeakerGlyph() {
  return (
    <svg viewBox="0 0 12 10" width="12" height="10" aria-hidden="true">
      <path d="M1 3.5h2.2L6 1v8L3.2 6.5H1z" fill="currentColor" />
      <path d="M8 3a3 3 0 0 1 0 4M9.6 1.6a5 5 0 0 1 0 6.8" fill="none" stroke="currentColor" />
    </svg>
  );
}

const COLUMNS: TableViewColumn[] = [
  { id: "check", width: 24, align: "center" },
  { id: "loved", width: 26, align: "center" },
  { id: "title", title: "Title", sortable: true },
  { id: "time", title: "Time", width: 50, align: "right", sortable: true },
  { id: "artist", title: "Artist", width: 150, sortable: true },
  { id: "album", title: "Album", width: 170, sortable: true },
  { id: "genre", title: "Genre", width: 90, sortable: true },
  { id: "plays", title: "Plays", width: 50, align: "right", sortable: true },
  { id: "year", title: "Year", width: 50, align: "right", sortable: true },
  { id: "rating", title: "Rating", width: 70, sortable: true },
  { id: "added", title: "Date Added", width: 90, sortable: true },
];

/** The columns View Options can show or hide. */
export const OPTIONAL_COLUMNS = COLUMNS.filter(
  (column): column is TableViewColumn & { title: string } =>
    typeof column.title === "string" && column.id !== "title",
);
/** What a list can be sorted by. */
export const SORTABLE_COLUMNS = COLUMNS.filter(
  (column): column is TableViewColumn & { title: string } => typeof column.title === "string",
);
/** The columns shown until the person chooses. */
export const DEFAULT_COLUMNS: readonly string[] = ["time", "artist", "album", "genre", "plays"];
export const DEFAULT_SORT: TableViewSort = { column: "title", direction: "ascending" };

/** The sort kept for the song lists, when it is whole. */
export function readSort(stored: unknown): TableViewSort | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { column, direction } = stored as Partial<TableViewSort>;
  return SORTABLE_COLUMNS.some(({ id }) => id === column) &&
    (direction === "ascending" || direction === "descending")
    ? { column: column as string, direction }
    : undefined;
}

export interface SongTableProps {
  /** The songs, in the order of the view (a playlist's own order). */
  songs: readonly LibrarySong[];
  /** Accessible name of the table. */
  label: string;
  loved: ReadonlySet<string>;
  plays: Readonly<Record<string, number>>;
  playlists: readonly LibraryPlaylist[];
  /** The song loaded in the player. */
  currentId: string | null;
  /** The playlist shown, whose songs can be removed from it. */
  playlist?: string;
  /** Sorted by title at first, or kept in the view's order until a heading is clicked. */
  sorted?: boolean;
  /** The optional columns shown. */
  columns?: readonly string[];
  /** Shows a checkbox on each song (Preferences, Songs list checkboxes). */
  checkboxes?: boolean;
  /** Offers ratings: the column and the row menu's Rating (Preferences, Star ratings). */
  ratings?: boolean;
  /** The sort of a list that is `sorted`, kept for the person; else the table keeps its own. */
  savedSort?: TableViewSort;
  onSavedSort?: (sort: TableViewSort) => void;
  rowHeight: number;
  /** The ids of the selected songs, when the window holds them; the table's own otherwise. */
  selection?: readonly string[];
  /** Called with the ids of the songs selected. */
  onSelectionChange?: (ids: readonly string[]) => void;
  /** A song to scroll to: a new object each time it is asked for. */
  reveal?: { id: string } | null;
  /** A press on a row that may become a drag of `ids`: `reselect` keeps them selected once it does. */
  onSongPress?: (
    down: globalThis.PointerEvent,
    ids: readonly string[],
    reselect: () => void,
  ) => void;
  /** Called with the songs as listed and the one to start at. */
  onPlay: (ids: string[], index: number) => void;
  onAction: (action: SongAction) => void;
}

function sortKey(song: LibrarySong, column: string, plays: Readonly<Record<string, number>>) {
  if (column === "time") return song.duration;
  if (column === "artist") return (song.sortArtist || song.artist || UNKNOWN_ARTIST).toLowerCase();
  if (column === "album") return (song.sortAlbum || song.album || UNKNOWN_ALBUM).toLowerCase();
  if (column === "genre") return song.genre.toLowerCase();
  if (column === "plays") return plays[song.id] ?? 0;
  if (column === "year") return song.year ?? 0;
  if (column === "rating") return song.rating ?? 0;
  if (column === "added") return song.added;
  return (song.sortName || song.title).toLowerCase();
}

/**
 * The songs of a library view: a sortable table played by a double click or Return, with
 * Shift and Command selection, a Loved button on each row and a contextual menu (Play Next, Play
 * Later, Love, Add to Playlist, Show in Finder, Copy, Remove from Playlist, Delete from Library).
 * A menu opened on a selected song acts on the whole selection, and on any other song selects
 * that song first, as in Music.
 */
export function SongTable({
  songs,
  label,
  loved,
  plays,
  playlists,
  currentId,
  playlist,
  sorted = true,
  columns = DEFAULT_COLUMNS,
  checkboxes = false,
  ratings = true,
  savedSort,
  onSavedSort,
  rowHeight,
  selection,
  onSelectionChange,
  reveal,
  onSongPress,
  onPlay,
  onAction,
}: SongTableProps) {
  const [ownSort, setOwnSort] = useState<TableViewSort | undefined>(
    sorted ? DEFAULT_SORT : undefined,
  );
  const kept = sorted && savedSort !== undefined;
  const sort = kept ? savedSort : ownSort;
  const setSort = kept && onSavedSort ? onSavedSort : setOwnSort;
  const shownColumns = useMemo(
    () =>
      COLUMNS.filter((column) => {
        if (column.id === "check") return checkboxes;
        if (column.id === "rating" && !ratings) return false;
        return column.id === "loved" || column.id === "title" || columns.includes(column.id);
      }),
    [columns, checkboxes, ratings],
  );
  const rows = useMemo(() => {
    if (!sort) return [...songs];
    const sign = sort.direction === "ascending" ? 1 : -1;
    return [...songs].sort((a, b) => {
      const [left, right] = [sortKey(a, sort.column, plays), sortKey(b, sort.column, plays)];
      return left < right ? -sign : left > right ? sign : 0;
    });
  }, [songs, sort, plays]);
  const [ownSelection, setOwnSelection] = useState<readonly string[]>([]);
  const selected = selection ?? ownSelection;
  const select = (ids: readonly string[]) => {
    setOwnSelection(ids);
    onSelectionChange?.(ids);
  };
  // The songs the menu was opened on, by id: the rows may be re-sorted, or songs deleted, while
  // it is open, and every action stays with those songs (or with none, once they are gone).
  const [menuIds, setMenuIds] = useState<readonly string[]>([]);
  const targets = menuIds.filter((id) => songs.some((song) => song.id === id));
  const target = songs.find((song) => song.id === targets[0]);
  const [menuOpen, setMenuOpen] = useState(false);
  // The songs the menu was opened on are gone (deleted, or out of this view): the menu closes,
  // so no command is left on screen for them.
  const gone = menuIds.length > 0 && targets.length === 0;
  useEffect(() => {
    if (gone) setMenuOpen(false);
  }, [gone]);
  const act = (action: SongAction) => onAction(action);
  const viewport = useRef<HTMLDivElement>(null);
  // Only a new request scrolls: the person's own scrolling is not undone by a change of rows.
  const rowsNow = useRef(rows);
  rowsNow.current = rows;
  useEffect(() => {
    if (!reveal || !viewport.current) return;
    const row = rowsNow.current.findIndex((song) => song.id === reveal.id);
    if (row >= 0) viewport.current.scrollTop = Math.max(0, row * rowHeight - rowHeight * 2);
  }, [reveal, rowHeight]);
  const allLoved = targets.length > 0 && targets.every((id) => loved.has(id));
  const targetSongs = songs.filter((song) => targets.includes(song.id));

  return (
    <ContextualMenu open={menuOpen && !gone} onOpenChange={(open) => setMenuOpen(open)}>
      <ContextualMenuTrigger
        className="mac-music-desktop-fill"
        onContextMenu={(event) => {
          const row = (event.target as Element).closest("[data-row]");
          const song = row ? rows[Number(row.getAttribute("data-row"))] : undefined;
          if (!row) setMenuIds(selected);
          else if (!song) setMenuIds([]);
          else if (selected.includes(song.id)) setMenuIds(selected);
          else {
            select([song.id]);
            setMenuIds([song.id]);
          }
        }}
      >
        <TableView
          aria-label={label}
          data-song-order={sort ? "sorted" : "own"}
          selectionMode="multiple"
          value={selected}
          onValueChange={(value) => select(value.map(String))}
          viewportRef={viewport}
          columns={shownColumns}
          rowCount={rows.length}
          rowHeight={rowHeight}
          alternatingRows
          getRowId={(row) => rows[row]?.id ?? row}
          getRowLabel={(row) => rows[row]?.title ?? ""}
          getRowProps={(row) => {
            const song = rows[row];
            if (!song) return undefined;
            return {
              "data-song": song.id,
              ...(song.id === currentId ? { "aria-current": "true" } : {}),
              onPointerDown: (event) => {
                if (event.button !== 0 || (event.target as Element).closest("button")) return;
                const held = selected.includes(song.id) ? selected : [song.id];
                onSongPress?.(event.nativeEvent, held, () => {
                  if (held.length > 1) select(held);
                });
              },
            } as HTMLAttributes<HTMLDivElement>;
          }}
          renderCell={(row, column) => {
            const song = rows[row];
            if (!song) return null;
            switch (column.id) {
              case "check":
                return (
                  <Checkbox
                    size="small"
                    aria-label={`Play ${song.title}`}
                    checked={!song.unchecked}
                    onCheckedChange={(checked) => act({ type: "check", ids: [song.id], checked })}
                  />
                );
              case "loved": {
                const isLoved = loved.has(song.id);
                return (
                  <BorderlessButton
                    aria-label={isLoved ? `Unlove ${song.title}` : `Love ${song.title}`}
                    aria-pressed={isLoved}
                    onClick={() => act({ type: "love", ids: [song.id] })}
                  >
                    <HeartGlyph filled={isLoved} />
                  </BorderlessButton>
                );
              }
              case "title":
                return song.id === currentId ? (
                  <span className="mac-music-desktop-now">
                    <SpeakerGlyph />
                    {song.title}
                  </span>
                ) : (
                  song.title
                );
              case "time":
                return song.duration > 0 ? formatDuration(song.duration) : "";
              case "artist":
                return song.artist || UNKNOWN_ARTIST;
              case "album":
                return song.album || UNKNOWN_ALBUM;
              case "genre":
                return song.genre;
              case "plays":
                return plays[song.id] ? String(plays[song.id]) : "";
              case "year":
                return song.year ? String(song.year) : "";
              case "rating":
                return song.rating ? "★".repeat(song.rating) : "";
              case "added":
                return new Date(song.added).toLocaleDateString();
              default:
                return null;
            }
          }}
          sort={sort}
          onSortChange={setSort}
          onRowAction={(row) =>
            onPlay(
              rows.map((song) => song.id),
              row,
            )
          }
          style={{ height: "100%" }}
        />
      </ContextualMenuTrigger>
      <ContextualMenuPopup
        aria-label={
          targets.length > 1 ? `${targets.length} songs` : target ? `${target.title}` : "Songs"
        }
      >
        {target ? (
          <>
            <MenuItem
              onClick={() => {
                // The first of the songs as listed: several selected play from there.
                const ids = rows.map((song) => song.id);
                const at = ids.findIndex((id) => targets.includes(id));
                if (at >= 0) onPlay(ids, at);
              }}
            >
              Play
            </MenuItem>
            <MenuItem onClick={() => act({ type: "play-next", ids: targets })}>Play Next</MenuItem>
            <MenuItem onClick={() => act({ type: "play-later", ids: targets })}>
              Play Later
            </MenuItem>
            <MenuSeparator />
            <MenuItem onClick={() => act({ type: "love", ids: targets })}>
              {allLoved ? "Unlove" : "Love"}
            </MenuItem>
            <MenuItem onClick={() => act({ type: "dislike", ids: targets })}>
              {targetSongs.every((song) => song.disliked) ? "Undo Dislike" : "Dislike"}
            </MenuItem>
            {ratings ? (
              <RatingSubmenu
                value={sharedRating(targetSongs)}
                onChange={(stars) => act({ type: "rate", ids: targets, stars })}
              />
            ) : null}
            {checkboxes ? (
              <>
                <MenuItem onClick={() => act({ type: "check", ids: targets, checked: true })}>
                  Check Selection
                </MenuItem>
                <MenuItem onClick={() => act({ type: "check", ids: targets, checked: false })}>
                  Uncheck Selection
                </MenuItem>
              </>
            ) : null}
            <AddToPlaylist ids={targets} playlists={playlists} act={act} />
            {playlist ? (
              <MenuItem
                onClick={() => act({ type: "remove-from-playlist", ids: targets, playlist })}
              >
                Remove from Playlist
              </MenuItem>
            ) : null}
            <MenuSeparator />
            <MenuItem onClick={() => act({ type: "info", ids: targets })}>Song Info</MenuItem>
            <MenuItem
              disabled={targets.length !== 1}
              onClick={() => act({ type: "show-in-album", ids: targets })}
            >
              Show in Album
            </MenuItem>
            <MenuItem
              disabled={targets.length !== 1 || target.source.kind !== "file"}
              onClick={() => act({ type: "show-in-finder", ids: targets })}
            >
              Show in Finder
            </MenuItem>
            <MenuItem onClick={() => act({ type: "copy", ids: targets })}>Copy</MenuItem>
            <Submenu>
              <SubmenuTrigger disabled={targets.length !== 1}>Share Song</SubmenuTrigger>
              <SubmenuPopup>
                <LinkShareItems plain url={songLink(target)} title={target.title} from="music" />
              </SubmenuPopup>
            </Submenu>
            <MenuSeparator />
            <MenuItem onClick={() => act({ type: "delete", ids: targets })}>
              Delete from Library
            </MenuItem>
          </>
        ) : (
          <MenuItem disabled>No Song Selected</MenuItem>
        )}
      </ContextualMenuPopup>
    </ContextualMenu>
  );
}

export interface ListHeaderProps {
  /** The view's name: a playlist's can be renamed. */
  title: string;
  /** Songs and minutes. */
  songs: readonly LibrarySong[];
  /** Called with a new name; without it the title cannot be edited. */
  onRename?: (name: string) => void;
  /** Start with the title being edited. */
  renaming?: boolean;
  /** The edit the title started with, or any later one, has ended. */
  onRenameEnd?: () => void;
  onPlay: () => void;
  onShuffle: () => void;
  /** Further buttons (Delete Playlist). */
  children?: ReactNode;
}

/** The heading of a playlist: its name, how many songs and minutes, Play and Shuffle. */
export function ListHeader({
  title,
  songs,
  onRename,
  renaming = false,
  onRenameEnd,
  onPlay,
  onShuffle,
  children,
}: ListHeaderProps) {
  const [editing, setEditing] = useState<string | null>(renaming ? title : null);
  const minutes = Math.round(songs.reduce((sum, song) => sum + song.duration, 0) / 60);
  const commit = () => {
    const name = editing?.trim();
    if (name && name !== title) onRename?.(name);
    setEditing(null);
    onRenameEnd?.();
  };
  return (
    <header className="mac-music-desktop-header">
      {editing !== null ? (
        <TextField
          aria-label="Playlist name"
          className="mac-music-desktop-rename"
          value={editing}
          autoFocus
          maxLength={200}
          onChange={(event) => setEditing(event.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
            if (event.key === "Escape") {
              setEditing(null);
              onRenameEnd?.();
            }
          }}
        />
      ) : (
        <h2
          className="mac-music-desktop-title"
          onDoubleClick={onRename ? () => setEditing(title) : undefined}
        >
          {title}
        </h2>
      )}
      <div className="mac-music-desktop-facts">
        {songs.length} {songs.length === 1 ? "song" : "songs"}, {minutes}{" "}
        {minutes === 1 ? "minute" : "minutes"}
      </div>
      <div className="mac-music-desktop-buttons">
        <PushButton disabled={songs.length === 0} onClick={onPlay}>
          Play
        </PushButton>
        <PushButton disabled={songs.length === 0} onClick={onShuffle}>
          Shuffle
        </PushButton>
        {onRename ? <PushButton onClick={() => setEditing(title)}>Rename</PushButton> : null}
        {children}
      </div>
    </header>
  );
}

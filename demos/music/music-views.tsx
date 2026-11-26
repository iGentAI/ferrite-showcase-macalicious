"use client";

import { CardGrid, CardGridCard } from "macalicious/card-grid";
import { Checkbox } from "macalicious/checkbox";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { EmptyState } from "macalicious/empty-state";
import { ListView, ListViewRowDetail, ListViewRowTitle } from "macalicious/list-view";
import { MenuItem } from "macalicious/menu-item";
import { PushButton } from "macalicious/push-button";
import { Segment, SegmentedControl } from "macalicious/segmented-control";
import { TableView, type TableViewColumn, type TableViewSort } from "macalicious/table-view";
import {
  type CSSProperties,
  type PointerEvent,
  useCallback,
  useId,
  useMemo,
  useState,
} from "react";
import { AlbumCover } from "./music-artwork";
import { formatDuration, type MusicAlbum, type MusicTrack } from "./music-data";

/**
 * The album grid's side margin. The artwork starts 39 pt after the pane's divider in the
 * reference screenshots; the card grid's own default is the 40 pt of TV.
 */
const GRID: CSSProperties = { ["--mac-card-grid-margin" as string]: "39px" };
/** Row pitch of the song tables in points, at the medium list size; also the header's height. */
const ROW = 24;
/** How far a press on an Up Next row moves before it is a drag, in points. */
const DRAG_START = 4;

export interface AlbumGridProps {
  /** The albums, in the order shown. */
  albums: readonly MusicAlbum[];
  /** The albums chosen together, with Command or Shift. */
  chosen?: readonly string[];
  /** Called on a press on a card, which may become a drag. */
  onCardPress?: (down: globalThis.PointerEvent, album: MusicAlbum) => void;
  /** The artist this section is of: its heading is then that artist, with a menu and a drag. */
  artist?: string;
  /** Called on a press on the heading of an artist's section, which may become a drag. */
  onArtistPress?: (down: globalThis.PointerEvent, artist: string) => void;
  /** The section's heading. Without it the grid is named by `label`. */
  title?: string;
  /** Accessible name of a grid without a heading. */
  label?: string;
  /** Draws the line that divides this section from the one above. */
  separator?: boolean;
  /** The album whose details are open. */
  selectedId: string | null;
  /** Called with an album's id when its card is chosen, and how the click asks to choose it. */
  onSelect: (id: string, how: { add: boolean; range: boolean }) => void;
  /** Called with an album when its card is double-clicked. */
  onPlay: (album: MusicAlbum) => void;
}

/** A grid of album cells: the library's card grid with square cards that are buttons. */
export function AlbumGrid({
  albums,
  chosen,
  onCardPress,
  artist,
  onArtistPress,
  title,
  label,
  separator,
  selectedId,
  onSelect,
  onPlay,
}: AlbumGridProps) {
  return (
    <CardGrid
      title={title}
      aria-label={title ? undefined : label}
      separator={separator}
      style={GRID}
      data-artist={artist}
      onPointerDown={(event) => {
        if (
          artist !== undefined &&
          event.button === 0 &&
          (event.target as Element).closest(".mac-card-grid-header")
        ) {
          onArtistPress?.(event.nativeEvent, artist);
        }
      }}
    >
      {albums.map((album) => (
        <CardGridCard
          key={album.id}
          data-album={album.id}
          data-chosen={chosen?.includes(album.id) ? "" : undefined}
          variant="square"
          render={<button type="button" aria-pressed={album.id === selectedId} />}
          artwork={<AlbumCover id={album.id} cover={album.cover} src={album.artwork} />}
          title={album.title}
          subtitle={album.artist}
          onPointerDown={(event) => {
            if (event.button === 0) onCardPress?.(event.nativeEvent, album);
          }}
          onClick={(event) =>
            onSelect(album.id, {
              add: event.metaKey || event.ctrlKey,
              range: event.shiftKey,
            })
          }
          onDoubleClick={() => onPlay(album)}
        />
      ))}
    </CardGrid>
  );
}

const ALBUM_COLUMNS: TableViewColumn[] = [
  { id: "number", width: 36, align: "right" },
  { id: "title" },
  { id: "time", width: 60, align: "right" },
];

export interface AlbumDetailProps {
  /** The album shown. */
  album: MusicAlbum;
  /**
   * Row pitch in points (the "List Size" preference).
   * @default 24
   */
  rowHeight?: number;
  /** The ids of the songs selected, when the window holds them. */
  selection?: readonly string[];
  /** Called with the ids of the songs selected: the rows then select many. */
  onSelectionChange?: (ids: readonly string[]) => void;
  /** Called with the album's tracks and the index to start at. */
  onPlay: (queue: MusicTrack[], index: number) => void;
}

/** The details of the chosen album under the grid: its cover, a Play button and its songs. */
export function AlbumDetail({
  album,
  rowHeight = ROW,
  selection,
  onSelectionChange,
  onPlay,
}: AlbumDetailProps) {
  const queue = useMemo(() => album.songs.map((song) => ({ song, album })), [album]);
  const count = album.songs.length;
  return (
    <section className="mac-music-album" aria-label={`${album.title} by ${album.artist}`}>
      <div className="mac-music-album-header">
        <div className="mac-music-album-cover">
          <AlbumCover id={album.id} cover={album.cover} src={album.artwork} />
        </div>
        <div className="mac-music-album-about">
          <div className="mac-music-album-title">{album.title}</div>
          <div className="mac-music-album-artist">{album.artist}</div>
          <div className="mac-music-album-meta">
            {album.genre} · {album.year} · {count} {count === 1 ? "song" : "songs"}
          </div>
          <PushButton onClick={() => onPlay(queue, 0)}>Play</PushButton>
        </div>
      </div>
      <TableView
        aria-label={`Songs on ${album.title}`}
        header="none"
        {...(onSelectionChange
          ? {
              selectionMode: "multiple" as const,
              value: selection ?? [],
              onValueChange: (value: readonly (string | number)[]) =>
                onSelectionChange(value.map(String)),
            }
          : {})}
        columns={ALBUM_COLUMNS}
        rowCount={count}
        rowHeight={rowHeight}
        getRowId={(row) => album.songs[row]?.id ?? row}
        getRowLabel={(row) => album.songs[row]?.title ?? ""}
        renderCell={(row, column) => {
          const song = album.songs[row];
          if (!song) return null;
          if (column.id === "number") return row + 1;
          return column.id === "title" ? song.title : formatDuration(song.duration);
        }}
        onRowAction={(row) => onPlay(queue, row)}
        style={{ height: count * rowHeight }}
      />
    </section>
  );
}

const CHECK_COLUMN: TableViewColumn = { id: "check", width: 26, align: "center" };
const SONG_COLUMNS: TableViewColumn[] = [
  { id: "title", title: "Title", sortable: true },
  { id: "time", title: "Time", width: 50, align: "right", sortable: true },
  { id: "artist", title: "Artist", width: 150, sortable: true },
  { id: "album", title: "Album", width: 170, sortable: true },
  { id: "genre", title: "Genre", width: 90, sortable: true },
];

/** What a column of the Songs list sorts by. */
function sortKey(track: MusicTrack, column: string): string | number {
  if (column === "time") return track.song.duration;
  if (column === "artist") return track.album.artist;
  if (column === "album") return track.album.title;
  if (column === "genre") return track.album.genre;
  return track.song.title;
}

export interface SongListProps {
  /** The songs, in library order; the list sorts them itself. */
  tracks: readonly MusicTrack[];
  /** Accessible name of the table. */
  label: string;
  /**
   * Whether the table fills its pane and scrolls, or is as tall as its rows. A table that
   * does not fill its pane is a section of a page and leaves the Genre column out.
   */
  fill?: boolean;
  /** Shows a checkbox before each song (the "Songs list checkboxes" preference). */
  checkboxes?: boolean;
  /**
   * Row pitch in points (the "List Size" preference).
   * @default 24
   */
  rowHeight?: number;
  /** Ids of the songs whose checkbox is cleared. */
  unchecked: ReadonlySet<string>;
  /** Called with a song's id and the new state of its checkbox. */
  onCheckedChange: (id: string, checked: boolean) => void;
  /** Called with the songs as sorted and the index of the one to start at. */
  onPlay: (queue: MusicTrack[], index: number) => void;
}

/** The Songs list: a sortable table of every song, played by a double click or Return. */
export function SongList({
  tracks,
  label,
  fill = false,
  checkboxes = false,
  rowHeight = ROW,
  unchecked,
  onCheckedChange,
  onPlay,
}: SongListProps) {
  const [sort, setSort] = useState<TableViewSort>({ column: "title", direction: "ascending" });
  const rows = useMemo(() => {
    const sign = sort.direction === "ascending" ? 1 : -1;
    return [...tracks].sort((a, b) => {
      const [left, right] = [sortKey(a, sort.column), sortKey(b, sort.column)];
      return left < right ? -sign : left > right ? sign : 0;
    });
  }, [tracks, sort]);
  const columns = useMemo(() => {
    const shown = fill ? SONG_COLUMNS : SONG_COLUMNS.filter((column) => column.id !== "genre");
    return checkboxes ? [CHECK_COLUMN, ...shown] : shown;
  }, [checkboxes, fill]);
  return (
    <TableView
      aria-label={label}
      columns={columns}
      rowCount={rows.length}
      rowHeight={rowHeight}
      alternatingRows={fill}
      getRowId={(row) => rows[row]?.song.id ?? row}
      getRowLabel={(row) => rows[row]?.song.title ?? ""}
      renderCell={(row, column) => {
        const track = rows[row];
        if (!track) return null;
        if (column.id === "check") {
          return (
            <Checkbox
              size="small"
              aria-label={`Include ${track.song.title}`}
              checked={!unchecked.has(track.song.id)}
              onCheckedChange={(checked) => onCheckedChange(track.song.id, checked)}
            />
          );
        }
        if (column.id === "time") return formatDuration(track.song.duration);
        return sortKey(track, column.id);
      }}
      sort={sort}
      onSortChange={setSort}
      onRowAction={(row) => onPlay(rows, row)}
      style={fill ? { height: "100%" } : { height: rows.length * rowHeight + ROW }}
    />
  );
}

export interface SidePanelProps {
  /** Which panel is open. */
  kind: "lyrics" | "up-next";
  /** The song that is loaded, if any. */
  current: MusicTrack | null;
  /** The songs after it in the queue. */
  upcoming: readonly MusicTrack[];
  /** Each of `upcoming`'s place in the queue. */
  entries?: readonly number[];
  /** Called with the index in `upcoming` of a song chosen to play now. */
  onJump: (index: number) => void;
  /** Takes a song out of Up Next, from its row's menu. */
  onRemove?: (index: number) => void;
  /** Moves a row of `upcoming` to before another (`to` may be its length), from a drag. */
  onMove?: (from: number, to: number) => void;
  /** The lyrics of the song loaded; empty or absent when it has none. */
  lyrics?: string;
  /** Up Next's History: the songs played, newest first. Without it Up Next has no History. */
  history?: readonly MusicTrack[];
  /** Plays a row of `history`. */
  onPlayHistory?: (index: number) => void;
  /** Forgets `history`. */
  onClearHistory?: () => void;
}

/** The panel the Lyrics and Up Next buttons open at the trailing edge of the pane. */
export function SidePanel({
  kind,
  current,
  upcoming,
  entries,
  onJump,
  onRemove,
  onMove,
  lyrics,
  history,
  onPlayHistory,
  onClearHistory,
}: SidePanelProps) {
  const [menuEntry, setMenuEntry] = useState<number | null>(null);
  const [dropLine, setDropLine] = useState<number | null>(null);
  const [showing, setShowing] = useState("up-next");
  const inHistory = kind === "up-next" && history !== undefined && showing === "history";
  /** A press on a row that becomes a drag once it has moved a little. */
  const pressRow = (down: PointerEvent<HTMLElement>) => {
    if (!onMove || down.button !== 0) return;
    const list = down.currentTarget;
    const row = (down.target as Element).closest<HTMLElement>("[data-index]");
    if (!row) return;
    const from = Number(row.dataset.index);
    const startY = down.clientY;
    let target: number | null = null;
    const placeOf = (y: number) => {
      const rows = [...list.querySelectorAll<HTMLElement>("[data-index]")];
      const under = rows.find((each) => {
        const box = each.getBoundingClientRect();
        return y < box.top + box.height / 2;
      });
      return under ? Number(under.dataset.index) : upcoming.length;
    };
    const move = (event: globalThis.PointerEvent) => {
      if (target === null && Math.abs(event.clientY - startY) < DRAG_START) return;
      target = placeOf(event.clientY);
      const rows = [...list.querySelectorAll<HTMLElement>("[data-index]")];
      const at = rows.find((each) => Number(each.dataset.index) === target);
      const bounds = list.getBoundingClientRect();
      const last = rows.at(-1)?.getBoundingClientRect();
      setDropLine((at ? at.getBoundingClientRect().top : (last?.bottom ?? 0)) - bounds.top);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      setDropLine(null);
      if (target !== null) onMove(from, target);
    };
    const cancel = () => {
      target = null;
      up();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  };
  // By place in the queue, not by row: Up Next moves on while the menu is open, and a song can be
  // in it twice.
  const entryOf = (index: number) => entries?.[index] ?? index;
  const menuIndex = upcoming.findIndex((_, index) => entryOf(index) === menuEntry);
  const renderRow = useCallback(
    (index: number) => {
      const track = upcoming[index];
      if (!track) return null;
      return (
        <>
          <ListViewRowTitle>{track.song.title}</ListViewRowTitle>
          <ListViewRowDetail>{track.album.artist}</ListViewRowDetail>
        </>
      );
    },
    [upcoming],
  );
  const rowLabel = useCallback((index: number) => upcoming[index]?.song.title ?? "", [upcoming]);
  const rowId = useCallback(
    (index: number) => entries?.[index] ?? upcoming[index]?.song.id ?? index,
    [entries, upcoming],
  );
  const renderHistoryRow = useCallback(
    (index: number) => {
      const track = history?.[index];
      if (!track) return null;
      return (
        <>
          <ListViewRowTitle>{track.song.title}</ListViewRowTitle>
          <ListViewRowDetail>{track.album.artist}</ListViewRowDetail>
        </>
      );
    },
    [history],
  );
  const historyLabel = useCallback(
    (index: number) => history?.[index]?.song.title ?? "",
    [history],
  );
  const historyId = useCallback((index: number) => history?.[index]?.song.id ?? index, [history]);
  const title = kind === "lyrics" ? "Lyrics" : "Up Next";
  const titleId = useId();
  return (
    <aside className="mac-music-panel" aria-labelledby={titleId} data-music-panel={kind}>
      <div id={titleId} className="mac-music-panel-title">
        {title}
      </div>
      {kind === "up-next" && history ? (
        <div className="mac-music-panel-switch">
          <SegmentedControl
            aria-label="Up Next or History"
            size="small"
            value={[showing]}
            onValueChange={([next]) => {
              if (next) setShowing(next);
            }}
          >
            <Segment value="up-next" aria-label="Upcoming songs">
              Up Next
            </Segment>
            <Segment value="history">History</Segment>
          </SegmentedControl>
          {inHistory ? (
            <PushButton size="small" disabled={history.length === 0} onClick={onClearHistory}>
              Clear
            </PushButton>
          ) : null}
        </div>
      ) : null}
      <div className="mac-music-panel-body">
        {kind === "lyrics" ? (
          current && lyrics ? (
            <div className="mac-music-panel-lyrics">{lyrics}</div>
          ) : (
            <EmptyState>{current ? "No Lyrics Available" : "Not Playing"}</EmptyState>
          )
        ) : inHistory ? (
          history.length === 0 ? (
            <EmptyState>No History</EmptyState>
          ) : (
            <ListView
              aria-label="Songs played"
              count={history.length}
              rowHeight={44}
              separator="inset"
              separatorInset={16}
              renderRow={renderHistoryRow}
              getRowId={historyId}
              getRowLabel={historyLabel}
              onRowAction={(index) => onPlayHistory?.(index)}
              style={{ height: "100%" }}
            />
          )
        ) : upcoming.length === 0 ? (
          <EmptyState>No Upcoming Songs</EmptyState>
        ) : (
          <ContextualMenu>
            <ContextualMenuTrigger
              className="mac-music-sidebar-menu"
              onPointerDown={pressRow}
              onContextMenu={(event) => {
                const row = (event.target as Element).closest<HTMLElement>("[data-index]");
                setMenuEntry(row ? entryOf(Number(row.dataset.index)) : null);
              }}
            >
              {dropLine !== null ? (
                <div className="mac-music-drop-line" style={{ top: dropLine }} aria-hidden="true" />
              ) : null}
              <ListView
                aria-label="Upcoming songs"
                count={upcoming.length}
                rowHeight={44}
                separator="inset"
                separatorInset={16}
                renderRow={renderRow}
                getRowId={rowId}
                getRowLabel={rowLabel}
                onRowAction={onJump}
                style={{ height: "100%" }}
              />
            </ContextualMenuTrigger>
            <ContextualMenuPopup aria-label="Up Next">
              {menuIndex >= 0 ? (
                <>
                  <MenuItem onClick={() => onJump(menuIndex)}>Play</MenuItem>
                  {onRemove ? (
                    <MenuItem onClick={() => onRemove(menuIndex)}>Remove from Up Next</MenuItem>
                  ) : null}
                </>
              ) : (
                <MenuItem disabled>No Song Selected</MenuItem>
              )}
            </ContextualMenuPopup>
          </ContextualMenu>
        )}
      </div>
    </aside>
  );
}

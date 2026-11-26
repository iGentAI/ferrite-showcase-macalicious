"use client";

import { CardGrid, CardGridCard } from "macalicious/card-grid";
import { EmptyState } from "macalicious/empty-state";
import { ProgressSpinner } from "macalicious/progress-spinner";
import { PushButton } from "macalicious/push-button";
import { SearchField } from "macalicious/search-field";
import { TableView, type TableViewColumn } from "macalicious/table-view";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { formatDuration } from "./music-data";
import {
  type ArchiveItem,
  type ArchiveResult,
  type LibrarySong,
  readArchiveItem,
  searchArchive,
  songFromArchive,
} from "./music-server";

/** The album grid's side margin, as Music's own grid (`music-views.tsx`). */
const GRID: CSSProperties = { ["--mac-card-grid-margin" as string]: "39px" };

/** A licence URL's short name: `CC BY-NC-ND 4.0`, `CC0 1.0`, `Public Domain Mark 1.0`. */
export function licenseName(url: string): string {
  const path = url.replace(/^https?:\/\/(www\.)?creativecommons\.org\//i, "").split("/");
  if (path[0] === "licenses" && path[1]) {
    return `CC ${path[1].toUpperCase()}${path[2] ? ` ${path[2]}` : ""}`;
  }
  if (path[0] === "publicdomain" && path[1] === "zero") return `CC0 ${path[2] ?? ""}`.trim();
  if (path[0] === "publicdomain") return `Public Domain Mark ${path[2] ?? ""}`.trim();
  return "Open licence";
}

function ItemCover({ identifier }: { identifier: string }) {
  return (
    <img
      src={`https://archive.org/services/img/${encodeURIComponent(identifier)}`}
      alt=""
      aria-hidden="true"
      draggable={false}
      loading="lazy"
      style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
}

const TRACK_COLUMNS: TableViewColumn[] = [
  { id: "number", width: 36, align: "right" },
  { id: "title" },
  { id: "time", width: 60, align: "right" },
  { id: "add", width: 110, align: "right" },
];

export interface ArchiveBrowserProps {
  /** The search shown first, such as one typed in the sidebar's search field. */
  initialQuery?: string;
  /** The ids of the songs already in the library. */
  libraryIds: ReadonlySet<string>;
  rowHeight: number;
  /** Play these songs (not necessarily in the library) from `index`. */
  onPlay: (songs: LibrarySong[], index: number) => void;
  /** Add these songs to the library. */
  onAdd: (songs: LibrarySong[]) => void;
}

type Load<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; value: T };

/**
 * Browse and search the Internet Archive's openly licensed music: items under a Creative
 * Commons licence or in the public domain. Choosing an item lists its tracks, which play from
 * archive.org and can be added to the library.
 */
export function ArchiveBrowser({
  initialQuery = "",
  libraryIds,
  rowHeight,
  onPlay,
  onAdd,
}: ArchiveBrowserProps) {
  const [typed, setTyped] = useState(initialQuery);
  // The search asked for: its words, and a count bumped by every Search and Try Again, so the
  // same words can be searched again after a failure.
  const [request, setRequest] = useState({ query: initialQuery, asked: 0 });
  const query = request.query;
  const ask = (words: string) => setRequest((now) => ({ query: words, asked: now.asked + 1 }));
  const [results, setResults] = useState<
    Load<{ items: ArchiveResult[]; total: number; page: number }>
  >({
    status: "loading",
  });
  const [more, setMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState<string | null>(null);
  const paging = useRef(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [item, setItem] = useState<Load<ArchiveItem> | null>(null);
  const search = useRef(0);
  // The item request whose answer may still be shown: a newer choice, a deselection or a new
  // search makes every earlier answer, or failure, stale.
  const opening = useRef(0);

  // Closed: no answer still on its way shows, or holds a button, any more.
  useEffect(
    () => () => {
      search.current += 1;
      paging.current += 1;
      opening.current += 1;
    },
    [],
  );

  useEffect(() => {
    const token = ++search.current;
    opening.current += 1;
    // A page still being read belongs to the search before: it neither shows nor holds the
    // button.
    paging.current += 1;
    setMore(false);
    setMoreFailed(null);
    setResults({ status: "loading" });
    setSelected(null);
    setItem(null);
    searchArchive(request.query, 1).then(
      (page) => {
        if (token === search.current) {
          setResults({
            status: "ready",
            value: { items: page.results, total: page.total, page: page.page },
          });
        }
      },
      (error: unknown) => {
        if (token === search.current) {
          setResults({
            status: "error",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );
  }, [request]);

  const loadMore = useCallback(() => {
    if (results.status !== "ready") return;
    const token = search.current;
    const pageToken = ++paging.current;
    const current = () => token === search.current && pageToken === paging.current;
    const { items, page } = results.value;
    setMore(true);
    setMoreFailed(null);
    searchArchive(query, page + 1).then(
      (next) => {
        if (!current()) return;
        setMore(false);
        const known = new Set(items.map((entry) => entry.identifier));
        setResults({
          status: "ready",
          value: {
            items: [...items, ...next.results.filter((entry) => !known.has(entry.identifier))],
            total: next.total,
            page: next.page,
          },
        });
      },
      (error: unknown) => {
        if (!current()) return;
        setMore(false);
        setMoreFailed(error instanceof Error ? error.message : String(error));
      },
    );
  }, [query, results]);

  /** Reads an item into the panel below the results: a new choice, or Try Again after a failure. */
  const readItem = (identifier: string) => {
    const token = ++opening.current;
    setItem({ status: "loading" });
    readArchiveItem(identifier).then(
      (value) => {
        if (token === opening.current) setItem({ status: "ready", value });
      },
      (error: unknown) => {
        if (token !== opening.current) return;
        setItem({
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      },
    );
  };

  const open = (identifier: string) => {
    if (selected === identifier) {
      opening.current += 1;
      setSelected(null);
      setItem(null);
      return;
    }
    setSelected(identifier);
    readItem(identifier);
  };

  const songsOf = (value: ArchiveItem) =>
    value.tracks.map((track) => songFromArchive(value, track, Date.now()));

  return (
    <div className="mac-music-page">
      <section className="mac-music-desktop-archive-head" aria-label="Internet Archive search">
        <h2 className="mac-music-desktop-title">Internet Archive</h2>
        <p className="mac-music-desktop-facts">
          Openly licensed music: every item here is under a Creative Commons licence or in the
          public domain, and plays straight from archive.org.
        </p>
        <form
          className="mac-music-desktop-archive-search"
          onSubmit={(event) => {
            event.preventDefault();
            ask(typed.trim());
          }}
        >
          <SearchField
            aria-label="Search the Internet Archive"
            placeholder="Artists, albums, genres"
            value={typed}
            onValueChange={(next) => {
              setTyped(next);
              if (next === "" && query !== "") ask("");
            }}
            style={{ width: 280 }}
          />
          <PushButton type="submit">Search</PushButton>
        </form>
      </section>
      {results.status === "loading" ? (
        <div className="mac-music-desktop-center" role="status" aria-label="Searching">
          <ProgressSpinner />
        </div>
      ) : results.status === "error" ? (
        <EmptyState role="alert">
          The Internet Archive could not be searched: {results.message}{" "}
          <PushButton onClick={() => ask(query)}>Try Again</PushButton>
        </EmptyState>
      ) : results.value.items.length === 0 ? (
        <EmptyState role="status">No Results</EmptyState>
      ) : (
        <>
          <CardGrid
            aria-label={query ? `Results for ${query}` : "Most played on the Internet Archive"}
            title={query ? "Results" : "Most Played Netlabel Releases"}
            style={GRID}
          >
            {results.value.items.map((entry) => (
              <CardGridCard
                key={entry.identifier}
                variant="square"
                render={<button type="button" aria-pressed={entry.identifier === selected} />}
                artwork={<ItemCover identifier={entry.identifier} />}
                title={entry.title}
                subtitle={entry.creator ?? licenseName(entry.license)}
                onClick={() => open(entry.identifier)}
              />
            ))}
          </CardGrid>
          {item ? (
            <section
              className="mac-music-album"
              aria-label={item.status === "ready" ? item.value.title : "Internet Archive item"}
            >
              {item.status === "loading" ? (
                <div
                  className="mac-music-desktop-center"
                  role="status"
                  aria-label="Loading the item"
                >
                  <ProgressSpinner />
                </div>
              ) : item.status === "error" ? (
                <EmptyState role="alert">
                  {item.message}{" "}
                  <PushButton onClick={() => selected && readItem(selected)}>Try Again</PushButton>
                </EmptyState>
              ) : (
                <ArchiveItemDetail
                  item={item.value}
                  songs={songsOf(item.value)}
                  libraryIds={libraryIds}
                  rowHeight={rowHeight}
                  onPlay={onPlay}
                  onAdd={onAdd}
                />
              )}
            </section>
          ) : null}
          {results.value.items.length < results.value.total ? (
            <div className="mac-music-desktop-center">
              {moreFailed ? (
                <span role="alert" className="mac-music-desktop-facts">
                  More results could not be loaded: {moreFailed}
                </span>
              ) : null}
              <PushButton disabled={more} onClick={loadMore}>
                {more ? "Loading…" : moreFailed ? "Try Again" : "More Results"}
              </PushButton>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function ArchiveItemDetail({
  item,
  songs,
  libraryIds,
  rowHeight,
  onPlay,
  onAdd,
}: {
  item: ArchiveItem;
  songs: LibrarySong[];
  libraryIds: ReadonlySet<string>;
  rowHeight: number;
  onPlay: (songs: LibrarySong[], index: number) => void;
  onAdd: (songs: LibrarySong[]) => void;
}) {
  const missing = songs.filter((song) => !libraryIds.has(song.id));
  return (
    <>
      <div className="mac-music-album-header">
        <div className="mac-music-album-cover">
          <ItemCover identifier={item.identifier} />
        </div>
        <div className="mac-music-album-about">
          <div className="mac-music-album-title">{item.title}</div>
          <div className="mac-music-album-artist">{item.creator ?? ""}</div>
          <div className="mac-music-album-meta">
            {item.year ? `${item.year} · ` : ""}
            {songs.length} {songs.length === 1 ? "song" : "songs"} ·{" "}
            <a href={item.license} target="_blank" rel="noreferrer noopener">
              {licenseName(item.license)}
            </a>{" "}
            ·{" "}
            <a
              href={`https://archive.org/details/${encodeURIComponent(item.identifier)}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              archive.org
            </a>
          </div>
          <div className="mac-music-desktop-buttons">
            <PushButton disabled={songs.length === 0} onClick={() => onPlay(songs, 0)}>
              Play
            </PushButton>
            <PushButton disabled={missing.length === 0} onClick={() => onAdd(missing)}>
              {missing.length === 0 && songs.length > 0 ? "In Library" : "Add to Library"}
            </PushButton>
          </div>
        </div>
      </div>
      {songs.length === 0 ? (
        <EmptyState>This item has no tracks this browser can list.</EmptyState>
      ) : (
        <TableView
          aria-label={`Tracks of ${item.title}`}
          header="none"
          columns={TRACK_COLUMNS}
          rowCount={songs.length}
          rowHeight={rowHeight}
          getRowId={(row) => songs[row]?.id ?? row}
          getRowLabel={(row) => songs[row]?.title ?? ""}
          renderCell={(row, column) => {
            const song = songs[row];
            if (!song) return null;
            if (column.id === "number") return song.track ?? row + 1;
            if (column.id === "title") return song.title;
            if (column.id === "time") return song.duration > 0 ? formatDuration(song.duration) : "";
            return libraryIds.has(song.id) ? (
              "In Library"
            ) : (
              <PushButton
                size="small"
                aria-label={`Add ${song.title}`}
                onClick={() => onAdd([song])}
              >
                Add
              </PushButton>
            );
          }}
          onRowAction={(row) => onPlay(songs, row)}
          style={{ height: songs.length * rowHeight }}
        />
      )}
    </>
  );
}

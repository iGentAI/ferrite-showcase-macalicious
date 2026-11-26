"use client";

import { EmptyState } from "macalicious/empty-state";
import { ProgressSpinner } from "macalicious/progress-spinner";
import { PushButton } from "macalicious/push-button";
import { ScopeBar, ScopeBarButton, ScopeBarGroup, ScopeBarLabel } from "macalicious/scope-bar";
import { SearchField } from "macalicious/search-field";
import { TableView, type TableViewColumn } from "macalicious/table-view";
import { useEffect, useRef, useState } from "react";
import {
  type LibrarySong,
  RADIO_GENRES,
  type RadioGenre,
  type RadioStation,
  searchRadio,
  songFromStation,
} from "./music-server";

const COLUMNS: TableViewColumn[] = [
  { id: "name", title: "Station" },
  { id: "genre", title: "Genre", width: 130 },
  { id: "country", title: "Country", width: 150 },
  { id: "bitrate", title: "Bit Rate", width: 70, align: "right" },
  { id: "add", width: 110, align: "right" },
];

const GENRE_TITLES: Record<RadioGenre, string> = {
  pop: "Pop",
  rock: "Rock",
  jazz: "Jazz",
  classical: "Classical",
  dance: "Dance",
  news: "News",
};

export interface RadioBrowserProps {
  /** The ids of the songs already in the library. */
  libraryIds: ReadonlySet<string>;
  rowHeight: number;
  /** Play this station, not necessarily in the library. */
  onPlay: (station: LibrarySong) => void;
  /** Keep this station in the library. */
  onAdd: (station: LibrarySong) => void;
}

interface Found {
  stations: RadioStation[];
  more: boolean;
  page: number;
}

type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | ({ status: "ready" } & Found);

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Radio without Apple Music: stations from the free Radio Browser directory, which anyone can add
 * to, most listened first. A station plays straight from its own server and can be kept in the
 * library as a stream.
 */
export function RadioBrowser({ libraryIds, rowHeight, onPlay, onAdd }: RadioBrowserProps) {
  const [typed, setTyped] = useState("");
  const [request, setRequest] = useState<{ name: string; genre: RadioGenre | ""; asked: number }>({
    name: "",
    genre: "",
    asked: 0,
  });
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [more, setMore] = useState<"idle" | "reading" | string>("idle");
  const search = useRef(0);

  useEffect(() => {
    const token = ++search.current;
    setLoad({ status: "loading" });
    setMore("idle");
    searchRadio(request.name, request.genre, 1).then(
      (found) => {
        if (token === search.current) setLoad({ status: "ready", ...found, page: 1 });
      },
      (error: unknown) => {
        if (token === search.current) setLoad({ status: "error", message: messageOf(error) });
      },
    );
    return () => {
      search.current += 1;
    };
  }, [request]);

  const ask = (change: Partial<typeof request>) =>
    setRequest((now) => ({ ...now, ...change, asked: now.asked + 1 }));

  const readMore = () => {
    if (load.status !== "ready") return;
    const token = search.current;
    setMore("reading");
    searchRadio(request.name, request.genre, load.page + 1).then(
      (next) => {
        if (token !== search.current) return;
        const known = new Set(load.stations.map((station) => station.id));
        setLoad({
          status: "ready",
          stations: [...load.stations, ...next.stations.filter((each) => !known.has(each.id))],
          more: next.more,
          page: load.page + 1,
        });
        setMore("idle");
      },
      (error: unknown) => {
        if (token === search.current) setMore(messageOf(error));
      },
    );
  };

  const stations = load.status === "ready" ? load.stations : [];
  const songOf = (station: RadioStation) => songFromStation(station, Date.now());
  const failedMore = more !== "idle" && more !== "reading";

  return (
    <div className="mac-music-page">
      <section className="mac-music-desktop-archive-head" aria-label="Radio search">
        <h2 className="mac-music-desktop-title">Radio</h2>
        <p className="mac-music-desktop-facts">
          Internet stations from the free{" "}
          <a href="https://www.radio-browser.info" target="_blank" rel="noreferrer noopener">
            Radio Browser
          </a>{" "}
          directory, which anyone can add to. Apple Music’s own stations are not part of this
          desktop. A station plays straight from its own server.
        </p>
        <form
          className="mac-music-desktop-archive-search"
          onSubmit={(event) => {
            event.preventDefault();
            ask({ name: typed.trim() });
          }}
        >
          <SearchField
            aria-label="Search for a station"
            placeholder="Station name"
            value={typed}
            maxLength={100}
            onValueChange={(next) => {
              setTyped(next);
              if (next === "" && request.name !== "") ask({ name: "" });
            }}
            style={{ width: 280 }}
          />
          <PushButton type="submit">Search</PushButton>
        </form>
        <div className="mac-music-desktop-buttons">
          <ScopeBar>
            <ScopeBarLabel>Genre:</ScopeBarLabel>
            <ScopeBarGroup
              aria-label="Genre"
              value={request.genre || "all"}
              onValueChange={(genre) =>
                ask({ genre: genre === "all" ? "" : (genre as RadioGenre) })
              }
            >
              <ScopeBarButton value="all">All</ScopeBarButton>
              {RADIO_GENRES.map((genre) => (
                <ScopeBarButton key={genre} value={genre}>
                  {GENRE_TITLES[genre]}
                </ScopeBarButton>
              ))}
            </ScopeBarGroup>
          </ScopeBar>
        </div>
      </section>
      {load.status === "loading" ? (
        <div className="mac-music-desktop-center" role="status" aria-label="Finding stations">
          <ProgressSpinner />
        </div>
      ) : load.status === "error" ? (
        <EmptyState role="alert">
          The Radio Browser directory could not be read: {load.message}{" "}
          <PushButton onClick={() => ask({})}>Try Again</PushButton>
        </EmptyState>
      ) : stations.length === 0 ? (
        <EmptyState role="status">No Stations</EmptyState>
      ) : (
        <>
          <TableView
            aria-label="Stations"
            columns={COLUMNS}
            rowCount={stations.length}
            rowHeight={rowHeight}
            getRowId={(row) => stations[row]?.id ?? row}
            getRowLabel={(row) => stations[row]?.name ?? ""}
            renderCell={(row, column) => {
              const station = stations[row];
              if (!station) return null;
              if (column.id === "name") return station.name;
              if (column.id === "genre") return station.genre;
              if (column.id === "country") return station.country;
              if (column.id === "bitrate") {
                return station.bitrate > 0 ? `${station.bitrate} kbps` : "";
              }
              return libraryIds.has(songOf(station).id) ? (
                "In Library"
              ) : (
                <PushButton
                  size="small"
                  aria-label={`Add ${station.name}`}
                  onClick={() => onAdd(songOf(station))}
                >
                  Add
                </PushButton>
              );
            }}
            onRowAction={(row) => {
              const station = stations[row];
              if (station) onPlay(songOf(station));
            }}
            style={{ height: (stations.length + 1) * rowHeight }}
          />
          {load.more ? (
            <div className="mac-music-desktop-center">
              {failedMore ? (
                <span role="alert" className="mac-music-desktop-facts">
                  More stations could not be read: {more}
                </span>
              ) : null}
              <PushButton disabled={more === "reading"} onClick={readMore}>
                {more === "reading" ? "Loading…" : failedMore ? "Try Again" : "More Stations"}
              </PushButton>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

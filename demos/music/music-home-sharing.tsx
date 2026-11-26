"use client";

import { DefaultButton } from "macalicious/default-button";
import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { Sheet, SheetPopup } from "macalicious/sheet";
import { TableView, type TableViewColumn } from "macalicious/table-view";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sessionFetch } from "../desktop/desktop-server";
import { formatDuration } from "./music-data";
import type { MusicPlayer } from "./music-player";
import { type LibrarySong, UNKNOWN_ALBUM, UNKNOWN_ARTIST } from "./music-server";
import {
  isBorrowedFile,
  NotSharedError,
  readSharedFile,
  readSharedLibrary,
  readSharedPeople,
  readSharingOn,
  type SharedLibrary,
  type SharedPerson,
} from "./music-sharing";

/** How often the page asks again while it holds someone's songs, in ms: how soon a listener's window
 * follows a library being turned off. The server refuses every read from the moment it is. */
export const LISTENING_CHECK_MS = 5_000;
/** How often the sidebar asks who is sharing, with no shared library in use, in ms. */
export const SIDEBAR_CHECK_MS = 30_000;

const SHEET_NOTE =
  "Any account on this desktop can then see your library in Music and hear its songs. They cannot change it, and they do not see your play counts, ratings or the playlists you mark private. Turning Home Sharing off ends it at once.";

/** What the sidebar has open: someone's whole library, or one of their playlists. */
export interface SharedPlace {
  owner: string;
  playlist: string | null;
}

const SHARED_ROW = "shared:";

/** A sidebar row's value for a shared library, or for one of its playlists. */
export const sharedRow = ({ owner, playlist }: SharedPlace) =>
  `${SHARED_ROW}${owner}${playlist ? `:${playlist}` : ""}`;

/** The shared place a sidebar row's value names, or `null` for any other row. */
export function sharedPlaceOf(row: string): SharedPlace | null {
  if (!row.startsWith(SHARED_ROW)) return null;
  const [owner = "", playlist = null] = row.slice(SHARED_ROW.length).split(":");
  return { owner, playlist };
}

/**
 * Music's side of Home Sharing: the person's own switch, who shares with them, and the library
 * open. What it holds of someone's library goes as soon as the server says that library is no
 * longer shared.
 */
export function useHomeSharing(player: MusicPlayer, onEnded: (message: string) => void) {
  const [member, setMember] = useState(false);
  const [on, setOn] = useState(false);
  const [people, setPeople] = useState<readonly SharedPerson[]>([]);
  const [held, setHeld] = useState<Readonly<Record<string, SharedLibrary>>>({});
  const [place, setPlace] = useState<SharedPlace | null>(null);
  const heldRef = useRef(held);
  heldRef.current = held;
  const placeRef = useRef(place);
  placeRef.current = place;
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;

  const hold = useCallback(
    (next: Readonly<Record<string, SharedLibrary>>) => {
      heldRef.current = next;
      setHeld(next);
      player.setBorrowed(Object.values(next).flatMap((library) => library.songs));
    },
    [player],
  );

  /** The library of `owner` has ended: its songs and its view go. */
  const ended = useCallback(
    (owner: string) => {
      const library = heldRef.current[owner];
      if (library) {
        hold(
          Object.fromEntries(Object.entries(heldRef.current).filter(([name]) => name !== owner)),
        );
      }
      const open = placeRef.current?.owner === owner;
      if (open) setPlace(null);
      if (library || open) {
        endedRef.current(
          `${library?.owner.full_name ?? owner} is no longer sharing their library.`,
        );
      }
    },
    [hold],
  );

  const check = useCallback(async () => {
    let shared: SharedPerson[];
    try {
      shared = await readSharedPeople();
    } catch (error) {
      if (!(error instanceof NotSharedError)) return;
      shared = [];
    }
    setPeople(shared);
    const names = new Set(shared.map((person) => person.name));
    for (const owner of Object.keys(heldRef.current)) if (!names.has(owner)) ended(owner);
    const open = placeRef.current?.owner;
    if (!open || !names.has(open)) return;
    try {
      const library = await readSharedLibrary(open);
      hold({ ...heldRef.current, [open]: library });
    } catch (error) {
      if (error instanceof NotSharedError) ended(open);
    }
  }, [ended, hold]);

  useEffect(() => {
    let stopped = false;
    void sessionFetch("/api/session")
      .then((answer) => (answer.ok ? answer.json() : null))
      .then((session: { account?: { guest?: boolean } | null } | null) => {
        if (!stopped) setMember(Boolean(session?.account && !session.account.guest));
      })
      .catch(() => {});
    void readSharingOn()
      .then((held) => {
        if (!stopped) setOn(held);
      })
      .catch(() => {});
    void check();
    return () => {
      stopped = true;
      player.setBorrowed([]);
    };
  }, [check, player]);

  const listening = Object.keys(held).length > 0;
  useEffect(() => {
    const timer = setInterval(
      () => void check(),
      listening ? LISTENING_CHECK_MS : SIDEBAR_CHECK_MS,
    );
    const again = () => void check();
    window.addEventListener("focus", again);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", again);
    };
  }, [check, listening]);

  const open = useCallback(
    async (next: SharedPlace) => {
      setPlace(next);
      if (heldRef.current[next.owner]) return;
      try {
        const library = await readSharedLibrary(next.owner);
        hold({ ...heldRef.current, [next.owner]: library });
      } catch (error) {
        if (error instanceof NotSharedError) ended(next.owner);
        else {
          setPlace(null);
          endedRef.current(error instanceof Error ? error.message : String(error));
        }
      }
    },
    [ended, hold],
  );

  /** Reads what the player asks for: a borrowed song by the route that names it, any other as usual. */
  const readFile = useCallback(
    async (file: string, own: (file: string) => Promise<Blob>) => {
      if (!isBorrowedFile(file)) return own(file);
      try {
        return await readSharedFile(file);
      } catch (error) {
        if (error instanceof NotSharedError) void check();
        throw error;
      }
    },
    [check],
  );

  const songs = useMemo(() => Object.values(held).flatMap((library) => library.songs), [held]);

  return {
    member,
    on,
    setOn,
    people,
    place,
    library: place ? (held[place.owner] ?? null) : null,
    songs,
    open,
    close: useCallback(() => setPlace(null), []),
    readFile,
  };
}

const COLUMNS: TableViewColumn[] = [
  { id: "title", title: "Title" },
  { id: "time", title: "Time", width: 50, align: "right" },
  { id: "artist", title: "Artist", width: 170 },
  { id: "album", title: "Album", width: 190 },
  { id: "genre", title: "Genre", width: 90 },
];

/** Someone's shared library, to list and to play and not to change. */
export function SharedLibraryPane({
  library,
  playlist,
  currentId,
  onPlay,
}: {
  /** `null` while it is being read. */
  library: SharedLibrary | null;
  playlist: string | null;
  currentId: string | undefined;
  onPlay: (ids: readonly string[], index: number) => void;
}) {
  const [selected, setSelected] = useState<readonly (string | number)[]>([]);
  const list = library?.playlists.find((each) => each.id === playlist);
  const rows: LibrarySong[] = useMemo(() => {
    if (!library) return [];
    if (!list) return library.songs;
    return list.songs.flatMap((id) => library.songs.find((song) => song.id === id) ?? []);
  }, [library, list]);
  if (!library) {
    return (
      <div className="mac-music-shared" role="status">
        Reading the shared library…
      </div>
    );
  }
  const name = list?.name ?? `${library.owner.full_name}’s Library`;
  return (
    <div className="mac-music-shared">
      <h2 className="mac-music-shared-title">{name}</h2>
      <Label textStyle="small" color="secondary" role="note">
        Shared by {library.owner.full_name}. You can play these songs; you cannot change them.
      </Label>
      {rows.length === 0 ? (
        <p className="mac-music-shared-empty">No songs are shared here.</p>
      ) : (
        <div className="mac-music-shared-table">
          <TableView
            aria-label={name}
            selectionMode="single"
            value={selected as (string | number)[]}
            onValueChange={setSelected}
            columns={COLUMNS}
            rowCount={rows.length}
            alternatingRows
            getRowId={(row) => rows[row]?.id ?? row}
            getRowLabel={(row) => rows[row]?.title ?? ""}
            getRowProps={(row) =>
              rows[row]?.id === currentId ? ({ "aria-current": "true" } as object) : undefined
            }
            renderCell={(row, column) => {
              const song = rows[row];
              if (!song) return null;
              switch (column.id) {
                case "title":
                  return song.title;
                case "time":
                  return song.duration > 0 ? formatDuration(song.duration) : "";
                case "artist":
                  return song.artist || UNKNOWN_ARTIST;
                case "album":
                  return song.album || UNKNOWN_ALBUM;
                case "genre":
                  return song.genre;
                default:
                  return null;
              }
            }}
            onRowAction={(row) =>
              onPlay(
                rows.map((song) => song.id),
                row,
              )
            }
            style={{ height: "100%" }}
          />
        </div>
      )}
    </div>
  );
}

/** File > Home Sharing > Turn On Home Sharing…: says plainly who can then hear the library. */
export function HomeSharingSheet({
  open,
  anchor,
  onCancel,
  onTurnOn,
}: {
  open: boolean;
  anchor: HTMLElement | null;
  onCancel: () => void;
  onTurnOn: () => void;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <SheetPopup anchor={anchor ?? undefined} width={440} aria-label="Home Sharing">
        <div className="mac-music-open-stream">
          <h2 className="mac-music-shared-title">Turn on Home Sharing?</h2>
          <p className="mac-music-shared-note">{SHEET_NOTE}</p>
          <div className="mac-music-open-stream-buttons">
            <PushButton type="button" onClick={onCancel}>
              Cancel
            </PushButton>
            <DefaultButton type="button" autoFocus onClick={onTurnOn}>
              Turn On Home Sharing
            </DefaultButton>
          </div>
        </div>
      </SheetPopup>
    </Sheet>
  );
}

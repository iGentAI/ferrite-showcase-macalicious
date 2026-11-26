"use client";

import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { SidebarItem } from "macalicious/sidebar";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { type ReactNode, useState } from "react";
import type { LibraryFolder, LibraryPlaylist, MusicLibraryState } from "./music-server";

const FOLDER_ROW = "folder:";
const PLAYLIST_ROW = "playlist:";
const ROW_DRAG = "application/x-macalicious-music-list";

const foldersOf = (library: MusicLibraryState) => library.folders ?? [];
const parentOf = (row: LibraryPlaylist | LibraryFolder) =>
  "songs" in row ? (row.folder ?? null) : (row.parent ?? null);

/** `folder` and every folder inside it. */
export function folderAndInside(library: MusicLibraryState, folder: string): Set<string> {
  const found = new Set([folder]);
  for (const id of found) {
    for (const other of foldersOf(library)) {
      if (other.parent === id) found.add(other.id);
    }
  }
  return found;
}

/** The songs of the playlists in `folder` and in the folders inside it, each once. */
export function songsInFolder(
  library: MusicLibraryState,
  folder: string,
  songsOf: (list: LibraryPlaylist) => readonly string[] = (list) => list.songs,
): string[] {
  const folders = folderAndInside(library, folder);
  return [
    ...new Set(
      library.playlists.flatMap((list) =>
        list.folder && folders.has(list.folder) ? songsOf(list) : [],
      ),
    ),
  ];
}

/**
 * The library with the sidebar row `row` (a `playlist:` or `folder:` place) in `folder`, or at the
 * top of the list for `null`. A folder is not put inside itself: the library comes back unchanged.
 */
export function moveToFolder(
  library: MusicLibraryState,
  row: string,
  folder: string | null,
): MusicLibraryState {
  if (row.startsWith(PLAYLIST_ROW)) {
    const id = row.slice(PLAYLIST_ROW.length);
    return {
      ...library,
      playlists: library.playlists.map((list) => (list.id === id ? { ...list, folder } : list)),
    };
  }
  const id = row.slice(FOLDER_ROW.length);
  if (folder && folderAndInside(library, id).has(folder)) return library;
  return {
    ...library,
    folders: foldersOf(library).map((other) =>
      other.id === id ? { ...other, parent: folder } : other,
    ),
  };
}

/** The library without `folder`, the folders inside it and their playlists. */
export function withoutFolder(library: MusicLibraryState, folder: string): MusicLibraryState {
  const going = folderAndInside(library, folder);
  return {
    ...library,
    folders: foldersOf(library).filter((other) => !going.has(other.id)),
    playlists: library.playlists.filter((list) => !(list.folder && going.has(list.folder))),
  };
}

/** The icon of a playlist row: an original list glyph on Music's rounded square. */
export function PlaylistIcon({ smart }: { smart?: boolean }) {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <rect width="18" height="18" rx="4.5" fill={smart ? "#8e8e93" : "#6e80f4"} />
      <path
        d="M4.5 5.5h9M4.5 9h9M4.5 12.5h6"
        stroke="#ffffff"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <path
        d="M1.5 5a1.5 1.5 0 0 1 1.5-1.5h3.6l1.6 1.8H15A1.5 1.5 0 0 1 16.5 6.800v7A1.5 1.5 0 0 1 15 15.300H3A1.5 1.5 0 0 1 1.500 13.800z"
        fill="#8e8e93"
      />
    </svg>
  );
}

/**
 * The sidebar's rows of the folders and playlists directly in `parent`, folders first; a row can
 * be dragged into a folder.
 */
export function PlaylistRows({
  library,
  parent = null,
  onMove,
}: {
  library: MusicLibraryState;
  parent?: string | null;
  onMove: (row: string, folder: string) => void;
}) {
  const draggable = (row: string) => ({
    draggable: true,
    "data-music-list": row,
    onDragStart: (event: React.DragEvent) => {
      event.stopPropagation();
      event.dataTransfer.setData(ROW_DRAG, row);
      event.dataTransfer.effectAllowed = "move";
    },
  });
  return (
    <>
      {foldersOf(library)
        .filter((folder) => parentOf(folder) === parent)
        .map((folder) => (
          <SidebarItem
            key={folder.id}
            value={`${FOLDER_ROW}${folder.id}`}
            label={folder.name}
            icon={<FolderIcon />}
            defaultExpanded
            {...draggable(`${FOLDER_ROW}${folder.id}`)}
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes(ROW_DRAG)) event.preventDefault();
            }}
            onDrop={(event) => {
              const row = event.dataTransfer.getData(ROW_DRAG);
              if (!row) return;
              event.preventDefault();
              event.stopPropagation();
              onMove(row, folder.id);
            }}
          >
            <PlaylistRows library={library} parent={folder.id} onMove={onMove} />
          </SidebarItem>
        ))}
      {library.playlists
        .filter((list) => parentOf(list) === parent)
        .map((list) => (
          <SidebarItem
            key={list.id}
            value={`${PLAYLIST_ROW}${list.id}`}
            label={list.name}
            data-music-drop={list.smart ? undefined : list.id}
            icon={<PlaylistIcon smart={Boolean(list.smart)} />}
            {...draggable(`${PLAYLIST_ROW}${list.id}`)}
          />
        ))}
    </>
  );
}

export interface PlaylistMenuActions {
  songsOf: (row: string) => readonly string[];
  play: (songs: readonly string[]) => void;
  playNext: (songs: readonly string[]) => void;
  playLater: (songs: readonly string[]) => void;
  newPlaylist: (folder: string | null) => void;
  newSmart: (folder: string | null) => void;
  newFolder: (folder: string | null) => void;
  duplicate: (playlist: string) => void;
  /** Home Sharing: whether the playlist stays out of what other accounts see. */
  setPrivate: (playlist: string, hidden: boolean) => void;
  exportPlaylist: (playlist: string) => void;
  editSmart: (playlist: string) => void;
  rename: (row: string) => void;
  move: (row: string, folder: string | null) => void;
  remove: (row: string) => void;
}

/** The sidebar's own menu: on a playlist or a folder its commands, elsewhere what can be made. */
export function PlaylistSidebarMenu({
  library,
  actions,
  children,
}: {
  library: MusicLibraryState;
  actions: PlaylistMenuActions;
  children: ReactNode;
}) {
  const [row, setRow] = useState<string | null>(null);
  const folder = row?.startsWith(FOLDER_ROW) ? row.slice(FOLDER_ROW.length) : null;
  const playlist = row?.startsWith(PLAYLIST_ROW) ? row.slice(PLAYLIST_ROW.length) : null;
  const songs = row ? actions.songsOf(row) : [];
  const held =
    library.playlists.find((list) => list.id === playlist) ??
    foldersOf(library).find((other) => other.id === folder);
  const excluded = folder ? folderAndInside(library, folder) : new Set<string>();
  const handMade = library.playlists.find((list) => list.id === playlist);
  const sharedList = handMade?.smart ? undefined : handMade;
  const destinations = foldersOf(library).filter(
    (other) => !excluded.has(other.id) && !(held && parentOf(held) === other.id),
  );
  return (
    <ContextualMenu>
      <ContextualMenuTrigger
        className="mac-music-sidebar-menu"
        onContextMenu={(event) => {
          const hit = (event.target as Element).closest<HTMLElement>("[data-music-list]");
          setRow(hit?.dataset.musicList ?? null);
        }}
      >
        {children}
      </ContextualMenuTrigger>
      <ContextualMenuPopup aria-label={held?.name ?? "Playlists"}>
        {held && row ? (
          <>
            <MenuItem disabled={songs.length === 0} onClick={() => actions.play(songs)}>
              Play
            </MenuItem>
            <MenuItem disabled={songs.length === 0} onClick={() => actions.playNext(songs)}>
              Play Next
            </MenuItem>
            <MenuItem disabled={songs.length === 0} onClick={() => actions.playLater(songs)}>
              Play Later
            </MenuItem>
            <MenuSeparator />
          </>
        ) : null}
        {!held || folder ? (
          <>
            <MenuItem onClick={() => actions.newPlaylist(folder)}>New Playlist</MenuItem>
            <MenuItem onClick={() => actions.newSmart(folder)}>New Smart Playlist…</MenuItem>
            <MenuItem onClick={() => actions.newFolder(folder)}>New Playlist Folder</MenuItem>
          </>
        ) : null}
        {playlist ? (
          <MenuItem onClick={() => actions.duplicate(playlist)}>Duplicate</MenuItem>
        ) : null}
        {playlist ? (
          <MenuItem onClick={() => actions.exportPlaylist(playlist)}>Export…</MenuItem>
        ) : null}
        {sharedList && playlist ? (
          <MenuItem onClick={() => actions.setPrivate(playlist, !sharedList.private)}>
            {sharedList.private ? "Show in Home Sharing" : "Hide from Home Sharing"}
          </MenuItem>
        ) : null}
        {playlist && library.playlists.find((list) => list.id === playlist)?.smart ? (
          <MenuItem onClick={() => actions.editSmart(playlist)}>Edit Smart Playlist…</MenuItem>
        ) : null}
        {held && row ? (
          <>
            {destinations.length > 0 || parentOf(held) ? (
              <Submenu>
                <SubmenuTrigger>Move to Folder</SubmenuTrigger>
                <SubmenuPopup>
                  {parentOf(held) ? (
                    <MenuItem onClick={() => actions.move(row, null)}>Top of the List</MenuItem>
                  ) : null}
                  {destinations.map((other) => (
                    <MenuItem key={other.id} onClick={() => actions.move(row, other.id)}>
                      {other.name}
                    </MenuItem>
                  ))}
                </SubmenuPopup>
              </Submenu>
            ) : null}
            <MenuItem onClick={() => actions.rename(row)}>Rename</MenuItem>
            <MenuSeparator />
            <MenuItem onClick={() => actions.remove(row)}>Delete from Library</MenuItem>
          </>
        ) : null}
      </ContextualMenuPopup>
    </ContextualMenu>
  );
}

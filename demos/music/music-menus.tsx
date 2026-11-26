"use client";

import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import {
  MenuCheckboxItem,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
} from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import type { TableViewSort } from "macalicious/table-view";
import { type ReactNode, useEffect, useState } from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { requestHelp } from "../desktop/desktop-help";
import { LinkShareItems } from "../desktop/desktop-share-link";
import { hasEncoder, type LossyFormat, noEncoder } from "./music-convert";
import { RatingSubmenu, SORTABLE_COLUMNS } from "./music-library-views";
import type { MusicPlayer, PlayerState } from "./music-player";
import type { LibraryPlaylist, RepeatMode, ShuffleBy } from "./music-server";
import type { MusicShortcut } from "./music-shortcuts";
import { VISUALIZER_DRAWINGS, type VisualizerDrawing } from "./music-visualizer";

/** How far Increase and Decrease Volume move the volume, out of 100. */
export const VOLUME_STEP = 10;

const NO_STORE = "The iTunes Store is not part of this desktop.";
const NO_DISC = "This desktop has no disc drive.";
const NO_CLOUD = "Every song here is already on your drive or at the Internet Archive.";
const NO_GENIUS =
  "Select a song: a Genius playlist is made here from its artist, its genre and your own library.";
const NO_ARTWORK_TO_READ =
  "Every song on your drive has its artwork, and nothing here looks artwork up online. Song Info's Artwork pane takes a picture.";
const IN_THE_DESKTOP = "You are signed in to this desktop, and Music uses that account.";
const NO_HOME_SHARING = "Only an account with a password can share its library or hear another's.";

/** One command of a menu, which its key equivalent also runs. */
interface Command {
  title: string;
  key?: string;
  enabled: boolean;
  run: () => void;
  /** A key a text field keeps for itself while it has the keyboard. */
  text?: boolean;
}

/** What the window hands its menus. */
export interface MusicMenusProps {
  /** An element of the window, which makes it the application's last used. */
  within: Element | null;
  player: MusicPlayer;
  playing: PlayerState;
  /** Whether the window takes commands yet. */
  ready: boolean;
  /** The songs the Song menu acts on: the selection, else the album chosen, else the song loaded. */
  targets: readonly string[];
  /** The songs on screen and chosen, which Delete from Library may take: never just the song loaded. */
  deletable: readonly string[];
  /** How many rows are selected in the list shown. */
  selected: number;
  /** How many rows the list shown has. */
  shown: number;
  /** Whether the current playlist can take songs (Paste) and give them up (Cut). */
  inPlaylist: boolean;
  canPaste: boolean;
  canUndo: boolean;
  canRedo: boolean;
  loved: boolean;
  playlists: readonly LibraryPlaylist[];
  panel: "lyrics" | "up-next" | null;
  miniOpen: boolean;
  sidebarShown: boolean;
  statusBarShown: boolean;
  setStatusBarShown: (shown: boolean) => void;
  /** The list's sort, when a list that can be sorted is shown. */
  sort: TableViewSort | null;
  setSort: (sort: TableViewSort) => void;
  openViewOptions: () => void;
  /** Whether the first target is a file of the drive, which Finder can show. */
  canShowInFinder: boolean;
  hasCurrent: boolean;
  /** The song loaded, which the Dock menu names. */
  nowPlaying: { title: string; artist: string } | null;
  /** Whether songs other than the one loaded are selected: Play, while paused, starts there. */
  selectionElsewhere: boolean;
  importSongs: () => void;
  /** File > Page Setup…: the paper Print uses. */
  pageSetup: () => void;
  /** File > Open Stream…. */
  openStream: () => void;
  /** File > Convert: writes a version of each of `songs`, in WAV when no format is named. */
  convert: (songs: readonly string[], format?: LossyFormat) => void;
  /** Whether every target is a file of the drive, which is what Convert reads. */
  canConvert: boolean;
  startPlaying: () => void;
  newPlaylist: (songs: readonly string[]) => void;
  newFolder: () => void;
  newSmart: () => void;
  /** Makes a Genius playlist from the first target; `null` with no target. */
  genius: (() => void) | null;
  /** The smart playlist shown, whose rules File > Edit Smart Playlist opens. */
  editSmart: (() => void) | null;
  love: (songs: readonly string[]) => void;
  /** The rating the targets share, and whether all of them are disliked. */
  rating: number | null;
  disliked: boolean;
  /** Whether the one target is in the library, so an album of it can be shown. */
  canShowInAlbum: boolean;
  /** The one target's web address, when one song is the target and it has one. */
  shareUrl: string;
  /** The one target's title, handed with its link. */
  shareTitle: string;
  rate: (songs: readonly string[], stars: number | null) => void;
  dislike: (songs: readonly string[]) => void;
  showInAlbum: (song: string) => void;
  addToPlaylist: (songs: readonly string[], playlist: string) => void;
  remove: (songs: readonly string[]) => void;
  deleteFromLibrary: (songs: readonly string[]) => void;
  songInfo: (songs: readonly string[]) => void;
  playNext: (songs: readonly string[]) => void;
  playLater: (songs: readonly string[]) => void;
  showInFinder: (song: string) => void;
  undo: () => void;
  redo: () => void;
  cut: () => void;
  copy: () => void;
  paste: () => void;
  selectAll: () => void;
  deselectAll: () => void;
  focusSearch: () => void;
  setPanel: (panel: "lyrics" | "up-next" | null) => void;
  setSidebarShown: (shown: boolean) => void;
  goToCurrent: () => void;
  toggleMini: () => void;
  equalizerOpen: boolean;
  toggleEqualizer: () => void;
  visualizerShown: boolean;
  toggleVisualizer: () => void;
  visualizerDrawing: VisualizerDrawing;
  setVisualizerDrawing: (drawing: VisualizerDrawing) => void;
  openShortcuts: (shortcuts: readonly MusicShortcut[]) => void;
  columnBrowserShown: boolean;
  /** Whether the Songs list is shown, the only list with a Column Browser. */
  columnBrowserAvailable: boolean;
  toggleColumnBrowser: () => void;
  /** The list shown, by name, which Export Playlist and Print take. */
  listName: string | null;
  exportPlaylist: () => void;
  exportLibrary: () => void;
  /** File > Library > Get Album Artwork: reads the pictures in the songs' own files. */
  getArtwork: (() => void) | null;
  /** File > Home Sharing: whether it is on, and what the row does; `null` for a Guest User. */
  homeSharing: { on: boolean; run: () => void } | null;
  importPlaylist: () => void;
  print: () => void;
  /** Whether only the library's duplicates are shown. */
  duplicatesShown: boolean;
  toggleDuplicates: () => void;
  /** Whether the library's views show only the songs on the drive. */
  onlyDownloaded: boolean;
  setOnlyDownloaded: (only: boolean) => void;
  /** File > Library > Organize Library. */
  organize: () => void;
  /** Preferences, Star ratings: whether Song > Rating is offered. */
  ratings: boolean;
  /** Window > Music: brings this window forward. */
  bringForward: () => void;
  /** The hand-made playlists holding the one target, for Show in Playlist. */
  holding: readonly LibraryPlaylist[];
  showInPlaylist: (song: string, playlist: string) => void;
}

function dimmed(title: string, reason: string, key?: string) {
  return (
    <MenuItem key={title} disabled title={reason} keyEquivalent={key}>
      {title}
    </MenuItem>
  );
}

/**
 * Music's own items in the desktop's menu bar, while its window is the application's last used
 * (`desktop-app-menus.ts`), and the key equivalents they show. Answers the function the window's
 * key handler calls: whether it ran a command for a `keydown`.
 *
 * Rows for what needs the iTunes Store, Apple's cloud or a disc stay, dimmed, saying why.
 */
export function useMusicMenus(props: MusicMenusProps) {
  const [encoders, setEncoders] = useState({ aac: false, mp3: false });
  useEffect(() => {
    let live = true;
    void Promise.all([hasEncoder("aac"), hasEncoder("mp3")]).then(([aac, mp3]) => {
      if (live) setEncoders({ aac, mp3 });
    });
    return () => {
      live = false;
    };
  }, []);
  const { player, playing, targets, within, ready, panel } = props;
  const hasSongs = ready && targets.length > 0;
  const hasQueue = ready && playing.queue.length > 0;
  const { sort } = props;
  const commands = {
    newPlaylist: {
      title: "Playlist",
      key: "command+n",
      enabled: ready,
      run: () => props.newPlaylist([]),
    },
    playlistFromSelection: {
      title: "Playlist from Selection",
      key: "shift+command+n",
      enabled: ready && props.selected > 0,
      run: () => props.newPlaylist(targets),
    },
    newFolder: {
      title: "Playlist Folder",
      enabled: ready,
      run: props.newFolder,
    },
    newSmart: {
      title: "Smart Playlist…",
      key: "option+command+n",
      enabled: ready,
      run: props.newSmart,
    },
    editSmart: {
      title: "Edit Smart Playlist…",
      enabled: ready && props.editSmart !== null,
      run: () => props.editSmart?.(),
    },
    pageSetup: { title: "Page Setup…", enabled: ready, run: props.pageSetup },
    importSongs: {
      title: "Import…",
      key: "command+o",
      enabled: ready,
      run: props.importSongs,
    },
    openStream: {
      title: "Open Stream…",
      key: "command+u",
      enabled: ready,
      run: props.openStream,
    },
    convertWav: {
      title: "Create WAV Version",
      enabled: ready && props.canConvert,
      run: () => props.convert(targets),
    },
    convertMp3: {
      title: "Create MP3 Version",
      enabled: ready && props.canConvert,
      run: () => props.convert(targets, "mp3"),
    },
    convertAac: {
      title: "Create AAC Version",
      enabled: ready && props.canConvert,
      run: () => props.convert(targets, "aac"),
    },
    showInFinder: {
      title: "Show in Finder",
      key: "shift+command+r",
      enabled: ready && props.canShowInFinder,
      run: () => {
        const song = targets[0];
        if (song) props.showInFinder(song);
      },
    },
    importPlaylist: { title: "Import Playlist…", enabled: ready, run: props.importPlaylist },
    exportPlaylist: {
      title: "Export Playlist…",
      enabled: ready && props.listName !== null,
      run: props.exportPlaylist,
    },
    exportLibrary: { title: "Export Library…", enabled: ready, run: props.exportLibrary },
    getArtwork: {
      title: "Get Album Artwork",
      enabled: ready && props.getArtwork !== null,
      run: () => props.getArtwork?.(),
    },
    organize: { title: "Organize Library…", enabled: ready, run: props.organize },
    homeSharing: {
      title: props.homeSharing?.on ? "Turn Off Home Sharing" : "Turn On Home Sharing…",
      enabled: props.homeSharing !== null,
      run: () => props.homeSharing?.run(),
    },
    bringForward: {
      title: "Music",
      key: "option+command+1",
      enabled: true,
      run: props.bringForward,
    },
    duplicates: {
      title: props.duplicatesShown ? "Show All Items" : "Show Duplicate Items",
      enabled: ready,
      run: props.toggleDuplicates,
    },
    print: {
      title: "Print…",
      key: "command+p",
      enabled: ready && props.listName !== null,
      run: props.print,
    },
    undo: { title: "Undo", key: "command+z", enabled: props.canUndo, run: props.undo, text: true },
    redo: {
      title: "Redo",
      key: "shift+command+z",
      enabled: props.canRedo,
      run: props.redo,
      text: true,
    },
    cut: {
      title: "Cut",
      key: "command+x",
      enabled: ready && props.inPlaylist && props.selected > 0,
      run: props.cut,
      text: true,
    },
    copy: {
      title: "Copy",
      key: "command+c",
      enabled: ready && props.selected > 0,
      run: props.copy,
      text: true,
    },
    paste: {
      title: "Paste",
      key: "command+v",
      enabled: ready && props.inPlaylist && props.canPaste,
      run: props.paste,
      text: true,
    },
    delete: {
      title: "Delete",
      key: "delete",
      enabled: ready && props.selected > 0,
      run: () => props.remove(targets),
      text: true,
    },
    selectAll: {
      title: "Select All",
      key: "command+a",
      enabled: ready && props.shown > 0,
      run: props.selectAll,
      text: true,
    },
    deselectAll: {
      title: "Deselect All",
      key: "shift+command+a",
      enabled: ready && props.selected > 0,
      run: props.deselectAll,
      text: true,
    },
    find: { title: "Find", key: "command+f", enabled: ready, run: props.focusSearch },
    search: { title: "Search", key: "option+command+f", enabled: ready, run: props.focusSearch },
    columnBrowser: {
      title: props.columnBrowserShown ? "Hide Column Browser" : "Show Column Browser",
      key: "command+b",
      enabled: ready && props.columnBrowserAvailable,
      run: props.toggleColumnBrowser,
    },
    songInfo: {
      title: "Song Info",
      key: "command+i",
      enabled: hasSongs,
      run: () => props.songInfo(targets),
    },
    love: {
      title: props.loved ? "Unlove" : "Love",
      enabled: hasSongs,
      run: () => props.love(targets),
    },
    deleteFromLibrary: {
      title: "Delete from Library",
      enabled: ready && props.deletable.length > 0,
      run: () => props.deleteFromLibrary(props.deletable),
    },
    playNext: { title: "Play Next", enabled: hasSongs, run: () => props.playNext(targets) },
    playLater: { title: "Play Later", enabled: hasSongs, run: () => props.playLater(targets) },
    sidebar: {
      title: props.sidebarShown ? "Hide Sidebar" : "Show Sidebar",
      key: "option+command+s",
      enabled: ready,
      run: () => props.setSidebarShown(!props.sidebarShown),
    },
    statusBar: {
      title: props.statusBarShown ? "Hide Status Bar" : "Show Status Bar",
      key: "command+/",
      enabled: ready,
      run: () => props.setStatusBarShown(!props.statusBarShown),
    },
    viewOptions: {
      title: "Show View Options",
      key: "command+j",
      enabled: ready,
      run: props.openViewOptions,
    },
    upNext: {
      title: panel === "up-next" ? "Hide Up Next" : "Show Up Next",
      key: "control+command+u",
      enabled: ready,
      run: () => props.setPanel(panel === "up-next" ? null : "up-next"),
    },
    visualizer: {
      title: props.visualizerShown ? "Hide Visualizer" : "Show Visualizer",
      key: "command+t",
      enabled: ready,
      run: props.toggleVisualizer,
    },
    lyrics: {
      title: panel === "lyrics" ? "Hide Lyrics" : "Show Lyrics",
      key: "control+command+l",
      enabled: ready,
      run: () => props.setPanel(panel === "lyrics" ? null : "lyrics"),
    },
    play: {
      title: playing.playing ? "Pause" : "Play",
      key: "space",
      text: true,
      enabled: ready && (props.hasCurrent || props.shown > 0),
      run: () =>
        props.hasCurrent && (playing.playing || !props.selectionElsewhere)
          ? player.toggle()
          : props.startPlaying(),
    },
    stop: {
      title: "Stop",
      key: "command+.",
      enabled: ready && props.hasCurrent,
      run: () => {
        player.pause();
        player.seek(0);
      },
    },
    next: { title: "Next", key: "command+right", enabled: hasQueue, run: () => player.next() },
    previous: {
      title: "Previous",
      key: "command+left",
      enabled: hasQueue,
      run: () => player.previous(),
    },
    goToCurrent: {
      title: "Go to Current Song",
      key: "command+l",
      enabled: ready && props.hasCurrent,
      run: props.goToCurrent,
    },
    volumeUp: {
      title: "Increase Volume",
      key: "command+up",
      enabled: ready && playing.volume < 100,
      run: () => player.setVolume(Math.min(100, playing.volume + VOLUME_STEP)),
    },
    volumeDown: {
      title: "Decrease Volume",
      key: "command+down",
      enabled: ready && playing.volume > 0,
      run: () => player.setVolume(Math.max(0, playing.volume - VOLUME_STEP)),
    },
    mini: {
      title: props.miniOpen ? "Close MiniPlayer" : "Switch to MiniPlayer",
      key: "shift+command+m",
      enabled: true,
      run: props.toggleMini,
    },
    equalizer: {
      title: props.equalizerOpen ? "Close Equalizer" : "Equalizer",
      key: "option+command+e",
      enabled: true,
      run: props.toggleEqualizer,
    },
  } satisfies Record<string, Command>;

  const row = (command: Command, title: ReactNode = command.title) => (
    <MenuItem
      key={command.title}
      keyEquivalent={command.key}
      disabled={!command.enabled}
      onClick={command.run}
    >
      {title}
    </MenuItem>
  );

  useDesktopAppMenu(
    "music",
    "File",
    <>
      <Submenu>
        <SubmenuTrigger>New</SubmenuTrigger>
        <SubmenuPopup>
          {row(commands.newPlaylist)}
          {row(commands.playlistFromSelection)}
          {row(commands.newSmart)}
          {row(commands.newFolder)}
          {props.genius ? (
            <MenuItem onClick={props.genius}>Genius Playlist</MenuItem>
          ) : (
            dimmed("Genius Playlist", NO_GENIUS)
          )}
        </SubmenuPopup>
      </Submenu>
      {row(commands.editSmart)}
      <MenuSeparator />
      {row(commands.importSongs)}
      {row(commands.openStream)}
      <Submenu>
        <SubmenuTrigger>Library</SubmenuTrigger>
        <SubmenuPopup>
          {row(commands.organize)}
          {row(commands.exportLibrary)}
          {row(commands.importPlaylist)}
          {row(commands.exportPlaylist)}
          <MenuSeparator />
          {row(commands.duplicates)}
          <MenuSeparator />
          {props.getArtwork
            ? row(commands.getArtwork)
            : dimmed("Get Album Artwork", NO_ARTWORK_TO_READ)}
          {dimmed("Update Cloud Library", NO_CLOUD)}
        </SubmenuPopup>
      </Submenu>
      {row(commands.showInFinder)}
      <MenuSeparator />
      {props.homeSharing ? (
        <Submenu>
          <SubmenuTrigger>Home Sharing</SubmenuTrigger>
          <SubmenuPopup>{row(commands.homeSharing)}</SubmenuPopup>
        </Submenu>
      ) : (
        dimmed("Home Sharing", NO_HOME_SHARING)
      )}
      {dimmed("Burn Playlist to Disc…", NO_DISC)}
      <Submenu>
        <SubmenuTrigger>Convert</SubmenuTrigger>
        <SubmenuPopup>
          {row(commands.convertWav)}
          {encoders.mp3 ? row(commands.convertMp3) : dimmed("Create MP3 Version", noEncoder("mp3"))}
          {encoders.aac ? row(commands.convertAac) : dimmed("Create AAC Version", noEncoder("aac"))}
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      {row(commands.pageSetup)}
      {row(commands.print)}
    </>,
    within,
  );
  useDesktopAppMenu(
    "music",
    "Edit",
    <>
      {row(commands.undo)}
      {row(commands.redo)}
      <MenuSeparator />
      {row(commands.cut)}
      {row(commands.copy)}
      {row(commands.paste)}
      {row(commands.delete)}
      {row(commands.selectAll)}
      {row(commands.deselectAll)}
      <MenuSeparator />
      {row(commands.find)}
    </>,
    within,
  );
  useDesktopAppMenu(
    "music",
    "Song",
    <>
      {row(commands.playNext)}
      {row(commands.playLater)}
      <MenuSeparator />
      {row(commands.songInfo)}
      {row(commands.love)}
      <MenuItem disabled={!hasSongs} onClick={() => props.dislike(targets)}>
        {props.disliked ? "Undo Dislike" : "Dislike"}
      </MenuItem>
      {props.ratings ? (
        <RatingSubmenu
          value={props.rating}
          disabled={!hasSongs}
          onChange={(stars) => props.rate(targets, stars)}
        />
      ) : null}
      <Submenu>
        <SubmenuTrigger disabled={!hasSongs}>Add to Playlist</SubmenuTrigger>
        <SubmenuPopup>
          <MenuItem onClick={() => props.newPlaylist(targets)}>New Playlist</MenuItem>
          {props.playlists.length > 0 ? <MenuSeparator /> : null}
          {props.playlists.map((list) => (
            <MenuItem key={list.id} onClick={() => props.addToPlaylist(targets, list.id)}>
              {list.name}
            </MenuItem>
          ))}
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <MenuItem
        disabled={!props.canShowInAlbum}
        onClick={() => {
          if (targets[0]) props.showInAlbum(targets[0]);
        }}
      >
        Show in Album
      </MenuItem>
      <Submenu>
        <SubmenuTrigger disabled={props.holding.length === 0}>Show in Playlist</SubmenuTrigger>
        <SubmenuPopup>
          {props.holding.map((list) => (
            <MenuItem
              key={list.id}
              onClick={() => {
                if (targets[0]) props.showInPlaylist(targets[0], list.id);
              }}
            >
              {list.name}
            </MenuItem>
          ))}
        </SubmenuPopup>
      </Submenu>
      <Submenu>
        <SubmenuTrigger disabled={!hasSongs || targets.length !== 1}>Share Song</SubmenuTrigger>
        <SubmenuPopup>
          <LinkShareItems plain url={props.shareUrl} title={props.shareTitle} from="music" />
        </SubmenuPopup>
      </Submenu>
      {dimmed("Show in iTunes Store", NO_STORE)}
      {row(commands.deleteFromLibrary)}
    </>,
    within,
  );
  useDesktopAppMenu(
    "music",
    "View",
    <>
      {row(commands.sidebar)}
      {row(commands.statusBar)}
      {row(commands.columnBrowser)}
      {row(commands.upNext)}
      {row(commands.lyrics)}
      {row(commands.visualizer)}
      <Submenu>
        <SubmenuTrigger>Visualizer</SubmenuTrigger>
        <SubmenuPopup>
          <MenuRadioGroup
            value={props.visualizerDrawing}
            onValueChange={(drawing) => props.setVisualizerDrawing(drawing as VisualizerDrawing)}
          >
            {VISUALIZER_DRAWINGS.map(({ id, title }) => (
              <MenuRadioItem key={id} value={id}>
                {title}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <MenuCheckboxItem
        disabled={!ready}
        checked={props.onlyDownloaded}
        onCheckedChange={props.setOnlyDownloaded}
      >
        Only Downloaded Music
      </MenuCheckboxItem>
      <MenuSeparator />
      <Submenu>
        <SubmenuTrigger disabled={!sort}>Sort By</SubmenuTrigger>
        <SubmenuPopup>
          <MenuRadioGroup
            value={sort?.column ?? ""}
            onValueChange={(column) => {
              if (sort) props.setSort({ ...sort, column: column as string });
            }}
          >
            {SORTABLE_COLUMNS.map(({ id, title }) => (
              <MenuRadioItem key={id} value={id}>
                {title}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
          <MenuSeparator />
          <MenuRadioGroup
            value={sort?.direction ?? ""}
            onValueChange={(direction) => {
              if (sort) {
                props.setSort({ ...sort, direction: direction as TableViewSort["direction"] });
              }
            }}
          >
            <MenuRadioItem value="ascending">Ascending</MenuRadioItem>
            <MenuRadioItem value="descending">Descending</MenuRadioItem>
          </MenuRadioGroup>
        </SubmenuPopup>
      </Submenu>
      {row(commands.viewOptions)}
      <MenuSeparator />
    </>,
    within,
  );
  useDesktopAppMenu(
    "music",
    "Controls",
    <>
      {row(commands.play)}
      {row(commands.stop)}
      {row(commands.next)}
      {row(commands.previous)}
      {row(commands.goToCurrent)}
      <MenuSeparator />
      {row(commands.volumeUp)}
      {row(commands.volumeDown)}
      <MenuSeparator />
      <Submenu>
        <SubmenuTrigger>Shuffle</SubmenuTrigger>
        <SubmenuPopup>
          <MenuRadioGroup
            value={playing.shuffle ? "on" : "off"}
            onValueChange={(value) => player.setShuffle(value === "on")}
          >
            <MenuRadioItem value="off">Off</MenuRadioItem>
            <MenuRadioItem value="on">On</MenuRadioItem>
          </MenuRadioGroup>
          <MenuSeparator />
          <MenuRadioGroup
            value={playing.shuffleBy ?? "songs"}
            onValueChange={(value) => player.setShuffleBy(value as ShuffleBy)}
          >
            <MenuRadioItem value="songs">Songs</MenuRadioItem>
            <MenuRadioItem value="albums">Albums</MenuRadioItem>
            <MenuRadioItem value="groupings">Groupings</MenuRadioItem>
          </MenuRadioGroup>
        </SubmenuPopup>
      </Submenu>
      <Submenu>
        <SubmenuTrigger>Repeat</SubmenuTrigger>
        <SubmenuPopup>
          <MenuRadioGroup
            value={playing.repeat}
            onValueChange={(value) => player.setRepeat(value as RepeatMode)}
          >
            <MenuRadioItem value="off">Off</MenuRadioItem>
            <MenuRadioItem value="all">All</MenuRadioItem>
            <MenuRadioItem value="one">One</MenuRadioItem>
          </MenuRadioGroup>
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      {dimmed("Eject Disc", NO_DISC, "command+e")}
    </>,
    within,
  );
  useDesktopAppMenu(
    "music",
    "Account",
    <>
      {dimmed("Sign In…", IN_THE_DESKTOP)}
      <MenuSeparator />
      {dimmed("Check for Available Downloads…", NO_STORE)}
      {dimmed("Authorizations", NO_STORE)}
      {dimmed("Wish List", NO_STORE)}
      {dimmed("Purchased", NO_STORE)}
      {dimmed("Redeem…", NO_STORE)}
    </>,
    within,
  );
  useDesktopAppMenu(
    "music",
    "Window",
    <>
      {row(commands.mini)}
      {row(commands.equalizer)}
      {row(commands.visualizer, "Visualizer")}
      <MenuSeparator />
    </>,
    within,
  );
  useDesktopAppMenu(
    "music",
    "Help",
    <>
      <MenuItem onClick={() => requestHelp("Music")}>Music Help</MenuItem>
      <MenuItem
        onClick={() =>
          props.openShortcuts(
            (Object.values(commands) as Command[]).flatMap(({ title, key }) =>
              key ? [{ title, key }] : [],
            ),
          )
        }
      >
        Keyboard Shortcuts
      </MenuItem>
    </>,
    within,
  );
  useDesktopAppMenu(
    "music",
    "Dock",
    <>
      {props.nowPlaying ? (
        <>
          <MenuItem disabled>Now Playing</MenuItem>
          <MenuItem disabled>{props.nowPlaying.title}</MenuItem>
          {props.nowPlaying.artist ? <MenuItem disabled>{props.nowPlaying.artist}</MenuItem> : null}
          <MenuSeparator />
        </>
      ) : null}
      <MenuItem disabled={!commands.play.enabled} onClick={commands.play.run}>
        {commands.play.title}
      </MenuItem>
      <MenuItem disabled={!commands.next.enabled} onClick={commands.next.run}>
        Next
      </MenuItem>
      <MenuItem disabled={!commands.previous.enabled} onClick={commands.previous.run}>
        Previous
      </MenuItem>
    </>,
    within,
  );

  return (event: KeyboardEvent, typing: boolean): boolean => {
    const command = (Object.values(commands) as Command[]).find(
      (each) => each.key && matchesMenuKeyEquivalent(event, each.key),
    );
    if (!command?.enabled || (typing && command.text)) return false;
    command.run();
    return true;
  };
}

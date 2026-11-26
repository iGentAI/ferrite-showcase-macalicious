"use client";

import { EmptyState } from "macalicious/empty-state";
import { cn } from "macalicious/lib/cn";
import { windowDragRegion } from "macalicious/lib/window-drag-region";
import {
  MediaAppChrome,
  MediaAppChromeBar,
  MediaAppChromeButton,
  MediaAppChromeControls,
  MediaAppChromeDisplay,
  MediaAppChromePane,
  MediaAppChromeSidebar,
  MediaAppChromeTransport,
  MediaAppChromeVolume,
} from "macalicious/media-app-chrome";
import { NowPlayingLcd } from "macalicious/now-playing-lcd";
import { ScrollView } from "macalicious/scroll-view";
import { SearchField } from "macalicious/search-field";
import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";
import { Window, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AlbumCover, SectionIcon } from "./music-artwork";
import {
  albumMatches,
  defaultAlbums,
  defaultSettings as initialSettings,
  LIST_ROW_HEIGHT,
  type MusicAlbum,
  type MusicSection,
  type MusicSettings,
  type MusicTrack,
  SECTIONS,
  trackMatches,
  tracksOf,
} from "./music-data";
import { MusicPreferences, PREFERENCES_WIDTH } from "./music-preferences";
import { AlbumDetail, AlbumGrid, SidePanel, SongList } from "./music-views";
import "./music.tokens.css";
import "./music.css";

const FILL: CSSProperties = { height: "100%" };

/**
 * Music's source list, set with the Sidebar's spacing properties as its page gives them: rows
 * that touch (a 24 pt pitch), 10 pt between sections, the label 5 pt after the icon and the
 * headers 2 pt lower.
 */
const SOURCE_LIST = {
  "--mac-sidebar-row-spacing": "0px",
  "--mac-sidebar-section-gap": "10px",
  "--mac-sidebar-label-gap": "5px",
  "--mac-sidebar-header-inset": "4px",
} as CSSProperties;

/** What is loaded in the player: a queue, the place in it and the position in the song. */
interface Player {
  queue: readonly MusicTrack[];
  index: number;
  elapsed: number;
  playing: boolean;
}

type PlayerAction =
  | { type: "play"; queue: readonly MusicTrack[]; index: number }
  | { type: "toggle" }
  | { type: "next" }
  | { type: "previous" }
  | { type: "seek"; elapsed: number }
  | { type: "tick" };

const IDLE: Player = { queue: [], index: 0, elapsed: 0, playing: false };

/** The next song of the queue, or nothing loaded after the last one. */
function advance(player: Player): Player {
  return player.index + 1 < player.queue.length
    ? { ...player, index: player.index + 1, elapsed: 0 }
    : IDLE;
}

function reduce(player: Player, action: PlayerAction): Player {
  const current = player.queue[player.index];
  if (action.type === "play") {
    return action.queue[action.index]
      ? { queue: action.queue, index: action.index, elapsed: 0, playing: true }
      : player;
  }
  if (!current) return player;
  switch (action.type) {
    case "toggle":
      return { ...player, playing: !player.playing };
    case "next":
      return advance(player);
    case "previous":
      // As in Music: back to the start of the song first, to the song before from there.
      return player.elapsed > 3 || player.index === 0
        ? { ...player, elapsed: 0 }
        : { ...player, index: player.index - 1, elapsed: 0 };
    case "seek":
      return { ...player, elapsed: Math.min(Math.max(action.elapsed, 0), current.song.duration) };
    case "tick":
      if (!player.playing) return player;
      return player.elapsed + 1 >= current.song.duration
        ? advance(player)
        : { ...player, elapsed: player.elapsed + 1 };
  }
}

export interface MusicProps extends Omit<WindowProps, "children"> {
  /**
   * The library: the albums with their songs. Every album of the default library is invented
   * for the demo.
   * @default the eight albums of `defaultAlbums`
   */
  albums?: readonly MusicAlbum[];
  /**
   * The sidebar row selected at first.
   * @default "albums"
   */
  defaultSection?: MusicSection;
  /** Called with the sidebar row the user selects. */
  onSectionChange?: (section: MusicSection) => void;
  /**
   * The volume at first, from 0 to 100. Nothing is played: the transport is simulated.
   * @default 100
   */
  defaultVolume?: number;
  /**
   * The sidebar's surface: the vibrant material, for a window over a desktop, or the same
   * surface as captured over a neutral window.
   * @default "translucent"
   */
  material?: "translucent" | "opaque";
  /**
   * The settings the Preferences window starts with.
   * @default the settings of the reference screenshots
   */
  defaultSettings?: MusicSettings;
  /** Whether the Preferences window is open (controlled). */
  preferencesOpen?: boolean;
  /**
   * Whether the Preferences window is open at first (uncontrolled).
   * @default false
   */
  defaultPreferencesOpen?: boolean;
  /**
   * Called when the Preferences window is asked to open (Command-comma or Control-comma in the
   * window) or to close (OK, Cancel, Escape). A menu bar opens it with `preferencesOpen`.
   */
  onPreferencesOpenChange?: (open: boolean) => void;
  /**
   * The element the Preferences window is rendered into, centred over the Music window.
   * @default the Music window's offset parent, or the document's body
   */
  preferencesContainer?: HTMLElement | null;
  /** Called when the close button is activated. */
  onClose?: WindowControlsProps["onClose"];
  /** Called when the minimize button is activated. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** Called when the zoom button is activated. */
  onZoom?: WindowControlsProps["onZoom"];
  /** What the zoom button does, as on `WindowControls`. */
  zoomRole?: WindowControlsProps["zoomRole"];
  /** Disable the minimize button. */
  minimizeDisabled?: boolean;
  /** Disable the zoom button. */
  zoomDisabled?: boolean;
  /** Further props for the `WindowControls`. */
  controlsProps?: WindowControlsProps;
  /**
   * Called when the primary pointer button goes down on the playback bar or the top of the
   * sidebar, not on a control in them. Music has no title bar: these are its drag region, and
   * a window manager starts moving the window here.
   */
  onDragRegionPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  /** Called when the drag region is double-clicked: macOS zooms or minimizes the window. */
  onDragRegionDoubleClick?: (event: MouseEvent<HTMLDivElement>) => void;
}

/**
 * Music, as in macOS 10.15 Catalina: a full-height sidebar with the window controls and a
 * search field, a playback bar with transport buttons, the now-playing display and the volume,
 * and a content pane with the album grid, the song list and the chosen album's details.
 *
 * The root is the library's `Window` and takes every one of its props, so a page or a window
 * manager places it (`style`, `width`, `height`, `ref`), tells it whether it is key (`state`)
 * and hears its window controls and its drag region through the callbacks. Playback is
 * simulated: a clock advances the position, and no sound is produced.
 */
export function Music({
  albums = defaultAlbums,
  defaultSection = "albums",
  onSectionChange,
  defaultVolume = 100,
  material = "translucent",
  defaultSettings = initialSettings,
  preferencesOpen,
  defaultPreferencesOpen = false,
  onPreferencesOpenChange,
  preferencesContainer,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  controlsProps,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  state = "key",
  width = 1220,
  height = 720,
  className,
  ref,
  onKeyDown,
  ...props
}: MusicProps) {
  const [settings, setSettings] = useState(defaultSettings);
  // A place that the settings hide is not selected, at first either.
  const [section, setSection] = useState<MusicSection>(
    defaultSection === "itunes-store" && !defaultSettings.showStore ? "albums" : defaultSection,
  );
  const [query, setQuery] = useState("");
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [volume, setVolume] = useState(defaultVolume);
  const [panel, setPanel] = useState<"lyrics" | "up-next" | null>(null);
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(() => new Set());
  const [player, dispatch] = useReducer(reduce, IDLE);
  const [ownOpen, setOwnOpen] = useState(defaultPreferencesOpen);
  const open = preferencesOpen ?? ownOpen;
  const setOpen = (next: boolean) => {
    if (preferencesOpen === undefined) setOwnOpen(next);
    onPreferencesOpenChange?.(next);
  };

  // The simulated transport: one second of the song per second while it plays.
  useEffect(() => {
    if (!player.playing) return;
    const timer = setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => clearInterval(timer);
  }, [player.playing]);

  const tracks = useMemo(() => tracksOf(albums), [albums]);
  const current = player.queue[player.index] ?? null;
  const upcoming = useMemo(
    () => player.queue.slice(player.index + 1),
    [player.queue, player.index],
  );
  const play = useCallback(
    (queue: readonly MusicTrack[], index: number) => dispatch({ type: "play", queue, index }),
    [],
  );
  const playAlbum = (album: MusicAlbum) => play(tracksOf([album]), 0);
  const selected = albums.find((album) => album.id === albumId) ?? null;

  // Play with nothing loaded starts the chosen album, or the library from its first song.
  const togglePlayback = () => {
    if (current) dispatch({ type: "toggle" });
    else play(selected ? tracksOf([selected]) : tracks, 0);
  };

  const selectAlbum = (id: string) => setAlbumId((now) => (now === id ? null : id));
  const setChecked = (id: string, checked: boolean) =>
    setUnchecked((now) => {
      const next = new Set(now);
      if (checked) next.delete(id);
      else next.add(id);
      return next;
    });

  // The Preferences window is a window of its own, so it is rendered outside this one, over
  // its middle. Its place is read from the frame when it opens and again whenever this window
  // is rendered while it is open, so it follows a host that moves or resizes the Music
  // window. The element that has the keyboard focus is noted when it opens, in the same step,
  // before the browser takes the focus away from content that has just become inert.
  const frame = useRef<HTMLDivElement | null>(null);
  const preferences = useRef<HTMLDivElement>(null);
  const focusBefore = useRef<Element | null>(null);
  const placed = useRef(false);
  const [anchor, setAnchor] = useState<{
    container: HTMLElement;
    left: number;
    top: number;
  } | null>(null);
  useLayoutEffect(() => {
    const element = frame.current;
    if (!open || !element) {
      placed.current = false;
      setAnchor(null);
      return;
    }
    const page = element.ownerDocument;
    const view = page.defaultView;
    if (!placed.current) focusBefore.current = page.activeElement;
    placed.current = true;
    const container =
      preferencesContainer ??
      (element.offsetParent instanceof HTMLElement ? element.offsetParent : null) ??
      page.body;
    // The dialog is placed against its containing block: the container, or the nearest
    // positioned element around it, or the page when there is none.
    let block: HTMLElement | null = container;
    while (block && view?.getComputedStyle(block).position === "static") {
      block = block.parentElement;
    }
    const box = element.getBoundingClientRect();
    const origin = block?.getBoundingClientRect();
    const left =
      block && origin
        ? box.left - origin.left - block.clientLeft + block.scrollLeft
        : box.left + (view?.scrollX ?? 0);
    const top =
      block && origin
        ? box.top - origin.top - block.clientTop + block.scrollTop
        : box.top + (view?.scrollY ?? 0);
    const next = {
      container,
      left: left + Math.max(0, (box.width - PREFERENCES_WIDTH) / 2),
      top: top + Math.min(64, box.height / 8),
    };
    setAnchor((now) =>
      now && now.container === container && now.left === next.left && now.top === next.top
        ? now
        : next,
    );
  });

  // Opening moves the keyboard focus into the Preferences window, and closing gives it back.
  // Preferences that are open when the window is first rendered are left to the Preferences
  // Window, which holds the focus itself when it appears.
  const openAtFirst = useRef(open);
  const openNow = useRef(open);
  openNow.current = open;
  const shown = anchor !== null;
  useEffect(() => {
    if (!shown) {
      // Not shown yet is not closed: the place is read after the first render.
      if (!openNow.current) openAtFirst.current = false;
      return;
    }
    if (openAtFirst.current) return;
    const before = focusBefore.current;
    preferences.current
      ?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
      ?.focus({ preventScroll: true });
    return () => {
      if (before instanceof HTMLElement && before.isConnected) {
        before.focus({ preventScroll: true });
      }
    };
  }, [shown]);

  const dragRegion = windowDragRegion<HTMLDivElement>(
    onDragRegionPointerDown,
    onDragRegionDoubleClick,
  );

  const searching = query.trim() !== "";
  const sectionName =
    SECTIONS.flatMap((group) => group.items).find((item) => item.id === section)?.name ?? "";
  const groups = settings.showStore
    ? SECTIONS
    : SECTIONS.filter((group) => group.title !== "Store");
  const songList = (list: readonly MusicTrack[], label: string, fill: boolean) => (
    <SongList
      tracks={list}
      label={label}
      fill={fill}
      checkboxes={settings.songCheckboxes}
      rowHeight={rowHeight}
      unchecked={unchecked}
      onCheckedChange={setChecked}
      onPlay={play}
    />
  );
  const grid = (list: readonly MusicAlbum[], label: string, title?: string, separator = false) => (
    <AlbumGrid
      key={title ?? label}
      albums={list}
      label={label}
      title={title}
      separator={separator}
      selectedId={albumId}
      onSelect={selectAlbum}
      onPlay={playAlbum}
    />
  );
  const rowHeight = LIST_ROW_HEIGHT[settings.listSize];
  const detail = (list: readonly MusicAlbum[]) =>
    selected && list.includes(selected) ? (
      <AlbumDetail album={selected} rowHeight={rowHeight} onPlay={play} />
    ) : null;
  const page = (content: ReactNode) => (
    <ScrollView className="mac-music-main">
      <div className="mac-music-page">{content}</div>
    </ScrollView>
  );

  let content: ReactNode;
  if (searching) {
    const foundAlbums = albums.filter((album) => albumMatches(album, query));
    const foundTracks = tracks.filter((track) => trackMatches(track, query));
    content =
      foundAlbums.length + foundTracks.length === 0 ? (
        <EmptyState role="status" className="mac-music-main">
          No Results
        </EmptyState>
      ) : (
        page(
          <>
            {foundAlbums.length > 0 ? grid(foundAlbums, "Albums", "Albums") : null}
            {detail(foundAlbums)}
            <section className="mac-music-table" aria-label="Songs found">
              <div className="mac-music-heading">Songs</div>
              {songList(foundTracks, "Songs found", false)}
            </section>
          </>,
        )
      );
  } else if (section === "albums" || section === "recently-added") {
    const list = section === "albums" ? albums : [...albums].sort((a, b) => a.added - b.added);
    content = page(
      <>
        {grid(list, sectionName)}
        {detail(list)}
      </>,
    );
  } else if (section === "artists") {
    const artists = [...new Set(albums.map((album) => album.artist))].sort();
    content = page(
      <>
        {artists.map((artist, index) =>
          grid(
            albums.filter((album) => album.artist === artist),
            artist,
            artist,
            index > 0,
          ),
        )}
        {detail(albums)}
      </>,
    );
  } else if (section === "songs") {
    content = <div className="mac-music-main">{songList(tracks, "Songs", true)}</div>;
  } else {
    content = (
      <EmptyState className="mac-music-main">{sectionName} is not part of this demo</EmptyState>
    );
  }

  return (
    <>
      <Window
        aria-label="Music"
        // While its Preferences are open the window is the main window, not the key one.
        state={open && state === "key" ? "main" : state}
        width={width}
        height={height}
        className={cn("mac-music", className)}
        ref={(element) => {
          frame.current = element;
          if (typeof ref === "function") return ref(element);
          if (ref) ref.current = element;
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (event.key === "," && (event.metaKey || event.ctrlKey) && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        {...props}
      >
        {/* Preferences are modal to the application: nothing behind them can be used. */}
        <MediaAppChrome inert={open}>
          <MediaAppChromeSidebar
            material={material}
            controls={
              <WindowControls
                onClose={onClose}
                onMinimize={onMinimize}
                onZoom={onZoom}
                zoomRole={zoomRole}
                minimizeDisabled={minimizeDisabled}
                zoomDisabled={zoomDisabled}
                {...controlsProps}
              />
            }
            search={
              <SearchField
                variant="sidebar"
                value={query}
                onValueChange={(next) => setQuery(next)}
                style={{ width: "100%" }}
              />
            }
            {...dragRegion}
          >
            <Sidebar
              aria-label="Music"
              material={material}
              style={SOURCE_LIST}
              value={section}
              onValueChange={(next) => {
                setSection(next as MusicSection);
                setQuery("");
                onSectionChange?.(next as MusicSection);
              }}
            >
              {groups.map((group, index) => (
                <SidebarSection
                  key={group.title}
                  title={group.title}
                  className={index === 0 ? "mac-music-source-list-start" : undefined}
                >
                  {group.items.map((item) => (
                    <SidebarItem
                      key={item.id}
                      value={item.id}
                      label={item.name}
                      icon={<SectionIcon section={item.id} />}
                    />
                  ))}
                </SidebarSection>
              ))}
            </Sidebar>
          </MediaAppChromeSidebar>
          <MediaAppChromeBar aria-label="Playback controls" {...dragRegion}>
            <MediaAppChromeTransport>
              <MediaAppChromeButton
                glyph="previous"
                aria-label="Previous"
                disabled={!current}
                onClick={() => dispatch({ type: "previous" })}
              />
              <MediaAppChromeButton
                glyph={player.playing ? "pause" : "play"}
                aria-label={player.playing ? "Pause" : "Play"}
                disabled={tracks.length === 0}
                onClick={togglePlayback}
              />
              <MediaAppChromeButton
                glyph="next"
                aria-label="Next"
                disabled={!current}
                onClick={() => dispatch({ type: "next" })}
              />
            </MediaAppChromeTransport>
            <MediaAppChromeDisplay>
              {current ? (
                <NowPlayingLcd
                  data-window-no-drag=""
                  title={current.song.title}
                  subtitle={`${current.album.artist} — ${current.album.title}`}
                  artwork={<AlbumCover id={current.album.id} cover={current.album.cover} />}
                  elapsed={player.elapsed}
                  duration={current.song.duration}
                  onSeek={(elapsed) => dispatch({ type: "seek", elapsed })}
                />
              ) : (
                <NowPlayingLcd />
              )}
            </MediaAppChromeDisplay>
            <MediaAppChromeControls>
              <MediaAppChromeVolume
                data-window-no-drag=""
                value={volume}
                onValueChange={(next) => setVolume(next)}
              >
                <MediaAppChromeButton glyph="output" aria-label="Audio output" disabled />
              </MediaAppChromeVolume>
              <MediaAppChromeButton
                glyph="lyrics"
                aria-label="Lyrics"
                aria-pressed={panel === "lyrics"}
                onClick={() => setPanel(panel === "lyrics" ? null : "lyrics")}
              />
              <MediaAppChromeButton
                glyph="up-next"
                aria-label="Up Next"
                aria-pressed={panel === "up-next"}
                onClick={() => setPanel(panel === "up-next" ? null : "up-next")}
              />
            </MediaAppChromeControls>
          </MediaAppChromeBar>
          <MediaAppChromePane>
            <div className="mac-music-layout" style={FILL}>
              {content}
              {panel ? (
                <SidePanel
                  kind={panel}
                  current={current}
                  upcoming={upcoming}
                  onJump={(index) => play(player.queue, player.index + 1 + index)}
                />
              ) : null}
            </div>
          </MediaAppChromePane>
        </MediaAppChrome>
        <div role="status" className="mac-music-announcement">
          {settings.notifications && current
            ? `Now playing: ${current.song.title} by ${current.album.artist}`
            : ""}
        </div>
      </Window>
      {open && anchor
        ? createPortal(
            <MusicPreferences
              ref={preferences}
              // Key while Music is the front application; otherwise as its window.
              state={state}
              settings={settings}
              onApply={(next) => {
                setSettings(next);
                // A place that the new settings hide cannot stay selected.
                if (!next.showStore && section === "itunes-store") {
                  setSection("albums");
                  onSectionChange?.("albums");
                }
                setOpen(false);
              }}
              onCancel={() => setOpen(false)}
              // The Preferences belong to the Music window for a host as well: they take its
              // level, where they are in front of it because they come after it, and a press
              // on them reaches the handlers a window manager gave the Music window to bring
              // the application forward.
              onPointerDown={props.onPointerDown}
              onPointerDownCapture={props.onPointerDownCapture}
              style={{
                position: "absolute",
                left: anchor.left,
                top: anchor.top,
                zIndex: props.style?.zIndex,
              }}
            />,
            anchor.container,
          )
        : null}
    </>
  );
}

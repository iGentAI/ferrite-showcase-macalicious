"use client";

import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
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
import { SearchField } from "macalicious/search-field";
import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";
import { Window, type WindowProps, type WindowState } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  type CSSProperties,
  type HTMLAttributes,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useOwnPreferencesRaised } from "../desktop/desktop-preferences";
import { IdleMark, SectionIcon } from "./podcasts-artwork";
import { type PodcastsSection, type PodcastsSettings, SECTIONS } from "./podcasts-data";
import {
  PodcastsPreferences,
  type PodcastsPreferencesProps,
  PREFERENCES_WIDTH,
} from "./podcasts-preferences";
import "./podcasts.tokens.css";
import "./podcasts.css";

/*
 * Podcasts' source list departs from the standard one (reference/spec/apps/podcasts.md): the
 * selection is 28 pt high in a 26 pt pitch, the first row starts 22.5 pt under the search
 * field and the second header sits 1.5 pt lower. The sidebar's rows are 24 pt with 2 pt under
 * them, so the demo sets these through the parts' `style`.
 */
const SIDEBAR_ROW: CSSProperties = { height: 28, marginBlockEnd: -2 };
const FIRST_ROW: CSSProperties = { ...SIDEBAR_ROW, marginBlockStart: -2.5 };
const LATER_SECTION: CSSProperties = { paddingBlockStart: 10.5 };
/** What the value of a station's sidebar row starts with. */
const STATION_ROW = "station:";
/* Each row's label 6 pt after its 18 pt icon: the ink of "Listen Now" starts 43 pt in. */
const SOURCE_LIST = { "--mac-sidebar-label-gap": "6px" } as CSSProperties;
const FILL: CSSProperties = { height: "100%" };
const NO_BOX: CSSProperties = { display: "contents" };
/** The sidebar hidden: the column keeps only the window controls, as Music's does. */
const SIDEBAR_WIDTH_HIDDEN = 78;
const SIDEBAR_WIDTH = 260;

/** What the playback bar shows and does. */
export interface PodcastsTransport {
  /** The episode loaded in the player, as the display shows it, or `null`. */
  loaded: {
    title: string;
    subtitle: string;
    artwork: ReactNode;
    /** Seconds heard. */
    elapsed: number;
    /** Seconds long. */
    duration: number;
    onSeek: (seconds: number) => void;
  } | null;
  playing: boolean;
  /** Whether Play can start something while nothing is loaded. */
  canStart: boolean;
  onToggle: () => void;
  /** Moves the position by `seconds`, back when negative. */
  onSkip: (seconds: number) => void;
}

export interface PodcastsFrameProps extends Omit<WindowProps, "children"> {
  material: "translucent" | "opaque";
  settings: PodcastsSettings;
  onSettingsChange: (settings: PodcastsSettings) => void;
  preferencesOpen?: boolean;
  defaultPreferencesOpen: boolean;
  onPreferencesOpenChange?: (open: boolean) => void;
  preferencesContainer?: HTMLElement | null;
  /** Further props of the Preferences window. */
  preferencesProps?: Pick<PodcastsPreferencesProps, "downloadNote" | "syncNote" | "fixedSize">;
  onClose?: WindowControlsProps["onClose"];
  onMinimize?: WindowControlsProps["onMinimize"];
  onZoom?: WindowControlsProps["onZoom"];
  zoomRole?: WindowControlsProps["zoomRole"];
  minimizeDisabled?: boolean;
  zoomDisabled?: boolean;
  controlsProps?: WindowControlsProps;
  onDragRegionPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  onDragRegionDoubleClick?: (event: MouseEvent<HTMLDivElement>) => void;
  /**
   * Whether the first load is under way: the window and its Preferences are busy and inert, so
   * that nothing is changed there that the load would replace.
   */
  loading: boolean;
  section: PodcastsSection;
  onSectionChoose: (section: PodcastsSection) => void;
  /** What a sidebar row shows at its trailing edge (a count of new episodes). */
  sectionAccessory?: (section: PodcastsSection) => ReactNode;
  /**
   * Whether the sidebar shows its search field and places.
   * @default true
   */
  sidebarShown?: boolean;
  /** The rows of the contextual menu on the sidebar's places; it has none without them. */
  sidebarMenu?: ReactNode;
  /** The stations listed under the places, and the rows of each one's contextual menu. */
  stations?: readonly { id: string; name: string }[];
  stationMenu?: (id: string) => ReactNode;
  /** The station shown in place of `section`. */
  station?: string | null;
  onStationChoose?: (id: string) => void;
  /** What the bar's Up Next button takes when something is dropped on it. */
  upNextDrop?: HTMLAttributes<HTMLElement>;
  query: string;
  onQueryChange: (query: string) => void;
  transport: PodcastsTransport;
  volume: number;
  onVolumeSet: (volume: number) => void;
  /** More buttons at the bar's trailing edge, after Up Next. */
  controls?: ReactNode;
  panel: "notes" | "queue" | null;
  onPanelChange: (panel: "notes" | "queue" | null) => void;
  /** The panel the bar's two trailing buttons open, while `panel` is set. */
  panelContent: ReactNode;
  /** The pane's content: a place, a show or a search. */
  view: ReactNode;
  /** A notice over the content. */
  banner?: ReactNode;
  /** An element of the window that is not shown: the Ferrite build's audio element. */
  media?: ReactNode;
}

/**
 * The Podcasts window without what it shows: the window, the sidebar with its places and the
 * search field, the playback bar, the pane, and the Preferences window it opens beside itself.
 * `Podcasts` (the demo, with its simulated transport) and the Ferrite desktop's Podcasts (real
 * shows and audio) fill it.
 */
export function PodcastsFrame({
  material,
  settings,
  onSettingsChange,
  preferencesOpen,
  defaultPreferencesOpen,
  onPreferencesOpenChange,
  preferencesContainer,
  preferencesProps,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  controlsProps,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  loading,
  section,
  onSectionChoose,
  sectionAccessory,
  sidebarShown = true,
  sidebarMenu,
  stations = [],
  stationMenu,
  station,
  onStationChoose,
  upNextDrop,
  query,
  onQueryChange,
  transport,
  volume,
  onVolumeSet,
  controls,
  panel,
  onPanelChange,
  panelContent,
  view,
  banner,
  media,
  state = "key",
  width = 1137,
  height = 764,
  className,
  style,
  ref,
  onKeyDown,
  onPointerDownCapture,
  ...props
}: PodcastsFrameProps) {
  const [ownOpen, setOwnOpen] = useState(defaultPreferencesOpen);
  const open = preferencesOpen ?? ownOpen;
  const setOpen = (next: boolean) => {
    setOwnOpen(next);
    onPreferencesOpenChange?.(next);
  };
  // Which of the two windows is in front. Preferences come to the front when they open.
  const [front, setFront] = useState<"viewer" | "preferences">(open ? "preferences" : "viewer");
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    setFront(open ? "preferences" : "viewer");
  }
  useOwnPreferencesRaised("podcasts", () => setFront("preferences"));
  // The front window has the state the page gives the app. Behind key Preferences the
  // Podcasts window is the main window; a window behind any other is inactive.
  const stateOf = (window: "viewer" | "preferences"): WindowState =>
    front === window || !open
      ? state
      : window === "viewer" && state === "key"
        ? "main"
        : "inactive";

  // The Preferences window is a window of its own, so it is rendered outside this one, over
  // its middle. Its place is read from the frame when it opens.
  const frame = useRef<HTMLDivElement | null>(null);
  const [anchor, setAnchor] = useState<{
    container: HTMLElement;
    left: number;
    top: number;
  } | null>(null);
  useLayoutEffect(() => {
    const element = frame.current;
    if (!open || !element) {
      setAnchor(null);
      return;
    }
    const page = element.ownerDocument;
    const view = page.defaultView;
    const container =
      preferencesContainer ??
      (element.offsetParent instanceof HTMLElement ? element.offsetParent : null) ??
      page.body;
    // The window is placed against its containing block: the container, or the nearest
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
    setAnchor({
      container,
      left: left + Math.max(0, (box.width - PREFERENCES_WIDTH) / 2),
      top: top + Math.min(96, box.height / 6),
    });
  }, [open, preferencesContainer]);

  const dragRegion = windowDragRegion<HTMLDivElement>(
    onDragRegionPointerDown,
    onDragRegionDoubleClick,
  );
  const { loaded } = transport;
  const places = (
    <Sidebar
      aria-label="Podcasts"
      material={material}
      style={SOURCE_LIST}
      value={station ? `${STATION_ROW}${station}` : section}
      onValueChange={(next) => {
        const value = String(next);
        if (value.startsWith(STATION_ROW)) onStationChoose?.(value.slice(STATION_ROW.length));
        else onSectionChoose(value as PodcastsSection);
      }}
    >
      {SECTIONS.map((group, index) => (
        <SidebarSection
          key={group.title}
          title={group.title}
          style={index === 0 ? undefined : LATER_SECTION}
        >
          {group.items.map((item, row) => (
            <SidebarItem
              key={item.id}
              value={item.id}
              label={item.name}
              icon={<SectionIcon section={item.id} />}
              accessory={sectionAccessory?.(item.id)}
              style={row === 0 ? FIRST_ROW : SIDEBAR_ROW}
            />
          ))}
        </SidebarSection>
      ))}
      {stations.length > 0 ? (
        <SidebarSection title="Stations" style={LATER_SECTION}>
          {stations.map((each, row) => (
            <ContextualMenu key={each.id}>
              <ContextualMenuTrigger className="mac-podcasts-context-menu">
                <SidebarItem
                  value={`${STATION_ROW}${each.id}`}
                  label={each.name}
                  icon={<SectionIcon section="episodes" />}
                  style={row === 0 ? FIRST_ROW : SIDEBAR_ROW}
                />
              </ContextualMenuTrigger>
              <ContextualMenuPopup aria-label={each.name}>
                {stationMenu?.(each.id)}
              </ContextualMenuPopup>
            </ContextualMenu>
          ))}
        </SidebarSection>
      ) : null}
    </Sidebar>
  );

  return (
    <>
      <Window
        aria-label="Podcasts"
        state={stateOf("viewer")}
        width={width}
        height={height}
        className={className ? `mac-podcasts ${className}` : "mac-podcasts"}
        // While Preferences are open the two windows are stacked: the front one over the other.
        style={open ? { zIndex: front === "viewer" ? 2 : 1, ...style } : style}
        ref={(element) => {
          frame.current = element;
          if (typeof ref === "function") return ref(element);
          if (ref) ref.current = element;
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (event.key === "," && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            // Open Preferences come back to the front, from behind this window too.
            if (open) setFront("preferences");
            else setOpen(true);
          }
        }}
        onPointerDownCapture={(event) => {
          onPointerDownCapture?.(event);
          setFront("viewer");
        }}
        {...props}
        aria-busy={loading || undefined}
        // Until the first load settles nothing in the window can be used.
        inert={loading || undefined}
      >
        <MediaAppChrome
          variant="podcasts"
          sidebarWidth={sidebarShown ? SIDEBAR_WIDTH : SIDEBAR_WIDTH_HIDDEN}
        >
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
              sidebarShown ? (
                <SearchField
                  variant="sidebar"
                  value={query}
                  onValueChange={onQueryChange}
                  style={{ width: "100%" }}
                />
              ) : undefined
            }
            {...dragRegion}
          >
            {!sidebarShown ? null : sidebarMenu ? (
              <ContextualMenu>
                <ContextualMenuTrigger className="mac-podcasts-context-menu">
                  {places}
                </ContextualMenuTrigger>
                <ContextualMenuPopup aria-label="Podcasts">{sidebarMenu}</ContextualMenuPopup>
              </ContextualMenu>
            ) : (
              places
            )}
          </MediaAppChromeSidebar>
          <MediaAppChromeBar aria-label="Playback controls" {...dragRegion}>
            <MediaAppChromeTransport>
              <MediaAppChromeButton
                glyph="skip-back"
                seconds={loaded ? settings.skipBack : undefined}
                aria-label={`Back ${settings.skipBack} seconds`}
                disabled={!loaded}
                onClick={() => transport.onSkip(-settings.skipBack)}
              />
              <MediaAppChromeButton
                glyph={transport.playing ? "pause" : "play"}
                aria-label={transport.playing ? "Pause" : "Play"}
                disabled={!loaded && !transport.canStart}
                onClick={transport.onToggle}
              />
              <MediaAppChromeButton
                glyph="skip-forward"
                seconds={loaded ? settings.skipForward : undefined}
                aria-label={`Forward ${settings.skipForward} seconds`}
                disabled={!loaded}
                onClick={() => transport.onSkip(settings.skipForward)}
              />
            </MediaAppChromeTransport>
            <MediaAppChromeDisplay>
              {loaded ? (
                <NowPlayingLcd
                  data-window-no-drag=""
                  variant="podcasts"
                  title={loaded.title}
                  subtitle={loaded.subtitle}
                  artwork={loaded.artwork}
                  elapsed={loaded.elapsed}
                  duration={loaded.duration}
                  onSeek={loaded.onSeek}
                />
              ) : (
                <NowPlayingLcd variant="podcasts" placeholder={<IdleMark />} />
              )}
            </MediaAppChromeDisplay>
            <MediaAppChromeControls>
              <MediaAppChromeVolume
                data-window-no-drag=""
                value={volume}
                onValueChange={(next) => onVolumeSet(next)}
              >
                {/* No output can be chosen from a page. */}
                <MediaAppChromeButton glyph="output" aria-label="Audio output" disabled />
              </MediaAppChromeVolume>
              <MediaAppChromeButton
                glyph="info"
                aria-label="Episode Notes"
                aria-pressed={panel === "notes"}
                onClick={() => onPanelChange(panel === "notes" ? null : "notes")}
              />
              <MediaAppChromeButton
                glyph="up-next"
                aria-label="Up Next"
                aria-pressed={panel === "queue"}
                onClick={() => onPanelChange(panel === "queue" ? null : "queue")}
                {...upNextDrop}
              />
              {controls}
            </MediaAppChromeControls>
          </MediaAppChromeBar>
          <MediaAppChromePane>
            <div className="mac-podcasts-layout" style={FILL}>
              {banner ? (
                <div className="mac-podcasts-column">
                  {banner}
                  {view}
                </div>
              ) : (
                view
              )}
              {panel ? panelContent : null}
            </div>
          </MediaAppChromePane>
        </MediaAppChrome>
        {media}
      </Window>
      {open && anchor
        ? createPortal(
            // A host may size its own children, as a managed window does with the window it
            // holds. The wrapper has no box, so Preferences keep their own size in there.
            <div style={NO_BOX}>
              <PodcastsPreferences
                state={stateOf("preferences")}
                settings={settings}
                onSettingsChange={onSettingsChange}
                onClose={() => setOpen(false)}
                {...preferencesProps}
                // Rendered outside the window, so made busy and inert on its own: until the first
                // load settles its settings are not yet the stored ones, and the load would
                // replace any change made to them.
                aria-busy={loading || undefined}
                inert={loading || undefined}
                style={{
                  position: "absolute",
                  zIndex: front === "preferences" ? 2 : 1,
                  left: anchor.left,
                  top: anchor.top,
                }}
                onPointerDownCapture={() => setFront("preferences")}
              />
            </div>,
            anchor.container,
          )
        : null}
    </>
  );
}

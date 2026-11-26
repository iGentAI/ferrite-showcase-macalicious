"use client";

import { BorderlessButton } from "macalicious/borderless-button";
import { EmptyState } from "macalicious/empty-state";
import { IconView } from "macalicious/icon-view";
import { ImageView } from "macalicious/image-view";
import { Label } from "macalicious/label";
import { MenuRadioGroup, MenuRadioItem } from "macalicious/menu-item";
import {
  Popover,
  PopoverDescription,
  PopoverPopup,
  PopoverTitle,
  PopoverTrigger,
} from "macalicious/popover";
import { PullDownButton } from "macalicious/pull-down-button";
import { ShareMenu, ShareMenuItem } from "macalicious/share-menu";
import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";
import { Slider } from "macalicious/slider";
import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";
import { SystemImage } from "macalicious/system-image";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarSearchField } from "macalicious/toolbar-search-field";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FavoriteBadge,
  HeartGlyph,
  PhotoArtwork,
  type PhotosService,
  RotateGlyph,
  ServiceGlyph,
  SourceGlyph,
  ZoomGlyph,
} from "./photos-artwork";
import {
  cellSize,
  childrenOf,
  countText,
  dateRange,
  dayOf,
  defaultPhotos,
  FILTERS,
  fitted,
  matches,
  type Photo,
  type PhotosFilter,
  type PhotosSource,
  type PhotosSourceId,
  passes,
  photosOf,
  SECTIONS,
  SOURCES,
  unitText,
  ZOOM,
} from "./photos-data";
import "./photos.tokens.css";
import "./photos.css";

export interface PhotosProps extends Omit<WindowProps, "children"> {
  /**
   * The library: every picture, with the albums it is in.
   * @default defaultPhotos
   */
  photos?: readonly Photo[];
  /**
   * The row of the sidebar that is selected when the window opens.
   * @default "wallpapers"
   */
  defaultSource?: PhotosSourceId;
  /**
   * The value of the zoom slider when the window opens, from 0 to 100: thumbnails of 64 pt
   * at 0, of 128 pt, as captured, at 50, and of 256 pt at 100.
   * @default 50
   */
  defaultZoom?: number;
  /** Called with the service chosen in the Share menu and the pictures it is to share. */
  onShare?: (service: PhotosService, photos: readonly Photo[]) => void;
  /** A panel floating over the window's content, such as a desktop's Preferences. */
  panel?: ReactNode;
  /** For the window controls: a window manager's close command. */
  onClose?: WindowControlsProps["onClose"];
  /** For the window controls: a window manager's minimize command. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** For the window controls: a window manager's zoom command. */
  onZoom?: WindowControlsProps["onZoom"];
  /** For the window controls: what the green button does now. */
  zoomRole?: WindowControlsProps["zoomRole"];
  /** For the window controls: disables minimize, as in full screen. */
  minimizeDisabled?: boolean;
  /** For the window controls: disables zoom. */
  zoomDisabled?: boolean;
  /** For the title bar: a window manager starts moving the window here. */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /** For the title bar: a window manager zooms the window here. */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
}

/* The library's hooks, set to what is measured in the captures (photos.css, photos.tokens.css). */

/* The fills of two toolbar buttons are 10 pt apart, where the toolbar's own gap is 8 pt. */
const TOOLBAR = { "--mac-toolbar-gap": "10px" } as CSSProperties;
const SPLIT = { "--mac-split-view-divider-color": "var(--mac-photos-divider)" } as CSSProperties;
/*
 * Photos keeps its icons 18 pt from the window's edge although it has outline rows, where the
 * library's sidebar moves the icons of an outline 6 pt further in. The drawings hang 6 pt to
 * the left of their icon box (photos.css), and the label follows them: 2 pt before the end
 * of the box, which is 4 pt after the drawing; its first letter then starts 41 pt from the
 * window's edge, as measured.
 */
const SIDEBAR = { "--mac-sidebar-label-gap": "-2px" } as CSSProperties;
/* Photos draws the content of its sidebar rows 1 pt higher than the standard source list. */
const RAISED = { paddingBlockEnd: 2 };
/*
 * The grid of pictures is the library's icon view without its labels: Photos shows no titles
 * under its thumbnails (View, Metadata, Titles is off in the captures) and the icon view has
 * no cell without a label, so the label's line gets no height here. The title stays in the
 * document as the name of its option. The selection is drawn on the thumbnail (photos.css),
 * so the icon view's backdrop is not.
 */
const GRID = {
  "--mac-icon-view-background": "var(--mac-photos-background)",
  "--mac-icon-view-plate": "transparent",
  fontSize: 0,
  lineHeight: 0,
} as CSSProperties;
const TILES = { "--mac-icon-view-background": "var(--mac-photos-background)" } as CSSProperties;

/* The side of an album's tile in a folder. */
const TILE = 128;
/* How long a slideshow shows one picture. */
const SLIDE_MS = 3000;

const SERVICES: readonly [PhotosService, string][] = [
  ["mail", "Mail"],
  ["messages", "Messages"],
  ["notes", "Notes"],
];

/** The drawing of a sidebar row: a template glyph, or the first picture of the album. */
function SourceIcon({ source, photos }: { source: PhotosSource; photos: readonly Photo[] }) {
  if (source.icon !== "thumbnail") return <SourceGlyph name={source.icon} />;
  const key = photosOf(source.id, photos, null)?.[0];
  return key ? (
    <PhotoArtwork photo={key} cropped width={18} height={18} className="mac-photos-source-icon" />
  ) : (
    <SourceGlyph name="stack" />
  );
}

/**
 * The Photos window of macOS 10.15: a toolbar with Back, the zoom slider, Info, Share,
 * Favorite, Rotate and the search field under a centred title, the sidebar of the library,
 * and the selected album's header over the grid of its pictures. The pictures are abstract
 * placeholders, and nothing is read from or written to a photo library.
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a
 * window manager places, sizes and activates it; the window controls' and the title bar's
 * callbacks are handed to those parts.
 */
export function Photos({
  photos = defaultPhotos,
  defaultSource = "wallpapers",
  defaultZoom = ZOOM.default,
  onShare,
  panel,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  width = 1200,
  height = 720,
  ...windowProps
}: PhotosProps) {
  const [sourceId, setSourceId] = useState(defaultSource);
  // The folders that show their rows: My Albums, as captured, and the folder of the source
  // the window opens on.
  const [expanded, setExpanded] = useState<Partial<Record<PhotosSourceId, boolean>>>(() => ({
    "my-albums": true,
    ...(SOURCES[defaultSource].parent ? { [SOURCES[defaultSource].parent]: true } : {}),
  }));
  const [zoom, setZoom] = useState(defaultZoom);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PhotosFilter>("all");
  const [selection, setSelection] = useState<string[]>([]);
  const [opened, setOpened] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(
    () => new Set(photos.filter((photo) => photo.favorite).map((photo) => photo.id)),
  );
  // Quarter turns to the left by picture: Rotate adds one. A turned picture counts as edited.
  // A Map, since ids are the caller's: `__proto__` or `constructor` would hit a plain object's
  // prototype.
  const [turns, setTurns] = useState<ReadonlyMap<string, number>>(() => new Map());
  // The album that "Show as Memory" was last chosen in: what Memories shows.
  const [memory, setMemory] = useState<PhotosSourceId | null>(null);
  const showingId = useId();
  const filterId = useId();

  const source = SOURCES[sourceId];
  const collection = useMemo(() => photosOf(sourceId, photos, memory), [sourceId, photos, memory]);
  const listed = useMemo(
    () =>
      collection?.filter(
        (photo) =>
          matches(photo, query) &&
          passes(photo, filter, {
            favorite: favorites.has(photo.id),
            edited: (turns.get(photo.id) ?? 0) % 4 !== 0,
          }),
      ) ?? [],
    [collection, query, filter, favorites, turns],
  );
  // The picture that fills the pane, while the list still holds it.
  const picture = opened === null ? undefined : listed.find((photo) => photo.id === opened);
  // What Favorite, Rotate and Info act on: the open picture, and else the selected ones.
  const selected = useMemo(() => new Set(selection), [selection]);
  const current = picture ? [picture] : listed.filter((photo) => selected.has(photo.id));
  const allFavorite = current.length > 0 && current.every((photo) => favorites.has(photo.id));
  const folder = source.kind === "folder" ? childrenOf(sourceId) : [];
  // Memories is headed by the album it shows.
  const heading = source.kind === "memories" && memory ? SOURCES[memory].name : source.name;
  const size = cellSize(zoom);

  const choose = (next: PhotosSourceId) => {
    setSourceId(next);
    setSelection([]);
    setOpened(null);
    setPlaying(false);
  };
  const open = (id: string, slideshow = false) => {
    setOpened(id);
    setPlaying(slideshow);
  };
  // Back leaves the open picture, selected, in its grid; from an album it goes to the folder.
  // The keyboard returns to the grid with it: `returning` says that Back was what closed it.
  const returning = useRef(false);
  const close = () => {
    if (picture) setSelection([picture.id]);
    returning.current = true;
    setOpened(null);
    setPlaying(false);
  };
  const back = picture
    ? close
    : source.parent
      ? () => choose(source.parent ?? sourceId)
      : undefined;
  // The title names where Back goes: the open picture's list, an album's folder. A source
  // that Back does not leave is named itself.
  const title = picture ? heading : source.parent ? SOURCES[source.parent].name : source.name;

  // A slideshow shows each listed picture for three seconds and stops on the last one.
  const following = picture ? listed[listed.indexOf(picture) + 1] : undefined;
  useEffect(() => {
    if (!playing || !picture) return;
    const timer = setTimeout(
      () => (following ? setOpened(following.id) : setPlaying(false)),
      SLIDE_MS,
    );
    return () => clearTimeout(timer);
  }, [playing, picture, following]);

  // A search or the Showing menu can take the open picture out of the list. It is then
  // closed for good, and a slideshow with it: emptying the field does not open it again.
  useEffect(() => {
    if (opened === null || picture) return;
    setOpened(null);
    setPlaying(false);
  }, [opened, picture]);

  // The keyboard goes with the view: to Back when a picture opens, since the grid that had it
  // is gone, and to the grid again when Back closes the picture. A picture that closes for
  // another reason, a source chosen in the sidebar or a search, leaves the keyboard there.
  const backButton = useRef<HTMLElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const viewing = picture !== undefined;
  const wasViewing = useRef(viewing);
  useEffect(() => {
    if (wasViewing.current === viewing) return;
    wasViewing.current = viewing;
    if (viewing) backButton.current?.focus();
    else if (returning.current)
      grid.current?.querySelector<HTMLElement>('[role="listbox"]')?.focus();
    returning.current = false;
  }, [viewing]);

  const toggleFavorite = () =>
    setFavorites((old) => {
      const next = new Set(old);
      for (const photo of current) {
        if (allFavorite) next.delete(photo.id);
        else next.add(photo.id);
      }
      return next;
    });
  const rotate = () =>
    setTurns((old) => {
      const next = new Map(old);
      for (const photo of current) next.set(photo.id, ((old.get(photo.id) ?? 0) + 1) % 4);
      return next;
    });

  const renderThumbnail = useCallback(
    (index: number) => {
      const photo = listed[index];
      if (!photo) return null;
      const turned = turns.get(photo.id) ?? 0;
      const box = fitted(photo, size, turned);
      return (
        <span
          className="mac-photos-thumbnail"
          data-selected={selected.has(photo.id) ? "" : undefined}
          style={box}
        >
          <PhotoArtwork photo={photo} turns={turned} width={box.width} height={box.height} />
          {favorites.has(photo.id) ? <FavoriteBadge /> : null}
          {photo.duration ? <span className="mac-photos-duration">{photo.duration}</span> : null}
        </span>
      );
    },
    [listed, size, selected, favorites, turns],
  );
  const renderTile = useCallback(
    (index: number) => {
      const key = folder[index] ? photosOf(folder[index].id, photos, null)?.[0] : undefined;
      return key ? (
        <PhotoArtwork photo={key} cropped width={TILE} height={TILE} className="mac-photos-tile" />
      ) : null;
    },
    [folder, photos],
  );

  // What the Info popover says: of one picture, of several, or of what the pane lists.
  const info =
    current.length === 1 && current[0]
      ? {
          title: current[0].title,
          lines: [
            dayOf(current[0].date),
            `${current[0].kind === "video" ? "Video" : "Photo"}, ${current[0].width} × ${current[0].height}`,
            `Keywords: ${current[0].keywords.join(", ")}`,
          ],
        }
      : current.length > 1
        ? { title: `${countText(current)} Selected`, lines: [dateRange(current)] }
        : collection
          ? { title: heading, lines: [countText(listed), dateRange(collection)] }
          : {
              title: source.name,
              lines: [
                source.kind === "folder"
                  ? unitText(folder.length, source.unit ?? "Item")
                  : source.empty,
              ],
            };
  // Share sends the pictures Info is about, and else every listed one.
  const shared = current.length > 0 ? current : listed;

  return (
    <Window width={width} height={height} {...windowProps}>
      <TitleBar
        variant="title-hidden"
        title={title}
        controls={
          <WindowControls
            onClose={onClose}
            onMinimize={onMinimize}
            onZoom={onZoom}
            zoomRole={zoomRole}
            minimizeDisabled={minimizeDisabled}
            zoomDisabled={zoomDisabled}
          />
        }
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      >
        <Toolbar aria-label="Toolbar" style={TOOLBAR}>
          <ToolbarButton
            ref={backButton}
            aria-label="Back"
            className="mac-photos-back"
            disabled={!back}
            onClick={back}
          >
            <SystemImage name="go-back" />
          </ToolbarButton>
          <div className="mac-photos-zoom">
            <ZoomGlyph />
            <Slider
              aria-label="Zoom"
              size="small"
              className="mac-photos-zoom-slider"
              min={ZOOM.min}
              max={ZOOM.max}
              step={ZOOM.step}
              value={zoom}
              onValueChange={(value) => setZoom(value as number)}
              disabled={!collection || viewing}
            />
            <ZoomGlyph large />
          </div>
          <ToolbarSpace />
          <Popover>
            <PopoverTrigger
              render={
                <ToolbarButton aria-label="Info" className="mac-photos-tool">
                  <SystemImage name="info-outline" />
                </ToolbarButton>
              }
            />
            <PopoverPopup className="mac-photos-info">
              <PopoverTitle>{info.title}</PopoverTitle>
              <PopoverDescription render={<div />}>
                {info.lines.filter(Boolean).map((line) => (
                  <span key={line} className="mac-photos-info-line">
                    {line}
                  </span>
                ))}
              </PopoverDescription>
            </PopoverPopup>
          </Popover>
          {/* Without `onMore` the menu has no More… item: in Catalina it opens the Extensions
              preferences, which this demo does not have. */}
          <ShareMenu className="mac-photos-tool" disabled={shared.length === 0}>
            {SERVICES.map(([service, name]) => (
              <ShareMenuItem
                key={service}
                image={<ServiceGlyph name={service} />}
                onClick={() => onShare?.(service, shared)}
              >
                {name}
              </ShareMenuItem>
            ))}
          </ShareMenu>
          <ToolbarButton
            aria-label="Favorite"
            aria-pressed={allFavorite}
            className="mac-photos-tool"
            disabled={current.length === 0}
            onClick={toggleFavorite}
          >
            <HeartGlyph filled={allFavorite} />
          </ToolbarButton>
          <ToolbarButton
            aria-label="Rotate"
            className="mac-photos-tool"
            disabled={current.length === 0}
            onClick={rotate}
          >
            <RotateGlyph />
          </ToolbarButton>
          <ToolbarSearchField
            value={query}
            onValueChange={setQuery}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="mac-photos-search"
          />
        </Toolbar>
      </TitleBar>
      <WindowBody background="content" className="mac-photos-body">
        <SplitView className="mac-photos-split" style={SPLIT}>
          <SplitViewPane defaultSize={179} minSize={140} maxSize={320}>
            <Sidebar
              aria-label="Library"
              material="opaque"
              className="mac-photos-sidebar"
              style={SIDEBAR}
              value={sourceId}
              onValueChange={(value) => choose(value as PhotosSourceId)}
            >
              {SECTIONS.map((section) => (
                <SidebarSection key={section.title} title={section.title}>
                  {section.sources.map((id) => {
                    const row = SOURCES[id];
                    const rows = childrenOf(id);
                    return (
                      <SidebarItem
                        key={id}
                        value={id}
                        label={row.name}
                        icon={<SourceIcon source={row} photos={photos} />}
                        style={RAISED}
                        expanded={rows.length > 0 ? (expanded[id] ?? false) : undefined}
                        onExpandedChange={(next) => setExpanded((old) => ({ ...old, [id]: next }))}
                      >
                        {rows.length > 0
                          ? rows.map((child) => (
                              <SidebarItem
                                key={child.id}
                                value={child.id}
                                label={child.name}
                                icon={<SourceIcon source={child} photos={photos} />}
                                style={RAISED}
                              />
                            ))
                          : undefined}
                      </SidebarItem>
                    );
                  })}
                </SidebarSection>
              ))}
            </Sidebar>
          </SplitViewPane>
          <SplitViewDivider aria-label="Resize the sidebar" />
          <SplitViewPane minSize={420} className="mac-photos-content">
            {picture ? (
              <div className="mac-photos-viewer">
                <ImageView
                  alt={picture.title}
                  className="mac-photos-picture"
                  style={
                    {
                      "--mac-photos-aspect":
                        fitted(picture, 1000, turns.get(picture.id)).width /
                        fitted(picture, 1000, turns.get(picture.id)).height,
                    } as CSSProperties
                  }
                >
                  <PhotoArtwork
                    photo={picture}
                    turns={turns.get(picture.id)}
                    large
                    className="mac-photos-picture-art"
                  />
                </ImageView>
              </div>
            ) : collection ? (
              <>
                <div className="mac-photos-header">
                  <h1 className="mac-photos-title">{heading}</h1>
                  <div className="mac-photos-meta">
                    <Label color="secondary" truncate className="mac-photos-range">
                      {dateRange(collection)}
                    </Label>
                    <Label textStyle="callout" color="secondary" className="mac-photos-count">
                      {countText(listed)}
                    </Label>
                    {source.album ? (
                      <>
                        <BorderlessButton
                          color="link"
                          className="mac-photos-link"
                          onClick={() => {
                            setMemory(sourceId);
                            choose("memories");
                          }}
                        >
                          Show as Memory
                        </BorderlessButton>
                        <BorderlessButton
                          color="link"
                          className="mac-photos-link"
                          disabled={listed.length === 0}
                          onClick={() => {
                            if (listed[0]) open(listed[0].id, true);
                          }}
                        >
                          Slideshow
                        </BorderlessButton>
                      </>
                    ) : null}
                    <span className="mac-photos-showing">
                      <Label id={showingId}>Showing:</Label>
                      <PullDownButton
                        id={filterId}
                        aria-labelledby={`${showingId} ${filterId}`}
                        bordered={false}
                        className="mac-photos-filter"
                        title={FILTERS.find((choice) => choice.id === filter)?.title}
                      >
                        <MenuRadioGroup
                          value={filter}
                          onValueChange={(value) => setFilter(value as PhotosFilter)}
                        >
                          {FILTERS.map((choice) => (
                            <MenuRadioItem key={choice.id} value={choice.id}>
                              {choice.title}
                            </MenuRadioItem>
                          ))}
                        </MenuRadioGroup>
                      </PullDownButton>
                    </span>
                  </div>
                </div>
                {listed.length > 0 ? (
                  <IconView
                    ref={grid}
                    aria-label={heading}
                    className="mac-photos-grid"
                    style={GRID}
                    count={listed.length}
                    renderIcon={renderThumbnail}
                    getItemLabel={(index) => listed[index]?.title ?? ""}
                    getItemId={(index) => listed[index]?.id ?? index}
                    iconSize={size}
                    // The cells of 128 pt are 144.25 pt apart in the captures, and the rows
                    // of square pictures 16 pt apart.
                    cellWidth={size + 8.25}
                    rowHeight={size + 16}
                    value={selection}
                    onValueChange={(value) => setSelection(value.map(String))}
                    onItemAction={(index) => {
                      if (listed[index]) open(listed[index].id);
                    }}
                  />
                ) : (
                  <EmptyState role="status" className="mac-photos-empty">
                    {query.trim()
                      ? "No Results"
                      : filter === "all"
                        ? source.empty
                        : FILTERS.find((choice) => choice.id === filter)?.empty}
                  </EmptyState>
                )}
              </>
            ) : folder.length > 0 ? (
              <>
                <div className="mac-photos-header">
                  <h1 className="mac-photos-title">{source.name}</h1>
                  <div className="mac-photos-meta">
                    <Label textStyle="callout" color="secondary" className="mac-photos-count">
                      {unitText(folder.length, source.unit ?? "Item")}
                    </Label>
                  </div>
                </div>
                <IconView
                  aria-label={source.name}
                  className="mac-photos-grid"
                  style={TILES}
                  count={folder.length}
                  renderIcon={renderTile}
                  getItemLabel={(index) => folder[index]?.name ?? ""}
                  getItemId={(index) => folder[index]?.id ?? index}
                  iconSize={TILE}
                  selectionMode="single"
                  onItemAction={(index) => {
                    const child = folder[index];
                    if (!child) return;
                    setExpanded((old) => ({ ...old, [sourceId]: true }));
                    choose(child.id);
                  }}
                />
              </>
            ) : (
              <EmptyState role="status" className="mac-photos-empty">
                {source.empty}
              </EmptyState>
            )}
          </SplitViewPane>
        </SplitView>
        {panel}
      </WindowBody>
    </Window>
  );
}

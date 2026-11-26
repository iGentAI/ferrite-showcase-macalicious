"use client";

import { CardGrid, CardGridAction, CardGridCard } from "macalicious/card-grid";
import { Checkbox } from "macalicious/checkbox";
import { EditorialCard } from "macalicious/editorial-card";
import { EmptyState } from "macalicious/empty-state";
import { cn } from "macalicious/lib/cn";
import { PushButton } from "macalicious/push-button";
import { ScrollView } from "macalicious/scroll-view";
import { ShelfPager } from "macalicious/shelf-pager";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Toolbar } from "macalicious/toolbar";
import { ToolbarSearchField } from "macalicious/toolbar-search-field";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import { type CSSProperties, type KeyboardEvent, type ReactNode, useState } from "react";
import { Artwork } from "./tv-artwork";
import {
  defaultSettings,
  defaultTitles,
  FEATURED,
  inSection,
  LIBRARY_CARD_WIDTH,
  pick,
  SECTIONS,
  summary,
  TRAILERS,
  type TvSection,
  type TvSettings,
  type TvTitle,
  titleMatches,
  WHAT_TO_WATCH,
} from "./tv-data";
import "./tv.tokens.css";
import "./tv.css";

/*
 * TV's bar is 37 pt, a point less than the title-hidden bar of other applications, and its
 * controls start 6.5 pt under the window's top edge.
 */
const BAR: CSSProperties = { gridTemplateRows: "37px" };
const TOOLBAR = { "--mac-toolbar-padding-top": "6.5px" } as CSSProperties;

/*
 * The chevrons of a shelf are level with its cards: the 48 pt header is taller than the 32 pt
 * under the cards, so they move down by half the difference. TV shows them on the shelf under
 * the pointer only; on the others they are there, for the keyboard, and not drawn.
 */
const PAGER = { "--mac-shelf-pager-offset": "8px" } as CSSProperties;
const PAGER_AT_REST = {
  ...PAGER,
  "--mac-shelf-pager-chevron": "transparent",
  "--mac-shelf-pager-chevron-disabled": "transparent",
} as CSSProperties;

/* The header over the hero is 39 pt: the hero starts 39.5 pt under the line above it. */
const CHANNEL = { "--mac-card-grid-header-padding": "6px 0 10.5px" } as CSSProperties;

const NONE: readonly string[] = [];

/**
 * What the page under the toolbar shows: a section, all of What to Watch, or one title. A
 * title remembers whether it was opened from all of What to Watch, where Back returns to.
 */
type Page = { type: "section" } | { type: "all" } | { type: "title"; id: string; all: boolean };

const SECTION: Page = { type: "section" };
const ALL: Page = { type: "all" };

/** A shelf with its paging chevrons, which are drawn while the pointer or the focus is in it. */
function Pager({
  label,
  pages,
  page,
  onPageChange,
  children,
}: {
  label: string;
  pages: number;
  page: number;
  onPageChange: (page: number) => void;
  children: ReactNode;
}) {
  // Two reasons to draw the chevrons, kept apart: the pointer leaving a shelf that has the
  // keyboard does not hide them.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const active = hovered || focused;
  return (
    <ShelfPager
      previousLabel={`Previous in ${label}`}
      nextLabel={`More in ${label}`}
      previousDisabled={page <= 0}
      nextDisabled={page >= pages - 1}
      onPrevious={() => onPageChange(Math.max(0, page - 1))}
      onNext={() => onPageChange(Math.min(pages - 1, page + 1))}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      data-active={active ? "" : undefined}
      style={active ? PAGER : PAGER_AT_REST}
    >
      {children}
    </ShelfPager>
  );
}

export interface TvProps extends Omit<WindowProps, "children"> {
  /**
   * The catalogue. Every title of the default catalogue is invented for the demo.
   * @default the twelve titles of `defaultTitles`
   */
  titles?: readonly TvTitle[];
  /**
   * The section selected at first.
   * @default "watch-now"
   */
  defaultSection?: TvSection;
  /** Called with the section the user selects. */
  onSectionChange?: (section: TvSection) => void;
  /**
   * The `id`s of the titles that are in the library at first.
   * @default none
   */
  defaultLibrary?: readonly string[];
  /**
   * The settings of the Preferences window that the window follows: whether the Library has
   * checkboxes, and its List Size.
   * @default the settings of the reference screenshots
   */
  settings?: TvSettings;
  /** Called when Command-comma or Control-comma is pressed in the window. */
  onOpenPreferences?: () => void;
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
  /** Called when the primary pointer button goes down on the bar, not on a control in it. */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /** Called when the bar is double-clicked: macOS zooms or minimizes the window. */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
}

/** The props the TV window's frame shares with the windows built on it. */
export type TvFrameHostProps = Omit<
  TvProps,
  "titles" | "defaultSection" | "onSectionChange" | "defaultLibrary" | "settings"
>;

export interface TvFrameProps extends TvFrameHostProps {
  /** The selected section. */
  section: TvSection;
  /** Called with the section the user selects. */
  onSelectSection: (section: TvSection) => void;
  /** The text of the search field. */
  query: string;
  /** Called with the search field's text on every change. */
  onQueryChange: (query: string) => void;
  /** Keys pressed in the search field (Return, for one). */
  onSearchKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  /** What the body shows instead of the page in its scroll view: a player that fills it. */
  stage?: ReactNode;
  /** A list beside the page, in the body. */
  sidebar?: ReactNode;
  /** The page under the bar, in a scroll view. */
  children?: ReactNode;
}

/**
 * The TV window without its page: the bar with the window controls, the five sections and the
 * search field, and the body. `Tv` and the YouTube window (`tv-youtube.tsx`) are built on it.
 */
export function TvFrame({
  section,
  onSelectSection,
  query,
  onQueryChange,
  onSearchKeyDown,
  stage,
  sidebar,
  children,
  onOpenPreferences,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  width = 1294,
  height = 876,
  className,
  onKeyDown,
  ...windowProps
}: TvFrameProps) {
  return (
    <Window
      aria-label="TV"
      width={width}
      height={height}
      className={cn("mac-tv", className)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === "," && (event.metaKey || event.ctrlKey) && onOpenPreferences) {
          event.preventDefault();
          onOpenPreferences();
        }
      }}
      {...windowProps}
    >
      <TitleBar
        variant="title-hidden"
        divider="bar"
        style={BAR}
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      >
        <div className="mac-tv-bar">
          <div className="mac-tv-controls">
            <WindowControls
              onClose={onClose}
              onMinimize={onMinimize}
              onZoom={onZoom}
              zoomRole={zoomRole}
              minimizeDisabled={minimizeDisabled}
              zoomDisabled={zoomDisabled}
            />
          </div>
          <Toolbar aria-label="Toolbar" className="mac-tv-toolbar" style={TOOLBAR}>
            <ToolbarSegmentedControl
              aria-label="Sections"
              className="mac-tv-sections"
              value={[section]}
              onValueChange={(value) => {
                const next = value[0] as TvSection | undefined;
                if (next) onSelectSection(next);
              }}
            >
              {SECTIONS.map((item) => (
                <ToolbarSegment key={item.id} value={item.id} className="mac-tv-section">
                  {item.name}
                </ToolbarSegment>
              ))}
            </ToolbarSegmentedControl>
            <ToolbarSearchField
              value={query}
              onValueChange={onQueryChange}
              onKeyDown={onSearchKeyDown}
              className="mac-tv-search"
            />
          </Toolbar>
        </div>
      </TitleBar>
      <WindowBody background="content" className="mac-tv-body">
        {stage ?? (
          <>
            {sidebar}
            <ScrollView className="mac-tv-scroll">
              <div className="mac-tv-page">{children}</div>
            </ScrollView>
          </>
        )}
      </WindowBody>
    </Window>
  );
}

/**
 * The TV window of macOS 10.15: a bar with the five sections and a search field, and under it
 * a page of shelves that the chevrons page, a hero, and grids of titles. A title opens its
 * page, where it is added to the Library. The catalogue is a dozen invented titles with
 * abstract placeholders for pictures; nothing is played.
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a
 * window manager places, sizes and activates it; the window controls' and the bar's callbacks
 * are handed to those parts.
 */
export function Tv({
  titles = defaultTitles,
  defaultSection = "watch-now",
  onSectionChange,
  defaultLibrary = NONE,
  settings = defaultSettings,
  ...frameProps
}: TvProps) {
  const [section, setSection] = useState(defaultSection);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState<Page>(SECTION);
  const [library, setLibrary] = useState(defaultLibrary);
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(() => new Set());
  const [shelf, setShelf] = useState({ watch: 0, hero: 0, trailers: 0 });

  const open = (title: TvTitle) =>
    setPage((now) => ({
      type: "title",
      id: title.id,
      all: now.type === "all" || (now.type === "title" && now.all),
    }));
  // A card of a shelf is its picture alone; a card of a grid has its name and what it is.
  const card = (title: TvTitle, captioned: boolean) => (
    <CardGridCard
      key={title.id}
      render={<button type="button" />}
      aria-label={captioned ? undefined : title.title}
      artwork={<Artwork title={title} />}
      title={captioned ? title.title : undefined}
      subtitle={captioned ? summary(title) : undefined}
      onClick={() => open(title)}
    />
  );
  const grid = (name: string, list: readonly TvTitle[], action?: ReactNode) => (
    <CardGrid title={name} action={action} columns={4}>
      {list.map((title) => card(title, true))}
    </CardGrid>
  );
  const link = (name: string, to: Page) => (
    <CardGridAction render={<button type="button" />} onClick={() => setPage(to)}>
      {name}
    </CardGridAction>
  );
  const empty = (text: string) => (
    <EmptyState role="status" className="mac-tv-empty">
      {text}
    </EmptyState>
  );

  const searching = query.trim() !== "";
  const shown = page.type === "title" ? titles.find((title) => title.id === page.id) : undefined;
  let content: ReactNode;
  // A title that was opened is shown until Back, a section or more typing leaves it, also
  // when it was opened from the results of a search, which stay in the field.
  if (shown) {
    const kept = library.includes(shown.id);
    const back = page.type === "title" && page.all ? ALL : SECTION;
    content = (
      <>
        <CardGrid title={shown.title} action={link("Back", back)} columns={4}>
          <CardGridCard artwork={<Artwork title={shown} />} />
        </CardGrid>
        <div className="mac-tv-about">
          <p className="mac-tv-summary">{summary(shown)}</p>
          <p className="mac-tv-description">{shown.description}</p>
          <PushButton
            onClick={() =>
              setLibrary((now) => (kept ? now.filter((id) => id !== shown.id) : [...now, shown.id]))
            }
          >
            {kept ? "Remove from Library" : "Add to Library"}
          </PushButton>
        </div>
      </>
    );
  } else if (searching) {
    const found = titles.filter((title) => titleMatches(title, query));
    content = found.length === 0 ? empty("No Results") : grid("Results", found);
  } else if (page.type === "all") {
    content = grid("What to Watch", pick(titles, WHAT_TO_WATCH), link("Done", SECTION));
  } else if (section === "watch-now") {
    const watch = pick(titles, WHAT_TO_WATCH);
    const heroes = pick(titles, FEATURED);
    const trailers = pick(titles, TRAILERS);
    // The shelves show a page of their titles: the chevrons turn it.
    const pagesOf = (list: readonly TvTitle[], size: number) =>
      Math.max(1, Math.ceil(list.length / size));
    const at = (list: readonly TvTitle[], size: number, index: number) => {
      const first = Math.min(index, pagesOf(list, size) - 1) * size;
      return list.slice(first, first + size);
    };
    const hero = at(heroes, 1, shelf.hero)[0];
    content = (
      <>
        <Pager
          label="What to Watch"
          pages={pagesOf(watch, 4)}
          page={Math.min(shelf.watch, pagesOf(watch, 4) - 1)}
          onPageChange={(next) => setShelf((now) => ({ ...now, watch: next }))}
        >
          <CardGrid title="What to Watch" action={link("See All", { type: "all" })} columns={4}>
            {at(watch, 4, shelf.watch).map((title) => card(title, false))}
          </CardGrid>
        </Pager>
        {hero ? (
          <Pager
            label="Originals"
            pages={heroes.length}
            page={Math.min(shelf.hero, heroes.length - 1)}
            onPageChange={(next) => setShelf((now) => ({ ...now, hero: next }))}
          >
            <CardGrid title="Originals" separator columns={1} style={CHANNEL}>
              <EditorialCard
                key={hero.id}
                variant="hero"
                raised
                render={<button type="button" />}
                aria-label={hero.title}
                artwork={<Artwork title={hero} />}
                onClick={() => open(hero)}
              />
            </CardGrid>
          </Pager>
        ) : null}
        <Pager
          label="Watch New Trailers"
          pages={pagesOf(trailers, 3)}
          page={Math.min(shelf.trailers, pagesOf(trailers, 3) - 1)}
          onPageChange={(next) => setShelf((now) => ({ ...now, trailers: next }))}
        >
          <CardGrid title="Watch New Trailers" separator columns={3}>
            {at(trailers, 3, shelf.trailers).map((title) => card(title, false))}
          </CardGrid>
        </Pager>
      </>
    );
  } else if (section === "library") {
    const kept = pick(titles, library);
    content =
      kept.length === 0 ? (
        empty("Your library is empty")
      ) : (
        <CardGrid title="Library" minCardWidth={LIBRARY_CARD_WIDTH[settings.listSize]}>
          {kept.map((title) =>
            settings.checkboxes ? (
              <div key={title.id} className="mac-tv-library-item">
                {card(title, false)}
                <Checkbox
                  checked={!unchecked.has(title.id)}
                  onCheckedChange={(checked) =>
                    setUnchecked((now) => {
                      const next = new Set(now);
                      if (checked) next.delete(title.id);
                      else next.add(title.id);
                      return next;
                    })
                  }
                >
                  {title.title}
                </Checkbox>
              </div>
            ) : (
              card(title, true)
            ),
          )}
        </CardGrid>
      );
  } else {
    const name = SECTIONS.find((item) => item.id === section)?.name ?? "";
    const list = inSection(titles, section);
    content = list.length === 0 ? empty(`No ${name}`) : grid(name, list);
  }

  return (
    <TvFrame
      section={section}
      onSelectSection={(next) => {
        setSection(next);
        setPage(SECTION);
        setQuery("");
        onSectionChange?.(next);
      }}
      query={query}
      onQueryChange={(text) => {
        setQuery(text);
        setPage(SECTION);
      }}
      {...frameProps}
    >
      {content}
    </TvFrame>
  );
}

"use client";

import { EmptyState } from "macalicious/empty-state";
import { ImageView } from "macalicious/image-view";
import { observeResize } from "macalicious/lib/observe-resize";
import { ListView } from "macalicious/list-view";
import {
  MarkupToolbar,
  MarkupToolbarSeparator,
  MarkupToolbarSwatch,
  MarkupToolbarTool,
} from "macalicious/markup-toolbar";
import { MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator } from "macalicious/menu-item";
import {
  ScopeBar,
  ScopeBarAction,
  ScopeBarActionGroup,
  ScopeBarActions,
  ScopeBarButton,
  ScopeBarGroup,
  ScopeBarLabel,
} from "macalicious/scope-bar";
import { ScrollView } from "macalicious/scroll-view";
import { ShareMenu, ShareMenuItem } from "macalicious/share-menu";
import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";
import { SystemImage } from "macalicious/system-image";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarPullDown, ToolbarSplitPullDown } from "macalicious/toolbar-pop-up";
import { ToolbarSearchField } from "macalicious/toolbar-search-field";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  type CSSProperties,
  memo,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DocumentIcon, PageMiniature, PLACEHOLDER_PICTURE, PreviewGlyph } from "./preview-artwork";
import {
  HIGHLIGHTS,
  islandFerry,
  type PreviewDocument,
  type PreviewHighlight,
  type PreviewPage,
  type PreviewSort,
  searchDocument,
  splitMatches,
} from "./preview-data";
import "./preview.tokens.css";
import "./preview.css";

/** What the sidebar shows while nothing is searched for. */
export type PreviewSidebar = "hidden" | "thumbnails";

/** The services of the Share menu. */
export type PreviewShareService = "mail" | "messages" | "notes";

const SERVICES: readonly [service: PreviewShareService, title: string][] = [
  ["mail", "Mail"],
  ["messages", "Messages"],
  ["notes", "Notes"],
];

type Tool = "sketch" | "draw" | "text";
const TOOLS: readonly [tool: Tool, title: string][] = [
  ["sketch", "Sketch"],
  ["draw", "Draw"],
  ["text", "Text"],
];

/** A step of the zoom buttons, and how far they go. */
const ZOOM_STEP = 1.25;
const ZOOM_MIN = ZOOM_STEP ** -4;
const ZOOM_MAX = ZOOM_STEP ** 6;

/** How far under the top of the view a page may start and still be the page shown. */
const PAGE_SLOP = 12;
/**
 * The width an element is laid out at, with its fractions of a point: the used value of its
 * `width`, which `clientWidth` rounds. 0 where nothing is laid out.
 */
const widthOf = (element: Element) =>
  Number.parseFloat(element.ownerDocument.defaultView?.getComputedStyle(element).width ?? "") || 0;
/** The canvas left over a page that is brought to the top of the view. */
const PAGE_INSET = 4;

/**
 * Brings a page to the top of the view, and says whether that scrolled the view. The view is
 * scrolled to a whole point: a page's height is a share of the view's width and seldom a
 * whole number, and the engines disagree on what becomes of a fraction in `scrollTop` (one
 * keeps it, one drops it, one snaps it to a device pixel), so the same page would start at
 * another point under the bar in each. Rounded here, it starts within half a point of
 * `PAGE_INSET` in all of them.
 */
function bring(view: HTMLElement, page: number) {
  const leaf = view.querySelector(`[data-page="${page}"]`);
  if (!leaf) return false;
  const before = view.scrollTop;
  view.scrollTop =
    page === 1
      ? 0
      : Math.round(
          before + leaf.getBoundingClientRect().top - view.getBoundingClientRect().top - PAGE_INSET,
        );
  return view.scrollTop !== before;
}

/*
 * The widths of the toolbar's items, measured in the captures (reference/spec/apps/
 * preview.md, "Toolbar item order and rectangles"), through each control's `style`: a width
 * here is that of the control's fill, 1 pt less than the outer bezel the blueprint lists. The
 * View button keeps the library's own measure, 47 pt with the sidebar image, where Preview's
 * is 36 pt.
 */
const ZOOM_OUT: CSSProperties = { width: 39 };
const ZOOM_IN: CSSProperties = { width: 37 };
const SHARE: CSSProperties = { width: 36 };
const HIGHLIGHT: CSSProperties = { width: 34 };
const ROTATE: CSSProperties = { width: 32 };
// 10 pt after Rotate Left and 7 pt before the search field, where the bar's gap is 8 pt.
const MARKUP: CSSProperties = { width: 36, marginInline: "2px -1px" };
const SEARCH: CSSProperties = { width: 239 };

// The measured colours of this window, through the two components' documented hooks. The
// list stands on the sidebar's surface, so it is given no background of its own, the way the
// list view's own Notes and Reminders examples place a list on another surface.
const DIVIDER = {
  "--mac-split-view-divider-color": "var(--mac-preview-divider)",
} as CSSProperties;
const ROWS = {
  background: "transparent",
  "--mac-list-view-selected-background": "var(--mac-preview-row-selected)",
} as CSSProperties;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const matches = (count: number) => `${count} ${count === 1 ? "match" : "matches"}`;

/** Text with every occurrence of what is searched for marked. */
function Marked({ text, query }: { text: string; query: string }) {
  const pieces = splitMatches(text, query);
  if (pieces.length === 1) return text;
  return pieces.map((piece, index) =>
    index % 2 === 1 ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: the pieces of one string never reorder
      <mark key={index} className="mac-preview-match">
        {piece}
      </mark>
    ) : (
      piece
    ),
  );
}

/** One page of a PDF, set from its text. Every length inside is in em of the page's width. */
const Page = memo(function Page({
  page,
  number,
  query,
}: {
  page: PreviewPage;
  number: number;
  query: string;
}) {
  const paragraphs = (text: readonly string[]) =>
    text.map((paragraph, index) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: the paragraphs of one page never reorder
      <p key={index}>
        <Marked text={paragraph} query={query} />
      </p>
    ));
  return (
    <section className="mac-preview-leaf" data-page={number} aria-label={`Page ${number}`}>
      <div className="mac-preview-page" data-opener={page.title !== undefined ? "" : undefined}>
        {page.title !== undefined ? (
          <div className="mac-preview-page-banner">
            <p className="mac-preview-page-section">
              <Marked text={page.section ?? ""} query={query} />
            </p>
            <p className="mac-preview-page-title">
              <Marked text={page.title} query={query} />
            </p>
          </div>
        ) : null}
        {page.aside ? (
          <div className="mac-preview-page-aside">
            <p className="mac-preview-page-aside-heading">
              <Marked text={page.aside.heading} query={query} />
            </p>
            {paragraphs(page.aside.text)}
          </div>
        ) : null}
        <div className="mac-preview-page-text">
          <p className="mac-preview-page-heading">
            <Marked text={page.heading} query={query} />
          </p>
          {paragraphs(page.text)}
        </div>
        <p className="mac-preview-page-number">{number}</p>
      </div>
    </section>
  );
});

export interface PreviewProps extends Omit<WindowProps, "children" | "title"> {
  /**
   * The document the window shows: a PDF, which is its text, or an image. The window keeps
   * the page, the search and the zoom of the document it was given first; give the component
   * a `key` to open another document afresh.
   * @default the booklet `islandFerry`
   */
  document?: PreviewDocument;
  /**
   * The page of a PDF shown at first, from 1. With a `defaultQuery` it is the page shown if
   * the text is found on it, and also if the text is found nowhere; if the text is found on
   * other pages only, the window opens on the first page found.
   * @default 1
   */
  defaultPage?: number;
  /** Called with the number of the page that comes to the top of the view. */
  onPageChange?: (page: number) => void;
  /**
   * The text in the search field at first. With text in the field a PDF window has the find
   * bar, and its sidebar lists the pages found. The window opens on the `defaultPage` if that
   * is one of them, or else on the first page found in the `defaultSort` order, as a search
   * typed into the field goes there; when nothing is found it opens on the `defaultPage`.
   * @default ""
   */
  defaultQuery?: string;
  /**
   * The order of the pages found at first.
   * @default "page"
   */
  defaultSort?: PreviewSort;
  /**
   * What the sidebar shows at first while nothing is searched for.
   * @default "thumbnails" for a PDF, "hidden" for an image
   */
  defaultSidebar?: PreviewSidebar;
  /**
   * The zoom at first, as a multiple of the size at which a page is as wide as the view and
   * an image fills it.
   * @default 1
   */
  defaultZoom?: number;
  /** Called with the service chosen in the Share menu. Nothing is shared. */
  onShare?: (service: PreviewShareService) => void;
  /** For the `WindowControls`. */
  onClose?: WindowControlsProps["onClose"];
  /** For the `WindowControls`. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** For the `WindowControls`. */
  onZoom?: WindowControlsProps["onZoom"];
  /** For the `WindowControls`: what the green button does now. */
  zoomRole?: WindowControlsProps["zoomRole"];
  /** For the `WindowControls`. */
  minimizeDisabled?: boolean;
  /** For the `WindowControls`. */
  zoomDisabled?: boolean;
  /** Further props for the `WindowControls`. */
  controlsProps?: WindowControlsProps;
  /** Called when the title bar itself is pressed: a window manager starts a move here. */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /** Called when the title bar itself is double-clicked. */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
}

/**
 * Preview, as in macOS 10.15 Catalina: a document window with a unified toolbar, a sidebar of
 * page thumbnails and the document beside it. Searching a PDF opens the find bar and lists the
 * pages found in the sidebar; choosing a page there, or a thumbnail, brings that page into view.
 *
 * The root is the library's `Window` and takes every one of its props, so a page or a window
 * manager places it (`style`, `width`, `height`, `ref`), tells it whether it is key (`state`)
 * and hears its window controls and its title bar through the callbacks. Nothing is opened,
 * saved or shared: a document is the data it is given.
 */
export function Preview({
  document = islandFerry,
  defaultPage = 1,
  onPageChange,
  defaultQuery = "",
  defaultSort = "page",
  defaultSidebar,
  defaultZoom = 1,
  onShare,
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
  width = 1147,
  height = 793,
  className,
  ...props
}: PreviewProps) {
  const pdf = document.kind === "pdf" ? document : null;
  const count = pdf ? pdf.pages.length : 1;
  // A PDF without pages has nothing to show, to list or to find.
  const empty = count === 0;
  const [page, setPage] = useState(() => {
    const given = Math.min(Math.max(Math.round(defaultPage), 1), Math.max(count, 1));
    // A search the window opens with goes where a search typed goes: to the first page
    // found, unless the page given is one of them.
    const found = pdf ? searchDocument(pdf, defaultQuery, defaultSort) : [];
    const first = found[0];
    return first && !found.some((result) => result.page === given) ? first.page : given;
  });
  const [query, setQuery] = useState(defaultQuery);
  const [sort, setSort] = useState<PreviewSort>(defaultSort);
  const [sidebar, setSidebar] = useState<PreviewSidebar>(
    defaultSidebar ?? (pdf ? "thumbnails" : "hidden"),
  );
  const [sidebarWidth, setSidebarWidth] = useState(205);
  const [zoom, setZoom] = useState(defaultZoom);
  const [turns, setTurns] = useState(0);
  const [highlighting, setHighlighting] = useState(true);
  const [highlight, setHighlight] = useState<PreviewHighlight>("green");
  const [markup, setMarkup] = useState(false);
  const [tool, setTool] = useState<Tool>("sketch");
  const scopeLabel = useId();

  const searching = pdf !== null && query.trim() !== "";
  const results = useMemo(
    () => (pdf && searching ? searchDocument(pdf, query, sort) : []),
    [pdf, searching, query, sort],
  );
  const sidebarShown = searching || sidebar !== "hidden";

  const viewport = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  // Set when the view is scrolled from here: the scroll event that follows is its own.
  const scrolled = useRef(false);
  // The width of the view when a page was last brought to its top. A page is as wide as the
  // view allows, so at another width every page starts somewhere else. The width is the
  // view's box as it is laid out, fractions of a point included (`widthOf`): a change of
  // less than a point changes the height of every page before the one shown.
  const placed = useRef(0);
  // The page to bring to the top of the view once the window is laid out: at first, when a
  // page is chosen, and when the pages change size under the view (zoom, rotation, sidebar).
  const [wanted, setWanted] = useState<{ page: number } | null>(() => ({ page }));
  useLayoutEffect(() => {
    const view = viewport.current;
    if (!wanted || !view) return;
    if (bring(view, wanted.page)) scrolled.current = true;
    placed.current = widthOf(view);
  }, [wanted]);

  // The same when the view itself changes width, as the sidebar's divider is dragged or the
  // window resized: the page shown is put back at the top, before the view is painted.
  const showing = useRef(page);
  useLayoutEffect(() => {
    showing.current = page;
  });
  useLayoutEffect(() => {
    const view = viewport.current;
    if (!view) return;
    return observeResize(view, () => {
      const width = widthOf(view);
      if (width === placed.current) return;
      placed.current = width;
      if (bring(view, showing.current)) scrolled.current = true;
    });
  }, []);

  const show = (next: number) => {
    setWanted({ page: next });
    if (next === page) return;
    setPage(next);
    onPageChange?.(next);
  };
  // The same page again, after its size changed.
  const settle = () => setWanted({ page });

  // The page shown is the last one that starts at or over the top of the view.
  const follow = () => {
    if (scrolled.current) {
      scrolled.current = false;
      return;
    }
    const view = viewport.current;
    if (!view || !pdf || empty) return;
    // At another width than the page was placed at, the view was scrolled by its new layout
    // (a shorter document ends over the view) and not by its reader: the page shown is put
    // back at the top when the view reports its size.
    if (widthOf(view) !== placed.current) return;
    const top = view.getBoundingClientRect().top + PAGE_SLOP;
    let shown = 1;
    for (const leaf of view.querySelectorAll("[data-page]")) {
      if (leaf.getBoundingClientRect().top > top) break;
      shown = Number(leaf.getAttribute("data-page"));
    }
    if (shown !== page) {
      setPage(shown);
      onPageChange?.(shown);
    }
  };

  const search = (text: string) => {
    setQuery(text);
    if (!pdf || text.trim() === "") return settle();
    // A search goes to the first page found, unless the page shown is one of them.
    const found = searchDocument(pdf, text, sort);
    const first = found[0];
    if (first && !found.some((result) => result.page === page)) show(first.page);
    else settle();
  };

  const position = results.findIndex((result) => result.page === page);
  const step = (by: 1 | -1) => {
    const next = results[position < 0 ? 0 : position + by];
    if (next) show(next.page);
  };

  const zoomBy = (factor: number) => {
    setZoom((now) => Math.min(Math.max(now * factor, ZOOM_MIN), ZOOM_MAX));
    settle();
  };

  const rows = searching ? results.map((result) => result.page) : null;
  const rowCount = rows ? rows.length : count;
  const picture = document.kind === "image" ? (document.src ?? PLACEHOLDER_PICTURE) : undefined;
  const renderRow = useCallback(
    (index: number) => {
      const result = searching ? results[index] : undefined;
      const number = result ? result.page : index + 1;
      const source = pdf?.pages[number - 1];
      return (
        <span
          className="mac-preview-row"
          data-selected={number === page ? "" : undefined}
          data-found={result ? "" : undefined}
        >
          <span className="mac-preview-thumbnail" data-turns={turns}>
            {source ? (
              <PageMiniature page={source} />
            ) : (
              <ImageView src={picture} alt="" scaling="axes-independently" />
            )}
          </span>
          <span className="mac-preview-row-text">
            <span className="mac-preview-row-head">
              <span className="mac-preview-row-title">
                {pdf ? `Page ${number}` : document.name}
              </span>
              {result ? (
                <span className="mac-preview-row-count">{matches(result.count)}</span>
              ) : null}
            </span>
            {result ? <span className="mac-preview-row-snippet">{result.snippet}</span> : null}
          </span>
        </span>
      );
    },
    [searching, results, pdf, document.name, turns, picture, page],
  );

  const title = pdf && !empty ? `${pdf.name} (page ${page} of ${count})` : document.name;
  const canvas = {
    "--mac-preview-zoom": zoom,
    ...(document.kind === "image" ? { "--mac-preview-aspect": document.aspect } : null),
  } as CSSProperties;

  return (
    <Window
      state={state}
      width={width}
      height={height}
      className={className ? `mac-preview ${className}` : "mac-preview"}
      {...props}
    >
      <TitleBar
        variant="unified"
        divider={searching || markup ? "bar" : "content"}
        title={title}
        icon={<DocumentIcon kind={document.kind} />}
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
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      >
        <Toolbar aria-label="Preview toolbar" className="mac-preview-toolbar">
          <ToolbarPullDown compact image={<SystemImage name="sidebar" />} aria-label="View">
            <MenuRadioGroup
              value={sidebar}
              onValueChange={(value) => {
                setSidebar(value as PreviewSidebar);
                settle();
              }}
            >
              <MenuRadioItem value="hidden">Hide Sidebar</MenuRadioItem>
              <MenuRadioItem value="thumbnails">Thumbnails</MenuRadioItem>
            </MenuRadioGroup>
          </ToolbarPullDown>
          <ToolbarSegmentedControl variant="separated" tracking="momentary" aria-label="Zoom">
            <ToolbarSegment
              aria-label="Zoom Out"
              style={ZOOM_OUT}
              disabled={zoom <= ZOOM_MIN}
              onClick={() => zoomBy(1 / ZOOM_STEP)}
            >
              <PreviewGlyph name="zoomOut" />
            </ToolbarSegment>
            <ToolbarSegment
              aria-label="Zoom In"
              style={ZOOM_IN}
              disabled={zoom >= ZOOM_MAX}
              onClick={() => zoomBy(ZOOM_STEP)}
            >
              <PreviewGlyph name="zoomIn" />
            </ToolbarSegment>
          </ToolbarSegmentedControl>
          <ShareMenu style={SHARE}>
            {SERVICES.map(([service, name]) => (
              <ShareMenuItem
                key={service}
                image={<PreviewGlyph name={service} size={15} />}
                onClick={() => onShare?.(service)}
              >
                {name}
              </ShareMenuItem>
            ))}
          </ShareMenu>
          <ToolbarSpace />
          <ToolbarSplitPullDown
            image={<PreviewGlyph name="highlight" size={14} />}
            aria-label={highlighting ? "Stop Highlighting" : "Highlight"}
            menuLabel="Highlight Color"
            disabled={!pdf}
            style={HIGHLIGHT}
            onClick={() => setHighlighting(!highlighting)}
          >
            <MenuRadioGroup
              value={highlight}
              onValueChange={(value) => {
                setHighlight(value as PreviewHighlight);
                setHighlighting(true);
              }}
            >
              {HIGHLIGHTS.map((color) => (
                <MenuRadioItem key={color} value={color}>
                  {capitalize(color)}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
            <MenuSeparator />
            <MenuItem disabled={!highlighting} onClick={() => setHighlighting(false)}>
              No Highlight
            </MenuItem>
          </ToolbarSplitPullDown>
          <ToolbarButton
            aria-label="Rotate Left"
            style={ROTATE}
            onClick={() => {
              setTurns((turns + 1) % 4);
              settle();
            }}
          >
            <PreviewGlyph name="rotate" />
          </ToolbarButton>
          <ToolbarButton
            aria-label="Show Markup Toolbar"
            style={MARKUP}
            pressed={markup}
            onPressedChange={(pressed) => {
              setMarkup(pressed);
              settle();
            }}
          >
            <PreviewGlyph name="markup" />
          </ToolbarButton>
          <ToolbarSearchField
            style={SEARCH}
            value={query}
            onValueChange={search}
            inputRef={searchInput}
          />
        </Toolbar>
      </TitleBar>
      {markup ? (
        <div className="mac-preview-markup">
          <MarkupToolbar aria-label="Markup">
            {TOOLS.map(([name, label]) => (
              <MarkupToolbarTool
                key={name}
                aria-label={label}
                selected={tool === name}
                onClick={() => setTool(name)}
              >
                <PreviewGlyph name={name} />
              </MarkupToolbarTool>
            ))}
            <MarkupToolbarSeparator />
            <MarkupToolbarTool aria-label="Shapes" disabled>
              <PreviewGlyph name="shapes" />
            </MarkupToolbarTool>
            <MarkupToolbarTool aria-label="Border Color" disabled>
              <MarkupToolbarSwatch variant="border" color="var(--mac-color-system-red)" />
            </MarkupToolbarTool>
            <MarkupToolbarTool aria-label="Fill Color" disabled>
              <MarkupToolbarSwatch />
            </MarkupToolbarTool>
          </MarkupToolbar>
        </div>
      ) : null}
      {searching ? (
        <ScopeBar surface="toolbar" className="mac-preview-find">
          <ScopeBarLabel id={scopeLabel}>Sort by:</ScopeBarLabel>
          <ScopeBarGroup
            aria-labelledby={scopeLabel}
            value={sort}
            onValueChange={(value) => setSort(value as PreviewSort)}
          >
            <ScopeBarButton value="rank">Search Rank</ScopeBarButton>
            <ScopeBarButton value="page">Page Order</ScopeBarButton>
          </ScopeBarGroup>
          <ScopeBarActions>
            <span role="status" className="mac-preview-found">
              {results.length > 0
                ? `Found on ${results.length} ${results.length === 1 ? "page" : "pages"}`
                : "Not found"}
            </span>
            <ScopeBarActionGroup aria-label="Pages found">
              <ScopeBarAction
                glyph="previous"
                aria-label="Previous"
                disabled={position <= 0}
                onClick={() => step(-1)}
              />
              <ScopeBarAction
                glyph="next"
                aria-label="Next"
                disabled={results.length === 0 || position === results.length - 1}
                onClick={() => step(1)}
              />
            </ScopeBarActionGroup>
            <ScopeBarAction
              onClick={() => {
                search("");
                searchInput.current?.focus();
              }}
            >
              Done
            </ScopeBarAction>
          </ScopeBarActions>
        </ScopeBar>
      ) : null}
      <WindowBody background="content" className="mac-preview-body">
        <SplitView className="mac-preview-split">
          <SplitViewPane
            size={sidebarShown ? sidebarWidth : 0}
            onSizeChange={(size) => {
              if (size > 0) setSidebarWidth(size);
              else if (!searching) setSidebar("hidden");
            }}
            minSize={150}
            maxSize={320}
            collapsible
            className="mac-preview-sidebar"
          >
            <div className="mac-preview-file">{document.name}</div>
            <ListView
              aria-label={searching ? "Pages found" : "Thumbnails"}
              count={rowCount}
              rowHeight={82}
              separatorInset={14}
              renderRow={renderRow}
              getRowId={(index) => (rows ? (rows[index] ?? index) : index + 1)}
              value={!empty && (!rows || rows.includes(page)) ? [page] : []}
              onValueChange={(value) => {
                if (value.length > 0) show(Number(value[0]));
              }}
              className="mac-preview-rows"
              style={ROWS}
            />
          </SplitViewPane>
          <SplitViewDivider aria-label="Resize the sidebar" style={DIVIDER} />
          <SplitViewPane minSize={240} className="mac-preview-content">
            <ScrollView
              axis="both"
              knobStyle={pdf ? "dark" : "default"}
              className="mac-preview-canvas"
              data-kind={document.kind}
              data-turns={turns}
              data-highlight={highlighting ? highlight : undefined}
              style={canvas}
              viewportProps={{
                ref: viewport,
                onScroll: follow,
                role: "document",
                "aria-label": document.name,
                tabIndex: 0,
              }}
            >
              {empty ? (
                <EmptyState role="status">No Pages</EmptyState>
              ) : (
                <div className="mac-preview-leaves">
                  {document.kind === "pdf" ? (
                    document.pages.map((source, index) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: the pages of a document never reorder
                      <Page key={index} page={source} number={index + 1} query={query} />
                    ))
                  ) : (
                    <div className="mac-preview-leaf" data-page={1}>
                      <ImageView
                        className="mac-preview-picture"
                        src={picture}
                        alt={document.alt}
                        scaling="axes-independently"
                      />
                    </div>
                  )}
                </div>
              )}
            </ScrollView>
          </SplitViewPane>
        </SplitView>
      </WindowBody>
    </Window>
  );
}

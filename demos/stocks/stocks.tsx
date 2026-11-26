"use client";

import { CardGrid } from "macalicious/card-grid";
import {
  CatalystChrome,
  type CatalystChromeProps,
  CatalystSidebar,
} from "macalicious/catalyst-chrome";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { EmptyState } from "macalicious/empty-state";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { SearchField } from "macalicious/search-field";
import { Segment, SegmentedControl } from "macalicious/segmented-control";
import { StockList, StockRow } from "macalicious/stock-row";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { SystemImage } from "macalicious/system-image";
import { TextField } from "macalicious/text-field";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { Window, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useState,
} from "react";
import { linkAddress, openUrl } from "../desktop/desktop-open-url";
import { copyText, LinkShareItems, NO_ADDRESS_REASON } from "../desktop/desktop-share-link";
import { NewsGlyph, StoryArtwork } from "./stocks-artwork";
import {
  type BadgeMode,
  badgeLabel,
  badgeText,
  history as demoHistory,
  directionOf,
  formatChange,
  formatPercent,
  formatPrice,
  lightMarket,
  matchesQuery,
  nextBadgeMode,
  RANGE_LABELS,
  RANGE_NAMES,
  RANGES,
  type StockAlert,
  type StockHistory,
  type StockQuote,
  type StockRange,
  type StockSearchResult,
  type StockStory,
  type StocksMarket,
  type StoryLayout,
  statistics,
  storiesFor,
} from "./stocks-data";
import { takeKeyboard, useStocksMenus } from "./stocks-menus";
import {
  afterRemoving,
  allOf,
  clicked,
  only,
  stepped,
  type WatchlistSelection,
} from "./stocks-selection";
import "./stocks.tokens.css";
import "./stocks.css";

/** Measured: both toolbar buttons are 39 pt wide. */
const TOOLBAR_BUTTON: CSSProperties = { width: 39, padding: 0 };
const NO_ALERTS: readonly StockAlert[] = [];
/** The type a dragged watchlist row carries its symbol under. */
const DRAG_TYPE = "application/x-macalicious-stock";
/**
 * The search field is the library's sidebar field in the iOS field's metrics and colours: 28 pt
 * tall with 4 pt corners, a flat fill and no edge. Its variables are set on the block around it.
 */
const SEARCH = {
  "--mac-search-field-height": "28px",
  "--mac-radius-control-regular": "4px",
  "--mac-search-field-sidebar-fill": "var(--mac-stocks-search-fill)",
  "--mac-search-field-sidebar-border-top": "transparent",
  "--mac-search-field-sidebar-border-side": "transparent",
  "--mac-search-field-sidebar-border-bottom": "transparent",
  "--mac-search-field-inner-shadow": "none",
  "--mac-search-field-glyph": "var(--mac-stocks-search-glyph)",
  "--mac-color-text-placeholder": "var(--mac-stocks-search-placeholder)",
} as CSSProperties;
/** The chrome's toolbar with no darker stretch over a column: the value its stylesheet falls to. */
const NO_COLUMN = { "--mac-catalyst-chrome-sidebar-width": "-126px" } as CSSProperties;

/** Measured: the search field is 305 pt wide, 12.5 pt from the sidebar's edges. */
const SEARCH_FIELD: CSSProperties = { width: "100%" };
/**
 * The story grids have no margins and no room under them, which the feed's column gives, and
 * their rows are 16 pt apart.
 */
const STORY_GRID = { padding: 0, "--mac-card-grid-row-gap": "16.1px" } as CSSProperties;

/** What a row's menu says of a command that takes one symbol while several are selected. */
const ONE_SYMBOL = "Select one symbol to do this.";

/** How long the sidebar's footer shows what Edit > Paste could not do. */
const EDIT_NOTE_MS = 6000;

/** The chart's canvas, in points at the captured width; it stretches with the column. */
const CHART_WIDTH = 493;
const CHART_HEIGHT = 168;

export interface StocksKeptView {
  symbol?: string;
  range?: StockRange;
  badgeMode?: BadgeMode;
  sidebarHidden?: boolean;
}

export interface StocksProps extends Omit<WindowProps, "children"> {
  /**
   * The quotes and the news the app shows. The default is the market of the Aqua capture;
   * `darkMarket` in `stocks-data.ts` is the one of the Dark Aqua capture.
   */
  market?: StocksMarket;
  /**
   * The prices and labels of a symbol's chart for a range. Left out, or answering `undefined`,
   * the demo computes them (`history` and `RANGE_LABELS` in `stocks-data.ts`); an answer with
   * fewer than two prices leaves the chart empty, with its `status`.
   */
  history?: (stock: StockQuote, range: StockRange) => StockHistory | undefined;
  /** Called with the symbol whose detail view is shown, or `undefined` for the news. */
  onSymbolChange?: (symbol: string | undefined) => void;
  /** Called with the range the detail view's chart is set to. */
  onRangeChange?: (range: StockRange) => void;
  /** Called with the search field's text whenever it changes. */
  onQueryChange?: (query: string) => void;
  /**
   * Symbols found for the search field's text, listed under the watchlist's matches to be
   * added; `null` or left out lists none.
   */
  searchResults?: readonly StockSearchResult[] | null;
  /** Adds a found symbol to the watchlist. Without it, found symbols are not listed. */
  onAddSymbol?: (symbol: string) => void;
  /** Removes a symbol from the watchlist. */
  onRemoveSymbol?: (symbol: string) => void;
  /** Asks for the quotes and the news again: View > Refresh. Without it the command is dimmed. */
  onRefresh?: () => void;
  /**
   * The web page of a symbol, shared from the Share menu (Copy Link, and the apps that take a
   * link: `desktop-share-link.tsx`). Without it the Share menu has no link rows.
   */
  shareLinkFor?: (symbol: string) => string;
  /**
   * Moves a watchlist symbol to place `to` (counted from 0, in the watchlist's order): Share >
   * Move Up and Move Down for the symbol shown, Option-Up and Option-Down Arrow on a row, and a
   * row dragged onto another, which takes that row's place. None of them is offered while a search
   * filters the list. Without it the watchlist cannot be reordered.
   */
  onMoveSymbol?: (symbol: string, to: number) => void;
  /**
   * The price alerts, shown in the detail view of their symbol.
   * @default []
   */
  alerts?: readonly StockAlert[];
  /** Adds a price alert; with it the detail view offers the alert form. */
  onAddAlert?: (symbol: string, when: "above" | "below", price: number) => void;
  /** Removes a price alert. */
  onRemoveAlert?: (id: string) => void;
  /**
   * What the window shows until the person chooses otherwise in it: their last symbol, range and
   * badge and whether the sidebar was hidden. It may arrive after the window has opened.
   */
  keptView?: StocksKeptView;
  /** Shows this symbol: each new object asks again, over what the person chose in the window. */
  askedSymbol?: { symbol: string };
  /** Called with the badge the person's click on a row's badge chose. */
  onBadgeModeChange?: (mode: BadgeMode) => void;
  /** Called when View > Show Sidebar or Hide Sidebar is chosen. */
  onSidebarShownChange?: (shown: boolean) => void;
  /**
   * The line at the foot of the watchlist: where the quotes come from.
   * @default "Sample data"
   */
  footer?: ReactNode;
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
  /**
   * For the toolbar row, which is this window's drag region: called when the primary pointer
   * button goes down on the bar itself, not on a control in it. A window manager starts moving
   * the window here.
   */
  onDragRegionPointerDown?: CatalystChromeProps["onDragRegionPointerDown"];
  /** For the toolbar row: called when the bar itself is double-clicked. */
  onDragRegionDoubleClick?: CatalystChromeProps["onDragRegionDoubleClick"];
}

/** A story's contextual menu: read it here, open it at its publisher, copy its address, share it. */
function StoryMenuItems({ story, onRead }: { story: StockStory; onRead: StoryReader }) {
  const address = linkAddress(story.url);
  const reason = address === null ? NO_ADDRESS_REASON : undefined;
  return (
    <>
      <MenuItem onClick={() => onRead(story)}>Read Story</MenuItem>
      <MenuItem
        disabled={address === null}
        title={reason}
        onClick={() => {
          if (address) openUrl(address, "stocks");
        }}
      >
        Open Story
      </MenuItem>
      <MenuItem
        disabled={address === null}
        title={reason}
        onClick={() => {
          if (address) copy(address);
        }}
      >
        Copy Link
      </MenuItem>
      <MenuSeparator />
      <Submenu>
        <SubmenuTrigger disabled={address === null} title={reason}>
          Share
        </SubmenuTrigger>
        <SubmenuPopup>
          <LinkShareItems plain url={address ?? ""} title={story.headline} from="stocks" />
        </SubmenuPopup>
      </Submenu>
    </>
  );
}

/** Opens a story in the window. */
type StoryReader = (story: StockStory) => void;

/** One story: its picture, then the publisher, the headline and how old it is. */
function Story({
  story,
  layout,
  onRead,
}: {
  story: StockStory;
  layout: StoryLayout;
  onRead: StoryReader;
}) {
  return (
    <ContextualMenu>
      <ContextualMenuTrigger className="mac-stocks-menu-area">
        <article className="mac-stocks-story" data-layout={layout}>
          <span className="mac-stocks-story-art">
            <StoryArtwork />
          </span>
          <div className="mac-stocks-story-text">
            <span className="mac-stocks-story-publisher">{story.publisher}</span>
            <h3 className="mac-stocks-story-headline">
              {story.url ? (
                <a
                  className="mac-stocks-story-link"
                  href={story.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => {
                    event.preventDefault();
                    onRead(story);
                  }}
                >
                  {story.headline}
                </a>
              ) : (
                story.headline
              )}
            </h3>
            {layout === "beside" && story.summary ? (
              <p className="mac-stocks-story-summary">{story.summary}</p>
            ) : null}
            <span className="mac-stocks-story-age">{story.age}</span>
          </div>
        </article>
      </ContextualMenuTrigger>
      <ContextualMenuPopup aria-label="Story">
        <StoryMenuItems story={story} onRead={onRead} />
      </ContextualMenuPopup>
    </ContextualMenu>
  );
}

/**
 * A story read in the window: what the publisher's feed says of it, and the way to the whole story
 * at the publisher, whose article the feed does not carry.
 */
function StoryReaderPane({ story }: { story: StockStory }) {
  const address = linkAddress(story.url);
  return (
    <article className="mac-stocks-feed mac-stocks-reader" aria-label="Story">
      <span className="mac-stocks-story-publisher">{story.publisher}</span>
      <h2 className="mac-stocks-title">{story.headline}</h2>
      <span className="mac-stocks-story-age">{story.age}</span>
      <p className="mac-stocks-reader-summary">
        {story.summary ?? "The publisher's feed gives only this story's headline."}
      </p>
      {address ? (
        <PushButton onClick={() => openUrl(address, "stocks")}>
          Read the Whole Story at {story.publisher}
        </PushButton>
      ) : null}
    </article>
  );
}

interface StoryGridProps {
  /** The id of the heading that names the grid. */
  labelledBy: string;
  stories: readonly StockStory[];
  /** How many of the stories are cards with the picture above; the rest are compact. */
  cards: number;
  onRead: StoryReader;
}

/** Stories two to a row, in the library's card grid. */
function StoryGrid({ labelledBy, stories, cards, onRead }: StoryGridProps) {
  return (
    <CardGrid
      aria-labelledby={labelledBy}
      className="mac-stocks-stories"
      columns={2}
      gap={24}
      style={STORY_GRID}
    >
      {stories.map((story, index) => (
        <Story
          key={story.id}
          story={story}
          layout={index < cards ? "card" : "compact"}
          onRead={onRead}
        />
      ))}
    </CardGrid>
  );
}

/** The business news: a title, the lead story and the rest two to a row. */
function News({ market, onRead }: { market: StocksMarket; onRead: StoryReader }) {
  const id = useId();
  const [lead, ...rest] = market.stories;
  return (
    <div className="mac-stocks-feed">
      <h2 id={id} className="mac-stocks-title">
        Top Stories
      </h2>
      {lead ? <Story story={lead} layout={market.leadLayout} onRead={onRead} /> : null}
      <StoryGrid labelledBy={id} stories={rest} cards={market.cards} onRead={onRead} />
    </div>
  );
}

interface ChartProps {
  stock: StockQuote;
  range: StockRange;
  /** How much of the session has passed; only the chart of the day stops short. */
  progress: number;
  /** The prices and labels to draw, when they are not the demo's. */
  shown?: StockHistory;
}

/** The chart of the detail view: the range's prices as a line over a fading fill. */
function Chart({ stock, range, progress, shown }: ChartProps) {
  const gradient = useId();
  // Prices that were given but are too few to draw (still loading, or none) leave the chart
  // empty with what it says; only a chart given nothing at all draws the demo's history.
  if (shown && shown.prices.length < 2) {
    return (
      <figure className="mac-stocks-chart" data-empty="">
        <EmptyState role="status" className="mac-stocks-chart-empty">
          {shown.status ?? "No Chart Data"}
        </EmptyState>
      </figure>
    );
  }
  const prices = shown ? shown.prices : demoHistory(stock, range);
  const labels = shown ? shown.labels : RANGE_LABELS[range];
  const first = prices[0] ?? stock.price;
  // The chart tells of what it draws: its last price, which a source's history may give from a
  // moment other than the quote's. The day is measured against the previous close, a longer
  // range against its first price.
  const last = prices[prices.length - 1] ?? stock.price;
  // A symbol without a quote has no previous close: its day is measured from its first price.
  const base = range === "1D" && !stock.unavailable ? stock.price - stock.change : first;
  const direction = last < base ? "loss" : "gain";
  const all = [...prices, base];
  const low = all.reduce((a, b) => Math.min(a, b));
  const high = all.reduce((a, b) => Math.max(a, b));
  const y = (value: number) =>
    high > low ? +(4 + ((high - value) / (high - low)) * (CHART_HEIGHT - 8)).toFixed(2) : 84;
  const reach = CHART_WIDTH * (range === "1D" ? progress : 1);
  const step = reach / Math.max(1, prices.length - 1);
  const line = prices.map((value, index) => `${+(index * step).toFixed(2)},${y(value)}`).join(" ");
  const end = +((prices.length - 1) * step).toFixed(2);
  return (
    <figure className="mac-stocks-chart" data-direction={direction}>
      <div className="mac-stocks-chart-plot">
        <svg
          role="img"
          aria-label={`${stock.symbol}, ${RANGE_NAMES[range]}: from ${formatPrice(base)} to ${formatPrice(last)}, ${formatPercent({ price: last, change: last - base })}`}
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
        >
          <linearGradient
            id={gradient}
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2="0"
            y2={CHART_HEIGHT}
          >
            <stop className="mac-stocks-chart-fill-top" offset="0" />
            <stop className="mac-stocks-chart-fill-bottom" offset="1" />
          </linearGradient>
          <polygon
            fill={`url(#${gradient})`}
            points={`0,${CHART_HEIGHT} ${line} ${end},${CHART_HEIGHT}`}
          />
          <line className="mac-stocks-chart-base" x2={CHART_WIDTH} y1={y(base)} y2={y(base)} />
          <polyline className="mac-stocks-chart-line" points={line} />
        </svg>
        <div className="mac-stocks-chart-scale" aria-hidden="true">
          <span>{formatPrice(high)}</span>
          <span>{formatPrice((high + low) / 2)}</span>
          <span>{formatPrice(low)}</span>
        </div>
      </div>
      <div className="mac-stocks-chart-times" aria-hidden="true">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </figure>
  );
}

interface AlertsProps {
  stock: StockQuote;
  alerts: readonly StockAlert[];
  /** Adds an alert: without it, the alerts are listed and no form is offered. */
  onAdd?: (symbol: string, when: "above" | "below", price: number) => void;
  onRemove?: (id: string) => void;
}

const ALERT_TIME = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

/** What an alert says: its condition and, once it has fired, when and at what price. */
export function alertText(alert: StockAlert): string {
  const condition =
    alert.above !== undefined
      ? `Above ${formatPrice(alert.above)}`
      : `Below ${formatPrice(alert.below ?? 0)}`;
  return alert.fired
    ? `${condition}: reached ${formatPrice(alert.fired.price)} on ${ALERT_TIME.format(alert.fired.at)}`
    : condition;
}

/** The price alerts of a symbol, and the form that adds one when alerts can be added. */
function Alerts({ stock, alerts, onAdd, onRemove }: AlertsProps) {
  const id = useId();
  // Until the person picks a direction, it follows the quote: Below when the price is down. A
  // quote that arrives after the form appeared still sets it.
  const [picked, setWhen] = useState<"above" | "below" | null>(null);
  const when = picked ?? (stock.change < 0 ? "below" : "above");
  const [price, setPrice] = useState("");
  const value = Number(price.replaceAll(",", ""));
  const valid = price.trim() !== "" && Number.isFinite(value) && value > 0;
  const mine = alerts.filter((alert) => alert.symbol === stock.symbol);
  // Read-only and none for this symbol: nothing to show.
  if (!onAdd && mine.length === 0) return null;
  return (
    <section className="mac-stocks-alerts" aria-labelledby={id}>
      <h3 id={id} className="mac-stocks-heading">
        Price Alerts
      </h3>
      {mine.length > 0 ? (
        <ul className="mac-stocks-alert-list">
          {mine.map((alert) => (
            <li
              key={alert.id}
              className="mac-stocks-alert"
              data-fired={alert.fired ? "" : undefined}
            >
              <span>{alertText(alert)}</span>
              {onRemove ? (
                <PushButton size="small" onClick={() => onRemove(alert.id)}>
                  Remove
                </PushButton>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {onAdd ? (
        <form
          className="mac-stocks-alert-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!valid) return;
            onAdd(stock.symbol, when, value);
            setPrice("");
          }}
        >
          <PopUpButton
            aria-label="Alert when the price is"
            size="small"
            value={when}
            onValueChange={(next) => setWhen(next === "below" ? "below" : "above")}
          >
            <PopUpButtonItem value="above">Above</PopUpButtonItem>
            <PopUpButtonItem value="below">Below</PopUpButtonItem>
          </PopUpButton>
          <TextField
            aria-label="Alert price"
            size="small"
            inputMode="decimal"
            placeholder={formatPrice(stock.price)}
            value={price}
            onValueChange={(next) => setPrice(String(next))}
            className="mac-stocks-alert-price"
          />
          <PushButton size="small" type="submit" disabled={!valid}>
            Add Alert
          </PushButton>
        </form>
      ) : null}
    </section>
  );
}

interface DetailProps {
  stock: StockQuote;
  market: StocksMarket;
  range: StockRange;
  onRangeChange: (range: StockRange) => void;
  shown?: StockHistory;
  alerts?: Omit<AlertsProps, "stock">;
  onRead: StoryReader;
}

/** A symbol's own view: its price, the chart with its ranges, the figures and its stories. */
function Detail({ stock, market, range, onRangeChange, shown, alerts, onRead }: DetailProps) {
  const id = useId();
  return (
    <div className="mac-stocks-feed">
      <header className="mac-stocks-quote">
        <h2 className="mac-stocks-title">{stock.symbol}</h2>
        <p className="mac-stocks-quote-name">{stock.name}</p>
        <p
          className="mac-stocks-quote-price"
          data-direction={stock.unavailable ? undefined : directionOf(stock)}
        >
          <span className="mac-stocks-quote-last">
            {stock.unavailable ? "—" : formatPrice(stock.price)}
          </span>{" "}
          <span className="mac-stocks-quote-change">
            {stock.unavailable ? "—" : `${formatChange(stock.change)} (${formatPercent(stock)})`}
          </span>
        </p>
      </header>
      <SegmentedControl
        aria-label="Range"
        value={[range]}
        onValueChange={(next) => {
          const chosen = RANGES.find((candidate) => candidate === next[0]);
          if (chosen) onRangeChange(chosen);
        }}
      >
        {RANGES.map((candidate) => (
          <Segment key={candidate} value={candidate}>
            {candidate}
          </Segment>
        ))}
      </SegmentedControl>
      <Chart stock={stock} range={range} progress={market.progress} shown={shown} />
      <dl className="mac-stocks-figures">
        {statistics(stock).map(([label, value]) => (
          <div key={label} className="mac-stocks-figure">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {alerts ? <Alerts stock={stock} {...alerts} /> : null}
      <h3 id={id} className="mac-stocks-heading">
        Business News
      </h3>
      <StoryGrid
        labelledBy={id}
        stories={storiesFor(stock.symbol, market.stories, stock.name)}
        cards={4}
        onRead={onRead}
      />
    </div>
  );
}

/** Puts a text on the clipboard where the page may (`copyText`, with its fallback). */
function copy(text: string) {
  void copyText(text);
}

/** The rows that share a symbol, in the toolbar's Share menu and a row's Share submenu. */
function ShareRows({
  stock,
  shareLinkFor,
}: {
  stock: StockQuote;
  shareLinkFor: StocksProps["shareLinkFor"];
}) {
  return (
    <>
      {shareLinkFor ? (
        <LinkShareItems
          plain
          url={shareLinkFor(stock.symbol)}
          title={stock.unavailable ? stock.symbol : `${stock.symbol} ${stock.name}`}
          from="stocks"
        />
      ) : null}
      <MenuItem onClick={() => copy(stock.symbol)}>Copy Symbol</MenuItem>
      <MenuItem
        disabled={stock.unavailable}
        title={stock.unavailable ? "This symbol has no price to copy yet." : undefined}
        onClick={() => copy(`${stock.symbol} ${formatPrice(stock.price)}`)}
      >
        Copy Price
      </MenuItem>
    </>
  );
}

/**
 * Stocks, as in macOS 10.15 Catalina: an iPad app in a Mac window, with the watchlist in the
 * sidebar and, beside it, the business news or the chart and figures of the symbol chosen in
 * the watchlist.
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a page
 * or a window manager places it (`style`, `width`, `height`, `ref`) and tells it whether it is
 * key (`state`); the window controls' and the toolbar row's callbacks, the eight props a
 * managed window's `render` supplies beside the window's, are handed to those parts.
 *
 * Nothing is fetched: the quotes and the stories are the `market` it is given. The desktop's
 * Ferrite application gives it real ones, with the history, search and alert props
 * (`stocks-desktop.tsx`).
 */
export function Stocks({
  market = lightMarket,
  history,
  onSymbolChange,
  onRangeChange,
  onQueryChange,
  searchResults,
  onAddSymbol,
  onRemoveSymbol,
  onRefresh,
  shareLinkFor,
  onMoveSymbol,
  alerts = NO_ALERTS,
  onAddAlert,
  onRemoveAlert,
  keptView,
  askedSymbol,
  onBadgeModeChange,
  onSidebarShownChange,
  footer = "Sample data",
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  width = 1148,
  height = 803,
  className,
  onKeyDownCapture,
  ...windowProps
}: StocksProps) {
  const [ownSelection, setSelection] = useState<WatchlistSelection | null>(null);
  const selection = ownSelection ?? only(keptView?.symbol);
  const symbol = selection.shown;
  const [editing, setEditing] = useState(false);
  const [sidebar, setSidebar] = useState<HTMLElement | null>(null);
  const [query, setQueryState] = useState("");
  const [reading, setReading] = useState<StockStory | null>(null);
  const [ownBadgeMode, setBadgeModeState] = useState<BadgeMode | null>(null);
  const badgeMode = ownBadgeMode ?? keptView?.badgeMode ?? "change";
  const [ownRange, setRangeState] = useState<StockRange | null>(null);
  const range = ownRange ?? keptView?.range ?? "1D";
  const [ownSidebarShown, setSidebarShownState] = useState<boolean | null>(null);
  const sidebarShown = ownSidebarShown ?? !keptView?.sidebarHidden;
  const setBadgeMode = (next: BadgeMode) => {
    setBadgeModeState(next);
    onBadgeModeChange?.(next);
  };
  const setSidebarShown = (next: boolean) => {
    setSidebarShownState(next);
    onSidebarShownChange?.(next);
  };
  const select = (next: WatchlistSelection) => {
    setReading(null);
    setSelection(next);
    if (next.shown !== symbol) onSymbolChange?.(next.shown);
  };
  const setSymbol = (next: string | undefined) => {
    setReading(null);
    setSelection(only(next));
    onSymbolChange?.(next);
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new request shows a symbol.
  useEffect(() => {
    if (askedSymbol) setSymbol(askedSymbol.symbol);
  }, [askedSymbol]);
  const setQuery = (next: string) => {
    setQueryState(next);
    onQueryChange?.(next);
  };
  const setRange = (next: StockRange) => {
    setRangeState(next);
    onRangeChange?.(next);
  };

  // A symbol that the market no longer lists shows the news again.
  const stock = market.quotes.find((candidate) => candidate.symbol === symbol);
  // Back leaves a story first, then a symbol.
  const goBack = () => {
    if (reading) setReading(null);
    else setSymbol(undefined);
  };
  const listed = market.quotes.filter((candidate) => matchesQuery(candidate, query));
  const order = listed.map((candidate) => candidate.symbol);
  const selected = order.filter((each) => selection.symbols.includes(each));
  // What Edit > Paste could not do, for as long as it takes to read.
  const [editNote, setEditNote] = useState<string>();
  useEffect(() => {
    if (!editNote) return;
    const timer = setTimeout(() => setEditNote(undefined), EDIT_NOTE_MS);
    return () => clearTimeout(timer);
  }, [editNote]);
  const found =
    query.trim() !== "" && onAddSymbol
      ? (searchResults ?? []).filter(
          (result) => !market.quotes.some((quote) => quote.symbol === result.symbol),
        )
      : [];

  // Reordering: only with `onMoveSymbol`, and only while every symbol is listed (no search).
  const reorderable = onMoveSymbol !== undefined && query.trim() === "";
  const placeOf = (wanted: string) => market.quotes.findIndex((quote) => quote.symbol === wanted);
  const shownAt = stock ? placeOf(stock.symbol) : -1;
  // The symbol whose row is being dragged.
  const [dragged, setDragged] = useState<string | null>(null);
  const move = (wanted: string, to: number) => {
    if (!onMoveSymbol || !reorderable || to < 0 || to >= market.quotes.length) return;
    if (placeOf(wanted) === to) return;
    onMoveSymbol(wanted, to);
  };
  /** A row's own props for reordering: dragging it onto another, and Option-Up/Down Arrow. */
  const reorderProps = (candidate: string) =>
    reorderable
      ? {
          draggable: true,
          "data-dragging": dragged === candidate ? "" : undefined,
          onDragStart: (event: DragEvent<HTMLDivElement>) => {
            // Copy too: a text field or a note takes the symbol as text; the list moves the row.
            event.dataTransfer.effectAllowed = "copyMove";
            event.dataTransfer.setData(DRAG_TYPE, candidate);
            event.dataTransfer.setData("text/plain", candidate);
            setDragged(candidate);
          },
          onDragEnd: () => setDragged(null),
          onDragOver: (event: DragEvent<HTMLDivElement>) => {
            if (dragged === null || dragged === candidate) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          },
          onDrop: (event: DragEvent<HTMLDivElement>) => {
            const from = event.dataTransfer.getData(DRAG_TYPE) || dragged;
            setDragged(null);
            if (!from || from === candidate) return;
            event.preventDefault();
            move(from, placeOf(candidate));
          },
          onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
            if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
            // The list's own arrow keys move the focus; with Option they move the symbol.
            event.preventDefault();
            move(candidate, placeOf(candidate) + (event.key === "ArrowUp" ? -1 : 1));
          },
        }
      : {};

  const windowOf = () => sidebar?.closest<HTMLElement>(".mac-stocks");
  const editable = onRemoveSymbol !== undefined || onMoveSymbol !== undefined;
  /** The keyboard goes to the row of `shown`, or to the window when there is none. */
  const keepKeyboard = (shown: string | undefined) =>
    takeKeyboard(
      () =>
        Array.from(sidebar?.querySelectorAll<HTMLElement>(".mac-stock-row") ?? [])
          .find((row) => row.dataset.symbol === shown)
          ?.querySelector<HTMLElement>("button.mac-stock-row-main") ?? windowOf(),
    );
  const remove = (symbols: readonly string[]) => {
    if (!onRemoveSymbol) return;
    for (const each of symbols) onRemoveSymbol(each);
    const next = afterRemoving(selection, symbols, order);
    select(next);
    if (next.shown !== symbol) keepKeyboard(next.shown);
  };
  const addAlertFor = (wanted: string) => {
    if (wanted !== symbol) setSymbol(wanted);
    takeKeyboard(() =>
      windowOf()?.querySelector<HTMLElement>('.mac-stocks-pane input[aria-label="Alert price"]'),
    );
  };
  const menuKey = useStocksMenus({
    within: sidebar,
    canGoBack: stock !== undefined || reading !== null,
    goBack,
    refresh: onRefresh,
    range,
    canSetRange: stock !== undefined,
    setRange,
    // A hidden list's rows are not removed or selected by a key the person cannot see act.
    selected: sidebarShown ? selected.length : 0,
    removeSelected: onRemoveSymbol ? () => remove(selected) : undefined,
    listed: sidebarShown ? order.length : 0,
    selectAll: () => select(allOf(selection, order)),
    find: () => {
      setSidebarShown(true);
      takeKeyboard(() => sidebar?.querySelector<HTMLElement>('input[aria-label="Search"]'));
    },
    sidebarShown,
    toggleSidebar: () => {
      setSidebarShown(!sidebarShown);
      if (sidebarShown) takeKeyboard(windowOf);
    },
    editable,
    editing,
    toggleEditing: () => setEditing(!editing),
    say: setEditNote,
  });

  /** Menu keys anywhere in the window, then the arrows where the list's keys belong. */
  const onWindowKey = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDownCapture?.(event);
    const target = event.target as Element;
    // A menu in a portal is inside the window for React, not for its keys.
    if (event.defaultPrevented || !event.currentTarget.contains(target)) return;
    const typing = target.closest("input, textarea, [contenteditable]") !== null;
    if (menuKey(event.nativeEvent, typing)) {
      event.preventDefault();
      return;
    }
    const by = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (by === 0 || typing || !sidebarShown || event.altKey || event.metaKey || event.ctrlKey) {
      return;
    }
    const inList = target === event.currentTarget || target.closest(".mac-stocks-sidebar");
    if (!inList || order.length === 0) return;
    event.preventDefault();
    const from = target.closest<HTMLElement>(".mac-stock-row")?.dataset.symbol ?? symbol;
    const next = stepped(selection, order, by, from, event.shiftKey);
    select(next);
    keepKeyboard(next.shown);
  };

  const rowMenuItems = (candidate: StockQuote) => {
    // A row that is part of a selection of several stands for the selection.
    const targets =
      selected.length > 1 && selected.includes(candidate.symbol) ? selected : [candidate.symbol];
    const several = targets.length > 1;
    const reason = several ? ONE_SYMBOL : undefined;
    return (
      <>
        {onAddAlert ? (
          <MenuItem disabled={several} title={reason} onClick={() => addAlertFor(candidate.symbol)}>
            Add Price Alert…
          </MenuItem>
        ) : null}
        <Submenu>
          <SubmenuTrigger disabled={several} title={reason}>
            Share
          </SubmenuTrigger>
          <SubmenuPopup>
            <ShareRows stock={candidate} shareLinkFor={shareLinkFor} />
          </SubmenuPopup>
        </Submenu>
        {onRemoveSymbol ? (
          <>
            <MenuSeparator />
            <MenuItem onClick={() => remove(targets)}>
              {several ? `Remove ${targets.length} Symbols` : "Remove from Watchlist"}
            </MenuItem>
          </>
        ) : null}
      </>
    );
  };

  return (
    <Window
      tabIndex={-1}
      {...windowProps}
      width={width}
      height={height}
      className={className ? `mac-stocks ${className}` : "mac-stocks"}
      onKeyDownCapture={onWindowKey}
    >
      <CatalystChrome
        title="Stocks"
        style={sidebarShown ? undefined : NO_COLUMN}
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
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
        toolbar={
          <Toolbar aria-label="Stocks toolbar">
            <ToolbarButton
              aria-label="Back"
              disabled={!stock && !reading}
              style={TOOLBAR_BUTTON}
              onClick={goBack}
            >
              <SystemImage name="go-back" />
            </ToolbarButton>
            <ToolbarSpace />
            <Menu>
              <MenuTrigger
                disabled={!stock}
                render={
                  <ToolbarButton aria-label="Share" style={TOOLBAR_BUTTON}>
                    <SystemImage name="share" />
                  </ToolbarButton>
                }
              />
              <MenuPopup align="end" sideOffset={4}>
                {stock ? <ShareRows stock={stock} shareLinkFor={shareLinkFor} /> : null}
                {onMoveSymbol ? (
                  <>
                    <MenuItem
                      disabled={!reorderable || shownAt <= 0}
                      onClick={() => stock && move(stock.symbol, shownAt - 1)}
                    >
                      Move Up
                    </MenuItem>
                    <MenuItem
                      disabled={!reorderable || shownAt < 0 || shownAt >= market.quotes.length - 1}
                      onClick={() => stock && move(stock.symbol, shownAt + 1)}
                    >
                      Move Down
                    </MenuItem>
                  </>
                ) : null}
                {onRemoveSymbol ? (
                  <MenuItem
                    onClick={() => {
                      if (!stock) return;
                      onRemoveSymbol(stock.symbol);
                      setSymbol(undefined);
                    }}
                  >
                    Remove from Watchlist
                  </MenuItem>
                ) : null}
              </MenuPopup>
            </Menu>
          </Toolbar>
        }
        sidebar={
          // The Stocks divider: the column's last half point is shaded and nothing follows it.
          <CatalystSidebar
            aria-label="Watchlist"
            width={330}
            divider="shade"
            className="mac-stocks-column"
            data-hidden={sidebarShown ? undefined : ""}
          >
            <div className="mac-stocks-sidebar" ref={setSidebar}>
              <div className="mac-stocks-search" style={SEARCH}>
                <SearchField
                  variant="sidebar"
                  aria-label="Search"
                  value={query}
                  onValueChange={(value) => setQuery(value)}
                  style={SEARCH_FIELD}
                />
              </div>
              <button
                type="button"
                className="mac-stocks-news-cell"
                aria-current={stock ? undefined : "page"}
                onClick={() => setSymbol(undefined)}
              >
                <span className="mac-stocks-news-cell-title">Business News</span>
                <span className="mac-stocks-news-cell-source">
                  From <NewsGlyph />
                  News
                </span>
              </button>
              {listed.length > 0 ? (
                <StockList aria-label="Symbols">
                  {listed.map((candidate) => (
                    <ContextualMenu key={candidate.symbol}>
                      <ContextualMenuTrigger
                        className="mac-stocks-row"
                        data-editing={editing ? "" : undefined}
                      >
                        {editing && onRemoveSymbol ? (
                          <button
                            type="button"
                            className="mac-stocks-row-remove"
                            aria-label={`Remove ${candidate.symbol}`}
                            onClick={() => remove([candidate.symbol])}
                          />
                        ) : null}
                        <StockRow
                          className="mac-stocks-row-info"
                          symbol={candidate.symbol}
                          name={candidate.name}
                          price={candidate.unavailable ? "—" : formatPrice(candidate.price)}
                          change={candidate.unavailable ? "—" : badgeText(candidate, badgeMode)}
                          direction={candidate.unavailable ? "none" : directionOf(candidate)}
                          data={editing ? undefined : candidate.session}
                          previousClose={
                            candidate.unavailable ? undefined : candidate.price - candidate.change
                          }
                          progress={market.progress}
                          selected={candidate.symbol === stock?.symbol}
                          data-selected={selected.includes(candidate.symbol) ? "" : undefined}
                          data-symbol={candidate.symbol}
                          onSelect={(event) =>
                            select(
                              clicked(selection, candidate.symbol, order, {
                                shift: event.shiftKey,
                                command: event.metaKey || event.ctrlKey,
                              }),
                            )
                          }
                          onBadgeClick={() => setBadgeMode(nextBadgeMode(badgeMode))}
                          {...reorderProps(candidate.symbol)}
                          badgeLabel={
                            candidate.unavailable
                              ? "No quote available"
                              : badgeLabel(candidate, badgeMode)
                          }
                        />
                        {editing && reorderable ? (
                          <div
                            className="mac-stocks-row-grip"
                            aria-hidden="true"
                            {...reorderProps(candidate.symbol)}
                          />
                        ) : null}
                      </ContextualMenuTrigger>
                      <ContextualMenuPopup aria-label={candidate.symbol}>
                        {rowMenuItems(candidate)}
                      </ContextualMenuPopup>
                    </ContextualMenu>
                  ))}
                </StockList>
              ) : found.length === 0 ? (
                <EmptyState className="mac-stocks-no-results">No Results</EmptyState>
              ) : null}
              {found.length > 0 ? (
                <section className="mac-stocks-results" aria-label="Symbols to add">
                  <h3 className="mac-stocks-results-title">Add to Watchlist</h3>
                  <ul className="mac-stocks-result-list">
                    {found.map((result) => (
                      <li key={result.symbol} className="mac-stocks-result">
                        <span className="mac-stocks-result-text">
                          <span className="mac-stocks-result-symbol">{result.symbol}</span>
                          <span className="mac-stocks-result-name">
                            {result.name}
                            {result.exchange ? ` · ${result.exchange}` : ""}
                          </span>
                        </span>
                        <PushButton
                          size="small"
                          aria-label={`Add ${result.symbol}`}
                          onClick={() => {
                            onAddSymbol?.(result.symbol);
                            setQuery("");
                            setSymbol(result.symbol);
                          }}
                        >
                          Add
                        </PushButton>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              <div className="mac-stocks-footer">
                {editNote ? (
                  <span role="status">{editNote}</span>
                ) : selected.length > 1 ? (
                  <span role="status">{selected.length} Symbols Selected</span>
                ) : (
                  footer
                )}
                {editable ? (
                  <PushButton
                    size="mini"
                    className="mac-stocks-footer-edit"
                    onClick={() => setEditing(!editing)}
                  >
                    {editing ? "Done" : "Edit"}
                  </PushButton>
                ) : null}
              </div>
            </div>
          </CatalystSidebar>
        }
      >
        {/* A view of its own for each symbol, so that each starts at its top. */}
        <div key={reading?.id ?? stock?.symbol ?? ""} className="mac-stocks-pane">
          {reading ? (
            <StoryReaderPane story={reading} />
          ) : stock ? (
            <Detail
              stock={stock}
              market={market}
              range={range}
              onRangeChange={setRange}
              shown={history?.(stock, range)}
              alerts={{ alerts, onAdd: onAddAlert, onRemove: onRemoveAlert }}
              onRead={setReading}
            />
          ) : (
            <News market={market} onRead={setReading} />
          )}
        </div>
      </CatalystChrome>
    </Window>
  );
}

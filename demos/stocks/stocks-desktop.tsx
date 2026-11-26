import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOpenItemRequests } from "../desktop/desktop-open-item";
import { changeDesktopValue, useDesktopValue } from "../desktop/desktop-personal";
import { servedByDesktopApp, sessionFetch, withDeadline } from "../desktop/desktop-server";
import { Stocks, type StocksKeptView, type StocksProps } from "./stocks";
import {
  type BadgeMode,
  formatPrice,
  RANGES,
  type StockAlert,
  type StockHistory,
  type StockQuote,
  type StockRange,
  type StockSearchResult,
  type StockStory,
  type StocksMarket,
} from "./stocks-data";

/** The routes of the desktop's Stocks module (`ferrite-apps/desktop/src/apps/stocks`). */
export const STOCKS_URLS = {
  quotes: "/api/stocks/quotes",
  chart: "/api/stocks/chart",
  search: "/api/stocks/search",
  news: "/api/stocks/news",
  watchlist: "/api/stocks/watchlist",
  alerts: "/api/stocks/alerts",
} as const;

/** The watchlist a person starts with, until they change it: the three US indexes and Apple. */
export const DEFAULT_WATCHLIST: readonly string[] = [".DJI", ".SPX", ".IXIC", "AAPL"];
/** How often the quotes, and the alerts, are asked for again while the window is open. */
export const REFRESH_MS = 60_000;
/** How long typing rests before the symbol search is asked. */
export const SEARCH_PAUSE_MS = 300;

/** A symbol's page at the quotes' provider, CNBC: what the Share menu shares for it. */
export function quotePage(symbol: string): string {
  return `https://www.cnbc.com/quotes/${encodeURIComponent(symbol)}`;
}

/** `symbols` with `symbol` moved to place `to` (held within the list); the same list, copied,
 * when it does not hold the symbol. */
export function moveSymbol(symbols: readonly string[], symbol: string, to: number): string[] {
  if (!symbols.includes(symbol)) return [...symbols];
  const rest = symbols.filter((other) => other !== symbol);
  rest.splice(Math.max(0, Math.min(to, rest.length)), 0, symbol);
  return rest;
}

/** A quote as the module answers it. */
export interface ServedQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  year_high?: number | null;
  year_low?: number | null;
  volume?: string | null;
  market_cap?: string | null;
  pe?: string | null;
  time?: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isText = (value: unknown): value is string => typeof value === "string" && value !== "";

/** The quotes of a quotes answer; empty when it is not one. */
export function quotesFromServer(reply: unknown): ServedQuote[] {
  if (!isRecord(reply) || !Array.isArray(reply.quotes)) return [];
  return reply.quotes.filter(
    (quote): quote is ServedQuote =>
      isRecord(quote) &&
      isText(quote.symbol) &&
      isText(quote.name) &&
      isNumber(quote.price) &&
      isNumber(quote.change),
  );
}

/** The points of a chart answer, oldest first: `[epoch ms, price]`. */
export function pointsFromServer(reply: unknown): [number, number][] {
  if (!isRecord(reply) || !Array.isArray(reply.points)) return [];
  return reply.points.filter(
    (point): point is [number, number] =>
      Array.isArray(point) && point.length === 2 && isNumber(point[0]) && isNumber(point[1]),
  );
}

/** The symbols of a search answer. */
export function resultsFromServer(reply: unknown): StockSearchResult[] {
  if (!isRecord(reply) || !Array.isArray(reply.results)) return [];
  return reply.results
    .filter((result) => isRecord(result) && isText(result.symbol) && isText(result.name))
    .map((result) => {
      const found = result as { symbol: string; name: string; exchange?: unknown };
      return {
        symbol: found.symbol,
        name: found.name,
        ...(isText(found.exchange) ? { exchange: found.exchange } : {}),
      };
    });
}

const AGE_DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

/** How old a story is, as the feed writes it: "now", "25m ago", "3h ago", "Oct 12". */
export function ageOf(published: number, now: number): string {
  if (published <= 0) return "";
  const minutes = Math.floor((now - published) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h ago`;
  return AGE_DATE.format(published);
}

/** The stories of a news answer, in the feed's order. */
export function storiesFromServer(reply: unknown, now: number): StockStory[] {
  if (!isRecord(reply) || !Array.isArray(reply.stories)) return [];
  return reply.stories
    .filter(
      (story) =>
        isRecord(story) &&
        isText(story.id) &&
        isText(story.headline) &&
        isText(story.url) &&
        story.url.startsWith("https://"),
    )
    .map((story) => {
      const item = story as Record<string, unknown>;
      return {
        id: item.id as string,
        headline: item.headline as string,
        url: item.url as string,
        publisher: isText(item.publisher) ? item.publisher : "News",
        ...(isText(item.summary) ? { summary: item.summary } : {}),
        age: ageOf(isNumber(item.published_ms) ? item.published_ms : 0, now),
      };
    });
}

/** An alert as the module keeps it. */
interface ServedAlert {
  id: string;
  symbol: string;
  above?: number | null;
  below?: number | null;
  created: number;
  fired?: { at: number; price: number; notified?: false } | null;
}

const isServedAlert = (value: unknown): value is ServedAlert =>
  isRecord(value) &&
  isText(value.id) &&
  isText(value.symbol) &&
  isNumber(value.created) &&
  (isNumber(value.above) || isNumber(value.below));

/** The window's alerts from an alerts answer. */
export function alertsFromServer(reply: unknown): StockAlert[] {
  if (!isRecord(reply) || !Array.isArray(reply.alerts)) return [];
  return reply.alerts.filter(isServedAlert).map((alert) => ({
    id: alert.id,
    symbol: alert.symbol,
    ...(isNumber(alert.above) ? { above: alert.above } : {}),
    ...(isNumber(alert.below) ? { below: alert.below } : {}),
    ...(isRecord(alert.fired) && isNumber(alert.fired.at) && isNumber(alert.fired.price)
      ? {
          fired: {
            at: alert.fired.at,
            price: alert.fired.price,
            // Still for the server to tell the person of: a save of the list does not end that.
            ...(alert.fired.notified === false ? { notified: false as const } : {}),
          },
        }
      : {}),
  }));
}

/** A figure of a quote: the provider's 0 is a value it does not have yet, as no stock trades at 0. */
const price = (value: number | null | undefined) =>
  isNumber(value) && value !== 0 ? formatPrice(value) : "—";

/** What a listed symbol says while its first quote is asked for. */
export const LOADING_QUOTE = "Loading quote…";

/**
 * A watchlist symbol without a quote: listed with dashes, so it can be opened and removed. It says
 * `LOADING_QUOTE` while the first quotes are on their way (`loading`), and that the provider gave
 * none once they came, or failed to come.
 */
export function unavailableQuote(symbol: string, loading = false): StockQuote {
  return {
    symbol,
    name: loading ? LOADING_QUOTE : "No quote available",
    price: 0,
    change: 0,
    unavailable: true,
    session: [],
    figures: ["Open", "High", "Low", "Vol", "P/E", "Mkt Cap", "52W H", "52W L"].map(
      (label) => [label, "—"] as const,
    ),
  };
}

/** A served quote as the window shows it, with its session's prices for the sparkline. */
export function quoteForWindow(quote: ServedQuote, session: readonly number[]): StockQuote {
  return {
    symbol: quote.symbol,
    name: quote.name,
    price: quote.price,
    change: quote.change,
    ...(isText(quote.market_cap) ? { marketCap: quote.market_cap } : {}),
    session,
    figures: [
      ["Open", price(quote.open)],
      ["High", price(quote.high)],
      ["Low", price(quote.low)],
      ["Vol", isText(quote.volume) ? quote.volume : "—"],
      ["P/E", isText(quote.pe) ? quote.pe : "—"],
      ["Mkt Cap", isText(quote.market_cap) ? quote.market_cap : "—"],
      ["52W H", price(quote.year_high)],
      ["52W L", price(quote.year_low)],
    ],
  };
}

/** How the labels under a range's chart are written; the day's in New York's market time. */
const LABEL_FORMATS: Record<StockRange, Intl.DateTimeFormatOptions> = {
  "1D": { hour: "numeric", timeZone: "America/New_York" },
  "1W": { weekday: "short", timeZone: "America/New_York" },
  "1M": { month: "short", day: "numeric" },
  "3M": { month: "short" },
  "6M": { month: "short" },
  "1Y": { month: "short" },
  "2Y": { month: "short", year: "2-digit" },
};

/** The chart of a range from its points: the prices, and four labels spread along its times. */
export function historyOf(points: readonly [number, number][], range: StockRange): StockHistory {
  const format = new Intl.DateTimeFormat("en-US", LABEL_FORMATS[range]);
  const labels: string[] = [];
  if (points.length > 1) {
    for (let index = 0; index < 4; index++) {
      const at = points[Math.round(((points.length - 1) * (index + 0.5)) / 4)]?.[0];
      const label = at === undefined ? undefined : format.format(at);
      if (label && !labels.includes(label)) labels.push(label);
    }
  }
  return { prices: points.map(([, value]) => value), labels };
}

async function call(
  url: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown }> {
  return withDeadline(async (signal) => {
    const response = await sessionFetch(url, {
      credentials: "same-origin",
      ...init,
      headers: { accept: "application/json", ...(init.headers ?? {}) },
      signal,
    });
    const body = await response.json().catch(() => null);
    return { status: response.status, body };
  });
}

async function getJson(url: string): Promise<unknown> {
  const { status, body } = await call(url);
  if (status !== 200) {
    const why = isRecord(body) && isText(body.error) ? body.error : `HTTP ${status}`;
    throw new Error(why);
  }
  return body;
}

/** Each document's edits in progress: a new edit starts after the one before it has ended. */
const editQueues = new Map<string, Promise<unknown>>();

/**
 * Changes one list of one of the person's documents on the server: reads it, applies `change`,
 * and saves it on the revision it read, again on a newer one when another window or the server
 * (an alert that fired) changed it first. Answers the saved document. Edits of one document from
 * this page run one at a time, in the order they were asked for, so an add and a remove made in
 * quick succession are stored in that order.
 */
export function editList<T>(
  url: string,
  field: string,
  change: (current: T[] | null) => T[],
): Promise<unknown> {
  const before = editQueues.get(url) ?? Promise.resolve();
  const edit = before.catch(() => {}).then(() => editNow(url, field, change));
  editQueues.set(url, edit);
  const forget = () => {
    if (editQueues.get(url) === edit) editQueues.delete(url);
  };
  edit.then(forget, forget);
  return edit;
}

async function editNow<T>(
  url: string,
  field: string,
  change: (current: T[] | null) => T[],
): Promise<unknown> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const read = await getJson(url);
    if (!isRecord(read) || typeof read.rev !== "number") throw new Error("unreadable document");
    // The module answers `null` for a document never saved; any other value that is not a list
    // is a document this window cannot read, and an edit is refused rather than saved over it.
    const stored = read[field];
    if (stored !== null && !Array.isArray(stored))
      throw new Error(`the stored ${field} could not be read, so it was left as it is`);
    const current = stored === null ? null : (stored as T[]);
    const { status, body } = await call(url, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [field]: change(current), rev: read.rev, session: read.session }),
    });
    if (status === 200) return body;
    if (status !== 409) throw new Error(`HTTP ${status}`);
  }
  throw new Error("the document kept changing");
}

const alertId = () => `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Runs `task` at once and every `ms` while the window is open; again from the start when `key` changes. */
function useEvery(ms: number, key: string, task: () => void) {
  const latest = useRef(task);
  latest.current = task;
  useEffect(() => {
    if (key === NEVER) return;
    latest.current();
    const timer = setInterval(() => latest.current(), ms);
    return () => clearInterval(timer);
  }, [ms, key]);
}

/** A key no caller passes: `useEvery` then does nothing. */
const NEVER = "\u0000";

/** The person's last symbol, range, badge and sidebar, in the desktop's settings. */
const STOCKS_VIEW = "stocks.view";
const NO_VIEW: StocksKeptView = {};
const BADGE_MODES: readonly BadgeMode[] = ["change", "percent", "cap"];

/** A kept view, with whatever of it reads: a symbol as the provider writes one, say. */
export function readStocksView(stored: unknown): StocksKeptView | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { symbol, range, badgeMode, sidebarHidden } = stored as Record<string, unknown>;
  return {
    symbol: typeof symbol === "string" && /^[\w.^=-]{1,20}$/.test(symbol) ? symbol : undefined,
    range: RANGES.find((each) => each === range),
    badgeMode: BADGE_MODES.find((each) => each === badgeMode),
    sidebarHidden: sidebarHidden === true,
  };
}

function ServedStocks(props: StocksProps) {
  const keptView = useDesktopValue(STOCKS_VIEW, readStocksView, NO_VIEW);
  const keep = (change: StocksKeptView) =>
    changeDesktopValue(STOCKS_VIEW, { ...keptView, ...change });
  const [watchlist, setWatchlist] = useState<readonly string[] | null>(null);
  const [quotes, setQuotes] = useState<readonly ServedQuote[]>([]);
  const [sessions, setSessions] = useState<Readonly<Record<string, number[]>>>({});
  const [charts, setCharts] = useState<Readonly<Record<string, [number, number][] | "failed">>>({});
  const [stories, setStories] = useState<readonly StockStory[]>([]);
  const [alerts, setAlerts] = useState<readonly StockAlert[]>([]);
  // What this window has chosen; until then, what the person last chose.
  const [chosen, setChosen] = useState<{ symbol: string | undefined } | null>(null);
  const selected = chosen ? chosen.symbol : keptView.symbol;
  const [askedAlert, setAskedAlert] = useState<string | null>(null);
  const [askedSymbol, setAskedSymbol] = useState<{ symbol: string }>();
  useOpenItemRequests("stocks", ({ id }) => {
    // A fired alert's notification says `alert-<id>` (stocks/mod.rs); Today asks with a symbol.
    if (id.startsWith("alert-")) {
      setAskedAlert(id.slice("alert-".length));
      return;
    }
    if (/^[A-Z0-9.^=-]{1,16}$/.test(id)) setAskedSymbol({ symbol: id });
  });
  useEffect(() => {
    const symbol = alerts.find((alert) => alert.id === askedAlert)?.symbol;
    if (symbol === undefined) return;
    setAskedAlert(null);
    setAskedSymbol({ symbol });
  }, [askedAlert, alerts]);
  const [ownRange, setOwnRange] = useState<StockRange | null>(null);
  const range = ownRange ?? keptView.range ?? "1D";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly StockSearchResult[] | null>(null);
  const [status, setStatus] = useState<{ at?: number; error?: string }>({});
  // Why the last watchlist or alert edit was not saved, kept apart from the quotes' status so a
  // later quote refresh cannot hide it, until an edit of that document saves.
  const [saveError, setSaveError] = useState<{ watchlist?: string; alerts?: string }>({});
  // Whether the person changed the watchlist before its first read answered: that read is then
  // older than what they see, and does not replace it.
  const watchlistEdited = useRef(false);
  // Whether a quotes read has answered yet: until then a symbol with no quote is still loading,
  // not missing.
  const [quotesRead, setQuotesRead] = useState(false);
  // Counts the minute polls, so the open detail chart is asked for again with the quotes.
  const [poll, setPoll] = useState(0);
  // Counts View > Refresh: a new count asks for the quotes, the alerts and the news at once.
  const [refreshes, setRefreshes] = useState(0);
  // The newest quotes request: a slower reply to an older one (an earlier watchlist) is dropped.
  const quoteAsk = useRef(0);
  // The poll whose sparkline each symbol shows.
  const sessionAsk = useRef(new Map<string, number>());
  // The number of the newest watchlist edit: a save's reply, or the stored list read back after
  // a failed save, is shown only if no edit started after it, so it can never put back what a
  // later edit changed (a count of edits still pending can fall back to one while an old read
  // is still on its way; this number never goes back).
  const watchlistEdit = useRef(0);
  // The newest alerts read or edit: a poll's reply is shown only if no edit began or ended after
  // the poll was sent, so it cannot put back the list an edit just replaced.
  const alertsAsk = useRef(0);
  // The newest news request: a slower reply to an older one, overtaken by Refresh, is dropped.
  const newsAsk = useRef(0);

  // The person's watchlist; the starting one until they change it.
  useEffect(() => {
    let live = true;
    getJson(STOCKS_URLS.watchlist)
      .then((reply) => {
        const symbols = isRecord(reply) && Array.isArray(reply.symbols) ? reply.symbols : null;
        if (live && !watchlistEdited.current)
          setWatchlist(symbols?.filter(isText) ?? DEFAULT_WATCHLIST);
      })
      .catch(() => {
        if (live && !watchlistEdited.current) setWatchlist(DEFAULT_WATCHLIST);
      });
    return () => {
      live = false;
    };
  }, []);

  // Quotes for the watchlist (and a symbol just added), every minute.
  const symbols = watchlist ?? [];
  // Nothing to ask for until the watchlist has loaded.
  const listKey = symbols.length > 0 ? symbols.join(",") : NEVER;
  useEvery(REFRESH_MS, listKey === NEVER ? NEVER : `${listKey}|${refreshes}`, () => {
    const ask = ++quoteAsk.current;
    setPoll((count) => count + 1);
    getJson(`${STOCKS_URLS.quotes}?symbols=${encodeURIComponent(listKey)}`)
      .then((reply) => {
        if (ask !== quoteAsk.current) return;
        setQuotes(quotesFromServer(reply));
        setQuotesRead(true);
        setStatus({ at: Date.now() });
      })
      .catch((error: Error) => {
        if (ask === quoteAsk.current)
          setStatus((current) => ({ ...current, error: error.message }));
      });
    // The sparklines: each symbol's day. A reply to an older poll that comes after a newer one's
    // is dropped, so a symbol's line never goes back to older prices.
    for (const symbol of listKey.split(",")) {
      getJson(`${STOCKS_URLS.chart}?symbol=${encodeURIComponent(symbol)}&range=1D`)
        .then((reply) => {
          if ((sessionAsk.current.get(symbol) ?? 0) > ask) return;
          sessionAsk.current.set(symbol, ask);
          const prices = pointsFromServer(reply).map(([, value]) => value);
          setSessions((current) => ({ ...current, [symbol]: prices }));
        })
        .catch(() => {});
    }
  });

  // The alerts, every minute: asking checks those that have not fired.
  useEvery(REFRESH_MS, `alerts|${refreshes}`, () => {
    const ask = ++alertsAsk.current;
    getJson(STOCKS_URLS.alerts)
      .then((reply) => {
        if (ask === alertsAsk.current) setAlerts(alertsFromServer(reply));
      })
      .catch(() => {});
  });

  // The business news, every ten minutes.
  useEvery(10 * REFRESH_MS, `news|${refreshes}`, () => {
    const ask = ++newsAsk.current;
    getJson(STOCKS_URLS.news)
      .then((reply) => {
        if (ask === newsAsk.current) setStories(storiesFromServer(reply, Date.now()));
      })
      .catch(() => {});
  });

  // The chart of the symbol shown, for the range chosen, asked for again on every poll so it
  // moves with the quote; the chart shown stays until the new one arrives.
  useEffect(() => {
    if (!selected || poll < 0) return;
    let live = true;
    const key = `${selected}/${range}`;
    getJson(
      `${STOCKS_URLS.chart}?symbol=${encodeURIComponent(selected)}&range=${encodeURIComponent(range)}`,
    )
      .then((reply) => {
        if (live) setCharts((current) => ({ ...current, [key]: pointsFromServer(reply) }));
      })
      .catch(() => {
        // A refresh that fails keeps the chart already shown.
        if (live)
          setCharts((current) =>
            Array.isArray(current[key]) ? current : { ...current, [key]: "failed" },
          );
      });
    return () => {
      live = false;
    };
  }, [selected, range, poll]);

  // Symbols for the search field's text, once typing rests.
  useEffect(() => {
    const wanted = query.trim();
    if (!wanted) {
      setResults(null);
      return;
    }
    let live = true;
    // The symbols found for an earlier text are not offered for this one.
    setResults(null);
    const timer = setTimeout(() => {
      getJson(`${STOCKS_URLS.search}?q=${encodeURIComponent(wanted)}`)
        .then((reply) => {
          if (live) setResults(resultsFromServer(reply));
        })
        .catch(() => {
          if (live) setResults([]);
        });
    }, SEARCH_PAUSE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);

  const saveWatchlist = useCallback((change: (current: string[]) => string[]) => {
    watchlistEdited.current = true;
    setWatchlist((current) => change([...(current ?? DEFAULT_WATCHLIST)]));
    const edit = ++watchlistEdit.current;
    const newest = () => edit === watchlistEdit.current;
    editList<string>(STOCKS_URLS.watchlist, "symbols", (stored) =>
      change([...(stored ?? DEFAULT_WATCHLIST)]),
    )
      .then((reply) => {
        setSaveError(({ watchlist: _done, ...rest }) => rest);
        if (!newest()) return;
        if (isRecord(reply) && Array.isArray(reply.symbols))
          setWatchlist(reply.symbols.filter(isText));
      })
      .catch(async (error: Error) => {
        setSaveError((current) => ({
          ...current,
          watchlist: `The watchlist was not saved: ${error.message}`,
        }));
        // The change shown was not stored: show what is stored instead, unless a later edit has
        // started (it reconciles when it ends), before or while the stored list is read.
        if (!newest()) return;
        try {
          const stored = await getJson(STOCKS_URLS.watchlist);
          const symbols = isRecord(stored) && Array.isArray(stored.symbols) ? stored.symbols : null;
          if (newest()) setWatchlist(symbols?.filter(isText) ?? DEFAULT_WATCHLIST);
        } catch {
          // Not readable either: the error says the change was not saved.
        }
      });
  }, []);

  const saveAlerts = useCallback((change: (current: ServedAlert[]) => ServedAlert[]) => {
    // Polls already sent are now older than this edit.
    alertsAsk.current += 1;
    editList<ServedAlert>(STOCKS_URLS.alerts, "alerts", (stored) => change(stored ?? []))
      .then((reply) => {
        alertsAsk.current += 1;
        setSaveError(({ alerts: _done, ...rest }) => rest);
        setAlerts(alertsFromServer(reply));
      })
      .catch((error: Error) =>
        setSaveError((current) => ({
          ...current,
          alerts: `The alert was not saved: ${error.message}`,
        })),
      );
  }, []);

  const quotesFailed = status.error !== undefined;
  const market: StocksMarket = useMemo(() => {
    const listed = symbols.map((symbol): StockQuote => {
      const quote = quotes.find((item) => item.symbol.toUpperCase() === symbol.toUpperCase());
      if (quote) return quoteForWindow(quote, sessions[quote.symbol] ?? []);
      // Every symbol of the watchlist is listed, from the moment the watchlist is read, so it can
      // be opened and removed whether its quote is on its way, failed to come, or does not exist.
      return unavailableQuote(symbol, !quotesRead && !quotesFailed);
    });
    return { quotes: listed, progress: 1, stories, leadLayout: "lead", cards: 2 };
  }, [symbols, quotes, sessions, stories, quotesRead, quotesFailed]);

  // The chart of a range: the real prices once they are here, otherwise an empty chart that says
  // why. Never the demo's generated history beside real quotes.
  const history = useCallback(
    (stock: StockQuote, wanted: StockRange): StockHistory => {
      const points = charts[`${stock.symbol}/${wanted}`];
      if (points === undefined) return { prices: [], labels: [], status: "Loading Chart…" };
      if (points === "failed")
        return { prices: [], labels: [], status: "The chart could not be loaded." };
      if (points.length < 2) return { prices: [], labels: [], status: "No Chart Data" };
      return historyOf(points, wanted);
    },
    [charts],
  );

  const time = status.at
    ? new Date(status.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null;
  const footer =
    saveError.watchlist ??
    saveError.alerts ??
    (status.error ? status.error : time ? `Quotes from CNBC · ${time}` : "Loading quotes…");

  return (
    <Stocks
      {...props}
      market={market}
      history={history}
      footer={footer}
      keptView={keptView}
      askedSymbol={askedSymbol}
      onSymbolChange={(symbol) => {
        setChosen({ symbol });
        keep({ symbol });
        props.onSymbolChange?.(symbol);
      }}
      onRangeChange={(next) => {
        setOwnRange(next);
        keep({ range: next });
        props.onRangeChange?.(next);
      }}
      onBadgeModeChange={(badgeMode) => {
        keep({ badgeMode });
        props.onBadgeModeChange?.(badgeMode);
      }}
      onSidebarShownChange={(shown) => {
        keep({ sidebarHidden: !shown });
        props.onSidebarShownChange?.(shown);
      }}
      onQueryChange={(next) => {
        setQuery(next);
        props.onQueryChange?.(next);
      }}
      searchResults={results}
      onAddSymbol={(symbol) =>
        saveWatchlist((current) => (current.includes(symbol) ? current : [...current, symbol]))
      }
      onRemoveSymbol={(symbol) => saveWatchlist((current) => current.filter((s) => s !== symbol))}
      onRefresh={() => setRefreshes((count) => count + 1)}
      shareLinkFor={quotePage}
      onMoveSymbol={(symbol, to) => saveWatchlist((current) => moveSymbol(current, symbol, to))}
      alerts={alerts}
      onAddAlert={(symbol, when, value) =>
        saveAlerts((current) => [
          ...current,
          {
            id: alertId(),
            symbol,
            above: when === "above" ? value : null,
            below: when === "below" ? value : null,
            created: Date.now(),
            fired: null,
          },
        ])
      }
      onRemoveAlert={(id) => saveAlerts((current) => current.filter((alert) => alert.id !== id))}
    />
  );
}

/**
 * Stocks as the desktop shows it. When the `macalicious-desktop` Ferrite application serves the
 * desktop, the watchlist is the person's own and is kept on the server, the quotes, charts and
 * business news are real (CNBC's, through the application's egress, refreshed every minute),
 * the search field finds symbols to add, and the detail view sets price alerts that fire on the
 * server. Every other build shows the demo's market, as `Stocks` does.
 */
export function DesktopStocks(props: StocksProps) {
  return servedByDesktopApp() ? <ServedStocks {...props} /> : <Stocks {...props} />;
}

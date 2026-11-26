import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openItem } from "../desktop/desktop-open-item";
import { takeOpenUrlRequests } from "../desktop/desktop-open-url";
import { forgetDesktopValues } from "../desktop/desktop-personal";
import { onSharedLink, type SharedLink } from "../desktop/desktop-share-link";
import { alertText, Stocks } from "./stocks";
import { formatPercent, formatPrice, lightMarket } from "./stocks-data";
import {
  ageOf,
  alertsFromServer,
  DEFAULT_WATCHLIST,
  DesktopStocks,
  editList,
  historyOf,
  LOADING_QUOTE,
  pointsFromServer,
  quoteForWindow,
  quotesFromServer,
  REFRESH_MS,
  resultsFromServer,
  storiesFromServer,
} from "./stocks-desktop";

afterEach(() => {
  forgetDesktopValues();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** Quotes as the module answered them from CNBC under `ferrite dev`, shortened. */
const QUOTE = (symbol: string, name: string, price: number, change: number) => ({
  symbol,
  name,
  price,
  change,
  previous_close: price - change,
  open: price - 1,
  high: price + 2,
  low: price - 3,
  year_high: price + 10,
  year_low: price - 100,
  volume: "17.1M",
  market_cap: symbol.startsWith(".") ? null : "5.026T",
  pe: symbol.startsWith(".") ? null : "39.63",
  kind: symbol.startsWith(".") ? "index" : "stock",
  time: "12:09 PM EDT",
});
const QUOTES = {
  ".DJI": QUOTE(".DJI", "Dow Jones Industrial Average", 46_120.5, -120.3),
  ".SPX": QUOTE(".SPX", "S&P 500 Index", 7732.44, -73.01),
  ".IXIC": QUOTE(".IXIC", "Nasdaq Composite", 24_101.2, 15.2),
  AAPL: QUOTE("AAPL", "Apple Inc.", 344.38, 3.11),
  TSLA: QUOTE("TSLA", "Tesla Inc", 251.5, -2.5),
} as Record<string, ReturnType<typeof QUOTE>>;

const json = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

/** The module's routes over in-memory documents; records every PUT body. */
function serve() {
  const docs: Record<string, { body: Record<string, unknown>; rev: number }> = {
    watchlist: { body: { symbols: null }, rev: 0 },
    alerts: { body: { alerts: null }, rev: 0 },
  };
  const puts: { url: string; body: Record<string, unknown> }[] = [];
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const { pathname, searchParams } = new URL(url, "http://desktop.test");
    const name = pathname.split("/").at(-1) ?? "";
    if (name in docs) {
      const doc = docs[name] as { body: Record<string, unknown>; rev: number };
      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        puts.push({ url: pathname, body });
        if (body.rev !== doc.rev) return json(409, { ...doc.body, rev: doc.rev });
        const { rev: _rev, session: _session, ...rest } = body;
        doc.body = rest;
        doc.rev += 1;
      }
      return json(200, { ...doc.body, rev: doc.rev, session: "s1" });
    }
    if (pathname === "/api/stocks/quotes") {
      const symbols = (searchParams.get("symbols") ?? "").split(",");
      return json(200, { quotes: symbols.map((s) => QUOTES[s]).filter(Boolean), missing: [] });
    }
    if (pathname === "/api/stocks/chart") {
      const start = Date.UTC(2026, 9, 14, 13, 30);
      return json(200, {
        points: Array.from({ length: 10 }, (_, i) => [start + i * 40 * 60_000, 340 + i]),
      });
    }
    if (pathname === "/api/stocks/news") {
      return json(200, {
        stories: [
          {
            id: "108",
            headline: "Netflix to lay off roughly 1,000 employees",
            summary: "Netflix will lay off about 6% of its staff.",
            url: "https://www.cnbc.com/2026/10/14/netflix-layoffs.html",
            published_ms: Date.now() - 25 * 60_000,
            publisher: "CNBC",
          },
        ],
      });
    }
    if (pathname === "/api/stocks/search") {
      return json(200, {
        results: [{ symbol: "TSLA", name: "Tesla Inc", exchange: "NASDAQ", kind: "stock" }],
      });
    }
    return json(404, { error: "no route" });
  });
  vi.stubGlobal("fetch", fetch);
  return { docs, puts };
}

describe("Stocks on the desktop's Ferrite application", () => {
  it("reads the module's answers into the window's shapes", () => {
    expect(quotesFromServer({ quotes: [QUOTES.AAPL, { symbol: "X" }] })).toHaveLength(1);
    expect(pointsFromServer({ points: [[1, 2], [3], ["a", 1]] })).toEqual([[1, 2]]);
    expect(resultsFromServer({ results: [{ symbol: "TSLA", name: "Tesla Inc" }, {}] })).toEqual([
      { symbol: "TSLA", name: "Tesla Inc" },
    ]);
    const stories = storiesFromServer(
      {
        stories: [
          {
            id: "1",
            headline: "A",
            url: "https://x.test/a",
            published_ms: 1_000,
            publisher: "CNBC",
          },
          { id: "2", headline: "B", url: "javascript:void(0)" },
        ],
      },
      1_000 + 3 * 3_600_000,
    );
    expect(stories).toEqual([
      { id: "1", headline: "A", url: "https://x.test/a", publisher: "CNBC", age: "3h ago" },
    ]);
    expect(ageOf(0, 5)).toBe("");
    expect(ageOf(1_000, 1_000 + 25 * 60_000)).toBe("25m ago");

    const alerts = alertsFromServer({
      alerts: [
        { id: "a1", symbol: "AAPL", above: 350, below: null, created: 1, fired: null },
        {
          id: "a2",
          symbol: "AAPL",
          above: null,
          below: 300,
          created: 1,
          fired: { at: 5, price: 299 },
        },
        { id: "a3", symbol: "AAPL", created: 1 },
      ],
    });
    expect(alerts).toEqual([
      { id: "a1", symbol: "AAPL", above: 350 },
      { id: "a2", symbol: "AAPL", below: 300, fired: { at: 5, price: 299 } },
    ]);
    expect(alertText(alerts[0] as (typeof alerts)[0])).toBe("Above 350.00");
    expect(alertText(alerts[1] as (typeof alerts)[0])).toMatch(/^Below 300.00: reached 299.00 on /);

    const noFigures = quoteForWindow(
      { ...(QUOTES.AAPL as ReturnType<typeof QUOTE>), open: 0, high: 0.01, low: 0, year_low: null },
      [],
    );
    expect(noFigures.figures?.slice(0, 3)).toEqual([
      ["Open", "—"],
      ["High", "0.01"],
      ["Low", "—"],
    ]);
    expect(noFigures.figures).toContainEqual(["52W L", "—"]);

    const quote = quoteForWindow(QUOTES.AAPL as ReturnType<typeof QUOTE>, [1, 2]);
    expect(quote.figures).toContainEqual(["P/E", "39.63"]);
    expect(quote.figures).toContainEqual(["52W L", "244.38"]);
    expect(quoteForWindow(QUOTES[".SPX"] as ReturnType<typeof QUOTE>, []).figures).toContainEqual([
      "Mkt Cap",
      "—",
    ]);

    const start = Date.UTC(2026, 9, 14, 13, 30);
    const day = historyOf(
      Array.from({ length: 10 }, (_, i) => [start + i * 40 * 60_000, i] as [number, number]),
      "1D",
    );
    expect(day.prices).toHaveLength(10);
    expect(day.labels[0]).toBe("10 AM");
    expect(new Set(day.labels).size).toBe(day.labels.length);
  });

  it("a notification of a fired alert opens the alert's symbol, found by the alert's id", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const { docs } = serve();
    (docs.alerts as { body: Record<string, unknown> }).body = {
      alerts: [{ id: "fired-1", symbol: "AAPL", below: 300, created: 1, fired: null }],
    };
    render(<DesktopStocks />);
    const user = userEvent.setup();
    // The person has chosen another symbol in the window: the notification moves it all the same.
    await user.click(await screen.findByRole("button", { name: /TSLA|\.DJI/ }));
    act(() => openItem({ app: "stocks", id: "alert-fired-1", title: "AAPL fell below 300.00" }));
    expect(await screen.findByText("Below 300.00")).toBeVisible();
    expect(screen.getByRole("heading", { name: "AAPL" })).toBeVisible();
  });

  it("shows the person's watchlist with real quotes, figures, chart and news", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    serve();
    const served = globalThis.fetch as unknown as (
      url: string,
      init?: RequestInit,
    ) => Promise<unknown>;
    // The list shows before its quotes do: hold them, so the order is the same however busy the
    // machine is.
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (url.startsWith("/api/stocks/quotes")) await held;
      return served(url, init);
    });
    render(<DesktopStocks />);
    const list = await screen
      .findByRole("list", { name: "Symbols" })
      .catch(() => screen.findByLabelText("Symbols"));
    await waitFor(() =>
      expect(
        within(list).getAllByRole("button", { name: /AAPL|DJI|SPX|IXIC/ }).length,
      ).toBeGreaterThan(0),
    );
    expect(screen.getByText("Loading quotes…")).toBeVisible();
    release?.();
    expect(await screen.findByText(/^Quotes from CNBC/)).toBeVisible();
    expect(await screen.findByRole("link", { name: /Netflix to lay off/ })).toHaveAttribute(
      "href",
      "https://www.cnbc.com/2026/10/14/netflix-layoffs.html",
    );
    await user.click(within(list).getAllByRole("button", { name: /AAPL/ })[0] as HTMLElement);
    expect(await screen.findByText("39.63")).toBeVisible();
    expect(screen.getByText("5.026T", { selector: "dd" })).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole("img", { name: /^AAPL, today: from / })).toBeVisible(),
    );
    expect(DEFAULT_WATCHLIST).toContain("AAPL");
  });

  it("a story's headline opens it in the window, and its button at its publisher in Safari", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    serve();
    takeOpenUrlRequests();
    render(<DesktopStocks />);
    await user.click(await screen.findByRole("link", { name: /Netflix to lay off/ }));
    const story = screen.getByRole("article", { name: "Story" });
    expect(takeOpenUrlRequests()).toEqual([]);
    expect(within(story).getByRole("heading").textContent).toMatch(/Netflix to lay off/);
    await user.click(within(story).getByRole("button", { name: /^Read the Whole Story at / }));
    expect(takeOpenUrlRequests()).toEqual([
      { url: "https://www.cnbc.com/2026/10/14/netflix-layoffs.html", from: "stocks" },
    ]);
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.queryByRole("article", { name: "Story" })).toBeNull();
    expect(await screen.findByRole("link", { name: /Netflix to lay off/ })).toBeTruthy();
  });

  it("a new search does not offer the symbols found for the one before", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    serve();
    render(<DesktopStocks />);
    const field = screen.getByRole("searchbox", { name: "Search" });
    await user.type(field, "tesla");
    await screen.findByRole("button", { name: "Add TSLA" });
    await user.clear(field);
    await user.type(field, "apple");
    expect(screen.queryByRole("button", { name: "Add TSLA" })).toBeNull();
  });

  it("adds a found symbol to the watchlist and saves it, and saves a price alert", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    const { docs, puts } = serve();
    render(<DesktopStocks />);
    await user.type(screen.getByRole("searchbox", { name: "Search" }), "tesla");
    await user.click(await screen.findByRole("button", { name: "Add TSLA" }));
    await waitFor(() =>
      expect(docs.watchlist?.body.symbols).toEqual([...DEFAULT_WATCHLIST, "TSLA"]),
    );
    expect(puts[0]?.url).toBe("/api/stocks/watchlist");

    // The added symbol is shown; set an alert on it.
    const price = await screen.findByRole("textbox", { name: "Alert price" });
    await user.type(price, "300");
    await user.click(screen.getByRole("button", { name: "Add Alert" }));
    await waitFor(() => expect(docs.alerts?.body.alerts).toHaveLength(1));
    const saved = (docs.alerts?.body.alerts as Record<string, unknown>[] | undefined)?.[0];
    // TSLA is down, so the form starts on Below.
    expect(saved).toMatchObject({ symbol: "TSLA", above: null, below: 300, fired: null });
    expect(await screen.findByText("Below 300.00")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(docs.alerts?.body.alerts).toEqual([]));
  });

  it("an empty chart says why and never draws generated history", async () => {
    const user = userEvent.setup();
    const status = "Loading Chart…";
    render(<Stocks market={lightMarket} history={() => ({ prices: [], labels: [], status })} />);
    const first = lightMarket.quotes[0]?.symbol ?? "";
    const row = screen
      .getAllByRole("button")
      .find((button) => button.textContent?.startsWith(first));
    await user.click(row as HTMLElement);
    expect(await screen.findByText(status)).toBeVisible();
    const charts = screen
      .queryAllByRole("img")
      .filter((img) => img.getAttribute("aria-label")?.startsWith(`${first}, today`));
    expect(charts).toEqual([]);
  });

  it("a chart tells of the prices it draws, not of a quote from another moment", async () => {
    const user = userEvent.setup();
    const stock = lightMarket.quotes[0] as (typeof lightMarket.quotes)[0];
    const close = stock.price - stock.change;
    // The source's day ends on the other side of the previous close from the quote.
    const last = stock.change >= 0 ? close - 5 : close + 5;
    render(
      <Stocks
        market={lightMarket}
        history={(_quote, range) =>
          range === "1D" ? { prices: [close, last], labels: ["10 AM", "4 PM"] } : undefined
        }
      />,
    );
    const row = screen
      .getAllByRole("button")
      .find((button) => button.textContent?.startsWith(stock.symbol));
    await user.click(row as HTMLElement);
    const chart = await screen.findByRole("img", { name: new RegExp(`^${stock.symbol}, today`) });
    expect(chart.getAttribute("aria-label")).toBe(
      `${stock.symbol}, today: from ${formatPrice(close)} to ${formatPrice(last)}, ${formatPercent({ price: last, change: last - close })}`,
    );
    expect(chart.closest("[data-direction]")).toHaveAttribute(
      "data-direction",
      stock.change >= 0 ? "loss" : "gain",
    );
  });

  it("lists every watchlist symbol while its quotes load or fail, and lets it be removed", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    const { docs } = serve();
    docs.watchlist = { body: { symbols: ["AAPL", "ZZZZ"] }, rev: 1 };
    const served = globalThis.fetch as unknown as (
      url: string,
      init?: RequestInit,
    ) => Promise<unknown>;
    let release: (() => void) | undefined;
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
      if (url.startsWith("/api/stocks/quotes")) {
        // The first quotes read is held, then fails; every later one fails at once.
        const failed = json(503, { error: "CNBC could not be reached" });
        if (release) return Promise.resolve(failed);
        return new Promise((resolve) => {
          release = () => resolve(failed);
        });
      }
      return served(url, init);
    });
    render(<DesktopStocks />);
    const row = async (symbol: string) =>
      (await screen.findAllByRole("button", { name: new RegExp(`^${symbol}`) }))[0] as HTMLElement;
    await waitFor(() => expect(release).toBeTypeOf("function"));
    expect(await row("AAPL")).toHaveTextContent(LOADING_QUOTE);
    expect(await row("ZZZZ")).toHaveTextContent(LOADING_QUOTE);
    release?.();
    await waitFor(async () => expect(await row("ZZZZ")).toHaveTextContent("No quote available"));
    await user.click(await row("ZZZZ"));
    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(await screen.findByRole("menuitem", { name: "Remove from Watchlist" }));
    await waitFor(() => expect(docs.watchlist?.body.symbols).toEqual(["AAPL"]));
  });

  it.each([
    {
      state: "loaded",
      response: json(200, { quotes: [QUOTES.AAPL], missing: [] }),
      name: "Apple Inc.",
      title: "AAPL Apple Inc.",
    },
    {
      state: "missing",
      response: json(200, { quotes: [], missing: ["AAPL"] }),
      name: "No quote available",
      title: "AAPL",
    },
    {
      state: "failed",
      response: json(503, { error: "CNBC could not be reached" }),
      name: "No quote available",
      title: "AAPL",
    },
  ])(
    "shares a useful title while loading and after a $state quote reply",
    async ({ response, name, title }) => {
      vi.stubEnv("VITE_MACALICIOUS_API", "1");
      const user = userEvent.setup();
      const { docs } = serve();
      docs.watchlist = { body: { symbols: ["AAPL"] }, rev: 1 };
      const served = globalThis.fetch;
      let release: ((reply: ReturnType<typeof json>) => void) | undefined;
      vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
        if (url.startsWith("/api/stocks/quotes")) {
          return new Promise<ReturnType<typeof json>>((resolve) => {
            release = resolve;
          });
        }
        return served(url, init);
      });
      const shared: SharedLink[] = [];
      const stop = onSharedLink("mail", (link) => shared.push(link));
      render(<DesktopStocks />);
      const row = () => screen.getAllByRole("button", { name: /^AAPL/ })[0] as HTMLElement;
      const share = async () => {
        await user.click(screen.getByRole("button", { name: "Share" }));
        await user.click(await screen.findByRole("menuitem", { name: /^Mail$/ }));
      };
      try {
        await waitFor(() => expect(release).toBeTypeOf("function"));
        expect(row()).toHaveTextContent(LOADING_QUOTE);
        await user.click(row());
        await share();
        expect(shared).toEqual([
          { url: "https://www.cnbc.com/quotes/AAPL", title: "AAPL", from: "stocks", to: "mail" },
        ]);
        release?.(response);
        await waitFor(() => expect(row()).toHaveTextContent(name));
        await share();
        expect(shared).toEqual([
          { url: "https://www.cnbc.com/quotes/AAPL", title: "AAPL", from: "stocks", to: "mail" },
          { url: "https://www.cnbc.com/quotes/AAPL", title, from: "stocks", to: "mail" },
        ]);
      } finally {
        release?.(response);
        stop();
      }
    },
  );

  it("queues edits of one document so they are stored in the order made", async () => {
    const { docs, puts } = serve();
    const added = editList<string>("/api/stocks/watchlist", "symbols", (stored) => [
      ...(stored ?? []),
      "TSLA",
    ]);
    const removed = editList<string>("/api/stocks/watchlist", "symbols", (stored) =>
      (stored ?? []).filter((symbol) => symbol !== "TSLA"),
    );
    await Promise.all([added, removed]);
    expect(puts.map((put) => put.body.symbols)).toEqual([["TSLA"], []]);
    expect(docs.watchlist?.body.symbols).toEqual([]);
    // Each was based on the revision the one before it stored: no conflict, no retry.
    expect(puts.map((put) => put.body.rev)).toEqual([0, 1]);
  });

  it("refuses to edit a stored list it cannot read instead of saving defaults over it", async () => {
    const { docs, puts } = serve();
    for (const unreadable of ["AAPL", { 0: "AAPL" }, 7]) {
      (docs.watchlist as { body: Record<string, unknown> }).body = { symbols: unreadable };
      await expect(
        editList<string>("/api/stocks/watchlist", "symbols", (stored) => [
          ...(stored ?? []),
          "TSLA",
        ]),
      ).rejects.toThrow("the stored symbols could not be read, so it was left as it is");
      expect(docs.watchlist?.body.symbols).toEqual(unreadable);
    }
    (docs.alerts as { body: Record<string, unknown> }).body = { alerts: "broken" };
    await expect(editList("/api/stocks/alerts", "alerts", () => [])).rejects.toThrow(
      "the stored alerts could not be read",
    );
    expect(puts).toEqual([]);
    // A list never saved (`null`) is the uninitialized form, and starts empty.
    (docs.watchlist as { body: Record<string, unknown> }).body = { symbols: null };
    await editList<string>("/api/stocks/watchlist", "symbols", (stored) => [
      ...(stored ?? []),
      "TSLA",
    ]);
    expect(docs.watchlist?.body.symbols).toEqual(["TSLA"]);
  });

  it("a slow alerts poll does not put back the list an edit replaced", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    serve();
    const served = globalThis.fetch as unknown as (
      url: string,
      init?: RequestInit,
    ) => Promise<unknown>;
    // The window's first alerts poll is held until the alert below has been saved.
    let release: (() => void) | undefined;
    let held = false;
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
      if (url === "/api/stocks/alerts" && !init?.method && !held) {
        held = true;
        const answer = served(url, init);
        return new Promise((resolve) => {
          release = () => resolve(answer);
        });
      }
      return served(url, init);
    });
    render(<DesktopStocks />);
    const aapl = await screen.findAllByRole("button", { name: /^AAPL/ });
    await user.click(aapl[0] as HTMLElement);
    await user.type(await screen.findByRole("textbox", { name: "Alert price" }), "300");
    await user.click(screen.getByRole("button", { name: "Add Alert" }));
    expect(await screen.findByText(/^(Above|Below) 300\.00$/)).toBeVisible();
    // The poll sent before the edit answers the empty list it read then.
    release?.();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByText(/^(Above|Below) 300\.00$/)).toBeVisible();
  });

  it("a first read that answers after an edit does not undo it", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    const { docs } = serve();
    const served = globalThis.fetch as unknown as (
      url: string,
      init?: RequestInit,
    ) => Promise<unknown>;
    let release: (() => void) | undefined;
    let held = false;
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
      // The window's own first read of the watchlist is held until after the edit.
      if (url === "/api/stocks/watchlist" && !init?.method && !held) {
        held = true;
        const answer = served(url, init);
        return new Promise((resolve) => {
          release = () => resolve(answer);
        });
      }
      return served(url, init);
    });
    render(<DesktopStocks />);
    await user.type(screen.getByRole("searchbox", { name: "Search" }), "tesla");
    await user.click(await screen.findByRole("button", { name: "Add TSLA" }));
    await waitFor(() =>
      expect(docs.watchlist?.body.symbols).toEqual([...DEFAULT_WATCHLIST, "TSLA"]),
    );
    release?.();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect((await screen.findAllByRole("button", { name: /^TSLA/ })).length).toBeGreaterThan(0);
  });

  it("a failed save is shown as failed: the list goes back to what is stored, and the error stays", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { docs } = serve();
    docs.watchlist = { body: { symbols: ["AAPL"] }, rev: 1 };
    const served = globalThis.fetch as unknown as (
      url: string,
      init?: RequestInit,
    ) => Promise<unknown>;
    const quoteReads: string[] = [];
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
      if (url === "/api/stocks/watchlist" && init?.method === "PUT")
        return Promise.resolve(json(503, { error: "storage failed" }));
      if (url.startsWith("/api/stocks/quotes")) quoteReads.push(url);
      return served(url, init);
    });
    render(<DesktopStocks />);
    await screen.findAllByRole("button", { name: /^AAPL/ });
    await user.type(screen.getByRole("searchbox", { name: "Search" }), "tesla");
    await user.click(await screen.findByRole("button", { name: "Add TSLA" }));
    expect(await screen.findByText(/^The watchlist was not saved/)).toBeVisible();
    // The list shows what is stored: TSLA is not in it.
    await waitFor(() => expect(screen.queryAllByRole("button", { name: /^TSLA/ })).toHaveLength(0));
    // Quotes read again after that, on the minute's poll, do not hide the error.
    const reads = quoteReads.length;
    try {
      await act(() => vi.advanceTimersByTimeAsync(REFRESH_MS));
      await waitFor(() => expect(quoteReads.length).toBeGreaterThan(reads));
      await act(() => vi.advanceTimersByTimeAsync(50));
    } finally {
      vi.useRealTimers();
    }
    expect(screen.getByText(/^The watchlist was not saved/)).toBeVisible();
    expect(docs.watchlist?.body.symbols).toEqual(["AAPL"]);
  });

  it("a save reply that answers after a newer edit does not put back what that edit changed", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    const { docs } = serve();
    docs.watchlist = { body: { symbols: ["AAPL"] }, rev: 1 };
    const served = globalThis.fetch as unknown as (
      url: string,
      init?: RequestInit,
    ) => Promise<unknown>;
    // Every watchlist save is held until the test lets it answer.
    const held: (() => void)[] = [];
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
      if (url === "/api/stocks/watchlist" && init?.method === "PUT") {
        const answer = served(url, init);
        return new Promise((resolve) => held.push(() => resolve(answer)));
      }
      return served(url, init);
    });
    render(<DesktopStocks />);
    try {
      await screen.findAllByRole("button", { name: /^AAPL/ });
      // Add TSLA, then remove AAPL while the add's reply is still on its way.
      await user.type(screen.getByRole("searchbox", { name: "Search" }), "tesla");
      await user.click(await screen.findByRole("button", { name: "Add TSLA" }));
      await waitFor(() => expect(held).toHaveLength(1));
      await user.click((await screen.findAllByRole("button", { name: /^AAPL/ }))[0] as HTMLElement);
      await user.click(screen.getByRole("button", { name: "Share" }));
      await user.click(await screen.findByRole("menuitem", { name: "Remove from Watchlist" }));
      await waitFor(() =>
        expect(screen.queryAllByRole("button", { name: /^AAPL/ })).toHaveLength(0),
      );

      // The add's reply (AAPL and TSLA) is older than the removal: AAPL does not come back.
      // The removal is saved only after the add, on the revision the add stored.
      held.shift()?.();
      await waitFor(() => expect(held).toHaveLength(1));
      expect(screen.queryAllByRole("button", { name: /^AAPL/ })).toHaveLength(0);

      held.shift()?.();
      await waitFor(() => expect(docs.watchlist?.body.symbols).toEqual(["TSLA"]));
      expect(docs.watchlist?.rev).toBe(3);
      expect(screen.queryAllByRole("button", { name: /^AAPL/ })).toHaveLength(0);
      expect((await screen.findAllByRole("button", { name: /^TSLA/ })).length).toBeGreaterThan(0);
    } finally {
      // A held save would block this page's later edits of the watchlist.
      for (const release of held.splice(0)) release();
    }
  });

  it("a stored list read back after a failed save never undoes a newer saved edit", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    const { docs } = serve();
    docs.watchlist = { body: { symbols: ["AAPL"] }, rev: 1 };
    const served = globalThis.fetch as unknown as (
      url: string,
      init?: RequestInit,
    ) => Promise<unknown>;
    let failNext = true;
    let holdRead = false;
    let release: (() => void) | undefined;
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
      if (url === "/api/stocks/watchlist" && init?.method === "PUT" && failNext) {
        failNext = false;
        holdRead = true;
        return Promise.resolve(json(503, { error: "storage failed" }));
      }
      // The stored list read back after that failure is slow: it answers last.
      if (url === "/api/stocks/watchlist" && !init?.method && holdRead) {
        holdRead = false;
        const answer = served(url, init);
        return new Promise((resolve) => {
          release = () => resolve(answer);
        });
      }
      return served(url, init);
    });
    render(<DesktopStocks />);
    try {
      await screen.findAllByRole("button", { name: /^AAPL/ });
      // Adding TSLA fails; reading back what is stored is held.
      await user.type(screen.getByRole("searchbox", { name: "Search" }), "tesla");
      await user.click(await screen.findByRole("button", { name: "Add TSLA" }));
      expect(await screen.findByText(/^The watchlist was not saved/)).toBeVisible();
      await waitFor(() => expect(release).toBeTypeOf("function"));
      // A newer edit, removing AAPL, is saved meanwhile.
      await user.click((await screen.findAllByRole("button", { name: /^AAPL/ }))[0] as HTMLElement);
      await user.click(screen.getByRole("button", { name: "Share" }));
      await user.click(await screen.findByRole("menuitem", { name: "Remove from Watchlist" }));
      await waitFor(() => expect(docs.watchlist?.body.symbols).toEqual([]));
      // The old read answers now, with the list as it was (AAPL): it is not shown.
      release?.();
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.queryAllByRole("button", { name: /^AAPL/ })).toHaveLength(0);
    } finally {
      release?.();
    }
  });

  it("lists a symbol with no quote so it can be opened and removed", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    const { docs } = serve();
    docs.watchlist = { body: { symbols: ["AAPL", "ZZZZ"] }, rev: 1 };
    render(<DesktopStocks />);
    const zzzz = () => screen.getAllByRole("button", { name: /^ZZZZ/ })[0] as HTMLElement;
    // The row is listed while its quote loads, then says there is none.
    await waitFor(() => expect(zzzz()).toHaveTextContent("No quote available"));
    await user.click(zzzz());
    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(await screen.findByRole("menuitem", { name: "Remove from Watchlist" }));
    await waitFor(() => expect(docs.watchlist?.body.symbols).toEqual(["AAPL"]));
  });

  it("a slow quote reply for an older watchlist does not replace the newer one's", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    const { docs } = serve();
    docs.watchlist = { body: { symbols: ["AAPL"] }, rev: 1 };
    const served = globalThis.fetch as unknown as (
      url: string,
      init?: RequestInit,
    ) => Promise<unknown>;
    let release: (() => void) | undefined;
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
      // The first quotes read (the list before TSLA) answers only after the next one.
      if (url.startsWith("/api/stocks/quotes") && !release) {
        const answer = served(url, init);
        return new Promise((resolve) => {
          release = () => resolve(answer);
        });
      }
      return served(url, init);
    });
    render(<DesktopStocks />);
    await waitFor(() => expect(release).toBeTypeOf("function"));
    await user.type(screen.getByRole("searchbox", { name: "Search" }), "tesla");
    await user.click(await screen.findByRole("button", { name: "Add TSLA" }));
    const tesla = async () => (await screen.findAllByRole("button", { name: /^TSLA/ }))[0];
    await waitFor(async () => expect(await tesla()).toHaveTextContent("251.50"));
    release?.();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await tesla()).toHaveTextContent("251.50");
    expect(await tesla()).not.toHaveTextContent("No quote available");
  });

  it("a sparkline reply for an older poll that comes after a newer one's is not drawn", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.stubEnv("VITE_MACALICIOUS_API", "1");
      const { docs } = serve();
      docs.watchlist = { body: { symbols: ["AAPL"] }, rev: 1 };
      const served = globalThis.fetch as unknown as (
        url: string,
        init?: RequestInit,
      ) => Promise<unknown>;
      const start = Date.UTC(2026, 9, 14, 13, 30);
      const day = (from: number) => ({
        ok: true,
        status: 200,
        json: async () => ({
          points: Array.from({ length: 10 }, (_, i) => [start + i * 40 * 60_000, from + i]),
        }),
      });
      let sparklines = 0;
      let releaseFirst: (() => void) | undefined;
      vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
        if (url.startsWith("/api/stocks/chart")) {
          sparklines += 1;
          // The first poll's sparkline (prices from 100) answers only after the second's (500).
          if (sparklines === 1)
            return new Promise((resolve) => {
              releaseFirst = () => resolve(day(100));
            });
          return Promise.resolve(day(500));
        }
        return served(url, init);
      });
      const { container } = render(<DesktopStocks />);
      await screen.findAllByRole("button", { name: /^AAPL/ });
      await waitFor(() => expect(sparklines).toBe(1));
      await act(() => vi.advanceTimersByTimeAsync(REFRESH_MS));
      await waitFor(() => expect(sparklines).toBe(2));
      const line = () =>
        container.querySelector(".mac-stock-row-sparkline-line")?.getAttribute("points") ?? "";
      await waitFor(() => expect(line()).not.toBe(""));
      const newer = line();
      await act(async () => releaseFirst?.());
      await act(() => vi.advanceTimersByTimeAsync(50));
      expect(line(), "the newer poll's line stays").toBe(newer);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the open symbol's chart anew on every minute's poll", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.stubEnv("VITE_MACALICIOUS_API", "1");
      const { docs } = serve();
      docs.watchlist = { body: { symbols: ["AAPL"] }, rev: 1 };
      const served = globalThis.fetch as unknown as (
        url: string,
        init?: RequestInit,
      ) => Promise<unknown>;
      const start = Date.UTC(2026, 9, 14, 13, 30);
      const prices = (from: number) => ({
        ok: true,
        status: 200,
        json: async () => ({
          points: Array.from({ length: 10 }, (_, i) => [start + i * 40 * 60_000, from + i]),
        }),
      });
      const charts: string[] = [];
      let firstRound = true;
      vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
        if (url.startsWith("/api/stocks/chart")) {
          charts.push(url);
          return Promise.resolve(prices(firstRound ? 100 : 500));
        }
        return served(url, init);
      });
      render(<DesktopStocks />);
      const row = (await screen.findAllByRole("button", { name: /^AAPL/ }))[0] as HTMLElement;
      fireEvent.click(row);
      const chart = () => screen.getByRole("img", { name: /^AAPL, today: from / });
      await screen.findByRole("img", { name: /^AAPL, today: from / });
      // The sparkline and the open chart, so far.
      await waitFor(() => expect(charts).toHaveLength(2));
      const before = chart().getAttribute("aria-label");
      expect(before).toMatch(/to 109\.00/);
      firstRound = false;
      await act(() => vi.advanceTimersByTimeAsync(REFRESH_MS));
      // The minute's poll asks for both again, and what it answers is what the chart then shows.
      await waitFor(() => expect(charts).toHaveLength(4));
      await waitFor(() => expect(chart().getAttribute("aria-label")).toMatch(/to 509\.00/));
      expect(charts.every((url) => url.includes("symbol=AAPL"))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("leaves the watchlist alone when the arrows are pressed with the sidebar hidden", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const { docs } = serve();
    docs.watchlist = { body: { symbols: ["AAPL", "TSLA"] }, rev: 1 };
    const { container } = render(<DesktopStocks />);
    await waitFor(() =>
      expect(container.querySelector(".mac-stock-row-sparkline-line")).not.toBeNull(),
    );
    const frame = container.firstElementChild as HTMLElement;
    // View > Hide Sidebar, by its key: Option-Command-S.
    fireEvent.keyDown(frame, { key: "s", code: "KeyS", altKey: true, ctrlKey: true });
    await waitFor(() =>
      expect(container.querySelector(".mac-stocks-column")).toHaveAttribute("data-hidden"),
    );
    const shown = () => container.querySelector(".mac-stocks-pane h2")?.textContent;
    const before = shown();
    expect(before).toBeTruthy();
    fireEvent.keyDown(frame, { key: "ArrowDown" });
    fireEvent.keyDown(frame, { key: "ArrowDown" });
    expect(shown()).toBe(before);
  });

  it("keeps the refreshed news when the reply to an older request comes after it", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    serve();
    const served = globalThis.fetch;
    const story = (headline: string) => ({
      stories: [{ id: headline, headline, url: "https://www.cnbc.com/a", published_ms: 1 }],
    });
    let release = (_answer: ReturnType<typeof json>) => {};
    const first = new Promise<ReturnType<typeof json>>((resolve) => {
      release = resolve;
    });
    let asked = 0;
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (!String(url).includes("/api/stocks/news")) return served(url, init);
      asked += 1;
      return asked === 1 ? first : json(200, story("Refreshed headline"));
    });
    render(<DesktopStocks />);
    const window = screen.getByRole("region", { name: "Stocks" });
    fireEvent.keyDown(window, { key: "r", code: "KeyR", ctrlKey: true });
    await screen.findByText("Refreshed headline");
    await act(async () => release(json(200, story("Older headline"))));
    expect(screen.getByText("Refreshed headline")).toBeVisible();
    expect(screen.queryByText("Older headline")).toBeNull();
  });

  it("outside the Ferrite app it is the demo and asks nothing", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<DesktopStocks />);
    expect(screen.getByText("Sample data")).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });
});

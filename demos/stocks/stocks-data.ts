/*
 * Stocks: the demo's data. Nothing is fetched. The symbols, names, prices and changes are the
 * ones the two reference captures show (reference/spec/apps/stocks.md); everything a capture
 * does not hold is invented and computed from the symbol, so that it is the same on every
 * render, on the server and in the page: the course of the session behind each sparkline, the
 * longer histories, the figures of the detail view and the market capitalisations.
 */

/** What the badge of every row shows; a click on a badge moves to the next. */
export type BadgeMode = "change" | "percent" | "cap";

/** The spans of time the chart of the detail view can show. */
export const RANGES = ["1D", "1W", "1M", "3M", "6M", "1Y", "2Y"] as const;
export type StockRange = (typeof RANGES)[number];

export interface StockQuote {
  /** The ticker symbol or an index's short name: what a row shows first and what selects it. */
  symbol: string;
  /** The company's or the index's full name. */
  name: string;
  /** The last price. */
  price: number;
  /** The change on the previous close. */
  change: number;
  /** The market capitalisation, already written; an index has none. */
  marketCap?: string;
  /** The session's prices in order, from the open to the last price. */
  session: readonly number[];
  /**
   * The figures under the chart, as label and value, when a source gives them; otherwise they
   * are computed for the demo (`statistics`).
   */
  figures?: readonly (readonly [string, string])[];
  /**
   * Whether the source has no quote for the symbol: the row and the detail view show dashes
   * instead of `price` and `change`, so the symbol can still be opened and removed.
   */
  unavailable?: boolean;
}

/** The prices a chart draws for a range, oldest first, and the labels under it. */
export interface StockHistory {
  prices: readonly number[];
  labels: readonly string[];
  /** What an empty chart says instead (it is loading, or there is no data). */
  status?: string;
}

/** A symbol a search found, which can be added to the watchlist. */
export interface StockSearchResult {
  symbol: string;
  name: string;
  exchange?: string;
}

/** A price alert on a symbol: it fires once, when the price reaches `above` or `below`. */
export interface StockAlert {
  id: string;
  symbol: string;
  above?: number;
  below?: number;
  /** When it fired (epoch ms) and at what price. */
  fired?: { at: number; price: number };
}

/** How a story is laid out in the feed. */
export type StoryLayout = "lead" | "beside" | "card" | "compact";

export interface StockStory {
  id: string;
  /** The publisher, as text: the captures show its logo, which is not reproduced. */
  publisher: string;
  headline: string;
  /** A paragraph under the headline; only a story laid out beside its picture shows it. */
  summary?: string;
  /** How long ago the story was published, as the feed writes it. */
  age: string;
  /** The symbols the story is about: it leads the stories of their detail views. */
  symbols?: readonly string[];
  /** The story's page, which its headline opens in a new tab. */
  url?: string;
}

/** One state of the app: the watchlist's quotes and the business news beside them. */
export interface StocksMarket {
  quotes: readonly StockQuote[];
  /** How much of the session has passed, from 0 to 1: how far the sparklines reach. */
  progress: number;
  /** The feed in order. The first story is the lead. */
  stories: readonly StockStory[];
  /** The lead's layout: over the column's whole width, or a picture with the text beside it. */
  leadLayout: "lead" | "beside";
  /** How many stories after the lead are cards with a picture above; the rest are compact. */
  cards: number;
}

/** A number from a text, to seed what is computed for a symbol. */
function seedOf(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

/** A repeatable sequence of numbers from 0 to 1 (mulberry32). */
function sequence(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * A session from the previous close to the last price: it opens near the close, moves against
 * the day's direction in its first tenth, as every sparkline of the captures does, and then
 * works its way to the last price.
 */
function session(symbol: string, price: number, change: number, points = 40): number[] {
  const next = sequence(seedOf(symbol));
  const previous = price - change;
  const swing = Math.max(Math.abs(change), price * 0.002);
  // Each symbol turns at its own moment and rolls at its own pace.
  const turn = 0.06 + next() * 0.08;
  const pace = 2 + next() * 3;
  const phase = next() * Math.PI * 2;
  const prices: number[] = [];
  for (let index = 0; index < points; index++) {
    const t = index / (points - 1);
    const drift = previous + change * Math.min(1, t / 0.6) ** 0.8;
    const dip = -Math.sign(change || 1) * swing * 0.9 * Math.exp(-(((t - turn) / 0.06) ** 2));
    const roll = Math.sin(phase + t * pace * Math.PI) * swing * 0.22 * Math.sin(Math.PI * t);
    const noise = (next() - 0.5) * swing * 0.45;
    prices.push(round(drift + dip + roll + noise));
  }
  prices[points - 1] = price;
  return prices;
}

function quote(
  symbol: string,
  name: string,
  price: number,
  change: number,
  marketCap?: string,
): StockQuote {
  return { symbol, name, price, change, marketCap, session: session(symbol, price, change) };
}

/** The session of a quote that has run for `progress` of the day: the part up to its price. */
const partial = (full: StockQuote): StockQuote => ({
  ...full,
  // The walk has made most of the day's change by then; a shorter day ends on the price.
  session: [...full.session.slice(0, 18), full.price],
});

const STORIES = {
  settlement: {
    id: "settlement",
    publisher: "Fox Business",
    headline: "MGM Resorts to pay up to $800 million in Vegas massacre settlement",
    age: "1h ago",
  },
  fed: {
    id: "fed",
    publisher: "CNBC",
    headline: "Stocks rise on hopes the Fed will cut rates again",
    age: "56m ago",
    symbols: ["Dow Jones", "S&P 500", "AAPL", "HD"],
  },
  medicare: {
    id: "medicare",
    publisher: "Politico",
    headline: "Trump expands private Medicare coverage in new executive order",
    age: "56m ago",
    symbols: ["BRK-B"],
  },
  // The captures cut the next two headlines off after a few words; the rest is the demo's.
  audits: {
    id: "audits",
    publisher: "ProPublica",
    headline: "IRS: Sorry, but it’s just easier and cheaper to audit the poor",
    age: "2h ago",
  },
  airline: {
    id: "airline",
    publisher: "MarketWatch",
    headline: "Delta’s stock slips after the airline trims its outlook",
    age: "2h ago",
    symbols: ["BA", "GE"],
  },
  jobs: {
    id: "jobs",
    publisher: "MarketWatch",
    headline:
      "Stock market jumps to Friday peak after modest job gains, unemployment falls to 50-year low",
    summary:
      "Stocks rise Friday after a September jobs report showed steady employment gains, but left open the door for further central-bank stimulus.",
    age: "28m ago",
    symbols: ["Dow Jones", "S&P 500", "NKE", "SBUX", "DIS"],
  },
  payrolls: {
    id: "payrolls",
    publisher: "Bloomberg",
    headline: "U.S. payrolls, wages miss estimates in new sign of downshift",
    age: "28m ago",
    symbols: ["GE", "BA"],
  },
  repo: {
    id: "repo",
    publisher: "The Wall Street Journal",
    headline: "New York Fed adds about $38.55 billion to financial system",
    age: "28m ago",
    symbols: ["BRK-B"],
  },
  // The Dark Aqua capture shows only the pictures of its last two stories; the stories are the demo's.
  hiring: {
    id: "hiring",
    publisher: "Reuters",
    headline: "Where the jobs were in September, sector by sector",
    age: "41m ago",
    symbols: ["HD", "SBUX", "NKE"],
  },
  steel: {
    id: "steel",
    publisher: "Associated Press",
    headline: "Factory orders ease as steel shipments slow",
    age: "1h ago",
    symbols: ["GE", "BA"],
  },
} satisfies Record<string, StockStory>;

/**
 * The market of the Aqua capture, which the demo opens on: a finished session, every symbol
 * up but Disney, and three stories with two more cut off by the window's edge.
 */
export const lightMarket: StocksMarket = {
  quotes: [
    quote("Dow Jones", "Dow Jones Industrial Average", 26201.04, 122.42),
    quote("S&P 500", "S&P 500", 2910.63, 23.02),
    quote("AAPL", "Apple Inc.", 220.82, 1.86, "997.9B"),
    quote("BA", "The Boeing Company", 372.07, 4.71, "209.4B"),
    quote("BRK-B", "Berkshire Hathaway Inc.", 204.98, 1.88, "501.2B"),
    quote("DIS", "The Walt Disney Company", 128.15, -0.99, "230.9B"),
    quote("GE", "General Electric Company", 8.71, 0.2, "76.0B"),
    quote("HD", "The Home Depot, Inc.", 226.81, 1.26, "248.4B"),
    quote("NKE", "NIKE, Inc.", 92.22, 0.73, "144.1B"),
    quote("SBUX", "Starbucks Corporation", 84.67, 0.35, "101.3B"),
  ],
  progress: 1,
  stories: [STORIES.settlement, STORIES.fed, STORIES.medicare, STORIES.audits, STORIES.airline],
  leadLayout: "lead",
  cards: 2,
};

/**
 * The market of the Dark Aqua capture: the next morning, less than half a session in, General
 * Electric down, and a feed whose lead has its text beside the picture.
 */
export const darkMarket: StocksMarket = {
  quotes: [
    quote("Dow Jones", "Dow Jones Industrial Average", 26428.87, 227.83),
    quote("S&P 500", "S&P 500", 2936.49, 25.86),
    quote("AAPL", "Apple Inc.", 225.99, 5.17, "1.02T"),
    quote("BA", "The Boeing Company", 374.76, 2.69, "210.9B"),
    quote("BRK-B", "Berkshire Hathaway Inc.", 206.68, 1.7, "505.4B"),
    quote("DIS", "The Walt Disney Company", 129.62, 1.47, "233.5B"),
    quote("GE", "General Electric Company", 8.63, -0.08, "75.3B"),
    quote("HD", "The Home Depot, Inc.", 229.06, 2.25, "250.9B"),
    quote("NKE", "NIKE, Inc.", 92.49, 0.27, "144.5B"),
    quote("SBUX", "Starbucks Corporation", 85.74, 1.07, "102.6B"),
  ].map(partial),
  progress: 0.44,
  stories: [STORIES.jobs, STORIES.payrolls, STORIES.repo, STORIES.hiring, STORIES.steel],
  leadLayout: "beside",
  cards: 4,
};

const PRICE = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** A price as the watchlist writes it: "26,201.04". */
export const formatPrice = (price: number): string => PRICE.format(price);

/** A change with its sign: "+122.42", "-0.99". */
export const formatChange = (change: number): string =>
  `${change < 0 ? "-" : "+"}${PRICE.format(Math.abs(change))}`;

/** The change as a share of the previous close: "+0.47%". */
export const formatPercent = ({ price, change }: Pick<StockQuote, "price" | "change">): string =>
  `${formatChange((change / (price - change)) * 100)}%`;

export const directionOf = (stock: Pick<StockQuote, "change">): "gain" | "loss" =>
  stock.change < 0 ? "loss" : "gain";

/** What a row's badge says in a mode. An index has no market capitalisation: it keeps the percentage. */
export function badgeText(stock: StockQuote, mode: BadgeMode): string {
  if (mode === "change") return formatChange(stock.change);
  if (mode === "cap" && stock.marketCap) return stock.marketCap;
  return formatPercent(stock);
}

/** The mode after a mode, in the order a click on a badge goes through them. */
export const nextBadgeMode = (mode: BadgeMode): BadgeMode =>
  mode === "change" ? "percent" : mode === "percent" ? "cap" : "change";

const MODE_NAMES: Record<BadgeMode, string> = {
  change: "price change",
  percent: "percent change",
  cap: "market cap",
};

/** The accessible name of a row's badge: what it says, and what a click will show. */
export const badgeLabel = (stock: StockQuote, mode: BadgeMode): string =>
  `${badgeText(stock, mode)}, show ${MODE_NAMES[nextBadgeMode(mode)]}`;

/** Whether a quote matches what is typed in the search field: a part of its symbol or name. */
export function matchesQuery(stock: StockQuote, query: string): boolean {
  const wanted = query.trim().toLowerCase();
  return (
    wanted === "" ||
    stock.symbol.toLowerCase().includes(wanted) ||
    stock.name.toLowerCase().includes(wanted)
  );
}

/** How many prices a range's chart has, and how far back the price may have been. */
const RANGE_SHAPE: Record<Exclude<StockRange, "1D">, readonly [points: number, reach: number]> = {
  "1W": [35, 0.03],
  "1M": [44, 0.06],
  "3M": [60, 0.1],
  "6M": [72, 0.16],
  "1Y": [90, 0.24],
  "2Y": [104, 0.36],
};

/** The prices a range's chart draws, oldest first; the last is the quote's price. */
export function history(stock: StockQuote, range: StockRange): readonly number[] {
  if (range === "1D") return stock.session;
  const [points, reach] = RANGE_SHAPE[range];
  const next = sequence(seedOf(`${stock.symbol}/${range}`));
  // Where the range starts, between a `reach` below the price and a third of that above it.
  const start = stock.price * (1 - reach + next() * reach * 1.33);
  const prices: number[] = [];
  let wander = 0;
  for (let index = 0; index < points; index++) {
    const t = index / (points - 1);
    wander = (wander + (next() - 0.5) * stock.price * reach * 0.22) * 0.93;
    prices.push(round(start + (stock.price - start) * t + wander * Math.sin(Math.PI * t) ** 0.5));
  }
  prices[points - 1] = stock.price;
  return prices;
}

/** The labels under a range's chart, from its start to now. */
export const RANGE_LABELS: Record<StockRange, readonly string[]> = {
  "1D": ["10 AM", "12 PM", "2 PM", "4 PM"],
  "1W": ["Mon", "Tue", "Wed", "Thu", "Fri"],
  "1M": ["Week 1", "Week 2", "Week 3", "Week 4"],
  "3M": ["Aug", "Sep", "Oct"],
  "6M": ["May", "Jul", "Sep"],
  "1Y": ["Oct", "Jan", "Apr", "Jul"],
  "2Y": ["2017", "2018", "2019"],
};

/** What a range is called when the chart is described. */
export const RANGE_NAMES: Record<StockRange, string> = {
  "1D": "today",
  "1W": "past week",
  "1M": "past month",
  "3M": "past 3 months",
  "6M": "past 6 months",
  "1Y": "past year",
  "2Y": "past 2 years",
};

/** The figures under the chart of the detail view, as label and value. */
export function statistics(stock: StockQuote): readonly (readonly [string, string])[] {
  if (stock.figures) return stock.figures;
  const next = sequence(seedOf(`${stock.symbol}/figures`));
  const year = history(stock, "1Y");
  // A market may give a quote no session yet: its price then stands for the day's range.
  const day = stock.session.length > 0 ? stock.session : [stock.price];
  const low = (prices: readonly number[]) => prices.reduce((a, b) => Math.min(a, b));
  const high = (prices: readonly number[]) => prices.reduce((a, b) => Math.max(a, b));
  const volume = stock.marketCap
    ? `${(2 + next() * 28).toFixed(1)}M`
    : `${(180 + next() * 240).toFixed(0)}M`;
  return [
    ["Open", formatPrice(day[0] ?? stock.price)],
    ["High", formatPrice(high(day))],
    ["Low", formatPrice(low(day))],
    ["Vol", volume],
    ["P/E", stock.marketCap ? (9 + next() * 24).toFixed(2) : "—"],
    ["Mkt Cap", stock.marketCap ?? "—"],
    ["52W H", formatPrice(Math.max(high(year), high(day)))],
    ["52W L", formatPrice(Math.min(low(year), low(day)))],
  ];
}

/** A company's name without what every listing adds: "Apple Inc." is written "Apple" in a headline. */
function plainCompanyName(name: string): string {
  return name
    .replace(/^the\s+/i, "")
    .replace(
      /[,.]?\s+(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|llc|lp|sa|nv|ag|holdings?|group|class\s+[a-c]|common\s+stock)\b\.?/gi,
      "",
    )
    .trim();
}

/** Whether a story's headline or summary names the symbol, or the company it stands for. */
export function storyNames(story: StockStory, symbol: string, company?: string): boolean {
  const words = `${story.headline} ${story.summary ?? ""}`;
  const word = (text: string, flags: string) =>
    new RegExp(
      `(^|[^\\p{L}\\p{N}])${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`,
      flags,
    ).test(words);
  const name = company ? plainCompanyName(company) : "";
  return word(symbol, "u") || (name.length > 2 && word(name, "iu"));
}

/**
 * The stories of a symbol's detail view, four in all: those about it first, in the feed's order,
 * then the rest of the feed. A story is about it when the feed says so (`symbols`) or names the
 * symbol or the company.
 */
export function storiesFor(
  symbol: string,
  stories: readonly StockStory[],
  company?: string,
): StockStory[] {
  const about = stories.filter(
    (story) => story.symbols?.includes(symbol) || storyNames(story, symbol, company),
  );
  const others = stories.filter((story) => !about.includes(story));
  return [...about, ...others].slice(0, 4);
}

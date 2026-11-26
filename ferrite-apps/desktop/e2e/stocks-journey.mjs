#!/usr/bin/env node
// Stocks on Ferrite: the watchlist's quotes, charts and business news come from
// the module, which fetches them from CNBC through the application's declared
// egress; a symbol found by the search is added to the person's watchlist; a
// price alert set on it fires on the server; after a reload the watchlist and
// the fired alert are still there; the watchlist is reordered with Share > Move
// Down, Option-Up Arrow and a drag, each order saved and kept after a reload,
// and another browser has none of it; the Share menu removes the symbol again.
// Needs `ferrite dev --egress allow`. Exits 0 only when every step passed and
// the page logged no console error, page error, failed request or HTTP error.
// It runs in a fresh browser signed in as Guest User (journey-kit's openDesktop), so the
// watchlist and alerts it changes are that new guest's own, never a person's.
//
//   ferrite dev --egress allow                        # in ferrite-apps/desktop
//   node e2e/stocks-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                               [--browser chromium|chrome|firefox|webkit]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const URLS = {
  quotes: "/api/stocks/quotes",
  chart: "/api/stocks/chart",
  news: "/api/stocks/news",
  watchlist: "/api/stocks/watchlist",
  alerts: "/api/stocks/alerts",
};
const ADDED = "TSLA";
const { base, out, browserName } = options();
const { step, run } = journey("stocks");

/** The next answer to a GET of `pathname` whose query passes `accept`. A wait that is never
 * met rejects without crashing the run, so the journey reports the step that failed. */
const next = (page, pathname, accept = () => true, method = "GET") => {
  const waiting = page.waitForResponse(
    (response) => {
      const url = new URL(response.url());
      return (
        response.request().method() === method &&
        url.pathname === pathname &&
        accept(url.searchParams)
      );
    },
    { timeout: 20_000 },
  );
  waiting.catch(() => {});
  return waiting;
};

/** The page's requests under way, its streams (the live ones, `ferrite dev`'s reload) aside. */
const underWay = new Set();
function countRequests(page) {
  page.on("request", (request) => {
    if (!/^\/(live|__forge)\//.test(new URL(request.url()).pathname)) underWay.add(request);
  });
  for (const end of ["requestfinished", "requestfailed"])
    page.on(end, (request) => underWay.delete(request));
}

/** Wait for the page's requests to end: a reload would abort them, and the watch counts that. A
 * request still open after 20 s is left for the watch to report. */
async function settled(page) {
  for (let waited = 0; underWay.size > 0 && waited < 20_000; waited += 100)
    await page.waitForTimeout(100);
}

async function openStocks(page, quoted = next(page, URLS.quotes)) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Stocks");
  await field.press("Enter");
  const window = page.getByRole("region", { name: "Stocks", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  return { window, quoted };
}

const row = (window, symbol) =>
  window.getByRole("button", { name: new RegExp(`^${symbol.replace(".", "\\.")}\\b`) }).first();

/** Reload and open Stocks. A window open before the reload comes back by itself and asks for its
 * quotes during the reload, so the wait starts first; `accept` tells that answer from one the page
 * asked for before the change it is waiting to see. */
async function reloadAndOpen(page, accept) {
  await settled(page);
  const quoted = next(page, URLS.quotes, accept);
  await reloadDesktop(page);
  return openStocks(page, quoted);
}

const asksFor = (symbol) => (query) => (query.get("symbols") ?? "").split(",").includes(symbol);

/** The symbols the watchlist lists, top to bottom. */
const listed = (window) =>
  window.locator('[aria-label="Symbols"] .mac-stock-row-symbol').allTextContents();

/** Drag `symbol`'s watchlist row onto `target`'s, with a real mouse. */
async function dragOnto(window, symbol, target) {
  const rowOf = (wanted) =>
    window
      .locator(".mac-stock-row")
      .filter({
        has: window.page().locator(".mac-stock-row-symbol", {
          hasText: new RegExp(`^${wanted.replace(/[.^]/g, "\\$&")}$`),
        }),
      })
      .first();
  await rowOf(symbol).dragTo(rowOf(target));
}

const LIBRARY = "/api/app-store/library";

/** Get `id` from the App Store (it does not come with the desktop); answers the list to restore. */
async function install(page, id) {
  const library = await api(page, "GET", LIBRARY);
  const before = library.json.installed;
  const installed = [...new Set([...(before ?? []), id])];
  await api(page, "PUT", LIBRARY, { installed, rev: library.json.rev });
  await settled(page);
  await reloadDesktop(page);
  return before;
}

/** Put the App Store library back as it was. */
async function restore(page, before) {
  const library = await api(page, "GET", LIBRARY);
  if (before === null || before === undefined) await api(page, "DELETE", LIBRARY);
  else await api(page, "PUT", LIBRARY, { installed: before, rev: library.json.rev });
}

/** The prices the window's detail chart draws, read back from its line's geometry: each
 * point's height inverted through the chart's own scale (its top and bottom labels). */
async function drawnPrices(window) {
  return window.locator(".mac-stocks-chart").evaluate((figure) => {
    const svg = figure.querySelector("svg");
    const line = figure.querySelector(".mac-stocks-chart-line");
    const scale = [...figure.querySelectorAll(".mac-stocks-chart-scale span")].map((span) =>
      Number(span.textContent.replace(/[^0-9.-]/g, "")),
    );
    if (!svg || !line || scale.length < 3) return [];
    const height = svg.viewBox.baseVal.height;
    const [high, , low] = scale;
    return line
      .getAttribute("points")
      .trim()
      .split(/\s+/)
      .map((pair) => Number(pair.split(",")[1]))
      .map((y) => high - ((y - 4) / (height - 8)) * (high - low));
  });
}

/** Whether the drawn chart is the answer's prices: as many points, the last and the extremes
 * within a cent and a half of the answer's (the scale labels are rounded to cents). */
function drawnMatches(drawn, points) {
  const prices = points.map(([, price]) => price);
  if (drawn.length !== prices.length || drawn.length < 2) return false;
  const near = (a, b) => Math.abs(a - b) <= Math.max(0.015, Math.abs(b) * 0.0005);
  return (
    near(drawn.at(-1), prices.at(-1)) &&
    near(Math.max(...drawn), Math.max(...prices)) &&
    near(Math.min(...drawn), Math.min(...prices))
  );
}

await run(async (page) => {
  countRequests(page);
  await openDesktop(page, base, step);
  const fresh = await api(page, "GET", URLS.watchlist);
  step(
    "the journey's guest desktop starts with no saved watchlist",
    fresh.status === 200 && fresh.json.symbols === null,
  );
  const library = await install(page, "stocks");

  const news = next(page, URLS.news);
  let { window, quoted } = await openStocks(page);
  const quotes = await (await quoted).json();
  step(
    "the module answers real quotes for the starting watchlist",
    quotes.source === "CNBC" &&
      quotes.quotes?.length === 4 &&
      quotes.quotes.every((q) => q.price > 0 && typeof q.name === "string"),
    quotes.quotes?.map((q) => `${q.symbol} ${q.price}`).join(", "),
  );
  await row(window, "AAPL").waitFor({ timeout: 10_000 });
  const stories = await (await news).json();
  const lead = stories.stories?.[0];
  step(
    "Business News is the provider's real feed, each headline a link to its story",
    lead?.url?.startsWith("https://") &&
      (await window.getByRole("link", { name: lead.headline }).first().getAttribute("href")) ===
        lead.url,
    lead?.headline,
  );
  step(
    "the footer says where the quotes come from",
    (await window.getByText(/^Quotes from CNBC/).count()) === 1,
  );
  await shot(page, path.join(out, `stocks-news-${browserName}.png`));

  const day = next(page, URLS.chart, (q) => q.get("symbol") === "AAPL" && q.get("range") === "1D");
  // Every answer for AAPL's day chart: the window asks again (the sparkline, the minute's poll),
  // and while the market is open a later answer may hold one more point than the first.
  const dayAnswers = [];
  const hearDay = (response) => {
    const url = new URL(response.url());
    if (
      url.pathname !== URLS.chart ||
      url.searchParams.get("symbol") !== "AAPL" ||
      url.searchParams.get("range") !== "1D"
    )
      return;
    response.json().then(
      (body) => dayAnswers.push(body.points ?? []),
      () => {},
    );
  };
  page.on("response", hearDay);
  await row(window, "AAPL").click();
  const aapl = quotes.quotes.find((q) => q.symbol === "AAPL");
  await window.getByText("P/E").waitFor({ timeout: 10_000 });
  const figures = await window.locator(".mac-stocks-figures").innerText();
  step(
    "the detail view shows the provider's figures",
    aapl !== undefined && figures.includes(`P/E\n${aapl.pe || "—"}`),
    figures.replaceAll("\n", " "),
  );
  const dayPoints = (await (await day).json()).points ?? [];
  await window.getByRole("img", { name: /^AAPL, today: from / }).waitFor({ timeout: 10_000 });
  const dayDrawn = await drawnPrices(window);
  page.off("response", hearDay);
  // The chart drawn is one of the module's answers: the first, or a later one.
  const drawnFrom = [...dayAnswers, dayPoints]
    .reverse()
    .find((points) => points.length > 10 && drawnMatches(dayDrawn, points));
  step(
    "the day's chart draws the session's prices the module answered",
    drawnFrom !== undefined,
    `${dayAnswers.length} answer(s), first ${dayPoints.length} points; drawn ${dayDrawn.length}, last ${dayDrawn.at(-1)?.toFixed(2)} vs ${drawnFrom?.at(-1)?.[1]}`,
  );
  const year = next(page, URLS.chart, (q) => q.get("symbol") === "AAPL" && q.get("range") === "1Y");
  await window
    .getByRole("radio", { name: "1Y" })
    .or(window.getByRole("button", { name: "1Y" }))
    .first()
    .click();
  const yearPoints = (await (await year).json()).points ?? [];
  const spanDays =
    yearPoints.length > 1 ? (yearPoints.at(-1)[0] - yearPoints[0][0]) / 86_400_000 : 0;
  await window.getByRole("img", { name: /^AAPL, past year: from / }).waitFor({ timeout: 10_000 });
  const yearDrawn = await drawnPrices(window);
  step(
    "the year's chart spans about a year and draws the prices the module answered",
    yearPoints.length > 100 && spanDays > 300 && drawnMatches(yearDrawn, yearPoints),
    `${yearPoints.length} points over ${Math.round(spanDays)} days; drawn ${yearDrawn.length}`,
  );
  await shot(page, path.join(out, `stocks-detail-${browserName}.png`));

  // Search for a company and add it.
  await window.getByRole("searchbox", { name: "Search" }).fill("tesla");
  const saved = next(page, URLS.watchlist, () => true, "PUT");
  await window.getByRole("button", { name: `Add ${ADDED}`, exact: true }).click();
  const put = await saved;
  step(
    "Add saves the symbol in the person's watchlist",
    put.status() === 200 && (await put.json()).symbols?.includes(ADDED),
  );

  // An alert that fires at once: above 1.00.
  await window.getByRole("combobox", { name: "Alert when the price is" }).click();
  await page.getByRole("option", { name: "Above" }).click();
  await window.getByRole("textbox", { name: "Alert price" }).fill("1");
  const alertSaved = next(page, URLS.alerts, () => true, "PUT");
  await window.getByRole("button", { name: "Add Alert" }).click();
  step("the alert is saved", (await alertSaved).status() === 200);
  const checked = await api(page, "GET", URLS.alerts);
  const fired = checked.json.alerts?.find((a) => a.symbol === ADDED)?.fired;
  step(
    "the server fires the alert against the real quote",
    fired?.price > 1,
    fired ? `fired at ${fired.price}` : "not fired",
  );

  ({ window, quoted } = await reloadAndOpen(page, asksFor(ADDED)));
  const again = await (await quoted).json();
  step(
    "after a reload the watchlist holds the added symbol",
    again.quotes?.some((q) => q.symbol === ADDED),
  );
  await row(window, ADDED).click();
  await window.getByText(/^Above 1\.00: reached /).waitFor({ timeout: 15_000 });
  step("and its detail view shows the fired alert", true);
  await shot(page, path.join(out, `stocks-alert-${browserName}.png`));

  // ── Reorder the watchlist: each control saves the new order in the person's watchlist ──
  let ordered = next(page, URLS.watchlist, () => true, "PUT");
  await row(window, ".DJI").click();
  await window.getByRole("button", { name: "Share" }).click();
  await page.getByRole("menuitem", { name: "Move Down" }).click();
  const afterMove = await (await ordered).json();
  step(
    "Share > Move Down moves the symbol shown one place down, and saves the order",
    JSON.stringify(afterMove.symbols?.slice(0, 2)) === JSON.stringify([".SPX", ".DJI"]) &&
      JSON.stringify(await listed(window)) === JSON.stringify(afterMove.symbols),
    JSON.stringify(afterMove.symbols),
  );
  ordered = next(page, URLS.watchlist, () => true, "PUT");
  await row(window, "AAPL").focus();
  await page.keyboard.press("Alt+ArrowUp");
  const afterKey = await (await ordered).json();
  step(
    "Option-Up Arrow on a row moves it one place up, and saves the order",
    afterKey.symbols?.indexOf("AAPL") === afterMove.symbols.indexOf("AAPL") - 1 &&
      JSON.stringify(await listed(window)) === JSON.stringify(afterKey.symbols),
    JSON.stringify(afterKey.symbols),
  );
  ordered = next(page, URLS.watchlist, () => true, "PUT");
  await dragOnto(window, ADDED, afterKey.symbols[0]);
  const afterDrag = await (await ordered).json();
  step(
    "a row dragged onto the first takes its place, and the order is saved",
    afterDrag.symbols?.[0] === ADDED &&
      JSON.stringify(await listed(window)) === JSON.stringify(afterDrag.symbols),
    JSON.stringify(afterDrag.symbols),
  );
  ({ window, quoted } = await reloadAndOpen(page, asksFor(ADDED)));
  await row(window, ADDED).waitFor({ timeout: 10_000 });
  const keptOrder = await api(page, "GET", URLS.watchlist);
  const drawnOrder = await listed(window);
  step(
    "after a reload the watchlist is stored and drawn in the order it was given",
    JSON.stringify(keptOrder.json.symbols) === JSON.stringify(afterDrag.symbols) &&
      JSON.stringify(drawnOrder) === JSON.stringify(afterDrag.symbols),
    JSON.stringify(drawnOrder),
  );
  await shot(page, path.join(out, `stocks-order-${browserName}.png`));
  const otherContext = await page.context().browser().newContext();
  try {
    const other = await otherContext.newPage();
    await openDesktop(other, base, step);
    const theirs = await api(other, "GET", URLS.watchlist);
    step(
      "another browser (another person) has no watchlist of this one's",
      theirs.status === 200 && theirs.json.symbols === null,
      JSON.stringify(theirs.json.symbols),
    );
  } finally {
    await otherContext.close();
  }
  await row(window, ADDED).click();

  const removed = next(page, URLS.watchlist, () => true, "PUT");
  await window.getByRole("button", { name: "Share" }).click();
  await page.getByRole("menuitem", { name: "Remove from Watchlist" }).click();
  const removal = await removed;
  const stored = await api(page, "GET", URLS.watchlist);
  step(
    "Remove from Watchlist takes it off the person's stored watchlist",
    removal.status() === 200 &&
      stored.status === 200 &&
      Array.isArray(stored.json.symbols) &&
      !stored.json.symbols.includes(ADDED),
    JSON.stringify(stored.json.symbols),
  );
  ({ window, quoted } = await reloadAndOpen(page, (query) => !asksFor(ADDED)(query)));
  const reopened = await (await quoted).json();
  await row(window, "AAPL").waitFor({ timeout: 10_000 });
  step(
    "and after a reload Stocks no longer lists it",
    !reopened.quotes?.some((q) => q.symbol === ADDED) && (await row(window, ADDED).count()) === 0,
  );

  const forgot = await api(page, "DELETE", URLS.watchlist);
  const forgotAlerts = await api(page, "DELETE", URLS.alerts);
  step(
    "the journey's guest forgets its watchlist and alerts",
    forgot.status === 200 && forgotAlerts.status === 200,
  );
  await restore(page, library);
});

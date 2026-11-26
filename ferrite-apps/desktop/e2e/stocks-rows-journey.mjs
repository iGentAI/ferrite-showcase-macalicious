#!/usr/bin/env node
// Stocks's rows of the inventory that had no picture of their own: the Stocks and File menus' dimmed
// rows, the watchlist with its sparklines and badge, Business News, a symbol's chart, ranges and
// figures, search and add, price alerts and their notification, Back, Share, the footer, Escape,
// reordering, and the saved watchlist and alerts. CNBC reached through the server may answer 502 from
// this sandbox: each step that needs a quote says so in its detail when there was none.
//
//   node e2e/stocks-rows-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, closeMenus, menuItemState, until } from "./media-census-kit.mjs";
import { openWithSpotlight } from "./system-kit.mjs";

const WATCHLIST = "/api/stocks/watchlist";
const ALERTS = "/api/stocks/alerts";
const QUOTES = "/api/stocks/quotes";
const NEWS = "/api/stocks/news";
const LIBRARY = "/api/app-store/library";
const { base, out } = options();
const { step, run, expectRefusal } = journey("stocks-rows", {
  ignoreOtherOrigins: true,
  contextOptions: { chromium: { permissions: ["clipboard-read", "clipboard-write"] } },
});

for (let answer = 0; answer < 60; answer += 1) {
  for (const route of ["quotes", "chart", "news", "search"])
    expectRefusal(502, `/api/stocks/${route}`);
}

const settled = async (page, name) => {
  await page.waitForTimeout(450);
  await shot(page, path.join(out, name));
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const rowOf = (window, symbol) => window.locator(`.mac-stock-row[data-symbol="${symbol}"]`);
const rowButton = (window, symbol) => rowOf(window, symbol).locator("button.mac-stock-row-main");
const listed = (window) =>
  window.locator('[aria-label="Symbols"] .mac-stock-row-symbol').allTextContents();
const saved = async (page) => (await api(page, "GET", WATCHLIST)).json.symbols;
const alertsOf = async (page) => (await api(page, "GET", ALERTS)).json.alerts ?? [];
const titleOf = (window) => window.locator(".mac-stocks-pane h2").first();
const menuTitle = (page, title) =>
  page.getByRole("menubar").first().getByRole("menuitem", { name: title, exact: true }).first();

/** Waits for what the page is reading to end, so a reload aborts none of it. */
function requestsUnderWay(page) {
  const open = new Set();
  page.on("request", (request) => {
    if (!/^\/(live|__forge)\//.test(new URL(request.url()).pathname)) open.add(request);
  });
  for (const end of ["requestfinished", "requestfailed"])
    page.on(end, (request) => open.delete(request));
  return () => until(async () => open.size === 0, 30_000);
}

async function openStocks(page) {
  await openWithSpotlight(page, "Stocks");
  const window = page.getByRole("region", { name: "Stocks", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 20_000 });
  await rowOf(window, "AAPL").waitFor({ timeout: 20_000 });
  return window;
}

await run(async (page) => {
  const quiet = requestsUnderWay(page);
  await openDesktop(page, base, step);
  const held = (await api(page, "GET", LIBRARY)).json;
  await api(page, "PUT", LIBRARY, {
    installed: [...new Set([...(held.installed ?? []), "find-my", "stocks"])],
    rev: held.rev,
  });
  await quiet();
  await reloadDesktop(page);
  const window = await openStocks(page);

  // ---- What the server can read from CNBC here -------------------------------------------------
  const quoteAnswer = await page.evaluate(
    (url) =>
      fetch(`${url}?symbols=.DJI,.SPX,.IXIC,AAPL`, { credentials: "same-origin" }).then(
        (r) => r.status,
      ),
    QUOTES,
  );
  const newsAnswer = await page.evaluate(
    (url) => fetch(url, { credentials: "same-origin" }).then((r) => r.status),
    NEWS,
  );
  console.log(`note CNBC through the server: quotes ${quoteAnswer}, news ${newsAnswer}`);

  // ---- Dimmed rows ------------------------------------------------------------------------------
  const prefs = await menuItemState(page, "Stocks", "Preferences…");
  step(
    "Stocks > Preferences… is dimmed and says why",
    prefs.disabled && prefs.title === "Stocks has no preferences",
    prefs.title,
  );
  await menuTitle(page, "Stocks").click();
  await page.getByRole("menuitem", { name: "Preferences…" }).waitFor();
  await settled(page, "stocks-rows-app-menu.png");
  await closeMenus(page);
  const newWindow = await menuItemState(page, "File", "New Window");
  step(
    "File > New Window is dimmed and says why",
    newWindow.disabled && /one window/.test(newWindow.title ?? ""),
    newWindow.title,
  );
  await menuTitle(page, "File").click();
  await page.getByRole("menuitem", { name: "New Window" }).waitFor();
  await settled(page, "stocks-rows-file-menu.png");
  await closeMenus(page);

  // ---- The watchlist and Business News ---------------------------------------------------------
  await until(async () => same(await listed(window), [".DJI", ".SPX", ".IXIC", "AAPL"]));
  step(
    "a new watchlist lists the three indexes and Apple",
    same(await listed(window), [".DJI", ".SPX", ".IXIC", "AAPL"]),
  );
  const footer = window.locator(".mac-stocks-footer");
  const quoted = async () => /^Quotes from CNBC/i.test((await footer.innerText()).trim());
  for (let turn = 0; turn < 4 && !(await until(quoted, 25_000)); turn += 1) {
    console.log(`note quotes not read, turn ${turn}: ${await footer.innerText()}`);
    await chooseMenu(page, "View", "Refresh");
  }
  const live = await quoted();
  const footerText = (await footer.innerText()).trim();
  step(
    live
      ? "the footer names the source and the time of the quotes"
      : "the footer says the quotes could not be read",
    live
      ? /^Quotes from CNBC · \d/i.test(footerText)
      : footerText !== "" && !/^Loading quotes/.test(footerText),
    footerText,
  );
  if (!live) {
    console.log(
      "note no quotes: price, sparklines, badge and the fired alert's notification not run",
    );
  }
  if (live) {
    const price = rowOf(window, "AAPL").locator(".mac-stock-row-price");
    await until(async () => /\d/.test(await price.innerText()), 25_000);
    step("a row shows its price", /\d/.test(await price.innerText()), await price.innerText());
    // A row draws its line from two prices or more; the provider can answer one for a symbol.
    const drawn = await window.locator(".mac-stock-row").count();
    const lines = [];
    for (const symbol of [".DJI", ".SPX", ".IXIC", "AAPL"]) {
      const chart = await api(page, "GET", `/api/stocks/chart?symbol=${symbol}&range=1D`);
      if ((chart.json?.points?.length ?? 0) >= 2) lines.push(symbol);
    }
    step(
      "each row with two prices or more has its sparkline of the day",
      await until(
        async () => (await window.locator(".mac-stock-row-sparkline").count()) === lines.length,
        25_000,
      ),
      `${await window.locator(".mac-stock-row-sparkline").count()} sparklines of ${drawn} rows; ${lines}`,
    );
    const badge = rowOf(window, "AAPL").locator(".mac-stock-row-badge");
    const seen = [];
    for (let press = 0; press < 3; press += 1) {
      seen.push((await badge.innerText()).trim());
      await badge.click();
      await page.waitForTimeout(200);
    }
    step(
      "the badge cycles change, percent and market cap, and comes back",
      new Set(seen).size === 3 && /%/.test(seen[1]) && (await badge.innerText()).trim() === seen[0],
      seen.join(" → "),
    );
  } else {
    console.log("note no quotes: the price, sparkline and badge steps were not run");
  }
  const stories = window.locator(".mac-stocks-story");
  if (newsAnswer === 200) {
    await stories.first().waitFor({ timeout: 25_000 });
    step(
      "Business News lists its stories",
      (await stories.count()) > 0,
      `${await stories.count()}`,
    );
  } else {
    console.log("note no news: the Business News steps were not run");
  }
  await settled(page, "stocks-rows-watchlist.png");

  // ---- A symbol: chart, ranges, figures --------------------------------------------------------
  await rowButton(window, "AAPL").click();
  await titleOf(window).filter({ hasText: "AAPL" }).waitFor({ timeout: 10_000 });
  const figures = window.locator(".mac-stocks-figures");
  await figures.waitFor({ timeout: 15_000 });
  const figureText = (await figures.innerText()).replace(/\s+/g, " ");
  step(
    "a symbol's view has its figures",
    /Open/.test(figureText) && /P\/E/.test(figureText) && (!live || /\d/.test(figureText)),
    figureText,
  );
  const ranges = window.getByRole("group", { name: "Range" }).getByRole("button");
  step(
    "the chart offers seven ranges",
    same(await ranges.allInnerTexts(), ["1D", "1W", "1M", "3M", "6M", "1Y", "2Y"]),
  );
  const drew = [];
  const RANGE_WORDS = {
    "1D": "today",
    "1W": "past week",
    "1M": "past month",
    "3M": "past 3 months",
    "6M": "past 6 months",
    "1Y": "past year",
    "2Y": "past 2 years",
  };
  for (const [range, words] of Object.entries(RANGE_WORDS)) {
    await ranges.filter({ hasText: range }).click();
    const chart = window.getByRole("img", { name: /^AAPL, / });
    const shown = window.getByText(/No Chart Data|The chart could not be loaded/).first();
    // This range's own chart, whose description names it, or where no quotes reach here, its refusal.
    const answered = await until(async () => {
      if ((await chart.count()) > 0) {
        return (await chart.getAttribute("aria-label"))?.startsWith(`AAPL, ${words}:`) === true;
      }
      return !live && (await shown.count()) > 0;
    }, 25_000);
    drew.push({ range, answered });
    if (range === "1Y") await settled(page, "stocks-rows-symbol.png");
  }
  step(
    live ? "each of the seven ranges draws its own chart" : "each range says it has no chart",
    drew.length === 7 && drew.every(({ answered }) => answered),
    JSON.stringify(drew),
  );

  // ---- Toolbar Back ----------------------------------------------------------------------------
  const backButton = window.getByRole("button", { name: "Back", exact: true });
  await backButton.click();
  await titleOf(window).filter({ hasText: "Top Stories" }).waitFor({ timeout: 10_000 });
  step(
    "the toolbar's Back goes back to Business News, and is then dimmed",
    await backButton.isDisabled(),
  );

  // ---- Search, Escape, add ---------------------------------------------------------------------
  const search = window.getByRole("searchbox", { name: "Search" });
  await search.click();
  await search.fill("AAP");
  await until(async () => same(await listed(window), ["AAPL"]), 5_000);
  step("search narrows the watchlist", same(await listed(window), ["AAPL"]));
  await page.keyboard.press("Escape");
  step(
    "Escape empties the search field and shows the whole list again",
    (await until(async () => (await search.inputValue()) === "", 3_000)) &&
      (await until(async () => (await listed(window)).length === 4, 3_000)),
    `field "${await search.inputValue()}"`,
  );
  const add = window.getByRole("button", { name: "Add TSLA", exact: true });
  let canAdd = false;
  for (let turn = 0; turn < 3 && !canAdd; turn += 1) {
    await search.fill("");
    await search.fill("tesla");
    canAdd = await add.waitFor({ timeout: 20_000 }).then(
      () => true,
      () => false,
    );
  }
  if (canAdd) {
    await settled(page, "stocks-rows-search.png");
    await add.click();
    step(
      "Add puts the symbol on the watchlist, on the server",
      await until(async () => (await saved(page))?.includes("TSLA"), 15_000),
      JSON.stringify(await saved(page)),
    );
  } else {
    console.log("note no search answer: Add was not run");
    await search.fill("");
    const doc = (await api(page, "GET", WATCHLIST)).json;
    await api(page, "PUT", WATCHLIST, {
      symbols: [".DJI", ".SPX", ".IXIC", "AAPL", "TSLA"],
      rev: doc.rev,
      session: doc.session,
    });
    await quiet();
    await reloadDesktop(page);
  }

  // ---- Reorder with a real drag, kept over a reload ----------------------------------------------
  let stocks = page.getByRole("region", { name: "Stocks", exact: true }).first();
  await rowOf(stocks, "TSLA").waitFor({ timeout: 20_000 });
  await rowOf(stocks, "TSLA").dragTo(rowOf(stocks, ".DJI"));
  step(
    "a row dragged to the top takes that place, on the server",
    await until(async () => (await saved(page))?.[0] === "TSLA", 15_000),
    JSON.stringify(await saved(page)),
  );
  await settled(page, "stocks-rows-reordered.png");

  // ---- Price alerts ----------------------------------------------------------------------------
  await rowButton(stocks, "TSLA").click();
  await titleOf(stocks).filter({ hasText: "TSLA" }).waitFor({ timeout: 10_000 });
  await stocks.getByRole("combobox", { name: "Alert when the price is" }).click();
  await page.getByRole("option", { name: "Above" }).click();
  await stocks.getByRole("textbox", { name: "Alert price" }).fill("1");
  await stocks.getByRole("button", { name: "Add Alert", exact: true }).click();
  step(
    "a price alert is kept on the server",
    await until(async () => (await alertsOf(page)).some((each) => each.symbol === "TSLA"), 15_000),
    JSON.stringify(await alertsOf(page)),
  );
  const fired = await until(
    async () => (await alertsOf(page)).find((each) => each.symbol === "TSLA")?.fired,
    live ? 20_000 : 2_000,
  );
  if (live) step("the server fires it against the real quote", fired);
  else console.log("note no quotes: the alert did not fire here");
  await settled(page, "stocks-rows-alert.png");

  // ---- Share ----------------------------------------------------------------------------------
  const menuItem = (name) => page.getByRole("menuitem", { name, exact: true });
  const share = stocks.getByRole("button", { name: "Share", exact: true });
  await share.click();
  await menuItem("Notes").waitFor({ timeout: 5_000 });
  await settled(page, "stocks-rows-share.png");
  step(
    "Share lists the shared link rows",
    (await menuItem("Mail").count()) === 1 && (await menuItem("Messages").count()) === 1,
  );
  await menuItem("Notes").click();
  const notes = page.getByRole("region", { name: /Notes/ }).first();
  step(
    "Share > Notes puts the symbol's page in a new note",
    await notes.waitFor({ state: "visible", timeout: 15_000 }).then(
      () => until(async () => /cnbc\.com\/quotes\/TSLA/.test(await notes.innerText()), 15_000),
      () => false,
    ),
  );
  await settled(page, "stocks-rows-shared-note.png");
  await page.keyboard.press("ControlOrMeta+KeyW");
  await page.waitForTimeout(500);

  // ---- Saved: order and alerts over a reload ---------------------------------------------------
  const orderBefore = await saved(page);
  await quiet();
  await reloadDesktop(page);
  stocks = page.getByRole("region", { name: "Stocks", exact: true }).first();
  if (!(await stocks.isVisible().catch(() => false))) stocks = await openStocks(page);
  await rowOf(stocks, "TSLA").waitFor({ timeout: 20_000 });
  step(
    "after a reload the watchlist keeps its symbols in their order",
    same(await listed(stocks), orderBefore) && same(await saved(page), orderBefore),
    JSON.stringify(orderBefore),
  );
  await rowButton(stocks, "TSLA").click();
  await stocks.locator(".mac-stocks-alerts").waitFor({ timeout: 10_000 });
  step(
    "and the alert is still listed",
    await until(
      async () =>
        /(Above|above) 1\.00/.test(await stocks.locator(".mac-stocks-alerts").innerText()),
      10_000,
    ),
    (await stocks.locator(".mac-stocks-alerts").innerText()).replace(/\s+/g, " "),
  );
  await settled(page, "stocks-rows-kept.png");

  // ---- Notification Center: the Today widget, and whether a fired alert shows ---------------------
  await page.getByRole("menuitem", { name: "Notification Center", exact: true }).first().click();
  const panel = page.getByRole("complementary", { name: "Notification Center" });
  await panel.waitFor({ timeout: 8_000 });
  await panel.getByRole("tab", { name: "Notifications" }).click();
  const fireLine = panel.getByText("TSLA rose above 1.00").first();
  const inPanel = await fireLine.waitFor({ timeout: 15_000 }).then(
    () => true,
    () => false,
  );
  // An alert at 1.00 fires on any real price of TSLA, so with quotes it must be there.
  if (live) step("a fired alert is in Notification Center", inPanel);
  await settled(page, "stocks-rows-notification.png");
  await panel.getByRole("tab", { name: "Today" }).click();
  const widget = panel.getByRole("region", { name: "Stocks" });
  step(
    "Today's Stocks widget lists the watchlist",
    await widget
      .getByText("TSLA")
      .first()
      .waitFor({ timeout: 20_000 })
      .then(
        () => true,
        () => false,
      ),
    await widget.innerText().catch(() => ""),
  );
  await settled(page, "stocks-rows-widget.png");
  await page.keyboard.press("Escape");
  await panel.waitFor({ state: "detached", timeout: 5_000 });

  // ---- Remove from Share; a story opens in Safari ------------------------------------------------
  await stocks.getByRole("button", { name: "Share", exact: true }).click();
  await menuItem("Remove from Watchlist").click();
  step(
    "Share > Remove from Watchlist removes it on the server",
    await until(async () => !(await saved(page))?.includes("TSLA"), 15_000),
    JSON.stringify(await saved(page)),
  );
  if (newsAnswer === 200) {
    await titleOf(stocks).filter({ hasText: "Top Stories" }).waitFor({ timeout: 10_000 });
    const story = stocks.locator(".mac-stocks-story").first();
    await story.waitFor({ timeout: 25_000 });
    const url = await story.locator("a").first().getAttribute("href");
    await story.locator("a").first().click();
    await stocks
      .getByRole("article", { name: "Story" })
      .getByRole("button", { name: /^Read the Whole Story at / })
      .click();
    const safari = page.getByRole("region", { name: "Safari", exact: true }).first();
    await safari.waitFor({ state: "visible", timeout: 20_000 });
    const address = safari
      .getByRole("combobox", { name: "Search or enter website name" })
      .or(safari.getByRole("textbox", { name: "Search or enter website name" }))
      .first();
    const host = new URL(url).host.replace(/^www\./, "");
    step(
      "a story's headline opens at its publisher in Safari",
      await until(async () => (await address.inputValue()).includes(host), 15_000),
      await address.inputValue(),
    );
    await settled(page, "stocks-rows-safari.png");
  } else {
    console.log("note no news: opening a story in Safari was not run");
  }

  // A part the sources did not answer is coverage not had: not a pass, whoever is to blame.
  const unreached = [
    live ? null : "quotes",
    newsAnswer === 200 ? null : "news",
    canAdd ? null : "search",
  ].filter(Boolean);
  step(
    "every part ran against an answer from CNBC",
    unreached.length === 0,
    unreached.length === 0 ? "quotes, news and search" : `no answer: ${unreached.join(", ")}`,
  );
});

process.exit(0);

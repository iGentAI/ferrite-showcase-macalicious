#!/usr/bin/env node
// Stocks census (R5, round 3): one `ok`/`FAIL` line per census id of Stocks, real input only, against `ferrite dev
// --fresh` serving the packed site, signed in as a real account made at the login window. Stocks is not
// preinstalled: the account gets it from the App Store with the store's own Get and Install buttons. Quotes,
// charts and business news are real (CNBC, through the app's declared egress). When CNBC refuses, Stocks must say
// so; such a row fails with what Stocks shows and the provider curled in the same minute.
//
// Phases: `write` drives every control and leaves a state file; `restart-check` runs after a real same-root
// restart of `ferrite dev` and checks that the watchlist (with its order) and the alerts are kept for the account,
// and that a second account has none of them.
//
//   node e2e/stocks-census-journey.mjs --url http://127.0.0.1:8080 --browser chromium|chrome|firefox|webkit
//        [--phase all|write|restart-check] [--out <dir>] [--headed] [--only <id prefix,...>]

import { execSync } from "node:child_process";
import {
  accountFor,
  api,
  appWindow,
  census,
  closeAppWindow,
  closeMenus,
  crawlMenus,
  getFromAppStore,
  launchBrowser,
  loadState,
  openApp,
  options,
  person,
  reloadDesktop,
  saveState,
  shareLanded,
  shot,
} from "./r5-census-kit.mjs";
import { commonRows } from "./r5-common-rows.mjs";

const opts = options();
const { base, out, browserName, phase } = opts;
const c = census("stocks", opts);
const URLS = {
  quotes: "/api/stocks/quotes",
  chart: "/api/stocks/chart",
  news: "/api/stocks/news",
  watchlist: "/api/stocks/watchlist",
  alerts: "/api/stocks/alerts",
};
const ADDED = "TSLA";
const RANGES = ["1D", "1W", "1M", "3M", "6M", "1Y", "2Y"];
const RANGE_NAMES = {
  "1D": "today",
  "1W": "past week",
  "1M": "past month",
  "3M": "past 3 months",
  "6M": "past 6 months",
  "1Y": "past year",
  "2Y": "past 2 years",
};
const meta = (state, role, name, how, expect, persists = "none") => ({
  state,
  role,
  name,
  how,
  expect,
  persists,
});

const stocks = (page) => appWindow(page, "Stocks");
const listed = (page) =>
  stocks(page).locator('[aria-label="Symbols"] .mac-stock-row-symbol').allTextContents();
const row = (page, symbol) =>
  stocks(page)
    .getByRole("button", { name: new RegExp(`^${symbol.replace(/[.^]/g, "\\$&")}\\b`) })
    .first();
const rowBox = (page, symbol) =>
  stocks(page)
    .locator(".mac-stock-row")
    .filter({
      has: page.locator(".mac-stock-row-symbol", {
        hasText: new RegExp(`^${symbol.replace(/[.^]/g, "\\$&")}$`),
      }),
    })
    .first();
const text = async (page) =>
  (
    await stocks(page)
      .innerText()
      .catch(() => "")
  ).replace(/\s+/g, " ");

/** The next answer of `pathname` whose query passes `accept` (marked handled). */
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
/** CNBC curled now: the in-run evidence a provider failure needs. */
function providerEvidence() {
  try {
    const code = execSync(
      'curl -sS -o /dev/null -w "%{http_code}" --max-time 10 https://quote.cnbc.com/',
      { encoding: "utf8" },
    );
    return `quote.cnbc.com ${code} at ${new Date().toISOString()}`;
  } catch (error) {
    return `quote.cnbc.com unreachable (${String(error.message).split("\n")[0].slice(0, 80)}) at ${new Date().toISOString()}`;
  }
}
async function openStocks(page) {
  const quoted = next(page, URLS.quotes);
  const window = await openApp(page, "Stocks");
  return { window, quoted };
}
const share = async (page) => {
  await stocks(page).getByRole("button", { name: "Share" }).click();
  return page.getByRole("menu").last();
};

async function writePhase(browser, page) {
  const kept = {};
  await c.check(
    "stocks.app-store.get",
    async () => {
      await getFromAppStore(page, "Stocks");
      const library = await api(page, "GET", "/api/app-store/library");
      return {
        ok: library.json?.installed?.includes("stocks"),
        detail: JSON.stringify(library.json?.installed),
      };
    },
    meta(
      "App Store",
      "button",
      "Get, Stocks",
      "App Store: Get, then Install, on Stocks",
      "Stocks is in the account's library and the Dock",
      "restart",
    ),
  );
  const fresh = await api(page, "GET", URLS.watchlist);
  // Stocks loads its business news when it opens (and every ten minutes): hear that answer from the start.
  const newsAnswer = next(page, URLS.news);
  // Every chart answer for AAPL, by range, whenever it comes (the window fetches a range once and keeps it).
  const charts = new Map();
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname !== URLS.chart || url.searchParams.get("symbol") !== "AAPL") return;
    response.json().then(
      (body) => charts.set(url.searchParams.get("range"), body),
      () => {},
    );
  });
  const { quoted } = await openStocks(page);
  const quotes = await (await quoted)?.json().catch(() => ({}));
  kept.stories =
    (await (await newsAnswer.catch(() => null))?.json().catch(() => null))?.stories ?? [];
  await page.waitForTimeout(1_500);
  await c.crawl("window", stocks(page));
  const live = quotes?.quotes?.length > 0 && quotes.quotes.every((q) => q.price > 0);
  const evidence = live ? "" : providerEvidence();

  // ── The watchlist: real quotes from CNBC, or Stocks's honest word ──
  await c.check(
    "stocks.watchlist.quotes",
    async () => {
      if (!live)
        return {
          ok: false,
          detail: `no quotes; Stocks says "${(await text(page)).slice(0, 160)}"; ${evidence}`,
        };
      const symbols = await listed(page);
      return {
        ok:
          fresh.json?.symbols === null &&
          quotes.source === "CNBC" &&
          JSON.stringify(symbols) === JSON.stringify(quotes.quotes.map((q) => q.symbol)),
        detail: quotes.quotes.map((q) => `${q.symbol} ${q.price}`).join(", "),
      };
    },
    meta(
      "window",
      "server",
      "watchlist quotes",
      "open Stocks in a new account",
      "the starting watchlist with CNBC's quotes, in order",
    ),
  );
  await c.check(
    "stocks.footer.source",
    async () => ({
      ok:
        (await stocks(page)
          .getByText(/^Quotes from CNBC/)
          .count()) === 1,
      detail: (await text(page)).match(/Quotes from[^.]*/)?.[0] ?? "",
    }),
    meta(
      "window",
      "text",
      "Quotes from CNBC",
      "read the footer",
      "says where the quotes come from",
    ),
  );
  await c.check(
    "stocks.watchlist.row",
    async () => {
      const symbols = await listed(page);
      if (symbols.length === 0) return { ok: false, detail: `no rows; ${evidence}` };
      const picks = [...new Set([0, Math.floor((symbols.length - 1) / 2), symbols.length - 1])].map(
        (i) => symbols[i],
      );
      const seen = [];
      for (const symbol of picks) {
        await row(page, symbol).click();
        await stocks(page).getByText("P/E").first().waitFor({ timeout: 10_000 });
        const figures = await stocks(page).locator(".mac-stocks-figures").innerText();
        const quote = quotes.quotes.find((q) => q.symbol === symbol);
        seen.push(
          `${symbol}: ${figures.includes("P/E") && (!quote?.pe || figures.includes(quote.pe))}`,
        );
      }
      return { ok: seen.every((s) => s.endsWith("true")), detail: seen.join(", ") };
    },
    meta(
      "window",
      "button",
      "/[.^]?[A-Z]{1,6}(\\.[A-Z]+)? .+ Trending (up|down) .+/",
      "click a watchlist row (the first, a middle and the last)",
      "its detail view with the provider's figures",
    ),
  );
  await c.check(
    "stocks.watchlist.change-toggle",
    async () => {
      const toggle = stocks(page)
        .getByRole("button", { name: /show (percent change|market cap|price change)/ })
        .first();
      const before = (await toggle.getAttribute("aria-label")) ?? (await toggle.innerText());
      await toggle.click();
      const after = (await toggle.getAttribute("aria-label")) ?? (await toggle.innerText());
      // Back to the price change, so the next run starts the same.
      for (
        let i = 0;
        i < 3 && !/show percent change/.test((await toggle.getAttribute("aria-label")) ?? "");
        i += 1
      )
        await toggle.click();
      return { ok: before !== after, detail: `${before} -> ${after}` };
    },
    meta(
      "window",
      "button",
      "/[+−-]?[\\d,.]+%?(, show (percent change|market cap|price change))/",
      "click a row's change figure",
      "every row shows the next measure (change, percent, market cap)",
    ),
  );

  // ── The detail view: ranges, chart drawn from the module's answer, Back ──
  await row(page, "AAPL").click();
  await c.crawl("detail", stocks(page));
  for (const range of RANGES) {
    await c.check(
      `stocks.detail.range-${range.toLowerCase()}`,
      async () => {
        const control = stocks(page)
          .getByRole("radio", { name: range, exact: true })
          .or(stocks(page).getByRole("button", { name: range, exact: true }))
          .first();
        await control.click();
        const checked =
          (await control.getAttribute("aria-checked")) === "true" ||
          (await control.getAttribute("aria-pressed")) === "true" ||
          (await control.getAttribute("aria-selected")) === "true" ||
          (await control.getAttribute("aria-current")) !== null;
        for (let i = 0; i < 80 && !charts.has(range); i += 1) await page.waitForTimeout(250);
        const reply = charts.get(range);
        const chart = stocks(page)
          .getByRole("img", { name: new RegExp(`^AAPL, ${RANGE_NAMES[range]}: from `) })
          .first();
        const drawn = await chart.waitFor({ timeout: 10_000 }).then(
          () => chart.getAttribute("aria-label"),
          () => "",
        );
        const points = reply?.points?.length ?? 0;
        return {
          ok: checked && points > 1 && Boolean(drawn),
          detail: `${points} points in the module's answer; drawn "${drawn}"`,
        };
      },
      meta(
        "detail",
        "button",
        range,
        `in AAPL's detail, click ${range}`,
        "the chart of that range, from the module's prices; the range shown chosen",
      ),
    );
  }

  // ── Share: the link rows, Copy Symbol, Copy Price, Move Up / Down, Remove from Watchlist ──
  await c.check(
    "stocks.toolbar.share",
    async () => {
      const menu = await share(page);
      await c.crawl("share menu", menu);
      const rows = (await menu.getByRole("menuitem").allInnerTexts()).map((r) =>
        r.split("\n")[0].trim(),
      );
      await closeMenus(page);
      return {
        ok: ["Copy Symbol", "Copy Price", "Move Up", "Move Down", "Remove from Watchlist"].every(
          (r) => rows.includes(r),
        ),
        detail: rows.join(" | "),
      };
    },
    meta(
      "detail",
      "button",
      "Share",
      "with a symbol shown, click Share",
      "the Share menu with its rows",
    ),
  );
  const pasteInSearch = async () => {
    const search = stocks(page).getByRole("searchbox", { name: "Search" });
    await search.click();
    await search.fill("");
    await page.keyboard.press("Control+KeyV");
    const pasted = await search.inputValue();
    await search.fill("");
    await row(page, "AAPL").click();
    return pasted;
  };
  await c.check(
    "stocks.share.copy-symbol",
    async () => {
      await (await share(page)).getByRole("menuitem", { name: "Copy Symbol" }).click();
      const pasted = await pasteInSearch();
      return { ok: pasted === "AAPL", detail: `pasted "${pasted}"` };
    },
    meta(
      "share menu",
      "menuitem",
      "Copy Symbol",
      "Share > Copy Symbol, Control+V in the search field",
      "the symbol is on the clipboard",
    ),
  );
  await c.check(
    "stocks.share.copy-price",
    async () => {
      await (await share(page)).getByRole("menuitem", { name: "Copy Price" }).click();
      const pasted = await pasteInSearch();
      return { ok: /^AAPL [\d,.]+$/.test(pasted), detail: `pasted "${pasted}"` };
    },
    meta(
      "share menu",
      "menuitem",
      "Copy Price",
      "Share > Copy Price, Control+V in the search field",
      "the symbol and its price are on the clipboard",
    ),
  );
  await c.check(
    "stocks.share.copy-link",
    async () => {
      await (await share(page)).getByRole("menuitem", { name: "Copy Link" }).click();
      const pasted = await pasteInSearch();
      kept.link = pasted;
      return {
        ok: /^https:\/\/www\.cnbc\.com\/quotes\/AAPL/.test(pasted),
        detail: `pasted "${pasted}"`,
      };
    },
    meta(
      "share menu",
      "menuitem",
      "Copy Link",
      "Share > Copy Link, Control+V in the search field",
      "the symbol's CNBC page is on the clipboard",
    ),
  );
  for (const [key, label] of [
    ["mail", "Mail"],
    ["messages", "Messages"],
    ["notes", "Notes"],
    ["reminders", "Reminders"],
  ]) {
    await c.check(
      `stocks.share.${key}`,
      async () => {
        const item = (await share(page)).getByRole("menuitem", { name: label, exact: true });
        if ((await item.getAttribute("aria-disabled")) === "true") {
          const why = (await item.getAttribute("title")) ?? "";
          await closeMenus(page);
          return { ok: /can’t take a shared link/.test(why), detail: `dimmed: "${why}"` };
        }
        await item.click();
        const aapl = quotes?.quotes?.find((q) => q.symbol === "AAPL");
        const landed = await shareLanded(page, key, {
          title: `AAPL ${aapl?.name ?? "Apple Inc."}`,
          url: kept.link ?? "cnbc.com/quotes/AAPL",
        });
        await shot(page, out, `stocks-share-${key}-${browserName}`);
        await closeAppWindow(page, landed.window).catch(() => {});
        await closeAppWindow(page, label).catch(() => {});
        await openStocks(page);
        await row(page, "AAPL").click();
        return landed;
      },
      meta(
        "share menu",
        "menuitem",
        label,
        `Share > ${label}`,
        `${label} opens with the symbol's link`,
      ),
    );
  }

  // ── Search and add ──
  await c.check(
    "stocks.search.add",
    async () => {
      const search = stocks(page).getByRole("searchbox", { name: "Search" });
      await search.click();
      await page.keyboard.type("tesla", { delay: 30 });
      const add = stocks(page).getByRole("button", { name: `Add ${ADDED}`, exact: true });
      await add.waitFor({ timeout: 15_000 });
      await c.crawl("search results", stocks(page));
      const saved = next(page, URLS.watchlist, () => true, "PUT");
      await add.click();
      const put = await saved;
      const body = await put.json();
      return {
        ok: put.status() === 200 && body.symbols?.includes(ADDED),
        detail: JSON.stringify(body.symbols),
      };
    },
    meta(
      "search",
      "button",
      "/Add [.^]?[A-Z]{1,6}(\\.[A-Z]+)?/",
      'type "tesla" in Search, click Add TSLA',
      "TSLA joins the watchlist, kept on the server",
      "restart",
    ),
  );
  await c.check(
    "stocks.search.no-results",
    async () => {
      const search = stocks(page).getByRole("searchbox", { name: "Search" });
      await search.fill("zzqqxxnotasymbol");
      const none = await stocks(page)
        .getByText("No Results")
        .waitFor({ timeout: 15_000 })
        .then(
          () => true,
          () => false,
        );
      await search.fill("");
      return { ok: none, detail: `"No Results" shown ${none}` };
    },
    meta("search", "searchbox", "Search", "type a name no company has", "No Results"),
  );

  // ── Alerts: add one that fires at once, see it reached; add one and remove it ──
  await row(page, ADDED).click();
  await c.check(
    "stocks.alert.add",
    async () => {
      await stocks(page).getByRole("combobox", { name: "Alert when the price is" }).click();
      await page.getByRole("option", { name: "Above" }).click();
      await stocks(page).getByRole("textbox", { name: "Alert price" }).fill("1");
      const saved = next(page, URLS.alerts, () => true, "PUT");
      await stocks(page).getByRole("button", { name: "Add Alert" }).click();
      const status = (await saved).status();
      const fired = (await api(page, "GET", URLS.alerts)).json?.alerts?.find(
        (a) => a.symbol === ADDED,
      )?.fired;
      let shown = await stocks(page)
        .getByText(/^Above 1\.00: reached /)
        .waitFor({ timeout: 10_000 })
        .then(
          () => true,
          () => false,
        );
      if (!shown) {
        // The window reads its alerts when Stocks opens: open it again and show TSLA.
        await closeAppWindow(page, "Stocks").catch(() => {});
        await openStocks(page);
        await row(page, ADDED).click();
        shown = await stocks(page)
          .getByText(/^Above 1\.00: reached /)
          .waitFor({ timeout: 15_000 })
          .then(
            () => true,
            () => false,
          );
      }
      return {
        ok: status === 200 && fired?.price > 1 && shown,
        detail: `PUT ${status}; fired ${fired?.price}; shown ${shown}`,
      };
    },
    meta(
      "detail",
      "button",
      "Add Alert",
      "choose Above, type 1, click Add Alert",
      "the server fires it against the real quote; the detail says reached",
      "restart",
    ),
  );
  await c.check(
    "stocks.alert.when",
    async () => {
      await stocks(page).getByRole("combobox", { name: "Alert when the price is" }).click();
      await page.getByRole("option").first().waitFor({ timeout: 5_000 });
      const options = (await page.getByRole("option").allInnerTexts()).map((t) => t.trim());
      await page.getByRole("option", { name: "Below" }).click();
      const now = (
        await stocks(page).getByRole("combobox", { name: "Alert when the price is" }).innerText()
      ).trim();
      return {
        ok: options.includes("Above") && options.includes("Below") && /Below/.test(now),
        detail: `${options.join("/")}; now ${now}`,
      };
    },
    meta(
      "detail",
      "combobox",
      "Alert when the price is",
      "open the pop-up, choose Below",
      "Above and Below offered; Below chosen",
    ),
  );
  await c.check(
    "stocks.alert.price-field",
    async () => {
      const field = stocks(page).getByRole("textbox", { name: "Alert price" });
      const addButton = stocks(page).getByRole("button", { name: "Add Alert" });
      await field.fill("abc");
      const refused = await addButton.isDisabled();
      await field.fill("2");
      const accepted = await addButton.isEnabled();
      return {
        ok: refused && accepted,
        detail: `"abc" dims Add Alert ${refused}; "2" enables it ${accepted}`,
      };
    },
    meta(
      "detail",
      "textbox",
      "Alert price",
      "type text, then a price",
      "Add Alert is dimmed for text and enabled for a price",
    ),
  );
  await c.check(
    "stocks.alert.remove",
    async () => {
      const saved = next(page, URLS.alerts, () => true, "PUT");
      await stocks(page).getByRole("button", { name: "Add Alert" }).click();
      await saved;
      const before = (await api(page, "GET", URLS.alerts)).json?.alerts?.length ?? 0;
      const removed = next(page, URLS.alerts, () => true, "PUT");
      await stocks(page)
        .locator(".mac-stocks-alert")
        .filter({ hasText: /Below 2\.00/ })
        .getByRole("button")
        .first()
        .click();
      const status = (await removed).status();
      const after = (await api(page, "GET", URLS.alerts)).json?.alerts ?? [];
      return {
        ok:
          status === 200 &&
          after.length === before - 1 &&
          !after.some((a) => a.when === "below" && a.value === 2),
        detail: `${before} -> ${after.length} alerts`,
      };
    },
    meta(
      "detail",
      "button",
      "/Remove|Delete/",
      "add a Below 2 alert, click its Remove button",
      "the alert leaves the list and the server",
    ),
  );

  // ── Reorder: Share > Move Down / Move Up, Option-Up / Down Arrow, a real drag ──
  const order = async () => (await api(page, "GET", URLS.watchlist)).json?.symbols ?? [];
  await c.check(
    "stocks.share.move-down",
    async () => {
      await row(page, ".DJI").click();
      const saved = next(page, URLS.watchlist, () => true, "PUT");
      const before = await order();
      await (await share(page)).getByRole("menuitem", { name: "Move Down" }).click();
      const after = (await (await saved).json()).symbols;
      return {
        ok:
          after.indexOf(".DJI") === before.indexOf(".DJI") + 1 &&
          JSON.stringify(await listed(page)) === JSON.stringify(after),
        detail: JSON.stringify(after),
      };
    },
    meta(
      "share menu",
      "menuitem",
      "Move Down",
      "show .DJI, Share > Move Down",
      "it moves one place down, the order saved",
      "restart",
    ),
  );
  await c.check(
    "stocks.share.move-up",
    async () => {
      const saved = next(page, URLS.watchlist, () => true, "PUT");
      const before = await order();
      await (await share(page)).getByRole("menuitem", { name: "Move Up" }).click();
      const after = (await (await saved).json()).symbols;
      return {
        ok: after.indexOf(".DJI") === before.indexOf(".DJI") - 1,
        detail: JSON.stringify(after),
      };
    },
    meta(
      "share menu",
      "menuitem",
      "Move Up",
      "Share > Move Up",
      "it moves one place up, the order saved",
    ),
  );
  await c.check(
    "stocks.key.option-up-down",
    async () => {
      const before = await order();
      let saved = next(page, URLS.watchlist, () => true, "PUT");
      await row(page, "AAPL").focus();
      await page.keyboard.press("Alt+ArrowUp");
      const up = (await (await saved).json()).symbols;
      saved = next(page, URLS.watchlist, () => true, "PUT");
      await page.keyboard.press("Alt+ArrowDown");
      const down = (await (await saved).json()).symbols;
      return {
        ok:
          up.indexOf("AAPL") === before.indexOf("AAPL") - 1 &&
          JSON.stringify(down) === JSON.stringify(before),
        detail: `${JSON.stringify(up)} then ${JSON.stringify(down)}`,
      };
    },
    meta(
      "keyboard",
      "shortcut",
      "⌥↑ ⌥↓",
      "focus a row, Option-Up Arrow, then Option-Down Arrow",
      "the row moves up, then back; each order saved",
    ),
  );
  await c.check(
    "stocks.watchlist.drag-reorder",
    async () => {
      const before = await order();
      const saved = next(page, URLS.watchlist, () => true, "PUT");
      await rowBox(page, ADDED).dragTo(rowBox(page, before[0]));
      const after = (await (await saved).json()).symbols;
      kept.order = after;
      return {
        ok: after[0] === ADDED && JSON.stringify(await listed(page)) === JSON.stringify(after),
        detail: `${JSON.stringify(before)} -> ${JSON.stringify(after)}`,
      };
    },
    meta(
      "window",
      "drag",
      "watchlist row",
      "drag TSLA's row onto the first row with the mouse",
      "TSLA takes the first place, the order saved",
      "restart",
    ),
  );

  // ── Business News: the provider's stories, each a link to it ──
  await c.check(
    "stocks.news.cell",
    async () => {
      await stocks(page)
        .getByRole("button", { name: /^Business News/ })
        .click();
      await stocks(page)
        .getByRole("heading", { name: "Business News" })
        .first()
        .waitFor({ timeout: 10_000 })
        .catch(() => {});
      const links = stocks(page).getByRole("link");
      const n = await links.count();
      const names = (await links.allInnerTexts()).map((t) => t.trim());
      const fromModule =
        kept.stories.length > 0 &&
        names.slice(0, 5).every((name) => kept.stories.some((s) => s.headline === name));
      return {
        ok: n > 0 ? fromModule : /could not|can’t|unavailable/i.test(await text(page)),
        detail: `${n} links shown; ${kept.stories.length} stories in the module's answer; the first five are the module's ${fromModule}`,
      };
    },
    meta(
      "window",
      "button",
      "Business News From News",
      "click Business News in the sidebar",
      "the provider's business stories",
    ),
  );
  await c.check(
    "stocks.news.link",
    async () => {
      const links = stocks(page).getByRole("link");
      const n = await links.count();
      if (n === 0) return { ok: false, detail: `no stories; ${providerEvidence()}` };
      const picks = [...new Set([0, Math.floor((n - 1) / 2), n - 1])];
      const seen = [];
      for (const i of picks) {
        const link = links.nth(i);
        const href = await link.getAttribute("href");
        const name = (await link.innerText()).replace(/\s+/g, " ").trim();
        const story = kept.stories.find((s) => s.url === href);
        await link.click();
        await stocks(page)
          .getByRole("article", { name: "Story" })
          .getByRole("button", { name: /^Read the Whole Story at / })
          .click();
        const safari = page.getByRole("region", { name: "Safari", exact: true }).first();
        await safari.waitFor({ timeout: 10_000 });
        const host = new URL(href).hostname.replace(/^www\./, "");
        let shows = false;
        for (let waited = 0; !shows && waited < 10_000; waited += 200) {
          shows = (await safari.innerText()).includes(host);
          if (!shows) await page.waitForTimeout(200);
        }
        // The window may lie over a part of Stocks another row needs, and its button is pressed from script.
        await safari
          .getByRole("button", { name: "Close", exact: true })
          .first()
          .evaluate((button) => button.click());
        await safari.waitFor({ state: "detached", timeout: 5_000 });
        await stocks(page).getByRole("button", { name: "Back" }).click();
        const headline = (story?.headline ?? "").replace(/\s+/g, " ").trim();
        seen.push({
          ok: Boolean(story) && name.includes(headline) && /^https:/.test(href) && shows,
          detail: `${name.slice(0, 30)} -> Safari on ${host} ${shows}${story ? "" : " (not in the module's answer)"}`,
        });
      }
      return { ok: seen.every((s) => s.ok), detail: seen.map((s) => s.detail).join(" | ") };
    },
    meta(
      "news",
      "link",
      "/.{12,}/",
      "click a story (the first, a middle and the last), then Read the Whole Story",
      "it opens in Safari on the desktop, at the provider's address",
    ),
  );
  await c.check(
    "stocks.toolbar.back",
    async () => {
      await row(page, "AAPL").click();
      const back = stocks(page).getByRole("button", { name: "Back" });
      const enabled = await back.isEnabled();
      await back.click();
      await page.waitForTimeout(300);
      const after = await back.isDisabled();
      return {
        ok: enabled && after,
        detail: `Back enabled in the detail ${enabled}; dimmed after ${after}`,
      };
    },
    meta(
      "detail",
      "button",
      "Back",
      "in a detail view, click Back",
      "Business News again; Back dims",
    ),
  );

  // ── Remove from Watchlist (then add TSLA back for the persistence checks) ──
  await c.check(
    "stocks.share.remove",
    async () => {
      await row(page, ADDED).click();
      const saved = next(page, URLS.watchlist, () => true, "PUT");
      await (await share(page)).getByRole("menuitem", { name: "Remove from Watchlist" }).click();
      const after = (await (await saved).json()).symbols;
      const gone = !after.includes(ADDED) && (await row(page, ADDED).count()) === 0;
      const search = stocks(page).getByRole("searchbox", { name: "Search" });
      await search.fill("tesla");
      const back = next(page, URLS.watchlist, () => true, "PUT");
      await stocks(page)
        .getByRole("button", { name: `Add ${ADDED}`, exact: true })
        .click();
      await back;
      await search.fill("");
      const savedAgain = next(page, URLS.watchlist, () => true, "PUT");
      await rowBox(page, ADDED).dragTo(rowBox(page, (await order())[0]));
      kept.order = (await (await savedAgain).json()).symbols;
      return {
        ok: gone,
        detail: `removed: ${JSON.stringify(after)}; then added and dragged first again: ${JSON.stringify(kept.order)}`,
      };
    },
    meta(
      "share menu",
      "menuitem",
      "Remove from Watchlist",
      "show TSLA, Share > Remove from Watchlist",
      "it leaves the watchlist on screen and on the server",
    ),
  );

  await commonRows(c, page, { id: "stocks", name: "Stocks" });
  for (const control of (await crawlMenus(page)).rows) c.crawled.push(control);

  await c.check(
    "stocks.persist.reload",
    async () => {
      await reloadDesktop(page);
      await openStocks(page);
      return persisted(page, kept);
    },
    meta(
      "window",
      "reload",
      "watchlist and alerts",
      "reload the desktop, open Stocks",
      "the watchlist in its order, TSLA's alert reached",
      "reload",
    ),
  );
  await isolation(browser, "stocks.isolation.write");
  return kept;
}

async function persisted(page, kept) {
  await row(page, ADDED).waitFor({ timeout: 15_000 });
  const stored = (await api(page, "GET", URLS.watchlist)).json?.symbols;
  const drawn = await listed(page);
  await row(page, ADDED).click();
  const alert = await stocks(page)
    .getByText(/^Above 1\.00: reached /)
    .waitFor({ timeout: 15_000 })
    .then(
      () => true,
      () => false,
    );
  const ok =
    JSON.stringify(stored) === JSON.stringify(kept.order) &&
    JSON.stringify(drawn) === JSON.stringify(kept.order) &&
    alert;
  return {
    ok,
    detail: `stored ${JSON.stringify(stored)}; drawn ${JSON.stringify(drawn)}; alert shown ${alert}`,
  };
}

async function isolation(browser, id) {
  await c.check(
    id,
    async () => {
      const other = await person(
        browser,
        c,
        base,
        accountFor("stocks", `b${phase === "restart-check" ? "r" : "w"}`),
        { label: "second account" },
      );
      try {
        const watch = await api(other, "GET", URLS.watchlist);
        const alerts = await api(other, "GET", URLS.alerts);
        const library = await api(other, "GET", "/api/app-store/library");
        return {
          ok:
            watch.json?.symbols === null &&
            !(alerts.json?.alerts ?? []).length &&
            !library.json?.installed?.includes("stocks"),
          detail: `watchlist ${JSON.stringify(watch.json?.symbols)}; alerts ${JSON.stringify(alerts.json?.alerts ?? null)}; installed ${JSON.stringify(library.json?.installed)}`,
        };
      } finally {
        await other.context().close();
      }
    },
    meta(
      "second account",
      "isolation",
      "Stocks data",
      "sign up a second account, read its watchlist, alerts and App Store library",
      "none of the first account's: no watchlist, no alerts, Stocks not got",
      "restart",
    ),
  );
}

async function restartPhase(browser) {
  const state = loadState(out, "stocks", browserName);
  const page = await person(browser, c, base, state.account, { create: false });
  await openStocks(page);
  await c.check(
    "stocks.persist.restart",
    async () => persisted(page, state.kept),
    meta(
      "window",
      "restart",
      "watchlist and alerts",
      "restart ferrite dev on the same root, sign in, open Stocks",
      "the watchlist in its order, TSLA's alert reached",
      "restart",
    ),
  );
  await isolation(browser, "stocks.isolation.restart");
}

const browser = await launchBrowser(browserName, { headed: opts.headed });
try {
  if (phase === "restart-check") await restartPhase(browser);
  else {
    const account = accountFor("stocks", "a");
    const page = await person(browser, c, base, account);
    const kept = await writePhase(browser, page);
    saveState(out, "stocks", browserName, { account, kept });
  }
} catch (error) {
  c.row("stocks.run.completed", false, String(error?.message ?? error).split("\n")[0]);
} finally {
  await browser.close();
}
c.finish();

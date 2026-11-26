#!/usr/bin/env node
// Stocks's depth on Ferrite: its menus and keys, row and story menus, multiple selection and Edit
// mode, each checked on the server or in the window, with real input only.
//
//   node e2e/stocks-depth-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, closeMenus, menuItemState } from "./media-census-kit.mjs";

const WATCHLIST = "/api/stocks/watchlist";
const QUOTES = "/api/stocks/quotes";
const LIBRARY = "/api/app-store/library";
const { base, out } = options();
const { step, run } = journey("stocks-depth", {
  ignoreOtherOrigins: true,
  contextOptions: { chromium: { permissions: ["clipboard-read", "clipboard-write"] } },
});
const COMMAND = process.platform === "darwin" ? "Meta" : "Control";

const listed = (window) =>
  window.locator('[aria-label="Symbols"] .mac-stock-row-symbol').allTextContents();
const rowOf = (window, symbol) => window.locator(`.mac-stock-row[data-symbol="${symbol}"]`);
const rowButton = (window, symbol) => rowOf(window, symbol).locator("button.mac-stock-row-main");
const title = (window) => window.locator(".mac-stocks-pane h2").first();
const saved = async (page) => (await api(page, "GET", WATCHLIST)).json.symbols;
const rangeOn = (window, range) =>
  window.getByRole("group", { name: "Range" }).getByRole("button", { name: range, exact: true });

async function until(read, wanted, timeout = 8_000) {
  const end = Date.now() + timeout;
  let last = await read();
  while (Date.now() < end) {
    if (JSON.stringify(last) === JSON.stringify(wanted)) break;
    await new Promise((done) => setTimeout(done, 150));
    last = await read();
  }
  return last;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function openStocks(page) {
  const library = await api(page, "GET", LIBRARY);
  const installed = [...new Set([...(library.json.installed ?? []), "stocks"])];
  await api(page, "PUT", LIBRARY, { installed, rev: library.json.rev });
  await reloadDesktop(page);
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Stocks");
  await field.press("Enter");
  const window = page.getByRole("region", { name: "Stocks", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await rowOf(window, "AAPL").waitFor({ timeout: 15_000 });
  return window;
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const window = await openStocks(page);
  const search = window.getByRole("searchbox", { name: "Search" });

  // ---- The menus, and what is dimmed while the news is shown ------------------------------------
  const back = await menuItemState(page, "View", "Back");
  step("View > Back is dimmed on the news, saying why", back.disabled && Boolean(back.title));
  const range = await menuItemState(page, "View", "1 Week");
  step("View's ranges are dimmed on the news, saying why", range.disabled && Boolean(range.title));
  const del = await menuItemState(page, "Edit", "Delete");
  step(
    "Edit > Delete is dimmed with nothing selected, saying why",
    del.disabled && Boolean(del.title),
  );

  // ---- Find -----------------------------------------------------------------------------------
  await window.locator(".mac-stocks-pane").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press(`${COMMAND}+f`);
  await page.waitForTimeout(200);
  step(
    "Command-F gives the search field the keyboard",
    await search.evaluate((el) => el === document.activeElement),
  );
  await page.keyboard.press("Escape");
  await rowButton(window, ".DJI").click();
  await chooseMenu(page, "Edit", "Find");
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-label") === "Search",
    null,
    { timeout: 5_000 },
  );
  step("Edit > Find gives the search field the keyboard", true);
  await search.fill("");

  // ---- The arrows move through the list and show each row ----------------------------------------
  await rowButton(window, ".DJI").click();
  await title(window).filter({ hasText: ".DJI" }).waitFor({ timeout: 5_000 });
  await page.keyboard.press("ArrowDown");
  await title(window).filter({ hasText: ".SPX" }).waitFor({ timeout: 5_000 });
  step("Down Arrow shows the next symbol", true);
  await page.keyboard.press("ArrowDown");
  await title(window).filter({ hasText: ".IXIC" }).waitFor({ timeout: 5_000 });
  await page.keyboard.press("ArrowUp");
  await title(window).filter({ hasText: ".SPX" }).waitFor({ timeout: 5_000 });
  step("Up Arrow shows the one before", true);
  step(
    "the row shown keeps the keyboard",
    await rowButton(window, ".SPX").evaluate((el) => el === document.activeElement),
  );

  // ---- Ranges ---------------------------------------------------------------------------------
  await page.keyboard.press(`${COMMAND}+2`);
  await window
    .locator('svg[aria-label*="past week"]')
    .or(window.getByText(/No Chart Data|could not be loaded/))
    .first()
    .waitFor({ timeout: 10_000 });
  step(
    "Command-2 sets the chart to the week",
    (await rangeOn(window, "1W").getAttribute("aria-pressed")) === "true",
  );
  await page.keyboard.press(`${COMMAND}+7`);
  await page.waitForTimeout(200);
  step(
    "Command-7 sets the chart to two years",
    (await rangeOn(window, "2Y").getAttribute("aria-pressed")) === "true",
  );
  await chooseMenu(page, "View", "3 Months");
  await page.waitForTimeout(200);
  step(
    "View > 3 Months sets the chart to the range",
    (await rangeOn(window, "3M").getAttribute("aria-pressed")) === "true",
  );
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "View", exact: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Refresh", exact: true }).waitFor({ timeout: 5_000 });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "stocks-view-menu.png"));
  await closeMenus(page);

  // ---- Refresh --------------------------------------------------------------------------------
  const refreshed = () =>
    page.waitForResponse((answer) => new URL(answer.url()).pathname === QUOTES, { timeout: 8_000 });
  let asked = refreshed();
  await chooseMenu(page, "View", "Refresh");
  step("View > Refresh asks the server for the quotes", (await asked).status() === 200);
  asked = refreshed();
  await rowButton(window, ".SPX").focus();
  await page.keyboard.press(`${COMMAND}+r`);
  step("Command-R asks the server for the quotes", (await asked).status() === 200);
  step("Command-R does not reload the page", await window.isVisible());

  // ---- Back -----------------------------------------------------------------------------------
  await page.keyboard.press(`${COMMAND}+[`);
  await title(window).filter({ hasText: "Top Stories" }).waitFor({ timeout: 5_000 });
  step("Command-[ goes back to the news", true);
  await rowButton(window, ".SPX").click();
  await title(window).filter({ hasText: ".SPX" }).waitFor({ timeout: 5_000 });
  await chooseMenu(page, "View", "Back");
  await title(window).filter({ hasText: "Top Stories" }).waitFor({ timeout: 5_000 });
  step("View > Back goes back to the news", true);

  // ---- Delete ---------------------------------------------------------------------------------
  await rowButton(window, ".SPX").click();
  await page.keyboard.press("Backspace");
  const afterKey = await until(() => saved(page), [".DJI", ".IXIC", "AAPL"]);
  step(
    "the Delete key removes the symbol on the server",
    same(afterKey, [".DJI", ".IXIC", "AAPL"]),
    JSON.stringify(afterKey),
  );
  await title(window).filter({ hasText: ".IXIC" }).waitFor({ timeout: 5_000 });
  step(
    "the next symbol is shown, and has the keyboard",
    await rowButton(window, ".IXIC").evaluate((el) => el === document.activeElement),
  );
  await chooseMenu(page, "Edit", "Delete");
  const afterMenu = await until(() => saved(page), [".DJI", "AAPL"]);
  step(
    "Edit > Delete removes the symbol on the server",
    same(afterMenu, [".DJI", "AAPL"]),
    JSON.stringify(afterMenu),
  );
  await search.click();
  await search.fill("a");
  await page.keyboard.press("Backspace");
  await page.waitForTimeout(300);
  step(
    "Delete in the search field edits its text and removes nothing",
    (await search.inputValue()) === "" && same(await saved(page), [".DJI", "AAPL"]),
  );
  await page.waitForTimeout(600);
  step("the list follows the server", same(await listed(window), [".DJI", "AAPL"]));

  // ---- A row's menu ---------------------------------------------------------------------------
  const menuItem = (name) => page.getByRole("menuitem", { name, exact: true });
  const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
  await rowOf(window, "AAPL").click({ button: "right" });
  await menuItem("Share").hover();
  await menuItem("Copy Symbol").waitFor({ timeout: 5_000 });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "stocks-row-menu.png"));
  await menuItem("Copy Symbol").click();
  step(
    "a row's Share > Copy Symbol copies the row's symbol",
    (await until(clipboard, "AAPL")) === "AAPL",
  );
  await rowOf(window, "AAPL").click({ button: "right" });
  await menuItem("Share").hover();
  await menuItem("Copy Link").click();
  const quotePage = "https://www.cnbc.com/quotes/AAPL";
  step(
    "a row's Share > Copy Link copies its page",
    (await until(clipboard, quotePage)) === quotePage,
  );
  await rowButton(window, ".DJI").click();
  await title(window).filter({ hasText: ".DJI" }).waitFor({ timeout: 5_000 });
  await rowOf(window, "AAPL").click({ button: "right" });
  await menuItem("Add Price Alert…").click();
  await title(window).filter({ hasText: "AAPL" }).waitFor({ timeout: 5_000 });
  const alertPrice = window.getByRole("textbox", { name: "Alert price" });
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-label") === "Alert price",
    null,
    { timeout: 5_000 },
  );
  step("a row's Add Price Alert shows that symbol, with the keyboard in the price", true);
  await page.keyboard.type("123.45");
  await window.getByRole("button", { name: "Add Alert", exact: true }).click();
  const alerts = () =>
    api(page, "GET", "/api/stocks/alerts").then((reply) =>
      (reply.json.alerts ?? []).map((alert) => [alert.symbol, alert.above ?? alert.below]),
    );
  const set = await until(alerts, [["AAPL", 123.45]]);
  step(
    "the alert it starts is kept on the server",
    same(set, [["AAPL", 123.45]]),
    JSON.stringify(set),
  );
  step("the price field is still there", await alertPrice.isVisible());
  await rowOf(window, ".DJI").click({ button: "right" });
  await menuItem("Remove from Watchlist").click();
  const afterRowMenu = await until(() => saved(page), ["AAPL"]);
  step(
    "a row's Remove from Watchlist removes that row on the server",
    same(afterRowMenu, ["AAPL"]),
    JSON.stringify(afterRowMenu),
  );
  step("the symbol shown stays shown", (await title(window).textContent()) === "AAPL");

  // ---- A story's menu -------------------------------------------------------------------------
  await page.keyboard.press(`${COMMAND}+[`);
  await title(window).filter({ hasText: "Top Stories" }).waitFor({ timeout: 5_000 });
  const story = window.locator(".mac-stocks-story").first();
  await story.waitFor({ timeout: 15_000 });
  const storyUrl = await story.locator("a").getAttribute("href");
  await story.click({ button: "right" });
  await menuItem("Open Story").waitFor({ timeout: 5_000 });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "stocks-story-menu.png"));
  await menuItem("Copy Link").click();
  step(
    "a story's Copy Link copies its address",
    (await until(clipboard, storyUrl)) === storyUrl,
    storyUrl,
  );
  await story.click({ button: "right" });
  await menuItem("Share").hover();
  await menuItem("Notes").waitFor({ timeout: 5_000 });
  step("a story's Share lists where a link can go", await menuItem("Mail").isVisible());
  await closeMenus(page);
  await story.click({ button: "right" });
  await menuItem("Open Story").click();
  const safari = page.getByRole("region", { name: "Safari", exact: true }).first();
  await safari.waitFor({ state: "visible", timeout: 15_000 });
  await safari.getByRole("tab").first().waitFor({ timeout: 15_000 });
  const address = safari
    .getByRole("combobox", { name: "Search or enter website name" })
    .or(safari.getByRole("textbox", { name: "Search or enter website name" }))
    .first();
  const host = new URL(storyUrl).host;
  const shown = await until(
    async () => (await address.inputValue()).includes(host.replace(/^www\./, "")),
    true,
    15_000,
  );
  step(
    "a story's Open Story opens its address in Safari",
    shown === true,
    await address.inputValue(),
  );
  // ---- Several symbols ------------------------------------------------------------------------
  const six = [".DJI", ".SPX", ".IXIC", "AAPL", "MSFT", "TSLA"];
  const doc = (await api(page, "GET", WATCHLIST)).json;
  await api(page, "PUT", WATCHLIST, { symbols: six, rev: doc.rev, session: doc.session });
  const fresh = await openStocks(page);
  await rowOf(fresh, "TSLA").waitFor({ timeout: 15_000 });
  const chosen = () =>
    fresh
      .locator(".mac-stock-row[data-selected]")
      .evaluateAll((rows) => rows.map((row) => row.dataset.symbol));
  const footer = fresh.locator(".mac-stocks-footer");
  await rowButton(fresh, ".DJI").click();
  await rowButton(fresh, ".IXIC").click({ modifiers: [COMMAND] });
  step(
    "Command-click adds a row, and shows it",
    same(await chosen(), [".DJI", ".IXIC"]) && (await title(fresh).textContent()) === ".IXIC",
  );
  step(
    "the footer says how many are selected",
    (await footer.textContent()).includes("2 Symbols Selected"),
  );
  await rowButton(fresh, ".IXIC").click({ modifiers: [COMMAND] });
  step("Command-click takes a row away", same(await chosen(), [".DJI"]));
  await rowButton(fresh, ".SPX").click();
  await rowButton(fresh, "AAPL").click({ modifiers: ["Shift"] });
  step("Shift-click selects the rows between", same(await chosen(), [".SPX", ".IXIC", "AAPL"]));
  await page.keyboard.press("Shift+ArrowDown");
  await page.waitForTimeout(100);
  step("Shift and Down Arrow extends it", same(await chosen(), [".SPX", ".IXIC", "AAPL", "MSFT"]));
  await page.keyboard.press("Shift+ArrowUp");
  await page.waitForTimeout(100);
  step("Shift and Up Arrow shrinks it", same(await chosen(), [".SPX", ".IXIC", "AAPL"]));
  await page.keyboard.press(`${COMMAND}+a`);
  await page.waitForTimeout(100);
  step("Command-A selects every row", same(await chosen(), six));
  await rowButton(fresh, ".SPX").click();
  step("a plain click goes back to one row", same(await chosen(), [".SPX"]));
  await chooseMenu(page, "Edit", "Select All");
  await page.waitForTimeout(100);
  step("Edit > Select All selects every row", same(await chosen(), six));
  await rowButton(fresh, ".SPX").click();
  await rowButton(fresh, ".IXIC").click({ modifiers: ["Shift"] });
  await page.waitForTimeout(500);
  await rowOf(fresh, ".SPX").click({ button: "right" });
  await menuItem("Remove 2 Symbols").waitFor({ timeout: 5_000 });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "stocks-several.png"));
  await menuItem("Remove 2 Symbols").click();
  const fewer = [".DJI", "AAPL", "MSFT", "TSLA"];
  const afterSeveral = await until(() => saved(page), fewer);
  step(
    "a selected row's menu removes all that are selected, on the server",
    same(afterSeveral, fewer),
    JSON.stringify(afterSeveral),
  );
  await title(fresh).filter({ hasText: "AAPL" }).waitFor({ timeout: 5_000 });
  await rowButton(fresh, "AAPL").click();
  await rowButton(fresh, "MSFT").click({ modifiers: ["Shift"] });
  await page.keyboard.press("Backspace");
  const two = [".DJI", "TSLA"];
  const afterDelete = await until(() => saved(page), two);
  step(
    "the Delete key removes all that are selected, on the server",
    same(afterDelete, two),
    JSON.stringify(afterDelete),
  );
  await page.waitForTimeout(500);
  step("the list follows the server", same(await listed(fresh), two));
  await rowOf(fresh, ".DJI").click({ button: "right" });
  await menuItem("Remove from Watchlist").waitFor({ timeout: 5_000 });
  step(
    "a row outside the selection's menu is its own",
    (await menuItem("Add Price Alert…").getAttribute("aria-disabled")) !== "true",
  );
  await closeMenus(page);

  // ---- Edit mode ------------------------------------------------------------------------------
  const edit = fresh.getByRole("button", { name: "Edit", exact: true });
  const removeOf = (symbol) => fresh.getByRole("button", { name: `Remove ${symbol}`, exact: true });
  step("out of Edit mode a row has no remove button", (await removeOf("TSLA").count()) === 0);
  await edit.click();
  await removeOf("TSLA").waitFor({ timeout: 5_000 });
  step(
    "Edit shows each row's remove button and Done",
    await fresh.getByRole("button", { name: "Done", exact: true }).isVisible(),
  );
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "stocks-edit-mode.png"));
  await fresh
    .locator('.mac-stocks-row:has(.mac-stock-row[data-symbol="TSLA"]) .mac-stocks-row-grip')
    .dragTo(rowOf(fresh, ".DJI"));
  const dragged = ["TSLA", ".DJI"];
  const moved = await until(() => saved(page), dragged);
  step(
    "a row's grip drags it to a new place, saved on the server",
    same(moved, dragged),
    JSON.stringify(moved),
  );
  await removeOf(".DJI").click();
  const afterMinus = await until(() => saved(page), ["TSLA"]);
  step(
    "a row's remove button removes it on the server",
    same(afterMinus, ["TSLA"]),
    JSON.stringify(afterMinus),
  );
  await fresh.getByRole("button", { name: "Done", exact: true }).click();
  await removeOf("TSLA").waitFor({ state: "detached", timeout: 5_000 });
  step("Done ends Edit mode", await edit.isVisible());
  await chooseMenu(page, "Edit", "Edit Watchlist");
  await removeOf("TSLA").waitFor({ timeout: 5_000 });
  step("Edit > Edit Watchlist starts it", true);
  await chooseMenu(page, "Edit", "Done Editing");
  await removeOf("TSLA").waitFor({ state: "detached", timeout: 5_000 });
  step("Edit > Done Editing ends it", true);
});

process.exit(0);

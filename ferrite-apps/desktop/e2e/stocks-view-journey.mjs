#!/usr/bin/env node
// Stocks: the sidebar's menu row and key, and the last symbol, range, badge and sidebar kept over a
// reload. Quotes come from the module, which asks the provider through the application's egress.
//
//   node e2e/stocks-view-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, closeMenus, menuItemState, until } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("stocks-view", { ignoreOtherOrigins: true });
const SYMBOL = "AAPL";

/** Stocks does not come with the desktop: get it from the App Store's library, then Spotlight. */
async function getStocks(page) {
  const library = await api(page, "GET", "/api/app-store/library");
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(library.json.installed ?? []), "stocks"])],
    rev: library.json.rev,
  });
  await page.waitForTimeout(500);
  await reloadDesktop(page);
}

/** From Spotlight: Stocks is not in the Dock until the person gets it. */
async function openStocks(page) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Stocks");
  await page.waitForTimeout(300);
  await field.press("Enter");
}

await run(async (page) => {
  const underWay = new Set();
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith("/live/") || pathname.startsWith("/__forge/")) return;
    underWay.add(request);
  });
  for (const end of ["requestfinished", "requestfailed"])
    page.on(end, (request) => underWay.delete(request));
  await openDesktop(page, base, step);
  await getStocks(page);
  await openStocks(page);
  const window = page.getByRole("region", { name: "Stocks", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  const rowOf = (at) => at.locator(".mac-stock-row").filter({ hasText: SYMBOL }).first();
  const badgeOf = (at) => rowOf(at).locator("button").last();
  const titled = (at) => at.locator(".mac-stocks-title", { hasText: SYMBOL });
  await rowOf(window).waitFor({ timeout: 20_000 });

  step("a new person's window opens on the news", (await titled(window).count()) === 0);

  // ---- Dimmed rows ----------------------------------------------------------------------------
  const newWindow = await menuItemState(page, "File", "New Window");
  step(
    "File > New Window is dimmed and says why",
    newWindow.disabled && /one window/.test(newWindow.title ?? ""),
    newWindow.title,
  );
  const preferences = await menuItemState(page, "Stocks", "Preferences…");
  step(
    "Stocks > Preferences… is dimmed and says why",
    preferences.disabled && /no preferences/.test(preferences.title ?? ""),
    preferences.title,
  );
  await closeMenus(page);

  // ---- Choose what is to be kept --------------------------------------------------------------
  await rowOf(window).locator("button.mac-stock-row-main").click();
  await titled(window).first().waitFor({ timeout: 10_000 });
  await page.keyboard.press("ControlOrMeta+3");
  const badgeBefore = await badgeOf(window).innerText();
  await badgeOf(window).click();
  step(
    "the badge changes when clicked",
    await until(async () => (await badgeOf(window).innerText()) !== badgeBefore, 5_000),
    badgeBefore,
  );
  const badgeChosen = await badgeOf(window).innerText();

  // ---- The sidebar, by menu and key -----------------------------------------------------------
  const column = window.locator(".mac-stocks-column");
  await chooseMenu(page, "View", "Hide Sidebar");
  step("View > Hide Sidebar hides it", await until(() => column.isHidden(), 3_000));
  await page.waitForTimeout(400);
  await shot(page, path.join(out, "stocks-sidebar-hidden.png"));
  const removing = page
    .waitForRequest(
      (request) => request.method() === "PUT" && request.url().includes("/api/stocks/watchlist"),
      { timeout: 1_500 },
    )
    .then(
      () => true,
      () => false,
    );
  await page.keyboard.press("Delete");
  step("Delete removes nothing from a hidden list", !(await removing));
  await page.keyboard.press("ControlOrMeta+Alt+s");
  step("⌥⌘S shows it again", await until(() => column.isVisible(), 3_000));
  await page.keyboard.press("ControlOrMeta+Alt+s");
  await until(() => column.isHidden(), 3_000);
  await page.keyboard.press("ControlOrMeta+f");
  step(
    "Find shows the sidebar, with the keyboard in the search field",
    await until(
      () => page.evaluate(() => document.activeElement?.getAttribute("aria-label") === "Search"),
      3_000,
    ),
  );
  await chooseMenu(page, "View", "Hide Sidebar");
  await until(() => column.isHidden(), 3_000);
  // Saves are under way until these end; a reload would abort them.
  await page.waitForTimeout(500);
  await until(async () => underWay.size === 0, 15_000);
  await page.waitForTimeout(500);

  // ---- All of it survives a reload ------------------------------------------------------------
  await reloadDesktop(page);
  await openStocks(page);
  const again = page.getByRole("region", { name: "Stocks", exact: true }).first();
  await again.waitFor({ state: "visible", timeout: 15_000 });
  step(
    "the last symbol is shown after a reload",
    await until(async () => (await titled(again).count()) > 0, 20_000),
  );
  step(
    "the sidebar is still hidden",
    await until(() => again.locator(".mac-stocks-column").isHidden(), 3_000),
  );
  const pressed = await again.locator('[aria-pressed="true"]').allInnerTexts();
  step("the range is kept", pressed.includes("1M"), pressed.join(", "));
  await page.keyboard.press("ControlOrMeta+Alt+s");
  await rowOf(again).waitFor({ timeout: 10_000 });
  step(
    "the badge is kept",
    await until(async () => {
      const text = await badgeOf(again).innerText();
      return text.includes("%") === badgeChosen.includes("%");
    }, 10_000),
    badgeChosen,
  );
  await shot(page, path.join(out, "stocks-view-kept.png"));

  // ---- Dragging out: a row as its symbol, a story as its address, into a text field ------------
  const search = again.getByRole("searchbox", { name: "Search" });
  await rowOf(again).dragTo(search);
  step(
    "a row dragged into a text field drops its symbol",
    await until(async () => (await search.inputValue()).includes(SYMBOL), 3_000),
    await search.inputValue(),
  );
  await shot(page, path.join(out, "stocks-drag-symbol.png"));
  await search.fill("");
  await page.keyboard.press("ControlOrMeta+[");
  const story = again.locator(".mac-stocks-story-link").first();
  await story.waitFor({ timeout: 15_000 });
  const address = await story.getAttribute("href");
  await story.dragTo(search);
  step(
    "a story dragged into a text field drops its address",
    await until(async () => (await search.inputValue()).startsWith(address.slice(0, 20)), 3_000),
    await search.inputValue(),
  );
  await search.fill("");
});

process.exit(0);

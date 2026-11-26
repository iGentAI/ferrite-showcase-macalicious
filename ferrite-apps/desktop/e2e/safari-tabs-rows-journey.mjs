#!/usr/bin/env node
// Safari's tab, navigation and view rows of the inventory that no journey pictured: keys and menu
// rows for tabs, Back, Forward, Home, Reload, Reader, the Favorites bar, the sidebar and the Tab
// Overview, each read back from the window.
//
//   node e2e/safari-tabs-rows-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]
//
// Exits 0 only when every step passed and the page logged no console error, failed request or HTTP
// error of its own origin.

import path from "node:path";
import { journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { closingPage } from "./journey-kit.mjs";
import { chooseMenu } from "./media-census-kit.mjs";

const HN = "news.ycombinator.com";
const NEWEST = "https://news.ycombinator.com/newest";
const ARTICLE = "https://en.wikipedia.org/wiki/MacOS_Catalina";
const COMMAND = process.platform === "darwin" ? "Meta" : "Control";
const { base, out } = options();
const { step, run } = journey("safari-tabs-rows", { ignoreOtherOrigins: true });

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Safari");
  const window = page.getByRole("region", { name: "Safari", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  const field = window
    .getByRole("combobox", { name: "Search or enter website name" })
    .or(window.getByRole("textbox", { name: "Search or enter website name" }))
    .first();
  const tabs = window.getByRole("tab");
  const frame = window.locator("iframe[srcdoc]");
  const picture = async (name) => {
    await page.waitForTimeout(450);
    await shot(page, path.join(out, `safari-rows-${name}.png`));
  };
  const addressIs = async (part) => {
    await page
      .waitForFunction(
        ([input, wanted]) =>
          [...document.querySelectorAll(input)].some((one) => one.value.includes(wanted)),
        ['input[aria-label="Search or enter website name"]', part],
        { timeout: 20_000 },
      )
      .catch(() => {});
    return (await field.inputValue()).includes(part);
  };
  const addressLacks = async (part) => {
    for (let tries = 0; tries < 40; tries += 1) {
      if (!(await field.inputValue()).includes(part)) return true;
      await page.waitForTimeout(250);
    }
    return false;
  };
  const go = async (address) => {
    await field.click();
    await field.fill(address);
    await field.press("Enter");
    await frame.first().waitFor({ timeout: 30_000 });
  };

  // ---- The start page ------------------------------------------------------------------------------
  const tile = window.locator('[data-link-list="favorites"]').last();
  await tile.waitFor({ timeout: 10_000 });
  step("the start page shows the Favorites", await tile.isVisible());
  await picture("start-page");

  // ---- Back, Forward, Reload -----------------------------------------------------------------------
  await go(HN);
  await go(NEWEST);
  await window.getByRole("button", { name: "Back", exact: true }).click();
  step("the Back button returns to the page before", await addressLacks("newest"));
  await window.getByRole("button", { name: "Forward", exact: true }).click();
  step("the Forward button goes on again", await addressIs("newest"));
  await chooseMenu(page, "History", "Back");
  step("History > Back returns", await addressLacks("newest"));
  await chooseMenu(page, "History", "Forward");
  step("History > Forward goes on", await addressIs("newest"));
  await frame.first().waitFor({ timeout: 30_000 });
  // With the keyboard in the window; these keys were not seen to act right after a menu's command.
  await field.click();
  await page.keyboard.press(`${COMMAND}+BracketLeft`);
  step("Command-[ goes back", await addressLacks("newest"));
  await page.keyboard.press(`${COMMAND}+BracketRight`);
  step("Command-] goes forward", await addressIs("newest"));
  await picture("back-forward");

  const reloaded = (trigger) => {
    const answer = page.waitForResponse(
      (reply) => new URL(reply.url()).pathname === "/api/safari/page",
      { timeout: 30_000 },
    );
    return trigger().then(() => answer);
  };
  const byButton = await reloaded(() =>
    window.getByRole("button", { name: "Reload this page" }).click(),
  );
  step("Reload in the field asks the server again", byButton.status() === 200);
  await frame.first().waitFor({ timeout: 30_000 });
  const byKey = await reloaded(() => chooseMenu(page, "View", "Reload Page"));
  step("View > Reload Page asks the server again", byKey.status() === 200);
  await frame.first().waitFor({ timeout: 30_000 });

  // ---- Tabs ----------------------------------------------------------------------------------------
  await chooseMenu(page, "File", "New Tab");
  await page.waitForTimeout(400);
  const afterNew = await tabs.count();
  step("File > New Tab opens a tab", afterNew === 2, `${afterNew} tabs`);
  await window.getByRole("button", { name: "New Tab" }).first().click();
  await page.waitForTimeout(400);
  step("the New Tab button opens a tab", (await tabs.count()) === 3);
  await go(ARTICLE);
  await picture("three-tabs");
  await tabs.first().click();
  step("a click on a tab selects it", await addressIs("newest"));
  await tabs.nth(2).click();
  await addressIs("wikipedia");

  await chooseMenu(page, "File", "Close Tab");
  await page.waitForTimeout(400);
  step("File > Close Tab closes the tab in front", (await tabs.count()) === 2);
  await chooseMenu(page, "File", "Reopen Last Closed Tab");
  await page.waitForTimeout(400);
  step("File > Reopen Last Closed Tab brings it back", (await tabs.count()) === 3);
  step("on its page", await addressIs("wikipedia"));
  await picture("reopened-tab");

  // ---- Open Location -------------------------------------------------------------------------------
  await chooseMenu(page, "File", "Open Location…");
  await page.waitForTimeout(300);
  step(
    "File > Open Location gives the field the keyboard",
    await field.evaluate((input) => document.activeElement === input),
  );
  await page.keyboard.press("Escape");

  // ---- Reader --------------------------------------------------------------------------------------
  await frame.first().waitFor({ timeout: 30_000 });
  const showReader = window.getByRole("button", { name: "Show Reader View" });
  await showReader.waitFor({ timeout: 15_000 });
  await showReader.click();
  const hideReader = window.getByRole("button", { name: "Hide Reader View" });
  await hideReader.waitFor({ timeout: 10_000 });
  step("the Reader button shows the Reader", true);
  await picture("reader");
  await chooseMenu(page, "View", "Hide Reader");
  await showReader.waitFor({ timeout: 10_000 });
  step("View > Hide Reader leaves it", true);

  // ---- The Favorites bar and the sidebar -----------------------------------------------------------
  const bar = window.getByRole("navigation", { name: "Favorites bar" });
  await chooseMenu(page, "View", "Hide Favorites Bar");
  await page.waitForTimeout(300);
  step("View > Hide Favorites Bar hides it", (await bar.count()) === 0);
  await picture("favorites-bar-hidden");
  await chooseMenu(page, "View", "Show Favorites Bar");
  await bar.waitFor({ timeout: 5_000 });
  step("View > Show Favorites Bar shows it", true);

  const pane = window.locator(".mac-safari-sidebar").first();
  await window.getByRole("button", { name: "Show Sidebar" }).click();
  await pane.waitFor({ timeout: 5_000 });
  step("the Sidebar button opens the sidebar", true);
  await picture("sidebar");
  await chooseMenu(page, "View", "Hide Sidebar");
  await pane.waitFor({ state: "detached", timeout: 5_000 });
  step("View > Hide Sidebar closes it", true);
  await chooseMenu(page, "Bookmarks", "Show Bookmarks");
  await pane.waitFor({ timeout: 5_000 });
  step("Bookmarks > Show Bookmarks opens the list", true);
  await chooseMenu(page, "Bookmarks", "Show Reading List");
  await window.getByRole("tree", { name: "Reading List" }).waitFor({ timeout: 5_000 });
  step("Bookmarks > Show Reading List lists the Reading List", true);
  await picture("reading-list");
  await chooseMenu(page, "View", "Hide Sidebar");

  // ---- The Tab Overview ----------------------------------------------------------------------------
  const overview = window.getByLabel("Open tabs");
  await window.getByRole("button", { name: "Show Tab Overview" }).click();
  await overview.waitFor({ timeout: 5_000 });
  step("the Tab Overview button shows the open tabs", true);
  await picture("tab-overview");
  await window.getByRole("button", { name: "Hide Tab Overview" }).click();
  await overview.waitFor({ state: "detached", timeout: 5_000 });
  await chooseMenu(page, "View", "Show Tab Overview");
  await overview.waitFor({ timeout: 5_000 });
  step("View > Show Tab Overview shows them", true);
  await window.getByRole("button", { name: "Hide Tab Overview" }).click();
  await overview.waitFor({ state: "detached", timeout: 5_000 });

  // ---- History ---------------------------------------------------------------------------------------
  await chooseMenu(page, "History", "Show All History");
  await window.locator(".mac-safari-history-title").first().waitFor({ timeout: 10_000 });
  step("History > Show All History lists the visits", true);
  await picture("all-history");
  await chooseMenu(page, "History", "Home");
  await window.locator('[data-link-list="favorites"]').last().waitFor({ timeout: 10_000 });
  step("History > Home shows the start page", true);

  // ---- Tabs kept over a reload -----------------------------------------------------------------------
  await page.waitForTimeout(1_500);
  const kept = await tabs.count();
  await reloadDesktop(page);
  await launch(page, "Safari");
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await tabs.first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(800);
  step("the tabs are back after a reload", (await tabs.count()) === kept, `${kept} tabs`);
  const frequent = window.getByText("Frequently Visited", { exact: true }).first();
  await frequent.waitFor({ timeout: 10_000 });
  step("the start page shows Frequently Visited, after visits", await frequent.isVisible());
  await picture("tabs-kept");
  // The desktop's own reads after the reload may still be under way when the run closes the page.
  closingPage(page);
});

process.exit(0);

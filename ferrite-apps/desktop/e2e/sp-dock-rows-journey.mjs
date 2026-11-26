#!/usr/bin/env node
// Dock's rows on the served desktop, each changed in the pane's own checkbox and read back on the real Dock: Animate
// opening applications decides whether a tile bounces, Minimize windows into application icon whether a minimized
// window has a tile of its own, Show recent applications whether the recent section is there. Each is kept across a
// reload. Nothing is simulated. Exits 0 only when every step passed with no console error, page error, failed request
// or HTTP error.
//
//   node e2e/sp-dock-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { api, journey, nextSave, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const SETTINGS = "/api/system-preferences/settings";

await journey("sp-dock-rows", async ({ page, base, out, step }) => {
  // A request under way when a reload comes is cut off, which the journey counts as a failure.
  let underWay = 0;
  const isApi = (request) => new URL(request.url()).pathname.startsWith("/api/");
  page.on("request", (request) => {
    if (isApi(request)) underWay += 1;
  });
  const finished = (request) => {
    if (isApi(request)) underWay -= 1;
  };
  page.on("requestfinished", finished);
  page.on("requestfailed", finished);
  const reloadQuietly = async () => {
    await page.waitForTimeout(600);
    const end = Date.now() + 15_000;
    while (underWay > 0 && Date.now() < end) await page.waitForTimeout(50);
    underWay = 0;
    await reloadDesktop(page);
  };
  await openDesktop(page, base);
  const prefs = page.locator('[data-window-id="system-preferences"]');
  const dock = page.getByRole("toolbar", { name: "Dock" });
  const tile = (name) => dock.getByRole("button", { name, exact: true });
  const stored = async (key) => (await api(page, "GET", SETTINGS)).json?.values?.[key];
  const openPane = async () => {
    await tile("System Preferences").click();
    await prefs.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(800);
    const shown = prefs.getByRole("checkbox", { name: "Animate opening applications" });
    if ((await shown.count()) === 0) {
      await prefs.getByRole("button", { name: "Dock", exact: true }).first().click();
    }
    await shown.waitFor({ timeout: 8_000 });
  };
  const setOption = async (name, on) => {
    await openPane();
    const box = prefs.getByRole("checkbox", { name });
    const now = (await box.getAttribute("aria-checked")) === "true";
    if (now === on) return;
    const saved = nextSave(page, SETTINGS);
    await box.click();
    await saved;
  };
  const bouncing = (name) => tile(name).evaluate((button) => button.hasAttribute("data-bouncing"));
  const until = async (check, ms = 8_000) => {
    const end = Date.now() + ms;
    for (;;) {
      const value = await check();
      if (value || Date.now() > end) return value;
      await page.waitForTimeout(80);
    }
  };
  const closeWindow = async (id) => {
    const window = page.locator(`[data-window-id="${id}"]`);
    await window.getByRole("button", { name: "Close" }).first().click();
    await window.waitFor({ state: "detached", timeout: 8_000 });
  };

  // Animate opening applications.
  await tile("Calculator").click();
  step("Animate on: a tile bounces as its application opens", await bouncing("Calculator"));
  step("and stops", await until(async () => !(await bouncing("Calculator")), 3_000));
  await closeWindow("calculator");
  await setOption("Animate opening applications", false);
  await tile("Chess").click();
  await page.locator('[data-window-id="chess"]').waitFor({ timeout: 10_000 });
  step("Animate off in the pane: the tile stays still", !(await bouncing("Chess")));
  await closeWindow("chess");
  await reloadQuietly();
  step("Animate off is on the server after a reload", (await stored("dock.animate")) === false);
  await tile("Calculator").click();
  await page.locator('[data-window-id="calculator"]').waitFor({ timeout: 10_000 });
  step("and the tile stays still after the reload", !(await bouncing("Calculator")));
  await closeWindow("calculator");
  await setOption("Animate opening applications", true);
  await tile("Chess").click();
  step("Animate on again: it bounces", await bouncing("Chess"));

  // Minimize windows into application icon.
  const chess = page.locator('[data-window-id="chess"]');
  await chess.waitFor({ timeout: 10_000 });
  const minimized = () => chess.evaluate((element) => element.hasAttribute("data-minimized"));
  const ownTiles = () => dock.getByRole("button", { name: /minimized window/ }).count();
  await chess.getByRole("button", { name: "Minimize" }).first().click();
  await until(minimized);
  step("Minimize into icon off: a minimized window has its own tile", (await ownTiles()) === 1);
  await page.screenshot({ path: path.join(out, "sp-dock-own-tile.png") });
  await tile("Chess").click();
  await until(async () => !(await minimized()));
  await setOption("Minimize windows into application icon", true);
  await chess.waitFor();
  await chess.getByRole("button", { name: "Minimize" }).first().click();
  step("Minimize into icon on: the window minimizes", await until(minimized));
  step("and has no tile of its own", (await ownTiles()) === 0);
  await tile("Chess").click();
  step("the application's tile brings it back", await until(async () => !(await minimized())));
  await reloadQuietly();
  step(
    "Minimize into icon is on the server after a reload",
    (await stored("dock.minimizeIntoIcon")) === true,
  );
  await chess.waitFor({ timeout: 15_000 });
  await chess.getByRole("button", { name: "Minimize" }).first().click();
  await until(minimized);
  step("and still acts after the reload", (await ownTiles()) === 0);
  await tile("Chess").click();
  await until(async () => !(await minimized()));

  // Show recent applications: an application out of the Dock that was opened lately has a tile in the section.
  const calculator = tile("Calculator");
  await calculator.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Options", exact: true }).hover();
  const removed = nextSave(page, SETTINGS);
  await page.getByRole("menuitem", { name: "Remove from Dock", exact: true }).click();
  await removed;
  await page.waitForTimeout(400);
  const afterSeparator = () =>
    calculator.evaluate((button) => {
      const shelf = button.closest('[role="toolbar"]');
      return [...shelf.querySelectorAll('[role="separator"]')].some(
        (line) => line.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
    });
  const hasRecent = async () => (await calculator.count()) === 1 && (await afterSeparator());
  step(
    "Show recent on: the application out of the Dock is in the recent section",
    await hasRecent(),
  );
  await page.screenshot({ path: path.join(out, "sp-dock-recent.png") });
  await setOption("Show recent applications in Dock", false);
  step(
    "Show recent off in the pane: the section goes",
    await until(async () => (await calculator.count()) === 0, 3_000),
  );
  await reloadQuietly();
  await page.waitForTimeout(800);
  step(
    "and is still gone after a reload, kept on the server",
    (await calculator.count()) === 0 && (await stored("dock.recents")) === false,
  );
  await setOption("Show recent applications in Dock", true);
  step(
    "Show recent on again: it comes back",
    await until(async () => (await calculator.count()) === 1, 3_000),
  );
  await page.screenshot({ path: path.join(out, "sp-dock-pane.png") });
});

#!/usr/bin/env node
// Each media and web app's Dock menu, right-clicked on its running tile: the app's own rows, and one
// row chosen and read back from the window or the server's answer. Then the app's Help row, which
// opens Help Viewer. Music's Dock menu is in music-rows-journey.
//
//   node e2e/media-dock-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, until } from "./media-census-kit.mjs";
import { openWithSpotlight } from "./system-kit.mjs";

const { base, out } = options();
const { step, run } = journey("media-dock", {
  ignoreOtherOrigins: true,
  contextOptions: {
    chromium: {
      permissions: ["geolocation"],
      geolocation: { latitude: 37.8106, longitude: -122.4769, accuracy: 25 },
    },
  },
});

const region = (page, name) => page.getByRole("region", { name, exact: true }).first();
const tile = (page, name) =>
  page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name, exact: true });
/** The menu of an app's Dock tile, open. */
async function dockMenu(page, name) {
  await tile(page, name).click({ button: "right" });
  const menu = page.getByRole("menu", { name });
  await menu.waitFor({ timeout: 5_000 });
  return menu;
}
const rowNames = async (menu) =>
  (await menu.getByRole("menuitem").allInnerTexts()).map((text) => text.trim());

/** Asserts the menu holds `rows`, in order, after its windows' rows; leaves it open. */
async function holdsRows(page, name, rows) {
  const menu = await dockMenu(page, name);
  const listed = await rowNames(menu);
  const at = listed.indexOf(rows[0]);
  step(
    `${name}'s Dock menu holds its own rows`,
    at >= 0 && rows.every((row, index) => listed[at + index] === row),
    listed.join(", "),
  );
  return menu;
}

const APPS = [
  {
    name: "Safari",
    rows: ["New Tab"],
    async act(page, menu, window) {
      await menu.getByRole("menuitem", { name: "New Tab", exact: true }).click();
      const tabs = window.getByRole("tab");
      step(
        "Safari's New Tab opens a second tab",
        await until(async () => (await tabs.count()) === 2),
      );
      const shown = await tabs.nth(0).innerText();
      const again = await dockMenu(page, "Safari");
      await again.getByRole("menuitem", { name: shown.trim(), exact: true }).first().click();
      step(
        "and a tab's row in the Dock menu shows that tab",
        await until(async () => (await tabs.nth(0).getAttribute("aria-selected")) === "true"),
        shown.trim(),
      );
    },
  },
  {
    name: "Podcasts",
    rows: ["Play", "Play Next in Up Next"],
    async act(page, menu) {
      step(
        "with nothing loaded Podcasts' Play is dimmed",
        (await menu
          .getByRole("menuitem", { name: "Play", exact: true })
          .getAttribute("aria-disabled")) === "true",
      );
      await page.keyboard.press("Escape");
    },
  },
  {
    name: "TV",
    rows: ["Play", "Next", "Previous"],
    async act(page, menu) {
      step(
        "with nothing playing TV's Next is dimmed",
        (await menu
          .getByRole("menuitem", { name: "Next", exact: true })
          .getAttribute("aria-disabled")) === "true",
      );
      await page.keyboard.press("Escape");
    },
  },
  {
    name: "News",
    rows: ["Go to Today", "Reload"],
    async act(page, menu, window) {
      await page.keyboard.press("Escape");
      await window
        .getByRole("navigation", { name: "Channels" })
        .getByRole("button", { name: "Saved Stories", exact: true })
        .click();
      await window
        .getByRole("heading", { name: "Saved Stories" })
        .first()
        .waitFor({ timeout: 10_000 });
      const again = await dockMenu(page, "News");
      await again.getByRole("menuitem", { name: "Go to Today", exact: true }).click();
      step(
        "News' Go to Today leaves Saved Stories for Today",
        await until(
          async () => (await window.getByRole("heading", { name: "Saved Stories" }).count()) === 0,
        ),
      );
    },
  },
  {
    name: "Maps",
    rows: ["Go to Current Location", "Directions"],
    async act(page, menu, window) {
      await menu.getByRole("menuitem", { name: "Directions", exact: true }).click();
      await window
        .getByRole("textbox", { name: /^(From|Start)/ })
        .first()
        .waitFor({ timeout: 10_000 });
      step("Maps' Directions opens the directions panel", true);
    },
  },
  {
    name: "Stocks",
    rows: ["Refresh"],
    async act(page, menu) {
      const read = page.waitForRequest(
        (request) => new URL(request.url()).pathname.startsWith("/api/stocks/"),
        { timeout: 15_000 },
      );
      await menu.getByRole("menuitem", { name: "Refresh", exact: true }).click();
      step("Stocks' Refresh asks the server again", Boolean(await read));
    },
  },
  {
    name: "Find My",
    rows: ["People", "Devices"],
    async act(page, menu, window) {
      await menu.getByRole("menuitem", { name: "Devices", exact: true }).click();
      const segment = window.getByRole("radio", { name: "Devices", exact: true });
      step("Find My's Devices shows the devices list", await until(() => segment.isChecked()));
    },
  },
];

await run(async (page) => {
  await openDesktop(page, base, step);
  // Stocks and Find My come from the App Store.
  const held = (await api(page, "GET", "/api/app-store/library")).json;
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(held.installed ?? []), "find-my", "stocks"])],
    rev: held.rev,
  });
  await reloadDesktop(page);
  for (const { name, rows, act } of APPS) {
    await openWithSpotlight(page, name);
    const window = region(page, name);
    await window.waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForFunction(
      (frame) => !frame.hasAttribute("aria-busy"),
      await window.elementHandle(),
      {
        timeout: 30_000,
      },
    );
    const menu = await holdsRows(page, name, rows);
    await page.waitForTimeout(350);
    await shot(page, path.join(out, `media-dock-${name.toLowerCase().replace(" ", "-")}.png`));
    await act(page, menu, window);
    await page.waitForTimeout(300);
    await chooseMenu(page, "Help", `${name} Help`);
    const help = page.locator('.mac-managed-window[data-window-id^="help-viewer"]').first();
    await help.waitFor({ timeout: 15_000 });
    step(`Help > ${name} Help opens Help Viewer`, true);
    await help.getByRole("button", { name: "Close", exact: true }).first().click();
    await tile(page, name).click();
  }
});

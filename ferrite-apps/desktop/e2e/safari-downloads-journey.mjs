#!/usr/bin/env node
// Safari's Downloads on Ferrite: a real file of a listed site saved to the drive, the toolbar button,
// its list and the Window menu, kept across a reload.
//
//   node e2e/safari-downloads-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]
//
// Writes screenshots to --out. Exits 0 only when every step passed and the page logged no console
// error, page error, failed request or HTTP error.

import path from "node:path";
import { journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { reloadDesktop } from "./journey-kit.mjs";
import { chooseMenu } from "./media-census-kit.mjs";

const FILE = "https://news.ycombinator.com/favicon.ico";
const { base, out } = options();
const { step, run } = journey("safari-downloads", { ignoreOtherOrigins: true });

const fieldOf = (window) =>
  window
    .getByRole("combobox", { name: "Search or enter website name" })
    .or(window.getByRole("textbox", { name: "Search or enter website name" }))
    .first();
const openSafari = async (page) => {
  await launch(page, "Safari");
  const window = page.getByRole("region", { name: "Safari", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  return window;
};

await run(async (page) => {
  await openDesktop(page, base, step);
  let window = await openSafari(page);
  const button = () => window.getByRole("button", { name: "Downloads", exact: true });
  step("no Downloads button before the first download", (await button().count()) === 0);

  await fieldOf(window).fill(FILE);
  await page.keyboard.press("Enter");
  const download = window.getByRole("button", { name: "Download to Downloads Folder" });
  await download.waitFor({ timeout: 25_000 });
  await download.click();
  await window.getByText(/is in your Downloads folder/).waitFor({ timeout: 20_000 });
  await button().waitFor({ timeout: 5_000 });
  const popover = page.locator(".mac-safari-downloads");
  await popover.waitFor({ timeout: 5_000 });
  step(
    "a download adds the button and opens the list, with the file",
    await popover.getByText("favicon.ico").isVisible(),
  );
  await page.waitForTimeout(400);
  await shot(page, path.join(out, "safari-downloads.png"));

  await popover.getByRole("button", { name: /^Show favicon.ico in Finder$/ }).click();
  const finder = page.getByRole("region", { name: "Downloads" }).first();
  await finder.waitFor({ timeout: 10_000 });
  await finder.getByText("favicon.ico").first().waitFor({ timeout: 10_000 });
  step("Show in Finder opens the Downloads folder on the file", true);

  await page.waitForTimeout(2_500);
  await reloadDesktop(page);
  window = await openSafari(page);
  await button().waitFor({ timeout: 10_000 });
  step("the list is kept across a reload", true);
  await chooseMenu(page, "Window", "Downloads");
  await popover.waitFor({ timeout: 5_000 });
  step("Window > Downloads opens it", await popover.getByText("favicon.ico").isVisible());

  // Two at once, the second in another tab while the first is still on its way.
  await page.evaluate(() => {
    const real = window.fetch;
    window.fetch = async (...args) => {
      if (String(args[0]).includes("/api/safari/file")) {
        await new Promise((resolve) => setTimeout(resolve, 1_500));
      }
      return real(...args);
    };
  });
  await page.keyboard.press("Escape");
  await chooseMenu(page, "File", "New Tab");
  await fieldOf(window).fill(FILE);
  await page.keyboard.press("Enter");
  await download.waitFor({ timeout: 25_000 });
  await download.click();
  await chooseMenu(page, "File", "New Tab");
  await fieldOf(window).fill(FILE);
  await page.keyboard.press("Enter");
  await download.waitFor({ timeout: 25_000 });
  await download.click();
  await page.waitForFunction(
    () => document.querySelectorAll(".mac-safari-downloads-row").length >= 3,
    null,
    { timeout: 15_000 },
  );
  step("two downloads under way together are both on the list", true);
  await popover.getByRole("button", { name: "Clear", exact: true }).click();
  await button().waitFor({ state: "detached", timeout: 5_000 });
  step("Clear empties the list, and the button goes", true);
});

process.exit(0);

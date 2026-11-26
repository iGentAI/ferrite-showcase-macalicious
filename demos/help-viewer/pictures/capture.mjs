#!/usr/bin/env node
// Takes Help Viewer's pictures from a served desktop, signed in as Guest User, and writes them beside this file as small
// WebP. Run it from a build's ferrite-apps/desktop, so that playwright and sharp resolve, after any change that alters how
// these windows look:
//
//   node ../../demos/help-viewer/pictures/capture.mjs --url http://127.0.0.1:8080 --write <folder>

import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const base = option("--url", "http://127.0.0.1:8787");
const folder = path.resolve(option("--write", "pictures"));
mkdirSync(folder, { recursive: true });

const require = createRequire(path.join(process.cwd(), "package.json"));
const { chromium } = require("playwright");
const sharp = require("sharp");

const WINDOW_WIDTH = 560;
const QUALITY = 70;

async function writeWindow(page, id, name) {
  const frame = page.locator(`.mac-managed-window[data-window-id="${id}"]`).first();
  await frame.waitFor({ timeout: 20_000 });
  await page.waitForTimeout(3_000);
  const shot = await frame.screenshot({ animations: "disabled" });
  await sharp(shot)
    .resize({ width: WINDOW_WIDTH })
    .webp({ quality: QUALITY, effort: 6 })
    .toFile(path.join(folder, `${name}.webp`));
  console.log(`wrote ${name}.webp`);
}

const dock = (page, name) =>
  page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name, exact: true });

/** Opens `name` by Spotlight, which finds it whether or not it stands in the Dock. */
async function open(page, name) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill(name);
  await page.waitForTimeout(500);
  await field.press("Enter");
}

async function closeFront(page) {
  await page.keyboard.press("ControlOrMeta+w");
  await page.waitForTimeout(400);
}

const APPS = [
  ["notes", "Notes", "notes"],
  ["textedit", "TextEdit", "textedit"],
  ["calendar", "Calendar", "calendar"],
  ["contacts", "Contacts", "contacts"],
  ["reminders", "Reminders", "reminders"],
  ["music", "Music", "music"],
  ["terminal", "Terminal", "terminal"],
  ["calculator", "Calculator", "calculator"],
  ["system-preferences", "System Preferences", "system-preferences"],
];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto(`${base}/`, { waitUntil: "load" });
await page
  .getByRole("button", { name: /^Guest User$/ })
  .first()
  .click();
await dock(page, "Finder").waitFor({ timeout: 60_000 });
await page.waitForTimeout(1_500);

// The bare desktop, its Dock and its disks, is the round picture over the welcome page's title.
await sharp(await page.screenshot({ animations: "disabled" }))
  .extract({ left: 780, top: 240, width: 660, height: 660 })
  .resize({ width: 218, height: 218 })
  .webp({ quality: QUALITY, effort: 6 })
  .toFile(path.join(folder, "desktop-round.webp"));

await dock(page, "Finder").click();
await writeWindow(page, "finder", "finder");

await open(page, "Notes");
await page.locator('.mac-managed-window[data-window-id="notes"]').waitFor({ timeout: 20_000 });
await page.waitForTimeout(1_000);
await page.keyboard.press("ControlOrMeta+n");
await page.waitForTimeout(600);
await page.keyboard.type(
  "Trip to the coast\nPack a map, a hat and the blue flask.\nLeave by nine.",
);
// The desktop's whole screen, with Finder and Notes open, is the welcome page's picture.
await page.waitForTimeout(1_500);
const screen = await page.screenshot({ animations: "disabled" });
await sharp(screen)
  .resize({ width: 774 })
  .webp({ quality: QUALITY, effort: 6 })
  .toFile(path.join(folder, "desktop.webp"));
console.log("wrote desktop.webp and desktop-round.webp");

for (const [id, name, file] of APPS) {
  if (id !== "notes") await open(page, name);
  await writeWindow(page, id, file);
  await closeFront(page);
}

await browser.close();

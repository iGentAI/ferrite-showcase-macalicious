#!/usr/bin/env node
// A Safari download dragged out of the Downloads list with real mouse input: into a Finder window and
// onto the desktop, read back from the drive and over a reload.
//
//   node e2e/safari-download-drag-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { reloadDesktop } from "./journey-kit.mjs";
import { chooseMenu } from "./media-census-kit.mjs";

const FILE = "https://news.ycombinator.com/favicon.ico";
const NAME = "favicon.ico";
const { base, out } = options();
const { step, run } = journey("safari-download-drag", { ignoreOtherOrigins: true });

const copies = (page) =>
  page.evaluate(async (name) => {
    const reply = await fetch("/api/files/", { credentials: "same-origin" });
    return (await reply.json()).entries.filter((each) => each.name === name);
  }, NAME);

async function dragTitle(page, window, x, y) {
  const box = await window.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 8 });
  await page.mouse.up();
}

async function dragTo(page, from, x, y) {
  const box = await from.boundingBox();
  await page.mouse.move(box.x + 4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 12 });
  await page.waitForTimeout(120);
  await shot(page, path.join(out, "safari-download-dragging.png"));
  await page.mouse.up();
}

async function until(check, ms = 15_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

await run(async (page) => {
  await openDesktop(page, base, step);
  await page.setViewportSize({ width: 2400, height: 1000 });

  await launch(page, "Finder");
  const finder = page.locator('[data-window-id^="finder"]').first();
  await finder.waitFor({ timeout: 10_000 });
  await finder.getByRole("treeitem", { name: "Documents" }).first().click();
  const finderBox = await finder.boundingBox();
  await dragTitle(page, finder, 2400 - finderBox.width / 2 - 10, finderBox.y + 60);

  await launch(page, "Safari");
  const safari = page.getByRole("region", { name: "Safari", exact: true }).first();
  await safari.waitFor({ state: "visible", timeout: 15_000 });
  const safariBox = await safari.boundingBox();
  await dragTitle(page, safari, safariBox.width / 2 + 150, safariBox.y + 10);

  const field = safari
    .getByRole("combobox", { name: "Search or enter website name" })
    .or(safari.getByRole("textbox", { name: "Search or enter website name" }))
    .first();
  await field.fill(FILE);
  await page.keyboard.press("Enter");
  const download = safari.getByRole("button", { name: "Download to Downloads Folder" });
  await download.waitFor({ timeout: 25_000 });
  await download.click();
  const popover = page.locator(".mac-safari-downloads");
  await popover.waitFor({ timeout: 20_000 });
  const row = popover.getByText(NAME);
  await row.waitFor({ timeout: 5_000 });
  step("a download is on the list", (await copies(page)).length === 1);

  const place = await finder.boundingBox();
  const left = await safari.boundingBox();
  await dragTo(
    page,
    row,
    Math.max(place.x + 300, left.x + left.width + 60),
    place.y + place.height - 60,
  );
  step(
    "dragged into Finder's Documents, the file is there on the drive",
    await until(async () => (await copies(page)).some((each) => each.parent === "documents")),
    JSON.stringify((await copies(page)).map((each) => each.parent)),
  );
  await finder.getByText(NAME).first().waitFor({ timeout: 10_000 });
  step("and Finder's window shows it", true);
  await page.waitForTimeout(400);
  await shot(page, path.join(out, "safari-download-to-finder.png"));

  await reloadDesktop(page);
  step(
    "it is still in Documents after a reload",
    (await copies(page)).some((each) => each.parent === "documents"),
  );

  await launch(page, "Safari");
  await safari.waitFor({ state: "visible", timeout: 15_000 });
  await chooseMenu(page, "Window", "Downloads");
  await popover.waitFor({ timeout: 5_000 });
  await popover
    .getByRole("button", { name: `Remove ${NAME} from the list` })
    .waitFor({ timeout: 5_000 });
  step("the list still names it", true);
  await popover.getByRole("button", { name: `Show ${NAME} in Finder` }).hover();
  await page.mouse.down();
  await page.mouse.move(60, 300, { steps: 6 });
  await page.mouse.up();
  step(
    "a press on a row's button does not start a drag",
    !(await copies(page)).some((each) => each.parent === "desktop"),
  );
});

process.exit(0);

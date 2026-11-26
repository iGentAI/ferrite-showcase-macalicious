#!/usr/bin/env node
// Launchpad's pages on the signed-in person's desktop: the field is empty each time it opens; the
// wheel, the arrow keys at a page's edge and an application held at the screen's edge turn the page.
//
//   node scripts/dev-front-end.mjs --port 3020    # beside the shared desktop on 8787
//   node e2e/launchpad-pages-journey.mjs [--url http://127.0.0.1:3020] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("launchpad-pages");

async function until(check, ms = 5_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

await run(async (page) => {
  await openDesktop(page, base, step);
  // More apps than one page holds: this Guest User gets all the store has.
  const { catalogue } = (await api(page, "GET", "/api/apps")).json;
  const library = (await api(page, "GET", "/api/app-store/library")).json;
  const got = await api(page, "PUT", "/api/app-store/library", {
    installed: catalogue.filter((app) => !app.preinstalled).map((app) => app.id),
    rev: library.rev,
  });
  step("The person has got every app in the store", got.status === 200, String(got.status));
  await page.reload();
  await openDesktop(page, base, step);
  const tile = page
    .getByRole("toolbar", { name: "Dock" })
    .getByRole("button", { name: "Launchpad", exact: true });
  const pad = page.getByRole("dialog", { name: "Launchpad" });
  const field = pad.getByRole("searchbox").or(pad.getByRole("textbox")).first();
  const items = pad.locator(".mac-launchpad-item");
  const firstOnPage = () => items.first().getAttribute("data-app");

  await tile.click();
  await pad.waitFor({ timeout: 8_000 });
  const opening = await firstOnPage();
  const appsOnPage = await items.count();
  step("Launchpad opens on a full page", appsOnPage === 35, String(appsOnPage));

  await field.fill("cal");
  await until(async () => (await items.count()) < 35);
  await page.keyboard.press("Escape");
  await pad.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => undefined);
  if (await pad.isVisible()) await page.keyboard.press("Escape");
  await pad.waitFor({ state: "hidden", timeout: 5_000 });
  await tile.click();
  await pad.waitFor({ timeout: 8_000 });
  step("Its field is empty when it opens again", (await field.inputValue()) === "");
  step("and it lists the page again", await until(async () => (await items.count()) === 35));

  await page.mouse.move(700, 400);
  await page.mouse.wheel(120, 0);
  step("The wheel turns the page", await until(async () => (await firstOnPage()) !== opening));
  await shot(page, path.join(out, `launchpad-page-two-${browserName}.png`));

  await page.keyboard.press("ArrowLeft");
  step(
    "Left Arrow on the overlay turns it back",
    await until(async () => (await firstOnPage()) === opening),
  );

  await items.last().focus();
  await page.keyboard.press("ArrowRight");
  step(
    "Right Arrow at the last application turns to the next",
    await until(async () => (await firstOnPage()) !== opening),
  );
  await page.keyboard.press("ArrowLeft");
  await until(async () => (await firstOnPage()) === opening);

  const box = await items.nth(10).boundingBox();
  const { width } = page.viewportSize();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2, { steps: 4 });
  await page.mouse.move(width - 20, box.y + box.height / 2, { steps: 10 });
  // A browser only repeats dragover while something moves.
  for (let held = 0; held < 8; held += 1) {
    await page.waitForTimeout(100);
    await page.mouse.move(width - 20 - (held % 2), box.y + box.height / 2);
  }
  step(
    "An application held at the screen's edge turns the page",
    await until(async () => (await firstOnPage()) !== opening),
  );
  await page.mouse.up();
  await page.keyboard.press("Escape");
});

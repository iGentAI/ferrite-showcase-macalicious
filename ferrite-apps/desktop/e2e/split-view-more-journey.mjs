#!/usr/bin/env node
// The rest of Split View: a title bar dragged past the divider changes sides, a window let go on a
// full-screen Space in Mission Control tiles with it, and a Split View comes back after a reload.
//
//   node e2e/split-view-more-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("split-view-more");

async function until(check, ms = 8_000) {
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
  const overview = page.getByRole("dialog", { name: "Mission Control" });
  const bar = overview.getByRole("group", { name: "Spaces" });
  const shell = (id) => page.locator(`[data-window-id="${id}"]`);
  const stored = async () =>
    (await api(page, "GET", "/api/system-preferences/settings")).json.values?.["desktop.spaces"];
  const chooser = page.getByRole("dialog", { name: "Split View" });
  const divider = page.getByRole("separator", { name: "Split View divider" });

  await launch(page, "Finder");
  await shell("finder").waitFor({ timeout: 8_000 });
  await launch(page, "Chess");
  await shell("chess").waitFor({ timeout: 8_000 });
  await page.waitForTimeout(400);
  const chessFrom = await shell("chess").boundingBox();

  await page
    .getByRole("menubar")
    .first()
    .getByRole("menuitem", { name: "Window", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Tile Window to Left of Screen" }).click();
  await chooser.waitFor({ timeout: 4_000 });
  await chooser.getByRole("button").first().click();
  await until(async () => (await stored())?.current === "split:chess|finder");
  await page.waitForTimeout(400);

  // Sides.
  const dragTitle = async (id, toX) => {
    const title = await shell(id).locator(".mac-title-bar").first().boundingBox();
    await page.mouse.move(title.x + title.width / 2, title.y + 8);
    await page.mouse.down();
    await page.mouse.move(toX, title.y + 30, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(300);
  };
  const size = await page.evaluate(() => document.querySelector(".mac-window-manager").clientWidth);
  await dragTitle("chess", size / 2 - 40);
  step(
    "A title bar let go short of the divider goes back to its side",
    (await shell("chess").boundingBox()).x === 0,
  );
  await dragTitle("chess", size - 100);
  step(
    "Let go past it, the two windows change sides",
    await until(async () => (await stored())?.current === "split:finder|chess"),
    JSON.stringify((await stored())?.current),
  );
  step(
    "and stand there",
    await until(async () => {
      const chess = await shell("chess").boundingBox();
      const finder = await shell("finder").boundingBox();
      return chess.x > size / 2 - 10 && finder.x === 0;
    }),
  );
  await shot(page, path.join(out, `split-view-swapped-${browserName}.png`));

  // A reload.
  await page.waitForTimeout(1_000);
  await page.reload({ waitUntil: "load" });
  await divider.waitFor({ timeout: 20_000 });
  step(
    "A reload comes back on the Split View, with the divider",
    await until(async () => (await stored())?.current === "split:finder|chess"),
  );
  step(
    "with each window on its side",
    await until(async () => {
      const chess = await shell("chess").boundingBox();
      const finder = await shell("finder").boundingBox();
      return chess && finder && chess.x > size / 2 - 10 && finder.x === 0 && finder.y === 0;
    }, 15_000),
  );
  await shot(page, path.join(out, `split-view-reload-${browserName}.png`));
  await page.waitForTimeout(400);
  await shell("chess").getByRole("button", { name: "Enter Full Screen" }).first().click();
  step(
    "Ended after the reload, each window goes back to where it stood",
    await until(async () => {
      const now = await stored();
      const chess = await shell("chess").boundingBox();
      return (
        now?.spaces?.length === 1 &&
        chess &&
        Math.abs(chess.width - chessFrom.width) < 1 &&
        Math.abs(chess.x - chessFrom.x) < 1
      );
    }),
    JSON.stringify((await stored())?.spaces),
  );

  // On a full-screen Space.
  await page.waitForTimeout(400);
  await shell("chess").getByRole("button", { name: "Enter Full Screen" }).first().click();
  await until(async () => (await stored())?.current === "fs:chess");
  await page.waitForTimeout(600);
  await page.keyboard.press("Control+ArrowLeft");
  await until(async () => (await stored())?.current === "1");
  await page.waitForTimeout(600);
  await page.keyboard.press("F3");
  await overview.waitFor({ timeout: 4_000 });
  await page.waitForTimeout(500);
  const thumb = await overview.locator('[data-mission-window="finder"]').boundingBox();
  const target = await bar
    .locator('[data-desktop-space="fs:chess"], [aria-label*="Chess"]')
    .first()
    .boundingBox();
  await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width - 8, target.y + target.height / 2, { steps: 8 });
  await page.mouse.up();
  step(
    "A window let go on a full-screen Space shares a Split View with it",
    await until(async () => (await stored())?.current === "split:chess|finder"),
    JSON.stringify(await stored()),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  step(
    "Neither is in full screen any more",
    (await page.locator("[data-window-id][data-full-screen]").count()) === 0 &&
      (await divider.isVisible()),
  );
  await shot(page, path.join(out, `split-view-on-full-screen-${browserName}.png`));
  await shell("chess").getByRole("button", { name: "Enter Full Screen" }).first().click();
  step("Ended, the Space is gone", await until(async () => (await stored())?.spaces?.length === 1));
});

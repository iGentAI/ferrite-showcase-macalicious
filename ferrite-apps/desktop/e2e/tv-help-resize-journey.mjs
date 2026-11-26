#!/usr/bin/env node
// Help > TV Help, and a resizable window opened after another: its bottom edge above the Dock and
// grabbable. Pictures to --out.
//
//   node e2e/tv-help-resize-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { chooseMenu } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("tv-help-resize", { ignoreOtherOrigins: true });

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Calculator");
  await launch(page, "Notes");
  await launch(page, "TV");
  const tv = page.locator('.mac-managed-window[data-window-id="tv"]').first();
  await tv.waitFor({ timeout: 15_000 });

  const frame = await tv.boundingBox();
  const dock = await page.locator(".mac-dock").first().boundingBox();
  step(
    "opened after others, TV's bottom edge is above the Dock",
    frame.y + frame.height <= dock.y,
    `bottom ${frame.y + frame.height}, Dock top ${dock.y}`,
  );
  const handle = await tv.locator('.mac-managed-window-resize[data-edge="s"]').boundingBox();
  const x = handle.x + handle.width / 2;
  const y = handle.y + handle.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 40, { steps: 6 });
  await page.mouse.up();
  const smaller = await tv.boundingBox();
  step(
    "the south edge resizes it",
    Math.abs(smaller.height - (frame.height - 40)) < 3,
    `${frame.height} -> ${smaller.height}`,
  );
  await page.waitForTimeout(400);
  await shot(page, path.join(out, "tv-south-resize.png"));

  await chooseMenu(page, "Help", "TV Help");
  const help = page.locator('[data-window-id="help-viewer"]').first();
  await help.waitFor({ timeout: 8_000 });
  const topic = help.getByText("Watch a video in TV").first();
  await topic.waitFor({ timeout: 10_000 });
  step("Help > TV Help finds TV's topics", await topic.isVisible());
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "tv-help.png"));
  await topic.click();
  await help.getByText("Space plays and pauses").first().waitFor({ timeout: 8_000 });
  step("a TV topic opens on its page", true);
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "tv-help-topic.png"));
});

process.exit(0);

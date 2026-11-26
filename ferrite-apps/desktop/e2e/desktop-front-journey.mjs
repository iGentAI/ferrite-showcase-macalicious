#!/usr/bin/env node
// A press on the desktop makes Finder front while a window shows: the window stays, inactive, and comes
// back by a press on it, its Dock tile or Cycle Through Windows.
//
//   node e2e/desktop-front-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { journey, launch, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("desktop-front");

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
  const front = async () =>
    (await page.getByRole("menubar").first().getByRole("menuitem").nth(1).innerText()).trim();
  const shell = (id) => page.locator(`[data-window-id="${id}"]`);
  const stateOf = (id) =>
    shell(id).locator(".mac-window").first().getAttribute("data-window-state");
  const pressDesktop = async (button = "left") => {
    const box = await shell("chess").boundingBox();
    await page.mouse.click(box.x + box.width + 40, box.y + 200, { button });
    if (button === "right") await page.keyboard.press("Escape");
  };

  await launch(page, "Chess");
  await until(async () => (await front()) === "Chess");
  step("Chess is in front with its window key", (await stateOf("chess")) === "key");

  await pressDesktop();
  step(
    "A click on the desktop makes Finder front",
    await until(async () => (await front()) === "Finder"),
    await front(),
  );
  step(
    "and the window stays, no longer key",
    (await shell("chess").isVisible()) && (await stateOf("chess")) === "inactive",
    await stateOf("chess"),
  );
  await shot(page, path.join(out, `desktop-front-${browserName}.png`));

  await page.locator('[data-window-id="chess"] .mac-title-bar').first().click();
  step(
    "A click on the window brings Chess back",
    await until(async () => (await front()) === "Chess" && (await stateOf("chess")) === "key"),
  );

  await pressDesktop("right");
  step(
    "A secondary click on the desktop does the same",
    await until(async () => (await front()) === "Finder"),
  );
  await page
    .getByRole("toolbar", { name: "Dock" })
    .getByRole("button", { name: "Chess", exact: true })
    .click();
  step(
    "The Dock's tile brings Chess back",
    await until(async () => (await front()) === "Chess" && (await stateOf("chess")) === "key"),
  );

  await pressDesktop();
  await until(async () => (await front()) === "Finder");
  await launch(page, "Calculator");
  step(
    "A window opened after it is key",
    await until(async () => (await front()) === "Calculator"),
  );
});

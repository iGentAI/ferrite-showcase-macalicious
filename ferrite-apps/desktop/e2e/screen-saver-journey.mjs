#!/usr/bin/env node
// Desktop & Screen Saver's Screen Saver tab on a served desktop: Preview with the clock, input taking
// it away and going no further, the choice kept across a reload, and the layer coming up by itself
// after the chosen time with no input. Exits 0 only when every step passed with no console error,
// page error, failed request or HTTP error. Takes about a minute and a half.
//
//   node e2e/screen-saver-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const open = async (page) => {
  await page
    .getByRole("button", { name: /^System Preferences$/ })
    .first()
    .click();
  const window = page.locator('[data-window-id="system-preferences"]');
  await window.waitFor({ timeout: 10_000 });
  // It reopens on the pane last shown, and this journey leaves it on this one.
  const tab = window.getByRole("tab", { name: "Screen Saver" });
  const pane = window.getByRole("button", { name: /^Desktop & Screen Saver/ }).first();
  await tab.or(pane).first().waitFor({ timeout: 10_000 });
  if ((await tab.count()) === 0) await pane.click();
  await tab.click();
  return window;
};

await journey("screen-saver", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  let window = await open(page);
  const layer = page.locator(".mac-system-preferences-screen-saver");

  await window.getByRole("checkbox", { name: "Show with clock" }).click();
  await window.getByRole("button", { name: "Preview" }).click();
  await layer.waitFor();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(out, "screen-saver.png") });
  step("Preview covers the page and shows the time", /\d:\d\d/.test(await layer.innerText()));

  await page.keyboard.press("a");
  await layer.waitFor({ state: "detached", timeout: 2_000 });
  step("a key takes it away", true);

  await window.getByRole("button", { name: "Preview" }).click();
  await layer.waitFor();
  await page.waitForTimeout(600);
  const scrolled = () => page.evaluate(() => [window.scrollX, window.scrollY].join());
  const before = await scrolled();
  await page.mouse.wheel(0, 300);
  await layer.waitFor({ state: "detached", timeout: 2_000 });
  step("a wheel takes it away and scrolls nothing", (await scrolled()) === before);

  await window.getByRole("combobox", { name: "Start after:" }).click();
  await page.getByRole("option", { name: "1 Minute", exact: true }).click();
  await page.screenshot({ path: path.join(out, "screen-saver-tab.png") });
  await page.waitForTimeout(800);
  await reloadDesktop(page);
  window = await open(page);
  step(
    "the choice comes back after a reload",
    (await window.getByRole("combobox", { name: "Start after:" }).innerText()).includes("1 Minute"),
  );

  await layer.waitFor({ timeout: 70_000 });
  step("after a minute with no input it starts by itself", true);
  await page.waitForTimeout(600);
  await page.mouse.move(400, 300);
  await page.mouse.move(420, 320);
  await layer.waitFor({ state: "detached", timeout: 2_000 });
  step("moving the pointer takes it away", true);
});

#!/usr/bin/env node
// Displays and Energy Saver on a served desktop: the brightness slider and Night Shift cover this page,
// let input through, and come back after a reload with System Preferences unopened; Turn display off
// after blanks the page after a minute with no input, and input brings it back. Exits 0 only when every
// step passed with no console error, page error, failed request or HTTP error. Takes about a minute
// and a half.
//
//   node e2e/displays-energy-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const open = async (page, name) => {
  await page
    .getByRole("button", { name: /^System Preferences$/ })
    .first()
    .click();
  const window = page.locator('[data-window-id="system-preferences"]');
  await window.waitFor({ timeout: 10_000 });
  await window.getByRole("button", { name: "Show All" }).click();
  await window
    .getByRole("button", { name: new RegExp(`^${name}`) })
    .first()
    .click();
  return window;
};

await journey("displays-energy", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  let window = await open(page, "Displays");
  const dim = page.locator(".mac-system-preferences-page-dim");
  const warm = page.locator(".mac-system-preferences-page-warm");
  const slider = window.getByRole("slider", { name: "Brightness of this page" });
  await slider.focus();
  for (let i = 0; i < 6; i += 1) await page.keyboard.press("ArrowLeft");
  await dim.waitFor({ state: "attached", timeout: 3_000 });
  const opacity = Number(await dim.evaluate((element) => element.style.opacity));
  step("the slider dims the page", Math.abs(opacity - 0.3) < 0.01, `opacity ${opacity}`);
  await window.getByRole("checkbox", { name: "Night Shift on this page" }).click();
  await warm.waitFor({ state: "attached", timeout: 3_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, "displays-layers.png") });
  const through = await window.getByRole("button", { name: "Show All" }).isEnabled();
  await window.getByRole("button", { name: "Show All" }).click();
  step("Night Shift warms it, and clicks still pass through", through);

  await reloadDesktop(page);
  await dim.waitFor({ state: "attached", timeout: 5_000 });
  await warm.waitFor({ state: "attached", timeout: 5_000 });
  step("both come back after a reload, with System Preferences unopened", true);

  window = await open(page, "Displays");
  await window.getByRole("checkbox", { name: "Night Shift on this page" }).click();
  const back = window.getByRole("slider", { name: "Brightness of this page" });
  await back.focus();
  for (let i = 0; i < 6; i += 1) await page.keyboard.press("ArrowRight");
  await dim.waitFor({ state: "detached", timeout: 3_000 });
  await warm.waitFor({ state: "detached", timeout: 3_000 });
  step("turned back, both go", true);

  window = await open(page, "Energy Saver");
  await window.getByRole("combobox", { name: "Turn display off after:" }).click();
  await page.getByRole("option", { name: "1 Minute", exact: true }).click();
  const layer = page.locator(".mac-system-preferences-screen-saver");
  await layer.waitFor({ state: "attached", timeout: 70_000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(out, "energy-asleep.png") });
  step("after a minute with no input the page goes black", (await layer.innerText()) === "");
  await page.keyboard.press("a");
  await layer.waitFor({ state: "detached", timeout: 2_000 });
  step("a key wakes it", true);
  await window.getByRole("combobox", { name: "Turn display off after:" }).click();
  await page.getByRole("option", { name: "Never", exact: true }).click();
  await page.waitForTimeout(700);
});

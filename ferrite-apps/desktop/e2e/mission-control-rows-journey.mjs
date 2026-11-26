#!/usr/bin/env node
// Mission Control's rows nothing drove: a minimized window left out of the overview, Down Arrow from the
// application switcher to App Exposé, Window's list of windows, and a window's own Full Screen seen from
// the overview.
//
//   node e2e/mission-control-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { journey, launch, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("mission-control-rows");

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
  const picture = (name) =>
    shot(page, path.join(out, `mission-control-rows-${name}-${browserName}.png`));
  const overview = page.getByRole("dialog", { name: "Mission Control" });
  const thumb = (id) => overview.locator(`[data-mission-window="${id}"]`);
  const shell = (id) => page.locator(`[data-window-id="${id}"]`);
  const level = (id) => shell(id).evaluate((one) => Number(getComputedStyle(one).zIndex));
  const bar = page.getByRole("menubar").first();
  for (const name of ["Finder", "Calculator", "Chess"]) await launch(page, name);
  await shell("chess").waitFor({ timeout: 10_000 });

  // A minimized window is left out.
  await page.keyboard.press("F3");
  await overview.waitFor({ timeout: 5_000 });
  step("Mission Control shows all three", (await thumb("calculator").count()) === 1);
  await page.keyboard.press("Escape");
  await until(async () => (await overview.count()) === 0, 3_000);
  await launch(page, "Calculator");
  await shell("calculator").getByRole("button", { name: "Minimize" }).first().click();
  await until(() => shell("calculator").evaluate((one) => one.hasAttribute("data-minimized")));
  await page.keyboard.press("F3");
  await overview.waitFor({ timeout: 5_000 });
  step(
    "A minimized window is left out, the others staying",
    (await thumb("calculator").count()) === 0 &&
      (await thumb("chess").count()) === 1 &&
      (await thumb("finder").count()) === 1,
  );
  await picture("minimized");
  await page.keyboard.press("Escape");
  await until(async () => (await overview.count()) === 0, 3_000);
  await page
    .getByRole("toolbar", { name: "Dock" })
    .getByRole("button", { name: /minimized window/ })
    .first()
    .click();
  await until(() => shell("calculator").evaluate((one) => !one.hasAttribute("data-minimized")));

  // Down Arrow from the switcher.
  await launch(page, "Finder");
  await page.keyboard.down("Alt");
  await page.keyboard.press("Tab");
  const switcher = page
    .getByRole("listbox", { name: /Applications|Switch/ })
    .or(page.locator(".mac-app-switcher"));
  await switcher.first().waitFor({ timeout: 4_000 });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.up("Alt");
  const shownIds = () =>
    overview
      .locator("[data-mission-window]")
      .evaluateAll((all) => all.map((one) => one.getAttribute("data-mission-window")));
  step(
    "Down Arrow in the switcher shows the selected application's windows alone",
    await until(async () => {
      const ids = await shownIds();
      return ids.length > 0 && ids.every((id) => id.startsWith("calculator"));
    }),
    (await shownIds()).join(", "),
  );
  await picture("app-expose");
  await page.keyboard.press("Escape");
  await until(async () => (await overview.count()) === 0, 3_000);

  // Window's list: two windows of the front application, the one behind brought forward from its row.
  await launch(page, "Finder");
  await page.waitForTimeout(800);
  await page.keyboard.press("Control+KeyN");
  await shell("finder:2").waitFor({ timeout: 5_000 });
  const titleOf = async (id) =>
    (await shell(id).locator(".mac-title-bar-title").first().innerText()).trim();
  await shell("finder:2").getByRole("treeitem", { name: "Downloads", exact: true }).first().click();
  await until(async () => (await titleOf("finder:2")) === "Downloads");
  step(
    "The first window is behind the second",
    (await level("finder")) < (await level("finder:2")),
  );
  await bar.getByRole("menuitem", { name: "Window", exact: true }).click();
  const menu = page.getByRole("menu").first();
  await menu.waitFor({ timeout: 4_000 });
  await picture("window-menu");
  const windowRows = menu.getByRole("menuitemradio").or(menu.getByRole("menuitemcheckbox"));
  const labels = (await windowRows.allInnerTexts()).map((label) => label.trim());
  const backTitle = await titleOf("finder");
  step(
    "Window lists both of the front application's windows",
    labels.length === 2 && labels.includes(backTitle) && labels.includes("Downloads"),
    labels.join(" | "),
  );
  await windowRows.filter({ hasText: backTitle }).first().click();
  step(
    "and the row of the one behind brings it forward",
    await until(async () => (await level("finder")) > (await level("finder:2"))),
  );
  await bar.getByRole("menuitem", { name: "Window", exact: true }).click();
  await windowRows.filter({ hasText: "Downloads" }).first().click();
  await until(async () => (await level("finder:2")) > (await level("finder")));
  await shell("finder:2").getByRole("button", { name: "Close" }).first().click();
  await until(async () => (await shell("finder:2").count()) === 0, 4_000);

  // Full Screen, then the bar's own Space.
  await bar.getByRole("menuitem", { name: "View", exact: true }).click();
  await page.getByRole("menuitem", { name: "Enter Full Screen" }).click();
  const full = page.viewportSize();
  step(
    "Full Screen fills the screen",
    await until(async () => (await shell("finder").boundingBox()).width === full.width),
  );
  await picture("full-screen");
  await page.mouse.move(600, 0);
  await page.waitForTimeout(400);
  await bar.getByRole("menuitem", { name: "View", exact: true }).click();
  await page.getByRole("menuitem", { name: "Exit Full Screen" }).click();
  step(
    "and Exit puts it back",
    await until(async () => (await shell("finder").boundingBox()).width < full.width),
  );
});

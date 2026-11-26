#!/usr/bin/env node
// Activity Monitor's Dock icon: View > Dock Icon draws a live graph on the tile while it runs, kept per
// account, and the application's own icon comes back when it quits or when chosen.
//
//   node e2e/activity-dock-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("activity-dock");

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
  await launch(page, "Activity Monitor");
  await page.locator('[data-window-id^="activity-monitor"]').first().waitFor({ timeout: 8_000 });
  const tile = page.locator('[data-dock-target="activity-monitor"]').first();
  const graph = tile.locator(".mac-desktop-shell-activity-icon");
  const choose = async (row) => {
    await page
      .getByRole("menubar")
      .first()
      .getByRole("menuitem", { name: "View", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "Dock Icon", exact: true }).hover();
    await page.getByRole("menuitemradio", { name: row, exact: true }).click();
  };
  step("The tile starts as the application's icon", (await graph.count()) === 0);

  await choose("Show CPU History");
  await graph.waitFor({ timeout: 4_000 });
  step("Show CPU History draws a graph on the tile", await graph.isVisible());
  const readings = () => graph.evaluate((each) => Number(each.dataset.readings));
  const first = await readings();
  step(
    "and it is live, a reading each second",
    await until(async () => (await readings()) >= first + 2),
    `${first} to ${await readings()}`,
  );
  await shot(page, path.join(out, `activity-dock-${browserName}.png`));

  await choose("Show CPU Usage");
  step(
    "Show CPU Usage draws a meter",
    await until(async () => (await graph.getAttribute("data-mode")) === "cpu"),
  );
  await until(async () => {
    const { json } = await api(page, "GET", "/api/system-preferences/settings");
    return json.values?.["activity-monitor.dockIcon"] === "cpu";
  });
  await reloadDesktop(page);
  await graph.waitFor({ timeout: 10_000 });
  step("The choice holds after a reload", (await graph.getAttribute("data-mode")) === "cpu");

  await launch(page, "Activity Monitor");
  await page.waitForTimeout(300);
  await page.keyboard.press("Control+q");
  step(
    "When it quits, the tile shows the application's icon",
    await until(async () => (await graph.count()) === 0),
  );
  await launch(page, "Activity Monitor");
  await graph.waitFor({ timeout: 8_000 });
  await choose("Show Application Icon");
  step(
    "Show Application Icon puts the icon back while it runs",
    await until(async () => (await graph.count()) === 0),
  );
});

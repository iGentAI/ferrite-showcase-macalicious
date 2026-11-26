#!/usr/bin/env node
// Force Quit's place on a served desktop: it stays above another window after a click on that window, the menu bar
// keeps the front application while Force Quit is key, Command-W still closes Force Quit, and its first line says a
// page cannot tell when an app has stopped responding. Exits 0 only when every step passed with no console error,
// page error, failed request or HTTP error.
//
//   node e2e/force-quit-level-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, openDesktop } from "./journey-kit.mjs";

const dock = (page, name) => page.getByRole("button", { name: new RegExp(`^${name}$`) }).first();
const zOf = (locator) => locator.evaluate((el) => Number(getComputedStyle(el).zIndex));

await journey("force-quit-level", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  await dock(page, "Calculator").click();
  const calculator = page.locator('[data-window-id="calculator"]');
  await calculator.waitFor({ timeout: 10_000 });

  await page.keyboard.press("Control+Alt+Escape");
  const panel = page.locator('[data-window-id="force-quit"]');
  await panel.waitFor({ timeout: 5_000 });
  const appMenu = page.getByRole("menubar").getByRole("menuitem").nth(1);
  await page.waitForTimeout(200);
  const front = (await appMenu.innerText()).trim();
  step("the menu bar stays Calculator's while Force Quit is key", front === "Calculator", front);
  step(
    "the first line says a page cannot tell when an app stops responding",
    await panel.getByText(/can’t tell when an app has stopped responding/).isVisible(),
  );
  await page.screenshot({ path: path.join(out, "force-quit-level.png") });

  const box = await calculator.boundingBox();
  await page.mouse.move(box.x + 60, box.y + 11);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(200);
  const above = (await zOf(panel)) > (await zOf(calculator));
  step(
    "a click on another window leaves it on top",
    above,
    `${await zOf(panel)} over ${await zOf(calculator)}`,
  );

  await panel.getByText("Force Quit Applications").first().click();
  await page.keyboard.press("Control+w");
  await panel.waitFor({ state: "detached", timeout: 5_000 });
  step("Command-W closes Force Quit, not the window behind it", await calculator.isVisible());

  await calculator.locator("button").first().click();
  await calculator.waitFor({ state: "detached", timeout: 5_000 });
  await page.getByRole("menubar").getByRole("menuitem").first().click();
  await page.getByRole("menuitem", { name: /^Force Quit/ }).click();
  await panel.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(200);
  const alone = (await appMenu.innerText()).trim();
  step("with nothing else open the menu bar is Finder's", alone === "Finder", alone);
});

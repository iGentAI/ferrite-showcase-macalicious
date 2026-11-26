#!/usr/bin/env node
// Force Quit on Ferrite: with Calculator and Maps open on the Ferrite-served
// desktop, Force Quit (from the Apple menu) lists them and Finder; quitting
// Maps closes its window and takes it out of the list, and relaunching Finder
// keeps Finder listed. Force Quit is client-only: it acts on the desktop's
// window manager and calls no route of its own. Exits 0 only when every step
// passed and the page logged no console error, page error, failed request or
// HTTP error.
//
//   ferrite dev                                        # in ferrite-apps/desktop
//   node e2e/force-quit-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { journey, launch, openDesktop, options } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("force-quit");

const windowOf = (page, id) => page.locator(`[data-window-id="${id}"]`);

await run(async (page) => {
  await openDesktop(page, base, step);
  for (const [name, id] of [
    ["Calculator", "calculator"],
    ["Maps", "maps"],
  ]) {
    await launch(page, name);
    await windowOf(page, id).waitFor({ state: "visible", timeout: 10_000 });
  }
  step("Calculator and Maps are open", true);

  await page
    .getByRole("menuitem", { name: "Apple" })
    .or(page.getByRole("button", { name: "Apple" }))
    .first()
    .click();
  await page.getByRole("menuitem", { name: /^Force Quit…/ }).click();
  const window = page.getByRole("region", { name: "Force Quit Applications" }).first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  const rows = () => window.getByRole("option").or(window.getByRole("row")).allInnerTexts();
  const listed = (await rows()).map((text) => text.trim());
  step(
    "Force Quit lists the running apps and Finder last",
    JSON.stringify(listed) === JSON.stringify(["Calculator", "Maps", "Finder"]),
    JSON.stringify(listed),
  );

  await window.getByText("Maps", { exact: true }).click();
  await window.getByRole("button", { name: "Force Quit" }).click();
  await page.screenshot({ path: path.join(out, "force-quit-confirm.png") });
  await page.getByRole("dialog").getByRole("button", { name: "Force Quit" }).click();
  await windowOf(page, "maps").waitFor({ state: "detached", timeout: 10_000 });
  step("confirming closes the Maps window", (await windowOf(page, "maps").count()) === 0);
  await page.waitForFunction(
    () => !document.querySelector('[data-window-id="force-quit"]')?.textContent?.includes("Maps"),
    undefined,
    { timeout: 5_000 },
  );
  const after = (await rows()).map((text) => text.trim());
  step(
    "and Maps leaves the list",
    JSON.stringify(after) === JSON.stringify(["Calculator", "Finder"]),
    JSON.stringify(after),
  );
  step("Calculator keeps running", await windowOf(page, "calculator").isVisible());

  await window.getByText("Finder", { exact: true }).click();
  step(
    "Finder offers Relaunch",
    (await window.getByRole("button", { name: "Relaunch" }).count()) === 1,
  );
  await page.screenshot({ path: path.join(out, "force-quit.png") });
});

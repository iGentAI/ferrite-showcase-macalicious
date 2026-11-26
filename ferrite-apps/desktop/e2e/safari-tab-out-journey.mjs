#!/usr/bin/env node
// Safari's windows on Ferrite: a tab dragged out of the bar becomes a window of its own, with a real
// mouse; Quit closes both windows, and History > Reopen All Windows from Last Session brings back
// the one that does not keep the tabs.
//
//   node e2e/safari-tab-out-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { chooseMenu, menuItemState } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("safari-tab-out", { ignoreOtherOrigins: true });
const SESSION = "Reopen All Windows from Last Session";
const HOST = "news.ycombinator.com";

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Safari");
  const windows = page.locator(".mac-safari");
  const first = windows.first();
  await first.waitFor({ state: "visible", timeout: 15_000 });
  step(
    "Reopen All Windows is dimmed before any session has ended",
    (await menuItemState(page, "History", SESSION)).disabled === true,
  );

  const field = first
    .getByRole("combobox", { name: "Search or enter website name" })
    .or(first.getByRole("textbox", { name: "Search or enter website name" }))
    .first();
  await field.click();
  await field.fill(HOST);
  await field.press("Enter");
  await first.locator("iframe[srcdoc]").waitFor({ timeout: 30_000 });
  await chooseMenu(page, "File", "New Tab");
  const tabs = first.getByRole("tab");
  await page.waitForFunction(
    () => document.querySelectorAll('.mac-safari [role="tab"]').length === 2,
  );

  const box = await tabs.first().boundingBox();
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 10, start.y + 10, { steps: 3 });
  await page.mouse.move(start.x + 40, start.y + 160, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".mac-safari").length === 2 &&
      document.querySelectorAll(".mac-safari iframe[srcdoc]").length === 1,
    undefined,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(500);
  step("a tab let go away from the bar opens in a window of its own", true);
  const pages = await windows.evaluateAll((all) =>
    all.map((window) => window.querySelector("iframe[srcdoc]") !== null),
  );
  step(
    "that window holds the page, and the first keeps its other tab",
    pages.filter(Boolean).length === 1 && (await first.getByRole("tab").count()) === 0,
    JSON.stringify(pages),
  );
  const frontIsThePage = await page.evaluate(() => {
    const inFront = [...document.querySelectorAll(".mac-safari")].find(
      (window) => window.closest('[data-window-state="key"]') !== null,
    );
    return inFront?.querySelector("iframe[srcdoc]") !== null && inFront !== undefined;
  });
  step("the new window comes to the front, and has the keyboard", frontIsThePage);
  await shot(page, path.join(out, "safari-tab-out.png"));

  await chooseMenu(page, "Safari", "Quit Safari");
  await windows.first().waitFor({ state: "detached", timeout: 10_000 });
  await launch(page, "Safari");
  await first.waitFor({ state: "visible", timeout: 15_000 });
  step("Safari opens again with one window", (await windows.count()) === 1);
  await chooseMenu(page, "History", SESSION);
  await page.waitForFunction(
    () => document.querySelectorAll(".mac-safari").length === 2,
    undefined,
    {
      timeout: 10_000,
    },
  );
  await page.waitForTimeout(800);
  step(
    "History > Reopen All Windows from Last Session brings the other window back",
    (await windows.evaluateAll(
      (all) => all.filter((window) => window.textContent?.includes("news.ycombinator.com")).length,
    )) === 1,
  );
  await shot(page, path.join(out, "safari-reopen-session.png"));
  step("and it is dimmed again", (await menuItemState(page, "History", SESSION)).disabled === true);
});

process.exit(0);

#!/usr/bin/env node
// Safari's status bar on Ferrite: shown from the View menu and kept, naming the link under the pointer
// inside a real page, and the View rows dimmed with their reasons.
//
//   node e2e/safari-status-bar-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, menuItemState } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("safari-status-bar", { ignoreOtherOrigins: true });

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Safari");
  const window = page.getByRole("region", { name: "Safari", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  const go = async () => {
    const field = window
      .getByRole("combobox", { name: "Search or enter website name" })
      .or(window.getByRole("textbox", { name: "Search or enter website name" }))
      .first();
    await field.click();
    await field.fill("news.ycombinator.com");
    await field.press("Enter");
    await window.locator("iframe[srcdoc]").waitFor({ timeout: 30_000 });
  };
  await go();
  const bar = window.locator(".mac-safari-status-bar");
  step("the status bar starts hidden", (await bar.count()) === 0);
  await chooseMenu(page, "View", "Show Status Bar");
  await bar.waitFor({ timeout: 5_000 });
  step("View > Show Status Bar shows it", true);

  const link = page
    .frameLocator(".mac-safari iframe[srcdoc]")
    .locator('[data-safari-href*="newest"]')
    .first();
  await link.hover();
  await page.waitForTimeout(300);
  const named = await bar.innerText();
  step("over a link it names the address", /Open .*newest/.test(named), named);
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "safari-status-bar.png"));
  await page
    .frameLocator(".mac-safari iframe[srcdoc]")
    .locator("body")
    .hover({ position: { x: 5, y: 5 } });
  await page.waitForTimeout(300);
  step("away from a link it is empty", (await bar.innerText()).trim() === "");

  // Straight from a link out of the page, over the window's own toolbar, and back to the same link.
  await link.hover();
  await page.waitForTimeout(300);
  await window.getByRole("button", { name: "Share" }).first().hover();
  await page.waitForTimeout(300);
  step("leaving the page from a link empties it", (await bar.innerText()).trim() === "");
  await link.hover();
  await page.waitForTimeout(300);
  step("back on the same link it names it again", /Open .*newest/.test(await bar.innerText()));

  // The key, while the page has the keyboard.
  await page
    .frameLocator(".mac-safari iframe[srcdoc]")
    .locator("body")
    .click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("ControlOrMeta+/");
  await bar.waitFor({ state: "detached", timeout: 5_000 });
  await page.keyboard.press("ControlOrMeta+/");
  await bar.waitFor({ timeout: 5_000 });
  step("Command-/ hides and shows it while the page has the keyboard", true);

  for (const [row, words] of [
    ["Customize Toolbar…", "one arrangement"],
    ["Text Encoding", "encoding the page names"],
  ]) {
    const state = await menuItemState(page, "View", row);
    step(
      `View > ${row} is dimmed, saying why`,
      state.disabled === true && (state.title ?? "").includes(words),
      state.title ?? "",
    );
  }
  await page.getByRole("menubar").getByRole("menuitem", { name: "View", exact: true }).click();
  await page.getByRole("menuitem", { name: "Text Encoding" }).waitFor({ timeout: 5_000 });
  await shot(page, path.join(out, "safari-view-menu.png"));
  await page.keyboard.press("Escape");

  await page.waitForTimeout(1_000);
  await reloadDesktop(page);
  await launch(page, "Safari");
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await bar.waitFor({ timeout: 10_000 });
  step("it is still shown after a reload", true);
  await chooseMenu(page, "View", "Hide Status Bar");
  await bar.waitFor({ state: "detached", timeout: 5_000 });
  step("View > Hide Status Bar hides it", true);
});

process.exit(0);

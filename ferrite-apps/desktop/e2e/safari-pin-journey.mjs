#!/usr/bin/env node
// Safari's pinned tabs on Ferrite: pin from the tab's menu and the Window menu, kept across a reload,
// first in the bar, staying through Close Other Tabs and Command-W; read back from the server.
//
//   node e2e/safari-pin-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, menuItemState } from "./media-census-kit.mjs";

const COMMAND = process.platform === "darwin" ? "Meta" : "Control";
const { base, out } = options();
const { step, run } = journey("safari-pin", { ignoreOtherOrigins: true });
const kept = async (page) => (await api(page, "GET", "/api/safari/tabs")).json;
const keptWith = async (page, wanted) => {
  for (let tries = 0; tries < 30; tries += 1) {
    const doc = await kept(page);
    if (wanted(doc)) return doc;
    await page.waitForTimeout(250);
  }
  return kept(page);
};

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Safari");
  const window = page.getByRole("region", { name: "Safari", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  const go = async (address) => {
    const field = window
      .getByRole("combobox", { name: "Search or enter website name" })
      .or(window.getByRole("textbox", { name: "Search or enter website name" }))
      .first();
    await field.click();
    await field.fill(address);
    await field.press("Enter");
    await window.locator("iframe[srcdoc]").waitFor({ timeout: 30_000 });
  };
  await go("news.ycombinator.com");
  await chooseMenu(page, "File", "New Tab");
  await page.waitForTimeout(300);
  await go("text.npr.org");
  await chooseMenu(page, "File", "New Tab");
  const bar = window.getByRole("tablist", { name: "Tabs" });
  const tab = (name) => bar.getByRole("tab", { name });
  await page.waitForTimeout(300);
  step("three tabs are open", (await bar.getByRole("tab").count()) === 3);

  // ---- Pin from the tab's menu ----------------------------------------------------------------
  await bar.getByRole("tab").nth(1).click({ button: "right" });
  const pin = page.getByRole("menuitem", { name: "Pin Tab", exact: true });
  await pin.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "safari-tab-pin-menu.png"));
  await pin.click();
  const pinned = await keptWith(page, (doc) => doc.pinned === 1);
  step(
    "the tab's menu pins it, and it moves to the front of the bar",
    pinned.pinned === 1 && pinned.tabs[0].includes("npr"),
    JSON.stringify(pinned.tabs),
  );
  step(
    "a pinned tab has no close button",
    (await tab(/, pinned$/)
      .locator(".mac-safari-tab-bar-close")
      .count()) === 0,
  );
  step(
    "its letter shows in the small tab",
    (
      await tab(/, pinned$/)
        .locator("span")
        .last()
        .boundingBox()
    )?.width > 4,
  );
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "safari-pinned-tab.png"));

  // ---- It stays ---------------------------------------------------------------------------------
  await reloadDesktop(page);
  await launch(page, "Safari");
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await tab(/, pinned$/).waitFor({ timeout: 15_000 });
  step("after a reload it is still pinned, and first", true);

  await bar.getByRole("tab").nth(1).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Close Other Tabs" }).click();
  const others = await keptWith(page, (doc) => doc.tabs.length === 2);
  step("Close Other Tabs leaves it open", others.pinned === 1 && others.tabs.length === 2);

  await tab(/, pinned$/).click();
  await page.waitForTimeout(300);
  await page.keyboard.press(`${COMMAND}+w`);
  const closing = await keptWith(page, (doc) => doc.active === 1);
  step(
    "Command-W on it shows the next tab, and closes nothing",
    closing.active === 1 && closing.tabs.length === 2,
    JSON.stringify(closing),
  );

  await tab(/, pinned$/).click();
  const state = await menuItemState(page, "Window", "Unpin Tab");
  step("the Window menu offers Unpin Tab", state.disabled === false, JSON.stringify(state));
  await chooseMenu(page, "Window", "Unpin Tab");
  const unpinned = await keptWith(page, (doc) => doc.pinned === undefined);
  step("Window > Unpin Tab unpins it", unpinned.pinned === undefined, JSON.stringify(unpinned));
});

process.exit(0);

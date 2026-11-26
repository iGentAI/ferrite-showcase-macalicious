#!/usr/bin/env node
// Mission Control's keyboard and mouse shortcuts: holding a modifier with the pop-up open changes its rows to those shortcuts,
// the chosen one opens Mission Control and the plain key no longer does; a mouse button can be bound too, including the back
// button, which a page has to take from the browser; all of them are kept across a reload. Exits 0 only when every step passed
// with no console error, page error, failed request or HTTP error.
//
//   node e2e/mission-control-shortcuts-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, nextSave, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const SETTINGS = "/api/system-preferences/settings";

await journey("mission-control-shortcuts", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  const overview = page.getByRole("dialog", { name: "Mission Control" });
  const openPane = async () => {
    await page
      .getByRole("button", { name: /^System Preferences$/ })
      .first()
      .click();
    const prefs = page.locator('[data-window-id="system-preferences"]');
    await prefs.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(800);
    if ((await prefs.getByRole("combobox").count()) === 0)
      await prefs.getByRole("button", { name: "Mission Control", exact: true }).first().click();
    await prefs
      .getByRole("combobox", { name: "Mission Control:", exact: true })
      .waitFor({ timeout: 8_000 });
  };
  await openPane();
  const popUp = (name) =>
    page
      .locator('[data-window-id="system-preferences"]')
      .getByRole("combobox", { name, exact: true });

  await popUp("Mission Control:").click();
  await page.keyboard.down("Shift");
  const shifted = page.getByRole("option", { name: "⇧F6", exact: true });
  await shifted.waitFor({ timeout: 5_000 });
  step("holding Shift with the menu open offers Shift shortcuts", true);
  await page.screenshot({ path: path.join(out, "mission-control-shift-menu.png") });
  let saved = nextSave(page, SETTINGS);
  await shifted.click();
  await page.keyboard.up("Shift");
  await saved;
  step(
    "the pop-up shows the shortcut chosen",
    /⇧F6/.test(await popUp("Mission Control:").innerText()),
  );

  await page.keyboard.press("F6");
  await page.waitForTimeout(400);
  step("the plain key no longer opens Mission Control", (await overview.count()) === 0);
  await page.keyboard.press("Shift+F6");
  await overview.waitFor({ timeout: 5_000 });
  step("Shift-F6 opens Mission Control", true);
  await page.keyboard.press("Escape");
  await overview.waitFor({ state: "detached", timeout: 5_000 });

  await popUp("Application windows:").click();
  await page.keyboard.down("Alt");
  const option = page.getByRole("option", { name: "⌥F7", exact: true });
  await option.waitFor({ timeout: 5_000 });
  saved = nextSave(page, SETTINGS);
  await option.click();
  await page.keyboard.up("Alt");
  await saved;
  step("holding Option offers Option shortcuts", true);

  const mouse = popUp("Mission Control: mouse button");
  await mouse.click();
  saved = nextSave(page, SETTINGS);
  await page.getByRole("option", { name: "Mouse Button 3", exact: true }).click();
  await saved;
  await page.mouse.click(1000, 500, { button: "middle" });
  await overview.waitFor({ timeout: 5_000 });
  step("the middle button, once bound, opens Mission Control", true);
  await page.keyboard.press("Escape");
  await overview.waitFor({ state: "detached", timeout: 5_000 });

  await page.evaluate(() => {
    const link = document.createElement("a");
    link.id = "journey-link";
    link.href = "/";
    link.textContent = "a link";
    link.style.cssText = "position:fixed;left:1100px;top:700px;z-index:99999";
    document.body.append(link);
  });
  const pagesBefore = page.context().pages().length;
  await page.locator("#journey-link").click({ button: "middle" });
  await overview.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(500);
  step(
    "a middle click on a link opens Mission Control and no tab",
    page.context().pages().length === pagesBefore,
  );
  await page.evaluate(() => document.getElementById("journey-link")?.remove());
  await page.keyboard.press("Escape");
  await overview.waitFor({ state: "detached", timeout: 5_000 });

  await mouse.click();
  saved = nextSave(page, SETTINGS);
  await page.getByRole("option", { name: "Mouse Button 4", exact: true }).click();
  await saved;
  const address = page.url();
  await page.mouse.move(1000, 500);
  const cdp = await page.context().newCDPSession(page);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await cdp.send("Input.dispatchMouseEvent", {
      type,
      button: "back",
      buttons: type === "mousePressed" ? 8 : 0,
      x: 1000,
      y: 500,
      clickCount: 1,
    });
  }
  await overview.waitFor({ timeout: 5_000 });
  step("the back button opens it instead of going back a page", page.url() === address);
  await page.keyboard.press("Escape");
  await overview.waitFor({ state: "detached", timeout: 5_000 });
  await page.screenshot({ path: path.join(out, "mission-control-shortcuts.png") });

  await reloadDesktop(page);
  await openPane();
  step(
    "all of them are the same after a reload",
    /⇧F6/.test(await popUp("Mission Control:").innerText()) &&
      /⌥F7/.test(await popUp("Application windows:").innerText()) &&
      /Mouse Button 4/.test(await mouse.innerText()),
  );
  await page.keyboard.press("Shift+F6");
  await overview.waitFor({ timeout: 5_000 });
  step("and the chosen shortcut still opens it", true);
});

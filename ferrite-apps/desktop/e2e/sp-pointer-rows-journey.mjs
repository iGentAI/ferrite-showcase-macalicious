#!/usr/bin/env node
// Mouse's and Trackpad's rows on the served desktop. What belongs to the computer is dimmed with its reason and says it shows
// Catalina's defaults, the callouts still follow the pointer and the keyboard, and the other tabs say what reaches a page. Mouse's
// Scroll direction is real: off, a wheel scrolls this desktop's views the other way, also after a reload, and on again the usual way.
// The wheel is the browser's real wheel event sent by Playwright, not a person's mouse. Exits 0 only when every step passed with no
// console error, page error, failed request or HTTP error.
//
//   node e2e/sp-pointer-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, nextSave, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const SETTINGS = "/api/system-preferences/settings";
const TRACKPAD = "A web page can neither read nor change how your trackpad works.";
const MOUSE = "A web page can neither read nor change how your mouse works.";

await journey("sp-pointer-rows", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  const prefs = page.locator('[data-window-id="system-preferences"]');
  const rows = prefs.locator("[data-gesture]");
  await page
    .getByRole("button", { name: /^System Preferences$/ })
    .first()
    .click();
  await prefs.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(600);
  const openPane = async (name) => {
    await page.keyboard.press("Control+l");
    await prefs.getByRole("group", { name: "All preferences" }).waitFor({ timeout: 5_000 });
    await prefs.getByRole("button", { name, exact: true }).first().click();
    await prefs.getByRole("tablist", { name }).waitFor({ timeout: 8_000 });
    await page.waitForTimeout(300);
  };
  const says = (pattern) => prefs.getByText(pattern).first().isVisible();
  const highlighted = (row) => row.evaluate((node) => node.hasAttribute("data-highlighted"));

  // Trackpad.
  await openPane("Trackpad");
  await page.screenshot({ path: path.join(out, "trackpad-pane.png") });
  const trackpadBoxes = await prefs.getByRole("checkbox").all();
  let allDimmed = trackpadBoxes.length === 4;
  for (const box of trackpadBoxes) allDimmed &&= await box.isDisabled();
  step("every Trackpad check box is dimmed", allDimmed, `${trackpadBoxes.length}`);
  for (const name of ["Click", "Tracking speed"]) {
    step(`Trackpad's ${name} is dimmed`, await prefs.getByRole("slider", { name }).isDisabled());
  }
  const force = prefs.getByRole("checkbox", { name: /^Force Click/ });
  step("Force Click gives the reason", (await force.getAttribute("title")) === TRACKPAD);
  step(
    "the gestures give the reason",
    (await rows.first().locator("xpath=..").getAttribute("title")) === TRACKPAD,
  );
  const lookUpChoice = rows.first().getByRole("button", { name: "Force Click with one finger" });
  step("the way to make a gesture is dimmed too", await lookUpChoice.isDisabled());
  const pair = prefs.getByRole("button", { name: "Set Up Bluetooth Trackpad..." });
  step(
    "Set Up Bluetooth Trackpad is dimmed with the reason",
    (await pair.isDisabled()) &&
      (await pair.getAttribute("title")) === "A web page cannot pair a trackpad.",
  );
  step(
    "the pane says the dimmed values are not this computer's",
    await says(/show Catalina's defaults, not this computer's/),
  );
  await rows.last().hover();
  await page.waitForTimeout(250);
  step("Trackpad's callout follows the pointer", await highlighted(rows.last()));
  await page.screenshot({ path: path.join(out, "trackpad-callout.png") });
  await rows.first().hover();
  await page.waitForTimeout(150);
  await rows.last().focus();
  await page.waitForTimeout(250);
  step("and the keyboard, though the row is dimmed", await highlighted(rows.last()));

  await prefs.getByRole("tab", { name: "Scroll & Zoom" }).click();
  step("Scroll & Zoom says what reaches a page", await says(/two fingers scroll the view/));
  await page.screenshot({ path: path.join(out, "trackpad-scroll.png") });
  await prefs.getByRole("tab", { name: "More Gestures" }).click();
  step("More Gestures says what reaches a page", await says(/do not reach a web page/));
  await prefs.getByRole("tab", { name: "Point & Click" }).click();

  // Mouse.
  await openPane("Mouse");
  await page.screenshot({ path: path.join(out, "mouse-pane.png") });
  const natural = prefs.getByRole("checkbox", { name: "Scroll direction: Natural" });
  step("Scroll direction can be changed", await natural.isEnabled());
  for (const [name, id] of [
    ["Secondary click", "secondary-click"],
    ["Smart zoom", "smart-zoom"],
  ]) {
    step(`${name} is dimmed`, await prefs.getByRole("checkbox", { name }).isDisabled());
    step(
      `and its row gives the reason`,
      (await prefs.locator(`[data-gesture="${id}"]`).locator("xpath=..").getAttribute("title")) ===
        MOUSE,
    );
  }
  step(
    "Tracking speed is dimmed",
    await prefs.getByRole("slider", { name: "Tracking speed" }).isDisabled(),
  );
  const pairMouse = prefs.getByRole("button", { name: "Set Up Bluetooth Mouse…" });
  step(
    "Set Up Bluetooth Mouse is dimmed with the reason",
    (await pairMouse.isDisabled()) &&
      (await pairMouse.getAttribute("title")) === "A web page cannot pair a mouse.",
  );
  step("the pane says what Scroll direction reaches", await says(/mouse and a trackpad alike/));
  step(
    "the battery is said to be out of reach, and no level is invented",
    (await says(/cannot read your mouse's battery/)) &&
      (await prefs.getByText("100%").count()) === 0,
  );
  await rows.last().hover();
  await page.waitForTimeout(250);
  step("Mouse's callout follows the pointer", await highlighted(rows.last()));
  await rows.first().hover();
  await page.waitForTimeout(150);
  await rows.last().focus();
  await page.waitForTimeout(250);
  step("and the keyboard", await highlighted(rows.last()));
  await prefs.getByRole("tab", { name: "More Gestures" }).click();
  step("Mouse's More Gestures says what reaches a page", await says(/do not reach a web page/));
  await prefs.getByRole("tab", { name: "Point & Click" }).click();

  // Scroll direction, on Sound's list of alerts: a scrolling view of the desktop's own.
  const scrollList = async () => {
    await page.keyboard.press("Control+l");
    await prefs.getByRole("group", { name: "All preferences" }).waitFor({ timeout: 5_000 });
    await prefs.getByRole("button", { name: "Sound", exact: true }).first().click();
    const row = prefs.getByRole("row", { name: "Glass" });
    await row.waitFor({ timeout: 8_000 });
    await row.hover();
    await page.evaluate(() => {
      const scrolls = (node) =>
        /auto|scroll/.test(getComputedStyle(node).overflowY) &&
        node.scrollHeight > node.clientHeight;
      let node = document.querySelector(
        '[data-window-id="system-preferences"] [role="grid"] [role="row"]',
      );
      while (node && !scrolls(node)) node = node.parentElement;
      window.__list = node;
      node.scrollTop = 40;
    });
  };
  const wheeled = async (by) => {
    const before = await page.evaluate(() => window.__list.scrollTop);
    await page.mouse.wheel(0, by);
    await page.waitForTimeout(300);
    return (await page.evaluate(() => window.__list.scrollTop)) - before;
  };
  await scrollList();
  let moved = await wheeled(16);
  step(
    "with Natural on, a wheel down scrolls down, as the computer sends it",
    moved > 0,
    `${moved}`,
  );

  const setNatural = async (on) => {
    await openPane("Mouse");
    const saved = nextSave(
      page,
      SETTINGS,
      (body) => body?.values?.["mouse.naturalScrolling"] === on,
    );
    await natural.click();
    await saved;
  };
  await setNatural(false);
  await scrollList();
  moved = await wheeled(16);
  step("with Natural off, the same wheel scrolls up", moved < 0, `${moved}`);
  await page.screenshot({ path: path.join(out, "mouse-reversed.png") });

  await reloadDesktop(page);
  await page
    .getByRole("button", { name: /^System Preferences$/ })
    .first()
    .click();
  await prefs.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(600);
  await scrollList();
  moved = await wheeled(16);
  step("and still after a reload", moved < 0, `${moved}`);
  await setNatural(true);
  await scrollList();
  moved = await wheeled(16);
  step("on again, it scrolls down", moved > 0, `${moved}`);
});

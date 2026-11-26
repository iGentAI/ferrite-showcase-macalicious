#!/usr/bin/env node
// System Information's everyday parts on a served desktop, each with a screenshot: the outline's Browser and Ferrite
// Application with their children, expanding and collapsing, arrow keys, a table's sort, the selected row's details, the
// path bar, Edit's dimmed Undo, and About This Mac's System Report. Exits 0 only when every step passed with no console
// error, page error, failed request or HTTP error.
//
//   node e2e/system-information-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, openDesktop } from "./journey-kit.mjs";

const menu = async (page, title) => {
  const item = page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
  await item.click();
  await page.waitForTimeout(150);
  if ((await item.getAttribute("aria-expanded")) !== "true") await item.click();
};

await journey("system-information-rows", async ({ page, base, out, step }) => {
  const shot = async (name) => {
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(out, `si-rows-${name}.png`) });
  };
  await openDesktop(page, base);
  await page
    .getByRole("button", { name: /^System Information$/ })
    .first()
    .click();
  const window = page.locator('[data-window-id="system-information"]');
  await window.waitFor({ timeout: 10_000 });
  const outline = window.getByRole("treegrid", { name: "Categories" });
  const entry = (name) => outline.getByText(name, { exact: true }).first();
  const report = () => window.locator(".mac-system-information-pane").innerText();

  await entry("Browser").click();
  await page.waitForTimeout(300);
  await shot("browser");
  step("Browser reports the browser", /User Agent:[\s\S]*Logical Processors:/.test(await report()));
  await entry("Display").click();
  await page.waitForTimeout(300);
  await shot("display");
  step("Browser > Display reports the screen", /Width|Resolution|Pixel/i.test(await report()));
  await entry("Storage").click();
  await page.waitForTimeout(300);
  await shot("storage");
  step(
    "Browser > Storage reports the browser's storage",
    /Quota|Usage|Estimate/i.test(await report()),
  );

  await entry("Browser").click();
  await page.waitForTimeout(200);
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(300);
  await shot("collapsed");
  step(
    "Arrow Left collapses Browser",
    (await outline.getByText("Display", { exact: true }).count()) === 0,
  );
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(300);
  step(
    "Arrow Right expands it",
    (await outline.getByText("Display", { exact: true }).count()) === 1,
  );
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(300);
  await shot("arrow-down");
  step("Arrow Down goes to its first child", /Width|Resolution|Pixel/i.test(await report()));

  await entry("Ferrite Application").click();
  await window.getByText("Server Clock:").waitFor({ timeout: 8_000 });
  await shot("ferrite");
  step("Ferrite Application reports the application", true);
  await entry("App Modules").click();
  const modules = window.getByRole("grid", { name: "App Modules" });
  await modules.waitFor({ timeout: 8_000 });
  const rows = () => modules.locator('[role="row"][aria-selected]');
  const heading = modules.getByRole("columnheader").first();
  await heading.click();
  await page.waitForTimeout(200);
  const top = await rows().first().innerText();
  await heading.click();
  await page.waitForTimeout(200);
  await shot("sorted");
  step(
    "a table's heading sorts it, and a second press reverses",
    (await rows().first().innerText()) !== top,
  );
  await rows().first().click();
  await page.waitForTimeout(300);
  await shot("row-details");
  const name = (await rows().first().getByRole("gridcell").first().innerText()).trim();
  const below = await window
    .locator(".mac-system-information-section, .mac-system-information-entries")
    .allInnerTexts();
  step("the selected row's details show below", below.join(" ").includes(name), name);
  const pathBar = window
    .getByRole("navigation", { name: "Path" })
    .or(window.locator('[aria-label="Path"]'))
    .first();
  step(
    "the path bar names where the report is",
    /Ferrite Application/.test(await pathBar.innerText()),
    await pathBar.innerText(),
  );
  await entry("Session Storage").click();
  await page.waitForTimeout(400);
  await shot("session-storage");
  step(
    "Session Storage lists what the session keeps",
    /Module[\s\S]*Keys[\s\S]*System Preferences/.test(await report()),
  );

  await menu(page, "Edit");
  await shot("edit-menu");
  const undo = page.getByRole("menuitem", { name: /^Undo/ });
  step("Undo is listed and dimmed", (await undo.getAttribute("aria-disabled")) === "true");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  await menu(page, "Window");
  await page.getByRole("menuitem", { name: "About This Mac", exact: true }).click();
  const about = page.locator('[data-window-id="about-this-mac"]');
  await about.waitFor({ timeout: 8_000 });
  await shot("about-this-mac");
  step("Window > About This Mac opens it", true);
  await window.getByRole("button", { name: /close/i }).first().click();
  await window.waitFor({ state: "detached", timeout: 5_000 });
  await about.getByRole("button", { name: "System Report…" }).click();
  await window.waitFor({ timeout: 8_000 });
  await shot("system-report");
  step("About This Mac's System Report opens System Information", true);
});

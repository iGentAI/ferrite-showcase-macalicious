#!/usr/bin/env node
// Activity Monitor's menus on a served desktop: View's views and frequency, kept across a reload;
// Quit Process on two applications at once from the keyboard, Inspect Process, the row's menu and
// Find. Exits 0 only when every step passed with no console error, page error, failed request or
// HTTP error.
//
//   node e2e/activity-monitor-depth-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, nextSave, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const SETTINGS = "/api/system-preferences/settings";
const dock = (page, name) => page.getByRole("button", { name: new RegExp(`^${name}$`) }).first();
/** A title's menu, opened: after an Escape the menu bar still opens on hover, so a click can close it. */
const menu = async (page, title) => {
  const item = page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
  await item.click();
  await page.waitForTimeout(150);
  if ((await item.getAttribute("aria-expanded")) !== "true") await item.click();
};

await journey("activity-monitor-depth", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  for (const name of ["Calculator", "Chess"]) {
    await dock(page, name).click();
    await page.locator(`[data-window-id="${name.toLowerCase()}"]`).waitFor({ timeout: 10_000 });
  }
  await dock(page, "Activity Monitor").click();
  const monitor = page.locator('[data-window-id="activity-monitor"]');
  await monitor.waitFor();
  const grid = monitor.getByRole("grid");

  await grid.getByText("Calculator").click();
  await grid.getByText("Chess").click({ modifiers: ["Control"] });
  await menu(page, "View");
  await page.screenshot({ path: path.join(out, "am-view-menu.png") });
  await page.keyboard.press("Escape");

  await grid.getByText("Calculator").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Quit Process" }).waitFor();
  step("a selected row's menu offers Quit Process", true);
  await page.keyboard.press("Escape");

  await page.keyboard.press("Control+i");
  const calculatorInspector = page.locator(
    '[data-window-id="activity-monitor:inspect-calculator"]',
  );
  await calculatorInspector.getByText("Windows:").waitFor({ timeout: 5_000 });
  await calculatorInspector.getByText(/no process id/).waitFor();
  await page.locator('[data-window-id="activity-monitor:inspect-chess"]').waitFor();
  step(
    "Inspect Process opens a window for each selected application, and says what it cannot",
    true,
  );
  await page.screenshot({ path: path.join(out, "am-inspector.png") });
  for (const id of ["chess", "calculator"]) {
    await page
      .locator(`[data-window-id="activity-monitor:inspect-${id}"]`)
      .getByRole("button", { name: /close/i })
      .first()
      .click();
  }
  await calculatorInspector.waitFor({ state: "detached" });

  await menu(page, "Window");
  await page.getByRole("menuitem", { name: "CPU Usage" }).click();
  const usagePanel = page.locator('[data-window-id="activity-monitor:cpu-usage"]');
  await usagePanel.getByText(/main thread: \d+\.\d% busy/).waitFor({ timeout: 5_000 });
  step("Window > CPU Usage shows the page's main thread, measured", true);
  await menu(page, "Window");
  await page.getByRole("menuitem", { name: "CPU History" }).click();
  const historyPanel = page.locator('[data-window-id="activity-monitor:cpu-history"]');
  await historyPanel.getByRole("img").waitFor({ timeout: 5_000 });
  await historyPanel.locator("svg path").first().waitFor({ state: "attached", timeout: 5_000 });
  const plotted = await historyPanel.getByRole("img").boundingBox();
  const panelBox = await historyPanel.boundingBox();
  step(
    "Window > CPU History draws it, inside its window",
    plotted.y >= panelBox.y &&
      plotted.y + plotted.height <= panelBox.y + panelBox.height &&
      plotted.x >= panelBox.x,
    JSON.stringify(plotted),
  );
  await page.screenshot({ path: path.join(out, "am-cpu-windows.png") });
  for (const panel of [usagePanel, historyPanel]) {
    await panel.getByRole("button", { name: /close/i }).first().click();
    await panel.waitFor({ state: "detached" });
  }

  await grid.getByText("Calculator").click();
  await page.keyboard.press("ControlOrMeta+2");
  await usagePanel.waitFor({ timeout: 5_000 });
  step("Command-2 opens CPU Usage", true);
  await page.keyboard.press("ControlOrMeta+3");
  await historyPanel.waitFor({ timeout: 5_000 });
  step("Command-3 opens CPU History, with CPU Usage in front", true);
  await page.keyboard.press("ControlOrMeta+1");
  await page
    .locator('[data-window-id="activity-monitor"] [data-window-state="key"]')
    .waitFor({ timeout: 5_000 });
  step("Command-1 brings the main window forward from a CPU window", true);
  for (const panel of [usagePanel, historyPanel]) {
    await panel.getByRole("button", { name: /close/i }).first().click();
    await panel.waitFor({ state: "detached" });
  }

  await grid.getByText("Calculator").click();
  await grid.getByText("Chess").click({ modifiers: ["Control"] });

  await page.keyboard.press("Control+Alt+q");
  const sheet = page.getByRole("dialog");
  await sheet.getByText("quit these 2 processes").waitFor({ timeout: 5_000 });
  await page.screenshot({ path: path.join(out, "am-quit-two.png") });
  await sheet.getByRole("button", { name: "Quit", exact: true }).click();
  await page.locator('[data-window-id="calculator"]').waitFor({ state: "detached" });
  await page.locator('[data-window-id="chess"]').waitFor({ state: "detached" });
  step("Option-Command-Q quits both selected applications", true);

  // Off Apple platforms Control-Alt-F is the desktop's Enter Full Screen: Find is reached by its menu.
  await menu(page, "Edit");
  for (const name of ["Undo", "Redo", "Cut", "Paste"]) {
    const row = page.getByRole("menuitem", { name, exact: true });
    step(
      `Edit's ${name} is dimmed and says why`,
      (await row.isDisabled()) && ((await row.getAttribute("title")) ?? "") !== "",
    );
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await menu(page, "View");
  step(
    "the View menu says why the Mac's other process filters are absent",
    await page.getByRole("menuitem", { name: /Other filters need processes/ }).isDisabled(),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Find/ }).click();
  await page.waitForTimeout(600);
  step(
    "Edit > Find takes the search field",
    await monitor
      .locator("input")
      .first()
      .evaluate((el) => el === document.activeElement),
  );

  let saved = nextSave(
    page,
    SETTINGS,
    (body) => body?.values?.["activity-monitor.view"] === "ferrite",
  );
  await menu(page, "View");
  await page.getByRole("menuitemradio", { name: "Ferrite" }).click();
  await saved;
  await monitor.getByRole("grid", { name: "Ferrite" }).waitFor();
  step("View chooses the view", true);
  saved = nextSave(page, SETTINGS, (body) => body?.values?.["activity-monitor.frequency"] === 5);
  await menu(page, "View");
  await page.getByRole("menuitem", { name: "Update Frequency" }).hover();
  await page.getByRole("menuitemradio", { name: /5 secs/ }).click();
  await saved;
  step("Update Frequency is kept", true);

  await reloadDesktop(page);
  await dock(page, "Activity Monitor").click();
  await monitor.getByRole("grid", { name: "Ferrite" }).waitFor({ timeout: 10_000 });
  step("the window opens on its last view after a reload", true);

  await dock(page, "System Preferences").click();
  await page.locator('[data-window-id="system-preferences"]').waitFor({ timeout: 10_000 });
  await dock(page, "Activity Monitor").click();
  await monitor.getByText("Applications", { exact: true }).click();
  const applications = monitor.getByRole("grid", { name: "Applications" });
  await applications.getByText("System Preferences").click();
  await page.keyboard.press("Control+i");
  const inspector = page.locator('[data-window-id="activity-monitor:inspect-system-preferences"]');
  const kept = () => inspector.locator("dd").last().innerText();
  await inspector.waitFor({ timeout: 5_000 });
  let first = await kept();
  for (let tries = 0; tries < 20 && first === "—"; tries += 1) {
    await page.waitForTimeout(200);
    first = await kept();
  }
  saved = nextSave(page, SETTINGS, (body) => body?.values?.["activity-monitor.frequency"] === 1);
  await menu(page, "View");
  await page.getByRole("menuitem", { name: "Update Frequency" }).hover();
  await page.getByRole("menuitemradio", { name: /1 sec/ }).click();
  await saved;
  first = await kept();
  // The figure is written to a tenth of a KB: a change has to be larger than that to show. Console keeps a
  // search of up to 200 characters for the account.
  await dock(page, "Console").click();
  const consoleWindow = page.locator('[data-window-id="console"]');
  await consoleWindow.waitFor({ timeout: 10_000 });
  saved = nextSave(
    page,
    SETTINGS,
    (body) => body?.values?.["console.layout"]?.query?.length >= 190,
  );
  await consoleWindow.getByRole("searchbox").fill("kept".repeat(50));
  await saved;
  await dock(page, "Activity Monitor").click();
  await page.waitForTimeout(300);
  // The account's data changed: a tenth of the ticks reads it again, at one a second here.
  let now = first;
  for (let tries = 0; tries < 30 && now === first; tries += 1) {
    await page.waitForTimeout(500);
    now = await kept();
  }
  step(
    "Kept for you follows the account's data while the inspector stays open",
    now !== first,
    `${first} to ${now}`,
  );
});

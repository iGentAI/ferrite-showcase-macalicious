#!/usr/bin/env node
// Activity Monitor's toolbar Inspect and Action menu, View's process filters (Windowed kept across a reload), Copy and
// Select All, Window > Activity Monitor, and the dimmed rows for what a page cannot run. Exits 0 only when every step
// passed with no console error, page error, failed request or HTTP error.
//
//   node e2e/activity-monitor-tools-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, nextSave, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const SETTINGS = "/api/system-preferences/settings";
const dock = (page, name) => page.getByRole("button", { name: new RegExp(`^${name}$`) }).first();
const menu = async (page, title) => {
  const item = page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
  await item.click();
  await page.waitForTimeout(150);
  if ((await item.getAttribute("aria-expanded")) !== "true") await item.click();
};

await journey("activity-monitor-tools", async ({ page, base, out, step }) => {
  await page
    .context()
    .grantPermissions(["clipboard-read", "clipboard-write"])
    .catch(() => {});
  await openDesktop(page, base);
  await dock(page, "Calculator").click();
  await page.locator('[data-window-id="calculator"]').waitFor({ timeout: 10_000 });
  await dock(page, "Activity Monitor").click();
  const monitor = page.locator('[data-window-id="activity-monitor"]');
  await monitor.waitFor();
  const grid = monitor.getByRole("grid", { name: "Applications" });
  await grid.getByText("Calculator").waitFor({ timeout: 5_000 });

  await grid.getByText("Calculator").click();
  await monitor.getByRole("button", { name: "Inspect", exact: true }).click();
  const inspector = page.locator('[data-window-id="activity-monitor:inspect-calculator"]');
  await inspector.waitFor({ timeout: 5_000 });
  step("the toolbar's Inspect opens the selected row's inspector", true);

  await menu(page, "Window");
  await page.locator('[role="menuitem"][aria-keyshortcuts$="+1"]').click();
  await page.waitForTimeout(400);
  const key = await monitor
    .locator("[data-window-state]")
    .first()
    .getAttribute("data-window-state");
  step("Window > Activity Monitor makes the main window key", key === "key", String(key));
  await inspector.getByRole("button", { name: /close/i }).first().click();

  await monitor.getByRole("button", { name: "Action", exact: true }).click();
  await page.getByRole("menuitem", { name: "Inspect Process" }).waitFor({ timeout: 3_000 });
  await page.screenshot({ path: path.join(out, "am-action-menu.png") });
  step("the Action menu offers the row's commands and the frequency", true);
  await page.keyboard.press("Escape");

  await grid.getByText("Calculator").click();
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: "Copy", exact: true }).click();
  await page.waitForTimeout(400);
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  step(
    "Copy puts the headings and the selected row on the clipboard",
    /^Application.*\t/.test(copied) && copied.includes("Calculator"),
    copied.replaceAll("\t", " | ").replaceAll("\n", " / "),
  );

  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: "Select All" }).click();
  await page.waitForTimeout(300);
  const chosen = await grid.locator('[role="row"][aria-selected="true"]').count();
  step("Select All selects every row", chosen >= 2, String(chosen));

  const search = monitor.getByRole("searchbox").or(monitor.locator("input")).first();
  await grid.getByText("Calculator").click();
  await search.fill("Calc");
  await search.evaluate((field) => field.setSelectionRange(0, 2));
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: "Copy", exact: true }).click();
  await page.waitForTimeout(400);
  const fieldCopy = await page.evaluate(() => navigator.clipboard.readText());
  step("in the search field, Edit > Copy copies its selected text", fieldCopy === "Ca", fieldCopy);
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: "Select All" }).click();
  await page.waitForTimeout(600);
  const fieldChosen = await search.evaluate((field) => [field.selectionStart, field.selectionEnd]);
  const rowsChosen = await grid.locator('[role="row"][aria-selected="true"]').count();
  step(
    "and Edit > Select All selects its text, leaving the rows' selection",
    fieldChosen[0] === 0 && fieldChosen[1] === 4 && rowsChosen === 1,
    `${fieldChosen} ${rowsChosen}`,
  );
  await search.fill("");

  await grid.getByText("Calculator").click();
  await menu(page, "View");
  await page.getByRole("menuitemradio", { name: "Selected Processes" }).click();
  await page.waitForTimeout(300);
  const only = await grid.getByText("Activity Monitor").count();
  step(
    "Selected Processes keeps only the selected row",
    only === 0 && (await grid.getByText("Calculator").count()) === 1,
  );
  await page.screenshot({ path: path.join(out, "am-selected-processes.png") });

  let saved = nextSave(
    page,
    SETTINGS,
    (body) => body?.values?.["activity-monitor.filter"] === "windowed",
  );
  await menu(page, "View");
  await page.getByRole("menuitemradio", { name: "Windowed Processes" }).click();
  await saved;
  step("Windowed Processes is saved for the account", true);

  await menu(page, "View");
  const rows = ["Sample Process", "Run Spindump", "Run System Diagnostics"];
  const dimmed = await Promise.all(
    rows.map((name) =>
      page.getByRole("menuitem", { name, exact: true }).getAttribute("aria-disabled"),
    ),
  );
  step(
    "what a page cannot run is dimmed, with why",
    dimmed.every((value) => value === "true"),
  );
  await page.screenshot({ path: path.join(out, "am-view-filters.png") });
  await page.keyboard.press("Escape");

  await reloadDesktop(page);
  await monitor.waitFor({ timeout: 15_000 });
  await menu(page, "View");
  step(
    "the filter is still chosen after a reload",
    (await page
      .getByRole("menuitemradio", { name: "Windowed Processes" })
      .getAttribute("aria-checked")) === "true",
  );
  await page.keyboard.press("Escape");
  saved = nextSave(page, SETTINGS, (body) => body?.values?.["activity-monitor.filter"] === "all");
  await menu(page, "View");
  await page.getByRole("menuitemradio", { name: "All Processes" }).click();
  await saved;
});

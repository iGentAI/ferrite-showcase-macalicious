#!/usr/bin/env node
// Console's kept layout on a served desktop: the source, the scope, Get Info and the hidden sidebar come back after
// a reload, Include Info and Include Debug are kept, and Share copies the selected message. Exits 0 only when every
// step passed with no console error, page error, failed request or HTTP error.
//
//   node e2e/console-layout-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

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
const saves = (page, check) =>
  nextSave(page, SETTINGS, (body) => {
    const layout = body?.values?.["console.layout"];
    return layout !== undefined && check(layout);
  });

const within = async (page, check) => {
  for (let tries = 0; tries < 20; tries += 1) {
    if (await check()) return true;
    await page.waitForTimeout(150);
  }
  return false;
};

await journey("console-layout", async ({ page, base, out, step }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
  await openDesktop(page, base);
  await dock(page, "Console").click();
  const window = page.locator('[data-window-id="console"]');
  await window.waitFor();
  const grid = window.getByRole("grid", { name: "Messages" });
  await grid.locator("[data-console-message]").first().waitFor({ timeout: 15_000 });
  const infoRows = await grid.locator("[data-console-message]").count();

  const row = grid.locator("[role='row'][aria-selected]").first();
  await row.click();
  await window
    .getByRole("button", { name: "Share" })
    .or(window.getByLabel("Share"))
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Copy Message" }).waitFor();
  await page.screenshot({ path: path.join(out, "console-share.png") });
  step(
    "Share offers Mail, Messages and Notes",
    (await page.getByRole("menuitem", { name: "Mail", exact: true }).isVisible()) &&
      (await page.getByRole("menuitem", { name: "Messages", exact: true }).isVisible()) &&
      (await page.getByRole("menuitem", { name: "Notes", exact: true }).isVisible()),
  );
  await page.getByRole("menuitem", { name: "Copy Message" }).click();
  await page.waitForTimeout(150);
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  step("Copy Message copies it", copied.includes("\t"), copied);

  let saved = saves(page, (layout) => layout.includeInfo === false);
  await menu(page, "Action");
  await page.getByRole("menuitemcheckbox", { name: "Include Info Messages" }).click();
  await saved;
  const withoutInfo = await within(
    page,
    async () => (await grid.locator("[data-console-message]").count()) < infoRows,
  );
  step("Include Info off leaves those messages out", withoutInfo, `${infoRows} rows before`);
  saved = saves(page, (layout) => layout.includeInfo === true);
  await menu(page, "Action");
  await page.getByRole("menuitemcheckbox", { name: "Include Info Messages" }).click();
  await saved;
  saved = saves(page, (layout) => layout.includeDebug === true);
  await menu(page, "Action");
  await page.getByRole("menuitemcheckbox", { name: "Include Debug Messages" }).click();
  await saved;
  step("Include Info and Include Debug save for the account", true);

  saved = saves(page, (layout) => layout.scope === "errors");
  await window
    .getByRole("button", { name: "Errors and Faults" })
    .or(window.getByRole("radio", { name: "Errors and Faults" }))
    .first()
    .click();
  await saved;
  saved = saves(page, (layout) => layout.source === "crash-reports");
  await window.getByRole("treeitem", { name: "Crash Reports" }).click();
  await saved;
  saved = saves(page, (layout) => layout.infoShown === false);
  await page.keyboard.press("Control+i");
  await saved;
  saved = saves(page, (layout) => layout.sidebarSize === 0);
  await menu(page, "View");
  await page.getByRole("menuitem", { name: "Hide Sidebar" }).click();
  await saved;

  const long = "x".repeat(250);
  const searchField = window
    .getByRole("searchbox")
    .or(window.locator("input[type='search']"))
    .first();
  saved = saves(page, (layout) => layout.query === long.slice(0, 200));
  await searchField.fill(long);
  await saved;
  step(
    "a long search keeps searching whole, and only its first 200 characters are saved",
    (await searchField.inputValue()) === long,
  );

  saved = saves(page, (layout) => layout.query === "kept words");
  await window
    .getByRole("searchbox")
    .or(window.locator("input[type='search']"))
    .first()
    .fill("kept words");
  await saved;
  // The press on a row above already let go of Now: the first press turns it on, the second off.
  const now = window.getByRole("button", { name: "Now" }).or(window.getByLabel("Now")).first();
  saved = saves(page, (layout) => layout.following === true);
  await now.click();
  await saved;
  saved = saves(page, (layout) => layout.following === false);
  await now.click();
  await saved;

  await reloadDesktop(page);
  await dock(page, "Console").click();
  await window.waitFor();
  await window.getByText(/keeps no crash, spin or system logs/).waitFor({ timeout: 10_000 });
  step("after a reload it opens on the same source", true);
  step(
    "with the sidebar hidden and the detail pane closed",
    !(await window.getByRole("treeitem", { name: "Crash Reports" }).isVisible()) &&
      (await window.getByRole("region", { name: "Message details" }).count()) === 0,
  );
  await page.screenshot({ path: path.join(out, "console-kept.png") });
  step(
    "the search is still there",
    (await window
      .getByRole("searchbox")
      .or(window.locator("input[type='search']"))
      .first()
      .inputValue()) === "kept words",
  );
  await menu(page, "Action");
  step(
    "and the levels still chosen",
    (await page
      .getByRole("menuitemcheckbox", { name: "Include Info Messages" })
      .getAttribute("aria-checked")) === "true" &&
      (await page
        .getByRole("menuitemcheckbox", { name: "Include Debug Messages" })
        .getAttribute("aria-checked")) === "true",
  );
  await page.keyboard.press("Escape");
});

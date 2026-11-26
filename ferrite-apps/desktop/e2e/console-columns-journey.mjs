#!/usr/bin/env node
// Console's columns and saved searches on a served desktop: View > Columns adds Category and takes Time away, the table's
// menu has the same rows, a row's menu shows its category, Save keeps a search across a reload, it can be chosen again and
// removed. Exits 0 only when every step passed with no console error, page error, failed request or HTTP error.
//
//   node e2e/console-columns-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const menu = async (page, title) => {
  const item = page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
  await item.click();
  await page.waitForTimeout(150);
  if ((await item.getAttribute("aria-expanded")) !== "true") await item.click();
};

await journey("console-columns", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  const open = async () => {
    await page
      .getByRole("button", { name: /^Console$/ })
      .first()
      .click();
    await page.locator('[data-window-id="console"]').waitFor({ timeout: 10_000 });
  };
  await open();
  const window = page.locator('[data-window-id="console"]');
  const headings = async () =>
    (await window.getByRole("columnheader").allInnerTexts()).map((text) => text.trim());
  const choose = async (name) => {
    await menu(page, "View");
    await page.getByRole("menuitem", { name: "Columns" }).hover();
    await page.getByRole("menuitemcheckbox", { name }).click();
    await page.waitForTimeout(400);
  };
  await window
    .getByRole("grid", { includeHidden: true })
    .first()
    .locator('[role="row"][aria-selected]')
    .first()
    .waitFor({ timeout: 8_000 });
  step(
    "the window opens with the four columns of the captures",
    (await headings()).join() === "Type,Time,Process,Message",
    (await headings()).join(),
  );
  await choose("Category");
  await choose("Time");
  await page.screenshot({ path: path.join(out, "console-columns.png") });
  step(
    "View > Columns adds Category and takes Time away",
    (await headings()).join() === "Type,Process,Category,Message",
    (await headings()).join(),
  );

  const row = window
    .getByRole("grid", { includeHidden: true })
    .first()
    .locator('[role="row"][aria-selected]')
    .first();
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: /^Show Category/ }).waitFor({ timeout: 3_000 });
  await page.getByRole("menuitem", { name: "Columns" }).hover();
  await page.getByRole("menuitemcheckbox", { name: "Subsystem" }).waitFor({ timeout: 3_000 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(out, "console-row-menu-columns.png") });
  step("the table's menu lists the columns", true);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  const field = window.getByRole("searchbox").or(window.locator("input")).first();
  await field.fill("category:request");
  await page.waitForTimeout(300);
  await window.getByRole("button", { name: "Save", exact: true }).click();
  const saved = window.getByRole("button", { name: "category:request", exact: true });
  await saved.waitFor({ timeout: 3_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, "console-saved-search.png") });
  step(
    "Save keeps the search as a button",
    (await window.getByRole("button", { name: "Save", exact: true }).count()) === 0,
  );

  await reloadDesktop(page);
  await open();
  await saved.waitFor({ timeout: 8_000 });
  step(
    "the columns and the saved search stay across a reload",
    (await headings()).join() === "Type,Process,Category,Message",
    (await headings()).join(),
  );
  await field.fill("");
  await page.waitForTimeout(200);
  await saved.click();
  await page.waitForTimeout(300);
  step("choosing it searches again", (await field.inputValue()) === "category:request");
  await saved.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Remove Saved Search" }).click();
  await saved.waitFor({ state: "detached", timeout: 3_000 });
  step("Remove Saved Search takes it away", true);
});

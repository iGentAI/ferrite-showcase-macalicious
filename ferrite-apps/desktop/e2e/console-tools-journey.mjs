#!/usr/bin/env node
// Console's tools on a served desktop: this page's own errors in the log, search tokens, Show and Hide Process on a row's
// menu, Find Next and Use Selection, Hide Toolbar kept across a reload, and Save a Copy As to the drive read back. Exits 0
// only when every step passed with no console error, page error, failed request or HTTP error.
//
//   node e2e/console-tools-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const RUN = Date.now().toString(36);
const BOOM = `console-tools journey error ${RUN}`;
const SAVED_NAME = `Console Journey ${RUN}.log`;
const menu = async (page, title) => {
  const item = page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
  await item.click();
  await page.waitForTimeout(150);
  if ((await item.getAttribute("aria-expanded")) !== "true") await item.click();
};

await journey("console-tools", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  const open = async () => {
    await page
      .getByRole("button", { name: /^Console$/ })
      .first()
      .click();
    const window = page.locator('[data-window-id="console"]');
    await window.waitFor({ timeout: 10_000 });
    return window;
  };
  let window = await open();
  await page.waitForTimeout(500);
  await page.evaluate((message) => {
    globalThis.dispatchEvent(new ErrorEvent("error", { message }));
  }, BOOM);
  const grid = () => window.getByRole("grid", { includeHidden: true }).first();
  const row = (name) => grid().locator('[role="row"][aria-selected]').filter({ hasText: name });
  await row(BOOM).first().waitFor({ timeout: 8_000 });
  await page.screenshot({ path: path.join(out, "console-page-error.png") });
  step("this page's own error is in the log, as process This Page", true);

  const field = window.getByRole("searchbox").or(window.locator("input")).first();
  await field.fill("process:Page");
  await page.waitForTimeout(300);
  const shown = () => grid().locator('[role="row"][aria-selected]');
  const onlyPage = async () => {
    const texts = await shown().allInnerTexts();
    return texts.length > 0 && texts.every((text) => text.includes("This Page"));
  };
  step("a process: token keeps that process", await onlyPage());
  await field.fill("");
  await page.waitForTimeout(300);
  const everyCount = await shown().count();
  await row(BOOM).first().click({ button: "right" });
  await page.getByRole("menuitem", { name: /^Hide Process/ }).waitFor();
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(out, "console-row-menu-process.png") });
  await page.getByRole("menuitem", { name: /^Hide Process/ }).click();
  await page.waitForTimeout(400);
  step(
    "Hide Process takes that process out of the list",
    (await field.inputValue()) === '-process:"This Page"' && (await row(BOOM).count()) === 0,
    await field.inputValue(),
  );
  await field.fill("");
  await page.waitForTimeout(300);
  await row(BOOM).first().click({ button: "right" });
  await page.getByRole("menuitem", { name: /^Show Process/ }).click();
  await page.waitForTimeout(400);
  step("Show Process keeps only that process", await onlyPage(), await field.inputValue());
  await field.fill("");
  await page.waitForTimeout(300);
  step("clearing the search lists them all again", (await shown().count()) >= everyCount);

  await shown().first().click();
  const chosen = () => grid().locator('[role="row"][aria-selected="true"]').innerText();
  const firstText = await chosen();
  await menu(page, "Edit");
  for (const name of ["Undo", "Redo", "Cut", "Paste"]) {
    const row = page.getByRole("menuitem", { name, exact: true });
    step(
      `Edit's ${name} is dimmed and says why`,
      (await row.isDisabled()) && ((await row.getAttribute("title")) ?? "") !== "",
    );
  }
  await page.keyboard.press("Escape");
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Find Next/ }).click();
  await page.waitForTimeout(400);
  step("Find Next moves to the next row", (await chosen()) !== firstText);
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Find Previous/ }).click();
  await page.waitForTimeout(400);
  step("Find Previous comes back", (await chosen()) === firstText);
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Use Selection for Find/ }).click();
  await page.waitForTimeout(400);
  step(
    "Use Selection for Find searches for the selected row's process",
    (await field.inputValue()).startsWith("process:"),
    await field.inputValue(),
  );
  await field.fill("");
  await page.waitForTimeout(300);

  await shown().first().click();
  await page.keyboard.press("Control+a");
  await menu(page, "File");
  await page.getByRole("menuitem", { name: /^Save a Copy As/ }).click();
  const sheet = page.getByRole("dialog", { name: "Save a Copy As" });
  await sheet.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, "console-save.png") });
  const name = sheet.getByRole("textbox", { name: /Save As/ });
  await name.fill(SAVED_NAME);
  const failedUpload = [];
  const heard = (response) => {
    if (/\/api\/files\/uploads/.test(response.url()) && !response.ok())
      failedUpload.push(response.status());
  };
  page.on("response", heard);
  const saved = page.waitForResponse(
    (response) =>
      /\/api\/files\/uploads/.test(response.url()) && response.request().method() === "POST",
    { timeout: 8_000 },
  );
  await sheet.getByRole("button", { name: "Save" }).click();
  const created = await saved;
  step("the upload is accepted", created.ok(), String(created.status()));
  await sheet.waitFor({ state: "hidden" });
  await page.waitForTimeout(800);
  page.off("response", heard);
  const contents = await page.evaluate(async (wanted) => {
    const find = (value) => {
      if (Array.isArray(value)) return value.map(find).find(Boolean);
      if (value && typeof value === "object")
        return value.name === wanted ? value : Object.values(value).map(find).find(Boolean);
      return undefined;
    };
    const drive = await fetch("/api/files/").then((reply) => reply.json());
    const entry = find(drive);
    if (!entry) return "";
    const reply = await fetch(`/api/files/content/${encodeURIComponent(entry.id)}?piece=0&count=8`);
    return reply.text();
  }, SAVED_NAME);
  step(
    "Save a Copy As writes this run's messages to a new file, read back from it",
    failedUpload.length === 0 && contents.includes(BOOM),
    `${failedUpload.join()} ${contents.slice(0, 60)}`,
  );

  await menu(page, "View");
  await page.getByRole("menuitem", { name: "Hide Toolbar" }).click();
  const toolbar = window.getByRole("toolbar", { name: "Toolbar", includeHidden: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, "console-no-toolbar.png") });
  step("View > Hide Toolbar hides it", !(await toolbar.isVisible()));
  await page.waitForTimeout(1_200);
  await reloadDesktop(page);
  window = await open();
  await page.waitForTimeout(400);
  const after = window.getByRole("toolbar", { name: "Toolbar", includeHidden: true });
  step("it stays hidden after a reload", !(await after.isVisible()));
  await page.keyboard.press("Control+f");
  await page.waitForTimeout(600);
  step("Find brings the toolbar back", await after.isVisible());
});

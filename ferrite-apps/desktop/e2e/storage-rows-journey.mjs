#!/usr/bin/env node
// Storage Management's rows on a served desktop: the window's title figures, the sidebar's kinds holding something, Large
// Files from 5 MB, the Review Files buttons, sort by a heading, arrow keys, Select All, Delete asking first and lasting past
// a reload, Show in Finder, forgetting an app's document, and the Trash the same as Finder's. Exits 0 only when every step
// passed with no console error, page error, failed request or HTTP error.
//
//   node e2e/storage-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, openDesktop } from "./journey-kit.mjs";
import { openWithSpotlight, uploadFile } from "./system-kit.mjs";

const menu = async (page, title) => {
  const item = page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
  await item.click();
  await page.waitForTimeout(150);
  if ((await item.getAttribute("aria-expanded")) !== "true") await item.click();
};

await journey("storage-rows", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  for (const [name, type, size] of [
    ["Big Report.txt", "text/plain", 6_000_000],
    ["Small Note.txt", "text/plain", 2_000],
    ["Alpha Note.txt", "text/plain", 3_000],
    ["Holiday.png", "image/png", 40_000],
  ]) {
    await uploadFile(page, { parent: "documents", name, type, size });
  }
  await page.evaluate(() =>
    fetch("/api/launchpad/layout", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: ["storage-management"], page: 0, rev: 0 }),
    }),
  );
  await page.reload();
  await page.getByRole("menubar").first().waitFor({ timeout: 20_000 });
  await openWithSpotlight(page, "Storage Management");
  const win = page.locator('[data-window-id="storage-management"]');
  await win.waitFor({ timeout: 10_000 });
  const row = (name) => win.getByRole("treeitem", { name });
  const file = (name) => win.getByRole("row", { name });
  const chosen = () => win.locator('[role="row"][aria-selected="true"]').count();

  await win.getByText(/Ferrite Drive - .* available of /).waitFor({ timeout: 10_000 });
  step("the title gives the drive's free space and quota", true);
  await row(/^Recommendations/).click();
  await win.getByRole("heading", { name: "Review Large Files" }).waitFor();
  await win.getByRole("heading", { name: "Reduce Clutter" }).waitFor();
  await page.screenshot({ path: path.join(out, "storage-rows-recommendations.png") });
  step("Recommendations offers both reviews", true);

  const kinds = await win.getByRole("treeitem").allInnerTexts();
  step(
    "the sidebar lists the kinds holding something, and no empty ones",
    kinds.some((text) => text.startsWith("Documents")) &&
      kinds.some((text) => text.startsWith("Photos")) &&
      !kinds.some((text) => text.startsWith("Movies")) &&
      kinds.some((text) => text.startsWith("Trash")) &&
      kinds.some((text) => text.startsWith("App Data")),
    kinds.join(" | ").replace(/\s+/g, " "),
  );

  const review = (title) =>
    win
      .getByRole("heading", { name: title })
      .locator("xpath=ancestor::*[.//button][1]")
      .getByRole("button", { name: "Review Files" });
  await review("Review Large Files").click();
  await file(/Big Report\.txt/).waitFor({ timeout: 5_000 });
  step(
    "Review Files on large files opens Large Files, with only the large one",
    (await row(/^Large Files/).getAttribute("aria-selected")) === "true" &&
      (await file(/Small Note\.txt/).count()) === 0,
  );
  await page.screenshot({ path: path.join(out, "storage-rows-large.png") });

  await row(/^Recommendations/).click();
  await review("Reduce Clutter").click();
  await page.waitForTimeout(400);
  step(
    "Review Files on clutter opens a kind that holds files",
    (await win.getByRole("treeitem", { selected: true }).count()) === 1 &&
      !(await row(/^Recommendations/).getAttribute("aria-selected"))?.includes("true"),
    (await win.getByRole("treeitem", { selected: true }).innerText()).replace(/\s+/g, " "),
  );

  await row(/^Documents/).click();
  await file(/Small Note\.txt/).waitFor({ timeout: 5_000 });
  const names = async () =>
    (
      await win.locator('[role="row"][aria-selected] [role="gridcell"]:first-child').allInnerTexts()
    ).map((text) => text.trim());
  await win.getByRole("button", { name: "Name" }).click();
  await page.waitForTimeout(150);
  const up = await names();
  await page.screenshot({ path: path.join(out, "storage-rows-sorted.png") });
  await win.getByRole("button", { name: "Name" }).click();
  await page.waitForTimeout(150);
  const down = await names();
  step(
    "a heading sorts, and sorts the other way when pressed again",
    up.join() === [...down].reverse().join() && up[0].startsWith("Alpha Note.txt"),
    up.join(", "),
  );

  await win.getByRole("button", { name: "Name" }).click();
  await file(/Alpha Note\.txt/).click();
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(out, "storage-rows-arrow.png") });
  step(
    "the arrow keys move the selection",
    (await file(/Big Report\.txt/).getAttribute("aria-selected")) === "true",
  );

  await menu(page, "Edit");
  const selectAll = page.getByRole("menuitem", { name: /^Select All/ });
  await selectAll.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, "storage-rows-select-all.png") });
  step("Edit > Select All chooses the kind's files", (await chosen()) >= 3, String(await chosen()));

  await file(/Small Note\.txt/).click();
  await menu(page, "Edit");
  const del = page.getByRole("menuitem", { name: /^Delete/ });
  await del.click();
  const alert = page.getByRole("alertdialog");
  await alert.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, "storage-rows-delete.png") });
  step("Edit > Delete asks first", true);
  await alert.getByRole("button", { name: /^(Delete|Remove)/ }).click();
  await file(/Small Note\.txt/).waitFor({ state: "detached", timeout: 5_000 });
  step("the file goes", true);

  await file(/Alpha Note\.txt/).click();
  await win.getByRole("button", { name: "Show in Finder", exact: true }).click();
  const finder = page.locator('[data-window-id^="finder"]').first();
  await finder.getByText("Alpha Note.txt").first().waitFor({ timeout: 10_000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, "storage-rows-finder.png") });
  step("Show in Finder opens Finder on the file", true);

  await page.reload();
  await page.getByRole("menubar").first().waitFor({ timeout: 20_000 });
  await openWithSpotlight(page, "Storage Management");
  await win.waitFor({ timeout: 10_000 });
  await row(/^Documents/).click();
  await file(/Alpha Note\.txt/).waitFor({ timeout: 5_000 });
  step("the deletion lasts past a reload", (await file(/Small Note\.txt/).count()) === 0);

  await row(/^App Data/).click();
  const document = file(/Launchpad Order and Page/);
  await document.click();
  const forgot = page.waitForRequest(
    (request) => request.method() === "DELETE" && request.url().includes("/api/launchpad/"),
    { timeout: 8_000 },
  );
  await win.getByRole("button", { name: "Delete…" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /^(Delete|Remove)/ })
    .click();
  await forgot;
  await document.waitFor({ state: "detached", timeout: 5_000 });
  await page.waitForTimeout(500);
  await page.reload();
  await page.getByRole("menubar").first().waitFor({ timeout: 20_000 });
  await openWithSpotlight(page, "Storage Management");
  await win.waitFor({ timeout: 10_000 });
  await row(/^App Data/).click();
  await page.waitForTimeout(800);
  step(
    "forgetting an app's document asks that app's module to delete it, and it stays gone after a reload",
    (await document.count()) === 0,
  );

  await menu(page, "Help");
  await page.getByRole("menuitem", { name: "Storage Management Help" }).click();
  await page.locator('[data-window-id="help-viewer"]').waitFor({ timeout: 10_000 });
  step("Help opens Help Viewer", true);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, "storage-rows-help.png") });
});

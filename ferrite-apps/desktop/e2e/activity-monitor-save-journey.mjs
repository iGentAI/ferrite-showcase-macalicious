#!/usr/bin/env node
// Activity Monitor's File > Save, column widths and the rows that say why not, on a served desktop. Exits 0 only when
// every step passed with no console error, page error, failed request or HTTP error.
//
//   node e2e/activity-monitor-save-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const SAVED = `Monitor Journey ${Date.now().toString(36)}.txt`;
const menu = async (page, title) => {
  const item = page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
  await item.click();
  await page.waitForTimeout(150);
  if ((await item.getAttribute("aria-expanded")) !== "true") await item.click();
};

await journey("activity-monitor-save", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  const open = async () => {
    await page
      .getByRole("button", { name: /^Activity Monitor$/ })
      .first()
      .click();
    await page.locator('[data-window-id="activity-monitor"]').waitFor({ timeout: 10_000 });
    await page.waitForTimeout(500);
  };
  await open();
  const monitor = page.locator('[data-window-id="activity-monitor"]');

  await menu(page, "View");
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(out, "am-view-why-not.png") });
  const dimmed = async (name) =>
    (await page.getByRole("menuitem", { name, exact: true }).getAttribute("aria-disabled")) ===
    "true";
  step(
    "Show Deltas is dimmed, and View says why",
    (await dimmed("Show Deltas for Process")) &&
      (await page.getByText(/a page reads no network or disk activity/).isVisible()),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);

  const heading = monitor.getByRole("columnheader", { name: "Windows" });
  const before = await heading.boundingBox();
  await page.mouse.move(before.x + before.width - 1, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width + 60, before.y + before.height / 2, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const after = await heading.boundingBox();
  await page.screenshot({ path: path.join(out, "am-column-wide.png") });
  step(
    "a heading's edge drags the column wider",
    after.width >= before.width + 40,
    `${before.width} to ${after.width}`,
  );
  await page.waitForTimeout(1_000);
  await reloadDesktop(page);
  await open();
  const kept = await heading.boundingBox();
  step("the width stays across a reload", Math.abs(kept.width - after.width) <= 1, `${kept.width}`);

  await menu(page, "File");
  await page.getByRole("menuitem", { name: /^Save/ }).click();
  const sheet = page.getByRole("dialog", { name: "Save the Report" });
  await sheet.waitFor({ timeout: 5_000 });
  await sheet.getByRole("textbox", { name: /Save As/ }).fill(SAVED);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, "am-save.png") });
  await sheet.getByRole("button", { name: "Save" }).click();
  await sheet.waitFor({ state: "hidden" });
  await page.waitForTimeout(1_000);
  const contents = await page.evaluate(async (wanted) => {
    const drive = await fetch("/api/files/").then((reply) => reply.json());
    const entry = drive.entries.find((each) => each.name === wanted);
    if (!entry) return "";
    const reply = await fetch(`/api/files/content/${encodeURIComponent(entry.id)}?piece=0&count=8`);
    return reply.text();
  }, SAVED);
  step(
    "Save writes the view's table to the drive, read back from it",
    contents.startsWith("Application Name\t") && contents.includes("Activity Monitor"),
    contents.slice(0, 50).replace(/\s+/g, " "),
  );
});

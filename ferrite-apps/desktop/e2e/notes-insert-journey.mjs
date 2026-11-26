#!/usr/bin/env node
// What Notes adds to a note: Add Table and a picture go in as one step of the browser's undo
// history, so Edit > Undo takes them out and Redo puts them back, and Add Table is dimmed where
// there is no one note to add to (Gallery View, several notes selected).
//
//   node e2e/notes-insert-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("notes-insert");
const stamp = Date.now().toString(36);
const PIXEL =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/7yMK/gAAAABJRU5ErkJggg==";

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await openDesktop(page, base, step);
  await launch(page, "Notes");
  const window = page.getByRole("region", { name: "Notes", exact: true }).first();
  await window.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(600);
  const bar = window.getByRole("toolbar", { name: "Notes toolbar" });
  const editor = window.locator('[role="textbox"][aria-label="Note"]:visible').first();
  const addTable = bar.getByRole("button", { name: "Add Table" });
  const edit = async (item) => {
    await page.getByRole("menubar").getByRole("menuitem", { name: "Edit", exact: true }).click();
    await page.waitForTimeout(250);
    await page
      .getByRole("menuitem", { name: new RegExp(`^${item}`) })
      .last()
      .click();
    await page.waitForTimeout(350);
  };
  const shape = () =>
    editor.evaluate((node) => ({
      tables: node.querySelectorAll("table").length,
      pictures: node.querySelectorAll("img").length,
      text: node.innerText,
      lines: [...node.children].map((child) => child.tagName),
    }));

  const LINE = `Kept line ${stamp}`;
  await bar.getByRole("button", { name: "New Note" }).click();
  await editor.waitFor();
  await editor.click();
  await page.keyboard.type(LINE);
  await page.waitForTimeout(500);

  await addTable.click();
  await page.waitForTimeout(300);
  let now = await shape();
  step("Add Table adds a table to the note", now.tables === 1, JSON.stringify(now.lines));
  step("the line typed before it stays its own line", now.text.startsWith(LINE));
  const inCell = await page.evaluate(() => {
    const at = document.getSelection()?.anchorNode;
    return Boolean((at instanceof Element ? at : at?.parentElement)?.closest("td"));
  });
  step("the insertion point is in the table's first cell", inCell);
  await shot(page, path.join(out, "notes-insert-table.png"));
  await edit("Undo");
  now = await shape();
  step("Undo takes the table out", now.tables === 0, JSON.stringify(now.lines));
  step("Undo leaves what was typed before it", now.text.trim() === LINE, now.text);
  await edit("Redo");
  now = await shape();
  step("Redo puts the table back", now.tables === 1 && now.text.startsWith(LINE));
  await edit("Undo");

  await window
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: `pixel-${stamp}.png`,
      mimeType: "image/png",
      buffer: Buffer.from(PIXEL, "base64"),
    });
  await page.waitForTimeout(500);
  now = await shape();
  step("a chosen picture goes in the note", now.pictures === 1, JSON.stringify(now.lines));
  await edit("Undo");
  now = await shape();
  step("Undo takes the picture out", now.pictures === 0 && now.text.trim() === LINE, now.text);

  step("Add Table is on with one note shown", await addTable.isEnabled());
  const list = window.getByRole("listbox", { name: "Notes" });
  await bar.getByRole("button", { name: "New Note" }).click();
  await page.waitForTimeout(300);
  await editor.click();
  await page.keyboard.type(`Second ${stamp}`);
  await page.waitForTimeout(500);
  await list
    .getByRole("option")
    .filter({ hasText: LINE })
    .click({ modifiers: ["Shift"] });
  await page.waitForTimeout(300);
  step("Add Table is dimmed with several notes selected", await addTable.isDisabled());
  await list.getByRole("option").filter({ hasText: LINE }).click();
  await page.waitForTimeout(300);

  await bar.getByRole("button", { name: "Gallery View" }).click();
  await page.waitForTimeout(400);
  step("Add Table is dimmed in Gallery View", await addTable.isDisabled());
  await shot(page, path.join(out, "notes-insert-gallery.png"));
  await bar.getByRole("button", { name: "List View" }).click();
  await page.waitForTimeout(400);

  // A file still being read when another tab's change rebuilds this window: the picture must reach
  // the window standing by then.
  const before = await editor.elementHandle();
  await page.evaluate(() => {
    const read = FileReader.prototype.readAsDataURL;
    FileReader.prototype.readAsDataURL = function (file) {
      setTimeout(() => read.call(this, file), 3_000);
    };
  });
  await window
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: `held-${stamp}.png`,
      mimeType: "image/png",
      buffer: Buffer.from(PIXEL, "base64"),
    });
  const other = await page.context().newPage();
  await other.goto(base);
  await launch(other, "Notes");
  const elsewhere = other.getByRole("region", { name: "Notes", exact: true }).first();
  await elsewhere.waitFor({ timeout: 10_000 });
  await other.waitForTimeout(500);
  await elsewhere
    .getByRole("toolbar", { name: "Notes toolbar" })
    .getByRole("button", { name: "New Note" })
    .click();
  await other.waitForTimeout(300);
  await elsewhere.locator('[role="textbox"][aria-label="Note"]:visible').first().click();
  await other.keyboard.type(`From the other tab ${stamp}`);
  await other.waitForTimeout(1_000);
  const rebuilt = await page
    .waitForFunction((node) => !node.isConnected, before, { timeout: 2_500 })
    .then(() => true)
    .catch(() => false);
  step("the other tab's change rebuilds this window while the file is read", rebuilt);
  await page
    .waitForFunction(
      (name) => [...document.querySelectorAll("img")].some((image) => image.alt === name),
      `held-${stamp}.png`,
      { timeout: 6_000 },
    )
    .catch(() => {});
  now = await shape();
  step(
    "the picture read meanwhile reaches the rebuilt window",
    now.pictures === 1,
    JSON.stringify(now.lines),
  );
  step("and the note keeps its text", now.text.includes(LINE), now.text);
  const storedPicture = async () => {
    const reply = await api(page, "GET", "/api/notes/data");
    const notes = reply.json?.data?.notes ?? [];
    const note = notes.find((each) => JSON.stringify(each).includes(LINE));
    return JSON.stringify(note ?? null).includes("data:image");
  };
  let stored = false;
  for (let tries = 0; tries < 30 && !stored; tries += 1) {
    stored = await storedPicture();
    if (!stored) await page.waitForTimeout(250);
  }
  step("and the server stores that picture, with nothing chosen or moved", stored);
  await other.close();
});

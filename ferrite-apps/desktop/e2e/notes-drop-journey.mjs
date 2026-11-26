#!/usr/bin/env node
// Files dragged from Finder into Notes and TextEdit, with real mouse input: a text file's lines go
// into the note shown, a picture shows in it, and TextEdit opens a text file and refuses a picture.
// Exits 0 only when every step passed with no console error, page error or failed request.
//
//   node e2e/notes-drop-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out } = options();
const { step, run } = journey("notes-drop");
const tag = Date.now().toString(36);
const TEXT = `Drop ${tag}.txt`;
const PICTURE = `Drop ${tag}.png`;
const LINE = `dropped line ${tag}`;

async function centre(locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("the element to drag from or to is not shown");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

await run(async (page) => {
  await openDesktop(page, base, step);
  await uploadFile(page, { parent: "documents", name: TEXT, type: "text/plain", text: LINE });
  await uploadFile(page, {
    parent: "documents",
    name: PICTURE,
    type: "image/png",
    text: "not drawn",
  });

  await launch(page, "Notes");
  const notes = page.getByRole("region", { name: "Notes" });
  await notes.getByRole("listbox", { name: "Notes" }).waitFor({ timeout: 10_000 });
  await notes.getByRole("button", { name: "New Note" }).click();
  await page.keyboard.type(`Drop target ${tag}`);
  const editor = notes.locator('[aria-label="Note"]:visible');
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const finder = page.locator(".mac-window.mac-finder").first();
  await finder.waitFor({ timeout: 10_000 });
  await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
  const file = (name) => finder.getByRole("option", { name, exact: true }).first();
  await file(TEXT).waitFor({ timeout: 10_000 });

  // Finder is moved aside, off the right of the page, so a drop has the note to land on.
  const before = await finder.boundingBox();
  await page.mouse.move(before.x + 300, before.y + 10);
  await page.mouse.down();
  await page.mouse.move(before.x + 300 + (900 - before.x), before.y + 10, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const spot = { x: 800, y: 400 };
  const a = await centre(file(TEXT));
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 10, a.y + 10, { steps: 4 });
  await page.mouse.move(spot.x, spot.y, { steps: 12 });
  await shot(page, path.join(out, "notes-drop-over.png"));
  await page.mouse.up();
  await editor
    .getByText(LINE)
    .first()
    .waitFor({ timeout: 8_000 })
    .catch(() => undefined);
  step(
    "a text file dropped on Notes adds its lines to the note",
    (await editor.innerText()).includes(LINE),
  );

  // A drop brings the window it lands on to the front: Finder comes back for the next drag.
  const raiseFinder = async () => {
    await page
      .getByRole("toolbar", { name: "Dock" })
      .getByRole("button", { name: "Finder" })
      .click();
    await page.waitForTimeout(200);
  };
  await raiseFinder();
  const b = await centre(file(PICTURE));
  await page.mouse.move(b.x, b.y);
  await page.mouse.down();
  await page.mouse.move(b.x + 10, b.y + 10, { steps: 4 });
  await page.mouse.move(spot.x, spot.y, { steps: 12 });
  await page.mouse.up();
  await editor
    .locator(`img[alt="${PICTURE}"]`)
    .waitFor({ timeout: 8_000 })
    .catch(() => undefined);
  step(
    "a picture dropped on Notes shows in the note",
    (await editor.locator(`img[alt="${PICTURE}"]`).count()) === 1,
    (await editor.innerHTML()).slice(0, 300),
  );
  await shot(page, path.join(out, "notes-drop-done.png"));

  // Two shares from Finder's Share menu each make a note of their own.
  await raiseFinder();
  await file(TEXT).click();
  await finder.getByRole("button", { name: "Share" }).click();
  await page.getByRole("menuitem", { name: "Notes" }).click();
  const list = notes.getByRole("listbox", { name: "Notes" });
  await page
    .waitForFunction(
      ({ line, target }) => {
        const text = document.querySelector(".mac-notes-text")?.innerText ?? "";
        return text.includes(line) && !text.includes(target);
      },
      { line: LINE, target: `Drop target ${tag}` },
      { timeout: 10_000 },
    )
    .catch(() => undefined);
  await page.waitForTimeout(400);
  step(
    "Share > Notes from Finder makes a new note with the file",
    (await editor.innerText()).includes(LINE) &&
      !(await editor.innerText()).includes(`Drop target ${tag}`),
    await list.getByRole("option", { selected: true }).first().innerText(),
  );

  await launch(page, "TextEdit");
  const document = page.getByRole("textbox", { name: "Document" }).first();
  await document.waitFor({ timeout: 10_000 });
  await raiseFinder();
  const into = spot;
  // A window that has just opened holds its content inert until its document has loaded.
  await page.waitForFunction(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest(".mac-textedit-body"),
    into,
    { timeout: 15_000 },
  );
  const c = await centre(file(PICTURE));
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 10, c.y + 10, { steps: 4 });
  await page.mouse.move(into.x, into.y, { steps: 12 });
  await page
    .locator('[data-desktop-drop="refuse"]')
    .first()
    .waitFor({ state: "attached", timeout: 3_000 })
    .catch(() => undefined);
  step(
    "TextEdit refuses a picture",
    (await page.locator('[data-desktop-drop="refuse"]').count()) > 0,
  );
  await page.keyboard.press("Escape");
  await page.mouse.up();
  const d = await centre(file(TEXT));
  await page.mouse.move(d.x, d.y);
  await page.mouse.down();
  await page.mouse.move(d.x + 10, d.y + 10, { steps: 4 });
  await page.mouse.move(into.x, into.y, { steps: 12 });
  await page.mouse.up();
  const opened = page.getByRole("textbox", { name: "Document" }).first();
  await opened.getByText(LINE).first().waitFor({ timeout: 10_000 });
  step("a text file dropped on TextEdit opens there", true);
  await shot(page, path.join(out, "textedit-drop-done.png"));
});

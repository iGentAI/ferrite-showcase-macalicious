#!/usr/bin/env node
// Notes at depth: the File and View menus, multi-selection, pins, Recently Deleted, checklists,
// Find, folders by context menu and drag, sort order and Preferences, then that it all survives a
// reload. Exits 0 only when every step passed with no console error, page error or failed request.
//
//   ferrite dev                                        # in ferrite-apps/desktop
//   node e2e/notes-depth-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("notes-depth");
const stamp = Date.now();
const A = `Depth A ${stamp}`;
const B = `Depth B ${stamp}`;
const C = `Depth C ${stamp}`;

const menuBar = (page, title) =>
  page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
async function choose(page, title, ...items) {
  await menuBar(page, title).click();
  await page.waitForTimeout(250);
  for (const [index, item] of items.entries()) {
    const entry = page
      .getByRole("menuitem", { name: item })
      .or(page.getByRole("menuitemradio", { name: item }))
      .or(page.getByRole("menuitemcheckbox", { name: item }))
      .first();
    if (index < items.length - 1) {
      await entry.hover();
      await page.waitForTimeout(250);
    } else await entry.click();
  }
  await page.waitForTimeout(250);
}
/** A command chosen from a menu gives the note the keyboard once the menu has closed. */
const noteHasKeyboard = (page) =>
  page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-label") === "Note",
    undefined,
    { timeout: 5000 },
  );
const saved = async (page) => (await api(page, "GET", "/api/notes/data")).json.data;
const noteOf = (data, title) => data?.notes.find((note) => note.lines[0] === title);
async function settled(page, test) {
  for (let i = 0; i < 40; i++) {
    const data = await saved(page);
    if (test(data)) return data;
    await page.waitForTimeout(250);
  }
  return saved(page);
}

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Notes");
  const window = page.getByRole("region", { name: "Notes" });
  const list = window.getByRole("listbox", { name: "Notes" });
  await list.waitFor({ state: "visible", timeout: 10_000 });
  const row = (title) => list.getByRole("option", { name: new RegExp(title) });
  const editor = () => window.locator('[aria-label="Note"]:visible');

  // File > New Note, three times.
  for (const title of [A, B, C]) {
    await choose(page, "File", "New Note");
    await page.keyboard.type(title);
    await page.waitForTimeout(150);
  }
  step("File > New Note makes notes that take the keyboard", await row(A).isVisible());

  // Multi-selection and a pin.
  await row(A).click();
  await row(B).click({ modifiers: ["ControlOrMeta"] });
  step(
    "Command-click selects several notes",
    await window.getByText("2 Notes Selected").isVisible(),
  );
  await shot(page, path.join(out, "notes-multi-select.png"));
  await row(B).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Pin Note" }).click();
  let data = await settled(page, (each) => noteOf(each, A)?.pinned && noteOf(each, B)?.pinned);
  step(
    "the note row's context menu pins both, and saves it",
    noteOf(data, A)?.pinned === true && noteOf(data, B)?.pinned === true,
  );
  step(
    "the note list shows the Pinned heading",
    await window.locator(".mac-notes-section", { hasText: "Pinned" }).isVisible(),
  );
  await shot(page, path.join(out, "notes-pinned.png"));

  // A new dashed list through Undo and Redo keeps its text and its kind, in a note of its own.
  await choose(page, "File", "New Note");
  await page.keyboard.type(`Depth D ${stamp}`);
  await page.keyboard.press("Enter");
  await page.keyboard.type("Tea");
  await page.waitForTimeout(200);
  await choose(page, "Format", "Dashed List");
  await noteHasKeyboard(page);
  const dashed = editor().locator(".mac-notes-dashed");
  step("Format > Dashed List makes a list of that kind", (await dashed.count()) === 1);
  await page.waitForTimeout(500);
  // The browser's history holds the list as two steps.
  await page.keyboard.press("ControlOrMeta+z");
  await page.waitForTimeout(200);
  await page.keyboard.press("ControlOrMeta+z");
  await page.waitForTimeout(200);
  step(
    "Undo takes the new list back",
    (await dashed.count()) === 0 && (await editor().locator("li").count()) === 0,
    await editor().first().innerHTML(),
  );
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await page.waitForTimeout(200);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await page.waitForTimeout(200);
  step(
    "Redo brings the list back with its text",
    (await editor().locator("li").count()) === 1 &&
      (await editor().locator("li").first().innerText()).includes("Tea"),
  );

  // A checklist that ticks, kept in the note's formats.
  await row(C).click();
  await editor().click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await choose(page, "Format", "Checklist");
  await noteHasKeyboard(page);
  await page.keyboard.type("Milk");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Eggs");
  const items = editor().locator(".mac-notes-checklist > li");
  step(
    "Format > Checklist makes a list, and Return adds to it",
    (await items.count()) === 2,
    `${await editor().count()} editors: ${await editor().first().innerHTML()}`,
  );
  const box = await items.first().boundingBox();
  await page.mouse.click(box.x + 8, box.y + 9);
  step(
    "a press on an item's circle ticks it",
    (await items.first().getAttribute("data-checked")) === "true",
  );
  await page.keyboard.press("ControlOrMeta+z");
  await page.waitForTimeout(150);
  step(
    "Undo takes a tick back",
    (await editor().locator(".mac-notes-checklist > li").first().getAttribute("data-checked")) ===
      null && (await items.count()) === 2,
  );
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await page.waitForTimeout(150);
  await shot(page, path.join(out, "notes-checklist.png"));
  data = await settled(page, (each) => noteOf(each, C)?.html?.includes("data-checked"));
  step(
    "the server accepts the checklist with its tick",
    noteOf(data, C)?.html?.includes('data-checked="true"') === true,
  );

  // Find in the note.
  await page.keyboard.press("ControlOrMeta+f");
  const field = window.locator(".mac-notes-find input");
  await field.waitFor({ state: "visible" });
  await field.fill("Eggs");
  step("Command-F finds text in the note", await window.getByText("1 of 1").isVisible());
  await shot(page, path.join(out, "notes-find.png"));
  await page.keyboard.press("Escape");

  // A folder, named in place, then a note dragged into it, then renamed from its context menu.
  await window.getByRole("button", { name: "New Folder" }).click();
  const name = window.getByRole("textbox", { name: "Folder name" });
  await name.fill(`Trip ${stamp}`);
  await page.keyboard.press("Enter");
  const folder = window.getByRole("treeitem", { name: new RegExp(`Trip ${stamp}`) });
  step("a new folder's name is edited in place", await folder.isVisible());
  await window.getByRole("treeitem", { name: /^Notes/ }).click();
  await row(C).dragTo(folder);
  data = await settled(page, (each) => {
    const target = each?.folders.find((one) => one.name === `Trip ${stamp}`);
    return target && noteOf(each, C)?.folder === target.id;
  });
  const trip = data.folders.find((one) => one.name === `Trip ${stamp}`);
  step(
    "a note dragged to a folder moves there",
    trip !== undefined && noteOf(data, C)?.folder === trip.id,
  );
  await folder.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename Folder" }).click();
  await name.fill(`Trip2 ${stamp}`);
  await page.keyboard.press("Enter");
  data = await settled(page, (each) => each.folders.some((one) => one.name === `Trip2 ${stamp}`));
  step(
    "the folder's context menu renames it",
    data.folders.some((one) => one.name === `Trip2 ${stamp}`),
  );
  await shot(page, path.join(out, "notes-folders.png"));

  // Recently Deleted: delete, reload, recover.
  await window.getByRole("treeitem", { name: /^Trip2/ }).click();
  await row(C).click();
  await window.getByRole("button", { name: "Delete" }).click();
  data = await settled(page, (each) => noteOf(each, C)?.deleted);
  step("Delete puts the note in Recently Deleted", typeof noteOf(data, C)?.deleted === "string");

  // View: gallery and sort, kept across a reload.
  await window.getByRole("treeitem", { name: /^Notes/ }).click();
  await choose(page, "View", "Sort By", "Title");
  await choose(page, "View", "as Gallery");
  await page.waitForTimeout(800);
  await reloadDesktop(page);
  await launch(page, "Notes");
  await window.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(500);
  step(
    "the gallery view survives a reload",
    (await window.locator(".mac-notes-card").count()) > 0 &&
      (await window.locator(".mac-notes-browser[hidden]").count()) === 1,
  );
  await shot(page, path.join(out, "notes-gallery-after-reload.png"));
  await choose(page, "View", "as List");
  await window.getByRole("treeitem", { name: /^Recently Deleted/ }).click();
  await list.waitFor({ state: "visible" });
  step("Recently Deleted survives a reload with the note", await row(C).isVisible());
  await shot(page, path.join(out, "notes-recently-deleted.png"));
  await window.getByRole("button", { name: "Recover" }).click();
  data = await settled(page, (each) => noteOf(each, C) && !noteOf(each, C).deleted);
  const recovered = noteOf(data, C);
  step(
    "Recover puts it back in its folder",
    recovered !== undefined && recovered.deleted === undefined && recovered.folder === trip?.id,
  );

  // Preferences.
  await choose(page, "Notes", "Preferences");
  await page.locator(".mac-notes-preferences").waitFor({ state: "visible", timeout: 5000 });
  step("Notes > Preferences opens its window", true);
  await shot(page, path.join(out, "notes-preferences.png"));
});

#!/usr/bin/env node
// Notes on Ferrite: tables, their rows and columns. In a new note, Add Table (the toolbar) makes a
// 2 x 2 table and the cells are typed into, Tab going from cell to cell. Then, on the cell with the
// insertion point, from the desktop menu bar's Format > Table and from the keyboard
// (Option-Command with an arrow; Control-Option off Apple platforms): Add Row Below, Add Column
// After, Add Row Above, Delete Row, Add Column Before, Delete Column, each read back from the
// table, with text typed into the new cells. The Table items are dimmed with the insertion point
// outside the table. Then a row added from Format > Table is undone and redone from the menu bar's
// Edit > Undo and Redo and from Command-Z and Shift-Command-Z, the insertion point staying in the
// table, and undone again. The server keeps the table as left, a reload shows it, and a second window of
// the session shows it.
//   --phase write (the default) does all of that and keeps the session in <out>/tables-<browser>.json.
//   --phase restart-check, after `ferrite dev` was stopped and started on the same data root, opens
//   that session again and finds the table as it was left.
// Exits 0 only when every step passed and the page logged no console error, page error, failed
// request or HTTP error.
//
//   ferrite dev                                   # in ferrite-apps/desktop
//   node e2e/editors-tables-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                       [--browser chromium|chrome|firefox|webkit] [--phase write|restart-check]

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { engineFamily } from "./journey-kit.mjs";

const { base, out, browserName } = options();
const phaseAt = process.argv.indexOf("--phase");
const phase = phaseAt >= 0 ? process.argv[phaseAt + 1] : "write";
const stateFile = path.join(out, `tables-${browserName}.json`);
const sessionFile = path.join(out, `tables-${browserName}-session.json`);
if (phase === "restart-check" && !existsSync(stateFile)) {
  console.error(`no ${stateFile}: run --phase write first`);
  process.exit(2);
}
const { step, run } = journey(
  "editors-tables",
  phase === "restart-check"
    ? { contextOptions: { [engineFamily(browserName)]: { storageState: sessionFile } } }
    : {},
);
const stamp = String(Date.now()).slice(-6);
const TITLE =
  phase === "restart-check"
    ? JSON.parse(readFileSync(stateFile, "utf8")).title
    : `Tables journey ${stamp}`;
/** The table as the journey leaves it, row by row. */
const FINAL = [
  ["A1", "B1", ""],
  ["A2", "B2", ""],
  ["", "B3", "C3"],
];

const shownNote = (page) => page.locator('[role="textbox"][aria-label="Note"]:visible').first();

/** The texts of the note's table, row by row (`null` without a table). */
const gridOf = (editor) =>
  editor.evaluate((root) => {
    const table = root.querySelector("table.mac-notes-table");
    return table
      ? [...table.querySelectorAll("tr")].map((row) =>
          [...row.querySelectorAll("td")].map((cell) => cell.textContent.trim()),
        )
      : null;
  });

/** Which cell of the table holds the insertion point: [row, column], or null. */
const caretCell = (editor) =>
  editor.evaluate((root) => {
    const at = root.ownerDocument.getSelection()?.anchorNode;
    const element = at?.nodeType === 1 ? at : at?.parentElement;
    const cell = element?.closest("td");
    if (!cell || !root.contains(cell)) return null;
    const row = cell.parentElement;
    return [[...row.parentElement.children].indexOf(row), [...row.children].indexOf(cell)];
  });

/** Put the insertion point at the end of the cell whose text is `text`, the note focused. */
const caretInCell = (editor, text) =>
  editor.evaluate((root, wanted) => {
    const cell = [...root.querySelectorAll("td")].find(
      (each) => each.textContent.trim() === wanted,
    );
    if (!cell) return false;
    root.focus();
    const range = root.ownerDocument.createRange();
    range.selectNodeContents(cell);
    range.collapse(false);
    const selection = root.ownerDocument.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }, text);

/** Open the desktop menu bar's Format > Table submenu, as a person does. */
async function openTableMenu(page) {
  await page
    .getByRole("menubar")
    .first()
    .getByRole("menuitem", { name: "Format", exact: true })
    .click();
  await page.getByRole("menu").getByRole("menuitem", { name: "Table", exact: true }).click();
}
const tableItem = (page, name) =>
  page
    .getByRole("menu")
    .getByRole("menuitem", { name: new RegExp(`^${name}`) })
    .first();
/** Choose `name` of Format > Table; the menu closes and the note takes the keyboard back. */
async function chooseTable(page, name) {
  await openTableMenu(page);
  const entry = tableItem(page, name);
  await entry.waitFor({ timeout: 5_000 });
  await entry.click();
  await page.waitForFunction(() => !document.querySelector('[role="menu"]'), undefined, {
    timeout: 5_000,
  });
  await page.waitForTimeout(400);
}

/** Open Notes and show the note titled `TITLE`. */
async function showTheNote(page) {
  await launch(page, "Notes");
  await page.getByRole("region", { name: "Notes" }).first().waitFor({ timeout: 15_000 });
  await page
    .getByRole("option", { name: new RegExp(`^${TITLE}`) })
    .first()
    .click();
  const note = shownNote(page);
  await note.waitFor({ timeout: 10_000 });
  await page.waitForFunction(() => document.querySelector("table.mac-notes-table"), undefined, {
    timeout: 10_000,
  });
  return note;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

await run(async (page) => {
  await openDesktop(page, base, step);

  if (phase === "restart-check") {
    const note = await showTheNote(page);
    const grid = await gridOf(note);
    step(
      "after ferrite dev was stopped and started on the same data root, the table is as it was left",
      same(grid, FINAL),
      JSON.stringify(grid),
    );
    await shot(page, path.join(out, `tables-${browserName}-after-restart.png`));
    return;
  }

  // A new note with a table, typed into with Tab between the cells.
  await launch(page, "Notes");
  const notesWindow = page.getByRole("region", { name: "Notes" }).first();
  await notesWindow.waitFor({ timeout: 15_000 });
  await notesWindow.getByRole("button", { name: "New Note" }).click();
  const note = shownNote(page);
  await note.waitFor({ timeout: 10_000 });
  await note.click();
  await page.keyboard.type(TITLE);
  await page.keyboard.press("Enter");
  await notesWindow.getByRole("button", { name: "Add Table" }).click();
  await page.waitForTimeout(300);
  for (const [index, text] of ["A1", "B1", "A2", "B2"].entries()) {
    if (index > 0) await page.keyboard.press("Tab");
    await page.keyboard.type(text);
  }
  step(
    "Add Table makes a 2 x 2 table, and Tab goes from cell to cell",
    same(await gridOf(note), [
      ["A1", "B1"],
      ["A2", "B2"],
    ]),
    JSON.stringify(await gridOf(note)),
  );

  // Outside the table, Format > Table is dimmed.
  await note.evaluate((root) => {
    const first = root.firstChild;
    root.focus();
    const range = root.ownerDocument.createRange();
    range.selectNodeContents(first);
    range.collapse(false);
    root.ownerDocument.getSelection().removeAllRanges();
    root.ownerDocument.getSelection().addRange(range);
  });
  await page.waitForTimeout(200);
  await openTableMenu(page);
  await tableItem(page, "Add Row Below").waitFor({ timeout: 5_000 });
  step(
    "Format > Table is dimmed while the insertion point is not in a table",
    (await tableItem(page, "Add Row Below").getAttribute("aria-disabled")) === "true" &&
      (await tableItem(page, "Delete Column").getAttribute("aria-disabled")) === "true",
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // From the menu bar: a row below B2, typed into.
  await caretInCell(note, "B2");
  await page.waitForTimeout(200);
  await chooseTable(page, "Add Row Below");
  const below = await caretCell(note);
  await page.keyboard.type("B3");
  step(
    "Format > Table > Add Row Below adds a row under the cell, the insertion point in its new cell",
    same(below, [2, 1]) &&
      same(await gridOf(note), [
        ["A1", "B1"],
        ["A2", "B2"],
        ["", "B3"],
      ]),
    JSON.stringify({ caret: below, grid: await gridOf(note) }),
  );

  // From the keyboard: a column after B3, typed into.
  await page.keyboard.press("ControlOrMeta+Alt+ArrowRight");
  await page.waitForTimeout(300);
  const after = await caretCell(note);
  await page.keyboard.type("C3");
  step(
    "Option-Command-Right Arrow adds a column after the cell, the insertion point in its new cell",
    same(after, [2, 2]) && same(await gridOf(note), FINAL),
    JSON.stringify({ caret: after, grid: await gridOf(note) }),
  );

  // A row above, typed into, then deleted from the menu bar.
  await chooseTable(page, "Add Row Above");
  await page.keyboard.type("X");
  const above = await gridOf(note);
  await chooseTable(page, "Delete Row");
  step(
    "Format > Table > Add Row Above adds a row over the cell, and Delete Row takes it out",
    same(above, [FINAL[0], FINAL[1], ["", "", "X"], FINAL[2]]) && same(await gridOf(note), FINAL),
    JSON.stringify(above),
  );

  // A column before, then deleted from the menu bar.
  await chooseTable(page, "Add Column Before");
  const before = await gridOf(note);
  await chooseTable(page, "Delete Column");
  step(
    "Format > Table > Add Column Before adds a column, and Delete Column takes it out",
    before?.every((row) => row.length === 4) === true && same(await gridOf(note), FINAL),
    JSON.stringify(before),
  );

  // Undo and Redo of a table change: from the desktop menu bar's Edit menu and from the keyboard.
  const withRow = [...FINAL, ["", "", ""]];
  const chooseEdit = async (name) => {
    await page
      .getByRole("menubar")
      .first()
      .getByRole("menuitem", { name: "Edit", exact: true })
      .click();
    const entry = page
      .getByRole("menu")
      .getByRole("menuitem", { name: new RegExp(`^${name}`) })
      .first();
    await entry.waitFor({ timeout: 5_000 });
    await entry.click();
    await page.waitForFunction(() => !document.querySelector('[role="menu"]'), undefined, {
      timeout: 5_000,
    });
    await page.waitForTimeout(400);
  };
  const press = async (keys) => {
    await page.keyboard.press(keys);
    await page.waitForTimeout(400);
  };
  await caretInCell(note, "C3");
  await page.waitForTimeout(200);
  await chooseTable(page, "Add Row Below");
  const added = await gridOf(note);
  await chooseEdit("Undo");
  const undone = { grid: await gridOf(note), caret: await caretCell(note) };
  step(
    "Edit > Undo takes Add Row Below back, the insertion point still in the table",
    same(added, withRow) && same(undone.grid, FINAL) && undone.caret !== null,
    JSON.stringify({ added, undone }),
  );
  await chooseEdit("Redo");
  const redone = { grid: await gridOf(note), caret: await caretCell(note) };
  step(
    "Edit > Redo adds the row again, the insertion point in the table",
    same(redone.grid, withRow) && redone.caret !== null,
    JSON.stringify(redone),
  );
  await press("ControlOrMeta+z");
  const keyUndone = { grid: await gridOf(note), caret: await caretCell(note) };
  await press("ControlOrMeta+Shift+z");
  const keyRedone = { grid: await gridOf(note), caret: await caretCell(note) };
  step(
    "Command-Z and Shift-Command-Z undo and redo it too, the insertion point in the table",
    same(keyUndone.grid, FINAL) &&
      keyUndone.caret !== null &&
      same(keyRedone.grid, withRow) &&
      keyRedone.caret !== null,
    JSON.stringify({ keyUndone, keyRedone }),
  );
  // Undone once more: the note is left as FINAL for the saving, reload and restart steps.
  await press("ControlOrMeta+z");
  step(
    "undone again, the table is as it was before the row was added",
    same(await gridOf(note), FINAL),
    JSON.stringify(await gridOf(note)),
  );
  await shot(page, path.join(out, `tables-${browserName}.png`));

  // The server keeps the table as left.
  await page.waitForTimeout(2500);
  const stored = (await api(page, "GET", "/api/notes/data")).json?.data?.notes ?? [];
  const saved = stored.find((each) => each.lines?.[0] === TITLE);
  const holder = await page.evaluate((html) => {
    const box = document.createElement("div");
    box.innerHTML = html ?? "";
    const table = box.querySelector("table.mac-notes-table");
    return table
      ? [...table.querySelectorAll("tr")].map((row) =>
          [...row.querySelectorAll("td")].map((cell) => cell.textContent.trim()),
        )
      : null;
  }, saved?.html);
  step("the server keeps the table as it was left", same(holder, FINAL), JSON.stringify(holder));

  // A reload, and a second window of the session.
  await reloadDesktop(page);
  const reloaded = await gridOf(await showTheNote(page));
  step("after a reload the note shows the table as it was left", same(reloaded, FINAL));
  const second = await page.context().newPage();
  await openDesktop(second, base, step);
  const there = await gridOf(await showTheNote(second));
  step("a second window of the session shows the table as it was left", same(there, FINAL));
  await second.close();

  // The session, for --phase restart-check.
  await page.context().storageState({ path: sessionFile });
  writeFileSync(stateFile, JSON.stringify({ title: TITLE, final: FINAL }, null, 1));
});

#!/usr/bin/env node
// Finder's Undo and Redo, on the signed-in person's drive: Move to Trash, rename, New Folder,
// Duplicate, Move Item Here and tags are each taken back and carried out again from the Edit menu
// and the keys, read back from the server. A step whose item has gone is refused with the drive's
// own words. Keys in a field stay the field's.
//
//   node scripts/dev-front-end.mjs --port 3020    # beside the shared desktop on 8787
//   node e2e/finder-undo-journey.mjs [--url http://127.0.0.1:3020] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run, expectRefusal } = journey("finder-undo");
const tag = Date.now().toString(36);
const NAME = `Undo me ${tag}.txt`;
const NEW_NAME = `Undone ${tag}.txt`;
const GONE = `Erased ${tag}.txt`;

const bar = (page) => page.getByRole("menubar").first();
const drive = async (page) => (await api(page, "GET", "/api/files/")).json;
const entry = async (page, id) => (await drive(page)).entries.find((each) => each.id === id);

async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

const menusClosed = (page) =>
  until(async () => (await page.getByRole("menu").count()) === 0, 3_000);

async function choose(page, title, item) {
  await bar(page).getByRole("menuitem", { name: title, exact: true }).click();
  await page.getByRole("menu").getByRole("menuitem", { name: item, exact: true }).click();
  await menusClosed(page);
}

/** Whether Edit's row is there and can be chosen. */
async function canChoose(page, name) {
  await bar(page).getByRole("menuitem", { name: "Edit", exact: true }).click();
  const row = page.getByRole("menu").getByRole("menuitem", { name, exact: true });
  await row.waitFor({ timeout: 1_000 }).catch(() => {});
  const there = (await row.count()) === 1 && (await row.getAttribute("aria-disabled")) !== "true";
  await page.keyboard.press("Escape");
  await menusClosed(page);
  return there;
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const id = await uploadFile(page, {
    parent: "documents",
    name: NAME,
    type: "text/plain",
    text: NAME,
  });
  const goneId = await uploadFile(page, {
    parent: "documents",
    name: GONE,
    type: "text/plain",
    text: GONE,
  });
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const win = page.locator(".mac-window.mac-finder").first();
  await win.waitFor({ timeout: 10_000 });
  const item = (name) => win.getByRole("option", { name, exact: true }).first();
  const selected = async (name) => (await item(name).getAttribute("aria-selected")) === "true";
  await win.getByRole("treeitem", { name: "Documents", exact: true }).click();
  await item(NAME).waitFor({ timeout: 10_000 });

  // Move to Trash: the row names it, the menu and the keys both work, and the item is selected again.
  await item(NAME).click();
  await choose(page, "File", "Move to Trash");
  step(
    "Move to Trash puts it in the Trash, on the server",
    await until(async () => (await entry(page, id))?.trashed_ms !== undefined),
  );
  step("Edit names what Undo takes back", await canChoose(page, `Undo Move of “${NAME}”`));
  await bar(page).getByRole("menuitem", { name: "Edit", exact: true }).click();
  await shot(page, path.join(out, `finder-undo-menu-${browserName}.png`));
  await page.keyboard.press("Escape");
  await menusClosed(page);
  await choose(page, "Edit", `Undo Move of “${NAME}”`);
  step(
    "Undo puts it back, on the server, and selects it",
    await until(
      async () =>
        (await entry(page, id))?.trashed_ms === undefined &&
        (await item(NAME).count()) === 1 &&
        (await selected(NAME)),
    ),
  );
  step("Edit names what Redo carries out", await canChoose(page, `Redo Move of “${NAME}”`));
  await win.click({ position: { x: 400, y: 12 } });
  await page.keyboard.press("Control+Shift+z");
  step(
    "Shift-Command-Z carries it out again",
    await until(async () => (await entry(page, id))?.trashed_ms !== undefined),
  );
  await win.click({ position: { x: 400, y: 12 } });
  await page.keyboard.press("Control+z");
  step(
    "Command-Z takes it back",
    await until(async () => (await entry(page, id))?.trashed_ms === undefined),
  );

  // Rename.
  await item(NAME).waitFor({ timeout: 8_000 });
  await item(NAME).click();
  await page.keyboard.press("Enter");
  await win.locator("input.mac-finder-rename, .mac-finder-rename input").first().waitFor();
  await page.keyboard.press("Control+a");
  await page.keyboard.type(NEW_NAME);
  await page.keyboard.press("Enter");
  await until(async () => (await entry(page, id))?.name === NEW_NAME);
  await until(() => canChoose(page, "Undo Rename"));
  await choose(page, "Edit", "Undo Rename");
  step(
    "Undo Rename gives the old name back, on the server",
    await until(async () => (await entry(page, id))?.name === NAME),
  );
  await choose(page, "Edit", "Redo Rename");
  step(
    "Redo Rename gives the new one, on the server",
    await until(async () => (await entry(page, id))?.name === NEW_NAME),
  );
  await choose(page, "Edit", "Undo Rename");
  await until(async () => (await entry(page, id))?.name === NAME);

  // New Folder: undone it goes to the Trash; redone it is the same folder.
  const before = new Set((await drive(page)).entries.map((each) => each.id));
  await choose(page, "File", "New Folder");
  const folder = await until(async () =>
    (await drive(page)).entries.find(
      (each) => each.kind === "folder" && each.parent === "documents" && !before.has(each.id),
    ),
  );
  await until(() => canChoose(page, "Undo New Folder"));
  await choose(page, "Edit", "Undo New Folder");
  step(
    "Undo New Folder sends it to the Trash, on the server",
    await until(async () => (await entry(page, folder.id))?.trashed_ms !== undefined),
  );
  await choose(page, "Edit", "Redo New Folder");
  step(
    "Redo New Folder brings the same one back, on the server",
    await until(async () => (await entry(page, folder.id))?.trashed_ms === undefined),
  );

  // Duplicate.
  await item(NAME).click();
  await choose(page, "File", "Duplicate");
  const copy = await until(async () =>
    (await drive(page)).entries.find(
      (each) => each.name.startsWith(`Undo me ${tag} copy`) && each.trashed_ms === undefined,
    ),
  );
  step("Duplicate makes a copy, on the server", Boolean(copy));
  await until(() => canChoose(page, `Undo Duplicate of “${NAME}”`));
  await choose(page, "Edit", `Undo Duplicate of “${NAME}”`);
  step(
    "Undo Duplicate sends the copy to the Trash, on the server",
    await until(async () => (await entry(page, copy.id))?.trashed_ms !== undefined),
  );

  // Move Item Here, from another folder.
  await item(NAME).click();
  await choose(page, "Edit", `Copy “${NAME}”`);
  await choose(page, "Go", "Downloads");
  await until(
    async () => (await win.getByRole("listbox").first().getAttribute("aria-label")) === "Downloads",
  );
  await choose(page, "Edit", "Move Item Here");
  await until(async () => (await entry(page, id))?.parent === "downloads");
  await until(() => canChoose(page, `Undo Move of “${NAME}”`));
  await choose(page, "Edit", `Undo Move of “${NAME}”`);
  step(
    "Undo Move sends it back to its folder, on the server",
    await until(async () => (await entry(page, id))?.parent === "documents"),
  );
  await choose(page, "Go", "Documents");
  await item(NAME).waitFor({ timeout: 8_000 });

  // Tags.
  await item(NAME).click();
  await win.getByRole("button", { name: "Edit Tags" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Red", exact: true }).click();
  await page.keyboard.press("Escape");
  await menusClosed(page);
  await until(async () => (await entry(page, id))?.tags?.includes("Red"));
  await until(() => canChoose(page, "Undo Tag"));
  await choose(page, "Edit", "Undo Tag");
  step(
    "Undo Tag takes the tag off, on the server",
    await until(async () => !(await entry(page, id))?.tags?.includes("Red")),
  );

  // Command-Z in a field is the field's.
  const search = win.getByRole("searchbox").or(win.locator(".mac-finder-search input")).first();
  await search.click();
  await page.keyboard.press("Control+Shift+z");
  await new Promise((resolve) => setTimeout(resolve, 500));
  step(
    "Shift-Command-Z in the search field leaves the drive alone",
    !(await entry(page, id))?.tags?.includes("Red"),
  );
  await win.getByRole("treeitem", { name: "Documents", exact: true }).click();

  // A step whose item has been erased.
  await item(GONE).waitFor({ timeout: 8_000 });
  await item(GONE).click();
  await choose(page, "File", "Move to Trash");
  await until(async () => (await entry(page, goneId))?.trashed_ms !== undefined);
  await until(() => canChoose(page, `Undo Move of “${GONE}”`));
  await api(page, "POST", "/api/files/ops", { ops: [{ op: "delete", id: goneId }] });
  expectRefusal(404, "/api/files/ops");
  await choose(page, "Edit", `Undo Move of “${GONE}”`);
  const alert = page.getByRole("alertdialog");
  step(
    "Undo of an item that has been erased says so",
    await alert.waitFor({ timeout: 5_000 }).then(
      () => true,
      () => false,
    ),
  );
  await shot(page, path.join(out, `finder-undo-refused-${browserName}.png`));
  await alert.getByRole("button").first().click();
  step("and the step leaves the stack", !(await canChoose(page, `Undo Move of “${GONE}”`)));

  // Tidy up.
  await api(page, "POST", "/api/files/ops", {
    ops: [
      { op: "trash", id: folder.id },
      { op: "trash", id },
    ],
  });
});

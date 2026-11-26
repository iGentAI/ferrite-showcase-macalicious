#!/usr/bin/env node
// The desktop's own items on the signed-in person's drive: the Desktop folder shows as icons that
// select, rubber-band, open, rename, drag into folders, into Finder and to the Trash, and have a menu;
// the Dock's Trash opens and empties; the Downloads stack lists the real folder. Read back from the
// server.
//
//   node scripts/dev-front-end.mjs --port 3020    # beside the shared desktop on 8787
//   node e2e/desktop-items-journey.mjs [--url http://127.0.0.1:3020] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("desktop-items");
const tag = Date.now().toString(36);
const NOTE = `Desk note ${tag}.txt`;
const OTHER = `Desk other ${tag}.txt`;
const BIN = `Desk bin ${tag}.txt`;
const FOLDER = `Desk folder ${tag}`;
const LOADED = `Loaded ${tag}.txt`;

const drive = async (page) => (await api(page, "GET", "/api/files/")).json;
const entry = async (page, id) => (await drive(page)).entries.find((each) => each.id === id);
const named = async (page, name) =>
  (await drive(page)).entries.find((each) => each.name === name && each.trashed_ms === undefined);

async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

const centre = async (locator) => {
  const box = await locator.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

async function drag(page, from, to) {
  const start = await centre(from);
  const end = await centre(to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 12, start.y + 12, { steps: 3 });
  await page.mouse.move(end.x, end.y, { steps: 10 });
  await page.mouse.up();
}

/** A point on the desktop's picture: nothing else is drawn over it. */
const onPicture = (page) =>
  page.evaluate(() => {
    const root = document.querySelector(".mac-desktop-shell-desktop");
    const { width, height } = root.getBoundingClientRect();
    for (let y = height - 100; y > 40; y -= 40) {
      for (let x = 24; x < width; x += 40) {
        if (document.elementFromPoint(x, y) === root) return { x, y };
      }
    }
    throw new Error("The windows cover the whole desktop");
  });

await run(async (page) => {
  await openDesktop(page, base, step);
  const up = (name, parent = "desktop") =>
    uploadFile(page, { parent, name, type: "text/plain", text: name });
  const noteId = await up(NOTE);
  const otherId = await up(OTHER);
  const binId = await up(BIN);
  const made = await api(page, "POST", "/api/files/ops", {
    ops: [{ op: "mkdir", parent: "desktop", name: FOLDER }],
  });
  const folderId = made.json.created?.[0];
  await up(LOADED, "downloads");
  await page.reload();
  await openDesktop(page, base, step);

  const desk = page.getByRole("group", { name: "Desktop", exact: true });
  const icon = (name) => desk.locator(".mac-desktop-icon", { hasText: name }).first();
  const pressed = async (name) => (await icon(name).getAttribute("aria-pressed")) === "true";
  await icon(NOTE).waitFor({ timeout: 10_000 });
  step("The Desktop folder's items show as icons", (await icon(FOLDER).count()) === 1);
  step(
    "The invented stacks have gone",
    (await desk.getByText("PDF Documents", { exact: true }).count()) === 0,
  );

  // Selection, and the rubber band.
  await icon(NOTE).click();
  step("A click selects an icon", await pressed(NOTE));
  await icon(OTHER).click({ modifiers: ["Control"] });
  step("Command-click adds another", (await pressed(NOTE)) && (await pressed(OTHER)));
  const box = await desk.boundingBox();
  const noteBox = await icon(NOTE).boundingBox();
  await page.mouse.click(box.x + 200, box.y + 200);
  step("A click on the picture selects nothing", !(await pressed(NOTE)));
  await page.mouse.move(noteBox.x - 40, noteBox.y - 10);
  await page.mouse.down();
  await page.mouse.move(noteBox.x - 20, noteBox.y + 10, { steps: 3 });
  await page.mouse.move(noteBox.x + 20, noteBox.y + noteBox.height + 4, { steps: 6 });
  step("A rubber band selects what it touches", await until(() => pressed(NOTE)));
  await shot(page, path.join(out, `desktop-items-marquee-${browserName}.png`));
  await page.mouse.up();

  // Rename.
  await icon(NOTE).click();
  await icon(NOTE).focus();
  await page.keyboard.press("Enter");
  const field = desk.locator("input").first();
  await field.waitFor({ timeout: 4_000 });
  await shot(page, path.join(out, `desktop-items-rename-${browserName}.png`));
  const renamed = `Renamed ${tag}.txt`;
  await page.keyboard.press("Control+a");
  await page.keyboard.type(renamed);
  await page.keyboard.press("Enter");
  step(
    "Return renames in place, on the server",
    await until(async () => (await entry(page, noteId))?.name === renamed),
  );

  // Drags.
  await icon(renamed).waitFor({ timeout: 8_000 });
  await drag(page, icon(renamed), icon(FOLDER));
  step(
    "Dragging an icon onto a folder icon moves it there, on the server",
    await until(async () => (await entry(page, noteId))?.parent === folderId),
  );
  await drag(
    page,
    icon(BIN),
    page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Trash" }),
  );
  step(
    "Dragging an icon to the Dock's Trash trashes it, on the server",
    await until(async () => (await entry(page, binId))?.trashed_ms !== undefined),
  );
  const trashTile = page
    .getByRole("toolbar", { name: "Dock" })
    .getByRole("button", { name: "Trash" });
  step(
    "The Trash tile shows it is full",
    await until(async () => (await trashTile.getAttribute("data-full")) !== null),
  );

  // Open a file; then Finder for the rest.
  await icon(OTHER).dblclick();
  step(
    "A double click opens the file in its application",
    await until(
      async () =>
        (await page
          .getByRole("menubar")
          .first()
          .getByRole("menuitem", { name: "TextEdit" })
          .count()) > 0,
      10_000,
    ),
  );

  // Trash tile opens the Trash.
  await trashTile.click();
  const win = page.locator(".mac-window.mac-finder").first();
  await win.waitFor({ timeout: 10_000 });
  step(
    "A click on the Trash tile opens the Trash in Finder",
    await until(
      async () => (await win.getByRole("option", { name: BIN, exact: true }).count()) === 1,
    ),
  );
  await shot(page, path.join(out, `desktop-items-trash-${browserName}.png`));

  // From Finder onto the desktop.
  await win.getByRole("treeitem", { name: "Downloads", exact: true }).click();
  const loaded = win.getByRole("option", { name: LOADED, exact: true });
  await loaded.waitFor({ timeout: 8_000 });
  const free = await onPicture(page);
  const from = await centre(loaded);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 12, from.y + 12, { steps: 3 });
  await page.mouse.move(free.x, free.y, { steps: 10 });
  await page.mouse.up();
  step(
    "Dragging from Finder onto the desktop moves it to the Desktop folder, on the server",
    await until(async () => (await named(page, LOADED))?.parent === "desktop"),
  );
  await icon(LOADED).waitFor({ timeout: 8_000 });
  // And back: from the desktop into Finder's window.
  await drag(page, icon(LOADED), win.locator(".mac-finder-view").first());
  step(
    "Dragging from the desktop into Finder moves it to the folder shown, on the server",
    await until(async () => (await named(page, LOADED))?.parent === "downloads"),
  );

  // The Dock's Downloads stack.
  const stack = page
    .getByRole("toolbar", { name: "Dock" })
    .getByRole("button", { name: "Downloads" });
  await stack.click();
  const stackItem = page.getByRole("menuitem", { name: LOADED });
  step(
    "The Downloads stack lists the real folder",
    await stackItem.waitFor({ timeout: 5_000 }).then(
      () => true,
      () => false,
    ),
  );
  await page.waitForTimeout(600);
  await shot(page, path.join(out, `desktop-items-downloads-${browserName}.png`));
  await page.keyboard.press("Escape");
  await stack.click({ button: "right" });
  await page.getByRole("menuitem", { name: "View content as" }).hover();
  await page.getByRole("menuitemradio", { name: "Grid", exact: true }).click();
  await until(async () => (await page.getByRole("menu").count()) === 0, 3_000);
  await stack.click();
  step(
    "View content as Grid shows the stack as a grid",
    await until(
      async () => (await page.locator('.mac-dock-stack-popup[data-view="grid"]').count()) === 1,
    ),
  );
  await page.waitForTimeout(600);
  await shot(page, path.join(out, `desktop-items-downloads-grid-${browserName}.png`));
  await page.keyboard.press("Escape");

  // The Trash's menu. Empty Trash erases everything in the Trash, so this account must hold only
  // what this journey put there.
  const trashed = (await drive(page)).entries.filter((each) => each.trashed_ms !== undefined);
  if (trashed.some((each) => each.id !== binId)) {
    throw new Error("This account's Trash holds items of its own: not emptying it");
  }
  await trashTile.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Empty Trash", exact: true }).click();
  const alert = page.getByRole("alertdialog");
  await alert.waitFor({ timeout: 5_000 });
  await alert.getByRole("button", { name: "Empty Trash", exact: true }).click();
  step(
    "Empty Trash from the tile empties it, on the server",
    await until(async () => (await entry(page, binId)) === undefined),
  );
  step(
    "and the tile shows it empty",
    await until(async () => (await trashTile.getAttribute("data-full")) === null),
  );

  // The desktop's menus.
  await page.keyboard.press("Escape");
  await icon(FOLDER).click({ button: "right", force: true });
  const rows = await page.getByRole("menu").getByRole("menuitem").allInnerTexts();
  step(
    "An icon's menu has Open, Move to Trash, Get Info, Rename, Duplicate and Quick Look",
    ["Open", "Move to Trash", "Get Info", "Rename", "Duplicate", "Quick Look"].every((row) =>
      rows.some((text) => text.startsWith(row)),
    ),
    rows.join(", "),
  );
  await shot(page, path.join(out, `desktop-items-menu-${browserName}.png`));
  await page.getByRole("menuitem", { name: "Get Info", exact: true }).click();
  step(
    "Get Info opens the item's Info window",
    await until(async () => (await page.getByText(`${FOLDER} Info`).count()) > 0),
  );
  await page.keyboard.press("Escape");

  // Use Stacks: from the picture's menu, away from any window.
  const blank = await onPicture(page);
  await page.mouse.click(blank.x, blank.y, { button: "right" });
  await page.getByRole("menuitemcheckbox", { name: "Use Stacks", exact: true }).click();
  step(
    "Use Stacks gathers the files into a stack",
    await until(async () => (await desk.getByText("Documents", { exact: true }).count()) === 1),
  );
  await shot(page, path.join(out, `desktop-items-stacks-${browserName}.png`));
  step("The drive's other item is untouched", Boolean(await entry(page, otherId)));
});

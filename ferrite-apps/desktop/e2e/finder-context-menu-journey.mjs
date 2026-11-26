#!/usr/bin/env node
// Finder's contextual menus, with real secondary clicks, on the signed-in person's drive: an item's
// menu selects it and acts on it, several selected items share one, Move to Trash and Trash items'
// Put Back and Delete Immediately work and ask first, the background makes a folder, a sidebar row
// opens in a new tab, and New Folder with Selection puts the items in a new folder. Drive changes
// are read back from the server.
//
//   node scripts/dev-front-end.mjs --port 3020    # beside the shared desktop on 8787
//   node e2e/finder-context-menu-journey.mjs [--url http://127.0.0.1:3020] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("finder-context-menu");
const tag = Date.now().toString(36);
const A = `Context A ${tag}.txt`;
const B = `Context B ${tag}.txt`;
const C = `Context C ${tag}.txt`;

const drive = async (page) => (await api(page, "GET", "/api/files/")).json;
const entryById = async (page, id) => (await drive(page)).entries.find((e) => e.id === id);
const menuRow = (page, name) => page.getByRole("menu").getByRole("menuitem", { name, exact: true });

async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const ids = {};
  await uploadFile(page, {
    parent: "documents",
    name: `Context D ${tag}.txt`,
    type: "text/plain",
    text: `bytes of Context D ${tag}.txt`,
  });
  for (const name of [A, B, C]) {
    ids[name] = await uploadFile(page, {
      parent: "documents",
      name,
      type: "text/plain",
      text: name,
    });
  }
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const win = page.locator(".mac-window.mac-finder").first();
  await win.waitFor({ timeout: 10_000 });
  const place = (name) => win.getByRole("treeitem", { name, exact: true }).first();
  const item = (name) => win.getByRole("option", { name, exact: true }).first();
  const closed = () => until(async () => (await page.getByRole("menu").count()) === 0, 3_000);
  await place("Documents").click();
  await item(A).waitFor({ timeout: 10_000 });

  // One item: the menu selects it.
  await item(A).click({ button: "right" });
  await menuRow(page, "Get Info").waitFor({ timeout: 4_000 });
  const rows = (await page.getByRole("menu").getByRole("menuitem").allInnerTexts()).map((t) =>
    t.trim(),
  );
  step(
    "an item's menu has its commands",
    ["Open", "Move to Trash", "Get Info", "Rename", "Duplicate"].every((row) => rows.includes(row)),
    rows.join(", "),
  );
  step(
    "a secondary click selects the item",
    (await win
      .getByRole("option", { name: A, exact: true, includeHidden: true })
      .first()
      .getAttribute("aria-selected")) === "true",
  );
  await shot(page, path.join(out, `finder-context-item-${browserName}.png`));
  await menuRow(page, "Duplicate").click();
  await closed();
  step(
    "Duplicate from the menu makes a copy, on the server",
    await until(async () =>
      (await drive(page)).entries.some((e) => e.name.startsWith(`Context A ${tag} copy`)),
    ),
  );

  // Several: a secondary click on one of them keeps them selected.
  await item(B).click();
  await item(C).click({ modifiers: ["Control"] });
  await item(C).click({ button: "right" });
  const together = menuRow(page, "New Folder with Selection (2 Items)");
  await together.waitFor({ timeout: 4_000 });
  step("several selected share one menu", (await together.count()) === 1);
  await shot(page, path.join(out, `finder-context-several-${browserName}.png`));
  await together.click();
  await closed();
  const folder = await until(async () => {
    const entries = (await drive(page)).entries;
    const parent = entries.find((e) => e.id === ids[B])?.parent;
    return parent !== "documents" && parent === entries.find((e) => e.id === ids[C])?.parent
      ? entries.find((e) => e.id === parent)
      : undefined;
  });
  step(
    "New Folder with Selection moves both into a new folder in Documents, on the server",
    folder?.name === "New Folder With Items" && folder?.parent === "documents",
  );

  // Move to Trash, then the Trash's own menu.
  await item(A).click({ button: "right" });
  await menuRow(page, "Move to Trash").click();
  await closed();
  step(
    "Move to Trash from the menu, on the server",
    await until(async () => (await entryById(page, ids[A]))?.trashed_ms !== undefined),
  );
  await page.keyboard.press("Control+Shift+g");
  const go = page.getByRole("dialog").or(page.getByRole("alertdialog")).first();
  await go.getByRole("combobox").or(go.getByRole("textbox")).first().fill("~/.Trash");
  await page.keyboard.press("Enter");
  await item(A).waitFor({ timeout: 8_000 });
  await item(A).click({ button: "right" });
  step("a Trash item's menu has Put Back", await menuRow(page, "Put Back").isVisible());
  await shot(page, path.join(out, `finder-context-trash-${browserName}.png`));
  await menuRow(page, "Delete Immediately…").click();
  const alert = page.getByRole("alertdialog").first();
  await alert.waitFor({ timeout: 4_000 });
  step("Delete Immediately asks first", (await alert.innerText()).includes(A));
  step("nothing is erased before the answer", Boolean(await entryById(page, ids[A])));
  await shot(page, path.join(out, `finder-context-delete-${browserName}.png`));
  await alert.getByRole("button", { name: "Delete", exact: true }).click();
  step(
    "Delete erases it, on the server",
    await until(async () => (await entryById(page, ids[A])) === undefined),
  );

  // The background.
  await place("Downloads").click();
  await until(
    async () => (await win.getByRole("listbox").first().getAttribute("aria-label")) === "Downloads",
  );
  const before = new Set(
    (await drive(page)).entries
      .filter((e) => e.name === "untitled folder" && e.parent === "downloads")
      .map((e) => e.id),
  );
  await win
    .getByRole("listbox")
    .first()
    .click({ button: "right", position: { x: 500, y: 400 } });
  await menuRow(page, "New Folder").click();
  await closed();
  step(
    "the background's New Folder makes a new one here, on the server",
    await until(async () =>
      (await drive(page)).entries.some(
        (e) => e.name === "untitled folder" && e.parent === "downloads" && !before.has(e.id),
      ),
    ),
  );

  // A sidebar row.
  await place("Documents").click({ button: "right" });
  await menuRow(page, "Open in New Tab").click();
  await closed();
  const tabs = win.getByRole("tab");
  step("a sidebar row opens in a new tab", await until(async () => (await tabs.count()) === 2));
  await shot(page, path.join(out, `finder-context-tab-${browserName}.png`));

  // Saved searches: removing the first leaves the others their own.
  const field = win.getByRole("searchbox", { name: "Search" }).or(win.getByLabel("Search")).first();
  const saveSearch = async (words) => {
    await field.fill(words);
    // The suggestions drop down over the scope bar until Escape puts them away.
    await field.press("Escape");
    await win.getByRole("button", { name: "Save", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Save Search" });
    await sheet.getByRole("textbox").fill(`Search for “${words}”`);
    await sheet.getByRole("button", { name: "Save", exact: true }).click();
    await place(`Search for “${words}”`).waitFor({ timeout: 4_000 });
    await field.fill("");
  };
  await saveSearch(`first ${tag}`);
  await saveSearch(`second ${tag}`);
  await place(`Search for “first ${tag}”`).click({ button: "right" });
  await menuRow(page, "Remove from Sidebar").click();
  await closed();
  await saveSearch(`third ${tag}`);
  await place(`Search for “second ${tag}”`).click();
  step(
    "after a removal, a saved search opens its own words",
    await until(async () => (await field.inputValue()) === `second ${tag}`),
  );
  await place(`Search for “third ${tag}”`).click({ button: "right" });
  await menuRow(page, "Remove from Sidebar").click();
  await closed();
  step(
    "removing one saved search keeps the other",
    (await place(`Search for “second ${tag}”`).count()) === 1 &&
      (await win.getByRole("treeitem", { name: `Search for “third ${tag}”` }).count()) === 0,
  );

  // Two files of one name: a press on the second acts on the second, not the first shown by the name.
  const SAME = `Context same ${tag}.txt`;
  const inDocuments = await uploadFile(page, {
    parent: "documents",
    name: SAME,
    type: "text/plain",
    text: "one",
  });
  const inDownloads = await uploadFile(page, {
    parent: "downloads",
    name: SAME,
    type: "text/plain",
    text: "two",
  });
  await page.reload();
  await openDesktop(page, base, step);
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  await win.waitFor({ timeout: 10_000 });
  const searched = win
    .getByRole("searchbox", { name: "Search" })
    .or(win.getByLabel("Search"))
    .first();
  await place("Documents").click();
  await searched.fill(SAME);
  await win.getByText("This Mac", { exact: true }).first().click();
  const twins = win.getByRole("option", { name: SAME, exact: true, includeHidden: true });
  await until(async () => (await twins.count()) === 2);
  step("A search shows both files of one name", (await twins.count()) === 2);
  const pressedTwin = await twins.nth(1).getAttribute("data-item-id");
  const wantedTwin = /\/Downloads\//.test(pressedTwin) ? inDownloads : inDocuments;
  const otherTwin = wantedTwin === inDownloads ? inDocuments : inDownloads;
  await twins.nth(1).click({ button: "right" });
  await menuRow(page, "Get Info").waitFor({ timeout: 4_000 });
  step(
    "A secondary click selects the one it was on",
    (await twins.nth(1).getAttribute("aria-selected")) === "true" &&
      (await twins.nth(0).getAttribute("aria-selected")) === "false",
  );
  await menuRow(page, "Move to Trash").click();
  await closed();
  step(
    "and Move to Trash takes that file and not the other",
    await until(
      async () =>
        (await entryById(page, wantedTwin))?.trashed_ms !== undefined &&
        (await entryById(page, otherTwin))?.trashed_ms === undefined,
    ),
    pressedTwin,
  );
  await searched.fill("");

  // The same in a grouped list, on an item's second row: each file has two tags, so two rows.
  const GROUPED = `Context grouped ${tag}.txt`;
  const twinIds = {};
  for (const parent of ["documents", "downloads"]) {
    twinIds[parent] = await uploadFile(page, {
      parent,
      name: GROUPED,
      type: "text/plain",
      text: parent,
    });
  }
  await api(page, "POST", "/api/files/ops", {
    ops: Object.values(twinIds).map((id) => ({ op: "tag", id, tags: ["Red", "Blue"] })),
  });
  await page.reload();
  await openDesktop(page, base, step);
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  await win.waitFor({ timeout: 10_000 });
  await place("Documents").click();
  await searched.fill(GROUPED);
  await win.getByText("This Mac", { exact: true }).first().click();
  await page.keyboard.press("Control+2");
  await win.getByRole("button", { name: "Group", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Tags", exact: true }).click();
  await closed();
  const secondRows = win.locator('[role="row"][data-item-id^="also:"]');
  await until(async () => (await secondRows.count()) === 2);
  step("A grouped list has a second row for each", (await secondRows.count()) === 2);
  const pressedRow = secondRows.nth(1);
  const pressedPath = await pressedRow.getAttribute("data-item-id");
  const wanted = /\/Downloads\//.test(pressedPath) ? twinIds.downloads : twinIds.documents;
  const other = wanted === twinIds.downloads ? twinIds.documents : twinIds.downloads;
  await pressedRow.click({ button: "right" });
  await menuRow(page, "Move to Trash").click();
  await closed();
  step(
    "Move to Trash on a second row takes that file, not the first of its name",
    await until(
      async () =>
        (await entryById(page, wanted))?.trashed_ms !== undefined &&
        (await entryById(page, other))?.trashed_ms === undefined,
    ),
    pressedPath,
  );
  await win.getByRole("button", { name: "Group", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "None", exact: true }).click();
  await closed();
  await searched.fill("");
  await page.keyboard.press("Control+1");

  // A late answer: what the person did while it was on its way stands.
  const HELD = `Context held ${tag}.txt`;
  await uploadFile(page, { parent: "documents", name: HELD, type: "text/plain", text: "held" });
  await page.reload();
  await openDesktop(page, base, step);
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  await win.waitFor({ timeout: 10_000 });
  await place("Documents").click();
  await item(HELD).waitFor({ timeout: 10_000 });
  await page.keyboard.press("Control+1");
  const newFolderHeld = async (meanwhile) => {
    let release = () => {};
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    let asked = false;
    const hold = async (route) => {
      asked = true;
      await gate;
      await route.continue();
    };
    await page.route("**/api/files/ops*", hold);
    const before = (await drive(page)).entries.length;
    await page
      .getByRole("menubar")
      .first()
      .getByRole("menuitem", { name: "File", exact: true })
      .click();
    await menuRow(page, "New Folder").click();
    step("New Folder asks the server", await until(async () => asked));
    await meanwhile();
    const rows = win.locator('[role="option"]', { hasText: "untitled folder" });
    const shownBefore = await rows.count();
    release();
    await until(async () => (await drive(page)).entries.length > before);
    step(
      "and its folder shows once the answer comes",
      await until(async () => (await rows.count()) > shownBefore),
    );
    await page.unroute("**/api/files/ops*", hold);
  };
  const folderSelected = () =>
    win.locator('[role="option"][aria-selected="true"]', { hasText: "untitled folder" }).count();
  await newFolderHeld(() => item(HELD).click());
  step(
    "A press on another item while New Folder is on its way keeps that item selected",
    (await item(HELD).getAttribute("aria-selected")) === "true" && (await folderSelected()) === 0,
  );
  await page.keyboard.press("Escape");
  await newFolderHeld(async () => {
    await place("Downloads").click();
    await place("Documents").click();
    await item(HELD).waitFor({ timeout: 8_000 });
  });
  step(
    "Going to another folder and back leaves nothing selected by the late answer",
    (await folderSelected()) === 0,
  );

  // A file's item in the path bar opens the file, and offers no tab.
  const D = `Context D ${tag}.txt`;
  await place("Documents").click();
  await item(D).click();
  await win.locator(`[data-finder-path$="/${D}"]`).click({ button: "right" });
  await menuRow(page, "Open").waitFor({ timeout: 4_000 });
  step(
    "a file's path bar item offers no new tab",
    (await menuRow(page, "Open in New Tab").count()) === 0,
  );
  await menuRow(page, "Open").click();
  await closed();
  const editor = page.locator('.mac-managed-window[data-window-id^="textedit"]').first();
  await editor.waitFor({ timeout: 10_000 });
  step(
    "its Open opens the file in TextEdit",
    await until(async () =>
      (
        await editor
          .locator("textarea")
          .first()
          .inputValue()
          .catch(() => "")
      ).includes(`bytes of ${D}`),
    ),
  );
});

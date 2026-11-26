#!/usr/bin/env node
// Finder's menu bar, with its window open, on the signed-in person's drive: File makes a folder and
// opens a file, Open With lists its applications, Edit copies and pastes, View switches views and
// hides the sidebar, Go moves between places and back, Empty Trash asks first, and the keys do the
// same. What changes the drive is read back from the server.
//
//   node scripts/dev-front-end.mjs --port 3020    # beside the shared desktop on 8787
//   node e2e/finder-menus-journey.mjs [--url http://127.0.0.1:3020] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("finder-menus");
const tag = Date.now().toString(36);
const TEXT = `Menu note ${tag}.txt`;

const bar = (page) => page.getByRole("menubar").first();
const row = (page, name) => page.getByRole("menu").getByRole("menuitem", { name, exact: true });
const drive = async (page) => (await api(page, "GET", "/api/files/")).json;
const named = async (page, name) => (await drive(page)).entries.filter((e) => e.name === name);

async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function menusClosed(page) {
  await until(async () => (await page.getByRole("menu").count()) === 0, 3_000);
}

async function choose(page, title, item, role = "menuitem") {
  await bar(page).getByRole("menuitem", { name: title, exact: true }).click();
  await page.getByRole("menu").getByRole(role, { name: item, exact: true }).click();
  await menusClosed(page);
}

await run(async (page) => {
  await openDesktop(page, base, step);
  await uploadFile(page, {
    parent: "documents",
    name: TEXT,
    type: "text/plain",
    text: "menu note",
  });
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const win = page.locator(".mac-window.mac-finder").first();
  await win.waitFor({ timeout: 10_000 });
  const title = async () =>
    (await win.getByRole("listbox").first().getAttribute("aria-label")) ?? "";
  const item = (name) => win.getByRole("option", { name, exact: true }).first();

  await choose(page, "Go", "Documents");
  step("Go > Documents shows the folder", await until(async () => (await title()) === "Documents"));
  const foldersBefore = new Set((await named(page, "untitled folder")).map((e) => e.id));

  await menusClosed(page);
  await bar(page).getByRole("menuitem", { name: "File", exact: true }).click();
  const rows = (await page.getByRole("menu").getByRole("menuitem").allInnerTexts()).map((text) =>
    text.split("\n")[0].trim(),
  );
  step(
    "File starts with New Finder Window, New Folder",
    rows[0] === "New Finder Window" && rows[1] === "New Folder",
    rows.slice(0, 4).join(", "),
  );
  await shot(page, path.join(out, `finder-menu-file-${browserName}.png`));
  await row(page, "New Folder").click();
  step(
    "File > New Folder makes a new one in Documents, on the server",
    await until(async () =>
      (await named(page, "untitled folder")).some(
        (e) => e.kind === "folder" && e.parent === "documents" && !foldersBefore.has(e.id),
      ),
    ),
  );

  await item(TEXT).click();
  await bar(page).getByRole("menuitem", { name: "File", exact: true }).click();
  await row(page, "Open With").hover();
  const textEdit = row(page, "TextEdit (default)");
  step(
    "Open With lists the application that opens the file",
    await textEdit.waitFor({ timeout: 4_000 }).then(
      () => true,
      () => false,
    ),
  );
  await shot(page, path.join(out, `finder-menu-open-with-${browserName}.png`));
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  await menusClosed(page);

  await item(TEXT).click();
  await choose(page, "Edit", `Copy “${TEXT}”`);
  await choose(page, "Go", "Downloads");
  await until(async () => (await title()) === "Downloads");
  await choose(page, "Edit", "Paste Item");
  step(
    "Edit > Copy then Paste Item copies into Downloads, on the server",
    await until(async () => (await named(page, TEXT)).some((e) => e.parent === "downloads")),
  );

  await choose(page, "Go", "Back");
  step("Go > Back returns", await until(async () => (await title()) === "Documents"));

  await item(TEXT).click();
  await choose(page, "Edit", "Select All");
  const selected = await win.getByRole("option", { selected: true }).count();
  const total = await win.getByRole("option").count();
  step(
    "Edit > Select All selects everything",
    total > 1 && selected === total,
    `${selected}/${total}`,
  );
  await choose(page, "Edit", "Deselect All");
  step(
    "Edit > Deselect All selects nothing",
    (await win.getByRole("option", { selected: true }).count()) === 0,
  );

  await choose(page, "View", "as List", "menuitemradio");
  step(
    "View > as List shows the list",
    await until(
      async () => (await win.getByRole("treegrid").or(win.getByRole("grid")).count()) > 0,
    ),
  );
  await choose(page, "View", "as Icons", "menuitemradio");

  const sidebar = win.getByRole("tree", { name: "Sidebar" }).or(win.locator(".mac-finder-sidebar"));
  await choose(page, "View", "Sidebar", "menuitemcheckbox");
  step("View > Sidebar hides the sidebar", await until(async () => (await sidebar.count()) === 0));
  await shot(page, path.join(out, `finder-menu-no-sidebar-${browserName}.png`));
  await win.click({ position: { x: 400, y: 12 } });
  await page.keyboard.press("Control+Alt+s");
  step("Option-Command-S shows it again", await until(async () => (await sidebar.count()) > 0));

  await win.click({ position: { x: 400, y: 12 } });
  await page.keyboard.press("Control+Shift+d");
  step("Shift-Command-D goes to Desktop", await until(async () => (await title()) === "Desktop"));

  await bar(page).getByRole("menuitem", { name: "Go", exact: true }).click();
  const network = row(page, "Network");
  step(
    "Network is dimmed with its reason on the drive",
    (await network.getAttribute("aria-disabled")) === "true" &&
      Boolean(await network.getAttribute("data-reason")),
  );
  await shot(page, path.join(out, `finder-menu-go-${browserName}.png`));
  await page.keyboard.press("Escape");

  await bar(page).getByRole("menuitem", { name: "Finder", exact: true }).click();
  const empty = row(page, "Empty Trash…");
  await empty.waitFor({ timeout: 4_000 });
  step("Finder has one Empty Trash… row", (await empty.count()) === 1);
  await page.keyboard.press("Escape");
});

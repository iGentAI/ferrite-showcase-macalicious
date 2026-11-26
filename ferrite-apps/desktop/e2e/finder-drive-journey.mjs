#!/usr/bin/env node
// Finder's rows that were built and never driven: the toolbar, the views, the selection, the keys, the
// sidebar's places, the path bar, tabs, and the View menu's rows that only Gallery and Icons use. Each row is
// carried out in the window and read back from the window or the server.
//
//   node e2e/finder-drive-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("finder-drive");
const tag = Date.now().toString(36);
const A = `Drive ${tag} a.txt`;
const B = `Drive ${tag} b.txt`;
const C = `Drive ${tag} c.txt`;
const FOLDER = `Drive ${tag} folder`;
const INSIDE = `Drive ${tag} inside.txt`;

const entries = async (page) => (await api(page, "GET", "/api/files/")).json.entries ?? [];

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
  // Each of its own size, for Clean Up By Size.
  const SIZES = new Map([
    [A, 200],
    [B, 9_000],
    [C, 3_000],
  ]);
  for (const [name, size] of SIZES) {
    await uploadFile(page, { parent: "documents", name, type: "text/plain", text: "x", size });
  }
  const folderId = (
    await api(page, "POST", "/api/files/ops", {
      ops: [{ op: "mkdir", parent: "documents", name: FOLDER }],
    })
  ).json.created?.[0];
  await uploadFile(page, { parent: folderId, name: INSIDE, type: "text/plain", text: "inside" });

  const bar = page.getByRole("menubar").first();
  const dock = page.getByRole("toolbar", { name: "Dock" });
  await dock.getByRole("button", { name: "Finder" }).click();
  const win = page.locator(".mac-window.mac-finder").first();
  await win.waitFor({ timeout: 10_000 });
  const menus = page.getByRole("menu");
  const closed = () => until(async () => (await menus.count()) === 0, 3_000);
  const choose = async (title, name, role = "menuitem") => {
    await bar.getByRole("menuitem", { name: title, exact: true }).click();
    await menus.first().getByRole(role, { name, exact: true }).first().click();
    await closed();
  };
  const titleIs = (name) =>
    until(
      async () => (await win.locator(".mac-title-bar-title").first().innerText()).trim() === name,
    );
  const button = (name) => win.getByRole("button", { name, exact: true }).first();
  const option = (name) => win.getByRole("option", { name, exact: true }).first();
  const picture = (name) => shot(page, path.join(out, `finder-drive-${name}-${browserName}.png`));
  const statusLine = () => win.locator(".mac-status-bar").first().innerText();

  await choose("Go", "Documents");
  await option(A).waitFor({ timeout: 10_000 });

  // Finder menu.
  await choose("Finder", "About Finder");
  const about = page
    .getByRole("region", { name: "About Finder" })
    .or(page.getByRole("dialog", { name: /About Finder/ }))
    .first();
  step(
    "About Finder opens its window",
    await about
      .waitFor({ timeout: 5_000 })
      .then(() => true)
      .catch(() => false),
  );
  await picture("about");
  await about
    .getByRole("button", { name: /Close|close/ })
    .first()
    .click()
    .catch(() => page.keyboard.press("Escape"));
  await page.waitForTimeout(300);

  // Toolbar: Back and Forward.
  await win
    .locator(".mac-title-bar")
    .first()
    .click({ position: { x: 300, y: 8 } });
  await choose("Go", "Downloads");
  await titleIs("Downloads");
  await button("Back").click();
  step("Back goes to the folder before", await titleIs("Documents"));
  await button("Forward").click();
  step("Forward comes back", await titleIs("Downloads"));
  await button("Back").click();
  await titleIs("Documents");

  // View switcher, and what each view shows.
  const segment = (name) =>
    win
      .getByRole("radio", { name, exact: true })
      .or(win.getByRole("button", { name, exact: true }))
      .first();
  await segment("List").click();
  step(
    "The switcher shows the list",
    await until(async () => (await win.getByRole("treegrid").count()) === 1),
  );
  await picture("list");

  // List: sort by a heading, expand in place.
  const firstRowName = () => win.getByRole("row").nth(1).innerText();
  const heading = win.getByRole("columnheader", { name: "Name" });
  const before = await firstRowName();
  await heading.click();
  step(
    "A heading sorts the list the other way",
    await until(async () => (await firstRowName()) !== before),
    `${before.slice(0, 30)}`,
  );
  await heading.click();
  const folderRow = win.getByRole("row", { name: new RegExp(FOLDER) }).first();
  await folderRow.click();
  await page.keyboard.press("ArrowRight");
  step(
    "Right Arrow expands a folder in place",
    await until(
      async () => (await win.getByRole("row", { name: new RegExp(INSIDE) }).count()) === 1,
    ),
  );
  await picture("list-expanded");
  await page.keyboard.press("ArrowLeft");
  await until(async () => (await win.getByRole("row", { name: new RegExp(INSIDE) }).count()) === 0);

  // Selection in the list: click, Shift, Command, the background.
  const rowOf = (name) => win.getByRole("row", { name: new RegExp(name) }).first();
  await rowOf(A).click();
  await rowOf(C).click({ modifiers: ["Shift"] });
  const selected = () => win.locator('[role="row"][aria-selected="true"]').count();
  step("Shift-click selects the range", await until(async () => (await selected()) === 3));
  step(
    "and the status bar counts them",
    /^3 of \d+ selected/.test((await statusLine()).trim()),
    await statusLine(),
  );
  await rowOf(B).click({ modifiers: ["Control"] });
  step("Command-click takes one out", await until(async () => (await selected()) === 2));
  await picture("selection");

  // Several at once: tag, duplicate.
  await win.getByRole("button", { name: "Edit Tags" }).click();
  await menus.last().getByRole("menuitemcheckbox", { name: "Green", exact: true }).click();
  await page.keyboard.press("Escape");
  await closed();
  step(
    "A tag goes on every one selected, on the server",
    await until(async () => {
      const all = await entries(page);
      const tagged = (name) => all.find((each) => each.name === name)?.tags?.includes("Green");
      return tagged(A) && tagged(C) && !tagged(B);
    }),
  );
  await page.waitForTimeout(200);
  await choose("File", "Duplicate");
  step(
    "Duplicate copies every one selected",
    await until(async () => {
      const all = await entries(page);
      return (
        all.some((each) => each.name === `Drive ${tag} a copy.txt`) &&
        all.some((each) => each.name === `Drive ${tag} c copy.txt`)
      );
    }),
  );

  // Keys in the list.
  await rowOf(A).click();
  await page.keyboard.press("ArrowDown");
  step(
    "The Down Arrow moves the selection",
    await until(async () => (await rowOf(B).getAttribute("aria-selected")) === "true"),
  );
  await page.keyboard.press("End");
  const last = win.getByRole("row").last();
  step(
    "End goes to the last",
    await until(async () => (await last.getAttribute("aria-selected")) === "true"),
  );
  await page.keyboard.press("Home");
  const firstBody = win.getByRole("row").nth(1);
  step(
    "Home to the first",
    await until(async () => (await firstBody.getAttribute("aria-selected")) === "true"),
  );
  await page.keyboard.type(`Drive ${tag} b`, { delay: 15 });
  step(
    "Typing a name goes to it",
    await until(async () => (await rowOf(B).getAttribute("aria-selected")) === "true"),
  );

  // ⌘I, ⌘O.
  await page.waitForTimeout(1_100);
  await page.keyboard.press("Control+i");
  const info = page
    .getByRole("region", { name: new RegExp(`${B}.*Info|Info.*${B}|^${B}$`) })
    .first();
  const infoShown = await until(
    async () => (await page.locator(".mac-window").filter({ hasText: "General:" }).count()) > 0,
    5_000,
  );
  step("Command-I opens Get Info", infoShown);
  await picture("get-info");
  void info;
  await page
    .locator(".mac-window")
    .filter({ hasText: "General:" })
    .first()
    .getByRole("button", { name: "Close" })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(300);
  await rowOf(B).click();
  await page.keyboard.press("Control+o");
  step(
    "Command-O opens the file in its application",
    await until(async () => (await page.locator('[data-window-id^="textedit"]').count()) > 0),
  );
  await page.waitForTimeout(400);
  await page
    .locator('[data-window-id^="textedit"]')
    .first()
    .getByRole("button", { name: "Close" })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(400);
  const leaving = page.getByRole("alertdialog");
  if ((await leaving.count()) > 0) await leaving.getByRole("button").first().click();

  // Other views.
  await win
    .locator(".mac-title-bar")
    .first()
    .click({ position: { x: 300, y: 8 } });
  await segment("Gallery").click();
  step(
    "The switcher shows the gallery",
    await until(async () => (await win.locator(".mac-gallery-view").count()) === 1),
  );
  await picture("gallery");
  const paneText = win.getByText("Information", { exact: true });
  step("Gallery has its Preview pane", (await paneText.count()) === 1);
  await choose("View", "Preview", "menuitemcheckbox");
  step(
    "View > Preview takes the pane away",
    await until(async () => (await paneText.count()) === 0),
  );
  await choose("View", "Preview", "menuitemcheckbox");
  await until(async () => (await paneText.count()) === 1);
  await segment("Icons").click();
  step("and the icons", await until(async () => (await win.getByRole("listbox").count()) > 0));

  // Icons: the size slider, Clean Up By, the background.
  const icon = option(A).locator(".mac-icon-view-icon").first();
  const sizeThen = (await icon.boundingBox())?.width ?? 0;
  const slider = win.locator(".mac-status-bar").getByRole("slider").first();
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  step(
    "The status bar's slider changes the icons",
    await until(async () => ((await icon.boundingBox())?.width ?? 0) !== sizeThen),
  );
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await bar.getByRole("menuitem", { name: "View", exact: true }).click();
  await menus.first().getByRole("menuitem", { name: "Clean Up By" }).hover();
  await menus.last().getByRole("menuitem", { name: "Size", exact: true }).click();
  await closed();
  step(
    "View > Clean Up By Size puts the icons in order of size, the largest first",
    await until(async () => {
      const order = (await win.getByRole("option").allInnerTexts())
        .map((each) => each.replace(/\s+/g, " ").trim())
        .filter((each) => SIZES.has(each));
      return order.join() === [B, C, A].join();
    }),
    (await win.getByRole("option").allInnerTexts()).join(" | ").replace(/\s+/g, " "),
  );
  await picture("clean-up-by");
  await option(A).click();
  await win
    .locator(".mac-icon-view")
    .first()
    .click({ position: { x: 5, y: 5 } })
    .catch(() => {});
  step(
    "A click on the background deselects",
    await until(async () => /^\d+ items?/.test((await statusLine()).trim())),
    await statusLine(),
  );

  // Sidebar places, and the banner.
  const place = (name) => win.getByRole("treeitem", { name, exact: true });
  for (const [name, shown] of [
    ["Recents", "Recents"],
    ["Applications", "Applications"],
    ["Desktop", "Desktop"],
    ["Downloads", "Downloads"],
  ]) {
    await place(name).click();
    step(`${name} in the sidebar shows it`, await titleIs(shown));
  }
  await place("Green").click();
  step(
    "A tag in the sidebar lists what has it",
    await until(async () => (await option(A).count()) === 1),
  );
  await picture("sidebar-tag");
  await place("All Tags…").click();
  step("and All Tags the tags", await titleIs("All Tags"));

  // Path bar.
  await choose("Go", "Documents");
  await option(FOLDER).dblclick();
  await titleIs(FOLDER);
  const crumb = win.locator('[data-finder-path$="/Documents"]').first();
  await crumb.dblclick();
  step("A double click on the path bar goes there", await titleIs("Documents"));
  await picture("path-bar");

  // Tabs.
  await choose("File", "New Tab");
  await place("Downloads").click();
  await titleIs("Downloads");
  const tabs = win.getByRole("tab");
  await tabs.first().click();
  step("A tab keeps its own folder", await titleIs("Documents"));
  await picture("tabs");
  await tabs.first().click({ button: "right" });
  await menus.last().getByRole("menuitem", { name: "Close Other Tabs" }).click();
  step("Close Other Tabs closes the others", await until(async () => (await tabs.count()) === 0));

  // Title bar and Window menu.
  const shell = page.locator('[data-window-id="finder"]').first();
  const widthThen = (await shell.boundingBox())?.width;
  await win.locator(".mac-title-bar-title").first().dblclick();
  step(
    "A double click on the title bar zooms",
    await until(async () => (await shell.boundingBox())?.width !== widthThen),
  );
  await win.locator(".mac-title-bar-title").first().dblclick();
  await until(async () => (await shell.boundingBox())?.width === widthThen);
  // A second Finder window, with another application's between the two.
  await page.keyboard.press("Control+n");
  const second = page.locator('[data-window-id="finder:2"]');
  await second.waitFor({ timeout: 8_000 });
  await launch(page, "Calculator");
  const calculator = page.locator('[data-window-id="calculator"]');
  await calculator.waitFor({ timeout: 8_000 });
  await page.waitForTimeout(300);
  await second.locator(".mac-title-bar-title").first().click();
  const layer = (window) => window.evaluate((each) => Number(each.style.zIndex));
  step(
    "With another application's window over the first Finder window",
    (await layer(calculator)) > (await layer(shell)),
  );
  await choose("Window", "Bring All to Front");
  step(
    "Bring All to Front puts it over that window",
    await until(async () => (await layer(shell)) > (await layer(calculator))),
  );
  await second.getByRole("button", { name: "Close" }).first().click();
  await second.waitFor({ state: "detached", timeout: 5_000 });
  await win.locator(".mac-title-bar-title").first().click();

  // Trash: banner, Empty Trash alert.
  await option(C).click();
  await page.keyboard.press("Control+Backspace");
  await until(async () => (await entries(page)).some((each) => each.name === C && each.trashed_ms));
  await dock.getByRole("button", { name: "Trash" }).click();
  await page.waitForTimeout(400);
  const empty = win.getByRole("button", { name: "Empty" });
  step("The Trash has its banner", await until(async () => (await empty.count()) === 1));
  await picture("trash");
  await page.keyboard.press("Control+Shift+Backspace");
  const question = page.getByRole("alertdialog");
  step(
    "Shift-Command-Delete asks",
    await question
      .waitFor({ timeout: 4_000 })
      .then(() => true)
      .catch(() => false),
  );
  await picture("empty-trash");
  await question.getByRole("button", { name: "Cancel" }).click();
  await page.waitForTimeout(300);
  step(
    "and Cancel empties nothing",
    (await entries(page)).some((each) => each.name === C),
  );
});

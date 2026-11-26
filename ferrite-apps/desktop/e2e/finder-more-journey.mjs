#!/usr/bin/env node
// Finder's rows a person reaches first that had nothing driving them: the title's path menu and proxy icon,
// the sidebar's Hide and Show, Preferences' Locations and Tags rows, the Action menu's rows, Option's Empty
// Trash, search suggestions, a row dragged out of Favorites, and the Help rows.
//
//   node e2e/finder-more-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("finder-more");
const tag = Date.now().toString(36);
const TEXT = `More ${tag}.txt`;
const PDF = `More ${tag}.pdf`;
const FOLDER = `More ${tag} folder`;
const SETTINGS = "/api/system-preferences/settings";

const entries = async (page) => (await api(page, "GET", "/api/files/")).json.entries ?? [];
const setting = async (page, key) => (await api(page, "GET", SETTINGS)).json.values?.[key];

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
  await uploadFile(page, { parent: "documents", name: TEXT, type: "text/plain", text: "more" });
  await uploadFile(page, {
    parent: "documents",
    name: PDF,
    type: "application/pdf",
    text: "%PDF-1.4\n%%EOF",
  });
  const folderId = (
    await api(page, "POST", "/api/files/ops", {
      ops: [{ op: "mkdir", parent: "documents", name: FOLDER }],
    })
  ).json.created?.[0];
  const bar = page.getByRole("menubar").first();
  const dock = page.getByRole("toolbar", { name: "Dock" });
  await dock.getByRole("button", { name: "Finder" }).click();
  const win = page.locator(".mac-window.mac-finder").first();
  await win.waitFor({ timeout: 10_000 });
  const menus = page.getByRole("menu");
  const closed = () => until(async () => (await menus.count()) === 0, 3_000);
  const choose = async (title, name) => {
    await bar.getByRole("menuitem", { name: title, exact: true }).click();
    await menus.first().getByRole("menuitem", { name, exact: true }).first().click();
    await closed();
  };
  await choose("Go", "Documents");
  const item = (name) => win.getByRole("option", { name, exact: true }).first();
  await item(TEXT).waitFor({ timeout: 10_000 });

  // The title's path menu.
  const titleOf = win.locator(".mac-title-bar-title").first();
  const moved = async () =>
    win.evaluate((each) => each.closest("[data-window-id]")?.style.transform);
  const before = await moved();
  await titleOf.click({ modifiers: ["Control"] });
  const pathRow = (name) => menus.last().getByRole("menuitem", { name, exact: true });
  await pathRow("Users")
    .waitFor({ timeout: 4_000 })
    .catch(() => {});
  step(
    "Command-click on the title lists the folders it is in",
    (await pathRow("Documents").count()) === 1 && (await pathRow("Macintosh SSD").count()) === 1,
  );
  await shot(page, path.join(out, `finder-title-path-${browserName}.png`));
  step("and does not move the window", (await moved()) === before);
  await pathRow("shackett").click();
  step(
    "Choosing one goes there",
    await until(async () => (await titleOf.innerText()).trim() === "shackett"),
  );
  await choose("Go", "Documents");
  await item(TEXT).waitFor({ timeout: 10_000 });

  // The proxy icon: dragged, it is the folder, and the window stays.
  await item(FOLDER).dblclick();
  await until(async () => (await titleOf.innerText()).trim() === FOLDER);
  const proxy = await titleOf.locator(".mac-title-bar-icon").boundingBox();
  await page.mouse.move(proxy.x + 6, proxy.y + 6);
  await page.mouse.down();
  await page.mouse.move(proxy.x + 40, proxy.y + 60, { steps: 4 });
  step(
    "The title's icon drags the folder",
    (await page.locator(".mac-desktop-drag").innerText()).includes(FOLDER),
  );
  await shot(page, path.join(out, `finder-title-proxy-${browserName}.png`));
  step("and not the window", (await moved()) === before);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await choose("Go", "Documents");
  await item(TEXT).waitFor({ timeout: 10_000 });

  // The sidebar's Hide and Show.
  const tagsRow = win.getByRole("treeitem", { name: "Blue", exact: true });
  await win.getByRole("group", { name: "Tags" }).locator(".mac-sidebar-header").hover();
  await shot(page, path.join(out, `finder-section-hide-${browserName}.png`));
  await win.getByRole("button", { name: "Hide Tags" }).click();
  step(
    "Hide on a section's heading hides its rows",
    await until(async () => (await tagsRow.count()) === 0),
  );
  step(
    "and is kept on the server",
    await until(async () => (await setting(page, "finder.hiddenSections"))?.includes("Tags")),
  );
  await reloadDesktop(page);
  await win.waitFor({ timeout: 15_000 });
  await page.waitForTimeout(800);
  step("and across a reload", (await tagsRow.count()) === 0);
  await win.getByRole("group", { name: "Tags" }).locator(".mac-sidebar-header").hover();
  await win.getByRole("button", { name: "Show Tags" }).click();
  step("Show brings them back", await until(async () => (await tagsRow.count()) === 1));

  // Preferences: Locations and Tags.
  await bar.getByRole("menuitem", { name: "Finder", exact: true }).first().click();
  await menus.first().getByRole("menuitem", { name: "Preferences…" }).click();
  const prefsWindow = page.locator('[data-window-id="finder:preferences"]');
  const sidebarPane = () => prefsWindow.getByRole("tab", { name: "Sidebar" }).click();
  // The pane being left is held for a frame by Base UI: it must not show beside the new one.
  await prefsWindow.getByRole("tab", { name: "General" }).click();
  await prefsWindow
    .locator('[role="tab"][aria-selected="true"]', { hasText: "General" })
    .waitFor({ timeout: 5_000 });
  const change = await prefsWindow.evaluate(async (root) => {
    const shown = () =>
      [...root.querySelectorAll('[role="tabpanel"]')].filter(
        (pane) => getComputedStyle(pane).display !== "none",
      ).length;
    const tab = [...root.querySelectorAll('[role="tab"]')].find(
      (each) => each.textContent === "Sidebar",
    );
    tab.click();
    let most = shown();
    for (let frame = 0; frame < 8; frame += 1) {
      await new Promise((next) => requestAnimationFrame(next));
      most = Math.max(most, shown());
    }
    return { most, selected: tab.getAttribute("aria-selected") };
  });
  step(
    "Changing pane shows only one pane in any frame",
    change.selected === "true" && change.most === 1,
    JSON.stringify(change),
  );
  const recent = prefsWindow.getByRole("checkbox", { name: "Recent Tags" });
  await recent.waitFor({ timeout: 5_000 });
  const hardDisks = prefsWindow.getByRole("checkbox", { name: "Hard disks" });
  const diskRow = win.getByRole("treeitem", { name: "Macintosh SSD", exact: true });
  await hardDisks.click();
  step(
    "Preferences' Hard disks lists the startup disk in the sidebar",
    await until(
      async () =>
        (await diskRow.count()) === 1 && (await setting(page, "finder.sidebarDisks")) === true,
    ),
  );
  await page.waitForTimeout(800);
  await page.reload();
  await win.waitFor({ timeout: 20_000 });
  await bar.getByRole("menuitem", { name: "Finder", exact: true }).first().waitFor();
  step("across a reload", await until(async () => (await diskRow.count()) === 1));
  await bar.getByRole("menuitem", { name: "Finder", exact: true }).first().click();
  await menus.first().getByRole("menuitem", { name: "Preferences…" }).click();
  await sidebarPane();
  await hardDisks.click();
  step("and takes it away", await until(async () => (await diskRow.count()) === 0));
  await shot(page, path.join(out, `finder-preferences-sidebar-${browserName}.png`));
  await recent.click();
  step(
    "Preferences' Recent Tags leaves the whole section out",
    await until(async () => (await win.getByRole("group", { name: "Tags" }).count()) === 0),
  );
  await recent.click();
  await until(async () => (await win.getByRole("group", { name: "Tags" }).count()) === 1);
  await page.keyboard.press("Control+w");
  await page.waitForTimeout(400);

  // The Action menu.
  await win
    .locator(".mac-title-bar")
    .first()
    .click({ position: { x: 300, y: 8 } });
  await item(PDF).click();
  const action = win.getByRole("button", { name: "Action" });
  await action.click();
  const actionRow = (name) => menus.last().getByRole("menuitem", { name });
  await actionRow("Make Alias").waitFor({ timeout: 5_000 });
  step(
    "The Action menu has Open With, Compress and Make Alias",
    (await actionRow("Open With").count()) === 1 &&
      (await actionRow(/^Compress/).count()) === 1 &&
      (await actionRow("Make Alias").count()) === 1,
  );
  await shot(page, path.join(out, `finder-action-${browserName}.png`));
  await actionRow("Make Alias").click();
  step(
    "and they work",
    await until(async () =>
      (await entries(page)).some(
        (each) => each.name.startsWith(`More ${tag}`) && /alias/.test(each.name),
      ),
    ),
  );
  await closed();

  // Search suggestions.
  const search = win.getByRole("searchbox", { name: "Search" });
  await search.click();
  await search.fill("pd");
  const list = win.getByRole("listbox", { name: "Search suggestions" });
  await list.waitFor({ timeout: 4_000 });
  step(
    "Words in the search field suggest what they could mean",
    (await list.getByRole("option", { name: "Kinds: PDF" }).count()) === 1 &&
      (await list.getByRole("option", { name: "Name matches: pd" }).count()) === 1,
  );
  await shot(page, path.join(out, `finder-suggestions-${browserName}.png`));
  await page.keyboard.press("ArrowDown");
  const activeRow = await search.getAttribute("aria-activedescendant");
  step(
    "The arrow keys name the row they are on, with the keyboard in the field",
    (await search.evaluate((each) => each === document.activeElement)) &&
      activeRow !== null &&
      (await page.locator(`[id="${activeRow}"]`).getAttribute("aria-selected")) === "true" &&
      (await page.locator(`[id="${activeRow}"]`).innerText()) === "Kinds: PDF",
  );
  await page.keyboard.press("Enter");
  step(
    "Picking one searches by it",
    await until(
      async () =>
        (await item(PDF).count()) === 1 &&
        (await item(TEXT).count()) === 0 &&
        (await search.inputValue()) === "",
    ),
  );
  await win
    .getByRole("button", { name: /Remove|remove/ })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(300);
  await choose("Go", "Documents");

  // A folder of the person's in Favorites comes off by being dragged out.
  await item(FOLDER).waitFor({ timeout: 10_000 });
  await item(FOLDER).click();
  await choose("File", "Add to Sidebar");
  const row = win.getByRole("treeitem", { name: FOLDER, exact: true });
  await row.waitFor({ timeout: 5_000 });
  const place = await row.boundingBox();
  const mainBox = await win.locator(".mac-finder-content").boundingBox();
  await page.mouse.move(place.x + 40, place.y + place.height / 2);
  await page.mouse.down();
  await page.mouse.move(mainBox.x + mainBox.width / 2, mainBox.y + mainBox.height / 2, {
    steps: 5,
  });
  await page.mouse.up();
  step(
    "A row dragged out of the sidebar comes off it",
    await until(async () => (await row.count()) === 0),
  );
  step(
    "and the folder is still on the drive",
    (await entries(page)).some((each) => each.id === folderId),
  );

  // Empty Trash with Option: no question.
  await choose("Go", "Documents");
  await item(TEXT).waitFor({ timeout: 10_000 });
  await item(TEXT).click();
  await choose("File", "Move to Trash");
  await until(async () =>
    (await entries(page)).some((each) => each.name === TEXT && each.trashed_ms),
  );
  await page.keyboard.down("Alt");
  await bar.getByRole("menuitem", { name: "Finder", exact: true }).first().click();
  step(
    "With Option held, the Finder menu's row empties the Trash without asking",
    await until(
      async () =>
        (await menus
          .first()
          .getByRole("menuitem", { name: "Empty Trash", exact: true })
          .count()) === 1,
    ),
  );
  await shot(page, path.join(out, `finder-empty-trash-option-${browserName}.png`));
  // The no-question key cannot be undone, and a journey may run on a person's account: the row is
  // driven here, and the key against a tree of its own in `finder.test.tsx`.
  await page.keyboard.up("Alt");
  await page.keyboard.press("Escape");
  await closed();

  // Recent Folders names a place as its window does.
  await bar.getByRole("menuitem", { name: "Go", exact: true }).click();
  await menus.first().getByRole("menuitem", { name: "Recent Folders" }).hover();
  await until(async () => (await menus.count()) > 1);
  const recentRows = await menus.last().getByRole("menuitem").allInnerTexts();
  step(
    "Recent Folders names its rows, not their addresses",
    recentRows.length > 1 && !recentRows.some((each) => /^[a-z]+:|^\./.test(each.trim())),
    recentRows.join(", "),
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await closed();

  // Help.
  await bar.getByRole("menuitem", { name: "Help", exact: true }).click();
  await shot(page, path.join(out, `finder-help-${browserName}.png`));
  const help = (name) => menus.first().getByRole("menuitem", { name, exact: true });
  step(
    "Help lists macOS Help, What’s New and Tips",
    (await help("macOS Help").count()) === 1 &&
      (await help("See What’s New in macOS").count()) === 1 &&
      (await help("Tips for Your Mac").count()) === 1,
  );
  await help("Tips for Your Mac").click();
  step(
    "each opening Help Viewer",
    await until(async () => (await page.locator('[data-window-id="help-viewer"]').count()) > 0),
  );
});

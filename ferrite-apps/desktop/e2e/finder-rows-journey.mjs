#!/usr/bin/env node
// The rest of Finder's menu rows, each driven and each result looked at or read back from the server: Finder, File, Edit,
// View, Go and Window, the Tags rows of File, and rows dimmed with their reasons.
//
//   node e2e/finder-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("finder-rows");
const tag = Date.now().toString(36);
const TEXT = `Rows ${tag}.txt`;

const bar = (page) => page.getByRole("menubar").first();
const row = (page, name, role = "menuitem") =>
  page.getByRole("menu").getByRole(role, { name, exact: true });
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

const menusClosed = (page) =>
  until(async () => (await page.getByRole("menu").count()) === 0, 3_000);

async function open(page, title) {
  await bar(page).getByRole("menuitem", { name: title, exact: true }).click();
  await page.getByRole("menu").first().waitFor({ timeout: 4_000 });
}

async function choose(page, title, item, role = "menuitem") {
  await open(page, title);
  await row(page, item, role).first().click();
  await menusClosed(page);
}

await run(async (page) => {
  await openDesktop(page, base, step);
  await uploadFile(page, { parent: "documents", name: TEXT, type: "text/plain", text: "rows" });
  await uploadFile(page, {
    parent: "documents",
    name: `Rows ${tag} second.txt`,
    type: "text/plain",
    text: "second",
  });
  const FOLDER = `Rows ${tag} folder`;
  const folderId = (
    await api(page, "POST", "/api/files/ops", {
      ops: [{ op: "mkdir", parent: "documents", name: FOLDER }],
    })
  ).json.created?.[0];
  const dock = page.getByRole("toolbar", { name: "Dock" });
  await dock.getByRole("button", { name: "Finder" }).click();
  const windows = page.locator(".mac-window.mac-finder");
  const win = windows.first();
  await win.waitFor({ timeout: 10_000 });
  const title = async () =>
    (await win
      .getByRole("listbox")
      .first()
      .getAttribute("aria-label")
      .catch(() => "")) ?? "";
  const item = (name) => win.getByRole("option", { name, exact: true }).first();
  const goes = async (rowName, shown) => {
    await choose(page, "Go", rowName);
    step(
      `Go > ${rowName} shows ${shown}`,
      await until(async () => (await title()) === shown),
      await title(),
    );
  };

  await choose(page, "Go", "Documents");
  await until(async () => (await title()) === "Documents");
  await item(TEXT).waitFor({ timeout: 10_000 });

  // A file from the computer let go on a folder goes in that folder, and on the background in the one shown.
  const dropOn = async (target, name) => {
    const files = await page.evaluateHandle((each) => {
      const carried = new DataTransfer();
      carried.items.add(new File(["dropped"], each, { type: "text/plain" }));
      return carried;
    }, name);
    await target.dispatchEvent("drop", { dataTransfer: files });
  };
  const INTO = `Rows ${tag} into.txt`;
  await dropOn(item(FOLDER), INTO);
  step(
    "A file let go on a folder from the computer goes in that folder",
    await until(async () =>
      (await entries(page)).some((each) => each.name === INTO && each.parent === folderId),
    ),
  );
  const BESIDE = `Rows ${tag} beside.txt`;
  await dropOn(item(TEXT), BESIDE);
  step(
    "and on a file, in the folder shown",
    await until(async () =>
      (await entries(page)).some((each) => each.name === BESIDE && each.parent === "documents"),
    ),
  );

  // File: the dimmed rows and their reasons.
  await open(page, "File");
  for (const name of ["Eject", "Burn to Disc…"]) {
    const each = row(page, name);
    step(
      `File > ${name} is dimmed with its reason`,
      (await each.getAttribute("aria-disabled")) === "true" &&
        Boolean(await each.getAttribute("data-reason")),
    );
  }
  await page.keyboard.press("Escape");
  await menusClosed(page);

  await item(TEXT).click();
  await open(page, "Edit");
  const cut = page.getByRole("menu").getByRole("menuitem", { name: /^Cut/ });
  step(
    "Edit > Cut is dimmed with its reason for a file",
    (await cut.getAttribute("aria-disabled")) === "true" &&
      Boolean(await cut.getAttribute("data-reason")),
  );
  await page.keyboard.press("Escape");
  await menusClosed(page);

  // File: Tags.
  await item(TEXT).click();
  await open(page, "File");
  await shot(page, path.join(out, `finder-rows-file-${browserName}.png`));
  await row(page, "Red", "menuitemcheckbox").click();
  await menusClosed(page);
  const tagged = async (name) =>
    (await entries(page)).find((each) => each.name === TEXT)?.tags?.includes(name);
  step("File > a tag's row tags what is selected, on the server", await until(() => tagged("Red")));
  await open(page, "File");
  await row(page, "Red", "menuitemcheckbox").click();
  await menusClosed(page);
  step("and again takes it off", await until(async () => !(await tagged("Red"))));
  await choose(page, "File", "Tags…");
  const info = page.locator(".mac-finder-info").last();
  step(
    "File > Tags… opens Info with its tags field",
    await until(() =>
      info.getByRole("combobox", { name: "Tags" }).or(info.getByLabel("Tags")).first().isVisible(),
    ),
  );
  await info.getByRole("button", { name: "Close" }).first().click();

  // File: Open, Get Info, Duplicate, Trash, Put Back.
  await item(TEXT).click();
  await choose(page, "File", "Duplicate");
  const COPY = `Rows ${tag} copy.txt`;
  step(
    "File > Duplicate makes a copy, on the server",
    await until(async () => (await entries(page)).some((each) => each.name === COPY)),
  );
  await until(async () => (await item(COPY).count()) > 0);
  await page.keyboard.press("Escape");
  await item(COPY).click();
  await choose(page, "File", "Move to Trash");
  const copy = async () => (await entries(page)).find((each) => each.name === COPY);
  step(
    "File > Move to Trash trashes it, on the server",
    await until(
      async () => (await copy())?.parent === "trash" || (await copy())?.trashed_ms !== undefined,
    ),
  );
  await dock.getByRole("button", { name: "Trash" }).click();
  await page.waitForTimeout(400);
  if ((await item(COPY).count()) > 0) {
    await item(COPY).click();
    await choose(page, "File", "Put Back");
    step(
      "File > Put Back returns it, on the server",
      await until(async () => (await copy())?.parent === "documents"),
    );
  } else {
    step("The Trash lists it", false, await title());
  }

  // Edit: Move Item Here.
  await choose(page, "Go", "Documents");
  await until(async () => (await title()) === "Documents");
  await item(COPY).click();
  await page.keyboard.press("Control+KeyC");
  await goes("Downloads", "Downloads");
  await open(page, "Edit");
  await page.keyboard.down("Alt");
  await page.waitForTimeout(150);
  await page
    .getByRole("menu")
    .getByRole("menuitem", { name: /^Move Item/ })
    .first()
    .click();
  await page.keyboard.up("Alt");
  await menusClosed(page);
  step(
    "Edit > Move Item Here moves it, on the server",
    await until(async () => (await copy())?.parent === "downloads"),
  );

  // Go: the rest.
  await choose(page, "Go", "Enclosing Folder");
  await until(async () => (await title()) !== "Downloads");
  const above = await title();
  step("Go > Enclosing Folder goes up a level", above !== "Downloads" && above !== "", above);
  await choose(page, "Go", "Back");
  await until(async () => (await title()) === "Downloads");
  await goes("Forward", above);
  await goes("Recents", "Recents");
  await choose(page, "Go", "AirDrop");
  step(
    "Go > AirDrop shows it",
    await until(() => win.getByRole("treeitem", { name: "AirDrop", selected: true }).isVisible()),
  );
  await choose(page, "Go", "Computer");
  step(
    "Go > Computer shows the disk",
    await until(() => win.getByRole("option", { name: "Macintosh SSD" }).first().isVisible()),
  );
  await goes("Applications", "Applications");
  await goes("Utilities", "Utilities");
  await choose(page, "Go", "Home");
  await until(async () => (await title()) !== "Utilities");
  step("Go > Home goes home", (await title()) !== "Utilities", await title());
  await choose(page, "Go", "Go to Folder…");
  const going = page.getByRole("dialog", { name: /Go to( the)? Folder/ });
  await going.waitFor({ timeout: 4_000 });
  await going.getByRole("combobox").fill("~/Documents");
  await going.getByRole("button", { name: "Go", exact: true }).click();
  step(
    "Go > Go to Folder… goes to a typed path",
    await until(async () => (await title()) === "Documents"),
    await title(),
  );
  await open(page, "Go");
  await row(page, "Recent Folders").hover();
  step(
    "Go > Recent Folders lists where the window has been",
    await until(async () => {
      const menus = page.getByRole("menu");
      return (
        (await menus.count()) === 2 &&
        (await menus.last().getByRole("menuitem", { name: "Downloads", exact: true }).count()) > 0
      );
    }),
  );
  await shot(page, path.join(out, `finder-rows-go-${browserName}.png`));
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await menusClosed(page);

  // View.
  await choose(page, "View", "as Columns", "menuitemradio");
  step(
    "View > as Columns shows the columns",
    await until(async () => (await win.locator(".mac-column-view").count()) > 0),
  );
  const columnRows = win.locator(".mac-column-view-list").first().getByRole("option");
  await page.waitForTimeout(300);
  await columnRows.first().click();
  await choose(page, "Edit", "Select All");
  step(
    "Select All in the columns selects the whole column",
    await until(
      async () =>
        (await columnRows.count()) > 1 &&
        (await win
          .locator(".mac-column-view-list")
          .first()
          .locator('[role="option"][aria-selected="true"]')
          .count()) === (await columnRows.count()),
    ),
  );
  await shot(page, path.join(out, `finder-rows-columns-all-${browserName}.png`));
  await columnRows.first().click();
  step(
    "and a click goes back to the one item",
    await until(
      async () =>
        (await win
          .locator(".mac-column-view-list")
          .first()
          .locator('[role="option"][aria-selected="true"]')
          .count()) === 1,
    ),
  );
  await win.getByRole("option", { name: FOLDER, exact: true }).first().click();
  const nested = win.locator(".mac-column-view-list").nth(1);
  await nested.getByRole("option", { name: INTO, exact: true }).click();
  await choose(page, "Edit", "Deselect All");
  await open(page, "Edit");
  step(
    "Deselect All in a nested column leaves nothing selected",
    (await nested.locator('[role="option"][aria-selected="true"]').count()) === 0 &&
      (await row(page, "Deselect All").getAttribute("aria-disabled")) === "true",
  );
  await page.keyboard.press("Escape");
  await menusClosed(page);
  await choose(page, "Edit", "Select All");
  step(
    "and Select All then selects that column, not the one before it",
    await until(
      async () =>
        (await nested.locator('[role="option"][aria-selected="true"]').count()) === 1 &&
        (await win
          .locator(".mac-column-view-list")
          .first()
          .locator('[role="option"][aria-selected="true"]')
          .count()) === 1,
    ),
  );
  await choose(page, "View", "as Gallery", "menuitemradio");
  step(
    "View > as Gallery shows the gallery",
    await until(async () => (await win.locator(".mac-gallery-view").count()) > 0),
  );
  await choose(page, "View", "as Icons", "menuitemradio");
  const path_ = win.locator(".mac-finder-path, .mac-path-bar, [aria-label='Path']").first();
  const pathShown = await path_.count();
  await choose(page, "View", "Path Bar", "menuitemcheckbox");
  step(
    "View > Path Bar toggles it",
    await until(
      async () =>
        (await win.locator(".mac-finder-path, .mac-path-bar, [aria-label='Path']").count()) > 0 !==
        pathShown > 0,
    ),
  );
  await choose(page, "View", "Path Bar", "menuitemcheckbox");
  const statusShown = await win.locator(".mac-status-bar").count();
  await choose(page, "View", "Status Bar", "menuitemcheckbox");
  step(
    "View > Status Bar toggles it",
    await until(async () => (await win.locator(".mac-status-bar").count()) > 0 !== statusShown > 0),
  );
  await choose(page, "View", "Status Bar", "menuitemcheckbox");

  // File: Find, New Tab, New Finder Window, Close Window, Open.
  await choose(page, "File", "Find");
  step(
    "File > Find puts the keyboard in the search field",
    await until(() => page.evaluate(() => document.activeElement?.tagName === "INPUT")),
  );
  await page.keyboard.press("Escape");
  await choose(page, "File", "New Tab");
  const tabs = win.locator("[data-tab-id]");
  step("File > New Tab shows two tabs", await until(async () => (await tabs.count()) === 2));
  await choose(page, "File", "Close Tab");
  await until(async () => (await tabs.count()) < 2);
  await choose(page, "File", "New Finder Window");
  step(
    "File > New Finder Window opens another",
    await until(async () => (await windows.count()) === 2),
  );
  await choose(page, "File", "Close Window");
  step("File > Close Window closes it", await until(async () => (await windows.count()) === 1));

  // Window.
  const box = await win.boundingBox();
  await choose(page, "Window", "Zoom");
  step(
    "Window > Zoom changes its size",
    await until(async () => (await win.boundingBox())?.width !== box.width),
  );
  await choose(page, "Window", "Zoom");
  await open(page, "Window");
  const listed = await page.getByRole("menu").innerText();
  await shot(page, path.join(out, `finder-rows-window-${browserName}.png`));
  const progress = row(page, "Show Progress Window");
  step(
    "Window > Show Progress Window is dimmed with its reason",
    (await progress.getAttribute("aria-disabled")) === "true" &&
      Boolean(await progress.getAttribute("data-reason")),
  );
  step("Window lists the window", /Documents|Finder/.test(listed), listed.slice(0, 120));
  await row(page, "Bring All to Front").click();
  await menusClosed(page);
  await choose(page, "Window", "Minimize");
  step("Window > Minimize takes it to the Dock", await until(async () => !(await win.isVisible())));
  await dock
    .getByRole("button", { name: /Documents|Finder/ })
    .first()
    .click();
  await until(() => win.isVisible());

  // Finder menu.
  await dock
    .getByRole("button", { name: "Calculator" })
    .click()
    .catch(() => {});
  await page.waitForTimeout(500);
  await dock.getByRole("button", { name: "Finder" }).click();
  await until(
    async () => (await bar(page).getByRole("menuitem").nth(1).innerText()).trim() === "Finder",
  );
  await choose(page, "Finder", "Hide Others");
  const calculator = page.locator('.mac-managed-window[data-window-id="calculator"]');
  const calculatorHidden = async () => (await calculator.getAttribute("data-minimized")) !== null;
  step("Finder > Hide Others hides the other applications", await until(calculatorHidden));
  await choose(page, "Finder", "Show All");
  step("Finder > Show All brings them back", await until(async () => !(await calculatorHidden())));
  await choose(page, "Finder", "Hide Finder");
  step("Finder > Hide Finder hides its windows", await until(async () => !(await win.isVisible())));
  await page
    .getByRole("menubar")
    .first()
    .getByRole("menuitem", { name: "Calculator", exact: true })
    .first()
    .waitFor({ timeout: 5_000 })
    .catch(() => {});
});

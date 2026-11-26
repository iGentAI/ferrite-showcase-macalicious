#!/usr/bin/env node
// Finder's keys one by one, then what the first drive journey left: the search field, the icon size
// slider, a drop on a sidebar place, a drag between two windows, Open in New Tab, the path bar's menu,
// the Upload and Download windows, and a drive that outlives a reload and that another account does
// not see. In a folder of its own, read back from the server where the server keeps it.
//
//   node e2e/finder-rows-keys-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("finder-rows-keys");
const tag = Date.now().toString(36);
const FOLDER = `Keys ${tag}`;
const SUB = `Inner ${tag}`;
const ALPHA = `Alpha ${tag}.txt`;
const BRAVO = `Bravo ${tag}.txt`;
const CHARLIE = `Charlie ${tag}.txt`;

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
  const folderId = (
    await api(page, "POST", "/api/files/ops", {
      ops: [{ op: "mkdir", parent: "documents", name: FOLDER }],
    })
  ).json.created?.[0];
  await api(page, "POST", "/api/files/ops", {
    ops: [{ op: "mkdir", parent: folderId, name: SUB }],
  });
  for (const name of [ALPHA, BRAVO, CHARLIE]) {
    await uploadFile(page, { parent: folderId, name, type: "text/plain", text: name });
  }

  try {
    const bar = page.getByRole("menubar").first();
    const dock = page.getByRole("toolbar", { name: "Dock" });
    await dock.getByRole("button", { name: "Finder" }).click();
    const windows = page.locator(".mac-window.mac-finder");
    const win = windows.first();
    await win.waitFor({ timeout: 10_000 });
    const menus = page.getByRole("menu");
    const closed = () => until(async () => (await menus.count()) === 0, 3_000);
    const picture = (name) =>
      shot(page, path.join(out, `finder-rows-keys-${name}-${browserName}.png`));
    const option = (name, within = win) =>
      within.getByRole("option", { name, exact: true }).first();
    const title = win.locator(".mac-title-bar-title").first();
    const titled = async () => (await title.innerText()).trim();
    const titleIs = (name) => until(async () => (await titled()) === name);
    const place = (name, within = win) =>
      within.getByRole("treeitem", { name, exact: true }).first();
    const named = async (name) => (await entries(page)).find((each) => each.name === name);
    const goHome = async () => {
      await place("Documents").click();
      await option(FOLDER).dblclick();
      await titleIs(FOLDER);
      await option(SUB).waitFor({ timeout: 10_000 });
    };
    const press = async (combo) => {
      await page.keyboard.press(combo);
      await page.waitForTimeout(120);
    };
    const viewChecked = async (name) => {
      await bar.getByRole("menuitem", { name: "View", exact: true }).click();
      const row = menus.first().getByRole("menuitemradio", { name, exact: true }).first();
      const checked = (await row.getAttribute("aria-checked")) === "true";
      await page.keyboard.press("Escape");
      await closed();
      return checked;
    };
    const dragTo = async (from, to) => {
      const a = await from.boundingBox();
      const b = await to.boundingBox();
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 3 });
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
      await page.waitForTimeout(200);
      await page.mouse.up();
    };

    await goHome();

    // The icon size slider.
    const slider = win.getByRole("slider", { name: "Icon size" });
    const sizeBefore = Number(await slider.getAttribute("aria-valuenow"));
    const widthBefore = (await option(ALPHA).boundingBox()).width;
    await slider.focus();
    for (let n = 0; n < 4; n += 1) await page.keyboard.press("ArrowRight");
    const sizeAfter = Number(await slider.getAttribute("aria-valuenow"));
    const widthAfter = (await option(ALPHA).boundingBox()).width;
    step(
      "The size slider makes the icons bigger",
      sizeAfter > sizeBefore && widthAfter > widthBefore,
      `${sizeBefore} to ${sizeAfter}`,
    );
    await picture("icon-size");
    for (let n = 0; n < 4; n += 1) await page.keyboard.press("ArrowLeft");

    // The search field.
    const search = win.getByRole("searchbox", { name: "Search" });
    await search.fill(`Bravo ${tag}`);
    step(
      "The search field finds by name",
      await until(
        async () => (await option(BRAVO).count()) === 1 && (await option(CHARLIE).count()) === 0,
        10_000,
      ),
    );
    await picture("search");
    await search.fill("");
    await titleIs(FOLDER);

    // The views' keys.
    await option(ALPHA).click();
    for (const [key, name, role] of [
      ["Digit2", "as List", "treegrid"],
      ["Digit3", "as Columns", "tree"],
      ["Digit4", "as Gallery", "toolbar"],
      ["Digit1", "as Icons", "listbox"],
    ]) {
      await press(`Control+${key}`);
      const shown = await viewChecked(name);
      step(`⌘${key.at(-1)} shows ${name}`, shown, role);
      await picture(`view-${key}`);
    }

    // Going about.
    await place("Downloads").click();
    await titleIs("Downloads");
    await press("Control+BracketLeft");
    step("⌘[ goes back", await titleIs(FOLDER));
    await press("Control+BracketRight");
    step("⌘] goes forward", await titleIs("Downloads"));
    await titleIs("Downloads");
    await goHome();
    await press("Control+ArrowUp");
    step("⌘↑ goes to the enclosing folder", await titleIs("Documents"));
    await goHome();
    await option(SUB).click();
    await press("Control+ArrowDown");
    step("⌘↓ opens the folder selected", await titleIs(SUB));
    await press("Control+ArrowUp");
    await titleIs(FOLDER);
    for (const [key, name] of [
      ["Control+Shift+KeyD", "Desktop"],
      ["Control+Shift+KeyO", "Documents"],
      ["Control+Alt+KeyL", "Downloads"],
      ["Control+Shift+KeyA", "Applications"],
      ["Control+Shift+KeyH", "shackett"],
    ]) {
      await press(key);
      step(`Go's key goes to ${name}`, await titleIs(name));
    }
    await press("Control+KeyK");
    const connect = page.getByRole("dialog", { name: "Connect to Server" });
    step("⌘K asks where to connect", await until(() => connect.isVisible()));
    await page.keyboard.press("Escape");
    await press("Control+Shift+KeyG");
    const go = page.getByRole("dialog", { name: "Go to Folder" });
    step("⇧⌘G asks for a folder", await until(() => go.isVisible()));
    await page.keyboard.press("Escape");
    await goHome();

    // What is selected.
    await press("Control+KeyF");
    step(
      "⌘F puts the keyboard in the search field",
      await until(() => search.evaluate((field) => field === document.activeElement)),
    );
    await option(ALPHA).click();
    await press("Control+KeyD");
    const copied = ALPHA.replace(".txt", " copy.txt");
    step(
      "⌘D duplicates, on the server",
      await until(async () => (await named(copied))?.parent === folderId),
    );
    await option(copied).click();
    await press("Control+Backspace");
    step(
      "⌘⌫ moves it to the Trash, on the server",
      await until(async () => (await named(copied))?.trashed_ms !== undefined),
    );
    await option(BRAVO).click();
    await press("Control+KeyC");
    await option(SUB).dblclick();
    await titleIs(SUB);
    await page.waitForTimeout(200);
    await press("Control+KeyV");
    const inSub = (name) => entries(page).then((all) => all.filter((each) => each.name === name));
    step(
      "⌘C and ⌘V copy into the folder shown, on the server",
      await until(async () => (await inSub(BRAVO)).length === 2),
    );
    await press("Control+ArrowUp");
    await titleIs(FOLDER);
    await option(CHARLIE).click();
    await press("Control+KeyC");
    await option(SUB).dblclick();
    await titleIs(SUB);
    await page.waitForTimeout(200);
    await press("Control+Alt+KeyV");
    const subEntry = await named(SUB);
    step(
      "⌥⌘V moves it here, on the server",
      await until(async () => (await named(CHARLIE))?.parent === subEntry.id),
    );
    await press("Control+ArrowUp");
    await titleIs(FOLDER);

    // The panes and the bars.
    await press("Control+Shift+KeyN");
    step(
      "⇧⌘N makes a folder, on the server",
      await until(async () =>
        (await entries(page)).some(
          (each) => each.name === "untitled folder" && each.parent === folderId,
        ),
      ),
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    const pathBar = win
      .getByRole("navigation", { name: "Path" })
      .or(win.getByLabel("Path"))
      .first();
    const sidebarShown = () => place("Documents").isVisible();
    await press("Control+Alt+KeyP");
    step("⌥⌘P hides the path bar", await until(async () => !(await pathBar.isVisible())));
    await press("Control+Alt+KeyP");
    await pathBar.waitFor({ timeout: 3_000 });
    await press("Control+Alt+KeyS");
    step("⌥⌘S hides the sidebar", await until(async () => !(await sidebarShown())));
    await press("Control+Alt+KeyS");
    await place("Documents").waitFor({ timeout: 3_000 });
    const statusBar = win.getByText(/of \d+ selected|\d+ items?,/).first();
    await press("Control+Slash");
    step("⌘/ hides the status bar", await until(async () => !(await statusBar.isVisible())));
    await press("Control+Slash");
    await press("Control+KeyJ");
    const options_ = page
      .locator('[data-window-id^="finder:view-options"]')
      .or(page.getByRole("dialog", { name: /View Options|Options/ }));
    step("⌘J opens View Options", await until(() => options_.first().isVisible()));
    await picture("view-options");
    await options_.first().getByRole("checkbox").first().focus();
    await press("Control+KeyJ");
    step(
      "⌘J from inside the panel closes it",
      await until(async () => (await options_.count()) === 0),
    );
    step(
      "and the keyboard goes back to the window",
      await until(() =>
        page.evaluate(() => document.activeElement?.closest(".mac-window.mac-finder") !== null),
      ),
    );

    // A drop on a sidebar place.
    await option(ALPHA).click();
    await dragTo(option(ALPHA), place("Downloads"));
    step(
      "Dropped on a sidebar place, it moves there",
      await until(async () => (await named(ALPHA))?.parent === "downloads"),
    );

    // Open in New Tab, and the path bar's menu.
    await option(SUB).click({ button: "right" });
    await menus.first().getByRole("menuitem", { name: "Open in New Tab" }).click();
    await closed();
    step(
      "A folder's Open in New Tab opens a tab on it",
      await until(async () => (await win.getByRole("tab").count()) === 2),
    );
    await picture("new-tab");
    await press("Control+KeyW");
    await until(async () => (await win.getByRole("tab").count()) === 0);
    const pathItem = pathBar.getByText("Documents", { exact: true });
    await pathItem.click({ button: "right" });
    const pathMenu = menus.first();
    step(
      "The path bar's item has Open and Get Info",
      (await pathMenu.getByRole("menuitem", { name: "Open", exact: true }).isVisible()) &&
        (await pathMenu.getByRole("menuitem", { name: "Get Info", exact: true }).isVisible()),
    );
    await picture("path-menu");
    await pathMenu.getByRole("menuitem", { name: "Open", exact: true }).click();
    step("and Open goes there", await titleIs("Documents"));
    await goHome();

    // Between two windows, the key right after the path bar's menu closed: the new window stays in front.
    await press("Control+KeyN");
    step("⌘N opens a second window", await until(async () => (await windows.count()) === 2));
    const second = page.locator('[data-window-id="finder:2"] .mac-window.mac-finder').first();
    const first = page.locator('[data-window-id="finder"] .mac-window.mac-finder').first();
    await second.locator(".mac-title-bar").first().waitFor();
    await page.waitForTimeout(600);
    const barBox = await second.locator(".mac-title-bar").first().boundingBox();
    await page.mouse.move(barBox.x + 300, barBox.y + 10);
    await page.mouse.down();
    await page.mouse.move(barBox.x + 860, barBox.y + 40, { steps: 10 });
    await page.mouse.up();
    await place("Desktop", second).click();
    await page.waitForTimeout(300);
    const landing = second.getByRole("listbox").first();
    const near = await landing.boundingBox();
    const a = await option(SUB, first).boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 3 });
    await page.mouse.move(Math.min(near.x + near.width - 40, 1400), near.y + near.height - 40, {
      steps: 14,
    });
    await page.waitForTimeout(200);
    await page.mouse.up();
    step(
      "Dragged between windows, it moves to the other's folder",
      await until(async () => (await named(SUB))?.parent === "desktop"),
    );
    await picture("two-windows");
    await api(page, "POST", "/api/files/ops", {
      ops: [{ op: "move", id: subEntry.id, parent: folderId }],
    });

    // It outlives a reload, and another account does not see it.
    await page.reload();
    await openDesktop(page, base, step);
    step("A reload keeps the folder", (await named(FOLDER))?.parent === "documents");
    const stranger = await page.context().browser().newContext();
    const other = await stranger.newPage();
    await openDesktop(other, base, step);
    const theirs = await entries(other);
    step(
      "Another account sees none of it",
      theirs.length > 0 && !theirs.some((each) => each.name.includes(tag)),
      `${theirs.length} entries`,
    );
    await stranger.close();
  } finally {
    const all = await entries(page);
    const ops = all
      .filter((each) => each.name === FOLDER || each.name === ALPHA)
      .map((each) => ({ op: "trash", id: each.id }));
    if (ops.length > 0) await api(page, "POST", "/api/files/ops", { ops });
  }
});

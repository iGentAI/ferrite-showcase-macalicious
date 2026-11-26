#!/usr/bin/env node
// Finder's rows that showed but had not been carried out: Open With and its Always, the contextual menus,
// Move Tab to New Window, the View Options of each view, the sidebar's divider, Get Info's Change All and
// the Inspector. It works in a folder of its own, whose settings start empty, reads each setting back by its
// own key, and puts back the two settings that are not the folder's.
//
//   node e2e/finder-rows-more-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("finder-rows-more");
const tag = Date.now().toString(36);
const FOLDER = `Rows2 ${tag}`;
const LOG = `Rows2 ${tag}.log`;
const TEXT = `Rows2 ${tag}.txt`;
const OTHER = `Rows2 ${tag} other.txt`;
const SETTINGS = "/api/system-preferences/settings";
const OPEN_WITH = "finder.openWith";
const SIDEBAR_WIDTH = "finder.sidebarWidth";

const entries = async (page) => (await api(page, "GET", "/api/files/")).json.entries ?? [];
const settings = async (page) => (await api(page, "GET", SETTINGS)).json.values ?? {};

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
  for (const [name, text] of [
    [LOG, "a log"],
    [TEXT, "rows"],
    [OTHER, "other"],
  ]) {
    await uploadFile(page, { parent: folderId, name, type: "text/plain", text });
  }
  const then = await settings(page);
  try {
    // Whatever this account has chosen for the extension, the journey starts from no choice.
    const start = await api(page, "GET", SETTINGS);
    await api(page, "PUT", SETTINGS, {
      values: {
        ...start.json.values,
        [OPEN_WITH]: Object.fromEntries(
          Object.entries(start.json.values?.[OPEN_WITH] ?? {}).filter(
            ([extension]) => extension !== "log",
          ),
        ),
      },
      rev: start.json.rev,
    });
    await page.reload();
    await openDesktop(page, base, step);
    const folderSetting = async (key) =>
      (await settings(page))["finder.folders"]?.[folderId]?.[key];
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
    const picture = (name) => shot(page, path.join(out, `finder-rows2-${name}-${browserName}.png`));
    const option = (name) => win.getByRole("option", { name, exact: true }).first();
    const title = win.locator(".mac-title-bar-title").first();
    const closeWindow = async (window) => {
      await window.getByRole("button", { name: "Close" }).first().click();
      await page.waitForTimeout(300);
    };
    const goHome = async () => {
      await choose("Go", "Documents");
      await option(FOLDER).dblclick();
      await until(async () => (await title.innerText()).trim() === FOLDER);
      await option(TEXT).waitFor({ timeout: 10_000 });
    };
    await goHome();

    await win.getByRole("treeitem", { name: "AirDrop", exact: true }).click();
    await win.getByText("No People Found").waitFor({ timeout: 4_000 });
    step(
      "AirDrop says why it finds nobody",
      (await win.locator(".mac-empty-state").innerText()).split("\n").length > 1,
    );
    await picture("airdrop");
    await goHome();

    await option(LOG).click();
    await bar.getByRole("menuitem", { name: "File", exact: true }).click();
    await menus.first().getByRole("menuitem", { name: "Open With" }).hover();
    await until(async () => (await menus.count()) > 1);
    const openers = (await menus.last().getByRole("menuitem").allInnerTexts()).map((each) =>
      each.trim(),
    );
    await picture("open-with");
    step("Open With lists Console and TextEdit", openers.includes("TextEdit"), openers.join(", "));
    await menus.last().getByRole("menuitem", { name: "Always Open With" }).hover();
    await until(async () => (await menus.count()) > 2);
    await menus.last().getByRole("menuitem", { name: "TextEdit", exact: true }).click();
    await closed();
    step(
      "Always Open With keeps TextEdit for the extension, on the server",
      await until(async () => (await settings(page))[OPEN_WITH]?.log === "textedit"),
    );
    const textEdit = page.locator('[data-window-id^="textedit"]').filter({ hasText: LOG });
    step(
      "and opens the file there",
      await textEdit
        .first()
        .waitFor({ timeout: 8_000 })
        .then(() => true)
        .catch(() => false),
    );
    await closeWindow(textEdit.first());
    await title.click();
    await option(LOG).dblclick();
    step(
      "and a double click then opens it there too",
      await textEdit
        .first()
        .waitFor({ timeout: 8_000 })
        .then(() => true)
        .catch(() => false),
    );
    await closeWindow(textEdit.first());

    await title.click();
    await option(LOG).click();
    await page.keyboard.press("Control+i");
    const info = page.locator(".mac-window").filter({ hasText: "Open with:" }).first();
    await info.waitFor({ timeout: 5_000 });
    await info.getByRole("combobox", { name: "Open with" }).click();
    await page
      .locator("[data-base-ui-portal]")
      .last()
      .getByRole("option", { name: "Console" })
      .click();
    await info.getByRole("button", { name: /Change All/ }).click();
    await picture("change-all");
    step(
      "Get Info's Change All keeps Console for the extension, on the server",
      await until(async () => (await settings(page))[OPEN_WITH]?.log === "console"),
    );
    await closeWindow(info);

    await option(TEXT).click({ button: "right" });
    await menus
      .last()
      .getByRole("menuitem", { name: /^Compress/ })
      .click();
    step(
      "Compress in an item's menu makes its archive",
      await until(
        async () =>
          (await entries(page)).some(
            (each) => each.name === `${TEXT}.zip` && each.parent === folderId,
          ),
        15_000,
      ),
    );
    await closed();
    await option(TEXT).click({ button: "right" });
    await picture("item-menu");
    await menus.last().getByRole("menuitem", { name: "Get Info" }).click();
    const itemInfo = page.locator(".mac-window").filter({ hasText: "Open with:" }).first();
    await itemInfo.waitFor({ timeout: 5_000 });
    step("Get Info in an item's menu opens it", (await itemInfo.innerText()).includes(TEXT));
    await closeWindow(itemInfo);

    const view = win.getByRole("listbox").first();
    const backgroundMenu = async () => {
      const box = await view.boundingBox();
      await page.mouse.click(box.x + box.width - 30, box.y + box.height - 30, { button: "right" });
      await menus.last().waitFor({ timeout: 3_000 });
    };
    await backgroundMenu();
    await picture("background-menu");
    await menus.last().getByRole("menuitem", { name: "Sort By" }).hover();
    await until(async () => (await menus.count()) > 1);
    await menus.last().getByRole("menuitemradio", { name: "Size" }).click();
    await closed();
    step(
      "Sort By in the background's menu is kept for this folder",
      await until(async () => (await folderSetting("sort"))?.column === "size"),
    );
    await backgroundMenu();
    await menus.last().getByRole("menuitem", { name: "View", exact: true }).hover();
    await until(async () => (await menus.count()) > 1);
    await menus.last().getByRole("menuitemradio", { name: "as List" }).click();
    step(
      "View in the background's menu changes the view",
      await until(async () => (await win.getByRole("treegrid").count()) === 1),
    );
    await closed();

    await page.keyboard.press("Control+j");
    const optionsWindow = page.locator(".mac-finder-options").first();
    await optionsWindow.waitFor({ timeout: 5_000 });
    const rowHeight = () =>
      win
        .getByRole("row", { name: new RegExp(TEXT.replace(/[.]/g, "\\.")) })
        .first()
        .evaluate((each) => each.getBoundingClientRect().height);
    await optionsWindow.getByRole("radio", { name: "Small" }).click();
    await until(async () => (await folderSetting("listIcon")) === 16);
    const smallRow = await rowHeight();
    await optionsWindow.getByRole("radio", { name: "Large" }).click();
    step(
      "List's Large icons make its rows taller",
      await until(async () => (await rowHeight()) > smallRow),
      String(smallRow),
    );
    const allSizes = optionsWindow.getByRole("checkbox", { name: "Calculate all sizes" });
    const wasAll = await allSizes.isChecked();
    await allSizes.click();
    await picture("options-list");
    step(
      "and Calculate all sizes is kept for this folder",
      await until(async () => (await folderSetting("allSizes")) === !wasAll),
    );
    await optionsWindow.getByRole("radio", { name: "Small" }).click();

    await title.click();
    await choose("View", "as Columns", "menuitemradio");
    await option(TEXT).click();
    const previewFile = win.locator(".mac-finder-file");
    const columnIcons = win.locator(".mac-column-view-icon");
    // "Use as Defaults" may have turned these off for every new folder.
    const turnedOn = async (box) => {
      if (!(await box.isChecked())) await box.click();
    };
    await turnedOn(optionsWindow.getByRole("checkbox", { name: "Show preview column" }));
    await turnedOn(optionsWindow.getByRole("checkbox", { name: "Show icons" }));
    step(
      "The columns show their preview and icons",
      await until(async () => (await previewFile.count()) === 1 && (await columnIcons.count()) > 0),
    );
    const previewBox = optionsWindow.getByRole("checkbox", { name: "Show preview column" });
    await previewBox.click();
    await picture("options-columns");
    step(
      "Show preview column takes it away",
      await until(async () => (await previewFile.count()) === 0),
    );
    await previewBox.click();
    step("and brings it back", await until(async () => (await previewFile.count()) === 1));
    const iconsBox = optionsWindow.getByRole("checkbox", { name: "Show icons" });
    await iconsBox.click();
    step(
      "Show icons takes the icons away",
      await until(async () => (await columnIcons.count()) === 0),
    );
    await iconsBox.click();
    step("and brings them back", await until(async () => (await columnIcons.count()) > 0));

    await title.click();
    await choose("View", "as Gallery", "menuitemradio");
    const galleryPane = win.getByText("Information", { exact: true });
    const showPreview = optionsWindow.getByRole("checkbox", { name: "Show preview" });
    await turnedOn(showPreview);
    step("Gallery shows its pane", await until(async () => (await galleryPane.count()) === 1));
    await showPreview.click();
    step("Show preview takes it away", await until(async () => (await galleryPane.count()) === 0));
    await picture("options-gallery");
    await showPreview.click();
    step("and brings it back", await until(async () => (await galleryPane.count()) === 1));
    const thumbnail = win.locator(".mac-gallery-view-item").first();
    const thumbnailThen = (await thumbnail.boundingBox())?.width ?? 0;
    const thumbnailSlider = optionsWindow.getByRole("slider", { name: "Thumbnail size" });
    await thumbnailSlider.focus();
    const atMostThumb = Number(await thumbnailSlider.getAttribute("aria-valuenow")) >= 102;
    await page.keyboard.press(atMostThumb ? "ArrowLeft" : "ArrowRight");
    step(
      "Thumbnail size changes the strip, kept for this folder",
      (await until(async () => ((await thumbnail.boundingBox())?.width ?? 0) !== thumbnailThen)) &&
        (await until(async () => typeof (await folderSetting("thumbnail")) === "number")),
      String(thumbnailThen),
    );
    await picture("options-thumbnail");

    await title.click();
    await choose("View", "as Icons", "menuitemradio");
    const icon = option(TEXT).locator(".mac-icon-view-icon").first();
    const sizeThen = (await icon.boundingBox())?.width ?? 0;
    const sizeSlider = optionsWindow.getByRole("slider", { name: "Icon size" });
    await sizeSlider.focus();
    const atMost = Number(await sizeSlider.getAttribute("aria-valuenow")) >= 160;
    await page.keyboard.press(atMost ? "ArrowLeft" : "ArrowRight");
    step(
      "Icons' size slider changes them",
      await until(async () => ((await icon.boundingBox())?.width ?? 0) !== sizeThen),
    );
    const gridSlider = optionsWindow.getByRole("slider", { name: "Grid spacing" });
    const gridThen = Number(await gridSlider.getAttribute("aria-valuenow"));
    await gridSlider.focus();
    await page.keyboard.press(gridThen >= 64 ? "ArrowLeft" : "ArrowRight");
    await picture("options-icons");
    step(
      "Grid spacing is kept for this folder",
      await until(async () => {
        const grid = await folderSetting("grid");
        return typeof grid === "number" && grid !== gridThen;
      }),
    );
    const itemInfoBox = optionsWindow.getByRole("checkbox", { name: "Show item info" });
    const infoLine = win.locator(".mac-icon-view-detail");
    if (await itemInfoBox.isChecked()) await itemInfoBox.click();
    await until(async () => (await infoLine.count()) === 0);
    await itemInfoBox.click();
    step(
      "Show item info puts a line under the names, kept for this folder",
      (await until(async () => (await infoLine.count()) > 0)) &&
        (await until(async () => (await folderSetting("itemInfo")) === true)),
      (await infoLine.allInnerTexts()).slice(0, 3).join(", "),
    );
    await picture("options-item-info");
    await itemInfoBox.click();
    step("and takes it away again", await until(async () => (await infoLine.count()) === 0));
    const previewIconBox = optionsWindow.getByRole("checkbox", { name: "Show icon preview" });
    if (!(await previewIconBox.isChecked())) await previewIconBox.click();
    await previewIconBox.click();
    step(
      "Show icon preview is kept for this folder",
      await until(async () => (await folderSetting("iconPreview")) === false),
    );
    await previewIconBox.click();
    await page.keyboard.press("Control+j");
    await optionsWindow.waitFor({ state: "detached", timeout: 4_000 }).catch(() => {});

    const sidebarWidth = () =>
      win.locator(".mac-finder-sidebar").evaluate((each) => each.getBoundingClientRect().width);
    const widthThen = await sidebarWidth();
    const divider = win.getByRole("separator", { name: "Resize sidebar" });
    const at = await divider.boundingBox();
    const by = widthThen > 260 ? -40 : 40;
    await page.mouse.move(at.x + at.width / 2, at.y + 100);
    await page.mouse.down();
    await page.mouse.move(at.x + at.width / 2 + by, at.y + 100, { steps: 4 });
    await page.mouse.up();
    const widthNow = await sidebarWidth();
    step(
      "Dragging the sidebar's divider moves its edge by as much",
      Math.abs(widthNow - widthThen - by) < 3,
      `${widthThen} to ${widthNow}`,
    );
    await picture("divider");
    step(
      "and the width is kept for the account",
      await until(
        async () => Math.abs(((await settings(page))[SIDEBAR_WIDTH] ?? 0) - widthNow) < 2,
      ),
    );

    const windowIds = () =>
      page
        .locator("[data-window-id]")
        .evaluateAll((all) => all.map((each) => each.getAttribute("data-window-id")));
    const windowsThen = await windowIds();
    await choose("File", "New Tab");
    await win.getByRole("tab").first().waitFor({ timeout: 4_000 });
    await choose("Go", "Downloads");
    await until(async () => (await title.innerText()).trim() === "Downloads");
    await win.getByRole("tab", { name: "Downloads" }).click({ button: "right" });
    await menus.last().getByRole("menuitem", { name: "Move Tab to New Window" }).click();
    const found = await until(async () => {
      const fresh = (await windowIds()).find((id) => !windowsThen.includes(id));
      return fresh ?? false;
    });
    const moved = page.locator(`[data-window-id="${found}"]`);
    step(
      "Move Tab to New Window makes a new window showing that tab's folder",
      Boolean(found) &&
        (await until(
          async () =>
            (await moved.locator(".mac-title-bar-title").first().innerText()).trim() ===
            "Downloads",
        )),
      String(found),
    );
    step(
      "and the first window has lost it",
      await until(
        async () =>
          (await win.getByRole("tab", { name: "Downloads" }).count()) === 0 &&
          (await title.innerText()).trim() === FOLDER,
      ),
    );
    await picture("tab-window");
    await moved.getByRole("button", { name: "Close" }).first().click();

    await page.waitForTimeout(300);
    await title.click();
    await option(TEXT).click();
    await option(OTHER).click({ modifiers: ["Control"] });
    await page.keyboard.press("Control+Alt+i");
    const inspector = page
      .locator(".mac-window")
      .filter({ hasText: /2 items/ })
      .last();
    step(
      "Option-Command-I opens one window for all of them",
      await inspector
        .waitFor({ timeout: 5_000 })
        .then(() => true)
        .catch(() => false),
    );
    await picture("inspector");
  } finally {
    // What is not this folder's goes back as it was, whatever happened above.
    await page.waitForTimeout(1_000);
    const { json } = await api(page, "GET", SETTINGS);
    const values = { ...(json.values ?? {}) };
    for (const key of [OPEN_WITH, SIDEBAR_WIDTH]) {
      if (key in then) values[key] = then[key];
      else delete values[key];
    }
    await api(page, "PUT", SETTINGS, { values, rev: json.rev });
    const back = await settings(page);
    step(
      "The account's own choices are back",
      [OPEN_WITH, SIDEBAR_WIDTH].every(
        (key) => JSON.stringify(back[key]) === JSON.stringify(then[key]),
      ),
    );
  }
});

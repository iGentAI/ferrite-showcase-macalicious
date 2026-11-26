#!/usr/bin/env node
// The rows of the Desktop and Dock inventory that nothing drove: the disk icons, the Clock and Bluetooth extras,
// Command-drag along the menu bar, the Dock's divider and its menu, the Finder tile's rows, the Dock from the
// keyboard, a stack's view and sort, hiding the menu bar, and the desktop's own menu and keys. Settings are read
// back from the server, and what the journey changes is put back at the end.
//
//   node e2e/desktop-more-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("desktop-more");
const tag = Date.now().toString(36);
const NOTE = `More desk ${tag}.txt`;
const DOWN = `More down ${tag}.txt`;
const SETTINGS = "/api/system-preferences/settings";
const TOUCHED = [
  "dock.size",
  "dock.magnification",
  "dock.minimizeEffect",
  "dock.downloadsView",
  "dock.downloadsSort",
  "menuBar.extrasOrder",
  "date-and-time.clockAnalog",
  "bluetooth.showInMenuBar",
  "general.hideMenuBar",
];

async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

const settings = async (page) => (await api(page, "GET", SETTINGS)).json.values ?? {};

async function write(page, change) {
  // The page saves what just changed after a moment: this comes after that, not between its read and write.
  await page.waitForTimeout(2_500);
  const { json } = await api(page, "GET", SETTINGS);
  await api(page, "PUT", SETTINGS, { values: change(json.values ?? {}), rev: json.rev });
}

const centre = async (locator) => {
  const box = await locator.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

await run(async (page) => {
  await openDesktop(page, base, step);
  const then = await settings(page);
  let made = [];
  const row = (name) => page.getByRole("menuitem", { name, exact: true });
  const noMenu = () => until(async () => (await page.getByRole("menu").count()) === 0, 3_000);
  const closeMenus = async () => {
    for (let n = 0; n < 3 && (await page.getByRole("menu").count()) > 0; n += 1) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(150);
    }
    await noMenu();
  };
  const dock = page.getByRole("toolbar", { name: "Dock" });
  const tile = (name) => dock.getByRole("button", { name, exact: true });
  const desk = page.getByRole("group", { name: "Desktop", exact: true });
  const icon = (name) => desk.locator(".mac-desktop-icon", { hasText: name }).first();
  const extra = (name) =>
    page
      .locator(".mac-menu-bar-extra")
      .and(page.locator(`[aria-label="${name}"], [aria-label^="${name},"]`));
  const finder = page.locator(".mac-window.mac-finder").first();
  const closeWindows = async () => {
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    // A closed main window stays mounted while its further windows remain, so each pass takes the first left.
    const closes = page
      .locator(".mac-window")
      .getByRole("button", { name: "Close", exact: true })
      .filter({ visible: true });
    for (let i = 0; i < 8 && (await closes.count()) > 0; i += 1) {
      await closes
        .first()
        .click({ timeout: 2_000 })
        .catch(() => undefined);
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(300);
  };

  try {
    await uploadFile(page, { parent: "desktop", name: NOTE, type: "text/plain", text: NOTE });
    await uploadFile(page, { parent: "downloads", name: DOWN, type: "text/plain", text: DOWN });
    await write(page, (values) => {
      const next = { ...values };
      for (const key of TOUCHED) delete next[key];
      return { ...next, "finder.showHardDisks": true, "finder.showExternal": true };
    });
    await page.reload();
    await openDesktop(page, base, step);
    await closeWindows();

    // The disks.
    await icon("Macintosh SSD").dblclick();
    step(
      "Macintosh SSD opens the disk in Finder",
      await until(async () =>
        (await finder.locator(".mac-title-bar").innerText()).includes("Macintosh SSD"),
      ),
    );
    await shot(page, path.join(out, `desktop-disk-open-${browserName}.png`));
    await closeWindows();
    await icon("Time Machine").dblclick();
    const prefs = page.locator(".mac-window").filter({ hasText: "Latest backup" });
    step("The Time Machine icon opens its pane", await until(() => prefs.first().isVisible()));
    await page.waitForTimeout(1_000);
    await shot(page, path.join(out, `desktop-time-machine-open-${browserName}.png`));
    await closeWindows();

    // The clock.
    await extra("Clock").click();
    const year = String(new Date().getFullYear());
    step(
      "The clock's menu says the date",
      await until(
        async () => (await page.getByRole("menuitem").filter({ hasText: year }).count()) === 1,
      ),
    );
    await shot(page, path.join(out, `desktop-clock-menu-${browserName}.png`));
    await page.getByRole("menuitemradio", { name: "View as Analog" }).click();
    step(
      "View as Analog is kept on the server",
      await until(async () => (await settings(page))["date-and-time.clockAnalog"] === true),
    );
    step(
      "and draws the analog clock",
      await until(() => extra("Clock").locator("svg").first().isVisible()),
    );
    await extra("Clock").click();
    await page.getByRole("menuitemradio", { name: "View as Digital" }).click();
    step(
      "View as Digital goes back",
      await until(async () => (await settings(page))["date-and-time.clockAnalog"] === false),
    );
    await noMenu();

    // Bluetooth, once its pane asks for it.
    step("Bluetooth has no extra by default", (await extra("Bluetooth").count()) === 0);
    await write(page, (values) => ({ ...values, "bluetooth.showInMenuBar": true }));
    await reloadDesktop(page);
    await extra("Bluetooth").click();
    step(
      "Bluetooth's extra says why it is dimmed",
      await until(() => page.getByRole("menuitem", { name: /cannot see Bluetooth/ }).isVisible()),
    );
    await shot(page, path.join(out, `desktop-bluetooth-menu-${browserName}.png`));
    await row("Open Bluetooth Preferences…").click();
    await noMenu();
    await closeWindows();

    // Command-drag along the menu bar.
    const clockThen = await centre(extra("Clock"));
    const airplayThen = await centre(extra("AirPlay"));
    step("The clock starts to the right of AirPlay", clockThen.x > airplayThen.x);
    await page.keyboard.down("Control");
    await page.mouse.move(clockThen.x, clockThen.y);
    await page.mouse.down();
    await page.mouse.move(airplayThen.x + 30, airplayThen.y, { steps: 3 });
    await page.mouse.move(airplayThen.x, airplayThen.y, { steps: 5 });
    step("The press opens no menu", (await page.getByRole("menu").count()) === 0);
    await page.mouse.up();
    await page.keyboard.up("Control");
    const inOrder = async () =>
      (await centre(extra("Clock"))).x < (await centre(extra("AirPlay"))).x;
    step("Command-drag puts the clock before AirPlay", await until(inOrder));
    step("and letting go opens no menu either", (await page.getByRole("menu").count()) === 0);
    await shot(page, path.join(out, `desktop-extras-moved-${browserName}.png`));
    step(
      "It is kept on the server",
      await until(async () => (await settings(page))["menuBar.extrasOrder"]?.includes("Clock")),
    );
    await reloadDesktop(page);
    step("and across a reload", await until(inOrder));
    const clockNow = await centre(extra("Clock"));
    const airplayNow = await centre(extra("AirPlay"));
    await page.mouse.move(clockNow.x, clockNow.y);
    await page.keyboard.down("Control");
    await page.mouse.down();
    await page.mouse.move(airplayNow.x, airplayNow.y, { steps: 6 });
    await page.keyboard.up("Control");
    await page.mouse.up();
    await page.waitForTimeout(300);
    step(
      "Letting the key go before the button still moves it and opens no menu",
      !(await inOrder()) && (await page.getByRole("menu").count()) === 0,
    );
    await page.mouse.click(5, 300);

    // The divider. A full Dock shrinks its tiles to fit, so this starts below that size.
    await write(page, (values) => ({ ...values, "dock.size": 5 }));
    await reloadDesktop(page);
    const divider = page.locator(".mac-desktop-shell-dock-divider");
    const sizeThen = (await tile("Finder").boundingBox()).height;
    const from = await centre(divider);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, from.y - 12, { steps: 6 });
    await page.mouse.up();
    step(
      "Dragging the divider makes the tiles bigger",
      await until(async () => (await tile("Finder").boundingBox()).height >= sizeThen + 8),
    );
    await shot(page, path.join(out, `desktop-dock-divider-drag-${browserName}.png`));
    step(
      "and is kept on the server",
      await until(async () => (await settings(page))["dock.size"] > 5),
    );
    await write(page, (values) => {
      const next = { ...values };
      delete next["dock.size"];
      return next;
    });
    await reloadDesktop(page);

    // The divider's menu.
    await divider.click({ button: "right" });
    await row("Minimize Using").click();
    await page.getByRole("menuitemradio", { name: "Scale Effect" }).click();
    step(
      "Minimize Using writes the Dock pane's setting",
      await until(async () => (await settings(page))["dock.minimizeEffect"] === "Scale effect"),
    );
    await noMenu();
    await divider.click({ button: "right" });
    await shot(page, path.join(out, `desktop-dock-divider-menu-${browserName}.png`));
    await row("Turn Magnification On").click();
    step(
      "Turn Magnification On is kept on the server",
      await until(async () => (await settings(page))["dock.magnification"] !== undefined),
    );
    await noMenu();
    const middle = await centre(tile("Calculator"));
    await page.mouse.move(middle.x, middle.y, { steps: 3 });
    await page.waitForTimeout(300);
    const ends = await dock.boundingBox();
    await shot(page, path.join(out, `desktop-dock-magnified-${browserName}.png`));
    step(
      "A full Dock under magnification stays on the screen",
      ends.x >= 0 && ends.x + ends.width <= page.viewportSize().width,
      JSON.stringify(ends),
    );
    await page.mouse.move(600, 300);
    await divider.click({ button: "right" });
    await row("Turn Magnification Off").click();
    step(
      "Turn Magnification Off too",
      await until(async () => (await settings(page))["dock.magnification"] === false),
    );
    await noMenu();
    await divider.click({ button: "right" });
    await row("Dock Preferences…").click();
    step(
      "Dock Preferences opens the pane",
      await until(() =>
        page
          .locator(".mac-window")
          .filter({ hasText: "Minimize windows using" })
          .first()
          .isVisible(),
      ),
    );
    await noMenu();
    await closeWindows();

    // Finder's tile.
    await noMenu();
    await tile("Finder").click({ button: "right" });
    await row("New Smart Folder").waitFor({ timeout: 5_000 });
    await row("New Smart Folder").click();
    step(
      "The Finder tile's New Smart Folder starts a search with a rule",
      await until(() => finder.getByRole("button", { name: "Save", exact: true }).isVisible()),
    );
    step(
      "and it leaves out the Trash",
      (await finder.locator(".mac-icon-view-item", { hasText: /^\.Trash$/ }).count()) === 0,
    );
    await shot(page, path.join(out, `desktop-new-smart-folder-${browserName}.png`));
    await closeWindows();
    await tile("Finder").click({ button: "right" });
    await row("Find").click();
    step(
      "and Find goes to the search field",
      await until(() =>
        page.evaluate(
          () =>
            document.activeElement?.closest(".mac-finder") !== null &&
            document.activeElement?.tagName === "INPUT",
        ),
      ),
    );
    await closeWindows();

    // The Dock from the keyboard.
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    await page.keyboard.press("Control+Shift+F3");
    step(
      "Control-F3 (Control-Shift-F3 off a Mac) moves the focus to the Dock",
      await until(() =>
        page.evaluate(
          () => document.activeElement?.closest('[role="toolbar"][aria-label="Dock"]') !== null,
        ),
      ),
    );
    const focusedTile = () =>
      page.evaluate(() => {
        const all = [
          ...document.querySelectorAll('[role="toolbar"][aria-label="Dock"] button[aria-label]'),
        ].filter((each) => each.offsetParent !== null);
        return all.indexOf(document.activeElement);
      });
    const onTile = await focusedTile();
    await page.keyboard.press("ArrowRight");
    const nextTile = await focusedTile();
    step(
      "and Right Arrow moves it to the next tile",
      onTile >= 0 && nextTile === onTile + 1,
      `${onTile} to ${nextTile}`,
    );
    await shot(page, path.join(out, `desktop-dock-keyboard-${browserName}.png`));
    await page.evaluate(() => document.activeElement?.blur());

    // Downloads.
    const downloads = dock.locator('[data-dock-target="folder:downloads"]').first();
    await downloads.click({ button: "right" });
    await row("View content as").click();
    await page.getByRole("menuitemradio", { name: "List" }).click();
    step(
      "A stack's View content as List is kept on the server",
      await until(async () => (await settings(page))["dock.downloadsView"] === "list"),
    );
    await noMenu();
    await downloads.click({ button: "right" });
    await row("Sort by").click();
    await page.getByRole("menuitemradio", { name: "Name" }).click();
    step(
      "Sort by Name is kept on the server",
      await until(async () => (await settings(page))["dock.downloadsSort"] === "name"),
    );
    await noMenu();
    await downloads.click();
    step(
      "and the stack opens as a list of the folder",
      await until(() => page.getByText(DOWN, { exact: true }).first().isVisible()),
    );
    await shot(page, path.join(out, `desktop-stack-list-${browserName}.png`));
    await page.keyboard.press("Escape");
    await noMenu();
    await downloads.click({ button: "right" });
    await row("Open in Finder").click();
    step(
      "Open in Finder shows the folder",
      await until(async () =>
        (
          await finder
            .locator(".mac-title-bar")
            .innerText()
            .catch(() => "")
        ).includes("Downloads"),
      ),
    );
    await closeWindows();
    await tile("Calculator").click({ button: "right" });
    await row("Options").click();
    await row("Show in Finder").click();
    step(
      "A tile's Show in Finder opens Applications",
      await until(async () =>
        (
          await finder
            .locator(".mac-title-bar")
            .innerText()
            .catch(() => "")
        ).includes("Applications"),
      ),
    );
    await closeWindows();

    // Hiding the menu bar.
    await write(page, (values) => ({ ...values, "general.hideMenuBar": true }));
    await reloadDesktop(page);
    await page.mouse.move(600, 400);
    const bar = page.locator(".mac-desktop-shell-menu-bar");
    step(
      "Automatically hide takes the menu bar off the screen",
      await until(async () => (await bar.boundingBox()).y < -10),
    );
    await shot(page, path.join(out, `desktop-menu-bar-hidden-${browserName}.png`));
    await page.mouse.move(600, 0);
    step(
      "and the pointer at the top brings it back",
      await until(async () => (await bar.boundingBox()).y === 0),
    );
    await page.mouse.move(600, 400);
    await write(page, (values) => {
      const next = { ...values };
      delete next["general.hideMenuBar"];
      return next;
    });
    await reloadDesktop(page);

    // The desktop's own menu.
    const free = await page.evaluate(() => {
      const root = document.querySelector(".mac-desktop-shell-desktop");
      const { width, height } = root.getBoundingClientRect();
      for (let y = height - 120; y > 40; y -= 40) {
        for (let x = 24; x < width; x += 40) {
          if (document.elementFromPoint(x, y) === root) return { x, y };
        }
      }
      throw new Error("The windows cover the whole desktop");
    });
    const picture = async () => {
      await page.mouse.click(free.x, free.y, { button: "right" });
      const menu = page.getByRole("menu").last();
      await menu.waitFor({ timeout: 5_000 });
      return menu;
    };
    await (await picture()).getByRole("menuitem", { name: "Change Desktop Background…" }).click();
    step(
      "Change Desktop Background opens its pane",
      await until(() =>
        page
          .locator(".mac-window")
          .filter({ has: page.getByRole("tab", { name: "Screen Saver" }) })
          .first()
          .isVisible(),
      ),
    );
    await shot(page, path.join(out, `desktop-change-background-${browserName}.png`));
    await closeWindows();
    await (await picture()).getByRole("menuitem", { name: "Get Info" }).click();
    step(
      "Get Info with nothing selected is about the Desktop folder",
      await until(() =>
        page.locator(".mac-window").filter({ hasText: "Desktop Info" }).first().isVisible(),
      ),
    );
    await closeWindows();

    // Keys on an icon.
    const folders = async () =>
      ((await api(page, "GET", "/api/files/")).json.entries ?? []).filter(
        (each) =>
          each.parent === "desktop" &&
          each.trashed_ms === undefined &&
          each.name.startsWith("untitled folder"),
      );
    const foldersThen = await folders();
    await (await picture()).getByRole("menuitem", { name: "New Folder" }).click();
    step(
      "New Folder on the desktop makes one, on the server",
      await until(async () => {
        made = (await folders()).filter(
          (each) => !foldersThen.some((other) => other.id === each.id),
        );
        return made.length === 1;
      }),
    );
    await page.keyboard.press("Escape");
    await shot(page, path.join(out, `desktop-new-folder-${browserName}.png`));
    await icon(NOTE).click();
    await page.keyboard.press("Space");
    const look = page.getByRole("button", { name: "Open with TextEdit" });
    step("Space on an icon is Quick Look", await until(() => look.first().isVisible()));
    await shot(page, path.join(out, `desktop-icon-quick-look-${browserName}.png`));
    await page.keyboard.press("Space");
    step("and closes it", await until(async () => (await look.count()) === 0));
    await closeWindows();
    await icon(NOTE).click();
    await page.keyboard.press("Control+O");
    const textedit = page.locator(".mac-window").filter({ hasText: NOTE });
    step("Command-O on an icon opens it", await until(() => textedit.first().isVisible()));
    await closeWindows();
    await icon(NOTE).click();
    // Control-Down is Application Windows where Command is Control, so this is the Command key itself.
    await page.keyboard.press("Meta+ArrowDown");
    step("Command-Down on an icon opens it", await until(() => textedit.first().isVisible()));
    await closeWindows();
    await closeMenus();
  } finally {
    await write(page, (values) => {
      const next = { ...values };
      for (const key of [...TOUCHED, "finder.showHardDisks", "finder.showExternal"]) {
        if (key in then) next[key] = then[key];
        else delete next[key];
      }
      return next;
    });
    const back = await settings(page);
    step(
      "The account's own choices are back",
      TOUCHED.every((key) => JSON.stringify(back[key]) === JSON.stringify(then[key])),
    );
    const left = ((await api(page, "GET", "/api/files/")).json.entries ?? []).filter(
      (each) =>
        each.name === NOTE || each.name === DOWN || made.some((other) => other.id === each.id),
    );
    if (left.length > 0) {
      await api(page, "POST", "/api/files/ops", {
        ops: left.map((each) => ({ op: "trash", id: each.id })),
      });
    }
  }
});

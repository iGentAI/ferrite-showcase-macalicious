#!/usr/bin/env node
// General's two document settings and Dock's Prefer tabs, each changed in its pane and read back from what an application
// then does. Ask to keep changes: off, a document with a file writes itself and closes unasked; on, it waits, and the
// red button, File > Close Window and Quit each ask Save, Don't Save or Cancel, kept across a reload. Close windows when
// quitting: on, an application opens again with one new window; off, with the windows it had, where they were, also
// after a reload. Prefer tabs: Terminal's New Window opens a tab under Always, a window under Manually, and
// either by full screen under In Full Screen Only. Nothing is simulated: the file is put on the drive through its routes,
// as the setup. Exits 0 only when every step passed with no console error, page error, failed request or HTTP error.
//
//   node e2e/sp-documents-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { api, journey, nextSave, openDesktop, reloadDesktop } from "./journey-kit.mjs";
import { openWithSpotlight, uploadFile } from "./system-kit.mjs";

const SETTINGS = "/api/system-preferences/settings";
const FILE = `Keep ${Date.now().toString(36)}.txt`;

await journey("sp-documents-rows", async ({ page, base, out, step }) => {
  const shot = (name) => page.screenshot({ path: path.join(out, `sp-documents-${name}.png`) });
  await openDesktop(page, base);
  const stored = async (key) => (await api(page, "GET", SETTINGS)).json?.values?.[key];
  const bar = page.getByRole("menubar").first();
  const choose = async (menu, item) => {
    await bar.getByRole("menuitem", { name: menu, exact: true }).click();
    await page.getByRole("menuitem", { name: item, exact: true }).click();
  };
  const until = async (check, ms = 8_000) => {
    const end = Date.now() + ms;
    for (;;) {
      const value = await check();
      if (value || Date.now() > end) return value;
      await page.waitForTimeout(100);
    }
  };

  const prefs = page.locator('[data-window-id="system-preferences"]');
  const openPane = async (name, control) => {
    await openWithSpotlight(page, "System Preferences");
    await prefs.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(600);
    if ((await control.count()) === 0) {
      const pane = prefs.getByRole("button", { name, exact: true });
      if ((await pane.count()) === 0) {
        await page.getByRole("button", { name: "Show All" }).first().click();
      }
      await pane.first().click();
    }
    await control.waitFor({ timeout: 8_000 });
  };
  const setBox = async (name, on) => {
    const box = prefs.getByRole("checkbox", { name });
    await openPane("General", box);
    if ((await box.getAttribute("aria-checked")) === String(on)) return;
    const saved = nextSave(page, SETTINGS);
    await box.click();
    await saved;
  };
  const ASK = "Ask to keep changes when closing documents";
  const CLOSE = "Close windows when quitting an app";

  // Ask to keep changes.
  await uploadFile(page, {
    parent: "documents",
    name: FILE,
    type: "text/plain",
    text: "Original words",
  });
  await reloadDesktop(page);
  const editor = page.locator('[data-window-id="textedit"]');
  const body = editor.getByRole("textbox", { name: "Document" });
  const openEditor = async () => {
    await openWithSpotlight(page, "TextEdit");
    await body.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(800);
  };
  const shownText = () => body.evaluate((element) => element.value ?? element.textContent);
  const fileText = () =>
    page.evaluate(async (name) => {
      const { entries } = await (await fetch("/api/files/")).json();
      const entry = entries.find((each) => each.name === name);
      const reply = await fetch(
        `/api/files/content/${encodeURIComponent(entry.id)}?piece=0&count=8`,
      );
      return reply.text();
    }, FILE);
  const typeAtEnd = async (words) => {
    await body.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(words);
  };
  const red = editor.getByRole("button", { name: "Close" }).first();
  const sheet = page
    .locator('[role="dialog"], [role="alertdialog"]')
    .filter({ hasText: "Do you want to save the changes" });

  await openEditor();
  await choose("File", "Open…");
  const panel = page
    .getByRole("dialog")
    .filter({ has: page.getByRole("button", { name: "Open", exact: true }) })
    .last();
  await panel.waitFor();
  await panel.getByText("Documents", { exact: true }).first().click();
  await panel
    .getByText(FILE.replace(/\.txt$/, ""))
    .first()
    .click();
  await panel.getByRole("button", { name: "Open", exact: true }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-window-id="textedit"] [aria-label="Document"]')
        ?.textContent.includes("Original words"),
    undefined,
    { timeout: 15_000 },
  );
  await typeAtEnd(" one");
  step(
    "off (the default): the change goes into the file by itself",
    await until(async () => (await fileText()).includes("Original words one"), 8_000),
    await fileText(),
  );
  await red.click();
  await editor.waitFor({ state: "detached", timeout: 5_000 });
  step("and the window closes unasked", (await sheet.count()) === 0);

  await setBox(ASK, true);
  step("on in the pane, kept on the server", (await stored("general.askToKeepChanges")) === true);
  await openEditor();
  await typeAtEnd(" two");
  await page.waitForTimeout(3_000);
  step(
    "on: 3 seconds on, the file does not hold the change",
    (await fileText()) === "Original words one",
    await fileText(),
  );
  await red.click();
  await sheet.waitFor({ timeout: 5_000 });
  step(
    "the red button asks: Save, Don't Save, Cancel",
    (await sheet.getByRole("button", { name: "Save", exact: true }).isVisible()) &&
      (await sheet.getByRole("button", { name: "Don’t Save" }).isVisible()) &&
      (await sheet.getByRole("button", { name: "Cancel" }).isVisible()),
  );
  await shot("ask");
  await sheet.getByRole("button", { name: "Cancel" }).click();
  await sheet.waitFor({ state: "detached", timeout: 5_000 });
  step(
    "Cancel keeps the window and the change",
    (await editor.count()) === 1 && (await shownText()).includes("two"),
    await shownText(),
  );
  await choose("File", "Close Window");
  await sheet.waitFor({ timeout: 5_000 });
  step("File > Close Window asks too", await sheet.isVisible());
  await sheet.getByRole("button", { name: "Save", exact: true }).click();
  await editor.waitFor({ state: "detached", timeout: 8_000 });
  step(
    "Save writes the file and closes",
    (await fileText()) === "Original words one two",
    await fileText(),
  );

  await openEditor();
  await typeAtEnd(" three");
  await page.waitForTimeout(1_500);
  await reloadDesktop(page);
  await body.waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1_500);
  step(
    "a reload keeps the change in the window and out of the file",
    (await shownText()).includes("three") && (await fileText()) === "Original words one two",
    await fileText(),
  );
  await choose("TextEdit", "Quit TextEdit");
  await sheet.waitFor({ timeout: 5_000 });
  step("Quit asks too", await sheet.isVisible());
  await sheet.getByRole("button", { name: "Don’t Save" }).click();
  await editor.waitFor({ state: "detached", timeout: 8_000 });
  step("Don't Save leaves the file as it was", (await fileText()) === "Original words one two");
  await page.waitForTimeout(1_000);
  await openEditor();
  step(
    "and opened again, the document is the file's, unedited",
    !(await shownText()).includes("three") &&
      (await shownText()).includes("Original words one two"),
    await shownText(),
  );
  await red.click();
  await editor.waitFor({ state: "detached", timeout: 5_000 });
  await setBox(ASK, false);

  // Close windows when quitting.
  const mapsWindow = page.locator('[data-window-id="maps"]');
  const second = page.locator('[data-window-id="maps:2"]');
  const openBoth = async () => {
    await page.getByRole("button", { name: "Maps", exact: true }).first().click();
    await mapsWindow.waitFor({ timeout: 10_000 });
    await mapsWindow.click({ position: { x: 200, y: 10 } });
    await choose("File", "New Window");
    await second.waitFor({ timeout: 8_000 });
    await page.waitForTimeout(400);
    const box = await second.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 90, box.y + 60, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(400);
  };
  const quitMaps = async () => {
    await choose("Maps", "Quit Maps");
    await mapsWindow.waitFor({ state: "detached", timeout: 8_000 });
    await second.waitFor({ state: "detached", timeout: 8_000 });
    await page.waitForTimeout(600);
  };
  const windowsOfMaps = () => page.locator('[data-window-id^="maps"]').count();

  await openBoth();
  await quitMaps();
  await page.getByRole("button", { name: "Maps", exact: true }).first().click();
  await mapsWindow.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(600);
  step("on (the default): quit and opened again, one new window", (await windowsOfMaps()) === 1);
  await second.waitFor({ state: "detached", timeout: 3_000 });
  await quitMaps();

  await setBox(CLOSE, false);
  await openBoth();
  const where = await second.boundingBox();
  await quitMaps();
  step(
    "off: the windows are kept for the application, on the server",
    (await until(async () => (await stored("desktop.quitWindows"))?.maps?.length === 2)) === true,
  );
  await reloadDesktop(page);
  await page.getByRole("button", { name: "Maps", exact: true }).first().click();
  await second.waitFor({ timeout: 10_000 });
  const back = await second.boundingBox();
  step("opened again after a reload, both windows are back", (await windowsOfMaps()) === 2);
  step(
    "the second where it was",
    Math.abs(back.x - where.x) <= 1 && Math.abs(back.y - where.y) <= 1,
    `${where.x},${where.y} and ${back.x},${back.y}`,
  );
  await shot("windows-back");
  step(
    "and nothing is kept once they are",
    await until(async () => !(await stored("desktop.quitWindows"))?.maps),
  );
  await quitMaps();
  await setBox(CLOSE, true);
  await page.getByRole("button", { name: "Maps", exact: true }).first().click();
  await mapsWindow.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(600);
  step("on again: what was kept does not come back", (await windowsOfMaps()) === 1);
  await quitMaps();

  // The same for the windows an application opens itself: Terminal's.
  const firstTerminal = page.locator('[data-window-id="terminal"]');
  const secondTerminal = page.locator('[data-window-id^="terminal:window-"]');
  const terminalCount = () => page.locator('[data-window-id^="terminal"]').count();
  const openTerminals = async () => {
    await page.getByRole("button", { name: "Terminal", exact: true }).first().click();
    await firstTerminal.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(500);
    await choose("Shell", "New Window");
    await secondTerminal.waitFor({ timeout: 8_000 });
    await page.waitForTimeout(400);
    const box = await secondTerminal.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 70, box.y + 50, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(400);
  };
  const quitTerminal = async () => {
    await choose("Terminal", "Quit Terminal");
    await firstTerminal.waitFor({ state: "detached", timeout: 8_000 });
    await page.waitForTimeout(600);
  };
  await setBox(CLOSE, false);
  await openTerminals();
  const terminalWhere = await secondTerminal.boundingBox();
  await quitTerminal();
  await reloadDesktop(page);
  await page.getByRole("button", { name: "Terminal", exact: true }).first().click();
  await secondTerminal.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500);
  const terminalBack = await secondTerminal.boundingBox();
  step(
    "off, after a reload: Terminal's own second window is back, where it was",
    (await terminalCount()) === 2 &&
      Math.abs(terminalBack.x - terminalWhere.x) <= 1 &&
      Math.abs(terminalBack.y - terminalWhere.y) <= 1,
    `${terminalWhere.x},${terminalWhere.y} and ${terminalBack.x},${terminalBack.y}`,
  );
  await quitTerminal();
  await setBox(CLOSE, true);
  await page.getByRole("button", { name: "Terminal", exact: true }).first().click();
  await firstTerminal.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(600);
  step("on: Terminal opens with one window", (await terminalCount()) === 1);
  await quitTerminal();

  // A window kept on a larger screen comes back where its title bar can be reached.
  await setBox(CLOSE, false);
  await openTerminals();
  const farRight = await secondTerminal.boundingBox();
  const viewport = page.viewportSize();
  await page.mouse.move(farRight.x + farRight.width / 2, farRight.y + 10);
  await page.mouse.down();
  await page.mouse.move(viewport.width - 60, farRight.y + 10, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  await quitTerminal();
  await page.setViewportSize({ width: 900, height: 640 });
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Terminal", exact: true }).first().click();
  await secondTerminal.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500);
  const shrunk = await secondTerminal.boundingBox();
  step(
    "on a smaller screen its title bar is on the screen",
    shrunk.x + 80 <= 900 && shrunk.y >= 0 && shrunk.y + 20 <= 640,
    `${shrunk.x},${shrunk.y}`,
  );
  await page.setViewportSize(viewport);
  await page.waitForTimeout(400);
  await quitTerminal();
  await setBox(CLOSE, true);

  // Prefer tabs.
  const preferTabs = prefs.getByRole("combobox", { name: "Prefer tabs when opening documents:" });
  const setTabs = async (option) => {
    await openPane("Dock", preferTabs);
    await preferTabs.click();
    const saved = nextSave(page, SETTINGS);
    await page.getByRole("option", { name: option, exact: true }).click();
    await saved;
    await prefs.getByRole("button", { name: "Close" }).first().click();
    await prefs.waitFor({ state: "detached", timeout: 5_000 });
  };
  const terminal = page.locator('[data-window-id="terminal"]');
  const terminals = () => page.locator('[data-window-id^="terminal"]').count();
  const tabsOf = (window) => window.getByRole("tab").count();
  await setTabs("Always");
  await page.getByRole("button", { name: "Terminal", exact: true }).first().click();
  await terminal.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(600);
  await choose("Shell", "New Window");
  await page.waitForTimeout(500);
  step(
    "Always: Terminal's New Window opens a tab",
    (await terminals()) === 1 && (await tabsOf(terminal)) === 2,
    `${await terminals()} windows, ${await tabsOf(terminal)} tabs`,
  );
  await shot("terminal-tab");

  const closeSecond = () =>
    page
      .locator('[data-window-id^="terminal"]:not([data-window-id="terminal"])')
      .getByRole("button", { name: "Close" })
      .first()
      .click();
  const toTerminal = async () => {
    await terminal.click({ position: { x: 300, y: 10 } });
    await page.waitForTimeout(200);
  };
  await setTabs("Manually");
  await toTerminal();
  await choose("Shell", "New Window");
  step("Manually: it opens a window", await until(async () => (await terminals()) === 2));
  await closeSecond();
  await until(async () => (await terminals()) === 1);

  await reloadDesktop(page);
  await setTabs("In Full Screen Only");
  await terminal.waitFor({ timeout: 10_000 });
  await toTerminal();
  const tabsBefore = await tabsOf(terminal);
  await choose("Shell", "New Window");
  step(
    "In Full Screen Only, not in full screen: a window",
    await until(async () => (await terminals()) === 2),
  );
  await closeSecond();
  await until(async () => (await terminals()) === 1);
  await toTerminal();
  await choose("View", "Enter Full Screen");
  await page.waitForTimeout(900);
  // In full screen the menu bar comes down under the pointer at the top of the screen.
  const revealMenuBar = async () => {
    await page.mouse.move(400, 0);
    await page.waitForTimeout(700);
  };
  await revealMenuBar();
  await choose("Shell", "New Window");
  step(
    "in full screen: a tab",
    await until(async () => (await tabsOf(terminal)) === Math.max(tabsBefore, 1) + 1),
    `${await terminals()} windows, ${await tabsOf(terminal)} tabs`,
  );
  await revealMenuBar();
  await choose("View", "Exit Full Screen");
  await page.waitForTimeout(600);
  step("the choice is on the server", (await stored("dock.preferTabs")) === "In Full Screen Only");
});

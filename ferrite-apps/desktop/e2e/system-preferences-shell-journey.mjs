#!/usr/bin/env node
// System Preferences' shell on a served desktop, each with a screenshot: About, Hide, Hide Others, Show All, Quit, the
// Window and View menus' rows, Close Window and the desktop's keys; the window's fixed width with a height that follows
// the pane, Back and Forward, Return on a search, the account header, the grid, a pane opened from the keyboard, the note
// under a pane, where the focus goes; the saved theme at the next start, a status menu's Preferences row, and About This
// Mac's way to a pane. Exits 0 only when every step passed with no console error, page error, failed request or HTTP error.
//
//   node e2e/system-preferences-shell-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, nextSave, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const URL = "/api/system-preferences/settings";

await journey("system-preferences-shell", async ({ page, base, out, step }) => {
  const shot = async (name) => {
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(out, `sp-shell-${name}.png`) });
  };
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
  await openDesktop(page, base);
  const bar = page.getByRole("menubar");
  const openMenu = async (title) => {
    const item = bar.getByRole("menuitem", { name: title, exact: true });
    await item.click();
    await page.waitForTimeout(150);
    if ((await item.getAttribute("aria-expanded")) !== "true") await item.click();
  };
  const choose = async (title, row) => {
    await openMenu(title);
    await page.getByRole("menuitem", { name: row }).first().click();
    await page.waitForTimeout(450);
  };
  const prefs = page.locator('[data-window-id="system-preferences"]');
  const frame = prefs.locator("[data-window-state]").first();
  const dock = () => page.getByRole("button", { name: /^System Preferences$/ }).first();
  const open = async () => {
    await dock().click();
    await prefs.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(400);
  };
  const grid = () => prefs.getByRole("group", { name: "All preferences" });
  const showAll = async () => {
    await prefs.getByRole("button", { name: "Show All" }).click();
    await grid().waitFor({ timeout: 5_000 });
  };

  await page
    .getByRole("button", { name: /^Calculator$/ })
    .first()
    .click();
  const calculator = page.locator('[data-window-id="calculator"]');
  await calculator.waitFor({ timeout: 10_000 });
  await open();

  await openMenu("Edit");
  await shot("edit-menu-idle");
  step(
    "Edit says to click in a text field first",
    (await page.getByRole("menuitem", { name: /^Undo/ }).getAttribute("data-reason")) ===
      "Click in a text field first",
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  const buttons = await grid().locator(".mac-system-preferences-band").getByRole("button").count();
  await shot("grid");
  step("the grid lists the panes", buttons >= 30, `${buttons} in its two bands`);
  const header = await grid().getByRole("button", { name: "Apple ID" }).first();
  await header.click();
  await prefs.locator('[role="group"][data-pane="apple-id"]').waitFor({ timeout: 5_000 });
  await shot("account-header");
  step("the account header opens Apple ID", true);
  await showAll();

  const width = async () => (await prefs.boundingBox()).width;
  const height = async () => (await prefs.boundingBox()).height;
  const gridHeight = await height();
  const gridWidth = await width();
  await grid().getByRole("button", { name: "Dock", exact: true }).first().click();
  await prefs.locator('[role="group"][data-pane="dock"]').waitFor({ timeout: 5_000 });
  await page.waitForTimeout(400);
  await shot("dock-pane");
  step(
    "the width stays and the height follows the pane",
    (await width()) === gridWidth && (await height()) !== gridHeight,
    `${gridHeight} to ${await height()}`,
  );
  step(
    "the focus moves into what replaced the icon",
    await prefs.evaluate((node) => node.contains(document.activeElement)),
  );
  const note = prefs.getByText(/take effect|takes effect|changes? nothing|kept/i).first();
  step("a note under the pane names what takes effect", await note.isVisible());

  await prefs.getByRole("button", { name: "Back" }).click();
  await grid().waitFor({ timeout: 5_000 });
  step("the toolbar's Back returns", true);
  await prefs.getByRole("button", { name: "Forward" }).click();
  await prefs.locator('[role="group"][data-pane="dock"]').waitFor({ timeout: 5_000 });
  await shot("forward");
  step("and Forward goes on", true);
  await showAll();

  const search = prefs.getByRole("searchbox").or(prefs.locator("input[type=search]")).first();
  await search.fill("sound");
  await page.waitForTimeout(200);
  await search.press("Enter");
  await grid().waitFor({ state: "detached", timeout: 5_000 });
  await shot("search-return");
  step("Return in the search field opens the first match", true);
  await showAll();
  await search.fill("");

  const icon = grid().getByRole("button", { name: "General", exact: true }).first();
  await icon.focus();
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => document.activeElement?.textContent ?? "");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  await shot("keyboard-open");
  step(
    "a tab to an icon and Return opens its pane",
    (await grid().count()) === 0,
    focused.slice(0, 30),
  );
  await showAll();

  await choose("System Preferences", /^About System Preferences$/);
  const about = page.locator('.mac-desktop-shell-about[data-app="system-preferences"]');
  await about.waitFor({ timeout: 3_000 });
  await shot("about");
  step("About shows the name", (await about.innerText()).includes("System Preferences"));
  await about.getByRole("button", { name: /close/i }).first().click();
  await about.waitFor({ state: "detached" });

  await choose("System Preferences", /^Hide System Preferences/);
  await shot("hidden");
  step("Hide takes the window away", !(await frame.isVisible()));
  const front = await bar.getByRole("menuitem").nth(1).innerText();
  await openMenu(front);
  await page.waitForTimeout(150);
  await shot("show-all-menu");
  await page.getByRole("menuitem", { name: "Show All" }).first().click();
  await page.waitForTimeout(450);
  step("Show All brings it back", await frame.isVisible());

  await open();
  await choose("System Preferences", "Hide Others");
  await shot("hide-others");
  step(
    "Hide Others takes the other application's window away",
    !(await calculator.locator("[data-window-state]").first().isVisible()),
  );
  await choose("System Preferences", "Show All");

  await open();
  await openMenu("Window");
  await shot("window-menu");
  const zoom = page.getByRole("menuitem", { name: "Zoom" });
  step(
    "Zoom is dimmed, as the window has a fixed size",
    (await zoom.getAttribute("aria-disabled")) === "true",
  );
  step(
    "the Window menu lists the window",
    (await page.getByRole("menu").getByRole("menuitemcheckbox").allInnerTexts()).some((text) =>
      text.includes("System Preferences"),
    ),
  );
  step(
    "and Bring All to Front",
    (await page.getByRole("menuitem", { name: "Bring All to Front" }).count()) === 1,
  );
  await page.getByRole("menuitem", { name: "Minimize" }).click();
  await page.waitForTimeout(450);
  await shot("minimized");
  step("Window > Minimize takes it to the Dock", !(await frame.isVisible()));
  await page
    .getByRole("button", { name: /, minimized window$/ })
    .first()
    .click();
  await page.waitForTimeout(500);
  step("its Dock tile brings it back", await frame.isVisible());

  await openMenu("View");
  const fullScreen = page.getByRole("menuitem", { name: "Enter Full Screen" });
  await shot("view-menu");
  step(
    "Enter Full Screen is dimmed and says why",
    (await fullScreen.getAttribute("aria-disabled")) === "true" &&
      (await fullScreen.getAttribute("title")) === "This window has a fixed size",
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
  await search.fill("Dock");
  await search.selectText();
  await choose("Edit", /^Cut/);
  step(
    "Edit > Cut moves the words to the clipboard",
    (await clipboard()) === "Dock" && (await search.inputValue()) === "",
  );
  await choose("Edit", /^Paste/);
  step("Edit > Paste puts them back", (await search.inputValue()) === "Dock");
  await openMenu("Edit");
  await shot("edit-menu");
  await page.getByRole("menuitem", { name: /^Select All/ }).click();
  await page.waitForTimeout(450);
  step(
    "Edit > Select All selects them",
    await search.evaluate((field) => field.selectionEnd - field.selectionStart === 4),
  );
  await page.evaluate(() => navigator.clipboard.writeText("sentinel"));
  await choose("Edit", /^Copy/);
  step("Edit > Copy copies them", (await clipboard()) === "Dock");
  await choose("Edit", /^Delete/);
  step("Edit > Delete removes them", (await search.inputValue()) === "");
  await choose("Edit", /^Undo/);
  step("Edit > Undo brings them back", (await search.inputValue()) === "Dock");
  await choose("Edit", /^Redo/);
  step("Edit > Redo takes them away again", (await search.inputValue()) === "");
  // A field added for the check, as the grid has one: another field taking the keyboard during the menu's fade
  // keeps the command from it.
  await search.fill("Dock");
  await page.evaluate(() => {
    const other = document.createElement("input");
    other.id = "journey-other-field";
    other.value = "untouched";
    document.querySelector('[data-window-id="system-preferences"] .mac-title-bar')?.append(other);
  });
  await search.selectText();
  await openMenu("Edit");
  await page.getByRole("menuitem", { name: /^Delete/ }).click();
  await page.locator("#journey-other-field").focus();
  await page.waitForTimeout(500);
  step(
    "a command does not follow the keyboard to another field",
    (await search.inputValue()) === "Dock" &&
      (await page.locator("#journey-other-field").inputValue()) === "untouched" &&
      (await page
        .locator("#journey-other-field")
        .evaluate((node) => node === document.activeElement)),
  );
  await page.locator("#journey-other-field").evaluate((node) => node.remove());
  // A field that has become a password field is not read.
  await search.selectText();
  await page.evaluate(() => navigator.clipboard.writeText("sentinel"));
  const anyInput = prefs.locator("input").first();
  await anyInput.evaluate((node) => {
    node.type = "password";
  });
  await choose("Edit", /^Copy/);
  await choose("Edit", /^Cut/);
  step(
    "a field that became a password field is neither copied nor cut",
    (await clipboard()) === "sentinel" && (await anyInput.inputValue()) === "Dock",
  );
  await anyInput.evaluate((node) => {
    node.type = "search";
  });
  await search.fill("");
  await openMenu("Edit");
  const dictation = page.getByRole("menuitem", { name: /^Start Dictation/ });
  step(
    "Start Dictation is dimmed and says why",
    /speech service|text field/.test((await dictation.getAttribute("data-reason")) ?? ""),
  );
  await page.getByRole("menuitem", { name: "Emoji & Symbols" }).click();
  await page.waitForTimeout(500);
  await shot("emoji");
  const viewer = page
    .getByRole("dialog", { name: /Character|Emoji/ })
    .or(page.locator('[data-window-id*="character"]'));
  step("Emoji & Symbols opens the character viewer", (await viewer.count()) > 0);
  await viewer.first().getByRole("button", { name: /close/i }).first().click();
  await page.waitForTimeout(300);

  await page.keyboard.press("Control+m");
  await page.waitForTimeout(500);
  step("Command-M minimizes it", !(await frame.isVisible()));
  await open();
  await page.keyboard.press("Control+h");
  await page.waitForTimeout(500);
  step("Command-H hides it", !(await frame.isVisible()));
  await open();
  await page.waitForTimeout(100);
  await page.keyboard.press("Control+w");
  await prefs.waitFor({ state: "detached", timeout: 5_000 });
  await shot("closed");
  step("Command-W closes it", true);
  await open();
  await openMenu("System Preferences");
  await shot("app-menu");
  await page.getByRole("menuitem", { name: /^Quit System Preferences/ }).click();
  await prefs.waitFor({ state: "detached", timeout: 5_000 });
  step("Quit ends it", true);
  await open();
  await page.keyboard.press("Control+q");
  await prefs.waitFor({ state: "detached", timeout: 5_000 });
  step("Command-Q ends it", true);

  // The saved theme at the next start, with System Preferences closed; its value through the pane's own control.
  await open();
  await showAll();
  await grid().getByRole("button", { name: "General", exact: true }).first().click();
  const saved = nextSave(page, URL, (body) => body?.theme?.appearance === "dark");
  await prefs.getByRole("radio", { name: "Dark" }).click();
  await saved;
  await prefs.getByRole("button", { name: "Show All" }).click();
  await page.keyboard.press("Control+q");
  await prefs.waitFor({ state: "detached", timeout: 5_000 });
  await reloadDesktop(page);
  await page.waitForFunction(
    () => document.documentElement.getAttribute("data-appearance") === "dark",
    null,
    { timeout: 10_000 },
  );
  await shot("theme-at-start");
  step("the saved theme is back at the next start, the window closed", (await prefs.count()) === 0);

  // A status menu's Preferences row, and the same pane again from About This Mac.
  await page.getByRole("menuitem", { name: "Time Machine" }).click();
  await page.getByRole("menuitem", { name: "Open Time Machine Preferences…" }).click();
  await prefs.locator('[role="group"][data-pane="time-machine"]').waitFor({ timeout: 8_000 });
  await shot("status-menu");
  step("a status menu's Preferences row opens the pane", true);
  await page.keyboard.press("Control+q");
  await prefs.waitFor({ state: "detached", timeout: 5_000 });

  await bar.getByRole("menuitem").first().click();
  await page.getByRole("menuitem", { name: "About This Mac" }).click();
  const mac = page.locator('[data-window-id="about-this-mac"]');
  await mac.waitFor({ timeout: 8_000 });
  await mac.getByRole("button", { name: "Software Update…" }).click();
  await prefs.locator('[role="group"][data-pane="software-update"]').waitFor({ timeout: 8_000 });
  await shot("about-to-update");
  step("About This Mac opens Software Update", true);
});

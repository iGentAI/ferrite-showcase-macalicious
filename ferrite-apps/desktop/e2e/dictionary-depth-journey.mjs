#!/usr/bin/env node
// Dictionary's menus and keys on the served desktop: Go and its keys, View's text sizes and full
// screen, File > Print, the Edit commands on the search field and on the entry, Edit > Look Up with
// the selected word in its name, and Look Up from another app's Edit menu. Exits 0 only when every
// step passed with no console error, page error or failed request.
//
// It writes only look-ups into the person's recent look-ups, which have no delete route, and one
// note of a unique name, which it deletes again by that name. The browser's print dialog is the
// one stand-in: a spy on the print frame's `print` stands for it.
//
//   node e2e/dictionary-depth-journey.mjs --url http://127.0.0.1:3020 --out e2e/output

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("dictionary-depth", {
  ignoreOtherOrigins: true,
  contextOptions: { chromium: { permissions: ["clipboard-read", "clipboard-write"] } },
});
const stamp = Date.now();
const FIRST = "serendipity";
const NOTE_WORD = `lookupdepth${stamp}`;

const menuBar = (page, title) =>
  page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
const menuRow = (page, name) => page.getByRole("menuitem", { name }).first();
async function openMenu(page, title) {
  await menuBar(page, title).click();
  await page.waitForTimeout(250);
}
async function choose(page, title, name) {
  await openMenu(page, title);
  await menuRow(page, name).click();
  await page.waitForTimeout(250);
}
const dimmed = async (page, name) =>
  (await menuRow(page, name).getAttribute("aria-disabled")) === "true";
const clipboard = (page) => page.evaluate(() => navigator.clipboard.readText());

await run(async (page) => {
  await openDesktop(page, base, step);
  // Dictionary does not come with the desktop. This browser is a new guest of its own, and the
  // journey only adds to that guest's library.
  const library = (await api(page, "GET", "/api/app-store/library")).json;
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(library.installed ?? []), "dictionary"])],
    rev: library.rev,
  });
  await reloadDesktop(page);
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const spotlight = page.getByRole("combobox", { name: "Spotlight Search" });
  await spotlight.fill("Dictionary");
  await spotlight.press("Enter");
  const window = page.locator('.mac-managed-window[data-window-id="dictionary"]');
  const field = window.getByRole("searchbox", { name: "Search" });
  await field.waitFor({ state: "visible", timeout: 10_000 });
  const entryOf = (word) => window.getByRole("region", { name: `Entry for ${word}` });
  const scale = () =>
    window
      .locator(".mac-dictionary-entry")
      .evaluate((node) => node.style.getPropertyValue("--mac-dictionary-text-scale"));
  const startUrl = page.url();

  await field.click();
  await page.keyboard.type(FIRST);
  const sense = entryOf(FIRST).locator(".mac-dictionary-sense").first();
  await sense.waitFor({ state: "visible", timeout: 30_000 });

  // Edit > Look Up with nothing selected, then with a word of the entry selected.
  await openMenu(page, "Edit");
  step("Edit > Look Up is dimmed with nothing selected", await dimmed(page, "Look Up"));
  await page.keyboard.press("Escape");
  await sense.dblclick({ position: { x: 40, y: 8 } });
  const selected = await page.evaluate(() => document.getSelection().toString().trim());
  await openMenu(page, "Edit");
  const named = menuRow(page, `Look Up “${selected}”`);
  step(
    "Edit > Look Up names the word selected in the entry",
    selected !== "" && (await named.isVisible()),
    selected,
  );
  step(
    "Cut and Undo are dimmed for the entry",
    (await dimmed(page, /^Cut/)) && (await dimmed(page, /^Undo/)),
  );
  await shot(page, path.join(out, "dictionary-edit-look-up.png"));
  await menuRow(page, /^Copy/).click();
  await page.waitForTimeout(250);
  step("Edit > Copy copies the entry's selection", (await clipboard(page)).trim() === selected);

  await openMenu(page, "Edit");
  await named.click();
  await page.waitForTimeout(250);
  step(
    "choosing Look Up searches for that word",
    (await field.inputValue()) === selected,
    await field.inputValue(),
  );
  await entryOf(selected)
    .or(window.getByRole("region", { name: new RegExp(`^Entry for ${selected}$`, "i") }))
    .first()
    .waitFor({ timeout: 30_000 });

  // Go, from the keys and the menu.
  await page.keyboard.press("ControlOrMeta+BracketLeft");
  await page.waitForTimeout(250);
  step("Command-[ goes back", (await field.inputValue()) === FIRST, await field.inputValue());
  await page.keyboard.press("ControlOrMeta+BracketRight");
  await page.waitForTimeout(250);
  step("Command-] goes forward", (await field.inputValue()) === selected);
  await choose(page, "Go", /^Back/);
  step("Go > Back goes back", (await field.inputValue()) === FIRST);
  await openMenu(page, "Go");
  await shot(page, path.join(out, "dictionary-go-menu.png"));
  await menuRow(page, /^Forward/).click();
  await page.waitForTimeout(250);
  step("Go > Forward goes forward", (await field.inputValue()) === selected);
  await page.keyboard.press("ControlOrMeta+BracketLeft");
  await page.waitForTimeout(250);
  await sense.waitFor({ state: "visible", timeout: 30_000 });
  step("the keys did not leave the page", page.url() === startUrl);

  // View: the text size, from the menu and the keys.
  const fontSize = () =>
    sense.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
  const before = await fontSize();
  await choose(page, "View", /^Make Text Bigger/);
  step(
    "View > Make Text Bigger makes the entry's text bigger",
    (await scale()) === "1.15" && (await fontSize()) > before,
    `${before}px to ${await fontSize()}px`,
  );
  await openMenu(page, "View");
  await shot(page, path.join(out, "dictionary-view-menu.png"));
  await page.keyboard.press("Escape");
  await page.keyboard.press("ControlOrMeta+Equal");
  await page.waitForTimeout(150);
  step("Command-+ makes it bigger again", (await scale()) === "1.3", await scale());
  await choose(page, "View", /^Make Text Smaller/);
  step("View > Make Text Smaller makes it smaller", (await scale()) === "1.15");
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("ControlOrMeta+Minus");
    await page.waitForTimeout(100);
  }
  step("Command-- goes down to the smallest size", (await scale()) === "0.8", await scale());
  await openMenu(page, "View");
  step(
    "Make Text Smaller is dimmed at the smallest size",
    await dimmed(page, /^Make Text Smaller/),
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("ControlOrMeta+Equal");
  await page.waitForTimeout(150);
  step("Command-= makes it bigger", (await scale()) === "0.9", await scale());
  await page.keyboard.press("Shift+ControlOrMeta+Equal");
  await page.waitForTimeout(150);
  step(
    "Shift-Command-=, the real Command-+, makes it bigger",
    (await scale()) === "1",
    await scale(),
  );
  step("the size comes back to the usual one", (await scale()) === "1", await scale());

  const frameWidth = () => window.evaluate((node) => node.getBoundingClientRect().width);
  const openWidth = await frameWidth();
  await choose(page, "View", /^Enter Full Screen/);
  await page.waitForTimeout(900);
  step(
    "View > Enter Full Screen fills the desktop",
    (await frameWidth()) === page.viewportSize().width,
    `${openWidth} to ${await frameWidth()}`,
  );
  await shot(page, path.join(out, "dictionary-full-screen.png"));
  await page.mouse.move(400, 0);
  await page.waitForTimeout(800);
  await choose(page, "View", /^Exit Full Screen/);
  await page.waitForTimeout(900);
  step("View > Exit Full Screen gives the size back", (await frameWidth()) === openWidth);

  // File > Print and Command-P: a spy stands for the browser's dialog, as the frame loads.
  await page.evaluate(() => {
    window.__printed = [];
    document.addEventListener(
      "load",
      (event) => {
        const frame = event.target;
        if (!(frame instanceof HTMLIFrameElement) || !frame.dataset.dictionaryPrint) return;
        frame.contentWindow.print = () =>
          window.__printed.push(frame.contentDocument.body.innerText);
      },
      true,
    );
  });
  const printed = async (count) => {
    await page.waitForFunction((n) => window.__printed.length === n, count, { timeout: 5000 });
    return page.evaluate(() => window.__printed.at(-1));
  };
  await openMenu(page, "File");
  await shot(page, path.join(out, "dictionary-file-print.png"));
  await menuRow(page, /^Print/).click();
  const copy = await printed(1);
  const senseText = (await sense.innerText()).split("\n")[0];
  step(
    "File > Print prints the entry's text, without its buttons",
    copy.includes(senseText) && !/\bListen\b/.test(copy),
    senseText.slice(0, 40),
  );
  await page.keyboard.press("ControlOrMeta+p");
  step("Command-P prints it too", (await printed(2)).includes(senseText));

  // Edit on the search field.
  await field.click();
  await choose(page, "Edit", /^Select All/);
  const fieldSelection = () =>
    field.evaluate((node) => node.value.slice(node.selectionStart, node.selectionEnd));
  step("Edit > Select All selects the field's text", (await fieldSelection()) === FIRST);
  await openMenu(page, "Edit");
  const lookUpRow = menuRow(page, `Look Up “${FIRST}”`);
  step("Look Up names the word selected in the field", await lookUpRow.isVisible());
  await shot(page, path.join(out, "dictionary-edit-field.png"));
  await menuRow(page, /^Copy/).click();
  await page.waitForTimeout(250);
  step("Edit > Copy copies the field's selection", (await clipboard(page)) === FIRST);
  await choose(page, "Edit", /^Delete/);
  step("Edit > Delete empties it", (await field.inputValue()) === "");
  await choose(page, "Edit", /^Undo/);
  step(
    "Edit > Undo brings it back",
    (await field.inputValue()) === FIRST,
    await field.inputValue(),
  );
  await choose(page, "Edit", /^Redo/);
  step("Edit > Redo takes it away again", (await field.inputValue()) === "");
  await choose(page, "Edit", /^Undo/);
  await choose(page, "Edit", /^Select All/);
  await page.evaluate(() => navigator.clipboard.writeText(""));
  await choose(page, "Edit", /^Cut/);
  step(
    "Edit > Cut empties the field and fills the clipboard",
    (await field.inputValue()) === "" && (await clipboard(page)) === FIRST,
  );
  await choose(page, "Edit", /^Paste/);
  await page.waitForTimeout(300);
  step("Edit > Paste puts it back", (await field.inputValue()) === FIRST, await field.inputValue());
  await sense.waitFor({ state: "visible", timeout: 30_000 });

  // Edit > Select All and Command-A in the entry. A click on a word would follow it to its own entry, so the
  // click lands in the entry's margin.
  const inMargin = () => entryOf(FIRST).click({ position: { x: 3, y: 3 } });
  await inMargin();
  await page.waitForTimeout(150);
  await page.keyboard.press("ControlOrMeta+a");
  await page.waitForTimeout(150);
  const inEntry = () =>
    page.evaluate(() => {
      const held = document.getSelection();
      const anchor = held.anchorNode;
      return {
        text: held.toString(),
        inside: Boolean(
          (anchor instanceof Element ? anchor : anchor?.parentElement)?.closest(
            ".mac-dictionary-entry",
          ),
        ),
      };
    });
  let held = await inEntry();
  step(
    "Command-A selects the entry, not the desktop",
    held.inside && held.text.includes(senseText) && !held.text.includes("Dock"),
  );
  await inMargin();
  await choose(page, "Edit", /^Select All/);
  held = await inEntry();
  step(
    "Edit > Select All selects the entry",
    held.inside && held.text.includes(senseText),
    `${held.inside} ${held.text.slice(0, 40)}`,
  );

  // The look-ups are the person's, across a reload.
  const history = await api(page, "GET", "/api/dictionary/history");
  step(
    "the words looked up are in the person's history on the server",
    history.json.history?.some((past) => past.word === FIRST) &&
      history.json.history?.some((past) => past.word === selected),
  );
  await reloadDesktop(page);
  const again = await api(page, "GET", "/api/dictionary/history");
  step(
    "and are there after a reload",
    again.json.history?.some((past) => past.word === selected),
  );

  // Edit > Look Up in another app: a note of this journey's own, deleted again by its name.
  await launch(page, "Notes");
  const notes = page.getByRole("region", { name: "Notes" });
  const list = notes.getByRole("listbox", { name: "Notes" });
  await list.waitFor({ state: "visible", timeout: 10_000 });
  await choose(page, "File", "New Note");
  await page.keyboard.type(NOTE_WORD);
  await page.waitForTimeout(700);
  await page.keyboard.press("ControlOrMeta+a");
  await page.waitForTimeout(150);
  await choose(page, "Edit", "Look Up");
  const dictionary = page.locator('.mac-managed-window[data-window-id="dictionary"]');
  const opened = dictionary.getByRole("searchbox", { name: "Search" });
  await opened.waitFor({ state: "visible", timeout: 10_000 });
  step(
    "Edit > Look Up in Notes opens Dictionary on the selected word",
    (await opened.inputValue()) === NOTE_WORD,
    await opened.inputValue(),
  );
  await shot(page, path.join(out, "dictionary-look-up-from-notes.png"));

  await launch(page, "Notes");
  await page.waitForTimeout(400);
  const row = list.getByRole("option", { name: new RegExp(NOTE_WORD) });
  await row.click();
  await notes.getByRole("button", { name: "Delete" }).click();
  await notes.getByRole("treeitem", { name: /^Recently Deleted/ }).click();
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete Immediately" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  // Notes saves a moment after the change, once its writes in flight have settled.
  let kept = true;
  for (let tries = 0; tries < 20 && kept; tries++) {
    await page.waitForTimeout(500);
    const data = (await api(page, "GET", "/api/notes/data")).json.data;
    kept = data.notes.some((note) => note.lines[0] === NOTE_WORD);
  }
  step("the journey's note is gone again", !kept);
});

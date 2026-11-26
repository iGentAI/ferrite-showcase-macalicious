#!/usr/bin/env node
// Script Editor on Ferrite: its editor on the editors' shared path. Script Editor is got from the
// App Store, a line is written in its script, and from the desktop menu bar's Edit menu: Copy (the
// keyboard's Paste then puts it in again), Undo and Redo, Cut (the keyboard pastes it back),
// Select All, and Paste, which reads the clipboard where this engine lets a menu do so (Firefox,
// Chromium with --grant-clipboard) and is dimmed with the reason where it refuses (WebKit,
// Chromium without the grant). Exits 0 only when every step passed and the page logged no console
// error, page error, failed request or HTTP error.
//
//   ferrite dev                                   # in ferrite-apps/desktop
//   node e2e/script-editor-edit-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                           [--browser chromium|chrome|firefox|webkit] [--grant-clipboard]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { engineFamily } from "./journey-kit.mjs";

const { base, out, browserName } = options();
const grant =
  process.argv.includes("--grant-clipboard") && engineFamily(browserName) === "chromium";
const { step, run } = journey(
  "script-editor-edit",
  grant
    ? { contextOptions: { chromium: { permissions: ["clipboard-read", "clipboard-write"] } } }
    : {},
);
const pasteAllowed = browserName === "firefox" || grant;
const stamp = String(Date.now()).slice(-6);
const COPY = `quince${stamp}`;
const CUT = `sorrel${stamp}`;

/** Select `word` in the editor, focused. */
const selectWord = (editor, word) =>
  editor.evaluate((root, wanted) => {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.nodeValue.indexOf(wanted);
      if (at < 0) continue;
      root.focus();
      const range = root.ownerDocument.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + wanted.length);
      root.ownerDocument.getSelection().removeAllRanges();
      root.ownerDocument.getSelection().addRange(range);
      return true;
    }
    return false;
  }, word);

/** Put the insertion point at the end of the editor's last text, focused. */
const caretAtEnd = (editor) =>
  editor.evaluate((root) => {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let last = null;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeValue.trim()) last = node;
    }
    root.focus();
    const range = root.ownerDocument.createRange();
    if (last) range.setStart(last, last.nodeValue.length);
    else range.selectNodeContents(root);
    range.collapse(true);
    root.ownerDocument.getSelection().removeAllRanges();
    root.ownerDocument.getSelection().addRange(range);
  });

const count = (editor, word) =>
  editor.evaluate((root, wanted) => root.textContent.split(wanted).length - 1, word);

const openEdit = (page) =>
  page.getByRole("menubar").first().getByRole("menuitem", { name: "Edit", exact: true }).click();
const editItem = (page, name) =>
  page
    .getByRole("menu")
    .getByRole("menuitem", { name: new RegExp(`^${name}`) })
    .first();
async function chooseEdit(page, name) {
  await openEdit(page);
  const entry = editItem(page, name);
  await entry.waitFor({ timeout: 5_000 });
  await entry.click();
  await page.waitForTimeout(400);
}
const pasteKeys = async (page) => {
  await page.keyboard.press("ControlOrMeta+V");
  await page.waitForTimeout(400);
};

await run(async (page) => {
  await openDesktop(page, base, step);
  const library = await api(page, "GET", "/api/app-store/library");
  const got = await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(library.json?.installed ?? []), "script-editor"])],
    rev: library.json?.rev ?? 0,
  });
  step("Script Editor is got from the App Store", got.status === 200, `HTTP ${got.status}`);
  await reloadDesktop(page);
  await launch(page, "Script Editor");
  const window = page.locator('[data-window-id="script-editor"]').first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  const editor = window.getByRole("textbox", { name: "Script" });
  await editor.waitFor({ timeout: 10_000 });
  await caretAtEnd(editor);
  await page.keyboard.press("Enter");
  await page.keyboard.type(`// ${COPY} and ${CUT}`);

  await selectWord(editor, COPY);
  await chooseEdit(page, "Copy");
  await caretAtEnd(editor);
  await pasteKeys(page);
  step(
    "Edit > Copy puts the script's selection on the clipboard (the keyboard's Paste puts it in again)",
    (await count(editor, COPY)) === 2,
  );
  await chooseEdit(page, "Undo");
  step("Edit > Undo takes that paste back", (await count(editor, COPY)) === 1);
  await chooseEdit(page, "Redo");
  step("Edit > Redo puts it back", (await count(editor, COPY)) === 2);

  await selectWord(editor, CUT);
  await chooseEdit(page, "Cut");
  const gone = (await count(editor, CUT)) === 0;
  await caretAtEnd(editor);
  await pasteKeys(page);
  step(
    "Edit > Cut takes the selection out, and the keyboard pastes it back",
    gone && (await count(editor, CUT)) === 1,
  );

  await chooseEdit(page, "Select All");
  const all = await editor.evaluate((root) => {
    const flat = (text) => text.replace(/\s+/g, "");
    return {
      same: flat(root.ownerDocument.getSelection().toString()) === flat(root.textContent),
      keyboard: root.contains(root.ownerDocument.activeElement),
    };
  });
  step(
    "Edit > Select All selects the whole script, and the script keeps the keyboard",
    all.same && all.keyboard,
    JSON.stringify(all),
  );

  await caretAtEnd(editor);
  await openEdit(page);
  const paste = editItem(page, "Paste");
  await paste.waitFor({ timeout: 5_000 });
  if (pasteAllowed) {
    await paste.click();
    await page.waitForFunction(() => !document.querySelector('[role="menu"]'), undefined, {
      timeout: 5_000,
    });
    await page.waitForTimeout(400);
    step(
      "Edit > Paste reads the clipboard and puts it in the script",
      (await count(editor, CUT)) === 2,
    );
  } else {
    if ((await paste.getAttribute("aria-disabled")) !== "true") await paste.click();
    const reason = page.getByRole("menu").getByRole("menuitem", { name: /still pastes/ });
    await reason.waitFor({ timeout: 5_000 });
    step(
      "Edit > Paste, refused by this browser, is dimmed in the open menu, saying the keyboard still pastes",
      (await editItem(page, "Paste").getAttribute("aria-disabled")) === "true" &&
        (await count(editor, CUT)) === 1,
      await reason.innerText(),
    );
    await page.keyboard.press("Escape");
  }
  await shot(page, path.join(out, `script-editor-edit-${browserName}.png`));
});

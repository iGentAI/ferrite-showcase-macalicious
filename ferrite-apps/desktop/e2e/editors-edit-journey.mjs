#!/usr/bin/env node
// Editors on Ferrite: the Edit menu of the desktop's own menu bar in Notes, TextEdit and Stickies.
// In each app a fresh line is written, and from the menu bar: Copy (the keyboard's Paste then puts
// the word in again), Undo and Redo (that paste goes and comes back), Cut (the word goes, and the
// keyboard pastes it back), Select All (the whole text, the keyboard kept), and Paste. Paste reads
// the clipboard, which a browser may refuse to a menu: where this engine allows it (Firefox, and
// Chromium once the person grants clipboard access: --grant-clipboard) the clipboard goes in where
// the caret was; where it refuses (WebKit, Chromium without the grant) the menu stays open with
// Paste dimmed and the reason, and the keyboard's Paste still works. The server keeps every
// change, and a reload shows it. Exits 0 only when every step passed and the page logged no
// console error, page error, failed request or HTTP error.
//
//   ferrite dev                                   # in ferrite-apps/desktop
//   node e2e/editors-edit-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                     [--browser chromium|chrome|firefox|webkit] [--grant-clipboard]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { engineFamily } from "./journey-kit.mjs";

const { base, out, browserName } = options();
const grant =
  process.argv.includes("--grant-clipboard") && engineFamily(browserName) === "chromium";
const { step, run } = journey(
  "editors-edit",
  // The kit takes context options keyed by engine.
  grant
    ? { contextOptions: { chromium: { permissions: ["clipboard-read", "clipboard-write"] } } }
    : {},
);
/** Whether this engine lets a menu read the clipboard, as measured (evidence/h05/clipboard-*.json). */
const pasteAllowed = browserName === "firefox" || grant;
const stamp = String(Date.now()).slice(-6);
/** For each app a word to copy and a word to cut, which no other text holds. */
const WORDS = {
  Notes: { copy: `Quince${stamp}`, cut: `Sorrel${stamp}` },
  TextEdit: { copy: `Juniper${stamp}`, cut: `Tansy${stamp}` },
  Stickies: { copy: `Medlar${stamp}`, cut: `Borage${stamp}` },
};
const STORE = {
  Notes: "/api/notes/data",
  TextEdit: "/api/textedit/draft",
  Stickies: "/api/stickies/data",
};

/** Select `word` in the editor, focused, as a double click would. */
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
      const selection = root.ownerDocument.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
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
    range.collapse(Boolean(last));
    const selection = root.ownerDocument.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });

/** How many times the editor's text holds `word`. */
const count = (editor, word) =>
  editor.evaluate((root, wanted) => root.textContent.split(wanted).length - 1, word);
const occurrences = (text, word) => text.split(word).length - 1;

const openEdit = (page) =>
  page.getByRole("menubar").first().getByRole("menuitem", { name: "Edit", exact: true }).click();
/** The app's own item of the open Edit menu (the desktop's dimmed rows, if any, come after it). */
const editItem = (page, name) =>
  page
    .getByRole("menu")
    .getByRole("menuitem", { name: new RegExp(`^${name}`) })
    .first();
/** Choose `name` from the menu bar's Edit menu, as a person does; the menu closes. */
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

/** Every Edit command on the app's text, from the desktop's menu bar. */
async function exercise(page, app, editor) {
  const { copy, cut } = WORDS[app];

  await selectWord(editor, copy);
  await chooseEdit(page, "Copy");
  await caretAtEnd(editor);
  await pasteKeys(page);
  step(
    `${app}: Edit > Copy puts the selection on the clipboard (the keyboard's Paste puts it in again)`,
    (await count(editor, copy)) === 2,
  );
  await chooseEdit(page, "Undo");
  step(
    `${app}: Edit > Undo takes that paste back`,
    (await count(editor, copy)) === 1,
    await editor.evaluate((root) => root.textContent),
  );
  await chooseEdit(page, "Redo");
  step(`${app}: Edit > Redo puts it back`, (await count(editor, copy)) === 2);

  await selectWord(editor, cut);
  await chooseEdit(page, "Cut");
  const gone = (await count(editor, cut)) === 0;
  await caretAtEnd(editor);
  await pasteKeys(page);
  step(
    `${app}: Edit > Cut takes the selection out, and the keyboard pastes it back`,
    gone && (await count(editor, cut)) === 1,
  );

  await chooseEdit(page, "Select All");
  const all = await editor.evaluate((root) => {
    const flat = (text) => text.replace(/\s+/g, "");
    const document = root.ownerDocument;
    return {
      selected: flat(document.getSelection().toString()),
      text: flat(root.textContent),
      keyboard: root.contains(document.activeElement),
    };
  });
  step(
    `${app}: Edit > Select All selects the whole text, and the text keeps the keyboard`,
    all.selected === all.text && all.text.length > 0 && all.keyboard,
    JSON.stringify({ keyboard: all.keyboard, same: all.selected === all.text }),
  );

  // Paste from the menu: the word cut last is on the clipboard.
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
      `${app}: Edit > Paste reads the clipboard and puts it in where the caret was`,
      (await count(editor, cut)) === 2,
    );
  } else {
    // A page remembers the refusal: in the second and third app Paste is already dimmed.
    if ((await paste.getAttribute("aria-disabled")) !== "true") await paste.click();
    const reason = page.getByRole("menu").getByRole("menuitem", { name: /still pastes/ });
    await reason.waitFor({ timeout: 5_000 });
    step(
      `${app}: Edit > Paste, refused by this browser, is dimmed in the open menu, saying the keyboard still pastes`,
      (await editItem(page, "Paste").getAttribute("aria-disabled")) === "true" &&
        (await reason.isVisible()) &&
        (await count(editor, cut)) === 1,
      await reason.innerText(),
    );
    await shot(page, path.join(out, `edit-${browserName}-${app.toLowerCase()}-paste-refused.png`));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await caretAtEnd(editor);
    await pasteKeys(page);
    step(`${app}: and the keyboard's Paste still works`, (await count(editor, cut)) === 2);
  }

  await page.waitForTimeout(2500);
  const stored = JSON.stringify((await api(page, "GET", STORE[app])).json ?? {});
  step(
    `${app}: the server keeps the text as edited from the menu`,
    occurrences(stored, copy) >= 2 && occurrences(stored, cut) >= 2,
  );
  await shot(page, path.join(out, `edit-${browserName}-${app.toLowerCase()}.png`));
}

await run(async (page) => {
  await openDesktop(page, base, step);

  // Notes: a new note.
  await launch(page, "Notes");
  const notesWindow = page.getByRole("region", { name: "Notes" }).first();
  await notesWindow.waitFor({ timeout: 15_000 });
  await notesWindow.getByRole("button", { name: "New Note" }).click();
  const note = page.locator('[role="textbox"][aria-label="Note"]:visible').first();
  await note.waitFor({ timeout: 10_000 });
  await note.click();
  await page.keyboard.type(`Edit journey ${stamp}`);
  await page.keyboard.press("Enter");
  await page.keyboard.type(`${WORDS.Notes.copy} and ${WORDS.Notes.cut} words`);
  await exercise(page, "Notes", note);

  // TextEdit: the document, written afresh.
  await launch(page, "TextEdit");
  await page.waitForFunction(
    () => {
      const body = document.querySelector(".mac-textedit-body");
      return body && !body.hasAttribute("inert");
    },
    undefined,
    { timeout: 15_000 },
  );
  const textDocument = page
    .locator(".mac-textedit")
    .getByRole("textbox", { name: "Document" })
    .first();
  await textDocument.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await page.keyboard.type(`${WORDS.TextEdit.copy} and ${WORDS.TextEdit.cut} words`);
  await exercise(page, "TextEdit", textDocument);

  // Stickies: the first note, written afresh.
  await launch(page, "Stickies");
  const firstNote = page.locator(".mac-stickies-note").first();
  await firstNote.waitFor({ state: "visible", timeout: 15_000 });
  const sticky = firstNote.getByRole("textbox").first();
  await sticky.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await page.keyboard.type("Shopping");
  await page.keyboard.press("Enter");
  await page.keyboard.type(`${WORDS.Stickies.copy} and ${WORDS.Stickies.cut} jam`);
  await exercise(page, "Stickies", sticky);

  // A reload: each app shows its text as the Edit menu left it.
  await reloadDesktop(page);
  await launch(page, "Notes");
  await page.getByRole("region", { name: "Notes" }).first().waitFor({ timeout: 15_000 });
  const shownNote = page.locator('[role="textbox"][aria-label="Note"]:visible').first();
  await shownNote.waitFor({ timeout: 10_000 });
  step(
    "Notes: after a reload the note holds both words twice",
    (await count(shownNote, WORDS.Notes.copy)) === 2 &&
      (await count(shownNote, WORDS.Notes.cut)) === 2,
  );
  await launch(page, "TextEdit");
  await page.waitForFunction(
    () => {
      const body = document.querySelector(".mac-textedit-body");
      return body && !body.hasAttribute("inert");
    },
    undefined,
    { timeout: 15_000 },
  );
  step(
    "TextEdit: after a reload the document holds both words twice",
    (await count(textDocument, WORDS.TextEdit.copy)) === 2 &&
      (await count(textDocument, WORDS.TextEdit.cut)) === 2,
  );
  await launch(page, "Stickies");
  const stickyAgain = page
    .locator(".mac-stickies-note")
    .filter({ hasText: WORDS.Stickies.copy })
    .first()
    .getByRole("textbox")
    .first();
  await stickyAgain.waitFor({ state: "visible", timeout: 15_000 });
  step(
    "Stickies: after a reload the note holds both words twice",
    (await count(stickyAgain, WORDS.Stickies.copy)) === 2 &&
      (await count(stickyAgain, WORDS.Stickies.cut)) === 2,
  );
});

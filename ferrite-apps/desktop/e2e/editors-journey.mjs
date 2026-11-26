#!/usr/bin/env node
// Editors on Ferrite: the commands of the desktop's own menu bar on the shared rich-text path, in
// Notes, TextEdit and Stickies. In each app a fresh line is written and one word of it selected;
// the word is styled from the menu bar (Notes: Format > Font > Bold; TextEdit: Format > Font >
// Italic and Format > Text > Center; Stickies: Font > Underline and Color > Blue); the window
// must then still have the keyboard with the word selected (an arrow key and a letter land right
// after it); and after a reload the app shows the word with its style, read back from the
// session's store on the server as well. Exits 0 only when every step passed and the page logged
// no console error, page error, failed request or HTTP error.
//
//   ferrite dev                                   # in ferrite-apps/desktop
//   node e2e/editors-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                [--browser chromium|chrome|firefox|webkit]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("editors");
const stamp = String(Date.now()).slice(-6);
/** A word for each app that no other text holds. */
const WORD = {
  notes: `Quillwort${stamp}`,
  textedit: `Sedgewick${stamp}`,
  stickies: `Bramble${stamp}`,
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

/** The style of the text that holds `word`, and the alignment of its line; `null` without it. */
const styleOf = (editor, word) =>
  editor.evaluate((root, wanted) => {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.nodeValue.includes(wanted)) continue;
      const element = node.parentElement;
      const style = getComputedStyle(element);
      let underline = false;
      let line = element;
      for (let at = element; at && at !== root; at = at.parentElement) {
        if (/underline/.test(getComputedStyle(at).textDecorationLine)) underline = true;
        if (at.parentElement === root) line = at;
      }
      return {
        bold: Number(style.fontWeight) >= 600 || style.fontWeight === "bold",
        italic: /italic|oblique/.test(style.fontStyle),
        underline,
        align: getComputedStyle(line).textAlign,
      };
    }
    return null;
  }, word);

/** Whether the editor's text holds `text`. */
const holds = (editor, text) =>
  editor.evaluate((root, wanted) => root.textContent.includes(wanted), text);

/**
 * Choose `item` of the desktop menu bar's menu `menu`, through its submenu `submenu` when given,
 * as a person does: a click on the menu's title, the pointer over the submenu's item, a click on
 * the command.
 */
async function chooseFromMenuBar(page, menu, item, submenu) {
  await page
    .getByRole("menubar")
    .first()
    .getByRole("menuitem", { name: menu, exact: true })
    .click();
  if (submenu) {
    const trigger = page.getByRole("menuitem", { name: submenu, exact: true });
    await trigger.waitFor({ timeout: 5_000 });
    await trigger.hover();
  }
  const entry = page
    .getByRole("menuitem", { name: item, exact: true })
    .or(page.getByRole("menuitemcheckbox", { name: item, exact: true }))
    .or(page.getByRole("menuitemradio", { name: item, exact: true }))
    .last();
  await entry.waitFor({ timeout: 5_000 });
  await entry.click();
  // The menu closes and the window takes the keyboard back.
  await page.waitForTimeout(400);
}

/**
 * After a menu command: the keyboard is the editor's again, with the word still selected. The
 * right arrow puts the insertion point after it and a letter typed there lands right after the
 * word.
 */
async function keepsKeyboard(page, editor, word, label) {
  await page.keyboard.press("ArrowRight");
  await page.keyboard.type("Z");
  step(
    `${label}: the window keeps the keyboard and the selection`,
    await holds(editor, `${word}Z`),
  );
  await page.keyboard.press("Backspace");
}

/** The session's store of `url` holds `word`, with `pattern` after it in the stored text. */
async function stored(page, url, word, pattern) {
  const answer = await api(page, "GET", url);
  const text = JSON.stringify(answer.json);
  return { ok: answer.status === 200 && text.includes(word) && pattern.test(text), text };
}

await run(async (page) => {
  await openDesktop(page, base, step);

  // Notes: Format > Font > Bold.
  await launch(page, "Notes");
  const notesWindow = page.getByRole("region", { name: "Notes" }).first();
  await notesWindow.waitFor({ timeout: 15_000 });
  await notesWindow.getByRole("button", { name: "New Note" }).click();
  const note = page.locator('[role="textbox"][aria-label="Note"]:visible').first();
  await note.waitFor({ timeout: 10_000 });
  await note.click();
  await page.keyboard.type(`Menu journey ${stamp}`);
  await page.keyboard.press("Enter");
  await page.keyboard.type(`${WORD.notes} stays plain`);
  await selectWord(note, WORD.notes);
  await chooseFromMenuBar(page, "Format", "Bold", "Font");
  step(
    "Notes: Format > Font > Bold in the desktop menu bar makes the selected word bold",
    (await styleOf(note, WORD.notes))?.bold === true,
  );
  await keepsKeyboard(page, note, WORD.notes, "Notes");
  await page.waitForTimeout(2500);
  const notesSaved = await stored(page, "/api/notes/data", WORD.notes, /font-weight|<b>|<strong>/);
  step("Notes: the server keeps the note with its bold word", notesSaved.ok);
  await shot(page, path.join(out, `editors-${browserName}-notes.png`));

  // TextEdit: Format > Font > Italic and Format > Text > Center.
  await launch(page, "TextEdit");
  const ready = () =>
    page.waitForFunction(
      () => {
        const body = document.querySelector(".mac-textedit-body");
        return body && !body.hasAttribute("inert");
      },
      undefined,
      { timeout: 15_000 },
    );
  await ready();
  const document = page.locator(".mac-textedit").getByRole("textbox", { name: "Document" }).first();
  await document.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await page.keyboard.type(`${WORD.textedit} on a centred line`);
  await selectWord(document, WORD.textedit);
  await chooseFromMenuBar(page, "Format", "Italic", "Font");
  step(
    "TextEdit: Format > Font > Italic in the desktop menu bar makes the selected word italic",
    (await styleOf(document, WORD.textedit))?.italic === true,
  );
  await keepsKeyboard(page, document, WORD.textedit, "TextEdit");
  await chooseFromMenuBar(page, "Format", "Center", "Text");
  step(
    "TextEdit: Format > Text > Center in the desktop menu bar centres the line",
    (await styleOf(document, WORD.textedit))?.align === "center",
  );
  await page.waitForTimeout(2500);
  const draftSaved = await stored(page, "/api/textedit/draft", WORD.textedit, /italic/);
  step("TextEdit: the server keeps the document with its italic word", draftSaved.ok);
  await shot(page, path.join(out, `editors-${browserName}-textedit.png`));

  // Stickies: Font > Underline and Color > Blue.
  await launch(page, "Stickies");
  const firstNote = page.locator(".mac-stickies-note").first();
  await firstNote.waitFor({ state: "visible", timeout: 15_000 });
  const sticky = firstNote.getByRole("textbox").first();
  await sticky.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await page.keyboard.type("Shopping");
  await page.keyboard.press("Enter");
  await page.keyboard.type(`${WORD.stickies} jam`);
  await selectWord(sticky, WORD.stickies);
  await chooseFromMenuBar(page, "Font", "Underline");
  step(
    "Stickies: Font > Underline in the desktop menu bar underlines the selected word",
    (await styleOf(sticky, WORD.stickies))?.underline === true,
  );
  await keepsKeyboard(page, sticky, WORD.stickies, "Stickies");
  await chooseFromMenuBar(page, "Color", "Blue");
  await page.waitForTimeout(2500);
  const stickiesSaved = await stored(page, "/api/stickies/data", WORD.stickies, /"color":"blue"/);
  step("Stickies: Color > Blue colours the note, and the server keeps it blue", stickiesSaved.ok);
  await shot(page, path.join(out, `editors-${browserName}-stickies.png`));

  // A reload: each app shows its word with the style chosen from the menu bar.
  await reloadDesktop(page);
  await launch(page, "Notes");
  await page.getByRole("region", { name: "Notes" }).first().waitFor({ timeout: 15_000 });
  const noteAgain = page.locator('[role="textbox"][aria-label="Note"]:visible').first();
  await noteAgain.waitFor({ timeout: 10_000 });
  step(
    "Notes: after a reload the word is still bold",
    (await styleOf(noteAgain, WORD.notes))?.bold === true,
  );
  await launch(page, "TextEdit");
  await ready();
  const after = await styleOf(document, WORD.textedit);
  step(
    "TextEdit: after a reload the word is still italic on a centred line",
    after?.italic === true && after?.align === "center",
    JSON.stringify(after),
  );
  await launch(page, "Stickies");
  const stickyAgain = page.locator(".mac-stickies-note").filter({ hasText: WORD.stickies }).first();
  await stickyAgain.waitFor({ state: "visible", timeout: 15_000 });
  step(
    "Stickies: after a reload the word is still underlined on a blue note",
    (await styleOf(stickyAgain.getByRole("textbox").first(), WORD.stickies))?.underline === true &&
      (await stickyAgain.getAttribute("data-color")) === "blue",
    `data-color=${await stickyAgain.getAttribute("data-color")}`,
  );
  await shot(page, path.join(out, `editors-${browserName}-after-reload.png`));
});

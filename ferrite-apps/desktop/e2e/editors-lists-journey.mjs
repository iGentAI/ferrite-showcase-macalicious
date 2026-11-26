#!/usr/bin/env node
// Notes on Ferrite: bulleted and numbered lists. In a new note three lines become a bulleted list
// from the desktop menu bar's Format > Bulleted List; Return continues the list and Return on an
// empty item ends it; Tab indents an item a level and Shift-Tab outdents it; Format > Numbered List
// changes the list's kind, and chosen again takes the lines out of the list. A nested bulleted
// list is then kept by the server, shown again after a reload, and shown by a second window of the
// session. Exits 0 only when every step passed and the page logged no console error, page error,
// failed request or HTTP error.
//
//   ferrite dev                                   # in ferrite-apps/desktop
//   node e2e/editors-lists-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                      [--browser chromium|chrome|firefox|webkit]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("editors-lists");
const stamp = String(Date.now()).slice(-6);
const FIRST = `Alpha${stamp}`;
const AFTER = `After${stamp}`;

const shownNote = (page) => page.locator('[role="textbox"][aria-label="Note"]:visible').first();

/** Select from the start of the text `from` to the end of the text `to`, the note focused. */
const selectBetween = (editor, from, to) =>
  editor.evaluate(
    (root, [start, end]) => {
      const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let first = null;
      let last = null;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!first && node.nodeValue.includes(start)) first = node;
        if (node.nodeValue.includes(end)) last = node;
      }
      if (!first || !last) return false;
      root.focus();
      const range = root.ownerDocument.createRange();
      range.setStart(first, first.nodeValue.indexOf(start));
      range.setEnd(last, last.nodeValue.indexOf(end) + end.length);
      root.ownerDocument.getSelection().removeAllRanges();
      root.ownerDocument.getSelection().addRange(range);
      return true;
    },
    [from, to],
  );

/** Put the insertion point at the end of the text `word`, the note focused. */
const caretAfter = (editor, word) =>
  editor.evaluate((root, wanted) => {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.nodeValue.indexOf(wanted);
      if (at < 0) continue;
      root.focus();
      const range = root.ownerDocument.createRange();
      range.setStart(node, at + wanted.length);
      range.collapse(true);
      root.ownerDocument.getSelection().removeAllRanges();
      root.ownerDocument.getSelection().addRange(range);
      return true;
    }
    return false;
  }, word);

/** The lists around the text `word`: their tags, innermost first ("UL", "OL"), and the item's. */
const listsAround = (editor, word) =>
  editor.evaluate((root, wanted) => {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.nodeValue.includes(wanted)) continue;
      const lists = [];
      let item = false;
      for (let at = node.parentNode; at && at !== root; at = at.parentNode) {
        if (at.nodeName === "UL" || at.nodeName === "OL") lists.push(at.nodeName);
        if (at.nodeName === "LI") item = true;
      }
      return { lists, item };
    }
    return null;
  }, word);

/** Choose `item` of the desktop menu bar's Format menu, as a person does. */
async function chooseFormat(page, item) {
  await page
    .getByRole("menubar")
    .first()
    .getByRole("menuitem", { name: "Format", exact: true })
    .click();
  const entry = page
    .getByRole("menu")
    .getByRole("menuitemcheckbox", { name: new RegExp(`^${item}`) })
    .first();
  await entry.waitFor({ timeout: 5_000 });
  await entry.click();
  await page.waitForTimeout(400);
}

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Notes");
  const notesWindow = page.getByRole("region", { name: "Notes" }).first();
  await notesWindow.waitFor({ timeout: 15_000 });
  await notesWindow.getByRole("button", { name: "New Note" }).click();
  const note = shownNote(page);
  await note.waitFor({ timeout: 10_000 });
  await note.click();
  await page.keyboard.type(`Lists journey ${stamp}`);
  for (const line of [FIRST, "Beta", "Gamma"]) {
    await page.keyboard.press("Enter");
    await page.keyboard.type(line);
  }

  await selectBetween(note, FIRST, "Gamma");
  await chooseFormat(page, "Bulleted List");
  const made = await Promise.all([FIRST, "Beta", "Gamma"].map((word) => listsAround(note, word)));
  step(
    "Format > Bulleted List makes the three lines a bulleted list",
    made.every((each) => each?.item && each.lists.join() === "UL"),
    JSON.stringify(made),
  );

  await caretAfter(note, "Gamma");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Delta");
  step("Return continues the list", (await listsAround(note, "Delta"))?.item === true);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type(AFTER);
  step("Return on an empty item ends the list", (await listsAround(note, AFTER))?.item === false);

  await caretAfter(note, "Beta");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(200);
  const indented = await listsAround(note, "Beta");
  step("Tab indents the item a level", indented?.lists.length === 2, JSON.stringify(indented));
  await page.keyboard.press("Shift+Tab");
  await page.waitForTimeout(200);
  const outdented = await listsAround(note, "Beta");
  step("Shift-Tab outdents it again", outdented?.lists.length === 1, JSON.stringify(outdented));

  await selectBetween(note, FIRST, "Delta");
  await chooseFormat(page, "Numbered List");
  step(
    "Format > Numbered List makes it a numbered list",
    (await listsAround(note, FIRST))?.lists.join() === "OL" &&
      (await listsAround(note, "Delta"))?.lists.join() === "OL",
  );
  await selectBetween(note, FIRST, "Delta");
  await chooseFormat(page, "Numbered List");
  step(
    "Format > Numbered List chosen again takes the lines out of the list",
    (await listsAround(note, FIRST))?.lists.length === 0 &&
      (await listsAround(note, "Delta"))?.lists.length === 0,
  );

  // A nested bulleted list, kept.
  await selectBetween(note, FIRST, "Delta");
  await chooseFormat(page, "Bulleted List");
  await caretAfter(note, "Beta");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(2500);
  const stored = (await api(page, "GET", "/api/notes/data")).json?.data?.notes ?? [];
  const saved = stored.find((each) => each.lines?.[0] === `Lists journey ${stamp}`);
  step(
    "the server keeps the nested bulleted list",
    (saved?.html?.match(/<ul/g)?.length ?? 0) >= 2 && saved.html.includes(FIRST),
    saved?.html?.slice(0, 160),
  );
  await shot(page, path.join(out, `lists-${browserName}.png`));

  await reloadDesktop(page);
  await launch(page, "Notes");
  await page.getByRole("region", { name: "Notes" }).first().waitFor({ timeout: 15_000 });
  await page
    .getByRole("option", { name: new RegExp(`^Lists journey ${stamp}`) })
    .first()
    .click();
  const reloaded = await listsAround(shownNote(page), "Beta");
  step(
    "after a reload the note shows the nested list",
    reloaded?.lists.length === 2 &&
      (await listsAround(shownNote(page), FIRST))?.lists.join() === "UL",
    JSON.stringify(reloaded),
  );

  const second = await page.context().newPage();
  await openDesktop(second, base, step);
  await launch(second, "Notes");
  await second.getByRole("region", { name: "Notes" }).first().waitFor({ timeout: 15_000 });
  await second
    .getByRole("option", { name: new RegExp(`^Lists journey ${stamp}`) })
    .first()
    .click();
  const there = await listsAround(shownNote(second), "Beta");
  step("a second window shows the nested list", there?.lists.length === 2, JSON.stringify(there));
  await second.close();
});

#!/usr/bin/env node
// TextEdit's Format > Text > Writing Direction, Copy Ruler and Paste Ruler on the desktop: each is
// chosen from the menu bar and read back from the page, Undo and Redo take back only it, typing keeps
// the browser's own Undo, and a direction survives a reload.
//
//   node e2e/textedit-direction-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("textedit-direction");

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await openDesktop(page, base, step);
  await launch(page, "TextEdit");
  const window = page.locator('[data-window-id^="textedit"]').first();
  const text = window.getByRole("textbox", { name: "Document" });
  await text.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
  const bar = page.getByRole("menubar");
  const choose = async (...names) => {
    await bar.getByRole("menuitem", { name: names[0], exact: true }).click();
    await page.waitForTimeout(200);
    for (const name of names.slice(1)) {
      await page
        .getByRole("menuitem", { name: new RegExp(`^${name}`) })
        .last()
        .click();
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(250);
  };
  const typeFresh = async (words) => {
    await text.click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type(words);
    await page.keyboard.press("ControlOrMeta+A");
    await page.waitForTimeout(150);
  };
  const directionHere = () =>
    text.evaluate((node) => {
      const at = document.createTreeWalker(node, NodeFilter.SHOW_TEXT).nextNode();
      return getComputedStyle(at?.parentElement ?? node).direction;
    });
  const allText = () => text.evaluate((node) => node.innerText.trim());
  /** Selects the first text node holding `word`. */
  const selectWord = (word) =>
    text.evaluate((node, wanted) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      for (let at = walker.nextNode(); at; at = walker.nextNode()) {
        const from = at.nodeValue.indexOf(wanted);
        if (from < 0) continue;
        const range = document.createRange();
        range.setStart(at, from);
        range.setEnd(at, from + wanted.length);
        node.focus();
        const selection = document.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
    }, word);

  await typeFresh("Typed words");
  await choose("Format", "Text", "Writing Direction", "Right to Left");
  step("Writing Direction > Right to Left", (await directionHere()) === "rtl");
  await text.focus();
  await page.keyboard.press("ControlOrMeta+Z");
  await page.waitForTimeout(200);
  step(
    "Undo by key takes the direction back and leaves the typing",
    (await directionHere()) === "ltr" && (await allText()) === "Typed words",
    `${await directionHere()} ${await allText()}`,
  );
  await page.keyboard.press("ControlOrMeta+Shift+Z");
  await page.waitForTimeout(200);
  step("Redo by key gives Right to Left again", (await directionHere()) === "rtl");
  await choose("Edit", "Undo");
  step("Edit > Undo takes it back", (await directionHere()) === "ltr");
  await choose("Edit", "Redo");
  step("Edit > Redo gives it again", (await directionHere()) === "rtl");
  await choose("Format", "Text", "Writing Direction", "Left to Right");
  await choose("Format", "Text", "Writing Direction", "Right to Left");
  step(
    "changing it again and again leaves one paragraph",
    await text.evaluate((node) => node.querySelectorAll("[dir] [dir]").length === 0),
    await text.evaluate((node) => node.innerHTML),
  );

  // What was typed after a change is the browser's to take back first, and it still can.
  await text.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(" more");
  await page.waitForTimeout(200);
  await page.keyboard.press("ControlOrMeta+Z");
  await page.waitForTimeout(200);
  step(
    "Undo after typing takes back the typing and keeps the direction",
    !(await allText()).includes("more") && (await directionHere()) === "rtl",
    `${await allText()} ${await directionHere()}`,
  );

  await typeFresh("\u0645\u0631\u062d\u0628\u0627");
  await choose("Format", "Text", "Writing Direction", "Natural");
  step("Natural follows Arabic text", (await directionHere()) === "rtl");
  await typeFresh("Latin text");
  await choose("Format", "Text", "Writing Direction", "Natural");
  step("Natural follows Latin text", (await directionHere()) === "ltr");

  // The ruler, from a right-to-left, centred paragraph to another.
  await typeFresh("Source");
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Target");
  await selectWord("Source");
  await choose("Format", "Text", "Writing Direction", "Right to Left");
  await selectWord("Source");
  await choose("Format", "Text", "Center");
  await selectWord("Source");
  await choose("Format", "Text", "Copy Ruler");
  const targetLook = () =>
    text.evaluate((node) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let at = walker.nextNode();
      while (at && !at.nodeValue.includes("Target")) at = walker.nextNode();
      const style = getComputedStyle(at.parentElement);
      return `${style.direction} ${style.textAlign}`;
    });
  await selectWord("Target");
  const before = await targetLook();
  await choose("Format", "Text", "Paste Ruler");
  step(
    "Paste Ruler gives the direction and alignment",
    (await targetLook()) === "rtl center",
    await targetLook(),
  );
  await bar.getByRole("menuitem", { name: "Format", exact: true }).click();
  await page.waitForTimeout(200);
  await page.getByRole("menuitem", { name: /^Text/ }).last().hover();
  await page.waitForTimeout(350);
  await page
    .getByRole("menuitem", { name: /^Writing Direction/ })
    .last()
    .hover();
  await page.waitForTimeout(350);
  await shot(page, path.join(out, "textedit-direction.png"));
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await text.focus();
  await page.keyboard.press("ControlOrMeta+Z");
  await page.waitForTimeout(200);
  step("Undo takes Paste Ruler back", (await targetLook()) === before, await targetLook());
  await page.keyboard.press("ControlOrMeta+Shift+Z");
  await page.waitForTimeout(200);
  step("Redo gives Paste Ruler again", (await targetLook()) === "rtl center", await targetLook());

  await page.waitForTimeout(1500);
  await reloadDesktop(page);
  await launch(page, "TextEdit");
  await text.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(1000);
  step(
    "after a reload the paragraphs keep their direction",
    (await targetLook()) === "rtl center",
    await targetLook(),
  );
});

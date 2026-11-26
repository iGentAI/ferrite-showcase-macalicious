#!/usr/bin/env node
// Batch 18: TextEdit's disjoint selection, with a real Command-drag: Format commands, Copy, typing, Delete and Undo at
// every range, and how a plain click ends it.
//
//   node e2e/rows-batch18-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { journey, launch, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("rows-batch18", {
  contextOptions: { chromium: { permissions: ["clipboard-read", "clipboard-write"] } },
});
const KEY = "ControlOrMeta";
const META = process.platform === "darwin" ? "Meta" : "Control";

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await openDesktop(page, base, step);
  await launch(page, "TextEdit");
  const doc = page.locator('[data-window-id^="textedit"]').first();
  const text = doc.getByRole("textbox", { name: "Document" });
  await text.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500);
  const bar = page.getByRole("menubar");
  const menu = async (name) => {
    await bar.getByRole("menuitem", { name, exact: true }).click();
    await page.waitForTimeout(250);
  };

  const content = () =>
    text.evaluate((node) => [...node.childNodes].map((each) => each.textContent).join("|"));
  const start = async (lines) => {
    await text.click({ position: { x: 12, y: 12 } });
    await page.keyboard.press(`${KEY}+A`);
    await page.keyboard.press("Backspace");
    await page.keyboard.type(lines.join("\n"));
    await page.waitForTimeout(150);
  };
  /** The screen box of `word`, its first match in the view. */
  const boxOf = (word) =>
    text.evaluate((node, wanted) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      for (let at = walker.nextNode(); at; at = walker.nextNode()) {
        const found = at.data.indexOf(wanted);
        if (found < 0) continue;
        const range = document.createRange();
        range.setStart(at, found);
        range.setEnd(at, found + wanted.length);
        const { left, right, top, height } = range.getBoundingClientRect();
        return { left, right, y: top + height / 2 };
      }
      return null;
    }, word);
  const drag = async (word, held) => {
    const box = await boxOf(word);
    if (held) await page.keyboard.down(META);
    await page.mouse.move(box.left + 0.5, box.y);
    await page.mouse.down();
    await page.mouse.move((box.left + box.right) / 2, box.y, { steps: 2 });
    await page.mouse.move(box.right - 0.5, box.y, { steps: 2 });
    await page.mouse.up();
    if (held) await page.keyboard.up(META);
    await page.waitForTimeout(120);
  };
  const selectWords = async (first, ...more) => {
    await drag(first, false);
    for (const word of more) await drag(word, true);
  };
  const highlighted = () =>
    page.evaluate(() =>
      [...(CSS.highlights.get("mac-textedit-disjoint") ?? [])]
        .map((range) => range.toString())
        .sort(),
    );
  const nativeText = () => page.evaluate(() => document.getSelection().toString());
  const paint = (word) =>
    text.evaluate((node, wanted) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      for (let at = walker.nextNode(); at; at = walker.nextNode()) {
        if (at.data.includes(wanted)) {
          return getComputedStyle(at.parentElement).fontWeight;
        }
      }
      return "";
    }, word);
  const styled = () => text.evaluate((node) => node.innerHTML);

  // Select by Command-drag.
  await start(["alpha beta gamma", "delta epsilon zeta", "eta theta iota"]);
  await selectWords("beta", "epsilon", "theta");
  step(
    "Command-drag adds ranges: two kept and drawn, the last the browser's",
    JSON.stringify(await highlighted()) === '["beta","epsilon"]' &&
      (await nativeText()) === "theta",
    `${JSON.stringify(await highlighted())} + ${await nativeText()}`,
  );
  await shot(page, path.join(out, "rows-batch18-textedit-selected.png"));

  // Format: Bold by the key, on all three.
  await page.keyboard.press(`${KEY}+B`);
  await page.waitForTimeout(150);
  const bold = [];
  for (const word of ["beta", "epsilon", "theta"]) bold.push(await paint(word));
  step(
    "⌘B makes every range bold",
    bold.every((each) => Number(each) >= 700),
    bold.join(","),
  );
  const between = await text.evaluate((node) =>
    [...node.querySelectorAll("b, strong, [style*='font-weight']")].map((e) => e.textContent),
  );
  step(
    "Only the ranges are bold",
    JSON.stringify(between) === '["beta","epsilon","theta"]',
    JSON.stringify(between),
  );
  step(
    "The selection stands after the command",
    JSON.stringify(await highlighted()) === '["beta","epsilon"]' &&
      (await nativeText()) === "theta",
  );
  await shot(page, path.join(out, "rows-batch18-textedit-bold.png"));

  // Format > Font > Underline from the menu bar: a menu leaves the ranges in place.
  await menu("Format");
  await page.getByRole("menuitem", { name: "Font", exact: true }).last().hover();
  await page
    .getByRole("menuitem", { name: /^Underline/ })
    .last()
    .click();
  await page.waitForTimeout(250);
  const underlined = await text.evaluate((node) =>
    [...node.querySelectorAll("u, [style*='underline']")].map((e) => e.textContent),
  );
  step(
    "Format > Font > Underline acts on every range",
    JSON.stringify(underlined) === '["beta","epsilon","theta"]',
    JSON.stringify(underlined),
  );

  // Undo takes the whole change back in one step, and leaves what was there before it.
  const beforeUndo = await styled();
  await page.keyboard.press(`${KEY}+Z`);
  await page.waitForTimeout(200);
  const afterUndo = await text.evaluate(
    (node) => [...node.querySelectorAll("u, [style*='underline']")].length,
  );
  const stillBold = await text.evaluate(
    (node) => [...node.querySelectorAll("b, strong, [style*='font-weight']")].length,
  );
  step("One Undo takes back Underline at all three", afterUndo === 0 && stillBold === 3);
  await page.keyboard.press(`Shift+${KEY}+Z`);
  await page.waitForTimeout(200);
  step(
    "One Redo puts it back",
    (await styled()).replace(/\s/g, "") === beforeUndo.replace(/\s/g, ""),
  );

  // Copy: each range on its own line, in document order, whatever order they were made in.
  await start(["alpha beta gamma", "delta epsilon zeta"]);
  await selectWords("zeta", "beta");
  await page.keyboard.press(`${KEY}+C`);
  await page.waitForTimeout(150);
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  step("Copy takes every range in document order", copied === "beta\nzeta", JSON.stringify(copied));

  // Typing replaces every range, and goes on at each.
  await page.keyboard.type("X");
  await page.waitForTimeout(120);
  step(
    "A key replaces every range",
    (await content()) === "alpha X gamma|delta epsilon X",
    await content(),
  );
  const carets = page.locator(".mac-textedit-disjoint-caret");
  step("The other range shows an insertion point", (await carets.count()) === 1);
  await shot(page, path.join(out, "rows-batch18-textedit-carets.png"));
  await page.keyboard.type("yz");
  await page.waitForTimeout(120);
  step(
    "Typing goes on at each",
    (await content()) === "alpha Xyz gamma|delta epsilon Xyz",
    await content(),
  );
  await page.keyboard.press("Backspace");
  await page.waitForTimeout(120);
  step(
    "Backspace deletes at each",
    (await content()) === "alpha Xy gamma|delta epsilon Xy",
    await content(),
  );
  await page.keyboard.press("Enter");
  await page.waitForTimeout(120);
  const shown = await text.evaluate((node) => node.innerText.replace(/\u00a0/g, " "));
  step(
    "Return breaks the line at each",
    shown.trimEnd() === "alpha Xy\n gamma\ndelta epsilon Xy",
    JSON.stringify(shown),
  );

  // A plain click ends it.
  await page.mouse.click((await boxOf("alpha")).left + 4, (await boxOf("alpha")).y);
  await page.waitForTimeout(150);
  step(
    "A plain click ends the disjoint selection",
    (await highlighted()).length === 0 && (await carets.count()) === 0,
  );

  // A typing run undone in one step, leaving what was typed before the selection.
  await start(["one two three"]);
  await selectWords("one", "three");
  await page.keyboard.type("ab");
  await page.waitForTimeout(120);
  step(
    "Two ranges on one line take the typing",
    (await content()) === "ab two ab",
    await content(),
  );
  await page.keyboard.press(`${KEY}+Z`);
  await page.waitForTimeout(200);
  step("One Undo brings both words back", (await content()) === "one two three", await content());

  // Delete from the Edit menu, then Cut by the key.
  await start(["one two three four"]);
  await selectWords("one", "three");
  await menu("Edit");
  await page.getByRole("menuitem", { name: "Delete", exact: true }).last().click();
  await page.waitForTimeout(350);
  step("Edit > Delete deletes every range", (await content()) === " two  four", await content());

  await start(["one two three four"]);
  await selectWords("two", "four");
  await page.keyboard.press(`${KEY}+X`);
  await page.waitForTimeout(200);
  const cut = await page.evaluate(() => navigator.clipboard.readText());
  step(
    "Cut takes every range to the clipboard and out of the text",
    (await content()) === "one  three " && cut === "two\nfour",
    `${await content()} / ${JSON.stringify(cut)}`,
  );

  // Paste by the key goes to every range.
  await page.evaluate(() => navigator.clipboard.writeText("QQ"));
  await start(["one two three"]);
  await selectWords("one", "three");
  await page.keyboard.press(`${KEY}+V`);
  await page.waitForTimeout(250);
  step("⌘V pastes at every range", (await content()) === "QQ two QQ", await content());

  // Command-drag over a selected range takes it out.
  await start(["alpha beta gamma delta"]);
  await selectWords("alpha", "gamma", "gam");
  step(
    "Command-drag over part of a range deselects that part",
    JSON.stringify(await highlighted()) === '["alpha"]' && (await nativeText()) === "ma",
    `${JSON.stringify(await highlighted())} + ${await nativeText()}`,
  );

  // Word and text survive a rebuild of the nodes around them: a range after a Return made above it.
  await start(["one two", "three four"]);
  await selectWords("two", "four");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  await page.keyboard.type("k");
  await page.waitForTimeout(150);
  const rebuilt = await text.evaluate((node) => node.innerText.replace(/\u00a0/g, " "));
  step(
    "A range below a Return keeps its place",
    // The blank line is the browser's own Return at the end of a first, unwrapped line, with one range or several.
    rebuilt.trimEnd() === "one \nk\n\nthree \nk",
    JSON.stringify(rebuilt),
  );

  // The draft holds nothing of the selection.
  await start(["alpha beta"]);
  await selectWords("alpha", "beta");
  const saved = await styled();
  step("The document holds no trace of the selection's drawing", saved === "alpha beta", saved);
});

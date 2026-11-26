#!/usr/bin/env node
// TextEdit's Edit > Spelling and Grammar and Edit > Substitutions: the word list finds what is wrong and
// Change fixes only it, typing makes quotes and dashes smart with one Undo, and Replace All keeps to a
// selection.
//
//   node e2e/textedit-spelling-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("textedit-spelling");

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await openDesktop(page, base, step);
  await launch(page, "TextEdit");
  const window = page.locator('[data-window-id^="textedit"]').first();
  const text = window.getByRole("textbox", { name: "Document" });
  await text.waitFor({ timeout: 10_000 });
  await text.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Backspace");

  // As typed.
  await page.keyboard.type(`she said "it's fine" -- `);
  await page.waitForTimeout(200);
  step(
    "quotes and dashes turn smart as they are typed",
    (await text.innerText()).includes("she said “it’s fine” — "),
    await text.innerText(),
  );

  // Spelling, in a panel over the text.
  await page.keyboard.type("the wrold is helo round");
  const menu = async (...names) => {
    await page.getByRole("menubar").getByRole("menuitem", { name: "Edit", exact: true }).click();
    await page.waitForTimeout(250);
    for (const name of names.slice(0, -1)) {
      await page.getByRole("menuitem", { name }).last().hover();
      await page.waitForTimeout(300);
    }
    await page
      .getByRole("menuitem", { name: names.at(-1) })
      .or(page.getByRole("menuitemcheckbox", { name: names.at(-1) }))
      .last()
      .click();
  };
  await menu("Spelling and Grammar", "Show Spelling and Grammar");
  const panel = page.getByRole("dialog", { name: "Spelling and Grammar" });
  await panel.waitFor();
  await panel.getByRole("status").filter({ hasText: "wrold" }).waitFor({ timeout: 20_000 });
  step("the panel finds the first word the list does not hold", true);
  const change = panel.getByRole("textbox", { name: "Change to" });
  await panel.getByRole("listbox", { name: "Guesses" }).getByText("world", { exact: true }).click();
  step("a guess goes into the field", (await change.inputValue()) === "world");
  await page.waitForTimeout(500);
  await shot(page, path.join(out, "textedit-spelling.png"));
  await panel.getByRole("button", { name: "Change", exact: true }).click();
  await panel.getByRole("status").filter({ hasText: "helo" }).waitFor();
  step(
    "Change fixes that word, and goes on to the next",
    (await text.innerText()).includes("the world is helo round"),
  );
  await panel.getByRole("button", { name: "Learn" }).click();
  await panel.getByRole("status").filter({ hasText: "No more" }).waitFor();
  step("Learn knows the word from then on", true);
  step("Learn changes nothing", (await text.innerText()).includes("is helo round"));
  await panel.getByRole("button", { name: "Close" }).click();
  await panel.waitFor({ state: "detached" });

  // The key equivalent, without the panel.
  await text.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(" recieve");
  await page.keyboard.press("ControlOrMeta+Home");
  await page.keyboard.press("ControlOrMeta+;");
  await page.waitForFunction(() => document.getSelection()?.toString() === "recieve", null, {
    timeout: 20_000,
  });
  step("Check Document Now selects the next word the list does not hold", true);

  // A caret inside a known word: "nd" of "round" is no word of its own.
  await page.keyboard.press("ControlOrMeta+Home");
  const inside = (await text.innerText()).indexOf("round") + 3;
  for (let at = 0; at < inside; at += 1) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ControlOrMeta+;");
  await page.waitForTimeout(400);
  step(
    "a caret inside a known word goes on to the misspelling, not the word's last letters",
    (await page.evaluate(() => document.getSelection()?.toString())) === "recieve",
    await page.evaluate(() => document.getSelection()?.toString()),
  );

  // Replace All, on a selection.
  await page.keyboard.press("ControlOrMeta+End");
  await menu("Substitutions", "Smart Quotes");
  await page.waitForTimeout(300);
  await text.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(` "out" "in"`);
  await page.waitForTimeout(200);
  step("with Smart Quotes off they stay straight", (await text.innerText()).includes(`"out" "in"`));
  for (let at = 0; at < 4; at += 1) await page.keyboard.press("Shift+ArrowLeft");
  await menu("Substitutions", "Show Substitutions");
  const substitutions = page.getByRole("dialog", { name: "Substitutions" });
  await substitutions.waitFor();
  await substitutions.getByRole("checkbox", { name: "Smart Quotes" }).click();
  await substitutions.getByRole("button", { name: "Replace All" }).click();
  await page.waitForTimeout(300);
  step(
    "Replace All keeps to the selection",
    (await text.innerText()).includes(`"out" “in”`),
    await text.innerText(),
  );
  await substitutions.getByRole("button", { name: "Close" }).click();

  // One Undo takes a substitution back to what was typed.
  await text.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(" x--");
  await page.waitForTimeout(150);
  const smart = (await text.innerText()).endsWith("x—");
  await page.keyboard.press("ControlOrMeta+Z");
  await page.waitForTimeout(150);
  step(
    "Undo takes the dash back to the hyphens",
    smart && (await text.innerText()).endsWith("x--"),
    await text.innerText(),
  );

  // A word learned with the curly apostrophe Smart Quotes typed stays known, across a reload.
  await page.keyboard.type(" zorbly's");
  await page.waitForTimeout(150);
  step("the apostrophe turned curly", (await text.innerText()).endsWith("zorbly’s"));
  const passOverRecieve = async () => {
    await panel.getByRole("status").filter({ hasText: "recieve" }).waitFor({ timeout: 20_000 });
    await panel.getByRole("button", { name: "Ignore" }).click();
  };
  await menu("Spelling and Grammar", "Show Spelling and Grammar");
  await panel.waitFor();
  await passOverRecieve();
  await panel.getByRole("status").filter({ hasText: "zorbly" }).waitFor();
  await panel.getByRole("button", { name: "Learn" }).click();
  await panel.getByRole("status").filter({ hasText: "No more" }).waitFor();
  step("Learn takes a word with a curly apostrophe", true);
  await panel.getByRole("button", { name: "Close" }).click();
  await panel.waitFor({ state: "detached" });
  await page.waitForTimeout(1_800);
  await reloadDesktop(page);
  await launch(page, "TextEdit");
  await text.waitFor({ timeout: 10_000 });
  await text.click();
  await menu("Spelling and Grammar", "Show Spelling and Grammar");
  await panel.waitFor();
  await passOverRecieve();
  await panel.getByRole("status").filter({ hasText: "No more" }).waitFor();
  step("it is still known after a reload", (await text.innerText()).includes("zorbly’s"));
  await panel.getByRole("button", { name: "Close" }).click();
  await panel.waitFor({ state: "detached" });

  // An apostrophe straight after a bold word closes, and a first line left bare is its own word.
  await text.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("ControlOrMeta+B");
  await page.keyboard.type("it");
  await page.keyboard.press("ControlOrMeta+B");
  await page.keyboard.type("'s");
  await page.waitForTimeout(150);
  step(
    "an apostrophe after a bold word closes",
    (await text.innerText()).includes("it’s"),
    await text.innerText(),
  );
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("hello");
  await page.keyboard.press("Enter");
  await page.keyboard.type("worlld");
  await page.keyboard.press("ControlOrMeta+Home");
  await page.keyboard.press("ControlOrMeta+;");
  await page.waitForFunction(() => document.getSelection()?.toString() === "worlld", null, {
    timeout: 10_000,
  });
  step("two paragraphs are two words", true);

  // A pasted word that keeps its bold is a text node of its own: its neighbours are still read.
  await text.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("XYaabb");
  await page.keyboard.press("ControlOrMeta+Home");
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("ControlOrMeta+B");
  await page.keyboard.press("ControlOrMeta+X");
  await page.waitForTimeout(150);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ControlOrMeta+V");
  await page.waitForTimeout(300);
  const pastedRich = (await text.innerText()).trim();
  step(
    "a formatted paste between two words gets its spaces",
    pastedRich === "aa XY bb",
    pastedRich,
  );

  // The text's own menu has both, and Text Replacement answers to its own switch alone.
  const contextMenu = async (...names) => {
    await text.click({ button: "right" });
    await page.waitForTimeout(250);
    for (const name of names.slice(0, -1)) {
      await page.getByRole("menuitem", { name }).last().hover();
      await page.waitForTimeout(300);
    }
    await page
      .getByRole("menuitem", { name: names.at(-1) })
      .or(page.getByRole("menuitemcheckbox", { name: names.at(-1) }))
      .last()
      .click();
  };
  await text.click({ button: "right" });
  await page.waitForTimeout(250);
  await page.getByRole("menuitem", { name: "Substitutions" }).last().hover();
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "textedit-context-tools.png"));
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await contextMenu("Spelling and Grammar", "Show Spelling and Grammar");
  await panel.waitFor();
  step("the text's menu shows the spelling panel", true);
  await panel.getByRole("button", { name: "Close" }).click();
  await panel.waitFor({ state: "detached" });
  await contextMenu("Substitutions", "Show Substitutions");
  await substitutions.waitFor();
  step("the text's menu shows the substitutions panel", true);
  await substitutions.getByRole("button", { name: "Close" }).click();
  await substitutions.waitFor({ state: "detached" });

  await menu("Spelling and Grammar", "Check Spelling While Typing");
  await page.waitForTimeout(300);
  await text.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(" omw ");
  await page.waitForTimeout(200);
  step(
    "Text Replacement goes on with Check While Typing off",
    (await text.innerText()).includes("On my way!"),
    await text.innerText(),
  );
  await menu("Spelling and Grammar", "Check Spelling While Typing");
  await page.waitForTimeout(300);
  await menu("Substitutions", "Text Replacement");
  await page.waitForTimeout(300);
  await text.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("omw ");
  await page.waitForTimeout(200);
  step("with Text Replacement off the word stays", (await text.innerText()).endsWith("omw "));
  await menu("Substitutions", "Text Replacement");
  await page.waitForTimeout(300);

  // Ignore holds for Check Document Now too.
  await text.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("qwzzy blorptic");
  await menu("Spelling and Grammar", "Show Spelling and Grammar");
  await panel.waitFor();
  await panel.getByRole("status").filter({ hasText: "qwzzy" }).waitFor({ timeout: 20_000 });
  await panel.getByRole("button", { name: "Ignore" }).click();
  await panel.getByRole("status").filter({ hasText: "blorptic" }).waitFor();
  await panel.getByRole("button", { name: "Close" }).click();
  await panel.waitFor({ state: "detached" });
  await text.click();
  await page.keyboard.press("ControlOrMeta+Home");
  await page.keyboard.press("ControlOrMeta+;");
  await page.waitForTimeout(500);
  step(
    "Check Document Now passes over a word Ignore passed over",
    (await page.evaluate(() => document.getSelection()?.toString())) === "blorptic",
    await page.evaluate(() => document.getSelection()?.toString()),
  );
  // At the very end of the text the caret goes round to the start; it does not stop short.
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("last blorptic");
  await page.keyboard.press("ControlOrMeta+Home");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Home");
  await page.evaluate(() => {
    const view = document.querySelector('[data-window-id^="textedit"] [aria-label="Document"]');
    const nodes = [...view.childNodes];
    const at = nodes.findIndex((each) => each.textContent.startsWith("last"));
    document.getSelection()?.collapse(view, at);
  });
  await page.keyboard.press("ControlOrMeta+;");
  await page.waitForTimeout(500);
  const second = await page.evaluate(() => {
    const view = document.querySelector('[data-window-id^="textedit"] [aria-label="Document"]');
    const before = document.getSelection().getRangeAt(0).cloneRange();
    before.setStart(view, 0);
    return before.toString();
  });
  step("a caret between paragraphs checks from there", second.includes("last"), second);

  // In plain text, a word pasted between two words gets its spaces.
  await page.getByRole("menubar").getByRole("menuitem", { name: "Format", exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole("menuitem", { name: "Make Plain Text" }).last().click();
  const convert = page.getByRole("button", { name: "OK" });
  await page.waitForTimeout(400);
  if (await convert.isVisible().catch(() => false)) await convert.click();
  const plain = window.getByRole("textbox", { name: "Document" });
  await plain.waitFor();
  await plain.fill("XYab");
  await plain.focus();
  await page.keyboard.press("ControlOrMeta+Home");
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("ControlOrMeta+X");
  await page.waitForTimeout(150);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ControlOrMeta+V");
  await page.waitForTimeout(300);
  step(
    "plain text takes Smart Copy/Paste",
    (await plain.inputValue()) === "a XY b",
    await plain.inputValue(),
  );
});

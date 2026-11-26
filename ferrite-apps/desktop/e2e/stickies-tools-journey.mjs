#!/usr/bin/env node
// Stickies' Edit > Spelling and Grammar and Edit > Substitutions on the desktop: typing, the panels,
// the keys, the context menu, the settings after a reload and the words as they are stored.
// Exits 0 only when every step passed with no console error, page error or failed request.
//
//   node e2e/stickies-tools-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("stickies-tools");
const stamp = Date.now().toString(36).replace(/\d/g, "q");
const WRONG = `blorp${stamp}`;
const IGNORED = `zorbl${stamp}`;

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await openDesktop(page, base, step);
  await launch(page, "Stickies");
  await page.locator('[data-window-id^="stickies"]').first().waitFor({ timeout: 10_000 });
  await page.waitForTimeout(600);
  const bar = page.getByRole("menubar");
  const stored = async () => (await api(page, "GET", "/api/stickies/data")).json?.data?.notes ?? [];
  const row = (name) => page.getByRole("menuitem", { name }).last();

  await bar.getByRole("menuitem", { name: "File", exact: true }).click();
  await page.waitForTimeout(200);
  await row(/^New Note/).click();
  await page.waitForTimeout(400);
  const note = page.locator(".mac-stickies-note-text:focus");

  const edit = async (submenu, item) => {
    await bar.getByRole("menuitem", { name: "Edit", exact: true }).click();
    await page.waitForTimeout(200);
    await row(submenu).hover();
    await page.waitForTimeout(200);
    await page.locator('[role^="menuitem"]').filter({ hasText: item }).last().click();
    await page.waitForTimeout(300);
  };

  await page.keyboard.type(`say "hi" -- the ${WRONG} word ${IGNORED}`);
  const typed = await note.innerText();
  step("quotes and dashes turn smart as they are typed", typed.includes("say “hi” — the"), typed);

  await edit("Spelling and Grammar", /^Show Spelling and Grammar/);
  const spelling = page.getByRole("dialog", { name: "Spelling and Grammar" });
  await spelling.getByRole("status").getByText(WRONG).waitFor();
  await shot(page, path.join(out, "stickies-spelling.png"));
  step("the panel finds the first word the list does not hold", true);
  const beside = await page.evaluate(() => {
    const panel = document.querySelector('[role="dialog"][aria-label="Spelling and Grammar"]');
    const word = document.getSelection()?.getRangeAt(0).getBoundingClientRect();
    const box = panel?.getBoundingClientRect();
    return Boolean(word && box && (word.right <= box.left || word.left >= box.right));
  });
  step("the panel does not hide the word it shows", beside);
  await spelling.getByRole("textbox", { name: "Change to" }).fill("plain");
  await spelling.getByRole("button", { name: "Change", exact: true }).click();
  await spelling.getByRole("status").getByText(IGNORED).waitFor();
  const changed = await page.locator(".mac-stickies-note-text", { hasText: "plain word" }).count();
  step("Change puts the word in the note, and goes on to the next", changed === 1);
  await spelling.getByRole("button", { name: "Ignore", exact: true }).click();
  await spelling.getByText("No more spelling errors were found.").waitFor();
  step("Ignore passes over the word", true);
  await spelling.getByRole("button", { name: /close/i }).first().click();
  await page.locator(".mac-stickies-note-text", { hasText: "plain word" }).click();
  await page.keyboard.press("ControlOrMeta+Shift+Semicolon");
  await spelling.waitFor();
  step("the key shows the panel", true);
  await spelling.getByRole("button", { name: /close/i }).first().click();

  const isKept = async () => (await stored()).some((each) => each.text.includes("the plain word"));
  let kept = await isKept();
  for (let tries = 0; !kept && tries < 10; tries += 1) {
    await page.waitForTimeout(500);
    kept = await isKept();
  }
  step("the changed word is what is stored", kept);

  const text = page.locator(".mac-stickies-note-text", { hasText: "plain word" });
  await text.click();
  await page.keyboard.press("End");
  await page.keyboard.type(` ${WRONG}x`);
  await page.keyboard.press("Home");
  await edit("Spelling and Grammar", /^Check Document Now/);
  await page.waitForFunction((word) => document.getSelection()?.toString() === word, `${WRONG}x`, {
    timeout: 5_000,
  });
  step("Check Document Now selects the next word, past the one Ignore passed over", true);
  await page.keyboard.type("fixed");
  step(
    "the keyboard stays in the note: typing replaces the word",
    (await text.innerText()).endsWith(" fixed"),
    await text.innerText(),
  );

  await edit("Substitutions", /^Smart Quotes/);
  await text.click();
  await page.keyboard.press("End");
  await page.keyboard.type(' "straight"');
  step(
    "with Smart Quotes off they stay straight",
    (await text.innerText()).includes('"straight"'),
    await text.innerText(),
  );

  await text.click({ button: "right" });
  await page.waitForTimeout(300);
  const menu = page.getByRole("menu", { name: "Note" });
  await menu.getByRole("menuitem", { name: "Substitutions" }).hover();
  await page.waitForTimeout(250);
  await page.getByRole("menuitem", { name: "Show Substitutions" }).click();
  const substitutions = page.getByRole("dialog", { name: "Substitutions" });
  await substitutions.waitFor();
  await shot(page, path.join(out, "stickies-substitutions.png"));
  step("the note's menu shows the substitutions panel", true);
  await substitutions.getByRole("checkbox", { name: "Smart Quotes" }).click();
  await text.click();
  await page.keyboard.press("End");
  await page.keyboard.type(' "again"');
  await page.waitForTimeout(300);
  step(
    "the panel's check turns Smart Quotes back on",
    (await text.innerText()).includes("“again”"),
    await text.innerText(),
  );

  await substitutions.getByRole("button", { name: /close/i }).first().click();
  await edit("Spelling and Grammar", /^Check Spelling While Typing/);
  await page.waitForTimeout(800);
  step(
    "Check Spelling While Typing turns the browser's check off",
    (await text.getAttribute("spellcheck")) === "false",
  );
  await edit("Substitutions", /^Smart Dashes/);
  await page.waitForTimeout(900);
  await reloadDesktop(page);
  const after = page.locator(".mac-stickies-note-text").first();
  await after.waitFor({ timeout: 10_000 });
  step("the setting is there after a reload", (await after.getAttribute("spellcheck")) === "false");
  await after.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" a--b");
  step(
    "Smart Dashes stays off after a reload",
    (await after.innerText()).includes("a--b"),
    await after.innerText(),
  );

  // Back as the desktop starts, for the next run on this account.
  await edit("Spelling and Grammar", /^Check Spelling While Typing/);
  await edit("Substitutions", /^Smart Dashes/);
  await page.waitForTimeout(900);
});

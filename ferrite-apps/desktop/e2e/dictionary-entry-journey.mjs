#!/usr/bin/env node
// Dictionary's entry on the served desktop: its window comes back as it was left after a reload
// (scope, text size, list width, history), Find in the entry, Speech, the entry's context menu,
// synonyms that look themselves up, links that open in Safari, and Help. Exits 0 only when every
// step passed with no console error, page error or failed request.
//
// Stand-in: a spy on `speechSynthesis.speak` stands for the voice, which a headless browser lacks.
//
//   node e2e/dictionary-entry-journey.mjs --url http://127.0.0.1:3020 --out e2e/output

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("dictionary-entry", { ignoreOtherOrigins: true });
const WORD = "serendipity";

const choose = async (page, title, name) => {
  await page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true }).click();
  await page.waitForTimeout(250);
  await page.getByRole("menuitem", { name }).first().click();
  await page.waitForTimeout(300);
};
const chooseIn = async (page, title, submenu, name) => {
  await page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true }).click();
  await page.waitForTimeout(250);
  await page.getByRole("menuitem", { name: submenu, exact: true }).hover();
  await page.waitForTimeout(300);
  await page.getByRole("menuitem", { name }).first().click();
  await page.waitForTimeout(300);
};
const open = async (page) => {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const spotlight = page.getByRole("combobox", { name: "Spotlight Search" });
  await spotlight.fill("Dictionary");
  await spotlight.press("Enter");
};

await run(async (page) => {
  await openDesktop(page, base, step);
  const library = (await api(page, "GET", "/api/app-store/library")).json;
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(library.installed ?? []), "dictionary"])],
    rev: library.rev,
  });
  await reloadDesktop(page);
  await open(page);
  const window = page.locator('.mac-managed-window[data-window-id="dictionary"]');
  const field = window.getByRole("searchbox", { name: "Search" });
  await field.waitFor({ state: "visible", timeout: 10_000 });
  const entryOf = (word) => window.getByRole("region", { name: `Entry for ${word}` });
  const scale = () =>
    window
      .locator(".mac-dictionary-entry")
      .evaluate((node) => node.style.getPropertyValue("--mac-dictionary-text-scale"));
  const listWidth = () =>
    window
      .locator(".mac-dictionary-sidebar")
      .evaluate((node) => Math.round(node.getBoundingClientRect().width));

  await field.click();
  await page.keyboard.type(WORD);
  const sense = entryOf(WORD).locator(".mac-dictionary-sense").first();
  await sense.waitFor({ state: "visible", timeout: 30_000 });

  // Find in the entry.
  await chooseIn(page, "Edit", "Find", /^Find…/);
  const bar = window.getByRole("search", { name: "Find" });
  const finding = bar.getByRole("searchbox", { name: "Find" });
  await finding.waitFor({ state: "visible", timeout: 5_000 });
  step(
    "Edit > Find shows the bar with the keyboard in it",
    await finding.evaluate((node) => node === document.activeElement),
  );
  await page.keyboard.type("e");
  const count = await bar.getByRole("status").textContent();
  const total = Number(/of (\d+)/.exec(count)?.[1] ?? 0);
  const inEntry = await entryOf(WORD)
    .locator("article")
    .evaluate((node) => (node.textContent.toLowerCase().match(/e/g) ?? []).length);
  step("it counts the letters found in the entry", total === inEntry && total > 1, count);
  await page.keyboard.press("Enter");
  step(
    "Return moves to the next match, keeping the keyboard",
    (await bar.getByRole("status").textContent()).startsWith("2 of") &&
      (await finding.evaluate((node) => node === document.activeElement)),
    await bar.getByRole("status").textContent(),
  );
  await shot(page, path.join(out, "dictionary-find.png"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  step(
    "Escape closes the bar and leaves the match selected",
    (await bar.count()) === 0 &&
      (await page.evaluate(() => document.getSelection().toString().toLowerCase())) === "e",
  );

  // Speech, with a spy for the voice.
  await page.evaluate(() => {
    window.__spoken = [];
    window.speechSynthesis.speak = (utterance) => window.__spoken.push(utterance.text);
  });
  await sense.dblclick({ position: { x: 40, y: 8 } });
  const selected = await page.evaluate(() => document.getSelection().toString().trim());
  await chooseIn(page, "Edit", "Speech", /^Start Speaking/);
  const spoken = await page.evaluate(() => window.__spoken.at(-1));
  step(
    "Edit > Speech reads the selection",
    spoken === selected,
    `${selected} / ${spoken?.slice(0, 40)}`,
  );

  // The context menu.
  await sense.dblclick({ position: { x: 40, y: 8 } });
  // Before the menu: its focus moves the page's selection in WebKit, and the menu keeps the word.
  const wanted = await page.evaluate(() => document.getSelection().toString().trim());
  await sense.click({ button: "right", position: { x: 40, y: 8 } });
  const menu = page.getByRole("menu", { name: "Entry commands" });
  await menu.waitFor({ timeout: 5_000 });
  await shot(page, path.join(out, "dictionary-entry-menu.png"));
  step(
    "the entry's context menu names the selected word",
    (await menu.getByRole("menuitem", { name: `Look Up “${wanted}”` }).count()) === 1 &&
      (await menu.getByRole("menuitem", { name: "Search with Google" }).count()) === 1,
    wanted,
  );
  const googled = page.waitForResponse(
    (response) => response.url().includes("google.com%2Fsearch"),
    {
      timeout: 30_000,
    },
  );
  await menu.getByRole("menuitem", { name: "Search with Google" }).click();
  const safari = page.locator('.mac-managed-window[data-window-id="safari"]').first();
  await safari.waitFor({ state: "visible", timeout: 15_000 });
  const googledAnswer = await googled;
  step(
    "Search with Google opens Safari on the word",
    googledAnswer.url().includes(encodeURIComponent(`q=${wanted}`)),
  );
  await googledAnswer.finished();
  await page
    .locator('.mac-managed-window[data-window-id="safari"] .mac-window-controls button')
    .first()
    .click();
  await page.waitForTimeout(500);
  await window.click({ position: { x: 300, y: 20 } });

  // The Thesaurus's words look themselves up, as a step of the history.
  await window.getByRole("radio", { name: "Thesaurus" }).click();
  const synonym = entryOf(WORD).locator(".mac-dictionary-word-link").first();
  await synonym.waitFor({ state: "visible", timeout: 30_000 });
  const other = (await synonym.textContent()).trim();
  await synonym.click();
  await entryOf(other).waitFor({ timeout: 30_000 });
  step("a synonym looks itself up, as a new search", (await field.inputValue()) === other, other);
  await shot(page, path.join(out, "dictionary-thesaurus.png"));

  // How the window was left.
  await window.getByRole("button", { name: "Increase text size" }).click();
  const divider = window.getByRole("separator", { name: "Resize the word list" });
  await divider.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(200);
  const before = { scale: await scale(), width: await listWidth() };
  step(
    "the size and the list width changed",
    before.scale === "1.15" && before.width > 183,
    JSON.stringify(before),
  );
  await reloadDesktop(page);
  if ((await window.count()) === 0) await open(page);
  await field.waitFor({ state: "visible", timeout: 10_000 });
  await entryOf(other).waitFor({ timeout: 30_000 });
  step("after a reload it shows the word it was left on", (await field.inputValue()) === other);
  step(
    "in the scope it was left on",
    await window.getByRole("radio", { name: "Thesaurus" }).isChecked(),
  );
  step(
    "at the text size and the list width it was left at",
    (await scale()) === before.scale && (await listWidth()) === before.width,
    `${await scale()} ${await listWidth()}`,
  );
  const back = window.getByRole("button", { name: "Back" });
  await shot(page, path.join(out, "dictionary-after-reload.png"));
  step("and Back still knows the way", await back.isEnabled());
  await back.click();
  await window.getByRole("radio", { name: "All" }).click();
  await page.waitForTimeout(300);
  step("Back returns to the word before", (await field.inputValue()) === WORD);

  // A link out goes to Safari, and the window stays where it is.
  const before_ = page.url();
  const credit = entryOf(WORD).locator(".mac-dictionary-credit").first();
  await credit.waitFor({ state: "visible", timeout: 30_000 });
  const creditRead = page.waitForResponse(
    (response) =>
      response.url().includes("/api/safari/page?url=") && response.url().includes("wiktionary.org"),
    { timeout: 30_000 },
  );
  await credit.click();
  await safari.waitFor({ state: "visible", timeout: 15_000 });
  // Closing the window before this answer has come in full would cancel the read itself.
  await (await creditRead).finished();
  step("a credit opens in Safari", page.url() === before_ && page.context().pages().length === 1);
  await page
    .locator('.mac-managed-window[data-window-id="safari"] .mac-window-controls button')
    .first()
    .click();
  await page.waitForTimeout(500);
  await window.click({ position: { x: 300, y: 20 } });

  await choose(page, "Help", /^Dictionary Help/);
  await page
    .locator('.mac-managed-window[data-window-id="help-viewer"]')
    .first()
    .waitFor({ state: "visible", timeout: 15_000 });
  step("Help > Dictionary Help opens Help Viewer", true);
});

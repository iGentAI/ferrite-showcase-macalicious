#!/usr/bin/env node
// What Spotlight found opens in its application: a note in Notes, in an open window and in one the
// request opens; a sticky note, brought to the front; a word in Dictionary. As a Guest User with data
// of its own. Exits 0 only when every step passed with no console error, page error or failed
// request.
//
//   node e2e/spotlight-open-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("spotlight-open");
const stamp = Date.now().toString(36);
const NOTE_A = `quince${stamp}`;
const NOTE_B = `medlar${stamp}`;
const STICKY_A = `damson${stamp}`;
const STICKY_B = `greengage${stamp}`;

const menuBar = (page, title) =>
  page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
async function choose(page, title, item) {
  await menuBar(page, title).click();
  await page.waitForTimeout(250);
  await page.locator('[role="menu"]').getByRole("menuitem", { name: item }).first().click();
  await page.waitForTimeout(400);
}
async function settled(page, read) {
  for (let i = 0; i < 40; i++) {
    if (await read()) return true;
    await page.waitForTimeout(250);
  }
  return false;
}
/** Types into Spotlight until `group` lists what is wanted, then opens it with Return. */
async function openFound(page, typed, group, option) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  const found = page
    .getByRole("group", { name: new RegExp(`^(?:${group}|Top Hit)$`) })
    .getByRole("option", { name: option })
    .first();
  for (let i = 0; i < 20 && !(await found.isVisible()); i++) {
    await field.fill("");
    await field.fill(typed);
    await page.waitForTimeout(500);
  }
  await found.click();
  await field.press("Enter").catch(() => {});
  await page.waitForFunction(
    () => !document.querySelector('[role="combobox"][aria-label="Spotlight Search"]'),
    undefined,
    { timeout: 10_000 },
  );
  await page.waitForTimeout(500);
}

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "platform", { get: () => "MacIntel" });
  });
  await openDesktop(page, base, step);

  // Notes.
  await launch(page, "Notes");
  const notes = page.getByRole("region", { name: "Notes" });
  const list = notes.getByRole("listbox", { name: "Notes" });
  await list.waitFor({ state: "visible", timeout: 10_000 });
  for (const word of [NOTE_A, NOTE_B]) {
    await choose(page, "File", "New Note");
    await page.keyboard.type(word);
    await page.waitForTimeout(500);
  }
  await settled(page, async () => {
    const { data } = (await api(page, "GET", "/api/notes/data")).json;
    return [NOTE_A, NOTE_B].every((word) => data.notes.some((note) => note.lines[0] === word));
  });
  const chosen = () => list.locator('[role="option"][aria-selected="true"]').textContent();
  step("the second note is the one selected", (await chosen()).includes(NOTE_B));
  await openFound(page, NOTE_A, "Notes", NOTE_A);
  step("Spotlight selects the note it found in the open window", (await chosen()).includes(NOTE_A));
  await shot(page, path.join(out, "spotlight-open-note.png"));

  await choose(page, "Notes", "Quit Notes");
  await notes.waitFor({ state: "detached", timeout: 10_000 });
  await openFound(page, NOTE_B, "Notes", NOTE_B);
  await list.waitFor({ state: "visible", timeout: 10_000 });
  step(
    "Spotlight opens Notes on the note it found when Notes was not running",
    await settled(page, async () => (await chosen()).includes(NOTE_B)),
  );

  // Stickies.
  await launch(page, "Stickies");
  await page.locator(".mac-stickies-note").first().waitFor({ timeout: 10_000 });
  const windowOf = (word) =>
    page
      .locator("[data-window-id]")
      .filter({ has: page.locator(".mac-stickies-note").filter({ hasText: word }) })
      .first();
  for (const word of [STICKY_A, STICKY_B]) {
    await choose(page, "File", "New Note");
    await page.keyboard.type(word);
    await page.waitForTimeout(700);
  }
  await settled(page, async () => {
    const { data } = (await api(page, "GET", "/api/stickies/data")).json;
    return [STICKY_A, STICKY_B].every((word) => data.notes.some((n) => n.text.startsWith(word)));
  });
  step(
    "the second sticky note is the key window",
    (await windowOf(STICKY_B)
      .locator("[data-window-state]")
      .first()
      .getAttribute("data-window-state")) === "key",
  );
  await openFound(page, STICKY_A, "Stickies", STICKY_A);
  step(
    "Spotlight brings the sticky note it found to the front",
    (await windowOf(STICKY_A)
      .locator("[data-window-state]")
      .first()
      .getAttribute("data-window-state")) === "key",
  );
  await shot(page, path.join(out, "spotlight-open-sticky.png"));

  // Dictionary.
  await openFound(page, "serendipity", "Definition", /serendipity/i);
  const dictionary = page.locator('.mac-managed-window[data-window-id="dictionary"]');
  const field = dictionary.getByRole("searchbox", { name: "Search" });
  await field.waitFor({ state: "visible", timeout: 10_000 });
  step(
    "Spotlight opens Dictionary on the word it defined",
    (await field.inputValue()) === "serendipity",
    await field.inputValue(),
  );
  await shot(page, path.join(out, "spotlight-open-dictionary.png"));
});

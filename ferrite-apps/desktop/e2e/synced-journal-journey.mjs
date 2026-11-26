#!/usr/bin/env node
// The journal of unsent changes in a real browser: real tabs closed on a change the server has not
// got, or whose answer never came, and a new tab of the same person that brings the change back.
// Stickies is the app driven; the journal is the synced document's, shared with Notes and Reminders.
//
//   node e2e/synced-journal-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("synced-journal");
const stamp = Date.now().toString(36);
const DATA = /\/api\/stickies\/data(\?|$)/;

const stored = async (page) =>
  (await api(page, "GET", "/api/stickies/data")).json?.data?.notes ?? [];
const journal = (page) =>
  page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith("macalicious-unsent:"))
      .map((key) => localStorage.getItem(key)),
  );
const until = async (check, ms = 10_000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
};

async function openStickies(page) {
  page.setDefaultTimeout(12_000);
  await openDesktop(page, base, step);
  await launch(page, "Stickies");
  await page.locator('[data-window-id^="stickies"]').first().waitFor({ timeout: 10_000 });
  await page.waitForTimeout(600);
}

async function newNote(page, text) {
  await page.getByRole("menubar").getByRole("menuitem", { name: "File", exact: true }).click();
  await page.waitForTimeout(300);
  await page
    .getByRole("menuitem", { name: /^New Note/ })
    .last()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type(text);
}

await run(async (first) => {
  const context = first.context();
  await openStickies(first);
  await first.close();

  const NEVER = `Never arrived ${stamp}`;
  const offline = await context.newPage();
  await openStickies(offline);
  let attempts = 0;
  await offline.route(DATA, (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    attempts += 1;
    // No answer, and nothing reaches the server: the tab goes first.
    return undefined;
  });
  await newNote(offline, NEVER);
  step("the save was tried and has no answer", await until(() => attempts > 0));
  step(
    "the change is in the browser's storage while it is unsent",
    (await journal(offline)).some((entry) => entry?.includes(NEVER)),
  );
  step("the server does not have it", !(await stored(offline)).some((note) => note.text === NEVER));
  await offline.close();

  const back = await context.newPage();
  await openStickies(back);
  step(
    "a new tab saves the change the closed tab left",
    await until(async () => (await stored(back)).some((note) => note.text === NEVER)),
  );
  step(
    "the new tab shows it",
    await until(() =>
      back.evaluate(
        (text) =>
          [...document.querySelectorAll('[data-window-id^="stickies"] textarea')].some(
            (field) => field.value === text,
          ) ||
          [...document.querySelectorAll('[data-window-id^="stickies"]')].some((note) =>
            note.innerText.includes(text),
          ),
        NEVER,
      ),
    ),
  );
  step(
    "the journal lets go of it once it is stored",
    await until(async () => (await journal(back)).every((entry) => !entry?.includes(NEVER))),
  );
  await shot(back, path.join(out, "synced-journal-back.png"));

  const LOST = `Answer lost ${stamp}`;
  const AFTER = " and more";
  let landed = false;
  await back.route(DATA, async (route) => {
    if (route.request().method() !== "PUT" || !route.request().postData()?.includes(LOST)) {
      return route.continue();
    }
    await route.fetch();
    landed = true;
    // The server stored it; its answer is lost with the tab.
    return undefined;
  });
  await newNote(back, LOST);
  step("a save reaches the server, and its answer never comes", await until(() => landed));
  const before = await stored(back);
  step(
    "the server holds that save",
    before.some((note) => note.text === LOST),
  );
  await back.keyboard.type(AFTER);
  await until(async () => (await journal(back)).some((entry) => entry?.includes(LOST + AFTER)));
  await back.close();

  const last = await context.newPage();
  await openStickies(last);
  step(
    "a new tab saves what was typed after the lost answer",
    await until(async () => (await stored(last)).some((note) => note.text === LOST + AFTER)),
  );
  const notes = await stored(last);
  step(
    "nothing is doubled: one note for each",
    notes.filter((note) => note.text.startsWith(LOST)).length === 1 &&
      notes.filter((note) => note.text === NEVER).length === 1 &&
      notes.length === before.length,
    `${notes.length} notes, ${before.length} before`,
  );
  step(
    "the journal is empty when everything is stored",
    await until(async () => (await journal(last)).length === 0),
  );
  await last.close();
});

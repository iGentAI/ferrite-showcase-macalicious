#!/usr/bin/env node
// Sign in on a fresh browser, then make the first change, in each app that keeps a synced document.
// Signing in as Guest User does not load the page again, and each document was read before it: the
// first save must reach the person who signed in, with no refusal and nothing dropped.
//
//   node e2e/synced-signin-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("synced-signin");
const stamp = Date.now().toString(36);

const until = async (check, ms = 8_000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
};

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  const refused = [];
  page.on("response", (response) => {
    if (response.request().method() === "PUT" && response.status() === 409) {
      refused.push(new URL(response.url()).pathname);
    }
  });
  await openDesktop(page, base, step);

  const FIRST = `First sticky ${stamp}`;
  await launch(page, "Stickies");
  const notes = page.locator('[data-window-id^="stickies"]');
  await notes.first().waitFor({ timeout: 10_000 });
  await page.waitForTimeout(600);
  const before = await notes.count();
  await page.getByRole("menubar").getByRole("menuitem", { name: "File", exact: true }).click();
  await page.waitForTimeout(300);
  await page
    .getByRole("menuitem", { name: /^New Note/ })
    .last()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type(FIRST);
  step(
    "Stickies stores the first note after signing in",
    await until(async () =>
      ((await api(page, "GET", "/api/stickies/data")).json?.data?.notes ?? []).some(
        (note) => note.text === FIRST,
      ),
    ),
  );
  step("Stickies keeps that note's window", (await notes.count()) === before + 1);

  const NOTE = `First note ${stamp}`;
  await launch(page, "Notes");
  const window = page.getByRole("region", { name: "Notes", exact: true }).first();
  await window.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(600);
  await window
    .getByRole("toolbar", { name: "Notes toolbar" })
    .getByRole("button", { name: "New Note" })
    .click();
  const editor = window.locator('[role="textbox"][aria-label="Note"]:visible').first();
  await editor.click();
  await page.keyboard.type(NOTE);
  step(
    "Notes stores the first note after signing in",
    await until(async () =>
      ((await api(page, "GET", "/api/notes/data")).json?.data?.notes ?? []).some(
        (note) => (note.lines?.[0] ?? "").trim() === NOTE,
      ),
    ),
  );
  step("Notes still shows what was typed", ((await editor.textContent()) ?? "").includes(NOTE));

  const REMINDER = `First reminder ${stamp}`;
  await launch(page, "Reminders");
  const list = page.getByRole("region", { name: "Reminders", exact: true }).first();
  await list.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(600);
  await list.getByRole("button", { name: "New Reminder" }).click();
  await page.waitForTimeout(200);
  await page.keyboard.type(REMINDER);
  await page.keyboard.press("Enter");
  step(
    "Reminders stores the first reminder after signing in",
    await until(async () =>
      JSON.stringify((await api(page, "GET", "/api/reminders/data")).json?.data ?? null).includes(
        REMINDER,
      ),
    ),
  );

  step("no save was refused", refused.length === 0, refused.join(", "));
  await shot(page, path.join(out, "synced-signin.png"));
});

#!/usr/bin/env node
// Siri on Ferrite: under `ferrite dev`, sign in as a Guest User, open Siri from
// the menu bar and type requests. Each one must change the person's own data on
// the server (a note, a reminder with its day and time, a calendar event), read
// it back, switch the desktop's appearance or open an app; a question no rule
// understands is answered honestly when no model provider is set up. A second
// browser, another guest, must not see the first one's note.
//
//   ferrite dev                       # in ferrite-apps/desktop
//   node e2e/siri-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output] [--browser chromium|chrome|firefox|webkit]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";

const { out, base, browserName } = options();
const { step, run } = journey("siri");
const tag = `${browserName}-${Date.now().toString(36)}`;

/** The local day `offset` days from today, `YYYY-MM-DD`, as the browser sees it. */
const day = (offset) => {
  const at = new Date();
  at.setDate(at.getDate() + offset);
  const pad = (n) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
};

async function openSiri(page) {
  await page.getByRole("menuitem", { name: "Siri" }).first().click();
  const siri = page.locator(".mac-desktop-shell-siri");
  await siri.getByRole("textbox", { name: "Type to Siri" }).waitFor({ timeout: 10_000 });
  return siri;
}

/** Type `text` to Siri and resolve with its answer, once the server has answered. */
async function ask(page, siri, text) {
  const answered = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/siri/ask",
    { timeout: 15_000 },
  );
  const field = siri.getByRole("textbox", { name: "Type to Siri" });
  await field.fill(text);
  await field.press("Enter");
  const response = await answered;
  const reply = await response.json();
  const shown = siri.locator("[data-answer]");
  await shown.waitFor({ timeout: 10_000 });
  return { status: response.status(), reply, shown: (await shown.textContent()) ?? "" };
}

await run(async (page) => {
  await openDesktop(page, base, step);
  let siri = await openSiri(page);
  step("Siri opens from the menu bar with a Type to Siri field", await siri.isVisible());

  // A note.
  const noteText = `Buy flowers ${tag}`;
  let answer = await ask(page, siri, `Make a note that says ${noteText}`);
  step(
    "Siri makes a note",
    answer.status === 200 && /made a note/i.test(answer.shown),
    answer.shown,
  );
  const notes = await api(page, "GET", "/api/notes/data");
  const lines = (notes.json.data?.notes ?? []).flatMap((note) => note.lines ?? []);
  step("the note is in the person's Notes on the server", lines.includes(noteText));

  // A reminder with its day and time.
  answer = await ask(page, siri, `Remind me to call Mom ${tag} at 5pm tomorrow`);
  step("Siri sets a reminder", /remind you tomorrow at 5:00 PM/i.test(answer.shown), answer.shown);
  const reminders = await api(page, "GET", "/api/reminders/data");
  const reminder = (reminders.json.data?.reminders ?? []).find(
    (r) => r.title === `call Mom ${tag}`,
  );
  step(
    "the reminder is stored for tomorrow at 17:00",
    reminder?.due === day(1) && reminder?.dueTime === "17:00",
    JSON.stringify(reminder ?? null),
  );

  // A calendar event, then reading the calendar.
  answer = await ask(page, siri, `Schedule Design review ${tag} tomorrow at 10am`);
  step("Siri adds a calendar event", /added .*Design review/i.test(answer.shown), answer.shown);
  const events = await api(page, "GET", "/api/calendar/events");
  const event = (events.json.events ?? []).find((e) => e.title === `Design review ${tag}`);
  const start = event ? new Date(event.start) : null;
  step(
    "the event starts tomorrow at 10:00 local time",
    start !== null && start.getHours() === 10 && start.getMinutes() === 0,
    start?.toString() ?? "missing",
  );
  answer = await ask(page, siri, "What's on my calendar tomorrow?");
  const card = await siri
    .locator(".mac-desktop-shell-siri-list")
    .last()
    .textContent()
    .catch(() => "");
  step(
    "Siri reads tomorrow's events back",
    /event/i.test(answer.shown) && (card ?? "").includes(`Design review ${tag}`),
    answer.shown,
  );
  await shot(page, path.join(out, `siri-${browserName}.png`));

  // Appearance.
  await ask(page, siri, "Turn on dark mode");
  await page
    .waitForFunction(
      () => document.documentElement.getAttribute("data-appearance") === "dark",
      null,
      { timeout: 5_000 },
    )
    .catch(() => {});
  step(
    "Turn on dark mode switches the desktop to Dark",
    (await page.evaluate(() => document.documentElement.getAttribute("data-appearance"))) ===
      "dark",
  );
  await shot(page, path.join(out, `siri-dark-${browserName}.png`));
  await ask(page, siri, "Turn off dark mode");
  await page
    .waitForFunction(
      () => document.documentElement.getAttribute("data-appearance") === "light",
      null,
      { timeout: 5_000 },
    )
    .catch(() => {});
  step(
    "Turn off dark mode switches it back to Light",
    (await page.evaluate(() => document.documentElement.getAttribute("data-appearance"))) ===
      "light",
  );

  // A request no rule understands and no article answers, with no model provider set up.
  answer = await ask(page, siri, "Sing me a song");
  const status = await api(page, "GET", "/api/siri/status");
  step(
    status.json.model
      ? "an open question goes to the model provider"
      : "an open question says that no model provider is set up",
    status.json.model ? answer.reply.via === "model" : /model provider/i.test(answer.shown),
    answer.shown,
  );
  if (!status.json.model) {
    // Wikipedia, read for real: who or what something is.
    answer = await ask(page, siri, "Who was Ada Lovelace?");
    step(
      "a question of who someone was is answered from Wikipedia, credited",
      answer.reply.via === "encyclopedia" &&
        /mathematician/.test(answer.reply.text) &&
        (await siri.getByText("From Wikipedia, CC BY-SA 4.0").isVisible()),
      answer.reply.text,
    );
  }

  // Opening an app.
  await ask(page, siri, "Open Calculator");
  const calculator = page.getByRole("region", { name: "Calculator" }).first();
  await calculator.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
  step("Open Calculator opens Calculator", await calculator.isVisible());

  // Another person sees none of it.
  const other = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 1440, height: 900 } });
  const second = await other.newPage();
  await openDesktop(second, base, step);
  siri = await openSiri(second);
  answer = await ask(second, siri, "Show my notes");
  const theirCard =
    (await siri
      .locator(".mac-desktop-shell-siri-list")
      .textContent()
      .catch(() => "")) ?? "";
  const theirNotes = await api(second, "GET", "/api/notes/data");
  const theirLines = (theirNotes.json.data?.notes ?? []).flatMap((note) => note.lines ?? []);
  step(
    "another guest's Siri does not see the first one's note",
    !theirCard.includes(noteText) && !theirLines.includes(noteText),
  );
  await other.close();
});

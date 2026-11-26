#!/usr/bin/env node
// Selecting several events in Calendar, in a real browser against the running app: a click with the
// Command key adds an event, a plain click leaves one, Select All takes every event shown, Delete
// removes them all from the server as one change, and Undo brings them back. Exits 0 only when every
// step passed and no page logged a console error, a page error, a failed request or an HTTP error.
//
//   node e2e/calendar-select-several-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                                [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("calendar-select-several");
const id = Date.now().toString(36);
const chris = { name: `cschris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };

const windowOf = (page) => page.getByRole("region", { name: "Calendar" });
const shownEvents = (page) => windowOf(page).locator("[data-event-id]");
const blocks = (page) => windowOf(page).locator("[data-event-id]:not([data-event-id^='holiday-'])");
const pressed = (page) => windowOf(page).locator('[data-event-id][aria-pressed="true"]');
const seen = (check) => within(8_000, check).then((took) => took !== null);
async function saved(page) {
  const reply = await page.request.get(new URL("/api/calendar/events", page.url()).href);
  return ((await reply.json()).events ?? []).filter((event) => event.title === "New Event").length;
}

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", chris);
  await openFromDock(page, "Calendar");
  await within(15_000, () => windowOf(page).isVisible());
  await windowOf(page).locator(".mac-calendar-body:not([inert])").waitFor({ timeout: 20_000 });
  await page.waitForTimeout(500);
  await page.keyboard.press("Control+3");
  for (let n = 1; n <= 3; n += 1) {
    await page.keyboard.press("Control+n");
    await seen(async () => (await blocks(page).count()) === n);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
  step("Three events are made", await seen(async () => (await saved(page)) === 3));

  await blocks(page).nth(0).click();
  await blocks(page)
    .nth(1)
    .click({ modifiers: ["Control"] });
  step(
    "A click with the Command key adds a second event to the selection",
    await seen(async () => (await pressed(page).count()) === 2),
  );
  await blocks(page)
    .nth(1)
    .click({ modifiers: ["Control"] });
  step(
    "Clicking it the same way takes it off again",
    await seen(async () => (await pressed(page).count()) === 1),
  );

  // US Holidays' events of the month shown are among them, and they cannot be deleted.
  const everyEvent = await shownEvents(page).count();
  await page.keyboard.press("Control+a");
  step(
    "Select All takes every event shown",
    everyEvent >= 3 && (await seen(async () => (await pressed(page).count()) === everyEvent)),
  );
  await shot(page, "calendar-select-several");
  await blocks(page).nth(2).click();
  step(
    "A plain click leaves one selected",
    await seen(async () => (await pressed(page).count()) === 1),
  );

  await page.keyboard.press("Control+a");
  await page.keyboard.press("Delete");
  step(
    "Delete removes them all, in the window and on the server",
    await seen(async () => (await blocks(page).count()) === 0 && (await saved(page)) === 0),
  );
  await page.keyboard.press("Control+z");
  step(
    "One Undo brings them all back",
    await seen(async () => (await blocks(page).count()) === 3 && (await saved(page)) === 3),
  );

  // Going to another event by keyboard and back ends the selection: B must not come back with A.
  const byKeyboard = async (n) => {
    await blocks(page).nth(n).focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  };
  await blocks(page).nth(0).click();
  await blocks(page)
    .nth(1)
    .click({ modifiers: ["Control"] });
  await seen(async () => (await pressed(page).count()) === 2);
  await byKeyboard(2);
  await byKeyboard(0);
  step(
    "Going to another event by keyboard and back leaves only that one selected",
    await seen(async () => (await pressed(page).count()) === 1),
  );
  await page.keyboard.press("Delete");
  step(
    "Delete then removes that one alone",
    await seen(async () => (await blocks(page).count()) === 2 && (await saved(page)) === 2),
  );
});

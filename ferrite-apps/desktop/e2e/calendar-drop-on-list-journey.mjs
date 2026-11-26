#!/usr/bin/env node
// An event dragged onto a calendar in Calendar's list, in a real browser against the running app: it
// goes to that calendar on the server with its times as they were, and an event dragged onto a
// calendar that is not the person's stays. View > Show Declined Invitations is also in the menu bar.
// Exits 0 only when every step passed and no page logged a console error, a page error, a failed
// request or an HTTP error.
//
//   node e2e/calendar-drop-on-list-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                              [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("calendar-drop-on-list");
const id = Date.now().toString(36);
const person = { name: `cdchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };

const windowOf = (page) => page.getByRole("region", { name: "Calendar" });
const listRow = (page, name) => windowOf(page).locator(`[data-calendar="${name}"]`);
const block = (page) =>
  windowOf(page).locator("[data-event-id]:not([data-event-id^='holiday-'])").first();
const made = async (page) => {
  const reply = await page.request.get(new URL("/api/calendar/events", page.url()).href);
  return ((await reply.json()).events ?? []).find((event) => event.title === "New Event");
};
const drag = async (page, onto) => {
  const from = await block(page).boundingBox();
  const to = await onto.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 - 20, from.y + from.height / 2 + 4, { steps: 3 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
};

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", person);
  await openFromDock(page, "Calendar");
  await windowOf(page).locator(".mac-calendar-body:not([inert])").waitFor({ timeout: 20_000 });
  await page.waitForTimeout(500);
  // Month shows the event at any hour; Week scrolls the small hours out of sight.
  await page.keyboard.press("Control+3");
  await page.keyboard.press("Control+n");
  await block(page).waitFor({ timeout: 10_000 });
  await page.keyboard.press("Escape");
  await within(10_000, async () => Boolean(await made(page)));
  const before = await made(page);
  const other = before.calendar === "home" ? "work" : "home";

  await drag(page, listRow(page, other));
  const moved = await within(10_000, async () => (await made(page)).calendar === other);
  const after = await made(page);
  step(
    "Dragged onto a calendar in the list, it goes there, with its times as they were",
    moved !== null && after.start === before.start && after.end === before.end,
    JSON.stringify(after),
  );
  await page.waitForTimeout(300);
  await shot(page, "calendar-drop-on-list");

  await drag(page, listRow(page, "holidays"));
  await page.waitForTimeout(800);
  step(
    "Dragged onto a calendar that is not the person's, it stays",
    (await made(page)).calendar === other,
  );

  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "View", exact: true })
    .first()
    .click();
  const declined = page
    .getByRole("menu")
    .last()
    .getByRole("menuitemcheckbox", { name: "Show Declined Invitations" });
  step(
    "View holds Show Declined Invitations",
    (await within(5_000, () => declined.isVisible())) !== null,
  );
  await page.keyboard.press("Escape");
});

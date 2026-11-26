#!/usr/bin/env node
// Calendar's event commands on Ferrite in a real browser against the running app: Copy, Paste,
// Duplicate, Cut, Undo and Redo with their keys, and the contextual menus of an event and of an
// empty day. Exits 0 only when every step passed and no page logged a console error, a page error,
// a failed request or an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/calendar-events-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                        [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("calendar-events");
const id = Date.now().toString(36);
const person = { name: `cechris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };

const window = (page) => page.getByRole("region", { name: "Calendar" });
const blocks = (page) => window(page).locator("[data-event-id]:not([data-event-id^='holiday-'])");

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", person);
  await openFromDock(page, "Calendar");
  await within(15_000, () => window(page).isVisible());
  const count = (wanted) => within(4_000, async () => (await blocks(page).count()) === wanted);
  const press = async (keys) => {
    await page.waitForTimeout(150);
    await page.keyboard.press(keys);
  };

  await press("Control+3");
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "File", exact: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "New Event" }).first().click();
  step("New Event makes one", (await count(1)) !== null);
  await press("Escape");

  await blocks(page).first().click();
  await press("Control+D");
  step("Command-D duplicates it", (await count(2)) !== null);
  await press("Control+Z");
  step("Command-Z takes the duplicate back", (await count(1)) !== null);
  await press("Control+Shift+Z");
  step("Shift-Command-Z makes it again", (await count(2)) !== null);
  await press("Control+Z");
  await count(1);

  await blocks(page).first().click();
  await press("Control+C");
  await press("Control+V");
  step("Command-C and Command-V paste a copy", (await count(2)) !== null);

  await blocks(page).first().click({ button: "right" });
  const menu = page.getByRole("menu", { name: "Event commands" });
  step(
    "a secondary click on an event opens its menu",
    (await within(3_000, () => menu.isVisible())) !== null,
  );
  await shot(page, "calendar-event-menu");
  await menu.getByRole("menuitem", { name: "Cut" }).click();
  step("Cut in its menu removes it", (await count(1)) !== null);

  const empty = window(page).locator(".mac-calendar-month-cell:not(:has([data-event-id]))").nth(10);
  const day = await empty.getAttribute("data-day");
  await empty.click({ button: "right", position: { x: 20, y: 60 } });
  await within(3_000, () => menu.isVisible());
  await shot(page, "calendar-day-menu");
  await menu.getByRole("menuitem", { name: "Paste" }).click();
  const inDay = window(page).locator(`[data-day="${day}"] [data-event-id]`);
  step(
    "Paste in an empty day's menu puts the event there",
    (await within(4_000, () => inDay.isVisible())) !== null,
  );

  await window(page)
    .locator(`[data-day="${day}"]`)
    .click({ button: "right", position: { x: 20, y: 60 } });
  await menu.getByRole("menuitem", { name: "New All-Day Event" }).click();
  const allDay = window(page).locator(`[data-day="${day}"] [data-all-day]`);
  step(
    "New All-Day Event makes one in that day",
    (await within(4_000, () => allDay.isVisible())) !== null,
  );
  await press("Escape");

  await page.waitForTimeout(1_500);
  await page.reload();
  await window(page)
    .waitFor({ timeout: 8_000 })
    .catch(() => openFromDock(page, "Calendar"));
  await press("Control+3");
  step(
    "the pasted and new events are still there after a reload",
    (await within(8_000, async () => (await inDay.count()) === 2)) !== null,
  );
});

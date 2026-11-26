#!/usr/bin/env node
// Quick Event: the plus held offers a field, and Lunch at noon tomorrow makes that event, read from the
// server and after a reload. A plain click still makes an event at once; File > Quick Event… offers the
// field too.

import {
  blocks,
  menuPath,
  named,
  openCalendar,
  reopen,
  seen,
  stored,
  windowOf,
} from "./calendar-kit.mjs";
import { twoPeople } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("calendar-quick-event");
const id = Date.now().toString(36);
const chris = { name: `cqchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };

await run({}, {}, async ({ person }) => {
  const page = await person("chris", chris);
  await openCalendar(page);
  const plus = windowOf(page).getByRole("button", { name: "New Event" });
  const field = page.getByRole("textbox", { name: "Quick Event" });
  const box = await plus.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  step("The plus held offers a field", await seen(() => field.isVisible()));
  await page.waitForTimeout(300);
  step(
    "and it stays open after the button is let go, with no event made",
    (await field.isVisible()) && (await stored(page)).length === 0,
  );
  await page.keyboard.type("Lunch at noon tomorrow");
  await shot(page, "calendar-quick-event");
  await page.keyboard.press("Enter");
  const now = new Date();
  const noon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12).getTime();
  step(
    "Lunch at noon tomorrow is that event, an hour long, on the server",
    await seen(async () => {
      const lunch = named(await stored(page), "Lunch");
      return lunch?.start === noon && lunch.end === noon + 36e5 && !lunch.allDay;
    }),
  );
  step(
    "The field has gone, and the event is selected in the view",
    await seen(
      async () =>
        (await field.count()) === 0 &&
        (await windowOf(page)
          .locator('[data-event-id][aria-pressed="true"]')
          .filter({ hasText: "Lunch" })
          .count()) === 1,
    ),
  );
  await shot(page, "calendar-quick-event-made");

  const lunchBlock = () => blocks(page).filter({ hasText: "Lunch" });
  await page.waitForTimeout(800);
  await reopen(page);
  step(
    "After a reload the lunch is on the server and drawn at noon",
    named(await stored(page), "Lunch")?.start === noon &&
      (await seen(async () =>
        /, 12 PM/.test((await lunchBlock().getAttribute("aria-label")) ?? ""),
      )),
  );

  await menuPath(page, "File", "Quick Event…");
  await field.fill("Team offsite next Monday at Pier 39");
  await field.press("Enter");
  step(
    "File > Quick Event… makes an all-day event with its place",
    await seen(async () => {
      const trip = named(await stored(page), "Team offsite");
      return trip?.allDay === true && trip.location === "Pier 39";
    }),
  );

  await page.keyboard.press("Escape");
  const fitting = (await stored(page)).length;
  const refused = page.getByRole("alertdialog").filter({ hasText: "can\u2019t be made" });
  for (const line of ["Meeting in 999999999 days", "Meeting for 999999999 hours"]) {
    await menuPath(page, "File", "Quick Event\u2026");
    await field.fill(line);
    await field.press("Enter");
    step(
      `"${line}" is refused aloud, and makes nothing`,
      (await seen(() => refused.isVisible())) && (await stored(page)).length === fitting,
    );
    await refused.getByRole("button", { name: "OK" }).click();
    await refused.waitFor({ state: "hidden", timeout: 5_000 });
  }
  await menuPath(page, "File", "Quick Event\u2026");
  await field.fill("Standup tomorrow at 9am");
  await field.press("Enter");
  step(
    "An ordinary line after them still makes its event, on the server",
    await seen(async () => (await stored(page)).length === fitting + 1),
  );

  await page.keyboard.press("Escape");
  const before = (await stored(page)).length;
  await plus.click();
  step(
    "A plain click still makes an event at once",
    await seen(
      async () =>
        (await stored(page)).length === before + 1 &&
        (await page.getByRole("textbox", { name: "Title" }).isVisible()),
    ),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
});

#!/usr/bin/env node
// Preferences > Alerts sets the alert new events start with, and Snooze puts an alert off: it comes back
// after a reload at its moment, and Close ends it. Read from the server.

import {
  menuPath,
  named,
  openCalendar,
  putEvents,
  reopen,
  seen,
  stored,
  storedSettings,
  timed,
  windowOf,
} from "./calendar-kit.mjs";
import { twoPeople } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("calendar-default-alerts");
const id = Date.now().toString(36);
const chris = { name: `cachris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };

async function choose(page, name, option) {
  await page.getByRole("combobox", { name, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

await run({}, {}, async ({ person }) => {
  const page = await person("chris", chris);
  await openCalendar(page);

  await menuPath(page, "Calendar", /^Preferences/);
  await page.getByRole("tab", { name: "Alerts" }).click();
  await choose(page, "Events:", "15 minutes before");
  await choose(page, "All Day Events:", "1 day before (9 AM)");
  step(
    "Preferences > Alerts is on the server",
    await seen(async () => {
      const saved = await storedSettings(page);
      return saved?.defaultAlert === 15 && saved?.defaultAllDayAlert === 900;
    }),
  );
  await shot(page, "calendar-preferences-alerts");
  await page
    .getByRole("region", { name: "Alerts" })
    .last()
    .getByRole("button", { name: "Close" })
    .click();

  await windowOf(page).getByRole("button", { name: "New Event" }).click();
  step(
    "A new event starts with that alert",
    await seen(async () => named(await stored(page), "New Event")?.alert === 15),
  );
  await page.keyboard.press("Escape");

  const start = Date.now() + 30 * 60_000;
  await putEvents(page, [timed("due", "Soon", start, 60, { alert: 60 })]);
  await reopen(page);
  const alert = page
    .locator(".mac-calendar-alerts > [data-event-alert]")
    .filter({ hasText: "Soon" });
  step("An event's alert shows, with Close and Snooze", await seen(() => alert.isVisible()));
  await alert.getByRole("button", { name: "Snooze" }).click();
  await shot(page, "calendar-alert-snooze");
  await page.getByRole("menuitem", { name: "5 minutes", exact: true }).click();
  step("Snooze puts it away", await seen(async () => (await alert.count()) === 0));
  step(
    "Five minutes on, on the server",
    await seen(async () => {
      const snooze = named(await stored(page), "Soon")?.alertSnooze;
      return snooze?.start === start && Math.abs(snooze.until - Date.now() - 5 * 60_000) < 30_000;
    }),
  );
  await page.waitForTimeout(800);
  await reopen(page);
  step("After a reload it stays away", await seen(async () => (await alert.count()) === 0, 2_000));

  // Its moment brought forward, as if the five minutes had passed.
  const until = Date.now() + 4_000;
  await putEvents(page, [
    timed("due", "Soon", start, 60, { alert: 60, alertSnooze: { start, until } }),
  ]);
  await reopen(page);
  step("At its moment it comes back by itself", await seen(() => alert.isVisible(), 15_000));
  await shot(page, "calendar-alert-back");
  await alert.getByRole("button", { name: "Close" }).click();
  step(
    "Close ends it, on the server",
    await seen(async () => {
      const event = named(await stored(page), "Soon");
      return event?.alertDismissed === start && event.alertSnooze === undefined;
    }),
  );
  await page.waitForTimeout(800);
  await reopen(page);
  step(
    "After a reload it stays closed",
    await seen(async () => (await alert.count()) === 0, 2_000),
  );
});

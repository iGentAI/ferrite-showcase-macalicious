#!/usr/bin/env node
// Reminders' custom repeat, in a real browser against the running app. Custom in the info popover gives a
// rule, kept on the server and after a reload, and completing the reminder moves it to the rule's next day.
// Exits 0 only when every step passed and no page logged a console error, a page error, a failed request or
// an HTTP error.
//
//   node e2e/reminders-custom-repeat-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("reminders-custom-repeat");
const id = Date.now().toString(36);
const chris = { name: `rrchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const TITLE = `Water ${id}`;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const stored = async (page) => {
  const reply = await page.request.get(new URL("/api/reminders/data", page.url()).href);
  const { data } = await reply.json();
  return data?.reminders.find((each) => each.title === TITLE);
};
const seen = (check) => within(10_000, check).then((took) => took !== null);
const windowOf = (page) => page.getByRole("region", { name: "Reminders" });
const rowOf = (page) => windowOf(page).getByRole("option").filter({ hasText: TITLE });
const openInfo = async (page) => {
  await rowOf(page).hover();
  await rowOf(page).locator("[data-reminder-info]").click();
};
const daysAfter = (day, days) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", chris);
  await openFromDock(page, "Reminders");
  await windowOf(page).getByRole("button", { name: "New Reminder" }).click();
  await page.keyboard.type(TITLE);
  await page.keyboard.press("Enter");
  await rowOf(page).waitFor({ timeout: 5_000 });
  await openInfo(page);
  await page.getByRole("checkbox", { name: "On a Day" }).click();
  await page.getByRole("combobox", { name: "repeat", exact: true }).click();
  await page.getByRole("option", { name: "Custom" }).click();
  step(
    "Custom starts as every week on the due day",
    await seen(async () => {
      const reminder = await stored(page);
      return reminder?.repeat === "custom" && reminder.repeatRule?.unit === "week";
    }),
  );

  const { due } = await stored(page);
  const today = new Date(`${due}T00:00:00Z`).getUTCDay();
  const other = (today + 2) % 7;
  await page.getByRole("textbox", { name: "every", exact: true }).fill("2");
  await page.getByRole("checkbox", { name: WEEKDAYS[other] }).click();
  step(
    "every 2 weeks on another weekday as well is kept on the server",
    await seen(async () => {
      const rule = (await stored(page))?.repeatRule;
      return rule?.every === 2 && rule.weekdays?.includes(today) && rule.weekdays.includes(other);
    }),
  );
  await page.waitForTimeout(300);
  await shot(page, "reminders-custom-repeat");
  await page.keyboard.press("Escape");

  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Reminders").catch(() => {});
  await rowOf(page).waitFor({ timeout: 15_000 });
  await openInfo(page);
  const every = page.getByRole("textbox", { name: "every", exact: true });
  step(
    "after a reload the popover shows the rule",
    await seen(
      async () =>
        (await every.inputValue()) === "2" &&
        (await page.getByRole("checkbox", { name: WEEKDAYS[other] }).isChecked()),
    ),
  );

  await page.getByRole("combobox", { name: "Repeat unit" }).click();
  await page.getByRole("option", { name: "Days" }).click();
  await every.fill("10");
  await seen(async () => (await stored(page))?.repeatRule?.every === 10);
  await page.keyboard.press("Escape");
  await rowOf(page).locator("[data-reminder-toggle]").click();
  step(
    "completing it moves it ten days on, still to do",
    await seen(async () => {
      const reminder = await stored(page);
      return reminder?.due === daysAfter(due, 10) && !reminder.completed;
    }),
  );

  await openInfo(page);
  await page.getByRole("combobox", { name: "repeat", exact: true }).click();
  await page.getByRole("option", { name: "Every Week", exact: true }).click();
  step(
    "another repeat lets the rule go",
    await seen(async () => {
      const reminder = await stored(page);
      return reminder?.repeat === "weekly" && reminder.repeatRule === undefined;
    }),
  );
  await page.keyboard.press("Escape");
});

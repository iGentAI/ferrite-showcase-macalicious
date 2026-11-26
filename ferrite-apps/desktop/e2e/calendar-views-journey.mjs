#!/usr/bin/env node
// Calendar's year view shades a day by its events, and its day view keeps the details of the selected
// event beside the day, which edit it. Read from the server and after a reload.

import {
  blocks,
  named,
  openCalendar,
  putEvents,
  reopen,
  seen,
  stored,
  timed,
  weekDay,
  windowOf,
} from "./calendar-kit.mjs";
import { twoPeople } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("calendar-views");
const id = Date.now().toString(36);
const chris = { name: `cvchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const keyOf = (ms) => {
  const day = new Date(ms);
  return `${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`;
};

await run({}, {}, async ({ person }) => {
  const page = await person("chris", chris);
  const one = weekDay(1, 9);
  const two = weekDay(2, 9);
  const five = weekDay(3, 9);
  await putEvents(page, [
    timed("lone", "Lone", one),
    timed("p1", "Pair one", two),
    timed("p2", "Pair two", two + 36e5),
    ...[0, 1, 2, 3, 4].map((n) => timed(`b${n}`, `Busy ${n}`, five + n * 36e5)),
  ]);
  await openCalendar(page);
  await page.keyboard.press("Control+4");
  const day = (ms) =>
    windowOf(page).locator(
      `.mac-calendar-year-month [data-date="${keyOf(ms)}"]:not([data-outside])`,
    );
  step(
    "A day with one event has the first shade",
    await seen(async () => (await day(one).getAttribute("data-density")) === "1"),
  );
  step("A day with two the second", (await day(two).getAttribute("data-density")) === "2");
  step("A day with five the last", (await day(five).getAttribute("data-density")) === "4");
  step("An empty day has none", (await day(weekDay(5)).getAttribute("data-density")) === null);
  step("Its tip says how many", (await day(five).getAttribute("title")) === "5 events");
  await shot(page, "calendar-year-density");

  await day(two).click();
  const pane = windowOf(page).getByRole("complementary", { name: "Details" });
  step(
    "A day of the year opens the day view, with its list beside it",
    await seen(() => pane.getByRole("button", { name: "Show Pair one" }).isVisible()),
  );
  await pane.getByRole("button", { name: "Show Pair one" }).click();
  step(
    "Its row selects the event, whose details fill the pane",
    await seen(() => pane.getByRole("button", { name: "Title: Pair one" }).isVisible()),
  );
  await blocks(page).filter({ hasText: "Pair two" }).click();
  step(
    "Clicking another event shows its details",
    await seen(() => pane.getByRole("button", { name: "Title: Pair two" }).isVisible()),
  );
  await pane.getByRole("button", { name: "Add Location" }).click();
  await pane.getByRole("textbox", { name: "Location" }).fill("Room 5");
  await pane.getByRole("textbox", { name: "Location" }).press("Enter");
  step(
    "An edit in the pane is on the server",
    await seen(async () => named(await stored(page), "Pair two")?.location === "Room 5"),
  );
  await shot(page, "calendar-day-details");

  await reopen(page);
  step(
    "After a reload the day view keeps its pane, with the day's list",
    await seen(() =>
      windowOf(page)
        .getByRole("complementary", { name: "Details" })
        .getByRole("button", { name: "Show Pair two" })
        .isVisible(),
    ),
  );
  await windowOf(page)
    .getByRole("complementary", { name: "Details" })
    .getByRole("button", { name: "Show Pair two" })
    .click();
  step(
    "and the location",
    await seen(() =>
      windowOf(page)
        .getByRole("complementary", { name: "Details" })
        .getByText("Room 5")
        .isVisible(),
    ),
  );
});

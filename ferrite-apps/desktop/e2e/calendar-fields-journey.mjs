#!/usr/bin/env node
// The popover's Show As and Travel Time, stored and drawn, and Edit > Show Inspector: read from the
// server and after a reload.

import {
  blocks,
  menuPath,
  named,
  openCalendar,
  putEvents,
  reopen,
  seen,
  stored,
  timed,
  weekDay,
} from "./calendar-kit.mjs";
import { twoPeople } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("calendar-fields");
const id = Date.now().toString(36);
const chris = { name: `cfchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const travelBlock = (page) => page.locator("[data-event-id^='travel-time-of-']");

async function choose(page, scope, name, option) {
  await scope.getByRole("combobox", { name }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

await run({}, {}, async ({ person }) => {
  const page = await person("chris", chris);
  const start = weekDay(3, 13);
  await putEvents(page, [timed("a", "Clinic", start), timed("b", "Other", weekDay(2, 13))]);
  await openCalendar(page);
  await blocks(page).filter({ hasText: "Clinic" }).dblclick();
  const popover = page.locator(".mac-calendar-popover");
  await popover.getByRole("button", { name: /^Date: / }).click();
  await choose(page, popover, "Travel time", "30 minutes");
  step(
    "Travel Time is on the server",
    await seen(async () => named(await stored(page), "Clinic")?.travelTime === 30),
  );
  await choose(page, popover, "Show as", "Free");
  step(
    "Show As is on the server",
    await seen(async () => named(await stored(page), "Clinic")?.showAs === "free"),
  );
  await shot(page, "calendar-popover-fields");
  await popover.getByRole("button", { name: "Done" }).click();
  step(
    "The popover says both",
    (await popover.getByText("Travel time 30 minutes").isVisible()) &&
      (await popover.getByText("Show as Free").isVisible()),
  );
  await page.keyboard.press("Escape");

  const clinic = blocks(page).filter({ hasText: "Clinic" }).first();
  step(
    "The week draws the travel above the event",
    await seen(async () => {
      const above = await travelBlock(page).boundingBox();
      const event = await clinic.boundingBox();
      return (
        Math.abs(above.y + above.height - event.y) < 4 && above.height > 15 && above.height < 30
      );
    }),
  );
  step("A free event is marked", (await clinic.getAttribute("data-free")) !== null);
  await shot(page, "calendar-free-travel");

  await reopen(page);
  step(
    "After a reload the popover's values are kept",
    await seen(async () => {
      const event = named(await stored(page), "Clinic");
      return (
        event?.showAs === "free" &&
        event.travelTime === 30 &&
        (await travelBlock(page).count()) === 1
      );
    }),
  );

  step(
    "No Inspector at first",
    (await page.getByRole("region", { name: "Inspector" }).count()) === 0,
  );
  await menuPath(page, "Edit", "Show Inspector");
  const shown = page.getByRole("region", { name: "Inspector" });
  step(
    "Edit > Show Inspector shows it, with nothing selected",
    await seen(() => shown.getByText("No Event Selected").isVisible()),
  );
  await blocks(page).filter({ hasText: "Clinic" }).first().click();
  step(
    "It follows the selection",
    await seen(() => shown.getByRole("button", { name: "Title: Clinic" }).isVisible()),
  );
  await shown.getByRole("button", { name: /^Date: / }).click();
  await choose(page, shown, "Show as", "Busy");
  step(
    "An edit there is on the server",
    await seen(async () => {
      const clinic = named(await stored(page), "Clinic");
      return clinic !== undefined && clinic.showAs === undefined && clinic.travelTime === 30;
    }),
  );
  step(
    "and the block in the week follows it",
    await seen(
      async () =>
        (await blocks(page).filter({ hasText: "Clinic" }).first().getAttribute("data-free")) ===
        null,
    ),
  );
  await shot(page, "calendar-inspector");
  await blocks(page).filter({ hasText: "Other" }).first().click();
  step(
    "It shows another event when that one is selected",
    await seen(() => shown.getByRole("button", { name: "Title: Other" }).isVisible()),
  );
  await page.waitForTimeout(500);
  await reopen(page);
  step(
    "It is still shown after a reload",
    await seen(() => page.getByRole("region", { name: "Inspector" }).isVisible()),
  );
  await page.keyboard.press("Control+Alt+i");
  step(
    "Option-Command-I hides it",
    await seen(async () => (await page.getByRole("region", { name: "Inspector" }).count()) === 0),
  );
});

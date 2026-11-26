#!/usr/bin/env node
// Calendar on Ferrite in a real browser against the running app: a double click on the empty grid
// makes an event there, and the repeat editor sets an interval and weekdays, read back after a
// reload. Exits 0 only when every step passed and no page logged a console error, a page error, a
// failed request or an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/calendar-grid-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                      [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("calendar-grid");
const id = Date.now().toString(36);
const person = { name: `cgchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };

const windowOf = (page) => page.getByRole("region", { name: "Calendar" });
const blocks = (page) => windowOf(page).locator("[data-event-id]");

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", person);
  await openFromDock(page, "Calendar");
  await within(15_000, () => windowOf(page).isVisible());
  await page.waitForTimeout(500);

  const column = windowOf(page).locator(".mac-calendar-week-grid-column").nth(3);
  await column.waitFor({ timeout: 10_000 });
  await column.dblclick({ position: { x: 30, y: 100 } });
  const made = await within(5_000, async () => (await blocks(page).count()) === 1);
  step("a double click on the week grid makes an event", made !== null);
  const popover = page.getByRole("dialog").first();
  await within(4_000, () => popover.isVisible());
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await blocks(page).first().dblclick();
  await within(4_000, () => popover.isVisible());

  await popover.getByRole("button", { name: /^Date: / }).click();
  await popover.getByLabel("Repeat", { exact: true }).click();
  await page.getByRole("option", { name: "Every Week" }).click();
  const interval = popover.getByRole("textbox", { name: "Repeat interval" });
  await interval.fill("100");
  await interval.press("Enter");
  const refused = await within(3_000, () =>
    popover.getByRole("alert").filter({ hasText: "1 to 99" }).isVisible(),
  );
  step(
    "an interval the server would not keep is refused, and said",
    refused !== null && (await interval.inputValue()) === "1",
    await interval.inputValue(),
  );
  await interval.fill("2");
  await interval.press("Enter");
  await popover.getByRole("checkbox", { name: "Tuesday" }).click();
  await popover.getByRole("checkbox", { name: "Thursday" }).click();
  await shot(page, "calendar-repeat-editor");
  await popover.getByRole("button", { name: "Done" }).click();
  const summary = await within(4_000, async () =>
    /Every 2 Weeks on .*Tue.*Thu/.test(await popover.innerText()),
  );
  step(
    "the repeat says every two weeks on those days",
    summary !== null,
    await popover.innerText(),
  );
  await page.keyboard.press("Escape");

  await page.waitForTimeout(1_500);
  await page.reload();
  await windowOf(page)
    .waitFor({ timeout: 8_000 })
    .catch(() => openFromDock(page, "Calendar"));
  await within(8_000, async () => (await blocks(page).count()) > 0);
  await blocks(page).first().dblclick();
  await within(4_000, () => popover.isVisible());
  step(
    "it is still so after a reload",
    /Every 2 Weeks on .*Tue.*Thu/.test(await popover.innerText()),
    await popover.innerText(),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  await page.keyboard.press("Control+3");
  const empty = windowOf(page)
    .locator(".mac-calendar-month-cell:not(:has([data-event-id]))")
    .nth(8);
  await empty.waitFor({ timeout: 4_000 });
  const day = await empty.getAttribute("data-day");
  await empty.dblclick({ position: { x: 20, y: 60 } });
  const inDay = windowOf(page).locator(`[data-day="${day}"] [data-event-id]`);
  step(
    "a double click on a day of the month makes an event there",
    (await within(4_000, () => inDay.isVisible())) !== null,
  );
});

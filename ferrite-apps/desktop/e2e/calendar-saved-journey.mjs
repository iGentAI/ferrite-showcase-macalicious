#!/usr/bin/env node
// Calendar keeps what its window shows across a reload, on Ferrite in a real browser against the
// running app: the view, the date, the unticked calendars and the hidden list. Exits 0 only when every
// step passed and no page logged a console error, a page error, a failed request or an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/calendar-saved-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                       [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("calendar-saved");
const id = Date.now().toString(36);
const person = { name: `cschris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };

const windowOf = (page) => page.getByRole("region", { name: "Calendar" });
const heading = (page) => page.locator(".mac-calendar-heading-title").first();
const pressed = (page, name) =>
  windowOf(page)
    .getByRole("group", { name: "View" })
    .getByRole("button", { name, exact: true })
    .getAttribute("aria-pressed");

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", person);
  await openFromDock(page, "Calendar");
  await within(15_000, () => windowOf(page).isVisible());
  await page.waitForTimeout(1_000);

  await page.keyboard.press("Control+3");
  await within(4_000, async () => (await pressed(page, "Month")) === "true");
  await page.keyboard.press("Control+ArrowRight");
  await page.waitForTimeout(300);
  await page.keyboard.press("Control+ArrowRight");
  await within(4_000, async () => /[a-z] \d{4}$/.test(await heading(page).innerText()));
  await page.waitForTimeout(300);
  const shown = await heading(page).innerText();

  const ticks = windowOf(page).getByRole("tree", { name: "Calendars" }).getByRole("checkbox");
  const name = await ticks.first().getAttribute("aria-label");
  await ticks.first().click();
  await within(3_000, async () => (await ticks.first().getAttribute("aria-checked")) === "false");

  await page.waitForTimeout(500);
  await page.reload();
  await windowOf(page)
    .waitFor({ timeout: 8_000 })
    .catch(() => openFromDock(page, "Calendar"));
  const view = await within(10_000, async () => (await pressed(page, "Month")) === "true");
  step("the month view is back after a reload", view !== null);
  const date = await within(5_000, async () => (await heading(page).innerText()) === shown);
  step("on the date shown before", date !== null, await heading(page).innerText());
  const unticked = await within(
    5_000,
    async () => (await ticks.first().getAttribute("aria-checked")) === "false",
  );
  step("with the same calendar unticked", unticked !== null, name ?? "");
  await shot(page, "calendar-saved");

  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "View", exact: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Hide Calendar List" }).click();
  await within(3_000, async () => (await ticks.count()) === 0);
  await page.waitForTimeout(500);
  await page.reload();
  await windowOf(page)
    .waitFor({ timeout: 8_000 })
    .catch(() => openFromDock(page, "Calendar"));
  await within(10_000, async () => (await pressed(page, "Month")) === "true");
  await page.waitForTimeout(500);
  step("a hidden list stays hidden", (await ticks.count()) === 0);
});

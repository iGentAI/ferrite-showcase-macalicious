#!/usr/bin/env node
// Calendar's View > Make Text Bigger and Smaller, in a real browser against the running app: the month
// view's text grows and shrinks by the menu and by the keys, and a reload keeps it. Exits 0 only when every
// step passed and no page logged a console error, a page error, a failed request or an HTTP error.
//
//   node e2e/calendar-text-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("calendar-text");
const id = Date.now().toString(36);
const chris = { name: `ctchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };

const seen = (check) => within(8_000, check).then((took) => took !== null);
const windowOf = (page) => page.getByRole("region", { name: "Calendar" }).first();
const size = (page) =>
  windowOf(page)
    .locator(".mac-calendar-month")
    .first()
    .evaluate((el) =>
      Number.parseFloat(getComputedStyle(el).getPropertyValue("--mac-calendar-month-font-size")),
    );
const viewRow = async (page, name) => {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "View", exact: true })
    .first()
    .click();
  await page.getByRole("menu").last().getByRole("menuitem", { name }).click();
};

await run({}, {}, async ({ person }) => {
  const page = await person("chris", chris);
  await openFromDock(page, "Calendar", undefined).catch(() => {});
  await within(15_000, () => windowOf(page).isVisible());
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "View", exact: true })
    .first()
    .click();
  await page
    .getByRole("menu")
    .last()
    .locator('[role^="menuitem"]', { hasText: "Month" })
    .first()
    .click();
  await within(8_000, () => windowOf(page).locator(".mac-calendar-month").first().isVisible());
  step("the month view starts at its normal size", (await size(page)) === 11);
  await viewRow(page, "Make Text Bigger");
  step(
    "Make Text Bigger makes it a point bigger",
    await seen(async () => (await size(page)) === 12),
  );
  await page.keyboard.press("Control+=");
  step("and so does its key", await seen(async () => (await size(page)) === 13));
  await page.keyboard.press("Control+-");
  step(
    "Make Text Smaller's key takes a point off",
    await seen(async () => (await size(page)) === 12),
  );
  await shot(page, "calendar-text-bigger");
  await page.waitForTimeout(800);
  await page.reload();
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  if (!(await windowOf(page).isVisible()))
    await openFromDock(page, "Calendar", undefined).catch(() => {});
  await within(10_000, () => windowOf(page).locator(".mac-calendar-month").first().isVisible());
  step("a reload keeps it", await seen(async () => (await size(page)) === 12));
});

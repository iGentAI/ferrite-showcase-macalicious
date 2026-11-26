#!/usr/bin/env node
// Reminders' View menu on Ferrite in a real browser against the running app: the smart lists by
// their keys, and Sort By on a list of three reminders. Exits 0 only when every step passed and no
// page logged a console error, a page error, a failed request or an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/reminders-view-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                       [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("reminders-view");
const id = Date.now().toString(36);
const person = { name: `rvchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const TITLES = [`Mango ${id}`, `Apple ${id}`, `Zebra ${id}`];

const windowOf = (page) => page.locator('.mac-reminders[aria-label="Reminders"]').first();
const row = (page, title) => windowOf(page).getByRole("option").filter({ hasText: title }).first();
const order = async (page) => {
  const rows = await windowOf(page).getByRole("option").allInnerTexts();
  return rows.map((text) => TITLES.find((title) => text.includes(title))).filter(Boolean);
};
const inOrder = (page, wanted) =>
  within(4_000, async () => (await order(page)).join() === wanted.join());
const openView = (page) =>
  page.getByRole("menubar").getByRole("menuitem", { name: "View", exact: true }).first().click();
const sortBy = async (page, name) => {
  await openView(page);
  await page.getByRole("menuitem", { name: "Sort By" }).first().hover();
  await page.getByRole("menuitemradio", { name, exact: true }).click();
};

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", person);
  await openFromDock(page, "Reminders");
  await within(15_000, () => windowOf(page).isVisible());
  await page.waitForTimeout(500);
  for (const title of TITLES) {
    await page.keyboard.press("Control+N");
    await page.keyboard.type(title);
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
    await within(4_000, () => row(page, title).isVisible());
  }
  step("the reminders stand in the order they were made", (await inOrder(page, TITLES)) !== null);

  await row(page, TITLES[2]).click();
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "Edit", exact: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Priority" }).first().hover();
  await page.getByRole("menuitem", { name: "High", exact: true }).first().click();
  await row(page, TITLES[0]).click();
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "Edit", exact: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Add Date" }).first().hover();
  await page.getByRole("menuitem", { name: "Today", exact: true }).first().click();

  await sortBy(page, "Title");
  step(
    "Sort By > Title orders them A to Z",
    (await inOrder(page, [TITLES[1], TITLES[0], TITLES[2]])) !== null,
  );
  await sortBy(page, "Priority");
  step(
    "Sort By > Priority puts the high one first",
    (await within(4_000, async () => (await order(page))[0] === TITLES[2])) !== null,
  );
  await sortBy(page, "Due Date");
  step(
    "Sort By > Due Date puts the dated one first",
    (await within(4_000, async () => (await order(page))[0] === TITLES[0])) !== null,
  );
  await openView(page);
  await page.getByRole("menuitem", { name: "Sort By" }).first().hover();
  await shot(page, "reminders-sort-by");
  await page.getByRole("menuitemradio", { name: "Manual", exact: true }).click();
  step("Sort By > Manual gives their order back", (await inOrder(page, TITLES)) !== null);

  // Only the flagged one is listed.
  await row(page, TITLES[1]).click();
  await page.keyboard.press("Control+Shift+F");
  await page.keyboard.press("Control+4");
  step(
    "Command-4 shows Flagged: the flagged reminder alone",
    (await within(4_000, async () => (await order(page)).join() === TITLES[1])) !== null,
  );
  await page.keyboard.press("Control+3");
  step(
    "Command-3 shows All",
    (await within(4_000, async () => (await order(page)).length === 3)) !== null,
  );
});

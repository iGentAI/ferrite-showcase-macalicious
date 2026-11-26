#!/usr/bin/env node
// Contacts' Preferences window and name order, in a real browser against the running app: Display Last
// Name Before First turns the list's names and the card's title round, Preferences shows and changes the
// same choice, and it is kept across a reload. Exits 0 only when every step passed and no page logged a
// console error, a page error, a failed request or an HTTP error.
//
//   node e2e/contacts-preferences-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("contacts-preferences");
const id = Date.now().toString(36);
const chris = { name: `cpchris-${id}`, fullName: `Chris Marsh${id}`, password: `tide-${id}-pool` };
const first = `Chris Marsh${id}`;
const last = `Marsh${id} Chris`;

const seen = (check) => within(10_000, check).then((took) => took !== null);
const windowOf = (page) => page.locator(".mac-contacts").first();
const title = (page) => windowOf(page).locator(".mac-contacts-name").first();
const row = (page) => windowOf(page).getByRole("option").filter({ hasText: id }).first();
const menuRow = async (page, menu, name) => {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: menu, exact: true })
    .first()
    .click();
  await page
    .getByRole("menu")
    .last()
    .locator('[role^="menuitem"]', { hasText: name })
    .first()
    .click();
};

await run({}, {}, async ({ person }) => {
  const page = await person("chris", chris);
  await openFromDock(page, "Contacts", undefined).catch(() => {});
  await within(15_000, () => windowOf(page).isVisible());
  await within(10_000, async () => (await row(page).innerText()).includes(first));
  await row(page).click();
  step(
    "a card reads first name first by default",
    await seen(async () => (await title(page).innerText()) === first),
  );

  await menuRow(page, "View", "Display Last Name Before First");
  step(
    "Display Last Name Before First turns the title and the list's row round",
    await seen(
      async () =>
        (await title(page).innerText()) === last && (await row(page).innerText()).includes(last),
    ),
  );
  step(
    "and the row is named so for assistive technology",
    await seen(() =>
      windowOf(page)
        .getByRole("option", { name: new RegExp(`^${last}`) })
        .first()
        .isVisible(),
    ),
  );

  await menuRow(page, "Contacts", /^Preferences/);
  const prefs = page.locator(".mac-contacts-preferences").first();
  await prefs.waitFor({ timeout: 8_000 });
  const order = prefs.getByRole("combobox", { name: "Show first name" });
  step(
    "Preferences shows that choice",
    await seen(async () => (await order.innerText()).includes("Following last name")),
  );
  await shot(page, "contacts-preferences");
  await order.click();
  await page.getByRole("option", { name: "Before last name" }).click();
  step(
    "and changing it there changes the card",
    await seen(async () => (await title(page).innerText()) === first),
  );
  await order.click();
  await page.getByRole("option", { name: "Following last name" }).click();
  await seen(async () => (await title(page).innerText()) === last);

  await page.waitForTimeout(800);
  await page.reload();
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  if (!(await windowOf(page).isVisible()))
    await openFromDock(page, "Contacts", undefined).catch(() => {});
  step("a reload keeps it", await seen(async () => (await row(page).innerText()).includes(last)));
});

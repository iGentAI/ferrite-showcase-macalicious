#!/usr/bin/env node
// Contacts' View > Sort By and Card > Go to My Card on Ferrite in a real browser against the running
// app. Exits 0 only when every step passed and no page logged a console error, a page error, a
// failed request or an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/contacts-view-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                      [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("contacts-view");
const id = Date.now().toString(36);
const person = { name: `cvchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };

const windowOf = (page) => page.locator('.mac-contacts[aria-label="Contacts"]').first();
const rows = (page) => windowOf(page).getByRole("listbox").getByRole("option");
const selected = (page) => rows(page).and(page.locator('[aria-selected="true"]'));
const names = async (page) => (await rows(page).allInnerTexts()).map((text) => text.trim());
const menu = (page, title) =>
  page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true }).first().click();
const sortBy = async (page, name) => {
  await menu(page, "View");
  await page.getByRole("menuitem", { name: "Sort By" }).first().hover();
  await page.getByRole("menuitemradio", { name, exact: true }).click();
};

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", person);
  await openFromDock(page, "Contacts");
  await windowOf(page).locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });
  const done = windowOf(page).getByRole("button", { name: "Done" });
  await page.waitForTimeout(300);
  for (const [first, last] of [
    ["Anna", "Zed"],
    ["Zoe", "Able"],
  ]) {
    const count = await rows(page).count();
    await page.keyboard.press("Control+N");
    await done.waitFor({ timeout: 3_000 });
    await windowOf(page).getByRole("textbox", { name: /first/i }).first().fill(first);
    await windowOf(page).getByRole("textbox", { name: /last/i }).first().fill(last);
    await done.click();
    await within(3_000, async () => (await rows(page).count()) === count + 1);
  }
  const first = async () => (await names(page))[0] ?? "";
  const last = async () => (await names(page)).at(-1) ?? "";
  step(
    "by last name, Able comes first and Zed last",
    (await first()).includes("Able") && (await last()).includes("Zed"),
    (await names(page)).join(),
  );
  await sortBy(page, "First Name");
  step(
    "Sort By > First Name puts Anna first and Zoe last",
    (await within(
      3_000,
      async () => (await first()).includes("Anna") && (await last()).includes("Zoe"),
    )) !== null,
    (await names(page)).join(),
  );
  await menu(page, "View");
  await page.getByRole("menuitem", { name: "Sort By" }).first().hover();
  await shot(page, "contacts-sort-by");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  await rows(page).first().click();
  await menu(page, "Card");
  await page.getByRole("menuitem", { name: "Go to My Card" }).click();
  step(
    "Card > Go to My Card selects the person's own card",
    (await within(3_000, async () => (await selected(page).innerText()).includes("Chris"))) !==
      null,
  );
});

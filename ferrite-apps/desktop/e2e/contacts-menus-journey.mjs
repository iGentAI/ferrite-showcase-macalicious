#!/usr/bin/env node
// Contacts' menu keys on Ferrite in a real browser against the running app. Exits 0 only when every
// step passed and no page logged a console error, a page error, a failed request or an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/contacts-menus-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                       [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("contacts-menus");
const id = Date.now().toString(36);
const person = { name: `cmchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };

const windowOf = (page) => page.locator('.mac-contacts[aria-label="Contacts"]').first();
const rows = (page) => windowOf(page).getByRole("listbox").getByRole("option");
const selected = (page) => rows(page).and(page.locator('[aria-selected="true"]'));

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", person);
  await openFromDock(page, "Contacts");
  await windowOf(page).locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });
  const done = windowOf(page).getByRole("button", { name: "Done" });

  await page.waitForTimeout(300);
  await page.keyboard.press("Control+N");
  step("Command-N starts a card", (await within(3_000, () => done.isVisible())) !== null);
  const first = windowOf(page).getByRole("textbox", { name: /first/i }).first();
  await first.fill(`Anna${id}`);
  await done.click();
  await within(3_000, async () => (await rows(page).count()) === 2);

  await rows(page).first().click();
  const before = await selected(page).innerText();
  await page.keyboard.press("Control+]");
  const next = await within(3_000, async () => (await selected(page).innerText()) !== before);
  step("Command-] goes to the next card", next !== null);
  await page.keyboard.press("Control+[");
  const back = await within(3_000, async () => (await selected(page).innerText()) === before);
  step("Command-[ goes to the previous card", back !== null);

  await page.keyboard.press("Control+L");
  step("Command-L edits the card", (await within(3_000, () => done.isVisible())) !== null);
  await shot(page, "contacts-menus");
  await done.click();

  await page.keyboard.press("Control+F");
  const found = await within(3_000, () =>
    windowOf(page)
      .getByRole("searchbox")
      .evaluate((node) => node === document.activeElement),
  );
  step("Command-F goes to the search field", found !== null);
});

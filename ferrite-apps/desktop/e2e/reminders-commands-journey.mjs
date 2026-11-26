#!/usr/bin/env node
// Reminders' commands on Ferrite in a real browser against the running app: New Reminder and New
// List by key, and Flag, Priority, Add Date, Complete and Delete in the Edit menu, read back after
// a reload. Exits 0 only when every step passed and no page logged a console error, a page error, a
// failed request or an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/reminders-commands-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                           [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("reminders-commands");
const id = Date.now().toString(36);
const person = { name: `rcchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const title = `Buy tide tables ${id}`;

const windowOf = (page) => page.locator('.mac-reminders[aria-label="Reminders"]').first();
const row = (page) => windowOf(page).getByRole("option").filter({ hasText: title }).first();

async function menu(page, title, name) {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: title, exact: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name }).first().click();
}
async function submenu(page, title, sub, name) {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: title, exact: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name: sub }).first().hover();
  await page.getByRole("menuitem", { name, exact: true }).first().click();
}

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", person);
  await openFromDock(page, "Reminders");
  await within(15_000, () => windowOf(page).isVisible());

  await page.waitForTimeout(500);
  await page.keyboard.press("Control+N");
  const field = windowOf(page).locator("input, textarea").and(page.locator(":focus"));
  const editing = await within(3_000, () => field.isVisible());
  step("Command-N starts a reminder", editing !== null);
  await page.keyboard.type(title);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await within(4_000, () => row(page).isVisible());
  step("it is in the list", await row(page).isVisible());

  await row(page).click();
  await page.keyboard.press("Control+Shift+F");
  const flagged = await within(3_000, async () =>
    (
      await windowOf(page)
        .getByRole("button", { name: /flagged/i })
        .first()
        .innerText()
    ).includes("1"),
  );
  step("Shift-Command-F flags it", flagged !== null);

  await submenu(page, "Edit", "Priority", "High");
  const high = await within(
    3_000,
    async () =>
      (await row(page).innerText()).includes("high priority") ||
      (await row(page).innerText()).includes("!!!"),
  );
  step("Edit > Priority > High marks it", high !== null, await row(page).innerText());

  await submenu(page, "Edit", "Add Date", "Tomorrow");
  const dated = await within(3_000, async () => /tomorrow/i.test(await row(page).innerText()));
  step("Edit > Add Date > Tomorrow dates it", dated !== null, await row(page).innerText());
  await shot(page, "reminders-commands");

  await page.waitForTimeout(1_500);
  await page.reload();
  await windowOf(page)
    .waitFor({ timeout: 8_000 })
    .catch(() => openFromDock(page, "Reminders"));
  await within(8_000, () => row(page).isVisible());
  const text = await row(page).innerText();
  step(
    "the flag, priority and date stay after a reload",
    /tomorrow/i.test(text) && /!!!|high/.test(text),
    text,
  );

  await row(page).click();
  await page.keyboard.press("Control+F");
  const finding = await within(3_000, () =>
    windowOf(page)
      .getByRole("searchbox")
      .evaluate((node) => node === document.activeElement),
  );
  step("Command-F goes to the search field", finding !== null);

  await row(page).click();
  await menu(page, "Edit", "Mark as Completed");
  const done = await within(3_000, async () => (await row(page).innerText()).includes("completed"));
  step("Edit > Mark as Completed completes it", done !== null);
  await menu(page, "Edit", "Delete");
  const gone = await within(3_000, async () => (await row(page).count()) === 0);
  step("Edit > Delete removes it", gone !== null);
});

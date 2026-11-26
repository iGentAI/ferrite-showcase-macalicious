#!/usr/bin/env node
// Several reminders at once on Ferrite in a real browser against the running app: Control-click, Select
// All, and the contextual menu's commands over a selection, read back after a reload. Exits 0 only
// when every step passed and no page logged a console error, a page error, a failed request or an
// HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/reminders-many-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                       [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("reminders-many");
const id = Date.now().toString(36);
const person = { name: `rmchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const titles = ["One", "Two", "Three", "Four"].map((word) => `${word} ${id}`);

const windowOf = (page) => page.locator('.mac-reminders[aria-label="Reminders"]').first();
const rows = (page) => windowOf(page).getByRole("option");
const row = (page, title) => rows(page).filter({ hasText: title }).first();
// By attribute: an open menu hides what is behind it from the accessibility tree.
const picked = (page) => windowOf(page).locator('[role="option"][aria-selected="true"]').count();

async function add(page, title) {
  await page.keyboard.press("Control+N");
  await page.waitForTimeout(150);
  await page.keyboard.type(title);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await within(4_000, () => row(page, title).isVisible());
}

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", person);
  await openFromDock(page, "Reminders");
  await within(15_000, () => windowOf(page).isVisible());
  await page.waitForTimeout(500);
  for (const title of titles) await add(page, title);
  step("four reminders are in the list", (await rows(page).count()) >= 4);

  await row(page, titles[0]).click();
  await row(page, titles[1]).click({ modifiers: ["Control"] });
  step(
    "Control-click selects two",
    (await within(3_000, async () => (await picked(page)) === 2)) !== null,
  );

  await row(page, titles[1]).click({ button: "right" });
  const menu = page.getByRole("menu", { name: "Reminder commands" });
  step(
    "a secondary click keeps the selection and opens its menu",
    (await within(3_000, () => menu.isVisible())) !== null && (await picked(page)) === 2,
  );
  await shot(page, "reminders-many-menu");
  await menu.getByRole("menuitem", { name: "Flag" }).click();
  await row(page, titles[1]).click({ button: "right" });
  await menu.getByRole("menuitem", { name: "Mark as Completed" }).click();
  const done = await within(4_000, async () => {
    const one = await row(page, titles[0]).innerText();
    const two = await row(page, titles[1]).innerText();
    return one.includes("completed") && two.includes("completed");
  });
  step("its commands act on both", done !== null);
  const other = await row(page, titles[2]).innerText();
  step("and on no other", !other.includes("completed"), other);

  // A selection of one completed and one not: the command says what happens to both.
  await row(page, titles[2]).click();
  await row(page, titles[0]).click({ modifiers: ["Control"] });
  await row(page, titles[0]).click({ button: "right" });
  await menu.getByRole("menuitem", { name: "Mark as Completed" }).click();
  const both = await within(4_000, async () => {
    const one = await row(page, titles[0]).innerText();
    const three = await row(page, titles[2]).innerText();
    return one.includes("completed") && three.includes("completed");
  });
  step("a mixed selection ends up as the command says, on both", both !== null);

  await row(page, titles[2]).click();
  await row(page, titles[3]).click({ modifiers: ["Control"] });
  await page.keyboard.press("Delete");
  const gone = await within(
    4_000,
    async () =>
      (await row(page, titles[2]).count()) === 0 && (await row(page, titles[3]).count()) === 0,
  );
  step("the Delete key removes both", gone !== null);

  await page.waitForTimeout(1_500);
  await page.reload();
  await windowOf(page)
    .waitFor({ timeout: 8_000 })
    .catch(() => openFromDock(page, "Reminders"));
  // A completed reminder is listed only while Show Completed is on.
  await page.waitForTimeout(1_000);
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "View", exact: true })
    .first()
    .click();
  await page.getByRole("menuitemcheckbox", { name: "Show Completed" }).click();
  await within(8_000, () => row(page, titles[0]).isVisible());
  const kept = await row(page, titles[0]).innerText();
  step(
    "after a reload the two are completed and the others gone",
    kept.includes("completed") && (await row(page, titles[2]).count()) === 0,
    kept,
  );
  await row(page, titles[0]).click();
  await page.keyboard.press("Control+A");
  const all = await rows(page).count();
  step(
    "Command-A selects them all",
    (await within(3_000, async () => (await picked(page)) === all)) !== null,
    String(all),
  );
});

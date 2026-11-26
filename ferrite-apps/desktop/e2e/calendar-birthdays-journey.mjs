#!/usr/bin/env node
// Birthdays in Calendar come from the person's Contacts, in a real browser against the running app:
// with Show Birthdays calendar on, a birthday typed on a card shows on its day, says it belongs to
// Contacts, cannot be deleted from Calendar, and is there after a reload. Exits 0 only when every
// step passed and no page logged a console error, a page error, a failed request or an HTTP error.
//
//   node e2e/calendar-birthdays-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                           [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("calendar-birthdays");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `cbchris-${id}`, fullName: `Chris ${id}`, password };
const LAST = `B${id}`;
const today = new Date();
const TYPED = today.toLocaleDateString("en-US", { month: "long", day: "numeric" });
const TITLE = `Ada ${LAST}\u2019s Birthday`;

const contactsOf = (page) => page.locator('.mac-contacts[aria-label="Contacts"]').first();
const calendarOf = (page) => page.getByRole("region", { name: "Calendar" });
async function menu(page, title, name) {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: title, exact: true })
    .first()
    .click();
  await page.getByRole("menu").last().getByRole("menuitem", { name }).click();
}

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", chris);
  await openFromDock(page, "Calendar");
  await within(15_000, () => calendarOf(page).isVisible());
  await menu(page, "Calendar", /^Preferences/);
  await page.getByRole("checkbox", { name: "Show Birthdays calendar" }).click();
  await page.keyboard.press("Control+w");

  await openFromDock(page, "Contacts");
  const contacts = contactsOf(page);
  await contacts.locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });
  await menu(page, "File", /^New Card/);
  await contacts.getByRole("textbox", { name: "First" }).fill("Ada");
  await contacts.getByRole("textbox", { name: "Last" }).fill(LAST);
  await contacts.getByRole("textbox", { name: "birthday" }).fill(TYPED);
  await contacts.getByRole("button", { name: "Done" }).click();

  await openFromDock(page, "Calendar");
  const calendar = calendarOf(page);
  await page.keyboard.press("Control+3");
  await page.keyboard.press("Control+t");
  const event = calendar.locator('[data-event-id^="birthday-"]').first();
  step(
    "A birthday typed on a card shows on its day, with the calendar left open",
    (await within(20_000, () => event.isVisible())) !== null,
  );

  await event.dblclick();
  const note = page.getByText("Change it on the card in Contacts.");
  await within(5_000, () => note.isVisible());
  step(
    "Its popover names the card, says Contacts holds it, and offers nothing to edit",
    (await note.isVisible()) &&
      (await page.getByText(TITLE).first().isVisible()) &&
      (await page.getByRole("dialog").last().getByRole("textbox").count()) === 0,
  );
  await page.waitForTimeout(400);
  await shot(page, "calendar-birthdays");
  await page.keyboard.press("Escape");

  await event.click();
  await page.keyboard.press("Delete");
  await page.waitForTimeout(400);
  step("The Delete key leaves it", await event.isVisible());

  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Calendar").catch(() => {});
  step("It is there after a reload", (await within(20_000, () => event.isVisible())) !== null);
});

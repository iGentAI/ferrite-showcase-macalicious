#!/usr/bin/env node
// The invitee field of a Calendar event offers the person's contacts as they are typed, in a real
// browser against the running app: choosing one invites them, and the invitation reaches that
// person on the server. Exits 0 only when every step passed and no page logged a console error, a
// page error, a failed request or an HTTP error.
//
//   node e2e/calendar-invitee-offers-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                                [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("calendar-invitee-offers");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `cichris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `cimartin-${id}`, fullName: `Martin ${id}`, password };

const contactsOf = (page) => page.locator('.mac-contacts[aria-label="Contacts"]').first();

await run({}, {}, async ({ person: open }) => {
  const other = await open("martin", martin);
  const page = await open("chris", chris);
  await openFromDock(page, "Contacts");
  await contactsOf(page).locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });
  await contactsOf(page).getByRole("button", { name: "Contacts commands" }).click();
  await page.getByRole("menuitem", { name: "Add Desktop User…" }).click();
  const sheet = page.getByRole("dialog", { name: "Add a Desktop User" });
  await sheet.getByRole("textbox", { name: "Account Name" }).fill(martin.name);
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  await within(6_000, async () => (await sheet.count()) === 0);

  await openFromDock(page, "Calendar");
  await within(15_000, () => page.getByRole("region", { name: "Calendar" }).isVisible());
  await page.waitForTimeout(500);
  await page.keyboard.press("Control+n");
  const block = page.getByRole("region", { name: "Calendar" }).locator("[data-event-id]").first();
  await block.waitFor({ timeout: 15_000 });
  const add = page.getByRole("button", { name: "Add Invitees" });
  if (!(await add.isVisible())) await block.dblclick();
  await add.click({ timeout: 15_000 });
  const field = page.getByRole("textbox", { name: "Invitee" });
  await field.fill("Martin");
  const offer = page
    .getByRole("group", { name: "Contacts" })
    .getByRole("button", { name: martin.fullName });
  step(
    "Typing part of a contact's name offers that person",
    (await within(10_000, () => offer.isVisible())) !== null,
  );
  await shot(page, "calendar-invitee-offers");
  await offer.click();
  const listed = page.getByRole("list", { name: "Invitees" }).getByText(martin.fullName);
  step(
    "Choosing the person invites them, and takes the offer away",
    (await within(10_000, () => listed.isVisible())) !== null && (await field.inputValue()) === "",
  );
  await page.getByRole("button", { name: "Done" }).click();
  await page.keyboard.press("Escape");
  step(
    "The invitation reaches that person on the server",
    (await within(20_000, async () => {
      const reply = await other.request.get(new URL("/api/calendar/inbox", other.url()).href);
      const { invitations } = await reply.json();
      return invitations?.length === 1;
    })) !== null,
  );
});

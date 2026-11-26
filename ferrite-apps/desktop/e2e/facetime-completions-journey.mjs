#!/usr/bin/env node
// FaceTime's recipient field offers the person's contacts as they are typed, in a real browser against
// the running app: a card added while FaceTime is open is offered, choosing it fills the field with
// what to call, and the call rings for that person on the server. Exits 0 only when every step passed
// and no page logged a console error, a page error, a failed request or an HTTP error.
//
//   node e2e/facetime-completions-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                             [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("facetime-completions");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `fcchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `fcmartin-${id}`, fullName: `Martin ${id}`, password };

const contactsOf = (page) => page.locator('.mac-contacts[aria-label="Contacts"]').first();

await run({}, {}, async ({ person: open }) => {
  const other = await open("martin", martin);
  const page = await open("chris", chris);
  await openFromDock(page, "FaceTime");
  const facetime = page.getByRole("region", { name: "FaceTime" }).first();
  const field = facetime.getByRole("textbox", { name: "Recipient" });
  await within(10_000, () => field.isVisible());

  await openFromDock(page, "Contacts");
  await contactsOf(page).locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });
  await contactsOf(page).getByRole("button", { name: "Contacts commands" }).click();
  await page.getByRole("menuitem", { name: "Add Desktop User…" }).click();
  const sheet = page.getByRole("dialog", { name: "Add a Desktop User" });
  await sheet.getByRole("textbox", { name: "Account Name" }).fill(martin.name);
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  await within(6_000, async () => (await sheet.count()) === 0);

  await openFromDock(page, "FaceTime");
  await field.fill(martin.fullName.slice(0, 8));
  const offers = facetime.getByRole("group", { name: "Contacts" });
  const offer = offers.getByRole("button", { name: martin.fullName });
  step(
    "Typing part of a contact's name offers that person",
    (await within(15_000, () => offer.isVisible())) !== null,
  );
  await shot(page, "facetime-completions");
  await offer.click();
  step(
    "Choosing the person fills in what to call and takes the offer away",
    (await field.inputValue()) === martin.name && !(await offers.isVisible()),
    await field.inputValue(),
  );
  await field.press("Enter");
  step(
    "The call rings for that person on the server",
    (await within(20_000, async () => {
      const reply = await other.request.get(new URL("/api/facetime/calls", other.url()).href);
      const { incoming } = await reply.json();
      return incoming?.state?.members.some((member) => member.name === chris.name) === true;
    })) !== null,
  );
});

#!/usr/bin/env node
// Contacts' buttons on Ferrite in a real browser against the running app: from a desktop user's card,
// Message starts a message to them in Messages, Mail a New Message to them in Mail, and FaceTime
// video places a call to them. Exits 0 only when every step passed and no page logged a console
// error, a page error, a failed request or an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/contacts-reach-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                       [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("contacts-reach");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `crchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `crmartin-${id}`, fullName: `Martin ${id}`, password };

const contactsOf = (page) => page.locator('.mac-contacts[aria-label="Contacts"]').first();

await run(
  { chromium: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } },
  {},
  async ({ person: open }) => {
    await open("martin", martin);
    const page = await open("chris", chris);
    await openFromDock(page, "Contacts");
    await within(15_000, () => contactsOf(page).isVisible());

    await contactsOf(page).locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });
    await contactsOf(page).getByRole("button", { name: "Contacts commands" }).click();
    await page.getByRole("menuitem", { name: "Add Desktop User…" }).click();
    const sheet = page.getByRole("dialog", { name: "Add a Desktop User" });
    await sheet.getByRole("textbox", { name: "Account Name" }).fill(martin.name);
    await sheet.getByRole("button", { name: "Add", exact: true }).click();
    await within(6_000, async () => (await sheet.count()) === 0);

    await contactsOf(page).getByRole("button", { name: "message", exact: true }).click();
    const messages = page.locator('.mac-messages[aria-label="Messages"]').first();
    const to = messages.getByRole("textbox", { name: "To" });
    const addressed = await within(10_000, async () => (await to.inputValue()) === martin.name);
    step("Message starts a message to them in Messages", addressed !== null);
    await shot(page, "contacts-reach-messages");

    await openFromDock(page, "Contacts");
    await contactsOf(page).getByRole("button", { name: "mail", exact: true }).click();
    const toMail = await within(10_000, () =>
      page.getByText(`${martin.name}@macalicious`).first().isVisible(),
    );
    step("Mail starts a New Message to them", toMail !== null);
    await shot(page, "contacts-reach-mail");

    await openFromDock(page, "Contacts");
    await contactsOf(page).getByRole("button", { name: "FaceTime video" }).click();
    const calling = await within(15_000, async () => {
      const state = await page.locator("[data-call-state]").first().getAttribute("data-call-state");
      return state === "calling" || state === "connected";
    });
    step("FaceTime video places a call to them", calling !== null);
    await shot(page, "contacts-reach-facetime");
  },
);

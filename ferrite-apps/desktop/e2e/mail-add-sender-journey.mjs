#!/usr/bin/env node
// Mail's Add Sender to Contacts, in a real browser against the running app: a message from another
// person adds a card naming their account, opens Contacts on it, and asking again adds no second
// card; your own mail leaves the item dimmed. Exits 0 only when every step passed and no page logged a
// console error, a page error, a failed request or an HTTP error.
//
//   node e2e/mail-add-sender-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                        [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("mail-add-sender");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `aschris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `asmartin-${id}`, fullName: `Martin ${id}`, password };
const SUBJECT = `Hello ${id}`;

const viewer = (page) => page.locator(".mac-mail").first();
const compose = (page) => page.locator(".mac-mail-compose").first();
const rows = (page) => viewer(page).getByRole("listbox", { name: "Messages" }).getByRole("option");
const row = (page, text) =>
  rows(page)
    .filter({ has: page.getByText(text, { exact: true }) })
    .first();
const contacts = (page) => page.locator('.mac-contacts[aria-label="Contacts"]').first();
const message = (page) =>
  page.getByRole("menubar").getByRole("menuitem", { name: "Message", exact: true }).first();
const addItem = (page) =>
  page.getByRole("menu").last().getByRole("menuitem", { name: "Add Sender to Contacts" });

async function cards(page) {
  const reply = await page.request.get(new URL("/api/contacts/cards", page.url()).href);
  return ((await reply.json()).cards ?? []).filter((card) => card.user === martin.name);
}

await run({}, {}, async ({ person }) => {
  const sender = await person("martin", martin);
  const page = await person("chris", chris);
  await openFromDock(sender, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(sender).isVisible());
  await viewer(sender).getByRole("button", { name: "New Message" }).click();
  const to = compose(sender).getByLabel("To:");
  await to.fill(`${chris.name}@macalicious`);
  await compose(sender).getByLabel("Subject:").fill(SUBJECT);
  await compose(sender).getByRole("button", { name: "Send" }).click();

  await openFromDock(page, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(page).isVisible());
  await within(30_000, () => row(page, SUBJECT).isVisible());

  // The desktop answers with no such account, as for one deleted since the mail came.
  const USERS = /\/api\/contacts\/users\//;
  await page.route(USERS, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await row(page, SUBJECT).click();
  await page.waitForTimeout(800);
  await page.keyboard.press("Control+Shift+y");
  await message(page).click();
  step(
    "A sender the desktop has no account for leaves the item dimmed and its key doing nothing",
    (await addItem(page).getAttribute("aria-disabled")) === "true" &&
      (await cards(page)).length === 0,
  );
  await page.keyboard.press("Escape");
  await page.unroute(USERS);
  await viewer(page).getByRole("treeitem", { name: /^Sent/ }).click();
  await viewer(page)
    .getByRole("treeitem", { name: /^Inbox/ })
    .click();
  await within(10_000, () => row(page, SUBJECT).isVisible());
  await row(page, SUBJECT).click();
  await page.waitForTimeout(800);

  await message(page).click();
  await addItem(page).click();
  step(
    "Add Sender to Contacts makes a card naming the sender's account, on the server",
    (await within(20_000, async () => (await cards(page)).length === 1)) !== null,
  );
  step(
    "and shows it in Contacts under the sender's name",
    (await within(15_000, () =>
      contacts(page).getByRole("option").filter({ hasText: "Martin" }).first().isVisible(),
    )) !== null,
  );
  await page.waitForTimeout(400);
  await shot(page, "mail-add-sender");

  // Another card shown in Contacts, then back to Mail: the key must bring the sender's card back.
  await contacts(page).getByRole("option").filter({ hasText: "Chris" }).first().click();
  const senderRow = contacts(page).getByRole("option").filter({ hasText: "Martin" }).first();
  await within(5_000, async () => (await senderRow.getAttribute("aria-selected")) !== "true");
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Mail" }).click();
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "Mailbox", exact: true })
    .first()
    .waitFor({ timeout: 8_000 });
  await row(page, SUBJECT).click();
  await page.waitForTimeout(800);
  await page.keyboard.press("Control+Shift+y");
  step(
    "Its key brings Contacts forward on that card, and adds no second one",
    (await within(
      10_000,
      async () =>
        (await page
          .getByRole("menubar")
          .getByRole("menuitem", { name: "Card", exact: true })
          .first()
          .isVisible()) && (await senderRow.getAttribute("aria-selected")) === "true",
    )) !== null && (await cards(page)).length === 1,
  );

  await openFromDock(sender, "Mail", undefined).catch(() => {});
  await viewer(sender).getByRole("treeitem", { name: /^Sent/ }).click();
  await within(10_000, () => row(sender, SUBJECT).isVisible());
  await row(sender, SUBJECT).click();
  await message(sender).click();
  step(
    "It is dimmed on your own mail",
    (await addItem(sender).getAttribute("aria-disabled")) === "true",
  );
});

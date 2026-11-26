#!/usr/bin/env node
// Messages' File > Send File… and Buddies > Add to Contacts, in a real browser against the running app:
// the menu item and its key open the drive's Open panel for the conversation shown, and Add to Contacts
// opens Contacts on a card naming the other person's account, read from the server. Exits 0 only when
// every step passed and no page logged a console error, a page error, a failed request or an HTTP error.
//
//   node e2e/messages-send-file-menu-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                                [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("messages-send-file-menu");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `msmchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `msmmartin-${id}`, fullName: `Martin ${id}`, password };
const SAID = `said ${id}`;

const messagesOf = (page) => page.locator('.mac-messages[aria-label="Messages"]').first();
const field = (page) => messagesOf(page).getByRole("textbox", { name: "Message" });
const bar = (page, title) =>
  page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true }).first();
const panel = (page) => page.getByRole("dialog", { name: /Open|Attach|Choose/ }).first();

await run({}, {}, async ({ person: open }) => {
  await open("martin", martin);
  const page = await open("chris", chris);
  await openFromDock(page, "Messages");
  await messagesOf(page).getByRole("button", { name: "Compose new message" }).click();
  await bar(page, "File").click();
  step(
    "Send File… is dimmed for a message with no one to send to yet",
    (await page
      .getByRole("menu")
      .last()
      .getByRole("menuitem", { name: /^Send File/ })
      .getAttribute("aria-disabled")) === "true",
  );
  await page.keyboard.press("Escape");
  await messagesOf(page).getByRole("textbox", { name: "To" }).fill(martin.name);
  await field(page).fill(SAID);
  await field(page).press("Enter");
  await within(15_000, () => messagesOf(page).getByRole("log").getByText(SAID).first().isVisible());

  await bar(page, "File").click();
  await page
    .getByRole("menu")
    .last()
    .getByRole("menuitem", { name: /^Send File/ })
    .click();
  step(
    "File > Send File… opens the Open panel",
    (await within(8_000, () => panel(page).isVisible())) !== null,
  );
  await page.waitForTimeout(300);
  await shot(page, "messages-send-file-menu");
  await page.keyboard.press("Escape");
  await within(5_000, async () => !(await panel(page).isVisible()));
  await page.keyboard.press("Meta+Alt+f");
  step("and so does its key", (await within(8_000, () => panel(page).isVisible())) !== null);
  await page.keyboard.press("Escape");
  await within(5_000, async () => !(await panel(page).isVisible()));

  await bar(page, "Buddies").click();
  await page.getByRole("menu").last().getByRole("menuitem", { name: "Add to Contacts" }).click();
  step(
    "Add to Contacts makes a card naming that account, on the server",
    (await within(15_000, async () => {
      const reply = await page.request.get(new URL("/api/contacts/cards", page.url()).href);
      return ((await reply.json()).cards ?? []).some((card) => card.user === martin.name);
    })) !== null,
  );
});

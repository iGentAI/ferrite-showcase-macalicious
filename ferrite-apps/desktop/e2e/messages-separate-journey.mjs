#!/usr/bin/env node
// Messages' Blocked list and a conversation in its own window on Ferrite, in a real browser against the
// running app. A row's Open in Separate Window shows that conversation alone; a message sent there reaches
// the other person and shows in the main window; the window comes back after a reload. Preferences >
// Blocked lists a person blocked, adds and removes one, and the server holds it. Exits 0 only when every
// step passed and no page logged a console error, a page error, a failed request or an HTTP error.
//
//   node e2e/messages-separate-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("messages-separate");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mwchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `mwmartin-${id}`, fullName: `Martin ${id}`, password };

const windows = (page) => page.locator('.mac-messages[aria-label="Messages"]');
const main = (page) => windows(page).first();
const separate = (page) => windows(page).nth(1);
const rowOf = (page, name) =>
  main(page).locator('[role="option"]').filter({ hasText: name }).first();
const preferences = (page) => page.locator(".mac-messages-preferences");
const blockedOnServer = async (page) => {
  const reply = await page.request.get(new URL("/api/messages/blocked", page.url()).href);
  return (await reply.json()).blocked.map((each) => each.name);
};

await run({}, {}, async ({ person: open }) => {
  const b = await open("martin", martin);
  const page = await open("chris", chris);
  await openFromDock(page, "Messages");
  await main(page).getByRole("button", { name: "Compose new message" }).click();
  await main(page).getByRole("textbox", { name: "To" }).fill(martin.name);
  const field = main(page).getByRole("textbox", { name: "Message" });
  await field.fill(`hello ${id}`);
  await field.press("Enter");
  await within(20_000, () => rowOf(page, martin.fullName).isVisible());
  await rowOf(page, "Ferrite Room").click();

  await rowOf(page, martin.fullName).click({ button: "right" });
  await page
    .getByRole("menu", { name: "Conversation commands" })
    .getByRole("menuitem", { name: "Open in Separate Window" })
    .click();
  step(
    "Open in Separate Window opens a second window",
    (await within(10_000, async () => (await windows(page).count()) === 2)) !== null,
  );
  step(
    "it shows that conversation, without the list",
    (await within(10_000, () => separate(page).getByText(`hello ${id}`).isVisible())) !== null &&
      (await separate(page).getByRole("listbox").count()) === 0,
  );
  await page.waitForTimeout(300);
  await shot(page, "messages-separate");

  const menu = async (title, item) => {
    await page
      .getByRole("menubar")
      .getByRole("menuitem", { name: title, exact: true })
      .first()
      .click();
    await page.getByRole("menu").last().locator('[role^="menuitem"]', { hasText: item }).click();
  };
  await menu("View", "Unknown Senders");
  step(
    "its View menu changes that window and not the main one",
    (await separate(page).getByText(`hello ${id}`).isVisible()) &&
      (await within(5_000, () => rowOf(page, "Ferrite Room").isVisible())) !== null,
  );
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "View", exact: true })
    .first()
    .click();
  step(
    "and the list cannot be shown there",
    await page
      .getByRole("menu")
      .last()
      .getByRole("menuitem", { name: "Show Conversation List" })
      .isDisabled(),
  );
  await page
    .getByRole("menu")
    .last()
    .locator('[role^="menuitem"]', { hasText: "All Messages" })
    .click();

  await menu("File", /^New Message/);
  const addressed = main(page).getByRole("textbox", { name: "To" });
  step(
    "New Message from there starts one in the main window",
    (await within(10_000, () => addressed.isVisible())) !== null &&
      (await separate(page).getByRole("textbox", { name: "To" }).count()) === 0,
  );
  await rowOf(page, "Ferrite Room").click();
  // It stands below and to the right of the main window, so that corner of it can be clicked.
  const box = await separate(page).boundingBox();
  await separate(page).click({ position: { x: box.width - 10, y: box.height / 2 } });

  const there = separate(page).getByRole("textbox", { name: "Message" });
  await there.fill(`from the window ${id}`);
  await there.press("Enter");
  await openFromDock(b, "Messages");
  step(
    "what is sent there reaches the other person",
    (await within(20_000, async () => {
      const row = rowOf(b, chris.fullName);
      return (await row.count()) > 0 && (await row.innerText()).includes(`from the window ${id}`);
    })) !== null,
  );

  await page.reload({ waitUntil: "load" });
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  step(
    "after a reload the window comes back on its conversation",
    (await within(15_000, async () => {
      if ((await windows(page).count()) !== 2) return false;
      const texts = await Promise.all([0, 1].map((at) => windows(page).nth(at).innerText()));
      return texts.some(
        (text) => text.includes(`from the window ${id}`) && !text.includes("Ferrite Room"),
      );
    })) !== null,
  );

  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "Messages", exact: true })
    .first()
    .click();
  await page
    .getByRole("menu")
    .last()
    .getByRole("menuitem", { name: /^Preferences/ })
    .click();
  await preferences(page).waitFor({ timeout: 10_000 });
  await preferences(page).getByRole("tab", { name: "Blocked" }).click();
  await preferences(page)
    .getByRole("textbox", { name: /Account name/ })
    .fill(martin.name);
  await preferences(page).getByRole("button", { name: "Add" }).click();
  step(
    "Blocked adds a person, on the server",
    (await within(
      10_000,
      async () =>
        (await preferences(page).getByRole("option", { name: martin.fullName }).count()) === 1 &&
        (await blockedOnServer(page)).includes(martin.name),
    )) !== null,
  );
  await shot(page, "messages-blocked-pane");
  await preferences(page).getByRole("option", { name: martin.fullName }).click();
  await preferences(page).getByRole("button", { name: "Remove" }).click();
  step(
    "and Remove takes them off, on the server",
    (await within(10_000, async () => !(await blockedOnServer(page)).includes(martin.name))) !==
      null,
  );
  await preferences(page).getByRole("button", { name: "Close" }).first().click();

  // With the main window closed, New Message from a separate window opens one.
  await main(page).getByRole("button", { name: "Close" }).first().click();
  await within(10_000, async () => (await windows(page).count()) === 1);
  await menu("File", /^New Message/);
  const opened = await within(10_000, async () => (await windows(page).count()) === 2);
  const toField = windows(page).nth(1).getByRole("textbox", { name: "To" });
  step(
    "with the main window closed, New Message opens one with a To field",
    opened !== null && (await within(10_000, async () => (await toField.count()) === 1)) !== null,
  );
  await toField.fill(martin.name);
  const words = windows(page).nth(1).getByRole("textbox", { name: "Message" });
  await words.fill(`from the new window ${id}`);
  await words.press("Enter");
  await rowOf(b, chris.fullName).click();
  step(
    "and what is sent from it reaches the person",
    (await within(20_000, () => b.getByText(`from the new window ${id}`).first().isVisible())) !==
      null,
  );
});

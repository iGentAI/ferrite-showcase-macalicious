#!/usr/bin/env node
// Smart Mailboxes on Ferrite, in a real browser against the running app: New Smart Mailbox lists the
// messages its conditions pick, Edit changes them, Duplicate, Rename and Delete work from the menu
// bar and the row's menu, and all of it is on the server and comes back after a reload. Exits 0 only
// when every step passed and no page logged a console error, a page error, a failed request or an
// HTTP error.
//
//   node e2e/mail-smart-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                   [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("mail-smart");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `smchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `smmartin-${id}`, fullName: `Martin ${id}`, password };
const ferry = `Ferry ${id}`;
const train = `Train ${id}`;
const other = `Dinner ${id}`;

const viewer = (page) => page.locator(".mac-mail").first();
const compose = (page) => page.locator(".mac-mail-compose").first();
const rows = (page) => viewer(page).getByRole("listbox", { name: "Messages" }).getByRole("option");
const mailboxRow = (page, name) =>
  viewer(page)
    .getByRole("tree", { name: "Mailboxes" })
    .getByRole("treeitem", { name: new RegExp(`^${name}`) });
const values = async (page) => {
  const reply = await page.request.get(
    new URL("/api/system-preferences/settings", page.url()).href,
  );
  return (await reply.json()).values ?? {};
};
const stored = (page, check) =>
  within(10_000, async () => check((await values(page))["mail.smart"] ?? []));
const count = (page, wanted) => within(8_000, async () => (await rows(page).count()) === wanted);
async function mailboxMenu(page, name) {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "Mailbox", exact: true })
    .first()
    .click();
  await page.getByRole("menu").last().getByRole("menuitem", { name }).click();
}
async function choose(page, scope, label, option) {
  await scope
    .getByRole("combobox", { name: label })
    .or(scope.getByRole("button", { name: label }))
    .first()
    .click();
  await page
    .getByRole("option", { name: option, exact: true })
    .or(page.getByRole("menuitemradio", { name: option, exact: true }))
    .first()
    .click();
}

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  const b = await person("martin", martin);
  await openFromDock(a, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(a).isVisible());
  for (const subject of [ferry, train, other]) {
    await viewer(a).getByRole("button", { name: "New Message" }).click();
    const to = compose(a).getByLabel("To:");
    await to.click();
    await to.pressSequentially(martin.name);
    await to.press("Enter");
    await compose(a).getByLabel("Subject:").fill(subject);
    await a.keyboard.press("Control+Shift+D");
    if (!(await within(15_000, async () => (await compose(a).count()) === 0))) {
      throw new Error(`the message ${subject} did not go`);
    }
  }

  await openFromDock(b, "Mail", undefined).catch(() => {});
  await within(20_000, async () => {
    await b.keyboard.press("Control+Shift+N");
    return (await rows(b).count()) === 3;
  });

  await mailboxMenu(b, "New Smart Mailbox");
  const sheet = b.getByRole("dialog").filter({ hasText: "New Smart Mailbox" });
  await sheet.waitFor({ timeout: 5_000 });
  await sheet.getByRole("textbox", { name: "Smart Mailbox Name" }).fill("Journeys");
  step(
    "OK waits for the condition's words",
    await sheet.getByRole("button", { name: "OK" }).isDisabled(),
  );
  await choose(b, sheet, "Field", "Subject");
  await sheet.getByRole("textbox", { name: "Value" }).fill("ferry");
  await shot(b, "mail-smart-sheet");
  await sheet.getByRole("button", { name: "OK" }).click();

  step(
    "it is listed and selected, and holds the one message its condition picks",
    (await within(5_000, () => mailboxRow(b, "Journeys").isVisible())) !== null &&
      (await count(b, 1)) !== null &&
      (await rows(b).first().getByText(ferry).isVisible()),
  );
  step(
    "the server holds its condition",
    (await stored(
      b,
      (boxes) =>
        boxes.length === 1 &&
        boxes[0].name === "Journeys" &&
        boxes[0].rules[0].field === "subject" &&
        boxes[0].rules[0].value === "ferry",
    )) !== null,
  );

  await mailboxMenu(b, "Edit Smart Mailbox");
  const edit = b.getByRole("dialog").filter({ hasText: "Edit Smart Mailbox" });
  await edit.waitFor({ timeout: 5_000 });
  await edit.getByRole("button", { name: "Add Condition" }).first().click();
  await edit.getByRole("textbox", { name: "Value" }).nth(1).fill("train");
  step(
    "with either of two conditions, both messages are listed",
    (await (async () => {
      await edit.getByRole("button", { name: "OK" }).click();
      return count(b, 2);
    })()) !== null,
  );
  await shot(b, "mail-smart-list");

  await b.reload({ waitUntil: "load" });
  await openFromDock(b, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(b).isVisible());
  step(
    "after a reload it is the mailbox shown, with its messages",
    (await within(15_000, () => mailboxRow(b, "Journeys").isVisible())) !== null &&
      (await within(10_000, async () =>
        /Journeys \(/.test(
          await viewer(b).locator(".mac-title-bar, .mac-window-title").first().innerText(),
        ),
      )) !== null,
  );
  await shot(b, "mail-smart-reload");

  await mailboxRow(b, "Journeys").click({ button: "right" });
  await b.getByRole("menuitem", { name: "Duplicate Smart Mailbox" }).click();
  step(
    "Duplicate makes a copy, on the server",
    (await stored(b, (boxes) => boxes.length === 2 && boxes[1].name === "Journeys Copy")) !== null,
  );
  await mailboxRow(b, "Journeys Copy").click({ button: "right" });
  await b.getByRole("menuitem", { name: "Rename Mailbox" }).click();
  const alert = b.getByRole("alertdialog");
  await alert.getByRole("textbox", { name: "Name" }).fill("inbox");
  await alert.getByRole("button", { name: "Rename" }).click();
  step(
    "a name Mail has already is refused",
    await alert.getByRole("alert").getByText("already has a mailbox").isVisible(),
  );
  await alert.getByRole("textbox", { name: "Name" }).fill("Copy kept");
  await alert.getByRole("button", { name: "Rename" }).click();
  step(
    "Rename renames it on the server",
    (await stored(b, (boxes) => boxes[1]?.name === "Copy kept")) !== null,
  );

  await mailboxRow(b, "Copy kept").click();
  await mailboxMenu(b, "Delete Mailbox");
  await alert.getByRole("button", { name: "Delete" }).click();
  step(
    "Delete removes it and goes to the Inbox, with every message still there",
    (await stored(b, (boxes) => boxes.length === 1)) !== null && (await count(b, 3)) !== null,
  );
});

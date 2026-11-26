#!/usr/bin/env node
// Mailboxes a person makes, on Ferrite, in a real browser against the running app: New Mailbox from
// the menu bar, a message dragged and moved into it, Rename and Delete from the mailbox's contextual
// menu, each kept across a reload and read back from the server. Exits 0 only when every step passed
// and no page logged a console error, a page error, a failed request or an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/mail-mailboxes-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                       [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("mail-mailboxes");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mbchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `mbmartin-${id}`, fullName: `Martin ${id}`, password };
const alpha = `Alpha ${id}`;
const bravo = `Bravo ${id}`;

const viewer = (page) => page.locator(".mac-mail").first();
const compose = (page) => page.locator(".mac-mail-compose").first();
const rows = (page) => viewer(page).getByRole("listbox", { name: "Messages" }).getByRole("option");
const row = (page, text) =>
  rows(page)
    .filter({ has: page.getByText(text, { exact: true }) })
    .first();
const mailboxRow = (page, name) =>
  viewer(page)
    .getByRole("tree", { name: "Mailboxes" })
    .getByRole("treeitem", { name: new RegExp(`^${name}`) });

async function server(page) {
  const reply = await page.request.get(new URL("/api/mail/messages", page.url()).href);
  return reply.json();
}
const stored = (page, check) =>
  within(10_000, async () => {
    const { messages, mailboxes } = await server(page);
    return check(Object.fromEntries(messages.map((m) => [m.subject, m])), mailboxes ?? []);
  });

async function mailboxMenu(page, name) {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "Mailbox", exact: true })
    .first()
    .click();
  await page.getByRole("menu").last().getByRole("menuitem", { name }).click();
}

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  const b = await person("martin", martin);
  await openFromDock(a, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(a).isVisible());
  for (const subject of [alpha, bravo]) {
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
    return (await rows(b).count()) === 2;
  });

  // Rename and Delete are dimmed for a mailbox every person has.
  await b
    .getByRole("menubar")
    .getByRole("menuitem", { name: "Mailbox", exact: true })
    .first()
    .click();
  const renameItem = b.getByRole("menu").last().getByRole("menuitem", { name: "Rename Mailbox" });
  step(
    "Rename Mailbox is dimmed on the Inbox",
    (await renameItem.getAttribute("aria-disabled")) === "true",
  );
  await b.keyboard.press("Escape");

  await mailboxMenu(b, "New Mailbox");
  const alert = b.getByRole("alertdialog");
  await alert.waitFor({ timeout: 5_000 });
  await alert.getByRole("textbox", { name: "Name" }).fill("inbox");
  await alert.getByRole("button", { name: "OK" }).click();
  step(
    "a name Mail has already is refused, and the alert stays",
    await alert.getByRole("alert").getByText("already has a mailbox").isVisible(),
  );
  await alert.getByRole("textbox", { name: "Name" }).fill("Trips");
  await shot(b, "mail-new-mailbox");
  await alert.getByRole("textbox", { name: "Name" }).press("Enter");
  step(
    "New Mailbox makes it on the server and lists it under On My Mac",
    (await stored(b, (_, boxes) => boxes.length === 1 && boxes[0].name === "Trips")) !== null &&
      (await within(5_000, () => mailboxRow(b, "Trips").isVisible())) !== null,
  );

  // Dragged onto it, then moved from the toolbar's pull-down.
  await row(b, alpha).dragTo(mailboxRow(b, "Trips"));
  const { mailboxes } = await server(b);
  const boxId = mailboxes[0].id;
  step(
    "a message dragged onto it moves there on the server",
    (await stored(b, (by) => by[alpha].mailbox === boxId)) !== null,
  );
  await row(b, bravo).click();
  await viewer(b).getByRole("button", { name: "Move to…" }).click();
  await b.getByRole("menu").last().getByRole("menuitem", { name: "Trips" }).click();
  step(
    "Move to lists it, and a message moves there",
    (await stored(b, (by) => by[bravo].mailbox === boxId)) !== null,
  );

  await mailboxRow(b, "Trips").click();
  step(
    "selecting it shows its two messages",
    (await within(5_000, async () => (await rows(b).count()) === 2)) !== null,
  );
  await shot(b, "mail-own-mailbox");

  await b.reload();
  await within(15_000, () => viewer(b).isVisible());
  if (!(await viewer(b).isVisible())) await openFromDock(b, "Mail", undefined).catch(() => {});
  step(
    "the mailbox is there after a reload",
    (await within(15_000, () => mailboxRow(b, "Trips").isVisible())) !== null,
  );

  // Rename from the row's contextual menu.
  await mailboxRow(b, "Trips").click({ button: "right" });
  await b.getByRole("menuitem", { name: "Rename Mailbox" }).click();
  await alert.waitFor({ timeout: 5_000 });
  await alert.getByRole("textbox", { name: "Name" }).fill("Holidays");
  await alert.getByRole("button", { name: "Rename" }).click();
  step(
    "Rename Mailbox renames it on the server and in the list",
    (await stored(b, (_, boxes) => boxes[0]?.name === "Holidays")) !== null &&
      (await within(5_000, () => mailboxRow(b, "Holidays").isVisible())) !== null,
  );

  // Delete asks, moves its messages to the Trash and leaves the Inbox showing.
  await mailboxRow(b, "Holidays").click();
  await mailboxMenu(b, "Delete Mailbox");
  await alert.waitFor({ timeout: 5_000 });
  await shot(b, "mail-delete-mailbox");
  await alert.getByRole("button", { name: "Delete" }).click();
  step(
    "Delete Mailbox moves its messages to the Trash and removes it",
    (await stored(
      b,
      (by, boxes) =>
        boxes.length === 0 && by[alpha].mailbox === "trash" && by[bravo].mailbox === "trash",
    )) !== null,
  );
  step(
    "the window goes to the Inbox and the Trash is listed",
    (await within(5_000, () => mailboxRow(b, "Trash").isVisible())) !== null &&
      (await within(5_000, async () => (await rows(b).count()) === 0)) !== null,
  );
  await shot(b, "mail-mailbox-deleted");
});

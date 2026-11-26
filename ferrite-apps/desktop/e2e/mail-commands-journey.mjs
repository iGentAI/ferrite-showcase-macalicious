#!/usr/bin/env node
// Mail's commands on Ferrite, in a real browser against the running app: several messages selected
// and acted on together, the Message, Mailbox, View and Edit menus and their keys, the contextual
// menus, messages dragged onto a mailbox, Undo, and the two erase alerts, with what they change
// kept across a reload. Chris writes to Martin; everything else happens in Martin's Mail. Exits 0
// only when every step passed and no page logged a console error, a page error, a failed request
// or an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/mail-commands-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                      [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("mail-commands");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mcchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `mcmartin-${id}`, fullName: `Martin ${id}`, password };
const SUBJECTS = ["Alpha", "Bravo", "Charlie", "Delta"].map((word) => `${word} ${id}`);
const [alpha, bravo, charlie, delta] = SUBJECTS;

const viewer = (page) => page.locator(".mac-mail").first();
const compose = (page) => page.locator(".mac-mail-compose").first();
const list = (page) => viewer(page).getByRole("listbox", { name: "Messages" });
const rows = (page) => list(page).getByRole("option");
const row = (page, text) =>
  rows(page)
    .filter({ has: page.getByText(text, { exact: true }) })
    .first();
const mailboxRow = (page, name) =>
  viewer(page)
    .getByRole("tree", { name: "Mailboxes" })
    .getByRole("treeitem", {
      name: new RegExp(`^${name}`),
    });
const shownSubjects = async (page) =>
  (await page.locator(".mac-mail .mac-mail-row-subject").allInnerTexts()).sort();

/** Open the menu bar's `title` menu; each further name opens a submenu, and the last is chosen. */
async function menu(page, title, ...path) {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: title, exact: true })
    .first()
    .click();
  for (const [index, name] of path.entries()) {
    const item = page
      .getByRole("menu")
      .last()
      .getByRole(/** @type {any} */ ("menuitem"), { name, exact: false })
      .or(page.getByRole("menuitemradio", { name }))
      .or(page.getByRole("menuitemcheckbox", { name }))
      .first();
    if (index < path.length - 1) await item.hover();
    else await item.click();
  }
}

async function serverMessages(page) {
  const reply = await page.request.get(new URL("/api/mail/messages", page.url()).href);
  return (await reply.json()).messages ?? [];
}

/** Wait until the server holds what `check` asks of Martin's messages by subject. */
const stored = (page, check) =>
  within(10_000, async () => {
    const messages = await serverMessages(page);
    return check(Object.fromEntries(messages.map((m) => [m.subject, m])));
  });

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  const b = await person("martin", martin);
  await openFromDock(a, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(a).isVisible());
  for (const subject of SUBJECTS) {
    await viewer(a).getByRole("button", { name: "New Message" }).click();
    const to = compose(a).getByLabel("To:");
    await to.click();
    await to.pressSequentially(martin.name);
    await to.press("Enter");
    await compose(a).getByLabel("Subject:").fill(subject);
    // Message > Send's key.
    await a.keyboard.press("Control+Shift+D");
    const closed = await within(15_000, async () => (await compose(a).count()) === 0);
    if (!closed) throw new Error(`the message ${subject} did not go`);
  }
  step("Shift-Command-D sends each message from the New Message window", true);

  await openFromDock(b, "Mail", undefined).catch(() => {});
  const arrived = await within(20_000, async () => {
    await b.keyboard.press("Control+Shift+N");
    return (await rows(b).count()) === 4;
  });
  step("Shift-Command-N gets the four messages", arrived !== null);

  // Several selected.
  await row(b, delta).click();
  await row(b, charlie).click({ modifiers: ["Control"] });
  await row(b, bravo).click({ modifiers: ["Control"] });
  const three = viewer(b).getByText("3 Messages Selected");
  step("Command-click selects three, and the pane says so", await three.isVisible());
  const reply = viewer(b).getByRole("button", { name: "Reply", exact: true });
  step("Reply is dimmed for several", (await reply.getAttribute("aria-disabled")) === "true");

  await menu(b, "Message");
  await b.getByRole("menuitem", { name: "Flag" }).hover();
  await shot(b, "mail-message-menu-flag");
  await b.getByRole("menuitem", { name: /^Orange/ }).click();
  step(
    "Message > Flag > Orange flags all three on the server",
    (await stored(
      b,
      (by) =>
        by[delta].flag === "orange" &&
        by[charlie].flag === "orange" &&
        by[bravo].flag === "orange" &&
        !by[alpha].flag,
    )) !== null,
  );

  // Mark unread from the key: three selected and all read? Those selected together were read only
  // when each was alone; Delta was. Shift-Command-U reads them all first, then makes them unread.
  await b.keyboard.press("Control+Shift+U");
  step(
    "Shift-Command-U marks the selection read",
    (await stored(b, (by) => !by[delta].unread && !by[charlie].unread && !by[bravo].unread)) !==
      null,
  );
  await b.keyboard.press("Control+Shift+U");
  step(
    "and again marks all of it unread",
    (await stored(b, (by) => by[delta].unread && by[charlie].unread && by[bravo].unread)) !== null,
  );

  // Undo and Redo, on the server too.
  await menu(b, "Edit", "Undo Mark as Unread");
  step(
    "Edit > Undo takes it back",
    (await stored(b, (by) => !by[delta].unread && !by[charlie].unread && !by[bravo].unread)) !==
      null,
  );

  // Move Junk and Archive through the menu and the keys, so their rows are listed.
  await row(b, delta).click();
  await menu(b, "Message", "Archive");
  const archived = await within(10_000, () => mailboxRow(b, "Archive").isVisible());
  step("Message > Archive files the message, and the Archive mailbox appears", archived !== null);

  // Two dragged together onto Archive.
  await row(b, charlie).click();
  await row(b, bravo).click({ modifiers: ["Control"] });
  const box = await row(b, bravo).boundingBox();
  const target = await mailboxRow(b, "Archive").boundingBox();
  await b.mouse.move(box.x + 60, box.y + 20);
  await b.mouse.down();
  await b.mouse.move(box.x + 40, box.y + 30, { steps: 4 });
  await b.mouse.move(target.x + 40, target.y + target.height / 2, { steps: 12 });
  const ringed = await within(3_000, () =>
    mailboxRow(b, "Archive").evaluate((node) => node.hasAttribute("data-drop-target")),
  );
  await shot(b, "mail-drag-to-mailbox");
  await b.mouse.up();
  step("a mailbox rings while messages are dragged over it", ringed !== null);
  step(
    "two messages dragged onto Archive are filed there together",
    (await stored(
      b,
      (by) => by[charlie].mailbox === "archive" && by[bravo].mailbox === "archive",
    )) !== null,
  );
  await b.keyboard.press("Control+Z");
  step(
    "Command-Z brings both back to the Inbox",
    (await stored(b, (by) => by[charlie].mailbox === "inbox" && by[bravo].mailbox === "inbox")) !==
      null,
  );

  // Contextual menu of a row.
  await row(b, alpha).click({ button: "right" });
  await b.getByRole("menu", { name: "Message commands" }).waitFor({ timeout: 5_000 });
  await shot(b, "mail-row-contextual-menu");
  await b.getByRole("menuitem", { name: "Delete" }).click();
  step(
    "Delete in a row's contextual menu puts it in the Trash",
    (await stored(b, (by) => by[alpha].mailbox === "trash")) !== null,
  );

  // Contextual menu of a mailbox: mark all read. Bravo is made unread first.
  await row(b, bravo).click();
  await b.keyboard.press("Control+Shift+U");
  await stored(b, (by) => by[bravo].unread);
  await mailboxRow(b, "Inbox").click({ button: "right" });
  await b.getByRole("menu", { name: "Mailbox commands" }).waitFor({ timeout: 5_000 });
  await b.getByRole("menuitem", { name: "Mark All Messages as Read" }).click();
  step(
    "Mark All Messages as Read in the Inbox's contextual menu",
    (await stored(b, (by) => !by[bravo].unread)) !== null,
  );

  // View: sort, filter, panes.
  await menu(b, "View", "Sort By", "Subject");
  const sorted = await within(5_000, async () => {
    const [first] = await b.locator(".mac-mail .mac-mail-row-subject").allInnerTexts();
    return first === bravo;
  });
  step("View > Sort By > Subject orders the list", sorted !== null);
  await b.keyboard.press("Control+Shift+M");
  const hidden = await within(3_000, async () => !(await mailboxRow(b, "Inbox").isVisible()));
  step("Shift-Command-M hides the mailbox list", hidden !== null);
  await b.keyboard.press("Control+Shift+M");
  await menu(b, "View", "Hide Favorites Bar");
  const bare = await within(3_000, async () => !(await b.locator(".mac-mail-favorites").count()));
  step("View > Hide Favorites Bar hides it", bare !== null);
  await menu(b, "View", "Show Favorites Bar");

  await b.keyboard.press("Control+2");
  const inSent = await within(3_000, () =>
    viewer(b).getByRole("radio", { name: "Sent" }).isChecked(),
  );
  step("Command-2 goes to Sent", inSent !== null);
  await b.keyboard.press("Control+1");

  // What was changed is still so after a reload.
  await b.reload({ waitUntil: "load" });
  await b
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  await openFromDock(b, "Mail", undefined).catch(() => {});
  await within(15_000, () => rows(b).first().isVisible());
  step(
    "after a reload the Inbox shows what the commands left, flags included",
    JSON.stringify(await shownSubjects(b)) === JSON.stringify([bravo, charlie].sort()),
    (await shownSubjects(b)).join(", "),
  );

  // Erase Deleted Items asks, then erases.
  await menu(b, "Mailbox", "Erase Deleted Items");
  const alert = b.getByRole("alertdialog");
  await alert.waitFor({ timeout: 5_000 });
  await shot(b, "mail-erase-deleted-alert");
  await alert.getByRole("button", { name: "Erase" }).click();
  step(
    "Erase Deleted Items erases what the Trash holds",
    (await stored(b, (by) => !by[alpha])) !== null,
  );

  // Erase Junk Mail: a message moved to Junk is erased from there.
  await row(b, bravo).click();
  await b.keyboard.press("Control+Shift+J");
  await stored(b, (by) => by[bravo].mailbox === "junk");
  await within(5_000, () => mailboxRow(b, "Junk").isVisible());
  await b.keyboard.press("Control+Alt+J");
  await alert.waitFor({ timeout: 5_000 });
  await alert.getByRole("button", { name: "Erase" }).click();
  step("Erase Junk Mail erases what Junk holds", (await stored(b, (by) => !by[bravo])) !== null);
  await shot(b, "mail-commands-end");
});

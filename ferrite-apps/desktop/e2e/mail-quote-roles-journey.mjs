#!/usr/bin/env node
// Mail on Ferrite, in a real browser against the running app. Quote levels: what was typed before a level
// changed can still be undone once the level is, each as one step, and a nested list split partway shows no
// bullet with no text. Mailbox > Use This Mailbox For: Sent and Trash, read back from the server. Exits 0 only
// when every step passed and no page logged a console error, a page error, a failed request or an HTTP error.
//
//   node e2e/mail-quote-roles-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("mail-quote-roles");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `qrchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `qrmartin-${id}`, fullName: `Martin ${id}`, password };

const seen = (check) => within(10_000, check).then((took) => took !== null);
const viewer = (page) => page.locator(".mac-mail").first();
const compose = (page) => page.locator(".mac-mail-compose").first();
const text = (page) => compose(page).locator(".mac-mail-compose-message").first();
const html = (page) => text(page).evaluate((el) => el.innerHTML);
const levels = async (page) => (await html(page)).match(/<blockquote/g)?.length ?? 0;
const newMessage = async (page, subject) => {
  await viewer(page).getByRole("button", { name: "New Message" }).click();
  const to = compose(page).getByLabel("To:");
  await to.click();
  await to.pressSequentially(martin.name);
  await to.press("Enter");
  await compose(page).getByLabel("Subject:").fill(subject);
  await text(page).click();
};
const listed = async (page, subject) => {
  const reply = await page.request.get(new URL("/api/mail/messages", page.url()).href);
  return ((await reply.json()).messages ?? []).find((each) => each.subject === subject);
};
const makeRole = async (page, name, role) => {
  await viewer(page)
    .getByRole("treeitem", { name: new RegExp(`^${name}`) })
    .click();
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "Mailbox", exact: true })
    .first()
    .click();
  await page
    .getByRole("menu")
    .last()
    .getByRole("menuitem", { name: "Use This Mailbox For" })
    .click();
  await page.getByRole("menuitemcheckbox", { name: role, exact: true }).click();
  await page.keyboard.press("Escape");
};

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  await person("martin", martin);
  await openFromDock(a, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(a).isVisible());

  await newMessage(a, `Undo ${id}`);
  await a.keyboard.type("Words typed first");
  await a.keyboard.press("Control+'");
  step("Increase quotes the line", await seen(async () => (await levels(a)) === 1));
  await a.keyboard.press("Control+z");
  step(
    "Undo takes the level back, as one step, keeping the words",
    await seen(
      async () => (await levels(a)) === 0 && (await html(a)).includes("Words typed first"),
    ),
    await html(a),
  );
  await a.keyboard.press("Control+z");
  step(
    "the next Undo takes back what was typed before the level",
    await seen(async () => !(await html(a)).includes("Words typed first")),
    await html(a),
  );
  await a.keyboard.press("Control+Shift+z");
  step(
    "Redo gives the words again",
    await seen(async () => (await html(a)).includes("Words typed first")),
    await html(a),
  );
  await a.keyboard.press("Control+Shift+z");
  step("and then the level", await seen(async () => (await levels(a)) === 1), await html(a));
  await a.keyboard.press("Control+Alt+'");
  step("Decrease takes the level off", await seen(async () => (await levels(a)) === 0));
  await a.keyboard.press("Control+z");
  step(
    "Undo of Decrease puts it back, as one step",
    await seen(async () => (await levels(a)) === 1),
  );

  await text(a).evaluate((el) => {
    el.innerHTML =
      "<blockquote><ul><li>Parent<ul><li>Stays</li><li>Leaves</li></ul></li></ul></blockquote>";
    const range = document.createRange();
    range.selectNodeContents(el.querySelectorAll("li")[2]);
    const selection = document.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await a.keyboard.press("Control+Alt+'");
  step(
    "splitting a nested list partway leaves a list item only where there is text",
    await seen(async () =>
      text(a).evaluate((el) => {
        const items = [...el.querySelectorAll("li")];
        return (
          items.length === 3 &&
          items.every((item) => item.firstChild?.nodeType === 3) &&
          el.querySelectorAll("blockquote").length === 1
        );
      }),
    ),
    await html(a),
  );
  await shot(a, "mail-quote-split");
  const sentHtml = await html(a);
  await a.keyboard.press("Control+Shift+D");
  await within(15_000, async () => (await compose(a).count()) === 0);
  const split = await seen(async () => Boolean(await listed(a, `Undo ${id}`)));
  const stored = split
    ? await (
        await a.request.get(
          new URL(`/api/mail/messages/${(await listed(a, `Undo ${id}`)).id}`, a.url()).href,
        )
      ).json()
    : null;
  step(
    "what is sent keeps the split with no bullet of no text",
    stored?.html === sentHtml || stored?.html?.includes("<ul><ul><li>Leaves</li></ul></ul>"),
    stored?.html,
  );

  const make = async (name) => {
    const reply = await a.request.post(new URL("/api/mail/mailboxes", a.url()).href, {
      data: { name },
    });
    return (await reply.json()).mailbox.id;
  };
  const out = await make(`Out${id}`);
  const bin = await make(`Bin${id}`);
  await a.reload();
  await openFromDock(a, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(a).isVisible());
  await within(15_000, () =>
    viewer(a)
      .getByRole("treeitem", { name: new RegExp(`^Bin${id}`) })
      .isVisible(),
  );
  await makeRole(a, `Out${id}`, "Sent");
  await makeRole(a, `Bin${id}`, "Trash");

  const subject = `Filed ${id}`;
  await newMessage(a, subject);
  await a.keyboard.type("Filed where the role says");
  await a.keyboard.press("Control+Shift+D");
  await within(15_000, async () => (await compose(a).count()) === 0);
  step(
    "a mailbox standing in for Sent receives the sent copy, on the server",
    await seen(async () => (await listed(a, subject))?.mailbox === out),
    JSON.stringify((await listed(a, subject))?.mailbox),
  );
  await viewer(a)
    .getByRole("treeitem", { name: new RegExp(`^Out${id}`) })
    .click();
  const row = viewer(a)
    .getByRole("listbox", { name: "Messages" })
    .getByRole("option")
    .filter({ hasText: subject })
    .first();
  await row.click();
  await viewer(a).getByRole("button", { name: "Delete" }).first().click();
  step(
    "Delete moves it to the mailbox standing in for the Trash, on the server",
    await seen(async () => (await listed(a, subject))?.mailbox === bin),
  );
  await viewer(a)
    .getByRole("treeitem", { name: new RegExp(`^Bin${id}`) })
    .click();
  await row.click();
  await viewer(a).getByRole("button", { name: "Delete" }).first().click();
  step(
    "Delete there erases it for good, on the server",
    await seen(async () => (await listed(a, subject)) === undefined),
  );
  await shot(a, "mail-roles");
});

#!/usr/bin/env node
// Several conversations in Messages, the delete button on a row's hover, and the View menu's list and
// senders, in a real browser against the running app, read from the server and after a reload.
//
//   node e2e/messages-several-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("messages-several");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `msechris-${id}`, fullName: `Chris ${id}`, password };
const a = { name: `msea-${id}`, fullName: `Ada ${id}`, password };
const b = { name: `mseb-${id}`, fullName: `Bea ${id}`, password };
const c = { name: `msec-${id}`, fullName: `Cy ${id}`, password };

const messagesOf = (page) => page.locator('.mac-messages[aria-label="Messages"]').first();
const field = (page) => messagesOf(page).getByRole("textbox", { name: "Message" });
const list = (page) => messagesOf(page).getByRole("listbox", { name: "Conversations" });
const rowOf = (page, name) => list(page).getByRole("option").filter({ hasText: name }).first();
const url = (page, path) => new URL(path, page.url()).href;
const listed = async (page) =>
  (await (await page.request.get(url(page, "/api/messages/conversations"))).json()).conversations;
const settings = async (page) =>
  (await (await page.request.get(url(page, "/api/system-preferences/settings"))).json()).values ??
  {};
async function menu(page, title, item) {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: title, exact: true })
    .first()
    .click();
  const open = page.getByRole("menu").last();
  await open
    .getByRole("menuitem", { name: item })
    .or(open.getByRole("menuitemcheckbox", { name: item }))
    .click();
}
async function start(page, to, words) {
  await messagesOf(page).getByRole("button", { name: "Compose new message" }).click();
  await messagesOf(page).getByRole("textbox", { name: "To" }).fill(to);
  await field(page).fill(words);
  await field(page).press("Enter");
  await within(15_000, () =>
    messagesOf(page).getByRole("log").getByText(words).first().isVisible(),
  );
}

await run({}, {}, async ({ person }) => {
  for (const each of [a, b, c]) await person(each.name, each);
  const page = await person("chris", chris);
  await openFromDock(page, "Messages");
  await start(page, a.name, `to ada ${id}`);
  await start(page, b.name, `to bea ${id}`);
  await start(page, c.name, `to cy ${id}`);

  // Wait for the three sends, then reload so deletion uses the server's latest sequences.
  let ids;
  const persisted = await within(20_000, async () => {
    const conversations = await listed(page);
    const find = (text) => conversations.find((each) => each.last?.text === text)?.id;
    ids = { a: find(`to ada ${id}`), b: find(`to bea ${id}`), c: find(`to cy ${id}`) };
    return conversations.length === 3 && Object.values(ids).every(Boolean);
  });
  if (persisted === null) throw new Error("The three messages did not persist");
  await page.reload({ waitUntil: "load" });
  await messagesOf(page)
    .waitFor({ timeout: 10_000 })
    .catch(() => openFromDock(page, "Messages"));
  for (const person of [a, b, c]) {
    if ((await within(15_000, () => rowOf(page, person.fullName).isVisible())) === null) {
      throw new Error("A persisted conversation did not appear after reload");
    }
  }

  await rowOf(page, a.fullName).click();
  await rowOf(page, b.fullName).click({ modifiers: ["ControlOrMeta"] });
  step(
    "Command-click selects a second row",
    (await list(page).locator('[role="option"][aria-selected="true"]').count()) === 2,
  );
  await shot(page, "messages-several-selected");
  await list(page).press("Backspace");
  const alert = page.getByRole("alertdialog");
  step(
    "Delete asks about both",
    (await within(4_000, () => alert.getByText(/these 2 conversations/).isVisible())) !== null,
  );
  const clears = [ids.a, ids.b].map((conversation) =>
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === `/api/messages/conversations/${conversation}/clear`,
      { timeout: 15_000 },
    ),
  );
  await alert.getByRole("button", { name: "Delete" }).click();
  const answers = await Promise.all(clears);
  if (answers.some((answer) => answer.status() !== 200)) throw new Error("A deletion failed");
  step(
    "both go, on the server",
    (await within(8_000, async () => {
      const conversations = await listed(page);
      const remaining = new Set(conversations.map((each) => each.id));
      return (
        conversations.length === 1 &&
        !remaining.has(ids.a) &&
        !remaining.has(ids.b) &&
        remaining.has(ids.c)
      );
    })) !== null &&
      (await within(4_000, async () => (await rowOf(page, a.fullName).count()) === 0)) !== null &&
      (await rowOf(page, b.fullName).count()) === 0,
    JSON.stringify((await listed(page)).map((each) => each.members.length)),
  );

  // View: who is listed.
  const unknown = rowOf(page, c.fullName);
  await menu(page, "View", "Unknown Senders");
  step(
    "Unknown Senders lists a person not in Contacts, and leaves out the room",
    (await unknown.isVisible()) && (await rowOf(page, "Ferrite Room").count()) === 0,
  );
  await menu(page, "View", "All Messages");
  step("All Messages lists the room again", await rowOf(page, "Ferrite Room").isVisible());

  // The delete button on the row's hover.
  await unknown.hover();
  const button = unknown.locator(".mac-messages-row-delete");
  step("a row shows its delete button on hover", await button.isVisible());
  await page.waitForTimeout(500);
  await shot(page, "messages-row-delete");
  await page.mouse.move(0, 0);
  step("and not otherwise", !(await button.isVisible()));
  await unknown.hover();
  await button.click();
  await alert.getByRole("button", { name: "Delete" }).click();
  step(
    "the button deletes it, after asking",
    (await within(8_000, async () => (await listed(page)).length === 0)) !== null,
  );

  // View: the list hidden, kept across a reload.
  await menu(page, "View", "Hide Conversation List");
  step(
    "Hide Conversation List hides it, on the server",
    (await within(4_000, async () => (await list(page).count()) === 0)) !== null &&
      (await within(
        10_000,
        async () => (await settings(page))["messages.view"]?.listHidden === true,
      )) !== null,
  );
  await shot(page, "messages-list-hidden");
  await page.reload({ waitUntil: "load" });
  await messagesOf(page)
    .waitFor({ timeout: 8_000 })
    .catch(() => openFromDock(page, "Messages"));
  await within(10_000, () => field(page).isVisible());
  step("after a reload it is still hidden", (await list(page).count()) === 0);
  await menu(page, "View", "Show Conversation List");
  step(
    "Show Conversation List brings it back",
    (await within(4_000, () => list(page).isVisible())) !== null,
  );
});

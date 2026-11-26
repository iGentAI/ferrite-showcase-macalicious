#!/usr/bin/env node
// Share > Messages from Finder, in a real browser against the running app: the file starts a new
// message that carries it, for the person to address; sending it delivers the file to that person,
// and to nobody when it was taken off. Exits 0 only when every step passed and no page logged a
// console error, a page error, a failed request or an HTTP error.
//
//   node e2e/messages-share-files-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                             [--browser chromium|chrome|firefox|webkit]

import { twoPeople, within } from "./people-kit.mjs";
import { uploadFile } from "./system-kit.mjs";

const { step, run, shot } = twoPeople("messages-share-files");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `msfchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `msfmartin-${id}`, fullName: `Martin ${id}`, password };
const ann = { name: `msfann-${id}`, fullName: `Ann ${id}`, password };
const SHARED = `chart-${id}.txt`;
const DROPPED = `plan-${id}.txt`;

const messagesOf = (page) => page.locator('.mac-messages[aria-label="Messages"]').first();
const finderOf = (page) => page.locator(".mac-window.mac-finder").first();
const api = async (page, path) => {
  const reply = await page.request.get(new URL(`/api/messages${path}`, page.url()).href);
  return reply.ok() ? await reply.json() : null;
};
/** The names of the files in the person's conversations. */
async function received(page) {
  const list = await api(page, "/conversations");
  const names = [];
  for (const { id: conversation } of list?.conversations ?? []) {
    const state = await api(page, `/conversations/${conversation}`);
    for (const message of state?.state?.messages ?? []) {
      for (const each of message.attachments ?? []) names.push(each.name);
    }
  }
  return names;
}

async function share(page, name) {
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const finder = finderOf(page);
  await finder.waitFor({ timeout: 10_000 });
  await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
  const file = finder.getByRole("option", { name, exact: true }).first();
  await file.waitFor({ timeout: 10_000 });
  await file.click();
  await finder.getByRole("button", { name: "Share", exact: true }).first().click();
  await page.getByRole("menu").last().getByRole("menuitem", { name: "Messages" }).click();
}

await run({}, {}, async ({ person: open }) => {
  const other = await open("martin", martin);
  const third = await open("ann", ann);
  const page = await open("chris", chris);
  for (const name of [SHARED, DROPPED]) {
    await uploadFile(page, { parent: "documents", name, type: "text/plain", text: name });
  }
  await page.reload({ waitUntil: "load" });
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });

  await share(page, SHARED);
  const field = messagesOf(page).getByRole("textbox", { name: "Message" });
  const carried = messagesOf(page).getByRole("list", { name: "Files to send" });
  step(
    "Share > Messages starts a new message carrying the file",
    (await within(15_000, () => carried.getByText(SHARED).isVisible())) !== null,
  );
  await page.waitForTimeout(400);
  await shot(page, "messages-share-files");
  await messagesOf(page).getByRole("textbox", { name: "To" }).fill(martin.name);
  await field.press("Enter");
  step(
    "Sending it with no words delivers the file to that person, on the server",
    (await within(20_000, async () => (await received(other)).includes(SHARED))) !== null,
  );
  const reply = await other.request.get(new URL("/api/messages/conversations", other.url()).href);
  const conversation = (await reply.json()).conversations[0].id;
  const state = await api(other, `/conversations/${conversation}`);
  const sent = state.state.messages.flatMap((message) => message.attachments ?? [])[0];
  const bytes = await other.request.get(
    new URL(`/api/messages/conversations/${conversation}/attachments/${sent.id}`, other.url()).href,
  );
  step("and its bytes read back as they were", (await bytes.text()) === SHARED);

  await share(page, DROPPED);
  await within(15_000, () => carried.getByText(DROPPED).isVisible());
  await carried.getByRole("button", { name: `Remove ${DROPPED}` }).click();
  step("Remove takes the file off the new message", await carried.isHidden());
  await messagesOf(page).getByRole("textbox", { name: "To" }).fill(ann.name);
  const SAID = `nothing attached ${id}`;
  await field.fill(SAID);
  await field.press("Enter");
  const stored = async () => {
    const list = await api(third, "/conversations");
    const state = await api(third, `/conversations/${list?.conversations?.[0]?.id}`);
    return state?.state?.messages ?? [];
  };
  const arrived = await within(20_000, async () =>
    (await stored()).some((message) => message.text === SAID),
  );
  // A file would follow its message within moments: long enough for an upload of a few bytes.
  await page.waitForTimeout(3_000);
  step(
    "That message reaches the person with its words and no file",
    arrived !== null && (await received(third)).length === 0,
    JSON.stringify(await received(third)),
  );
});

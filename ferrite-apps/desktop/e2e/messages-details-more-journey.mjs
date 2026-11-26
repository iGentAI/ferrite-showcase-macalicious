#!/usr/bin/env node
// Details of a Messages conversation in a real browser against the running app: adding a member to a
// group (who sees only what is said from then on), Send Read Receipts for one conversation, and the
// conversation's pictures and files, each read from the server and after a reload.
//
//   node e2e/messages-details-more-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot, allow } = twoPeople("messages-details-more");
// Someone with no account, added on purpose.
allow(/HTTP 422: .*\/members/);
allow(/status of 422/);
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mxchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `mxmartin-${id}`, fullName: `Martin ${id}`, password };
const ann = { name: `mxann-${id}`, fullName: `Ann ${id}`, password };
const tom = { name: `mxtom-${id}`, fullName: `Tom ${id}`, password };

const messagesOf = (page) => page.locator('.mac-messages[aria-label="Messages"]').first();
const field = (page) => messagesOf(page).getByRole("textbox", { name: "Message" });
const transcript = (page) => messagesOf(page).getByRole("log").first();
const details = (page) => messagesOf(page).getByRole("button", { name: "Details", exact: true });
const rowOf = (page, name) =>
  messagesOf(page)
    .getByRole("listbox", { name: "Conversations" })
    .getByRole("option")
    .filter({ hasText: name })
    .first();
const url = (page, path) => new URL(path, page.url()).href;
const api = async (page, path) =>
  (await page.request.get(url(page, `/api/messages/${path}`))).json();
const settings = async (page) =>
  (await (await page.request.get(url(page, "/api/system-preferences/settings"))).json()).values ??
  {};
async function start(page, to, words) {
  await messagesOf(page).getByRole("button", { name: "Compose new message" }).click();
  await messagesOf(page).getByRole("textbox", { name: "To" }).fill(to);
  await field(page).fill(words);
  await field(page).press("Enter");
  await within(15_000, () => transcript(page).getByText(words).first().isVisible());
}

await run({}, {}, async ({ person }) => {
  const other = await person("martin", martin);
  await person("ann", ann);
  const added = await person("tom", tom);
  const page = await person("chris", chris);
  await openFromDock(page, "Messages");
  await openFromDock(other, "Messages");
  await openFromDock(added, "Messages");

  await start(page, `${martin.name}, ${ann.name}`, `before ${id}`);
  await details(page).click();
  const add = page.getByLabel("Add Member");
  await within(5_000, () => add.isVisible());
  await add.fill(tom.name);
  await add.press("Enter");
  const members = page.getByRole("list", { name: "Members" }).getByRole("listitem");
  step(
    "Add Member lists them in Details",
    (await within(8_000, async () => (await members.count()) === 4)) !== null,
  );
  const groupId = (await api(page, "conversations")).conversations.find(
    (each) => each.members.length === 4,
  )?.id;
  step("and on the server", Boolean(groupId));
  await shot(page, "messages-details-member");
  await add.fill("nobody-at-all");
  await add.press("Enter");
  step(
    "someone with no account is refused, with the reason under the transcript",
    (await within(8_000, () =>
      messagesOf(page).getByText("No account on this desktop is called").first().isVisible(),
    )) !== null,
  );
  await page.keyboard.press("Escape");
  await messagesOf(page).getByRole("textbox", { name: "Message" }).click();
  await field(page).fill(`after ${id}`);
  await field(page).press("Enter");
  const seen = await within(30_000, async () => {
    const row = rowOf(added, chris.fullName);
    if (await row.isVisible()) await row.click();
    return transcript(added).getByText(`after ${id}`).first().isVisible();
  });
  step(
    "the new member sees what is said from then on, and nothing before",
    seen !== null && (await transcript(added).getByText(`before ${id}`).count()) === 0,
  );

  // Read receipts for one conversation, with the other setting left on.
  await start(page, martin.name, `hello ${id}`);
  const directId = (await api(page, "conversations")).conversations.find(
    (each) => each.members.length === 2,
  )?.id;
  await within(20_000, async () => {
    const row = rowOf(other, chris.fullName);
    if (await row.isVisible()) await row.click();
    return transcript(other).getByText(`hello ${id}`).first().isVisible();
  });
  const readers = async () => (await api(page, `conversations/${directId}`)).state.read;
  step(
    "with receipts on, reading shows",
    (await within(10_000, async () => (await readers())[martin.name] >= 1)) !== null,
  );
  await details(other).click();
  const receipts = other.getByRole("checkbox", { name: "Send Read Receipts" });
  await within(5_000, () => receipts.isVisible());
  await receipts.click();
  step(
    "Send Read Receipts off takes the receipt back, on the server",
    (await within(10_000, async () => (await readers())[martin.name] === undefined)) !== null,
  );
  step(
    "and is kept with the person's settings",
    (await within(
      10_000,
      async () => (await settings(other))["messages.receipts"]?.[directId] === false,
    )) !== null,
  );
  await other.keyboard.press("Escape");

  // A picture sent in the conversation is listed in Details.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==",
    "base64",
  );
  await messagesOf(page).getByRole("button", { name: "Attach a file" }).click();
  await page.getByLabel("Send files from this computer").setInputFiles({
    name: `dot-${id}.png`,
    mimeType: "image/png",
    buffer: png,
  });
  await within(15_000, () => transcript(page).getByText(`dot-${id}.png`).first().isVisible());
  const filesOf = async (where) =>
    (await api(where, `conversations/${directId}/files`)).files.map((each) => each.attachment.name);
  step(
    "the server lists the conversation's files",
    (await within(10_000, async () => (await filesOf(page)).includes(`dot-${id}.png`))) !== null,
  );
  await details(page).click();
  const listed = page.getByRole("list", { name: "Pictures and Files" });
  step(
    "Details lists them",
    (await within(8_000, () => listed.getByText(`dot-${id}.png`).first().isVisible())) !== null,
  );
  await shot(page, "messages-details-files");

  await other.reload({ waitUntil: "load" });
  await messagesOf(other)
    .waitFor({ timeout: 8_000 })
    .catch(() => openFromDock(other, "Messages"));
  await within(15_000, () => details(other).isVisible());
  await details(other).click();
  step(
    "after a reload the checkbox is still off",
    (await within(8_000, async () => {
      return !(await other.getByRole("checkbox", { name: "Send Read Receipts" }).isChecked());
    })) !== null,
  );
});

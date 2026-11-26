#!/usr/bin/env node
// The Messages field and Block Person, in a real browser against the running app: Option-Return makes
// a new line that the other person sees, the emoji button and Edit > Emoji & Symbols open the palette
// and its character lands in the field, and a blocked person's messages reach nobody by the server's
// rule, stay out of sight after an unblock, and what follows arrives. Read back after a reload.
//
//   node e2e/messages-field-block-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("messages-field-block");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mfchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `mfmartin-${id}`, fullName: `Martin ${id}`, password };

const messagesOf = (page) => page.locator('.mac-messages[aria-label="Messages"]').first();
const field = (page) => messagesOf(page).getByRole("textbox", { name: "Message" });
const transcript = (page) => messagesOf(page).getByRole("log").first();
const rowOf = (page, name) =>
  messagesOf(page)
    .getByRole("listbox", { name: "Conversations" })
    .getByRole("option")
    .filter({ hasText: name })
    .first();
const api = async (page, path) =>
  (await page.request.get(new URL(`/api/messages/${path}`, page.url()).href)).json();
async function menu(page, title, item) {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: title, exact: true })
    .first()
    .click();
  await page.getByRole("menu").last().getByRole("menuitem", { name: item }).click();
}
async function say(page, text) {
  await field(page).fill(text);
  await field(page).press("Enter");
  await within(15_000, () => transcript(page).getByText(text).first().isVisible());
}

await run({}, {}, async ({ person }) => {
  const other = await person("martin", martin);
  const page = await person("chris", chris);
  await openFromDock(other, "Messages");
  await openFromDock(page, "Messages");
  await messagesOf(page).getByRole("button", { name: "Compose new message" }).click();
  await messagesOf(page).getByRole("textbox", { name: "To" }).fill(martin.name);

  // Option-Return.
  await field(page).click();
  await page.keyboard.type(`first ${id}`);
  await page.keyboard.press("Alt+Enter");
  await page.keyboard.type(`second ${id}`);
  step(
    "Option-Return makes a new line and sends nothing",
    (await field(page).inputValue()) === `first ${id}\nsecond ${id}`,
  );
  const tall = (await field(page).boundingBox()).height;
  step("the field grows with it", tall > 30, `${tall} pt`);
  await shot(page, "messages-field-two-lines");
  await page.keyboard.press("Enter");
  await within(15_000, () => transcript(page).getByText(`second ${id}`).first().isVisible());
  const [conversation] = (await api(page, "conversations")).conversations;
  step(
    "Return sends both lines, kept on the server as one message",
    (await api(page, `conversations/${conversation.id}`)).state.messages[0]?.text ===
      `first ${id}\nsecond ${id}`,
  );

  // The palette, from the button and from the menu.
  await messagesOf(page).getByRole("button", { name: "Emoji" }).click();
  const palette = page.getByRole("dialog", { name: "Characters" });
  step(
    "the emoji button opens the palette",
    (await within(4_000, () => palette.isVisible())) !== null,
  );
  await palette.getByRole("button", { name: "rocket" }).click();
  step("its character lands in the field", (await field(page).inputValue()) === "🚀");
  await shot(page, "messages-emoji-palette");
  await palette
    .getByRole("button", { name: "Close" })
    .click()
    .catch(() => menu(page, "Edit", "Emoji & Symbols"));
  await within(4_000, async () => !(await palette.isVisible()));
  await menu(page, "Edit", "Emoji & Symbols");
  step(
    "Edit > Emoji & Symbols opens it",
    (await within(4_000, () => palette.isVisible())) !== null,
  );
  await menu(page, "Edit", "Emoji & Symbols");
  await field(page).fill("");

  // Block Person.
  await within(20_000, async () => {
    const row = rowOf(other, chris.fullName);
    if (await row.isVisible()) await row.click();
    return transcript(other).getByText(`second ${id}`).first().isVisible();
  });
  await say(other, `before ${id}`);
  await within(15_000, () => transcript(page).getByText(`before ${id}`).first().isVisible());
  await menu(page, "Buddies", "Block Person…");
  const alert = page.getByRole("alertdialog");
  await alert.getByRole("button", { name: "Block" }).click();
  step(
    "Block Person is kept on the server",
    (await within(8_000, async () =>
      (await api(page, "blocked")).blocked.some((each) => each.name === martin.name),
    )) !== null,
  );
  await say(other, `blocked ${id}`);
  const read = async (where) =>
    (await api(where, `conversations/${conversation.id}`)).state.messages.map((each) => each.text);
  step(
    "the server keeps what the blocked person says from the person who blocked them",
    !(await read(page)).includes(`blocked ${id}`) && (await read(other)).includes(`blocked ${id}`),
  );
  step(
    "nothing counts as unread",
    (await api(page, "conversations")).conversations.find((each) => each.id === conversation.id)
      ?.unread === 0,
  );
  await page.waitForTimeout(1_500);
  await shot(page, "messages-blocked");
  await page.reload({ waitUntil: "load" });
  await messagesOf(page)
    .waitFor({ timeout: 8_000 })
    .catch(() => openFromDock(page, "Messages"));
  await within(15_000, () => rowOf(page, martin.fullName).isVisible());
  await rowOf(page, martin.fullName).click();
  await within(8_000, () => transcript(page).getByText(`before ${id}`).first().isVisible());
  step(
    "after a reload it is still out of sight",
    (await transcript(page).getByText(`blocked ${id}`).count()) === 0,
  );
  await menu(page, "Buddies", "Unblock Person");
  await within(8_000, async () => (await api(page, "blocked")).blocked.length === 0);
  await say(other, `after ${id}`);
  step(
    "after an unblock what is said next arrives, and what was said while blocked stays away",
    (await within(25_000, () => transcript(page).getByText(`after ${id}`).first().isVisible())) !==
      null && (await transcript(page).getByText(`blocked ${id}`).count()) === 0,
  );
});

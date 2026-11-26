#!/usr/bin/env node
// Clear Chat Transcript and Delete on a bubble in Messages, in a real browser against the running app:
// each asks, works for this person alone, is read back from the server and stays after a reload, and
// the other person keeps everything. Exits 0 only when every step passed and no page logged a problem.
//
//   node e2e/messages-clear-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("messages-clear");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mcchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `mcmartin-${id}`, fullName: `Martin ${id}`, password };

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
const stored = async (page) => {
  const [{ id: conversation }] = (await api(page, "conversations")).conversations;
  const { state } = await api(page, `conversations/${conversation}`);
  return state.messages.map((each) => each.text);
};
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
  await say(page, `one ${id}`);
  await say(page, `two ${id}`);
  // Stored, so the bubbles are no longer on their way.
  await within(10_000, async () => (await stored(page)).length === 2);
  await page.waitForTimeout(1_000);

  await transcript(page).getByText(`one ${id}`).first().click({ button: "right" });
  await page
    .getByRole("menu", { name: "Message commands" })
    .getByRole("menuitem", { name: "Delete…" })
    .click();
  const alert = page.getByRole("alertdialog");
  await alert.getByRole("button", { name: "Delete" }).click();
  step(
    "Delete on a bubble takes it from this person's view, on the server",
    (await within(
      8_000,
      async () => (await transcript(page).getByText(`one ${id}`).count()) === 0,
    )) !== null && (await stored(page)).join() === `two ${id}`,
  );
  step(
    "the other person keeps it",
    (await within(8_000, async () => (await stored(other)).includes(`one ${id}`))) !== null,
  );

  await page.keyboard.press("Control+Alt+K");
  const asked = await within(4_000, () => alert.isVisible());
  step("⌥⌘K asks first", asked !== null);
  await shot(page, "messages-clear-alert");
  await alert.getByRole("button", { name: "Clear" }).click();
  step(
    "Clear empties the transcript, on the server, and the conversation stays listed",
    (await within(
      8_000,
      async () => (await transcript(page).getByText(`two ${id}`).count()) === 0,
    )) !== null &&
      (await stored(page)).length === 0 &&
      (await rowOf(page, martin.fullName).isVisible()),
  );
  step("the other person keeps everything", (await stored(other)).join() === `one ${id},two ${id}`);

  await page.reload({ waitUntil: "load" });
  await messagesOf(page)
    .waitFor({ timeout: 8_000 })
    .catch(() => openFromDock(page, "Messages"));
  await within(15_000, () => rowOf(page, martin.fullName).isVisible());
  await rowOf(page, martin.fullName).click();
  await page.waitForTimeout(1_500);
  step(
    "after a reload it is still listed and still empty",
    (await rowOf(page, martin.fullName).isVisible()) &&
      (await transcript(page).getByText(id).count()) === 0,
  );
  await shot(page, "messages-clear-cleared");

  await rowOf(other, chris.fullName).click();
  await say(other, `three ${id}`);
  step(
    "something new shows, with only that",
    (await within(25_000, () => transcript(page).getByText(`three ${id}`).first().isVisible())) !==
      null && (await stored(page)).join() === `three ${id}`,
  );
});

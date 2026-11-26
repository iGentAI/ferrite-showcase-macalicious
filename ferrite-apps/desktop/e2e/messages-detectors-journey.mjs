#!/usr/bin/env node
// Data detectors in Messages on Ferrite, in a real browser against the running app: in a received message an
// address opens a new message in Mail, a date opens Quick Event in Calendar and makes the event, and a phone number
// is copied. Exits 0 only when every step passed and no page logged a console error, a page error, a failed request
// or an HTTP error.
//
//   node e2e/messages-detectors-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("messages-detectors");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mdechris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `mdemartin-${id}`, fullName: `Martin ${id}`, password };
const WORDS =
  "Lunch tomorrow at 5pm? Write to dana@example.com or call (555) 010-1234. Trip on May 1, 2030 at 5pm.";

const seen = (check) => within(15_000, check).then((took) => took !== null);
const messagesOf = (page) => page.locator('.mac-messages[aria-label="Messages"]').first();
const transcript = (page) => messagesOf(page).getByRole("log").first();
const rowOf = (page, name) =>
  messagesOf(page)
    .getByRole("listbox", { name: "Conversations" })
    .getByRole("option")
    .filter({ hasText: name })
    .first();
const detected = (page, text) =>
  transcript(page).getByRole("button", { name: text, exact: true }).first();
const choose = async (page, text, row) => {
  await detected(page, text).click();
  await page.getByRole("menu", { name: text }).getByRole("menuitem", { name: row }).click();
};

await run({}, {}, async ({ person }) => {
  const b = await person("martin", martin);
  const a = await person("chris", chris);
  await openFromDock(b, "Messages");
  await openFromDock(a, "Messages");
  await messagesOf(a).getByRole("button", { name: "Compose new message" }).click();
  await messagesOf(a).getByRole("textbox", { name: "To" }).fill(martin.name);
  const field = messagesOf(a).getByRole("textbox", { name: "Message" });
  await field.fill(WORDS);
  await field.press("Enter");

  await b.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await within(20_000, async () => {
    const row = rowOf(b, chris.fullName);
    if (await row.isVisible()) await row.click();
    return transcript(b).getByText("Lunch").first().isVisible();
  });
  step(
    "the message reads as it was written",
    (await transcript(b).locator(".mac-messages-bubble").first().innerText()).includes(WORDS),
  );

  await detected(b, "tomorrow at 5pm").click();
  await shot(b, "messages-detector-menu");
  await b.keyboard.press("Escape");

  await choose(b, "(555) 010-1234", "Copy Phone Number");
  step(
    "Copy Phone Number puts it on the clipboard",
    await seen(
      async () => (await b.evaluate(() => navigator.clipboard.readText())) === "(555) 010-1234",
    ),
  );

  await choose(b, "dana@example.com", "New Mail Message");
  const compose = b.locator(".mac-mail-compose").first();
  step(
    "New Mail Message opens Mail addressed to it",
    await seen(async () => (await compose.innerText()).includes("dana@example.com")),
  );
  await compose.getByRole("button", { name: "Close" }).first().click();
  await b
    .getByRole("alertdialog")
    .getByRole("button", { name: /^Don.t Save/ })
    .click({ timeout: 2_000 })
    .catch(() => {});

  await openFromDock(b, "Messages");
  await choose(b, "tomorrow at 5pm", "Create Event");
  const quick = b.getByRole("textbox", { name: "Quick Event" });
  step(
    "Create Event opens Quick Event holding the date",
    await seen(async () => (await quick.inputValue()) === "tomorrow at 5pm"),
  );
  await shot(b, "messages-detector-event");
  await quick.press("Enter");
  step(
    "and makes the event at that time",
    await seen(async () => {
      const reply = await b.request.get(new URL("/api/calendar/events", b.url()).href);
      const events = (await reply.json()).events ?? [];
      return events.some((event) => new Date(event.start).getHours() === 17);
    }),
  );
  await openFromDock(b, "Messages");
  await choose(b, "May 1, 2030 at 5pm", "Create Event");
  await seen(async () => (await quick.inputValue()) === "May 1, 2030 at 5pm");
  await quick.press("Enter");
  step(
    "a date with its year makes the event on that day",
    await seen(async () => {
      const reply = await b.request.get(new URL("/api/calendar/events", b.url()).href);
      const events = (await reply.json()).events ?? [];
      return events.some(
        (event) => new Date(event.start).getTime() === new Date(2030, 4, 1, 17).getTime(),
      );
    }),
  );
});

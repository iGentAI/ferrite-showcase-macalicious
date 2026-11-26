#!/usr/bin/env node
// Delete Conversation in Messages on Ferrite in a real browser against the running app: it asks, goes
// from this person's list and stays gone after a reload, the other person keeps everything, and
// something new brings it back with only that. Exits 0 only when every step passed and no page logged
// a console error, a page error, a failed request or an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/messages-delete-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                        [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("messages-delete");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mdchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `mdmartin-${id}`, fullName: `Martin ${id}`, password };

const messagesOf = (page) => page.locator('.mac-messages[aria-label="Messages"]').first();
const transcript = (page) => messagesOf(page).getByRole("log").first();
const rowOf = (page, name) =>
  messagesOf(page)
    .getByRole("listbox", { name: "Conversations" })
    .getByRole("option")
    .filter({ hasText: name })
    .first();

async function say(page, text) {
  const field = messagesOf(page).getByRole("textbox", { name: "Message" });
  await field.fill(text);
  await field.press("Enter");
}

await run({}, {}, async ({ person: open, base }) => {
  const pageM = await open("martin", martin);
  const page = await open("chris", chris);
  await openFromDock(pageM, "Messages");
  await openFromDock(page, "Messages");

  await messagesOf(page).getByRole("button", { name: "Compose new message" }).click();
  await messagesOf(page).getByRole("textbox", { name: "To" }).fill(martin.name);
  await say(page, `hello ${id}`);
  await within(20_000, () => rowOf(page, martin.fullName).isVisible());
  await within(20_000, async () => {
    const row = rowOf(pageM, chris.fullName);
    if (await row.isVisible()) await row.click();
    return transcript(pageM).getByText(`hello ${id}`).first().isVisible();
  });

  // A second browser of Chris's, on the same conversation.
  const second = await page.context().newPage();
  await second.goto(`${base}/`, { waitUntil: "load" });
  await second
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  await openFromDock(second, "Messages");
  await within(20_000, () => rowOf(second, martin.fullName).isVisible());
  await rowOf(second, martin.fullName).click();
  await within(10_000, () => transcript(second).getByText(`hello ${id}`).first().isVisible());

  await rowOf(page, martin.fullName).click();
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "File", exact: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Delete Conversation…" }).click();
  const alert = page.getByRole("alertdialog");
  step(
    "File > Delete Conversation… asks first",
    (await within(3_000, () => alert.isVisible())) !== null,
  );
  await shot(page, "messages-delete-alert");
  await alert.getByRole("button", { name: "Delete" }).click();
  const gone = await within(5_000, async () => (await rowOf(page, martin.fullName).count()) === 0);
  step("it goes from his list", gone !== null);
  const elsewhere = await within(
    25_000,
    async () => (await rowOf(second, martin.fullName).count()) === 0,
  );
  step("it goes from his other open browser, without a reload", elsewhere !== null);
  step("and so does its transcript there", (await second.getByText(`hello ${id}`).count()) === 0);

  await page.reload();
  await messagesOf(page)
    .waitFor({ timeout: 8_000 })
    .catch(() => openFromDock(page, "Messages"));
  await page.waitForTimeout(3_000);
  step("it stays gone after a reload", (await rowOf(page, martin.fullName).count()) === 0);
  step(
    "Martin keeps everything",
    await transcript(pageM).getByText(`hello ${id}`).first().isVisible(),
  );

  await say(pageM, `again ${id}`);
  const back = await within(25_000, () => rowOf(page, martin.fullName).isVisible());
  step("something new brings it back", back !== null);
  await rowOf(page, martin.fullName).click();
  const shown = await within(8_000, () =>
    transcript(page).getByText(`again ${id}`).first().isVisible(),
  );
  step("with what is new", shown !== null);
  step("and not what was deleted", (await transcript(page).getByText(`hello ${id}`).count()) === 0);
  await within(25_000, () => rowOf(second, martin.fullName).isVisible());
  await rowOf(second, martin.fullName).click();
  const there = await within(8_000, () =>
    transcript(second).getByText(`again ${id}`).first().isVisible(),
  );
  step(
    "his other browser shows only what is new too",
    there !== null && (await transcript(second).getByText(`hello ${id}`).count()) === 0,
  );
});

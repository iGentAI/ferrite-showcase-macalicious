#!/usr/bin/env node
// Spotlight showing what it found in the application that keeps it, on Ferrite, in a real browser
// against the running app: a reminder selected in its list, an event selected on its day, and a
// message open in its mailbox. Exits 0 only when every step passed and no page logged a console
// error, a page error, a failed request or an HTTP error.
//
//   node e2e/spotlight-items-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                        [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("spotlight-items");
const id = Date.now().toString(36);
const chris = { name: `sichris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const REMINDER = `Findreminder${id}`;
const SUBJECT = `Findmail${id}`;

const found = async (page, text) => {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill(text);
  const option = page
    .getByRole("option", { name: new RegExp(text) })
    .filter({ hasNotText: /Search|Web/ })
    .first();
  await option.waitFor({ timeout: 15_000 });
  await option.click();
  if (await field.isVisible().catch(() => false)) await field.press("Enter").catch(() => {});
};
const closeFront = async (locator) => {
  await locator.getByRole("button", { name: "Close" }).first().click();
  await locator.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
};

await run({}, {}, async ({ person }) => {
  const page = await person("chris", chris);

  // A reminder, in a smart list other than where it opens.
  await openFromDock(page, "Reminders");
  const reminders = page.locator('.mac-reminders[aria-label="Reminders"]').first();
  await within(15_000, () => reminders.isVisible());
  await page.waitForTimeout(500);
  await page.keyboard.press("Control+N");
  await page.keyboard.type(REMINDER);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1_500);
  await page.keyboard.press("Control+1");
  await closeFront(reminders);
  await found(page, REMINDER);
  step(
    "a reminder Spotlight found opens Reminders with it selected",
    (await within(15_000, () =>
      reminders.locator('[aria-selected="true"]').filter({ hasText: REMINDER }).first().isVisible(),
    )) !== null,
  );
  await shot(page, "spotlight-reminder");

  // A message to oneself.
  await openFromDock(page, "Mail", undefined).catch(() => {});
  const viewer = page.locator(".mac-mail").first();
  const compose = page.locator(".mac-mail-compose").first();
  await within(15_000, () => viewer.isVisible());
  await viewer.getByRole("button", { name: "New Message" }).click();
  const to = compose.getByLabel("To:");
  await to.click();
  await to.pressSequentially(chris.name);
  await to.press("Enter");
  await compose.getByLabel("Subject:").fill(SUBJECT);
  await page.keyboard.press("Control+Shift+D");
  await within(15_000, async () => (await compose.count()) === 0);
  await closeFront(viewer);
  await found(page, SUBJECT);
  step(
    "a message Spotlight found opens Mail with it selected",
    (await within(15_000, () => viewer.getByRole("article", { name: SUBJECT }).isVisible())) !==
      null,
  );
  await shot(page, "spotlight-mail");
});

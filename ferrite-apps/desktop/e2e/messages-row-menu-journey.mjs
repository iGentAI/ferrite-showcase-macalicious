#!/usr/bin/env node
// The contextual menu of a conversation's row in Messages on Ferrite, in a real browser against the
// running app: it acts on the row under the pointer. Exits 0 only when every step passed and no page
// logged a console error, a page error, a failed request or an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/messages-row-menu-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                          [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("messages-row-menu");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mrchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `mrmartin-${id}`, fullName: `Martin ${id}`, password };

const messagesOf = (page) => page.locator('.mac-messages[aria-label="Messages"]').first();
const rowOf = (page, name) =>
  messagesOf(page).locator('[role="option"]').filter({ hasText: name }).first();

await run({}, {}, async ({ person: open }) => {
  await open("martin", martin);
  const page = await open("chris", chris);
  await openFromDock(page, "Messages");
  await messagesOf(page).getByRole("button", { name: "Compose new message" }).click();
  await messagesOf(page).getByRole("textbox", { name: "To" }).fill(martin.name);
  const field = messagesOf(page).getByRole("textbox", { name: "Message" });
  await field.fill(`hello ${id}`);
  await field.press("Enter");
  await within(20_000, () => rowOf(page, martin.fullName).isVisible());
  await rowOf(page, "Ferrite Room").click();

  await rowOf(page, martin.fullName).click({ button: "right" });
  const menu = page.getByRole("menu", { name: "Conversation commands" });
  step(
    "a secondary click on a row opens its menu",
    (await within(3_000, () => menu.isVisible())) !== null,
  );
  const chosen = await within(
    3_000,
    async () => (await rowOf(page, martin.fullName).getAttribute("aria-selected")) === "true",
  );
  step("on the row under the pointer", chosen !== null);
  await shot(page, "messages-row-menu");

  await menu.getByRole("menuitemcheckbox", { name: "Do Not Disturb" }).click();
  await rowOf(page, martin.fullName).click({ button: "right" });
  const on = await within(
    5_000,
    async () =>
      (await menu
        .getByRole("menuitemcheckbox", { name: "Do Not Disturb" })
        .getAttribute("aria-checked")) === "true",
  );
  step("Do Not Disturb is set from it", on !== null);

  await menu.getByRole("menuitem", { name: "Details" }).click();
  const details = await within(3_000, () => page.getByRole("dialog").first().isVisible());
  step("Details opens from it", details !== null);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  await rowOf(page, martin.fullName).click({ button: "right" });
  await menu.getByRole("menuitem", { name: "Delete Conversation…" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  const gone = await within(5_000, async () => (await rowOf(page, martin.fullName).count()) === 0);
  step("Delete Conversation… removes it", gone !== null);

  await rowOf(page, "Ferrite Room").click({ button: "right" });
  const dimmed = await menu
    .getByRole("menuitem", { name: "Delete Conversation…" })
    .getAttribute("aria-disabled");
  step("the shared room cannot be deleted", dimmed === "true");
});

#!/usr/bin/env node
// Deleting a card in Contacts on Ferrite in a real browser against the running app: asks first, the
// next card is shown, and the card stays gone after a reload. Exits 0 only when every step passed
// and no page logged a console error, a page error, a failed request or an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/contacts-delete-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                        [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("contacts-delete");
const id = Date.now().toString(36);
const person = { name: `cdchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };

const windowOf = (page) => page.locator('.mac-contacts[aria-label="Contacts"]').first();
const rows = (page) => windowOf(page).getByRole("listbox").getByRole("option");
const rowOf = (page, name) => rows(page).filter({ hasText: name }).first();

async function menu(page, title, name) {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: title, exact: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name }).first().click();
}

async function newCard(page, first) {
  await menu(page, "File", "New Card");
  const name = windowOf(page).getByRole("textbox", { name: /first/i }).first();
  await name.fill(first);
  await windowOf(page).getByRole("button", { name: "Done" }).click();
  await within(3_000, () => rowOf(page, first).isVisible());
}

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", person);
  await openFromDock(page, "Contacts");
  await within(15_000, () => windowOf(page).isVisible());
  await newCard(page, `Anna${id}`);
  await newCard(page, `Bert${id}`);

  await rowOf(page, `Anna${id}`).click();
  await page.keyboard.press("Delete");
  const alert = page.getByRole("alertdialog");
  step("the Delete key asks first", (await within(3_000, () => alert.isVisible())) !== null);
  await shot(page, "contacts-delete-alert");
  await alert.getByRole("button", { name: "Cancel" }).click();
  step("Cancel keeps the card", await rowOf(page, `Anna${id}`).isVisible());

  await menu(page, "Edit", "Delete Card");
  await alert.getByRole("button", { name: "Delete" }).click();
  const gone = await within(4_000, async () => (await rowOf(page, `Anna${id}`).count()) === 0);
  step("Edit > Delete Card removes it", gone !== null);
  const next = await within(3_000, async () =>
    rows(page)
      .filter({ hasText: `Bert${id}` })
      .first()
      .getAttribute("aria-selected")
      .then((v) => v === "true"),
  );
  step("the next card is shown", next !== null);

  await page.waitForTimeout(1_500);
  await page.reload();
  await windowOf(page)
    .waitFor({ timeout: 8_000 })
    .catch(() => openFromDock(page, "Contacts"));
  await within(8_000, () => rowOf(page, `Bert${id}`).isVisible());
  step(
    "it stays gone after a reload, and the other stays",
    (await rowOf(page, `Anna${id}`).count()) === 0 && (await rowOf(page, `Bert${id}`).isVisible()),
  );
});

#!/usr/bin/env node
// Selecting several names in Contacts, in a real browser against the running app: a click with the
// Command key adds a name, the card pane says how many, Select All takes every name, Copy gives a
// vCard of them, and Delete removes them from the server after asking, leaving the person's own card.
// Exits 0 only when every step passed and no page logged a console error, a page error, a failed
// request or an HTTP error.
//
//   node e2e/contacts-select-several-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                                [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("contacts-select-several");
const id = Date.now().toString(36);
const chris = { name: `cschris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const NAMES = ["Ada", "Bea", "Cleo"].map((first) => `${first}${id}`);

const windowOf = (page) => page.locator('.mac-contacts[aria-label="Contacts"]').first();
const rows = (page) => windowOf(page).getByRole("listbox").getByRole("option");
const rowOf = (page, name) => rows(page).filter({ hasText: name }).first();
const pressed = (page) => windowOf(page).getByRole("listbox").locator('[aria-selected="true"]');
const seen = (check) => within(8_000, check).then((took) => took !== null);

async function menu(page, title, name) {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: title, exact: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name }).first().click();
}
async function storedNames(page) {
  const reply = await page.request.get(new URL("/api/contacts/cards", page.url()).href);
  return ((await reply.json()).cards ?? []).map((card) => card.first);
}

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", chris);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await openFromDock(page, "Contacts");
  await windowOf(page).locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });
  for (const first of NAMES) {
    await menu(page, "File", "New Card");
    await windowOf(page).getByRole("textbox", { name: /first/i }).first().fill(first);
    await windowOf(page).getByRole("button", { name: "Done" }).click();
    await within(5_000, () => rowOf(page, first).isVisible());
  }

  await rowOf(page, NAMES[0]).click();
  await rowOf(page, NAMES[1]).click({ modifiers: ["Control"] });
  step(
    "A click with the Command key adds a second name, and the pane says how many",
    await seen(
      async () =>
        (await pressed(page).count()) === 2 &&
        (await windowOf(page).getByText("2 Cards").isVisible()),
    ),
  );
  await page.waitForTimeout(300);
  await shot(page, "contacts-select-several");

  await page.keyboard.press("Control+l");
  await page.waitForTimeout(300);
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "Card", exact: true })
    .first()
    .click();
  const editItem = page.getByRole("menu").last().getByRole("menuitem", { name: "Edit Card" });
  step(
    "Edit is dimmed for several, and its key opens no editor",
    (await editItem.getAttribute("aria-disabled")) === "true" &&
      (await windowOf(page).getByRole("textbox", { name: /first/i }).count()) === 0 &&
      (await windowOf(page).getByText("2 Cards").isVisible()),
  );
  await page.keyboard.press("Escape");

  await page.keyboard.press("Control+c");
  step(
    "Copy gives a vCard of both",
    await seen(async () => {
      const text = await page.evaluate(() => navigator.clipboard.readText());
      return text.includes(NAMES[0]) && text.includes(NAMES[1]) && !text.includes(NAMES[2]);
    }),
  );

  await rowOf(page, NAMES[2]).click();
  step(
    "A plain click goes back to one card",
    await seen(
      async () =>
        (await pressed(page).count()) === 1 &&
        (await windowOf(page).getByText("2 Cards").count()) === 0,
    ),
  );

  await page.keyboard.press("Control+a");
  const total = await rows(page).count();
  step(
    "Select All takes every name",
    await seen(async () => (await pressed(page).count()) === total),
  );
  await rowOf(page, NAMES[0]).click();
  await rowOf(page, NAMES[2]).click({ modifiers: ["Control"] });
  await menu(page, "Edit", "Delete 2 Cards");
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
  step(
    "Delete, after asking, removes those two from the server and leaves the third",
    await seen(async () => {
      const names = await storedNames(page);
      return !names.includes(NAMES[0]) && !names.includes(NAMES[2]) && names.includes(NAMES[1]);
    }),
  );
  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Contacts").catch(() => {});
  step(
    "and they stay gone after a reload",
    (await within(15_000, () => rowOf(page, NAMES[1]).isVisible())) !== null &&
      (await rowOf(page, NAMES[0]).count()) === 0,
  );
});

#!/usr/bin/env node
// Contacts' View menu in a real browser against the running app: Hide Groups and Show Groups by menu
// and by key, Card Only and List and Card, read from the person's settings and after a reload.
// Exits 0 only when every step passed and no page logged a console error, a page error, a failed
// request or an HTTP error.
//
//   node e2e/contacts-layout-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                        [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("contacts-layout");
const id = Date.now().toString(36);
const chris = { name: `clchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };

const windowOf = (page) => page.locator('.mac-contacts[aria-label="Contacts"]').first();
const groups = (page) => windowOf(page).getByRole("tree", { name: "Groups" });
const list = (page) => windowOf(page).getByRole("listbox");
const controls = (page) => windowOf(page).locator(".mac-contacts-controls");
const seen = (check) => within(8_000, check).then((took) => took !== null);
const menu = async (page, title, name) => {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: title, exact: true })
    .first()
    .click();
  const open = page.getByRole("menu").last();
  await open.getByRole("menuitem", { name }).or(open.getByRole("menuitemradio", { name })).click();
};
const values = async (page) => {
  const reply = await page.request.get(
    new URL("/api/system-preferences/settings", page.url()).href,
  );
  return (await reply.json()).values ?? {};
};
const open = async (page) => {
  await openFromDock(page, "Contacts");
  await windowOf(page).locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });
};

await run({}, {}, async ({ person }) => {
  const page = await person("chris", chris);
  await open(page);
  step(
    "the groups and the list start shown",
    (await groups(page).isVisible()) && (await list(page).isVisible()),
  );

  await menu(page, "View", "Hide Groups");
  step(
    "View > Hide Groups hides them and leaves the window controls on the list, on the server",
    (await seen(async () => (await groups(page).count()) === 0)) &&
      (await controls(page).isVisible()) &&
      (await list(page).isVisible()) &&
      (await seen(async () => (await values(page))["contacts.groupsHidden"] === true)),
  );
  await shot(page, "contacts-groups-hidden");

  await page.reload({ waitUntil: "load" });
  await open(page);
  step(
    "after a reload the groups stay hidden",
    (await seen(async () => (await groups(page).count()) === 0)) && (await list(page).isVisible()),
  );

  await page.keyboard.press("ControlOrMeta+1");
  step(
    "the key \u23181 shows them again",
    (await seen(() => groups(page).isVisible())) &&
      (await seen(async () => (await values(page))["contacts.groupsHidden"] === false)),
  );

  await menu(page, "View", "Card Only");
  step(
    "View > Card Only leaves the card and the window controls, on the server",
    (await seen(
      async () => (await list(page).count()) === 0 && (await groups(page).count()) === 0,
    )) &&
      (await controls(page).isVisible()) &&
      (await windowOf(page).getByRole("button", { name: "Edit" }).isVisible()) &&
      (await seen(async () => (await values(page))["contacts.layout"] === "card")),
  );
  await shot(page, "contacts-card-only");

  await page.reload({ waitUntil: "load" });
  await open(page);
  step(
    "after a reload it is still the card only",
    await seen(async () => (await list(page).count()) === 0),
  );

  await page.keyboard.press("ControlOrMeta+f");
  step("Find shows the list, where the search field is", await seen(() => list(page).isVisible()));
  await page.keyboard.type("no such name");
  step(
    "and the keyboard is in the search field: what is typed filters the list",
    await seen(() => windowOf(page).getByText("No Results").isVisible()),
  );
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");

  await page.keyboard.press("ControlOrMeta+2");
  await seen(async () => (await list(page).count()) === 0);
  await menu(page, "View", "List and Card");
  step(
    "View > List and Card shows the list and the groups again, on the server",
    (await seen(() => list(page).isVisible())) &&
      (await groups(page).isVisible()) &&
      (await seen(async () => (await values(page))["contacts.layout"] === "list")),
  );
});

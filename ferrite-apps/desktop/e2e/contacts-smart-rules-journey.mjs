#!/usr/bin/env node
// Contacts' Smart Group rule builder, in a real browser against the running app: a group of two rules takes the cards
// that meet both, Edit Smart Group makes it any, another rule goes in and out, and it is kept on the server and shown
// again after a reload. Exits 0 only when every step passed and no page logged a console error, a page error, a failed
// request or an HTTP error.
//
//   node e2e/contacts-smart-rules-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("contacts-smart-rules");
const id = Date.now().toString(36);
const chris = { name: `csrchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const GROUP = `Friends ${id}`;

const windowOf = (page) => page.locator('.mac-contacts[aria-label="Contacts"]').first();
const rows = (page) => windowOf(page).getByRole("listbox").getByRole("option");
const names = async (page) => (await rows(page).allInnerTexts()).map((each) => each.trim()).sort();
const seen = (check) => within(10_000, check).then((took) => took !== null);
const listIs = (page, wanted) =>
  seen(async () => JSON.stringify(await names(page)) === JSON.stringify(wanted));
const sheet = (page) => page.getByRole("dialog", { name: /Smart Group$/ });
const choose = async (page, label, option) => {
  await sheet(page).getByRole("combobox", { name: label }).click();
  // The pop-up settles over its trigger first.
  await page.waitForTimeout(300);
  await page
    .locator("[data-base-ui-portal]")
    .getByRole("option", { name: option, exact: true })
    .click();
};
const url = (page, path) => new URL(path, page.url()).href;

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", chris);
  await openFromDock(page, "Contacts");
  await windowOf(page).locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });
  const before = await (await page.request.get(url(page, "/api/contacts/cards"))).json();
  const card = (first, company, email) => ({
    id: `${first.toLowerCase()}-${id}`,
    account: "icloud",
    first,
    last: "Test",
    company,
    emails: email ? [{ label: "work", value: email }] : undefined,
  });
  const saved = await page.request.put(url(page, "/api/contacts/cards"), {
    data: {
      rev: before.rev,
      cards: [
        ...(before.cards ?? []),
        card("Ada", "Apple", "ada@x.example"),
        card("Bob", "Apple"),
        card("Cyd", "Other", "cyd@x.example"),
      ],
    },
  });
  if (!saved.ok()) throw new Error(`could not store the cards: ${saved.status()}`);
  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Contacts");
  await windowOf(page).locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });

  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "File", exact: true })
    .first()
    .click();
  await page.getByRole("menu").last().getByRole("menuitem", { name: "New Smart Group…" }).click();
  await sheet(page).getByRole("textbox", { name: "Smart Group Name" }).fill(GROUP);
  await choose(page, "Rule 1 field", "Company");
  await sheet(page).getByRole("textbox", { name: "Rule 1 value" }).fill("apple");
  await sheet(page).getByRole("button", { name: "Add a rule after rule 1" }).click();
  await choose(page, "Rule 2 field", "Email");
  step(
    "OK waits for every rule's text",
    await sheet(page).getByRole("button", { name: "OK" }).isDisabled(),
  );
  await sheet(page).getByRole("textbox", { name: "Rule 2 value" }).fill("x.example");
  await page.waitForTimeout(200);
  await shot(page, "contacts-smart-rules");
  await sheet(page).getByRole("button", { name: "OK" }).click();
  step("two rules take the cards that meet both", await listIs(page, ["Ada Test"]));

  const row = windowOf(page).getByRole("treeitem", { name: GROUP });
  await row.getByText(GROUP, { exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Edit Smart Group…" }).click();
  step(
    "Edit Smart Group opens holding its rules",
    await seen(
      async () =>
        (await sheet(page).getByRole("textbox", { name: "Rule 2 value" }).inputValue()) ===
        "x.example",
    ),
  );
  await choose(page, "Match", "any of the following");
  await sheet(page).getByRole("button", { name: "OK" }).click();
  step(
    "any of them takes the cards that meet one",
    await listIs(page, ["Ada Test", "Bob Test", "Cyd Test"]),
  );

  await row.getByText(GROUP, { exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Edit Smart Group…" }).click();
  await sheet(page).getByRole("button", { name: "Remove rule 2" }).click();
  await choose(page, "Rule 1 test", "does not contain");
  await sheet(page).getByRole("button", { name: "OK" }).click();
  step(
    "a rule taken out and a test changed choose again",
    await seen(async () => {
      const list = await names(page);
      return list.includes("Cyd Test") && !list.includes("Ada Test") && !list.includes("Bob Test");
    }),
  );

  step(
    "the group is kept on the server",
    await seen(async () => {
      const reply = await page.request.get(url(page, "/api/contacts/smart-groups"));
      const group = ((await reply.json()).smart_groups ?? []).find((each) => each.name === GROUP);
      return group?.rule === "rules" && group.any === true && group.conditions?.length === 1;
    }),
  );
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Contacts");
  await windowOf(page).locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });
  await row.getByText(GROUP, { exact: true }).click();
  step(
    "and chooses the same after a reload",
    await seen(async () => {
      const list = await names(page);
      return list.includes("Cyd Test") && !list.includes("Ada Test");
    }),
  );
});

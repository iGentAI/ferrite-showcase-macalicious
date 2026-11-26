#!/usr/bin/env node
// Groups of the person's own in Contacts, in a real browser against the running app: File > New
// Group with its name typed in the sidebar, New Group from Selection, a card dragged onto a group,
// Remove from Group, Rename Group, the contextual menus of a name and of a group, and Delete, each
// read from the server and, for the groups, after a reload. Exits 0 only when every step passed and
// no page logged a console error, a page error, a failed request or an HTTP error.
//
//   node e2e/contacts-groups-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                        [--browser chromium|chrome|firefox|webkit]

import { readFile } from "node:fs/promises";
import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("contacts-groups");
const id = Date.now().toString(36);
const chris = { name: `cgchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const NAMES = ["Ada", "Bea", "Cleo"].map((first) => `${first}${id}`);

const windowOf = (page) => page.locator('.mac-contacts[aria-label="Contacts"]').first();
const rows = (page) => windowOf(page).getByRole("listbox").getByRole("option");
const rowOf = (page, name) => rows(page).filter({ hasText: name }).first();
const groupRow = (page, name) =>
  windowOf(page).getByRole("tree", { name: "Groups" }).getByRole("treeitem", { name });
const seen = (check, ms = 8_000) => within(ms, check).then((took) => took !== null);
const count = (page, wanted) => seen(async () => (await rows(page).count()) === wanted);

async function menu(page, title, name) {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: title, exact: true })
    .first()
    .click();
  await page.getByRole("menu").last().getByRole("menuitem", { name }).click();
}
const contextItem = async (page, target, name) => {
  await target.click({ button: "right" });
  await page.getByRole("menu").last().getByRole("menuitem", { name }).click();
};
async function stored(page) {
  const reply = await page.request.get(new URL("/api/contacts/groups", page.url()).href);
  return (await reply.json()).groups ?? [];
}
async function cards(page) {
  const reply = await page.request.get(new URL("/api/contacts/cards", page.url()).href);
  return (await reply.json()).cards ?? [];
}
const typeName = async (page, name) => {
  const field = windowOf(page).getByRole("textbox", { name: "Group name" });
  await field.waitFor({ timeout: 5_000 });
  await field.fill(name);
  await field.press("Enter");
};
const open = async (page) => {
  await openFromDock(page, "Contacts");
  await windowOf(page).locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });
};

await run({}, {}, async ({ person }) => {
  const page = await person("chris", chris);
  await open(page);
  for (const first of NAMES) {
    await menu(page, "File", "New Card");
    await windowOf(page).getByRole("textbox", { name: /first/i }).first().fill(first);
    await windowOf(page).getByRole("button", { name: "Done" }).click();
    await within(5_000, () => rowOf(page, first).isVisible());
  }
  await seen(async () => (await cards(page)).length === 4, 10_000);
  const idOf = async (first) => (await cards(page)).find((card) => card.first === first)?.id;
  const [ada, bea, cleo] = [await idOf(NAMES[0]), await idOf(NAMES[1]), await idOf(NAMES[2])];

  await menu(page, "File", /^New Group$/);
  await typeName(page, "Crew");
  step(
    "File > New Group is named in the sidebar, is empty and is on the server",
    (await seen(() => groupRow(page, "Crew").isVisible())) &&
      (await windowOf(page).getByText("No Cards").isVisible()) &&
      (await seen(async () => {
        const groups = await stored(page);
        return groups[0]?.name === "Crew" && groups[0].members.length === 0;
      })),
  );

  await page.keyboard.press("Control+Shift+N");
  await typeName(page, "Spare");
  step(
    "the key \u21e7\u2318N makes another",
    await seen(async () => (await stored(page)).length === 2),
  );

  await groupRow(page, "All Contacts").click();
  await count(page, 4);
  await rowOf(page, NAMES[0]).dragTo(groupRow(page, "Crew"));
  const crew = async () => (await stored(page)).find((group) => group.name === "Crew");
  step(
    "a card dragged onto a group joins it, on the server",
    await seen(async () => (await crew())?.members.join() === ada),
  );

  await rowOf(page, NAMES[1]).click();
  await rowOf(page, NAMES[2]).click({ modifiers: ["Control"] });
  await rowOf(page, NAMES[2]).dragTo(groupRow(page, "Crew"));
  step(
    "two selected names dragged together both join it",
    await seen(
      async () =>
        [...((await crew())?.members ?? [])].sort().join() === [ada, bea, cleo].sort().join(),
    ),
  );

  await groupRow(page, "Crew").click();
  step("the group lists its three cards", await count(page, 3));
  await shot(page, "contacts-groups-list");

  await rowOf(page, NAMES[0]).click();
  await menu(page, "Edit", "Remove from Group");
  step(
    "Edit > Remove from Group takes the card out, and the card stays",
    (await count(page, 2)) &&
      (await seen(async () => (await crew())?.members.length === 2)) &&
      (await idOf(NAMES[0])) === ada,
  );

  await menu(page, "Edit", "Rename Group");
  await typeName(page, "Deck crew");
  const deck = async () => (await stored(page)).find((group) => group.name === "Deck crew");
  step(
    "Edit > Rename Group renames it, on the server",
    (await seen(() => groupRow(page, "Deck crew").isVisible())) &&
      (await seen(async () => (await deck()) !== undefined)),
  );

  await page.reload({ waitUntil: "load" });
  await open(page);
  await within(10_000, () => groupRow(page, "Deck crew").isVisible());
  await groupRow(page, "Deck crew").click();
  step(
    "after a reload the group is there with its cards",
    (await count(page, 2)) && (await rowOf(page, NAMES[1]).isVisible()),
  );

  // The name row's contextual menu.
  await groupRow(page, "All Contacts").click();
  await count(page, 4);
  await rowOf(page, NAMES[0]).click({ button: "right" });
  await page.getByRole("menu").last().getByRole("menuitem").first().waitFor({ timeout: 3_000 });
  await shot(page, "contacts-name-menu");
  await page
    .getByRole("menu")
    .last()
    .getByRole("menuitem", { name: "New Group from Selection" })
    .click();
  await typeName(page, "Solo");
  step(
    "a name's menu makes a group from it",
    await seen(async () => {
      const solo = (await stored(page)).find((group) => group.name === "Solo");
      return solo?.members.join() === ada;
    }),
  );
  await groupRow(page, "All Contacts").click();
  await contextItem(page, rowOf(page, NAMES[1]), "Edit Card");
  step(
    "a name's menu chooses the card under the pointer and edits it",
    await seen(
      async () =>
        (await windowOf(page).getByRole("textbox", { name: /first/i }).first().inputValue()) ===
        NAMES[1],
    ),
  );
  await windowOf(page).getByRole("button", { name: "Done" }).click();
  await contextItem(page, rowOf(page, NAMES[0]), "Delete Card");
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  step(
    "a name's menu deletes the card, which leaves its groups",
    await seen(async () => {
      const solo = (await stored(page)).find((group) => group.name === "Solo");
      return (await idOf(NAMES[0])) === undefined && solo?.members.length === 0;
    }),
  );

  // A group row's contextual menu.
  await groupRow(page, "Deck crew").click({ button: "right" });
  await page
    .getByRole("menu")
    .last()
    .getByRole("menuitem", { name: "Rename Group" })
    .waitFor({ timeout: 3_000 });
  await shot(page, "contacts-group-menu");
  const downloading = page.waitForEvent("download", { timeout: 8_000 });
  await page.getByRole("menu").last().getByRole("menuitem", { name: "Export Group" }).click();
  const file = await downloading;
  const exported = await readFile(await file.path(), "utf8");
  step(
    "a group's menu exports exactly its cards, as a file named for it",
    file.suggestedFilename() === "Deck crew.vcf" &&
      (exported.match(/BEGIN:VCARD/g) ?? []).length === 2 &&
      exported.includes(NAMES[1]) &&
      exported.includes(NAMES[2]) &&
      !exported.includes(NAMES[0]),
    exported,
  );
  await contextItem(page, groupRow(page, "Spare"), "Rename Group");
  await typeName(page, "Reserve");
  step(
    "a group's menu renames it",
    await seen(async () => (await stored(page)).some((group) => group.name === "Reserve")),
  );
  const cardsBefore = (await cards(page)).map((card) => card.id).sort();
  await contextItem(page, groupRow(page, "Reserve"), "Delete Group");
  const asked = await seen(() => page.getByRole("alertdialog").getByText("Reserve").isVisible());
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  step(
    "a group's menu deletes it after asking, on the server",
    asked &&
      (await seen(async () => !(await stored(page)).some((group) => group.name === "Reserve"))),
  );
  await contextItem(page, groupRow(page, "Deck crew"), "Delete Group");
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await seen(async () => !(await stored(page)).some((group) => group.name === "Deck crew"));
  const cardsAfter = (await cards(page)).map((card) => card.id).sort();
  step(
    "deleting a group that holds cards leaves those cards",
    cardsBefore.length === 3 &&
      cardsBefore.includes(bea) &&
      cardsBefore.includes(cleo) &&
      JSON.stringify(cardsAfter) === JSON.stringify(cardsBefore),
  );

  await page.reload({ waitUntil: "load" });
  await open(page);
  await within(10_000, () => groupRow(page, "All Contacts").isVisible());
  await groupRow(page, "All Contacts").click();
  step(
    "after a reload the deleted groups stay gone, and their cards are in All Contacts",
    (await seen(() => groupRow(page, "Solo").isVisible(), 10_000)) &&
      (await groupRow(page, "Reserve").count()) === 0 &&
      (await groupRow(page, "Deck crew").count()) === 0 &&
      (await seen(() => rowOf(page, NAMES[1]).isVisible())) &&
      (await rowOf(page, NAMES[2]).isVisible()),
  );
});

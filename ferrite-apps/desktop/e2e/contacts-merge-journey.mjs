#!/usr/bin/env node
// Duplicates and merging in Contacts, in a real browser against the running app. Merge Selected Cards puts
// everything two cards hold on one, and the group the other was in now holds it; Look for Duplicates finds
// cards of one name and merges them; both read back from the server and after a reload. Exits 0 only when
// every step passed and no page logged a console error, a page error, a failed request or an HTTP error.
//
//   node e2e/contacts-merge-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("contacts-merge");
const id = Date.now().toString(36);
const chris = { name: `cmchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const ADA = `Ada${id}`;
const BEA = `Bea${id}`;

const windowOf = (page) => page.locator('.mac-contacts[aria-label="Contacts"]').first();
const rows = (page) => windowOf(page).getByRole("listbox").getByRole("option");
const rowsOf = (page, name) => rows(page).filter({ hasText: name });
const seen = (check) => within(10_000, check).then((took) => took !== null);

async function menu(page, title, name) {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: title, exact: true })
    .first()
    .click();
  await page.getByRole("menu").last().getByRole("menuitem", { name }).first().click();
}
async function stored(page) {
  const reply = await page.request.get(new URL("/api/contacts/cards", page.url()).href);
  return (await reply.json()).cards ?? [];
}
/** Two cards of one first name, the first with a job title, the second a company and a note. */
async function saveTwo(page, first) {
  const saved = await stored(page);
  const put = await page.request.get(new URL("/api/contacts/cards", page.url()).href);
  const { rev } = await put.json();
  const cards = [
    ...saved,
    {
      id: `${first}-a`,
      account: "icloud",
      first,
      last: "",
      jobTitle: "Engineer",
      phones: [{ label: "mobile", value: "+1 555 010 2000" }],
    },
    {
      id: `${first}-b`,
      account: "icloud",
      first,
      last: "",
      company: "Analytical",
      note: "second card",
      phones: [
        { label: "work", value: "(+1) 555-010-2000" },
        { label: "home", value: "+1 555 010 3000" },
      ],
    },
  ];
  const reply = await page.request.put(new URL("/api/contacts/cards", page.url()).href, {
    data: { cards, rev },
  });
  if (!reply.ok()) throw new Error(`could not store the cards: ${reply.status()}`);
}

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", chris);
  await openFromDock(page, "Contacts");
  await windowOf(page).locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });
  await saveTwo(page, ADA);
  await saveTwo(page, BEA);
  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Contacts").catch(() => {});
  await within(15_000, async () => (await rowsOf(page, ADA).count()) === 2);

  // A group holding only the card that will go: the kept card must be in it by the end.
  await rowsOf(page, ADA).nth(1).click();
  await menu(page, "File", "New Group from Selection");
  await page.keyboard.press("Enter");
  await within(10_000, async () => (await rowsOf(page, ADA).count()) === 1);
  await page.waitForTimeout(1_000);
  await windowOf(page).getByText("All Contacts").first().click();
  await within(10_000, async () => (await rowsOf(page, ADA).count()) === 2);
  await rowsOf(page, ADA).nth(0).click();
  await rowsOf(page, ADA)
    .nth(1)
    .click({ modifiers: ["Control"] });
  await within(5_000, () => windowOf(page).getByText("2 Cards").isVisible());
  // Everything stored from here on: the groups first, then the kept card and the removal of the other
  // in one write.
  const writes = [];
  let groupsFirst = null;
  page.on("request", (request) => {
    if (request.method() !== "PUT") return;
    const path = new URL(request.url()).pathname;
    if (path === "/api/contacts/groups") {
      const held = (request.postDataJSON().groups ?? []).some((group) =>
        group.members.includes(`${ADA}-a`),
      );
      if (held) groupsFirst ??= writes.length === 0;
    }
    if (path === "/api/contacts/cards") {
      writes.push((request.postDataJSON().cards ?? []).filter((card) => card.first === ADA));
    }
  });
  await menu(page, "Card", "Merge Selected Cards");
  step(
    "Merge Selected Cards leaves one card, with what both held",
    await seen(async () => {
      const found = (await stored(page)).filter((card) => card.first === ADA);
      return (
        found.length === 1 &&
        found[0].jobTitle === "Engineer" &&
        found[0].company === "Analytical" &&
        found[0].note === "second card" &&
        found[0].phones.length === 2
      );
    }),
  );
  step("the group with the kept card was written before the cards", groupsFirst === true);
  step(
    "no write held the merged card with the other, or the other gone without it",
    writes.length > 0 &&
      writes.every(
        (cards) =>
          (cards.length === 2 && cards.every((card) => !card.company || !card.jobTitle)) ||
          (cards.length === 1 && cards[0].company && cards[0].jobTitle),
      ),
    JSON.stringify(writes.map((cards) => cards.length)),
  );
  step(
    "and the group that held only the other now holds the kept card",
    await seen(async () => {
      await windowOf(page).getByText("untitled group").first().click();
      return (await rowsOf(page, ADA).count()) === 1;
    }),
  );
  await page.waitForTimeout(300);
  await shot(page, "contacts-merged");

  // An edit under way when the alert asks is what gets merged.
  await windowOf(page).getByText("All Contacts").first().click();
  await rowsOf(page, BEA).first().click();
  await windowOf(page).getByRole("button", { name: "Edit", exact: true }).click();
  await windowOf(page).getByRole("textbox", { name: /note/i }).first().fill("edited just now");
  await menu(page, "Card", "Look for Duplicates");
  const alert = page.getByRole("alertdialog");
  step(
    "Look for Duplicates counts what it found",
    await seen(async () => (await alert.innerText()).includes("2 cards with the same name")),
  );
  await shot(page, "contacts-duplicates");
  await alert.getByRole("button", { name: "Merge", exact: true }).click();
  step(
    "and Merge leaves one of them",
    await seen(async () => {
      const found = (await stored(page)).filter((card) => card.first === BEA);
      return (
        found.length === 1 &&
        found[0].phones.length === 2 &&
        found[0].note.includes("edited just now")
      );
    }),
  );

  await menu(page, "Card", "Look for Duplicates");
  step(
    "nothing is found the second time",
    await seen(async () => (await alert.innerText()).includes("no duplicates")),
  );
  await alert.getByRole("button", { name: "OK" }).click();

  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Contacts").catch(() => {});
  step(
    "after a reload the merged cards are one each",
    await seen(
      async () =>
        (await rowsOf(page, ADA).count()) === 1 &&
        (await stored(page)).filter((card) => card.first === BEA).length === 1,
    ),
  );
});

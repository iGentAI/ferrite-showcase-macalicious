#!/usr/bin/env node
// Card > Add Field in Contacts, in a real browser against the running app: each field is added from
// the submenu, typed in, read from the server, shown on the finished card and shown again after a
// reload; an added field left empty goes when the card is done; Show on Map opens Maps. Exits 0
// only when every step passed and no page logged a console error, a page error, a failed request or
// an HTTP error.
//
//   node e2e/contacts-fields-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                        [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("contacts-fields");
const id = Date.now().toString(36);
const chris = { name: `cfchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };

const windowOf = (page) => page.locator('.mac-contacts[aria-label="Contacts"]').first();
const seen = (check) => within(8_000, check).then((took) => took !== null);
const box = (page, name) => windowOf(page).getByRole("textbox", { name, exact: true });
async function addField(page, title) {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "Card", exact: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Add Field" }).first().hover();
  await page.getByRole("menu").last().getByRole("menuitem", { name: title, exact: true }).click();
}
const storedCard = async (page) => {
  const reply = await page.request.get(new URL("/api/contacts/cards", page.url()).href);
  return ((await reply.json()).cards ?? []).find((card) => card.first === `Ines${id}`);
};
const open = async (page) => {
  await openFromDock(page, "Contacts");
  await windowOf(page).locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });
};

await run({}, {}, async ({ person }) => {
  const page = await person("chris", chris);
  await open(page);
  await page.keyboard.press("Control+N");
  await box(page, "First").fill(`Ines${id}`);
  await box(page, "Last").fill("Okafor");
  await windowOf(page).getByRole("button", { name: "Done" }).click();

  const typed = [
    ["Phonetic First Name", "Phonetic First", "Ee-ness"],
    ["Phonetic Last Name", "Phonetic Last", "Oh-ka-for"],
    ["Nickname", "Nickname", "Captain"],
    ["Job Title", "Job Title", "Skipper"],
    ["Department", "Department", "Crossings"],
    ["Related Name", "mother related name", "Ada Okafor"],
    ["Date", "anniversary date", "6/2/2015"],
    ["Social Profile", "Twitter profile", "ines"],
  ];
  for (const [title, label, value] of typed) {
    await addField(page, title);
    const field = box(page, label);
    const focused = await seen(() => field.evaluate((input) => input === document.activeElement));
    step(`Card > Add Field > ${title} starts the edit with the keyboard in the field`, focused);
    await field.fill(value);
  }
  await addField(page, "Address");
  step(
    "Card > Add Field > Address puts the keyboard in its street",
    await seen(() =>
      box(page, "home Street").evaluate((input) => input === document.activeElement),
    ),
  );
  await box(page, "home Street").fill("1 Commercial Street");
  await box(page, "home City").fill("Portland");
  await box(page, "home State").fill("ME");
  await box(page, "home ZIP").fill("04101");
  await box(page, "home Country").fill("USA");
  await shot(page, "contacts-fields-editing");
  await windowOf(page).getByRole("button", { name: "Done" }).click();

  step(
    "each field is on the server",
    await seen(async () => {
      const card = await storedCard(page);
      return (
        card?.phoneticFirst === "Ee-ness" &&
        card.phoneticLast === "Oh-ka-for" &&
        card.nickname === "Captain" &&
        card.jobTitle === "Skipper" &&
        card.department === "Crossings" &&
        card.relatedNames?.[0]?.value === "Ada Okafor" &&
        card.dates?.[0]?.value === "6/2/2015" &&
        card.socials?.[0]?.value === "ines" &&
        card.addresses?.[0]?.zip === "04101"
      );
    }),
  );

  const shownOnCard = async () => {
    const pane = windowOf(page).locator(".mac-contacts-card");
    const text = await pane.innerText();
    return [
      "Ee-ness Oh-ka-for",
      "\u201cCaptain\u201d",
      "Skipper",
      "Crossings",
      "Ada Okafor",
      "June 2, 2015",
      "ines",
      "1 Commercial Street",
      "Portland, ME 04101",
      "USA",
    ].every((line) => text.includes(line));
  };
  step("the finished card shows each one", await seen(shownOnCard));
  await page.waitForTimeout(300);
  await shot(page, "contacts-fields-card");

  await page.reload({ waitUntil: "load" });
  await open(page);
  await windowOf(page)
    .getByRole("option", { name: new RegExp(`Ines${id}`) })
    .click();
  step("after a reload the card still shows each one", await seen(shownOnCard));

  await page.keyboard.press("Control+f");
  await windowOf(page)
    .getByRole("searchbox")
    .or(windowOf(page).locator(".mac-contacts-search input"))
    .first()
    .fill("Skipper");
  step(
    "the search finds a card by an added field",
    await seen(
      async () => (await windowOf(page).getByRole("listbox").getByRole("option").count()) === 1,
    ),
  );
  await windowOf(page).locator(".mac-contacts-search input").first().fill("");

  await windowOf(page)
    .getByRole("option", { name: new RegExp(`Ines${id}`) })
    .click();
  await addField(page, "Related Name");
  await windowOf(page).getByRole("button", { name: "Done" }).click();
  await page.keyboard.press("Control+l");
  await box(page, "Nickname").fill("");
  await windowOf(page).getByRole("button", { name: "Done" }).click();
  step(
    "a head field left empty goes when the card is done",
    await seen(async () => {
      const card = await storedCard(page);
      return card !== undefined && card.nickname === undefined && card.jobTitle === "Skipper";
    }),
  );

  await windowOf(page).locator('[data-contacts-menu="address-0"]').click();
  await page.getByRole("menuitem", { name: "Show on Map" }).click();
  const maps = page.getByRole("region", { name: "Maps", exact: true }).first();
  const field = maps.getByRole("searchbox");
  const found = page
    .locator(".mac-maps-card, .mac-maps-search-list")
    .filter({ hasText: /Portland/ })
    .first();
  step(
    "Show on Map searches for the whole address in Maps, and Maps finds it in its city",
    await seen(
      async () =>
        (await field.inputValue()).includes("1 Commercial Street") &&
        (await field.inputValue()).includes("Portland") &&
        (await found.count()) > 0,
    ),
    await field.inputValue().catch(() => ""),
  );
});

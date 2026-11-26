#!/usr/bin/env node
// Contacts' Undo and Redo, in a real browser against the running app: a new card, an edit and a deletion go back and
// come again by the menu and by the keys, each read from the server. Exits 0 only when every step passed and no page
// logged a console error, a page error, a failed request or an HTTP error.
//
//   node e2e/contacts-undo-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("contacts-undo");
const id = Date.now().toString(36);
const chris = { name: `cuchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const NAME = `Ada${id}`;
const EDITED = `Bea${id}`;
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/Ul1gnQAAAABJRU5ErkJggg==",
  "base64",
);

const windowOf = (page) => page.locator('.mac-contacts[aria-label="Contacts"]').first();
const rows = (page) => windowOf(page).getByRole("listbox").getByRole("option");
const rowOf = (page, name) => rows(page).filter({ hasText: name }).first();
const seen = (check) => within(10_000, check).then((took) => took !== null);
const firstNames = async (page) => {
  const reply = await page.request.get(new URL("/api/contacts/cards", page.url()).href);
  return ((await reply.json()).cards ?? []).map((card) => card.first);
};
const holds = (page, name) => seen(async () => (await firstNames(page)).includes(name));
const lacks = (page, name) => seen(async () => !(await firstNames(page)).includes(name));
async function menu(page, title, name) {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: title, exact: true })
    .first()
    .click();
  await page
    .getByRole("menu")
    .last()
    .locator('[role^="menuitem"]', { hasText: name })
    .first()
    .click();
}

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", chris);
  await openFromDock(page, "Contacts");
  await windowOf(page).locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });

  await menu(page, "File", "New Card");
  await windowOf(page).getByRole("textbox", { name: /first/i }).first().fill(NAME);
  await windowOf(page).getByRole("button", { name: "Done" }).click();
  await rowOf(page, NAME).click();
  step("a new card is kept", await holds(page, NAME));
  await menu(page, "Edit", "Undo New Card");
  step("Undo New Card takes it away, on the server", await lacks(page, NAME));
  await menu(page, "Edit", "Redo New Card");
  step("Redo brings it back, on the server", await holds(page, NAME));

  await rowOf(page, NAME).click();
  await windowOf(page).getByRole("button", { name: "Edit" }).click();
  const firstName = windowOf(page).getByRole("textbox", { name: /first/i }).first();
  await firstName.click();
  await firstName.press("End");
  await firstName.pressSequentially("typed");
  await menu(page, "Edit", "Undo");
  step(
    "while a card is edited, Edit > Undo takes back what was typed in the field",
    await seen(async () => !(await firstName.inputValue()).includes("typed")),
  );
  await menu(page, "Edit", "Redo");
  step(
    "and Edit > Redo puts it back",
    await seen(async () => (await firstName.inputValue()).includes("typed")),
  );
  await firstName.fill(EDITED);
  await windowOf(page).getByRole("button", { name: "Done" }).click();
  step("an edit is kept", await holds(page, EDITED));
  await rowOf(page, EDITED).click();
  await page.keyboard.press("Control+z");
  step(
    "the key takes back the whole edit",
    (await holds(page, NAME)) && (await lacks(page, EDITED)),
  );
  await page.keyboard.press("Control+Shift+z");
  step("and its key makes it again", await holds(page, EDITED));

  await rowOf(page, EDITED).click();
  await menu(page, "Edit", "Delete Card");
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  step("a card deleted goes", await lacks(page, EDITED));
  await menu(page, "Edit", "Undo Delete Card");
  step("Undo Delete Card brings it back, on the server", await holds(page, EDITED));
  step("and it is listed", await seen(() => rowOf(page, EDITED).isVisible()));

  // An edit is one step, whatever is added during it.
  await rowOf(page, EDITED).click();
  await windowOf(page).getByRole("button", { name: "Edit" }).click();
  await windowOf(page).getByRole("textbox", { name: /first/i }).first().fill(NAME);
  await menu(page, "Card", "Add Field");
  await page.getByRole("menuitem", { name: "Nickname" }).first().click();
  await windowOf(page)
    .getByRole("textbox", { name: /nickname/i })
    .first()
    .fill("Bee");
  await windowOf(page).getByRole("button", { name: "Done" }).click();
  step("a name changed and a field added are kept", await holds(page, NAME));
  await rowOf(page, NAME).click();
  await page.keyboard.press("Control+z");
  step(
    "one Undo takes back both",
    (await holds(page, EDITED)) &&
      (await seen(async () => {
        const reply = await page.request.get(new URL("/api/contacts/cards", page.url()).href);
        const card = ((await reply.json()).cards ?? []).find((each) => each.first === EDITED);
        return card && !card.nickname;
      })),
  );
  await page.keyboard.press("Control+Shift+z");
  await page.keyboard.press("Control+z");

  // A picture has no history: a card deleted with one comes back without it, with no request failing.
  await rowOf(page, EDITED).click();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    menu(page, "Card", "Choose Custom Image"),
  ]);
  await chooser.setFiles({ name: "face.png", mimeType: "image/png", buffer: PNG });
  const imageOf = async () => {
    const reply = await page.request.get(new URL("/api/contacts/cards", page.url()).href);
    return ((await reply.json()).cards ?? []).find((each) => each.first === EDITED)?.image;
  };
  step("a chosen picture is kept on the card", await seen(async () => Boolean(await imageOf())));
  await menu(page, "Edit", "Delete Card");
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  step("the card with its picture goes", await lacks(page, EDITED));
  await menu(page, "Edit", "Undo Delete Card");
  step("Undo brings the card back", await holds(page, EDITED));
  step("without its picture", (await imageOf()) === undefined);
  await menu(page, "Edit", "Redo Delete Card");
  step("Redo deletes it again", await lacks(page, EDITED));
  await menu(page, "Edit", "Undo Delete Card");
  step("Undo brings it back again", await holds(page, EDITED));
  step("still without a picture", (await imageOf()) === undefined);
  await rowOf(page, EDITED).click();
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "Edit", exact: true })
    .first()
    .click();
  await page.waitForTimeout(200);
  await shot(page, "contacts-undo");
  await page.keyboard.press("Escape");

  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Contacts");
  step(
    "what Undo brought back is there after a reload",
    await seen(() => rowOf(page, EDITED).isVisible()),
  );

  // A card deleted while its picture is slow to go, and another edited meanwhile.
  const OTHER = `Cyd${id}`;
  const CHANGED = `Dee${id}`;
  await windowOf(page).locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });
  await menu(page, "File", "New Card");
  await windowOf(page).getByRole("textbox", { name: /first/i }).first().fill(OTHER);
  await windowOf(page).getByRole("button", { name: "Done" }).click();
  step("a second card is kept", await holds(page, OTHER));
  await rowOf(page, EDITED).click();
  const [again] = await Promise.all([
    page.waitForEvent("filechooser"),
    menu(page, "Card", "Choose Custom Image"),
  ]);
  await again.setFiles({ name: "face.png", mimeType: "image/png", buffer: PNG });
  step("its picture is kept", await seen(async () => Boolean(await imageOf())));
  const slowly = /\/api\/contacts\/pictures\//;
  await page.route(slowly, async (route) => {
    if (route.request().method() === "DELETE") {
      await new Promise((done) => setTimeout(done, 3_000));
    }
    await route.continue().catch(() => {});
  });
  await menu(page, "Edit", "Delete Card");
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await rowOf(page, OTHER).click();
  await windowOf(page).getByRole("button", { name: "Edit" }).click();
  await windowOf(page).getByRole("textbox", { name: /first/i }).first().fill(CHANGED);
  step("the slow deletion finishes during the edit", await lacks(page, EDITED));
  await page.unroute(slowly);
  await windowOf(page).getByRole("button", { name: "Done" }).click();
  step("the edit is kept", await holds(page, CHANGED));
  await menu(page, "Edit", "Undo Edit Card");
  step("Undo Edit Card takes back only the edit", await holds(page, OTHER));
  step(
    "and the card deleted stays gone",
    (await lacks(page, EDITED)) && (await rowOf(page, EDITED).count()) === 0,
  );
  await menu(page, "Edit", "Undo Delete Card");
  step(
    "Undo Delete Card then brings it back, with the other card as it was before the edit",
    (await holds(page, EDITED)) && (await holds(page, OTHER)) && (await lacks(page, CHANGED)),
  );
  step(
    "in the list too",
    await seen(
      async () =>
        (await rowOf(page, EDITED).isVisible()) &&
        (await rowOf(page, OTHER).isVisible()) &&
        (await rowOf(page, CHANGED).count()) === 0,
    ),
  );
});

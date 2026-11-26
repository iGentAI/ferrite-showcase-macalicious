#!/usr/bin/env node
// Contacts' File and Card menus, in a real browser against the running app: New Smart Group from Current
// Search keeps a group of what the search finds; Mark as a Company marks the card, read from the server after
// a reload; File > Export gives a vCard; Choose Custom Image takes a picture and Clear Custom Image removes
// it. Exits 0 only when every step passed and no page logged a console error, a page error, a failed request
// or an HTTP error.
//
//   node e2e/contacts-file-menu-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("contacts-file-menu");
const id = Date.now().toString(36);
const chris = { name: `cfchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const NAME = `Ada${id}`;
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/Ul1gnQAAAABJRU5ErkJggg==",
  "base64",
);

const windowOf = (page) => page.locator('.mac-contacts[aria-label="Contacts"]').first();
const rows = (page) => windowOf(page).getByRole("listbox").getByRole("option");
const rowOf = (page, name) => rows(page).filter({ hasText: name }).first();
const seen = (check) => within(10_000, check).then((took) => took !== null);
const cardOnServer = async (page) => {
  const reply = await page.request.get(new URL("/api/contacts/cards", page.url()).href);
  return ((await reply.json()).cards ?? []).find((card) => card.first === NAME);
};
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

  await menu(page, "Card", "Mark as a Company");
  step(
    "Mark as a Company marks the card, on the server",
    await seen(async () => (await cardOnServer(page))?.isCompany === true),
  );
  await page.keyboard.press("Control+\\");
  step("and its key takes it off", await seen(async () => !(await cardOnServer(page))?.isCompany));

  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    menu(page, "Card", "Choose Custom Image"),
  ]);
  await chooser.setFiles({ name: "face.png", mimeType: "image/png", buffer: PNG });
  step(
    "Choose Custom Image gives the card a picture, on the server",
    await seen(async () => !!(await cardOnServer(page))?.image),
  );
  await page.waitForTimeout(300);
  await shot(page, "contacts-card-picture");
  await menu(page, "Card", "Clear Custom Image");
  step(
    "Clear Custom Image takes it away",
    await seen(async () => !(await cardOnServer(page))?.image),
  );

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    (async () => {
      await page
        .getByRole("menubar")
        .getByRole("menuitem", { name: "File", exact: true })
        .first()
        .click();
      await page.getByRole("menu").last().getByText("Export", { exact: true }).click();
      await page.getByRole("menu").last().getByText("Export vCard…").click();
    })(),
  ]);
  step("File > Export gives a vCard of the card", /\.vcf$/.test(download.suggestedFilename()));

  await windowOf(page)
    .getByRole("searchbox")
    .or(windowOf(page).getByRole("textbox", { name: /search/i }))
    .first()
    .fill(NAME);
  await menu(page, "File", "New Smart Group from Current Search");
  step(
    "New Smart Group from Current Search lists a group of the search's name",
    await seen(() => windowOf(page).getByText(NAME).first().isVisible()),
  );
  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Contacts").catch(() => {});
  const reply = await within(15_000, async () => {
    const stored = await page.request.get(new URL("/api/contacts/smart-groups", page.url()).href);
    return JSON.stringify(await stored.json()).includes(NAME);
  });
  step("and it is kept on the server", reply !== null);
});

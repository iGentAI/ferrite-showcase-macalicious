#!/usr/bin/env node
// Scheduled by day, Undo, Redo, Cut, Copy and Paste of reminders on Ferrite, in a real browser against
// the running app, read from the server and after a reload. Exits 0 only when every step passed and no
// page logged a console error, a page error, a failed request or an HTTP error.
//
//   node e2e/reminders-clipboard-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                            [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("reminders-clipboard");
const id = Date.now().toString(36);
const person = { name: `rcchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const [A, B] = ["Ant", "Bee"].map((word) => `${word} ${id}`);

const windowOf = (page) => page.locator('.mac-reminders[aria-label="Reminders"]').first();
const row = (page, title) => windowOf(page).getByRole("option").filter({ hasText: title }).first();
const stored = async (page) => {
  const reply = await page.request.get(new URL("/api/reminders/data", page.url()).href);
  return (await reply.json()).data.reminders.filter((each) => each.title.endsWith(id));
};
const titles = async (page) => (await stored(page)).map((each) => each.title);
const same = (one, other) => JSON.stringify(one) === JSON.stringify(other);
const seen = (check) => within(10_000, check).then((took) => took !== null);
async function editItem(page, name) {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "Edit", exact: true })
    .first()
    .click();
  await page.getByRole("menu").last().getByRole("menuitem", { name }).click();
}

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", person);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await openFromDock(page, "Reminders");
  await windowOf(page).waitFor({ timeout: 15_000 });
  await page.waitForTimeout(800);
  for (const title of [`${A} tomorrow`, B]) {
    await page.keyboard.press("Control+n");
    const field = windowOf(page).getByRole("textbox", { name: "Title" });
    await field.waitFor({ timeout: 10_000 });
    await field.fill(title);
    await field.press("Enter");
  }
  await within(10_000, async () => (await stored(page)).length === 2);

  await row(page, A).click();
  await page.keyboard.press("Control+c");
  await row(page, A).click();
  await page.keyboard.press("Control+v");
  step(
    "Copy then Paste makes a new reminder right after the row selected, with its date",
    await seen(async () => {
      const all = await stored(page);
      return (
        same(
          all.map((each) => each.title),
          [A, A, B],
        ) &&
        Boolean(all[0].due) &&
        all[1].due === all[0].due &&
        all[1].id !== all[0].id
      );
    }),
    JSON.stringify(await titles(page)),
  );

  await page.keyboard.press("Control+z");
  step("Undo takes the pasted one away", await seen(async () => same(await titles(page), [A, B])));
  await editItem(page, "Redo");
  step("Edit > Redo puts it back", await seen(async () => same(await titles(page), [A, A, B])));

  await row(page, B).click();
  await editItem(page, "Cut");
  step("Cut removes the row", await seen(async () => same(await titles(page), [A, A])));
  await page.keyboard.press("Control+z");
  step(
    "Undo brings it back where it was",
    await seen(async () => same(await titles(page), [A, A, B])),
  );

  await row(page, B).click();
  await page.keyboard.press("Control+x");
  await seen(async () => same(await titles(page), [A, A]));
  await page.keyboard.press("Control+v");
  step(
    "What was cut can be pasted",
    await seen(async () => (await titles(page)).filter((each) => each === B).length === 1),
  );

  await page.keyboard.press("Control+v");
  await page.keyboard.press("Control+v");
  step(
    "Two pastes at once make two reminders with ids of their own",
    await seen(async () => {
      const all = await stored(page);
      return (
        all.filter((each) => each.title === B).length === 3 &&
        new Set(all.map((each) => each.id)).size === all.length
      );
    }),
    JSON.stringify(await titles(page)),
  );

  const heldBefore = await titles(page);
  await page.keyboard.press("Control+n");
  const typing = windowOf(page).getByRole("textbox", { name: "Title" });
  await typing.waitFor({ timeout: 10_000 });
  await typing.fill(`Unsaved ${id}`);
  await editItem(page, "Undo");
  step(
    "Edit > Undo while typing takes the typing and nothing before it",
    await seen(async () => (await typing.count()) === 0),
  );
  await page.waitForTimeout(800);
  step("and the server holds what it did", same(await titles(page), heldBefore));

  await page.evaluate((text) => navigator.clipboard.writeText(text), "k".repeat(1_500));
  await page.keyboard.press("Control+v");
  step(
    "A long line from elsewhere is pasted at the longest title, and the document still saves",
    await seen(async () => {
      const reply = await page.request.get(new URL("/api/reminders/data", page.url()).href);
      const all = (await reply.json()).data.reminders;
      return all.some((each) => each.title === "k".repeat(1_000));
    }),
  );

  await page.keyboard.press("Control+2");
  const heading = windowOf(page).getByRole("heading", { name: "Tomorrow", exact: true });
  step(
    "Scheduled lists its reminders under the day, and nothing undated",
    await seen(
      async () =>
        (await heading.isVisible()) &&
        (await row(page, A).isVisible()) &&
        (await row(page, B).count()) === 0 &&
        (await windowOf(page).getByRole("option").first().innerText()).includes(A),
    ),
  );
  await page.waitForTimeout(300);
  await shot(page, "reminders-scheduled-days");

  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Reminders").catch(() => {});
  step(
    "After a reload the pasted reminders and the days are there",
    await seen(async () => (await heading.isVisible()) && (await stored(page)).length === 5),
  );
});

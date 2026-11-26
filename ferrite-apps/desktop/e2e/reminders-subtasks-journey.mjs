#!/usr/bin/env node
// Sub-reminders on Ferrite, in a real browser against the running app: Edit > Indent and Outdent with
// their keys, a drag onto another reminder, a parent's triangle collapsing what is under it, completing
// and deleting a parent, each read from the server and after a reload. Exits 0 only when every step
// passed and no page logged a console error, a page error, a failed request or an HTTP error.
//
//   node e2e/reminders-subtasks-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                           [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("reminders-subtasks");
const id = Date.now().toString(36);
const person = { name: `rschris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const [A, B, C, D, E, F] = ["Ant", "Bee", "Cat", "Dog", "Elk", "Fox"].map(
  (word) => `${word} ${id}`,
);

const windowOf = (page) => page.locator('.mac-reminders[aria-label="Reminders"]').first();
const row = (page, title) => windowOf(page).getByRole("option").filter({ hasText: title }).first();
const storedAll = async (page) => {
  const reply = await page.request.get(new URL("/api/reminders/data", page.url()).href);
  return (await reply.json()).data.reminders.filter((each) => each.title.endsWith(id));
};
const parentOf = async (page, title) => {
  const all = await storedAll(page);
  const parent = all.find((each) => each.title === title)?.parentId;
  return parent ? all.find((each) => each.id === parent)?.title : undefined;
};
const seen = (check) => within(10_000, check).then((took) => took !== null);
const isOwnReminder = async (page, title) => {
  const found = (await storedAll(page)).find((each) => each.title === title);
  return found !== undefined && found.parentId === undefined;
};
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
  await openFromDock(page, "Reminders");
  await windowOf(page).waitFor({ timeout: 15_000 });
  await page.waitForTimeout(800);
  for (const title of [A, B, C, D]) {
    await page.keyboard.press("Control+n");
    const field = windowOf(page).getByRole("textbox", { name: "Title" });
    await field.waitFor({ timeout: 10_000 });
    await field.fill(title);
    await field.press("Enter");
    await within(5_000, () => row(page, title).isVisible());
  }
  await within(10_000, async () => (await storedAll(page)).length === 4);

  await row(page, B).click();
  await page.keyboard.press("Control+]");
  step(
    "Command-] puts the reminder under the one above, on the server",
    await seen(async () => (await parentOf(page, B)) === A),
  );

  await row(page, C).click();
  await editItem(page, "Indent");
  step(
    "Edit > Indent puts the next one under the same parent",
    await seen(async () => (await parentOf(page, C)) === A),
  );

  await row(page, D).dragTo(row(page, A));
  step(
    "A drag onto another reminder makes it a sub-reminder",
    await seen(async () => (await parentOf(page, D)) === A),
  );
  const triangle = windowOf(page).getByRole("button", { name: `Sub-reminders of ${A}` });
  await page.waitForTimeout(300);
  await shot(page, "reminders-subtasks");

  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Reminders").catch(() => {});
  step(
    "They are still under it after a reload",
    await seen(async () => {
      const parents = await Promise.all([B, C, D].map((title) => parentOf(page, title)));
      return parents.every((parent) => parent === A) && (await triangle.isVisible());
    }),
  );

  await triangle.click();
  step(
    "Its triangle hides what is under it",
    await seen(async () => (await row(page, B).count()) === 0),
  );
  await shot(page, "reminders-subtasks-collapsed");
  await page.waitForTimeout(1500);
  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Reminders").catch(() => {});
  step(
    "Collapsed stays so after a reload",
    await seen(async () => (await triangle.isVisible()) && (await row(page, B).count()) === 0),
  );
  await triangle.click();
  await within(5_000, () => row(page, D).isVisible());

  await row(page, D).click();
  await page.keyboard.press("Control+[");
  step("Command-[ makes it a reminder of its own again", await seen(() => isOwnReminder(page, D)));
  await row(page, C).click();
  await editItem(page, "Outdent");
  step("Edit > Outdent too", await seen(() => isOwnReminder(page, C)));

  await row(page, A).locator("[data-reminder-toggle]").click();
  step(
    "Completing a parent completes what is under it",
    await seen(async () => {
      const all = await storedAll(page);
      return [A, B].every((title) => all.find((each) => each.title === title)?.completed === true);
    }),
  );

  await row(page, A).click();
  await page.keyboard.press("Backspace");
  step(
    "Deleting a parent deletes what is under it, and nothing else",
    await seen(async () => {
      const titles = (await storedAll(page)).map((each) => each.title).sort();
      return JSON.stringify(titles) === JSON.stringify([C, D].sort());
    }),
  );

  for (const title of [E, F]) {
    await page.keyboard.press("Control+n");
    const field = windowOf(page).getByRole("textbox", { name: "Title" });
    await field.waitFor({ timeout: 10_000 });
    await field.fill(title);
    await field.press("Enter");
    await within(5_000, () => row(page, title).isVisible());
  }
  await within(10_000, async () => (await storedAll(page)).length === 4);
  await row(page, D).click();
  await page.keyboard.press("Control+]");
  await row(page, F).click();
  await page.keyboard.press("Control+]");
  await within(
    10_000,
    async () => (await parentOf(page, F)) === E && (await parentOf(page, D)) === C,
  );
  await row(page, C).dragTo(row(page, E));
  const outline = async () => {
    const all = await storedAll(page);
    const shown = await windowOf(page).getByRole("option").allInnerTexts();
    const place = (title) => shown.findIndex((text) => text.includes(title));
    return (
      JSON.stringify(all.map((each) => each.title)) === JSON.stringify([E, F, C, D]) &&
      (await parentOf(page, C)) === E &&
      (await parentOf(page, D)) === E &&
      place(E) < place(F) &&
      place(F) < place(C) &&
      place(C) < place(D)
    );
  };
  step(
    "A parent dropped into another goes last under it, with what was under it behind it",
    await seen(outline),
    JSON.stringify((await storedAll(page)).map((each) => each.title)),
  );
  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Reminders").catch(() => {});
  await windowOf(page).waitFor({ timeout: 15_000 });
  step("That order is there after a reload", await seen(outline));
});

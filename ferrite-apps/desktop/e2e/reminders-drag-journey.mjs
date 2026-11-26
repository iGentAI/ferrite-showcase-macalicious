#!/usr/bin/env node
// Dragging reminders onto another list, in a real browser against the running app: one row, then a
// selection of two; each is read back from the server and after a reload. Exits 0 only when every
// step passed and no page logged a console error, a page error, a failed request or an HTTP error.
//
//   node e2e/reminders-drag-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                       [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("reminders-drag");
const id = Date.now().toString(36);
const person = { name: `rdchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const TITLES = ["Mango", "Apple", "Pear"].map((word) => `${word} ${id}`);
const LIST = "New List";

const windowOf = (page) => page.locator('.mac-reminders[aria-label="Reminders"]').first();
const row = (page, title) => windowOf(page).getByRole("option").filter({ hasText: title }).first();
const listRow = (page, name) =>
  windowOf(page).locator("[data-reminders-list]").filter({ hasText: name }).first();
const stored = async (page) => {
  const reply = await page.request.get(new URL("/api/reminders/data", page.url()).href);
  return (await reply.json()).data;
};
const listOf = async (page, title) => {
  const data = await stored(page);
  const reminder = data?.reminders?.find((each) => each.title === title);
  return data?.lists?.find((each) => each.id === reminder?.listId)?.name;
};
const seen = (check) => within(10_000, check).then((took) => took !== null);

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", person);
  await openFromDock(page, "Reminders");
  await windowOf(page).waitFor({ timeout: 15_000 });
  await page.waitForTimeout(800);
  for (const title of TITLES) {
    await page.keyboard.press("Control+n");
    const field = windowOf(page).getByRole("textbox", { name: "Title" });
    await field.waitFor({ timeout: 10_000 });
    await field.fill(title);
    await field.press("Enter");
    await within(5_000, () => row(page, title).isVisible());
  }
  await within(10_000, async () => Boolean(await listOf(page, TITLES[2])));
  const home = await listOf(page, TITLES[0]);
  await windowOf(page).getByText("Add List").click();
  await within(8_000, () => listRow(page, LIST).isVisible());
  await page.waitForTimeout(300);
  await listRow(page, home).click();
  await within(8_000, () => row(page, TITLES[0]).isVisible());

  await row(page, TITLES[0]).dragTo(listRow(page, LIST));
  step(
    "Dragging a reminder onto a list moves it, on the server",
    await seen(async () => (await listOf(page, TITLES[0])) === LIST),
    await listOf(page, TITLES[0]),
  );

  await row(page, TITLES[1]).click();
  await row(page, TITLES[2]).click({ modifiers: ["Control"] });
  await row(page, TITLES[2]).dragTo(listRow(page, LIST));
  step(
    "Dragging one of two selected moves both",
    await seen(
      async () =>
        (await listOf(page, TITLES[1])) === LIST && (await listOf(page, TITLES[2])) === LIST,
    ),
  );

  await listRow(page, LIST).click();
  await within(8_000, () => row(page, TITLES[2]).isVisible());
  await page.waitForTimeout(300);
  await shot(page, "reminders-drag");
  const kept = async () => {
    const reply = await page.request.get(
      new URL("/api/system-preferences/settings", page.url()).href,
    );
    return (await reply.json()).values?.["reminders.view"]?.source;
  };
  const newId = (await stored(page)).lists.find((each) => each.name === LIST).id;
  step(
    "The list shown is kept, on the server",
    await seen(async () => (await kept()) === newId),
    `${await kept()} / ${newId}`,
  );
  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Reminders").catch(() => {});
  await page.waitForTimeout(3_000);
  await shot(page, "reminders-drag-reloaded");
  step(
    "They are in that list after a reload, and it is the list shown",
    (await within(
      20_000,
      async () =>
        (await row(page, TITLES[0]).isVisible()) && (await row(page, TITLES[2]).isVisible()),
    )) !== null,
  );
});

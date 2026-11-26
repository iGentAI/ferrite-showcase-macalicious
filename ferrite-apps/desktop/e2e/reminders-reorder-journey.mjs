#!/usr/bin/env node
// Dragging reminders within a list in Manual order, in a real browser against the running app: one is
// moved above another, read from the server and after a reload, and below the last row; with Sort By
// Title the drag changes nothing. Exits 0 only when every step passed and no page logged a console
// error, a page error, a failed request or an HTTP error.
//
//   node e2e/reminders-reorder-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                          [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("reminders-reorder");
const id = Date.now().toString(36);
const person = { name: `rrchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const [A, B, C] = ["Ant", "Bee", "Cat"].map((word) => `${word} ${id}`);

const windowOf = (page) => page.locator('.mac-reminders[aria-label="Reminders"]').first();
const row = (page, title) => windowOf(page).getByRole("option").filter({ hasText: title }).first();
const stored = async (page) => {
  const reply = await page.request.get(new URL("/api/reminders/data", page.url()).href);
  return (await reply.json()).data.reminders
    .map((each) => each.title)
    .filter((t) => t.endsWith(id));
};
const shown = async (page) =>
  (await windowOf(page).getByRole("option").allInnerTexts())
    .map((text) => text.trim().split("\n")[0])
    .filter((text) => text.endsWith(id));
const same = (one, other) => JSON.stringify(one) === JSON.stringify(other);
const seen = (check) => within(10_000, check).then((took) => took !== null);

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", person);
  await openFromDock(page, "Reminders");
  await windowOf(page).waitFor({ timeout: 15_000 });
  await page.waitForTimeout(800);
  for (const title of [A, B, C]) {
    await page.keyboard.press("Control+n");
    const field = windowOf(page).getByRole("textbox", { name: "Title" });
    await field.waitFor({ timeout: 10_000 });
    await field.fill(title);
    await field.press("Enter");
    await within(5_000, () => row(page, title).isVisible());
  }
  await within(10_000, async () => (await stored(page)).length === 3);

  await row(page, C).dragTo(row(page, A), { targetPosition: { x: 40, y: 2 } });
  step(
    "Dragged above another, it goes there, in the list and on the server",
    await seen(
      async () => same(await stored(page), [C, A, B]) && same(await shown(page), [C, A, B]),
    ),
    JSON.stringify(await stored(page)),
  );
  await page.waitForTimeout(300);
  await shot(page, "reminders-reorder");

  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Reminders").catch(() => {});
  step(
    "That order is there after a reload",
    await seen(async () => same(await shown(page), [C, A, B])),
    JSON.stringify(await shown(page)),
  );

  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "View", exact: true })
    .first()
    .click();
  await page.getByRole("menu").last().getByRole("menuitem", { name: "Sort By" }).click();
  await page.getByRole("menu").last().getByRole("menuitemradio", { name: "Title" }).click();
  await page.keyboard.press("Escape");
  await seen(async () => same(await shown(page), [A, B, C]));
  await row(page, C).dragTo(row(page, A));
  await page.waitForTimeout(600);
  step(
    "With Sort By Title the drag changes nothing",
    same(await stored(page), [C, A, B]) && same(await shown(page), [A, B, C]),
    JSON.stringify(await stored(page)),
  );
});

#!/usr/bin/env node
// Dragging on Calendar's empty week grid on Ferrite, in a real browser against the running app: the
// event made covers the times dragged, read from the server and after a reload, and Escape gives a
// drag up. Exits 0 only when every step passed and no page logged a console error, a page error, a
// failed request or an HTTP error.
//
//   node e2e/calendar-drag-create-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                             [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("calendar-drag-create");
const id = Date.now().toString(36);
const person = { name: `cdchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };

const windowOf = (page) => page.getByRole("region", { name: "Calendar" });
const blocks = (page) => windowOf(page).locator("[data-event-id]");
const mine = async (page) => {
  const reply = await page.request.get(new URL("/api/calendar/events", page.url()).href);
  return ((await reply.json()).events ?? []).filter((event) => event.title === "New Event");
};

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", person);
  await openFromDock(page, "Calendar");
  await within(15_000, () => windowOf(page).isVisible());
  await page.keyboard.press("Control+2");
  const column = windowOf(page).locator(".mac-calendar-week-grid-column").nth(3);
  await column.waitFor({ timeout: 10_000 });
  await within(10_000, async () => (await column.boundingBox()) !== null);
  const box = await column.boundingBox();
  const hours = await windowOf(page).evaluate(
    (root) =>
      root.querySelector(".mac-calendar-week-grid-column").getBoundingClientRect().height / 24,
  );
  const x = box.x + box.width / 2;
  const top = Math.max(box.y, 300);
  const from = top + hours - ((top - box.y) % hours);

  await page.mouse.move(x, from);
  await page.mouse.down();
  await page.mouse.move(x, from + hours, { steps: 5 });
  step("while dragging, the event being made is drawn", (await blocks(page).count()) >= 1);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  step(
    "Escape gives the drag up",
    (await mine(page)).length === 0 && (await blocks(page).count()) === 0,
  );

  await page.mouse.move(x, from);
  await page.mouse.down();
  await page.mouse.move(x, from + 2 * hours, { steps: 8 });
  await page.mouse.up();
  let made = null;
  await within(10_000, async () => {
    [made] = await mine(page);
    return made !== undefined;
  });
  step(
    "the event made on the server lasts the two hours dragged",
    made !== undefined && made !== null && made.end - made.start === 2 * 3_600_000,
    JSON.stringify(made),
  );
  await page.keyboard.press("Escape");
  await shot(page, "calendar-drag-create");

  await page.reload();
  await openFromDock(page, "Calendar").catch(() => {});
  await within(15_000, () => windowOf(page).isVisible());
  step(
    "it is there after a reload",
    (await within(10_000, async () => (await blocks(page).count()) === 1)) !== null,
  );
});

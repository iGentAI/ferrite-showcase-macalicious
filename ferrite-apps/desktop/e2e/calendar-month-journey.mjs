#!/usr/bin/env node
// Calendar's month grid on Ferrite in a real browser against the running app: a new event appears in
// its day, a drag moves it to another day, and the move survives a reload. Exits 0 only when every
// step passed and no page logged a console error, a page error, a failed request or an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/calendar-month-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                       [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("calendar-month");
const id = Date.now().toString(36);
const person = { name: `cmchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };

const window = (page) => page.getByRole("region", { name: "Calendar" });

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", person);
  await openFromDock(page, "Calendar");
  await within(15_000, () => window(page).isVisible());

  await page.keyboard.press("Control+3");
  const rows = window(page).locator(".mac-calendar-month-cell");
  await within(4_000, async () => (await rows.count()) >= 28);
  step("the month is a grid of whole weeks", (await rows.count()) % 7 === 0, await rows.count());
  const cell = (day) => window(page).locator(`[data-day="${day}"]`);

  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "File", exact: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "New Event" }).first().click();
  const made = window(page).locator("[data-event-id]").first();
  step(
    "File > New Event appears in a day of the grid",
    (await within(6_000, () => made.isVisible())) !== null,
  );
  await page.keyboard.press("Escape");
  await shot(page, "calendar-month-grid");

  // The day beside it, in the same week. (After 11 PM a new event starts on the next day.)
  const today = await made.evaluate((node) => node.closest("[data-day]").dataset.day);
  const at = await rows.evaluateAll(
    (cells, day) => cells.findIndex((each) => each.dataset.day === day),
    today,
  );
  const target = await rows.nth(at % 7 === 6 ? at - 1 : at + 1).getAttribute("data-day");
  const from = await made.boundingBox();
  const to = await cell(target).boundingBox();
  await page.mouse.move(from.x + 6, from.y + 6);
  await page.mouse.down();
  await page.mouse.move(from.x + 12, from.y + 6);
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 6 });
  await page.mouse.up();
  const moved = cell(target).locator("[data-event-id]");
  step(
    "a drag moves the event to the other day",
    (await within(4_000, () => moved.isVisible())) !== null,
  );
  step(
    "the first day no longer has it",
    (await cell(today).locator("[data-event-id]").count()) === 0,
  );

  await page.waitForTimeout(1_500);
  await page.reload();
  await window(page)
    .waitFor({ timeout: 8_000 })
    .catch(() => openFromDock(page, "Calendar"));
  await page.keyboard.press("Control+3");
  const kept = await within(8_000, () => cell(target).locator("[data-event-id]").isVisible());
  step("the move is still there after a reload", kept !== null);

  await cell(target).locator(".mac-calendar-month-number").dblclick();
  const day = await within(4_000, async () => {
    const pressed = await window(page)
      .getByRole("group", { name: "View" })
      .getByRole("button", { name: "Day", exact: true })
      .getAttribute("aria-pressed");
    return pressed === "true";
  });
  step("a double click on a day's number opens that day", day !== null);

  // Three events on a day, and the month squeezed until only one row fits under a day's number.
  await page.keyboard.press("Control+3");
  for (let made = 1; made < 3; made++) {
    await page
      .getByRole("menubar")
      .getByRole("menuitem", { name: "File", exact: true })
      .first()
      .click();
    await page.getByRole("menuitem", { name: "New Event" }).first().click();
    await within(4_000, async () => (await window(page).getByRole("dialog").count()) > 0);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
  await window(page)
    .locator(".mac-calendar-month")
    .evaluate((root) => {
      const weeks = root.querySelector(".mac-calendar-month-rows").childElementCount / 7;
      root.style.flex = "none";
      root.style.height = `${51 + 22 + weeks * 40}px`;
    });
  const more = cell(target).getByRole("button", { name: /more…$/ });
  const shown = await within(4_000, () => more.isVisible());
  const box = await more.boundingBox();
  const inside = await cell(target).boundingBox();
  step(
    "with one row left a crowded day still shows more, inside the day",
    shown !== null && box.y + box.height <= inside.y + inside.height,
    await more.innerText(),
  );
  await shot(page, "calendar-month-more");
  await more.click();
  const opened = await within(4_000, async () => {
    const pressed = await window(page)
      .getByRole("group", { name: "View" })
      .getByRole("button", { name: "Day", exact: true })
      .getAttribute("aria-pressed");
    return pressed === "true";
  });
  step("more opens that day", opened !== null);
});

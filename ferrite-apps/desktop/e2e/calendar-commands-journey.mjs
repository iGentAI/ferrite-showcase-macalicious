#!/usr/bin/env node
// Calendar's View and Edit menus on Ferrite, with their keys, in a real browser against the running
// app. Exits 0 only when every step passed and no page logged a console error, a page error, a
// failed request or an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/calendar-commands-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                          [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("calendar-commands");
const id = Date.now().toString(36);
const person = { name: `ccchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };

const window = (page) => page.getByRole("region", { name: "Calendar" });
const heading = (page) => page.locator(".mac-calendar-heading-title").first();
const viewIs = (page, name) =>
  within(4_000, async () => {
    const pressed = await window(page)
      .getByRole("group", { name: "View" })
      .getByRole("button", { name, exact: true })
      .getAttribute("aria-pressed");
    return pressed === "true" || null;
  });

async function menu(page, title, name) {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: title, exact: true })
    .first()
    .click();
  await page
    .getByRole("menuitem", { name })
    .or(page.getByRole("menuitemradio", { name }))
    .first()
    .click();
}

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", person);
  await openFromDock(page, "Calendar");
  await within(15_000, () => window(page).isVisible());

  await page.keyboard.press("ControlOrMeta+3");
  step("Command-3 shows the month", (await viewIs(page, "Month")) !== null);
  await within(4_000, async () => /[a-z] \d{4}$/.test(await heading(page).innerText()));
  const month = await heading(page).innerText();
  await page.keyboard.press("ControlOrMeta+ArrowRight");
  const next = await within(4_000, async () => (await heading(page).innerText()) !== month);
  step("Command-Right goes to the next month", next !== null, await heading(page).innerText());
  await page.keyboard.press("ControlOrMeta+ArrowLeft");
  const previous = await within(4_000, async () => (await heading(page).innerText()) === month);
  step("Command-Left comes back a month", previous !== null);
  await page.keyboard.press("ControlOrMeta+ArrowRight");
  await within(4_000, async () => (await heading(page).innerText()) !== month);
  await menu(page, "View", "Go to Today");
  const today = await within(4_000, async () => (await heading(page).innerText()) === month);
  step("View > Go to Today comes back", today !== null);

  await menu(page, "View", "By Year");
  const year = await within(4_000, async () => /^\d{4}$/.test(await heading(page).innerText()));
  step("View > By Year shows the year", year !== null, await heading(page).innerText());

  await page.keyboard.press("ControlOrMeta+Shift+T");
  const sheet = page.getByRole("dialog", { name: "Go to Date" });
  const opened = await within(4_000, () => sheet.isVisible());
  step("Shift-Command-T asks for a date", opened !== null);
  await shot(page, "calendar-go-to-date");
  const thisYear = await heading(page).innerText();
  await sheet.getByRole("spinbutton", { name: "year" }).focus();
  await page.keyboard.press("ArrowUp");
  await sheet.getByRole("button", { name: "Show" }).click();
  await within(4_000, async () => !(await sheet.isVisible()));
  const shown = String(Number(thisYear) + 1);
  step(
    "Go to Date shows the date chosen in the sheet",
    (await within(4_000, async () => (await heading(page).innerText()) === shown)) !== null,
    await heading(page).innerText(),
  );

  await page.keyboard.press("ControlOrMeta+1");
  step("Command-1 shows the day", (await viewIs(page, "Day")) !== null);
  await menu(page, "View", "Go to Today");
  await page.keyboard.press("ControlOrMeta+2");
  step("Command-2 shows the week", (await viewIs(page, "Week")) !== null);
  await menu(page, "File", "New Event");
  const block = window(page).locator("[data-event-id]").first();
  const made = await within(6_000, () => block.isVisible());
  await shot(page, "calendar-new-event");
  step("File > New Event adds one to the week", made !== null);
  await page.keyboard.press("Escape");
  await menu(page, "View", "Hide Calendar List");
  const hidden = await within(
    3_000,
    async () => !(await page.getByRole("tree", { name: "Calendars" }).isVisible()),
  );
  step("View > Hide Calendar List hides it", hidden !== null);
  await menu(page, "View", "Show Calendar List");

  await block.click();
  await page.keyboard.press("ControlOrMeta+E");
  const popover = await within(4_000, () => page.getByRole("dialog").first().isVisible());
  step("Command-E opens the selected event", popover !== null);
  await page.keyboard.press("Escape");

  await page.keyboard.press("ControlOrMeta+F");
  const search = await within(3_000, () =>
    window(page)
      .getByRole("searchbox")
      .evaluate((node) => node === document.activeElement),
  );
  step("Command-F goes to the search field", search !== null);
  await block.click();
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "Edit", exact: true })
    .first()
    .click();
  await shot(page, "calendar-edit-menu");
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const gone = await within(
    4_000,
    async () => (await window(page).locator("[data-event-id]").count()) === 0,
  );
  step("Edit > Delete removes the selected event", gone !== null);
});

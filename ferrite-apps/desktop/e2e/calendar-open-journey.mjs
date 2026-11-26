#!/usr/bin/env node
// `.ics` files reach Calendar from Finder on Ferrite, in a real browser against the running app: one
// opened by a double click and one dragged onto the window, each asking where it goes and read back
// from the server. Exits 0 only when every step passed and no page logged a console error, a page
// error, a failed request or an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/calendar-open-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                      [--browser chromium|chrome|firefox|webkit]

import { twoPeople, within } from "./people-kit.mjs";
import { uploadFile } from "./system-kit.mjs";

const { step, run, shot } = twoPeople("calendar-open");
const id = Date.now().toString(36);
const person = {
  name: `coChris-${id}`.toLowerCase(),
  fullName: `Chris ${id}`,
  password: `tide-${id}-pool`,
};
const OPENED = `Opened ${id}`;
const DRAGGED = `Dragged ${id}`;
const ics = (uid, title) =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//macalicious//journey//EN",
    "BEGIN:VEVENT",
    `UID:${uid}@journey`,
    "DTSTAMP:20261101T090000Z",
    "DTSTART:20261115T090000Z",
    "DTEND:20261115T100000Z",
    `SUMMARY:${title}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");

const calendar = (page) => page.getByRole("region", { name: "Calendar" });
const finderOf = (page) => page.locator(".mac-window.mac-finder").first();
const fileOf = (page, name) => finderOf(page).getByRole("option", { name, exact: true }).first();
const titles = async (page) => {
  const reply = await page.request.get(new URL("/api/calendar/events", page.url()).href);
  return JSON.stringify(await reply.json());
};
const dock = (page, name) =>
  page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name }).click();
const importSheet = async (page) => {
  const button = page.getByRole("button", { name: "Import", exact: true });
  await button.waitFor({ timeout: 10_000 });
  await button.click();
  // What the import did is reported, and the report is dismissed.
  await page.getByRole("button", { name: "OK", exact: true }).click({ timeout: 10_000 });
};

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", person);
  await uploadFile(page, {
    parent: "documents",
    name: `open-${id}.ics`,
    type: "application/octet-stream",
    text: ics(`o${id}`, OPENED),
  });
  await uploadFile(page, {
    parent: "documents",
    name: `drag-${id}.ics`,
    type: "application/octet-stream",
    text: ics(`d${id}`, DRAGGED),
  });
  await page.reload({ waitUntil: "load" });
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });

  await dock(page, "Finder");
  await finderOf(page).waitFor({ timeout: 10_000 });
  await finderOf(page).getByRole("treeitem", { name: "Documents", exact: true }).first().click();
  await fileOf(page, `open-${id}.ics`).waitFor({ timeout: 10_000 });
  await fileOf(page, `open-${id}.ics`).dblclick();
  await calendar(page).waitFor({ timeout: 15_000 });
  await shot(page, "calendar-open-ics");
  await importSheet(page);
  step(
    "a double click in Finder opens Calendar, and the file is imported on the server",
    (await within(10_000, async () => (await titles(page)).includes(OPENED))) !== null,
  );

  // Dragged from Finder, moved below the calendar's toolbar first.
  await dock(page, "Finder");
  const bar = await finderOf(page).boundingBox();
  await page.mouse.move(bar.x + bar.width / 2, bar.y + 12);
  await page.mouse.down();
  await page.mouse.move(bar.x + bar.width / 2, Math.max(bar.y, 420), { steps: 10 });
  await page.mouse.up();
  const file = await fileOf(page, `drag-${id}.ics`).boundingBox();
  const target = await page.locator(".mac-calendar-body, .mac-calendar").first().boundingBox();
  await page.mouse.move(file.x + file.width / 2, file.y + file.height / 2);
  await page.mouse.down();
  await page.mouse.move(file.x + file.width / 2 + 10, file.y + file.height / 2 + 10, { steps: 4 });
  await page.mouse.move(target.x + target.width / 2, target.y + 140, { steps: 12 });
  await page.mouse.up();
  await importSheet(page);
  step(
    "one dragged onto the window is imported on the server",
    (await within(10_000, async () => (await titles(page)).includes(DRAGGED))) !== null,
  );
});

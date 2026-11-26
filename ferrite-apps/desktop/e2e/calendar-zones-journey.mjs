#!/usr/bin/env node
// Time zones and attachments of a Calendar event, in a real browser against the running app: Preferences >
// Advanced turns time zone support on; a zone chosen in the popover moves the event and is kept; a file
// attached shows, downloads with its own bytes and stays after a reload; Remove takes it off; another
// person's request for it is refused. Exits 0 only when every step passed and no page logged a console
// error, a page error, a failed request or an HTTP error.
//
//   node e2e/calendar-zones-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                       [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, allow, run, shot } = twoPeople("calendar-zones");
const id = Date.now().toString(36);
const chris = { name: `czchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const martin = { name: `czmartin-${id}`, fullName: `Martin ${id}`, password: `tide-${id}-pool` };
const TITLE = `Zoned ${id}`;

const windowOf = (page) => page.getByRole("region", { name: "Calendar" }).first();
const seen = (check) => within(10_000, check).then((took) => took !== null);
const stored = async (page) => {
  const reply = await page.request.get(new URL("/api/calendar/events", page.url()).href);
  return ((await reply.json()).events ?? []).find((event) => event.title === TITLE);
};
const open = async (page) => {
  await openFromDock(page, "Calendar").catch(() => {});
  await within(15_000, () => windowOf(page).isVisible());
  await page.waitForTimeout(800);
};
const event = (page) => windowOf(page).getByText(TITLE).first();

allow(/attachments\//);
allow(/404/);

await run({}, {}, async ({ person }) => {
  const page = await person("chris", chris);
  const other = await person("martin", martin);
  await open(page);

  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "Calendar", exact: true })
    .first()
    .click();
  await page
    .getByRole("menu")
    .last()
    .getByRole("menuitem", { name: /^Preferences/ })
    .click();
  await page.getByRole("tab", { name: "Advanced" }).click();
  const prefs = page.getByRole("region", { name: "Advanced" }).last();
  await page.getByRole("checkbox", { name: "Turn on time zone support" }).click();
  await page.waitForTimeout(800);
  step(
    "Preferences > Advanced turns time zone support on, and it is saved",
    await seen(async () => {
      const reply = await page.request.get(new URL("/api/calendar/settings", page.url()).href);
      return JSON.stringify(await reply.json()).includes('"timeZoneSupport":true');
    }),
  );
  await prefs
    .getByRole("button", { name: "Close" })
    .first()
    .click()
    .catch(() => {});
  await windowOf(page).click({ position: { x: 700, y: 12 } });

  await page.keyboard.press("Control+n");
  await page.getByRole("textbox", { name: "Title" }).fill(TITLE);
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: /^Date:/ }).click();
  const zone = page
    .getByRole("combobox", { name: "Time zone", exact: true })
    .or(page.getByRole("button", { name: "Time zone", exact: true }))
    .first();
  await zone.waitFor({ timeout: 5_000 });
  await within(15_000, () => stored(page));
  const startBefore = (await stored(page))?.start;
  await zone.click();
  await page
    .getByRole("option", { name: "Tokyo" })
    .or(page.getByRole("menuitemradio", { name: "Tokyo" }))
    .first()
    .click();
  step(
    "a zone chosen is kept with the event, and the same clock reading there moves it in time",
    await seen(async () => {
      const now = await stored(page);
      return now?.timeZone === "Asia/Tokyo" && now.start !== startBefore;
    }),
  );
  await page.getByRole("button", { name: "Done" }).first().click();
  step(
    "the popover shows the zone's own reading",
    await seen(async () =>
      /Tokyo/.test(await page.locator('[data-row="time-zone"]').first().innerText()),
    ),
  );

  await page.getByRole("button", { name: /Add Notes, URL, or Attachments/ }).click();
  const body = Buffer.from(`The minutes ${id}\n`.repeat(20000));
  await page.getByLabel("Attachment file").setInputFiles({
    name: `minutes-${id}.txt`,
    mimeType: "text/plain",
    buffer: body,
  });
  const fileName = `minutes-${id}.txt`;
  step(
    "a file attached shows on the event, and the event names it on the server",
    await seen(async () => {
      const now = await stored(page);
      return (
        (await page.getByRole("button", { name: fileName }).first().isVisible()) &&
        now?.attachments?.[0]?.name === fileName &&
        now.attachments[0].size === body.length
      );
    }),
  );
  await shot(page, "calendar-attachment");
  await page.getByRole("button", { name: "Done" }).first().click();

  const file = (await stored(page)).attachments[0];
  const refused = await other.request.get(
    new URL(`/api/calendar/attachments/${file.id}`, other.url()).href,
  );
  step("another person cannot read it", refused.status() === 404, String(refused.status()));

  await page.waitForTimeout(800);
  await page.reload({ waitUntil: "load" });
  await open(page);
  await event(page).dblclick();
  step(
    "after a reload the event has its zone and its file",
    await seen(
      async () =>
        (await page.getByRole("button", { name: fileName }).first().isVisible()) &&
        /Tokyo/.test(await page.locator('[data-row="time-zone"]').first().innerText()),
    ),
  );
  await shot(page, "calendar-zone");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: fileName }).first().click(),
  ]);
  const saved = await download.createReadStream();
  const pieces = [];
  for await (const piece of saved) pieces.push(piece);
  step("its name downloads its own bytes", Buffer.concat(pieces).equals(body));

  await page.locator('[role="button"][data-row="notes"]').click();
  await page.getByRole("button", { name: `Remove ${fileName}` }).click();
  step(
    "Remove takes it off the event",
    await seen(async () => !(await stored(page))?.attachments?.length),
  );
});

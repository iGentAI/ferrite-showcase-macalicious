#!/usr/bin/env node
// Calendar's subscriptions, in a real browser against the running app, local or hosted. The feed is an
// iCalendar file this journey answers for an https address of its own, from inside the browser (Playwright's
// route), with the header a site needs to let other pages read it. An https page can't read a server on this
// machine, and no public feed changes on demand; the page's own fetch and the browser's cross-origin check
// run as they would for a real site, but no network is crossed. File > New Calendar
// Subscription lists the calendar with its events, read-only; the list comes back after a reload; Refresh
// Calendars reads the feed again; Unsubscribe takes it away. Exits 0 only when every step passed and no page
// logged a console error, a page error, a failed request or an HTTP error.
//
//   node e2e/calendar-subscription-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, allow, run, shot } = twoPeople("calendar-subscription");
const id = Date.now().toString(36);
const chris = { name: `csfchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const FIRST = `Club meeting ${id}`;
const SECOND = `Club picnic ${id}`;

const dayAt = (offset, hour) => {
  const day = new Date(Date.now() + offset * 86_400_000);
  const pad = (value) => `${value}`.padStart(2, "0");
  return `${day.getFullYear()}${pad(day.getMonth() + 1)}${pad(day.getDate())}T${pad(hour)}0000`;
};
const event = (uid, title) =>
  [
    "BEGIN:VEVENT",
    `UID:${uid}@example.com`,
    `DTSTART:${dayAt(0, 10)}`,
    `DTEND:${dayAt(0, 11)}`,
    `SUMMARY:${title}`,
    "END:VEVENT",
  ].join("\r\n");
let events = [event("one", FIRST)];
let refusing = false;
const feedUrl = "https://feed.example.com/club.ics";
const answerFeed = (route) =>
  refusing
    ? route.fulfill({ status: 404, headers: { "access-control-allow-origin": "*" } })
    : route.fulfill({
        status: 200,
        headers: { "content-type": "text/calendar", "access-control-allow-origin": "*" },
        body: [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          `X-WR-CALNAME:Club ${id}`,
          ...events,
          "END:VCALENDAR",
        ].join("\r\n"),
      });

const windowOf = (page) => page.getByRole("region", { name: "Calendar" }).first();
const seen = (check) => within(15_000, check).then((took) => took !== null);
const menu = async (page, title, item) => {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: title, exact: true })
    .first()
    .click();
  await page.getByRole("menu").last().getByRole("menuitem", { name: item }).click();
};
const calendarRow = (page) =>
  windowOf(page)
    .getByRole("treeitem", { name: `Club ${id}` })
    .or(windowOf(page).getByText(`Club ${id}`).first());

// The refusal this journey asks for below.
allow(/club\.ics/);
allow(/404/);
await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", chris);
  await page.context().route(feedUrl, answerFeed);
  await openFromDock(page, "Calendar");
  await within(15_000, () => windowOf(page).isVisible());
  await page.waitForTimeout(1_000);

  await menu(page, "File", /^New Calendar Subscription/);
  await page.getByRole("textbox", { name: "Calendar URL" }).waitFor({ timeout: 5_000 });
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+Alt+s");
  step(
    "its key asks for the address too",
    (await seen(() => page.getByRole("textbox", { name: "Calendar URL" }).isVisible())) === true,
  );
  await page.getByRole("textbox", { name: "Calendar URL" }).fill(feedUrl);
  await page.getByRole("button", { name: "Subscribe" }).click();
  step(
    "the calendar is listed with its name, and its event shows",
    await seen(
      async () =>
        (await windowOf(page).getByText(`Club ${id}`).first().isVisible()) &&
        (await windowOf(page).getByText(FIRST).first().isVisible()),
    ),
  );
  await page.waitForTimeout(300);
  await shot(page, "calendar-subscription");

  await windowOf(page).getByText(FIRST).first().click();
  await page.keyboard.press("Delete");
  await page.waitForTimeout(500);
  step(
    "its event is read-only: Delete leaves it, and nothing of it is saved",
    (await windowOf(page).getByText(FIRST).first().isVisible()) &&
      !JSON.stringify(
        await (await page.request.get(new URL("/api/calendar/events", page.url()).href)).json(),
      ).includes(FIRST),
  );

  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Calendar").catch(() => {});
  step(
    "after a reload the subscription and its event are back",
    await seen(() => windowOf(page).getByText(FIRST).first().isVisible()),
  );

  events = [event("one", FIRST), event("two", SECOND)];
  await menu(page, "View", "Refresh Calendars");
  step(
    "Refresh Calendars reads the feed again",
    await seen(() => windowOf(page).getByText(SECOND).first().isVisible()),
  );

  events = [];
  await menu(page, "View", "Refresh Calendars");
  step(
    "a feed with nothing left in it empties the calendar, and no alert",
    await seen(
      async () =>
        (await windowOf(page).getByText(SECOND).count()) === 0 &&
        (await page.getByRole("alertdialog").count()) === 0,
    ),
  );
  events = [event("one", FIRST)];

  refusing = true;
  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Calendar").catch(() => {});
  const alert = page.getByRole("alertdialog");
  step(
    "a feed that no longer answers is said when the window opens, naming it",
    await seen(async () => (await alert.innerText()).includes(`Club ${id}`)),
  );
  await shot(page, "calendar-subscription-refused");
  await alert.getByRole("button", { name: "OK" }).click();
  refusing = false;

  await calendarRow(page).first().click({ button: "right" });
  await page
    .getByRole("menu", { name: "Calendar commands" })
    .getByRole("menuitem", { name: "Unsubscribe" })
    .click();
  step(
    "Unsubscribe takes the calendar and its events away",
    await seen(
      async () =>
        (await windowOf(page).getByText(`Club ${id}`).count()) === 0 &&
        (await windowOf(page).getByText(FIRST).count()) === 0,
    ),
  );
});

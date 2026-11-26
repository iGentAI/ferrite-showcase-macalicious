#!/usr/bin/env node
// Calendar's File > Print and View > Refresh Calendars on Ferrite, in a real browser against the
// running app: the page handed to the browser holds the events of the days shown, and a change made
// in another browser appears on Refresh. A headless browser shows no print dialog, so the page it
// was given is what is checked. Exits 0 only when every step passed and no page logged a console
// error, a page error, a failed request or an HTTP error.
//
//   node e2e/calendar-print-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                       [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("calendar-print");
const id = Date.now().toString(36);
const person = { name: `cpchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const TITLE = "New Event";
const LATER = `Refreshed ${id}`;

const calendar = (page) => page.getByRole("region", { name: "Calendar" });
async function menu(page, title, name) {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: title, exact: true })
    .first()
    .click();
  await page.getByRole("menu").last().getByRole("menuitem", { name }).click();
}
const eventsUrl = (page) => new URL("/api/calendar/events", page.url()).href;
const stored = async (page) => (await page.request.get(eventsUrl(page))).json();

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", person);
  await openFromDock(page, "Calendar");
  await calendar(page).waitFor({ timeout: 15_000 });
  await page.keyboard.press("Control+2");

  await menu(page, "File", /^New Event/);
  await calendar(page).locator("[data-event-id]").first().waitFor({ timeout: 10_000 });
  await page.keyboard.press("Escape");
  await within(10_000, async () => JSON.stringify(await stored(page)).includes(TITLE));

  await page.evaluate(() => {
    new MutationObserver((changes) => {
      for (const { addedNodes } of changes) {
        for (const node of addedNodes) {
          if (node.matches?.("iframe[data-textedit-print]")) window.printedPage = node.srcdoc;
        }
      }
    }).observe(document.body, { childList: true });
  });
  await menu(page, "File", /^Print/);
  await page
    .getByRole("dialog", { name: "Print" })
    .getByRole("button", { name: "Continue" })
    .click();
  let html = "";
  await within(10_000, async () => {
    html = (await page.evaluate(() => window.printedPage)) ?? "";
    return html !== "";
  });
  step(
    "File > Print gives the browser a page with the event of the week shown",
    html.includes(TITLE),
  );
  const sheet = await page.context().newPage();
  await sheet.setContent(html);
  await sheet.setViewportSize({ width: 816, height: 400 });
  await shot(sheet, "calendar-print-page");
  await sheet.close();

  // Another browser of the person adds an event; this window does not know until Refresh.
  const document = await stored(page);
  const mine = document.events.find((each) => each.title === TITLE);
  const reply = await page.request.put(eventsUrl(page), {
    data: {
      ...document,
      events: [...document.events, { ...mine, id: `later-${id}`, title: LATER }],
    },
  });
  step("the other browser's change is stored", reply.ok());
  await menu(page, "View", /^Refresh Calendars/);
  step(
    "View > Refresh Calendars shows it",
    (await within(10_000, async () => (await calendar(page).getByText(LATER).count()) > 0)) !==
      null,
  );
  await shot(page, "calendar-refreshed");
});

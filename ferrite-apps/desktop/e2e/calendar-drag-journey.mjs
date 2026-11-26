#!/usr/bin/env node
// Dragging events in Calendar's week grid on Ferrite, with real pointer events.
//
// Chris signs up in a browser in New York whose clock reads Wednesday 4 November 2026, 9:00. His
// calendar holds a review on Thursday from 2 PM to 3 PM and a standup every Monday at 11:00. In the
// week view he drags the review a day and an hour on (Friday, 3 PM to 4 PM), then its bottom edge
// half an hour down (it ends at 4:30 PM); each change is saved. He drags Monday's standup to
// Tuesday: Calendar asks whether to change only this occurrence or all of them, and "Only This
// Event" makes it an event of its own on Tuesday while the series keeps its other Mondays. In the
// next week he drags the standup an hour earlier and chooses "All Events": every Monday's is at
// 10:00 from then on. After a reload the grid and the server hold every change; Anna, signed up in
// a browser of her own, has none of them.
//
// Exits 0 only when every step passed and no page logged a console error, a page error, a
// failed request or an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/calendar-drag-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                      [--browser chromium|chrome|firefox|webkit] [--keep <prefix>]
//
// `--keep <prefix>` writes `<prefix>-<browser>.json`: Chris's cookies and what the server must
// still hold after a `ferrite dev` restart (campaign/ws5/calendar-drag-restart-check.mjs).
// The browser's clock is Playwright's (`context.clock`); the server's is not touched.

import { writeFileSync } from "node:fs";
import path from "node:path";
import { options, shot } from "./app-journey.mjs";
import { ENGINES } from "./journey-kit.mjs";

const { base, out, browserName } = options();
const argv = process.argv.slice(2);
const keepAt = argv.indexOf("--keep");
const keep = keepAt >= 0 ? argv[keepAt + 1] : null;
const run = Date.now().toString(36);
const password = `tide-${run}-pool`;
const chris = { name: `chris-dg-${run}`, fullName: "Chris Drag" };
const anna = { name: `anna-dg-${run}`, fullName: "Anna Drag" };
const EVENTS = "/api/calendar/events";
const ZONE = "America/New_York";
/** 9:00 in New York (EST) on Wednesday 4 November 2026. */
const START = new Date("2026-11-04T14:00:00Z");
const review = `Review ${run}`;
const standup = `Standup ${run}`;
const STANDUP_ID = `standup-${run}`;
const at = (iso) => Date.parse(iso);

const problems = [];
const steps = [];
const step = (label, ok, detail = "") => {
  steps.push(label);
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`);
  if (!ok) problems.push(label);
  return ok;
};
const pathOf = (url) => {
  try {
    return new globalThis.URL(url).pathname;
  } catch {
    return "";
  }
};

/** Requests of the desktop's API still in flight, per page. */
const inFlight = new Map();
function watch(page, label) {
  inFlight.set(page, 0);
  const counted = (request) => pathOf(request.url()).startsWith("/api/");
  page.on("request", (request) => {
    if (counted(request)) inFlight.set(page, inFlight.get(page) + 1);
  });
  const done = (request) => {
    if (counted(request)) inFlight.set(page, Math.max(0, inFlight.get(page) - 1));
  };
  page.on("requestfinished", done);
  page.on("requestfailed", (request) => {
    done(request);
    const text = request.failure()?.errorText ?? "";
    // `ferrite dev`'s live-reload stream and the page's own requests cut short by a reload.
    if (/ERR_ABORTED|NS_BINDING_ABORTED|NS_ERROR_ABORT|cancelled/i.test(text)) return;
    problems.push(`${label} request failed: ${request.url()} ${text}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`${label} console: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`${label} page error: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() >= 400)
      problems.push(`${label} HTTP ${response.status()} ${pathOf(response.url())}`);
  });
}

/** Until no request of the API has been in flight for half a second. */
async function settled(page) {
  let quiet = 0;
  for (let tries = 0; tries < 100 && quiet < 5; tries += 1) {
    quiet = inFlight.get(page) === 0 ? quiet + 1 : 0;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** `fetch` from inside the page, with the browser's own cookie. */
function api(page, method, url, body) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const response = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: body ? { "content-type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: response.status, json: await response.json().catch(() => null) };
    },
    { method, url, body },
  );
}

const finder = (page) => page.getByRole("button", { name: /^Finder$/ }).first();

/** A fresh browser in New York, its clock at `START`, signed up as `person`, on its desktop. */
async function enter(browser, person, label) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    timezoneId: ZONE,
  });
  await context.clock.install({ time: START });
  const page = await context.newPage();
  watch(page, label);
  await page.goto(`${base}/`, { waitUntil: "load" });
  await page.getByRole("group", { name: "Users" }).waitFor({ timeout: 20_000 });
  const made = await api(page, "POST", "/api/session/sign-up", {
    name: person.name,
    full_name: person.fullName,
    password,
  });
  step(`${person.fullName} creates an account`, made.status === 201, `HTTP ${made.status}`);
  await page.reload({ waitUntil: "load" });
  await finder(page).waitFor({ timeout: 20_000 });
  return page;
}

async function openCalendar(page) {
  await page
    .getByRole("button", { name: /^Calendar$/ })
    .or(page.getByRole("link", { name: /^Calendar$/ }))
    .first()
    .click();
  const window = page.getByRole("region", { name: "Calendar" }).first();
  await window.getByRole("button", { name: "New Event" }).waitFor({ timeout: 15_000 });
  await page.waitForFunction(() => !document.querySelector(".mac-calendar-body[inert]"), null, {
    timeout: 15_000,
  });
  return window;
}

/** 9 AM at the top of the hours, so that the day's working hours are in view. */
const scrollToMorning = (page) =>
  page.evaluate(() => {
    const grid = document.querySelector(".mac-calendar-body .mac-calendar-week-grid");
    const hours = grid?.querySelector(".mac-calendar-week-grid-scroll [role='group']");
    const day = grid ? Number.parseFloat(getComputedStyle(grid).getPropertyValue("--_height")) : 0;
    if (hours) hours.scrollTop = (day / 24) * 9;
  });

/** One hour of the grid and one day's column, in pixels. */
const sizes = (page) =>
  page.evaluate(() => {
    const grid = document.querySelector(".mac-calendar-body .mac-calendar-week-grid");
    const column = grid?.querySelector(".mac-calendar-week-grid-column");
    const day = grid ? Number.parseFloat(getComputedStyle(grid).getPropertyValue("--_height")) : 0;
    return { hour: day / 24, column: column?.getBoundingClientRect().width ?? 0 };
  });

const block = (window, title) =>
  window.getByRole("button", { name: new RegExp(`^${title}, `) }).first();
const label = (window, title) => block(window, title).getAttribute("aria-label");

/** A real pointer drag of the event's block, pressed at its middle or near an edge. */
async function drag(page, window, title, where, dx, dy) {
  const box = await block(window, title).boundingBox();
  if (!box) throw new Error(`${title} is not shown`);
  const x = box.x + box.width / 2;
  const y =
    where === "top"
      ? box.y + 2
      : where === "bottom"
        ? box.y + box.height - 2
        : box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 6 });
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  await page.mouse.up();
}

/** The next PUT of the calendar whose body passes `accept`. */
const nextSave = (page, accept) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      pathOf(response.url()) === EVENTS &&
      accept(JSON.parse(response.request().postData() ?? "{}")),
    { timeout: 15_000 },
  );
const named = (list, title) => (list ?? []).filter((event) => event.title === title);
const byId = (list, id) => (list ?? []).find((event) => event.id === id);
const events = async (page) => (await api(page, "GET", EVENTS)).json?.events ?? [];

const browser = await ENGINES[browserName].launch();
console.log(`calendar drag in ${browserName}`);
const pages = [];
try {
  const page = await enter(browser, chris, "chris");
  pages.push(page);

  // A review on Thursday 2 PM to 3 PM and a standup every Monday at 11:00, saved as the window
  // would save them.
  const read = await api(page, "GET", EVENTS);
  const put = await api(page, "PUT", EVENTS, {
    rev: read.json?.rev,
    events: [
      {
        id: `review-${run}`,
        title: review,
        start: at("2026-11-05T19:00:00Z"),
        end: at("2026-11-05T20:00:00Z"),
        calendar: "work",
      },
      {
        id: STANDUP_ID,
        title: standup,
        start: at("2026-11-02T16:00:00Z"),
        end: at("2026-11-02T16:30:00Z"),
        calendar: "work",
        repeat: { freq: "weekly" },
        timeZone: ZONE,
      },
    ],
  });
  step("Chris's calendar holds a Thursday review and a Monday standup", put.status === 200);

  const window = await openCalendar(page);
  await scrollToMorning(page);
  await block(window, review).waitFor({ timeout: 10_000 });
  await settled(page);
  const { hour, column } = await sizes(page);
  if (!(hour > 0 && column > 0))
    throw new Error(`the grid's sizes were not read: ${hour}, ${column}`);
  step(
    "the week shows the review on Thursday at 2 PM",
    (await label(window, review)) === `${review}, Thursday, November 5, 2026, 2 PM \u2013 3 PM`,
    (await label(window, review)) ?? "",
  );

  // The review, dragged a day and an hour on.
  const moved = nextSave(
    page,
    (body) => named(body.events, review)[0]?.start === at("2026-11-06T20:00:00Z"),
  );
  await drag(page, window, review, "middle", column, hour);
  const movedBody = JSON.parse((await moved).request().postData() ?? "{}");
  step(
    "dragging the review a day and an hour on saves it on Friday, 3 PM to 4 PM",
    named(movedBody.events, review)[0]?.end === at("2026-11-06T21:00:00Z") &&
      (await label(window, review)) === `${review}, Friday, November 6, 2026, 3 PM \u2013 4 PM`,
    (await label(window, review)) ?? "",
  );

  // Its bottom edge, half an hour down.
  await settled(page);
  const resized = nextSave(
    page,
    (body) => named(body.events, review)[0]?.end === at("2026-11-06T21:30:00Z"),
  );
  await drag(page, window, review, "bottom", 0, hour / 2);
  const resizedBody = JSON.parse((await resized).request().postData() ?? "{}");
  step(
    "dragging its bottom edge saves it ending at 4:30 PM, starting where it was",
    named(resizedBody.events, review)[0]?.start === at("2026-11-06T20:00:00Z") &&
      (await label(window, review)) === `${review}, Friday, November 6, 2026, 3 PM \u2013 4:30 PM`,
    (await label(window, review)) ?? "",
  );
  await shot(page, path.join(out, `calendar-drag-${browserName}-moved.png`));

  // Monday's standup to Tuesday: only this occurrence.
  await settled(page);
  await drag(page, window, standup, "middle", column, 0);
  const ask = page.getByRole("alertdialog");
  await ask.waitFor({ timeout: 5_000 });
  step(
    "dragging an occurrence of the repeating standup asks: only this one, or all of them",
    ((await ask.textContent()) ?? "").includes("only this occurrence") &&
      (await ask.getByRole("button", { name: "Only This Event" }).count()) === 1 &&
      (await ask.getByRole("button", { name: "All Events" }).count()) === 1,
  );
  const alone = nextSave(page, (body) => named(body.events, standup).length === 2);
  await ask.getByRole("button", { name: "Only This Event" }).click();
  const aloneBody = JSON.parse((await alone).request().postData() ?? "{}");
  const series = byId(aloneBody.events, STANDUP_ID);
  const copy = named(aloneBody.events, standup).find((event) => event.id !== STANDUP_ID);
  step(
    '"Only This Event" saves Tuesday\'s standup as an event of its own; the series keeps its other Mondays',
    copy?.start === at("2026-11-03T16:00:00Z") &&
      copy?.end === at("2026-11-03T16:30:00Z") &&
      !copy?.repeat &&
      series?.start === at("2026-11-02T16:00:00Z") &&
      series?.exdates?.length === 1 &&
      series.exdates[0] === at("2026-11-02T16:00:00Z"),
    JSON.stringify({ copy, series }),
  );
  step(
    "the grid shows the standup on Tuesday at 11 AM",
    (await label(window, standup)) ===
      `${standup}, Tuesday, November 3, 2026, 11 AM \u2013 11:30 AM`,
    (await label(window, standup)) ?? "",
  );

  // Next week's standup an hour earlier: all of them.
  await settled(page);
  await window.getByRole("button", { name: "Next week" }).click();
  await scrollToMorning(page);
  await block(window, standup).waitFor({ timeout: 10_000 });
  await drag(page, window, standup, "middle", 0, -hour);
  await ask.waitFor({ timeout: 5_000 });
  const all = nextSave(
    page,
    (body) => byId(body.events, STANDUP_ID)?.start === at("2026-11-02T15:00:00Z"),
  );
  await ask.getByRole("button", { name: "All Events" }).click();
  const allBody = JSON.parse((await all).request().postData() ?? "{}");
  const movedSeries = byId(allBody.events, STANDUP_ID);
  step(
    '"All Events" moves every Monday\'s standup to 10:00, the occurrence moved before still removed',
    movedSeries?.end === at("2026-11-02T15:30:00Z") &&
      movedSeries?.exdates?.length === 1 &&
      movedSeries.exdates[0] === at("2026-11-02T15:00:00Z") &&
      (await label(window, standup)) ===
        `${standup}, Monday, November 9, 2026, 10 AM \u2013 10:30 AM`,
    `${JSON.stringify(movedSeries)} ${(await label(window, standup)) ?? ""}`,
  );
  await shot(page, path.join(out, `calendar-drag-${browserName}-series.png`));

  // A reload keeps every change. Calendar reopens on the week last shown, and the review is in the one before.
  await settled(page);
  await page.reload({ waitUntil: "load" });
  await finder(page).waitFor({ timeout: 20_000 });
  const again = await openCalendar(page);
  // The week last shown comes back with the person's values, a moment after the window opens.
  await page
    .locator(".mac-calendar-week-grid-day")
    .filter({ hasText: "Mon" })
    .filter({ hasText: "9" })
    .waitFor({ timeout: 10_000 });
  await again.getByRole("button", { name: "Previous week" }).click();
  await scrollToMorning(page);
  await block(again, review).waitFor({ timeout: 10_000 });
  const stored = await events(page);
  const storedCopy = named(stored, standup).find((event) => event.id !== STANDUP_ID);
  step(
    "after a reload the grid and the server hold every change",
    (await label(again, review)) === `${review}, Friday, November 6, 2026, 3 PM \u2013 4:30 PM` &&
      (await label(again, standup)) ===
        `${standup}, Tuesday, November 3, 2026, 11 AM \u2013 11:30 AM` &&
      named(stored, review)[0]?.start === at("2026-11-06T20:00:00Z") &&
      named(stored, review)[0]?.end === at("2026-11-06T21:30:00Z") &&
      byId(stored, STANDUP_ID)?.start === at("2026-11-02T15:00:00Z") &&
      storedCopy?.start === at("2026-11-03T16:00:00Z"),
    JSON.stringify(stored.map((each) => [each.title, each.start, each.end])),
  );

  // Another account has none of it.
  const annaPage = await enter(browser, anna, "anna");
  pages.push(annaPage);
  const annaWindow = await openCalendar(annaPage);
  const hers = await events(annaPage);
  step(
    "Anna's calendar holds none of Chris's events, on the server or in her window",
    !hers.some((event) => event.title.includes(run)) &&
      (await annaWindow.getByRole("button", { name: new RegExp(`${run}, `) }).count()) === 0,
    `${hers.length} events of her own`,
  );

  if (keep) {
    writeFileSync(
      `${keep}-${browserName}.json`,
      JSON.stringify({
        review,
        standup,
        standupId: STANDUP_ID,
        chris: await page.context().storageState(),
      }),
    );
  }
} catch (error) {
  problems.push(`journey aborted: ${error instanceof Error ? error.message : error}`);
  for (const [index, page] of pages.entries())
    await shot(page, path.join(out, `calendar-drag-${browserName}-aborted-${index}.png`));
} finally {
  await browser.close();
}
if (problems.length > 0) {
  console.error(
    `\ncalendar drag: ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`,
  );
  process.exit(1);
}
console.log(`\ncalendar drag: all ${steps.length} steps passed with no console errors`);

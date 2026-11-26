#!/usr/bin/env node
// Calendar event alerts on Ferrite, on a browser clock the journey drives.
//
// Chris signs up in a browser in Tokyo whose clock reads Monday 9 November 2026, 21:20 (12:20
// UTC). His calendar holds a meeting every Monday at 8:00 in New York, which alerts ten minutes
// before; New York's clocks went back on 1 November, so 8:00 there is 22:00 in Tokyo now. He adds
// an event in the window (it starts at the next full hour, 22:00) and gives it an alert 15
// minutes before, in its popover. At 21:20 no alert shows: the New York meeting's, laid out on
// Tokyo's clock, would. At 21:45 the event's alert shows under the menu bar, and the meeting's
// not yet; at 21:50 the meeting's shows, saying when it is in Tokyo. Chris closes the event's
// alert, which is saved with the event. After a reload the closed alert stays closed and the
// meeting's shows again until he closes it too. Both are on the server; Anna, signed up in a
// browser of her own, has none of them and sees no alert.
//
// Exits 0 only when every step passed and no page logged a console error, a page error, a
// failed request or an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/calendar-alerts-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                        [--browser chromium|chrome|firefox|webkit] [--keep <prefix>]
//
// `--keep <prefix>` writes `<prefix>-<browser>.json`: Chris's cookies and what the server must
// still hold after a `ferrite dev` restart (campaign/ws5/calendar-alerts-restart-check.mjs).
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
const chris = { name: `chris-al-${run}`, fullName: "Chris Alert" };
const anna = { name: `anna-al-${run}`, fullName: "Anna Alert" };
const EVENTS = "/api/calendar/events";
const ZONE = "Asia/Tokyo";
/** 21:20 in Tokyo on Monday 9 November 2026. */
const START = new Date("2026-11-09T12:20:00Z");
const review = `Review ${run}`;
const standup = `Standup ${run}`;
/** The meeting's occurrence on 9 November: 8:00 in New York (EST) is 13:00 UTC. */
const STANDUP_AT = Date.parse("2026-11-09T13:00:00Z");

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

/** Requests of the desktop's API still in flight, per page (the live stream left out). */
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

/** Until no request of the API has been in flight for half a second: before the clock jumps. */
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

/** A fresh browser in Tokyo, its clock at `time`, signed up as `person`, on its desktop. */
async function enter(browser, person, label, time) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    timezoneId: ZONE,
  });
  await context.clock.install({ time });
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

/** The next PUT of the calendar whose body passes `accept`. */
const nextSave = (page, accept) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      pathOf(response.url()) === EVENTS &&
      accept(JSON.parse(response.request().postData() ?? "{}")),
    { timeout: 15_000 },
  );
const named = (list, title) => (list ?? []).find((event) => event.title === title);
const events = async (page) => (await api(page, "GET", EVENTS)).json?.events ?? [];
const popover = (page) => page.locator(".mac-calendar-popover").first();
/** The alert of the event titled `title`, under the menu bar. */
const alertOf = (page, title) =>
  page.locator(".mac-calendar-alerts > *").filter({ hasText: title });
const shows = async (page, title, timeout = 10_000) =>
  alertOf(page, title)
    .first()
    .waitFor({ timeout })
    .then(() => true)
    .catch(() => false);

async function choose(page, scope, name, option) {
  await scope.getByRole("combobox", { name }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

const browser = await ENGINES[browserName].launch();
console.log(`calendar alerts in ${browserName}`);
const pages = [];
try {
  const page = await enter(browser, chris, "chris", START);
  pages.push(page);

  // The weekly New York meeting, saved as the window would save it.
  const read = await api(page, "GET", EVENTS);
  const put = await api(page, "PUT", EVENTS, {
    rev: read.json?.rev,
    events: [
      {
        id: `standup-${run}`,
        title: standup,
        start: Date.parse("2026-10-19T12:00:00Z"),
        end: Date.parse("2026-10-19T12:30:00Z"),
        calendar: "work",
        repeat: { freq: "weekly" },
        timeZone: "America/New_York",
        alert: 10,
      },
    ],
  });
  step(
    "Chris's calendar holds a weekly 8:00 New York meeting that alerts 10 minutes before",
    put.status === 200,
    `HTTP ${put.status}`,
  );

  const window = await openCalendar(page);
  await settled(page);
  step(
    "at 21:20 in Tokyo no alert shows: the meeting is at 22:00 here, on New York's clock",
    (await page.locator(".mac-calendar-alerts > *").count()) === 0,
  );

  // An event of his own, with an alert chosen in its popover.
  const added = nextSave(page, (body) => Boolean(named(body.events, review)));
  await window.getByRole("button", { name: "New Event" }).click();
  const title = page.getByRole("textbox", { name: "Title" });
  await title.waitFor({ timeout: 10_000 });
  await title.fill(review);
  await title.press("Enter");
  const addedBody = JSON.parse((await added).request().postData() ?? "{}");
  const reviewStart = named(addedBody.events, review)?.start;
  step(
    "he adds an event: it starts at 22:00 in Tokyo, the next full hour",
    reviewStart === Date.parse("2026-11-09T13:00:00Z"),
    reviewStart ? new Date(reviewStart).toISOString() : "none",
  );
  await popover(page)
    .getByRole("button", { name: /^Date: / })
    .click();
  const alerted = nextSave(page, (body) => named(body.events, review)?.alert === 15);
  await choose(page, popover(page), "Alert", "15 minutes before");
  step(
    "in its popover he gives it an alert 15 minutes before, saved",
    (await alerted).status() === 200,
  );
  await popover(page).getByRole("button", { name: "Done" }).click();
  step(
    "the popover says so under the date",
    ((await popover(page).textContent()) ?? "").includes("Alert 15 minutes before"),
  );
  await page.keyboard.press("Escape");
  await popover(page).waitFor({ state: "hidden", timeout: 5_000 });

  // The clock moves on: each alert comes at its moment.
  await settled(page);
  await page.clock.fastForward("25:00");
  step("at 21:45 the event's alert shows under the menu bar", await shows(page, review));
  step("and the meeting's does not yet", (await alertOf(page, standup).count()) === 0);
  await shot(page, path.join(out, `calendar-alerts-${browserName}-event.png`));
  await settled(page);
  await page.clock.fastForward("05:00");
  step("at 21:50 (7:50 in New York) the meeting's alert shows", await shows(page, standup));
  step(
    "saying when it is in Tokyo: 10:00 PM to 10:30 PM",
    ((await alertOf(page, standup).first().textContent()) ?? "").includes("10:00 PM to 10:30 PM"),
    (await alertOf(page, standup).first().textContent()) ?? "",
  );
  await shot(page, path.join(out, `calendar-alerts-${browserName}-both.png`));

  // Close is saved with the event.
  const closed = nextSave(
    page,
    (body) => named(body.events, review)?.alertDismissed === reviewStart,
  );
  await alertOf(page, review).first().getByRole("button", { name: "Close" }).click();
  step("he closes the event's alert: saved with the event", (await closed).status() === 200);
  await alertOf(page, review).first().waitFor({ state: "detached", timeout: 5_000 });

  // After a reload the closed alert stays closed; the meeting's shows again.
  await settled(page);
  await page.reload({ waitUntil: "load" });
  await finder(page).waitFor({ timeout: 20_000 });
  await page.clock.setSystemTime(new Date("2026-11-09T12:52:00Z"));
  await openCalendar(page);
  step("after a reload the meeting's alert shows again", await shows(page, standup, 15_000));
  step("and the closed one stays closed", (await alertOf(page, review).count()) === 0);
  const closedMeeting = nextSave(
    page,
    (body) => named(body.events, standup)?.alertDismissed === STANDUP_AT,
  );
  await alertOf(page, standup).first().getByRole("button", { name: "Close" }).click();
  step("he closes the meeting's alert too, saved", (await closedMeeting).status() === 200);
  const stored = await events(page);
  step(
    "the server holds both alerts and what was closed",
    named(stored, review)?.alert === 15 &&
      named(stored, review)?.alertDismissed === reviewStart &&
      named(stored, standup)?.alert === 10 &&
      named(stored, standup)?.alertDismissed === STANDUP_AT,
    JSON.stringify(stored.map((each) => [each.title, each.alert, each.alertDismissed])),
  );

  // Another account has none of it.
  const annaPage = await enter(browser, anna, "anna", new Date("2026-11-09T12:52:00Z"));
  pages.push(annaPage);
  await openCalendar(annaPage);
  await settled(annaPage);
  const hers = await events(annaPage);
  step(
    "Anna's calendar holds none of Chris's events, and no alert shows to her",
    !hers.some((event) => event.title.includes(run)) &&
      (await annaPage.locator(".mac-calendar-alerts > *").count()) === 0,
    `${hers.length} events of her own`,
  );

  if (keep) {
    writeFileSync(
      `${keep}-${browserName}.json`,
      JSON.stringify({
        review,
        reviewStart,
        standup,
        standupAt: STANDUP_AT,
        chris: await page.context().storageState(),
      }),
    );
  }
} catch (error) {
  problems.push(`journey aborted: ${error instanceof Error ? error.message : error}`);
  for (const [index, page] of pages.entries())
    await shot(page, path.join(out, `calendar-alerts-${browserName}-aborted-${index}.png`));
} finally {
  await browser.close();
}
if (problems.length > 0) {
  console.error(
    `\ncalendar alerts: ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`,
  );
  process.exit(1);
}
console.log(`\ncalendar alerts: all ${steps.length} steps passed with no console errors`);

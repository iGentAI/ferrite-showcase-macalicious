#!/usr/bin/env node
// Calendar's iCalendar files and invitations between accounts on Ferrite, across time zones.
//
// Chris signs up in a browser whose clock is New York's. From the list of calendars he imports a
// file that is not iCalendar and a malformed .ics file: each is refused by its name and nothing
// is saved. He imports a file with two events in New York time (with its VTIMEZONE): a meeting
// at 9:00 today and a weekly one at 8:00; the meeting is stored at the instant 9:00 New York is,
// and shown at 9 AM. A second browser of his, whose clock is Tokyo's, shows the meeting at the
// same instant, on its own clock (10 or 11 PM). He exports the meeting (File > Export
// Event...): the file's DTSTART names the same instant, and importing it again adds nothing.
//
// Anna, in a browser of her own, is invited to the meeting; she declines, it leaves her calendar,
// and Chris reads her answer; Show Declined Invitations shows it again and she accepts after all,
// which Chris reads too, and which a reload keeps. Last, Anna imports Chris's export: her own copy
// is at the same instant, though her browser's clock is another zone's.
//
// The weekly event is checked after the United States' clock change in both of Chris's browsers:
// it repeats in the New York zone it was written in, so both show it at the instant 8:00 New
// York is, each on its own clock.
//
// Exits 0 only when every step passed and no page logged a console error, a page error, a
// failed request or an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/calendar-ics-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                     [--browser chromium|chrome|firefox|webkit] [--keep <prefix>]
//
// `--keep <prefix>` writes `<prefix>-<browser>.json`: both accounts' cookies and what must
// survive a `ferrite dev` restart (campaign/ws5/calendar-ics-restart-check.mjs).
// The accounts are made fresh for each run, so it runs again against the same deployment.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { options, shot } from "./app-journey.mjs";
import { ENGINES } from "./journey-kit.mjs";

const { base, out, browserName } = options();
const argv = process.argv.slice(2);
const keepAt = argv.indexOf("--keep");
const keep = keepAt >= 0 ? argv[keepAt + 1] : null;
const run = Date.now().toString(36);
const password = `tide-${run}-pool`;
const chris = { name: `chris-ics-${run}`, fullName: "Chris Ics" };
const anna = { name: `anna-ics-${run}`, fullName: "Anna Ics" };
const URL = "/api/calendar/events";
const NEW_YORK = "America/New_York";
const TOKYO = "Asia/Tokyo";
const standup = `Standup ${run}`;
const weekly = `Weekly ${run}`;

const problems = [];
const steps = [];
/**
 * Waits for a sheet to finish sliding in. Playwright's WebKit can pass a button that is still moving as stable, and the
 * press then lands on the button and the release beside it, so no click happens.
 */
const slidIn = (sheet) =>
  sheet.evaluate(async (element) => {
    while (element.hasAttribute("data-starting-style")) await new Promise(requestAnimationFrame);
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });

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

function watch(page, label) {
  page.on("console", (message) => {
    if (/status of 409/.test(message.text())) return;
    if (message.type() === "error") problems.push(`${label} console: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`${label} page error: ${error.message}`));
  page.on("requestfailed", (request) => {
    const text = request.failure()?.errorText ?? "";
    // `ferrite dev`'s live-reload stream and the page's own requests cut short by a reload.
    if (/ERR_ABORTED|NS_BINDING_ABORTED|NS_ERROR_ABORT|cancelled/i.test(text)) return;
    problems.push(`${label} request failed: ${request.url()} ${text}`);
  });
  page.on("response", (response) => {
    // Two browsers of one person save settings at once: the shared save client takes the 409 and merges onto the newer copy.
    if (response.status() === 409 && pathOf(response.url()) === "/api/system-preferences/settings")
      return;
    if (response.status() >= 400)
      problems.push(`${label} HTTP ${response.status()} ${pathOf(response.url())}`);
  });
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

// Time-zone arithmetic for the expectations, independent of the page's.
/** The offset of `zone` from UTC at `ms`, in minutes (New York in October: -240). */
function zoneOffset(zone, ms) {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" })
      .formatToParts(new Date(ms))
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  return match ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 0;
}
/** The instant that is the wall-clock time given in `zone`. */
function instantIn(zone, year, month, day, hour, minute = 0) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = guess - zoneOffset(zone, guess) * 60_000;
  return guess - zoneOffset(zone, first) * 60_000;
}
/** The calendar day of `ms` in `zone`. */
function dayIn(zone, ms) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date(ms))
      .map((part) => [part.type, part.value]),
  );
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}
/** The wall-clock hour and minute of `ms` in `zone`, as "9:00 AM". */
const clockIn = (zone, ms) =>
  new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" })
    .format(new Date(ms))
    .replace(/\u202f/g, " ");
/** The same as the week grid writes a start: "9 AM" on the hour, "9:30 AM" otherwise. */
const gridClock = (zone, ms) => `${clockIn(zone, ms).replace(/:00(?= )/, "")} \u2013`;
const stamp = ({ year, month, day }) =>
  `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;

const finder = (page) => page.getByRole("button", { name: /^Finder$/ }).first();

async function newPage(browser, label, zone) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    timezoneId: zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    acceptDownloads: true,
  });
  const page = await context.newPage();
  watch(page, label);
  await page.goto(`${base}/`, { waitUntil: "load" });
  await page.getByRole("group", { name: "Users" }).waitFor({ timeout: 20_000 });
  return page;
}

/** A fresh browser signed up as `person` (or signed in when `signIn`), on its desktop. */
async function enter(browser, person, label, { zone, signIn = false } = {}) {
  const page = await newPage(browser, label, zone);
  const made = await api(
    page,
    "POST",
    signIn ? "/api/session/sign-in" : "/api/session/sign-up",
    signIn
      ? { name: person.name, password }
      : { name: person.name, full_name: person.fullName, password },
  );
  step(
    `${person.fullName} ${signIn ? "signs in in a second browser" : "creates an account"}${zone ? ` (clock: ${zone})` : ""}`,
    made.status === (signIn ? 200 : 201),
    `HTTP ${made.status}`,
  );
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

const events = async (page) => (await api(page, "GET", URL)).json?.events ?? [];
const named = (list, title) => list.find((event) => event.title === title);
const block = (window, title) =>
  window.getByRole("button", { name: new RegExp(`^${title}, `) }).first();
const label = async (window, title) =>
  (await block(window, title).getAttribute("aria-label")) ?? "";
const popover = (page) => page.locator(".mac-calendar-popover").first();
const calendarRow = (window, name) =>
  window
    .getByRole("tree", { name: "Calendars" })
    .getByRole("treeitem", { name: new RegExp(name) })
    .first();

/** Import… from the contextual menu of the calendar named `into`, picking `file` in the chooser. */
async function pick(page, window, file, into) {
  await calendarRow(window, into).click({ button: "right" });
  const choosing = page.waitForEvent("filechooser", { timeout: 10_000 });
  await page.getByRole("menuitem", { name: "Import\u2026", exact: true }).click();
  await (await choosing).setFiles(file);
}

/** The alert Calendar shows, its text, closed with OK. */
async function report(page) {
  const alert = page.getByRole("alertdialog");
  await alert.waitFor({ timeout: 10_000 });
  const text = ((await alert.textContent()) ?? "").replace(/\s+/g, " ").trim();
  await alert.getByRole("button", { name: "OK" }).click();
  await alert.waitFor({ state: "hidden", timeout: 5_000 });
  return text;
}

/** Import `file` into the calendar named `into` through the Import Events sheet; the report. */
async function importInto(page, window, file, into) {
  await pick(page, window, file, into);
  const sheet = page.getByRole("dialog", { name: "Import Events" });
  await sheet.waitFor({ timeout: 10_000 });
  await slidIn(sheet);
  await sheet.getByRole("button", { name: "Import" }).click();
  return report(page);
}

/** The instant a DTSTART line names, or null when it is a floating time or unreadable. */
function dtstartOf(ics, summary) {
  const event = ics
    .split("BEGIN:VEVENT")
    .slice(1)
    .find((each) => each.includes(`SUMMARY:${summary}\r\n`));
  const match =
    /\r\nDTSTART(?:;TZID=([^:\r\n]+))?:(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})\d{2}(Z?)\r\n/.exec(
      event ?? "",
    );
  if (!match) return null;
  const [, zone, y, mo, d, h, mi, utc] = match;
  if (utc) return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  if (zone) return instantIn(zone, Number(y), Number(mo), Number(d), Number(h), Number(mi));
  return null;
}

const browser = await ENGINES[browserName].launch();
console.log(`calendar iCalendar and invitations in ${browserName}`);
const pages = [];
try {
  const page = await enter(browser, chris, "chris", { zone: NEW_YORK });
  pages.push(page);
  const window = await openCalendar(page);
  step("Chris's Calendar opens", await window.isVisible());
  let saves = 0;
  page.on("request", (request) => {
    if (request.method() === "PUT" && pathOf(request.url()) === URL) saves += 1;
  });

  // Files Calendar cannot read are refused by name, and change nothing.
  const before = saves;
  await pick(
    page,
    window,
    {
      name: "broken.ics",
      mimeType: "text/calendar",
      buffer: Buffer.from("BEGIN:VCALENDAR\r\nthis is not a calendar\r\nEND:VCALENDAR\r\n"),
    },
    "Work",
  );
  const broken = await report(page);
  step(
    "a malformed .ics file is refused by its name",
    broken.includes("\u201cbroken.ics\u201d") && broken.includes("No events were found"),
    broken,
  );
  await pick(
    page,
    window,
    { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("Lunch at noon") },
    "Work",
  );
  const notes = await report(page);
  step(
    "a file that is not iCalendar is refused by its name",
    notes.includes("\u201cnotes.txt\u201d is not an iCalendar file"),
    notes,
  );
  step("neither refused file saved anything", saves === before, `${saves - before} saves`);

  // A file in New York time: today's meeting at 9:00, and a weekly event at 8:00.
  const today = dayIn(NEW_YORK, Date.now());
  const expected = instantIn(NEW_YORK, today.year, today.month, today.day, 9);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WS5//Calendar journey//EN",
    "BEGIN:VTIMEZONE",
    "TZID:America/New_York",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:-0500",
    "TZOFFSETTO:-0400",
    "TZNAME:EDT",
    "DTSTART:19700308T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:-0400",
    "TZOFFSETTO:-0500",
    "TZNAME:EST",
    "DTSTART:19701101T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:standup-${run}@ws5.example`,
    "DTSTAMP:20261021T120000Z",
    `DTSTART;TZID=America/New_York:${stamp(today)}T090000`,
    `DTEND;TZID=America/New_York:${stamp(today)}T093000`,
    `SUMMARY:${standup}`,
    "END:VEVENT",
    "BEGIN:VEVENT",
    `UID:weekly-${run}@ws5.example`,
    "DTSTAMP:20261021T120000Z",
    `DTSTART;TZID=America/New_York:${stamp(today)}T080000`,
    `DTEND;TZID=America/New_York:${stamp(today)}T083000`,
    "RRULE:FREQ=WEEKLY;COUNT=8",
    `SUMMARY:${weekly}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
  const fixture = path.join(out, `new-york-${browserName}.ics`);
  await writeFile(fixture, ics);
  const imported = await importInto(page, window, fixture, "Work");
  step(
    "a file in New York time is imported",
    imported.includes("2 events were imported"),
    imported,
  );
  let stored = [];
  for (let attempt = 0; attempt < 30 && !named(stored, standup); attempt += 1) {
    if (attempt) await page.waitForTimeout(200);
    stored = await events(page);
  }
  step(
    "the meeting is stored at the instant 9:00 New York is",
    named(stored, standup)?.start === expected,
    `${named(stored, standup)?.start} = ${new Date(named(stored, standup)?.start ?? 0).toISOString()}, expected ${new Date(expected).toISOString()}`,
  );
  await block(window, standup).waitFor({ timeout: 10_000 });
  step(
    "the New York browser shows it at 9 AM",
    (await label(window, standup)).includes(gridClock(NEW_YORK, expected)),
    await label(window, standup),
  );

  // A browser on Tokyo's clock shows the same instant on its own clock.
  const tokyoPage = await enter(browser, chris, "chris-tokyo", { zone: TOKYO, signIn: true });
  pages.push(tokyoPage);
  const tokyo = await openCalendar(tokyoPage);
  const tokyoClock = gridClock(TOKYO, expected);
  const shownInTokyo = await block(tokyo, standup)
    .waitFor({ timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  step(
    `the Tokyo browser shows the meeting at the same instant, ${tokyoClock} on its clock`,
    shownInTokyo && (await label(tokyo, standup)).includes(tokyoClock),
    shownInTokyo ? await label(tokyo, standup) : "not in Tokyo's week",
  );

  // The weekly event after the United States' clock change (1 November 2026), in both browsers:
  // it repeats in New York's zone, so both show it at the instant 8:00 New York is.
  const weeklyStored = named(await events(page), weekly);
  step(
    "the weekly event keeps the New York zone it was written in",
    weeklyStored?.timeZone === NEW_YORK,
    JSON.stringify(weeklyStored?.timeZone),
  );
  const change = Date.UTC(2026, 10, 1, 6);
  const firstAfter = [1, 2, 3, 4, 5, 6, 7].find(
    (week) => instantIn(NEW_YORK, today.year, today.month, today.day + 7 * week, 8) > change,
  );
  let zoneCheck = null;
  if (firstAfter && Date.now() < change) {
    const meant = instantIn(NEW_YORK, today.year, today.month, today.day + 7 * firstAfter, 8);
    zoneCheck = { weeksAhead: firstAfter, meant };
    for (const [name, zone, where] of [
      ["New York", NEW_YORK, window],
      ["Tokyo", TOKYO, tokyo],
    ]) {
      for (let week = 0; week < firstAfter; week += 1)
        await where.getByRole("button", { name: "Next week" }).click();
      const seen = await block(where, weekly)
        .waitFor({ timeout: 5_000 })
        .then(() => label(where, weekly))
        .catch(() => "not shown");
      step(
        `after the clock change (${firstAfter} weeks on) the weekly event is at its New York instant in ${name}: ${gridClock(zone, meant).replace(" \u2013", "")}`,
        seen.includes(gridClock(zone, meant)),
        seen,
      );
      await where.getByRole("button", { name: "Today" }).click();
    }
  } else {
    console.log("note: no clock change of New York's within seven weeks of today: not checked");
  }

  // Export the meeting, and import the export again: nothing is added.
  await block(window, standup).click();
  await page.getByRole("menubar").getByRole("menuitem", { name: "File", exact: true }).click();
  const downloading = page.waitForEvent("download", { timeout: 10_000 });
  await page.getByRole("menuitem", { name: "Export Event\u2026" }).click();
  const download = await downloading;
  const exportedFile = path.join(out, `standup-${browserName}.ics`);
  await download.saveAs(exportedFile);
  const exported = await readFile(exportedFile, "utf8");
  const exportedStart = dtstartOf(exported, standup);
  step(
    "Export Event downloads the meeting as an iCalendar file whose DTSTART is the same instant",
    download.suggestedFilename().endsWith(".ics") &&
      exported.startsWith("BEGIN:VCALENDAR\r\n") &&
      exportedStart === expected,
    `${download.suggestedFilename()}: ${exportedStart === null ? "no zoned or UTC DTSTART" : new Date(exportedStart).toISOString()}`,
  );
  const again = await importInto(page, window, exportedFile, "Work");
  step("importing the export again adds nothing", again.includes("0 events were imported"), again);

  // Anna is invited; she declines, sees it again with Show Declined Invitations, and accepts.
  const annaPage = await enter(browser, anna, "anna");
  pages.push(annaPage);
  const standupId = named(await events(page), standup)?.id;
  await block(window, standup).dblclick();
  await popover(page).getByRole("button", { name: "Add Invitees" }).click();
  const invitee = page.getByRole("textbox", { name: "Invitee" });
  await invitee.fill(anna.name);
  const invited = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      pathOf(response.url()) === URL &&
      JSON.parse(response.request().postData() ?? "{}").events?.some(
        (event) => event.title === standup && event.invitees?.includes(anna.name),
      ),
    { timeout: 15_000 },
  );
  await invitee.press("Enter");
  step("Chris invites Anna by her account name", (await invited).status() === 200);
  await popover(page).getByRole("button", { name: "Done" }).click();
  await page.keyboard.press("Escape");

  const annaWindow = await openCalendar(annaPage);
  await calendarRow(annaWindow, "Invitations").waitFor({ timeout: 15_000 });
  await block(annaWindow, standup).waitFor({ timeout: 10_000 });
  step(
    "Anna finds it in her Invitations calendar, at the same instant",
    (await label(annaWindow, standup)).includes(
      gridClock(Intl.DateTimeFormat().resolvedOptions().timeZone, expected),
    ),
    await label(annaWindow, standup),
  );
  const answer = (kind) =>
    annaPage.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new RegExp(`^/api/calendar/inbox/[0-9a-f]{32}/\\d+/${kind}$`).test(pathOf(response.url())),
      { timeout: 15_000 },
    );
  const sentStatus = async () =>
    (await api(page, "GET", "/api/calendar/sent")).json?.events?.[standupId ?? ""]?.[0]?.status;

  await block(annaWindow, standup).dblclick();
  const declined = answer("decline");
  await popover(annaPage).getByRole("button", { name: "Decline" }).click();
  step("Anna declines", (await declined).status() === 200);
  const left = await block(annaWindow, standup)
    .waitFor({ state: "detached", timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  step("the declined invitation leaves her calendar", left);
  step("Chris reads that Anna declined", (await sentStatus()) === "declined");

  await calendarRow(annaWindow, "Invitations").click({ button: "right" });
  await annaPage.getByRole("menuitemcheckbox", { name: "Show Declined Invitations" }).click();
  await annaPage.keyboard.press("Escape");
  const back = await block(annaWindow, standup)
    .waitFor({ timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  step("Show Declined Invitations shows it again", back);
  await block(annaWindow, standup).dblclick();
  const accepted = answer("accept");
  await popover(annaPage).getByRole("button", { name: "Accept" }).click();
  step("she accepts it after all", (await accepted).status() === 200);
  step("Chris reads that Anna accepted", (await sentStatus()) === "accepted");
  await annaPage.keyboard.press("Escape");
  await shot(annaPage, path.join(out, `calendar-ics-${browserName}-accepted.png`));

  await annaPage.reload({ waitUntil: "load" });
  await finder(annaPage).waitFor({ timeout: 20_000 });
  const annaAgain = await openCalendar(annaPage);
  const inbox = await api(annaPage, "GET", "/api/calendar/inbox");
  const kept = await block(annaAgain, standup)
    .waitFor({ timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  step(
    "after a reload her answer is kept, and the meeting is in her calendar",
    kept && inbox.json?.invitations?.some((each) => each.status === "accepted"),
    JSON.stringify(inbox.json?.invitations?.map((each) => each.status)),
  );

  // Anna imports Chris's export: her copy is at the same instant, on her own clock.
  const annaImported = await importInto(annaPage, annaAgain, exportedFile, "Home");
  // The window reports the import before its save has reached the server.
  let annaEvents = await events(annaPage);
  for (let tries = 0; tries < 20 && !named(annaEvents, standup); tries += 1) {
    await annaPage.waitForTimeout(500);
    annaEvents = await events(annaPage);
  }
  step(
    "Anna imports Chris's export into her own calendar, at the same instant",
    annaImported.includes("1 event was imported") && named(annaEvents, standup)?.start === expected,
    `${annaImported}; ${named(annaEvents, standup)?.start}`,
  );

  if (keep) {
    await writeFile(
      `${keep}-${browserName}.json`,
      JSON.stringify({
        run,
        standup,
        weekly,
        expected,
        zoneCheck,
        chris: await page.context().storageState(),
        anna: await annaPage.context().storageState(),
      }),
    );
  }
} catch (error) {
  problems.push(`journey aborted: ${error instanceof Error ? error.message : error}`);
  for (const [index, page] of pages.entries())
    await shot(page, path.join(out, `calendar-ics-${browserName}-aborted-${index}.png`));
} finally {
  await browser.close();
}
if (problems.length > 0) {
  console.error(
    `\ncalendar iCalendar: ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`,
  );
  process.exit(1);
}
console.log(`\ncalendar iCalendar: all ${steps.length} steps passed with no console errors`);

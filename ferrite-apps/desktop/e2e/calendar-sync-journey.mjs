#!/usr/bin/env node
// Calendar events across reloads, accounts and two browsers on Ferrite.
//
// Chris signs up in a browser of his own. In his Calendar he adds an event and names it, gives
// it a location, and moves it a day with the keyboard in its popover's start date (a day later,
// or a day earlier from the visible week's last day, so it stays in the week shown); he adds
// a second event, makes it all-day and repeating every week; he adds a third and deletes it. In
// Preferences he makes the week start on Monday (saved for his account), and finds the Alerts
// pane dimmed with its reason. After a reload every change is there, in the window and on the
// server. Anna, signed up in a browser of her own, has none of it: not on the server, not in her
// window, and her week starts on Sunday.
//
// Then Chris signs in in a second browser. An event the first browser adds appears in the
// second's Calendar without a reload. The first browser then stops hearing about changes (its
// live stream is cut and it reloads), so its copy goes stale: the second adds an event; the
// first, on its older copy, gives the all-day event a location, meets a 409, and its change is
// made on the stored calendar, so both are kept, the first window shows the second's event and
// its popover stays open. The second deletes its event; the first, on its older copy, changes
// it, meets a 409, and it stays deleted.
//
// Exits 0 only when every step passed and no page logged a console error, a page error, a
// failed request or an HTTP error (during the conflict steps a 409 on the calendar is allowed,
// with the save client's note that a change to a deleted event was not kept; and the cut
// browser's failed live-stream requests).
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/calendar-sync-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                      [--browser chromium|chrome|firefox|webkit] [--keep <prefix>]
//
// `--keep <prefix>` writes `<prefix>-<browser>.json`: both accounts' cookies and what the server
// must still hold after a `ferrite dev` restart (campaign/ws5/calendar-restart-check.mjs).
// The accounts are made fresh for each run, so it runs again against the same deployment.

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
const chris = { name: `chris-cs-${run}`, fullName: "Chris Sync" };
const anna = { name: `anna-cs-${run}`, fullName: "Anna Sync" };
const URL = "/api/calendar/events";
const SETTINGS = "/api/calendar/settings";
const meet = `Meet ${run}`;
const trip = `Trip ${run}`;
const drop = `Drop ${run}`;
const live = `Live ${run}`;
const fromB = `From B ${run}`;

const problems = [];
const steps = [];
const step = (label, ok, detail = "") => {
  steps.push(label);
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`);
  if (!ok) problems.push(label);
  return ok;
};

/** While true, a 409 on the calendar is the conflict a step provokes, not a problem. */
let conflictsExpected = false;
/** The pages whose live stream is cut on purpose. */
const cut = new Set();
const pathOf = (url) => {
  try {
    return new globalThis.URL(url).pathname;
  } catch {
    return "";
  }
};

function watch(page, label) {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const at = pathOf(message.location()?.url ?? "");
    if (conflictsExpected && /status of 409/.test(message.text()) && at === URL) return;
    // The shared save client says so when a change to an event deleted elsewhere is not kept,
    // which the second conflict step provokes on purpose.
    if (
      conflictsExpected &&
      message.text().includes(`did not keep a change to ${URL}`) &&
      message.text().includes("changed elsewhere first")
    )
      return;
    // The cut browser's failed live stream: Firefox reports it from the page's script, naming
    // the stream's address in the text.
    if (cut.has(page) && (at.startsWith("/live/") || message.text().includes("/live/me"))) return;
    problems.push(`${label} console: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`${label} page error: ${error.message}`));
  page.on("requestfailed", (request) => {
    const text = request.failure()?.errorText ?? "";
    const at = pathOf(request.url());
    if (cut.has(page) && at.startsWith("/live/")) return;
    // `ferrite dev`'s live-reload stream and the page's own requests cut short by a reload.
    if (/ERR_ABORTED|NS_BINDING_ABORTED|NS_ERROR_ABORT|cancelled/i.test(text)) return;
    problems.push(`${label} request failed: ${request.url()} ${text}`);
  });
  page.on("response", (response) => {
    const at = pathOf(response.url());
    if (response.status() === 409 && conflictsExpected && at === URL) return;
    if (response.status() >= 400) problems.push(`${label} HTTP ${response.status()} ${at}`);
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

const finder = (page) => page.getByRole("button", { name: /^Finder$/ }).first();

async function newPage(browser, label) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const page = await context.newPage();
  watch(page, label);
  await page.goto(`${base}/`, { waitUntil: "load" });
  await page.getByRole("group", { name: "Users" }).waitFor({ timeout: 20_000 });
  return page;
}

/** A fresh browser signed up as `person`, or signed in when `signIn`, on its desktop. */
async function enter(browser, person, label, signIn = false) {
  const page = await newPage(browser, label);
  const made = await api(
    page,
    "POST",
    signIn ? "/api/session/sign-in" : "/api/session/sign-up",
    signIn
      ? { name: person.name, password }
      : { name: person.name, full_name: person.fullName, password },
  );
  step(
    `${person.fullName} ${signIn ? "signs in in a second browser" : "creates an account"}`,
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

/** The next PUT of the calendar whose body passes `accept`, and its status. */
const nextSave = (page, accept, status = 200) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      pathOf(response.url()) === URL &&
      response.status() === status &&
      accept(JSON.parse(response.request().postData() ?? "{}")),
    { timeout: 15_000 },
  );
const anySave = () => true;
const events = async (page) => (await api(page, "GET", URL)).json?.events ?? [];
const named = (list, title) => list.find((event) => event.title === title);

const block = (window, title) =>
  window.getByRole("button", { name: new RegExp(`^${title}, `) }).first();
/** The week view's first day, as its column heading names it ("Mon 19"). */
const firstDay = (window) => window.locator(".mac-calendar-week-grid-day").first();
const popover = (page) => page.locator(".mac-calendar-popover").first();

async function choose(page, scope, name, option) {
  await scope.getByRole("combobox", { name }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

/** A new event from the toolbar, named in the popover that opens; the popover stays open. */
async function addEvent(page, window, title) {
  const saved = nextSave(page, (body) => body.events?.some((event) => event.title === title));
  await window.getByRole("button", { name: "New Event" }).click();
  const field = page.getByRole("textbox", { name: "Title" });
  await field.waitFor({ timeout: 10_000 });
  await field.fill(title);
  await field.press("Enter");
  return (await saved).status() === 200;
}

/**
 * Type a location into the open popover. With `mayVanish`, the event may be deleted under it
 * while it is typed (a merge with a copy that deleted it): its popover then goes, and the Enter
 * that ends the editing has nothing left to press.
 */
async function setLocation(page, place, mayVanish = false) {
  await popover(page)
    .getByRole("button", { name: /^(Add Location|Location: )/ })
    .click();
  const field = page.getByRole("textbox", { name: "Location" });
  await field.fill(place);
  if (mayVanish) await field.press("Enter", { timeout: 3_000 }).catch(() => undefined);
  else await field.press("Enter");
}

async function closePopover(page) {
  if (await popover(page).isVisible()) await page.keyboard.press("Escape");
  await popover(page).waitFor({ state: "hidden", timeout: 5_000 });
}

const browser = await ENGINES[browserName].launch();
console.log(`calendar sync in ${browserName}`);
const pages = [];
try {
  const page = await enter(browser, chris, "chris");
  pages.push(page);
  const window = await openCalendar(page);
  step("Chris's Calendar opens", await window.isVisible());

  // An event, named, given a location and moved a day in its popover.
  step("an event is added and named", await addEvent(page, window, meet));
  const located = nextSave(page, (body) => named(body.events ?? [], meet)?.location === "Room 4");
  await setLocation(page, "Room 4");
  step("its location is typed in its popover, saved", (await located).status() === 200);
  const before = named(await events(page), meet);
  await popover(page)
    .getByRole("button", { name: /^Date: / })
    .click();
  const day = popover(page)
    .getByRole("group", { name: "Starts" })
    .getByRole("spinbutton", { name: "Day" });
  await day.click();
  // The week view shows Sunday to Saturday here (the week is made to start on Monday only below). Calendar closes an
  // event's popover when the event leaves the week shown, so an event on the week's last day moved a day later would
  // take its popover with it: there the Down arrow moves it a day earlier instead, and the move stays in the visible
  // week whatever the browser's date.
  const lastDayOfWeek = Boolean(before) && new Date(before.start).getDay() === 6;
  const moved = nextSave(page, (body) => named(body.events ?? [], meet)?.start !== before?.start);
  await day.press(lastDayOfWeek ? "ArrowDown" : "ArrowUp");
  const movedBody = JSON.parse((await moved).request().postData() ?? "{}");
  const after = named(movedBody.events ?? [], meet);
  const dayOf = (ms) => {
    const date = new Date(ms);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  };
  const shiftedDay = (ms, by) => {
    const date = new Date(ms);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + by).getTime();
  };
  step(
    "the arrow keys in its start date move it a day within the visible week, length kept",
    before &&
      after &&
      dayOf(after.start) === shiftedDay(before.start, lastDayOfWeek ? -1 : 1) &&
      after.end - after.start === before.end - before.start,
    `${lastDayOfWeek ? "Down, from the week's last day" : "Up"}: ${before && new Date(before.start).toISOString()} -> ${after && new Date(after.start).toISOString()}`,
  );
  const meetStart = after?.start;
  await popover(page).getByRole("button", { name: "Done" }).click();
  await closePopover(page);

  // An all-day event that repeats every week.
  step("a second event is added and named", await addEvent(page, window, trip));
  await popover(page)
    .getByRole("button", { name: /^Date: / })
    .click();
  const allDay = nextSave(page, (body) => named(body.events ?? [], trip)?.allDay === true);
  await popover(page).getByRole("checkbox", { name: "All-day" }).click();
  step("it is made all-day", (await allDay).status() === 200);
  const weekly = nextSave(
    page,
    (body) => named(body.events ?? [], trip)?.repeat?.freq === "weekly",
  );
  await choose(page, popover(page), "Repeat", "Every Week");
  step("and made to repeat every week", (await weekly).status() === 200);
  await popover(page).getByRole("button", { name: "Done" }).click();
  await closePopover(page);

  // A third event, deleted.
  step("a third event is added", await addEvent(page, window, drop));
  await closePopover(page);
  await block(window, drop).click();
  const deleted = nextSave(page, (body) => !named(body.events ?? [], drop));
  await page.keyboard.press("Delete");
  step("and deleted with the Delete key", (await deleted).status() === 200);
  await shot(page, path.join(out, `calendar-sync-${browserName}-edited.png`));

  // Preferences: the week starts on Monday, saved for this account; what this Calendar cannot honour
  // is dimmed, saying why.
  await page.getByRole("menubar").getByRole("menuitem", { name: "Calendar", exact: true }).click();
  await page.getByRole("menuitem", { name: /^Preferences/ }).click();
  const general = page.getByRole("region", { name: "General" }).last();
  await general.getByRole("combobox", { name: "Start week on:" }).waitFor({ timeout: 10_000 });
  const monday = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      pathOf(response.url()) === SETTINGS &&
      JSON.parse(response.request().postData() ?? "{}").settings?.weekStartsOn === 1,
    { timeout: 15_000 },
  );
  await choose(page, general, "Start week on:", "Monday");
  step("Preferences: the week is made to start on Monday, saved", (await monday).status() === 200);
  step(
    "the Calendar window's week starts on Monday",
    /^\s*Mon/.test((await firstDay(window).textContent()) ?? ""),
    (await firstDay(window).textContent()) ?? "",
  );
  step(
    "the alternate calendar can be chosen, and Help opens its guide",
    (await general.getByRole("checkbox", { name: "Show alternate calendar:" }).isEnabled()) &&
      (await general.getByRole("button", { name: "Help" }).isEnabled()),
  );
  await page.getByRole("tab", { name: "Alerts" }).click();
  const alertsPane = page.getByRole("region", { name: "Alerts" }).last();
  step(
    "the Alerts pane offers default alerts, and dims Time to Leave, saying why",
    (await alertsPane.getByRole("combobox", { name: "Events:", exact: true }).isEnabled()) &&
      (await alertsPane.getByRole("checkbox", { name: "Time to Leave" }).isDisabled()) &&
      ((await alertsPane.textContent()) ?? "").includes("Time to Leave needs the time of the trip"),
  );
  await alertsPane.getByRole("button", { name: "Close" }).click();
  await alertsPane.waitFor({ state: "detached", timeout: 5_000 });

  // A reload keeps every change. From the page's first moment, every week the Calendar window
  // draws where it can be seen is noted by its first day, so that a frame laid out from another
  // first day than the stored one, however short, is caught.
  await page.addInitScript(() => {
    const seen = [];
    Object.defineProperty(window, "__calendarFirstDays", { value: seen });
    const note = () => {
      const body = document.querySelector(".mac-calendar-body");
      if (!body || getComputedStyle(body).visibility === "hidden") return;
      const first = body.querySelector(".mac-calendar-week-grid-day")?.textContent?.trim();
      if (first && seen.at(-1) !== first) seen.push(first);
    };
    new MutationObserver(note).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
  });
  await page.reload({ waitUntil: "load" });
  await finder(page).waitFor({ timeout: 20_000 });
  const again = await openCalendar(page);
  await block(again, trip).waitFor({ timeout: 10_000 });
  const stored = await events(page);
  const storedMeet = named(stored, meet);
  const storedTrip = named(stored, trip);
  step(
    "after a reload the location, the move, the all-day weekly event and the deletion are kept",
    storedMeet?.location === "Room 4" &&
      storedMeet?.start === meetStart &&
      storedTrip?.allDay === true &&
      storedTrip?.repeat?.freq === "weekly" &&
      !named(stored, drop) &&
      (await block(again, trip).isVisible()),
    JSON.stringify(stored.map((event) => event.title)),
  );
  const storedPrefs = (await api(page, "GET", SETTINGS)).json?.settings;
  step(
    "and the window reads the stored preferences itself: its week starts on Monday",
    storedPrefs?.weekStartsOn === 1 && /^\s*Mon/.test((await firstDay(again).textContent()) ?? ""),
    (await firstDay(again).textContent()) ?? "",
  );
  const drawn = await page.evaluate(() => [...(globalThis.__calendarFirstDays ?? [])]);
  step(
    "from its first visible frame after the reload, every week it drew starts on Monday",
    drawn.length > 0 && drawn.every((first) => /^Mon/.test(first)),
    JSON.stringify(drawn),
  );

  // Another account has none of it.
  const annaPage = await enter(browser, anna, "anna");
  pages.push(annaPage);
  const annaWindow = await openCalendar(annaPage);
  const annaEvents = await events(annaPage);
  step(
    "Anna's calendar holds none of Chris's events, on the server or in her window",
    !annaEvents.some((event) => event.title.includes(run)) &&
      (await annaWindow
        .getByRole("button", { name: new RegExp(`^(Trip|Meet) ${run}`) })
        .count()) === 0,
    `${annaEvents.length} events of her own`,
  );
  const annaPrefs = await api(annaPage, "GET", SETTINGS);
  step(
    "and none of his preferences: her week starts on Sunday",
    annaPrefs.status === 200 &&
      annaPrefs.json?.settings === null &&
      /^\s*Sun/.test((await firstDay(annaWindow).textContent()) ?? ""),
    (await firstDay(annaWindow).textContent()) ?? "",
  );

  // A second browser of Chris's hears of the first's change without a reload.
  const pageB = await enter(browser, chris, "chris-b", true);
  pages.push(pageB);
  const windowB = await openCalendar(pageB);
  await block(windowB, trip).waitFor({ timeout: 10_000 });
  step(
    "the second browser shows Chris's events, its week starting on Monday",
    (await block(windowB, trip).isVisible()) &&
      /^\s*Mon/.test((await firstDay(windowB).textContent()) ?? ""),
  );
  step("the first browser adds another event", await addEvent(page, again, live));
  await closePopover(page);
  const heard = await block(windowB, live)
    .waitFor({ timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  step("the second browser shows it without a reload", heard);

  // The first browser stops hearing of changes: its copy goes stale.
  cut.add(page);
  await page.route("**/live/**", (route) => route.abort("aborted"));
  await page.reload({ waitUntil: "load" });
  await finder(page).waitFor({ timeout: 20_000 });
  const stale = await openCalendar(page);
  await block(stale, trip).waitFor({ timeout: 10_000 });
  conflictsExpected = true;
  step("the second browser adds an event", await addEvent(pageB, windowB, fromB));
  await closePopover(pageB);
  await block(stale, trip).dblclick();
  await popover(page).waitFor({ timeout: 5_000 });
  const refused = nextSave(page, anySave, 409);
  const replayed = nextSave(page, (body) => named(body.events ?? [], trip)?.location === "Beach");
  await setLocation(page, "Beach");
  await refused;
  await replayed;
  const both = await events(page);
  step(
    "the first browser's change on an older copy meets a 409 and is made again: both kept",
    named(both, trip)?.location === "Beach" &&
      named(both, trip)?.allDay === true &&
      Boolean(named(both, fromB)) &&
      Boolean(named(both, live)),
    JSON.stringify(both.map((event) => [event.title, event.location ?? ""])),
  );
  const shownB = await block(stale, fromB)
    .waitFor({ timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  step("the first window shows the second's event", shownB);
  step(
    "and its popover stayed open on the event being changed",
    (await popover(page).isVisible()) &&
      ((await popover(page).textContent()) ?? "").includes("Beach"),
  );
  step("no alert says a change was lost", (await page.getByRole("alertdialog").count()) === 0);
  await closePopover(page);

  // The second deletes its event; the first changes it on its older copy: it stays deleted.
  await block(windowB, fromB).click();
  const deletedB = nextSave(pageB, (body) => !named(body.events ?? [], fromB));
  await pageB.keyboard.press("Delete");
  step("the second browser deletes its event", (await deletedB).status() === 200);
  await block(stale, fromB).dblclick();
  await popover(page).waitFor({ timeout: 5_000 });
  const refusedAgain = nextSave(page, anySave, 409);
  await setLocation(page, "Nowhere", true);
  step("the first browser's change of it meets a 409", (await refusedAgain).status() === 409);
  const gone = await block(stale, fromB)
    .waitFor({ state: "detached", timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  const final = await events(page);
  step(
    "the deleted event stays deleted, on the server and in the first window",
    gone && !named(final, fromB) && named(final, trip)?.location === "Beach",
    JSON.stringify(final.map((event) => event.title)),
  );
  // The person is told the change was not kept: it was to an event deleted elsewhere.
  const told = page.getByRole("alertdialog");
  if (await told.isVisible().catch(() => false)) {
    console.log(`note: ${((await told.textContent()) ?? "").replace(/\s+/g, " ").trim()}`);
    await told.getByRole("button").first().click();
  }
  conflictsExpected = false;
  await shot(page, path.join(out, `calendar-sync-${browserName}-conflicts.png`));

  if (keep) {
    writeFileSync(
      `${keep}-${browserName}.json`,
      JSON.stringify({
        run,
        meet,
        meetStart,
        trip,
        live,
        drop,
        fromB,
        chris: await page.context().storageState(),
        anna: await annaPage.context().storageState(),
      }),
    );
  }
} catch (error) {
  problems.push(`journey aborted: ${error instanceof Error ? error.message : error}`);
  for (const [index, page] of pages.entries())
    await shot(page, path.join(out, `calendar-sync-${browserName}-aborted-${index}.png`));
} finally {
  await browser.close();
}
if (problems.length > 0) {
  console.error(
    `\ncalendar sync: ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`,
  );
  process.exit(1);
}
console.log(`\ncalendar sync: all ${steps.length} steps passed with no console errors`);

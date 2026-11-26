#!/usr/bin/env node
// Reminders on Ferrite: open Reminders from the Dock, add a reminder due
// today, and show its alert fire when Ferrite's clock passes 9:00. Then close
// the alert, reload the page, open Reminders again and find the reminder,
// saved in the session through /api/reminders/data. Then: a reminder typed as
// "… today 3pm" is saved due today at 15:00 and alerts then; and a weekly
// reminder due today is moved a week on by Complete in its alert, and another
// week by completing it in the window. Last, the person's lists: Show Info in a
// list's contextual menu renames and recolours one, File > New Reminder in the
// menu bar adds to it, View > Show Completed shows a completed reminder again so
// it can be made to do again, File > New List adds a list and Delete (once asked)
// removes it; after a reload all of it is as left, and another browser's guest
// has none of it. Exits 0 only when every step passed and
// the page logged no console error, page error or failed request.
//
// This journey drives the clock, so it needs `ferrite dev` started with
// `--clock-ms`: plain `ferrite dev` runs on the real clock, and only with
// `--clock-ms` is the clock a manual one that `POST /__forge/clock` advances.
//
//   ferrite dev --clock-ms $(date +%s000)         # in ferrite-apps/desktop
//   node e2e/reminders-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//
// The journey sets the clock to 8:00 today (local time), checks that no alert
// is shown, advances the clock two hours through `POST /__forge/clock`, and
// waits for the alert. A reminder due on a day alerts at 9:00 that day.
//
// A hosted app has no clock to drive, so `--live` waits for the platform's real
// clock instead:
//
//   node e2e/reminders-journey.mjs --live --url https://<app host> [--browser …]
//
// The browser computes the alert as 9:00 on the due day in its own time zone, so
// the journey picks the time zone whose clocks next show 9:00 (at least 90 s
// ahead), waits until 90 s before that instant, and runs the browser in that
// zone. The zones are named canonically (`ZONES`), so Chromium, Firefox and
// WebKit all accept them, and the browser's zone is checked by its offset from
// UTC at 9:00, since WebKit may report another name for the same zone. The
// reminder is then due today with its alert about a minute ahead, no alert
// shows before 9:00, and the alert fires when the platform's clock passes it.
// In that mode the 15:00 alert is checked as saved, not waited for.

import path from "node:path";
import {
  api,
  journey,
  launch,
  nextResponse,
  openDesktop,
  options,
  reloadDesktop,
  shot,
} from "./app-journey.mjs";

const { base, out } = options();
const live = process.argv.includes("--live");
const title = `Reminders on Ferrite ${Date.now()}`;
/** What makes this run's records its own. */
const tag = Date.now().toString(36);
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
/** The hour of the due day at which a reminder alerts (ALERT_HOUR in demos/reminders/reminders-sync.ts). */
const ALERT_HOUR = 9;
/** How long before the alert a live run starts the browser: enough to add the reminder and see no alert. */
const LEAD = 90 * 1000;
/**
 * The zones a live run picks from, by their canonical IANA names: Node's own list holds legacy
 * names ("Asia/Katmandu", "Asia/Calcutta") that Firefox refuses. One zone without daylight saving
 * time for every whole-hour offset from UTC-11 to UTC+14, so some zone's clocks show 9:00 within
 * the hour, and the zones of the half- and quarter-hour offsets, which shorten the wait.
 */
const ZONES = [
  "Pacific/Pago_Pago",
  "Pacific/Honolulu",
  "Pacific/Marquesas",
  "Pacific/Gambier",
  "Pacific/Pitcairn",
  "America/Phoenix",
  "America/Regina",
  "America/Bogota",
  "America/La_Paz",
  "America/St_Johns",
  "America/Sao_Paulo",
  "America/Noronha",
  "Atlantic/Cape_Verde",
  "Africa/Abidjan",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Europe/Moscow",
  "Asia/Tehran",
  "Asia/Dubai",
  "Asia/Kabul",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Dhaka",
  "Asia/Yangon",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Darwin",
  "Australia/Brisbane",
  "Pacific/Noumea",
  "Pacific/Tarawa",
  "Pacific/Tongatapu",
  "Pacific/Kiritimati",
];

/** The offset of `zone` from UTC at `instant`, in ms, or null when it is not whole minutes. */
function offsetOf(zone, instant) {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" })
      .formatToParts(instant)
      .find((part) => part.type === "timeZoneName")?.value ?? "";
  const match = /^GMT(?:([+-])(\d{2}):(\d{2}))?$/.exec(name);
  if (!match) return null;
  if (!match[1]) return 0;
  const ms = (Number(match[2]) * 60 + Number(match[3])) * MINUTE;
  return match[1] === "-" ? -ms : ms;
}

/** The first instant from `after` at which some time zone's clocks show 9:00: `{ zone, at }`. */
function nextNine(after) {
  let best = null;
  for (const zone of ZONES) {
    const offset = offsetOf(zone, after);
    if (offset === null) continue;
    // The zone's calendar day at `after`, read from a date shifted by its offset.
    const local = new Date(after + offset);
    for (const day of [0, 1]) {
      const nine = Date.UTC(
        local.getUTCFullYear(),
        local.getUTCMonth(),
        local.getUTCDate() + day,
        ALERT_HOUR,
      );
      // The offset in force at 9:00 itself, which a change of offset since `after` moves.
      const then = offsetOf(zone, nine - offset);
      if (then === null) continue;
      const at = nine - then;
      // A 9:00 that a change of offset skips is no candidate.
      if (offsetOf(zone, at) !== then) continue;
      if (at >= after && (best === null || at < best.at)) best = { zone, at };
    }
  }
  return best;
}

let nine = 0;
let zone = "";
if (live) {
  ({ zone, at: nine } = nextNine(Date.now() + LEAD));
  const wait = nine - LEAD - Date.now();
  console.log(
    `live: 9:00 in ${zone} is ${new Date(nine).toISOString()}; starting in ${Math.max(0, Math.round(wait / 1000))} s`,
  );
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}

const inZone = { timezoneId: zone };
const { step, run } = journey(
  "reminders",
  live ? { contextOptions: { chromium: inZone, firefox: inZone, webkit: inZone } } : {},
);

/** Drive Forge's clock: `{ set_ms }` or `{ advance_ms }`; answers the clock's new instant. */
async function clock(change) {
  const response = await fetch(`${base}/__forge/clock`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(change),
  });
  return (await response.json()).now_ms;
}

/** A reminder's alert, as the Reminders window shows it under the menu bar. */
const pageAlert = (page, text) =>
  page.getByRole("alert", { name: "Reminders" }).filter({ hasText: text });
const alertOf = (page) => pageAlert(page, title);
/** The next dismissal of reminder `id`'s alert. */
const dismissalOf = (page, id) =>
  page.waitForResponse(
    (response) => {
      const pathname = new URL(response.url()).pathname;
      return (
        response.request().method() === "POST" &&
        pathname.startsWith(`/api/reminders/alerts/${id}`) &&
        pathname.endsWith("/dismiss")
      );
    },
    { timeout: 10_000 },
  );
const seconds = (ms) => `${Math.round(ms / 1000)} s`;

/** Whether `response` answers a save of the person's own reminders. */
const isSave = (response) =>
  response.request().method() === "PUT" &&
  new URL(response.url()).pathname === "/api/reminders/data";
/** The body a save sent. */
const sentOf = (response) => JSON.parse(response.request().postData() ?? "{}");
/** The next save in which the reminder titled `name` satisfies `test`. */
function saveOf(page, name, test = () => true) {
  const save = page.waitForResponse(
    (response) => {
      if (!isSave(response)) return false;
      const reminder = sentOf(response).data?.reminders?.find((each) => each.title === name);
      return reminder !== undefined && test(reminder);
    },
    { timeout: 10_000 },
  );
  // Awaited by the step that needs it; if an earlier step fails first, its error is the one
  // reported, not this wait's.
  save.catch(() => undefined);
  return save;
}

/** Dates in the browser's own zone: today and a week and two on, and the instant of 15:00. */
function browserDates(page) {
  return page.evaluate(() => {
    const now = new Date();
    const day = (offset) => {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      const two = (value) => `${value}`.padStart(2, "0");
      return {
        day: `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`,
        // As a row writes a day that is not near: 10/19/26.
        label: `${date.getMonth() + 1}/${date.getDate()}/${two(date.getFullYear() % 100)}`,
      };
    };
    return {
      today: day(0),
      week: day(7),
      fortnight: day(14),
      three: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15).getTime(),
    };
  });
}

await run(async (page) => {
  if (live) {
    // The browser's offset from UTC at 9:00 in the chosen zone, as its own clock reads it: the
    // same zone, whatever name the engine gives it.
    const browser = await page.evaluate(
      (at) => ({
        offset: -new Date(at).getTimezoneOffset() * 60_000,
        name: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
      nine,
    );
    step(
      "the browser's clocks show 9:00 in about a minute, on the platform's real clock",
      browser.offset === offsetOf(zone, nine) && nine - Date.now() > 30_000,
      `${zone} (the browser says ${browser.name}), 9:00 at ${new Date(nine).toISOString()}, in ${seconds(nine - Date.now())}`,
    );
  } else {
    const now = new Date();
    const eight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8).getTime();
    nine = eight + HOUR;
    const set = await clock({ set_ms: eight });
    if (
      !step(
        "Forge's clock is virtual and set to 8:00 today",
        set === eight,
        new Date(set).toString(),
      )
    ) {
      throw new Error(
        "start ferrite dev with --clock-ms <epoch ms> so that its clock can be driven, or pass --live",
      );
    }
  }

  await openDesktop(page, base, step);
  await launch(page, "Reminders");
  const window = page.getByRole("region", { name: "Reminders" });
  await window.getByRole("button", { name: "New Reminder" }).waitFor({ timeout: 10_000 });
  step("Reminders opens from the Dock", await window.isVisible());

  // A new reminder, then "remind me On a Day" in its info popover: due today.
  await window.getByRole("button", { name: "New Reminder" }).click();
  await page.keyboard.type(title);
  await page.keyboard.press("Enter");
  const row = window.getByRole("option").filter({ hasText: title });
  await row.waitFor({ timeout: 5_000 });
  await row.hover();
  await row.locator("[data-reminder-info]").click();
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === "/api/reminders/data" &&
      Object.keys(JSON.parse(response.request().postData() ?? "{}").alerts ?? {}).length > 0,
    { timeout: 10_000 },
  );
  await page.getByRole("checkbox", { name: "On a Day" }).click();
  const put = await saved;
  await page.keyboard.press("Escape");
  const body = JSON.parse(put.request().postData() ?? "{}");
  const reminder = body.data.reminders.find((each) => each.title === title);
  const at = body.alerts[reminder?.id];
  step(
    "the reminder is saved due today, with its alert at 9:00",
    put.status() === 200 && at === nine,
    `HTTP ${put.status()}, alert at ${at ? new Date(at).toISOString() : "none"}`,
  );

  // Before 9:00 by Ferrite's clock: the window asks every 5 s and is told of no alert.
  const polled = nextResponse(page, "GET", "/api/reminders/alerts");
  await polled;
  await nextResponse(page, "GET", "/api/reminders/alerts");
  step(
    "before 9:00 no alert is shown",
    (await alertOf(page).count()) === 0 && (!live || Date.now() < nine),
    live ? `${seconds(nine - Date.now())} before 9:00` : "at 8:00",
  );
  await shot(page, path.join(out, "reminders-before-due.png"));

  if (live) {
    // Nothing drives the clock: the platform's own clock passes 9:00.
    await alertOf(page).waitFor({ timeout: Math.max(0, nine - Date.now()) + MINUTE });
  } else {
    const later = await clock({ advance_ms: 2 * HOUR });
    step("Forge's clock is advanced to 10:00", later === nine + HOUR);
    await alertOf(page).waitFor({ timeout: 15_000 });
  }
  step(
    "the reminder's alert fires once Ferrite's clock passes 9:00",
    (await alertOf(page).isVisible()) && (!live || Date.now() >= nine),
    live ? `shown ${seconds(Date.now() - nine)} after 9:00` : "",
  );
  const alerts = await api(page, "GET", "/api/reminders/alerts");
  step(
    "GET /api/reminders/alerts lists it",
    alerts.json.alerts?.some((each) => each.title === title && each.at === at),
  );
  await shot(page, path.join(out, "reminders-alert.png"));

  const dismissed = dismissalOf(page, reminder.id);
  await alertOf(page).getByRole("button", { name: "Close" }).click();
  step("closing the alert dismisses it on the server", (await dismissed).status() === 200);

  await reloadDesktop(page);
  await launch(page, "Reminders");
  const kept = page
    .getByRole("region", { name: "Reminders" })
    .getByRole("option")
    .filter({ hasText: title });
  await kept.waitFor({ timeout: 10_000 });
  step("after a reload, the reminder is still in its list", (await kept.count()) === 1);
  await nextResponse(page, "GET", "/api/reminders/alerts");
  step("and its closed alert does not come back", (await alertOf(page).count()) === 0);
  await shot(page, path.join(out, "reminders.png"));

  // `window` is the Reminders window found before the reload: the locator finds it again.
  const dates = await browserDates(page);

  // A due minute, typed the way Reminders reads it: "today 3pm".
  const timed = `Call Martin ${tag}`;
  const timedSave = saveOf(page, timed);
  await window.getByRole("button", { name: "New Reminder" }).click();
  await page.keyboard.type(`${timed} today 3pm`);
  await page.keyboard.press("Enter");
  const timedPut = await timedSave;
  const timedBody = sentOf(timedPut);
  const timedReminder = timedBody.data.reminders.find((each) => each.title === timed);
  step(
    'a reminder typed "… today 3pm" is saved due today at 15:00, with its alert then',
    timedPut.status() === 200 &&
      timedReminder?.due === dates.today.day &&
      timedReminder?.dueTime === "15:00" &&
      timedBody.alerts[timedReminder.id] === dates.three,
    JSON.stringify({ reminder: timedReminder, alert: timedBody.alerts[timedReminder?.id] }),
  );
  const timedRow = window.getByRole("option").filter({ hasText: timed });
  await timedRow.waitFor({ timeout: 5_000 });
  step(
    "its row says when it is due",
    (await timedRow.textContent())?.includes("Today, 3:00 PM"),
    await timedRow.textContent(),
  );
  await timedRow.hover();
  await timedRow.locator("[data-reminder-info]").click();
  step(
    "its info popover has On a Day and At a Time checked, with the date and the minute",
    (await page.getByRole("checkbox", { name: "On a Day" }).isChecked()) &&
      (await page.getByRole("checkbox", { name: "At a Time" }).isChecked()) &&
      (await page.getByRole("group", { name: "Date" }).isVisible()) &&
      (await page.getByRole("group", { name: "Time" }).isVisible()),
  );
  await shot(page, path.join(out, "reminders-due-time.png"));
  await page.keyboard.press("Escape");
  const timedAlert = pageAlert(page, timed);
  if (!live) {
    const now = await clock({ advance_ms: 0 });
    const later = await clock({ advance_ms: Math.max(0, dates.three - now) });
    await timedAlert.waitFor({ timeout: 15_000 });
    step(
      "its alert fires at 15:00 by Ferrite's clock",
      later >= dates.three && (await timedAlert.isVisible()),
      new Date(later).toString(),
    );
    const closed = dismissalOf(page, timedReminder.id);
    await timedAlert.getByRole("button", { name: "Close" }).click();
    step("closing it dismisses it", (await closed).status() === 200);
  }

  // A weekly reminder due today. Its alert, at 9:00, has passed by Ferrite's clock, so it shows
  // at the window's next poll: Complete in it moves the reminder a week on and keeps it to do.
  // Completing it in the window then moves it another week.
  const bins = `Put the bins out ${tag}`;
  const binsSave = saveOf(page, bins);
  await window.getByRole("button", { name: "New Reminder" }).click();
  await page.keyboard.type(bins);
  await page.keyboard.press("Enter");
  const binsId = sentOf(await binsSave).data.reminders.find((each) => each.title === bins)?.id;
  const binsRow = window.getByRole("option").filter({ hasText: bins });
  await binsRow.hover();
  await binsRow.locator("[data-reminder-info]").click();
  const dated = saveOf(page, bins, (reminder) => reminder.due === dates.today.day);
  await page.getByRole("checkbox", { name: "On a Day" }).click();
  await dated;
  const weekly = saveOf(page, bins, (reminder) => reminder.repeat === "weekly");
  await page.getByRole("combobox", { name: "repeat" }).click();
  await page.getByRole("option", { name: "Every Week", exact: true }).click();
  const weeklyPut = await weekly;
  step("Every Week is saved as the reminder's repeat", weeklyPut.status() === 200);
  await page.keyboard.press("Escape");
  const binsAt = sentOf(weeklyPut).alerts?.[binsId];
  if (!live) {
    const now = await clock({ advance_ms: 0 });
    if (binsAt > now) await clock({ advance_ms: binsAt - now });
  }
  const binsAlert = pageAlert(page, bins);
  await binsAlert.waitFor({ timeout: 15_000 });
  step(
    "its alert shows, with Close and Complete",
    (await binsAlert.getByRole("button", { name: "Close" }).isVisible()) &&
      (await binsAlert.getByRole("button", { name: "Complete" }).isVisible()),
    binsAt ? new Date(binsAt).toString() : "no alert saved",
  );
  const weekOn = saveOf(
    page,
    bins,
    (reminder) => reminder.due === dates.week.day && reminder.completed !== true,
  );
  const binsDismissed = dismissalOf(page, binsId);
  await binsAlert.getByRole("button", { name: "Complete" }).click();
  const weekPut = await weekOn;
  step(
    "Complete in its alert moves it a week on, keeps it to do, and dismisses the alert",
    weekPut.status() === 200 &&
      (await binsDismissed).status() === 200 &&
      sentOf(weekPut).alerts?.[binsId] > binsAt,
    JSON.stringify(sentOf(weekPut).data.reminders.find((each) => each.id === binsId)),
  );
  await binsRow.filter({ hasText: dates.week.label }).waitFor({ timeout: 15_000 });
  step("its row says the day a week on", true, dates.week.label);
  const moved = saveOf(
    page,
    bins,
    (reminder) => reminder.due === dates.fortnight.day && reminder.completed !== true,
  );
  await binsRow.locator("[data-reminder-toggle]").click();
  const movedPut = await moved;
  step(
    "completing it in the window moves it another week on and keeps it to do",
    movedPut.status() === 200 && (await binsRow.textContent())?.includes(dates.fortnight.label),
    await binsRow.textContent(),
  );
  await shot(page, path.join(out, "reminders-repeat.png"));

  // The person's lists. A list from Add List is renamed and recoloured in its Info.
  const errands = `Errands ${tag}`;
  const stamps = `Buy stamps ${tag}`;
  // The page's API requests under way: a reload waits until none is, so it never cuts one short
  // (a read of the shared lists that follows a save, say), which would count as a failed request.
  const inflight = new Set();
  let started = 0;
  const api_ = (request) => new URL(request.url()).pathname.startsWith("/api/");
  page.on("request", (request) => {
    if (!api_(request)) return;
    started += 1;
    inflight.add(request);
  });
  page.on("requestfinished", (request) => inflight.delete(request));
  page.on("requestfailed", (request) => inflight.delete(request));
  /** Resolves once `quietMs` pass with no API request under way or started; throws after 20 s. */
  const settled = async (quietMs = 300) => {
    const until = Date.now() + 20_000;
    for (;;) {
      const mark = started;
      if (inflight.size === 0) {
        await page.waitForTimeout(quietMs);
        if (inflight.size === 0 && started === mark) return;
      } else {
        await page.waitForTimeout(100);
      }
      if (Date.now() > until) {
        throw new Error(
          `API requests still under way: ${[...inflight].map((request) => request.url()).join(", ")}`,
        );
      }
    }
  };
  /** The next save whose document satisfies `test`. */
  const saveWhere = (test) => {
    const save = page.waitForResponse((response) => isSave(response) && test(sentOf(response)), {
      timeout: 10_000,
    });
    save.catch(() => undefined);
    return save;
  };
  const listRow = (name) => window.getByRole("treeitem", { name: new RegExp(`^${name}\\s*\\d+$`) });
  const menuBar = (title) =>
    page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
  await window.getByText("Add List").click();
  const fresh = listRow("New List");
  await fresh.waitFor({ timeout: 5_000 });
  await fresh.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Show Info" }).click();
  const info = page.getByRole("dialog", { name: "List Info" });
  await info.waitFor({ timeout: 5_000 });
  await info.getByRole("textbox", { name: "Name:" }).fill("");
  step(
    "List Info says why an empty name cannot be kept",
    (await info.getByRole("alert").textContent())?.includes("A list needs a name."),
  );
  await info.getByRole("textbox", { name: "Name:" }).fill(errands);
  await info.getByRole("button", { name: "Orange" }).click();
  const renamed = saveWhere((sent) =>
    sent.data.lists.some((list) => list.name === errands && list.color === "orange"),
  );
  await info.getByRole("button", { name: "OK" }).click();
  const renamedPut = await renamed;
  const errandsId = sentOf(renamedPut).data.lists.find((list) => list.name === errands)?.id;
  step("Show Info renames and recolours a list, and saves it", renamedPut.status() === 200);

  // File > New Reminder in the menu bar adds to the list shown, which is now Errands.
  await listRow(errands).click();
  const stampsSave = saveOf(page, stamps, (reminder) => reminder.listId === errandsId);
  await menuBar("File").click();
  await page.getByRole("menuitem", { name: "New Reminder" }).click();
  await window.getByRole("textbox", { name: "Title" }).waitFor({ timeout: 5_000 });
  await page.keyboard.type(stamps);
  await page.keyboard.press("Enter");
  step(
    "File > New Reminder adds a reminder to the list shown",
    (await stampsSave).status() === 200,
  );

  // Completed, it leaves the list once the list is shown again; View > Show Completed brings it
  // back, and a click on its circle makes it to do again.
  const stampsRow = window.getByRole("option").filter({ hasText: stamps });
  const done = saveOf(page, stamps, (reminder) => reminder.completed === true);
  await stampsRow.locator("[data-reminder-toggle]").click();
  await done;
  await listRow("Work").click();
  await listRow(errands).click();
  step("a completed reminder leaves its list", (await stampsRow.count()) === 0);
  await menuBar("View").click();
  await page.getByRole("menuitemcheckbox", { name: /Show Completed/ }).click();
  await stampsRow.waitFor({ timeout: 5_000 });
  step("View > Show Completed shows it again", (await stampsRow.count()) === 1);
  const undone = saveOf(page, stamps, (reminder) => reminder.completed !== true);
  await stampsRow.locator("[data-reminder-toggle]").click();
  step("a click on its circle makes it to do again, and saves it", (await undone).status() === 200);

  // File > New List adds a list; Delete in its contextual menu asks, then removes it.
  const added = saveWhere((sent) => sent.data.lists.some((list) => list.name === "New List"));
  await menuBar("File").click();
  await page.getByRole("menuitem", { name: "New List" }).click();
  const addedPut = await added;
  const spareId = sentOf(addedPut).data.lists.find((list) => list.name === "New List")?.id;
  step(
    "File > New List adds a list and shows it",
    (await listRow("New List").getAttribute("aria-selected")) === "true",
  );
  await listRow("New List").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const ask = page.getByRole("alertdialog");
  await ask.waitFor({ timeout: 5_000 });
  step(
    "Delete asks before it removes a list",
    (await ask.textContent())?.includes("Are you sure you want to delete the list"),
  );
  const removed = saveWhere((sent) => !sent.data.lists.some((list) => list.id === spareId));
  await ask.getByRole("button", { name: "Delete" }).click();
  step("and saves the lists without it", (await removed).status() === 200);
  await shot(page, path.join(out, "reminders-lists.png"));

  // After a reload, every change is as it was left, read back from the server.
  await settled();
  await reloadDesktop(page);
  await launch(page, "Reminders");
  await listRow(errands).waitFor({ timeout: 10_000 });
  step(
    "after a reload the renamed list keeps its name and colour",
    (await listRow(errands).locator(".mac-reminders-disc").getAttribute("data-color")) === "orange",
  );
  await listRow(errands).click();
  step("its reminder is to do", (await stampsRow.count()) === 1);
  step(
    "and the deleted list stays deleted",
    (await window.getByRole("treeitem", { name: /^New List/ }).count()) === 0,
  );
  const stored = await api(page, "GET", "/api/reminders/data");
  step(
    "the server holds the renamed list and not the deleted one",
    stored.json.data.lists.some((list) => list.id === errandsId && list.color === "orange") &&
      !stored.json.data.lists.some((list) => list.id === spareId),
  );

  // Another browser's guest has none of it.
  const other = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const otherPage = await other.newPage();
    await openDesktop(otherPage, base, () => true);
    const theirs = await api(otherPage, "GET", "/api/reminders/data");
    step(
      "another browser's guest has none of this person's lists",
      !JSON.stringify(theirs.json).includes(tag),
    );
  } finally {
    await other.close();
  }

  // Another browser of the same person, in another time zone: the 15:00 reminder is listed at that
  // moment on its clocks, and a save from there leaves its alert's instant where it was. The zone
  // is one whose clocks show another minute than this browser's at that instant.
  const ownZone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const minuteIn = (zone) =>
    new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" }).format(
      dates.three,
    );
  const farZone = ["Asia/Tokyo", "America/New_York", "Pacific/Auckland"].find(
    (zone) => minuteIn(zone) !== minuteIn(ownZone),
  );
  const far = await page
    .context()
    .browser()
    .newContext({
      viewport: { width: 1440, height: 900 },
      timezoneId: farZone,
      storageState: await page.context().storageState(),
    });
  try {
    const farPage = await far.newPage();
    await openDesktop(farPage, base, () => true);
    await launch(farPage, "Reminders");
    const farWindow = farPage.getByRole("region", { name: "Reminders" });
    await farWindow.getByRole("button", { name: /^All \d+$/ }).click();
    const farRow = farWindow.getByRole("option").filter({ hasText: timed });
    await farRow.waitFor({ timeout: 10_000 });
    const expected = minuteIn(farZone);
    const farText = (await farRow.textContent()) ?? "";
    step(
      `in ${farZone}, the 15:00 reminder is listed at that moment on its clocks`,
      farText.includes(expected),
      `${farText}; expected ${expected} (this browser: ${ownZone}, ${minuteIn(ownZone)})`,
    );
    const farSave = farPage.waitForResponse(isSave, { timeout: 10_000 });
    // The first browser hears of that save on the person's stream and reads its shared lists
    // again; the journey waits for that read, so ending it cuts nothing short.
    const heard = page
      .waitForResponse((response) => new URL(response.url()).pathname === "/api/reminders/shared", {
        timeout: 15_000,
      })
      .catch(() => null);
    await farWindow.getByRole("button", { name: "New Reminder" }).click();
    await farPage.keyboard.type(`From ${farZone} ${tag}`);
    await farPage.keyboard.press("Enter");
    const farPut = await farSave;
    const farSent = sentOf(farPut);
    step(
      "a save from that browser keeps the reminder's zone and its alert's instant",
      farPut.status() === 200 &&
        farSent.alerts?.[timedReminder.id] === dates.three &&
        farSent.data.reminders.find((each) => each.id === timedReminder.id)?.timeZone ===
          timedReminder.timeZone,
      `alert ${new Date(farSent.alerts?.[timedReminder.id] ?? 0).toISOString()}, expected ${new Date(dates.three).toISOString()}; zone ${timedReminder.timeZone}`,
    );
    await heard;
  } finally {
    await far.close();
  }
  // Nothing the page asked for is cut short when the journey closes it (a read of the shared
  // lists after the reload takes longest in WebKit).
  await settled(1_000);
});

#!/usr/bin/env node
// Calendar on Ferrite. Chris creates an account in a browser of his own. In his
// Calendar the journey checks that the views show today by the real clock, adds
// an event from the toolbar and names it in its popover, makes it repeat every
// week and finds it next week, finds it in the search results, adds a second
// event and deletes it with the Delete key, and makes a calendar of his own from
// the list's contextual menu. After a reload, the event, its weekly repeat
// (stored and shown next week), the deletion and the calendar are all kept.
// Then Work is exported as an iCalendar file that holds the event, and imported
// again, which adds nothing. Last, a second account, Anna, signs up in a browser
// of her own; Chris invites her by account name from the event's popover, she
// finds it in her Invitations calendar and accepts, and Chris reads her answer.
// The
// other editors, repeat kinds and endings, removed occurrences and moving a
// series are covered by the unit tests in demos/calendar, not here.
//
// Exits 0 only when every step passed and no page logged a console error, a
// page error, a failed request or an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/calendar-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                 [--browser chromium|chrome|firefox|webkit]
//
// The account is made fresh for each run (`chris-cal-<run>`),
// so it runs again against the same deployment, local or hosted, on the
// platform's real clock. It takes well under a minute.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { options, shot } from "./app-journey.mjs";
import { ENGINES } from "./journey-kit.mjs";

const { base, out, browserName } = options();
const run = Date.now().toString(36);
const password = `tide-${run}-pool`;
const chris = { name: `chris-cal-${run}`, fullName: "Chris Cal" };
const anna = { name: `anna-cal-${run}`, fullName: "Anna Cal" };
const planning = `Planning ${run}`;
const spare = `Spare ${run}`;
const URL = "/api/calendar/events";

const problems = [];
const steps = [];
const step = (label, ok, detail = "") => {
  steps.push(label);
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`);
  if (!ok) problems.push(label);
  return ok;
};

function watch(page, label) {
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`${label} console: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`${label} page error: ${error.message}`));
  page.on("requestfailed", (request) => {
    const text = request.failure()?.errorText ?? "";
    // `ferrite dev`'s live-reload stream and the page's own requests cut short by a reload.
    if (/ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(text)) return;
    problems.push(`${label} request failed: ${request.url()} ${text}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400)
      problems.push(
        `${label} HTTP ${response.status()} ${new globalThis.URL(response.url()).pathname}`,
      );
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

/** A fresh browser signed up as `person`, on its desktop. */
async function signUp(browser, person, label) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
    acceptDownloads: true,
  });
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
  step(`${person.fullName}'s desktop opens`, await finder(page).isVisible());
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
  // The saved events are in once the content is no longer inert.
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
      new globalThis.URL(response.url()).pathname === URL &&
      accept(JSON.parse(response.request().postData() ?? "{}")),
    { timeout: 15_000 },
  );

const block = (window, title) =>
  window.getByRole("button", { name: new RegExp(`^${title}, `) }).first();
const popover = (page) => page.locator(".mac-calendar-popover").first();

async function choose(page, scope, name, option) {
  await scope.getByRole("combobox", { name }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

const browser = await ENGINES[browserName].launch();
console.log(`calendar in ${browserName}`);
/** The pages, for a screenshot when the journey stops early. */
const pages = [];
try {
  const page = await signUp(browser, chris, "chris");
  pages.push(page);

  const window = await openCalendar(page);
  step("Calendar opens from the Dock", await window.isVisible());
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  const marked = await window
    .locator(".mac-calendar-mini-month-day[aria-current='date']")
    .first()
    .getAttribute("data-date");
  const current = window.locator(".mac-calendar-week-grid-day[aria-current='date']").first();
  step(
    "the mini month marks today, and the week shows it, by the real clock",
    marked === todayKey &&
      ((await current.textContent())?.includes(String(today.getDate())) ?? false),
    `${marked} in the mini month, ${todayKey} here`,
  );

  // A new event, named in the popover that opens with its title being edited.
  const named = nextSave(page, (body) => body.events?.some((event) => event.title === planning));
  await window.getByRole("button", { name: "New Event" }).click();
  const title = page.getByRole("textbox", { name: "Title" });
  await title.waitFor({ timeout: 10_000 });
  await title.fill(planning);
  await title.press("Enter");
  step("a new event is named in its popover and saved", (await named).status() === 200);

  // Every week.
  await popover(page)
    .getByRole("button", { name: /^Date: / })
    .click();
  const repeating = nextSave(page, (body) =>
    body.events?.some((event) => event.title === planning && event.repeat?.freq === "weekly"),
  );
  await choose(page, popover(page), "Repeat", "Every Week");
  step("the event is made to repeat every week", (await repeating).status() === 200);
  await popover(page).getByRole("button", { name: "Done" }).click();
  await page.keyboard.press("Escape");

  // Next week, the repeating event is there.
  await window.getByRole("button", { name: "Next week" }).click();
  await block(window, planning).waitFor({ timeout: 5_000 });
  step("next week shows the repeating event", await block(window, planning).isVisible());
  await window.getByRole("button", { name: "Today" }).click();
  await shot(page, path.join(out, `calendar-${browserName}-week.png`));

  // Search lists the event.
  await window.getByRole("searchbox").fill(run);
  const results = window.getByRole("listbox", { name: "Search results" });
  await results.waitFor({ timeout: 5_000 });
  step(
    "the search lists the events with the run's name",
    (await results.getByText(planning).count()) > 0,
  );
  await window.getByRole("searchbox").fill("");

  // A second event, named in its popover, to delete.
  const spareSave = nextSave(page, (body) => body.events?.some((event) => event.title === spare));
  await window.getByRole("button", { name: "New Event" }).click();
  const spareTitle = page.getByRole("textbox", { name: "Title" });
  await spareTitle.waitFor({ timeout: 10_000 });
  await spareTitle.fill(spare);
  await spareTitle.press("Enter");
  step("a second event is added and saved", (await spareSave).status() === 200);
  await page.keyboard.press("Escape");

  // Delete it with the Delete key.
  await block(window, spare).click();
  const deleted = nextSave(page, (body) => !body.events?.some((event) => event.title === spare));
  await page.keyboard.press("Delete");
  step("the Delete key deletes the selected event", (await deleted).status() === 200);

  // A calendar of Chris's own.
  const list = window.getByRole("tree", { name: "Calendars" });
  await list.getByRole("treeitem", { name: /Home/ }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "New Calendar", exact: true }).click();
  const name = page.getByRole("textbox", { name: "Calendar name" });
  await name.fill("Running");
  const calendarSave = nextSave(page, (body) =>
    body.calendars?.some((item) => item.name === "Running"),
  );
  await name.press("Enter");
  step("New Calendar adds a calendar of his own", (await calendarSave).status() === 200);

  // A reload keeps it all: the repeating event, its repeat, the deletion and the calendar.
  await page.reload({ waitUntil: "load" });
  await finder(page).waitFor({ timeout: 20_000 });
  const again = await openCalendar(page);
  await block(again, planning).waitFor({ timeout: 10_000 });
  step(
    "after a reload the event and the new calendar are still there",
    (await again.getByRole("tree", { name: "Calendars" }).getByText("Running").isVisible()) &&
      (await block(again, planning).isVisible()),
  );
  const kept = await api(page, "GET", URL);
  const keptEvents = kept.json?.events ?? [];
  step(
    "the stored calendar keeps the weekly repeat and not the deleted event",
    keptEvents.some((event) => event.title === planning && event.repeat?.freq === "weekly") &&
      !keptEvents.some((event) => event.title === spare),
  );
  await again.getByRole("button", { name: "Next week" }).click();
  await block(again, planning).waitFor({ timeout: 5_000 });
  step(
    "after a reload next week still shows the repeating event",
    await block(again, planning).isVisible(),
  );

  // Export Work, which holds the event, as an iCalendar file.
  await again.getByRole("button", { name: "Today" }).click();
  const againList = again.getByRole("tree", { name: "Calendars" });
  await againList.getByRole("treeitem", { name: /Work/ }).click({ button: "right" });
  const downloading = page.waitForEvent("download", { timeout: 10_000 });
  await page.getByRole("menuitem", { name: "Export \u201cWork\u201d\u2026" }).click();
  const download = await downloading;
  const file = path.join(out, `calendar-${browserName}-work.ics`);
  await download.saveAs(file);
  const exported = await readFile(file, "utf8");
  step(
    "Export downloads Work as an iCalendar file with the event",
    download.suggestedFilename() === "Work.ics" &&
      exported.startsWith("BEGIN:VCALENDAR\r\n") &&
      exported.includes(`SUMMARY:${planning}\r\n`) &&
      exported.includes("RRULE:FREQ=WEEKLY"),
    download.suggestedFilename(),
  );

  // Importing the export again finds every event already there.
  await againList.getByRole("treeitem", { name: /Running/ }).click({ button: "right" });
  const choosing = page.waitForEvent("filechooser", { timeout: 10_000 });
  await page.getByRole("menuitem", { name: "Import\u2026", exact: true }).click();
  await (await choosing).setFiles(file);
  const sheet = page.getByRole("dialog", { name: "Import Events" });
  await sheet.waitFor({ timeout: 10_000 });
  await sheet.getByRole("button", { name: "Import" }).click();
  const report = page.getByRole("alertdialog");
  await report.waitFor({ timeout: 10_000 });
  step(
    "importing the export again adds nothing",
    (await report.textContent())?.includes("0 events were imported.") ?? false,
    (await report.textContent()) ?? "",
  );
  await report.getByRole("button", { name: "OK" }).click();

  // Anna, in a browser of her own, is invited to the event and accepts.
  const annaPage = await signUp(browser, anna, "anna");
  pages.push(annaPage);
  const planningId = keptEvents.find((event) => event.title === planning)?.id;
  await block(again, planning).dblclick();
  await popover(page).getByRole("button", { name: "Add Invitees" }).click();
  const invitee = page.getByRole("textbox", { name: "Invitee" });
  await invitee.fill(anna.name);
  const invitedSave = nextSave(page, (body) =>
    body.events?.some((event) => event.title === planning && event.invitees?.includes(anna.name)),
  );
  await invitee.press("Enter");
  step("Chris invites Anna by her account name", (await invitedSave).status() === 200);
  await popover(page).getByRole("button", { name: "Done" }).click();
  await page.keyboard.press("Escape");

  const annaWindow = await openCalendar(annaPage);
  await annaWindow
    .getByRole("tree", { name: "Calendars" })
    .getByRole("treeitem", { name: /Invitations/ })
    .waitFor({ timeout: 15_000 });
  await block(annaWindow, planning).waitFor({ timeout: 10_000 });
  step(
    "Anna finds the event in her Invitations calendar",
    await block(annaWindow, planning).isVisible(),
  );
  await block(annaWindow, planning).dblclick();
  const answered = annaPage.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /^\/api\/calendar\/inbox\/[0-9a-f]{32}\/\d+\/accept$/.test(
        new globalThis.URL(response.url()).pathname,
      ),
    { timeout: 15_000 },
  );
  await popover(annaPage).getByRole("button", { name: "Accept" }).click();
  step("Anna accepts the invitation", (await answered).status() === 200);
  await shot(annaPage, path.join(out, `calendar-${browserName}-invitation.png`));
  const sent = await api(page, "GET", "/api/calendar/sent");
  step(
    "Chris reads Anna's answer",
    sent.json?.events?.[planningId ?? ""]?.[0]?.status === "accepted",
    JSON.stringify(sent.json),
  );

  // Leave nothing behind: forgetting Chris's events takes the invitation back.
  await api(page, "DELETE", URL);
  const gone = await api(annaPage, "GET", "/api/calendar/inbox");
  step(
    "forgetting the event takes the invitation back",
    Array.isArray(gone.json?.invitations) && gone.json.invitations.length === 0,
  );
} catch (error) {
  problems.push(`journey aborted: ${error instanceof Error ? error.message : error}`);
  for (const [index, page] of pages.entries())
    await shot(page, path.join(out, `calendar-${browserName}-aborted-${index}.png`));
} finally {
  await browser.close();
}
if (problems.length > 0) {
  console.error(
    `\ncalendar: ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`,
  );
  process.exit(1);
}
console.log(`\ncalendar: all ${steps.length} steps passed with no console errors`);

#!/usr/bin/env node
// Reminders lists shared between two accounts on Ferrite. Chris and Anna each
// create an account in a browser of their own. Chris adds a list with a
// reminder and shares it with Anna by account name from the list's contextual
// menu; it moves to his Shared section. Anna finds it under Shared, owned by
// Chris, completes his reminder and adds one of her own; Chris reads both from
// the server. Then the permissions: Anna, on the list but not its owner, is
// refused (403) adding or removing people and stopping the sharing, and her
// People popover offers none of it; Ben, a third account not on the list, is
// answered 404 on every route of it. Chris takes Anna off the list from its
// People popover, and her window drops it; he adds her back the same way. Anna
// leaves the list from its People popover and has it no more;
// Chris then stops sharing it, and it is one of his own lists again, with both
// reminders. Last, a reminder of the list due yesterday alerts at once once the
// list is taken back: the window arms the alerts the server took it back without.
// Then conflicts: Chris in a second browser adds a reminder; his first browser,
// on an older copy, adds another, meets a 409, and its change is made again
// on the stored reminders, so both are kept. The second browser removes its
// reminder, the first completes it on its older copy, and it stays removed.
//
// Exits 0 only when every step passed and no page logged a console error, a
// page error, a failed request or an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/reminders-sharing-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                          [--browser chromium|chrome|firefox|webkit]
//
// The accounts are made fresh for each run (`chris-rem-<run>`, `anna-rem-<run>`),
// so it runs again against the same deployment, local or hosted. It needs no
// driven clock: shared lists raise no alerts.

import path from "node:path";
import { options, shot } from "./app-journey.mjs";
import { ENGINES } from "./journey-kit.mjs";

const { base, out, browserName } = options();
const run = Date.now().toString(36);
const password = `tide-${run}-pool`;
const chris = { name: `chris-rem-${run}`, fullName: "Chris Rem" };
const anna = { name: `anna-rem-${run}`, fullName: "Anna Rem" };
const ben = { name: `ben-rem-${run}`, fullName: "Ben Rem" };
const SHARED = "/api/reminders/shared";

const problems = [];
const steps = [];
/**
 * Set once the journey makes two browsers of one person edit older copies on purpose: a save
 * refused for a newer revision (409) of the person's own reminders is then expected, and made
 * again by the window.
 */
let conflictsExpected = false;
const step = (label, ok, detail = "") => {
  steps.push(label);
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`);
  if (!ok) problems.push(label);
  return ok;
};

function watch(page, label) {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // Chromium also logs the 409 a conflict step provokes on purpose, as a failed resource load, and the one the shared
    // save client takes and merges when another writer of the settings got in first.
    const location = message.location()?.url ?? "";
    if (
      /status of 409/.test(message.text()) &&
      location.includes("/api/system-preferences/settings")
    )
      return;
    if (
      conflictsExpected &&
      /status of 409/.test(message.text()) &&
      (message.location()?.url ?? "").includes("/api/reminders/data")
    )
      return;
    problems.push(`${label} console: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`${label} page error: ${error.message}`));
  page.on("requestfailed", (request) => {
    const text = request.failure()?.errorText ?? "";
    // `ferrite dev`'s live-reload stream and the page's own requests cut short by a reload.
    if (/ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(text)) return;
    problems.push(`${label} request failed: ${request.url()} ${text}`);
  });
  page.on("response", (response) => {
    const pathname = new globalThis.URL(response.url()).pathname;
    if (conflictsExpected && response.status() === 409 && pathname === "/api/reminders/data")
      return;
    if (response.status() === 409 && pathname === "/api/system-preferences/settings") return;
    if (response.status() >= 400) problems.push(`${label} HTTP ${response.status()} ${pathname}`);
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

/**
 * A request with `page`'s own cookie, sent by its browser context's request client rather than
 * the page: for the refusals the journey provokes on purpose, which are then no page errors.
 * Answers the status and the body.
 */
async function asPerson(page, method, url, body) {
  const response = await page.context().request.fetch(`${base}${url}`, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    data: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status(), json: await response.json().catch(() => null) };
}

const finder = (page) => page.getByRole("button", { name: /^Finder$/ }).first();

/** A fresh browser signed up as `person`, on its desktop. */
async function signUp(browser, person, label) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
  return page;
}

async function openReminders(page) {
  await page
    .getByRole("button", { name: /^Reminders$/ })
    .or(page.getByRole("link", { name: /^Reminders$/ }))
    .first()
    .click();
  const window = page.getByRole("region", { name: "Reminders" }).first();
  await window.getByRole("button", { name: "New Reminder" }).waitFor({ timeout: 15_000 });
  await page.waitForFunction(() => !document.querySelector(".mac-reminders[aria-busy]"), null, {
    timeout: 15_000,
  });
  return window;
}

/** The sidebar row of the list named `name`. */
const listRow = (window, name) =>
  window
    .getByRole("tree", { name: "Lists" })
    .getByRole("treeitem")
    .filter({ hasText: new RegExp(`^${name}`) })
    .first();
const reminderRow = (window, title) => window.getByRole("option").filter({ hasText: title });

/** The next response to `method` on a path that `match` accepts. */
const nextResponse = (page, method, match) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === method && match(new globalThis.URL(response.url()).pathname),
    { timeout: 15_000 },
  );

const browser = await ENGINES[browserName].launch();
console.log(`reminders sharing in ${browserName}`);
const pages = [];
try {
  const page = await signUp(browser, chris, "chris");
  pages.push(page);
  const annaPage = await signUp(browser, anna, "anna");
  pages.push(annaPage);
  const window = await openReminders(page);
  step("Chris's Reminders opens", await window.isVisible());

  // A list of Chris's own, with a reminder.
  await window.getByText("Add List").click();
  const newList = listRow(window, "New List");
  await newList.waitFor({ timeout: 10_000 });
  const packing = `Packing ${run}`;
  await window.getByRole("button", { name: "New Reminder" }).click();
  await page.keyboard.type(packing);
  const added = nextResponse(page, "PUT", (path) => path === "/api/reminders/data");
  await page.keyboard.press("Enter");
  step("Chris adds a list with a reminder, saved", (await added).status() === 200);
  // The page saves after a short pause: wait until the list is stored before sharing it.
  await page.waitForFunction(
    async (title) => {
      const reply = await fetch("/api/reminders/data", { credentials: "same-origin" });
      const body = await reply.json();
      return body.data?.reminders?.some((each) => each.title === title);
    },
    packing,
    { timeout: 15_000, polling: 500 },
  );

  // Shared with Anna from the list's contextual menu.
  await newList.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Share List…" }).click();
  const share = page.locator(".mac-reminders-share").first();
  await share.waitFor({ timeout: 10_000 });
  await share.getByRole("textbox").fill(anna.name);
  const shared = nextResponse(page, "POST", (path) => path === SHARED);
  await share.getByRole("button", { name: "Share" }).click();
  const reply = await shared;
  step("Chris shares the list with Anna by account name", reply.status() === 201);
  const id = (await reply.json()).id;
  await listRow(window, "New List")
    .filter({ hasText: "Shared by Me" })
    .waitFor({ timeout: 15_000 });
  step("the list moves to Chris's Shared section", true);
  await shot(page, path.join(out, `reminders-${browserName}-shared.png`));

  // Anna finds it, owned by Chris, completes his reminder and adds one of hers.
  const annaWindow = await openReminders(annaPage);
  const annaList = listRow(annaWindow, "New List");
  await annaList.waitFor({ timeout: 15_000 });
  step(
    "Anna finds it under Shared, owned by Chris",
    (await annaList.textContent())?.includes(chris.fullName) ?? false,
    (await annaList.textContent()) ?? "",
  );
  await annaList.click();
  await reminderRow(annaWindow, packing).waitFor({ timeout: 10_000 });
  const completed = nextResponse(annaPage, "PUT", (path) => path === `${SHARED}/${id}`);
  await reminderRow(annaWindow, packing).locator("[data-reminder-toggle]").click();
  step("Anna completes Chris's reminder", (await completed).status() === 200);
  const hers = `Tickets ${run}`;
  await annaWindow.getByRole("button", { name: "New Reminder" }).click();
  await annaPage.keyboard.type(hers);
  const addedByAnna = nextResponse(annaPage, "PUT", (path) => path === `${SHARED}/${id}`);
  await annaPage.keyboard.press("Enter");
  step("Anna adds a reminder of her own to it", (await addedByAnna).status() === 200);
  await shot(annaPage, path.join(out, `reminders-${browserName}-anna.png`));

  const chrisReads = await api(page, "GET", SHARED);
  const list = chrisReads.json?.lists?.find((each) => each.id === id);
  step(
    "Chris reads both changes from the server",
    list?.reminders?.some((each) => each.title === packing && each.completed === true) &&
      list?.reminders?.some((each) => each.title === hers),
    JSON.stringify(list?.reminders),
  );

  // Permissions. Anna, on the list but not its owner, can neither add nor remove people nor stop
  // sharing it; Ben, not on it, reaches nothing of it.
  const memberRefusals = [
    (await asPerson(annaPage, "POST", `${SHARED}/${id}/people`, { name: chris.name })).status,
    (await asPerson(annaPage, "DELETE", `${SHARED}/${id}/people/${chris.name}`)).status,
    (await asPerson(annaPage, "POST", `${SHARED}/${id}/stop`)).status,
  ];
  step(
    "Anna, a member, is refused adding and removing people and stopping the sharing (403)",
    memberRefusals.every((status) => status === 403),
    memberRefusals.join(", "),
  );
  await listRow(annaWindow, "New List").click({ button: "right" });
  await annaPage.getByRole("menuitem", { name: "Show People\u2026" }).click();
  const annaView = annaPage.locator(".mac-reminders-share").first();
  await annaView.waitFor({ timeout: 10_000 });
  step(
    "her People popover offers Leave on her own row and nothing an owner does",
    (await annaView.getByRole("button", { name: "Leave this list" }).count()) === 1 &&
      (await annaView.getByRole("textbox").count()) === 0 &&
      (await annaView.getByRole("button", { name: /^Remove / }).count()) === 0 &&
      (await annaView.getByRole("button", { name: "Stop Sharing" }).count()) === 0,
  );
  await annaPage.keyboard.press("Escape");
  await annaView.waitFor({ state: "detached", timeout: 10_000 });

  const benPage = await signUp(browser, ben, "ben");
  pages.push(benPage);
  const benLists = await asPerson(benPage, "GET", SHARED);
  // A well-formed write of the list (one list, this one): only membership can refuse it.
  const writeOf = (name, color) => ({
    base: list?.rev ?? 1,
    data: { lists: [{ id, name, color }], reminders: [] },
  });
  const strangerRefusals = [
    (await asPerson(benPage, "PUT", `${SHARED}/${id}`, writeOf("Taken", "red"))).status,
    (await asPerson(benPage, "POST", `${SHARED}/${id}/people`, { name: ben.name })).status,
    (await asPerson(benPage, "DELETE", `${SHARED}/${id}/people/${anna.name}`)).status,
    (await asPerson(benPage, "POST", `${SHARED}/${id}/leave`)).status,
    (await asPerson(benPage, "POST", `${SHARED}/${id}/stop`)).status,
  ];
  step(
    "Ben, not on the list, lists no shared list and is answered 404 on every route of it",
    benLists.status === 200 &&
      Array.isArray(benLists.json?.lists) &&
      benLists.json.lists.length === 0 &&
      strangerRefusals.every((status) => status === 404),
    `${benLists.status} ${JSON.stringify(benLists.json?.lists)}; ${strangerRefusals.join(", ")}`,
  );
  const untouched = await api(page, "GET", SHARED);
  step(
    "and none of it changed the list",
    untouched.json?.lists?.find((each) => each.id === id)?.rev === list?.rev,
  );

  // Chris takes Anna off from the People popover: her window drops the list and her writes are
  // refused. He adds her back the same way.
  await listRow(window, "New List").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Share List\u2026" }).click();
  const chrisPeople = page.locator(".mac-reminders-share").first();
  await chrisPeople.waitFor({ timeout: 10_000 });
  const removed = nextResponse(page, "DELETE", (path) =>
    path.startsWith(`${SHARED}/${id}/people/`),
  );
  await chrisPeople.getByRole("button", { name: `Remove ${anna.fullName}` }).click();
  step("Chris takes Anna off the list from its People popover", (await removed).status() === 200);
  await listRow(annaWindow, "New List").waitFor({ state: "detached", timeout: 20_000 });
  step("Anna's open window drops the list", true);
  const annaWrite = await asPerson(annaPage, "PUT", `${SHARED}/${id}`, writeOf("New List", "blue"));
  step(
    "and a write of hers to it is answered 404",
    annaWrite.status === 404,
    `${annaWrite.status}`,
  );
  await chrisPeople.getByRole("textbox").fill(anna.name);
  const readded = nextResponse(page, "POST", (path) => path === `${SHARED}/${id}/people`);
  await chrisPeople.getByRole("button", { name: "Add" }).click();
  step("Chris adds Anna back from the same popover", (await readded).status() === 200);
  await page.keyboard.press("Escape");
  await listRow(annaWindow, "New List").waitFor({ timeout: 20_000 });
  step("and the list is back in her open window", true);
  await shot(annaPage, path.join(out, `reminders-${browserName}-readded.png`));

  // Anna leaves; Chris stops sharing, and has the list back with both reminders.
  // Anna leaves from the list's contextual menu, Show People…, and Leave on her own row.
  await listRow(annaWindow, "New List").click({ button: "right" });
  await annaPage.getByRole("menuitem", { name: "Show People\u2026" }).click();
  const annaPeople = annaPage.locator(".mac-reminders-share").first();
  await annaPeople.waitFor({ timeout: 10_000 });
  const left = nextResponse(annaPage, "POST", (path) => path === `${SHARED}/${id}/leave`);
  await annaPeople.getByRole("button", { name: "Leave this list" }).click();
  step("Anna leaves the list from its People popover", (await left).status() === 200);
  await listRow(annaWindow, "New List").waitFor({ state: "detached", timeout: 15_000 });
  const annaAfter = await api(annaPage, "GET", SHARED);
  step(
    "and has it no more, in the window or on the server",
    Array.isArray(annaAfter.json?.lists) && annaAfter.json.lists.length === 0,
  );
  // One of the list's reminders is due yesterday (in Chris's zone): once the list is taken back,
  // its alert, already past, must fire at once.
  const before = await api(page, "GET", SHARED);
  const current = before.json?.lists?.find((each) => each.id === id);
  const { zone, yesterday } = await page.evaluate(() => {
    const day = new Date();
    day.setDate(day.getDate() - 1);
    const two = (value) => String(value).padStart(2, "0");
    return {
      zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      yesterday: `${day.getFullYear()}-${two(day.getMonth() + 1)}-${two(day.getDate())}`,
    };
  });
  const dated = await api(page, "PUT", `${SHARED}/${id}`, {
    base: current?.rev,
    data: {
      lists: [{ id, name: current?.name, color: current?.color }],
      reminders: (current?.reminders ?? []).map((each) =>
        each.title === hers ? { ...each, due: yesterday, timeZone: zone } : each,
      ),
    },
  });
  step("Chris makes one of the list's reminders due yesterday", dated.status === 200);
  await listRow(window, "New List").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Share List…" }).click();
  const people = page.locator(".mac-reminders-share").first();
  await people.waitFor({ timeout: 10_000 });
  const stopped = nextResponse(page, "POST", (path) => path === `${SHARED}/${id}/stop`);
  await people.getByRole("button", { name: "Stop Sharing" }).click();
  step("Chris stops sharing it", (await stopped).status() === 200);
  const own = await api(page, "GET", "/api/reminders/data");
  step(
    "it is one of Chris's own lists again, with both reminders",
    own.json?.data?.lists?.some((each) => each.id === id) &&
      own.json?.data?.reminders?.filter((each) => each.listId === id).length === 2,
    JSON.stringify(own.json?.data?.reminders),
  );
  await listRow(window, "New List")
    .filter({ hasNotText: "Shared by Me" })
    .waitFor({ timeout: 15_000 });
  step("and is listed under My Lists", true);
  // The list taken back alerts again at once: the alert of the reminder due yesterday fires.
  let alerted = false;
  for (let tries = 0; tries < 30 && !alerted; tries += 1) {
    const listed = await api(page, "GET", "/api/reminders/alerts");
    alerted = listed.json?.alerts?.some((each) => each.title === hers) ?? false;
    if (!alerted) await page.waitForTimeout(500);
  }
  step(
    "the list taken back alerts again: its reminder due yesterday is among Chris's alerts",
    alerted,
  );
  // Conflicts: Chris in a second browser, each browser holding a copy the other has moved on from.
  // A save refused for a newer revision (409) is made again on the stored reminders, losing
  // nothing; a reminder removed in one browser is not brought back by the other's change to it.
  conflictsExpected = true;
  const isOwnSave = (response, status) =>
    response.request().method() === "PUT" &&
    new globalThis.URL(response.url()).pathname === "/api/reminders/data" &&
    response.status() === status;
  const chrisB = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
    storageState: await page.context().storageState(),
  });
  const pageB = await chrisB.newPage();
  watch(pageB, "chris-b");
  pages.push(pageB);
  await pageB.goto(`${base}/`, { waitUntil: "load" });
  await finder(pageB).waitFor({ timeout: 20_000 });
  const windowB = await openReminders(pageB);
  await listRow(windowB, "New List").click();
  const fromB = `From B ${run}`;
  await windowB.getByRole("button", { name: "New Reminder" }).click();
  await pageB.keyboard.type(fromB);
  const addedB = pageB.waitForResponse((response) => isOwnSave(response, 200), {
    timeout: 15_000,
  });
  await pageB.keyboard.press("Enter");
  step("Chris's second browser adds a reminder", (await addedB).status() === 200);
  await listRow(window, "New List").click();
  // The first browser's copy is older: adding a reminder there meets a 409, and is made again.
  const fromA = `From A ${run}`;
  const refusedA = page.waitForResponse((response) => isOwnSave(response, 409), {
    timeout: 15_000,
  });
  const storedA = page.waitForResponse((response) => isOwnSave(response, 200), {
    timeout: 15_000,
  });
  await window.getByRole("button", { name: "New Reminder" }).click();
  await page.keyboard.type(fromA);
  await page.keyboard.press("Enter");
  await refusedA;
  await storedA;
  const both = await api(page, "GET", "/api/reminders/data");
  step(
    "the first browser's addition on an older copy meets a 409 and is made again: both browsers' additions are kept",
    both.json?.data?.reminders?.some((each) => each.title === fromA) &&
      both.json?.data?.reminders?.some((each) => each.title === fromB) &&
      both.json?.data?.reminders?.some((each) => each.title === hers && !each.completed),
    JSON.stringify(
      both.json?.data?.reminders?.map((each) => [each.title, each.completed ?? false]),
    ),
  );
  // The second browser removes its reminder; the first, on its older copy, completes it.
  const rowB = reminderRow(windowB, fromB);
  await rowB.click();
  const removedB = pageB.waitForResponse(
    (response) =>
      isOwnSave(response, 200) &&
      !JSON.parse(response.request().postData() ?? "{}").data?.reminders?.some(
        (each) => each.title === fromB,
      ),
    { timeout: 15_000 },
  );
  await pageB.keyboard.press("Backspace");
  step("the second browser removes it", (await removedB).status() === 200);
  const fromBInA = reminderRow(window, fromB);
  await fromBInA.waitFor({ timeout: 10_000 });
  const refusedA2 = page.waitForResponse((response) => isOwnSave(response, 409), {
    timeout: 15_000,
  });
  await fromBInA.locator("[data-reminder-toggle]").click();
  await refusedA2;
  await fromBInA.waitFor({ state: "detached", timeout: 15_000 });
  const after = await api(page, "GET", "/api/reminders/data");
  step(
    "a reminder removed in one browser is not brought back by the other's change to it",
    !after.json?.data?.reminders?.some((each) => each.title === fromB) &&
      after.json?.data?.reminders?.some((each) => each.title === fromA),
  );
  // Any 409 after this is a problem again.
  conflictsExpected = false;

  // `--keep <prefix>`: Chris's browser state and the reminder's title, for a check after a restart
  // of the server (campaign tooling); nothing is kept otherwise.
  const keepAt = process.argv.indexOf("--keep");
  if (keepAt >= 0 && process.argv[keepAt + 1]) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(
      `${process.argv[keepAt + 1]}-${browserName}.json`,
      JSON.stringify({ storage: await page.context().storageState(), title: hers, absent: fromB }),
    );
  }
} catch (error) {
  problems.push(`journey aborted: ${error instanceof Error ? error.message : error}`);
  for (const [index, page] of pages.entries())
    await shot(page, path.join(out, `reminders-${browserName}-aborted-${index}.png`));
} finally {
  await browser.close();
}
if (problems.length > 0) {
  console.error(
    `\nreminders sharing: ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`,
  );
  process.exit(1);
}
console.log(`\nreminders sharing: all ${steps.length} steps passed with no console errors`);

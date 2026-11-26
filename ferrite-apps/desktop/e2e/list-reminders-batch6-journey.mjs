#!/usr/bin/env node
// Reminders' Scheduled headings and due alerts on Ferrite, in a real browser against the running app,
// read from the server and after a reload:
//   headings: a day of Scheduled is a heading, not an option; the keys pass it and a press selects nothing.
//   notifications: with no Reminders window a fired alert comes through Notification Center; Close and
//     Complete are kept on the server, a repeating reminder's opens Reminders, nothing is raised twice.
//   window: with the window open it shows the alert alone, and Notification Center holds nothing of it.
// Exits 0 only when every step passed and no page logged a console error, a page error, a failed
// request or an HTTP error. It drives the clock, so `ferrite dev` runs with `--clock-ms`.
//
//   CLOCK_MS=$(date +%s000) ferrite dev ...
//   node e2e/list-reminders-batch6-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("list-reminders-batch6");
const id = Date.now().toString(36);
const person = { name: `lr6-${id}`, fullName: `Lee ${id}`, password: `tide-${id}-pool` };
const seen = (check, ms = 10_000) => within(ms, check).then((took) => took !== null);
const two = (value) => `${value}`.padStart(2, "0");
const dayOn = (offset) => {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
};
const todayAt = (hour) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour).getTime();
};

const windowOf = (page) => page.locator('.mac-reminders[aria-label="Reminders"]').first();
const api = (page, method, url, body) =>
  page.evaluate(
    async ({ method, url, body }) => {
      const reply = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: body ? { "content-type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: reply.status, json: await reply.json().catch(() => null) };
    },
    { method, url, body },
  );
const stored = async (page) => (await api(page, "GET", "/api/reminders/data")).json;
const inbox = async (page) =>
  (await api(page, "GET", "/api/notification-center/inbox")).json.items ?? [];
const fired = async (page) => (await api(page, "GET", "/api/reminders/alerts")).json.alerts;
const noteOf = (page, title) =>
  page.locator('[data-app="reminders"][data-style="alert"]').filter({ hasText: title });
const clock = (page, change) =>
  page.evaluate(
    (change) =>
      fetch("/__forge/clock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(change),
      }).then((reply) => reply.json()),
    change,
  );
const reload = async (page) => {
  await page.reload({ waitUntil: "load" });
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
};

const LIST = { id: "list-one", name: "Errands", color: "blue" };
const reminder = (key, title, due, extra = {}) => ({
  id: key,
  listId: LIST.id,
  title,
  due,
  ...extra,
});
/** Add `added` to the stored document, each alerting at the instant `alerts` names. */
async function seed(page, added, alerts) {
  const now = await stored(page);
  const reply = await api(page, "PUT", "/api/reminders/data", {
    base: now.rev,
    data: {
      lists: now.data?.lists?.length ? now.data.lists : [LIST],
      reminders: [...(now.data?.reminders ?? []), ...added],
    },
    alerts: { ...(await armed(now)), ...alerts },
  });
  if (reply.status !== 200) throw new Error(`seed: ${JSON.stringify(reply)}`);
}
/** The alert instants of what is stored, as the browser's own save would name them. */
async function armed(now) {
  const known = {};
  for (const each of now.data?.reminders ?? []) {
    if (each.due && !each.completed) known[each.id] = instants.get(each.id);
  }
  return known;
}
const instants = new Map();
const due = (key, at) => {
  instants.set(key, at);
  return { [key]: at };
};

async function headings(page) {
  const [first, second] = [`Ant ${id}`, `Bee ${id}`];
  const nine = (offset) => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 9).getTime();
  };
  await seed(page, [reminder("head-a", first, dayOn(1)), reminder("head-b", second, dayOn(2))], {
    ...due("head-a", nine(1)),
    ...due("head-b", nine(2)),
  });
  await reload(page);
  await openFromDock(page, "Reminders");
  const list = windowOf(page);
  await list.waitFor({ timeout: 15_000 });
  const scheduled = () => windowOf(page).getByRole("button", { name: /^Scheduled \d+$/ });
  await scheduled().click();
  const heading = list.getByRole("heading", { name: "Tomorrow", exact: true });
  step("Scheduled: Tomorrow is a heading", await seen(() => heading.isVisible()));
  const options = list.getByRole("option");
  const texts = await options.allInnerTexts();
  step(
    "Scheduled: no day is an option; only the reminders are",
    texts.length === 2 && texts[0].includes(first) && texts[1].includes(second),
    JSON.stringify(texts),
  );
  const places = await options.evaluateAll((all) =>
    all.map((each) => `${each.getAttribute("aria-posinset")}/${each.getAttribute("aria-setsize")}`),
  );
  step("Scheduled: the options count only the reminders", places.join() === "1/2,2/2", `${places}`);
  await shot(page, "list6-scheduled-headings");

  const chosen = () => list.getByRole("option", { selected: true }).innerText();
  await options.first().click();
  await page.keyboard.press("ArrowDown");
  step(
    "Scheduled: one Down Arrow goes from a day's reminder to the next day's, past its heading",
    await seen(async () => (await chosen()).includes(second)),
  );
  await page.keyboard.press("ArrowUp");
  step(
    "Scheduled: one Up Arrow comes back past it",
    await seen(async () => (await chosen()).includes(first)),
  );
  await heading.click();
  await page.waitForTimeout(300);
  step(
    "Scheduled: a press on a heading selects nothing",
    (await chosen()).includes(first) &&
      (await list.getByRole("option", { selected: true }).count()) === 1,
  );

  await reload(page);
  if ((await windowOf(page).count()) === 0) await openFromDock(page, "Reminders");
  await scheduled().click();
  step(
    "Scheduled: the headings are there after a reload",
    await seen(() =>
      windowOf(page).getByRole("heading", { name: "Tomorrow", exact: true }).isVisible(),
    ),
  );
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "File", exact: true })
    .first()
    .click();
  await page
    .getByRole("menu")
    .last()
    .getByRole("menuitem", { name: /^Close Window/ })
    .click();
  await windowOf(page).waitFor({ state: "detached", timeout: 8_000 });
  await page.waitForTimeout(500);
}

async function notifications(page) {
  const at = todayAt(9);
  const [closes, completes, repeats] = ["Closes", "Completes", "Repeats"].map(
    (word) => `${word} ${id}`,
  );
  await seed(
    page,
    [
      reminder("note-close", closes, dayOn(0), { dueTime: "09:00", notes: "Ask for Sam" }),
      reminder("note-done", completes, dayOn(0), { dueTime: "09:00" }),
      reminder("note-weekly", repeats, dayOn(0), { dueTime: "09:00", repeat: "weekly" }),
    ],
    { ...due("note-close", at), ...due("note-done", at), ...due("note-weekly", at) },
  );
  await page.waitForTimeout(11_000);
  step("Notification: nothing raised before its instant", (await inbox(page)).length === 0);
  await clock(page, { set_ms: at + 60_000 });
  const raised = await seen(async () => (await inbox(page)).length >= 3, 30_000);
  const notes = await inbox(page);
  const note = notes.find((item) => item.title === closes);
  step(
    "Notification: raised through Notification Center with no Reminders window open",
    raised &&
      (await windowOf(page).count()) === 0 &&
      note?.app === "reminders" &&
      note?.id === `alert:note-close@${at}` &&
      note?.body === "Ask for Sam",
    JSON.stringify(note ?? notes),
  );
  step(
    "Notification: on the screen, under the menu bar",
    await seen(() => noteOf(page, closes).first().isVisible(), 8_000),
  );
  await shot(page, "list6-notification");

  await noteOf(page, closes).first().getByRole("button", { name: "Close" }).click();
  step(
    "Notification: Close dismisses the alert on the server",
    await seen(async () => (await fired(page)).every((alert) => alert.id !== "note-close")),
  );

  await seen(() => noteOf(page, completes).first().isVisible(), 8_000);
  await noteOf(page, completes).first().getByRole("button", { name: "Complete" }).click();
  const held = async () =>
    (await stored(page)).data.reminders.find((each) => each.id === "note-done");
  step(
    "Notification: Complete completes the reminder on the server",
    await seen(async () => (await held())?.completed === true),
  );

  const weekly = noteOf(page, repeats).first();
  await seen(() => weekly.isVisible(), 8_000);
  step(
    "Notification: a repeating reminder's offers Show, not a Complete the server cannot work out",
    (await weekly.getByRole("button", { name: "Show" }).count()) === 1 &&
      (await weekly.getByRole("button", { name: "Complete" }).count()) === 0,
  );
  await weekly.getByRole("button", { name: "Show" }).click();
  await windowOf(page).waitFor({ timeout: 15_000 });
  const inWindow = page.locator(".mac-reminders-alerts").filter({ hasText: repeats });
  step(
    "Notification: Show opens Reminders, whose window then shows the alert and the list holds none",
    await seen(
      async () =>
        (await inWindow.isVisible()) && (await inbox(page)).every((item) => item.title !== repeats),
      15_000,
    ),
  );
  await inWindow.getByRole("button", { name: "Close" }).click();

  await reload(page);
  await page.waitForTimeout(13_000);
  const after = await inbox(page);
  step(
    "Notification: closed and completed, not raised again after a reload and a later pass",
    after.every((item) => ![closes, completes, repeats].includes(item.title)) &&
      (await noteOf(page, closes).count()) === 0 &&
      (await noteOf(page, completes).count()) === 0,
    JSON.stringify(after.map((item) => item.title)),
  );
}

async function windowOpen(page) {
  const at = todayAt(10);
  const shownHere = `Shown here ${id}`;
  await seed(page, [reminder("here", shownHere, dayOn(0), { dueTime: "10:00" })], due("here", at));
  await reload(page);
  if ((await windowOf(page).count()) === 0) await openFromDock(page, "Reminders");
  await windowOf(page)
    .getByRole("button", { name: /^Today \d+$/ })
    .click();
  await windowOf(page).getByRole("option").filter({ hasText: shownHere }).waitFor();
  await clock(page, { set_ms: at + 60_000 });
  const inWindow = page.locator(".mac-reminders-alerts").filter({ hasText: shownHere });
  const shows = await seen(() => inWindow.isVisible(), 15_000);
  await page.waitForTimeout(13_000);
  const quiet = (await inbox(page)).every((item) => item.title !== shownHere);
  step(
    "Window open: it shows the alert alone, and Notification Center holds nothing of it",
    shows && quiet && (await noteOf(page, shownHere).count()) === 0,
    `${shows} ${quiet}`,
  );
  await shot(page, "list6-window-alert");
  await inWindow.getByRole("button", { name: "Complete" }).click();
  const held = async () => (await stored(page)).data.reminders.find((each) => each.id === "here");
  step(
    "Window open: its Complete is kept on the server",
    await seen(async () => (await held())?.completed === true),
  );
}

await run({}, {}, async ({ person: open }) => {
  const page = await open("lee", person);
  await clock(page, { set_ms: todayAt(8) });
  await headings(page);
  await notifications(page);
  await windowOpen(page);
});

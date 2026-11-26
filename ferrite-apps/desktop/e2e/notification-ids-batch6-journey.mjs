#!/usr/bin/env node
// Pressing a notification shows what it is about, for real notifications between accounts on the served desktop: a shared
// note and a shared list, for the person told and for the owner told someone left; Find My's people list, which a person's
// notification opens whatever list was showing; a Stocks price alert's symbol, kept over a reload; a Calendar alert's body,
// beside its Close button, which opens nothing; and a banner beside the alert Calendar's own window shows, where it can be
// pressed. A Calendar invitation is pressed and shows its event. Exits 0 only when every step passed and no page logged a
// problem. Podcasts' id is proved by its unit test: it needs a feed that publishes after the person last looked.
//
//   node e2e/notification-ids-batch6-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("notification-ids-batch6");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `nichris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `nimartin-${id}`, fullName: `Martin ${id}`, password };
const ann = { name: `niann-${id}`, fullName: `Ann ${id}`, password };

const seen = (check, ms = 20_000) => within(ms, check).then((took) => took !== null);
const url = (page, to) => new URL(to, page.url()).href;
const get = async (page, to) => (await page.request.get(url(page, to))).json();
const post = (page, to, data) => page.request.post(url(page, to), { data });
const put = (page, to, data) => page.request.put(url(page, to), { data });
const banner = (page, text) =>
  page.locator(".mac-desktop-shell-banners > *").filter({ hasText: text }).first();
const shows = (page, text, ms = 20_000) =>
  seen(async () => (await banner(page, text).count()) > 0, ms);
/** Press a notification on its text, as a person does; the press has to be let go where it began. */
async function press(page, text) {
  const body = banner(page, text).getByText(text).first();
  const box = await body.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
const windowOf = (page, app) => page.locator(`[data-window-id^="${app}"]`).first();
const pane = (page) => windowOf(page, "stocks").locator(".mac-stocks-pane h2").first();

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  const b = await person("martin", martin);

  // ---- A shared note: told of it, and told that someone left it ------------------------------
  const noteTitle = `Ferry times ${id}`;
  const noteId = `note-${id}`;
  const seeded = await put(a, "/api/notes/data", {
    base: 0,
    data: {
      folders: [{ id: "notes", name: "Notes" }],
      notes: [
        { id: "other", folder: "notes", lines: ["Another note", ""], date: "9:00", edited: "9:00" },
        { id: noteId, folder: "notes", lines: [noteTitle, "Eight"], date: "9:00", edited: "9:00" },
      ],
    },
  });
  step("Chris has two notes", seeded.ok(), `HTTP ${seeded.status()}`);
  const sharedNote = await post(a, "/api/notes/shared", { note: noteId, people: [martin.name] });
  step("Chris shares one with Martin", sharedNote.ok(), `HTTP ${sharedNote.status()}`);
  const shareId = (await sharedNote.json()).id;
  const noteTold = `${chris.fullName} shared a note with you`;
  step("Martin gets a banner", await shows(b, noteTold));
  await press(b, noteTold);
  const selectedNote = (page) =>
    windowOf(page, "notes")
      .getByRole("listbox", { name: "Notes" })
      .locator('[role="option"][aria-selected="true"]')
      .filter({ hasText: noteTitle });
  step(
    "pressing it opens Notes on that note",
    await seen(async () => (await selectedNote(b).count()) === 1),
  );
  await shot(b, "notification-ids-note");
  const left = await post(b, `/api/notes/shared/${shareId}/leave`, {});
  step("Martin leaves the note", left.ok(), `HTTP ${left.status()}`);
  const noteLeft = `${martin.fullName} left a shared note`;
  step("Chris gets a banner", await shows(a, noteLeft));
  await press(a, noteLeft);
  step(
    "pressing it opens Notes on that note, his own",
    await seen(async () => (await selectedNote(a).count()) === 1),
  );

  // ---- A shared list ------------------------------------------------------------------------
  const listName = `Trip ${id}`;
  const listId = `list-${id}`;
  const lists = await put(a, "/api/reminders/data", {
    base: 0,
    data: {
      lists: [
        { id: "first", name: "First", color: "blue" },
        { id: listId, name: listName, color: "purple" },
      ],
      reminders: [{ id: "passport", listId, title: "Passport" }],
    },
    alerts: {},
  });
  step("Chris has two lists", lists.ok(), `HTTP ${lists.status()}`);
  const sharedList = await post(a, "/api/reminders/shared", {
    list: listId,
    people: [martin.name],
  });
  step("Chris shares one with Martin", sharedList.ok(), `HTTP ${sharedList.status()}`);
  const sharedListId = (await sharedList.json()).id;
  const listTold = `${chris.fullName} shared a list with you`;
  step("Martin gets a banner", await shows(b, listTold));
  await press(b, listTold);
  const selectedList = (page) =>
    windowOf(page, "reminders")
      .locator('[role="treeitem"][aria-selected="true"]')
      .filter({ hasText: listName });
  step(
    "pressing it opens Reminders on that list",
    await seen(async () => (await selectedList(b).count()) === 1),
  );
  const leftList = await post(b, `/api/reminders/shared/${sharedListId}/leave`, {});
  step("Martin leaves the list", leftList.ok(), `HTTP ${leftList.status()}`);
  const listLeft = `${martin.fullName} left a shared list`;
  step("Chris gets a banner", await shows(a, listLeft));
  await press(a, listLeft);
  step(
    "pressing it opens Reminders on that list",
    await seen(async () => (await selectedList(a).count()) === 1),
  );

  // ---- Find My: no device of that id exists; the person is on the people list ----------------
  const sharing = await put(a, `/api/find-my/people/${martin.name}/share`, {});
  step("Chris shares his location", sharing.ok(), `HTTP ${sharing.status()}`);
  const startedSharing = `${chris.fullName} started sharing location with you`;
  step("Martin gets a banner", await shows(b, startedSharing));
  await press(b, startedSharing);
  const findMy = windowOf(b, "find-my");
  await findMy.waitFor({ timeout: 20_000 });
  const radio = (name) => findMy.getByRole("radio", { name });
  const onPeople = async () => (await radio("People").getAttribute("aria-checked")) === "true";
  step("pressing it opens Find My on the people list", await seen(onPeople));
  step(
    "and the person is listed there",
    await seen(
      async () => (await findMy.getByRole("option", { name: chris.fullName }).count()) > 0,
    ),
  );
  await radio("Devices").click();
  const asking = await put(a, `/api/find-my/people/${martin.name}/ask`, {});
  step("Chris asks to follow Martin", asking.ok(), `HTTP ${asking.status()}`);
  const asked = `${chris.fullName} asked to follow your location`;
  step("Martin gets a banner, with Devices showing", await shows(b, asked));
  await press(b, asked);
  step("pressing it goes back to the people list", await seen(onPeople));

  // ---- Stocks: the alert's symbol, looked up by the alert's id --------------------------------
  const alertId = `a${id}`;
  const held = await get(b, "/api/stocks/alerts");
  const alertSaved = await put(b, "/api/stocks/alerts", {
    rev: held.rev,
    alerts: [{ id: alertId, symbol: "AAPL", above: 0.01, created: Date.now() }],
  });
  step("Martin sets a price alert that is already crossed", alertSaved.ok());
  const fired = "AAPL rose above 0.01";
  const read = await get(b, "/api/stocks/alerts");
  step(
    "the server fires it from a real quote",
    read.alerts?.[0]?.fired != null,
    JSON.stringify(read.alerts),
  );
  step("Martin gets a banner", await shows(b, fired));
  await press(b, fired);
  await windowOf(b, "stocks").waitFor({ timeout: 20_000 });
  const showsApple = async (page) =>
    seen(
      async () =>
        (await pane(page)
          .textContent()
          .catch(() => "")) === "AAPL",
    );
  step("pressing it opens Stocks on the alert's symbol", await showsApple(b));
  await shot(b, "notification-ids-stocks");

  // ---- Calendar's alert from the server: Close closes, the body opens -------------------------
  await b.reload({ waitUntil: "load" });
  await b
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  const events = await get(b, "/api/calendar/events");
  const soon = Date.now() + 10 * 60_000;
  const closes = `Closes ${id}`;
  const opens = `Standup ${id}`;
  const event = (eventId, title) => ({
    id: eventId,
    title,
    start: soon,
    end: soon + 30 * 60_000,
    calendar: "work",
    alert: 15,
  });
  const savedEvents = await put(b, "/api/calendar/events", {
    rev: events.rev,
    events: [...(events.events ?? []), event(`o-${id}`, opens)],
  });
  step("Martin has an event about to start", savedEvents.ok(), `HTTP ${savedEvents.status()}`);
  step("its alert comes", await shows(b, opens, 60_000));
  await press(b, opens);
  const calendar = windowOf(b, "calendar");
  await calendar.waitFor({ timeout: 20_000 });
  const eventSelected = await seen(
    async () =>
      (await calendar.locator('[aria-pressed="true"]').filter({ hasText: opens }).count()) > 0,
  );
  await shot(b, "notification-ids-calendar");
  step("pressing an alert's body opens Calendar on its event", eventSelected);

  // ---- A banner beside the alert Calendar's own window shows ----------------------------------
  const own = b.locator(".mac-calendar-alerts > *").first();
  await own.waitFor({ timeout: 20_000 });
  const beside = `Beside ${id}`;
  await post(b, "/api/notification-center/notify", { app: "finder", title: beside });
  step("a banner comes while Calendar shows its alert", await shows(b, beside));
  const ownBox = await own.boundingBox();
  const bannerBox = await banner(b, beside).boundingBox();
  step(
    "it stands clear of the alert",
    bannerBox.x + bannerBox.width <= ownBox.x,
    JSON.stringify({ ownBox, bannerBox }),
  );
  const onTop = await banner(b, beside).evaluate((element) => {
    const box = element.getBoundingClientRect();
    return element.contains(
      document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
    );
  });
  step("and nothing covers it", onTop);
  await shot(b, "notification-ids-beside");

  // ---- Stocks kept what the alert chose ------------------------------------------------------
  await b
    .getByRole("button", { name: /^Stocks$/ })
    .first()
    .click();
  await windowOf(b, "stocks").waitFor({ timeout: 20_000 });
  step("after a reload Stocks is still on the alert's symbol", await showsApple(b));

  // ---- An invitation ------------------------------------------------------------------------
  const c = await person("ann", ann);
  const annEvents = await get(c, "/api/calendar/events");
  const closing = await put(c, "/api/calendar/events", {
    rev: annEvents.rev,
    events: [...(annEvents.events ?? []), event(`c-${id}`, closes)],
  });
  step("Ann has an event about to start", closing.ok(), `HTTP ${closing.status()}`);
  step("its alert comes", await shows(c, closes, 60_000));
  await banner(c, closes).getByRole("button", { name: "Close" }).click();
  step(
    "an alert's Close closes it",
    await seen(async () => (await banner(c, closes).count()) === 0, 5_000),
  );
  step("and opens nothing", (await windowOf(c, "calendar").count()) === 0);
  const invite = `Review ${id}`;
  const held2 = await get(a, "/api/calendar/events");
  const inTwoDays = Date.now() + 2 * 86_400_000;
  const invited = await put(a, "/api/calendar/events", {
    rev: held2.rev,
    events: [
      ...(held2.events ?? []),
      {
        id: `i-${id}`,
        title: invite,
        start: inTwoDays,
        end: inTwoDays + 3_600_000,
        calendar: "work",
        invitees: [ann.name],
      },
    ],
  });
  step("Chris invites Ann", invited.ok(), `HTTP ${invited.status()}`);
  const inviteNote = async () =>
    ((await get(c, "/api/notification-center/inbox")).items ?? []).find((item) =>
      String(item.id).startsWith("invite-"),
    );
  step("Ann is told", await seen(inviteNote));
  const told = (await inviteNote())?.title ?? "";
  step("her alert comes", await shows(c, told), told);
  await press(c, told);
  await windowOf(c, "calendar").waitFor({ timeout: 20_000 });
  step("pressing it opens Calendar", true);
  const invitedEvent = windowOf(c, "calendar")
    .locator('[aria-pressed="true"]')
    .filter({ hasText: invite });
  step("with the invited event selected", await seen(async () => (await invitedEvent.count()) > 0));
});

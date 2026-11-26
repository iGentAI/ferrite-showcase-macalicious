#!/usr/bin/env node
// Calendar, Reminders, Find My, Contacts and Spotlight rows of batch 4, in a real browser against the running
// desktop, two real accounts, reading the server where a thing is stored and reloading where it persists:
//   cal: the toolbar's time zone menu draws the window on another clock, types against it and survives a reload;
//        a floating event; Spotlight goes to an event on another day; Decline in Notification Center.
//   rem: the line between rows, by its pixels; At a Location raises its alert when the browser's position (emulated
//        by Playwright) crosses the place, across a reload, and Complete finishes the reminder.
//   find: Add Notification at another place, for me and for a friend, fired by a report and read from their inbox.
//   con: the value menu's Copy and Look Up, and Preferences > vCard Format writes 2.1 in an export.
// Stand-in: `/api/maps/search` is answered by a Playwright route, since the geocoder must not be needed here.
//
//   node e2e/calendar-reminders-batch4-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--only cal,rem,find,con]

import path from "node:path";
import {
  blocks,
  menuPath,
  openCalendar,
  putEvents,
  reopen,
  stored,
  windowOf,
} from "./calendar-kit.mjs";
import { openFromDock, options, twoPeople, within } from "./people-kit.mjs";

const { step, allow, run } = twoPeople("calendar-reminders-batch4");
// Look Up reads Dictionary's own route, whose provider need not know the word or be reachable here.
allow(/api\/dictionary\//);
allow(/console: Failed to load resource: the server responded with a status of (404|502)/);
const { out } = options();
const at = process.argv.indexOf("--only");
const only = at >= 0 ? process.argv[at + 1].split(",") : ["cal", "rem", "find", "con"];
const id = Date.now().toString(36).slice(-6);
const password = `tide-${id}-pool`;
const ann = { name: `b4ann${id}`, fullName: `Ann ${id}`, password };
const bob = { name: `b4bob${id}`, fullName: `Bob ${id}`, password };
const PLACE = "Ferry Building";
const NEAR = { latitude: 37.7955, longitude: -122.3937, accuracy: 20 };
const FAR = { latitude: 37.33, longitude: -121.89, accuracy: 20 };

const seen = (check, ms = 10_000) => within(ms, check).then((took) => took !== null);
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
const shot = (page, name) =>
  page.screenshot({ path: path.join(out, `${name}.png`), timeout: 15_000 }).catch(() => {});
const stubSearch = (page) =>
  page.route("**/api/maps/search*", (route) =>
    route.fulfill({
      json: {
        places: [
          {
            id: "ferry",
            name: PLACE,
            category: "place",
            lat: NEAR.latitude,
            lon: NEAR.longitude,
            address: [],
          },
        ],
      },
    }),
  );
const pick = (page, name) =>
  page
    .getByRole("option", { name, exact: true })
    .or(page.getByRole("menuitemradio", { name, exact: true }))
    .first()
    .click();

// ---- Calendar ------------------------------------------------------------------------------------

const inZone = (zone, ms) =>
  new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" })
    .format(ms)
    .replace(":00", "");
const localZoneName = Intl.DateTimeFormat()
  .resolvedOptions()
  .timeZone.replace(/^.*\//, "")
  .replaceAll("_", " ");

async function calendar(pageA, pageB) {
  await openCalendar(pageA);
  await menuPath(pageA, "Calendar", /^Preferences/);
  await pageA.getByRole("tab", { name: "Advanced" }).click();
  await pageA.getByRole("checkbox", { name: "Turn on time zone support" }).click();
  await seen(async () =>
    JSON.stringify((await api(pageA, "GET", "/api/calendar/settings")).json).includes(
      '"timeZoneSupport":true',
    ),
  );
  await pageA
    .getByRole("region", { name: "Advanced" })
    .last()
    .getByRole("button", { name: "Close" })
    .first()
    .click()
    .catch(() => {});

  const noon = new Date();
  noon.setHours(12, 0, 0, 0);
  const far = new Date(noon.getTime() + 40 * 86_400_000);
  await putEvents(pageA, [
    {
      id: "noon",
      title: `Noon ${id}`,
      start: noon.getTime(),
      end: noon.getTime() + 3_600_000,
      calendar: "work",
    },
    {
      id: "far",
      title: `Faraway ${id}`,
      start: far.getTime(),
      end: far.getTime() + 3_600_000,
      calendar: "work",
    },
    {
      id: "asked",
      title: `Asked ${id}`,
      start: far.getTime() + 7_200_000,
      end: far.getTime() + 10_800_000,
      calendar: "work",
      invitees: [bob.name],
    },
  ]);
  await reopen(pageA);

  const zoneMenu = () =>
    windowOf(pageA)
      .getByRole("combobox", { name: "Time zone of the window" })
      .or(windowOf(pageA).getByRole("button", { name: "Time zone of the window" }))
      .first();
  const block = () =>
    blocks(pageA)
      .filter({ hasText: `Noon ${id}` })
      .first();
  const dateRow = async () => {
    await block().dblclick();
    const row = pageA.getByRole("button", { name: /^Date:/ });
    await row.waitFor({ timeout: 5_000 });
    const text = await row.getAttribute("aria-label");
    await pageA.keyboard.press("Escape");
    await pageA.keyboard.press("Escape");
    return text ?? "";
  };
  await block().waitFor({ timeout: 10_000 });
  const before = (await block().boundingBox())?.y ?? 0;
  await zoneMenu().click();
  await pick(pageA, "Tokyo");
  const tokyoReading = inZone("Asia/Tokyo", noon.getTime());
  const moved = await seen(async () => {
    const now = await block().boundingBox();
    return Boolean(now) && now.y !== before;
  }, 5_000);
  const reading = await dateRow();
  await shot(pageA, "batch4-calendar-tokyo");
  step(
    "Time Zone Support: the toolbar's menu draws the whole window on Tokyo's clock",
    moved && reading.includes(tokyoReading),
    `${reading} wants ${tokyoReading}`,
  );
  const unchanged = (await stored(pageA)).find((event) => event.id === "noon");
  step(
    "the event's instant on the server does not change with what the window shows",
    unchanged?.start === noon.getTime(),
    String(unchanged?.start),
  );

  await reopen(pageA);
  const kept = await zoneMenu().innerText();
  const readingAfter = await dateRow();
  step(
    "the window's zone survives a reload",
    kept.includes("Tokyo") && readingAfter.includes(tokyoReading),
    `${kept} ${readingAfter}`,
  );

  // A new event typed against Tokyo's clock is stored at the instant that reading is.
  await windowOf(pageA).click({ position: { x: 700, y: 12 } });
  await pageA.keyboard.press("Control+n");
  const title = pageA.getByRole("textbox", { name: "Title" });
  await title.waitFor({ timeout: 5_000 });
  await title.fill(`Typed ${id}`);
  await pageA.keyboard.press("Enter");
  const newRow = pageA.getByRole("button", { name: /^Date:/ });
  await newRow.waitFor({ timeout: 5_000 });
  const newLabel = (await newRow.getAttribute("aria-label")) ?? "";
  const typed = async () => (await stored(pageA)).find((event) => event.title === `Typed ${id}`);
  await seen(typed);
  const instant = (await typed())?.start;
  step(
    "a new event made in Tokyo's view is stored at that clock's instant",
    Boolean(instant) && newLabel.includes(inZone("Asia/Tokyo", instant)),
    `${newLabel} / ${instant && inZone("Asia/Tokyo", instant)}`,
  );

  // Floating keeps its reading whatever clock the window is on.
  await newRow.click();
  const zoneOfEvent = pageA
    .getByRole("combobox", { name: "Time zone", exact: true })
    .or(pageA.getByRole("button", { name: "Time zone", exact: true }))
    .first();
  await zoneOfEvent.waitFor({ timeout: 5_000 });
  await zoneOfEvent.click();
  await pick(pageA, "Floating");
  const floated = await seen(async () => (await typed())?.floating === true);
  const stay = await typed();
  await pageA.keyboard.press("Escape");
  await pageA.keyboard.press("Escape");
  await pageA.waitForTimeout(300);
  const floatingBlock = () =>
    blocks(pageA)
      .filter({ hasText: `Typed ${id}` })
      .first();
  await floatingBlock().waitFor({ timeout: 5_000 });
  const floatingTop = (await floatingBlock().boundingBox())?.y;
  await zoneMenu().click();
  await pick(pageA, localZoneName);
  await pageA.waitForTimeout(500);
  const floatingBack = (await floatingBlock().boundingBox())?.y;
  const noonBack = await dateRow();
  step(
    "Floating: stored with the zone it was written in, and drawn the same on either clock",
    floated && Boolean(stay?.timeZone) && floatingTop === floatingBack,
    `${stay?.floating} ${stay?.timeZone} ${floatingTop} ${floatingBack}`,
  );
  step(
    "choosing the browser's zone puts the window back",
    noonBack.includes(inZone(Intl.DateTimeFormat().resolvedOptions().timeZone, noon.getTime())),
    noonBack,
  );
  await reopen(pageA);
  step("a floating event comes back floating after a reload", (await typed())?.floating === true);

  // Spotlight goes to the day of an event far from the one shown.
  await pageA.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = pageA.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill(`Faraway ${id}`);
  await pageA
    .getByRole("option", { name: new RegExp(`^Faraway ${id}`) })
    .first()
    .waitFor({ timeout: 10_000 });
  await pageA.waitForTimeout(300);
  const offered = await pageA
    .getByRole("listbox")
    .first()
    .innerText()
    .catch(() => "");
  await field.press("Enter");
  const farBlock = blocks(pageA)
    .filter({ hasText: `Faraway ${id}` })
    .first();
  const wentThere = await seen(() => farBlock.isVisible());
  step(
    "Spotlight finds an event on another day: Return goes to that day, with the event there",
    wentThere,
    wentThere
      ? ""
      : `${offered.replace(/\s+/g, " ").slice(0, 200)} | ${(await windowOf(pageA).innerText()).replace(/\s+/g, " ").slice(0, 200)}`,
  );
  await shot(pageA, "batch4-calendar-spotlight");

  // Dragged out of Spotlight onto Finder, the event lands on the drive as an iCalendar file.
  await pageA
    .getByRole("toolbar", { name: "Dock" })
    .getByRole("button", { name: "Finder" })
    .click();
  const finder = pageA.locator(".mac-window.mac-finder").first();
  await finder.waitFor({ timeout: 10_000 });
  await finder.getByRole("treeitem", { name: "Documents", exact: true }).click();
  await pageA.waitForTimeout(500);
  const into = await finder.getByRole("listbox").first().boundingBox();
  await pageA.getByRole("menuitem", { name: "Spotlight" }).click();
  await field.fill(`Faraway ${id}`);
  const result = pageA.getByRole("option", { name: new RegExp(`^Faraway ${id}`) }).first();
  await result.waitFor({ timeout: 10_000 });
  const from = await result.boundingBox();
  await pageA.mouse.move(from.x + 30, from.y + 8);
  await pageA.mouse.down();
  await pageA.mouse.move(from.x + 60, from.y + 40, { steps: 5 });
  await pageA.mouse.move(into.x + into.width * 0.6, into.y + into.height * 0.6, { steps: 8 });
  await pageA.waitForTimeout(300);
  await pageA.mouse.up();
  const landed = await seen(async () =>
    JSON.stringify((await api(pageA, "GET", "/api/files/")).json).includes(`Faraway ${id}.ics`),
  );
  step("Dragging an event out of Spotlight onto Finder keeps it as an .ics on the drive", landed);
  // Decline in Notification Center reaches the organizer.
  await seen(async () => {
    await api(pageA, "GET", "/api/calendar/sent");
    return ((await api(pageB, "GET", "/api/calendar/inbox")).json.invitations ?? []).length > 0;
  });
  const center = pageB.getByRole("complementary", { name: "Notification Center" });
  await pageB.getByRole("menuitem", { name: "Notification Center", exact: true }).first().click();
  await center.waitFor({ timeout: 8_000 });
  await center.getByRole("tab", { name: "Notifications" }).click();
  await center
    .getByText(new RegExp(`Asked ${id}`))
    .first()
    .waitFor({ timeout: 10_000 });
  await shot(pageB, "batch4-calendar-center");
  await center.getByRole("button", { name: "Decline" }).first().click();
  const declined = await seen(async () => {
    const sent = (await api(pageA, "GET", "/api/calendar/sent")).json.events?.asked ?? [];
    return sent[0]?.status === "declined";
  });
  const gone = await seen(
    async () => (await center.getByText(new RegExp(`Asked ${id}`)).count()) === 0,
  );
  step(
    "Invitations in Notification Center: Decline reaches the organizer, and the offer goes",
    declined && gone,
    `${declined} ${gone}`,
  );
  await pageB
    .getByRole("menuitem", { name: "Notification Center", exact: true })
    .first()
    .click()
    .catch(() => {});
}

// ---- Reminders -----------------------------------------------------------------------------------

async function reminders(page) {
  await stubSearch(page);
  const context = page.context();
  await context.setGeolocation(FAR);
  await openFromDock(page, "Reminders");
  const windowR = page.getByRole("region", { name: "Reminders" }).first();
  const add = async (text) => {
    await windowR.getByRole("button", { name: "New Reminder" }).click();
    const field = windowR.getByRole("textbox", { name: "Title" });
    await field.waitFor({ timeout: 5_000 });
    await field.fill(text);
    await field.press("Enter");
  };
  const server = async (text) =>
    ((await api(page, "GET", "/api/reminders/data")).json.data?.reminders ?? []).find(
      (each) => each.title === text,
    );
  const TITLE = `Ferry ${id}`;
  await add(TITLE);
  await add(`Second ${id}`);
  await add(`Third ${id}`);
  await seen(() => server(`Third ${id}`));
  await page.keyboard.press("Escape").catch(() => {});

  // The line under a row: one point, drawn from the text on, by the pixels of the screenshot.
  const row = windowR.getByRole("option").filter({ hasText: TITLE }).first();
  const box = await row.boundingBox();
  const shotOf = await page.screenshot({
    clip: { x: box.x, y: box.y + box.height - 4, width: box.width, height: 8 },
  });
  const line = await page.evaluate(
    async (data) => {
      const image = await createImageBitmap(await (await fetch(data)).blob());
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      const column = (x) =>
        [...Array(image.height).keys()].map((y) => {
          const [r, g, b] = context.getImageData(x, y, 1, 1).data;
          return r + g + b;
        });
      const inset = column(10);
      const text = column(Math.round(image.width / 2));
      const spread = (values) => Math.max(...values) - Math.min(...values);
      const lineRows = text.filter((value) => value < Math.max(...text)).length;
      return { inset: spread(inset), text: spread(text), lineRows };
    },
    `data:image/png;base64,${shotOf.toString("base64")}`,
  );
  step(
    "Rows with separators: a one-point line under a row, from the text on, not in the gutter",
    line.text > 0 && line.inset === 0 && line.lineRows === 1,
    JSON.stringify(line),
  );

  // At a Location.
  await row.click();
  await row.locator("[data-reminder-info]").click({ force: true });
  const info = page.locator(".mac-reminders-info").first();
  await info.waitFor({ timeout: 5_000 });
  await info.getByRole("checkbox", { name: "At a Location" }).click();
  await info.getByRole("textbox", { name: "Location" }).fill(PLACE);
  await seen(async () => (await server(TITLE))?.atLocation === true);
  await shot(page, "batch4-reminders-location");
  step(
    "At a Location: says when the alert comes",
    (await info.innerText()).includes("while Reminders is open"),
  );
  await page.keyboard.press("Escape");
  // The far position is heard first: a first position alone raises nothing.
  const alerts = page.locator(".mac-reminders-alerts");
  await page.waitForTimeout(3_000);
  step("no alert while the browser is away from the place", (await alerts.count()) === 0);
  await context.setGeolocation(NEAR);
  const raised = await seen(
    async () => (await alerts.innerText()).includes(`arriving at ${PLACE}`),
    15_000,
  );
  await shot(page, "batch4-reminders-alert");
  step("arriving at the place raises the reminder's alert", raised);

  await page.reload({ waitUntil: "load" });
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  if ((await page.getByRole("region", { name: "Reminders" }).count()) === 0) {
    await openFromDock(page, "Reminders");
  }
  step(
    "the alert is still there after a reload, until it is closed",
    await seen(async () => (await alerts.innerText()).includes(PLACE), 15_000),
  );
  await alerts.getByRole("button", { name: "Close" }).click();
  await seen(async () => (await alerts.count()) === 0);
  await page.reload({ waitUntil: "load" });
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  if ((await page.getByRole("region", { name: "Reminders" }).count()) === 0) {
    await openFromDock(page, "Reminders");
  }
  await page.waitForTimeout(3_000);
  step("closed, it does not come back on a reload", (await alerts.count()) === 0);
  await context.setGeolocation(FAR);
  await page.waitForTimeout(2_500);
  await context.setGeolocation(NEAR);
  await seen(async () => (await alerts.innerText()).includes(PLACE), 15_000);
  await alerts.getByRole("button", { name: "Complete" }).click();
  step(
    "coming back raises it again, and Complete finishes the reminder on the server",
    await seen(async () => (await server(TITLE))?.completed === true),
  );
}

// ---- Find My -------------------------------------------------------------------------------------

const PEOPLE = "/api/find-my/people";
async function openFindMy(page) {
  const library = await api(page, "GET", "/api/app-store/library");
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(library.json.installed ?? []), "find-my"])],
    rev: library.json.rev,
  });
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: "load" });
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Find My");
  await page.waitForTimeout(300);
  await field.press("Enter");
  const window = page.getByRole("region", { name: "Find My", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  return window;
}

async function findMy(pageA, pageB) {
  await stubSearch(pageA);
  await stubSearch(pageB);
  await pageA.context().setGeolocation(FAR);
  await api(pageA, "PUT", `${PEOPLE}/${bob.name}/share`);
  const windowA = await openFindMy(pageA);
  const windowB = await openFindMy(pageB);
  const person = (page, name) => page.getByRole("option", { name: new RegExp(name) }).first();
  const sheet = (page) => page.locator(".mac-sheet-popup, [role='dialog']").last();
  const addAt = async (page, window, name) => {
    await window
      .getByRole("tab", { name: "People" })
      .click()
      .catch(() => {});
    await person(page, name).click();
    await window
      .getByRole("button", { name: /^Add Notification/ })
      .first()
      .click();
    const panel = sheet(page);
    await panel.getByText("Add Notification").first().waitFor({ timeout: 5_000 });
    const where = panel
      .getByRole("combobox", { name: "Where:" })
      .or(panel.getByRole("button", { name: /^Where/ }))
      .first();
    await where.click();
    await pick(page, "Another Place");
    await panel.getByRole("textbox", { name: "Place" }).fill(PLACE);
    await panel.getByRole("button", { name: "Add", exact: true }).click();
  };
  const of = async (page, name) =>
    ((await api(page, "GET", PEOPLE)).json.people ?? []).find((each) => each.name === name);

  await addAt(pageA, windowA, bob.fullName);
  step(
    "Notify a friend: a rule at a named place, on the server",
    await seen(async () => (await of(pageA, bob.name))?.tell?.label === PLACE),
    JSON.stringify((await of(pageA, bob.name))?.tell),
  );
  await shot(pageA, "batch4-find-my-tell");
  await pageA.reload({ waitUntil: "load" });
  await pageA
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  step("and it is there after a reload", (await of(pageA, bob.name))?.tell?.kind === "arrive");

  await addAt(pageB, windowB, ann.fullName);
  step(
    "Notify me about a friend at another place, on the server",
    await seen(async () => (await of(pageB, ann.name))?.rule?.label === PLACE),
  );

  const report = (spot) =>
    api(pageA, "PUT", "/api/find-my/me", {
      lat: spot.latitude,
      lon: spot.longitude,
      accuracy_m: 20,
      label: "Chromium on Linux",
      reported_at: Date.now(),
    });
  await pageA.context().setGeolocation(FAR);
  await report(FAR);
  await pageA.waitForTimeout(300);
  await pageA.context().setGeolocation(NEAR);
  await report(NEAR);
  const titles = async () =>
    ((await api(pageB, "GET", "/api/notification-center/inbox")).json.items ?? [])
      .filter((item) => item.note?.app === "find-my" || item.app === "find-my")
      .map((item) => item.note?.title ?? item.title);
  const told = await seen(
    async () =>
      (await titles()).filter((title) => title === `${ann.fullName} arrived at ${PLACE}`).length >=
      2,
  );
  step(
    "a report arriving there tells the friend, by both rules, read from their inbox",
    told,
    JSON.stringify(await titles()),
  );
  step(
    "each rule that fires once is gone after",
    !(await of(pageA, bob.name))?.tell && !(await of(pageB, ann.name))?.rule,
  );
}

// ---- Contacts ------------------------------------------------------------------------------------

const pageClose = (page) => page.waitForTimeout(800);

async function contacts(page) {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await openFromDock(page, "Contacts");
  const windowC = page.locator('.mac-contacts[aria-label="Contacts"]').first();
  const NUMBER = "(555) 010-0404";
  const FIRST = `Asa${id}`;
  const file = {
    name: "card.vcf",
    mimeType: "text/vcard",
    buffer: Buffer.from(
      `BEGIN:VCARD\r\nVERSION:3.0\r\nN:Lind;${FIRST};;;\r\nFN:${FIRST} Lind\r\nTEL;TYPE=CELL:${NUMBER}\r\nIMPP;X-SERVICE-TYPE=Jabber:xmpp:harbor\r\nNOTE:Köper\r\nEND:VCARD\r\n`,
    ),
  };
  const menu = async (title, item) => {
    await page
      .getByRole("menubar")
      .getByRole("menuitem", { name: title, exact: true })
      .first()
      .click();
    await page.getByRole("menu").last().getByRole("menuitem", { name: item }).click();
  };
  await windowC.getByRole("listbox").getByRole("option").first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(500);
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    (async () => {
      await page
        .getByRole("menubar")
        .getByRole("menuitem", { name: "File", exact: true })
        .first()
        .click();
      await page
        .getByRole("menu")
        .last()
        .getByRole("menuitem", { name: /^Import/ })
        .click();
    })(),
  ]);
  await chooser.setFiles(file);
  const told = page.getByRole("alertdialog").last();
  await told.waitFor({ timeout: 10_000 });
  const said = (await told.innerText()).replace(/\s+/g, " ");
  await told.getByRole("button").last().click();
  console.log(`note: importing said: ${said}`);
  await pageClose(page);
  console.log(
    `note: the list reads: ${(await windowC.innerText()).replace(/\s+/g, " ").slice(0, 300)}`,
  );
  const row = windowC.getByRole("listbox").getByRole("option").filter({ hasText: FIRST }).first();
  await row.waitFor({ timeout: 10_000 });
  await row.click();

  const number = windowC.getByText(NUMBER).first();
  await number.waitFor({ timeout: 8_000 });
  await number.click({ button: "right" });
  const fieldMenu = page.getByRole("menu", { name: "Field commands" });
  await fieldMenu.waitFor({ timeout: 5_000 });
  await fieldMenu.getByRole("menuitem", { name: "Copy", exact: true }).click();
  step(
    "Field value: Copy puts the value on the clipboard",
    await seen(async () => (await page.evaluate(() => navigator.clipboard.readText())) === NUMBER),
  );
  await number.click({ button: "right" });
  await fieldMenu.waitFor({ timeout: 5_000 });
  const lookUpItem = fieldMenu.getByRole("menuitem", { name: "Look Up", exact: true });
  step(
    "Field value: Look Up is dimmed for a phone number, saying why",
    (await lookUpItem.getAttribute("aria-disabled")) === "true" &&
      /looks up words/.test((await lookUpItem.getAttribute("title")) ?? ""),
  );
  await page.keyboard.press("Escape");
  await windowC.getByText("harbor").first().click({ button: "right" });
  await fieldMenu.waitFor({ timeout: 5_000 });
  await lookUpItem.click();
  const dictionary = page.locator('[data-window-id="dictionary"]').first();
  const lookedUp = async () =>
    dictionary
      .getByRole("searchbox")
      .first()
      .inputValue()
      .catch((error) => String(error).slice(0, 80));
  const wordShown = await seen(async () => (await lookedUp()).toLowerCase() === "harbor");
  step("Field value: Look Up opens Dictionary on a word", wordShown, await lookedUp());
  await shot(page, "batch4-contacts-lookup");

  await page
    .getByRole("toolbar", { name: "Dock" })
    .getByRole("button", { name: "Contacts" })
    .click();
  await page.waitForTimeout(500);
  await menu("Contacts", /^Preferences/);
  await page.getByRole("tab", { name: "vCard" }).click();
  const format = page
    .getByRole("combobox", { name: "vCard Format" })
    .or(page.getByRole("button", { name: "vCard Format" }))
    .first();
  await format.click();
  await pick(page, "2.1");
  await page.waitForTimeout(1_000);
  await page.reload({ waitUntil: "load" });
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  if ((await windowC.count()) === 0) await openFromDock(page, "Contacts");
  await row.waitFor({ timeout: 10_000 });
  await row.click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    (async () => {
      await page
        .getByRole("menubar")
        .getByRole("menuitem", { name: "File", exact: true })
        .first()
        .click();
      await page
        .getByRole("menu")
        .last()
        .getByRole("menuitem", { name: /^Export$/ })
        .hover();
      await page.getByRole("menuitem", { name: /^Export vCard…/ }).click();
    })(),
  ]);
  const { readFile } = await import("node:fs/promises");
  const text = await readFile(await download.path(), "utf8");
  step(
    "vCard Format 2.1, kept across a reload, writes the export in 2.1",
    text.includes("VERSION:2.1") && text.includes("NOTE;ENCODING=QUOTED-PRINTABLE"),
    text.split("\r\n").slice(0, 3).join(" | "),
  );
}

await run(
  {},
  { chromium: { permissions: ["geolocation"], geolocation: FAR } },
  async ({ person }) => {
    const pageA = await person("ann", ann);
    const pageB = await person("bob", bob);
    if (only.includes("cal")) await calendar(pageA, pageB);
    if (only.includes("rem")) await reminders(pageA);
    if (only.includes("find")) await findMy(pageA, pageB);
    if (only.includes("con")) await contacts(pageB);
  },
);

#!/usr/bin/env node

// The seventh batch of cross-app rows, two real accounts in a real browser, reading the server where a thing is stored
// and reloading where it persists:
//   alerts:  with Calendar closed, a repeating, a floating, a birthday's and an accepted invitation's alert reach
//            Notification Center from the desktop shell, each once, and Close is saved; with the window open it shows
//            there and no notification is left.
//   photos:  Edit With > Preview opens a copy, and its save comes back as the photo's edit; Revert takes it away.
//   pdf:     a PDF opened in Preview is found by its words in Spotlight's index, across a reload.
//   help:    the Help menu finds Speech's rows, which a shared component draws, and points at one.
//   news:    Spotlight's News suggestions, from stories a stand-in for the feeds answers (`page.route`), since the real
//            ones come from publishers outside the app; the catalogue and the person's library are the real routes.
//   siri:    "Change it to 5" edits the reminder Siri just made, read from the server.
//   place:   Spotlight moved low stops with its resize edge clear of the Dock, and stays so across a reload.
//
//   node e2e/cross-batch7-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--only alerts,photos,pdf,help,news,siri,place]

import { windowOf as calendarOf, putEvents, stored, timed } from "./calendar-kit.mjs";
import { twoPeople, within } from "./people-kit.mjs";

const { step, allow, run, shot } = twoPeople("cross-batch7");
// The route refuses what is no PDF of the drive, on purpose.
allow(/HTTP 404: \S*\/api\/spotlight\/pdf-text/);
allow(/console: Failed to load resource: the server responded with a status of 404/);
const at = process.argv.indexOf("--only");
const only = at >= 0 ? process.argv[at + 1].split(",") : null;
const wanted = (part) => !only || only.includes(part);
const id = Date.now().toString(36).slice(-6);
const password = `tide-${id}-pool`;
const annAccount = { name: `x7ann${id}`, fullName: `Ann ${id}`, password };
const bobAccount = { name: `x7bob${id}`, fullName: `Bob ${id}`, password };

const seen = (check, ms = 12_000) => within(ms, check).then((took) => took !== null);
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
const reload = async (page) => {
  await page.reload({ waitUntil: "load" });
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
};
const spotlight = (page) => page.getByRole("combobox", { name: "Spotlight Search" });
const launch = async (page, name) => {
  await page.getByRole("menuitem", { name: "Spotlight", exact: true }).first().click();
  await spotlight(page).fill(name);
  await page
    .getByRole("option", { name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })
    .first()
    .waitFor({ timeout: 20_000 });
  await page.waitForTimeout(500);
  await spotlight(page).press("Enter");
};
const closeSpotlight = async (page) => {
  for (let times = 0; times < 2 && (await spotlight(page).count()) > 0; times += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  }
};

// ---- Alerts with Calendar closed -------------------------------------------------------------------

const inbox = async (page) =>
  (await api(page, "GET", "/api/notification-center/inbox")).json.items ?? [];
const withId = (items, wantedId) => items.filter((item) => item.id === wantedId);
const SETTINGS = {
  daysPerWeek: 7,
  weekStartsOn: 0,
  scrollBy: "week",
  dayStartsAt: 8,
  dayEndsAt: 20,
  hoursShown: 12,
  defaultCalendar: "selected",
  showBirthdays: true,
  showHolidays: false,
  showAlternateCalendar: false,
  defaultAlert: 15,
  defaultAllDayAlert: 0,
  defaultBirthdayAlert: -1,
};
const putSettings = async (page) => {
  const { json } = await api(page, "GET", "/api/calendar/settings");
  const put = await api(page, "PUT", "/api/calendar/settings", {
    settings: { ...SETTINGS, defaultAllDayAlert: undefined },
    rev: json.rev,
  });
  if (put.status !== 200) throw new Error(`PUT settings answered ${put.status}`);
};
const today = () => new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" });

async function alerts(ann, bob) {
  const start = Date.now() + 5 * 60_000;
  const titles = {
    daily: `Daily ${id}`,
    loose: `Loose ${id}`,
    once: `Once ${id}`,
  };
  await putSettings(ann);
  const cards = await api(ann, "GET", "/api/contacts/cards");
  const card = `bday${id}`;
  await api(ann, "PUT", "/api/contacts/cards", {
    rev: cards.json.rev,
    cards: [
      ...(cards.json.cards ?? []),
      { id: card, account: "icloud", first: "Pat", last: id, birthday: today() },
    ],
  });
  await putEvents(ann, [
    timed("daily", titles.daily, start, 30, { alert: 15, repeat: { freq: "daily" } }),
    timed("loose", titles.loose, start, 30, {
      alert: 15,
      floating: true,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
    timed("once", titles.once, start, 30, { alert: 15 }),
  ]);
  await reload(ann);
  const ids = {
    daily: `alert:daily@${start}`,
    loose: `alert:loose@${start}`,
    once: `alert:once@${start}`,
  };
  const birthdayNote = async () =>
    (await inbox(ann)).find((item) => item.id.startsWith(`alert:birthday-${card}@`));
  const raised = await seen(async () => {
    const items = await inbox(ann);
    return (
      withId(items, ids.daily).length === 1 &&
      withId(items, ids.loose).length === 1 &&
      withId(items, ids.once).length === 1 &&
      (await birthdayNote()) !== undefined
    );
  }, 45_000);
  const items = await inbox(ann);
  const daily = withId(items, ids.daily)[0];
  step(
    "Alert: a repeating, a floating and a birthday's alert reach Notification Center with no window open",
    raised && (await calendarOf(ann).count()) === 0,
    JSON.stringify(items.map((item) => item.id)),
  );
  step(
    "Alert: the page says when it is, and the server its own single event as before",
    / to /.test(daily?.body ?? "") &&
      /^Starts in/.test(withId(items, ids.once)[0]?.body ?? "") &&
      /^All day/.test((await birthdayNote())?.body ?? ""),
    `${daily?.body} | ${withId(items, ids.once)[0]?.body} | ${(await birthdayNote())?.body}`,
  );
  await shot(ann, "cross7-alert-no-window");

  const closedDaily = await api(ann, "POST", `/api/calendar${daily.dismiss}`, {});
  const birthday = await birthdayNote();
  const closedBirthday = await api(ann, "POST", `/api/calendar${birthday.dismiss}`, {});
  const others = await api(ann, "GET", "/api/calendar/alerts/others");
  step(
    "Alert: Close on a repeating one is saved with the event, a birthday's beside the document",
    closedDaily.json?.changed === true &&
      closedBirthday.json?.changed === true &&
      (await stored(ann)).find((each) => each.id === "daily")?.alertDismissed === start &&
      typeof others.json?.alerts?.[`birthday-${card}`]?.dismissed === "number",
    JSON.stringify(others.json),
  );
  await reload(ann);
  await ann.waitForTimeout(6_000);
  const after = await inbox(ann);
  step(
    "Alert: nothing is raised a second time across a reload and another look",
    withId(after, ids.daily).length === 1 &&
      withId(after, ids.loose).length === 1 &&
      after.filter((item) => item.id.startsWith(`alert:birthday-${card}@`)).length === 1,
    JSON.stringify(after.map((item) => item.id)),
  );

  // An accepted invitation, which only the page can give the default alerts.
  await putSettings(bob);
  await putEvents(ann, [
    ...(await stored(ann)),
    timed("asked", `Asked ${id}`, start, 30, { invitees: [bobAccount.name] }),
  ]);
  let invitation;
  await seen(async () => {
    const reply = await api(bob, "GET", "/api/calendar/inbox");
    invitation = reply.json?.invitations?.[0];
    return invitation !== undefined;
  }, 20_000);
  const accepted = await api(
    bob,
    "POST",
    `/api/calendar/inbox/${invitation.id}/${invitation.version}/accept`,
    {},
  );
  await reload(bob);
  const invitedId = `alert:invitation-${invitation.id}@${start}`;
  const invited = await seen(async () => withId(await inbox(bob), invitedId).length === 1, 45_000);
  const note = withId(await inbox(bob), invitedId)[0];
  step(
    "Alert: an accepted invitation's reaches Notification Center with no window open",
    accepted.status === 200 && invited && note?.title === `Asked ${id}`,
    JSON.stringify(note),
  );
  const closed = await api(bob, "POST", `/api/calendar${note.dismiss}`, {});
  const bobOthers = await api(bob, "GET", "/api/calendar/alerts/others");
  step(
    "Alert: Close on it is kept",
    closed.json?.changed === true &&
      bobOthers.json?.alerts?.[`invitation-${invitation.id}`]?.dismissed === start,
    JSON.stringify(bobOthers.json),
  );

  // With the window open: it shows there, and no notification is left in the inbox.
  const shownTitle = `Windowed ${id}`;
  const windowStart = Date.now() + 6 * 60_000;
  await api(bob, "POST", "/api/calendar/alerts/raise", { alerts: [] });
  await launch(bob, "Calendar");
  await calendarOf(bob).locator(".mac-calendar-body:not([inert])").waitFor({ timeout: 20_000 });
  await putEvents(bob, [
    ...(await stored(bob)),
    timed("windowed", shownTitle, windowStart, 30, { alert: 15, repeat: { freq: "daily" } }),
  ]);
  await reload(bob);
  if ((await calendarOf(bob).count()) === 0) await launch(bob, "Calendar");
  const windowed = `alert:windowed@${windowStart}`;
  const inWindow = await seen(
    () => bob.getByText(shownTitle, { exact: true }).first().isVisible(),
    20_000,
  );
  const none = await seen(async () => withId(await inbox(bob), windowed).length === 0, 12_000);
  await bob.waitForTimeout(3_000);
  step(
    "Alert: with the window open it shows there, and no notification stays",
    inWindow && none && withId(await inbox(bob), windowed).length === 0,
    JSON.stringify((await inbox(bob)).map((item) => item.id)),
  );
  await calendarOf(bob).getByRole("button", { name: "Close", exact: true }).first().click();
  await bob.waitForTimeout(6_000);
  step(
    "Alert: closing the window does not raise what it showed",
    withId(await inbox(bob), windowed).length === 0,
  );
}

// ---- Photos' Edit With ---------------------------------------------------------------------------

const library = async (page) => (await api(page, "GET", "/api/photos/library")).json;
const drive = async (page) => (await api(page, "GET", "/api/files/")).json;
const settingOf = async (page, key) =>
  (await api(page, "GET", "/api/system-preferences/settings")).json.values?.[key];

async function photos(page) {
  const name = `Shore ${id}`;
  await launch(page, "Photos");
  const win = page.locator(".mac-window:has(.mac-photos-body)").first();
  await win.waitFor({ timeout: 15_000 });
  await within(10_000, async () => !(await win.getAttribute("aria-busy")));
  const transfer = await page.evaluateHandle(async (name) => {
    const data = new DataTransfer();
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 360;
    const context = canvas.getContext("2d");
    context.fillStyle = "hsl(80 70% 50%)";
    context.fillRect(0, 0, 480, 360);
    const blob = await new Promise((done) => canvas.toBlob(done, "image/jpeg", 0.9));
    data.items.add(new File([blob], `${name}.jpg`, { type: "image/jpeg" }));
    return data;
  }, name);
  await win
    .locator("input[type=file]")
    .first()
    .evaluate((input, data) => {
      input.files = data.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, transfer);
  const tile = win.locator(`[aria-label^="${name}"]`).first();
  await tile.waitFor({ timeout: 30_000 });
  const before = (await library(page)).photos.find((photo) => photo.name === name);
  const row = (text) => page.getByRole("menuitem", { name: text, exact: true }).first();

  await tile.click({ button: "right" });
  await row("Edit With").click();
  await page.waitForTimeout(200);
  await row("Preview").click();
  // Earlier parts can leave a Preview window open, so this one is the window holding the photo.
  const preview = page
    .locator('.mac-managed-window[data-window-id^="preview"]')
    .filter({ hasText: name })
    .first();
  await preview.waitFor({ timeout: 15_000 });
  await seen(() => preview.locator(".mac-preview-app-page-canvas").first().isVisible(), 15_000);
  const copies = await settingOf(page, "photos.editWith");
  const copy = copies?.[before.file];
  step(
    "Edit With opens a copy of the photo, leaving the original where it is",
    copy?.photo === before.id && copy?.open !== before.file,
    JSON.stringify(copies),
  );

  await preview.getByRole("button", { name: "Rotate Left" }).first().click();
  await preview.getByRole("document").first().focus();
  // A file opening keeps Preview busy a moment, and Save then does nothing: asked again until it has.
  const back = await seen(async () => {
    await page.keyboard.press("Control+s");
    return within(
      4_000,
      async () =>
        (await library(page)).photos.find((photo) => photo.id === before.id)?.edit != null,
    ).then((took) => took !== null);
  }, 20_000);
  const after = (await library(page)).photos.find((photo) => photo.id === before.id);
  const kept = (await settingOf(page, "photos.editWith"))?.[before.file];
  const entries = (await drive(page)).entries;
  const original = entries.find((entry) => entry.id === before.file);
  step(
    "Preview's save comes back as the photo's edit, the original untouched",
    back &&
      after.file === before.file &&
      original?.trashed_ms === undefined &&
      typeof kept?.base === "string" &&
      kept.base !== before.file &&
      entries.some((entry) => entry.id === kept.base && entry.trashed_ms === undefined),
    JSON.stringify({ after: after?.edit, kept }),
  );
  await shot(page, "cross7-photos-edit-with");
  await preview.getByRole("button", { name: "Close", exact: true }).first().click();

  await reload(page);
  // Preview's other windows come back over Photos: launching brings it to the front.
  await launch(page, "Photos");
  await win.waitFor({ timeout: 15_000 });
  await tile.waitFor({ timeout: 30_000 });
  await tile.dblclick();
  const turned = await seen(
    () =>
      win
        .locator('img[src^="blob:"]')
        .evaluateAll((images) => images.some((image) => image.naturalHeight > image.naturalWidth)),
    15_000,
  );
  await shot(page, "cross7-photos-edit-back");
  step(
    "After a reload the photo shows what Preview saved: turned, 360 by 480",
    turned && (await library(page)).photos.find((p) => p.id === before.id)?.edit != null,
  );

  await page.getByRole("menubar").getByRole("menuitem", { name: "Image", exact: true }).click();
  await row("Revert to Original").click();
  const reverted = await seen(
    async () => (await library(page)).photos.find((photo) => photo.id === before.id)?.edit === null,
    12_000,
  );
  const left = await seen(
    async () => (await settingOf(page, "photos.editWith"))?.[before.file] === undefined,
    8_000,
  );
  const drawn = await seen(
    () =>
      win
        .locator('img[src^="blob:"]')
        .evaluateAll((images) =>
          images.some((image) => image.naturalWidth === 480 && image.naturalHeight === 360),
        ),
    15_000,
  );
  step("Revert takes it all back: the original shows, the copy is gone", reverted && left && drawn);
}

// ---- PDFs in Spotlight -----------------------------------------------------------------------------

function pdfOf(text) {
  const content = `BT /F1 24 Tf 72 700 Td (${text}) Tj ET`;
  const objects = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>",
    `<</Length ${content.length}>>\nstream\n${content}\nendstream`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ];
  let file = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const offset = file.length;
    file += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const start = file.length;
  file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) file += `${String(offset).padStart(10, "0")} 00000 n \n`;
  file += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(file, "latin1").toString("base64");
}

const upload = (page, parent, name, type, data) =>
  page.evaluate(
    async ({ parent, name, type, data }) => {
      const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
      const json = { "content-type": "application/json" };
      const started = await fetch("/api/files/uploads", {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: JSON.stringify({ parent, name, size: bytes.length, type, existing: "rename" }),
      });
      const { upload } = await started.json();
      await fetch(`/api/files/uploads/${upload}/0`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/octet-stream" },
        body: bytes,
      });
      await fetch(`/api/files/uploads/${upload}/complete`, {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: "{}",
      });
    },
    { parent, name, type, data },
  );

async function pdf(page) {
  const word = `Quillwort${id}`;
  const name = `Survey ${id}.pdf`;
  await upload(page, "documents", name, "application/pdf", pdfOf(`The ${word} grows here`));
  const search = async () =>
    (await api(page, "GET", `/api/spotlight/search?q=${word}&only=contents`)).json.results ?? [];
  step("Before Preview reads it, the PDF's words are not found", (await search()).length === 0);
  const refused = await api(page, "POST", "/api/spotlight/pdf-text", {
    file: "documents",
    text: "never kept",
  });
  step("The route takes the words of a PDF of the drive alone", refused.status === 404);

  await launch(page, name);
  const preview = page.locator('.mac-managed-window[data-window-id="preview"]').first();
  await preview.waitFor({ timeout: 15_000 });
  const found = await seen(
    async () => (await search()).some((item) => item.title === name),
    20_000,
  );
  step("A PDF opened in Preview is found by its words", found, JSON.stringify(await search()));

  await reload(page);
  await closeSpotlight(page);
  await page.getByRole("menuitem", { name: "Spotlight", exact: true }).first().click();
  await spotlight(page).fill(word);
  const option = page.getByRole("option", { name: new RegExp(name) }).first();
  const inSpotlight = await seen(() => option.isVisible(), 15_000);
  await shot(page, "cross7-pdf-spotlight");
  step("Across a reload, Spotlight's window lists the PDF for the word", inSpotlight);
  await closeSpotlight(page);
}

// ---- Help menu -------------------------------------------------------------------------------------

async function help(page) {
  await launch(page, "Dictionary");
  await page
    .locator('.mac-managed-window[data-window-id="dictionary"]')
    .first()
    .waitFor({ timeout: 45_000 });
  await page.getByRole("menubar").getByRole("menuitem", { name: "Help", exact: true }).click();
  await page.getByRole("menu").getByRole("searchbox", { name: "Search" }).waitFor();
  await page.keyboard.type("speaking", { delay: 30 });
  const result = page.getByRole("menuitem", { name: "Edit ▸ Speech ▸ Start Speaking" });
  const listed = await seen(() => result.isVisible(), 8_000);
  step("The Help menu lists Speech's rows, drawn by a shared component", listed);
  await shot(page, "cross7-help-speech");
  await result.click();
  const pointed = await seen(
    async () => (await page.locator(".mac-help-viewer-menu-arrow").count()) === 1,
    8_000,
  );
  step(
    "and choosing one opens Edit, then Speech, with the arrow beside the row",
    pointed && (await page.getByRole("menuitem", { name: "Start Speaking" }).count()) >= 1,
  );
  await shot(page, "cross7-help-speech-arrow");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
}

// ---- News in Spotlight -----------------------------------------------------------------------------

async function news(page) {
  const word = `Marram${id}`;
  await page.route("**/api/news/sources/*", (route) =>
    route.fulfill({
      json: {
        source: { id: "standin", publisher: "Stand-in Times" },
        fetched: Date.now(),
        stale: false,
        stories: [
          {
            id: `story-${id}`,
            title: `${word} grass holds the dunes`,
            link: "https://example.com/dunes",
            summary: "A story the journey answers in place of a publisher's feed.",
          },
        ],
      },
    }),
  );
  // What was read before the stand-in stood in serves for five minutes: a new page reads afresh.
  await reload(page);
  await page.getByRole("menuitem", { name: "Spotlight", exact: true }).first().click();
  await spotlight(page).fill(word);
  const group = page.getByRole("group", { name: "News" });
  const row = group.getByRole("option", { name: new RegExp(word) });
  const listed = await seen(() => row.isVisible(), 15_000);
  await shot(page, "cross7-news");
  step("Spotlight suggests a story the News module serves, under News", listed);
  await closeSpotlight(page);
  await page.getByRole("menuitem", { name: "Spotlight", exact: true }).first().click();
  await spotlight(page).fill(`nosuchstory${id}`);
  await page.waitForTimeout(1_200);
  step("and none for words no story holds", (await group.count()) === 0);
  await closeSpotlight(page);
  await page.unroute("**/api/news/sources/*");
}

// ---- Siri ------------------------------------------------------------------------------------------

async function siri(page) {
  const field = page.getByRole("textbox", { name: "Type to Siri" });
  const ask = async (text, expected) => {
    if ((await field.count()) === 0) {
      await page.getByRole("menuitem", { name: "Siri", exact: true }).first().click();
      await field.waitFor({ timeout: 8_000 });
    }
    await field.fill(text);
    await field.press("Enter");
    return seen(() => page.getByText(expected).first().isVisible(), 12_000);
  };
  const title = `Call ${id}`;
  const reminder = async () =>
    (await api(page, "GET", "/api/reminders/data")).json.data?.reminders?.find(
      (each) => each.title === title,
    );
  await ask(`Remind me to ${title} at 3 PM tomorrow`, /I’ll remind you/);
  const made = await reminder();
  step("Siri makes the reminder", made?.dueTime === "15:00", JSON.stringify(made));
  const said = await ask("Change it to 5", /I changed the reminder/);
  const moved = await reminder();
  await shot(page, "cross7-siri-change");
  step(
    "“Change it to 5” moves that reminder to 5 PM on the server",
    said && moved?.dueTime === "17:00" && moved?.due === made.due && moved?.id === made.id,
    JSON.stringify(moved),
  );
  await ask("Change it to Call the plumber", /I changed the reminder/);
  const titled = async () =>
    (await api(page, "GET", "/api/reminders/data")).json.data?.reminders?.find(
      (each) => each.id === made.id,
    );
  const renamed = await seen(async () => (await titled())?.title === "Call the plumber");
  step("Other words become its title", renamed);
  await reload(page);
  const kept = await titled();
  step(
    "and both last across a reload",
    kept?.title === "Call the plumber" && kept?.dueTime === "17:00",
  );
  const said2 = await ask("Change it to 9", /can’t change that/);
  step("A new conversation has made nothing: it says it cannot", said2);
  await page.keyboard.press("Escape");
}

// ---- Spotlight's place -----------------------------------------------------------------------------

async function place(page) {
  const panel = page.locator(".mac-spotlight");
  const open = async () => {
    await page.getByRole("menuitem", { name: "Spotlight", exact: true }).first().click();
    await panel.waitFor({ timeout: 4_000 });
    await page.waitForTimeout(250);
  };
  await open();
  const box = await panel.boundingBox();
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 20, 880, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const dockTop = async () => (await page.locator(".mac-desktop-shell-dock").boundingBox()).y;
  const clear = async () => {
    const moved = await panel.boundingBox();
    const field = await page.locator(".mac-spotlight-field").boundingBox();
    return moved.y + field.height + 200 + 12 <= (await dockTop()) + 1 ? moved.y : false;
  };
  const lowest = await clear();
  step(
    "Moved low, it stops with room for its results above the Dock",
    lowest !== false,
    `${lowest}`,
  );
  await page.keyboard.type("calc");
  const body = page.locator(".mac-spotlight-body");
  await body.waitFor({ timeout: 4_000 });
  const edge = await seen(async () => {
    const shown = await body.boundingBox();
    return shown.y + shown.height <= (await dockTop());
  }, 4_000);
  await shot(page, "cross7-spotlight-low");
  step("and its resize edge stands above the Dock", edge);
  await closeSpotlight(page);
  const kept = await seen(async () => {
    const stored = (await api(page, "GET", "/api/system-preferences/settings")).json.values?.[
      "spotlight.place"
    ];
    return typeof stored?.y === "number" && stored.y > 0;
  }, 8_000);
  await reload(page);
  await open();
  step(
    "Its place is kept on the server, and is clear across a reload",
    kept && (await clear()) !== false,
  );
  await closeSpotlight(page);
}

await run({}, {}, async ({ person }) => {
  const ann = await person("ann", annAccount);
  const bob = wanted("alerts") ? await person("bob", bobAccount) : null;
  if (wanted("alerts")) await alerts(ann, bob);
  if (wanted("help")) await help(ann);
  if (wanted("news")) await news(ann);
  if (wanted("siri")) await siri(ann);
  if (wanted("place")) await place(ann);
  if (wanted("pdf")) await pdf(ann);
  if (wanted("photos")) await photos(ann);
});

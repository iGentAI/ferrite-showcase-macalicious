#!/usr/bin/env node

// Contacts, Calendar, Mail and Messages rows of batch 5, in a real browser against the running desktop, two real accounts,
// reading the server where a thing is stored and reloading where it persists:
//   alert: an alert raised through Notification Center with no Calendar window open, Close and Snooze on the server, not
//          raised again; with the window open, the window alone shows it.
//   invite: names asked for straight after a change arrives from elsewhere, none lost.
//   mail: File > Add to Calendar and the reader's button import an .ics; Raw Source in a window of its own; the id-less
//         DELETE /api/mail/trash is gone.
//   cards: Add to > New Card and VIPs, a card in All on My Mac, the private me card in an export, Choose from Drive with a
//          real picture, Message opening the conversation already open, a card dragged into Mail's To.
//
//   node e2e/pim-batch5-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--only alert,invite,mail,cards]

import { readFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import {
  blocks,
  windowOf as calendarOf,
  menuPath,
  named,
  openCalendar,
  putEvents,
  stored,
  timed,
  weekDay,
} from "./calendar-kit.mjs";
import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, allow, run, shot } = twoPeople("pim-batch5");
// The removed route answers 404 on purpose.
allow(/HTTP 404: \S*\/api\/mail\/trash/);
allow(/console: Failed to load resource: the server responded with a status of 404/);
const at = process.argv.indexOf("--only");
const only = at >= 0 ? process.argv[at + 1].split(",") : ["alert", "invite", "mail", "cards"];
const id = Date.now().toString(36).slice(-6);
const password = `tide-${id}-pool`;
const ann = { name: `p5ann${id}`, fullName: `Ann ${id}`, password };
const bob = { name: `p5bob${id}`, fullName: `Bob ${id}`, password };

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
const reloadDesktop = async (page) => {
  await page.reload({ waitUntil: "load" });
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
};
const menu = async (page, name, item) => {
  await page.getByRole("menubar").getByRole("menuitem", { name, exact: true }).first().click();
  await page.getByRole("menu").last().getByRole("menuitem", { name: item }).click();
};

// ---- Alerts with no Calendar window ---------------------------------------------------------------

const inbox = async (page) =>
  (await api(page, "GET", "/api/notification-center/inbox")).json.items ?? [];
const alertOf = (page, title) =>
  page.locator('[data-app="calendar"][data-style="alert"]').filter({ hasText: title });

async function alerts(page) {
  const start = Date.now() + 5 * 60_000;
  const soon = (key, title) => timed(key, title, start, 30, { alert: 15 });
  const closes = `Closes ${id}`;
  const snoozes = `Snoozes ${id}`;
  await putEvents(page, [soon("closes", closes), soon("snoozes", snoozes)]);
  const raised = await seen(async () => (await inbox(page)).length >= 2, 25_000);
  const notes = await inbox(page);
  const note = notes.find((item) => item.title === closes);
  step(
    "Alert: raised through Notification Center with no Calendar window open",
    raised && (await calendarOf(page).count()) === 0 && note?.id === `alert:closes@${start}`,
    JSON.stringify(note ?? notes),
  );
  step(
    "Alert: says how far off the event is, on the screen",
    (await seen(() => alertOf(page, closes).first().isVisible(), 8_000)) &&
      /^Starts in [45] minutes$/.test(note?.body ?? ""),
    note?.body,
  );
  await shot(page, "pim5-alert-no-window");

  await alertOf(page, closes).first().getByRole("button", { name: "Close" }).click();
  const closed = await seen(
    async () => named(await stored(page), closes)?.alertDismissed === start,
  );
  step("Alert: Close is saved with the event", closed);

  await alertOf(page, snoozes).first().getByRole("button", { name: "Snooze" }).click();
  const snoozed = await seen(async () => {
    const snooze = named(await stored(page), snoozes)?.alertSnooze;
    return snooze?.start === start && Math.abs(snooze.until - (Date.now() + 300_000)) < 30_000;
  });
  step("Alert: Snooze puts it off five minutes, saved with the event", snoozed);

  await reloadDesktop(page);
  await page.waitForTimeout(13_000);
  const after = await inbox(page);
  step(
    "Alert: closed and snoozed, not raised again after a reload and a later pass",
    after.every((item) => item.title !== closes && item.title !== snoozes) &&
      (await alertOf(page, closes).count()) === 0,
    JSON.stringify(after),
  );

  const shownHere = `Shown here ${id}`;
  await openCalendar(page);
  await putEvents(page, [...(await stored(page)), soon("shown-here", shownHere)]);
  await menuPath(page, "View", /^Refresh Calendars/);
  const windowAlert = page.locator("[data-event-alert]").filter({ hasText: shownHere });
  const shows = await seen(() => windowAlert.first().isVisible(), 12_000);
  await page.waitForTimeout(13_000);
  const quiet = (await inbox(page)).every((item) => item.title !== shownHere);
  step(
    "Alert: with the window open it shows there alone, and Notification Center holds nothing of it",
    shows && quiet && (await alertOf(page, shownHere).count()) === 0,
    `${shows} ${quiet}`,
  );
  await shot(page, "pim5-alert-window");
  await windowAlert.first().getByRole("button", { name: "Close" }).click();
}

// ---- Invitees: a name asked for right after a change from elsewhere ---------------------------------

async function invitees(page) {
  const popover = () => page.locator(".mac-calendar-popover").first();
  await openCalendar(page);
  const runs = 16;
  let kept = 0;
  for (let run = 0; run < runs; run += 1) {
    const title = `Ask ${id} ${run}`;
    await putEvents(page, [
      ...(await stored(page)),
      timed(`ask${run}`, title, weekDay(1 + (run % 5), 8 + (run % 8))),
    ]);
    await menuPath(page, "View", /^Refresh Calendars/);
    const block = blocks(page).filter({ hasText: title }).first();
    await block.waitFor({ timeout: 8_000 });
    await block.dblclick();
    await popover().waitFor({ timeout: 3_000 });
    await popover().getByRole("button", { name: "Add Invitees" }).click();
    const field = page.getByRole("textbox", { name: "Invitee" });
    await field.fill(bob.name);
    await field.press("Enter");
    const asked = await seen(
      async () => named(await stored(page), title)?.invitees?.includes(bob.name),
      6_000,
    );
    console.log(`     ${title}: on the server ${asked}`);
    if (asked) kept += 1;
    for (let press = 0; press < 3; press += 1) await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
  step(
    "Invitees: every name asked for straight after a change from elsewhere is kept",
    kept === runs,
    `${kept} of ${runs}`,
  );
}

// ---- Mail ------------------------------------------------------------------------------------------

const viewer = (page) => page.locator(".mac-mail").first();
const ICS = (uid, title) =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//macalicious//journey//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    "DTSTAMP:20260101T000000Z",
    `DTSTART:${new Date(Date.now() + 86_400_000).toISOString().replace(/[-:]|\.\d+/g, "")}`,
    `DTEND:${new Date(Date.now() + 90_000_000).toISOString().replace(/[-:]|\.\d+/g, "")}`,
    `SUMMARY:${title}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");

const attach = (page, name, type, text) =>
  page.evaluate(
    async ({ name, type, text }) => {
      const bytes = new TextEncoder().encode(text);
      const json = { "content-type": "application/json" };
      const started = await fetch("/api/mail/attachments", {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: JSON.stringify({ name, type, size: bytes.length }),
      }).then((reply) => reply.json());
      await fetch(`/api/mail/attachments/${started.attachment.id}/0`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/octet-stream" },
        body: bytes,
      });
      await fetch(`/api/mail/attachments/${started.attachment.id}/complete`, {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: "{}",
      });
      return started.attachment.id;
    },
    { name, type, text },
  );

async function mail(page) {
  const subject = `Ferry trip ${id}`;
  const body = `The words of ${id}`;
  const plain = `Plain ${id}`;
  const event = `Crossing ${id}`;
  const file = await attach(page, "Trip.ics", "text/calendar", ICS(`uid-${id}`, event));
  const sent = await api(page, "POST", "/api/mail/send", {
    to: [ann.name],
    subject,
    text: body,
    attachments: [file],
  });
  const other = await api(page, "POST", "/api/mail/send", {
    to: [ann.name],
    subject: plain,
    text: "No file",
  });
  if (sent.status !== 201 || other.status !== 201)
    throw new Error(`send ${sent.status} ${other.status}`);
  await openFromDock(page, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(page).isVisible());
  const row = (text) =>
    viewer(page)
      .getByRole("listbox", { name: "Messages" })
      .getByRole("option")
      .filter({ hasText: text })
      .first();
  await within(20_000, () => row(subject).isVisible());

  await row(plain).click();
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "File", exact: true })
    .first()
    .click();
  const dimmed = page.getByRole("menu").last().getByRole("menuitem", { name: "Add to Calendar" });
  step(
    "Add to Calendar: dimmed, saying why, on a message with no calendar file",
    (await dimmed.getAttribute("aria-disabled")) === "true" &&
      /calendar file/.test((await dimmed.getAttribute("title")) ?? ""),
  );
  await page.keyboard.press("Escape");

  await row(subject).click();
  await menu(page, "File", "Add to Calendar");
  const sheet = page.getByText("Import Events", { exact: true });
  const asks = await seen(() => sheet.isVisible(), 20_000);
  await shot(page, "pim5-add-to-calendar");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  const added = await seen(async () => Boolean(named(await stored(page), event)));
  step(
    "Add to Calendar: File's row imports the .ics into Calendar, read from the server",
    asks && added,
  );
  const said = page.getByRole("alertdialog").last();
  if (await seen(() => said.isVisible(), 3_000)) {
    console.log(`note: Calendar said: ${(await said.innerText()).replace(/\s+/g, " ")}`);
    await said.getByRole("button").last().click();
  }

  await openFromDock(page, "Mail", undefined).catch(() => {});
  await page.waitForTimeout(500);
  await viewer(page)
    .getByRole("button", { name: "Add to Calendar", exact: true })
    .click({ timeout: 8_000 });
  const askedAgain = await seen(() => sheet.isVisible(), 15_000);
  step("Add to Calendar: the reader's button opens Calendar's import on it", askedAgain);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  await openFromDock(page, "Mail", undefined).catch(() => {});
  await page.waitForTimeout(500);
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "View", exact: true })
    .first()
    .click();
  await page
    .getByRole("menu")
    .last()
    .getByRole("menuitem", { name: "Message", exact: true })
    .click();
  await page.getByRole("menu").last().getByRole("menuitemcheckbox", { name: "Raw Source" }).click();
  const source = page.getByRole("article", { name: `Raw source of ${subject}` });
  const shows = await seen(async () => {
    const text = await source.innerText();
    return text.includes(`Subject: ${subject}`) && text.includes(body);
  });
  const own = page.getByRole("region", { name: `Raw Source of ${subject}` });
  await shot(page, "pim5-raw-source");
  step(
    "Raw Source: the lines and the whole text, in a window of its own, the reader still reading",
    shows && (await own.count()) > 0 && (await viewer(page).getByText(body).first().isVisible()),
  );
  await own.getByRole("button", { name: "Close" }).first().click();
  step("Raw Source: its window closes", await seen(async () => (await source.count()) === 0));

  const gone = await api(page, "DELETE", "/api/mail/trash");
  step("DELETE /api/mail/trash, which took no ids, is gone", gone.status === 404, `${gone.status}`);

  await reloadDesktop(page);
  step(
    "Add to Calendar: the event is there after a reload",
    Boolean(named(await stored(page), event)),
  );
}

// ---- Contacts ----------------------------------------------------------------------------------------

const contactsOf = (page) => page.locator('.mac-contacts[aria-label="Contacts"]').first();
const rowOf = (page, name) =>
  contactsOf(page).getByRole("listbox").getByRole("option").filter({ hasText: name }).first();
const groupRow = (page, name) =>
  contactsOf(page).getByRole("tree", { name: "Groups" }).getByRole("treeitem", { name });
const cards = async (page) => (await api(page, "GET", "/api/contacts/cards")).json.cards ?? [];
const openContacts = async (page) => {
  if ((await contactsOf(page).count()) === 0) await openFromDock(page, "Contacts");
  else
    await page
      .getByRole("toolbar", { name: "Dock" })
      .getByRole("button", { name: "Contacts" })
      .click();
  await contactsOf(page).locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });
  await page.waitForTimeout(400);
};
const done = async (page) => {
  await contactsOf(page).getByRole("button", { name: "Done", exact: true }).click();
  await contactsOf(page)
    .getByRole("button", { name: "Edit", exact: true })
    .waitFor({ timeout: 5_000 });
};

/** A PNG of 8 by 8, one colour. */
const PNG = (() => {
  const crc = (bytes) => {
    let value = 0xffffffff;
    for (const byte of bytes) {
      value ^= byte;
      for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
    }
    return (value ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc(body), body.length + 4);
    return out;
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(8, 0);
  head.writeUInt32BE(8, 4);
  head.set([8, 2], 8);
  const line = Buffer.concat([Buffer.from([0]), Buffer.alloc(24, Buffer.from([30, 120, 200]))]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", head),
    chunk("IDAT", deflateSync(Buffer.concat(Array.from({ length: 8 }, () => line)))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
})();

async function contacts(page) {
  const BEA = `Bea${id}`;
  const NUMBER = "(555) 010-0142";
  const MAIL = `bea-${id}@example.com`;
  await openContacts(page);
  await contactsOf(page).getByRole("button", { name: "Contacts commands" }).click();
  await page.getByRole("menuitem", { name: "Add Desktop User…" }).click();
  const sheet = page.getByRole("dialog", { name: "Add a Desktop User" });
  await sheet.getByRole("textbox", { name: "Account Name" }).fill(bob.name);
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  await within(6_000, async () => (await sheet.count()) === 0);
  await page.waitForTimeout(1_000);

  // Add to, on a value.
  await contactsOf(page).getByRole("button", { name: "New Contact" }).click();
  const field = (name) => contactsOf(page).getByRole("textbox", { name, exact: true });
  await field("First").fill(BEA);
  await contactsOf(page)
    .getByRole("textbox", { name: /Phone$|phone$/ })
    .first()
    .fill(NUMBER);
  await contactsOf(page)
    .getByRole("textbox", { name: /Email$|email$/ })
    .first()
    .fill(MAIL);
  await done(page);
  const fieldMenu = page.getByRole("menu", { name: "Field commands" });
  const addTo = async (value, item) => {
    await contactsOf(page).getByText(value).first().click({ button: "right" });
    await fieldMenu.waitFor({ timeout: 5_000 });
    await fieldMenu.getByRole("menuitem", { name: "Add to", exact: true }).hover();
    await page.getByRole("menuitem", { name: item, exact: true }).click();
  };
  const before = (await cards(page)).length;
  await addTo(NUMBER, "New Card");
  await page.waitForTimeout(400);
  await field("First").fill(`Copy${id}`);
  await done(page);
  const copied = await seen(async () =>
    (await cards(page)).some(
      (card) => card.first === `Copy${id}` && card.phones?.[0]?.value === NUMBER,
    ),
  );
  step(
    "Add to > New Card: a card holding the value, on the server",
    copied && (await cards(page)).length === before + 1,
  );
  await shot(page, "pim5-add-to-new-card");

  await rowOf(page, BEA).click();
  await contactsOf(page).getByText(NUMBER).first().click({ button: "right" });
  await fieldMenu.waitFor({ timeout: 5_000 });
  await fieldMenu.getByRole("menuitem", { name: "Add to", exact: true }).hover();
  const vipRow = page.getByRole("menuitem", { name: "VIPs", exact: true });
  step(
    "Add to > VIPs: dimmed on a phone number, saying why",
    (await vipRow.getAttribute("aria-disabled")) === "true" &&
      /email addresses/.test((await vipRow.getAttribute("title")) ?? ""),
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await addTo(MAIL, "VIPs");
  await page.waitForTimeout(1_500);

  // A card in All on My Mac.
  await groupRow(page, "All on My Mac").click();
  await contactsOf(page).getByRole("button", { name: "New Contact" }).click();
  await field("First").fill(`Macky${id}`);
  await done(page);
  const macCard = await seen(async () =>
    (await cards(page)).some((card) => card.first === `Macky${id}` && card.account === "mac"),
  );
  const others = contactsOf(page).getByRole("listbox").getByRole("option");
  const listed = await rowOf(page, `Macky${id}`).isVisible();
  const alone = (await others.count()) === 1;
  await shot(page, "pim5-all-on-my-mac");
  step(
    "All on My Mac: a card made there is in that account, and it alone is listed",
    macCard && listed && alone,
    `${macCard} ${listed} ${alone}`,
  );
  await groupRow(page, "All Contacts").click();

  // Choose from Drive: a real picture.
  const picture = `Face ${id}.png`;
  await page.evaluate(
    async ({ name, data }) => {
      const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
      const json = { "content-type": "application/json" };
      const started = await fetch("/api/files/uploads", {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: JSON.stringify({
          parent: "pictures",
          name,
          size: bytes.length,
          type: "image/png",
          existing: "rename",
        }),
      }).then((reply) => reply.json());
      await fetch(`/api/files/uploads/${started.upload}/0`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/octet-stream" },
        body: bytes,
      });
      await fetch(`/api/files/uploads/${started.upload}/complete`, {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: "{}",
      });
    },
    { name: picture, data: PNG.toString("base64") },
  );
  // The page learns of a file a request put on the drive when it next reads the drive.
  await reloadDesktop(page);
  await openContacts(page);
  await rowOf(page, BEA).click();
  await contactsOf(page).getByRole("button", { name: "Edit", exact: true }).click();
  await contactsOf(page)
    .getByRole("group", { name: "Card" })
    .getByRole("button", { name: "Picture" })
    .click();
  await contactsOf(page).getByRole("button", { name: "Choose from Drive…" }).click();
  const panel = page.locator(".mac-contacts-panel-layer");
  await panel.waitFor({ timeout: 5_000 });
  await panel
    .getByText(new RegExp(`^Face ${id}`))
    .first()
    .click();
  await page.waitForTimeout(300);
  await shot(page, "pim5-choose-from-drive");
  await panel.getByRole("button", { name: "Open", exact: true }).click();
  const pictured = await seen(async () =>
    (await cards(page)).some((card) => card.first === BEA && card.image),
  );
  await contactsOf(page)
    .getByRole("group", { name: "Card" })
    .getByRole("button", { name: "Info" })
    .click();
  await done(page);
  step(
    "Choose from Drive…: a picture picked from the drive is on the card, on the server",
    pictured,
  );

  // The private me card.
  await menu(page, "Contacts", /^Preferences/);
  await page.getByRole("tab", { name: "vCard" }).click();
  await page.getByRole("checkbox", { name: "Enable private me card" }).click();
  await page.waitForTimeout(800);
  await page
    .getByRole("region", { name: "vCard" })
    .last()
    .getByRole("button", { name: "Close" })
    .first()
    .click()
    .catch(() => {});
  await openContacts(page);
  await rowOf(page, ann.fullName).click();
  await contactsOf(page).getByRole("button", { name: "Edit", exact: true }).click();
  const secret = `secret-${id}@example.com`;
  const shared = `shared-${id}@example.com`;
  await contactsOf(page)
    .getByRole("textbox", { name: /email$/i })
    .last()
    .fill(secret);
  await contactsOf(page)
    .getByRole("textbox", { name: /email$/i })
    .last()
    .fill(shared);
  await contactsOf(page)
    .getByRole("checkbox", { name: /^Share .*email$/i })
    .first()
    .click();
  await done(page);
  const marked = await seen(async () => {
    const me = (await cards(page)).find((card) => card.me);
    return me?.emails?.find((each) => each.value === secret)?.private === true;
  });
  await rowOf(page, ann.fullName).click();
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
  const text = await readFile(await download.path(), "utf8");
  step(
    "Private me card: a field unchecked is kept on the card and left out of its vCard",
    marked && text.includes(shared) && !text.includes(secret),
    `${marked} ${text.includes(shared)} ${text.includes(secret)}`,
  );

  // Message opens the conversation already open.
  const hello = `Hello ${id}`;
  const started = await api(page, "POST", "/api/messages/conversations", { to: [bob.name] });
  const conversation = started.json?.state?.id;
  await api(page, "POST", `/api/messages/conversations/${conversation}/messages`, { text: hello });
  await rowOf(page, bob.fullName).click();
  await contactsOf(page).getByRole("button", { name: "message", exact: true }).click();
  const messages = page.locator('.mac-messages[aria-label="Messages"]').first();
  const opened = await seen(() => messages.getByText(hello).first().isVisible(), 15_000);
  const noTo = (await messages.getByRole("textbox", { name: "To" }).count()) === 0;
  await shot(page, "pim5-message-button");
  step(
    "Message button: shows the conversation already open with them, not a new message",
    opened && noTo,
    `${opened} ${noTo}`,
  );
  await openContacts(page);
  await rowOf(page, BEA).click();
  await page.waitForTimeout(300);
  await rowOf(page, bob.fullName).click();
  await contactsOf(page).getByRole("button", { name: "message", exact: true }).click();
  await page.waitForTimeout(600);
  step(
    "Message button: again with Messages open, the same conversation",
    (await messages.getByText(hello).first().isVisible()) &&
      (await messages.getByRole("textbox", { name: "To" }).count()) === 0,
  );

  // A card dragged into Mail's To.
  const place = async (element, x, y) => {
    const box = await element.boundingBox();
    const bars = element.locator(".mac-title-bar").first();
    const bar = (await bars.count()) > 0 ? await bars.boundingBox() : box;
    const grip = { x: bar.x + Math.min(bar.width / 2, 100), y: bar.y + 6 };
    await page.mouse.move(grip.x, grip.y);
    await page.mouse.down();
    await page.mouse.move(grip.x + x - box.x, grip.y + y - box.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(150);
  };
  await openContacts(page);
  await place(contactsOf(page), 10, 40);
  const shelf = await contactsOf(page).boundingBox();
  await openFromDock(page, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(page).isVisible());
  await place(viewer(page), shelf.x + shelf.width + 20, 500);
  await viewer(page).getByRole("button", { name: "New Message" }).click();
  const compose = page.locator(".mac-mail-compose").first();
  await compose.waitFor({ timeout: 10_000 });
  await place(compose, shelf.x + shelf.width + 20, 40);
  await openContacts(page);
  await rowOf(page, BEA).click();
  const to = compose.getByRole("listbox", { name: "To recipients" });
  const field2 = await compose.getByLabel("To:").boundingBox();
  const card = await rowOf(page, BEA).boundingBox();
  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
  await page.mouse.down();
  await page.mouse.move(card.x + card.width / 2 + 12, card.y + card.height / 2 + 8, { steps: 4 });
  await page.mouse.move(field2.x + 30, field2.y + field2.height / 2, { steps: 14 });
  await page.waitForTimeout(150);
  await page.mouse.up();
  const filled = await seen(async () => (await to.innerText()).includes(MAIL), 6_000);
  await shot(page, "pim5-card-into-to");
  step(
    "A card dragged from Contacts into To: its address is there",
    filled,
    await to.innerText().catch(() => ""),
  );

  // Across a reload.
  await reloadDesktop(page);
  await openFromDock(page, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(page).isVisible());
  const vip = await seen(
    () =>
      viewer(page)
        .getByRole("treeitem", { name: new RegExp(BEA) })
        .first()
        .isVisible(),
    10_000,
  );
  step("Add to > VIPs: Mail lists them as a VIP, after a reload", vip);
  await openContacts(page);
  await groupRow(page, "All on My Mac").click();
  step(
    "All on My Mac: the card is still listed there after a reload",
    await seen(() => rowOf(page, `Macky${id}`).isVisible(), 8_000),
  );
  const stillPictured = (await cards(page)).some((card) => card.first === BEA && card.image);
  step("Choose from Drive…: the picture is there after a reload", stillPictured);
}

await run({}, {}, async ({ person }) => {
  const page = await person("ann", ann);
  await person("bob", bob);
  if (only.includes("alert")) await alerts(page);
  if (only.includes("invite")) await invitees(page);
  if (only.includes("mail")) await mail(page);
  if (only.includes("cards")) await contacts(page);
});
